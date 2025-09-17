/**
 * Step Processor Error Handler Unit Tests
 * Tests for error handling functionality
 */

import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { ErrorCategory, ErrorSeverity } from '../../../../types/shared-types';
import { 
  StepProcessorErrorHandlerImpl,
  StepProcessorErrorHelpers,
  createStepProcessorErrorHandler
} from '../error-handler';
import { 
  STEP_PROCESSOR_ERROR_CODES 
} from '../types';

describe('StepProcessorErrorHandler', () => {
  let errorHandler: StepProcessorErrorHandlerImpl;

  beforeEach(() => {
    errorHandler = new StepProcessorErrorHandlerImpl();
    jest.clearAllMocks();
  });

  describe('createStandardError', () => {
    it('should create standard error with all fields', () => {
      const error = errorHandler.createStandardError(
        'VALIDATION_FAILED',
        'Test validation error',
        { field: 'steps' }
      );

      expect(error).toMatchObject({
        id: expect.any(String),
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.LOW,
        code: STEP_PROCESSOR_ERROR_CODES.VALIDATION_FAILED,
        message: 'Test validation error',
        details: { field: 'steps' },
        timestamp: expect.any(Date),
        moduleId: 'step-processor',
        recoverable: false,
        retryable: false,
        suggestedAction: expect.any(String)
      });
    });

    it('should handle unknown error codes', () => {
      const error = errorHandler.createStandardError(
        'UNKNOWN_ERROR',
        'Unknown error'
      );

      expect(error.code).toBe('UNKNOWN_ERROR');
      expect(error.category).toBe(ErrorCategory.SYSTEM);
    });

    it('should wrap cause errors', () => {
      const cause = new Error('Underlying error');
      const error = errorHandler.createStandardError(
        'SESSION_CREATION_FAILED',
        'Session creation failed',
        {},
        cause
      );

      expect(error.cause).toBeDefined();
      expect(error.cause?.message).toContain('Wrapped underlying error');
    });
  });

  describe('wrapError', () => {
    it('should wrap native Error objects', () => {
      const nativeError = new Error('Native error message');
      nativeError.stack = 'Error stack trace';
      
      const wrappedError = errorHandler.wrapError(
        nativeError,
        'TASK_LOOP_TIMEOUT',
        'Task loop timed out'
      );

      expect(wrappedError.message).toBe('Task loop timed out');
      expect(wrappedError.details?.originalError).toBe('Native error message');
      expect(wrappedError.details?.originalStack).toBe('Error stack trace');
    });

    it('should return StandardError as-is', () => {
      const standardError = errorHandler.createStandardError(
        'VALIDATION_FAILED',
        'Already standard'
      );
      
      const result = errorHandler.wrapError(
        standardError,
        'DIFFERENT_CODE',
        'Different message'
      );

      expect(result).toBe(standardError);
    });

    it('should handle non-Error objects', () => {
      const stringError = 'Simple string error';
      
      const wrappedError = errorHandler.wrapError(
        stringError,
        'CONCURRENT_LIMIT_EXCEEDED',
        'Limit exceeded'
      );

      expect(wrappedError.details?.originalError).toBe(stringError);
    });
  });

  describe('handleError', () => {
    let consoleSpy: jest.SpiedFunction<any>;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should log critical errors to console.error', () => {
      const criticalError = errorHandler.createStandardError(
        'SESSION_CREATION_FAILED',
        'Critical error'
      );

      errorHandler.handleError(criticalError);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[StepProcessor][CRITICAL]'),
        criticalError
      );
    });

    it('should log high severity errors to console.error', () => {
      const highError = errorHandler.createStandardError(
        'TASK_LOOP_TIMEOUT',
        'High severity error'
      );

      errorHandler.handleError(highError);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[StepProcessor][ERROR]'),
        highError
      );
    });
  });

  describe('categorizeError', () => {
    it('should categorize validation errors correctly', () => {
      expect(errorHandler.categorizeError('VALIDATION_FAILED')).toBe(ErrorCategory.VALIDATION);
    });

    it('should categorize execution errors correctly', () => {
      expect(errorHandler.categorizeError('TASK_LOOP_TIMEOUT')).toBe(ErrorCategory.EXECUTION);
      expect(errorHandler.categorizeError('SESSION_CREATION_FAILED')).toBe(ErrorCategory.EXECUTION);
      expect(errorHandler.categorizeError('STEP_PROCESSING_TIMEOUT')).toBe(ErrorCategory.EXECUTION);
    });

    it('should categorize system errors correctly', () => {
      expect(errorHandler.categorizeError('CONCURRENT_LIMIT_EXCEEDED')).toBe(ErrorCategory.SYSTEM);
      expect(errorHandler.categorizeError('DEPENDENCY_RESOLUTION_FAILED')).toBe(ErrorCategory.SYSTEM);
    });

    it('should categorize integration errors correctly', () => {
      expect(errorHandler.categorizeError('STREAMING_INITIALIZATION_FAILED')).toBe(ErrorCategory.INTEGRATION);
      expect(errorHandler.categorizeError('EVENT_PUBLISHING_FAILED')).toBe(ErrorCategory.INTEGRATION);
    });

    it('should default to system category for unknown errors', () => {
      expect(errorHandler.categorizeError('UNKNOWN_ERROR')).toBe(ErrorCategory.SYSTEM);
    });
  });

  describe('determineSeverity', () => {
    it('should assign critical severity correctly', () => {
      expect(errorHandler.determineSeverity('SESSION_CREATION_FAILED')).toBe(ErrorSeverity.CRITICAL);
      expect(errorHandler.determineSeverity('CONCURRENT_LIMIT_EXCEEDED')).toBe(ErrorSeverity.CRITICAL);
      expect(errorHandler.determineSeverity('MODULE_INITIALIZATION_FAILED')).toBe(ErrorSeverity.CRITICAL);
    });

    it('should assign high severity correctly', () => {
      expect(errorHandler.determineSeverity('TASK_LOOP_TIMEOUT')).toBe(ErrorSeverity.HIGH);
      expect(errorHandler.determineSeverity('STEP_PROCESSING_TIMEOUT')).toBe(ErrorSeverity.HIGH);
    });

    it('should assign medium severity correctly', () => {
      expect(errorHandler.determineSeverity('STREAMING_INITIALIZATION_FAILED')).toBe(ErrorSeverity.MEDIUM);
      expect(errorHandler.determineSeverity('EVENT_PUBLISHING_FAILED')).toBe(ErrorSeverity.MEDIUM);
    });

    it('should default to low severity', () => {
      expect(errorHandler.determineSeverity('UNKNOWN_ERROR')).toBe(ErrorSeverity.LOW);
    });
  });

  describe('isRecoverable', () => {
    it('should mark unrecoverable errors correctly', () => {
      expect(errorHandler.isRecoverable('VALIDATION_FAILED')).toBe(false);
      expect(errorHandler.isRecoverable('DEPENDENCY_RESOLUTION_FAILED')).toBe(false);
      expect(errorHandler.isRecoverable('MODULE_INITIALIZATION_FAILED')).toBe(false);
    });

    it('should mark recoverable errors correctly', () => {
      expect(errorHandler.isRecoverable('TASK_LOOP_TIMEOUT')).toBe(true);
      expect(errorHandler.isRecoverable('SESSION_CREATION_FAILED')).toBe(true);
      expect(errorHandler.isRecoverable('STREAMING_INITIALIZATION_FAILED')).toBe(true);
    });
  });

  describe('isRetryable', () => {
    it('should mark retryable errors correctly', () => {
      expect(errorHandler.isRetryable('TASK_LOOP_TIMEOUT')).toBe(true);
      expect(errorHandler.isRetryable('SESSION_CREATION_FAILED')).toBe(true);
      expect(errorHandler.isRetryable('STEP_PROCESSING_TIMEOUT')).toBe(true);
      expect(errorHandler.isRetryable('EVENT_PUBLISHING_FAILED')).toBe(true);
    });

    it('should mark non-retryable errors correctly', () => {
      expect(errorHandler.isRetryable('VALIDATION_FAILED')).toBe(false);
      expect(errorHandler.isRetryable('DEPENDENCY_RESOLUTION_FAILED')).toBe(false);
    });
  });

  describe('getSuggestedAction', () => {
    it('should provide specific suggestions for known errors', () => {
      expect(errorHandler.getSuggestedAction('VALIDATION_FAILED'))
        .toContain('Check step format and content');
      
      expect(errorHandler.getSuggestedAction('SESSION_CREATION_FAILED'))
        .toContain('Retry with exponential backoff');
      
      expect(errorHandler.getSuggestedAction('TASK_LOOP_TIMEOUT'))
        .toContain('Increase timeout or simplify steps');
      
      expect(errorHandler.getSuggestedAction('CONCURRENT_LIMIT_EXCEEDED'))
        .toContain('Wait for available session slots');
    });

    it('should provide default suggestion for unknown errors', () => {
      expect(errorHandler.getSuggestedAction('UNKNOWN_ERROR'))
        .toContain('Contact system administrator');
    });
  });

  describe('Step Processor specific error handling', () => {
    it('should handle session errors with context', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      const error = errorHandler.createStandardError(
        'SESSION_CREATION_FAILED',
        'Session creation failed'
      );

      await errorHandler.handleSessionError('test-session-id', error);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle step errors with context', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      const error = errorHandler.createStandardError(
        'STEP_PROCESSING_TIMEOUT',
        'Step processing timed out'
      );

      await errorHandler.handleStepError('test-session-id', 2, error);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle batch errors with context', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      const error = errorHandler.createStandardError(
        'CONCURRENT_LIMIT_EXCEEDED',
        'Batch processing failed'
      );

      await errorHandler.handleBatchError('test-batch-id', error);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});

