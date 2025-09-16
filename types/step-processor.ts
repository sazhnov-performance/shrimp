/**
 * Step Processor Module Type Definitions
 * Defines all interfaces and types for orchestrating automation workflow execution
 */

import { StreamConfig, StreamEvent, StreamEventType } from './executor-streamer';
import { ExecutionStatus, SessionSummary } from './ai-context-manager';
import { LogLevel } from './executor';

// Core Step Processor Interface
export interface IStepProcessor {
  // Workflow Management
  processSteps(request: StepProcessingRequest): Promise<StepProcessingResult>;
  pauseExecution(sessionId: string): Promise<void>;
  resumeExecution(sessionId: string): Promise<void>;
  cancelExecution(sessionId: string): Promise<void>;
  
  // Session Management
  getSessionStatus(sessionId: string): Promise<SessionStatus>;
  listActiveSessions(): string[];
  destroySession(sessionId: string): Promise<void>;
  
  // Progress Tracking
  getExecutionProgress(sessionId: string): Promise<ExecutionProgress>;
  getStepHistory(sessionId: string): Promise<StepExecutionSummary[]>;
}

// Request and Response Types
export interface StepProcessingRequest {
  steps: string[];
  config?: ProcessingConfig;
  metadata?: Record<string, any>;
  streamingEnabled?: boolean;
}

export interface StepProcessingResult {
  sessionId: string;
  streamId?: string;
  initialStatus: ProcessingStatus;
  estimatedDuration?: number;
  createdAt: Date;
}

// Configuration Types
export interface ProcessingConfig {
  maxExecutionTime?: number; // milliseconds
  enableStreaming: boolean;
  enableReflection: boolean;
  retryOnFailure: boolean;
  maxRetries: number;
  parallelExecution: boolean;
  streamConfig?: Partial<StreamConfig>;
}

export interface StepProcessorConfig {
  maxConcurrentSessions: number;
  defaultTimeout: number; // milliseconds
  enableCheckpoints: boolean;
  checkpointInterval: number; // milliseconds
  streamingDefaults: {
    enabled: boolean;
    bufferSize: number;
    maxHistorySize: number;
  };
  retry: {
    enabled: boolean;
    maxAttempts: number;
    delayMs: number;
  };
  logging: {
    level: LogLevel;
    includeStepContent: boolean;
    includeMetadata: boolean;
  };
}

// Status and State Types
export enum ProcessingStatus {
  INITIALIZING = 'INITIALIZING',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export interface SessionStatus {
  sessionId: string;
  streamId?: string;
  status: ProcessingStatus;
  currentStepIndex: number;
  totalSteps: number;
  startTime: Date;
  lastActivity: Date;
  estimatedTimeRemaining?: number;
  error?: ProcessingError;
}

export interface ExecutionProgress {
  sessionId: string;
  totalSteps: number;
  completedSteps: number;
  currentStepIndex: number;
  currentStepName: string;
  overallProgress: number; // 0-100 percentage
  estimatedTimeRemaining: number; // milliseconds
  averageStepDuration: number;
  lastActivity: Date;
}

export interface StepExecutionSummary {
  stepIndex: number;
  stepName: string;
  status: ExecutionStatus;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  iterations: number;
  success: boolean;
  error?: string;
}

// Session Management Types
export interface SessionRegistry {
  sessions: Map<string, ProcessingSession>;
  streamSessions: Map<string, string>; // sessionId -> streamId
  
