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
      type: "string",
      enum: ["LOW", "MEDIUM", "HIGH"],
      description: "Confidence level for the decision: LOW (uncertain/exploratory), MEDIUM (moderate confidence), HIGH (very confident)"
    },
    flowControl: {
      type: "string",
      enum: ["continue", "stop_success", "stop_failure"],
      description: "Task loop control: continue to next iteration, stop with success, or stop with failure"
    }
  }
};

/**
 * Image Analysis Response Schema - for AI to provide image analysis feedback
 */
export const IMAGE_ANALYSIS_SCHEMA = {
  type: "object",
  required: ["overallDescription", "interactibleElements"],
  properties: {
    overallDescription: {
      type: "string",
      description: "Overall description of what is visible in the image, including layout, content, and visual state"
    },
    interactibleElements: {
      type: "array",
      description: "List of elements that can be interacted with (buttons, links, forms, etc.)",
      items: {
        type: "object",
        required: ["description", "location"],
        properties: {
          description: {
            type: "string",
            description: "Description of the element including visible text or labels"
          },
          location: {
            type: "string",
            description: "Description of where the element is positioned (e.g., 'top-right corner', 'center of page', 'navigation bar')"
          },
          containsText: {
            type: "string",
            description: "Optional: Visible text content within the element (button text, link text, labels, etc.)"
          }
        }
      }
    }
  }
};