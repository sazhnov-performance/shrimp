/**
 * Shared Types and Interfaces
 * Defines shared types, interfaces, and contracts used across all modules
 * Based on design/shared-types.md specifications
 */

// Session Management Types
export enum SessionStatus {
  INITIALIZING = 'INITIALIZING',
  ACTIVE = 'ACTIVE', 
  BUSY = 'BUSY',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  CLEANUP = 'CLEANUP'
}

// Primary session identifier for the entire workflow
export interface WorkflowSession {
  sessionId: string;              // Primary session ID (UUID)
  executorSessionId: string;      // Executor browser session ID  
  streamId?: string;              // Streaming session ID (optional)
  aiConnectionId: string;         // AI integration connection ID
  createdAt: Date;
  lastActivity: Date;
  status: SessionStatus;
  metadata?: Record<string, any>;
}

// Workflow configuration for session creation
export interface WorkflowConfig {
  aiConnectionId?: string;          // Override default AI connection
  browserType?: 'chromium' | 'firefox' | 'webkit';
  enableStreaming?: boolean;
  streamConfig?: StreamProcessingConfig;
  executorConfig?: ExecutorProcessingConfig;
  aiConfig?: AIProcessingConfig;
  maxExecutionTime?: number;
  metadata?: Record<string, any>;
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

// Session creation coordinator - ensures all related sessions are created
export interface SessionCoordinator {
  // Workflow Session Management
  createWorkflowSession(steps: string[], config?: WorkflowConfig): Promise<WorkflowSession>;
  destroyWorkflowSession(sessionId: string): Promise<void>;
  getWorkflowSession(sessionId: string): WorkflowSession | null;
  listActiveWorkflowSessions(): string[];
  
  // Module Registration
  registerModule(moduleId: string, sessionManager: ISessionManager): void;
  unregisterModule(moduleId: string): void;
  getModuleSessionManager(moduleId: string): ISessionManager | null;
  
  // Cross-Module Coordination
  linkModuleSession(workflowSessionId: string, moduleId: string, moduleSessionId: string): Promise<void>;
  unlinkModuleSession(workflowSessionId: string, moduleId: string): Promise<void>;
  getLinkedSessions(workflowSessionId: string): Record<string, string>; // moduleId -> moduleSessionId
  
  // Lifecycle Events
  onWorkflowSessionCreated(callback: WorkflowSessionCallback): void;
  onWorkflowSessionDestroyed(callback: WorkflowSessionCallback): void;
  onModuleSessionLinked(callback: ModuleSessionLinkCallback): void;
  
