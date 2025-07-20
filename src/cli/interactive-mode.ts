import readline from 'readline';
import chalk from 'chalk';
import { IntelligentAutomation } from '../automation/IntelligentAutomation';
import { BrowserManager } from '../browser/BrowserManager';
import { log } from '../utils/logger';

/**
 * Interactive mode for continuous automation commands
 */
export class InteractiveMode {
  private rl: readline.Interface;
  private browserManager: BrowserManager;
  private isRunning: boolean = false;

  constructor() {
    this.browserManager = BrowserManager.getInstance();
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
    
    console.log(chalk.green('\n🚀 AI Playwright Interactive Mode'));
    console.log(chalk.gray('Type commands to automate the browser, or use special commands:'));
    console.log(chalk.gray('  • status    - Show browser session status'));
    console.log(chalk.gray('  • navigate <url> - Navigate to a URL'));
    console.log(chalk.gray('  • reset     - Close and reset the browser'));
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
    
    try {
      const automation = new IntelligentAutomation(command, true, true);
      
      // Use current URL or default to Google
      const status = this.browserManager.getSessionStatus();
      const startUrl = status.currentUrl || 'https://www.google.com';
      
      await automation.execute(startUrl);
      
      console.log(chalk.green('\n✅ Command completed successfully'));
    } catch (error) {
      throw error;
    }
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
    console.log(chalk.green('✅ Browser reset complete'));
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
    console.log(chalk.gray('  • help           - Show this help message'));
    console.log(chalk.gray('  • exit/quit      - Exit interactive mode'));
    console.log('');
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