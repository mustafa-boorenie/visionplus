import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { CaptchaDetector, DetectedCaptcha } from '../../src/core/captcha/CaptchaDetector';
import { CaptchaSolver } from '../../src/core/captcha/CaptchaSolver';
import { AntiCaptchaProvider } from '../../src/core/captcha/providers/AntiCaptcha';
import { IBrowserAutomation } from '../../src/core/browser/base/IBrowserAutomation';

// Mock browser automation
const mockBrowser: Partial<IBrowserAutomation> = {
  getCurrentUrl: jest.fn().mockResolvedValue('https://example.com'),
  evaluate: jest.fn(),
  executeAction: jest.fn().mockResolvedValue(undefined)
};

// Mock detected CAPTCHA
const mockRecaptcha: DetectedCaptcha = {
  type: 'recaptcha',
  sitekey: '6LdyC2cUAAAAACGuDKpXeDorzUDWDstqtVS5KXs_',
  pageUrl: 'https://example.com',
  isEnterprise: false
};

const mockHcaptcha: DetectedCaptcha = {
  type: 'hcaptcha',
  sitekey: 'a5f74b19-9e45-40e0-b45d-47ff91b7a6c2',
  pageUrl: 'https://example.com'
};

describe('CAPTCHA Detection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should detect reCAPTCHA v2', async () => {
    // Mock page evaluation to return reCAPTCHA elements
    (mockBrowser.evaluate as jest.Mock).mockResolvedValue({
      type: 'recaptcha',
      sitekey: '6LdyC2cUAAAAACGuDKpXeDorzUDWDstqtVS5KXs_',
      isEnterprise: false,
      dataS: ''
    });

    const detected = await CaptchaDetector.detect(mockBrowser as IBrowserAutomation);
    
    expect(detected).toBeTruthy();
    expect(detected?.type).toBe('recaptcha');
    expect(detected?.sitekey).toBe('6LdyC2cUAAAAACGuDKpXeDorzUDWDstqtVS5KXs_');
  });

  test('should detect hCaptcha', async () => {
    (mockBrowser.evaluate as jest.Mock).mockResolvedValue({
      type: 'hcaptcha',
      sitekey: 'a5f74b19-9e45-40e0-b45d-47ff91b7a6c2'
    });

    const detected = await CaptchaDetector.detect(mockBrowser as IBrowserAutomation);
    
    expect(detected).toBeTruthy();
    expect(detected?.type).toBe('hcaptcha');
    expect(detected?.sitekey).toBe('a5f74b19-9e45-40e0-b45d-47ff91b7a6c2');
  });

  test('should detect Google Sorry page', async () => {
    (mockBrowser.getCurrentUrl as jest.Mock).mockResolvedValue('https://www.google.com/sorry/index?continue=https://www.google.com/search');

    const detected = await CaptchaDetector.detect(mockBrowser as IBrowserAutomation);
    
    expect(detected).toBeTruthy();
    expect(detected?.type).toBe('recaptcha');
    expect(detected?.additionalData?.isGoogleSorryPage).toBe(true);
  });

  test('should return null when no CAPTCHA detected', async () => {
    (mockBrowser.evaluate as jest.Mock).mockResolvedValue(null);

    const detected = await CaptchaDetector.detect(mockBrowser as IBrowserAutomation);
    
    expect(detected).toBeNull();
  });

  test('should check if CAPTCHA is solved', async () => {
    // Mock solved reCAPTCHA
    (mockBrowser.evaluate as jest.Mock).mockResolvedValue(true);

    const isSolved = await CaptchaDetector.isSolved(mockBrowser as IBrowserAutomation, 'recaptcha');
    
    expect(isSolved).toBe(true);
    expect(mockBrowser.evaluate).toHaveBeenCalledWith(expect.any(Function), 'recaptcha');
  });
});

