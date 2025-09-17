/**
 * Step Processor Module Type Definitions
 * Defines all interfaces and types for workflow orchestration and step processing
 * Based on design/step-processor.md specifications
 */

import {
  // Shared session management types
  ISessionManager,
  ModuleSessionInfo,
  ModuleSessionConfig,
  SessionStatus,
  SessionLifecycleCallbacks,
  SessionManagerHealth,
  WorkflowSession,
  SessionCoordinator,
  
  // Shared processing types
  StepProcessingRequest,
  StepProcessingResult,
  ProcessingConfig,
  StepResult,
  ExecutionProgress,
  
  // Shared error and logging types
  StandardError,
  LogLevel,
  LoggingConfig,
  
  // Shared event types
  IEventPublisher,
  TaskLoopEvent,
  TaskLoopEventType,
  TaskLoopEventData,
  StreamEvent,
  StreamEventType,
  StreamEventData,
  
  // Shared timeout and config types
  TimeoutConfig,
  BaseModuleConfig,
  PerformanceConfig,
  
  // Dependency injection types
  DIContainer,
  
  // Command and response types
  ExecutorCommand,
  CommandResponse,
  AIResponse,
  
  // Status enums
  StepStatus,
  
  // Working session types
  WorkflowConfig
} from './shared-types';

// Core Step Processor Interface - implements standardized session management
export interface IStepProcessor extends ISessionManager {
  readonly moduleId: 'step-processor';
  
  // Workflow Management (uses workflowSessionId consistently)
  processSteps(request: StepProcessingRequest): Promise<StepProcessingResult>;
  pauseExecution(workflowSessionId: string): Promise<void>;
  resumeExecution(workflowSessionId: string): Promise<void>;
  cancelExecution(workflowSessionId: string): Promise<void>;
  
  // Session Coordination (works with SessionCoordinator)
  getWorkflowSession(workflowSessionId: string): WorkflowSession | null;
  listActiveWorkflowSessions(): string[];
  destroyWorkflowSession(workflowSessionId: string): Promise<void>;
  
  // Progress Tracking
  getExecutionProgress(workflowSessionId: string): Promise<ExecutionProgress>;
  getStepHistory(workflowSessionId: string): Promise<StepExecutionSummary[]>;
  
  // Dependency Injection
  initialize(container: DIContainer): Promise<void>;
}

// Session Management Types
export interface StepProcessorSession extends ModuleSessionInfo {
  moduleId: 'step-processor';
  workflowSession?: WorkflowSession;
  currentStepIndex: number;
  totalSteps: number;
  executionProgress: ExecutionProgress;
  streamingEnabled: boolean;
  lastStepResult?: StepResult;
}

export interface StepProcessorSessionConfig extends ModuleSessionConfig {
  enableStreaming?: boolean;
  maxExecutionTime?: number;
  retryOnFailure?: boolean;
  maxRetries?: number;
  workflowConfig?: WorkflowConfig;
}

// Step Execution Management
export interface StepExecutionSummary {
  stepIndex: number;
  stepContent: string;
  status: StepStatus;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  result?: StepResult;
  error?: StandardError;
  iterationCount: number;
  aiReasoningCount: number;
  commandCount: number;
}

export interface StepExecutionContext {
  sessionId: string;
  workflowSessionId: string;
  stepIndex: number;
  stepContent: string;
  streamId?: string;
  config: ProcessingConfig;
  startTime: Date;
  currentIteration: number;
  maxIterations: number;
}

// Event Publishing and Coordination
export interface StepProcessorEventPublisher extends IEventPublisher {
  // Step-level events (owned by Step Processor)
  publishStepStarted(streamId: string | undefined, sessionId: string, stepIndex: number, stepContent: string): Promise<void>;
  publishStepCompleted(streamId: string | undefined, sessionId: string, stepIndex: number, result: StepResult): Promise<void>;
  publishStepFailed(streamId: string | undefined, sessionId: string, stepIndex: number, error: StandardError): Promise<void>;
  
