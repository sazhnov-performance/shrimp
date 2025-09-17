/**
 * Step Processor Module Implementation
 * A SIMPLE function that executes steps sequentially
 */

import { 
  IStepProcessor, 
  IStepProcessorConstructor,
  StepProcessorConfig 
} from './types';
import { IExecutorStreamer } from '../executor-streamer/types';
import getExecutorStreamer from '../executor-streamer/index';
import { ITaskLoop } from '../task-loop/types';
import TaskLoop from '../task-loop/index';
import { IAIPromptManager } from '../ai-prompt-manager/types';
import AIPromptManager from '../ai-prompt-manager/index';
import { IExecutor, Executor } from '../executor/index';

/**
 * StepProcessor - Singleton implementation of sequential step execution
 */
export class StepProcessor implements IStepProcessor {
  private static instance: StepProcessor | null = null;
  private config: StepProcessorConfig;
  private executorStreamer: IExecutorStreamer;
  private taskLoop: ITaskLoop;
  private promptManager: IAIPromptManager;
  private executor: IExecutor;
  private activeSessions: Set<string> = new Set();

  private constructor(config: StepProcessorConfig = {}) {
    this.config = {
      maxConcurrentSessions: 10,
      timeoutMs: 300000, // 5 minutes
      enableLogging: true,
      ...config
    };
    
    // Resolve dependencies internally using singleton instances
    this.executorStreamer = getExecutorStreamer();
    this.taskLoop = TaskLoop.getInstance();
    this.promptManager = AIPromptManager.getInstance();
    this.executor = Executor.getInstance();
    
    if (this.config.enableLogging) {
      console.log('[StepProcessor] Step Processor module initialized', {
        maxConcurrentSessions: this.config.maxConcurrentSessions,
        timeoutMs: this.config.timeoutMs,
        enableLogging: this.config.enableLogging
      });
    }
  }

  /**
   * Get singleton instance of StepProcessor
   * @param config Optional configuration for the step processor
   * @returns StepProcessor instance
   */
  static getInstance(config?: StepProcessorConfig): IStepProcessor {
    if (!StepProcessor.instance) {
      StepProcessor.instance = new StepProcessor(config);
    }
    return StepProcessor.instance;
  }

  /**
   * Process steps sequentially 
   * This is the ENTIRE algorithm:
   * 1. Create Session: Generate unique session ID
   * 2. Initialize AI Context: Initialize AI context with session ID and steps using AI Prompt Manager
   * 3. Create Stream: Create streaming session with same session ID  
   * 4. Create Executor Session: Create executor session for browser automation
   * 5. Return Session ID: Return the session ID immediately after session setup
   * 6. Execute Steps Asynchronously: For each step, call taskLoop.executeStep(sessionId, stepIndex)
   *    - If failure: STOP
   *    - If success: CONTINUE to next step
   * 
   * @param steps Array of step strings to execute
   * @returns Promise<string> Session ID (returned immediately after session setup)
   */
  async processSteps(steps: string[]): Promise<string> {
    // Create session
    const sessionId = this.generateId();
    
    if (this.config.enableLogging) {
      console.log(`[StepProcessor] Starting step processing for session ${sessionId} with ${steps.length} steps`);
    }
    
    try {
      // Initialize AI context with steps - this is critical for task loop execution
      this.promptManager.init(sessionId, steps);
      
      if (this.config.enableLogging) {
        console.log(`[StepProcessor] Initialized AI context for session ${sessionId}`);
      }
      
      // Create stream - handle internally
      await this.executorStreamer.createStream(sessionId);
      
      if (this.config.enableLogging) {
        console.log(`[StepProcessor] Created stream for session ${sessionId}`);
      }
      
      // Create executor session - this is critical for browser automation
      await this.executor.createSession(sessionId);
      
      if (this.config.enableLogging) {
        console.log(`[StepProcessor] Created executor session for session ${sessionId}`);
      }
      
      // Return session ID immediately after session setup
      // Execute steps asynchronously without blocking the return
      this.executeStepsAsync(sessionId, steps);
      
      return sessionId;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (this.config.enableLogging) {
        console.error(`[StepProcessor] Error during session setup for session ${sessionId}: ${errorMessage}`);
      }
      
      // Clean up on setup error
      await this.cleanupSession(sessionId);
      
      // Re-throw error for caller to handle
      throw error;
    }
  }

  /**
   * Execute steps asynchronously in the background
   * @param sessionId Session ID
   * @param steps Array of steps to execute
   */
  private async executeStepsAsync(sessionId: string, steps: string[]): Promise<void> {
    let shouldCleanup = true;
    
    try {
      if (this.config.enableLogging) {
        console.log(`[StepProcessor] Starting async step execution for session ${sessionId}`);
      }
      
      // Execute steps sequentially - handle internally  
      for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
        if (this.config.enableLogging) {
          console.log(`[StepProcessor] Executing step ${stepIndex} for session ${sessionId}`);
        }
        
        try {
          const result = await this.taskLoop.executeStep(sessionId, stepIndex);
          
          // Stop on failure, continue on success
          if (result.status === 'failure' || result.status === 'error') {
            if (this.config.enableLogging) {
              console.log(`[StepProcessor] Step ${stepIndex} failed for session ${sessionId}. Status: ${result.status}. Error: ${result.error}. Stopping execution.`);
            }
            break;
          }
          
          if (this.config.enableLogging) {
            console.log(`[StepProcessor] Step ${stepIndex} completed successfully for session ${sessionId}. Continuing to next step.`);
          }
        } catch (stepError) {
          const stepErrorMessage = stepError instanceof Error ? stepError.message : String(stepError);
          if (this.config.enableLogging) {
            console.error(`[StepProcessor] Error executing step ${stepIndex} for session ${sessionId}: ${stepErrorMessage}`);
          }
          
          // On step execution error, we still want to cleanup
          break;
        }
      }
      
      if (this.config.enableLogging) {
        console.log(`[StepProcessor] Async step processing completed for session ${sessionId}`);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (this.config.enableLogging) {
        console.error(`[StepProcessor] Error during async step processing for session ${sessionId}: ${errorMessage}`);
      }
    }
    
    // Only cleanup if we should (moved out of finally to prevent premature cleanup)
    if (shouldCleanup) {
      await this.cleanupSession(sessionId);
    }
  }

  /**
   * Clean up session resources
   * @param sessionId Session ID to clean up
   */
  private async cleanupSession(sessionId: string): Promise<void> {
    try {
      if (this.executor.sessionExists(sessionId)) {
        await this.executor.destroySession(sessionId);
        if (this.config.enableLogging) {
          console.log(`[StepProcessor] Cleaned up executor session for session ${sessionId}`);
        }
      }
    } catch (cleanupError) {
      if (this.config.enableLogging) {
        console.error(`[StepProcessor] Error cleaning up executor session ${sessionId}: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
      }
    }
  }

  /**
   * Generate unique session ID
   * @returns Unique session identifier
   */
  private generateId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export the main interface and implementation
export { StepProcessor as default };

// Export types
export type { 
  IStepProcessor, 
  StepProcessorConfig 
} from './types';
