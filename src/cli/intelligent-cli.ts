#!/usr/bin/env node

import { program } from 'commander';
import { IntelligentAutomation } from '../automation/IntelligentAutomation';
import { InteractiveMode } from './interactive-mode';
import { validateEnvironment } from '../index';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';

/**
 * CLI for intelligent automation
 */
program
  .name('ai-playwright')
  .description('Intelligent web automation using natural language')
  .version('1.0.0');

program
  .command('automate')
  .description('Start intelligent automation with a natural language task')
  .requiredOption('-t, --task <task>', 'The automation task to perform')
  .requiredOption('-u, --url <url>', 'The starting URL for automation')
  .option('-v, --verbose', 'Enable verbose logging', false)
  .option('-p, --persist', 'Keep browser open after automation', false)
  .option('--headless', 'Run browser in headless mode', false)
  .action(async (options) => {
    try {
      // Validate environment
      validateEnvironment();

      // Ensure required options are provided
      if (!options.task || !options.url) {
        console.error(chalk.red('Error: Both task and URL are required'));
        program.help();
        return;
      }

      // Create and run automation
      const automation = new IntelligentAutomation(
        options.task, 
        options.verbose,
        options.persist
      );
      
      await automation.execute(options.url);
      
      console.log(chalk.green('\n✨ Automation completed successfully!'));
      
      if (options.persist) {
        console.log(chalk.cyan('💡 Browser kept open. Use interactive mode to continue automation.'));
      }

    } catch (error) {
      console.error(chalk.red('\n❌ Automation failed:'), error);
      process.exit(1);
    }
  });

program
  .command('examples')
  .description('Show example automation tasks')
  .action(() => {
    console.log(chalk.cyan('\n📚 Example Automation Tasks:\n'));
    
    const examples = [
      {
        task: 'Search for laptops on Amazon and take screenshots of the results',
        url: 'https://www.amazon.com'
      },
      {
        task: 'Fill out the contact form on the website',
        url: 'https://example.com/contact'
      },
      {
        task: 'Login to the admin panel with username "demo" and password "demo"',
        url: 'https://demo.example.com/login'
      },
      {
        task: 'Navigate to GitHub trending repos and extract the top 10 projects',
        url: 'https://github.com'
      },
      {
        task: 'Check if all images on the page have alt text for accessibility',
        url: 'https://www.example.com'
      },
      {
        task: 'Add a product to cart and proceed to checkout',
        url: 'https://shop.example.com'
      }
    ];

    examples.forEach((example, i) => {
      console.log(chalk.yellow(`${i + 1}. Task: `) + example.task);
      console.log(chalk.gray(`   URL: ${example.url}\n`));
    });

    console.log(chalk.cyan('Run any example with:'));
    console.log(chalk.white('  ai-playwright automate -t "Your task here" -u "https://example.com"\n'));
  });

program
  .command('interactive')
  .alias('i')
  .description('Start interactive mode for continuous browser automation')
  .action(async () => {
    try {
      // Validate environment
      validateEnvironment();

      console.log(chalk.green('✅ Environment configuration is valid'));
      
      // Start interactive mode
      const interactive = new InteractiveMode();
      await interactive.start();
      
    } catch (error) {
      console.error(chalk.red('Failed to start interactive mode:'), error);
      process.exit(1);
    }
  });

program
  .command('cache')
  .description('Manage cached automation scripts')
  .option('-l, --list', 'List cached scripts')
  .option('-c, --clear', 'Clear all cached scripts')
  .action(async (options) => {
    const cacheDir = './scripts/cache';

    try {
      if (options.clear) {
        await fs.emptyDir(cacheDir);
        console.log(chalk.green('✅ Cache cleared'));
      } else if (options.list) {
        await fs.ensureDir(cacheDir);
        const files = await fs.readdir(cacheDir);
        
        if (files.length === 0) {
          console.log(chalk.yellow('No cached scripts found'));
        } else {
          console.log(chalk.cyan('\n📦 Cached Scripts:\n'));
          
          for (const file of files) {
            if (file.endsWith('.json')) {
              const script = await fs.readJson(path.join(cacheDir, file));
              console.log(chalk.yellow(`• ${file}`));
              console.log(chalk.gray(`  Task: ${script.description}`));
              console.log(chalk.gray(`  URL: ${script.url}`));
              console.log(chalk.gray(`  Actions: ${script.actions.length}\n`));
            }
          }
        }
      } else {
        program.help();
      }
    } catch (error) {
      console.error(chalk.red('Error managing cache:'), error);
    }
  });

program
  .command('generate-tests')
  .description('Generate Playwright tests from cached scripts')
  .option('-o, --output <dir>', 'Output directory', './tests/generated')
  .action(async (options) => {
    try {
      const { TestGenerator } = await import('../automation/TestGenerator');
      const cacheDir = './scripts/cache';
      await fs.ensureDir(cacheDir);
      
      const files = await fs.readdir(cacheDir);
      const scripts = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const script = await fs.readJson(path.join(cacheDir, file));
          scripts.push(script);
        }
      }
      
      if (scripts.length === 0) {
        console.log(chalk.yellow('No cached scripts found'));
        return;
      }
      
      console.log(chalk.cyan(`\n📝 Generating tests from ${scripts.length} cached scripts...\n`));
      
      for (const script of scripts) {
        const generator = new (TestGenerator as any)(script);
        const filename = `${script.name.replace(/\s+/g, '_')}.spec.ts`;
        const testPath = path.join(options.output, filename);
        
        await generator.generateTest(testPath);
        console.log(chalk.green(`✓ Generated: ${testPath}`));
      }
      
      console.log(chalk.cyan(`\n✨ Generated ${scripts.length} test files in ${options.output}\n`));
      
    } catch (error) {
      console.error(chalk.red('Error generating tests:'), error);
    }
  });



// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
} 