import { AutomationScript, BrowserAction, PressAction } from '../types';
import fs from 'fs-extra';
import path from 'path';

/**
 * Generates Playwright test code from automation scripts
 */
export class TestGenerator {
  private script: AutomationScript;
  private testName: string;

  constructor(script: AutomationScript) {
    this.script = script;
    this.testName = this.sanitizeName(script.name);
  }

  /**
   * Generate a Playwright test file
   */
  async generateTest(outputPath?: string): Promise<string> {
    const testCode = this.generateTestCode();
    
    if (outputPath) {
      await fs.ensureDir(path.dirname(outputPath));
      await fs.writeFile(outputPath, testCode);
    }
    
    return testCode;
  }

  /**
   * Generate the test code
   */
  private generateTestCode(): string {
    const imports = this.generateImports();
    const testBody = this.generateTestBody();
    const helpers = this.generateHelpers();

    return `${imports}

${helpers}

test.describe('${this.testName}', () => {
  test('${this.script.description || this.testName}', async ({ page }) => {
${testBody}
  });
});`;
  }

  /**
   * Generate import statements
   */
  private generateImports(): string {
    return `import { test, expect } from '@playwright/test';
import { chromium, firefox, webkit } from '@playwright/test';`;
  }

  /**
   * Generate test body from actions
   */
  private generateTestBody(): string {
    const lines: string[] = [];
    
    // Add timeout configuration
    lines.push('    // Set timeout for this test');
    lines.push('    test.setTimeout(60000);');
    lines.push('');
    
    // Add initial navigation
    if (this.script.url) {
      lines.push(`    // Navigate to ${this.script.url}`);
      lines.push(`    await page.goto('${this.script.url}');`);
      lines.push('');
    }

    // Convert each action to test code
    this.script.actions.forEach((action, index) => {
      const comment = this.getActionComment(action);
      const code = this.actionToCode(action);
      
      if (comment) {
        lines.push(`    // Step ${index + 1}: ${comment}`);
      }
      
      if (code) {
        lines.push(`    ${code}`);
        
        // Add assertion or wait after certain actions
        const assertion = this.getAssertion(action);
        if (assertion) {
          lines.push(`    ${assertion}`);
        }
        
        lines.push('');
      }
    });

    // Add final assertions
    lines.push('    // Verify test completed successfully');
    lines.push('    await expect(page).toHaveURL(/./);');

    return lines.join('\n');
  }

  /**
   * Convert action to Playwright code
   */
  private actionToCode(action: BrowserAction): string {
    switch (action.type) {
      case 'navigate':
        return `await page.goto('${action.url}');`;
      
      case 'click': {
        const selector = Array.isArray(action.selector) ? action.selector[0] : action.selector;
        return `await page.click('${this.escapeSelector(selector)}');`;
      }
      
      case 'type': {
        const selector = Array.isArray(action.selector) ? action.selector[0] : action.selector;
        return `await page.type('${this.escapeSelector(selector)}', '${this.escapeString(action.text)}');`;
      }
      
      case 'press': {
        const pressAction = action as PressAction;
        if (pressAction.selector) {
          const selector = Array.isArray(pressAction.selector) ? pressAction.selector[0] : pressAction.selector;
          return `await page.press('${this.escapeSelector(selector)}', '${pressAction.key}');`;
        } else {
          return `await page.keyboard.press('${pressAction.key}');`;
        }
      }
      
      case 'wait':
        if (action.duration) {
          return `await page.waitForTimeout(${action.duration});`;
        } else if (action.selector) {
          const selector = Array.isArray(action.selector) ? action.selector[0] : action.selector;
          return `await page.waitForSelector('${this.escapeSelector(selector)}', { state: '${action.state || 'visible'}' });`;
        }
        return 'await page.waitForTimeout(1000);';
      
      case 'scroll':
        if (action.selector) {
          const selector = Array.isArray(action.selector) ? action.selector[0] : action.selector;
          return `await page.locator('${this.escapeSelector(selector)}').scrollIntoViewIfNeeded();`;
        } else {
          const x = action.direction === 'right' ? action.amount || 0 : action.direction === 'left' ? -(action.amount || 0) : 0;
          const y = action.direction === 'down' ? action.amount || 0 : action.direction === 'up' ? -(action.amount || 0) : 0;
          return `await page.mouse.wheel(${x}, ${y});`;
        }
      
      case 'select': {
        const selector = Array.isArray(action.selector) ? action.selector[0] : action.selector;
        const values = Array.isArray(action.value) ? action.value : [action.value];
        return `await page.selectOption('${this.escapeSelector(selector)}', ${JSON.stringify(values)});`;
      }
      
      case 'screenshot':
        return `await page.screenshot({ path: 'screenshots/${action.name}.png', fullPage: ${action.options?.fullPage ?? true} });`;
      
      case 'goBack':
        return `await page.goBack({ waitUntil: '${action.waitUntil || 'load'}' });`;
      
      case 'goForward':
        return `await page.goForward({ waitUntil: '${action.waitUntil || 'load'}' });`;
      
      case 'reload':
        return `await page.reload({ waitUntil: '${action.waitUntil || 'load'}' });`;
      
      case 'newTab': {
        const code = ['const newPage = await context.newPage();'];
        if (action.url) {
          code.push(`await newPage.goto('${action.url}');`);
        }
        code.push('page = newPage;');
        return code.join('\n    ');
      }
      
      case 'switchTab': {
        if (action.index !== undefined) {
          return `page = context.pages()[${action.index}];\n    await page.bringToFront();`;
        } else if (action.url) {
          return `page = context.pages().find(p => p.url().includes('${action.url}'));\n    await page.bringToFront();`;
        } else if (action.title) {
          return `for (const p of context.pages()) {\n      if ((await p.title()).includes('${action.title}')) {\n        page = p;\n        await page.bringToFront();\n        break;\n      }\n    }`;
        }
        return '// Invalid switchTab action';
      }
      
      case 'closeTab': {
        if (action.index !== undefined) {
          return `await context.pages()[${action.index}].close();`;
        } else {
          return `await page.close();\n    page = context.pages()[context.pages().length - 1];`;
        }
      }
      
      default:
        return '// Unknown action type';
    }
  }

