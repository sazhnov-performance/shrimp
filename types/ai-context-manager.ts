/**
 * AI Context Manager Module Type Definitions
 * Defines all interfaces and types for session context management and execution tracking
 * STANDARDIZED: Uses shared session management interfaces
 */

// Import session management types from step-processor (following existing pattern)
import { 
  ProcessingStatus as SessionStatus,
  SessionStatus as SessionInfo,
  ExecutionProgress
} from './step-processor';

// Define interfaces that would be in shared-types but currently don't exist
interface ISessionManager {
  readonly moduleId: string;
  createSession(workflowSessionId: string, config?: ModuleSessionConfig): Promise<string>;
  destroySession(workflowSessionId: string): Promise<void>;
  getSession(workflowSessionId: string): ModuleSessionInfo | null;
  sessionExists(workflowSessionId: string): boolean;
  updateSessionStatus(workflowSessionId: string, status: SessionStatus): Promise<void>;
  getSessionStatus(workflowSessionId: string): SessionStatus | null;
  recordActivity(workflowSessionId: string): Promise<void>;
  getLastActivity(workflowSessionId: string): Date | null;
  setLifecycleCallbacks(callbacks: SessionLifecycleCallbacks): void;
  healthCheck(): Promise<SessionManagerHealth>;
}

interface ModuleSessionInfo {
  moduleId: string;
  sessionId: string;
  linkedWorkflowSessionId: string;
  status: SessionStatus;
  createdAt: Date;
  lastActivity: Date;
  metadata?: Record<string, any>;
}

interface SessionLifecycleCallbacks {
  onSessionCreated?(moduleId: string, workflowSessionId: string, moduleSessionId: string): Promise<void>;
  onSessionStatusChanged?(moduleId: string, workflowSessionId: string, oldStatus: SessionStatus, newStatus: SessionStatus): Promise<void>;
  onSessionDestroyed?(moduleId: string, workflowSessionId: string): Promise<void>;
  onSessionError?(moduleId: string, workflowSessionId: string, error: any): Promise<void>;
}

interface ModuleSessionConfig {
  timeoutMs?: number;
  retryAttempts?: number;
  metadata?: Record<string, any>;
}

interface SessionManagerHealth {
  moduleId: string;
  isHealthy: boolean;
  activeSessions: number;
  totalSessions: number;
  errors: any[];
  lastHealthCheck: Date;
}

// STANDARDIZED: AI Context Session extends ModuleSessionInfo
export interface AIContextSession extends ModuleSessionInfo {
  moduleId: 'ai-context-manager';
  steps: string[];
  stepExecutions: StepExecution[];
  executorSessionId: string;      // Link to executor browser session
  // Inherits: sessionId, linkedWorkflowSessionId, status, createdAt, lastActivity, metadata
}

// Step Execution Types
export enum ExecutionStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED'
}

export interface StepExecution {
  stepIndex: number;
  stepName: string;
  events: ExecutionEvent[];
  startTime: Date;
  endTime?: Date;
  status: ExecutionStatus;
  metadata?: Record<string, any>;
}

export interface ExecutionEvent {
  timestamp: Date;
  reasoning: string;
  executorMethod: string;
  pageDom: string;
  eventId: string;
  screenshotId?: string;
  metadata?: Record<string, any>;
}

// Context Generation Types
export interface AIContextJson {
  sessionId: string;
  targetStep: number;
  generatedAt: Date;
  
  // Historical data from start to target step
  executionFlow: ExecutionFlowItem[];
  
  // Page DOM states
  previousPageDom?: string;  // DOM from step (targetStep - 1)
  currentPageDom?: string;   // DOM from targetStep
  
  // Summary information
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  
  // Additional context
  sessionMetadata?: Record<string, any>;
}

export interface ExecutionFlowItem {
  stepIndex: number;
  stepName: string;
  reasoning: string;
  executorMethod: string;
  timestamp: Date;
  status: ExecutionStatus;
  eventId: string;
  screenshotId?: string;
}

// STANDARDIZED: Core Interface for AI Context Manager (extends ISessionManager)
export interface IAIContextManager extends ISessionManager {
  readonly moduleId: 'ai-context-manager';
  
  // Standardized Session Management (inherited from ISessionManager)
  createSession(workflowSessionId: string, config?: ModuleSessionConfig): Promise<string>;
  destroySession(workflowSessionId: string): Promise<void>;
  getSession(workflowSessionId: string): ModuleSessionInfo | null;
  sessionExists(workflowSessionId: string): boolean;
  updateSessionStatus(workflowSessionId: string, status: SessionStatus): Promise<void>;
  getSessionStatus(workflowSessionId: string): SessionStatus | null;
  recordActivity(workflowSessionId: string): Promise<void>;
  getLastActivity(workflowSessionId: string): Date | null;
  setLifecycleCallbacks(callbacks: SessionLifecycleCallbacks): void;
  healthCheck(): Promise<SessionManagerHealth>;
  
