import { BrowserConfig } from '../types';
import { env } from './environment';
import path from 'path';

/**
 * Default browser configuration
 */
export const defaultBrowserConfig: BrowserConfig = {
  browserType: env.BROWSER_TYPE,
  headless: env.HEADLESS_MODE,
  timeout: env.DEFAULT_TIMEOUT,
  navigationTimeout: env.NAVIGATION_TIMEOUT,
  viewport: {
    width: 1280,
    height: 720
  },
  args: [],
  screenshotPath: path.resolve(env.SCREENSHOT_PATH),
  stealth: env.STEALTH_MODE,
  humanize: env.HUMANIZE_INPUTS,
  cursorOverlay: env.CURSOR_OVERLAY,
  locale: env.LOCALE,
  timezoneId: env.TIMEZONE
};

/**
 * Get browser launch arguments based on configuration
 */
export function getBrowserLaunchArgs(config: BrowserConfig): string[] {
  const args = [...(config.args || [])];
  
  // Add stealth arguments
  if (config.stealth !== false) {
    args.push(
      '--disable-blink-features=AutomationControlled',
      '--no-default-browser-check',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-dev-shm-usage'
    );
  }
  
  // Add proxy arguments if configured
  if (env.HTTP_PROXY || env.HTTPS_PROXY) {
    const proxyUrl = env.HTTPS_PROXY || env.HTTP_PROXY;
    args.push(`--proxy-server=${proxyUrl}`);
    
    if (env.NO_PROXY) {
      args.push(`--proxy-bypass-list=${env.NO_PROXY}`);
    }
  }
  
  return args;
}

/**
 * Get browser context options
 */
export function getBrowserContextOptions(config: BrowserConfig): any {
  const options: any = {
    viewport: config.viewport,
    ignoreHTTPSErrors: true,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: config.locale,
    timezoneId: config.timezoneId
  };
  
  // Add proxy credentials if available
  if (env.HTTP_PROXY || env.HTTPS_PROXY) {
    const proxyUrl = new URL(env.HTTPS_PROXY || env.HTTP_PROXY!);
    if (proxyUrl.username && proxyUrl.password) {
      options.httpCredentials = {
        username: proxyUrl.username,
        password: proxyUrl.password
      };
    }
  }
  
  return options;
}

/**
 * Browser presets for different use cases
 */
export const browserPresets = {
  // Standard automation
  default: defaultBrowserConfig,
  
  // Stealth mode for anti-bot detection
  stealth: {
    ...defaultBrowserConfig,
    stealth: true,
    humanize: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-default-browser-check',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=IsolateOrigins',
      '--disable-site-isolation-trials'
    ]
  },
  
  // Performance mode for speed
  performance: {
    ...defaultBrowserConfig,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  },
  
  // Debug mode with devtools
  debug: {
    ...defaultBrowserConfig,
    headless: false,
    args: ['--auto-open-devtools-for-tabs']
  }
};

