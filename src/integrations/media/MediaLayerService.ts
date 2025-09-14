import express from 'express';
import http from 'http';
import socketIo from 'socket.io';
import path from 'path';
import fs from 'fs-extra';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';
import helmet from 'helmet';
import { log } from '../../utils/logger';
import { DatabaseService } from '../database/DatabaseService';

// TODO: Refactor this service to use Fastify instead of Express

interface MediaSession {
  id: string;
  sessionId: string;
  type: 'screenshot' | 'stream' | 'recording';
  format: string;
  metadata: {
    width?: number;
    height?: number;
    frameRate?: number;
    duration?: number;
    fileSize?: number;
    pageUrl?: string;
    pageTitle?: string;
  };
  createdAt: Date;
  lastAccessedAt: Date;
  active: boolean;
}

interface StreamSession {
  id: string;
  sessionId: string;
  clients: Set<string>;
  quality: 'low' | 'medium' | 'high';
  frameRate: number;
  active: boolean;
  lastFrame?: Buffer;
  frameCount: number;
}

export class MediaLayerService {
  private app: express.Application;
  private server: http.Server;
  private io: socketIo.Server;
  private databaseService: DatabaseService;
  
  private mediaSessions = new Map<string, MediaSession>();
  private streamSessions = new Map<string, StreamSession>();
  private mediaBasePath: string;
  private port: number;

