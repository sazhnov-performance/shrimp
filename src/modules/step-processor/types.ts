/**
 * Step Processor Module Type Definitions
 * Types for the simple step execution processor
 */

/**
 * Configuration interface for StepProcessor
 */
export interface StepProcessorConfig {
  maxConcurrentSessions?: number;  // Maximum number of concurrent sessions
  timeoutMs?: number;              // Timeout in milliseconds (default: 300000 = 5 minutes)
  enableLogging?: boolean;         // Enable logging (default: true)
}

/**
 * Main interface for the Step Processor module
 * Provides singleton pattern with step processing capabilities
 */
export interface IStepProcessor {
  // Process steps sequentially
  processSteps(steps: string[]): Promise<string>;
}

/**
 * Constructor interface for Step Processor class
 */
export interface IStepProcessorConstructor {
  getInstance(config?: StepProcessorConfig): IStepProcessor;
}
