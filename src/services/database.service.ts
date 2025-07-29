import { PrismaClient, Session, Command, Screenshot, Sequence } from '@prisma/client';
import { log } from '../utils/logger';
import { AutomationScript, AutomationExecutionResult, BrowserAction } from '../types';
import path from 'path';

/**
 * Database service for managing sessions, commands, and screenshots
 */
export class DatabaseService {
  private prisma: PrismaClient;
  private static instance: DatabaseService;

  private constructor() {
    this.prisma = new PrismaClient({
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'event' },
        { level: 'warn', emit: 'event' },
      ],
    });

          // Database logging disabled due to type issues
      // TODO: Re-enable proper database query logging
  }

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async connect(): Promise<void> {
    try {
      await this.prisma.$connect();
      log.info('Database connected successfully');
    } catch (error) {
      log.error('Failed to connect to database', error as Error);
      log.warn('Server will continue without database functionality');
      // Don't throw - allow server to start without database
    }
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  // Session Management
  async createSession(data: {
    startUrl?: string;
    sequenceId?: string;
  }): Promise<Session> {
    return await this.prisma.session.create({
      data: {
        startUrl: data.startUrl,
        sequenceId: data.sequenceId,
        currentUrl: data.startUrl,
      },
    });
  }

  async getSession(id: string): Promise<Session | null> {
    return await this.prisma.session.findUnique({
      where: { id },
      include: {
        commands: {
          include: {
            steps: true,
            screenshots: true,
          },
          orderBy: { startedAt: 'asc' },
        },
        screenshots: {
          orderBy: { capturedAt: 'asc' },
        },
        sequence: true,
      },
    });
  }

  async updateSession(id: string, data: {
    status?: string;
    currentUrl?: string;
    lastActivity?: Date;
  }): Promise<Session> {
    return await this.prisma.session.update({
      where: { id },
      data: {
        ...data,
        lastActivity: data.lastActivity || new Date(),
      },
    });
  }

  async listSessions(options?: {
    limit?: number;
    offset?: number;
    status?: string;
    includeInactive?: boolean;
  }): Promise<{ sessions: Session[]; total: number }> {
    const where = {
      ...(options?.status && { status: options.status }),
      ...(options?.includeInactive === false && { isActive: true }),
    };

    const [sessions, total] = await Promise.all([
      this.prisma.session.findMany({
        where,
        include: {
          commands: {
            select: { id: true },
          },
          screenshots: {
            select: { id: true },
          },
          sequence: {
            select: { name: true, description: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      this.prisma.session.count({ where }),
    ]);

    return { sessions, total };
  }

  async deactivateSession(id: string): Promise<void> {
    await this.prisma.session.update({
      where: { id },
      data: { isActive: false, status: 'completed' },
    });
  }

  // Command Management
  async createCommand(sessionId: string, data: {
    command: string;
    arguments?: Record<string, any>;
  }): Promise<Command> {
    return await this.prisma.command.create({
      data: {
        sessionId,
        command: data.command,
        arguments: data.arguments || {},
      },
    });
  }

  async updateCommand(id: string, data: {
    success: boolean;
    executionTime: number;
    errors?: string[];
    result?: any;
    completedAt?: Date;
  }): Promise<Command> {
    return await this.prisma.command.update({
      where: { id },
      data: {
        success: data.success,
        executionTime: data.executionTime,
        errors: data.errors || [],
        result: data.result || {},
        completedAt: data.completedAt || new Date(),
      },
    });
  }

  async createCommandSteps(commandId: string, steps: Array<{
    stepNumber: number;
    description: string;
    action: BrowserAction;
  }>): Promise<void> {
    await this.prisma.commandStep.createMany({
      data: steps.map(step => ({
        commandId,
        stepNumber: step.stepNumber,
        description: step.description,
        action: step.action as any,
      })),
    });
  }

  async updateCommandStep(commandId: string, stepNumber: number, data: {
    completed: boolean;
    duration?: number;
    error?: string;
    retryCount?: number;
  }): Promise<void> {
    await this.prisma.commandStep.update({
      where: {
        commandId_stepNumber: {
          commandId,
          stepNumber,
        },
      },
      data,
    });
  }

  // Screenshot Management
  async saveScreenshot(data: {
    sessionId: string;
    commandId?: string;
    filename: string;
    fullPath: string;
    pageUrl?: string;
    pageTitle?: string;
    description?: string;
  }): Promise<Screenshot> {
    const relativePath = path.relative(process.cwd(), data.fullPath);
    
    return await this.prisma.screenshot.create({
      data: {
        sessionId: data.sessionId,
        commandId: data.commandId,
        filename: data.filename,
        fullPath: data.fullPath,
        relativePath,
        pageUrl: data.pageUrl,
        pageTitle: data.pageTitle,
        description: data.description,
      },
    });
  }

  async getScreenshot(id: string): Promise<Screenshot | null> {
    return await this.prisma.screenshot.findUnique({
      where: { id },
    });
  }

  async getSessionScreenshots(sessionId: string): Promise<Screenshot[]> {
    return await this.prisma.screenshot.findMany({
      where: { sessionId },
      orderBy: { capturedAt: 'asc' },
    });
  }

  // Sequence Management
  async saveSequence(data: {
    name: string;
    description?: string;
    category?: string;
    tags?: string[];
    originalPrompt: string;
    script: AutomationScript;
    url?: string;
  }): Promise<Sequence> {
    return await this.prisma.sequence.create({
      data: {
        name: data.name,
        description: data.description,
        category: data.category,
        tags: data.tags || [],
        originalPrompt: data.originalPrompt,
        script: data.script as any,
        url: data.url || data.script.url,
      },
    });
  }

  async updateSequence(name: string, data: {
    description?: string;
    category?: string;
    tags?: string[];
    script?: AutomationScript;
    url?: string;
  }): Promise<Sequence> {
    return await this.prisma.sequence.update({
      where: { name },
      data: {
        ...(data.description && { description: data.description }),
        ...(data.category && { category: data.category }),
        ...(data.tags && { tags: data.tags }),
        ...(data.script && { scriptJson: data.script as any }),
        ...(data.url && { url: data.url }),
        updatedAt: new Date(),
      },
    });
  }

  async getSequence(name: string): Promise<Sequence | null> {
    return await this.prisma.sequence.findUnique({
      where: { name },
      include: {
        executions: {
          orderBy: { executedAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  async listSequences(options?: {
    category?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ sequences: Sequence[]; total: number }> {
    const where = {
      ...(options?.category && { category: options.category }),
      ...(options?.search && {
        OR: [
          { name: { contains: options.search, mode: 'insensitive' as const } },
          { description: { contains: options.search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [sequences, total] = await Promise.all([
      this.prisma.sequence.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      this.prisma.sequence.count({ where }),
    ]);

    return { sequences, total };
  }

  async deleteSequence(name: string): Promise<void> {
    await this.prisma.sequence.delete({
      where: { name },
    });
  }

  async recordSequenceExecution(sequenceId: string, result: {
    success: boolean;
    executionTime: number;
    errors: string[];
  }): Promise<void> {
    // Create execution record
    await this.prisma.sequenceExecution.create({
      data: {
        sequenceId,
        success: result.success,
        executionTime: result.executionTime,
        errors: result.errors,
      },
    });

    // Update sequence statistics
    const executions = await this.prisma.sequenceExecution.findMany({
      where: { sequenceId },
      select: { success: true },
    });

    const successCount = executions.filter(e => e.success).length;
    const successRate = executions.length > 0 ? (successCount / executions.length) * 100 : 0;

    await this.prisma.sequence.update({
      where: { id: sequenceId },
      data: {
        usageCount: { increment: 1 },
        successRate,
      },
    });
  }

  // Feedback Management
  async saveFeedback(data: {
    actionType: string;
    selector?: string;
    pageUrl?: string;
    elementFound?: boolean;
    success: boolean;
    errorMessage?: string;
    recoveryAttempt?: any;
    suggestedSelector?: string;
  }): Promise<void> {
    await this.prisma.feedback.create({
      data: {
        actionType: data.actionType,
        selector: data.selector,
        pageUrl: data.pageUrl,
        elementFound: data.elementFound,
        success: data.success,
        errorMessage: data.errorMessage,
        recoveryAttempt: data.recoveryAttempt,
        suggestedSelector: data.suggestedSelector,
      },
    });
  }

  // Helper method to clean up old sessions
  async cleanupOldSessions(daysToKeep: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.prisma.session.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        isActive: false,
      },
    });

    return result.count;
  }
} 