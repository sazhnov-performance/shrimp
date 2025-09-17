/**
 * Reasoning Schema Builder
 * Constructs JSON schemas for AI reasoning field validation
 * Based on design/ai-schema-manager.md specifications
 */

import {
  ReasoningSchema,
  DecisionSchema,
  ActionDecisionSchema,
  ResultValidationSchema,
  StringSchema,
  BooleanSchema,
  ArraySchema,
  SchemaOptions
} from './types';

export class ReasoningSchemaBuilder {
  /**
   * Build complete reasoning schema structure
   */
  buildReasoningSchema(requireReasoning: boolean = true): ReasoningSchema {
    const required = requireReasoning 
      ? ['analysis', 'rationale', 'expectedOutcome']
      : [];

    return {
      type: 'object',
      properties: {
        analysis: this.buildAnalysisSchema(),
        rationale: this.buildRationaleSchema(),
        expectedOutcome: this.buildExpectedOutcomeSchema(),
        alternatives: this.buildAlternativesSchema()
      },
      required
    };
  }

  /**
   * Build decision schema structure
   */
  buildDecisionSchema(): DecisionSchema {
    return {
      type: 'object',
      properties: {
        action: this.buildActionDecisionSchema(),
        resultValidation: this.buildResultValidationSchema(),
        message: this.buildMessageSchema()
      },
      required: ['action', 'message']
    };
  }

  /**
   * Build action decision schema
   */
  buildActionDecisionSchema(): ActionDecisionSchema {
    return {
      enum: ['PROCEED', 'RETRY', 'ABORT'],
      type: 'string',
      description: 'AI decision on how to proceed with execution'
    };
  }

  /**
   * Build result validation schema
   */
  buildResultValidationSchema(): ResultValidationSchema {
    return {
      type: 'object',
      properties: {
        success: this.buildSuccessSchema(),
        expectedElements: this.buildExpectedElementsSchema(),
        actualState: this.buildActualStateSchema(),
        issues: this.buildIssuesSchema()
      },
      required: ['success', 'expectedElements', 'actualState']
    };
  }

  /**
   * Build analysis field schema
   */
  private buildAnalysisSchema(): StringSchema {
    return {
      type: 'string',
      minLength: 10,
      maxLength: 2000,
      description: 'Current situation analysis - describe current page state and previous result evaluation'
    };
  }

  /**
   * Build rationale field schema
   */
  private buildRationaleSchema(): StringSchema {
    return {
      type: 'string',
      minLength: 10,
      maxLength: 1500,
      description: 'Why this specific decision (PROCEED/RETRY/ABORT) was chosen'
    };
  }

  /**
   * Build expected outcome field schema
   */
  private buildExpectedOutcomeSchema(): StringSchema {
    return {
      type: 'string',
      minLength: 5,
      maxLength: 1000,
      description: 'Predicted result of the decision'
    };
  }

  /**
   * Build alternatives field schema
   */
  private buildAlternativesSchema(): StringSchema {
    return {
      type: 'string',
      minLength: 5,
      maxLength: 1000,
      description: 'Other approaches that were considered'
    };
  }

  /**
   * Build message schema for decision
   */
  private buildMessageSchema(): StringSchema {
    return {
      type: 'string',
      minLength: 5,
      maxLength: 500,
      description: 'Clear message describing the decision'
    };
  }

  /**
   * Build success field schema for result validation
   */
  private buildSuccessSchema(): BooleanSchema {
    return {
      type: 'boolean',
      description: 'Overall success assessment of previous execution'
    };
  }

  /**
   * Build expected elements schema for result validation
   */
  private buildExpectedElementsSchema(): ArraySchema {
    return {
      type: 'array',
      items: {
        type: 'string',
        minLength: 1
      },
      minItems: 0,
      maxItems: 20,
      description: 'Elements that should be present on the page'
    };
  }

  /**
   * Build actual state schema for result validation
   */
  private buildActualStateSchema(): StringSchema {
    return {
      type: 'string',
      minLength: 5,
      maxLength: 1000,
      description: 'Description of current page state'
    };
  }

