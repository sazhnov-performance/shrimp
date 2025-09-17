/**
 * Step Processor Module Unit Tests
 * Tests all core functionality of the Step Processor module
 */

import { StepProcessor } from '../../../src/modules/step-processor';
import {
  SessionStatus,
  StepProcessingRequest,
  ProcessingConfig,
  TaskLoopEvent,
  TaskLoopEventType,
  StepResult,
  StandardError,
  ErrorCategory,
  ErrorSeverity,
  ExecutionProgress,
  DIContainer,
  DEPENDENCY_TOKENS
} from '../../../types/shared-types';

import {
  StepProcessorConfig,
  StepProcessorErrorType,
  DEFAULT_STEP_PROCESSOR_CONFIG,
  TaskLoopStepRequest
} from '../../../types/step-processor';

// Mock implementations
const mockSessionCoordinator = {
  createWorkflowSession: jest.fn(),
  destroyWorkflowSession: jest.fn(),
  getWorkflowSession: jest.fn(),
  listActiveWorkflowSessions: jest.fn(),
  registerModule: jest.fn(),
  unregisterModule: jest.fn(),
  getModuleSessionManager: jest.fn(),
  linkModuleSession: jest.fn(),
  unlinkModuleSession: jest.fn(),
  getLinkedSessions: jest.fn(),
  onWorkflowSessionCreated: jest.fn(),
  onWorkflowSessionDestroyed: jest.fn(),
  onModuleSessionLinked: jest.fn(),
  getCoordinatorHealth: jest.fn(),
  validateSessionIntegrity: jest.fn()
};

const mockContextManager = {
  createSession: jest.fn(),
  linkExecutorSession: jest.fn(),
  setSteps: jest.fn(),
  destroySession: jest.fn()
};

const mockTaskLoop = {
  processStep: jest.fn(),
  setEventPublisher: jest.fn(),
  pauseExecution: jest.fn(),
  resumeExecution: jest.fn(),
  cancelExecution: jest.fn()
};

const mockExecutor = {
  createSession: jest.fn(),
  destroySession: jest.fn(),
  executeCommand: jest.fn()
};

const mockExecutorStreamer = {
  createStream: jest.fn(),
  destroyStream: jest.fn(),
  publishEvent: jest.fn()
};

const mockAIIntegration = {
  validateConnection: jest.fn()
};

const mockErrorHandler = {
  createStandardError: jest.fn(),
  wrapError: jest.fn(),
  handleError: jest.fn()
};

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

const mockDIContainer: DIContainer = {
  register: jest.fn(),
  resolve: jest.fn((token: string) => {
    switch (token) {
      case DEPENDENCY_TOKENS.SESSION_COORDINATOR:
        return mockSessionCoordinator;
      case DEPENDENCY_TOKENS.CONTEXT_MANAGER:
        return mockContextManager;
      case DEPENDENCY_TOKENS.TASK_LOOP:
        return mockTaskLoop;
      case DEPENDENCY_TOKENS.EXECUTOR:
        return mockExecutor;
      case DEPENDENCY_TOKENS.EXECUTOR_STREAMER:
        return mockExecutorStreamer;
      case DEPENDENCY_TOKENS.AI_INTEGRATION:
        return mockAIIntegration;
      case DEPENDENCY_TOKENS.ERROR_HANDLER:
        return mockErrorHandler;
      case DEPENDENCY_TOKENS.LOGGER:
        return mockLogger;
      default:
        throw new Error(`Unknown dependency token: ${token}`);
    }
  }),
  resolveAll: jest.fn(),
  createScope: jest.fn()
};