  // Health and Monitoring
  getCoordinatorHealth(): Promise<CoordinatorHealth>;
  validateSessionIntegrity(sessionId: string): Promise<SessionIntegrityReport>;
}

export interface WorkflowSessionCallback {
  (session: WorkflowSession): Promise<void>;
}

export interface ModuleSessionLinkCallback {
  (workflowSessionId: string, moduleId: string, moduleSessionId: string): Promise<void>;
}

export interface CoordinatorHealth {
  totalWorkflowSessions: number;
  activeWorkflowSessions: number;
  registeredModules: string[];
  moduleHealthStatus: Record<string, boolean>;
  lastHealthCheck: Date;
}

export interface SessionIntegrityReport {
  workflowSessionId: string;
  isValid: boolean;
  linkedModules: string[];
  missingLinks: string[];
  orphanedSessions: Record<string, string>;
  inconsistentStatuses: Record<string, SessionStatus>;
  recommendations: string[];
}

// Logging Types
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
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

export interface StandardWarning {
  id: string;
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
  sessionId?: string;
  stepIndex?: number;
}

// Command and Response Types
export enum CommandAction {
  OPEN_PAGE = 'OPEN_PAGE',
  CLICK_ELEMENT = 'CLICK_ELEMENT', 
  INPUT_TEXT = 'INPUT_TEXT',
  SAVE_VARIABLE = 'SAVE_VARIABLE',
  GET_DOM = 'GET_DOM',
  GET_CONTENT = 'GET_CONTENT',
  GET_SUBDOM = 'GET_SUBDOM'
}

export interface CommandParameters {
  url?: string;           // For OPEN_PAGE
  selector?: string;      // For CLICK_ELEMENT, INPUT_TEXT, SAVE_VARIABLE, GET_CONTENT, GET_SUBDOM
  text?: string;          // For INPUT_TEXT
  variableName?: string;  // For SAVE_VARIABLE
  attribute?: string;     // For GET_CONTENT - which attribute to extract (default: textContent)
  multiple?: boolean;     // For GET_CONTENT - return array of values from all matching elements
  maxDomSize?: number;    // For GET_SUBDOM - maximum size of returned DOM in characters (default: 100000)
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

// AI Response Schema
export interface AIResponse {
  decision: {
    action: DecisionAction;
    message: string;
    resultValidation?: ResultValidation;
  };
  reasoning: {
    analysis: string;
    rationale: string;
    expectedOutcome: string;
    confidence: number;            // 0-1
    alternatives?: string;
  };
  commands: AIGeneratedCommand[];  // Array of commands
  context?: Record<string, any>;
}

export enum DecisionAction {
  PROCEED = 'PROCEED',
  RETRY = 'RETRY', 
  ABORT = 'ABORT'
}

export interface ResultValidation {
  success: boolean;
  expectedElements: string[];
  actualState: string;
  issues?: string[];
}

// Step Processing Types
export interface StepProcessingRequest {
  steps: string[];
  config: ProcessingConfig;
  metadata?: Record<string, any>;
}

export interface ProcessingConfig {
  maxExecutionTime: number;       // milliseconds
  enableStreaming: boolean;
  enableReflection: boolean;
  retryOnFailure: boolean;
  maxRetries: number;
  parallelExecution: boolean;
  aiConfig: AIProcessingConfig;
  executorConfig: ExecutorProcessingConfig;
  streamConfig?: StreamProcessingConfig;
}

export interface AIProcessingConfig {
  connectionId: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
}

export interface ExecutorProcessingConfig {
  browserType: 'chromium' | 'firefox' | 'webkit';
  headless: boolean;
  timeoutMs: number;
  screenshotsEnabled: boolean;
}

export interface StreamProcessingConfig {
  bufferSize: number;
  maxHistorySize: number;
  compressionEnabled: boolean;
}

export interface StepProcessingResult {
  sessionId: string;
  streamId?: string;
  initialStatus: SessionStatus;
  estimatedDuration?: number;
  createdAt: Date;
}

export interface StepResult {
  stepIndex: number;
  success: boolean;
  executedCommands: ExecutorCommand[];
  commandResults: CommandResponse[];
  aiReasoning: string;
  duration: number;
  error?: StandardError;
  finalPageState: {
    dom: string;
    screenshotId: string;
    url: string;
  };
}

// Streaming and Events
export enum StreamEventType {
  // Workflow events (owned by Step Processor)
  WORKFLOW_STARTED = 'WORKFLOW_STARTED',
  WORKFLOW_PROGRESS = 'WORKFLOW_PROGRESS',
  WORKFLOW_COMPLETED = 'WORKFLOW_COMPLETED',
  WORKFLOW_FAILED = 'WORKFLOW_FAILED',
  WORKFLOW_PAUSED = 'WORKFLOW_PAUSED',
  WORKFLOW_RESUMED = 'WORKFLOW_RESUMED',
  
  // Step events (owned by Step Processor)
  STEP_STARTED = 'STEP_STARTED',
  STEP_COMPLETED = 'STEP_COMPLETED',
  STEP_FAILED = 'STEP_FAILED',
  
