/**
 * AI Schema Manager Internal Types
 * Additional type definitions used within the module
 * Based on design/ai-schema-manager.md specifications
 */

// Re-export types from shared types for convenience
export type {
  IAISchemaManager,
  AIResponseSchema,
  ExecutorActionSchema,
  AIResponseData,
  ExecutorAction,
  FlowControlOption,
  ExecutorCommand
} from '../../../types/ai-schema-manager-types';

// Example response objects for testing and documentation
export const EXAMPLE_RESPONSES = {
  openPage: {
    action: {
      command: "OPEN_PAGE",
      parameters: {
        url: "https://example.com/login"
      }
    },
    reasoning: "Starting automation by navigating to the login page.",
    confidence: 95,
    flowControl: "continue"
  },

  clickElement: {
    action: {
      command: "CLICK_ELEMENT",
      parameters: {
        selector: "button[data-testid='submit-btn']"
      }
    },
    reasoning: "Located submit button using test ID attribute for reliability.",
    confidence: 85,
    flowControl: "continue"
  },

  inputText: {
    action: {
      command: "INPUT_TEXT",
      parameters: {
        selector: "input[name='email']",
        text: "user@example.com"
      }
    },
    reasoning: "Filling email field with provided credentials.",
    confidence: 90,
    flowControl: "continue"
  },

  getSubDom: {
    action: {
      command: "GET_SUBDOM",
      parameters: {
        selector: ".error-messages"
      }
    },
    reasoning: "Need to examine error messages to understand validation failures.",
    confidence: 80,
    flowControl: "continue"
  },

  stopSuccess: {
    reasoning: "Successfully completed all automation steps. Login form filled and submitted, confirmation page loaded.",
    confidence: 92,
    flowControl: "stop_success"
  },

  stopFailure: {
    reasoning: "Unable to locate expected elements after multiple attempts. Page structure may have changed.",
    confidence: 78,
    flowControl: "stop_failure"
  }
} as const;
