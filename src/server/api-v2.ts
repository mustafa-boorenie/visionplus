import fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { nanoid } from 'nanoid';
import path from 'path';
import { IntelligentAutomation } from '../automation/IntelligentAutomation';
import { SequenceManager } from '../utils/SequenceManager';
import { FeedbackManager } from '../feedback/FeedbackManager';
import { RulesEngine } from '../feedback/RulesEngine';
import { log } from '../utils/logger';
import { AutomationExecutionResult } from '../types';
import fs from 'fs-extra';
import { DatabaseService } from '../services/database.service';
import { DockerBrowserService, DockerBrowserSession } from '../services/docker-browser.service';

/**
 * Session state
 */
interface Session {
  id: string;
  browser?: any; // IBrowserAutomation, now optional
  createdAt: Date;
  lastActivity: Date;
  status: 'idle' | 'running' | 'error';
  currentCommand?: string;
  history: Array<{
    command: string;
    result: AutomationExecutionResult;
    timestamp: Date;
  }>;
  sseClients: Set<{ send: (data: any) => void }>; // Changed from wsClients to sseClients
  dockerSession?: DockerBrowserSession; // Docker session info
}

/**
 * Command request
 */
interface CommandRequest {
  command: string;
  arguments?: Record<string, string>;
  options?: {
    timeout?: number;
    generateTests?: boolean;
  };
}

/**
 * Session create request
 */
interface CreateSessionRequest {
  startUrl?: string;
  headless?: boolean;
  credentials?: {
    username?: string;
    password?: string;
  };
}

/**
 * Enhanced API Server with session management and WebSocket
 */
export class EnhancedAPIServer {
  private server: FastifyInstance;
  private port: number;
  private sessions: Map<string, Session> = new Map();
  private sequenceManager: SequenceManager;
  private feedbackManager: FeedbackManager;
  private rulesEngine: RulesEngine;
  private databaseService: DatabaseService;
  private dockerBrowserService: DockerBrowserService;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  
  constructor(port: number = 3000) {
    this.port = port;
    this.server = fastify({
      logger: true,
      bodyLimit: 10 * 1024 * 1024 // 10MB
    });
    
    this.sequenceManager = new SequenceManager();
    this.feedbackManager = new FeedbackManager();
    this.rulesEngine = new RulesEngine();
    this.databaseService = DatabaseService.getInstance();
    this.dockerBrowserService = new DockerBrowserService();
    
    // Start idle session cleanup timer
    this.startIdleCleanup();
  }
  
  /**
   * Initialize server and routes
   */
  async initialize(): Promise<void> {
    // Initialize managers
    await this.sequenceManager.initialize();
    await this.feedbackManager.initialize();
    await this.rulesEngine.initialize();
    await this.databaseService.connect();
    
    // Register plugins
    await this.server.register(fastifyCors, {
      origin: true,
      credentials: true
    });
    
    // Ensure JSON parsing is enabled (Fastify handles this by default)
    
    await this.server.register(fastifyStatic, {
      root: path.join(__dirname, '../../public'),
      prefix: '/'
    });
    
    // Register routes
    this.registerRoutes();
    
    // Start session cleanup interval
    this.startSessionCleanup();
  }
  
