/**
 * Visual Response Validator
 * Validates screenshot analysis and comparison responses
 * Based on design/ai-schema-manager.md specifications
 */

import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import {
  ScreenshotAnalysisSchema,
  ScreenshotComparisonSchema,
  ValidationResult,
  SchemaValidationError,
  ScreenshotAnalysisType,
  ScreenshotSchemaOptions
} from './types';
import { ScreenshotSchemaBuilder } from './screenshot-schema-builder';

export class VisualValidator {
  private ajv: Ajv;
  private screenshotSchemaBuilder: ScreenshotSchemaBuilder;
  private validatorCache: Map<string, ValidateFunction>;
  private validationStats: {
    totalValidations: number;
    successfulValidations: number;
    averageValidationTime: number;
    commonErrors: Map<string, number>;
  };

  constructor() {
    this.ajv = new Ajv({ allErrors: true, verbose: true });
    addFormats(this.ajv);
    this.screenshotSchemaBuilder = new ScreenshotSchemaBuilder();
    this.validatorCache = new Map();
    this.validationStats = {
      totalValidations: 0,
      successfulValidations: 0,
      averageValidationTime: 0,
      commonErrors: new Map()
    };
  }

  /**
   * Validate screenshot analysis response
   */
  async validateScreenshotAnalysisResponse(
    response: any,
    schema: ScreenshotAnalysisSchema
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    const errors: SchemaValidationError[] = [];
    const warnings: string[] = [];

    try {
      this.validationStats.totalValidations++;

      // Get or create validator for this schema
      const schemaKey = this.generateSchemaKey(schema);
      let validator = this.validatorCache.get(schemaKey);
      
      if (!validator) {
        validator = this.ajv.compile(schema);
        this.validatorCache.set(schemaKey, validator);
      }

      // Perform JSON schema validation
      const isValid = validator(response);
      
      if (!isValid && validator.errors) {
        for (const error of validator.errors) {
          const errorKey = `${error.keyword}:${error.schemaPath}`;
          this.validationStats.commonErrors.set(
            errorKey,
            (this.validationStats.commonErrors.get(errorKey) || 0) + 1
          );

          errors.push({
            field: error.instancePath || error.schemaPath,
            message: error.message || 'Unknown validation error',
            value: error.data,
            expectedType: this.extractExpectedType(error),
            path: this.parsePath(error.instancePath || '')
          });
        }
      }

      // Perform additional visual-specific validation
      const visualValidation = await this.performVisualSemanticValidation(response);
      errors.push(...visualValidation.errors);
      warnings.push(...visualValidation.warnings);

      // Update statistics
      const validationTime = Date.now() - startTime;
      this.updateValidationStats(validationTime, errors.length === 0);

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        executorCompatible: true // Visual responses don't directly interact with executor
      };

    } catch (error) {
      errors.push({
        field: 'validation',
        message: `Visual validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        value: response,
        expectedType: 'valid_visual_response',
        path: ['root']
      });

      return {
        valid: false,
        errors,
        warnings,
        executorCompatible: false
      };
    }
  }

  /**
   * Perform visual-specific semantic validation
   */
  private async performVisualSemanticValidation(response: any): Promise<{
    errors: SchemaValidationError[];
    warnings: string[];
  }> {
    const errors: SchemaValidationError[] = [];
    const warnings: string[] = [];

    // Validate analysis type consistency
    if (response.analysisType) {
      if (!this.screenshotSchemaBuilder.isSupportedAnalysisType(response.analysisType)) {
        errors.push({
          field: 'analysisType',
          message: `Unsupported analysis type: ${response.analysisType}`,
          value: response.analysisType,
          expectedType: 'ScreenshotAnalysisType',
          path: ['analysisType']
        });
      }
    }

    // Validate confidence scores
    if (response.confidence !== undefined) {
      const confidenceValidation = this.screenshotSchemaBuilder.validateConfidenceScore(response.confidence);
      if (!confidenceValidation.valid) {
        errors.push(...confidenceValidation.errors.map(error => ({
          field: 'confidence',
          message: error,
          value: response.confidence,
          expectedType: 'number (0-1)',
          path: ['confidence']
        })));
      }
      warnings.push(...confidenceValidation.warnings);
    }

    // Validate visual elements
    if (response.visualElements) {
      const elementsValidation = this.screenshotSchemaBuilder.validateVisualElements(
        response.visualElements,
        { requireDetectedElements: false }
      );
      if (!elementsValidation.valid) {
        errors.push(...elementsValidation.errors.map(error => ({
          field: 'visualElements',
          message: error,
          value: response.visualElements,
          expectedType: 'valid_visual_elements_array',
          path: ['visualElements']
        })));
      }
      warnings.push(...elementsValidation.warnings);
    }

    // Validate bounding boxes in all elements
    const boundingBoxValidation = this.validateAllBoundingBoxes(response);
    errors.push(...boundingBoxValidation.errors);
    warnings.push(...boundingBoxValidation.warnings);

    // Validate accessibility audit specific fields
    if (response.accessibility) {
      const accessibilityValidation = this.validateAccessibilityAudit(response.accessibility);
      errors.push(...accessibilityValidation.errors);
      warnings.push(...accessibilityValidation.warnings);
    }

    // Validate UI structure consistency
    if (response.uiStructure) {
      const uiValidation = this.validateUIStructure(response.uiStructure);
      errors.push(...uiValidation.errors);
      warnings.push(...uiValidation.warnings);
    }

    return { errors, warnings };
  }

  /**
   * Validate all bounding boxes in the response
   */
  private validateAllBoundingBoxes(response: any): {
    errors: SchemaValidationError[];
    warnings: string[];
  } {
    const errors: SchemaValidationError[] = [];
    const warnings: string[] = [];

    const imageSize = response.metadata?.imageSize;
    const imageWidth = imageSize?.width;
    const imageHeight = imageSize?.height;

    // Check visual elements
    if (response.visualElements && Array.isArray(response.visualElements)) {
      response.visualElements.forEach((element: any, index: number) => {
        if (element.boundingBox) {
          const validation = this.screenshotSchemaBuilder.validateBoundingBox(
            element.boundingBox,
            imageWidth,
            imageHeight
          );
          if (!validation.valid) {
            errors.push(...validation.errors.map(error => ({
              field: `visualElements[${index}].boundingBox`,
              message: error,
              value: element.boundingBox,
              expectedType: 'valid_bounding_box',
              path: ['visualElements', index.toString(), 'boundingBox']
            })));
          }
          warnings.push(...validation.warnings);
        }
      });
    }

    // Check text content
    if (response.textContent && Array.isArray(response.textContent)) {
      response.textContent.forEach((text: any, index: number) => {
        if (text.boundingBox) {
          const validation = this.screenshotSchemaBuilder.validateBoundingBox(
            text.boundingBox,
            imageWidth,
            imageHeight
          );
          if (!validation.valid) {
            errors.push(...validation.errors.map(error => ({
              field: `textContent[${index}].boundingBox`,
              message: error,
              value: text.boundingBox,
              expectedType: 'valid_bounding_box',
              path: ['textContent', index.toString(), 'boundingBox']
            })));
          }
          warnings.push(...validation.warnings);
        }
      });
    }

    // Check UI structure sections
    if (response.uiStructure?.sections && Array.isArray(response.uiStructure.sections)) {
      response.uiStructure.sections.forEach((section: any, index: number) => {
        if (section.boundingBox) {
          const validation = this.screenshotSchemaBuilder.validateBoundingBox(
            section.boundingBox,
            imageWidth,
            imageHeight
          );
          if (!validation.valid) {
            errors.push(...validation.errors.map(error => ({
              field: `uiStructure.sections[${index}].boundingBox`,
              message: error,
              value: section.boundingBox,
              expectedType: 'valid_bounding_box',
              path: ['uiStructure', 'sections', index.toString(), 'boundingBox']
            })));
          }
          warnings.push(...validation.warnings);
        }
      });
    }

    return { errors, warnings };
  }

  /**
   * Validate accessibility audit data
   */
  private validateAccessibilityAudit(accessibility: any): {
    errors: SchemaValidationError[];
    warnings: string[];
  } {
    const errors: SchemaValidationError[] = [];
    const warnings: string[] = [];

    // Validate score range
    if (typeof accessibility.score !== 'number' || accessibility.score < 0 || accessibility.score > 100) {
      errors.push({
        field: 'accessibility.score',
        message: 'Accessibility score must be a number between 0 and 100',
        value: accessibility.score,
        expectedType: 'number (0-100)',
        path: ['accessibility', 'score']
      });
    }

    // Validate issues structure
    if (!Array.isArray(accessibility.issues)) {
      errors.push({
        field: 'accessibility.issues',
        message: 'Accessibility issues must be an array',
        value: accessibility.issues,
        expectedType: 'array',
        path: ['accessibility', 'issues']
      });
    } else {
      accessibility.issues.forEach((issue: any, index: number) => {
        if (!issue.type || !['contrast', 'alt_text', 'keyboard_navigation', 'aria_labels', 'semantic_structure'].includes(issue.type)) {
          errors.push({
            field: `accessibility.issues[${index}].type`,
            message: 'Invalid accessibility issue type',
            value: issue.type,
            expectedType: 'contrast | alt_text | keyboard_navigation | aria_labels | semantic_structure',
            path: ['accessibility', 'issues', index.toString(), 'type']
          });
        }

        if (!issue.severity || !['low', 'medium', 'high', 'critical'].includes(issue.severity)) {
          errors.push({
            field: `accessibility.issues[${index}].severity`,
            message: 'Invalid accessibility issue severity',
            value: issue.severity,
            expectedType: 'low | medium | high | critical',
            path: ['accessibility', 'issues', index.toString(), 'severity']
          });
        }
      });
    }

    // Validate compliance structure
    if (accessibility.compliance) {
      const compliance = accessibility.compliance;
      ['wcag_aa', 'wcag_aaa', 'section508'].forEach(standard => {
        if (typeof compliance[standard] !== 'boolean') {
          errors.push({
            field: `accessibility.compliance.${standard}`,
            message: `Compliance ${standard} must be a boolean`,
            value: compliance[standard],
            expectedType: 'boolean',
            path: ['accessibility', 'compliance', standard]
          });
        }
      });
    }

    // Warnings for low accessibility scores
    if (typeof accessibility.score === 'number') {
      if (accessibility.score < 50) {
        warnings.push('Very low accessibility score - significant issues detected');
      } else if (accessibility.score < 70) {
        warnings.push('Low accessibility score - multiple issues need attention');
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate UI structure consistency
   */
  private validateUIStructure(uiStructure: any): {
    errors: SchemaValidationError[];
    warnings: string[];
  } {
    const errors: SchemaValidationError[] = [];
    const warnings: string[] = [];

    // Validate layout type
    if (!['grid', 'flex', 'absolute', 'table', 'mixed'].includes(uiStructure.layout)) {
      errors.push({
        field: 'uiStructure.layout',
        message: 'Invalid UI layout type',
        value: uiStructure.layout,
        expectedType: 'grid | flex | absolute | table | mixed',
        path: ['uiStructure', 'layout']
      });
    }

    // Validate sections
    if (!Array.isArray(uiStructure.sections)) {
      errors.push({
        field: 'uiStructure.sections',
        message: 'UI structure sections must be an array',
        value: uiStructure.sections,
        expectedType: 'array',
        path: ['uiStructure', 'sections']
      });
    } else if (uiStructure.sections.length === 0) {
      warnings.push('No UI sections detected - may indicate parsing issues');
    }

    // Check for logical inconsistencies
    if (uiStructure.forms && Array.isArray(uiStructure.forms)) {
      uiStructure.forms.forEach((form: any, index: number) => {
        if (form.fieldCount === 0 && form.submitButtonCount === 0) {
          warnings.push(`Form ${index} has no fields or submit buttons`);
        }
        if (form.fieldCount > 0 && form.submitButtonCount === 0) {
          warnings.push(`Form ${index} has fields but no submit button`);
        }
      });
    }

    return { errors, warnings };
  }

  /**
   * Validate screenshot comparison response
   */
  async validateScreenshotComparisonResponse(
    response: any,
    schema: ScreenshotComparisonSchema
  ): Promise<ValidationResult> {
    const baseValidation = await this.validateScreenshotAnalysisResponse(response, schema as any);
    
    // Additional comparison-specific validation
    const comparisonErrors: SchemaValidationError[] = [];
    const comparisonWarnings: string[] = [];

    // Validate similarity score
    if (typeof response.similarity !== 'number' || response.similarity < 0 || response.similarity > 1) {
      comparisonErrors.push({
        field: 'similarity',
        message: 'Similarity score must be a number between 0 and 1',
        value: response.similarity,
        expectedType: 'number (0-1)',
        path: ['similarity']
      });
    }

    // Validate differences array
    if (!Array.isArray(response.differences)) {
      comparisonErrors.push({
        field: 'differences',
        message: 'Differences must be an array',
        value: response.differences,
        expectedType: 'array',
        path: ['differences']
      });
    } else {
      response.differences.forEach((diff: any, index: number) => {
        if (!['added', 'removed', 'modified', 'moved'].includes(diff.type)) {
          comparisonErrors.push({
            field: `differences[${index}].type`,
            message: 'Invalid difference type',
            value: diff.type,
            expectedType: 'added | removed | modified | moved',
            path: ['differences', index.toString(), 'type']
          });
        }

        if (typeof diff.confidence !== 'number' || diff.confidence < 0 || diff.confidence > 1) {
          comparisonErrors.push({
            field: `differences[${index}].confidence`,
            message: 'Difference confidence must be a number between 0 and 1',
            value: diff.confidence,
            expectedType: 'number (0-1)',
            path: ['differences', index.toString(), 'confidence']
          });
        }
      });
    }

    // Validate significant changes consistency
    if (typeof response.significantChanges === 'boolean') {
      if (response.significantChanges && response.similarity > 0.9) {
        comparisonWarnings.push('Significant changes reported but similarity score is very high');
      }
      if (!response.significantChanges && response.similarity < 0.5) {
        comparisonWarnings.push('No significant changes reported but similarity score is very low');
      }
    }

    return {
      valid: baseValidation.valid && comparisonErrors.length === 0,
      errors: [...baseValidation.errors, ...comparisonErrors],
      warnings: [...baseValidation.warnings, ...comparisonWarnings],
      executorCompatible: baseValidation.executorCompatible
    };
  }

  /**
   * Generate cache key for schema
   */
  private generateSchemaKey(schema: ScreenshotAnalysisSchema | ScreenshotComparisonSchema): string {
    return JSON.stringify({
      type: schema.type,
      required: schema.required,
      hasVisualElements: !!(schema.properties as any).visualElements,
      hasTextContent: !!(schema.properties as any).textContent,
      hasUIStructure: !!(schema.properties as any).uiStructure,
      hasAccessibility: !!(schema.properties as any).accessibility
    });
  }

  /**
   * Extract expected type from AJV error
   */
  private extractExpectedType(error: any): string {
    if (error.keyword === 'type') {
      return error.schema;
    }
    if (error.keyword === 'enum') {
      return `one of: ${error.schema.join(', ')}`;
    }
    if (error.keyword === 'required') {
      return 'required property';
    }
    if (error.keyword === 'format') {
      return `${error.schema} format`;
    }
    if (error.keyword === 'minimum' || error.keyword === 'maximum') {
      return `number within range`;
    }
    return error.keyword || 'unknown';
  }

  /**
   * Parse JSON path into array
   */
  private parsePath(path: string): string[] {
    return path
      .split('/')
      .filter(segment => segment.length > 0)
      .map(segment => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
  }

  /**
   * Update validation statistics
   */
  private updateValidationStats(validationTime: number, success: boolean): void {
    if (success) {
      this.validationStats.successfulValidations++;
    }
    
    // Update average validation time (simple moving average)
    const totalValidations = this.validationStats.totalValidations;
    const currentAverage = this.validationStats.averageValidationTime;
    this.validationStats.averageValidationTime = 
      (currentAverage * (totalValidations - 1) + validationTime) / totalValidations;
  }

  /**
   * Get validation statistics
   */
  getValidationStats(): {
    totalValidations: number;
    successfulValidations: number;
    successRate: number;
    averageValidationTime: number;
    cachedValidators: number;
    commonErrors: Array<{ error: string; count: number }>;
  } {
    const successRate = this.validationStats.totalValidations > 0
      ? this.validationStats.successfulValidations / this.validationStats.totalValidations
      : 0;

    const commonErrors = Array.from(this.validationStats.commonErrors.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 errors

    return {
      totalValidations: this.validationStats.totalValidations,
      successfulValidations: this.validationStats.successfulValidations,
      successRate,
      averageValidationTime: this.validationStats.averageValidationTime,
      cachedValidators: this.validatorCache.size,
      commonErrors
    };
  }

  /**
   * Clear validation cache and reset statistics
   */
  clearCache(): void {
    this.validatorCache.clear();
    this.validationStats = {
      totalValidations: 0,
      successfulValidations: 0,
      averageValidationTime: 0,
      commonErrors: new Map()
    };
  }
}
