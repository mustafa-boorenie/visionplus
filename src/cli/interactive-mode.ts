import readline from 'readline';
import chalk from 'chalk';
import { IntelligentAutomation } from '../automation/IntelligentAutomation';
import { BrowserManager } from '../browser/BrowserManager';
import { SequenceManager } from '../utils/SequenceManager';
import { AutomationExecutionResult } from '../types';
import { log } from '../utils/logger';
import fs from 'fs-extra'; // Added for file deletion

/**
 * Session context for interactive mode
 */
interface SessionContext {
  startUrl?: string;
  credentials?: {
    username?: string;
    password?: string;
    [key: string]: string | undefined;
  };
  arguments?: {
    [key: string]: string;
  };
}

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
  private sessionContext: SessionContext = {};
  private isInRecoveryMode: boolean = false;
  private recoveryInterrupted: boolean = false;

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
    
    // Collect setup information
    await this.collectSetupInfo();
    
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
      console.log(chalk.gray('\n[DEBUG] Readline closed'));
      if (this.isRunning) {
        console.log(chalk.yellow('⚠️  Readline interface closed unexpectedly. Restarting...'));
        // Prevent the process from exiting
        setTimeout(() => {
          this.cleanup();
        }, 100);
      } else {
        this.cleanup();
      }
    });
    
    // Prevent readline from closing on certain inputs
    this.rl.on('SIGTSTP', () => {
      // Ignore Ctrl+Z
      console.log(chalk.gray('\n[DEBUG] SIGTSTP received, ignoring...'));
    });
    
    this.rl.on('SIGCONT', () => {
      // Handle continue signal
      console.log(chalk.gray('\n[DEBUG] SIGCONT received'));
      this.rl.prompt();
    });
    
    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n\n👋 Shutting down...'));
      this.cleanup();
      process.exit(0);
    });
  }

  /**
   * Handle user commands
   */
  private async handleCommand(command: string): Promise<void> {
    // Check if we're in recovery mode and user wants to interrupt
    if (this.isInRecoveryMode && (command.toLowerCase() === 'y' || command.toLowerCase() === 'yes')) {
      console.log(chalk.green('\n✅ User confirmed task completion - stopping recovery attempts'));
      this.recoveryInterrupted = true;
      return;
    }
    
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
        
      case 'debug':
        await this.debugPageState();
        break;
        
      case 'help':
        this.showHelp();
        break;
        
      case 'autonomous':
      case 'autonomous ':
        await this.handleAutonomousMode(command);
        break;
        
      default:
        // Treat as automation command
        await this.runAutomation(command);
        break;
    }
  }

  /**
   * Handle autonomous mode command
   */
  private async handleAutonomousMode(command: string): Promise<void> {
    const parts = command.split(' ');
    const task = parts.slice(1).join(' ');
    
    if (!task) {
      console.log(chalk.yellow('⚠️  Please provide a task for autonomous mode'));
      console.log(chalk.gray('Example: autonomous click the login button'));
      return;
    }
    
    console.log(chalk.cyan('\n🤖 Starting Autonomous Mode...'));
    console.log(chalk.yellow('⚠️  The automation will continuously adapt to page changes'));
    console.log(chalk.yellow('⚠️  Press Ctrl+C to stop at any time'));
    
    try {
      // Get or create browser
      let browser = this.browserManager.getCurrentBrowser();
      if (!browser) {
        browser = await this.browserManager.getBrowser();
        if (!browser) {
          console.log(chalk.red('❌ Failed to create browser session'));
          return;
        }
      }
      
      // Task is captured in the 'task' variable, no need for taskStep object
      
      // Create an autonomous recovery loop
      let iteration = 0;
      const maxIterations = 100; // Safety limit
      
      while (iteration < maxIterations) {
        console.log(chalk.blue(`\n🔄 Autonomous Iteration ${iteration + 1}...`));
        
        try {
          // Capture current state
          const screenshotPath = await browser.takeScreenshot(`autonomous_${iteration}`, { fullPage: true });
          const pageHTML = await browser.getPageHTML();
          const pageUrl = await browser.getCurrentUrl();
          
          console.log(chalk.gray(`📸 Screenshot: ${screenshotPath}`));
          console.log(chalk.gray(`🌐 URL: ${pageUrl}`));
          
          // Send to OpenAI for analysis
          const { OpenAIToolsClient } = await import('../utils/OpenAIToolsClient');
          const OpenAI = (await import('openai')).default;
          const { Config } = await import('../utils/config');
          const openai = new OpenAI({ apiKey: Config.OPENAI_API_KEY });
          
          // Read screenshot
          const fs = await import('fs/promises');
          const screenshotBuffer = await fs.readFile(screenshotPath);
          const screenshotBase64 = screenshotBuffer.toString('base64');
          
          const prompt = `You are an autonomous browser automation agent. Analyze the current page and generate JavaScript code.

Task: ${task}
Current URL: ${pageUrl}
Iteration: ${iteration + 1}

Page HTML (first 5000 chars):
${pageHTML.slice(0, 5000)}

Generate JavaScript code to:
1. First check if the task is already completed
2. If not, attempt to complete the task
3. Handle any modals/popups
4. Return { success: true } if task completed, { success: false, reason: "..." } otherwise

Return ONLY a javascript code block.`;

          const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: prompt },
                  {
                    type: 'image_url',
                    image_url: { url: `data:image/png;base64,${screenshotBase64}` }
                  }
                ]
              }
            ],
            max_tokens: 1000,
            temperature: 0.3
          });
          
          const codeBlocks = OpenAIToolsClient.extractJavaScriptCode(response.choices[0].message.content || '');
          
          if (codeBlocks.length > 0) {
            console.log(chalk.cyan('🔧 Executing generated code...'));
            
            // Execute the code
            const code = codeBlocks[0];
            const executorFunction = new Function(`
              return (async () => { 
                try {
                  ${code.replace(/`/g, '\\`')}
                } catch (error) {
                  return { success: false, error: error.message };
                }
              })();
            `);
            
            const result = await browser.evaluate(executorFunction as () => any);
            console.log(chalk.gray(`📊 Result: ${JSON.stringify(result)}`));
            
            if (result && result.success) {
              console.log(chalk.green('\n✅ Task completed successfully!'));
              break;
            }
          }
          
          // Wait before next iteration
          await new Promise(resolve => setTimeout(resolve, 2000));
          iteration++;
          
        } catch (error) {
          console.log(chalk.red(`❌ Error in iteration ${iteration + 1}:`), error);
          await new Promise(resolve => setTimeout(resolve, 2000));
          iteration++;
        }
      }
      
      if (iteration >= maxIterations) {
        console.log(chalk.yellow('\n⚠️  Reached maximum iterations limit'));
      }
      
    } catch (error) {
      console.log(chalk.red('❌ Autonomous mode error:'), error);
    }
  }

  /**
   * Send failure feedback to OpenAI with screenshot and create recursive recovery loop
   */
  private async sendFailureFeedbackToOpenAI(
    command: string, 
    result: AutomationExecutionResult,
    iteration: number = 1,
    maxIterations: number = 10
  ): Promise<boolean> {
    try {
      // Set recovery mode flag
      this.isInRecoveryMode = true;
      this.recoveryInterrupted = false;
      
      console.log(chalk.yellow(`\n🔍 Analyzing failure (Iteration ${iteration}/${maxIterations})...`));
      console.log(chalk.cyan('💡 Press "y" at any time if the task was actually completed successfully'));
      
      // Check if user interrupted
      if (this.recoveryInterrupted) {
        this.isInRecoveryMode = false;
        return true;
      }
      
      // Get browser instance
      const browser = this.browserManager.getCurrentBrowser();
      if (!browser) {
        console.log(chalk.red('❌ No active browser session to analyze'));
        return false;
      }

      // Take a screenshot of current state
      const screenshotPath = await browser.takeScreenshot(`failure-analysis-${iteration}`, { fullPage: true });
      console.log(chalk.gray(`📸 Screenshot captured: ${screenshotPath}`));

      // Get current page state
      const pageUrl = await browser.getCurrentUrl();
      const pageHTML = await browser.getPageHTML();
      
      // Prepare failure context
      const failureContext = {
        userCommand: command,
        lastAction: result.stepResults?.[result.stepResults.length - 1] || null,
        pageUrl,
        executionTime: result.executionTime,
        errors: result.errors,
        stepResults: result.stepResults,
        iteration,
        previousIterations: iteration - 1
      };

      // Read screenshot as base64
      const fs = await import('fs/promises');
      const screenshotBuffer = await fs.readFile(screenshotPath);
      const screenshotBase64 = screenshotBuffer.toString('base64');

      // Create OpenAI client
      const OpenAI = (await import('openai')).default;
      const { Config } = await import('../utils/config');
      const openai = new OpenAI({
        apiKey: Config.OPENAI_API_KEY
      });

      // Send to OpenAI for analysis
      console.log(chalk.cyan('🤖 Getting AI analysis and recovery code...'));
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an AI assistant helping debug and fix failed browser automation. 
              
              IMPORTANT: Generate executable JavaScript code to fix the issue and complete the task.
              The code MUST:
              1. Be wrapped in a javascript code block
              2. Include explicit return statements
              3. Return an object with { success: true/false, message: "description" }
              4. Handle errors with try-catch blocks
              5. Use console.log to show progress
              
              Example format:
              \`\`\`javascript
              // Check for modals first
              const modals = document.querySelectorAll('[role="dialog"], .modal, .popup');
              modals.forEach(m => {
                const closeBtn = m.querySelector('.close, [aria-label="close"]');
                if (closeBtn) closeBtn.click();
              });
              
              // Complete the task
              try {
                const element = document.querySelector('selector');
                if (!element) {
                  return { success: false, message: 'Element not found' };
                }
                element.click();
                return { success: true, message: 'Successfully clicked element' };
              } catch (error) {
                return { success: false, message: error.toString() };
              }
              \`\`\`
              
              Return your analysis AND executable JavaScript code.`
            },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `The user tried to: "${command}"
                
                Iteration: ${iteration}/${maxIterations}
                
                Failure Context:
                ${JSON.stringify(failureContext, null, 2)}
                
                Page HTML (first 5000 chars):
                ${pageHTML.slice(0, 5000)}
                
                Analyze the issue and provide:
                1. What went wrong
                2. What's currently on the page
                3. JavaScript code to fix the issue and complete the task
                
                The JavaScript code should:
                - Handle any modals/popups first
                - Complete the original task
                - Return { success: true } if successful
                - Return { success: false, reason: "..." } if it fails`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${screenshotBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 1500,
        temperature: 0.3
      });

      const analysis = response.choices[0].message.content || 'No analysis available';
      
      // Display analysis (show more lines)
      console.log(chalk.yellow('\n📊 AI Analysis:'));
      const analysisLines = analysis.split('\n').slice(0, 20); // Show first 20 lines
      console.log(chalk.white(analysisLines.join('\n')));
      if (analysis.split('\n').length > 20) {
        console.log(chalk.gray('... (showing first 20 lines)'));
      }
      
      // Extract and execute JavaScript code
      const { OpenAIToolsClient } = await import('../utils/OpenAIToolsClient');
      const codeBlocks = OpenAIToolsClient.extractJavaScriptCode(analysis);
      
      console.log(chalk.gray(`\n📝 Found ${codeBlocks.length} code block(s) in AI response`));
      
      // Track if any code execution succeeded
      let executionSuccess = false;
      
      if (codeBlocks.length > 0) {
        console.log(chalk.cyan('\n🔧 Executing recovery code...'));
        console.log(chalk.gray(`Code length: ${codeBlocks[0].length} characters`));
        
        for (const code of codeBlocks) {
          // Check for interruption before each code execution
          if (this.recoveryInterrupted) {
            this.isInRecoveryMode = false;
            console.log(chalk.green('\n✅ Recovery stopped - user confirmed task completion'));
            return true;
          }
          
          try {
            // First, always try pressing Escape key
            console.log(chalk.gray('Pressing Escape key...'));
            await browser.executeAction({ type: 'press', key: 'Escape' });
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Execute the recovery code
            const executorFunction = new Function(`
              return (async () => { 
                try {
                  ${code.replace(/`/g, '\\`')}
                  
                  // If code doesn't explicitly return, return success
                  return { success: true, message: 'Code executed without errors' };
                } catch (error) {
                  console.error('Recovery code error:', error);
                  return { success: false, error: error.message || error.toString() };
                }
              })();
            `);
            
            console.log(chalk.gray('Executing code snippet...'));
            
            // Show first few lines of code being executed
            const codePreview = code.split('\n').slice(0, 5).join('\n');
            console.log(chalk.gray('Code preview:'));
            console.log(chalk.gray(codePreview));
            if (code.split('\n').length > 5) {
              console.log(chalk.gray('... (more code)'));
            }
            
            try {
              const result = await browser.evaluate(executorFunction as () => any);
              console.log(chalk.gray(`📊 Execution result: ${JSON.stringify(result)}`));
              
              // If result is undefined, something went wrong
              if (result === undefined) {
                console.log(chalk.yellow('⚠️  Code executed but returned undefined'));
                // Try a simpler execution approach
                const simpleResult = await browser.evaluate(() => {
                  return { success: false, error: 'Code returned undefined' };
                });
                console.log(chalk.gray(`📊 Simple result: ${JSON.stringify(simpleResult)}`));
              } else if (result && result.success) {
                executionSuccess = true;
                console.log(chalk.green('✅ Recovery code executed successfully!'));
                
                // Re-run the original command
                console.log(chalk.cyan('\n🔄 Retrying original command...'));
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                const retryResult = await this.runAutomation(command, false); // false = don't ask for confirmation
                
                if (retryResult.success) {
                  console.log(chalk.green('\n✅ Task completed successfully after recovery!'));
                  return true;
                }
              } else {
                console.log(chalk.yellow('⚠️  Code execution returned:', JSON.stringify(result)));
              }
            } catch (execError) {
              console.log(chalk.red('❌ Failed to execute recovery code:'), execError);
            }
          } catch (execError) {
            console.log(chalk.red('❌ Failed to execute recovery code:'), execError);
          }
        }
        
        // Check if any execution succeeded
        if (!executionSuccess) {
          console.log(chalk.yellow('⚠️  No recovery code succeeded'));
        }
      } else {
        // No code found, try to get executable code
        console.log(chalk.yellow('\n🔄 No code blocks found in initial response'));
        console.log(chalk.yellow('🔄 Requesting specific recovery code...'));
        
        const codePrompt = OpenAIToolsClient.generateExecutableCodePrompt(failureContext, analysis);
        
        const codeResponse = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are a browser automation expert. Provide ONLY executable JavaScript code to fix automation issues.'
            },
            {
              role: 'user',
              content: codePrompt
            }
          ],
          max_tokens: 1000,
          temperature: 0.2
        });
        
        const newCodeBlocks = OpenAIToolsClient.extractJavaScriptCode(codeResponse.choices[0].message.content || '');
        
        if (newCodeBlocks.length > 0) {
          console.log(chalk.cyan('\n🔧 Executing recovery code...'));
          
          for (const code of newCodeBlocks) {
            try {
              await browser.executeAction({ type: 'press', key: 'Escape' });
              await new Promise(resolve => setTimeout(resolve, 300));
              
              const executorFunction = new Function(`
                return (async () => { 
                  try {
                    ${code.replace(/`/g, '\\`')}
                  } catch (error) {
                    return { success: false, error: error.message };
                  }
                })();
              `);
              
              const result = await browser.evaluate(executorFunction as () => any);
              
              if (result && result.success) {
                executionSuccess = true;
                console.log(chalk.green('✅ Recovery code executed successfully!'));
                
                // Re-run the original command
                console.log(chalk.cyan('\n🔄 Retrying original command...'));
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                const retryResult = await this.runAutomation(command, false);
                
                if (retryResult.success) {
                  console.log(chalk.green('\n✅ Task completed successfully after recovery!'));
                  return true;
                }
              }
            } catch (execError) {
              console.log(chalk.red('❌ Failed to execute recovery code:'), execError);
            }
          }
        }
      }
      
      // Check if user interrupted
      if (this.recoveryInterrupted) {
        this.isInRecoveryMode = false;
        console.log(chalk.green('\n✅ Recovery stopped - user confirmed task completion'));
        return true;
      }
      
      // Check if we should continue iterating
      if (iteration < maxIterations) {
        console.log(chalk.yellow(`\n⏳ Recovery attempt ${iteration} failed. Trying again...`));
        
        // Give user a chance to interrupt during the wait
        await new Promise(resolve => {
          let elapsed = 0;
          const checkInterval = setInterval(() => {
            if (this.recoveryInterrupted || elapsed >= 2000) {
              clearInterval(checkInterval);
              resolve(undefined);
            }
            elapsed += 100;
          }, 100);
        });
        
        // Check again after wait
        if (this.recoveryInterrupted) {
          this.isInRecoveryMode = false;
          console.log(chalk.green('\n✅ Recovery stopped - user confirmed task completion'));
          return true;
        }
        
        // Recursive call
        return await this.sendFailureFeedbackToOpenAI(command, result, iteration + 1, maxIterations);
      } else {
        this.isInRecoveryMode = false;
        console.log(chalk.yellow('\n⚠️  Reached maximum recovery attempts.'));
        console.log(chalk.cyan('💡 Try breaking down your command into smaller steps or use a more specific selector.'));
        return false;
      }
      
    } catch (error) {
      this.isInRecoveryMode = false;
      console.log(chalk.red('❌ Failed to get AI analysis:'), error);
      return false;
    }
  }

  /**
   * Run an automation command
   */
  private async runAutomation(command: string, askForConfirmation: boolean = true): Promise<AutomationExecutionResult> {
    console.log(chalk.blue(`\n🤖 Executing: ${command}`));
    
    const startTime = Date.now();
    
    try {
      // Get current URL from browser or use session context
      const browser = await this.browserManager.getBrowser();
      const currentUrl = browser ? 
        await browser.getCurrentUrl() : 
        this.sessionContext.startUrl;
      
      // Create enhanced prompt with context
      let enhancedPrompt = command;
      
      // Replace ${username} and ${password} placeholders with actual values
      if (this.sessionContext.credentials) {
        Object.entries(this.sessionContext.credentials).forEach(([key, value]) => {
          const placeholder = new RegExp(`\\$\\{${key}\\}`, 'gi');
          enhancedPrompt = enhancedPrompt.replace(placeholder, String(value));
        });
      }
      
      // Add context to prompt if relevant (for logging only, not for the actual prompt)
      if (this.sessionContext.credentials && 
          (command.toLowerCase().includes('login') || 
           command.toLowerCase().includes('sign in') ||
           command.toLowerCase().includes('username') ||
           command.toLowerCase().includes('password'))) {
        const credInfo = Object.entries(this.sessionContext.credentials)
          .map(([key, value]) => `${key}: ${key === 'password' ? '[hidden]' : value}`)
          .join(', ');
        // Only show credentials info in logs, not in the actual prompt sent to AI
        console.log(chalk.gray(`Using credentials: ${credInfo}`));
      }
      
      if (this.sessionContext.arguments && Object.keys(this.sessionContext.arguments).length > 0) {
        // Replace placeholders in prompt with actual values
        Object.entries(this.sessionContext.arguments).forEach(([key, value]) => {
          const placeholder = new RegExp(`\\{${key}\\}|\\$\\{${key}\\}`, 'gi');
          enhancedPrompt = enhancedPrompt.replace(placeholder, value);
        });
        
        // Also check for generic placeholders
        if (enhancedPrompt.includes('{') && enhancedPrompt.includes('}')) {
          const argInfo = Object.entries(this.sessionContext.arguments)
            .map(([key, value]) => `${key}="${value}"`)
            .join(', ');
          console.log(chalk.gray(`Using arguments: ${argInfo}`));
        }
      }
      
      const currentBrowser = this.browserManager.getCurrentBrowser();
      if (!currentBrowser) {
        throw new Error('No active browser session found');
      }
      
      const automation = new IntelligentAutomation(
        currentBrowser, // browser automation instance
        enhancedPrompt,  // task prompt
        true,  // verbose
        true   // persist browser
      );
      
      // Execute automation and get result
      const result = await automation.execute(currentUrl || '');
      
      // Store last execution result
      this.lastExecutionResult = result;
      this.lastPrompt = command;
      
      // Store command with result
      this.sessionCommands.push({
        prompt: command,
        result,
        timestamp: new Date()
      });
      
      // Only ask for confirmation if requested
      if (askForConfirmation) {
        // Ask for confirmation
        const wasSuccessful = await this.askQuestion(chalk.cyan('\n🎯 Did the action complete successfully? (y/n): '));
        
        if (wasSuccessful.toLowerCase() !== 'y') {
          console.log(chalk.yellow('🔧 Removing failed command from session history...'));
          
          // Remove the last command from session
          this.sessionCommands.pop();
          
          // If test was generated, delete it
          if (result.testFile) {
            try {
              await fs.remove(result.testFile);
              console.log(chalk.gray(`Deleted failed test: ${result.testFile}`));
            } catch (error) {
              // Ignore errors when deleting
            }
          }
          
          // Check if the error might be modal/popup related and try Escape key
          const errorStr = result.errors?.join(' ').toLowerCase() || '';
          const lastStep = result.stepResults?.[result.stepResults.length - 1];
          const lastStepStr = lastStep?.step.toLowerCase() || '';
          
          const isModalRelated = errorStr.includes('modal') || 
                                errorStr.includes('popup') || 
                                errorStr.includes('dialog') ||
                                errorStr.includes('overlay') ||
                                errorStr.includes('dismiss') ||
                                errorStr.includes('close') ||
                                errorStr.includes('disabled') ||
                                lastStepStr.includes('modal') ||
                                lastStepStr.includes('popup') ||
                                lastStepStr.includes('close') ||
                                lastStepStr.includes('dismiss') ||
                                command.toLowerCase().includes('modal') ||
                                command.toLowerCase().includes('popup') ||
                                command.toLowerCase().includes('close') ||
                                command.toLowerCase().includes('dismiss') ||
                                command.toLowerCase().includes('escape');
          
          if (isModalRelated) {
            console.log(chalk.yellow('\n🔧 Detected potential modal/popup issue. Attempting automatic fix...'));
            try {
              const browser = this.browserManager.getCurrentBrowser();
              if (browser) {
                // Try pressing Escape key
                await browser.executeAction({ type: 'press', key: 'Escape' });
                await new Promise(resolve => setTimeout(resolve, 500));
                console.log(chalk.green('✅ Pressed Escape key to dismiss potential modals'));
                console.log(chalk.cyan('💡 Try your command again, the modal may have been dismissed.'));
              }
            } catch (escapeError) {
              console.log(chalk.red('❌ Failed to press Escape key:'), escapeError);
            }
          }
          
          // Send failure feedback to OpenAI with screenshot - this now returns boolean
          const recoverySuccess = await this.sendFailureFeedbackToOpenAI(command, result);
          
          if (recoverySuccess) {
            // Recovery succeeded, return successful result
            return { ...result, success: true };
          }
        } else {
          console.log(chalk.green('✅ Command completed successfully'));
        }
      }
      
      console.log(chalk.cyan(`💡 Tip: Use 'save <name>' to save this automation as a reusable sequence`));
      console.log(chalk.gray(`📝 Session has ${this.sessionCommands.length} command(s) ready to save`));
      
      return result;
    } catch (error) {
      // Get status for error case
      const status = this.browserManager.getSessionStatus();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Store failed execution result
      const failedResult: AutomationExecutionResult = {
        success: false,
        script: {
          name: 'interactive-automation',
          description: command,
          url: status.currentUrl || 'https://www.google.com',
          actions: []
        },
        executionTime: Date.now() - startTime,
        screenshots: [],
        errors: [errorMessage]
      };
      this.lastExecutionResult = failedResult;
      this.lastPrompt = command;
      
      return failedResult;
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
          url: this.sessionContext.startUrl || successfulCommands[0].result.script.url,
          actions: combinedActions
        },
        executionTime: totalExecutionTime,
        screenshots: combinedScreenshots,
        errors: [],
        stepResults: successfulCommands.flatMap((cmd, cmdIndex) => 
          cmd.result.stepResults?.map(step => ({
            ...step,
            step: `[Cmd ${cmdIndex + 1}] ${step.step}`
          })) || []
        )
      };

      // Save sequence with context
      await this.sequenceManager.saveSequence(
        name,
        combinedPrompt,
        combinedResult,
        {
          description: `Interactive session with ${successfulCommands.length} commands. Context: ${JSON.stringify(this.sessionContext)}`,
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
      
      // Extract required arguments from the sequence
      const requiredArgs = this.sequenceManager.extractArgumentsFromSequence(sequence);
      let args: Record<string, string> = {};
      
      // Prompt for each required argument
      if (requiredArgs.length > 0) {
        console.log(chalk.cyan('\n📝 This sequence requires the following arguments:'));
        for (const argName of requiredArgs) {
          const value = await this.askQuestion(chalk.yellow(`Enter value for ${argName}: `));
          if (!value) {
            console.log(chalk.red(`✗ ${argName} is required. Aborting sequence.`));
            return;
          }
          args[argName] = value;
        }
      }
      
      // Substitute arguments in the sequence
      const processedSequence = this.sequenceManager.substituteArgumentsInSequence(sequence, args);
      
      const startTime = Date.now();
      
      try {
        // Always use the sequence's URL, not the current browser URL
        const sequenceUrl = processedSequence.script.url;
        if (sequenceUrl) {
          console.log(chalk.gray(`\n🌐 Navigating to sequence URL: ${sequenceUrl}`));
          
          // Get browser and navigate to the sequence URL
          const browser = await this.browserManager.getBrowser();
          await browser.executeAction({ type: 'navigate', url: sequenceUrl });
        }
        
        // Execute the processed prompt with substituted arguments
        await this.runAutomation(processedSequence.originalPrompt);
        
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
   * Debug the current page state for modal/overlay detection issues
   */
  private async debugPageState(): Promise<void> {
    const browser = await this.browserManager.getBrowser();
    if (!browser) {
      console.log(chalk.red('No browser instance active. Use "navigate <url>" to start.'));
      return;
    }

    try {
      console.log(chalk.cyan('\n🔍 Debugging Page State...\n'));
      
      const debugInfo = await browser.debugPageBlockers();
      
      console.log(chalk.yellow('📊 Modal/Overlay Detection:'));
      console.log(`   Total potential modals found: ${debugInfo.modals.length}`);
      console.log(`   Visible modals: ${debugInfo.visibleModalCount}`);
      
      if (debugInfo.modals.length > 0) {
        console.log(chalk.cyan('\n   Modal Details:'));
        debugInfo.modals.forEach((modal: any, index: number) => {
          console.log(`   ${index + 1}. ${modal.element}`);
          console.log(`      Visible: ${modal.visible ? chalk.green('YES') : chalk.red('NO')}`);
          console.log(`      Display: ${modal.display}, Visibility: ${modal.visibility}, Opacity: ${modal.opacity}`);
          console.log(`      Position: ${modal.position}, Z-Index: ${modal.zIndex}`);
          console.log(`      Size: ${modal.width}x${modal.height} at (${modal.top}, ${modal.left})`);
          console.log(`      Content preview: ${modal.innerHTML.substring(0, 50)}...`);
          console.log('');
        });
      }
      
      console.log(chalk.yellow('\n📝 Input Fields:'));
      console.log(`   Total inputs found: ${debugInfo.inputs.length}`);
      console.log(`   Interactable inputs: ${debugInfo.interactableInputCount}`);
      
      if (debugInfo.inputs.length > 0) {
        console.log(chalk.cyan('\n   Input Details:'));
        debugInfo.inputs.forEach((input: any, index: number) => {
          console.log(`   ${index + 1}. ${input.selector}`);
          console.log(`      Interactable: ${input.interactable ? chalk.green('YES') : chalk.red('NO')}`);
          console.log(`      Disabled: ${input.disabled}, ReadOnly: ${input.readOnly}`);
          console.log(`      Display: ${input.display}, Visibility: ${input.visibility}`);
          console.log(`      Placeholder: ${input.placeholder || 'none'}`);
          console.log(`      Current value: ${input.value || 'empty'}`);
          console.log('');
        });
      }
      
      console.log(chalk.yellow('\n📄 Page State:'));
      console.log(`   Document ready state: ${debugInfo.documentReadyState}`);
      console.log(`   Active element: ${debugInfo.activeElement || 'none'}`);
      console.log('');
      
    } catch (error) {
      console.error(chalk.red('Failed to debug page state:'), error);
    }
  }

  /**
   * Show help message
   */
  private showHelp(): void {
    console.log(chalk.cyan('\n📚 Available Commands:\n'));
    console.log(chalk.yellow('  exit/quit          ') + '- Exit interactive mode');
    console.log(chalk.yellow('  status             ') + '- Show current browser and session status');
    console.log(chalk.yellow('  navigate <url>     ') + '- Navigate to a URL');
    console.log(chalk.yellow('  reset              ') + '- Reset browser to a clean state');
    console.log(chalk.yellow('  save <name>        ') + '- Save current session as a reusable sequence');
    console.log(chalk.yellow('  sequences [search] ') + '- List all saved sequences (optional search)');
    console.log(chalk.yellow('  run <name>         ') + '- Run a saved sequence');
    console.log(chalk.yellow('  append <name>      ') + '- Append current session to existing sequence');
    console.log(chalk.yellow('  clear              ') + '- Clear the current session commands');
    console.log(chalk.yellow('  debug              ') + '- Debug page state (modal/input detection)');
    console.log(chalk.yellow('  help               ') + '- Show this help message');
    console.log(chalk.yellow('  autonomous <task>  ') + '- Start autonomous mode with a task');
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

    // Show session context
    console.log('');
    console.log(chalk.cyan('Session Context:'));
    
    if (this.sessionContext.startUrl) {
      console.log(`Start URL: ${chalk.blue(this.sessionContext.startUrl)}`);
    }
    
    if (this.sessionContext.credentials && Object.keys(this.sessionContext.credentials).length > 0) {
      console.log(`Credentials: ${chalk.yellow(Object.keys(this.sessionContext.credentials).join(', '))}`);
    }
    
    if (this.sessionContext.arguments && Object.keys(this.sessionContext.arguments).length > 0) {
      console.log(`Arguments: ${chalk.yellow(Object.entries(this.sessionContext.arguments)
        .map(([key, value]) => `${key}="${value}"`)
        .join(', '))}`);
    }
    
    if (!this.sessionContext.startUrl && 
        (!this.sessionContext.credentials || Object.keys(this.sessionContext.credentials).length === 0) &&
        (!this.sessionContext.arguments || Object.keys(this.sessionContext.arguments).length === 0)) {
      console.log(chalk.gray('No context configured'));
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
   * Collect setup information from user
   */
  private async collectSetupInfo(): Promise<void> {
    try {
      console.log(chalk.cyan('\n📋 Session Setup\n'));
      
      // Ask for starting URL
      const startUrl = await this.askQuestion(chalk.yellow('Starting URL (press Enter to skip): '));
      if (startUrl) {
        this.sessionContext.startUrl = startUrl;
      }
      
      // Ask if credentials are needed
      const needsCredentials = await this.askQuestion(chalk.yellow('Do you need to provide credentials? (y/n): '));
      if (needsCredentials.toLowerCase() === 'y') {
        this.sessionContext.credentials = {};
        
        // Common credentials
        const username = await this.askQuestion(chalk.yellow('Username: '));
        if (username) this.sessionContext.credentials.username = username;
        
        const password = await this.askQuestion(chalk.yellow('Password: '), true);
        if (password) this.sessionContext.credentials.password = password;
        
        // Ask for additional credential fields
        const additionalCreds = await this.askQuestion(chalk.yellow('Any additional credential fields? (comma-separated names, or press Enter to skip): '));
        if (additionalCreds && additionalCreds.trim()) {
          const fields = additionalCreds.split(',').map(f => f.trim()).filter(f => f);
          for (const field of fields) {
            if (field) {
              const value = await this.askQuestion(chalk.yellow(`${field}: `));
              if (value) this.sessionContext.credentials[field] = value;
            }
          }
        }
      }
      
      // Ask for arguments
      const needsArguments = await this.askQuestion(chalk.yellow('Do you need to provide any data/arguments (e.g., patient name, DOB, etc.)? (y/n): '));
      if (needsArguments.toLowerCase() === 'y') {
        this.sessionContext.arguments = {};
        
        const argNames = await this.askQuestion(chalk.yellow('Enter argument names (comma-separated, e.g., "patientName,DOB,provider"): '));
        if (argNames && argNames.trim()) {
          const fields = argNames.split(',').map(f => f.trim()).filter(f => f);
          for (const field of fields) {
            if (field) {
              const value = await this.askQuestion(chalk.yellow(`${field}: `));
              if (value) this.sessionContext.arguments[field] = value;
            }
          }
        }
      }
      
      console.log(chalk.green('\n✅ Setup complete!\n'));
      
      // If starting URL was provided, navigate to it
      if (this.sessionContext.startUrl) {
        await this.navigate(this.sessionContext.startUrl);
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Error during setup:'), error);
      throw error;
    }
  }

  /**
   * Helper method to ask questions
   */
  private askQuestion(question: string, hidden: boolean = false): Promise<string> {
    return new Promise((resolve) => {
      try {
        if (hidden) {
          // For password, we'll just use the regular readline but warn the user
          console.log(chalk.gray('(Note: Password will be visible)'));
        }
        
        // Create a one-time question handler
        const questionHandler = (answer: string | null) => {
          // Handle null answer (EOF/Ctrl+D)
          if (answer === null) {
            console.log(chalk.gray('\n[DEBUG] EOF received, treating as empty input'));
            resolve('');
            return;
          }
          resolve(answer || '');
        };
        
        // Use question with explicit callback
        this.rl.question(question, questionHandler);
        
      } catch (error) {
        console.error(chalk.red('Error reading input:'), error);
        resolve('');
      }
    });
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

// Main execution
if (require.main === module) {
  const mode = new InteractiveMode();
  mode.start().catch(error => {
    console.error('Error starting interactive mode:', error);
    process.exit(1);
  });
} 