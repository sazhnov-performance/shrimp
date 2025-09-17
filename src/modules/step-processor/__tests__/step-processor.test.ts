/**
 * Step Processor Main Class Unit Tests
 * Tests for the core StepProcessor class functionality
 */

import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { 
  SessionStatus,
  StepProcessingRequest,
  ProcessingConfig,
  DIContainer,
  DEPENDENCY_TOKENS
} from '../../../../types/shared-types';
import { 
  StepProcessor,
  StepProcessorConfig,
  DEFAULT_STEP_PROCESSOR_CONFIG,
  STEP_PROCESSOR_LIMITS 
} from '../index';

// Mock dependencies
const mockSessionCoordinator = {
  createWorkflowSession: jest.fn(),
  destroyWorkflowSession: jest.fn(),
  getWorkflowSession: jest.fn(),
  listActiveWorkflowSessions: jest.fn()
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
  validateConnection: jest.fn(),
  sendRequest: jest.fn()
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
  error: jest.fn(),
  logWorkflowStarted: jest.fn(),
  logWorkflowCompleted: jest.fn(),
  logWorkflowFailed: jest.fn(),
  logStepStarted: jest.fn(),
  logStepCompleted: jest.fn(),
  logStepFailed: jest.fn(),
  logSessionCreated: jest.fn(),
  logSessionDestroyed: jest.fn(),
  logEventPublished: jest.fn(),
  logDependencyResolution: jest.fn(),
  logPerformanceMetric: jest.fn()
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
        throw new Error(`Unknown dependency: ${token}`);
    }
  }),
  resolveAll: jest.fn(),
  createScope: jest.fn()
};

