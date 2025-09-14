import { Page, BrowserContext, Browser } from 'playwright';
import { 
  BrowserAction, 
  BrowserConfig, 
  ScreenshotOptions,
  ClickAction,
  TypeAction,
  NavigateAction,
  WaitAction,
  ScrollAction,
  SelectAction,
  ScreenshotAction,
  PressAction,
  GoBackAction,
  GoForwardAction,
  ReloadAction
} from '../../../types';
import { IBrowserAutomation } from './IBrowserAutomation';
import { log } from '../../../utils/logger';
import path from 'path';
import fs from 'fs-extra';

/**
 * Base class for browser automation implementations
 */
export abstract class BrowserAutomationBase implements IBrowserAutomation {
  protected browser: Browser | null = null;
  protected context: BrowserContext | null = null;
  protected page: Page | null = null;
  protected config: BrowserConfig;
  protected screenshotCount = 0;

  constructor(config?: Partial<BrowserConfig>) {
    this.config = { ...this.getDefaultConfig(), ...config };
  }

  abstract initialize(): Promise<void>;
  abstract close(): Promise<void>;

  get currentPage(): Page | null {
    return this.page;
  }

  isConnected(): boolean {
    return !!this.browser && this.browser.isConnected();
  }

  /**
   * Get default browser configuration
   */
  protected abstract getDefaultConfig(): BrowserConfig;

  /**
   * Execute single browser action
   */
  async executeAction(action: BrowserAction): Promise<any> {
    const startTime = Date.now();
    log.info(`[ACTION] ${action.type}: ${JSON.stringify(action)}`);
    
    try {
      await this.ensurePageActive();
      
      let result: any;
      
      switch (action.type) {
        case 'navigate':
          result = await this.navigate(action as NavigateAction);
          break;
        case 'click':
          result = await this.click(action as ClickAction);
          break;
        case 'type':
          result = await this.type(action as TypeAction);
          break;
        case 'wait':
          result = await this.wait(action as WaitAction);
          break;
        case 'scroll':
          result = await this.scroll(action as ScrollAction);
          break;
        case 'select':
          result = await this.select(action as SelectAction);
          break;
        case 'screenshot':
          result = await this.screenshot(action as ScreenshotAction);
          break;
        case 'press':
          result = await this.press(action as PressAction);
          break;
        case 'goBack':
          result = await this.goBack(action as GoBackAction);
          break;
        case 'goForward':
          result = await this.goForward(action as GoForwardAction);
          break;
        case 'reload':
          result = await this.reload(action as ReloadAction);
          break;
        default:
          throw new Error(`Unknown action type: ${(action as any).type}`);
      }
      
      const duration = Date.now() - startTime;
      const pageUrl = await this.getCurrentUrl();
      
      log.info(`[PERFORMANCE] Action ${action.type} completed in ${duration}ms`);
      
      return {
        action,
        ...result,
        duration,
        pageUrl,
        elementFound: true,
        success: true
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const pageUrl = await this.getCurrentUrl();
      log.error(`Action ${action.type} failed after ${duration}ms`, error as Error);
      
      return {
        action,
        duration,
        pageUrl,
        elementFound: false,
        success: false,
        error: (error as Error).message
      };
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
   * Get current page HTML
   */
  async getPageHTML(): Promise<string> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }
    
    try {
      return await this.page.content();
    } catch (error) {
      log.error('Failed to get page HTML', error as Error);
      return '';
    }
  }

  /**
   * Get current page URL
   */
  async getCurrentUrl(): Promise<string> {
    try {
      if (!this.page) return '';
      return await this.page.url();
    } catch (error) {
      log.debug('Failed to get current URL: ' + (error as Error).message);
      return '';
    }
  }

  /**
   * Take screenshot with specified options
   */
  async takeScreenshot(name: string, options?: ScreenshotOptions): Promise<string> {
    await this.ensurePageActive();
    
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    const screenshotPath = this.config.screenshotPath || './screenshots';
    await fs.ensureDir(screenshotPath);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}_${timestamp}.${options?.type || 'png'}`;
    const filepath = path.join(screenshotPath, filename);

    log.action(`Taking screenshot: ${filename}`);

    await this.page.screenshot({
      path: filepath,
      fullPage: options?.fullPage ?? true,
      quality: options?.type === 'jpeg' ? (options.quality || 80) : undefined,
      type: options?.type || 'png'
    });

    this.screenshotCount++;
    log.info(`Screenshot saved: ${filepath}`);

    return filepath;
  }

  /**
   * Take high-quality screenshot for analysis
   */
  async takeHighQualityScreenshot(name: string, includeFullPage: boolean = true): Promise<string> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    const screenshotPath = this.config.screenshotPath || './screenshots';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}_${timestamp}.png`;
    const filepath = path.join(screenshotPath, filename);
    
    await fs.ensureDir(path.dirname(filepath));
    
    try {
      await this.page.screenshot({
        path: filepath,
        fullPage: includeFullPage,
        type: 'png'
      });
      
      log.info(`High-quality screenshot saved: ${filepath}`);
      return filepath;
    } catch (error) {
      log.error('Failed to take high-quality screenshot', error as Error);
      throw error;
    }
  }

