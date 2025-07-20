# AI Playwright Scripter

An intelligent browser automation framework that combines Playwright with OpenAI's Vision API and natural language processing. Simply describe what you want to automate in plain English, and the system will break it down into steps, execute them, and handle errors intelligently.

## 🎬 Quick Demo

```bash
# Run the interactive demo
npm run demo
```

This will show you the intelligent automation in action with real-time progress tracking and error recovery.

## Features

- 🤖 **Natural Language Automation**: Describe tasks in plain English - no coding required
- 🧠 **Intelligent Task Breakdown**: AI automatically breaks complex tasks into executable steps  
- 🔄 **Self-Healing Scripts**: Automatically recovers from failures using Vision API and HTML analysis
- 💾 **Smart Caching**: Learns from successful runs and reuses scripts for similar tasks
- 📸 **Vision-Powered Debugging**: Uses screenshot analysis to understand and fix errors
- 🔍 **AI-Powered Analysis**: Analyze web pages and extract insights using GPT-4 Vision
- 📊 **Comprehensive Reporting**: Generate detailed HTML and JSON reports with analysis
- 🎯 **TypeScript Support**: Full type safety and IntelliSense support
- 🌐 **Multi-Browser Support**: Works with Chromium, Firefox, and WebKit

## Prerequisites

- Node.js 16.0.0 or higher
- An OpenAI API key with access to GPT-4 Vision

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/ai-playwright-scripter.git
cd ai-playwright-scripter
```

2. Install dependencies:
```bash
npm install
```

3. Install Playwright browsers:
```bash
npx playwright install
```

4. Create a `.env` file in the root directory:
```env
# OpenAI API Configuration
OPENAI_API_KEY=your-openai-api-key-here

# Browser Configuration
BROWSER_TYPE=chromium # Options: chromium, firefox, webkit
HEADLESS_MODE=false # Set to true for headless browsing

# Screenshot Configuration
SCREENSHOT_PATH=./screenshots
SCREENSHOT_QUALITY=80 # JPEG quality (0-100)

# Report Configuration
REPORT_PATH=./reports

# Logging Configuration
LOG_LEVEL=info # Options: error, warn, info, debug

# Default Timeouts (in milliseconds)
DEFAULT_TIMEOUT=30000
NAVIGATION_TIMEOUT=60000
```

## Quick Start

### Natural Language Automation (NEW!)

Simply describe what you want to automate:

```bash
# Interactive mode
npm run ai

# Or directly with a task
npm run ai -- automate -t "Search for laptops on Amazon and compare prices" -u "https://amazon.com"

# Build and install globally
npm run ai:build
ai-playwright automate -t "Fill out the contact form with test data"
```

The system will:
1. ✨ Break down your task into specific steps
2. 🔄 Execute each step with error recovery
3. 📸 Use Vision API to understand the page if needed
4. 💾 Cache successful scripts for future use
5. 📊 Generate detailed reports

### Traditional Script Example

```typescript
import { ScriptRunner, VisionAnalyzer, AutomationScript } from './src';

const script: AutomationScript = {
  name: 'my-first-script',
  url: 'https://www.example.com',
  actions: [
    { type: 'wait', duration: 2000 },
    { type: 'screenshot', name: 'homepage' },
    { type: 'scroll', direction: 'down', amount: 500 },
    { type: 'screenshot', name: 'after-scroll' }
  ],
  analysis: {
    enabled: true,
    prompts: [
      VisionAnalyzer.COMMON_PROMPTS.DESCRIBE_PAGE,
      VisionAnalyzer.COMMON_PROMPTS.CHECK_ACCESSIBILITY
    ]
  }
};

const runner = new ScriptRunner(script);
await runner.run();
```

## Running Examples

The project includes several example scripts:

```bash
# Intelligent automation with natural language (NEW!)
npm run example:intelligent

# Basic navigation and analysis
npm run example:basic

# Form filling automation
npm run example:form

# Accessibility checking
npm run example:accessibility

# Portal automation (login, navigation)
npm run example:portal

# Run cached scripts
npm run script github-nav
```

### Intelligent Automation Examples

```bash
# Interactive CLI
npm run ai

# Direct commands
npm run ai -- automate -t "Login to GitHub and star the playwright repository"
npm run ai -- automate -t "Search for 'iPhone 15' on eBay and capture the first 5 results"
npm run ai -- automate -t "Navigate to CNN and extract today's top headlines"

# With verbose output for detailed progress
npm run ai -- automate -t "Fill out contact form" -u "https://example.com/contact" -v

# Show example tasks
npm run ai -- examples

# Manage cache
npm run ai -- cache --list
npm run ai -- cache --clear

