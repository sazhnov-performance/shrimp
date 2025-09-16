import { 
  SessionStatus,
  ModuleSessionInfo,
  SessionLifecycleCallbacks,
  ModuleSessionConfig,
  SessionManagerHealth,
  StandardError,
  ErrorCategory,
  ErrorSeverity
} from '../../../types/shared-types';
import {
  AIContextSession,
  AIContextConfig,
  IContextStorageAdapter,
  SessionData,
  ContextManagerError
} from './types';
import { StorageAdapterFactory, StorageUtils } from './storage-adapter';

export class ContextSessionManager {
  private readonly moduleId = 'ai-context-manager';
  private sessions = new Map<string, SessionData>();
  private config: AIContextConfig;
  private storageAdapter: IContextStorageAdapter;
  private lifecycleCallbacks?: SessionLifecycleCallbacks;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: AIContextConfig) {
    this.config = config;
    this.storageAdapter = StorageAdapterFactory.createAdapter(config);
    this.startCleanupTimer();
  }

  // Standardized Session Management Implementation

  async createSession(workflowSessionId: string, config?: ModuleSessionConfig): Promise<string> {
    try {
      // Generate unique module session ID
      const moduleSessionId = this.generateSessionId();
      
      // Create AI Context session
      const session: AIContextSession = {
        moduleId: this.moduleId,
        sessionId: moduleSessionId,
        linkedWorkflowSessionId: workflowSessionId,
        status: SessionStatus.INITIALIZING,
        createdAt: new Date(),
        lastActivity: new Date(),
        steps: [],
        stepExecutions: [],
        executorSessionId: '', // Will be linked later
        metadata: config?.metadata || {}
      };

      // Create session data container
      const sessionData: SessionData = {
        session,
        investigations: new Map(),
        elementDiscoveries: new Map(),
        contextSummaries: new Map()
      };

      // Store in memory and persistent storage
      this.sessions.set(workflowSessionId, sessionData);
      await this.storageAdapter.saveSession(session);

      // Update status to ACTIVE
      await this.updateSessionStatus(workflowSessionId, SessionStatus.ACTIVE);

      // Trigger lifecycle callback
      if (this.lifecycleCallbacks?.onSessionCreated) {
        await this.lifecycleCallbacks.onSessionCreated(
          this.moduleId,
          workflowSessionId,
          moduleSessionId
        );
      }

      return moduleSessionId;
    } catch (error) {
      const contextError = this.createError(
        'SESSION_CREATION_FAILED',
        `Failed to create session for workflow ${workflowSessionId}`,
        { workflowSessionId, error: error instanceof Error ? error.message : String(error) }
      );

      if (this.lifecycleCallbacks?.onSessionError) {
        await this.lifecycleCallbacks.onSessionError(this.moduleId, workflowSessionId, contextError);
      }

      throw contextError;
    }
  }

  async destroySession(workflowSessionId: string): Promise<void> {
    try {
      const sessionData = this.sessions.get(workflowSessionId);
      if (!sessionData) {
        return; // Session doesn't exist, nothing to destroy
      }

      // Update status to CLEANUP
      await this.updateSessionStatus(workflowSessionId, SessionStatus.CLEANUP);

      // Remove from memory
      this.sessions.delete(workflowSessionId);

      // Remove from persistent storage
      await this.storageAdapter.deleteSession(sessionData.session.sessionId);

      // Trigger lifecycle callback
      if (this.lifecycleCallbacks?.onSessionDestroyed) {
        await this.lifecycleCallbacks.onSessionDestroyed(this.moduleId, workflowSessionId);
      }
    } catch (error) {
      const contextError = this.createError(
        'SESSION_DESTRUCTION_FAILED',
        `Failed to destroy session ${workflowSessionId}`,
        { workflowSessionId, error: error instanceof Error ? error.message : String(error) }
      );

      if (this.lifecycleCallbacks?.onSessionError) {
        await this.lifecycleCallbacks.onSessionError(this.moduleId, workflowSessionId, contextError);
      }

      throw contextError;
    }
  }

  getSession(workflowSessionId: string): ModuleSessionInfo | null {
    const sessionData = this.sessions.get(workflowSessionId);
    return sessionData ? sessionData.session : null;
  }

  sessionExists(workflowSessionId: string): boolean {
    return this.sessions.has(workflowSessionId);
  }

  async updateSessionStatus(workflowSessionId: string, status: SessionStatus): Promise<void> {
    const sessionData = this.sessions.get(workflowSessionId);
    if (!sessionData) {
      throw this.createError(
        'SESSION_NOT_FOUND',
        `Session ${workflowSessionId} not found`,
        { workflowSessionId }
      );
    }

    const oldStatus = sessionData.session.status;
    sessionData.session.status = status;
    sessionData.session.lastActivity = new Date();

    // Save to persistent storage
    await this.storageAdapter.saveSession(sessionData.session);

    // Trigger lifecycle callback
    if (this.lifecycleCallbacks?.onSessionStatusChanged) {
      await this.lifecycleCallbacks.onSessionStatusChanged(
        this.moduleId,
        workflowSessionId,
        oldStatus,
        status
      );
    }
  }

  getSessionStatus(workflowSessionId: string): SessionStatus | null {
    const sessionData = this.sessions.get(workflowSessionId);
    return sessionData ? sessionData.session.status : null;
  }

  async recordActivity(workflowSessionId: string): Promise<void> {
    const sessionData = this.sessions.get(workflowSessionId);
    if (!sessionData) {
      throw this.createError(
        'SESSION_NOT_FOUND',
        `Session ${workflowSessionId} not found`,
        { workflowSessionId }
      );
    }

    sessionData.session.lastActivity = new Date();
    await this.storageAdapter.saveSession(sessionData.session);
  }

  getLastActivity(workflowSessionId: string): Date | null {
    const sessionData = this.sessions.get(workflowSessionId);
    return sessionData ? sessionData.session.lastActivity : null;
  }

  setLifecycleCallbacks(callbacks: SessionLifecycleCallbacks): void {
    this.lifecycleCallbacks = callbacks;
  }

  async healthCheck(): Promise<SessionManagerHealth> {
    const errors: StandardError[] = [];
    let isHealthy = true;

    try {
      // Check storage adapter health
      await this.storageAdapter.listSessions();
    } catch (error) {
      isHealthy = false;
      errors.push(this.createError(
        'STORAGE_HEALTH_CHECK_FAILED',
        'Storage adapter health check failed',
        { error: error instanceof Error ? error.message : String(error) }
      ));
    }

    // Check memory usage
    const memoryUsage = process.memoryUsage();
    if (memoryUsage.heapUsed > 1024 * 1024 * 1024) { // 1GB threshold
      errors.push(this.createError(
        'HIGH_MEMORY_USAGE',
        'High memory usage detected',
        { heapUsed: memoryUsage.heapUsed, threshold: 1024 * 1024 * 1024 }
      ));
    }

    return {
      moduleId: this.moduleId,
      isHealthy,
      activeSessions: this.getActiveSessionCount(),
      totalSessions: this.sessions.size,
      errors,
      lastHealthCheck: new Date()
    };
  }

  // AI Context Manager Specific Methods

  async linkExecutorSession(workflowSessionId: string, executorSessionId: string): Promise<void> {
    const sessionData = this.sessions.get(workflowSessionId);
    if (!sessionData) {
      throw this.createError(
        'SESSION_NOT_FOUND',
        `Session ${workflowSessionId} not found`,
        { workflowSessionId }
      );
    }

    sessionData.session.executorSessionId = executorSessionId;
    await this.recordActivity(workflowSessionId);
    await this.storageAdapter.saveSession(sessionData.session);
  }

  getSessionData(workflowSessionId: string): SessionData | null {
    return this.sessions.get(workflowSessionId) || null;
  }

  async loadSessionFromStorage(workflowSessionId: string): Promise<void> {
    const sessionData = this.sessions.get(workflowSessionId);
    if (!sessionData) {
      return;
    }

    try {
      // Load working memory
      const workingMemory = await this.storageAdapter.loadWorkingMemory(sessionData.session.sessionId);
      if (workingMemory) {
        sessionData.workingMemory = workingMemory;
      }

      // Load investigations for all steps
      for (const stepExecution of sessionData.session.stepExecutions) {
        const investigations = await this.storageAdapter.loadInvestigationResults(
          sessionData.session.sessionId,
          stepExecution.stepIndex
        );
        if (investigations.length > 0) {
          sessionData.investigations.set(stepExecution.stepIndex, investigations);
        }

        const discoveries = await this.storageAdapter.loadElementDiscoveries(
          sessionData.session.sessionId,
          stepExecution.stepIndex
        );
        if (discoveries.length > 0) {
          sessionData.elementDiscoveries.set(stepExecution.stepIndex, discoveries);
        }
      }

      // Load context summaries
      const summaries = await this.storageAdapter.loadContextSummaries(sessionData.session.sessionId);
      for (const summary of summaries) {
        sessionData.contextSummaries.set(summary.stepIndex, summary);
      }
    } catch (error) {
      throw this.createError(
        'STORAGE_LOAD_FAILED',
        `Failed to load session data from storage`,
        { workflowSessionId, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async validateSessionIntegrity(workflowSessionId: string): Promise<boolean> {
    const sessionData = this.sessions.get(workflowSessionId);
    if (!sessionData) {
      return false;
    }

    try {
      // Validate session ID format
      if (!StorageUtils.validateSessionId(sessionData.session.sessionId)) {
        return false;
      }

      // Validate step execution consistency
      for (const stepExecution of sessionData.session.stepExecutions) {
        if (stepExecution.stepIndex < 0 || stepExecution.stepIndex >= sessionData.session.steps.length) {
          return false;
        }
      }

      // Validate storage consistency
      const storedSession = await this.storageAdapter.loadSession(sessionData.session.sessionId);
      if (!storedSession || storedSession.sessionId !== sessionData.session.sessionId) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  // Private Helper Methods

  private generateSessionId(): string {
    return crypto.randomUUID();
  }

  private getActiveSessionCount(): number {
    let count = 0;
    for (const sessionData of this.sessions.values()) {
      if (sessionData.session.status === SessionStatus.ACTIVE) {
        count++;
      }
    }
    return count;
  }

  private createError(code: string, message: string, details?: Record<string, any>): ContextManagerError {
    return {
      id: crypto.randomUUID(),
      category: this.categorizeError(code),
      severity: this.determineSeverity(code),
      code,
      message,
      details,
      timestamp: new Date(),
      moduleId: this.moduleId,
      recoverable: this.isRecoverable(code),
      retryable: this.isRetryable(code),
      suggestedAction: this.getSuggestedAction(code)
    };
  }

  private categorizeError(code: string): ErrorCategory {
    if (code.includes('NOT_FOUND') || code.includes('VALIDATION')) {
      return ErrorCategory.VALIDATION;
    }
    if (code.includes('STORAGE') || code.includes('PERSISTENCE')) {
      return ErrorCategory.SYSTEM;
    }
    if (code.includes('SESSION')) {
      return ErrorCategory.EXECUTION;
    }
    return ErrorCategory.SYSTEM;
  }

  private determineSeverity(code: string): ErrorSeverity {
    if (code.includes('CREATION_FAILED') || code.includes('DESTRUCTION_FAILED')) {
      return ErrorSeverity.HIGH;
    }
    if (code.includes('NOT_FOUND')) {
      return ErrorSeverity.MEDIUM;
    }
    return ErrorSeverity.LOW;
  }

  private isRecoverable(code: string): boolean {
    return !code.includes('CREATION_FAILED');
  }

  private isRetryable(code: string): boolean {
    return code.includes('STORAGE') || code.includes('HEALTH_CHECK');
  }

  private getSuggestedAction(code: string): string {
    switch (code) {
      case 'SESSION_NOT_FOUND':
        return 'Verify session ID and create new session if needed';
      case 'SESSION_CREATION_FAILED':
        return 'Check system resources and retry with different configuration';
      case 'STORAGE_HEALTH_CHECK_FAILED':
        return 'Check storage adapter configuration and connectivity';
      case 'HIGH_MEMORY_USAGE':
        return 'Consider cleaning up old sessions or increasing memory limits';
      default:
        return 'Review error details and retry operation';
    }
  }

  private startCleanupTimer(): void {
    if (this.config.storage.sessionTTL > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanupExpiredSessions();
      }, this.config.workingMemory.memoryCleanupInterval);
    }
  }

  private cleanupExpiredSessions(): void {
    try {
      StorageUtils.cleanupExpiredSessions(this.sessions as any, this.config.storage.sessionTTL);
    } catch (error) {
      // Log error but don't throw - cleanup is best effort
      console.warn('Session cleanup failed:', error);
    }
  }

  // Cleanup resources
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }
}
