/**
 * AI Schema Manager Tests
 * Unit tests for the AI Schema Manager module as per design document
 * Based on design/ai-schema-manager.md specifications
 */

import { AISchemaManager, createAISchemaManager } from '../../../src/modules/ai-schema-manager';
import { EXAMPLE_RESPONSES } from '../../../src/modules/ai-schema-manager/types';

describe('AI Schema Manager', () => {
  let schemaManager: AISchemaManager;

  beforeEach(() => {
    schemaManager = new AISchemaManager();
  });

  describe('Schema Generation', () => {
    test('should generate AI response schema', () => {
      const schema = schemaManager.getAIResponseSchema();
      
      expect(schema).toBeDefined();
      expect(schema.type).toBe('object');
      expect(schema.required).toEqual(['reasoning', 'confidence', 'flowControl']);
      expect(schema.properties).toBeDefined();
    });

    test('should include action property in schema', () => {
      const schema = schemaManager.getAIResponseSchema();
      
      expect(schema.properties.action).toBeDefined();
      expect(schema.properties.action.description).toContain('required only when flowControl is');
      expect(schema.properties.action.type).toBe('object');
      expect(schema.properties.action.required).toEqual(['command', 'parameters']);
    });

    test('should include reasoning property in schema', () => {
      const schema = schemaManager.getAIResponseSchema();
      
      expect(schema.properties.reasoning).toBeDefined();
      expect(schema.properties.reasoning.type).toBe('string');
      expect(schema.properties.reasoning.description).toContain('decision-making process');
    });

    test('should include confidence property in schema', () => {
      const schema = schemaManager.getAIResponseSchema();
      
      expect(schema.properties.confidence).toBeDefined();
      expect(schema.properties.confidence.type).toBe('integer');
      expect(schema.properties.confidence.minimum).toBe(0);
      expect(schema.properties.confidence.maximum).toBe(100);
    });

    test('should include flowControl property in schema', () => {
      const schema = schemaManager.getAIResponseSchema();
      
      expect(schema.properties.flowControl).toBeDefined();
      expect(schema.properties.flowControl.type).toBe('string');
      expect(schema.properties.flowControl.enum).toEqual(['continue', 'stop_success', 'stop_failure']);
    });
  });

  describe('Executor Action Schema', () => {
    test('should include all executor commands', () => {
      const schema = schemaManager.getAIResponseSchema();
      const actionSchema = schema.properties.action;
      
      expect(actionSchema.properties.command.enum).toContain('OPEN_PAGE');
      expect(actionSchema.properties.command.enum).toContain('CLICK_ELEMENT');
      expect(actionSchema.properties.command.enum).toContain('INPUT_TEXT');
      expect(actionSchema.properties.command.enum).toContain('GET_SUBDOM');
    });

    test('should include parameters property', () => {
      const schema = schemaManager.getAIResponseSchema();
      const actionSchema = schema.properties.action;
      
      expect(actionSchema.properties.parameters).toBeDefined();
      expect(actionSchema.properties.parameters.type).toBe('object');
      expect(actionSchema.properties.parameters.properties.url).toBeDefined();
      expect(actionSchema.properties.parameters.properties.selector).toBeDefined();
      expect(actionSchema.properties.parameters.properties.text).toBeDefined();
    });

    test('should have proper parameter descriptions', () => {
      const schema = schemaManager.getAIResponseSchema();
      const paramSchema = schema.properties.action.properties.parameters.properties;
      
      expect(paramSchema.url.description).toContain('OPEN_PAGE');
      expect(paramSchema.selector.description).toContain('CSS selector');
      expect(paramSchema.text.description).toContain('INPUT_TEXT');
    });
  });

  describe('Schema Structure Validation', () => {
    test('should produce valid JSON schema structure', () => {
      const schema = schemaManager.getAIResponseSchema();
      
      // Test that schema has all required JSON Schema properties
      expect(typeof schema.type).toBe('string');
      expect(Array.isArray(schema.required)).toBe(true);
      expect(typeof schema.properties).toBe('object');
      
      // Test nested structure
      expect(typeof schema.properties.action.type).toBe('string');
      expect(Array.isArray(schema.properties.action.required)).toBe(true);
      expect(typeof schema.properties.action.properties).toBe('object');
    });

    test('should be serializable to JSON', () => {
      const schema = schemaManager.getAIResponseSchema();
      
      expect(() => JSON.stringify(schema)).not.toThrow();
      
      const jsonString = JSON.stringify(schema);
      const parsed = JSON.parse(jsonString);
      
      expect(parsed).toEqual(schema);
    });
  });

  describe('Example Response Compatibility', () => {
    test('should be compatible with open page example', () => {
      const schema = schemaManager.getAIResponseSchema();
      const example = EXAMPLE_RESPONSES.openPage;
      
      // Basic structure checks - the schema should accommodate the example
      expect(example.action).toBeDefined();
      expect(example.reasoning).toBeDefined();
      expect(example.confidence).toBeDefined();
      expect(example.flowControl).toBeDefined();
      
      expect(schema.properties.flowControl.enum).toContain(example.flowControl);
      expect(schema.properties.action.properties.command.enum).toContain(example.action.command);
    });

    test('should be compatible with click element example', () => {
      const schema = schemaManager.getAIResponseSchema();
      const example = EXAMPLE_RESPONSES.clickElement;
      
      expect(schema.properties.flowControl.enum).toContain(example.flowControl);
      expect(schema.properties.action.properties.command.enum).toContain(example.action.command);
    });

    test('should be compatible with input text example', () => {
      const schema = schemaManager.getAIResponseSchema();
      const example = EXAMPLE_RESPONSES.inputText;
      
      expect(schema.properties.flowControl.enum).toContain(example.flowControl);
      expect(schema.properties.action.properties.command.enum).toContain(example.action.command);
    });

    test('should be compatible with get subdom example', () => {
      const schema = schemaManager.getAIResponseSchema();
      const example = EXAMPLE_RESPONSES.getSubDom;
      
      expect(schema.properties.flowControl.enum).toContain(example.flowControl);
      expect(schema.properties.action.properties.command.enum).toContain(example.action.command);
    });

    test('should be compatible with stop success example', () => {
      const schema = schemaManager.getAIResponseSchema();
      const example = EXAMPLE_RESPONSES.stopSuccess;
      
      expect(schema.properties.flowControl.enum).toContain(example.flowControl);
      // Stop success should not have action
      expect(example.action).toBeUndefined();
    });

    test('should be compatible with stop failure example', () => {
      const schema = schemaManager.getAIResponseSchema();
      const example = EXAMPLE_RESPONSES.stopFailure;
      
      expect(schema.properties.flowControl.enum).toContain(example.flowControl);
      // Stop failure should not have action
      expect(example.action).toBeUndefined();
    });
  });

  describe('Factory Function', () => {
    test('should create schema manager with factory', () => {
      const manager = createAISchemaManager();
      
      expect(manager).toBeDefined();
      expect(manager).toBeInstanceOf(AISchemaManager);
      expect(typeof manager.getAIResponseSchema).toBe('function');
    });

    test('should produce consistent schemas', () => {
      const manager1 = createAISchemaManager();
      const manager2 = createAISchemaManager();
      
      const schema1 = manager1.getAIResponseSchema();
      const schema2 = manager2.getAIResponseSchema();
      
      expect(schema1).toEqual(schema2);
    });
  });
});
