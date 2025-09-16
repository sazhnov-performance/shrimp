# AI Prompt Manager Design Document

## Overview
The AI Prompt Manager module generates structured prompts for an AI web browser agent that operates in an ACT-REFLECT-ACT loop with sophisticated page investigation capabilities. It constructs context-aware prompts that include execution history, filtered context, working memory, and investigation tools, enabling the AI to intelligently explore pages, understand their structure, and make informed automation decisions while preventing context overflow.

## Core Responsibilities
- Generate context-aware prompts for AI web browser agent
- Support ACT-REFLECT-ACT execution loop pattern with page investigation cycles
- Integrate filtered context and working memory from AI Context Manager
- Apply response schemas from AI Schema Manager
- Handle action prompts, reflection prompts, and investigation prompts
- Support progressive context building with investigation tools
- Generate prompts for page investigation phases (Initial Assessment, Focused Exploration, Selector Determination)
- Manage context overflow prevention through filtered context integration
- Provide investigation tool guidance (screenshot analysis, text extraction, DOM retrieval, sub-DOM extraction)
- Maintain working memory integration for element knowledge and patterns
- Support investigation strategy recommendations and adaptive learning

## Module Interface

### Core Prompt Generation
```typescript
interface AIPromptManager {
  // Traditional ACT-REFLECT prompts
  generateActionPrompt(request: ActionPromptRequest): Promise<GeneratedPrompt>;
  generateReflectionPrompt(request: ReflectionPromptRequest): Promise<GeneratedPrompt>;
  
  // Investigation-enhanced prompts
  generateInvestigationPrompt(request: InvestigationPromptRequest): Promise<GeneratedPrompt>;
  generateActionWithInvestigationPrompt(request: ActionWithInvestigationRequest): Promise<GeneratedPrompt>;
  
  // Template and validation management
  getPromptTemplates(): PromptTemplateCollection;
  updatePromptTemplate(templateId: string, template: PromptTemplate): void;
  validatePromptStructure(prompt: GeneratedPrompt): PromptValidationResult;
}

interface ActionPromptRequest {
  sessionId: string;
  currentStepIndex: number;
  currentStepContent: string;
  includeValidation: boolean;
  promptOptions?: PromptOptions;
}

interface ReflectionPromptRequest {
  sessionId: string;
  completedStepIndex: number;
  nextStepIndex: number;
  nextStepContent: string;
  expectedOutcome?: string;
  promptOptions?: PromptOptions;
}

// Investigation-specific prompt requests
interface InvestigationPromptRequest {
  sessionId: string;
  stepIndex: number;
  stepContent: string;
  investigationPhase: InvestigationPhase;
  availableTools: InvestigationTool[];
  investigationOptions?: InvestigationOptions;
}

interface ActionWithInvestigationRequest {
  sessionId: string;
  stepIndex: number;
  stepContent: string;
  investigationContext: InvestigationContextSummary;
  promptOptions?: PromptOptions;
}

enum InvestigationPhase {
  INITIAL_ASSESSMENT = 'INITIAL_ASSESSMENT',
  FOCUSED_EXPLORATION = 'FOCUSED_EXPLORATION', 
  SELECTOR_DETERMINATION = 'SELECTOR_DETERMINATION'
}

enum InvestigationTool {
  SCREENSHOT_ANALYSIS = 'SCREENSHOT_ANALYSIS',
  TEXT_EXTRACTION = 'TEXT_EXTRACTION',
  FULL_DOM_RETRIEVAL = 'FULL_DOM_RETRIEVAL',
  SUB_DOM_EXTRACTION = 'SUB_DOM_EXTRACTION'
}

interface InvestigationOptions {
  maxInvestigationRounds?: number;
  confidenceThreshold?: number;
  preferredTools?: InvestigationTool[];
  contextManagementApproach?: 'minimal' | 'standard' | 'comprehensive';
  includeWorkingMemory?: boolean;
  includeElementKnowledge?: boolean;
}

interface InvestigationContextSummary {
  investigationsPerformed: InvestigationSummary[];
  elementsDiscovered: ElementKnowledgeSummary[];
  pageInsight: PageInsightSummary;
  workingMemoryState: WorkingMemorySummary;
  recommendedAction: ActionRecommendation;
}
```

