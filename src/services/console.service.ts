import { DatabaseService } from './database.service';
import { log } from '../utils/logger';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'success';
export type LogSource = 'system' | 'automation' | 'browser' | 'user';

export interface ConsoleLogEntry {
  id?: string;
  sessionId: string;
  commandId?: string;
  level: LogLevel;
  message: string;
  data?: any;
  source?: LogSource;
  createdAt?: Date;
}

/**
 * Service for managing session-specific console logs
 */
export class ConsoleService {
  private static instance: ConsoleService;
  private databaseService: DatabaseService;
  private sessionClients: Map<string, Set<{ send: (data: any) => void }>> = new Map();

  private constructor() {
    this.databaseService = DatabaseService.getInstance();
  }

  public static getInstance(): ConsoleService {
    if (!ConsoleService.instance) {
      ConsoleService.instance = new ConsoleService();
    }
    return ConsoleService.instance;
  }

  /**
   * Add SSE client for session-specific console streaming
   */
  public addSessionClient(sessionId: string, client: { send: (data: any) => void }): void {
    if (!this.sessionClients.has(sessionId)) {
      this.sessionClients.set(sessionId, new Set());
    }
    this.sessionClients.get(sessionId)!.add(client);
    log.info(`[CONSOLE] Client connected for session ${sessionId}`);
  }

  /**
   * Remove SSE client for session
   */
  public removeSessionClient(sessionId: string, client: { send: (data: any) => void }): void {
    const clients = this.sessionClients.get(sessionId);
    if (clients) {
      clients.delete(client);
      if (clients.size === 0) {
        this.sessionClients.delete(sessionId);
      }
    }
    log.info(`[CONSOLE] Client disconnected from session ${sessionId}`);
  }

  /**
   * Log a message for a specific session
   */
  public async logToSession(logEntry: ConsoleLogEntry): Promise<void> {
    try {
      // Persist to database
      const savedLog = await this.databaseService.createConsoleLog({
        sessionId: logEntry.sessionId,
        commandId: logEntry.commandId,
        level: logEntry.level,
        message: logEntry.message,
        data: logEntry.data,
        source: logEntry.source || 'system'
      });

      // Broadcast to connected SSE clients for this session
      const clients = this.sessionClients.get(logEntry.sessionId);
      if (clients && clients.size > 0) {
        const logData = {
          type: 'console_log',
          log: {
            id: savedLog.id,
            level: logEntry.level,
            message: logEntry.message,
            data: logEntry.data,
            source: logEntry.source || 'system',
            timestamp: savedLog.createdAt
          }
        };

        clients.forEach(client => {
          try {
            client.send(logData);
          } catch (error) {
            log.error(`[CONSOLE] Failed to send log to client for session ${logEntry.sessionId}:`, error as Error);
          }
        });
      }

      // Also log to server console for debugging
      this.logToServerConsole(logEntry);

    } catch (error) {
      log.error(`[CONSOLE] Failed to persist console log for session ${logEntry.sessionId}:`, error as Error);
      // Still broadcast to clients even if DB fails
      this.broadcastToClients(logEntry);
    }
  }

  /**
   * Broadcast log to connected clients even if DB is unavailable
   */
  private broadcastToClients(logEntry: ConsoleLogEntry): void {
    const clients = this.sessionClients.get(logEntry.sessionId);
    if (clients && clients.size > 0) {
      const logData = {
        type: 'console_log',
        log: {
          id: 'temp-' + Date.now(),
          level: logEntry.level,
          message: logEntry.message,
          data: logEntry.data,
          source: logEntry.source || 'system',
          timestamp: new Date()
        }
      };

      clients.forEach(client => {
        try {
          client.send(logData);
        } catch (error) {
          log.error(`[CONSOLE] Failed to send log to client for session ${logEntry.sessionId}:`, error as Error);
        }
      });
    }
  }

  /**
   * Log to server console with session context
   */
  private logToServerConsole(logEntry: ConsoleLogEntry): void {
    const prefix = `[SESSION:${logEntry.sessionId.substring(0, 8)}]`;
    const message = `${prefix} ${logEntry.message}`;

    switch (logEntry.level) {
      case 'error':
        log.error(message);
        break;
      case 'warn':
        log.warn(message);
        break;
      case 'debug':
        log.debug(message);
        break;
      case 'success':
      case 'info':
      default:
        log.info(message);
        break;
    }
  }

  /**
   * Get console log history for a session
   */
  public async getSessionLogs(sessionId: string, limit: number = 100, commandId?: string): Promise<ConsoleLogEntry[]> {
    try {
      const dbLogs = await this.databaseService.getConsoleLogsBySession(sessionId, limit, commandId);
      // Convert DB response to ConsoleLogEntry format
      return dbLogs.map(log => ({
        id: log.id,
        sessionId: log.sessionId,
        commandId: log.commandId || undefined,
        level: log.level as LogLevel,
        message: log.message,
        data: log.data,
        source: log.source as LogSource || undefined,
        createdAt: log.createdAt
      }));
    } catch (error) {
      log.error(`[CONSOLE] Failed to get session logs for ${sessionId}:`);
      return [];
    }
  }

  /**
   * Clean up clients for a session (when session is deleted)
   */
  public cleanupSession(sessionId: string): void {
    this.sessionClients.delete(sessionId);
    log.info(`[CONSOLE] Cleaned up console clients for session ${sessionId}`);
  }

  /**
   * Convenience methods for different log levels
   */
  public async info(sessionId: string, message: string, data?: any, commandId?: string, source?: LogSource): Promise<void> {
    await this.logToSession({ sessionId, commandId, level: 'info', message, data, source });
  }

  public async warn(sessionId: string, message: string, data?: any, commandId?: string, source?: LogSource): Promise<void> {
    await this.logToSession({ sessionId, commandId, level: 'warn', message, data, source });
  }

  public async error(sessionId: string, message: string, data?: any, commandId?: string, source?: LogSource): Promise<void> {
    await this.logToSession({ sessionId, commandId, level: 'error', message, data, source });
  }

  public async debug(sessionId: string, message: string, data?: any, commandId?: string, source?: LogSource): Promise<void> {
    await this.logToSession({ sessionId, commandId, level: 'debug', message, data, source });
  }

  public async success(sessionId: string, message: string, data?: any, commandId?: string, source?: LogSource): Promise<void> {
    await this.logToSession({ sessionId, commandId, level: 'success', message, data, source });
  }
}