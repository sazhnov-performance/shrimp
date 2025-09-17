/**
 * Step Processor Error Handler Implementation
 * Provides standardized error handling and recovery mechanisms for the Step Processor module
 * Based on design/step-processor.md specifications
 */

import { 
  StandardError, 
  ErrorCategory, 
  ErrorSeverity 
} from '../../../types/shared-types';
import { 
  StepProcessorErrorHandler, 
  StepProcessorErrorType,
  STEP_PROCESSOR_ERROR_CODES,
  IErrorHandlerInterface 
} from './types';

export class StepProcessorErrorHandlerImpl implements StepProcessorErrorHandler {
  
  createStandardError(code: string, message: string, details?: Record<string, any>, cause?: Error): StandardError {
    return {
      id: crypto.randomUUID(),
      category: this.categorizeError(code),
      severity: this.determineSeverity(code),
      code: STEP_PROCESSOR_ERROR_CODES[code as keyof typeof STEP_PROCESSOR_ERROR_CODES] || code,
      message,
      details,
      cause: cause ? this.wrapError(cause, 'WRAPPED_ERROR', 'Wrapped underlying error') : undefined,
      timestamp: new Date(),
      moduleId: 'step-processor',
      recoverable: this.isRecoverable(code),
      retryable: this.isRetryable(code),
      suggestedAction: this.getSuggestedAction(code)
    };
  }

  wrapError(error: any, code: string, message: string, details?: Record<string, any>): StandardError {
    if (this.isStandardError(error)) {
      return error as StandardError;
    }

    return {
      id: crypto.randomUUID(),
      category: this.categorizeError(code),
      severity: this.determineSeverity(code),
      code: STEP_PROCESSOR_ERROR_CODES[code as keyof typeof STEP_PROCESSOR_ERROR_CODES] || code,
      message,
      details: {
        ...details,
        originalError: error.message || String(error),
        originalStack: error.stack
      },
      timestamp: new Date(),
      moduleId: 'step-processor',
      recoverable: this.isRecoverable(code),
      retryable: this.isRetryable(code),
      suggestedAction: this.getSuggestedAction(code)
    };
  }

  handleError(error: StandardError): void {
    // Log the error based on severity
    if (error.severity === ErrorSeverity.CRITICAL) {
      console.error(`[StepProcessor][CRITICAL] ${error.message}`, error);
    } else if (error.severity === ErrorSeverity.HIGH) {
      console.error(`[StepProcessor][ERROR] ${error.message}`, error);
    } else if (error.severity === ErrorSeverity.MEDIUM) {
      console.warn(`[StepProcessor][WARN] ${error.message}`, error);
    } else {
      console.log(`[StepProcessor][INFO] ${error.message}`, error);
    }

    // Additional error handling logic can be added here
    // such as metrics collection, alerting, etc.
  }

  categorizeError(code: string): ErrorCategory {
    const validationErrors = ['VALIDATION_FAILED'];
    const executionErrors = [
      'TASK_LOOP_TIMEOUT', 
      'SESSION_CREATION_FAILED', 
      'STEP_PROCESSING_TIMEOUT',
      'MODULE_INITIALIZATION_FAILED'
    ];
    const systemErrors = [
      'CONCURRENT_LIMIT_EXCEEDED',
      'DEPENDENCY_RESOLUTION_FAILED'
    ];
    const integrationErrors = [
      'STREAMING_INITIALIZATION_FAILED',
      'SESSION_COORDINATOR_ERROR',
      'EVENT_PUBLISHING_FAILED'
    ];
    
    if (validationErrors.includes(code)) return ErrorCategory.VALIDATION;
    if (executionErrors.includes(code)) return ErrorCategory.EXECUTION;
    if (systemErrors.includes(code)) return ErrorCategory.SYSTEM;
    if (integrationErrors.includes(code)) return ErrorCategory.INTEGRATION;
    return ErrorCategory.SYSTEM;
  }

  determineSeverity(code: string): ErrorSeverity {
    const criticalErrors = [
      'SESSION_CREATION_FAILED', 
      'CONCURRENT_LIMIT_EXCEEDED',
      'MODULE_INITIALIZATION_FAILED',
      'DEPENDENCY_RESOLUTION_FAILED'
    ];
    const highErrors = [
      'TASK_LOOP_TIMEOUT',
      'STEP_PROCESSING_TIMEOUT',
      'SESSION_COORDINATOR_ERROR'
    ];
    const mediumErrors = [
      'STREAMING_INITIALIZATION_FAILED',
      'EVENT_PUBLISHING_FAILED'
    ];
    
    if (criticalErrors.includes(code)) return ErrorSeverity.CRITICAL;
    if (highErrors.includes(code)) return ErrorSeverity.HIGH;
    if (mediumErrors.includes(code)) return ErrorSeverity.MEDIUM;
    return ErrorSeverity.LOW;
  }

  isRecoverable(code: string): boolean {
    const unrecoverableErrors = [
      'VALIDATION_FAILED',
      'DEPENDENCY_RESOLUTION_FAILED',
      'MODULE_INITIALIZATION_FAILED'
    ];
    return !unrecoverableErrors.includes(code);
  }

  isRetryable(code: string): boolean {
    const retryableErrors = [
      'TASK_LOOP_TIMEOUT',
      'SESSION_CREATION_FAILED',
      'STEP_PROCESSING_TIMEOUT',
      'STREAMING_INITIALIZATION_FAILED',
      'SESSION_COORDINATOR_ERROR',
      'EVENT_PUBLISHING_FAILED'
    ];
    return retryableErrors.includes(code);
  }

