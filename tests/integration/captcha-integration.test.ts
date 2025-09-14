import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { DockerService, DockerBrowserSession } from '../../src/integrations/docker/DockerService';
import { CaptchaDetector } from '../../src/core/captcha/CaptchaDetector';
import { CaptchaSolver } from '../../src/core/captcha/CaptchaSolver';
import { DockerBrowserAutomation } from '../../src/browser/DockerBrowserAutomation';

describe('CAPTCHA Integration Tests', () => {
  let dockerService: DockerService;
  let dockerSession: DockerBrowserSession;
  let browserAutomation: DockerBrowserAutomation;

  beforeAll(async () => {
    // Skip if Docker not available
    try {
      dockerService = new DockerService();
      dockerSession = await dockerService.createBrowserContainer('captcha-test');
      browserAutomation = new DockerBrowserAutomation();
      
      // Initialize with the test session
      (browserAutomation as any).session = dockerSession;
    } catch (error) {
      console.warn('Docker not available, skipping integration tests');
    }
  }, 30000);

  afterAll(async () => {
    if (dockerSession) {
      try {
        await dockerService.stopContainer(dockerSession.containerId);
      } catch (error) {
        console.warn('Failed to cleanup test container:', error);
      }
    }
  });

  test('should detect reCAPTCHA on test page', async () => {
    if (!dockerSession) {
      console.warn('Skipping test - Docker not available');
      return;
    }

    // Navigate to a page with reCAPTCHA
    await dockerService.executeAction(dockerSession, {
      type: 'navigate',
      url: 'https://www.google.com/recaptcha/api2/demo',
      waitUntil: 'domcontentloaded'
    });

    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Detect CAPTCHA
    const detected = await CaptchaDetector.detect(browserAutomation);
    
    expect(detected).toBeTruthy();
    expect(detected?.type).toBe('recaptcha');
    expect(detected?.sitekey).toBeTruthy();
  }, 15000);

  test('should handle CAPTCHA solving workflow', async () => {
    if (!dockerSession || !process.env.ANTI_CAPTCHA_KEY) {
      console.warn('Skipping test - Docker or API key not available');
      return;
    }

    // Navigate to test page
    await dockerService.executeAction(dockerSession, {
      type: 'navigate',
      url: 'https://www.google.com/recaptcha/api2/demo',
      waitUntil: 'domcontentloaded'
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Try to solve CAPTCHA
    const solver = new CaptchaSolver();
    const solved = await solver.solveAndInject(browserAutomation);
    
    // Note: This might fail if no balance or service issues, but should not crash
    expect(typeof solved).toBe('boolean');
  }, 60000);

  test('should handle container communication', async () => {
    if (!dockerSession) {
      console.warn('Skipping test - Docker not available');
      return;
    }

    // Test basic container communication
    const healthResponse = await dockerService.getContainerHealth(dockerSession);
    expect(healthResponse).toBe(true);

    // Test navigation
    await dockerService.executeAction(dockerSession, {
      type: 'navigate',
      url: 'https://httpbin.org/html',
      waitUntil: 'domcontentloaded'
    });

    const currentUrl = await dockerService.getCurrentUrl(dockerSession);
    expect(currentUrl).toContain('httpbin.org');
  }, 15000);

  test('should take screenshots without errors', async () => {
    if (!dockerSession) {
      console.warn('Skipping test - Docker not available');
      return;
    }

    // Navigate to a simple page
    await dockerService.executeAction(dockerSession, {
      type: 'navigate',
      url: 'https://example.com',
      waitUntil: 'domcontentloaded'
    });

    // Take screenshot
    const screenshot = await dockerService.takeScreenshot(dockerSession, 'test-screenshot');
    
    expect(screenshot).toBeTruthy();
    expect(Buffer.isBuffer(screenshot)).toBe(true);
    expect(screenshot.length).toBeGreaterThan(1000); // Should be a real image
  }, 10000);
});
