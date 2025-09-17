/**
 * Request Processor
 * Handles communication with OpenAI API, including request formatting and response processing
 * Based on design/ai-integration-module.md specifications
 */

import { AIConfig, AIResponse, OpenAIRequest, OpenAIResponse, OpenAIMessage, ProcessedImageData, createAIIntegrationError, DEFAULT_AI_CONFIG } from './types';
import { AuthHandler } from './auth-handler';
import { ImageHandler } from './image-handler';
import { Logger } from './logger';

export class RequestProcessor {
  private config: AIConfig;
  private authHandler: AuthHandler;
  private imageHandler: ImageHandler;
  private logger: Logger;

  /**
   * Initialize request processor with configuration and dependencies
   * @param config AI configuration
   */
  constructor(config: AIConfig) {
    this.config = { ...DEFAULT_AI_CONFIG, ...config };
    this.authHandler = new AuthHandler();
    this.imageHandler = new ImageHandler();
    this.logger = new Logger(this.config.logFilePath);

    // Initialize authentication
    this.authHandler.initialize(this.config);
  }

  /**
   * Send request to OpenAI API and get response
   * @param request Text content to send
   * @param imageFilePath Optional path to image file
   * @returns Promise resolving to AIResponse
   */
  async sendRequest(request: string, imageFilePath?: string): Promise<AIResponse> {
    let requestId: string = '';
    
    try {
      // Validate input
      if (!request || typeof request !== 'string') {
        throw createAIIntegrationError(
          'REQUEST_ERROR',
          'Request text is required and must be a non-empty string',
          { requestType: typeof request, requestLength: request?.length }
        );
      }

      // Prepare OpenAI request
      const openAIRequest = await this.prepareOpenAIRequest(request, imageFilePath);
      
      // Log request
      requestId = this.logger.logRequest(openAIRequest);

      // Send request to OpenAI
      const response = await this.callOpenAIAPI(openAIRequest);

      // Process and validate response
      const aiResponse = this.processOpenAIResponse(response);

      // Log successful response
      this.logger.logResponse(requestId, aiResponse);

      return aiResponse;

    } catch (error) {
      // Log error
      if (requestId) {
        this.logger.logError(requestId, error);
      }

      // Convert error to AIResponse format
      return this.convertErrorToResponse(error);
    }
  }

  /**
   * Prepare OpenAI API request from text and optional image
   * @param request Text content
   * @param imageFilePath Optional image file path
   * @returns Formatted OpenAI request
   */
  private async prepareOpenAIRequest(request: string, imageFilePath?: string): Promise<OpenAIRequest> {
    const messages: OpenAIMessage[] = [];

    if (imageFilePath) {
      // Process image and create message with both text and image
      const imageData = await this.imageHandler.processImageFile(imageFilePath);
      
      messages.push({
        role: 'user',
        content: [
          {
            type: 'text',
            text: request
          },
          {
            type: 'image_url',
            image_url: {
              url: imageData.dataUrl
            }
          }
        ]
      });
    } else {
      // Text-only message
      messages.push({
        role: 'user',
        content: request
      });
    }

    return {
      model: this.config.model,
      messages,
      max_tokens: 1000, // Reasonable default
      temperature: 0.7  // Balanced creativity/consistency
    };
  }

