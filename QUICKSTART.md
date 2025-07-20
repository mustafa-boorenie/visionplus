# Quick Start Guide - AI Playwright Scripter

Get up and running with intelligent browser automation in 5 minutes!

## 🚀 Installation

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/ai-playwright-scripter.git
cd ai-playwright-scripter

# 2. Install dependencies
npm install

# 3. Set up your OpenAI API key
cp env.example .env
# Edit .env and add your OPENAI_API_KEY
```

## 🎯 Your First Automation

### Option 1: Interactive Mode (Recommended for Beginners)

```bash
npm run ai
```

You'll be prompted:
```
🤖 AI Playwright - Intelligent Web Automation

What would you like to automate? Search for "typescript tutorial" on Google
Starting URL (default: https://www.google.com): [press enter]
```

### Option 2: Direct Command

```bash
npm run ai -- automate -t "Search for typescript tutorial on Google" -u "https://google.com"
```

## 📊 What Happens Next?

Watch as the system:

1. **Breaks down your task** into steps:
   ```
   [1/4] Navigate to https://google.com
   [2/4] Click on search box
   [3/4] Type "typescript tutorial"
   [4/4] Take screenshot of results
   ```

2. **Shows real-time progress**:
   ```
   [1/4] ✓ Completed: Navigate to https://google.com
   Progress: ██████████░░░░░░░░░░░░░░░░░░░ 25%
   ```

3. **Handles errors intelligently**:
   ```
   [2/4] ✗ Failed: Click on search box
   [2/4] 🔍 Analyzing: Using Vision API to find search box
   [2/4] ✓ Completed: Click on search box
   ```

4. **Generates a test** automatically in `tests/generated/`

## 🎨 Try These Examples

### 1. E-commerce Search
```bash
npm run ai -- automate -t "Go to Amazon, search for wireless headphones under $50"
```

### 2. Form Filling
```bash
npm run ai -- automate -t "Fill out the contact form with test data" -u "https://example.com/contact"
```

### 3. Data Extraction
```bash
npm run ai -- automate -t "Get the top 5 news headlines from CNN" -u "https://cnn.com"
```

## 🔍 Explore Features

### View Cached Scripts
```bash
npm run ai -- cache --list
```

### Generate Tests from Cache
```bash
npm run ai -- generate-tests
```

### Run with Detailed Progress
```bash
npm run ai -- automate -t "Your task" -v
```

## 📁 Where to Find Results

- **Screenshots**: `./screenshots/`
- **Reports**: `./reports/` (HTML and JSON)
- **Generated Tests**: `./tests/generated/`
- **Cached Scripts**: `./scripts/cache/`
- **Logs**: `./logs/`

## 🎯 Pro Tips

1. **Be Specific**: "Click the blue 'Submit' button" works better than "Click submit"

2. **Use Natural Language**: Write as if explaining to a person:
   - ✅ "Go to GitHub and search for the playwright repository"
   - ❌ "navigate github.com search playwright"

3. **Check the Cache**: Similar tasks run instantly from cache

4. **Verbose Mode**: Use `-v` flag to see detailed analysis

5. **Test Generation**: Every successful run creates a reusable test

## 🆘 Troubleshooting

### "OPENAI_API_KEY is required"
→ Make sure you've added your API key to the `.env` file

### "Browser not initialized"
→ Run `npx playwright install` to install browsers

### "Step failed after 5 retries"
→ The website might have changed significantly. Try:
- Running with `-v` for details
- Clearing cache: `npm run ai -- cache --clear`
- Checking if the website is accessible

## 🎉 Next Steps

1. **Run More Examples**:
   ```bash
   npm run example:intelligent
   npm run example:advanced
   ```

2. **Explore the API**:
   ```typescript
   import { IntelligentAutomation } from 'ai-playwright-scripter';
   
   const bot = new IntelligentAutomation("Your task here");
   await bot.execute('https://example.com');
   ```

3. **Read the Docs**: Check out README.md for comprehensive documentation

## 💡 Remember

- The AI learns from successful runs
- Failed attempts help improve future executions
- Generated tests can be customized and extended
- Progress logs help debug complex automations

Happy Automating! 🤖✨ 