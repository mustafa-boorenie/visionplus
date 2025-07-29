const express = require('express');
const { chromium } = require('playwright');
const WebSocket = require('ws');

const app = express();

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
let page = null;

// WebRTC sessions - each session gets its own WebSocket and streaming
const webrtcSessions = new Map();
// Track if browser is currently executing a command
let commandInProgress = false;
// Queue for commands to prevent conflicts with streaming
const commandQueue = [];

// Initialize browser on startup
async function initBrowser() {
  const startUrl = process.env.START_URL || 'about:blank';
  const headless = process.env.HEADLESS === 'true';

  console.log(`Initializing browser with options: { headless: ${headless}, startUrl: '${startUrl}' }`);
  
  try {
    browser = await chromium.launch({ 
      headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();
    
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
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      page = await browser.newPage();
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
    webrtcSessions: webrtcSessions.size,
    commandInProgress
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
          commandInProgress = true;
          const action = req.body;
          let result;
          
          switch (action.type) {
            case 'navigate':
              await page.goto(action.url);
              result = { url: page.url() };
              break;
            case 'click':
              const clickSelector = await findWorkingSelector(page, action.selector);
              await page.click(clickSelector);
              result = { clicked: true };
              break;
            case 'type':
              const typeSelector = await findWorkingSelector(page, action.selector);
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
              const screenshot = await page.screenshot();
              result = { screenshot: screenshot.toString('base64') };
              break;
            default:
              throw new Error(`Unknown action type: ${action.type}`);
          }

          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          commandInProgress = false;
          processNextCommand();
        }
      });
      
      if (commandQueue.length === 1) {
        processNextCommand();
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

// Process command queue
function processNextCommand() {
  if (commandQueue.length > 0 && !commandInProgress) {
    const nextCommand = commandQueue.shift();
    nextCommand();
  }
}

// Screenshot endpoint (non-interfering with streaming)
app.post('/screenshot', async (req, res) => {
  try {
    if (!browser || !page) {
      return res.status(500).json({ error: 'Browser not initialized' });
    }

    // Wait for any command to finish
    while (commandInProgress) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    const screenshot = await page.screenshot();
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
          commandInProgress = true;
          
          switch (type) {
            case 'mouse_move':
              await page.mouse.move(x, y);
              break;
            case 'mouse_click':
              await page.mouse.click(x, y);
              break;
            case 'key':
              await page.keyboard.press(key);
              break;
            default:
              throw new Error(`Unknown control type: ${type}`);
          }
          
          resolve({ success: true });
        } catch (error) {
          reject(error);
        } finally {
          commandInProgress = false;
          processNextCommand();
        }
      });
      
      if (commandQueue.length === 1) {
        processNextCommand();
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

// Simple screenshot streaming endpoint for fallback
app.get('/stream/screenshot/:sessionId', async (req, res) => {
  try {
    if (!browser || !page) {
      return res.status(500).json({ error: 'Browser not initialized' });
    }

    // Set headers for SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    // Send screenshots at regular intervals
    const interval = setInterval(async () => {
      try {
        // Skip if command in progress
        if (commandInProgress) {
          return;
        }
        
        const screenshot = await page.screenshot({ 
          type: 'png',
          fullPage: false 
        });
        const base64 = screenshot.toString('base64');
        res.write(`data: ${JSON.stringify({ screenshot: base64 })}\n\n`);
      } catch (error) {
        console.error('Screenshot error:', error);
      }
    }, 200); // 5 FPS for SSE fallback

    // Cleanup on client disconnect
    req.on('close', () => {
      clearInterval(interval);
      res.end();
    });

  } catch (error) {
    console.error('Stream error:', error);
    res.status(500).json({ error: error.message });
  }
});

// WebSocket server for real-time streaming
const wss = new WebSocket.Server({ noServer: true });

// Handle WebSocket connection for streaming
function handleWebSocketConnection(ws, sessionId) {
  console.log(`WebSocket connected for session: ${sessionId}`);
  
  let streamInterval = null;
  let isStreaming = false;
  
  // Store session
  webrtcSessions.set(sessionId, { 
    ws, 
    isStreaming: false,
    lastFrame: null,
    frameCount: 0
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
            webrtcSessions.get(sessionId).isStreaming = false;
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
    console.log(`WebSocket disconnected for session: ${sessionId}`);
    if (streamInterval) {
      clearInterval(streamInterval);
    }
    webrtcSessions.delete(sessionId);
  });
  
  // Send initial ready message
  ws.send(JSON.stringify({ type: 'ready', sessionId }));
}

// Start screenshot streaming with stability improvements
function startScreenshotStream(ws, sessionId) {
  let frameNumber = 0;
  const session = webrtcSessions.get(sessionId);
  
  const streamInterval = setInterval(async () => {
    if (!browser || !page || ws.readyState !== WebSocket.OPEN) {
      clearInterval(streamInterval);
      return;
    }
    
    // Skip frame if command is in progress to avoid conflicts
    if (commandInProgress) {
      return;
    }
    
    try {
      const screenshot = await page.screenshot({ 
        type: 'jpeg',
        quality: 80,
        fullPage: false 
      });
      
      const frameData = {
        type: 'frame',
        frame: screenshot.toString('base64'),
        frameNumber: frameNumber++,
        timestamp: Date.now(),
        sessionId
      };
      
      // Send frame
      ws.send(JSON.stringify(frameData));
      
      // Update session info
      if (session) {
        session.frameCount++;
        session.lastFrame = Date.now();
      }
    } catch (error) {
      console.error('Screenshot streaming error:', error);
      // Try to reconnect on error
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Streaming temporarily interrupted',
          recoverable: true
        }));
      }
    }
  }, 100); // 10 FPS
  
  // Store interval for cleanup
  if (session) {
    session.streamInterval = streamInterval;
  }
}

// Handle remote control with queue management
async function handleRemoteControl(control) {
  if (!browser || !page) return;
  
  return new Promise((resolve, reject) => {
    commandQueue.push(async () => {
      try {
        commandInProgress = true;
        
        switch (control.type) {
          case 'mouse_move':
            await page.mouse.move(control.x, control.y);
            break;
          case 'mouse_click':
            await page.mouse.click(control.x, control.y);
            break;
          case 'key':
            await page.keyboard.press(control.key);
            break;
          case 'type':
            await page.keyboard.type(control.text);
            break;
        }
        
        resolve();
      } catch (error) {
        console.error('Remote control error:', error);
        reject(error);
      } finally {
        commandInProgress = false;
        processNextCommand();
      }
    });
    
    if (commandQueue.length === 1) {
      processNextCommand();
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
  if (browser) {
    await browser.close();
  }
  
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