  // AI Context Specific Methods (use workflowSessionId consistently)
  createAIContextSession(workflowSessionId: string, config?: AIContextConfig): Promise<string>;
  linkExecutorSession(workflowSessionId: string, executorSessionId: string): Promise<void>;
  
  // Step Management
  setSteps(workflowSessionId: string, steps: string[]): Promise<void>;
  getSteps(workflowSessionId: string): string[] | null;
  updateStep(workflowSessionId: string, stepIndex: number, stepName: string): Promise<void>;
  
  // Step Execution Tracking
  addStepExecution(workflowSessionId: string, stepExecution: StepExecution): Promise<void>;
  updateStepExecution(workflowSessionId: string, stepIndex: number, updates: Partial<StepExecution>): Promise<void>;
  getStepExecution(workflowSessionId: string, stepIndex: number): StepExecution | null;
  markStepCompleted(workflowSessionId: string, stepIndex: number): Promise<void>;
  markStepFailed(workflowSessionId: string, stepIndex: number, error?: string): Promise<void>;
  
  // Event Management
  addExecutionEvent(workflowSessionId: string, stepIndex: number, event: Omit<ExecutionEvent, 'eventId'>, screenshotId?: string): Promise<string>;
  getExecutionEvents(workflowSessionId: string, stepIndex: number): ExecutionEvent[];
  getLatestEvent(workflowSessionId: string, stepIndex: number): ExecutionEvent | null;
  
  // Context Generation
  generateContextJson(workflowSessionId: string, targetStep: number): Promise<AIContextJson>;
  generateFullContext(workflowSessionId: string): Promise<AIContextJson>;
  
  // Query Methods
  getSessionContext(workflowSessionId: string): AIContextSession | null;
  getExecutionHistory(workflowSessionId: string): StepExecution[];
  getSessionSummary(workflowSessionId: string): SessionSummary | null;
}

// Storage Adapter Interface
export interface IContextStorageAdapter {
  saveSession(session: AIContextSession): Promise<void>;
  loadSession(sessionId: string): Promise<AIContextSession | null>;
  deleteSession(sessionId: string): Promise<void>;
  listSessions(): Promise<string[]>;
  updateSession(sessionId: string, updates: Partial<AIContextSession>): Promise<void>;
}

// Configuration Types
export interface AIContextConfig {
  storageAdapter: 'memory' | 'filesystem' | 'database';
  maxSessionsInMemory: number;
  sessionTTL: number; // Time-to-live in milliseconds
  maxStepsPerSession: number;
  maxEventsPerStep: number;
  compressionEnabled: boolean;
  compressionThreshold: number; // DOM size in bytes
  exportFormats: ('json' | 'xml' | 'yaml')[];
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  autoCleanup: boolean;
  backupEnabled: boolean;
}

// Advanced Querying Types
export interface ContextQuery {
  sessionId: string;
  stepRange?: [number, number];
  eventTypes?: string[];
  timeRange?: [Date, Date];
  includePageDom?: boolean;
  statusFilter?: ExecutionStatus[];
  reasoningFilter?: string; // Text search in reasoning
}

export interface IAdvancedQuerying {
  queryContext(query: ContextQuery): Promise<QueryResult>;
  searchReasonings(sessionId: string, searchTerm: string): Promise<ExecutionEvent[]>;
  getExecutionMetrics(sessionId: string): Promise<ExecutionMetrics>;
  getStepPerformance(sessionId: string): Promise<StepPerformanceMetrics[]>;
}

export interface QueryResult {
  sessionId: string;
  matchedSteps: StepExecution[];
  matchedEvents: ExecutionEvent[];
  totalMatches: number;
  queryTime: number;
}

// Metrics and Analytics Types
export interface SessionSummary {
  sessionId: string;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  pendingSteps: number;
  totalEvents: number;
  averageStepDuration: number;
  sessionDuration: number;
  lastActivity: Date;
  status: SessionStatus;
}

export interface ExecutionMetrics {
  sessionId: string;
  totalExecutionTime: number;
  averageStepTime: number;
  fastestStep: StepPerformance;
  slowestStep: StepPerformance;
  errorRate: number;
  successRate: number;
  totalDomChanges: number;
}

