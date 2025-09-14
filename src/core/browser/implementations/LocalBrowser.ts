import { chromium, firefox, webkit, Browser, BrowserContext, Page, Locator } from 'playwright';
import { BrowserAutomationBase } from '../base/BrowserAutomationBase';
import { BrowserConfig, ClickAction, TypeAction } from '../../../types';
import { defaultBrowserConfig, getBrowserLaunchArgs, getBrowserContextOptions } from '../../../config/browser.config';
import { log } from '../../../utils/logger';

/**
 * Local browser automation using Playwright
 */
export class LocalBrowser extends BrowserAutomationBase {
  protected getDefaultConfig(): BrowserConfig {
    return defaultBrowserConfig;
  }

  /**
   * Initialize browser with stealth and humanization features
   */
  async initialize(): Promise<void> {
    try {
      log.info('Initializing local browser...');
      
      // Get browser type
      const browserType = this.getBrowserType();
      
      // Launch browser with configured arguments
      const launchArgs = getBrowserLaunchArgs(this.config);
      this.browser = await browserType.launch({
        headless: this.config.headless,
        args: launchArgs
      });

      // Create context with anti-detection settings
      const contextOptions = getBrowserContextOptions(this.config);
      this.context = await this.browser.newContext(contextOptions);

      // Set default timeouts
      this.context.setDefaultTimeout(this.config.timeout);
      this.context.setDefaultNavigationTimeout(this.config.navigationTimeout);

      // Create new page
      this.page = await this.context.newPage();
      
      // Apply stealth and humanization features
      if (this.config.stealth !== false) {
        await this.injectAntiDetection();
      }
      
      if (this.config.humanize) {
        await this.installHumanizedBehavior();
      }
      
      log.info(`Local browser initialized: ${this.config.browserType}`);
    } catch (error) {
      log.error('Failed to initialize browser', error as Error);
      throw error;
    }
  }

  /**
   * Close browser and cleanup
   */
  async close(): Promise<void> {
    log.info('Closing browser...');
    
    if (this.page) {
      await this.page.close();
    }
    
    if (this.context) {
      await this.context.close();
    }
    
    if (this.browser) {
      await this.browser.close();
    }

    log.info(`Browser closed. Screenshots taken: ${this.screenshotCount}`);
  }

  /**
   * Get browser type instance
   */
  private getBrowserType() {
    switch (this.config.browserType) {
      case 'firefox':
        return firefox;
      case 'webkit':
        return webkit;
      default:
        return chromium;
    }
  }

  /**
   * Inject anti-detection scripts
   */
  private async injectAntiDetection(): Promise<void> {
    if (!this.context) return;
    
    await this.context.addInitScript(`
      // Override navigator.webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });
      
      // Spoof plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });
      
      // Spoof languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });
      
      // Add Chrome runtime
      window.chrome = { runtime: {} };
      
      // Spoof permissions
      const originalQuery = window.navigator.permissions && window.navigator.permissions.query;
      if (originalQuery) {
        window.navigator.permissions.query = (parameters) => (
          parameters && parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );
      }
    `);
  }

  /**
   * Install humanized behavior (cursor movement, delays, etc.)
   */
  private async installHumanizedBehavior(): Promise<void> {
    if (!this.page) return;

    // Install cursor overlay if enabled
    if (this.config.cursorOverlay) {
      await this.page.addInitScript(() => {
        const style = document.createElement('style');
        style.textContent = `
          .__ai_cursor__ { 
            position: fixed; 
            top: 0; 
            left: 0; 
            width: 16px; 
            height: 16px; 
            border-radius: 50%; 
            background: rgba(0,0,0,0.5); 
            pointer-events: none; 
            z-index: 2147483647; 
            transform: translate(-50%, -50%); 
            transition: transform 0.1s ease-out;
          }
        `;
        document.documentElement.appendChild(style);
        
        const cursor = document.createElement('div');
        cursor.className = '__ai_cursor__';
        document.body.appendChild(cursor);
        
        // @ts-ignore
        window.__ai_cursor_el__ = cursor;
      });
    }
  }

  /**
   * Override click with human-like movement
   */
  protected async click(action: ClickAction): Promise<void> {
    log.action(`Clicking ${Array.isArray(action.selector) ? action.selector[0] + '...' : action.selector}`);
    
    const locator = await this.smartLocator(action.selector);
    
    // Move mouse to element with human-like movement
    if (this.config.humanize && this.page) {
      const box = await locator.boundingBox();
      if (box) {
        const targetX = box.x + box.width / 2;
        const targetY = box.y + box.height / 2;
        await this.humanMouseMove(targetX, targetY);
        await this.page.waitForTimeout(50 + Math.random() * 100);
      }
    }
    
    await locator.click(action.options);
  }

  /**
   * Override type with human-like behavior
   */
  protected async type(action: TypeAction): Promise<void> {
    log.action(`Typing in ${Array.isArray(action.selector) ? action.selector[0] + '...' : action.selector}`);
    
    const locator = await this.smartLocator(action.selector);
    
    // Move cursor to input before typing
    if (this.config.humanize && this.page) {
      const box = await locator.boundingBox();
      if (box) {
        const targetX = box.x + Math.min(box.width * 0.2, 20);
        const targetY = box.y + box.height / 2;
        await this.humanMouseMove(targetX, targetY);
        await this.page.waitForTimeout(100 + Math.random() * 200);
      }
    }
    
    // Type with optional humanized delays
    if (this.config.humanize) {
      await locator.click(); // Focus first
      await this.page!.keyboard.type(action.text, {
        delay: 50 + Math.random() * 100
      });
    } else {
      await locator.fill(action.text);
    }
  }

