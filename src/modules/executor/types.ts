/**
 * Executor Module Type Definitions
 * All types required for the executor module implementation
 */

import { Browser, Page } from 'playwright';

// Core shared types now defined locally
export enum SessionStatus {
  INITIALIZING = 'initializing',
  ACTIVE = 'active',
  IDLE = 'idle',
  PAUSED = 'paused',
  CLEANUP = 'cleanup',
  ERROR = 'error'
}

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export enum CommandAction {
  OPEN_PAGE = 'OPEN_PAGE',
  CLICK_ELEMENT = 'CLICK_ELEMENT',
  INPUT_TEXT = 'INPUT_TEXT',
  SAVE_VARIABLE = 'SAVE_VARIABLE',
  GET_DOM = 'GET_DOM',
  GET_CONTENT = 'GET_CONTENT',
  GET_SUBDOM = 'GET_SUBDOM'
}

export enum ErrorCategory {
  VALIDATION = 'validation',
  EXECUTION = 'execution',
  SYSTEM = 'system',
  INTEGRATION = 'integration',
  NETWORK = 'network',
  TIMEOUT = 'timeout'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export const ERROR_CODES = {
  EXECUTOR: {
    'SESSION_NOT_FOUND': 'EXEC_SESSION_NOT_FOUND',
    'SESSION_ALREADY_EXISTS': 'EXEC_SESSION_ALREADY_EXISTS',
    'MAX_SESSIONS_EXCEEDED': 'EXEC_MAX_SESSIONS_EXCEEDED',
    'BROWSER_LAUNCH_FAILED': 'EXEC_BROWSER_LAUNCH_FAILED',
    'PAGE_LOAD_TIMEOUT': 'EXEC_PAGE_LOAD_TIMEOUT',
    'SELECTOR_NOT_FOUND': 'EXEC_SELECTOR_NOT_FOUND',
    'ELEMENT_NOT_INTERACTABLE': 'EXEC_ELEMENT_NOT_INTERACTABLE',
    'INVALID_COMMAND': 'EXEC_INVALID_COMMAND',
    'SCREENSHOT_FAILED': 'EXEC_SCREENSHOT_FAILED',
    'COMMAND_EXECUTION_FAILED': 'EXEC_COMMAND_EXECUTION_FAILED',
    'DOM_CAPTURE_FAILED': 'EXEC_DOM_CAPTURE_FAILED',
    'SUBDOM_SIZE_EXCEEDED': 'EXEC_SUBDOM_SIZE_EXCEEDED',
    'VARIABLE_RESOLUTION_DEPTH_EXCEEDED': 'EXEC_VARIABLE_RESOLUTION_DEPTH_EXCEEDED',
    'INVALID_VARIABLE_NAME': 'EXEC_INVALID_VARIABLE_NAME',
    'SCREENSHOT_DIRECTORY_ERROR': 'EXEC_SCREENSHOT_DIRECTORY_ERROR',
    'WRAPPED_ERROR': 'EXEC_WRAPPED_ERROR',
    'SESSION_LIMIT_EXCEEDED': 'EXEC_SESSION_LIMIT_EXCEEDED'
  }
};

// Standard Error Interface
export interface StandardError {
  id: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  code: string;
  message: string;
  details?: Record<string, any>;
  cause?: StandardError;
  timestamp: Date;
  moduleId: string;
  recoverable: boolean;
  retryable: boolean;
  suggestedAction: string;
}

// Command Parameters Interface
export interface CommandParameters {
  url?: string;
  selector?: string;
  text?: string;
  variableName?: string;
  attribute?: string;
  multiple?: boolean;
  maxDomSize?: number;
}

// Session Management Types
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
  timeout?: number;
  retries?: number;
  metadata?: Record<string, any>;
}

