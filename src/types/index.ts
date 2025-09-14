// Export all browser types
export * from './browser.types';

// Export all automation types
export * from './automation.types';

// Export all API types
export * from './api.types';

// Re-export commonly used types for convenience
export type { BrowserAction, BrowserConfig } from './browser.types';
export type { AutomationScript, AutomationExecutionResult, AutomationSequence, VisionAnalysisRequest, VisionAnalysisResponse } from './automation.types';

// Legacy types for backward compatibility
export interface ReportData {
  scriptName: string;
  startTime: Date;
  endTime: Date;
  screenshots: Array<{
    name: string;
    path: string;
    timestamp: Date;
    analysis?: import('./automation.types').VisionAnalysisResponse;
  }>;
  errors?: Error[];
  success: boolean;
}

export interface LoggerConfig {
  level: 'error' | 'warn' | 'info' | 'debug';
  format?: 'json' | 'simple';
  filename?: string;
}

export interface SequenceConfig {
  sequencesPath: string;
  backupPath?: string;
  maxHistoryLength?: number;
  autoBackup?: boolean;
}

// Interface for browser automation implementations
export { IBrowserAutomation } from '../core/browser/base/IBrowserAutomation';