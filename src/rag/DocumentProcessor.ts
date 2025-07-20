import fs from 'fs-extra';
import path from 'path';
import { encodingForModel } from 'js-tiktoken';

/**
 * Document chunk for embedding
 */
export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    source: string;
    section: string;
    type: 'api' | 'guide' | 'example';
    tags: string[];
  };
}

/**
 * Processes and chunks Playwright documentation
 */
export class DocumentProcessor {
  private encoder = encodingForModel('text-embedding-ada-002');
  private maxChunkSize = 1000; // tokens

  /**
   * Load and process all Playwright docs
   */
  async loadPlaywrightDocs(): Promise<DocumentChunk[]> {
    const docsDir = path.join(process.cwd(), 'docs/playwright');
    const chunks: DocumentChunk[] = [];

    // Load built-in Playwright knowledge
    chunks.push(...this.getBuiltInPlaywrightDocs());

    // Load any custom docs from the docs directory
    if (await fs.pathExists(docsDir)) {
      const files = await fs.readdir(docsDir);
      for (const file of files) {
        if (file.endsWith('.md') || file.endsWith('.txt')) {
          const content = await fs.readFile(path.join(docsDir, file), 'utf-8');
          const fileChunks = this.chunkDocument(content, file);
          chunks.push(...fileChunks);
        }
      }
    }

    return chunks;
  }

  /**
   * Get built-in Playwright documentation
   */
  private getBuiltInPlaywrightDocs(): DocumentChunk[] {
    return [
      // Selector strategies
      {
        id: 'selectors-best-practices',
        content: `
Playwright Selector Best Practices:

1. Prefer user-visible selectors:
   - page.getByRole('button', { name: 'Submit' })
   - page.getByText('Welcome')
   - page.getByLabel('Email')
   - page.getByPlaceholder('Enter your name')

2. Use data-testid for reliable testing:
   - page.getByTestId('submit-button')
   - page.locator('[data-testid="user-profile"]')

3. CSS selectors:
   - ID: page.locator('#submit-button')
   - Class: page.locator('.btn-primary')
   - Attribute: page.locator('[type="submit"]')
   - Combining: page.locator('button.primary[type="submit"]')

4. XPath (use sparingly):
   - page.locator('//button[contains(text(), "Submit")]')

5. Avoid:
   - Long CSS paths: .container > div > ul > li:nth-child(3) > a
   - Dynamic IDs or classes
   - Absolute XPath: /html/body/div[2]/form/button
        `,
        metadata: {
          source: 'built-in',
          section: 'selectors',
          type: 'guide',
          tags: ['selectors', 'locators', 'best-practices']
        }
      },
      // Actions
      {
        id: 'actions-api',
        content: `
Playwright Actions API:

Navigation:
- await page.goto(url, { waitUntil: 'networkidle' })
- await page.reload()
- await page.goBack()
- await page.goForward()

Clicking:
- await page.click(selector)
- await page.dblclick(selector)
- await page.click(selector, { force: true }) // Force click even if element is covered
- await page.click(selector, { position: { x: 0, y: 0 } })
- await page.click(selector, { button: 'right' }) // Right click

Typing:
- await page.type(selector, text)
- await page.fill(selector, text) // Faster, clears field first
- await page.press(selector, 'Enter')
- await page.keyboard.press('Tab')
- await page.keyboard.type('Hello World')

Waiting:
- await page.waitForSelector(selector, { state: 'visible' })
- await page.waitForSelector(selector, { state: 'hidden' })
- await page.waitForTimeout(milliseconds)
- await page.waitForLoadState('networkidle')
- await page.waitForURL(url)
- await page.waitForFunction(() => document.title.includes('Done'))
        `,
        metadata: {
          source: 'built-in',
          section: 'actions',
          type: 'api',
          tags: ['actions', 'click', 'type', 'navigation', 'wait']
        }
      },
      // Error handling
      {
        id: 'error-handling',
        content: `
Playwright Error Handling Patterns:

1. Auto-waiting and retry:
   - Playwright automatically waits for elements to be actionable
   - Default timeout: 30 seconds
   - Set custom timeout: { timeout: 60000 }

2. Handling dynamic content:
   // Wait for element to appear
   await page.waitForSelector('.dynamic-content', { state: 'visible' });
   
   // Wait for element to disappear
   await page.waitForSelector('.loading', { state: 'hidden' });
   
   // Wait for specific text
   await page.waitForFunction(
     text => document.body.innerText.includes(text),
     'Expected text'
   );

3. Dealing with popups/overlays:
   // Close cookie banner if it exists
   const banner = page.locator('.cookie-banner');
   if (await banner.isVisible()) {
     await banner.locator('button:has-text("Accept")').click();
   }

4. Handling navigation:
   // Wait for navigation after click
   await Promise.all([
     page.waitForNavigation(),
     page.click('a[href="/next-page"]')
   ]);

5. Frame handling:
   const frame = page.frameLocator('#iframe-id');
   await frame.locator('button').click();
        `,
        metadata: {
          source: 'built-in',
          section: 'error-handling',
          type: 'guide',
          tags: ['error-handling', 'retry', 'wait', 'dynamic-content']
        }
      },
      // Modern selectors
      {
        id: 'modern-selectors',
        content: `
Playwright Modern Selector Engine:

1. Role selectors (Recommended):
   - page.getByRole('button', { name: 'Sign in' })
   - page.getByRole('link', { name: 'Home' })
   - page.getByRole('checkbox', { checked: true })
   - page.getByRole('textbox', { name: 'Email' })
   - page.getByRole('heading', { level: 1 })
   - page.getByRole('img', { name: 'Profile picture' })

2. Text selectors:
   - page.getByText('Welcome back')
   - page.getByText('Welcome', { exact: true })
   - page.getByText(/welcome.*back/i) // Regex

3. Label selectors:
   - page.getByLabel('Password')
   - page.getByLabel('I agree to terms')

4. Placeholder selectors:
   - page.getByPlaceholder('Enter your email')

5. Alt text selectors:
   - page.getByAltText('Company logo')

6. Title selectors:
   - page.getByTitle('Close dialog')

7. Test ID selectors:
   - page.getByTestId('submit-form')

8. Chaining selectors:
   - page.getByRole('list').getByText('Item 2')
   - page.getByLabel('Email').fill('user@example.com')
        `,
        metadata: {
          source: 'built-in',
          section: 'modern-selectors',
          type: 'api',
          tags: ['selectors', 'getByRole', 'getByText', 'modern']
        }
      }
    ];
  }

