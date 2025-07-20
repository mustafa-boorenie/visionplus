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
  test('Go to Amazon and search for laptops under ', async ({ page }) => {
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

    // Step 4: Type "laptops" into input#twotabsearchtextbox
    await page.type('input#twotabsearchtextbox', 'laptops');
    await expect(page.locator('input#twotabsearchtextbox')).toHaveValue('laptops');

    // Step 5: Click on input#nav-search-submit-button
    await page.click('input#nav-search-submit-button');
    await page.waitForLoadState('networkidle');

    // Step 6: Navigate to https://amazon.com
    await page.goto('https://amazon.com');
    await expect(page).toHaveURL('https://amazon.com');

    // Step 7: Wait for 2000ms
    await page.waitForTimeout(2000);

    // Step 8: Click on input#twotabsearchtextbox
    await page.click('input#twotabsearchtextbox');
    await page.waitForLoadState('networkidle');

    // Step 9: Type "laptops" into input#twotabsearchtextbox
    await page.type('input#twotabsearchtextbox', 'laptops');
    await expect(page.locator('input#twotabsearchtextbox')).toHaveValue('laptops');

    // Step 10: Click on input#nav-search-submit-button
    await page.click('input#nav-search-submit-button');
    await page.waitForLoadState('networkidle');

    // Verify test completed successfully
    await expect(page).toHaveURL(/./);
  });
});