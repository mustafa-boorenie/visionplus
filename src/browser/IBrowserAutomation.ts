import { BrowserAction, ScreenshotOptions } from '../types';

export interface IBrowserAutomation {
  initialize(): Promise<void>;
  close(): Promise<void>;
  executeAction(action: BrowserAction): Promise<void>;
  executeActions(actions: BrowserAction[]): Promise<void>;
  getPageHTML(): Promise<string>;
  takeScreenshot(name: string, options?: ScreenshotOptions): Promise<string>;
  getCurrentUrl(): Promise<string>;
}