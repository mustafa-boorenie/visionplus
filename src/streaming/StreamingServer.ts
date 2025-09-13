import { EventEmitter } from 'events';
import * as http from 'http';
import * as https from 'https';
import { v4 as uuidv4 } from 'uuid';
import chalk from 'chalk';
import { log } from '../utils/logger';

export interface StreamEvent {
  id: string;
  type: string;
  data: any;
  timestamp: number;
}

export interface StreamClient {
  id: string;
  response: http.ServerResponse;
  lastEventId?: string;
  connected: boolean;
  connectionTime: number;
  lastActivity: number;
}

export interface StreamingServerOptions {
  port?: number;
  heartbeatInterval?: number;
  reconnectTimeout?: number;
  maxClients?: number;
  cors?: boolean;
  bufferSize?: number;
  compressionEnabled?: boolean;
}

/**
 * Server-Sent Events (SSE) streaming server for real-time progress updates
 */
export class StreamingServer extends EventEmitter {
  private server: http.Server | null = null;
  private clients: Map<string, StreamClient> = new Map();
  private eventBuffer: StreamEvent[] = [];
  private options: Required<StreamingServerOptions>;
  private heartbeatTimer: NodeJS.Timer | null = null;
  private metrics = {
    totalConnections: 0,
    activeConnections: 0,
    totalEvents: 0,
    reconnections: 0,
    errors: 0
  };

  constructor(options: StreamingServerOptions = {}) {
    super();
    this.options = {
      port: options.port || 3001,
      heartbeatInterval: options.heartbeatInterval || 30000, // 30 seconds
      reconnectTimeout: options.reconnectTimeout || 5000, // 5 seconds
      maxClients: options.maxClients || 100,
      cors: options.cors !== false,
      bufferSize: options.bufferSize || 1000,
      compressionEnabled: options.compressionEnabled !== false
    };
  }

  /**
   * Start the streaming server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(this.handleRequest.bind(this));
      
      this.server.on('error', (error) => {
        log.error('Streaming server error:', error);
        this.metrics.errors++;
        reject(error);
      });

      this.server.listen(this.options.port, () => {
        log.info(`Streaming server started on port ${this.options.port}`);
        console.log(chalk.green(`\n🚀 Streaming server running at http://localhost:${this.options.port}/stream\n`));
        
        // Start heartbeat
        this.startHeartbeat();
        
        resolve();
      });
    });
  }

  /**
   * Stop the streaming server
   */
  async stop(): Promise<void> {
    // Stop heartbeat
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Close all client connections
    for (const client of this.clients.values()) {
      this.closeClient(client.id);
    }

    // Close server
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          log.info('Streaming server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Handle incoming HTTP requests
   */
  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = new URL(req.url || '', `http://${req.headers.host}`);

    // Handle CORS preflight
    if (this.options.cors && req.method === 'OPTIONS') {
      this.setCorsHeaders(res);
      res.writeHead(204);
      res.end();
      return;
    }

    // Handle different endpoints
    switch (url.pathname) {
      case '/stream':
        this.handleStreamConnection(req, res);
        break;
      case '/health':
        this.handleHealthCheck(req, res);
        break;
      case '/metrics':
        this.handleMetrics(req, res);
        break;
      default:
        res.writeHead(404);
        res.end('Not Found');
    }
  }

  /**
   * Handle SSE stream connections
   */
  private handleStreamConnection(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Check client limit
    if (this.clients.size >= this.options.maxClients) {
      res.writeHead(503, { 'Content-Type': 'text/plain' });
      res.end('Server at capacity');
      return;
    }

    // Set SSE headers
    const headers: http.OutgoingHttpHeaders = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Disable Nginx buffering
    };

    if (this.options.cors) {
      this.setCorsHeaders(res);
    }

    res.writeHead(200, headers);

    // Create client
    const clientId = uuidv4();
    const client: StreamClient = {
      id: clientId,
      response: res,
      connected: true,
      connectionTime: Date.now(),
      lastActivity: Date.now(),
      lastEventId: req.headers['last-event-id'] as string
    };

    this.clients.set(clientId, client);
    this.metrics.totalConnections++;
    this.metrics.activeConnections = this.clients.size;

    log.info(`Client connected: ${clientId}`);
    
    // Send initial connection event
    this.sendToClient(client, {
      id: uuidv4(),
      type: 'connection',
      data: { clientId, reconnectTimeout: this.options.reconnectTimeout },
      timestamp: Date.now()
    });

    // Send buffered events if reconnecting
    if (client.lastEventId) {
      this.sendBufferedEvents(client);
      this.metrics.reconnections++;
    }

    // Handle client disconnect
    req.on('close', () => {
      this.closeClient(clientId);
    });

    req.on('error', (error) => {
      log.error(`Client error ${clientId}:`, error);
      this.closeClient(clientId);
    });
  }

