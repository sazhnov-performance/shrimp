/**
 * Executor Module Type Definitions
 * Internal types specific to the executor module implementation
 */

import { Browser, Page } from 'playwright';
import { 
  ISessionManager,
  ModuleSessionInfo,
  SessionStatus,
  SessionLifecycleCallbacks,
  ModuleSessionConfig,
  SessionManagerHealth,
  StandardError,
  CommandAction,
  CommandParameters,
  LogLevel,
  BaseModuleConfig,
  LoggingConfig,
  PerformanceConfig,
  TimeoutConfig,
  DEFAULT_TIMEOUT_CONFIG
} from '../../../types/shared-types';

// Re-export shared types for convenience
export type {
  CommandAction,
  CommandParameters,
  StandardError,
  LogLevel,
  SessionStatus,
  ModuleSessionConfig,
  SessionLifecycleCallbacks
} from '../../../types/shared-types';

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
}
