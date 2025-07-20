import { ScriptRunner, VisionAnalyzer, validateEnvironment, AutomationScript } from '../src';

/**
 * Form filling example
 * This script demonstrates how to fill out forms and analyze the results
 */
async function main() {
  // Validate environment
  validateEnvironment();

  // Define the automation script
  const script: AutomationScript = {
    name: 'form-filling-example',
    description: 'Fill out a contact form and analyze the response',
    url: 'https://www.w3schools.com/html/tryit.asp?filename=tryhtml_form_submit',
    actions: [
      // Wait for iframe to load
      { type: 'wait', duration: 3000 },
      
      // Take screenshot of the form
      { type: 'screenshot', name: 'form-initial' },
      
      // Note: W3Schools uses an iframe, so we'd need to handle that
      // This is a simplified example - adjust selectors for your target site
      
      // Fill form fields (example selectors - adjust for your form)
      // { type: 'type', selector: 'input[name="firstname"]', text: 'John' },
      // { type: 'type', selector: 'input[name="lastname"]', text: 'Doe' },
      // { type: 'type', selector: 'input[name="email"]', text: 'john.doe@example.com' },
      // { type: 'select', selector: 'select[name="country"]', value: 'USA' },
      
      // Take screenshot after filling
      // { type: 'screenshot', name: 'form-filled' },
      
      // Submit form
      // { type: 'click', selector: 'input[type="submit"]' },
      // { type: 'wait', duration: 3000 },
      
      // Take screenshot of result
      // { type: 'screenshot', name: 'form-result' }
    ],
    analysis: {
      enabled: true,
      prompts: [
        VisionAnalyzer.COMMON_PROMPTS.ANALYZE_FORM,
        VisionAnalyzer.COMMON_PROMPTS.CHECK_ERRORS,
        'Verify that the form was submitted successfully and check for any confirmation messages'
      ]
    }
  };

  // Alternative: Use the helper method
  // await ScriptRunner.runFormFilling(
  //   'https://example.com/contact',
  //   [
  //     { selector: 'input[name="name"]', value: 'John Doe' },
  //     { selector: 'input[name="email"]', value: 'john@example.com' },
  //     { selector: 'textarea[name="message"]', value: 'This is a test message.' }
  //   ],
  //   'button[type="submit"]'
  // );

  // Run the script
  const runner = new ScriptRunner(script);
  await runner.run();
}

// Execute the example
main().catch(console.error); 