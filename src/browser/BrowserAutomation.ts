import { chromium, firefox, webkit, Browser, BrowserContext, Page, Locator } from 'playwright';
import path from 'path';
import fs from 'fs-extra';
import { 
  BrowserConfig, 
  BrowserAction, 
  IBrowserAutomation,
  ScreenshotOptions,
  NavigateAction,
  ClickAction,
  TypeAction,
  WaitAction,
  ScrollAction,
  SelectAction,
  ScreenshotAction,
  PressAction,
  GoBackAction,
  GoForwardAction,
  ReloadAction,
  NewTabAction,
  SwitchTabAction,
  CloseTabAction
} from '../types';
import { env } from '../config/environment';
import { defaultBrowserConfig } from '../config/browser.config';
import { log } from '../utils/logger';

/**
 * Browser automation class using Playwright
 */
export class BrowserAutomation implements IBrowserAutomation {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: BrowserConfig;
  private screenshotCount = 0;

  constructor(config?: Partial<BrowserConfig>) {
    this.config = { ...defaultBrowserConfig, ...config };
  }

  /**
   * Get the current page instance
   */
  get currentPage(): Page | null {
    return this.page;
  }

  /**
   * Initialize browser
   */
  async initialize(): Promise<void> {
    try {
      log.info('Initializing browser...');
      
      // Launch browser based on type
      const browserType = this.getBrowserType();
      const launchArgs = [
        ...(this.config.args || []),
        '--disable-blink-features=AutomationControlled',
        '--no-default-browser-check',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-dev-shm-usage'
      ];
      this.browser = await browserType.launch({
        headless: this.config.headless,
        args: launchArgs
      });

      // Create context with viewport and anti-detection settings
      const contextOptions: Parameters<typeof this.browser.newContext>[0] = {
        viewport: this.config.viewport,
        ignoreHTTPSErrors: true,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: this.config.locale || 'en-US',
        timezoneId: this.config.timezoneId || 'America/Los_Angeles'
      };
      this.context = await this.browser.newContext(contextOptions);

      // Set default timeouts
      this.context.setDefaultTimeout(this.config.timeout);
      this.context.setDefaultNavigationTimeout(this.config.navigationTimeout);

      // Create new page
      this.page = await this.context.newPage();
      
      // Inject stealth/anti-detection scripts and set up humanization
      if (this.config.stealth !== false) {
        await this.injectAntiDetection();
      }
      if (this.config.humanize) {
        await this.installHumanizedCursor();
      }
      
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

    // Plugins length spoofing
    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });
    });

    // Chrome runtime spoof
    await this.context.addInitScript(() => {
      // @ts-ignore
      window.chrome = { runtime: {} };
    });

    // Permissions query interception for notifications
    await this.context.addInitScript(() => {
      const originalQuery = window.navigator.permissions && window.navigator.permissions.query;
      if (originalQuery) {
        window.navigator.permissions.query = ((parameters: any) => {
          if (parameters && parameters.name === 'notifications') {
            return Promise.resolve(({
              state: Notification.permission
            }) as unknown as PermissionStatus);
          }
          return originalQuery(parameters as PermissionDescriptor);
        }) as unknown as typeof originalQuery;
      }
    });
  }

  /**
   * Install a human-like cursor overlay and movement helpers
   */
  private async installHumanizedCursor(): Promise<void> {
    if (!this.page) return;

    // Cursor overlay (optional)
    if (this.config.cursorOverlay) {
      await this.page.addInitScript(() => {
        const style = document.createElement('style');
        style.textContent = `
          .__ai_cursor__ { position: fixed; top: 0; left: 0; width: 16px; height: 16px; border-radius: 50%; background: rgba(0,0,0,0.5); pointer-events: none; z-index: 2147483647; transform: translate(-50%, -50%); }
        `;
        document.documentElement.appendChild(style);
        const cursor = document.createElement('div');
        cursor.className = '__ai_cursor__';
        document.body.appendChild(cursor);
        // Expose to window for movement
        // @ts-ignore
        window.__ai_cursor_el__ = cursor;
      });
    }

    // Expose a function to move cursor in small human-like steps
    await this.page.exposeFunction('__ai_move_cursor__', async (x: number, y: number) => {
      // noop in Node context; real movement occurs via page.mouse in caller
      return true;
    });
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
            this.page.locator('textarea[name="q"]:visible').first(),  // Google uses textarea - check first
            this.page.getByRole('searchbox').first(),
            this.page.getByRole('textbox', { name: /search|find|query|keyword/i }).first(),
            this.page.locator('input[type="search"]:visible').first(),
            this.page.locator('input[placeholder*="search" i]:visible').first(),
            this.page.locator('input[placeholder*="find" i]:visible').first(),
            this.page.locator('input[name="q"]:visible').first(),
            this.page.locator('input[name="search"]:visible').first(),
            this.page.locator('input[name="term"]:visible').first(),
            this.page.locator('#search:visible').first(),
            this.page.locator('.search-input:visible').first(),
            this.page.locator('.search-box:visible').first(),
            // Note: Avoid input[aria-label*="search"] as it may match submit buttons
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
   * Execute single action
   */
  async executeAction(action: BrowserAction): Promise<any> {
    // Track performance for all actions
    const startTime = Date.now();
    
    // Log the action being performed (similar to MCP mode)
    log.info(`[ACTION] ${action.type}: ${JSON.stringify(action)}`);
    
    try {
      // Ensure page is active before any action
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
        case 'newTab':
          result = await this.newTab(action as NewTabAction);
          break;
        case 'switchTab':
          result = await this.switchTab(action as SwitchTabAction);
          break;
        case 'closeTab':
          result = await this.closeTab(action as CloseTabAction);
          break;
        default:
          throw new Error(`Unknown action type: ${(action as any).type}`);
      }
      
      // Get current page URL after action
      const pageUrl = await this.getCurrentUrl();
      
      // Track performance (similar to MCP mode)
      const duration = Date.now() - startTime;
      log.info(`[PERFORMANCE] Action ${action.type} completed in ${duration}ms`);
      
      // Return enriched result with timing and status
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
      
      // Return error result with timing
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
    // Move mouse to element center with human-like small steps before clicking
    const box = await locator.boundingBox();
    if (box && this.page) {
      const targetX = box.x + box.width / 2;
      const targetY = box.y + box.height / 2;
      await this.humanMouseMove(targetX, targetY);
    }
    await locator.click(action.options);
  }

  /**
   * Type text
   */
  private async type(action: TypeAction): Promise<void> {
    log.action(`Typing in ${Array.isArray(action.selector) ? action.selector[0] + '...' : action.selector}`, { textLength: action.text.length });
    
    // Use smart locator to find element, with 'search' hint for better fallback
    const locator = await this.smartLocator(action.selector, 'search');
    // Move cursor to input before typing
    const box = await locator.boundingBox();
    if (box && this.page) {
      const targetX = box.x + Math.min(box.width - 4, 8);
      const targetY = box.y + Math.min(box.height - 4, 8);
      await this.humanMouseMove(targetX, targetY);
    }
    
    // Clear existing text and type new text
    await locator.fill(action.text);
  }

  /**
   * Human-like mouse move with jitter and segmented motion
   */
  private async humanMouseMove(x: number, y: number): Promise<void> {
    if (!this.page) return;
    try {
      const startX = 0;
      const startY = 0;
      const dx = x - startX;
      const dy = y - startY;
      const distance = Math.hypot(dx, dy);
      const steps = Math.max(8, Math.min(25, Math.round(distance / 20)));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        const jitterX = (Math.random() - 0.5) * 2;
        const jitterY = (Math.random() - 0.5) * 2;
        const nx = startX + dx * ease + jitterX;
        const ny = startY + dy * ease + jitterY;
        await this.page.mouse.move(nx, ny, { steps: 1 });
        await this.page.waitForTimeout(5 + Math.floor(Math.random() * 10));
      }
      // Update overlay if present
      if (this.config.cursorOverlay) {
        await this.page.evaluate(([cx, cy]) => {
          // @ts-ignore
          const el = window.__ai_cursor_el__ as HTMLElement | undefined;
          if (el) {
            el.style.transform = `translate(${cx}px, ${cy}px)`;
          }
        }, [x, y]);
      }
    } catch {}
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
    } else if (action.selector && action.selector !== undefined) {
      const selectorStr = Array.isArray(action.selector) ? action.selector[0] : action.selector;
      log.action(`Waiting for ${selectorStr}`, { state: action.state });
      
      // For wait actions, we just need to wait for any of the selectors
      const candidates = Array.isArray(action.selector) ? action.selector : [action.selector];
      
      // Filter out undefined/null selectors
      const validCandidates = candidates.filter(s => s && typeof s === 'string');
      
      if (validCandidates.length === 0) {
        // No valid selectors, fall back to a default timeout
        log.action('No valid selectors provided, falling back to 2000ms timeout');
        await this.page!.waitForTimeout(2000);
        return;
      }
      
      // Try each selector until one is found
      let found = false;
      for (const selector of validCandidates) {
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
        throw new Error(`None of the selectors became ${action.state || 'visible'}: ${validCandidates.join(', ')}`);
      }
    } else {
      // No duration or selector specified, use default timeout
      log.action('No duration or selector specified, using default 2000ms timeout');
      await this.page!.waitForTimeout(2000);
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
   * Go back in browser history
   */
  private async goBack(action: GoBackAction): Promise<void> {
    log.action('Going back in browser history');
    await this.page!.goBack({
      waitUntil: action.waitUntil || 'load',
      timeout: 30000
    });
  }

  /**
   * Go forward in browser history
   */
  private async goForward(action: GoForwardAction): Promise<void> {
    log.action('Going forward in browser history');
    await this.page!.goForward({
      waitUntil: action.waitUntil || 'load',
      timeout: 30000
    });
  }

  /**
   * Reload the current page
   */
  private async reload(action: ReloadAction): Promise<void> {
    log.action('Reloading page');
    await this.page!.reload({
      waitUntil: action.waitUntil || 'load',
      timeout: 30000
    });
  }

  /**
   * Open a new tab
   */
  private async newTab(action: NewTabAction): Promise<void> {
    log.action(`Opening new tab${action.url ? ` with URL: ${action.url}` : ''}`);
    const newPage = await this.context!.newPage();
    
    if (action.url) {
      await newPage.goto(action.url, {
        waitUntil: 'load',
        timeout: 30000
      });
    }
    
    // Switch to the new tab
    this.page = newPage;
    await this.ensurePageActive();
  }

  /**
   * Switch between tabs
   */
  private async switchTab(action: SwitchTabAction): Promise<void> {
    const pages = this.context!.pages();
    
    if (action.index !== undefined) {
      log.action(`Switching to tab at index ${action.index}`);
      if (action.index >= 0 && action.index < pages.length) {
        this.page = pages[action.index];
        await this.page.bringToFront();
      } else {
        throw new Error(`Tab index ${action.index} out of range (0-${pages.length - 1})`);
      }
    } else if (action.url) {
      log.action(`Switching to tab with URL containing: ${action.url}`);
      const matchingPage = pages.find(page => page.url().includes(action.url!));
      if (matchingPage) {
        this.page = matchingPage;
        await this.page.bringToFront();
      } else {
        throw new Error(`No tab found with URL containing: ${action.url}`);
      }
    } else if (action.title) {
      log.action(`Switching to tab with title containing: ${action.title}`);
      for (const page of pages) {
        const title = await page.title();
        if (title.includes(action.title)) {
          this.page = page;
          await this.page.bringToFront();
          return;
        }
      }
      throw new Error(`No tab found with title containing: ${action.title}`);
    } else {
      throw new Error('SwitchTab action requires either index, url, or title');
    }
    
    await this.ensurePageActive();
  }

  /**
   * Close a tab
   */
  private async closeTab(action: CloseTabAction): Promise<void> {
    const pages = this.context!.pages();
    
    if (pages.length === 1) {
      throw new Error('Cannot close the last tab');
    }
    
    if (action.index !== undefined) {
      log.action(`Closing tab at index ${action.index}`);
      if (action.index >= 0 && action.index < pages.length) {
        const pageToClose = pages[action.index];
        const isCurrentPage = pageToClose === this.page;
        
        await pageToClose.close();
        
        // If we closed the current page, switch to another one
        if (isCurrentPage) {
          const remainingPages = this.context!.pages();
          this.page = remainingPages[remainingPages.length - 1];
          await this.ensurePageActive();
        }
      } else {
        throw new Error(`Tab index ${action.index} out of range (0-${pages.length - 1})`);
      }
    } else {
      log.action('Closing current tab');
      const currentPage = this.page!;
      const currentIndex = pages.indexOf(currentPage);
      
      // Switch to another tab before closing
      const newIndex = currentIndex > 0 ? currentIndex - 1 : 1;
      this.page = pages[newIndex];
      await this.ensurePageActive();
      
      await currentPage.close();
    }
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
    const screenshotPath = this.config.screenshotPath || './screenshots';
    await fs.ensureDir(screenshotPath);

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}_${timestamp}.${options?.type || 'png'}`;
    const filepath = path.join(screenshotPath, filename);

    log.action(`Taking screenshot: ${filename}`);

    // Take screenshot
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
   * Check if browser is running
   */
  isConnected(): boolean {
    return !!this.browser && this.browser.isConnected();
  }

  /**
   * Debug: analyze modal overlays on current page
   */
  async debugModalOverlays(): Promise<any> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    return await this.page.evaluate(() => {
      // Find potential modal elements
      const modalSelectors = [
        '[role="dialog"]',
        '[role="alert"]',
        '[role="alertdialog"]',
        '.modal',
        '.dialog',
        '.popup',
        '[class*="modal"]',
        '[class*="dialog"]',
        '[class*="overlay"]',
        'div[style*="z-index"][style*="position: fixed"]',
        'div[style*="z-index"][style*="position: absolute"]'
      ];
      
      const modals = modalSelectors.flatMap(selector => 
        Array.from(document.querySelectorAll(selector))
      );
      
      const modalInfo = modals.map(modal => {
        const style = window.getComputedStyle(modal);
        const rect = modal.getBoundingClientRect();
        const isVisible = style.display !== 'none' && 
                         style.visibility !== 'hidden' && 
                         parseFloat(style.opacity) > 0 &&
                         rect.width > 0 && 
                         rect.height > 0;
        
        return {
          element: modal.tagName.toLowerCase() + 
                  (modal.id ? `#${modal.id}` : '') + 
                  (modal.className ? `.${modal.className.split(' ').filter(c => c).join('.')}` : ''),
          visible: isVisible,
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          position: style.position,
          zIndex: style.zIndex,
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left,
          innerHTML: modal.innerHTML.substring(0, 100) + '...'
        };
      });
      
      // Also check for inputs and their state
      const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], input:not([type])'));
      const inputInfo = inputs.map(input => {
        const inputEl = input as HTMLInputElement;
        const style = window.getComputedStyle(inputEl);
        const rect = inputEl.getBoundingClientRect();
        const isInteractable = style.display !== 'none' && 
                              style.visibility !== 'hidden' && 
                              !inputEl.disabled &&
                              rect.width > 0 && 
                              rect.height > 0;
        
        return {
          selector: inputEl.tagName.toLowerCase() + 
                   (inputEl.id ? `#${inputEl.id}` : '') + 
                   (inputEl.name ? `[name="${inputEl.name}"]` : '') +
                   (inputEl.type ? `[type="${inputEl.type}"]` : ''),
          interactable: isInteractable,
          disabled: inputEl.disabled,
          readOnly: inputEl.readOnly,
          display: style.display,
          visibility: style.visibility,
          zIndex: style.zIndex,
          position: style.position,
          placeholder: inputEl.placeholder,
          value: inputEl.value
        };
      });
      
      return {
        modals: modalInfo,
        visibleModalCount: modalInfo.filter(m => m.visible).length,
        inputs: inputInfo,
        interactableInputCount: inputInfo.filter(i => i.interactable).length,
        documentReadyState: document.readyState,
        activeElement: document.activeElement?.tagName + 
                      (document.activeElement?.id ? `#${document.activeElement.id}` : '')
      };
    });
  }

  async captureSessionState(): Promise<{
    cookies: any[];
    localStorage: Record<string, string>;
    sessionStorage: Record<string, string>;
    url: string;
    title: string;
    viewport: { width: number; height: number } | null;
  }> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    try {
      const [cookies, storageData, url, title, viewport] = await Promise.all([
        this.context!.cookies(),
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
   * Restore browser session state
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
      // Restore cookies
      if (state.cookies) {
        await this.context.addCookies(state.cookies);
      }

      // Restore viewport
      if (state.viewport) {
        await this.page.setViewportSize(state.viewport);
      }

      // Navigate to URL if provided
      if (state.url) {
        await this.page.goto(state.url);
      }

      // Restore storage
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

  /**
   * Save session state to file
   */
  async saveSessionStateToFile(filepath: string): Promise<void> {
    const state = await this.captureSessionState();
    await fs.ensureDir(path.dirname(filepath));
    await fs.writeJson(filepath, state, { spaces: 2 });
    log.info(`Session state saved to: ${filepath}`);
  }

  /**
   * Load session state from file
   */
  async loadSessionStateFromFile(filepath: string): Promise<void> {
    const state = await fs.readJson(filepath);
    await this.restoreSessionState(state);
    log.info(`Session state loaded from: ${filepath}`);
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

  /**
   * Get current page HTML content
   */
  async getPageHTML(): Promise<string> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }
    
    try {
      const html = await this.page.content();
      return html;
    } catch (error) {
      log.error('Failed to get page HTML', error as Error);
      return '';
    }
  }

  /**
   * Take a high-quality screenshot with error context
   */
  async takeHighQualityScreenshot(name: string, includeFullPage: boolean = true): Promise<string> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}_${timestamp}.png`;
    const filepath = path.join(this.config.screenshotPath || './screenshots', filename);
    
    await fs.ensureDir(path.dirname(filepath));
    
    try {
      await this.page.screenshot({
        path: filepath,
        fullPage: includeFullPage,
        type: 'png'  // PNG for highest quality, no compression
      });
      
      log.info(`High-quality screenshot saved: ${filepath}`);
      return filepath;
    } catch (error) {
      log.error('Failed to take high-quality screenshot', error as Error);
      throw error;
    }
  }

  /**
   * Capture failure context (HTML + Screenshot)
   */
  async captureFailureContext(stepDescription: string): Promise<{ html: string; screenshotPath: string }> {
    log.info(`[FAILURE_CONTEXT] Capturing context for failed step: ${stepDescription}`);
    
    try {
      // Capture HTML first (most important for debugging)
      const html = await this.getPageHTML();
      
      // Log HTML details
      log.info(`[FAILURE_CONTEXT] Captured HTML length: ${html.length} characters`);
      
      // Save HTML to file for debugging
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const htmlFilename = `failure_${stepDescription.replace(/\s+/g, '_')}_${timestamp}.html`;
      const htmlPath = path.join('./logs', htmlFilename);
      await fs.ensureDir(path.dirname(htmlPath));
      await fs.writeFile(htmlPath, html);
      log.info(`[FAILURE_CONTEXT] HTML saved to: ${htmlPath}`);
      
      // Log first 2000 chars of HTML for immediate debugging
      const htmlPreview = html.slice(0, 2000);
      log.debug(`[FAILURE_CONTEXT] HTML preview:\n${htmlPreview}\n... (truncated)`);
      
      // Take high-quality screenshot
      const screenshotPath = await this.takeHighQualityScreenshot(`failure_${stepDescription.replace(/\s+/g, '_')}`);
      
      // Log key page information
      const pageInfo = await this.page!.evaluate(() => {
        // Check for actually visible modals
        const modalSelectors = '[role="dialog"], .modal, .popup, .overlay, [class*="modal"], [id*="modal"]';
        const modals = Array.from(document.querySelectorAll(modalSelectors));
        
        // Filter for actually visible modals
        const visibleModals = modals.filter(modal => {
          const style = window.getComputedStyle(modal);
          const rect = modal.getBoundingClientRect();
          const isVisible = style.display !== 'none' && 
                           style.visibility !== 'hidden' && 
                           style.opacity !== '0' &&
                           rect.width > 0 && 
                           rect.height > 0;
          return isVisible;
        });
        
        // Collect modal debug info
        const modalDebugInfo = visibleModals.map(modal => ({
          selector: modal.tagName.toLowerCase() + 
                   (modal.id ? `#${modal.id}` : '') + 
                   (modal.className ? `.${modal.className.split(' ').join('.')}` : ''),
          display: window.getComputedStyle(modal).display,
          visibility: window.getComputedStyle(modal).visibility,
          opacity: window.getComputedStyle(modal).opacity,
          zIndex: window.getComputedStyle(modal).zIndex,
          position: window.getComputedStyle(modal).position,
          dimensions: `${modal.getBoundingClientRect().width}x${modal.getBoundingClientRect().height}`
        }));
        
        return {
          title: document.title,
          url: window.location.href,
          readyState: document.readyState,
          hasCaptcha: !!document.querySelector('[class*="captcha"], [id*="captcha"], iframe[src*="recaptcha"], iframe[src*="hcaptcha"]'),
          hasModal: visibleModals.length > 0,
          modalCount: visibleModals.length,
          modalDebugInfo: modalDebugInfo,
          formCount: document.querySelectorAll('form').length,
          inputCount: document.querySelectorAll('input, textarea, select').length,
          buttonCount: document.querySelectorAll('button, input[type="submit"], input[type="button"]').length
        };
      });
      
      log.info(`[FAILURE_CONTEXT] Page info: ${JSON.stringify(pageInfo, null, 2)}`);
      
      return { html, screenshotPath };
    } catch (error) {
      log.error('Failed to capture failure context', error as Error);
      return { html: '', screenshotPath: '' };
    }
  }

  /**
   * Enhanced execute action with failure context capture
   */
  async executeActionWithContext(action: BrowserAction): Promise<{ success: boolean; context?: { html: string; screenshotPath: string } }> {
    try {
      await this.executeAction(action);
      return { success: true };
    } catch (error) {
      // Capture context on failure
      const context = await this.captureFailureContext(`${action.type} action`);
      return { success: false, context };
    }
  }

  /**
   * Debug method to check for blocking elements on the page
   */
  async debugPageBlockers(): Promise<any> {
    return await this.page!.evaluate(() => {
      const modalSelectors = '[role="dialog"], .modal, .popup, .overlay, [class*="modal"], [id*="modal"]';
      const allModals = Array.from(document.querySelectorAll(modalSelectors));
      
      const modalInfo = allModals.map(modal => {
        const style = window.getComputedStyle(modal);
        const rect = modal.getBoundingClientRect();
        const isVisible = style.display !== 'none' && 
                         style.visibility !== 'hidden' && 
                         style.opacity !== '0' &&
                         rect.width > 0 && 
                         rect.height > 0;
        
        return {
          element: modal.tagName.toLowerCase() + 
                  (modal.id ? `#${modal.id}` : ''),
          visible: isVisible
        };
      });
      
      return {
        modals: modalInfo,
        count: modalInfo.length,
        visibleCount: modalInfo.filter(m => m.visible).length
      };
    });
  }
}