  /**
   * Capture failure context
   */
  async captureFailureContext(stepDescription: string): Promise<{ html: string; screenshotPath: string }> {
    log.info(`[FAILURE_CONTEXT] Capturing context for failed step: ${stepDescription}`);
    
    try {
      const html = await this.getPageHTML();
      
      log.info(`[FAILURE_CONTEXT] Captured HTML length: ${html.length} characters`);
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const htmlFilename = `failure_${stepDescription.replace(/\s+/g, '_')}_${timestamp}.html`;
      const htmlPath = path.join('./logs', htmlFilename);
      await fs.ensureDir(path.dirname(htmlPath));
      await fs.writeFile(htmlPath, html);
      log.info(`[FAILURE_CONTEXT] HTML saved to: ${htmlPath}`);
      
      const screenshotPath = await this.takeHighQualityScreenshot(
        `failure_${stepDescription.replace(/\s+/g, '_')}`
      );
      
      return { html, screenshotPath };
    } catch (error) {
      log.error('Failed to capture failure context', error as Error);
      return { html: '', screenshotPath: '' };
    }
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
   * Ensure page is active and reopen if needed
   */
  protected async ensurePageActive(): Promise<void> {
    try {
      if (!this.page || this.page.isClosed()) {
        log.warn('[BROWSER] Page was closed, reopening...');
        
        if (this.context && !this.context.pages().length) {
          this.page = await this.context.newPage();
          
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

  /**
   * Action implementations - to be overridden by subclasses if needed
   */
  protected async navigate(action: NavigateAction): Promise<void> {
    log.action(`Navigating to ${action.url}`);
    await this.page!.goto(action.url, {
      waitUntil: action.waitUntil || 'load'
    });
  }

  protected async click(action: ClickAction): Promise<void> {
    log.action(`Clicking ${Array.isArray(action.selector) ? action.selector[0] + '...' : action.selector}`);
    const selector = await this.findWorkingSelector(action.selector);
    await this.page!.click(selector, action.options);
  }

  protected async type(action: TypeAction): Promise<void> {
    log.action(`Typing in ${Array.isArray(action.selector) ? action.selector[0] + '...' : action.selector}`);
    const selector = await this.findWorkingSelector(action.selector);
    await this.page!.fill(selector, action.text);
  }

  protected async wait(action: WaitAction): Promise<void> {
    if (action.duration) {
      log.action(`Waiting ${action.duration}ms`);
      await this.page!.waitForTimeout(action.duration);
    } else if (action.selector) {
      const selector = await this.findWorkingSelector(action.selector);
      log.action(`Waiting for ${selector}`);
      await this.page!.waitForSelector(selector, {
        state: action.state || 'visible'
      });
    } else {
      await this.page!.waitForTimeout(2000);
    }
  }

  protected async scroll(action: ScrollAction): Promise<void> {
    if (action.selector) {
      const selector = await this.findWorkingSelector(action.selector);
      log.action(`Scrolling element ${selector}`);
      await this.page!.locator(selector).scrollIntoViewIfNeeded();
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

  protected async select(action: SelectAction): Promise<void> {
    const selector = await this.findWorkingSelector(action.selector);
    log.action(`Selecting ${action.value} in ${selector}`);
    await this.page!.selectOption(selector, action.value);
  }

  protected async screenshot(action: ScreenshotAction): Promise<string> {
    return await this.takeScreenshot(action.name, action.options);
  }

  protected async press(action: PressAction): Promise<void> {
    if (action.selector) {
      const selector = await this.findWorkingSelector(action.selector);
      log.action(`Pressing ${action.key} in ${selector}`);
      await this.page!.press(selector, action.key);
    } else {
      log.action(`Pressing ${action.key}`);
      await this.page!.keyboard.press(action.key);
    }
  }

  protected async goBack(action: GoBackAction): Promise<void> {
    log.action('Going back in browser history');
    await this.page!.goBack({
      waitUntil: action.waitUntil || 'load',
      timeout: 30000
    });
  }

  protected async goForward(action: GoForwardAction): Promise<void> {
    log.action('Going forward in browser history');
    await this.page!.goForward({
      waitUntil: action.waitUntil || 'load',
      timeout: 30000
    });
  }

  protected async reload(action: ReloadAction): Promise<void> {
    log.action('Reloading page');
    await this.page!.reload({
      waitUntil: action.waitUntil || 'load',
      timeout: 30000
    });
  }

  /**
   * Find working selector from array of candidates
   */
  protected async findWorkingSelector(selectors: string | string[]): Promise<string> {
    if (!Array.isArray(selectors)) {
      return selectors;
    }

    if (!this.page) {
      throw new Error('Page not initialized');
    }

    for (const selector of selectors) {
      try {
        const locator = this.page.locator(selector).first();
        if (await locator.count() > 0) {
          const isVisible = await locator.isVisible({ timeout: 1000 }).catch(() => false);
          if (isVisible) {
            log.info(`[SELECTOR] Found visible element with: ${selector}`);
            return selector;
          }
        }
      } catch {
        // Continue trying
      }
    }

    return selectors[0];
  }
}

