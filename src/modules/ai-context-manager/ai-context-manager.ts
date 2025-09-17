/**
 * AI Context Manager Implementation
 * 
 * A simple, minimalistic module responsible for tracking execution history
 * and providing context to other AI processing modules.
 */

import { IAIContextManager, AIContextManagerConfig, ContextData } from './types';

export class AIContextManager implements IAIContextManager {
  private static instance: AIContextManager | null = null;
  private contexts: Map<string, ContextData> = new Map();
  private config: AIContextManagerConfig;

  private constructor(config: AIContextManagerConfig = {}) {
    this.config = {
      maxContexts: 100,
      maxStepsPerContext: 50,
      maxLogsPerStep: 1000,
      ...config
    };
  }

  static getInstance(config?: AIContextManagerConfig): IAIContextManager {
    if (!AIContextManager.instance) {
      AIContextManager.instance = new AIContextManager(config);
    }
    return AIContextManager.instance;
  }

  createContext(contextId: string): void {
    if (this.contexts.has(contextId)) {
      throw new Error(`Context with ID "${contextId}" already exists`);
    }

    const now = new Date();
    const contextData: ContextData = {
      contextId,
      steps: [],
      stepLogs: {},
      createdAt: now,
      lastUpdated: now
    };

    this.contexts.set(contextId, contextData);
  }

  setSteps(contextId: string, steps: string[]): void {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`Context with ID "${contextId}" does not exist`);
    }

    context.steps = [...steps];
    context.stepLogs = {};
    
    // Initialize empty log arrays for each step
    steps.forEach((_, index) => {
      context.stepLogs[index] = [];
    });

    context.lastUpdated = new Date();
  }

  logTask(contextId: string, stepId: number, task: any): void {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`Context with ID "${contextId}" does not exist`);
    }

    if (stepId < 0 || stepId >= context.steps.length) {
      throw new Error(`Step ID ${stepId} does not exist in context "${contextId}"`);
    }

    if (!context.stepLogs[stepId]) {
      context.stepLogs[stepId] = [];
    }

    context.stepLogs[stepId].push(task);
    context.lastUpdated = new Date();
  }

  getStepContext(contextId: string, stepId: number): any[] {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`Context with ID "${contextId}" does not exist`);
    }

    if (stepId < 0 || stepId >= context.steps.length) {
      throw new Error(`Step ID ${stepId} does not exist in context "${contextId}"`);
    }

    return context.stepLogs[stepId] || [];
  }

  getFullContext(contextId: string): ContextData {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`Context with ID "${contextId}" does not exist`);
    }

    // Return a deep copy to prevent external modification
    return {
      contextId: context.contextId,
      steps: [...context.steps],
      stepLogs: { ...context.stepLogs },
      createdAt: context.createdAt,
      lastUpdated: context.lastUpdated
    };
  }
}
