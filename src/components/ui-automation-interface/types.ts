/**
 * UI Automation Interface Types
 * Based on design/ui-automation-interface.md and shared types
 */

import { 
  StreamEvent, 
  StreamEventType, 
  StepProcessingRequest, 
  APIResponse, 
  APIError,
  SessionStatus
} from '../../../types/shared-types';

// Component Interfaces from design
export interface SimpleStepInputComponent {
  stepText: string;
  setStepText: (text: string) => void;
  onExecute: () => Promise<void>;
  isExecuting: boolean;
  isEmpty: boolean;
  error: string | null;
}

export interface SimpleStreamingOutputComponent {
  events: StreamEvent[];
  sessionId: string | null;
  streamConnection: WebSocket | null;
  autoScroll: boolean;
  isConnected: boolean;
  error: string | null;
}

// UI State Management
export interface SimpleUIState {
  stepText: string;
  sessionId: string | null;
  streamId: string | null;
  isExecuting: boolean;
  events: StreamEvent[];
  isConnected: boolean;
  error: string | null;
}

export interface UIActions {
  setStepText: (text: string) => void;
  executeSteps: () => Promise<void>;
  addEvent: (event: StreamEvent) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

// Log Entry Format for UI display
export interface SimpleLogEntry {
  timestamp: string;
  type: StreamEventType;
  message: string;
  level: 'info' | 'success' | 'warning' | 'error';
}

// Frontend API Integration Types
export interface SimpleFrontendAPIIntegration {
  executeSteps(request: StepProcessingRequest): Promise<ExecuteStepsResponse>;
  connectToStream(streamId: string): Promise<WebSocket>;
  onEvent(callback: (event: StreamEvent) => void): void;
  onError(callback: (error: string) => void): void;
}

// Response Types
export interface ExecuteStepsResponse extends APIResponse {
  data: {
    sessionId: string;
    streamId?: string;
    initialStatus: SessionStatus;
    estimatedDuration?: number;
    createdAt: string;
  };
  metadata: {
    timestamp: string;
    requestId: string;
    version: string;
    processingTimeMs: number;
    streamUrl?: string;
  };
}

// Error Messages
export const ERROR_MESSAGES = {
  EMPTY_STEPS: 'Please enter some automation steps',
  EXECUTION_FAILED: 'Automation execution failed',
  CONNECTION_LOST: 'Connection lost - trying to reconnect...',
  INVALID_RESPONSE: 'Invalid response from server'
} as const;

// WebSocket Message Types
export interface WSClientMessage {
  type: 'subscribe' | 'unsubscribe' | 'replay' | 'ping' | 'filter_update';
  payload?: {
    filters?: any[];
    replayOptions?: {
      fromTimestamp?: string;
      eventCount?: number;
      eventTypes?: StreamEventType[];
    };
  };
}

export interface WSServerMessage {
  type: 'event' | 'error' | 'pong' | 'connection_ack' | 'replay_complete';
  payload?: {
    event?: StreamEvent;
    error?: APIError;
    metadata?: Record<string, any>;
  };
}
