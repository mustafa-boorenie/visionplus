import { ScriptRunner, VisionAnalyzer, validateEnvironment, AutomationScript } from '../src';

/**
 * Basic navigation example
 * This script navigates to a website, takes screenshots, and analyzes them
 */
async function main() {
  // Validate environment
  validateEnvironment();

  // Define the automation script
  const script: AutomationScript = {
    name: 'basic-navigation-example',
    description: 'Navigate to a website and analyze the page layout',
    url: 'https://www.example.com',
    actions: [
      // Wait for page to load
      { type: 'wait', duration: 2000 },
      
      // Take initial screenshot
      { type: 'screenshot', name: 'homepage' },
      
      // Scroll down
      { type: 'scroll', direction: 'down', amount: 500 },
      { type: 'wait', duration: 1000 },
      
      // Take screenshot after scroll
      { type: 'screenshot', name: 'homepage-scrolled' },
      
      // Click on a link if available (adjust selector as needed)
      // { type: 'click', selector: 'a[href="/more"]' },
      // { type: 'wait', duration: 2000 },
      // { type: 'screenshot', name: 'secondary-page' }
    ],
    analysis: {
      enabled: true,
      prompts: [
        VisionAnalyzer.COMMON_PROMPTS.DESCRIBE_PAGE,
        VisionAnalyzer.COMMON_PROMPTS.VERIFY_ELEMENTS,
        VisionAnalyzer.COMMON_PROMPTS.CHECK_ACCESSIBILITY
      ]
    }
  };

  // Run the script
  const runner = new ScriptRunner(script);
  await runner.run();
}

// Execute the example
main().catch(console.error); 