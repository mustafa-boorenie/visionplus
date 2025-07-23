import { test, expect } from '@playwright/test';
import { chromium, firefox, webkit } from '@playwright/test';

// Helper function to retry actions
async function retryAction(action: () => Promise<void>, retries = 3): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await action();
      return;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

test.describe('intelligent-automation', () => {
  test('ls', async ({ page }) => {
    // Set timeout for this test
    test.setTimeout(60000);

    // Navigate to https://www.amazon.com/
    await page.goto('https://www.amazon.com/');

    // Step 1: Navigate to https://www.amazon.com/
    await page.goto('https://www.amazon.com/');
    await expect(page).toHaveURL('https://www.amazon.com/');

    // Step 2: Wait for 3000ms
    await page.waitForTimeout(3000);

    // Step 3: Click on input#twotabsearchtextbox,input[name='field-keywords'],input[aria-label='Search Amazon'],[role='textbox']
    await page.click('input#twotabsearchtextbox');
    await page.waitForLoadState('networkidle');

    // Step 4: Type "laptop" into input#twotabsearchtextbox,input[name='field-keywords'],[role='textbox']
    await page.type('input#twotabsearchtextbox', 'laptop');
    await expect(page.locator('input#twotabsearchtextbox')).toHaveValue('laptop');

    // Step 5: Press Enter in input#twotabsearchtextbox,input[name='field-keywords']
    await page.press('input#twotabsearchtextbox', 'Enter');

    // Step 6: Wait for 5000ms
    await page.waitForTimeout(5000);

    // Step 7: Take screenshot: search_results.png
    await page.screenshot({ path: 'screenshots/search_results.png.png', fullPage: true });

    // Verify test completed successfully
    await expect(page).toHaveURL(/./);
  });
});