describe('StepProcessorErrorHelpers', () => {
  describe('Error helper methods', () => {
    it('should create validation error', () => {
      const error = StepProcessorErrorHelpers.validationError(
        'Invalid input',
        { field: 'steps' }
      );

      expect(error.code).toBe(STEP_PROCESSOR_ERROR_CODES.VALIDATION_FAILED);
      expect(error.message).toBe('Invalid input');
      expect(error.details).toEqual({ field: 'steps' });
    });

    it('should create session creation error', () => {
      const cause = new Error('Database error');
      const error = StepProcessorErrorHelpers.sessionCreationError(
        'Failed to create session',
        cause,
        { sessionId: 'test-id' }
      );

      expect(error.code).toBe(STEP_PROCESSOR_ERROR_CODES.SESSION_CREATION_FAILED);
      expect(error.message).toBe('Failed to create session');
      expect(error.cause).toBeDefined();
    });

    it('should create task loop timeout error', () => {
      const error = StepProcessorErrorHelpers.taskLoopTimeoutError(
        'test-session',
        1,
        30000
      );

      expect(error.code).toBe(STEP_PROCESSOR_ERROR_CODES.TASK_LOOP_TIMEOUT);
      expect(error.message).toContain('30000ms');
      expect(error.details).toEqual({
        sessionId: 'test-session',
        stepIndex: 1,
        timeoutMs: 30000
      });
    });

    it('should create concurrent limit error', () => {
      const error = StepProcessorErrorHelpers.concurrentLimitError(15, 10);

      expect(error.code).toBe(STEP_PROCESSOR_ERROR_CODES.CONCURRENT_LIMIT_EXCEEDED);
      expect(error.message).toContain('15/10');
    });

    it('should create workflow session not found error', () => {
      const error = StepProcessorErrorHelpers.workflowSessionNotFoundError('missing-session');

      expect(error.code).toBe(STEP_PROCESSOR_ERROR_CODES.WORKFLOW_SESSION_NOT_FOUND);
      expect(error.message).toContain('missing-session');
    });

    it('should create module initialization error', () => {
      const cause = new Error('Missing dependency');
      const error = StepProcessorErrorHelpers.moduleInitializationError('test-module', cause);

      expect(error.code).toBe(STEP_PROCESSOR_ERROR_CODES.MODULE_INITIALIZATION_FAILED);
      expect(error.message).toContain('test-module');
    });

    it('should create dependency resolution error', () => {
      const error = StepProcessorErrorHelpers.dependencyResolutionError('TestDependency');

      expect(error.code).toBe(STEP_PROCESSOR_ERROR_CODES.DEPENDENCY_RESOLUTION_FAILED);
      expect(error.message).toContain('TestDependency');
    });

    it('should create event publishing error', () => {
      const cause = new Error('Stream not available');
      const error = StepProcessorErrorHelpers.eventPublishingError(
        'STEP_STARTED',
        'test-stream',
        cause
      );

      expect(error.code).toBe(STEP_PROCESSOR_ERROR_CODES.EVENT_PUBLISHING_FAILED);
      expect(error.message).toContain('STEP_STARTED');
      expect(error.details).toEqual({
        eventType: 'STEP_STARTED',
        streamId: 'test-stream'
      });
    });
  });
});

describe('createStepProcessorErrorHandler', () => {
  it('should create error handler instance', () => {
    const handler = createStepProcessorErrorHandler();
    expect(handler).toBeInstanceOf(StepProcessorErrorHandlerImpl);
  });
});
