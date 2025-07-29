#!/usr/bin/env node

/**
 * Test script to debug SSE connection issues
 */

const axios = require('axios');
const EventSource = require('eventsource');

const API_BASE = 'http://localhost:3002';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function debugSSEIssue() {
  console.log('🔍 Debugging SSE Connection Issue\n');
  
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
    console.log('   Response:', JSON.stringify(sessionResponse.data, null, 2));
    
    // Step 2: Immediately check if session exists via debug endpoint
    console.log('\n2. Checking session existence immediately after creation...');
    try {
      const debugResponse = await axios.get(`${API_BASE}/api/sessions/${sessionId}/debug`);
      console.log('✅ Debug response:', JSON.stringify(debugResponse.data, null, 2));
    } catch (debugError) {
      console.log('❌ Debug endpoint failed:', debugError.response?.data || debugError.message);
    }
    
    // Step 3: Try to connect to SSE stream immediately
    console.log('\n3. Attempting SSE connection immediately...');
    await testSSEConnection(sessionId, 'immediate');
    
    // Step 4: Wait a bit and try again
    console.log('\n4. Waiting 5 seconds and trying SSE again...');
    await sleep(5000);
    await testSSEConnection(sessionId, 'after-5s');
    
    // Step 5: Check session details via GET endpoint
    console.log('\n5. Checking session via GET endpoint...');
    try {
      const sessionDetails = await axios.get(`${API_BASE}/api/sessions/${sessionId}`);
      console.log('✅ Session details:', JSON.stringify(sessionDetails.data, null, 2));
    } catch (sessionError) {
      console.log('❌ Session GET failed:', sessionError.response?.data || sessionError.message);
    }
    
    // Step 6: Wait for Docker to be ready and try SSE again
    console.log('\n6. Waiting 10 seconds for Docker and trying SSE again...');
    await sleep(10000);
    await testSSEConnection(sessionId, 'after-docker-ready');
    
    // Step 7: List all sessions to see what's available
    console.log('\n7. Listing all sessions...');
    try {
      const allSessions = await axios.get(`${API_BASE}/api/sessions`);
      console.log('✅ All sessions:', JSON.stringify(allSessions.data, null, 2));
    } catch (listError) {
      console.log('❌ List sessions failed:', listError.response?.data || listError.message);
    }
    
    // Final debug check
    console.log('\n8. Final debug check...');
    try {
      const finalDebug = await axios.get(`${API_BASE}/api/sessions/${sessionId}/debug`);
      console.log('✅ Final debug response:', JSON.stringify(finalDebug.data, null, 2));
    } catch (finalError) {
      console.log('❌ Final debug failed:', finalError.response?.data || finalError.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  } finally {
    // Cleanup
    if (sessionId) {
      console.log(`\n🧹 Cleaning up session ${sessionId}...`);
      try {
        await axios.delete(`${API_BASE}/api/sessions/${sessionId}`);
        console.log('✅ Session deleted');
      } catch (cleanupError) {
        console.log('❌ Cleanup failed:', cleanupError.message);
      }
    }
  }
}

async function testSSEConnection(sessionId, label) {
  return new Promise((resolve) => {
    console.log(`   Attempting SSE connection (${label})...`);
    
    const eventSource = new EventSource(`${API_BASE}/api/sessions/${sessionId}/stream`);
    let connected = false;
    
    const timeout = setTimeout(() => {
      if (!connected) {
        console.log(`   ❌ SSE connection failed (${label}) - timeout`);
        eventSource.close();
        resolve(false);
      }
    }, 5000);
    
    eventSource.onopen = () => {
      connected = true;
      console.log(`   ✅ SSE connection successful (${label})`);
      clearTimeout(timeout);
      eventSource.close();
      resolve(true);
    };
    
    eventSource.onmessage = (event) => {
      console.log(`   📨 SSE message (${label}):`, event.data);
    };
    
    eventSource.onerror = (error) => {
      console.log(`   ❌ SSE error (${label}):`, error.type, error.message || 'Connection failed');
      clearTimeout(timeout);
      eventSource.close();
      resolve(false);
    };
  });
}

async function testSessionLifecycle() {
  console.log('\n🔄 Testing Session Lifecycle...\n');
  
  // Create multiple sessions and see if they stay in memory
  const sessionIds = [];
  
  for (let i = 1; i <= 3; i++) {
    try {
      console.log(`Creating session ${i}...`);
      const response = await axios.post(`${API_BASE}/api/sessions`, {
        startUrl: 'https://google.com',
        headless: false
      });
      sessionIds.push(response.data.sessionId);
      console.log(`✅ Session ${i} created:`, response.data.sessionId);
      
      // Immediately test SSE
      await testSSEConnection(response.data.sessionId, `session-${i}`);
      
      await sleep(2000); // Wait between creations
    } catch (error) {
      console.log(`❌ Failed to create session ${i}:`, error.message);
    }
  }
  
  // Check how many sessions exist
  try {
    const allSessions = await axios.get(`${API_BASE}/api/sessions`);
    console.log(`\n📊 Total sessions after creation: ${allSessions.data.sessions.length}`);
    console.log('Session IDs:', allSessions.data.sessions.map(s => s.id));
  } catch (error) {
    console.log('❌ Failed to list sessions:', error.message);
  }
  
  // Cleanup all sessions
  console.log('\n🧹 Cleaning up all test sessions...');
  for (const sessionId of sessionIds) {
    try {
      await axios.delete(`${API_BASE}/api/sessions/${sessionId}`);
      console.log(`✅ Deleted session: ${sessionId}`);
    } catch (error) {
      console.log(`❌ Failed to delete ${sessionId}:`, error.message);
    }
  }
}

async function main() {
  console.log('🚀 Starting SSE Debug Tests\n');
  
  await debugSSEIssue();
  await testSessionLifecycle();
  
  console.log('\n🎉 SSE Debug tests completed!');
}

if (require.main === module) {
  main().catch(console.error);
} 