# Session Management Standardization Design

## Overview

This document defines the standardized session management interfaces that all modules must implement to ensure consistency, proper lifecycle coordination, and clear separation of concerns across the automation system.

## Core Principles

1. **Unified Session Model**: All modules reference the shared `WorkflowSession` as the primary session entity
2. **Consistent Naming**: Standardized field names and method signatures across all modules  
3. **Clear Session Hierarchy**: Workflow sessions coordinate module-specific sessions
4. **Lifecycle Coordination**: Centralized session creation and cleanup through `SessionCoordinator`
5. **Status Standardization**: Single source of truth for session status values

## Standardized Session Hierarchy

```typescript
// Import from shared-types.md for all modules
import { 
  WorkflowSession, 
  SessionStatus, 
  SessionCoordinator,
  ISessionManager,
  ModuleSessionInfo,
  SessionLifecycleCallbacks
} from './shared-types';

// Workflow Session (Primary)
interface WorkflowSession {
  sessionId: string;              // Primary session ID (UUID) 
  executorSessionId: string;      // Browser session ID
  streamId?: string;              // Stream session ID (optional)
  aiConnectionId: string;         // AI connection ID
  createdAt: Date;
  lastActivity: Date;
  status: SessionStatus;          // Unified status enum
  metadata?: Record<string, any>;
}

// Module-specific session info (embedded in workflow session)
interface ModuleSessionInfo {
  moduleId: string;
  sessionId: string;              // Module's internal session ID
  linkedWorkflowSessionId: string; // Reference to workflow session
  status: SessionStatus;          // Uses same status enum
  createdAt: Date;
  lastActivity: Date;
  metadata?: Record<string, any>;
}
```

## Unified Status Enumeration

```typescript
// Single source of truth for all session statuses
enum SessionStatus {
  INITIALIZING = 'INITIALIZING',   // Session being created
  ACTIVE = 'ACTIVE',               // Session running normally
  PAUSED = 'PAUSED',               // Session temporarily stopped
  COMPLETED = 'COMPLETED',         // Session finished successfully
  FAILED = 'FAILED',               // Session failed with error
  CANCELLED = 'CANCELLED',         // Session stopped by user
  CLEANUP = 'CLEANUP'              // Session being destroyed
}

// Module-specific status mappings (for backward compatibility)
const STATUS_MAPPINGS = {
  // AI Integration ConnectionStatus -> SessionStatus
  DISCONNECTED: SessionStatus.FAILED,
  CONNECTING: SessionStatus.INITIALIZING,
  CONNECTED: SessionStatus.ACTIVE,
  ERROR: SessionStatus.FAILED,
  RATE_LIMITED: SessionStatus.PAUSED,
  
  // Executor ExecutionStatus -> SessionStatus  
  PENDING: SessionStatus.INITIALIZING,
  IN_PROGRESS: SessionStatus.ACTIVE,
  // COMPLETED, FAILED remain the same
  SKIPPED: SessionStatus.CANCELLED
};
```

## Standardized Session Management Interface

```typescript
// Base interface that all modules must implement
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
```

## Session Coordinator (Centralized Management)

```typescript
// Centralized coordination of all module sessions
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

## Module-Specific Standardizations

### AI Context Manager
```typescript
interface IAIContextManager extends ISessionManager {
  moduleId: 'ai-context-manager';
  
  // Session Management (FIXED: Uses standardized interface)
  createSession(workflowSessionId: string, config?: AIContextConfig): Promise<string>;
  destroySession(workflowSessionId: string): Promise<void>;
  linkExecutorSession(workflowSessionId: string, executorSessionId: string): Promise<void>;
  
  // Context Management (uses workflowSessionId consistently)
  setSteps(workflowSessionId: string, steps: string[]): Promise<void>;
  addExecutionEvent(workflowSessionId: string, stepIndex: number, command: ExecutorCommand, result: CommandResponse): Promise<string>;
  generateContextJson(workflowSessionId: string, targetStep: number): Promise<AIContextJson>;
}
```

### AI Integration Module  
```typescript
interface IAIIntegrationManager extends ISessionManager {
  moduleId: 'ai-integration';
  
  // Connection Management (mapped to session management)
  createSession(workflowSessionId: string, config?: AIConnectionConfig): Promise<string>;
  destroySession(workflowSessionId: string): Promise<void>;
  
  // Request Processing (uses workflowSessionId for tracking)
  sendRequest(workflowSessionId: string, connectionId: string, request: AIRequest): Promise<AIResponse>;
  getConnectionStatus(connectionId: string): SessionStatus; // FIXED: Returns SessionStatus
}
```

### Executor Module
```typescript
interface IExecutor extends ISessionManager {
  moduleId: 'executor';
  
