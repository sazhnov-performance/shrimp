/**
 * Command Schema Builder Tests
 */

import { CommandSchemaBuilder } from '../../../src/modules/ai-schema-manager/command-schema-builder';
import { CommandAction } from '../../../types/shared-types';

describe('CommandSchemaBuilder', () => {
  let builder: CommandSchemaBuilder;

  beforeEach(() => {
    builder = new CommandSchemaBuilder();
  });

  describe('Command Schema Building', () => {
    test('should build command schema', () => {
      const schema = builder.buildCommandSchema();
      
      expect(schema.type).toBe('object');
      expect(schema.properties.action).toBeDefined();
      expect(schema.properties.parameters).toBeDefined();
      expect(schema.required).toContain('action');
      expect(schema.required).toContain('parameters');
    });

    test('should build command action schema with all actions', () => {
      const schema = builder.buildCommandActionSchema();
      
      expect(schema.enum).toContain('OPEN_PAGE');
      expect(schema.enum).toContain('CLICK_ELEMENT');
      expect(schema.enum).toContain('INPUT_TEXT');
      expect(schema.enum).toContain('SAVE_VARIABLE');
      expect(schema.enum).toContain('GET_DOM');
    });

    test('should build automation command schemas', () => {
      const schemas = builder.buildAutomationCommandSchemas();
      
      expect(schemas.OPEN_PAGE).toBeDefined();
      expect(schemas.CLICK_ELEMENT).toBeDefined();
      expect(schemas.INPUT_TEXT).toBeDefined();
      expect(schemas.SAVE_VARIABLE).toBeDefined();
      expect(schemas.GET_DOM).toBeDefined();
    });
  });

  describe('Command Validation', () => {
    test('should validate valid command action', () => {
      expect(builder.isValidCommandAction('OPEN_PAGE')).toBe(true);
      expect(builder.isValidCommandAction('INVALID_ACTION')).toBe(false);
    });

    test('should get required parameters for action', () => {
      const required = builder.getRequiredParametersForAction(CommandAction.OPEN_PAGE);
      expect(required).toContain('url');
      
      const inputRequired = builder.getRequiredParametersForAction(CommandAction.INPUT_TEXT);
      expect(inputRequired).toContain('selector');
      expect(inputRequired).toContain('text');
    });

    test('should validate parameters for action', () => {
      const validation = builder.validateParametersForAction(
        CommandAction.OPEN_PAGE,
        { url: 'https://example.com' }
      );
      
      expect(validation.valid).toBe(true);
      expect(validation.missingRequired).toHaveLength(0);
      
      const invalidValidation = builder.validateParametersForAction(
        CommandAction.OPEN_PAGE,
        {}
      );
      
      expect(invalidValidation.valid).toBe(false);
      expect(invalidValidation.missingRequired).toContain('url');
    });
  });

  describe('Selector Validation', () => {
    test('should validate valid selectors', () => {
      const validation = builder.validateSelectorFormat('input[name="username"]');
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should detect invalid selectors', () => {
      const validation = builder.validateSelectorFormat('');
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('should warn about complex selectors', () => {
      const validation = builder.validateSelectorFormat('div > ul > li > a > span > strong');
      
      expect(validation.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('URL Validation', () => {
    test('should validate valid URLs', () => {
      const validation = builder.validateUrlFormat('https://example.com');
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should detect invalid URLs', () => {
      const validation = builder.validateUrlFormat('not-a-url');
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('should warn about HTTP URLs', () => {
      const validation = builder.validateUrlFormat('http://example.com');
      
      expect(validation.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Variable Name Validation', () => {
    test('should validate valid variable names', () => {
      const validation = builder.validateVariableNameFormat('username');
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should detect invalid variable names', () => {
      const validation = builder.validateVariableNameFormat('123invalid');
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('should detect reserved words', () => {
      const validation = builder.validateVariableNameFormat('window');
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(error => error.includes('reserved'))).toBe(true);
    });
  });
});