  /**
   * Register API routes
   */
  private registerRoutes(): void {
    // Health check
    this.server.get('/health', async () => {
      return { 
        status: 'healthy', 
        timestamp: new Date(),
        activeSessions: this.sessions.size
      };
    });
    
    // Session management
    this.server.post('/api/sessions', this.createSession.bind(this));
    this.server.get('/api/sessions/:id', this.getSession.bind(this));
    this.server.delete('/api/sessions/:id', this.deleteSession.bind(this));
    this.server.get('/api/sessions', this.listSessions.bind(this));
    
    // Test endpoint for SSE without Docker
    this.server.post('/api/test/sessions', async (request, reply) => {
      const { sessionId } = request.body as { sessionId: string };
      
      // Create a minimal session for testing SSE
      const session: Session = {
        id: sessionId || nanoid(),
        createdAt: new Date(),
        lastActivity: new Date(),
        status: 'idle',
        history: [],
        sseClients: new Set()
      };
      
      this.sessions.set(session.id, session);
      
      return reply.send({
        sessionId: session.id,
        status: 'created for testing'
      });
    });
    
    // Command execution
    this.server.post('/api/sessions/:id/commands', this.executeCommand.bind(this));
    this.server.get('/api/sessions/:id/commands', this.getCommandHistory.bind(this));
    
    // Server-Sent Events for live streaming
    this.server.get('/api/sessions/:id/stream', async (request, reply) => {
      const sessionId = (request.params as any).id;
      const session = this.sessions.get(sessionId);
      
      if (!session) {
        return reply.status(404).send({ error: 'Session not found' });
      }
      
      // Set up SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      
      // Send initial state
      reply.raw.write(`data: ${JSON.stringify({
        type: 'connected',
        sessionId,
        status: session.status
      })}\n\n`);
      
      // Create a simple event emitter wrapper
      const client = {
        send: (data: any) => {
          try {
            reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
          } catch (error) {
            console.error('Failed to send SSE data:', error);
          }
        }
      };
      
      // Add client to session
      session.sseClients.add(client); // Changed from wsClients
      
      // Handle disconnect
      request.raw.on('close', () => {
        session.sseClients.delete(client); // Changed from wsClients
      });
      
      // Keep connection alive
      const keepAlive = setInterval(() => {
        reply.raw.write(':ping\n\n');
      }, 30000);
      
      request.raw.on('close', () => {
        clearInterval(keepAlive);
      });
    });
    
    // Screenshot serving
    this.server.get('/api/sessions/:id/screenshots/:filename', this.getScreenshot.bind(this));
    
    // Sequence management
    this.server.get('/api/sequences', this.listSequences.bind(this));
    this.server.get('/api/sequences/:name', this.getSequence.bind(this));
    this.server.post('/api/sequences', this.saveSequence.bind(this));
    this.server.delete('/api/sequences/:name', this.deleteSequence.bind(this));
    
    // Execute sequence
    this.server.post('/api/sessions/:id/sequences/:name', this.executeSequence.bind(this));
    
    // Execute sequence with auto-session creation
    this.server.post('/api/sequences/:name/execute', this.executeSequenceWithNewSession.bind(this));
  }
  
