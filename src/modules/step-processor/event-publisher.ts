/**
 * Step Processor Event Publisher Implementation
 * Handles publishing of workflow and step events to the streaming system
 * Based on design/step-processor.md specifications
 */

import {
  StreamEvent,
  StreamEventType,
  StreamEventData,
  StepStatus,
  StandardError,
  StepResult,
  ExecutionProgress,
  TaskLoopEvent
} from '../../../types/shared-types';
import {
  StepProcessorEventPublisher,
  IExecutorStreamerInterface,
  ILoggerInterface,
  STEP_PROCESSOR_STREAM_EVENTS
} from './types';

export class StepProcessorEventPublisherImpl implements StepProcessorEventPublisher {
  private executorStreamer?: IExecutorStreamerInterface;
  private logger: ILoggerInterface;

  constructor(logger: ILoggerInterface) {
    this.logger = logger;
  }

  // Set the executor streamer dependency (injected after initialization)
  setExecutorStreamer(executorStreamer: IExecutorStreamerInterface): void {
    this.executorStreamer = executorStreamer;
  }

  // IEventPublisher implementation - handles events from Task Loop
  async publishEvent(event: TaskLoopEvent): Promise<void> {
    try {
      switch (event.type) {
        case 'STEP_STARTED':
          await this.handleTaskLoopStepStarted(event);
          break;

        case 'STEP_COMPLETED':
          await this.handleTaskLoopStepCompleted(event);
          break;

        case 'STEP_FAILED':
          await this.handleTaskLoopStepFailed(event);
          break;

        case 'AI_REASONING_UPDATE':
          await this.handleAIReasoningUpdate(event);
          break;

        case 'COMMAND_EXECUTED':
          await this.handleCommandExecuted(event);
          break;

        case 'PROGRESS_UPDATE':
          await this.handleProgressUpdate(event);
          break;

        default:
          this.logger.debug(`Unhandled task loop event type: ${event.type}`, {
            sessionId: event.sessionId,
            details: { eventType: event.type }
          });
      }
    } catch (error) {
      this.logger.error('Failed to handle task loop event', undefined, {
        sessionId: event.sessionId,
        stepIndex: event.stepIndex,
        details: { eventType: event.type, error: error instanceof Error ? error.message : String(error) }
      });
    }
  }

  // Step-level events (owned by Step Processor)
  async publishStepStarted(streamId: string | undefined, sessionId: string, stepIndex: number, stepContent: string): Promise<void> {
    const event: Omit<StreamEvent, 'id' | 'timestamp'> = {
      type: STEP_PROCESSOR_STREAM_EVENTS.STEP_STARTED,
      sessionId,
      stepIndex,
      data: {
        step: {
          stepIndex,
          stepContent,
          status: StepStatus.IN_PROGRESS
        },
        message: `Step ${stepIndex + 1} started: ${stepContent.substring(0, 100)}${stepContent.length > 100 ? '...' : ''}`
      }
    };

    await this.publishStreamEvent(streamId, event);
    this.logger.logStepStarted(sessionId, stepIndex, stepContent);
  }

  async publishStepCompleted(streamId: string | undefined, sessionId: string, stepIndex: number, result: StepResult): Promise<void> {
    const event: Omit<StreamEvent, 'id' | 'timestamp'> = {
      type: STEP_PROCESSOR_STREAM_EVENTS.STEP_COMPLETED,
      sessionId,
      stepIndex,
      data: {
        step: {
          stepIndex,
          stepContent: `Step ${stepIndex + 1}`,
          status: StepStatus.COMPLETED,
          result
        },
        message: `Step ${stepIndex + 1} completed successfully`
      }
    };

    await this.publishStreamEvent(streamId, event);
    this.logger.logStepCompleted(sessionId, stepIndex, result.duration);
  }

