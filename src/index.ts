import { Config } from './utils/config';

// Main exports
export { BrowserAutomation } from './browser/BrowserAutomation';
export { VisionAnalyzer } from './vision/VisionAnalyzer';
export { ScriptRunner } from './ScriptRunner';
export { ResultsHandler } from './utils/ResultsHandler';
export { Config } from './utils/config';
export { log } from './utils/logger';
export { IntelligentAutomation } from './automation/IntelligentAutomation';
export { TestGenerator } from './automation/TestGenerator';
export { ProgressTracker } from './utils/ProgressTracker';

// Type exports
export * from './types';

// Utility function to validate environment
export function validateEnvironment(): void {
  try {
    Config.validate();
    console.log('✅ Environment configuration is valid');
    console.log(Config.getSummary());
  } catch (error) {
    console.error('❌ Environment configuration error:', error);
    process.exit(1);
  }
} 