### Prompt Structure
```typescript
interface GeneratedPrompt {
  promptId: string;
  sessionId: string;
  stepIndex: number;
  promptType: PromptType;
  content: PromptContent;
  schema: ResponseSchema;
  generatedAt: Date;
  metadata?: Record<string, any>;
}

enum PromptType {
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

interface PromptContent {
  systemMessage: string;
  contextSection: ContextSection;
  instructionSection: InstructionSection;
  validationSection?: ValidationSection;
  investigationSection?: InvestigationSection;
  workingMemorySection?: WorkingMemorySection;
  schemaSection: SchemaSection;
  examplesSection?: ExamplesSection;
}
```

### Context Integration
```typescript
interface ContextSection {
  currentStep: StepContext;
  executionHistory: ExecutionHistorySection;
  pageStates: PageStateSection;
  filteredContext?: FilteredContextSection;
  investigationHistory?: InvestigationHistorySection;
  sessionMetadata?: Record<string, any>;
}

// Filtered context integration from AI Context Manager
interface FilteredContextSection {
  executionSummary: ExecutionSummaryItem[];
  pageInsights: PageInsight[];
  elementKnowledge: ElementKnowledge[];
  contextSource: 'filtered' | 'traditional';
  filteringLevel: 'minimal' | 'standard' | 'detailed';
  confidenceThreshold: number;
}

// Investigation history from previous investigation cycles
interface InvestigationHistorySection {
  currentStepInvestigations: InvestigationSummary[];
  previousStepInvestigations: InvestigationSummary[];
  totalInvestigationsPerformed: number;
  investigationStrategy: InvestigationStrategySummary;
}

interface StepContext {
  stepIndex: number;
  stepContent: string;
  stepType: 'initial' | 'continuation' | 'validation' | 'investigation' | 'action_with_investigation';
  totalSteps: number;
  investigationPhase?: InvestigationPhase;
  currentInvestigationRound?: number;
  maxInvestigationRounds?: number;
}

interface ExecutionHistorySection {
  previousSteps: StepExecutionSummary[];
  chronologicalEvents: ExecutionEventSummary[];
  successfulActions: number;
  failedActions: number;
}

interface StepExecutionSummary {
  stepIndex: number;
  stepName: string;
  reasoning: string;
  executorMethod: string;
  status: ExecutionStatus;
  timestamp: Date;
}

interface ExecutionEventSummary {
  stepIndex: number;
  reasoning: string;
  executorMethod: string;
  outcome: string;
  timestamp: Date;
}
```

### Page State Management
```typescript
interface PageStateSection {
  previousPageDom?: string;
  currentPageDom?: string;
  domComparison?: DomComparisonResult;
  relevantElements?: ElementContext[];
}

interface DomComparisonResult {
  hasChanges: boolean;
  addedElements: string[];
  removedElements: string[];
  modifiedElements: string[];
  summary: string;
}

interface ElementContext {
  selector: string;
  elementType: string;
  textContent?: string;
  attributes?: Record<string, string>;
  relevanceScore: number;
}

// Investigation-specific prompt sections
interface InvestigationSection {
  investigationPhase: InvestigationPhase;
  availableTools: InvestigationToolDescription[];
  investigationStrategy: InvestigationStrategyGuidance;
  phaseSpecificGuidance: PhaseGuidance;
  contextManagementGuidance: ContextManagementGuidance;
}

interface InvestigationToolDescription {
  tool: InvestigationTool;
  description: string;
  useCase: string;
  expectedOutput: string;
  limitationsAndConsiderations: string[];
  parameters?: ToolParameter[];
}

interface InvestigationStrategyGuidance {
  currentPhaseObjective: string;
  investigationPriority: InvestigationPriority;
  suggestedApproach: string[];
  successCriteria: string[];
  nextPhaseConditions: string[];
}

interface PhaseGuidance {
  phaseDescription: string;
  keyObjectives: string[];
  recommendedTools: InvestigationTool[];
  investigationQuestions: string[];
  outputExpectations: string[];
  commonPitfalls: string[];
}

interface ContextManagementGuidance {
  contextOverflowPrevention: string[];
  contentFilteringStrategy: string;
  summaryGuidelines: string[];
  elementKnowledgeTracking: string[];
  workingMemoryUpdates: string[];
}

// Working Memory integration
interface WorkingMemorySection {
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
```

