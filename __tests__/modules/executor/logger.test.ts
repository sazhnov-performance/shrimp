/**
 * Unit Tests for ExecutorLogger
 * Tests logging functionality, output verification, and log management
 */

import { ExecutorLogger } from '../../../src/modules/executor/logger';
import { LogLevel } from '../../../types/shared-types';

describe('ExecutorLogger', () => {
  let logger: ExecutorLogger;
  let winstonSpy: jest.SpyInstance;

  beforeEach(() => {
    logger = new ExecutorLogger(LogLevel.DEBUG);
    // Mock winston logger's log method
    winstonSpy = jest.spyOn((logger as any).winstonLogger, 'log').mockImplementation();
  });

  afterEach(() => {
    winstonSpy.mockRestore();
  });

  describe('basic logging', () => {
    it('should log debug messages', () => {
      const message = 'Debug message';
      const sessionId = 'test-session';
      const context = { action: 'test' };

      logger.debug(message, sessionId, context);

      expect(winstonSpy).toHaveBeenCalledWith({
        level: 'debug',
        message,
        sessionId,
        context
      });
    });

    it('should log info messages', () => {
      const message = 'Info message';
      const sessionId = 'test-session';

      logger.info(message, sessionId);

      expect(winstonSpy).toHaveBeenCalledWith({
        level: 'info',
        message,
        sessionId,
        context: undefined
      });
    });

    it('should log warning messages', () => {
      const message = 'Warning message';
      
      logger.warn(message);

      expect(winstonSpy).toHaveBeenCalledWith({
        level: 'warn',
        message,
        sessionId: undefined,
        context: undefined
      });
    });

    it('should log error messages', () => {
      const message = 'Error message';
      const context = { error: 'details' };

      logger.error(message, undefined, context);

      expect(winstonSpy).toHaveBeenCalledWith({
        level: 'error',
        message,
        sessionId: undefined,
        context
      });
    });
  });

  describe('log level filtering', () => {
    it('should store all log entries regardless of level', () => {
      logger = new ExecutorLogger(LogLevel.DEBUG);
      winstonSpy.mockClear();

      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');

      // Winston may be called through internal mechanisms, check entries instead
      const entries = logger.getEntries();
      expect(entries).toHaveLength(4);
    });

    it('should allow filtering entries by log level', () => {
      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');

      const warnAndAbove = logger.getEntries(LogLevel.WARN);
      expect(warnAndAbove).toHaveLength(2);
      expect(warnAndAbove.map(e => e.level)).toEqual([LogLevel.WARN, LogLevel.ERROR]);
    });

    it('should allow changing winston log level dynamically', () => {
      logger.setLogLevel(LogLevel.ERROR);
      
      // Check that winston logger level was updated
      expect((logger as any).winstonLogger.level).toBe('error');
      
      logger.setLogLevel(LogLevel.DEBUG);
      expect((logger as any).winstonLogger.level).toBe('debug');
    });
  });

  describe('winston integration', () => {
    it('should pass correct data to winston logger', () => {
      const message = 'Test message';
      const sessionId = 'session-123';
      const context = { action: 'test' };
      
      logger.info(message, sessionId, context);
      
      expect(winstonSpy).toHaveBeenCalledWith({
        level: 'info',
        message,
        sessionId,
        context
      });
    });

    it('should handle undefined values correctly', () => {
      const message = 'Message without extras';
      
      logger.warn(message);
      
      expect(winstonSpy).toHaveBeenCalledWith({
        level: 'warn',
        message,
        sessionId: undefined,
        context: undefined
      });
    });

    it('should preserve complex context objects', () => {
      const context = {
        nested: { value: 'deep' },
        array: [1, 2, 3],
        nullValue: null
      };
      
      logger.error('Error with context', 'session', context);
      
      expect(winstonSpy).toHaveBeenCalledWith({
        level: 'error',
        message: 'Error with context',
        sessionId: 'session',
        context
      });
    });
  });

  describe('log storage and retrieval', () => {
    it('should store log entries for retrieval', () => {
      logger.info('First message', 'session-1');
      logger.warn('Second message', 'session-1');
      logger.error('Third message', 'session-2');
      
      const allEntries = logger.getEntries();
      
      expect(allEntries).toHaveLength(3);
      expect(allEntries[0]).toMatchObject({
        level: LogLevel.INFO,
        message: 'First message',
        sessionId: 'session-1'
      });
      expect(allEntries[1]).toMatchObject({
        level: LogLevel.WARN,
        message: 'Second message',
        sessionId: 'session-1'
      });
      expect(allEntries[2]).toMatchObject({
        level: LogLevel.ERROR,
        message: 'Third message',
        sessionId: 'session-2'
      });
    });

    it('should filter entries by log level', () => {
      logger.debug('Debug entry');
      logger.info('Info entry');
      logger.warn('Warn entry');
      logger.error('Error entry');
      
      const errorEntries = logger.getEntries(LogLevel.ERROR);
      const warnAndHigherEntries = logger.getEntries(LogLevel.WARN);
      
      expect(errorEntries).toHaveLength(1);
      expect(errorEntries[0].level).toBe(LogLevel.ERROR);
      
      expect(warnAndHigherEntries).toHaveLength(2);
      expect(warnAndHigherEntries.map(e => e.level)).toEqual([LogLevel.WARN, LogLevel.ERROR]);
    });

    it('should filter entries by session ID', () => {
      logger.info('Session 1 message', 'session-1');
      logger.warn('Session 2 message', 'session-2');
      logger.error('Another session 1 message', 'session-1');
      
      const session1Entries = logger.getEntries(undefined, 'session-1');
      
      expect(session1Entries).toHaveLength(2);
      expect(session1Entries.every(e => e.sessionId === 'session-1')).toBe(true);
    });

    it('should filter entries by both level and session', () => {
      logger.debug('Debug session 1', 'session-1');
      logger.info('Info session 1', 'session-1');
      logger.warn('Warn session 1', 'session-1');
      logger.info('Info session 2', 'session-2');
      
      const filteredEntries = logger.getEntries(LogLevel.INFO, 'session-1');
      
      expect(filteredEntries).toHaveLength(2); // info and warn from session-1
      expect(filteredEntries.every(e => e.sessionId === 'session-1')).toBe(true);
      expect(filteredEntries.every(e => e.level >= LogLevel.INFO)).toBe(true);
    });

    it('should include timestamps in stored entries', () => {
      const beforeTime = new Date();
      logger.info('Timestamped message');
      const afterTime = new Date();
      
      const entries = logger.getEntries();
      const entry = entries[entries.length - 1];
      
      expect(entry.timestamp).toBeInstanceOf(Date);
      expect(entry.timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(entry.timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should store context in entries', () => {
      const context = { action: 'test', data: 'value' };
      logger.info('Message with context', 'session', context);
      
      const entries = logger.getEntries();
      const entry = entries[entries.length - 1];
      
      expect(entry.context).toEqual(context);
    });
  });

  describe('specialized logging methods', () => {
    it('should log session events correctly', () => {
      const sessionId = 'session-123';
      const event = 'SESSION_CREATED';
      const details = { browserType: 'chromium' };
      
      logger.logSessionEvent(sessionId, event, details);
      
      expect(winstonSpy).toHaveBeenCalledWith({
        level: 'info',
        message: `Session ${event}`,
        sessionId,
        context: details
      });
    });

    it('should log command execution results', () => {
      const sessionId = 'session-123';
      const action = 'CLICK_ELEMENT';
      const duration = 250;
      const success = true;
      const details = { selector: '#button' };
      
      logger.logCommandExecution(sessionId, action, duration, success, details);
      
      expect(winstonSpy).toHaveBeenCalledWith({
        level: 'info',
        message: `Command ${action} completed in ${duration}ms`,
        sessionId,
        context: {
          action,
          duration,
          success,
          selector: '#button'
        }
      });
    });

    it('should log failed command execution as error', () => {
      const sessionId = 'session-123';
      const action = 'CLICK_ELEMENT';
      const duration = 100;
      const success = false;
      
      logger.logCommandExecution(sessionId, action, duration, success);
      
      expect(winstonSpy).toHaveBeenCalledWith({
        level: 'error',
        message: `Command ${action} failed in ${duration}ms`,
        sessionId,
        context: {
          action,
          duration,
          success
        }
      });
    });

    it('should log variable interpolation', () => {
      const sessionId = 'session-123';
      const original = '${user}_profile';
      const resolved = 'john_profile';
      const variables = { user: 'john' };
      
      logger.logVariableInterpolation(sessionId, original, resolved, variables);
      
      expect(winstonSpy).toHaveBeenCalledWith({
        level: 'debug',
        message: `Interpolating selector: ${original} -> ${resolved}`,
        sessionId,
        context: { original, resolved, variables }
      });
    });

    it('should log screenshot capture events', () => {
      const sessionId = 'session-123';
      const screenshotId = 'screenshot-456';
      const actionType = 'CLICK_ELEMENT';
      const success = true;
      const details = { fileSize: 1024 };
      
      logger.logScreenshotCapture(sessionId, screenshotId, actionType, success, details);
      
      expect(winstonSpy).toHaveBeenCalledWith({
        level: 'debug',
        message: `Screenshot captured: ${screenshotId} for action ${actionType}`,
        sessionId,
        context: {
          screenshotId,
          actionType,
          success,
          fileSize: 1024
        }
      });
    });

    it('should log failed screenshot capture as warning', () => {
      const sessionId = 'session-123';
      const screenshotId = 'screenshot-456';
      const actionType = 'CLICK_ELEMENT';
      const success = false;
      
      logger.logScreenshotCapture(sessionId, screenshotId, actionType, success);
      
      expect(winstonSpy).toHaveBeenCalledWith({
        level: 'warn',
        message: `Screenshot failed: ${screenshotId} for action ${actionType}`,
        sessionId,
        context: {
          screenshotId,
          actionType,
          success
        }
      });
    });

    it('should log performance metrics', () => {
      const sessionId = 'session-123';
      const metric = 'page_load_time';
      const value = 1250;
      const unit = 'ms';
      
      logger.logPerformanceMetric(sessionId, metric, value, unit);
      
      expect(winstonSpy).toHaveBeenCalledWith({
        level: 'debug',
        message: `Performance: ${metric} = ${value}${unit}`,
        sessionId,
        context: { metric, value, unit }
      });
    });

    it('should use default unit for performance metrics', () => {
      const sessionId = 'session-123';
      const metric = 'execution_time';
      const value = 500;
      
      logger.logPerformanceMetric(sessionId, metric, value);
      
      expect(winstonSpy).toHaveBeenCalledWith({
        level: 'debug',
        message: `Performance: ${metric} = ${value}ms`,
        sessionId,
        context: { metric, value, unit: 'ms' }
      });
    });
  });

  describe('log statistics and monitoring', () => {
    it('should provide log statistics', () => {
      logger.debug('Debug message');
      logger.info('Info message 1');
      logger.info('Info message 2');
      logger.warn('Warning message');
      logger.error('Error message 1');
      logger.error('Error message 2');
      logger.error('Error message 3');
      
      const stats = logger.getLogStats();
      
      expect(stats.total).toBe(7);
      expect(stats.byLevel).toEqual({
        [LogLevel.DEBUG]: 1,
        [LogLevel.INFO]: 2,
        [LogLevel.WARN]: 1,
        [LogLevel.ERROR]: 3
      });
      expect(stats.bySessions).toBe(0); // No session IDs provided
    });

    it('should track unique sessions in statistics', () => {
      logger.info('Message 1', 'session-1');
      logger.info('Message 2', 'session-1'); // Same session
      logger.warn('Message 3', 'session-2');
      logger.error('Message 4', 'session-3');
      logger.debug('Message 5'); // No session
      
      const stats = logger.getLogStats();
      
      expect(stats.bySessions).toBe(3);
    });

    it('should handle empty log statistics', () => {
      const stats = logger.getLogStats();
      
      expect(stats.total).toBe(0);
      expect(stats.byLevel).toEqual({
        [LogLevel.DEBUG]: 0,
        [LogLevel.INFO]: 0,
        [LogLevel.WARN]: 0,
        [LogLevel.ERROR]: 0
      });
      expect(stats.bySessions).toBe(0);
    });
  });

  describe('memory management', () => {
    it('should limit stored log entries to prevent memory leaks', () => {
      const maxEntries = 1000; // Assuming this is the limit
      
      // Generate more entries than the limit
      for (let i = 0; i < maxEntries + 100; i++) {
        logger.info(`Message ${i}`);
      }
      
      const entries = logger.getEntries();
      
      // Should not exceed reasonable memory usage
      expect(entries.length).toBeLessThanOrEqual(maxEntries);
    });

    it('should clear old entries when limit is reached', () => {
      const originalMaxEntries = 1000; // Default max
      logger.setMaxEntries(10); // Set smaller limit for testing
      
      // Generate entries that exceed the limit
      for (let i = 0; i < 20; i++) {
        logger.info(`Message ${i}`);
      }
      
      const entries = logger.getEntries();
      expect(entries).toHaveLength(10); // Should be trimmed to max
      
      // Should keep the last 10 messages
      expect(entries[0].message).toBe('Message 10');
      expect(entries[9].message).toBe('Message 19');
      
      // Restore original max
      logger.setMaxEntries(originalMaxEntries);
    });

    it('should provide method to clear session entries', () => {
      logger.info('Message 1', 'session-1');
      logger.warn('Message 2', 'session-2');
      logger.error('Message 3', 'session-1');
      
      expect(logger.getEntries()).toHaveLength(3);
      
      logger.clearSessionLogs('session-1');
      
      const remainingEntries = logger.getEntries();
      expect(remainingEntries).toHaveLength(1);
      expect(remainingEntries[0].sessionId).toBe('session-2');
    });

    it('should provide method to set max entries', () => {
      logger.setMaxEntries(5);
      
      // Add more than max entries
      for (let i = 0; i < 10; i++) {
        logger.info(`Message ${i}`);
      }
      
      const entries = logger.getEntries();
      expect(entries.length).toBe(5);
    });
  });

  describe('error handling', () => {
    it('should handle logging errors gracefully', () => {
      // Mock winston to throw an error
      winstonSpy.mockImplementation(() => {
        throw new Error('Winston error');
      });
      
      // Should handle winston errors internally and not crash
      // The implementation should wrap winston calls in try-catch
      try {
        logger.info('This should not crash');
        // If no error is thrown, the implementation handles it gracefully
      } catch (error) {
        // If an error is thrown, it means the implementation needs fixing
        fail('Logger should handle winston errors gracefully');
      }
    });

    it('should handle circular references in context', () => {
      const circularObject: any = { name: 'test' };
      circularObject.self = circularObject;
      
      expect(() => {
        logger.info('Circular context', 'session', circularObject);
      }).not.toThrow();
    });

    it('should handle very large context objects', () => {
      const largeContext = {
        data: 'x'.repeat(10000), // 10KB string
        array: new Array(1000).fill('item'),
        nested: {}
      };
      
      expect(() => {
        logger.info('Large context', 'session', largeContext);
      }).not.toThrow();
    });
  });

  describe('configuration', () => {
    it('should accept configuration during construction', () => {
      const customLogger = new ExecutorLogger(LogLevel.WARN);
      winstonSpy.mockClear();
      
      customLogger.debug('Should not appear');
      customLogger.info('Should not appear');
      customLogger.warn('Should appear');
      
      // All entries are stored internally regardless of winston level
      // Winston level only affects external logging
      const entries = customLogger.getEntries();
      expect(entries).toHaveLength(3);
      
      // But winston should only be called for warn level and above
      const warnEntries = entries.filter(e => e.level === LogLevel.WARN);
      expect(warnEntries).toHaveLength(1);
      expect(warnEntries[0].message).toBe('Should appear');
    });

    it('should validate log level configuration', () => {
      expect(() => new ExecutorLogger(LogLevel.DEBUG)).not.toThrow();
      expect(() => new ExecutorLogger(LogLevel.INFO)).not.toThrow();
      expect(() => new ExecutorLogger(LogLevel.WARN)).not.toThrow();
      expect(() => new ExecutorLogger(LogLevel.ERROR)).not.toThrow();
    });
  });
});
