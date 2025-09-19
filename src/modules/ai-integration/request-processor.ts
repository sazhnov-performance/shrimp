/**
 * Request Processor
 * Request/response handling for OpenAI API
 */

import { AIConfig, AIResponse, ErrorCode } from './types';
import { AuthHandler } from './auth-handler';
import { ImageHandler } from './image-handler';
import { Logger } from './logger';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
      url: string;
    };
  }>;
}

interface OpenAIRequestPayload {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  temperature?: number;
}

export class RequestProcessor {
  private config: AIConfig;
  private authHandler: AuthHandler;
  private imageHandler: ImageHandler;
  private logger: Logger;

  constructor(config: AIConfig) {
    const defaultConfig: Partial<AIConfig> = {
      model: 'gpt-4o-mini',
      baseUrl: 'https://api.openai.com/v1',
      logFilePath: './ai-requests.log'
    };
    
    this.config = {
      ...defaultConfig,
      ...config
    } as AIConfig;
    this.authHandler = new AuthHandler(this.config);
    this.imageHandler = new ImageHandler();
    this.logger = new Logger(this.config.logFilePath);
  }

  /**
   * Process request and send to OpenAI API
   */
  async processRequest(request: string, imageFilePath?: string): Promise<AIResponse> {
    try {
      // Validate API key
      if (!this.authHandler.validateApiKey()) {
        return this.createErrorResponse('AUTHENTICATION_ERROR', 'Invalid API key');
      }

      // Prepare request payload
      const requestPayload = await this.prepareRequestPayload(request, imageFilePath);
      
      // Log request
      this.logger.logRequest(requestPayload as unknown as Record<string, unknown>);

      // Send request to OpenAI API
      const response = await this.sendToOpenAI(requestPayload);
      
      // Log response
      this.logger.logResponse(response);

      // Parse and return response
      return this.parseResponse(response);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('File not found') || errorMessage.includes('Image processing failed')) {
        return this.createErrorResponse('IMAGE_ERROR', errorMessage);
      }
      
      if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('connection')) {
        return this.createErrorResponse('NETWORK_ERROR', errorMessage);
      }
      
