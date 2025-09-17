/**
 * Frontend API Error Handler
 * Implements standardized error handling with HTTP status mapping
 */

import { v4 as uuidv4 } from 'uuid';
import {
  StandardError,
  ErrorCategory,
  ErrorSeverity,
  ERROR_CODES,
  APIResponse,
  APIError,
  SYSTEM_VERSION
} from '../../../types/shared-types';
import {
  ErrorHandlingMiddleware,
  FrontendAPIConfig
} from './types';

export class FrontendAPIErrorHandler implements ErrorHandlingMiddleware {
  private config: FrontendAPIConfig;

  constructor(config: FrontendAPIConfig) {
    this.config = config;
  }

  /**
   * Handles standardized errors and sends appropriate HTTP response
   */
  async handleStandardError(error: any, response: any): Promise<void> {
    const standardError = this.wrapError(error);
    const httpStatus = this.getHttpStatus(standardError);
    
    const errorResponse: APIResponse = {
      success: false,
      error: {
        code: standardError.code,
        message: standardError.message,
        details: standardError.details,
        retryable: standardError.retryable,
        timestamp: standardError.timestamp.toISOString()
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: uuidv4(),
        version: `${SYSTEM_VERSION.major}.${SYSTEM_VERSION.minor}.${SYSTEM_VERSION.patch}`,
        processingTimeMs: 0
      }
    };
    
    // Log the error
    this.logError(standardError);
    
    response.status(httpStatus).json(errorResponse);
  }

  /**
   * Wraps any error into a StandardError format
   */
  wrapError(error: any): StandardError {
    // If already a StandardError, return as-is
    if (this.isStandardError(error)) {
      return error as StandardError;
    }

    // Determine error category and code based on error type/message
    let code = 'INTERNAL_ERROR';
    let category = ErrorCategory.SYSTEM;
    let severity = ErrorSeverity.HIGH;
    let retryable = false;
    let recoverable = false;

    if (this.isValidationError(error)) {
      code = ERROR_CODES.FRONTEND_API.REQUEST_VALIDATION_FAILED;
      category = ErrorCategory.VALIDATION;
      severity = ErrorSeverity.MEDIUM;
      retryable = false;
      recoverable = true;
    } else if (this.isNotFoundError(error)) {
      code = ERROR_CODES.FRONTEND_API.SESSION_NOT_FOUND;
      category = ErrorCategory.USER;
      severity = ErrorSeverity.LOW;
      retryable = false;
      recoverable = false;
    } else if (this.isAuthenticationError(error)) {
      code = ERROR_CODES.FRONTEND_API.AUTHENTICATION_FAILED;
      category = ErrorCategory.USER;
      severity = ErrorSeverity.MEDIUM;
      retryable = false;
      recoverable = true;
    } else if (this.isRateLimitError(error)) {
      code = ERROR_CODES.FRONTEND_API.RATE_LIMIT_EXCEEDED;
      category = ErrorCategory.SYSTEM;
      severity = ErrorSeverity.MEDIUM;
      retryable = true;
      recoverable = true;
    } else if (this.isTimeoutError(error)) {
      code = 'REQUEST_TIMEOUT';
      category = ErrorCategory.EXECUTION;
      severity = ErrorSeverity.MEDIUM;
      retryable = true;
      recoverable = true;
    } else if (this.isNetworkError(error)) {
      code = 'NETWORK_ERROR';
      category = ErrorCategory.INTEGRATION;
      severity = ErrorSeverity.HIGH;
      retryable = true;
      recoverable = true;
    }

    return {
      id: uuidv4(),
      category,
      severity,
      code,
      message: error.message || 'An unexpected error occurred',
      details: {
        originalError: error.name,
        stack: error.stack,
        ...(error.details || {})
      },
      timestamp: new Date(),
      moduleId: 'frontend-api',
      recoverable,
      retryable,
      suggestedAction: this.getSuggestedAction(code)
    };
  }

  /**
   * Maps StandardError to appropriate HTTP status code
   */
  getHttpStatus(error: StandardError): number {
    // Check specific error codes first
    switch (error.code) {
      case ERROR_CODES.FRONTEND_API.REQUEST_VALIDATION_FAILED:
        return 400;
      case ERROR_CODES.FRONTEND_API.AUTHENTICATION_FAILED:
        return 401;
      case ERROR_CODES.FRONTEND_API.RATE_LIMIT_EXCEEDED:
        return 429;
      case ERROR_CODES.FRONTEND_API.SESSION_NOT_FOUND:
        return 404;
      case 'REQUEST_TIMEOUT':
        return 408;
      case 'NETWORK_ERROR':
        return 502;
      case 'SERVICE_UNAVAILABLE':
        return 503;
    }

    // Fall back to category-based mapping
    switch (error.category) {
      case ErrorCategory.VALIDATION:
        return 400;
      case ErrorCategory.USER:
        if (error.code.includes('NOT_FOUND')) return 404;
        if (error.code.includes('AUTHENTICATION')) return 401;
        if (error.code.includes('AUTHORIZATION')) return 403;
        return 400;
      case ErrorCategory.EXECUTION:
        if (error.code.includes('TIMEOUT')) return 408;
        return 500;
      case ErrorCategory.INTEGRATION:
        if (error.code.includes('UNAVAILABLE')) return 503;
        return 502;
      case ErrorCategory.SYSTEM:
        if (error.code.includes('RATE_LIMIT')) return 429;
        return 500;
      default:
        return 500;
    }
  }

