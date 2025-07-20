import dotenv from 'dotenv';
import path from 'path';
import { BrowserConfig, LoggerConfig } from '../types';

// Load environment variables
dotenv.config();

/**
 * Application configuration
 */
export class Config {
  // OpenAI Configuration
  static readonly OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
  
  // Browser Configuration
  static readonly BROWSER_CONFIG: BrowserConfig = {
    browserType: (process.env.BROWSER_TYPE as 'chromium' | 'firefox' | 'webkit') || 'chromium',
    headless: process.env.HEADLESS_MODE === 'true',
    timeout: parseInt(process.env.DEFAULT_TIMEOUT || '30000'),
    navigationTimeout: parseInt(process.env.NAVIGATION_TIMEOUT || '60000'),
    viewport: {
      width: 1280,
      height: 720
    }
  };
  
  // Screenshot Configuration
  static readonly SCREENSHOT_PATH = path.resolve(process.env.SCREENSHOT_PATH || './screenshots');
  static readonly SCREENSHOT_QUALITY = parseInt(process.env.SCREENSHOT_QUALITY || '80');
  
  // Report Configuration
  static readonly REPORT_PATH = path.resolve(process.env.REPORT_PATH || './reports');
  
  // Logger Configuration
  static readonly LOGGER_CONFIG: LoggerConfig = {
    level: (process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug') || 'info',
    format: 'simple'
  };
  
  /**
   * Validate configuration
   */
  static validate(): void {
    const errors: string[] = [];
    
    if (!this.OPENAI_API_KEY) {
      errors.push('OPENAI_API_KEY is required');
    }
    
    if (!['chromium', 'firefox', 'webkit'].includes(this.BROWSER_CONFIG.browserType)) {
      errors.push('BROWSER_TYPE must be one of: chromium, firefox, webkit');
    }
    
    if (this.SCREENSHOT_QUALITY < 0 || this.SCREENSHOT_QUALITY > 100) {
      errors.push('SCREENSHOT_QUALITY must be between 0 and 100');
    }
    
    if (errors.length > 0) {
      throw new Error(`Configuration errors:\n${errors.join('\n')}`);
    }
  }
  
  /**
   * Get configuration summary
   */
  static getSummary(): string {
    return `
Configuration Summary:
- Browser: ${this.BROWSER_CONFIG.browserType} (${this.BROWSER_CONFIG.headless ? 'headless' : 'headed'})
- Default Timeout: ${this.BROWSER_CONFIG.timeout}ms
- Navigation Timeout: ${this.BROWSER_CONFIG.navigationTimeout}ms
- Screenshot Path: ${this.SCREENSHOT_PATH}
- Report Path: ${this.REPORT_PATH}
- Log Level: ${this.LOGGER_CONFIG.level}
- OpenAI API Key: ${this.OPENAI_API_KEY ? '***' + this.OPENAI_API_KEY.slice(-4) : 'Not Set'}
    `.trim();
  }
} 