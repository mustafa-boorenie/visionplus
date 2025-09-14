import { IBrowserAutomation } from '../browser/base/IBrowserAutomation';
import { CaptchaDetector, DetectedCaptcha } from './CaptchaDetector';
import { AntiCaptchaProvider } from './providers/AntiCaptcha';
import { log } from '../../utils/logger';
import { env } from '../../config/environment';

export interface CaptchaProvider {
  solve(captcha: DetectedCaptcha): Promise<string | null>;
  checkBalance?(): Promise<number>;
}

/**
 * Manages CAPTCHA solving with multiple providers
 */
export class CaptchaSolver {
  private providers: Map<string, CaptchaProvider> = new Map();
  
  constructor() {
    // Initialize available providers
    if (env.ANTI_CAPTCHA_KEY) {
      this.providers.set('anticaptcha', new AntiCaptchaProvider(env.ANTI_CAPTCHA_KEY));
    }
    
    // Add more providers as needed
    // if (env.CAPSOLVER_KEY) {
    //   this.providers.set('capsolver', new CapSolverProvider(env.CAPSOLVER_KEY));
    // }
  }

  /**
   * Detect and solve CAPTCHA on the current page
   */
  async solveAndInject(browser: IBrowserAutomation): Promise<boolean> {
    try {
      // Detect CAPTCHA
      const captcha = await CaptchaDetector.detect(browser);
      if (!captcha) {
        log.info('[CAPTCHA] No CAPTCHA detected on page');
        return false;
      }

      log.info(`[CAPTCHA] Detected ${captcha.type} CAPTCHA with sitekey: ${captcha.sitekey}`);

      // Check if already solved
      if (await CaptchaDetector.isSolved(browser, captcha.type)) {
        log.info('[CAPTCHA] CAPTCHA already solved');
        return true;
      }

      // Special handling for Google Sorry page
      if (captcha.additionalData?.isGoogleSorryPage) {
        log.warn('[CAPTCHA] Google Sorry page detected - requires manual intervention or residential proxy');
        return false;
      }

      // Try each provider
      for (const [name, provider] of this.providers) {
        log.info(`[CAPTCHA] Trying provider: ${name}`);
        
        try {
          const token = await provider.solve(captcha);
          
          if (token) {
            log.info(`[CAPTCHA] Successfully obtained token from ${name}`);
            
            // Inject the token
            const injected = await this.injectToken(browser, captcha, token);
            
            if (injected) {
              log.info('[CAPTCHA] Token injected successfully');
              
              // Try to submit the form
              await this.submitForm(browser);
              
              // Wait a bit for page to process
              await browser.executeAction({ type: 'wait', duration: 2000 });
              
              return true;
            }
          }
        } catch (error) {
          log.error(`[CAPTCHA] Provider ${name} failed:`, error as Error);
        }
      }

      log.error('[CAPTCHA] All providers failed to solve CAPTCHA');
      return false;
      
    } catch (error) {
      log.error('[CAPTCHA] Solver error:', error as Error);
      return false;
    }
  }

  /**
   * Inject CAPTCHA token into the page
   */
  private async injectToken(
    browser: IBrowserAutomation, 
    captcha: DetectedCaptcha, 
    token: string
  ): Promise<boolean> {
    try {
      switch (captcha.type) {
        case 'recaptcha':
          return await this.injectRecaptchaToken(browser, token);
          
        case 'hcaptcha':
          return await this.injectHcaptchaToken(browser, token);
          
        case 'funcaptcha':
          return await this.injectFuncaptchaToken(browser, token);
          
        default:
          log.warn(`[CAPTCHA] No injection handler for ${captcha.type}`);
          return false;
      }
    } catch (error) {
      log.error('[CAPTCHA] Token injection failed:', error as Error);
      return false;
    }
  }

  /**
   * Inject reCAPTCHA token
   */
  private async injectRecaptchaToken(browser: IBrowserAutomation, token: string): Promise<boolean> {
    return await browser.evaluate((tkn?: string) => {
      try {
        // Helper to set value on element
        const setValue = (el: HTMLTextAreaElement | HTMLInputElement, value: string) => {
          el.value = value;
          if (el instanceof HTMLTextAreaElement) {
            el.innerHTML = value;
          }
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };

        // Find or create response textarea
        let responseEl = document.querySelector('textarea#g-recaptcha-response, textarea[name="g-recaptcha-response"]') as HTMLTextAreaElement | null;
        
        if (!responseEl) {
          // Create hidden textarea if it doesn't exist
          responseEl = document.createElement('textarea');
          responseEl.name = 'g-recaptcha-response';
          responseEl.id = 'g-recaptcha-response';
          responseEl.style.display = 'none';
          
          // Try to add it near the reCAPTCHA div
          const recaptchaDiv = document.querySelector('.g-recaptcha, [data-sitekey]');
          if (recaptchaDiv && recaptchaDiv.parentNode) {
            recaptchaDiv.parentNode.insertBefore(responseEl, recaptchaDiv.nextSibling);
          } else {
            document.body.appendChild(responseEl);
          }
        }
        
        setValue(responseEl!, tkn || '');
        
        // Also check for input field (some sites use this)
        const inputEl = document.querySelector('input[name="g-recaptcha-response"]') as HTMLInputElement | null;
        if (inputEl) {
          setValue(inputEl, tkn || '');
        }
        
        // Try to call the callback if it exists
        // @ts-ignore
        if (window.___grecaptcha_cfg && window.___grecaptcha_cfg.clients) {
          // @ts-ignore
          const clients = window.___grecaptcha_cfg.clients;
          Object.keys(clients).forEach(key => {
            const client = clients[key];
            if (client.callback) {
              try {
                client.callback(tkn || '');
              } catch {}
            }
          });
        }
        
        // Also try global callback
        // @ts-ignore
        if (window.grecaptchaCallback) {
          try {
            // @ts-ignore
            window.grecaptchaCallback(tkn || '');
          } catch {}
        }
        
        return true;
      } catch (error) {
        console.error('Failed to inject reCAPTCHA token:', error);
        return false;
      }
    }, token);
  }

