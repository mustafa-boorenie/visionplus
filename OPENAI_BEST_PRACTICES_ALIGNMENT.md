# OpenAI Best Practices Alignment for AI Playwright Scripter

Based on the review of OpenAI's documentation on tools and function calling, here are the recommended improvements to align our codebase with best practices:

## 🔍 Current Implementation Analysis

### What We're Doing Well ✅
1. **JSON Response Format**: We're correctly using `response_format: { type: 'json_object' }` for structured outputs
2. **Temperature Settings**: We use appropriate temperature values (0.3-0.7) for different use cases
3. **Model Selection**: Using `gpt-4o-mini` for efficiency in automation tasks
4. **Error Handling**: We have comprehensive error handling for API calls

### Areas for Improvement 🚀

## 📋 Recommended Changes

### 1. **Migrate to Tools API Instead of JSON Mode**

Currently, we're using the chat completions API with JSON response format. OpenAI recommends using the **tools/functions API** for better reliability and structured outputs.

**Current approach:**
```typescript
const response = await this.openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [...],
  response_format: { type: 'json_object' }
});
```

**Recommended approach:**
```typescript
const tools = [{
  type: "function",
  function: {
    name: "generate_automation_steps",
    description: "Generate browser automation steps for a given task",
    parameters: {
      type: "object",
      properties: {
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              actionType: { 
                type: "string",
                enum: ["navigate", "click", "type", "scroll", "wait", "screenshot", "press"]
              },
              selectors: {
                type: "array",
                items: { type: "string" }
              },
              value: { type: "string" },
              waitTime: { type: "number" }
            },
            required: ["description", "actionType"]
          }
        }
      },
      required: ["steps"]
    },
    strict: true  // Enable strict mode for guaranteed adherence to schema
  }
}];

const response = await this.openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [...],
  tools: tools,
  tool_choice: { type: "function", function: { name: "generate_automation_steps" } }
});
```

### 2. **Use Developer Messages for System Prompts**

OpenAI's o-series models prefer "developer" messages over "system" messages.

**Current:**
```typescript
messages: [
  { role: 'system', content: '...' },
  { role: 'user', content: '...' }
]
```

**Recommended:**
```typescript
messages: [
  { role: 'developer', content: '...' },  // For o-series models
  { role: 'user', content: '...' }
]
```

### 3. **Implement Proper Function Descriptions**

Follow OpenAI's guidance on function descriptions:
- **Usage criteria first**: Start with when the function should be used
- **Clear, concise descriptions**: Avoid verbose explanations
- **Few-shot examples**: Include examples in the description when needed

### 4. **Handle Tool Calling Patterns**

Implement the serial tool calling pattern recommended for reasoning models:

```typescript
async function executeWithTools(agent: Agent, input: string) {
  const conversation = [];
  
  while (true) {
    const response = await openai.chat.completions.create({
      messages: conversation,
      tools: tools,
      model: "gpt-4o-mini"
    });
    
    const toolCalls = response.choices[0].message.tool_calls;
    
    if (!toolCalls || toolCalls.length === 0) {
      // No more tool calls, we're done
      return response.choices[0].message.content;
    }
    
    // Execute tools and add results to conversation
    for (const toolCall of toolCalls) {
      const result = await executeToolFunction(toolCall);
      conversation.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result)
      });
    }
  }
}
```

### 5. **Optimize Context Management**

As recommended in the docs:
- Start new conversations for unrelated topics
- Summarize long tool outputs instead of keeping full history
- Remove irrelevant past tool calls when context gets too long

### 6. **Better Tool Choice Control**

Implement proper `tool_choice` usage:

```typescript
// Force specific tool use when needed
tool_choice: { type: "function", function: { name: "specific_tool" } }

// Require some tool use
tool_choice: "required"

// Allow model to decide
tool_choice: "auto"

// Prevent tool use
tool_choice: "none"
```

### 7. **Implement Reasoning Token Management**

For o-series models, properly handle reasoning tokens:
- Set appropriate `reasoning_effort` levels
- Use `reasoning_summary` settings appropriately
- Account for reasoning tokens in context window calculations

## 🛠️ Implementation Plan

### Phase 1: Core API Migration
1. Create new `OpenAIToolsClient` wrapper class
2. Migrate `IntelligentAutomation.breakdownTask()` to use tools API
3. Update `RecoveryPromptSystem` to use function calling
4. Add proper tool schemas for all automation actions

### Phase 2: Enhanced Error Handling
1. Implement serial tool calling loop
2. Add tool result validation
3. Implement retry logic for failed tool calls
4. Add context pruning for long conversations

### Phase 3: Optimization
1. Add caching for tool schemas
2. Implement parallel tool calls where appropriate
3. Add telemetry for tool call performance
4. Optimize prompts based on OpenAI guidelines

## 📝 Example Implementation

Here's how the updated `breakdownTask` method would look:

```typescript
private async breakdownTask(): Promise<void> {
  const tools = [{
    type: "function",
    function: {
      name: "plan_automation_steps",
      description: "Plans a sequence of browser automation steps. Use when breaking down a user task into specific actions.",
      parameters: {
        type: "object",
        properties: {
          steps: {
            type: "array",
            description: "Array of automation steps to execute",
            items: {
              type: "object",
              properties: {
                description: { 
                  type: "string",
                  description: "Human-readable description of the step"
                },
                actionType: { 
                  type: "string",
                  enum: ["navigate", "click", "type", "scroll", "wait", "screenshot", "press"],
                  description: "Type of browser action to perform"
                },
                selectors: {
                  type: "array",
                  description: "Multiple selector candidates ordered by reliability",
                  items: { type: "string" }
                },
                value: { 
                  type: "string",
                  description: "Value for type/navigate actions"
                },
                waitTime: { 
                  type: "number",
                  description: "Milliseconds to wait (for wait actions)"
                }
              },
              required: ["description", "actionType"]
            }
          }
        },
        required: ["steps"]
      },
      strict: true
    }
  }];

  const messages = [
    {
      role: "developer",
      content: this.buildSystemPrompt()
    },
    {
      role: "user",
      content: `Task: ${this.currentScript.description}\nURL: ${this.currentScript.url}`
    }
  ];

  const response = await this.openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    tools,
    tool_choice: { type: "function", function: { name: "plan_automation_steps" } },
    temperature: 0.3
  });

  const toolCall = response.choices[0].message.tool_calls?.[0];
  if (toolCall?.function.arguments) {
    const { steps } = JSON.parse(toolCall.function.arguments);
    this.taskSteps = steps.map((step: any) => ({
      description: step.description,
      action: this.createActionFromStep(step),
      completed: false,
      retryCount: 0
    }));
  }
}
```

## 🎯 Benefits of Alignment

1. **Better Reliability**: Tools API with `strict: true` ensures schema compliance
2. **Improved Performance**: Native tool calling is optimized for o-series models
3. **Enhanced Debugging**: Tool calls are explicitly tracked in the API
4. **Future-Proof**: Aligns with OpenAI's recommended patterns
5. **Better Token Management**: Clearer separation of reasoning and tool tokens

## 📊 Metrics to Track

After implementation, monitor:
- Tool call success rate
- Average tokens per automation
- Reduction in malformed responses
- Time to complete automations
- Error recovery success rate

This alignment will make our automation system more robust, efficient, and compatible with OpenAI's latest best practices. 