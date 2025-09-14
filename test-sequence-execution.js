#!/usr/bin/env node

/**
 * Test script to verify sequence execution with argument collection
 */

const axios = require('axios');

async function testSequenceExecution() {
  console.log('🚀 Testing Sequence Execution Flow...\n');

  try {
    // 1. Create a test sequence with arguments
    console.log('1. Creating test sequence with arguments...');
    
    const sequenceData = {
      name: 'Patient Search Sequence',
      originalPrompt: '1. go to {website}\n2. search for patient {patientName}\n3. click on patient record',
      executionResult: {
        success: true,
        script: {
          name: 'Patient Search Sequence',
          description: 'Search for a patient by name',
          url: 'https://www.google.com',
          actions: [
            { type: 'navigate', url: '{website}' },
            { type: 'type', selector: 'input[name="search"]', text: '{patientName}' },
            { type: 'press', key: 'Enter' },
            { type: 'click', selector: '.patient-record' }
          ]
        },
        executionTime: 5000,
        screenshots: [],
        errors: [],
        stepResults: [
          { step: 'go to {website}', success: true, duration: 2000 },
          { step: 'search for patient {patientName}', success: true, duration: 3000 }
        ]
      },
      description: 'Automated patient search with configurable website and patient name',
      category: 'healthcare',
      tags: ['patient', 'search', 'arguments']
    };
    
    await axios.post('http://localhost:3002/api/sequences', sequenceData);
    console.log('✅ Test sequence created with arguments: {website} and {patientName}');
    
    // 2. Test execution with arguments
    console.log('\n2. Testing sequence execution with arguments...');
    
    const executionData = {
      arguments: {
        website: 'https://www.amazon.com',
        patientName: 'John Doe'
      },
      startUrl: 'https://www.amazon.com'
    };
    
    const executionResponse = await axios.post(
      'http://localhost:3002/api/sequences/Patient%20Search%20Sequence/execute',
      executionData
    );
    
    const newSessionId = executionResponse.data.sessionId;
    console.log(`✅ Sequence executed successfully in new session: ${newSessionId}`);
    console.log(`   Arguments substituted: website=${executionData.arguments.website}, patientName=${executionData.arguments.patientName}`);
    
    // 3. Verify session was created
    console.log('\n3. Verifying session creation...');
    
    try {
      const sessionResponse = await axios.get(`http://localhost:3002/api/sessions/${newSessionId}`);
      console.log(`✅ Session verified: ${sessionResponse.data.id}`);
      console.log(`   Status: ${sessionResponse.data.status}`);
      console.log(`   Docker available: ${sessionResponse.data.dockerSession ? 'Yes' : 'No'}`);
    } catch (error) {
      console.log('❌ Session verification failed:', error.response?.status || error.message);
    }
    
    // 4. Test sequence without arguments
    console.log('\n4. Testing simple sequence without arguments...');
    
    const simpleSequence = {
      name: 'Simple Google Search',
      originalPrompt: '1. go to google.com\n2. search for test\n3. screenshot',
      executionResult: {
        success: true,
        script: {
          name: 'Simple Google Search',
          description: 'Basic Google search',
          url: 'https://www.google.com',
          actions: [
            { type: 'navigate', url: 'https://www.google.com' },
            { type: 'type', selector: 'textarea[name="q"]', text: 'test' },
            { type: 'press', key: 'Enter' },
            { type: 'screenshot', name: 'results' }
          ]
        },
        executionTime: 4000,
        screenshots: [],
        errors: [],
        stepResults: [
          { step: 'go to google.com', success: true, duration: 2000 },
          { step: 'search for test', success: true, duration: 2000 }
        ]
      },
      description: 'Simple Google search without arguments',
      category: 'basic',
      tags: ['google', 'search']
    };
    
    await axios.post('http://localhost:3002/api/sequences', simpleSequence);
    console.log('✅ Simple sequence created');
    
    const simpleExecution = await axios.post(
      'http://localhost:3002/api/sequences/Simple%20Google%20Search/execute',
      {}
    );
    
    console.log(`✅ Simple sequence executed in session: ${simpleExecution.data.sessionId}`);
    
    // 5. List all sequences
    console.log('\n5. Current sequences:');
    const sequencesResponse = await axios.get('http://localhost:3002/api/sequences');
    sequencesResponse.data.sequences.forEach(seq => {
      console.log(`   • ${seq.metadata.name} (${seq.script.actions.length} actions)`);
    });
    
    console.log('\n🎉 Sequence execution test completed!');
    console.log('\n💡 Frontend Usage:');
    console.log('   1. Click any sequence in the left sidebar');
    console.log('   2. If arguments required, modal will ask for them');
    console.log('   3. New session will be created automatically');
    console.log('   4. Sequence will execute in that session');
    console.log('   5. Session will auto-select for monitoring');
    
  } catch (error) {
    console.log('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testSequenceExecution().catch(console.error);

