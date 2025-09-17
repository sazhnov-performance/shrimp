/**
 * AI Integration Module Types
 * Defines interfaces and types for AI integration functionality
 * Based on design/ai-integration-module.md specifications
 */

import { StandardError, ErrorCategory, ErrorSeverity } from '../../../types/shared-types';

// Core interfaces from design document
export interface IAIIntegrationManager {
  /**
   * Send request to OpenAI and get response
   * @param request Text content to send to OpenAI
   * @param imageFilePath Optional path to image file to include in request
   * @returns Promise resolving to AIResponse with status and data
   */
  sendRequest(request: string, imageFilePath?: string): Promise<AIResponse>;
}

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

// Error codes specific to AI Integration module
export const AI_INTEGRATION_ERROR_CODES = {
  AUTHENTICATION_ERROR: 'AI002',
  REQUEST_ERROR: 'AI001',
  API_ERROR: 'AI005',
  NETWORK_ERROR: 'AI001',
  IMAGE_ERROR: 'AI006',
  CONNECTION_FAILED: 'AI001',
  RATE_LIMIT_EXCEEDED: 'AI003',
  INVALID_RESPONSE: 'AI004',
  MODEL_ERROR: 'AI005'
} as const;

// Error types for the module
export type AIIntegrationErrorCode = keyof typeof AI_INTEGRATION_ERROR_CODES;

// Utility function to create standardized errors
export function createAIIntegrationError(
  code: AIIntegrationErrorCode,
  message: string,
  details?: Record<string, any>
): StandardError {
  return {
    id: `ai-integration-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    category: ErrorCategory.INTEGRATION,
    severity: ErrorSeverity.HIGH,
    code: AI_INTEGRATION_ERROR_CODES[code],
    message,
    details,
    timestamp: new Date(),
    moduleId: 'ai-integration',
    recoverable: code !== 'AUTHENTICATION_ERROR',
    retryable: code === 'NETWORK_ERROR' || code === 'CONNECTION_FAILED' || code === 'RATE_LIMIT_EXCEEDED',
    suggestedAction: getSuggestedAction(code)
  };
}

function getSuggestedAction(code: AIIntegrationErrorCode): string {
  switch (code) {
    case 'AUTHENTICATION_ERROR':
      return 'Verify API key is valid and has necessary permissions';
    case 'RATE_LIMIT_EXCEEDED':
      return 'Wait before retrying or check rate limit settings';
    case 'NETWORK_ERROR':
    case 'CONNECTION_FAILED':
      return 'Check network connectivity and try again';
    case 'IMAGE_ERROR':
      return 'Verify image file exists and is in supported format (png, jpg, jpeg, webp, gif)';
    case 'MODEL_ERROR':
      return 'Check if the specified model is available and accessible';
    case 'INVALID_RESPONSE':
      return 'Report this issue - the AI service returned an unexpected response format';
    default:
      return 'Review error details and retry if appropriate';
  }
}

// Internal types for request processing
export interface ProcessedImageData {
  dataUrl: string;
  format: string;
  size: number;
}

export interface LogEntry {
  timestamp: string;
  type: 'request' | 'response';
  data: any;
}

// OpenAI API specific types
export interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
      url: string;
    };
  }>;
}

export interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  temperature?: number;
}

export interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Configuration defaults
export const DEFAULT_AI_CONFIG: Partial<AIConfig> = {
  model: 'gpt-4o-mini',
  baseUrl: 'https://api.openai.com/v1',
  logFilePath: './ai-requests.log'
};

// Supported image formats
export const SUPPORTED_IMAGE_FORMATS = ['png', 'jpg', 'jpeg', 'webp', 'gif'] as const;
export type SupportedImageFormat = typeof SUPPORTED_IMAGE_FORMATS[number];
