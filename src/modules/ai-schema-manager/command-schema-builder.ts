/**
 * Command Schema Builder
 * Constructs JSON schemas for executor command validation
 * Based on design/ai-schema-manager.md specifications
 */

import { CommandAction } from '../../../types/shared-types';
import {
  CommandSchema,
  CommandActionSchema,
  CommandParametersSchema,
  AutomationCommandSchemas,
  ExecutorMethodSchemas,
  SchemaOptions
} from './types';

export class CommandSchemaBuilder {
  /**
   * Build complete command schema structure
   */
  buildCommandSchema(options: SchemaOptions = {}): CommandSchema {
    return {
      type: 'object',
      properties: {
        action: this.buildCommandActionSchema(),
        parameters: this.buildCommandParametersSchema(),
        reasoning: {
          type: 'string',
          description: 'Explanation for this specific command'
        }
      },
      required: ['action', 'parameters'],
      additionalProperties: false
    };
  }

  /**
   * Build command action schema with all available actions
   */
  buildCommandActionSchema(): CommandActionSchema {
    return {
      enum: Object.values(CommandAction),
      type: 'string',
      description: 'Type of automation command to execute'
    };
  }

  /**
   * Build command parameters schema with all possible parameters
   */
  buildCommandParametersSchema(): CommandParametersSchema {
    return {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          format: 'uri',
          description: 'URL to navigate to (OPEN_PAGE only)'
        },
        selector: {
          type: 'string',
          minLength: 1,
          description: 'CSS selector for target element'
        },
        text: {
          type: 'string',
          description: 'Text to input (INPUT_TEXT only)'
        },
        variableName: {
          type: 'string',
          pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$',
          description: 'Variable name for stored value (SAVE_VARIABLE only)'
        },
        attribute: {
          type: 'string',
          description: 'Attribute to extract (GET_CONTENT only)'
        },
        multiple: {
          type: 'boolean',
          description: 'Return array of values from all matching elements (GET_CONTENT only)'
        },
        maxDomSize: {
          type: 'number',
          minimum: 1000,
          maximum: 1000000,
          description: 'Maximum size of returned DOM in characters (GET_SUBDOM only)'
        }
      },
      additionalProperties: false
    };
  }

  /**
   * Build command-specific schemas with proper parameter requirements
   */
  buildAutomationCommandSchemas(): AutomationCommandSchemas {
    return {
      OPEN_PAGE: {
        type: 'object',
        properties: {
          action: { const: 'OPEN_PAGE' },
          parameters: {
            type: 'object',
            properties: {
              url: { type: 'string', format: 'uri' }
            },
            required: ['url'],
            additionalProperties: false
          }
        },
        required: ['action', 'parameters']
      },

      CLICK_ELEMENT: {
        type: 'object',
        properties: {
          action: { const: 'CLICK_ELEMENT' },
          parameters: {
            type: 'object',
            properties: {
              selector: { type: 'string', minLength: 1 }
            },
            required: ['selector'],
            additionalProperties: false
          }
        },
        required: ['action', 'parameters']
      },

      INPUT_TEXT: {
        type: 'object',
        properties: {
          action: { const: 'INPUT_TEXT' },
          parameters: {
            type: 'object',
            properties: {
              selector: { type: 'string', minLength: 1 },
              text: { type: 'string' }
            },
            required: ['selector', 'text'],
            additionalProperties: false
          }
        },
        required: ['action', 'parameters']
      },

      SAVE_VARIABLE: {
        type: 'object',
        properties: {
          action: { const: 'SAVE_VARIABLE' },
          parameters: {
            type: 'object',
            properties: {
              selector: { type: 'string', minLength: 1 },
              variableName: { type: 'string', pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$' }
            },
            required: ['selector', 'variableName'],
            additionalProperties: false
          }
        },
        required: ['action', 'parameters']
      },

      GET_DOM: {
        type: 'object',
        properties: {
          action: { const: 'GET_DOM' },
          parameters: {
            type: 'object',
            properties: {},
            additionalProperties: false
          }
        },
        required: ['action', 'parameters']
      },

      GET_CONTENT: {
        type: 'object',
        properties: {
          action: { const: 'GET_CONTENT' },
          parameters: {
            type: 'object',
            properties: {
              selector: { type: 'string', minLength: 1 },
              attribute: { type: 'string' },
              multiple: { type: 'boolean' }
            },
            required: ['selector'],
            additionalProperties: false
          }
        },
        required: ['action', 'parameters']
      },

      GET_SUBDOM: {
        type: 'object',
        properties: {
          action: { const: 'GET_SUBDOM' },
          parameters: {
            type: 'object',
            properties: {
              selector: { type: 'string', minLength: 1 },
              maxDomSize: { type: 'number', minimum: 1000, maximum: 1000000 }
            },
            required: ['selector'],
            additionalProperties: false
          }
        },
        required: ['action', 'parameters']
      }
    };
  }

  /**
   * Get complete executor method schemas
   */
  getExecutorMethodSchemas(): ExecutorMethodSchemas {
    return {
      commands: this.buildAutomationCommandSchemas(),
      parameters: this.buildCommandParametersSchema()
    };
  }

  /**
   * Validate command action against available actions
   */
  isValidCommandAction(action: string): action is CommandAction {
    return Object.values(CommandAction).includes(action as CommandAction);
  }

  /**
   * Get required parameters for a specific command action
   */
  getRequiredParametersForAction(action: CommandAction): string[] {
    const schemas = this.buildAutomationCommandSchemas();
    const actionSchema = schemas[action];
    
    if (!actionSchema || !actionSchema.properties.parameters) {
      return [];
    }

    return actionSchema.properties.parameters.required || [];
  }

  /**
   * Validate parameter requirements for a specific command
   */
  validateParametersForAction(action: CommandAction, parameters: Record<string, any>): {
    valid: boolean;
    missingRequired: string[];
    invalidParameters: string[];
  } {
    const requiredParams = this.getRequiredParametersForAction(action);
    const schemas = this.buildAutomationCommandSchemas();
    const actionSchema = schemas[action];
    
    const missingRequired: string[] = [];
    const invalidParameters: string[] = [];
    
    // Check for missing required parameters
    for (const required of requiredParams) {
      if (!(required in parameters)) {
        missingRequired.push(required);
      }
    }
    
    // Check for invalid parameters (not defined in schema)
    if (actionSchema?.properties.parameters?.properties) {
      const validParams = Object.keys(actionSchema.properties.parameters.properties);
      for (const param of Object.keys(parameters)) {
        if (!validParams.includes(param)) {
          invalidParameters.push(param);
        }
      }
    }
    
    return {
      valid: missingRequired.length === 0 && invalidParameters.length === 0,
      missingRequired,
      invalidParameters
    };
  }

  /**
   * Get schema for a specific command action
   */
  getSchemaForAction(action: CommandAction): object | null {
    const schemas = this.buildAutomationCommandSchemas();
    return schemas[action] || null;
  }

  /**
   * Build variable interpolation pattern for parameter validation
   */
  buildVariableInterpolationPattern(): string {
    // Matches ${variable_name} pattern
    return '\\$\\{[a-zA-Z_][a-zA-Z0-9_]*\\}';
  }

  /**
   * Validate selector string format
   */
  validateSelectorFormat(selector: string): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!selector || selector.trim().length === 0) {
      errors.push('Selector cannot be empty');
      return { valid: false, errors, warnings };
    }

    // Basic CSS selector validation
    const trimmedSelector = selector.trim();
    
    // Check for obviously invalid selectors
    if (trimmedSelector.includes('..')) {
      errors.push('Invalid CSS selector: consecutive dots not allowed');
    }
    
    if (trimmedSelector.startsWith('.') && trimmedSelector.length === 1) {
      errors.push('Invalid CSS selector: empty class selector');
    }
    
    if (trimmedSelector.startsWith('#') && trimmedSelector.length === 1) {
      errors.push('Invalid CSS selector: empty ID selector');
    }

    // Warning for complex selectors that might be brittle
    if (trimmedSelector.split(' ').length > 5) {
      warnings.push('Complex selector with many descendants may be brittle');
    }

    if (trimmedSelector.includes(':nth-child(') || trimmedSelector.includes(':nth-of-type(')) {
      warnings.push('Position-based selectors may be fragile if page structure changes');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate URL format for OPEN_PAGE command
   */
  validateUrlFormat(url: string): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!url || url.trim().length === 0) {
      errors.push('URL cannot be empty');
      return { valid: false, errors, warnings };
    }

    try {
      const urlObj = new URL(url);
      
      // Check for secure protocols in production
      if (urlObj.protocol !== 'https:' && urlObj.protocol !== 'http:') {
        errors.push(`Unsupported protocol: ${urlObj.protocol}`);
      }
      
      if (urlObj.protocol === 'http:' && !urlObj.hostname.includes('localhost') && !urlObj.hostname.includes('127.0.0.1')) {
        warnings.push('HTTP protocol used for external URL, consider HTTPS for security');
      }
      
    } catch (e) {
      errors.push(`Invalid URL format: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate variable name format
   */
  validateVariableNameFormat(variableName: string): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    if (!variableName || variableName.trim().length === 0) {
      errors.push('Variable name cannot be empty');
      return { valid: false, errors };
    }

    const pattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    if (!pattern.test(variableName)) {
      errors.push('Variable name must start with letter or underscore and contain only letters, numbers, and underscores');
    }

    // Check for reserved words
    const reservedWords = ['true', 'false', 'null', 'undefined', 'this', 'self', 'window', 'document'];
    if (reservedWords.includes(variableName.toLowerCase())) {
      errors.push(`Variable name "${variableName}" is a reserved word`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
