import OpenAI from 'openai';
import { Config } from './config';
import { log } from './logger';

/**
 * OpenAI Tools Client following best practices for function calling
 * Implements recommendations from OpenAI's documentation
 */
export class OpenAIToolsClient {
  private openai: OpenAI;
  
  constructor(apiKey?: string) {
    this.openai = new OpenAI({
      apiKey: apiKey || Config.OPENAI_API_KEY
    });
  }

  /**
   * Define automation planning tool schema
   */
  private getAutomationPlanningTool() {
    return {
      type: "function" as const,
      function: {
        name: "plan_automation_steps",
        description: "Plans browser automation steps. Use when breaking down a user task into specific browser actions.",
        parameters: {
          type: "object",
          properties: {
            steps: {
              type: "array",
              description: "Ordered list of automation steps",
              items: {
                type: "object",
                properties: {
                  description: { 
                    type: "string",
                    description: "What this step does"
                  },
                  actionType: { 
                    type: "string",
                    enum: ["navigate", "click", "type", "scroll", "wait", "screenshot", "press"],
                    description: "Browser action type"
                  },
                  selectors: {
                    type: "array",
                    description: "CSS selectors ordered by reliability (ID > data-testid > aria-label > class)",
                    items: { type: "string" }
                  },
                  value: { 
                    type: "string",
                    description: "Text to type or URL to navigate"
                  },
                  waitTime: { 
                    type: "number",
                    description: "Milliseconds to wait"
                  }
                },
                required: ["description", "actionType"],
                additionalProperties: false
              }
            }
          },
          required: ["steps"],
          additionalProperties: false
        },
        strict: true  // Ensure schema compliance
      }
    };
  }

  /**
   * Define recovery suggestion tool schema
   */
  private getRecoverySuggestionTool() {
    return {
      type: "function" as const,
      function: {
        name: "suggest_recovery_actions",
        description: "Suggests recovery actions when automation fails. Use to provide alternative approaches.",
        parameters: {
          type: "object",
          properties: {
            strategy: {
              type: "string",
              description: "Overall recovery strategy"
            },
            confidence: {
              type: "number",
              minimum: 0,
              maximum: 1,
              description: "Confidence score for this approach"
            },
            actions: {
              type: "array",
              description: "Alternative actions to try",
              items: {
                type: "object",
                properties: {
                  type: { 
                    type: "string",
                    enum: ["wait", "click", "press", "scroll", "navigate"]
                  },
                  description: { type: "string" },
                  selectors: {
                    type: "array",
                    items: { type: "string" }
                  },
                  duration: { type: "number" },
                  key: { type: "string" }
                },
                required: ["type", "description"]
              }
            },
            reason: {
              type: "string",
              description: "Why this approach might work"
            }
          },
          required: ["strategy", "actions", "reason", "confidence"],
          additionalProperties: false
        },
        strict: true
      }
    };
  }

