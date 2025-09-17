/**
 * AI Prompt Manager Types
 * Defines types and interfaces for the AI Prompt Manager module
 * Based on design/ai-prompt-manager.md specifications
 */

import { BaseModuleConfig, LoggingConfig, PerformanceConfig, TimeoutConfig } from './shared-types';

// Core Prompt Generation Types
export interface AIPromptManager {
  // Traditional ACT-REFLECT prompts
  generateActionPrompt(request: ActionPromptRequest): Promise<GeneratedPrompt>;
  generateReflectionPrompt(request: ReflectionPromptRequest): Promise<GeneratedPrompt>;
  
  // Investigation prompts
  generateInvestigationPrompt(request: InvestigationPromptRequest): Promise<GeneratedPrompt>;
  generateActionWithInvestigationPrompt(request: ActionWithInvestigationRequest): Promise<GeneratedPrompt>;
  
  // Template and validation management
  getPromptTemplates(): PromptTemplateCollection;
  updatePromptTemplate(templateId: string, template: PromptTemplate): void;
  validatePromptStructure(prompt: GeneratedPrompt): PromptValidationResult;
}

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

// Investigation-specific prompt requests
export interface InvestigationPromptRequest {
  sessionId: string;
  stepIndex: number;
  stepContent: string;
  investigationPhase: InvestigationPhase;
  availableTools: InvestigationTool[];
  investigationOptions?: InvestigationOptions;
}

export interface ActionWithInvestigationRequest {
  sessionId: string;
  stepIndex: number;
  stepContent: string;
  investigationContext: InvestigationContextSummary;
  promptOptions?: PromptOptions;
}

export enum InvestigationPhase {
  INITIAL_ASSESSMENT = 'INITIAL_ASSESSMENT',
  FOCUSED_EXPLORATION = 'FOCUSED_EXPLORATION', 
  SELECTOR_DETERMINATION = 'SELECTOR_DETERMINATION'
}

export enum InvestigationTool {
  SCREENSHOT_ANALYSIS = 'SCREENSHOT_ANALYSIS',
  TEXT_EXTRACTION = 'TEXT_EXTRACTION',
  FULL_DOM_RETRIEVAL = 'FULL_DOM_RETRIEVAL',
  SUB_DOM_EXTRACTION = 'SUB_DOM_EXTRACTION'
}

export interface InvestigationOptions {
  maxInvestigationRounds?: number;
  confidenceThreshold?: number;
  preferredTools?: InvestigationTool[];
  contextManagementApproach?: 'minimal' | 'standard' | 'comprehensive';
  includeWorkingMemory?: boolean;
  includeElementKnowledge?: boolean;
}

export interface InvestigationContextSummary {
  investigationsPerformed: InvestigationSummary[];
  elementsDiscovered: ElementKnowledgeSummary[];
  pageInsight: PageInsightSummary;
  workingMemoryState: WorkingMemorySummary;
  recommendedAction: ActionRecommendation;
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
  // Traditional prompts
  INITIAL_ACTION = 'INITIAL_ACTION',
  ACTION_WITH_VALIDATION = 'ACTION_WITH_VALIDATION',
  REFLECTION_AND_ACTION = 'REFLECTION_AND_ACTION',
  
  // Investigation prompts
  INVESTIGATION_INITIAL_ASSESSMENT = 'INVESTIGATION_INITIAL_ASSESSMENT',
  INVESTIGATION_FOCUSED_EXPLORATION = 'INVESTIGATION_FOCUSED_EXPLORATION',
  INVESTIGATION_SELECTOR_DETERMINATION = 'INVESTIGATION_SELECTOR_DETERMINATION',
  ACTION_WITH_INVESTIGATION_CONTEXT = 'ACTION_WITH_INVESTIGATION_CONTEXT'
}

export interface PromptContent {
  systemMessage: string;
  contextSection: ContextSection;
  instructionSection: InstructionSection;
  validationSection?: ValidationSection;
  investigationSection?: InvestigationSection;
  workingMemorySection?: WorkingMemorySection;
  schemaSection: SchemaSection;
  examplesSection?: ExamplesSection;
}

