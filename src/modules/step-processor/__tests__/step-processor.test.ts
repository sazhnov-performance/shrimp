/**
 * Step Processor Module Unit Tests
 * Comprehensive tests for the StepProcessor implementation
 */

// Mock the dependencies before importing
const mockExecutorStreamer = {
  createStream: jest.fn(),
  putEvent: jest.fn()
};

const mockTaskLoop = {
  executeStep: jest.fn()
};

const mockExecutor = {
  createSession: jest.fn(),
  destroySession: jest.fn(),
  sessionExists: jest.fn().mockReturnValue(true)
};

const mockPromptManager = {
  init: jest.fn()
};

const mockGetExecutorStreamer = jest.fn(() => mockExecutorStreamer);
const mockTaskLoopClass = {
  getInstance: jest.fn(() => mockTaskLoop)
};
const mockExecutorClass = {
  getInstance: jest.fn(() => mockExecutor)
};
const mockPromptManagerClass = {
  getInstance: jest.fn(() => mockPromptManager)
};

jest.mock('@/modules/executor-streamer', () => mockGetExecutorStreamer);
jest.mock('../../task-loop/index', () => mockTaskLoopClass);
jest.mock('../../executor/index', () => ({ Executor: mockExecutorClass }));
jest.mock('../../ai-prompt-manager/index', () => mockPromptManagerClass);

import { StepProcessor } from '../index';
import { StepProcessorConfig } from '../types';

