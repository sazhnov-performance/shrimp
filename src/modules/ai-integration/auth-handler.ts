/**
 * Authentication Handler
 * Handles API key management for OpenAI API
 */

import { AIConfig } from './types';

export class AuthHandler {
  private apiKey: string;

  constructor(config: AIConfig) {
    this.apiKey = config.apiKey;
  }

  /**
   * Validate that API key exists
   */
  validateApiKey(): boolean {
    return !!this.apiKey && this.apiKey.trim().length > 0;
  }

  /**
   * Get authorization headers for OpenAI API requests
   */
  getAuthHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Get API key for direct access
   */
  getApiKey(): string {
    return this.apiKey;
  }
}
