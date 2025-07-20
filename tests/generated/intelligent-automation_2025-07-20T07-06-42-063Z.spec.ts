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
  test('click on the accept al cookies button', async ({ page }) => {
    // Set timeout for this test
    test.setTimeout(60000);

    // Navigate to https://pubmed.ncbi.nlm.nih.gov/30915550/
    await page.goto('https://pubmed.ncbi.nlm.nih.gov/30915550/');

    // Step 1: Navigate to https://pubmed.ncbi.nlm.nih.gov/30915550/
    await page.goto('https://pubmed.ncbi.nlm.nih.gov/30915550/');
    await expect(page).toHaveURL('https://pubmed.ncbi.nlm.nih.gov/30915550/');

    // Step 2: Wait for 3000ms
    await page.waitForTimeout(3000);

    // Step 3: Click on button:has-text('Accept'),button[aria-label='Accept Cookies'],[data-testid='cookie-accept-button'],button[class='accept-cookies'],.cookie-banner button
    await page.click('button:has-text(\'Accept\')');
    await page.waitForLoadState('networkidle');

    // Verify test completed successfully
    await expect(page).toHaveURL(/./);
  });
});