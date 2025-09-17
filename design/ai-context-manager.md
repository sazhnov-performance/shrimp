# AI Context Manager Module Design

## Overview

The AI Context Manager is a simple, minimalistic module responsible for tracking execution history and providing context to other AI processing modules. It maintains execution logs organized by context ID and step ID, enabling the AI system to access historical information for informed decision-making.

## Purpose

- Store and retrieve execution context for AI processing workflows
- Provide organized access to task logs by context and step
- Support the ACT-REFLECT cycle by maintaining execution history
- Enable context-aware prompt generation and AI reasoning

## Core Interface

### Context Management
```typescript
interface IAIContextManager {
  // Create a new context with given ID
  createContext(contextId: string): void;
  
  // Set steps for a context as indexed array of step names
  setSteps(contextId: string, steps: string[]): void;
  
  // Log a task for specific context and step
  logTask(contextId: string, stepId: number, task: any): void;
  
  // Get all task logs for a specific step
  getStepContext(contextId: string, stepId: number): any[];
  
  // Get full context including all steps and their logs
  getFullContext(contextId: string): ContextData;
}
```

### Data Structures
```typescript
interface ContextData {
  contextId: string;
  steps: string[];
  stepLogs: Record<number, any[]>;
  createdAt: Date;
  lastUpdated: Date;
}
```

## Functional Requirements

### Context Creation
- **Function**: `createContext(contextId: string)`
- **Purpose**: Initialize a new execution context
- **Behavior**: 
  - Creates new context storage with given ID
  - Initializes empty steps array and log storage
  - Records creation timestamp
  - Throws error if context already exists

### Step Configuration
- **Function**: `setSteps(contextId: string, steps: string[])`
- **Purpose**: Define the steps for a workflow context
- **Behavior**:
  - Stores indexed array of step names
  - Initializes empty log arrays for each step
  - Updates last modified timestamp
  - Throws error if context doesn't exist

### Task Logging
- **Function**: `logTask(contextId: string, stepId: number, task: any)`
- **Purpose**: Record task execution data for a specific step
- **Behavior**:
  - Appends task data to step's log array
  - Accepts any data type (modules decide content)
  - Updates last modified timestamp
  - Throws error if context or step doesn't exist

### Step Context Retrieval
- **Function**: `getStepContext(contextId: string, stepId: number)`
- **Purpose**: Retrieve all logged tasks for a specific step
- **Behavior**:
  - Returns array of all task logs for the step
  - Returns empty array if no logs exist
  - Throws error if context or step doesn't exist

### Full Context Retrieval
- **Function**: `getFullContext(contextId: string)`
- **Purpose**: Retrieve complete context data
- **Behavior**:
  - Returns full ContextData object
  - Includes steps, all logs, and metadata
  - Throws error if context doesn't exist

## Implementation Constraints

### Type Flexibility
- Task data type is `any` - modules determine content structure
- No validation or transformation of logged data
- Context Manager acts as pure storage/retrieval layer

### Data Persistence
- In-memory storage for current implementation
- Context data lifecycle tied to module instance
- No persistent storage requirements (out of scope)

### Error Handling
- Throw descriptive errors for invalid operations
- Use standard JavaScript Error types
- Include context ID and operation details in error messages

### Performance Considerations
- Optimize for frequent read operations
- Minimal overhead for task logging
- Efficient step-specific data retrieval

## Module Integration

### Dependencies
- No external dependencies
- Part of AI Processing Layer
- Standalone module with isolated functionality

### Integration Points
- **AI Prompt Manager**: Retrieves context for prompt generation
- **Task Loop**: Logs execution results and retrieves history
- **Step Processor**: Creates contexts and defines steps

### Event Flow
```
Step Processor → createContext() + setSteps()
       ↓
Task Loop → logTask() (during ACT-REFLECT cycle)
       ↓
AI Prompt Manager → getStepContext() / getFullContext()
```

## Example Usage

```typescript
// Initialize context
contextManager.createContext("workflow-123");
contextManager.setSteps("workflow-123", [
  "Navigate to login page",
  "Enter credentials", 
  "Verify dashboard"
]);

// During execution
contextManager.logTask("workflow-123", 0, {
  action: "navigate",
  url: "https://example.com/login",
  result: "success",
  timestamp: new Date()
});

// Retrieve context
const stepLogs = contextManager.getStepContext("workflow-123", 0);
const fullContext = contextManager.getFullContext("workflow-123");
```

## Non-Functional Requirements

### Simplicity
- Minimal API surface
- No complex configuration
- Straightforward data structures

### Modularity  
- Self-contained functionality
- Clear interface boundaries
- No side effects on other modules

### Reliability
- Consistent error handling
- Predictable behavior
- Thread-safe operations (if applicable)

## Out of Scope

- Data persistence to disk/database
- Context sharing between instances
- Data transformation or validation
- Complex querying capabilities
- Context lifecycle management beyond creation
- Authentication or authorization
- Network communication
- Configuration management
- Logging or monitoring (module-level)
