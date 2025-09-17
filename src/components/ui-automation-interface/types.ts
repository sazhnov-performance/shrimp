/**
 * UI Automation Interface Types
 * Based on design/ui-automation-interface.md
 * Simplified local types - no shared-types dependency
 */

// Simple Stream Event Types for UI
export enum StreamEventType {
  // Workflow events
  WORKFLOW_STARTED = 'WORKFLOW_STARTED',
  WORKFLOW_PROGRESS = 'WORKFLOW_PROGRESS',
  WORKFLOW_COMPLETED = 'WORKFLOW_COMPLETED',
  WORKFLOW_FAILED = 'WORKFLOW_FAILED',
  
  // Step events
  STEP_STARTED = 'STEP_STARTED',
  STEP_COMPLETED = 'STEP_COMPLETED',
  STEP_FAILED = 'STEP_FAILED',
  
  // Investigation events
  INVESTIGATION_STARTED = 'INVESTIGATION_STARTED',
  INVESTIGATION_COMPLETED = 'INVESTIGATION_COMPLETED',
  ELEMENT_DISCOVERED = 'ELEMENT_DISCOVERED',
  
  // AI events
  AI_REASONING = 'AI_REASONING',
  
  // Command events
  COMMAND_STARTED = 'COMMAND_STARTED',
  COMMAND_COMPLETED = 'COMMAND_COMPLETED',
  COMMAND_FAILED = 'COMMAND_FAILED',
  
  // Resource events
  SCREENSHOT_CAPTURED = 'SCREENSHOT_CAPTURED',
  VARIABLE_UPDATED = 'VARIABLE_UPDATED',
  PAGE_NAVIGATED = 'PAGE_NAVIGATED',
  
  // System events
  ERROR_OCCURRED = 'ERROR_OCCURRED',
  WARNING_ISSUED = 'WARNING_ISSUED'
}

// Simplified Stream Event for UI
export interface StreamEvent {
  id: string;
  type: StreamEventType;
  timestamp: Date;
  sessionId: string;
  stepIndex?: number;
  message: string;  // Simple string message instead of complex data object
  level: 'info' | 'success' | 'warning' | 'error';
}

// Simple Session Status
export enum SessionStatus {
  INITIALIZING = 'INITIALIZING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

// Simple API Types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: APIError;
  metadata?: {
    timestamp: string;
    requestId: string;
    version: string;
    processingTimeMs: number;
  };
}

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

// Simple Step Processing Request
export interface StepProcessingRequest {
  steps: string[];
  config: {
    maxExecutionTime: number;
    enableStreaming: boolean;
    enableReflection: boolean;
    retryOnFailure: boolean;
    maxRetries: number;
    parallelExecution: boolean;
  };
}

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

// Log Entry Format for UI display (now same as StreamEvent)
export type SimpleLogEntry = StreamEvent;

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
