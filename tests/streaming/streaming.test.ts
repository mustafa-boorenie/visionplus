import { test, expect } from '@playwright/test';
import { StreamingServer } from '../../src/streaming/StreamingServer';
import { WebSocketStreamingServer } from '../../src/streaming/WebSocketServer';
import { ProgressTracker } from '../../src/utils/ProgressTracker';
import * as http from 'http';
import WebSocket from 'ws';

// Helper to wait for events
const waitForEvent = <T>(emitter: any, event: string, timeout = 5000): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${event}`));
    }, timeout);

    emitter.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
};

// Helper to collect SSE events
const collectSSEEvents = async (url: string, count: number, timeout = 10000): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const events: any[] = [];
    const timer = setTimeout(() => {
      reject(new Error(`Timeout collecting SSE events`));
    }, timeout);

    const req = http.get(url, (res) => {
      let buffer = '';

      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            const eventMatch = line.match(/event: (\w+)/);
            const dataMatch = line.match(/data: (.+)/);
            
            if (eventMatch && dataMatch) {
              try {
                const event = {
                  type: eventMatch[1],
                  data: JSON.parse(dataMatch[1])
                };
                events.push(event);
                
                if (events.length >= count) {
                  clearTimeout(timer);
                  req.destroy();
                  resolve(events);
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
      });

      res.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });

    req.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
};

test.describe('SSE Streaming Server', () => {
  let server: StreamingServer;
  const testPort = 3801;

  test.beforeEach(async () => {
    server = new StreamingServer({ port: testPort, heartbeatInterval: 1000 });
    await server.start();
  });

  test.afterEach(async () => {
    await server.stop();
  });

  test('should start server and accept connections', async () => {
    const response = await fetch(`http://localhost:${testPort}/health`);
    const health = await response.json();
    
    expect(health.status).toBe('healthy');
    expect(health.activeConnections).toBe(0);
  });

  test('should handle SSE connections', async () => {
    const events = await collectSSEEvents(`http://localhost:${testPort}/stream`, 1);
    
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('connection');
    expect(events[0].data.clientId).toBeTruthy();
  });

  test('should broadcast events to all clients', async ({ page }) => {
    // Connect multiple clients
    const client1Promise = collectSSEEvents(`http://localhost:${testPort}/stream`, 2);
    const client2Promise = collectSSEEvents(`http://localhost:${testPort}/stream`, 2);
    
    // Wait for connections
    await page.waitForTimeout(100);
    
    // Broadcast event
    server.broadcast('test', { message: 'Hello clients!' });
    
    const [events1, events2] = await Promise.all([client1Promise, client2Promise]);
    
    // Both clients should receive connection + broadcast event
    expect(events1[1].type).toBe('test');
    expect(events1[1].data.message).toBe('Hello clients!');
    expect(events2[1].type).toBe('test');
    expect(events2[1].data.message).toBe('Hello clients!');
  });

  test('should handle client disconnection gracefully', async () => {
    const req = http.get(`http://localhost:${testPort}/stream`, (res) => {
      res.on('data', () => {
        // Disconnect after receiving data
        req.destroy();
      });
    });

    await new Promise(resolve => setTimeout(resolve, 100));
    
    const metrics = server.getMetrics();
    expect(metrics.activeConnections).toBe(0);
  });

  test('should send heartbeat events', async () => {
    const events = await collectSSEEvents(`http://localhost:${testPort}/stream`, 2, 2000);
    
    const heartbeat = events.find(e => e.type === 'heartbeat');
    expect(heartbeat).toBeTruthy();
    expect(heartbeat.data.timestamp).toBeTruthy();
  });

  test('should respect max client limit', async () => {
    const limitedServer = new StreamingServer({ port: 3802, maxClients: 2 });
    await limitedServer.start();

    try {
      // Connect max clients
      const client1 = http.get(`http://localhost:3802/stream`);
      const client2 = http.get(`http://localhost:3802/stream`);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Try to connect one more
      const response = await new Promise<http.IncomingMessage>((resolve) => {
        http.get(`http://localhost:3802/stream`, resolve);
      });
      
      expect(response.statusCode).toBe(503);
    } finally {
      await limitedServer.stop();
    }
  });

  test('should buffer events for reconnecting clients', async () => {
    // Send some events
    server.broadcast('event1', { data: 'first' });
    server.broadcast('event2', { data: 'second' });
    
    // Connect with last-event-id
    const events = await new Promise<any[]>((resolve, reject) => {
      const collectedEvents: any[] = [];
      
      const req = http.get({
        hostname: 'localhost',
        port: testPort,
        path: '/stream',
        headers: {
          'Last-Event-ID': 'fake-id' // This will cause all buffered events to be sent
        }
      }, (res) => {
        let buffer = '';
        
        res.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.includes('event:') && line.includes('data:')) {
              const eventMatch = line.match(/event: (\w+)/);
              const dataMatch = line.match(/data: (.+)/);
              
              if (eventMatch && dataMatch) {
                collectedEvents.push({
                  type: eventMatch[1],
                  data: JSON.parse(dataMatch[1])
                });
              }
            }
          }
          
          if (collectedEvents.length >= 3) { // connection + 2 buffered
            req.destroy();
            resolve(collectedEvents);
          }
        });
      });
      
      req.on('error', reject);
    });
    
    const bufferedEvents = events.filter(e => e.type === 'event1' || e.type === 'event2');
    expect(bufferedEvents).toHaveLength(2);
    expect(bufferedEvents[0].data.data).toBe('first');
    expect(bufferedEvents[1].data.data).toBe('second');
  });

  test('should provide metrics endpoint', async () => {
    // Connect a client
    http.get(`http://localhost:${testPort}/stream`);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Send some events
    server.broadcast('test1', {});
    server.broadcast('test2', {});
    
    const response = await fetch(`http://localhost:${testPort}/metrics`);
    const metrics = await response.json();
    
    expect(metrics.totalConnections).toBeGreaterThanOrEqual(1);
    expect(metrics.activeConnections).toBe(1);
    expect(metrics.totalEvents).toBe(2);
    expect(metrics.eventBufferSize).toBeGreaterThanOrEqual(2);
  });
});