  addSession(session: ProcessingSession): void;
  getSession(sessionId: string): ProcessingSession | null;
  removeSession(sessionId: string): void;
  listActiveSessions(): ProcessingSession[];
}

export interface ProcessingSession {
  sessionId: string;
  streamId?: string;
  steps: string[];
  config: ProcessingConfig;
  status: ProcessingStatus;
  currentStepIndex: number;
  startTime: Date;
  lastActivity: Date;
  metadata?: Record<string, any>;
}

// Task Loop Coordination Types
export interface TaskLoopCoordination {
  onStepCompleted(sessionId: string, stepIndex: number, result: StepResult): Promise<void>;
  onStepFailed(sessionId: string, stepIndex: number, error: ProcessingError): Promise<void>;
  onExecutionCompleted(sessionId: string, summary: ExecutionSummary): Promise<void>;
}

export interface StepResult {
  sessionId: string;
  stepIndex: number;
  success: boolean;
  duration: number;
  iterations: number;
  finalDom?: string;
  screenshotId?: string;
  executedActions: string[];
  aiReasoning?: string;
  error?: any;
}

export interface ExecutionSummary {
  sessionId: string;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  totalDuration: number;
  averageStepDuration: number;
  totalIterations: number;
  successRate: number;
}

// Integration Interface Types
export interface ContextManagerIntegration {
  initializeSession(sessionId: string, steps: string[]): Promise<void>;
  trackStepProgress(sessionId: string, stepIndex: number, status: ExecutionStatus): Promise<void>;
  getSessionSummary(sessionId: string): Promise<SessionSummary>;
}

export interface ExecutorStreamerIntegration {
  createStreamSession(sessionId: string, config?: Partial<StreamConfig>): Promise<string>;
  publishSessionEvents(streamId: string, events: StreamEvent[]): Promise<void>;
  destroyStreamSession(streamId: string): Promise<void>;
}

export interface TaskLoopIntegration {
  processStep(request: TaskLoopStepRequest): Promise<void>;
  registerCallbacks(callbacks: TaskLoopCallbacks): void;
  pauseStep(sessionId: string, stepIndex: number): Promise<void>;
  resumeStep(sessionId: string, stepIndex: number): Promise<void>;
}

export interface TaskLoopStepRequest {
  sessionId: string;
  stepIndex: number;
  stepContent: string;
  streamId?: string;
  options?: TaskLoopProcessingOptions;
}

export interface TaskLoopProcessingOptions {
  maxIterations?: number;
  reflectionEnabled?: boolean;
  validationMode?: 'strict' | 'lenient';
  timeoutMs?: number;
}

export interface TaskLoopCallbacks {
  onStepStarted(sessionId: string, stepIndex: number): Promise<void>;
  onStepCompleted(sessionId: string, stepIndex: number, result: StepResult): Promise<void>;
  onStepFailed(sessionId: string, stepIndex: number, error: ProcessingError): Promise<void>;
  onReasoningUpdate(sessionId: string, stepIndex: number, reasoning: string): Promise<void>;
  onExecutorMethodCalled(sessionId: string, stepIndex: number, method: string, parameters: any): Promise<void>;
}

// Advanced Features Types
export interface SessionRecovery {
  saveCheckpoint(sessionId: string): Promise<void>;
  recoverSession(sessionId: string): Promise<ProcessingSession>;
  listRecoverableSessions(): Promise<string[]>;
  clearCheckpoint(sessionId: string): Promise<void>;
}

export interface BatchProcessor {
  processBatch(requests: StepProcessingRequest[]): Promise<BatchProcessingResult>;
  monitorBatch(batchId: string): Promise<BatchStatus>;
  cancelBatch(batchId: string): Promise<void>;
}

export interface BatchProcessingResult {
  batchId: string;
  sessionIds: string[];
  status: BatchStatus;
  createdAt: Date;
}

export enum BatchStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

// Event Publishing Types
export interface StreamEventPublisher {
  publishStepStarted(streamId: string | undefined, sessionId: string, stepIndex: number, stepContent: string): Promise<void>;
  publishStepCompleted(streamId: string | undefined, sessionId: string, stepIndex: number, result: StepResult): Promise<void>;
  publishStepFailed(streamId: string | undefined, sessionId: string, stepIndex: number, error: ProcessingError): Promise<void>;
  publishSessionCompleted(streamId: string | undefined, sessionId: string): Promise<void>;
  publishSessionFailed(streamId: string | undefined, sessionId: string, error: ProcessingError): Promise<void>;
}

export interface StepProcessorEvent {
  type: StepProcessorEventType;
  sessionId: string;
  stepIndex?: number;
  timestamp: Date;
  data?: Record<string, any>;
}

export enum StepProcessorEventType {
  SESSION_CREATED = 'SESSION_CREATED',
  SESSION_DESTROYED = 'SESSION_DESTROYED',
  STEP_STARTED = 'STEP_STARTED',
  STEP_COMPLETED = 'STEP_COMPLETED',
  STEP_FAILED = 'STEP_FAILED',
  EXECUTION_PAUSED = 'EXECUTION_PAUSED',
  EXECUTION_RESUMED = 'EXECUTION_RESUMED',
  EXECUTION_CANCELLED = 'EXECUTION_CANCELLED'
}

// Error Types
export enum ProcessingErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SESSION_CREATION_ERROR = 'SESSION_CREATION_ERROR',
  STREAM_CREATION_ERROR = 'STREAM_CREATION_ERROR',
  TASK_LOOP_ERROR = 'TASK_LOOP_ERROR',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  CONCURRENT_LIMIT_EXCEEDED = 'CONCURRENT_LIMIT_EXCEEDED',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  CONTEXT_MANAGER_ERROR = 'CONTEXT_MANAGER_ERROR',
  CHECKPOINT_ERROR = 'CHECKPOINT_ERROR'
}

