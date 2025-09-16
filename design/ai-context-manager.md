# AI Context Manager Module Design Document

## Overview
The AI Context Manager module manages the execution context and reasoning history for AI-driven automation sessions. It tracks step definitions, execution events, reasoning processes, and page states to provide comprehensive context for AI decision-making and debugging.

## Core Responsibilities
- Manage session-based execution context
- Store and organize step definitions for automation workflows
- Track step execution events with temporal ordering
- Capture reasoning, executor methods, and page DOM states
- Generate contextual JSON for AI analysis and debugging
- Provide historical context retrieval for decision-making

## Module Interface

### Session Context Management (STANDARDIZED)
```typescript
// Import standardized session management types
import { 
  WorkflowSession, 
  SessionStatus,
  ExecutorCommand,
  CommandResponse,
  StandardError,
  StreamEvent,
  ISessionManager,
  ModuleSessionInfo,
  SessionLifecycleCallbacks,
  ModuleSessionConfig
} from './shared-types';

// AI Context Module implements standardized session management
interface AIContextSession extends ModuleSessionInfo {
  moduleId: 'ai-context-manager';
  steps: string[];
  stepExecutions: StepExecution[];
  executorSessionId: string;      // Link to executor browser session
  // Inherits: sessionId, linkedWorkflowSessionId, status, createdAt, lastActivity, metadata
}

interface StepExecution {
  stepIndex: number;
  stepName: string;
  events: ExecutionEvent[];
  startTime: Date;
  endTime?: Date;
  status: SessionStatus;          // FIXED: Uses shared enum
  executedCommands?: ExecutorCommand[];  // FIXED: Track executed commands
  commandResults?: CommandResponse[];    // FIXED: Track command results
}

interface ExecutionEvent {
  eventId: string;
  timestamp: Date;
  reasoning: string;
  executorMethod: string;
  executorCommand?: ExecutorCommand;     // FIXED: Full command context
  commandResult?: CommandResponse;       // FIXED: Full result context
  pageDom: string;
  metadata?: Record<string, any>;
}
```

### Core Interface (STANDARDIZED: Implements ISessionManager)
```typescript
interface IAIContextManager extends ISessionManager {
  readonly moduleId: 'ai-context-manager';
  
  // Standardized Session Management (inherited from ISessionManager)
  createSession(workflowSessionId: string, config?: AIContextConfig): Promise<string>;
  destroySession(workflowSessionId: string): Promise<void>;
  getSession(workflowSessionId: string): ModuleSessionInfo | null;
  sessionExists(workflowSessionId: string): boolean;
  updateSessionStatus(workflowSessionId: string, status: SessionStatus): Promise<void>;
  getSessionStatus(workflowSessionId: string): SessionStatus | null;
  recordActivity(workflowSessionId: string): Promise<void>;
  getLastActivity(workflowSessionId: string): Date | null;
  setLifecycleCallbacks(callbacks: SessionLifecycleCallbacks): void;
  healthCheck(): Promise<SessionManagerHealth>;
  
  // AI Context Specific Methods (use workflowSessionId consistently)
  linkExecutorSession(workflowSessionId: string, executorSessionId: string): Promise<void>;
  
  // Step Management
  setSteps(workflowSessionId: string, steps: string[]): Promise<void>;
  getSteps(workflowSessionId: string): string[] | null;
  
  // Step Execution Tracking
  addStepExecution(workflowSessionId: string, stepExecution: StepExecution): Promise<void>;
  updateStepExecution(workflowSessionId: string, stepIndex: number, updates: Partial<StepExecution>): Promise<void>;
  getStepExecution(workflowSessionId: string, stepIndex: number): StepExecution | null;
  
  // Event Management (uses workflowSessionId consistently)
  addExecutionEvent(workflowSessionId: string, stepIndex: number, command: ExecutorCommand, result: CommandResponse, reasoning?: string): Promise<string>;
  addExecutionEventFromStream(workflowSessionId: string, stepIndex: number, streamEvent: StreamEvent): Promise<string>;
  getExecutionEvents(workflowSessionId: string, stepIndex: number): ExecutionEvent[];
  
  // Context Generation
  generateContextJson(workflowSessionId: string, targetStep: number): Promise<AIContextJson>;
  
  // Query Methods
  getSessionContext(workflowSessionId: string): AIContextSession | null;
  getExecutionHistory(workflowSessionId: string): StepExecution[];
}
```

## Data Structures (FIXED: Uses Shared Types)

### Execution Status (FIXED: Uses Shared SessionStatus)
```typescript
// FIXED: Import and use shared SessionStatus instead of custom enum
import { SessionStatus } from './shared-types';

// No longer defining custom ExecutionStatus - uses SessionStatus from shared types
// SessionStatus includes: INITIALIZING, ACTIVE, PAUSED, COMPLETED, FAILED, CANCELLED, CLEANUP
```