### Validation and Reflection
```typescript
interface ValidationSection {
  lastActionValidation: ActionValidationPrompt;
  resultAnalysis: ResultAnalysisPrompt;
  decisionFramework: DecisionFrameworkPrompt;
}

interface ActionValidationPrompt {
  expectedOutcome: string;
  actualState: string;
  validationCriteria: ValidationCriteria[];
  successIndicators: string[];
  failureIndicators: string[];
}

interface ValidationCriteria {
  criterion: string;
  evaluationMethod: string;
  weight: number;
  description: string;
}

interface ResultAnalysisPrompt {
  analysisInstructions: string;
  comparisonPoints: string[];
  domAnalysisGuidance: string;
  errorDetectionGuidance: string;
}

interface DecisionFrameworkPrompt {
  decisionOptions: DecisionOption[];
  decisionCriteria: string[];
  proceedConditions: string[];
  retryConditions: string[];
  abortConditions: string[];
}

interface DecisionOption {
  action: DecisionAction;
  description: string;
  conditions: string[];
  consequences: string[];
}

// Supporting interfaces for investigation and working memory
interface InvestigationSummary {
  investigationType: InvestigationTool;
  objective: string;
  outcome: 'success' | 'partial' | 'failure';
  keyFindings: string[];
  confidence: number;
  timestamp: Date;
}

interface ElementKnowledgeSummary {
  selector: string;
  elementType: string;
  purpose: string;
  reliability: number;
  lastValidated: Date;
  alternativeSelectors?: string[];
}

interface PageInsightSummary {
  pageType: string;
  mainSections: string[];
  keyElements: string[];
  complexity: 'low' | 'medium' | 'high';
  navigationStructure: string;
}

interface WorkingMemorySummary {
  elementsKnown: number;
  patternsLearned: number;
  variablesExtracted: number;
  investigationRoundsCompleted: number;
  overallConfidence: number;
}

interface ActionRecommendation {
  recommendedAction: string;
  confidence: number;
  reasoning: string[];
  requiredValidation: string[];
  fallbackOptions: string[];
}

interface NavigationPatternSummary {
  pattern: string;
  reliability: number;
  usageCount: number;
}

interface VariableSummary {
  name: string;
  value: string;
  source: string;
  reliability: number;
}

interface PatternSummary {
  pattern: string;
  context: string;
  reliability: number;
  frequency: number;
}

interface InvestigationPreferencesSummary {
  preferredToolOrder: InvestigationTool[];
  qualityThresholds: Record<string, number>;
  adaptiveStrategies: string[];
}

interface InvestigationStrategySummary {
  currentApproach: string;
  adaptations: string[];
  learningsApplied: string[];
}

interface InvestigationPriority {
  primary: InvestigationTool;
  fallbacks: InvestigationTool[];
  reasoning: string;
}

interface ToolParameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
  example?: string;
}
```

### Template Management
```typescript
interface PromptTemplateCollection {
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

interface PromptTemplate {
  templateId: string;
  name: string;
  description: string;
  template: string;
  variables: TemplateVariable[];
  version: string;
  lastModified: Date;
}

interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
  defaultValue?: any;
}
```