// Context Integration Types
export interface ContextSection {
  currentStep: StepContext;
  executionHistory: ExecutionHistorySection;
  pageStates: PageStateSection;
  filteredContext?: FilteredContextSection;
  investigationHistory?: InvestigationHistorySection;
  sessionMetadata?: Record<string, any>;
}

// Filtered context integration from AI Context Manager
export interface FilteredContextSection {
  executionSummary: ExecutionSummaryItem[];
  pageInsights: PageInsight[];
  elementKnowledge: ElementKnowledge[];
  contextSource: 'filtered' | 'traditional';
  filteringLevel: 'minimal' | 'standard' | 'detailed';
  confidenceThreshold: number;
}

// Investigation history from previous investigation cycles
export interface InvestigationHistorySection {
  currentStepInvestigations: InvestigationSummary[];
  previousStepInvestigations: InvestigationSummary[];
  totalInvestigationsPerformed: number;
  investigationStrategy: InvestigationStrategySummary;
}

export interface StepContext {
  stepIndex: number;
  stepContent: string;
  stepType: 'initial' | 'continuation' | 'validation' | 'investigation' | 'action_with_investigation';
  totalSteps: number;
  investigationPhase?: InvestigationPhase;
  currentInvestigationRound?: number;
  maxInvestigationRounds?: number;
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

export enum ExecutionStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
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

// Investigation-specific prompt sections
export interface InvestigationSection {
  investigationPhase: InvestigationPhase;
  availableTools: InvestigationToolDescription[];
  investigationStrategy: InvestigationStrategyGuidance;
  phaseSpecificGuidance: PhaseGuidance;
  contextManagementGuidance: ContextManagementGuidance;
}

export interface InvestigationToolDescription {
  tool: InvestigationTool;
  description: string;
  useCase: string;
  expectedOutput: string;
  limitationsAndConsiderations: string[];
  parameters?: ToolParameter[];
}

export interface InvestigationStrategyGuidance {
  currentPhaseObjective: string;
  investigationPriority: InvestigationPriority;
  suggestedApproach: string[];
  successCriteria: string[];
  nextPhaseConditions: string[];
}

export interface PhaseGuidance {
  phaseDescription: string;
  keyObjectives: string[];
  recommendedTools: InvestigationTool[];
  investigationQuestions: string[];
  outputExpectations: string[];
  commonPitfalls: string[];
}

export interface ContextManagementGuidance {
  contextOverflowPrevention: string[];
  contentFilteringStrategy: string;
  summaryGuidelines: string[];
  elementKnowledgeTracking: string[];
  workingMemoryUpdates: string[];
}

// Working Memory integration
export interface WorkingMemorySection {
  currentPageInsight?: PageInsightSummary;
  knownElements: ElementKnowledgeSummary[];
  navigationPatterns: NavigationPatternSummary[];
  extractedVariables: VariableSummary[];
  successfulPatterns: PatternSummary[];
  failurePatterns: PatternSummary[];
  investigationPreferences: InvestigationPreferencesSummary;
  memoryLastUpdated: Date;
  confidenceLevel: number;
}

// Instruction Section Types
export interface InstructionSection {
  mainInstruction: string;
  stepSpecificGuidance: string[];
  decisionFramework: string[];
  actionGuidelines: string[];
  validationRequirements?: string[];
  investigationGuidance?: string[];
  contextUsageInstructions: string[];
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

export enum DecisionAction {
  PROCEED = 'PROCEED',
  RETRY = 'RETRY',
  ABORT = 'ABORT',
  INVESTIGATE = 'INVESTIGATE'
}

// Schema Section Types
export interface SchemaSection {
  responseFormat: string;
  requiredFields: SchemaField[];
  optionalFields: SchemaField[];
  examples: SchemaExample[];
  validationRules: SchemaValidationRule[];
}

export interface SchemaField {
  name: string;
  type: string;
  description: string;
  required: boolean;
  constraints?: string[];
}

export interface SchemaExample {
  scenario: string;
  exampleResponse: Record<string, any>;
  explanation: string;
}

export interface SchemaValidationRule {
  field: string;
  rule: string;
  description: string;
}

export interface ExamplesSection {
  scenarioExamples: ScenarioExample[];
  responseExamples: ResponseExample[];
  bestPractices: string[];
  commonMistakes: string[];
}

export interface ScenarioExample {
  scenario: string;
  context: string;
  expectedApproach: string;
  reasoning: string;
}

export interface ResponseExample {
  situation: string;
  exampleResponse: Record<string, any>;
  explanation: string;
}

// Supporting interfaces for investigation and working memory
export interface InvestigationSummary {
  investigationType: InvestigationTool;
  objective: string;
  outcome: 'success' | 'partial' | 'failure';
  keyFindings: string[];
  confidence: number;
  timestamp: Date;
}

export interface ElementKnowledgeSummary {
  selector: string;
  elementType: string;
  purpose: string;
  reliability: number;
  lastValidated: Date;
  alternativeSelectors?: string[];
}

export interface PageInsightSummary {
  pageType: string;
  mainSections: string[];
  keyElements: string[];
  complexity: 'low' | 'medium' | 'high';
  navigationStructure: string;
}

export interface WorkingMemorySummary {
  elementsKnown: number;
  patternsLearned: number;
  variablesExtracted: number;
  investigationRoundsCompleted: number;
  overallConfidence: number;
}

export interface ActionRecommendation {
  recommendedAction: string;
  confidence: number;
  reasoning: string[];
  requiredValidation: string[];
  fallbackOptions: string[];
}

export interface NavigationPatternSummary {
  pattern: string;
  reliability: number;
  usageCount: number;
}

export interface VariableSummary {
  name: string;
  value: string;
  source: string;
  reliability: number;
}

export interface PatternSummary {
  pattern: string;
  context: string;
  reliability: number;
  frequency: number;
}

export interface InvestigationPreferencesSummary {
  preferredToolOrder: InvestigationTool[];
  qualityThresholds: Record<string, number>;
  adaptiveStrategies: string[];
}

export interface InvestigationStrategySummary {
  currentApproach: string;
  adaptations: string[];
  learningsApplied: string[];
}

export interface InvestigationPriority {
  primary: InvestigationTool;
  fallbacks: InvestigationTool[];
  reasoning: string;
}

export interface ToolParameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
  example?: string;
}

// Template Management Types
export interface PromptTemplateCollection {
  // Traditional templates
  systemMessageTemplate: PromptTemplate;
  actionPromptTemplate: PromptTemplate;
  reflectionPromptTemplate: PromptTemplate;
  validationPromptTemplate: PromptTemplate;
  contextTemplate: PromptTemplate;
  schemaTemplate: PromptTemplate;
  
