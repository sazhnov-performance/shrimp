/**
 * Minimal Shared Types
 * Temporary file to fix build errors
 * Should be gradually replaced with local module types
 */

// Basic enums that are needed across modules
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export enum SessionStatus {
  INITIALIZING = 'INITIALIZING',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  CLEANUP = 'CLEANUP'
}

export enum ErrorCategory {
  VALIDATION = 'VALIDATION',
  EXECUTION = 'EXECUTION',
  INTEGRATION = 'INTEGRATION',
  SYSTEM = 'SYSTEM',
  USER = 'USER'
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum CommandAction {
  OPEN_PAGE = 'OPEN_PAGE',
  CLICK_ELEMENT = 'CLICK_ELEMENT',
  INPUT_TEXT = 'INPUT_TEXT',
  SAVE_VARIABLE = 'SAVE_VARIABLE',
  GET_DOM = 'GET_DOM'
}

export enum StreamEventType {
  WORKFLOW_STARTED = 'WORKFLOW_STARTED',
  WORKFLOW_PROGRESS = 'WORKFLOW_PROGRESS',
  WORKFLOW_COMPLETED = 'WORKFLOW_COMPLETED',
  WORKFLOW_FAILED = 'WORKFLOW_FAILED',
  STEP_STARTED = 'STEP_STARTED',
  STEP_COMPLETED = 'STEP_COMPLETED',
  STEP_FAILED = 'STEP_FAILED',
  AI_REASONING = 'AI_REASONING',
  COMMAND_STARTED = 'COMMAND_STARTED',
  COMMAND_COMPLETED = 'COMMAND_COMPLETED',
  COMMAND_FAILED = 'COMMAND_FAILED',
  SCREENSHOT_CAPTURED = 'SCREENSHOT_CAPTURED',
  VARIABLE_UPDATED = 'VARIABLE_UPDATED',
  PAGE_NAVIGATED = 'PAGE_NAVIGATED',
  ERROR_OCCURRED = 'ERROR_OCCURRED',
  WARNING_ISSUED = 'WARNING_ISSUED',
  INVESTIGATION_STARTED = 'INVESTIGATION_STARTED',
  INVESTIGATION_COMPLETED = 'INVESTIGATION_COMPLETED',
  ELEMENT_DISCOVERED = 'ELEMENT_DISCOVERED'
}

export enum CommandStatus {
  QUEUED = 'QUEUED',
  EXECUTING = 'EXECUTING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

// Basic interfaces
export interface StandardError {
  id: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  code: string;
  message: string;
  details?: Record<string, any>;
  cause?: StandardError;
  timestamp: Date;
  sessionId?: string;
  stepIndex?: number;
  commandId?: string;
  moduleId?: string;
  recoverable: boolean;
  retryable: boolean;
  suggestedAction?: string;
}

export interface ModuleSessionInfo {
  moduleId: string;
  sessionId: string;
  linkedWorkflowSessionId: string;
  status: SessionStatus;
  createdAt: Date;
  lastActivity: Date;
  metadata?: Record<string, any>;
}

export interface ModuleSessionConfig {
  timeoutMs?: number;
  retryAttempts?: number;
  metadata?: Record<string, any>;
}

export interface SessionLifecycleCallbacks {
  onSessionCreated?(moduleId: string, workflowSessionId: string, moduleSessionId: string): Promise<void>;
  onSessionStatusChanged?(moduleId: string, workflowSessionId: string, oldStatus: SessionStatus, newStatus: SessionStatus): Promise<void>;
  onSessionDestroyed?(moduleId: string, workflowSessionId: string): Promise<void>;
  onSessionError?(moduleId: string, workflowSessionId: string, error: StandardError): Promise<void>;
}

export interface SessionManagerHealth {
  moduleId: string;
  isHealthy: boolean;
  activeSessions: number;
  totalSessions: number;
  errors: StandardError[];
  lastHealthCheck: Date;
}

export interface ISessionManager {
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

export interface CommandParameters {
  url?: string;
  selector?: string;
  text?: string;
  variableName?: string;
}

export interface ScreenshotInfo {
  id: string;
  sessionId: string;
  stepIndex?: number;
  commandId?: string;
  actionType: string;
  timestamp: Date;
  filePath: string;
  thumbnailPath?: string;
  dimensions: { width: number; height: number };
  fileSize: number;
  metadata?: Record<string, any>;
}

export interface VariableInfo {
  name: string;
  value: string;
  previousValue?: string;
  timestamp: Date;
  sessionId: string;
  stepIndex?: number;
  source: 'user_input' | 'extracted' | 'computed';
}

// Stream Event interfaces (simplified for backend compatibility)
export interface StreamEventData {
  message?: string;
  reasoning?: {
    thought: string;
    confidence: number;
    reasoningType: 'analysis' | 'decision' | 'plan' | 'reflection';
    context?: Record<string, any>;
  };
  command?: {
    commandId: string;
    action: CommandAction;
    parameters: CommandParameters;
    status: CommandStatus;
    duration?: number;
    result?: any;
  };
  step?: {
    stepIndex: number;
    stepContent: string;
    status: string;
    progress?: number;
    result?: any;
  };
  screenshot?: ScreenshotInfo;
  variable?: VariableInfo;
  page?: {
    url: string;
    title: string;
    timestamp: Date;
    sessionId: string;
    stepIndex?: number;
    loadTime?: number;
    metadata?: Record<string, any>;
  };
  error?: StandardError;
  warning?: {
    id: string;
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: Date;
    sessionId?: string;
    stepIndex?: number;
  };
  details?: Record<string, any>;
}

export interface StreamEvent {
  id: string;
  type: StreamEventType;
  timestamp: Date;
  sessionId: string;
  stepIndex?: number;
  data: StreamEventData;
  metadata?: Record<string, any>;
}

// Basic configuration interfaces
export interface BaseModuleConfig {
  moduleId: string;
  version: string;
  enabled: boolean;
  logging: LoggingConfig;
  performance: PerformanceConfig;
  timeouts: TimeoutConfig;
}

export interface LoggingConfig {
  level: LogLevel;
  prefix: string;
  includeTimestamp: boolean;
  includeSessionId: boolean;
  includeModuleId: boolean;
  structured: boolean;
}

export interface PerformanceConfig {
  maxConcurrentOperations: number;
  cacheEnabled: boolean;
  cacheTTLMs: number;
  metricsEnabled: boolean;
}

export interface TimeoutConfig {
  workflowTimeoutMs: number;
  stepTimeoutMs: number;
  requestTimeoutMs: number;
  connectionTimeoutMs: number;
  defaultOperationTimeoutMs: number;
  maxRetryAttempts: number;
  retryDelayMs: number;
  exponentialBackoff: boolean;
}

export const DEFAULT_TIMEOUT_CONFIG: TimeoutConfig = {
  workflowTimeoutMs: 1800000,      // 30 minutes
  stepTimeoutMs: 300000,           // 5 minutes
  requestTimeoutMs: 30000,         // 30 seconds
  connectionTimeoutMs: 10000,      // 10 seconds
  defaultOperationTimeoutMs: 30000,
  maxRetryAttempts: 3,
  retryDelayMs: 1000,
  exponentialBackoff: true
};

// Error codes
export const ERROR_CODES = {
  EXECUTOR: {
    BROWSER_LAUNCH_FAILED: 'EX001',
    SELECTOR_NOT_FOUND: 'EX002',
    ELEMENT_NOT_INTERACTABLE: 'EX003',
    PAGE_LOAD_TIMEOUT: 'EX004',
    SCREENSHOT_FAILED: 'EX005'
  }
} as const;

// System version
export const SYSTEM_VERSION = {
  major: 1,
  minor: 0,
  patch: 0
};
