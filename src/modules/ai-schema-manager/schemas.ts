/**
 * AI Schema Manager Implementation
 * JSON schema definitions for AI responses
 * Based on design/ai-schema-manager.md specifications
 */

import { IAISchemaManager } from '../../../types/ai-schema-manager-types';

export class AISchemaManager implements IAISchemaManager {
  /**
   * Get the complete AI response schema for embedding in AI requests
   * @returns JSON schema object for AI responses
   */
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

  /**
   * Get the executor action schema (private method)
   * @private
   * @returns JSON schema object for executor actions
   */
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
  }
}
