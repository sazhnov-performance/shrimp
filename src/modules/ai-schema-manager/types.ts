/**
 * TypeScript type definitions for AI Schema Manager
 */

export interface IAISchemaManager {
  // Singleton instance access
  getAIResponseSchema(): object;
}

export interface AISchemaManagerConfig {
  schemaVersion?: string;
  validationEnabled?: boolean;
  cacheSchemas?: boolean;
}

export interface AIResponseSchema {
  type: "object";
  required: ["reasoning", "confidence", "flowControl"];
  properties: {
    action: {
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
