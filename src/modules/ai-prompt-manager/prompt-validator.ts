/**
 * Prompt Validator
 * 
 * Validates prompt structure, content quality, and integration
 * Provides quality assessment and suggestions for improvement
 */

import {
  IPromptValidator,
  GeneratedPrompt,
  PromptValidationResult,
  PromptValidationError,
  QualityAssessment,
  PromptTemplate,
  ResponseSchema,
  ValidationConfig,
  QUALITY_THRESHOLDS
} from '../../../types/ai-prompt-manager';

export class PromptValidator implements IPromptValidator {
  private config: ValidationConfig;

  constructor(config: ValidationConfig) {
    this.config = config;
  }

  /**
   * Validate prompt structure and content
   */
  validatePromptStructure(prompt: GeneratedPrompt): PromptValidationResult {
    const errors: PromptValidationError[] = [];
    const warnings: string[] = [];

    try {
      // Validate required fields
      this.validateRequiredFields(prompt, errors);

      // Validate content structure
      this.validateContentStructure(prompt, errors);

      // Validate schema integration
      this.validateSchemaStructure(prompt, errors, warnings);

      // Validate content quality
      this.validateContentQuality(prompt, warnings);

      // Assess overall quality
      const qualityScore = this.calculateQualityScore(prompt);

      // Generate suggestions
      const suggestions = this.generateSuggestions(prompt, errors, warnings);

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        qualityScore,
        suggestions
      };
    } catch (error) {
      errors.push({
        field: 'general',
        message: `Validation error: ${error.message}`,
        severity: 'error',
        code: 'VALIDATION_EXCEPTION'
      });

      return {
        isValid: false,
        errors,
        warnings,
        qualityScore: 0,
        suggestions: ['Fix validation errors and try again']
      };
    }
  }

  /**
   * Validate template variables against provided values
   */
  validateTemplateVariables(template: PromptTemplate, variables: Record<string, any>): boolean {
    try {
      for (const templateVar of template.variables) {
        if (templateVar.required && !variables.hasOwnProperty(templateVar.name)) {
          return false;
        }

        if (variables.hasOwnProperty(templateVar.name)) {
          const value = variables[templateVar.name];
          if (!this.validateVariableType(value, templateVar.type)) {
            return false;
          }
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate schema integration
   */
  validateSchemaIntegration(prompt: GeneratedPrompt): boolean {
    try {
      const schema = prompt.schema;
      
      // Check required schema fields
      if (!schema || !schema.type || !schema.properties) {
        return false;
      }

      // Validate schema structure
      if (schema.type !== 'object') {
        return false;
      }

      // Check for required properties
      const requiredProps = ['decision', 'reasoning', 'commands'];
      for (const prop of requiredProps) {
        if (!schema.properties[prop]) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Assess prompt quality
   */
  assessPromptQuality(prompt: GeneratedPrompt): QualityAssessment {
    const clarityScore = this.assessClarity(prompt);
    const completenessScore = this.assessCompleteness(prompt);
    const contextRelevanceScore = this.assessContextRelevance(prompt);
    const schemaAlignmentScore = this.assessSchemaAlignment(prompt);

    const overallScore = (
      clarityScore + 
      completenessScore + 
      contextRelevanceScore + 
      schemaAlignmentScore
    ) / 4;

    const improvements = this.generateImprovements(
      clarityScore,
      completenessScore,
      contextRelevanceScore,
      schemaAlignmentScore
    );

    return {
      clarityScore,
      completenessScore,
      contextRelevanceScore,
      schemaAlignmentScore,
      overallScore,
      improvements
    };
  }

  /**
   * Validate required fields
   */
  private validateRequiredFields(prompt: GeneratedPrompt, errors: PromptValidationError[]): void {
    const requiredFields = [
      'promptId',
      'sessionId',
      'stepIndex',
      'promptType',
      'content',
      'schema',
      'generatedAt'
    ];

    for (const field of requiredFields) {
      if (!prompt[field as keyof GeneratedPrompt]) {
        errors.push({
          field,
          message: `Required field '${field}' is missing`,
          severity: 'error',
          code: 'MISSING_REQUIRED_FIELD'
        });
      }
    }

    // Validate field types
    if (prompt.promptId && typeof prompt.promptId !== 'string') {
      errors.push({
        field: 'promptId',
        message: 'promptId must be a string',
        severity: 'error',
        code: 'INVALID_FIELD_TYPE'
      });
    }

    if (prompt.stepIndex !== undefined && typeof prompt.stepIndex !== 'number') {
      errors.push({
        field: 'stepIndex',
        message: 'stepIndex must be a number',
        severity: 'error',
        code: 'INVALID_FIELD_TYPE'
      });
    }
  }

  /**
   * Validate content structure
   */
  private validateContentStructure(prompt: GeneratedPrompt, errors: PromptValidationError[]): void {
    const content = prompt.content;
    if (!content) return;

    // Validate required content sections
    const requiredSections = ['systemMessage', 'contextSection', 'instructionSection', 'schemaSection'];
    
    for (const section of requiredSections) {
      if (!content[section as keyof typeof content]) {
        errors.push({
          field: `content.${section}`,
          message: `Required content section '${section}' is missing`,
          severity: 'error',
          code: 'MISSING_CONTENT_SECTION'
        });
      }
    }

    // Validate system message
    if (content.systemMessage && typeof content.systemMessage !== 'string') {
      errors.push({
        field: 'content.systemMessage',
        message: 'systemMessage must be a string',
        severity: 'error',
        code: 'INVALID_CONTENT_TYPE'
      });
    }

    // Validate context section structure
    if (content.contextSection) {
      this.validateContextSection(content.contextSection, errors);
    }
  }

  /**
   * Validate context section
   */
  private validateContextSection(contextSection: any, errors: PromptValidationError[]): void {
    const requiredFields = ['currentStep', 'executionHistory', 'pageStates'];
    
    for (const field of requiredFields) {
      if (!contextSection[field]) {
        errors.push({
          field: `content.contextSection.${field}`,
          message: `Required context field '${field}' is missing`,
          severity: 'error',
          code: 'MISSING_CONTEXT_FIELD'
        });
      }
    }
  }

  /**
   * Validate schema structure
   */
  private validateSchemaStructure(
    prompt: GeneratedPrompt, 
    errors: PromptValidationError[], 
    warnings: string[]
  ): void {
    const schema = prompt.schema;
    if (!schema) return;

    // Check schema type
    if (schema.type !== 'object') {
      errors.push({
        field: 'schema.type',
        message: 'Schema type must be "object"',
        severity: 'error',
        code: 'INVALID_SCHEMA_TYPE'
      });
    }

    // Check required properties
    const requiredProps = ['decision', 'reasoning', 'commands'];
    for (const prop of requiredProps) {
      if (!schema.properties || !schema.properties[prop]) {
        errors.push({
          field: `schema.properties.${prop}`,
          message: `Required schema property '${prop}' is missing`,
          severity: 'error',
          code: 'MISSING_SCHEMA_PROPERTY'
        });
      }
    }

    // Check for examples
    if (!schema.examples || schema.examples.length === 0) {
      warnings.push('Schema should include examples for better AI understanding');
    }
  }

  /**
   * Validate content quality
   */
  private validateContentQuality(prompt: GeneratedPrompt, warnings: string[]): void {
    const content = prompt.content;
    if (!content) return;

    // Check system message length
    if (content.systemMessage && content.systemMessage.length < 100) {
      warnings.push('System message is quite short and may lack sufficient guidance');
    }

    // Check for investigation guidance
    if (prompt.promptType.includes('INVESTIGATION') && !content.investigationSection) {
      warnings.push('Investigation prompt missing investigation section');
    }

    // Check for working memory in investigation prompts
    if (prompt.promptType.includes('INVESTIGATION') && !content.workingMemorySection) {
      warnings.push('Investigation prompt would benefit from working memory section');
    }
  }

  /**
   * Validate variable type
   */
  private validateVariableType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      default:
        return false;
    }
  }

  /**
   * Calculate overall quality score
   */
  private calculateQualityScore(prompt: GeneratedPrompt): number {
    const assessment = this.assessPromptQuality(prompt);
    return assessment.overallScore;
  }

  /**
   * Assess clarity
   */
  private assessClarity(prompt: GeneratedPrompt): number {
    let score = 1.0;
    const content = prompt.content;

    if (!content.systemMessage || content.systemMessage.length < 50) {
      score -= 0.2;
    }

    if (!content.instructionSection || typeof content.instructionSection !== 'object') {
      score -= 0.3;
    }

    if (!content.schemaSection || typeof content.schemaSection !== 'object') {
      score -= 0.2;
    }

    return Math.max(0, score);
  }

  /**
   * Assess completeness
   */
  private assessCompleteness(prompt: GeneratedPrompt): number {
    let score = 1.0;
    const content = prompt.content;

    const requiredSections = ['systemMessage', 'contextSection', 'instructionSection', 'schemaSection'];
    const missingSections = requiredSections.filter(section => !content[section as keyof typeof content]);
    
    score -= (missingSections.length * 0.25);

    // Check for investigation-specific completeness
    if (prompt.promptType.includes('INVESTIGATION')) {
      if (!content.investigationSection) score -= 0.2;
      if (!content.workingMemorySection) score -= 0.1;
    }

    return Math.max(0, score);
  }

  /**
   * Assess context relevance
   */
  private assessContextRelevance(prompt: GeneratedPrompt): number {
    let score = 1.0;
    const content = prompt.content;

    if (!content.contextSection) {
      return 0.3;
    }

    const contextSection = content.contextSection;
    
    if (!contextSection.currentStep) score -= 0.2;
    if (!contextSection.executionHistory) score -= 0.2;
    if (!contextSection.pageStates) score -= 0.2;

    // For investigation prompts, check for investigation-specific context
    if (prompt.promptType.includes('INVESTIGATION')) {
      if (!contextSection.investigationHistory) score -= 0.2;
      if (!contextSection.filteredContext) score -= 0.1;
    }

    return Math.max(0, score);
  }

  /**
   * Assess schema alignment
   */
  private assessSchemaAlignment(prompt: GeneratedPrompt): number {
    if (!this.validateSchemaIntegration(prompt)) {
      return 0.2;
    }

    let score = 1.0;
    const schema = prompt.schema;

    if (!schema.examples || schema.examples.length === 0) {
      score -= 0.2;
    }

    if (!schema.required || schema.required.length < 3) {
      score -= 0.1;
    }

    return Math.max(0, score);
  }

  /**
   * Generate improvement suggestions
   */
  private generateImprovements(
    clarityScore: number,
    completenessScore: number,
    contextRelevanceScore: number,
    schemaAlignmentScore: number
  ): string[] {
    const improvements: string[] = [];

    if (clarityScore < QUALITY_THRESHOLDS.MIN_CLARITY_SCORE) {
      improvements.push('Improve prompt clarity with more specific instructions and clearer language');
    }

    if (completenessScore < QUALITY_THRESHOLDS.MIN_COMPLETENESS_SCORE) {
      improvements.push('Add missing content sections to make prompt more complete');
    }

    if (contextRelevanceScore < QUALITY_THRESHOLDS.MIN_CONTEXT_RELEVANCE_SCORE) {
      improvements.push('Enhance context relevance with more targeted information');
    }

    if (schemaAlignmentScore < 0.8) {
      improvements.push('Improve schema alignment with better examples and clearer structure');
    }

    return improvements;
  }

  /**
   * Generate suggestions based on validation results
   */
  private generateSuggestions(
    prompt: GeneratedPrompt,
    errors: PromptValidationError[],
    warnings: string[]
  ): string[] {
    const suggestions: string[] = [];

    // Suggestions based on errors
    if (errors.some(e => e.code === 'MISSING_REQUIRED_FIELD')) {
      suggestions.push('Ensure all required fields are populated before generating prompt');
    }

    if (errors.some(e => e.code === 'MISSING_CONTENT_SECTION')) {
      suggestions.push('Include all required content sections for complete prompt structure');
    }

    // Suggestions based on warnings
    if (warnings.some(w => w.includes('investigation'))) {
      suggestions.push('Consider adding investigation-specific sections for better investigation support');
    }

    // General suggestions
    if (suggestions.length === 0 && warnings.length > 0) {
      suggestions.push('Address warnings to improve prompt quality');
    }

    if (suggestions.length === 0 && errors.length === 0) {
      suggestions.push('Prompt structure is valid - consider adding examples for better AI guidance');
    }

    return suggestions;
  }

  /**
   * Update configuration
   */
  updateConfig(config: ValidationConfig): void {
    this.config = config;
  }
}
