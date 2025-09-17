/**
 * AI Prompt Manager Implementation
 * 
 * A minimalistic module responsible for generating context-aware prompts 
 * for AI automation agents. Combines execution context, response schemas, 
 * and specialized instructions to create optimized prompts.
 */

import { IAIPromptManager, AIPromptManagerConfig } from './types';
import { IAIContextManager, ContextData } from '../ai-context-manager/types';
import { AIContextManager } from '../ai-context-manager/ai-context-manager';
import { IAISchemaManager } from '../ai-schema-manager/types';
import AISchemaManager from '../ai-schema-manager/index';
import { PromptBuilder } from './prompt-builder';

export class AIPromptManager implements IAIPromptManager {
  private static instance: AIPromptManager | null = null;
  private contextManager: IAIContextManager;
  private schemaManager: IAISchemaManager;
  private promptBuilder: PromptBuilder;
  private config: AIPromptManagerConfig;

  private constructor(config: AIPromptManagerConfig = {}) {
    // Resolve dependencies internally using singleton instances
    this.contextManager = AIContextManager.getInstance();
    this.schemaManager = AISchemaManager.getInstance();
    
    this.config = {
      maxPromptLength: 8000,
      templateVersion: '1.0',
      cacheEnabled: false,
      ...config
    };

    this.promptBuilder = new PromptBuilder(this.config.maxPromptLength);
  }

  /**
   * Get singleton instance of AIPromptManager
   * @param config Optional configuration for the prompt manager
   * @returns AIPromptManager instance
   */
  static getInstance(config?: AIPromptManagerConfig): IAIPromptManager {
    if (!AIPromptManager.instance) {
      AIPromptManager.instance = new AIPromptManager(config);
    }
    return AIPromptManager.instance;
  }

  /**
   * Initialize context with session and workflow steps
   * @param sessionId Unique session identifier
   * @param steps Array of step descriptions for the workflow
   */
  init(sessionId: string, steps: string[]): void {
    try {
      // Create context using AI Context Manager
      this.contextManager.createContext(sessionId);
      
      // Store step definitions for the workflow
      this.contextManager.setSteps(sessionId, steps);
      
      // Validation is handled by the context manager
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        throw new Error(`Session "${sessionId}" is already initialized`);
      }
      throw error;
    }
  }

  /**
   * Generate complete prompt for specific workflow step
   * @param sessionId Session identifier
   * @param stepId Step index (0-based)
   * @returns Formatted prompt optimized for AI models
   */
  getStepPrompt(sessionId: string, stepId: number): string {
    try {
      // Validate session exists
      const context = this.contextManager.getFullContext(sessionId);
      
      // Validate step ID within bounds
      if (stepId < 0 || stepId >= context.steps.length) {
        throw new Error(`Step ID ${stepId} is out of bounds for session "${sessionId}"`);
      }

      // Get response schema from AI Schema Manager
      const schema = this.schemaManager.getAIResponseSchema();
      
      // Build and return formatted prompt
      return this.promptBuilder.buildPrompt(context, stepId, schema);
      
    } catch (error) {
      if (error instanceof Error) {
        // Re-throw validation errors
        if (error.message.includes('does not exist') || 
            error.message.includes('out of bounds')) {
          throw error;
        }
      }
      
      // For other errors, attempt graceful degradation
      return this.generateFallbackPrompt(sessionId, stepId);
    }
  }

  /**
   * Generate basic prompt if main prompt generation fails
   * @param sessionId Session identifier
   * @param stepId Step index
   * @returns Basic fallback prompt
   */
  private generateFallbackPrompt(sessionId: string, stepId: number): string {
    try {
      const fallbackSchema = {
        type: "object",
        required: ["reasoning", "confidence", "flowControl"],
        properties: {
          reasoning: { type: "string" },
          confidence: { type: "integer", minimum: 0, maximum: 100 },
          flowControl: { type: "string", enum: ["continue", "stop_success", "stop_failure"] }
        }
      };
      
      const schemaText = JSON.stringify(fallbackSchema, null, 2);
      
      return `ROLE: You are an intelligent web automation agent.

CURRENT STEP: Step ${stepId + 1}

AVAILABLE COMMANDS:
- OPEN_PAGE: Navigate to a URL
- CLICK_ELEMENT: Click on page elements using CSS selectors
- INPUT_TEXT: Enter text into form fields
- GET_SUBDOM: Investigate page sections for element discovery

RESPONSE FORMAT:
${schemaText}

Execute automation step ${stepId + 1} with the available commands.`;
      
    } catch (error) {
      // Absolute fallback
      return `Execute automation step ${stepId + 1}. Respond with JSON containing reasoning, confidence, and flowControl fields.`;
    }
  }
}

// Export the class and types for external use
export type { IAIPromptManager, AIPromptManagerConfig, ContextualHistory } from './types';
export default AIPromptManager;