# Generate Playwright tests from cached scripts
npm run ai -- generate-tests
npm run ai -- generate-tests -o ./my-tests
```

## Project Structure

```
ai-playwright-scripter/
├── src/                    # Source code
│   ├── browser/           # Browser automation logic
│   ├── vision/            # OpenAI Vision API integration
│   ├── utils/             # Utilities (config, logger, results)
│   ├── types/             # TypeScript type definitions
│   ├── ScriptRunner.ts    # Main script orchestrator
│   └── index.ts           # Main exports
├── examples/              # Example scripts
├── scripts/               # Cached automation scripts
├── screenshots/           # Captured screenshots
├── reports/               # Generated reports
├── logs/                  # Application logs
└── README.md             # This file
```

## API Reference

### Browser Actions

```typescript
// Navigate to a URL
{ type: 'navigate', url: 'https://example.com' }

// Click an element
{ type: 'click', selector: 'button#submit' }

// Type text
{ type: 'type', selector: 'input[name="email"]', text: 'user@example.com' }

// Wait
{ type: 'wait', duration: 2000 } // Wait for milliseconds
{ type: 'wait', selector: '.loading', state: 'hidden' } // Wait for element state

// Scroll
{ type: 'scroll', direction: 'down', amount: 500 }

// Select dropdown option
{ type: 'select', selector: 'select#country', value: 'USA' }

// Take screenshot
{ type: 'screenshot', name: 'my-screenshot' }
```

### Vision Analysis Prompts

The `VisionAnalyzer` class provides pre-defined prompts:

- `DESCRIBE_PAGE`: Describe the webpage layout and content
- `EXTRACT_TEXT`: Extract all visible text
- `CHECK_ACCESSIBILITY`: Analyze accessibility issues
- `VERIFY_ELEMENTS`: List interactive elements
- `ANALYZE_FORM`: Describe form fields
- `CHECK_ERRORS`: Check for error messages
- `NAVIGATION_ANALYSIS`: Describe navigation structure
- `CONTENT_SUMMARY`: Summarize page content
- `UI_CONSISTENCY`: Analyze UI consistency
- `MOBILE_RESPONSIVENESS`: Evaluate mobile optimization

### Custom Scripts

Create custom automation scripts:

```typescript
import { BrowserAutomation, VisionAnalyzer, ResultsHandler } from './src';

async function myCustomAutomation() {
  const browser = new BrowserAutomation();
  const vision = new VisionAnalyzer();
  const results = new ResultsHandler('my-automation');

  try {
    await browser.initialize();
    
    // Your automation logic here
    await browser.executeAction({ type: 'navigate', url: 'https://example.com' });
    const screenshot = await browser.takeScreenshot('page');
    
    // Analyze with custom prompt
    const analysis = await vision.analyzeScreenshot({
      screenshotPath: screenshot,
      prompt: 'What products are displayed on this page?'
    });
    
    results.addScreenshot('page', screenshot, analysis);
    
  } finally {
    await browser.close();
    results.complete();
    await results.saveHtmlReport();
  }
}
```

## Intelligent Automation System

The intelligent automation system is a breakthrough feature that allows you to automate web tasks using natural language. Simply describe what you want to do, and the AI will figure out how to do it.

### How It Works

1. **Task Analysis**: AI breaks down your natural language request into specific browser actions
2. **Smart Execution**: Each step is executed with built-in error recovery
3. **Vision-Based Debugging**: When actions fail, the system takes screenshots and uses Vision API to understand what went wrong
4. **HTML Analysis**: After 5 failed attempts, the system analyzes the page HTML to find alternative approaches
5. **Learning & Caching**: Successful scripts are cached and reused for similar tasks
6. **Test Generation**: Automatically generates Playwright test code from successful runs

### Key Features

- **Self-Healing**: Automatically fixes broken selectors by analyzing screenshots
- **Smart Retries**: Uses AI to suggest alternative approaches when actions fail
- **Progress Tracking**: Beautiful real-time progress bars and status updates
- **Intelligent Caching**: Recognizes similar tasks and reuses successful scripts
- **Test Generation**: Convert successful automations into maintainable Playwright tests
- **Detailed Logging**: Export progress logs for debugging and analysis

### Example Usage

```typescript
import { IntelligentAutomation } from 'ai-playwright-scripter';

// Create automation from natural language
const automation = new IntelligentAutomation(
  "Go to Amazon, search for wireless headphones under $100, and capture the top 5 results"
);

// Execute with automatic error handling
await automation.execute('https://www.amazon.com');
```

### Progress Tracking

The system provides beautiful real-time progress tracking with:

- **Progress Bars**: Visual indication of completion percentage
- **Step Status**: Clear indicators for start, success, failure, and retry
- **Time Tracking**: Shows elapsed time for each operation
- **Detailed Summary**: Final report with success rate, duration, and retry count

```bash
═══════════════════════════════════════════════════════════
🤖 AI Playwright - Intelligent Automation
═══════════════════════════════════════════════════════════

[1/5] Starting: Navigate to https://github.com (0s)
[1/5] ✓ Completed: Navigate to https://github.com
Progress: ██████░░░░░░░░░░░░░░░░░░░░░░░ 20%

