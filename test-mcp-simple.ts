import { MCPClient } from './src/browser/MCPClient';

async function testMCP() {
  console.log('Testing MCP connection...');
  
  const client = new MCPClient();
  
  try {
    // Start the MCP server
    console.log('Starting MCP server...');
    await client.start();
    console.log('MCP server started successfully!');
    
    // List available tools
    console.log('Listing available tools...');
    const toolsList = await client.call('tools/list', {});
    console.log('Available tools:', JSON.stringify(toolsList, null, 2));
    
    // Try to navigate
    console.log('Navigating to example.com...');
    const result = await client.call('browser_navigate', { 
      url: 'https://example.com' 
    });
    console.log('Navigation result:', result);
    
    // Take a screenshot
    console.log('Taking screenshot...');
    const screenshot = await client.call('browser_take_screenshot', {});
    console.log('Screenshot taken!');
    
    // Stop the server
    console.log('Stopping MCP server...');
    await client.stop();
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
    await client.stop();
  }
}

// Run the test
testMCP().catch(console.error); 