  /**
   * Build issues schema for result validation
   */
  private buildIssuesSchema(): ArraySchema {
    return {
      type: 'array',
      items: {
        type: 'string',
        minLength: 1
      },
      minItems: 0,
      maxItems: 10,
      description: 'Specific problems identified with the current state'
    };
  }

  /**
   * Validate reasoning completeness
   */
  validateReasoningCompleteness(reasoning: any): {
    valid: boolean;
    missingFields: string[];
    invalidFields: string[];
    suggestions: string[];
  } {
    const missingFields: string[] = [];
    const invalidFields: string[] = [];
    const suggestions: string[] = [];

    // Check required fields
    if (!reasoning.analysis || typeof reasoning.analysis !== 'string') {
      missingFields.push('analysis');
    } else if (reasoning.analysis.length < 10) {
      invalidFields.push('analysis');
      suggestions.push('Analysis should be more detailed (minimum 10 characters)');
    }

    if (!reasoning.rationale || typeof reasoning.rationale !== 'string') {
      missingFields.push('rationale');
    } else if (reasoning.rationale.length < 10) {
      invalidFields.push('rationale');
      suggestions.push('Rationale should be more detailed (minimum 10 characters)');
    }

    if (!reasoning.expectedOutcome || typeof reasoning.expectedOutcome !== 'string') {
      missingFields.push('expectedOutcome');
    } else if (reasoning.expectedOutcome.length < 5) {
      invalidFields.push('expectedOutcome');
      suggestions.push('Expected outcome should be more specific (minimum 5 characters)');
    }

    // Optional field validation
    if (reasoning.alternatives && typeof reasoning.alternatives !== 'string') {
      invalidFields.push('alternatives');
      suggestions.push('Alternatives field must be a string if provided');
    }

    return {
      valid: missingFields.length === 0 && invalidFields.length === 0,
      missingFields,
      invalidFields,
      suggestions
    };
  }

