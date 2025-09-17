/**
 * Prompt Validator Implementation
 * Comprehensive validation and quality assessment for generated prompts
 */

import {
  GeneratedPrompt,
  ValidationConfig,
  ValidationResult,
  ValidationError,
  QualityAssessment,
  PromptTemplate,
  EnhancedPromptType,
  QUALITY_THRESHOLDS
} from './types';

export class PromptValidator {
  constructor(private config: ValidationConfig) {}

  /**
   * Validate prompt structure and completeness
   */
  validatePromptStructure(prompt: GeneratedPrompt): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    try {
      // Validate required fields
      this.validateRequiredFields(prompt, errors);
      
      // Validate field types
      this.validateFieldTypes(prompt, errors);
      
      // Validate content sections
      this.validateContentSections(prompt, errors, warnings);
      
      // Validate optional sections based on context
      this.validateOptionalSections(prompt, warnings, suggestions);
      
      // Calculate quality score
      const qualityScore = this.calculateBasicQualityScore(prompt, errors.length);
      
      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions,
        qualityScore
      };
    } catch (error) {
      errors.push({
        field: 'unknown',
        code: 'VALIDATION_EXCEPTION',
        message: `Validation failed with exception: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
      
      return {
        isValid: false,
        errors,
        warnings,
        suggestions,
        qualityScore: 0
      };
    }
  }

  /**
   * Validate schema integration
   */
  validateSchemaIntegration(prompt: GeneratedPrompt): boolean {
    try {
      if (!prompt.schema) {
        return false;
      }
      
      // Validate schema structure
      if (!prompt.schema.type || !prompt.schema.properties) {
        return false;
      }
      
      // Validate schema section exists in content
      if (!prompt.content?.schemaSection) {
        return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate template variables
   */
  validateTemplateVariables(template: PromptTemplate, variables: Record<string, any>): boolean {
    try {
      for (const templateVar of template.variables) {
        if (templateVar.required && !(templateVar.name in variables)) {
          return false;
        }
        
        if (templateVar.name in variables) {
          const value = variables[templateVar.name];
          if (!this.validateVariableType(value, templateVar.type)) {
            return false;
          }
        }
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Assess prompt quality
   */
  assessPromptQuality(prompt: GeneratedPrompt): QualityAssessment {
    try {
      const clarityScore = this.assessClarity(prompt);
      const completenessScore = this.assessCompleteness(prompt);
      const contextRelevanceScore = this.assessContextRelevance(prompt);
      const schemaAlignmentScore = this.assessSchemaAlignment(prompt);
      
      const overallScore = (
        clarityScore * 0.3 +
        completenessScore * 0.3 +
        contextRelevanceScore * 0.25 +
        schemaAlignmentScore * 0.15
      );
      
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
    } catch (error) {
      return {
        clarityScore: 0,
        completenessScore: 0,
        contextRelevanceScore: 0,
        schemaAlignmentScore: 0,
        overallScore: 0,
        improvements: ['Error occurred during quality assessment']
      };
    }
  }

  /**
   * Validate required fields
   */
  private validateRequiredFields(prompt: GeneratedPrompt, errors: ValidationError[]): void {
    const requiredFields: (keyof GeneratedPrompt)[] = [
      'promptId', 'sessionId', 'stepIndex', 'promptType', 'content', 'schema', 'generatedAt'
    ];
    
    for (const field of requiredFields) {
      if (!(field in prompt) || prompt[field] === null || prompt[field] === undefined) {
        errors.push({
          field,
          code: 'MISSING_REQUIRED_FIELD',
          message: `Required field '${field}' is missing`,
          severity: 'error'
        });
      }
    }
  }

  /**
   * Validate field types
   */
  private validateFieldTypes(prompt: GeneratedPrompt, errors: ValidationError[]): void {
    if (prompt.promptId !== undefined && typeof prompt.promptId !== 'string') {
      errors.push({
        field: 'promptId',
        code: 'INVALID_FIELD_TYPE',
        message: 'promptId must be a string',
        severity: 'error'
      });
    }
    
    if (prompt.sessionId !== undefined && typeof prompt.sessionId !== 'string') {
      errors.push({
        field: 'sessionId',
        code: 'INVALID_FIELD_TYPE',
        message: 'sessionId must be a string',
        severity: 'error'
      });
    }
    
    if (prompt.stepIndex !== undefined && typeof prompt.stepIndex !== 'number') {
      errors.push({
        field: 'stepIndex',
        code: 'INVALID_FIELD_TYPE',
        message: 'stepIndex must be a number',
        severity: 'error'
      });
    }
    
    if (prompt.generatedAt !== undefined && !(prompt.generatedAt instanceof Date)) {
      errors.push({
        field: 'generatedAt',
        code: 'INVALID_FIELD_TYPE',
        message: 'generatedAt must be a Date object',
        severity: 'error'
      });
    }
  }

  /**
   * Validate content sections
   */
  private validateContentSections(
    prompt: GeneratedPrompt,
    errors: ValidationError[],
    warnings: string[]
  ): void {
    if (!prompt.content) {
      errors.push({
        field: 'content',
        code: 'MISSING_CONTENT',
        message: 'Content object is missing',
        severity: 'error'
      });
      return;
    }
    
    // Required sections
    const requiredSections = ['systemMessage', 'contextSection', 'instructionSection', 'schemaSection'];
    
    for (const section of requiredSections) {
      if (!(section in prompt.content) || !prompt.content[section as keyof typeof prompt.content]) {
        errors.push({
          field: `content.${section}`,
          code: 'MISSING_CONTENT_SECTION',
          message: `Required content section '${section}' is missing`,
          severity: 'error'
        });
      }
    }
  }

  /**
   * Validate optional sections based on context
   */
  private validateOptionalSections(
    prompt: GeneratedPrompt,
    warnings: string[],
    suggestions: string[]
  ): void {
    // Validation section recommended for non-initial steps
    if (prompt.stepIndex > 0 && !prompt.content.validationSection) {
      warnings.push('Validation section recommended for non-initial steps');
      suggestions.push('Consider adding validation section for better step progression');
    }
    
    // Working memory section recommended when investigation is enabled
    if (prompt.metadata?.useInvestigation && !prompt.content.workingMemorySection) {
      warnings.push('Working memory section recommended when investigation is enabled');
      suggestions.push('Add working memory section to leverage investigation context');
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
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true;
    }
  }

  /**
   * Assess clarity of prompt content
   */
  private assessClarity(prompt: GeneratedPrompt): number {
    try {
      let score = 0;
      let maxScore = 0;
      
      // System message clarity
      maxScore += 25;
      if (prompt.content.systemMessage && prompt.content.systemMessage.length > 20) {
        score += 25;
      } else if (prompt.content.systemMessage && prompt.content.systemMessage.length > 10) {
        score += 15;
      }
      
      // Instruction clarity
      maxScore += 25;
      if (prompt.content.instructionSection?.currentStepInstruction) {
        const instruction = prompt.content.instructionSection.currentStepInstruction;
        if (instruction.length > 30 && !instruction.toLowerCase().includes('do it')) {
          score += 25;
        } else if (instruction.length > 10) {
          score += 15;
        }
      }
      
      // Action guidance clarity
      maxScore += 25;
      if (prompt.content.instructionSection?.actionGuidance) {
        const guidance = prompt.content.instructionSection.actionGuidance;
        if (guidance.length > 20 && !guidance.toLowerCase().includes('just do')) {
          score += 25;
        } else if (guidance.length > 5) {
          score += 15;
        }
      }
      
      // Schema clarity
      maxScore += 25;
      if (prompt.content.schemaSection?.responseFormat) {
        const format = prompt.content.schemaSection.responseFormat;
        if (format.length > 20) {
          score += 25;
        } else if (format.length > 5) {
          score += 15;
        }
      }
      
      return maxScore > 0 ? score / maxScore : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Assess completeness of prompt
   */
  private assessCompleteness(prompt: GeneratedPrompt): number {
    try {
      let score = 0;
      let maxScore = 0;
      
      // Required sections
      const requiredSections = ['systemMessage', 'contextSection', 'instructionSection', 'schemaSection'];
      maxScore += requiredSections.length * 20;
      
      for (const section of requiredSections) {
        if (prompt.content[section as keyof typeof prompt.content]) {
          score += 20;
        }
      }
      
      // Optional but valuable sections
      maxScore += 20;
      if (prompt.content.validationSection || prompt.content.workingMemorySection) {
        score += 20;
      }
      
      // Constraints and objectives
      maxScore += 10;
      if (prompt.content.instructionSection?.constraints?.length > 0) {
        score += 5;
      }
      if (prompt.content.instructionSection?.objectives?.length > 0) {
        score += 5;
      }
      
      // Schema completeness
      maxScore += 10;
      if (prompt.schema?.properties && Object.keys(prompt.schema.properties).length > 0) {
        score += 5;
      }
      if (prompt.schema?.required && prompt.schema.required.length > 0) {
        score += 5;
      }
      
      return maxScore > 0 ? score / maxScore : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Assess context relevance
   */
  private assessContextRelevance(prompt: GeneratedPrompt): number {
    try {
      let score = 0;
      let maxScore = 0;
      
      // Step index consistency
      maxScore += 30;
      if (prompt.content.contextSection?.currentStep?.stepIndex === prompt.stepIndex) {
        score += 30;
      }
      
      // Metadata consistency
      maxScore += 20;
      if (!prompt.metadata?.stepIndex || prompt.metadata.stepIndex === prompt.stepIndex) {
        score += 20;
      }
      
      // Prompt type appropriateness
      maxScore += 30;
      if (prompt.stepIndex === 0 && prompt.promptType === EnhancedPromptType.INITIAL_ACTION) {
        score += 30;
      } else if (prompt.stepIndex > 0 && prompt.promptType !== EnhancedPromptType.INITIAL_ACTION) {
        score += 30;
      } else if (prompt.stepIndex > 0) {
        score += 15; // Partial credit
      }
      
      // Context section completeness
      maxScore += 20;
      if (prompt.content.contextSection?.currentStep && 
          prompt.content.contextSection?.executionHistory) {
        score += 20;
      }
      
      return maxScore > 0 ? score / maxScore : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Assess schema alignment
   */
  private assessSchemaAlignment(prompt: GeneratedPrompt): number {
    try {
      let score = 0;
      let maxScore = 100;
      
      // Schema presence
      if (prompt.schema && prompt.content.schemaSection) {
        score += 50;
      }
      
      // Schema structure
      if (prompt.schema?.type === 'object' && prompt.schema.properties) {
        score += 30;
      }
      
      // Required fields
      if (prompt.schema?.required && prompt.schema.required.length > 0) {
        score += 20;
      }
      
      return score / maxScore;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Calculate basic quality score
   */
  private calculateBasicQualityScore(prompt: GeneratedPrompt, errorCount: number): number {
    if (errorCount > 0) {
      return Math.max(0, 1 - (errorCount * 0.2));
    }
    
    try {
      let score = 1.0;
      
      // Deduct for missing optional but important sections
      if (prompt.stepIndex > 0 && !prompt.content.validationSection) {
        score -= 0.1;
      }
      
      if (prompt.metadata?.useInvestigation && !prompt.content.workingMemorySection) {
        score -= 0.1;
      }
      
      return Math.max(0, score);
    } catch (error) {
      return 0.5; // Fallback score
    }
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
      improvements.push('Improve clarity by providing more detailed instructions and guidance');
    }
    
    if (completenessScore < QUALITY_THRESHOLDS.MIN_COMPLETENESS_SCORE) {
      improvements.push('Add missing sections such as constraints, objectives, or validation rules');
    }
    
    if (contextRelevanceScore < QUALITY_THRESHOLDS.MIN_CONTEXT_RELEVANCE_SCORE) {
      improvements.push('Ensure context consistency between step index, prompt type, and metadata');
    }
    
    if (schemaAlignmentScore < 0.7) {
      improvements.push('Improve schema definition with proper structure and required fields');
    }
    
    return improvements;
  }
}
