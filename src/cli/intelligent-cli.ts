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

program
  .command('sequences')
  .description('Manage automation sequences')
  .option('-l, --list', 'List all saved sequences')
  .option('-s, --stats', 'Show sequence statistics')
  .option('-r, --run <name>', 'Run a specific sequence')
  .option('-d, --delete <name>', 'Delete a sequence')
  .option('-a, --append <name>', 'Append last automation to existing sequence')
  .option('--export <path>', 'Export sequences to a file')
  .option('--import <path>', 'Import sequences from a file')
  .option('--overwrite', 'Overwrite existing sequences when importing')
  .action(async (options) => {
    try {
      const { SequenceManager } = await import('../utils/SequenceManager');
      const sequenceManager = new SequenceManager();
      await sequenceManager.initialize();

      if (options.list) {
        const sequences = await sequenceManager.listSequences();
        
        if (sequences.length === 0) {
          console.log(chalk.yellow('\n📋 No sequences found'));
          console.log(chalk.gray('💡 Use interactive mode and "save <name>" to create sequences\n'));
          return;
        }

        console.log(chalk.cyan('\n📋 Saved Automation Sequences\n'));
        
        sequences.forEach((sequence, index) => {
          const { metadata } = sequence;
          console.log(chalk.cyan(`${index + 1}. ${metadata.name}`));
          console.log(chalk.gray(`   Prompt: ${sequence.originalPrompt}`));
          console.log(chalk.gray(`   Created: ${metadata.createdAt.toLocaleDateString()}`));
          console.log(chalk.gray(`   Used: ${metadata.usageCount} times`));
          console.log(chalk.gray(`   Success rate: ${metadata.successRate || 0}%`));
          if (metadata.tags && metadata.tags.length > 0) {
            console.log(chalk.gray(`   Tags: ${metadata.tags.join(', ')}`));
          }
          console.log('');
        });

        console.log(chalk.gray(`Total: ${sequences.length} sequences`));
        console.log(chalk.gray('Use "npm run ai -- sequences --run <name>" to execute a sequence\n'));

      } else if (options.stats) {
        const stats = await sequenceManager.getStatistics();
        
        console.log(chalk.cyan('\n📊 Sequence Statistics\n'));
        console.log(`Total Sequences: ${chalk.yellow(stats.totalSequences)}`);
        console.log(`Total Executions: ${chalk.yellow(stats.totalExecutions)}`);
        console.log(`Average Success Rate: ${chalk.yellow(stats.averageSuccessRate + '%')}`);
        
        if (stats.mostUsedSequence) {
          console.log(`Most Used: ${chalk.yellow(stats.mostUsedSequence)}`);
        }
        
        if (stats.categories.length > 0) {
          console.log(`Categories: ${chalk.yellow(stats.categories.join(', '))}`);
        }
        console.log('');

      } else if (options.run) {
        const sequenceName = options.run;
        console.log(chalk.blue(`\n🏃 Running sequence "${sequenceName}"...\n`));
        
        const sequence = await sequenceManager.loadSequence(sequenceName);
        if (!sequence) {
          console.log(chalk.red(`❌ Sequence "${sequenceName}" not found`));
          console.log(chalk.gray('Use --list to see available sequences\n'));
          return;
        }

        console.log(chalk.gray(`Original prompt: ${sequence.originalPrompt}`));
        console.log(chalk.gray(`Success rate: ${sequence.metadata.successRate || 0}%\n`));

        // Import and run the automation
        const { IntelligentAutomation } = await import('../automation/IntelligentAutomation');
        const automation = new IntelligentAutomation(sequence.originalPrompt, true);
        
        const startTime = Date.now();
        
        try {
          const executionResult = await automation.execute(sequence.script.url);
          
          // Update sequence history
          await sequenceManager.updateSequenceHistory(sequenceName, {
            success: executionResult.success,
            executionTime: executionResult.executionTime,
            errors: executionResult.errors || []
          });
          
          console.log(chalk.green(`\n✅ Sequence "${sequenceName}" completed successfully!`));
          
        } catch (error) {
          const executionTime = Date.now() - startTime;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          // Update sequence history with failure
          await sequenceManager.updateSequenceHistory(sequenceName, {
            success: false,
            executionTime,
            errors: [errorMessage]
          });
          
          console.error(chalk.red(`❌ Sequence failed: ${errorMessage}`));
        }

      } else if (options.delete) {
        const sequenceName = options.delete;
        console.log(chalk.blue(`\n🗑️  Deleting sequence "${sequenceName}"...`));
        
        const deleted = await sequenceManager.deleteSequence(sequenceName);
        if (deleted) {
          console.log(chalk.green(`✅ Sequence "${sequenceName}" deleted successfully`));
        } else {
          console.log(chalk.yellow(`❌ Sequence "${sequenceName}" not found`));
        }

      } else if (options.append) {
        console.log(chalk.yellow('\n⚠️  CLI append is not supported yet'));
        console.log(chalk.gray('💡 Use interactive mode to append automations:'));
        console.log(chalk.gray('   1. npm run ai interactive'));
        console.log(chalk.gray('   2. Run your automation command'));
        console.log(chalk.gray(`   3. append ${options.append}`));
        console.log('');

      } else if (options.export) {
        const exportPath = options.export;
        console.log(chalk.blue(`\n📤 Exporting sequences to ${exportPath}...`));
        
        await sequenceManager.exportSequences(exportPath);
        console.log(chalk.green(`✅ Sequences exported successfully`));

      } else if (options.import) {
        const importPath = options.import;
        console.log(chalk.blue(`\n📥 Importing sequences from ${importPath}...`));
        
        const importedCount = await sequenceManager.importSequences(importPath, options.overwrite);
        console.log(chalk.green(`✅ Imported ${importedCount} sequences`));

      } else {
        console.log(chalk.yellow('\n⚠️  Please specify an action:'));
        console.log(chalk.gray('  --list              List all sequences'));
        console.log(chalk.gray('  --stats             Show statistics'));
        console.log(chalk.gray('  --run <name>        Run a sequence'));
        console.log(chalk.gray('  --delete <name>     Delete a sequence'));
        console.log(chalk.gray('  --append <name>     Append to sequence (use interactive mode)'));
        console.log(chalk.gray('  --export <path>     Export sequences'));
        console.log(chalk.gray('  --import <path>     Import sequences'));
        console.log(chalk.gray('\nExample: npm run ai -- sequences --list\n'));
      }

    } catch (error) {
      console.error(chalk.red('\n❌ Error managing sequences:'), error);
    }
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
} 