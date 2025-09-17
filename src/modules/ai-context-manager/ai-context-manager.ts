/**
 * AI Context Manager Implementation
 * Simple, minimalistic module for tracking execution history and providing context
 * Based on design/ai-context-manager.md specifications
 */

import { 
  IAIContextManager, 
  ContextData, 
  ContextStorage, 
  AIContextManagerError,
  AIContextManagerConfig
} from '../../../types/ai-context-manager-types';

export class AIContextManager implements IAIContextManager {
  private readonly storage: ContextStorage = {};
  private readonly config: Required<AIContextManagerConfig>;

  constructor(config: AIContextManagerConfig = {}) {
    // Set default configuration
    this.config = {
      maxContexts: config.maxContexts ?? 100,
      maxLogsPerStep: config.maxLogsPerStep ?? 1000,
      enableMetrics: config.enableMetrics ?? false
    };
  }

  /**
   * Create a new context with given ID
   * @param contextId - Unique identifier for the context
   * @throws AIContextManagerError if context already exists
   */
  createContext(contextId: string): void {
    if (!contextId || typeof contextId !== 'string') {
      throw new AIContextManagerError(
        'Context ID must be a non-empty string',
        contextId,
        undefined,
        'createContext'
      );
    }

    if (this.storage[contextId]) {
      throw new AIContextManagerError(
        `Context with ID '${contextId}' already exists`,
        contextId,
        undefined,
        'createContext'
      );
    }

    // Check if we've exceeded maximum contexts
    if (Object.keys(this.storage).length >= this.config.maxContexts) {
      throw new AIContextManagerError(
        `Maximum number of contexts (${this.config.maxContexts}) exceeded`,
        contextId,
        undefined,
        'createContext'
      );
    }

    const now = new Date();
    this.storage[contextId] = {
      contextId,
      steps: [],
      stepLogs: {},
      createdAt: now,
      lastUpdated: now
    };
  }

  /**
   * Set steps for a context as indexed array of step names
   * @param contextId - Context identifier
   * @param steps - Array of step names
   * @throws AIContextManagerError if context doesn't exist
   */
  setSteps(contextId: string, steps: string[]): void {
    this.validateContextExists(contextId, 'setSteps');
    
    if (!Array.isArray(steps)) {
      throw new AIContextManagerError(
        'Steps must be an array',
        contextId,
        undefined,
        'setSteps'
      );
    }

    const context = this.storage[contextId];
    context.steps = [...steps]; // Create a copy to prevent external mutations
    context.stepLogs = {}; // Reset step logs when steps are redefined
    
    // Initialize empty log arrays for each step
    for (let i = 0; i < steps.length; i++) {
      context.stepLogs[i] = [];
    }
    
    context.lastUpdated = new Date();
  }

  /**
   * Log a task for specific context and step
   * @param contextId - Context identifier
   * @param stepId - Step index (0-based)
   * @param task - Task data to log (any type)
   * @throws AIContextManagerError if context or step doesn't exist
   */
  logTask(contextId: string, stepId: number, task: any): void {
    this.validateContextExists(contextId, 'logTask');
    this.validateStepExists(contextId, stepId, 'logTask');

    const context = this.storage[contextId];
    const stepLogs = context.stepLogs[stepId];

    // Check if we've exceeded maximum logs per step
    if (stepLogs.length >= this.config.maxLogsPerStep) {
      throw new AIContextManagerError(
        `Maximum number of logs per step (${this.config.maxLogsPerStep}) exceeded for step ${stepId}`,
        contextId,
        stepId,
        'logTask'
      );
    }

    // Append task data to step's log array
    stepLogs.push(task);
    context.lastUpdated = new Date();
  }

  /**
   * Get all task logs for a specific step
   * @param contextId - Context identifier
   * @param stepId - Step index (0-based)
   * @returns Array of all task logs for the step
   * @throws AIContextManagerError if context or step doesn't exist
   */
  getStepContext(contextId: string, stepId: number): any[] {
    this.validateContextExists(contextId, 'getStepContext');
    this.validateStepExists(contextId, stepId, 'getStepContext');

    // Return a deep copy to prevent external mutations
    return this.deepCopyArray(this.storage[contextId].stepLogs[stepId]);
  }