  // Investigation templates
  investigationInitialAssessmentTemplate: PromptTemplate;
  investigationFocusedExplorationTemplate: PromptTemplate;
  investigationSelectorDeterminationTemplate: PromptTemplate;
  actionWithInvestigationTemplate: PromptTemplate;
  investigationToolsTemplate: PromptTemplate;
  workingMemoryTemplate: PromptTemplate;
  contextFilteringTemplate: PromptTemplate;
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

// Configuration and Options Types
export interface PromptOptions {
  // Traditional options
  includeExecutionHistory?: boolean;
  maxHistorySteps?: number;
  includeDomComparison?: boolean;
  includeElementContext?: boolean;
  validationMode?: 'strict' | 'lenient';
  reasoningDepth?: 'basic' | 'detailed' | 'comprehensive';
  includeExamples?: boolean;
  customInstructions?: string;
  
  // Investigation-specific options
  useFilteredContext?: boolean;
  includeWorkingMemory?: boolean;
  includeInvestigationHistory?: boolean;
  includeElementKnowledge?: boolean;
  contextManagementApproach?: 'minimal' | 'standard' | 'comprehensive';
  investigationGuidanceLevel?: 'basic' | 'detailed' | 'expert';
  enableProgressiveContext?: boolean;
  maxInvestigationRounds?: number;
  confidenceThreshold?: number;
  preferredInvestigationTools?: InvestigationTool[];
}

export interface AIPromptManagerConfig extends BaseModuleConfig {
  moduleId: 'ai-prompt-manager';
  