  /**
   * Inject hCaptcha token
   */
  private async injectHcaptchaToken(browser: IBrowserAutomation, token: string): Promise<boolean> {
    return await browser.evaluate((tkn?: string) => {
      try {
        // Helper to set value
        const setValue = (el: HTMLTextAreaElement | HTMLInputElement, value: string) => {
          el.value = value;
          if (el instanceof HTMLTextAreaElement) {
            el.innerHTML = value;
          }
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };

        // Find or create response textarea
        let responseEl = document.querySelector('textarea#h-captcha-response, textarea[name="h-captcha-response"]') as HTMLTextAreaElement | null;
        
        if (!responseEl) {
          responseEl = document.createElement('textarea');
          responseEl.name = 'h-captcha-response';
          responseEl.id = 'h-captcha-response';
          responseEl.style.display = 'none';
          
          const hcaptchaDiv = document.querySelector('.h-captcha, [data-hcaptcha-sitekey]');
          if (hcaptchaDiv && hcaptchaDiv.parentNode) {
            hcaptchaDiv.parentNode.insertBefore(responseEl, hcaptchaDiv.nextSibling);
          } else {
            document.body.appendChild(responseEl);
          }
        }
        
        setValue(responseEl!, tkn || '');
        
        // Try to call hCaptcha callback
        // @ts-ignore
        if (window.hcaptcha && window.hcaptchaCallback) {
          try {
            // @ts-ignore
            window.hcaptchaCallback(tkn || '');
          } catch {}
        }
        
        return true;
      } catch (error) {
        console.error('Failed to inject hCaptcha token:', error);
        return false;
      }
    }, token);
  }

  /**
   * Inject FunCaptcha token
   */
  private async injectFuncaptchaToken(browser: IBrowserAutomation, token: string): Promise<boolean> {
    return await browser.evaluate((tkn?: string) => {
      try {
        // Find or create token input
        let tokenInput = document.querySelector('input[name="fc-token"], input[name="funcaptcha-token"]') as HTMLInputElement | null;
        
        if (!tokenInput) {
          tokenInput = document.createElement('input');
          tokenInput.type = 'hidden';
          tokenInput.name = 'fc-token';
          document.body.appendChild(tokenInput);
        }
        
        tokenInput.value = tkn || '';
        tokenInput.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Try to call FunCaptcha callback
        // @ts-ignore
        if (window.ArkoseEnforcement && window.ArkoseEnforcement.callback) {
          try {
            // @ts-ignore
            window.ArkoseEnforcement.callback(tkn);
          } catch {}
        }
        
        return true;
      } catch (error) {
        console.error('Failed to inject FunCaptcha token:', error);
        return false;
      }
    }, token);
  }

  /**
   * Try to submit the form after CAPTCHA is solved
   */
  private async submitForm(browser: IBrowserAutomation): Promise<void> {
    try {
      await browser.evaluate(() => {
        // Try various submit methods
        
        // 1. Click submit button
        const submitBtn = document.querySelector(
          'button[type="submit"], ' +
          'input[type="submit"], ' +
          'button:not([type]):not([disabled]), ' +
          '[role="button"]:not([disabled])'
        ) as HTMLElement | null;
        
        if (submitBtn && !submitBtn.hasAttribute('disabled')) {
          submitBtn.click();
          return;
        }
        
        // 2. Submit the form directly
        const forms = Array.from(document.querySelectorAll('form')) as HTMLFormElement[];
        for (const form of forms) {
          // Check if form has CAPTCHA elements
          if (form.querySelector('[data-sitekey], .g-recaptcha, .h-captcha, [data-hcaptcha-sitekey]')) {
            form.submit();
            return;
          }
        }
        
        // 3. Submit the first form if no CAPTCHA-specific form found
        if (forms.length === 1) {
          forms[0].submit();
        }
      });
      
      log.info('[CAPTCHA] Form submission attempted');
    } catch (error) {
      log.error('[CAPTCHA] Form submission failed:', error as Error);
    }
  }

  /**
   * Check provider balances
   */
  async checkBalances(): Promise<Record<string, number>> {
    const balances: Record<string, number> = {};
    
    for (const [name, provider] of this.providers) {
      if (provider.checkBalance) {
        try {
          balances[name] = await provider.checkBalance();
        } catch {
          balances[name] = -1;
        }
      }
    }
    
    return balances;
  }
}

