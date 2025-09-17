/**
 * Task Loop Module Type Definitions
 * Based on design/task-loop.md specifications
 */

import { 
  StandardError,
  AIResponse as SharedAIResponse,
  AIGeneratedCommand,
  ExecutorCommand,
  ISessionManager
} from '../../../types/shared-types';

// Main Task Loop interface
export interface ITaskLoop {
  // Execute a single step with ACT-REFLECT cycle
  executeStep(sessionId: string, stepId: number): Promise<StepResult>;
}

// Step Result interface
export interface StepResult {
  status: 'success' | 'failure' | 'error';
  stepId: number;
  iterations: number;
  totalDuration: number;
  finalResponse?: AIResponse;
  error?: string;
}

// AI Response interface (matches design document expectations)
export interface AIResponse {
  action?: {
    command: string;
    parameters: Record<string, any>;
  };
  reasoning: string;
  confidence: number;
  flowControl: 'continue' | 'stop_success' | 'stop_failure';
}

// Dependency interfaces for modules not yet implemented
export interface IAIIntegrationManager {
  sendRequest(prompt: string): Promise<AIIntegrationResponse>;
}

export interface AIIntegrationResponse {
  status: 'success' | 'error';
  data?: any;
  error?: string;
}

export interface IAIPromptManager {
  getStepPrompt(sessionId: string, stepId: number): string;
}

export interface IAISchemaManager {
  getAIResponseSchema(): object;
}

export interface IExecutorSessionManager extends ISessionManager {
  readonly moduleId: 'executor';
  getExecutorSession(workflowSessionId: string): any | null;
  executeCommand(command: any): Promise<any>;
}

// Task Loop configuration
export interface TaskLoopConfig {
  maxIterations: number;
  timeoutMs: number;
  enableLogging: boolean;
}

// Default configuration
export const DEFAULT_TASK_LOOP_CONFIG: TaskLoopConfig = {
  maxIterations: 10,
  timeoutMs: 300000, // 5 minutes
  enableLogging: true
};

// Task execution context for logging
export interface TaskExecutionContext {
  iteration: number;
  aiResponse: AIResponse;
  timestamp: Date;
}

// Error types specific to Task Loop
export class TaskLoopError extends Error {
  constructor(
    message: string,
    public readonly sessionId?: string,
    public readonly stepId?: number,
    public readonly iteration?: number,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'TaskLoopError';
  }
}

// Validation error
export class ValidationError extends TaskLoopError {
  constructor(message: string, sessionId?: string, stepId?: number) {
    super(message, sessionId, stepId);
    this.name = 'ValidationError';
  }
}

// Constants
export const MAX_ITERATIONS = 10;
export const DEFAULT_TIMEOUT_MS = 300000; // 5 minutes

// Module registration token
export const TASK_LOOP_TOKEN = 'ITaskLoop';
