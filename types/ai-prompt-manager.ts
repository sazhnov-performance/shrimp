/**
 * AI Prompt Manager Types
 * Defines TypeScript interfaces for the AI Prompt Manager module
 * that generates context-aware prompts for AI web browser agents
 */

// Import related types for integration
import { ResponseSchema, SchemaOptions, DecisionAction } from './ai-schema-manager';
import { AIContextJson, ExecutionStatus } from './ai-context-manager';
import { CommandAction } from './executor';

// Core Prompt Manager Interface
export interface AIPromptManager {
  generateActionPrompt(request: ActionPromptRequest): Promise<GeneratedPrompt>;
  generateReflectionPrompt(request: ReflectionPromptRequest): Promise<GeneratedPrompt>;
  getPromptTemplates(): PromptTemplateCollection;
  updatePromptTemplate(templateId: string, template: PromptTemplate): void;
  validatePromptStructure(prompt: GeneratedPrompt): PromptValidationResult;
}

// Prompt Request Types
export interface ActionPromptRequest {
  sessionId: string;
  currentStepIndex: number;
  currentStepContent: string;
  includeValidation: boolean;
  promptOptions?: PromptOptions;
}

export interface ReflectionPromptRequest {
  sessionId: string;
  completedStepIndex: number;
  nextStepIndex: number;
  nextStepContent: string;
  expectedOutcome?: string;
  promptOptions?: PromptOptions;
}

// Prompt Structure Types
export interface GeneratedPrompt {
  promptId: string;
  sessionId: string;
  stepIndex: number;
  promptType: PromptType;
  content: PromptContent;
  schema: ResponseSchema;
  generatedAt: Date;
  metadata?: Record<string, any>;
}

export enum PromptType {
  INITIAL_ACTION = 'INITIAL_ACTION',
  ACTION_WITH_VALIDATION = 'ACTION_WITH_VALIDATION',
  REFLECTION_AND_ACTION = 'REFLECTION_AND_ACTION'
}

export interface PromptContent {
  systemMessage: string;
  contextSection: ContextSection;
  instructionSection: InstructionSection;
  validationSection?: ValidationSection;
  schemaSection: SchemaSection;
  examplesSection?: ExamplesSection;
}

export interface InstructionSection {
  currentStepInstruction: string;
  actionGuidance: string;
  constraints: string[];
  objectives: string[];
}

export interface SchemaSection {
  responseFormat: string;
  schemaDefinition: ResponseSchema;
  examples?: any[];
  validationRules: string[];
}

export interface ExamplesSection {
  goodExamples: PromptExample[];
  badExamples: PromptExample[];
  explanations: string[];
}

export interface PromptExample {
  scenario: string;
  prompt: string;
  response: any;
  explanation: string;
}

// Context Integration Types
export interface ContextSection {
  currentStep: StepContext;
  executionHistory: ExecutionHistorySection;
  pageStates: PageStateSection;
  sessionMetadata?: Record<string, any>;
}

export interface StepContext {
  stepIndex: number;
  stepContent: string;
  stepType: 'initial' | 'continuation' | 'validation';
  totalSteps: number;
}

export interface ExecutionHistorySection {
  previousSteps: StepExecutionSummary[];
  chronologicalEvents: ExecutionEventSummary[];
  successfulActions: number;
  failedActions: number;
}

export interface StepExecutionSummary {
  stepIndex: number;
  stepName: string;
  reasoning: string;
  executorMethod: string;
  status: ExecutionStatus;
  timestamp: Date;
}

export interface ExecutionEventSummary {
  stepIndex: number;
  reasoning: string;
  executorMethod: string;
  outcome: string;
  timestamp: Date;
}

// Page State Management Types
export interface PageStateSection {
  previousPageDom?: string;
  currentPageDom?: string;
  domComparison?: DomComparisonResult;
  relevantElements?: ElementContext[];
}

export interface DomComparisonResult {
  hasChanges: boolean;
  addedElements: string[];
  removedElements: string[];
  modifiedElements: string[];
  summary: string;
}

export interface ElementContext {
  selector: string;
  elementType: string;
  textContent?: string;
  attributes?: Record<string, string>;
  relevanceScore: number;
}

// Validation and Reflection Types
export interface ValidationSection {
  lastActionValidation: ActionValidationPrompt;
  resultAnalysis: ResultAnalysisPrompt;
  decisionFramework: DecisionFrameworkPrompt;
}

export interface ActionValidationPrompt {
  expectedOutcome: string;
  actualState: string;
  validationCriteria: ValidationCriteria[];
  successIndicators: string[];
  failureIndicators: string[];
}

export interface ValidationCriteria {
  criterion: string;
  evaluationMethod: string;
  weight: number;
  description: string;
}

export interface ResultAnalysisPrompt {
  analysisInstructions: string;
  comparisonPoints: string[];
  domAnalysisGuidance: string;
  errorDetectionGuidance: string;
}

export interface DecisionFrameworkPrompt {
  decisionOptions: DecisionOption[];
  decisionCriteria: string[];
  proceedConditions: string[];
  retryConditions: string[];
  abortConditions: string[];
}

