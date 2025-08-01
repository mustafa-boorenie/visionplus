import express from 'express';
import { BrowserAutomation } from '../../src/browser/BrowserAutomation';
import { BrowserAction } from '../../src/types';
let RTCPeerConnection: any, nonstandard: any, sharp: any;
try {
  RTCPeerConnection = require('wrtc').RTCPeerConnection;
  nonstandard = require('wrtc').nonstandard;
} catch (e) {
  console.warn('wrtc not available, WebRTC disabled', e);
}
try {
  sharp = require('sharp');
} catch (e) {
  console.warn('sharp not available, image processing disabled', e);
}

const app = express();
app.use(express.json({ limit: '10mb' }));

let browserAutomation: BrowserAutomation | null = null;

// Keep track of peer connections and intervals per session
const pcs = new Map<string, RTCPeerConnection>();
const intervals = new Map<string, NodeJS.Timeout>();

// Frame management system
interface FrameCapture {
  isCapturing: boolean;
  lastCaptureTime: number;
  consecutiveFailures: number;
  adaptiveTimeout: number;
  frameQueue: number;
}

const frameStates = new Map<string, FrameCapture>();
const MIN_TIMEOUT = 2000; // 2 seconds minimum
const MAX_TIMEOUT = 10000; // 10 seconds maximum
const BASE_TIMEOUT = 3000; // 3 seconds base
const MAX_CONSECUTIVE_FAILURES = 5;
const MAX_FRAME_QUEUE = 2;

// Initialize browser on startup
async function initBrowser() {
  const startUrl = process.env.START_URL || 'about:blank';
  const headless = process.env.HEADLESS === 'true';

  console.log(`Initializing browser with options: { headless: ${headless}, startUrl: '${startUrl}' }`);
  browserAutomation = new BrowserAutomation({ headless, browserType: 'chromium' });
  await browserAutomation.initialize();
  if (startUrl && startUrl !== 'about:blank') {
    await browserAutomation.executeAction({ type: 'navigate', url: startUrl });
  }
  console.log('Browser automation server running on port', PORT);
}

