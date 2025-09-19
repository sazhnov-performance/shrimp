/**
 * Task Loop Module Configuration
 * Default configuration constants and settings
 */

import { TaskLoopConfig } from './types';

// Default configuration for Task Loop
export const DEFAULT_CONFIG: TaskLoopConfig = {
  maxIterations: getMaxIterationsFromEnv(),
  timeoutMs: 300000, // 5 minutes
  enableLogging: true
};

/**
 * Get maxIterations from environment variable TASK_LOOP_LIMIT
 * Falls back to default value of 4 if not set or invalid
 */
function getMaxIterationsFromEnv(): number {
  const envValue = process.env.TASK_LOOP_LIMIT;
  if (!envValue) {
    return 4; // Default value
  }
  
  const parsedValue = parseInt(envValue, 10);
  if (isNaN(parsedValue) || parsedValue <= 0) {
    console.warn(`[TaskLoop] Invalid TASK_LOOP_LIMIT value: ${envValue}. Using default value: 4`);
    return 4;
  }
  
  if (parsedValue > 100) {
    console.warn(`[TaskLoop] TASK_LOOP_LIMIT value ${parsedValue} exceeds maximum of 100. Using default value: 4`);
    return 4;
  }
  
  return parsedValue;
}

// Configuration validation
export function validateConfig(config: Partial<TaskLoopConfig>): TaskLoopConfig {
  const validatedConfig: TaskLoopConfig = {
    ...DEFAULT_CONFIG,
    ...config
  };

  // Validate maxIterations
  if (validatedConfig.maxIterations <= 0) {
    throw new Error('maxIterations must be a positive number');
  }

  // Validate timeoutMs
  if (validatedConfig.timeoutMs <= 0) {
    throw new Error('timeoutMs must be a positive number');
  }

  // Validate maxIterations is reasonable
  if (validatedConfig.maxIterations > 100) {
    throw new Error('maxIterations should not exceed 100 for safety');
  }

  // Validate timeout is reasonable (max 1 hour)
  if (validatedConfig.timeoutMs > 3600000) {
    throw new Error('timeoutMs should not exceed 1 hour (3600000ms)');
  }

  return validatedConfig;
}

// Configuration factory function
export function createConfig(overrides?: Partial<TaskLoopConfig>): TaskLoopConfig {
  try {
    return validateConfig(overrides || {});
  } catch (error) {
    throw new Error(`Invalid Task Loop configuration: ${error instanceof Error ? error.message : String(error)}`);
  }
}
