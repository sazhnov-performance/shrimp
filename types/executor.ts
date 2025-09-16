/**
 * Executor Module Type Definitions
 * Defines all interfaces and types for the Playwright-based automation executor
 * STANDARDIZED: Uses shared session management interfaces
 */

import { Browser, Page } from 'playwright';

// Import standardized session management types
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
  LogLevel
} from './shared-types';

// STANDARDIZED: Executor Session extends ModuleSessionInfo
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

// Command System Types (imported from shared-types)

export interface ExecutorCommand {
  sessionId: string;
  action: CommandAction;
  parameters: CommandParameters;
  commandId: string;              // For tracking consistency
  timestamp: Date;                // Execution timing
}

export interface CommandResponse {
  success: boolean;
  commandId: string;              // FIXED: Added for tracking consistency
  dom: string;                    // Full DOM of current page
  screenshotId: string;           // Unique ID of screenshot taken after action execution
  duration: number;               // FIXED: Execution time in ms for consistency
  error?: StandardError;          // FIXED: Uses shared StandardError
  metadata?: Record<string, any>; // FIXED: Added for extensibility
}

// Error Handling Types (use StandardError from shared-types)

// Logging Types (imported from shared-types)

export interface LogEntry {
  level: LogLevel;
  message: string;
  sessionId?: string;
  timestamp: Date;
  context?: Record<string, any>;
}

// Configuration Types
export interface ExecutorConfig {
  browserType: 'chromium' | 'firefox' | 'webkit';
  headless: boolean;
  timeout: number;
  sessionTTL: number; // Session time-to-live in milliseconds
  maxSessions: number;
  logLevel: LogLevel;
  viewport?: {
    width: number;
    height: number;
  };
  userAgent?: string;
  screenshots: ScreenshotConfig;
}

// Screenshot Configuration
export interface ScreenshotConfig {
  enabled: boolean;
  directory: string; // Directory to save screenshots
  format: 'png' | 'jpeg';
  quality?: number; // For JPEG format (0-100)
  fullPage: boolean; // Capture full page or just viewport
  nameTemplate: string; // Template for screenshot filename: {sessionId}_{timestamp}_{actionType}
  cleanup: ScreenshotCleanupConfig;
}

export interface ScreenshotCleanupConfig {
  enabled: boolean;
  maxAge: number; // Maximum age in milliseconds
  maxCount: number; // Maximum number of screenshots per session
  schedule: 'immediate' | 'daily' | 'weekly'; // Cleanup schedule
}

// Screenshot Management Types
export interface ScreenshotInfo {
  id: string;
  sessionId: string;
  fileName: string;
  filePath: string;
  actionType: CommandAction;
  timestamp: Date;
  fileSize: number; // Size in bytes
  format: 'png' | 'jpeg';
  dimensions: {
    width: number;
    height: number;
  };
  metadata?: Record<string, any>;
}

export interface CleanupResult {
  deletedCount: number;
  freedSpace: number; // Space freed in bytes
  errors: string[];
  duration: number; // Cleanup duration in milliseconds
}

// Screenshot Manager Interface
export interface IScreenshotManager {
  captureScreenshot(sessionId: string, actionType: CommandAction, metadata?: Record<string, any>): Promise<string>;
  getScreenshot(screenshotId: string): Promise<ScreenshotInfo | null>;
  getScreenshotPath(screenshotId: string): Promise<string | null>;
  listScreenshots(sessionId: string): Promise<ScreenshotInfo[]>;
  deleteScreenshot(screenshotId: string): Promise<void>;
  cleanupScreenshots(sessionId?: string): Promise<CleanupResult>;
  validateScreenshotDirectory(): Promise<boolean>;
}

// STANDARDIZED: Core Interface for the Executor Module (extends ISessionManager)
export interface IExecutor extends ISessionManager {
  readonly moduleId: 'executor';
  
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
  
  // Executor-specific session access
  getSessionInfo(workflowSessionId: string): ExecutorSession | null;
  
  // Command Execution (uses workflowSessionId consistently)
  executeCommand(command: ExecutorCommand): Promise<CommandResponse>;
  
  // Specific Command Methods (use workflowSessionId consistently)
  openPage(workflowSessionId: string, url: string): Promise<CommandResponse>;
  clickElement(workflowSessionId: string, selector: string): Promise<CommandResponse>;
  inputText(workflowSessionId: string, selector: string, text: string): Promise<CommandResponse>;
  saveVariable(workflowSessionId: string, selector: string, variableName: string): Promise<CommandResponse>;
  getCurrentDOM(workflowSessionId: string): Promise<CommandResponse>;
  
  // Variable Management (uses workflowSessionId consistently)
  setVariable(workflowSessionId: string, name: string, value: string): Promise<void>;
  getVariable(workflowSessionId: string, name: string): string | null;
  listVariables(workflowSessionId: string): Record<string, string>;
  
  // Utility Methods (uses workflowSessionId consistently)
  resolveVariables(workflowSessionId: string, input: string): string;
  
  // Screenshot Management (uses workflowSessionId consistently)
  getScreenshot(screenshotId: string): Promise<ScreenshotInfo | null>;
  listScreenshots(workflowSessionId: string): Promise<ScreenshotInfo[]>;
  deleteScreenshot(screenshotId: string): Promise<void>;
  cleanupScreenshots(workflowSessionId?: string): Promise<CleanupResult>;
}

// Variable Resolution Types
export interface VariableResolver {
  resolve(sessionId: string, input: string): string;
  setVariable(sessionId: string, name: string, value: string): void;
  getVariable(sessionId: string, name: string): string | null;
  listVariables(sessionId: string): Record<string, string>;
}

// Logger Interface
export interface IExecutorLogger {
  debug(message: string, sessionId?: string, context?: Record<string, any>): void;
  info(message: string, sessionId?: string, context?: Record<string, any>): void;
  warn(message: string, sessionId?: string, context?: Record<string, any>): void;
  error(message: string, sessionId?: string, context?: Record<string, any>): void;
  getEntries(level?: LogLevel, sessionId?: string): LogEntry[];
}

// Performance Monitoring Types
export interface ExecutorMetrics {
  sessionCount: number;
  commandsExecuted: number;
  averageCommandDuration: number;
  errorRate: number;
  lastError?: StandardError;
  uptime: number;
}

// Event Types for Executor
export enum ExecutorEventType {
  SESSION_CREATED = 'SESSION_CREATED',
  SESSION_DESTROYED = 'SESSION_DESTROYED',
  COMMAND_EXECUTED = 'COMMAND_EXECUTED',
  ERROR_OCCURRED = 'ERROR_OCCURRED',
  VARIABLE_SET = 'VARIABLE_SET'
}

export interface ExecutorEvent {
  type: ExecutorEventType;
  sessionId?: string;
  timestamp: Date;
  data?: Record<string, any>;
}

export interface IExecutorEventEmitter {
  on(event: ExecutorEventType, listener: (event: ExecutorEvent) => void): void;
  emit(event: ExecutorEventType, data: ExecutorEvent): void;
  removeListener(event: ExecutorEventType, listener: Function): void;
}
