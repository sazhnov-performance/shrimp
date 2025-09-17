/**
 * Validator Tests
 */

import { Validator } from '../../../src/modules/ai-schema-manager/validator';
import { SchemaGenerator } from '../../../src/modules/ai-schema-manager/schema-generator';

describe('Validator', () => {
  let validator: Validator;
  let schemaGenerator: SchemaGenerator;

  beforeEach(() => {
    validator = new Validator();
    schemaGenerator = new SchemaGenerator();
  });

  afterEach(() => {
    validator.clearCache();
  });

  describe('AI Response Validation', () => {
    test('should validate valid response', async () => {
      const schema = await schemaGenerator.generateResponseSchema();
      const response = {
        decision: {
          action: 'PROCEED',
          message: 'Proceeding with next step',
          resultValidation: {
            success: true,
            expectedElements: ['button'],
            actualState: 'Page loaded'
          }
        },
        reasoning: {
          analysis: 'Page analysis shows button is present',
          rationale: 'Button is clickable and visible',
          expectedOutcome: 'Click will be successful'
        },
        command: {
          action: 'CLICK_ELEMENT',
          parameters: {
            selector: 'button.submit'
          }
        }
      };

      const result = await validator.validateAIResponse(response, schema);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.executorCompatible).toBe(true);
    });

    test('should detect invalid decision action', async () => {
      const schema = await schemaGenerator.generateResponseSchema();
      const response = {
        decision: {
          action: 'INVALID',
          message: 'Test'
        },
        reasoning: {
          analysis: 'Test analysis',
          rationale: 'Test rationale',
          expectedOutcome: 'Test outcome'
        }
      };

      const result = await validator.validateAIResponse(response, schema);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.field.includes('action'))).toBe(true);
    });

    test('should detect missing required fields', async () => {
      const schema = await schemaGenerator.generateResponseSchema();
      const response = {
        decision: {
          action: 'PROCEED'
          // Missing message
        }
        // Missing reasoning
      };

      const result = await validator.validateAIResponse(response, schema);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should validate command parameters', async () => {
      const schema = await schemaGenerator.generateResponseSchema();
      const response = {
        decision: {
          action: 'PROCEED',
          message: 'Test'
        },
        reasoning: {
          analysis: 'Test analysis',
          rationale: 'Test rationale',
          expectedOutcome: 'Test outcome'
        },
        command: {
          action: 'OPEN_PAGE',
          parameters: {
            url: 'invalid-url'
          }
        }
      };

      const result = await validator.validateAIResponse(response, schema);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.field.includes('url'))).toBe(true);
    });

    test('should detect decision-command inconsistency', async () => {
      const schema = await schemaGenerator.generateResponseSchema();
      const response = {
        decision: {
          action: 'ABORT',
          message: 'Aborting execution'
        },
        reasoning: {
          analysis: 'Unrecoverable error',
          rationale: 'Cannot proceed',
          expectedOutcome: 'Execution halted'
        },
        command: {
          action: 'CLICK_ELEMENT',
          parameters: {
            selector: 'button'
          }
        }
      };

      const result = await validator.validateAIResponse(response, schema);
      
      expect(result.warnings.some(warning => 
        warning.includes('ABORT') && warning.includes('command')
      )).toBe(true);
    });
  });

  describe('Field Validation', () => {
    test('should validate individual fields', () => {
      const decisionResult = validator.validateField('action', 'PROCEED', 'DecisionAction');
      expect(decisionResult.valid).toBe(true);

      const invalidDecisionResult = validator.validateField('action', 'INVALID', 'DecisionAction');
      expect(invalidDecisionResult.valid).toBe(false);

      const stringResult = validator.validateField('message', 'test', 'string');
      expect(stringResult.valid).toBe(true);

      const numberResult = validator.validateField('confidence', 0.5, 'number');
      expect(numberResult.valid).toBe(true);
    });
  });

  describe('Cache Management', () => {
    test('should cache validators', async () => {
      const schema = await schemaGenerator.generateResponseSchema();
      const response = {
        decision: { action: 'PROCEED', message: 'Test' },
        reasoning: { analysis: 'Test', rationale: 'Test', expectedOutcome: 'Test' }
      };

      // First validation should create cache entry
      await validator.validateAIResponse(response, schema);
      
      // Second validation should use cached validator
      await validator.validateAIResponse(response, schema);
      
      const stats = validator.getValidationStats();
      expect(stats.cachedValidators).toBeGreaterThan(0);
    });

    test('should clear cache', () => {
      validator.clearCache();
      const stats = validator.getValidationStats();
      expect(stats.cachedValidators).toBe(0);
    });
  });
});
