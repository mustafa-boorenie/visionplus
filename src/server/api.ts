import fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs-extra';
import { IntelligentAutomation } from '../automation/IntelligentAutomation';
import { BrowserManager } from '../browser/BrowserManager';
import { SequenceManager } from '../utils/SequenceManager';
import { FeedbackManager } from '../feedback/FeedbackManager';
import { RulesEngine } from '../feedback/RulesEngine';
import { log } from '../utils/logger';
import { AutomationExecutionResult } from '../types';
import { v4 as uuidv4 } from 'uuid';
import csv from 'csv-parse';


/**
 * Workflow execution request
 */
interface WorkflowRequest {
  sequenceName?: string;
  prompt?: string;
  arguments?: Record<string, string>;
  csvData?: any[];
  startUrl?: string;
  options?: {
    headless?: boolean;
    timeout?: number;
    generateTests?: boolean;
  };
}

/**
 * Workflow execution status
 */
interface WorkflowStatus {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
  result?: AutomationExecutionResult;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  logs: string[];
}

/**
 * Automation API Server
 */
export class AutomationAPIServer {
  private server: FastifyInstance;
  private port: number;
  private sequenceManager: SequenceManager;
  private feedbackManager: FeedbackManager;
  private rulesEngine: RulesEngine;
  private browserManager: BrowserManager;
  private workflows: Map<string, WorkflowStatus> = new Map();
  
  constructor(port: number = 3000) {
    this.port = port;
    this.server = fastify({
      logger: true,
      bodyLimit: 10 * 1024 * 1024 // 10MB for file uploads
    });
    
    this.sequenceManager = new SequenceManager();
    this.feedbackManager = new FeedbackManager();
    this.rulesEngine = new RulesEngine();
    this.browserManager = BrowserManager.getInstance();
  }
  
  /**
   * Initialize server and routes
   */
  async initialize(): Promise<void> {
    // Initialize managers
    await this.sequenceManager.initialize();
    await this.feedbackManager.initialize();
    await this.rulesEngine.initialize();
    
    // Register plugins
    await this.server.register(fastifyCors, {
      origin: true,
      credentials: true
    });
    
    await this.server.register(fastifyMultipart, {
      limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
      }
    });
    
    // Serve static files (for frontend if needed)
    await this.server.register(fastifyStatic, {
      root: path.join(__dirname, '../../public'),
      prefix: '/public/'
    });
    
    // Register routes
    this.registerRoutes();
    
