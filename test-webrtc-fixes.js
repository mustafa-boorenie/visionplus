#!/usr/bin/env node

/**
 * Test script to verify WebRTC and session cleanup fixes
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3002';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testSessionCreation() {
  console.log('🧪 Testing session creation...');
  
  try {
    const response = await axios.post(`${API_BASE}/api/sessions`, {
      startUrl: 'https://google.com',
      headless: false
    });
    
    console.log('✅ Session created:', response.data.sessionId);
    return response.data.sessionId;
  } catch (error) {
    console.error('❌ Session creation failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testSessionStatus(sessionId) {
  console.log('🧪 Testing session status and Docker session info...');
  
  try {
    const response = await axios.get(`${API_BASE}/api/sessions/${sessionId}`);
    const data = response.data;
    
    console.log('✅ Session status:', data.status);
    console.log('✅ Docker session available:', !!data.dockerSession);
    
    if (data.dockerSession) {
      console.log('✅ Docker API URL:', data.dockerSession.apiUrl);
      return data.dockerSession.apiUrl;
    } else {
      console.log('⚠️  Docker session not available in response');
      return null;
    }
  } catch (error) {
    console.error('❌ Session status check failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testDockerHealth(dockerApiUrl) {
  if (!dockerApiUrl) return false;
  
  console.log('🧪 Testing Docker container health...');
  
  try {
    const response = await axios.get(`${dockerApiUrl}/health`, { timeout: 5000 });
    
    if (response.data.status === 'ok') {
      console.log('✅ Docker container is healthy');
      return true;
    } else {
      console.log('⚠️  Docker container status:', response.data.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Docker health check failed:', error.message);
    return false;
  }
}

async function testWebRTCEndpoints(dockerApiUrl) {
  if (!dockerApiUrl) return;
  
  console.log('🧪 Testing WebRTC endpoints...');
  
  try {
    // Test WebRTC session creation
    const response = await axios.post(`${dockerApiUrl}/webrtc/session`, {
      width: 1920,
      height: 1080
    });
    
    console.log('✅ WebRTC session created:', response.data.sessionId);
    return response.data.sessionId;
  } catch (error) {
    console.error('❌ WebRTC session creation failed:', error.response?.data || error.message);
    return null;
  }
}

async function testSessionCleanup() {
  console.log('🧪 Testing session cleanup...');
  
  try {
    const response = await axios.post(`${API_BASE}/api/sessions/clear-inactive`);
    
    console.log('✅ Session cleanup completed:');
    console.log('  - Active sessions cleaned:', response.data.deletedCount);
    console.log('  - Database sessions cleaned:', response.data.databaseCleanedCount);
    console.log('  - Message:', response.data.message);
  } catch (error) {
    console.error('❌ Session cleanup failed:', error.response?.data || error.message);
  }
}

async function testSessionDeletion(sessionId) {
  console.log('🧪 Testing session deletion...');
  
  try {
    await axios.delete(`${API_BASE}/api/sessions/${sessionId}`);
    console.log('✅ Session deleted successfully');
  } catch (error) {
    console.error('❌ Session deletion failed:', error.response?.data || error.message);
  }
}

async function main() {
  console.log('🚀 Starting WebRTC and Session Cleanup Tests\n');
  
  let sessionId = null;
  
  try {
    // Test 1: Create session
    sessionId = await testSessionCreation();
    console.log();
    
    // Test 2: Wait for session to be ready and check Docker session info
    console.log('⏳ Waiting 10 seconds for Docker container to start...');
    await sleep(10000);
    
    const dockerApiUrl = await testSessionStatus(sessionId);
    console.log();
    
    // Test 3: Check Docker health
    const isHealthy = await testDockerHealth(dockerApiUrl);
    console.log();
    
    // Test 4: Test WebRTC endpoints (if Docker is healthy)
    if (isHealthy) {
      await testWebRTCEndpoints(dockerApiUrl);
      console.log();
    }
    
    // Test 5: Test session cleanup
    await testSessionCleanup();
    console.log();
    
    // Test 6: Delete session
    if (sessionId) {
      await testSessionDeletion(sessionId);
    }
    
    console.log('🎉 All tests completed!');
    
  } catch (error) {
    console.error('💥 Test suite failed:', error.message);
    
    // Cleanup on failure
    if (sessionId) {
      try {
        await testSessionDeletion(sessionId);
      } catch (cleanupError) {
        console.error('Failed to cleanup session:', cleanupError.message);
      }
    }
    
    process.exit(1);
  }
}

if (require.main === module) {
  main();
} 