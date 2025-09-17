/**
 * Screenshot Schema Builder
 * Constructs JSON schemas for screenshot analysis and comparison validation
 * Based on design/ai-schema-manager.md specifications
 */

import {
  ScreenshotAnalysisSchema,
  ScreenshotComparisonSchema,
  ScreenshotAnalysisSchemas,
  ScreenshotAnalysisType,
  AnalysisTypeSchema,
  VisualElementsSchema,
  TextContentSchema,
  UIStructureSchema,
  AccessibilitySchema,
  DifferencesSchema,
  ChangeAreasSchema,
  BoundingBoxSchema,
  MetadataSchema,
  StringSchema,
  NumberSchema,
  BooleanSchema,
  ArraySchema,
  ObjectSchema,
  ScreenshotSchemaOptions,
  ComparisonSchemaOptions
} from './types';

export class ScreenshotSchemaBuilder {
  /**
   * Build screenshot analysis schema for specific analysis type
   */
  buildScreenshotAnalysisSchema(
    analysisType: ScreenshotAnalysisType,
    options: ScreenshotSchemaOptions = {}
  ): ScreenshotAnalysisSchema {
    const required = ['analysisType', 'summary', 'confidence'];
    const properties: any = {
      analysisType: this.buildAnalysisTypeSchema(),
      summary: this.buildSummarySchema(),
      confidence: this.buildConfidenceSchema()
    };

    // Add type-specific properties
    switch (analysisType) {
      case ScreenshotAnalysisType.ELEMENT_DETECTION:
        properties.visualElements = this.buildVisualElementsSchema(options);
        if (options.requireDetectedElements) {
          required.push('visualElements');
        }
        break;
        
      case ScreenshotAnalysisType.TEXT_EXTRACTION:
        properties.textContent = this.buildTextContentSchema(options);
        required.push('textContent');
        break;
        
      case ScreenshotAnalysisType.UI_STRUCTURE:
        properties.uiStructure = this.buildUIStructureSchema(options);
        required.push('uiStructure');
        break;
        
      case ScreenshotAnalysisType.ACCESSIBILITY_AUDIT:
        properties.accessibility = this.buildAccessibilitySchema(options);
        if (options.includeAccessibilityInfo) {
          required.push('accessibility');
        }
        break;
        
      case ScreenshotAnalysisType.CONTENT_SUMMARY:
        // Base properties only
        break;
        
      default:
        // Include all optional properties for unknown types
        properties.visualElements = this.buildVisualElementsSchema(options);
        properties.textContent = this.buildTextContentSchema(options);
        properties.uiStructure = this.buildUIStructureSchema(options);
        properties.accessibility = this.buildAccessibilitySchema(options);
    }

    // Add metadata if requested
    properties.metadata = this.buildMetadataSchema();

    return {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties,
      required,
      additionalProperties: options.validationMode === 'lenient'
    };
  }

  /**
   * Build screenshot comparison schema
   */
  buildScreenshotComparisonSchema(
    options: ComparisonSchemaOptions = {}
  ): ScreenshotComparisonSchema {
    const required = ['similarity', 'differences', 'summary', 'significantChanges'];
    const properties: any = {
      similarity: this.buildSimilaritySchema(options),
      differences: this.buildDifferencesSchema(options),
      summary: this.buildSummarySchema(),
      significantChanges: this.buildSignificantChangesSchema()
    };

    if (options.includeCoordinates) {
      properties.changeAreas = this.buildChangeAreasSchema(options);
    }

    properties.metadata = this.buildMetadataSchema();

    return {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties,
      required,
      additionalProperties: options.validationMode === 'lenient'
    };
  }

