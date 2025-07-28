const express = require('express');
const { chromium } = require('playwright');

const app = express();
app.use(express.json({ limit: '10mb' }));

let browser = null;
let page = null;

/**
 * Smart selector function that tries multiple selector candidates
 */
async function smartClick(page, selectors) {
  const candidates = Array.isArray(selectors) ? selectors : [selectors];
  console.log(`[SMART_CLICK] Trying ${candidates.length} selector candidates`);
  
  for (const selector of candidates) {
    try {
      console.log(`[SMART_CLICK] Trying: ${selector}`);
      const locator = page.locator(selector).first();
      
      // Check if element exists and is visible
      if (await locator.count() > 0) {
        const isVisible = await locator.isVisible({ timeout: 1000 }).catch(() => false);
        if (isVisible) {
          console.log(`[SMART_CLICK] Found visible element with: ${selector}`);
          await locator.click();
          return;
        } else {
          console.log(`[SMART_CLICK] Element found but not visible: ${selector}`);
        }
      }
    } catch (error) {
      console.log(`[SMART_CLICK] Selector failed: ${selector} - ${error.message}`);
    }
  }
  
  throw new Error(`None of the ${candidates.length} selectors worked: ${candidates.join(', ')}`);
}

/**
 * Smart type function that tries multiple selector candidates
 */
async function smartType(page, selectors, text) {
  const candidates = Array.isArray(selectors) ? selectors : [selectors];
  console.log(`[SMART_TYPE] Trying ${candidates.length} selector candidates`);
  
  for (const selector of candidates) {
    try {
      console.log(`[SMART_TYPE] Trying: ${selector}`);
      const locator = page.locator(selector).first();
      
      // Check if element exists and is visible
      if (await locator.count() > 0) {
        const isVisible = await locator.isVisible({ timeout: 1000 }).catch(() => false);
        if (isVisible) {
          console.log(`[SMART_TYPE] Found visible element with: ${selector}`);
          await locator.fill(text);
          return;
        } else {
          console.log(`[SMART_TYPE] Element found but not visible: ${selector}`);
        }
      }
    } catch (error) {
      console.log(`[SMART_TYPE] Selector failed: ${selector} - ${error.message}`);
    }
  }
  
  throw new Error(`None of the ${candidates.length} selectors worked: ${candidates.join(', ')}`);
}

// Initialize browser on startup
async function initBrowser() {
  // Default to headless mode if not explicitly set, especially in Docker
  const headless = process.env.HEADLESS !== 'false'; // Default to true unless explicitly false
  const startUrl = process.env.START_URL || 'about:blank';
  
  console.log('Initializing browser with options:', { headless, startUrl });
  
  try {
    browser = await chromium.launch({
      headless,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions'
      ]
    });
    
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    
    page = await context.newPage();
    
    if (startUrl && startUrl !== 'about:blank') {
      await page.goto(startUrl);
    }
    
    console.log('Browser initialized successfully');
  } catch (error) {
    console.error('Failed to initialize browser:', error.message);
    
    // If headed mode failed, try headless as fallback
    if (!headless && (error.message.includes('X server') || error.message.includes('XServer'))) {
      console.log('Retrying with headless mode due to X server issue...');
      try {
        browser = await chromium.launch({
          headless: true,
          args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-extensions'
          ]
        });
        
        const context = await browser.newContext({
          viewport: { width: 1280, height: 720 }
        });
        
        page = await context.newPage();
        
        if (startUrl && startUrl !== 'about:blank') {
          await page.goto(startUrl);
        }
        
        console.log('Browser initialized successfully in headless mode');
      } catch (retryError) {
        console.error('Failed to initialize browser even in headless mode:', retryError.message);
        throw retryError;
      }
    } else {
      throw error;
    }
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    browserActive: browser !== null 
  });
});

// Execute action
app.post('/execute', async (req, res) => {
  try {
    if (!page) {
      return res.status(500).json({ error: 'Browser not initialized' });
    }
    
    const { type, ...params } = req.body;
    
    switch (type) {
      case 'navigate':
        await page.goto(params.url);
        break;
      case 'click':
        await smartClick(page, params.selector);
        break;
      case 'type':
        await smartType(page, params.selector, params.text);
        break;
      case 'press':
        // If selector provided, press key within that element; otherwise press at the page level
        const key = params.key || 'Enter';
        if (params.selector) {
          // Re-use smartClick logic to locate the element (but without clicking)
          const candidates = Array.isArray(params.selector) ? params.selector : [params.selector];
          let found = false;
          for (const selector of candidates) {
            try {
              const locator = page.locator(selector).first();
              if (await locator.count() > 0 && await locator.isVisible({ timeout: 1000 }).catch(() => false)) {
                await locator.press(key);
                found = true;
                break;
              }
            } catch (err) {
              // Continue trying other selectors
            }
          }
          if (!found) {
            throw new Error(`None of the selectors matched for press: ${candidates.join(', ')}`);
          }
        } else {
          await page.keyboard.press(key);
        }
        break;
      case 'wait':
        // Simple wait by duration in ms
        const duration = params.duration || 1000;
        await page.waitForTimeout(duration);
        break;
      case 'screenshot':
        const screenshot = await page.screenshot({ 
          type: 'png',
          fullPage: params.fullPage || false 
        });
        return res.json({ 
          success: true, 
          data: screenshot.toString('base64') 
        });
      default:
        return res.status(400).json({ error: `Unknown action type: ${type}` });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Execute error:', error);
    res.status(500).json({ 
      error: error.message || 'Unknown error' 
    });
  }
});

// Get current URL
app.get('/url', async (req, res) => {
  try {
    if (!page) {
      return res.status(500).json({ error: 'Browser not initialized' });
    }
    
    const url = page.url();
    res.json({ url });
  } catch (error) {
    console.error('Get URL error:', error);
    res.status(500).json({ 
      error: error.message || 'Unknown error' 
    });
  }
});

// Screenshot endpoint
app.post('/screenshot', async (req, res) => {
  try {
    if (!page) {
      return res.status(500).json({ error: 'Browser not initialized' });
    }
    
    const screenshot = await page.screenshot({ 
      type: 'png',
      fullPage: req.body.fullPage || false 
    });
    
    res.json({ 
      success: true, 
      data: screenshot.toString('base64') 
    });
  } catch (error) {
    console.error('Screenshot error:', error);
    res.status(500).json({ 
      error: error.message || 'Unknown error' 
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing browser...');
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});

// Start server
const PORT = process.env.PORT || 3000;

initBrowser().then(() => {
  app.listen(PORT, () => {
    console.log(`Browser automation server running on port ${PORT}`);
  });
}).catch((error) => {
  console.error('Failed to initialize browser:', error);
  process.exit(1);
}); 