### Context JSON Output
```typescript
interface AIContextJson {
  sessionId: string;
  targetStep: number;
  generatedAt: Date;
  
  // Historical data from start to target step
  executionFlow: ExecutionFlowItem[];
  
  // Page DOM states
  previousPageDom?: string;  // DOM from step (targetStep - 1)
  currentPageDom?: string;   // DOM from targetStep
  
  // Summary information
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
}

interface ExecutionFlowItem {
  stepIndex: number;
  stepName: string;
  reasoning: string;
  executorMethod: string;
  timestamp: Date;
  status: ExecutionStatus;
}
```

## Core Functionality

### 1. Session Initialization
```typescript
async createSession(sessionId: string): Promise<void>
```
- Create new context session with unique ID
- Initialize empty steps array and execution history
- Set creation timestamp
- Validate session ID uniqueness

### 2. Step Definition Management
```typescript
async setSteps(sessionId: string, steps: string[]): Promise<void>
```
- Store ordered list of step descriptions
- Clear any existing step definitions
- Initialize step execution tracking structure
- Validate step format and content

### 3. Step Execution Tracking
```typescript
async addStepExecution(sessionId: string, stepExecution: StepExecution): Promise<void>
```
- Add new step execution record
- Ensure temporal ordering of events
- Link to corresponding step definition
- Update session metadata

### 4. Event Logging
```typescript
async addExecutionEvent(sessionId: string, stepIndex: number, event: ExecutionEvent): Promise<void>
```
- Add execution event to specific step
- Maintain chronological order
- Store reasoning, executor method, and page DOM
- Generate unique event IDs

### 5. Context Generation
```typescript
async generateContextJson(sessionId: string, targetStep: number): Promise<AIContextJson>
```
The core method that produces AI-consumable context:

#### Process Flow:
1. **Validate Input**: Check session exists and target step is valid
2. **Collect Execution Flow**: Gather all reasoning and executor methods from start to target step
3. **Extract Page DOM States**:
   - Get DOM from step (targetStep - 1) if available
   - Get DOM from targetStep if available
4. **Generate Summary**: Calculate completion statistics
5. **Format Output**: Structure data for AI consumption

#### Data Aggregation Rules:
- **Execution Flow**: Include all events from step 0 to targetStep
- **Previous DOM**: Last DOM from step (targetStep - 1)
- **Current DOM**: Last DOM from targetStep
- **Chronological Order**: Maintain temporal sequence of all events

## Implementation Structure

### Module Organization
```
/src/modules/ai-context-manager/
  ├── index.ts                    # Main module interface
  ├── context-session-manager.ts  # Session lifecycle management
  ├── step-manager.ts             # Step definition handling
  ├── execution-tracker.ts        # Step execution and event tracking
  ├── context-generator.ts        # Context JSON generation logic
  ├── storage-adapter.ts          # Data persistence abstraction
  └── types.ts                    # TypeScript type definitions
```

### Storage Strategy
```typescript
interface IContextStorageAdapter {
  saveSession(session: AIContextSession): Promise<void>;
  loadSession(sessionId: string): Promise<AIContextSession | null>;
  deleteSession(sessionId: string): Promise<void>;
  listSessions(): Promise<string[]>;
}
```

Support multiple storage backends:
- **Memory**: Fast access for development and testing
- **File System**: JSON files for simple persistence
- **Database**: SQL/NoSQL for production environments

## Integration with Executor Module

### Event Capture Integration
```typescript
// Executor calls context manager after each command
interface ExecutorIntegration {
  onCommandExecuted(sessionId: string, stepIndex: number, event: {
    reasoning: string;
    executorMethod: string;
    pageDom: string;
    timestamp: Date;
  }): Promise<void>;
}
```

### Data Flow
1. **AI Engine** sets steps via `setSteps()`
2. **Executor Module** performs automation commands
3. **Context Manager** captures events via `addExecutionEvent()`
4. **AI Engine** requests context via `generateContextJson()`
5. **AI Engine** makes decisions based on historical context

## Advanced Features

### Context Querying
```typescript
interface ContextQuery {
  sessionId: string;
  stepRange?: [number, number];
  eventTypes?: string[];
  timeRange?: [Date, Date];
  includePageDom?: boolean;
}

interface IAdvancedQuerying {
  queryContext(query: ContextQuery): Promise<any>;
  searchReasonings(sessionId: string, searchTerm: string): Promise<ExecutionEvent[]>;
  getExecutionMetrics(sessionId: string): Promise<ExecutionMetrics>;
}
```

### Context Compression
For large sessions with extensive DOM data:
```typescript
interface ContextCompressionOptions {
  compressDom: boolean;
  maxDomSize: number;
  excludeRepeatedDom: boolean;
  summarizeReasonings: boolean;
}
```