  // Investigation events (owned by Task Loop)
  INVESTIGATION_STARTED = 'INVESTIGATION_STARTED',
  INVESTIGATION_PHASE_STARTED = 'INVESTIGATION_PHASE_STARTED',
  INVESTIGATION_PHASE_COMPLETED = 'INVESTIGATION_PHASE_COMPLETED',
  INVESTIGATION_TOOL_STARTED = 'INVESTIGATION_TOOL_STARTED',
  INVESTIGATION_TOOL_COMPLETED = 'INVESTIGATION_TOOL_COMPLETED',
  INVESTIGATION_COMPLETED = 'INVESTIGATION_COMPLETED',
  INVESTIGATION_FAILED = 'INVESTIGATION_FAILED',
  ELEMENT_DISCOVERED = 'ELEMENT_DISCOVERED',
  WORKING_MEMORY_UPDATED = 'WORKING_MEMORY_UPDATED',
  
  // AI events (owned by AI Integration/Task Loop)
  AI_REASONING = 'AI_REASONING',
  AI_RESPONSE_RECEIVED = 'AI_RESPONSE_RECEIVED',
  
  // Command events (owned by Task Loop - not Executor directly)
  COMMAND_STARTED = 'COMMAND_STARTED',
  COMMAND_COMPLETED = 'COMMAND_COMPLETED', 
  COMMAND_FAILED = 'COMMAND_FAILED',
  
  // Resource events (owned by Executor)
  SCREENSHOT_CAPTURED = 'SCREENSHOT_CAPTURED',
  VARIABLE_UPDATED = 'VARIABLE_UPDATED',
  PAGE_NAVIGATED = 'PAGE_NAVIGATED',
  
  // System events (owned by Executor Streamer)
  SESSION_STATUS = 'SESSION_STATUS',
  ERROR_OCCURRED = 'ERROR_OCCURRED',
  WARNING_ISSUED = 'WARNING_ISSUED'
}

export interface StreamEvent {
  id: string;                     // Unique event ID
  type: StreamEventType;
  timestamp: Date;
  sessionId: string;
  stepIndex?: number;
  data: StreamEventData;
  metadata?: Record<string, any>;
}

export interface StreamEventData {
  // AI reasoning data
  reasoning?: {
    thought: string;
    confidence: number;
    reasoningType: 'analysis' | 'decision' | 'plan' | 'reflection';
    context?: Record<string, any>;
  };
  
  // Command execution data
  command?: {
    commandId: string;
    action: CommandAction;
    parameters: CommandParameters;
    status: CommandStatus;
    duration?: number;
    result?: CommandResponse;
  };
  
  // Step execution data
  step?: {
    stepIndex: number;
    stepContent: string;
    status: StepStatus;
    progress?: number;
    result?: StepResult;
  };
  
  // Investigation data (NEW)
  investigation?: {
    investigationId?: string;
    phase: 'initial_assessment' | 'focused_exploration' | 'selector_determination';
    toolsUsed: string[];
    elementsDiscovered: number;
    confidence: number;
    duration?: number;
    readyForAction?: boolean;
  };
  
  // Investigation tool data (NEW)
  investigationTool?: {
    tool: 'screenshot_analysis' | 'text_extraction' | 'full_dom_retrieval' | 'sub_dom_extraction';
    success: boolean;
    confidence: number;
    duration: number;
    elementsFound?: number;
    summary?: string;
  };
  
  // Element discovery data (NEW)
  elementDiscovery?: {
    selector: string;
    elementType: string;
    confidence: number;
    discoveryMethod: string;
    isReliable: boolean;
    properties?: Record<string, any>;
  };
  
  // Working memory data (NEW)
  workingMemory?: {
    updateType: 'element_discovery' | 'page_insight' | 'variable_extraction' | 'pattern_learning' | 'investigation_preference';
    elementsKnown: number;
    patternsLearned: number;
    confidence: number;
    source: string;
  };
  
  // Workflow progress data
  progress?: {
    sessionId: string;
    totalSteps: number;
    completedSteps: number;
    currentStepIndex: number;
    overallProgress: number;
    estimatedTimeRemaining?: number;
  };
  
