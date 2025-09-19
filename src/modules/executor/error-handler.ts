/**
 * Executor Error Handler
 * Implements standardized error handling with categorization and context
 */

import { 
  StandardError, 
  ErrorCategory, 
  ErrorSeverity, 
  ERROR_CODES,
  ErrorDetails,
  ExecutorCommand
} from './types';
import { v4 as uuidv4 } from 'uuid';

export class ExecutorErrorHandler {
  createStandardError(
    code: string, 
    message: string, 
    details?: ErrorDetails, 
    cause?: Error
  ): StandardError {
    return {
      id: uuidv4(),
      category: this.categorizeError(code),
      severity: this.determineSeverity(code),
      code: ERROR_CODES.EXECUTOR[code as keyof typeof ERROR_CODES.EXECUTOR] || code,
      message,
      details,
      cause: cause ? this.wrapError(cause) : undefined,
      timestamp: new Date(),
      moduleId: 'executor',
      recoverable: this.isRecoverable(code),
      retryable: this.isRetryable(code),
      suggestedAction: this.getSuggestedAction(code)
    };
  }

  private categorizeError(code: string): ErrorCategory {
    const validationErrors = ['SELECTOR_NOT_FOUND', 'ELEMENT_NOT_INTERACTABLE', 'INVALID_COMMAND'];
    const executionErrors = ['PAGE_LOAD_TIMEOUT', 'SCREENSHOT_FAILED'];
    const systemErrors = ['BROWSER_LAUNCH_FAILED', 'SESSION_NOT_FOUND'];
    
    if (validationErrors.includes(code)) return ErrorCategory.VALIDATION;
    if (executionErrors.includes(code)) return ErrorCategory.EXECUTION;
    if (systemErrors.includes(code)) return ErrorCategory.SYSTEM;
    return ErrorCategory.INTEGRATION;
  }

  private determineSeverity(code: string): ErrorSeverity {
    const criticalErrors = ['BROWSER_LAUNCH_FAILED'];
    const highErrors = ['PAGE_LOAD_TIMEOUT', 'SESSION_NOT_FOUND'];
    const mediumErrors = ['SELECTOR_NOT_FOUND', 'ELEMENT_NOT_INTERACTABLE'];
    const lowErrors = ['SCREENSHOT_FAILED'];
    
    if (criticalErrors.includes(code)) return ErrorSeverity.CRITICAL;
    if (highErrors.includes(code)) return ErrorSeverity.HIGH;
    if (mediumErrors.includes(code)) return ErrorSeverity.MEDIUM;
    if (lowErrors.includes(code)) return ErrorSeverity.LOW;
    return ErrorSeverity.MEDIUM;
  }

  private isRecoverable(code: string): boolean {
    const unrecoverableErrors = ['BROWSER_LAUNCH_FAILED'];
    return !unrecoverableErrors.includes(code);
  }

  private isRetryable(code: string): boolean {
    const retryableErrors = ['PAGE_LOAD_TIMEOUT', 'SCREENSHOT_FAILED', 'ELEMENT_NOT_INTERACTABLE'];
    return retryableErrors.includes(code);
  }

  private getSuggestedAction(code: string): string {
    const actions: Record<string, string> = {
      'BROWSER_LAUNCH_FAILED': 'Check browser installation and permissions',
      'SELECTOR_NOT_FOUND': 'Verify element selector and wait for page load',
      'ELEMENT_NOT_INTERACTABLE': 'Wait for element to become visible and enabled',
      'PAGE_LOAD_TIMEOUT': 'Check network connection and increase timeout',
      'SCREENSHOT_FAILED': 'Verify screenshot directory permissions',
      'SESSION_NOT_FOUND': 'Ensure session exists or create a new session',
      'INVALID_COMMAND': 'Validate command parameters and action type'
    };
    return actions[code] || 'Check system resources and retry';
  }

  private wrapError(cause: Error): StandardError {
    return this.createStandardError(
      'WRAPPED_ERROR',
      `Wrapped error: ${cause.message}`,
      { 
        originalError: cause.name, 
        stack: cause.stack,
        originalMessage: cause.message 
      },
      undefined
    );
  }

  /**
   * Creates error for browser-related failures
   */
  createBrowserError(message: string, cause?: Error): StandardError {
    return this.createStandardError(
      'BROWSER_LAUNCH_FAILED',
      message,
      { browserType: 'chromium' },
      cause
    );
  }

  /**
   * Creates error for element interaction failures
   */
  createElementError(selector: string, action: string, cause?: Error): StandardError {
    return this.createStandardError(
      'ELEMENT_NOT_INTERACTABLE',
      `Cannot ${action} element with selector: ${selector}`,
      { selector, action },
      cause
    );
  }

  /**
   * Creates error for selector not found
   */
  createSelectorError(selector: string, cause?: Error): StandardError {
    return this.createStandardError(
      'SELECTOR_NOT_FOUND',
      `Element not found with selector: ${selector}`,
      { selector },
      cause
    );
  }

  /**
   * Creates error for page load timeouts
   */
  createPageLoadError(url: string, timeout: number, cause?: Error): StandardError {
    return this.createStandardError(
      'PAGE_LOAD_TIMEOUT',
      `Page load timeout after ${timeout}ms for URL: ${url}`,
      { url, timeout },
      cause
    );
  }

  /**
   * Creates error for screenshot failures
   */
  createScreenshotError(sessionId: string, reason: string, cause?: Error): StandardError {
    return this.createStandardError(
      'SCREENSHOT_FAILED',
      `Screenshot capture failed for session ${sessionId}: ${reason}`,
      { sessionId, reason },
      cause
    );
  }

  /**
   * Creates error for session not found
   */
  createSessionNotFoundError(sessionId: string): StandardError {
    return this.createStandardError(
      'SESSION_NOT_FOUND',
      `Session not found: ${sessionId}`,
      { sessionId }
    );
  }

  /**
   * Creates error for invalid commands
   */
  createInvalidCommandError(command: ExecutorCommand, reason: string): StandardError {
    return this.createStandardError(
      'INVALID_COMMAND',
      `Invalid command: ${reason}`,
      { command, reason }
    );
  }
}