  async publishStepFailed(streamId: string | undefined, sessionId: string, stepIndex: number, error: StandardError): Promise<void> {
    const event: Omit<StreamEvent, 'id' | 'timestamp'> = {
      type: STEP_PROCESSOR_STREAM_EVENTS.STEP_FAILED,
      sessionId,
      stepIndex,
      data: {
        step: {
          stepIndex,
          stepContent: `Step ${stepIndex + 1}`,
          status: StepStatus.FAILED
        },
        error,
        message: `Step ${stepIndex + 1} failed: ${error.message}`
      }
    };

    await this.publishStreamEvent(streamId, event);
    this.logger.logStepFailed(sessionId, stepIndex, error);
  }

  // Workflow-level events (owned by Step Processor)
  async publishWorkflowStarted(streamId: string | undefined, sessionId: string, totalSteps: number): Promise<void> {
    const event: Omit<StreamEvent, 'id' | 'timestamp'> = {
      type: STEP_PROCESSOR_STREAM_EVENTS.WORKFLOW_STARTED,
      sessionId,
      data: {
        step: {
          stepIndex: 0,
          stepContent: `Starting workflow with ${totalSteps} steps`,
          status: StepStatus.PENDING
        },
        message: `Workflow processing started with ${totalSteps} steps`,
        details: { totalSteps }
      }
    };

    await this.publishStreamEvent(streamId, event);
    this.logger.logWorkflowStarted(sessionId, totalSteps);
  }

  async publishWorkflowProgress(streamId: string | undefined, sessionId: string, progress: ExecutionProgress): Promise<void> {
    const event: Omit<StreamEvent, 'id' | 'timestamp'> = {
      type: STEP_PROCESSOR_STREAM_EVENTS.WORKFLOW_PROGRESS,
      sessionId,
      stepIndex: progress.currentStepIndex,
      data: {
        progress: {
          sessionId: progress.sessionId,
          totalSteps: progress.totalSteps,
          completedSteps: progress.completedSteps,
          currentStepIndex: progress.currentStepIndex,
          overallProgress: progress.overallProgress,
          estimatedTimeRemaining: progress.estimatedTimeRemaining
        },
        message: `Workflow progress: ${progress.completedSteps}/${progress.totalSteps} steps completed (${Math.round(progress.overallProgress)}%)`
      }
    };

    await this.publishStreamEvent(streamId, event);
  }

  async publishWorkflowCompleted(streamId: string | undefined, sessionId: string): Promise<void> {
    const event: Omit<StreamEvent, 'id' | 'timestamp'> = {
      type: STEP_PROCESSOR_STREAM_EVENTS.WORKFLOW_COMPLETED,
      sessionId,
      data: {
        message: 'Workflow processing completed successfully'
      }
    };

    await this.publishStreamEvent(streamId, event);
    this.logger.logWorkflowCompleted(sessionId, 0); // Duration will be calculated elsewhere
  }

  async publishWorkflowFailed(streamId: string | undefined, sessionId: string, error: StandardError): Promise<void> {
    const event: Omit<StreamEvent, 'id' | 'timestamp'> = {
      type: STEP_PROCESSOR_STREAM_EVENTS.WORKFLOW_FAILED,
      sessionId,
      data: {
        error,
        message: `Workflow processing failed: ${error.message}`
      }
    };

    await this.publishStreamEvent(streamId, event);
    this.logger.logWorkflowFailed(sessionId, error);
  }

  async publishWorkflowPaused(streamId: string | undefined, sessionId: string): Promise<void> {
    const event: Omit<StreamEvent, 'id' | 'timestamp'> = {
      type: STEP_PROCESSOR_STREAM_EVENTS.WORKFLOW_PAUSED,
      sessionId,
      data: {
        message: 'Workflow execution paused'
      }
    };

    await this.publishStreamEvent(streamId, event);
    this.logger.info('Workflow execution paused', { sessionId });
  }

  async publishWorkflowResumed(streamId: string | undefined, sessionId: string): Promise<void> {
    const event: Omit<StreamEvent, 'id' | 'timestamp'> = {
      type: STEP_PROCESSOR_STREAM_EVENTS.WORKFLOW_RESUMED,
      sessionId,
      data: {
        message: 'Workflow execution resumed'
      }
    };

    await this.publishStreamEvent(streamId, event);
    this.logger.info('Workflow execution resumed', { sessionId });
  }

