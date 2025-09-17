/**
 * AI Schema Manager Tests
 * Comprehensive unit tests for the AI Schema Manager module
 */

import { AISchemaManagerImpl, createAISchemaManager } from '../../../src/modules/ai-schema-manager';
import { ScreenshotAnalysisType } from '../../../src/modules/ai-schema-manager/types';

describe('AI Schema Manager', () => {
  let schemaManager: AISchemaManagerImpl;

  beforeEach(() => {
    schemaManager = new AISchemaManagerImpl();
  });

  afterEach(async () => {
    await schemaManager.destroy();
  });

  describe('Schema Generation', () => {
    test('should generate response schema with default options', async () => {
      const schema = await schemaManager.generateResponseSchema();
      
      expect(schema).toBeDefined();
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.properties.decision).toBeDefined();
      expect(schema.properties.reasoning).toBeDefined();
      expect(schema.required).toContain('decision');
      expect(schema.required).toContain('reasoning');
    });

    test('should generate response schema with custom options', async () => {
      const schema = await schemaManager.generateResponseSchema({
        requireReasoning: false,
        validationMode: 'lenient'
      });
      
      expect(schema).toBeDefined();
      expect(schema.additionalProperties).toBe(true);
      expect(schema.required).not.toContain('reasoning');
    });

    test('should generate screenshot analysis schema', async () => {
      const schema = await schemaManager.generateScreenshotAnalysisSchema(
        ScreenshotAnalysisType.ELEMENT_DETECTION
      );
      
      expect(schema).toBeDefined();
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.properties.analysisType).toBeDefined();
      expect(schema.properties.summary).toBeDefined();
      expect(schema.properties.confidence).toBeDefined();
    });

    test('should generate screenshot comparison schema', async () => {
      const schema = await schemaManager.generateScreenshotComparisonSchema();
      
      expect(schema).toBeDefined();
      expect(schema.type).toBe('object');
      expect(schema.properties.similarity).toBeDefined();
      expect(schema.properties.differences).toBeDefined();
      expect(schema.properties.significantChanges).toBeDefined();
    });
  });

  describe('Response Validation', () => {
    test('should validate valid AI response', async () => {
      const schema = await schemaManager.generateResponseSchema();
      const response = {
        decision: {
          action: 'PROCEED',
          message: 'Login form found, proceeding to enter credentials',
          resultValidation: {
            success: true,
            expectedElements: ['input[name="username"]'],
            actualState: 'Login page loaded successfully'
          }
        },
        reasoning: {
          analysis: 'The page has loaded successfully and contains the expected login form.',
          rationale: 'All required elements are present and accessible.',
          expectedOutcome: 'Username will be entered successfully.'
        },
        command: {
          action: 'INPUT_TEXT',
          parameters: {
            selector: 'input[name="username"]',
            text: 'testuser'
          }
        }
      };

      const result = await schemaManager.validateAIResponse(response, schema);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.executorCompatible).toBe(true);
    });

    test('should detect invalid decision action', async () => {
      const schema = await schemaManager.generateResponseSchema();
      const response = {
        decision: {
          action: 'INVALID_ACTION',
          message: 'Test message'
        },
        reasoning: {
          analysis: 'Test analysis',
          rationale: 'Test rationale',
          expectedOutcome: 'Test outcome'
        }
      };

      const result = await schemaManager.validateAIResponse(response, schema);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(error => error.field.includes('action'))).toBe(true);
    });

    test('should detect missing required fields', async () => {
      const schema = await schemaManager.generateResponseSchema();
      const response = {
        decision: {
          action: 'PROCEED'
          // Missing message
        }
        // Missing reasoning
      };

      const result = await schemaManager.validateAIResponse(response, schema);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should validate screenshot analysis response', async () => {
      const schema = await schemaManager.generateScreenshotAnalysisSchema(
        ScreenshotAnalysisType.ELEMENT_DETECTION
      );
      const response = {
        analysisType: 'ELEMENT_DETECTION',
        summary: 'Detected 5 interactive elements including buttons and input fields',
        confidence: 0.92,
        visualElements: [
          {
            type: 'button',
            confidence: 0.95,
            boundingBox: { x: 100, y: 200, width: 80, height: 30 },
            interactable: true,
            text: 'Submit'
          }
        ]
      };

      const result = await schemaManager.validateScreenshotAnalysisResponse(response, schema);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Cache Management', () => {
    test('should cache generated schemas', async () => {
      // Generate same schema twice
      const schema1 = await schemaManager.generateResponseSchema();
      const schema2 = await schemaManager.generateResponseSchema();
      
      expect(schema1).toEqual(schema2);
      
      const stats = schemaManager.getCacheStats();
      expect(stats.schemaCache).toBeDefined();
    });

    test('should clear cache', async () => {
      await schemaManager.generateResponseSchema();
      let stats = schemaManager.getCacheStats();
      expect(stats.schemaCache.totalEntries).toBeGreaterThan(0);
      
      await schemaManager.clearCache();
      stats = schemaManager.getCacheStats();
      expect(stats.schemaCache.totalEntries).toBe(0);
    });
  });

  describe('Configuration', () => {
    test('should update configuration', () => {
      const newConfig = {
        schema: {
          validationMode: 'lenient' as const,
          reasoningRequired: false
        }
      };
      
      schemaManager.updateConfig(newConfig);
      const config = schemaManager.getConfig();
      
      expect(config.schema.validationMode).toBe('lenient');
      expect(config.schema.reasoningRequired).toBe(false);
    });

    test('should update schema version', () => {
      schemaManager.updateSchemaVersion('2.0.0');
      const config = schemaManager.getConfig();
      
      expect(config.schema.version).toBe('2.0.0');
    });
  });

  describe('Health Check', () => {
    test('should pass health check', async () => {
      const health = await schemaManager.healthCheck();
      
      if (!health.healthy) {
        console.log('Health check issues:', health.issues);
      }
      
      expect(health.healthy).toBe(true);
      expect(health.issues).toBeUndefined();
    });
  });

  describe('Statistics', () => {
    test('should provide module statistics', () => {
      const stats = schemaManager.getStatistics();
      
      expect(stats).toBeDefined();
      expect(stats.moduleId).toBe('ai-schema-manager');
      expect(stats.version).toBeDefined();
      expect(stats.cache).toBeDefined();
      expect(stats.performance).toBeDefined();
    });
  });

  describe('Executor Method Schemas', () => {
    test('should provide executor method schemas', () => {
      const schemas = schemaManager.getExecutorMethodSchemas();
      
      expect(schemas).toBeDefined();
      expect(schemas.commands).toBeDefined();
      expect(schemas.parameters).toBeDefined();
      expect(schemas.commands.OPEN_PAGE).toBeDefined();
      expect(schemas.commands.CLICK_ELEMENT).toBeDefined();
      expect(schemas.commands.INPUT_TEXT).toBeDefined();
    });
  });

  describe('Screenshot Analysis Schemas', () => {
    test('should provide screenshot analysis schemas', () => {
      const schemas = schemaManager.getScreenshotAnalysisSchemas();
      
      expect(schemas).toBeDefined();
      expect(schemas.CONTENT_SUMMARY).toBeDefined();
      expect(schemas.ELEMENT_DETECTION).toBeDefined();
      expect(schemas.UI_STRUCTURE).toBeDefined();
      expect(schemas.TEXT_EXTRACTION).toBeDefined();
      expect(schemas.ACCESSIBILITY_AUDIT).toBeDefined();
      expect(schemas.COMPARISON).toBeDefined();
    });
  });

  describe('Factory Function', () => {
    test('should create schema manager with factory', () => {
      const manager = createAISchemaManager({
        schema: {
          validationMode: 'lenient',
          reasoningRequired: false
        }
      });
      
      expect(manager).toBeDefined();
      expect(manager.getConfig().schema.validationMode).toBe('lenient');
    });
  });
});
