/**
 * AI Prompt Manager Tests
 * Comprehensive unit tests for the AI Prompt Manager module
 */

import { AIPromptManagerImpl } from '../../../src/modules/ai-prompt-manager/prompt-manager';
import { 
  createDefaultConfig, 
  createMinimalConfig,
  InvestigationPhase,
  InvestigationTool,
  EnhancedPromptType,
  PromptManagerErrorType
} from '../../../src/modules/ai-prompt-manager';
import { ResponseSchema } from '../../../types/ai-schema-manager';

// Mock dependencies
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

// Mock response schema
const mockSchema: ResponseSchema = {
  type: 'object',
  properties: {
    decision: { type: 'object' },
    reasoning: { type: 'object' },
    commands: { type: 'array' }
  },
  required: ['decision', 'reasoning', 'commands']
};

describe('AIPromptManager', () => {
  let promptManager: AIPromptManagerImpl;
  let config: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    config = createDefaultConfig();
    promptManager = new AIPromptManagerImpl(config, mockContextManager, mockSchemaManager);

    // Setup default mock responses
    mockContextManager.getExecutionContext.mockResolvedValue({
      sessionId: 'test-session',
      stepIndex: 0,
      executionHistory: [],
      pageState: { dom: '<html></html>' }
    });

    mockContextManager.generateFilteredContext.mockResolvedValue({
      sessionId: 'test-session',
      targetStep: 0,
      generatedAt: new Date(),
      executionSummary: [],
      pageInsights: [],
      elementKnowledge: [],
      workingMemory: { knownElements: new Map(), lastUpdated: new Date() },
      investigationStrategy: { currentPhase: 'initial_assessment' }
    });

    mockContextManager.getWorkingMemory.mockReturnValue({
      sessionId: 'test-session',
      lastUpdated: new Date(),
      knownElements: new Map(),
      extractedVariables: new Map(),
      successfulPatterns: [],
      failurePatterns: [],
      investigationPreferences: { preferredOrder: [] }
    });

    mockContextManager.getInvestigationHistory.mockResolvedValue([]);
    
    mockSchemaManager.getResponseSchema.mockResolvedValue(mockSchema);
  });

  describe('generateActionPrompt', () => {
    it('should generate an initial action prompt successfully', async () => {
      const request = {
        sessionId: 'test-session',
        currentStepIndex: 0,
        currentStepContent: 'Click the login button',
        includeValidation: false,
        promptOptions: {
          reasoningDepth: 'detailed' as const,
          useFilteredContext: false
        }
      };

      const result = await promptManager.generateActionPrompt(request);

      expect(result).toBeDefined();
      expect(result.sessionId).toBe('test-session');
      expect(result.stepIndex).toBe(0);
      expect(result.promptType).toBe(EnhancedPromptType.INITIAL_ACTION);
      expect(result.content.systemMessage).toContain('AI web browser agent');
      expect(result.content.instructionSection.currentStepInstruction).toContain('Click the login button');
      expect(result.schema).toEqual(mockSchema);
    });

    it('should generate an action prompt with validation for non-initial steps', async () => {
      const request = {
        sessionId: 'test-session',
        currentStepIndex: 2,
        currentStepContent: 'Fill in the username field',
        includeValidation: true,
        promptOptions: {
          reasoningDepth: 'comprehensive' as const,
          validationMode: 'strict' as const
        }
      };

      const result = await promptManager.generateActionPrompt(request);

      expect(result).toBeDefined();
      expect(result.stepIndex).toBe(2);
      expect(result.promptType).toBe(EnhancedPromptType.ACTION_WITH_VALIDATION);
      expect(result.content.validationSection).toBeDefined();
    });

    it('should generate investigation-enhanced action prompt when enabled', async () => {
      const request = {
        sessionId: 'test-session',
        currentStepIndex: 1,
        currentStepContent: 'Navigate to settings page',
        includeValidation: false,
        promptOptions: {
          useFilteredContext: true,
          includeWorkingMemory: true,
          includeInvestigationHistory: true
        }
      };

      const result = await promptManager.generateActionPrompt(request);

      expect(result).toBeDefined();
      expect(result.content.workingMemorySection).toBeDefined();
      expect(result.content.contextSection.filteredContext).toBeDefined();
      expect(mockContextManager.generateFilteredContext).toHaveBeenCalled();
    });

    it('should handle errors gracefully and throw appropriate PromptManagerError', async () => {
      mockContextManager.getExecutionContext.mockRejectedValue(new Error('Context unavailable'));

      const request = {
        sessionId: 'test-session',
        currentStepIndex: 0,
        currentStepContent: 'Test step',
        includeValidation: false
      };

      await expect(promptManager.generateActionPrompt(request))
        .rejects
        .toThrow('Failed to generate action prompt');
    });
  });

  describe('generateReflectionPrompt', () => {
    it('should generate a reflection prompt successfully', async () => {
      const request = {
        sessionId: 'test-session',
        completedStepIndex: 1,
        nextStepIndex: 2,
        nextStepContent: 'Verify login success',
        expectedOutcome: 'User should be logged in',
        promptOptions: {
          validationMode: 'strict' as const,
          reasoningDepth: 'detailed' as const
        }
      };

      const result = await promptManager.generateReflectionPrompt(request);

      expect(result).toBeDefined();
      expect(result.sessionId).toBe('test-session');
      expect(result.stepIndex).toBe(2);
      expect(result.promptType).toBe(EnhancedPromptType.REFLECTION_AND_ACTION);
      expect(result.content.validationSection).toBeDefined();
      expect(result.content.validationSection?.lastActionValidation.expectedOutcome).toBe('User should be logged in');
      expect(result.metadata?.completedStepIndex).toBe(1);
    });

    it('should include working memory section for investigation-enabled reflection', async () => {
      const request = {
        sessionId: 'test-session',
        completedStepIndex: 2,
        nextStepIndex: 3,
        nextStepContent: 'Complete form submission',
        promptOptions: {
          useFilteredContext: true,
          includeWorkingMemory: true
        }
      };

      const result = await promptManager.generateReflectionPrompt(request);

      expect(result).toBeDefined();
      expect(result.content.workingMemorySection).toBeDefined();
      expect(mockContextManager.getWorkingMemory).toHaveBeenCalled();
    });
  });

  describe('generateInvestigationPrompt', () => {
    beforeEach(() => {
      config.investigationConfig.enableInvestigationPrompts = true;
    });

    it('should generate initial assessment investigation prompt', async () => {
      const request = {
        sessionId: 'test-session',
        stepIndex: 1,
        stepContent: 'Find and click the submit button',
        investigationPhase: InvestigationPhase.INITIAL_ASSESSMENT,
        availableTools: [InvestigationTool.SCREENSHOT_ANALYSIS, InvestigationTool.TEXT_EXTRACTION],
        investigationOptions: {
          maxInvestigationRounds: 3,
          confidenceThreshold: 0.8
        }
      };

      const result = await promptManager.generateInvestigationPrompt(request);

      expect(result).toBeDefined();
      expect(result.sessionId).toBe('test-session');
      expect(result.stepIndex).toBe(1);
      expect(result.promptType).toBe(EnhancedPromptType.INVESTIGATION_INITIAL_ASSESSMENT);
      expect(result.content.investigationSection).toBeDefined();
      expect(result.content.investigationSection?.investigationPhase).toBe(InvestigationPhase.INITIAL_ASSESSMENT);
      expect(result.content.investigationSection?.availableTools).toHaveLength(2);
      expect(result.content.workingMemorySection).toBeDefined();
    });

    it('should generate focused exploration investigation prompt', async () => {
      const request = {
        sessionId: 'test-session',
        stepIndex: 1,
        stepContent: 'Locate the search input field',
        investigationPhase: InvestigationPhase.FOCUSED_EXPLORATION,
        availableTools: [InvestigationTool.SUB_DOM_EXTRACTION, InvestigationTool.TEXT_EXTRACTION]
      };

      const result = await promptManager.generateInvestigationPrompt(request);

      expect(result).toBeDefined();
      expect(result.promptType).toBe(EnhancedPromptType.INVESTIGATION_FOCUSED_EXPLORATION);
      expect(result.content.investigationSection?.investigationPhase).toBe(InvestigationPhase.FOCUSED_EXPLORATION);
    });

    it('should generate selector determination investigation prompt', async () => {
      const request = {
        sessionId: 'test-session',
        stepIndex: 1,
        stepContent: 'Determine optimal selector for download button',
        investigationPhase: InvestigationPhase.SELECTOR_DETERMINATION,
        availableTools: [InvestigationTool.FULL_DOM_RETRIEVAL, InvestigationTool.SUB_DOM_EXTRACTION]
      };

      const result = await promptManager.generateInvestigationPrompt(request);

      expect(result).toBeDefined();
      expect(result.promptType).toBe(EnhancedPromptType.INVESTIGATION_SELECTOR_DETERMINATION);
      expect(result.content.investigationSection?.investigationPhase).toBe(InvestigationPhase.SELECTOR_DETERMINATION);
    });

    it('should throw error when investigation prompts are disabled', async () => {
      config.investigationConfig.enableInvestigationPrompts = false;

      const request = {
        sessionId: 'test-session',
        stepIndex: 1,
        stepContent: 'Test investigation',
        investigationPhase: InvestigationPhase.INITIAL_ASSESSMENT,
        availableTools: [InvestigationTool.SCREENSHOT_ANALYSIS]
      };

      await expect(promptManager.generateInvestigationPrompt(request))
        .rejects
        .toThrow('Investigation prompts are not enabled');
    });
  });

  describe('generateActionWithInvestigationPrompt', () => {
    beforeEach(() => {
      config.investigationConfig.enableInvestigationPrompts = true;
    });

    it('should generate action prompt with investigation context', async () => {
      const investigationContext = {
        investigationsPerformed: [
          {
            investigationType: InvestigationTool.SCREENSHOT_ANALYSIS,
            objective: 'Understand page layout',
            outcome: 'success' as const,
            keyFindings: ['Header navigation visible', 'Main content area identified'],
            confidence: 0.9,
            timestamp: new Date()
          }
        ],
        elementsDiscovered: [
          {
            selector: '#submit-btn',
            elementType: 'button',
            purpose: 'Form submission',
            reliability: 0.95,
            lastValidated: new Date()
          }
        ],
        pageInsight: {
          pageType: 'form',
          mainSections: ['header', 'form', 'footer'],
          keyElements: ['submit-btn', 'username-input'],
          complexity: 'medium' as const,
          navigationStructure: 'standard'
        },
        workingMemoryState: {
          elementsKnown: 5,
          patternsLearned: 2,
          variablesExtracted: 1,
          investigationRoundsCompleted: 2,
          overallConfidence: 0.85
        },
        recommendedAction: {
          recommendedAction: 'Click the submit button using selector #submit-btn',
          confidence: 0.9,
          reasoning: ['Element located during investigation', 'High reliability selector'],
          requiredValidation: ['Form submission success'],
          fallbackOptions: ['Try alternative selector', 'Use text-based selection']
        }
      };

      const request = {
        sessionId: 'test-session',
        stepIndex: 1,
        stepContent: 'Submit the registration form',
        investigationContext,
        promptOptions: {
          useFilteredContext: true
        }
      };

      const result = await promptManager.generateActionWithInvestigationPrompt(request);

      expect(result).toBeDefined();
      expect(result.sessionId).toBe('test-session');
      expect(result.stepIndex).toBe(1);
      expect(result.promptType).toBe(EnhancedPromptType.ACTION_WITH_INVESTIGATION_CONTEXT);
      expect(result.content.workingMemorySection).toBeDefined();
      expect(result.content.contextSection.sessionMetadata?.investigationContext).toBeDefined();
      expect(result.metadata?.investigationContext).toBe(investigationContext);
    });
  });

  describe('template management', () => {
    it('should get prompt templates', () => {
      const templates = promptManager.getPromptTemplates();

      expect(templates).toBeDefined();
      expect(templates.systemMessageTemplate).toBeDefined();
      expect(templates.actionPromptTemplate).toBeDefined();
      expect(templates.reflectionPromptTemplate).toBeDefined();
      expect(templates.validationPromptTemplate).toBeDefined();
      expect(templates.contextTemplate).toBeDefined();
      expect(templates.schemaTemplate).toBeDefined();
    });

    it('should update prompt template', () => {
      const newTemplate = {
        templateId: 'test-template',
        name: 'Test Template',
        description: 'A test template',
        template: 'Test content: {{testVar}}',
        variables: [
          { name: 'testVar', type: 'string' as const, required: true, description: 'Test variable' }
        ],
        version: '1.0.0',
        lastModified: new Date()
      };

      expect(() => {
        promptManager.updatePromptTemplate('test-template', newTemplate);
      }).not.toThrow();
    });
  });

  describe('validation', () => {
    it('should validate prompt structure successfully', async () => {
      const request = {
        sessionId: 'test-session',
        currentStepIndex: 0,
        currentStepContent: 'Test step',
        includeValidation: false
      };

      const prompt = await promptManager.generateActionPrompt(request);
      const validation = promptManager.validatePromptStructure(prompt);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.qualityScore).toBeGreaterThan(0);
    });
  });

  describe('caching', () => {
    beforeEach(() => {
      config.performance.cacheEnabled = true;
    });

    it('should cache generated prompts when caching is enabled', async () => {
      const request = {
        sessionId: 'test-session',
        currentStepIndex: 0,
        currentStepContent: 'Test caching',
        includeValidation: false
      };

      // First call should generate and cache
      const result1 = await promptManager.generateActionPrompt(request);
      
      // Second call should return cached result
      const result2 = await promptManager.generateActionPrompt(request);

      expect(result1.promptId).toBe(result2.promptId);
      expect(result1.generatedAt).toEqual(result2.generatedAt);
    });
  });

  describe('error handling', () => {
    it('should handle context manager unavailable', async () => {
      const promptManagerWithoutContext = new AIPromptManagerImpl(config);

      const request = {
        sessionId: 'test-session',
        currentStepIndex: 0,
        currentStepContent: 'Test step',
        includeValidation: false
      };

      await expect(promptManagerWithoutContext.generateActionPrompt(request))
        .rejects
        .toThrow();
    });

    it('should handle schema manager unavailable', async () => {
      const promptManagerWithoutSchema = new AIPromptManagerImpl(config, mockContextManager);

      const request = {
        sessionId: 'test-session',
        currentStepIndex: 0,
        currentStepContent: 'Test step',
        includeValidation: false
      };

      const result = await promptManagerWithoutSchema.generateActionPrompt(request);

      expect(result).toBeDefined();
      expect(result.schema).toBeDefined(); // Should have fallback schema
    });
  });

  describe('configuration variants', () => {
    it('should work with minimal configuration', async () => {
      const minimalConfig = createMinimalConfig();
      const minimalPromptManager = new AIPromptManagerImpl(
        { ...createDefaultConfig(), ...minimalConfig },
        mockContextManager,
        mockSchemaManager
      );

      const request = {
        sessionId: 'test-session',
        currentStepIndex: 0,
        currentStepContent: 'Test minimal config',
        includeValidation: false
      };

      const result = await minimalPromptManager.generateActionPrompt(request);

      expect(result).toBeDefined();
      expect(result.content.workingMemorySection).toBeUndefined(); // Should not include working memory
    });
  });
});
