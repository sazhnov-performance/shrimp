/**
 * Step Processor Module Implementation
 * Simple workflow orchestrator that executes a sequence of automation steps
 * by delegating individual step processing to the Task Loop module.
 * Based on design/step-processor.md specifications
 */

import {
  SessionCoordinator,
  ITaskLoop,
  StepResult
} from '../../../types/shared-types';
import { IExecutorStreamer } from '../executor-streamer/types';
import { IStepProcessor, StepSequence } from './types';

/**
 * Step Processor implementation
 * Manages session creation and sequential step execution with basic flow control
 */
export class StepProcessor implements IStepProcessor {
  private activeSequences = new Map<string, StepSequence>();

  constructor(
    private sessionCoordinator: SessionCoordinator,
    private taskLoop: ITaskLoop,
    private executorStreamer: IExecutorStreamer
  ) {}

  /**
   * Initialize processing for a list of steps and return session ID
   * Algorithm:
   * 1. Create Session: Generate unique session ID using Session Coordinator
   * 2. Create Stream: Create streaming session with same session ID using Executor Streamer
   * 3. Store Steps: Track step sequence internally
   * 4. Execute Sequential Processing: For each step in sequence:
   *    - Call taskLoop.executeStep(sessionId, stepIndex)
   *    - If result status is 'failure' or 'error': STOP processing
   *    - If result status is 'success': CONTINUE to next step
   * 5. Return Session ID: Return the generated session ID immediately after creation
   */
  async init(steps: string[]): Promise<string> {
    // 1. Create workflow session
    const workflowSession = await this.sessionCoordinator.createWorkflowSession(steps);
    const sessionId = workflowSession.sessionId;

    // 2. Create streaming session with same ID
    await this.executorStreamer.createStream(sessionId);

    // 3. Store step sequence
    const sequence: StepSequence = {
      sessionId,
      steps,
      currentStepIndex: 0,
      status: 'active'
    };
    this.activeSequences.set(sessionId, sequence);

    // 4. Start sequential processing (non-blocking)
    this.processStepsSequentially(sessionId).catch(error => {
      console.error(`Step processing failed for session ${sessionId}:`, error);
    });

    // 5. Return session ID immediately
    return sessionId;
  }

  /**
   * Process steps sequentially with proper flow control
   * Private method that handles the actual step execution logic
   */
  private async processStepsSequentially(sessionId: string): Promise<void> {
    const sequence = this.activeSequences.get(sessionId);
    if (!sequence) return;

    try {
      for (let stepIndex = 0; stepIndex < sequence.steps.length; stepIndex++) {
        sequence.currentStepIndex = stepIndex;

        // Execute step using Task Loop
        const stepResult = await this.taskLoop.executeStep(sessionId, stepIndex);

        // Flow control: stop on failure, continue on success
        if (!stepResult.success || stepResult.error) {
          sequence.status = 'failed';
          break;
        }

        // Continue to next step on success
        if (stepResult.success) {
          continue;
        }
      }

      // Mark as completed if all steps succeeded
      if (sequence.status === 'active') {
        sequence.status = 'completed';
      }

    } catch (error) {
      sequence.status = 'failed';
      throw error;
    } finally {
      // Cleanup session and stream when processing is complete
      await this.sessionCoordinator.destroyWorkflowSession(sessionId);
      // Note: Stream cleanup should be handled by the API consumer or through TTL
      this.activeSequences.delete(sessionId);
    }
  }
}

// Export the interface and implementation
export type { IStepProcessor, StepSequence } from './types';
export default StepProcessor;
