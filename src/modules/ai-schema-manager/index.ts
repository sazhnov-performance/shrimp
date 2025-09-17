/**
 * AI Schema Manager Module
 * Main interface for AI response schema generation and validation
 * Based on design/ai-schema-manager.md specifications
 */

import {
  AISchemaManagerConfig,
  ResponseSchema,
  ScreenshotAnalysisSchema,
  ScreenshotComparisonSchema,
  ScreenshotAnalysisSchemas,
  ExecutorMethodSchemas,
  ValidationResult,
  ScreenshotAnalysisType,
  SchemaOptions,
  ScreenshotSchemaOptions,
  ComparisonSchemaOptions,
  SchemaCacheConfig
} from './types';
import { SchemaGenerator } from './schema-generator';
import { Validator } from './validator';
import { VisualValidator } from './visual-validator';
import { SchemaCache } from './schema-cache';
import { 
  BaseModuleConfig,
  LogLevel,
  DEFAULT_TIMEOUT_CONFIG
} from '../../../types/shared-types';

// Default configuration
const DEFAULT_AI_SCHEMA_MANAGER_CONFIG: AISchemaManagerConfig = {
  moduleId: 'ai-schema-manager',
  version: '1.0.0',
  enabled: true,
  
  schema: {
    version: '1.0.0',
    defaultOptions: {
      includeOptionalFields: true,
      requireReasoning: true,
      validationMode: 'strict'
    },
    cacheEnabled: true,
    validationMode: 'strict',
    reasoningRequired: true,
    screenshotAnalysisConfig: {
      enableCoordinateValidation: true,
      requireConfidenceScores: true,
      minConfidenceThreshold: 0.5,
      maxBoundingBoxSize: 100000,
      enableAccessibilityValidation: true,
      strictElementDetection: true,
      cacheAnalysisSchemas: true
    }
  },
  
  timeouts: DEFAULT_TIMEOUT_CONFIG,
  
  logging: {
    level: LogLevel.INFO,
    prefix: '[AISchemaManager]',
    includeTimestamp: true,
    includeSessionId: true,
    includeModuleId: true,
    structured: false
  },
  
  performance: {
    maxConcurrentOperations: 50,
    cacheEnabled: true,
    cacheTTLMs: 3600000, // 1 hour
    metricsEnabled: true
  }
};

/**
 * Main AI Schema Manager Interface
 */
export interface AISchemaManager {
  // Schema Generation
  generateResponseSchema(options?: SchemaOptions): Promise<ResponseSchema>;
  generateScreenshotAnalysisSchema(analysisType: ScreenshotAnalysisType, options?: ScreenshotSchemaOptions): Promise<ScreenshotAnalysisSchema>;
  generateScreenshotComparisonSchema(options?: ComparisonSchemaOptions): Promise<ScreenshotComparisonSchema>;
  
  // Validation
  validateAIResponse(response: any, schema: ResponseSchema): Promise<ValidationResult>;
  validateScreenshotAnalysisResponse(response: any, schema: ScreenshotAnalysisSchema): Promise<ValidationResult>;
  
  // Schema Access
  getExecutorMethodSchemas(): ExecutorMethodSchemas;
  getScreenshotAnalysisSchemas(): ScreenshotAnalysisSchemas;
  
  // Configuration
  updateSchemaVersion(version: string): void;
  getConfig(): AISchemaManagerConfig;
  updateConfig(config: Partial<AISchemaManagerConfig>): void;
  
  // Cache Management
  clearCache(): Promise<void>;
  getCacheStats(): any;
  
  // Health and Diagnostics
  healthCheck(): Promise<{ healthy: boolean; issues?: string[] }>;
  getStatistics(): any;
}

/**
 * AI Schema Manager Implementation
 */
export class AISchemaManagerImpl implements AISchemaManager {
  private config: AISchemaManagerConfig;
  private schemaGenerator: SchemaGenerator;
  private validator: Validator;
  private visualValidator: VisualValidator;
  private schemaCache: SchemaCache | null;

  constructor(config: Partial<AISchemaManagerConfig> = {}) {
    this.config = { ...DEFAULT_AI_SCHEMA_MANAGER_CONFIG, ...config };
    this.schemaGenerator = new SchemaGenerator(this.config.schema.version);
    this.validator = new Validator();
    this.visualValidator = new VisualValidator();
    
    // Initialize cache if enabled
    if (this.config.schema.cacheEnabled) {
      const cacheConfig: SchemaCacheConfig = {
        maxEntries: 100,
        ttlMs: this.config.performance.cacheTTLMs,
        cleanupIntervalMs: 300000,
        enableCompression: true,
        persistToDisk: false
      };
      this.schemaCache = new SchemaCache(cacheConfig);
      this.preloadCommonSchemas();
    } else {
      this.schemaCache = null;
    }
  }

