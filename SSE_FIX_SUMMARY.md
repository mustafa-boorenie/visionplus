# SSE Stream 404 Error Fix

## Problem
The frontend was getting 404 errors when trying to connect to SSE (Server-Sent Events) streams:

```
GET http://localhost:3002/api/sessions/cmdnr91c2000zys0vxqh4k6ks/stream 404 (Not Found)
SSE error Event {isTrusted: true, type: 'error', target: EventSource...}
```

This suggests that sessions were not found in the in-memory `sessions` Map when the frontend tried to establish SSE connections.

## Root Causes Identified

### 1. **Race Condition in Session Creation**
- Frontend might try to connect to SSE immediately after getting session ID
- Session might not be fully stored in memory yet
- Database vs memory timing issues

### 2. **Aggressive Session Cleanup** 
- Sessions being cleaned up too quickly (5-minute idle timeout)
- `lastActivity` timestamp might not be properly initialized
- Cleanup running every 5 minutes could catch newly created sessions

### 3. **Missing Activity Updates**
- SSE connections didn't update session activity
- Sessions could be marked as inactive immediately after creation

## Fixes Implemented

### 1. **Enhanced SSE Endpoint Logging**
**File**: `src/server/api-v2.ts`

```typescript
// Added comprehensive logging to SSE stream endpoint
log.info(`[SSE] Stream connection attempt for session: ${sessionId}`);
log.info(`[SSE] Currently active sessions: [${Array.from(this.sessions.keys()).join(', ')}]`);

// Better 404 error responses with debug info
return reply.status(404).send({ 
  error: 'Session not found',
  sessionId,
  availableSessions: Array.from(this.sessions.keys()),
  message: `Session ${sessionId} does not exist in memory. It may have been cleaned up or never created.`
});
```

### 2. **Session Activity Update on SSE Connect**
```typescript
// Update session activity immediately when SSE connects
this.updateSessionActivity(sessionId);
```

### 3. **Fixed Session Creation Timestamps**
```typescript
// Always use current time to prevent immediate cleanup
lastActivity: new Date(), // Instead of dbSession.lastActivity

// Also update database with current timestamp
await this.databaseService.updateSession(dbSession.id, {
  lastActivity: session.lastActivity
});
```

### 4. **Debug Endpoint Added**
**New endpoint**: `GET /api/sessions/:id/debug`

Provides detailed session information:
```json
{
  "sessionId": "abc123",
  "exists": true,
  "totalActiveSessions": 2,
  "activeSessions": ["abc123", "xyz789"],
  "sessionDetails": {
    "status": "idle",
    "createdAt": "2025-01-27T18:32:00.000Z",
    "lastActivity": "2025-01-27T18:32:01.000Z",
    "hasDockerSession": true,
    "connectedSSEClients": 0,
    "historyCount": 0
  }
}
```

## Testing Scripts Created

### 1. **Simple Test**: `test-sse-simple.js`
```bash
chmod +x test-sse-simple.js
node test-sse-simple.js
```
- Quick verification of SSE connection
- Immediate debug info check
- Basic pass/fail result

### 2. **Comprehensive Test**: `test-sse-debug.js`
```bash
chmod +x test-sse-debug.js  
node test-sse-debug.js
```
- Full session lifecycle testing
- Multiple timing scenarios
- Session management validation

## Debugging Steps

### 1. **Check Server Logs**
Look for these log entries:
```
[SSE] Stream connection attempt for session: xyz
[SSE] Currently active sessions: [abc, xyz]
[SSE] Session found: xyz, status: idle, Docker: true
```

### 2. **Use Debug Endpoint**
```bash
curl http://localhost:3002/api/sessions/YOUR_SESSION_ID/debug
```

### 3. **Check Session Creation**
```bash
curl -X POST http://localhost:3002/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"startUrl": "https://google.com"}'
```

### 4. **Verify Session Exists Before SSE**
```bash
curl http://localhost:3002/api/sessions/YOUR_SESSION_ID
```

## Expected Results After Fix

### Before Fix:
```
❌ GET /api/sessions/xyz/stream 404 (Not Found)
❌ SSE connection failed repeatedly
❌ Frontend stuck in reconnection loops
```

### After Fix:
```
✅ SSE connection successful immediately
✅ Sessions persist in memory properly  
✅ Proper activity tracking prevents premature cleanup
✅ Detailed logging for troubleshooting
```

## Monitoring

Watch for these patterns in logs:
- `[SSE] Stream connection attempt` - Normal connection attempts
- `[SSE] Session not found` - Still indicates issues
- `[SSE] Client connected` - Successful connections
- `Cleaning up idle session` - Should only happen after 5+ minutes of inactivity

## Troubleshooting

If SSE errors persist:

1. **Check active sessions**: Use debug endpoint or logs
2. **Verify timing**: Sessions should exist immediately after creation  
3. **Monitor cleanup**: Ensure sessions aren't cleaned up too aggressively
4. **Database sync**: Check if database/memory sync issues exist
5. **Frontend timing**: Verify frontend doesn't connect before session creation completes

The fix addresses the core issue of sessions not being found when SSE connections are attempted, ensuring proper session lifecycle management and better debugging capabilities. 