/**
 * TypeScript type definitions for AI Prompt Manager
 */

export interface PromptContent {
  system: string;
  user: string;
}

export interface IAIPromptManager {
  // Initialize context with session and workflow steps
  init(sessionId: string, steps: string[]): void;
  
  // Generate step-specific prompt with full context (backward compatibility)
  getStepPrompt(sessionId: string, stepId: number): string;
  
  // Get system and user messages for specific step
  getStepMessages(sessionId: string, stepId: number): PromptContent;
}

export interface AIPromptManagerConfig {
  maxPromptLength?: number;
  templateVersion?: string;
  cacheEnabled?: boolean;
}

// Confidence Level Enum
export type ConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ContextualHistory {
  previousSteps: Array<{
    stepId: number;
    stepName: string;
    outcome: 'success' | 'failure' | 'in_progress';
    summary: string;
    confidence: ConfidenceLevel;
  }>;
  currentStepAttempts: Array<{
    action: string;
    result: string;
    reasoning: string;
    timestamp: string;
  }>;
}