### Configuration and Options
```typescript
interface PromptOptions {
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

// Import shared configuration pattern
import { BaseModuleConfig, DEFAULT_TIMEOUT_CONFIG } from './shared-types';

interface AIPromptManagerConfig extends BaseModuleConfig {
  moduleId: 'ai-prompt-manager';
  
  // AI Prompt Manager specific configuration
  defaultPromptOptions: PromptOptions;
  templateConfig: TemplateConfig;
  contextConfig: ContextConfig;
  validationConfig: ValidationConfig;
  investigationConfig: InvestigationConfig;
  
  // Inherits from BaseModuleConfig:
  // - logging: LoggingConfig
  // - performance: PerformanceConfig (renamed from performanceConfig)
  // - timeouts: TimeoutConfig
}

interface TemplateConfig {
  enableCustomTemplates: boolean;
  templateCacheEnabled: boolean;
  templateValidationEnabled: boolean;
  fallbackToDefault: boolean;
}

interface ContextConfig {
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

interface ValidationConfig {
  enableActionValidation: boolean;
  enableResultAnalysis: boolean;
  validationTimeoutMs: number;
  requireExplicitValidation: boolean;
}

interface PerformanceConfig {
  promptCacheEnabled: boolean;
  cacheTTLMs: number;
  maxCacheSize: number;
  asyncGeneration: boolean;
}

// Investigation-specific configuration
interface InvestigationConfig {
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

type ToolSettingsMap = {
  [K in InvestigationTool]: ToolSpecificSettings;
};

interface ToolSpecificSettings {
  enabled: boolean;
  timeoutMs: number;
  maxRetries: number;
  qualityThreshold: number;
  specificParameters?: Record<string, any>;
}
```

### Integration Interfaces
```typescript
interface SchemaManagerIntegration {
  getResponseSchema(options?: SchemaOptions): Promise<ResponseSchema>;
  validateSchemaCompatibility(schema: ResponseSchema): boolean;
  getSchemaVersion(): string;
}

interface ContextManagerIntegration {
  // Traditional context methods
  getExecutionContext(sessionId: string, stepIndex: number): Promise<AIContextJson>;
  getStepHistory(sessionId: string, maxSteps?: number): Promise<StepExecutionSummary[]>;
  getCurrentPageState(sessionId: string): Promise<string>;
  getPreviousPageState(sessionId: string, stepIndex: number): Promise<string | null>;
  
  // Investigation-enhanced context methods
  generateFilteredContext(sessionId: string, targetStep: number, options: ContextFilterOptions): Promise<FilteredContextJson>;
  generateInvestigationContext(sessionId: string, stepIndex: number): Promise<InvestigationContextJson>;
  getWorkingMemory(sessionId: string): WorkingMemoryState;
  getInvestigationHistory(sessionId: string, stepIndex: number): InvestigationResult[];
  getPageElementsDiscovered(sessionId: string, stepIndex: number): ElementDiscovery[];
  getContextSummaries(sessionId: string, stepRange?: [number, number]): StepContextSummary[];
}

// Import types from AI Context Manager
interface ContextFilterOptions {
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
interface FilteredContextJson {
  sessionId: string;
  targetStep: number;
  generatedAt: Date;
  executionSummary: ExecutionSummaryItem[];
  pageInsights: PageInsight[];
  elementKnowledge: ElementKnowledge[];
  workingMemory: WorkingMemoryState;
  investigationStrategy: InvestigationStrategy;
}

interface InvestigationContextJson {
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

// Additional types that support the investigation flow
interface ExecutionSummaryItem {
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

interface PageInsight {
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

interface ElementKnowledge {
  selector: string;
  elementType: string;
  purpose: string;
  reliability: number;
  lastSeen: Date;
  discoveryHistory: string[];
  alternativeSelectors?: string[];
  interactionNotes?: string;
}

interface WorkingMemoryState {
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

interface InvestigationStrategy {
  currentPhase: 'initial_assessment' | 'focused_exploration' | 'selector_determination';
  recommendedInvestigations: SuggestedInvestigation[];
  investigationPriority: InvestigationPriority;
  contextManagementApproach: 'minimal' | 'standard' | 'comprehensive';
  confidenceThreshold: number;
  maxInvestigationRounds: number;
}

interface SuggestedInvestigation {
  type: InvestigationTool;
  purpose: string;
  parameters?: Record<string, any>;
  priority: number;
  reasoning: string;
}

interface InvestigationResult {
  investigationId: string;
  investigationType: InvestigationTool;
  timestamp: Date;
  input: InvestigationInput;
  output: InvestigationOutput;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

interface ElementDiscovery {
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

interface StepContextSummary {
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
interface NavigationPattern {
  urlPattern: string;
  navigationSteps: string[];
  reliability: number;
  lastUsed: Date;
}

interface VariableContext {
  name: string;
  value: string;
  extractionMethod: string;
  reliability: number;
  lastUpdated: Date;
  sourceElement?: string;
}

interface SuccessPattern {
  pattern: string;
  context: string;
  successRate: number;
  usageCount: number;
  lastUsed: Date;
}

interface FailurePattern {
  pattern: string;
  context: string;
  failureReasons: string[];
  lastEncountered: Date;
  avoidanceStrategy?: string;
}

interface InvestigationPreferences {
  preferredOrder: InvestigationTool[];
  qualityThresholds: Record<InvestigationTool, number>;
  fallbackStrategies: Record<InvestigationTool, InvestigationTool[]>;
}

interface InvestigationInput {
  selector?: string;
  screenshotId?: string;
  parameters?: Record<string, any>;
}

interface InvestigationOutput {
  textContent?: string;
  domContent?: string;
  visualDescription?: string;
  elementCount?: number;
  summary?: string;
}

interface ElementProperties {
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
```