  constructor(databaseService: DatabaseService, port: number = 3003) {
    this.databaseService = databaseService;
    this.port = port;
    this.mediaBasePath = path.join(process.cwd(), 'media');
    
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new socketIo.Server(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
    this.ensureDirectories();
  }

  private setupMiddleware() {
    this.app.use(helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    }));
    this.app.use(cors());
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.raw({ type: 'image/*', limit: '10mb' }));
  }

  private setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        mediaSessions: this.mediaSessions.size,
        streamSessions: this.streamSessions.size,
        uptime: process.uptime()
      });
    });

    // Media storage endpoints
    this.app.post('/media/screenshot', this.storeScreenshot.bind(this));
    this.app.get('/media/screenshot/:id', this.getScreenshot.bind(this));
    this.app.get('/media/session/:sessionId/screenshots', this.getSessionScreenshots.bind(this));
    
    // Streaming endpoints
    this.app.post('/media/stream/start', this.startStream.bind(this));
    this.app.post('/media/stream/:streamId/frame', this.addStreamFrame.bind(this));
    this.app.get('/media/stream/:streamId', this.getStreamInfo.bind(this));
    this.app.delete('/media/stream/:streamId', this.stopStream.bind(this));
    
    // Media management
    this.app.get('/media/sessions', this.getMediaSessions.bind(this));
    this.app.delete('/media/session/:sessionId', this.cleanupSession.bind(this));
    this.app.post('/media/cleanup', this.cleanupOldMedia.bind(this));

    // Static file serving with caching
    this.app.use('/static', express.static(this.mediaBasePath, {
      maxAge: '1h',
      etag: true,
      lastModified: true
    }));
  }

  private setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      log.info(`[MediaLayer] Client connected: ${socket.id}`);

      socket.on('join-stream', (streamId: string) => {
        const stream = this.streamSessions.get(streamId);
        if (stream) {
          socket.join(streamId);
          stream.clients.add(socket.id);
          
          // Send last frame if available
          if (stream.lastFrame) {
            socket.emit('frame', {
              streamId,
              data: stream.lastFrame.toString('base64'),
              frameCount: stream.frameCount
            });
          }
          
          log.info(`[MediaLayer] Client ${socket.id} joined stream ${streamId}`);
        }
      });

      socket.on('leave-stream', (streamId: string) => {
        const stream = this.streamSessions.get(streamId);
        if (stream) {
          stream.clients.delete(socket.id);
          socket.leave(streamId);
        }
      });

      socket.on('disconnect', () => {
        // Remove client from all streams
        for (const [streamId, stream] of this.streamSessions) {
          stream.clients.delete(socket.id);
        }
        log.info(`[MediaLayer] Client disconnected: ${socket.id}`);
      });
    });
  }

  private async ensureDirectories() {
    const dirs = [
      path.join(this.mediaBasePath, 'screenshots'),
      path.join(this.mediaBasePath, 'streams'),
      path.join(this.mediaBasePath, 'recordings'),
      path.join(this.mediaBasePath, 'thumbnails')
    ];

    for (const dir of dirs) {
      await fs.ensureDir(dir);
    }
  }

  // Screenshot storage
  private async storeScreenshot(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { sessionId, pageUrl, pageTitle, commandId } = req.body;
      const imageData = req.body.imageData || req.body; // Support both JSON and raw binary

      if (!sessionId || !imageData) {
        res.status(400).json({ error: 'sessionId and imageData required' });
        return;
      }

      const mediaId = uuidv4();
      const filename = `${sessionId}_${Date.now()}.png`;
      const filepath = path.join(this.mediaBasePath, 'screenshots', filename);

      // Handle base64 or raw binary data
      let buffer: Buffer;
      if (typeof imageData === 'string') {
        // Remove data URL prefix if present
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        buffer = Buffer.from(base64Data, 'base64');
      } else {
        buffer = imageData;
      }

      await fs.writeFile(filepath, buffer);

      // Create thumbnail
      const thumbnailPath = path.join(this.mediaBasePath, 'thumbnails', filename);
      // For now, just copy the file. In production, you'd use sharp or similar for resizing
      await fs.copy(filepath, thumbnailPath);

      // Store in database
      const screenshot = await this.databaseService.saveScreenshot({
        sessionId,
        commandId,
        filename,
        fullPath: filepath,
        pageUrl,
        pageTitle,
        description: 'Screenshot captured via media layer'
      });

      // Track media session
      const mediaSession: MediaSession = {
        id: mediaId,
        sessionId,
        type: 'screenshot',
        format: 'png',
        metadata: {
          fileSize: buffer.length,
          pageUrl,
          pageTitle
        },
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        active: true
      };

      this.mediaSessions.set(mediaId, mediaSession);

      res.json({
        success: true,
        mediaId,
        filename,
        filepath: `/static/screenshots/${filename}`,
        thumbnailPath: `/static/thumbnails/${filename}`,
        size: buffer.length,
        screenshot
      });

      log.info(`[MediaLayer] Screenshot stored: ${filename} (${buffer.length} bytes)`);

    } catch (error) {
      log.error(`[MediaLayer] Screenshot storage failed:`, error as Error);
      res.status(500).json({ error: 'Failed to store screenshot' });
    }
  }

  private async getScreenshot(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { id } = req.params;
      const mediaSession = this.mediaSessions.get(id);

      if (!mediaSession || mediaSession.type !== 'screenshot') {
        res.status(404).json({ error: 'Screenshot not found' });
        return;
      }

      // Update last accessed
      mediaSession.lastAccessedAt = new Date();

      const filename = `${mediaSession.sessionId}_*.png`;
      const screenshotsDir = path.join(this.mediaBasePath, 'screenshots');
      const files = await fs.readdir(screenshotsDir);
      const matchingFile = files.find(f => f.startsWith(mediaSession.sessionId));

      if (!matchingFile) {
        res.status(404).json({ error: 'Screenshot file not found' });
        return;
      }

      const filepath = path.join(screenshotsDir, matchingFile);
      res.sendFile(filepath);

    } catch (error) {
      log.error(`[MediaLayer] Screenshot retrieval failed:`, error as Error);
      res.status(500).json({ error: 'Failed to retrieve screenshot' });
    }
  }

  private async getSessionScreenshots(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const screenshots = await this.databaseService.getSessionScreenshots(sessionId);
      
      const paginatedScreenshots = screenshots
        .slice(Number(offset), Number(offset) + Number(limit))
        .map(screenshot => ({
          ...screenshot,
          url: `/static/screenshots/${screenshot.filename}`,
          thumbnailUrl: `/static/thumbnails/${screenshot.filename}`
        }));

      res.json({
        screenshots: paginatedScreenshots,
        total: screenshots.length,
        limit: Number(limit),
        offset: Number(offset)
      });

    } catch (error) {
      log.error(`[MediaLayer] Session screenshots retrieval failed:`, error as Error);
      res.status(500).json({ error: 'Failed to retrieve session screenshots' });
    }
  }

  // Streaming functionality
  private async startStream(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { sessionId, quality = 'medium', frameRate = 10 } = req.body;

      if (!sessionId) {
        res.status(400).json({ error: 'sessionId required' });
        return;
      }

      const streamId = uuidv4();
      const streamSession: StreamSession = {
        id: streamId,
        sessionId,
        clients: new Set(),
        quality,
        frameRate,
        active: true,
        frameCount: 0
      };

      this.streamSessions.set(streamId, streamSession);

      res.json({
        success: true,
        streamId,
        wsUrl: `ws://localhost:${this.port}`,
        quality,
        frameRate
      });

      log.info(`[MediaLayer] Stream started: ${streamId} for session ${sessionId}`);

    } catch (error) {
      log.error(`[MediaLayer] Stream start failed:`, error as Error);
      res.status(500).json({ error: 'Failed to start stream' });
    }
  }

  private async addStreamFrame(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { streamId } = req.params;
      const frameData = req.body;

      const stream = this.streamSessions.get(streamId);
      if (!stream || !stream.active) {
        res.status(404).json({ error: 'Stream not found or inactive' });
        return;
      }

      let buffer: Buffer;
      if (typeof frameData === 'string') {
        buffer = Buffer.from(frameData, 'base64');
      } else {
        buffer = frameData;
      }

      stream.lastFrame = buffer;
      stream.frameCount++;

      // Broadcast to all connected clients
      this.io.to(streamId).emit('frame', {
        streamId,
        data: buffer.toString('base64'),
        frameCount: stream.frameCount
      });

      res.json({
        success: true,
        frameCount: stream.frameCount,
        clients: stream.clients.size
      });

    } catch (error) {
      log.error(`[MediaLayer] Frame addition failed:`, error as Error);
      res.status(500).json({ error: 'Failed to add frame' });
    }
  }

  private async getStreamInfo(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { streamId } = req.params;
      const stream = this.streamSessions.get(streamId);

      if (!stream) {
        res.status(404).json({ error: 'Stream not found' });
        return;
      }

      res.json({
        streamId: stream.id,
        sessionId: stream.sessionId,
        quality: stream.quality,
        frameRate: stream.frameRate,
        active: stream.active,
        clients: stream.clients.size,
        frameCount: stream.frameCount
      });

    } catch (error) {
      log.error(`[MediaLayer] Stream info retrieval failed:`, error as Error);
      res.status(500).json({ error: 'Failed to get stream info' });
    }
  }

  private async stopStream(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { streamId } = req.params;
      const stream = this.streamSessions.get(streamId);

      if (!stream) {
        res.status(404).json({ error: 'Stream not found' });
        return;
      }

      stream.active = false;
      
      // Notify all clients
      this.io.to(streamId).emit('stream-ended', { streamId });
      
      // Remove clients
      for (const clientId of stream.clients) {
        const socket = this.io.sockets.sockets.get(clientId);
        if (socket) {
          socket.leave(streamId);
        }
      }

      this.streamSessions.delete(streamId);

      res.json({ success: true });
      log.info(`[MediaLayer] Stream stopped: ${streamId}`);

    } catch (error) {
      log.error(`[MediaLayer] Stream stop failed:`, error as Error);
      res.status(500).json({ error: 'Failed to stop stream' });
    }
  }

  // Management endpoints
  private async getMediaSessions(req: express.Request, res: express.Response): Promise<void> {
    try {
      const sessions = Array.from(this.mediaSessions.values());
      res.json({ sessions });
    } catch (error) {
      log.error(`[MediaLayer] Media sessions retrieval failed:`, error as Error);
      res.status(500).json({ error: 'Failed to get media sessions' });
    }
  }

  private async cleanupSession(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      let deletedCount = 0;

      // Clean up media sessions
      for (const [id, session] of this.mediaSessions) {
        if (session.sessionId === sessionId) {
          this.mediaSessions.delete(id);
          deletedCount++;
        }
      }

      // Clean up stream sessions
      for (const [id, stream] of this.streamSessions) {
        if (stream.sessionId === sessionId) {
          stream.active = false;
          this.io.to(id).emit('stream-ended', { streamId: id });
          this.streamSessions.delete(id);
          deletedCount++;
        }
      }

      // Clean up files (optional - be careful with this)
      // You might want to keep files for forensic purposes

      res.json({ 
        success: true, 
        deletedCount,
        message: `Cleaned up ${deletedCount} media sessions for session ${sessionId}`
      });

      log.info(`[MediaLayer] Cleaned up ${deletedCount} media sessions for ${sessionId}`);

    } catch (error) {
      log.error(`[MediaLayer] Session cleanup failed:`, error as Error);
      res.status(500).json({ error: 'Failed to cleanup session' });
    }
  }

  private async cleanupOldMedia(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { olderThanHours = 24 } = req.body;
      const cutoffTime = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));
      let deletedCount = 0;

      // Clean up old media sessions
      for (const [id, session] of this.mediaSessions) {
        if (session.lastAccessedAt < cutoffTime) {
          this.mediaSessions.delete(id);
          deletedCount++;
        }
      }

      res.json({ 
        success: true, 
        deletedCount,
        cutoffTime 
      });

      log.info(`[MediaLayer] Cleaned up ${deletedCount} old media sessions`);

    } catch (error) {
      log.error(`[MediaLayer] Old media cleanup failed:`, error as Error);
      res.status(500).json({ error: 'Failed to cleanup old media' });
    }
  }

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server.listen(this.port, () => {
          log.info(`[MediaLayer] Media Layer Service running on port ${this.port}`);
          log.info(`[MediaLayer] Media storage path: ${this.mediaBasePath}`);
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        log.info(`[MediaLayer] Media Layer Service stopped`);
        resolve();
      });
    });
  }

  // Utility methods
  public getMediaStats() {
    return {
      mediaSessions: this.mediaSessions.size,
      streamSessions: this.streamSessions.size,
      activeStreams: Array.from(this.streamSessions.values()).filter(s => s.active).length,
      totalClients: Array.from(this.streamSessions.values()).reduce((sum, s) => sum + s.clients.size, 0)
    };
  }
} 