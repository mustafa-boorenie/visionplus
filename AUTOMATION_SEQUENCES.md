# Automation Sequences

The AI Playwright Scripter now supports **Automation Sequences** - a powerful feature that allows you to save complete automation sessions from interactive mode for later reuse.

## 🎯 What are Automation Sequences?

Automation Sequences are saved combinations of:
- **Complete Session**: All successful automation commands from your session
- **Original Prompts**: The natural language commands you used
- **Generated Actions**: Combined automation actions from all commands
- **Execution History**: Success rates and performance metrics
- **Metadata**: Tags, categories, and usage statistics

## 🔄 How Session Tracking Works

1. **Start Session**: Begin interactive mode - all commands are tracked
2. **Run Commands**: Execute multiple automation tasks
3. **Save Session**: Use `save <name>` to bundle all successful commands into one sequence
4. **Auto-Clear**: Session is cleared after saving, ready for new commands

## 🚀 Getting Started

### 1. Using Interactive Mode with Sessions

Start interactive mode and run multiple automations:

```bash
npm run ai
```

Then build up a session with multiple commands:
```
🤖 > navigate google.com
🤖 > search for "typescript tutorial"
🤖 > click on images tab
🤖 > take screenshot
🤖 > save tutorial-workflow
```

This will save ALL 4 commands as a single sequence!

### 2. Managing Sessions

View current session status:
```
🤖 > status
```

Clear current session without saving:
```
🤖 > clear
```

View all saved sequences:
```
🤖 > sequences
```

Run a complete saved session:
```
🤖 > run tutorial-workflow
```

Add to an existing sequence:
```
🤖 > navigate stackoverflow.com
🤖 > append tutorial-workflow    # Adds this to the existing sequence
```

## 📋 CLI Commands

### List Sequences
```bash
npm run ai -- sequences --list
```

### View Statistics
```bash
npm run ai -- sequences --stats
```

### Run a Sequence
```bash
npm run ai -- sequences --run <sequence-name>
```

### Delete a Sequence
```bash
npm run ai -- sequences --delete <sequence-name>
```

### Append to Sequence (Interactive Mode Only)
```bash
# Must use interactive mode for appending
npm run ai interactive
🤖 > your new automation command
🤖 > append <sequence-name>
```

### Export/Import Sequences
```bash
# Export sequences to backup
npm run ai -- sequences --export backup.json

# Import sequences from backup
npm run ai -- sequences --import backup.json --overwrite
```

## 💡 Interactive Mode Commands

| Command | Description |
|---------|-------------|
| `save <name>` | Save ALL session commands as a sequence |
| `sequences` | List all saved sequences with details |
| `run <name>` | Execute a saved sequence |
| `append <name>` | Add last successful automation to existing sequence |
| `status` | Show current session and browser status |
| `clear` | Clear current session commands |
| `reset` | Reset browser and clear session |

## 🔄 Building Sequences Incrementally

### Method 1: Session-Based (Multiple Commands at Once)
```bash
🤖 > navigate google.com
🤖 > search for "tutorials"
🤖 > click images tab
🤖 > save base-search-workflow      # Saves all 3 commands
```

### Method 2: Incremental (One Command at a Time)
```bash
🤖 > navigate google.com
🤖 > search for "tutorials"
🤖 > save base-search              # Creates sequence with 2 commands

🤖 > click images tab
🤖 > append base-search            # Adds this command to existing sequence

🤖 > take screenshot
🤖 > append base-search            # Adds another command to sequence
```

### Method 3: Mixed Approach
```bash
🤖 > navigate amazon.com
🤖 > search for "books" 
🤖 > save amazon-search            # Base sequence

# Later session...
🤖 > click first result
🤖 > append amazon-search          # Extend the sequence

# Even later...
🤖 > add to cart
🤖 > append amazon-search          # Further extend
```

## 📊 Sequence Information

Each sequence tracks:

- **Name**: Unique identifier for the sequence
- **Original Prompts**: All commands from the saved session
- **Incremental Growth**: Commands added via append are numbered sequentially
- **Success Rate**: Percentage of successful executions
- **Usage Count**: How many times it's been run
- **Last Used**: When it was last executed or modified
- **Tags & Categories**: Organizational metadata
- **Combined Actions**: All browser actions from session commands

## 🔄 Session Management