### Validation and Quality Assurance
```typescript
interface PromptValidationResult {
  isValid: boolean;
  errors: PromptValidationError[];
  warnings: string[];
  qualityScore: number;
  suggestions: string[];
}

interface PromptValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  code: string;
}

interface IPromptValidator {
  validatePromptStructure(prompt: GeneratedPrompt): PromptValidationResult;
  validateTemplateVariables(template: PromptTemplate, variables: Record<string, any>): boolean;
  validateSchemaIntegration(prompt: GeneratedPrompt): boolean;
  assessPromptQuality(prompt: GeneratedPrompt): QualityAssessment;
}

interface QualityAssessment {
  clarityScore: number;
  completenessScore: number;
  contextRelevanceScore: number;
  schemaAlignmentScore: number;
  overallScore: number;
  improvements: string[];
}
```

## Prompt Generation Flow

### Investigation-Enhanced Prompt Generation

#### Investigation Prompt Flow (New)
1. **Receive Investigation Request**: Get investigation prompt request with phase and available tools
2. **Determine Investigation Phase**: Initial Assessment, Focused Exploration, or Selector Determination
3. **Load Investigation Context**: Retrieve filtered context and working memory from AI Context Manager
4. **Build Investigation Section**: Include available tools, phase guidance, and strategy recommendations
5. **Generate Working Memory Section**: Include element knowledge, patterns, and preferences
6. **Create Context Management Guidance**: Add overflow prevention and filtering strategies
7. **Apply Investigation Schema**: Use schema for investigation responses and tool usage
8. **Validate and Return**: Ensure investigation prompt meets quality requirements

#### Action With Investigation Context Flow (New)
1. **Receive Action Request**: Get request with investigation context summary
2. **Load Investigation Results**: Retrieve completed investigations and discoveries
3. **Build Enhanced Context**: Combine filtered context with investigation findings
4. **Include Element Knowledge**: Add discovered elements and reliability scores
5. **Apply Working Memory**: Include learned patterns and preferences
6. **Generate Action Guidance**: Provide specific action recommendations based on investigations
7. **Create Validation Framework**: Include investigation-based validation criteria
8. **Return Enhanced Action Prompt**: Provide context-rich prompt for informed action

### Traditional Prompt Flows (Enhanced)

