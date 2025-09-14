import axios from 'axios';
import { log } from '../../utils/logger';
import { EventEmitter } from 'events';

interface BrowserlessConfig {
  apiKey?: string;
  url?: string;
  timeout?: number;
}

interface WebRTCSession {
  sessionId: string;
  browserWSEndpoint: string;
  webRTCUrl: string;
  viewerUrl: string;
}

/**
 * Service for integrating with Browserless.io cloud browsers
 */
export class BrowserlessService extends EventEmitter {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;
  private sessions: Map<string, WebRTCSession> = new Map();

  constructor(config?: BrowserlessConfig) {
    super();
    this.apiKey = config?.apiKey || process.env.BROWSERLESS_API_KEY || '';
    this.baseUrl = config?.url || process.env.BROWSERLESS_URL || 'https://chrome.browserless.io';
    this.timeout = config?.timeout || 30000;
  }

  /**
   * Create a new WebRTC browser session
   */
  async createWebRTCSession(sessionId: string, options?: {
    width?: number;
    height?: number;
    blockAds?: boolean;
    stealth?: boolean;
  }): Promise<WebRTCSession> {
    try {
      // Create browser session with WebRTC enabled
      const response = await axios.post(
        `${this.baseUrl}/webrtc`,
        {
          // Browser launch options
          launch: {
            headless: false,
            args: [
              '--enable-webrtc',
              '--use-fake-ui-for-media-stream',
              '--use-fake-device-for-media-stream',
              '--disable-blink-features=AutomationControlled',
            ],
            defaultViewport: {
              width: options?.width || 1280,
              height: options?.height || 720,
            },
          },
          // WebRTC specific options
          blockAds: options?.blockAds ?? true,
          stealth: options?.stealth ?? true,
          // Session timeout
          timeout: this.timeout,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const { browserWSEndpoint, webRTCUrl, viewerUrl } = response.data;

      const webRTCSession: WebRTCSession = {
        sessionId,
        browserWSEndpoint,
        webRTCUrl,
        viewerUrl,
      };

      this.sessions.set(sessionId, webRTCSession);
      this.emit('session:created', webRTCSession);

      log.info(`WebRTC session created for ${sessionId}: ${viewerUrl}`);

      return webRTCSession;
    } catch (error) {
      log.error('Failed to create WebRTC session', error as Error);
      throw new Error(`Failed to create WebRTC session: ${(error as Error).message}`);
    }
  }

  /**
   * Get WebRTC session info
   */
  getSession(sessionId: string): WebRTCSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get viewer URL for a session
   */
  getViewerUrl(sessionId: string): string | undefined {
    return this.sessions.get(sessionId)?.viewerUrl;
  }

  /**
   * Get WebRTC connection URL for direct P2P connection
   */
  getWebRTCUrl(sessionId: string): string | undefined {
    return this.sessions.get(sessionId)?.webRTCUrl;
  }

  /**
   * Close a WebRTC session
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      log.warn(`WebRTC session ${sessionId} not found`);
      return;
    }

    try {
      // Close the browser session
      await axios.delete(
        `${this.baseUrl}/webrtc/${encodeURIComponent(session.browserWSEndpoint)}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        }
      );

      this.sessions.delete(sessionId);
      this.emit('session:closed', sessionId);
      
      log.info(`WebRTC session closed for ${sessionId}`);
    } catch (error) {
      log.error(`Failed to close WebRTC session ${sessionId}`, error as Error);
      // Still remove from local cache even if remote close failed
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Close all active sessions
   */
  async closeAllSessions(): Promise<void> {
    const closePromises = Array.from(this.sessions.keys()).map(sessionId =>
      this.closeSession(sessionId).catch(err => 
        log.error(`Error closing session ${sessionId}:`, err)
      )
    );
    
    await Promise.all(closePromises);
  }

  /**
   * Get stats for all active sessions
   */
  getStats(): {
    activeSessions: number;
    sessions: Array<{
      sessionId: string;
      viewerUrl: string;
    }>;
  } {
    const sessions = Array.from(this.sessions.entries()).map(([sessionId, session]) => ({
      sessionId,
      viewerUrl: session.viewerUrl,
    }));

    return {
      activeSessions: this.sessions.size,
      sessions,
    };
  }

  /**
   * Health check for Browserless connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/pressure`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
          timeout: 5000,
        }
      );
      
      return response.status === 200;
    } catch (error) {
      log.error('Browserless health check failed', error as Error);
      return false;
    }
  }
}

// Export singleton instance
export const browserlessService = new BrowserlessService();

