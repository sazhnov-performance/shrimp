/**
 * Step Processor Module Implementation
 * SIMPLE function that executes steps sequentially. That's it.
 * Based on design/step-processor.md specifications
 */

import { ExecutorStreamer } from '../executor-streamer';
import { TaskLoop } from '../task-loop';

// Simple instances - no complex DI needed
const executorStreamer = new ExecutorStreamer();
const taskLoop = new TaskLoop({} as any, {} as any, {} as any, {} as any, {} as any); // TODO: Proper deps

/**
 * Process steps sequentially
 * Simple function - no class, no constructor, no complexity
 * Just pass steps and GO!
 */
async function processSteps(steps: string[]): Promise<string> {
  // Create session
  const sessionId = generateId();
  
  // Create stream - handle internally
  await executorStreamer.createStream(sessionId);
  
  // Execute steps sequentially - handle internally  
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
