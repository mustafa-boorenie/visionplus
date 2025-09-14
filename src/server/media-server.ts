import { MediaLayerService } from '../integrations/media/MediaLayerService';
import { DatabaseService } from '../integrations/database/DatabaseService';
import { log } from '../utils/logger';

async function startMediaLayerServer() {
  try {
    log.info('Starting Media Layer Server...');
    
    // Initialize database service
    const databaseService = DatabaseService.getInstance();
    
    // Initialize media layer service
    const mediaLayerService = new MediaLayerService(databaseService, 3003);
    
    // Start the service
    await mediaLayerService.start();
    
    // Graceful shutdown
    process.on('SIGTERM', async () => {
      log.info('SIGTERM received, shutting down media layer server...');
      await mediaLayerService.stop();
      await databaseService.disconnect();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      log.info('SIGINT received, shutting down media layer server...');
      await mediaLayerService.stop();
      await databaseService.disconnect();
      process.exit(0);
    });

    // Log media stats every 30 seconds
    setInterval(() => {
      const stats = mediaLayerService.getMediaStats();
      log.info(`[MediaLayer] Stats: ${JSON.stringify(stats)}`);
    }, 30000);
    
  } catch (error) {
    log.error('Failed to start media layer server:', error as Error);
    process.exit(1);
  }
}

// Start if this file is run directly
if (require.main === module) {
  startMediaLayerServer();
}

export { startMediaLayerServer }; 