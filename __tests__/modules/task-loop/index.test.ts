/**
 * Task Loop Module Tests
 * Unit tests for the main TaskLoop implementation
 */

import { TaskLoop } from '../../../src/modules/task-loop/index';
import { 
  StepResult, 
  AIResponse, 
  TaskLoopError,
  ValidationError,
  IAIContextManager,
  IAIPromptManager,
  IAIIntegrationManager,
  IAISchemaManager,
  IExecutorSessionManager
} from '../../../src/modules/task-loop/types';
import { ERROR_MESSAGES, FLOW_CONTROL } from '../../../src/modules/task-loop/config';

// Mock dependencies
const mockContextManager: jest.Mocked<IAIContextManager> = {
  createContext: jest.fn(),
  setSteps: jest.fn(),
  logTask: jest.fn(),
  getStepContext: jest.fn(),
  getFullContext: jest.fn()
};

const mockPromptManager: jest.Mocked<IAIPromptManager> = {
  getStepPrompt: jest.fn()
};

const mockAIIntegration: jest.Mocked<IAIIntegrationManager> = {
  sendRequest: jest.fn()
};

const mockSchemaManager: jest.Mocked<IAISchemaManager> = {
  getAIResponseSchema: jest.fn()
};

const mockExecutor: jest.Mocked<IExecutorSessionManager> = {
  moduleId: 'executor',
  createSession: jest.fn(),
  destroySession: jest.fn(),
  getSession: jest.fn(),
  sessionExists: jest.fn(),
  updateSessionStatus: jest.fn(),
  getSessionStatus: jest.fn(),
  recordActivity: jest.fn(),
  getLastActivity: jest.fn(),
  setLifecycleCallbacks: jest.fn(),
  healthCheck: jest.fn(),
  getExecutorSession: jest.fn(),
  executeCommand: jest.fn()
};

