/**
 * Step Processor API Implementation
 * Handles step execution and validation requests
 */

import { v4 as uuidv4 } from 'uuid';
import {
  StepProcessingRequest,
  ProcessingConfig,
  APIResponse,
  SYSTEM_VERSION
} from '../../../../types/shared-types';
import {
  StepProcessorAPI,
  ExecuteStepsRequest,
  ExecuteStepsResponse,
  ValidateStepsRequest,
  ValidateStepsResponse,
  ValidationError,
  ValidationWarning,
  FrontendAPIConfig
} from '../types';
import { FrontendAPIErrorHandler } from '../error-handler';

export class StepProcessorAPIImpl implements StepProcessorAPI {
  private config: FrontendAPIConfig;
  private errorHandler: FrontendAPIErrorHandler;
  private stepProcessor?: any; // IStepProcessor interface
  private defaultAIConnectionId: string;

  constructor(config: FrontendAPIConfig, errorHandler: FrontendAPIErrorHandler) {
    this.config = config;
    this.errorHandler = errorHandler;
    this.defaultAIConnectionId = 'default-ai-connection';
  }

  /**
   * Initialize with step processor integration
   */
  async initialize?(stepProcessor: any): Promise<void> {
    this.stepProcessor = stepProcessor;
  }

  /**
   * Executes automation steps
   */
  async executeSteps(request: ExecuteStepsRequest): Promise<ExecuteStepsResponse> {
    const startTime = Date.now();
    const requestId = uuidv4();

    try {
      // 1. Validate request format
      const validationResult = await this.validateStepsRequest(request);
      if (!validationResult.isValid) {
        const errorResponse = this.errorHandler.createValidationErrorResponse(
          validationResult.errors.map(e => e.message)
        );
        throw new Error('Request validation failed');
      }

      // 2. Ensure config is provided or use defaults
      const processingConfig = request.config || this.getDefaultProcessingConfig();

      // 3. Create processing request with validated config
      const processingRequest: StepProcessingRequest = {
        steps: request.steps,
        config: processingConfig,
        metadata: {
          ...request.metadata,
          requestId,
          timestamp: new Date().toISOString(),
          source: 'frontend-api'
        }
      };

      // 4. Process steps via Step Processor
      if (!this.stepProcessor) {
        throw new Error('Step processor not initialized');
      }

      const result = await this.stepProcessor.processSteps(processingRequest);

      // 5. Build standardized response
      const response: ExecuteStepsResponse = {
        success: true,
        data: result,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId,
          version: `${SYSTEM_VERSION.major}.${SYSTEM_VERSION.minor}.${SYSTEM_VERSION.patch}`,
          processingTimeMs: Date.now() - startTime,
          streamUrl: result.streamId ? `/api/stream/ws/${result.streamId}` : undefined
        }
      };

      return response;

    } catch (error) {
      // Use error handler to create standardized error response
      await this.errorHandler.handleStandardError(error, {
        status: (code: number) => ({ json: (data: any) => { throw { statusCode: code, data }; } })
      });
      throw error; // This should not be reached due to error handler
    }
  }

  /**
   * Validates automation steps
   */
  async validateSteps(request: ValidateStepsRequest): Promise<ValidateStepsResponse> {
    try {
      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];

      // 1. Basic validation
      if (!request.steps || !Array.isArray(request.steps)) {
        errors.push({
          line: 0,
          type: 'format',
          message: 'Steps must be provided as an array',
          suggestion: 'Provide steps as an array of strings'
        });
      }

      if (request.steps.length === 0) {
        errors.push({
          line: 0,
          type: 'format',
          message: 'At least one step is required',
          suggestion: 'Add automation steps to execute'
        });
      }

      if (request.steps.length > this.config.validation.maxStepsPerRequest) {
        errors.push({
          line: 0,
          type: 'format',
          message: `Too many steps. Maximum allowed: ${this.config.validation.maxStepsPerRequest}`,
          suggestion: `Reduce number of steps to ${this.config.validation.maxStepsPerRequest} or fewer`
        });
      }

      // 2. Validate individual steps
      for (let i = 0; i < request.steps.length; i++) {
        const step = request.steps[i];
        const lineNumber = i + 1;

        // Check step length
        if (step.length > this.config.validation.maxStepLength) {
          errors.push({
            line: lineNumber,
            type: 'format',
            message: `Step too long. Maximum length: ${this.config.validation.maxStepLength} characters`,
            suggestion: 'Break down complex steps into smaller ones'
          });
        }

        // Check for empty steps
        if (!step.trim()) {
          errors.push({
            line: lineNumber,
            type: 'format',
            message: 'Empty step not allowed',
            suggestion: 'Remove empty steps or add meaningful content'
          });
        }

        // Syntax validation
        const syntaxErrors = this.validateStepSyntax(step, lineNumber);
        errors.push(...syntaxErrors);

        // Performance warnings
        const performanceWarnings = this.checkStepPerformance(step, lineNumber);
        warnings.push(...performanceWarnings);

        // Best practice warnings
        const bestPracticeWarnings = this.checkStepBestPractices(step, lineNumber);
        warnings.push(...bestPracticeWarnings);
      }

      // 3. Estimate execution duration
      const estimatedDuration = this.estimateExecutionDuration(request.steps);

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        stepCount: request.steps.length,
        estimatedDuration
      };

    } catch (error) {
      // Return validation response with error
      return {
        isValid: false,
        errors: [{
          line: 0,
          type: 'format',
          message: 'Validation failed due to internal error',
          suggestion: 'Contact system administrator'
        }],
        warnings: [],
        stepCount: request.steps?.length || 0
      };
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private async validateStepsRequest(request: ExecuteStepsRequest): Promise<{ isValid: boolean; errors: ValidationError[] }> {
    const errors: ValidationError[] = [];

    // Basic structure validation
    if (!request.steps || !Array.isArray(request.steps)) {
      errors.push({
        line: 0,
        type: 'format',
        message: 'Steps field is required and must be an array',
        suggestion: 'Provide steps as an array of strings'
      });
    }

    if (request.steps && request.steps.length === 0) {
      errors.push({
        line: 0,
        type: 'format',
        message: 'At least one step is required',
        suggestion: 'Add automation steps to execute'
      });
    }

    // Config validation (if provided)
    if (request.config) {
      const configErrors = this.validateProcessingConfig(request.config);
      errors.push(...configErrors);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private validateProcessingConfig(config: ProcessingConfig): ValidationError[] {
    const errors: ValidationError[] = [];

    if (config.maxExecutionTime <= 0) {
      errors.push({
        line: 0,
        type: 'format',
        message: 'maxExecutionTime must be positive',
        suggestion: 'Set maxExecutionTime to a positive number of milliseconds'
      });
    }

    if (config.maxRetries < 0) {
      errors.push({
        line: 0,
        type: 'format',
        message: 'maxRetries cannot be negative',
        suggestion: 'Set maxRetries to 0 or positive number'
      });
    }

    if (config.aiConfig) {
      if (!config.aiConfig.connectionId) {
        errors.push({
          line: 0,
          type: 'format',
          message: 'AI connection ID is required',
          suggestion: 'Provide a valid AI connection ID'
        });
      }

      if (config.aiConfig.temperature < 0 || config.aiConfig.temperature > 2) {
        errors.push({
          line: 0,
          type: 'format',
          message: 'AI temperature must be between 0 and 2',
          suggestion: 'Set temperature to a value between 0 and 2'
        });
      }
    }

    return errors;
  }

  private validateStepSyntax(step: string, lineNumber: number): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check for suspicious patterns that might indicate syntax issues
    if (step.includes('<script>') || step.includes('javascript:')) {
      errors.push({
        line: lineNumber,
        type: 'syntax',
        message: 'Script injection detected',
        suggestion: 'Remove script tags or javascript: URLs'
      });
    }

    // Check for malformed selectors if step appears to be using CSS selectors
    if (step.includes('#') || step.includes('.') || step.includes('[')) {
      const selectorMatch = step.match(/(['"])(.*?)\1/);
      if (selectorMatch) {
        const selector = selectorMatch[2];
        if (!this.isValidCSSSelector(selector)) {
          errors.push({
            line: lineNumber,
            type: 'syntax',
            message: 'Invalid CSS selector detected',
            suggestion: 'Use valid CSS selector syntax'
          });
        }
      }
    }

    return errors;
  }

  private checkStepPerformance(step: string, lineNumber: number): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    // Check for potentially slow operations
    if (step.toLowerCase().includes('wait') && step.match(/\d+\s*(?:seconds?|minutes?)/)) {
      warnings.push({
        line: lineNumber,
        type: 'performance',
        message: 'Long wait time detected',
        suggestion: 'Consider using shorter wait times or element-based waiting'
      });
    }

    // Check for complex selectors
    if ((step.match(/[#.[\]]/g) || []).length > 5) {
      warnings.push({
        line: lineNumber,
        type: 'performance',
        message: 'Complex selector detected',
        suggestion: 'Use simpler, more specific selectors'
      });
    }

    return warnings;
  }

  private checkStepBestPractices(step: string, lineNumber: number): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    // Check for hardcoded URLs
    if (step.includes('http://') || step.includes('https://')) {
      warnings.push({
        line: lineNumber,
        type: 'best_practice',
        message: 'Hardcoded URL detected',
        suggestion: 'Consider using environment variables for URLs'
      });
    }

    // Check for hardcoded credentials
    if (step.toLowerCase().includes('password') || step.toLowerCase().includes('secret')) {
      warnings.push({
        line: lineNumber,
        type: 'best_practice',
        message: 'Potential credential detected',
        suggestion: 'Use secure credential management instead of hardcoded values'
      });
    }

    return warnings;
  }

  private isValidCSSSelector(selector: string): boolean {
    try {
      // Basic validation - try to create a dummy element and use querySelector
      const div = document?.createElement?.('div');
      if (div) {
        div.querySelector(selector);
        return true;
      }
      
      // Fallback: basic regex check for common selector patterns
      const selectorRegex = /^[a-zA-Z0-9\-_#.\[\]":(),\s>+~*=^$|]+$/;
      return selectorRegex.test(selector);
    } catch {
      return false;
    }
  }

  private estimateExecutionDuration(steps: string[]): number {
    // Simple heuristic: 5 seconds per step + additional time for complex operations
    let duration = steps.length * 5000; // 5 seconds per step

    for (const step of steps) {
      const lowerStep = step.toLowerCase();
      
      // Add extra time for operations that typically take longer
      if (lowerStep.includes('navigate') || lowerStep.includes('open')) {
        duration += 3000; // Extra 3 seconds for page loads
      }
      
      if (lowerStep.includes('wait')) {
        // Try to extract wait time from step
        const waitMatch = step.match(/(\d+)\s*(?:seconds?|s)/i);
        if (waitMatch) {
          duration += parseInt(waitMatch[1]) * 1000;
        } else {
          duration += 2000; // Default 2 seconds for generic waits
        }
      }
      
      if (lowerStep.includes('upload') || lowerStep.includes('download')) {
        duration += 5000; // Extra 5 seconds for file operations
      }
    }

    return Math.min(duration, this.config.timeouts.workflowTimeoutMs);
  }

  private getDefaultProcessingConfig(): ProcessingConfig {
    return {
      maxExecutionTime: this.config.timeouts.workflowTimeoutMs,
      enableStreaming: true,
      enableReflection: true,
      retryOnFailure: false,
      maxRetries: this.config.stepProcessor.retryAttempts,
      parallelExecution: false,
      aiConfig: {
        connectionId: this.defaultAIConnectionId,
        model: 'gpt-4',
        temperature: 0.1,
        maxTokens: 4000,
        timeoutMs: this.config.timeouts.requestTimeoutMs
      },
      executorConfig: {
        browserType: 'chromium',
        headless: true,
        timeoutMs: this.config.timeouts.requestTimeoutMs,
        screenshotsEnabled: true
      },
      streamConfig: {
        bufferSize: 1000,
        maxHistorySize: 10000,
        compressionEnabled: true
      }
    };
  }
}
