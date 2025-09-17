/**
 * Step Processor Main Implementation
 * Core orchestration class that coordinates workflow execution across all modules
 * Based on design/step-processor.md specifications
 */

import {
  SessionStatus,
  SessionLifecycleCallbacks,
  SessionManagerHealth,
  WorkflowSession,
  StepProcessingRequest,
  StepProcessingResult,
  ExecutionProgress,
  StepResult,
  TaskLoopEvent,
  DIContainer,
  DEPENDENCY_TOKENS,
  StepStatus
} from '../../../types/shared-types';

import {
  IStepProcessor,
  StepProcessorSession,
  StepProcessorSessionConfig,
  StepExecutionSummary,
  StepProcessorDependencies,
  StepProcessorEventPublisher,
  StepProcessorConfig,
  TaskLoopStepRequest,
  StepProcessorErrorHandler,
  ILoggerInterface,
  STEP_PROCESSOR_LIMITS,
  DEFAULT_STEP_PROCESSOR_CONFIG
} from './types';

import { StepProcessorEventPublisherImpl } from './event-publisher';
import { StepProcessorErrorHandlerImpl, StepProcessorErrorHelpers } from './error-handler';
import { createLoggerFromConfig } from './logger';

export class StepProcessor implements IStepProcessor {
  readonly moduleId = 'step-processor' as const;
  
  private config: StepProcessorConfig;
  private dependencies?: StepProcessorDependencies;
  private sessions: Map<string, StepProcessorSession>;
  private eventPublisher: StepProcessorEventPublisher;
  private errorHandler: StepProcessorErrorHandler;
  private logger: ILoggerInterface;
  private lifecycleCallbacks?: SessionLifecycleCallbacks;
  private isInitialized = false;

  constructor(config: StepProcessorConfig = DEFAULT_STEP_PROCESSOR_CONFIG) {
    this.config = config;
    this.sessions = new Map();
    
    // Initialize core components
    this.logger = createLoggerFromConfig(config);
    this.errorHandler = new StepProcessorErrorHandlerImpl();
    this.eventPublisher = new StepProcessorEventPublisherImpl(this.logger);
    
    this.logger.info('Step Processor instance created', {
      details: { version: config.version }
    });
  }

  // ISessionManager implementation
  async createSession(workflowSessionId: string, config?: StepProcessorSessionConfig): Promise<string> {
    try {
      this.validateInitialization();
      
      if (this.sessions.has(workflowSessionId)) {
        throw StepProcessorErrorHelpers.validationError(
          `Session already exists: ${workflowSessionId}`
        );
      }

      if (this.sessions.size >= this.config.workflow.maxConcurrentSessions) {
        throw StepProcessorErrorHelpers.concurrentLimitError(
          this.sessions.size,
          this.config.workflow.maxConcurrentSessions
        );
      }

      const session: StepProcessorSession = {
        moduleId: 'step-processor',
        sessionId: workflowSessionId,
        linkedWorkflowSessionId: workflowSessionId,
        status: SessionStatus.INITIALIZING,
        createdAt: new Date(),
        lastActivity: new Date(),
        currentStepIndex: 0,
        totalSteps: 0,
        streamingEnabled: config?.enableStreaming ?? this.config.streaming.enabled,
        executionProgress: {
          sessionId: workflowSessionId,
          totalSteps: 0,
          completedSteps: 0,
          currentStepIndex: 0,
          currentStepName: '',
          overallProgress: 0,
          averageStepDuration: 0,
          lastActivity: new Date()
        },
        metadata: config?.metadata
      };

      this.sessions.set(workflowSessionId, session);
      
      await this.updateSessionStatus(workflowSessionId, SessionStatus.ACTIVE);
      
      this.logger.logSessionCreated(workflowSessionId, workflowSessionId);
      
      if (this.lifecycleCallbacks?.onSessionCreated) {
        await this.lifecycleCallbacks.onSessionCreated(this.moduleId, workflowSessionId, workflowSessionId);
      }

      return workflowSessionId;
    } catch (error) {
      const standardError = this.errorHandler.wrapError(
        error,
        'SESSION_CREATION_FAILED',
        `Failed to create Step Processor session: ${workflowSessionId}`
      );
      this.errorHandler.handleError(standardError);
      throw standardError;
    }
  }

