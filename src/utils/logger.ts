import winston from 'winston';
import path from 'path';
import { Config } from './config';

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
  }
}; 