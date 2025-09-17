import {
  TaskLoopStepRequest,
  StepResult,
  ExecutorCommand,
  AIResponse,
  AIGeneratedCommand,
  StandardError,
  DIContainer,
  DEPENDENCY_TOKENS,
  IEventPublisher,
  TaskLoopEvent,
  TaskLoopEventType,
  TaskLoopEventData,
  ISessionManager,
  ModuleSessionInfo,
  ModuleSessionConfig,
  SessionStatus,
  SessionLifecycleCallbacks,
  SessionManagerHealth,
  InvestigationPhase,
  InvestigationTool,
  ElementDiscovery,
  PageInsight,
  CommandResponse,
  BaseModuleConfig,
  LoggingConfig,
  PerformanceConfig,
  TimeoutConfig,
  LogLevel,
  ErrorCategory,
  ErrorSeverity
} from '../../types/shared-types';

// ============================================================================
// CORE TASK LOOP INTERFACES
// ============================================================================

export interface ITaskLoop extends ISessionManager {
  readonly moduleId: 'task-loop';
  
  // Standardized Session Management (inherited from ISessionManager)
  createSession(workflowSessionId: string, config?: ModuleSessionConfig): Promise<string>;
  destroySession(workflowSessionId: string): Promise<void>;
  getSession(workflowSessionId: string): ModuleSessionInfo | null;
  sessionExists(workflowSessionId: string): boolean;
  updateSessionStatus(workflowSessionId: string, status: SessionStatus): Promise<void>;
  getSessionStatus(workflowSessionId: string): SessionStatus | null;
  recordActivity(workflowSessionId: string): Promise<void>;
  getLastActivity(workflowSessionId: string): Date | null;
  setLifecycleCallbacks(callbacks: SessionLifecycleCallbacks): void;
  healthCheck(): Promise<SessionManagerHealth>;
  
  // Main Processing (uses workflowSessionId consistently)
  processStep(request: TaskLoopStepRequest): Promise<StepResult>;
  
  // Investigation Processing
  processInvestigationPhase(request: InvestigationPhaseRequest): Promise<InvestigationPhaseResult>;
  executeInvestigationTool(request: InvestigationToolRequest): Promise<InvestigationToolResult>;
  
  // Flow Control (uses workflowSessionId consistently)
  pauseExecution(workflowSessionId: string, stepIndex: number): Promise<void>;
  resumeExecution(workflowSessionId: string, stepIndex: number): Promise<void>;
  cancelExecution(workflowSessionId: string, stepIndex: number): Promise<void>;
  pauseInvestigation(workflowSessionId: string, stepIndex: number): Promise<void>;
  resumeInvestigation(workflowSessionId: string, stepIndex: number): Promise<void>;
  
  // Event-Driven Architecture
  setEventPublisher(publisher: IEventPublisher): void;
  
  // Status and Monitoring (uses workflowSessionId consistently)
  getExecutionState(workflowSessionId: string, stepIndex: number): Promise<ExecutionState>;
  getLoopMetrics(workflowSessionId: string): Promise<LoopMetrics>;
  
  // Dependency Injection
  initialize(container: DIContainer): Promise<void>;
}

// ============================================================================
// EXECUTION STATE AND FLOW
// ============================================================================

export interface ExecutionState {
  phase: ExecutionPhase;
  currentIteration: number;
  maxIterations: number;
  lastCommands?: ExecutorCommand[];
  aiResponse?: AIResponse;
  reflectionData?: ReflectionData;
  investigationState?: InvestigationState;
  error?: StandardError;
  startTime: Date;
}

