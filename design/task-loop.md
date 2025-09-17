# Task Loop Module Design

## Overview

The Task Loop module implements the core ACT-REFLECT cycle for AI-driven web automation. It orchestrates the interaction between AI processing and browser execution by consuming interfaces from other modules to create a simple, focused automation loop.

## Purpose

- Execute ACT-REFLECT cycles for individual workflow steps
- Coordinate AI decision-making with browser automation
- Handle flow control based on AI responses
- Log execution history for context building

## Core Interface

```typescript
interface ITaskLoop {
  // Execute a single step with ACT-REFLECT cycle
  executeStep(sessionId: string, stepId: number): Promise<StepResult>;
}
```

## Dependencies

### Module Integration
```typescript
interface ITaskLoop {
  constructor(
    contextManager: IAIContextManager,
    promptManager: IAIPromptManager,
    aiIntegration: IAIIntegrationManager,
    schemaManager: IAISchemaManager,
    executor: IExecutorSessionManager
  );
}
```

## Data Structures

### Step Result
```typescript
interface StepResult {
  status: 'success' | 'failure' | 'error';
  stepId: number;
  iterations: number;
  totalDuration: number;
  finalResponse?: AIResponse;
  error?: string;
}
```

### AI Response (from AI Schema Manager)
```typescript
interface AIResponse {
  action?: {
    command: string;
    parameters: Record<string, any>;
  };
  reasoning: string;
  confidence: number;
  flowControl: 'continue' | 'stop_success' | 'stop_failure';
}
```

## Core Functionality

### Execute Step
```typescript
async executeStep(sessionId: string, stepId: number): Promise<StepResult>
```

**Algorithm:**
1. **Get Prompt**: Request step-specific prompt from AI Prompt Manager
2. **AI Request**: Send prompt to AI using AI Integration Module  
3. **Validate Response**: Validate AI response against schema from AI Schema Manager
4. **Execute Action**: If AI specified an action, call executor with the command
5. **Log Execution**: Record iteration in AI Context Manager
6. **Flow Control**: 
   - If `flowControl = 'continue'`: Repeat from step 1
   - If `flowControl = 'stop_success'`: Return success
   - If `flowControl = 'stop_failure'`: Return failure

**Implementation:**
```typescript
class TaskLoop implements ITaskLoop {
  constructor(
    private contextManager: IAIContextManager,
    private promptManager: IAIPromptManager,
    private aiIntegration: IAIIntegrationManager,
    private schemaManager: IAISchemaManager,
    private executor: IExecutorSessionManager
  ) {}

  async executeStep(sessionId: string, stepId: number): Promise<StepResult> {
    const startTime = Date.now();
    let iterations = 0;
    let finalResponse: AIResponse;

    try {
      while (iterations < MAX_ITERATIONS) {
        iterations++;

        // 1. Get prompt from AI Prompt Manager
        const prompt = this.promptManager.getStepPrompt(sessionId, stepId);

        // 2. Send request to AI Integration
        const aiResponse = await this.aiIntegration.sendRequest(prompt);
        
        if (aiResponse.status === 'error') {
          throw new Error(`AI request failed: ${aiResponse.error}`);
        }

        // 3. Validate response against schema
        const validatedResponse = this.validateAIResponse(aiResponse.data);
        finalResponse = validatedResponse;

        // 4. Execute action if specified
        if (validatedResponse.flowControl === 'continue' && validatedResponse.action) {
          await this.executeAction(sessionId, validatedResponse.action);
        }

        // 5. Log execution in context manager
        this.contextManager.logTask(sessionId, stepId, {
          iteration: iterations,
          aiResponse: validatedResponse,
          timestamp: new Date()
        });

        // 6. Handle flow control
        if (validatedResponse.flowControl === 'stop_success') {
          return {
            status: 'success',
            stepId,
            iterations,
            totalDuration: Date.now() - startTime,
            finalResponse
          };
        }

        if (validatedResponse.flowControl === 'stop_failure') {
          return {
            status: 'failure', 
            stepId,
            iterations,
            totalDuration: Date.now() - startTime,
            finalResponse
          };
        }

        // Continue with next iteration
      }

      // Max iterations reached
      return {
        status: 'error',
        stepId,
        iterations,
        totalDuration: Date.now() - startTime,
        error: 'Maximum iterations exceeded'
      };

    } catch (error) {
      return {
        status: 'error',
        stepId,
        iterations,
        totalDuration: Date.now() - startTime,
        error: error.message
      };
    }
  }

  private validateAIResponse(data: any): AIResponse {
    const schema = this.schemaManager.getAIResponseSchema();
    // Validate data against schema (implementation depends on validation library)
    // Return validated response or throw validation error
    return data as AIResponse;
  }

  private async executeAction(sessionId: string, action: any): Promise<void> {
    const executorSession = this.executor.getExecutorSession(sessionId);
    if (!executorSession) {
      throw new Error(`Executor session not found: ${sessionId}`);
    }

    // Execute the command through the executor
    const command = {
      sessionId,
      action: action.command,
      parameters: action.parameters
    };

    await this.executor.executeCommand(command);
  }
}
```

## Configuration

```typescript
interface TaskLoopConfig {
  maxIterations: number;        // Default: 10
  timeoutMs: number;           // Default: 300000 (5 minutes)
  enableLogging: boolean;      // Default: true
}

const DEFAULT_CONFIG: TaskLoopConfig = {
  maxIterations: 10,
  timeoutMs: 300000,
  enableLogging: true
};
```

## Error Handling

### Error Categories
- **AI Integration Errors**: API failures, timeout, invalid responses
- **Validation Errors**: Schema validation failures
- **Executor Errors**: Browser automation failures  
- **Context Errors**: Session not found, logging failures
- **Flow Errors**: Invalid flow control states

### Recovery Strategy
- Log all errors with full context
- Return descriptive error messages
- No automatic retries (caller responsibility)
- Ensure clean state even on failures

## Integration Flow

```
Step Processor
    ↓
Task Loop.executeStep()
    ↓
AI Prompt Manager.getStepPrompt()
    ↓  
AI Integration.sendRequest()
    ↓
AI Schema Manager.getAIResponseSchema() (validation)
    ↓
Executor.executeCommand() (if action specified)
    ↓
AI Context Manager.logTask()
    ↓
Return StepResult
```

## Module Structure

```
/src/modules/task-loop/
  ├── index.ts           # Main TaskLoop implementation
  ├── validator.ts       # AI response validation
  ├── types.ts          # TypeScript type definitions
  └── config.ts         # Configuration constants
```

## Testing Requirements

- Unit tests for executeStep flow
- AI response validation testing
- Error handling scenarios
- Integration tests with all dependent modules
- Flow control logic verification

## Out of Scope

- Multi-step workflow orchestration (handled by Step Processor)
- Session management (handled by individual modules)
- Response parsing beyond validation
- Retry logic and exponential backoff
- Performance optimization and caching
- Advanced error recovery strategies