  // Resource data
  screenshot?: ScreenshotInfo;
  variable?: VariableInfo;
  page?: PageInfo;
  
  // Error/warning data
  error?: StandardError;
  warning?: StandardWarning;
  
  // Generic data
  message?: string;
  details?: Record<string, any>;
}

export enum CommandStatus {
  QUEUED = 'QUEUED',
  EXECUTING = 'EXECUTING',
  COMPLETED = 'COMPLETED', 
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export enum StepStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  SKIPPED = 'SKIPPED'
}

// Resource Types
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

export interface PageInfo {
  url: string;
  title: string;
  timestamp: Date;
  sessionId: string;
  stepIndex?: number;
  loadTime?: number;
  metadata?: Record<string, any>;
}

// Configuration Standards
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
  prefix: string;                 // e.g., '[StepProcessor]'
  includeTimestamp: boolean;
  includeSessionId: boolean;
  includeModuleId: boolean;
  structured: boolean;            // JSON structured logs
}

export interface PerformanceConfig {
  maxConcurrentOperations: number;
  cacheEnabled: boolean;
  cacheTTLMs: number;
  metricsEnabled: boolean;
}

export interface TimeoutConfig {
  // Timeout hierarchy: workflow >= step >= request >= connection
  workflowTimeoutMs: number;        // Top-level workflow timeout (e.g., 30 minutes)
  stepTimeoutMs: number;            // Individual step timeout (e.g., 5 minutes)  
  requestTimeoutMs: number;         // Network request timeout (e.g., 30 seconds)
  connectionTimeoutMs: number;      // Connection establishment timeout (e.g., 10 seconds)
  
  // Legacy field for backward compatibility
  defaultOperationTimeoutMs: number;
  
  // Retry configuration
  maxRetryAttempts: number;
  retryDelayMs: number;
  exponentialBackoff: boolean;
}

// Timeout validation utility
export interface TimeoutValidator {
  validateTimeoutHierarchy(config: TimeoutConfig): TimeoutValidationResult;
  createDefaultTimeouts(): TimeoutConfig;
  inheritTimeouts(parentConfig: TimeoutConfig, overrides?: Partial<TimeoutConfig>): TimeoutConfig;
}

export interface TimeoutValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recommendations?: string[];
}

// Default timeout configuration following hierarchy
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

// Dependency Injection
export interface DIContainer {
  register<T>(token: string, factory: () => T): void;
  register<T>(token: string, instance: T): void;
  resolve<T>(token: string): T;
  resolveAll<T>(token: string): T[];
  createScope(): DIContainer;
}

export interface ModuleRegistration {
  moduleId: string;
  dependencies: string[];         // List of required dependencies
  factory: (container: DIContainer) => any;
  singleton: boolean;
  initializeAsync?: boolean;
}

// Standard dependency tokens
export const DEPENDENCY_TOKENS = {
  // Core services
  SESSION_COORDINATOR: 'SessionCoordinator',
  ERROR_HANDLER: 'ErrorHandler',
  LOGGER: 'Logger',
  CONFIG_MANAGER: 'ConfigManager',
  
  // Module interfaces
  STEP_PROCESSOR: 'IStepProcessor',
  TASK_LOOP: 'ITaskLoop', 
  EXECUTOR: 'IExecutor',
  AI_INTEGRATION: 'IAIIntegration',
  AI_CONTEXT_MANAGER: 'IAIContextManager',
  CONTEXT_MANAGER: 'IAIContextManager', // Legacy alias
  SCHEMA_MANAGER: 'IAISchemaManager',
  PROMPT_MANAGER: 'IAIPromptManager',
  EXECUTOR_STREAMER: 'IExecutorStreamer',
  
  // Event system
  EVENT_PUBLISHER: 'IEventPublisher',
  
  // External dependencies
  AI_CONNECTION: 'AIConnection',
  DATABASE: 'Database',
  FILE_SYSTEM: 'FileSystem'
} as const;

