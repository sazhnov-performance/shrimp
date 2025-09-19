/**
 * AI Prompt Manager Implementation
 * 
 * A minimalistic module responsible for generating context-aware prompts 
 * for AI automation agents. Combines execution context, response schemas, 
 * and specialized instructions to create optimized prompts.
 */

import { IAIPromptManager, AIPromptManagerConfig, PromptContent, LatestExecutedStep } from './types';
import { IAIContextManager, ContextData } from '../ai-context-manager/types';
import { AIContextManager } from '../ai-context-manager/ai-context-manager';
import { IAISchemaManager } from '../ai-schema-manager/types';
import AISchemaManager from '../ai-schema-manager/index';
import { PromptBuilder } from './prompt-builder';
import { SYSTEM_TEMPLATE, USER_TEMPLATE, IMAGE_ANALYSIS_SYSTEM_TEMPLATE, IMAGE_ANALYSIS_USER_TEMPLATE } from './templates';

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
      templateVersion: '1.0',
      cacheEnabled: false,
      ...config
    };

    this.promptBuilder = new PromptBuilder(); // Let constructor read from environment variables
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
        screenshotDescriptions: {},
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
        screenshotDescriptions: {},
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

  /**
   * Get image analysis prompt messages for specific session and step
   * @param sessionId Session identifier
   * @param stepId Step index (0-based)
   * @returns Object with system and user message content for image analysis
   */
  getImageAnalysisPrompt(sessionId: string, stepId: number): PromptContent {
    try {
      // Get session context
      const context = this.contextManager.getFullContext(sessionId);
      
      // Validate step ID within bounds
      if (stepId < 0 || stepId >= context.steps.length) {
        throw new Error(`Step ID ${stepId} is out of bounds for session "${sessionId}"`);
      }

      // Get latest executed step data
      const latestStep = this.getLatestExecutedStep(context, stepId);
      
      // Get image analysis schema
      const schema = this.schemaManager.getImageAnalysisSchema();
      const schemaText = JSON.stringify(schema, null, 2);

      // Build system message
      const systemMessage = IMAGE_ANALYSIS_SYSTEM_TEMPLATE
        .replace('{taskName}', latestStep.stepName)
        .replace('{actionName}', latestStep.actionName)
        .replace('{actionParameters}', JSON.stringify(latestStep.actionParameters))
        .replace('{responseSchema}', schemaText);

      // Build user message
      const userMessage = IMAGE_ANALYSIS_USER_TEMPLATE
        .replace('{taskName}', latestStep.stepName)
        .replace('{actionName}', latestStep.actionName)
        .replace('{actionParameters}', JSON.stringify(latestStep.actionParameters));

      return {
        system: systemMessage,
        user: userMessage
      };

    } catch (error) {
      if (error instanceof Error) {
        // Re-throw validation errors
        if (error.message.includes('does not exist') || 
            error.message.includes('out of bounds')) {
          throw error;
        }
      }
      
      // Fallback for errors
      const fallbackSchema = this.schemaManager.getImageAnalysisSchema();
      const schemaText = JSON.stringify(fallbackSchema, null, 2);
      
      return {
        system: IMAGE_ANALYSIS_SYSTEM_TEMPLATE
          .replace('{taskName}', 'Unknown Task')
          .replace('{actionName}', 'Unknown Action')
          .replace('{actionParameters}', '{}')
          .replace('{responseSchema}', schemaText),
        user: IMAGE_ANALYSIS_USER_TEMPLATE
          .replace('{taskName}', 'Unknown Task')
          .replace('{actionName}', 'Unknown Action')
          .replace('{actionParameters}', '{}')
      };
    }
  }

  /**
   * Extract latest executed step data from context
   * @param context Session context data
   * @param stepId Current step ID
   * @returns Latest executed step information
   */
  private getLatestExecutedStep(context: ContextData, stepId: number): LatestExecutedStep {
    // Get the current step name
    const stepName = context.steps[stepId] || `Step ${stepId + 1}`;
    
    // Look for the latest executed step in step logs
    let latestActionName = 'No previous action';
    let latestActionParameters: Record<string, unknown> = {};
    
    // Check current step logs first
    const currentStepLogs = context.stepLogs[stepId] || [];
    if (currentStepLogs.length > 0) {
      const latestLog = currentStepLogs[currentStepLogs.length - 1];
      if (latestLog.aiResponse && latestLog.aiResponse.action) {
        latestActionName = latestLog.aiResponse.action.command;
        latestActionParameters = latestLog.aiResponse.action.parameters || {};
      }
    } else {
      // If no logs in current step, check previous steps
      for (let i = stepId - 1; i >= 0; i--) {
        const stepLogs = context.stepLogs[i] || [];
        if (stepLogs.length > 0) {
          const latestLog = stepLogs[stepLogs.length - 1];
          if (latestLog.aiResponse && latestLog.aiResponse.action) {
            latestActionName = latestLog.aiResponse.action.command;
            latestActionParameters = latestLog.aiResponse.action.parameters || {};
            break;
          }
        }
      }
    }

    return {
      stepName,
      actionName: latestActionName,
      actionParameters: latestActionParameters
    };
  }


}

// Export the class and types for external use
export type { IAIPromptManager, AIPromptManagerConfig, ContextualHistory } from './types';
export default AIPromptManager;
