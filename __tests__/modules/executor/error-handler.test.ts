/**
 * Unit Tests for ExecutorErrorHandler
 * Tests error categorization, severity determination, and standardized error creation
 */

import { ExecutorErrorHandler } from '../../../src/modules/executor/error-handler';
import { ErrorCategory, ErrorSeverity, ERROR_CODES } from '../../../types/shared-types';

describe('ExecutorErrorHandler', () => {
  let errorHandler: ExecutorErrorHandler;

  beforeEach(() => {
    errorHandler = new ExecutorErrorHandler();
  });

  describe('createStandardError', () => {
    it('should create a standard error with all required properties', () => {
      const code = 'SELECTOR_NOT_FOUND';
      const message = 'Element not found';
      const details = { selector: '#test' };

      const error = errorHandler.createStandardError(code, message, details);

      expect(error).toMatchObject({
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.MEDIUM,
        code: 'EX002', // ERROR_CODES.EXECUTOR.SELECTOR_NOT_FOUND
        message,
        details,
        moduleId: 'executor',
        recoverable: true,
        retryable: false,
        suggestedAction: 'Verify element selector and wait for page load'
      });

      expect(error.id).toBeDefined();
      expect(error.timestamp).toBeInstanceOf(Date);
      expect(error.cause).toBeUndefined();
    });

    it('should wrap the cause error when provided', () => {
      const originalError = new Error('Original error message');
      const error = errorHandler.createStandardError(
        'BROWSER_LAUNCH_FAILED',
        'Failed to launch browser',
        undefined,
        originalError
      );

      expect(error.cause).toBeDefined();
      expect(error.cause?.message).toContain('Original error message');
      expect(error.cause?.moduleId).toBe('executor');
    });

    it('should use ERROR_CODES mapping when available', () => {
      const code = 'SELECTOR_NOT_FOUND';
      const error = errorHandler.createStandardError(code, 'Test message');

      // Assuming ERROR_CODES.EXECUTOR.SELECTOR_NOT_FOUND exists
      if (ERROR_CODES.EXECUTOR[code as keyof typeof ERROR_CODES.EXECUTOR]) {
        expect(error.code).toBe(ERROR_CODES.EXECUTOR[code as keyof typeof ERROR_CODES.EXECUTOR]);
      } else {
        expect(error.code).toBe(code);
      }
    });
  });

  describe('error categorization', () => {
    it('should categorize validation errors correctly', () => {
      const validationErrors = ['SELECTOR_NOT_FOUND', 'ELEMENT_NOT_INTERACTABLE', 'INVALID_COMMAND'];
      
      validationErrors.forEach(code => {
        const error = errorHandler.createStandardError(code, 'Test message');
        expect(error.category).toBe(ErrorCategory.VALIDATION);
      });
    });

    it('should categorize execution errors correctly', () => {
      const executionErrors = ['PAGE_LOAD_TIMEOUT', 'SCREENSHOT_FAILED'];
      
      executionErrors.forEach(code => {
        const error = errorHandler.createStandardError(code, 'Test message');
        expect(error.category).toBe(ErrorCategory.EXECUTION);
      });
    });

    it('should categorize system errors correctly', () => {
      const systemErrors = ['BROWSER_LAUNCH_FAILED', 'SESSION_NOT_FOUND'];
      
      systemErrors.forEach(code => {
        const error = errorHandler.createStandardError(code, 'Test message');
        expect(error.category).toBe(ErrorCategory.SYSTEM);
      });
    });

    it('should default to integration category for unknown errors', () => {
      const error = errorHandler.createStandardError('UNKNOWN_ERROR', 'Test message');
      expect(error.category).toBe(ErrorCategory.INTEGRATION);
    });
  });

  describe('severity determination', () => {
    it('should assign critical severity to browser launch failures', () => {
      const error = errorHandler.createStandardError('BROWSER_LAUNCH_FAILED', 'Test message');
      expect(error.severity).toBe(ErrorSeverity.CRITICAL);
    });

    it('should assign high severity to timeouts and session errors', () => {
      const highSeverityErrors = ['PAGE_LOAD_TIMEOUT', 'SESSION_NOT_FOUND'];
      
      highSeverityErrors.forEach(code => {
        const error = errorHandler.createStandardError(code, 'Test message');
        expect(error.severity).toBe(ErrorSeverity.HIGH);
      });
    });

    it('should assign medium severity to selector and interaction errors', () => {
      const mediumSeverityErrors = ['SELECTOR_NOT_FOUND', 'ELEMENT_NOT_INTERACTABLE'];
      
      mediumSeverityErrors.forEach(code => {
        const error = errorHandler.createStandardError(code, 'Test message');
        expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      });
    });

    it('should assign low severity to screenshot errors', () => {
      const error = errorHandler.createStandardError('SCREENSHOT_FAILED', 'Test message');
      expect(error.severity).toBe(ErrorSeverity.LOW);
    });

    it('should default to medium severity for unknown errors', () => {
      const error = errorHandler.createStandardError('UNKNOWN_ERROR', 'Test message');
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
    });
  });

  describe('recoverability determination', () => {
    it('should mark browser launch failures as unrecoverable', () => {
      const error = errorHandler.createStandardError('BROWSER_LAUNCH_FAILED', 'Test message');
      expect(error.recoverable).toBe(false);
    });

    it('should mark most errors as recoverable', () => {
      const recoverableErrors = [
        'SELECTOR_NOT_FOUND',
        'ELEMENT_NOT_INTERACTABLE',
        'PAGE_LOAD_TIMEOUT',
        'SCREENSHOT_FAILED',
        'SESSION_NOT_FOUND'
      ];
      
      recoverableErrors.forEach(code => {
        const error = errorHandler.createStandardError(code, 'Test message');
        expect(error.recoverable).toBe(true);
      });
    });
  });

  describe('retryability determination', () => {
    it('should mark timeout and screenshot errors as retryable', () => {
      const retryableErrors = ['PAGE_LOAD_TIMEOUT', 'SCREENSHOT_FAILED'];
      
      retryableErrors.forEach(code => {
        const error = errorHandler.createStandardError(code, 'Test message');
        expect(error.retryable).toBe(true);
      });
    });

    it('should mark element not interactable as retryable', () => {
      const error = errorHandler.createStandardError('ELEMENT_NOT_INTERACTABLE', 'Test message');
      expect(error.retryable).toBe(true);
    });

    it('should mark selector and browser errors as non-retryable', () => {
      const nonRetryableErrors = [
        'SELECTOR_NOT_FOUND',
        'BROWSER_LAUNCH_FAILED',
        'SESSION_NOT_FOUND'
      ];
      
      nonRetryableErrors.forEach(code => {
        const error = errorHandler.createStandardError(code, 'Test message');
        expect(error.retryable).toBe(false);
      });
    });
  });

  describe('suggested actions', () => {
    it('should provide appropriate suggested actions for known errors', () => {
      const expectedActions = {
        'BROWSER_LAUNCH_FAILED': 'Check browser installation and permissions',
        'SELECTOR_NOT_FOUND': 'Verify element selector and wait for page load',
        'ELEMENT_NOT_INTERACTABLE': 'Wait for element to become visible and enabled',
        'PAGE_LOAD_TIMEOUT': 'Check network connection and increase timeout',
        'SCREENSHOT_FAILED': 'Verify screenshot directory permissions',
        'SESSION_NOT_FOUND': 'Ensure session exists or create a new session',
        'INVALID_COMMAND': 'Validate command parameters and action type'
      };

      Object.entries(expectedActions).forEach(([code, expectedAction]) => {
        const error = errorHandler.createStandardError(code, 'Test message');
        expect(error.suggestedAction).toBe(expectedAction);
      });
    });

    it('should provide default suggested action for unknown errors', () => {
      const error = errorHandler.createStandardError('UNKNOWN_ERROR', 'Test message');
      expect(error.suggestedAction).toBe('Check system resources and retry');
    });
  });

  describe('convenience methods', () => {
    it('should create session not found error', () => {
      const sessionId = 'test-session-123';
      const error = errorHandler.createSessionNotFoundError(sessionId);

      expect(error.code).toBe('EX006');
      expect(error.message).toContain(sessionId);
      expect(error.category).toBe(ErrorCategory.SYSTEM);
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.details?.sessionId).toBe(sessionId);
    });

    it('should create invalid command error', () => {
      const command = 'INVALID_ACTION';
      const reason = 'Unknown action type';
      const error = errorHandler.createInvalidCommandError(command, reason);

      expect(error.code).toBe('EX007');
      expect(error.message).toContain(reason);
      expect(error.category).toBe(ErrorCategory.VALIDATION);
      expect(error.details?.command).toBe(command);
      expect(error.details?.reason).toBe(reason);
    });

    it('should create selector error', () => {
      const selector = '#non-existent';
      const error = errorHandler.createSelectorError(selector);

      expect(error.code).toBe('EX002');
      expect(error.message).toContain(selector);
      expect(error.category).toBe(ErrorCategory.VALIDATION);
      expect(error.details?.selector).toBe(selector);
    });

    it('should create element interaction error', () => {
      const selector = '#disabled-button';
      const action = 'click';
      const error = errorHandler.createElementError(selector, action);

      expect(error.code).toBe('EX003');
      expect(error.message).toContain(selector);
      expect(error.message).toContain(action);
      expect(error.category).toBe(ErrorCategory.VALIDATION);
      expect(error.details?.selector).toBe(selector);
      expect(error.details?.action).toBe(action);
    });

    it('should create page load timeout error', () => {
      const url = 'https://slow-loading-site.com';
      const timeout = 30000;
      const error = errorHandler.createPageLoadError(url, timeout);

      expect(error.code).toBe('EX004');
      expect(error.message).toContain(url);
      expect(error.message).toContain(timeout.toString());
      expect(error.category).toBe(ErrorCategory.EXECUTION);
      expect(error.details?.url).toBe(url);
      expect(error.details?.timeout).toBe(timeout);
    });

    it('should create browser error', () => {
      const message = 'Failed to launch browser';
      const originalError = new Error('Binary not found');
      const error = errorHandler.createBrowserError(message, originalError);

      expect(error.code).toBe('EX001');
      expect(error.message).toBe(message);
      expect(error.category).toBe(ErrorCategory.SYSTEM);
      expect(error.severity).toBe(ErrorSeverity.CRITICAL);
      expect(error.details?.browserType).toBe('chromium');
      expect(error.cause).toBeDefined();
    });

    it('should create screenshot error', () => {
      const sessionId = 'test-session';
      const reason = 'Permission denied';
      const originalError = new Error('Write failed');
      const error = errorHandler.createScreenshotError(sessionId, reason, originalError);

      expect(error.code).toBe('EX005');
      expect(error.message).toContain(sessionId);
      expect(error.message).toContain(reason);
      expect(error.category).toBe(ErrorCategory.EXECUTION);
      expect(error.severity).toBe(ErrorSeverity.LOW);
      expect(error.details?.sessionId).toBe(sessionId);
      expect(error.details?.reason).toBe(reason);
      expect(error.cause).toBeDefined();
    });
  });

  describe('error wrapping', () => {
    it('should wrap JavaScript errors correctly', () => {
      const jsError = new TypeError('Cannot read property of null');
      jsError.stack = 'TypeError: Cannot read property\n    at test.js:10:5';

      const wrappedError = errorHandler.createStandardError(
        'WRAPPED_ERROR',
        'Test wrapper',
        {},
        jsError
      );

      expect(wrappedError.cause).toBeDefined();
      expect(wrappedError.cause?.message).toContain(jsError.message);
      expect(wrappedError.cause?.details?.originalError).toBe('TypeError');
      expect(wrappedError.cause?.details?.stack).toBe(jsError.stack);
      expect(wrappedError.cause?.details?.originalMessage).toBe(jsError.message);
    });

    it('should handle errors without stack traces', () => {
      const simpleError = new Error('Simple error');
      delete simpleError.stack;

      const wrappedError = errorHandler.createStandardError(
        'TEST_ERROR',
        'Test wrapper',
        {},
        simpleError
      );

      expect(wrappedError.cause).toBeDefined();
      expect(wrappedError.cause?.details?.stack).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle null and undefined values gracefully', () => {
      const error1 = errorHandler.createStandardError('TEST', 'message', null as any);
      const error2 = errorHandler.createStandardError('TEST', 'message', undefined);

      expect(error1.details).toBeNull();
      expect(error2.details).toBeUndefined();
    });

    it('should handle empty strings and special characters in error codes', () => {
      const error1 = errorHandler.createStandardError('', 'Empty code');
      const error2 = errorHandler.createStandardError('TEST_ERROR_WITH_SPECIAL-CHARS_123', 'Special chars');

      expect(error1.code).toBe('');
      expect(error2.code).toBe('TEST_ERROR_WITH_SPECIAL-CHARS_123');
    });

    it('should generate unique error IDs for each error', () => {
      const error1 = errorHandler.createStandardError('TEST', 'message 1');
      const error2 = errorHandler.createStandardError('TEST', 'message 2');

      expect(error1.id).not.toBe(error2.id);
      expect(error1.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(error2.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
  });
});
