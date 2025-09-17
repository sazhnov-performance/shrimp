/**
 * Step Processor Error Handler Unit Tests
 */

import { StepProcessorErrorHandler } from '../../../src/modules/step-processor/error-handler';
import { StepProcessorLogger } from '../../../src/modules/step-processor/logger';
import {
  StandardError,
  ErrorCategory,
  ErrorSeverity,
  LogLevel,
  LoggingConfig
} from '../../../types/shared-types';

import {
  StepProcessorErrorType,
  STEP_PROCESSOR_ERROR_CODES
} from '../../../types/step-processor';

describe('StepProcessorErrorHandler', () => {
  let errorHandler: StepProcessorErrorHandler;
  let mockLogger: jest.Mocked<StepProcessorLogger>;

  beforeEach(() => {
    const config: LoggingConfig = {
      level: LogLevel.DEBUG,
      prefix: '[StepProcessor]',
      includeTimestamp: true,
      includeSessionId: true,
      includeModuleId: true,
      structured: false
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as any;

    errorHandler = new StepProcessorErrorHandler(mockLogger);
  });

  describe('Standard Error Creation', () => {
    it('should create standard error with all properties', () => {
      const details = { workflowSessionId: 'session-123' };
      const cause = new Error('Original error');
      
      const error = errorHandler.createStandardError(
        StepProcessorErrorType.VALIDATION_FAILED,
        'Validation failed',
        details,
        cause
      );

      expect(error.id).toBeDefined();
      expect(error.category).toBe(ErrorCategory.VALIDATION);
      expect(error.severity).toBe(ErrorSeverity.LOW);
      expect(error.code).toBe(STEP_PROCESSOR_ERROR_CODES.VALIDATION_FAILED);
      expect(error.message).toBe('Validation failed');
      expect(error.details).toEqual(details);
      expect(error.cause).toBeDefined();
      expect(error.timestamp).toBeInstanceOf(Date);
      expect(error.moduleId).toBe('step-processor');
      expect(error.recoverable).toBe(false);
      expect(error.retryable).toBe(false);
      expect(error.suggestedAction).toBe('Check step format and content');
    });

    it('should create error without optional parameters', () => {
      const error = errorHandler.createStandardError(
        StepProcessorErrorType.SESSION_CREATION_FAILED,
        'Session creation failed'
      );

      expect(error.id).toBeDefined();
      expect(error.category).toBe(ErrorCategory.EXECUTION);
      expect(error.severity).toBe(ErrorSeverity.CRITICAL);
      expect(error.code).toBe(STEP_PROCESSOR_ERROR_CODES.SESSION_CREATION_FAILED);
      expect(error.message).toBe('Session creation failed');
      expect(error.details).toBeUndefined();
      expect(error.cause).toBeUndefined();
      expect(error.recoverable).toBe(true);
      expect(error.retryable).toBe(true);
      expect(error.suggestedAction).toBe('Retry with exponential backoff');
    });
  });

  describe('Error Wrapping', () => {
    it('should wrap JavaScript Error objects', () => {
      const originalError = new Error('Original error message');
      originalError.stack = 'Error stack trace';
      
      const wrappedError = errorHandler.wrapError(
        originalError,
        StepProcessorErrorType.TASK_LOOP_TIMEOUT,
        'Task loop timeout occurred',
        { stepIndex: 5 }
      );

      expect(wrappedError.message).toBe('Task loop timeout occurred');
      expect(wrappedError.code).toBe(STEP_PROCESSOR_ERROR_CODES.TASK_LOOP_TIMEOUT);
      expect(wrappedError.details?.originalError).toEqual({
        name: 'Error',
        message: 'Original error message',
        stack: 'Error stack trace'
      });
    });

    it('should wrap existing StandardError objects', () => {
      const originalError: StandardError = {
        id: 'original-error-id',
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.HIGH,
        code: 'ORIGINAL_ERROR',
        message: 'Original error',
        timestamp: new Date(),
        moduleId: 'other-module',
        recoverable: true,
        retryable: false
      };
      
      const wrappedError = errorHandler.wrapError(
        originalError,
        StepProcessorErrorType.MODULE_INITIALIZATION_FAILED,
        'Module initialization failed'
      );

      expect(wrappedError.message).toBe('Module initialization failed');
      expect(wrappedError.code).toBe(STEP_PROCESSOR_ERROR_CODES.MODULE_INITIALIZATION_FAILED);
      expect(wrappedError.details?.originalError).toEqual(originalError);
    });

    it('should wrap non-Error objects', () => {
      const nonError = 'String error message';
      
      const wrappedError = errorHandler.wrapError(
        nonError,
        StepProcessorErrorType.CONCURRENT_LIMIT_EXCEEDED,
        'Concurrent limit exceeded'
      );

      expect(wrappedError.message).toBe('Concurrent limit exceeded');
      expect(wrappedError.details?.originalError).toBe('String error message');
    });
  });

  describe('Error Categorization', () => {
    it('should categorize validation errors correctly', () => {
      const category = errorHandler.categorizeError(StepProcessorErrorType.VALIDATION_FAILED);
      expect(category).toBe(ErrorCategory.VALIDATION);
    });

    it('should categorize execution errors correctly', () => {
      const category = errorHandler.categorizeError(StepProcessorErrorType.TASK_LOOP_TIMEOUT);
      expect(category).toBe(ErrorCategory.EXECUTION);
    });

    it('should categorize system errors correctly', () => {
      const category = errorHandler.categorizeError(StepProcessorErrorType.CONCURRENT_LIMIT_EXCEEDED);
      expect(category).toBe(ErrorCategory.SYSTEM);
    });

    it('should categorize integration errors correctly', () => {
      const category = errorHandler.categorizeError(StepProcessorErrorType.DEPENDENCY_RESOLUTION_FAILED);
      expect(category).toBe(ErrorCategory.INTEGRATION);
    });

    it('should default to system category for unknown errors', () => {
      const category = errorHandler.categorizeError('UNKNOWN_ERROR_TYPE');
      expect(category).toBe(ErrorCategory.SYSTEM);
    });
  });

  describe('Severity Determination', () => {
    it('should determine critical severity correctly', () => {
      const severity = errorHandler.determineSeverity(StepProcessorErrorType.SESSION_CREATION_FAILED);
      expect(severity).toBe(ErrorSeverity.CRITICAL);
    });

    it('should determine high severity correctly', () => {
      const severity = errorHandler.determineSeverity(StepProcessorErrorType.TASK_LOOP_TIMEOUT);
      expect(severity).toBe(ErrorSeverity.HIGH);
    });

    it('should determine medium severity correctly', () => {
      const severity = errorHandler.determineSeverity(StepProcessorErrorType.STREAMING_INITIALIZATION_FAILED);
      expect(severity).toBe(ErrorSeverity.MEDIUM);
    });

    it('should default to low severity for unknown errors', () => {
      const severity = errorHandler.determineSeverity('UNKNOWN_ERROR_TYPE');
      expect(severity).toBe(ErrorSeverity.LOW);
    });
  });

  describe('Recoverability Assessment', () => {
    it('should identify non-recoverable errors', () => {
      expect(errorHandler.isRecoverable(StepProcessorErrorType.VALIDATION_FAILED)).toBe(false);
      expect(errorHandler.isRecoverable(StepProcessorErrorType.MODULE_INITIALIZATION_FAILED)).toBe(false);
      expect(errorHandler.isRecoverable(StepProcessorErrorType.DEPENDENCY_RESOLUTION_FAILED)).toBe(false);
    });

    it('should identify recoverable errors', () => {
      expect(errorHandler.isRecoverable(StepProcessorErrorType.TASK_LOOP_TIMEOUT)).toBe(true);
      expect(errorHandler.isRecoverable(StepProcessorErrorType.SESSION_CREATION_FAILED)).toBe(true);
      expect(errorHandler.isRecoverable(StepProcessorErrorType.CONCURRENT_LIMIT_EXCEEDED)).toBe(true);
    });
  });

  describe('Retry Capability Assessment', () => {
    it('should identify retryable errors', () => {
      expect(errorHandler.isRetryable(StepProcessorErrorType.TASK_LOOP_TIMEOUT)).toBe(true);
      expect(errorHandler.isRetryable(StepProcessorErrorType.SESSION_CREATION_FAILED)).toBe(true);
      expect(errorHandler.isRetryable(StepProcessorErrorType.STREAMING_INITIALIZATION_FAILED)).toBe(true);
    });

    it('should identify non-retryable errors', () => {
      expect(errorHandler.isRetryable(StepProcessorErrorType.VALIDATION_FAILED)).toBe(false);
      expect(errorHandler.isRetryable(StepProcessorErrorType.MODULE_INITIALIZATION_FAILED)).toBe(false);
    });
  });

  describe('Suggested Actions', () => {
    it('should provide appropriate suggested actions', () => {
      expect(errorHandler.getSuggestedAction(StepProcessorErrorType.VALIDATION_FAILED))
        .toBe('Check step format and content');
      
      expect(errorHandler.getSuggestedAction(StepProcessorErrorType.SESSION_CREATION_FAILED))
        .toBe('Retry with exponential backoff');
      
      expect(errorHandler.getSuggestedAction(StepProcessorErrorType.TASK_LOOP_TIMEOUT))
        .toBe('Increase timeout or simplify steps');
      
      expect(errorHandler.getSuggestedAction(StepProcessorErrorType.CONCURRENT_LIMIT_EXCEEDED))
        .toBe('Wait for available session slots');
    });

    it('should provide default action for unknown errors', () => {
      expect(errorHandler.getSuggestedAction('UNKNOWN_ERROR_TYPE'))
        .toBe('Contact system administrator');
    });
  });

  describe('Error Handling', () => {
    it('should handle errors with logging', () => {
      const error: StandardError = {
        id: 'error-123',
        category: ErrorCategory.EXECUTION,
        severity: ErrorSeverity.HIGH,
        code: 'TEST_ERROR',
        message: 'Test error message',
        timestamp: new Date(),
        moduleId: 'step-processor',
        recoverable: true,
        retryable: true,
        details: { additionalInfo: 'test data' }
      };

      errorHandler.handleError(error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Test error message',
        error,
        { details: error.details }
      );
    });

    it('should handle critical errors with additional logging', () => {
      const criticalError: StandardError = {
        id: 'critical-error-123',
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.CRITICAL,
        code: 'CRITICAL_ERROR',
        message: 'Critical error occurred',
        timestamp: new Date(),
        moduleId: 'step-processor',
        recoverable: false,
        retryable: false
      };

      errorHandler.handleError(criticalError);

      expect(mockLogger.error).toHaveBeenCalledTimes(2);
      expect(mockLogger.error).toHaveBeenNthCalledWith(1, 
        'Critical error occurred',
        criticalError,
        { details: undefined }
      );
      expect(mockLogger.error).toHaveBeenNthCalledWith(2,
        'CRITICAL ERROR DETECTED',
        criticalError
      );
    });
  });

  describe('Specific Error Handling Methods', () => {
    it('should handle session errors', async () => {
      const error: StandardError = {
        id: 'session-error-123',
        category: ErrorCategory.EXECUTION,
        severity: ErrorSeverity.HIGH,
        code: 'SESSION_ERROR',
        message: 'Session error occurred',
        timestamp: new Date(),
        moduleId: 'step-processor',
        recoverable: true,
        retryable: true
      };

      await errorHandler.handleSessionError('workflow-123', error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Session error occurred',
        error,
        {
          sessionId: 'workflow-123',
          details: { workflowSessionId: 'workflow-123' }
        }
      );
    });

    it('should handle step errors', async () => {
      const error: StandardError = {
        id: 'step-error-123',
        category: ErrorCategory.EXECUTION,
        severity: ErrorSeverity.MEDIUM,
        code: 'STEP_ERROR',
        message: 'Step error occurred',
        timestamp: new Date(),
        moduleId: 'step-processor',
        recoverable: true,
        retryable: true
      };

      await errorHandler.handleStepError('workflow-123', 5, error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Step error occurred',
        error,
        {
          sessionId: 'workflow-123',
          stepIndex: 5,
          details: { workflowSessionId: 'workflow-123', stepIndex: 5 }
        }
      );
    });

    it('should handle batch errors', async () => {
      const error: StandardError = {
        id: 'batch-error-123',
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.HIGH,
        code: 'BATCH_ERROR',
        message: 'Batch error occurred',
        timestamp: new Date(),
        moduleId: 'step-processor',
        recoverable: true,
        retryable: true
      };

      await errorHandler.handleBatchError('batch-456', error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Batch error occurred',
        error,
        {
          details: { batchId: 'batch-456' }
        }
      );
    });
  });
});