describe('AntiCaptcha Provider', () => {
  let provider: AntiCaptchaProvider;
  
  beforeEach(() => {
    provider = new AntiCaptchaProvider('test-api-key');
    jest.clearAllMocks();
  });

  test('should create task for reCAPTCHA v2', async () => {
    // Mock axios responses
    const mockAxios = jest.spyOn(require('axios'), 'post');
    mockAxios
      .mockResolvedValueOnce({
        data: { errorId: 0, taskId: 123456 }
      })
      .mockResolvedValueOnce({
        data: { 
          errorId: 0, 
          status: 'ready', 
          solution: { gRecaptchaResponse: 'test-token-123' }
        }
      });

    const token = await provider.solve(mockRecaptcha);
    
    expect(token).toBe('test-token-123');
    expect(mockAxios).toHaveBeenCalledTimes(2);
    
    // Check task creation
    expect(mockAxios).toHaveBeenNthCalledWith(1, 'https://api.anti-captcha.com/createTask', {
      clientKey: 'test-api-key',
      task: {
        type: 'NoCaptchaTaskProxyless',
        websiteURL: 'https://example.com',
        websiteKey: '6LdyC2cUAAAAACGuDKpXeDorzUDWDstqtVS5KXs_'
      },
      softId: 1115,
      languagePool: 'en'
    });
  });

  test('should handle enterprise reCAPTCHA', async () => {
    const enterpriseCaptcha: DetectedCaptcha = {
      ...mockRecaptcha,
      isEnterprise: true,
      dataS: 'enterprise-data'
    };

    const mockAxios = jest.spyOn(require('axios'), 'post');
    mockAxios
      .mockResolvedValueOnce({
        data: { errorId: 0, taskId: 123456 }
      })
      .mockResolvedValueOnce({
        data: { 
          errorId: 0, 
          status: 'ready', 
          solution: { gRecaptchaResponse: 'enterprise-token' }
        }
      });

    const token = await provider.solve(enterpriseCaptcha);
    
    expect(token).toBe('enterprise-token');
    expect(mockAxios).toHaveBeenNthCalledWith(1, 'https://api.anti-captcha.com/createTask', 
      expect.objectContaining({
        task: expect.objectContaining({
          type: 'RecaptchaV2EnterpriseTaskProxyless',
          enterprisePayload: { s: 'enterprise-data' }
        })
      })
    );
  });

  test('should handle hCaptcha', async () => {
    const mockAxios = jest.spyOn(require('axios'), 'post');
    mockAxios
      .mockResolvedValueOnce({
        data: { errorId: 0, taskId: 789012 }
      })
      .mockResolvedValueOnce({
        data: { 
          errorId: 0, 
          status: 'ready', 
          solution: { token: 'hcaptcha-token-456' }
        }
      });

    const token = await provider.solve(mockHcaptcha);
    
    expect(token).toBe('hcaptcha-token-456');
    expect(mockAxios).toHaveBeenNthCalledWith(1, 'https://api.anti-captcha.com/createTask', 
      expect.objectContaining({
        task: expect.objectContaining({
          type: 'HCaptchaTaskProxyless'
        })
      })
    );
  });

  test('should handle API errors', async () => {
    const mockAxios = jest.spyOn(require('axios'), 'post');
    mockAxios.mockResolvedValueOnce({
      data: { 
        errorId: 1, 
        errorCode: 'ERROR_ZERO_BALANCE',
        errorDescription: 'Account has zero balance'
      }
    });

    const token = await provider.solve(mockRecaptcha);
    
    expect(token).toBeNull();
  });

  test('should timeout after max attempts', async () => {
    const mockAxios = jest.spyOn(require('axios'), 'post');
    mockAxios
      .mockResolvedValueOnce({
        data: { errorId: 0, taskId: 123456 }
      })
      .mockResolvedValue({
        data: { errorId: 0, status: 'processing' }
      });

    const token = await provider.solve(mockRecaptcha);
    
    expect(token).toBeNull();
  });

  test('should check balance', async () => {
    const mockAxios = jest.spyOn(require('axios'), 'post');
    mockAxios.mockResolvedValueOnce({
      data: { errorId: 0, balance: 15.75 }
    });

    const balance = await provider.checkBalance();
    
    expect(balance).toBe(15.75);
    expect(mockAxios).toHaveBeenCalledWith('https://api.anti-captcha.com/getBalance', {
      clientKey: 'test-api-key'
    });
  });
});