  // Workflow-level events (owned by Step Processor)
  publishWorkflowStarted(streamId: string | undefined, sessionId: string, totalSteps: number): Promise<void>;
  publishWorkflowProgress(streamId: string | undefined, sessionId: string, progress: ExecutionProgress): Promise<void>;
  publishWorkflowCompleted(streamId: string | undefined, sessionId: string): Promise<void>;
  publishWorkflowFailed(streamId: string | undefined, sessionId: string, error: StandardError): Promise<void>;
  publishWorkflowPaused(streamId: string | undefined, sessionId: string): Promise<void>;
  publishWorkflowResumed(streamId: string | undefined, sessionId: string): Promise<void>;
  
  // Generic stream event publishing
  publishStreamEvent(streamId: string | undefined, event: Omit<StreamEvent, 'id' | 'timestamp'>): Promise<void>;
}

// Task Loop Integration - Event-Driven Architecture
export interface TaskLoopEventHandler {
  handleStepStarted(sessionId: string, stepIndex: number): Promise<void>;
  handleStepCompleted(sessionId: string, stepIndex: number, result: StepResult): Promise<void>;
  handleStepFailed(sessionId: string, stepIndex: number, error: StandardError): Promise<void>;
  handleAIReasoningUpdate(sessionId: string, stepIndex: number, reasoning: { content: string; confidence: number }): Promise<void>;
  handleCommandExecuted(sessionId: string, stepIndex: number, commandData: { command: ExecutorCommand; result: CommandResponse }): Promise<void>;
  handleProgressUpdate(sessionId: string, progress: ExecutionProgress): Promise<void>;
}

// Module Dependencies (resolved via DI Container)
export interface StepProcessorDependencies {
  sessionCoordinator: SessionCoordinator;
  contextManager: IAIContextManagerInterface;
  taskLoop: ITaskLoopInterface;
  executor: IExecutorInterface;
  executorStreamer: IExecutorStreamerInterface;
  aiIntegration: IAIIntegrationInterface;
  errorHandler: IErrorHandlerInterface;
  logger: ILoggerInterface;
}

// External Module Interfaces (for DI integration)
export interface IAIContextManagerInterface {
  createSession(sessionId: string): Promise<string>;
  linkExecutorSession(sessionId: string, executorSessionId: string): Promise<void>;
  setSteps(sessionId: string, steps: string[]): Promise<void>;
  destroySession(sessionId: string): Promise<void>;
}

export interface ITaskLoopInterface {
  processStep(request: TaskLoopStepRequest): Promise<StepResult>;
  setEventPublisher(publisher: IEventPublisher): void;
  pauseExecution(workflowSessionId: string, stepIndex: number): Promise<void>;
  resumeExecution(workflowSessionId: string, stepIndex: number): Promise<void>;
  cancelExecution(workflowSessionId: string, stepIndex: number): Promise<void>;
}

export interface TaskLoopStepRequest {
  sessionId: string;
  stepIndex: number;
  stepContent: string;
  streamId?: string;
  options?: ProcessingOptions;
}

export interface ProcessingOptions {
  maxIterations?: number;
  reflectionEnabled?: boolean;
  validationMode?: 'strict' | 'lenient';
  timeoutMs?: number;
  retryOnFailure?: boolean;
  maxRetries?: number;
}

export interface IExecutorInterface {
  createSession(sessionId: string): Promise<string>;
  destroySession(sessionId: string): Promise<void>;
  executeCommand(sessionId: string, command: ExecutorCommand): Promise<CommandResponse>;
}

export interface IExecutorStreamerInterface {
  createStream(streamId: string, sessionId: string): Promise<void>;
  destroyStream(streamId: string): Promise<void>;
  publishEvent(streamId: string, event: StreamEvent): Promise<void>;
}

export interface IAIIntegrationInterface {
  validateConnection(connectionId: string): Promise<boolean>;
  sendRequest(connectionId: string, request: any): Promise<AIResponse>;
}

export interface IErrorHandlerInterface {
  createStandardError(code: string, message: string, details?: Record<string, any>, cause?: Error): StandardError;
  wrapError(error: any, code: string, message: string, details?: Record<string, any>): StandardError;
  handleError(error: StandardError): void;
}