#### Initial Action Prompt Flow (Enhanced)
1. Receive action prompt request for step index 0
2. Retrieve current step content and context
3. **Check for Investigation Mode**: Determine if investigation-enhanced flow should be used
4. Load system message template and action prompt template
5. Generate schema section using AI Schema Manager
6. Build context section (minimal for first step, or filtered if investigation enabled)
7. **Include Working Memory**: Add any existing working memory state
8. Construct instruction section for the specific step
9. **Add Investigation Guidance**: Include investigation options if enabled
10. Combine all sections into structured prompt
11. Validate prompt structure and quality
12. Return generated prompt with schema

#### Reflection and Action Prompt Flow (Enhanced)
1. Receive reflection prompt request for step index > 0
2. **Retrieve Filtered Context**: Get filtered context to prevent overflow
3. **Load Investigation History**: Include investigation results and discoveries
4. **Get Working Memory State**: Retrieve element knowledge and patterns
5. Load reflection prompt template with validation sections
6. **Build Enhanced Context Section**: Use filtered context with investigation insights
7. **Generate Investigation-Aware Validation**: Include investigation-based success criteria
8. **Create Result Analysis with Element Knowledge**: Use discovered elements for analysis
9. **Include Working Memory Updates**: Guide AI on updating element knowledge
10. Include current step instruction for next action
11. **Add Investigation Strategy**: Recommend investigation approach for next step
12. Generate schema section for AI response format
13. Validate complete prompt structure
14. Return reflection prompt with investigation requirements

### Context Integration Process (Enhanced)

#### Filtered Context Integration (New)
1. **Query Filtered Context**: Request filtered context from AI Context Manager
2. **Retrieve Investigation History**: Get investigation results and element discoveries
3. **Load Working Memory**: Access element knowledge, patterns, and preferences
4. **Apply Context Filtering**: Use filtering options to prevent overflow
5. **Summarize Page Insights**: Include page understanding without full content
6. **Format Element Knowledge**: Present discovered elements and selectors
7. **Include Pattern Learning**: Add successful and failed patterns
8. **Structure for AI Consumption**: Format all context for optimal AI understanding

#### Progressive Context Building (New)
1. **Initialize Working Memory**: Start with empty or existing working memory state
2. **Process Investigation Results**: Add new discoveries to element knowledge
3. **Update Pattern Recognition**: Learn from successful and failed interactions
4. **Refine Investigation Strategy**: Adapt approach based on page complexity
5. **Maintain Context Size**: Continuously filter and summarize to prevent overflow
6. **Build Cumulative Understanding**: Progressively enhance page understanding
7. **Optimize Future Investigations**: Use learned patterns for better investigation strategies

#### Traditional Context Integration (Enhanced)
1. Query AI Context Manager for session execution history
2. **Choose Context Strategy**: Use filtered context or traditional based on configuration
3. Retrieve chronological list of reasoning and executor commands
4. **Get Investigation-Enhanced Page States**: Include investigation insights
5. Filter and organize context based on prompt options
6. **Apply Progressive Context Building**: Use working memory for context enhancement
7. Compress or summarize large DOM content if needed
8. **Highlight Investigation Discoveries**: Emphasize discovered elements and patterns
9. Format context into structured sections

### Schema Integration Process (Enhanced)
1. Query AI Schema Manager for current response schema
2. Apply prompt-specific schema options
3. **Include Investigation Tool Schema**: Add schema for investigation tool usage
4. **Add Working Memory Update Schema**: Include schema for memory updates
5. Include decision validation requirements for reflection prompts
6. **Add Investigation Result Schema**: Define schema for investigation outcomes
7. Add command schema for executor integration
8. **Include Element Discovery Schema**: Define schema for element knowledge updates
9. Format schema as instruction for AI response structure
10. **Add Investigation Strategy Schema**: Define schema for investigation planning
11. Include examples if configured

## Error Handling and Fallbacks

