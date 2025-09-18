/**
 * Task Loop Module Implementation
 * Core ACT-REFLECT cycle for AI-driven web automation
 */

import { 
  ITaskLoop, 
  ITaskLoopConstructor,
  TaskLoopConfig, 
  StepResult, 
  AIResponse, 
  TaskLoopError, 
  TaskLoopErrorType 
} from './types';
import { DEFAULT_CONFIG, validateConfig } from './config';
import { validateAIResponse } from './validator';

// Import dependent module interfaces
import { IAIContextManager } from '../ai-context-manager/types';
import { AIContextManager } from '../ai-context-manager/ai-context-manager';
import { IAIPromptManager } from '../ai-prompt-manager/types';
import AIPromptManager from '../ai-prompt-manager/index';
import { IAIIntegrationManager } from '../ai-integration/types';
import AIIntegrationManager from '../ai-integration/index';
import { IAISchemaManager } from '../ai-schema-manager/types';
import AISchemaManager from '../ai-schema-manager/index';
import { IExecutor, Executor } from '../executor/index';
import { CommandAction } from '../executor/types';
import { IExecutorStreamer, IStreamerLogger } from '@/modules/executor-streamer/types';
import { ExecutorStreamer, StreamerLogger } from '@/modules/executor-streamer';
import { IMediaManager } from '../media-manager/types';

/**
 * TaskLoop - Singleton implementation of the core ACT-REFLECT cycle
 */
export class TaskLoop implements ITaskLoop {
  private static instance: TaskLoop | null = null;
  private contextManager: IAIContextManager;
  private promptManager: IAIPromptManager;
  private aiIntegration: IAIIntegrationManager;
  private schemaManager: IAISchemaManager;
  private executor: IExecutor;
  private streamer: IExecutorStreamer;
  private streamLogger: IStreamerLogger;
  private mediaManager: IMediaManager;
  private config: TaskLoopConfig;

  private constructor(config: TaskLoopConfig = DEFAULT_CONFIG) {
    // Validate and store configuration
    this.config = validateConfig(config);
    
    // Resolve dependencies internally using singleton instances
    this.contextManager = AIContextManager.getInstance();
    this.promptManager = AIPromptManager.getInstance();
    
    // Initialize AI integration with API key from environment variables
    const aiConfig = {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: 'gpt-4o-mini',
      baseUrl: 'https://api.openai.com/v1',
      logFilePath: './ai-requests.log'
    };
    this.aiIntegration = AIIntegrationManager.getInstance(aiConfig);
    
    this.schemaManager = AISchemaManager.getInstance();
    this.executor = Executor.getInstance(); // Use singleton instance
    this.streamer = ExecutorStreamer.getInstance(); // Use singleton instance
    this.streamLogger = new StreamerLogger(this.streamer, this.config.enableLogging);
    // Lazy load MediaManager to avoid Node.js API imports at build time
    this.mediaManager = this.getMediaManager();
    
    if (this.config.enableLogging) {
      console.log('[TaskLoop] Task Loop module initialized', {
        maxIterations: this.config.maxIterations,
        timeoutMs: this.config.timeoutMs,
        enableLogging: this.config.enableLogging
      });
    }
  }

  /**
   * Lazy load MediaManager to avoid Node.js APIs during compilation
   */
  private getMediaManager(): IMediaManager {
    if (!this.mediaManager) {
      // Use dynamic import to avoid loading Node.js APIs at build time
      const { MediaManager } = require('../media-manager/media-manager');
      this.mediaManager = MediaManager.getInstance();
    }
    return this.mediaManager;
  }

  /**
   * Get singleton instance of TaskLoop
   * @param config Optional configuration for the task loop
   * @returns TaskLoop instance
   */
  static getInstance(config?: TaskLoopConfig): ITaskLoop {
    if (!TaskLoop.instance) {
      TaskLoop.instance = new TaskLoop(config);
    }
    return TaskLoop.instance;
  }

