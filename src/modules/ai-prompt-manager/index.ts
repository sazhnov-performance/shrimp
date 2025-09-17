/**
 * AI Prompt Manager Module
 * Export point for the AI Prompt Manager module
 */

// Main implementation
export { AIPromptManagerImpl } from './prompt-manager';
export { PromptBuilder } from './prompt-builder';
export { PromptCache } from './prompt-cache';
export { PromptValidator } from './prompt-validator';
export { TemplateManager } from './template-manager';

// Alias for compatibility with tests
export { AIPromptManagerImpl as AIPromptManager } from './prompt-manager';

// Templates
export * from './templates';

// Types and interfaces
export * from './types';

// Factory function
export function createAIPromptManager(
  config?: any,
  contextManager?: any,
  schemaManager?: any
): any {
  const finalConfig = config || createDefaultConfig();
  return new AIPromptManagerImpl(finalConfig, contextManager, schemaManager);
}

// Re-export from types for convenience
import { 
  createDefaultConfig as _createDefaultConfig,
  createMinimalConfig as _createMinimalConfig,
  createPerformanceConfig as _createPerformanceConfig,
  QUALITY_THRESHOLDS as _QUALITY_THRESHOLDS,
  INVESTIGATION_CONSTANTS as _INVESTIGATION_CONSTANTS,
  TEMPLATE_IDS as _TEMPLATE_IDS,
  DEFAULT_TOOL_PRIORITY as _DEFAULT_TOOL_PRIORITY,
  defaultInvestigationConfig as _defaultInvestigationConfig,
  InvestigationPhase as _InvestigationPhase,
  InvestigationTool as _InvestigationTool
} from './types';

export const createDefaultConfig = _createDefaultConfig;
export const createMinimalConfig = _createMinimalConfig;
export const createPerformanceConfig = _createPerformanceConfig;
export const QUALITY_THRESHOLDS = _QUALITY_THRESHOLDS;
export const INVESTIGATION_CONSTANTS = _INVESTIGATION_CONSTANTS;
export const TEMPLATE_IDS = _TEMPLATE_IDS;
export const DEFAULT_TOOL_PRIORITY = _DEFAULT_TOOL_PRIORITY;
export const defaultInvestigationConfig = _defaultInvestigationConfig;
export const InvestigationPhase = _InvestigationPhase;
export const InvestigationTool = _InvestigationTool;

// Default export
export { AIPromptManagerImpl as default } from './prompt-manager';
