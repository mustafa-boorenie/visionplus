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
  const { sdp } = req.body;
  if (!browserAutomation || !browserAutomation.currentPage) {
    return res.status(500).json({ error: 'Browser not initialized' });
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

    // Frame capture loop (30fps)
    const interval = setInterval(async () => {
      try {
        const png = await browserAutomation!.currentPage!.screenshot({ omitBackground: true });
        const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
        source.onFrame({ width: info.width, height: info.height, data });
      } catch (e) {
        console.error('Frame capture error:', e);
      }
    }, 1000 / 30);
    pcs.set(req.body.sessionId, pc);
    intervals.set(req.body.sessionId, interval);
  } catch (err) {
    console.error('WebRTC setup error:', err);
    res.status(500).json({ error: 'Failed to establish WebRTC session', detail: err.message });
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
  process.exit(0);
});

// Start server
const PORT = process.env.PORT || 3000;
initBrowser()
  .then(() => app.listen(PORT, () => console.log(`Server listening on port ${PORT}`)))
  .catch(err => console.error('Failed to start server:', err)); 