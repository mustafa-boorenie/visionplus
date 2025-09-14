#!/usr/bin/env node

/**
 * Test script to verify WebRTC session isolation
 */

const axios = require('axios');

async function testSessionIsolation() {
  console.log('🔍 Testing WebRTC Session Isolation...\n');

  try {
    // Create two test sessions
    console.log('1. Creating two test sessions...');
    
    const session1Response = await axios.post('http://localhost:3002/api/sessions', {
      startUrl: 'https://www.google.com'
    });
    
    const session2Response = await axios.post('http://localhost:3002/api/sessions', {
      startUrl: 'https://www.amazon.com'
    });
    
    const session1Id = session1Response.data.sessionId;
    const session2Id = session2Response.data.sessionId;
    const port1 = session1Response.data.containerPort;
    const port2 = session2Response.data.containerPort;
    
    console.log(`✅ Session 1: ${session1Id} on port ${port1}`);
    console.log(`✅ Session 2: ${session2Id} on port ${port2}`);
    
    // Wait for containers to be ready
    console.log('\n2. Waiting for containers to be ready...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Test container health
    try {
      const health1 = await axios.get(`http://localhost:${port1}/health`);
      const health2 = await axios.get(`http://localhost:${port2}/health`);
      console.log(`✅ Container 1 health: ${health1.data.status}`);
      console.log(`✅ Container 2 health: ${health2.data.status}`);
    } catch (error) {
      console.log('❌ Container health check failed:', error.message);
      return;
    }
    
    // Test navigation in each session
    console.log('\n3. Testing navigation in each session...');
    
    try {
      const nav1 = await axios.post(`http://localhost:3002/api/sessions/${session1Id}/commands`, {
        command: 'go to google.com'
      }, { timeout: 20000 });
      
      const nav2 = await axios.post(`http://localhost:3002/api/sessions/${session2Id}/commands`, {
        command: 'go to amazon.com'
      }, { timeout: 20000 });
      
      console.log(`✅ Session 1 navigation: ${nav1.data.result?.success ? 'SUCCESS' : 'FAILED'}`);
      console.log(`✅ Session 2 navigation: ${nav2.data.result?.success ? 'SUCCESS' : 'FAILED'}`);
    } catch (error) {
      console.log('❌ Navigation test failed:', error.message);
    }
    
    // Test WebSocket connections
    console.log('\n4. Testing WebSocket session isolation...');
    
    const WebSocket = require('ws');
    
    const ws1 = new WebSocket(`ws://localhost:${port1}/stream/websocket/${session1Id}`);
    const ws2 = new WebSocket(`ws://localhost:${port2}/stream/websocket/${session2Id}`);
    
    let frames1 = 0;
    let frames2 = 0;
    let crossTalk = 0;
    
    ws1.on('open', () => {
      console.log(`🔌 WebSocket 1 connected for session ${session1Id}`);
      ws1.send(JSON.stringify({ type: 'start_stream' }));
    });
    
    ws2.on('open', () => {
      console.log(`🔌 WebSocket 2 connected for session ${session2Id}`);
      ws2.send(JSON.stringify({ type: 'start_stream' }));
    });
    
    ws1.on('message', (data) => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'frame') {
          frames1++;
          if (parsed.sessionId && parsed.sessionId !== session1Id) {
            crossTalk++;
            console.log(`❌ Cross-talk detected! WS1 received frame from session ${parsed.sessionId}`);
          }
        }
      } catch (e) {}
    });
    
    ws2.on('message', (data) => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'frame') {
          frames2++;
          if (parsed.sessionId && parsed.sessionId !== session2Id) {
            crossTalk++;
            console.log(`❌ Cross-talk detected! WS2 received frame from session ${parsed.sessionId}`);
          }
        }
      } catch (e) {}
    });
    
    // Test for 10 seconds
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    console.log(`\n📊 Streaming Test Results:`);
    console.log(`   Session 1 frames: ${frames1}`);
    console.log(`   Session 2 frames: ${frames2}`);
    console.log(`   Cross-talk incidents: ${crossTalk}`);
    
    if (crossTalk === 0) {
      console.log('✅ Session isolation working correctly - no cross-talk detected');
    } else {
      console.log('❌ Session isolation broken - cross-talk detected');
    }
    
    // Cleanup
    ws1.close();
    ws2.close();
    
    console.log('\n5. Cleaning up test sessions...');
    
    try {
      await axios.delete(`http://localhost:3002/api/sessions/${session1Id}`);
      await axios.delete(`http://localhost:3002/api/sessions/${session2Id}`);
      console.log('✅ Test sessions cleaned up');
    } catch (error) {
      console.log('⚠️  Failed to cleanup test sessions:', error.message);
    }
    
    console.log('\n🎉 Session isolation test completed!');
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

// Run the test
testSessionIsolation().catch(console.error);

