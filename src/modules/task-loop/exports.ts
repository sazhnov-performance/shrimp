/**
 * Task Loop Module Exports
 * 
 * This file provides a centralized export for all Task Loop module components.
 * Import from this file to access the main TaskLoop class and related types.
 */

// Main TaskLoop implementation
export { TaskLoop, default } from './index';

// Type definitions
export * from './types';

// Utilities
export { Logger } from './logger';
export { TaskLoopErrorHandler } from './error-handler';

// Re-export commonly used shared types for convenience
export {
  TaskLoopStepRequest,
  StepResult,
  ExecutorCommand,
  AIResponse,
  AIGeneratedCommand,
  StandardError,
  SessionStatus,
  InvestigationPhase,
  InvestigationTool,
  ElementDiscovery,
  PageInsight,
  CommandResponse
} from '../../types/shared-types';
