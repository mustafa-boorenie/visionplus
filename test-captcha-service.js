#!/usr/bin/env node

/**
 * Quick test script to verify CAPTCHA service is working
 */

const axios = require('axios');

async function testCaptchaService() {
  console.log('🔍 Testing CAPTCHA Service...\n');

  try {
    // 1. Test Anti-Captcha API connectivity
    console.log('1. Testing Anti-Captcha API connectivity...');
    
    const apiKey = process.env.ANTI_CAPTCHA_KEY;
    if (!apiKey) {
      console.log('❌ ANTI_CAPTCHA_KEY not set in environment');
      console.log('💡 Set it with: export ANTI_CAPTCHA_KEY=your_api_key');
      return;
    }

    try {
      const balanceResponse = await axios.post('https://api.anti-captcha.com/getBalance', {
        clientKey: apiKey
      }, { timeout: 10000 });

      if (balanceResponse.data.errorId > 0) {
        console.log(`❌ Anti-Captcha API Error: ${balanceResponse.data.errorCode}`);
        console.log(`   Description: ${balanceResponse.data.errorDescription}`);
        return;
      }

      const balance = balanceResponse.data.balance;
      console.log(`✅ Anti-Captcha API connected successfully`);
      console.log(`💰 Account balance: $${balance}`);
      
      if (balance < 0.01) {
        console.log('⚠️  Warning: Low balance, CAPTCHA solving may fail');
      }
    } catch (error) {
      console.log('❌ Failed to connect to Anti-Captcha API:', error.message);
      return;
    }

    // 2. Test Docker container CAPTCHA detection
    console.log('\n2. Testing Docker container CAPTCHA detection...');
    
    // Check if backend server is running
    try {
      const healthResponse = await axios.get('http://localhost:3002/health', { timeout: 5000 });
      console.log(`✅ Backend server is running (${healthResponse.data.activeSessions} active sessions)`);
    } catch (error) {
      console.log('❌ Backend server not running. Start with: npm run server:dev');
      return;
    }

    // Create a test session
    console.log('Creating test session...');
    const sessionResponse = await axios.post('http://localhost:3002/api/sessions', {
      startUrl: 'https://www.google.com/recaptcha/api2/demo'
    }, { timeout: 30000 });

    const sessionId = sessionResponse.data.sessionId;
    console.log(`✅ Created test session: ${sessionId}`);
    console.log(`🐳 Docker container: ${sessionResponse.data.dockerAvailable ? 'Available' : 'Not Available'}`);

    if (!sessionResponse.data.dockerAvailable) {
      console.log('❌ Docker container not available');
      return;
    }

    // Wait for container to be ready
    console.log('Waiting for container to be ready...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Test navigation to CAPTCHA demo page
    console.log('Navigating to reCAPTCHA demo page...');
    try {
      const navResponse = await axios.post(`http://localhost:3002/api/sessions/${sessionId}/commands`, {
        command: 'go to https://www.google.com/recaptcha/api2/demo'
      }, { timeout: 30000 });

      if (navResponse.data.result.success) {
        console.log('✅ Successfully navigated to CAPTCHA demo page');
      } else {
        console.log('❌ Navigation failed:', navResponse.data.result.error);
      }
    } catch (error) {
      console.log('❌ Navigation request failed:', error.message);
    }

    // Test screenshot capability
    console.log('Testing screenshot capability...');
    try {
      const screenshotResponse = await axios.post(`http://localhost:3002/api/sessions/${sessionId}/commands`, {
        command: 'screenshot'
      }, { timeout: 15000 });

      if (screenshotResponse.data.result.success) {
        console.log('✅ Screenshot captured successfully');
      } else {
        console.log('❌ Screenshot failed:', screenshotResponse.data.result.error);
      }
    } catch (error) {
      console.log('❌ Screenshot request failed:', error.message);
    }

    // Cleanup
    console.log('Cleaning up test session...');
    try {
      await axios.delete(`http://localhost:3002/api/sessions/${sessionId}`, { timeout: 10000 });
      console.log('✅ Test session cleaned up');
    } catch (error) {
      console.log('⚠️  Failed to cleanup session:', error.message);
    }

    console.log('\n🎉 CAPTCHA service test completed!');
    console.log('\n💡 Next steps:');
    console.log('   - Ensure ANTI_CAPTCHA_KEY has sufficient balance');
    console.log('   - Test with real CAPTCHA pages');
    console.log('   - Monitor logs during CAPTCHA solving');

  } catch (error) {
    console.log('❌ Test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Check if Docker is running: docker version');
    console.log('   2. Check if backend is running: curl http://localhost:3002/health');
    console.log('   3. Check environment variables: echo $ANTI_CAPTCHA_KEY');
    console.log('   4. Check Docker image exists: docker images | grep ai-playwright-browser');
  }
}

// Run the test
testCaptchaService().catch(console.error);
