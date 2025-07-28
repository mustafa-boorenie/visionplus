# Streamable VM Setup for AI Playwright Agent

## Overview

To see the browser automation happening in real-time, you can set up a streamable VM that shows the browser interface while the agent performs actions.

## Option 1: Local VNC Server (Recommended for Development)

### Using Docker with VNC

1. **Create a Docker Compose file** (`docker-compose.vnc.yml`):

```yaml
version: '3.8'

services:
  playwright-vnc:
    image: browserless/chrome:latest
    ports:
      - "3010:3000"  # Browserless API
      - "5900:5900"  # VNC port
    environment:
      - CONNECTION_TIMEOUT=60000
      - MAX_CONCURRENT_SESSIONS=10
      - ENABLE_DEBUGGER=true
      - VNC_ENABLED=true
      - VNC_PASSWORD=secret
      - DISPLAY=:99
```

2. **Run the container**:
```bash
docker-compose -f docker-compose.vnc.yml up
```

3. **Connect via VNC viewer**:
   - Use any VNC client (RealVNC, TightVNC, etc.)
   - Connect to `localhost:5900`
   - Password: `secret`

4. **Update the browser connection** in your code to use browserless:
```typescript
// In BrowserManager.ts
const browser = await chromium.connect({
  wsEndpoint: 'ws://localhost:3010'
});
```

## Option 2: Remote Desktop with Cloud VM

### Using AWS EC2 with NICE DCV

1. **Launch EC2 instance**:
   - Use Ubuntu 22.04 AMI
   - Instance type: t3.medium or larger
   - Security group: Allow ports 8443 (DCV), 3002 (API)

2. **Install NICE DCV Server**:
```bash
# Install NICE DCV
wget https://d1uj6qtbmh3dt5.cloudfront.net/nice-dcv-ubuntu2204-x86_64.tgz
tar -xvzf nice-dcv-ubuntu*.tgz
cd nice-dcv-*
sudo apt install ./nice-dcv-server_*.deb
sudo apt install ./nice-xdcv_*.deb

# Start DCV server
sudo systemctl enable dcvserver
sudo systemctl start dcvserver

# Create session
sudo dcv create-session --type=console --owner ubuntu my-session
```

3. **Install the AI Playwright Agent**:
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and setup the project
git clone https://github.com/your-repo/ai-playwright-scripter.git
cd ai-playwright-scripter
npm install

# Install browser dependencies
npx playwright install-deps chromium
```

4. **Connect via NICE DCV Client**:
   - Download NICE DCV client from AWS
   - Connect to `your-ec2-ip:8443`
   - Login with EC2 credentials

## Option 3: Browser Streaming via WebRTC

### Using Playwright with WebRTC streaming

1. **Add WebRTC streaming to the backend**:

```typescript
// src/browser/StreamableBrowser.ts
import { Page } from 'playwright';
import * as mediasoup from 'mediasoup';

export class StreamableBrowser {
  private worker: mediasoup.types.Worker;
  private router: mediasoup.types.Router;
  
  async streamPage(page: Page) {
    // Create WebRTC transport
    const transport = await this.router.createWebRtcTransport({
      listenIps: [{ ip: '0.0.0.0', announcedIp: 'YOUR_PUBLIC_IP' }],
      enableUdp: true,
      enableTcp: true,
    });
    
    // Capture page video
    const stream = await page.video().stream();
    
    // Create producer
    const producer = await transport.produce({
      kind: 'video',
      rtpParameters: {
        // Configure RTP parameters
      },
    });
    
    return { transportId: transport.id, producerId: producer.id };
  }
}
```

2. **Add frontend viewer**:

```tsx
// apps/frontend/components/BrowserStream.tsx
import { useEffect, useRef } from 'react';

export function BrowserStream({ sessionId }: { sessionId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    
    // Setup WebRTC connection
    // ...
    
    pc.ontrack = (event) => {
      if (videoRef.current) {
        videoRef.current.srcObject = event.streams[0];
      }
    };
  }, [sessionId]);
  
  return (
    <video 
      ref={videoRef} 
      autoPlay 
      className="w-full h-full rounded border border-gray-700"
    />
  );
}
```

## Option 4: Simple Screenshot Streaming

For a simpler solution that's already partially implemented:

1. **Enhance the screenshot capture** to take screenshots more frequently:

```typescript
// In IntelligentAutomation.ts
private async captureScreenshotStream(page: Page, sessionId: string) {
  const interval = setInterval(async () => {
    try {
      const screenshot = await page.screenshot({ type: 'jpeg', quality: 70 });
      
      // Broadcast via SSE
      this.broadcastToSession(sessionId, {
        type: 'live-screenshot',
        data: screenshot.toString('base64')
      });
    } catch (error) {
      // Page might be navigating
    }
  }, 500); // Every 500ms
  
  return () => clearInterval(interval);
}
```

2. **Display in frontend**:

```tsx
// In InteractiveMode.tsx
case 'live-screenshot':
  setLiveScreenshot(`data:image/jpeg;base64,${data.data}`);
  break;
```

## Recommended Approach

For development and testing, **Option 1 (Docker with VNC)** is the easiest to set up and provides full visibility into the browser.

For production or client demos, **Option 3 (WebRTC streaming)** provides the best user experience with low latency.

## Security Considerations

1. **VNC Access**: Always use strong passwords and consider SSH tunneling
2. **WebRTC**: Implement proper authentication before allowing stream access
3. **Cloud VMs**: Use security groups to restrict access to necessary ports only
4. **Screenshots**: Be careful not to expose sensitive information in screenshots 