  // AI Prompt Manager specific configuration
  defaultPromptOptions: PromptOptions;
  templateConfig: TemplateConfig;
  contextConfig: ContextConfig;
  validationConfig: ValidationConfig;
  investigationConfig: InvestigationConfig;
}

export interface TemplateConfig {
  enableCustomTemplates: boolean;
  templateCacheEnabled: boolean;
  templateValidationEnabled: boolean;
  fallbackToDefault: boolean;
}

export interface ContextConfig {
  // Traditional context configuration
  maxDomSize: number;
  maxHistoryItems: number;
  includeTimestamps: boolean;
  compressLargeDom: boolean;
  highlightRelevantElements: boolean;
  
  // Investigation context configuration
  enableFilteredContext: boolean;
  defaultFilteringLevel: 'minimal' | 'standard' | 'detailed';
  maxFilteredContextSize: number;
  includeWorkingMemoryByDefault: boolean;
  workingMemoryDetailLevel: 'summary' | 'detailed' | 'comprehensive';
  elementKnowledgeThreshold: number;
  investigationHistoryDepth: number;
}

export interface ValidationConfig {
  enableActionValidation: boolean;
  enableResultAnalysis: boolean;
  validationTimeoutMs: number;
  requireExplicitValidation: boolean;
}

// Investigation-specific configuration
export interface InvestigationConfig {
  enableInvestigationPrompts: boolean;
  defaultInvestigationPhase: InvestigationPhase;
  maxInvestigationRoundsPerStep: number;
  investigationTimeoutMs: number;
  
  // Tool configuration
  enabledInvestigationTools: InvestigationTool[];
  toolPriorityOrder: InvestigationTool[];
  toolSpecificSettings: ToolSettingsMap;
  
  // Context management
  enableProgressiveContextBuilding: boolean;
  contextOverflowPreventionEnabled: boolean;
  workingMemoryIntegrationEnabled: boolean;
  elementKnowledgeTrackingEnabled: boolean;
  
  // Learning and adaptation
  enableInvestigationLearning: boolean;
  patternRecognitionEnabled: boolean;
  adaptiveStrategyEnabled: boolean;
  investigationMetricsEnabled: boolean;
  
  // Quality and validation
  minimumConfidenceThreshold: number;
  investigationQualityChecks: boolean;
  fallbackStrategyEnabled: boolean;
  investigationValidationEnabled: boolean;
}

export type ToolSettingsMap = {
  [K in InvestigationTool]: ToolSpecificSettings;
};

export interface ToolSpecificSettings {
  enabled: boolean;
  timeoutMs: number;
  maxRetries: number;
  qualityThreshold: number;
  specificParameters?: Record<string, any>;
}

// Integration Interfaces
export interface SchemaManagerIntegration {
  getResponseSchema(options?: SchemaOptions): Promise<ResponseSchema>;
  validateSchemaCompatibility(schema: ResponseSchema): boolean;
  getSchemaVersion(): string;
}

export interface SchemaOptions {
  includeInvestigationTools?: boolean;
  includeWorkingMemoryUpdates?: boolean;
  includeElementDiscovery?: boolean;
  schemaComplexity?: 'basic' | 'standard' | 'comprehensive';
}

export interface ResponseSchema {
  version: string;
  type: string;
  properties: Record<string, SchemaProperty>;
  required: string[];
  additionalProperties: boolean;
  examples?: Record<string, any>[];
}

export interface SchemaProperty {
  type: string;
  description: string;
  properties?: Record<string, SchemaProperty>;
  items?: SchemaProperty;
  enum?: string[];
  required?: string[];
}

export interface ContextManagerIntegration {
  // Traditional context methods
  getExecutionContext(sessionId: string, stepIndex: number): Promise<AIContextJson>;
  getStepHistory(sessionId: string, maxSteps?: number): Promise<StepExecutionSummary[]>;
  getCurrentPageState(sessionId: string): Promise<string>;
  getPreviousPageState(sessionId: string, stepIndex: number): Promise<string | null>;
  