// Adaptive frame capture function
async function captureFrame(sessionId: string, source: any): Promise<boolean> {
  if (!browserAutomation?.currentPage) {
    return false;
  }

  let frameState = frameStates.get(sessionId);
  if (!frameState) {
    frameState = {
      isCapturing: false,
      lastCaptureTime: 0,
      consecutiveFailures: 0,
      adaptiveTimeout: BASE_TIMEOUT,
      frameQueue: 0
    };
    frameStates.set(sessionId, frameState);
  }

  // Skip if already capturing or queue is full
  if (frameState.isCapturing || frameState.frameQueue >= MAX_FRAME_QUEUE) {
    return false;
  }

  frameState.isCapturing = true;
  frameState.frameQueue++;
  
  try {
    const startTime = Date.now();
    
    // Adaptive timeout based on recent failures
    const timeout = Math.min(MAX_TIMEOUT, 
      Math.max(MIN_TIMEOUT, frameState.adaptiveTimeout + (frameState.consecutiveFailures * 1000))
    );
    
    const png = await browserAutomation.currentPage.screenshot({ 
      omitBackground: true,
      timeout: timeout,
      type: 'png',
      quality: 70 // Reduce quality for better performance
    });
    
    const captureTime = Date.now() - startTime;
    
    // Process in next tick to avoid blocking
    setImmediate(async () => {
      try {
        const { data, info } = await sharp(png)
          .resize(1280, 720, { fit: 'contain' }) // Reduce resolution
          .raw()
          .toBuffer({ resolveWithObject: true });
        
        source.onFrame({ width: info.width, height: info.height, data });
        
        // Success - reduce timeout and reset failures
        frameState!.consecutiveFailures = 0;
        frameState!.adaptiveTimeout = Math.max(MIN_TIMEOUT, frameState!.adaptiveTimeout - 200);
        frameState!.lastCaptureTime = Date.now();
        
        if (captureTime > 2000) {
          console.warn(`Slow frame capture for ${sessionId}: ${captureTime}ms`);
        }
      } catch (processError) {
        console.error(`Frame processing error for ${sessionId}:`, processError);
        frameState!.consecutiveFailures++;
      } finally {
        frameState!.isCapturing = false;
        frameState!.frameQueue--;
      }
    });
    
    return true;
  } catch (error) {
    frameState.isCapturing = false;
    frameState.frameQueue--;
    frameState.consecutiveFailures++;
    
    // Increase timeout on failures
    frameState.adaptiveTimeout = Math.min(MAX_TIMEOUT, frameState.adaptiveTimeout + 500);
    
    if (error.name === 'TimeoutError' || (error.message && error.message.includes('Timeout'))) {
      console.warn(`Screenshot timeout for ${sessionId} (${frameState.consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}) - timeout: ${frameState.adaptiveTimeout}ms`);
    } else {
      console.error(`Frame capture error for ${sessionId}:`, error);
    }
    
    // If too many consecutive failures, pause briefly
    if (frameState.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.warn(`Too many failures for ${sessionId}, pausing for 3 seconds`);
      setTimeout(() => {
        if (frameStates.has(sessionId)) {
          frameStates.get(sessionId)!.consecutiveFailures = 0;
        }
      }, 3000);
      return false;
    }
    
    return false;
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', browserActive: browserAutomation !== null });
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

// WebRTC streaming endpoint (offer from client)
app.post('/webrtc', async (req, res) => {
  const { sdp, sessionId } = req.body;
  
  // Check if WebRTC dependencies are available
  if (!RTCPeerConnection || !nonstandard || !sharp) {
    return res.status(501).json({ 
      error: 'WebRTC not available', 
      message: 'WebRTC dependencies not installed in this container',
      dependencies: {
        wrtc: !!RTCPeerConnection,
        sharp: !!sharp
      }
    });
  }
  
  if (!browserAutomation || !browserAutomation.currentPage) {
    return res.status(500).json({ error: 'Browser not initialized' });
  }
  
  // Check if session already has an active WebRTC connection
  if (sessionId && pcs.has(sessionId)) {
    console.log(`Cleaning up existing WebRTC session for ${sessionId}`);
    const existingPc = pcs.get(sessionId);
    const existingInterval = intervals.get(sessionId);
    
    if (existingPc) existingPc.close();
    if (existingInterval) clearInterval(existingInterval);
    
    pcs.delete(sessionId);
    intervals.delete(sessionId);
    frameStates.delete(sessionId); // Clean up frame state
  }
  
  try {
    const pc = new RTCPeerConnection({ iceServers: [] });
    // Create video source track
    const source = new nonstandard.RTCVideoSource();
    const track = source.createTrack();
    pc.addTrack(track);

    // Handle ICE gathering complete
    pc.onicecandidate = ({ candidate }) => {
      if (!candidate) {
        // send answer when done
        res.json({ sdp: pc.localDescription.sdp });
      }
    };

    // Set remote offer
    await pc.setRemoteDescription({ type: 'offer', sdp });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    // Start frame capture after a brief delay to let things settle
    setTimeout(() => {
      // Optimized frame capture loop (15fps for better performance)
      const interval = setInterval(async () => {
        if (!browserAutomation?.currentPage) {
          console.log('Browser page no longer available, stopping frame capture');
          clearInterval(interval);
          frameStates.delete(sessionId);
          return;
        }
        
        // Attempt frame capture with adaptive logic
        await captureFrame(sessionId, source);
      }, 1000 / 24); // 15fps for reduced load and smoother typing
      
      // Store interval for cleanup
      if (sessionId) {
        intervals.set(sessionId, interval);
      }
    }, 500); // 500ms delay before starting capture
    
    // Store connections with proper sessionId
    if (sessionId) {
      pcs.set(sessionId, pc);
      console.log(`WebRTC session established for ${sessionId}`);
    } else {
      console.warn('WebRTC session created without sessionId');
    }
  } catch (err) {
    console.error('WebRTC setup error:', err);
    res.status(500).json({ 
      error: 'Failed to establish WebRTC session', 
      detail: err instanceof Error ? err.message : 'Unknown error',
      sessionId: sessionId || 'unknown'
    });
  }
});

// WebRTC session cleanup endpoint
app.delete('/webrtc/:id', async (req, res) => {
  const sessionId = req.params.id;
  
  try {
    const pc = pcs.get(sessionId);
    const interval = intervals.get(sessionId);
    
    if (pc) {
      pc.close();
      pcs.delete(sessionId);
      console.log(`Closed WebRTC peer connection for session ${sessionId}`);
    }
    
    if (interval) {
      clearInterval(interval);
      intervals.delete(sessionId);
      console.log(`Cleared frame capture interval for session ${sessionId}`);
    }
    
    // Clean up frame state
    frameStates.delete(sessionId);
    
    res.json({ success: true, sessionId });
  } catch (error) {
    console.error('WebRTC cleanup error:', error);
    res.status(500).json({ 
      error: 'Failed to cleanup WebRTC session', 
      detail: error instanceof Error ? error.message : 'Unknown error',
      sessionId 
    });
  }
});

// Remote control via WebRTC data channel
app.post('/webrtc/:id/control', async (req, res) => {
  const sessionId = req.params.id;
  const pc = pcs.get(sessionId);
  if (!pc || !browserAutomation || !browserAutomation.currentPage) {
    return res.status(404).json({ error: 'Session not found or not streaming' });
  }
  const { type, x, y, key } = req.body;
  const page = browserAutomation.currentPage;
  try {
    if (type === 'mouse_move') await page.mouse.move(x, y);
    else if (type === 'mouse_click') await page.mouse.click(x, y);
    else if (type === 'key') await page.keyboard.press(key);
    res.json({ success: true });
  } catch (e) {
    console.error('Remote control error:', e);
    res.status(500).json({ error: 'Control action failed', detail: e.message });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing browser...');
  if (browserAutomation) await browserAutomation.close();
  // clean up WebRTC
  intervals.forEach(i => clearInterval(i));
  pcs.forEach(pc => pc.close());
  frameStates.clear();
  process.exit(0);
});

// Start server
const PORT = process.env.PORT || 3000;
initBrowser()
  .then(() => app.listen(PORT, () => console.log(`Server listening on port ${PORT}`)))
  .catch(err => console.error('Failed to start server:', err)); 