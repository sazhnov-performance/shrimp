// Test the executor module directly
const path = require('path');

// Import the executor (this is a CommonJS test, so we'll use dynamic import)
async function testExecutor() {
  console.log('Testing executor module...');
  
  try {
    // Dynamically import the ES module
    const { Executor } = await import('./src/modules/executor/index.js');
    
    console.log('✓ Executor imported successfully');
    
    // Create executor instance
    const executor = new Executor();
    console.log('✓ Executor instance created');
    
    // Create a session
    const sessionId = 'test-session-' + Date.now();
    console.log(`Creating session: ${sessionId}`);
    
    const executorSessionId = await executor.createSession(sessionId);
    console.log(`✓ Session created: ${executorSessionId}`);
    
    // Test OPEN_PAGE command
    console.log('Testing OPEN_PAGE command...');
    const result = await executor.openPage(sessionId, 'https://www.google.com');
    
    console.log('✓ OPEN_PAGE command executed');
    console.log('Result:', {
      success: result.success,
      commandId: result.commandId,
      duration: result.duration,
      screenshotId: result.screenshotId,
      domLength: result.dom ? result.dom.length : 'undefined'
    });
    
    // Clean up
    await executor.destroySession(sessionId);
    console.log('✓ Session destroyed');
    
    console.log('\n🎉 Executor test passed! The issue is likely in the task loop integration.');
    
  } catch (error) {
    console.error('❌ Executor test failed:');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error details:', error);
    process.exit(1);
  }
}

testExecutor();
