/**
 * Schema Generator
 * Core schema generation logic for AI responses
 * Based on design/ai-schema-manager.md specifications
 */

import {
  ResponseSchema,
  ScreenshotAnalysisSchema,
  ScreenshotComparisonSchema,
  ScreenshotAnalysisSchemas,
  ExecutorMethodSchemas,
  ScreenshotAnalysisType,
  SchemaOptions,
  ScreenshotSchemaOptions,
  ComparisonSchemaOptions,
  ContextSchema,
  StringSchema,
  ObjectSchema
} from './types';
import { CommandSchemaBuilder } from './command-schema-builder';
import { ReasoningSchemaBuilder } from './reasoning-schema-builder';
import { ScreenshotSchemaBuilder } from './screenshot-schema-builder';

export class SchemaGenerator {
  private commandSchemaBuilder: CommandSchemaBuilder;
  private reasoningSchemaBuilder: ReasoningSchemaBuilder;
  private screenshotSchemaBuilder: ScreenshotSchemaBuilder;
  private currentVersion: string;

  constructor(version: string = '1.0.0') {
    this.commandSchemaBuilder = new CommandSchemaBuilder();
    this.reasoningSchemaBuilder = new ReasoningSchemaBuilder();
    this.screenshotSchemaBuilder = new ScreenshotSchemaBuilder();
    this.currentVersion = version;
  }

  /**
   * Generate complete response schema for AI responses
   */
  async generateResponseSchema(options: SchemaOptions = {}): Promise<ResponseSchema> {
    const defaultOptions: SchemaOptions = {
      includeOptionalFields: true,
      requireReasoning: true,
      validationMode: 'strict'
    };

    const finalOptions = { ...defaultOptions, ...options };

    const properties: any = {
      decision: this.reasoningSchemaBuilder.buildDecisionSchema(),
      reasoning: this.reasoningSchemaBuilder.buildReasoningSchema(finalOptions.requireReasoning)
    };

    // Add command schema (single optional command as per updated design)
    if (finalOptions.includeOptionalFields) {
      properties.command = this.commandSchemaBuilder.buildCommandSchema(finalOptions);
    }

    // Add context schema if optional fields are included
    if (finalOptions.includeOptionalFields) {
      properties.context = this.buildContextSchema();
    }

    const required = ['decision'];
    if (finalOptions.requireReasoning) {
      required.push('reasoning');
    }

    return {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties,
      required,
      additionalProperties: finalOptions.validationMode === 'lenient'
    };
  }

  /**
   * Generate screenshot analysis schema
   */
  async generateScreenshotAnalysisSchema(
    analysisType: ScreenshotAnalysisType,
    options: ScreenshotSchemaOptions = {}
  ): Promise<ScreenshotAnalysisSchema> {
    return this.screenshotSchemaBuilder.buildScreenshotAnalysisSchema(analysisType, options);
  }

  /**
   * Generate screenshot comparison schema
   */
  async generateScreenshotComparisonSchema(
    options: ComparisonSchemaOptions = {}
  ): Promise<ScreenshotComparisonSchema> {
    return this.screenshotSchemaBuilder.buildScreenshotComparisonSchema(options);
  }

  /**
   * Get all executor method schemas
   */
  getExecutorMethodSchemas(): ExecutorMethodSchemas {
    return this.commandSchemaBuilder.getExecutorMethodSchemas();
  }

  /**
   * Get all screenshot analysis schemas
   */
  getScreenshotAnalysisSchemas(): ScreenshotAnalysisSchemas {
    return this.screenshotSchemaBuilder.buildScreenshotAnalysisSchemas();
  }

  /**
   * Update schema version
   */
  updateSchemaVersion(version: string): void {
    this.currentVersion = version;
  }

  /**
   * Get current schema version
   */
  getCurrentVersion(): string {
    return this.currentVersion;
  }