export enum ExecutionPhase {
  INITIALIZING = 'INITIALIZING',
  GENERATING_PROMPT = 'GENERATING_PROMPT',
  QUERYING_AI = 'QUERYING_AI',
  PROCESSING_RESPONSE = 'PROCESSING_RESPONSE',
  // Investigation phases
  INVESTIGATING = 'INVESTIGATING',
  INITIAL_ASSESSMENT = 'INITIAL_ASSESSMENT',
  FOCUSED_EXPLORATION = 'FOCUSED_EXPLORATION',
  SELECTOR_DETERMINATION = 'SELECTOR_DETERMINATION',
  BUILDING_CONTEXT = 'BUILDING_CONTEXT',
  // Existing phases
  EXECUTING_COMMANDS = 'EXECUTING_COMMANDS',
  REFLECTING = 'REFLECTING',
  VALIDATING = 'VALIDATING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export interface ReflectionData {
  decision: DecisionAction;
  reasoning: string;
  confidence: number;
  suggestedModifications?: string;
  riskAssessment?: RiskAssessment;
}

export enum DecisionAction {
  PROCEED = 'PROCEED',
  RETRY = 'RETRY',
  ABORT = 'ABORT'
}

export interface RiskAssessment {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  potentialIssues: string[];
  recommendations: string[];
}

// ============================================================================
// INVESTIGATION INTERFACES
// ============================================================================

export interface InvestigationState {
  currentPhase: InvestigationPhase;
  phasesCompleted: InvestigationPhase[];
  investigationRound: number;
  maxInvestigationRounds: number;
  toolsUsed: InvestigationTool[];
  elementsDiscovered: ElementDiscovery[];
  pageInsight?: PageInsight;
  workingMemory?: WorkingMemoryState;
  investigationStrategy?: InvestigationStrategy;
  startTime: Date;
  phaseStartTime: Date;
  error?: StandardError;
}

export interface InvestigationPhaseRequest {
  sessionId: string;
  stepIndex: number;
  stepContent: string;
  phase: InvestigationPhase;
  investigationOptions?: InvestigationOptions;
  context?: PageInvestigationContext;
}

export interface InvestigationPhaseResult {
  success: boolean;
  phase: InvestigationPhase;
  toolsExecuted: InvestigationTool[];
  elementsDiscovered: ElementDiscovery[];
  pageInsight?: PageInsight;
  workingMemoryUpdates?: WorkingMemoryUpdate[];
  nextPhaseRecommendation?: InvestigationPhase;
  readyForAction: boolean;
  confidence: number;
  duration: number;
  error?: StandardError;
}

export interface InvestigationToolRequest {
  sessionId: string;
  stepIndex: number;
  tool: InvestigationTool;
  parameters?: InvestigationToolParameters;
  context?: PageInvestigationContext;
}

export interface InvestigationToolResult {
  success: boolean;
  tool: InvestigationTool;
  output: InvestigationOutput;
  elementsDiscovered?: ElementDiscovery[];
  pageInsightUpdates?: Partial<PageInsight>;
  workingMemoryUpdates?: WorkingMemoryUpdate[];
  confidence: number;
  duration: number;
  error?: StandardError;
}

export interface InvestigationToolParameters {
  selector?: string;
  screenshotId?: string;
  maxDomSize?: number;
  includeStyles?: boolean;
  includeHiddenText?: boolean;
  maxTextLength?: number;
}

export interface PageInvestigationContext {
  sessionId: string;
  stepIndex: number;
  stepObjective: string;
  currentUrl?: string;
  previousInvestigations: InvestigationResult[];
  elementsKnown: ElementKnowledge[];
  workingMemory: WorkingMemoryState;
  investigationStrategy: InvestigationStrategy;
  contextSize: number;
  maxContextSize: number;
}

