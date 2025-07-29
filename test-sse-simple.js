#!/usr/bin/env node

/**
 * Simple SSE connection test
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3002';

async function testSSEFix() {
  console.log('🔍 Quick SSE Connection Test\n');
  
  try {
    // 1. Create session
    console.log('Creating session...');
    const response = await axios.post(`${API_BASE}/api/sessions`, {
      startUrl: 'https://google.com',
      headless: false
    });
    
    const sessionId = response.data.sessionId;
    console.log('✅ Session created:', sessionId);
    
    // 2. Immediately check debug info
    console.log('\nChecking session debug info...');
    const debugResponse = await axios.get(`${API_BASE}/api/sessions/${sessionId}/debug`);
    console.log('Debug info:', JSON.stringify(debugResponse.data, null, 2));
    
    // 3. Try SSE connection
    console.log('\nTesting SSE connection...');
    const EventSource = require('eventsource');
    
    return new Promise((resolve) => {
      const eventSource = new EventSource(`${API_BASE}/api/sessions/${sessionId}/stream`);
      let connected = false;
      
      const timeout = setTimeout(() => {
        if (!connected) {
          console.log('❌ SSE connection timed out');
          eventSource.close();
          resolve(false);
        }
      }, 10000);
      
      eventSource.onopen = () => {
        connected = true;
        console.log('✅ SSE connection successful!');
        clearTimeout(timeout);
        eventSource.close();
        
        // Cleanup session
        axios.delete(`${API_BASE}/api/sessions/${sessionId}`)
          .then(() => console.log('✅ Session cleaned up'))
          .catch(err => console.log('⚠️ Cleanup failed:', err.message))
          .finally(() => resolve(true));
      };
      
      eventSource.onmessage = (event) => {
        console.log('📨 SSE message:', event.data);
      };
      
      eventSource.onerror = (error) => {
        console.log('❌ SSE error:', error.type);
        clearTimeout(timeout);
        eventSource.close();
        
        // Check if it's a 404 error specifically
        if (error.status === 404) {
          console.log('🔍 404 error - session not found in memory');
        }
        
        // Cleanup session
        axios.delete(`${API_BASE}/api/sessions/${sessionId}`)
          .then(() => console.log('✅ Session cleaned up'))
          .catch(err => console.log('⚠️ Cleanup failed:', err.message))
          .finally(() => resolve(false));
      };
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Testing SSE Fix\n');
  
  const success = await testSSEFix();
  
  if (success) {
    console.log('\n🎉 SSE fix verified - connections working!');
  } else {
    console.log('\n💥 SSE still has issues - needs more investigation');
  }
}

if (require.main === module) {
  main().catch(console.error);
} 