/**
 * AI Schema Manager Types
 * Defines TypeScript interfaces for the AI Schema Manager module
 * that constructs schemas for AI responses containing executor commands
 */

// Import executor types for command integration
import { CommandAction, CommandParameters, ExecutorSession } from './executor';

// Decision Action Types
export enum DecisionAction {
  PROCEED = 'PROCEED',
  RETRY = 'RETRY',
  ABORT = 'ABORT'
}

// Core Schema Manager Interface
export interface AISchemaManager {
  generateResponseSchema(options?: SchemaOptions): Promise<ResponseSchema>;
  validateAIResponse(response: any, schema: ResponseSchema): Promise<ValidationResult>;
  getExecutorMethodSchemas(): ExecutorMethodSchemas;
  updateSchemaVersion(version: string): void;
  getCachedSchema(key: string): ResponseSchema | null;
  clearSchemaCache(): void;
}

// Schema Generation Options
export interface SchemaOptions {
  includeOptionalFields?: boolean;
  requireReasoning?: boolean;
  validationMode?: 'strict' | 'lenient';
  includeExamples?: boolean;
}

// Response Schema Structure
export interface ResponseSchema {
  $schema: string;
  type: 'object';
  properties: {
    decision: DecisionSchema;
    reasoning: ReasoningSchema;
    command?: CommandSchema;
    context?: ContextSchema;
  };
  required: string[];
  additionalProperties: boolean;
  examples?: any[];
}

// Decision Schema Structure
export interface DecisionSchema {
  type: 'object';
  properties: {
    action: ActionDecisionSchema;
    resultValidation?: ResultValidationSchema;
    message: StringSchema;
  };
  required: string[];
  description: string;
}

// Action Decision Schema
export interface ActionDecisionSchema {
  enum: DecisionAction[];
  type: 'string';
  description: string;
}

// Result Validation Schema
export interface ResultValidationSchema {
  type: 'object';
  properties: {
    success: BooleanSchema;
    expectedElements: ArraySchema;
    actualState: StringSchema;
    issues?: ArraySchema;
  };
  required: string[];
  description: string;
}

// Boolean Schema Helper
export interface BooleanSchema extends PropertySchema {
  type: 'boolean';
}

// Array Schema Helper
export interface ArraySchema extends PropertySchema {
  type: 'array';
  items?: PropertySchema;
}

// Reasoning Schema Structure
export interface ReasoningSchema {
  type: 'object';
  properties: {
    analysis: StringSchema;
    rationale: StringSchema;
    expectedOutcome: StringSchema;
    alternatives?: StringSchema;
  };
  required: string[];
  description: string;
}

// Command List Schema removed - AI responses contain only single commands

// Individual Command Schema
export interface CommandSchema {
  type: 'object';
  properties: {
    action: ActionSchema;
    parameters: ParametersSchema;
  };
  required: string[];
  additionalProperties: boolean;
}

// Action Schema (CommandAction enum)
export interface ActionSchema {
  enum: CommandAction[];
  type: 'string';
  description: string;
}

// Parameters Schema for Commands
export interface ParametersSchema {
  type: 'object';
  properties: Record<string, PropertySchema>;
  required: string[];
  additionalProperties: boolean;
}

// Property Schema Definition
export interface PropertySchema {
  type: string;
  format?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  description: string;
  examples?: any[];
}

// String Schema Helper
export interface StringSchema extends PropertySchema {
  type: 'string';
}

// Context Schema for Additional Information
export interface ContextSchema {
  type: 'object';
  properties: {
    sessionId?: StringSchema;
    timestamp?: StringSchema;
    userAgent?: StringSchema;
    metadata?: Record<string, any>;
  };
  additionalProperties: boolean;
}

// Executor Method Schemas Collection
export interface ExecutorMethodSchemas {
  sessionManagement: SessionCommandSchemas;
  automation: AutomationCommandSchemas;
  version: string;
  lastUpdated: Date;
}