export interface InvestigationOptions {
  enableInvestigation: boolean;
  maxInvestigationRounds: number;
  confidenceThreshold: number;
  preferredTools: InvestigationTool[];
  contextManagementApproach: 'minimal' | 'standard' | 'comprehensive';
  enableWorkingMemory: boolean;
  enableElementKnowledge: boolean;
  enableProgressiveContext: boolean;
  investigationTimeoutMs: number;
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

export interface InvestigationOutput {
  textContent?: string;
  domContent?: string;
  visualDescription?: string;
  elementCount?: number;
  summary?: string;
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

export interface InvestigationPriority {
  primary: InvestigationTool;
  fallbacks: InvestigationTool[];
  reasoning: string;
}

export interface WorkingMemoryUpdate {
  updateType: 'element_discovery' | 'page_insight' | 'variable_extraction' | 'pattern_learning' | 'investigation_preference';
  data: any;
  confidence: number;
  source: string;
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

export interface InvestigationInput {
  selector?: string;
  screenshotId?: string;
  parameters?: Record<string, any>;
}

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

// ============================================================================
// ACT-REFLECT RESULTS
// ============================================================================

export interface ActResult {
  success: boolean;
  commandResults: CommandResponse[];
  executorCommands: ExecutorCommand[];
  aiResponse: AIResponse;
  duration: number;
  expectedOutcome?: string;
  investigationContext?: InvestigationContextSummary;
}

export interface ReflectResult {
  decision: DecisionAction;
  reasoning: string;
  confidence: number;
  suggestedModifications?: string;
  riskAssessment?: RiskAssessment;
}

export interface InvestigationCycleResult {
  success: boolean;
  investigationState: InvestigationState;
  investigationContext: PageInvestigationContext;
  readyForAction: boolean;
  totalDuration: number;
  error?: StandardError;
}

export interface InvestigationContextSummary {
  investigationsPerformed: InvestigationSummary[];
  elementsDiscovered: ElementKnowledgeSummary[];
  pageInsight: PageInsightSummary;
  workingMemoryState: WorkingMemorySummary;
  recommendedAction: ActionRecommendation;
}

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

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface TaskLoopConfig extends BaseModuleConfig {
  moduleId: 'task-loop';
  
  // Task Loop specific configuration
  execution: {
    maxIterations: number;
    enableReflection: boolean;
    reflectionThreshold: number;
  };
  ai: {
    connectionId: string;
    maxTokens: number;
    temperature: number;
  };
  prompts: {
    actionPromptOptions: PromptOptions;
    reflectionPromptOptions: PromptOptions;
    cacheEnabled: boolean;
    cacheTTLMs: number;
  };
  streaming: {
    enabled: boolean;
    publishReasoningUpdates: boolean;
    publishCommandUpdates: boolean;
    publishScreenshots: boolean;
  };
  
  // Investigation Configuration
  investigation: {
    enabled: boolean;
    maxInvestigationRounds: number;
    investigationTimeoutMs: number;
    confidenceThreshold: number;
    enabledTools: InvestigationTool[];
    toolPriorityOrder: InvestigationTool[];
    contextManagementApproach: 'minimal' | 'standard' | 'comprehensive';
    enableWorkingMemory: boolean;
    enableElementKnowledge: boolean;
    enableProgressiveContext: boolean;
    maxContextSize: number;
    investigationPromptOptions: PromptOptions;
  };
  
  // Context Management Configuration
  contextManagement: {
    enableFilteredContext: boolean;
    maxHistorySteps: number;
    excludeFullDom: boolean;
    includePreviousInvestigations: boolean;
    summarizationLevel: 'minimal' | 'standard' | 'detailed';
    workingMemoryEnabled: boolean;
    elementKnowledgeEnabled: boolean;
    patternLearningEnabled: boolean;
  };
}

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

// ============================================================================
// MONITORING AND METRICS
// ============================================================================

export interface LoopMetrics {
  sessionId: string;
  totalSteps: number;
  completedSteps: number;
  totalIterations: number;
  averageIterationsPerStep: number;
  successRate: number;
  averageExecutionTime: number;
  aiResponseTime: number;
  executorResponseTime: number;
  reflectionUsage: number;
  errorBreakdown: Record<TaskLoopErrorType, number>;
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

export enum TaskLoopErrorType {
  // Traditional error types
  PROMPT_GENERATION_ERROR = 'PROMPT_GENERATION_ERROR',
  AI_COMMUNICATION_ERROR = 'AI_COMMUNICATION_ERROR',
  RESPONSE_PARSING_ERROR = 'RESPONSE_PARSING_ERROR',
  COMMAND_EXECUTION_ERROR = 'COMMAND_EXECUTION_ERROR',
  CONTEXT_STORAGE_ERROR = 'CONTEXT_STORAGE_ERROR',
  STREAMING_ERROR = 'STREAMING_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNSUPPORTED_COMMAND = 'UNSUPPORTED_COMMAND',
  