export interface ILoggerInterface {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: StandardError, context?: LogContext): void;
}

export interface LogContext {
  sessionId?: string;
  stepIndex?: number;
  workflowSession?: WorkflowSession;
  error?: StandardError;
  duration?: number;
  details?: Record<string, any>;
}

// Configuration Types
export interface StepProcessorConfig extends BaseModuleConfig {
  moduleId: 'step-processor';
  
  // Step Processor specific configuration
  workflow: {
    maxConcurrentSessions: number;
    enableCheckpoints: boolean;
    checkpointInterval: number;           // milliseconds
    sessionTTL: number;                   // milliseconds
  };
  
  streaming: {
    enabled: boolean;
    bufferSize: number;
    maxHistorySize: number;
    compressionEnabled: boolean;
  };
  
  // Batch processing
  batch: {
    enabled: boolean;
    maxBatchSize: number;
    maxConcurrentBatches: number;
    batchTimeoutMs: number;
  };
  
  // Recovery settings
  recovery: {
    enableCheckpoints: boolean;
    checkpointInterval: number;
    maxRecoveryAttempts: number;
    recoveryTimeoutMs: number;
  };
}

// Error Types and Handling
export enum StepProcessorErrorType {
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  SESSION_CREATION_FAILED = 'SESSION_CREATION_FAILED',
  TASK_LOOP_TIMEOUT = 'TASK_LOOP_TIMEOUT',
  CONCURRENT_LIMIT_EXCEEDED = 'CONCURRENT_LIMIT_EXCEEDED',
  WORKFLOW_SESSION_NOT_FOUND = 'WORKFLOW_SESSION_NOT_FOUND',
  MODULE_INITIALIZATION_FAILED = 'MODULE_INITIALIZATION_FAILED',
  STREAMING_INITIALIZATION_FAILED = 'STREAMING_INITIALIZATION_FAILED',
  STEP_PROCESSING_TIMEOUT = 'STEP_PROCESSING_TIMEOUT',
  DEPENDENCY_RESOLUTION_FAILED = 'DEPENDENCY_RESOLUTION_FAILED',
  SESSION_COORDINATOR_ERROR = 'SESSION_COORDINATOR_ERROR',
  EVENT_PUBLISHING_FAILED = 'EVENT_PUBLISHING_FAILED'
}

export interface StepProcessorError extends StandardError {
  type: StepProcessorErrorType;
  workflowSessionId?: string;
  stepIndex?: number;
  batchId?: string;
}

// Error Handler Implementation
export interface StepProcessorErrorHandler extends IErrorHandlerInterface {
  categorizeError(code: string): import('./shared-types').ErrorCategory;
  determineSeverity(code: string): import('./shared-types').ErrorSeverity;
  isRecoverable(code: string): boolean;
  isRetryable(code: string): boolean;
  getSuggestedAction(code: string): string;
  
  // Step Processor specific error handling
  handleSessionError(workflowSessionId: string, error: StandardError): Promise<void>;
  handleStepError(workflowSessionId: string, stepIndex: number, error: StandardError): Promise<void>;
  handleBatchError(batchId: string, error: StandardError): Promise<void>;
}

// Constants and Defaults
export const STEP_PROCESSOR_VERSION = '1.0.0';