  /**
   * Call OpenAI API with prepared request
   * @param openAIRequest Formatted OpenAI request
   * @returns Raw OpenAI response
   */
  private async callOpenAIAPI(openAIRequest: OpenAIRequest): Promise<OpenAIResponse> {
    const url = `${this.config.baseUrl}/chat/completions`;
    const headers = this.authHandler.getAuthHeaders();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(openAIRequest)
      });

      // Handle authentication errors
      if (response.status === 401 || response.status === 403) {
        this.authHandler.handleAuthError(response);
      }

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        throw createAIIntegrationError(
          'RATE_LIMIT_EXCEEDED',
          'API rate limit exceeded',
          { 
            httpStatus: response.status,
            retryAfter,
            headers: Object.fromEntries(response.headers.entries())
          }
        );
      }

      // Handle other HTTP errors
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw createAIIntegrationError(
          'API_ERROR',
          `OpenAI API error: ${response.status} ${response.statusText}`,
          { 
            httpStatus: response.status,
            statusText: response.statusText,
            errorBody: errorText
          }
        );
      }

      // Parse JSON response
      const jsonResponse = await response.json();
      
      // Validate response structure
      if (!this.isValidOpenAIResponse(jsonResponse)) {
        throw createAIIntegrationError(
          'INVALID_RESPONSE',
          'OpenAI API returned invalid response format',
          { response: jsonResponse }
        );
      }

      return jsonResponse as OpenAIResponse;

    } catch (error) {
      // Re-throw our own errors
      if (error && typeof error === 'object' && 'moduleId' in error && error.moduleId === 'ai-integration') {
        throw error;
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw createAIIntegrationError(
          'NETWORK_ERROR',
          `Network error occurred: ${error.message}`,
          { originalError: error.message, url }
        );
      }

      // Handle JSON parsing errors
      if (error instanceof SyntaxError) {
        throw createAIIntegrationError(
          'INVALID_RESPONSE',
          `Failed to parse OpenAI response: ${error.message}`,
          { originalError: error.message }
        );
      }

      // Handle unexpected errors
      throw createAIIntegrationError(
        'API_ERROR',
        `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Process OpenAI response into AIResponse format
   * @param response Raw OpenAI response
   * @returns Processed AIResponse
   */
  private processOpenAIResponse(response: OpenAIResponse): AIResponse {
    try {
      // Extract the message content
      if (!response.choices || response.choices.length === 0) {
        throw createAIIntegrationError(
          'INVALID_RESPONSE',
          'OpenAI response contains no choices',
          { response }
        );
      }

      const firstChoice = response.choices[0];
      if (!firstChoice.message || !firstChoice.message.content) {
        throw createAIIntegrationError(
          'INVALID_RESPONSE',
          'OpenAI response choice contains no message content',
          { choice: firstChoice }
        );
      }

      return {
        status: 'success',
        data: {
          id: response.id,
          content: firstChoice.message.content,
          model: response.model,
          usage: response.usage,
          finishReason: firstChoice.finish_reason,
          created: response.created
        }
      };

    } catch (error) {
      // Re-throw our own errors
      if (error && typeof error === 'object' && 'moduleId' in error && error.moduleId === 'ai-integration') {
        throw error;
      }

      throw createAIIntegrationError(
        'INVALID_RESPONSE',
        `Failed to process OpenAI response: ${error instanceof Error ? error.message : String(error)}`,
        { response, originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Validate OpenAI response structure
   * @param response Response object to validate
   * @returns True if response has valid structure
   */
  private isValidOpenAIResponse(response: any): boolean {
    return (
      response &&
      typeof response === 'object' &&
      typeof response.id === 'string' &&
      typeof response.model === 'string' &&
      Array.isArray(response.choices) &&
      response.choices.length > 0 &&
      response.choices[0].message &&
      typeof response.choices[0].message.content === 'string'
    );
  }

  /**
   * Convert error to AIResponse format
   * @param error Error object
   * @returns AIResponse with error information
   */
  private convertErrorToResponse(error: any): AIResponse {
    if (error && typeof error === 'object' && 'moduleId' in error && error.moduleId === 'ai-integration') {
      // Our own standardized error
      return {
        status: 'error',
        error: error.message,
        errorCode: error.code
      };
    }

    // Fallback for unexpected errors
    return {
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      errorCode: 'UNKNOWN_ERROR'
    };
  }

  /**
   * Get current configuration
   * @returns Current AI configuration (with API key masked)
   */
  getConfig(): Omit<AIConfig, 'apiKey'> & { maskedApiKey: string | null } {
    return {
      model: this.config.model,
      baseUrl: this.config.baseUrl,
      logFilePath: this.config.logFilePath,
      maskedApiKey: this.authHandler.getMaskedApiKey()
    };
  }

  /**
   * Test connection to OpenAI API
   * @returns Promise resolving to connection test result
   */
  async testConnection(): Promise<AIResponse> {
    return this.sendRequest('Hello, this is a connection test. Please respond with "Connection successful."');
  }

  /**
   * Get logger instance for external access
   * @returns Logger instance
   */
  getLogger(): Logger {
    return this.logger;
  }
}
