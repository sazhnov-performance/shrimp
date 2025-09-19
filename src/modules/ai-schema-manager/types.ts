/**
 * TypeScript type definitions for AI Schema Manager
 */

export interface IAISchemaManager {
  // Singleton instance access
  getAIResponseSchema(): AIResponseSchema;
  
  // Get image analysis schema
  getImageAnalysisSchema(): ImageAnalysisSchema;
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
      type: "string";
      enum: ["LOW", "MEDIUM", "HIGH"];
      description: "Confidence level for the decision: LOW (uncertain/exploratory), MEDIUM (moderate confidence), HIGH (very confident)";
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

export interface ImageAnalysisSchema {
  type: "object";
  required: ["overallDescription", "interactibleElements"];
  properties: {
    overallDescription: {
      type: "string";
      description: "Overall description of what is visible in the image, including layout, content, and visual state";
    };
    interactibleElements: {
      type: "array";
      description: "List of elements that can be interacted with (buttons, links, forms, etc.)";
      items: {
        type: "object";
        required: ["type", "description", "location", "coordinates"];
        properties: {
          type: {
            type: "string";
            enum: ["button", "link", "input", "select", "checkbox", "radio", "textarea", "image", "menu", "other"];
            description: "Type of interactible element";
          };
          description: {
            type: "string";
            description: "Description of the element including visible text or labels";
          };
          location: {
            type: "string";
            description: "Description of where the element is positioned (e.g., 'top-right corner', 'center of page', 'navigation bar')";
          };
          coordinates: {
            type: "object";
            required: ["x", "y"];
            properties: {
              x: {
                type: "number";
                description: "Horizontal position in pixels from the left edge of the viewport";
              };
              y: {
                type: "number";
                description: "Vertical position in pixels from the top edge of the viewport";
              };
            };
            description: "Pixel coordinates of the UI element with origin at top-left corner (0,0)";
          };
          containsText: {
            type: "string";
            description: "Optional: Visible text content within the element (button text, link text, labels, etc.)";
          };
        };
      };
    };
  };
}
