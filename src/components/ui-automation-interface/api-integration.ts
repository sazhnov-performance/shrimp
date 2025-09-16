/**
 * Frontend API Integration
 * Handles communication with the backend automation system
 * Based on design/frontend-api.md
 */

import { 
  StepProcessingRequest, 
  StreamEvent,
  ProcessingConfig,
  AIProcessingConfig,
  ExecutorProcessingConfig,
  StreamProcessingConfig
} from '../../../types/shared-types';
import { 
  ExecuteStepsResponse, 
  SimpleFrontendAPIIntegration,
  WSClientMessage,
  WSServerMessage,
  ERROR_MESSAGES 
} from './types';

export class FrontendAPIIntegration implements SimpleFrontendAPIIntegration {
  private baseUrl: string;
  private eventCallbacks: ((event: StreamEvent) => void)[] = [];
  private errorCallbacks: ((error: string) => void)[] = [];

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  /**
   * Execute automation steps
   */
  async executeSteps(request: StepProcessingRequest): Promise<ExecuteStepsResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/automation/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error?.message || ERROR_MESSAGES.EXECUTION_FAILED);
      }

      return result;
    } catch (error) {
      throw new Error(
        error instanceof Error 
          ? error.message 
          : ERROR_MESSAGES.EXECUTION_FAILED
      );
    }
  }

  /**
   * Connect to WebSocket stream for real-time events
   */
  async connectToStream(streamId: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/api/stream/ws/${streamId}`;
        
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
          console.log('WebSocket connected to stream:', streamId);
          
          // Send connection acknowledgment
          const message: WSClientMessage = {
            type: 'subscribe',
            payload: {
              filters: [], // No filters for simplified interface
            }
          };
          ws.send(JSON.stringify(message));
          
          resolve(ws);
        };

        ws.onmessage = (event) => {
          try {
            const message: WSServerMessage = JSON.parse(event.data);
            
            switch (message.type) {
              case 'event':
                if (message.payload?.event) {
                  this.eventCallbacks.forEach(callback => {
                    try {
                      callback(message.payload!.event!);
                    } catch (error) {
                      console.error('Error in event callback:', error);
                    }
                  });
                }
                break;
                
              case 'error':
                const errorMsg = message.payload?.error?.message || 'Stream error';
                this.errorCallbacks.forEach(callback => {
                  try {
                    callback(errorMsg);
                  } catch (error) {
                    console.error('Error in error callback:', error);
                  }
                });
                break;
                
              case 'connection_ack':
                console.log('Stream connection acknowledged');
                break;
                
              case 'pong':
                // Heartbeat response - no action needed
                break;
                
              default:
                console.log('Unknown message type:', message.type);
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
            this.errorCallbacks.forEach(callback => {
              try {
                callback('Failed to parse stream message');
              } catch (err) {
                console.error('Error in error callback:', err);
              }
            });
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(new Error(ERROR_MESSAGES.CONNECTION_LOST));
        };

        ws.onclose = () => {
          console.log('WebSocket connection closed');
          this.errorCallbacks.forEach(callback => {
            try {
              callback(ERROR_MESSAGES.CONNECTION_LOST);
            } catch (error) {
              console.error('Error in error callback:', error);
            }
          });
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Register event callback
   */
  onEvent(callback: (event: StreamEvent) => void): void {
    this.eventCallbacks.push(callback);
  }

  /**
   * Register error callback
   */
  onError(callback: (error: string) => void): void {
    this.errorCallbacks.push(callback);
  }

  /**
   * Remove event callback
   */
  removeEventCallback(callback: (event: StreamEvent) => void): void {
    const index = this.eventCallbacks.indexOf(callback);
    if (index > -1) {
      this.eventCallbacks.splice(index, 1);
    }
  }

  /**
   * Remove error callback
   */
  removeErrorCallback(callback: (error: string) => void): void {
    const index = this.errorCallbacks.indexOf(callback);
    if (index > -1) {
      this.errorCallbacks.splice(index, 1);
    }
  }
}

/**
 * Build request for step execution
 */
export function buildExecuteRequest(stepText: string): StepProcessingRequest {
  const steps = stepText
    .split('\n')
    .map(step => step.trim())
    .filter(step => step.length > 0);

  const config: ProcessingConfig = {
    maxExecutionTime: 300000,     // 5 minutes
    enableStreaming: true,
    enableReflection: true,
    retryOnFailure: false,
    maxRetries: 3,
    parallelExecution: false,
    aiConfig: {
      connectionId: 'default',
      model: 'gpt-4',
      temperature: 0.1,
      maxTokens: 4000,
      timeoutMs: 30000
    } as AIProcessingConfig,
    executorConfig: {
      browserType: 'chromium',
      headless: true,
      timeoutMs: 30000,
      screenshotsEnabled: true
    } as ExecutorProcessingConfig,
    streamConfig: {
      bufferSize: 1000,
      maxHistorySize: 10000,
      compressionEnabled: true
    } as StreamProcessingConfig
  };

  return {
    steps,
    config
  };
}

/**
 * Validate step input
 */
export function validateStepInput(stepText: string): { isValid: boolean; error?: string } {
  if (!stepText || stepText.trim().length === 0) {
    return { isValid: false, error: ERROR_MESSAGES.EMPTY_STEPS };
  }

  const steps = stepText
    .split('\n')
    .map(step => step.trim())
    .filter(step => step.length > 0);

  if (steps.length === 0) {
    return { isValid: false, error: ERROR_MESSAGES.EMPTY_STEPS };
  }

  // Additional validation could be added here
  // For now, we accept any non-empty text as valid steps

  return { isValid: true };
}
