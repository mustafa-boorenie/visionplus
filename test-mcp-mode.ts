#!/usr/bin/env npx ts-node

/**
 * Test script to demonstrate using MCP backend
 * 
 * Prerequisites:
 * 1. Start MCP server: npx playwright-mcp --headed --port 3100
 * 2. Set environment variable: export USE_MCP_BROWSER=true
 * 3. Run this script: npx ts-node test-mcp-mode.ts
 */

import { InteractiveMode } from './src/cli/interactive-mode';
import { BrowserManager } from './src/browser/BrowserManager';

async function testMCPMode() {
  console.log('🚀 Testing MCP Browser Mode\n');
  
  // Enable MCP mode
  process.env.USE_MCP_BROWSER = 'true';
  
  const manager = BrowserManager.getInstance();
  console.log(`Mode: ${manager.isMCPMode() ? 'MCP' : 'Direct'}`);
  
  try {
    // Get browser (will use MCP backend)
    const browser = await manager.getBrowser();
    console.log('✅ Browser initialized with MCP backend');
    
    // Test navigation
    await browser.executeAction({ 
      type: 'navigate', 
      url: 'https://www.google.com' 
    });
    console.log('✅ Navigated to Google');
    
    // Test typing
    await browser.executeAction({
      type: 'type',
      selector: 'textarea[name="q"]',
      text: 'Playwright MCP server'
    });
    console.log('✅ Typed search query');
    
    // Test screenshot
    await browser.executeAction({
      type: 'screenshot',
      name: 'mcp-test-google'
    });
    console.log('✅ Took screenshot');
    
    // Test wait
    await browser.executeAction({
      type: 'wait',
      duration: 2000
    });
    console.log('✅ Waited 2 seconds');
    
    // Get status
    const status = manager.getSessionStatus();
    console.log('\n📊 Session Status:');
    console.log(`   Active: ${status.isActive}`);
    console.log(`   Mode: ${status.mode}`);
    console.log(`   Duration: ${status.sessionDuration}`);
    console.log(`   Commands: ${status.commandCount}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Alternative: Start interactive mode with MCP
async function startInteractiveMCP() {
  process.env.USE_MCP_BROWSER = 'true';
  
  console.log('Starting Interactive Mode with MCP Backend...\n');
  console.log('Commands will be executed through the MCP server.');
  console.log('Make sure MCP server is running: npx playwright-mcp --headed --port 3100\n');
  
  const interactive = new InteractiveMode();
  await interactive.start();
}

// Check command line args
if (process.argv.includes('--interactive')) {
  startInteractiveMCP();
} else {
  testMCPMode();
} 