import { BrowserAutomation } from '../browser/BrowserAutomation';
import { BrowserManager } from '../browser/BrowserManager';
import { VisionAnalyzer } from '../vision/VisionAnalyzer';
import { AutomationScript, BrowserAction } from '../types';
import { log } from '../utils/logger';
import { ProgressTracker } from '../utils/ProgressTracker';
import { TestGenerator } from './TestGenerator';
import { VectorStore } from '../rag/VectorStore';
import OpenAI from 'openai';
import { Config } from '../utils/config';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

/**
 * Task step representing a single automation action
 */
interface TaskStep {
  description: string;
  action?: BrowserAction;
  completed: boolean;
  retryCount: number;
}

/**
 * Intelligent automation system that breaks down tasks and builds scripts recursively
 */
export class IntelligentAutomation {
  private openai: OpenAI;
  private browser: BrowserAutomation;
  private vision: VisionAnalyzer;
  private vectorStore: VectorStore;
  private currentScript: AutomationScript;
  private taskSteps: TaskStep[] = [];
  private maxRetries = 5;
  // private cacheDir = './scripts/cache'; // TEMPORARILY DISABLED
  private progress: ProgressTracker;
  
  constructor(
    taskPrompt: string, 
    private verbose: boolean = false,
    private persistBrowser: boolean = false
  ) {
    this.openai = new OpenAI({ apiKey: Config.OPENAI_API_KEY });
    this.vision = new VisionAnalyzer();
    this.vectorStore = new VectorStore();
    this.progress = new ProgressTracker(this.verbose);
    
    // Browser will be initialized during execute()
    this.browser = null as any;
    
    this.currentScript = {
      name: 'intelligent-automation',
      description: taskPrompt,
      url: '',
      actions: []
    };
  }

  /**
   * Main execution method
   */
  async execute(startUrl: string): Promise<void> {
    try {
      // Initialize browser based on persistence mode
      if (this.persistBrowser) {
        const browserManager = BrowserManager.getInstance();
        this.browser = await browserManager.getBrowser();
        
        // Navigate to start URL if provided and different from current
        const currentUrl = await this.browser.getCurrentUrl();
        if (startUrl && startUrl !== currentUrl) {
          await this.browser.executeAction({ type: 'navigate', url: startUrl });
        }
      } else {
        // Non-persistent mode - create new browser
        this.browser = new BrowserAutomation();
        await this.browser.initialize();
      }
      
      await this.vectorStore.initialize();
      
      // Set the URL in the current script
      this.currentScript.url = startUrl;
      
      // Load cached script if available
      // TEMPORARILY DISABLED: Cache is returning incorrect scripts
      // const cached = await this.scriptRunner.loadFromCache(this.currentScript);
      // if (cached) {
      //   log.info('Using cached script');
      //   this.taskSteps = cached.steps.map(step => ({
      //     ...step,
      //     completed: false,
      //     retryCount: 0
      //   }));
      // } else {
        // Break down the task
        await this.breakdownTask();
      // }

      // Initialize progress tracking
      this.progress.initialize(this.taskSteps.length);

      // Execute steps recursively
      await this.executeStepsRecursively();

      // Cache successful script - TEMPORARILY DISABLED
      await this.cacheScript();

      // Generate Playwright test
      await this.generateTest();

      // Display summary
      this.progress.displaySummary(true);

      // Export progress log
      const logPath = path.join('./logs', `progress_${Date.now()}.json`);
      await this.progress.exportLog(logPath);

    } catch (error) {
      log.error('Automation failed', error as Error);
      this.progress.displaySummary(false);
      throw error;
    } finally {
      // Only close browser if not in persistent mode
      if (!this.persistBrowser) {
        await this.browser.close();
      } else {
        log.info('[PERSISTENT_MODE] Browser session kept open for next command');
      }
    }
  }