export interface DecisionOption {
  action: DecisionAction;
  description: string;
  conditions: string[];
  consequences: string[];
}

// Template Management Types
export interface PromptTemplateCollection {
  systemMessageTemplate: PromptTemplate;
  actionPromptTemplate: PromptTemplate;
  reflectionPromptTemplate: PromptTemplate;
  validationPromptTemplate: PromptTemplate;
  contextTemplate: PromptTemplate;
  schemaTemplate: PromptTemplate;
}

export interface PromptTemplate {
  templateId: string;
  name: string;
  description: string;
  template: string;
  variables: TemplateVariable[];
  version: string;
  lastModified: Date;
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
  defaultValue?: any;
}

// Configuration Types
export interface PromptOptions {
  includeExecutionHistory?: boolean;
  maxHistorySteps?: number;
  includeDomComparison?: boolean;
  includeElementContext?: boolean;
  validationMode?: 'strict' | 'lenient';
  reasoningDepth?: 'basic' | 'detailed' | 'comprehensive';
  includeExamples?: boolean;
  customInstructions?: string;
}

export interface AIPromptManagerConfig {
  defaultPromptOptions: PromptOptions;
  templateConfig: TemplateConfig;
  contextConfig: ContextConfig;
  validationConfig: ValidationConfig;
  performanceConfig: PerformanceConfig;
}

export interface TemplateConfig {
  enableCustomTemplates: boolean;
  templateCacheEnabled: boolean;
  templateValidationEnabled: boolean;
  fallbackToDefault: boolean;
}

export interface ContextConfig {
  maxDomSize: number;
  maxHistoryItems: number;
  includeTimestamps: boolean;
  compressLargeDom: boolean;
  highlightRelevantElements: boolean;
}

export interface ValidationConfig {
  enableActionValidation: boolean;
  enableResultAnalysis: boolean;
  validationTimeoutMs: number;
  requireExplicitValidation: boolean;
}

export interface PerformanceConfig {
  promptCacheEnabled: boolean;
  cacheTTLMs: number;
  maxCacheSize: number;
  asyncGeneration: boolean;
}

// Integration Interface Types
export interface SchemaManagerIntegration {
  getResponseSchema(options?: SchemaOptions): Promise<ResponseSchema>;
  validateSchemaCompatibility(schema: ResponseSchema): boolean;
  getSchemaVersion(): string;
}

export interface ContextManagerIntegration {
  getExecutionContext(sessionId: string, stepIndex: number): Promise<AIContextJson>;
  getStepHistory(sessionId: string, maxSteps?: number): Promise<StepExecutionSummary[]>;
  getCurrentPageState(sessionId: string): Promise<string>;
  getPreviousPageState(sessionId: string, stepIndex: number): Promise<string | null>;
}

// Validation and Quality Assurance Types
export interface PromptValidationResult {
  isValid: boolean;
  errors: PromptValidationError[];
  warnings: string[];
  qualityScore: number;
  suggestions: string[];
}

export interface PromptValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  code: string;
}

export interface IPromptValidator {
  validatePromptStructure(prompt: GeneratedPrompt): PromptValidationResult;
  validateTemplateVariables(template: PromptTemplate, variables: Record<string, any>): boolean;
  validateSchemaIntegration(prompt: GeneratedPrompt): boolean;
  assessPromptQuality(prompt: GeneratedPrompt): QualityAssessment;
}

export interface QualityAssessment {
  clarityScore: number;
  completenessScore: number;
  contextRelevanceScore: number;
  schemaAlignmentScore: number;
  overallScore: number;
  improvements: string[];
}

// Builder Interfaces
export interface PromptBuilder {
  buildActionPrompt(request: ActionPromptRequest): Promise<GeneratedPrompt>;
  buildReflectionPrompt(request: ReflectionPromptRequest): Promise<GeneratedPrompt>;
  buildContextSection(sessionId: string, stepIndex: number): Promise<ContextSection>;
  buildValidationSection(sessionId: string, stepIndex: number): Promise<ValidationSection>;
}

export interface TemplateRenderer {
  renderTemplate(template: PromptTemplate, variables: Record<string, any>): Promise<string>;
  validateTemplateVariables(template: PromptTemplate, variables: Record<string, any>): boolean;
  getRequiredVariables(template: PromptTemplate): string[];
  precompileTemplate(template: PromptTemplate): CompiledTemplate;
}

export interface CompiledTemplate {
  templateId: string;
  compiledFunction: (variables: Record<string, any>) => string;
  requiredVariables: string[];
  compiledAt: Date;
}

// Cache and Performance Types
export interface PromptCache {
  get(key: string): GeneratedPrompt | null;
  set(key: string, prompt: GeneratedPrompt, ttlMs?: number): void;
  delete(key: string): boolean;
  clear(): void;
  getStats(): PromptCacheStats;
}

export interface PromptCacheStats {
  totalEntries: number;
  hitRate: number;
  averageGenerationTime: number;
  memoryUsage: number;
  oldestEntry: Date;
  newestEntry: Date;
}

