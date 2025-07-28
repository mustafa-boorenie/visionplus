import axios from 'axios';
// @ts-ignore
const { EventSource } = require('eventsource');

const API_BASE_URL = 'http://localhost:3002';

async function testSSEWithoutDocker() {
  console.log('🧪 Testing SSE connection without Docker...\n');
  
  try {
    // First, let's create a mock session by directly calling the API
    // We'll bypass the Docker container creation for now
    console.log('1️⃣ Creating mock session...');
    
    // Create session with a special flag to skip Docker
    const sessionData = {
      id: 'test-session-' + Date.now(),
      createdAt: new Date(),
      lastActivity: new Date(),
      status: 'idle',
      startUrl: 'https://example.com'
    };
    
    // For now, let's just test the SSE endpoint with a manual session ID
    const sessionId = sessionData.id;
    
    // Create the test session in the server
    await axios.post(`${API_BASE_URL}/api/test/sessions`, {
      sessionId: sessionId
    });
    
    console.log(`✅ Using test session: ${sessionId}\n`);
    
    // Step 2: Connect to SSE
    console.log('2️⃣ Connecting to SSE stream...');
    const eventSource = new EventSource(`${API_BASE_URL}/api/sessions/${sessionId}/stream`);
    
    eventSource.onopen = () => {
      console.log('✅ SSE connection opened\n');
    };
    
    eventSource.onmessage = (event) => {
      console.log('📨 Received message:', event.data);
      const data = JSON.parse(event.data);
      
      if (data.type === 'connected') {
        console.log('✅ Successfully connected to session stream\n');
        console.log('3️⃣ Test completed successfully!');
        
        setTimeout(() => {
          eventSource.close();
          console.log('\n✅ SSE connection test passed!');
          process.exit(0);
        }, 2000);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('❌ SSE error:', error);
      if (error.message) {
        console.error('Error details:', error.message);
      }
      eventSource.close();
      process.exit(1);
    };
    
    // Timeout after 10 seconds
    setTimeout(() => {
      console.log('\n⏱️ Test timeout - closing connection...');
      eventSource.close();
      process.exit(1);
    }, 10000);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testSSEWithoutDocker(); 