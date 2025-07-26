# Playwright MCP Server Integration Guide

## What is Playwright MCP Server?

The [Playwright MCP server](https://github.com/microsoft/playwright-mcp) is a Model Context Protocol server that exposes Playwright browser automation capabilities as standardized tools that can be used by AI assistants like Claude, ChatGPT, or your own AI-powered automation.

## Key Benefits

1. **Standardized Interface**: Instead of custom code, use standardized MCP tools
2. **AI-Native**: Designed for AI assistants to control browsers directly
3. **Built-in Safety**: Permission-based system for sensitive actions
4. **Rich Feature Set**: Screenshots, network monitoring, tab management, and more

## Running the MCP Server Locally

### Basic Start
```bash
npx playwright-mcp
```

### With Options
```bash
# Run with specific browser
npx playwright-mcp --browser chromium

# Enable vision capabilities (coordinate-based actions)
npx playwright-mcp --caps=vision

# Enable PDF generation
npx playwright-mcp --caps=pdf

# Run in headed mode (see the browser)
npx playwright-mcp --headed

# Custom port
npx playwright-mcp --port 3100
```

## Available Tools

### Core Browser Actions
- `browser_navigate` - Navigate to URL
- `browser_click` - Click elements
- `browser_type` - Type text
- `browser_press_key` - Press keyboard keys
- `browser_select_option` - Select dropdown options
- `browser_hover` - Hover over elements
- `browser_wait_for` - Wait for conditions

### Page Analysis
- `browser_snapshot` - Get accessibility tree (better than screenshots for AI)
- `browser_take_screenshot` - Take screenshots
- `browser_network_requests` - Get network activity
- `browser_console_logs` - Get console logs

### Tab Management
- `browser_tab_new` - Open new tab
- `browser_tab_list` - List tabs
- `browser_tab_select` - Switch tabs
- `browser_tab_close` - Close tabs

### Advanced Features
- `browser_file_upload` - Upload files
- `browser_handle_dialog` - Handle alerts/confirms
- `browser_pdf_save` - Save as PDF (requires --caps=pdf)

## Integration with Your Current System

### Option 1: Direct Integration

You can use the MCP server directly from your AI prompts instead of your current automation:

**Before (Your System):**
```
🤖 > find patient Test, Mustafa Jr and update status
```

**With MCP Server:**
```
1. Use browser_navigate to go to tracking board
2. Use browser_snapshot to see page structure
3. Use browser_click on patient row
4. Use browser_click on status dropdown
```

### Option 2: Hybrid Approach

Use MCP server for complex interactions while keeping your sequence system:

```typescript
// In your BrowserAutomation class
async executeWithMCP(action: string) {
  // Forward complex actions to MCP server
  const mcpClient = new MCPClient('http://localhost:3000');
  return await mcpClient.execute(action);
}
```

### Option 3: Replace Browser Layer

Replace your `BrowserAutomation` class to use MCP server as backend:

```typescript
class MCPBrowserAutomation implements IBrowserAutomation {
  private mcp: MCPClient;
  
  async click(selector: string) {
    return this.mcp.call('browser_click', {
      element: `Click on ${selector}`,
      ref: selector
    });
  }
  
  async type(selector: string, text: string) {
    return this.mcp.call('browser_type', {
      element: `Type in ${selector}`,
      ref: selector,
      text: text
    });
  }
}
```

## Advantages Over Current System

1. **No Selector Maintenance**: MCP uses accessibility tree and AI understanding
2. **Built-in Recovery**: Handles many failure cases automatically
3. **Permission System**: Safe for production use with approval flows
4. **Network Monitoring**: Built-in request/response tracking
5. **Better AI Integration**: Designed for AI agents from the ground up

## Example Usage

### Login Flow with MCP
```javascript
// 1. Navigate
await mcp.call('browser_navigate', { url: 'https://example.com/login' });

// 2. Get page snapshot
const snapshot = await mcp.call('browser_snapshot');

// 3. Type username
await mcp.call('browser_type', {
  element: 'Username input field',
  ref: 'input[name="username"]',
  text: 'mustafa.boorenie'
});

// 4. Type password
await mcp.call('browser_type', {
  element: 'Password input field',
  ref: 'input[type="password"]',
  text: 'actualPassword123'
});

// 5. Click login
await mcp.call('browser_click', {
  element: 'Login button',
  ref: 'button[type="submit"]'
});
```

## Next Steps

1. **Test MCP Server**: Run `npx playwright-mcp --headed` to see it in action
2. **Compare Performance**: Run same automation with both systems
3. **Gradual Migration**: Start with new features using MCP
4. **API Wrapper**: Create REST API that uses MCP server backend

## Running Both Systems

You can run both your current system and MCP server side-by-side:

- **Port 3000**: Your current Express API
- **Port 3100**: MCP Server (`npx playwright-mcp --port 3100`)
- **Port 3200**: Your future unified API

This allows gradual migration and A/B testing of approaches. 