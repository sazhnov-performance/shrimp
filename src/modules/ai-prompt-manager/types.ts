/**
 * AI Prompt Manager Types
 * Comprehensive type definitions for the AI Prompt Manager module
 */

// Core Prompt Manager Interface
export interface IAIPromptManager {
  // Initialize context with session and workflow steps
  init(sessionId: string, steps: string[]): void;
  
  // Generate step-specific prompt with full context
  getStepPrompt(sessionId: string, stepId: number): string;
  
  // Enhanced prompt generation methods
  generateActionPrompt(request: ActionPromptRequest): Promise<GeneratedPrompt>;
  generateReflectionPrompt(request: ReflectionPromptRequest): Promise<GeneratedPrompt>;
  generateInvestigationPrompt(request: InvestigationPromptRequest): Promise<GeneratedPrompt>;
  generateActionWithInvestigationPrompt(request: ActionWithInvestigationPromptRequest): Promise<GeneratedPrompt>;
  
  // Template management
  getPromptTemplates(): PromptTemplates;
  updatePromptTemplate(templateId: string, template: PromptTemplate): void;
  
  // Validation
  validatePromptStructure(prompt: GeneratedPrompt): ValidationResult;
  validateSchemaIntegration(prompt: GeneratedPrompt): boolean;
  validateTemplateVariables(template: PromptTemplate, variables: Record<string, any>): boolean;
  
  // Quality assessment
  assessPromptQuality(prompt: GeneratedPrompt): QualityAssessment;
}

// Enhanced Prompt Types
export enum EnhancedPromptType {
  INITIAL_ACTION = 'INITIAL_ACTION',
  ACTION_WITH_VALIDATION = 'ACTION_WITH_VALIDATION',
  REFLECTION_AND_ACTION = 'REFLECTION_AND_ACTION',
  INVESTIGATION_INITIAL_ASSESSMENT = 'INVESTIGATION_INITIAL_ASSESSMENT',
  INVESTIGATION_FOCUSED_EXPLORATION = 'INVESTIGATION_FOCUSED_EXPLORATION',
  INVESTIGATION_SELECTOR_DETERMINATION = 'INVESTIGATION_SELECTOR_DETERMINATION',
  ACTION_WITH_INVESTIGATION_CONTEXT = 'ACTION_WITH_INVESTIGATION_CONTEXT'
}

// Investigation Types
export enum InvestigationPhase {
  INITIAL_ASSESSMENT = 'initial_assessment',
  FOCUSED_EXPLORATION = 'focused_exploration',
  SELECTOR_DETERMINATION = 'selector_determination'
}

export enum InvestigationTool {
  SCREENSHOT_ANALYSIS = 'screenshot_analysis',
  TEXT_EXTRACTION = 'text_extraction',
  FULL_DOM_RETRIEVAL = 'full_dom_retrieval',
  SUB_DOM_EXTRACTION = 'sub_dom_extraction'
}

// Error Types
export enum PromptManagerErrorType {
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  CONTEXT_UNAVAILABLE = 'CONTEXT_UNAVAILABLE',
  TEMPLATE_NOT_FOUND = 'TEMPLATE_NOT_FOUND',
  SCHEMA_GENERATION_FAILED = 'SCHEMA_GENERATION_FAILED',
  INVESTIGATION_DISABLED = 'INVESTIGATION_DISABLED'
}

export class PromptManagerError extends Error {
  constructor(
    public type: PromptManagerErrorType,
    message: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'PromptManagerError';
  }
}

// Request Interfaces
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

export interface InvestigationPromptRequest {
  sessionId: string;
  stepIndex: number;
  stepContent: string;
  investigationPhase: InvestigationPhase;
  availableTools: InvestigationTool[];
  investigationOptions?: InvestigationOptions;
}

export interface ActionWithInvestigationPromptRequest {
  sessionId: string;
  stepIndex: number;
  stepContent: string;
  investigationContext: InvestigationContext;
  promptOptions?: PromptOptions;
}

// Options
export interface PromptOptions {
  reasoningDepth?: 'basic' | 'detailed' | 'comprehensive';
  validationMode?: 'lenient' | 'strict';
  useFilteredContext?: boolean;
  includeWorkingMemory?: boolean;
  includeInvestigationHistory?: boolean;
}

export interface InvestigationOptions {
  maxInvestigationRounds?: number;
  confidenceThreshold?: number;
}

