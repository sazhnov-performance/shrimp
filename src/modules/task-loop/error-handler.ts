import { v4 as uuidv4 } from 'uuid';
import {
  StandardError,
  ErrorCategory,
  ErrorSeverity
} from '../../types/shared-types';

import {
  TaskLoopErrorType,
  TaskLoopError
} from './types';

import { Logger } from './logger';

/**
 * Error handler for Task Loop module
 * Provides standardized error creation, categorization, and recovery suggestions
 */
export class TaskLoopErrorHandler {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Create a standardized error with proper categorization and metadata
   */
  createStandardError(
    type: TaskLoopErrorType,
    message: string,
    details?: Record<string, any>,
    cause?: Error
  ): StandardError {
    const error: StandardError = {
      id: uuidv4(),
      category: this.categorizeError(type),
      severity: this.determineSeverity(type),
      code: this.getErrorCode(type),
      message,
      details,
      cause: cause ? this.wrapCause(cause) : undefined,
      timestamp: new Date(),
      moduleId: 'task-loop',
      recoverable: this.isRecoverable(type),
      retryable: this.isRetryable(type),
      suggestedAction: this.getSuggestedAction(type)
    };

    this.logger.debug('Standard error created', { 
      errorId: error.id, 
      type, 
      category: error.category, 
      severity: error.severity 
    });

    return error;
  }

  /**
   * Wrap an existing error with Task Loop context
   */
  wrapError(
    error: any,
    type: TaskLoopErrorType,
    message: string,
    details?: Record<string, any>
  ): StandardError {
    const cause = error instanceof Error ? error : new Error(String(error));
    
    return this.createStandardError(type, message, {
      ...details,
      originalError: cause.message,
      originalStack: cause.stack
    }, cause);
  }

  /**
   * Create a Task Loop specific error
   */
  createTaskLoopError(
    type: TaskLoopErrorType,
    message: string,
    sessionId: string,
    stepIndex: number,
    phase: string,
    details?: Record<string, any>
  ): TaskLoopError {
    const error = new Error(message) as TaskLoopError;
    error.type = type;
    error.sessionId = sessionId;
    error.stepIndex = stepIndex;
    error.phase = phase as any;
    error.details = details;
    error.timestamp = new Date();

    return error;
  }

  /**
   * Categorize error type into standard categories
   */
  private categorizeError(type: TaskLoopErrorType): ErrorCategory {
    const validationErrors = [
      TaskLoopErrorType.VALIDATION_ERROR,
      TaskLoopErrorType.UNSUPPORTED_COMMAND,
      TaskLoopErrorType.UNSUPPORTED_INVESTIGATION_TOOL,
      TaskLoopErrorType.INVESTIGATION_PHASE_INVALID
    ];

    const executionErrors = [
      TaskLoopErrorType.COMMAND_EXECUTION_ERROR,
      TaskLoopErrorType.INVESTIGATION_CYCLE_FAILED,
      TaskLoopErrorType.INVESTIGATION_PHASE_FAILED,
      TaskLoopErrorType.INVESTIGATION_TOOL_FAILED,
      TaskLoopErrorType.WORKING_MEMORY_UPDATE_FAILED,
      TaskLoopErrorType.ELEMENT_DISCOVERY_FAILED
    ];

    const systemErrors = [
      TaskLoopErrorType.TIMEOUT_ERROR,
      TaskLoopErrorType.INVESTIGATION_TIMEOUT,
      TaskLoopErrorType.CONTEXT_STORAGE_ERROR,
      TaskLoopErrorType.STREAMING_ERROR
    ];

    const integrationErrors = [
      TaskLoopErrorType.PROMPT_GENERATION_ERROR,
      TaskLoopErrorType.AI_COMMUNICATION_ERROR,
      TaskLoopErrorType.RESPONSE_PARSING_ERROR,
      TaskLoopErrorType.CONTEXT_FILTERING_FAILED,
      TaskLoopErrorType.INVESTIGATION_CONTEXT_GENERATION_FAILED
    ];

    if (validationErrors.includes(type)) return ErrorCategory.VALIDATION;
    if (executionErrors.includes(type)) return ErrorCategory.EXECUTION;
    if (systemErrors.includes(type)) return ErrorCategory.SYSTEM;
    if (integrationErrors.includes(type)) return ErrorCategory.INTEGRATION;
    
    return ErrorCategory.SYSTEM; // Default fallback
  }

