import express from 'express';
import { BrowserAutomation } from '../../src/browser/BrowserAutomation';
import { BrowserAction } from '../../src/types';

const app = express();
app.use(express.json({ limit: '10mb' }));

let browserAutomation: BrowserAutomation | null = null;

// Initialize browser on startup
async function initBrowser() {
  const startUrl = process.env.START_URL || 'about:blank';
  const headless = process.env.HEADLESS === 'true';
  
  browserAutomation = new BrowserAutomation({
    headless,
    browserType: 'chromium'
  });
  
  await browserAutomation.initialize();
  
  if (startUrl && startUrl !== 'about:blank') {
    await browserAutomation.executeAction({
      type: 'navigate',
      url: startUrl
    });
  }
  
  console.log('Browser initialized');
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    browserActive: browserAutomation !== null 
  });
});

// Execute browser action
app.post('/execute', async (req, res) => {
  try {
    if (!browserAutomation) {
      return res.status(500).json({ error: 'Browser not initialized' });
    }
    
    const action: BrowserAction = req.body;
    const result = await browserAutomation.executeAction(action);
    
    res.json({ success: true, result });
  } catch (error) {
    console.error('Execute error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Get current URL
app.get('/url', async (req, res) => {
  try {
    if (!browserAutomation) {
      return res.status(500).json({ error: 'Browser not initialized' });
    }
    
    const url = await browserAutomation.getCurrentUrl();
    res.json({ url });
  } catch (error) {
    console.error('Get URL error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Take screenshot
app.post('/screenshot', async (req, res) => {
  try {
    if (!browserAutomation) {
      return res.status(500).json({ error: 'Browser not initialized' });
    }
    
    const { name, options } = req.body;
    const path = await browserAutomation.takeScreenshot(name, options);
    
    // Read the screenshot and return as base64
    const fs = require('fs');
    const screenshot = fs.readFileSync(path, 'base64');
    
    res.json({ 
      success: true, 
      path,
      data: screenshot 
    });
  } catch (error) {
    console.error('Screenshot error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing browser...');
  if (browserAutomation) {
    await browserAutomation.close();
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