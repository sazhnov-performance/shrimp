/**
 * Step Processor Event Manager Unit Tests
 */

import { StepProcessorEventManager } from '../../../src/modules/step-processor/event-manager';
import { StepProcessorLogger } from '../../../src/modules/step-processor/logger';
import {
  StreamEvent,
  StreamEventType,
  StepResult,
  StandardError,
  ErrorCategory,
  ErrorSeverity,
  ExecutionProgress,
  StepStatus,
  TaskLoopEvent,
  TaskLoopEventType,
  LogLevel,
  LoggingConfig
} from '../../../types/shared-types';

import {
  STEP_PROCESSOR_STREAM_EVENTS
} from '../../../types/step-processor';

describe('StepProcessorEventManager', () => {
  let eventManager: StepProcessorEventManager;
  let mockLogger: jest.Mocked<StepProcessorLogger>;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as any;

    eventManager = new StepProcessorEventManager(mockLogger);
  });

  describe('Step-Level Events', () => {
    const sessionId = 'session-123';
    const streamId = 'stream-456';
    const stepIndex = 2;

    it('should publish step started event', async () => {
      const stepContent = 'Navigate to example.com';

      await eventManager.publishStepStarted(streamId, sessionId, stepIndex, stepContent);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Publishing stream event',
        expect.objectContaining({
          sessionId,
          details: expect.objectContaining({
            streamId,
            eventType: STEP_PROCESSOR_STREAM_EVENTS.STEP_STARTED
          })
        })
      );
    });

    it('should skip publishing when no stream ID provided', async () => {
      await eventManager.publishStepStarted(undefined, sessionId, stepIndex, 'Step content');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'No stream ID provided, skipping event publication',
        expect.objectContaining({
          details: { eventType: STEP_PROCESSOR_STREAM_EVENTS.STEP_STARTED }
        })
      );
    });

    it('should publish step completed event', async () => {
      const stepResult: StepResult = {
        stepIndex,
        success: true,
        executedCommands: [],
        commandResults: [],
        aiReasoning: 'Step completed successfully',
        duration: 5000,
        finalPageState: {
          dom: '<html></html>',
          screenshotId: 'screenshot-123',
          url: 'https://example.com'
        }
      };

      await eventManager.publishStepCompleted(streamId, sessionId, stepIndex, stepResult);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Publishing stream event',
        expect.objectContaining({
          sessionId,
          details: expect.objectContaining({
            streamId,
            eventType: STEP_PROCESSOR_STREAM_EVENTS.STEP_COMPLETED
          })
        })
      );
    });

    it('should publish step failed event', async () => {
      const error: StandardError = {
        id: 'error-123',
        category: ErrorCategory.EXECUTION,
        severity: ErrorSeverity.HIGH,
        code: 'STEP_EXECUTION_FAILED',
        message: 'Step execution failed',
        timestamp: new Date(),
        moduleId: 'step-processor',
        recoverable: true,
        retryable: true
      };

      await eventManager.publishStepFailed(streamId, sessionId, stepIndex, error);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Publishing stream event',
        expect.objectContaining({
          sessionId,
          details: expect.objectContaining({
            streamId,
            eventType: STEP_PROCESSOR_STREAM_EVENTS.STEP_FAILED
          })
        })
      );
    });
  });

  describe('Workflow-Level Events', () => {
    const sessionId = 'session-123';
    const streamId = 'stream-456';

    it('should publish workflow started event', async () => {
      const totalSteps = 5;

      await eventManager.publishWorkflowStarted(streamId, sessionId, totalSteps);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Publishing stream event',
        expect.objectContaining({
          sessionId,
          details: expect.objectContaining({
            streamId,
            eventType: STEP_PROCESSOR_STREAM_EVENTS.WORKFLOW_STARTED
          })
        })
      );
    });

    it('should publish workflow progress event', async () => {
      const progress: ExecutionProgress = {
        sessionId,
        totalSteps: 5,
        completedSteps: 3,
        currentStepIndex: 3,
        currentStepName: 'Current step',
        overallProgress: 60,
        averageStepDuration: 10000,
        lastActivity: new Date()
      };

      await eventManager.publishWorkflowProgress(streamId, sessionId, progress);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Publishing stream event',
        expect.objectContaining({
          sessionId,
          details: expect.objectContaining({
            streamId,
            eventType: STEP_PROCESSOR_STREAM_EVENTS.WORKFLOW_PROGRESS
          })
        })
      );
    });

    it('should publish workflow completed event', async () => {
      await eventManager.publishWorkflowCompleted(streamId, sessionId);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Publishing stream event',
        expect.objectContaining({
          sessionId,
          details: expect.objectContaining({
            streamId,
            eventType: STEP_PROCESSOR_STREAM_EVENTS.WORKFLOW_COMPLETED
          })
        })
      );
    });

    it('should publish workflow failed event', async () => {
      const error: StandardError = {
        id: 'error-123',
        category: ErrorCategory.EXECUTION,
        severity: ErrorSeverity.CRITICAL,
        code: 'WORKFLOW_EXECUTION_FAILED',
        message: 'Workflow execution failed',
        timestamp: new Date(),
        moduleId: 'step-processor',
        recoverable: false,
        retryable: false
      };

      await eventManager.publishWorkflowFailed(streamId, sessionId, error);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Publishing stream event',
        expect.objectContaining({
          sessionId,
          details: expect.objectContaining({
            streamId,
            eventType: STEP_PROCESSOR_STREAM_EVENTS.WORKFLOW_FAILED
          })
        })
      );
    });

    it('should publish workflow paused event', async () => {
      await eventManager.publishWorkflowPaused(streamId, sessionId);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Publishing stream event',
        expect.objectContaining({
          sessionId,
          details: expect.objectContaining({
            streamId,
            eventType: STEP_PROCESSOR_STREAM_EVENTS.WORKFLOW_PAUSED
          })
        })
      );
    });

    it('should publish workflow resumed event', async () => {
      await eventManager.publishWorkflowResumed(streamId, sessionId);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Publishing stream event',
        expect.objectContaining({
          sessionId,
          details: expect.objectContaining({
            streamId,
            eventType: STEP_PROCESSOR_STREAM_EVENTS.WORKFLOW_RESUMED
          })
        })
      );
    });
  });

  describe('Generic Stream Event Publishing', () => {
    const sessionId = 'session-123';
    const streamId = 'stream-456';

    it('should publish generic stream event with auto-generated ID and timestamp', async () => {
      const event: Omit<StreamEvent, 'id' | 'timestamp'> = {
        type: StreamEventType.WORKFLOW_STARTED,
        sessionId,
        data: {
          message: 'Custom workflow started'
        }
      };

      await eventManager.publishStreamEvent(streamId, event);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Publishing stream event',
        expect.objectContaining({
          sessionId,
          details: expect.objectContaining({
            streamId,
            eventType: StreamEventType.WORKFLOW_STARTED,
            eventId: expect.any(String)
          })
        })
      );
    });

    it('should handle missing stream ID gracefully', async () => {
      const event: Omit<StreamEvent, 'id' | 'timestamp'> = {
        type: StreamEventType.WORKFLOW_STARTED,
        sessionId,
        data: {
          message: 'Test event'
        }
      };

      await eventManager.publishStreamEvent(undefined, event);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'No stream ID provided, skipping event publication',
        expect.objectContaining({
          details: { eventType: StreamEventType.WORKFLOW_STARTED }
        })
      );
    });

    it('should handle publishing errors gracefully', async () => {
      // Mock logger to throw error
      mockLogger.debug.mockImplementation(() => {
        throw new Error('Logging failed');
      });

      const event: Omit<StreamEvent, 'id' | 'timestamp'> = {
        type: StreamEventType.WORKFLOW_STARTED,
        sessionId,
        data: {
          message: 'Test event'
        }
      };

      // Should not throw
      await expect(eventManager.publishStreamEvent(streamId, event)).resolves.not.toThrow();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to publish stream event',
        expect.objectContaining({
          sessionId,
          details: expect.objectContaining({
            streamId,
            eventType: StreamEventType.WORKFLOW_STARTED,
            error: 'Logging failed'
          })
        })
      );
    });
  });

  describe('Task Loop Event Publishing', () => {
    const sessionId = 'session-123';
    const stepIndex = 1;

    it('should handle task loop events with logging', async () => {
      const event: TaskLoopEvent = {
        type: TaskLoopEventType.STEP_COMPLETED,
        sessionId,
        stepIndex,
        data: {
          result: {
            stepIndex,
            success: true,
            executedCommands: [],
            commandResults: [],
            aiReasoning: 'Step completed',
            duration: 3000,
            finalPageState: {
              dom: '<html></html>',
              screenshotId: 'screenshot-456',
              url: 'https://example.com'
            }
          }
        },
        timestamp: new Date()
      };

      await eventManager.publishEvent(event);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Received task loop event',
        expect.objectContaining({
          sessionId,
          details: expect.objectContaining({
            eventType: TaskLoopEventType.STEP_COMPLETED,
            stepIndex
          })
        })
      );
    });

    it('should handle task loop event publishing errors gracefully', async () => {
      // Mock logger to throw error
      mockLogger.debug.mockImplementation(() => {
        throw new Error('Debug logging failed');
      });

      const event: TaskLoopEvent = {
        type: TaskLoopEventType.AI_REASONING_UPDATE,
        sessionId,
        stepIndex,
        data: {
          reasoning: {
            content: 'AI is reasoning',
            confidence: 0.8
          }
        },
        timestamp: new Date()
      };

      // Should not throw
      await expect(eventManager.publishEvent(event)).resolves.not.toThrow();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to handle task loop event',
        expect.objectContaining({
          sessionId,
          details: expect.objectContaining({
            eventType: TaskLoopEventType.AI_REASONING_UPDATE,
            error: 'Debug logging failed'
          })
        })
      );
    });

    it('should handle events without step index', async () => {
      const event: TaskLoopEvent = {
        type: TaskLoopEventType.PROGRESS_UPDATE,
        sessionId,
        data: {
          progress: {
            sessionId,
            totalSteps: 5,
            completedSteps: 2,
            currentStepIndex: 2,
            currentStepName: 'Current step',
            overallProgress: 40,
            averageStepDuration: 8000,
            lastActivity: new Date()
          }
        },
        timestamp: new Date()
      };

      await eventManager.publishEvent(event);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Received task loop event',
        expect.objectContaining({
          sessionId,
          details: expect.objectContaining({
            eventType: TaskLoopEventType.PROGRESS_UPDATE,
            stepIndex: undefined
          })
        })
      );
    });
  });

  describe('Event ID Generation', () => {
    it('should generate unique event IDs', async () => {
      const sessionId = 'session-123';
      const streamId = 'stream-456';
      const event: Omit<StreamEvent, 'id' | 'timestamp'> = {
        type: StreamEventType.WORKFLOW_STARTED,
        sessionId,
        data: { message: 'Test event' }
      };

      // Publish multiple events
      await eventManager.publishStreamEvent(streamId, event);
      await eventManager.publishStreamEvent(streamId, event);
      await eventManager.publishStreamEvent(streamId, event);

      // Extract event IDs from the debug calls
      const debugCalls = mockLogger.debug.mock.calls.filter(call => 
        call[0] === 'Publishing stream event'
      );

      expect(debugCalls).toHaveLength(3);
      
      const eventIds = debugCalls.map(call => call[1].details.eventId);
      const uniqueEventIds = new Set(eventIds);
      
      // All event IDs should be unique
      expect(uniqueEventIds.size).toBe(3);
      
      // All event IDs should be valid UUIDs (basic check)
      eventIds.forEach(id => {
        expect(typeof id).toBe('string');
        expect(id.length).toBe(36); // UUID length
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      });
    });
  });

  describe('Event Data Validation', () => {
    const sessionId = 'session-123';
    const streamId = 'stream-456';

    it('should handle events with complex data structures', async () => {
      const stepResult: StepResult = {
        stepIndex: 1,
        success: true,
        executedCommands: [
          {
            sessionId,
            action: 'CLICK_ELEMENT' as any,
            parameters: { selector: '#button' },
            commandId: 'cmd-123',
            timestamp: new Date()
          }
        ],
        commandResults: [
          {
            success: true,
            commandId: 'cmd-123',
            dom: '<html><body>Page content</body></html>',
            screenshotId: 'screenshot-789',
            duration: 250
          }
        ],
        aiReasoning: 'Successfully clicked the button element',
        duration: 2500,
        finalPageState: {
          dom: '<html><body>Updated page content</body></html>',
          screenshotId: 'screenshot-final-456',
          url: 'https://example.com/next-page'
        }
      };

      await eventManager.publishStepCompleted(streamId, sessionId, 1, stepResult);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Publishing stream event',
        expect.objectContaining({
          sessionId,
          details: expect.objectContaining({
            streamId,
            eventType: STEP_PROCESSOR_STREAM_EVENTS.STEP_COMPLETED
          })
        })
      );
    });

    it('should handle events with minimal data', async () => {
      const error: StandardError = {
        id: 'minimal-error',
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.LOW,
        code: 'MINIMAL_ERROR',
        message: 'Minimal error',
        timestamp: new Date(),
        moduleId: 'test',
        recoverable: true,
        retryable: false
      };

      await eventManager.publishStepFailed(streamId, sessionId, 0, error);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Publishing stream event',
        expect.objectContaining({
          sessionId,
          details: expect.objectContaining({
            streamId,
            eventType: STEP_PROCESSOR_STREAM_EVENTS.STEP_FAILED
          })
        })
      );
    });
  });
});
