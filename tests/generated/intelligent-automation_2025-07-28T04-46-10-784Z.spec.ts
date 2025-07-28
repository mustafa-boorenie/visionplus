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
  test('go to amazon', async ({ page }) => {
    // Set timeout for this test
    test.setTimeout(60000);

    // Navigate to about:blank
    await page.goto('about:blank');

    // Step 1: Navigate to https://www.amazon.com
    await page.goto('https://www.amazon.com');
    await expect(page).toHaveURL('https://www.amazon.com');

    // Verify test completed successfully
    await expect(page).toHaveURL(/./);
  });
});