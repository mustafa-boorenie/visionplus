# VisionPlus - AI-Powered Browser Automation

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Playwright](https://img.shields.io/badge/Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)](https://playwright.dev/)
[![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com/)

**VisionPlus** is an advanced AI-powered browser automation tool that combines Playwright with OpenAI's GPT and Vision models to create intelligent, self-healing web automation scripts.

## 🚀 Key Features

### 🧠 AI-Powered Automation
- **Natural Language Commands**: Write automation tasks in plain English
- **Vision API Integration**: AI analyzes screenshots when actions fail
- **Smart Error Recovery**: Automatically fixes selector issues and page changes

### 🎯 Precision Targeting
- **Multi-Candidate Selectors**: Each action tries multiple selector strategies
- **Smart Locator System**: Automatic fallback to heuristic element detection
- **Site-Specific Knowledge**: Built-in selectors for Google, Amazon, PubMed, etc.

### 🔄 Browser Persistence
- **Interactive Mode**: Continuous command execution in the same browser session
- **Session Management**: Track duration, command count, and current state
- **Context Preservation**: Maintain cookies, sessions, and page state

### 📚 RAG-Enhanced Intelligence
- **Playwright Documentation Access**: AI has contextual access to Playwright docs
- **Vector Search**: Semantic retrieval of relevant automation patterns
- **Learning System**: Improves selector generation based on documentation

### 🛡️ Advanced Error Handling
- **CAPTCHA Detection**: Automatic detection with user intervention prompts
- **Page Closure Recovery**: Robust handling of browser crashes and timeouts
- **Visual Debugging**: Screenshots and detailed logging for troubleshooting

## 📋 Quick Start

### Prerequisites
- Node.js 18+ 
- OpenAI API key
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/mustafa-boorenie/visionplus.git
cd visionplus

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# Build the project
npm run build
```

### Environment Setup
Create a `.env` file with:
```bash
OPENAI_API_KEY=your_openai_api_key_here
BROWSER_TYPE=chromium
HEADLESS=false
```

## 🎮 Usage

### Single Command Automation
```bash
# Basic automation
npm run ai -- automate -t "Search for weather" -u "https://google.com"

# With browser persistence
npm run ai -- automate -t "Search for laptops" -u "https://amazon.com" -p

# Verbose logging
npm run ai -- automate -t "Fill contact form" -u "https://example.com" -v
```

### Interactive Mode
```bash
# Start interactive session
npm run ai -- interactive

# Then use natural language commands:
🤖 > search for weather
🤖 > click the first result  
🤖 > take a screenshot
🤖 > navigate amazon.com
🤖 > status
🤖 > exit
```

### Special Commands in Interactive Mode
- `status` - Show browser session information
- `navigate <url>` - Go to a specific URL
- `reset` - Close and restart browser
- `help` - Show available commands
- `exit/quit` - Close browser and exit

## 🏗️ Architecture

```
VisionPlus/
├── src/
│   ├── automation/          # Core automation engine
│   │   ├── IntelligentAutomation.ts
│   │   └── TestGenerator.ts
│   ├── browser/             # Browser management
│   │   ├── BrowserAutomation.ts
│   │   └── BrowserManager.ts
│   ├── cli/                 # Command line interface
│   │   ├── intelligent-cli.ts
│   │   └── interactive-mode.ts
│   ├── rag/                 # Retrieval-Augmented Generation
│   │   ├── DocumentProcessor.ts
│   │   ├── VectorStore.ts
│   │   └── index.ts
│   ├── vision/              # Vision API integration
│   │   └── VisionAnalyzer.ts
│   ├── utils/               # Utilities
│   └── types/               # TypeScript definitions
├── docs/                    # Documentation and guides
├── examples/               # Example automation scripts
├── tests/                  # Generated test files
└── scripts/               # Utility scripts
```

## 🧩 Core Components

### Smart Locator System
Instead of relying on a single selector, VisionPlus uses multiple strategies:

```javascript
// Example: Multiple selector candidates for a search box
[
  "input[name='q']",           // Name attribute
  "#search",                   // ID selector  
  "[data-testid='search']",    // Test ID
  "[aria-label*='search' i]", // ARIA label
  "input[type='search']",      // Type attribute
  ".search-input"              // Class selector
]
```

### Vision-Powered Error Recovery
When actions fail, the AI:
1. Takes a screenshot of the current page
2. Analyzes the visual state with GPT-4 Vision
3. Suggests corrected selectors or alternative approaches
4. Detects CAPTCHAs and prompts for manual intervention

### RAG Documentation Access
The system semantically searches Playwright documentation to provide context-aware automation:
- Modern selector recommendations
- Best practices for specific scenarios  
- Site-specific selector patterns

## 📖 Examples

### E-commerce Automation
```bash
npm run ai -- automate -t "Go to Amazon, search for wireless headphones under $100, and add the first result to cart" -u "https://amazon.com"
```

### Form Filling
```bash
npm run ai -- automate -t "Fill out the contact form with name 'John Doe' and email 'john@example.com'" -u "https://example.com/contact"
```

### Research Workflow
```bash
npm run ai -- interactive
🤖 > navigate pubmed.ncbi.nlm.nih.gov
🤖 > search for machine learning in healthcare
🤖 > click on the first article
🤖 > download the PDF if available
🤖 > take a screenshot of the abstract
```

## 🛠️ Advanced Configuration

### Browser Settings
```typescript
// In src/utils/config.ts
export const BROWSER_CONFIG = {
  browserType: 'chromium',
  headless: false,
  viewport: { width: 1280, height: 720 },
  timeout: 30000
};
```

### Custom Site Selectors
Add site-specific selector knowledge in `docs/playwright/`:
```markdown
# Custom Site Selectors

## My App
- Login button: `#login-btn, [data-cy="login"]`
- Search input: `input[name="search"], .search-field`
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Playwright](https://playwright.dev/) for the robust browser automation framework
- [OpenAI](https://openai.com/) for GPT and Vision API capabilities
- [Vectra](https://github.com/Stevenic/vectra) for local vector storage
- The open-source community for inspiration and contributions

## 📞 Support

- 📧 Email: mustafa.boorenie@example.com
- 🐛 Issues: [GitHub Issues](https://github.com/mustafa-boorenie/visionplus/issues)
- 📖 Documentation: [Project Wiki](https://github.com/mustafa-boorenie/visionplus/wiki)

---

**Made with ❤️ by [Mustafa Boorenie](https://github.com/mustafa-boorenie)** 