// Session Management Command Schemas
export interface SessionCommandSchemas {
  createSession: CommandSchema;
  destroySession: CommandSchema;
  listActiveSessions: CommandSchema;
  getSession: CommandSchema;
}

// Web Automation Command Schemas
export interface AutomationCommandSchemas {
  openPage: CommandSchema;
  clickElement: CommandSchema;
  inputText: CommandSchema;
  saveVariable: CommandSchema;
  getDom: CommandSchema;
}

// AI Response Structure (what gets validated)
export interface AIResponse {
  decision: AIResponseDecision;
  reasoning: AIResponseReasoning;
  command?: ExecutorCommand;
  context?: AIResponseContext;
}

// Decision Structure in AI Response
export interface AIResponseDecision {
  action: DecisionAction;
  resultValidation?: AIResponseResultValidation;
  message: string;
}

// Result Validation in AI Response
export interface AIResponseResultValidation {
  success: boolean;
  expectedElements: string[];
  actualState: string;
  issues?: string[];
}

// Reasoning Structure in AI Response
export interface AIResponseReasoning {
  analysis: string;
  rationale: string;
  expectedOutcome: string;
  alternatives?: string;
}

// Executor Command in AI Response (without sessionId - handled externally)
export interface ExecutorCommand {
  action: CommandAction;
  parameters: Omit<CommandParameters, 'sessionId'>;
}