test.describe('WebSocket Streaming Server', () => {
  let server: WebSocketStreamingServer;
  const testPort = 3803;

  test.beforeEach(async () => {
    server = new WebSocketStreamingServer({ port: testPort, heartbeatInterval: 1000 });
    await server.start();
  });

  test.afterEach(async () => {
    await server.stop();
  });

  test('should accept WebSocket connections', async () => {
    const ws = new WebSocket(`ws://localhost:${testPort}`);
    
    const message = await new Promise((resolve) => {
      ws.on('message', (data) => {
        resolve(JSON.parse(data.toString()));
        ws.close();
      });
    });
    
    expect(message.type).toBe('connection');
    expect(message.data.clientId).toBeTruthy();
    expect(message.data.protocol).toBe('websocket');
  });

  test('should handle bi-directional communication', async () => {
    const ws = new WebSocket(`ws://localhost:${testPort}`);
    
    await new Promise((resolve) => {
      ws.on('open', resolve);
    });
    
    // Send ping
    ws.send(JSON.stringify({ type: 'ping' }));
    
    const response = await new Promise((resolve) => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'pong') {
          resolve(msg);
        }
      });
    });
    
    expect(response.type).toBe('pong');
    expect(response.data.timestamp).toBeTruthy();
    
    ws.close();
  });

  test('should broadcast to all connected clients', async () => {
    const ws1 = new WebSocket(`ws://localhost:${testPort}`);
    const ws2 = new WebSocket(`ws://localhost:${testPort}`);
    
    const messages1: any[] = [];
    const messages2: any[] = [];
    
    ws1.on('message', (data) => {
      messages1.push(JSON.parse(data.toString()));
    });
    
    ws2.on('message', (data) => {
      messages2.push(JSON.parse(data.toString()));
    });
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    server.broadcast('announcement', { text: 'Hello everyone!' });
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const announcement1 = messages1.find(m => m.type === 'announcement');
    const announcement2 = messages2.find(m => m.type === 'announcement');
    
    expect(announcement1).toBeTruthy();
    expect(announcement1.data.text).toBe('Hello everyone!');
    expect(announcement2).toBeTruthy();
    expect(announcement2.data.text).toBe('Hello everyone!');
    
    ws1.close();
    ws2.close();
  });

  test('should handle message buffering for reconnection', async () => {
    // Send some messages
    server.broadcast('msg1', { content: 'First message' });
    server.broadcast('msg2', { content: 'Second message' });
    
    const ws = new WebSocket(`ws://localhost:${testPort}`);
    
    await new Promise((resolve) => {
      ws.on('open', () => {
        // Request sync
        ws.send(JSON.stringify({ 
          type: 'sync', 
          data: { lastMessageId: 'fake-id' } 
        }));
        resolve(undefined);
      });
    });
    
    const messages: any[] = [];
    
    await new Promise((resolve) => {
      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
        if (messages.length >= 3) { // connection + 2 buffered
          resolve(undefined);
        }
      });
    });
    
    const buffered = messages.filter(m => m.type === 'msg1' || m.type === 'msg2');
    expect(buffered).toHaveLength(2);
    expect(buffered[0].data.content).toBe('First message');
    expect(buffered[1].data.content).toBe('Second message');
    
    ws.close();
  });

  test('should handle errors gracefully', async () => {
    const ws = new WebSocket(`ws://localhost:${testPort}`);
    
    await new Promise((resolve) => {
      ws.on('open', resolve);
    });
    
    // Send invalid JSON
    ws.send('invalid json');
    
    const errorMessage = await new Promise((resolve) => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'error') {
          resolve(msg);
        }
      });
    });
    
    expect(errorMessage.type).toBe('error');
    expect(errorMessage.data.message).toBe('Invalid message format');
    
    ws.close();
  });

  test('should track metrics', async () => {
    const ws = new WebSocket(`ws://localhost:${testPort}`);
    
    await new Promise((resolve) => {
      ws.on('open', resolve);
    });
    
    // Send some messages
    ws.send(JSON.stringify({ type: 'ping' }));
    ws.send(JSON.stringify({ type: 'ping' }));
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const metrics = server.getMetrics();
    
    expect(metrics.totalConnections).toBeGreaterThanOrEqual(1);
    expect(metrics.activeConnections).toBe(1);
    expect(metrics.messagesReceived).toBeGreaterThanOrEqual(2);
    
    ws.close();
  });
});