  /**
   * Build complete screenshot analysis schemas for all types
   */
  buildScreenshotAnalysisSchemas(): ScreenshotAnalysisSchemas {
    const options: ScreenshotSchemaOptions = {
      includeCoordinates: true,
      includeConfidenceScores: true,
      requireDetectedElements: true,
      includeAccessibilityInfo: true,
      validationMode: 'strict'
    };

    return {
      CONTENT_SUMMARY: this.buildScreenshotAnalysisSchema(ScreenshotAnalysisType.CONTENT_SUMMARY, options),
      ELEMENT_DETECTION: this.buildScreenshotAnalysisSchema(ScreenshotAnalysisType.ELEMENT_DETECTION, options),
      UI_STRUCTURE: this.buildScreenshotAnalysisSchema(ScreenshotAnalysisType.UI_STRUCTURE, options),
      TEXT_EXTRACTION: this.buildScreenshotAnalysisSchema(ScreenshotAnalysisType.TEXT_EXTRACTION, options),
      ACCESSIBILITY_AUDIT: this.buildScreenshotAnalysisSchema(ScreenshotAnalysisType.ACCESSIBILITY_AUDIT, options),
      COMPARISON: this.buildScreenshotComparisonSchema({
        includePixelDifferences: true,
        includeSimilarityScore: true,
        requireChangeDescription: true,
        includeCoordinates: true,
        validationMode: 'strict'
      })
    };
  }

  /**
   * Build analysis type schema
   */
  buildAnalysisTypeSchema(): AnalysisTypeSchema {
    return {
      enum: Object.values(ScreenshotAnalysisType),
      type: 'string',
      description: 'Type of screenshot analysis performed'
    };
  }

  /**
   * Build summary schema
   */
  buildSummarySchema(): StringSchema {
    return {
      type: 'string',
      minLength: 10,
      maxLength: 2000,
      description: 'High-level description of the analysis results'
    };
  }

  /**
   * Build confidence schema
   */
  buildConfidenceSchema(): NumberSchema {
    return {
      type: 'number',
      minimum: 0,
      maximum: 1,
      description: 'Confidence score for the analysis (0-1)'
    };
  }

  /**
   * Build visual elements schema
   */
  buildVisualElementsSchema(options: ScreenshotSchemaOptions = {}): VisualElementsSchema {
    const elementProperties: any = {
      type: { type: 'string', description: 'Type of visual element (button, input, link, etc.)' },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      boundingBox: this.buildBoundingBoxSchema(),
      interactable: { type: 'boolean', description: 'Whether the element can be interacted with' }
    };

    if (options.includeCoordinates) {
      elementProperties.attributes = { type: 'object', additionalProperties: true };
      elementProperties.text = { type: 'string' };
      elementProperties.selector = { type: 'string', description: 'CSS selector for the element' };
    }

    return {
      type: 'array',
      items: {
        type: 'object',
        properties: elementProperties,
        required: ['type', 'confidence', 'boundingBox', 'interactable']
      }
    };
  }

  /**
   * Build bounding box schema
   */
  buildBoundingBoxSchema(): BoundingBoxSchema {
    return {
      type: 'object',
      properties: {
        x: { type: 'number', minimum: 0 },
        y: { type: 'number', minimum: 0 },
        width: { type: 'number', minimum: 0 },
        height: { type: 'number', minimum: 0 }
      },
      required: ['x', 'y', 'width', 'height'],
      additionalProperties: false
    };
  }