  /**
   * Create a new session
   */
  private async createSession(
    request: FastifyRequest<{ Body: CreateSessionRequest }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      // Add safety check for request body
      if (!request.body) {
        log.error('Request body is undefined or null');
        return reply.status(400).send({
          error: 'Request body is required. Please send JSON with startUrl field.'
        });
      }
      
      const { startUrl, headless = false, credentials } = request.body;
      
      // Create session in database or use fallback
      let dbSession;
      try {
        dbSession = await this.databaseService.createSession({
          startUrl
        });
      } catch (error) {
        log.warn('Database unavailable, creating in-memory session only');
        dbSession = {
          id: nanoid(),
          createdAt: new Date(),
          lastActivity: new Date(),
          status: 'idle',
          startUrl,
          currentUrl: startUrl
        };
      }
      
      // Launch a new Docker container for this session
      let dockerSession: DockerBrowserSession | undefined;
      
      if (process.env.USE_DOCKER !== 'false') {
        try {
          dockerSession = await this.dockerBrowserService.createBrowserSession({
            startUrl,
            headless
          });
        } catch (error) {
          log.error('Failed to create Docker session, falling back to no-browser mode', error as Error);
          // Continue without Docker for testing
        }
      }
      
      // Create session in memory
      const session: Session = {
        id: dbSession.id,
        dockerSession,
        createdAt: dbSession.createdAt,
        lastActivity: dbSession.lastActivity,
        status: dbSession.status,
        history: [],
        sseClients: new Set()
      };
      
      this.sessions.set(dbSession.id, session);
      
      log.info(`Created session ${dbSession.id}${dockerSession ? ` with Docker container ${dockerSession.containerId}` : ' without Docker (test mode)'}`);
      
      return reply.send({
        sessionId: dbSession.id,
        createdAt: session.createdAt,
        status: session.status,
        containerPort: dockerSession?.port
      });
    } catch (error) {
      log.error('Failed to create session', error as Error);
      console.error('Detailed error:', error); // Add detailed console logging
      return reply.status(500).send({ 
        error: 'Failed to create session',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  /**
   * Update session activity timestamp
   */
  private updateSessionActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  /**
   * Execute command in session
   */
  private async executeCommand(
    request: FastifyRequest<{ 
      Params: { id: string };
      Body: CommandRequest 
    }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const { id: sessionId } = request.params;
      const { command, arguments: args, options } = request.body;
      
      const session = this.sessions.get(sessionId);
      if (!session) {
        return reply.status(404).send({ error: 'Session not found' });
      }
      
      // Update session activity
      this.updateSessionActivity(sessionId);
      
      // Create command in database
      const dbCommand = await this.databaseService.createCommand(sessionId, {
        command,
        arguments: args
      });
      
      // Update session
      session.lastActivity = new Date();
      session.status = 'running';
      session.currentCommand = command;
      
      // Update database session status
      await this.databaseService.updateSession(sessionId, {
        status: 'running',
        lastActivity: new Date()
      });
      
      // Broadcast status to WebSocket clients
      this.broadcastToSession(sessionId, {
        type: 'status',
        status: 'running',
        command
      });
      
      // Execute via Docker container
      if (session.dockerSession) {
        const startTime = Date.now();
        
        // Parse the command and convert to browser actions
        const result = await this.parseAndExecuteCommand(session.dockerSession, command);
        
        // Take a screenshot after command execution
        let screenshotFilename = null;
        try {
          const screenshot = await this.dockerBrowserService.takeScreenshot(session.dockerSession);
          screenshotFilename = `${sessionId}_${Date.now()}.png`;
          
          // Save screenshot to filesystem
          const screenshotDir = path.join(process.cwd(), 'screenshots');
          await fs.ensureDir(screenshotDir);
          const screenshotPath = path.join(screenshotDir, screenshotFilename);
          
          // Convert base64 to buffer and save
          const buffer = Buffer.from(screenshot, 'base64');
          await fs.writeFile(screenshotPath, buffer);
          
          log.info(`Screenshot captured: ${screenshotFilename}`);
          
          // Broadcast screenshot event
          this.broadcastToSession(sessionId, {
            type: 'screenshot',
            filename: screenshotFilename
          });
          
        } catch (screenshotError) {
          log.warn(`Failed to capture screenshot: ${(screenshotError as Error).message}`);
        }
        
        const executionTime = Date.now() - startTime;
        
        // Create a proper AutomationExecutionResult
        const automationResult: AutomationExecutionResult = {
          success: result.success,
          script: {
            name: `command-${dbCommand.id}`,
            description: command,
            url: await this.dockerBrowserService.getCurrentUrl(session.dockerSession),
            actions: [{ 
              type: 'navigate', // Default to navigate for now, we'll improve this later
              url: await this.dockerBrowserService.getCurrentUrl(session.dockerSession)
            }]
          },
          executionTime,
          screenshots: screenshotFilename ? [screenshotFilename] : [],
          errors: result.success ? [] : [result.error || 'Command failed'],
          stepResults: [{
            step: command,
            success: result.success,
            error: result.error,
            duration: executionTime
          }]
        };
        
        // Update database with command result
        await this.databaseService.updateCommand(dbCommand.id, {
          success: result.success,
          executionTime,
          result: automationResult,
          completedAt: new Date()
        });
        
        // Add to session history
        session.history.push({
          command,
          result: automationResult,
          timestamp: new Date()
        });
        
        // Update session status
        session.status = 'idle';
        await this.databaseService.updateSession(sessionId, {
          status: 'idle',
          lastActivity: new Date(),
          currentUrl: await this.dockerBrowserService.getCurrentUrl(session.dockerSession)
        });
        
        // Broadcast completion
        this.broadcastToSession(sessionId, {
          type: 'completed',
          result: automationResult
        });
        
        return reply.send({
          sessionId,
          command,
          result: automationResult,
          executionTime
        });
      } else {
        throw new Error('No Docker session available');
      }
      
    } catch (error) {
      log.error(`Failed to execute command: ${(error as Error).message}`);
      
      // Update session status back to idle
      const sessionFromMap = this.sessions.get(request.params.id);
      if (sessionFromMap) {
        sessionFromMap.status = 'idle';
        await this.databaseService.updateSession(request.params.id, {
          status: 'idle',
          lastActivity: new Date()
        });
      }
      
      return reply.status(500).send({ 
        error: 'Failed to execute command',
        details: (error as Error).message 
      });
    }
  }
  
  /**
   * Get session details
   */
  private async getSession(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<any> {
    const sessionId = request.params.id;
    
    // Get from database
    const dbSession = await this.databaseService.getSession(sessionId);
    if (!dbSession) {
      return reply.status(404).send({ error: 'Session not found' });
    }
    
    // Update session activity if in memory
    this.updateSessionActivity(sessionId);
    
    // Get memory session for browser instance
    const memorySession = this.sessions.get(sessionId);
    
    // Get current URL from Docker session
    let currentUrl = dbSession.currentUrl;
    if (memorySession?.dockerSession) {
      try {
        currentUrl = await this.dockerBrowserService.getCurrentUrl(memorySession.dockerSession);
      } catch (error) {
        log.warn(`Failed to get current URL from Docker session: ${error}`);
      }
    }
    
    return reply.send({
      id: dbSession.id,
      createdAt: dbSession.createdAt,
      lastActivity: dbSession.lastActivity,
      status: memorySession ? memorySession.status : dbSession.status,
      currentUrl,
      currentCommand: memorySession?.currentCommand,
      historyCount: dbSession.commands?.length || 0,
      connectedClients: memorySession?.sseClients.size || 0,
      commands: dbSession.commands,
      screenshots: dbSession.screenshots
    });
  }
  
  /**
   * Delete a session
   */
  private async deleteSession(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const { id: sessionId } = request.params;
      
      const session = this.sessions.get(sessionId);
      if (session) {
        // Stop Docker container
        if (session.dockerSession) {
          await this.dockerBrowserService.destroySession(session.dockerSession.containerId);
        }
        
        // Remove from memory
        this.sessions.delete(sessionId);
      }
      
      // Update database
      try {
        await this.databaseService.deactivateSession(sessionId);
      } catch (error) {
        log.warn(`Failed to deactivate session in database: ${error}`);
      }
      
      return reply.send({ success: true });
    } catch (error) {
      log.error('Failed to delete session', error as Error);
      return reply.status(500).send({ error: 'Failed to delete session' });
    }
  }
  
  /**
   * List all sessions
   */
  private async listSessions(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<any> {
    // Get sessions from database
    const { sessions: dbSessions, total } = await this.databaseService.listSessions({
      includeInactive: true,
      limit: 100
    });
    
    // Enhance with memory session data if available
    const sessions = dbSessions.map(dbSession => {
      const memorySession = this.sessions.get(dbSession.id);
      return {
        id: dbSession.id,
        createdAt: dbSession.createdAt,
        lastActivity: dbSession.lastActivity,
        status: memorySession ? memorySession.status : dbSession.status,
        commandCount: dbSession.commands?.length || 0,
        screenshotCount: dbSession.screenshots?.length || 0,
        sequenceName: dbSession.sequence?.name,
        isActive: memorySession !== undefined
      };
    });
    
    return reply.send({ sessions, total });
  }
  
  /**
   * Get command history for session
   */
  private async getCommandHistory(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<any> {
    const session = this.sessions.get(request.params.id);
    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }
    
    return reply.send({
      sessionId: session.id,
      history: session.history
    });
  }
  
  /**
   * Get screenshot
   */
  private async getScreenshot(
    request: FastifyRequest<{ Params: { id: string; filename: string } }>,
    reply: FastifyReply
  ): Promise<any> {
    const screenshotPath = path.join(process.cwd(), 'screenshots', request.params.filename);
    
    // Check if file exists
    const exists = await fs.pathExists(screenshotPath);
    if (!exists) {
      return reply.status(404).send({ error: 'Screenshot not found' });
    }
    
    // Read and send file
    const buffer = await fs.readFile(screenshotPath);
    return reply
      .type('image/png')
      .send(buffer);
  }
  
  /**
   * List sequences
   */
  private async listSequences(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<any> {
    const sequences = await this.sequenceManager.listSequences();
    return reply.send({ sequences });
  }
  
  /**
   * Get sequence details
   */
  private async getSequence(
    request: FastifyRequest<{ Params: { name: string } }>,
    reply: FastifyReply
  ): Promise<any> {
    const sequence = await this.sequenceManager.loadSequence(request.params.name);
    if (!sequence) {
      return reply.status(404).send({ error: 'Sequence not found' });
    }
    return reply.send(sequence);
  }
  
  /**
   * Save sequence
   */
  private async saveSequence(
    request: FastifyRequest<{ Body: { 
      name: string;
      originalPrompt?: string;
      executionResult?: AutomationExecutionResult;
      description?: string;
      tags?: string[];
      category?: string;
    } }>,
    reply: FastifyReply
  ): Promise<any> {
    const { name, originalPrompt, executionResult, ...options } = request.body;
    const saved = await this.sequenceManager.saveSequence(
      name,
      originalPrompt || '',
      executionResult || { 
        success: true, 
        script: { name, description: '', url: '', actions: [] },
        executionTime: 0,
        screenshots: [],
        errors: [],
        stepResults: []
      },
      options
    );
    return reply.send({ success: true, sequence: saved });
  }
  
  /**
   * Delete sequence
   */
  private async deleteSequence(
    request: FastifyRequest<{ Params: { name: string } }>,
    reply: FastifyReply
  ): Promise<any> {
    await this.sequenceManager.deleteSequence(request.params.name);
    return reply.send({ success: true });
  }
  
  /**
   * Execute sequence with auto-session creation
   */
  private async executeSequenceWithNewSession(
    request: FastifyRequest<{
      Params: { name: string };
      Body: { 
        arguments?: Record<string, string>;
        startUrl?: string;
      }
    }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const { name: sequenceName } = request.params;
      const { arguments: args, startUrl } = request.body || {};
      
      // Load sequence first to check if it exists
      const sequence = await this.sequenceManager.loadSequence(sequenceName);
      if (!sequence) {
        return reply.status(404).send({ error: 'Sequence not found' });
      }
      
      // Create new session for this sequence
      const dbSession = await this.databaseService.createSession({
        startUrl: startUrl || sequence.script.url,
        sequenceId: undefined // We'll link it after migrating sequences to database
      });
      
      // Create browser instance
      
      // Navigate to start URL if provided
      const initialUrl = startUrl || sequence.script.url;
      if (initialUrl) {
        // TODO: Replace with Docker container communication
        // await session.browser.executeAction({ type: 'navigate', url: initialUrl });
      }
      
      // Create session in memory
      const session: Session = {
        id: dbSession.id,
        // browser, // TODO: Replace with Docker container communication
        createdAt: dbSession.createdAt,
        lastActivity: dbSession.lastActivity,
        status: dbSession.status,
        history: [],
        sseClients: new Set() // Changed from wsClients
      };
      
      this.sessions.set(dbSession.id, session);
      
      log.info(`Created session ${dbSession.id} for sequence ${sequenceName}`);
      
      // Now execute the sequence using the existing executeSequence logic
      const executeParams = {
        params: { id: dbSession.id, name: sequenceName },
        body: { arguments: args }
      };
      
      // Call executeSequence with the new session
      return await this.executeSequence(
        executeParams as any,
        reply
      );
    } catch (error) {
      log.error('Failed to execute sequence with new session', error as Error);
      return reply.status(500).send({ 
        error: 'Failed to execute sequence',
        message: (error as Error).message 
      });
    }
  }
  
  /**
   * Execute a sequence in a session
   */
  private async executeSequence(
    request: FastifyRequest<{ 
      Params: { id: string; name: string };
      Body: { arguments?: Record<string, string> } 
    }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const { id: sessionId, name: sequenceName } = request.params;
      const { arguments: args } = request.body || {};
      
      const session = this.sessions.get(sessionId);
      if (!session) {
        return reply.status(404).send({ error: 'Session not found' });
      }
      
      // Load sequence
      const sequence = await this.sequenceManager.loadSequence(sequenceName);
      if (!sequence) {
        return reply.status(404).send({ error: 'Sequence not found' });
      }
      
      // Update session
      session.lastActivity = new Date();
      session.status = 'running';
      session.currentCommand = `Execute sequence: ${sequenceName}`;
      
      // Broadcast status
      this.broadcastToSession(sessionId, {
        type: 'status',
        status: 'running',
        command: `Executing sequence: ${sequenceName}`
      });
      
      // Create automation instance for sequence execution
      const automation = new IntelligentAutomation(
        null as any, // We'll use Docker session instead
        sequenceName,
        true, // verbose
        true, // persistent browser
        true, // is running sequence
        undefined, // no readline in API mode
        (screenshot: string) => {
          // Broadcast screenshot immediately as it's captured
          log.info(`[SEQUENCE_SCREENSHOT_CALLBACK] Broadcasting screenshot: ${screenshot}`);
          this.broadcastToSession(sessionId, {
            type: 'screenshot',
            filename: path.basename(screenshot),
            fullPath: screenshot,
            timestamp: new Date().toISOString()
          });
        }
      );
      
      // Execute
      const startTime = Date.now();
      let result: AutomationExecutionResult;
      
      try {
        const currentUrl = await session.browser.getCurrentUrl();
        result = await automation.execute(currentUrl);
        
        // Broadcast completion
        this.broadcastToSession(sessionId, {
          type: 'completed',
          command: `Sequence ${sequenceName}`,
          result,
          duration: Date.now() - startTime
        });
        
        session.status = 'idle';
        
      } catch (error) {
        session.status = 'error';
        result = {
          success: false,
          script: sequence.script,
          executionTime: Date.now() - startTime,
          screenshots: [],
          errors: [(error as Error).message],
          stepResults: []
        };
        
        this.broadcastToSession(sessionId, {
          type: 'error',
          command: `Sequence ${sequenceName}`,
          error: (error as Error).message
        });
      }
      
      // Update history
      session.history.push({
        command: `Execute sequence: ${sequenceName}`,
        result,
        timestamp: new Date()
      });
      
      return reply.send({
        sessionId,
        command: `Execute sequence: ${sequenceName}`,
        result,
        executionTime: result.executionTime
      });
      
    } catch (error) {
      log.error('Failed to execute sequence', error as Error);
      return reply.status(500).send({ error: 'Failed to execute sequence' });
    }
  }
  
  /**
   * Broadcast message to all SSE clients of a session
   */
  private broadcastToSession(sessionId: string, message: any): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.sseClients.forEach(client => {
        try {
          client.send(message);
        } catch (error) {
          // Client might be disconnected
          session.sseClients.delete(client);
        }
      });
    }
  }
  
