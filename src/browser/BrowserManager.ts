import { BrowserAutomation } from './BrowserAutomation';
import { MCPBrowserAutomation } from './MCPBrowserAutomation';
import { log } from '../utils/logger';
import { BrowserConfig } from '../types';

/**
 * Singleton manager for persistent browser sessions
 */
export class BrowserManager {
  private static instance: BrowserManager;
  private browserAutomation: BrowserAutomation | MCPBrowserAutomation | null = null;
  private isInitialized: boolean = false;
  private sessionStartTime: Date | null = null;
  private commandCount: number = 0;
  private useMCP: boolean = false;

  private constructor() {
    // Check if MCP mode is enabled via environment variable
    this.useMCP = process.env.USE_MCP_BROWSER === 'true';
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager();
    }
    return BrowserManager.instance;
  }

  /**
   * Initialize or get the browser automation instance
   */
  async getBrowser(config?: Partial<BrowserConfig>): Promise<BrowserAutomation | MCPBrowserAutomation> {
    if (!this.browserAutomation || !this.isInitialized) {
      if (this.useMCP) {
        log.info('[BROWSER_MANAGER] Initializing new MCP browser session');
        this.browserAutomation = new MCPBrowserAutomation(config);
      } else {
        log.info('[BROWSER_MANAGER] Initializing new browser session');
        this.browserAutomation = new BrowserAutomation(config);
      }
      await this.browserAutomation.initialize();
      this.isInitialized = true;
      this.sessionStartTime = new Date();
      this.commandCount = 0;
    } else {
      log.info('[BROWSER_MANAGER] Reusing existing browser session');
      // Ensure the page is still active
      await this.browserAutomation.ensurePageActive();
    }
    
    this.commandCount++;
    return this.browserAutomation;
  }

  /**
   * Close the browser session
   */
  async closeBrowser(): Promise<void> {
    if (this.browserAutomation && this.isInitialized) {
      log.info('[BROWSER_MANAGER] Closing browser session');
      await this.browserAutomation.close();
      this.browserAutomation = null;
      this.isInitialized = false;
      this.sessionStartTime = null;
      this.commandCount = 0;
    }
  }

  /**
   * Reset the browser (close and prepare for new session)
   */
  async resetBrowser(): Promise<void> {
    await this.closeBrowser();
    log.info('[BROWSER_MANAGER] Browser reset, ready for new session');
  }

  /**
   * Get session status
   */
  getSessionStatus(): {
    isActive: boolean;
    sessionDuration: string | null;
    commandCount: number;
    currentUrl: string | null;
    mode: 'MCP' | 'Direct';
  } {
    const isActive = this.isInitialized && this.browserAutomation !== null;
    let sessionDuration = null;
    let currentUrl = null;

    if (isActive && this.sessionStartTime) {
      const duration = Date.now() - this.sessionStartTime.getTime();
      const minutes = Math.floor(duration / 60000);
      const seconds = Math.floor((duration % 60000) / 1000);
      sessionDuration = `${minutes}m ${seconds}s`;
    }

    if (isActive && this.browserAutomation) {
      if (!this.useMCP) {
        const page = (this.browserAutomation as BrowserAutomation).currentPage;
        if (page) {
          try {
            currentUrl = page.url();
          } catch {
            // Page might be closed
          }
        }
      } else {
        // For MCP mode, we need to get URL differently
        try {
          currentUrl = 'MCP Mode - URL tracking via tab list';
        } catch {
          // Ignore
        }
      }
    }

    return {
      isActive,
      sessionDuration,
      commandCount: this.commandCount,
      currentUrl,
      mode: this.useMCP ? 'MCP' : 'Direct'
    };
  }

  /**
   * Navigate to a URL in the current session
   */
  async navigate(url: string): Promise<void> {
    if (!this.browserAutomation || !this.isInitialized) {
      throw new Error('No active browser session. Start a session first.');
    }
    
    if (this.useMCP) {
      await this.browserAutomation.executeAction({ type: 'navigate', url });
    } else {
      const page = (this.browserAutomation as BrowserAutomation).currentPage;
      if (!page) {
        throw new Error('No active page in browser session');
      }
      await page.goto(url);
    }
    
    log.info(`[BROWSER_MANAGER] Navigated to ${url}`);
  }

  /**
   * Get the current browser automation instance without initializing
   */
  getCurrentBrowser(): BrowserAutomation | MCPBrowserAutomation | null {
    return this.isInitialized ? this.browserAutomation : null;
  }

  /**
   * Set whether to use MCP mode
   */
  setMCPMode(useMCP: boolean): void {
    if (this.isInitialized) {
      throw new Error('Cannot change mode while browser is active. Reset browser first.');
    }
    this.useMCP = useMCP;
    log.info(`[BROWSER_MANAGER] Mode set to: ${useMCP ? 'MCP' : 'Direct'}`);
  }

  /**
   * Check if using MCP mode
   */
  isMCPMode(): boolean {
    return this.useMCP;
  }
}

export default BrowserManager; 