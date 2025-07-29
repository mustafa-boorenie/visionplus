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
import axios from 'axios';
import { DatabaseService } from '../services/database.service';
import { DockerBrowserService, DockerBrowserSession } from '../services/docker-browser.service';
import { RecoveryOption, RecoveryPromptResult, RecoveryPromptSystem } from '../automation/RecoveryPromptSystem';
import { browserlessService } from '../services/browserless.service';

/**
 * Session state
 */
interface Session {
  id: string;
  browser?: any; // IBrowserAutomation, now optional
  createdAt: Date;
  lastActivity: Date;
  status: 'idle' | 'running' | 'error' | 'waiting_for_recovery';
  currentCommand?: string;
  history: Array<{
    command: string;
    result: AutomationExecutionResult;
    timestamp: Date;
  }>;
  sseClients: Set<{ send: (data: any) => void }>; // Changed from wsClients to sseClients
  dockerSession?: DockerBrowserSession; // Docker session info
  recoveryState?: {
    options: RecoveryOption[];
    failureContext: any;
    timestamp: Date;
    resolved?: boolean;
    selectedOption?: string;
    customActions?: Array<{ type: string; [key: string]: unknown }>;
  };
  webrtcViewerUrl?: string; // For Browserless WebRTC
  webrtcUrl?: string; // For Browserless WebRTC
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
  private webrtcSessions: Map<string, string> = new Map();
  private sequenceManager: SequenceManager;
  private feedbackManager: FeedbackManager;
  private rulesEngine: RulesEngine;
  private databaseService: DatabaseService;
  private dockerBrowserService: DockerBrowserService;
  private recoverySystem: RecoveryPromptSystem;
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
    this.recoverySystem = new RecoveryPromptSystem();
    
    // Start consolidated cleanup timer
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
    
    // Add recovery mode routes
    this.registerRecoveryRoutes();
    
    // Cleanup is started in constructor - no need to start it again here
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
    this.server.post('/api/sessions/clear-inactive', this.clearInactiveSessions.bind(this));
    this.server.get('/api/sessions/:id/screenshots-db', this.getSessionScreenshots.bind(this));
    
    // WebRTC routes will be registered when methods exist
    this.server.post('/api/sessions/:id/webrtc', this.createWebRTCSession.bind(this));
    this.server.get('/api/sessions/:id/webrtc', this.getWebRTCSession.bind(this));
    this.server.delete('/api/sessions/:id/webrtc', this.closeWebRTCSession.bind(this));
    this.server.post('/api/sessions/:id/webrtc/proxy', this.proxyDockerWebRTCSession.bind(this));
    this.server.post('/api/sessions/:id/webrtc/:webrtcId/control', this.proxyDockerWebRTCControl.bind(this));
    
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
      
      log.info(`[SSE] Stream connection attempt for session: ${sessionId}`);
      log.info(`[SSE] Currently active sessions: [${Array.from(this.sessions.keys()).join(', ')}]`);
      
      const session = this.sessions.get(sessionId);
      
      if (!session) {
        log.error(`[SSE] Session not found: ${sessionId}. Available sessions: ${this.sessions.size}`);
        return reply.status(404).send({ 
          error: 'Session not found',
          sessionId,
          availableSessions: Array.from(this.sessions.keys()),
          message: `Session ${sessionId} does not exist in memory. It may have been cleaned up or never created.`
        });
      }
      
      // Update session activity immediately when SSE connects
      this.updateSessionActivity(sessionId);
      
