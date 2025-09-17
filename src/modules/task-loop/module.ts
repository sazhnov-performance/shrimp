/**
 * Task Loop Module Export
 * Main export point for the Task Loop module
 * Based on design/task-loop.md specifications
 */

// Main implementation
export { TaskLoop } from './index';

// Types and interfaces
export type {
  ITaskLoop,
  StepResult,
  AIResponse,
  TaskLoopConfig,
  TaskExecutionContext,
  IAIIntegrationManager,
  AIIntegrationResponse,
  IAIPromptManager,
  IAISchemaManager,
  IExecutorSessionManager
} from './types';

// Error types
export {
  TaskLoopError,
  ValidationError
} from './types';

// Configuration
export {
  DEFAULT_CONFIG,
  MAX_ITERATIONS,
  DEFAULT_TIMEOUT_MS,
  FLOW_CONTROL,
  ERROR_MESSAGES,
  LOG_PREFIX,
  VALIDATION
} from './config';

// Validation utilities
export {
  validateAIResponse,
  validateAgainstSchema,
  sanitizeAIResponse
} from './validator';

// Module token for dependency injection
export { TASK_LOOP_TOKEN } from './types';