describe('CAPTCHA Solver Integration', () => {
  let solver: CaptchaSolver;
  
  beforeEach(() => {
    // Mock environment with API key
    process.env.ANTI_CAPTCHA_KEY = 'test-api-key';
    solver = new CaptchaSolver();
    jest.clearAllMocks();
  });

  test('should solve and inject reCAPTCHA token', async () => {
    // Mock detection
    const detectSpy = jest.spyOn(CaptchaDetector, 'detect');
    detectSpy.mockResolvedValue(mockRecaptcha);

    // Mock already solved check
    const isSolvedSpy = jest.spyOn(CaptchaDetector, 'isSolved');
    isSolvedSpy.mockResolvedValue(false);

    // Mock provider solve
    const mockAxios = jest.spyOn(require('axios'), 'post');
    mockAxios
      .mockResolvedValueOnce({
        data: { errorId: 0, taskId: 123456 }
      })
      .mockResolvedValueOnce({
        data: { 
          errorId: 0, 
          status: 'ready', 
          solution: { gRecaptchaResponse: 'solved-token' }
        }
      });

    // Mock token injection
    (mockBrowser.evaluate as jest.Mock).mockResolvedValue(true);

    const result = await solver.solveAndInject(mockBrowser as IBrowserAutomation);
    
    expect(result).toBe(true);
    expect(detectSpy).toHaveBeenCalled();
    expect(isSolvedSpy).toHaveBeenCalled();
    expect(mockBrowser.evaluate).toHaveBeenCalledWith(expect.any(Function), 'solved-token');
  });

  test('should skip if CAPTCHA already solved', async () => {
    const detectSpy = jest.spyOn(CaptchaDetector, 'detect');
    detectSpy.mockResolvedValue(mockRecaptcha);

    const isSolvedSpy = jest.spyOn(CaptchaDetector, 'isSolved');
    isSolvedSpy.mockResolvedValue(true);

    const result = await solver.solveAndInject(mockBrowser as IBrowserAutomation);
    
    expect(result).toBe(true);
    expect(detectSpy).toHaveBeenCalled();
    expect(isSolvedSpy).toHaveBeenCalled();
  });

  test('should return false if no CAPTCHA detected', async () => {
    const detectSpy = jest.spyOn(CaptchaDetector, 'detect');
    detectSpy.mockResolvedValue(null);

    const result = await solver.solveAndInject(mockBrowser as IBrowserAutomation);
    
    expect(result).toBe(false);
  });

  test('should handle Google Sorry page', async () => {
    const googleSorryCaptcha: DetectedCaptcha = {
      type: 'recaptcha',
      sitekey: 'google-sorry-page',
      pageUrl: 'https://www.google.com/sorry/index',
      isEnterprise: true,
      additionalData: { isGoogleSorryPage: true }
    };

    const detectSpy = jest.spyOn(CaptchaDetector, 'detect');
    detectSpy.mockResolvedValue(googleSorryCaptcha);

    const result = await solver.solveAndInject(mockBrowser as IBrowserAutomation);
    
    expect(result).toBe(false); // Should return false for Google Sorry pages
  });

  test('should check provider balances', async () => {
    const mockAxios = jest.spyOn(require('axios'), 'post');
    mockAxios.mockResolvedValueOnce({
      data: { errorId: 0, balance: 25.50 }
    });

    const balances = await solver.checkBalances();
    
    expect(balances).toHaveProperty('anticaptcha');
    expect(balances.anticaptcha).toBe(25.50);
  });
});

describe('CAPTCHA Token Injection', () => {
  test('should inject reCAPTCHA token correctly', async () => {
    const solver = new CaptchaSolver();
    
    // Mock token injection evaluation
    (mockBrowser.evaluate as jest.Mock).mockImplementation((fn, token) => {
      // Simulate the injection function
      const result = fn(token);
      return Promise.resolve(result);
    });

    // Test the private injection method via the public interface
    const detectSpy = jest.spyOn(CaptchaDetector, 'detect');
    detectSpy.mockResolvedValue(mockRecaptcha);

    const isSolvedSpy = jest.spyOn(CaptchaDetector, 'isSolved');
    isSolvedSpy.mockResolvedValue(false);

    // Mock successful solve
    const mockAxios = jest.spyOn(require('axios'), 'post');
    mockAxios
      .mockResolvedValueOnce({
        data: { errorId: 0, taskId: 123456 }
      })
      .mockResolvedValueOnce({
        data: { 
          errorId: 0, 
          status: 'ready', 
          solution: { gRecaptchaResponse: 'test-injection-token' }
        }
      });

    const result = await solver.solveAndInject(mockBrowser as IBrowserAutomation);
    
    expect(result).toBe(true);
    expect(mockBrowser.evaluate).toHaveBeenCalledWith(expect.any(Function), 'test-injection-token');
  });
});
