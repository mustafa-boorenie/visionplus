import { EventEmitter } from 'events';
import * as http from 'http';
import * as WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import chalk from 'chalk';
import { log } from '../utils/logger';

export interface WSMessage {
  id: string;
  type: string;
  data: any;
  timestamp: number;
}

export interface WSClient {
  id: string;
  ws: WebSocket;
  connected: boolean;
  connectionTime: number;
  lastActivity: number;
  lastMessageId?: string;
}

export interface WebSocketServerOptions {
  port?: number;
  heartbeatInterval?: number;
  reconnectTimeout?: number;
  maxClients?: number;
  bufferSize?: number;
  compressionEnabled?: boolean;
}

/**
 * WebSocket server for real-time bi-directional communication
 */
export class WebSocketStreamingServer extends EventEmitter {
  private server: http.Server | null = null;
  private wss: WebSocket.Server | null = null;
  private clients: Map<string, WSClient> = new Map();
  private messageBuffer: WSMessage[] = [];
  private options: Required<WebSocketServerOptions>;
  private heartbeatTimer: NodeJS.Timer | null = null;
  private metrics = {
    totalConnections: 0,
    activeConnections: 0,
    totalMessages: 0,
    messagesReceived: 0,
    reconnections: 0,
    errors: 0
  };

  constructor(options: WebSocketServerOptions = {}) {
    super();
    this.options = {
      port: options.port || 3002,
      heartbeatInterval: options.heartbeatInterval || 30000,
      reconnectTimeout: options.reconnectTimeout || 5000,
      maxClients: options.maxClients || 100,
      bufferSize: options.bufferSize || 1000,
      compressionEnabled: options.compressionEnabled !== false
    };
  }