  // Session Management (FIXED: Uses workflowSessionId)
  createSession(workflowSessionId: string, config?: ExecutorConfig): Promise<string>;
  destroySession(workflowSessionId: string): Promise<void>;
  
  // Command Execution (references workflowSessionId)
  executeCommand(command: ExecutorCommand): Promise<CommandResponse>; // Command includes workflowSessionId
  openPage(workflowSessionId: string, url: string): Promise<CommandResponse>;
}
```

### Task Loop Module
```typescript
interface ITaskLoop extends ISessionManager {
  moduleId: 'task-loop';
  
  // Session Management
  createSession(workflowSessionId: string, config?: TaskLoopConfig): Promise<string>;
  destroySession(workflowSessionId: string): Promise<void>;
  
  // Processing (uses workflowSessionId)
  processStep(request: TaskLoopStepRequest): Promise<StepResult>;
  getExecutionState(workflowSessionId: string, stepIndex: number): Promise<ExecutionState>;
}
```

### Step Processor Module
```typescript
interface IStepProcessor extends ISessionManager {
  moduleId: 'step-processor';
  
  // Session Management (coordinates with SessionCoordinator)
  createSession(workflowSessionId: string, config?: ProcessingConfig): Promise<string>;
  destroySession(workflowSessionId: string): Promise<void>;
  
  // Workflow Processing
  processSteps(request: StepProcessingRequest): Promise<StepProcessingResult>;
  getExecutionProgress(workflowSessionId: string): Promise<ExecutionProgress>;
}
```

### Executor Streamer Module
```typescript
interface IExecutorStreamer extends ISessionManager {
  moduleId: 'executor-streamer';
  
  // Session Management (FIXED: Uses workflowSessionId consistently)
  createSession(workflowSessionId: string, config?: StreamConfig): Promise<string>;
  destroySession(workflowSessionId: string): Promise<void>;
  
  // Stream Management (linked to workflowSessionId)
  createStream(workflowSessionId: string, config?: StreamConfig): Promise<string>;
  publishEvent(workflowSessionId: string, event: StreamEvent): Promise<void>;
}
```

### Frontend API Module
```typescript
interface IFrontendAPI extends ISessionManager {
  moduleId: 'frontend-api';
  
  // Session Management (proxies to SessionCoordinator)
  createSession(workflowSessionId: string, config?: APIConfig): Promise<string>;
  destroySession(workflowSessionId: string): Promise<void>;
  
  // API Operations (uses workflowSessionId)
  getSessionStatus(workflowSessionId: string): Promise<SessionStatusResponse>;
  executeSteps(request: ExecuteStepsRequest): Promise<ExecuteStepsResponse>;
}
```

## Migration Strategy

### Phase 1: Update Shared Types (Week 1)
1. **Enhance shared-types.md** with standardized session interfaces
2. **Add SessionCoordinator** implementation to shared types
3. **Standardize SessionStatus** enum usage across all modules
4. **Define ISessionManager** base interface

### Phase 2: Update Design Documents (Week 2)  
1. **Align design documents** with standardized interfaces
2. **Remove module-specific session definitions** that conflict with shared types
3. **Update method signatures** to use workflowSessionId consistently
4. **Add SessionCoordinator integration** to all module designs

### Phase 3: Update Type Definitions (Week 3)
1. **Update all .ts files** to import from shared-types.md
2. **Remove duplicate session interfaces** from individual modules
3. **Implement ISessionManager** in all module type definitions
4. **Fix circular dependency issues** by using shared types

### Phase 4: Implementation Coordination (Week 4)
1. **Implement SessionCoordinator** as central coordination service
2. **Update module implementations** to use standardized interfaces
3. **Add session linking logic** between modules
4. **Implement session integrity validation**

## Benefits of Standardization

1. **Consistency**: All modules use the same session management patterns
2. **Reduced Complexity**: Single source of truth for session definitions
3. **Better Integration**: Clear coordination between modules through SessionCoordinator
4. **Easier Debugging**: Consistent session tracking and status reporting
5. **Maintainability**: Reduced duplication and clearer dependencies
6. **Type Safety**: Proper TypeScript usage with shared type definitions

## Validation Rules

1. **All session IDs must be UUIDs** for uniqueness
2. **WorkflowSession is the primary session entity** - modules create supporting sessions
3. **All status updates go through SessionCoordinator** for consistency
4. **Module sessions must be linked to workflow sessions** for proper cleanup
5. **Session lifecycle callbacks are mandatory** for coordination
6. **All modules must implement ISessionManager** interface

This standardization provides a solid foundation for consistent session management across all modules while maintaining each module's specific functionality requirements.