  /**
   * Build context schema for additional AI response data
   */
  private buildContextSchema(): ContextSchema {
    return {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'Session identifier for the current workflow'
        },
        stepIndex: {
          type: 'number',
          minimum: 0,
          description: 'Current step index in the workflow'
        },
        timestamp: {
          type: 'string',
          format: 'date-time',
          description: 'Timestamp of the AI response'
        },
        executionTime: {
          type: 'number',
          minimum: 0,
          description: 'Time taken to generate the response in milliseconds'
        },
        modelInfo: {
          type: 'object',
          properties: {
            model: { type: 'string' },
            version: { type: 'string' },
            temperature: { type: 'number' },
            maxTokens: { type: 'number' }
          }
        },
        pageInfo: {
          type: 'object',
          properties: {
            url: { type: 'string', format: 'uri' },
            title: { type: 'string' },
            lastModified: { type: 'string', format: 'date-time' }
          }
        },
        variables: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description: 'Current session variables'
        },
        debugInfo: {
          type: 'object',
          properties: {
            domSize: { type: 'number' },
            screenshotId: { type: 'string' },
            processingSteps: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        }
      },
      additionalProperties: true
    };
  }

  /**
   * Generate schema for specific command validation
   */
  generateCommandValidationSchema(action: string): object | null {
    if (!this.commandSchemaBuilder.isValidCommandAction(action)) {
      return null;
    }

    return this.commandSchemaBuilder.getSchemaForAction(action as any);
  }

  /**
   * Generate schema template for AI training/fine-tuning
   */
  generateSchemaTemplate(options: SchemaOptions = {}): {
    example: object;
    schema: ResponseSchema;
    description: string;
  } {
    const schema = this.generateResponseSchema(options);
    
    const example = {
      decision: {
        action: "PROCEED",
        message: "Login form found, proceeding to enter credentials",
        resultValidation: {
          success: true,
          expectedElements: ["input[name='username']", "input[name='password']", "button[type='submit']"],
          actualState: "Login page loaded successfully with all required form elements visible"
        }
      },
      reasoning: {
        analysis: "The page has loaded successfully and contains the expected login form with username, password, and submit button elements.",
        rationale: "All required elements are present and accessible, making it safe to proceed with credential entry.",
        expectedOutcome: "Username will be entered into the form field successfully, preparing for password entry.",
        alternatives: "Could validate form fields first, but they appear functional based on visual inspection."
      },
      command: {
        action: "INPUT_TEXT",
        parameters: {
          selector: "input[name='username']",
          text: "${saved_username}"
        },
        reasoning: "Enter username as the first step in the login process"
      },
      context: {
        sessionId: "session_123",
        stepIndex: 1,
        timestamp: new Date().toISOString(),
        executionTime: 1250,
        pageInfo: {
          url: "https://example.com/login",
          title: "Login - Example Site"
        }
      }
    };

    const description = `
This schema defines the structure for AI responses in the web automation system.
The response must include:
1. A decision on how to proceed (PROCEED, RETRY, or ABORT)
2. Structured reasoning explaining the decision
3. Optionally, a single command to execute
4. Additional context information

Key principles:
- Single command per response (not an array)
- Clear reasoning for transparency
- Proper decision validation
- Executor-compatible command structure
`;

    return {
      example,
      schema: schema as ResponseSchema,
      description: description.trim()
    };
  }

  /**
   * Generate schema for multi-modal responses (text + visual)
   */
  generateMultiModalSchema(
    includeVisualAnalysis: boolean = true,
    analysisType?: ScreenshotAnalysisType,
    options: SchemaOptions & ScreenshotSchemaOptions = {}
  ): object {
    const baseSchema = this.generateResponseSchema(options);
    
    if (!includeVisualAnalysis) {
      return baseSchema;
    }

    const multiModalSchema = { ...baseSchema };
    
    // Add visual analysis properties
    if (analysisType) {
      const visualSchema = this.screenshotSchemaBuilder.buildScreenshotAnalysisSchema(analysisType, options);
      (multiModalSchema.properties as any).visualAnalysis = visualSchema;
    } else {
      // Add generic visual analysis container
      (multiModalSchema.properties as any).visualAnalysis = {
        type: 'object',
        properties: {
          type: this.screenshotSchemaBuilder.buildAnalysisTypeSchema(),
          summary: { type: 'string', minLength: 10 },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          elements: this.screenshotSchemaBuilder.buildVisualElementsSchema(options)
        }
      };
    }

    return multiModalSchema;
  }

  /**
   * Validate schema compatibility with executor module
   */
  validateExecutorCompatibility(schema: ResponseSchema): {
    compatible: boolean;
    issues: string[];
    warnings: string[];
  } {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Check command schema compatibility
    if (schema.properties.command) {
      const commandSchema = schema.properties.command;
      
      // Verify it's a single command, not array
      if (commandSchema.type !== 'object') {
        issues.push('Command schema must be an object type (single command)');
      }

      // Check required properties
      if (!commandSchema.properties || !commandSchema.properties.action) {
        issues.push('Command schema missing action property');
      }

      if (!commandSchema.properties || !commandSchema.properties.parameters) {
        issues.push('Command schema missing parameters property');
      }

      // Verify required fields
      if (!commandSchema.required || !commandSchema.required.includes('action')) {
        issues.push('Command schema must require action field');
      }

      if (!commandSchema.required || !commandSchema.required.includes('parameters')) {
        issues.push('Command schema must require parameters field');
      }
    }

    // Check decision schema
    if (!schema.properties.decision) {
      issues.push('Response schema missing decision property');
    } else {
      const decisionSchema = schema.properties.decision;
      if (!decisionSchema.properties || !decisionSchema.properties.action) {
        issues.push('Decision schema missing action property');
      }
    }

    // Warnings for optional optimizations
    if (!schema.properties.reasoning) {
      warnings.push('Response schema lacks reasoning field - AI transparency will be limited');
    }

    if (!schema.properties.context) {
      warnings.push('Response schema lacks context field - debugging capabilities will be limited');
    }

    return {
      compatible: issues.length === 0,
      issues,
      warnings
    };
  }

  /**
   * Generate performance optimized schema (minimal fields)
   */
  generateOptimizedSchema(): ResponseSchema {
    return {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        decision: {
          type: 'object',
          properties: {
            action: {
              enum: ['PROCEED', 'RETRY', 'ABORT'],
              type: 'string'
            },
            message: { type: 'string', minLength: 1, maxLength: 200 }
          },
          required: ['action', 'message']
        },
        command: {
          type: 'object',
          properties: {
            action: this.commandSchemaBuilder.buildCommandActionSchema(),
            parameters: this.commandSchemaBuilder.buildCommandParametersSchema()
          },
          required: ['action', 'parameters']
        }
      },
      required: ['decision'],
      additionalProperties: false
    };
  }
}
