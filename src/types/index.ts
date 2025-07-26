

/**
 * Configuration for browser automation
 */
export interface BrowserConfig {
  browserType: 'chromium' | 'firefox' | 'webkit';
  headless: boolean;
  timeout: number;
  navigationTimeout: number;
  viewport?: {
    width: number;
    height: number;
  };
  args?: string[];
  screenshotPath?: string;
}

/**
 * Screenshot options
 */
export interface ScreenshotOptions {
  path?: string;
  fullPage?: boolean;
  quality?: number;
  type?: 'png' | 'jpeg';
}

/**
 * Vision analysis request
 */
export interface VisionAnalysisRequest {
  screenshotPath: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Vision analysis response
 */
export interface VisionAnalysisResponse {
  content: string;
  timestamp: Date;
  screenshotPath: string;
  prompt: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Action to take a screenshot
 */
export interface ScreenshotAction {
  type: 'screenshot';
  name: string;
  options?: {
    fullPage?: boolean;
    clip?: { x: number; y: number; width: number; height: number };
  };
}

/**
 * Click action
 */
export interface ClickAction {
  type: 'click';
  selector: string | string[];  // Support multiple candidate selectors
  options?: {
    button?: 'left' | 'right' | 'middle';
    clickCount?: number;
    delay?: number;
    position?: { x: number; y: number };
    force?: boolean;
    noWaitAfter?: boolean;
    timeout?: number;
  };
}

/**
 * Type action
 */
export interface TypeAction {
  type: 'type';
  selector: string | string[];  // Support multiple candidate selectors
  text: string;
  options?: {
    delay?: number;
    noWaitAfter?: boolean;
    timeout?: number;
  };
}

/**
 * Press action for keyboard events
 */
export interface PressAction {
  type: 'press';
  selector?: string | string[];  // Optional, can be global or element-specific
  key: string;  // e.g., 'Enter', 'Escape', 'Tab'
}

/**
 * Union type for all browser actions
 */
export type BrowserAction = 
  | NavigateAction 
  | ClickAction 
  | TypeAction 
  | WaitAction 
  | ScrollAction 
  | SelectAction 
  | ScreenshotAction
  | PressAction
  | GoBackAction
  | GoForwardAction
  | ReloadAction
  | NewTabAction
  | SwitchTabAction
  | CloseTabAction;

export interface NavigateAction {
  type: 'navigate';
  url: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
}

export interface WaitAction {
  type: 'wait';
  duration?: number;
  selector?: string | string[];  // Support multiple candidate selectors
  state?: 'visible' | 'hidden' | 'attached' | 'detached';
}

export interface ScrollAction {
  type: 'scroll';
  direction?: 'up' | 'down' | 'left' | 'right';
  amount?: number;
  selector?: string | string[];  // Support multiple candidate selectors
}

export interface SelectAction {
  type: 'select';
  selector: string | string[];  // Support multiple candidate selectors
  value: string | string[];
}

export interface GoBackAction {
  type: 'goBack';
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
}

export interface GoForwardAction {
  type: 'goForward';
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
}

export interface ReloadAction {
  type: 'reload';
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
}

export interface NewTabAction {
  type: 'newTab';
  url?: string;
}

export interface SwitchTabAction {
  type: 'switchTab';
  index?: number;
  url?: string;
  title?: string;
}

export interface CloseTabAction {
  type: 'closeTab';
  index?: number;
}

/**
 * Automation script
 */
export interface AutomationScript {
  name: string;
  description?: string;
  url: string;
  actions: BrowserAction[];
  analysis?: {
    enabled: boolean;
    prompts: string[];
  };
}

/**
 * Report data
 */
export interface ReportData {
  scriptName: string;
  startTime: Date;
  endTime: Date;
  screenshots: Array<{
    name: string;
    path: string;
    timestamp: Date;
    analysis?: VisionAnalysisResponse;
  }>;
  errors?: Error[];
  success: boolean;
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  level: 'error' | 'warn' | 'info' | 'debug';
  format?: 'json' | 'simple';
  filename?: string;
}

/**
 * Automation sequence metadata
 */
export interface SequenceMetadata {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  lastUsed?: Date;
  usageCount: number;
  tags?: string[];
  category?: string;
  successRate?: number;
}

/**
 * Execution result from an automation run
 */
export interface AutomationExecutionResult {
  success: boolean;
  script: AutomationScript;
  executionTime: number;
  screenshots: string[];
  errors?: string[];
  testFile?: string;  // Path to generated test file
  stepResults?: Array<{
    step: string;
    success: boolean;
    error?: string;
    duration: number;
  }>;
}

/**
 * Automation sequence - combines prompt, script, and metadata for reuse
 */
export interface AutomationSequence {
  metadata: SequenceMetadata;
  originalPrompt: string;
  script: AutomationScript;
  executionHistory: Array<{
    timestamp: Date;
    success: boolean;
    executionTime: number;
    errors?: string[];
  }>;
}

/**
 * Sequence manager configuration
 */
export interface SequenceConfig {
  sequencesPath: string;
  backupPath?: string;
  maxHistoryLength?: number;
  autoBackup?: boolean;
}

/**
 * Search criteria for finding sequences
 */
export interface SequenceSearchCriteria {
  name?: string;
  category?: string;
  tags?: string[];
  url?: string;
  prompt?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  minSuccessRate?: number;
}

export interface IBrowserAutomation {
  initialize(): Promise<void>;
  close(): Promise<void>;
  executeAction(action: BrowserAction): Promise<void>;
  executeActions(actions: BrowserAction[]): Promise<void>;
  getPageHTML(): Promise<string>;
  takeScreenshot(name: string, options?: ScreenshotOptions): Promise<string>;
  getCurrentUrl(): Promise<string>;
  takeHighQualityScreenshot(name: string, includeFullPage?: boolean): Promise<string>;
  captureFailureContext(stepDescription: string): Promise<{ html: string; screenshotPath: string }>;
  evaluate<T>(fn: () => T): Promise<T>;
  get currentPage(): any; // Using 'any' to avoid circular dependencies with Playwright's Page type
} 