### Error Types
```typescript
enum PromptManagerErrorType {
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

interface PromptManagerError extends Error {
  type: PromptManagerErrorType;
  sessionId?: string;
  stepIndex?: number;
  context?: Record<string, any>;
}
```

### Fallback Strategies
- Use default templates when custom templates fail
- Generate minimal context when full context unavailable
- Compress or truncate DOM when size limits exceeded
- Provide basic schema when schema generation fails
- Create simplified prompts for critical path execution

#### Investigation-Specific Fallbacks
- **Investigation Context Fallback**: Use traditional context when filtered context unavailable
- **Working Memory Fallback**: Initialize empty working memory when corrupted or unavailable
- **Investigation Tool Fallback**: Use available tools when preferred tools fail
- **Context Filtering Fallback**: Use traditional DOM when filtering fails
- **Element Knowledge Fallback**: Continue without element knowledge when corrupted
- **Investigation Strategy Fallback**: Use basic investigation approach when strategy generation fails
- **Progressive Context Fallback**: Use static context when progressive building fails
- **Investigation Timeout Fallback**: Proceed with available investigation results when timeout occurs

## Performance Considerations

### Optimization Strategies
- Cache frequently used prompt templates
- Implement async prompt generation for non-blocking operations
- Compress large DOM content before inclusion
- Use streaming for very large context data
- Implement prompt deduplication for repeated scenarios

### Resource Management
- Monitor prompt generation time and optimize bottlenecks
- Limit DOM size and history depth based on configuration
- Implement garbage collection for cached prompts
- Track memory usage for large context objects

## Integration Dependencies

### AI Schema Manager
- Response schema generation
- Validation rule definitions
- Schema versioning and compatibility
- Command structure validation

### AI Context Manager
- Execution history retrieval
- Step context and metadata
- Page state management
- Session information access

### Executor Module
- Command action definitions
- Parameter structure requirements
- Response format expectations
- Error context integration

## Testing Strategy

### Unit Testing
- Template rendering with various data inputs
- Context integration with mock data
- Schema integration validation
- Error handling and fallback scenarios
- Performance with large context data

#### Investigation-Specific Unit Testing
- Investigation prompt generation for each phase
- Working memory integration and updates
- Filtered context processing and validation
- Investigation tool integration and configuration
- Context overflow prevention mechanisms
- Element knowledge tracking and retrieval
- Progressive context building logic
- Investigation strategy generation
- Context filtering and summarization
- Investigation error handling and recovery

### Integration Testing
- End-to-end prompt generation flow
- Schema manager integration
- Context manager integration
- Validation with actual AI responses
- Multi-step execution scenarios

#### Investigation-Enhanced Integration Testing
- Complete investigation cycle workflows (Initial Assessment → Focused Exploration → Selector Determination → Action)
- Filtered context integration with AI Context Manager
- Working memory persistence and retrieval
- Investigation tool chaining and fallbacks
- Progressive context building across multiple steps
- Element knowledge accumulation and usage
- Investigation strategy adaptation and learning
- Cross-phase investigation data flow
- Investigation timeout and recovery scenarios
- Working memory cleanup and optimization

### Performance Testing
- Large DOM handling
- Extensive execution history
- Template rendering performance
- Memory usage with large prompts
- Concurrent prompt generation

#### Investigation Performance Testing
- Filtered context generation performance
- Working memory processing speed
- Investigation prompt generation latency
- Context filtering and summarization efficiency
- Element knowledge lookup performance
- Progressive context building memory usage
- Investigation strategy computation time
- Large working memory state handling
- Concurrent investigation prompt generation
- Investigation tool integration latency

## Security Considerations

### Data Sanitization
- Sanitize DOM content for prompt inclusion
- Validate template variables for injection attacks
- Filter sensitive information from context
- Limit template variable expansion depth

### Access Control
- Validate session access permissions
- Restrict template modification access
- Control context information exposure
- Implement audit logging for prompt generation

## Future Enhancements

### Advanced Features
- Machine learning for prompt optimization
- Dynamic template adaptation based on success rates
- Advanced DOM analysis and element highlighting
- Multi-language prompt support
- Voice-enabled prompt generation

