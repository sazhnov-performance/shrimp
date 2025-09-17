/**
 * Prompt Validator Tests
 * Unit tests for prompt validation and quality assessment
 */

import { PromptValidator } from '../../../src/modules/ai-prompt-manager/prompt-validator';
import { 
  ValidationConfig, 
  GeneratedPrompt, 
  EnhancedPromptType,
  QUALITY_THRESHOLDS 
} from '../../../src/modules/ai-prompt-manager/types';

describe('PromptValidator', () => {
  let validator: PromptValidator;
  let config: ValidationConfig;

  beforeEach(() => {
    config = {
      enableActionValidation: true,
      enableResultAnalysis: true,
      validationTimeoutMs: 30000,
      requireExplicitValidation: false
    };
    validator = new PromptValidator(config);
  });

  describe('prompt structure validation', () => {
    it('should validate a complete and valid prompt', () => {
      const validPrompt: GeneratedPrompt = {
        promptId: 'test-prompt-123',
        sessionId: 'session-456',
        stepIndex: 1,
        promptType: EnhancedPromptType.INITIAL_ACTION as any,
        content: {
          systemMessage: 'You are an AI web browser agent designed to automate web interactions.',
          contextSection: {
            currentStep: {
              stepIndex: 1,
              stepContent: 'Click the login button',
              stepType: 'initial' as const,
              totalSteps: 5
            },
            executionHistory: {
              previousSteps: [],
              chronologicalEvents: [],
              successfulActions: 0,
              failedActions: 0
            },
            pageStates: {
              currentPageDom: '<html><body>Test page</body></html>'
            }
          },
          instructionSection: {
            currentStepInstruction: 'Click the login button located in the top right corner',
            actionGuidance: 'Use precise CSS selectors to identify and interact with elements',
            constraints: ['Ensure element is visible', 'Wait for page load'],
            objectives: ['Successfully authenticate user', 'Navigate to dashboard']
          },
          schemaSection: {
            responseFormat: 'JSON with structured fields',
            schemaDefinition: {
              type: 'object',
              properties: {
                decision: { type: 'object' },
                reasoning: { type: 'object' },
                commands: { type: 'array' }
              },
              required: ['decision', 'reasoning', 'commands']
            },
            validationRules: ['Response must conform to JSON schema', 'All required fields must be present']
          }
        },
        schema: {
          type: 'object',
          properties: {
            decision: { type: 'object' },
            reasoning: { type: 'object' },
            commands: { type: 'array' }
          },
          required: ['decision', 'reasoning', 'commands']
        },
        generatedAt: new Date(),
        metadata: {
          generationTimeMs: 150,
          templateVersion: '1.0.0'
        }
      };

      const result = validator.validatePromptStructure(validPrompt);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.qualityScore).toBeGreaterThan(QUALITY_THRESHOLDS.MIN_OVERALL_SCORE);
      expect(result.warnings).toBeDefined();
      expect(result.suggestions).toBeDefined();
    });

    it('should detect missing required fields', () => {
      const invalidPrompt = {
        promptId: 'test-prompt-123',
        // Missing sessionId, stepIndex, promptType, content, schema, generatedAt
      } as any;

      const result = validator.validatePromptStructure(invalidPrompt);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.field === 'sessionId')).toBe(true);
      expect(result.errors.some(e => e.field === 'stepIndex')).toBe(true);
      expect(result.errors.some(e => e.field === 'content')).toBe(true);
    });

    it('should detect invalid field types', () => {
      const invalidPrompt = {
        promptId: 123, // Should be string
        sessionId: null, // Should be string
        stepIndex: 'not-a-number', // Should be number
        promptType: EnhancedPromptType.INITIAL_ACTION,
        content: {},
        schema: {},
        generatedAt: 'not-a-date' // Should be Date
      } as any;

      const result = validator.validatePromptStructure(invalidPrompt);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'promptId' && e.code === 'INVALID_FIELD_TYPE')).toBe(true);
      expect(result.errors.some(e => e.field === 'stepIndex' && e.code === 'INVALID_FIELD_TYPE')).toBe(true);
    });

    it('should detect missing content sections', () => {
      const promptWithIncompleteContent: GeneratedPrompt = {
        promptId: 'test-prompt-123',
        sessionId: 'session-456',
        stepIndex: 1,
        promptType: EnhancedPromptType.INITIAL_ACTION as any,
        content: {
          systemMessage: 'Test message',
          // Missing contextSection, instructionSection, schemaSection
        } as any,
        schema: { type: 'object', properties: {}, required: [] },
        generatedAt: new Date()
      };

      const result = validator.validatePromptStructure(promptWithIncompleteContent);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'content.contextSection')).toBe(true);
      expect(result.errors.some(e => e.field === 'content.instructionSection')).toBe(true);
      expect(result.errors.some(e => e.field === 'content.schemaSection')).toBe(true);
    });

    it('should provide warnings for missing optional sections', () => {
      const promptWithoutOptionalSections: GeneratedPrompt = {
        promptId: 'test-prompt-123',
        sessionId: 'session-456',
        stepIndex: 2, // Non-initial step
        promptType: EnhancedPromptType.INITIAL_ACTION as any,
        content: {
          systemMessage: 'Test message',
          contextSection: {
            currentStep: { stepIndex: 2, stepContent: 'test', stepType: 'continuation', totalSteps: 5 },
            executionHistory: { previousSteps: [], chronologicalEvents: [], successfulActions: 0, failedActions: 0 },
            pageStates: {}
          },
          instructionSection: {
            currentStepInstruction: 'Test instruction',
            actionGuidance: 'Test guidance',
            constraints: [],
            objectives: []
          },
          schemaSection: {
            responseFormat: 'JSON',
            schemaDefinition: { type: 'object', properties: {}, required: [] },
            validationRules: []
          }
          // Missing validationSection for non-initial step
        },
        schema: { type: 'object', properties: {}, required: [] },
        generatedAt: new Date(),
        metadata: { useInvestigation: true } // Investigation enabled but no workingMemorySection
      };

      const result = validator.validatePromptStructure(promptWithoutOptionalSections);

      expect(result.warnings.some(w => w.includes('Validation section recommended'))).toBe(true);
      expect(result.warnings.some(w => w.includes('Working memory section recommended'))).toBe(true);
    });
  });

  describe('schema integration validation', () => {
    it('should validate proper schema integration', () => {
      const promptWithProperSchema: GeneratedPrompt = {
        promptId: 'test-prompt-123',
        sessionId: 'session-456',
        stepIndex: 1,
        promptType: EnhancedPromptType.INITIAL_ACTION as any,
        content: {
          systemMessage: 'Test',
          contextSection: {} as any,
          instructionSection: {} as any,
          schemaSection: {
            responseFormat: 'JSON with structured fields',
            schemaDefinition: {
              type: 'object',
              properties: { test: { type: 'string' } },
              required: ['test']
            },
            validationRules: ['Must conform to schema']
          }
        },
        schema: {
          type: 'object',
          properties: { test: { type: 'string' } },
          required: ['test']
        },
        generatedAt: new Date()
      };

      const isValid = validator.validateSchemaIntegration(promptWithProperSchema);
      expect(isValid).toBe(true);
    });

    it('should detect missing schema', () => {
      const promptWithoutSchema = {
        promptId: 'test-prompt-123',
        content: { schemaSection: {} }
        // Missing schema field
      } as any;

      const isValid = validator.validateSchemaIntegration(promptWithoutSchema);
      expect(isValid).toBe(false);
    });

    it('should detect invalid schema structure', () => {
      const promptWithInvalidSchema = {
        promptId: 'test-prompt-123',
        content: { schemaSection: {} },
        schema: {
          // Missing type and properties
          required: ['test']
        }
      } as any;

      const isValid = validator.validateSchemaIntegration(promptWithInvalidSchema);
      expect(isValid).toBe(false);
    });
  });

  describe('quality assessment', () => {
    it('should assess high-quality prompt correctly', () => {
      const highQualityPrompt: GeneratedPrompt = {
        promptId: 'test-prompt-123',
        sessionId: 'session-456',
        stepIndex: 1,
        promptType: EnhancedPromptType.INITIAL_ACTION as any,
        content: {
          systemMessage: 'You are an AI web browser agent designed to automate web interactions with precision and intelligence.',
          contextSection: {
            currentStep: { stepIndex: 1, stepContent: 'detailed content', stepType: 'initial', totalSteps: 5 },
            executionHistory: { previousSteps: [], chronologicalEvents: [], successfulActions: 0, failedActions: 0 },
            pageStates: {}
          },
          instructionSection: {
            currentStepInstruction: 'Perform this specific action with careful consideration of the page state',
            actionGuidance: 'Use precise selectors and validate all interactions',
            constraints: ['Wait for elements to be visible', 'Ensure no errors occur'],
            objectives: ['Complete the action successfully', 'Maintain workflow continuity']
          },
          schemaSection: {
            responseFormat: 'JSON with structured decision, reasoning, and commands',
            schemaDefinition: {
              type: 'object',
              properties: {
                decision: { type: 'object' },
                reasoning: { type: 'object' },
                commands: { type: 'array' }
              },
              required: ['decision', 'reasoning', 'commands']
            },
            validationRules: ['Follow JSON schema exactly', 'Include all required fields']
          }
        },
        schema: {
          type: 'object',
          properties: {
            decision: { type: 'object' },
            reasoning: { type: 'object' },
            commands: { type: 'array' }
          },
          required: ['decision', 'reasoning', 'commands']
        },
        generatedAt: new Date(),
        metadata: { stepIndex: 1 }
      };

      const assessment = validator.assessPromptQuality(highQualityPrompt);

      expect(assessment.clarityScore).toBeGreaterThan(QUALITY_THRESHOLDS.MIN_CLARITY_SCORE);
      expect(assessment.completenessScore).toBeGreaterThan(QUALITY_THRESHOLDS.MIN_COMPLETENESS_SCORE);
      expect(assessment.contextRelevanceScore).toBeGreaterThan(QUALITY_THRESHOLDS.MIN_CONTEXT_RELEVANCE_SCORE);
      expect(assessment.schemaAlignmentScore).toBeGreaterThan(0.7);
      expect(assessment.overallScore).toBeGreaterThan(QUALITY_THRESHOLDS.MIN_OVERALL_SCORE);
      expect(assessment.improvements).toBeDefined();
    });

    it('should assess low-quality prompt and provide improvements', () => {
      const lowQualityPrompt: GeneratedPrompt = {
        promptId: 'test-prompt-123',
        sessionId: 'session-456',
        stepIndex: 1,
        promptType: EnhancedPromptType.INITIAL_ACTION as any,
        content: {
          systemMessage: 'AI', // Too short
          contextSection: {
            currentStep: { stepIndex: 1, stepContent: 'x', stepType: 'initial', totalSteps: 5 },
            executionHistory: { previousSteps: [], chronologicalEvents: [], successfulActions: 0, failedActions: 0 },
            pageStates: {}
          },
          instructionSection: {
            currentStepInstruction: 'Do it', // Too vague
            actionGuidance: 'Just do it', // Too vague
            constraints: [], // Empty
            objectives: [] // Empty
          },
          schemaSection: {
            responseFormat: 'JSON',
            schemaDefinition: { type: 'object' }, // Incomplete
            validationRules: []
          }
        },
        schema: { type: 'object' }, // Incomplete
        generatedAt: new Date()
      };

      const assessment = validator.assessPromptQuality(lowQualityPrompt);

      expect(assessment.clarityScore).toBeLessThan(QUALITY_THRESHOLDS.MIN_CLARITY_SCORE);
      expect(assessment.completenessScore).toBeLessThan(QUALITY_THRESHOLDS.MIN_COMPLETENESS_SCORE);
      expect(assessment.overallScore).toBeLessThan(QUALITY_THRESHOLDS.MIN_OVERALL_SCORE);
      expect(assessment.improvements.length).toBeGreaterThan(0);
      expect(assessment.improvements.some(i => i.includes('clarity'))).toBe(true);
    });

    it('should detect context relevance issues', () => {
      const contextMismatchPrompt: GeneratedPrompt = {
        promptId: 'test-prompt-123',
        sessionId: 'session-456',
        stepIndex: 5, // Non-initial step
        promptType: EnhancedPromptType.INITIAL_ACTION as any, // But using initial action type
        content: {
          systemMessage: 'Test message',
          contextSection: {
            currentStep: { stepIndex: 2, stepContent: 'content', stepType: 'initial', totalSteps: 5 }, // Mismatched step index
            executionHistory: { previousSteps: [], chronologicalEvents: [], successfulActions: 0, failedActions: 0 },
            pageStates: {}
          },
          instructionSection: {
            currentStepInstruction: 'Test',
            actionGuidance: 'Test',
            constraints: [],
            objectives: []
          },
          schemaSection: {
            responseFormat: 'JSON',
            schemaDefinition: { type: 'object', properties: {}, required: [] },
            validationRules: []
          }
        },
        schema: { type: 'object', properties: {}, required: [] },
        generatedAt: new Date(),
        metadata: { stepIndex: 3 } // Another mismatched step index
      };

      const assessment = validator.assessPromptQuality(contextMismatchPrompt);

      expect(assessment.contextRelevanceScore).toBeLessThan(QUALITY_THRESHOLDS.MIN_CONTEXT_RELEVANCE_SCORE);
      expect(assessment.improvements.some(i => i.includes('context'))).toBe(true);
    });
  });

  describe('template variable validation', () => {
    const sampleTemplate = {
      templateId: 'test-template',
      name: 'Test Template',
      description: 'Test template',
      template: 'Test content',
      variables: [
        { name: 'required1', type: 'string' as const, required: true, description: 'Required string' },
        { name: 'required2', type: 'number' as const, required: true, description: 'Required number' },
        { name: 'optional1', type: 'boolean' as const, required: false, description: 'Optional boolean' },
        { name: 'arrayVar', type: 'array' as const, required: false, description: 'Array variable' },
        { name: 'objectVar', type: 'object' as const, required: false, description: 'Object variable' }
      ],
      version: '1.0.0',
      lastModified: new Date()
    };

    it('should validate correct template variables', () => {
      const variables = {
        required1: 'test string',
        required2: 42,
        optional1: true,
        arrayVar: [1, 2, 3],
        objectVar: { key: 'value' }
      };

      const isValid = validator.validateTemplateVariables(sampleTemplate, variables);
      expect(isValid).toBe(true);
    });

    it('should fail when required variables are missing', () => {
      const variables = {
        required1: 'test string'
        // Missing required2
      };

      const isValid = validator.validateTemplateVariables(sampleTemplate, variables);
      expect(isValid).toBe(false);
    });

    it('should fail when variable types are incorrect', () => {
      const variables = {
        required1: 123, // Should be string
        required2: 'not a number', // Should be number
        optional1: 'not a boolean' // Should be boolean
      };

      const isValid = validator.validateTemplateVariables(sampleTemplate, variables);
      expect(isValid).toBe(false);
    });

    it('should pass with only required variables provided', () => {
      const variables = {
        required1: 'test string',
        required2: 42
      };

      const isValid = validator.validateTemplateVariables(sampleTemplate, variables);
      expect(isValid).toBe(true);
    });

    it('should validate array and object types correctly', () => {
      const validVariables = {
        required1: 'test',
        required2: 42,
        arrayVar: ['a', 'b', 'c'],
        objectVar: { nested: { key: 'value' } }
      };

      const invalidVariables = {
        required1: 'test',
        required2: 42,
        arrayVar: 'not an array',
        objectVar: null // null is not a valid object
      };

      expect(validator.validateTemplateVariables(sampleTemplate, validVariables)).toBe(true);
      expect(validator.validateTemplateVariables(sampleTemplate, invalidVariables)).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle validation exceptions gracefully', () => {
      const malformedPrompt = {
        // Completely malformed object that might cause errors during validation
        toString: () => { throw new Error('toString error'); }
      } as any;

      const result = validator.validatePromptStructure(malformedPrompt);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'VALIDATION_EXCEPTION')).toBe(true);
      expect(result.qualityScore).toBe(0);
    });

    it('should handle quality assessment errors gracefully', () => {
      const problematicPrompt = {
        promptId: 'test',
        sessionId: 'test',
        stepIndex: 1,
        promptType: 'test',
        content: {
          get systemMessage() { throw new Error('Property access error'); }
        },
        schema: {},
        generatedAt: new Date()
      } as any;

      // Should not throw even if there are errors accessing properties
      expect(() => {
        validator.assessPromptQuality(problematicPrompt);
      }).not.toThrow();
    });
  });
});
