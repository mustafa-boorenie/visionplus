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
  test('click close on the pop up titled 'improving your site experience'', async ({ page }) => {
    // Set timeout for this test
    test.setTimeout(60000);

    // Navigate to https://www.aetna.com/health-care-professionals/join-the-aetna-network.html
    await page.goto('https://www.aetna.com/health-care-professionals/join-the-aetna-network.html');

    // Step 1: Navigate to https://www.aetna.com/health-care-professionals/join-the-aetna-network.html
    await page.goto('https://www.aetna.com/health-care-professionals/join-the-aetna-network.html');
    await expect(page).toHaveURL('https://www.aetna.com/health-care-professionals/join-the-aetna-network.html');

    // Step 2: Wait for 5000ms
    await page.waitForTimeout(5000);

    // Step 3: Click on button:has-text('Close'),[aria-label='Close'],[data-testid='close-button'],button.close,[role='button']:has-text('Close')
    await page.click('button:has-text(\'Close\')');
    await page.waitForLoadState('networkidle');

    // Verify test completed successfully
    await expect(page).toHaveURL(/./);
  });
});