  // Investigation context methods
  generateFilteredContext(sessionId: string, targetStep: number, options: ContextFilterOptions): Promise<FilteredContextJson>;
  generateInvestigationContext(sessionId: string, stepIndex: number): Promise<InvestigationContextJson>;
  getWorkingMemory(sessionId: string): WorkingMemoryState;
  getInvestigationHistory(sessionId: string, stepIndex: number): InvestigationResult[];
  getPageElementsDiscovered(sessionId: string, stepIndex: number): ElementDiscovery[];
  getContextSummaries(sessionId: string, stepRange?: [number, number]): StepContextSummary[];
}

// Import types from AI Context Manager
export interface ContextFilterOptions {
  excludeFullDom: boolean;
  excludePageContent: boolean;
  maxHistorySteps: number;
  includeWorkingMemory: boolean;
  includeElementKnowledge: boolean;
  includeInvestigationHistory: boolean;
  summarizationLevel: 'minimal' | 'standard' | 'detailed';
  confidenceThreshold: number;
}

// Type imports that would come from ai-context-manager types
export interface FilteredContextJson {
  sessionId: string;
  targetStep: number;
  generatedAt: Date;
  executionSummary: ExecutionSummaryItem[];
  pageInsights: PageInsight[];
  elementKnowledge: ElementKnowledge[];
  workingMemory: WorkingMemoryState;
  investigationStrategy: InvestigationStrategy;
}

export interface InvestigationContextJson {
  sessionId: string;
  stepIndex: number;
  generatedAt: Date;
  currentInvestigations: InvestigationResult[];
  elementsDiscovered: ElementDiscovery[];
  pageInsight: PageInsight;
  workingMemory: WorkingMemoryState;
  suggestedInvestigations: SuggestedInvestigation[];
  investigationPriority: InvestigationPriority;
}

export interface AIContextJson {
  sessionId: string;
  stepIndex: number;
  generatedAt: Date;
  executionHistory: ExecutionSummaryItem[];
  currentPageState: string;
  previousPageState?: string;
  extractedVariables: Record<string, string>;
  sessionMetadata: Record<string, any>;
}

// Additional types that support the investigation flow
export interface ExecutionSummaryItem {
  stepIndex: number;
  stepName: string;
  reasoning: string;
  actionTaken: string;
  outcome: 'success' | 'failure' | 'retry' | 'investigating';
  confidence: number;
  timestamp: Date;
  screenshotId?: string;
  keyFindings?: string[];
}

export interface PageInsight {
  stepIndex: number;
  pageUrl?: string;
  pageTitle?: string;
  layoutType?: string;
  mainSections?: string[];
  keyElements?: string[];
  navigationStructure?: string;
  formElements?: string[];
  interactiveElements?: string[];
  visualDescription?: string;
  complexity: 'low' | 'medium' | 'high';
}

export interface ElementKnowledge {
  selector: string;
  elementType: string;
  purpose: string;
  reliability: number;
  lastSeen: Date;
  discoveryHistory: string[];
  alternativeSelectors?: string[];
  interactionNotes?: string;
}

export interface WorkingMemoryState {
  sessionId: string;
  lastUpdated: Date;
  currentPageInsight?: PageInsight;
  knownElements: Map<string, ElementKnowledge>;
  navigationPattern?: NavigationPattern;
  extractedVariables: Map<string, VariableContext>;
  successfulPatterns: SuccessPattern[];
  failurePatterns: FailurePattern[];
  investigationPreferences: InvestigationPreferences;
}

export interface InvestigationStrategy {
  currentPhase: 'initial_assessment' | 'focused_exploration' | 'selector_determination';
  recommendedInvestigations: SuggestedInvestigation[];
  investigationPriority: InvestigationPriority;
  contextManagementApproach: 'minimal' | 'standard' | 'comprehensive';
  confidenceThreshold: number;
  maxInvestigationRounds: number;
}

export interface SuggestedInvestigation {
  type: InvestigationTool;
  purpose: string;
  parameters?: Record<string, any>;
  priority: number;
  reasoning: string;
}

export interface InvestigationResult {
  investigationId: string;
  investigationType: InvestigationTool;
  timestamp: Date;
  input: InvestigationInput;
  output: InvestigationOutput;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ElementDiscovery {
  discoveryId: string;
  timestamp: Date;
  selector: string;
  elementType: string;
  properties: ElementProperties;
  confidence: number;
  discoveryMethod: InvestigationTool;
  isReliable: boolean;
  metadata?: Record<string, any>;
}

export interface StepContextSummary {
  stepIndex: number;
  stepName: string;
  timestamp: Date;
  actionSummary: string;
  outcomeSummary: string;
  keyFindings: string[];
  elementsDiscovered: string[];
  variablesExtracted: string[];
  investigationsSummary: string;
  pageInsightSummary: string;
  patternsLearned?: string[];
  strategiesUsed?: string[];
  overallConfidence: number;
  reliability: number;
}

// Supporting interfaces
export interface NavigationPattern {
  urlPattern: string;
  navigationSteps: string[];
  reliability: number;
  lastUsed: Date;
}

export interface VariableContext {
  name: string;
  value: string;
  extractionMethod: string;
  reliability: number;
  lastUpdated: Date;
  sourceElement?: string;
}

export interface SuccessPattern {
  pattern: string;
  context: string;
  successRate: number;
  usageCount: number;
  lastUsed: Date;
}

export interface FailurePattern {
  pattern: string;
  context: string;
  failureReasons: string[];
  lastEncountered: Date;
  avoidanceStrategy?: string;
}

export interface InvestigationPreferences {
  preferredOrder: InvestigationTool[];
  qualityThresholds: Record<InvestigationTool, number>;
  fallbackStrategies: Record<InvestigationTool, InvestigationTool[]>;
}

export interface InvestigationInput {
  selector?: string;
  screenshotId?: string;
  parameters?: Record<string, any>;
}

export interface InvestigationOutput {
  textContent?: string;
  domContent?: string;
  visualDescription?: string;
  elementCount?: number;
  summary?: string;
}

export interface ElementProperties {
  tagName: string;
  textContent?: string;
  attributes?: Record<string, string>;
  isVisible: boolean;
  isInteractable: boolean;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
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

// Error Types
export enum PromptManagerErrorType {
  // Traditional error types
  TEMPLATE_NOT_FOUND = 'TEMPLATE_NOT_FOUND',
  CONTEXT_UNAVAILABLE = 'CONTEXT_UNAVAILABLE',
  SCHEMA_GENERATION_FAILED = 'SCHEMA_GENERATION_FAILED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  DOM_TOO_LARGE = 'DOM_TOO_LARGE',
  HISTORY_CORRUPTED = 'HISTORY_CORRUPTED',
  TEMPLATE_RENDERING_FAILED = 'TEMPLATE_RENDERING_FAILED',
  
