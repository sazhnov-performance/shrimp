/**
 * AI Prompt Manager Tests
 * 
 * Unit tests for the main AI Prompt Manager implementation
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import {
  ActionPromptRequest,
  ReflectionPromptRequest,
  InvestigationPromptRequest,
  ActionWithInvestigationRequest,
  PromptType,
  InvestigationPhase,
  InvestigationTool,
  AIPromptManagerConfig
} from '../../../../types/ai-prompt-manager';

import { AIPromptManagerImpl } from '../prompt-manager';
import { PromptTemplateManager } from '../template-manager';
import { PromptValidator } from '../prompt-validator';
import { PromptContentBuilder } from '../content-builder';
import { InvestigationPromptGenerator } from '../investigation-generator';
import { ContextIntegrator } from '../context-integrator';
import { createDefaultConfig } from '../configuration-manager';

describe('AIPromptManagerImpl', () => {
  let promptManager: AIPromptManagerImpl;
  let config: AIPromptManagerConfig;
  let mockTemplateManager: jest.Mocked<PromptTemplateManager>;
  let mockValidator: jest.Mocked<PromptValidator>;
  let mockContentBuilder: jest.Mocked<PromptContentBuilder>;
  let mockInvestigationGenerator: jest.Mocked<InvestigationPromptGenerator>;
  let mockContextIntegrator: jest.Mocked<ContextIntegrator>;

  beforeEach(() => {
    config = createDefaultConfig();
    
    // Create mock dependencies
    mockTemplateManager = {
      getTemplate: jest.fn(),
      updateTemplate: jest.fn(),
      getAllTemplates: jest.fn(),
      validateTemplate: jest.fn(),
      updateConfig: jest.fn(),
      clearCache: jest.fn(),
      getTemplateStats: jest.fn()
    } as any;

    mockValidator = {
      validatePromptStructure: jest.fn(),
      validateTemplateVariables: jest.fn(),
      validateSchemaIntegration: jest.fn(),
      assessPromptQuality: jest.fn(),
      updateConfig: jest.fn()
    } as any;

    mockContentBuilder = {
      buildPromptContent: jest.fn(),
      buildInstructionSection: jest.fn(),
      buildValidationSection: jest.fn(),
      buildSchemaSection: jest.fn(),
      buildExamplesSection: jest.fn(),
      updateConfig: jest.fn()
    } as any;

    mockInvestigationGenerator = {
      generateInvestigationPrompt: jest.fn(),
      generateActionWithInvestigationPrompt: jest.fn(),
      updateConfig: jest.fn(),
      setDependencies: jest.fn()
    } as any;

    mockContextIntegrator = {
      buildContextSection: jest.fn(),
      buildInvestigationContextSection: jest.fn(),
      buildContextSectionWithInvestigation: jest.fn(),
      buildWorkingMemorySection: jest.fn(),
      setContextManager: jest.fn(),
      updateConfig: jest.fn(),
      getConfig: jest.fn()
    } as any;

    promptManager = new AIPromptManagerImpl(
      config,
      mockTemplateManager,
      mockValidator,
      mockContentBuilder,
      mockInvestigationGenerator,
      mockContextIntegrator
    );
  });

  describe('generateActionPrompt', () => {
    test('should generate initial action prompt for step 0', async () => {
      const request: ActionPromptRequest = {
        sessionId: 'test-session',
        currentStepIndex: 0,
        currentStepContent: 'Click the login button',
        includeValidation: false
      };

      const mockTemplate = {
        templateId: 'initial_action',
        name: 'Initial Action',
        description: 'Initial action template',
        template: 'Test template',
        variables: [],
        version: '1.0.0',
        lastModified: new Date()
      };

      const mockContextSection = {
        currentStep: {
          stepIndex: 0,
          stepContent: 'Click the login button',
          stepType: 'initial' as const,
          totalSteps: 1
        },
        executionHistory: {
          previousSteps: [],
          chronologicalEvents: [],
          successfulActions: 0,
          failedActions: 0
        },
        pageStates: {}
      };

      const mockSchemaSection = {
        responseFormat: 'JSON',
        requiredFields: [],
        optionalFields: [],
        examples: [],
        validationRules: [],
        responseSchema: {
          version: '1.0',
          type: 'object',
          properties: {},
          required: [],
          additionalProperties: false
        }
      };

      const mockContent = {
        systemMessage: 'Test system message',
        contextSection: mockContextSection,
        instructionSection: {
          mainInstruction: 'Test instruction',
          stepSpecificGuidance: [],
          decisionFramework: [],
          actionGuidelines: [],
          contextUsageInstructions: []
        },
        schemaSection: mockSchemaSection
      };

      mockTemplateManager.getTemplate.mockReturnValue(mockTemplate);
      mockContextIntegrator.buildContextSection.mockResolvedValue(mockContextSection);
      mockContentBuilder.buildSchemaSection.mockResolvedValue(mockSchemaSection);
      mockContentBuilder.buildPromptContent.mockResolvedValue(mockContent);
      mockValidator.validatePromptStructure.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
        qualityScore: 0.8,
        suggestions: []
      });

      const result = await promptManager.generateActionPrompt(request);

      expect(result).toBeDefined();
      expect(result.promptType).toBe(PromptType.INITIAL_ACTION);
      expect(result.sessionId).toBe('test-session');
      expect(result.stepIndex).toBe(0);
      expect(mockTemplateManager.getTemplate).toHaveBeenCalledWith('initial_action');
      expect(mockValidator.validatePromptStructure).toHaveBeenCalled();
    });

    test('should generate action with validation prompt for step > 0', async () => {
      const request: ActionPromptRequest = {
        sessionId: 'test-session',
        currentStepIndex: 1,
        currentStepContent: 'Enter username',
        includeValidation: true
      };

      const mockTemplate = {
        templateId: 'action_with_validation',
        name: 'Action with Validation',
        description: 'Action with validation template',
        template: 'Test template',
        variables: [],
        version: '1.0.0',
        lastModified: new Date()
      };

      mockTemplateManager.getTemplate.mockReturnValue(mockTemplate);
      mockContextIntegrator.buildContextSection.mockResolvedValue({} as any);
      mockContentBuilder.buildSchemaSection.mockResolvedValue({} as any);
      mockContentBuilder.buildPromptContent.mockResolvedValue({} as any);
      mockValidator.validatePromptStructure.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
        qualityScore: 0.8,
        suggestions: []
      });

      const result = await promptManager.generateActionPrompt(request);

      expect(result.promptType).toBe(PromptType.ACTION_WITH_VALIDATION);
      expect(mockTemplateManager.getTemplate).toHaveBeenCalledWith('action_with_validation');
    });

    test('should throw error when validation fails', async () => {
      const request: ActionPromptRequest = {
        sessionId: 'test-session',
        currentStepIndex: 0,
        currentStepContent: 'Click the login button',
        includeValidation: false
      };

      mockTemplateManager.getTemplate.mockReturnValue({} as any);
      mockContextIntegrator.buildContextSection.mockResolvedValue({} as any);
      mockContentBuilder.buildSchemaSection.mockResolvedValue({} as any);
      mockContentBuilder.buildPromptContent.mockResolvedValue({} as any);
      mockValidator.validatePromptStructure.mockReturnValue({
        isValid: false,
        errors: [{ field: 'test', message: 'Test error', severity: 'error', code: 'TEST_ERROR' }],
        warnings: [],
        qualityScore: 0.2,
        suggestions: []
      });

      await expect(promptManager.generateActionPrompt(request)).rejects.toThrow('Prompt validation failed');
    });
  });

  describe('generateReflectionPrompt', () => {
    test('should generate reflection prompt with validation section', async () => {
      const request: ReflectionPromptRequest = {
        sessionId: 'test-session',
        completedStepIndex: 0,
        nextStepIndex: 1,
        nextStepContent: 'Enter username',
        expectedOutcome: 'Login form should be visible'
      };

      const mockTemplate = {
        templateId: 'reflection_action',
        name: 'Reflection Action',
        description: 'Reflection action template',
        template: 'Test template',
        variables: [],
        version: '1.0.0',
        lastModified: new Date()
      };

      mockTemplateManager.getTemplate.mockReturnValue(mockTemplate);
      mockContextIntegrator.buildContextSection.mockResolvedValue({} as any);
      mockContentBuilder.buildValidationSection.mockResolvedValue({} as any);
      mockContentBuilder.buildSchemaSection.mockResolvedValue({} as any);
      mockContentBuilder.buildPromptContent.mockResolvedValue({} as any);
      mockValidator.validatePromptStructure.mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
        qualityScore: 0.8,
        suggestions: []
      });

      const result = await promptManager.generateReflectionPrompt(request);

      expect(result).toBeDefined();
      expect(result.promptType).toBe(PromptType.REFLECTION_AND_ACTION);
      expect(result.sessionId).toBe('test-session');
      expect(result.stepIndex).toBe(1);
      expect(mockTemplateManager.getTemplate).toHaveBeenCalledWith('reflection_action');
      expect(mockContentBuilder.buildValidationSection).toHaveBeenCalledWith(
        'test-session',
        0,
        'Login form should be visible'
      );
    });
  });

  describe('generateInvestigationPrompt', () => {
    test('should delegate to investigation generator', async () => {
      const request: InvestigationPromptRequest = {
        sessionId: 'test-session',
        stepIndex: 0,
        stepContent: 'Analyze the page',
        investigationPhase: InvestigationPhase.INITIAL_ASSESSMENT,
        availableTools: [InvestigationTool.SCREENSHOT_ANALYSIS]
      };

      const expectedPrompt = {
        promptId: 'test-investigation-prompt',
        sessionId: 'test-session',
        stepIndex: 0,
        promptType: PromptType.INVESTIGATION_INITIAL_ASSESSMENT,
        content: {} as any,
        schema: {} as any,
        generatedAt: new Date()
      };

      mockInvestigationGenerator.generateInvestigationPrompt.mockResolvedValue(expectedPrompt);

      const result = await promptManager.generateInvestigationPrompt(request);

      expect(result).toBe(expectedPrompt);
      expect(mockInvestigationGenerator.generateInvestigationPrompt).toHaveBeenCalledWith(request);
    });
  });

  describe('generateActionWithInvestigationPrompt', () => {
    test('should delegate to investigation generator', async () => {
      const request: ActionWithInvestigationRequest = {
        sessionId: 'test-session',
        stepIndex: 0,
        stepContent: 'Click button based on investigation',
        investigationContext: {
          investigationsPerformed: [],
          elementsDiscovered: [],
          pageInsight: {
            pageType: 'form',
            mainSections: ['header', 'form', 'footer'],
            keyElements: ['submit-button'],
            complexity: 'medium',
            navigationStructure: 'standard'
          },
          workingMemoryState: {
            elementsKnown: 1,
            patternsLearned: 0,
            variablesExtracted: 0,
            investigationRoundsCompleted: 1,
            overallConfidence: 0.8
          },
          recommendedAction: {
            recommendedAction: 'Click submit button',
            confidence: 0.9,
            reasoning: ['Button is clearly visible and accessible'],
            requiredValidation: ['Verify form submission'],
            fallbackOptions: ['Use keyboard navigation']
          }
        }
      };

      const expectedPrompt = {
        promptId: 'test-action-investigation-prompt',
        sessionId: 'test-session',
        stepIndex: 0,
        promptType: PromptType.ACTION_WITH_INVESTIGATION_CONTEXT,
        content: {} as any,
        schema: {} as any,
        generatedAt: new Date()
      };

      mockInvestigationGenerator.generateActionWithInvestigationPrompt.mockResolvedValue(expectedPrompt);

      const result = await promptManager.generateActionWithInvestigationPrompt(request);

      expect(result).toBe(expectedPrompt);
      expect(mockInvestigationGenerator.generateActionWithInvestigationPrompt).toHaveBeenCalledWith(request);
    });
  });

  describe('template management', () => {
    test('should get all templates from template manager', () => {
      const mockTemplates = {
        systemMessageTemplate: {} as any,
        actionPromptTemplate: {} as any,
        reflectionPromptTemplate: {} as any,
        validationPromptTemplate: {} as any,
        contextTemplate: {} as any,
        schemaTemplate: {} as any,
        investigationInitialAssessmentTemplate: {} as any,
        investigationFocusedExplorationTemplate: {} as any,
        investigationSelectorDeterminationTemplate: {} as any,
        actionWithInvestigationTemplate: {} as any,
        investigationToolsTemplate: {} as any,
        workingMemoryTemplate: {} as any,
        contextFilteringTemplate: {} as any
      };

      mockTemplateManager.getAllTemplates.mockReturnValue(mockTemplates);

      const result = promptManager.getPromptTemplates();

      expect(result).toBe(mockTemplates);
      expect(mockTemplateManager.getAllTemplates).toHaveBeenCalled();
    });

    test('should update template through template manager', () => {
      const template = {
        templateId: 'test-template',
        name: 'Test Template',
        description: 'Test template description',
        template: 'Test template content',
        variables: [],
        version: '1.0.0',
        lastModified: new Date()
      };

      promptManager.updatePromptTemplate('test-template', template);

      expect(mockTemplateManager.updateTemplate).toHaveBeenCalledWith('test-template', template);
    });
  });

  describe('validation', () => {
    test('should validate prompt structure through validator', () => {
      const prompt = {
        promptId: 'test-prompt',
        sessionId: 'test-session',
        stepIndex: 0,
        promptType: PromptType.INITIAL_ACTION,
        content: {} as any,
        schema: {} as any,
        generatedAt: new Date()
      };

      const expectedValidation = {
        isValid: true,
        errors: [],
        warnings: [],
        qualityScore: 0.8,
        suggestions: []
      };

      mockValidator.validatePromptStructure.mockReturnValue(expectedValidation);

      const result = promptManager.validatePromptStructure(prompt);

      expect(result).toBe(expectedValidation);
      expect(mockValidator.validatePromptStructure).toHaveBeenCalledWith(prompt);
    });
  });

  describe('configuration management', () => {
    test('should get current configuration', () => {
      const result = promptManager.getConfig();

      expect(result).toEqual(config);
    });

    test('should update configuration and propagate to sub-components', () => {
      const updates = {
        templateConfig: { enableCustomTemplates: false },
        validationConfig: { enableActionValidation: false },
        contextConfig: { maxDomSize: 50000 },
        investigationConfig: { enableInvestigationPrompts: false }
      } as any;

      promptManager.updateConfig(updates);

      expect(mockTemplateManager.updateConfig).toHaveBeenCalledWith(updates.templateConfig);
      expect(mockValidator.updateConfig).toHaveBeenCalledWith(updates.validationConfig);
      expect(mockContentBuilder.updateConfig).toHaveBeenCalledWith(updates.contextConfig);
      expect(mockContextIntegrator.updateConfig).toHaveBeenCalledWith(updates.contextConfig);
      expect(mockInvestigationGenerator.updateConfig).toHaveBeenCalledWith(updates.investigationConfig);
    });
  });

  describe('error handling', () => {
    test('should handle template manager errors gracefully', async () => {
      const request: ActionPromptRequest = {
        sessionId: 'test-session',
        currentStepIndex: 0,
        currentStepContent: 'Click the login button',
        includeValidation: false
      };

      mockTemplateManager.getTemplate.mockImplementation(() => {
        throw new Error('Template not found');
      });

      await expect(promptManager.generateActionPrompt(request)).rejects.toThrow('Failed to generate action prompt');
    });

    test('should handle context integration errors gracefully', async () => {
      const request: ActionPromptRequest = {
        sessionId: 'test-session',
        currentStepIndex: 0,
        currentStepContent: 'Click the login button',
        includeValidation: false
      };

      mockTemplateManager.getTemplate.mockReturnValue({} as any);
      mockContextIntegrator.buildContextSection.mockRejectedValue(new Error('Context unavailable'));

      await expect(promptManager.generateActionPrompt(request)).rejects.toThrow('Failed to generate action prompt');
    });
  });
});
