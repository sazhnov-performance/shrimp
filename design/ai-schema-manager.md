# AI Schema Manager Design Document

## Overview
The AI Schema Manager provides dynamic schema construction for AI responses that contain web automation commands. It creates structured schemas that define how AI responses should be formatted to include executor module method calls along with reasoning and context. The AI responses contain commands without session IDs, as session management is handled externally and session IDs are injected before commands reach the executor.

## Core Responsibilities
- Generate JSON schemas for AI response formatting
- Define structure for executor command calls in AI responses (without session IDs)
- Include reasoning fields for AI decision transparency
- Validate AI response structure against generated schemas
- Support all executor module commands (session management handled externally)
- Provide schema versioning and compatibility
- Support command transformation from AI format to executor format

## Module Interface

### Schema Generation
```typescript
interface AISchemaManager {
  generateResponseSchema(options?: SchemaOptions): ResponseSchema;
  validateAIResponse(response: any, schema: ResponseSchema): ValidationResult;
  getExecutorMethodSchemas(): ExecutorMethodSchemas;
  updateSchemaVersion(version: string): void;
}

interface SchemaOptions {
  includeOptionalFields?: boolean;
  requireReasoning?: boolean;
  validationMode?: 'strict' | 'lenient';
}
```

### Response Schema Structure (UPDATED: Single Command Only)
```typescript
// Import shared types for consistency
import { AIResponse, AIGeneratedCommand, DecisionAction } from './shared-types';

interface ResponseSchema {
  $schema: string;
  type: 'object';
  properties: {
    decision: DecisionSchema;
    reasoning: ReasoningSchema;
    command?: CommandSchema;  // UPDATED: Single optional command (not array)
    context?: ContextSchema;
  };
  required: string[];
  additionalProperties: boolean;
}

interface DecisionSchema {
  type: 'object';
  properties: {
    action: ActionDecisionSchema;
    resultValidation?: ResultValidationSchema;
    message: StringSchema;
  };
  required: string[];
}

interface ActionDecisionSchema {
  enum: ['PROCEED', 'RETRY', 'ABORT'];
  type: 'string';
  description: string;
}

interface ResultValidationSchema {
  type: 'object';
  properties: {
    success: BooleanSchema;
    expectedElements: ArraySchema;
    actualState: StringSchema;
    issues?: ArraySchema;
  };
  required: string[];
}

interface ReasoningSchema {
  type: 'object';
  properties: {
    analysis: StringSchema;
    rationale: StringSchema;
    expectedOutcome: StringSchema;
    alternatives?: StringSchema;
  };
  required: string[];
}
```

### Command Schema (UPDATED: Single Command)
```typescript
interface CommandSchema {
  type: 'object';
  properties: {
    action: CommandActionSchema;
    parameters: CommandParametersSchema;
    reasoning?: { type: 'string'; description: 'Explanation for this specific command' };
  };
  required: ['action', 'parameters'];
  additionalProperties: false;
}
```

### Executor Command Schemas (FIXED)
Based on the executor module design and shared types:

#### Session Management
Session management is handled externally. The AI generates `AIGeneratedCommand` without session IDs, and the Task Loop injects session IDs to create `ExecutorCommand` before sending to the executor.

#### Web Automation Command Schemas (FIXED: Uses shared CommandAction enum)
```typescript
interface CommandActionSchema {
  enum: ['OPEN_PAGE', 'CLICK_ELEMENT', 'INPUT_TEXT', 'SAVE_VARIABLE', 'GET_DOM'];
  type: 'string';
  description: 'Type of automation command to execute';
}

interface CommandParametersSchema {
  type: 'object';
  properties: {
    url: { 
      type: 'string'; 
      format: 'uri';
      description: 'URL to navigate to (OPEN_PAGE only)';
    };
    selector: { 
      type: 'string'; 
      minLength: 1;
      description: 'CSS selector for target element';
    };
    text: { 
      type: 'string';
      description: 'Text to input (INPUT_TEXT only)';
    };
    variableName: { 
      type: 'string'; 
      pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$';
      description: 'Variable name for stored value (SAVE_VARIABLE only)';
    };
  };
  additionalProperties: false;
  // Note: required fields depend on command action, validated by command-specific schemas
}

// Command-specific schemas with proper parameter requirements
interface AutomationCommandSchemas {
  OPEN_PAGE: {
    type: 'object';
    properties: {
      action: { const: 'OPEN_PAGE' };
      parameters: {
        type: 'object';
        properties: {
          url: { type: 'string'; format: 'uri' };
        };
        required: ['url'];
        additionalProperties: false;
      };
    };
    required: ['action', 'parameters'];
  };
  
  CLICK_ELEMENT: {
    type: 'object';
    properties: {
      action: { const: 'CLICK_ELEMENT' };
      parameters: {
        type: 'object';
        properties: {
          selector: { type: 'string'; minLength: 1 };
        };
        required: ['selector'];
        additionalProperties: false;
      };
    };
    required: ['action', 'parameters'];
  };
  
  INPUT_TEXT: {
    type: 'object';
    properties: {
      action: { const: 'INPUT_TEXT' };
      parameters: {
        type: 'object';
        properties: {
          selector: { type: 'string'; minLength: 1 };
          text: { type: 'string' };
        };
        required: ['selector', 'text'];
        additionalProperties: false;
      };
    };
    required: ['action', 'parameters'];
  };
  
  SAVE_VARIABLE: {
    type: 'object';
    properties: {
      action: { const: 'SAVE_VARIABLE' };
      parameters: {
        type: 'object';
        properties: {
          selector: { type: 'string'; minLength: 1 };
          variableName: { type: 'string'; pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$' };
        };
        required: ['selector', 'variableName'];
        additionalProperties: false;
      };
    };
    required: ['action', 'parameters'];
  };
  
  GET_DOM: {
    type: 'object';
    properties: {
      action: { const: 'GET_DOM' };
      parameters: {
        type: 'object';
        properties: {};
        additionalProperties: false;
      };
    };
    required: ['action', 'parameters'];
  };
}
```