  /**
   * Validate decision action against context
   */
  validateDecisionAction(decision: any, previousResult?: any): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!decision || !decision.action) {
      errors.push('Decision action is required');
      return { valid: false, errors, warnings };
    }

    const validActions = ['PROCEED', 'RETRY', 'ABORT'];
    if (!validActions.includes(decision.action)) {
      errors.push(`Invalid decision action: ${decision.action}. Must be one of: ${validActions.join(', ')}`);
    }

    // Validate decision logic consistency
    if (decision.resultValidation) {
      const validation = decision.resultValidation;
      
      if (decision.action === 'PROCEED' && validation.success === false) {
        warnings.push('Decision is PROCEED but result validation indicates failure');
      }
      
      if (decision.action === 'RETRY' && validation.success === true) {
        warnings.push('Decision is RETRY but result validation indicates success');
      }
      
      if (decision.action === 'ABORT' && !validation.issues?.length) {
        warnings.push('Decision is ABORT but no specific issues identified');
      }
    }

    // Command requirements based on decision
    if (decision.action === 'RETRY' && !decision.command) {
      warnings.push('RETRY decision should typically include a corrective command');
    }
    
    if (decision.action === 'ABORT' && decision.command) {
      warnings.push('ABORT decision should not include a command');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate result validation structure
   */
  validateResultValidation(validation: any): {
    valid: boolean;
    errors: string[];
    suggestions: string[];
  } {
    const errors: string[] = [];
    const suggestions: string[] = [];

    if (!validation) {
      return { valid: true, errors, suggestions }; // Optional field
    }

    if (typeof validation.success !== 'boolean') {
      errors.push('Result validation success field must be boolean');
    }

    if (!Array.isArray(validation.expectedElements)) {
      errors.push('Expected elements must be an array');
    } else if (validation.expectedElements.length === 0) {
      suggestions.push('Consider specifying expected elements for better validation');
    }

    if (!validation.actualState || typeof validation.actualState !== 'string') {
      errors.push('Actual state description is required');
    } else if (validation.actualState.length < 5) {
      suggestions.push('Actual state description should be more detailed');
    }

    if (validation.issues && !Array.isArray(validation.issues)) {
      errors.push('Issues must be an array if provided');
    }

    return {
      valid: errors.length === 0,
      errors,
      suggestions
    };
  }

  /**
   * Get reasoning quality score
   */
  getReasoningQualityScore(reasoning: any): {
    score: number; // 0-100
    breakdown: {
      completeness: number;
      specificity: number;
      clarity: number;
      logic: number;
    };
    improvements: string[];
  } {
    const breakdown = {
      completeness: 0,
      specificity: 0,
      clarity: 0,
      logic: 0
    };
    const improvements: string[] = [];

    // Completeness (25 points)
    let completenessScore = 0;
    if (reasoning.analysis) completenessScore += 8;
    if (reasoning.rationale) completenessScore += 8;
    if (reasoning.expectedOutcome) completenessScore += 6;
    if (reasoning.alternatives) completenessScore += 3;
    breakdown.completeness = completenessScore;

    if (!reasoning.alternatives) {
      improvements.push('Consider mentioning alternative approaches');
    }

    // Specificity (25 points)
    let specificityScore = 0;
    if (reasoning.analysis && reasoning.analysis.length > 50) specificityScore += 8;
    if (reasoning.rationale && reasoning.rationale.length > 30) specificityScore += 8;
    if (reasoning.expectedOutcome && reasoning.expectedOutcome.length > 20) specificityScore += 9;
    breakdown.specificity = specificityScore;

    if (reasoning.analysis && reasoning.analysis.length < 50) {
      improvements.push('Provide more detailed analysis');
    }

    // Clarity (25 points) - Basic heuristics
    let clarityScore = 0;
    const analysisWords = reasoning.analysis ? reasoning.analysis.split(' ').length : 0;
    const rationaleWords = reasoning.rationale ? reasoning.rationale.split(' ').length : 0;
    
    if (analysisWords >= 10) clarityScore += 8;
    if (rationaleWords >= 8) clarityScore += 9;
    if (reasoning.expectedOutcome && !reasoning.expectedOutcome.includes('...')) clarityScore += 8;
    breakdown.clarity = clarityScore;

    // Logic (25 points) - Basic consistency checks
    let logicScore = 15; // Base score
    if (reasoning.analysis && reasoning.rationale) {
      // Check for consistent terminology
      const analysisLower = reasoning.analysis.toLowerCase();
      const rationaleLower = reasoning.rationale.toLowerCase();
      
      if (analysisLower.includes('success') && rationaleLower.includes('proceed')) logicScore += 5;
      if (analysisLower.includes('fail') && rationaleLower.includes('retry')) logicScore += 5;
    }
    breakdown.logic = Math.min(logicScore, 25);

    const totalScore = breakdown.completeness + breakdown.specificity + breakdown.clarity + breakdown.logic;
    
    return {
      score: totalScore,
      breakdown,
      improvements
    };
  }

  /**
   * Generate reasoning template for specific decision action
   */
  generateReasoningTemplate(action: 'PROCEED' | 'RETRY' | 'ABORT'): {
    analysis: string;
    rationale: string;
    expectedOutcome: string;
    alternatives?: string;
  } {
    const templates = {
      PROCEED: {
        analysis: '[Describe current page state and why previous execution was successful]',
        rationale: '[Explain why proceeding to next step is the correct choice]',
        expectedOutcome: '[Predict what will happen when the next action is executed]',
        alternatives: '[Mention other approaches that were considered but not chosen]'
      },
      RETRY: {
        analysis: '[Describe current page state and what went wrong with previous execution]',
        rationale: '[Explain why retrying with a different approach will likely succeed]',
        expectedOutcome: '[Predict how the corrective action will resolve the issue]',
        alternatives: '[Mention other retry strategies that were considered]'
      },
      ABORT: {
        analysis: '[Describe current page state and why the situation is unrecoverable]',
        rationale: '[Explain why aborting is the only viable option]',
        expectedOutcome: '[Describe the expected state after aborting execution]',
        alternatives: '[Explain why no viable alternatives exist]'
      }
    };

    return templates[action];
  }
}