  /**
   * Chunk a document into smaller pieces
   */
  private chunkDocument(content: string, source: string): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const lines = content.split('\n');
    let currentChunk = '';
    let currentTokens = 0;
    let chunkIndex = 0;

    for (const line of lines) {
      const lineTokens = this.encoder.encode(line).length;
      
      if (currentTokens + lineTokens > this.maxChunkSize && currentChunk) {
        // Save current chunk
        chunks.push({
          id: `${source}-chunk-${chunkIndex}`,
          content: currentChunk.trim(),
          metadata: {
            source,
            section: this.extractSection(currentChunk),
            type: this.detectDocType(currentChunk),
            tags: this.extractTags(currentChunk)
          }
        });
        
        // Start new chunk with overlap
        const overlapLines = currentChunk.split('\n').slice(-5).join('\n');
        currentChunk = overlapLines + '\n' + line;
        currentTokens = this.encoder.encode(currentChunk).length;
        chunkIndex++;
      } else {
        currentChunk += line + '\n';
        currentTokens += lineTokens;
      }
    }

    // Add final chunk
    if (currentChunk.trim()) {
      chunks.push({
        id: `${source}-chunk-${chunkIndex}`,
        content: currentChunk.trim(),
        metadata: {
          source,
          section: this.extractSection(currentChunk),
          type: this.detectDocType(currentChunk),
          tags: this.extractTags(currentChunk)
        }
      });
    }

    return chunks;
  }

  private extractSection(content: string): string {
    const match = content.match(/^#+\s+(.+)$/m);
    return match ? match[1] : 'general';
  }

  private detectDocType(content: string): 'api' | 'guide' | 'example' {
    if (content.includes('await page.') || content.includes('page.locator')) {
      return 'api';
    }
    if (content.includes('```') || content.includes('example:')) {
      return 'example';
    }
    return 'guide';
  }

  private extractTags(content: string): string[] {
    const tags: string[] = [];
    
    // Extract common Playwright keywords
    const keywords = [
      'selector', 'click', 'type', 'wait', 'navigation', 'screenshot',
      'iframe', 'popup', 'dialog', 'upload', 'download', 'network',
      'intercept', 'mock', 'test', 'assertion', 'locator', 'role'
    ];
    
    for (const keyword of keywords) {
      if (content.toLowerCase().includes(keyword)) {
        tags.push(keyword);
      }
    }
    
    return [...new Set(tags)];
  }
} 