# Shared Types and Interfaces Design Document

## Overview
This document defines shared types, interfaces, and contracts used across all modules in the automation system. It ensures consistency and prevents interface mismatches between modules.

## Core Session Management

### Unified Session Model
```typescript
// Primary session identifier for the entire workflow
interface WorkflowSession {
  sessionId: string;              // Primary session ID (UUID)
  executorSessionId: string;      // Executor browser session ID  
  streamId?: string;              // Streaming session ID (optional)
  aiConnectionId: string;         // AI integration connection ID
  createdAt: Date;
  lastActivity: Date;
  status: SessionStatus;
  metadata?: Record<string, any>;
}

enum SessionStatus {
  INITIALIZING = 'INITIALIZING',
  ACTIVE = 'ACTIVE', 
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  CLEANUP = 'CLEANUP'
}

// Workflow configuration for session creation
interface WorkflowConfig {
  aiConnectionId?: string;          // Override default AI connection
  browserType?: 'chromium' | 'firefox' | 'webkit';
  enableStreaming?: boolean;
  streamConfig?: StreamProcessingConfig;
  executorConfig?: ExecutorProcessingConfig;
  aiConfig?: AIProcessingConfig;
  maxExecutionTime?: number;
  metadata?: Record<string, any>;
}

// STANDARDIZED SESSION MANAGEMENT INTERFACES
// All modules must implement these standardized session management patterns

// Module-specific session information  
interface ModuleSessionInfo {
  moduleId: string;
  sessionId: string;              // Module's internal session ID
  linkedWorkflowSessionId: string; // Reference to workflow session
  status: SessionStatus;          // Uses unified status enum
  createdAt: Date;
  lastActivity: Date;
  metadata?: Record<string, any>;
}

// Base session manager interface (all modules must implement)
interface ISessionManager {
  readonly moduleId: string;
  
  // Core Lifecycle (standardized signatures)
  createSession(workflowSessionId: string, config?: ModuleSessionConfig): Promise<string>;
  destroySession(workflowSessionId: string): Promise<void>;
  getSession(workflowSessionId: string): ModuleSessionInfo | null;
  sessionExists(workflowSessionId: string): boolean;
  
  // Status Management
  updateSessionStatus(workflowSessionId: string, status: SessionStatus): Promise<void>;
  getSessionStatus(workflowSessionId: string): SessionStatus | null;
  
  // Activity Tracking
  recordActivity(workflowSessionId: string): Promise<void>;
  getLastActivity(workflowSessionId: string): Date | null;
  
  // Lifecycle Callbacks
  setLifecycleCallbacks(callbacks: SessionLifecycleCallbacks): void;
  
  // Module Health
  healthCheck(): Promise<SessionManagerHealth>;
}

interface ModuleSessionConfig {
  timeoutMs?: number;
  retryAttempts?: number;
  metadata?: Record<string, any>;
}

interface SessionLifecycleCallbacks {
  onSessionCreated?(moduleId: string, workflowSessionId: string, moduleSessionId: string): Promise<void>;
  onSessionStatusChanged?(moduleId: string, workflowSessionId: string, oldStatus: SessionStatus, newStatus: SessionStatus): Promise<void>;
  onSessionDestroyed?(moduleId: string, workflowSessionId: string): Promise<void>;
  onSessionError?(moduleId: string, workflowSessionId: string, error: StandardError): Promise<void>;
}

interface SessionManagerHealth {
  moduleId: string;
  isHealthy: boolean;
  activeSessions: number;
  totalSessions: number;
  errors: StandardError[];
  lastHealthCheck: Date;
}

// Session creation coordinator - ensures all related sessions are created
interface SessionCoordinator {
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

interface WorkflowSessionCallback {
  (session: WorkflowSession): Promise<void>;
}

interface ModuleSessionLinkCallback {
  (workflowSessionId: string, moduleId: string, moduleSessionId: string): Promise<void>;
}

interface CoordinatorHealth {
  totalWorkflowSessions: number;
  activeWorkflowSessions: number;
  registeredModules: string[];
  moduleHealthStatus: Record<string, boolean>;
  lastHealthCheck: Date;
}

interface SessionIntegrityReport {
  workflowSessionId: string;
  isValid: boolean;
  linkedModules: string[];
  missingLinks: string[];
  orphanedSessions: Record<string, string>;
  inconsistentStatuses: Record<string, SessionStatus>;
  recommendations: string[];
}
```

## Command and Response Types

