import { Page } from 'playwright';
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
import { log } from '../utils/logger';
import { MCPClient } from './MCPClient';

/**
 * Browser automation implementation using MCP protocol
 */
export class MCPBrowserAutomation implements IBrowserAutomation {
  private mcpClient: MCPClient;
  private currentTabIndex = 0;
  private isInitialized = false;

  constructor(_config?: Partial<BrowserConfig>) {
    this.mcpClient = new MCPClient();
  }

  /**
   * Get the current page instance (not available in MCP mode)
   */
  get currentPage(): Page | null {
    log.warn('Direct page access not available in MCP mode');
    return null;
  }

  /**
   * Initialize browser through MCP
   */
  async initialize(): Promise<void> {
    try {
      // Start the MCP server process
      await this.mcpClient.start();
      
      // The MCP server is now ready
      // playwright-mcp doesn't require explicit initialization

      // The MCP server manages the browser instance
      this.isInitialized = true;
      log.info('[MCP] Browser initialized through MCP server');
      
      // MCP server manages initial navigation
    } catch (error) {
      log.error('[MCP] Failed to initialize browser', error as Error);
      throw error;
    }
  }

  /**
   * Execute a browser action through MCP
   */
  async executeAction(action: BrowserAction): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    log.info(`[ACTION] ${action.type}: ${JSON.stringify(action)}`);
    const startTime = Date.now();

    try {
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
        case 'press':
          await this.press(action as PressAction);
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
        case 'goBack':
          await this.goBack(action as GoBackAction);
          break;
        case 'goForward':
          await this.goForward(action as GoForwardAction);
          break;
        case 'reload':
          await this.reload(action as ReloadAction);
          break;
        case 'newTab':
          await this.newTab(action as NewTabAction);
          break;
        case 'switchTab':
          await this.switchTab(action as SwitchTabAction);
          break;
        case 'closeTab':
          await this.closeTab(action as CloseTabAction);
          break;
        default:
          throw new Error(`Unsupported action type: ${(action as any).type}`);
      }

