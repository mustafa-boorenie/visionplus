import { IBrowserAutomation } from '../browser/base/IBrowserAutomation';
import { log } from '../../utils/logger';

export type CaptchaType = 'recaptcha' | 'hcaptcha' | 'funcaptcha' | 'geetest' | 'unknown';

export interface DetectedCaptcha {
  type: CaptchaType;
  sitekey: string;
  pageUrl: string;
  isEnterprise?: boolean;
  dataS?: string; // For enterprise reCAPTCHA
  additionalData?: Record<string, any>;
}

/**
 * Detects CAPTCHA challenges on web pages
 */
export class CaptchaDetector {
  /**
   * Detect CAPTCHA on the current page
   */
  static async detect(browser: IBrowserAutomation): Promise<DetectedCaptcha | null> {
    try {
      const pageUrl = await browser.getCurrentUrl();
      
      // Check for Google's "Sorry" page first
      if (pageUrl.includes('google.com/sorry')) {
        log.info('[CAPTCHA] Detected Google Sorry page - anti-bot protection');
        // This requires special handling, not a normal CAPTCHA
        return {
          type: 'recaptcha',
          sitekey: 'google-sorry-page',
          pageUrl,
          isEnterprise: true,
          additionalData: { isGoogleSorryPage: true }
        };
      }
      
      const detected = await browser.evaluate(() => {
        // Helper to extract sitekey from various sources
        const extractSitekey = (iframe: HTMLIFrameElement | null, paramName: string): string => {
          if (!iframe) return '';
          try {
            const url = new URL(iframe.src);
            return url.searchParams.get(paramName) || url.searchParams.get('sitekey') || '';
          } catch {
            return '';
          }
        };
        
        // reCAPTCHA v2/v3 detection
        const recaptchaIframe = document.querySelector('iframe[src*="google.com/recaptcha"]') as HTMLIFrameElement | null;
        const recaptchaDiv = document.querySelector('[data-sitekey]') as HTMLElement | null;
        const grecaptchaDiv = document.querySelector('.g-recaptcha') as HTMLElement | null;
        
        let recaptchaSitekey = '';
        let isEnterprise = false;
        let dataS = '';
        
        // Check various reCAPTCHA elements
        if (recaptchaDiv?.getAttribute('data-sitekey')) {
          recaptchaSitekey = recaptchaDiv.getAttribute('data-sitekey') || '';
          dataS = recaptchaDiv.getAttribute('data-s') || '';
          isEnterprise = !!dataS || recaptchaDiv.hasAttribute('data-sentry');
        } else if (grecaptchaDiv?.getAttribute('data-sitekey')) {
          recaptchaSitekey = grecaptchaDiv.getAttribute('data-sitekey') || '';
          dataS = grecaptchaDiv.getAttribute('data-s') || '';
          isEnterprise = !!dataS;
        } else if (recaptchaIframe) {
          recaptchaSitekey = extractSitekey(recaptchaIframe, 'k');
          isEnterprise = recaptchaIframe.src.includes('enterprise');
        }
        
        // Check for invisible reCAPTCHA
        if (!recaptchaSitekey) {
          const scripts = Array.from(document.scripts);
          for (const script of scripts) {
            const match = script.textContent?.match(/grecaptcha\.execute\(['"]([^'"]+)['"]/);
            if (match) {
              recaptchaSitekey = match[1];
              break;
            }
          }
        }
        
        // hCaptcha detection
        const hcaptchaIframe = document.querySelector('iframe[src*="hcaptcha.com"]') as HTMLIFrameElement | null;
        const hcaptchaDiv = document.querySelector('[data-hcaptcha-sitekey], [data-sitekey].h-captcha, .h-captcha') as HTMLElement | null;
        
        let hcaptchaSitekey = '';
        if (hcaptchaDiv) {
          hcaptchaSitekey = hcaptchaDiv.getAttribute('data-hcaptcha-sitekey') || 
                           hcaptchaDiv.getAttribute('data-sitekey') || '';
        } else if (hcaptchaIframe) {
          hcaptchaSitekey = extractSitekey(hcaptchaIframe, 'sitekey');
        }
        
        // FunCaptcha detection
        const funcaptchaIframe = document.querySelector('iframe[src*="funcaptcha.com"], iframe[src*="arkoselabs.com"]') as HTMLIFrameElement | null;
        const funcaptchaDiv = document.querySelector('[data-public-key]') as HTMLElement | null;
        
        let funcaptchaSitekey = '';
        if (funcaptchaDiv?.getAttribute('data-public-key')) {
          funcaptchaSitekey = funcaptchaDiv.getAttribute('data-public-key') || '';
        } else if (funcaptchaIframe) {
          funcaptchaSitekey = extractSitekey(funcaptchaIframe, 'public_key') || 
                             extractSitekey(funcaptchaIframe, 'pk');
        }
        
        // GeeTest detection
        const geetestDiv = document.querySelector('.geetest_captcha, [data-geetest-gt]') as HTMLElement | null;
        let geetestGt = '';
        if (geetestDiv) {
          geetestGt = geetestDiv.getAttribute('data-geetest-gt') || 
                     geetestDiv.getAttribute('data-gt') || '';
        }
        
        // Return detected CAPTCHA
        if (recaptchaSitekey) {
          return { 
            type: 'recaptcha' as const, 
            sitekey: recaptchaSitekey,
            isEnterprise,
            dataS
          };
        }
        if (hcaptchaSitekey) {
          return { 
            type: 'hcaptcha' as const, 
            sitekey: hcaptchaSitekey 
          };
        }
        if (funcaptchaSitekey) {
          return { 
            type: 'funcaptcha' as const, 
            sitekey: funcaptchaSitekey 
          };
        }
        if (geetestGt) {
          return { 
            type: 'geetest' as const, 
            sitekey: geetestGt 
          };
        }
        
        return null;
      });
      
      if (!detected) return null;
      
      return {
        ...detected,
        pageUrl
      } as DetectedCaptcha;
      
    } catch (error) {
      log.error('[CAPTCHA] Detection failed', error as Error);
      return null;
    }
  }

  /**
   * Check if CAPTCHA has been solved
   */
  static async isSolved(browser: IBrowserAutomation, captchaType: CaptchaType): Promise<boolean> {
    try {
      return await browser.evaluate((type?: CaptchaType) => {
        switch (type) {
          case 'recaptcha': {
            const responseEl = document.querySelector('textarea#g-recaptcha-response, textarea[name="g-recaptcha-response"]') as HTMLTextAreaElement | null;
            return !!(responseEl && responseEl.value && responseEl.value.length > 100);
          }
          case 'hcaptcha': {
            const responseEl = document.querySelector('textarea#h-captcha-response, textarea[name="h-captcha-response"]') as HTMLTextAreaElement | null;
            return !!(responseEl && responseEl.value && responseEl.value.length > 100);
          }
          case 'funcaptcha': {
            const responseEl = document.querySelector('input[name="fc-token"], input[name="funcaptcha-token"]') as HTMLInputElement | null;
            return !!(responseEl && responseEl.value && responseEl.value.length > 50);
          }
          default:
            return false;
        }
      }, captchaType);
    } catch {
      return false;
    }
  }

  /**
   * Wait for CAPTCHA to appear with timeout
   */
  static async waitForCaptcha(
    browser: IBrowserAutomation, 
    timeout: number = 10000
  ): Promise<DetectedCaptcha | null> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const captcha = await this.detect(browser);
      if (captcha) {
        log.info(`[CAPTCHA] Detected ${captcha.type} CAPTCHA after ${Date.now() - startTime}ms`);
        return captcha;
      }
      
      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return null;
  }
}