  /**
   * Determine error severity based on type
   */
  private determineSeverity(type: TaskLoopErrorType): ErrorSeverity {
    const criticalErrors = [
      TaskLoopErrorType.CONTEXT_STORAGE_ERROR
    ];

    const highErrors = [
      TaskLoopErrorType.AI_COMMUNICATION_ERROR,
      TaskLoopErrorType.TIMEOUT_ERROR,
      TaskLoopErrorType.INVESTIGATION_TIMEOUT,
      TaskLoopErrorType.COMMAND_EXECUTION_ERROR
    ];

    const mediumErrors = [
      TaskLoopErrorType.INVESTIGATION_CYCLE_FAILED,
      TaskLoopErrorType.INVESTIGATION_PHASE_FAILED,
      TaskLoopErrorType.INVESTIGATION_TOOL_FAILED,
      TaskLoopErrorType.RESPONSE_PARSING_ERROR,
      TaskLoopErrorType.CONTEXT_FILTERING_FAILED
    ];

    const lowErrors = [
      TaskLoopErrorType.VALIDATION_ERROR,
      TaskLoopErrorType.UNSUPPORTED_COMMAND,
      TaskLoopErrorType.UNSUPPORTED_INVESTIGATION_TOOL,
      TaskLoopErrorType.WORKING_MEMORY_UPDATE_FAILED,
      TaskLoopErrorType.ELEMENT_DISCOVERY_FAILED
    ];

    if (criticalErrors.includes(type)) return ErrorSeverity.CRITICAL;
    if (highErrors.includes(type)) return ErrorSeverity.HIGH;
    if (mediumErrors.includes(type)) return ErrorSeverity.MEDIUM;
    if (lowErrors.includes(type)) return ErrorSeverity.LOW;
    
    return ErrorSeverity.MEDIUM; // Default fallback
  }

  /**
   * Get error code for the error type
   */
  private getErrorCode(type: TaskLoopErrorType): string {
    const errorCodes: Record<TaskLoopErrorType, string> = {
      [TaskLoopErrorType.PROMPT_GENERATION_ERROR]: 'TL001',
      [TaskLoopErrorType.AI_COMMUNICATION_ERROR]: 'TL002',
      [TaskLoopErrorType.RESPONSE_PARSING_ERROR]: 'TL003',
      [TaskLoopErrorType.COMMAND_EXECUTION_ERROR]: 'TL004',
      [TaskLoopErrorType.CONTEXT_STORAGE_ERROR]: 'TL005',
      [TaskLoopErrorType.STREAMING_ERROR]: 'TL006',
      [TaskLoopErrorType.TIMEOUT_ERROR]: 'TL007',
      [TaskLoopErrorType.VALIDATION_ERROR]: 'TL008',
      [TaskLoopErrorType.UNSUPPORTED_COMMAND]: 'TL009',
      [TaskLoopErrorType.INVESTIGATION_CYCLE_FAILED]: 'TL010',
      [TaskLoopErrorType.INVESTIGATION_PHASE_FAILED]: 'TL011',
      [TaskLoopErrorType.INVESTIGATION_TOOL_FAILED]: 'TL012',
      [TaskLoopErrorType.INVESTIGATION_TIMEOUT]: 'TL013',
      [TaskLoopErrorType.UNSUPPORTED_INVESTIGATION_TOOL]: 'TL014',
      [TaskLoopErrorType.WORKING_MEMORY_UPDATE_FAILED]: 'TL015',
      [TaskLoopErrorType.CONTEXT_FILTERING_FAILED]: 'TL016',
      [TaskLoopErrorType.ELEMENT_DISCOVERY_FAILED]: 'TL017',
      [TaskLoopErrorType.INVESTIGATION_CONTEXT_GENERATION_FAILED]: 'TL018'
    };

    return errorCodes[type] || 'TL999';
  }