test.describe('Progress Tracker with Streaming', () => {
  let sseServer: StreamingServer;
  let wsServer: WebSocketStreamingServer;
  let tracker: ProgressTracker;

  test.beforeEach(async () => {
    sseServer = new StreamingServer({ port: 3804 });
    wsServer = new WebSocketStreamingServer({ port: 3805 });
    
    await sseServer.start();
    await wsServer.start();
    
    tracker = new ProgressTracker();
    tracker.enableSSEStreaming(sseServer);
    tracker.enableWebSocketStreaming(wsServer);
    tracker.initialize(5);
  });

  test.afterEach(async () => {
    await sseServer.stop();
    await wsServer.stop();
  });

  test('should stream progress events via SSE', async () => {
    const eventsPromise = collectSSEEvents('http://localhost:3804/stream', 2);
    
    tracker.track({
      type: 'step_start',
      stepIndex: 1,
      totalSteps: 5,
      description: 'Test step'
    });
    
    const events = await eventsPromise;
    const progressEvent = events.find(e => e.type === 'progress');
    
    expect(progressEvent).toBeTruthy();
    expect(progressEvent.data.type).toBe('step_start');
    expect(progressEvent.data.description).toBe('Test step');
  });

  test('should stream progress events via WebSocket', async () => {
    const ws = new WebSocket('ws://localhost:3805');
    const messages: any[] = [];
    
    ws.on('message', (data) => {
      messages.push(JSON.parse(data.toString()));
    });
    
    await new Promise((resolve) => {
      ws.on('open', resolve);
    });
    
    tracker.track({
      type: 'step_complete',
      stepIndex: 1,
      totalSteps: 5,
      description: 'Completed step'
    });
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const progressMessage = messages.find(m => m.type === 'progress');
    
    expect(progressMessage).toBeTruthy();
    expect(progressMessage.data.type).toBe('step_complete');
    expect(progressMessage.data.description).toBe('Completed step');
    
    ws.close();
  });
});