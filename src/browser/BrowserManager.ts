import { BrowserAutomation } from './BrowserAutomation';
import { log } from '../utils/logger';
import { BrowserConfig } from '../types';

/**
 * Singleton manager for persistent browser sessions
 */
export class BrowserManager {
  private static instance: BrowserManager;
  private browserAutomation: BrowserAutomation | null = null;
  private isInitialized: boolean = false;
  private sessionStartTime: Date | null = null;
  private commandCount: number = 0;

  private constructor() {}

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
  async getBrowser(config?: Partial<BrowserConfig>): Promise<BrowserAutomation> {
    if (!this.browserAutomation || !this.isInitialized) {
      log.info('[BROWSER_MANAGER] Initializing new browser session');
      this.browserAutomation = new BrowserAutomation(config);
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
      const page = this.browserAutomation.getPage();
      if (page) {
        try {
          currentUrl = page.url();
        } catch {
          // Page might be closed
        }
      }
    }

    return {
      isActive,
      sessionDuration,
      commandCount: this.commandCount,
      currentUrl
    };
  }

  /**
   * Navigate to a URL in the current session
   */
  async navigate(url: string): Promise<void> {
    if (!this.browserAutomation || !this.isInitialized) {
      throw new Error('No active browser session. Start a session first.');
    }
    
    const page = this.browserAutomation.getPage();
    if (!page) {
      throw new Error('No active page in browser session');
    }
    
    await page.goto(url);
    log.info(`[BROWSER_MANAGER] Navigated to ${url}`);
  }

  /**
   * Get the current browser automation instance without initializing
   */
  getCurrentBrowser(): BrowserAutomation | null {
    return this.isInitialized ? this.browserAutomation : null;
  }
}

export default BrowserManager; 