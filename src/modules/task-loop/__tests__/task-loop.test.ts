/**
 * Task Loop Module Unit Tests
 * Comprehensive tests for the TaskLoop implementation
 */

import { TaskLoop } from '../index';
import { TaskLoopConfig, StepResult, AIResponse, TaskLoopErrorType } from '../types';
import { DEFAULT_CONFIG } from '../config';
import { validateAIResponse } from '../validator';

// Mock the dependencies
jest.mock('../../ai-context-manager/ai-context-manager');
jest.mock('../../ai-prompt-manager/index');
jest.mock('../../ai-integration/index');
jest.mock('../../ai-schema-manager/index');
jest.mock('../../executor/index');

describe('TaskLoop', () => {
  // Reset singleton instance before each test
  beforeEach(() => {
    // Reset singleton instance using reflection
    (TaskLoop as any).instance = null;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = TaskLoop.getInstance();
      const instance2 = TaskLoop.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should create instance with default config when no config provided', () => {
      const instance = TaskLoop.getInstance();
      expect(instance.getConfig()).toEqual(DEFAULT_CONFIG);
    });

    it('should create instance with custom config', () => {
      const customConfig: TaskLoopConfig = {
        maxIterations: 5,
        timeoutMs: 60000,
        enableLogging: false
      };
      
      const instance = TaskLoop.getInstance(customConfig);
      expect(instance.getConfig()).toEqual(customConfig);
    });

    it('should ignore config on subsequent calls', () => {
      const config1: TaskLoopConfig = { maxIterations: 5, timeoutMs: 60000, enableLogging: false };
      const config2: TaskLoopConfig = { maxIterations: 15, timeoutMs: 120000, enableLogging: true };
      
      const instance1 = TaskLoop.getInstance(config1);
      const instance2 = TaskLoop.getInstance(config2);
      
      expect(instance1).toBe(instance2);
      expect(instance1.getConfig()).toEqual(config1);
    });
  });

  describe('Configuration Management', () => {
    it('should validate configuration on creation', () => {
      expect(() => {
        TaskLoop.getInstance({ maxIterations: -1, timeoutMs: 60000, enableLogging: true });
      }).toThrow('maxIterations must be a positive number');
    });

    it('should update configuration', () => {
      const instance = TaskLoop.getInstance();
      const newConfig = { maxIterations: 15 };
      
      instance.updateConfig(newConfig);
      
      expect(instance.getConfig().maxIterations).toBe(15);
      expect(instance.getConfig().timeoutMs).toBe(DEFAULT_CONFIG.timeoutMs); // Should keep other values
    });

    it('should validate configuration on update', () => {
      const instance = TaskLoop.getInstance();
      
      expect(() => {
        instance.updateConfig({ maxIterations: 0 });
      }).toThrow('maxIterations must be a positive number');
    });
  });

  describe('Input Validation', () => {
    let instance: any;

    beforeEach(() => {
      instance = TaskLoop.getInstance();
    });

    it('should validate sessionId', async () => {
      await expect(instance.executeStep('', 0)).rejects.toThrow('Session ID must be a non-empty string');
      await expect(instance.executeStep('   ', 0)).rejects.toThrow('Session ID must be a non-empty string');
    });

    it('should validate stepId', async () => {
      await expect(instance.executeStep('test-session', -1)).rejects.toThrow('Step ID must be a non-negative integer');
      await expect(instance.executeStep('test-session', 1.5)).rejects.toThrow('Step ID must be a non-negative integer');
    });
  });

  describe('executeStep - Success Scenarios', () => {
    let instance: any;
    let mockContextManager: any;
    let mockPromptManager: any;
    let mockAIIntegration: any;
    let mockExecutor: any;

    beforeEach(() => {
      // Setup mocks
      const { AIContextManager } = require('../../ai-context-manager/ai-context-manager');
      const AIPromptManager = require('../../ai-prompt-manager/index').default;
      const AIIntegrationManager = require('../../ai-integration/index').default;
      const Executor = require('../../executor/index').default;

      mockContextManager = {
        logTask: jest.fn()
      };
      mockPromptManager = {
        getStepPrompt: jest.fn().mockReturnValue('Test prompt')
      };
      mockAIIntegration = {
        sendRequest: jest.fn()
      };
      mockExecutor = {
        sessionExists: jest.fn().mockReturnValue(true),
        createSession: jest.fn(),
        executeCommand: jest.fn()
      };

      AIContextManager.getInstance = jest.fn().mockReturnValue(mockContextManager);
      AIPromptManager.getInstance = jest.fn().mockReturnValue(mockPromptManager);
      AIIntegrationManager.getInstance = jest.fn().mockReturnValue(mockAIIntegration);
      
      // Mock constructor for Executor
      Executor.mockImplementation(() => mockExecutor);

      instance = TaskLoop.getInstance();
    });

    it('should execute step successfully with stop_success flow control', async () => {
      const mockAIResponse = {
        status: 'success',
        data: {
          reasoning: 'Test reasoning',
          confidence: 85,
          flowControl: 'stop_success'
        }
      };

      mockAIIntegration.sendRequest.mockResolvedValue(mockAIResponse);

      const result = await instance.executeStep('test-session', 0);

      expect(result.status).toBe('success');
      expect(result.stepId).toBe(0);
      expect(result.iterations).toBe(1);
      expect(result.finalResponse).toEqual(mockAIResponse.data);
      expect(mockContextManager.logTask).toHaveBeenCalledTimes(1);
    });

    it('should execute step with failure flow control', async () => {
      const mockAIResponse = {
        status: 'success',
        data: {
          reasoning: 'Task failed',
          confidence: 60,
          flowControl: 'stop_failure'
        }
      };

      mockAIIntegration.sendRequest.mockResolvedValue(mockAIResponse);

      const result = await instance.executeStep('test-session', 0);

      expect(result.status).toBe('failure');
      expect(result.stepId).toBe(0);
      expect(result.iterations).toBe(1);
      expect(result.finalResponse).toEqual(mockAIResponse.data);
    });

    it('should execute multiple iterations with continue flow control', async () => {
      const mockAIResponses = [
        {
          status: 'success',
          data: {
            reasoning: 'First attempt',
            confidence: 70,
            flowControl: 'continue',
            action: {
              command: 'CLICK_ELEMENT',
              parameters: { selector: '.button' }
            }
          }
        },
        {
          status: 'success',
          data: {
            reasoning: 'Second attempt successful',
            confidence: 90,
            flowControl: 'stop_success'
          }
        }
      ];

      mockAIIntegration.sendRequest
        .mockResolvedValueOnce(mockAIResponses[0])
        .mockResolvedValueOnce(mockAIResponses[1]);

      mockExecutor.executeCommand.mockResolvedValue({ success: true });

      const result = await instance.executeStep('test-session', 0);

      expect(result.status).toBe('success');
      expect(result.iterations).toBe(2);
      expect(mockExecutor.executeCommand).toHaveBeenCalledTimes(1);
      expect(mockContextManager.logTask).toHaveBeenCalledTimes(2);
    });

    it('should create executor session if it does not exist', async () => {
      const mockAIResponse = {
        status: 'success',
        data: {
          reasoning: 'Test reasoning',
          confidence: 85,
          flowControl: 'continue',
          action: {
            command: 'OPEN_PAGE',
            parameters: { url: 'https://example.com' }
          }
        }
      };

      mockExecutor.sessionExists.mockReturnValue(false);
      mockExecutor.executeCommand.mockResolvedValue({ success: true });
      mockAIIntegration.sendRequest
        .mockResolvedValueOnce(mockAIResponse)
        .mockResolvedValueOnce({
          status: 'success',
          data: { reasoning: 'Done', confidence: 90, flowControl: 'stop_success' }
        });

      await instance.executeStep('test-session', 0);

      expect(mockExecutor.createSession).toHaveBeenCalledWith('test-session');
      expect(mockExecutor.executeCommand).toHaveBeenCalledTimes(1);
    });
  });

  describe('executeStep - Error Scenarios', () => {
    let instance: any;
    let mockContextManager: any;
    let mockPromptManager: any;
    let mockAIIntegration: any;
    let mockExecutor: any;

    beforeEach(() => {
      // Setup mocks
      const { AIContextManager } = require('../../ai-context-manager/ai-context-manager');
      const AIPromptManager = require('../../ai-prompt-manager/index').default;
      const AIIntegrationManager = require('../../ai-integration/index').default;
      const Executor = require('../../executor/index').default;

      mockContextManager = {
        logTask: jest.fn()
      };
      mockPromptManager = {
        getStepPrompt: jest.fn().mockReturnValue('Test prompt')
      };
      mockAIIntegration = {
        sendRequest: jest.fn()
      };
      mockExecutor = {
        sessionExists: jest.fn().mockReturnValue(true),
        executeCommand: jest.fn()
      };

      AIContextManager.getInstance = jest.fn().mockReturnValue(mockContextManager);
      AIPromptManager.getInstance = jest.fn().mockReturnValue(mockPromptManager);
      AIIntegrationManager.getInstance = jest.fn().mockReturnValue(mockAIIntegration);
      Executor.mockImplementation(() => mockExecutor);

      instance = TaskLoop.getInstance();
    });

    it('should handle AI request failures', async () => {
      mockAIIntegration.sendRequest.mockResolvedValue({
        status: 'error',
        error: 'API rate limit exceeded'
      });

      const result = await instance.executeStep('test-session', 0);

      expect(result.status).toBe('error');
      expect(result.error).toContain('AI request failed');
      expect(result.error).toContain('API rate limit exceeded');
    });

    it('should handle validation failures', async () => {
      mockAIIntegration.sendRequest.mockResolvedValue({
        status: 'success',
        data: {
          reasoning: 'Test reasoning',
          confidence: 150, // Invalid confidence
          flowControl: 'stop_success'
        }
      });

      const result = await instance.executeStep('test-session', 0);

      expect(result.status).toBe('error');
      expect(result.error).toContain('Confidence field must be between 0 and 100');
    });

    it('should handle executor failures', async () => {
      const mockAIResponse = {
        status: 'success',
        data: {
          reasoning: 'Test reasoning',
          confidence: 85,
          flowControl: 'continue',
          action: {
            command: 'CLICK_ELEMENT',
            parameters: { selector: '.nonexistent' }
          }
        }
      };

      mockAIIntegration.sendRequest.mockResolvedValue(mockAIResponse);
      mockExecutor.executeCommand.mockResolvedValue({
        success: false,
        error: { message: 'Element not found' }
      });

      const result = await instance.executeStep('test-session', 0);

      expect(result.status).toBe('error');
      expect(result.error).toContain('Executor command failed');
      expect(result.error).toContain('Element not found');
    });

    it('should handle maximum iterations exceeded', async () => {
      const customConfig: TaskLoopConfig = {
        maxIterations: 2,
        timeoutMs: 300000,
        enableLogging: false
      };

      const customInstance = TaskLoop.getInstance();
      customInstance.updateConfig(customConfig);

      const mockAIResponse = {
        status: 'success',
        data: {
          reasoning: 'Keep going',
          confidence: 70,
          flowControl: 'continue',
          action: {
            command: 'CLICK_ELEMENT',
            parameters: { selector: '.button' }
          }
        }
      };

      mockAIIntegration.sendRequest.mockResolvedValue(mockAIResponse);
      mockExecutor.executeCommand.mockResolvedValue({ success: true });

      const result = await customInstance.executeStep('test-session', 0);

      expect(result.status).toBe('error');
      expect(result.iterations).toBe(2);
      expect(result.error).toContain('Maximum iterations (2) exceeded');
    });
  });

  describe('validateAIResponse', () => {
    it('should validate correct AI response', () => {
      const validResponse = {
        reasoning: 'Valid reasoning',
        confidence: 85,
        flowControl: 'stop_success'
      };

      const result = validateAIResponse(validResponse, 'test-session', 0);
      expect(result).toEqual(validResponse);
    });

    it('should validate AI response with action', () => {
      const validResponse = {
        reasoning: 'Valid reasoning',
        confidence: 85,
        flowControl: 'continue',
        action: {
          command: 'CLICK_ELEMENT',
          parameters: { selector: '.button' }
        }
      };

      const result = validateAIResponse(validResponse, 'test-session', 0);
      expect(result).toEqual(validResponse);
    });

    it('should reject response with missing required fields', () => {
      const invalidResponse = {
        reasoning: 'Test reasoning'
        // Missing confidence and flowControl
      };

      expect(() => validateAIResponse(invalidResponse, 'test-session', 0))
        .toThrow('Missing required fields: confidence, flowControl');
    });

    it('should reject response with invalid confidence', () => {
      const invalidResponse = {
        reasoning: 'Test reasoning',
        confidence: 150, // Invalid
        flowControl: 'stop_success'
      };

      expect(() => validateAIResponse(invalidResponse, 'test-session', 0))
        .toThrow('Confidence field must be between 0 and 100');
    });

    it('should reject response with invalid flow control', () => {
      const invalidResponse = {
        reasoning: 'Test reasoning',
        confidence: 85,
        flowControl: 'invalid_control' // Invalid
      };

      expect(() => validateAIResponse(invalidResponse, 'test-session', 0))
        .toThrow('FlowControl field must be one of: continue, stop_success, stop_failure');
    });

    it('should require action when flowControl is continue', () => {
      const invalidResponse = {
        reasoning: 'Test reasoning',
        confidence: 85,
        flowControl: 'continue'
        // Missing action
      };

      expect(() => validateAIResponse(invalidResponse, 'test-session', 0))
        .toThrow('Action is required when flowControl is "continue"');
    });
  });
});
