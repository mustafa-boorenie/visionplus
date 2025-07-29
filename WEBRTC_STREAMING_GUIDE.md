# WebRTC Browser Streaming Implementation

## Overview

This implementation provides real-time browser streaming using WebRTC technology with proper session isolation. Each session runs in its own Docker container, ensuring complete isolation between different browser instances.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────┐
│   Frontend  │────▶│  API Server │────▶│ Docker Container │
│   (React)   │     │  (Fastify)  │     │   (Playwright)   │
└─────────────┘     └─────────────┘     └──────────────────┘
       ▲                    │                      │
       │                    │                      │
       └────────────────────┴──────────────────────┘
              WebSocket Connection for Streaming
```

## Key Features

1. **Session Isolation**: Each session gets its own Docker container
2. **WebSocket Streaming**: Real-time browser screenshots at 10 FPS
3. **Remote Control**: Mouse and keyboard control through WebSocket
4. **No Native Dependencies**: Uses browser-native WebRTC APIs
5. **CORS-Safe**: All communication goes through the API proxy [[memory:4393012]]
6. **Command Stability**: Streaming continues during command execution with queue management
7. **Auto-Reconnection**: Frontend automatically reconnects if connection is lost
8. **Error Recovery**: Handles temporary streaming interruptions gracefully

## Components

### 1. Docker Container (`docker/playwright-browser/server.js`)
- Runs a Playwright browser instance
- Provides WebSocket endpoint for streaming
- Handles remote control commands
- Captures screenshots and streams them

### 2. Frontend Component (`apps/frontend/components/WebRTCViewer.tsx`)
- Connects to Docker container via WebSocket
- Renders streamed frames on a canvas
- Handles user input for remote control
- Shows connection status

### 3. API Server Proxy (`src/server/api-v2.ts`)
- Creates and manages Docker sessions
- Proxies WebRTC requests to containers
- Ensures proper session isolation
- Handles health checks

## Usage

### Starting a Session with Streaming

1. **Create a session**:
```javascript
const response = await fetch('http://localhost:3002/api/sessions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'My Session',
    startUrl: 'https://example.com'
  })
});
const session = await response.json();
```

2. **The WebRTCViewer component automatically**:
   - Creates a WebRTC session
   - Connects to the Docker container's WebSocket
   - Starts streaming frames
   - Enables remote control

### Interactive Mode

In the frontend's Interactive Mode:
- Each session automatically shows a live browser view
- Remote control can be toggled on/off
- The stream is isolated to that specific session
- Multiple sessions can run simultaneously

## Session Isolation

Each session is completely isolated:
- Separate Docker container per session
- Unique port allocation
- Independent browser instance
- No shared state between sessions

Example verification:
```javascript
// Session 1 gets port 32768
const session1 = await createSession({ startUrl: 'https://google.com' });

// Session 2 gets port 32769 (different container)
const session2 = await createSession({ startUrl: 'https://github.com' });
```

## WebSocket Protocol

### Client to Server Messages

```javascript
// Start streaming
{ type: 'start_stream' }

// Stop streaming
{ type: 'stop_stream' }

// Remote control
{ 
  type: 'control',
  control: {
    type: 'mouse_click',
    x: 500,
    y: 300
  }
}
```

### Server to Client Messages

```javascript
// Ready signal
{ type: 'ready', sessionId: 'session-123' }

// Frame data
{ 
  type: 'frame',
  frame: 'base64-encoded-jpeg',
  frameNumber: 1,
  timestamp: 1234567890
}

// Error
{ type: 'error', error: 'Error message' }
```

## Testing

Run the test scripts to verify WebRTC streaming:

```bash
# Make sure the API server is running
npm run server:v2:dev

# In another terminal, test streaming stability during commands
node test-streaming-stability.js

# Test basic session isolation
node test-webrtc-streaming.js  # (if needed)
```

## Building the Docker Image

```bash
# Build the Docker image
docker build -t ai-playwright-browser:latest -f docker/playwright-browser/Dockerfile .

# Test the container directly
docker run --rm -it -p 3000:3000 ai-playwright-browser:latest
```

## Performance Considerations

- **Frame Rate**: Set to 10 FPS for balance between smoothness and bandwidth
- **Image Quality**: JPEG at 80% quality for good compression
- **Resolution**: Full browser viewport (typically 1920x1080)
- **Network**: WebSocket provides low-latency streaming

## Troubleshooting

### "Docker session not available"
- Ensure Docker is running
- Check if the image is built: `docker images | grep ai-playwright-browser`
- Verify the API server can access Docker

### No frames received
- Check WebSocket connection in browser DevTools
- Verify the Docker container is running: `docker ps`
- Check container logs: `docker logs <container-id>`

### Remote control not working
- Ensure remote control is enabled in the UI
- Check that the WebSocket is connected
- Verify mouse coordinates are within viewport bounds

### Streaming stops during commands
- This has been fixed with command queue management
- Check browser console for WebSocket errors
- Verify the container health endpoint: `curl http://localhost:<port>/health`

### Connection drops frequently
- Check network stability
- The frontend will automatically attempt to reconnect
- Look for "reconnecting" status in the UI

## Future Enhancements

1. **True WebRTC**: Implement peer-to-peer WebRTC video streaming
2. **Audio Support**: Stream browser audio along with video
3. **Recording**: Save streaming sessions for playback
4. **Quality Settings**: Adjustable frame rate and quality
5. **Multi-user**: Allow multiple viewers per session 