  // Investigation-specific error types
  INVESTIGATION_CONTEXT_UNAVAILABLE = 'INVESTIGATION_CONTEXT_UNAVAILABLE',
  WORKING_MEMORY_CORRUPTED = 'WORKING_MEMORY_CORRUPTED',
  INVESTIGATION_TOOLS_UNAVAILABLE = 'INVESTIGATION_TOOLS_UNAVAILABLE',
  CONTEXT_FILTERING_FAILED = 'CONTEXT_FILTERING_FAILED',
  ELEMENT_KNOWLEDGE_CORRUPTED = 'ELEMENT_KNOWLEDGE_CORRUPTED',
  INVESTIGATION_PHASE_INVALID = 'INVESTIGATION_PHASE_INVALID',
  INVESTIGATION_STRATEGY_GENERATION_FAILED = 'INVESTIGATION_STRATEGY_GENERATION_FAILED',
  PROGRESSIVE_CONTEXT_BUILD_FAILED = 'PROGRESSIVE_CONTEXT_BUILD_FAILED',
  INVESTIGATION_TIMEOUT = 'INVESTIGATION_TIMEOUT',
  WORKING_MEMORY_UPDATE_FAILED = 'WORKING_MEMORY_UPDATE_FAILED'
}

export class PromptManagerError extends Error {
  public readonly type: PromptManagerErrorType;
  public readonly sessionId?: string;
  public readonly stepIndex?: number;
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    type: PromptManagerErrorType,
    sessionId?: string,
    stepIndex?: number,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = 'PromptManagerError';
    this.type = type;
    this.sessionId = sessionId;
    this.stepIndex = stepIndex;
    this.context = context;
  }
}

// Constants and Configuration
export const PROMPT_MANAGER_VERSION = '1.0.0';
export const DEFAULT_MAX_DOM_SIZE = 100000; // characters
export const DEFAULT_MAX_HISTORY_STEPS = 10;
export const DEFAULT_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const DEFAULT_MAX_CACHE_SIZE = 50;
export const DEFAULT_INVESTIGATION_ROUNDS = 3;
export const DEFAULT_INVESTIGATION_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

// Investigation phase descriptions
export const INVESTIGATION_PHASE_DESCRIPTIONS = {
  [InvestigationPhase.INITIAL_ASSESSMENT]: {
    name: 'Initial Assessment',
    description: 'Get high-level understanding of page structure and identify key areas',
    objectives: [
      'Capture screenshot for visual understanding',
      'Analyze page layout and structure',
      'Identify main sections and interactive elements',
      'Determine investigation strategy for the step'
    ],
    preferredTools: [InvestigationTool.SCREENSHOT_ANALYSIS],
    expectedDuration: 30000 // 30 seconds
  },
  [InvestigationPhase.FOCUSED_EXPLORATION]: {
    name: 'Focused Exploration',
    description: 'Detailed exploration of relevant page sections to understand specific elements',
    objectives: [
      'Verify element presence and accessibility',
      'Extract detailed information about relevant sections',
      'Build comprehensive understanding of target areas',
      'Identify potential interaction points'
    ],
    preferredTools: [
      InvestigationTool.TEXT_EXTRACTION,
      InvestigationTool.SUB_DOM_EXTRACTION
    ],
    expectedDuration: 60000 // 1 minute
  },
  [InvestigationPhase.SELECTOR_DETERMINATION]: {
    name: 'Selector Determination',
    description: 'Synthesize investigation results to determine optimal selectors and interaction approach',
    objectives: [
      'Analyze all investigation findings',
      'Identify most reliable and specific selectors',
      'Validate selector uniqueness and stability',
      'Choose optimal interaction approach for the step'
    ],
    preferredTools: [
      InvestigationTool.SUB_DOM_EXTRACTION,
      InvestigationTool.FULL_DOM_RETRIEVAL
    ],
    expectedDuration: 45000 // 45 seconds
  }
} as const;

// Template IDs
export const TEMPLATE_IDS = {
  SYSTEM_MESSAGE: 'system_message',
  INITIAL_ACTION: 'initial_action',
  REFLECTION_ACTION: 'reflection_action',
  VALIDATION: 'validation',
  CONTEXT: 'context',
  SCHEMA: 'schema',
  INVESTIGATION_INITIAL: 'investigation_initial',
  INVESTIGATION_FOCUSED: 'investigation_focused',
  INVESTIGATION_SELECTOR: 'investigation_selector',
  ACTION_WITH_INVESTIGATION: 'action_with_investigation',
  WORKING_MEMORY: 'working_memory',
  CONTEXT_FILTERING: 'context_filtering'
} as const;

// Prompt quality thresholds
export const QUALITY_THRESHOLDS = {
  MIN_CLARITY_SCORE: 0.7,
  MIN_COMPLETENESS_SCORE: 0.8,
  MIN_OVERALL_SCORE: 0.75,
  MIN_INVESTIGATION_GUIDANCE_SCORE: 0.75,
  MIN_CONTEXT_RELEVANCE_SCORE: 0.8
} as const;

// Investigation-specific constants
export const INVESTIGATION_CONSTANTS = {
  DEFAULT_MAX_INVESTIGATION_ROUNDS: 5,
  DEFAULT_CONFIDENCE_THRESHOLD: 0.7,
  DEFAULT_CONTEXT_SIZE_LIMIT: 30000, // characters
  MAX_ELEMENT_KNOWLEDGE_ENTRIES: 100,
  MAX_PATTERN_ENTRIES: 50,
  WORKING_MEMORY_TTL_MS: 30 * 60 * 1000, // 30 minutes
  INVESTIGATION_TIMEOUT_MS: 2 * 60 * 1000, // 2 minutes per investigation
} as const;

// Investigation tool priorities
export const DEFAULT_TOOL_PRIORITY = [
  InvestigationTool.SCREENSHOT_ANALYSIS,
  InvestigationTool.TEXT_EXTRACTION,
  InvestigationTool.SUB_DOM_EXTRACTION,
  InvestigationTool.FULL_DOM_RETRIEVAL
] as const;

// Default investigation configuration
export const DEFAULT_INVESTIGATION_CONFIG: InvestigationConfig = {
  enableInvestigationPrompts: true,
  defaultInvestigationPhase: InvestigationPhase.INITIAL_ASSESSMENT,
  maxInvestigationRoundsPerStep: 5,
  investigationTimeoutMs: 2 * 60 * 1000,
  
  enabledInvestigationTools: [
    InvestigationTool.SCREENSHOT_ANALYSIS,
    InvestigationTool.TEXT_EXTRACTION,
    InvestigationTool.SUB_DOM_EXTRACTION,
    InvestigationTool.FULL_DOM_RETRIEVAL
  ],
  toolPriorityOrder: DEFAULT_TOOL_PRIORITY,
  toolSpecificSettings: {
    [InvestigationTool.SCREENSHOT_ANALYSIS]: {
      enabled: true,
      timeoutMs: 30000,
      maxRetries: 2,
      qualityThreshold: 0.7,
      specificParameters: {
        includeTextDescription: true,
        includeLayoutAnalysis: true
      }
    },
    [InvestigationTool.TEXT_EXTRACTION]: {
      enabled: true,
      timeoutMs: 10000,
      maxRetries: 3,
      qualityThreshold: 0.8,
      specificParameters: {
        maxTextLength: 5000,
        includeHiddenText: false
      }
    },
    [InvestigationTool.SUB_DOM_EXTRACTION]: {
      enabled: true,
      timeoutMs: 20000,
      maxRetries: 2,
      qualityThreshold: 0.75,
      specificParameters: {
        maxDomSize: 50000,
        includeStyles: false
      }
    },
    [InvestigationTool.FULL_DOM_RETRIEVAL]: {
      enabled: true,
      timeoutMs: 30000,
      maxRetries: 1,
      qualityThreshold: 0.6,
      specificParameters: {
        maxDomSize: 100000,
        fallbackToSubDom: true
      }
    }
  },
  
  enableProgressiveContextBuilding: true,
  contextOverflowPreventionEnabled: true,
  workingMemoryIntegrationEnabled: true,
  elementKnowledgeTrackingEnabled: true,
  
  enableInvestigationLearning: true,
  patternRecognitionEnabled: true,
  adaptiveStrategyEnabled: true,
  investigationMetricsEnabled: true,
  
  minimumConfidenceThreshold: 0.7,
  investigationQualityChecks: true,
  fallbackStrategyEnabled: true,
  investigationValidationEnabled: true
} as const;
