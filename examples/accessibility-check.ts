import { ScriptRunner, VisionAnalyzer, validateEnvironment, AutomationScript } from '../src';

/**
 * Accessibility check example
 * This script analyzes web pages for accessibility issues
 */
async function main() {
  // Validate environment
  validateEnvironment();

  // Define the automation script
  const script: AutomationScript = {
    name: 'accessibility-check',
    description: 'Check website accessibility using Vision API',
    url: 'https://www.github.com',
    actions: [
      // Wait for page to load
      { type: 'wait', duration: 3000 },
      
      // Take screenshot at different viewport sizes
      { type: 'screenshot', name: 'desktop-view', options: { fullPage: true } },
      
      // Simulate mobile viewport (would need browser config adjustment)
      // For now, just scroll to different sections
      { type: 'scroll', direction: 'down', amount: 1000 },
      { type: 'wait', duration: 1000 },
      { type: 'screenshot', name: 'middle-section' },
      
      // Check footer
      { type: 'scroll', direction: 'down', amount: 5000 },
      { type: 'wait', duration: 1000 },
      { type: 'screenshot', name: 'footer-section' },
      
      // Try to find and click on an accessibility-related link
      // { type: 'click', selector: 'a[href*="accessibility"]' },
      // { type: 'wait', duration: 2000 },
      // { type: 'screenshot', name: 'accessibility-page' }
    ],
    analysis: {
      enabled: true,
      prompts: [
        VisionAnalyzer.COMMON_PROMPTS.CHECK_ACCESSIBILITY,
        VisionAnalyzer.COMMON_PROMPTS.UI_CONSISTENCY,
        'Check if the color contrast appears sufficient for text readability',
        'Identify any images that might be missing alt text indicators',
        'Evaluate the heading hierarchy and structure',
        'Check if interactive elements are clearly distinguishable',
        'Assess if the navigation is clear and accessible'
      ]
    }
  };

  // Run the script
  const runner = new ScriptRunner(script);
  await runner.run();

  console.log('\n📊 Accessibility Check Complete!');
  console.log('Check the reports folder for detailed accessibility analysis.');
  console.log('\nKey areas to review:');
  console.log('- Color contrast issues');
  console.log('- Missing alt text');
  console.log('- Heading structure');
  console.log('- Keyboard navigation indicators');
  console.log('- Form labels and error messages');
}

// Execute the example
main().catch(console.error); 