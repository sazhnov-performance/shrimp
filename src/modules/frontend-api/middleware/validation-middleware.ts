/**
 * Validation Middleware Implementation
 * Handles request validation for API endpoints
 */

import { v4 as uuidv4 } from 'uuid';
import {
  StandardError,
  ErrorCategory,
  ErrorSeverity,
  ERROR_CODES,
  SessionStatus
} from '../../../../types/shared-types';
import {
  ValidationMiddleware,
  ValidationResult,
  ValidationError,
  ValidationWarning
} from '../types';

interface ValidationConfig {
  maxStepsPerRequest: number;
  maxStepLength: number;
  allowedStepFormats: string[];
}

export class ValidationMiddlewareImpl implements ValidationMiddleware {
  private config: ValidationConfig;

  constructor(config: ValidationConfig) {
    this.config = config;
  }

  /**
   * Express middleware function for request validation
   */
  validateRequest = async (request: any, response: any, next: any): Promise<void> => {
    try {
      // Skip validation for health check endpoints
      if (request.path.includes('/health')) {
        return next();
      }

      // Validate based on endpoint
      const validationResult = await this.validateEndpointRequest(request);
      
      if (!validationResult.isValid) {
        return this.sendValidationError(response, validationResult.errors);
      }

      // Add warnings to response headers if any
      if (validationResult.warnings && validationResult.warnings.length > 0) {
        response.setHeader('X-Validation-Warnings', JSON.stringify(validationResult.warnings));
      }

      next();
    } catch (error) {
      this.sendValidationError(response, [{
        line: 0,
        type: 'format',
        message: 'Request validation failed due to internal error',
        suggestion: 'Contact system administrator'
      }]);
    }
  };

  /**
   * Validates step processing requests
   */
  async validateStepsRequest(request: any): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check if request has a body
    if (!request.body) {
      errors.push({
        line: 0,
        type: 'format',
        message: 'Request body is required',
        suggestion: 'Provide a JSON request body'
      });
      return { isValid: false, errors, warnings };
    }

    const { steps, config } = request.body;

    // Validate steps array
    if (!steps || !Array.isArray(steps)) {
      errors.push({
        line: 0,
        type: 'format',
        message: 'Steps field is required and must be an array',
        suggestion: 'Provide steps as an array of strings'
      });
    } else {
      // Validate steps content
      const stepValidation = this.validateSteps(steps);
      errors.push(...stepValidation.errors);
      warnings.push(...stepValidation.warnings);
    }