  /**
   * Execute a single step with ACT-REFLECT cycle
   * @param sessionId Session identifier
   * @param stepId Step index (0-based)
   * @returns Promise<StepResult> with execution results
   */
  async executeStep(sessionId: string, stepId: number): Promise<StepResult> {
    const startTime = Date.now();
    let iterations = 0;
    let finalResponse: AIResponse | undefined;

    // Input validation (throws error if invalid)
    this.validateInputs(sessionId, stepId);

    try {
      // Set up timeout if configured
      const timeoutPromise = this.createTimeoutPromise();
      const executionPromise = this.executeStepWithIterations(sessionId, stepId, startTime);

      // Race between execution and timeout
      const result = await Promise.race([executionPromise, timeoutPromise]);
      
      if (result.status === 'error' && result.error?.includes('timeout')) {
        return result;
      }

      return result;

    } catch (error) {
      return this.createErrorResult(sessionId, stepId, iterations, startTime, error);
    }
  }

  /**
   * Execute the step with iteration loop
   */
  private async executeStepWithIterations(
    sessionId: string, 
    stepId: number, 
    startTime: number
  ): Promise<StepResult> {
    let iterations = 0;
    let finalResponse: AIResponse | undefined;

    while (iterations < this.config.maxIterations) {
      iterations++;

      try {
        // 1. Get prompt from AI Prompt Manager
        if (this.config.enableLogging) {
          //console.log(`[TaskLoop] Getting prompt for session ${sessionId}, step ${stepId}, iteration ${iterations}`);
        }
        
        // Get system and user messages
        const messages = this.promptManager.getStepMessages(sessionId, stepId);
        
        // Send as JSON to AI integration
        const requestPayload = JSON.stringify(messages);

        // 2. Send request to AI Integration
        if (this.config.enableLogging) {
          console.log(`[TaskLoop] Sending AI request for session ${sessionId}, step ${stepId}, iteration ${iterations}`);
        }
        
        const aiResponse = await this.aiIntegration.sendRequest(requestPayload);
        
        // Debug logging for raw AI response
        if (this.config.enableLogging) {
          console.log(`[TaskLoop] DEBUG - Raw AI response data:`, JSON.stringify(aiResponse.data, null, 2));
        }
        
        if (aiResponse.status === 'error') {
          throw this.createTaskLoopError(
            TaskLoopErrorType.AI_REQUEST_FAILED,
            `AI request failed: ${aiResponse.error}`,
            sessionId,
            stepId,
            iterations,
            { aiError: aiResponse.error, errorCode: aiResponse.errorCode }
          );
        }

        // 3. Validate response against schema
        if (this.config.enableLogging) {
          //console.log(`[TaskLoop] Validating AI response for session ${sessionId}, step ${stepId}, iteration ${iterations}`);
        }
        
        const validatedResponse = validateAIResponse(aiResponse.data, sessionId, stepId);
        finalResponse = validatedResponse;

        // 3a. Log AI reasoning to streamer
        await this.streamLogger.logReasoning(sessionId, stepId, validatedResponse.reasoning, 'high', iterations);



        // 4. Execute action if specified and flowControl is continue
        let executionResult: {success: boolean, result?: any, error?: string} | undefined;
        if (validatedResponse.flowControl === 'continue' && validatedResponse.action) {
          if (this.config.enableLogging) {
            //console.log(`[TaskLoop] Executing action for session ${sessionId}, step ${stepId}, iteration ${iterations}`, {
            //  command: validatedResponse.action.command,
            //  parameters: validatedResponse.action.parameters
            //});
          }
          
          executionResult = await this.executeAction(sessionId, stepId, validatedResponse.action, iterations);
          
          if (this.config.enableLogging) {
            //console.log(`[TaskLoop] Action execution result for session ${sessionId}, step ${stepId}, iteration ${iterations}:`, executionResult);
          }
        }

        // 5. Log execution in context manager (include execution result)
        if (this.config.enableLogging) {
          //console.log(`[TaskLoop] Logging task execution for session ${sessionId}, step ${stepId}, iteration ${iterations}`);
        }
        
        this.contextManager.logTask(sessionId, stepId, {
          iteration: iterations,
          aiResponse: validatedResponse,
          executionResult: executionResult,
          timestamp: new Date()
        });

        // 6. Handle flow control
        if (validatedResponse.flowControl === 'stop_success') {
          if (this.config.enableLogging) {
            console.log(`[TaskLoop] Step completed successfully for session ${sessionId}, step ${stepId} after ${iterations} iterations`);
          }
          
          return {
            status: 'success',
            stepId,
            iterations,
            totalDuration: Date.now() - startTime,
            finalResponse
          };
        }

        if (validatedResponse.flowControl === 'stop_failure') {
          if (this.config.enableLogging) {
            console.log(`[TaskLoop] Step failed for session ${sessionId}, step ${stepId} after ${iterations} iterations`);
          }
          
          return {
            status: 'failure',
            stepId,
            iterations,
            totalDuration: Date.now() - startTime,
            finalResponse
          };
        }

        // Continue with next iteration
        if (this.config.enableLogging) {
          console.log(`[TaskLoop] Continuing to next iteration for session ${sessionId}, step ${stepId}. Iteration ${iterations} complete.`);
        }

      } catch (error) {
        // Log the error and continue to next iteration or fail if it's the last one
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (this.config.enableLogging) {
          console.error(`[TaskLoop] Error in iteration ${iterations} for session ${sessionId}, step ${stepId}: ${errorMessage}`);
        }

        // Log the failed attempt
        this.contextManager.logTask(sessionId, stepId, {
          iteration: iterations,
          aiResponse: null,
          error: errorMessage,
          timestamp: new Date()
        });

        // If this is the last iteration, throw the error
        if (iterations >= this.config.maxIterations) {
          throw error;
        }

        // Otherwise, continue to next iteration
        continue;
      }
    }

    // Max iterations reached
    if (this.config.enableLogging) {
      console.log(`[TaskLoop] Maximum iterations (${this.config.maxIterations}) reached for session ${sessionId}, step ${stepId}`);
    }
    
    return {
      status: 'error',
      stepId,
      iterations,
      totalDuration: Date.now() - startTime,
      finalResponse,
      error: `Maximum iterations (${this.config.maxIterations}) exceeded`
    };
  }

