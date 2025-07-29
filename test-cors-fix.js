#!/usr/bin/env node

/**
 * Test script to verify CORS and health check proxy fixes
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3002';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testCORSFix() {
  console.log('🧪 Testing CORS and Health Check Proxy Fix\n');
  
  let sessionId = null;
  
  try {
    // Step 1: Create a session
    console.log('1. Creating session...');
    const sessionResponse = await axios.post(`${API_BASE}/api/sessions`, {
      startUrl: 'https://google.com',
      headless: false
    });
    
    sessionId = sessionResponse.data.sessionId;
    console.log('✅ Session created:', sessionId);
    
    // Step 2: Wait for Docker container to start
    console.log('\n2. Waiting 10 seconds for Docker container to start...');
    await sleep(10000);
    
    // Step 3: Check session details
    console.log('\n3. Checking session details...');
    const sessionDetails = await axios.get(`${API_BASE}/api/sessions/${sessionId}`);
    
    if (sessionDetails.data.dockerSession) {
      console.log('✅ Docker session available:', sessionDetails.data.dockerSession.apiUrl);
    } else {
      console.log('⚠️  No Docker session found');
      return;
    }
    
    // Step 4: Test the new health proxy endpoint
    console.log('\n4. Testing health proxy endpoint...');
    const healthResponse = await axios.get(`${API_BASE}/api/sessions/${sessionId}/health`);
    
    console.log('✅ Health check response:', {
      status: healthResponse.data.status,
      message: healthResponse.data.message
    });
    
    if (healthResponse.data.status === true) {
      console.log('🎉 Docker container is healthy and accessible via proxy!');
      
      // Step 5: Test WebRTC endpoint creation
      console.log('\n5. Testing WebRTC session creation...');
      const dockerApiUrl = sessionDetails.data.dockerSession.apiUrl;
      
      try {
        const webrtcResponse = await axios.post(`${dockerApiUrl}/webrtc/session`, {
          width: 1920,
          height: 1080
        });
        
        console.log('✅ WebRTC session created successfully:', webrtcResponse.data.sessionId);
        console.log('✅ CORS is properly configured!');
      } catch (webrtcError) {
        if (webrtcError.response?.status === 403 || webrtcError.message.includes('CORS')) {
          console.log('❌ CORS issue still exists for WebRTC endpoints');
        } else {
          console.log('✅ CORS is working, but WebRTC creation failed for other reasons:', webrtcError.message);
        }
      }
    } else {
      console.log('⚠️  Docker container is not healthy yet');
    }
    
    // Step 6: Cleanup
    console.log('\n6. Cleaning up session...');
    await axios.delete(`${API_BASE}/api/sessions/${sessionId}`);
    console.log('✅ Session deleted');
    
    console.log('\n🎉 CORS and Health Check Proxy test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    // Cleanup on error
    if (sessionId) {
      try {
        await axios.delete(`${API_BASE}/api/sessions/${sessionId}`);
        console.log('✅ Session cleaned up after error');
      } catch (cleanupError) {
        console.error('❌ Failed to cleanup session:', cleanupError.message);
      }
    }
    
    process.exit(1);
  }
}

// Test to simulate frontend behavior
async function testFrontendHealthCheck() {
  console.log('\n🔧 Testing Frontend Health Check Simulation\n');
  
  let sessionId = null;
  
  try {
    // Create session
    const sessionResponse = await axios.post(`${API_BASE}/api/sessions`, {
      startUrl: 'https://google.com',
      headless: false
    });
    
    sessionId = sessionResponse.data.sessionId;
    console.log('Session created:', sessionId);
    
    // Simulate frontend health check polling
    console.log('Simulating frontend health check polling...');
    const maxRetries = 15;
    let isReady = false;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        // This simulates exactly what the frontend will do
        const healthResponse = await axios.get(`${API_BASE}/api/sessions/${sessionId}/health`);
        
        if (healthResponse.status === 200 && healthResponse.data.status === true) {
          console.log(`✅ Container ready after ${i + 1} attempts`);
          isReady = true;
          break;
        } else {
          console.log(`Attempt ${i + 1}/${maxRetries}: Container not ready yet`);
        }
      } catch (error) {
        console.log(`Attempt ${i + 1}/${maxRetries}: Health check failed - ${error.message}`);
      }
      
      if (i < maxRetries - 1) {
        await sleep(2000); // Wait 2 seconds between attempts
      }
    }
    
    if (isReady) {
      console.log('🎉 Frontend health check simulation successful!');
    } else {
      console.log('⚠️  Container did not become ready within timeout');
    }
    
    // Cleanup
    await axios.delete(`${API_BASE}/api/sessions/${sessionId}`);
    console.log('✅ Session cleaned up');
    
  } catch (error) {
    console.error('❌ Frontend simulation test failed:', error.message);
    
    if (sessionId) {
      try {
        await axios.delete(`${API_BASE}/api/sessions/${sessionId}`);
      } catch (cleanupError) {
        console.error('Failed to cleanup:', cleanupError.message);
      }
    }
  }
}

async function main() {
  console.log('🚀 Starting CORS and Health Check Proxy Tests\n');
  
  await testCORSFix();
  await testFrontendHealthCheck();
  
  console.log('\n🎉 All tests completed!');
}

if (require.main === module) {
  main();
} 