export interface SessionLifecycleCallbacks {
  onSessionCreated?: (moduleId: string, workflowSessionId: string, sessionId: string) => Promise<void>;
  onSessionDestroyed?: (moduleId: string, workflowSessionId: string) => Promise<void>;
  onSessionStatusChanged?: (moduleId: string, workflowSessionId: string, oldStatus: SessionStatus, newStatus: SessionStatus) => Promise<void>;
  onSessionError?: (moduleId: string, workflowSessionId: string, error: any) => Promise<void>;
}

export interface SessionManagerHealth {
  moduleId: string;
  isHealthy: boolean;
  activeSessions: number;
  totalSessions: number;
  errors: any[];
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

// Configuration Types
export interface TimeoutConfig {
  command: number;
  session: number;
  health: number;
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

export interface BaseModuleConfig {
  moduleId: string;
  version: string;
  enabled: boolean;
  timeouts: TimeoutConfig;
  logging: LoggingConfig;
  performance: PerformanceConfig;
}

export const DEFAULT_TIMEOUT_CONFIG: TimeoutConfig = {
  command: 30000,
  session: 1800000,
  health: 5000
};

// Executor Session extends ModuleSessionInfo
export interface ExecutorSession extends ModuleSessionInfo {
  moduleId: 'executor';
  browser: Browser;
  page: Page;
  variables: Map<string, string>;
  // Inherits: sessionId, linkedWorkflowSessionId, status, createdAt, lastActivity, metadata
}

export interface IExecutorSessionManager extends ISessionManager {
  readonly moduleId: 'executor';
  
  // Standardized session management (inherited)
  createSession(workflowSessionId: string, config?: ModuleSessionConfig): Promise<string>;
  destroySession(workflowSessionId: string): Promise<void>;
  getSession(workflowSessionId: string): ModuleSessionInfo | null;
  sessionExists(workflowSessionId: string): boolean;
  
