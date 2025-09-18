/**
 * Frontend API Integration
 * Handles communication with the backend automation system
 * Based on design/frontend-api.md
 */

import { 
  StepProcessingRequest, 
  StreamEvent,
  StreamEventType,
  StructuredLogMessage
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
  private reconnectingCallbacks: ((attempt: number, delay: number) => void)[] = [];
  private reconnectedCallbacks: (() => void)[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelays = [3000, 9000, 15000]; // 3, 9, 15 seconds
  private currentStreamId: string | null = null;
  private isReconnecting = false;
  private currentEventSource: EventSource | null = null;

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
   * Connect to SSE stream for real-time events with reconnection logic
   */
  async connectToStream(streamId: string): Promise<EventSource> {
    this.currentStreamId = streamId;
    this.reconnectAttempts = 0;
    return this.connectToStreamWithRetry(streamId);
  }

  /**
   * Internal method to connect to stream with retry logic
   */
  private async connectToStreamWithRetry(streamId: string): Promise<EventSource> {
    return new Promise((resolve, reject) => {
      try {
        const sseUrl = `${this.baseUrl}/api/stream/ws/${streamId}`;
        
        if (this.currentEventSource) {
          this.currentEventSource.close();
        }
        
        const eventSource = new EventSource(sseUrl);
        this.currentEventSource = eventSource;
        
        eventSource.onopen = () => {
          console.log('SSE connected to stream:', streamId);
          
          // Reset reconnection state on successful connection
          if (this.isReconnecting) {
            this.isReconnecting = false;
            this.reconnectAttempts = 0;
            this.reconnectedCallbacks.forEach(callback => {
              try {
                callback();
              } catch (error) {
                console.error('Error in reconnected callback:', error);
              }
            });
          }
          
          resolve(eventSource);
        };

        eventSource.onmessage = this.handleSSEMessage.bind(this);

        eventSource.onerror = (error) => {
          console.error('SSE error:', error);
          console.log('SSE readyState:', eventSource.readyState);
          console.log('Reconnect attempts:', this.reconnectAttempts, 'Max:', this.maxReconnectAttempts);
          console.log('Is reconnecting:', this.isReconnecting);
          
          // If we're in CONNECTING state and get an error, it likely means the stream doesn't exist
          if (eventSource.readyState === EventSource.CONNECTING) {
            console.log('SSE connection failed during initial connection');
            
            // Only attempt reconnection if we have attempts left and aren't already reconnecting
            if (this.reconnectAttempts < this.maxReconnectAttempts && !this.isReconnecting) {
              console.log('Attempting reconnection due to connection failure');
              this.attemptReconnection(streamId, resolve, reject);
            } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
              console.log('Exhausted all reconnection attempts');
              // Exhausted all reconnection attempts
              this.errorCallbacks.forEach(callback => {
                try {
                  callback(ERROR_MESSAGES.RECONNECTION_FAILED);
                } catch (error) {
                  console.error('Error in error callback:', error);
                }
              });
              reject(new Error(ERROR_MESSAGES.RECONNECTION_FAILED));
            } else {
              console.log('Initial connection error or already reconnecting');
              // Initial connection error or already reconnecting
              this.errorCallbacks.forEach(callback => {
                try {
                  callback(ERROR_MESSAGES.CONNECTION_LOST);
                } catch (error) {
                  console.error('Error in error callback:', error);
                }
              });
              if (!this.isReconnecting) {
                reject(new Error(ERROR_MESSAGES.CONNECTION_LOST));
              }
            }
          } else if (eventSource.readyState === EventSource.OPEN || eventSource.readyState === EventSource.CLOSED) {
            // Connection was established but then lost
            console.log('SSE connection lost after being established');
            
            if (this.reconnectAttempts < this.maxReconnectAttempts && !this.isReconnecting) {
              console.log('Attempting reconnection due to connection loss');
              this.attemptReconnection(streamId, resolve, reject);
            } else {
              console.log('Not attempting reconnection: attempts =', this.reconnectAttempts, 'isReconnecting =', this.isReconnecting);
              this.errorCallbacks.forEach(callback => {
                try {
                  callback(ERROR_MESSAGES.CONNECTION_LOST);
                } catch (error) {
                  console.error('Error in error callback:', error);
                }
              });
            }
          }
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnection(
    streamId: string, 
    resolve: (value: EventSource) => void, 
    reject: (reason?: any) => void
  ): void {
    if (this.isReconnecting) {
      console.log('Already attempting reconnection, skipping...');
      return; // Already attempting reconnection
    }
    
    this.isReconnecting = true;
    this.reconnectAttempts++;
    
    const delay = this.reconnectDelays[this.reconnectAttempts - 1] || this.reconnectDelays[this.reconnectDelays.length - 1];
    
    console.log(`[APIIntegration] Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms to stream ${streamId}`);
    
    // Notify UI about reconnection attempt
    this.reconnectingCallbacks.forEach(callback => {
      try {
        callback(this.reconnectAttempts, delay);
      } catch (error) {
        console.error('Error in reconnecting callback:', error);
      }
    });
    
    setTimeout(() => {
      console.log(`[APIIntegration] Executing reconnection attempt ${this.reconnectAttempts}`);
      
      try {
        // Close the current event source if it exists
        if (this.currentEventSource) {
          this.currentEventSource.close();
        }
        
        // Create new EventSource directly (not recursively calling connectToStreamWithRetry)
        const sseUrl = `${this.baseUrl}/api/stream/ws/${streamId}`;
        const eventSource = new EventSource(sseUrl);
        this.currentEventSource = eventSource;
        
        // Set up event handlers for the new connection
        eventSource.onopen = () => {
          console.log(`[APIIntegration] Reconnection attempt ${this.reconnectAttempts} successful`);
          
          // Reset reconnection state on successful connection
          this.isReconnecting = false;
          this.reconnectAttempts = 0;
          this.reconnectedCallbacks.forEach(callback => {
            try {
              callback();
            } catch (error) {
              console.error('Error in reconnected callback:', error);
            }
          });
          
          resolve(eventSource);
        };

        // Set up the same message handler as the original connection
        eventSource.onmessage = this.handleSSEMessage.bind(this);
        
        eventSource.onerror = (error) => {
          console.error(`[APIIntegration] Reconnection attempt ${this.reconnectAttempts} failed with SSE error:`, error);
          console.log('SSE readyState:', eventSource.readyState);
          
          // Check if we should try again
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            console.log(`[APIIntegration] Will attempt another reconnection (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
            this.isReconnecting = false; // Reset flag so next attempt can proceed
            this.attemptReconnection(streamId, resolve, reject);
          } else {
            console.log(`[APIIntegration] Max reconnection attempts (${this.maxReconnectAttempts}) reached, giving up`);
            this.isReconnecting = false;
            this.errorCallbacks.forEach(callback => {
              try {
                callback(ERROR_MESSAGES.RECONNECTION_FAILED);
              } catch (error) {
                console.error('Error in error callback:', error);
              }
            });
            reject(new Error(ERROR_MESSAGES.RECONNECTION_FAILED));
          }
        };
        
      } catch (error) {
        console.error(`[APIIntegration] Error creating EventSource for reconnection attempt ${this.reconnectAttempts}:`, error);
        this.isReconnecting = false;
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.log(`[APIIntegration] Max reconnection attempts reached after creation error, giving up`);
          this.errorCallbacks.forEach(callback => {
            try {
              callback(ERROR_MESSAGES.RECONNECTION_FAILED);
            } catch (error) {
              console.error('Error in error callback:', error);
            }
          });
          reject(error);
        } else {
          // Try again if we have attempts left
          this.attemptReconnection(streamId, resolve, reject);
        }
      }
    }, delay);
  }

  /**
   * Handle SSE message - shared between initial connection and reconnections
   */
  private handleSSEMessage(event: MessageEvent): void {
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
          
        case 'structured_event':
          // Handle structured log events
          try {
            const structuredData: StructuredLogMessage = JSON.parse(message.data);
            
            let eventType: StreamEventType;
            let level: 'info' | 'success' | 'warning' | 'error';
            let displayMessage: string;
            
            switch (structuredData.type) {
              case 'reasoning':
                eventType = StreamEventType.STRUCTURED_REASONING;
                level = structuredData.confidence === 'high' ? 'info' : structuredData.confidence === 'medium' ? 'warning' : 'error';
                displayMessage = structuredData.text;
                break;
              case 'action':
                eventType = StreamEventType.STRUCTURED_ACTION;
                level = structuredData.success ? 'success' : 'error';
                displayMessage = `${structuredData.actionName}: ${structuredData.success ? 'Success' : 'Failed'}`;
                if (structuredData.error) displayMessage += ` - ${structuredData.error}`;
                break;
              case 'screenshot':
                eventType = StreamEventType.STRUCTURED_SCREENSHOT;
                level = 'info';
                displayMessage = `Screenshot captured${structuredData.actionName ? ` for ${structuredData.actionName}` : ''}`;
                break;
              default:
                console.warn('Unknown structured event type:', structuredData);
                return;
            }
            
            const structuredStreamEvent: StreamEvent = {
              id: `structured_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              type: eventType,
              timestamp: new Date(structuredData.timestamp),
              sessionId: message.sessionId,
              stepIndex: structuredData.stepId,
              message: displayMessage,
              level,
              structuredData
            };
            
            this.eventCallbacks.forEach(callback => {
              try {
                callback(structuredStreamEvent);
              } catch (error) {
                console.error('Error in structured event callback:', error);
              }
            });
          } catch (parseError) {
            console.error('Error parsing structured event:', parseError);
            // Fallback to regular event
            const fallbackEvent: StreamEvent = {
              id: `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              type: StreamEventType.WORKFLOW_PROGRESS,
              timestamp: new Date(message.timestamp),
              sessionId: message.sessionId,
              message: message.data,
              level: 'info' as const
            };
            
            this.eventCallbacks.forEach(callback => {
              try {
                callback(fallbackEvent);
              } catch (error) {
                console.error('Error in fallback event callback:', error);
              }
            });
          }
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

  onReconnecting(callback: (attempt: number, delay: number) => void): void {
    this.reconnectingCallbacks.push(callback);
  }

  onReconnected(callback: () => void): void {
    this.reconnectedCallbacks.push(callback);
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