  /**
   * Start the WebSocket server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer();
      
      this.wss = new WebSocket.Server({
        server: this.server,
        perMessageDeflate: this.options.compressionEnabled
      });

      this.wss.on('connection', this.handleConnection.bind(this));
      
      this.server.on('error', (error) => {
        log.error('WebSocket server error:', error);
        this.metrics.errors++;
        reject(error);
      });

      this.server.listen(this.options.port, () => {
        log.info(`WebSocket server started on port ${this.options.port}`);
        console.log(chalk.green(`\n🚀 WebSocket server running at ws://localhost:${this.options.port}\n`));
        
        // Start heartbeat
        this.startHeartbeat();
        
        resolve();
      });
    });
  }

  /**
   * Stop the WebSocket server
   */
  async stop(): Promise<void> {
    // Stop heartbeat
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Close all client connections
    for (const client of this.clients.values()) {
      this.closeClient(client.id, 1000, 'Server shutting down');
    }

    // Close WebSocket server
    return new Promise((resolve) => {
      if (this.wss) {
        this.wss.close(() => {
          if (this.server) {
            this.server.close(() => {
              log.info('WebSocket server stopped');
              resolve();
            });
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Handle new WebSocket connections
   */
  private handleConnection(ws: WebSocket, req: http.IncomingMessage): void {
    // Check client limit
    if (this.clients.size >= this.options.maxClients) {
      ws.close(1013, 'Server at capacity');
      return;
    }

    const clientId = uuidv4();
    const client: WSClient = {
      id: clientId,
      ws,
      connected: true,
      connectionTime: Date.now(),
      lastActivity: Date.now()
    };

    this.clients.set(clientId, client);
    this.metrics.totalConnections++;
    this.metrics.activeConnections = this.clients.size;

    log.info(`WebSocket client connected: ${clientId}`);

    // Send welcome message
    this.sendToClient(client, {
      id: uuidv4(),
      type: 'connection',
      data: { 
        clientId, 
        reconnectTimeout: this.options.reconnectTimeout,
        protocol: 'websocket'
      },
      timestamp: Date.now()
    });

    // Set up event handlers
    ws.on('message', (data) => this.handleMessage(clientId, data));
    ws.on('close', (code, reason) => this.handleDisconnect(clientId, code, reason));
    ws.on('error', (error) => this.handleError(clientId, error));
    ws.on('pong', () => this.handlePong(clientId));
  }

  /**
   * Handle incoming messages from clients
   */
  private handleMessage(clientId: string, data: WebSocket.Data): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.lastActivity = Date.now();
    this.metrics.messagesReceived++;

    try {
      const message = JSON.parse(data.toString());
      
      // Handle different message types
      switch (message.type) {
        case 'ping':
          this.sendToClient(client, {
            id: uuidv4(),
            type: 'pong',
            data: { timestamp: Date.now() },
            timestamp: Date.now()
          });
          break;
          
        case 'subscribe':
          // Handle subscription to specific event types
          this.emit('subscribe', { clientId, topics: message.data.topics });
          break;
          
        case 'unsubscribe':
          // Handle unsubscription from event types
          this.emit('unsubscribe', { clientId, topics: message.data.topics });
          break;
          
        case 'sync':
          // Send buffered messages since last message ID
          client.lastMessageId = message.data.lastMessageId;
          this.sendBufferedMessages(client);
          this.metrics.reconnections++;
          break;
          
        default:
          // Emit custom message types for handling
          this.emit('message', { clientId, message });
      }
    } catch (error) {
      log.error(`Failed to parse message from client ${clientId}:`, error);
      this.sendToClient(client, {
        id: uuidv4(),
        type: 'error',
        data: { message: 'Invalid message format' },
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(clientId: string, code: number, reason: Buffer): void {
    log.info(`WebSocket client disconnected: ${clientId} (code: ${code}, reason: ${reason.toString()})`);
    this.closeClient(clientId);
  }

  /**
   * Handle client errors
   */
  private handleError(clientId: string, error: Error): void {
    log.error(`WebSocket client error ${clientId}:`, error);
    this.metrics.errors++;
    this.closeClient(clientId, 1011, 'Internal error');
  }

  /**
   * Handle pong responses
   */
  private handlePong(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastActivity = Date.now();
    }
  }

  /**
   * Send message to specific client
   */
  private sendToClient(client: WSClient, message: WSMessage): boolean {
    if (!client.connected || client.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      const data = JSON.stringify(message);
      client.ws.send(data);
      client.lastActivity = Date.now();
      client.lastMessageId = message.id;
      return true;
    } catch (error) {
      log.error(`Failed to send to client ${client.id}:`, error);
      this.closeClient(client.id);
      return false;
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(type: string, data: any): void {
    const message: WSMessage = {
      id: uuidv4(),
      type,
      data,
      timestamp: Date.now()
    };

    // Add to buffer
    this.messageBuffer.push(message);
    if (this.messageBuffer.length > this.options.bufferSize) {
      this.messageBuffer.shift();
    }

    // Send to all clients
    let sent = 0;
    for (const client of this.clients.values()) {
      if (this.sendToClient(client, message)) {
        sent++;
      }
    }

    this.metrics.totalMessages++;
    log.debug(`Broadcast message ${type} to ${sent}/${this.clients.size} clients`);
  }

  /**
   * Send message to specific client by ID
   */
  sendToClientById(clientId: string, type: string, data: any): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    const message: WSMessage = {
      id: uuidv4(),
      type,
      data,
      timestamp: Date.now()
    };

    return this.sendToClient(client, message);
  }

  /**
   * Send buffered messages to reconnecting client
   */
  private sendBufferedMessages(client: WSClient): void {
    if (!client.lastMessageId) {
      // No last message ID, send all buffered messages
      this.messageBuffer.forEach(message => this.sendToClient(client, message));
      return;
    }

    const lastIndex = this.messageBuffer.findIndex(m => m.id === client.lastMessageId);
    if (lastIndex === -1) {
      // Message not in buffer, send all buffered messages
      this.messageBuffer.forEach(message => this.sendToClient(client, message));
    } else {
      // Send messages after the last received one
      this.messageBuffer.slice(lastIndex + 1).forEach(message => this.sendToClient(client, message));
    }
  }

  /**
   * Start heartbeat to keep connections alive
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      for (const client of this.clients.values()) {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      }
    }, this.options.heartbeatInterval);
  }

  /**
   * Close client connection
   */
  private closeClient(clientId: string, code?: number, reason?: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.connected = false;
    this.clients.delete(clientId);
    this.metrics.activeConnections = this.clients.size;

    try {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.close(code || 1000, reason || 'Normal closure');
      }
    } catch (error) {
      // Client already disconnected
    }

    this.emit('disconnect', { clientId });
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

  /**
   * Get all connected client IDs
   */
  getClientIds(): string[] {
    return Array.from(this.clients.keys());
  }
}