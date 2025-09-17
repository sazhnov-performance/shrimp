/**
 * Template Manager Tests
 * 
 * Unit tests for the Prompt Template Manager
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { PromptTemplateManager } from '../template-manager';
import { TemplateConfig, TEMPLATE_IDS } from '../../../../types/ai-prompt-manager';

describe('PromptTemplateManager', () => {
  let templateManager: PromptTemplateManager;
  let config: TemplateConfig;

  beforeEach(() => {
    config = {
      enableCustomTemplates: true,
      templateCacheEnabled: true,
      templateValidationEnabled: true,
      fallbackToDefault: true
    };
    templateManager = new PromptTemplateManager(config);
  });

  describe('getTemplate', () => {
    test('should return existing template', () => {
      const template = templateManager.getTemplate(TEMPLATE_IDS.SYSTEM_MESSAGE);
      
      expect(template).toBeDefined();
      expect(template.templateId).toBe(TEMPLATE_IDS.SYSTEM_MESSAGE);
      expect(template.name).toBe('System Message');
    });

    test('should return default template for unknown ID when fallback enabled', () => {
      const template = templateManager.getTemplate(TEMPLATE_IDS.INITIAL_ACTION);
      
      expect(template).toBeDefined();
      expect(template.templateId).toBe(TEMPLATE_IDS.INITIAL_ACTION);
    });

    test('should throw error for unknown template when fallback disabled', () => {
      config.fallbackToDefault = false;
      templateManager = new PromptTemplateManager(config);
      
      expect(() => templateManager.getTemplate('unknown-template')).toThrow('Template not found');
    });
  });

  describe('updateTemplate', () => {
    test('should update existing template', () => {
      const newTemplate = {
        templateId: 'test-template',
        name: 'Test Template',
        description: 'Test description',
        template: 'Hello {{name}}!',
        variables: [
          {
            name: 'name',
            type: 'string' as const,
            required: true,
            description: 'Name to greet'
          }
        ],
        version: '1.0.0',
        lastModified: new Date()
      };

      templateManager.updateTemplate('test-template', newTemplate);
      const retrieved = templateManager.getTemplate('test-template');
      
      expect(retrieved.name).toBe('Test Template');
      expect(retrieved.template).toBe('Hello {{name}}!');
    });

    test('should validate template when validation enabled', () => {
      const invalidTemplate = {
        templateId: '',
        name: '',
        description: '',
        template: '',
        variables: [],
        version: '1.0.0',
        lastModified: new Date()
      };

      expect(() => templateManager.updateTemplate('invalid', invalidTemplate))
        .toThrow('Template missing required fields');
    });

    test('should skip validation when validation disabled', () => {
      config.templateValidationEnabled = false;
      templateManager = new PromptTemplateManager(config);

      const invalidTemplate = {
        templateId: '',
        name: '',
        description: '',
        template: '',
        variables: [],
        version: '1.0.0',
        lastModified: new Date()
      };

      expect(() => templateManager.updateTemplate('invalid', invalidTemplate))
        .not.toThrow();
    });
  });

  describe('getAllTemplates', () => {
    test('should return all templates in collection format', () => {
      const templates = templateManager.getAllTemplates();
      
      expect(templates).toBeDefined();
      expect(templates.systemMessageTemplate).toBeDefined();
      expect(templates.actionPromptTemplate).toBeDefined();
      expect(templates.reflectionPromptTemplate).toBeDefined();
      expect(templates.investigationInitialAssessmentTemplate).toBeDefined();
    });
  });

  describe('validateTemplate', () => {
    test('should validate correct template', () => {
      const validTemplate = {
        templateId: 'test',
        name: 'Test',
        description: 'Test template',
        template: 'Hello {{name}}!',
        variables: [
          {
            name: 'name',
            type: 'string' as const,
            required: true,
            description: 'Name to greet'
          }
        ],
        version: '1.0.0',
        lastModified: new Date()
      };

      expect(() => templateManager.validateTemplate(validTemplate)).not.toThrow();
    });

    test('should reject template with missing required fields', () => {
      const invalidTemplate = {
        templateId: '',
        name: 'Test',
        description: 'Test template',
        template: 'Hello!',
        variables: [],
        version: '1.0.0',
        lastModified: new Date()
      };

      expect(() => templateManager.validateTemplate(invalidTemplate))
        .toThrow('Template missing required fields');
    });

    test('should reject template with invalid variable types', () => {
      const invalidTemplate = {
        templateId: 'test',
        name: 'Test',
        description: 'Test template',
        template: 'Hello {{name}}!',
        variables: [
          {
            name: 'name',
            type: 'invalid' as any,
            required: true,
            description: 'Name to greet'
          }
        ],
        version: '1.0.0',
        lastModified: new Date()
      };

      expect(() => templateManager.validateTemplate(invalidTemplate))
        .toThrow('Invalid template variable type');
    });

    test('should reject template with undefined variables in content', () => {
      const invalidTemplate = {
        templateId: 'test',
        name: 'Test',
        description: 'Test template',
        template: 'Hello {{name}} and {{unknown}}!',
        variables: [
          {
            name: 'name',
            type: 'string' as const,
            required: true,
            description: 'Name to greet'
          }
        ],
        version: '1.0.0',
        lastModified: new Date()
      };

      expect(() => templateManager.validateTemplate(invalidTemplate))
        .toThrow('Template variable \'unknown\' used in template but not defined');
    });
  });

  describe('caching', () => {
    test('should cache templates when caching enabled', () => {
      // First access
      const template1 = templateManager.getTemplate(TEMPLATE_IDS.SYSTEM_MESSAGE);
      
      // Second access (should be from cache)
      const template2 = templateManager.getTemplate(TEMPLATE_IDS.SYSTEM_MESSAGE);
      
      expect(template1).toBe(template2);
    });

    test('should clear cache when template updated', () => {
      const originalTemplate = templateManager.getTemplate(TEMPLATE_IDS.SYSTEM_MESSAGE);
      
      const updatedTemplate = {
        ...originalTemplate,
        description: 'Updated description'
      };
      
      templateManager.updateTemplate(TEMPLATE_IDS.SYSTEM_MESSAGE, updatedTemplate);
      const newTemplate = templateManager.getTemplate(TEMPLATE_IDS.SYSTEM_MESSAGE);
      
      expect(newTemplate.description).toBe('Updated description');
    });

    test('should provide cache statistics', () => {
      templateManager.getTemplate(TEMPLATE_IDS.SYSTEM_MESSAGE);
      templateManager.getTemplate(TEMPLATE_IDS.INITIAL_ACTION);
      
      const stats = templateManager.getTemplateStats();
      
      expect(stats.totalTemplates).toBeGreaterThan(0);
      expect(stats.cachedTemplates).toBeGreaterThanOrEqual(0);
      expect(typeof stats.cacheHitRate).toBe('number');
    });
  });

  describe('configuration updates', () => {
    test('should update configuration', () => {
      const newConfig: TemplateConfig = {
        enableCustomTemplates: false,
        templateCacheEnabled: false,
        templateValidationEnabled: false,
        fallbackToDefault: false
      };

      templateManager.updateConfig(newConfig);
      
      // Cache should be cleared when caching is disabled
      templateManager.clearCache();
      const stats = templateManager.getTemplateStats();
      expect(stats.cachedTemplates).toBe(0);
    });

    test('should clear cache when caching disabled', () => {
      // First get some templates to populate cache
      templateManager.getTemplate(TEMPLATE_IDS.SYSTEM_MESSAGE);
      
      // Disable caching
      templateManager.updateConfig({
        ...config,
        templateCacheEnabled: false
      });
      
      const stats = templateManager.getTemplateStats();
      expect(stats.cachedTemplates).toBe(0);
    });
  });
});
