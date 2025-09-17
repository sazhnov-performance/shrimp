/**
 * Unit Tests for RequestProcessor
 * Tests OpenAI API communication and request/response processing
 */

import { RequestProcessor } from '../../../src/modules/ai-integration/request-processor';
import { AIConfig } from '../../../src/modules/ai-integration/types';
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

describe('RequestProcessor', () => {
  let requestProcessor: RequestProcessor;
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
    
    // Mock filesystem operations
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.statSync as jest.Mock).mockReturnValue({ 
      size: 1024,
      isFile: () => true 
    });
    (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from('test-image'));
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

    requestProcessor = new RequestProcessor(validConfig);
  });

  describe('sendRequest', () => {
    test('should send text-only request successfully', async () => {
      const response = await requestProcessor.sendRequest('Hello, how are you?');
      
      expect(response.status).toBe('success');
      expect(response.data).toBeDefined();
      expect(response.data.content).toBe('Test response from OpenAI');
      expect(global.fetch).toHaveBeenCalled();
    });

    test('should handle authentication error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      const response = await requestProcessor.sendRequest('Hello');
      
      expect(response.status).toBe('error');
      expect(response.errorCode).toBe('AI002');
    });

    test('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new TypeError('Failed to fetch'));

      const response = await requestProcessor.sendRequest('Hello');
      
      expect(response.status).toBe('error');
      expect(response.errorCode).toBe('AI001');
    });
  });

  describe('testConnection', () => {
    test('should test connection successfully', async () => {
      const response = await requestProcessor.testConnection();
      
      expect(response.status).toBe('success');
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});
