/**
 * Frontend API Type Definitions
 * Based on frontend-api.md design document
 */

// Execute Steps Request/Response Types
export interface ExecuteStepsRequest {
  steps: string[];
}

export interface ExecuteStepsResponse {
  sessionId: string;
  status: 'started';
  message: string;
}

// WebSocket Message Types
export interface WebSocketMessage {
  type: 'event' | 'error' | 'close';
  sessionId: string;
  data: string;
  timestamp: string;
}

// Error Response Types
export interface ErrorResponse {
  error: string;
  message: string;
  code?: number;
}
