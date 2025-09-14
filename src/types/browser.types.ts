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
  // Stealth/anti-detection and humanization options
  stealth?: boolean;
  humanize?: boolean;
  cursorOverlay?: boolean;
  locale?: string;
  timezoneId?: string;
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
 * Navigate to URL action
 */
export interface NavigateAction {
  type: 'navigate';
  url: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
}

/**
 * Click action
 */
export interface ClickAction {
  type: 'click';
  selector: string | string[];
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
 * Type text action
 */
export interface TypeAction {
  type: 'type';
  selector: string | string[];
  text: string;
  options?: {
    delay?: number;
    noWaitAfter?: boolean;
    timeout?: number;
  };
}

/**
 * Press keyboard key action
 */
export interface PressAction {
  type: 'press';
  selector?: string | string[];
  key: string;
}

/**
 * Wait action
 */
export interface WaitAction {
  type: 'wait';
  duration?: number;
  selector?: string | string[];
  state?: 'visible' | 'hidden' | 'attached' | 'detached';
}

/**
 * Scroll action
 */
export interface ScrollAction {
  type: 'scroll';
  direction?: 'up' | 'down' | 'left' | 'right';
  amount?: number;
  selector?: string | string[];
}

/**
 * Select option action
 */
export interface SelectAction {
  type: 'select';
  selector: string | string[];
  value: string | string[];
}

/**
 * Screenshot action
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
 * Browser navigation actions
 */
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

/**
 * Tab management actions
 */
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
 * Solve CAPTCHA action
 */
export interface SolveCaptchaAction {
  type: 'solve_captcha';
  taskContext?: string;
  previousAttempts?: any[];
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
  | SolveCaptchaAction
  | GoBackAction
  | GoForwardAction
  | ReloadAction
  | NewTabAction
  | SwitchTabAction
  | CloseTabAction;