// Context in AI Response
export interface AIResponseContext {
  sessionId?: string;
  timestamp?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

// Validation Results
export interface ValidationResult {
  valid: boolean;
  errors: SchemaValidationError[];
  warnings: string[];
  executorCompatible: boolean;
  validatedFields: string[];
  performance: ValidationPerformance;
}

// Schema Validation Error
export interface SchemaValidationError {
  field: string;
  message: string;
  value: any;
  expectedType: string;
  path: string[];
  severity: 'error' | 'warning';
  code: string;
}

// Validation Performance Metrics
export interface ValidationPerformance {
  validationTimeMs: number;
  schemaGenerationTimeMs?: number;
  cacheHit: boolean;
  rulesEvaluated: number;
}

// Configuration
export interface AISchemaManagerConfig {
  schemaVersion: string;
  defaultOptions: SchemaOptions;
  cacheEnabled: boolean;
  validationMode: 'strict' | 'lenient';
  reasoningRequired: boolean;
  cacheTTLMs: number;
  maxCacheSize: number;
}

// Schema Cache Entry
export interface SchemaCacheEntry {
  key: string;
  schema: ResponseSchema;
  createdAt: Date;
  accessCount: number;
  lastAccessed: Date;
}

// Schema Generator Interface
export interface SchemaGenerator {
  generate(options: SchemaOptions): Promise<ResponseSchema>;
  generateCommandSchema(action: CommandAction): CommandSchema;
  generateReasoningSchema(required: boolean): ReasoningSchema;
  validateSchema(schema: ResponseSchema): boolean;
}

// Command Schema Builder Interface
export interface CommandSchemaBuilder {
  buildSessionCommandSchemas(): SessionCommandSchemas;
  buildAutomationCommandSchemas(): AutomationCommandSchemas;
  buildParameterSchema(action: CommandAction): ParametersSchema;
  validateCommandCompatibility(command: ExecutorCommand): boolean;
}

// Decision Schema Builder Interface
export interface DecisionSchemaBuilder {
  buildDecisionSchema(): DecisionSchema;
  validateDecisionStructure(decision: AIResponseDecision): boolean;
  getDecisionTemplates(): DecisionTemplate[];
}

// Reasoning Schema Builder Interface
export interface ReasoningSchemaBuilder {
  buildReasoningSchema(options: ReasoningSchemaOptions): ReasoningSchema;
  validateReasoningStructure(reasoning: AIResponseReasoning): boolean;
  getReasoningTemplates(): ReasoningTemplate[];
}

// Reasoning Schema Options
export interface ReasoningSchemaOptions {
  required: boolean;
  includeAlternatives: boolean;
  minAnalysisLength?: number;
  maxAnalysisLength?: number;
  requireExamples?: boolean;
}

// Decision Template
export interface DecisionTemplate {
  name: string;
  description: string;
  action: DecisionAction;
  conditions: string[];
  messageTemplate: string;
  validationRequirements: string[];
}

// Reasoning Template
export interface ReasoningTemplate {
  name: string;
  description: string;
  analysisPrompt: string;
  rationalePrompt: string;
  outcomePrompt: string;
  alternativesPrompt?: string;
}

// Validator Interface
export interface ResponseValidator {
  validate(response: any, schema: ResponseSchema): Promise<ValidationResult>;
  validateDecision(decision: AIResponseDecision): ValidationResult;
  validateCommand(command: ExecutorCommand): ValidationResult;
  validateReasoning(reasoning: AIResponseReasoning): ValidationResult;
  validateDecisionCommandCompatibility(decision: AIResponseDecision, command?: ExecutorCommand): ValidationResult;
  validateAgainstExecutor(response: AIResponse): Promise<boolean>;
}

// Schema Cache Interface
export interface SchemaCache {
  get(key: string): SchemaCacheEntry | null;
  set(key: string, schema: ResponseSchema): void;
  delete(key: string): boolean;
  clear(): void;
  getStats(): SchemaCacheStats;
  cleanup(): void;
}

// Cache Statistics
export interface SchemaCacheStats {
  totalEntries: number;
  hitRate: number;
  averageAccessTime: number;
  memoryUsage: number;
  oldestEntry: Date;
  newestEntry: Date;
}

// Error Types
export enum SchemaErrorType {
  INVALID_COMMAND = 'INVALID_COMMAND',
  INVALID_DECISION = 'INVALID_DECISION',
  MISSING_REASONING = 'MISSING_REASONING',
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',
  DECISION_COMMAND_MISMATCH = 'DECISION_COMMAND_MISMATCH',
  MISSING_RESULT_VALIDATION = 'MISSING_RESULT_VALIDATION',
  SCHEMA_GENERATION_FAILED = 'SCHEMA_GENERATION_FAILED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  EXECUTOR_INCOMPATIBLE = 'EXECUTOR_INCOMPATIBLE',
  CACHE_ERROR = 'CACHE_ERROR'
}

// Schema Manager Error
export interface SchemaManagerError extends Error {
  type: SchemaErrorType;
  details: any;
  timestamp: Date;
  context?: string;
}

// Log Entry for Schema Manager
export interface SchemaManagerLogEntry {
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  timestamp: Date;
  context: {
    operation: string;
    schemaVersion?: string;
    validationTime?: number;
    errorType?: SchemaErrorType;
  };
  metadata?: Record<string, any>;
}

// Export utility types
export type SchemaPropertyType = 'string' | 'number' | 'boolean' | 'object' | 'array';
export type ValidationMode = 'strict' | 'lenient';
export type CommandActionType = keyof typeof CommandAction;

// Constants
export const SCHEMA_MANAGER_VERSION = '1.0.0';
export const DEFAULT_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
export const DEFAULT_MAX_CACHE_SIZE = 100;

// Schema generation presets
export const SCHEMA_PRESETS = {
  SIMPLE: {
    includeOptionalFields: false,
    requireReasoning: true,
    validationMode: 'lenient' as ValidationMode
  },
  COMPREHENSIVE: {
    includeOptionalFields: true,
    requireReasoning: true,
    validationMode: 'strict' as ValidationMode,
    includeExamples: true
  },
  STRICT: {
    includeOptionalFields: false,
    requireReasoning: true,
    validationMode: 'strict' as ValidationMode
  }
} as const;