export interface PromptCacheEntry {
  key: string;
  prompt: GeneratedPrompt;
  createdAt: Date;
  accessCount: number;
  lastAccessed: Date;
  ttlMs: number;
}

// Error Types
export enum PromptManagerErrorType {
  TEMPLATE_NOT_FOUND = 'TEMPLATE_NOT_FOUND',
  CONTEXT_UNAVAILABLE = 'CONTEXT_UNAVAILABLE',
  SCHEMA_GENERATION_FAILED = 'SCHEMA_GENERATION_FAILED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  DOM_TOO_LARGE = 'DOM_TOO_LARGE',
  HISTORY_CORRUPTED = 'HISTORY_CORRUPTED',
  TEMPLATE_RENDERING_FAILED = 'TEMPLATE_RENDERING_FAILED',
  INTEGRATION_ERROR = 'INTEGRATION_ERROR',
  CACHE_ERROR = 'CACHE_ERROR'
}

export interface PromptManagerError extends Error {
  type: PromptManagerErrorType;
  sessionId?: string;
  stepIndex?: number;
  context?: Record<string, any>;
  timestamp: Date;
}

// Log Entry for Prompt Manager
export interface PromptManagerLogEntry {
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  timestamp: Date;
  context: {
    operation: string;
    sessionId?: string;
    stepIndex?: number;
    promptType?: PromptType;
    generationTime?: number;
    errorType?: PromptManagerErrorType;
  };
  metadata?: Record<string, any>;
}

// Event Types for Prompt Manager
export enum PromptManagerEventType {
  PROMPT_GENERATED = 'PROMPT_GENERATED',
  TEMPLATE_UPDATED = 'TEMPLATE_UPDATED',
  VALIDATION_COMPLETED = 'VALIDATION_COMPLETED',
  CACHE_HIT = 'CACHE_HIT',
  CACHE_MISS = 'CACHE_MISS',
  ERROR_OCCURRED = 'ERROR_OCCURRED'
}

export interface PromptManagerEvent {
  type: PromptManagerEventType;
  sessionId?: string;
  promptId?: string;
  timestamp: Date;
  data?: Record<string, any>;
}

// Utility Types
export type PromptPropertyType = 'string' | 'number' | 'boolean' | 'object' | 'array';
export type ReasoningDepth = 'basic' | 'detailed' | 'comprehensive';
export type ValidationMode = 'strict' | 'lenient';
export type PromptTypeKey = keyof typeof PromptType;

// Constants
export const PROMPT_MANAGER_VERSION = '1.0.0';
export const DEFAULT_MAX_DOM_SIZE = 100000; // characters
export const DEFAULT_MAX_HISTORY_STEPS = 10;
export const DEFAULT_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const DEFAULT_MAX_CACHE_SIZE = 50;

// Template IDs
export const TEMPLATE_IDS = {
  SYSTEM_MESSAGE: 'system_message',
  INITIAL_ACTION: 'initial_action',
  REFLECTION_ACTION: 'reflection_action',
  VALIDATION: 'validation',
  CONTEXT: 'context',
  SCHEMA: 'schema'
} as const;

// Prompt quality thresholds
export const QUALITY_THRESHOLDS = {
  MIN_CLARITY_SCORE: 0.7,
  MIN_COMPLETENESS_SCORE: 0.8,
  MIN_OVERALL_SCORE: 0.75
} as const;

// Prompt generation presets
export const PROMPT_PRESETS = {
  SIMPLE: {
    includeExecutionHistory: true,
    maxHistorySteps: 5,
    includeDomComparison: false,
    validationMode: 'lenient' as ValidationMode,
    reasoningDepth: 'basic' as ReasoningDepth
  },
  COMPREHENSIVE: {
    includeExecutionHistory: true,
    maxHistorySteps: 10,
    includeDomComparison: true,
    includeElementContext: true,
    validationMode: 'strict' as ValidationMode,
    reasoningDepth: 'comprehensive' as ReasoningDepth,
    includeExamples: true
  },
  PERFORMANCE: {
    includeExecutionHistory: true,
    maxHistorySteps: 3,
    includeDomComparison: false,
    includeElementContext: false,
    validationMode: 'lenient' as ValidationMode,
    reasoningDepth: 'basic' as ReasoningDepth
  }
} as const;

// DOM processing constants
export const DOM_PROCESSING = {
  MAX_ELEMENT_TEXT_LENGTH: 200,
  MAX_ATTRIBUTE_VALUE_LENGTH: 100,
  RELEVANCE_SCORE_THRESHOLD: 0.5,
  MAX_RELEVANT_ELEMENTS: 50
} as const;

// Template variable patterns
export const TEMPLATE_PATTERNS = {
  VARIABLE: /\{\{(\w+)\}\}/g,
  CONDITIONAL: /\{\{#if\s+(\w+)\}\}(.*?)\{\{\/if\}\}/gs,
  LOOP: /\{\{#each\s+(\w+)\}\}(.*?)\{\{\/each\}\}/gs
} as const;
