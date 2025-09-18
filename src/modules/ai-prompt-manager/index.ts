/**
 * AI Prompt Manager Implementation
 * 
 * A minimalistic module responsible for generating context-aware prompts 
 * for AI automation agents. Combines execution context, response schemas, 
 * and specialized instructions to create optimized prompts.
 */

import { IAIPromptManager, AIPromptManagerConfig, PromptContent } from './types';
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
   * Get system and user messages for specific workflow step
   * @param sessionId Session identifier
   * @param stepId Step index (0-based)
   * @returns Object with system and user message content
   */
  getStepMessages(sessionId: string, stepId: number): PromptContent {
    try {
      // Validate session exists
      const context = this.contextManager.getFullContext(sessionId);
      
      // Validate step ID within bounds
      if (stepId < 0 || stepId >= context.steps.length) {
        throw new Error(`Step ID ${stepId} is out of bounds for session "${sessionId}"`);
      }

      // Get response schema from AI Schema Manager
      const schema = this.schemaManager.getAIResponseSchema();
      
      // Build and return formatted messages
      return this.promptBuilder.buildMessages(context, stepId, schema);
      
    } catch (error) {
      if (error instanceof Error) {
        // Re-throw validation errors
        if (error.message.includes('does not exist') || 
            error.message.includes('out of bounds')) {
          throw error;
        }
      }
      
      // Use prompt builder with minimal context for errors
      const minimalContext = {
        contextId: sessionId,
        steps: [`Step ${stepId + 1}`],
        stepLogs: {},
        createdAt: new Date(),
        lastUpdated: new Date()
      };
      const basicSchema = {
        type: "object",
        required: ["reasoning", "confidence", "flowControl"],
        properties: {
          reasoning: { type: "string" },
          confidence: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
          flowControl: { type: "string", enum: ["continue", "stop_success", "stop_failure"] }
        }
      };
      return this.promptBuilder.buildMessages(minimalContext, 0, basicSchema);
    }
  }

  /**
   * Generate complete prompt for specific workflow step (backward compatibility)
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
      
      // Use prompt builder with minimal context for errors
      const minimalContext = {
        contextId: sessionId,
        steps: [`Step ${stepId + 1}`],
        stepLogs: {},
        createdAt: new Date(),
        lastUpdated: new Date()
      };
      const basicSchema = {
        type: "object",
        required: ["reasoning", "confidence", "flowControl"],
        properties: {
          reasoning: { type: "string" },
          confidence: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
          flowControl: { type: "string", enum: ["continue", "stop_success", "stop_failure"] }
        }
      };
      return this.promptBuilder.buildPrompt(minimalContext, 0, basicSchema);
    }
  }


}

// Export the class and types for external use
export type { IAIPromptManager, AIPromptManagerConfig, ContextualHistory } from './types';
export default AIPromptManager;
