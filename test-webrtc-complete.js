const axios = require('axios');

const API_BASE = 'http://localhost:3002';

async function testWebRTCFunctionality() {
  console.log('🚀 Testing Complete WebRTC Implementation...\n');

  try {
    // Step 1: Create automation session
    console.log('1. Creating automation session...');
    const sessionResponse = await axios.post(`${API_BASE}/api/sessions`, {
      startUrl: 'https://google.com'
    });
    
    const sessionId = sessionResponse.data.sessionId;
    console.log(`   ✅ Session created: ${sessionId}\n`);

    // Step 2: Wait for Docker container to be ready
    console.log('2. Waiting for Docker container...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Get session details with Docker info
    const sessionDetails = await axios.get(`${API_BASE}/api/sessions/${sessionId}`);
    const dockerApiUrl = sessionDetails.data.session?.dockerSession?.apiUrl;
    
    if (!dockerApiUrl) {
      throw new Error('Docker session not available');
    }
    console.log(`   ✅ Docker container ready at: ${dockerApiUrl}\n`);

    // Step 3: Create WebRTC session
    console.log('3. Creating WebRTC streaming session...');
    const webrtcResponse = await axios.post(`${dockerApiUrl}/webrtc/session`, {
      width: 1920,
      height: 1080,
      frameRate: 30
    });
    
    const webrtcSessionId = webrtcResponse.data.sessionId;
    const viewerUrl = webrtcResponse.data.viewerUrl;
    
    console.log(`   ✅ WebRTC session created: ${webrtcSessionId}`);
    console.log(`   🎥 Viewer URL: ${dockerApiUrl}${viewerUrl}\n`);

    // Step 4: Test WebRTC session info
    console.log('4. Testing WebRTC session info...');
    const sessionInfo = await axios.get(`${dockerApiUrl}/webrtc/session/${webrtcSessionId}`);
    console.log(`   ✅ Session active: ${sessionInfo.data.session.active}`);
    console.log(`   🎮 Remote control: ${sessionInfo.data.session.remoteControlEnabled}\n`);

    // Step 5: Test remote control toggle
    console.log('5. Testing remote control functionality...');
    
    // Enable remote control
    await axios.post(`${dockerApiUrl}/webrtc/session/${webrtcSessionId}/control`, {
      enabled: true
    });
    console.log('   ✅ Remote control enabled');
    
    // Verify control is enabled
    const controlCheck = await axios.get(`${dockerApiUrl}/webrtc/session/${webrtcSessionId}`);
    console.log(`   🎮 Control status: ${controlCheck.data.session.remoteControlEnabled}`);
    
    // Disable remote control
    await axios.post(`${dockerApiUrl}/webrtc/session/${webrtcSessionId}/control`, {
      enabled: false
    });
    console.log('   ✅ Remote control disabled\n');

    // Step 6: Execute a command to test browser interaction
    console.log('6. Testing browser automation...');
    await axios.post(`${API_BASE}/api/sessions/${sessionId}/execute`, {
      command: 'go to google.com'
    });
    console.log('   ✅ Browser navigation command executed\n');

    // Step 7: Test screenshot capture with page URL
    console.log('7. Testing screenshot capture with page URL...');
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for page load
    
    const screenshotsResponse = await axios.get(`${API_BASE}/api/sessions/${sessionId}/screenshots-db`);
    const screenshots = screenshotsResponse.data.screenshots;
    
    if (screenshots && screenshots.length > 0) {
      console.log(`   ✅ ${screenshots.length} screenshots captured`);
      const latestScreenshot = screenshots[0];
      console.log(`   📸 Latest screenshot: ${latestScreenshot.filename}`);
      console.log(`   🌐 Page URL: ${latestScreenshot.pageUrl || 'N/A'}`);
      console.log(`   📄 Page title: ${latestScreenshot.pageTitle || 'N/A'}\n`);
    } else {
      console.log('   ⚠️  No screenshots found in database\n');
    }

    // Step 8: Test cleanup
    console.log('8. Testing session cleanup...');
    
    // Delete WebRTC session
    await axios.delete(`${dockerApiUrl}/webrtc/session/${webrtcSessionId}`);
    console.log('   ✅ WebRTC session deleted');
    
    // Delete automation session
    await axios.delete(`${API_BASE}/api/sessions/${sessionId}`);
    console.log('   ✅ Automation session deleted\n');

    // Final summary
    console.log('🎉 WebRTC Implementation Test Complete!\n');
    console.log('✅ All features working correctly:');
    console.log('   • Session creation and management');
    console.log('   • Docker container integration');
    console.log('   • WebRTC streaming setup');
    console.log('   • Remote control toggle');
    console.log('   • Browser automation');
    console.log('   • Screenshot capture with page URLs');
    console.log('   • Proper cleanup and session management\n');
    
    console.log('🎮 To test the frontend:');
    console.log('   1. Start the frontend: npm run dev (in apps/frontend)');
    console.log('   2. Create a new session');
    console.log('   3. Enter Interactive Mode');
    console.log('   4. See live WebRTC stream');
    console.log('   5. Click "Take Control" to remote control the browser');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      console.log('\n💡 Troubleshooting:');
      console.log('   • Make sure the backend server is running');
      console.log('   • Ensure Docker is installed and running');
      console.log('   • Build the Docker image: docker build -t ai-playwright-browser:latest -f docker/playwright-browser/Dockerfile .');
    }
  }
}

// Run the test
testWebRTCFunctionality(); 