// Event-Driven Architecture
export interface IEventPublisher {
  publishEvent(event: TaskLoopEvent): Promise<void>;
}

export interface TaskLoopEvent {
  type: TaskLoopEventType;
  sessionId: string;
  stepIndex?: number;
  data: TaskLoopEventData;
  timestamp: Date;
}

export enum TaskLoopEventType {
  STEP_STARTED = 'STEP_STARTED',
  STEP_COMPLETED = 'STEP_COMPLETED',
  STEP_FAILED = 'STEP_FAILED',
  AI_REASONING_UPDATE = 'AI_REASONING_UPDATE',
  COMMAND_EXECUTED = 'COMMAND_EXECUTED',
  PROGRESS_UPDATE = 'PROGRESS_UPDATE',
  // Investigation events (NEW)
  INVESTIGATION_STARTED = 'INVESTIGATION_STARTED',
  INVESTIGATION_PHASE_STARTED = 'INVESTIGATION_PHASE_STARTED',
  INVESTIGATION_PHASE_COMPLETED = 'INVESTIGATION_PHASE_COMPLETED',
  INVESTIGATION_TOOL_STARTED = 'INVESTIGATION_TOOL_STARTED',
  INVESTIGATION_TOOL_COMPLETED = 'INVESTIGATION_TOOL_COMPLETED',
  INVESTIGATION_COMPLETED = 'INVESTIGATION_COMPLETED',
  INVESTIGATION_FAILED = 'INVESTIGATION_FAILED',
  ELEMENT_DISCOVERED = 'ELEMENT_DISCOVERED',
  WORKING_MEMORY_UPDATED = 'WORKING_MEMORY_UPDATED'
}

export interface TaskLoopEventData {
  result?: StepResult;
  error?: StandardError;
  reasoning?: {
    content: string;
    confidence: number;
  };
  command?: {
    command: ExecutorCommand;
    result: CommandResponse;
  };
  progress?: ExecutionProgress;
  // Investigation event data (NEW)
  investigation?: {
    investigationId?: string;
    phase: 'initial_assessment' | 'focused_exploration' | 'selector_determination';
    toolsUsed: string[];
    elementsDiscovered: number;
    confidence: number;
    duration?: number;
    readyForAction?: boolean;
  };
  investigationTool?: {
    tool: 'screenshot_analysis' | 'text_extraction' | 'full_dom_retrieval' | 'sub_dom_extraction';
    success: boolean;
    confidence: number;
    duration: number;
    elementsFound?: number;
    summary?: string;
  };
  elementDiscovery?: {
    selector: string;
    elementType: string;
    confidence: number;
    discoveryMethod: string;
    isReliable: boolean;
    properties?: Record<string, any>;
  };
  workingMemory?: {
    updateType: 'element_discovery' | 'page_insight' | 'variable_extraction' | 'pattern_learning' | 'investigation_preference';
    elementsKnown: number;
    patternsLearned: number;
    confidence: number;
    source: string;
  };
}

export interface ProcessingOptions {
  maxIterations?: number;           // Maximum ACT-REFLECT cycles
  reflectionEnabled?: boolean;
  validationMode?: 'strict' | 'lenient';
  timeoutMs?: number;
  retryOnFailure?: boolean;
  maxRetries?: number;
  aiConfig?: AIProcessingConfig;
}

export interface TaskLoopStepRequest {
  sessionId: string;
  stepIndex: number;
  stepContent: string;
  streamId?: string;
  options?: ProcessingOptions;
}

// DEPRECATED: Legacy callback interface - use IEventPublisher instead
export interface TaskLoopCallbacks {
  onStepStarted(sessionId: string, stepIndex: number): Promise<void>;
  onStepCompleted(sessionId: string, stepIndex: number, result: StepResult): Promise<void>;
  onStepFailed(sessionId: string, stepIndex: number, error: StandardError): Promise<void>;
  onAIReasoningUpdate(sessionId: string, stepIndex: number, reasoning: string, confidence: number): Promise<void>;
  onCommandExecuted(sessionId: string, stepIndex: number, command: ExecutorCommand, result: CommandResponse): Promise<void>;
  onProgressUpdate(sessionId: string, progress: ExecutionProgress): Promise<void>;
}

