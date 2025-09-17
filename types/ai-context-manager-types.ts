/**
 * AI Context Manager Types
 * Type definitions for the AI Context Manager module
 * Based on design/ai-context-manager.md specifications
 */

// Core context data structure
export interface ContextData {
  contextId: string;
  steps: string[];
  stepLogs: Record<number, any[]>;
  createdAt: Date;
  lastUpdated: Date;
}

// Main interface for AI Context Manager
export interface IAIContextManager {
  // Create a new context with given ID
  createContext(contextId: string): void;
  
  // Set steps for a context as indexed array of step names
  setSteps(contextId: string, steps: string[]): void;
  
  // Log a task for specific context and step
  logTask(contextId: string, stepId: number, task: any): void;
  
  // Get all task logs for a specific step
  getStepContext(contextId: string, stepId: number): any[];
  
  // Get full context including all steps and their logs
  getFullContext(contextId: string): ContextData;
}

// Error types for AI Context Manager
export class AIContextManagerError extends Error {
  constructor(
    message: string,
    public readonly contextId?: string,
    public readonly stepId?: number,
    public readonly operation?: string
  ) {
    super(message);
    this.name = 'AIContextManagerError';
  }
}

// Configuration interface for the module
export interface AIContextManagerConfig {
  maxContexts?: number;        // Maximum number of contexts to keep in memory
  maxLogsPerStep?: number;     // Maximum number of logs per step
  enableMetrics?: boolean;     // Enable performance metrics
}

// Internal storage interface
export interface ContextStorage {
  [contextId: string]: ContextData;
}

// Module registration token
export const AI_CONTEXT_MANAGER_TOKEN = 'IAIContextManager';
