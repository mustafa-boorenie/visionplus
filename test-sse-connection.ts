import axios from 'axios';
const EventSource = require('eventsource');

const API_BASE_URL = 'http://localhost:3002';

async function testSSEConnection() {
  console.log('🧪 Testing SSE connection...\n');
  
  try {
    // Step 1: Create a session
    console.log('1️⃣ Creating session...');
    const createResponse = await axios.post(`${API_BASE_URL}/api/sessions`, {
      startUrl: 'https://example.com',
      headless: true
    });
    
    const { sessionId } = createResponse.data;
    console.log(`✅ Session created: ${sessionId}\n`);
    
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
        
        // Step 3: Execute a command to trigger events
        console.log('3️⃣ Executing test command...');
        axios.post(`${API_BASE_URL}/api/sessions/${sessionId}/commands`, {
          command: 'Navigate to https://www.google.com'
        }).then(response => {
          console.log('✅ Command executed successfully');
        }).catch(error => {
          console.error('❌ Command failed:', error.response?.data || error.message);
        });
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('❌ SSE error:', error);
      eventSource.close();
    };
    
    // Keep the script running for 10 seconds to receive events
    setTimeout(() => {
      console.log('\n4️⃣ Closing connection...');
      eventSource.close();
      
      // Clean up session
      axios.delete(`${API_BASE_URL}/api/sessions/${sessionId}`)
        .then(() => {
          console.log('✅ Session cleaned up');
          process.exit(0);
        })
        .catch(error => {
          console.error('❌ Failed to clean up session:', error.message);
          process.exit(1);
        });
    }, 10000);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testSSEConnection(); 