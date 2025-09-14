const express = require('express');
const { chromium } = require('playwright');
const WebSocket = require('ws');

const app = express();

// Add global error handlers to prevent container crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, just log the error
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit the process for screenshot timeouts
  if (error.message && error.message.includes('Timeout') && error.message.includes('screenshot')) {
    console.log('Screenshot timeout caught - continuing operation');
    return;
  }
  // For other uncaught exceptions, we should still exit
  process.exit(1);
});

// Helper function to find a working selector from an array of candidates
async function findWorkingSelector(page, selectors) {
  // If it's a single selector, return it
  if (!Array.isArray(selectors)) {
    return selectors;
  }
  
  // Try each selector until one works
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector);
      const count = await locator.count();
      if (count > 0) {
        const isVisible = await locator.isVisible({ timeout: 1000 }).catch(() => false);
        if (isVisible) {
          console.log(`Found working selector: ${selector}`);
          return selector;
        }
      }
    } catch (error) {
      // Continue trying next selector
      continue;
    }
  }
  
  // If no selector worked, return the first one and let it fail naturally
  console.log(`No working selector found, using first: ${selectors[0]}`);
  return selectors[0];
}
app.use(express.json({ limit: '10mb' }));

let browser = null;
let context = null;
let page = null;

// WebRTC sessions - each session gets its own WebSocket and streaming
const webrtcSessions = new Map();
// Queue for commands to prevent conflicts with streaming
const commandQueue = [];

// Debounce mechanism for keyboard input to reduce flickering
let lastKeyPressTime = 0;
let lastClickTime = 0;
let consecutiveTimeouts = 0;
const MAX_CONSECUTIVE_TIMEOUTS = 8; // Allow more timeouts before degrading service
const TYPING_DEBOUNCE_MS = 40; // Reduced debounce for better responsiveness
const CLICK_DEBOUNCE_MS = 50; // Small delay after clicks

// Global frame capture state to coordinate WebRTC and WebSocket streaming
let globalFrameCapture = {
  isCapturing: false,
  lastCaptureTime: 0,
  activeStreams: new Set(),
  captureQueue: []
};

// Initialize browser on startup
async function initBrowser() {
  const startUrl = process.env.START_URL || 'about:blank';
  const headless = process.env.HEADLESS === 'true';

  console.log(`Initializing browser with options: { headless: ${headless}, startUrl: '${startUrl}' }`);
  
  try {
    const launchArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--no-default-browser-check',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-dev-shm-usage'
    ];
    browser = await chromium.launch({ 
      headless,
      args: launchArgs
    });
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: process.env.LOCALE || 'en-US',
      timezoneId: process.env.TIMEZONE || 'America/Los_Angeles',
      ignoreHTTPSErrors: true
    });
    // Stealth-like init scripts
    await context.addInitScript(`
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1,2,3,4,5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US','en'] });
      // @ts-ignore
      window.chrome = { runtime: {} };
      const originalQuery = navigator.permissions && navigator.permissions.query;
      if (originalQuery) {
        navigator.permissions.query = (parameters) => (
          parameters && parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );
      }
    `);
    page = await context.newPage();
    
    if (startUrl && startUrl !== 'about:blank') {
      await page.goto(startUrl);
    }
    
    console.log('Browser initialized successfully');
  } catch (error) {
    console.error('Failed to initialize browser:', error);
    // Retry with headless if failed
    if (!headless) {
      console.log('Retrying with headless mode...');
      browser = await chromium.launch({ 
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--no-default-browser-check',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-dev-shm-usage'
        ]
      });
      context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: process.env.LOCALE || 'en-US',
        timezoneId: process.env.TIMEZONE || 'America/Los_Angeles',
        ignoreHTTPSErrors: true
      });
      await context.addInitScript(`
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'plugins', { get: () => [1,2,3,4,5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US','en'] });
        // @ts-ignore
        window.chrome = { runtime: {} };
        const originalQuery = navigator.permissions && navigator.permissions.query;
        if (originalQuery) {
          navigator.permissions.query = (parameters) => (
            parameters && parameters.name === 'notifications' ?
              Promise.resolve({ state: Notification.permission }) :
              originalQuery(parameters)
          );
        }
      `);
      page = await context.newPage();
      if (startUrl && startUrl !== 'about:blank') {
        await page.goto(startUrl);
      }
      console.log('Browser initialized in headless mode');
    }
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    browserActive: browser !== null,
    webrtcSessions: webrtcSessions.size
  });
});