### Unified Command Structure
```typescript
// AI generates commands without session IDs
interface AIGeneratedCommand {
  action: CommandAction;
  parameters: CommandParameters;
  reasoning?: string;
  priority?: number;
}

// Executor receives commands with session IDs (injected by Task Loop)
interface ExecutorCommand {
  sessionId: string;              // Injected by Task Loop
  action: CommandAction;
  parameters: CommandParameters;
  commandId: string;              // For tracking
  timestamp: Date;
}

enum CommandAction {
  OPEN_PAGE = 'OPEN_PAGE',
  CLICK_ELEMENT = 'CLICK_ELEMENT', 
  INPUT_TEXT = 'INPUT_TEXT',
  SAVE_VARIABLE = 'SAVE_VARIABLE',
  GET_DOM = 'GET_DOM'
}

interface CommandParameters {
  url?: string;           // For OPEN_PAGE
  selector?: string;      // For CLICK_ELEMENT, INPUT_TEXT, SAVE_VARIABLE
  text?: string;          // For INPUT_TEXT
  variableName?: string;  // For SAVE_VARIABLE
}

interface CommandResponse {
  success: boolean;
  commandId: string;
  dom: string;                    // Full DOM of current page
  screenshotId: string;           // Unique ID of screenshot
  duration: number;               // Execution time in ms
  error?: StandardError;
  metadata?: Record<string, any>;
}
```

### AI Response Schema (Fixed)
```typescript
// AI response structure - supports multiple commands
interface AIResponse {
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
  commands: AIGeneratedCommand[];  // Array of commands (FIXED)
  context?: Record<string, any>;
}

enum DecisionAction {
  PROCEED = 'PROCEED',
  RETRY = 'RETRY', 
  ABORT = 'ABORT'
}

interface ResultValidation {
  success: boolean;
  expectedElements: string[];
  actualState: string;
  issues?: string[];
}
```

## Step Processing Types

### Unified Step Processing
```typescript
interface StepProcessingRequest {
  steps: string[];
  config: ProcessingConfig;
  metadata?: Record<string, any>;
}

interface ProcessingConfig {
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

interface AIProcessingConfig {
  connectionId: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
}

interface ExecutorProcessingConfig {
  browserType: 'chromium' | 'firefox' | 'webkit';
  headless: boolean;
  timeoutMs: number;
  screenshotsEnabled: boolean;
}

interface StreamProcessingConfig {
  bufferSize: number;
  maxHistorySize: number;
  compressionEnabled: boolean;
}

interface StepProcessingResult {
  sessionId: string;
  streamId?: string;
  initialStatus: SessionStatus;
  estimatedDuration?: number;
  createdAt: Date;
}

// FIXED: Define missing StepResult type
interface StepResult {
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
```

## Streaming and Events

### Unified Stream Events
```typescript
enum StreamEventType {
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

interface StreamEvent {
  id: string;                     // Unique event ID
  type: StreamEventType;
  timestamp: Date;
  sessionId: string;
  stepIndex?: number;
  data: StreamEventData;
  metadata?: Record<string, any>;
}

interface StreamEventData {
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

enum CommandStatus {
  QUEUED = 'QUEUED',
  EXECUTING = 'EXECUTING',
  COMPLETED = 'COMPLETED', 
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

enum StepStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  SKIPPED = 'SKIPPED'
}
```

## Error Handling (Unified)

### Standard Error Types
```typescript
// Unified error hierarchy
enum ErrorCategory {
  VALIDATION = 'VALIDATION',
  EXECUTION = 'EXECUTION', 
  INTEGRATION = 'INTEGRATION',
  SYSTEM = 'SYSTEM',
  USER = 'USER'
}

enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

interface StandardError {
  id: string;                     // Unique error ID
  category: ErrorCategory;
  severity: ErrorSeverity;
  code: string;                   // Module-specific error code
  message: string;                // Human-readable message
  details?: Record<string, any>;  // Additional context
  cause?: StandardError;          // Original error (for wrapping)
  timestamp: Date;
  
  // Context fields (populated by respective modules)
  sessionId?: string;
  stepIndex?: number;
  commandId?: string;
  moduleId?: string;
  
  // Recovery information
  recoverable: boolean;
  retryable: boolean;
  suggestedAction?: string;
}

interface StandardWarning {
  id: string;
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
  sessionId?: string;
  stepIndex?: number;
}

// Module-specific error codes (namespaced)
const ERROR_CODES = {
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
    SCREENSHOT_FAILED: 'EX005'
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
    RATE_LIMIT_EXCEEDED: 'FA003'
  }
} as const;
```

## Resource Types

### Screenshots and Variables
```typescript
interface ScreenshotInfo {
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

interface VariableInfo {
  name: string;
  value: string;
  previousValue?: string;
  timestamp: Date;
  sessionId: string;
  stepIndex?: number;
  source: 'user_input' | 'extracted' | 'computed';
}

interface PageInfo {
  url: string;
  title: string;
  timestamp: Date;
  sessionId: string;
  stepIndex?: number;
  loadTime?: number;
  metadata?: Record<string, any>;
}
```

## Configuration Standards