  /**
   * Build text content schema
   */
  buildTextContentSchema(options: ScreenshotSchemaOptions = {}): TextContentSchema {
    const textProperties: any = {
      content: { type: 'string', description: 'The actual text content' },
      type: {
        enum: ['heading', 'paragraph', 'link', 'button', 'label', 'error', 'success'],
        type: 'string'
      },
      boundingBox: this.buildBoundingBoxSchema()
    };

    if (options.includeCoordinates) {
      textProperties.fontSize = { type: 'number', minimum: 1 };
      textProperties.fontWeight = { type: 'string' };
      textProperties.color = { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' };
    }

    return {
      type: 'array',
      items: {
        type: 'object',
        properties: textProperties,
        required: ['content', 'type', 'boundingBox']
      }
    };
  }

  /**
   * Build UI structure schema
   */
  buildUIStructureSchema(options: ScreenshotSchemaOptions = {}): UIStructureSchema {
    return {
      type: 'object',
      properties: {
        layout: {
          enum: ['grid', 'flex', 'absolute', 'table', 'mixed'],
          type: 'string'
        },
        sections: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: {
                enum: ['header', 'footer', 'sidebar', 'main', 'content', 'navigation'],
                type: 'string'
              },
              boundingBox: this.buildBoundingBoxSchema(),
              elementCount: { type: 'number', minimum: 0 }
            },
            required: ['type', 'boundingBox']
          }
        },
        navigation: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: {
                enum: ['menu', 'breadcrumb', 'pagination', 'tabs'],
                type: 'string'
              },
              itemCount: { type: 'number', minimum: 0 },
              boundingBox: this.buildBoundingBoxSchema()
            },
            required: ['type', 'itemCount', 'boundingBox']
          }
        },
        forms: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              fieldCount: { type: 'number', minimum: 0 },
              submitButtonCount: { type: 'number', minimum: 0 },
              boundingBox: this.buildBoundingBoxSchema()
            },
            required: ['fieldCount', 'boundingBox']
          }
        }
      },
      required: ['layout', 'sections']
    };
  }

  /**
   * Build accessibility schema
   */
  buildAccessibilitySchema(options: ScreenshotSchemaOptions = {}): AccessibilitySchema {
    return {
      type: 'object',
      properties: {
        score: { type: 'number', minimum: 0, maximum: 100 },
        issues: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: {
                enum: ['contrast', 'alt_text', 'keyboard_navigation', 'aria_labels', 'semantic_structure'],
                type: 'string'
              },
              severity: {
                enum: ['low', 'medium', 'high', 'critical'],
                type: 'string'
              },
              description: { type: 'string', minLength: 1 },
              recommendation: { type: 'string', minLength: 1 },
              element: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  confidence: { type: 'number', minimum: 0, maximum: 1 },
                  boundingBox: this.buildBoundingBoxSchema(),
                  interactable: { type: 'boolean' }
                }
              }
            },
            required: ['type', 'severity', 'description', 'recommendation']
          }
        },
        recommendations: {
          type: 'array',
          items: { type: 'string', minLength: 1 }
        },
        compliance: {
          type: 'object',
          properties: {
            wcag_aa: { type: 'boolean' },
            wcag_aaa: { type: 'boolean' },
            section508: { type: 'boolean' }
          },
          required: ['wcag_aa', 'wcag_aaa', 'section508']
        }
      },
      required: ['score', 'issues', 'recommendations', 'compliance']
    };
  }

  /**
   * Build similarity schema for comparison
   */
  buildSimilaritySchema(options: ComparisonSchemaOptions = {}): NumberSchema {
    return {
      type: 'number',
      minimum: 0,
      maximum: 1,
      description: 'Similarity score between screenshots (0-1, where 1 is identical)'
    };
  }

  /**
   * Build differences schema for comparison
   */
  buildDifferencesSchema(options: ComparisonSchemaOptions = {}): DifferencesSchema {
    return {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: {
            enum: ['added', 'removed', 'modified', 'moved'],
            type: 'string'
          },
          description: { type: 'string', minLength: 1 },
          boundingBox: this.buildBoundingBoxSchema(),
          confidence: { type: 'number', minimum: 0, maximum: 1 }
        },
        required: ['type', 'description', 'boundingBox', 'confidence']
      }
    };
  }

  /**
   * Build significant changes schema
   */
  buildSignificantChangesSchema(): BooleanSchema {
    return {
      type: 'boolean',
      description: 'Whether significant changes were detected between screenshots'
    };
  }

  /**
   * Build change areas schema for comparison
   */
  buildChangeAreasSchema(options: ComparisonSchemaOptions = {}): ChangeAreasSchema {
    return {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          area: this.buildBoundingBoxSchema(),
          changeType: { type: 'string', minLength: 1 },
          significance: {
            enum: ['minor', 'moderate', 'major'],
            type: 'string'
          }
        },
        required: ['area', 'changeType', 'significance']
      }
    };
  }

  /**
   * Build metadata schema
   */
  buildMetadataSchema(): MetadataSchema {
    return {
      type: 'object',
      properties: {
        processingTime: { type: 'number', minimum: 0 },
        imageSize: {
          type: 'object',
          properties: {
            width: { type: 'number', minimum: 1 },
            height: { type: 'number', minimum: 1 }
          }
        },
        analysisVersion: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' }
      },
      additionalProperties: true
    };
  }

  /**
   * Validate bounding box coordinates
   */
  validateBoundingBox(box: any, imageWidth?: number, imageHeight?: number): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!box || typeof box !== 'object') {
      errors.push('Bounding box must be an object');
      return { valid: false, errors, warnings };
    }

    // Check required properties
    const requiredProps = ['x', 'y', 'width', 'height'];
    for (const prop of requiredProps) {
      if (typeof box[prop] !== 'number') {
        errors.push(`Bounding box ${prop} must be a number`);
      } else if (box[prop] < 0) {
        errors.push(`Bounding box ${prop} cannot be negative`);
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors, warnings };
    }

    // Check logical constraints
    if (box.width === 0 || box.height === 0) {
      warnings.push('Bounding box has zero width or height');
    }

    // Check against image bounds if provided
    if (imageWidth && imageHeight) {
      if (box.x + box.width > imageWidth) {
        warnings.push('Bounding box extends beyond image width');
      }
      if (box.y + box.height > imageHeight) {
        warnings.push('Bounding box extends beyond image height');
      }
    }

    return {
      valid: true,
      errors,
      warnings
    };
  }

  /**
   * Validate confidence score
   */
  validateConfidenceScore(score: any): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof score !== 'number') {
      errors.push('Confidence score must be a number');
      return { valid: false, errors, warnings };
    }

    if (score < 0 || score > 1) {
      errors.push('Confidence score must be between 0 and 1');
      return { valid: false, errors, warnings };
    }

    if (score < 0.5) {
      warnings.push('Low confidence score may indicate unreliable analysis');
    }

    return {
      valid: true,
      errors,
      warnings
    };
  }

  /**
   * Validate visual elements array
   */
  validateVisualElements(elements: any, options: ScreenshotSchemaOptions = {}): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!Array.isArray(elements)) {
      errors.push('Visual elements must be an array');
      return { valid: false, errors, warnings };
    }

    if (elements.length === 0 && options.requireDetectedElements) {
      errors.push('At least one visual element is required');
    }

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      
      if (!element.type || typeof element.type !== 'string') {
        errors.push(`Element ${i}: type is required and must be a string`);
      }

      const confidenceValidation = this.validateConfidenceScore(element.confidence);
      if (!confidenceValidation.valid) {
        errors.push(`Element ${i}: ${confidenceValidation.errors[0]}`);
      }

      const boundingBoxValidation = this.validateBoundingBox(element.boundingBox);
      if (!boundingBoxValidation.valid) {
        errors.push(`Element ${i}: ${boundingBoxValidation.errors[0]}`);
      }

      if (typeof element.interactable !== 'boolean') {
        errors.push(`Element ${i}: interactable must be a boolean`);
      }
    }

    if (elements.length > 100) {
      warnings.push('Large number of visual elements may impact performance');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get schema for specific analysis type
   */
  getSchemaForAnalysisType(
    analysisType: ScreenshotAnalysisType,
    options?: ScreenshotSchemaOptions
  ): ScreenshotAnalysisSchema {
    return this.buildScreenshotAnalysisSchema(analysisType, options);
  }

  /**
   * Check if analysis type is supported
   */
  isSupportedAnalysisType(type: string): type is ScreenshotAnalysisType {
    return Object.values(ScreenshotAnalysisType).includes(type as ScreenshotAnalysisType);
  }
}
