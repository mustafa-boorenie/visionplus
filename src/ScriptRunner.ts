import { BrowserAutomation } from './browser/BrowserAutomation';
import { VisionAnalyzer } from './vision/VisionAnalyzer';
import { ResultsHandler } from './utils/ResultsHandler';
import { AutomationScript, VisionAnalysisResponse } from './types';
import { log } from './utils/logger';

/**
 * Main script runner that orchestrates browser automation and vision analysis
 */
export class ScriptRunner {
  private browser: BrowserAutomation;
  private vision: VisionAnalyzer;
  private resultsHandler: ResultsHandler;
  private script: AutomationScript;

  constructor(script: AutomationScript) {
    this.script = script;
    this.browser = new BrowserAutomation();
    this.vision = new VisionAnalyzer();
    this.resultsHandler = new ResultsHandler(script.name);
  }

  /**
   * Run the automation script
   */
  async run(): Promise<void> {
    log.info(`Starting script: ${this.script.name}`);
    
    try {
      // Initialize browser
      await this.browser.initialize();

      // Navigate to initial URL
      if (this.script.url) {
        await this.browser.executeAction({
          type: 'navigate',
          url: this.script.url
        });
      }

      // Execute actions
      for (let i = 0; i < this.script.actions.length; i++) {
        const action = this.script.actions[i];
        log.info(`Executing action ${i + 1}/${this.script.actions.length}: ${action.type}`);

        try {
          await this.browser.executeAction(action);

          // Take screenshot after action if it's a screenshot action
          if (action.type === 'screenshot') {
            const screenshotPath = await this.browser.takeScreenshot(action.name, action.options);
            
            // Analyze if enabled
            if (this.script.analysis?.enabled && this.script.analysis.prompts.length > 0) {
              const prompt = this.script.analysis.prompts[i % this.script.analysis.prompts.length];
              const analysis = await this.analyzeScreenshot(screenshotPath, prompt);
              this.resultsHandler.addScreenshot(action.name, screenshotPath, analysis);
            } else {
              this.resultsHandler.addScreenshot(action.name, screenshotPath);
            }
          }
        } catch (error) {
          log.error(`Action failed: ${action.type}`, error as Error);
          this.resultsHandler.addError(error as Error);
          
          // Take error screenshot
          try {
            const errorScreenshot = await this.browser.takeScreenshot(`error_${i + 1}`);
            this.resultsHandler.addScreenshot(`Error at action ${i + 1}`, errorScreenshot);
          } catch (screenshotError) {
            log.error('Failed to take error screenshot', screenshotError as Error);
          }
          
          throw error; // Re-throw to stop execution
        }
      }

      // Mark as complete
      this.resultsHandler.complete(true);
      
    } catch (error) {
      log.error('Script execution failed', error as Error);
      this.resultsHandler.addError(error as Error);
      this.resultsHandler.complete(false);
    } finally {
      // Always close browser
      await this.browser.close();
      
      // Print and save results
      this.resultsHandler.printSummary();
      await this.resultsHandler.saveReport();
      await this.resultsHandler.saveHtmlReport();
    }
  }

  /**
   * Analyze a screenshot
   */
  private async analyzeScreenshot(
    screenshotPath: string, 
    prompt: string
  ): Promise<VisionAnalysisResponse> {
    try {
      return await this.vision.analyzeScreenshot({
        screenshotPath,
        prompt
      });
    } catch (error) {
      log.error('Screenshot analysis failed', error as Error);
      throw error;
    }
  }

} 