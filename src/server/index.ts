import { EnhancedAPIServer } from './api-v2';
import { log } from '../utils/logger';
import { env } from '../config/environment';

/**
 * Server configuration
 */
interface ServerConfig {
  port: number;
  host: string;
  cors: {
    origin: string | string[] | boolean;
    credentials: boolean;
  };
  deployment: {
    mode: 'development' | 'production';
    ssl?: {
      key: string;
      cert: string;
    };
    pm2?: {
      instances: number;
      maxMemory: string;
    };
  };
}

/**
 * Default configuration
 */
const defaultConfig: ServerConfig = {
  port: env.PORT,
  host: '0.0.0.0',
  cors: {
    origin: true,
    credentials: true
  },
  deployment: {
    mode: env.NODE_ENV as 'development' | 'production'
  }
};

/**
 * Start the server
 */
async function startServer(): Promise<void> {
  try {
    log.info('Starting Automation API Server...');
    log.info(`Environment: ${defaultConfig.deployment.mode}`);
    
    // Create server instance
    const server = new EnhancedAPIServer(defaultConfig.port);
    
    // Initialize server
    await server.initialize();
    
    // Start server
    await server.start();
    
    // Graceful shutdown
    const shutdown = async (signal: string) => {
      log.info(`Received ${signal}, shutting down gracefully...`);
      try {
        await server.stop();
        process.exit(0);
      } catch (error) {
        log.error('Error during shutdown', error as Error);
        process.exit(1);
      }
    };
    
    // Handle shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      log.error('Uncaught exception', error);
      shutdown('uncaughtException');
    });
    
    process.on('unhandledRejection', (error) => {
      log.error('Unhandled rejection', error as Error);
      shutdown('unhandledRejection');
    });
    
  } catch (error) {
    log.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

// Start the server
startServer(); 