  /**
   * Get full context including all steps and their logs
   * @param contextId - Context identifier
   * @returns Complete ContextData object
   * @throws AIContextManagerError if context doesn't exist
   */
  getFullContext(contextId: string): ContextData {
    this.validateContextExists(contextId, 'getFullContext');

    const context = this.storage[contextId];
    
    // Return a deep copy to prevent external mutations
    return {
      contextId: context.contextId,
      steps: [...context.steps],
      stepLogs: this.deepCopyStepLogs(context.stepLogs),
      createdAt: new Date(context.createdAt),
      lastUpdated: new Date(context.lastUpdated)
    };
  }

  /**
   * Get list of all context IDs (utility method)
   * @returns Array of context IDs
   */
  getContextIds(): string[] {
    return Object.keys(this.storage);
  }

  /**
   * Check if a context exists (utility method)
   * @param contextId - Context identifier
   * @returns True if context exists
   */
  contextExists(contextId: string): boolean {
    return contextId in this.storage;
  }

  /**
   * Get current configuration
   * @returns Current configuration object
   */
  getConfig(): Required<AIContextManagerConfig> {
    return { ...this.config };
  }

  /**
   * Get memory usage statistics (utility method)
   * @returns Object with memory usage information
   */
  getMemoryStats(): {
    totalContexts: number;
    totalSteps: number;
    totalLogs: number;
    avgLogsPerStep: number;
  } {
    const contexts = Object.values(this.storage);
    const totalContexts = contexts.length;
    let totalSteps = 0;
    let totalLogs = 0;

    for (const context of contexts) {
      totalSteps += context.steps.length;
      for (const logs of Object.values(context.stepLogs)) {
        totalLogs += logs.length;
      }
    }

    return {
      totalContexts,
      totalSteps,
      totalLogs,
      avgLogsPerStep: totalSteps > 0 ? Math.round((totalLogs / totalSteps) * 100) / 100 : 0
    };
  }

  /**
   * Clear all contexts (utility method for testing/cleanup)
   */
  clearAllContexts(): void {
    Object.keys(this.storage).forEach(key => delete this.storage[key]);
  }

  // Private helper methods

  /**
   * Validate that a context exists
   * @private
   */
  private validateContextExists(contextId: string, operation: string): void {
    if (!this.storage[contextId]) {
      throw new AIContextManagerError(
        `Context with ID '${contextId}' does not exist`,
        contextId,
        undefined,
        operation
      );
    }
  }

  /**
   * Validate that a step exists in the context
   * @private
   */
  private validateStepExists(contextId: string, stepId: number, operation: string): void {
    if (!Number.isInteger(stepId) || stepId < 0) {
      throw new AIContextManagerError(
        'Step ID must be a non-negative integer',
        contextId,
        stepId,
        operation
      );
    }

    const context = this.storage[contextId];
    if (stepId >= context.steps.length) {
      throw new AIContextManagerError(
        `Step ${stepId} does not exist in context '${contextId}'. Available steps: 0-${context.steps.length - 1}`,
        contextId,
        stepId,
        operation
      );
    }

    if (!(stepId in context.stepLogs)) {
      throw new AIContextManagerError(
        `Step logs for step ${stepId} not initialized in context '${contextId}'`,
        contextId,
        stepId,
        operation
      );
    }
  }

  /**
   * Create a deep copy of step logs to prevent external mutations
   * @private
   */
  private deepCopyStepLogs(stepLogs: Record<number, any[]>): Record<number, any[]> {
    const copy: Record<number, any[]> = {};
    for (const [stepId, logs] of Object.entries(stepLogs)) {
      copy[parseInt(stepId)] = this.deepCopyArray(logs);
    }
    return copy;
  }

  /**
   * Create a deep copy of an array and its contents
   * @private
   */
  private deepCopyArray(array: any[]): any[] {
    return array.map(item => this.deepCopyValue(item));
  }

  /**
   * Create a deep copy of a value (handles objects, arrays, primitives)
   * @private
   */
  private deepCopyValue(value: any): any {
    if (value === null || typeof value !== 'object') {
      return value; // Primitives and null
    }
    
    if (Array.isArray(value)) {
      return this.deepCopyArray(value);
    }
    
    if (value instanceof Date) {
      return new Date(value);
    }
    
    // Handle plain objects
    const copy: any = {};
    for (const [key, val] of Object.entries(value)) {
      copy[key] = this.deepCopyValue(val);
    }
    return copy;
  }
}