export interface ProcessingError extends Error {
  type: ProcessingErrorType;
  sessionId?: string;
  stepIndex?: number;
  details?: Record<string, any>;
  timestamp: Date;
}

// Validation Types
export interface StepValidationResult {
  isValid: boolean;
  errors: StepValidationError[];
  warnings: string[];
}

export interface StepValidationError {
  stepIndex: number;
  message: string;
  severity: 'error' | 'warning';
}

export interface IStepValidator {
  validateSteps(steps: string[]): Promise<StepValidationResult>;
  validateStepContent(stepContent: string): boolean;
  validateProcessingConfig(config: ProcessingConfig): boolean;
}

// Metrics and Analytics Types
export interface ProcessorMetrics {
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  failedSessions: number;
  averageSessionDuration: number;
  averageStepsPerSession: number;
  successRate: number;
  resourceUsage: ResourceUsage;
  errorBreakdown: Record<ProcessingErrorType, number>;
}

export interface ResourceUsage {
  memoryUsage: number; // bytes
  cpuUsage: number; // percentage
  activeConnections: number;
  streamingSessions: number;
}

export interface IProcessorAnalytics {
  getMetrics(): Promise<ProcessorMetrics>;
  getSessionMetrics(sessionId: string): Promise<SessionMetrics>;
  getPerformanceReport(timeRange: [Date, Date]): Promise<PerformanceReport>;
}

export interface SessionMetrics {
  sessionId: string;
  totalSteps: number;
  completedSteps: number;
  duration: number;
  iterations: number;
  successRate: number;
  averageStepDuration: number;
  resourceUsage: ResourceUsage;
}

export interface PerformanceReport {
  timeRange: [Date, Date];
  totalSessions: number;
  metrics: ProcessorMetrics;
  topErrors: ErrorFrequency[];
  performanceTrends: PerformanceTrend[];
}

export interface ErrorFrequency {
  error: ProcessingErrorType;
  count: number;
  percentage: number;
}

export interface PerformanceTrend {
  metric: string;
  values: number[];
  timestamps: Date[];
  trend: 'increasing' | 'decreasing' | 'stable';
}

// Event Emitter Interface
export interface IStepProcessorEventEmitter {
  on(event: StepProcessorEventType, listener: (event: StepProcessorEvent) => void): void;
  emit(event: StepProcessorEventType, data: StepProcessorEvent): void;
  removeListener(event: StepProcessorEventType, listener: Function): void;
}

// Storage and Persistence Types
export interface ISessionStorage {
  saveSession(session: ProcessingSession): Promise<void>;
  loadSession(sessionId: string): Promise<ProcessingSession | null>;
  deleteSession(sessionId: string): Promise<void>;
  listSessions(): Promise<string[]>;
  saveCheckpoint(sessionId: string, checkpoint: SessionCheckpoint): Promise<void>;
  loadCheckpoint(sessionId: string): Promise<SessionCheckpoint | null>;
}

export interface SessionCheckpoint {
  sessionId: string;
  stepIndex: number;
  executionState: any;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// Utility Types
export type ProcessingStatusKey = keyof typeof ProcessingStatus;
export type ProcessingErrorTypeKey = keyof typeof ProcessingErrorType;
export type StepProcessorEventTypeKey = keyof typeof StepProcessorEventType;

// Constants
export const STEP_PROCESSOR_VERSION = '1.0.0';
export const DEFAULT_MAX_CONCURRENT_SESSIONS = 10;
export const DEFAULT_SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
export const DEFAULT_CHECKPOINT_INTERVAL_MS = 60 * 1000; // 1 minute
export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_RETRY_DELAY_MS = 5000; // 5 seconds

// Processing Constants
export const PROCESSING_LIMITS = {
  MAX_STEPS_PER_SESSION: 100,
  MAX_STEP_CONTENT_LENGTH: 1000,
  MAX_METADATA_SIZE: 10000, // bytes
  MAX_CONCURRENT_SESSIONS: 50
} as const;

// Event Constants
export const EVENT_PRIORITIES = {
  SESSION_CREATED: 1,
  STEP_STARTED: 2,
  STEP_COMPLETED: 2,
  STEP_FAILED: 3,
  SESSION_DESTROYED: 1
} as const;
