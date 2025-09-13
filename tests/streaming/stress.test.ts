import { test, expect } from '@playwright/test';
import { StreamingServer } from '../../src/streaming/StreamingServer';
import { WebSocketStreamingServer } from '../../src/streaming/WebSocketServer';
import * as http from 'http';
import WebSocket from 'ws';

// Increase test timeout for stress tests
test.use({ timeout: 60000 });

test.describe('Streaming Stress Tests', () => {
  test('SSE: should handle rapid connection/disconnection cycles', async () => {
    const server = new StreamingServer({ port: 3810 });
    await server.start();

    try {
      const cycles = 50;
      const connections: http.ClientRequest[] = [];

      for (let i = 0; i < cycles; i++) {
        const req = http.get(`http://localhost:3810/stream`, (res) => {
          res.on('data', () => {
            // Immediately close on first data
            req.destroy();
          });
        });
        connections.push(req);
        
        // Small delay between connections
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      // Wait for all to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      const metrics = server.getMetrics();
      expect(metrics.totalConnections).toBe(cycles);
      expect(metrics.activeConnections).toBe(0);
      expect(metrics.errors).toBe(0);
    } finally {
      await server.stop();
    }
  });

  test('SSE: should handle high volume of concurrent clients', async () => {
    const server = new StreamingServer({ port: 3811, maxClients: 200 });
    await server.start();

    try {
      const clientCount = 100;
      const clients: http.ClientRequest[] = [];
      const messagePromises: Promise<void>[] = [];

      // Connect all clients
      for (let i = 0; i < clientCount; i++) {
        const promise = new Promise<void>((resolve) => {
          const req = http.get(`http://localhost:3811/stream`, (res) => {
            let messageCount = 0;
            res.on('data', (chunk) => {
              if (chunk.toString().includes('event:')) {
                messageCount++;
                if (messageCount >= 3) { // connection + 2 broadcasts
                  resolve();
                }
              }
            });
          });
          clients.push(req);
        });
        messagePromises.push(promise);
      }

      // Wait for all connections
      await new Promise(resolve => setTimeout(resolve, 500));

      // Broadcast multiple events
      server.broadcast('test1', { data: 'First broadcast' });
      server.broadcast('test2', { data: 'Second broadcast' });

      // Wait for all clients to receive messages
      await Promise.all(messagePromises);

      const metrics = server.getMetrics();
      expect(metrics.activeConnections).toBe(clientCount);
      expect(metrics.totalEvents).toBeGreaterThanOrEqual(2);

      // Clean up
      clients.forEach(req => req.destroy());
    } finally {
      await server.stop();
    }
  });

  test('SSE: should handle sustained high-frequency broadcasts', async () => {
    const server = new StreamingServer({ port: 3812 });
    await server.start();

    try {
      const client = await new Promise<http.IncomingMessage>((resolve) => {
        http.get(`http://localhost:3812/stream`, resolve);
      });

      let receivedEvents = 0;
      client.on('data', (chunk) => {
        const events = chunk.toString().split('\n\n').filter(e => e.includes('event: broadcast'));
        receivedEvents += events.length;
      });

      // Send rapid broadcasts
      const broadcastCount = 1000;
      const startTime = Date.now();

      for (let i = 0; i < broadcastCount; i++) {
        server.broadcast('broadcast', { index: i, timestamp: Date.now() });
        
        // Small batch delay every 100 messages
        if (i % 100 === 0) {
          await new Promise(resolve => setImmediate(resolve));
        }
      }

      const duration = Date.now() - startTime;
      
      // Wait for messages to be received
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log(`Sent ${broadcastCount} messages in ${duration}ms (${Math.round(broadcastCount / (duration / 1000))} msg/s)`);
      console.log(`Received ${receivedEvents} events`);

      // Should receive most events (allowing for some buffering/batching)
      expect(receivedEvents).toBeGreaterThan(broadcastCount * 0.9);

      client.destroy();
    } finally {
      await server.stop();
    }
  });

  test('WebSocket: should handle rapid connection/disconnection cycles', async () => {
    const server = new WebSocketStreamingServer({ port: 3813 });
    await server.start();

    try {
      const cycles = 50;
      let successfulConnections = 0;

      for (let i = 0; i < cycles; i++) {
        const ws = new WebSocket(`ws://localhost:3813`);
        
        await new Promise((resolve) => {
          ws.once('open', () => {
            successfulConnections++;
            ws.close();
            resolve(undefined);
          });
          ws.once('error', resolve);
        });

        // Small delay between connections
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      expect(successfulConnections).toBe(cycles);

      const metrics = server.getMetrics();
      expect(metrics.totalConnections).toBe(cycles);
      expect(metrics.activeConnections).toBe(0);
    } finally {
      await server.stop();
    }
  });

  test('WebSocket: should handle bi-directional message flood', async () => {
    const server = new WebSocketStreamingServer({ port: 3814 });
    await server.start();

    try {
      const ws = new WebSocket(`ws://localhost:3814`);
      let receivedMessages = 0;
      let sentMessages = 0;

      ws.on('message', () => {
        receivedMessages++;
      });

      await new Promise((resolve) => {
        ws.once('open', resolve);
      });

      // Send rapid messages from client
      const messageCount = 500;
      for (let i = 0; i < messageCount; i++) {
        ws.send(JSON.stringify({ type: 'ping', index: i }));
        sentMessages++;
        
        // Also broadcast from server
        server.broadcast('server-msg', { index: i });
        
        if (i % 50 === 0) {
          await new Promise(resolve => setImmediate(resolve));
        }
      }

      // Wait for messages to be processed
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log(`Sent ${sentMessages} messages, received ${receivedMessages} messages`);

      // Should handle most messages (allowing for some queueing)
      expect(receivedMessages).toBeGreaterThan(messageCount * 1.5); // Client messages + server broadcasts

      ws.close();
    } finally {
      await server.stop();
    }
  });

  test('Both servers: should handle memory efficiently under load', async () => {
    const sseServer = new StreamingServer({ port: 3815, bufferSize: 100 });
    const wsServer = new WebSocketStreamingServer({ port: 3816, bufferSize: 100 });

    await sseServer.start();
    await wsServer.start();

    try {
      // Get initial memory
      const initialMemory = process.memoryUsage().heapUsed;

      // Connect clients
      const sseClients: http.ClientRequest[] = [];
      const wsClients: WebSocket[] = [];

      for (let i = 0; i < 20; i++) {
        // SSE client
        const req = http.get(`http://localhost:3815/stream`);
        sseClients.push(req);

        // WebSocket client
        const ws = new WebSocket(`ws://localhost:3816`);
        wsClients.push(ws);
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      // Send many large messages
      for (let i = 0; i < 1000; i++) {
        const largeData = {
          index: i,
          timestamp: Date.now(),
          data: 'x'.repeat(1000) // 1KB of data
        };

        sseServer.broadcast('large-event', largeData);
        wsServer.broadcast('large-event', largeData);

        if (i % 100 === 0) {
          await new Promise(resolve => setImmediate(resolve));
        }
      }

      // Check memory growth
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = (finalMemory - initialMemory) / 1024 / 1024; // MB

      console.log(`Memory growth: ${memoryGrowth.toFixed(2)} MB`);

      // Memory growth should be reasonable (buffer size limits it)
      expect(memoryGrowth).toBeLessThan(50); // Less than 50MB growth

      // Clean up
      sseClients.forEach(req => req.destroy());
      wsClients.forEach(ws => ws.close());
    } finally {
      await sseServer.stop();
      await wsServer.stop();
    }
  });

  test('Connection recovery: should handle network interruptions', async () => {
    const server = new StreamingServer({ port: 3817 });
    await server.start();

    try {
      let lastEventId: string | undefined;
      let totalEventsReceived = 0;

      // First connection
      await new Promise<void>((resolve) => {
        const req = http.get(`http://localhost:3817/stream`, (res) => {
          let eventCount = 0;
          
          res.on('data', (chunk) => {
            const data = chunk.toString();
            const idMatch = data.match(/id: ([\w-]+)/);
            if (idMatch) {
              lastEventId = idMatch[1];
              eventCount++;
              totalEventsReceived++;
              
              if (eventCount >= 3) {
                // Simulate network interruption
                req.destroy();
                resolve();
              }
            }
          });
        });
      });

      // Send more events while disconnected
      server.broadcast('missed-event-1', { data: 'Should be buffered' });
      server.broadcast('missed-event-2', { data: 'Should also be buffered' });

      // Reconnect with last event ID
      const reconnectEvents = await new Promise<number>((resolve) => {
        let reconnectEventCount = 0;
        
        const req = http.get({
          hostname: 'localhost',
          port: 3817,
          path: '/stream',
          headers: {
            'Last-Event-ID': lastEventId || ''
          }
        }, (res) => {
          res.on('data', (chunk) => {
            const events = chunk.toString().split('\n\n').filter(e => e.includes('event:'));
            reconnectEventCount += events.length;
            
            if (reconnectEventCount >= 3) { // connection + 2 missed events
              req.destroy();
              resolve(reconnectEventCount);
            }
          });
        });
      });

      expect(reconnectEvents).toBeGreaterThanOrEqual(3);
      expect(server.getMetrics().reconnections).toBeGreaterThanOrEqual(1);
    } finally {
      await server.stop();
    }
  });
});