    // Error handler
    this.server.setErrorHandler((error: any, _request: any, reply: any) => {
      log.error('Server error', error);
      reply.status(500).send({ error: 'Internal server error', message: error.message });
    });
  }
  
  /**
   * Register API routes
   */
  private registerRoutes(): void {
    // Health check
    this.server.get('/health', async (request, reply) => {
      return { status: 'healthy', timestamp: new Date() };
    });
    
    // Workflow endpoints
    this.server.post('/api/workflows/run', this.runWorkflow.bind(this));
    this.server.get('/api/workflows/:id/status', this.getWorkflowStatus.bind(this));
    this.server.get('/api/workflows', this.listWorkflows.bind(this));
    this.server.post('/api/workflows/:id/cancel', this.cancelWorkflow.bind(this));
    
    // Sequence management
    this.server.get('/api/sequences', this.listSequences.bind(this));
    this.server.get('/api/sequences/:name', this.getSequence.bind(this));
    this.server.post('/api/sequences', this.saveSequence.bind(this));
    this.server.delete('/api/sequences/:name', this.deleteSequence.bind(this));
    this.server.get('/api/sequences/:name/arguments', this.getSequenceArguments.bind(this));
    
    // File upload
    this.server.post('/api/upload/csv', this.uploadCSV.bind(this));
    
    // Learning & feedback
    this.server.get('/api/feedback/patterns', this.getLearningPatterns.bind(this));
    this.server.post('/api/feedback/train', this.generateTrainingData.bind(this));
    this.server.get('/api/rules', this.getRules.bind(this));
    this.server.post('/api/rules', this.addRule.bind(this));
    
    // Browser management
    this.server.get('/api/browser/screenshot', this.getScreenshot.bind(this));
    this.server.post('/api/browser/reset', this.resetBrowser.bind(this));
  }
  
  /**
   * Run a workflow
   */
  private async runWorkflow(
    request: FastifyRequest<{ Body: WorkflowRequest }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const { sequenceName, prompt, arguments: args, csvData, startUrl, options } = request.body;
      
      // Validate request
      if (!sequenceName && !prompt) {
        return reply.status(400).send({ error: 'Either sequenceName or prompt is required' });
      }
      
      // Create workflow ID
      const workflowId = uuidv4();
      const workflowStatus: WorkflowStatus = {
        id: workflowId,
        status: 'pending',
        startedAt: new Date(),
        logs: []
      };
      
      this.workflows.set(workflowId, workflowStatus);
      
      // Start workflow asynchronously
      this.executeWorkflow(workflowId, request.body).catch(error => {
        log.error(`Workflow ${workflowId} failed`, error);
        const status = this.workflows.get(workflowId);
        if (status) {
          status.status = 'failed';
          status.error = error.message;
          status.completedAt = new Date();
        }
      });
      
      return reply.send({ workflowId, status: 'started' });
    } catch (error) {
      log.error('Failed to start workflow', error as Error);
      return reply.status(500).send({ error: 'Failed to start workflow' });
    }
  }
  
  /**
   * Execute workflow asynchronously
   */
  private async executeWorkflow(workflowId: string, request: WorkflowRequest): Promise<void> {
    const status = this.workflows.get(workflowId);
    if (!status) return;
    
    status.status = 'running';
    
    try {
      let automation: IntelligentAutomation;
      let taskPrompt = request.prompt || '';
      
      // If using a sequence, load it
      if (request.sequenceName) {
        const sequence = await this.sequenceManager.loadSequence(request.sequenceName);
        if (!sequence) {
          throw new Error(`Sequence "${request.sequenceName}" not found`);
        }
        
        // Substitute arguments if provided
        if (request.arguments) {
          const substituted = this.sequenceManager.substituteArgumentsInSequence(
            sequence,
            request.arguments
          );
          taskPrompt = substituted.originalPrompt;
        } else {
          taskPrompt = sequence.originalPrompt;
        }
      }
      
      // Process CSV data if provided
      if (request.csvData && request.csvData.length > 0) {
        // Run workflow for each row in CSV
        for (let i = 0; i < request.csvData.length; i++) {
          const row = request.csvData[i];
          status.progress = Math.round((i / request.csvData.length) * 100);
          
          // Substitute CSV row values into prompt
          let rowPrompt = taskPrompt;
          Object.entries(row).forEach(([key, value]) => {
            rowPrompt = rowPrompt.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
          });
          
          // Create automation instance
          const browser = await this.browserManager.getBrowser();
          automation = new IntelligentAutomation(browser, rowPrompt, true, false, !!request.sequenceName);
          
          // Execute
          const result = await automation.execute(request.startUrl || '');
          
          // Log result
          status.logs.push(`Row ${i + 1}: ${result.success ? 'Success' : 'Failed'}`);
          
          // Update sequence history if using one
          if (request.sequenceName) {
            await this.sequenceManager.updateSequenceHistory(request.sequenceName, result);
          }
        }
      } else {
        // Single execution
        const browser = await this.browserManager.getBrowser();
        automation = new IntelligentAutomation(browser, taskPrompt, true, false, !!request.sequenceName);
        
        const result = await automation.execute(request.startUrl || '');
        status.result = result;
        
        // Update sequence history if using one
        if (request.sequenceName) {
          await this.sequenceManager.updateSequenceHistory(request.sequenceName, result);
        }
        
        // Generate training data if learning is enabled
        if (result.success) {
          await this.feedbackManager.generateTrainingData();
        }
      }
      
      status.status = 'completed';
      status.completedAt = new Date();
      status.progress = 100;
      
    } catch (error) {
      status.status = 'failed';
      status.error = error instanceof Error ? error.message : String(error);
      status.completedAt = new Date();
      throw error;
    }
  }
  
  /**
   * Get workflow status
   */
  private async getWorkflowStatus(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<any> {
    const status = this.workflows.get(request.params.id);
    
    if (!status) {
      return reply.status(404).send({ error: 'Workflow not found' });
    }
    
    return reply.send(status);
  }
  
  /**
   * List all workflows
   */
  private async listWorkflows(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    const workflows = Array.from(this.workflows.values())
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, 100); // Limit to last 100
      
    return reply.send({ workflows });
  }
  
  /**
   * Cancel a workflow
   */
  private async cancelWorkflow(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<any> {
    const status = this.workflows.get(request.params.id);
    
    if (!status) {
      return reply.status(404).send({ error: 'Workflow not found' });
    }
    
    if (status.status !== 'running') {
      return reply.status(400).send({ error: 'Workflow is not running' });
    }
    
    // TODO: Implement actual cancellation logic
    status.status = 'failed';
    status.error = 'Cancelled by user';
    status.completedAt = new Date();
    
    return reply.send({ message: 'Workflow cancelled' });
  }
  
  /**
   * List sequences
   */
  private async listSequences(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    const sequences = await this.sequenceManager.listSequences();
    return reply.send({ sequences });
  }
  
  /**
   * Get a specific sequence
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
   * Save a new sequence
   */
  private async saveSequence(
    request: FastifyRequest<{ Body: any }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      const { name, originalPrompt, executionResult, options } = request.body as any;
      
      const sequence = await this.sequenceManager.saveSequence(
        name,
        originalPrompt,
        executionResult,
        options
      );
      
      return reply.send(sequence);
    } catch (error) {
      log.error('Failed to save sequence', error as Error);
      return reply.status(500).send({ error: 'Failed to save sequence' });
    }
  }
  
  /**
   * Delete a sequence
   */
  private async deleteSequence(
    request: FastifyRequest<{ Params: { name: string } }>,
    reply: FastifyReply
  ): Promise<any> {
    const success = await this.sequenceManager.deleteSequence(request.params.name);
    
    if (!success) {
      return reply.status(404).send({ error: 'Sequence not found' });
    }
    
    return reply.send({ message: 'Sequence deleted' });
  }
  
  /**
   * Get sequence arguments
   */
  private async getSequenceArguments(
    request: FastifyRequest<{ Params: { name: string } }>,
    reply: FastifyReply
  ): Promise<any> {
    const sequence = await this.sequenceManager.loadSequence(request.params.name);
    
    if (!sequence) {
      return reply.status(404).send({ error: 'Sequence not found' });
    }
    
    const args = this.sequenceManager.extractArgumentsFromSequence(sequence);
    return reply.send({ arguments: args });
  }
  
  /**
   * Upload CSV file
   */
  private async uploadCSV(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    try {
      const data = await request.file();
      
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }
      
      const buffer = await data.toBuffer();
      const content = buffer.toString('utf-8');
      
      // Parse CSV
      const records = await new Promise<any[]>((resolve, reject) => {
        csv.parse(content, {
          columns: true,
          skip_empty_lines: true
        }, (err, records) => {
          if (err) reject(err);
          else resolve(records);
        });
      });
      
      return reply.send({ 
        message: 'CSV uploaded successfully',
        rows: records.length,
        columns: Object.keys(records[0] || {}),
        data: records
      });
    } catch (error) {
      log.error('Failed to upload CSV', error as Error);
      return reply.status(500).send({ error: 'Failed to parse CSV' });
    }
  }
  
  /**
   * Get learning patterns
   */
  private async getLearningPatterns(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    const patterns = await this.feedbackManager.getLearningPatterns();
    return reply.send({ patterns });
  }
  
  /**
   * Generate training data
   */
  private async generateTrainingData(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    const trainingData = await this.feedbackManager.generateTrainingData();
    return reply.send({ 
      message: 'Training data generated',
      conversations: trainingData.conversations.length
    });
  }
  
  /**
   * Get automation rules
   */
  private async getRules(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    const rules = await this.rulesEngine.exportRules();
    return reply.send({ rules });
  }
  
  /**
   * Add a new rule
   */
  private async addRule(
    request: FastifyRequest<{ Body: any }>,
    reply: FastifyReply
  ): Promise<any> {
    try {
      await this.rulesEngine.addRule(request.body as any);
      return reply.send({ message: 'Rule added successfully' });
    } catch (error) {
      log.error('Failed to add rule', error as Error);
      return reply.status(500).send({ error: 'Failed to add rule' });
    }
  }
  
  /**
   * Get current browser screenshot
   */
  private async getScreenshot(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    try {
      const browser = this.browserManager.getCurrentBrowser();
      
      if (!browser) {
        return reply.status(400).send({ error: 'No browser session active' });
      }
      
      const screenshotPath = await browser.takeScreenshot('api-screenshot');
      const buffer = await fs.readFile(screenshotPath);
      
      reply.type('image/png');
      return reply.send(buffer);
    } catch (error) {
      log.error('Failed to get screenshot', error as Error);
      return reply.status(500).send({ error: 'Failed to get screenshot' });
    }
  }
  
  /**
   * Reset browser
   */
  private async resetBrowser(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    try {
      await this.browserManager.closeBrowser();
      return reply.send({ message: 'Browser reset successfully' });
    } catch (error) {
      log.error('Failed to reset browser', error as Error);
      return reply.status(500).send({ error: 'Failed to reset browser' });
    }
  }
  
  /**
   * Start the server
   */
  async start(): Promise<void> {
    try {
      await this.server.listen({ port: this.port, host: '0.0.0.0' });
      log.info(`Automation API server listening on port ${this.port}`);
    } catch (error) {
      log.error('Failed to start server', error as Error);
      throw error;
    }
  }
  
  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    await this.server.close();
    // Close browser if exists
    const browser = this.browserManager.getCurrentBrowser();
    if (browser) {
      await browser.close();
    }
    log.info('Automation API server stopped');
  }
} 