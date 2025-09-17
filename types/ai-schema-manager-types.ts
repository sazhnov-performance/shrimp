/**
 * AI Schema Manager Types
 * Defines types for AI response schemas used in the automation system
 * Based on design/ai-schema-manager.md specifications
 */

// Main interface for AI Schema Manager
export interface IAISchemaManager {
  getAIResponseSchema(): object;
}

// AI Response Schema Structure for JSON Schema
export interface AIResponseSchema {
  type: "object";
  required: ["reasoning", "confidence", "flowControl"];
  properties: {
    action: ExecutorActionSchema & {
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

// Executor Action Schema for JSON Schema
export interface ExecutorActionSchema {
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

// TypeScript interface for AI response data (what AI actually returns)
export interface AIResponseData {
  action?: ExecutorAction;
  reasoning: string;
  confidence: number;
  flowControl: "continue" | "stop_success" | "stop_failure";
}

// TypeScript interface for executor action
export interface ExecutorAction {
  command: "OPEN_PAGE" | "CLICK_ELEMENT" | "INPUT_TEXT" | "GET_SUBDOM";
  parameters: {
    url?: string;
    selector?: string;
    text?: string;
  };
}

// Flow control options
export type FlowControlOption = "continue" | "stop_success" | "stop_failure";

// Command types available to AI
export type ExecutorCommand = "OPEN_PAGE" | "CLICK_ELEMENT" | "INPUT_TEXT" | "GET_SUBDOM";
