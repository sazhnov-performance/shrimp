/**
 * Response Validator
 * Validates AI responses against generated schemas
 * Based on design/ai-schema-manager.md specifications
 */

import Ajv, { JSONSchemaType, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import {
  ResponseSchema,
  ValidationResult,
  SchemaValidationError,
  SchemaOptions,
  DecisionAction
} from './types';
import { CommandSchemaBuilder } from './command-schema-builder';
import { ReasoningSchemaBuilder } from './reasoning-schema-builder';

export class Validator {
  private ajv: Ajv;
  private commandSchemaBuilder: CommandSchemaBuilder;
  private reasoningSchemaBuilder: ReasoningSchemaBuilder;
  private validatorCache: Map<string, ValidateFunction>;

  constructor() {
    this.ajv = new Ajv({ allErrors: true, verbose: true });
    addFormats(this.ajv);
    this.commandSchemaBuilder = new CommandSchemaBuilder();
    this.reasoningSchemaBuilder = new ReasoningSchemaBuilder();
    this.validatorCache = new Map();
  }

  /**
   * Validate AI response against schema
   */
  async validateAIResponse(response: any, schema: ResponseSchema): Promise<ValidationResult> {
    const errors: SchemaValidationError[] = [];
    const warnings: string[] = [];

    try {
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
          errors.push({
            field: error.instancePath || error.schemaPath,
            message: error.message || 'Unknown validation error',
            value: error.data,
            expectedType: this.extractExpectedType(error),
            path: this.parsePath(error.instancePath || '')
          });
        }
      }

      // Perform additional semantic validation
      const semanticValidation = await this.performSemanticValidation(response);
      errors.push(...semanticValidation.errors);
      warnings.push(...semanticValidation.warnings);

      // Check executor compatibility
      const compatibilityCheck = this.checkExecutorCompatibility(response);
      if (!compatibilityCheck.compatible) {
        errors.push(...compatibilityCheck.errors.map(error => ({
          field: 'compatibility',
          message: error,
          value: response,
          expectedType: 'executor-compatible',
          path: ['root']
        })));
      }
      warnings.push(...compatibilityCheck.warnings);

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        executorCompatible: compatibilityCheck.compatible
      };

    } catch (error) {
      errors.push({
        field: 'validation',
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        value: response,
        expectedType: 'valid_response',
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
   * Perform semantic validation beyond JSON schema
   */
  private async performSemanticValidation(response: any): Promise<{
    errors: SchemaValidationError[];
    warnings: string[];
  }> {
    const errors: SchemaValidationError[] = [];
    const warnings: string[] = [];

    // Validate decision logic
    if (response.decision) {
      const decisionValidation = this.reasoningSchemaBuilder.validateDecisionAction(response.decision);
      if (!decisionValidation.valid) {
        errors.push(...decisionValidation.errors.map(error => ({
          field: 'decision.action',
          message: error,
          value: response.decision.action,
          expectedType: 'valid_decision_action',
          path: ['decision', 'action']
        })));
      }
      warnings.push(...decisionValidation.warnings);
    }

    // Validate reasoning completeness
    if (response.reasoning) {
      const reasoningValidation = this.reasoningSchemaBuilder.validateReasoningCompleteness(response.reasoning);
      if (!reasoningValidation.valid) {
        errors.push(...reasoningValidation.missingFields.map(field => ({
          field: `reasoning.${field}`,
          message: `Missing required reasoning field: ${field}`,
          value: undefined,
          expectedType: 'string',
          path: ['reasoning', field]
        })));
        
        errors.push(...reasoningValidation.invalidFields.map(field => ({
          field: `reasoning.${field}`,
          message: `Invalid reasoning field: ${field}`,
          value: response.reasoning[field],
          expectedType: 'valid_reasoning_content',
          path: ['reasoning', field]
        })));
      }
      warnings.push(...reasoningValidation.suggestions);
    }

    // Validate command parameters
    if (response.command) {
      const commandValidation = this.validateCommandParameters(response.command);
      errors.push(...commandValidation.errors);
      warnings.push(...commandValidation.warnings);
    }

    // Validate decision-command consistency
    const consistencyValidation = this.validateDecisionCommandConsistency(response);
    errors.push(...consistencyValidation.errors);
    warnings.push(...consistencyValidation.warnings);

    return { errors, warnings };
  }

  /**
   * Validate command parameters against action requirements
   */
  private validateCommandParameters(command: any): {
    errors: SchemaValidationError[];
    warnings: string[];
  } {
    const errors: SchemaValidationError[] = [];
    const warnings: string[] = [];

    if (!command.action) {
      errors.push({
        field: 'command.action',
        message: 'Command action is required',
        value: undefined,
        expectedType: 'CommandAction',
        path: ['command', 'action']
      });
      return { errors, warnings };
    }

    if (!this.commandSchemaBuilder.isValidCommandAction(command.action)) {
      errors.push({
        field: 'command.action',
        message: `Invalid command action: ${command.action}`,
        value: command.action,
        expectedType: 'CommandAction',
        path: ['command', 'action']
      });
      return { errors, warnings };
    }

    // Validate parameters for the specific action
    const paramValidation = this.commandSchemaBuilder.validateParametersForAction(
      command.action,
      command.parameters || {}
    );

    if (!paramValidation.valid) {
      errors.push(...paramValidation.missingRequired.map(param => ({
        field: `command.parameters.${param}`,
        message: `Missing required parameter: ${param}`,
        value: undefined,
        expectedType: 'string',
        path: ['command', 'parameters', param]
      })));

      errors.push(...paramValidation.invalidParameters.map(param => ({
        field: `command.parameters.${param}`,
        message: `Invalid parameter: ${param}`,
        value: command.parameters[param],
        expectedType: 'valid_parameter',
        path: ['command', 'parameters', param]
      })));
    }

    // Validate specific parameter formats
    if (command.parameters) {
      if (command.parameters.selector) {
        const selectorValidation = this.commandSchemaBuilder.validateSelectorFormat(command.parameters.selector);
        if (!selectorValidation.valid) {
          errors.push(...selectorValidation.errors.map(error => ({
            field: 'command.parameters.selector',
            message: error,
            value: command.parameters.selector,
            expectedType: 'valid_css_selector',
            path: ['command', 'parameters', 'selector']
          })));
        }
        warnings.push(...selectorValidation.warnings);
      }

      if (command.parameters.url) {
        const urlValidation = this.commandSchemaBuilder.validateUrlFormat(command.parameters.url);
        if (!urlValidation.valid) {
          errors.push(...urlValidation.errors.map(error => ({
            field: 'command.parameters.url',
            message: error,
            value: command.parameters.url,
            expectedType: 'valid_url',
            path: ['command', 'parameters', 'url']
          })));
        }
        warnings.push(...urlValidation.warnings);
      }

      if (command.parameters.variableName) {
        const variableValidation = this.commandSchemaBuilder.validateVariableNameFormat(command.parameters.variableName);
        if (!variableValidation.valid) {
          errors.push(...variableValidation.errors.map(error => ({
            field: 'command.parameters.variableName',
            message: error,
            value: command.parameters.variableName,
            expectedType: 'valid_variable_name',
            path: ['command', 'parameters', 'variableName']
          })));
        }
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate consistency between decision and command
   */
  private validateDecisionCommandConsistency(response: any): {
    errors: SchemaValidationError[];
    warnings: string[];
  } {
    const errors: SchemaValidationError[] = [];
    const warnings: string[] = [];

    if (!response.decision) {
      return { errors, warnings };
    }

    const decision = response.decision.action;
    const hasCommand = !!response.command;

    switch (decision) {
      case 'PROCEED':
        // PROCEED can have a command or not
        break;

      case 'RETRY':
        if (!hasCommand) {
          warnings.push('RETRY decision typically should include a corrective command');
        }
        break;

      case 'ABORT':
        if (hasCommand) {
          warnings.push('ABORT decision should not include a command as execution should halt');
        }
        break;

      default:
        errors.push({
          field: 'decision.action',
          message: `Unknown decision action: ${decision}`,
          value: decision,
          expectedType: 'PROCEED | RETRY | ABORT',
          path: ['decision', 'action']
        });
    }

    // Check if result validation is consistent with decision
    if (response.decision.resultValidation) {
      const validation = response.decision.resultValidation;
      
      if (decision === 'PROCEED' && validation.success === false) {
        warnings.push('Decision is PROCEED but result validation indicates failure');
      }
      
      if (decision === 'RETRY' && validation.success === true) {
        warnings.push('Decision is RETRY but result validation indicates success');
      }
    }

    return { errors, warnings };
  }

  /**
   * Check executor compatibility
   */
  private checkExecutorCompatibility(response: any): {
    compatible: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check that command structure is compatible
    if (response.command) {
      if (Array.isArray(response.command)) {
        errors.push('Command should be a single object, not an array (updated design)');
      }

      if (!response.command.action || !response.command.parameters) {
        errors.push('Command must have both action and parameters properties');
      }
    }

    // Check that decision structure exists
    if (!response.decision || !response.decision.action) {
      errors.push('Response must include decision with action');
    }

    // Session ID should not be present in AI response (injected by Task Loop)
    if (response.command && response.command.sessionId) {
      warnings.push('Command contains sessionId - this should be injected by Task Loop');
    }

    return {
      compatible: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Generate cache key for schema
   */
  private generateSchemaKey(schema: ResponseSchema): string {
    return JSON.stringify({
      required: schema.required,
      hasCommand: !!schema.properties.command,
      hasReasoning: !!schema.properties.reasoning,
      hasContext: !!schema.properties.context
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
   * Validate single field value
   */
  validateField(fieldName: string, value: any, expectedType: string): {
    valid: boolean;
    error?: string;
  } {
    try {
      switch (expectedType) {
        case 'DecisionAction':
          return {
            valid: ['PROCEED', 'RETRY', 'ABORT'].includes(value),
            error: !['PROCEED', 'RETRY', 'ABORT'].includes(value) 
              ? `Invalid decision action: ${value}` 
              : undefined
          };

        case 'CommandAction':
          return {
            valid: this.commandSchemaBuilder.isValidCommandAction(value),
            error: !this.commandSchemaBuilder.isValidCommandAction(value) 
              ? `Invalid command action: ${value}` 
              : undefined
          };

        case 'string':
          return {
            valid: typeof value === 'string',
            error: typeof value !== 'string' ? `Expected string, got ${typeof value}` : undefined
          };

        case 'number':
          return {
            valid: typeof value === 'number',
            error: typeof value !== 'number' ? `Expected number, got ${typeof value}` : undefined
          };

        case 'boolean':
          return {
            valid: typeof value === 'boolean',
            error: typeof value !== 'boolean' ? `Expected boolean, got ${typeof value}` : undefined
          };

        case 'array':
          return {
            valid: Array.isArray(value),
            error: !Array.isArray(value) ? `Expected array, got ${typeof value}` : undefined
          };

        case 'object':
          return {
            valid: typeof value === 'object' && value !== null && !Array.isArray(value),
            error: !(typeof value === 'object' && value !== null && !Array.isArray(value)) 
              ? `Expected object, got ${typeof value}` 
              : undefined
          };

        default:
          return { valid: true };
      }
    } catch (error) {
      return {
        valid: false,
        error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get validation statistics
   */
  getValidationStats(): {
    totalValidations: number;
    cachedValidators: number;
    averageValidationTime: number;
    commonErrors: Array<{ error: string; count: number }>;
  } {
    // This would be implemented with actual metrics collection
    // For now, return basic cache statistics
    return {
      totalValidations: 0, // Would track this in production
      cachedValidators: this.validatorCache.size,
      averageValidationTime: 0, // Would measure this in production
      commonErrors: [] // Would aggregate this from validation history
    };
  }

  /**
   * Clear validation cache
   */
  clearCache(): void {
    this.validatorCache.clear();
  }
}