  /**
   * Generate response schema for AI responses
   */
  async generateResponseSchema(options?: SchemaOptions): Promise<ResponseSchema> {
    const finalOptions = {
      ...this.config.schema.defaultOptions,
      ...options
    };

    // Check cache first
    if (this.schemaCache) {
      const cacheKey = this.schemaCache.generateKey('response', finalOptions);
      const cachedSchema = await this.schemaCache.get(cacheKey);
      if (cachedSchema) {
        return cachedSchema as ResponseSchema;
      }

      // Generate and cache
      const schema = await this.schemaGenerator.generateResponseSchema(finalOptions);
      await this.schemaCache.set(cacheKey, schema);
      return schema;
    }

    return this.schemaGenerator.generateResponseSchema(finalOptions);
  }

  /**
   * Generate screenshot analysis schema
   */
  async generateScreenshotAnalysisSchema(
    analysisType: ScreenshotAnalysisType,
    options?: ScreenshotSchemaOptions
  ): Promise<ScreenshotAnalysisSchema> {
    const finalOptions = {
      ...this.getDefaultScreenshotOptions(),
      ...options
    };

    // Check cache first
    if (this.schemaCache) {
      const cacheKey = this.schemaCache.generateKey('screenshot-analysis', { analysisType, ...finalOptions });
      const cachedSchema = await this.schemaCache.get(cacheKey);
      if (cachedSchema) {
        return cachedSchema as ScreenshotAnalysisSchema;
      }

      // Generate and cache
      const schema = await this.schemaGenerator.generateScreenshotAnalysisSchema(analysisType, finalOptions);
      await this.schemaCache.set(cacheKey, schema);
      return schema;
    }

    return this.schemaGenerator.generateScreenshotAnalysisSchema(analysisType, finalOptions);
  }

  /**
   * Generate screenshot comparison schema
   */
  async generateScreenshotComparisonSchema(
    options?: ComparisonSchemaOptions
  ): Promise<ScreenshotComparisonSchema> {
    const finalOptions = {
      includePixelDifferences: true,
      includeSimilarityScore: true,
      requireChangeDescription: true,
      includeCoordinates: true,
      validationMode: this.config.schema.validationMode,
      ...options
    } as ComparisonSchemaOptions;

    // Check cache first
    if (this.schemaCache) {
      const cacheKey = this.schemaCache.generateKey('screenshot-comparison', finalOptions);
      const cachedSchema = await this.schemaCache.get(cacheKey);
      if (cachedSchema) {
        return cachedSchema as ScreenshotComparisonSchema;
      }

      // Generate and cache
      const schema = await this.schemaGenerator.generateScreenshotComparisonSchema(finalOptions);
      await this.schemaCache.set(cacheKey, schema);
      return schema;
    }

    return this.schemaGenerator.generateScreenshotComparisonSchema(finalOptions);
  }

  /**
   * Validate AI response against schema
   */
  async validateAIResponse(response: any, schema: ResponseSchema): Promise<ValidationResult> {
    return this.validator.validateAIResponse(response, schema);
  }

  /**
   * Validate screenshot analysis response
   */
  async validateScreenshotAnalysisResponse(
    response: any,
    schema: ScreenshotAnalysisSchema
  ): Promise<ValidationResult> {
    return this.visualValidator.validateScreenshotAnalysisResponse(response, schema);
  }

  /**
   * Get executor method schemas
   */
  getExecutorMethodSchemas(): ExecutorMethodSchemas {
    return this.schemaGenerator.getExecutorMethodSchemas();
  }

  /**
   * Get screenshot analysis schemas
   */
  getScreenshotAnalysisSchemas(): ScreenshotAnalysisSchemas {
    return this.schemaGenerator.getScreenshotAnalysisSchemas();
  }

  /**
   * Update schema version
   */
  updateSchemaVersion(version: string): void {
    this.config.schema.version = version;
    this.schemaGenerator.updateSchemaVersion(version);
  }

  /**
   * Get current configuration
   */
  getConfig(): AISchemaManagerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AISchemaManagerConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Update cache configuration if cache settings changed
    if (this.schemaCache && config.performance?.cacheTTLMs) {
      this.schemaCache.updateConfig({ ttlMs: config.performance.cacheTTLMs });
    }

