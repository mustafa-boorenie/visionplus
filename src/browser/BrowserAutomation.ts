import { chromium, firefox, webkit, Browser, BrowserContext, Page, Locator } from 'playwright';
import path from 'path';
import fs from 'fs-extra';
import { 
  BrowserConfig, 
  BrowserAction, 
  ScreenshotOptions,
  NavigateAction,
  ClickAction,
  TypeAction,
  WaitAction,
  ScrollAction,
  SelectAction,
  ScreenshotAction,
  PressAction
} from '../types';
import { Config } from '../utils/config';
import { log } from '../utils/logger';

/**
 * Browser automation class using Playwright
 */
export class BrowserAutomation {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: BrowserConfig;
  private screenshotCount = 0;

  constructor(config?: Partial<BrowserConfig>) {
    this.config = { ...Config.BROWSER_CONFIG, ...config };
  }

  /**
   * Initialize browser
   */
  async initialize(): Promise<void> {
    try {
      log.info('Initializing browser...');
      
      // Launch browser based on type
      const browserType = this.getBrowserType();
      this.browser = await browserType.launch({
        headless: this.config.headless,
        args: [
          ...(this.config.args || []),
          '--disable-blink-features=AutomationControlled'
        ]
      });

      // Create context with viewport and anti-detection settings
      this.context = await this.browser.newContext({
        viewport: this.config.viewport,
        ignoreHTTPSErrors: true,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      // Set default timeouts
      this.context.setDefaultTimeout(this.config.timeout);
      this.context.setDefaultNavigationTimeout(this.config.navigationTimeout);

      // Create new page
      this.page = await this.context.newPage();
      
      // Inject anti-detection scripts
      await this.injectAntiDetection();
      
      log.info(`Browser initialized: ${this.config.browserType}`);
    } catch (error) {
      log.error('Failed to initialize browser', error as Error);
      throw error;
    }
  }

  /**
   * Inject anti-detection scripts to avoid bot detection
   */
  private async injectAntiDetection(): Promise<void> {
    if (!this.context) return;
    
    // Override navigator.webdriver to prevent detection
    await this.context.addInitScript(`
      // Override navigator.webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });
    `);
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
   * Smart locator that tries multiple selector candidates
   */
  private async smartLocator(selectors: string | string[], elementType?: string): Promise<Locator> {
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
          } else {
            log.info(`[SMART_LOCATOR] Element found but not visible: ${selector}`);
          }
        }
      } catch (error) {
        log.info(`[SMART_LOCATOR] Selector failed: ${selector}`);
      }
    }

    // If no candidates worked, try fallback heuristics
    if (elementType) {
      log.info(`[SMART_LOCATOR] Trying fallback heuristics for ${elementType}`);
      const fallbackLocator = await this.tryFallbackHeuristics(elementType);
      if (fallbackLocator) {
        return fallbackLocator;
      }
    }

