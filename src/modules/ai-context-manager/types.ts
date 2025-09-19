/**
 * AI Context Manager Type Definitions
 */

// Task log entry interface for better type safety
export interface TaskLogEntry {
  iteration: number;
  aiResponse?: {
    reasoning: string;
    confidence: string;
    flowControl: string;
    action?: {
      command: string;
      parameters: Record<string, unknown>;
    };
  };
  executionResult?: {
    success: boolean;
    result?: unknown;
    error?: string;
  };
  timestamp: Date;
  [key: string]: unknown;
}

// Interactive element interface for screenshot descriptions
export interface InteractibleElement {
  type: string;
  id?: string;
  class?: string;
  text?: string;
  tag?: string;
  coordinates?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  [key: string]: unknown;
}

export interface IAIContextManager {
  // Create a new context with given ID
  createContext(contextId: string): void;
  
  // Set steps for a context as indexed array of step names
  setSteps(contextId: string, steps: string[]): void;
  
  // Log a task for specific context and step
  logTask(contextId: string, stepId: number, task: TaskLogEntry): void;
  
  // Add screenshot description for a specific step
  addScreenshotDescription(contextId: string, stepId: number, screenshotDescription: ScreenshotDescription): void;
  
  // Get all task logs for a specific step
  getStepContext(contextId: string, stepId: number): TaskLogEntry[];
  
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
  stepLogs: Record<number, TaskLogEntry[]>;
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
  interactibleElements?: InteractibleElement[]; // Array of interactive elements from IMAGE_ANALYSIS_SCHEMA
}
