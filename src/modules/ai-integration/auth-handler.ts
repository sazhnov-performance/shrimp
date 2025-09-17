/**
 * Authentication Handler
 * Manages API key storage and authentication for OpenAI API requests
 * Based on design/ai-integration-module.md specifications
 */

import { AIConfig, createAIIntegrationError } from './types';

export class AuthHandler {
  private apiKey: string | null = null;

  /**
   * Initialize authentication with API key from configuration
   * @param config AI configuration containing API key
   * @throws Error if API key is missing or invalid
   */
  initialize(config: AIConfig): void {
    if (!config.apiKey || typeof config.apiKey !== 'string') {
      throw createAIIntegrationError(
        'AUTHENTICATION_ERROR',
        'API key is required and must be a non-empty string',
        { providedApiKey: typeof config.apiKey }
      );
    }

    // Basic API key format validation for OpenAI keys
    if (!this.isValidApiKeyFormat(config.apiKey)) {
      throw createAIIntegrationError(
        'AUTHENTICATION_ERROR',
        'API key format is invalid. Expected format: sk-...',
        { apiKeyPrefix: config.apiKey.substring(0, 3) }
      );
    }

    this.apiKey = config.apiKey;
  }

  /**
   * Get authentication headers for API requests
   * @returns Headers object with authorization
   * @throws Error if API key is not initialized
   */
  getAuthHeaders(): Record<string, string> {
    if (!this.apiKey) {
      throw createAIIntegrationError(
        'AUTHENTICATION_ERROR',
        'API key not initialized. Call initialize() first',
        { initialized: false }
      );
    }

    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Check if API key is initialized and ready for use
   * @returns True if API key is set, false otherwise
   */
  isInitialized(): boolean {
    return this.apiKey !== null;
  }

  /**
   * Clear stored API key (for cleanup or re-initialization)
   */
  clear(): void {
    this.apiKey = null;
  }

  /**
   * Validate API key format (basic format check)
   * @param apiKey The API key to validate
   * @returns True if format appears valid
   */
  private isValidApiKeyFormat(apiKey: string): boolean {
    // OpenAI API keys typically start with 'sk-' and are 51 characters long
    const openAIPattern = /^sk-[A-Za-z0-9]{48}$/;
    
    // More lenient check for other potential formats or dev keys
    const generalPattern = /^[A-Za-z0-9_-]{20,}$/;
    
    return openAIPattern.test(apiKey) || generalPattern.test(apiKey);
  }

  /**
   * Get masked API key for logging purposes (shows only first few characters)
   * @returns Masked API key string or null if not initialized
   */
  getMaskedApiKey(): string | null {
    if (!this.apiKey) {
      return null;
    }

    if (this.apiKey.length <= 8) {
      return '***';
    }

    return `${this.apiKey.substring(0, 4)}${'*'.repeat(this.apiKey.length - 8)}${this.apiKey.substring(this.apiKey.length - 4)}`;
  }

  /**
   * Handle authentication errors from API responses
   * @param response The HTTP response object
   * @throws Appropriate authentication error
   */
  handleAuthError(response: { status: number; statusText: string }): never {
    if (response.status === 401) {
      throw createAIIntegrationError(
        'AUTHENTICATION_ERROR',
        'API key is invalid or expired',
        { 
          httpStatus: response.status,
          statusText: response.statusText,
          maskedApiKey: this.getMaskedApiKey()
        }
      );
    }

    if (response.status === 403) {
      throw createAIIntegrationError(
        'AUTHENTICATION_ERROR',
        'API key does not have permission to access this resource',
        { 
          httpStatus: response.status,
          statusText: response.statusText,
          maskedApiKey: this.getMaskedApiKey()
        }
      );
    }

    throw createAIIntegrationError(
      'API_ERROR',
      `Authentication-related error: ${response.statusText}`,
      { 
        httpStatus: response.status,
        statusText: response.statusText
      }
    );
  }
}
