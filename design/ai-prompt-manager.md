# AI Prompt Manager Module Design

## Overview

The AI Prompt Manager is a minimalistic module responsible for generating context-aware prompts for AI automation agents. It combines execution context, response schemas, and specialized instructions to create optimized prompts that guide the AI through web automation workflows using the ACT-REFLECT cycle.

## Purpose

- Generate structured prompts for AI automation agents
- Include execution context and history for informed decision-making
- Embed response schemas to ensure consistent AI output format
- Optimize prompt content for AI model comprehension and performance

## Core Interface

### Primary Interface
```typescript
interface IAIPromptManager {
  // Initialize context with session and workflow steps
  init(sessionId: string, steps: string[]): void;
  
  // Generate step-specific prompt with full context
  getStepPrompt(sessionId: string, stepId: number): string;
}
```

## Dependencies

### Module Integration
```typescript
interface IAIPromptManager {
  constructor(
    contextManager: IAIContextManager,
    schemaManager: IAISchemaManager
  );
}
```

## Functional Requirements

### Initialization
- **Function**: `init(sessionId: string, steps: string[])`
- **Purpose**: Set up session context for prompt generation
- **Behavior**:
  - Creates context using AI Context Manager
  - Stores step definitions for the workflow
  - Prepares session for step-specific prompt requests
  - Validates session doesn't already exist

### Step Prompt Generation
- **Function**: `getStepPrompt(sessionId: string, stepId: number)`
- **Purpose**: Generate complete prompt for specific workflow step
- **Behavior**:
  - Retrieves execution context from AI Context Manager
  - Includes response schema from AI Schema Manager
  - Combines with step-specific instructions
  - Returns formatted prompt optimized for AI models

## Prompt Structure

### Complete Prompt Template
```
ROLE: You are an intelligent web automation agent specialized in browser testing and interaction.

CURRENT CONTEXT:
- Session: {sessionId}
- Step {stepId + 1} of {totalSteps}: "{stepName}"
- Current Page State: [Based on latest screenshot/DOM data]

EXECUTION HISTORY:
{contextualHistory}

YOUR MISSION:
Execute the current step using available browser automation commands through a systematic INVESTIGATE-ACT-REFLECT cycle:

INVESTIGATE PHASE:
1. Analyze the current page state using available inspection methods
2. Use GET_SUBDOM to explore relevant page sections and understand structure
3. Identify target elements and optimal interaction strategies
4. Build confidence in element selectors through iterative investigation

ACT PHASE:
1. Choose the most reliable CSS selector for your target element
2. Execute the appropriate action (OPEN_PAGE, CLICK_ELEMENT, INPUT_TEXT)
3. Ensure high confidence (80%+) before taking action

REFLECT PHASE:
1. Evaluate action outcome against step objectives
2. Determine if step goal is achieved or requires additional actions
3. Decide flow control: continue iteration, complete successfully, or fail

AVAILABLE COMMANDS:
- OPEN_PAGE: Navigate to a URL
- CLICK_ELEMENT: Click on page elements using CSS selectors
- INPUT_TEXT: Enter text into form fields
- GET_SUBDOM: Investigate page sections for element discovery

OPTIMIZATION GUIDELINES:
- Prioritize stable, unique selectors (IDs, data attributes, specific classes)
- Use semantic HTML attributes when available
- Validate element existence before interaction
- Maintain high confidence levels through thorough investigation
- Provide clear reasoning for all decisions

RESPONSE FORMAT:
{responseSchema}

CURRENT STEP OBJECTIVE: {stepName}

Begin your analysis of the current page state and determine your next action.
```

### Context Integration

#### Execution History Format
```typescript
interface ContextualHistory {
  previousSteps: Array<{
    stepId: number;
    stepName: string;
    outcome: 'success' | 'failure' | 'in_progress';
    summary: string;
    confidence: number;
  }>;
  currentStepAttempts: Array<{
    action: string;
    result: string;
    reasoning: string;
    timestamp: string;
  }>;
}
```

#### Dynamic Content Insertion
- Replace `{sessionId}` with actual session identifier
- Replace `{stepId}` and `{totalSteps}` with current step position
- Replace `{stepName}` with current step description
- Replace `{contextualHistory}` with formatted execution history
- Replace `{responseSchema}` with JSON schema from AI Schema Manager

## Implementation

