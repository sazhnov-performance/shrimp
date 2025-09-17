/**
 * Unit Tests for Logger
 * Tests logging functionality for AI requests and responses
 */

import { Logger } from '../../../src/modules/ai-integration/logger';
import * as fs from 'fs';
import * as path from 'path';

// Mock filesystem
jest.mock('fs', () => ({
  appendFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  existsSync: jest.fn(),
  statSync: jest.fn(),
  renameSync: jest.fn()
}));

// Mock path
jest.mock('path', () => ({
  ...jest.requireActual('path'),
  dirname: jest.fn(),
  resolve: jest.fn()
}));

describe('Logger', () => {
  let logger: Logger;
  const testLogPath = './test-ai-requests.log';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock path operations
    (path.dirname as jest.Mock).mockReturnValue('/test/dir');
    (path.resolve as jest.Mock).mockReturnValue('/resolved/test-ai-requests.log');
    
    // Mock filesystem operations
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.appendFileSync as jest.Mock).mockReturnValue(undefined);
    (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
    (fs.statSync as jest.Mock).mockReturnValue({ size: 1024 });
    (fs.renameSync as jest.Mock).mockReturnValue(undefined);

    logger = new Logger(testLogPath);
  });

  describe('constructor', () => {
    test('should initialize with default log path', () => {
      const defaultLogger = new Logger();
      expect(defaultLogger.getLogFilePath()).toBeDefined();
    });

    test('should initialize with custom log path', () => {
      expect(logger.getLogFilePath()).toContain('test-ai-requests.log');
    });

    test('should create log directory if it does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      new Logger(testLogPath);
      
      expect(fs.mkdirSync).toHaveBeenCalledWith('/test/dir', { recursive: true });
    });

    test('should handle directory creation errors', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      (fs.mkdirSync as jest.Mock).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      expect(() => new Logger(testLogPath)).toThrow();
    });
  });

  describe('logRequest', () => {
    test('should log request and return request ID', () => {
      const request = {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Hello' }]
      };

      const requestId = logger.logRequest(request);

      expect(requestId).toMatch(/^req_\d+_\d{4}$/);
      expect(fs.appendFileSync).toHaveBeenCalled();
      
      const logCall = (fs.appendFileSync as jest.Mock).mock.calls[0];
      const logEntry = JSON.parse(logCall[1]);
      
      expect(logEntry.type).toBe('request');
      expect(logEntry.data.requestId).toBe(requestId);
      expect(logEntry.data.model).toBe('gpt-4o-mini');
    });

    test('should sanitize authorization headers', () => {
      const request = {
        headers: {
          'Authorization': 'Bearer sk-1234567890123456789012345678901234567890123456',
          'Content-Type': 'application/json'
        },
        messages: [{ role: 'user', content: 'Hello' }]
      };

      logger.logRequest(request);

      const logCall = (fs.appendFileSync as jest.Mock).mock.calls[0];
      const logEntry = JSON.parse(logCall[1]);
      
      expect(logEntry.data.headers.Authorization).toContain('*');
      expect(logEntry.data.headers.Authorization).not.toContain('567890123456789012345678901234567890');
      expect(logEntry.data.headers['Content-Type']).toBe('application/json');
    });

    test('should truncate long message content', () => {
      const longContent = 'x'.repeat(1500);
      const request = {
        messages: [{ role: 'user', content: longContent }]
      };

      logger.logRequest(request);

      const logCall = (fs.appendFileSync as jest.Mock).mock.calls[0];
      const logEntry = JSON.parse(logCall[1]);
      
      expect(logEntry.data.messages[0].content).toContain('[truncated]');
      expect(logEntry.data.messages[0].originalLength).toBe(1500);
    });

    test('should sanitize base64 image data', () => {
      const request = {
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'What do you see?' },
            { 
              type: 'image_url', 
              image_url: { 
                url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==' 
              } 
            }
          ]
        }]
      };

      logger.logRequest(request);

      const logCall = (fs.appendFileSync as jest.Mock).mock.calls[0];
      const logEntry = JSON.parse(logCall[1]);
      
      const imageContent = logEntry.data.messages[0].content[1];
      expect(imageContent.image_url.url).toBe('[base64 image data removed for logging]');
      expect(imageContent.originalDataSize).toBeGreaterThan(0);
    });
  });

  describe('logResponse', () => {
    test('should log successful response', () => {
      const requestId = 'req_123_0001';
      const response = {
        id: 'resp-123',
        choices: [{ message: { content: 'Hello there!' } }],
        usage: { total_tokens: 15 }
      };

      logger.logResponse(requestId, response);

      expect(fs.appendFileSync).toHaveBeenCalled();
      
      const logCall = (fs.appendFileSync as jest.Mock).mock.calls[0];
      const logEntry = JSON.parse(logCall[1]);
      
      expect(logEntry.type).toBe('response');
      expect(logEntry.data.requestId).toBe(requestId);
      expect(logEntry.data.id).toBe('resp-123');
    });

    test('should sanitize response headers', () => {
      const requestId = 'req_123_0001';
      const response = {
        headers: {
          'content-type': 'application/json',
          'x-ratelimit-remaining': '100',
          'authorization': 'Bearer secret'
        },
        data: { test: 'value' }
      };

      logger.logResponse(requestId, response);

      const logCall = (fs.appendFileSync as jest.Mock).mock.calls[0];
      const logEntry = JSON.parse(logCall[1]);
      
      expect(logEntry.data.responseHeaders).toBeDefined();
      expect(logEntry.data.responseHeaders['content-type']).toBe('application/json');
      expect(logEntry.data.responseHeaders['x-ratelimit-remaining']).toBe('100');
      expect(logEntry.data.headers).toBeUndefined();
    });
  });

  describe('logError', () => {
    test('should log error with request ID', () => {
      const requestId = 'req_123_0001';
      const error = {
        code: 'AI001',
        message: 'Network error',
        details: { url: 'https://api.openai.com' }
      };

      logger.logError(requestId, error);

      expect(fs.appendFileSync).toHaveBeenCalled();
      
      const logCall = (fs.appendFileSync as jest.Mock).mock.calls[0];
      const logEntry = JSON.parse(logCall[1]);
      
      expect(logEntry.type).toBe('response');
      expect(logEntry.data.requestId).toBe(requestId);
      expect(logEntry.data.error).toBe(true);
      expect(logEntry.data.errorCode).toBe('AI001');
      expect(logEntry.data.errorMessage).toBe('Network error');
    });

    test('should handle error objects without code', () => {
      const requestId = 'req_123_0001';
      const error = new Error('Something went wrong');

      logger.logError(requestId, error);

      const logCall = (fs.appendFileSync as jest.Mock).mock.calls[0];
      const logEntry = JSON.parse(logCall[1]);
      
      expect(logEntry.data.errorCode).toBe('UNKNOWN_ERROR');
      expect(logEntry.data.errorMessage).toBe('Something went wrong');
    });
  });

  describe('file operations', () => {
    test('should get log file path', () => {
      const path = logger.getLogFilePath();
      expect(path).toContain('test-ai-requests.log');
    });

    test('should check if log file is writable', () => {
      const isWritable = logger.isLogFileWritable();
      expect(isWritable).toBe(true);
      expect(fs.appendFileSync).toHaveBeenCalled();
    });

    test('should handle write errors gracefully', () => {
      (fs.appendFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('Disk full');
      });

      const isWritable = logger.isLogFileWritable();
      expect(isWritable).toBe(false);
    });

    test('should get log file size', () => {
      const size = logger.getLogFileSize();
      expect(size).toBe(1024);
      expect(fs.statSync).toHaveBeenCalled();
    });

    test('should return 0 for non-existent log file', () => {
      (fs.statSync as jest.Mock).mockImplementation(() => {
        throw new Error('File not found');
      });

      const size = logger.getLogFileSize();
      expect(size).toBe(0);
    });
  });

  describe('log rotation', () => {
    test('should rotate log file when size exceeds limit', () => {
      const largeSize = 150 * 1024 * 1024; // 150MB
      (fs.statSync as jest.Mock).mockReturnValue({ size: largeSize });

      logger.rotateLogFileIfNeeded(100 * 1024 * 1024); // 100MB limit

      expect(fs.renameSync).toHaveBeenCalled();
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('LOG_ROTATION'),
        'utf8'
      );
    });

    test('should not rotate log file when size is within limit', () => {
      const smallSize = 50 * 1024 * 1024; // 50MB
      (fs.statSync as jest.Mock).mockReturnValue({ size: smallSize });

      logger.rotateLogFileIfNeeded(100 * 1024 * 1024); // 100MB limit

      expect(fs.renameSync).not.toHaveBeenCalled();
    });

    test('should handle rotation errors gracefully', () => {
      const largeSize = 150 * 1024 * 1024;
      (fs.statSync as jest.Mock).mockReturnValue({ size: largeSize });
      (fs.renameSync as jest.Mock).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // Should not throw
      expect(() => logger.rotateLogFileIfNeeded()).not.toThrow();
    });
  });

  describe('write error handling', () => {
    test('should handle disk full errors', () => {
      (fs.appendFileSync as jest.Mock).mockImplementation(() => {
        const error = new Error('ENOSPC: no space left on device');
        error.message = 'ENOSPC: no space left on device';
        throw error;
      });

      expect(() => logger.logRequest({ test: 'data' })).toThrow();
    });

    test('should handle other write errors gracefully', () => {
      (fs.appendFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // Should not throw, but should log to console
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      expect(() => logger.logRequest({ test: 'data' })).not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });
});