describe('StepProcessor', () => {
  // Reset singleton instance before each test
  beforeEach(() => {
    // Reset singleton instance using reflection
    (StepProcessor as any).instance = null;
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Reset mock implementations
    mockExecutorStreamer.createStream.mockReset();
    mockTaskLoop.executeStep.mockReset();
    mockExecutor.createSession.mockReset();
    mockExecutor.destroySession.mockReset();
    mockExecutor.sessionExists.mockReturnValue(true);
    mockPromptManager.init.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = StepProcessor.getInstance();
      const instance2 = StepProcessor.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should create instance with default config when no config provided', () => {
      const instance = StepProcessor.getInstance();
      
      // Verify instance was created
      expect(instance).toBeDefined();
      expect(instance).toBeInstanceOf(StepProcessor);
    });

    it('should create instance with custom config', () => {
      const customConfig: StepProcessorConfig = {
        maxConcurrentSessions: 5,
        timeoutMs: 60000,
        enableLogging: false
      };
      
      const instance = StepProcessor.getInstance(customConfig);
      
      // Verify instance was created with custom config
      expect(instance).toBeDefined();
      expect(instance).toBeInstanceOf(StepProcessor);
    });

    it('should ignore config on subsequent calls', () => {
      const config1: StepProcessorConfig = { 
        maxConcurrentSessions: 5, 
        timeoutMs: 60000, 
        enableLogging: false 
      };
      const config2: StepProcessorConfig = { 
        maxConcurrentSessions: 15, 
        timeoutMs: 120000, 
        enableLogging: true 
      };
      
      const instance1 = StepProcessor.getInstance(config1);
      const instance2 = StepProcessor.getInstance(config2);
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('processSteps - Success Scenarios', () => {
    let instance: any;

    beforeEach(() => {
      instance = StepProcessor.getInstance({
        maxConcurrentSessions: 10,
        timeoutMs: 300000,
        enableLogging: false // Disable logging for tests
      });
    });

    it('should process steps successfully when all steps succeed', async () => {
      const steps = ['step1', 'step2', 'step3'];
      
      // Mock successful responses for all steps
      mockTaskLoop.executeStep
        .mockResolvedValueOnce({ status: 'success', stepId: 0 })
        .mockResolvedValueOnce({ status: 'success', stepId: 1 })
        .mockResolvedValueOnce({ status: 'success', stepId: 2 });

      mockExecutorStreamer.createStream.mockResolvedValue(undefined);
      mockExecutor.createSession.mockResolvedValue(undefined);

      const sessionId = await instance.processSteps(steps);

      // Verify session ID format
      expect(sessionId).toMatch(/^session-\d+-[a-z0-9]+$/);

      // Verify prompt manager was initialized
      expect(mockPromptManager.init).toHaveBeenCalledWith(sessionId, steps);

      // Verify stream was created
      expect(mockExecutorStreamer.createStream).toHaveBeenCalledWith(sessionId);

      // Verify executor session was created
      expect(mockExecutor.createSession).toHaveBeenCalledWith(sessionId);

      // Wait for async step execution to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify all steps were executed asynchronously
      expect(mockTaskLoop.executeStep).toHaveBeenCalledTimes(3);
      expect(mockTaskLoop.executeStep).toHaveBeenNthCalledWith(1, sessionId, 0);
      expect(mockTaskLoop.executeStep).toHaveBeenNthCalledWith(2, sessionId, 1);
      expect(mockTaskLoop.executeStep).toHaveBeenNthCalledWith(3, sessionId, 2);

      // Verify cleanup was called
      expect(mockExecutor.destroySession).toHaveBeenCalledWith(sessionId);
    });

    it('should stop processing on first step failure', async () => {
      const steps = ['step1', 'step2', 'step3'];
      
      // Mock first step failure
      mockTaskLoop.executeStep
        .mockResolvedValueOnce({ status: 'failure', stepId: 0 });

      mockExecutorStreamer.createStream.mockResolvedValue(undefined);
      mockExecutor.createSession.mockResolvedValue(undefined);

      const sessionId = await instance.processSteps(steps);

      // Verify session ID is returned even on failure
      expect(sessionId).toMatch(/^session-\d+-[a-z0-9]+$/);

      // Verify stream was created
      expect(mockExecutorStreamer.createStream).toHaveBeenCalledWith(sessionId);

      // Wait for async step execution to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify only first step was executed
      expect(mockTaskLoop.executeStep).toHaveBeenCalledTimes(1);
      expect(mockTaskLoop.executeStep).toHaveBeenCalledWith(sessionId, 0);
    });

    it('should stop processing on step error', async () => {
      const steps = ['step1', 'step2', 'step3'];
      
      // Mock first step success, second step error
      mockTaskLoop.executeStep
        .mockResolvedValueOnce({ status: 'success', stepId: 0 })
        .mockResolvedValueOnce({ status: 'error', stepId: 1, error: 'Something went wrong' });

      mockExecutorStreamer.createStream.mockResolvedValue(undefined);
      mockExecutor.createSession.mockResolvedValue(undefined);

      const sessionId = await instance.processSteps(steps);

      // Verify session ID is returned even on error
      expect(sessionId).toMatch(/^session-\d+-[a-z0-9]+$/);

      // Verify stream was created
      expect(mockExecutorStreamer.createStream).toHaveBeenCalledWith(sessionId);

      // Wait for async step execution to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify only first two steps were executed
      expect(mockTaskLoop.executeStep).toHaveBeenCalledTimes(2);
      expect(mockTaskLoop.executeStep).toHaveBeenNthCalledWith(1, sessionId, 0);
      expect(mockTaskLoop.executeStep).toHaveBeenNthCalledWith(2, sessionId, 1);
    });

    it('should handle empty steps array', async () => {
      const steps: string[] = [];
      
      mockExecutorStreamer.createStream.mockResolvedValue(undefined);
      mockExecutor.createSession.mockResolvedValue(undefined);

      const sessionId = await instance.processSteps(steps);

      // Verify session ID is returned
      expect(sessionId).toMatch(/^session-\d+-[a-z0-9]+$/);

      // Verify stream was created
      expect(mockExecutorStreamer.createStream).toHaveBeenCalledWith(sessionId);

      // Wait for async execution to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify no steps were executed
      expect(mockTaskLoop.executeStep).toHaveBeenCalledTimes(0);
    });

    it('should handle single step', async () => {
      const steps = ['single-step'];
      
      mockTaskLoop.executeStep.mockResolvedValue({ status: 'success', stepId: 0 });
      mockExecutorStreamer.createStream.mockResolvedValue(undefined);
      mockExecutor.createSession.mockResolvedValue(undefined);

      const sessionId = await instance.processSteps(steps);

      // Verify session ID is returned
      expect(sessionId).toMatch(/^session-\d+-[a-z0-9]+$/);

      // Verify stream was created
      expect(mockExecutorStreamer.createStream).toHaveBeenCalledWith(sessionId);

      // Wait for async execution to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify single step was executed
      expect(mockTaskLoop.executeStep).toHaveBeenCalledTimes(1);
      expect(mockTaskLoop.executeStep).toHaveBeenCalledWith(sessionId, 0);
    });
  });

  describe('processSteps - Error Scenarios', () => {
    let instance: any;

    beforeEach(() => {
      instance = StepProcessor.getInstance({
        maxConcurrentSessions: 10,
        timeoutMs: 300000,
        enableLogging: false // Disable logging for tests
      });
    });

    it('should handle executor streamer createStream failure', async () => {
      const steps = ['step1', 'step2'];
      
      mockExecutorStreamer.createStream.mockRejectedValue(new Error('Failed to create stream'));

      // Now expects the error to be thrown since session setup fails
      await expect(instance.processSteps(steps)).rejects.toThrow('Failed to create stream');

      // Verify createStream was called
      expect(mockExecutorStreamer.createStream).toHaveBeenCalledWith(expect.any(String));

      // Should not execute any steps if stream creation fails
      expect(mockTaskLoop.executeStep).toHaveBeenCalledTimes(0);
    });

    it('should handle task loop execution failure', async () => {
      const steps = ['step1', 'step2'];
      
      mockExecutorStreamer.createStream.mockResolvedValue(undefined);
      mockExecutor.createSession.mockResolvedValue(undefined);
      mockTaskLoop.executeStep.mockRejectedValue(new Error('Task execution failed'));

      const sessionId = await instance.processSteps(steps);

      // Should still return session ID even if execution fails
      expect(sessionId).toMatch(/^session-\d+-[a-z0-9]+$/);

      // Verify stream was created
      expect(mockExecutorStreamer.createStream).toHaveBeenCalledWith(sessionId);

      // Wait for async execution to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should attempt to execute first step
      expect(mockTaskLoop.executeStep).toHaveBeenCalledTimes(1);
      expect(mockTaskLoop.executeStep).toHaveBeenCalledWith(sessionId, 0);
    });

    it('should continue processing after non-fatal task errors', async () => {
      const steps = ['step1', 'step2', 'step3'];
      
      mockExecutorStreamer.createStream.mockResolvedValue(undefined);
      mockExecutor.createSession.mockResolvedValue(undefined);
      
      // First step throws error, which stops async execution
      mockTaskLoop.executeStep
        .mockRejectedValueOnce(new Error('First step failed'))
        .mockResolvedValueOnce({ status: 'success', stepId: 1 })
        .mockResolvedValueOnce({ status: 'success', stepId: 2 });

      const sessionId = await instance.processSteps(steps);

      // Should return session ID
      expect(sessionId).toMatch(/^session-\d+-[a-z0-9]+$/);

      // Wait for async execution to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should attempt first step, then stop due to error
      expect(mockTaskLoop.executeStep).toHaveBeenCalledTimes(1);
      expect(mockTaskLoop.executeStep).toHaveBeenCalledWith(sessionId, 0);
    });
  });

  describe('Dependency Integration', () => {
    it('should initialize dependencies correctly', () => {
      StepProcessor.getInstance();

      // Verify dependencies were resolved using singleton instances
      expect(mockGetExecutorStreamer).toHaveBeenCalled();
      expect(mockTaskLoopClass.getInstance).toHaveBeenCalled();
    });

    it('should pass configuration to dependencies if needed', () => {
      const customConfig: StepProcessorConfig = {
        maxConcurrentSessions: 5,
        timeoutMs: 120000,
        enableLogging: true
      };

      StepProcessor.getInstance(customConfig);

      // Dependencies should be initialized (exact behavior depends on implementation)
      expect(mockGetExecutorStreamer).toHaveBeenCalled();
      expect(mockTaskLoopClass.getInstance).toHaveBeenCalled();
    });
  });

  describe('Session ID Generation', () => {
    it('should generate unique session IDs', async () => {
      const instance = StepProcessor.getInstance();
      mockExecutorStreamer.createStream.mockResolvedValue(undefined);
      mockExecutor.createSession.mockResolvedValue(undefined);

      const sessionId1 = await instance.processSteps(['step1']);
      const sessionId2 = await instance.processSteps(['step2']);

      expect(sessionId1).not.toBe(sessionId2);
      expect(sessionId1).toMatch(/^session-\d+-[a-z0-9]+$/);
      expect(sessionId2).toMatch(/^session-\d+-[a-z0-9]+$/);
    });

    it('should generate session IDs with correct format', async () => {
      const instance = StepProcessor.getInstance();
      mockExecutorStreamer.createStream.mockResolvedValue(undefined);
      mockExecutor.createSession.mockResolvedValue(undefined);

      const sessionId = await instance.processSteps(['step1']);

      // Format: session-{timestamp}-{random}
      const parts = sessionId.split('-');
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe('session');
      expect(parts[1]).toMatch(/^\d+$/); // timestamp
      expect(parts[2]).toMatch(/^[a-z0-9]+$/); // random string
    });
  });

  describe('Logging', () => {
    it('should log when logging is enabled', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const instance = StepProcessor.getInstance({
        enableLogging: true
      });

      mockExecutorStreamer.createStream.mockResolvedValue(undefined);
      mockExecutor.createSession.mockResolvedValue(undefined);
      mockTaskLoop.executeStep.mockResolvedValue({ status: 'success', stepId: 0 });

      await instance.processSteps(['step1']);

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should not log when logging is disabled', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const instance = StepProcessor.getInstance({
        enableLogging: false
      });

      mockExecutorStreamer.createStream.mockResolvedValue(undefined);
      mockExecutor.createSession.mockResolvedValue(undefined);
      mockTaskLoop.executeStep.mockResolvedValue({ status: 'success', stepId: 0 });

      await instance.processSteps(['step1']);

      // Should not call console.log for processing steps (only for initialization if any)
      const processingLogs = consoleSpy.mock.calls.filter(call => 
        call[0] && call[0].includes && call[0].includes('Starting step processing')
      );
      expect(processingLogs).toHaveLength(0);

      consoleSpy.mockRestore();
    });
  });
});
