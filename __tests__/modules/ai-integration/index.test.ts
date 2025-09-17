/**
 * Unit Tests for AI Integration Module Main Interface
 * Tests the main AIIntegrationManager class and factory functions
 */

import { AIIntegrationManager, createAIIntegrationManager, validateAIConfig } from '../../../src/modules/ai-integration/index';
import { AIConfig, AIResponse } from '../../../src/modules/ai-integration/types';
import * as fs from 'fs';

// Mock fetch for OpenAI API calls
global.fetch = jest.fn();

// Mock filesystem
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  statSync: jest.fn(),
  readFileSync: jest.fn(),
  appendFileSync: jest.fn(),
  mkdirSync: jest.fn()
}));

describe('AIIntegrationManager', () => {
  const validConfig: AIConfig = {
    apiKey: 'sk-test1234567890123456789012345678901234567890123456',
    model: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1',
    logFilePath: './test-ai-requests.log'
  };

  const mockSuccessResponse = {
    id: 'test-response-id',
    object: 'chat.completion',
    created: 1234567890,
    model: 'gpt-4o-mini',
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: 'Test response from OpenAI'
      },
      finish_reason: 'stop'
    }],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful filesystem operations
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.statSync as jest.Mock).mockReturnValue({ 
      size: 1024,
      isFile: () => true 
    });
    (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from('test'));
    (fs.appendFileSync as jest.Mock).mockReturnValue(undefined);
    (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);

    // Mock successful fetch by default
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => name === 'content-type' ? 'application/json' : null,
        entries: () => []
      },
      json: () => Promise.resolve(mockSuccessResponse)
    });
  });

  describe('Constructor', () => {
    test('should create manager with valid config', () => {
      const manager = new AIIntegrationManager(validConfig);
      expect(manager.isReady()).toBe(true);
    });

    test('should throw error with missing config', () => {
      expect(() => {
        new AIIntegrationManager(null as any);
      }).toThrow('Configuration is required');
    });

    test('should throw error with invalid API key', () => {
      const invalidConfig = { ...validConfig, apiKey: '' };
      expect(() => {
        new AIIntegrationManager(invalidConfig);
      }).toThrow();
    });
  });

  describe('sendRequest', () => {
    test('should send text-only request successfully', async () => {
      const manager = new AIIntegrationManager(validConfig);
      
      const response = await manager.sendRequest('Hello, how are you?');
      
      expect(response.status).toBe('success');
      expect(response.data).toBeDefined();
      expect(response.data.content).toBe('Test response from OpenAI');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('Bearer'),
            'Content-Type': 'application/json'
          })
        })
      );
    });

    test('should send request with image successfully', async () => {
      const manager = new AIIntegrationManager(validConfig);
      
      const response = await manager.sendRequest('What do you see?', './test-image.png');
      
      expect(response.status).toBe('success');
      expect(global.fetch).toHaveBeenCalled();
      
      const requestBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(requestBody.messages[0].content).toHaveLength(2);
      expect(requestBody.messages[0].content[0].type).toBe('text');
      expect(requestBody.messages[0].content[1].type).toBe('image_url');
    });

    test('should handle API authentication error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      const manager = new AIIntegrationManager(validConfig);
      const response = await manager.sendRequest('Hello');
      
      expect(response.status).toBe('error');
      expect(response.errorCode).toBe('AI002');
    });

    test('should handle rate limit error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: {
          get: (name: string) => name === 'retry-after' ? '60' : null,
          entries: () => []
        }
      });

      const manager = new AIIntegrationManager(validConfig);
      const response = await manager.sendRequest('Hello');
      
      expect(response.status).toBe('error');
      expect(response.errorCode).toBe('AI003');
    });

    test('should handle network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new TypeError('Network error'));

      const manager = new AIIntegrationManager(validConfig);
      const response = await manager.sendRequest('Hello');
      
      expect(response.status).toBe('error');
      expect(response.errorCode).toBe('AI001');
    });

    test('should handle invalid response format', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: () => null,
          entries: () => []
        },
        json: () => Promise.resolve({ invalid: 'response' })
      });

      const manager = new AIIntegrationManager(validConfig);
      const response = await manager.sendRequest('Hello');
      
      expect(response.status).toBe('error');
      expect(response.errorCode).toBe('AI004');
    });

    test('should handle image file not found', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const manager = new AIIntegrationManager(validConfig);
      const response = await manager.sendRequest('What do you see?', './nonexistent.png');
      
      expect(response.status).toBe('error');
      expect(response.errorCode).toBe('AI006');
    });

    test('should reject empty request text', async () => {
      const manager = new AIIntegrationManager(validConfig);
      const response = await manager.sendRequest('');
      
      expect(response.status).toBe('error');
      expect(response.errorCode).toBe('AI001');
    });
  });

  describe('testConnection', () => {
    test('should test connection successfully', async () => {
      const manager = new AIIntegrationManager(validConfig);
      const response = await manager.testConnection();
      
      expect(response.status).toBe('success');
      expect(global.fetch).toHaveBeenCalled();
    });

    test('should return error if not initialized', async () => {
      const manager = new AIIntegrationManager(validConfig);
      (manager as any).isInitialized = false;
      
      const response = await manager.testConnection();
      expect(response.status).toBe('error');
    });
  });

  describe('Configuration methods', () => {
    test('should get masked config', () => {
      const manager = new AIIntegrationManager(validConfig);
      const config = manager.getConfig();
      
      expect(config.model).toBe('gpt-4o-mini');
      expect(config.baseUrl).toBe('https://api.openai.com/v1');
      expect(config.maskedApiKey).toContain('*');
      expect(config.maskedApiKey).not.toContain(validConfig.apiKey);
    });

    test('should return readiness status', () => {
      const manager = new AIIntegrationManager(validConfig);
      expect(manager.isReady()).toBe(true);
    });
  });

  describe('Logging methods', () => {
    test('should get log file path', () => {
      const manager = new AIIntegrationManager(validConfig);
      const logPath = manager.getLogFilePath();
      expect(logPath).toContain('test-ai-requests.log');
    });

    test('should check log file writability', () => {
      const manager = new AIIntegrationManager(validConfig);
      const isWritable = manager.isLogFileWritable();
      expect(typeof isWritable).toBe('boolean');
    });

    test('should get log file size', () => {
      const manager = new AIIntegrationManager(validConfig);
      const size = manager.getLogFileSize();
      expect(typeof size).toBe('number');
    });

    test('should rotate log file if needed', () => {
      const manager = new AIIntegrationManager(validConfig);
      expect(() => manager.rotateLogFileIfNeeded()).not.toThrow();
    });
  });
});

