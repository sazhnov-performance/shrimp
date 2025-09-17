# Task Loop Module

The Task Loop module implements the core ACT-REFLECT cycle for AI-driven web automation with sophisticated page investigation capabilities. It orchestrates the interaction between AI reasoning, prompt generation, page investigation tools, executor commands, and context management to perform intelligent web automation with continuous learning and adaptation while preventing context overflow.

## Features

### Core ACT-REFLECT Cycle
- **ACT Phase**: Generate AI prompts, query AI services, execute automation commands
- **REFLECT Phase**: Analyze results, validate outcomes, decide on next actions
- **Investigation Integration**: Enhanced ACT phase with page investigation capabilities

### Page Investigation Capabilities
- **Initial Assessment**: High-level page understanding via screenshot analysis
- **Focused Exploration**: Targeted exploration using text extraction and sub-DOM analysis
- **Selector Determination**: Synthesize findings to determine optimal selectors

### Investigation Tools
- **Screenshot Analysis**: Visual page understanding through AI vision
- **Text Extraction**: Selective text content retrieval
- **Full DOM Retrieval**: Complete page structure analysis
- **Sub-DOM Extraction**: Focused DOM section analysis

### Context Management
- **Filtered Context**: Prevents AI context overflow while preserving critical information
- **Working Memory**: Progressive learning and element knowledge accumulation
- **Pattern Recognition**: Learning from successful and failed interaction patterns

## Usage

### Basic Setup

```typescript
import { TaskLoop, DEFAULT_TASK_LOOP_CONFIG } from './modules/task-loop';
import { DIContainer } from './types/shared-types';

// Create and configure the Task Loop
const config = {
  ...DEFAULT_TASK_LOOP_CONFIG,
  investigation: {
    ...DEFAULT_TASK_LOOP_CONFIG.investigation,
    enabled: true,
    maxInvestigationRounds: 3
  }
};

const taskLoop = new TaskLoop(config);

// Initialize with dependency injection container
const container = new DIContainer();
// ... register dependencies
await taskLoop.initialize(container);
```

### Session Management

```typescript
// Create a session
const sessionId = await taskLoop.createSession('workflow-123');

// Check session status
const status = taskLoop.getSessionStatus('workflow-123');

// Destroy session when done
await taskLoop.destroySession('workflow-123');
```

### Processing Steps

```typescript
// Process a step with investigation enabled
const stepRequest: TaskLoopStepRequest = {
  sessionId: 'workflow-123',
  stepIndex: 0,
  stepContent: 'Click the login button',
  streamId: 'stream-456',
  options: {
    maxIterations: 3,
    reflectionEnabled: true
  }
};

const result = await taskLoop.processStep(stepRequest);

if (result.success) {
  console.log('Step completed successfully');
  console.log('AI reasoning:', result.aiReasoning);
  console.log('Commands executed:', result.executedCommands);
} else {
  console.error('Step failed:', result.error);
}
```

### Investigation Phase Processing

```typescript
// Process specific investigation phase
const investigationRequest: InvestigationPhaseRequest = {
  sessionId: 'workflow-123',
  stepIndex: 0,
  stepContent: 'Find the submit button',
  phase: InvestigationPhase.INITIAL_ASSESSMENT,
  investigationOptions: {
    enableInvestigation: true,
    maxInvestigationRounds: 2,
    confidenceThreshold: 0.8,
    preferredTools: [
      InvestigationTool.SCREENSHOT_ANALYSIS,
      InvestigationTool.TEXT_EXTRACTION
    ],
    contextManagementApproach: 'standard',
    enableWorkingMemory: true,
    enableElementKnowledge: true,
    enableProgressiveContext: true,
    investigationTimeoutMs: 60000
  }
};

const investigationResult = await taskLoop.processInvestigationPhase(investigationRequest);

if (investigationResult.success) {
  console.log('Investigation phase completed');
  console.log('Elements discovered:', investigationResult.elementsDiscovered);
  console.log('Confidence:', investigationResult.confidence);
  console.log('Ready for action:', investigationResult.readyForAction);
}
```

### Event Publishing

```typescript
// Set up event publisher for real-time updates
const eventPublisher: IEventPublisher = {
  async publishEvent(event: TaskLoopEvent): Promise<void> {
    console.log('Task Loop Event:', event.type, event.data);
    // Forward to your event system (WebSocket, etc.)
  }
};

taskLoop.setEventPublisher(eventPublisher);
```

## Configuration

### Investigation Configuration

