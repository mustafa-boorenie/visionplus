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
  test('go to google', async ({ page }) => {
    // Set timeout for this test
    test.setTimeout(60000);

    // Navigate to https://www.amazon.com/s?k=laptop&ref=nb_sb_noss
    await page.goto('https://www.amazon.com/s?k=laptop&ref=nb_sb_noss');

    // Step 1: Navigate to https://www.google.com
    await page.goto('https://www.google.com');
    await expect(page).toHaveURL('https://www.google.com');

    // Step 2: Wait for 1000ms
    await page.waitForTimeout(1000);

    // Step 3: Type "laptop" into textarea[name='q'],#APjFqb
    await page.type('textarea[name=\'q\']', 'laptop');
    await expect(page.locator('textarea[name=\'q\']')).toHaveValue('laptop');

    // Step 4: Press Enter in textarea[name='q'],#APjFqb
    await page.press('textarea[name=\'q\']', 'Enter');

    // Step 5: Wait for 3000ms
    await page.waitForTimeout(3000);

    // Verify test completed successfully
    await expect(page).toHaveURL(/./);
  });
});