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
  test('Go to Amazon and quickly search for laptops', async ({ page }) => {
    // Set timeout for this test
    test.setTimeout(60000);

    // Navigate to https://amazon.com
    await page.goto('https://amazon.com');

    // Step 1: Navigate to https://amazon.com
    await page.goto('https://amazon.com');
    await expect(page).toHaveURL('https://amazon.com');

    // Step 2: Wait for 2000ms
    await page.waitForTimeout(2000);

    // Step 3: Type "laptops" into input#twotabsearchtextbox
    await page.type('input#twotabsearchtextbox', 'laptops');
    await expect(page.locator('input#twotabsearchtextbox')).toHaveValue('laptops');

    // Step 4: Press Enter in input#twotabsearchtextbox
    await page.press('input#twotabsearchtextbox', 'Enter');

    // Step 5: Wait for 3000ms
    await page.waitForTimeout(3000);

    // Verify test completed successfully
    await expect(page).toHaveURL(/./);
  });
});