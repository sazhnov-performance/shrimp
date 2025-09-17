# AI Schema Manager Design Document

## Overview
The AI Schema Manager provides standardized JSON schemas for AI responses in the automation system. It enables the AI to utilize core executor operations (open page, click element, input text, get sub-DOM) and control the task loop flow through structured, validated responses.

## Core Responsibility
Return schemas for embedding in AI requests to ensure consistent, structured responses from AI models.

## Module Interface

### Primary Interface
```typescript
interface IAISchemaManager {
  getAIResponseSchema(): object;
}
```

## Response Schema Structure

### Complete AI Response Schema
```typescript
interface AIResponseSchema {
  type: "object";
  required: ["reasoning", "confidence", "flowControl"];
  properties: {
    action: {
      ...ExecutorActionSchema;
      description: "Executor command to execute (required only when flowControl is 'continue')";
    };
    reasoning: {
      type: "string";
      description: "Explanation of decision-making process and rationale";
    };
    confidence: {
      type: "integer";
      minimum: 0;
      maximum: 100;
      description: "Confidence level in the decision (0-100 scale)";
    };
    flowControl: {
      type: "string";
      enum: ["continue", "stop_success", "stop_failure"];
      description: "Task loop control: continue to next iteration, stop with success, or stop with failure";
    };
  };
}
```

### Executor Action Schema
Core operations available to AI:
```typescript
interface ExecutorActionSchema {
  type: "object";
  required: ["command", "parameters"];
  properties: {
    command: {
      type: "string";
      enum: [
        "OPEN_PAGE",
        "CLICK_ELEMENT", 
        "INPUT_TEXT",
        "GET_SUBDOM"
      ];
    };
    parameters: {
      type: "object";
      properties: {
        url: {
          type: "string";
          description: "URL for OPEN_PAGE command";
        };
        selector: {
          type: "string"; 
          description: "CSS selector for element targeting";
        };
        text: {
          type: "string";
          description: "Text input for INPUT_TEXT command";
        };
      };
    };
  };
}
```

## Implementation

### Schema Manager Class
```typescript
class AISchemaManager {
  getAIResponseSchema(): object {
    return {
      type: "object",
      required: ["reasoning", "confidence", "flowControl"],
      properties: {
        action: {
          ...this.getExecutorActionSchema(),
          description: "Executor command to execute (required only when flowControl is 'continue')"
        },
        reasoning: {
          type: "string",
          description: "Explanation of decision-making process and rationale"
        },
        confidence: {
          type: "integer", 
          minimum: 0,
          maximum: 100,
          description: "Confidence level in the decision (0-100 scale)"
        },
        flowControl: {
          type: "string",
          enum: ["continue", "stop_success", "stop_failure"],
          description: "Task loop control: continue to next iteration, stop with success, or stop with failure"
        }
      }
    };
  }

  private getExecutorActionSchema(): object {
    return {
      type: "object",
      required: ["command", "parameters"],
      properties: {
        command: {
          type: "string",
          enum: [
            "OPEN_PAGE",
            "CLICK_ELEMENT",
            "INPUT_TEXT", 
            "GET_SUBDOM"
          ]
        },
        parameters: {
          type: "object",
          properties: {
            url: { type: "string" },
            selector: { type: "string" },
            text: { type: "string" }
          }
        }
      }
    };
  }
}
```

## Usage Examples

### Open Page
```json
{
  "action": {
    "command": "OPEN_PAGE",
    "parameters": {
      "url": "https://example.com/login"
    }
  },
  "reasoning": "Starting automation by navigating to the login page.",
  "confidence": 95,
  "flowControl": "continue"
}
```

### Click Element
```json
{
  "action": {
    "command": "CLICK_ELEMENT",
    "parameters": {
      "selector": "button[data-testid='submit-btn']"
    }
  },
  "reasoning": "Located submit button using test ID attribute for reliability.",
  "confidence": 85,
  "flowControl": "continue"
}
```

### Input Text
```json
{
  "action": {
    "command": "INPUT_TEXT",
    "parameters": {
      "selector": "input[name='email']",
      "text": "user@example.com"
    }
  },
  "reasoning": "Filling email field with provided credentials.",
  "confidence": 90,
  "flowControl": "continue"
}
```

### Get Sub-DOM
```json
{
  "action": {
    "command": "GET_SUBDOM",
    "parameters": {
      "selector": ".error-messages"
    }
  },
  "reasoning": "Need to examine error messages to understand validation failures.",
  "confidence": 80,
  "flowControl": "continue"
}
```

### Stop with Success (no action required)
```json
{
  "reasoning": "Successfully completed all automation steps. Login form filled and submitted, confirmation page loaded.",
  "confidence": 92,
  "flowControl": "stop_success"
}
```

### Stop with Failure (no action required)
```json
{
  "reasoning": "Unable to locate expected elements after multiple attempts. Page structure may have changed.",
  "confidence": 78,
  "flowControl": "stop_failure"
}
```

## Flow Control Options

- `continue`: Proceed to next ACT-REFLECT cycle iteration (requires `action` field)
- `stop_success`: Complete task loop with successful result (no `action` needed)
- `stop_failure`: Terminate task loop with failure status (no `action` needed)

## Implementation Structure

```
/src/modules/ai-schema-manager/
  ├── index.ts        # Main interface implementation  
  ├── schemas.ts      # JSON schema definitions
  └── types.ts        # TypeScript type definitions
```

## Dependencies
- None (pure schema generation)

## Testing Requirements
- Schema validation tests for all 4 core commands
- Parameter validation for url, selector, and text fields
- Flow control enum validation
- JSON schema format compliance