export interface StepPerformance {
  stepIndex: number;
  stepName: string;
  duration: number;
  eventCount: number;
  status: ExecutionStatus;
}

export interface StepPerformanceMetrics {
  stepIndex: number;
  stepName: string;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  totalExecutions: number;
  successRate: number;
  commonErrors: string[];
}

// Context Compression Types
export interface ContextCompressionOptions {
  compressDom: boolean;
  maxDomSize: number;
  excludeRepeatedDom: boolean;
  summarizeReasonings: boolean;
  compressionAlgorithm: 'gzip' | 'lz4' | 'brotli';
}

export interface CompressedExecutionEvent extends Omit<ExecutionEvent, 'pageDom'> {
  pageDom: string | CompressedData;
  isCompressed: boolean;
}

export interface CompressedData {
  algorithm: string;
  originalSize: number;
  compressedSize: number;
  data: string; // Base64 encoded compressed data
}

// Export/Import Types
export interface IContextPortability {
  exportSession(sessionId: string, format: ExportFormat, options?: ExportOptions): Promise<string>;
  importSession(data: string, format: ExportFormat, options?: ImportOptions): Promise<string>;
  cloneSession(sourceSessionId: string, targetSessionId: string): Promise<void>;
}

export enum ExportFormat {
  JSON = 'json',
  XML = 'xml',
  YAML = 'yaml',
  CSV = 'csv'
}

export interface ExportOptions {
  includePageDom?: boolean;
  compressData?: boolean;
  dateFormat?: string;
  includeMetadata?: boolean;
  stepRange?: [number, number];
}

export interface ImportOptions {
  overwriteExisting?: boolean;
  validateData?: boolean;
  generateNewSessionId?: boolean;
  preserveTimestamps?: boolean;
}

// Integration Types with Executor Module
export interface ExecutorIntegration {
  onCommandExecuted(sessionId: string, stepIndex: number, event: {
    reasoning: string;
    executorMethod: string;
    pageDom: string;
    timestamp: Date;
    screenshotId?: string;
    metadata?: Record<string, any>;
  }): Promise<void>;
  
  onStepStarted(sessionId: string, stepIndex: number, stepName: string): Promise<void>;
  onStepCompleted(sessionId: string, stepIndex: number): Promise<void>;
  onStepFailed(sessionId: string, stepIndex: number, error: string): Promise<void>;
}

// Event Types for AI Context Manager
export enum AIContextEventType {
  SESSION_CREATED = 'SESSION_CREATED',
  SESSION_DESTROYED = 'SESSION_DESTROYED',
  STEPS_SET = 'STEPS_SET',
  STEP_EXECUTION_ADDED = 'STEP_EXECUTION_ADDED',
  EXECUTION_EVENT_ADDED = 'EXECUTION_EVENT_ADDED',
  CONTEXT_GENERATED = 'CONTEXT_GENERATED',
  SESSION_EXPORTED = 'SESSION_EXPORTED',
  SESSION_IMPORTED = 'SESSION_IMPORTED'
}

export interface AIContextEvent {
  type: AIContextEventType;
  sessionId: string;
  timestamp: Date;
  data?: Record<string, any>;
}

export interface IAIContextEventEmitter {
  on(event: AIContextEventType, listener: (event: AIContextEvent) => void): void;
  emit(event: AIContextEventType, data: AIContextEvent): void;
  removeListener(event: AIContextEventType, listener: Function): void;
}

// Error Types
export enum AIContextErrorType {
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  INVALID_SESSION_ID = 'INVALID_SESSION_ID',
  STEP_INDEX_OUT_OF_RANGE = 'STEP_INDEX_OUT_OF_RANGE',
  STORAGE_ERROR = 'STORAGE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  COMPRESSION_ERROR = 'COMPRESSION_ERROR',
  EXPORT_ERROR = 'EXPORT_ERROR',
  IMPORT_ERROR = 'IMPORT_ERROR'
}

export class AIContextError extends Error {
  type: AIContextErrorType;
  sessionId?: string;
  stepIndex?: number;
  details?: Record<string, any>;

  constructor(
    type: AIContextErrorType,
    message: string,
    sessionId?: string,
    stepIndex?: number,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AIContextError';
    this.type = type;
    this.sessionId = sessionId;
    this.stepIndex = stepIndex;
    this.details = details;
  }
}

// Validation Types
export interface ValidationRule {
  field: string;
  validator: (value: any) => boolean;
  message: string;
}

export interface IContextValidator {
  validateSession(session: AIContextSession): ValidationResult;
  validateStepExecution(stepExecution: StepExecution): ValidationResult;
  validateExecutionEvent(event: ExecutionEvent): ValidationResult;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}
