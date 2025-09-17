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
import { IExecutor } from '../executor/index';
import Executor from '../executor/index';
import { CommandAction } from '../executor/types';

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
    this.executor = new Executor(); // Executor is not a singleton in current implementation
    
    if (this.config.enableLogging) {
      console.log('[TaskLoop] Task Loop module initialized', {
        maxIterations: this.config.maxIterations,
        timeoutMs: this.config.timeoutMs,
        enableLogging: this.config.enableLogging
      });
    }
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
          console.log(`[TaskLoop] Getting prompt for session ${sessionId}, step ${stepId}, iteration ${iterations}`);
        }
        
        const prompt = this.promptManager.getStepPrompt(sessionId, stepId);

        // 2. Send request to AI Integration
        if (this.config.enableLogging) {
          console.log(`[TaskLoop] Sending AI request for session ${sessionId}, step ${stepId}, iteration ${iterations}`);
        }
        
        const aiResponse = await this.aiIntegration.sendRequest(prompt);
        
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
          console.log(`[TaskLoop] Validating AI response for session ${sessionId}, step ${stepId}, iteration ${iterations}`);
        }
        
        const validatedResponse = validateAIResponse(aiResponse.data, sessionId, stepId);
        finalResponse = validatedResponse;
        
        // Debug logging for AI response validation
        if (this.config.enableLogging && validatedResponse.action) {
          console.log(`[TaskLoop] DEBUG - Validated response action:`, JSON.stringify(validatedResponse.action, null, 2));
        }

        // 4. Execute action if specified (regardless of flow control)
        if (validatedResponse.action) {
          if (this.config.enableLogging) {
            console.log(`[TaskLoop] Executing action for session ${sessionId}, step ${stepId}, iteration ${iterations}`, {
              command: validatedResponse.action.command,
              parameters: validatedResponse.action.parameters
            });
          }
          
          await this.executeAction(sessionId, validatedResponse.action);
        }

        // 5. Log execution in context manager
        if (this.config.enableLogging) {
          console.log(`[TaskLoop] Logging task execution for session ${sessionId}, step ${stepId}, iteration ${iterations}`);
        }
        
        this.contextManager.logTask(sessionId, stepId, {
          iteration: iterations,
          aiResponse: validatedResponse,
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
  private async executeAction(sessionId: string, action: any): Promise<void> {
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
        console.log(`[TaskLoop] DEBUG - Action object:`, JSON.stringify(action, null, 2));
        console.log(`[TaskLoop] DEBUG - Parameters being passed:`, JSON.stringify(action.parameters, null, 2));
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
      
      if (!response.success && response.error) {
        throw this.createTaskLoopError(
          TaskLoopErrorType.EXECUTOR_FAILED,
          `Executor command failed: ${response.error.message}`,
          sessionId,
          undefined,
          undefined,
          { 
            command: action.command, 
            parameters: action.parameters,
            executorError: response.error 
          }
        );
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'TaskLoopValidationError') {
        throw error; // Re-throw validation errors
      }
      
      throw this.createTaskLoopError(
        TaskLoopErrorType.EXECUTOR_FAILED,
        `Failed to execute action: ${error instanceof Error ? error.message : String(error)}`,
        sessionId,
        undefined,
        undefined,
        { command: action.command, parameters: action.parameters, originalError: error }
      );
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
      default:
        throw this.createTaskLoopError(
          TaskLoopErrorType.VALIDATION_FAILED,
          `Unknown command: ${command}. Valid commands: OPEN_PAGE, CLICK_ELEMENT, INPUT_TEXT, SAVE_VARIABLE, GET_DOM, GET_CONTENT, GET_SUBDOM`,
          undefined,
          undefined,
          undefined,
          { receivedCommand: command }
        );
    }
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