// Core Data Structures
export interface GeneratedPrompt {
  promptId: string;
  sessionId: string;
  stepIndex: number;
  promptType: EnhancedPromptType;
  content: PromptContent;
  schema: ResponseSchema;
  generatedAt: Date;
  metadata?: PromptMetadata;
}

export interface PromptContent {
  systemMessage: string;
  contextSection: ContextSection;
  instructionSection: InstructionSection;
  schemaSection: SchemaSection;
  validationSection?: ValidationSection;
  workingMemorySection?: WorkingMemorySection;
  investigationSection?: InvestigationSection;
}

export interface ContextSection {
  currentStep: CurrentStepInfo;
  executionHistory: ExecutionHistory;
  pageStates: PageStates;
  sessionMetadata?: SessionMetadata;
  filteredContext?: FilteredContext;
}

export interface CurrentStepInfo {
  stepIndex: number;
  stepContent: string;
  stepType: 'initial' | 'continuation' | 'recovery';
  totalSteps: number;
}

export interface ExecutionHistory {
  previousSteps: StepSummary[];
  chronologicalEvents: HistoryEvent[];
  successfulActions: number;
  failedActions: number;
}

export interface StepSummary {
  stepIndex: number;
  stepContent: string;
  outcome: 'success' | 'failure' | 'in_progress';
  summary: string;
  confidence: number;
}

export interface HistoryEvent {
  timestamp: Date;
  action: string;
  result: string;
  reasoning: string;
}

export interface PageStates {
  currentPageDom?: string;
  currentPageUrl?: string;
  previousPageState?: string;
}

export interface SessionMetadata {
  investigationContext?: InvestigationContext;
  workflowProgress?: number;
  estimatedCompletion?: Date;
}

export interface FilteredContext {
  targetStep: number;
  relevantHistory: StepSummary[];
  pageInsights: PageInsight[];
  elementKnowledge: ElementInfo[];
  executionPatterns: ExecutionPattern[];
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
  validationRules: string[];
}

export interface ValidationSection {
  lastActionValidation?: LastActionValidation;
  resultAnalysis?: ResultAnalysis;
  outcomeExpectations?: OutcomeExpectation[];
}

export interface LastActionValidation {
  expectedOutcome: string;
  validationCriteria: string[];
  successIndicators: string[];
  failureIndicators: string[];
}

export interface ResultAnalysis {
  analysisType: 'page_change' | 'element_interaction' | 'data_extraction';
  analysisInstructions: string;
  comparisonBaseline: string;
}

export interface OutcomeExpectation {
  expectationType: string;
  description: string;
  validationMethod: string;
}

export interface WorkingMemorySection {
  knownElements: ElementInfo[];
  extractedVariables: VariableInfo[];
  pageInsights: PageInsight[];
  learningHistory: LearningRecord[];
  investigationPreferences: InvestigationPreference[];
}

export interface InvestigationSection {
  investigationPhase: InvestigationPhase;
  availableTools: InvestigationTool[];
  investigationObjective: string;
  phaseInstructions: string;
  confidenceRequirement: number;
  investigationHistory?: InvestigationRecord[];
}

// Supporting Data Types
export interface ElementInfo {
  selector: string;
  elementType: string;
  purpose?: string;
  reliability: number;
  lastValidated: Date;
}

export interface VariableInfo {
  name: string;
  value: string;
  source: string;
  extractedAt: Date;
}

export interface PageInsight {
  pageType: string;
  mainSections: string[];
  keyElements: string[];
  complexity: 'low' | 'medium' | 'high';
  navigationStructure: string;
}

export interface LearningRecord {
  recordType: 'element_discovery' | 'pattern_recognition' | 'success_pattern' | 'failure_pattern';
  description: string;
  confidence: number;
  timestamp: Date;
}

export interface InvestigationPreference {
  toolPreference: InvestigationTool;
  preferenceReason: string;
  successRate: number;
}

export interface ExecutionPattern {
  patternType: string;
  description: string;
  successRate: number;
  contextConditions: string[];
}

export interface InvestigationRecord {
  investigationType: InvestigationTool;
  objective: string;
  outcome: 'success' | 'failure' | 'partial';
  keyFindings: string[];
  confidence: number;
  timestamp: Date;
}

