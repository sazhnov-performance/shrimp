/**
 * Unit tests for AI Schema Manager module
 */

import AISchemaManager from '../index';
import { IAISchemaManager, AISchemaManagerConfig, AIResponseSchema } from '../types';
import { AI_RESPONSE_SCHEMA, EXECUTOR_ACTION_SCHEMA } from '../schemas';

describe('AISchemaManager', () => {
  let schemaManager: IAISchemaManager;

  beforeEach(() => {
    // Reset singleton instance for each test
    (AISchemaManager as any).instance = null;
    schemaManager = AISchemaManager.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = AISchemaManager.getInstance();
      const instance2 = AISchemaManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should accept configuration on first instantiation', () => {
      (AISchemaManager as any).instance = null;
      
      const config: AISchemaManagerConfig = {
        schemaVersion: '2.0',
        validationEnabled: false,
        cacheSchemas: false
      };
      
      const instance = AISchemaManager.getInstance(config);
      expect(instance).toBeDefined();
      expect((instance as any).config.schemaVersion).toBe('2.0');
    });
  });

  describe('getAIResponseSchema', () => {
    let schema: AIResponseSchema;

    beforeEach(() => {
      schema = schemaManager.getAIResponseSchema();
    });

    it('should return a valid JSON schema object', () => {
      expect(schema).toBeDefined();
      expect(schema.type).toBe('object');
      expect(schema.required).toEqual(['reasoning', 'confidence', 'flowControl']);
      expect(schema.properties).toBeDefined();
    });

    it('should include action property with executor action schema', () => {
      expect(schema.properties.action).toBeDefined();
      expect(schema.properties.action.type).toBe('object');
      expect(schema.properties.action.required).toEqual(['command', 'parameters']);
      expect(schema.properties.action.description).toContain('required only when flowControl is \'continue\'');
    });

    it('should include reasoning property', () => {
      expect(schema.properties.reasoning).toBeDefined();
      expect(schema.properties.reasoning.type).toBe('string');
      expect(schema.properties.reasoning.description).toContain('decision-making process');
    });

    it('should include confidence property as string', () => {
      expect(schema.properties.confidence).toBeDefined();
      expect(schema.properties.confidence.type).toBe('string');
      expect(schema.properties.confidence.description).toBeDefined();
    });

    it('should include flowControl property with valid enum values', () => {
      expect(schema.properties.flowControl).toBeDefined();
      expect(schema.properties.flowControl.type).toBe('string');
      expect(schema.properties.flowControl.enum).toEqual([
        'continue', 
        'stop_success', 
        'stop_failure'
      ]);
    });
  });

  describe('Executor Action Schema Validation', () => {
    let actionSchema: AIResponseSchema['properties']['action'];

    beforeEach(() => {
      const fullSchema = schemaManager.getAIResponseSchema();
      actionSchema = fullSchema.properties.action;
    });

    it('should include all four core commands', () => {
      const expectedCommands = [
        'OPEN_PAGE',
        'CLICK_ELEMENT',
        'INPUT_TEXT',
        'GET_SUBDOM'
      ];
      
      expect(actionSchema.properties.command.enum).toEqual(expectedCommands);
    });

    it('should include parameters object with url, selector, and text properties', () => {
      const parametersSchema = actionSchema.properties.parameters;
      
      expect(parametersSchema).toBeDefined();
      expect(parametersSchema.type).toBe('object');
      expect(parametersSchema.properties.url).toBeDefined();
      expect(parametersSchema.properties.selector).toBeDefined();
      expect(parametersSchema.properties.text).toBeDefined();
    });

    it('should have string type for all parameter properties', () => {
      const parametersSchema = actionSchema.properties.parameters;
      
      expect(parametersSchema.properties.url.type).toBe('string');
      expect(parametersSchema.properties.selector.type).toBe('string');
      expect(parametersSchema.properties.text.type).toBe('string');
    });
  });

  describe('Schema Format Compliance', () => {
    it('should match the exported AI_RESPONSE_SCHEMA structure', () => {
      const generatedSchema = schemaManager.getAIResponseSchema();
      
      expect(generatedSchema.type).toBe(AI_RESPONSE_SCHEMA.type);
      expect(generatedSchema.required).toEqual(AI_RESPONSE_SCHEMA.required);
      expect(generatedSchema.properties.reasoning.type).toBe(AI_RESPONSE_SCHEMA.properties.reasoning.type);
      expect(generatedSchema.properties.confidence.type).toBe(AI_RESPONSE_SCHEMA.properties.confidence.type);
      expect(generatedSchema.properties.flowControl.enum).toEqual(AI_RESPONSE_SCHEMA.properties.flowControl.enum);
    });

    it('should match the exported EXECUTOR_ACTION_SCHEMA structure', () => {
      const fullSchema = schemaManager.getAIResponseSchema();
      const actionSchema = fullSchema.properties.action;
      
      expect(actionSchema.type).toBe(EXECUTOR_ACTION_SCHEMA.type);
      expect(actionSchema.required).toEqual(EXECUTOR_ACTION_SCHEMA.required);
      expect(actionSchema.properties.command.enum).toEqual(EXECUTOR_ACTION_SCHEMA.properties.command.enum);
    });
  });

  describe('Usage Examples Validation', () => {
    let schema: AIResponseSchema;

    beforeEach(() => {
      schema = schemaManager.getAIResponseSchema();
    });

    it('should validate OPEN_PAGE example structure', () => {
      const openPageExample = {
        action: {
          command: 'OPEN_PAGE',
          parameters: {
            url: 'https://example.com/login'
          }
        },
        reasoning: 'Starting automation by navigating to the login page.',
        confidence: 'HIGH',
        flowControl: 'continue'
      };

      // Validate command is in enum
      expect(schema.properties.action.properties.command.enum).toContain('OPEN_PAGE');
      
      // Validate required fields are present
      schema.required.forEach((field: string) => {
        expect(openPageExample).toHaveProperty(field);
      });
    });

    it('should validate CLICK_ELEMENT example structure', () => {
      const clickExample = {
        action: {
          command: 'CLICK_ELEMENT',
          parameters: {
            selector: 'button[data-testid="submit-btn"]'
          }
        },
        reasoning: 'Located submit button using test ID attribute for reliability.',
        confidence: 'HIGH',
        flowControl: 'continue'
      };

      expect(schema.properties.action.properties.command.enum).toContain('CLICK_ELEMENT');
      schema.required.forEach((field: string) => {
        expect(clickExample).toHaveProperty(field);
      });
    });

    it('should validate INPUT_TEXT example structure', () => {
      const inputExample = {
        action: {
          command: 'INPUT_TEXT',
          parameters: {
            selector: 'input[name="email"]',
            text: 'user@example.com'
          }
        },
        reasoning: 'Filling email field with provided credentials.',
        confidence: 'HIGH',
        flowControl: 'continue'
      };

      expect(schema.properties.action.properties.command.enum).toContain('INPUT_TEXT');
      schema.required.forEach((field: string) => {
        expect(inputExample).toHaveProperty(field);
      });
    });

    it('should validate GET_SUBDOM example structure', () => {
      const subdomExample = {
        action: {
          command: 'GET_SUBDOM',
          parameters: {
            selector: '.error-messages'
          }
        },
        reasoning: 'Need to examine error messages to understand validation failures.',
        confidence: 'HIGH',
        flowControl: 'continue'
      };

      expect(schema.properties.action.properties.command.enum).toContain('GET_SUBDOM');
      schema.required.forEach((field: string) => {
        expect(subdomExample).toHaveProperty(field);
      });
    });

    it('should validate stop_success example structure (no action required)', () => {
      const stopSuccessExample: {
        reasoning: string;
        confidence: string;
        flowControl: string;
        action?: any;
      } = {
        reasoning: 'Successfully completed all automation steps. Login form filled and submitted, confirmation page loaded.',
        confidence: 'HIGH',
        flowControl: 'stop_success'
      };

      expect(schema.properties.flowControl.enum).toContain('stop_success');
      // Action is not required when flowControl is stop_success
      expect(stopSuccessExample.action).toBeUndefined();
    });

    it('should validate stop_failure example structure (no action required)', () => {
      const stopFailureExample: {
        reasoning: string;
        confidence: string;
        flowControl: string;
        action?: any;
      } = {
        reasoning: 'Unable to locate expected elements after multiple attempts. Page structure may have changed.',
        confidence: 'HIGH',
        flowControl: 'stop_failure'
      };

      expect(schema.properties.flowControl.enum).toContain('stop_failure');
      // Action is not required when flowControl is stop_failure
      expect(stopFailureExample.action).toBeUndefined();
    });
  });

  describe('Image Analysis Schema', () => {
    let schemaManager: any;

    beforeEach(() => {
      schemaManager = AISchemaManager.getInstance();
    });

    it('should return a valid image analysis schema object', () => {
      const schema = schemaManager.getImageAnalysisSchema();
      
      expect(schema).toBeDefined();
      expect(schema.type).toBe('object');
      expect(schema.required).toContain('overallDescription');
      expect(schema.required).toContain('interactibleElements');
    });

    it('should include overallDescription property', () => {
      const schema = schemaManager.getImageAnalysisSchema();
      
      expect(schema.properties.overallDescription).toBeDefined();
      expect(schema.properties.overallDescription.type).toBe('string');
      expect(schema.properties.overallDescription.description).toContain('Overall description');
    });

    it('should include interactibleElements array property', () => {
      const schema = schemaManager.getImageAnalysisSchema();
      
      expect(schema.properties.interactibleElements).toBeDefined();
      expect(schema.properties.interactibleElements.type).toBe('array');
      expect(schema.properties.interactibleElements.items).toBeDefined();
    });

    it('should define interactible element structure correctly', () => {
      const schema = schemaManager.getImageAnalysisSchema();
      const elementSchema = schema.properties.interactibleElements.items;
      
      expect(elementSchema.type).toBe('object');
      expect(elementSchema.required).toContain('type');
      expect(elementSchema.required).toContain('description');
      expect(elementSchema.required).toContain('location');
      
      expect(elementSchema.properties.type).toBeDefined();
      expect(elementSchema.properties.description).toBeDefined();
      expect(elementSchema.properties.location).toBeDefined();
      expect(elementSchema.properties.suggestedSelector).toBeDefined();
    });

    it('should include valid element types in enum', () => {
      const schema = schemaManager.getImageAnalysisSchema();
      const elementSchema = schema.properties.interactibleElements.items;
      const typeProperty = elementSchema.properties.type;
      
      expect(typeProperty.enum).toContain('button');
      expect(typeProperty.enum).toContain('link');
      expect(typeProperty.enum).toContain('input');
      expect(typeProperty.enum).toContain('select');
      expect(typeProperty.enum).toContain('checkbox');
      expect(typeProperty.enum).toContain('radio');
      expect(typeProperty.enum).toContain('textarea');
      expect(typeProperty.enum).toContain('image');
      expect(typeProperty.enum).toContain('menu');
      expect(typeProperty.enum).toContain('other');
    });

    it('should validate example image analysis response', () => {
      const exampleResponse = {
        overallDescription: "Login page with form fields and submit button",
        interactibleElements: [
          {
            type: "input",
            description: "Username input field",
            location: "center-left of form",
            suggestedSelector: "input[name='username']"
          },
          {
            type: "button",
            description: "Submit login button",
            location: "bottom of form"
          }
        ]
      };

      expect(exampleResponse).toHaveProperty('overallDescription');
      expect(exampleResponse).toHaveProperty('interactibleElements');
      expect(Array.isArray(exampleResponse.interactibleElements)).toBe(true);
      expect(exampleResponse.interactibleElements[0]).toHaveProperty('type');
      expect(exampleResponse.interactibleElements[0]).toHaveProperty('description');
      expect(exampleResponse.interactibleElements[0]).toHaveProperty('location');
    });
  });
});