### Unified Configuration Pattern
```typescript
// Base configuration interface for all modules
interface BaseModuleConfig {
  moduleId: string;
  version: string;
  enabled: boolean;
  logging: LoggingConfig;
  performance: PerformanceConfig;
  timeouts: TimeoutConfig;
}

interface LoggingConfig {
  level: LogLevel;
  prefix: string;                 // e.g., '[StepProcessor]'
  includeTimestamp: boolean;
  includeSessionId: boolean;
  includeModuleId: boolean;
  structured: boolean;            // JSON structured logs
}

enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO', 
  WARN = 'WARN',
  ERROR = 'ERROR'
}

interface PerformanceConfig {
  maxConcurrentOperations: number;
  cacheEnabled: boolean;
  cacheTTLMs: number;
  metricsEnabled: boolean;
}

interface TimeoutConfig {
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
interface TimeoutValidator {
  validateTimeoutHierarchy(config: TimeoutConfig): TimeoutValidationResult;
  createDefaultTimeouts(): TimeoutConfig;
  inheritTimeouts(parentConfig: TimeoutConfig, overrides?: Partial<TimeoutConfig>): TimeoutConfig;
}

interface TimeoutValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  recommendations?: string[];
}

// Default timeout configuration following hierarchy
const DEFAULT_TIMEOUT_CONFIG: TimeoutConfig = {
  workflowTimeoutMs: 1800000,      // 30 minutes
  stepTimeoutMs: 300000,           // 5 minutes  
  requestTimeoutMs: 30000,         // 30 seconds
  connectionTimeoutMs: 10000,      // 10 seconds
  defaultOperationTimeoutMs: 30000,
  maxRetryAttempts: 3,
  retryDelayMs: 1000,
  exponentialBackoff: true
};

// Validation rules:
// 1. workflowTimeoutMs >= stepTimeoutMs
// 2. stepTimeoutMs >= requestTimeoutMs  
// 3. requestTimeoutMs >= connectionTimeoutMs
// 4. All timeouts must be positive
// 5. Retry delays should be reasonable (< stepTimeoutMs / maxRetryAttempts)
```

## Dependency Injection

### Module Dependency Framework
```typescript
// Dependency injection container interface
interface DIContainer {
  register<T>(token: string, factory: () => T): void;
  register<T>(token: string, instance: T): void;
  resolve<T>(token: string): T;
  resolveAll<T>(token: string): T[];
  createScope(): DIContainer;
}

// Module registration interface
interface ModuleRegistration {
  moduleId: string;
  dependencies: string[];         // List of required dependencies
  factory: (container: DIContainer) => any;
  singleton: boolean;
  initializeAsync?: boolean;
}

// Standard dependency tokens
const DEPENDENCY_TOKENS = {
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
  CONTEXT_MANAGER: 'IAIContextManager',
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
```

## Callback and Integration Interfaces

### Event-Driven Architecture (FIXED: Replaces Callbacks)
```typescript
// Event publisher interface for Task Loop to break circular dependencies
interface IEventPublisher {
  publishEvent(event: TaskLoopEvent): Promise<void>;
}

// Task Loop events published to Step Processor
interface TaskLoopEvent {
  type: TaskLoopEventType;
  sessionId: string;
  stepIndex?: number;
  data: TaskLoopEventData;
  timestamp: Date;
}

enum TaskLoopEventType {
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

interface TaskLoopEventData {
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

// Processing options for Task Loop steps
interface ProcessingOptions {
  maxIterations?: number;           // Maximum ACT-REFLECT cycles
  reflectionEnabled?: boolean;
  validationMode?: 'strict' | 'lenient';
  timeoutMs?: number;
  retryOnFailure?: boolean;
  maxRetries?: number;
  aiConfig?: AIProcessingConfig;
}

// Step request interface for Task Loop
interface TaskLoopStepRequest {
  sessionId: string;
  stepIndex: number;
  stepContent: string;
  streamId?: string;
  options?: ProcessingOptions;
}

// DEPRECATED: Legacy callback interface - use IEventPublisher instead
interface TaskLoopCallbacks {
  onStepStarted(sessionId: string, stepIndex: number): Promise<void>;
  onStepCompleted(sessionId: string, stepIndex: number, result: StepResult): Promise<void>;
  onStepFailed(sessionId: string, stepIndex: number, error: StandardError): Promise<void>;
  onAIReasoningUpdate(sessionId: string, stepIndex: number, reasoning: string, confidence: number): Promise<void>;
  onCommandExecuted(sessionId: string, stepIndex: number, command: ExecutorCommand, result: CommandResponse): Promise<void>;
  onProgressUpdate(sessionId: string, progress: ExecutionProgress): Promise<void>;
}

interface ExecutionProgress {
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
```

## API Response Standards

### Standard API Response Format
```typescript
interface APIResponse<T = any> {
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

interface APIError {
  code: string;
  message: string;
  details?: Record<string, any>;
  retryable: boolean;
  timestamp: string;
}

// Pagination support
interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}
```

## Version and Compatibility

### Version Management
```typescript
interface VersionInfo {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
}

interface CompatibilityMatrix {
  [moduleId: string]: {
    supportedVersions: string[];
    deprecatedVersions: string[];
    breakingChanges: BreakingChange[];
  };
}

interface BreakingChange {
  version: string;
  description: string;
  migrationGuide?: string;
  affectedModules: string[];
}

// Current system version
export const SYSTEM_VERSION: VersionInfo = {
  major: 1,
  minor: 0,
  patch: 0
};
```

This shared types document establishes the foundation for consistent interfaces across all modules. All design documents will be updated to reference these shared types and remove duplicate or conflicting definitions.
