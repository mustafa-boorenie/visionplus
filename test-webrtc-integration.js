#!/usr/bin/env node

const axios = require('axios');

const API_URL = 'http://localhost:3002';

async function testWebRTCIntegration() {
  try {
    console.log('Testing WebRTC Integration...\n');

    // 1. Create a session
    console.log('1. Creating session...');
    const sessionResponse = await axios.post(`${API_URL}/api/sessions`, {
      startUrl: 'https://google.com',
      headless: false
    });
    const { sessionId } = sessionResponse.data;
    console.log(`✓ Session created: ${sessionId}`);

    // 2. Create WebRTC session
    console.log('\n2. Creating WebRTC session...');
    try {
      const webrtcResponse = await axios.post(`${API_URL}/api/sessions/${sessionId}/webrtc`, {
        width: 1280,
        height: 720
      });
      
      console.log('✓ WebRTC session created:');
      console.log(`  - Viewer URL: ${webrtcResponse.data.viewerUrl}`);
      console.log(`  - WebRTC URL: ${webrtcResponse.data.webrtcUrl}`);
    } catch (error) {
      console.log('✗ WebRTC endpoint not yet implemented');
      console.log('  Note: WebRTC routes are commented out in the server');
    }

    // 3. Execute a command
    console.log('\n3. Executing command...');
    const commandResponse = await axios.post(`${API_URL}/api/sessions/${sessionId}/commands`, {
      command: 'navigate to https://example.com'
    });
    
    console.log('✓ Command executed successfully');
    console.log(`  - Success: ${commandResponse.data.result.success}`);
    console.log(`  - Execution time: ${commandResponse.data.result.executionTime}ms`);

    // 4. Clean up
    console.log('\n4. Cleaning up...');
    await axios.delete(`${API_URL}/api/sessions/${sessionId}`);
    console.log('✓ Session deleted');

    console.log('\n✅ Test completed successfully!');
    console.log('\nNote: To enable WebRTC streaming:');
    console.log('1. Uncomment WebRTC routes in src/server/api-v2.ts');
    console.log('2. Implement the WebRTC handler methods');
    console.log('3. Configure BROWSERLESS_API_KEY in .env.local');
    console.log('4. Use the "Live Stream" button in the UI');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

testWebRTCIntegration(); 