/**
 * Task Loop Validator Tests
 * Unit tests for AI response validation functionality
 */

import { 
  validateAIResponse, 
  validateAgainstSchema, 
  sanitizeAIResponse 
} from '../../../src/modules/task-loop/validator';
import { ValidationError } from '../../../src/modules/task-loop/types';
import { FLOW_CONTROL } from '../../../src/modules/task-loop/config';

describe('TaskLoop Validator', () => {
  const sessionId = 'test-session';
  const stepId = 1;

  describe('validateAIResponse', () => {
    it('should validate a complete valid response', () => {
      const validResponse = {
        reasoning: 'This is a valid reasoning',
        confidence: 85,
        flowControl: FLOW_CONTROL.STOP_SUCCESS
      };

      const result = validateAIResponse(validResponse, sessionId, stepId);

      expect(result).toEqual(validResponse);
    });

    it('should validate a response with action when flowControl is continue', () => {
      const validResponse = {
        reasoning: 'Need to click the button',
        confidence: 90,
        flowControl: FLOW_CONTROL.CONTINUE,
        action: {
          command: 'CLICK_ELEMENT',
          parameters: { selector: '.submit-btn' }
        }
      };

      const result = validateAIResponse(validResponse, sessionId, stepId);

      expect(result).toEqual(validResponse);
    });

    it('should throw ValidationError for non-object input', () => {
      expect(() => {
        validateAIResponse(null, sessionId, stepId);
      }).toThrow(ValidationError);

      expect(() => {
        validateAIResponse('string', sessionId, stepId);
      }).toThrow(ValidationError);

      expect(() => {
        validateAIResponse(123, sessionId, stepId);
      }).toThrow(ValidationError);
    });

    it('should throw ValidationError for missing required fields', () => {
      const missingReasoning = {
        confidence: 85,
        flowControl: FLOW_CONTROL.STOP_SUCCESS
      };

      expect(() => {
        validateAIResponse(missingReasoning, sessionId, stepId);
      }).toThrow(ValidationError);

      const missingConfidence = {
        reasoning: 'Test reasoning',
        flowControl: FLOW_CONTROL.STOP_SUCCESS
      };

      expect(() => {
        validateAIResponse(missingConfidence, sessionId, stepId);
      }).toThrow(ValidationError);

      const missingFlowControl = {
        reasoning: 'Test reasoning',
        confidence: 85
      };

      expect(() => {
        validateAIResponse(missingFlowControl, sessionId, stepId);
      }).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid reasoning', () => {
      const emptyReasoning = {
        reasoning: '',
        confidence: 85,
        flowControl: FLOW_CONTROL.STOP_SUCCESS
      };

      expect(() => {
        validateAIResponse(emptyReasoning, sessionId, stepId);
      }).toThrow(ValidationError);

      const nonStringReasoning = {
        reasoning: 123,
        confidence: 85,
        flowControl: FLOW_CONTROL.STOP_SUCCESS
      };

      expect(() => {
        validateAIResponse(nonStringReasoning, sessionId, stepId);
      }).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid confidence values', () => {
      const negativeConfidence = {
        reasoning: 'Test reasoning',
        confidence: -1,
        flowControl: FLOW_CONTROL.STOP_SUCCESS
      };

      expect(() => {
        validateAIResponse(negativeConfidence, sessionId, stepId);
      }).toThrow(ValidationError);

      const tooHighConfidence = {
        reasoning: 'Test reasoning',
        confidence: 101,
        flowControl: FLOW_CONTROL.STOP_SUCCESS
      };

      expect(() => {
        validateAIResponse(tooHighConfidence, sessionId, stepId);
      }).toThrow(ValidationError);

      const stringConfidence = {
        reasoning: 'Test reasoning',
        confidence: 'high',
        flowControl: FLOW_CONTROL.STOP_SUCCESS
      };

      expect(() => {
        validateAIResponse(stringConfidence, sessionId, stepId);
      }).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid flowControl values', () => {
      const invalidFlowControl = {
        reasoning: 'Test reasoning',
        confidence: 85,
        flowControl: 'invalid_value'
      };

      expect(() => {
        validateAIResponse(invalidFlowControl, sessionId, stepId);
      }).toThrow(ValidationError);
    });

    it('should throw ValidationError when action is missing but flowControl is continue', () => {
      const missingAction = {
        reasoning: 'Need to perform an action',
        confidence: 85,
        flowControl: FLOW_CONTROL.CONTINUE
      };

      expect(() => {
        validateAIResponse(missingAction, sessionId, stepId);
      }).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid action structure', () => {
      const invalidAction = {
        reasoning: 'Test reasoning',
        confidence: 85,
        flowControl: FLOW_CONTROL.CONTINUE,
        action: {
          // Missing command
          parameters: { selector: '.test' }
        }
      };

      expect(() => {
        validateAIResponse(invalidAction, sessionId, stepId);
      }).toThrow(ValidationError);

      const missingParameters = {
        reasoning: 'Test reasoning',
        confidence: 85,
        flowControl: FLOW_CONTROL.CONTINUE,
        action: {
          command: 'CLICK_ELEMENT'
          // Missing parameters
        }
      };

      expect(() => {
        validateAIResponse(missingParameters, sessionId, stepId);
      }).toThrow(ValidationError);
    });

    it('should include session and step context in validation errors', () => {
      const invalidResponse = {
        reasoning: 'Test',
        confidence: 'invalid',
        flowControl: FLOW_CONTROL.STOP_SUCCESS
      };

      try {
        validateAIResponse(invalidResponse, sessionId, stepId);
        fail('Expected ValidationError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).sessionId).toBe(sessionId);
        expect((error as ValidationError).stepId).toBe(stepId);
      }
    });
  });

  describe('sanitizeAIResponse', () => {
    it('should trim reasoning strings', () => {
      const response = {
        reasoning: '  This has extra whitespace  ',
        confidence: 85,
        flowControl: FLOW_CONTROL.STOP_SUCCESS
      };

      const sanitized = sanitizeAIResponse(response);

      expect(sanitized.reasoning).toBe('This has extra whitespace');
    });

    it('should convert string confidence to number', () => {
      const response = {
        reasoning: 'Test reasoning',
        confidence: '85',
        flowControl: FLOW_CONTROL.STOP_SUCCESS
      };

      const sanitized = sanitizeAIResponse(response);

      expect(sanitized.confidence).toBe(85);
      expect(typeof sanitized.confidence).toBe('number');
    });

    it('should convert flowControl to lowercase', () => {
      const response = {
        reasoning: 'Test reasoning',
        confidence: 85,
        flowControl: 'STOP_SUCCESS'
      };

      const sanitized = sanitizeAIResponse(response);

      expect(sanitized.flowControl).toBe('stop_success');
    });

    it('should handle non-object inputs', () => {
      expect(sanitizeAIResponse(null)).toBe(null);
      expect(sanitizeAIResponse('string')).toBe('string');
      expect(sanitizeAIResponse(123)).toBe(123);
    });

    it('should not modify original object', () => {
      const original = {
        reasoning: '  Test  ',
        confidence: '85',
        flowControl: 'STOP_SUCCESS'
      };

      const sanitized = sanitizeAIResponse(original);

      expect(original.reasoning).toBe('  Test  ');
      expect(original.confidence).toBe('85');
      expect(original.flowControl).toBe('STOP_SUCCESS');
      expect(sanitized).not.toBe(original);
    });

    it('should handle invalid string confidence gracefully', () => {
      const response = {
        reasoning: 'Test reasoning',
        confidence: 'not-a-number',
        flowControl: FLOW_CONTROL.STOP_SUCCESS
      };

      const sanitized = sanitizeAIResponse(response);

      expect(sanitized.confidence).toBe('not-a-number'); // Should remain unchanged
    });
  });

  describe('validateAgainstSchema', () => {
    it('should return true for valid response', () => {
      const validResponse = {
        reasoning: 'Valid reasoning',
        confidence: 85,
        flowControl: FLOW_CONTROL.STOP_SUCCESS
      };

      const schema = {}; // Placeholder schema

      const result = validateAgainstSchema(validResponse, schema);

      expect(result).toBe(true);
    });

    it('should return false for invalid response', () => {
      const invalidResponse = {
        reasoning: 'Test',
        // Missing confidence and flowControl
      };

      const schema = {}; // Placeholder schema

      const result = validateAgainstSchema(invalidResponse, schema);

      expect(result).toBe(false);
    });

    it('should handle validation errors gracefully', () => {
      const invalidResponse = null;
      const schema = {};

      const result = validateAgainstSchema(invalidResponse, schema);

      expect(result).toBe(false);
    });
  });
});
