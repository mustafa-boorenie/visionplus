import dotenv from 'dotenv';

// Load environment variables
dotenv.config();
dotenv.config({ path: '.env.local' });

/**
 * Environment configuration
 */
export const env = {
  // API Keys
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  ANTI_CAPTCHA_KEY: process.env.ANTI_CAPTCHA_KEY || process.env.ANTICAPTCHA_KEY || '',
  
  // Server
  PORT: parseInt(process.env.PORT || '3002'),
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Database
  DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
  
  // Browser
  BROWSER_TYPE: (process.env.BROWSER_TYPE as 'chromium' | 'firefox' | 'webkit') || 'chromium',
  HEADLESS_MODE: process.env.HEADLESS_MODE === 'true',
  DEFAULT_TIMEOUT: parseInt(process.env.DEFAULT_TIMEOUT || '30000'),
  NAVIGATION_TIMEOUT: parseInt(process.env.NAVIGATION_TIMEOUT || '60000'),
  
  // Stealth & Humanization
  STEALTH_MODE: process.env.STEALTH_MODE !== 'false',
  HUMANIZE_INPUTS: process.env.HUMANIZE_INPUTS !== 'false',
  CURSOR_OVERLAY: process.env.CURSOR_OVERLAY === 'true',
  LOCALE: process.env.LOCALE || 'en-US',
  TIMEZONE: process.env.TIMEZONE || 'America/Los_Angeles',
  
  // Paths
  SCREENSHOT_PATH: process.env.SCREENSHOT_PATH || './screenshots',
  SCREENSHOT_QUALITY: parseInt(process.env.SCREENSHOT_QUALITY || '80'),
  REPORT_PATH: process.env.REPORT_PATH || './reports',
  LOG_LEVEL: (process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug') || 'info',
  
  // Features
  USE_MCP_BROWSER: process.env.USE_MCP_BROWSER === 'true',
  
  // Proxy
  HTTP_PROXY: process.env.HTTP_PROXY,
  HTTPS_PROXY: process.env.HTTPS_PROXY,
  NO_PROXY: process.env.NO_PROXY
};

/**
 * Validate required environment variables
 */
export function validateEnvironment(): void {
  const errors: string[] = [];
  
  if (!env.OPENAI_API_KEY) {
    errors.push('OPENAI_API_KEY is required');
  }
  
  if (!['chromium', 'firefox', 'webkit'].includes(env.BROWSER_TYPE)) {
    errors.push('BROWSER_TYPE must be one of: chromium, firefox, webkit');
  }
  
  if (env.SCREENSHOT_QUALITY < 0 || env.SCREENSHOT_QUALITY > 100) {
    errors.push('SCREENSHOT_QUALITY must be between 0 and 100');
  }
  
  if (errors.length > 0) {
    throw new Error(`Environment configuration errors:\n${errors.join('\n')}`);
  }
}

/**
 * Get environment summary
 */
export function getEnvironmentSummary(): string {
  return `
Environment Configuration:
- Node Environment: ${env.NODE_ENV}
- Server Port: ${env.PORT}
- Browser: ${env.BROWSER_TYPE} (${env.HEADLESS_MODE ? 'headless' : 'headed'})
- Stealth Mode: ${env.STEALTH_MODE ? 'enabled' : 'disabled'}
- Humanize Inputs: ${env.HUMANIZE_INPUTS ? 'enabled' : 'disabled'}
- Cursor Overlay: ${env.CURSOR_OVERLAY ? 'enabled' : 'disabled'}
- Default Timeout: ${env.DEFAULT_TIMEOUT}ms
- Navigation Timeout: ${env.NAVIGATION_TIMEOUT}ms
- Screenshot Path: ${env.SCREENSHOT_PATH}
- Report Path: ${env.REPORT_PATH}
- Log Level: ${env.LOG_LEVEL}
- OpenAI API Key: ${env.OPENAI_API_KEY ? '***' + env.OPENAI_API_KEY.slice(-4) : 'Not Set'}
- Anti-Captcha Key: ${env.ANTI_CAPTCHA_KEY ? '***' + env.ANTI_CAPTCHA_KEY.slice(-4) : 'Not Set'}
  `.trim();
}

