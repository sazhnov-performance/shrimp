# Step Processor Module Design

## Overview

The Step Processor is a SIMPLE function that executes steps sequentially. That's it.

## Purpose

Execute steps one by one. Stop on failure. Continue on success.

## Core Interface

```typescript
// Just a simple function - no class, no constructor, no complexity
async function processSteps(steps: string[]): Promise<string>
```

## Algorithm

This is the ENTIRE algorithm:

1. **Create Session**: Generate unique session ID
2. **Create Stream**: Create streaming session with same session ID  
3. **Execute Steps**: For each step:
   - Call `taskLoop.executeStep(sessionId, stepIndex)`
   - If failure: STOP
   - If success: CONTINUE to next step
4. **Return Session ID**: Return the session ID

## Implementation

```typescript
import { ExecutorStreamer } from '../executor-streamer';
import { TaskLoop } from '../task-loop';

// Simple instances - no complex DI needed
const executorStreamer = new ExecutorStreamer();
const taskLoop = new TaskLoop({} as any, {} as any, {} as any, {} as any, {} as any);

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

function generateId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export { processSteps };
```

## Module Structure

```
/src/modules/step-processor/
  └── index.ts           # Just the processSteps function
  └── types.ts           # Types
```

## Usage

```typescript
import { processSteps } from './modules/step-processor';

const sessionId = await processSteps(['step1', 'step2', 'step3']);
```

That's it. Simple.