  /**
   * Plan automation steps using tools API
   */
  async planAutomationSteps(
    task: string, 
    url: string,
    context?: string
  ): Promise<any[]> {
    const tools = [this.getAutomationPlanningTool()];
    
    const messages = [
      {
        role: "developer" as const,  // Use developer role for o-series models
        content: this.buildAutomationSystemPrompt(context)
      },
      {
        role: "user" as const,
        content: `Task: ${task}\nStarting URL: ${url}`
      }
    ];

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        tools,
        tool_choice: { 
          type: "function", 
          function: { name: "plan_automation_steps" } 
        },
        temperature: 0.3,  // Lower temperature for consistency
        max_tokens: 2000
      });

      const toolCall = response.choices[0].message.tool_calls?.[0];
      if (!toolCall?.function.arguments) {
        throw new Error('No tool call response received');
      }

      const result = JSON.parse(toolCall.function.arguments);
      log.info('[TOOLS_CLIENT] Generated automation plan with steps: ' + result.steps?.length);
      
      return result.steps || [];
    } catch (error) {
      log.error('[TOOLS_CLIENT] Failed to plan automation steps', error as Error);
      throw error;
    }
  }

  /**
   * Suggest recovery actions using tools API
   */
  async suggestRecoveryActions(
    failedStep: string,
    error: string,
    pageContext: any
  ): Promise<any> {
    const tools = [this.getRecoverySuggestionTool()];
    
    const messages = [
      {
        role: "developer" as const,
        content: "You are an expert at web automation recovery. Suggest alternative approaches when actions fail."
      },
      {
        role: "user" as const,
        content: `Failed step: ${failedStep}
Error: ${error}
Page URL: ${pageContext.url || 'unknown'}
Page state: ${JSON.stringify(pageContext.state || {})}

Suggest a recovery approach with specific actions.`
      }
    ];

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        tools,
        tool_choice: "required",  // Require tool use
        temperature: 0.5
      });

      const toolCall = response.choices[0].message.tool_calls?.[0];
      if (!toolCall?.function.arguments) {
        throw new Error('No recovery suggestion received');
      }

      return JSON.parse(toolCall.function.arguments);
    } catch (error) {
      log.error('[TOOLS_CLIENT] Failed to suggest recovery actions', error as Error);
      throw error;
    }
  }

  /**
   * Execute multiple tool calls in series (for complex workflows)
   */
  async executeWithTools(
    messages: any[],
    tools: any[],
    maxIterations: number = 10
  ): Promise<string> {
    const conversation = [...messages];
    let iterations = 0;

    while (iterations < maxIterations) {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: conversation,
        tools,
        tool_choice: "auto"
      });

      const message = response.choices[0].message;
      conversation.push(message);

      // Check if there are tool calls
      if (!message.tool_calls || message.tool_calls.length === 0) {
        // No more tool calls, return the final message
        return message.content || '';
      }

      // Execute each tool call
      for (const toolCall of message.tool_calls) {
        log.info(`[TOOLS_CLIENT] Executing tool: ${toolCall.function.name}`);
        
        // In a real implementation, you would execute the actual tool here
        // For now, we'll add a placeholder response
        conversation.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify({ success: true, result: "Tool executed" })
        });
      }

      iterations++;
    }

    throw new Error('Max iterations reached without completion');
  }

  /**
   * Build system prompt with best practices
   */
  private buildAutomationSystemPrompt(additionalContext?: string): string {
    return `You are an expert browser automation planner. Your role is to break down user tasks into specific, executable browser actions.

CRITICAL GUIDELINES:
1. Each step must be a single, atomic browser action
2. Always include wait steps after navigation and dynamic content loading
3. Provide multiple selector candidates ordered by reliability
4. Consider page load times and element visibility
5. Handle common patterns like cookie banners and popups

SELECTOR PRIORITY (highest to lowest):
1. ID selectors (#id)
2. Data attributes ([data-testid="..."])
3. ARIA labels ([aria-label="..."])
4. Name attributes ([name="..."])
5. Role attributes ([role="..."])
6. Class selectors (.class) - use sparingly
7. Text content (:has-text("...")) - last resort

COMMON PATTERNS:
- After navigation: always add a wait step (2-3 seconds)
- Before typing: ensure the input field is focused
- For search: prefer pressing Enter over clicking search buttons
- For dynamic content: add explicit waits for elements

${additionalContext || ''}

Remember: Generate only the specific steps needed. Do not include explanations or additional commentary.`;
  }

  /**
   * Validate tool response against schema
   */
  validateToolResponse(response: any, schema: any): boolean {
    // In production, use a proper JSON schema validator
    // This is a simplified validation
    try {
      if (!response || typeof response !== 'object') {
        return false;
      }
      
      // Check required fields exist
      for (const field of schema.required || []) {
        if (!(field in response)) {
          log.error(`[TOOLS_CLIENT] Missing required field: ${field}`);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      log.error('[TOOLS_CLIENT] Validation error', error as Error);
      return false;
    }
  }
}

/**
 * Singleton instance for convenience
 */
export const toolsClient = new OpenAIToolsClient(); 