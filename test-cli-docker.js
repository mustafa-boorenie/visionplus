#!/usr/bin/env node

const { DockerBrowserService } = require('./dist/services/docker-browser.service');
const chalk = require('chalk');

async function testDockerCLI() {
  console.log(chalk.cyan('🐳 Testing Docker CLI Integration...'));
  
  try {
    // Create Docker browser service
    const dockerService = new DockerBrowserService();
    
    console.log(chalk.yellow('📦 Creating Docker browser session...'));
    
    // Create a browser session
    const session = await dockerService.createBrowserSession({
      startUrl: 'https://www.google.com',
      headless: false
    });
    
    console.log(chalk.green(`✅ Docker browser started: ${session.containerId}`));
    console.log(chalk.blue(`🌐 API URL: ${session.apiUrl}`));
    
    // Test basic navigation
    console.log(chalk.yellow('🔗 Testing navigation...'));
    await dockerService.executeAction(session, {
      type: 'navigate',
      url: 'https://www.google.com',
      waitUntil: 'domcontentloaded'
    });
    
    // Get current URL
    const currentUrl = await dockerService.getCurrentUrl(session);
    console.log(chalk.green(`📍 Current URL: ${currentUrl}`));
    
    // Take a screenshot
    console.log(chalk.yellow('📸 Taking screenshot...'));
    const screenshot = await dockerService.takeScreenshot(session, 'test');
    console.log(chalk.green(`📷 Screenshot saved (base64 length: ${screenshot.length})`));
    
    // Clean up
    console.log(chalk.yellow('🧹 Cleaning up...'));
    await dockerService.destroySession(session.containerId);
    
    console.log(chalk.green('✨ Docker CLI integration test completed successfully!'));
    console.log(chalk.cyan('🎉 CLI commands are now using Docker instead of local browser automation.'));
    
  } catch (error) {
    console.error(chalk.red('❌ Test failed:'), error.message);
    console.error(chalk.yellow('💡 Make sure Docker is running and the ai-playwright-browser image is built.'));
    process.exit(1);
  }
}

if (require.main === module) {
  testDockerCLI();
}

module.exports = { testDockerCLI }; 