      log.info(`[SSE] Session found: ${sessionId}, status: ${session.status}, Docker: ${!!session.dockerSession}`);
      
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
        status: session.status,
        timestamp: new Date().toISOString()
      })}\n\n`);
      
      log.info(`[SSE] Client connected to session ${sessionId}, total clients: ${session.sseClients.size + 1}`);
      
      // Create a simple event emitter wrapper
      const client = {
        send: (data: any) => {
          try {
            reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
          } catch (error) {
            log.error(`[SSE] Failed to send SSE data to ${sessionId}:`, error as Error);
          }
        }
      };
      
      // Add client to session
      session.sseClients.add(client);
      
      // Handle disconnect
      request.raw.on('close', () => {
        session.sseClients.delete(client);
        log.info(`[SSE] Client disconnected from session ${sessionId}, remaining clients: ${session.sseClients.size}`);
      });
      
      // Keep connection alive
      const keepAlive = setInterval(() => {
        try {
          reply.raw.write(':ping\n\n');
        } catch (error) {
          log.warn(`[SSE] Keep-alive failed for ${sessionId}, client likely disconnected`);
          clearInterval(keepAlive);
        }
      }, 30000);
      
      request.raw.on('close', () => {
        clearInterval(keepAlive);
      });
    });
    
    // Screenshot serving
    this.server.get('/api/sessions/:id/screenshots/:filename', this.getScreenshot.bind(this));
    
    // Docker container health check proxy
    this.server.get('/api/sessions/:id/health', this.getDockerHealth.bind(this));
    
    // Debug endpoint to check session existence and status
    this.server.get('/api/sessions/:id/debug', async (request, reply) => {
      const sessionId = (request.params as any).id;
      const session = this.sessions.get(sessionId);
      
      const debugInfo: any = {
        sessionId,
        exists: !!session,
        totalActiveSessions: this.sessions.size,
        activeSessions: Array.from(this.sessions.keys()),
        requestedAt: new Date().toISOString()
      };
      
      if (session) {
        debugInfo.sessionDetails = {
          status: session.status,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          hasDockerSession: !!session.dockerSession,
          dockerSessionDetails: session.dockerSession ? {
            containerId: session.dockerSession.containerId,
            port: session.dockerSession.port,
            apiUrl: session.dockerSession.apiUrl
          } : null,
          connectedSSEClients: session.sseClients.size,
          historyCount: session.history.length
        };
      }
      
      log.info(`[DEBUG] Session debug info for ${sessionId}: ${JSON.stringify(debugInfo, null, 2)}`);
      return reply.send(debugInfo);
    });
    
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
   * Register recovery mode routes
   */
  private registerRecoveryRoutes(): void {
    // Session-specific recovery endpoint
    this.server.post('/api/sessions/:sessionId/recovery', async (request, reply) => {
      try {
        const { sessionId } = request.params as { sessionId: string };
        const { optionId, customActions, context } = request.body as {
          optionId: string;
          customActions?: Array<{ type: string; [key: string]: unknown }>;
          context: any;
        };

        const session = this.sessions.get(sessionId);
        if (!session) {
          return reply.status(404).send({ error: 'Session not found' });
        }

        // Update session status
        session.status = 'running';
        
        // Store recovery selection for processing
        if (session.recoveryState) {
          session.recoveryState.resolved = true;
          session.recoveryState = {
            ...session.recoveryState,
            selectedOption: optionId,
            customActions
          };
        }

        // Broadcast recovery resolution to SSE clients
        session.sseClients.forEach(client => {
          client.send({
            type: 'recovery_resolved',
            optionId,
            customActions,
            context
          });
        });

        return reply.send({ success: true, message: 'Recovery option applied' });
      } catch (error) {
        log.error('Failed to apply recovery option', error as Error);
        return reply.status(500).send({ error: 'Failed to apply recovery option' });
      }
    });
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
          log.info(`Creating Docker browser session for ${dbSession.id}...`);
          dockerSession = await this.dockerBrowserService.createBrowserSession({
            startUrl,
            headless
          });
          log.info(`Docker session created successfully for ${dbSession.id}: ${dockerSession.apiUrl}`);
        } catch (error) {
          log.error('Failed to create Docker session:', error as Error);
          log.warn('Proceeding without Docker container, falling back to in-memory session');
          dockerSession = undefined;
        }
      } else {
        log.info('Docker disabled via USE_DOCKER=false, creating session without container');
      }
      
      // Create session in memory
      const session: Session = {
        id: dbSession.id,
        dockerSession,
        createdAt: dbSession.createdAt,
        lastActivity: new Date(), // Always use current time to prevent immediate cleanup
        status: dbSession.status as 'idle' | 'running' | 'error' | 'waiting_for_recovery',
        history: [],
        sseClients: new Set()
      };
      
      this.sessions.set(dbSession.id, session);
      
      // Also update database with current timestamp
      try {
        await this.databaseService.updateSession(dbSession.id, {
          lastActivity: session.lastActivity
        });
      } catch (dbUpdateError) {
        log.warn(`Failed to update session lastActivity in database: ${dbUpdateError}`);
      }
      
      const statusMessage = dockerSession 
        ? `Created session ${dbSession.id} with Docker container ${dockerSession.containerId} on port ${dockerSession.port}`
        : `Created session ${dbSession.id} without Docker (test mode or Docker unavailable)`;
      
      log.info(statusMessage);
      
      return reply.send({
        sessionId: dbSession.id,
        createdAt: session.createdAt,
        status: session.status,
        containerPort: dockerSession?.port,
        dockerAvailable: !!dockerSession,
        message: statusMessage
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
          
          // Get current page URL and title
          let pageUrl: string | undefined;
          let pageTitle: string | undefined;
          try {
            const response = await axios.post(`${session.dockerSession.apiUrl}/evaluate`, {
              script: '({ url: window.location.href, title: document.title })'
            });
            pageUrl = response.data?.result?.url;
            pageTitle = response.data?.result?.title;
          } catch (e) {
            log.debug('Could not get page info for screenshot');
          }
          
          // Save screenshot to database
          const savedScreenshot = await this.databaseService.saveScreenshot({
            sessionId,
            commandId: dbCommand?.id,
            filename: screenshotFilename,
            fullPath: screenshotPath,
            pageUrl,
            pageTitle,
            description: `Screenshot after command: ${command}`
          });
          
          log.info(`Screenshot captured and saved to DB: ${screenshotFilename} (URL: ${pageUrl || 'N/A'})`);
          
          // Broadcast screenshot event
          this.broadcastToSession(sessionId, {
            type: 'screenshot',
            filename: screenshotFilename,
            pageUrl,
            pageTitle
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
      historyCount: Array.isArray((dbSession as any).commands) ? (dbSession as any).commands.length : 0,
      connectedClients: memorySession?.sseClients.size || 0,
      commands: Array.isArray((dbSession as any).commands) ? (dbSession as any).commands : [],
      screenshots: Array.isArray((dbSession as any).screenshots) ? (dbSession as any).screenshots : [],
      // Include dockerSession info that WebRTC viewer expects
      dockerSession: memorySession?.dockerSession ? {
        containerId: memorySession.dockerSession.containerId,
        port: memorySession.dockerSession.port,
        apiUrl: memorySession.dockerSession.apiUrl
      } : null
    });
  }
  
  /**
   * Delete session
   */
  private async deleteSession(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const { id: sessionId } = request.params;
      const session = this.sessions.get(sessionId);
      
      if (!session) {
        return reply.status(404).send({ error: 'Session not found' });
      }
      
      // Clean up Docker container if exists
      if (session.dockerSession) {
        try {
          await this.dockerBrowserService.destroySession(session.dockerSession.containerId);
          log.info(`Docker container destroyed for session ${sessionId}`);
        } catch (error) {
          log.error(`Failed to destroy Docker container for session ${sessionId}:`, error as Error);
        }
      }
      
      // Mark session as inactive in database before removing from memory
      try {
        await this.databaseService.deactivateSession(sessionId);
        log.info(`Session ${sessionId} marked as inactive in database`);
      } catch (error) {
        log.error(`Failed to deactivate session ${sessionId} in database:`, error as Error);
      }
      
      // Clean up SSE clients
      session.sseClients.forEach(client => {
        // SSE clients are automatically cleaned up when connection closes
        client.send({ type: 'session_closing' });
      });
      
      // Remove from memory
      this.sessions.delete(sessionId);
      
      log.info(`Session ${sessionId} deleted successfully`);
      
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
    // Get sessions from database with includeInactive: false to hide inactive sessions
    const { sessions: dbSessions, total } = await this.databaseService.listSessions({
      includeInactive: false // Only show active sessions
    });
    
    // Enhance with memory state
    const sessions = dbSessions.map(dbSession => {
      const memorySession = this.sessions.get(dbSession.id);
      
      return {
        ...dbSession,
        connectedClients: memorySession?.sseClients.size || 0,
        status: memorySession?.status || dbSession.status,
        currentCommand: memorySession?.currentCommand,
        dockerAvailable: !!memorySession?.dockerSession,
        commandCount: Array.isArray((dbSession as any).commands) ? (dbSession as any).commands.length : 0,
        screenshotCount: Array.isArray((dbSession as any).screenshots) ? (dbSession as any).screenshots.length : 0,
        sequenceName: (dbSession as any).sequence?.name,
        isActive: memorySession !== undefined
      };
    });
    
    return reply.send({ sessions, total });
  }
  
  /**
   * Clear inactive sessions
   */
  private async clearInactiveSessions(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const now = Date.now();
      const timeout = this.IDLE_TIMEOUT_MS; // 5 minutes idle timeout
      const sessionsToDelete: string[] = [];

      // Find inactive memory sessions
      for (const [id, session] of this.sessions) {
        if (now - session.lastActivity.getTime() > timeout) {
          log.info(`Cleaning up inactive session ${id} (idle for ${Math.round((now - session.lastActivity.getTime()) / 1000 / 60)} minutes)`);
          sessionsToDelete.push(id);
        }
      }

      // Clean up memory sessions
      let deletedCount = 0;
      for (const sessionId of sessionsToDelete) {
        try {
          await this.deleteSession(
            { params: { id: sessionId } } as any,
            { send: () => {}, status: () => ({ send: () => {} }) } as any
          );
          deletedCount++;
        } catch (error) {
          log.error(`Failed to cleanup session ${sessionId}:`, error as Error);
        }
      }

      // Also clean up old database sessions (sessions older than 1 day)
      let dbCleanedCount = 0;
      try {
        dbCleanedCount = await this.databaseService.cleanupOldSessions(1);
        if (dbCleanedCount > 0) {
          log.info(`Cleaned up ${dbCleanedCount} old database sessions`);
        }
      } catch (error) {
        log.error('Failed to cleanup old database sessions:', error as Error);
      }

      return reply.send({ 
        success: true, 
        deletedCount, 
        databaseCleanedCount: dbCleanedCount,
        message: `Cleaned up ${deletedCount} active sessions and ${dbCleanedCount} old database sessions`
      });
    } catch (error) {
      log.error('Failed to clear inactive sessions', error as Error);
      return reply.status(500).send({ error: 'Failed to clear inactive sessions' });
    }
  }

  /**
   * Get screenshots from database for a session
   */
  private async getSessionScreenshots(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const { id } = request.params;
      const screenshots = await this.databaseService.getSessionScreenshots(id);
      
      return reply.send({
        screenshots: screenshots.map(s => ({
          id: s.id,
          filename: s.filename,
          capturedAt: s.capturedAt,
          pageUrl: s.pageUrl,
          pageTitle: s.pageTitle,
          description: s.description,
          relativePath: s.relativePath
        }))
      });
    } catch (error) {
      log.error('Failed to get session screenshots:', error as Error);
      return reply.status(500).send({ 
        error: 'Failed to get session screenshots' 
      });
    }
  }

  /**
   * Create WebRTC session for browser streaming
   */
  private async createWebRTCSession(
    request: FastifyRequest<{ Params: { id: string }; Body: { width?: number; height?: number } }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const { id: sessionId } = request.params;
      const { width, height } = request.body || {};
      
      // Check if session exists
      const session = this.sessions.get(sessionId);
      if (!session) {
        return reply.status(404).send({ error: 'Session not found' });
      }
      
      // Create WebRTC session via Browserless
      const webrtcSession = await browserlessService.createWebRTCSession(sessionId, {
        width,
        height,
        blockAds: true,
        stealth: true,
      });
      
      // Store WebRTC info in session
      session.webrtcViewerUrl = webrtcSession.viewerUrl;
      session.webrtcUrl = webrtcSession.webRTCUrl;
      
      return reply.send({
        success: true,
        viewerUrl: webrtcSession.viewerUrl,
        webrtcUrl: webrtcSession.webRTCUrl,
      });
    } catch (error) {
      log.error('Failed to create WebRTC session', error as Error);
      return reply.status(500).send({ error: 'Failed to create WebRTC session' });
    }
  }

  /**
   * Get WebRTC session info
   */
  private async getWebRTCSession(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const { id: sessionId } = request.params;
      
      const webrtcSession = browserlessService.getSession(sessionId);
      if (!webrtcSession) {
        return reply.status(404).send({ error: 'WebRTC session not found' });
      }
      
      return reply.send({
        success: true,
        viewerUrl: webrtcSession.viewerUrl,
        webrtcUrl: webrtcSession.webRTCUrl,
      });
    } catch (error) {
      log.error('Failed to get WebRTC session', error as Error);
      return reply.status(500).send({ error: 'Failed to get WebRTC session' });
    }
  }

  /**
   * Close WebRTC session
   */
  private async closeWebRTCSession(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const { id: sessionId } = request.params;
      
      await browserlessService.closeSession(sessionId);
      
      // Clear WebRTC info from session
      const session = this.sessions.get(sessionId);
      if (session) {
        delete session.webrtcViewerUrl;
        delete session.webrtcUrl;
      }
      
      return reply.send({ success: true });
    } catch (error) {
      log.error('Failed to close WebRTC session', error as Error);
      return reply.status(500).send({ error: 'Failed to close WebRTC session' });
    }
  }
  
  /**
   * Proxy WebRTC session creation to Docker container
   */
  private async proxyDockerWebRTCSession(
    request: FastifyRequest<{ 
      Params: { id: string };
      Body: any 
    }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const { id: sessionId } = request.params;
      const session = this.sessions.get(sessionId);
      
      if (!session || !session.dockerSession) {
        return reply.status(404).send({ 
          error: 'Docker session not available',
          details: 'Session does not exist or Docker container is not running'
        });
      }
      
      // Proxy the request to the Docker container
      try {
        const response = await axios.post(
          `${session.dockerSession.apiUrl}/webrtc`,
          request.body,
          { timeout: 10000 }
        );
        
        // Store WebRTC session ID for this session if provided
        if (response.data.webrtcId) {
          this.webrtcSessions.set(sessionId, response.data.webrtcId);
        }
        
        return reply.send(response.data);
      } catch (containerError: any) {
        // If container returns 501, forward it
        if (containerError.response?.status === 501) {
          return reply.status(501).send({
            error: 'WebRTC not implemented in container',
            details: containerError.response?.data?.message || 'WebRTC functionality is not yet available in the browser container',
            sessionId,
            dockerAvailable: true
          });
        }
        throw containerError;
      }
    } catch (error) {
      log.error('Failed to proxy create WebRTC session', error as Error);
      return reply.status(500).send({ 
        error: 'Failed to create WebRTC session',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  /**
   * Proxy WebRTC control messages to Docker container
   */
  private async proxyDockerWebRTCControl(
    request: FastifyRequest<{ 
      Params: { id: string; webrtcId: string };
      Body: any 
    }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const { id: sessionId, webrtcId } = request.params;
      const session = this.sessions.get(sessionId);
      
      if (!session || !session.dockerSession) {
        return reply.status(404).send({ 
          error: 'Docker session not available' 
        });
      }
      
      // Proxy the request to the Docker container
      try {
        const response = await axios.post(
          `${session.dockerSession.apiUrl}/webrtc/${webrtcId}/control`,
          request.body,
          { timeout: 5000 }
        );
        
        return reply.send(response.data);
      } catch (containerError: any) {
        // If container returns 501, forward it
        if (containerError.response?.status === 501) {
          return reply.status(501).send({
            error: 'WebRTC control not implemented in container',
            details: containerError.response?.data?.message || 'WebRTC control functionality is not yet available',
            sessionId,
            webrtcId
          });
        }
        throw containerError;
      }
    } catch (error) {
      log.error('Failed to proxy WebRTC control', error as Error);
      return reply.status(500).send({ 
        error: 'Failed to proxy WebRTC control',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
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
   * Get Docker container health status
   */
  private async getDockerHealth(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const sessionId = request.params.id;
      const session = this.sessions.get(sessionId);

      if (!session || !session.dockerSession) {
        return reply.status(404).send({ 
          error: 'Session not found or Docker session not available',
          status: false
        });
      }

      // Check both Docker container status and health endpoint
      const containerHealthy = await this.dockerBrowserService.checkDockerHealth(session.dockerSession.containerId);
      
      if (!containerHealthy) {
        return reply.send({
          sessionId,
          status: false,
          message: 'Docker container is not running or unhealthy'
        });
      }

      // Also check the health endpoint of the application inside the container
      try {
        const healthResponse = await axios.get(`${session.dockerSession.apiUrl}/health`, { 
          timeout: 3000 
        });
        
        const isAppHealthy = healthResponse.status === 200 && healthResponse.data?.status === 'ok';
        
        return reply.send({
          sessionId,
          status: isAppHealthy,
          message: isAppHealthy ? 'Docker container and application are healthy' : 'Docker container is running but application is not ready',
          containerStatus: containerHealthy,
          appStatus: isAppHealthy
        });
      } catch (appError) {
        return reply.send({
          sessionId,
          status: false,
          message: 'Docker container is running but application is not ready yet',
          containerStatus: containerHealthy,
          appStatus: false,
          appError: (appError as Error).message
        });
      }
    } catch (error) {
      log.error('Failed to get Docker health status', error as Error);
      return reply.status(500).send({ 
        error: 'Failed to get Docker health status',
        status: false
      });
    }
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
        status: dbSession.status as 'idle' | 'running' | 'error' | 'waiting_for_recovery',
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
   * Start comprehensive session cleanup timer
   */
  private startIdleCleanup(): void {
    this.cleanupInterval = setInterval(async () => {
      const now = Date.now();
      const timeout = this.IDLE_TIMEOUT_MS; // 5 minutes
      const sessionsToDelete: string[] = [];
      
      // Check memory sessions for cleanup
      for (const [id, session] of this.sessions) {
        if (now - session.lastActivity.getTime() > timeout) {
          log.info(`Cleaning up idle session ${id} (inactive for ${Math.round((now - session.lastActivity.getTime()) / 1000 / 60)} minutes)`);
          sessionsToDelete.push(id);
        }
      }
      
      // Clean up identified sessions
      for (const sessionId of sessionsToDelete) {
        try {
          await this.deleteSession(
            { params: { id: sessionId } } as any,
            { send: () => {}, status: () => ({ send: () => {} }) } as any
          );
        } catch (error) {
          log.error(`Failed to cleanup session ${sessionId}:`, error as Error);
        }
      }
      
      // Also clean up old database sessions (sessions older than 1 day)
      try {
        const cleanedCount = await this.databaseService.cleanupOldSessions(1);
        if (cleanedCount > 0) {
          log.info(`Cleaned up ${cleanedCount} old database sessions`);
        }
      } catch (error) {
        log.error('Failed to cleanup old database sessions:', error as Error);
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