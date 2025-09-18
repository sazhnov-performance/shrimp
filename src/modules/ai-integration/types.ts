/**
 * AI Integration Module Types
 * Type definitions for AI Integration functionality
 */

export interface AIConfig {
  apiKey: string;
  model: string; // 'gpt-4o-mini'
  baseUrl?: string; // Default: https://api.openai.com/v1
  logFilePath?: string; // Default: './ai-requests.log'
}

export interface AIResponse {
  status: 'success' | 'error';
  data?: any; // OpenAI response data (when successful)
  error?: string; // Error message (when failed)
  errorCode?: string;
}

export interface IAIIntegrationManager {
  // Send request to OpenAI and get response
  sendRequest(request: string, imageFilePath?: string): Promise<AIResponse>;
}

export type ErrorCode = 
  | 'AUTHENTICATION_ERROR'
  | 'REQUEST_ERROR'
  | 'API_ERROR'
  | 'NETWORK_ERROR'
  | 'IMAGE_ERROR'
  | 'INVALID_RESPONSE'
  | 'EMPTY_RESPONSE'
  | 'INVALID_JSON';