  /**
   * Creates an API error from a StandardError
   */
  createAPIError(standardError: StandardError): APIError {
    return {
      code: standardError.code,
      message: standardError.message,
      details: standardError.details,
      retryable: standardError.retryable,
      timestamp: standardError.timestamp.toISOString()
    };
  }

  /**
   * Creates a validation error response
   */
  createValidationErrorResponse(errors: string[]): APIResponse {
    const standardError = this.createValidationError(errors);
    return {
      success: false,
      error: this.createAPIError(standardError),
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: uuidv4(),
        version: `${SYSTEM_VERSION.major}.${SYSTEM_VERSION.minor}.${SYSTEM_VERSION.patch}`,
        processingTimeMs: 0
      }
    };
  }

  /**
   * Creates a not found error response
   */
  createNotFoundErrorResponse(resource: string, id: string): APIResponse {
    const standardError: StandardError = {
      id: uuidv4(),
      category: ErrorCategory.USER,
      severity: ErrorSeverity.LOW,
      code: ERROR_CODES.FRONTEND_API.SESSION_NOT_FOUND,
      message: `${resource} ${id} not found`,
      timestamp: new Date(),
      moduleId: 'frontend-api',
      recoverable: false,
      retryable: false,
      suggestedAction: `Verify that ${resource} ${id} exists`
    };

    return {
      success: false,
      error: this.createAPIError(standardError),
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: uuidv4(),
        version: `${SYSTEM_VERSION.major}.${SYSTEM_VERSION.minor}.${SYSTEM_VERSION.patch}`,
        processingTimeMs: 0
      }
    };
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private isStandardError(error: any): boolean {
    return error && 
           typeof error.id === 'string' && 
           typeof error.category === 'string' && 
           typeof error.severity === 'string' &&
           typeof error.code === 'string' &&
           error.timestamp instanceof Date;
  }

  private isValidationError(error: any): boolean {
    return error.name === 'ValidationError' ||
           error.type === 'validation' ||
           error.message?.includes('validation') ||
           error.message?.includes('invalid');
  }

  private isNotFoundError(error: any): boolean {
    return error.message?.includes('not found') ||
           error.message?.includes('does not exist') ||
           error.status === 404;
  }

  private isAuthenticationError(error: any): boolean {
    return error.name === 'AuthenticationError' ||
           error.message?.includes('authentication') ||
           error.message?.includes('unauthorized') ||
           error.status === 401;
  }

  private isRateLimitError(error: any): boolean {
    return error.name === 'RateLimitError' ||
           error.message?.includes('rate limit') ||
           error.message?.includes('too many requests') ||
           error.status === 429;
  }

  private isTimeoutError(error: any): boolean {
    return error.name === 'TimeoutError' ||
           error.code === 'TIMEOUT' ||
           error.message?.includes('timeout') ||
           error.status === 408;
  }

  private isNetworkError(error: any): boolean {
    return error.name === 'NetworkError' ||
           error.code === 'ECONNREFUSED' ||
           error.code === 'ENOTFOUND' ||
           error.code === 'ECONNRESET' ||
           error.message?.includes('network') ||
           error.message?.includes('connection');
  }

  private getSuggestedAction(code: string): string {
    const actions: Record<string, string> = {
      [ERROR_CODES.FRONTEND_API.REQUEST_VALIDATION_FAILED]: 'Check request format and required fields',
      [ERROR_CODES.FRONTEND_API.AUTHENTICATION_FAILED]: 'Verify API credentials',
      [ERROR_CODES.FRONTEND_API.RATE_LIMIT_EXCEEDED]: 'Wait before retrying request',
      [ERROR_CODES.FRONTEND_API.SESSION_NOT_FOUND]: 'Verify session ID exists',
      'REQUEST_TIMEOUT': 'Retry with shorter execution time',
      'NETWORK_ERROR': 'Check network connectivity and service availability',
      'SERVICE_UNAVAILABLE': 'Wait for service to become available'
    };
    
    return actions[code] || 'Contact system administrator';
  }

  private createValidationError(errors: string[]): StandardError {
    return {
      id: uuidv4(),
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.MEDIUM,
      code: ERROR_CODES.FRONTEND_API.REQUEST_VALIDATION_FAILED,
      message: 'Request validation failed',
      details: { validationErrors: errors },
      timestamp: new Date(),
      moduleId: 'frontend-api',
      recoverable: true,
      retryable: false,
      suggestedAction: 'Check request format and required fields'
    };
  }

  private logError(error: StandardError): void {
    const logMessage = this.config.logging.structured 
      ? JSON.stringify({ 
          level: 'ERROR', 
          module: 'frontend-api', 
          error: {
            id: error.id,
            code: error.code,
            category: error.category,
            severity: error.severity,
            message: error.message,
            details: error.details
          }, 
          timestamp: new Date().toISOString() 
        })
      : `${this.config.logging.prefix} [ERROR] ${error.code}: ${error.message}`;
    
    console.error(logMessage);
  }
}