  // Executor-specific session access
  getExecutorSession(workflowSessionId: string): ExecutorSession | null;
  listActiveSessions(): string[];
}

// Command System Types
export interface ExecutorCommand {
  sessionId: string;
  action: CommandAction;
  parameters: CommandParameters;
  commandId: string;
  timestamp: Date;
}

export interface CommandResponse {
  success: boolean;
  commandId: string;
  dom: string;
  screenshotId: string;
  duration: number;
  error?: StandardError;
  metadata?: Record<string, any>;
}

// Screenshot Configuration
export interface ScreenshotConfig {
  enabled: boolean;
  directory: string;
  format: 'png' | 'jpeg';
  quality?: number;
  fullPage: boolean;
  nameTemplate: string;
  cleanup: ScreenshotCleanupConfig;
}

export interface ScreenshotCleanupConfig {
  enabled: boolean;
  maxAge: number;
  maxCount: number;
  schedule: 'immediate' | 'daily' | 'weekly';
}

export interface ScreenshotInfo {
  id: string;
  sessionId: string;
  fileName: string;
  filePath: string;
  actionType: CommandAction;
  timestamp: Date;
  fileSize: number;
  format: 'png' | 'jpeg';
  dimensions: {
    width: number;
    height: number;
  };
  metadata?: Record<string, any>;
}

export interface CleanupResult {
  deletedCount: number;
  freedSpace: number;
  errors: string[];
  duration: number;
}

// Configuration extends BaseModuleConfig
export interface ExecutorConfig extends BaseModuleConfig {
  moduleId: 'executor';
  browser: {
    type: 'chromium' | 'firefox' | 'webkit';
    headless: boolean;
    sessionTTL: number;
    maxSessions: number;
  };
  screenshots: ScreenshotConfig;
}

// Default configuration
export const DEFAULT_EXECUTOR_CONFIG: ExecutorConfig = {
  moduleId: 'executor',
  version: '1.0.0',
  enabled: true,
  
  browser: {
    type: 'chromium',
    headless: true,
    sessionTTL: 1800000, // 30 minutes
    maxSessions: 10
  },
  
  screenshots: {
    enabled: true,
    directory: './screenshots',
    format: 'png',
    fullPage: true,
    nameTemplate: '{sessionId}_{timestamp}_{actionType}_{uuid}',
    cleanup: {
      enabled: true,
      maxAge: 86400000, // 24 hours
      maxCount: 100,
      schedule: 'daily'
    }
  },
  
  timeouts: DEFAULT_TIMEOUT_CONFIG,
  
  logging: {
    level: LogLevel.INFO,
    prefix: '[Executor]',
    includeTimestamp: true,
    includeSessionId: true,
    includeModuleId: true,
    structured: false
  },
  
  performance: {
    maxConcurrentOperations: 10,
    cacheEnabled: false,
    cacheTTLMs: 0,
    metricsEnabled: true
  }
};

// Logging
export interface LogEntry {
  level: LogLevel;
  message: string;
  sessionId?: string;
  timestamp: Date;
  context?: Record<string, any>;
}

// Interfaces
export interface IScreenshotManager {
  captureScreenshot(sessionId: string, actionType: CommandAction, page: any, metadata?: Record<string, any>): Promise<string>;
  getScreenshot(screenshotId: string): Promise<ScreenshotInfo | null>;
  getScreenshotPath(screenshotId: string): Promise<string | null>;
  listScreenshots(sessionId: string): Promise<ScreenshotInfo[]>;
  deleteScreenshot(screenshotId: string): Promise<void>;
  cleanupScreenshots(sessionId?: string): Promise<CleanupResult>;
  validateScreenshotDirectory(): Promise<boolean>;
  updateConfig(config: ScreenshotConfig): void;
  getStatistics(): { totalScreenshots: number; totalSessions: number; totalFileSize: number; averageFileSize: number; oldestScreenshot?: Date; newestScreenshot?: Date; };
}

export interface IVariableResolver {
  resolve(sessionId: string, input: string): string;
  setVariable(sessionId: string, name: string, value: string): void;
  getVariable(sessionId: string, name: string): string | null;
  listVariables(sessionId: string): Record<string, string>;
  getStatistics(): { totalSessions: number; totalVariables: number; averageVariablesPerSession: number; sessionsWithVariables: number; };
}

export interface IExecutorLogger {
  debug(message: string, sessionId?: string, context?: Record<string, any>): void;
  info(message: string, sessionId?: string, context?: Record<string, any>): void;
  warn(message: string, sessionId?: string, context?: Record<string, any>): void;
  error(message: string, sessionId?: string, context?: Record<string, any>): void;
  getEntries(level?: LogLevel, sessionId?: string): LogEntry[];
  logSessionEvent(sessionId: string, event: string, details?: Record<string, any>): void;
  logCommandExecution(sessionId: string, action: string, duration: number, success: boolean, details?: Record<string, any>): void;
  logVariableInterpolation(sessionId: string, original: string, resolved: string, context?: Record<string, any>): void;
  logScreenshotCapture(sessionId: string, screenshotId: string, actionType: string, success: boolean, details?: Record<string, any>): void;
  getLogStats(): { total: number; byLevel: Record<string, number>; bySessions: number; };
  setLogLevel(level: LogLevel): void;
}

// Command Processor Interface
export interface ICommandProcessor {
  executeCommand(session: ExecutorSession, command: ExecutorCommand): Promise<CommandResponse>;
  openPage(session: ExecutorSession, url: string, commandId: string): Promise<CommandResponse>;
  clickElement(session: ExecutorSession, selector: string, commandId: string): Promise<CommandResponse>;
  inputText(session: ExecutorSession, selector: string, text: string, commandId: string): Promise<CommandResponse>;
  saveVariable(session: ExecutorSession, selector: string, variableName: string, commandId: string): Promise<CommandResponse>;
  getCurrentDOM(session: ExecutorSession, commandId: string): Promise<CommandResponse>;
  getContent(session: ExecutorSession, selector: string, attribute?: string, multiple?: boolean, commandId?: string): Promise<CommandResponse>;
  getSubDOM(session: ExecutorSession, selector: string, maxDomSize?: number, commandId?: string): Promise<CommandResponse>;
}
