import { Page } from 'playwright';
import { 
  BrowserAction, 
  BrowserConfig, 
  ScreenshotOptions,
  AutomationExecutionResult 
} from '../../../types';

/**
 * Interface for browser automation implementations
 */
export interface IBrowserAutomation {
  /**
   * Initialize the browser instance
   */
  initialize(): Promise<void>;
  
  /**
   * Close the browser and cleanup resources
   */
  close(): Promise<void>;
  
  /**
   * Execute a single browser action
   */
  executeAction(action: BrowserAction): Promise<any>;
  
  /**
   * Execute multiple browser actions in sequence
   */
  executeActions(actions: BrowserAction[]): Promise<void>;
  
  /**
   * Get the current page HTML content
   */
  getPageHTML(): Promise<string>;
  
  /**
   * Take a screenshot with specified options
   */
  takeScreenshot(name: string, options?: ScreenshotOptions): Promise<string>;
  
  /**
   * Get the current page URL
   */
  getCurrentUrl(): Promise<string>;
  
  /**
   * Take a high-quality screenshot for vision analysis
   */
  takeHighQualityScreenshot(name: string, includeFullPage?: boolean): Promise<string>;
  
  /**
   * Capture failure context including HTML and screenshot
   */
  captureFailureContext(stepDescription: string): Promise<{ 
    html: string; 
    screenshotPath: string 
  }>;
  
  /**
   * Evaluate JavaScript in the page context
   * Optional single argument can be passed to the function
   */
  evaluate<T, A = any>(fn: (arg?: A) => T, arg?: A): Promise<T>;
  
  /**
   * Get the current Playwright page instance
   */
  get currentPage(): Page | null;
  
  /**
   * Check if browser is connected
   */
  isConnected(): boolean;
  
  /**
   * Capture current browser session state
   */
  captureSessionState?(): Promise<{
    cookies: any[];
    localStorage: Record<string, string>;
    sessionStorage: Record<string, string>;
    url: string;
    title: string;
    viewport: { width: number; height: number } | null;
  }>;
  
  /**
   * Restore browser session state
   */
  restoreSessionState?(state: {
    cookies?: any[];
    localStorage?: Record<string, string>;
    sessionStorage?: Record<string, string>;
    url?: string;
    viewport?: { width: number; height: number };
  }): Promise<void>;
}