  // Investigation-specific error types
  INVESTIGATION_CYCLE_FAILED = 'INVESTIGATION_CYCLE_FAILED',
  INVESTIGATION_PHASE_FAILED = 'INVESTIGATION_PHASE_FAILED',
  INVESTIGATION_TOOL_FAILED = 'INVESTIGATION_TOOL_FAILED',
  INVESTIGATION_TIMEOUT = 'INVESTIGATION_TIMEOUT',
  UNSUPPORTED_INVESTIGATION_TOOL = 'UNSUPPORTED_INVESTIGATION_TOOL',
  WORKING_MEMORY_UPDATE_FAILED = 'WORKING_MEMORY_UPDATE_FAILED',
  CONTEXT_FILTERING_FAILED = 'CONTEXT_FILTERING_FAILED',
  ELEMENT_DISCOVERY_FAILED = 'ELEMENT_DISCOVERY_FAILED',
  INVESTIGATION_CONTEXT_GENERATION_FAILED = 'INVESTIGATION_CONTEXT_GENERATION_FAILED'
}

export interface TaskLoopError extends Error {
  type: TaskLoopErrorType;
  sessionId: string;
  stepIndex: number;
  phase: ExecutionPhase;
  details?: Record<string, any>;
  timestamp: Date;
}

// ============================================================================
// INTEGRATION INTERFACES
// ============================================================================

export interface AIIntegrationInterface {
  sendRequest(connectionId: string, request: AIRequest): Promise<AIResponse>;
  sendStreamRequest(connectionId: string, request: AIRequest): AsyncGenerator<AIStreamChunk>;
  getConnectionStatus(connectionId: string): Promise<ConnectionStatus>;
}

export interface AIRequest {
  messages: AIMessage[];
  parameters: AIParameters;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIParameters {
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

export interface AIStreamChunk {
  content: string;
  finished: boolean;
}

export interface ConnectionStatus {
  isConnected: boolean;
  lastActivity: Date;
  error?: string;
}

export interface ExecutorInterface {
  openPage(sessionId: string, url: string): Promise<CommandResponse>;
  clickElement(sessionId: string, selector: string): Promise<CommandResponse>;
  inputText(sessionId: string, selector: string, text: string): Promise<CommandResponse>;
  saveVariable(sessionId: string, selector: string, variableName: string): Promise<CommandResponse>;
  getDom(sessionId: string): Promise<CommandResponse>;
  getContent(sessionId: string, selector: string, attribute: string, multiple: boolean): Promise<CommandResponse>;
  getSubDOM(sessionId: string, selector: string, maxDomSize: number): Promise<CommandResponse>;
}

export interface AIContextManagerInterface {
  addExecutionEvent(workflowSessionId: string, stepIndex: number, command: ExecutorCommand, result: CommandResponse, reasoning?: string, screenshotId?: string): Promise<string>;
  addExecutionEventFromStream(workflowSessionId: string, stepIndex: number, streamEvent: any): Promise<string>;
  updateStepExecution(workflowSessionId: string, stepIndex: number, updates: any): Promise<void>;
  generateContextJson(workflowSessionId: string, targetStep: number): Promise<any>;
  generateFilteredContext(workflowSessionId: string, targetStep: number, options: any): Promise<any>;
  generateInvestigationContext(workflowSessionId: string, stepIndex: number): Promise<any>;
  addInvestigationResult(workflowSessionId: string, stepIndex: number, investigation: InvestigationResult): Promise<string>;
  addPageElementDiscovery(workflowSessionId: string, stepIndex: number, discovery: ElementDiscovery): Promise<void>;
  updateWorkingMemory(workflowSessionId: string, stepIndex: number, memory: WorkingMemoryUpdate): Promise<void>;
  getWorkingMemory(workflowSessionId: string): WorkingMemoryState;
  linkExecutorSession(workflowSessionId: string, executorSessionId: string): Promise<void>;
}

export interface AIPromptManagerInterface {
  generateActionPrompt(request: ActionPromptRequest): Promise<GeneratedPrompt>;
  generateReflectionPrompt(request: ReflectionPromptRequest): Promise<GeneratedPrompt>;
  generateInvestigationPrompt(request: InvestigationPromptRequest): Promise<GeneratedPrompt>;
  generateActionWithInvestigationPrompt(request: ActionWithInvestigationRequest): Promise<GeneratedPrompt>;
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

export interface GeneratedPrompt {
  promptId: string;
  sessionId: string;
  stepIndex: number;
  promptType: string;
  content: string;
  schema: any;
  generatedAt: Date;
  metadata?: Record<string, any>;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_TASK_LOOP_CONFIG: TaskLoopConfig = {
  moduleId: 'task-loop',
  version: '1.0.0',
  enabled: true,
  
  execution: {
    maxIterations: 3,
    enableReflection: true,
    reflectionThreshold: 0.7
  },
  
  ai: {
    connectionId: 'default',
    maxTokens: 4000,
    temperature: 0.1
  },
  
  prompts: {
    actionPromptOptions: {
      includeExecutionHistory: true,
      maxHistorySteps: 5,
      includeDomComparison: true,
      includeElementContext: true,
      validationMode: 'strict',
      reasoningDepth: 'detailed',
      includeExamples: false
    },
    reflectionPromptOptions: {
      includeExecutionHistory: true,
      maxHistorySteps: 3,
      includeDomComparison: true,
      includeElementContext: true,
      validationMode: 'strict',
      reasoningDepth: 'comprehensive',
      includeExamples: false
    },
    cacheEnabled: true,
    cacheTTLMs: 300000 // 5 minutes
  },
  
  streaming: {
    enabled: true,
    publishReasoningUpdates: true,
    publishCommandUpdates: true,
    publishScreenshots: true
  },
  
  investigation: {
    enabled: true,
    maxInvestigationRounds: 3,
    investigationTimeoutMs: 120000, // 2 minutes
    confidenceThreshold: 0.7,
    enabledTools: [
      InvestigationTool.SCREENSHOT_ANALYSIS,
      InvestigationTool.TEXT_EXTRACTION,
      InvestigationTool.SUB_DOM_EXTRACTION,
      InvestigationTool.FULL_DOM_RETRIEVAL
    ],
    toolPriorityOrder: [
      InvestigationTool.SCREENSHOT_ANALYSIS,
      InvestigationTool.TEXT_EXTRACTION,
      InvestigationTool.SUB_DOM_EXTRACTION,
      InvestigationTool.FULL_DOM_RETRIEVAL
    ],
    contextManagementApproach: 'standard',
    enableWorkingMemory: true,
    enableElementKnowledge: true,
    enableProgressiveContext: true,
    maxContextSize: 50000,
    investigationPromptOptions: {
      includeExecutionHistory: true,
      maxHistorySteps: 3,
      includeDomComparison: false,
      includeElementContext: true,
      validationMode: 'lenient',
      reasoningDepth: 'detailed',
      includeExamples: true
    }
  },
  
  contextManagement: {
    enableFilteredContext: true,
    maxHistorySteps: 10,
    excludeFullDom: true,
    includePreviousInvestigations: true,
    summarizationLevel: 'standard',
    workingMemoryEnabled: true,
    elementKnowledgeEnabled: true,
    patternLearningEnabled: true
  },
  
  logging: {
    level: LogLevel.INFO,
    prefix: '[TaskLoop]',
    includeTimestamp: true,
    includeSessionId: true,
    includeModuleId: true,
    structured: false
  },
  
  performance: {
    maxConcurrentOperations: 5,
    cacheEnabled: true,
    cacheTTLMs: 300000,
    metricsEnabled: true
  },
  
  timeouts: {
    workflowTimeoutMs: 1800000, // 30 minutes
    stepTimeoutMs: 300000, // 5 minutes
    requestTimeoutMs: 30000, // 30 seconds
    connectionTimeoutMs: 10000, // 10 seconds
    defaultOperationTimeoutMs: 30000,
    maxRetryAttempts: 3,
    retryDelayMs: 1000,
    exponentialBackoff: true
  }
};
