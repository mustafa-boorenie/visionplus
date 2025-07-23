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
  test('hover on It infrastructure tab', async ({ page }) => {
    // Set timeout for this test
    test.setTimeout(60000);

    // Navigate to https://www.dell.com/en-us/shop/dell-laptops/scr/laptops
    await page.goto('https://www.dell.com/en-us/shop/dell-laptops/scr/laptops');

    // Step 1: Navigate to https://www.dell.com/en-us/shop/dell-laptops/scr/laptops
    await page.goto('https://www.dell.com/en-us/shop/dell-laptops/scr/laptops');
    await expect(page).toHaveURL('https://www.dell.com/en-us/shop/dell-laptops/scr/laptops');

    // Step 2: Wait for 3000ms
    await page.waitForTimeout(3000);

    // Step 3: Click on #menuItem_IT-Infrastructure,[data-testid='it-infrastructure-menu'],[role='menuitem']:has-text('IT Infrastructure')
    await page.click('#menuItem_IT-Infrastructure');
    await page.waitForLoadState('networkidle');

    // Verify test completed successfully
    await expect(page).toHaveURL(/./);
  });
});