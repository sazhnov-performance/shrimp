/**
 * Task Loop Configuration Constants
 * Based on design/task-loop.md specifications
 */

import { TaskLoopConfig } from './types';

// Default configuration following design specifications
export const DEFAULT_CONFIG: TaskLoopConfig = {
  maxIterations: 10,
  timeoutMs: 300000, // 5 minutes
  enableLogging: true
};

// Maximum iterations constant
export const MAX_ITERATIONS = 10;

// Default timeout in milliseconds (5 minutes)
export const DEFAULT_TIMEOUT_MS = 300000;

// Flow control values
export const FLOW_CONTROL = {
  CONTINUE: 'continue',
  STOP_SUCCESS: 'stop_success', 
  STOP_FAILURE: 'stop_failure'
} as const;

// Error messages
export const ERROR_MESSAGES = {
  MAX_ITERATIONS_EXCEEDED: 'Maximum iterations exceeded',
  AI_REQUEST_FAILED: 'AI request failed',
  VALIDATION_FAILED: 'AI response validation failed',
  EXECUTOR_SESSION_NOT_FOUND: 'Executor session not found',
  COMMAND_EXECUTION_FAILED: 'Command execution failed',
  INVALID_FLOW_CONTROL: 'Invalid flow control value'
} as const;

// Logging prefixes
export const LOG_PREFIX = '[TaskLoop]';

// Validation constants  
export const VALIDATION = {
  MIN_CONFIDENCE: 0,
  MAX_CONFIDENCE: 100,
  REQUIRED_FIELDS: ['reasoning', 'confidence', 'flowControl'],
  VALID_FLOW_CONTROL_VALUES: ['continue', 'stop_success', 'stop_failure']
} as const;