### AI Prompt Manager Class
```typescript
class AIPromptManager implements IAIPromptManager {
  constructor(
    private contextManager: IAIContextManager,
    private schemaManager: IAISchemaManager
  ) {}

  init(sessionId: string, steps: string[]): void {
    this.contextManager.createContext(sessionId);
    this.contextManager.setSteps(sessionId, steps);
  }

  getStepPrompt(sessionId: string, stepId: number): string {
    const context = this.contextManager.getFullContext(sessionId);
    const schema = this.schemaManager.getAIResponseSchema();
    
    return this.buildPrompt(context, stepId, schema);
  }

  private buildPrompt(context: ContextData, stepId: number, schema: object): string {
    const stepName = context.steps[stepId];
    const history = this.formatExecutionHistory(context, stepId);
    const schemaText = JSON.stringify(schema, null, 2);
    
    return this.getPromptTemplate()
      .replace('{sessionId}', context.contextId)
      .replace('{stepId}', stepId.toString())
      .replace('{totalSteps}', context.steps.length.toString())
      .replace('{stepName}', stepName)
      .replace('{contextualHistory}', history)
      .replace('{responseSchema}', schemaText);
  }

  private formatExecutionHistory(context: ContextData, currentStepId: number): string {
    // Format previous steps summary
    // Format current step attempts
    // Return concise but informative history
  }

  private getPromptTemplate(): string {
    // Return the complete prompt template string
  }
}
```

## Prompt Optimization Features

### Context Management
- **Selective History**: Include relevant execution history without overwhelming context
- **Step Focus**: Emphasize current step objectives while maintaining workflow awareness
- **Dynamic Adaptation**: Adjust prompt based on success/failure patterns

### AI Model Optimization
- **Clear Instructions**: Unambiguous command descriptions and expectations
- **Structured Format**: Consistent prompt structure for predictable AI behavior
- **Confidence Metrics**: Explicit confidence level requirements and reasoning
- **Error Recovery**: Guidance for handling unexpected page states

### Response Quality
- **Schema Enforcement**: Embedded JSON schema ensures consistent response format
- **Flow Control**: Clear instructions for task loop continuation/termination
- **Reasoning Requirements**: Mandatory explanation fields for decision transparency

## Integration Points

### AI Context Manager
```typescript
// Session initialization
contextManager.createContext(sessionId);
contextManager.setSteps(sessionId, steps);

// Context retrieval for prompt generation
const context = contextManager.getFullContext(sessionId);
const stepContext = contextManager.getStepContext(sessionId, stepId);
```

### AI Schema Manager
```typescript
// Schema embedding in prompts
const responseSchema = schemaManager.getAIResponseSchema();
const schemaText = JSON.stringify(responseSchema, null, 2);
```

### Task Loop Integration
```typescript
// Typical usage pattern
promptManager.init(sessionId, workflowSteps);
const prompt = promptManager.getStepPrompt(sessionId, currentStepId);
// Send prompt to AI Integration module
```

## Error Handling

### Validation
- Verify session exists before prompt generation
- Validate step ID within bounds
- Ensure context manager and schema manager are available

### Graceful Degradation
- Generate basic prompt if context unavailable
- Include minimal schema if schema manager fails
- Provide fallback instructions for unexpected states

## Performance Considerations

### Efficiency
- Template caching for repeated prompt generation
- Minimal context formatting overhead
- Lazy loading of prompt components

### Memory Management
- Avoid storing large prompt strings
- Stream-based prompt building for large contexts
- Garbage collection friendly implementation

## Module Structure

```
/src/modules/ai-prompt-manager/
  ├── index.ts           # Main interface implementation
  ├── prompt-builder.ts  # Core prompt generation logic
  ├── templates.ts       # Prompt template definitions
  └── types.ts          # TypeScript type definitions
```

## Testing Requirements

- Prompt generation with various context states
- Template variable replacement accuracy
- Integration with context and schema managers
- Error handling for invalid sessions/steps
- Prompt length and format validation

## Non-Functional Requirements

### Simplicity
- Minimal configuration required
- Straightforward API with clear purpose
- No complex state management

### Reliability
- Consistent prompt generation
- Robust error handling
- Predictable behavior across sessions

### Maintainability
- Template-based approach for easy prompt updates
- Clear separation of concerns
- Comprehensive logging for debugging

## Out of Scope

- AI model selection or configuration
- Response parsing or validation
- Direct AI service communication
- Prompt performance analytics
- Multi-language prompt support
- Custom prompt templates per user