describe('TaskLoop', () => {
  let taskLoop: TaskLoop;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create fresh instance
    taskLoop = new TaskLoop(
      mockContextManager,
      mockPromptManager,
      mockAIIntegration,
      mockSchemaManager,
      mockExecutor,
      { enableLogging: false } // Disable logging for tests
    );

    // Setup default mock returns
    mockPromptManager.getStepPrompt.mockReturnValue('Test prompt');
    mockSchemaManager.getAIResponseSchema.mockReturnValue({});
    mockExecutor.getExecutorSession.mockReturnValue({ 
      moduleId: 'executor',
      sessionId: 'test-session',
      linkedWorkflowSessionId: 'test-workflow',
      status: 'ACTIVE' as any,
      createdAt: new Date(),
      lastActivity: new Date(),
      browser: {} as any,
      page: {} as any,
      variables: new Map()
    });
  });

  describe('executeStep', () => {
    const sessionId = 'test-session';
    const stepId = 1;

    it('should successfully execute a step with stop_success flow control', async () => {
      // Setup mocks
      const aiResponse = {
        status: 'success' as const,
        data: {
          reasoning: 'Test reasoning',
          confidence: 85,
          flowControl: FLOW_CONTROL.STOP_SUCCESS
        }
      };
      mockAIIntegration.sendRequest.mockResolvedValue(aiResponse);

      // Execute
      const result = await taskLoop.executeStep(sessionId, stepId);

      // Assertions
      expect(result.status).toBe('success');
      expect(result.stepId).toBe(stepId);
      expect(result.iterations).toBe(1);
      expect(result.finalResponse).toMatchObject({
        reasoning: 'Test reasoning',
        confidence: 85,
        flowControl: FLOW_CONTROL.STOP_SUCCESS
      });
      expect(mockPromptManager.getStepPrompt).toHaveBeenCalledWith(sessionId, stepId);
      expect(mockAIIntegration.sendRequest).toHaveBeenCalledWith('Test prompt');
      expect(mockContextManager.logTask).toHaveBeenCalled();
    });

    it('should successfully execute a step with continue flow control and action', async () => {
      // Setup mocks for multiple iterations
      const firstResponse = {
        status: 'success' as const,
        data: {
          reasoning: 'First iteration',
          confidence: 70,
          flowControl: FLOW_CONTROL.CONTINUE,
          action: {
            command: 'OPEN_PAGE',
            parameters: { url: 'https://example.com' }
          }
        }
      };
      
      const secondResponse = {
        status: 'success' as const,
        data: {
          reasoning: 'Second iteration - success',
          confidence: 90,
          flowControl: FLOW_CONTROL.STOP_SUCCESS
        }
      };

      mockAIIntegration.sendRequest
        .mockResolvedValueOnce(firstResponse)
        .mockResolvedValueOnce(secondResponse);

      // Execute
      const result = await taskLoop.executeStep(sessionId, stepId);

      // Assertions
      expect(result.status).toBe('success');
      expect(result.iterations).toBe(2);
      expect(mockExecutor.executeCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId,
          action: 'OPEN_PAGE',
          parameters: { url: 'https://example.com' }
        })
      );
    });

    it('should return failure when AI responds with stop_failure', async () => {
      const aiResponse = {
        status: 'success' as const,
        data: {
          reasoning: 'Failed to complete task',
          confidence: 30,
          flowControl: FLOW_CONTROL.STOP_FAILURE
        }
      };
      mockAIIntegration.sendRequest.mockResolvedValue(aiResponse);

      const result = await taskLoop.executeStep(sessionId, stepId);

      expect(result.status).toBe('failure');
      expect(result.finalResponse?.flowControl).toBe(FLOW_CONTROL.STOP_FAILURE);
    });

    it('should return error when maximum iterations exceeded', async () => {
      const aiResponse = {
        status: 'success' as const,
        data: {
          reasoning: 'Continue indefinitely',
          confidence: 50,
          flowControl: FLOW_CONTROL.CONTINUE,
          action: {
            command: 'CLICK_ELEMENT',
            parameters: { selector: '.test' }
          }
        }
      };
      mockAIIntegration.sendRequest.mockResolvedValue(aiResponse);

      const result = await taskLoop.executeStep(sessionId, stepId);

      expect(result.status).toBe('error');
      expect(result.error).toBe(ERROR_MESSAGES.MAX_ITERATIONS_EXCEEDED);
      expect(result.iterations).toBe(10); // Default max iterations
    });

    it('should handle AI integration errors', async () => {
      mockAIIntegration.sendRequest.mockResolvedValue({
        status: 'error',
        error: 'AI service unavailable'
      });

      const result = await taskLoop.executeStep(sessionId, stepId);

      expect(result.status).toBe('error');
      expect(result.error).toContain('AI request failed');
    });

    it('should handle validation errors', async () => {
      const aiResponse = {
        status: 'success' as const,
        data: {
          // Missing required fields
          reasoning: 'Test'
        }
      };
      mockAIIntegration.sendRequest.mockResolvedValue(aiResponse);

      const result = await taskLoop.executeStep(sessionId, stepId);

      expect(result.status).toBe('error');
      expect(result.error).toContain('confidence');
    });

    it('should handle executor session not found', async () => {
      mockExecutor.getExecutorSession.mockReturnValue(null);
      
      const aiResponse = {
        status: 'success' as const,
        data: {
          reasoning: 'Test reasoning',
          confidence: 85,
          flowControl: FLOW_CONTROL.CONTINUE,
          action: {
            command: 'OPEN_PAGE',
            parameters: { url: 'https://example.com' }
          }
        }
      };
      mockAIIntegration.sendRequest.mockResolvedValue(aiResponse);

      const result = await taskLoop.executeStep(sessionId, stepId);

      expect(result.status).toBe('error');
      expect(result.error).toContain('Executor session not found');
    });

    it('should handle prompt generation errors', async () => {
      mockPromptManager.getStepPrompt.mockImplementation(() => {
        throw new Error('Prompt generation failed');
      });

      const result = await taskLoop.executeStep(sessionId, stepId);

      expect(result.status).toBe('error');
      expect(result.error).toContain('Failed to get step prompt');
    });

    it('should handle command execution errors', async () => {
      const aiResponse = {
        status: 'success' as const,
        data: {
          reasoning: 'Test reasoning',
          confidence: 85,
          flowControl: FLOW_CONTROL.CONTINUE,
          action: {
            command: 'CLICK_ELEMENT',
            parameters: { selector: '.nonexistent' }
          }
        }
      };
      mockAIIntegration.sendRequest.mockResolvedValue(aiResponse);
      mockExecutor.executeCommand.mockRejectedValue(new Error('Element not found'));

      const result = await taskLoop.executeStep(sessionId, stepId);

      expect(result.status).toBe('error');
      expect(result.error).toContain('Command execution failed');
    });

    it('should continue execution even if logging fails', async () => {
      mockContextManager.logTask.mockImplementation(() => {
        throw new Error('Logging failed');
      });

      const aiResponse = {
        status: 'success' as const,
        data: {
          reasoning: 'Test reasoning',
          confidence: 85,
          flowControl: FLOW_CONTROL.STOP_SUCCESS
        }
      };
      mockAIIntegration.sendRequest.mockResolvedValue(aiResponse);

      const result = await taskLoop.executeStep(sessionId, stepId);

      expect(result.status).toBe('success');
      expect(mockContextManager.logTask).toHaveBeenCalled();
    });
  });

  describe('constructor', () => {
    it('should accept custom configuration', () => {
      const customConfig = {
        maxIterations: 5,
        timeoutMs: 60000,
        enableLogging: true
      };

      const customTaskLoop = new TaskLoop(
        mockContextManager,
        mockPromptManager,
        mockAIIntegration,
        mockSchemaManager,
        mockExecutor,
        customConfig
      );

      expect(customTaskLoop).toBeInstanceOf(TaskLoop);
    });

    it('should use default configuration when none provided', () => {
      const defaultTaskLoop = new TaskLoop(
        mockContextManager,
        mockPromptManager,
        mockAIIntegration,
        mockSchemaManager,
        mockExecutor
      );

      expect(defaultTaskLoop).toBeInstanceOf(TaskLoop);
    });
  });
});
