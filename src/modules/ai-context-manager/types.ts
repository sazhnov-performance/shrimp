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
  
  // Add screenshot description for a specific step
  addScreenshotDescription(contextId: string, stepId: number, screenshotDescription: ScreenshotDescription): void;
  
  // Get all task logs for a specific step
  getStepContext(contextId: string, stepId: number): any[];
  
  // Get screenshot descriptions for a specific step
  getStepScreenshotDescriptions(contextId: string, stepId: number): ScreenshotDescription[];
  
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
  screenshotDescriptions: Record<number, ScreenshotDescription[]>;
  createdAt: Date;
  lastUpdated: Date;
}

export interface ScreenshotDescription {
  screenshotId: string;
  description: string;
  actionType: string;
  iteration?: number;
  timestamp: Date;
  interactibleElements?: any[]; // Array of interactive elements from IMAGE_ANALYSIS_SCHEMA
}
