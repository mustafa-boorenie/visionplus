# Expect Scripts Behavior

## Overview

The AI Playwright Automation system generates Playwright expect scripts to ensure actions complete successfully and for regression testing. The behavior differs between interactive mode and sequence execution to provide the best user experience.

## Behavior by Mode

### Interactive Mode (Manual Automation)

When running automation commands manually in interactive mode, the workflow is:

1. **Action Execution**: The automation performs the requested action
2. **Success Confirmation**: System asks "Did the action complete successfully? (y/n)"
   - If **Yes**: Proceeds to expect script generation
   - If **No**: Asks whether to enter recovery mode (r) or retry (t)
3. **Expect Script Generation** (only if action was successful):
   - System generates an expect script
   - User can:
     - Approve the generated script (y/yes)
     - Edit the script manually (edit)
     - Reject the script (n/no)
- **Purpose**: Ensures actions complete successfully before creating assertions

### Sequence Execution

When running saved sequences:
- **Automatic Generation**: Expect scripts are generated automatically without prompting
- **Smooth Flow**: The automation runs uninterrupted from start to finish
- **Background Validation**: Scripts are still generated and stored for regression testing
- **Purpose**: Provides a seamless automation experience for production use

## Technical Implementation

The `IntelligentAutomation` class checks the `isRunningSequence` flag to determine behavior:

```typescript
// Interactive mode - asks for approval
if (this.persistBrowser && !this.isRunningSequence && step.action.type !== 'wait') {
  const expectScript = await this.generateExpectScriptWithUserConfirmation(...);
}

// Sequence mode - automatic generation
else if (this.isRunningSequence && step.action.type !== 'wait') {
  const expectScript = await this.feedbackManager.generateExpectScript(...);
}
```

## Workflow Diagram

```
Interactive Mode (Sequential Flow):
┌─────────────┐
│   Execute   │
│   Action    │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────┐
│ Action completes, logs displayed │
└──────┬──────────────────────────┘
       │
       ▼
┌──────────────────┐     Yes    ┌─────────────────┐
│ Was successful?  │───────────▶│ Generate Expect │
│     (y/n)        │            │     Script      │
└────────┬─────────┘            └────────┬────────┘
         │ No                            │
         ▼                               ▼
┌──────────────────┐            ┌─────────────────┐
│ Recovery (r) or  │            │ Approve Script? │
│   Retry (t)?     │            │  (y/n/edit)     │
└──────────────────┘            └─────────────────┘

Sequence Mode (Automatic Flow):
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Execute   │────▶│ Generate Expect  │────▶│  Continue to    │
│   Action    │     │ Script (auto)    │     │   Next Step     │
└─────────────┘     └──────────────────┘     └─────────────────┘
```

## Benefits

1. **Development**: Interactive mode helps developers verify and refine expect scripts
2. **Production**: Sequences run smoothly without interruptions
3. **Regression Testing**: Both modes generate scripts for future validation
4. **Learning**: The system learns from both approved and automatically generated scripts
5. **Recovery**: Failed actions can be immediately addressed through recovery mode 