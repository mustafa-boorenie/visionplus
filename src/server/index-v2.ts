import { EnhancedAPIServer } from './api-v2';
import { log } from '../utils/logger';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

/**
 * Start the enhanced server
 */
async function startServer(): Promise<void> {
  try {
    const port = parseInt(process.env.PORT || '3002');
    log.info('Starting Enhanced Automation API Server...');
    log.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Create server instance
    const server = new EnhancedAPIServer(port);
    
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