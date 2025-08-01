#!/usr/bin/env node

const axios = require('axios');

const BASE_URL = 'http://localhost:3002';

async function testSessionRestoration() {
  console.log('🔄 Testing session restoration functionality...\n');

  try {
    // 1. Create a new session
    console.log('1️⃣ Creating new session...');
    const createResponse = await axios.post(`${BASE_URL}/api/sessions`, {
      startUrl: 'https://example.com',
      headless: false
    });
    
    const sessionId = createResponse.data.sessionId;
    console.log(`✅ Session created: ${sessionId}`);
    
    // 2. Wait for Docker container to be created and database to be updated
    console.log('\n2️⃣ Waiting for Docker container setup and database update...');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // 3. Check current sessions
    console.log('\n3️⃣ Checking current sessions...');
    let sessionsResponse = await axios.get(`${BASE_URL}/api/sessions`);
    let session = sessionsResponse.data.sessions.find(s => s.id === sessionId);
    
    if (session) {
      console.log('📋 Current session details:');
      console.log(`   - ID: ${session.id}`);
      console.log(`   - Docker Available: ${session.dockerAvailable}`);
      console.log(`   - Docker Container ID: ${session.dockerContainerId || 'Not stored'}`);
      console.log(`   - Docker Port: ${session.dockerPort || 'Not stored'}`);
      console.log(`   - Docker API URL: ${session.dockerApiUrl || 'Not stored'}`);
    }
    
    // 4. Simulate server restart by checking what happens when sessions are reloaded
    console.log('\n4️⃣ Testing session restoration after server restart...');
    console.log('   (The server should restore sessions from database on next restart)');
    
    // 5. Check Docker containers that are running
    console.log('\n5️⃣ Checking running Docker containers...');
    // We can't run docker commands from Node.js directly, but we can check the API
    try {
      if (session?.dockerApiUrl) {
        const healthResponse = await axios.get(`${session.dockerApiUrl}/health`);
        console.log(`✅ Container ${session.dockerContainerId} is accessible at ${session.dockerApiUrl}`);
        console.log(`   Health status: ${healthResponse.data.status}`);
      } else {
        console.log('❌ No Docker API URL available to test');
      }
    } catch (error) {
      console.log(`❌ Container health check failed: ${error.message}`);
    }
    
    // 6. Test WebRTC proxy functionality
    if (session?.dockerAvailable) {
      console.log('\n6️⃣ Testing WebRTC proxy functionality...');
      try {
        const webrtcResponse = await axios.post(`${BASE_URL}/api/sessions/${sessionId}/webrtc/proxy`);
        console.log(`✅ WebRTC proxy works: ${webrtcResponse.status === 200 ? 'OK' : 'Failed'}`);
        
        // Test if session activity is being updated
        await new Promise(resolve => setTimeout(resolve, 2000));
        const updatedSessionsResponse = await axios.get(`${BASE_URL}/api/sessions`);
        const updatedSession = updatedSessionsResponse.data.sessions.find(s => s.id === sessionId);
        
        if (updatedSession) {
          console.log(`✅ Session activity updated: ${new Date(updatedSession.lastActivity).toLocaleTimeString()}`);
        }
        
      } catch (error) {
        console.log(`❌ WebRTC proxy failed: ${error.response?.status || error.message}`);
      }
    }
    
    console.log('\n✅ Session restoration test completed!');
    console.log('📝 Next step: Restart the server to see if the session is properly restored');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testSessionRestoration(); 