#!/usr/bin/env node

/**
 * Test script to verify sequence builder functionality
 */

const axios = require('axios');

async function testSequenceBuilder() {
  console.log('🔧 Testing Sequence Builder...\n');

  try {
    // 1. Create a test session
    console.log('1. Creating test session...');
    const sessionResponse = await axios.post('http://localhost:3002/api/sessions', {
      startUrl: 'https://www.google.com'
    });
    
    const sessionId = sessionResponse.data.sessionId;
    console.log(`✅ Created session: ${sessionId}`);
    
    // Wait for container to be ready
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 2. Execute some test commands
    console.log('\n2. Executing test commands...');
    
    const commands = [
      'go to google.com',
      'search for laptops',
      'screenshot'
    ];
    
    for (const command of commands) {
      try {
        console.log(`   Executing: ${command}`);
        const result = await axios.post(`http://localhost:3002/api/sessions/${sessionId}/commands`, {
          command
        }, { timeout: 30000 });
        
        if (result.data.result?.success) {
          console.log(`   ✅ Success: ${command}`);
        } else {
          console.log(`   ❌ Failed: ${command} - ${result.data.result?.error}`);
        }
        
        // Wait between commands
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.log(`   ❌ Error: ${command} - ${error.message}`);
      }
    }
    
    // 3. Get command history
    console.log('\n3. Getting command history...');
    const historyResponse = await axios.get(`http://localhost:3002/api/sessions/${sessionId}/commands`);
    const history = historyResponse.data.history;
    
    console.log(`✅ Found ${history.length} commands in history`);
    history.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.command} - ${item.result.success ? 'SUCCESS' : 'FAILED'}`);
    });
    
    // 4. Create a sequence from successful commands
    console.log('\n4. Creating sequence from command history...');
    
    const successfulCommands = history.filter(item => item.result.success);
    if (successfulCommands.length === 0) {
      console.log('❌ No successful commands to create sequence from');
      return;
    }
    
    // Combine all actions from successful commands
    const allActions = successfulCommands.flatMap(cmd => cmd.result.script.actions);
    
    // Create the original prompt
    const originalPrompt = successfulCommands
      .map((cmd, index) => `${index + 1}. ${cmd.command}`)
      .join('\n');
    
    const sequenceData = {
      name: 'Test Sequence from Session',
      originalPrompt,
      executionResult: {
        success: true,
        script: {
          name: 'Test Sequence from Session',
          description: 'Auto-generated from session commands',
          url: 'https://www.google.com',
          actions: allActions
        },
        executionTime: successfulCommands.reduce((sum, cmd) => sum + cmd.result.executionTime, 0),
        screenshots: [],
        errors: [],
        stepResults: successfulCommands.map(cmd => ({
          step: cmd.command,
          success: true,
          duration: cmd.result.executionTime
        }))
      },
      description: `Auto-generated sequence with ${successfulCommands.length} commands`,
      category: 'test',
      tags: ['automated', 'test']
    };
    
    try {
      const sequenceResponse = await axios.post('http://localhost:3002/api/sequences', sequenceData);
      console.log(`✅ Sequence created successfully: ${sequenceData.name}`);
      console.log(`   Actions: ${allActions.length}`);
      console.log(`   Total execution time: ${sequenceData.executionResult.executionTime}ms`);
    } catch (error) {
      console.log('❌ Failed to create sequence:', error.response?.data || error.message);
    }
    
    // 5. List sequences to verify
    console.log('\n5. Verifying sequence was saved...');
    const sequencesResponse = await axios.get('http://localhost:3002/api/sequences');
    const sequences = sequencesResponse.data.sequences;
    
    const testSequence = sequences.find(seq => seq.metadata.name === 'Test Sequence from Session');
    if (testSequence) {
      console.log('✅ Sequence found in sequences list');
      console.log(`   Description: ${testSequence.metadata.description}`);
      console.log(`   Actions: ${testSequence.script.actions.length}`);
    } else {
      console.log('❌ Sequence not found in sequences list');
    }
    
    // 6. Cleanup
    console.log('\n6. Cleaning up...');
    try {
      await axios.delete(`http://localhost:3002/api/sessions/${sessionId}`);
      console.log('✅ Test session cleaned up');
      
      if (testSequence) {
        await axios.delete(`http://localhost:3002/api/sequences/Test Sequence from Session`);
        console.log('✅ Test sequence cleaned up');
      }
    } catch (error) {
      console.log('⚠️  Cleanup failed:', error.message);
    }
    
    console.log('\n🎉 Sequence builder test completed successfully!');
    console.log('\n💡 How to use in frontend:');
    console.log('   1. Create a session and execute some commands');
    console.log('   2. Click "Build Sequence" button');
    console.log('   3. Select which commands to include');
    console.log('   4. Give it a name and description');
    console.log('   5. Click "Create Sequence"');
    console.log('   6. Use the sequence later by clicking it in the sidebar');
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

// Run the test
testSequenceBuilder().catch(console.error);