// Execute browser action with queue management
app.post('/execute', async (req, res) => {
  try {
    if (!browser || !page) {
      return res.status(500).json({ error: 'Browser not initialized' });
    }

    // Queue the command to prevent interference with streaming
    const commandPromise = new Promise((resolve, reject) => {
      commandQueue.push(async () => {
        try {
          const action = req.body;
          let result;
          
          switch (action.type) {
            case 'navigate':
              await page.goto(action.url);
              result = { url: page.url() };
              break;

            case 'click':
              const clickSelector = await findWorkingSelector(page, action.selector);
              try {
                const box = await page.locator(clickSelector).first().boundingBox();
                if (box) {
                  const cx = box.x + box.width / 2;
                  const cy = box.y + box.height / 2;
                  await page.mouse.move(cx, cy, { steps: 12 });
                  await page.waitForTimeout(40);
                }
              } catch {}
              await page.click(clickSelector);
              result = { clicked: true };
              break;
            case 'type':
              const typeSelector = await findWorkingSelector(page, action.selector);
              try {
                const ibox = await page.locator(typeSelector).first().boundingBox();
                if (ibox) {
                  const ix = ibox.x + Math.min(ibox.width - 4, 8);
                  const iy = ibox.y + Math.min(ibox.height - 4, 8);
                  await page.mouse.move(ix, iy, { steps: 10 });
                  await page.waitForTimeout(30);
                }
              } catch {}
              await page.fill(typeSelector, action.text);
              result = { typed: true };
              break;
            case 'wait':
              if (action.duration) {
                await page.waitForTimeout(action.duration);
              } else if (action.selector) {
                const selector = await findWorkingSelector(page, action.selector);
                await page.waitForSelector(selector, { 
                  state: action.state || 'visible',
                  timeout: 30000 
                });
              } else {
                await page.waitForTimeout(1000);
              }
              result = { waited: true };
              break;
            case 'scroll':
              if (action.selector) {
                const selector = await findWorkingSelector(page, action.selector);
                await page.locator(selector).scrollIntoViewIfNeeded();
              } else {
                const x = action.direction === 'right' ? action.amount || 0 : action.direction === 'left' ? -(action.amount || 0) : 0;
                const y = action.direction === 'down' ? action.amount || 0 : action.direction === 'up' ? -(action.amount || 0) : 0;
                await page.mouse.wheel(x, y);
              }
              result = { scrolled: true };
              break;
            case 'select':
              const selectSelector = await findWorkingSelector(page, action.selector);
              await page.selectOption(selectSelector, action.value);
              result = { selected: true };
              break;
            case 'press':
              if (action.selector) {
                const pressSelector = await findWorkingSelector(page, action.selector);
                await page.press(pressSelector, action.key);
              } else {
                await page.keyboard.press(action.key);
              }
              result = { pressed: true };
              break;
            case 'goBack':
              await page.goBack({ waitUntil: action.waitUntil || 'load' });
              result = { url: page.url() };
              break;
            case 'goForward':
              await page.goForward({ waitUntil: action.waitUntil || 'load' });
              result = { url: page.url() };
              break;
            case 'reload':
              await page.reload({ waitUntil: action.waitUntil || 'load' });
              result = { url: page.url() };
              break;
            case 'newTab':
              const newPage = await page.context().newPage();
              if (action.url) {
                await newPage.goto(action.url);
              }
              result = { newTabCreated: true, url: newPage.url() };
              break;
            case 'screenshot':
              const screenshot = await page.screenshot({ timeout: 3000 }); // Reduced timeout
              result = { screenshot: screenshot.toString('base64') };
              break;
            default:
              throw new Error(`Unknown action type: ${action.type}`);
          }

          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          processQueue();
        }
      });
      
      if (commandQueue.length === 1) {
        processQueue();
      }
    });

    const result = await commandPromise;
    res.json({ success: true, result });

  } catch (error) {
    console.error('Action execution error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Process command queue - drain all commands
let queueBusy = false;
async function processQueue() {
  if (queueBusy) return;
  queueBusy = true;

  try {
    while (commandQueue.length > 0) {
      const cmd = commandQueue.shift();
      try {
        console.log(`Processing command ${commandQueue.length + 1} remaining commands`);
        await cmd(); // Execute the command function directly
      } catch (e) {
        console.error('Command execution error:', e);
        // Continue processing other commands even if one fails
      }
    }
  } finally {
    queueBusy = false;
  }
}

// Screenshot endpoint (non-interfering with streaming)
app.post('/screenshot', async (req, res) => {
  try {
    if (!browser || !page) {
      return res.status(500).json({ error: 'Browser not initialized' });
    }

    // Remove command waiting logic

    const screenshot = await page.screenshot({ timeout: 10000 });
    res.json({ 
      success: true, 
      data: screenshot.toString('base64') 
    });
  } catch (error) {
    console.error('Screenshot error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get current URL
app.get('/url', async (req, res) => {
  try {
    if (!browser || !page) {
      return res.status(500).json({ error: 'Browser not initialized' });
    }

    const url = page.url();
    res.json({ url });
  } catch (error) {
    console.error('URL error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get page HTML content for intelligent processing
app.get('/html', async (req, res) => {
  try {
    if (!browser || !page) {
      return res.status(500).json({ error: 'Browser not initialized' });
    }

    const html = await page.content();
    res.json({ html, url: page.url(), timestamp: Date.now() });
  } catch (error) {
    console.error('HTML extraction error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Evaluate script
app.post('/evaluate', async (req, res) => {
  try {
    if (!browser || !page) {
      return res.status(500).json({ error: 'Browser not initialized' });
    }

    const { script } = req.body;
    const result = await page.evaluate(script);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Evaluate error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// WebRTC endpoint - create a streaming session
app.post('/webrtc', async (req, res) => {
  const { sessionId, sdp } = req.body;
  
  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID required' });
  }
  
  if (!browser || !page) {
    return res.status(500).json({ error: 'Browser not initialized' });
  }
  
  try {
    // For now, return a placeholder response indicating WebRTC is ready
    // We'll use WebSocket for actual streaming
    res.json({
      sessionId,
      webrtcId: sessionId,
      streamUrl: `/stream/websocket/${sessionId}`,
      message: 'WebRTC session created - use WebSocket for streaming'
    });
  } catch (err) {
    console.error('WebRTC setup error:', err);
    res.status(500).json({ 
      error: 'Failed to establish WebRTC session', 
      detail: err.message 
    });
  }
});

// Remote control endpoint
app.post('/webrtc/:id/control', async (req, res) => {
  const sessionId = req.params.id;
  const session = webrtcSessions.get(sessionId);
  
  if (!session || !browser || !page) {
    return res.status(404).json({ error: 'Session not found or not streaming' });
  }
  
  const { type, x, y, key } = req.body;
  
  try {
    // Add to command queue to prevent interference
    const controlPromise = new Promise((resolve, reject) => {
      commandQueue.push(async () => {
        try {
          switch (type) {
            case 'mouse_move':
              await page.mouse.move(x, y);
              break;
            case 'mouse_click':
              if (x !== undefined && y !== undefined) {
                await page.mouse.click(x, y);
                lastClickTime = Date.now(); // Track click time for debouncing
                console.log(`Mouse clicked at (${x}, ${y})`);
              }
              break;
            case 'key':
              lastKeyPressTime = Date.now(); // Track typing for debounce
              await page.keyboard.press(key);
              break;
            default:
              throw new Error(`Unknown control type: ${type}`);
          }
          
          resolve({ success: true });
        } catch (error) {
          reject(error);
        } finally {
          processQueue();
        }
      });
      
      if (commandQueue.length === 1) {
        processQueue();
      }
    });

    await controlPromise;
    res.json({ success: true });
  } catch (e) {
    console.error('Remote control error:', e);
    res.status(500).json({ 
      error: 'Control action failed', 
      detail: e.message 
    });
  }
});

// Simple screenshot streaming endpoint for fallback (DISABLED - using WebRTC)
app.get('/stream/screenshot/:sessionId', async (req, res) => {
  res.status(410).json({ 
    error: 'SSE screenshot streaming disabled', 
    message: 'Use WebRTC streaming instead' 
  });
});

// WebSocket server for real-time streaming
const wss = new WebSocket.Server({ noServer: true });

// Handle WebSocket connection for streaming
function handleWebSocketConnection(ws, sessionId) {
  console.log(`🔌 WebSocket connected for session: ${sessionId}`);
  
  let streamInterval = null;
  let isStreaming = false;
  
  // Clean up any existing session with the same ID
  const existingSession = webrtcSessions.get(sessionId);
  if (existingSession) {
    console.log(`🗑️ Cleaning up existing session ${sessionId}`);
    if (existingSession.streamInterval) {
      clearInterval(existingSession.streamInterval);
    }
    if (existingSession.ws && existingSession.ws.readyState === WebSocket.OPEN) {
      existingSession.ws.close();
    }
  }
  
  // Store new session
  webrtcSessions.set(sessionId, { 
    ws, 
    isStreaming: false,
    lastFrame: null,
    frameCount: 0,
    sessionId: sessionId // Add explicit session ID
  });
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'start_stream':
          if (!isStreaming) {
            isStreaming = true;
            webrtcSessions.get(sessionId).isStreaming = true;
            startScreenshotStream(ws, sessionId);
          }
          break;
          
        case 'stop_stream':
          if (streamInterval) {
            clearInterval(streamInterval);
            streamInterval = null;
            isStreaming = false;
            const session = webrtcSessions.get(sessionId);
            if (session) {
              session.isStreaming = false;
              if (session.streamInterval) {
                clearInterval(session.streamInterval);
                session.streamInterval = null;
              }
            }
            globalFrameCapture.activeStreams.delete(`ws-${sessionId}`);
          }
          break;
          
        case 'control':
          await handleRemoteControl(data.control);
          break;
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      ws.send(JSON.stringify({ type: 'error', error: error.message }));
    }
  });
  
  ws.on('close', () => {
    console.log(`🔌 WebSocket disconnected for session: ${sessionId}`);
    
    // Clean up stream interval
    if (streamInterval) {
      clearInterval(streamInterval);
      streamInterval = null;
    }
    
    // Clean up session-specific intervals
    const session = webrtcSessions.get(sessionId);
    if (session && session.streamInterval) {
      clearInterval(session.streamInterval);
      session.streamInterval = null;
    }
    
    // Clean up global frame capture state
    globalFrameCapture.activeStreams.delete(`ws-${sessionId}`);
    
    // Remove session completely
    webrtcSessions.delete(sessionId);
    
    console.log(`✅ Session ${sessionId} completely cleaned up`);
  });
  
  // Send initial ready message
  ws.send(JSON.stringify({ type: 'ready', sessionId }));
}

// WebSocket screenshot streaming RE-ENABLED with anti-flicker optimizations
function startScreenshotStream(ws, sessionId) {
  console.log(`Starting optimized WebSocket screenshot streaming for ${sessionId}`);
  
  let streamInterval = null;
  let isCapturing = false;
  let lastFrameTime = 0;
  let frameSkipped = false;
  
  // Frame capture settings optimized for reduced flickering
  const FRAME_RATE = 12; // Reduced to 12 FPS for better stability
  const FRAME_INTERVAL = 1000 / FRAME_RATE; // ~67ms between frames
  const TYPING_DEBOUNCE = 150; // Wait 150ms after typing before capturing
  const MAX_FRAME_SIZE = 250 * 1024; // 250KB max frame size (increased)
  const TARGET_FRAME_SIZE = 150 * 1024; // 150KB target size
  let currentQuality = 75; // Dynamic quality adjustments
  
  // Track global frame capture state
  globalFrameCapture.activeStreams.add(`ws-${sessionId}`);
  
  async function captureAndSendFrame() {
    if (!browser || !page || isCapturing) {
      return;
    }
    
    // Verify this session is still active
    const currentSession = webrtcSessions.get(sessionId);
    if (!currentSession || !currentSession.isStreaming) {
      console.log(`🚫 Skipping frame capture - session ${sessionId} no longer streaming`);
      return;
    }
    
    const now = Date.now();
    
    // Skip frame if too soon (rate limiting)
    if (now - lastFrameTime < FRAME_INTERVAL) {
      frameSkipped = true;
      return;
    }
    
         // Check if there are pending commands (like typing) - debounce
     if (commandQueue.length > 0) {
       console.log('Skipping frame capture - commands pending');
       return;
     }
     
     // Skip frame capture if user is actively typing (debounce)
     if (now - lastKeyPressTime < TYPING_DEBOUNCE_MS) {
       console.log('Skipping frame capture - user typing');
       return;
     }
    
    isCapturing = true;
    
    try {
      // Use viewport-only capture with dynamic quality
      const screenshot = await page.screenshot({ 
        type: 'jpeg', 
        quality: currentQuality,
        fullPage: false,
        timeout: 2000
      });
      
      const base64Frame = screenshot.toString('base64');
      
      // Dynamic quality adjustment based on frame size
      if (base64Frame.length > MAX_FRAME_SIZE) {
        console.warn(`Frame too large (${base64Frame.length} bytes), reducing quality from ${currentQuality} to ${Math.max(30, currentQuality - 10)}`);
        currentQuality = Math.max(30, currentQuality - 10); // Reduce quality but not below 30
        return; // Skip this frame, next one will use lower quality
      }
      
      // If frame is much smaller than target, we can increase quality
      if (base64Frame.length < TARGET_FRAME_SIZE * 0.7 && currentQuality < 85) {
        currentQuality = Math.min(85, currentQuality + 5); // Gradually increase quality
        console.log(`Frame size good (${base64Frame.length} bytes), increasing quality to ${currentQuality}`);
      }
      
      // Only send if WebSocket is still open AND session is still active
      const activeSession = webrtcSessions.get(sessionId);
      if (ws.readyState === ws.OPEN && activeSession && activeSession.isStreaming) {
        ws.send(JSON.stringify({
          type: 'frame',
          frame: base64Frame,
          timestamp: now,
          sessionId: sessionId, // Explicit session ID for verification
          frameId: `${sessionId}-${now}` // Unique frame identifier
        }));
        
        lastFrameTime = now;
        frameSkipped = false;
        consecutiveTimeouts = 0; // Reset on success
        
        // Update session frame count
        const session = webrtcSessions.get(sessionId);
        if (session) {
          session.frameCount = (session.frameCount || 0) + 1;
          session.lastFrame = now;
        }
      }
      
    } catch (error) {
      if (error.name === 'TimeoutError') {
        consecutiveTimeouts++;
        console.warn(`Frame capture timeout for ${sessionId}, continuing...`);
        
        // If too many consecutive timeouts, reduce frame rate
        if (consecutiveTimeouts > MAX_CONSECUTIVE_TIMEOUTS) {
          console.warn(`Too many timeouts, reducing frame rate for ${sessionId}`);
          // Double the interval for this session temporarily
          setTimeout(() => {
            consecutiveTimeouts = Math.max(0, consecutiveTimeouts - 1);
          }, 2000);
        }
        
        // Only send timeout error every 5th timeout to reduce spam
        if (consecutiveTimeouts % 5 === 0 && ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({
            type: 'error',
            error: `Frame capture timeouts (${consecutiveTimeouts})`,
            recoverable: true,
            sessionId: sessionId
          }));
        }
      } else {
        console.error(`Frame capture error for ${sessionId}:`, error.message);
        // Don't send non-recoverable errors immediately to avoid spam
      }
    } finally {
      isCapturing = false;
    }
  }
  
  // Start the streaming interval
  streamInterval = setInterval(captureAndSendFrame, FRAME_INTERVAL);
  
  // Store interval for cleanup
  const session = webrtcSessions.get(sessionId);
  if (session) {
    session.streamInterval = streamInterval;
  }
  
  // Send initial frame immediately (non-blocking)
  setTimeout(captureAndSendFrame, 100);
  
  // Send ready message
  ws.send(JSON.stringify({ 
    type: 'ready', 
    sessionId,
    frameRate: FRAME_RATE,
    message: 'WebSocket streaming active with anti-flicker optimization'
  }));
  
  console.log(`WebSocket streaming started for ${sessionId} at ${FRAME_RATE} FPS`);
}

// Handle remote control with queue management
async function handleRemoteControl(control) {
  if (!browser || !page) return;
  
  return new Promise((resolve, reject) => {
    commandQueue.push(async () => {
      try {
        
        switch (control.type) {
          case 'mouse_move':
            await page.mouse.move(control.x, control.y);
            break;
          case 'mouse_click':
            if (control.x !== undefined && control.y !== undefined) {
              await page.mouse.click(control.x, control.y);
              lastClickTime = Date.now(); // Track click time for debouncing
              console.log(`Mouse clicked at (${control.x}, ${control.y})`);
            }
            break;
          case 'key':
            lastKeyPressTime = Date.now(); // Track typing for debounce
            await page.keyboard.press(control.key);
            break;
          case 'type':
            lastKeyPressTime = Date.now(); // Track typing for debounce
            await page.keyboard.type(control.text);
            break;
        }
        
        resolve();
      } catch (error) {
        console.error('Remote control error:', error);
        reject(error);
      } finally {
        processQueue();
      }
    });
    
    if (commandQueue.length === 1) {
      processQueue();
    }
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing browser...');
  
  // Clean up WebRTC sessions
  webrtcSessions.forEach(session => {
    if (session.streamInterval) {
      clearInterval(session.streamInterval);
    }
    if (session.ws) {
      session.ws.close();
    }
  });
  
  // Close browser
  if (context) { await context.close(); }
  if (browser) { await browser.close(); }
  
  process.exit(0);
});

// Start server
const PORT = process.env.PORT || 3000;
initBrowser()
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`Browser automation server running on port ${PORT}`);
      console.log('WebSocket streaming enabled for WebRTC');
    });
    
    // Handle WebSocket upgrade for streaming
    server.on('upgrade', (request, socket, head) => {
      const pathname = request.url;
      
      if (pathname.startsWith('/stream/websocket/')) {
        wss.handleUpgrade(request, socket, head, (ws) => {
          const sessionId = pathname.split('/').pop();
          handleWebSocketConnection(ws, sessionId);
        });
      } else {
        socket.destroy();
      }
    });
  })
  .catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  }); 