## Core Functionality

### 1. Schema Generation
```typescript
async generateResponseSchema(options: SchemaOptions = {}): Promise<ResponseSchema>
```
- Create complete JSON schema for AI responses
- Include decision making structure for result evaluation
- Include all available executor commands
- Support reasoning structure requirements
- Allow customization through options

### 2. Decision Making Schema
```typescript
private buildDecisionSchema(): DecisionSchema
```
- Define structure for AI decision making process
- Support three action types: PROCEED, RETRY, ABORT
- Include result validation fields for previous execution analysis
- Provide clear messaging for decision rationale

### 3. Command Schema Assembly
```typescript
private assembleCommandSchemas(): CommandSchemas
```
- Combine session management and automation command schemas
- Apply validation rules for each command type
- Include variable interpolation patterns (${variable_name})
- Support command parameter validation

### 4. Reasoning Schema Construction
```typescript
private buildReasoningSchema(requireReasoning: boolean): ReasoningSchema
```
- Define structure for AI reasoning fields
- Include analysis, rationale, and expected outcome
- Support optional alternative consideration field
- Ensure reasoning completeness validation

### 5. Response Validation
```typescript
async validateAIResponse(response: any, schema: ResponseSchema): Promise<ValidationResult>
```
- Validate AI response structure against generated schema
- Check decision logic and result validation
- Verify single command parameter completeness (when present)
- Verify reasoning field requirements
- Return detailed validation errors

## Decision Making Process

### Decision Action Types
The AI must evaluate the current state and choose one of three actions:

#### 1. PROCEED
- **When**: Previous execution was successful and matches expectations
- **Behavior**: Continue to next step in the workflow
- **Command**: Optional - may include next command or indicate completion

#### 2. RETRY
- **When**: Previous execution failed or result doesn't match expectations
- **Behavior**: Request new executor action to correct the situation
- **Command**: Required - must include corrective action

#### 3. ABORT
- **When**: Unrecoverable state detected (e.g., essential element missing, critical error)
- **Behavior**: Stop execution and report failure
- **Command**: Not allowed - execution should halt, no command provided

### Result Validation Structure
```typescript
interface ResultValidation {
  success: boolean;          // Overall success assessment
  expectedElements: string[]; // Elements that should be present
  actualState: string;       // Description of current page state
  issues?: string[];         // Specific problems identified
}
```

## Reasoning Field Requirements

### Mandatory Reasoning Structure
```typescript
interface AIResponseReasoning {
  analysis: string;          // Current situation analysis
  rationale: string;         // Why this decision was made
  expectedOutcome: string;   // Predicted result of decision
  alternatives?: string;     // Other approaches considered
}
```

### Reasoning Validation Rules
- **Analysis**: Must describe current page state and previous result evaluation
- **Rationale**: Must explain why this specific decision (PROCEED/RETRY/ABORT) was chosen
- **Expected Outcome**: Must predict the result of the decision
- **Alternatives**: Optional field for explaining other considered approaches

### Example AI Response Structures

#### Example 1: RETRY - Previous Action Failed (UPDATED: Single Command)
```json
{
  "decision": {
    "action": "RETRY",
    "resultValidation": {
      "success": false,
      "expectedElements": ["input[name='username']", "input[name='password']"],
      "actualState": "Page loaded but login form is not visible",
      "issues": ["Login form container is hidden", "No input fields detected"]
    },
    "message": "Login form not found, trying alternative approach"
  },
  "reasoning": {
    "analysis": "Previous OPEN_PAGE command executed but the expected login form is not visible on the page.",
    "rationale": "The form might be hidden or use different selectors. Attempting to reveal the form by clicking a login button.",
    "expectedOutcome": "Login form will become visible after clicking the login button.",
    "confidence": 0.7,
    "alternatives": "Could try different page URL or wait for dynamic content to load."
  },
  "command": {
    "action": "CLICK_ELEMENT",
    "parameters": {
      "selector": "button[data-test='login-btn']"
    },
    "reasoning": "Try clicking login button to reveal form"
  }
}
```