[2/5] Starting: Search for playwright (3s)
[2/5] ✗ Failed: Search for playwright
[2/5] ↻ Retry 1/5: Search for playwright
[2/5] 🔍 Analyzing: Analyzing failure with Vision API
[2/5] ✓ Completed: Search for playwright
Progress: ████████████░░░░░░░░░░░░░░░░░ 40%
```

### Test Generation

Every successful automation is automatically converted into a maintainable Playwright test:

```typescript
// Generated test example
import { test, expect } from '@playwright/test';

test.describe('search-github-repos', () => {
  test('Search for playwright repository on GitHub', async ({ page }) => {
    // Set timeout for this test
    test.setTimeout(60000);
    
    // Navigate to https://github.com
    await page.goto('https://github.com');
    await expect(page).toHaveURL('https://github.com');
    
    // Step 1: Click on search button
    await page.click('button[aria-label="Search"]');
    await page.waitForLoadState('networkidle');
    
    // Step 2: Type "playwright" into input[name="query"]
    await page.type('input[name="query"]', 'playwright');
    await expect(page.locator('input[name="query"]')).toHaveValue('playwright');
    
    // Additional steps...
  });
});
```

Generate tests from all cached scripts:
```bash
npm run ai -- generate-tests
```

## User Stories Implementation

### 1. Script Writer for Changing Websites

The intelligent automation system automatically adapts to website changes:

```typescript
// AI analyzes the page visually when selectors fail
"The automation is trying to: Click on login button
Current action failed: {selector: 'button#login'}

Vision API suggestion: The login button has moved. 
Try selector: 'button[aria-label=\"Sign in\"]'"
```

### 2. Natural Language Portal Automation

Admin workers can now automate tasks without writing code:

```bash
ai-playwright automate -t "Login to the admin portal and download this month's sales report"

# The system will:
# 1. Navigate to the portal
# 2. Find and fill the login form
# 3. Navigate to reports section
# 4. Locate and download the sales report
```

## Advanced Features

### Dynamic Element Detection

```typescript
// Use Vision API to find elements when selectors are unreliable
const screenshotPath = await browser.takeScreenshot('current-page');
const elements = await vision.findElements(screenshotPath, 'submit buttons');
```

### Screenshot Comparison

```typescript
// Compare two screenshots to detect changes
const changes = await vision.compareScreenshots(
  'screenshots/before.png',
  'screenshots/after.png',
  ['header', 'navigation', 'main content']
);
```

### Batch Analysis

```typescript
// Analyze multiple screenshots with different prompts
const results = await vision.analyzeMultipleScreenshots(
  ['screen1.png', 'screen2.png', 'screen3.png'],
  VisionAnalyzer.COMMON_PROMPTS.CHECK_ACCESSIBILITY
);
```

## Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | Your OpenAI API key | Required |
| `BROWSER_TYPE` | Browser to use (chromium, firefox, webkit) | chromium |
| `HEADLESS_MODE` | Run browser in headless mode | false |
| `SCREENSHOT_PATH` | Directory for screenshots | ./screenshots |
| `SCREENSHOT_QUALITY` | JPEG quality (0-100) | 80 |
| `REPORT_PATH` | Directory for reports | ./reports |
| `LOG_LEVEL` | Logging level | info |
| `DEFAULT_TIMEOUT` | Default action timeout (ms) | 30000 |
| `NAVIGATION_TIMEOUT` | Navigation timeout (ms) | 60000 |

### Browser Configuration

```typescript
const browser = new BrowserAutomation({
  browserType: 'firefox',
  headless: true,
  viewport: { width: 1920, height: 1080 },
  timeout: 60000
});
```

## Troubleshooting

### Common Issues

1. **"OPENAI_API_KEY is required"**
   - Make sure your `.env` file contains a valid OpenAI API key
   - Ensure the `.env` file is in the project root directory

2. **"Browser not initialized"**
   - Always call `await browser.initialize()` before using browser actions
   - Check that Playwright browsers are installed: `npx playwright install`

3. **"Failed to take screenshot"**
   - Ensure the screenshot directory exists and is writable
   - Check that the page has loaded before taking screenshots

4. **Rate Limiting**
   - The OpenAI API has rate limits; add delays between Vision API calls if needed
   - Consider implementing retry logic for API calls

### Debug Mode

Enable debug logging for more information:

```env
LOG_LEVEL=debug
```

## Best Practices

1. **Wait for Page Stability**: Always add appropriate waits after navigation or actions
2. **Error Handling**: Wrap automation in try-catch blocks and take error screenshots
3. **Selective Analysis**: Only analyze screenshots when needed to save API costs
4. **Modular Scripts**: Break complex automations into smaller, reusable functions
5. **Version Control**: Store your automation scripts in the `scripts/` directory

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
- Create an issue on GitHub
- Check existing issues for solutions
- Review the examples for common patterns

---

Built with ❤️ using [Playwright](https://playwright.dev/) and [OpenAI Vision API](https://platform.openai.com/docs/guides/vision) 