  /**
   * Start session cleanup interval
   */
  private startSessionCleanup(): void {
    // Clean up inactive sessions every minute (check more frequently)
    setInterval(() => {
      const now = Date.now();
      const timeout = 5 * 60 * 1000; // 5 minutes idle timeout
      
      for (const [id, session] of this.sessions) {
        if (now - session.lastActivity.getTime() > timeout) {
          log.info(`Cleaning up inactive session ${id} (idle for ${Math.round((now - session.lastActivity.getTime()) / 1000 / 60)} minutes)`);
          this.deleteSession(
            { params: { id } } as any,
            { send: () => {}, status: () => ({ send: () => {} }) } as any
          );
        }
      }
    }, 60 * 1000); // Check every minute
  }

  /**
   * Start idle session cleanup timer
   */
  private startIdleCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [id, session] of this.sessions) {
        if (now - session.lastActivity.getTime() > this.IDLE_TIMEOUT_MS) {
          log.info(`Cleaning up idle session ${id} (inactive for ${Math.round((now - session.lastActivity.getTime()) / 1000 / 60)} minutes)`);
          this.deleteSession(
            { params: { id } } as any,
            { send: () => {}, status: () => ({ send: () => {} }) } as any
          );
        }
      }
    }, this.IDLE_TIMEOUT_MS); // Check every 5 minutes
  }

  /**
   * Stop idle session cleanup timer
   */
  private stopIdleCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
  
  /**
   * Convert OpenAI step format to browser action format
   */
  private convertStepToAction(step: any): any {
    // Extract selectors - support both old 'selector' and new 'selectors' format
    const getSelectors = () => {
      if (step.selectors && Array.isArray(step.selectors)) {
        // Return the full selectors array for smart selector handling
        return step.selectors;
      } else if (step.selector) {
        return step.selector;
      }
      return undefined;
    };

    switch (step.actionType || step.type) {
      case 'navigate':
        return { type: 'navigate', url: step.value || step.url };
      case 'click':
        return { type: 'click', selector: getSelectors() };
      case 'type':
        return { type: 'type', selector: getSelectors(), text: step.value || step.text };
      case 'press':
        return { type: 'press', selector: getSelectors(), key: step.value || step.key || 'Enter' };
      case 'scroll':
        return { 
          type: 'scroll', 
          direction: step.direction || 'down', 
          amount: step.amount || 500,
          selector: getSelectors()
        };
      case 'wait':
        return { 
          type: 'wait', 
          duration: step.waitTime || step.duration || 2000,
          selector: getSelectors()
        };
      case 'screenshot':
        return { type: 'screenshot', name: step.value || step.name || 'screenshot' };
      default:
        // If no type matches, return a wait action instead of null
        log.warn(`Unknown action type: ${step.actionType || step.type}, defaulting to wait`);
        return { type: 'wait', duration: 1000 };
    }
  }

  /**
   * Parse command and execute via Docker using IntelligentAutomation
   */
  private async parseAndExecuteCommand(
    dockerSession: DockerBrowserSession, 
    command: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      log.info(`[COMMAND_DEBUG] Starting IntelligentAutomation for command: ${command}`);
      const currentUrl = await this.dockerBrowserService.getCurrentUrl(dockerSession);
      log.info(`[COMMAND_DEBUG] Current URL: ${currentUrl}`);
      
      // Create IntelligentAutomation instance
      const automation = new IntelligentAutomation(
        null as any, // We'll override the browser execution
        command,
        false, // verbose
        false, // persistBrowser
        false, // isRunningSequence
        undefined, // externalReadline
        undefined // onScreenshotCapture
      );
      
      log.info(`[COMMAND_DEBUG] IntelligentAutomation instance created successfully`);
      
      // Use the breakdown method to parse the command into steps
      const breakdownMethod = automation['breakdownTask'].bind(automation);
      
      log.info(`[COMMAND_DEBUG] About to call breakdownTask method`);
      
             // Manually set the current script info for context
       automation['currentScript'] = {
         name: `command-${Date.now()}`,
         description: command,
         url: currentUrl,
         actions: []
       };
      
      log.info(`[COMMAND_DEBUG] Current script set, calling breakdownTask...`);

      // Call the breakdown method to get the parsed steps
      await breakdownMethod();
      
      log.info(`[COMMAND_DEBUG] breakdownTask completed successfully`);
      
      // Get the generated task steps
      const taskSteps = automation['taskSteps'];
      
      if (!taskSteps || taskSteps.length === 0) {
        return {
          success: false,
          error: `Could not parse command: ${command}. OpenAI could not generate automation steps.`
        };
      }
      
      // Execute each step via Docker
      for (const step of taskSteps) {
        // The step already has an 'action' property with the browser action
        if (step.action) {
          log.info(`[COMMAND_DEBUG] Executing action: ${JSON.stringify(step.action)}`);
          await this.dockerBrowserService.executeAction(dockerSession, step.action);
        }
      }
      
      return { success: true };
      
    } catch (error) {
      log.error(`Error parsing command with IntelligentAutomation: ${(error as Error).message}`);
      
      // Surface error instead of falling back to simplified parsing
      return { success: false, error: (error as Error).message };
    }
  }
  
  /**
   * Fallback command parsing for simple cases when IntelligentAutomation fails
   */
  private async fallbackCommandParsing(
    dockerSession: DockerBrowserSession,
    command: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      log.info(`Using fallback parsing for command: ${command}`);
      
      // Check if this is a simple navigation command vs a complex command
      const isComplexCommand = command.toLowerCase().includes(' and ') || 
                             command.toLowerCase().includes('search') ||
                             command.toLowerCase().includes('click') ||
                             command.toLowerCase().includes('type') ||
                             command.toLowerCase().includes('fill');
      
      if ((command.toLowerCase().includes('navigate') || command.toLowerCase().includes('go to')) && !isComplexCommand) {
        // Only handle simple navigation commands here
        const urlMatch = command.match(/(?:navigate to|go to)\s+([^\\s]+(?:\\.[^\\s]+)*)/i);
        if (urlMatch) {
          let url = urlMatch[1].trim();
          
          // Handle common domain shortcuts
          const commonDomains: Record<string, string> = {
            'github': 'github.com',
            'google': 'google.com', 
            'youtube': 'youtube.com',
            'amazon': 'amazon.com',
            'facebook': 'facebook.com',
            'twitter': 'twitter.com',
            'linkedin': 'linkedin.com',
            'stackoverflow': 'stackoverflow.com'
          };
          
          const lowerUrl = url.toLowerCase();
          if (commonDomains[lowerUrl]) {
            url = commonDomains[lowerUrl];
          }
          else if (!url.includes('.') && !url.includes('/') && !url.startsWith('http')) {
            url = url + '.com';
          }
          
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
          }
          
          await this.dockerBrowserService.executeAction(dockerSession, {
            type: 'navigate',
            url: url
          });
          return { success: true };
        }
      }
      
      // For complex commands (like "go to google and search for baby toys"), 
      // we should not use fallback parsing as it's too simple.
      // Instead, provide a helpful error message.
      if (isComplexCommand) {
        return { 
          success: false, 
          error: `Complex command detected: "${command}". This requires the AI system to break it down into steps. Please ensure OpenAI API is properly configured and try again.` 
        };
      }
      
      return { 
        success: false, 
        error: `Could not parse command: ${command}. Please try a more specific command or ensure OpenAI API is properly configured.` 
      };
      
    } catch (error) {
      return { 
        success: false, 
        error: `Command execution failed: ${(error as Error).message}` 
      };
    }
  }

  /**
   * Start server
   */
  async start(): Promise<void> {
    try {
      await this.server.listen({ port: this.port, host: '0.0.0.0' });
      log.info(`Enhanced API Server listening on port ${this.port}`);
    } catch (error) {
      const err = error as Error;
      if (err.message.includes('EADDRINUSE')) {
        log.error(`Port ${this.port} is already in use. Please check for other running instances or use a different port.`);
        log.error(`To find processes using this port, run: lsof -i :${this.port}`);
        log.error(`To kill processes using this port, run: kill -9 $(lsof -ti :${this.port})`);
      }
      log.error('Failed to start server', err);
      throw error;
    }
  }
  
  /**
   * Stop server
   */
  async stop(): Promise<void> {
    // Clean up all Docker containers
    await this.dockerBrowserService.cleanupAllSessions();
    
    // Close all sessions
    for (const session of this.sessions.values()) {
      // WebSocket cleanup...
    }

    this.stopIdleCleanup(); // Stop idle cleanup timer
    
    await this.server.close();
    log.info('API server stopped');
  }
} 