#### Example 2: PROCEED - Success, Next Step (UPDATED: Single Command)
```json
{
  "decision": {
    "action": "PROCEED",
    "resultValidation": {
      "success": true,
      "expectedElements": ["input[name='username']", "input[name='password']", "button[type='submit']"],
      "actualState": "Login page loaded successfully with all required form elements visible"
    },
    "message": "Login page ready, proceeding to enter username"
  },
  "reasoning": {
    "analysis": "Login page has loaded successfully and all required form elements are present and accessible.",
    "rationale": "Form is ready for input, starting with username entry as the first step in the login workflow.",
    "expectedOutcome": "Username will be entered into the form field successfully.",
    "confidence": 0.9,
    "alternatives": "Could validate form fields first, but they appear functional."
  },
  "command": {
    "action": "INPUT_TEXT",
    "parameters": {
      "selector": "input[name='username']",
      "text": "${saved_username}"
    },
    "reasoning": "Enter username into the login form as the first step"
  }
}
```

#### Example 3: ABORT - Unrecoverable State (UPDATED: No Command)
```json
{
  "decision": {
    "action": "ABORT",
    "resultValidation": {
      "success": false,
      "expectedElements": ["login form", "navigation elements"],
      "actualState": "404 error page displayed",
      "issues": ["Target URL does not exist", "No login functionality available"]
    },
    "message": "Login page not found - URL appears to be invalid"
  },
  "reasoning": {
    "analysis": "Navigation to login URL resulted in 404 error, indicating the page does not exist.",
    "rationale": "Cannot proceed with login workflow as the target page is unavailable.",
    "expectedOutcome": "Execution halted due to invalid URL.",
    "confidence": 0.95,
    "alternatives": "Could try different URLs, but without valid login page, authentication is impossible."
  }
}
```

## Implementation Guidelines

### Modular Structure
```
/src/modules/ai-schema-manager/
  ├── index.ts                    # Main schema manager interface
  ├── schema-generator.ts         # Core schema generation logic
  ├── command-schema-builder.ts   # Executor command schema construction
  ├── reasoning-schema-builder.ts # Reasoning field schema construction
  ├── validator.ts                # Response validation logic
  ├── schema-cache.ts             # Schema caching and optimization
  └── types.ts                    # TypeScript type definitions
```

### Dependencies
- ajv: JSON schema validation
- executor module types: Command interfaces and enums
- lodash: Object manipulation utilities

### Configuration
```typescript
// Import shared configuration pattern
import { BaseModuleConfig, DEFAULT_TIMEOUT_CONFIG } from './shared-types';

interface AISchemaManagerConfig extends BaseModuleConfig {
  moduleId: 'ai-schema-manager';
  
  // AI Schema Manager specific configuration
  schema: {
    version: string;
    defaultOptions: SchemaOptions;
    cacheEnabled: boolean;
    validationMode: 'strict' | 'lenient';
    reasoningRequired: boolean;
  };
  
  // Inherits from BaseModuleConfig:
  // - logging: LoggingConfig
  // - performance: PerformanceConfig
  // - timeouts: TimeoutConfig
}
```

## Integration with Executor Module

### Command Alignment
- All executor CommandAction enum values must be supported
- Parameter validation must match executor expectations
- Variable interpolation patterns must be compatible
- Session ID formats must align with executor requirements

### Error Handling Coordination
```typescript
interface SchemaValidationError {
  field: string;
  message: string;
  value: any;
  expectedType: string;
  path: string[];
}

interface ValidationResult {
  valid: boolean;
  errors: SchemaValidationError[];
  warnings: string[];
  executorCompatible: boolean;
}
```

## Testing Requirements
- Schema generation for all executor commands
- Response validation with valid and invalid inputs
- Reasoning field requirement enforcement
- Variable interpolation pattern validation
- Single command parameter validation edge cases
- Schema caching and performance tests

## Security Considerations
- Validate all selector patterns to prevent injection
- Sanitize URL parameters in OPEN_PAGE commands
- Ensure variable name patterns are safe
- Validate command parameter types strictly
- Prevent schema manipulation attacks

## Performance Requirements
- Schema generation should complete within 100ms
- Response validation should complete within 50ms
- Support schema caching for repeated requests
- Memory-efficient schema storage
- Lazy loading of unused command schemas

## Future Enhancements
- Support for conditional command execution schemas
- Advanced reasoning pattern templates
- Multi-language reasoning field support
- Schema evolution and backward compatibility
- Integration with AI model fine-tuning data
- Automated schema optimization based on usage patterns
