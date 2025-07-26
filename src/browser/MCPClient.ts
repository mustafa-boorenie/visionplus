import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { log } from '../utils/logger';

export interface MCPRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any;
  id?: string | number;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id?: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

/**
 * MCP Client for communicating with Playwright MCP Server via stdio
 */
export class MCPClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number | string, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }>();
  private messageBuffer = '';
  
  constructor(
    // Use npx to execute the Playwright MCP server that ships with the modern
    // '@playwright/mcp' package (installed as a dependency in package.json).
    // This newer package exposes tools like `browser_navigate`, `browser_click`, etc.
    // The previously-used `playwright-mcp` package (without the scoped name)
    // implements an outdated API that does **not** include those tools, which
    // resulted in the "Method not found" errors during interactive sessions.
    private command: string = 'npx',
    private args: string[] = ['@playwright/mcp']
  ) {
    super();
  }

  /**
   * Start the MCP server process
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        log.info(`[MCP] Starting MCP server process: ${this.command} ${this.args.join(' ')}`);
        
        this.process = spawn(this.command, this.args, {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        this.process.stdout?.on('data', (data) => {
          this.handleStdout(data.toString());
        });

        this.process.stderr?.on('data', (data) => {
          log.debug(`[MCP] Server stderr: ${data.toString()}`);
        });

        this.process.on('error', (error) => {
          log.error('[MCP] Process error', error as Error);
          reject(error);
        });

        this.process.on('exit', (code) => {
          log.info(`[MCP] Process exited with code ${code}`);
          this.cleanup();
        });

        // Give the process a moment to start, then initialize
        setTimeout(async () => {
          try {
            // Send MCP initialization
            await this.initialize();
            resolve();
          } catch (error) {
            reject(error);
          }
        }, 2000); // Increased delay to 2 seconds
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Initialize MCP connection
   */
  private async initialize(): Promise<void> {
    log.info('[MCP] Initializing MCP connection...');
    
    // Send initialize request
    const initResult = await this.call('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: {
        name: 'ai-playwright-scripter',
        version: '1.0.0'
      }
    });
    
    log.info(`[MCP] Initialize result: ${JSON.stringify(initResult)}`);
    
    // Send initialized notification
    this.notify('notifications/initialized', {});
    
    log.info('[MCP] MCP connection initialized');
  }

  /**
   * Handle stdout data from the MCP server
   */
  private handleStdout(data: string): void {
    this.messageBuffer += data;
    
    // Process complete lines
    const lines = this.messageBuffer.split('\n');
    this.messageBuffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line) as MCPResponse;
          this.handleMessage(message);
        } catch (error) {
          log.error(`[MCP] Failed to parse message: ${line}`, error as Error);
        }
      }
    }
  }

  /**
   * Handle incoming messages from the server
   */
  private handleMessage(message: MCPResponse): void {
    log.debug(`[MCP] Received message: ${JSON.stringify(message)}`);
    
    // Handle responses to our requests
    if (message.id !== undefined) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
      }
    }
    
    // Emit for notifications or other messages
    this.emit('message', message);
  }

  /**
   * Send a message to the MCP server
   */
  private send(message: MCPRequest): void {
    if (!this.process || !this.process.stdin) {
      throw new Error('MCP process not running');
    }
    
    const data = JSON.stringify(message) + '\n';
    log.debug(`[MCP] Sending message: ${data.trim()}`);
    this.process.stdin.write(data);
  }

  /**
   * Call an MCP tool
   */
  async call(method: string, params?: any): Promise<any> {
    const id = ++this.requestId;
    const request: MCPRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      
      try {
        this.send(request);
      } catch (error) {
        this.pendingRequests.delete(id);
        reject(error);
      }
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`MCP request timeout: ${method}`));
        }
      }, 30000);
    });
  }

  /**
   * Send a notification (no response expected)
   */
  notify(method: string, params?: any): void {
    const notification: MCPRequest = {
      jsonrpc: '2.0',
      method,
      params
    };
    
    this.send(notification);
  }

  /**
   * Check if MCP server is available
   */
  async isAvailable(): Promise<boolean> {
    return this.process !== null && !this.process.killed;
  }

  /**
   * Stop the MCP server process
   */
  async stop(): Promise<void> {
    if (this.process) {
      log.info('[MCP] Stopping MCP server process');
      this.process.kill();
      this.cleanup();
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.process = null;
    this.pendingRequests.clear();
    this.messageBuffer = '';
  }
} 