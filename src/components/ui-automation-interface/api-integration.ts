/**
 * Frontend API Integration
 * Handles communication with the backend automation system
 * Based on design/frontend-api.md
 */

import { 
  StepProcessingRequest, 
  StreamEvent,
  StreamEventType
} from './types';
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
   * Connect to SSE stream for real-time events
   */
  async connectToStream(streamId: string): Promise<EventSource> {
    return new Promise((resolve, reject) => {
      try {
        const sseUrl = `${this.baseUrl}/api/stream/ws/${streamId}`;
        
        const eventSource = new EventSource(sseUrl);
        
        eventSource.onopen = () => {
          console.log('SSE connected to stream:', streamId);
          resolve(eventSource);
        };

        eventSource.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            
            switch (message.type) {
              case 'event':
                // Convert SSE message format to expected StreamEvent format
                const streamEvent: StreamEvent = {
                  id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  type: StreamEventType.WORKFLOW_PROGRESS,
                  timestamp: new Date(message.timestamp),
                  sessionId: message.sessionId,
                  message: message.data,
                  level: 'info' as const
                };
                
                this.eventCallbacks.forEach(callback => {
                  try {
                    callback(streamEvent);
                  } catch (error) {
                    console.error('Error in event callback:', error);
                  }
                });
                break;
                
              case 'error':
                const errorMsg = message.data || 'Stream error';
                this.errorCallbacks.forEach(callback => {
                  try {
                    callback(errorMsg);
                  } catch (error) {
                    console.error('Error in error callback:', error);
                  }
                });
                break;
                
              default:
                console.log('Unknown message type:', message.type);
            }
          } catch (error) {
            console.error('Error parsing SSE message:', error);
            this.errorCallbacks.forEach(callback => {
              try {
                callback('Failed to parse stream message');
              } catch (err) {
                console.error('Error in error callback:', err);
              }
            });
          }
        };

        eventSource.onerror = (error) => {
          console.error('SSE error:', error);
          this.errorCallbacks.forEach(callback => {
            try {
              callback(ERROR_MESSAGES.CONNECTION_LOST);
            } catch (error) {
              console.error('Error in error callback:', error);
            }
          });
          
          // Don't reject immediately - let the connection be established first
          if (eventSource.readyState === EventSource.CONNECTING) {
            reject(new Error(ERROR_MESSAGES.CONNECTION_LOST));
          }
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

  const config = {
    maxExecutionTime: 300000,     // 5 minutes
    enableStreaming: true,
    enableReflection: true,
    retryOnFailure: false,
    maxRetries: 3,
    parallelExecution: false
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
