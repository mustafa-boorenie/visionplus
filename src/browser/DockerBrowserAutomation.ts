import { IBrowserAutomation } from './IBrowserAutomation';
import { BrowserAction, ScreenshotOptions } from '../types';
import { DockerService, DockerBrowserSession } from '../integrations/docker';
import { log } from '../utils/logger';
import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';

/**
 * Docker-based browser automation that implements IBrowserAutomation
 */
export class DockerBrowserAutomation implements IBrowserAutomation {
  private dockerService: DockerService;
  private session?: DockerBrowserSession;
  private screenshotDir: string = './screenshots';

  constructor() {
    this.dockerService = new DockerService();
  }

  /**
   * Initialize the Docker browser session
   */
  async initialize(): Promise<void> {
    try {
      // Ensure screenshot directory exists
      await fs.ensureDir(this.screenshotDir);
      
      // Create Docker browser session
      this.session = await this.dockerService.createBrowserContainer('default-session');
      
      log.info(`Docker browser session initialized: ${this.session.containerId}`);
    } catch (error) {
      log.error('Failed to initialize Docker browser session', error as Error);
      throw error;
    }
  }

  /**
   * Close the Docker browser session
   */
  async close(): Promise<void> {
    if (this.session) {
      try {
        await this.dockerService.stopContainer(this.session.containerId);
        log.info(`Docker browser session closed: ${this.session.containerId}`);
        this.session = undefined;
      } catch (error) {
        log.error('Failed to close Docker browser session', error as Error);
      }
    }
  }

  /**
   * Execute a single browser action
   */
  async executeAction(action: BrowserAction): Promise<void> {
    if (!this.session) {
      throw new Error('Docker browser session not initialized');
    }

    try {
      await this.dockerService.executeAction(this.session, action);
    } catch (error) {
      log.error(`Failed to execute action: ${action.type}`, error as Error);
      throw error;
    }
  }

  /**
   * Execute multiple browser actions sequentially
   */
  async executeActions(actions: BrowserAction[]): Promise<void> {
    for (const action of actions) {
      await this.executeAction(action);
    }
  }

  /**
   * Get the current page HTML
   */
  async getPageHTML(): Promise<string> {
    if (!this.session) {
      throw new Error('Docker browser session not initialized');
    }

    try {
      // Make a direct API call to get HTML from the Docker container
      const response = await fetch(`${this.session.apiUrl}/html`);
      if (response.ok) {
        const data = await response.json();
        return data.html || '<html></html>';
      }
      return '<html></html>';
    } catch (error) {
      log.error('Failed to get page HTML', error as Error);
      return '<html></html>';
    }
  }

  /**
   * Take a screenshot
   */
  async takeScreenshot(name: string, options?: ScreenshotOptions): Promise<string> {
    if (!this.session) {
      throw new Error('Docker browser session not initialized');
    }

    try {
      // Generate filename
      const timestamp = Date.now();
      const filename = `${name}_${timestamp}.png`;
      const filepath = path.join(this.screenshotDir, filename);

      // Take screenshot from Docker container (returns base64)
      const base64Screenshot = await this.dockerService.takeScreenshot(this.session, name);
      
      // Save to local file
      const buffer = Buffer.isBuffer(base64Screenshot) ? base64Screenshot : Buffer.from(base64Screenshot as any, 'base64');
      await fs.writeFile(filepath, buffer);
      
      log.info(`Screenshot saved: ${filepath}`);
      return filepath;
    } catch (error) {
      log.error('Failed to take screenshot', error as Error);
      throw error;
    }
  }

  /**
   * Get the current URL
   */
  async getCurrentUrl(): Promise<string> {
    if (!this.session) {
      throw new Error('Docker browser session not initialized');
    }

    try {
      const response = await axios.get(`${this.session.apiUrl}/url`, { timeout: 5000 });
      return response.data.url || '';
    } catch (error) {
      log.error('Failed to get current URL', error as Error);
      return 'about:blank';
    }
  }

  /**
   * Take a high quality screenshot
   */
  async takeHighQualityScreenshot(name: string, includeFullPage?: boolean): Promise<string> {
    return await this.takeScreenshot(name, { fullPage: includeFullPage });
  }

  /**
   * Capture failure context for debugging
   */
  async captureFailureContext(stepDescription: string): Promise<{ html: string; screenshotPath: string }> {
    const html = await this.getPageHTML();
    const screenshotPath = await this.takeScreenshot(`failure_${stepDescription.replace(/[^a-zA-Z0-9]/g, '_')}`);
    
    return { html, screenshotPath };
  }

  /**
   * Evaluate JavaScript in the browser context
   */
  async evaluate<T>(fn: () => T): Promise<T> {
    if (!this.session) {
      throw new Error('Docker browser session not initialized');
    }

    try {
      // Convert function to string and execute via Docker API
      const script = fn.toString();
      const response = await fetch(`${this.session.apiUrl}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: `(${script})()` })
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.result;
      }
      
      throw new Error('Failed to evaluate script');
    } catch (error) {
      log.error('Failed to evaluate script', error as Error);
      throw error;
    }
  }

  /**
   * Get the current page object (Docker container doesn't expose Playwright Page directly)
   */
  get currentPage(): any {
    return this.session ? { 
      url: () => this.getCurrentUrl(),
      screenshot: (options: any) => this.takeScreenshot('current', options),
      content: () => this.getPageHTML()
    } : null;
  }

  /**
   * Check if Docker-backed automation session is active
   */
  isConnected(): boolean {
    return !!this.session && typeof this.session.containerId === 'string' && this.session.containerId.length > 0;
  }
} 