### Active Session Tracking
- ✅ **All commands tracked**: Every automation command is recorded
- ✅ **Success/failure status**: Failed commands are excluded from saving
- ✅ **Execution metrics**: Time, screenshots, errors tracked
- ✅ **Auto-numbering**: Commands are numbered in sequence
- ✅ **Append ready**: Last successful command ready to append

### Smart Session Handling
- **Failed commands excluded**: Only successful automations are saved/appended
- **Auto-clear after save**: Session starts fresh after saving (but not after append)
- **Browser reset clears session**: Starting fresh clears tracking
- **Session status display**: See what's currently tracked
- **Append preserves history**: Appending doesn't clear session for further additions

## 🎯 Use Cases

### Building Complex Workflows Incrementally

**Starting Small:**
```bash
🤖 > navigate github.com
🤖 > search for "playwright"
🤖 > save github-search
```

**Adding More Steps:**
```bash
🤖 > click on microsoft/playwright
🤖 > append github-search

🤖 > click on documentation
🤖 > append github-search

🤖 > take screenshot
🤖 > append github-search
```

**Final sequence will run:**
1. Navigate to github.com
2. Search for "playwright"  
3. Click on microsoft/playwright
4. Click on documentation
5. Take screenshot

### Research Workflow Evolution

**Phase 1: Basic Search**
```bash
🤖 > navigate pubmed.ncbi.nlm.nih.gov
🤖 > search for "machine learning"
🤖 > save research-base
```

**Phase 2: Add Article Selection**
```bash
🤖 > click first result
🤖 > append research-base
```

**Phase 3: Add Data Extraction**
```bash
🤖 > scroll to abstract
🤖 > append research-base
🤖 > take screenshot
🤖 > append research-base
```

## 🔍 Advanced Features

### Sequence Evolution
- **Incremental Building**: Start small, grow sequences over time
- **Version History**: Each append creates backup with timestamp
- **Command Numbering**: Appended commands automatically numbered
- **Action Combination**: All browser actions merged seamlessly

### Smart Append Logic
- **Success Validation**: Only successful automations can be appended
- **Duplicate Prevention**: Can't append the same command repeatedly
- **Metadata Updates**: Last modified time updated on append
- **Backup Creation**: Automatic backup before modification

## 🚀 Tips & Best Practices

### Building Effective Sequences

**Start with Core Workflow:**
- Create a base sequence with essential steps
- Test the base sequence thoroughly
- Use descriptive names that indicate it's extendable

**Grow Incrementally:**
- Add one logical step at a time
- Test after each append to ensure sequence still works
- Group related actions together when appending

**Organize by Complexity:**
- `search-simple` → `search-with-filters` → `search-complete`
- `login-basic` → `login-with-2fa` → `login-complete`
- `checkout-guest` → `checkout-member` → `checkout-full`

### Append Strategy
- **Test before appending**: Ensure new automation works standalone
- **Logical flow**: Make sure appended steps follow naturally
- **Error handling**: Append commands that handle edge cases
- **Documentation**: Use descriptive prompts for appended commands

## 🌟 Complete Incremental Example

### Building an E-commerce Testing Suite

**Phase 1: Basic Navigation**
```bash
🤖 > navigate amazon.com
🤖 > search for "wireless headphones"
🤖 > save ecommerce-base
✅ Sequence "ecommerce-base" saved successfully!
   Commands: 2
```

**Phase 2: Add Product Selection**
```bash
🤖 > click first result
🤖 > append ecommerce-base
✅ Successfully appended to sequence "ecommerce-base"!
   Added command: click first result
   Total commands: 3
```

**Phase 3: Add Product Details**
```bash
🤖 > scroll to reviews
🤖 > append ecommerce-base
✅ Successfully appended to sequence "ecommerce-base"!
   Added command: scroll to reviews
   Total commands: 4

🤖 > take screenshot
🤖 > append ecommerce-base
✅ Successfully appended to sequence "ecommerce-base"!
   Added command: take screenshot
   Total commands: 5
```

**Final Sequence:**
```
🤖 > sequences
1. ecommerce-base
   Prompt: 1. navigate amazon.com
           2. search for "wireless headphones"
           3. click first result
           4. scroll to reviews
           5. take screenshot
   Commands: 5
   Success rate: 100%
```

**Running the Complete Workflow:**
```bash
🤖 > run ecommerce-base
# Executes all 5 commands in sequence automatically
```

This incremental approach allows you to build complex, robust automation workflows step by step, testing and refining each addition before moving to the next phase. 