/**
 * AI Context Manager Type Definitions
 */

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

export interface AIContextManagerConfig {
  maxContexts?: number;
  maxStepsPerContext?: number;
  maxLogsPerStep?: number;
}

export interface ContextData {
  contextId: string;
  steps: string[];
  stepLogs: Record<number, any[]>;
  createdAt: Date;
  lastUpdated: Date;
}