describe('StepProcessor', () => {
  let stepProcessor: StepProcessor;
  let config: StepProcessorConfig;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default config
    config = { ...DEFAULT_STEP_PROCESSOR_CONFIG };
    
    // Create new instance
    stepProcessor = new StepProcessor(config);
  });

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      expect(stepProcessor.moduleId).toBe('step-processor');
    });

    it('should initialize dependencies successfully', async () => {
      await stepProcessor.initialize(mockDIContainer);
      
      expect(mockDIContainer.resolve).toHaveBeenCalledWith(DEPENDENCY_TOKENS.SESSION_COORDINATOR);
      expect(mockDIContainer.resolve).toHaveBeenCalledWith(DEPENDENCY_TOKENS.TASK_LOOP);
      expect(mockTaskLoop.setEventPublisher).toHaveBeenCalledWith(stepProcessor);
    });

    it('should handle dependency initialization failure', async () => {
      const error = new Error('Dependency not found');
      const failingContainer = {
        ...mockDIContainer,
        resolve: jest.fn().mockImplementation(() => {
          throw error;
        })
      };

      await expect(stepProcessor.initialize(failingContainer)).rejects.toThrow();
    });
  });

  describe('Session Management', () => {
    beforeEach(async () => {
      await stepProcessor.initialize(mockDIContainer);
    });

    it('should create session successfully', async () => {
      const workflowSessionId = 'workflow-123';
      const sessionId = await stepProcessor.createSession(workflowSessionId);
      
      expect(sessionId).toBeDefined();
      expect(stepProcessor.sessionExists(workflowSessionId)).toBe(true);
      expect(stepProcessor.getSessionStatus(workflowSessionId)).toBe(SessionStatus.ACTIVE);
    });

    it('should not create duplicate sessions', async () => {
      const workflowSessionId = 'workflow-123';
      await stepProcessor.createSession(workflowSessionId);
      
      await expect(stepProcessor.createSession(workflowSessionId)).rejects.toThrow();
    });

    it('should enforce concurrent session limits', async () => {
      const limitedConfig = {
        ...config,
        workflow: { ...config.workflow, maxConcurrentSessions: 2 }
      };
      
      const limitedProcessor = new StepProcessor(limitedConfig);
      await limitedProcessor.initialize(mockDIContainer);
      
      // Create sessions up to limit
      await limitedProcessor.createSession('session-1');
      await limitedProcessor.createSession('session-2');
      
      // Third session should fail
      await expect(limitedProcessor.createSession('session-3')).rejects.toThrow();
    });

    it('should destroy session successfully', async () => {
      const workflowSessionId = 'workflow-123';
      await stepProcessor.createSession(workflowSessionId);
      await stepProcessor.destroySession(workflowSessionId);
      
      expect(stepProcessor.sessionExists(workflowSessionId)).toBe(false);
      expect(stepProcessor.getSession(workflowSessionId)).toBeNull();
    });

    it('should handle destroying non-existent session gracefully', async () => {
      await expect(stepProcessor.destroySession('non-existent')).resolves.not.toThrow();
    });

    it('should update session status', async () => {
      const workflowSessionId = 'workflow-123';
      await stepProcessor.createSession(workflowSessionId);
      
      await stepProcessor.updateSessionStatus(workflowSessionId, SessionStatus.BUSY);
      expect(stepProcessor.getSessionStatus(workflowSessionId)).toBe(SessionStatus.BUSY);
    });

    it('should record activity', async () => {
      const workflowSessionId = 'workflow-123';
      await stepProcessor.createSession(workflowSessionId);
      
      const beforeActivity = stepProcessor.getLastActivity(workflowSessionId);
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      await stepProcessor.recordActivity(workflowSessionId);
      const afterActivity = stepProcessor.getLastActivity(workflowSessionId);
      
      expect(afterActivity).not.toEqual(beforeActivity);
      expect(afterActivity!.getTime()).toBeGreaterThan(beforeActivity!.getTime());
    });

    it('should provide health check', async () => {
      await stepProcessor.createSession('session-1');
      await stepProcessor.createSession('session-2');
      
      const health = await stepProcessor.healthCheck();
      
      expect(health.moduleId).toBe('step-processor');
      expect(health.isHealthy).toBe(true);
      expect(health.activeSessions).toBe(2);
      expect(health.totalSessions).toBe(2);
    });
  });

  describe('Workflow Processing', () => {
    beforeEach(async () => {
      await stepProcessor.initialize(mockDIContainer);
      
      // Setup mock workflow session
      mockSessionCoordinator.createWorkflowSession.mockResolvedValue({
        sessionId: 'workflow-123',
        executorSessionId: 'executor-456',
        streamId: 'stream-789',
        aiConnectionId: 'ai-connection-1',
        createdAt: new Date(),
        lastActivity: new Date(),
        status: SessionStatus.ACTIVE,
        metadata: { steps: ['Step 1', 'Step 2'] }
      });
    });

    it('should process steps successfully', async () => {
      const steps = ['Navigate to example.com', 'Click login button'];
      const processingConfig: ProcessingConfig = {
        maxExecutionTime: 300000,
        enableStreaming: true,
        enableReflection: true,
        retryOnFailure: true,
        maxRetries: 3,
        parallelExecution: false,
        aiConfig: {
          connectionId: 'ai-conn-1',
          model: 'gpt-4',
          temperature: 0.7,
          maxTokens: 2000,
          timeoutMs: 30000
        },
        executorConfig: {
          browserType: 'chromium',
          headless: true,
          timeoutMs: 30000,
          screenshotsEnabled: true
        }
      };

      const request: StepProcessingRequest = {
        steps,
        config: processingConfig
      };

      const result = await stepProcessor.processSteps(request);

      expect(result.sessionId).toBe('workflow-123');
      expect(result.streamId).toBe('stream-789');
      expect(result.initialStatus).toBe(SessionStatus.ACTIVE);
      expect(result.estimatedDuration).toBeGreaterThan(0);
      
      // Verify module initialization calls
      expect(mockContextManager.createSession).toHaveBeenCalledWith('workflow-123');
      expect(mockExecutor.createSession).toHaveBeenCalledWith('executor-456');
      expect(mockExecutorStreamer.createStream).toHaveBeenCalledWith('stream-789', 'workflow-123');
      expect(mockTaskLoop.processStep).toHaveBeenCalled();
    });

    it('should validate steps before processing', async () => {
      const invalidSteps: any[] = [];
      const request: StepProcessingRequest = {
        steps: invalidSteps,
        config: {} as ProcessingConfig
      };

      await expect(stepProcessor.processSteps(request)).rejects.toThrow();
    });

    it('should handle long step content validation', async () => {
      const longStep = 'x'.repeat(3000); // Exceeds max length
      const request: StepProcessingRequest = {
        steps: [longStep],
        config: {} as ProcessingConfig
      };

      await expect(stepProcessor.processSteps(request)).rejects.toThrow();
    });

    it('should pause execution', async () => {
      const workflowSessionId = 'workflow-123';
      await stepProcessor.createSession(workflowSessionId);
      
      await stepProcessor.pauseExecution(workflowSessionId);
      
      expect(stepProcessor.getSessionStatus(workflowSessionId)).toBe(SessionStatus.PAUSED);
    });

    it('should resume execution', async () => {
      const workflowSessionId = 'workflow-123';
      await stepProcessor.createSession(workflowSessionId);
      await stepProcessor.pauseExecution(workflowSessionId);
      
      await stepProcessor.resumeExecution(workflowSessionId);
      
      expect(stepProcessor.getSessionStatus(workflowSessionId)).toBe(SessionStatus.ACTIVE);
    });

    it('should cancel execution', async () => {
      const workflowSessionId = 'workflow-123';
      await stepProcessor.createSession(workflowSessionId);
      
      await stepProcessor.cancelExecution(workflowSessionId);
      
      expect(stepProcessor.sessionExists(workflowSessionId)).toBe(false);
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await stepProcessor.initialize(mockDIContainer);
      await stepProcessor.createSession('workflow-123');
    });

    it('should handle step started event', async () => {
      const event: TaskLoopEvent = {
        type: TaskLoopEventType.STEP_STARTED,
        sessionId: 'workflow-123',
        stepIndex: 0,
        data: {},
        timestamp: new Date()
      };

      await stepProcessor.publishEvent(event);

      const session = stepProcessor.getSession('workflow-123');
      expect(session).not.toBeNull();
    });

    it('should handle step completed event', async () => {
      const stepResult: StepResult = {
        stepIndex: 0,
        success: true,
        executedCommands: [],
        commandResults: [],
        aiReasoning: 'Step completed successfully',
        duration: 5000,
        finalPageState: {
          dom: '<html></html>',
          screenshotId: 'screenshot-123',
          url: 'https://example.com'
        }
      };

      const event: TaskLoopEvent = {
        type: TaskLoopEventType.STEP_COMPLETED,
        sessionId: 'workflow-123',
        stepIndex: 0,
        data: { result: stepResult },
        timestamp: new Date()
      };

      await stepProcessor.publishEvent(event);
      
      // Should not throw and should update internal state
    });

    it('should handle step failed event', async () => {
      const error: StandardError = {
        id: 'error-123',
        category: ErrorCategory.EXECUTION,
        severity: ErrorSeverity.HIGH,
        code: 'TEST_ERROR',
        message: 'Test error',
        timestamp: new Date(),
        moduleId: 'test',
        recoverable: true,
        retryable: true
      };

      const event: TaskLoopEvent = {
        type: TaskLoopEventType.STEP_FAILED,
        sessionId: 'workflow-123',
        stepIndex: 0,
        data: { error },
        timestamp: new Date()
      };

      await stepProcessor.publishEvent(event);

      expect(stepProcessor.getSessionStatus('workflow-123')).toBe(SessionStatus.FAILED);
    });

    it('should handle AI reasoning update event', async () => {
      const event: TaskLoopEvent = {
        type: TaskLoopEventType.AI_REASONING_UPDATE,
        sessionId: 'workflow-123',
        stepIndex: 0,
        data: {
          reasoning: {
            content: 'AI is thinking about the next action',
            confidence: 0.85
          }
        },
        timestamp: new Date()
      };

      await stepProcessor.publishEvent(event);
      
      // Should not throw
    });

    it('should handle command executed event', async () => {
      const event: TaskLoopEvent = {
        type: TaskLoopEventType.COMMAND_EXECUTED,
        sessionId: 'workflow-123',
        stepIndex: 0,
        data: {
          command: {
            command: {} as any,
            result: {} as any
          }
        },
        timestamp: new Date()
      };

      await stepProcessor.publishEvent(event);
      
      // Should not throw
    });

    it('should handle progress update event', async () => {
      const progress: ExecutionProgress = {
        sessionId: 'workflow-123',
        totalSteps: 5,
        completedSteps: 2,
        currentStepIndex: 2,
        currentStepName: 'Current step',
        overallProgress: 40,
        averageStepDuration: 10000,
        lastActivity: new Date()
      };

      const event: TaskLoopEvent = {
        type: TaskLoopEventType.PROGRESS_UPDATE,
        sessionId: 'workflow-123',
        data: { progress },
        timestamp: new Date()
      };

      await stepProcessor.publishEvent(event);
      
      // Should not throw
    });

    it('should handle unknown event types gracefully', async () => {
      const event: TaskLoopEvent = {
        type: 'UNKNOWN_EVENT' as TaskLoopEventType,
        sessionId: 'workflow-123',
        data: {},
        timestamp: new Date()
      };

      await expect(stepProcessor.publishEvent(event)).resolves.not.toThrow();
    });
  });

  describe('Session Coordination', () => {
    beforeEach(async () => {
      await stepProcessor.initialize(mockDIContainer);
    });

    it('should delegate workflow session management to session coordinator', () => {
      const workflowSession = {
        sessionId: 'workflow-123',
        executorSessionId: 'executor-456',
        aiConnectionId: 'ai-1',
        createdAt: new Date(),
        lastActivity: new Date(),
        status: SessionStatus.ACTIVE
      };

      mockSessionCoordinator.getWorkflowSession.mockReturnValue(workflowSession);
      
      const result = stepProcessor.getWorkflowSession('workflow-123');
      
      expect(result).toEqual(workflowSession);
      expect(mockSessionCoordinator.getWorkflowSession).toHaveBeenCalledWith('workflow-123');
    });

    it('should list active workflow sessions', () => {
      const activeSessionIds = ['session-1', 'session-2', 'session-3'];
      mockSessionCoordinator.listActiveWorkflowSessions.mockReturnValue(activeSessionIds);
      
      const result = stepProcessor.listActiveWorkflowSessions();
      
      expect(result).toEqual(activeSessionIds);
      expect(mockSessionCoordinator.listActiveWorkflowSessions).toHaveBeenCalled();
    });

    it('should destroy workflow session with cleanup', async () => {
      const workflowSessionId = 'workflow-123';
      const workflowSession = {
        sessionId: workflowSessionId,
        executorSessionId: 'executor-456',
        streamId: 'stream-789',
        aiConnectionId: 'ai-1',
        createdAt: new Date(),
        lastActivity: new Date(),
        status: SessionStatus.ACTIVE
      };

      mockSessionCoordinator.getWorkflowSession.mockReturnValue(workflowSession);
      
      await stepProcessor.destroyWorkflowSession(workflowSessionId);
      
      expect(mockExecutorStreamer.destroyStream).toHaveBeenCalledWith('stream-789');
      expect(mockExecutor.destroySession).toHaveBeenCalledWith('executor-456');
      expect(mockContextManager.destroySession).toHaveBeenCalledWith(workflowSessionId);
      expect(mockSessionCoordinator.destroyWorkflowSession).toHaveBeenCalledWith(workflowSessionId);
    });
  });

  describe('Progress Tracking', () => {
    beforeEach(async () => {
      await stepProcessor.initialize(mockDIContainer);
    });

    it('should get execution progress', async () => {
      const workflowSessionId = 'workflow-123';
      await stepProcessor.createSession(workflowSessionId);
      
      const progress = await stepProcessor.getExecutionProgress(workflowSessionId);
      
      expect(progress.sessionId).toBe(workflowSessionId);
      expect(progress.totalSteps).toBe(0);
      expect(progress.completedSteps).toBe(0);
      expect(progress.currentStepIndex).toBe(0);
      expect(progress.overallProgress).toBe(0);
    });

    it('should get step history', async () => {
      const workflowSessionId = 'workflow-123';
      await stepProcessor.createSession(workflowSessionId);
      
      const history = await stepProcessor.getStepHistory(workflowSessionId);
      
      expect(Array.isArray(history)).toBe(true);
      // Currently returns empty array as implementation is pending
      expect(history).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await stepProcessor.initialize(mockDIContainer);
    });

    it('should handle session not found errors', async () => {
      await expect(stepProcessor.updateSessionStatus('non-existent', SessionStatus.ACTIVE))
        .rejects.toThrow();
    });

    it('should handle module initialization errors gracefully', async () => {
      const errorContainer: DIContainer = {
        register: jest.fn(),
        resolve: jest.fn(() => {
          throw new Error('Module not found');
        }),
        resolveAll: jest.fn(),
        createScope: jest.fn()
      };

      await expect(stepProcessor.initialize(errorContainer)).rejects.toThrow();
    });

    it('should handle event publishing errors gracefully', async () => {
      await stepProcessor.createSession('workflow-123');
      
      // This should not throw even if the event has invalid data
      const event: TaskLoopEvent = {
        type: TaskLoopEventType.STEP_COMPLETED,
        sessionId: 'workflow-123',
        stepIndex: 0,
        data: { result: null as any }, // Invalid data
        timestamp: new Date()
      };

      await expect(stepProcessor.publishEvent(event)).resolves.not.toThrow();
    });
  });

  describe('Configuration Validation', () => {
    it('should use default config when none provided', () => {
      const processor = new StepProcessor();
      expect(processor.moduleId).toBe('step-processor');
    });

    it('should accept custom configuration', () => {
      const customConfig: StepProcessorConfig = {
        ...DEFAULT_STEP_PROCESSOR_CONFIG,
        workflow: {
          ...DEFAULT_STEP_PROCESSOR_CONFIG.workflow,
          maxConcurrentSessions: 5
        }
      };
      
      const processor = new StepProcessor(customConfig);
      expect(processor.moduleId).toBe('step-processor');
    });
  });
});
