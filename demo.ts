#!/usr/bin/env tsx

/**
 * AI Playwright Scripter Demo
 * Run this script to see intelligent automation in action!
 * 
 * Usage: npx tsx demo.ts
 */

import { IntelligentAutomation, validateEnvironment } from './src';
import chalk from 'chalk';

async function runDemo() {
  console.log(chalk.cyan('\n' + '='.repeat(60)));
  console.log(chalk.cyan.bold('🤖 AI Playwright Scripter - Live Demo'));
  console.log(chalk.cyan('='.repeat(60) + '\n'));

  // Demo tasks to showcase different capabilities
  const demoTasks = [
    {
      name: 'Google Search Demo',
      task: 'Go to Google and search for "Playwright automation"',
      url: 'https://www.google.com',
      description: 'Simple search demonstration'
    },
    {
      name: 'Wikipedia Demo',
      task: 'Go to Wikipedia and search for "Artificial Intelligence", then take a screenshot of the main article',
      url: 'https://www.wikipedia.org',
      description: 'Multi-step navigation with screenshot'
    },
    {
      name: 'GitHub Demo',
      task: 'Navigate to GitHub, search for "typescript", and capture the first repository details',
      url: 'https://github.com',
      description: 'Complex navigation with data extraction'
    }
  ];

  // Check environment
  try {
    validateEnvironment();
  } catch (error) {
    console.error(chalk.red('\n❌ Environment not configured properly!'));
    console.log(chalk.yellow('\nPlease follow these steps:'));
    console.log(chalk.white('1. Copy env.example to .env'));
    console.log(chalk.white('2. Add your OpenAI API key to .env'));
    console.log(chalk.white('3. Run the demo again\n'));
    process.exit(1);
  }

  // Select demo task
  const selectedDemo = demoTasks[0]; // Use first demo by default
  
  console.log(chalk.yellow('📋 Demo Task:'), selectedDemo.task);
  console.log(chalk.gray('📝 Description:'), selectedDemo.description);
  console.log(chalk.gray('🌐 Starting URL:'), selectedDemo.url);
  console.log(chalk.gray('\n' + '-'.repeat(60) + '\n'));

  console.log(chalk.green('🚀 Starting intelligent automation...\n'));
  console.log(chalk.gray('Watch as the AI:'));
  console.log(chalk.gray('  1. Breaks down your task into steps'));
  console.log(chalk.gray('  2. Executes each step with error recovery'));
  console.log(chalk.gray('  3. Generates a reusable test script\n'));

  try {
    // Create and run the automation
    const automation = new IntelligentAutomation(selectedDemo.task, true);
    await automation.execute(selectedDemo.url);

    // Success message
    console.log(chalk.green('\n✨ Demo completed successfully!\n'));
    console.log(chalk.cyan('📊 Check these locations for results:'));
    console.log(chalk.white('  • Screenshots: ./screenshots/'));
    console.log(chalk.white('  • Reports: ./reports/'));
    console.log(chalk.white('  • Generated tests: ./tests/generated/'));
    console.log(chalk.white('  • Cached scripts: ./scripts/cache/\n'));

    console.log(chalk.yellow('🎯 Try your own task:'));
    console.log(chalk.white('  npm run ai\n'));

  } catch (error) {
    console.error(chalk.red('\n❌ Demo failed:'), error);
    console.log(chalk.yellow('\n💡 Troubleshooting tips:'));
    console.log(chalk.white('  • Check your internet connection'));
    console.log(chalk.white('  • Verify your OpenAI API key is valid'));
    console.log(chalk.white('  • Try running with verbose mode: npm run ai -- automate -v'));
    console.log(chalk.white('  • Check logs in ./logs/ for details\n'));
  }

  console.log(chalk.cyan('='.repeat(60) + '\n'));
}

// ASCII Art Banner
function showBanner() {
  console.log(chalk.cyan(`
     _    ___   ____  _                        _       _     _   
    / \\  |_ _| |  _ \\| | __ _ _   ___      _| |_ __ (_) __| |_ 
   / _ \\  | |  | |_) | |/ _\` | | | \\ \\ /\\ / / '__| | |/ _\` | __|
  / ___ \\ | |  |  __/| | (_| | |_| |\\ V  V /| |  | | | (_| | |_ 
 /_/   \\_\\___| |_|   |_|\\__,_|\\__, | \\_/\\_/ |_|  |_| |\\__,_|\\__|
                               |___/                 |_|          
  `));
  console.log(chalk.gray('Intelligent Browser Automation with Natural Language\n'));
}

// Run the demo
showBanner();
runDemo().catch(console.error); 