```typescript
const config: TaskLoopConfig = {
  // ... other config
  investigation: {
    enabled: true,
    maxInvestigationRounds: 3,
    investigationTimeoutMs: 120000, // 2 minutes
    confidenceThreshold: 0.7,
    enabledTools: [
      InvestigationTool.SCREENSHOT_ANALYSIS,
      InvestigationTool.TEXT_EXTRACTION,
      InvestigationTool.SUB_DOM_EXTRACTION,
      InvestigationTool.FULL_DOM_RETRIEVAL
    ],
    toolPriorityOrder: [
      InvestigationTool.SCREENSHOT_ANALYSIS,
      InvestigationTool.TEXT_EXTRACTION,
      InvestigationTool.SUB_DOM_EXTRACTION,
      InvestigationTool.FULL_DOM_RETRIEVAL
    ],
    contextManagementApproach: 'standard',
    enableWorkingMemory: true,
    enableElementKnowledge: true,
    enableProgressiveContext: true,
    maxContextSize: 50000,
    investigationPromptOptions: {
      includeExecutionHistory: true,
      maxHistorySteps: 3,
      validationMode: 'lenient',
      reasoningDepth: 'detailed'
    }
  }
};
```

### Context Management Configuration

```typescript
const config: TaskLoopConfig = {
  // ... other config
  contextManagement: {
    enableFilteredContext: true,
    maxHistorySteps: 10,
    excludeFullDom: true,
    includePreviousInvestigations: true,
    summarizationLevel: 'standard',
    workingMemoryEnabled: true,
    elementKnowledgeEnabled: true,
    patternLearningEnabled: true
  }
};
```

## Events

The Task Loop publishes the following events:

### Step Events
- `STEP_STARTED`: Step processing has begun
- `STEP_COMPLETED`: Step processing completed successfully
- `STEP_FAILED`: Step processing failed

### Investigation Events
- `INVESTIGATION_STARTED`: Investigation cycle started
- `INVESTIGATION_PHASE_STARTED`: Investigation phase started
- `INVESTIGATION_PHASE_COMPLETED`: Investigation phase completed
- `INVESTIGATION_TOOL_STARTED`: Investigation tool execution started
- `INVESTIGATION_TOOL_COMPLETED`: Investigation tool execution completed
- `INVESTIGATION_COMPLETED`: Investigation cycle completed
- `INVESTIGATION_FAILED`: Investigation cycle failed
- `ELEMENT_DISCOVERED`: New element discovered during investigation
- `WORKING_MEMORY_UPDATED`: Working memory updated with new information

### AI Events
- `AI_REASONING_UPDATE`: AI reasoning and confidence updates
- `COMMAND_EXECUTED`: Executor command executed

## Error Handling

The module provides comprehensive error handling with standardized error types:

### Error Types
- `PROMPT_GENERATION_ERROR`: Failed to generate AI prompt
- `AI_COMMUNICATION_ERROR`: Failed to communicate with AI service
- `RESPONSE_PARSING_ERROR`: Failed to parse AI response
- `COMMAND_EXECUTION_ERROR`: Failed to execute automation command
- `INVESTIGATION_CYCLE_FAILED`: Investigation cycle failed
- `INVESTIGATION_PHASE_FAILED`: Investigation phase failed
- `INVESTIGATION_TOOL_FAILED`: Investigation tool failed
- `INVESTIGATION_TIMEOUT`: Investigation timeout exceeded
- `WORKING_MEMORY_UPDATE_FAILED`: Working memory update failed
- `CONTEXT_FILTERING_FAILED`: Context filtering failed

### Error Recovery

```typescript
try {
  const result = await taskLoop.processStep(stepRequest);
} catch (error) {
  if (error.retryable) {
    // Retry the operation
    console.log('Retrying operation:', error.suggestedAction);
  } else {
    // Handle non-retryable error
    console.error('Fatal error:', error.message);
  }
}
```

## Dependencies

The Task Loop module requires the following dependencies to be registered in the DI container:

- `AI_INTEGRATION`: AI service for prompt processing
- `EXECUTOR`: Browser automation executor
- `CONTEXT_MANAGER`: AI context and working memory management
- `PROMPT_MANAGER`: AI prompt generation

## Architecture

The Task Loop follows a modular architecture:

```
TaskLoop (Main Interface)
├── Session Management (ISessionManager implementation)
├── ACT-REFLECT Cycle
│   ├── Traditional ACT Phase
│   ├── Enhanced ACT Phase with Investigation
│   └── REFLECT Phase
├── Investigation Cycle
│   ├── Initial Assessment Phase
│   ├── Focused Exploration Phase
│   └── Selector Determination Phase
├── Investigation Tools
│   ├── Screenshot Analysis
│   ├── Text Extraction
│   ├── Full DOM Retrieval
│   └── Sub-DOM Extraction
├── Event Publishing
├── Error Handling
└── Logging
```

## Testing

Unit tests are available for all core functionality:

```bash
npm test -- --testPathPattern=task-loop
```

## Performance Considerations

- Investigation cycles are configurable with timeout and iteration limits
- Context filtering prevents AI context overflow
- Working memory provides efficient element knowledge storage
- Event publishing is non-blocking and error-tolerant
- Session cleanup prevents memory leaks

## Future Enhancements

- AI-powered investigation strategy optimization
- Cross-session learning and pattern sharing
- Visual element recognition integration
- Advanced context compression techniques
- Multi-modal investigation capabilities
