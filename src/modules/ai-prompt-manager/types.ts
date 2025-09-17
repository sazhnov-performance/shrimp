/**
 * TypeScript type definitions for AI Prompt Manager
 */

export interface IAIPromptManager {
  // Initialize context with session and workflow steps
  init(sessionId: string, steps: string[]): void;
  
  // Generate step-specific prompt with full context
  getStepPrompt(sessionId: string, stepId: number): string;
}

export interface AIPromptManagerConfig {
  maxPromptLength?: number;
  templateVersion?: string;
  cacheEnabled?: boolean;
}

export interface ContextualHistory {
  previousSteps: Array<{
    stepId: number;
    stepName: string;
    outcome: 'success' | 'failure' | 'in_progress';
    summary: string;
    confidence: number;
  }>;
  currentStepAttempts: Array<{
    action: string;
    result: string;
    reasoning: string;
    timestamp: string;
  }>;
}
