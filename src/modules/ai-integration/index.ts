/**
 * AI Integration Module Main Interface
 * Singleton pattern implementation for AI Integration Manager
 */

import { AIConfig, AIResponse, IAIIntegrationManager } from './types';
import { RequestProcessor } from './request-processor';

export class AIIntegrationManager implements IAIIntegrationManager {
  private static instance: AIIntegrationManager | null = null;
  private requestProcessor: RequestProcessor;

  private constructor(config: AIConfig = {} as AIConfig) {
    const defaultConfig: Partial<AIConfig> = {
      model: 'gpt-4o-mini',
      baseUrl: 'https://api.openai.com/v1',
      logFilePath: './ai-requests.log'
    };

    const finalConfig = {
      ...defaultConfig,
      ...config
    } as AIConfig;

    this.requestProcessor = new RequestProcessor(finalConfig);
  }

  /**
   * Get singleton instance of AIIntegrationManager
   */
  static getInstance(config?: AIConfig): IAIIntegrationManager {
    if (!AIIntegrationManager.instance) {
      AIIntegrationManager.instance = new AIIntegrationManager(config);
    }
    return AIIntegrationManager.instance;
  }

  /**
   * Send request to OpenAI and get response
   */
  async sendRequest(request: string, imageFilePath?: string): Promise<AIResponse> {
    return await this.requestProcessor.processRequest(request, imageFilePath);
  }
}

// Export types and interfaces
export * from './types';
export type { IAIIntegrationManager };

// Default export for convenience
export default AIIntegrationManager;