  async destroySession(workflowSessionId: string): Promise<void> {
    try {
      const session = this.sessions.get(workflowSessionId);
      if (!session) {
        this.logger.warn(`Attempted to destroy non-existent session: ${workflowSessionId}`);
        return;
      }

      await this.updateSessionStatus(workflowSessionId, SessionStatus.CLEANUP);
      
      this.sessions.delete(workflowSessionId);
      
      this.logger.logSessionDestroyed(workflowSessionId);
      
      if (this.lifecycleCallbacks?.onSessionDestroyed) {
        await this.lifecycleCallbacks.onSessionDestroyed(this.moduleId, workflowSessionId);
      }
    } catch (error) {
      const standardError = this.errorHandler.wrapError(
        error,
        'SESSION_CREATION_FAILED',
        `Failed to destroy Step Processor session: ${workflowSessionId}`
      );
      this.errorHandler.handleError(standardError);
      throw standardError;
    }
  }

  getSession(workflowSessionId: string): StepProcessorSession | null {
    return this.sessions.get(workflowSessionId) || null;
  }

  sessionExists(workflowSessionId: string): boolean {
    return this.sessions.has(workflowSessionId);
  }

  async updateSessionStatus(workflowSessionId: string, status: SessionStatus): Promise<void> {
    const session = this.sessions.get(workflowSessionId);
    if (!session) {
      throw StepProcessorErrorHelpers.workflowSessionNotFoundError(workflowSessionId);
    }

    const oldStatus = session.status;
    session.status = status;
    session.lastActivity = new Date();

    this.logger.debug(`Session status updated: ${oldStatus} -> ${status}`, {
      sessionId: workflowSessionId,
      details: { oldStatus, newStatus: status }
    });

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
    const session = this.sessions.get(workflowSessionId);
    return session?.status || null;
  }

