/**
 * AI Prompt Manager Integration Tests
 * End-to-end tests for the complete module functionality
 */

import { 
  createAIPromptManager, 
  createDefaultConfig, 
  createMinimalConfig,
  createPerformanceConfig,
  InvestigationPhase,
  InvestigationTool,
  EnhancedPromptType
} from '../../../src/modules/ai-prompt-manager';

// Mock integrations
const mockContextManager = {
  getExecutionContext: jest.fn().mockResolvedValue({
    sessionId: 'integration-session',
    stepIndex: 0,
    executionHistory: [],
    pageState: { dom: '<html><body>Integration test page</body></html>' }
  }),
  getStepHistory: jest.fn().mockResolvedValue([]),
  getCurrentPageState: jest.fn().mockResolvedValue('<html><body>Current page</body></html>'),
  getPreviousPageState: jest.fn().mockResolvedValue(null),
  generateFilteredContext: jest.fn().mockResolvedValue({
    sessionId: 'integration-session',
    targetStep: 0,
    generatedAt: new Date(),
    executionSummary: [{
      stepIndex: 0,
      stepName: 'Initial step',
      reasoning: 'Starting workflow',
      actionTaken: 'OPEN_PAGE',
      outcome: 'success',
      confidence: 0.9,
      timestamp: new Date()
    }],
    pageInsights: [{
      stepIndex: 0,
      pageTitle: 'Test Page',
      layoutType: 'standard',
      mainSections: ['header', 'content', 'footer'],
      keyElements: ['#login-btn', '.nav-menu'],
      complexity: 'medium'
    }],
    elementKnowledge: [{
      selector: '#login-btn',
      elementType: 'button',
      purpose: 'User authentication',
      reliability: 0.95,
      lastSeen: new Date(),
      discoveryHistory: ['screenshot_analysis']
    }],
    workingMemory: {
      sessionId: 'integration-session',
      lastUpdated: new Date(),
      knownElements: new Map(),
      extractedVariables: new Map(),
      successfulPatterns: [],
      failurePatterns: [],
      investigationPreferences: { preferredOrder: [] }
    },
    investigationStrategy: {
      currentPhase: 'initial_assessment',
      recommendedInvestigations: [],
      investigationPriority: {
        primary: InvestigationTool.SCREENSHOT_ANALYSIS,
        fallbacks: [InvestigationTool.TEXT_EXTRACTION],
        reasoning: 'Initial assessment requires visual understanding'
      },
      contextManagementApproach: 'standard',
      confidenceThreshold: 0.7,
      maxInvestigationRounds: 3
    }
  }),
  generateInvestigationContext: jest.fn().mockResolvedValue({
    sessionId: 'integration-session',
    stepIndex: 1,
    generatedAt: new Date(),
    currentInvestigations: [],
    elementsDiscovered: [],
    pageInsight: {
      stepIndex: 1,
      pageTitle: 'Test Page',
      complexity: 'medium'
    },
    workingMemory: {
      sessionId: 'integration-session',
      lastUpdated: new Date(),
      knownElements: new Map(),
      extractedVariables: new Map(),
      successfulPatterns: [],
      failurePatterns: [],
      investigationPreferences: { preferredOrder: [] }
    },
    suggestedInvestigations: [],
    investigationPriority: {
      primary: InvestigationTool.SCREENSHOT_ANALYSIS,
      fallbacks: [],
      reasoning: 'Default priority'
    }
  }),
  getWorkingMemory: jest.fn().mockReturnValue({
    sessionId: 'integration-session',
    lastUpdated: new Date(),
    knownElements: new Map([
      ['#login-btn', {
        selector: '#login-btn',
        elementType: 'button',
        purpose: 'Login button',
        reliability: 0.9,
        lastSeen: new Date(),
        discoveryHistory: ['investigation']
      }]
    ]),
    extractedVariables: new Map(),
    successfulPatterns: [{
      pattern: 'button-click',
      context: 'authentication',
      successRate: 0.95,
      usageCount: 5,
      lastUsed: new Date()
    }],
    failurePatterns: [],
    investigationPreferences: {
      preferredOrder: [InvestigationTool.SCREENSHOT_ANALYSIS, InvestigationTool.TEXT_EXTRACTION],
      qualityThresholds: {
        [InvestigationTool.SCREENSHOT_ANALYSIS]: 0.8,
        [InvestigationTool.TEXT_EXTRACTION]: 0.7,
        [InvestigationTool.SUB_DOM_EXTRACTION]: 0.75,
        [InvestigationTool.FULL_DOM_RETRIEVAL]: 0.6
      },
      fallbackStrategies: {}
    }
  }),
  getInvestigationHistory: jest.fn().mockResolvedValue([
    {
      investigationId: 'inv-1',
      investigationType: InvestigationTool.SCREENSHOT_ANALYSIS,
      timestamp: new Date(),
      input: {},
      output: { visualDescription: 'Login page with form elements' },
      success: true
    }
  ]),
  getPageElementsDiscovered: jest.fn().mockResolvedValue([
    {
      discoveryId: 'discovery-1',
      timestamp: new Date(),
      selector: '#login-btn',
      elementType: 'button',
      properties: {
        tagName: 'button',
        textContent: 'Login',
        isVisible: true,
        isInteractable: true
      },
      confidence: 0.9,
      discoveryMethod: InvestigationTool.SCREENSHOT_ANALYSIS,
      isReliable: true
    }
  ]),
  getContextSummaries: jest.fn().mockResolvedValue([])
};