  /**
   * Send event to specific client
   */
  private sendToClient(client: StreamClient, event: StreamEvent): boolean {
    if (!client.connected) return false;

    try {
      const data = JSON.stringify(event.data);
      const message = `id: ${event.id}\nevent: ${event.type}\ndata: ${data}\n\n`;
      
      client.response.write(message);
      client.lastActivity = Date.now();
      client.lastEventId = event.id;
      
      return true;
    } catch (error) {
      log.error(`Failed to send to client ${client.id}:`, error);
      this.closeClient(client.id);
      return false;
    }
  }

  /**
   * Broadcast event to all connected clients
   */
  broadcast(type: string, data: any): void {
    const event: StreamEvent = {
      id: uuidv4(),
      type,
      data,
      timestamp: Date.now()
    };

    // Add to buffer
    this.eventBuffer.push(event);
    if (this.eventBuffer.length > this.options.bufferSize) {
      this.eventBuffer.shift();
    }

    // Send to all clients
    let sent = 0;
    for (const client of this.clients.values()) {
      if (this.sendToClient(client, event)) {
        sent++;
      }
    }

    this.metrics.totalEvents++;
    log.debug(`Broadcast event ${type} to ${sent}/${this.clients.size} clients`);
  }

  /**
   * Send buffered events to reconnecting client
   */
  private sendBufferedEvents(client: StreamClient): void {
    if (!client.lastEventId) return;

    const lastIndex = this.eventBuffer.findIndex(e => e.id === client.lastEventId);
    if (lastIndex === -1) {
      // Event not in buffer, send all buffered events
      this.eventBuffer.forEach(event => this.sendToClient(client, event));
    } else {
      // Send events after the last received one
      this.eventBuffer.slice(lastIndex + 1).forEach(event => this.sendToClient(client, event));
    }
  }

  /**
   * Start heartbeat to keep connections alive
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      const heartbeatEvent: StreamEvent = {
        id: uuidv4(),
        type: 'heartbeat',
        data: { timestamp: Date.now() },
        timestamp: Date.now()
      };

      for (const client of this.clients.values()) {
        this.sendToClient(client, heartbeatEvent);
      }
    }, this.options.heartbeatInterval);
  }

  /**
   * Close client connection
   */
  private closeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.connected = false;
    this.clients.delete(clientId);
    this.metrics.activeConnections = this.clients.size;

    try {
      client.response.end();
    } catch (error) {
      // Client already disconnected
    }

    log.info(`Client disconnected: ${clientId}`);
  }

  /**
   * Handle health check endpoint
   */
  private handleHealthCheck(req: http.IncomingMessage, res: http.ServerResponse): void {
    const health = {
      status: 'healthy',
      uptime: process.uptime(),
      activeConnections: this.clients.size,
      timestamp: new Date().toISOString()
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health));
  }

  /**
   * Handle metrics endpoint
   */
  private handleMetrics(req: http.IncomingMessage, res: http.ServerResponse): void {
    const metrics = {
      ...this.metrics,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      eventBufferSize: this.eventBuffer.length,
      timestamp: new Date().toISOString()
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(metrics, null, 2));
  }

  /**
   * Set CORS headers
   */
  private setCorsHeaders(res: http.ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Last-Event-ID');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Get connected client count
   */
  getClientCount(): number {
    return this.clients.size;
  }
}