  /**
   * Determine if error is recoverable
   */
  private isRecoverable(type: TaskLoopErrorType): boolean {
    const unrecoverableErrors = [
      TaskLoopErrorType.CONTEXT_STORAGE_ERROR
    ];

    return !unrecoverableErrors.includes(type);
  }

  /**
   * Determine if error is retryable
   */
  private isRetryable(type: TaskLoopErrorType): boolean {
    const retryableErrors = [
      TaskLoopErrorType.AI_COMMUNICATION_ERROR,
      TaskLoopErrorType.TIMEOUT_ERROR,
      TaskLoopErrorType.INVESTIGATION_TIMEOUT,
      TaskLoopErrorType.COMMAND_EXECUTION_ERROR,
      TaskLoopErrorType.INVESTIGATION_TOOL_FAILED,
      TaskLoopErrorType.STREAMING_ERROR,
      TaskLoopErrorType.CONTEXT_FILTERING_FAILED
    ];

    return retryableErrors.includes(type);
  }

  /**
   * Get suggested action for error recovery
   */
  private getSuggestedAction(type: TaskLoopErrorType): string {
    const suggestions: Record<TaskLoopErrorType, string> = {
      [TaskLoopErrorType.PROMPT_GENERATION_ERROR]: 'Check prompt template configuration and context availability',
      [TaskLoopErrorType.AI_COMMUNICATION_ERROR]: 'Verify AI service connection and API credentials',
      [TaskLoopErrorType.RESPONSE_PARSING_ERROR]: 'Check AI response format and schema compatibility',
      [TaskLoopErrorType.COMMAND_EXECUTION_ERROR]: 'Verify executor service availability and command parameters',
      [TaskLoopErrorType.CONTEXT_STORAGE_ERROR]: 'Check context manager service and storage permissions',
      [TaskLoopErrorType.STREAMING_ERROR]: 'Verify streaming service connection and permissions',
      [TaskLoopErrorType.TIMEOUT_ERROR]: 'Increase timeout settings or check system performance',
      [TaskLoopErrorType.VALIDATION_ERROR]: 'Verify input parameters and session state',
      [TaskLoopErrorType.UNSUPPORTED_COMMAND]: 'Check command type and executor capabilities',
      [TaskLoopErrorType.INVESTIGATION_CYCLE_FAILED]: 'Review investigation configuration and tool availability',
      [TaskLoopErrorType.INVESTIGATION_PHASE_FAILED]: 'Check investigation phase configuration and dependencies',
      [TaskLoopErrorType.INVESTIGATION_TOOL_FAILED]: 'Verify investigation tool parameters and executor availability',
      [TaskLoopErrorType.INVESTIGATION_TIMEOUT]: 'Increase investigation timeout or reduce investigation scope',
      [TaskLoopErrorType.UNSUPPORTED_INVESTIGATION_TOOL]: 'Check investigation tool configuration and availability',
      [TaskLoopErrorType.WORKING_MEMORY_UPDATE_FAILED]: 'Verify working memory service and update parameters',
      [TaskLoopErrorType.CONTEXT_FILTERING_FAILED]: 'Check context filtering configuration and context manager availability',
      [TaskLoopErrorType.ELEMENT_DISCOVERY_FAILED]: 'Review element discovery parameters and page state',
      [TaskLoopErrorType.INVESTIGATION_CONTEXT_GENERATION_FAILED]: 'Check investigation context parameters and dependencies'
    };

    return suggestions[type] || 'Check system resources and retry operation';
  }

  /**
   * Wrap a cause error as StandardError
   */
  private wrapCause(cause: Error): StandardError {
    return {
      id: uuidv4(),
      category: ErrorCategory.SYSTEM,
      severity: ErrorSeverity.LOW,
      code: 'TL_WRAPPED',
      message: `Wrapped error: ${cause.message}`,
      details: {
        originalName: cause.name,
        originalStack: cause.stack
      },
      timestamp: new Date(),
      moduleId: 'task-loop',
      recoverable: true,
      retryable: false,
      suggestedAction: 'Review the original error details for more information'
    };
  }
}

export default TaskLoopErrorHandler;
