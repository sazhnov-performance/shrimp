/**
 * Configuration Manager
 * 
 * Manages AI Prompt Manager configuration
 * Provides default configurations and validation
 */

import {
  AIPromptManagerConfig,
  TemplateConfig,
  ContextConfig,
  ValidationConfig,
  InvestigationConfig,
  PromptOptions,
  InvestigationPhase,
  InvestigationTool,
  DEFAULT_INVESTIGATION_CONFIG,
  DEFAULT_MAX_DOM_SIZE,
  DEFAULT_MAX_HISTORY_STEPS,
  DEFAULT_CACHE_TTL_MS,
  DEFAULT_MAX_CACHE_SIZE,
  INVESTIGATION_CONSTANTS
} from '../../../types/ai-prompt-manager';

import { LogLevel, DEFAULT_TIMEOUT_CONFIG } from '../../../types/shared-types';

export class ConfigurationManager {
  private config: AIPromptManagerConfig;

  constructor(config?: Partial<AIPromptManagerConfig>) {
    this.config = this.mergeWithDefaults(config || {});
    this.validateConfiguration();
  }

  /**
   * Get current configuration
   */
  getConfig(): AIPromptManagerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<AIPromptManagerConfig>): void {
    this.config = { ...this.config, ...updates };
    this.validateConfiguration();
  }

  /**
   * Get default prompt options
   */
  getDefaultPromptOptions(): PromptOptions {
    return this.config.defaultPromptOptions;
  }

  /**
   * Update default prompt options
   */
  updateDefaultPromptOptions(options: Partial<PromptOptions>): void {
    this.config.defaultPromptOptions = {
      ...this.config.defaultPromptOptions,
      ...options
    };
  }

  /**
   * Get template configuration
   */
  getTemplateConfig(): TemplateConfig {
    return this.config.templateConfig;
  }

  /**
   * Get context configuration
   */
  getContextConfig(): ContextConfig {
    return this.config.contextConfig;
  }

  /**
   * Get validation configuration
   */
  getValidationConfig(): ValidationConfig {
    return this.config.validationConfig;
  }

  /**
   * Get investigation configuration
   */
  getInvestigationConfig(): InvestigationConfig {
    return this.config.investigationConfig;
  }

  /**
   * Enable/disable investigation features
   */
  setInvestigationEnabled(enabled: boolean): void {
    this.config.investigationConfig.enableInvestigationPrompts = enabled;
  }

  /**
   * Update investigation tool settings
   */
  updateInvestigationToolSettings(tool: InvestigationTool, settings: Partial<any>): void {
    this.config.investigationConfig.toolSpecificSettings[tool] = {
      ...this.config.investigationConfig.toolSpecificSettings[tool],
      ...settings
    };
  }

  /**
   * Merge configuration with defaults
   */
  private mergeWithDefaults(config: Partial<AIPromptManagerConfig>): AIPromptManagerConfig {
    return {
      moduleId: 'ai-prompt-manager',
      version: '1.0.0',
      enabled: config.enabled ?? true,
      logging: config.logging ?? this.createDefaultLoggingConfig(),
      performance: config.performance ?? this.createDefaultPerformanceConfig(),
      timeouts: config.timeouts ?? DEFAULT_TIMEOUT_CONFIG,
      defaultPromptOptions: config.defaultPromptOptions ?? this.createDefaultPromptOptions(),
      templateConfig: config.templateConfig ?? this.createDefaultTemplateConfig(),
      contextConfig: config.contextConfig ?? this.createDefaultContextConfig(),
      validationConfig: config.validationConfig ?? this.createDefaultValidationConfig(),
      investigationConfig: config.investigationConfig ?? DEFAULT_INVESTIGATION_CONFIG
    };
  }

  /**
   * Create default logging configuration
   */
  private createDefaultLoggingConfig() {
    return {
      level: LogLevel.INFO,
      prefix: '[AIPromptManager]',
      includeTimestamp: true,
      includeSessionId: true,
      includeModuleId: true,
      structured: true
    };
  }

  /**
   * Create default performance configuration
   */
  private createDefaultPerformanceConfig() {
    return {
      maxConcurrentOperations: 5,
      cacheEnabled: true,
      cacheTTLMs: DEFAULT_CACHE_TTL_MS,
      metricsEnabled: true
    };
  }

  /**
   * Create default prompt options
   */
  private createDefaultPromptOptions(): PromptOptions {
    return {
      // Traditional options
      includeExecutionHistory: true,
      maxHistorySteps: DEFAULT_MAX_HISTORY_STEPS,
      includeDomComparison: true,
      includeElementContext: true,
      validationMode: 'lenient',
      reasoningDepth: 'detailed',
      includeExamples: false,
      customInstructions: undefined,

      // Investigation-specific options
      useFilteredContext: true,
      includeWorkingMemory: true,
      includeInvestigationHistory: true,
      includeElementKnowledge: true,
      contextManagementApproach: 'standard',
      investigationGuidanceLevel: 'detailed',
      enableProgressiveContext: true,
      maxInvestigationRounds: INVESTIGATION_CONSTANTS.DEFAULT_MAX_INVESTIGATION_ROUNDS,
      confidenceThreshold: INVESTIGATION_CONSTANTS.DEFAULT_CONFIDENCE_THRESHOLD,
      preferredInvestigationTools: [
        InvestigationTool.SCREENSHOT_ANALYSIS,
        InvestigationTool.TEXT_EXTRACTION,
        InvestigationTool.SUB_DOM_EXTRACTION
      ]
    };
  }

  /**
   * Create default template configuration
   */
  private createDefaultTemplateConfig(): TemplateConfig {
    return {
      enableCustomTemplates: true,
      templateCacheEnabled: true,
      templateValidationEnabled: true,
      fallbackToDefault: true
    };
  }

  /**
   * Create default context configuration
   */
  private createDefaultContextConfig(): ContextConfig {
    return {
      // Traditional context configuration
      maxDomSize: DEFAULT_MAX_DOM_SIZE,
      maxHistoryItems: DEFAULT_MAX_HISTORY_STEPS,
      includeTimestamps: true,
      compressLargeDom: true,
      highlightRelevantElements: true,

      // Investigation context configuration
      enableFilteredContext: true,
      defaultFilteringLevel: 'standard',
      maxFilteredContextSize: INVESTIGATION_CONSTANTS.DEFAULT_CONTEXT_SIZE_LIMIT,
      includeWorkingMemoryByDefault: true,
      workingMemoryDetailLevel: 'detailed',
      elementKnowledgeThreshold: INVESTIGATION_CONSTANTS.DEFAULT_CONFIDENCE_THRESHOLD,
      investigationHistoryDepth: 5
    };
  }

  /**
   * Create default validation configuration
   */
  private createDefaultValidationConfig(): ValidationConfig {
    return {
      enableActionValidation: true,
      enableResultAnalysis: true,
      validationTimeoutMs: 5000,
      requireExplicitValidation: false
    };
  }

  /**
   * Validate configuration
   */
  private validateConfiguration(): void {
    this.validateTemplateConfig();
    this.validateContextConfig();
    this.validateValidationConfig();
    this.validateInvestigationConfig();
    this.validatePromptOptions();
  }

  /**
   * Validate template configuration
   */
  private validateTemplateConfig(): void {
    const config = this.config.templateConfig;
    
    if (typeof config.enableCustomTemplates !== 'boolean') {
      throw new Error('templateConfig.enableCustomTemplates must be a boolean');
    }

    if (typeof config.templateCacheEnabled !== 'boolean') {
      throw new Error('templateConfig.templateCacheEnabled must be a boolean');
    }

    if (typeof config.templateValidationEnabled !== 'boolean') {
      throw new Error('templateConfig.templateValidationEnabled must be a boolean');
    }

    if (typeof config.fallbackToDefault !== 'boolean') {
      throw new Error('templateConfig.fallbackToDefault must be a boolean');
    }
  }

  /**
   * Validate context configuration
   */
  private validateContextConfig(): void {
    const config = this.config.contextConfig;

    if (typeof config.maxDomSize !== 'number' || config.maxDomSize < 0) {
      throw new Error('contextConfig.maxDomSize must be a non-negative number');
    }

    if (typeof config.maxHistoryItems !== 'number' || config.maxHistoryItems < 0) {
      throw new Error('contextConfig.maxHistoryItems must be a non-negative number');
    }

    if (typeof config.maxFilteredContextSize !== 'number' || config.maxFilteredContextSize < 0) {
      throw new Error('contextConfig.maxFilteredContextSize must be a non-negative number');
    }

    if (typeof config.elementKnowledgeThreshold !== 'number' || 
        config.elementKnowledgeThreshold < 0 || 
        config.elementKnowledgeThreshold > 1) {
      throw new Error('contextConfig.elementKnowledgeThreshold must be a number between 0 and 1');
    }

    const validFilteringLevels = ['minimal', 'standard', 'detailed'];
    if (!validFilteringLevels.includes(config.defaultFilteringLevel)) {
      throw new Error(`contextConfig.defaultFilteringLevel must be one of: ${validFilteringLevels.join(', ')}`);
    }

    const validDetailLevels = ['summary', 'detailed', 'comprehensive'];
    if (!validDetailLevels.includes(config.workingMemoryDetailLevel)) {
      throw new Error(`contextConfig.workingMemoryDetailLevel must be one of: ${validDetailLevels.join(', ')}`);
    }
  }

  /**
   * Validate validation configuration
   */
  private validateValidationConfig(): void {
    const config = this.config.validationConfig;

    if (typeof config.enableActionValidation !== 'boolean') {
      throw new Error('validationConfig.enableActionValidation must be a boolean');
    }

    if (typeof config.enableResultAnalysis !== 'boolean') {
      throw new Error('validationConfig.enableResultAnalysis must be a boolean');
    }

    if (typeof config.validationTimeoutMs !== 'number' || config.validationTimeoutMs < 0) {
      throw new Error('validationConfig.validationTimeoutMs must be a non-negative number');
    }

    if (typeof config.requireExplicitValidation !== 'boolean') {
      throw new Error('validationConfig.requireExplicitValidation must be a boolean');
    }
  }

  /**
   * Validate investigation configuration
   */
  private validateInvestigationConfig(): void {
    const config = this.config.investigationConfig;

    if (typeof config.enableInvestigationPrompts !== 'boolean') {
      throw new Error('investigationConfig.enableInvestigationPrompts must be a boolean');
    }

    if (!Object.values(InvestigationPhase).includes(config.defaultInvestigationPhase)) {
      throw new Error('investigationConfig.defaultInvestigationPhase must be a valid InvestigationPhase');
    }

    if (typeof config.maxInvestigationRoundsPerStep !== 'number' || config.maxInvestigationRoundsPerStep < 1) {
      throw new Error('investigationConfig.maxInvestigationRoundsPerStep must be a positive number');
    }

    if (typeof config.investigationTimeoutMs !== 'number' || config.investigationTimeoutMs < 0) {
      throw new Error('investigationConfig.investigationTimeoutMs must be a non-negative number');
    }

    // Validate enabled tools
    for (const tool of config.enabledInvestigationTools) {
      if (!Object.values(InvestigationTool).includes(tool)) {
        throw new Error(`investigationConfig.enabledInvestigationTools contains invalid tool: ${tool}`);
      }
    }

    // Validate tool priority order
    for (const tool of config.toolPriorityOrder) {
      if (!Object.values(InvestigationTool).includes(tool)) {
        throw new Error(`investigationConfig.toolPriorityOrder contains invalid tool: ${tool}`);
      }
    }

    // Validate confidence threshold
    if (typeof config.minimumConfidenceThreshold !== 'number' || 
        config.minimumConfidenceThreshold < 0 || 
        config.minimumConfidenceThreshold > 1) {
      throw new Error('investigationConfig.minimumConfidenceThreshold must be a number between 0 and 1');
    }

    // Validate tool-specific settings
    for (const [toolName, settings] of Object.entries(config.toolSpecificSettings)) {
      if (!Object.values(InvestigationTool).includes(toolName as InvestigationTool)) {
        throw new Error(`investigationConfig.toolSpecificSettings contains invalid tool: ${toolName}`);
      }

      if (typeof settings.enabled !== 'boolean') {
        throw new Error(`Tool settings for ${toolName}: enabled must be a boolean`);
      }

      if (typeof settings.timeoutMs !== 'number' || settings.timeoutMs < 0) {
        throw new Error(`Tool settings for ${toolName}: timeoutMs must be a non-negative number`);
      }

      if (typeof settings.maxRetries !== 'number' || settings.maxRetries < 0) {
        throw new Error(`Tool settings for ${toolName}: maxRetries must be a non-negative number`);
      }

      if (typeof settings.qualityThreshold !== 'number' || 
          settings.qualityThreshold < 0 || 
          settings.qualityThreshold > 1) {
        throw new Error(`Tool settings for ${toolName}: qualityThreshold must be a number between 0 and 1`);
      }
    }
  }

  /**
   * Validate prompt options
   */
  private validatePromptOptions(): void {
    const options = this.config.defaultPromptOptions;

    if (options.maxHistorySteps !== undefined && 
        (typeof options.maxHistorySteps !== 'number' || options.maxHistorySteps < 0)) {
      throw new Error('defaultPromptOptions.maxHistorySteps must be a non-negative number');
    }

    if (options.validationMode !== undefined && 
        !['strict', 'lenient'].includes(options.validationMode)) {
      throw new Error('defaultPromptOptions.validationMode must be either "strict" or "lenient"');
    }

    if (options.reasoningDepth !== undefined && 
        !['basic', 'detailed', 'comprehensive'].includes(options.reasoningDepth)) {
      throw new Error('defaultPromptOptions.reasoningDepth must be "basic", "detailed", or "comprehensive"');
    }

    if (options.contextManagementApproach !== undefined && 
        !['minimal', 'standard', 'comprehensive'].includes(options.contextManagementApproach)) {
      throw new Error('defaultPromptOptions.contextManagementApproach must be "minimal", "standard", or "comprehensive"');
    }

    if (options.investigationGuidanceLevel !== undefined && 
        !['basic', 'detailed', 'expert'].includes(options.investigationGuidanceLevel)) {
      throw new Error('defaultPromptOptions.investigationGuidanceLevel must be "basic", "detailed", or "expert"');
    }

    if (options.maxInvestigationRounds !== undefined && 
        (typeof options.maxInvestigationRounds !== 'number' || options.maxInvestigationRounds < 1)) {
      throw new Error('defaultPromptOptions.maxInvestigationRounds must be a positive number');
    }

    if (options.confidenceThreshold !== undefined && 
        (typeof options.confidenceThreshold !== 'number' || 
         options.confidenceThreshold < 0 || 
         options.confidenceThreshold > 1)) {
      throw new Error('defaultPromptOptions.confidenceThreshold must be a number between 0 and 1');
    }

    if (options.preferredInvestigationTools !== undefined) {
      for (const tool of options.preferredInvestigationTools) {
        if (!Object.values(InvestigationTool).includes(tool)) {
          throw new Error(`defaultPromptOptions.preferredInvestigationTools contains invalid tool: ${tool}`);
        }
      }
    }
  }

  /**
   * Reset to default configuration
   */
  resetToDefaults(): void {
    this.config = this.mergeWithDefaults({});
  }

  /**
   * Export configuration as JSON
   */
  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import configuration from JSON
   */
  importConfig(configJson: string): void {
    try {
      const importedConfig = JSON.parse(configJson);
      this.config = this.mergeWithDefaults(importedConfig);
      this.validateConfiguration();
    } catch (error) {
      throw new Error(`Failed to import configuration: ${error.message}`);
    }
  }

  /**
   * Get configuration summary
   */
  getConfigSummary(): {
    moduleEnabled: boolean;
    investigationEnabled: boolean;
    filteredContextEnabled: boolean;
    workingMemoryEnabled: boolean;
    templateCacheEnabled: boolean;
    validationEnabled: boolean;
    enabledInvestigationTools: InvestigationTool[];
    maxDomSize: number;
    maxHistoryItems: number;
  } {
    return {
      moduleEnabled: this.config.enabled,
      investigationEnabled: this.config.investigationConfig.enableInvestigationPrompts,
      filteredContextEnabled: this.config.contextConfig.enableFilteredContext,
      workingMemoryEnabled: this.config.investigationConfig.workingMemoryIntegrationEnabled,
      templateCacheEnabled: this.config.templateConfig.templateCacheEnabled,
      validationEnabled: this.config.validationConfig.enableActionValidation,
      enabledInvestigationTools: this.config.investigationConfig.enabledInvestigationTools,
      maxDomSize: this.config.contextConfig.maxDomSize,
      maxHistoryItems: this.config.contextConfig.maxHistoryItems
    };
  }
}

/**
 * Create default AI Prompt Manager configuration
 */
export function createDefaultConfig(): AIPromptManagerConfig {
  const configManager = new ConfigurationManager();
  return configManager.getConfig();
}

/**
 * Create configuration with overrides
 */
export function createConfigWithOverrides(overrides: Partial<AIPromptManagerConfig>): AIPromptManagerConfig {
  const configManager = new ConfigurationManager(overrides);
  return configManager.getConfig();
}