describe('StepProcessor', () => {
  let stepProcessor: StepProcessor;
  let config: StepProcessorConfig;

  beforeEach(() => {
    config = { ...DEFAULT_STEP_PROCESSOR_CONFIG };
    stepProcessor = new StepProcessor(config);
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default mock behaviors
    mockSessionCoordinator.createWorkflowSession.mockResolvedValue({
      sessionId: 'test-session-id',
      executorSessionId: 'test-executor-session-id', 
      streamId: 'test-stream-id',
      aiConnectionId: 'test-ai-connection-id',
      createdAt: new Date(),
      lastActivity: new Date(),
      status: SessionStatus.ACTIVE,
      metadata: { steps: ['step1', 'step2'] }
    });
    
    mockContextManager.createSession.mockResolvedValue('test-context-session-id');
    mockExecutor.createSession.mockResolvedValue('test-executor-session-id');
    mockAIIntegration.validateConnection.mockResolvedValue(true);
    mockTaskLoop.processStep.mockResolvedValue({
      stepIndex: 0,
      success: true,
      executedCommands: [],
      commandResults: [],
      aiReasoning: 'test reasoning',
      duration: 1000,
      finalPageState: {
        dom: '<html></html>',
        screenshotId: 'test-screenshot',
        url: 'https://example.com'
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should create instance with default config', () => {
      const processor = new StepProcessor();
      expect(processor.moduleId).toBe('step-processor');
    });

    it('should create instance with custom config', () => {
      const customConfig = {
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

  describe('Initialization', () => {
    it('should initialize successfully with all dependencies', async () => {
      await stepProcessor.initialize(mockDIContainer);
      
      expect(mockDIContainer.resolve).toHaveBeenCalledTimes(8);
      expect(mockTaskLoop.setEventPublisher).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should throw error if dependency resolution fails', async () => {
      const failingContainer = {
        ...mockDIContainer,
        resolve: jest.fn().mockImplementation((token: string) => {
          throw new Error(`Dependency not found: ${token}`);
        })
      };

      await expect(stepProcessor.initialize(failingContainer)).rejects.toThrow('Dependency not found');
    });
  });

  describe('Session Management', () => {
    beforeEach(async () => {
      await stepProcessor.initialize(mockDIContainer);
    });

    it('should create session successfully', async () => {
      const sessionId = await stepProcessor.createSession('test-workflow-session');
      
      expect(sessionId).toBe('test-workflow-session');
      expect(stepProcessor.sessionExists('test-workflow-session')).toBe(true);
      expect(stepProcessor.getSessionStatus('test-workflow-session')).toBe(SessionStatus.ACTIVE);
    });

    it('should prevent duplicate session creation', async () => {
      await stepProcessor.createSession('test-session');
      
      await expect(stepProcessor.createSession('test-session')).rejects.toThrow();
    });

    it('should enforce concurrent session limits', async () => {
      const limitedConfig = {
        ...config,
        workflow: { ...config.workflow, maxConcurrentSessions: 1 }
      };
      const limitedProcessor = new StepProcessor(limitedConfig);
      await limitedProcessor.initialize(mockDIContainer);
      
      await limitedProcessor.createSession('session-1');
      await expect(limitedProcessor.createSession('session-2')).rejects.toThrow();
    });

    it('should destroy session successfully', async () => {
      await stepProcessor.createSession('test-session');
      await stepProcessor.destroySession('test-session');
      
      expect(stepProcessor.sessionExists('test-session')).toBe(false);
    });

    it('should handle destroying non-existent session gracefully', async () => {
      await expect(stepProcessor.destroySession('non-existent')).resolves.not.toThrow();
    });

    it('should update session status', async () => {
      await stepProcessor.createSession('test-session');
      await stepProcessor.updateSessionStatus('test-session', SessionStatus.PAUSED);
      
      expect(stepProcessor.getSessionStatus('test-session')).toBe(SessionStatus.PAUSED);
    });

    it('should record activity', async () => {
      await stepProcessor.createSession('test-session');
      const beforeActivity = stepProcessor.getLastActivity('test-session');
      
      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 1));
      
      await stepProcessor.recordActivity('test-session');
      const afterActivity = stepProcessor.getLastActivity('test-session');
      
      expect(afterActivity).toBeDefined();
      expect(afterActivity!.getTime()).toBeGreaterThanOrEqual(beforeActivity!.getTime());
    });
  });

  describe('Workflow Processing', () => {
    beforeEach(async () => {
      await stepProcessor.initialize(mockDIContainer);
    });

    it('should process steps successfully', async () => {
      const request: StepProcessingRequest = {
        steps: ['step 1', 'step 2'],
        config: {
          maxExecutionTime: 300000,
          enableStreaming: true,
          enableReflection: true,
          retryOnFailure: true,
          maxRetries: 3,
          parallelExecution: false,
          aiConfig: {
            connectionId: 'test-connection',
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
        }
      };

      const result = await stepProcessor.processSteps(request);
      
      expect(result).toMatchObject({
        sessionId: expect.any(String),
        streamId: expect.any(String),
        initialStatus: SessionStatus.ACTIVE,
        createdAt: expect.any(Date)
      });
      
      expect(mockSessionCoordinator.createWorkflowSession).toHaveBeenCalledWith(
        request.steps,
        request.config
      );
    });

    it('should validate step processing request', async () => {
      const invalidRequest: StepProcessingRequest = {
        steps: [], // Empty steps array
        config: {} as ProcessingConfig
      };

      await expect(stepProcessor.processSteps(invalidRequest)).rejects.toThrow();
    });

    it('should enforce step limits', async () => {
      const tooManySteps = new Array(STEP_PROCESSOR_LIMITS.MAX_STEPS_PER_WORKFLOW + 1)
        .fill('step');
      
      const request: StepProcessingRequest = {
        steps: tooManySteps,
        config: {} as ProcessingConfig
      };

      await expect(stepProcessor.processSteps(request)).rejects.toThrow();
    });

    it('should enforce step content length limits', async () => {
      const longStep = 'a'.repeat(STEP_PROCESSOR_LIMITS.MAX_STEP_CONTENT_LENGTH + 1);
      
      const request: StepProcessingRequest = {
        steps: [longStep],
        config: {} as ProcessingConfig
      };

      await expect(stepProcessor.processSteps(request)).rejects.toThrow();
    });
  });

  describe('Execution Control', () => {
    beforeEach(async () => {
      await stepProcessor.initialize(mockDIContainer);
      await stepProcessor.createSession('test-session');
    });

    it('should pause execution', async () => {
      await stepProcessor.pauseExecution('test-session');
      
      expect(stepProcessor.getSessionStatus('test-session')).toBe(SessionStatus.PAUSED);
      expect(mockTaskLoop.pauseExecution).toHaveBeenCalledWith('test-session', 0);
    });

    it('should resume execution', async () => {
      await stepProcessor.pauseExecution('test-session');
      await stepProcessor.resumeExecution('test-session');
      
      expect(stepProcessor.getSessionStatus('test-session')).toBe(SessionStatus.ACTIVE);
      expect(mockTaskLoop.resumeExecution).toHaveBeenCalledWith('test-session', 0);
    });

    it('should cancel execution', async () => {
      await stepProcessor.cancelExecution('test-session');
      
      expect(stepProcessor.getSessionStatus('test-session')).toBe(SessionStatus.CANCELLED);
      expect(mockTaskLoop.cancelExecution).toHaveBeenCalledWith('test-session', 0);
    });

    it('should handle execution control for non-existent session', async () => {
      await expect(stepProcessor.pauseExecution('non-existent')).rejects.toThrow();
      await expect(stepProcessor.resumeExecution('non-existent')).rejects.toThrow();
      await expect(stepProcessor.cancelExecution('non-existent')).rejects.toThrow();
    });
  });

  describe('Progress Tracking', () => {
    beforeEach(async () => {
      await stepProcessor.initialize(mockDIContainer);
      await stepProcessor.createSession('test-session');
    });

    it('should get execution progress', async () => {
      const progress = await stepProcessor.getExecutionProgress('test-session');
      
      expect(progress).toMatchObject({
        sessionId: 'test-session',
        totalSteps: 0,
        completedSteps: 0,
        currentStepIndex: 0,
        overallProgress: 0
      });
    });

    it('should get step history', async () => {
      const history = await stepProcessor.getStepHistory('test-session');
      
      expect(Array.isArray(history)).toBe(true);
    });

    it('should handle progress tracking for non-existent session', async () => {
      await expect(stepProcessor.getExecutionProgress('non-existent')).rejects.toThrow();
      await expect(stepProcessor.getStepHistory('non-existent')).rejects.toThrow();
    });
  });

  describe('Health Check', () => {
    it('should report unhealthy when not initialized', async () => {
      const health = await stepProcessor.healthCheck();
      
      expect(health.isHealthy).toBe(false);
      expect(health.errors).toHaveLength(2); // Not initialized + missing dependencies
    });

    it('should report healthy when properly initialized', async () => {
      await stepProcessor.initialize(mockDIContainer);
      
      const health = await stepProcessor.healthCheck();
      
      expect(health.isHealthy).toBe(true);
      expect(health.moduleId).toBe('step-processor');
      expect(health.activeSessions).toBe(0);
    });

    it('should report session count correctly', async () => {
      await stepProcessor.initialize(mockDIContainer);
      await stepProcessor.createSession('session-1');
      await stepProcessor.createSession('session-2');
      
      const health = await stepProcessor.healthCheck();
      
      expect(health.activeSessions).toBe(2);
      expect(health.totalSessions).toBe(2);
    });
  });

  describe('Session Coordination', () => {
    beforeEach(async () => {
      await stepProcessor.initialize(mockDIContainer);
    });

    it('should delegate workflow session operations to coordinator', () => {
      stepProcessor.getWorkflowSession('test-session');
      expect(mockSessionCoordinator.getWorkflowSession).toHaveBeenCalledWith('test-session');
      
      stepProcessor.listActiveWorkflowSessions();
      expect(mockSessionCoordinator.listActiveWorkflowSessions).toHaveBeenCalled();
    });

    it('should handle missing session coordinator gracefully', () => {
      const uninitializedProcessor = new StepProcessor();
      
      expect(uninitializedProcessor.getWorkflowSession('test')).toBe(null);
      expect(uninitializedProcessor.listActiveWorkflowSessions()).toEqual([]);
    });
  });

  describe('Error Scenarios', () => {
    beforeEach(async () => {
      await stepProcessor.initialize(mockDIContainer);
    });

    it('should handle module initialization failures', async () => {
      mockContextManager.createSession.mockRejectedValue(new Error('Context manager error'));
      
      const request: StepProcessingRequest = {
        steps: ['step 1'],
        config: {} as ProcessingConfig
      };

      await expect(stepProcessor.processSteps(request)).rejects.toThrow();
    });

    it('should handle task loop failures', async () => {
      mockTaskLoop.processStep.mockRejectedValue(new Error('Task loop error'));
      
      const request: StepProcessingRequest = {
        steps: ['step 1'],
        config: {} as ProcessingConfig
      };

      await expect(stepProcessor.processSteps(request)).rejects.toThrow();
    });

    it('should handle streaming failures gracefully', async () => {
      mockExecutorStreamer.createStream.mockRejectedValue(new Error('Streaming error'));
      
      const request: StepProcessingRequest = {
        steps: ['step 1'],
        config: {
          enableStreaming: true
        } as ProcessingConfig
      };

      // Should not fail even if streaming fails
      await expect(stepProcessor.processSteps(request)).rejects.toThrow();
    });
  });
});