  // Generic stream event publishing
  async publishStreamEvent(streamId: string | undefined, event: Omit<StreamEvent, 'id' | 'timestamp'>): Promise<void> {
    if (!streamId || !this.executorStreamer) {
      this.logger.debug('Skipping event publishing - no stream ID or executor streamer', {
        sessionId: event.sessionId,
        details: { 
          hasStreamId: !!streamId, 
          hasExecutorStreamer: !!this.executorStreamer,
          eventType: event.type 
        }
      });
      return;
    }

    try {
      const fullEvent: StreamEvent = {
        ...event,
        id: crypto.randomUUID(),
        timestamp: new Date()
      };

      await this.executorStreamer.publishEvent(streamId, fullEvent);
      
      this.logger.logEventPublished(event.type, event.sessionId, streamId);
    } catch (error) {
      this.logger.error('Failed to publish stream event', undefined, {
        sessionId: event.sessionId,
        stepIndex: event.stepIndex,
        details: { 
          eventType: event.type, 
          streamId,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      throw error; // Re-throw to let caller handle
    }
  }

  // Private methods for handling Task Loop events
  private async handleTaskLoopStepStarted(event: TaskLoopEvent): Promise<void> {
    // Task Loop step started events are handled internally
    // Step Processor doesn't need to publish additional events for this
    this.logger.debug(`Task Loop step started event received`, {
      sessionId: event.sessionId,
      stepIndex: event.stepIndex
    });
  }

  private async handleTaskLoopStepCompleted(event: TaskLoopEvent): Promise<void> {
    if (event.data.result && event.stepIndex !== undefined) {
      // The step completion is handled by the main Step Processor logic
      // This is just for logging/internal tracking
      this.logger.debug(`Task Loop step completed event received`, {
        sessionId: event.sessionId,
        stepIndex: event.stepIndex,
        details: { success: event.data.result.success }
      });
    }
  }

  private async handleTaskLoopStepFailed(event: TaskLoopEvent): Promise<void> {
    if (event.data.error && event.stepIndex !== undefined) {
      // The step failure is handled by the main Step Processor logic
      // This is just for logging/internal tracking
      this.logger.debug(`Task Loop step failed event received`, {
        sessionId: event.sessionId,
        stepIndex: event.stepIndex,
        details: { errorCode: event.data.error.code }
      });
    }
  }

  private async handleAIReasoningUpdate(event: TaskLoopEvent): Promise<void> {
    // AI reasoning updates are owned by Task Loop/AI Integration
    // Step Processor only forwards this information internally
    if (event.data.reasoning) {
      this.logger.debug(`AI reasoning update received`, {
        sessionId: event.sessionId,
        stepIndex: event.stepIndex,
        details: { 
          confidence: event.data.reasoning.confidence,
          contentLength: event.data.reasoning.content.length
        }
      });
    }
  }

  private async handleCommandExecuted(event: TaskLoopEvent): Promise<void> {
    // Command execution events are owned by Task Loop
    // Step Processor only forwards this information internally
    if (event.data.command) {
      this.logger.debug(`Command execution completed`, {
        sessionId: event.sessionId,
        stepIndex: event.stepIndex,
        details: { 
          commandId: event.data.command.command.commandId,
          action: event.data.command.command.action,
          success: event.data.command.result.success
        }
      });
    }
  }

  private async handleProgressUpdate(event: TaskLoopEvent): Promise<void> {
    if (event.data.progress) {
      // Progress updates can be forwarded to streaming
      // This allows real-time progress tracking
      this.logger.debug(`Progress update received`, {
        sessionId: event.sessionId,
        details: { 
          currentStep: event.data.progress.currentStepIndex,
          totalSteps: event.data.progress.totalSteps,
          progress: event.data.progress.overallProgress
        }
      });
    }
  }
}

// Factory function for creating event publisher instances
export function createStepProcessorEventPublisher(logger: ILoggerInterface): StepProcessorEventPublisher {
  return new StepProcessorEventPublisherImpl(logger);
}
