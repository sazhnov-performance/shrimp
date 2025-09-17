/**
 * AI Schema Manager - Singleton implementation
 * Provides standardized JSON schemas for AI responses in the automation system.
 */

import { IAISchemaManager, AISchemaManagerConfig, AIResponseSchema } from './types';
import { AI_RESPONSE_SCHEMA, EXECUTOR_ACTION_SCHEMA } from './schemas';

/**
 * AISchemaManager - Singleton class that provides JSON schemas for AI responses
 */
class AISchemaManager implements IAISchemaManager {
  private static instance: AISchemaManager | null = null;
  private config: AISchemaManagerConfig;

  private constructor(config: AISchemaManagerConfig = {}) {
    this.config = {
      schemaVersion: '1.0',
      validationEnabled: true,
      cacheSchemas: true,
      ...config
    };
  }

  /**
   * Get singleton instance of AISchemaManager
   * @param config Optional configuration for the schema manager
   * @returns AISchemaManager instance
   */
  static getInstance(config?: AISchemaManagerConfig): IAISchemaManager {
    if (!AISchemaManager.instance) {
      AISchemaManager.instance = new AISchemaManager(config);
    }
    return AISchemaManager.instance;
  }

  /**
   * Get the complete AI response schema including action, reasoning, confidence, and flow control
   * @returns JSON schema object for AI responses
   */
  getAIResponseSchema(): AIResponseSchema {
    const executorActionSchema = this.getExecutorActionSchema();
    return {
      type: "object",
      required: ["reasoning", "confidence", "flowControl"],
      properties: {
        action: {
          type: "object",
          required: ["command", "parameters"],
          properties: (executorActionSchema as any).properties,
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
   * Get the executor action schema for available commands
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
            url: { type: "string" },
            selector: { type: "string" },
            text: { type: "string" }
          }
        }
      }
    };
  }
}

// Export the class and types for external use
export type { IAISchemaManager, AISchemaManagerConfig } from './types';
export default AISchemaManager;
