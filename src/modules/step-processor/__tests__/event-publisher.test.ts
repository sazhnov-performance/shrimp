/**
 * Step Processor Event Publisher Unit Tests
 * Tests for event publishing functionality
 */

import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import {
  TaskLoopEvent,
  TaskLoopEventType,
  StreamEventType,
  StepStatus,
  StandardError,
  ErrorCategory,
  ErrorSeverity
} from '../../../../types/shared-types';
import {
  StepProcessorEventPublisherImpl,
  createStepProcessorEventPublisher
} from '../event-publisher';
import { IExecutorStreamerInterface, ILoggerInterface } from '../types';

describe('StepProcessorEventPublisher', () => {
  let eventPublisher: StepProcessorEventPublisherImpl;
  let mockExecutorStreamer: jest.Mocked<IExecutorStreamerInterface>;
  let mockLogger: jest.Mocked<ILoggerInterface>;

  beforeEach(() => {
    mockExecutorStreamer = {
      createStream: jest.fn(),
      destroyStream: jest.fn(),
      publishEvent: jest.fn()
    };

    mockLogger = {
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

    eventPublisher = new StepProcessorEventPublisherImpl(mockLogger);
    eventPublisher.setExecutorStreamer(mockExecutorStreamer);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Step-level events', () => {
    it('should publish step started event', async () => {
      await eventPublisher.publishStepStarted(
        'test-stream',
        'test-session',
        0,
        'Open login page'
      );

      expect(mockExecutorStreamer.publishEvent).toHaveBeenCalledWith(
        'test-stream',
        expect.objectContaining({
          type: StreamEventType.STEP_STARTED,
          sessionId: 'test-session',
          stepIndex: 0,
          data: expect.objectContaining({
            step: expect.objectContaining({
              stepIndex: 0,
              stepContent: 'Open login page',
              status: StepStatus.IN_PROGRESS
            })
          })
        })
      );

      expect(mockLogger.logStepStarted).toHaveBeenCalledWith(
        'test-session',
        0,
        'Open login page'
      );
    });

    it('should truncate long step content in messages', async () => {
      const longStep = 'a'.repeat(150);
      
      await eventPublisher.publishStepStarted(
        'test-stream',
        'test-session',
        0,
        longStep
      );

      const publishedEvent = mockExecutorStreamer.publishEvent.mock.calls[0][1];
      expect(publishedEvent.data.message).toContain('...');
      expect(publishedEvent.data.message.length).toBeLessThan(longStep.length + 50);
    });

    it('should publish step completed event', async () => {
      const stepResult = {
        stepIndex: 1,
        success: true,
        executedCommands: [],
        commandResults: [],
        aiReasoning: 'Step completed successfully',
        duration: 2500,
        finalPageState: {
          dom: '<html></html>',
          screenshotId: 'screenshot-123',
          url: 'https://example.com'
        }
      };

      await eventPublisher.publishStepCompleted(
        'test-stream',
        'test-session',
        1,
        stepResult
      );

      expect(mockExecutorStreamer.publishEvent).toHaveBeenCalledWith(
        'test-stream',
        expect.objectContaining({
          type: StreamEventType.STEP_COMPLETED,
          sessionId: 'test-session',
          stepIndex: 1,
          data: expect.objectContaining({
            step: expect.objectContaining({
              stepIndex: 1,
              status: StepStatus.COMPLETED,
              result: stepResult
            })
          })
        })
      );

      expect(mockLogger.logStepCompleted).toHaveBeenCalledWith(
        'test-session',
        1,
        2500
      );
    });

    it('should publish step failed event', async () => {
      const error: StandardError = {
        id: 'error-123',
        category: ErrorCategory.EXECUTION,
        severity: ErrorSeverity.HIGH,
        code: 'STEP_EXECUTION_FAILED',
        message: 'Element not found',
        timestamp: new Date(),
        moduleId: 'step-processor',
        recoverable: true,
        retryable: true
      };

      await eventPublisher.publishStepFailed(
        'test-stream',
        'test-session',
        2,
        error
      );

      expect(mockExecutorStreamer.publishEvent).toHaveBeenCalledWith(
        'test-stream',
        expect.objectContaining({
          type: StreamEventType.STEP_FAILED,
          sessionId: 'test-session',
          stepIndex: 2,
          data: expect.objectContaining({
            step: expect.objectContaining({
              stepIndex: 2,
              status: StepStatus.FAILED
            }),
            error,
            message: expect.stringContaining('Step 3 failed')
          })
        })
      );

      expect(mockLogger.logStepFailed).toHaveBeenCalledWith(
        'test-session',
        2,
        error
      );
    });
  });

  describe('Workflow-level events', () => {
    it('should publish workflow started event', async () => {
      await eventPublisher.publishWorkflowStarted(
        'test-stream',
        'test-session',
        5
      );

      expect(mockExecutorStreamer.publishEvent).toHaveBeenCalledWith(
        'test-stream',
        expect.objectContaining({
          type: StreamEventType.WORKFLOW_STARTED,
          sessionId: 'test-session',
          data: expect.objectContaining({
            step: expect.objectContaining({
              stepIndex: 0,
              stepContent: 'Starting workflow with 5 steps',
              status: StepStatus.PENDING
            }),
            message: 'Workflow processing started with 5 steps',
            details: { totalSteps: 5 }
          })
        })
      );

      expect(mockLogger.logWorkflowStarted).toHaveBeenCalledWith(
        'test-session',
        5
      );
    });

    it('should publish workflow progress event', async () => {
      const progress = {
        sessionId: 'test-session',
        totalSteps: 5,
        completedSteps: 3,
        currentStepIndex: 3,
        currentStepName: 'Current step',
        overallProgress: 60,
        estimatedTimeRemaining: 30000,
        averageStepDuration: 5000,
        lastActivity: new Date()
      };

      await eventPublisher.publishWorkflowProgress(
        'test-stream',
        'test-session',
        progress
      );

      expect(mockExecutorStreamer.publishEvent).toHaveBeenCalledWith(
        'test-stream',
        expect.objectContaining({
          type: StreamEventType.WORKFLOW_PROGRESS,
          sessionId: 'test-session',
          stepIndex: 3,
          data: expect.objectContaining({
            progress: expect.objectContaining({
              sessionId: 'test-session',
              totalSteps: 5,
              completedSteps: 3,
              currentStepIndex: 3,
              overallProgress: 60
            }),
            message: expect.stringContaining('3/5 steps completed (60%)')
          })
        })
      );
    });

    it('should publish workflow completed event', async () => {
      await eventPublisher.publishWorkflowCompleted(
        'test-stream',
        'test-session'
      );

      expect(mockExecutorStreamer.publishEvent).toHaveBeenCalledWith(
        'test-stream',
        expect.objectContaining({
          type: StreamEventType.WORKFLOW_COMPLETED,
          sessionId: 'test-session',
          data: expect.objectContaining({
            message: 'Workflow processing completed successfully'
          })
        })
      );

      expect(mockLogger.logWorkflowCompleted).toHaveBeenCalledWith(
        'test-session',
        0
      );
    });

    it('should publish workflow failed event', async () => {
      const error: StandardError = {
        id: 'workflow-error',
        category: ErrorCategory.EXECUTION,
        severity: ErrorSeverity.CRITICAL,
        code: 'WORKFLOW_EXECUTION_FAILED',
        message: 'Workflow execution failed',
        timestamp: new Date(),
        moduleId: 'step-processor',
        recoverable: false,
        retryable: false
      };

      await eventPublisher.publishWorkflowFailed(
        'test-stream',
        'test-session',
        error
      );

      expect(mockExecutorStreamer.publishEvent).toHaveBeenCalledWith(
        'test-stream',
        expect.objectContaining({
          type: StreamEventType.WORKFLOW_FAILED,
          sessionId: 'test-session',
          data: expect.objectContaining({
            error,
            message: expect.stringContaining('Workflow processing failed')
          })
        })
      );

      expect(mockLogger.logWorkflowFailed).toHaveBeenCalledWith(
        'test-session',
        error
      );
    });

    it('should publish workflow paused event', async () => {
      await eventPublisher.publishWorkflowPaused(
        'test-stream',
        'test-session'
      );

      expect(mockExecutorStreamer.publishEvent).toHaveBeenCalledWith(
        'test-stream',
        expect.objectContaining({
          type: StreamEventType.WORKFLOW_PAUSED,
          sessionId: 'test-session',
          data: expect.objectContaining({
            message: 'Workflow execution paused'
          })
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Workflow execution paused',
        { sessionId: 'test-session' }
      );
    });

    it('should publish workflow resumed event', async () => {
      await eventPublisher.publishWorkflowResumed(
        'test-stream',
        'test-session'
      );

      expect(mockExecutorStreamer.publishEvent).toHaveBeenCalledWith(
        'test-stream',
        expect.objectContaining({
          type: StreamEventType.WORKFLOW_RESUMED,
          sessionId: 'test-session',
          data: expect.objectContaining({
            message: 'Workflow execution resumed'
          })
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Workflow execution resumed',
        { sessionId: 'test-session' }
      );
    });
  });

  describe('Generic stream event publishing', () => {
    it('should publish stream events with generated ID and timestamp', async () => {
      const event = {
        type: StreamEventType.STEP_STARTED,
        sessionId: 'test-session',
        stepIndex: 0,
        data: {
          message: 'Test event'
        }
      };

      await eventPublisher.publishStreamEvent('test-stream', event);

      expect(mockExecutorStreamer.publishEvent).toHaveBeenCalledWith(
        'test-stream',
        expect.objectContaining({
          ...event,
          id: expect.any(String),
          timestamp: expect.any(Date)
        })
      );

      expect(mockLogger.logEventPublished).toHaveBeenCalledWith(
        StreamEventType.STEP_STARTED,
        'test-session',
        'test-stream'
      );
    });

    it('should skip publishing when no stream ID provided', async () => {
      const event = {
        type: StreamEventType.STEP_STARTED,
        sessionId: 'test-session',
        data: { message: 'Test event' }
      };

      await eventPublisher.publishStreamEvent(undefined, event);

      expect(mockExecutorStreamer.publishEvent).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Skipping event publishing'),
        expect.objectContaining({
          sessionId: 'test-session'
        })
      );
    });

    it('should skip publishing when no executor streamer available', async () => {
      const publisherWithoutStreamer = new StepProcessorEventPublisherImpl(mockLogger);
      
      const event = {
        type: StreamEventType.STEP_STARTED,
        sessionId: 'test-session',
        data: { message: 'Test event' }
      };

      await publisherWithoutStreamer.publishStreamEvent('test-stream', event);

      expect(mockExecutorStreamer.publishEvent).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Skipping event publishing'),
        expect.objectContaining({
          sessionId: 'test-session'
        })
      );
    });

    it('should handle publishing errors', async () => {
      mockExecutorStreamer.publishEvent.mockRejectedValue(new Error('Stream error'));

      const event = {
        type: StreamEventType.STEP_STARTED,
        sessionId: 'test-session',
        data: { message: 'Test event' }
      };

      await expect(
        eventPublisher.publishStreamEvent('test-stream', event)
      ).rejects.toThrow('Stream error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to publish stream event',
        undefined,
        expect.objectContaining({
          sessionId: 'test-session',
          details: expect.objectContaining({
            eventType: StreamEventType.STEP_STARTED,
            streamId: 'test-stream',
            error: 'Stream error'
          })
        })
      );
    });
  });

  describe('Task Loop event handling', () => {
    it('should handle step started events from Task Loop', async () => {
      const taskLoopEvent: TaskLoopEvent = {
        type: TaskLoopEventType.STEP_STARTED,
        sessionId: 'test-session',
        stepIndex: 1,
        data: {},
        timestamp: new Date()
      };

      await eventPublisher.publishEvent(taskLoopEvent);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Task Loop step started event received'),
        expect.objectContaining({
          sessionId: 'test-session',
          stepIndex: 1
        })
      );
    });

    it('should handle step completed events from Task Loop', async () => {
      const stepResult = {
        stepIndex: 1,
        success: true,
        executedCommands: [],
        commandResults: [],
        aiReasoning: 'Completed',
        duration: 1000,
        finalPageState: {
          dom: '<html></html>',
          screenshotId: 'screenshot-123',
          url: 'https://example.com'
        }
      };

      const taskLoopEvent: TaskLoopEvent = {
        type: TaskLoopEventType.STEP_COMPLETED,
        sessionId: 'test-session',
        stepIndex: 1,
        data: { result: stepResult },
        timestamp: new Date()
      };

      await eventPublisher.publishEvent(taskLoopEvent);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Task Loop step completed event received'),
        expect.objectContaining({
          sessionId: 'test-session',
          stepIndex: 1,
          details: { success: true }
        })
      );
    });

    it('should handle step failed events from Task Loop', async () => {
      const error: StandardError = {
        id: 'error-123',
        category: ErrorCategory.EXECUTION,
        severity: ErrorSeverity.HIGH,
        code: 'STEP_FAILED',
        message: 'Step execution failed',
        timestamp: new Date(),
        moduleId: 'task-loop',
        recoverable: true,
        retryable: true
      };

      const taskLoopEvent: TaskLoopEvent = {
        type: TaskLoopEventType.STEP_FAILED,
        sessionId: 'test-session',
        stepIndex: 2,
        data: { error },
        timestamp: new Date()
      };

      await eventPublisher.publishEvent(taskLoopEvent);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Task Loop step failed event received'),
        expect.objectContaining({
          sessionId: 'test-session',
          stepIndex: 2,
          details: { errorCode: 'STEP_FAILED' }
        })
      );
    });

    it('should handle AI reasoning update events', async () => {
      const taskLoopEvent: TaskLoopEvent = {
        type: TaskLoopEventType.AI_REASONING_UPDATE,
        sessionId: 'test-session',
        stepIndex: 1,
        data: {
          reasoning: {
            content: 'AI reasoning content',
            confidence: 0.85
          }
        },
        timestamp: new Date()
      };

      await eventPublisher.publishEvent(taskLoopEvent);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('AI reasoning update received'),
        expect.objectContaining({
          sessionId: 'test-session',
          stepIndex: 1,
          details: {
            confidence: 0.85,
            contentLength: 20
          }
        })
      );
    });

    it('should handle command executed events', async () => {
      const taskLoopEvent: TaskLoopEvent = {
        type: TaskLoopEventType.COMMAND_EXECUTED,
        sessionId: 'test-session',
        stepIndex: 1,
        data: {
          command: {
            command: {
              sessionId: 'test-session',
              action: 'CLICK_ELEMENT' as any,
              parameters: {},
              commandId: 'cmd-123',
              timestamp: new Date()
            },
            result: {
              success: true,
              commandId: 'cmd-123',
              dom: '<html></html>',
              screenshotId: 'screenshot-123',
              duration: 500
            }
          }
        },
        timestamp: new Date()
      };

      await eventPublisher.publishEvent(taskLoopEvent);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Command execution completed'),
        expect.objectContaining({
          sessionId: 'test-session',
          stepIndex: 1,
          details: {
            commandId: 'cmd-123',
            action: 'CLICK_ELEMENT',
            success: true
          }
        })
      );
    });

    it('should handle progress update events', async () => {
      const progress = {
        sessionId: 'test-session',
        totalSteps: 5,
        completedSteps: 2,
        currentStepIndex: 2,
        currentStepName: 'Current step',
        overallProgress: 40,
        averageStepDuration: 3000,
        lastActivity: new Date()
      };

      const taskLoopEvent: TaskLoopEvent = {
        type: TaskLoopEventType.PROGRESS_UPDATE,
        sessionId: 'test-session',
        data: { progress },
        timestamp: new Date()
      };

      await eventPublisher.publishEvent(taskLoopEvent);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Progress update received'),
        expect.objectContaining({
          sessionId: 'test-session',
          details: {
            currentStep: 2,
            totalSteps: 5,
            progress: 40
          }
        })
      );
    });

    it('should handle unknown event types gracefully', async () => {
      const taskLoopEvent: TaskLoopEvent = {
        type: 'UNKNOWN_EVENT_TYPE' as any,
        sessionId: 'test-session',
        data: {},
        timestamp: new Date()
      };

      await eventPublisher.publishEvent(taskLoopEvent);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Unhandled task loop event type'),
        expect.objectContaining({
          sessionId: 'test-session',
          details: { eventType: 'UNKNOWN_EVENT_TYPE' }
        })
      );
    });

    it('should handle event processing errors', async () => {
      mockLogger.debug.mockImplementation(() => {
        throw new Error('Logger error');
      });

      const taskLoopEvent: TaskLoopEvent = {
        type: TaskLoopEventType.STEP_STARTED,
        sessionId: 'test-session',
        data: {},
        timestamp: new Date()
      };

      await eventPublisher.publishEvent(taskLoopEvent);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to handle task loop event',
        undefined,
        expect.objectContaining({
          sessionId: 'test-session',
          details: expect.objectContaining({
            eventType: TaskLoopEventType.STEP_STARTED,
            error: 'Logger error'
          })
        })
      );
    });
  });
});

describe('createStepProcessorEventPublisher', () => {
  it('should create event publisher instance', () => {
    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as any;

    const eventPublisher = createStepProcessorEventPublisher(mockLogger);
    expect(eventPublisher).toBeInstanceOf(StepProcessorEventPublisherImpl);
  });
});
