/**
 * Request Processor
 * Request/response handling for OpenAI API
 */

import { AIConfig, AIResponse, ErrorCode } from './types';
import { AuthHandler } from './auth-handler';
import { ImageHandler } from './image-handler';
import { Logger } from './logger';

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
      this.logger.logRequest(requestPayload);

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
  private async prepareRequestPayload(request: string, imageFilePath?: string): Promise<any> {
    const messages: any[] = [];

    if (imageFilePath) {
      // Process image file
      const imageDataUrl = await this.imageHandler.processImageFile(imageFilePath);
      
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
              url: imageDataUrl
            }
          }
        ]
      });
    } else {
      // Text-only request
      messages.push({
        role: 'user',
        content: request
      });
    }

    return {
      model: this.config.model,
      messages: messages,
      max_tokens: 1000
    };
  }

  /**
   * Send request to OpenAI API
   */
  private async sendToOpenAI(payload: any): Promise<any> {
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
  private parseResponse(response: any): AIResponse {
    try {
      if (response.error) {
        return this.createErrorResponse('API_ERROR', response.error.message || 'OpenAI API error');
      }

      // Extract the content from the OpenAI response
      if (!response.choices || !response.choices[0] || !response.choices[0].message) {
        return this.createErrorResponse('INVALID_RESPONSE', 'Invalid OpenAI response structure');
      }

      const content = response.choices[0].message.content;
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
          console.log('[RequestProcessor] Original content:', content);
          console.log('[RequestProcessor] Cleaned content:', cleanedContent);
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
    } catch (error) {
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
    } catch (error) {
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
