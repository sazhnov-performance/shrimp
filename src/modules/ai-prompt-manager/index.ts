/**
 * AI Prompt Manager Module - Main Export
 * 
 * Generates context-aware prompts for AI web browser agent
 * Supports ACT-REFLECT-ACT execution loop with investigation capabilities
 */

export { AIPromptManagerImpl } from './prompt-manager';
export { PromptTemplateManager } from './template-manager';
export { PromptValidator } from './prompt-validator';
export { PromptContentBuilder } from './content-builder';
export { InvestigationPromptGenerator } from './investigation-generator';
export { ContextIntegrator } from './context-integrator';
export { ConfigurationManager } from './configuration-manager';

// Re-export types
export * from '../../../types/ai-prompt-manager';

// Default configuration
export { createDefaultConfig } from './configuration-manager';

// Factory function for creating AI Prompt Manager instance
export { createAIPromptManager } from './factory';
