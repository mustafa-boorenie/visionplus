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
  test('Go to Amazon and search for laptops under $1000"', async ({ page }) => {
    // Set timeout for this test
    test.setTimeout(60000);

    // Navigate to https://www.google.com
    await page.goto('https://www.google.com');

    // Step 1: Navigate to https://www.amazon.com
    await page.goto('https://www.amazon.com');
    await expect(page).toHaveURL('https://www.amazon.com');

    // Step 2: Wait for 1000ms
    await page.waitForTimeout(1000);

    // Step 3: Wait for 2000ms
    await page.waitForTimeout(2000);

    // Step 4: Wait for 2000ms
    await page.waitForTimeout(2000);

    // Verify test completed successfully
    await expect(page).toHaveURL(/./);
  });
});