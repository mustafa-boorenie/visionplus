import axios from 'axios';

const API_BASE_URL = 'http://localhost:3002';

async function testDockerSession() {
  console.log('🧪 Testing Docker-based session management...\n');
  
  try {
    // Step 1: Create a new session
    console.log('1️⃣ Creating new session...');
    const createResponse = await axios.post(`${API_BASE_URL}/api/sessions`, {
      startUrl: 'https://example.com',
      headless: true
    });
    
    const { sessionId, containerPort } = createResponse.data;
    console.log(`✅ Session created: ${sessionId}`);
    console.log(`📦 Container port: ${containerPort}\n`);
    
    // Step 2: Get session info
    console.log('2️⃣ Getting session info...');
    const sessionResponse = await axios.get(`${API_BASE_URL}/api/sessions/${sessionId}`);
    console.log(`✅ Session status: ${sessionResponse.data.status}`);
    console.log(`🌐 Current URL: ${sessionResponse.data.currentUrl}\n`);
    
    // Step 3: Execute a command
    console.log('3️⃣ Executing navigation command...');
    const commandResponse = await axios.post(`${API_BASE_URL}/api/sessions/${sessionId}/commands`, {
      command: 'Navigate to https://www.google.com'
    });
    console.log(`✅ Command executed: ${commandResponse.data.commandId}\n`);
    
    // Step 4: Take a screenshot
    console.log('4️⃣ Taking screenshot...');
    const screenshotResponse = await axios.post(`${API_BASE_URL}/api/sessions/${sessionId}/commands`, {
      command: 'Take a screenshot'
    });
    console.log(`✅ Screenshot taken\n`);
    
    // Step 5: Delete session
    console.log('5️⃣ Deleting session...');
    await axios.delete(`${API_BASE_URL}/api/sessions/${sessionId}`);
    console.log(`✅ Session deleted and container stopped\n`);
    
    console.log('🎉 All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (axios.isAxiosError(error)) {
      console.error('Response:', error.response?.data);
    }
    process.exit(1);
  }
}

// Run the test
testDockerSession(); 