  async recordActivity(workflowSessionId: string): Promise<void> {
    const session = this.sessions.get(workflowSessionId);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  getLastActivity(workflowSessionId: string): Date | null {
    const session = this.sessions.get(workflowSessionId);
    return session?.lastActivity || null;
  }

  setLifecycleCallbacks(callbacks: SessionLifecycleCallbacks): void {
    this.lifecycleCallbacks = callbacks;
  }

  async healthCheck(): Promise<SessionManagerHealth> {
    const errors: any[] = [];
    let isHealthy = true;

    try {
      // Check if initialized
      if (!this.isInitialized) {
        errors.push({ code: 'NOT_INITIALIZED', message: 'Step Processor not initialized' });
        isHealthy = false;
      }

      // Check dependencies
      if (!this.dependencies) {
        errors.push({ code: 'MISSING_DEPENDENCIES', message: 'Dependencies not resolved' });
        isHealthy = false;
      }

      // Check session counts
      const activeSessions = Array.from(this.sessions.values())
        .filter(s => s.status === SessionStatus.ACTIVE || s.status === SessionStatus.BUSY).length;

      if (activeSessions > this.config.workflow.maxConcurrentSessions) {
        errors.push({ 
          code: 'CONCURRENT_LIMIT_EXCEEDED', 
          message: `Too many active sessions: ${activeSessions}/${this.config.workflow.maxConcurrentSessions}` 
        });
        isHealthy = false;
      }

    } catch (error) {
      errors.push({ code: 'HEALTH_CHECK_ERROR', message: error instanceof Error ? error.message : String(error) });
      isHealthy = false;
    }

    return {
      moduleId: this.moduleId,
      isHealthy,
      activeSessions: this.sessions.size,
      totalSessions: this.sessions.size,
      errors,
      lastHealthCheck: new Date()
    };
  }

  // Workflow Management
  async processSteps(request: StepProcessingRequest): Promise<StepProcessingResult> {
    const startTime = Date.now();
    
    try {
      this.validateInitialization();
      this.validateStepProcessingRequest(request);

      // Create unified workflow session
      const workflowSession = await this.dependencies!.sessionCoordinator.createWorkflowSession(
        request.steps,
        request.config as any
      );

      // Initialize all modules for the session
      await this.initializeModulesForSession(workflowSession);

      // Create Step Processor session
      await this.createSession(workflowSession.sessionId, {
        enableStreaming: request.config.enableStreaming,
        maxExecutionTime: request.config.maxExecutionTime,
        retryOnFailure: request.config.retryOnFailure,
        maxRetries: request.config.maxRetries
      });

      // Update session with step information
      const session = this.sessions.get(workflowSession.sessionId)!;
      session.totalSteps = request.steps.length;
      session.executionProgress = {
        sessionId: workflowSession.sessionId,
        totalSteps: request.steps.length,
        completedSteps: 0,
        currentStepIndex: 0,
        currentStepName: request.steps[0] || '',
        overallProgress: 0,
        averageStepDuration: 0,
        lastActivity: new Date()
      };

      // Start streaming if enabled
      if (request.config.enableStreaming && workflowSession.streamId) {
        await this.eventPublisher.publishWorkflowStarted(
          workflowSession.streamId,
          workflowSession.sessionId,
          request.steps.length
        );
      }

      // Start processing first step
      await this.processNextStep(workflowSession.sessionId, 0, request.steps);

      const result: StepProcessingResult = {
        sessionId: workflowSession.sessionId,
        streamId: workflowSession.streamId,
        initialStatus: workflowSession.status,
        estimatedDuration: this.estimateWorkflowDuration(request.steps),
        createdAt: workflowSession.createdAt
      };

      this.logger.logPerformanceMetric('processSteps', Date.now() - startTime, workflowSession.sessionId);
      
      return result;
    } catch (error) {
      const standardError = this.errorHandler.wrapError(
        error,
        'SESSION_CREATION_FAILED',
        'Failed to process steps'
      );
      this.errorHandler.handleError(standardError);
      throw standardError;
    }
  }

  async pauseExecution(workflowSessionId: string): Promise<void> {
    const session = this.getSession(workflowSessionId);
    if (!session) {
      throw StepProcessorErrorHelpers.workflowSessionNotFoundError(workflowSessionId);
    }

    await this.updateSessionStatus(workflowSessionId, SessionStatus.PAUSED);
    
    const workflowSession = this.getWorkflowSession(workflowSessionId);
    if (workflowSession?.streamId) {
      await this.eventPublisher.publishWorkflowPaused(workflowSession.streamId, workflowSessionId);
    }

    // Pause task loop if currently executing
    if (this.dependencies?.taskLoop) {
      await this.dependencies.taskLoop.pauseExecution(workflowSessionId, session.currentStepIndex);
    }
  }

  async resumeExecution(workflowSessionId: string): Promise<void> {
    const session = this.getSession(workflowSessionId);
    if (!session) {
      throw StepProcessorErrorHelpers.workflowSessionNotFoundError(workflowSessionId);
    }

    await this.updateSessionStatus(workflowSessionId, SessionStatus.ACTIVE);
    
    const workflowSession = this.getWorkflowSession(workflowSessionId);
    if (workflowSession?.streamId) {
      await this.eventPublisher.publishWorkflowResumed(workflowSession.streamId, workflowSessionId);
    }

    // Resume task loop
    if (this.dependencies?.taskLoop) {
      await this.dependencies.taskLoop.resumeExecution(workflowSessionId, session.currentStepIndex);
    }
  }

  async cancelExecution(workflowSessionId: string): Promise<void> {
    const session = this.getSession(workflowSessionId);
    if (!session) {
      throw StepProcessorErrorHelpers.workflowSessionNotFoundError(workflowSessionId);
    }

    await this.updateSessionStatus(workflowSessionId, SessionStatus.CANCELLED);
    
    // Cancel task loop execution
    if (this.dependencies?.taskLoop) {
      await this.dependencies.taskLoop.cancelExecution(workflowSessionId, session.currentStepIndex);
    }

    // Cleanup session
    await this.cleanupModulesForSession(workflowSessionId);
    await this.destroySession(workflowSessionId);
  }

  // Session Coordination (delegated to SessionCoordinator)
  getWorkflowSession(workflowSessionId: string): WorkflowSession | null {
    if (!this.dependencies?.sessionCoordinator) {
      return null;
    }
    return this.dependencies.sessionCoordinator.getWorkflowSession(workflowSessionId);
  }

  listActiveWorkflowSessions(): string[] {
    if (!this.dependencies?.sessionCoordinator) {
      return [];
    }
    return this.dependencies.sessionCoordinator.listActiveWorkflowSessions();
  }

  async destroyWorkflowSession(workflowSessionId: string): Promise<void> {
    if (!this.dependencies?.sessionCoordinator) {
      throw StepProcessorErrorHelpers.dependencyResolutionError('SessionCoordinator');
    }
    
    await this.cleanupModulesForSession(workflowSessionId);
    await this.destroySession(workflowSessionId);
    await this.dependencies.sessionCoordinator.destroyWorkflowSession(workflowSessionId);
  }

  // Progress Tracking
  async getExecutionProgress(workflowSessionId: string): Promise<ExecutionProgress> {
    const session = this.getSession(workflowSessionId);
    if (!session) {
      throw StepProcessorErrorHelpers.workflowSessionNotFoundError(workflowSessionId);
    }

    return session.executionProgress;
  }

  async getStepHistory(workflowSessionId: string): Promise<StepExecutionSummary[]> {
    const session = this.getSession(workflowSessionId);
    if (!session) {
      throw StepProcessorErrorHelpers.workflowSessionNotFoundError(workflowSessionId);
    }

    // Step history would be maintained in session metadata
    // For now, return empty array - this could be implemented with persistent storage
    return session.metadata?.stepHistory || [];
  }

  // Dependency Injection
  async initialize(container: DIContainer): Promise<void> {
    try {
      this.dependencies = {
        sessionCoordinator: container.resolve(DEPENDENCY_TOKENS.SESSION_COORDINATOR),
        contextManager: container.resolve(DEPENDENCY_TOKENS.CONTEXT_MANAGER),
        taskLoop: container.resolve(DEPENDENCY_TOKENS.TASK_LOOP),
        executor: container.resolve(DEPENDENCY_TOKENS.EXECUTOR),
        executorStreamer: container.resolve(DEPENDENCY_TOKENS.EXECUTOR_STREAMER),
        aiIntegration: container.resolve(DEPENDENCY_TOKENS.AI_INTEGRATION),
        errorHandler: container.resolve(DEPENDENCY_TOKENS.ERROR_HANDLER),
        logger: container.resolve(DEPENDENCY_TOKENS.LOGGER)
      };

      // Set executor streamer for event publisher
      (this.eventPublisher as StepProcessorEventPublisherImpl).setExecutorStreamer(this.dependencies.executorStreamer);

      // Register as event publisher for Task Loop
      this.dependencies.taskLoop.setEventPublisher(this.eventPublisher);

      this.isInitialized = true;
      this.logger.info('Step Processor initialized successfully', {
        details: { dependenciesResolved: Object.keys(this.dependencies).length }
      });
    } catch (error) {
      const standardError = StepProcessorErrorHelpers.moduleInitializationError('step-processor', error as Error);
      this.errorHandler.handleError(standardError);
      throw standardError;
    }
  }

  // Private helper methods
  private validateInitialization(): void {
    if (!this.isInitialized || !this.dependencies) {
      throw StepProcessorErrorHelpers.moduleInitializationError('step-processor');
    }
  }

  private validateStepProcessingRequest(request: StepProcessingRequest): void {
    if (!request.steps || request.steps.length === 0) {
      throw StepProcessorErrorHelpers.validationError('Steps array cannot be empty');
    }

    if (request.steps.length > STEP_PROCESSOR_LIMITS.MAX_STEPS_PER_WORKFLOW) {
      throw StepProcessorErrorHelpers.validationError(
        `Too many steps: ${request.steps.length}/${STEP_PROCESSOR_LIMITS.MAX_STEPS_PER_WORKFLOW}`
      );
    }

    for (let i = 0; i < request.steps.length; i++) {
      const step = request.steps[i];
      if (!step || typeof step !== 'string') {
        throw StepProcessorErrorHelpers.validationError(`Invalid step at index ${i}: must be a non-empty string`);
      }

      if (step.length > STEP_PROCESSOR_LIMITS.MAX_STEP_CONTENT_LENGTH) {
        throw StepProcessorErrorHelpers.validationError(
          `Step content too long at index ${i}: ${step.length}/${STEP_PROCESSOR_LIMITS.MAX_STEP_CONTENT_LENGTH} characters`
        );
      }
    }

    if (!request.config) {
      throw StepProcessorErrorHelpers.validationError('Processing config is required');
    }
  }

  private async initializeModulesForSession(session: WorkflowSession): Promise<void> {
    try {
      // Initialize AI Context Manager with workflow session
      await this.dependencies!.contextManager.createSession(session.sessionId);
      await this.dependencies!.contextManager.linkExecutorSession(session.sessionId, session.executorSessionId);
      await this.dependencies!.contextManager.setSteps(session.sessionId, session.metadata?.steps || []);

      // Initialize Executor Module with specific executor session ID  
      await this.dependencies!.executor.createSession(session.executorSessionId);

      // Initialize Streaming (if enabled)
      if (session.streamId) {
        await this.dependencies!.executorStreamer.createStream(session.streamId, session.sessionId);
      }

      // Initialize AI Integration
      await this.dependencies!.aiIntegration.validateConnection(session.aiConnectionId);

      this.logger.debug('Initialized all modules for workflow session', {
        sessionId: session.sessionId,
        details: { 
          executorSessionId: session.executorSessionId,
          streamId: session.streamId,
          aiConnectionId: session.aiConnectionId
        }
      });
    } catch (error) {
      throw StepProcessorErrorHelpers.moduleInitializationError('workflow-session-modules', error as Error);
    }
  }

  private async cleanupModulesForSession(sessionId: string): Promise<void> {
    const session = this.getWorkflowSession(sessionId);
    if (!session) return;

    try {
      // Cleanup in reverse order
      if (session.streamId) {
        await this.dependencies!.executorStreamer.destroyStream(session.streamId);
      }
      
      await this.dependencies!.executor.destroySession(session.executorSessionId);
      await this.dependencies!.contextManager.destroySession(session.sessionId);
      
      this.logger.debug('Cleaned up all modules for workflow session', {
        sessionId: session.sessionId
      });
    } catch (error) {
      this.logger.error('Failed to cleanup modules for session', undefined, {
        sessionId,
        details: { error: error instanceof Error ? error.message : String(error) }
      });
    }
  }

  private async processNextStep(sessionId: string, stepIndex: number, steps: string[]): Promise<void> {
    if (stepIndex >= steps.length) {
      // All steps completed
      await this.completeWorkflow(sessionId);
      return;
    }

    const session = this.getSession(sessionId);
    const workflowSession = this.getWorkflowSession(sessionId);
    
    if (!session || !workflowSession) {
      throw StepProcessorErrorHelpers.workflowSessionNotFoundError(sessionId);
    }

    try {
      // Update session progress
      session.currentStepIndex = stepIndex;
      session.executionProgress.currentStepIndex = stepIndex;
      session.executionProgress.currentStepName = steps[stepIndex];
      await this.recordActivity(sessionId);

      // Publish step started event
      if (workflowSession.streamId) {
        await this.eventPublisher.publishStepStarted(
          workflowSession.streamId,
          sessionId,
          stepIndex,
          steps[stepIndex]
        );
      }

      // Process step via Task Loop
      const stepRequest: TaskLoopStepRequest = {
        sessionId,
        stepIndex,
        stepContent: steps[stepIndex],
        streamId: workflowSession.streamId
      };

      // Task Loop will handle the step and publish events back to us
      await this.dependencies!.taskLoop.processStep(stepRequest);
      
    } catch (error) {
      const standardError = this.errorHandler.wrapError(
        error,
        'STEP_PROCESSING_TIMEOUT',
        `Failed to process step ${stepIndex}`
      );

      await this.handleStepError(sessionId, stepIndex, standardError);
    }
  }

  private async completeWorkflow(sessionId: string): Promise<void> {
    const session = this.getSession(sessionId);
    const workflowSession = this.getWorkflowSession(sessionId);
    
    if (!session || !workflowSession) return;

    await this.updateSessionStatus(sessionId, SessionStatus.COMPLETED);
    
    if (workflowSession.streamId) {
      await this.eventPublisher.publishWorkflowCompleted(workflowSession.streamId, sessionId);
    }

    this.logger.logWorkflowCompleted(sessionId, 0);
  }

  private async handleStepError(sessionId: string, stepIndex: number, error: any): Promise<void> {
    const session = this.getSession(sessionId);
    const workflowSession = this.getWorkflowSession(sessionId);
    
    if (!session || !workflowSession) return;

    await this.updateSessionStatus(sessionId, SessionStatus.FAILED);
    
    if (workflowSession.streamId) {
      await this.eventPublisher.publishWorkflowFailed(workflowSession.streamId, sessionId, error);
    }

    await this.errorHandler.handleStepError(sessionId, stepIndex, error);
  }

  private estimateWorkflowDuration(steps: string[]): number {
    // Simple estimation: 30 seconds per step on average
    return steps.length * 30000;
  }
}

// Factory function for creating Step Processor instances
export function createStepProcessor(config?: StepProcessorConfig): IStepProcessor {
  return new StepProcessor(config);
}