const mockSchemaManager = {
  getResponseSchema: jest.fn().mockResolvedValue({
    type: 'object',
    properties: {
      decision: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['PROCEED', 'RETRY', 'ABORT'] },
          message: { type: 'string' }
        },
        required: ['action', 'message']
      },
      reasoning: {
        type: 'object',
        properties: {
          analysis: { type: 'string' },
          rationale: { type: 'string' },
          expectedOutcome: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 }
        },
        required: ['analysis', 'rationale', 'expectedOutcome', 'confidence']
      },
      commands: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            action: { type: 'string' },
            parameters: { type: 'object' },
            reasoning: { type: 'string' }
          },
          required: ['action', 'parameters']
        }
      }
    },
    required: ['decision', 'reasoning', 'commands']
  }),
  validateSchemaCompatibility: jest.fn().mockReturnValue(true),
  getSchemaVersion: jest.fn().mockReturnValue('1.0.0')
};

describe('AI Prompt Manager Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete workflow scenarios', () => {
    it('should handle a complete multi-step automation workflow', async () => {
      const promptManager = createAIPromptManager(
        createDefaultConfig(),
        mockContextManager,
        mockSchemaManager
      );

      // Step 1: Initial action
      const step1Request = {
        sessionId: 'workflow-session',
        currentStepIndex: 0,
        currentStepContent: 'Open the login page',
        includeValidation: false,
        promptOptions: {
          reasoningDepth: 'detailed' as const,
          useFilteredContext: true
        }
      };

      const step1Prompt = await promptManager.generateActionPrompt(step1Request);
      expect(step1Prompt).toBeDefined();
      expect(step1Prompt.promptType).toBe(EnhancedPromptType.INITIAL_ACTION);
      expect(step1Prompt.content.systemMessage).toContain('investigation capabilities');

      // Step 2: Reflection after first step
      const step2Request = {
        sessionId: 'workflow-session',
        completedStepIndex: 0,
        nextStepIndex: 1,
        nextStepContent: 'Click the login button',
        expectedOutcome: 'Login page should be loaded',
        promptOptions: {
          validationMode: 'strict' as const,
          useFilteredContext: true
        }
      };

      const step2Prompt = await promptManager.generateReflectionPrompt(step2Request);
      expect(step2Prompt).toBeDefined();
      expect(step2Prompt.promptType).toBe(EnhancedPromptType.REFLECTION_AND_ACTION);
      expect(step2Prompt.content.validationSection).toBeDefined();

      // Step 3: Investigation phase
      const investigationRequest = {
        sessionId: 'workflow-session',
        stepIndex: 1,
        stepContent: 'Locate and analyze the login form',
        investigationPhase: InvestigationPhase.INITIAL_ASSESSMENT,
        availableTools: [
          InvestigationTool.SCREENSHOT_ANALYSIS,
          InvestigationTool.TEXT_EXTRACTION
        ]
      };

      const investigationPrompt = await promptManager.generateInvestigationPrompt(investigationRequest);
      expect(investigationPrompt).toBeDefined();
      expect(investigationPrompt.promptType).toBe(EnhancedPromptType.INVESTIGATION_INITIAL_ASSESSMENT);
      expect(investigationPrompt.content.investigationSection).toBeDefined();

      // Step 4: Action with investigation context
      const actionWithInvestigationRequest = {
        sessionId: 'workflow-session',
        stepIndex: 2,
        stepContent: 'Fill out the login form',
        investigationContext: {
          investigationsPerformed: [
            {
              investigationType: InvestigationTool.SCREENSHOT_ANALYSIS,
              objective: 'Understand login form structure',
              outcome: 'success' as const,
              keyFindings: ['Username field found', 'Password field found', 'Submit button located'],
              confidence: 0.9,
              timestamp: new Date()
            }
          ],
          elementsDiscovered: [
            {
              selector: '#username',
              elementType: 'input',
              purpose: 'Username input',
              reliability: 0.95,
              lastValidated: new Date()
            },
            {
              selector: '#password',
              elementType: 'input',
              purpose: 'Password input',
              reliability: 0.95,
              lastValidated: new Date()
            }
          ],
          pageInsight: {
            pageType: 'login-form',
            mainSections: ['header', 'login-form', 'footer'],
            keyElements: ['#username', '#password', '#login-btn'],
            complexity: 'low' as const,
            navigationStructure: 'simple'
          },
          workingMemoryState: {
            elementsKnown: 3,
            patternsLearned: 1,
            variablesExtracted: 0,
            investigationRoundsCompleted: 1,
            overallConfidence: 0.9
          },
          recommendedAction: {
            recommendedAction: 'Fill username and password fields, then click login button',
            confidence: 0.9,
            reasoning: ['All required elements identified', 'High reliability selectors available'],
            requiredValidation: ['Form submission success', 'Redirect to dashboard'],
            fallbackOptions: ['Retry with alternative selectors', 'Use text-based element location']
          }
        }
      };

      const actionWithInvestigationPrompt = await promptManager.generateActionWithInvestigationPrompt(
        actionWithInvestigationRequest
      );
      expect(actionWithInvestigationPrompt).toBeDefined();
      expect(actionWithInvestigationPrompt.promptType).toBe(EnhancedPromptType.ACTION_WITH_INVESTIGATION_CONTEXT);
      expect(actionWithInvestigationPrompt.content.workingMemorySection).toBeDefined();

      // Validate all prompts have proper structure
      const prompts = [step1Prompt, step2Prompt, investigationPrompt, actionWithInvestigationPrompt];
      
      for (const prompt of prompts) {
        const validation = promptManager.validatePromptStructure(prompt);
        expect(validation.isValid).toBe(true);
        expect(validation.qualityScore).toBeGreaterThan(0.7);
      }
    });

    it('should handle investigation workflow with all phases', async () => {
      const promptManager = createAIPromptManager(
        createDefaultConfig(),
        mockContextManager,
        mockSchemaManager
      );

      const baseRequest = {
        sessionId: 'investigation-workflow',
        stepIndex: 1,
        stepContent: 'Find and interact with the submit button',
        availableTools: [
          InvestigationTool.SCREENSHOT_ANALYSIS,
          InvestigationTool.TEXT_EXTRACTION,
          InvestigationTool.SUB_DOM_EXTRACTION,
          InvestigationTool.FULL_DOM_RETRIEVAL
        ]
      };

      // Phase 1: Initial Assessment
      const phase1Prompt = await promptManager.generateInvestigationPrompt({
        ...baseRequest,
        investigationPhase: InvestigationPhase.INITIAL_ASSESSMENT
      });

      expect(phase1Prompt.promptType).toBe(EnhancedPromptType.INVESTIGATION_INITIAL_ASSESSMENT);
      expect(phase1Prompt.content.investigationSection?.phaseSpecificGuidance.phaseDescription)
        .toContain('high-level understanding');

      // Phase 2: Focused Exploration
      const phase2Prompt = await promptManager.generateInvestigationPrompt({
        ...baseRequest,
        investigationPhase: InvestigationPhase.FOCUSED_EXPLORATION
      });

      expect(phase2Prompt.promptType).toBe(EnhancedPromptType.INVESTIGATION_FOCUSED_EXPLORATION);
      expect(phase2Prompt.content.investigationSection?.phaseSpecificGuidance.phaseDescription)
        .toContain('detailed exploration');

      // Phase 3: Selector Determination
      const phase3Prompt = await promptManager.generateInvestigationPrompt({
        ...baseRequest,
        investigationPhase: InvestigationPhase.SELECTOR_DETERMINATION
      });

      expect(phase3Prompt.promptType).toBe(EnhancedPromptType.INVESTIGATION_SELECTOR_DETERMINATION);
      expect(phase3Prompt.content.investigationSection?.phaseSpecificGuidance.phaseDescription)
        .toContain('optimal selectors');

      // Verify each phase has appropriate tool recommendations
      expect(phase1Prompt.content.investigationSection?.investigationStrategy.investigationPriority.primary)
        .toBe(InvestigationTool.SCREENSHOT_ANALYSIS);
      
      expect(phase2Prompt.content.investigationSection?.phaseSpecificGuidance.recommendedTools)
        .toContain(InvestigationTool.TEXT_EXTRACTION);
      
      expect(phase3Prompt.content.investigationSection?.phaseSpecificGuidance.recommendedTools)
        .toContain(InvestigationTool.SUB_DOM_EXTRACTION);
    });
  });

  describe('Configuration variants', () => {
    it('should work with minimal configuration', async () => {
      const promptManager = createAIPromptManager(
        createMinimalConfig(),
        mockContextManager,
        mockSchemaManager
      );

      const request = {
        sessionId: 'minimal-config-session',
        currentStepIndex: 0,
        currentStepContent: 'Simple action with minimal config',
        includeValidation: false
      };

      const prompt = await promptManager.generateActionPrompt(request);

      expect(prompt).toBeDefined();
      expect(prompt.content.workingMemorySection).toBeUndefined(); // Should not include working memory
      expect(prompt.content.contextSection.filteredContext).toBeUndefined(); // Should not use filtered context

      const validation = promptManager.validatePromptStructure(prompt);
      expect(validation.isValid).toBe(true);
    });

    it('should work with performance-optimized configuration', async () => {
      const promptManager = createAIPromptManager(
        createPerformanceConfig(),
        mockContextManager,
        mockSchemaManager
      );

      const request = {
        sessionId: 'performance-session',
        currentStepIndex: 1,
        currentStepContent: 'Performance optimized action',
        includeValidation: false,
        promptOptions: {
          reasoningDepth: 'basic' as const,
          maxHistorySteps: 3
        }
      };

      const prompt = await promptManager.generateActionPrompt(request);

      expect(prompt).toBeDefined();
      expect(prompt.content.contextSection.filteredContext).toBeDefined(); // Should use filtered context
      expect(prompt.content.workingMemorySection).toBeUndefined(); // Should not include working memory for performance

      const validation = promptManager.validatePromptStructure(prompt);
      expect(validation.isValid).toBe(true);
    });
  });

  describe('Error handling and recovery', () => {
    it('should handle context manager failures gracefully', async () => {
      const failingContextManager = {
        ...mockContextManager,
        getExecutionContext: jest.fn().mockRejectedValue(new Error('Context service unavailable'))
      };

      const promptManager = createAIPromptManager(
        createDefaultConfig(),
        failingContextManager,
        mockSchemaManager
      );

      const request = {
        sessionId: 'error-handling-session',
        currentStepIndex: 0,
        currentStepContent: 'Test error handling',
        includeValidation: false
      };

      await expect(promptManager.generateActionPrompt(request))
        .rejects
        .toThrow('Failed to generate action prompt');
    });

    it('should handle schema manager failures gracefully', async () => {
      const failingSchemaManager = {
        ...mockSchemaManager,
        getResponseSchema: jest.fn().mockRejectedValue(new Error('Schema service unavailable'))
      };

      const promptManager = createAIPromptManager(
        createDefaultConfig(),
        mockContextManager,
        failingSchemaManager
      );

      const request = {
        sessionId: 'schema-error-session',
        currentStepIndex: 0,
        currentStepContent: 'Test schema error handling',
        includeValidation: false
      };

      // Should still generate prompt with fallback schema
      const prompt = await promptManager.generateActionPrompt(request);
      expect(prompt).toBeDefined();
      expect(prompt.schema).toBeDefined();
    });

    it('should handle partial service failures in investigation mode', async () => {
      const partiallyFailingContextManager = {
        ...mockContextManager,
        generateFilteredContext: jest.fn().mockRejectedValue(new Error('Filtered context unavailable')),
        getWorkingMemory: jest.fn().mockImplementation(() => {
          throw new Error('Working memory unavailable');
        })
      };

      const promptManager = createAIPromptManager(
        createDefaultConfig(),
        partiallyFailingContextManager,
        mockSchemaManager
      );

      const request = {
        sessionId: 'partial-failure-session',
        currentStepIndex: 1,
        currentStepContent: 'Test partial failure handling',
        includeValidation: false,
        promptOptions: {
          useFilteredContext: true,
          includeWorkingMemory: true
        }
      };

      await expect(promptManager.generateActionPrompt(request))
        .rejects
        .toThrow();
    });
  });

  describe('Caching and performance', () => {
    it('should demonstrate caching functionality', async () => {
      const config = createDefaultConfig();
      config.performance.cacheEnabled = true;
      
      const promptManager = createAIPromptManager(
        config,
        mockContextManager,
        mockSchemaManager
      );

      const request = {
        sessionId: 'cache-test-session',
        currentStepIndex: 0,
        currentStepContent: 'Cached action test',
        includeValidation: false
      };

      // First call should generate and cache
      const startTime1 = Date.now();
      const prompt1 = await promptManager.generateActionPrompt(request);
      const duration1 = Date.now() - startTime1;

      // Second call should return cached result (faster)
      const startTime2 = Date.now();
      const prompt2 = await promptManager.generateActionPrompt(request);
      const duration2 = Date.now() - startTime2;

      expect(prompt1.promptId).toBe(prompt2.promptId);
      expect(prompt1.generatedAt).toEqual(prompt2.generatedAt);
      expect(duration2).toBeLessThan(duration1);
    });

    it('should handle high-throughput scenarios', async () => {
      const promptManager = createAIPromptManager(
        createPerformanceConfig(),
        mockContextManager,
        mockSchemaManager
      );

      const requests = Array.from({ length: 20 }, (_, i) => ({
        sessionId: `throughput-session-${i}`,
        currentStepIndex: 0,
        currentStepContent: `High throughput test ${i}`,
        includeValidation: false,
        promptOptions: {
          reasoningDepth: 'basic' as const
        }
      }));

      const startTime = Date.now();
      
      // Generate prompts concurrently
      const promises = requests.map(request => 
        promptManager.generateActionPrompt(request)
      );
      
      const prompts = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(prompts).toHaveLength(20);
      expect(prompts.every(p => p !== undefined)).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify all prompts are valid
      const validations = prompts.map(prompt => 
        promptManager.validatePromptStructure(prompt)
      );
      expect(validations.every(v => v.isValid)).toBe(true);
    });
  });

  describe('Template customization', () => {
    it('should support custom template updates', async () => {
      const promptManager = createAIPromptManager(
        createDefaultConfig(),
        mockContextManager,
        mockSchemaManager
      );

      // Update system message template
      const customTemplate = {
        templateId: 'system_message',
        name: 'Custom System Message',
        description: 'Customized system message',
        template: 'You are a CUSTOM AI web browser agent with special instructions: {{customInstruction}}',
        variables: [
          { name: 'customInstruction', type: 'string' as const, required: false, description: 'Custom instruction' }
        ],
        version: '2.0.0',
        lastModified: new Date()
      };

      promptManager.updatePromptTemplate('system_message', customTemplate);

      const request = {
        sessionId: 'custom-template-session',
        currentStepIndex: 0,
        currentStepContent: 'Test custom template',
        includeValidation: false
      };

      const prompt = await promptManager.generateActionPrompt(request);

      expect(prompt.content.systemMessage).toContain('CUSTOM AI web browser agent');
      expect(prompt.metadata?.templateVersion).toBe('2.0.0');

      const validation = promptManager.validatePromptStructure(prompt);
      expect(validation.isValid).toBe(true);
    });
  });

  describe('Working memory integration', () => {
    it('should properly integrate working memory across multiple prompts', async () => {
      const promptManager = createAIPromptManager(
        createDefaultConfig(),
        mockContextManager,
        mockSchemaManager
      );

      // Generate action prompt with working memory
      const actionRequest = {
        sessionId: 'working-memory-session',
        currentStepIndex: 1,
        currentStepContent: 'Interact with known elements',
        includeValidation: false,
        promptOptions: {
          useFilteredContext: true,
          includeWorkingMemory: true
        }
      };

      const actionPrompt = await promptManager.generateActionPrompt(actionRequest);

      expect(actionPrompt.content.workingMemorySection).toBeDefined();
      expect(actionPrompt.content.workingMemorySection?.knownElements.length).toBeGreaterThan(0);
      expect(actionPrompt.content.workingMemorySection?.successfulPatterns.length).toBeGreaterThan(0);

      // Generate investigation prompt
      const investigationRequest = {
        sessionId: 'working-memory-session',
        stepIndex: 1,
        stepContent: 'Investigate page elements',
        investigationPhase: InvestigationPhase.FOCUSED_EXPLORATION,
        availableTools: [InvestigationTool.SUB_DOM_EXTRACTION]
      };

      const investigationPrompt = await promptManager.generateInvestigationPrompt(investigationRequest);

      expect(investigationPrompt.content.workingMemorySection).toBeDefined();
      expect(investigationPrompt.content.workingMemorySection?.investigationPreferences).toBeDefined();

      // Verify working memory consistency
      expect(mockContextManager.getWorkingMemory).toHaveBeenCalledWith('working-memory-session');
      expect(actionPrompt.content.workingMemorySection?.knownElements[0]?.selector).toBe('#login-btn');
      expect(investigationPrompt.content.workingMemorySection?.knownElements[0]?.selector).toBe('#login-btn');
    });
  });
});
