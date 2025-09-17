/**
 * Task Loop Module Implementation
 * Implements the core ACT-REFLECT cycle for AI-driven web automation
 * Based on design/task-loop.md specifications
 */

import { 
  ITaskLoop,
  StepResult,
  AIResponse,
  TaskLoopConfig,
  TaskLoopError,
  ValidationError,
  TaskExecutionContext,
  IAIPromptManager,
  IAIIntegrationManager,
  IAISchemaManager,
  IExecutorSessionManager
} from './types';
import { IAIContextManager } from '../../../types/ai-context-manager-types';
import { validateAIResponse, sanitizeAIResponse } from './validator';
import { DEFAULT_CONFIG, ERROR_MESSAGES, LOG_PREFIX, FLOW_CONTROL } from './config';

/**
 * TaskLoop class implements the core ACT-REFLECT cycle
 * Orchestrates interaction between AI processing and browser execution
 */
export class TaskLoop implements ITaskLoop {
  private config: TaskLoopConfig;

  constructor(
    private contextManager: IAIContextManager,
    private promptManager: IAIPromptManager,
    private aiIntegration: IAIIntegrationManager,
    private schemaManager: IAISchemaManager,
    private executor: IExecutorSessionManager,
    config?: Partial<TaskLoopConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute a single step with ACT-REFLECT cycle
   * @param sessionId Session identifier
   * @param stepId Step number to execute
   * @returns Promise<StepResult> with execution results
   */
  async executeStep(sessionId: string, stepId: number): Promise<StepResult> {
    const startTime = Date.now();
    let iterations = 0;
    let finalResponse: AIResponse | undefined;

    if (this.config.enableLogging) {
      console.log(`${LOG_PREFIX} Starting step ${stepId} for session ${sessionId}`);
    }

    try {
      while (iterations < this.config.maxIterations) {
        iterations++;

        if (this.config.enableLogging) {
          console.log(`${LOG_PREFIX} Step ${stepId}, iteration ${iterations}`);
        }

        // 1. Get prompt from AI Prompt Manager
        let prompt: string;
        try {
          prompt = this.promptManager.getStepPrompt(sessionId, stepId);
        } catch (error) {
          throw new TaskLoopError(
            `Failed to get step prompt: ${error instanceof Error ? error.message : 'Unknown error'}`,
            sessionId,
            stepId,
            iterations,
            error instanceof Error ? error : undefined
          );
        }

        // 2. Send request to AI Integration
        let aiResponse;
        try {
          aiResponse = await this.aiIntegration.sendRequest(prompt);
        } catch (error) {
          throw new TaskLoopError(
            `AI integration request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            sessionId,
            stepId,
            iterations,
            error instanceof Error ? error : undefined
          );
        }

        if (aiResponse.status === 'error') {
          throw new TaskLoopError(
            `${ERROR_MESSAGES.AI_REQUEST_FAILED}: ${aiResponse.error}`,
            sessionId,
            stepId,
            iterations
          );
        }

        // 3. Validate response against schema
        let validatedResponse: AIResponse;
        try {
          const sanitizedData = sanitizeAIResponse(aiResponse.data);
          validatedResponse = this.validateAIResponse(sanitizedData, sessionId, stepId);
          finalResponse = validatedResponse;
        } catch (error) {
          if (error instanceof ValidationError) {
            throw error;
          }
          throw new TaskLoopError(
            `Response validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            sessionId,
            stepId,
            iterations,
            error instanceof Error ? error : undefined
          );
        }

        // 4. Execute action if specified
        if (validatedResponse.flowControl === FLOW_CONTROL.CONTINUE && validatedResponse.action) {
          try {
            await this.executeAction(sessionId, validatedResponse.action);
          } catch (error) {
            throw new TaskLoopError(
              `Command execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
              sessionId,
              stepId,
              iterations,
              error instanceof Error ? error : undefined
            );
          }
        }

        // 5. Log execution in context manager
        try {
          this.logExecution(sessionId, stepId, {
            iteration: iterations,
            aiResponse: validatedResponse,
            timestamp: new Date()
          });
        } catch (error) {
          // Log error but don't fail the execution
          if (this.config.enableLogging) {
            console.warn(`${LOG_PREFIX} Failed to log execution context:`, error);
          }
        }

        // 6. Handle flow control
        if (validatedResponse.flowControl === FLOW_CONTROL.STOP_SUCCESS) {
          if (this.config.enableLogging) {
            console.log(`${LOG_PREFIX} Step ${stepId} completed successfully after ${iterations} iterations`);
          }
          return {
            status: 'success',
            stepId,
            iterations,
            totalDuration: Date.now() - startTime,
            finalResponse
          };
        }

        if (validatedResponse.flowControl === FLOW_CONTROL.STOP_FAILURE) {
          if (this.config.enableLogging) {
            console.log(`${LOG_PREFIX} Step ${stepId} failed after ${iterations} iterations`);
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
          console.log(`${LOG_PREFIX} Continuing to next iteration for step ${stepId}`);
        }
      }

      // Max iterations reached
      if (this.config.enableLogging) {
        console.warn(`${LOG_PREFIX} Maximum iterations exceeded for step ${stepId}`);
      }
      return {
        status: 'error',
        stepId,
        iterations,
        totalDuration: Date.now() - startTime,
        error: ERROR_MESSAGES.MAX_ITERATIONS_EXCEEDED
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (this.config.enableLogging) {
        console.error(`${LOG_PREFIX} Step ${stepId} failed:`, error);
      }
      
      return {
        status: 'error',
        stepId,
        iterations,
        totalDuration: Date.now() - startTime,
        error: errorMessage
      };
    }
  }

  /**
   * Validates AI response using the schema manager and internal validation
   * @param data Raw AI response data
   * @param sessionId Session ID for error context
   * @param stepId Step ID for error context
   * @returns Validated AIResponse
   */
  private validateAIResponse(data: any, sessionId: string, stepId: number): AIResponse {
    // Get schema from AI Schema Manager
    const schema = this.schemaManager.getAIResponseSchema();
    
    // Use our internal validator (in a full implementation, this would use a JSON schema library)
    return validateAIResponse(data, sessionId, stepId);
  }

  /**
   * Executes an action through the executor
   * @param sessionId Session identifier
   * @param action Action to execute
   */
  private async executeAction(sessionId: string, action: any): Promise<void> {
    const executorSession = this.executor.getExecutorSession(sessionId);
    if (!executorSession) {
      throw new TaskLoopError(`${ERROR_MESSAGES.EXECUTOR_SESSION_NOT_FOUND}: ${sessionId}`);
    }

    // Build the command for the executor
    const command = {
      sessionId,
      action: action.command,
      parameters: action.parameters,
      commandId: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };

    if (this.config.enableLogging) {
      console.log(`${LOG_PREFIX} Executing command:`, command.action, command.parameters);
    }

    // Execute the command through the executor
    await this.executor.executeCommand(command);
  }

  /**
   * Logs execution context using the AI Context Manager
   * @param sessionId Session identifier
   * @param stepId Step identifier
   * @param context Execution context to log
   */
  private logExecution(sessionId: string, stepId: number, context: TaskExecutionContext): void {
    try {
      this.contextManager.logTask(sessionId, stepId, context);
    } catch (error) {
      if (this.config.enableLogging) {
        console.warn(`${LOG_PREFIX} Failed to log task context:`, error);
      }
    }
  }
}
