/**
 * Configuration Manager Tests
 * 
 * Unit tests for the Configuration Manager
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { ConfigurationManager, createDefaultConfig } from '../configuration-manager';
import {
  AIPromptManagerConfig,
  InvestigationTool,
  InvestigationPhase
} from '../../../../types/ai-prompt-manager';

describe('ConfigurationManager', () => {
  let configManager: ConfigurationManager;

  beforeEach(() => {
    configManager = new ConfigurationManager();
  });

  describe('initialization', () => {
    test('should create default configuration', () => {
      const config = configManager.getConfig();
      
      expect(config.moduleId).toBe('ai-prompt-manager');
      expect(config.version).toBe('1.0.0');
      expect(config.enabled).toBe(true);
      expect(config.defaultPromptOptions).toBeDefined();
      expect(config.templateConfig).toBeDefined();
      expect(config.contextConfig).toBeDefined();
      expect(config.validationConfig).toBeDefined();
      expect(config.investigationConfig).toBeDefined();
    });

    test('should merge with provided configuration', () => {
      const customConfig = {
        enabled: false,
        defaultPromptOptions: {
          maxHistorySteps: 20
        }
      };

      const configManager = new ConfigurationManager(customConfig);
      const config = configManager.getConfig();
      
      expect(config.enabled).toBe(false);
      expect(config.defaultPromptOptions.maxHistorySteps).toBe(20);
      expect(config.moduleId).toBe('ai-prompt-manager'); // Should still have defaults
    });
  });

  describe('configuration updates', () => {
    test('should update configuration', () => {
      const updates = {
        enabled: false,
        templateConfig: {
          enableCustomTemplates: false,
          templateCacheEnabled: false,
          templateValidationEnabled: false,
          fallbackToDefault: false
        }
      } as Partial<AIPromptManagerConfig>;

      configManager.updateConfig(updates);
      const config = configManager.getConfig();
      
      expect(config.enabled).toBe(false);
      expect(config.templateConfig.enableCustomTemplates).toBe(false);
    });

    test('should update default prompt options', () => {
      configManager.updateDefaultPromptOptions({
        maxHistorySteps: 15,
        validationMode: 'strict'
      });

      const options = configManager.getDefaultPromptOptions();
      expect(options.maxHistorySteps).toBe(15);
      expect(options.validationMode).toBe('strict');
    });

    test('should enable/disable investigation features', () => {
      configManager.setInvestigationEnabled(false);
      
      const investigationConfig = configManager.getInvestigationConfig();
      expect(investigationConfig.enableInvestigationPrompts).toBe(false);
      
      configManager.setInvestigationEnabled(true);
      const updatedConfig = configManager.getInvestigationConfig();
      expect(updatedConfig.enableInvestigationPrompts).toBe(true);
    });

    test('should update investigation tool settings', () => {
      const newSettings = {
        enabled: false,
        timeoutMs: 5000,
        maxRetries: 1,
        qualityThreshold: 0.9
      };

      configManager.updateInvestigationToolSettings(
        InvestigationTool.SCREENSHOT_ANALYSIS,
        newSettings
      );

      const investigationConfig = configManager.getInvestigationConfig();
      const toolSettings = investigationConfig.toolSpecificSettings[InvestigationTool.SCREENSHOT_ANALYSIS];
      
      expect(toolSettings.enabled).toBe(false);
      expect(toolSettings.timeoutMs).toBe(5000);
      expect(toolSettings.maxRetries).toBe(1);
      expect(toolSettings.qualityThreshold).toBe(0.9);
    });
  });

  describe('configuration validation', () => {
    test('should validate template configuration', () => {
      expect(() => {
        new ConfigurationManager({
          templateConfig: {
            enableCustomTemplates: 'invalid' as any,
            templateCacheEnabled: true,
            templateValidationEnabled: true,
            fallbackToDefault: true
          }
        });
      }).toThrow('templateConfig.enableCustomTemplates must be a boolean');
    });

    test('should validate context configuration', () => {
      expect(() => {
        new ConfigurationManager({
          contextConfig: {
            maxDomSize: -1,
            maxHistoryItems: 10,
            includeTimestamps: true,
            compressLargeDom: true,
            highlightRelevantElements: true,
            enableFilteredContext: true,
            defaultFilteringLevel: 'standard',
            maxFilteredContextSize: 30000,
            includeWorkingMemoryByDefault: true,
            workingMemoryDetailLevel: 'detailed',
            elementKnowledgeThreshold: 0.7,
            investigationHistoryDepth: 5
          }
        });
      }).toThrow('contextConfig.maxDomSize must be a non-negative number');
    });

    test('should validate investigation configuration', () => {
      expect(() => {
        new ConfigurationManager({
          investigationConfig: {
            enableInvestigationPrompts: true,
            defaultInvestigationPhase: 'invalid' as any,
            maxInvestigationRoundsPerStep: 5,
            investigationTimeoutMs: 120000,
            enabledInvestigationTools: [InvestigationTool.SCREENSHOT_ANALYSIS],
            toolPriorityOrder: [InvestigationTool.SCREENSHOT_ANALYSIS],
            toolSpecificSettings: {} as any,
            enableProgressiveContextBuilding: true,
            contextOverflowPreventionEnabled: true,
            workingMemoryIntegrationEnabled: true,
            elementKnowledgeTrackingEnabled: true,
            enableInvestigationLearning: true,
            patternRecognitionEnabled: true,
            adaptiveStrategyEnabled: true,
            investigationMetricsEnabled: true,
            minimumConfidenceThreshold: 0.7,
            investigationQualityChecks: true,
            fallbackStrategyEnabled: true,
            investigationValidationEnabled: true
          }
        });
      }).toThrow('investigationConfig.defaultInvestigationPhase must be a valid InvestigationPhase');
    });

    test('should validate prompt options', () => {
      expect(() => {
        new ConfigurationManager({
          defaultPromptOptions: {
            maxHistorySteps: -1
          }
        });
      }).toThrow('defaultPromptOptions.maxHistorySteps must be a non-negative number');
    });

    test('should validate confidence thresholds', () => {
      expect(() => {
        new ConfigurationManager({
          investigationConfig: {
            enableInvestigationPrompts: true,
            defaultInvestigationPhase: InvestigationPhase.INITIAL_ASSESSMENT,
            maxInvestigationRoundsPerStep: 5,
            investigationTimeoutMs: 120000,
            enabledInvestigationTools: [InvestigationTool.SCREENSHOT_ANALYSIS],
            toolPriorityOrder: [InvestigationTool.SCREENSHOT_ANALYSIS],
            toolSpecificSettings: {
              [InvestigationTool.SCREENSHOT_ANALYSIS]: {
                enabled: true,
                timeoutMs: 30000,
                maxRetries: 2,
                qualityThreshold: 0.7
              },
              [InvestigationTool.TEXT_EXTRACTION]: {
                enabled: true,
                timeoutMs: 10000,
                maxRetries: 3,
                qualityThreshold: 0.8
              },
              [InvestigationTool.SUB_DOM_EXTRACTION]: {
                enabled: true,
                timeoutMs: 20000,
                maxRetries: 2,
                qualityThreshold: 0.75
              },
              [InvestigationTool.FULL_DOM_RETRIEVAL]: {
                enabled: true,
                timeoutMs: 30000,
                maxRetries: 1,
                qualityThreshold: 0.6
              }
            },
            enableProgressiveContextBuilding: true,
            contextOverflowPreventionEnabled: true,
            workingMemoryIntegrationEnabled: true,
            elementKnowledgeTrackingEnabled: true,
            enableInvestigationLearning: true,
            patternRecognitionEnabled: true,
            adaptiveStrategyEnabled: true,
            investigationMetricsEnabled: true,
            minimumConfidenceThreshold: 1.5, // Invalid value
            investigationQualityChecks: true,
            fallbackStrategyEnabled: true,
            investigationValidationEnabled: true
          }
        });
      }).toThrow('investigationConfig.minimumConfidenceThreshold must be a number between 0 and 1');
    });

    test('should validate investigation tools', () => {
      expect(() => {
        new ConfigurationManager({
          investigationConfig: {
            enableInvestigationPrompts: true,
            defaultInvestigationPhase: InvestigationPhase.INITIAL_ASSESSMENT,
            maxInvestigationRoundsPerStep: 5,
            investigationTimeoutMs: 120000,
            enabledInvestigationTools: ['invalid_tool' as any], // Invalid tool
            toolPriorityOrder: [InvestigationTool.SCREENSHOT_ANALYSIS],
            toolSpecificSettings: {
              [InvestigationTool.SCREENSHOT_ANALYSIS]: {
                enabled: true,
                timeoutMs: 30000,
                maxRetries: 2,
                qualityThreshold: 0.7
              },
              [InvestigationTool.TEXT_EXTRACTION]: {
                enabled: true,
                timeoutMs: 10000,
                maxRetries: 3,
                qualityThreshold: 0.8
              },
              [InvestigationTool.SUB_DOM_EXTRACTION]: {
                enabled: true,
                timeoutMs: 20000,
                maxRetries: 2,
                qualityThreshold: 0.75
              },
              [InvestigationTool.FULL_DOM_RETRIEVAL]: {
                enabled: true,
                timeoutMs: 30000,
                maxRetries: 1,
                qualityThreshold: 0.6
              }
            },
            enableProgressiveContextBuilding: true,
            contextOverflowPreventionEnabled: true,
            workingMemoryIntegrationEnabled: true,
            elementKnowledgeTrackingEnabled: true,
            enableInvestigationLearning: true,
            patternRecognitionEnabled: true,
            adaptiveStrategyEnabled: true,
            investigationMetricsEnabled: true,
            minimumConfidenceThreshold: 0.7,
            investigationQualityChecks: true,
            fallbackStrategyEnabled: true,
            investigationValidationEnabled: true
          }
        });
      }).toThrow('investigationConfig.enabledInvestigationTools contains invalid tool');
    });
  });

  describe('configuration import/export', () => {
    test('should export configuration as JSON', () => {
      const configJson = configManager.exportConfig();
      const parsed = JSON.parse(configJson);
      
      expect(parsed.moduleId).toBe('ai-prompt-manager');
      expect(parsed.version).toBe('1.0.0');
    });

    test('should import configuration from JSON', () => {
      const originalConfig = configManager.getConfig();
      originalConfig.enabled = false;
      originalConfig.defaultPromptOptions.maxHistorySteps = 25;
      
      const configJson = JSON.stringify(originalConfig);
      configManager.importConfig(configJson);
      
      const newConfig = configManager.getConfig();
      expect(newConfig.enabled).toBe(false);
      expect(newConfig.defaultPromptOptions.maxHistorySteps).toBe(25);
    });

    test('should handle invalid JSON during import', () => {
      expect(() => {
        configManager.importConfig('invalid json');
      }).toThrow('Failed to import configuration');
    });
  });

  describe('configuration summary', () => {
    test('should provide configuration summary', () => {
      const summary = configManager.getConfigSummary();
      
      expect(summary.moduleEnabled).toBe(true);
      expect(summary.investigationEnabled).toBe(true);
      expect(summary.filteredContextEnabled).toBe(true);
      expect(summary.workingMemoryEnabled).toBe(true);
      expect(summary.templateCacheEnabled).toBe(true);
      expect(summary.validationEnabled).toBe(true);
      expect(Array.isArray(summary.enabledInvestigationTools)).toBe(true);
      expect(typeof summary.maxDomSize).toBe('number');
      expect(typeof summary.maxHistoryItems).toBe('number');
    });
  });

  describe('reset functionality', () => {
    test('should reset to default configuration', () => {
      // Modify configuration
      configManager.updateConfig({
        enabled: false,
        defaultPromptOptions: { maxHistorySteps: 25 }
      } as any);
      
      // Reset to defaults
      configManager.resetToDefaults();
      
      const config = configManager.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.defaultPromptOptions.maxHistorySteps).toBe(10); // Default value
    });
  });

  describe('getters for specific configurations', () => {
    test('should get template configuration', () => {
      const templateConfig = configManager.getTemplateConfig();
      expect(templateConfig.enableCustomTemplates).toBe(true);
      expect(templateConfig.templateCacheEnabled).toBe(true);
    });

    test('should get context configuration', () => {
      const contextConfig = configManager.getContextConfig();
      expect(contextConfig.enableFilteredContext).toBe(true);
      expect(contextConfig.maxDomSize).toBe(100000);
    });

    test('should get validation configuration', () => {
      const validationConfig = configManager.getValidationConfig();
      expect(validationConfig.enableActionValidation).toBe(true);
      expect(validationConfig.enableResultAnalysis).toBe(true);
    });

    test('should get investigation configuration', () => {
      const investigationConfig = configManager.getInvestigationConfig();
      expect(investigationConfig.enableInvestigationPrompts).toBe(true);
      expect(investigationConfig.defaultInvestigationPhase).toBe(InvestigationPhase.INITIAL_ASSESSMENT);
    });
  });
});

describe('createDefaultConfig', () => {
  test('should create valid default configuration', () => {
    const config = createDefaultConfig();
    
    expect(config.moduleId).toBe('ai-prompt-manager');
    expect(config.enabled).toBe(true);
    expect(config.defaultPromptOptions).toBeDefined();
    expect(config.templateConfig).toBeDefined();
    expect(config.contextConfig).toBeDefined();
    expect(config.validationConfig).toBeDefined();
    expect(config.investigationConfig).toBeDefined();
  });
});