### Export/Import
```typescript
interface IContextPortability {
  exportSession(sessionId: string, format: 'json' | 'xml' | 'yaml'): Promise<string>;
  importSession(data: string, format: 'json' | 'xml' | 'yaml'): Promise<string>;
  cloneSession(sourceSessionId: string, targetSessionId: string): Promise<void>;
}
```

## Performance Considerations

### Memory Management
- Implement DOM data compression for large pages
- Provide configurable retention policies
- Support pagination for large execution histories
- Lazy loading of historical data

### Scalability
- Support for concurrent session access
- Efficient indexing for temporal queries
- Batch operations for bulk data insertion
- Configurable storage backends

## Error Handling (FIXED: Uses Standardized Error Framework)

### Error Types (FIXED: Uses StandardError from shared types)
```typescript
// Import standardized error handling
import { 
  StandardError, 
  ErrorCategory, 
  ErrorSeverity, 
  ERROR_CODES 
} from './shared-types';

// Context Manager specific errors use shared framework
class ContextManagerErrorHandler {
  createStandardError(code: string, message: string, details?: Record<string, any>): StandardError {
    return {
      id: crypto.randomUUID(),
      category: this.categorizeError(code),
      severity: this.determineSeverity(code),
      code: ERROR_CODES.CONTEXT_MANAGER[code] || code,
      message,
      details,
      timestamp: new Date(),
      moduleId: 'ai-context-manager',
      recoverable: this.isRecoverable(code),
      retryable: this.isRetryable(code),
      suggestedAction: this.getSuggestedAction(code)
    };
  }
}
```

### Error Categories (FIXED: Uses Shared Categories)
- **VALIDATION**: Invalid session IDs, malformed step definitions, invalid step indices
- **EXECUTION**: Corrupted execution data, context generation failures
- **SYSTEM**: Persistence failures, storage capacity limits, data corruption
- **INTEGRATION**: Concurrent access conflicts, external service failures

### Recovery Mechanisms (FIXED: Standardized)
- Automatic session recovery using StandardError.retryable flag
- Data integrity checks with detailed error context
- Backup and restore capabilities with error tracking
- Graceful degradation strategies based on ErrorSeverity

## Configuration

### Context Manager Configuration (FIXED: Extends BaseModuleConfig)
```typescript
// Import shared configuration pattern
import { BaseModuleConfig, DEFAULT_TIMEOUT_CONFIG } from './shared-types';

interface AIContextConfig extends BaseModuleConfig {
  moduleId: 'ai-context-manager';
  
  // AI Context Manager specific configuration
  storage: {
    adapter: 'memory' | 'filesystem' | 'database';
    maxSessionsInMemory: number;
    sessionTTL: number; // Time-to-live in milliseconds
    maxStepsPerSession: number;
    maxEventsPerStep: number;
  };
  compression: {
    enabled: boolean;
    threshold: number; // DOM size in bytes
  };
  export: {
    formats: string[];
  };
  
  // Inherits from BaseModuleConfig:
  // - logging: LoggingConfig
  // - performance: PerformanceConfig  
  // - timeouts: TimeoutConfig
}

// Default configuration
const DEFAULT_AI_CONTEXT_CONFIG: AIContextConfig = {
  moduleId: 'ai-context-manager',
  version: '1.0.0',
  enabled: true,
  
  storage: {
    adapter: 'memory',
    maxSessionsInMemory: 100,
    sessionTTL: 1800000, // 30 minutes
    maxStepsPerSession: 1000,
    maxEventsPerStep: 100
  },
  
  compression: {
    enabled: true,
    threshold: 100000 // 100KB DOM threshold
  },
  
  export: {
    formats: ['json', 'csv', 'xml']
  },
  
  timeouts: DEFAULT_TIMEOUT_CONFIG,
  
  logging: {
    level: LogLevel.INFO,
    prefix: '[AIContext]',
    includeTimestamp: true,
    includeSessionId: true,
    includeModuleId: true,
    structured: false
  },
  
  performance: {
    maxConcurrentOperations: 50,
    cacheEnabled: true,
    cacheTTLMs: 300000, // 5 minutes
    metricsEnabled: true
  }
}
```

## Testing Requirements
- Unit tests for all core functionality
- Integration tests with executor module
- Performance tests for large session data
- Memory leak detection tests
- Concurrent access safety tests
- Data integrity validation tests

## Security Considerations
- Session ID validation and sanitization
- Access control for session data
- Secure storage of sensitive execution data
- Audit logging for context access
- Data encryption for persistent storage

## Future Enhancements
- Real-time context streaming for live monitoring
- AI-powered execution pattern analysis
- Automated context summarization
- Visual execution flow diagrams
- Context-based debugging tools
- Machine learning insights from execution patterns
