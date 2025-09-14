import axios from 'axios';
import { CaptchaProvider } from '../CaptchaSolver';
import { DetectedCaptcha } from '../CaptchaDetector';
import { log } from '../../../utils/logger';

/**
 * Anti-Captcha provider implementation
 */
export class AntiCaptchaProvider implements CaptchaProvider {
  private readonly apiUrl = 'https://api.anti-captcha.com';
  
  constructor(private apiKey: string) {}

  /**
   * Solve CAPTCHA using Anti-Captcha service
   */
  async solve(captcha: DetectedCaptcha): Promise<string | null> {
    try {
      log.info(`[AntiCaptcha] Solving ${captcha.type} CAPTCHA`);
      
      // Create task based on CAPTCHA type
      const taskConfig = this.getTaskConfig(captcha);
      if (!taskConfig) {
        log.error(`[AntiCaptcha] Unsupported CAPTCHA type: ${captcha.type}`);
        return null;
      }

      // Create task
      const createResponse = await axios.post(`${this.apiUrl}/createTask`, {
        clientKey: this.apiKey,
        task: taskConfig,
        softId: 1115,
        languagePool: 'en'
      });

      if (createResponse.data.errorId > 0) {
        throw new Error(`Anti-Captcha error: ${createResponse.data.errorCode} - ${createResponse.data.errorDescription}`);
      }

      const taskId = createResponse.data.taskId;
      if (!taskId) {
        throw new Error('No task ID received from Anti-Captcha');
      }

      log.info(`[AntiCaptcha] Task created with ID: ${taskId}`);

      // Poll for result
      const token = await this.pollForResult(taskId);
      
      if (token) {
        log.info('[AntiCaptcha] Successfully solved CAPTCHA');
      }
      
      return token;
      
    } catch (error) {
      log.error('[AntiCaptcha] Solving failed:', error as Error);
      return null;
    }
  }

  /**
   * Get task configuration based on CAPTCHA type
   */
  private getTaskConfig(captcha: DetectedCaptcha): any {
    switch (captcha.type) {
      case 'recaptcha':
        if (captcha.isEnterprise) {
          return {
            type: 'RecaptchaV2EnterpriseTaskProxyless',
            websiteURL: captcha.pageUrl,
            websiteKey: captcha.sitekey,
            enterprisePayload: captcha.dataS ? { s: captcha.dataS } : undefined
          };
        }
        return {
          type: 'NoCaptchaTaskProxyless',
          websiteURL: captcha.pageUrl,
          websiteKey: captcha.sitekey
        };

      case 'hcaptcha':
        return {
          type: 'HCaptchaTaskProxyless',
          websiteURL: captcha.pageUrl,
          websiteKey: captcha.sitekey
        };

      case 'funcaptcha':
        return {
          type: 'FunCaptchaTaskProxyless',
          websiteURL: captcha.pageUrl,
          websitePublicKey: captcha.sitekey
        };

      case 'geetest':
        // GeeTest requires additional parameters that need to be extracted
        log.warn('[AntiCaptcha] GeeTest CAPTCHA requires additional implementation');
        return null;

      default:
        return null;
    }
  }

  /**
   * Poll for task result
   */
  private async pollForResult(taskId: number, maxAttempts: number = 60): Promise<string | null> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Wait before checking (first check after 5s, then every 3s)
      await new Promise(resolve => setTimeout(resolve, attempt === 0 ? 5000 : 3000));

      try {
        const response = await axios.post(`${this.apiUrl}/getTaskResult`, {
          clientKey: this.apiKey,
          taskId
        });

        if (response.data.errorId > 0) {
          throw new Error(`Anti-Captcha error: ${response.data.errorCode} - ${response.data.errorDescription}`);
        }

        const status = response.data.status;
        
        if (status === 'ready') {
          const solution = response.data.solution;
          
          // Extract token based on response structure
          const token = solution.gRecaptchaResponse || 
                       solution.token || 
                       solution.tokenResponse ||
                       solution.funcaptchaResponse;
          
          if (token) {
            log.info(`[AntiCaptcha] Solution received after ${attempt + 1} attempts`);
            return token;
          }
          
          log.error('[AntiCaptcha] Solution received but no token found');
          return null;
        }
        
        if (status === 'processing') {
          log.debug(`[AntiCaptcha] Task still processing (attempt ${attempt + 1}/${maxAttempts})`);
          continue;
        }
        
        // Unknown status
        log.warn(`[AntiCaptcha] Unknown task status: ${status}`);
        
      } catch (error) {
        log.error(`[AntiCaptcha] Failed to get task result:`, error as Error);
        
        // Continue polling unless it's a critical error
        if (attempt < maxAttempts - 1) {
          continue;
        }
      }
    }

    log.error('[AntiCaptcha] Timeout waiting for solution');
    return null;
  }

  /**
   * Check account balance
   */
  async checkBalance(): Promise<number> {
    try {
      const response = await axios.post(`${this.apiUrl}/getBalance`, {
        clientKey: this.apiKey
      });

      if (response.data.errorId > 0) {
        throw new Error(`Anti-Captcha error: ${response.data.errorCode}`);
      }

      return response.data.balance || 0;
      
    } catch (error) {
      log.error('[AntiCaptcha] Failed to check balance:', error as Error);
      throw error;
    }
  }

  /**
   * Report incorrect CAPTCHA solution
   */
  async reportIncorrect(taskId: number): Promise<void> {
    try {
      await axios.post(`${this.apiUrl}/reportIncorrectImageCaptcha`, {
        clientKey: this.apiKey,
        taskId
      });
      
      log.info('[AntiCaptcha] Reported incorrect solution');
    } catch (error) {
      log.error('[AntiCaptcha] Failed to report incorrect solution:', error as Error);
    }
  }
}