    throw new Error(`None of the selectors matched: ${candidates.join(', ')}`);
  }

  /**
   * Try fallback heuristics for common element types
   */
  private async tryFallbackHeuristics(elementType: string): Promise<Locator | null> {
    if (!this.page) return null;

    try {
      switch (elementType) {
        case 'search': {
          // Try common search box patterns
          const searchPatterns = [
            this.page.getByRole('searchbox').first(),
            this.page.getByRole('textbox', { name: /search|find|query|keyword/i }).first(),
            this.page.locator('input[type="search"]:visible').first(),
            this.page.locator('input[placeholder*="search" i]:visible').first(),
            this.page.locator('input[placeholder*="find" i]:visible').first(),
            this.page.locator('input[aria-label*="search" i]:visible').first(),
            this.page.locator('input[name="q"]:visible').first(),
            this.page.locator('input[name="search"]:visible').first(),
            this.page.locator('input[name="term"]:visible').first(),
            this.page.locator('textarea[name="q"]:visible').first(),  // Google uses textarea
            this.page.locator('#search:visible').first(),
            this.page.locator('.search-input:visible').first(),
            this.page.locator('.search-box:visible').first()
          ];

          for (const pattern of searchPatterns) {
            if (await pattern.count() > 0 && await pattern.isVisible({ timeout: 1000 }).catch(() => false)) {
              log.info('[SMART_LOCATOR] Found search element with fallback heuristic');
              return pattern;
            }
          }
          break;
        }

        case 'submit':
        case 'button': {
          // Try common button patterns
          const buttonPatterns = [
            this.page.getByRole('button', { name: /search|submit|go|find|next|continue/i }).first(),
            this.page.locator('button[type="submit"]:visible').first(),
            this.page.locator('input[type="submit"]:visible').first(),
            this.page.locator('button:has-text("Search"):visible').first(),
            this.page.locator('button:has-text("Submit"):visible').first(),
            this.page.locator('.search-button:visible').first(),
            this.page.locator('[aria-label*="search" i][role="button"]:visible').first()
          ];

          for (const pattern of buttonPatterns) {
            if (await pattern.count() > 0 && await pattern.isVisible({ timeout: 1000 }).catch(() => false)) {
              log.info('[SMART_LOCATOR] Found button element with fallback heuristic');
              return pattern;
            }
          }
          break;
        }
      }
    } catch (error) {
      log.error('[SMART_LOCATOR] Fallback heuristics failed', error as Error);
    }

    return null;
  }

  /**
   * Execute a browser action
   */
  async executeAction(action: BrowserAction): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Ensure page is active before any action
      await this.ensurePageActive();
      
      switch (action.type) {
        case 'navigate':
          await this.navigate(action as NavigateAction);
          break;
        case 'click':
          await this.click(action as ClickAction);
          break;
        case 'type':
          await this.type(action as TypeAction);
          break;
        case 'wait':
          await this.wait(action as WaitAction);
          break;
        case 'scroll':
          await this.scroll(action as ScrollAction);
          break;
        case 'select':
          await this.select(action as SelectAction);
          break;
        case 'screenshot':
          await this.screenshot(action as ScreenshotAction);
          break;
        case 'press':
          await this.press(action as PressAction);
          break;
        default:
          throw new Error(`Unknown action type: ${(action as any).type}`);
      }
      
      const duration = Date.now() - startTime;
      log.performance(`Action ${action.type} completed`, duration);
      
    } catch (error) {
      log.error(`Failed to execute action: ${action.type}`, error as Error);
      throw error;
    }
  }

  /**
   * Execute multiple actions in sequence
   */
  async executeActions(actions: BrowserAction[]): Promise<void> {
    for (const action of actions) {
      await this.executeAction(action);
    }
  }

  /**
   * Navigate to URL
   */
  private async navigate(action: NavigateAction): Promise<void> {
    log.action(`Navigating to ${action.url}`);
    await this.page!.goto(action.url, {
      waitUntil: action.waitUntil || 'load'
    });
  }

  /**
   * Click element
   */
  private async click(action: ClickAction): Promise<void> {
    log.action(`Clicking ${Array.isArray(action.selector) ? action.selector[0] + '...' : action.selector}`, action.options);
    
    // Determine element type for fallback heuristics
    const elementType = action.options?.button === 'left' || !action.options?.button ? 'button' : undefined;
    
    // Use smart locator to find element
    const locator = await this.smartLocator(action.selector, elementType);
    await locator.click(action.options);
  }

  /**
   * Type text
   */
  private async type(action: TypeAction): Promise<void> {
    log.action(`Typing in ${Array.isArray(action.selector) ? action.selector[0] + '...' : action.selector}`, { textLength: action.text.length });
    
    // Use smart locator to find element, with 'search' hint for better fallback
    const locator = await this.smartLocator(action.selector, 'search');
    
    // Clear existing text and type new text
    await locator.fill(action.text);
  }

  /**
   * Press keyboard key
   */
  private async press(action: PressAction): Promise<void> {
    if (action.selector) {
      log.action(`Pressing ${action.key} in ${Array.isArray(action.selector) ? action.selector[0] + '...' : action.selector}`);
      const locator = await this.smartLocator(action.selector);
      await locator.press(action.key);
    } else {
      log.action(`Pressing ${action.key}`);
      await this.page!.keyboard.press(action.key);
    }
  }

  /**
   * Wait
   */
  private async wait(action: WaitAction): Promise<void> {
    if (action.duration) {
      log.action(`Waiting ${action.duration}ms`);
      await this.page!.waitForTimeout(action.duration);
    } else if (action.selector) {
      const selectorStr = Array.isArray(action.selector) ? action.selector[0] : action.selector;
      log.action(`Waiting for ${selectorStr}`, { state: action.state });
      
      // For wait actions, we just need to wait for any of the selectors
      const candidates = Array.isArray(action.selector) ? action.selector : [action.selector];
      
      // Try each selector until one is found
      let found = false;
      for (const selector of candidates) {
        try {
          await this.page!.waitForSelector(selector, {
            state: action.state || 'visible',
            timeout: 5000
          });
          found = true;
          break;
        } catch {
          // Try next selector
        }
      }
      
      if (!found) {
        throw new Error(`None of the selectors became ${action.state || 'visible'}: ${candidates.join(', ')}`);
      }
    }
  }

  /**
   * Scroll
   */
  private async scroll(action: ScrollAction): Promise<void> {
    if (action.selector) {
      const selectorStr = Array.isArray(action.selector) ? action.selector[0] + '...' : action.selector;
      log.action(`Scrolling element ${selectorStr}`);
      const locator = await this.smartLocator(action.selector);
      await locator.scrollIntoViewIfNeeded();
    } else {
      const amount = action.amount || 500;
      const direction = action.direction || 'down';
      
      log.action(`Scrolling ${direction} by ${amount}px`);
      
      const scrollMap = {
        up: { x: 0, y: -amount },
        down: { x: 0, y: amount },
        left: { x: -amount, y: 0 },
        right: { x: amount, y: 0 }
      };
      
      const delta = scrollMap[direction];
      await this.page!.mouse.wheel(delta.x, delta.y);
    }
  }

  /**
   * Select option
   */
  private async select(action: SelectAction): Promise<void> {
    const selectorStr = Array.isArray(action.selector) ? action.selector[0] + '...' : action.selector;
    log.action(`Selecting ${action.value} in ${selectorStr}`);
    
    const locator = await this.smartLocator(action.selector);
    await locator.selectOption(action.value);
  }

  /**
   * Take screenshot
   */
  private async screenshot(action: ScreenshotAction): Promise<string> {
    return await this.takeScreenshot(action.name, action.options);
  }

  /**
   * Take screenshot with specified options
   */
  async takeScreenshot(name: string, options?: ScreenshotOptions): Promise<string> {
    // Ensure page is active before taking screenshot
    await this.ensurePageActive();
    
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    // Ensure screenshot directory exists
    await fs.ensureDir(Config.SCREENSHOT_PATH);

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}_${timestamp}.${options?.type || 'png'}`;
    const filepath = path.join(Config.SCREENSHOT_PATH, filename);

    log.action(`Taking screenshot: ${filename}`);

    // Take screenshot
    await this.page.screenshot({
      path: filepath,
      fullPage: options?.fullPage ?? true,
      quality: options?.type === 'jpeg' ? (options.quality || Config.SCREENSHOT_QUALITY) : undefined,
      type: options?.type || 'png'
    });

    this.screenshotCount++;
    log.info(`Screenshot saved: ${filepath}`);

    return filepath;
  }

  /**
   * Get current page URL
   */
  async getCurrentUrl(): Promise<string> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }
    return this.page.url();
  }


  /**
   * Evaluate JavaScript in page context
   */
  async evaluate<T>(fn: () => T): Promise<T> {
    await this.ensurePageActive();
    
    if (!this.page) {
      throw new Error('Browser not initialized');
    }
    return await this.page.evaluate(fn);
  }

  /**
   * Close browser
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
   * Get page instance
   */
  getPage(): Page | null {
    return this.page;
  }
  
  /**
   * Check if page is still active and reopen if needed
   */
  async ensurePageActive(): Promise<void> {
    try {
      // Check if page is closed or crashed
      if (!this.page || this.page.isClosed()) {
        log.warn('[BROWSER] Page was closed, reopening...');
        
        // Create new page in existing context
        if (this.context && !this.context.pages().length) {
          this.page = await this.context.newPage();
          
          // Navigate back to last known URL if available
          const lastUrl = await this.getCurrentUrlSafe();
          if (lastUrl && lastUrl !== 'about:blank') {
            await this.page.goto(lastUrl);
          }
        }
      }
    } catch (error) {
      log.error('[BROWSER] Failed to ensure page is active', error as Error);
      throw new Error('Browser page is not available');
    }
  }
  
  /**
   * Get current URL safely without throwing
   */
  private async getCurrentUrlSafe(): Promise<string | null> {
    try {
      if (this.page && !this.page.isClosed()) {
        return this.page.url();
      }
    } catch {
      // Ignore errors
    }
    return null;
  }
} 