describe('createAIIntegrationManager', () => {
  test('should create manager with factory function', () => {
    const manager = createAIIntegrationManager('sk-test1234567890123456789012345678901234567890123456');
    expect(manager.isReady()).toBe(true);
  });

  test('should create manager with overrides', () => {
    const manager = createAIIntegrationManager(
      'sk-test1234567890123456789012345678901234567890123456',
      { model: 'gpt-4', logFilePath: './custom.log' }
    );
    
    const config = manager.getConfig();
    expect(config.model).toBe('gpt-4');
  });
});

describe('validateAIConfig', () => {
  test('should validate correct config', () => {
    const result = validateAIConfig({
      apiKey: 'sk-test1234567890123456789012345678901234567890123456',
      model: 'gpt-4o-mini'
    });
    
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should reject missing API key', () => {
    const result = validateAIConfig({
      model: 'gpt-4o-mini'
    });
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('API key is required and must be a non-empty string');
  });

  test('should reject invalid API key format', () => {
    const result = validateAIConfig({
      apiKey: 'invalid-key',
      model: 'gpt-4o-mini'
    });
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('API key format appears invalid');
  });

  test('should reject invalid model type', () => {
    const result = validateAIConfig({
      apiKey: 'sk-test1234567890123456789012345678901234567890123456',
      model: 123 as any
    });
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Model must be a string');
  });

  test('should reject invalid base URL type', () => {
    const result = validateAIConfig({
      apiKey: 'sk-test1234567890123456789012345678901234567890123456',
      baseUrl: 123 as any
    });
    
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Base URL must be a string');
  });
});
