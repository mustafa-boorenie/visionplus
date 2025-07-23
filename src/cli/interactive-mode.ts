import readline from 'readline';
import chalk from 'chalk';
import { IntelligentAutomation } from '../automation/IntelligentAutomation';
import { BrowserManager } from '../browser/BrowserManager';
import { SequenceManager } from '../utils/SequenceManager';
import { AutomationExecutionResult } from '../types';
import { log } from '../utils/logger';

/**
 * Interactive mode for continuous automation commands
 */
export class InteractiveMode {
  private rl: readline.Interface;
  private browserManager: BrowserManager;
  private sequenceManager: SequenceManager;
  private isRunning: boolean = false;
  private lastExecutionResult: AutomationExecutionResult | null = null;
  private lastPrompt: string | null = null;
  private sessionCommands: Array<{
    prompt: string;
    result: AutomationExecutionResult;
    timestamp: Date;
  }> = [];

  constructor() {
    this.browserManager = BrowserManager.getInstance();
    this.sequenceManager = new SequenceManager();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.cyan('\n🤖 > ')
    });
  }

  /**
   * Start the interactive session
   */
  async start(): Promise<void> {
    this.isRunning = true;
    
    // Initialize sequence manager
    await this.sequenceManager.initialize();
    
    console.log(chalk.green('\n🚀 AI Playwright Interactive Mode'));
    console.log(chalk.gray('Type commands to automate the browser, or use special commands:'));
    console.log(chalk.gray('  • status    - Show browser session status'));
    console.log(chalk.gray('  • navigate <url> - Navigate to a URL'));
    console.log(chalk.gray('  • reset     - Close and reset the browser'));
    console.log(chalk.gray('  • save <name> - Save session automation as sequence'));
    console.log(chalk.gray('  • sequences - List saved automation sequences'));
    console.log(chalk.gray('  • run <name> - Run a saved sequence'));
    console.log(chalk.gray('  • append <name> - Add last automation to existing sequence'));
    console.log(chalk.gray('  • clear     - Clear current session commands'));
    console.log(chalk.gray('  • help      - Show this help message'));
    console.log(chalk.gray('  • exit/quit - Exit interactive mode'));
    console.log('');
    
    this.rl.prompt();
    
    this.rl.on('line', async (input) => {
      const command = input.trim();
      
      if (!command) {
        this.rl.prompt();
        return;
      }
      
      try {
        await this.handleCommand(command);
      } catch (error) {
        console.error(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
      
      if (this.isRunning) {
        this.rl.prompt();
      }
    });
    
    this.rl.on('close', () => {
      this.cleanup();
    });
    
    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n\n👋 Shutting down...'));
      this.cleanup();
      process.exit(0);
    });
  }

  /**
   * Handle a command
   */
  private async handleCommand(command: string): Promise<void> {
    const [cmd, ...args] = command.split(' ');
    const lowerCmd = cmd.toLowerCase();
    
    switch (lowerCmd) {
      case 'exit':
      case 'quit':
        this.isRunning = false;
        this.cleanup();
        break;
        
      case 'status':
        this.showStatus();
        break;
        
      case 'navigate':
        if (args.length === 0) {
          console.log(chalk.yellow('Usage: navigate <url>'));
          return;
        }
        await this.navigate(args.join(' '));
        break;
        
      case 'reset':
        await this.resetBrowser();
        break;

      case 'save':
        if (args.length === 0) {
          console.log(chalk.yellow('Usage: save <sequence-name>'));
          return;
        }
        await this.saveSequence(args.join(' '));
        break;

      case 'sequences':
        await this.listSequences(args);
        break;

      case 'run':
        if (args.length === 0) {
          console.log(chalk.yellow('Usage: run <sequence-name>'));
          return;
        }
        await this.runSequence(args.join(' '));
        break;

      case 'append':
        if (args.length === 0) {
          console.log(chalk.yellow('Usage: append <sequence-name>'));
          return;
        }
        await this.appendToSequence(args.join(' '));
        break;

      case 'clear':
        this.clearSession();
        break;
        
      case 'help':
        this.showHelp();
        break;
        
      default:
        // Treat as automation command
        await this.runAutomation(command);
        break;
    }
  }

  /**
   * Run an automation command
   */
  private async runAutomation(command: string): Promise<void> {
    console.log(chalk.blue(`\n🤖 Executing: ${command}`));
    
    const startTime = Date.now();
    
    try {
      const automation = new IntelligentAutomation(command, true, true);
      
      // Use current URL or default to Google
      const status = this.browserManager.getSessionStatus();
      const startUrl = status.currentUrl || 'https://www.google.com';
      
      // Execute automation and get result
      const executionResult = await automation.execute(startUrl);
      
      // Store execution result for potential saving
      this.lastExecutionResult = executionResult;
      this.lastPrompt = command;
      
      // Add to session commands
      this.sessionCommands.push({
        prompt: command,
        result: executionResult,
        timestamp: new Date()
      });
      
      console.log(chalk.green('\n✅ Command completed successfully'));
      console.log(chalk.gray(`💡 Tip: Use 'save <name>' to save this automation as a reusable sequence`));
      console.log(chalk.gray(`📝 Session has ${this.sessionCommands.length} command(s) ready to save`));
    } catch (error) {
      // Get status for error case
      const status = this.browserManager.getSessionStatus();
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Store failed execution result
      this.lastExecutionResult = {
        success: false,
        script: {
          name: 'interactive-automation',
          description: command,
          url: status.currentUrl || 'https://www.google.com',
          actions: []
        },
        executionTime,
        screenshots: [],
        errors: [errorMessage]
      };
      this.lastPrompt = command;
      
      throw error;
    }
  }

  /**
   * Save the session automation as a sequence
   */
  private async saveSequence(name: string): Promise<void> {
    if (this.sessionCommands.length === 0) {
      console.log(chalk.yellow('❌ No automation commands to save. Run some automation commands first.'));
      return;
    }

    // Check if any commands failed
    const failedCommands = this.sessionCommands.filter(cmd => !cmd.result.success);
    if (failedCommands.length > 0) {
      console.log(chalk.yellow(`⚠️  Warning: ${failedCommands.length} command(s) failed. Only saving successful commands.`));
    }

    const successfulCommands = this.sessionCommands.filter(cmd => cmd.result.success);
    if (successfulCommands.length === 0) {
      console.log(chalk.yellow('❌ No successful automation commands to save.'));
      return;
    }

    try {
      console.log(chalk.blue(`\n💾 Saving sequence "${name}" with ${successfulCommands.length} command(s)...`));
      
      // Combine all successful commands into a single sequence
      const combinedPrompt = successfulCommands.map((cmd, index) => 
        `${index + 1}. ${cmd.prompt}`
      ).join('\n');

      // Combine all actions from successful commands
      const combinedActions = successfulCommands.flatMap(cmd => cmd.result.script.actions);
      
      // Combine all screenshots
      const combinedScreenshots = successfulCommands.flatMap(cmd => cmd.result.screenshots);
      
      // Calculate total execution time
      const totalExecutionTime = successfulCommands.reduce((sum, cmd) => sum + cmd.result.executionTime, 0);

      // Create combined execution result
      const combinedResult: AutomationExecutionResult = {
        success: true,
        script: {
          name: name,
          description: `Interactive session: ${successfulCommands.length} commands`,
          url: successfulCommands[0].result.script.url,
          actions: combinedActions
        },
        executionTime: totalExecutionTime,
        screenshots: combinedScreenshots,
        errors: [],
        stepResults: successfulCommands.flatMap((cmd, cmdIndex) => 
          cmd.result.stepResults?.map(step => ({
            ...step,
            step: `[${cmdIndex + 1}] ${step.step}`
          })) || []
        )
      };
      
      await this.sequenceManager.saveSequence(
        name,
        combinedPrompt,
        combinedResult,
        {
          description: `Interactive automation session with ${successfulCommands.length} commands`,
          category: 'interactive-session',
          tags: ['session', 'multi-command']
        }
      );

      console.log(chalk.green(`✅ Sequence "${name}" saved successfully!`));
      console.log(chalk.gray(`   Commands: ${successfulCommands.length}`));
      console.log(chalk.gray(`   Total execution time: ${totalExecutionTime}ms`));
      console.log(chalk.gray(`   Use 'run ${name}' to execute this sequence again`));
      
      // Clear session after successful save
      this.sessionCommands = [];
      console.log(chalk.gray(`🧹 Session cleared. Ready for new commands.`));
      
    } catch (error) {
      console.error(chalk.red(`❌ Failed to save sequence: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  }

  /**
   * List saved sequences
   */
  private async listSequences(_args: string[]): Promise<void> {
    try {
      console.log(chalk.blue('\n📋 Saved Automation Sequences'));
      console.log(chalk.gray('─'.repeat(50)));

      const sequences = await this.sequenceManager.listSequences();
      
      if (sequences.length === 0) {
        console.log(chalk.yellow('No saved sequences found.'));
        console.log(chalk.gray('💡 Use automation commands and then "save <name>" to create sequences.'));
        return;
      }

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
      console.log(chalk.gray('💡 Use "run <name>" to execute a sequence'));
    } catch (error) {
      console.error(chalk.red(`❌ Failed to list sequences: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  }

  /**
   * Run a saved sequence
   */
  private async runSequence(name: string): Promise<void> {
    try {
      console.log(chalk.blue(`\n🏃 Running sequence "${name}"...`));
      
      const sequence = await this.sequenceManager.loadSequence(name);
      if (!sequence) {
        console.log(chalk.yellow(`❌ Sequence "${name}" not found.`));
        console.log(chalk.gray('💡 Use "sequences" to list available sequences.'));
        return;
      }

      console.log(chalk.gray(`Original prompt: ${sequence.originalPrompt}`));
      console.log(chalk.gray(`Success rate: ${sequence.metadata.successRate || 0}%`));
      
      const startTime = Date.now();
      
      try {
        // Execute the original prompt
        await this.runAutomation(sequence.originalPrompt);
        
        const executionTime = Date.now() - startTime;
        
        // Update sequence history
        await this.sequenceManager.updateSequenceHistory(name, {
          success: true,
          executionTime,
          errors: []
        });
        
        console.log(chalk.green(`\n✅ Sequence "${name}" completed successfully!`));
      } catch (error) {
        const executionTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Update sequence history with failure
        await this.sequenceManager.updateSequenceHistory(name, {
          success: false,
          executionTime,
          errors: [errorMessage]
        });
        
        throw error;
      }
    } catch (error) {
      console.error(chalk.red(`❌ Failed to run sequence: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  }

  /**
   * Append the last successful automation to an existing sequence
   */
  private async appendToSequence(sequenceName: string): Promise<void> {
    if (!this.lastExecutionResult || !this.lastPrompt) {
      console.log(chalk.yellow('❌ No automation to append. Run an automation command first.'));
      return;
    }

    if (!this.lastExecutionResult.success) {
      console.log(chalk.yellow('❌ Last automation failed. Only successful automations can be appended.'));
      return;
    }

    try {
      console.log(chalk.blue(`\n➕ Appending "${this.lastPrompt}" to sequence "${sequenceName}"...`));
      
      const updatedSequence = await this.sequenceManager.appendToSequence(
        sequenceName,
        this.lastPrompt,
        this.lastExecutionResult
      );

      // Count commands in updated sequence
      const commandCount = updatedSequence.originalPrompt.split('\n').filter(line => line.trim()).length;

      console.log(chalk.green(`✅ Successfully appended to sequence "${sequenceName}"!`));
      console.log(chalk.gray(`   Added command: ${this.lastPrompt}`));
      console.log(chalk.gray(`   Total commands: ${commandCount}`));
      console.log(chalk.gray(`   Use 'run ${sequenceName}' to execute the updated sequence`));
      
      // Clear the last execution since it's now been saved/appended
      this.lastExecutionResult = null;
      this.lastPrompt = null;
      
    } catch (error) {
      console.error(chalk.red(`❌ Failed to append to sequence: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  }

  /**
   * Show help message
   */
  private showHelp(): void {
    console.log(chalk.cyan('\n📖 Interactive Mode Commands'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(chalk.white('Automation Commands:'));
    console.log('  Just type what you want to automate, e.g.:');
    console.log(chalk.gray('  • Search for weather'));
    console.log(chalk.gray('  • Click the first link'));
    console.log(chalk.gray('  • Fill out the contact form'));
    console.log(chalk.gray('  • Take a screenshot'));
    console.log('');
    console.log(chalk.white('Special Commands:'));
    console.log(chalk.gray('  • status         - Show browser session status'));
    console.log(chalk.gray('  • navigate <url> - Navigate to a specific URL'));
    console.log(chalk.gray('  • reset          - Close and reset the browser'));
    console.log(chalk.gray('  • save <name>    - Save current session as sequence'));
    console.log(chalk.gray('  • sequences      - List saved automation sequences'));
    console.log(chalk.gray('  • run <name>     - Run a saved sequence'));
    console.log(chalk.gray('  • append <name>  - Add last automation to existing sequence'));
    console.log(chalk.gray('  • clear          - Clear current session commands'));
    console.log(chalk.gray('  • help           - Show this help message'));
    console.log(chalk.gray('  • exit/quit      - Exit interactive mode'));
    console.log('');
    console.log(chalk.white('Session Management:'));
    console.log(chalk.gray('  • Commands are tracked per session'));
    console.log(chalk.gray('  • Use "save" to bundle all session commands'));
    console.log(chalk.gray('  • Use "append" to add last command to existing sequence'));
    console.log(chalk.gray('  • Use "clear" to start a fresh session'));
    console.log('');
  }

  /**
   * Show browser session status
   */
  private showStatus(): void {
    const status = this.browserManager.getSessionStatus();
    
    console.log(chalk.cyan('\n📊 Browser Session Status'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(`Active: ${status.isActive ? chalk.green('Yes') : chalk.red('No')}`);
    
    if (status.isActive) {
      console.log(`Duration: ${chalk.yellow(status.sessionDuration || 'N/A')}`);
      console.log(`Commands Run: ${chalk.yellow(status.commandCount)}`);
      console.log(`Current URL: ${chalk.blue(status.currentUrl || 'N/A')}`);
    }

    // Show session commands status
    console.log('');
    console.log(chalk.cyan('Current Session:'));
    console.log(`Commands in session: ${chalk.yellow(this.sessionCommands.length)}`);
    
    if (this.sessionCommands.length > 0) {
      const successfulCount = this.sessionCommands.filter(cmd => cmd.result.success).length;
      const failedCount = this.sessionCommands.length - successfulCount;
      
      console.log(`Successful: ${chalk.green(successfulCount)}`);
      if (failedCount > 0) {
        console.log(`Failed: ${chalk.red(failedCount)}`);
      }
      
      console.log(chalk.gray('Recent commands:'));
      this.sessionCommands.slice(-3).forEach((cmd, index) => {
        const status = cmd.result.success ? chalk.green('✓') : chalk.red('✗');
        const cmdIndex = this.sessionCommands.length - 3 + index + 1;
        console.log(chalk.gray(`  ${cmdIndex}. ${status} ${cmd.prompt}`));
      });
      
      if (this.sessionCommands.length > 3) {
        console.log(chalk.gray(`  ... and ${this.sessionCommands.length - 3} more`));
      }
      
      console.log(chalk.gray(`💡 Use "save <name>" to save all ${successfulCount} successful command(s)`));
    } else {
      console.log(chalk.gray('No commands in current session'));
    }

    // Show last automation status if available
    if (this.lastExecutionResult && this.lastPrompt) {
      console.log('');
      console.log(chalk.cyan('Last Command:'));
      console.log(`Command: ${chalk.white(this.lastPrompt)}`);
      console.log(`Status: ${this.lastExecutionResult.success ? chalk.green('Success') : chalk.red('Failed')}`);
      console.log(`Duration: ${chalk.yellow(this.lastExecutionResult.executionTime + 'ms')}`);
      
      if (this.lastExecutionResult.success) {
        console.log(chalk.gray('💡 Use "save <name>" to save session or "append <name>" to add to existing sequence'));
      }
    }
    console.log('');
  }

  /**
   * Navigate to a URL
   */
  private async navigate(url: string): Promise<void> {
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    console.log(chalk.blue(`\n🌐 Navigating to ${url}...`));
    
    try {
      await this.browserManager.navigate(url);
      console.log(chalk.green('✅ Navigation complete'));
    } catch (error) {
      if (error instanceof Error && error.message.includes('No active browser session')) {
        console.log(chalk.yellow('⚠️  No active browser session. Starting one...'));
        await this.browserManager.getBrowser();
        await this.browserManager.navigate(url);
        console.log(chalk.green('✅ Navigation complete'));
      } else {
        throw error;
      }
    }
  }

  /**
   * Reset the browser
   */
  private async resetBrowser(): Promise<void> {
    console.log(chalk.blue('\n🔄 Resetting browser...'));
    await this.browserManager.resetBrowser();
    // Clear session when resetting browser
    this.clearSession();
    console.log(chalk.green('✅ Browser reset complete'));
  }

  /**
   * Clear current session commands
   */
  private clearSession(): void {
    const commandCount = this.sessionCommands.length;
    this.sessionCommands = [];
    console.log(chalk.green(`🧹 Session cleared. Removed ${commandCount} command(s).`));
  }

  /**
   * Clean up resources
   */
  private async cleanup(): Promise<void> {
    console.log(chalk.yellow('\n👋 Closing browser and exiting...'));
    
    try {
      await this.browserManager.closeBrowser();
    } catch (error) {
      log.error('Error closing browser', error as Error);
    }
    
    this.rl.close();
    console.log(chalk.green('✨ Goodbye!'));
  }
} 