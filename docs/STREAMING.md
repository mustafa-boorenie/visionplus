# Real-time Streaming Documentation

This document describes the real-time streaming capabilities added to the AI Playwright Scripter, enabling live progress updates and monitoring of automation tasks.

## Overview

The streaming functionality provides two protocols for real-time communication:
- **Server-Sent Events (SSE)** - Unidirectional streaming from server to clients
- **WebSocket** - Bidirectional communication between server and clients

Both protocols support:
- Real-time progress tracking
- Automatic reconnection
- Event buffering for reliability
- Health monitoring
- Metrics collection

## Architecture

### Components

1. **StreamingServer** (`src/streaming/StreamingServer.ts`)
   - HTTP-based SSE server
   - Supports multiple concurrent clients
   - Automatic heartbeat to keep connections alive
   - Event buffering for reconnection support

2. **WebSocketStreamingServer** (`src/streaming/WebSocketServer.ts`)
   - WebSocket-based server
   - Bidirectional communication
   - Client-to-server messaging support
   - Built-in compression support

3. **Enhanced ProgressTracker** (`src/utils/ProgressTracker.ts`)
   - Integrated streaming support
   - Broadcasts progress events automatically
   - Maintains console output alongside streaming

## Usage

### Starting the Servers

```typescript
import { StreamingServer } from './src/streaming/StreamingServer';
import { WebSocketStreamingServer } from './src/streaming/WebSocketServer';

// Create servers
const sseServer = new StreamingServer({ 
  port: 3001,
  heartbeatInterval: 30000,
  cors: true 
});

const wsServer = new WebSocketStreamingServer({ 
  port: 3002,
  heartbeatInterval: 30000 
});

// Start servers
await sseServer.start();
await wsServer.start();
```

### Enabling Streaming in ProgressTracker

```typescript
const tracker = new ProgressTracker(true);
tracker.enableSSEStreaming(sseServer);
tracker.enableWebSocketStreaming(wsServer);

// All progress events will now be streamed automatically
tracker.track({
  type: 'step_complete',
  stepIndex: 1,
  totalSteps: 5,
  description: 'Navigation complete'
});
```

### Client Connection Examples

#### JavaScript (SSE)
```javascript
const eventSource = new EventSource('http://localhost:3001/stream');

eventSource.addEventListener('progress', (event) => {
  const data = JSON.parse(event.data);
  console.log('Progress:', data);
});

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event:', data);
};
```

#### JavaScript (WebSocket)
```javascript
const ws = new WebSocket('ws://localhost:3002');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Message:', data);
};

// Send messages to server
ws.send(JSON.stringify({ 
  type: 'subscribe', 
  data: { topics: ['progress'] } 
}));
```

#### Command Line (SSE)
```bash
# Stream events via curl
curl -N http://localhost:3001/stream

# Monitor health
curl http://localhost:3001/health

# View metrics
curl http://localhost:3001/metrics
```

## Event Types

### Progress Events
- `step_start` - Step execution begins
- `step_complete` - Step successfully completed
- `step_failed` - Step execution failed
- `retry` - Retrying a failed step
- `analysis` - AI vision analysis in progress
- `cache_hit` - Using cached automation

### System Events
- `connection` - Client connected (includes clientId)
- `heartbeat` - Keep-alive signal
- `error` - Error occurred

## Features

### Automatic Reconnection
Both SSE and WebSocket clients support automatic reconnection with event buffering:

```javascript
// SSE with Last-Event-ID
const eventSource = new EventSource('http://localhost:3001/stream');
// Automatically sends Last-Event-ID header on reconnection

// WebSocket with sync message
ws.send(JSON.stringify({ 
  type: 'sync', 
  data: { lastMessageId: 'last-received-id' } 
}));
```

### Connection Monitoring
```bash
# Health check
curl http://localhost:3001/health
# Returns: {"status":"healthy","uptime":123.45,"activeConnections":5}

# Detailed metrics
curl http://localhost:3001/metrics
# Returns comprehensive metrics including:
# - totalConnections
# - activeConnections  
# - totalEvents
# - reconnections
# - errors
# - memoryUsage
```

### Stress Testing
The implementation includes comprehensive stress tests to ensure stability:
- Rapid connection/disconnection cycles
- High volume concurrent clients (100+)
- Sustained high-frequency broadcasts (1000+ msg/s)
- Memory efficiency under load
- Network interruption recovery

## Running Examples

### Basic Streaming Example
```bash
tsx examples/streaming-example.ts
```

### Interactive Demo
```bash
tsx examples/streaming-demo.ts
```

### HTML Client
Open `examples/streaming-client.html` in a browser to see a full-featured web client.

## Configuration Options

### StreamingServer Options
- `port` - Server port (default: 3001)
- `heartbeatInterval` - Heartbeat interval in ms (default: 30000)
- `reconnectTimeout` - Client reconnect timeout (default: 5000)
- `maxClients` - Maximum concurrent clients (default: 100)
- `cors` - Enable CORS headers (default: true)
- `bufferSize` - Event buffer size (default: 1000)
- `compressionEnabled` - Enable compression (default: true)

### WebSocketServer Options
Same as StreamingServer, with WebSocket-specific defaults.

## Best Practices

1. **Use appropriate protocol**
   - SSE for server-to-client updates only
   - WebSocket for bidirectional communication

2. **Handle connection failures**
   - Implement reconnection logic
   - Buffer important events
   - Use heartbeats to detect stale connections

3. **Monitor performance**
   - Check `/metrics` endpoint regularly
   - Set appropriate buffer sizes
   - Limit concurrent connections based on load

4. **Security considerations**
   - Use HTTPS/WSS in production
   - Implement authentication if needed
   - Validate all client messages

## Testing

Run the comprehensive test suite:
```bash
# All streaming tests
npm test tests/streaming/streaming.test.ts

# Stress tests
npm test tests/streaming/stress.test.ts
```

## Troubleshooting

### Connection Issues
- Check firewall/proxy settings
- Verify CORS configuration
- Ensure ports are not in use

### Performance Issues
- Reduce heartbeat frequency
- Limit event buffer size
- Use compression for large payloads

### Client Disconnections
- Check for network timeouts
- Verify heartbeat is working
- Monitor server metrics for errors