export interface ExecutionProgress {
  sessionId: string;
  totalSteps: number;
  completedSteps: number;
  currentStepIndex: number;
  currentStepName: string;
  overallProgress: number;        // 0-100 percentage
  estimatedTimeRemaining?: number; // milliseconds
  averageStepDuration: number;
  lastActivity: Date;
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

// Pagination support
export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// Error Codes
export const ERROR_CODES = {
  // Step Processor
  STEP_PROCESSOR: {
    VALIDATION_FAILED: 'SP001',
    SESSION_CREATION_FAILED: 'SP002',
    TASK_LOOP_TIMEOUT: 'SP003',
    CONCURRENT_LIMIT_EXCEEDED: 'SP004'
  },
  
  // Task Loop  
  TASK_LOOP: {
    PROMPT_GENERATION_FAILED: 'TL001',
    AI_COMMUNICATION_ERROR: 'TL002',
    RESPONSE_PARSING_ERROR: 'TL003',
    COMMAND_EXECUTION_FAILED: 'TL004',
    REFLECTION_FAILED: 'TL005'
  },
  
  // Executor
  EXECUTOR: {
    BROWSER_LAUNCH_FAILED: 'EX001',
    SELECTOR_NOT_FOUND: 'EX002',
    ELEMENT_NOT_INTERACTABLE: 'EX003',
    PAGE_LOAD_TIMEOUT: 'EX004',
    SCREENSHOT_FAILED: 'EX005',
    SESSION_NOT_FOUND: 'EX006',
    INVALID_COMMAND: 'EX007'
  },
  
  // AI Integration
  AI_INTEGRATION: {
    CONNECTION_FAILED: 'AI001',
    AUTHENTICATION_ERROR: 'AI002',
    RATE_LIMIT_EXCEEDED: 'AI003',
    INVALID_RESPONSE: 'AI004',
    MODEL_ERROR: 'AI005'
  },
  
  // Context Manager
  CONTEXT_MANAGER: {
    SESSION_NOT_FOUND: 'CM001',
    STORAGE_ERROR: 'CM002',
    CONTEXT_GENERATION_FAILED: 'CM003',
    DATA_CORRUPTION: 'CM004'
  },
  
  // Schema Manager
  SCHEMA_MANAGER: {
    SCHEMA_GENERATION_FAILED: 'SM001',
    VALIDATION_ERROR: 'SM002',
    SCHEMA_VERSION_MISMATCH: 'SM003'
  },
  
  // Prompt Manager
  PROMPT_MANAGER: {
    TEMPLATE_NOT_FOUND: 'PM001',
    CONTEXT_UNAVAILABLE: 'PM002',
    TEMPLATE_RENDERING_FAILED: 'PM003'
  },
  
  // Executor Streamer
  EXECUTOR_STREAMER: {
    STREAM_CREATION_FAILED: 'ES001',
    CLIENT_CONNECTION_ERROR: 'ES002',
    EVENT_PUBLISHING_FAILED: 'ES003'
  },
  
  // Frontend API
  FRONTEND_API: {
    REQUEST_VALIDATION_FAILED: 'FA001',
    AUTHENTICATION_FAILED: 'FA002',
    RATE_LIMIT_EXCEEDED: 'FA003',
    SESSION_NOT_FOUND: 'FA004'
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

export interface CompatibilityMatrix {
  [moduleId: string]: {
    supportedVersions: string[];
    deprecatedVersions: string[];
    breakingChanges: BreakingChange[];
  };
}

export interface BreakingChange {
  version: string;
  description: string;
  migrationGuide?: string;
  affectedModules: string[];
}