  getSuggestedAction(code: string): string {
    const actions = {
      'VALIDATION_FAILED': 'Check step format and content. Ensure all required fields are present and valid.',
      'SESSION_CREATION_FAILED': 'Retry with exponential backoff. Check session coordinator availability.',
      'TASK_LOOP_TIMEOUT': 'Increase timeout or simplify steps. Check AI integration connectivity.',
      'CONCURRENT_LIMIT_EXCEEDED': 'Wait for available session slots or increase maximum concurrent sessions.',
      'WORKFLOW_SESSION_NOT_FOUND': 'Verify session ID and check if session was properly created.',
      'MODULE_INITIALIZATION_FAILED': 'Check module dependencies and configuration. Restart the service.',
      'STREAMING_INITIALIZATION_FAILED': 'Check executor streamer availability and retry connection.',
      'STEP_PROCESSING_TIMEOUT': 'Increase step timeout or break down complex steps into smaller ones.',
      'DEPENDENCY_RESOLUTION_FAILED': 'Check dependency injection container configuration and module registrations.',
      'SESSION_COORDINATOR_ERROR': 'Check session coordinator status and retry operation.',
      'EVENT_PUBLISHING_FAILED': 'Check event streaming system availability and retry publishing.'
    };
    return actions[code] || 'Contact system administrator for assistance.';
  }

  // Step Processor specific error handling
  async handleSessionError(workflowSessionId: string, error: StandardError): Promise<void> {
    const sessionError = {
      ...error,
      details: {
        ...error.details,
        workflowSessionId,
        context: 'session_operation'
      }
    };

    this.handleError(sessionError);

    // Additional session-specific error handling
    // Such as marking session as failed, cleanup, etc.
  }

  async handleStepError(workflowSessionId: string, stepIndex: number, error: StandardError): Promise<void> {
    const stepError = {
      ...error,
      details: {
        ...error.details,
        workflowSessionId,
        stepIndex,
        context: 'step_execution'
      }
    };

    this.handleError(stepError);

    // Additional step-specific error handling
    // Such as marking step as failed, updating progress, etc.
  }

  async handleBatchError(batchId: string, error: StandardError): Promise<void> {
    const batchError = {
      ...error,
      details: {
        ...error.details,
        batchId,
        context: 'batch_processing'
      }
    };

    this.handleError(batchError);

    // Additional batch-specific error handling
    // Such as marking batch as failed, cleanup batch resources, etc.
  }

  private isStandardError(error: any): boolean {
    return error && 
           typeof error === 'object' && 
           'id' in error && 
           'category' in error && 
           'severity' in error && 
           'code' in error && 
           'message' in error && 
           'timestamp' in error && 
           'moduleId' in error;
  }
}

// Factory function for creating error handler instances
export function createStepProcessorErrorHandler(): StepProcessorErrorHandler {
  return new StepProcessorErrorHandlerImpl();
}

// Helper functions for common error scenarios
export class StepProcessorErrorHelpers {
  
  static validationError(message: string, details?: Record<string, any>): StandardError {
    const handler = createStepProcessorErrorHandler();
    return handler.createStandardError('VALIDATION_FAILED', message, details);
  }

  static sessionCreationError(message: string, cause?: Error, details?: Record<string, any>): StandardError {
    const handler = createStepProcessorErrorHandler();
    return handler.createStandardError('SESSION_CREATION_FAILED', message, details, cause);
  }

  static taskLoopTimeoutError(sessionId: string, stepIndex: number, timeoutMs: number): StandardError {
    const handler = createStepProcessorErrorHandler();
    return handler.createStandardError(
      'TASK_LOOP_TIMEOUT',
      `Task loop execution timed out after ${timeoutMs}ms`,
      { sessionId, stepIndex, timeoutMs }
    );
  }

  static concurrentLimitError(currentCount: number, maxLimit: number): StandardError {
    const handler = createStepProcessorErrorHandler();
    return handler.createStandardError(
      'CONCURRENT_LIMIT_EXCEEDED',
      `Concurrent session limit exceeded: ${currentCount}/${maxLimit}`,
      { currentCount, maxLimit }
    );
  }

  static workflowSessionNotFoundError(sessionId: string): StandardError {
    const handler = createStepProcessorErrorHandler();
    return handler.createStandardError(
      'WORKFLOW_SESSION_NOT_FOUND',
      `Workflow session not found: ${sessionId}`,
      { sessionId }
    );
  }

  static moduleInitializationError(moduleId: string, cause?: Error): StandardError {
    const handler = createStepProcessorErrorHandler();
    return handler.createStandardError(
      'MODULE_INITIALIZATION_FAILED',
      `Failed to initialize module: ${moduleId}`,
      { moduleId },
      cause
    );
  }

  static dependencyResolutionError(dependencyToken: string, cause?: Error): StandardError {
    const handler = createStepProcessorErrorHandler();
    return handler.createStandardError(
      'DEPENDENCY_RESOLUTION_FAILED',
      `Failed to resolve dependency: ${dependencyToken}`,
      { dependencyToken },
      cause
    );
  }

  static eventPublishingError(eventType: string, streamId?: string, cause?: Error): StandardError {
    const handler = createStepProcessorErrorHandler();
    return handler.createStandardError(
      'EVENT_PUBLISHING_FAILED',
      `Failed to publish event: ${eventType}`,
      { eventType, streamId },
      cause
    );
  }
}