export interface InvestigationContext {
  investigationsPerformed: InvestigationRecord[];
  elementsDiscovered: ElementInfo[];
  pageInsight: PageInsight;
  workingMemoryState: WorkingMemoryState;
  recommendedAction: RecommendedAction;
}

export interface WorkingMemoryState {
  elementsKnown: number;
  patternsLearned: number;
  variablesExtracted: number;
  investigationRoundsCompleted: number;
  overallConfidence: number;
}

export interface RecommendedAction {
  recommendedAction: string;
  confidence: number;
  reasoning: string[];
  requiredValidation: string[];
  fallbackOptions: string[];
}

// Metadata
export interface PromptMetadata {
  generationTimeMs?: number;
  templateVersion?: string;
  stepIndex?: number;
  useInvestigation?: boolean;
  completedStepIndex?: number;
  investigationContext?: InvestigationContext;
}

// Template System
export interface PromptTemplates {
  systemMessageTemplate: PromptTemplate;
  actionPromptTemplate: PromptTemplate;
  reflectionPromptTemplate: PromptTemplate;
  validationPromptTemplate: PromptTemplate;
  contextTemplate: PromptTemplate;
  schemaTemplate: PromptTemplate;
  investigationTemplates?: Record<InvestigationPhase, PromptTemplate>;
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
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  description: string;
  defaultValue?: any;
}

// Validation Types
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
  suggestions: string[];
  qualityScore: number;
}

export interface ValidationError {
  field: string;
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface QualityAssessment {
  clarityScore: number;
  completenessScore: number;
  contextRelevanceScore: number;
  schemaAlignmentScore: number;
  overallScore: number;
  improvements: string[];
}

// Configuration Types
export interface AIPromptManagerConfig {
  performance: PerformanceConfig;
  validation: ValidationConfig;
  investigationConfig: InvestigationConfig;
  templateConfig: TemplateConfig;
}

export interface PerformanceConfig {
  cacheEnabled: boolean;
  cacheTTLMs: number;
  maxCacheSize?: number;
  metricsEnabled: boolean;
}

export interface ValidationConfig {
  enableActionValidation: boolean;
  enableResultAnalysis: boolean;
  validationTimeoutMs: number;
  requireExplicitValidation: boolean;
}

export interface InvestigationConfig {
  enableInvestigationPrompts: boolean;
  defaultInvestigationTools: InvestigationTool[];
  maxInvestigationRounds: number;
  confidenceThreshold: number;
}

export interface TemplateConfig {
  templateCacheEnabled: boolean;
  customTemplatesAllowed: boolean;
  templateValidationStrict: boolean;
}

// Response Schema (from AI Schema Manager)
export interface ResponseSchema {
  type: string;
  properties: Record<string, any>;
  required: string[];
}

// Quality Thresholds
export const QUALITY_THRESHOLDS = {
  MIN_CLARITY_SCORE: 0.7,
  MIN_COMPLETENESS_SCORE: 0.8,
  MIN_CONTEXT_RELEVANCE_SCORE: 0.75,
  MIN_OVERALL_SCORE: 0.75
} as const;

// Default Configuration Functions
export function createDefaultConfig(): AIPromptManagerConfig {
  return {
    performance: {
      cacheEnabled: true,
      cacheTTLMs: 300000, // 5 minutes
      maxCacheSize: 100,
      metricsEnabled: true
    },
    validation: {
      enableActionValidation: true,
      enableResultAnalysis: true,
      validationTimeoutMs: 30000,
      requireExplicitValidation: false
    },
    investigationConfig: {
      enableInvestigationPrompts: true,
      defaultInvestigationTools: [
        InvestigationTool.SCREENSHOT_ANALYSIS,
        InvestigationTool.TEXT_EXTRACTION,
        InvestigationTool.SUB_DOM_EXTRACTION
      ],
      maxInvestigationRounds: 3,
      confidenceThreshold: 0.8
    },
    templateConfig: {
      templateCacheEnabled: true,
      customTemplatesAllowed: false,
      templateValidationStrict: true
    }
  };
}

export function createMinimalConfig(): Partial<AIPromptManagerConfig> {
  return {
    performance: {
      cacheEnabled: false,
      cacheTTLMs: 0,
      metricsEnabled: false
    },
    investigationConfig: {
      enableInvestigationPrompts: false,
      maxInvestigationRounds: 1,
      confidenceThreshold: 0.5
    }
  };
}
