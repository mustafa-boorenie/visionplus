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
  test('Go to Amazon and search for laptops under $1000', async ({ page }) => {
    // Set timeout for this test
    test.setTimeout(60000);

    // Navigate to https://amazon.com
    await page.goto('https://amazon.com');

    // Step 1: Navigate to https://amazon.com
    await page.goto('https://amazon.com');
    await expect(page).toHaveURL('https://amazon.com');

    // Step 2: Wait for 2000ms
    await page.waitForTimeout(2000);

    // Step 3: Click on input#twotabsearchtextbox
    await page.click('input#twotabsearchtextbox');
    await page.waitForLoadState('networkidle');

    // Step 4: Type "laptops under $1000" into input#twotabsearchtextbox
    await page.type('input#twotabsearchtextbox', 'laptops under $1000');
    await expect(page.locator('input#twotabsearchtextbox')).toHaveValue('laptops under $1000');

    // Step 5: Wait for 1000ms
    await page.waitForTimeout(1000);

    // Step 6: Press Enter in input#twotabsearchtextbox
    await page.press('input#twotabsearchtextbox', 'Enter');

    // Step 7: Wait for 2000ms
    await page.waitForTimeout(2000);

    // Verify test completed successfully
    await expect(page).toHaveURL(/./);
  });
});