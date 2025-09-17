/**
 * Template Manager Tests
 * Unit tests for the template management functionality
 */

import { TemplateManager } from '../../../src/modules/ai-prompt-manager/template-manager';
import { TemplateConfig, TEMPLATE_IDS } from '../../../src/modules/ai-prompt-manager/types';

describe('TemplateManager', () => {
  let templateManager: TemplateManager;
  let config: TemplateConfig;

  beforeEach(() => {
    config = {
      enableCustomTemplates: true,
      templateCacheEnabled: true,
      templateValidationEnabled: true,
      fallbackToDefault: true
    };
    templateManager = new TemplateManager(config);
  });

  describe('initialization', () => {
    it('should initialize with default templates', () => {
      const collection = templateManager.getTemplateCollection();

      expect(collection.systemMessageTemplate).toBeDefined();
      expect(collection.actionPromptTemplate).toBeDefined();
      expect(collection.reflectionPromptTemplate).toBeDefined();
      expect(collection.validationPromptTemplate).toBeDefined();
      expect(collection.contextTemplate).toBeDefined();
      expect(collection.schemaTemplate).toBeDefined();
    });

    it('should get enhanced template collection with investigation templates', () => {
      const enhanced = templateManager.getEnhancedTemplateCollection();

      expect(enhanced.investigationInitialAssessmentTemplate).toBeDefined();
      expect(enhanced.investigationFocusedExplorationTemplate).toBeDefined();
      expect(enhanced.investigationSelectorDeterminationTemplate).toBeDefined();
      expect(enhanced.actionWithInvestigationTemplate).toBeDefined();
      expect(enhanced.workingMemoryTemplate).toBeDefined();
    });
  });

  describe('template retrieval', () => {
    it('should get existing template by ID', () => {
      const template = templateManager.getTemplate(TEMPLATE_IDS.SYSTEM_MESSAGE);

      expect(template).toBeDefined();
      expect(template.templateId).toBe(TEMPLATE_IDS.SYSTEM_MESSAGE);
      expect(template.name).toBe('System Message');
      expect(template.template).toContain('AI web browser agent');
    });

    it('should throw error for non-existent template when fallback disabled', () => {
      config.fallbackToDefault = false;
      templateManager = new TemplateManager(config);

      expect(() => {
        templateManager.getTemplate('non-existent-template');
      }).toThrow('Template not found: non-existent-template');
    });

    it('should return fallback template when enabled', () => {
      const template = templateManager.getTemplate('non-existent-template');

      expect(template).toBeDefined();
      expect(template.templateId).toBe('non-existent-template');
      expect(template.name).toContain('Fallback Template');
      expect(template.version).toContain('fallback');
    });
  });

  describe('template updating', () => {
    it('should update existing template', () => {
      const updatedTemplate = {
        templateId: TEMPLATE_IDS.SYSTEM_MESSAGE,
        name: 'Updated System Message',
        description: 'Updated description',
        template: 'Updated template content',
        variables: [],
        version: '2.0.0',
        lastModified: new Date()
      };

      expect(() => {
        templateManager.updateTemplate(TEMPLATE_IDS.SYSTEM_MESSAGE, updatedTemplate);
      }).not.toThrow();

      const retrieved = templateManager.getTemplate(TEMPLATE_IDS.SYSTEM_MESSAGE);
      expect(retrieved.name).toBe('Updated System Message');
      expect(retrieved.template).toBe('Updated template content');
    });

    it('should validate template when validation enabled', () => {
      const invalidTemplate = {
        templateId: '',
        name: '',
        description: 'Invalid template',
        template: '',
        variables: [],
        version: '1.0.0',
        lastModified: new Date()
      };

      expect(() => {
        templateManager.updateTemplate('invalid', invalidTemplate);
      }).toThrow();
    });

    it('should skip validation when disabled', () => {
      config.templateValidationEnabled = false;
      templateManager = new TemplateManager(config);

      const invalidTemplate = {
        templateId: '',
        name: '',
        description: 'Invalid template',
        template: '',
        variables: [],
        version: '1.0.0',
        lastModified: new Date()
      };

      expect(() => {
        templateManager.updateTemplate('test', invalidTemplate);
      }).not.toThrow();
    });
  });

  describe('template rendering', () => {
    it('should render simple variable substitution', async () => {
      const template = {
        templateId: 'test-template',
        name: 'Test Template',
        description: 'Test template',
        template: 'Hello {{name}}, welcome to {{site}}!',
        variables: [
          { name: 'name', type: 'string' as const, required: true, description: 'User name' },
          { name: 'site', type: 'string' as const, required: true, description: 'Site name' }
        ],
        version: '1.0.0',
        lastModified: new Date()
      };

      const variables = { name: 'John', site: 'TestSite' };
      const result = await templateManager.renderTemplate(template, variables);

      expect(result).toBe('Hello John, welcome to TestSite!');
    });

    it('should render conditional blocks', async () => {
      const template = {
        templateId: 'conditional-template',
        name: 'Conditional Template',
        description: 'Template with conditionals',
        template: 'Start{{#if showExtra}} - Extra content{{/if}} End',
        variables: [
          { name: 'showExtra', type: 'boolean' as const, required: false, description: 'Show extra content' }
        ],
        version: '1.0.0',
        lastModified: new Date()
      };

      const withExtra = await templateManager.renderTemplate(template, { showExtra: true });
      expect(withExtra).toBe('Start - Extra content End');

      const withoutExtra = await templateManager.renderTemplate(template, { showExtra: false });
      expect(withoutExtra).toBe('Start End');
    });

    it('should render each loops', async () => {
      const template = {
        templateId: 'loop-template',
        name: 'Loop Template',
        description: 'Template with loops',
        template: 'Items: {{#each items}}{{this}}, {{/each}}',
        variables: [
          { name: 'items', type: 'array' as const, required: true, description: 'List of items' }
        ],
        version: '1.0.0',
        lastModified: new Date()
      };

      const variables = { items: ['apple', 'banana', 'cherry'] };
      const result = await templateManager.renderTemplate(template, variables);

      expect(result).toBe('Items: apple, banana, cherry, ');
    });

    it('should render object properties in loops', async () => {
      const template = {
        templateId: 'object-loop-template',
        name: 'Object Loop Template',
        description: 'Template with object loops',
        template: 'Users: {{#each users}}{{name}} ({{age}}), {{/each}}',
        variables: [
          { name: 'users', type: 'array' as const, required: true, description: 'List of users' }
        ],
        version: '1.0.0',
        lastModified: new Date()
      };

      const variables = {
        users: [
          { name: 'Alice', age: 30 },
          { name: 'Bob', age: 25 }
        ]
      };
      const result = await templateManager.renderTemplate(template, variables);

      expect(result).toBe('Users: Alice (30), Bob (25), ');
    });

    it('should handle missing variables gracefully', async () => {
      const template = {
        templateId: 'missing-vars-template',
        name: 'Missing Variables Template',
        description: 'Template with missing variables',
        template: 'Hello {{name}}, your score is {{score}}',
        variables: [
          { name: 'name', type: 'string' as const, required: true, description: 'User name' },
          { name: 'score', type: 'number' as const, required: false, description: 'User score' }
        ],
        version: '1.0.0',
        lastModified: new Date()
      };

      const variables = { name: 'Alice' }; // Missing score
      const result = await templateManager.renderTemplate(template, variables);

      expect(result).toBe('Hello Alice, your score is {{score}}'); // Unmatched variables remain
    });
  });

  describe('template validation', () => {
    it('should validate required variables', () => {
      const template = {
        templateId: 'validation-template',
        name: 'Validation Template',
        description: 'Template for validation testing',
        template: 'Required: {{required}}, Optional: {{optional}}',
        variables: [
          { name: 'required', type: 'string' as const, required: true, description: 'Required var' },
          { name: 'optional', type: 'string' as const, required: false, description: 'Optional var' }
        ],
        version: '1.0.0',
        lastModified: new Date()
      };

      // Should pass with required variable
      expect(templateManager.validateTemplateVariables(template, { required: 'test' })).toBe(true);

      // Should fail without required variable
      expect(templateManager.validateTemplateVariables(template, { optional: 'test' })).toBe(false);

      // Should pass with both
      expect(templateManager.validateTemplateVariables(template, { 
        required: 'test', 
        optional: 'test' 
      })).toBe(true);
    });

    it('should validate variable types', () => {
      const template = {
        templateId: 'type-validation-template',
        name: 'Type Validation Template',
        description: 'Template for type validation',
        template: 'String: {{str}}, Number: {{num}}, Boolean: {{bool}}',
        variables: [
          { name: 'str', type: 'string' as const, required: true, description: 'String var' },
          { name: 'num', type: 'number' as const, required: true, description: 'Number var' },
          { name: 'bool', type: 'boolean' as const, required: true, description: 'Boolean var' }
        ],
        version: '1.0.0',
        lastModified: new Date()
      };

      // Valid types
      expect(templateManager.validateTemplateVariables(template, {
        str: 'hello',
        num: 42,
        bool: true
      })).toBe(true);

      // Invalid types
      expect(templateManager.validateTemplateVariables(template, {
        str: 123, // Should be string
        num: 42,
        bool: true
      })).toBe(false);
    });

    it('should get required variables list', () => {
      const template = {
        templateId: 'required-vars-template',
        name: 'Required Variables Template',
        description: 'Template with required variables',
        template: 'Test template',
        variables: [
          { name: 'required1', type: 'string' as const, required: true, description: 'Required 1' },
          { name: 'optional1', type: 'string' as const, required: false, description: 'Optional 1' },
          { name: 'required2', type: 'number' as const, required: true, description: 'Required 2' }
        ],
        version: '1.0.0',
        lastModified: new Date()
      };

      const required = templateManager.getRequiredVariables(template);

      expect(required).toEqual(['required1', 'required2']);
    });
  });

  describe('template compilation', () => {
    beforeEach(() => {
      config.templateCacheEnabled = true;
      templateManager = new TemplateManager(config);
    });

    it('should precompile template', () => {
      const template = {
        templateId: 'compile-test',
        name: 'Compile Test',
        description: 'Template for compilation testing',
        template: 'Hello {{name}}!',
        variables: [
          { name: 'name', type: 'string' as const, required: true, description: 'Name' }
        ],
        version: '1.0.0',
        lastModified: new Date()
      };

      const compiled = templateManager.precompileTemplate(template);

      expect(compiled).toBeDefined();
      expect(compiled.templateId).toBe('compile-test');
      expect(compiled.requiredVariables).toEqual(['name']);
      expect(compiled.compiledFunction).toBeInstanceOf(Function);
      expect(compiled.compiledAt).toBeInstanceOf(Date);
    });

    it('should use compiled template for rendering', async () => {
      const template = {
        templateId: 'cached-render-test',
        name: 'Cached Render Test',
        description: 'Template for cached rendering',
        template: 'Cached: {{value}}',
        variables: [
          { name: 'value', type: 'string' as const, required: true, description: 'Value' }
        ],
        version: '1.0.0',
        lastModified: new Date()
      };

      // First render should compile and cache
      const result1 = await templateManager.renderTemplate(template, { value: 'test1' });
      expect(result1).toBe('Cached: test1');

      // Second render should use cached compilation
      const result2 = await templateManager.renderTemplate(template, { value: 'test2' });
      expect(result2).toBe('Cached: test2');
    });
  });

  describe('investigation templates', () => {
    it('should have proper initial assessment template', () => {
      const template = templateManager.getTemplate(TEMPLATE_IDS.INVESTIGATION_INITIAL);

      expect(template).toBeDefined();
      expect(template.name).toBe('Investigation Initial Assessment');
      expect(template.template).toContain('Initial Assessment');
      expect(template.template).toContain('OBJECTIVE');
      expect(template.template).toContain('high-level understanding');
    });

    it('should have proper focused exploration template', () => {
      const template = templateManager.getTemplate(TEMPLATE_IDS.INVESTIGATION_FOCUSED);

      expect(template).toBeDefined();
      expect(template.name).toBe('Investigation Focused Exploration');
      expect(template.template).toContain('Focused Exploration');
      expect(template.template).toContain('detailed exploration');
    });

    it('should have proper selector determination template', () => {
      const template = templateManager.getTemplate(TEMPLATE_IDS.INVESTIGATION_SELECTOR);

      expect(template).toBeDefined();
      expect(template.name).toBe('Investigation Selector Determination');
      expect(template.template).toContain('Selector Determination');
      expect(template.template).toContain('optimal selectors');
    });

    it('should have proper action with investigation template', () => {
      const template = templateManager.getTemplate(TEMPLATE_IDS.ACTION_WITH_INVESTIGATION);

      expect(template).toBeDefined();
      expect(template.name).toBe('Action with Investigation Context');
      expect(template.template).toContain('INVESTIGATION CONTEXT');
      expect(template.template).toContain('investigations completed');
    });
  });
});
