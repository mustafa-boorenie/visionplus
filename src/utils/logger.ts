import winston from 'winston';
import path from 'path';
import { Config } from './config';
import chalk from 'chalk';

const { combine, timestamp, printf, colorize, errors } = winston.format;

/**
 * Custom log format
 */
const logFormat = printf(({ level, message, timestamp, stack }) => {
  const log = `${timestamp} [${level}]: ${message}`;
  return stack ? `${log}\n${stack}` : log;
});

/**
 * Create and configure Winston logger
 */
export const logger = winston.createLogger({
  level: Config.LOGGER_CONFIG.level,
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    // Console transport
    new winston.transports.Console({
      format: combine(
        colorize(),
        logFormat
      )
    }),
    // File transport for errors
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

/**
 * Enhanced logging for automation steps
 */
export interface StepLogContext {
  stepIndex: number;
  totalSteps: number;
  stepDescription: string;
  action?: any;
  pageUrl?: string;
  pageTitle?: string;
  htmlLength?: number;
  screenshotPath?: string;
  error?: any;
  retryCount?: number;
  duration?: number;
  selectorCandidates?: string[];
  elementFound?: boolean;
}

/**
 * Mask sensitive data in action objects for logging
 */
function maskSensitiveAction(action: any): any {
  if (!action) return action;
  
  // Deep clone to avoid mutating original
  const maskedAction = JSON.parse(JSON.stringify(action));
  
  // Mask password fields in type actions
  if (maskedAction.type === 'type' && maskedAction.text) {
    // Check if selector indicates password field
    const isPasswordField = 
      (typeof maskedAction.selector === 'string' && maskedAction.selector.includes('password')) ||
      (Array.isArray(maskedAction.selector) && maskedAction.selector.some((s: string) => s.includes('password')));
    
    if (isPasswordField) {
      maskedAction.text = '[MASKED]';
    }
  }
  
  return maskedAction;
}

/**
 * Log detailed step execution
 */
function logStep(context: StepLogContext): void {
  const prefix = `[STEP ${context.stepIndex}/${context.totalSteps}]`;
  
  // Mask sensitive data in action for logging
  const maskedAction = maskSensitiveAction(context.action);
  
  if (context.error) {
    console.error(
      chalk.red(`${prefix} ❌ ${context.stepDescription}`),
      {
        action: maskedAction,
        error: context.error,
        retryCount: context.retryCount,
        pageUrl: context.pageUrl,
        screenshotPath: context.screenshotPath
      }
    );
  } else {
    console.info(
      chalk.green(`${prefix} ✓ ${context.stepDescription}`),
      {
        action: maskedAction,
        duration: context.duration,
        pageUrl: context.pageUrl,
        elementFound: context.elementFound
      }
    );
  }
}

/**
 * Log recovery attempt
 */
function logRecovery(message: string, details: any): void {
  console.info(
    chalk.yellow(`[RECOVERY] ${message}`),
    details
  );
}

/**
 * Log utilities
 */
export const log = {
  error: (message: string, error?: Error) => {
    logger.error(message, error);
  },
  
  warn: (message: string) => {
    logger.warn(message);
  },
  
  info: (message: string) => {
    logger.info(message);
  },
  
  debug: (message: string) => {
    logger.debug(message);
  },
  
  /**
   * Log browser action
   */
  action: (action: string, details?: any) => {
    logger.info(`[ACTION] ${action}`, details ? { details } : undefined);
  },
  
  /**
   * Log vision analysis
   */
  vision: (action: string, details?: any) => {
    logger.info(`[VISION] ${action}`, details ? { details } : undefined);
  },
  
  /**
   * Log performance metrics
   */
  performance: (operation: string, duration: number) => {
    logger.info(`[PERFORMANCE] ${operation} completed in ${duration}ms`);
  },

  /**
   * Log detailed step execution
   */
  step: logStep,

  /**
   * Log recovery attempt
   */
  recovery: logRecovery
}; 