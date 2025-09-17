/**
 * AI Integration Module - Main Interface
 * Provides the main IAIIntegrationManager interface for sending requests to OpenAI API
 * Based on design/ai-integration-module.md specifications
 */

import { AIConfig, AIResponse, IAIIntegrationManager, createAIIntegrationError, DEFAULT_AI_CONFIG } from './types';
import { RequestProcessor } from './request-processor';

/**
 * Main AI Integration Manager class implementing IAIIntegrationManager interface
 */
export class AIIntegrationManager implements IAIIntegrationManager {
  private requestProcessor: RequestProcessor;
  private isInitialized: boolean = false;

  /**
   * Create new AI Integration Manager instance
   * @param config AI configuration with API key and other settings
   */
  constructor(config: AIConfig) {
    if (!config) {
      throw createAIIntegrationError(
        'REQUEST_ERROR',
        'Configuration is required to initialize AI Integration Manager',
        { providedConfig: config }
      );
    }

    try {
      this.requestProcessor = new RequestProcessor(config);
      this.isInitialized = true;
    } catch (error) {
      throw createAIIntegrationError(
        'REQUEST_ERROR',
        `Failed to initialize AI Integration Manager: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Send request to OpenAI and get response
   * @param request Text content to send to OpenAI
   * @param imageFilePath Optional path to image file to include in request
   * @returns Promise resolving to AIResponse with status and data
   */
  async sendRequest(request: string, imageFilePath?: string): Promise<AIResponse> {
    if (!this.isInitialized) {
      return {
        status: 'error',
        error: 'AI Integration Manager not properly initialized',
        errorCode: 'REQUEST_ERROR'
      };
    }

    try {
      return await this.requestProcessor.sendRequest(request, imageFilePath);
    } catch (error) {
      // This should not happen as RequestProcessor handles all errors internally,
      // but we provide a safety net
      return {
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        errorCode: 'UNKNOWN_ERROR'
      };
    }
  }

  /**
   * Test connection to OpenAI API
   * @returns Promise resolving to connection test result
   */
  async testConnection(): Promise<AIResponse> {
    if (!this.isInitialized) {
      return {
        status: 'error',
        error: 'AI Integration Manager not properly initialized',
        errorCode: 'REQUEST_ERROR'
      };
    }

    return this.requestProcessor.testConnection();
  }

  /**
   * Get current configuration (with API key masked for security)
   * @returns Current configuration object
   */
  getConfig(): Omit<AIConfig, 'apiKey'> & { maskedApiKey: string | null } {
    if (!this.isInitialized) {
      return {
        model: 'unknown',
        baseUrl: 'unknown',
        logFilePath: 'unknown',
        maskedApiKey: null
      };
    }

    return this.requestProcessor.getConfig();
  }

  /**
   * Check if the manager is properly initialized
   * @returns True if initialized and ready for use
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get log file path for external monitoring
   * @returns Path to the log file
   */
  getLogFilePath(): string {
    if (!this.isInitialized) {
      return '';
    }

    return this.requestProcessor.getLogger().getLogFilePath();
  }

  /**
   * Check if log file is writable
   * @returns True if log file can be written to
   */
  isLogFileWritable(): boolean {
    if (!this.isInitialized) {
      return false;
    }

    return this.requestProcessor.getLogger().isLogFileWritable();
  }

  /**
   * Get current log file size
   * @returns Log file size in bytes
   */
  getLogFileSize(): number {
    if (!this.isInitialized) {
      return 0;
    }

    return this.requestProcessor.getLogger().getLogFileSize();
  }

  /**
   * Rotate log file if it gets too large
   * @param maxSizeBytes Maximum file size before rotation (default: 100MB)
   */
  rotateLogFileIfNeeded(maxSizeBytes?: number): void {
    if (!this.isInitialized) {
      return;
    }

    this.requestProcessor.getLogger().rotateLogFileIfNeeded(maxSizeBytes);
  }
}

/**
 * Factory function to create AIIntegrationManager with default configuration
 * @param apiKey OpenAI API key
 * @param overrides Optional configuration overrides
 * @returns New AIIntegrationManager instance
 */
export function createAIIntegrationManager(
  apiKey: string,
  overrides?: Partial<Omit<AIConfig, 'apiKey'>>
): AIIntegrationManager {
  const config: AIConfig = {
    ...DEFAULT_AI_CONFIG,
    ...overrides,
    apiKey
  };

  return new AIIntegrationManager(config);
}

/**
 * Utility function to validate AI configuration
 * @param config Configuration to validate
 * @returns Validation result with any errors
 */
export function validateAIConfig(config: Partial<AIConfig>): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.apiKey || typeof config.apiKey !== 'string') {
    errors.push('API key is required and must be a non-empty string');
  }

  if (config.model && typeof config.model !== 'string') {
    errors.push('Model must be a string');
  }

  if (config.baseUrl && typeof config.baseUrl !== 'string') {
    errors.push('Base URL must be a string');
  }

  if (config.logFilePath && typeof config.logFilePath !== 'string') {
    errors.push('Log file path must be a string');
  }

  // Validate API key format if provided
  if (config.apiKey && typeof config.apiKey === 'string') {
    const openAIPattern = /^sk-[A-Za-z0-9]{48}$/;
    const generalPattern = /^[A-Za-z0-9_-]{20,}$/;
    
    if (!openAIPattern.test(config.apiKey) && !generalPattern.test(config.apiKey)) {
      errors.push('API key format appears invalid');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Re-export types and interfaces for external use
export * from './types';

// Re-export individual components for advanced usage
export { RequestProcessor } from './request-processor';
export { AuthHandler } from './auth-handler';
export { ImageHandler } from './image-handler';
export { Logger } from './logger';
