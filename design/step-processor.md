# Step Processor Module Design

## Overview

The Step Processor is a SIMPLE function that executes steps sequentially. That's it.

## Purpose

Execute steps one by one. Stop on failure. Continue on success.

## Core Interface (Singleton Pattern)

```typescript
interface IStepProcessor {
  // Singleton instance access
  static getInstance(config?: StepProcessorConfig): IStepProcessor;
  
  // Process steps sequentially
  processSteps(steps: string[]): Promise<string>;
}

interface StepProcessorConfig {
  maxConcurrentSessions?: number;
  timeoutMs?: number;
  enableLogging?: boolean;
}
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

## Implementation (Singleton Pattern)

```typescript
import { IExecutorStreamer } from '../executor-streamer';
import { ITaskLoop } from '../task-loop';

class StepProcessor implements IStepProcessor {
  private static instance: StepProcessor | null = null;
  private config: StepProcessorConfig;
  private executorStreamer: IExecutorStreamer;
  private taskLoop: ITaskLoop;

  private constructor(config: StepProcessorConfig = {}) {
    this.config = {
      maxConcurrentSessions: 10,
      timeoutMs: 300000, // 5 minutes
      enableLogging: true,
      ...config
    };
    
    // Resolve dependencies internally using singleton instances
    this.executorStreamer = IExecutorStreamer.getInstance();
    this.taskLoop = ITaskLoop.getInstance();
  }

  static getInstance(config?: StepProcessorConfig): IStepProcessor {
    if (!StepProcessor.instance) {
      StepProcessor.instance = new StepProcessor(config);
    }
    return StepProcessor.instance;
  }

  async processSteps(steps: string[]): Promise<string> {
    // Create session
    const sessionId = this.generateId();
    
    // Create stream - handle internally
    await this.executorStreamer.createStream(sessionId);
    
    // Execute steps sequentially - handle internally  
    for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
      const result = await this.taskLoop.executeStep(sessionId, stepIndex);
      
      // Stop on failure, continue on success
      if (result.status === 'failure' || result.status === 'error') {
        break;
      }
    }
    
    return sessionId;
  }

  private generateId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export { StepProcessor, IStepProcessor };
```

## Module Structure

```
/src/modules/step-processor/
  └── index.ts           # Just the processSteps function
  └── types.ts           # Types
```

## Usage

```typescript
import { IStepProcessor } from './modules/step-processor';

// Get singleton instance
const stepProcessor = IStepProcessor.getInstance({
  maxConcurrentSessions: 5,
  timeoutMs: 600000, // 10 minutes
  enableLogging: true
});

const sessionId = await stepProcessor.processSteps(['step1', 'step2', 'step3']);
```

That's it. Simple.