    // Reinitialize cache if cache enabled/disabled
    if (config.schema?.cacheEnabled !== undefined) {
      if (config.schema.cacheEnabled && !this.schemaCache) {
        const cacheConfig: SchemaCacheConfig = {
          maxEntries: 100,
          ttlMs: this.config.performance.cacheTTLMs,
          cleanupIntervalMs: 300000,
          enableCompression: true,
          persistToDisk: false
        };
        this.schemaCache = new SchemaCache(cacheConfig);
        this.preloadCommonSchemas();
      } else if (!config.schema.cacheEnabled && this.schemaCache) {
        this.schemaCache.destroy();
        this.schemaCache = null;
      }
    }
  }

  /**
   * Clear all caches
   */
  async clearCache(): Promise<void> {
    if (this.schemaCache) {
      await this.schemaCache.clear();
    }
    this.validator.clearCache();
    this.visualValidator.clearCache();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): any {
    return {
      schemaCache: this.schemaCache?.getStats() || null,
      validatorCache: this.validator.getValidationStats(),
      visualValidatorCache: this.visualValidator.getValidationStats()
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; issues?: string[] }> {
    const issues: string[] = [];

    try {
      // Test schema generation
      const testSchema = await this.generateResponseSchema();
      if (!testSchema || !testSchema.properties) {
        issues.push('Schema generation failed');
      }

      // Test validation
      const testResponse = {
        decision: { 
          action: 'PROCEED', 
          message: 'Test message for health check validation'
        },
        reasoning: { 
          analysis: 'Test analysis for health check validation', 
          rationale: 'Test rationale explaining the decision', 
          expectedOutcome: 'Test expected outcome description' 
        }
      };
      const validationResult = await this.validateAIResponse(testResponse, testSchema);
      if (!validationResult.valid) {
        issues.push(`Validation test failed: ${validationResult.errors.map(e => e.message).join(', ')}`);
      }

      // Check cache health if enabled
      if (this.schemaCache) {
        const cacheStats = this.schemaCache.getStats();
        if (cacheStats.totalEntries > 1000) {
          issues.push('Cache size is getting large - consider cleanup');
        }
      }

    } catch (error) {
      issues.push(`Health check error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      healthy: issues.length === 0,
      issues: issues.length > 0 ? issues : undefined
    };
  }

  /**
   * Get module statistics
   */
  getStatistics(): any {
    const cacheStats = this.getCacheStats();
    const cacheSize = this.schemaCache?.getSizeInfo();

    return {
      moduleId: this.config.moduleId,
      version: this.config.version,
      schemaVersion: this.config.schema.version,
      cacheEnabled: this.config.schema.cacheEnabled,
      validationMode: this.config.schema.validationMode,
      cache: {
        ...cacheStats,
        sizeInfo: cacheSize
      },
      performance: {
        maxConcurrentOperations: this.config.performance.maxConcurrentOperations,
        cacheHitRate: cacheStats.schemaCache?.hitRate || 0,
        averageValidationTime: cacheStats.validatorCache?.averageValidationTime || 0
      }
    };
  }

  /**
   * Get default screenshot analysis options
   */
  private getDefaultScreenshotOptions(): ScreenshotSchemaOptions {
    const screenshotConfig = this.config.schema.screenshotAnalysisConfig;
    return {
      includeCoordinates: screenshotConfig.enableCoordinateValidation,
      includeConfidenceScores: screenshotConfig.requireConfidenceScores,
      requireDetectedElements: screenshotConfig.strictElementDetection,
      includeAccessibilityInfo: screenshotConfig.enableAccessibilityValidation,
      validationMode: this.config.schema.validationMode
    };
  }

  /**
   * Preload common schemas for better performance
   */
  private async preloadCommonSchemas(): Promise<void> {
    if (!this.schemaCache) return;

    try {
      await this.schemaCache.preloadCommonSchemas();
    } catch (error) {
      console.warn('Failed to preload common schemas:', error);
    }
  }

  /**
   * Destroy module and cleanup resources
   */
  async destroy(): Promise<void> {
    if (this.schemaCache) {
      await this.schemaCache.destroy();
    }
  }
}

// Export main interface and implementation
export { AISchemaManagerImpl as default };
export * from './types';

// Factory function for creating AI Schema Manager instances
export function createAISchemaManager(config?: Partial<AISchemaManagerConfig>): AISchemaManager {
  return new AISchemaManagerImpl(config);
}

// Export individual components for advanced usage
export { SchemaGenerator } from './schema-generator';
export { Validator } from './validator';
export { VisualValidator } from './visual-validator';
export { SchemaCache } from './schema-cache';
export { CommandSchemaBuilder } from './command-schema-builder';
export { ReasoningSchemaBuilder } from './reasoning-schema-builder';
export { ScreenshotSchemaBuilder } from './screenshot-schema-builder';
