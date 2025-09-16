/**
 * Shared Types and Interfaces
 * Defines shared types, interfaces, and contracts used across all modules
 * Based on design/shared-types.md specifications
 */

// Session Management Types
export enum SessionStatus {
  INITIALIZING = 'INITIALIZING',
  ACTIVE = 'ACTIVE', 
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  CLEANUP = 'CLEANUP'
}

export interface ModuleSessionInfo {
  moduleId: string;
  sessionId: string;              // Module's internal session ID
  linkedWorkflowSessionId: string; // Reference to workflow session
  status: SessionStatus;          // Uses unified status enum
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
  onSessionError?(moduleId: string, workflowSessionId: string, error: any): Promise<void>;
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

// Error Handling Types
export enum ErrorCategory {
  VALIDATION = 'VALIDATION',
  EXECUTION = 'EXECUTION',
  SYSTEM = 'SYSTEM',
  INTEGRATION = 'INTEGRATION',
  USER = 'USER'
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM', 
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

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
  suggestedAction?: string;
}

// Command and Response Types
export enum CommandAction {
  OPEN_PAGE = 'OPEN_PAGE',
  CLICK_ELEMENT = 'CLICK_ELEMENT', 
  INPUT_TEXT = 'INPUT_TEXT',
  SAVE_VARIABLE = 'SAVE_VARIABLE',
  GET_DOM = 'GET_DOM'
}

export interface CommandParameters {
  url?: string;           // For OPEN_PAGE
  selector?: string;      // For CLICK_ELEMENT, INPUT_TEXT, SAVE_VARIABLE
  text?: string;          // For INPUT_TEXT
  variableName?: string;  // For SAVE_VARIABLE
}

// AI generates commands without session IDs
export interface AIGeneratedCommand {
  action: CommandAction;
  parameters: CommandParameters;
  reasoning?: string;
  priority?: number;
}

// Executor receives commands with session IDs (injected by Task Loop)
export interface ExecutorCommand {
  sessionId: string;              // Injected by Task Loop
  action: CommandAction;
  parameters: CommandParameters;
  commandId: string;              // For tracking
  timestamp: Date;
}

export interface CommandResponse {
  success: boolean;
  commandId: string;
  dom: string;                    // Full DOM of current page
  screenshotId: string;           // Unique ID of screenshot
  duration: number;               // Execution time in ms
  error?: StandardError;
  metadata?: Record<string, any>;
}

// API Response Standards
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: APIError;
  metadata?: {
    timestamp: string;
    requestId: string;
    version: string;
    processingTimeMs: number;
  };
}

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, any>;
  retryable: boolean;
  timestamp: string;
}

// Error Codes
export const ERROR_CODES = {
  EXECUTOR: {
    BROWSER_LAUNCH_FAILED: 'EXECUTOR_BROWSER_LAUNCH_FAILED',
    SELECTOR_NOT_FOUND: 'EXECUTOR_SELECTOR_NOT_FOUND',
    ELEMENT_NOT_INTERACTABLE: 'EXECUTOR_ELEMENT_NOT_INTERACTABLE',
    PAGE_LOAD_TIMEOUT: 'EXECUTOR_PAGE_LOAD_TIMEOUT',
    SCREENSHOT_FAILED: 'EXECUTOR_SCREENSHOT_FAILED',
    SESSION_NOT_FOUND: 'EXECUTOR_SESSION_NOT_FOUND',
    INVALID_COMMAND: 'EXECUTOR_INVALID_COMMAND'
  },
  FRONTEND_API: {
    REQUEST_VALIDATION_FAILED: 'API_REQUEST_VALIDATION_FAILED',
    SESSION_NOT_FOUND: 'API_SESSION_NOT_FOUND',
    AUTHENTICATION_FAILED: 'API_AUTHENTICATION_FAILED',
    RATE_LIMIT_EXCEEDED: 'API_RATE_LIMIT_EXCEEDED'
  }
} as const;

// Version Management
export interface VersionInfo {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
}

export const SYSTEM_VERSION: VersionInfo = {
  major: 1,
  minor: 0,
  patch: 0
};