#### Investigation-Specific Advanced Features
- **AI-Powered Investigation Strategy Generation**: Machine learning models to optimize investigation sequences
- **Adaptive Context Filtering**: Dynamic context filtering based on AI model capabilities and page complexity
- **Intelligent Element Discovery**: Computer vision integration for visual element identification
- **Cross-Session Learning**: Share investigation patterns and element knowledge across sessions
- **Predictive Investigation**: Predict optimal investigation approaches before starting
- **Context Quality Optimization**: AI-powered context quality assessment and improvement
- **Visual Investigation Guidance**: Interactive visual guides for investigation tool usage
- **Investigation Pattern Recognition**: Automated discovery of successful investigation patterns
- **Dynamic Working Memory Management**: Intelligent memory compression and optimization
- **Multi-Modal Investigation**: Integration of visual, textual, and structural investigation methods

### Integration Expansions
- Support for additional automation frameworks
- Integration with external AI services
- Custom validation rule engines
- Advanced debugging and visualization tools
- Real-time prompt collaboration features

#### Investigation Integration Expansions
- **Computer Vision Services**: Integration with image analysis APIs for enhanced screenshot analysis
- **Natural Language Processing**: Advanced text analysis for better page content understanding
- **Machine Learning Platforms**: Integration with ML services for pattern recognition and optimization
- **Visual Testing Tools**: Integration with visual regression testing frameworks
- **Accessibility Analysis**: Integration with accessibility testing tools for comprehensive page understanding
- **Performance Monitoring**: Integration with performance analysis tools for investigation optimization
- **Collaborative Investigation**: Multi-user investigation scenarios with shared working memory
- **Investigation Analytics**: Detailed analytics and reporting for investigation effectiveness
- **External Knowledge Bases**: Integration with design systems and UI pattern libraries
- **Real-time Investigation Streaming**: Live investigation progress monitoring and collaboration

## Constants and Configuration

```typescript
// Version and defaults
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
```

## Summary of Investigation Flow Integration

The AI Prompt Manager has been enhanced to support the sophisticated page investigation flow described in the overall architecture. Key integration points include:

### Investigation Cycle Support
1. **Phase-Specific Prompts**: Specialized prompts for Initial Assessment, Focused Exploration, and Selector Determination phases
2. **Investigation Tool Integration**: Built-in guidance for screenshot analysis, text extraction, DOM retrieval, and sub-DOM extraction
3. **Progressive Context Building**: Integration with filtered context from AI Context Manager to prevent overflow
4. **Working Memory Integration**: Seamless integration with element knowledge, patterns, and investigation preferences

### Context Management Strategy
1. **Filtered Context Integration**: Uses filtered context from AI Context Manager instead of raw DOM content
2. **Investigation History Tracking**: Maintains investigation results and element discoveries across phases
3. **Element Knowledge Accumulation**: Builds and maintains knowledge base of discovered elements and selectors
4. **Pattern Learning Integration**: Incorporates successful and failed patterns for future investigations

### Enhanced Prompt Generation
1. **Investigation-Aware Templates**: New templates specifically designed for investigation workflows
2. **Tool-Specific Guidance**: Detailed guidance for each investigation tool with parameters and best practices
3. **Context Overflow Prevention**: Built-in strategies to manage context size while preserving critical information
4. **Adaptive Strategy Recommendations**: Dynamic investigation strategy suggestions based on page complexity and working memory

### Configuration and Extensibility
1. **Investigation-Specific Configuration**: Comprehensive configuration options for investigation behavior
2. **Tool Priority Management**: Configurable tool priority and fallback strategies
3. **Working Memory Settings**: Configurable working memory management and cleanup policies
4. **Learning and Adaptation**: Configurable learning rates and pattern recognition thresholds

This integration enables the AI to intelligently explore pages, build comprehensive understanding while managing context limitations, and make informed automation decisions based on accumulated knowledge and investigation results.
