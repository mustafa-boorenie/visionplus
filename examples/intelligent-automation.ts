import { IntelligentAutomation, validateEnvironment } from '../src';

/**
 * Example of using the intelligent automation system
 * This demonstrates how the system breaks down natural language tasks
 */
async function main() {
  // Validate environment
  validateEnvironment();

  // Example tasks to demonstrate
  const examples = [
    {
      task: 'Search for "typescript tutorial" on Google and take screenshots of the first 3 results',
      url: 'https://www.google.com'
    },
    {
      task: 'Go to GitHub, search for "playwright", and capture the repository details of the first result',
      url: 'https://github.com'
    },
    {
      task: 'Navigate to Hacker News and extract the titles of the top 5 stories',
      url: 'https://news.ycombinator.com'
    }
  ];

  // Get task from command line or use first example
  const taskIndex = process.argv[2] ? parseInt(process.argv[2]) - 1 : 0;
  const selectedExample = examples[taskIndex] || examples[0];

  console.log('🎯 Selected Task:', selectedExample.task);
  console.log('🌐 Starting URL:', selectedExample.url);
  console.log('\n' + '='.repeat(60) + '\n');

  try {
    // Create intelligent automation instance
    const automation = new IntelligentAutomation(selectedExample.task);
    
    // Execute the task
    await automation.execute(selectedExample.url);

    console.log('\n✅ Example completed successfully!');
    console.log('📊 Check the reports folder for results');
    console.log('💾 Check scripts/cache for the cached automation script');

  } catch (error) {
    console.error('❌ Example failed:', error);
  }
}

// Show usage if requested
if (process.argv[2] === '--help') {
  console.log(`
Usage: npm run example:intelligent [example-number]

Examples:
  1. Google search and screenshot results
  2. GitHub repository exploration
  3. Hacker News data extraction

Example:
  npm run example:intelligent 2
  `);
  process.exit(0);
}

// Run the example
main().catch(console.error); 