      log.info(`[PERFORMANCE] Action ${action.type} completed in ${Date.now() - startTime}ms`);
    } catch (error) {
      log.error(`Failed to execute action: ${action.type}`, error as Error);
      throw error;
    }
  }

  /**
   * Execute multiple actions
   */
  async executeActions(actions: BrowserAction[]): Promise<void> {
    for (const action of actions) {
      await this.executeAction(action);
    }
  }

  private async navigate(action: NavigateAction): Promise<void> {
    // Use the correct tool name: browser_navigate
    await this.mcpClient.call('tools/call', {
      name: 'browser_navigate',
      arguments: { url: action.url }
    });
  }

  private async click(action: ClickAction): Promise<void> {
    const selectors = Array.isArray(action.selector) ? action.selector : [action.selector];
    const elementDescription = this.selectorToDescription(selectors[0]);
    try {
      const result = await this.mcpClient.call('tools/call', {
        name: 'browser_click',
        arguments: {
          element: elementDescription
        }
      });
      if (result?.error) throw new Error(result.error);
    } catch (error) {
      log.error(`[MCP] Failed to click "${elementDescription}":`, error as Error);
      throw error;
    }
  }

  private async type(action: TypeAction): Promise<void> {
    const selectors = Array.isArray(action.selector) ? action.selector : [action.selector];
    const elementDescription = this.selectorToDescription(selectors[0]);
    try {
      const result = await this.mcpClient.call('tools/call', {
        name: 'browser_type',
        arguments: {
          element: elementDescription,
          text: action.text,
          submit: false
        }
      });
      if (result?.error) throw new Error(result.error);
    } catch (error) {
      log.error(`[MCP] Failed to type in "${elementDescription}":`, error as Error);
      throw error;
    }
  }

  /**
   * Convert a CSS selector or Playwright selector to a human-readable description for MCP
   */
  private selectorToDescription(selector: string): string {
    if (!selector) return 'field';
    const s = selector.toLowerCase();
    if (s.includes('username')) return 'username field';
    if (s.includes('password')) return 'password field';
    if (s.includes('email')) return 'email field';
    if (s.includes('search')) return 'search field';
    if (s.includes('submit') || s.includes('login')) return 'submit button';
    if (s.includes('button')) return 'button';
    if (s.includes('checkbox')) return 'checkbox';
    if (s.includes('radio')) return 'radio button';
    if (s.includes('select')) return 'dropdown';
    if (s.includes('textarea')) return 'text area';
    if (s.includes('text')) return 'text field';
    // Placeholder extraction
    const placeholderMatch = selector.match(/placeholder=["']([^"']+)["']/);
    if (placeholderMatch) return `field with placeholder "${placeholderMatch[1]}"`;
    // Label extraction
    const labelMatch = selector.match(/:has-text\(["']([^"']+)["']\)/);
    if (labelMatch) return `field labeled "${labelMatch[1]}"`;
    // ID
    if (selector.startsWith('#')) return `field with id ${selector.slice(1)}`;
    // Class
    if (selector.startsWith('.')) return `field with class ${selector.slice(1)}`;
    // Fallback
    return 'field';
  }

  private async press(action: PressAction): Promise<void> {
    await this.mcpClient.call('tools/call', {
      name: 'browser_press_key',
      arguments: {
        key: action.key
      }
    });
  }

  private async wait(action: WaitAction): Promise<void> {
    if (action.duration) {
      // Wait for specific duration
      await this.mcpClient.call('tools/call', {
        name: 'browser_wait_for',
        arguments: {
          time: action.duration / 1000 // MCP uses seconds
        }
      });
    } else if (action.selector) {
      // Wait for element - MCP waits for text to appear
      const selector = Array.isArray(action.selector) ? action.selector[0] : action.selector;
      await this.mcpClient.call('tools/call', {
        name: 'browser_wait_for',
        arguments: {
          text: selector // MCP waits for text to appear
        }
      });
    }
  }

  private async scroll(action: ScrollAction): Promise<void> {
    if (action.selector) {
      const selector = Array.isArray(action.selector) ? action.selector[0] : action.selector;
      // MCP doesn't have direct scroll, but we can hover to bring element into view
      await this.mcpClient.call('tools/call', {
        name: 'browser_hover',
        arguments: {
          element: `Hover over ${selector}`,
          ref: selector
        }
      });
    }
    
    // For now, use press key for scrolling
    const key = action.direction === 'down' ? 'PageDown' : 'PageUp';
    const times = Math.ceil((action.amount || 500) / 100);
    
    for (let i = 0; i < times; i++) {
      await this.mcpClient.call('tools/call', {
        name: 'browser_press_key',
        arguments: { key }
      });
    }
  }

  private async select(action: SelectAction): Promise<void> {
    const selector = Array.isArray(action.selector) ? action.selector[0] : action.selector;
    
    await this.mcpClient.call('tools/call', {
      name: 'browser_select_option',
      arguments: {
        element: `Select option in ${selector}`,
        ref: selector,
        values: Array.isArray(action.value) ? action.value : [action.value]
      }
    });
  }

  private async screenshot(action: ScreenshotAction): Promise<string> {
    const filename = action.name || `screenshot-${Date.now()}.png`;
    
    const result = await this.mcpClient.call('tools/call', {
      name: 'browser_take_screenshot',
      arguments: {
        filename,
        fullPage: action.options?.fullPage
      }
    });
    
    return result.filename || filename;
  }

  private async goBack(_action: GoBackAction): Promise<void> {
    await this.mcpClient.call('tools/call', {
      name: 'browser_navigate_back',
      arguments: {}
    });
  }

  private async goForward(_action: GoForwardAction): Promise<void> {
    await this.mcpClient.call('tools/call', {
      name: 'browser_navigate_forward',
      arguments: {}
    });
  }

  private async reload(_action: ReloadAction): Promise<void> {
    // MCP doesn't have reload, so navigate to current URL
    const tabs = await this.mcpClient.call('tools/call', {
      name: 'browser_tab_list',
      arguments: {}
    });
    
    if (tabs && tabs.tabs && tabs.tabs[this.currentTabIndex]) {
      await this.mcpClient.call('tools/call', {
        name: 'browser_navigate',
        arguments: { url: tabs.tabs[this.currentTabIndex].url }
      });
    }
  }

  private async newTab(action: NewTabAction): Promise<void> {
    await this.mcpClient.call('tools/call', {
      name: 'browser_tab_new',
      arguments: { url: action.url }
    });
  }

  private async switchTab(action: SwitchTabAction): Promise<void> {
    if (action.index !== undefined) {
      await this.mcpClient.call('tools/call', {
        name: 'browser_tab_select',
        arguments: { index: action.index }
      });
      this.currentTabIndex = action.index;
    } else if (action.url) {
      // Find tab by URL
      const result = await this.mcpClient.call('tools/call', {
        name: 'browser_tab_list',
        arguments: {}
      });
      const tabs = result.tabs || [];
      const tabIndex = tabs.findIndex((tab: any) => tab.url.includes(action.url!));
      if (tabIndex >= 0) {
        await this.mcpClient.call('tools/call', {
          name: 'browser_tab_select',
          arguments: { index: tabIndex }
        });
        this.currentTabIndex = tabIndex;
      }
    }
  }

  private async closeTab(action: CloseTabAction): Promise<void> {
    await this.mcpClient.call('tools/call', {
      name: 'browser_tab_close',
      arguments: { index: action.index }
    });
  }

  /**
   * Take a screenshot
   */
  async takeScreenshot(name: string, options?: ScreenshotOptions): Promise<string> {
    const filename = `${name}-${Date.now()}.${options?.quality ? 'jpg' : 'png'}`;
    
    const result = await this.mcpClient.call('tools/call', {
      name: 'browser_take_screenshot',
      arguments: {
        filename,
        fullPage: options?.fullPage,
        raw: !options?.quality // Use PNG if no quality specified
      }
    });
    
    return result.path || filename;
  }

  /**
   * Get current URL
   */
  async getCurrentUrl(): Promise<string> {
    // MCP doesn't have direct URL getter, use tab list
    const result = await this.mcpClient.call('tools/call', {
      name: 'browser_tab_list',
      arguments: {}
    });
    const tabs = result.tabs || [];
    if (tabs[this.currentTabIndex]) {
      return tabs[this.currentTabIndex].url;
    }
    return '';
  }

  /**
   * Close browser
   */
  async close(): Promise<void> {
    // Use the browser_close tool
    await this.mcpClient.call('tools/call', {
      name: 'browser_close',
      arguments: {}
    });
    
    // Stop the MCP server process
    await this.mcpClient.stop();
    this.isInitialized = false;
    log.info('[MCP] Browser session closed');
  }

  /**
   * Get page HTML (through snapshot)
   */
  async getPageHTML(): Promise<string> {
    // MCP provides accessibility tree through browser_snapshot
    const result = await this.mcpClient.call('tools/call', {
      name: 'browser_snapshot',
      arguments: {}
    });
    return JSON.stringify(result, null, 2);
  }

  /**
   * Take high quality screenshot
   */
  async takeHighQualityScreenshot(name: string, includeFullPage: boolean = true): Promise<string> {
    const filename = `${name}-hq-${Date.now()}.png`;
    
    const result = await this.mcpClient.call('tools/call', {
      name: 'browser_take_screenshot',
      arguments: {
        filename,
        fullPage: includeFullPage,
        raw: true // PNG for high quality
      }
    });
    
    return result.filename || filename;
  }

  /**
   * Capture failure context
   */
  async captureFailureContext(stepDescription: string): Promise<{ html: string; screenshotPath: string }> {
    log.info(`[FAILURE_CONTEXT] Capturing context for failed step: ${stepDescription}`);
    
    // Get page snapshot
    const snapshot = await this.mcpClient.call('tools/call', {
      name: 'browser_snapshot',
      arguments: {}
    });
    const html = JSON.stringify(snapshot, null, 2);
    
    // Take screenshot
    const screenshotPath = await this.takeHighQualityScreenshot(
      `failure_${stepDescription.replace(/\s+/g, '_')}`,
      true
    );
    
    return { html, screenshotPath };
  }

  /**
   * Ensure page is active (MCP manages this)
   */
  async ensurePageActive(): Promise<void> {
    // MCP server ensures active page
    return;
  }

  /**
   * Debug page blockers
   */
  async debugPageBlockers(): Promise<any> {
    // Get page snapshot for analysis
    const snapshot = await this.mcpClient.call('tools/call', {
      name: 'browser_snapshot',
      arguments: {}
    });
    
    // Get console logs
    const consoleLogs = await this.mcpClient.call('tools/call', {
      name: 'browser_console_messages',
      arguments: {}
    });
    
    // Get network requests
    const networkRequests = await this.mcpClient.call('tools/call', {
      name: 'browser_network_requests',
      arguments: {}
    });
    
    return {
      snapshot,
      consoleLogs,
      networkRequests,
      hasModals: false, // MCP handles modals internally
      modalCount: 0
    };
  }

  // Methods not directly supported by MCP but required for compatibility
  async evaluate<T>(_fn: () => T): Promise<T> {
    throw new Error('evaluate method is not supported in MCP mode');
  }

  async captureSessionState(): Promise<any> {
    const result = await this.mcpClient.call('tools/call', {
      name: 'browser_tab_list',
      arguments: {}
    });
    return {
      tabs: result.tabs || [],
      currentTabIndex: this.currentTabIndex
    };
  }

  async saveSessionStateToFile(filepath: string): Promise<void> {
    const state = await this.captureSessionState();
    await fs.writeJSON(filepath, state, { spaces: 2 });
  }

  async loadSessionStateFromFile(filepath: string): Promise<void> {
    try {
      // In MCP mode, we can't restore session state
      await fs.readJSON(filepath); // Just validate the file exists
      log.warn('[MCP] Session state loading is not supported in MCP mode');
    } catch (error) {
      log.error(`Failed to load session state from ${filepath}:`, error as Error);
      throw error;
    }
  }

  async executeActionWithContext(action: BrowserAction): Promise<{ success: boolean; context?: { html: string; screenshotPath: string } }> {
    try {
      await this.executeAction(action);
      return { success: true };
    } catch (error) {
      const context = await this.captureFailureContext(action.type);
      return { success: false, context };
    }
  }

} 