  /**
   * Execute an action through the executor
   */
  private async executeAction(sessionId: string, stepId: number, action: any, iteration?: number): Promise<{success: boolean, result?: any, error?: string}> {
    try {
      // Session should already be created by StepProcessor
      if (!this.executor.sessionExists(sessionId)) {
        throw this.createTaskLoopError(
          TaskLoopErrorType.EXECUTOR_FAILED,
          `Executor session not found: ${sessionId}. Session should be created by StepProcessor.`,
          sessionId,
          undefined,
          undefined,
          { sessionId }
        );
      }

      // Convert string command to CommandAction enum
      const commandAction = this.convertStringToCommandAction(action.command);
      
      // Debug logging for parameters
      if (this.config.enableLogging) {
        //console.log(`[TaskLoop] DEBUG - Action object:`, JSON.stringify(action, null, 2));
        //console.log(`[TaskLoop] DEBUG - Parameters being passed:`, JSON.stringify(action.parameters, null, 2));
      }
      
      // Execute the command through the executor
      const command = {
        sessionId,
        action: commandAction,
        parameters: action.parameters,
        commandId: this.generateCommandId(),
        timestamp: new Date()
      };

      const response = await this.executor.executeCommand(command);
      
      // Log action result to streamer (before screenshot)
      await this.streamLogger.logAction(
        sessionId, 
        stepId, 
        this.getDisplayActionName(action.command), 
        response.success, 
        response.dom || 'Command executed successfully', 
        response.error?.message, 
        iteration
      );

      // Log screenshot to streamer if screenshot was captured
      if (response.success && response.screenshotId) {
        try {
          const screenshotUrl = this.getMediaManager().getImageUrl(response.screenshotId);
          
          // Log screenshot to streamer
          await this.streamLogger.logScreenshot(
            sessionId, 
            stepId, 
            response.screenshotId, 
            screenshotUrl, 
            this.getDisplayActionName(action.command), 
            iteration
          );
          
          if (this.config.enableLogging) {
            console.log(`[TaskLoop] Screenshot captured for ${action.command}: ${screenshotUrl}`);
          }

          // Generate AI screenshot description and log as reasoning
          try {
            // Generate image analysis prompt for screenshot description
            const imageAnalysisPrompt = this.promptManager.getImageAnalysisPrompt(sessionId, stepId);
            
            // Get image file path from media manager
            const imageFilePath = this.getMediaManager().getImagePath(response.screenshotId);
            
            // Send image analysis request to AI for screenshot description
            const promptRequest = JSON.stringify(imageAnalysisPrompt);
            const aiAnalysisResponse = await this.aiIntegration.sendRequest(promptRequest, imageFilePath);
            
            if (aiAnalysisResponse.status === 'success' && aiAnalysisResponse.data) {
              // Log AI screenshot description as reasoning
              const analysisData = typeof aiAnalysisResponse.data === 'string' ? 
                JSON.parse(aiAnalysisResponse.data) : aiAnalysisResponse.data;
              
              const screenshotDescription = analysisData.reasoning || analysisData.description || 
                'Screenshot analysis completed';
              
              await this.streamLogger.logReasoning(
                sessionId, 
                stepId, 
                `Screenshot Analysis: ${screenshotDescription}`, 
                'medium', 
                iteration
              );
              
              // Store screenshot description in context for future AI prompts
              this.contextManager.addScreenshotDescription(sessionId, stepId, {
                screenshotId: response.screenshotId,
                description: screenshotDescription,
                actionType: action.command,
                iteration: iteration,
                timestamp: new Date()
              });
              
              if (this.config.enableLogging) {
                console.log(`[TaskLoop] Screenshot analysis logged as reasoning and stored in context for ${action.command}`);
              }
            }
          } catch (error) {
            // Log warning if AI screenshot analysis fails, but don't fail the operation
            console.warn(`[TaskLoop] Failed to generate AI screenshot description for session ${sessionId}, step ${stepId}: ${error instanceof Error ? error.message : String(error)}`);
          }

        } catch (error) {
          // Log warning if URL generation fails, but don't fail the operation
          console.warn(`[TaskLoop] Failed to generate screenshot URL for ${response.screenshotId}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      
      if (!response.success && response.error) {
        // Return error instead of throwing - include original Playwright error if available
        let errorMessage = `Executor command failed: ${response.error.message}`;
        
        // Check if there's a cause (original Playwright error) and include it
        if (response.error.cause && response.error.cause.details?.originalMessage) {
          errorMessage += ` (Original error: ${response.error.cause.details.originalMessage})`;
        } else if (response.error.cause && response.error.cause.message) {
          errorMessage += ` (Original error: ${response.error.cause.message})`;
        }
        
        return {
          success: false,
          error: errorMessage
        };
      }

      // Return successful result
      return {
        success: true,
        result: response.dom || 'Command executed successfully'
      };

    } catch (error) {
      if (error instanceof Error && error.name === 'TaskLoopValidationError') {
        throw error; // Re-throw validation errors
      }
      
      // Return error instead of throwing for execution errors
      let errorMessage = `Failed to execute action: ${error instanceof Error ? error.message : String(error)}`;
      
      // Check if it's a StandardError with cause (original Playwright error)
      if (error && typeof error === 'object' && 'cause' in error && error.cause && 
          typeof error.cause === 'object' && error.cause !== null) {
        const cause = error.cause as any;
        if (cause.details?.originalMessage) {
          errorMessage += ` (Original error: ${cause.details.originalMessage})`;
        } else if (cause.message) {
          errorMessage += ` (Original error: ${cause.message})`;
        }
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Input validation
   */
  private validateInputs(sessionId: string, stepId: number): void {
    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim().length === 0) {
      throw this.createTaskLoopError(
        TaskLoopErrorType.CONFIGURATION_ERROR,
        'Session ID must be a non-empty string',
        sessionId,
        stepId
      );
    }

    if (!Number.isInteger(stepId) || stepId < 0) {
      throw this.createTaskLoopError(
        TaskLoopErrorType.CONFIGURATION_ERROR,
        'Step ID must be a non-negative integer',
        sessionId,
        stepId
      );
    }
  }

  /**
   * Create timeout promise
   */
  private createTimeoutPromise(): Promise<StepResult> {
    if (this.config.timeoutMs <= 0) {
      // Return a promise that never resolves if timeout is disabled
      return new Promise(() => {});
    }

    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(this.createTaskLoopError(
          TaskLoopErrorType.TIMEOUT_EXCEEDED,
          `Step execution timeout exceeded (${this.config.timeoutMs}ms)`
        ));
      }, this.config.timeoutMs);
    });
  }

  /**
   * Create error result
   */
  private createErrorResult(
    sessionId: string,
    stepId: number,
    iterations: number,
    startTime: number,
    error: any
  ): StepResult {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (this.config.enableLogging) {
      console.error(`[TaskLoop] Step execution failed for session ${sessionId}, step ${stepId}: ${errorMessage}`);
    }

    return {
      status: 'error',
      stepId,
      iterations,
      totalDuration: Date.now() - startTime,
      error: errorMessage
    };
  }

  /**
   * Create TaskLoop specific error
   */
  private createTaskLoopError(
    type: TaskLoopErrorType,
    message: string,
    sessionId?: string,
    stepId?: number,
    iteration?: number,
    details?: Record<string, any>
  ): TaskLoopError {
    const error = new Error(message) as TaskLoopError;
    error.type = type;
    error.sessionId = sessionId;
    error.stepId = stepId;
    error.iteration = iteration;
    error.details = details;
    error.name = 'TaskLoopError';
    
    return error;
  }

  /**
   * Convert string command to CommandAction enum
   */
  private convertStringToCommandAction(command: string): CommandAction {
    switch (command) {
      case 'OPEN_PAGE':
        return CommandAction.OPEN_PAGE;
      case 'CLICK_ELEMENT':
        return CommandAction.CLICK_ELEMENT;
      case 'INPUT_TEXT':
        return CommandAction.INPUT_TEXT;
      case 'SAVE_VARIABLE':
        return CommandAction.SAVE_VARIABLE;
      case 'GET_DOM':
        return CommandAction.GET_DOM;
      case 'GET_CONTENT':
        return CommandAction.GET_CONTENT;
      case 'GET_SUBDOM':
        return CommandAction.GET_SUBDOM;
      case 'GET_TEXT':
        return CommandAction.GET_TEXT;
      default:
        throw this.createTaskLoopError(
          TaskLoopErrorType.VALIDATION_FAILED,
          `Unknown command: ${command}. Valid commands: OPEN_PAGE, CLICK_ELEMENT, INPUT_TEXT, SAVE_VARIABLE, GET_DOM, GET_CONTENT, GET_SUBDOM, GET_TEXT`,
          undefined,
          undefined,
          undefined,
          { receivedCommand: command }
        );
    }
  }

  /**
   * Convert technical command names to user-friendly display names
   */
  private getDisplayActionName(command: string): string {
    const displayNames: Record<string, string> = {
      'OPEN_PAGE': 'Opening Page',
      'CLICK_ELEMENT': 'Clicking Element',
      'INPUT_TEXT': 'Entering Text',
      'SAVE_VARIABLE': 'Saving Variable',
      'GET_DOM': 'Getting Page Content',
      'GET_CONTENT': 'Getting Content',
      'GET_SUBDOM': 'Getting Page Section',
      'GET_TEXT': 'Getting Text'
    };

    return displayNames[command] || command;
  }

  /**
   * Generate unique command ID
   */
  private generateCommandId(): string {
    return `taskloop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }


  /**
   * Get current configuration
   */
  getConfig(): TaskLoopConfig {
    return { ...this.config };
  }

  /**
   * Update configuration (only affects new executions)
   */
  updateConfig(newConfig: Partial<TaskLoopConfig>): void {
    this.config = validateConfig({ ...this.config, ...newConfig });
    
    // Update stream logger configuration
    this.streamLogger.setLoggingEnabled(this.config.enableLogging);
    
    if (this.config.enableLogging) {
      console.log('[TaskLoop] Configuration updated', this.config);
    }
  }
}

// Export the main interface and implementation
export { TaskLoop as default };

// Export types and utilities
export type { 
  ITaskLoop, 
  TaskLoopConfig, 
  StepResult, 
  AIResponse,
  TaskLoopError,
  TaskLoopErrorType
} from './types';

export { DEFAULT_CONFIG } from './config';
export { validateAIResponse } from './validator';