export const DEFAULT_STEP_PROCESSOR_CONFIG: StepProcessorConfig = {
  moduleId: 'step-processor',
  version: STEP_PROCESSOR_VERSION,
  enabled: true,
  
  workflow: {
    maxConcurrentSessions: 10,
    enableCheckpoints: true,
    checkpointInterval: 30000,           // 30 seconds
    sessionTTL: 1800000                  // 30 minutes
  },
  
  streaming: {
    enabled: true,
    bufferSize: 1000,
    maxHistorySize: 10000,
    compressionEnabled: true
  },
  
  batch: {
    enabled: false,
    maxBatchSize: 5,
    maxConcurrentBatches: 2,
    batchTimeoutMs: 3600000              // 1 hour
  },
  
  recovery: {
    enableCheckpoints: true,
    checkpointInterval: 60000,           // 1 minute
    maxRecoveryAttempts: 3,
    recoveryTimeoutMs: 300000            // 5 minutes
  },
  
  logging: {
    level: LogLevel.INFO,
    prefix: '[StepProcessor]',
    includeTimestamp: true,
    includeSessionId: true,
    includeModuleId: true,
    structured: false
  },
  
  performance: {
    maxConcurrentOperations: 5,
    cacheEnabled: true,
    cacheTTLMs: 300000,                  // 5 minutes
    metricsEnabled: true
  },
  
  timeouts: {
    workflowTimeoutMs: 1800000,          // 30 minutes
    stepTimeoutMs: 300000,               // 5 minutes  
    requestTimeoutMs: 30000,             // 30 seconds
    connectionTimeoutMs: 10000,          // 10 seconds
    defaultOperationTimeoutMs: 30000,
    maxRetryAttempts: 3,
    retryDelayMs: 1000,
    exponentialBackoff: true
  }
};

// Processing Limits and Constants
export const STEP_PROCESSOR_LIMITS = {
  MAX_STEPS_PER_WORKFLOW: 100,
  MAX_STEP_CONTENT_LENGTH: 2000,
  MAX_CONCURRENT_SESSIONS: 50,
  MAX_WORKFLOW_DURATION_MS: 3600000,     // 1 hour
  MAX_HISTORY_ENTRIES: 1000,
  MAX_RETRY_ATTEMPTS: 5,
  MIN_CHECKPOINT_INTERVAL_MS: 10000,     // 10 seconds
  MAX_CHECKPOINT_INTERVAL_MS: 300000,    // 5 minutes
  MAX_BATCH_SIZE: 20,
  MAX_ERROR_DETAILS_SIZE: 10000         // 10KB
} as const;

// Error Code Mappings
export const STEP_PROCESSOR_ERROR_CODES = {
  VALIDATION_FAILED: 'SP001',
  SESSION_CREATION_FAILED: 'SP002',
  TASK_LOOP_TIMEOUT: 'SP003',
  CONCURRENT_LIMIT_EXCEEDED: 'SP004',
  WORKFLOW_SESSION_NOT_FOUND: 'SP005',
  MODULE_INITIALIZATION_FAILED: 'SP006',
  STREAMING_INITIALIZATION_FAILED: 'SP007',
  STEP_PROCESSING_TIMEOUT: 'SP008',
  DEPENDENCY_RESOLUTION_FAILED: 'SP009',
  SESSION_COORDINATOR_ERROR: 'SP010',
  EVENT_PUBLISHING_FAILED: 'SP011'
} as const;

// Event Type Mappings for Step Processor
export const STEP_PROCESSOR_STREAM_EVENTS = {
  WORKFLOW_STARTED: StreamEventType.WORKFLOW_STARTED,
  WORKFLOW_PROGRESS: StreamEventType.WORKFLOW_PROGRESS,
  WORKFLOW_COMPLETED: StreamEventType.WORKFLOW_COMPLETED,
  WORKFLOW_FAILED: StreamEventType.WORKFLOW_FAILED,
  WORKFLOW_PAUSED: StreamEventType.WORKFLOW_PAUSED,
  WORKFLOW_RESUMED: StreamEventType.WORKFLOW_RESUMED,
  STEP_STARTED: StreamEventType.STEP_STARTED,
  STEP_COMPLETED: StreamEventType.STEP_COMPLETED,
  STEP_FAILED: StreamEventType.STEP_FAILED
} as const;

// Task Loop Event Type Mappings
export const STEP_PROCESSOR_TASK_LOOP_EVENTS = {
  STEP_STARTED: TaskLoopEventType.STEP_STARTED,
  STEP_COMPLETED: TaskLoopEventType.STEP_COMPLETED,
  STEP_FAILED: TaskLoopEventType.STEP_FAILED,
  AI_REASONING_UPDATE: TaskLoopEventType.AI_REASONING_UPDATE,
  COMMAND_EXECUTED: TaskLoopEventType.COMMAND_EXECUTED,
  PROGRESS_UPDATE: TaskLoopEventType.PROGRESS_UPDATE
} as const;