  /**
   * Human-like mouse movement with bezier curves
   */
  private async humanMouseMove(x: number, y: number): Promise<void> {
    if (!this.page) return;
    
    try {
      const currentPos = await this.getMousePosition();
      const startX = currentPos.x;
      const startY = currentPos.y;
      const dx = x - startX;
      const dy = y - startY;
      const distance = Math.hypot(dx, dy);
      
      // Calculate steps based on distance
      const steps = Math.max(10, Math.min(30, Math.round(distance / 15)));
      
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        // Ease-in-out curve
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        
        // Add slight randomness to make it more human-like
        const jitterX = (Math.random() - 0.5) * 2;
        const jitterY = (Math.random() - 0.5) * 2;
        
        const nx = startX + dx * ease + jitterX;
        const ny = startY + dy * ease + jitterY;
        
        await this.page.mouse.move(nx, ny, { steps: 1 });
        
        // Variable delay between movements
        if (i < steps) {
          await this.page.waitForTimeout(5 + Math.floor(Math.random() * 10));
        }
      }
      
      // Update cursor overlay if enabled
      if (this.config.cursorOverlay) {
        await this.page.evaluate(([cx, cy]) => {
          // @ts-ignore
          const el = window.__ai_cursor_el__ as HTMLElement | undefined;
          if (el) {
            el.style.transform = `translate(${cx}px, ${cy}px)`;
          }
        }, [x, y]);
      }
    } catch (error) {
      // Fallback to direct movement
      await this.page.mouse.move(x, y);
    }
  }

  /**
   * Get current mouse position
   */
  private async getMousePosition(): Promise<{ x: number; y: number }> {
    // Playwright doesn't provide direct mouse position access
    // So we track it or use a default starting position
    return { x: 640, y: 360 }; // Center of default viewport
  }

  /**
   * Smart locator with fallback strategies
   */
  private async smartLocator(selectors: string | string[]): Promise<Locator> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    const candidates = Array.isArray(selectors) ? selectors : [selectors];
    log.info(`[SMART_LOCATOR] Trying ${candidates.length} selector candidates`);
    
    // Try each candidate selector
    for (const selector of candidates) {
      try {
        log.info(`[SMART_LOCATOR] Trying: ${selector}`);
        const locator = this.page.locator(selector).first();
        
        // Check if element exists and is visible
        if (await locator.count() > 0) {
          const isVisible = await locator.isVisible({ timeout: 1000 }).catch(() => false);
          if (isVisible) {
            log.info(`[SMART_LOCATOR] Found visible element with: ${selector}`);
            return locator;
          }
        }
      } catch (error) {
        log.info(`[SMART_LOCATOR] Selector failed: ${selector}`);
      }
    }

    // If no candidates worked, throw error
    throw new Error(`None of the selectors matched: ${candidates.join(', ')}`);
  }

  /**
   * Capture session state for persistence
   */
  async captureSessionState(): Promise<{
    cookies: any[];
    localStorage: Record<string, string>;
    sessionStorage: Record<string, string>;
    url: string;
    title: string;
    viewport: { width: number; height: number } | null;
  }> {
    if (!this.page || !this.context) {
      throw new Error('Browser not initialized');
    }

    try {
      const [cookies, storageData, url, title, viewport] = await Promise.all([
        this.context.cookies(),
        this.page.evaluate(() => ({
          localStorage: { ...window.localStorage },
          sessionStorage: { ...window.sessionStorage }
        })),
        this.page.url(),
        this.page.title(),
        this.page.viewportSize()
      ]);

      return {
        cookies,
        localStorage: storageData.localStorage,
        sessionStorage: storageData.sessionStorage,
        url,
        title,
        viewport
      };
    } catch (error) {
      log.error('Failed to capture session state', error as Error);
      throw error;
    }
  }

  /**
   * Restore session state
   */
  async restoreSessionState(state: {
    cookies?: any[];
    localStorage?: Record<string, string>;
    sessionStorage?: Record<string, string>;
    url?: string;
    viewport?: { width: number; height: number };
  }): Promise<void> {
    if (!this.page || !this.context) {
      throw new Error('Browser not initialized');
    }

    try {
      if (state.cookies) {
        await this.context.addCookies(state.cookies);
      }

      if (state.viewport) {
        await this.page.setViewportSize(state.viewport);
      }

      if (state.url) {
        await this.page.goto(state.url);
      }

      if (state.localStorage || state.sessionStorage) {
        await this.page.evaluate((storage) => {
          if (storage.localStorage) {
            Object.entries(storage.localStorage).forEach(([key, value]) => {
              window.localStorage.setItem(key, value);
            });
          }
          if (storage.sessionStorage) {
            Object.entries(storage.sessionStorage).forEach(([key, value]) => {
              window.sessionStorage.setItem(key, value);
            });
          }
        }, { localStorage: state.localStorage, sessionStorage: state.sessionStorage });
      }

      log.info('Session state restored successfully');
    } catch (error) {
      log.error('Failed to restore session state', error as Error);
      throw error;
    }
  }
}