    // Validate config if provided
    if (config) {
      const configValidation = this.validateProcessingConfig(config);
      errors.push(...configValidation.errors);
      warnings.push(...configValidation.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validates session ID format
   */
  validateSessionId(sessionId: string): boolean {
    if (!sessionId || typeof sessionId !== 'string') {
      return false;
    }

    // Session ID should be a UUID or similar identifier
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const alternativeRegex = /^[a-zA-Z0-9\-_]{8,64}$/;
    
    return uuidRegex.test(sessionId) || alternativeRegex.test(sessionId);
  }

  /**
   * Validates stream ID format
   */
  validateStreamId(streamId: string): boolean {
    return this.validateSessionId(streamId); // Same format as session ID
  }

  // ============================================================================
  // PRIVATE VALIDATION METHODS
  // ============================================================================

  private async validateEndpointRequest(request: any): Promise<ValidationResult> {
    const path = request.path;
    const method = request.method;

    // Route-specific validation
    if (path.includes('/automation/execute') && method === 'POST') {
      return await this.validateStepsRequest(request);
    }

    if (path.includes('/automation/validate') && method === 'POST') {
      return await this.validateStepsRequest(request);
    }

    if (path.includes('/automation/sessions/') && ['POST', 'GET'].includes(method)) {
      return this.validateSessionRequest(request);
    }

    if (path.includes('/streams/') && method === 'GET') {
      return this.validateStreamRequest(request);
    }

    // Default validation for other endpoints
    return this.validateGenericRequest(request);
  }

  private validateSteps(steps: string[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check step count
    if (steps.length === 0) {
      errors.push({
        line: 0,
        type: 'format',
        message: 'At least one step is required',
        suggestion: 'Add automation steps to execute'
      });
    }

    if (steps.length > this.config.maxStepsPerRequest) {
      errors.push({
        line: 0,
        type: 'format',
        message: `Too many steps. Maximum allowed: ${this.config.maxStepsPerRequest}`,
        suggestion: `Reduce number of steps to ${this.config.maxStepsPerRequest} or fewer`
      });
    }

    // Validate individual steps
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const lineNumber = i + 1;

      // Check step type
      if (typeof step !== 'string') {
        errors.push({
          line: lineNumber,
          type: 'format',
          message: 'Step must be a string',
          suggestion: 'Provide steps as strings'
        });
        continue;
      }

      // Check step length
      if (step.length === 0) {
        errors.push({
          line: lineNumber,
          type: 'format',
          message: 'Empty step not allowed',
          suggestion: 'Remove empty steps or add meaningful content'
        });
        continue;
      }

      if (step.length > this.config.maxStepLength) {
        errors.push({
          line: lineNumber,
          type: 'format',
          message: `Step too long. Maximum length: ${this.config.maxStepLength} characters`,
          suggestion: 'Break down complex steps into smaller ones'
        });
      }

      // Check for potentially dangerous content
      const securityValidation = this.validateStepSecurity(step, lineNumber);
      errors.push(...securityValidation.errors);
      warnings.push(...securityValidation.warnings);

      // Performance and best practice checks
      const performanceValidation = this.validateStepPerformance(step, lineNumber);
      warnings.push(...performanceValidation.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private validateProcessingConfig(config: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate required fields
    if (typeof config.maxExecutionTime !== 'number' || config.maxExecutionTime <= 0) {
      errors.push({
        line: 0,
        type: 'format',
        message: 'maxExecutionTime must be a positive number',
        suggestion: 'Set maxExecutionTime to a positive number of milliseconds'
      });
    }

    if (typeof config.enableStreaming !== 'boolean') {
      warnings.push({
        line: 0,
        type: 'format',
        message: 'enableStreaming should be a boolean',
        suggestion: 'Set enableStreaming to true or false'
      });
    }

    if (typeof config.maxRetries !== 'undefined') {
      if (typeof config.maxRetries !== 'number' || config.maxRetries < 0) {
        errors.push({
          line: 0,
          type: 'format',
          message: 'maxRetries must be a non-negative number',
          suggestion: 'Set maxRetries to 0 or positive number'
        });
      }
    }

    // Validate AI config if provided
    if (config.aiConfig) {
      const aiConfigValidation = this.validateAIConfig(config.aiConfig);
      errors.push(...aiConfigValidation.errors);
      warnings.push(...aiConfigValidation.warnings);
    }

    // Validate executor config if provided
    if (config.executorConfig) {
      const execConfigValidation = this.validateExecutorConfig(config.executorConfig);
      errors.push(...execConfigValidation.errors);
      warnings.push(...execConfigValidation.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private validateAIConfig(aiConfig: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!aiConfig.connectionId || typeof aiConfig.connectionId !== 'string') {
      errors.push({
        line: 0,
        type: 'format',
        message: 'AI connection ID is required and must be a string',
        suggestion: 'Provide a valid AI connection ID'
      });
    }

    if (aiConfig.temperature !== undefined) {
      if (typeof aiConfig.temperature !== 'number' || aiConfig.temperature < 0 || aiConfig.temperature > 2) {
        errors.push({
          line: 0,
          type: 'format',
          message: 'AI temperature must be a number between 0 and 2',
          suggestion: 'Set temperature to a value between 0 and 2'
        });
      }
    }

    if (aiConfig.maxTokens !== undefined) {
      if (typeof aiConfig.maxTokens !== 'number' || aiConfig.maxTokens <= 0) {
        errors.push({
          line: 0,
          type: 'format',
          message: 'AI maxTokens must be a positive number',
          suggestion: 'Set maxTokens to a positive number'
        });
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateExecutorConfig(executorConfig: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const validBrowserTypes = ['chromium', 'firefox', 'webkit'];
    if (executorConfig.browserType && !validBrowserTypes.includes(executorConfig.browserType)) {
      errors.push({
        line: 0,
        type: 'format',
        message: `Invalid browser type: ${executorConfig.browserType}`,
        suggestion: `Use one of: ${validBrowserTypes.join(', ')}`
      });
    }

    if (executorConfig.timeoutMs !== undefined) {
      if (typeof executorConfig.timeoutMs !== 'number' || executorConfig.timeoutMs <= 0) {
        errors.push({
          line: 0,
          type: 'format',
          message: 'Executor timeout must be a positive number',
          suggestion: 'Set timeoutMs to a positive number of milliseconds'
        });
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateSessionRequest(request: any): ValidationResult {
    const errors: ValidationError[] = [];
    const sessionId = request.params?.sessionId;

    if (sessionId && !this.validateSessionId(sessionId)) {
      errors.push({
        line: 0,
        type: 'format',
        message: 'Invalid session ID format',
        suggestion: 'Provide a valid session ID (UUID format)'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  private validateStreamRequest(request: any): ValidationResult {
    const errors: ValidationError[] = [];
    const streamId = request.params?.streamId;

    if (streamId && !this.validateStreamId(streamId)) {
      errors.push({
        line: 0,
        type: 'format',
        message: 'Invalid stream ID format',
        suggestion: 'Provide a valid stream ID (UUID format)'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  private validateGenericRequest(request: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check content-type for POST/PUT requests
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      const contentType = request.headers['content-type'];
      if (!contentType || !contentType.includes('application/json')) {
        warnings.push({
          line: 0,
          type: 'format',
          message: 'Content-Type should be application/json',
          suggestion: 'Set Content-Type header to application/json'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private validateStepSecurity(step: string, lineNumber: number): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check for script injection
    if (step.includes('<script>') || step.includes('javascript:') || step.includes('eval(')) {
      errors.push({
        line: lineNumber,
        type: 'syntax',
        message: 'Potentially dangerous script content detected',
        suggestion: 'Remove script tags or javascript: URLs'
      });
    }

    // Check for potential credential exposure
    const credentialPatterns = [
      /password\s*[:=]\s*['"]\w+['"]/i,
      /api[_-]?key\s*[:=]\s*['"]\w+['"]/i,
      /secret\s*[:=]\s*['"]\w+['"]/i,
      /token\s*[:=]\s*['"]\w+['"]/i
    ];

    for (const pattern of credentialPatterns) {
      if (pattern.test(step)) {
        warnings.push({
          line: lineNumber,
          type: 'best_practice',
          message: 'Potential credential detected in step',
          suggestion: 'Use secure credential management instead of hardcoded values'
        });
        break;
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateStepPerformance(step: string, lineNumber: number): ValidationResult {
    const warnings: ValidationWarning[] = [];

    // Check for long wait times
    const waitPattern = /wait.*?(\d+)\s*(seconds?|minutes?|hours?)/i;
    const waitMatch = step.match(waitPattern);
    if (waitMatch) {
      const time = parseInt(waitMatch[1]);
      const unit = waitMatch[2].toLowerCase();
      
      let waitMs = time * 1000; // Default to seconds
      if (unit.startsWith('minute')) waitMs *= 60;
      if (unit.startsWith('hour')) waitMs *= 3600;
      
      if (waitMs > 30000) { // More than 30 seconds
        warnings.push({
          line: lineNumber,
          type: 'performance',
          message: 'Long wait time detected',
          suggestion: 'Consider using shorter wait times or element-based waiting'
        });
      }
    }

    // Check for overly complex selectors
    const selectorCount = (step.match(/[#.[\]]/g) || []).length;
    if (selectorCount > 5) {
      warnings.push({
        line: lineNumber,
        type: 'performance',
        message: 'Complex selector detected',
        suggestion: 'Use simpler, more specific selectors'
      });
    }

    return { isValid: true, errors: [], warnings };
  }

  private sendValidationError(response: any, errors: ValidationError[]): void {
    const error: StandardError = {
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
      suggestedAction: 'Fix validation errors and retry request'
    };

    response.status(400).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        retryable: error.retryable,
        timestamp: error.timestamp.toISOString()
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: uuidv4(),
        version: '1.0.0',
        processingTimeMs: 0
      }
    });
  }
}