      return this.createErrorResponse('REQUEST_ERROR', errorMessage);
    }
  }

  /**
   * Prepare request payload for OpenAI API
   */
  private async prepareRequestPayload(request: string, imageFilePath?: string): Promise<OpenAIRequestPayload> {
    const messages: OpenAIMessage[] = [];

    // Try to parse the request as system/user messages if it's JSON
    let systemContent: string | undefined;
    let userContent: string = request;

    try {
      const parsedRequest = JSON.parse(request);
      if (parsedRequest.system && parsedRequest.user) {
        systemContent = parsedRequest.system;
        userContent = parsedRequest.user;
      }
    } catch {
      // Not JSON, treat as single user message (backward compatibility)
    }

    // Add system message if available
    if (systemContent) {
      messages.push({
        role: 'system',
        content: systemContent
      });
    }

    if (imageFilePath) {
      // Process image file
      const imageDataUrl = await this.imageHandler.processImageFile(imageFilePath);
      
      messages.push({
        role: 'user',
        content: [
          {
            type: 'text',
            text: userContent
          },
          {
            type: 'image_url',
            image_url: {
              url: imageDataUrl
            }
          }
        ]
      });
    } else {
      // Text-only request
      messages.push({
        role: 'user',
        content: userContent
      });
    }

    return {
      model: this.config.model,
      messages: messages,
      max_tokens: parseInt(process.env.OPENAI_DEFAULT_MAX_TOKENS || '1000', 10),
      temperature: parseFloat(process.env.OPENAI_DEFAULT_TEMPERATURE || '0.7')
    };
  }

  /**
   * Send request to OpenAI API
   */
  private async sendToOpenAI(payload: OpenAIRequestPayload): Promise<Record<string, unknown>> {
    const url = `${this.config.baseUrl}/chat/completions`;
    const headers = this.authHandler.getAuthHeaders();

    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401) {
        throw new Error('Authentication failed: Invalid API key');
      }
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Parse OpenAI response
   */
  private parseResponse(response: Record<string, unknown>): AIResponse {
    try {
      if (response.error) {
        const errorMessage = (response.error && typeof response.error === 'object' && 'message' in response.error) 
          ? (response.error as { message: string }).message 
          : 'OpenAI API error';
        return this.createErrorResponse('API_ERROR', errorMessage);
      }

      // Extract the content from the OpenAI response
      const choices = response.choices as unknown[];
      if (!Array.isArray(choices) || !choices[0] || !(choices[0] as Record<string, unknown>).message) {
        return this.createErrorResponse('INVALID_RESPONSE', 'Invalid OpenAI response structure');
      }

      const firstChoice = choices[0] as Record<string, unknown>;
      const message = firstChoice.message as Record<string, unknown>;
      const content = message.content as string;
      if (!content) {
        return this.createErrorResponse('EMPTY_RESPONSE', 'Empty response content from OpenAI');
      }

      // Clean and parse the JSON content
      let parsedContent;
      try {
        // Remove comments and clean up the JSON before parsing
        const cleanedContent = this.cleanJsonContent(content);
        
        // Log the cleaned content for debugging
        if (process.env.NODE_ENV === 'development') {
          //console.log('[RequestProcessor] Original content:', content);
          //console.log('[RequestProcessor] Cleaned content:', cleanedContent);
        }
        
        parsedContent = JSON.parse(cleanedContent);
      } catch (parseError) {
        const cleanedContent = this.cleanJsonContent(content);
        console.error('[RequestProcessor] JSON Parse Error:', parseError);
        console.error('[RequestProcessor] Original content:', content);
        console.error('[RequestProcessor] Cleaned content:', cleanedContent);
        return this.createErrorResponse('INVALID_JSON', `Failed to parse AI response as JSON. Parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}. Content: ${content}`);
      }

      return {
        status: 'success',
        data: parsedContent
      };
    } catch {
      return this.createErrorResponse('REQUEST_ERROR', 'Failed to parse response');
    }
  }

  /**
   * Clean JSON content by removing comments and extra whitespace
   */
  private cleanJsonContent(content: string): string {
    try {
      // First, try to extract JSON from code blocks if present
      const codeBlockMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (codeBlockMatch) {
        return codeBlockMatch[1].trim();
      }
      
      // If no code blocks, look for JSON object boundaries
      const startIndex = content.indexOf('{');
      const lastIndex = content.lastIndexOf('}');
      
      if (startIndex !== -1 && lastIndex !== -1 && lastIndex > startIndex) {
        let extracted = content.substring(startIndex, lastIndex + 1);
        
        // Remove single-line comments (// comments) - but be careful not to remove // in strings
        extracted = extracted.replace(/(?<!")\/\/(?:[^"\\]|\\.)*?(?=\n|$)/gm, '');
        
        // Remove multi-line comments (/* comments */) - but be careful not to remove /* in strings
        extracted = extracted.replace(/\/\*[\s\S]*?\*\//g, '');
        
        return extracted.trim();
      }
      
      // If we can't find clear JSON boundaries, just remove comments from the whole content
      let cleaned = content;
      
      // Remove single-line comments (// comments)
      cleaned = cleaned.replace(/(?<!")\/\/(?:[^"\\]|\\.)*?(?=\n|$)/gm, '');
      
      // Remove multi-line comments (/* comments */)
      cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
      
      return cleaned.trim();
    } catch {
      // If cleaning fails, return original content
      return content.trim();
    }
  }

  /**
   * Create error response
   */
  private createErrorResponse(errorCode: ErrorCode, message: string): AIResponse {
    return {
      status: 'error',
      error: message,
      errorCode: errorCode
    };
  }
}
