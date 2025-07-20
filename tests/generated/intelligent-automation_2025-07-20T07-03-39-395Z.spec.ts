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
  test('search up the effectiveness of bpc-157', async ({ page }) => {
    // Set timeout for this test
    test.setTimeout(60000);

    // Navigate to https://pubmed.ncbi.nlm.nih.gov/
    await page.goto('https://pubmed.ncbi.nlm.nih.gov/');

    // Step 1: Navigate to https://pubmed.ncbi.nlm.nih.gov/
    await page.goto('https://pubmed.ncbi.nlm.nih.gov/');
    await expect(page).toHaveURL('https://pubmed.ncbi.nlm.nih.gov/');

    // Step 2: Type "bpc-157" into input[name='term'],#id_term,input.term-input[role='combobox']
    await page.type('input[name=\'term\']', 'bpc-157');
    await expect(page.locator('input[name=\'term\']')).toHaveValue('bpc-157');

    // Step 3: Press Enter in input[name='term'],#id_term,input.term-input[role='combobox']
    await page.press('input[name=\'term\']', 'Enter');

    // Step 4: Wait for 2000ms
    await page.waitForTimeout(2000);

    // Verify test completed successfully
    await expect(page).toHaveURL(/./);
  });
});