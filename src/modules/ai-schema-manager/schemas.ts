/**
 * JSON schema definitions for AI responses
 */

/**
 * Executor Action Schema - defines available commands and their parameters
 */
export const EXECUTOR_ACTION_SCHEMA = {
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
        url: { 
          type: "string",
          description: "URL for OPEN_PAGE command"
        },
        selector: { 
          type: "string",
          description: "CSS selector for element targeting"
        },
        text: { 
          type: "string",
          description: "Text input for INPUT_TEXT command"
        }
      }
    }
  }
};

/**
 * Complete AI Response Schema - includes action, reasoning, confidence, and flow control
 */
export const AI_RESPONSE_SCHEMA = {
  type: "object",
  required: ["reasoning", "confidence", "flowControl"],
  properties: {
    action: {
      ...EXECUTOR_ACTION_SCHEMA,
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
