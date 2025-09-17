/**
 * AI Prompt Manager Factory
 * 
 * Factory function for creating AI Prompt Manager instances
 * Handles dependency injection and configuration
 */

import {
  AIPromptManagerConfig,
  ContextManagerIntegration,
  SchemaManagerIntegration
} from '../../../types/ai-prompt-manager';

import { AIPromptManagerImpl } from './prompt-manager';
import { PromptTemplateManager } from './template-manager';
import { PromptValidator } from './prompt-validator';
import { PromptContentBuilder } from './content-builder';
import { InvestigationPromptGenerator } from './investigation-generator';
import { ContextIntegrator } from './context-integrator';
import { ConfigurationManager, createDefaultConfig } from './configuration-manager';

export interface AIPromptManagerDependencies {
  contextManager?: ContextManagerIntegration;
  schemaManager?: SchemaManagerIntegration;
  templateManager?: PromptTemplateManager;
  validator?: PromptValidator;
  contentBuilder?: PromptContentBuilder;
  investigationGenerator?: InvestigationPromptGenerator;
  contextIntegrator?: ContextIntegrator;
}

/**
 * Create AI Prompt Manager instance with dependencies
 */
export function createAIPromptManager(
  config?: Partial<AIPromptManagerConfig>,
  dependencies?: AIPromptManagerDependencies
): AIPromptManagerImpl {
  // Create or use provided configuration
  const configManager = new ConfigurationManager(config);
  const fullConfig = configManager.getConfig();

  // Create core dependencies
  const templateManager = dependencies?.templateManager || 
    new PromptTemplateManager(fullConfig.templateConfig);

  const validator = dependencies?.validator || 
    new PromptValidator(fullConfig.validationConfig);

  const contentBuilder = dependencies?.contentBuilder || 
    new PromptContentBuilder(fullConfig.contextConfig);

  const contextIntegrator = dependencies?.contextIntegrator || 
    new ContextIntegrator(fullConfig.contextConfig, dependencies?.contextManager);

  const investigationGenerator = dependencies?.investigationGenerator || 
    new InvestigationPromptGenerator(fullConfig.investigationConfig);

  // Set up dependency injection for investigation generator
  investigationGenerator.setDependencies(templateManager, contentBuilder, contextIntegrator);

  // Create and return AI Prompt Manager instance
  return new AIPromptManagerImpl(
    fullConfig,
    templateManager,
    validator,
    contentBuilder,
    investigationGenerator,
    contextIntegrator
  );
}

/**
 * Create AI Prompt Manager with default configuration
 */
export function createDefaultAIPromptManager(): AIPromptManagerImpl {
  return createAIPromptManager(createDefaultConfig());
}

/**
 * Create AI Prompt Manager for testing with minimal dependencies
 */
export function createTestAIPromptManager(
  config?: Partial<AIPromptManagerConfig>
): AIPromptManagerImpl {
  const testConfig = {
    ...createDefaultConfig(),
    ...config,
    // Override for testing
    templateConfig: {
      enableCustomTemplates: false,
      templateCacheEnabled: false,
      templateValidationEnabled: true,
      fallbackToDefault: true
    },
    validationConfig: {
      enableActionValidation: true,
      enableResultAnalysis: true,
      validationTimeoutMs: 1000,
      requireExplicitValidation: false
    }
  };

  return createAIPromptManager(testConfig);
}

/**
 * Create AI Prompt Manager with external integrations
 */
export function createIntegratedAIPromptManager(
  contextManager: ContextManagerIntegration,
  schemaManager?: SchemaManagerIntegration,
  config?: Partial<AIPromptManagerConfig>
): AIPromptManagerImpl {
  return createAIPromptManager(config, {
    contextManager,
    schemaManager
  });
}
