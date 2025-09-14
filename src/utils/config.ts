// Legacy config file - redirects to new config structure
// TODO: Remove this file once all references are updated

import { env } from '../config/environment';
import { defaultBrowserConfig } from '../config/browser.config';

export const Config = {
  OPENAI_API_KEY: env.OPENAI_API_KEY,
  BROWSER_CONFIG: defaultBrowserConfig,
  SCREENSHOT_PATH: env.SCREENSHOT_PATH,
  SCREENSHOT_QUALITY: env.SCREENSHOT_QUALITY,
  REPORT_PATH: env.REPORT_PATH,
  LOGGER_CONFIG: {
    level: env.LOG_LEVEL,
    format: 'simple' as const
  },
  
  validate(): void {
    // Validation now in environment.ts
  },
  
  getSummary(): string {
    return `Configuration loaded from new config system`;
  }
};