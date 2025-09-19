/**
 * Task Loop Module Type Definitions
 * All types required for the Task Loop implementation
 */

// Main Task Loop Interface
export interface ITaskLoop {
  // Execute a single step with ACT-REFLECT cycle
  executeStep(sessionId: string, stepId: number): Promise<StepResult>;
  
  // Configuration management
  getConfig(): TaskLoopConfig;
  updateConfig(newConfig: Partial<TaskLoopConfig>): void;
}

// Static interface for the TaskLoop class
export interface ITaskLoopConstructor {
  getInstance(config?: TaskLoopConfig): ITaskLoop;
}

// Configuration Interface
export interface TaskLoopConfig {
  maxIterations: number;        // Default: 4
  timeoutMs: number;           // Default: 300000 (5 minutes)
  enableLogging: boolean;      // Default: true
}

// Step Result Interface
export interface StepResult {
  status: 'success' | 'failure' | 'error';
  stepId: number;
  iterations: number;
  totalDuration: number;
  finalResponse?: AIResponse;
  error?: string;
}

// Confidence Level Enum
export type ConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH';

// Action parameters interface for better type safety
export interface ActionParameters {
  url?: string;
  selector?: string;
  text?: string;
  variableName?: string;
  attribute?: string;
  multiple?: boolean;
  maxDomSize?: number;
  [key: string]: unknown;
}

// AI Response Interface (from AI Schema Manager)
export interface AIResponse {
  action?: {
    command: string;
    parameters: ActionParameters;
  };
  reasoning: string;
  confidence: ConfidenceLevel;
  flowControl: 'continue' | 'stop_success' | 'stop_failure';
}

// Task Execution Log Entry
export interface TaskExecutionLog {
  iteration: number;
  aiResponse: AIResponse;
  timestamp: Date;
}

// Error Categories for Task Loop
export enum TaskLoopErrorType {
  AI_REQUEST_FAILED = 'AI_REQUEST_FAILED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  EXECUTOR_FAILED = 'EXECUTOR_FAILED',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  MAX_ITERATIONS_EXCEEDED = 'MAX_ITERATIONS_EXCEEDED',
  TIMEOUT_EXCEEDED = 'TIMEOUT_EXCEEDED',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  CONTEXT_ERROR = 'CONTEXT_ERROR'
}

// Task loop error details interface
export interface TaskLoopErrorDetails {
  originalError?: string;
  stack?: string;
  aiResponse?: AIResponse;
  action?: { command: string; parameters: ActionParameters };
  duration?: number;
  timeout?: number;
  [key: string]: unknown;
}

// Task Loop Error Interface
export interface TaskLoopError extends Error {
  type: TaskLoopErrorType;
  sessionId?: string;
  stepId?: number;
  iteration?: number;
  details?: TaskLoopErrorDetails;
}
