import { IntelligentAutomation, validateEnvironment, TestGenerator, ProgressTracker } from '../src';
import fs from 'fs-extra';
import path from 'path';

/**
 * Advanced example demonstrating all intelligent automation features
 * - Progress tracking
 * - Error recovery
 * - Test generation
 * - Script caching
 */
async function main() {
  // Validate environment
  validateEnvironment();

  // Example tasks that demonstrate different features
  const advancedExamples = [
    {
      name: 'E-commerce Purchase Flow',
      task: 'Go to Amazon, search for "wireless mouse", filter by 4+ stars and Prime eligible, then add the first result to cart',
      url: 'https://www.amazon.com',
      expectedChallenges: ['Dynamic selectors', 'Loading delays', 'Pop-ups']
    },
    {
      name: 'Social Media Monitoring',
      task: 'Navigate to Twitter, search for "#typescript", capture the top 5 most recent tweets with their engagement metrics',
      url: 'https://twitter.com',
      expectedChallenges: ['Infinite scroll', 'Dynamic content', 'Rate limiting']
    },
    {
      name: 'Form Submission with Validation',
      task: 'Go to a demo form site, fill out a complex form with validation, handle error messages, and submit successfully',
      url: 'https://demoqa.com/automation-practice-form',
      expectedChallenges: ['Form validation', 'File uploads', 'Date pickers']
    }
  ];

  // Get task from command line or use first example
  const taskIndex = process.argv[2] ? parseInt(process.argv[2]) - 1 : 0;
  const selectedExample = advancedExamples[taskIndex] || advancedExamples[0];

  console.log('🎯 Advanced Automation Example');
  console.log('📋 Task:', selectedExample.task);
  console.log('🌐 URL:', selectedExample.url);
  console.log('⚠️  Expected Challenges:', selectedExample.expectedChallenges.join(', '));
  console.log('\n' + '='.repeat(60) + '\n');

  try {
    // Create intelligent automation with verbose mode for detailed progress
    const automation = new IntelligentAutomation(selectedExample.task, true);
    
    // Subscribe to progress events for custom handling
    const progressTracker = new ProgressTracker(true);
    progressTracker.on('progress', (event) => {
      // Custom progress handling - could send to a dashboard, etc.
      if (event.type === 'step_failed') {
        console.log(`\n💡 Tip: ${getRecoveryTip(event.description)}\n`);
      }
    });

    // Execute the automation
    await automation.execute(selectedExample.url);

    // Demonstrate test generation
    console.log('\n📝 Generating Playwright test from successful automation...');
    
    // Find the most recent cached script
    const cacheDir = './scripts/cache';
    const files = await fs.readdir(cacheDir);
    const recentFile = files
      .filter(f => f.endsWith('.json'))
      .sort((a, b) => b.localeCompare(a))[0];
    
    if (recentFile) {
      const script = await fs.readJson(path.join(cacheDir, recentFile));
      const generator = new TestGenerator(script);
      
      // Generate test code
      const testCode = await generator.generateTest();
      
      // Save to examples directory
      const testPath = path.join('./examples/generated-tests', `${selectedExample.name.replace(/\s+/g, '_')}.spec.ts`);
      await fs.ensureDir(path.dirname(testPath));
      await fs.writeFile(testPath, testCode);
      
      console.log(`✅ Test generated: ${testPath}`);
      console.log('\nGenerated test preview:');
      console.log('─'.repeat(60));
      console.log(testCode.split('\n').slice(0, 20).join('\n') + '\n...');
      console.log('─'.repeat(60));
    }

    // Show cache statistics
    const cacheStats = await getCacheStatistics();
    console.log('\n📊 Cache Statistics:');
    console.log(`  Total cached scripts: ${cacheStats.total}`);
    console.log(`  Total size: ${cacheStats.sizeKB}KB`);
    console.log(`  Success rate: ${cacheStats.successRate}%`);

  } catch (error) {
    console.error('❌ Example failed:', error);
    
    // Demonstrate error recovery tips
    console.log('\n💡 Error Recovery Tips:');
    console.log('1. Check if the website has changed its structure');
    console.log('2. Try running with -v flag for verbose output');
    console.log('3. Clear cache if scripts are outdated: npm run ai -- cache --clear');
    console.log('4. Check logs directory for detailed error information');
  }
}

/**
 * Get recovery tip based on action description
 */
function getRecoveryTip(description: string): string {
  if (description.includes('click')) {
    return 'Click failed - the element might be hidden or not yet loaded. The system will try waiting longer.';
  }
  if (description.includes('type')) {
    return 'Type failed - the input field might be disabled or have changed. Checking for alternative selectors.';
  }
  if (description.includes('navigate')) {
    return 'Navigation failed - checking network connectivity and URL validity.';
  }
  return 'The system is analyzing the page to find an alternative approach.';
}

/**
 * Get cache statistics
 */
async function getCacheStatistics(): Promise<{
  total: number;
  sizeKB: number;
  successRate: number;
}> {
  const cacheDir = './scripts/cache';
  await fs.ensureDir(cacheDir);
  
  const files = await fs.readdir(cacheDir);
  let totalSize = 0;
  let successCount = 0;
  
  for (const file of files) {
    if (file.endsWith('.json')) {
      const filePath = path.join(cacheDir, file);
      const stats = await fs.stat(filePath);
      totalSize += stats.size;
      
      const script = await fs.readJson(filePath);
      if (script.actions && script.actions.length > 0) {
        successCount++;
      }
    }
  }
  
  return {
    total: files.filter(f => f.endsWith('.json')).length,
    sizeKB: Math.round(totalSize / 1024),
    successRate: files.length > 0 ? Math.round((successCount / files.length) * 100) : 0
  };
}

// Show usage if requested
if (process.argv[2] === '--help') {
  console.log(`
Usage: npm run example:advanced [example-number]

Advanced Examples:
  1. E-commerce Purchase Flow - Complex multi-step automation
  2. Social Media Monitoring - Handle dynamic content
  3. Form Submission - Deal with validation and errors

Features Demonstrated:
  - Real-time progress tracking with visual feedback
  - Intelligent error recovery using Vision API
  - Automatic test generation from successful runs
  - Script caching and reuse
  - Detailed logging and reporting

Example:
  npm run example:advanced 1
  `);
  process.exit(0);
}

// Run the example
main().catch(console.error); 