  /**
   * Get comment for action
   */
  private getActionComment(action: BrowserAction): string {
    switch (action.type) {
      case 'navigate':
        return `Navigate to ${action.url}`;
      case 'click':
        return `Click on ${action.selector}`;
      case 'type':
        return `Type "${action.text}" into ${action.selector}`;
      case 'press':
        return `Press ${(action as PressAction).key}${(action as PressAction).selector ? ` in ${(action as PressAction).selector}` : ''}`;
      case 'wait':
        return action.duration ? `Wait for ${action.duration}ms` : `Wait for ${action.selector}`;
      case 'scroll':
        return `Scroll ${action.direction || 'down'}`;
      case 'select':
        return `Select "${action.value}" in ${action.selector}`;
      case 'screenshot':
        return `Take screenshot: ${action.name}`;
      case 'goBack':
        return 'Navigate back to previous page';
      case 'goForward':
        return 'Navigate forward in browser history';
      case 'reload':
        return 'Reload the current page';
      case 'newTab':
        return action.url ? `Open new tab with URL: ${action.url}` : 'Open new tab';
      case 'switchTab':
        if (action.index !== undefined) return `Switch to tab at index ${action.index}`;
        if (action.url) return `Switch to tab with URL containing: ${action.url}`;
        if (action.title) return `Switch to tab with title containing: ${action.title}`;
        return 'Switch tab';
      case 'closeTab':
        return action.index !== undefined ? `Close tab at index ${action.index}` : 'Close current tab';
      default:
        return '';
    }
  }

  /**
   * Get assertion for action
   */
  private getAssertion(action: BrowserAction): string | null {
    switch (action.type) {
      case 'click':
        // Add a wait after click to ensure action completed
        return 'await page.waitForLoadState(\'networkidle\');';
      case 'type': {
        // Verify the input has the expected value
        const selector = Array.isArray(action.selector) ? action.selector[0] : action.selector;
        return `await expect(page.locator('${this.escapeSelector(selector)}')).toHaveValue('${this.escapeString(action.text)}');`;
      }
      case 'navigate':
        // Verify navigation completed
        return `await expect(page).toHaveURL('${action.url}');`;
      default:
        return null;
    }
  }

  /**
   * Generate helper functions
   */
  private generateHelpers(): string {
    return `// Helper function to retry actions
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
}`;
  }

  /**
   * Escape selector for use in code
   */
  private escapeSelector(selector: string): string {
    return selector.replace(/'/g, "\\'");
  }

  /**
   * Escape string for use in code
   */
  private escapeString(str: string): string {
    return str.replace(/'/g, "\\'").replace(/\n/g, '\\n');
  }

  /**
   * Sanitize name for use as test name
   */
  private sanitizeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').toLowerCase();
  }

  /**
   * Generate a spec file with multiple tests
   */
  static async generateSpecFile(scripts: AutomationScript[], outputPath: string): Promise<void> {
    const tests: string[] = [];
    
    for (const script of scripts) {
      const generator = new TestGenerator(script);
      const testCode = await generator.generateTest();
      tests.push(testCode);
    }

    const specContent = `import { test, expect } from '@playwright/test';

${tests.join('\n\n')}

// Configure test settings
test.use({
  viewport: { width: 1280, height: 720 },
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
});`;

    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, specContent);
  }
} 