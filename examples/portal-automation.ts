import { ScriptRunner, VisionAnalyzer, validateEnvironment, AutomationScript, BrowserAutomation } from '../src';

/**
 * Portal automation example
 * This script demonstrates how to automate interactions with web portals
 * including login, navigation, and data extraction
 */
async function main() {
  // Validate environment
  validateEnvironment();

  // Define the automation script for a demo portal
  const script: AutomationScript = {
    name: 'portal-automation',
    description: 'Automate portal login and navigation',
    url: 'https://demo.opencart.com/admin/',  // Example demo portal
    actions: [
      // Wait for login page to load
      { type: 'wait', duration: 3000 },
      
      // Take screenshot of login page
      { type: 'screenshot', name: 'login-page' },
      
      // Fill login form (demo credentials - adjust for your portal)
      { type: 'type', selector: 'input[name="username"]', text: 'demo' },
      { type: 'type', selector: 'input[name="password"]', text: 'demo' },
      
      // Take screenshot before login
      { type: 'screenshot', name: 'login-filled' },
      
      // Submit login form
      { type: 'click', selector: 'button[type="submit"]' },
      { type: 'wait', duration: 5000 },
      
      // Take screenshot after login
      { type: 'screenshot', name: 'dashboard' },
      
      // Navigate to different sections (example)
      // { type: 'click', selector: 'a[href*="catalog"]' },
      // { type: 'wait', duration: 3000 },
      // { type: 'screenshot', name: 'catalog-section' },
      
      // Example: Extract data from a table
      // { type: 'wait', selector: 'table.table' },
      // { type: 'screenshot', name: 'data-table' }
    ],
    analysis: {
      enabled: true,
      prompts: [
        'Identify the login form fields and their current values',
        'Describe the dashboard layout and main navigation options',
        'Extract any visible data, statistics, or metrics from the dashboard',
        'List all menu items and navigation options available',
        'Check for any error messages or notifications'
      ]
    }
  };

  // Run the script
  const runner = new ScriptRunner(script);
  await runner.run();

  console.log('\n🤖 Portal Automation Complete!');
  console.log('Check the reports folder for detailed analysis.');
}

/**
 * Advanced example: Dynamic portal interaction based on Vision analysis
 */
async function advancedPortalAutomation() {
  validateEnvironment();

  const browser = new BrowserAutomation();
  const vision = new VisionAnalyzer();

  try {
    await browser.initialize();
    
    // Navigate to portal
    await browser.executeAction({
      type: 'navigate',
      url: 'https://example-portal.com'
    });

    // Take screenshot and analyze
    const screenshotPath = await browser.takeScreenshot('portal-page');
    const analysis = await vision.analyzeScreenshot({
      screenshotPath,
      prompt: 'Find all clickable buttons and links on this page. List them with their text labels.'
    });

    console.log('Vision Analysis:', analysis.content);

    // Based on the analysis, you could dynamically decide what to click
    // For example, if the analysis mentions a "Login" button:
    if (analysis.content.includes('Login')) {
      await browser.executeAction({
        type: 'click',
        selector: 'button:has-text("Login")'  // Playwright's text selector
      });
    }

  } finally {
    await browser.close();
  }
}

// Execute the example
main().catch(console.error);

// Uncomment to run the advanced example
// advancedPortalAutomation().catch(console.error); 