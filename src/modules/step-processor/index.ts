/**
 * Step Processor Module - Main Entry Point
 * Exports all public interfaces and implementations for the Step Processor module
 * Based on design/step-processor.md specifications
 */

// Core interfaces and types
export type {
  IStepProcessor,
  StepProcessorSession,
  StepProcessorSessionConfig,
  StepExecutionSummary,
  StepExecutionContext,
  StepProcessorEventPublisher,
  TaskLoopEventHandler,
  StepProcessorDependencies,
  IAIContextManagerInterface,
  ITaskLoopInterface,
  TaskLoopStepRequest,
  IExecutorInterface,
  IExecutorStreamerInterface,
  IAIIntegrationInterface,
  IErrorHandlerInterface,
  ILoggerInterface,
  LogContext,
  StepProcessorConfig,
  StepProcessorError,
  StepProcessorErrorHandler
} from './types';

// Enums and constants
export {
  StepProcessorErrorType,
  STEP_PROCESSOR_VERSION,
  DEFAULT_STEP_PROCESSOR_CONFIG,
  STEP_PROCESSOR_LIMITS,
  STEP_PROCESSOR_ERROR_CODES,
  STEP_PROCESSOR_STREAM_EVENTS,
  STEP_PROCESSOR_TASK_LOOP_EVENTS
} from './types';

// Main implementation
export { 
  StepProcessor,
  createStepProcessor 
} from './step-processor';

// Error handling
export {
  StepProcessorErrorHandlerImpl,
  StepProcessorErrorHelpers,
  createStepProcessorErrorHandler
} from './error-handler';

// Logging
export {
  StepProcessorLogger,
  createStepProcessorLogger,
  createLoggerFromConfig,
  createDefaultLogger
} from './logger';

// Event publishing
export {
  StepProcessorEventPublisherImpl,
  createStepProcessorEventPublisher
} from './event-publisher';

// Re-export relevant shared types for convenience
export type {
  SessionStatus,
  SessionManagerHealth,
  WorkflowSession,
  StepProcessingRequest,
  StepProcessingResult,
  ExecutionProgress,
  StepResult,
  StandardError,
  LogLevel,
  LoggingConfig,
  TaskLoopEvent,
  StreamEvent,
  DIContainer
} from '../../types/shared-types';

// Module metadata
export const STEP_PROCESSOR_MODULE_INFO = {
  moduleId: 'step-processor',
  version: '1.0.0',
  description: 'Workflow orchestration and step processing module',
  author: 'AI Automation System',
  dependencies: [
    'session-coordinator',
    'ai-context-manager', 
    'task-loop',
    'executor',
    'executor-streamer',
    'ai-integration'
  ],
  capabilities: [
    'workflow-orchestration',
    'session-management', 
    'step-coordination',
    'event-publishing',
    'progress-tracking',
    'error-handling',
    'streaming-integration'
  ],
  supportedEvents: [
    'WORKFLOW_STARTED',
    'WORKFLOW_PROGRESS', 
    'WORKFLOW_COMPLETED',
    'WORKFLOW_FAILED',
    'WORKFLOW_PAUSED',
    'WORKFLOW_RESUMED',
    'STEP_STARTED',
    'STEP_COMPLETED',
    'STEP_FAILED'
  ]
} as const;

/**
 * Default configuration factory
 * Creates a Step Processor configuration with sensible defaults
 */
export function createDefaultStepProcessorConfig(): StepProcessorConfig {
  return { ...DEFAULT_STEP_PROCESSOR_CONFIG };
}

/**
 * Configuration validator
 * Validates Step Processor configuration for completeness and consistency
 */
export function validateStepProcessorConfig(config: Partial<StepProcessorConfig>): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!config.moduleId || config.moduleId !== 'step-processor') {
    errors.push('moduleId must be "step-processor"');
  }

  if (!config.version) {
    errors.push('version is required');
  }

  // Workflow configuration validation
  if (config.workflow) {
    if (config.workflow.maxConcurrentSessions <= 0) {
      errors.push('workflow.maxConcurrentSessions must be greater than 0');
    }

    if (config.workflow.maxConcurrentSessions > STEP_PROCESSOR_LIMITS.MAX_CONCURRENT_SESSIONS) {
      warnings.push(`workflow.maxConcurrentSessions exceeds recommended limit: ${STEP_PROCESSOR_LIMITS.MAX_CONCURRENT_SESSIONS}`);
    }

    if (config.workflow.checkpointInterval < STEP_PROCESSOR_LIMITS.MIN_CHECKPOINT_INTERVAL_MS) {
      errors.push(`workflow.checkpointInterval too small: minimum ${STEP_PROCESSOR_LIMITS.MIN_CHECKPOINT_INTERVAL_MS}ms`);
    }

    if (config.workflow.checkpointInterval > STEP_PROCESSOR_LIMITS.MAX_CHECKPOINT_INTERVAL_MS) {
      warnings.push(`workflow.checkpointInterval too large: maximum ${STEP_PROCESSOR_LIMITS.MAX_CHECKPOINT_INTERVAL_MS}ms recommended`);
    }
  }

  // Batch configuration validation
  if (config.batch?.enabled) {
    if (config.batch.maxBatchSize > STEP_PROCESSOR_LIMITS.MAX_BATCH_SIZE) {
      errors.push(`batch.maxBatchSize exceeds limit: ${STEP_PROCESSOR_LIMITS.MAX_BATCH_SIZE}`);
    }

    if (config.batch.maxConcurrentBatches <= 0) {
      errors.push('batch.maxConcurrentBatches must be greater than 0');
    }
  }

  // Timeout hierarchy validation
  if (config.timeouts) {
    if (config.timeouts.workflowTimeoutMs < config.timeouts.stepTimeoutMs) {
      errors.push('timeouts.workflowTimeoutMs must be >= timeouts.stepTimeoutMs');
    }

    if (config.timeouts.stepTimeoutMs < config.timeouts.requestTimeoutMs) {
      errors.push('timeouts.stepTimeoutMs must be >= timeouts.requestTimeoutMs');
    }

    if (config.timeouts.requestTimeoutMs < config.timeouts.connectionTimeoutMs) {
      errors.push('timeouts.requestTimeoutMs must be >= timeouts.connectionTimeoutMs');
    }
  }

  // Performance configuration validation
  if (config.performance) {
    if (config.performance.maxConcurrentOperations <= 0) {
      errors.push('performance.maxConcurrentOperations must be greater than 0');
    }

    if (config.performance.cacheTTLMs <= 0) {
      warnings.push('performance.cacheTTLMs should be greater than 0 when caching is enabled');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Module registration helper
 * Provides a factory function for registering the Step Processor module with a DI container
 */
export function createStepProcessorModuleRegistration(config?: StepProcessorConfig) {
  return {
    moduleId: 'step-processor',
    dependencies: [
      'SessionCoordinator',
      'IAIContextManager',
      'ITaskLoop', 
      'IExecutor',
      'IExecutorStreamer',
      'IAIIntegration',
      'IErrorHandler',
      'ILogger'
    ],
    factory: (container: DIContainer) => {
      const stepProcessor = createStepProcessor(config);
      // Initialize will be called separately after all dependencies are registered
      return stepProcessor;
    },
    singleton: true,
    initializeAsync: true
  };
}
