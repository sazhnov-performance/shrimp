/**
 * Step Processor Logger Unit Tests
 */

import { StepProcessorLogger } from '../../../src/modules/step-processor/logger';
import {
  LogLevel,
  LoggingConfig,
  StandardError,
  ErrorCategory,
  ErrorSeverity
} from '../../../types/shared-types';

describe('StepProcessorLogger', () => {
  let logger: StepProcessorLogger;
  let config: LoggingConfig;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    config = {
      level: LogLevel.DEBUG,
      prefix: '[StepProcessor]',
      includeTimestamp: true,
      includeSessionId: true,
      includeModuleId: true,
      structured: false
    };
    
    logger = new StepProcessorLogger(config);
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('Basic Logging', () => {
    it('should log debug messages', () => {
      logger.debug('Debug message');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[StepProcessor][DEBUG]')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Debug message')
      );
    });

    it('should log info messages', () => {
      logger.info('Info message');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[StepProcessor][INFO]')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Info message')
      );
    });

    it('should log warning messages', () => {
      logger.warn('Warning message');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[StepProcessor][WARN]')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Warning message')
      );
    });

    it('should log error messages', () => {
      const error: StandardError = {
        id: 'error-123',
        category: ErrorCategory.EXECUTION,
        severity: ErrorSeverity.HIGH,
        code: 'TEST_ERROR',
        message: 'Test error message',
        timestamp: new Date(),
        moduleId: 'step-processor',
        recoverable: true,
        retryable: true
      };

      logger.error('Error occurred', error);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[StepProcessor][ERROR]')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error occurred')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR_DETAILS]')
      );
    });
  });

  describe('Context Handling', () => {
    it('should include session ID in log output', () => {
      logger.info('Message with session', { sessionId: 'session-123' });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[session-123]')
      );
    });

    it('should include step index in log output', () => {
      logger.info('Message with step', { 
        sessionId: 'session-123', 
        stepIndex: 5 
      });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[session-123]:5')
      );
    });

    it('should include duration in context', () => {
      logger.info('Message with duration', { 
        sessionId: 'session-123',
        duration: 1500
      });
      
      // Should not throw and should log successfully
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should sanitize large context objects', () => {
      const largeDetails = {
        data: 'x'.repeat(2000) // Large string
      };
      
      logger.info('Message with large context', { 
        sessionId: 'session-123',
        details: largeDetails
      });
      
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Log Level Filtering', () => {
    it('should respect log level configuration', () => {
      const warnConfig: LoggingConfig = {
        ...config,
        level: LogLevel.WARN
      };
      
      const warnLogger = new StepProcessorLogger(warnConfig);
      
      warnLogger.debug('Debug message');
      warnLogger.info('Info message');
      warnLogger.warn('Warning message');
      
      // Only warning should be logged
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Warning message')
      );
    });

    it('should log ERROR level when configured for ERROR', () => {
      const errorConfig: LoggingConfig = {
        ...config,
        level: LogLevel.ERROR
      };
      
      const errorLogger = new StepProcessorLogger(errorConfig);
      
      errorLogger.debug('Debug message');
      errorLogger.info('Info message');
      errorLogger.warn('Warning message');
      errorLogger.error('Error message');
      
      // Only error should be logged
      expect(consoleSpy).toHaveBeenCalledTimes(2); // Error message + error details
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error message')
      );
    });
  });

  describe('Structured Logging', () => {
    it('should output JSON when structured logging is enabled', () => {
      const structuredConfig: LoggingConfig = {
        ...config,
        structured: true
      };
      
      const structuredLogger = new StepProcessorLogger(structuredConfig);
      
      structuredLogger.info('Structured message', { sessionId: 'session-123' });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/^\{.*\}$/) // JSON format
      );
      
      const loggedData = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(loggedData.level).toBe('INFO');
      expect(loggedData.module).toBe('step-processor');
      expect(loggedData.message).toBe('Structured message');
      expect(loggedData.sessionId).toBe('session-123');
    });
  });

  describe('Configuration Options', () => {
    it('should exclude timestamp when configured', () => {
      const noTimestampConfig: LoggingConfig = {
        ...config,
        includeTimestamp: false
      };
      
      const noTimestampLogger = new StepProcessorLogger(noTimestampConfig);
      
      noTimestampLogger.info('Message without timestamp');
      
      const loggedMessage = consoleSpy.mock.calls[0][0];
      expect(loggedMessage).not.toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should exclude module prefix when configured', () => {
      const noModuleConfig: LoggingConfig = {
        ...config,
        includeModuleId: false
      };
      
      const noModuleLogger = new StepProcessorLogger(noModuleConfig);
      
      noModuleLogger.info('Message without module');
      
      const loggedMessage = consoleSpy.mock.calls[0][0];
      expect(loggedMessage).not.toContain('[StepProcessor]');
    });
  });

  describe('Error Handling', () => {
    it('should handle undefined context gracefully', () => {
      expect(() => {
        logger.info('Message without context');
      }).not.toThrow();
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle null error gracefully', () => {
      expect(() => {
        logger.error('Error message', undefined);
      }).not.toThrow();
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle circular references in context', () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;
      
      expect(() => {
        logger.info('Message with circular reference', { 
          details: circularObj 
        });
      }).not.toThrow();
      
      expect(consoleSpy).toHaveBeenCalled();
    });
  });
});
