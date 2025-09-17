# Step Processor Module Design

## Overview

The Step Processor is a simple workflow orchestrator that executes a sequence of automation steps by delegating individual step processing to the Task Loop module. It manages session creation and sequential step execution with basic flow control.

## Purpose

- Initialize workflow sessions for step sequences
- Execute steps sequentially using Task Loop
- Stop processing on step failure
- Continue to next step on success

## Core Interface

```typescript
interface IStepProcessor {
  // Initialize processing for a list of steps and return session ID
  init(steps: string[]): Promise<string>;
}
```

## Dependencies

```typescript
interface IStepProcessor {
  constructor(
    sessionCoordinator: SessionCoordinator,
    taskLoop: ITaskLoop,
    executorStreamer: IExecutorStreamer
  );
}
```

## Data Structures

### Step Processing Flow
```typescript
interface StepSequence {
  sessionId: string;
  steps: string[];
  currentStepIndex: number;
  status: 'active' | 'completed' | 'failed';
}
```

## Core Functionality

### Initialize Processing
```typescript
async init(steps: string[]): Promise<string>
```

**Algorithm:**
1. **Create Session**: Generate unique session ID using Session Coordinator
2. **Create Stream**: Create streaming session with same session ID using Executor Streamer
3. **Store Steps**: Track step sequence internally
4. **Execute Sequential Processing**: For each step in sequence:
   - Call `taskLoop.executeStep(sessionId, stepIndex)`
   - If result status is 'failure' or 'error': STOP processing
   - If result status is 'success': CONTINUE to next step
5. **Return Session ID**: Return the generated session ID immediately after creation

**Implementation:**
```typescript
class StepProcessor implements IStepProcessor {
  private activeSequences = new Map<string, StepSequence>();

  constructor(
    private sessionCoordinator: SessionCoordinator,
    private taskLoop: ITaskLoop,
    private executorStreamer: IExecutorStreamer
  ) {}

  async init(steps: string[]): Promise<string> {
    // 1. Create workflow session
    const workflowSession = await this.sessionCoordinator.createWorkflowSession(steps);
    const sessionId = workflowSession.sessionId;

    // 2. Create streaming session with same ID
    await this.executorStreamer.createStream(sessionId);

    // 3. Store step sequence
    const sequence: StepSequence = {
      sessionId,
      steps,
      currentStepIndex: 0,
      status: 'active'
    };
    this.activeSequences.set(sessionId, sequence);

    // 4. Start sequential processing (non-blocking)
    this.processStepsSequentially(sessionId).catch(error => {
      console.error(`Step processing failed for session ${sessionId}:`, error);
    });

    // 5. Return session ID immediately
    return sessionId;
  }

  private async processStepsSequentially(sessionId: string): Promise<void> {
    const sequence = this.activeSequences.get(sessionId);
    if (!sequence) return;

    try {
      for (let stepIndex = 0; stepIndex < sequence.steps.length; stepIndex++) {
        sequence.currentStepIndex = stepIndex;

        // Execute step using Task Loop
        const stepResult = await this.taskLoop.executeStep(sessionId, stepIndex);

        // Flow control: stop on failure, continue on success
        if (stepResult.status === 'failure' || stepResult.status === 'error') {
          sequence.status = 'failed';
          break;
        }

        // Continue to next step on success
        if (stepResult.status === 'success') {
          continue;
        }
      }

      // Mark as completed if all steps succeeded
      if (sequence.status === 'active') {
        sequence.status = 'completed';
      }

    } catch (error) {
      sequence.status = 'failed';
      throw error;
    } finally {
      // Cleanup session and stream when processing is complete
      await this.sessionCoordinator.destroyWorkflowSession(sessionId);
      // Note: Stream cleanup should be handled by the API consumer or through TTL
      this.activeSequences.delete(sessionId);
    }
  }
}
```

## Module Structure

```
/src/modules/step-processor/
  ├── index.ts           # Main StepProcessor implementation
  └── types.ts          # TypeScript type definitions
```

## Integration Flow

```
StepProcessor.init()
    ↓
SessionCoordinator.createWorkflowSession()
    ↓
ExecutorStreamer.createStream(sessionId)
    ↓
TaskLoop.executeStep() (for each step sequentially)
    ↓
SessionCoordinator.destroyWorkflowSession()
```

## Error Handling

- Session creation failures: Propagate error to caller
- Stream creation failures: Propagate error to caller
- Task Loop failures: Stop processing and cleanup session
- No automatic retries: Task Loop handles internal retry logic

## Streaming Integration

The Step Processor integrates with the Executor Streamer to provide real-time event streaming capabilities:

### Stream Creation
- **Stream ID**: Uses the same unique identifier as the workflow session
- **Timing**: Stream is created immediately after session creation in the `init()` method
- **Lifecycle**: Stream exists for the duration of the workflow session

### Stream Management
- **Creation**: Automatically handled during session initialization
- **Cleanup**: Stream cleanup is managed by the executor-streamer's TTL mechanism or by API consumers
- **Error Handling**: Stream creation failures are propagated to the caller

### Integration Benefits
- **Unified Identification**: Same ID for both session and stream enables seamless correlation
- **Real-time Monitoring**: External systems can monitor workflow progress through the stream
- **Decoupled Architecture**: Step processing and stream management remain independent

### Example Flow
```typescript
const stepProcessor = new StepProcessor(sessionCoordinator, taskLoop, executorStreamer);
const sessionId = await stepProcessor.init(['step1', 'step2', 'step3']);

// Stream with same sessionId is now available for monitoring:
// - executorStreamer.getEvents(sessionId)
// - executorStreamer.hasEvents(sessionId)
```

## Out of Scope

- Step validation and parsing
- Progress tracking and monitoring
- Concurrent step execution
- Advanced error recovery
- Custom step configuration
- Session persistence
- Real-time status updates
- Step dependencies and conditionals
