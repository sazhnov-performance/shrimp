/**
 * Step Processor Module Type Definitions
 * Based on design/step-processor.md specifications
 */

import {
  SessionCoordinator,
  ITaskLoop
} from '../../../types/shared-types';
import { IExecutorStreamer } from '../executor-streamer/types';

/**
 * Core interface for Step Processor
 * Simple workflow orchestrator that executes steps sequentially
 */
export interface IStepProcessor {
  /**
   * Initialize processing for a list of steps and return session ID
   * @param steps Array of step strings to process
   * @returns Promise resolving to unique session ID
   */
  init(steps: string[]): Promise<string>;
}

/**
 * Internal data structure for tracking step sequence processing
 */
export interface StepSequence {
  sessionId: string;
  steps: string[];
  currentStepIndex: number;
  status: 'active' | 'completed' | 'failed';
}

/**
 * Step Processor dependencies interface
 */
export interface StepProcessorDependencies {
  sessionCoordinator: SessionCoordinator;
  taskLoop: ITaskLoop;
  executorStreamer: IExecutorStreamer;
}
