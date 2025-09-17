/**
 * AI Prompt Manager Module Index Tests
 * Tests for module exports and factory functions
 */

import { 
  createAIPromptManager, 
  createDefaultConfig, 
  createMinimalConfig,
  createPerformanceConfig,
  AIPromptManager,
  PromptBuilder,
  TemplateManager,
  PromptValidator,
  PromptCache,
  INVESTIGATION_CONSTANTS,
  TEMPLATE_IDS,
  QUALITY_THRESHOLDS,
  DEFAULT_TOOL_PRIORITY,
  InvestigationPhase,
  InvestigationTool,
  defaultInvestigationConfig
} from '../../../src/modules/ai-prompt-manager';

describe('AI Prompt Manager Module Exports', () => {
  describe('class exports', () => {
    it('should export all main classes', () => {
      expect(AIPromptManager).toBeDefined();
      expect(PromptBuilder).toBeDefined();
      expect(TemplateManager).toBeDefined();
      expect(PromptValidator).toBeDefined();
      expect(PromptCache).toBeDefined();
    });

    it('should allow instantiation of exported classes', () => {
      const templateConfig = {
        enableCustomTemplates: true,
        templateCacheEnabled: false,
        templateValidationEnabled: false,
        fallbackToDefault: true
      };

      const validationConfig = {
        enableActionValidation: true,
        enableResultAnalysis: true,
        validationTimeoutMs: 30000,
        requireExplicitValidation: false
      };

      const performanceConfig = {
        maxConcurrentOperations: 5,
        cacheEnabled: false,
        cacheTTLMs: 60000,
        metricsEnabled: true
      };

      expect(() => new TemplateManager(templateConfig)).not.toThrow();
      expect(() => new PromptValidator(validationConfig)).not.toThrow();
      expect(() => new PromptCache(performanceConfig)).not.toThrow();
    });
  });

  describe('constants exports', () => {
    it('should export investigation constants', () => {
      expect(INVESTIGATION_CONSTANTS).toBeDefined();
      expect(INVESTIGATION_CONSTANTS.DEFAULT_MAX_INVESTIGATION_ROUNDS).toBe(5);
      expect(INVESTIGATION_CONSTANTS.DEFAULT_CONFIDENCE_THRESHOLD).toBe(0.7);
      expect(INVESTIGATION_CONSTANTS.DEFAULT_CONTEXT_SIZE_LIMIT).toBe(30000);
    });

    it('should export template IDs', () => {
      expect(TEMPLATE_IDS).toBeDefined();
      expect(TEMPLATE_IDS.SYSTEM_MESSAGE).toBe('system_message');
      expect(TEMPLATE_IDS.INITIAL_ACTION).toBe('initial_action');
      expect(TEMPLATE_IDS.INVESTIGATION_INITIAL).toBe('investigation_initial');
    });

    it('should export quality thresholds', () => {
      expect(QUALITY_THRESHOLDS).toBeDefined();
      expect(QUALITY_THRESHOLDS.MIN_CLARITY_SCORE).toBe(0.7);
      expect(QUALITY_THRESHOLDS.MIN_COMPLETENESS_SCORE).toBe(0.8);
      expect(QUALITY_THRESHOLDS.MIN_OVERALL_SCORE).toBe(0.75);
    });

    it('should export default tool priority', () => {
      expect(DEFAULT_TOOL_PRIORITY).toBeDefined();
      expect(DEFAULT_TOOL_PRIORITY).toContain(InvestigationTool.SCREENSHOT_ANALYSIS);
      expect(DEFAULT_TOOL_PRIORITY).toContain(InvestigationTool.TEXT_EXTRACTION);
    });

    it('should export investigation enums', () => {
      expect(InvestigationPhase).toBeDefined();
      expect(InvestigationPhase.INITIAL_ASSESSMENT).toBe('INITIAL_ASSESSMENT');
      expect(InvestigationPhase.FOCUSED_EXPLORATION).toBe('FOCUSED_EXPLORATION');
      expect(InvestigationPhase.SELECTOR_DETERMINATION).toBe('SELECTOR_DETERMINATION');

      expect(InvestigationTool).toBeDefined();
      expect(InvestigationTool.SCREENSHOT_ANALYSIS).toBe('SCREENSHOT_ANALYSIS');
      expect(InvestigationTool.TEXT_EXTRACTION).toBe('TEXT_EXTRACTION');
      expect(InvestigationTool.SUB_DOM_EXTRACTION).toBe('SUB_DOM_EXTRACTION');
      expect(InvestigationTool.FULL_DOM_RETRIEVAL).toBe('FULL_DOM_RETRIEVAL');
    });

    it('should export default investigation config', () => {
      expect(defaultInvestigationConfig).toBeDefined();
      expect(defaultInvestigationConfig.enableInvestigationPrompts).toBe(true);
      expect(defaultInvestigationConfig.defaultInvestigationPhase).toBe(InvestigationPhase.INITIAL_ASSESSMENT);
      expect(defaultInvestigationConfig.maxInvestigationRoundsPerStep).toBe(5);
    });
  });

  describe('configuration factories', () => {
    it('should create default configuration', () => {
      const config = createDefaultConfig();

      expect(config).toBeDefined();
      expect(config.moduleId).toBe('ai-prompt-manager');
      expect(config.version).toBe('1.0.0');
      expect(config.enabled).toBe(true);

      expect(config.defaultPromptOptions).toBeDefined();
      expect(config.templateConfig).toBeDefined();
      expect(config.contextConfig).toBeDefined();
      expect(config.validationConfig).toBeDefined();
      expect(config.investigationConfig).toBeDefined();
      expect(config.logging).toBeDefined();
      expect(config.performance).toBeDefined();
      expect(config.timeouts).toBeDefined();

      // Check investigation-specific defaults
      expect(config.defaultPromptOptions.useFilteredContext).toBe(true);
      expect(config.defaultPromptOptions.includeWorkingMemory).toBe(true);
      expect(config.contextConfig.enableFilteredContext).toBe(true);
      expect(config.investigationConfig.enableInvestigationPrompts).toBe(true);
    });

    it('should create minimal configuration', () => {
      const config = createMinimalConfig();

      expect(config).toBeDefined();
      expect(config.moduleId).toBe('ai-prompt-manager');
      expect(config.defaultPromptOptions?.useFilteredContext).toBe(false);
      expect(config.defaultPromptOptions?.includeWorkingMemory).toBe(false);
      expect(config.defaultPromptOptions?.reasoningDepth).toBe('basic');
      expect(config.contextConfig?.enableFilteredContext).toBe(false);
      expect(config.investigationConfig?.enableInvestigationPrompts).toBe(false);
    });

    it('should create performance-optimized configuration', () => {
      const config = createPerformanceConfig();

      expect(config).toBeDefined();
      expect(config.performance?.cacheEnabled).toBe(true);
      expect(config.performance?.cacheTTLMs).toBe(30 * 60 * 1000); // 30 minutes
      expect(config.defaultPromptOptions?.maxHistorySteps).toBe(3);
      expect(config.defaultPromptOptions?.reasoningDepth).toBe('basic');
      expect(config.defaultPromptOptions?.contextManagementApproach).toBe('minimal');
      expect(config.contextConfig?.maxDomSize).toBe(30000);
    });

    it('should create configurations with proper inheritance', () => {
      const defaultConfig = createDefaultConfig();
      const minimalConfig = createMinimalConfig();
      const performanceConfig = createPerformanceConfig();

      // All configs should have common base properties
      [defaultConfig, minimalConfig, performanceConfig].forEach(config => {
        expect(config.moduleId).toBe('ai-prompt-manager');
        expect(config.version).toBe('1.0.0');
        expect(config.enabled).toBe(true);
      });

      // Minimal should disable investigation features
      expect(minimalConfig.investigationConfig?.enableInvestigationPrompts).toBe(false);
      expect(minimalConfig.defaultPromptOptions?.useFilteredContext).toBe(false);

      // Performance should enable caching
      expect(performanceConfig.performance?.cacheEnabled).toBe(true);
      expect(performanceConfig.defaultPromptOptions?.useFilteredContext).toBe(true);
    });
  });

  describe('factory function', () => {
    it('should create AI Prompt Manager with default config', () => {
      const promptManager = createAIPromptManager();

      expect(promptManager).toBeDefined();
      expect(promptManager.generateActionPrompt).toBeInstanceOf(Function);
      expect(promptManager.generateReflectionPrompt).toBeInstanceOf(Function);
      expect(promptManager.generateInvestigationPrompt).toBeInstanceOf(Function);
      expect(promptManager.generateActionWithInvestigationPrompt).toBeInstanceOf(Function);
      expect(promptManager.getPromptTemplates).toBeInstanceOf(Function);
      expect(promptManager.updatePromptTemplate).toBeInstanceOf(Function);
      expect(promptManager.validatePromptStructure).toBeInstanceOf(Function);
    });

    it('should create AI Prompt Manager with custom config', () => {
      const customConfig = {
        moduleId: 'custom-prompt-manager' as const,
        version: '2.0.0',
        enabled: true,
        defaultPromptOptions: {
          reasoningDepth: 'comprehensive' as const,
          useFilteredContext: false
        }
      };

      const promptManager = createAIPromptManager(customConfig);

      expect(promptManager).toBeDefined();
      // Should merge with default config
      const templates = promptManager.getPromptTemplates();
      expect(templates).toBeDefined();
    });

    it('should create AI Prompt Manager with dependencies', () => {
      const mockContextManager = {
        getExecutionContext: jest.fn(),
        getStepHistory: jest.fn(),
        getCurrentPageState: jest.fn(),
        getPreviousPageState: jest.fn(),
        generateFilteredContext: jest.fn(),
        generateInvestigationContext: jest.fn(),
        getWorkingMemory: jest.fn(),
        getInvestigationHistory: jest.fn(),
        getPageElementsDiscovered: jest.fn(),
        getContextSummaries: jest.fn()
      };

      const mockSchemaManager = {
        getResponseSchema: jest.fn(),
        validateSchemaCompatibility: jest.fn(),
        getSchemaVersion: jest.fn()
      };

      const promptManager = createAIPromptManager(
        undefined, // Use default config
        mockContextManager,
        mockSchemaManager
      );

      expect(promptManager).toBeDefined();
      expect(promptManager.generateActionPrompt).toBeInstanceOf(Function);
    });
  });

  describe('configuration validation', () => {
    it('should create valid default configuration structure', () => {
      const config = createDefaultConfig();

      // Validate required configuration sections
      expect(config.moduleId).toBeTruthy();
      expect(config.version).toBeTruthy();
      expect(typeof config.enabled).toBe('boolean');

      // Validate nested configuration objects
      expect(typeof config.defaultPromptOptions).toBe('object');
      expect(typeof config.templateConfig).toBe('object');
      expect(typeof config.contextConfig).toBe('object');
      expect(typeof config.validationConfig).toBe('object');
      expect(typeof config.investigationConfig).toBe('object');

      // Validate investigation config structure
      expect(Array.isArray(config.investigationConfig.enabledInvestigationTools)).toBe(true);
      expect(Array.isArray(config.investigationConfig.toolPriorityOrder)).toBe(true);
      expect(typeof config.investigationConfig.toolSpecificSettings).toBe('object');

      // Validate tool-specific settings
      const toolSettings = config.investigationConfig.toolSpecificSettings;
      Object.values(InvestigationTool).forEach(tool => {
        expect(toolSettings[tool]).toBeDefined();
        expect(typeof toolSettings[tool].enabled).toBe('boolean');
        expect(typeof toolSettings[tool].timeoutMs).toBe('number');
        expect(typeof toolSettings[tool].maxRetries).toBe('number');
        expect(typeof toolSettings[tool].qualityThreshold).toBe('number');
      });
    });

    it('should have consistent timeout hierarchy', () => {
      const config = createDefaultConfig();
      const timeouts = config.timeouts;

      expect(timeouts.workflowTimeoutMs).toBeGreaterThan(timeouts.stepTimeoutMs);
      expect(timeouts.stepTimeoutMs).toBeGreaterThan(timeouts.requestTimeoutMs);
      expect(timeouts.requestTimeoutMs).toBeGreaterThan(timeouts.connectionTimeoutMs);
    });

    it('should have reasonable default values', () => {
      const config = createDefaultConfig();

      expect(config.defaultPromptOptions.maxHistorySteps).toBeGreaterThan(0);
      expect(config.defaultPromptOptions.maxHistorySteps).toBeLessThan(50);

      expect(config.contextConfig.maxDomSize).toBeGreaterThan(10000);
      expect(config.contextConfig.maxDomSize).toBeLessThan(1000000);

      expect(config.investigationConfig.maxInvestigationRoundsPerStep).toBeGreaterThan(0);
      expect(config.investigationConfig.maxInvestigationRoundsPerStep).toBeLessThan(20);

      expect(config.investigationConfig.minimumConfidenceThreshold).toBeGreaterThan(0);
      expect(config.investigationConfig.minimumConfidenceThreshold).toBeLessThan(1);
    });
  });

  describe('type exports', () => {
    it('should export type definitions that can be used', () => {
      // This test ensures that types are properly exported and can be imported
      // If there are type issues, TypeScript compilation would fail

      const phase: InvestigationPhase = InvestigationPhase.INITIAL_ASSESSMENT;
      const tool: InvestigationTool = InvestigationTool.SCREENSHOT_ANALYSIS;

      expect(phase).toBe('INITIAL_ASSESSMENT');
      expect(tool).toBe('SCREENSHOT_ANALYSIS');

      // Test that constants have expected types
      expect(typeof INVESTIGATION_CONSTANTS.DEFAULT_MAX_INVESTIGATION_ROUNDS).toBe('number');
      expect(typeof TEMPLATE_IDS.SYSTEM_MESSAGE).toBe('string');
      expect(typeof QUALITY_THRESHOLDS.MIN_CLARITY_SCORE).toBe('number');
    });
  });
});