  /**
   * Break down the task into actionable steps using AI
   */
  private async breakdownTask(): Promise<void> {
    try {
      // Get relevant Playwright documentation for the task
      const relevantDocs = await this.vectorStore.getRelevantContext(
        this.currentScript.description || ''
      );

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert at breaking down web automation tasks into specific, actionable steps.
            Each step should be a single browser action like navigate, click, type, scroll, or screenshot.
            Be specific about what elements to interact with.
            
            ${relevantDocs}
            
            IMPORTANT: Use modern Playwright selectors as shown in the documentation above.
            Prefer getByRole, getByText, getByLabel over CSS selectors when possible.
            
            For common websites, use these known selectors:
      
            Prefer ID selectors over class selectors when available.
            Use data-testid attributes if present.
            
            For Google search, use these specific selectors:
            - Search box: textarea[name="q"] or #APjFqb
            - Search button: input[name="btnK"] (for search button)
            - I'm Feeling Lucky: input[name="btnI"]
            Note: Google uses a textarea element, not an input, for the search box!
            
            For PubMed search, use these specific selectors:
            - Search box: input[name="term"] or #id_term
            - The search input has class "term-input" and role="combobox"
            - Press Enter to search (no separate search button needed)
            
            Important tips:
            - For Google search, prefer pressing Enter in the search box rather than clicking the search button
            - After typing in a search box, you may need to wait briefly before pressing Enter
            - Consider page load times and add appropriate wait steps
            - Be aware that some sites (especially Amazon) may show CAPTCHAs during automation
            - Add wait steps after navigation to allow pages to fully load
            
            CRITICAL: For EACH action that requires a selector (click, type, press, wait, scroll, select):
            Instead of providing a single 'selector' field, provide a 'selectors' array with multiple candidates.
            Order them from most specific/reliable to most generic. Include various selector types:
            1. ID selectors (#id)
            2. Data attributes ([data-testid="..."])
            3. Aria labels ([aria-label="..."])
            4. Role-based (use as CSS: [role="..."])
            5. Name attributes ([name="..."])
            6. Class selectors (.class)
            7. Text content (button:has-text("..."))
            8. Placeholder ([placeholder="..."])
            9. Type attributes ([type="..."])
            
            Example:
            {
              "description": "Click search button",
              "actionType": "click",
              "selectors": [
                "button[data-testid='search-submit']",
                "#search-button",
                "button[aria-label='Search']",
                "[role='button']:has-text('Search')",
                "button[type='submit']",
                ".search-button",
                "button:has-text('Search')"
              ]
            }`
          },
          {
            role: 'user',
            content: `Break down this task into specific browser automation steps:
            Task: ${this.currentScript.description}
            Starting URL: ${this.currentScript.url}
            
            Return a JSON array of steps, each with:
            - description: what to do
            - actionType: navigate|click|type|scroll|wait|screenshot|press
            - selector: CSS selector if needed (be specific and use reliable selectors)
            - value: text to type or URL to navigate to
            - waitTime: milliseconds to wait if needed`
          }
        ],
        response_format: { type: 'json_object' }
      });

      const stepsData = JSON.parse(response.choices[0].message.content || '{"steps": []}');
      
      // Log the generated steps for debugging
      log.info('[TASK_BREAKDOWN] Generated steps:');
      stepsData.steps.forEach((step: any, index: number) => {
        log.info(`[TASK_BREAKDOWN] Step ${index + 1}: ${step.description}`);
        log.info(`[TASK_BREAKDOWN]   Action: ${step.actionType}`);
        if (step.selectors) {
          log.info(`[TASK_BREAKDOWN]   Selectors: ${JSON.stringify(step.selectors)}`);
        } else if (step.selector) {
          log.info(`[TASK_BREAKDOWN]   Selector: ${step.selector}`);
        }
        log.info(`[TASK_BREAKDOWN]   Value: ${step.value || 'N/A'}`);
      });
      
      this.taskSteps = stepsData.steps.map((step: any) => ({
        description: step.description,
        action: this.createActionFromStep(step),
        completed: false,
        retryCount: 0
      }));

    } catch (error) {
      log.error('Failed to breakdown task', error as Error);
      // Fallback to basic steps
      this.taskSteps = [
        {
          description: 'Navigate to URL',
          action: { type: 'navigate', url: this.currentScript.url },
          completed: false,
          retryCount: 0
        },
        {
          description: 'Wait for page load',
          action: { type: 'wait', duration: 3000 },
          completed: false,
          retryCount: 0
        },
        {
          description: 'Take screenshot',
          action: { type: 'screenshot', name: 'initial' },
          completed: false,
          retryCount: 0
        }
      ];
    }
  }

  /**
   * Convert step data to browser action
   */
  private createActionFromStep(step: any): BrowserAction {
    // Extract selectors - support both old 'selector' and new 'selectors' format
    const getSelectors = () => {
      if (step.selectors && Array.isArray(step.selectors)) {
        return step.selectors;
      } else if (step.selector) {
        return step.selector; // Keep as string or array
      }
      return undefined;
    };

    switch (step.actionType || step.type) {
      case 'navigate':
        return { type: 'navigate', url: step.value || step.url };
      case 'click':
        return { type: 'click', selector: getSelectors() };
      case 'type':
        return { type: 'type', selector: getSelectors(), text: step.value || step.text };
      case 'fill':
        // Handle fill as type action
        return { type: 'type', selector: getSelectors(), text: step.value || step.text };
      case 'press':
        return { type: 'press', selector: getSelectors(), key: step.key || 'Enter' };
      case 'scroll':
        return { 
          type: 'scroll', 
          direction: step.direction || 'down', 
          amount: step.amount || 500,
          selector: getSelectors()
        };
      case 'wait':
        return { 
          type: 'wait', 
          duration: step.waitTime || step.duration || 2000,
          selector: getSelectors()
        };
      case 'screenshot':
        return { type: 'screenshot', name: step.value || step.name || 'screenshot' };
      default:
        // If no type matches, return a wait action
        log.warn(`Unknown action type: ${step.actionType || step.type}, defaulting to wait`);
        return { type: 'wait', duration: 1000 };
    }
  }

  /**
   * Execute steps recursively with error handling
   */
  private async executeStepsRecursively(stepIndex: number = 0): Promise<void> {
    if (stepIndex >= this.taskSteps.length) {
      return; // All steps completed
    }

    const step = this.taskSteps[stepIndex];
    
    // Update progress tracker with current total steps (may have changed due to insertions)
    this.progress.initialize(this.taskSteps.length);
    
    this.progress.track({
      type: 'step_start',
      stepIndex: stepIndex + 1,
      totalSteps: this.taskSteps.length,
      description: step.description
    });

    try {
      // Execute the action
      if (step.action) {
        await this.browser.executeAction(step.action);
        this.currentScript.actions.push(step.action);
      }

      // Mark as completed
      step.completed = true;
      
      this.progress.track({
        type: 'step_complete',
        stepIndex: stepIndex + 1,
        totalSteps: this.taskSteps.length,
        description: step.description
      });

      // Continue to next step
      await this.executeStepsRecursively(stepIndex + 1);

    } catch (error) {
      this.progress.track({
        type: 'step_failed',
        stepIndex: stepIndex + 1,
        totalSteps: this.taskSteps.length,
        description: step.description,
        details: error
      });
      
      step.retryCount++;

      // Handle failure
      if (step.retryCount >= this.maxRetries) {
        await this.handlePersistentFailure(step, stepIndex);
      } else {
        this.progress.track({
          type: 'retry',
          stepIndex: stepIndex + 1,
          totalSteps: this.taskSteps.length,
          description: step.description,
          details: { attempt: step.retryCount, maxAttempts: this.maxRetries }
        });
        await this.handleStepFailure(step, stepIndex);
      }
    }
  }

  /**
   * Handle step failure with Vision API
   */
  private async handleStepFailure(step: TaskStep, stepIndex: number): Promise<void> {
    this.progress.track({
      type: 'analysis',
      stepIndex: stepIndex + 1,
      totalSteps: this.taskSteps.length,
      description: 'Analyzing failure with Vision API',
      details: `Attempt ${step.retryCount}/${this.maxRetries}`
    });

    try {
      // Take screenshot
      const screenshotPath = await this.browser.takeScreenshot(`error_${stepIndex}`);

      // Get relevant documentation for the error
      const errorMessage = `${step.description} failed with ${JSON.stringify(step.action)}`;
      const relevantDocs = await this.vectorStore.getRelevantContext(
        step.description,
        errorMessage
      );

      // Get page HTML for better context
      const html = await this.browser.evaluate(() => {
        return (globalThis as any).document.documentElement.outerHTML;
      });
      const htmlExcerpt = html.slice(0, 5000);

      // Analyze with Vision API
      const analysis = await this.vision.analyzeScreenshot({
        screenshotPath,
        prompt: `The automation is trying to: "${step.description}"
        The current action failed: ${JSON.stringify(step.action)}
        
        ${relevantDocs}
        
        Here is the HTML excerpt of the page:
        ${htmlExcerpt}
        
        Please analyze the screenshot and HTML to:
        1. Check if there's a CAPTCHA present on the page (look for reCAPTCHA, hCaptcha, or other challenge-response tests)
        2. Identify why the action might have failed (element not found, not visible, etc.)
        3. Suggest a corrected selector using modern Playwright methods (getByRole, getByText, etc.)
        4. Provide alternative actions to try
        
        Return as JSON with fields: 
        - reason: why the action failed
        - hasCaptcha: boolean indicating if a captcha is present
        - captchaType: type of captcha if present (recaptcha, hcaptcha, other)
        - suggestion: what to do next
        - alternativeAction: alternative action object with type, selectors (array of candidates), etc.
        
        For the alternativeAction, provide multiple selector candidates in a 'selectors' array:
        Example:
        {
          "type": "click",
          "selectors": [
            "#search-button",
            "button[aria-label='Search']",
            "[role='button']:has-text('Search')",
            "button[type='submit']",
            ".search-button"
          ]
        }`
      });

      // Log the raw analysis content for debugging
      log.info('[VISION] Raw analysis content:');
      log.info(analysis.content);

      // Parse suggestion and update step
      try {
        // Clean the response from markdown code blocks if present
        let cleanedContent = analysis.content.trim();
        if (cleanedContent.startsWith('```json')) {
          cleanedContent = cleanedContent.substring(7); // Remove ```json
        }
        if (cleanedContent.startsWith('```')) {
          cleanedContent = cleanedContent.substring(3); // Remove ```
        }
        if (cleanedContent.endsWith('```')) {
          cleanedContent = cleanedContent.substring(0, cleanedContent.length - 3); // Remove trailing ```
        }
        cleanedContent = cleanedContent.trim();
        
        const suggestion = JSON.parse(cleanedContent);
        log.info('[VISION] Parsed suggestion:');
        log.info(`[VISION] Reason: ${suggestion.reason}`);
        log.info(`[VISION] Has Captcha: ${suggestion.hasCaptcha}`);
        log.info(`[VISION] Captcha Type: ${suggestion.captchaType || 'N/A'}`);
        log.info(`[VISION] Suggestion: ${suggestion.suggestion}`);
        log.info(`[VISION] Alternative Action: ${JSON.stringify(suggestion.alternativeAction)}`);
        
        // Check if captcha is detected
        if (suggestion.hasCaptcha) {
          log.info('[CAPTCHA] Captcha detected, handling...');
          await this.handleCaptcha(stepIndex, suggestion.captchaType);
          return;
        }
        
        // Insert a wait action before retrying
        this.taskSteps.splice(stepIndex, 0, {
          description: 'Wait for page to stabilize',
          action: { type: 'wait', duration: 2000 },
          completed: false,
          retryCount: 0
        });
        
        if (suggestion.alternativeAction) {
          // Update the original step with the new action
          const newAction = this.createActionFromStep(suggestion.alternativeAction);
          log.info(`[VISION] Creating new action from suggestion: ${JSON.stringify(newAction)}`);
          step.action = newAction;
        }
      } catch (e) {
        log.error('[VISION] Failed to parse suggestion as JSON:', e as Error);
        log.info('[VISION] Raw content that failed to parse:');
        log.info(analysis.content.substring(0, 1000));
        
        // If parsing fails, add a wait before retrying with original action
        this.taskSteps.splice(stepIndex, 0, {
          description: 'Wait before retry',
          action: { type: 'wait', duration: 2000 },
          completed: false,
          retryCount: 0
        });
      }

      // Retry from the wait step we just added
      await this.executeStepsRecursively(stepIndex);

    } catch (error) {
      log.error('Vision analysis failed', error as Error);
      // Skip to next step
      await this.executeStepsRecursively(stepIndex + 1);
    }
  }

  /**
   * Handle CAPTCHA detection and solving
   */
  private async handleCaptcha(stepIndex: number, captchaType?: string): Promise<void> {
    log.info(`[CAPTCHA] Handling ${captchaType || 'unknown'} captcha`);
    
    // Take a screenshot of the captcha
    const screenshotPath = await this.browser.takeScreenshot(`captcha_${stepIndex}`);
    log.info(`[CAPTCHA] Screenshot saved to: ${screenshotPath}`);
    
    // Pause automation and wait for user intervention
    console.log(chalk.yellow('\n⚠️  CAPTCHA DETECTED!'));
    console.log(chalk.yellow(`Type: ${captchaType || 'Unknown'}`));
    console.log(chalk.yellow(`Screenshot saved to: ${screenshotPath}`));
    console.log(chalk.cyan('\nPlease solve the captcha manually in the browser window.'));
    console.log(chalk.cyan('Press ENTER when you have solved the captcha...'));
    
    // Create a promise that resolves when user presses Enter
    await new Promise<void>((resolve) => {
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      rl.question('', () => {
        rl.close();
        resolve();
      });
    });
    
    log.info('[CAPTCHA] User indicated captcha is solved, continuing...');
    
    // Add a wait to ensure the page has updated after captcha solving
    this.taskSteps.splice(stepIndex, 0, {
      description: 'Wait for page to update after captcha',
      action: { type: 'wait', duration: 3000 },
      completed: false,
      retryCount: 0
    });
    
    // Continue from the wait step
    await this.executeStepsRecursively(stepIndex);
  }

  /**
   * Handle persistent failure by analyzing HTML
   */
  private async handlePersistentFailure(step: TaskStep, stepIndex: number): Promise<void> {
    this.progress.track({
      type: 'analysis',
      stepIndex: stepIndex + 1,
      totalSteps: this.taskSteps.length,
      description: 'Analyzing page HTML for alternative approach',
      details: `Failed ${this.maxRetries} times`
    });

    try {
      // Get page HTML
      const html = await this.browser.evaluate(() => {
        return (globalThis as any).document.documentElement.outerHTML;
      });
      
      // Save HTML for debugging
      const htmlPath = path.join('./logs', `failure_${Date.now()}.html`);
      await fs.writeFile(htmlPath, html);

      // Get relevant documentation for persistent failures
      const relevantDocs = await this.vectorStore.getRelevantContext(
        step.description,
        `persistent failure: ${JSON.stringify(step.action)}`
      );

      // Analyze HTML with AI
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert at analyzing HTML and creating Playwright selectors.
            
            ${relevantDocs}
            
            Use modern Playwright selectors as shown in the documentation above.`
          },
          {
            role: 'user',
            content: `Task: ${step.description}
            Failed action: ${JSON.stringify(step.action)}
            
            Analyze this HTML and provide:
            1. The correct selector for the target element
            2. Any necessary wait conditions
            3. Alternative approaches
            
            HTML excerpt (first 5000 chars):
            ${html.slice(0, 5000)}
            
            Return as JSON with: 
            - selectors: array of selector candidates (ordered from most to least specific)
            - waitCondition: what to wait for before trying
            - approach: explanation of the approach`
          }
        ],
        response_format: { type: 'json_object' }
      });

      const solution = JSON.parse(response.choices[0].message.content || '{}');
      
      // Log the solution for debugging
      log.info('[PERSISTENT_FAILURE] AI Solution:');
      log.info(`[PERSISTENT_FAILURE] Selectors: ${JSON.stringify(solution.selectors || solution.selector)}`);
      log.info(`[PERSISTENT_FAILURE] Wait Condition: ${solution.waitCondition}`);
      log.info(`[PERSISTENT_FAILURE] Approach: ${solution.approach}`);

      // Update step with new approach
      if (solution.selectors || solution.selector) {
        const selectors = solution.selectors || solution.selector;
        
        // Only update selector for actions that have selectors
        if (step.action && 'selector' in step.action) {
          (step.action as any).selector = selectors;
        }
      }

      // Add wait condition if suggested
      if (solution.waitCondition) {
        this.taskSteps.splice(stepIndex, 0, {
          description: `Wait for ${solution.waitCondition}`,
          action: { type: 'wait', selector: solution.selector, state: 'visible' },
          completed: false,
          retryCount: 0
        });
      }

      // One final attempt
      step.retryCount = 0;
      await this.executeStepsRecursively(stepIndex);

    } catch (error) {
      log.error('Unable to recover from failure', error as Error);
      // Skip this step and continue
      await this.executeStepsRecursively(stepIndex + 1);
    }
  }

  /**
   * Temporary implementation - caching is disabled
   */
  private async cacheScript(): Promise<void> {
    log.info('Script caching is temporarily disabled');
  }

  // TEMPORARILY DISABLED: Cache methods
  /*
  private async checkCache(taskDescription: string): Promise<AutomationScript | null> {
    try {
      const cacheDir = path.join('./scripts/cache');
      await fs.ensureDir(cacheDir);
      
      const files = await fs.readdir(cacheDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      for (const file of jsonFiles) {
        const filePath = path.join(cacheDir, file);
        const cached = await fs.readJSON(filePath) as AutomationScript;
        
        // Simple similarity check (can be improved with better algorithms)
        const similarity = this.calculateSimilarity(
          taskDescription.toLowerCase(),
          (cached.description || '').toLowerCase()
        );
        
        if (similarity > 0.8) {
          console.log(chalk.green(`📦 Cache Hit: ${cached.name} (${Math.round(similarity * 100)}% match)`));
          return cached;
        }
      }
    } catch (error) {
      log.error('Cache check failed', error as Error);
    }
    
    return null;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = str1.split(/\s+/);
    const words2 = str2.split(/\s+/);
    const common = words1.filter(w => words2.includes(w));
    return common.length / Math.max(words1.length, words2.length);
  }
  */

  /**
   * Generate Playwright test from successful script
   */
  private async generateTest(): Promise<void> {
    try {
      const generator = new TestGenerator(this.currentScript);
      const testsDir = './tests/generated';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${this.currentScript.name.replace(/\s+/g, '_')}_${timestamp}.spec.ts`;
      const testPath = path.join(testsDir, filename);

      await generator.generateTest(testPath);
      log.info(`Playwright test generated: ${testPath}`);
    } catch (error) {
      log.error('Failed to generate test', error as Error);
    }
  }
} 