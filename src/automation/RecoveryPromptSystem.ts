import { BrowserAction } from '../types';
import { log } from '../utils/logger';
import OpenAI from 'openai';
import { Config } from '../utils/config';

/**
 * Recovery option presented to the model/user
 */
export interface RecoveryOption {
  id: string;
  description: string;
  confidence: number;
  actions: BrowserAction[];
  reason: string;
}

/**
 * Recovery prompt result
 */
export interface RecoveryPromptResult {
  selectedOption: RecoveryOption;
  customActions?: BrowserAction[];
  skipStep?: boolean;
}

/**
 * Interactive recovery prompt system for handling failures
 */
export class RecoveryPromptSystem {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: Config.OPENAI_API_KEY });
  }

  /**
   * Generate recovery options based on failure context
   */
  async generateRecoveryOptions(
    failureContext: {
      step: string;
      action: BrowserAction;
      error: string;
      html: string;
      screenshotPath: string;
      selectorSuggestions?: string[];
      pageState?: any;
    }
  ): Promise<RecoveryOption[]> {
    const options: RecoveryOption[] = [];

    // Option 1: Retry with alternative selectors
    if (failureContext.selectorSuggestions && failureContext.selectorSuggestions.length > 0) {
      const retryAction = { ...failureContext.action };
      if ('selector' in retryAction) {
        retryAction.selector = failureContext.selectorSuggestions;
      }
      
      options.push({
        id: 'retry-selectors',
        description: 'Retry with alternative selectors',
        confidence: 0.8,
        actions: [retryAction],
        reason: `Found ${failureContext.selectorSuggestions.length} alternative selectors that might work`
      });
    }

    // Option 2: Add wait and retry
    options.push({
      id: 'wait-retry',
      description: 'Wait for page to stabilize and retry',
      confidence: 0.7,
      actions: [
        { type: 'wait', duration: 3000 },
        failureContext.action
      ],
      reason: 'Page might still be loading or elements rendering'
    });

    // Option 3: Handle modal/popup
    if (failureContext.pageState?.hasModals) {
      options.push({
        id: 'close-modal',
        description: 'Close modal/popup and retry',
        confidence: 0.9,
        actions: [
          { type: 'press', key: 'Escape' },
          { type: 'wait', duration: 1000 },
          failureContext.action
        ],
        reason: 'A modal or popup is blocking the action'
      });
    }

    // Option 4: Alternative approach
    const alternativeApproach = await this.suggestAlternativeApproach(failureContext);
    if (alternativeApproach) {
      options.push(alternativeApproach);
    }

    // Option 5: Skip this step
    options.push({
      id: 'skip-step',
      description: 'Skip this step and continue',
      confidence: 0.3,
      actions: [],
      reason: 'This step might be optional or the goal might be achievable without it'
    });

    return options;
  }

  /**
   * Suggest alternative approach using AI
   */
  private async suggestAlternativeApproach(
    failureContext: any
  ): Promise<RecoveryOption | null> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert at web automation recovery. Given a failed action, suggest an alternative approach.
            Return a JSON object with:
            - description: Brief description of the alternative approach
            - actions: Array of browser actions to try
            - reason: Why this might work better
            
            Available action types: navigate, click, type, wait, scroll, press, screenshot
            For selectors, provide arrays of candidates when possible.`
          },
          {
            role: 'user',
            content: `Failed step: ${failureContext.step}
            Failed action: ${JSON.stringify(failureContext.action)}
            Error: ${failureContext.error}
            Page URL: ${failureContext.pageState?.url || 'unknown'}
            
            Suggest an alternative approach to achieve the same goal.`
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 500
      });

      const suggestion = JSON.parse(response.choices[0].message.content || '{}');
      
      if (suggestion.actions && suggestion.actions.length > 0) {
        return {
          id: 'alternative-approach',
          description: suggestion.description || 'Alternative approach',
          confidence: 0.6,
          actions: suggestion.actions,
          reason: suggestion.reason || 'AI-suggested alternative method'
        };
      }
    } catch (error) {
      log.error('Failed to generate alternative approach', error as Error);
    }

    return null;
  }

  /**
   * Present recovery options and get selection
   */
  async promptForRecovery(
    options: RecoveryOption[],
    autoSelect: boolean = true
  ): Promise<RecoveryPromptResult> {
    // Sort options by confidence
    const sortedOptions = options.sort((a, b) => b.confidence - a.confidence);
    
    // Log all options
    log.info('[RECOVERY_PROMPT] Available recovery options:');
    sortedOptions.forEach((option, index) => {
      log.info(`  ${index + 1}. ${option.description} (confidence: ${option.confidence})`);
      log.info(`     Reason: ${option.reason}`);
    });

    if (autoSelect && sortedOptions.length > 0) {
      // Auto-select the highest confidence option
      const selected = sortedOptions[0];
      log.info(`[RECOVERY_PROMPT] Auto-selected: ${selected.description}`);
      
      return {
        selectedOption: selected,
        skipStep: selected.id === 'skip-step'
      };
    }

    // For manual selection (future enhancement)
    // This would involve prompting the user through the CLI
    return {
      selectedOption: sortedOptions[0] || {
        id: 'skip-step',
        description: 'Skip step',
        confidence: 0,
        actions: [],
        reason: 'No recovery options available'
      },
      skipStep: true
    };
  }

  /**
   * Execute recovery actions
   */
  async executeRecovery(
    browser: any,
    recovery: RecoveryPromptResult
  ): Promise<boolean> {
    try {
      if (recovery.skipStep) {
        log.info('[RECOVERY_PROMPT] Skipping step as requested');
        return true;
      }

      const actions = recovery.customActions || recovery.selectedOption.actions;
      
      log.info(`[RECOVERY_PROMPT] Executing recovery: ${recovery.selectedOption.description}`);
      log.info(`[RECOVERY_PROMPT] Actions to execute: ${actions.length}`);

      for (const action of actions) {
        log.info(`[RECOVERY_PROMPT] Executing: ${action.type}`);
        await browser.executeAction(action);
      }

      return true;
    } catch (error) {
      log.error('[RECOVERY_PROMPT] Recovery execution failed', error as Error);
      return false;
    }
  }
} 