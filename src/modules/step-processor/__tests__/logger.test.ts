/**
 * Step Processor Logger Unit Tests
 * Tests for logging functionality
 */

import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { LogLevel, StandardError, ErrorCategory, ErrorSeverity } from '../../../../types/shared-types';
import { 
  StepProcessorLogger,
  createStepProcessorLogger,
  createLoggerFromConfig,
  createDefaultLogger 
} from '../logger';
import { StepProcessorConfig, DEFAULT_STEP_PROCESSOR_CONFIG } from '../types';

describe('StepProcessorLogger', () => {
  let logger: StepProcessorLogger;
  let consoleSpies: { [key: string]: jest.SpiedFunction<any> };

  beforeEach(() => {
    const config = {
      level: LogLevel.DEBUG,
      prefix: '[StepProcessor]',
      includeTimestamp: true,
      includeSessionId: true,
      includeModuleId: true,
      structured: false
    };
    
    logger = new StepProcessorLogger(config);
    
    // Spy on console methods
    consoleSpies = {
      log: jest.spyOn(console, 'log').mockImplementation(() => {}),
      info: jest.spyOn(console, 'info').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
      debug: jest.spyOn(console, 'debug').mockImplementation(() => {})
    };
  });

  afterEach(() => {
    // Restore console methods
    Object.values(consoleSpies).forEach(spy => spy.mockRestore());
    jest.clearAllMocks();
  });

  describe('Basic logging methods', () => {
    it('should log debug messages', () => {
      logger.debug('Debug message', { sessionId: 'test-session' });
      
      expect(consoleSpies.debug).toHaveBeenCalledWith(
        expect.stringContaining('[StepProcessor] [DEBUG]')
      );
      expect(consoleSpies.debug).toHaveBeenCalledWith(
        expect.stringContaining('Debug message')
      );
      expect(consoleSpies.debug).toHaveBeenCalledWith(
        expect.stringContaining('[test-session]')
      );
    });

    it('should log info messages', () => {
      logger.info('Info message', { sessionId: 'test-session' });
      
      expect(consoleSpies.info).toHaveBeenCalledWith(
        expect.stringContaining('[StepProcessor] [INFO]')
      );
      expect(consoleSpies.info).toHaveBeenCalledWith(
        expect.stringContaining('Info message')
      );
    });

    it('should log warning messages', () => {
      logger.warn('Warning message', { sessionId: 'test-session' });
      
      expect(consoleSpies.warn).toHaveBeenCalledWith(
        expect.stringContaining('[StepProcessor] [WARN]')
      );
      expect(consoleSpies.warn).toHaveBeenCalledWith(
        expect.stringContaining('Warning message')
      );
    });

    it('should log error messages', () => {
      const standardError: StandardError = {
        id: 'test-error-id',
        category: ErrorCategory.EXECUTION,
        severity: ErrorSeverity.HIGH,
        code: 'TEST_ERROR',
        message: 'Test error message',
        timestamp: new Date(),
        moduleId: 'step-processor',
        recoverable: true,
        retryable: true
      };

      logger.error('Error occurred', standardError, { sessionId: 'test-session' });
      
      expect(consoleSpies.error).toHaveBeenCalledWith(
        expect.stringContaining('[StepProcessor] [ERROR]'),
        expect.any(Object)
      );
    });
  });

  describe('Log level filtering', () => {
    it('should respect log level hierarchy', () => {
      const warnLogger = new StepProcessorLogger({
        level: LogLevel.WARN,
        prefix: '[StepProcessor]',
        includeTimestamp: false,
        includeSessionId: false,
        includeModuleId: false,
        structured: false
      });

      warnLogger.debug('Debug message');
      warnLogger.info('Info message');
      warnLogger.warn('Warning message');
      warnLogger.error('Error message');

      expect(consoleSpies.debug).not.toHaveBeenCalled();
      expect(consoleSpies.info).not.toHaveBeenCalled();
      expect(consoleSpies.warn).toHaveBeenCalled();
      expect(consoleSpies.error).toHaveBeenCalled();
    });
  });

  describe('Structured logging', () => {
    it('should output JSON when structured mode is enabled', () => {
      const structuredLogger = new StepProcessorLogger({
        level: LogLevel.INFO,
        prefix: '[StepProcessor]',
        includeTimestamp: true,
        includeSessionId: true,
        includeModuleId: true,
        structured: true
      });

      structuredLogger.info('Test message', { 
        sessionId: 'test-session',
        stepIndex: 1
      });

      expect(consoleSpies.log).toHaveBeenCalledWith(
        expect.stringMatching(/^\{.*\}$/) // JSON string
      );

      const loggedContent = consoleSpies.log.mock.calls[0][0];
      const parsed = JSON.parse(loggedContent);
      
      expect(parsed).toMatchObject({
        level: LogLevel.INFO,
        module: 'step-processor',
        sessionId: 'test-session',
        message: 'Test message',
        context: expect.objectContaining({
          sessionId: 'test-session',
          stepIndex: 1
        })
      });
    });
  });

  describe('Context handling', () => {
    it('should include workflow session information', () => {
      const workflowSession = {
        sessionId: 'workflow-session-id',
        executorSessionId: 'executor-session-id',
        streamId: 'stream-id',
        aiConnectionId: 'ai-connection-id',
        createdAt: new Date(),
        lastActivity: new Date(),
        status: 'ACTIVE' as any,
        metadata: {}
      };

      logger.info('Test with workflow session', {
        sessionId: 'test-session',
        workflowSession
      });

      expect(consoleSpies.info).toHaveBeenCalledWith(
        expect.stringContaining('[WF:workflow-session-id]')
      );
    });

    it('should include step index in log format', () => {
      logger.info('Step message', {
        sessionId: 'test-session',
        stepIndex: 3
      });

      expect(consoleSpies.info).toHaveBeenCalledWith(
        expect.stringContaining(':3')
      );
    });

    it('should handle large context objects by truncating', () => {
      const largeContext = {
        sessionId: 'test-session',
        details: {
          largeData: 'x'.repeat(2000) // Exceeds typical limits
        }
      };

      logger.info('Message with large context', largeContext);

      // Should not throw and should log something
      expect(consoleSpies.info).toHaveBeenCalled();
      expect(consoleSpies.log).toHaveBeenCalled(); // Context gets logged separately
    });
  });

  describe('Step Processor specific logging methods', () => {
    it('should log workflow started', () => {
      logger.logWorkflowStarted('test-session', 5);
      
      expect(consoleSpies.info).toHaveBeenCalledWith(
        expect.stringContaining('Workflow processing started with 5 steps')
      );
    });

    it('should log workflow completed', () => {
      logger.logWorkflowCompleted('test-session', 30000);
      
      expect(consoleSpies.info).toHaveBeenCalledWith(
        expect.stringContaining('Workflow processing completed successfully')
      );
    });

    it('should log workflow failed', () => {
      const error: StandardError = {
        id: 'error-id',
        category: ErrorCategory.EXECUTION,
        severity: ErrorSeverity.HIGH,
        code: 'WORKFLOW_FAILED',
        message: 'Workflow execution failed',
        timestamp: new Date(),
        moduleId: 'step-processor',
        recoverable: false,
        retryable: false
      };

      logger.logWorkflowFailed('test-session', error);
      
      expect(consoleSpies.error).toHaveBeenCalledWith(
        expect.stringContaining('Workflow processing failed'),
        expect.any(Object)
      );
    });

    it('should log step started', () => {
      logger.logStepStarted('test-session', 2, 'Click login button');
      
      expect(consoleSpies.info).toHaveBeenCalledWith(
        expect.stringContaining('Step started: "Click login button"')
      );
    });

    it('should log step completed', () => {
      logger.logStepCompleted('test-session', 2, 5000);
      
      expect(consoleSpies.info).toHaveBeenCalledWith(
        expect.stringContaining('Step completed successfully')
      );
    });

    it('should log step failed', () => {
      const error: StandardError = {
        id: 'error-id',
        category: ErrorCategory.EXECUTION,
        severity: ErrorSeverity.MEDIUM,
        code: 'STEP_FAILED',
        message: 'Step execution failed',
        timestamp: new Date(),
        moduleId: 'step-processor',
        recoverable: true,
        retryable: true
      };

      logger.logStepFailed('test-session', 2, error);
      
      expect(consoleSpies.error).toHaveBeenCalledWith(
        expect.stringContaining('Step execution failed'),
        expect.any(Object)
      );
    });

    it('should log session operations', () => {
      logger.logSessionCreated('test-session', 'workflow-session');
      expect(consoleSpies.debug).toHaveBeenCalledWith(
        expect.stringContaining('Created workflow session')
      );

      logger.logSessionDestroyed('test-session');
      expect(consoleSpies.debug).toHaveBeenCalledWith(
        expect.stringContaining('Destroyed workflow session')
      );
    });

    it('should log event publishing', () => {
      logger.logEventPublished('STEP_STARTED', 'test-session', 'stream-id');
      
      expect(consoleSpies.debug).toHaveBeenCalledWith(
        expect.stringContaining('Published event: STEP_STARTED')
      );
    });

    it('should log dependency resolution', () => {
      logger.logDependencyResolution('step-processor', 'ITaskLoop', true);
      expect(consoleSpies.debug).toHaveBeenCalledWith(
        expect.stringContaining('Resolved dependency: ITaskLoop')
      );

      logger.logDependencyResolution('step-processor', 'IMissingDep', false);
      expect(consoleSpies.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to resolve dependency: IMissingDep')
      );
    });

    it('should log performance metrics', () => {
      // Normal performance
      logger.logPerformanceMetric('processSteps', 3000, 'test-session');
      expect(consoleSpies.debug).toHaveBeenCalledWith(
        expect.stringContaining('Performance: processSteps completed in 3000ms')
      );

      // Slow performance
      logger.logPerformanceMetric('slowOperation', 8000, 'test-session');
      expect(consoleSpies.warn).toHaveBeenCalledWith(
        expect.stringContaining('Performance: slowOperation completed in 8000ms')
      );
    });
  });

  describe('Configuration handling', () => {
    it('should respect includeTimestamp setting', () => {
      const noTimestampLogger = new StepProcessorLogger({
        level: LogLevel.INFO,
        prefix: '[StepProcessor]',
        includeTimestamp: false,
        includeSessionId: true,
        includeModuleId: true,
        structured: false
      });

      noTimestampLogger.info('Test message');
      
      const loggedMessage = consoleSpies.info.mock.calls[0][0];
      expect(loggedMessage).not.toMatch(/\[\d{4}-\d{2}-\d{2}T/);
    });

    it('should respect includeSessionId setting', () => {
      const noSessionLogger = new StepProcessorLogger({
        level: LogLevel.INFO,
        prefix: '[StepProcessor]',
        includeTimestamp: false,
        includeSessionId: false,
        includeModuleId: true,
        structured: false
      });

      noSessionLogger.info('Test message', { sessionId: 'test-session' });
      
      const loggedMessage = consoleSpies.info.mock.calls[0][0];
      expect(loggedMessage).not.toContain('[test-session]');
    });

    it('should respect includeModuleId setting', () => {
      const noModuleLogger = new StepProcessorLogger({
        level: LogLevel.INFO,
        prefix: '[StepProcessor]',
        includeTimestamp: false,
        includeSessionId: false,
        includeModuleId: false,
        structured: false
      });

      noModuleLogger.info('Test message');
      
      const loggedMessage = consoleSpies.info.mock.calls[0][0];
      expect(loggedMessage).not.toContain('[StepProcessor]');
    });
  });
});

describe('Logger factory functions', () => {
  it('should create logger from LoggingConfig', () => {
    const config = {
      level: LogLevel.WARN,
      prefix: '[Test]',
      includeTimestamp: true,
      includeSessionId: true,
      includeModuleId: true,
      structured: true
    };

    const logger = createStepProcessorLogger(config);
    expect(logger).toBeInstanceOf(StepProcessorLogger);
  });

  it('should create logger from StepProcessorConfig', () => {
    const config: StepProcessorConfig = {
      ...DEFAULT_STEP_PROCESSOR_CONFIG,
      logging: {
        level: LogLevel.DEBUG,
        prefix: '[TestProcessor]',
        includeTimestamp: false,
        includeSessionId: true,
        includeModuleId: false,
        structured: true
      }
    };

    const logger = createLoggerFromConfig(config);
    expect(logger).toBeInstanceOf(StepProcessorLogger);
  });

  it('should create default logger', () => {
    const logger = createDefaultLogger();
    expect(logger).toBeInstanceOf(StepProcessorLogger);
  });
});
