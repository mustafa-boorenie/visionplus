# WebRTC Failure Handling Improvements

## Problem
The system was experiencing repetitive WebRTC failures with continuous retry attempts, causing:
- Log spam with repeated error messages
- Resource exhaustion from constant retry attempts
- Poor user experience with no backoff strategy
- Timeout errors due to competing screenshot capture mechanisms

## Solution Overview

### 1. Circuit Breaker Pattern (API Server)
**Location**: `src/server/api-v2.ts`

- **Failure Tracking**: Tracks WebRTC failures per session with timestamps
- **Circuit Breaker**: Opens after 5 failures within 60 seconds
- **Automatic Recovery**: Circuit resets after 5 minutes
- **Rate Limiting**: Maximum 10 requests per 30-second window per session

**Key Features**:
```typescript
// Circuit breaker properties
private webrtcFailureCount: Map<string, number> = new Map();
private webrtcFailureTimestamps: Map<string, number[]> = new Map();
private webrtcCircuitBreaker: Map<string, number> = new Map();
private webrtcRateLimiter: Map<string, { count: number; resetTime: number }> = new Map();

// Thresholds
private readonly MAX_WEBRTC_FAILURES = 5;
private readonly FAILURE_WINDOW_MS = 60 * 1000; // 1 minute
private readonly CIRCUIT_BREAKER_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
private readonly RATE_LIMIT_REQUESTS = 10; // Max requests per window
private readonly RATE_LIMIT_WINDOW_MS = 30 * 1000; // 30 seconds
```

### 2. Exponential Backoff (Frontend)
**Location**: `apps/frontend/components/WebRTCViewer.tsx`

- **Adaptive Retry Delays**: Starting at 1 second, doubling up to 30 seconds
- **Circuit Breaker Awareness**: Handles 429 responses with proper wait times
- **Max Retry Attempts**: 10 attempts before giving up
- **User Feedback**: Clear status indicators for different failure states

**Key Features**:
```typescript
const [retryDelay, setRetryDelay] = useState(1000); // Start with 1 second
const [circuitBreakerInfo, setCircuitBreakerInfo] = useState<{retryAfter: number} | null>(null);
const maxReconnectAttempts = 10;
const maxRetryDelay = 30000; // Max 30 seconds

// Exponential backoff logic
setRetryDelay(prev => Math.min(prev * 2, maxRetryDelay));
```

### 3. Adaptive Screenshot Streaming (Docker Container)
**Location**: `docker/playwright-browser/server.ts`

- **Frame State Management**: Tracks capture state per session
- **Adaptive Timeouts**: Adjusts timeout based on failure history (2-10 seconds)
- **Frame Queue Limiting**: Maximum 2 frames in queue to prevent resource exhaustion
- **Performance Optimization**: Reduced resolution (1280x720) and quality (70%)

**Key Features**:
```typescript
interface FrameCapture {
  isCapturing: boolean;
  lastCaptureTime: number;
  consecutiveFailures: number;
  adaptiveTimeout: number;
  frameQueue: number;
}

// Adaptive timeout calculation
const timeout = Math.min(MAX_TIMEOUT, 
  Math.max(MIN_TIMEOUT, frameState.adaptiveTimeout + (frameState.consecutiveFailures * 1000))
);
```

### 4. Stream Coordination (Docker Container)
**Location**: `docker/playwright-browser/server.js`

- **Global Frame Capture State**: Prevents multiple streams from competing
- **Stream Coordination**: WebRTC (20fps) and WebSocket (8.3fps) coordination
- **Failure Tracking**: Adaptive timeouts based on consecutive failures
- **Resource Management**: Proper cleanup when sessions disconnect

**Key Features**:
```javascript
let globalFrameCapture = {
  isCapturing: false,
  lastCaptureTime: 0,
  activeStreams: new Set(),
  captureQueue: []
};

// Coordination logic
if (globalFrameCapture.activeStreams.size > 1 && 
    now - globalFrameCapture.lastCaptureTime < 100) {
  // Another stream recently captured, skip this frame
  return;
}
```

## Response Codes and Error Handling

### API Server Responses
- **429 Rate Limited**: Too many requests, includes `retryAfter` field
- **429 Circuit Breaker**: Too many failures, includes `circuitBreaker: true` flag
- **500 with Failure Count**: Regular failures with current failure count

### Frontend Handling
- **Rate Limit**: Yellow warning with countdown
- **Circuit Breaker**: Yellow warning with reset time
- **Reconnecting**: Blue status with attempt counter
- **Failed**: Red error after max attempts

## Performance Improvements

### Before
- 30fps WebRTC + 10fps WebSocket = Resource conflicts
- Fixed 5-second timeouts causing frequent failures
- No coordination between streaming mechanisms
- Immediate retries causing log spam

### After
- 20fps WebRTC + 8.3fps WebSocket = Better coordination
- Adaptive timeouts (2-10 seconds) based on performance
- Global frame capture coordination
- Circuit breaker prevents retry storms

## Monitoring and Debugging

### Log Messages
```
WebRTC circuit breaker opened for session {sessionId} after {count} failures in 60s
Screenshot timeout for {sessionId} ({failures}/{maxFailures}) - timeout: {timeout}ms
Too many failures for {sessionId}, pausing for 3 seconds
```

### Failure Information
Each WebRTC response includes failure tracking:
```json
{
  "error": "Failed to create WebRTC session",
  "failureCount": 3,
  "circuitBreaker": false
}
```

## Configuration

### Tunable Parameters
```typescript
// Circuit Breaker
MAX_WEBRTC_FAILURES = 5        // Failures before circuit opens
FAILURE_WINDOW_MS = 60000      // Time window for failure counting
CIRCUIT_BREAKER_TIMEOUT_MS = 300000  // Circuit reset time

// Rate Limiting  
RATE_LIMIT_REQUESTS = 10       // Max requests per window
RATE_LIMIT_WINDOW_MS = 30000   // Rate limit window

// Streaming
MIN_TIMEOUT = 2000             // Minimum screenshot timeout
MAX_TIMEOUT = 10000            // Maximum screenshot timeout
MAX_FRAME_QUEUE = 2            // Maximum queued frames
```

## Benefits

1. **Reduced Log Spam**: Circuit breaker prevents continuous error logging
2. **Better Resource Management**: Frame coordination prevents conflicts
3. **Improved User Experience**: Clear feedback and reasonable retry delays
4. **Adaptive Performance**: Timeouts adjust based on actual performance
5. **Graceful Degradation**: System remains responsive under failure conditions

## Testing

The improvements can be tested by:
1. Creating a WebRTC session and observing the circuit breaker after 5 failures
2. Checking rate limiting with rapid requests
3. Monitoring adaptive timeout adjustments in logs
4. Verifying proper cleanup when sessions disconnect

This implementation provides a robust foundation for handling WebRTC streaming failures while maintaining good performance and user experience. 