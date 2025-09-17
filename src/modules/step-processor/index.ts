/**
 * Step Processor Module Implementation
 * SIMPLE function that executes steps sequentially. That's it.
 * Based on design/step-processor.md specifications
 */

/**
 * Process steps sequentially
 * Simple function - no class, no constructor, no complexity
 */
async function processSteps(
  steps: string[], 
  taskLoop: any, 
  executorStreamer: any
): Promise<string> {
  // Create session
  const sessionId = generateId();
  
  // Create stream
  await executorStreamer.createStream(sessionId);
  
  // Execute steps sequentially
  for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
    const result = await taskLoop.executeStep(sessionId, stepIndex);
    
    // Stop on failure, continue on success
    if (result.status === 'failure' || result.status === 'error') {
      break;
    }
  }
  
  return sessionId;
}

/**
 * Generate unique session ID
 */
function generateId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export { processSteps };
