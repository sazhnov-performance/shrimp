// AI Context Manager Types
// Import standardized session management types
import { 
  WorkflowSession, 
  SessionStatus,
  ExecutorCommand,
  CommandResponse,
  StandardError,
  StreamEvent,
  ISessionManager,
  ModuleSessionInfo,
  SessionLifecycleCallbacks,
  ModuleSessionConfig,
  SessionManagerHealth,
  BaseModuleConfig,
  LoggingConfig,
  PerformanceConfig,
  TimeoutConfig,
  LogLevel
} from '../../../types/shared-types';

// AI Context Module Session Management
export interface AIContextSession extends ModuleSessionInfo {
  moduleId: 'ai-context-manager';
  steps: string[];
  stepExecutions: StepExecution[];
  executorSessionId: string;      // Link to executor browser session
  // Inherits: sessionId, linkedWorkflowSessionId, status, createdAt, lastActivity, metadata
}

export interface StepExecution {
  stepIndex: number;
  stepName: string;
  events: ExecutionEvent[];
  startTime: Date;
  endTime?: Date;
  status: SessionStatus;          // Uses shared enum
}

export interface ExecutionEvent {
  eventId: string;
  timestamp: Date;
  reasoning: string;
  executorMethod: string;
  executorCommand?: ExecutorCommand;     // Full command context
  commandResult?: CommandResponse;       // Full result context
  pageDom: string;
  screenshotId?: string;
  metadata?: Record<string, any>;
}

// Core Interface (Implements ISessionManager)
export interface IAIContextManager extends ISessionManager {
  readonly moduleId: 'ai-context-manager';
  
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
  
  // AI Context Specific Methods (use workflowSessionId consistently)
  linkExecutorSession(workflowSessionId: string, executorSessionId: string): Promise<void>;
  
  // Step Management
  setSteps(workflowSessionId: string, steps: string[]): Promise<void>;
  getSteps(workflowSessionId: string): string[] | null;
  
  // Step Execution Tracking
  addStepExecution(workflowSessionId: string, stepExecution: StepExecution): Promise<void>;
  updateStepExecution(workflowSessionId: string, stepIndex: number, updates: Partial<StepExecution>): Promise<void>;
  getStepExecution(workflowSessionId: string, stepIndex: number): StepExecution | null;
  
  // Event Management (uses workflowSessionId consistently)
  addExecutionEvent(workflowSessionId: string, stepIndex: number, command: ExecutorCommand, result: CommandResponse, reasoning?: string, screenshotId?: string): Promise<string>;
  addExecutionEventFromStream(workflowSessionId: string, stepIndex: number, streamEvent: StreamEvent): Promise<string>;
  getExecutionEvents(workflowSessionId: string, stepIndex: number): ExecutionEvent[];
  
  // Context Generation
  generateContextJson(workflowSessionId: string, targetStep: number): Promise<AIContextJson>;
  generateInvestigationContext(workflowSessionId: string, stepIndex: number): Promise<InvestigationContextJson>;
  
  // Page Investigation Support
  addInvestigationResult(workflowSessionId: string, stepIndex: number, investigation: InvestigationResult): Promise<string>;
  getInvestigationHistory(workflowSessionId: string, stepIndex: number): InvestigationResult[];
  addPageElementDiscovery(workflowSessionId: string, stepIndex: number, discovery: ElementDiscovery): Promise<void>;
  getPageElementsDiscovered(workflowSessionId: string, stepIndex: number): ElementDiscovery[];
  
  // Context Filtering and Summarization
  generateFilteredContext(workflowSessionId: string, targetStep: number, options: ContextFilterOptions): Promise<FilteredContextJson>;
  addContextSummary(workflowSessionId: string, stepIndex: number, summary: StepContextSummary): Promise<void>;
  getContextSummaries(workflowSessionId: string, stepRange?: [number, number]): StepContextSummary[];
  
  // Working Memory Management
  updateWorkingMemory(workflowSessionId: string, stepIndex: number, memory: WorkingMemoryUpdate): Promise<void>;
  getWorkingMemory(workflowSessionId: string): WorkingMemoryState;
  clearWorkingMemory(workflowSessionId: string): Promise<void>;
  
  // Query Methods
  getSessionContext(workflowSessionId: string): AIContextSession | null;
  getExecutionHistory(workflowSessionId: string): StepExecution[];
}

// Context JSON Output
export interface AIContextJson {
  sessionId: string;
  targetStep: number;
  generatedAt: Date;
  
  // Historical data from start to target step
  executionFlow: ExecutionFlowItem[];
  
  // Page DOM states
  previousPageDom?: string;  // DOM from step (targetStep - 1)
  currentPageDom?: string;   // DOM from targetStep
  
  // Summary information
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
}

export interface ExecutionFlowItem {
  stepIndex: number;
  stepName: string;
  reasoning: string;
  executorMethod: string;
  timestamp: Date;
  status: SessionStatus;
  screenshotId?: string;
}

// Page Investigation Data Structures
export interface InvestigationResult {
  investigationId: string;
  investigationType: InvestigationType;
  timestamp: Date;
  input: InvestigationInput;
  output: InvestigationOutput;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

export enum InvestigationType {
  SCREENSHOT_ANALYSIS = 'SCREENSHOT_ANALYSIS',
  TEXT_EXTRACTION = 'TEXT_EXTRACTION', 
  FULL_DOM_RETRIEVAL = 'FULL_DOM_RETRIEVAL',
  SUB_DOM_EXTRACTION = 'SUB_DOM_EXTRACTION'
}

export interface InvestigationInput {
  selector?: string;          // For text/DOM extraction
  screenshotId?: string;      // For screenshot analysis
  parameters?: Record<string, any>;
}

export interface InvestigationOutput {
  textContent?: string;       // For text extraction
  domContent?: string;        // For DOM retrieval (excluded from context)
  visualDescription?: string; // For screenshot analysis
  elementCount?: number;      // For DOM queries
  summary?: string;           // High-level summary for context
}

export interface ElementDiscovery {
  discoveryId: string;
  timestamp: Date;
  selector: string;
  elementType: string;
  properties: ElementProperties;
  confidence: number;
  discoveryMethod: InvestigationType;
  isReliable: boolean;
  metadata?: Record<string, any>;
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

// Context Filtering and Summarization
export interface FilteredContextJson {
  sessionId: string;
  targetStep: number;
  generatedAt: Date;
  
  // High-level execution flow (no full DOM content)
  executionSummary: ExecutionSummaryItem[];
  
  // Page understanding without full content
  pageInsights: PageInsight[];
  
  // Element discoveries and selector knowledge
  elementKnowledge: ElementKnowledge[];
  
  // Working memory state
  workingMemory: WorkingMemoryState;
  
  // Investigation strategy context
  investigationStrategy: InvestigationStrategy;
}

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

export interface InvestigationContextJson {
  sessionId: string;
  stepIndex: number;
  generatedAt: Date;
  
  // Current investigation cycle context
  currentInvestigations: InvestigationResult[];
  elementsDiscovered: ElementDiscovery[];
  pageInsight: PageInsight;
  workingMemory: WorkingMemoryState;
  
  // Investigation strategy and next steps
  suggestedInvestigations: SuggestedInvestigation[];
  investigationPriority: InvestigationPriority;
}

export interface SuggestedInvestigation {
  type: InvestigationType;
  purpose: string;
  parameters?: Record<string, any>;
  priority: number;
  reasoning: string;
}

export interface InvestigationPriority {
  primary: InvestigationType;
  fallbacks: InvestigationType[];
  reasoning: string;
}

// Working Memory Management
export interface WorkingMemoryState {
  sessionId: string;
  lastUpdated: Date;
  
  // Current page understanding
  currentPageInsight?: PageInsight;
  
  // Known elements and their properties
  knownElements: Map<string, ElementKnowledge>;
  
  // Navigation and flow understanding
  navigationPattern?: NavigationPattern;
  
  // Variable and data context
  extractedVariables: Map<string, VariableContext>;
  
  // Strategy and learning
  successfulPatterns: SuccessPattern[];
  failurePatterns: FailurePattern[];
  
  // Investigation preferences
  investigationPreferences: InvestigationPreferences;
}

export interface WorkingMemoryUpdate {
  updateType: 'element_discovery' | 'page_insight' | 'variable_extraction' | 'pattern_learning' | 'investigation_preference';
  data: any;
  confidence: number;
  source: string;
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
  preferredOrder: InvestigationType[];
  qualityThresholds: Record<InvestigationType, number>;
  fallbackStrategies: Record<InvestigationType, InvestigationType[]>;
}

// Context Filtering Options
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

export interface StepContextSummary {
  stepIndex: number;
  stepName: string;
  timestamp: Date;
  
  // High-level summary without full content
  actionSummary: string;
  outcomeSummary: string;
  keyFindings: string[];
  elementsDiscovered: string[];
  variablesExtracted: string[];
  
  // Investigation summary
  investigationsSummary: string;
  pageInsightSummary: string;
  
  // Learning and patterns
  patternsLearned?: string[];
  strategiesUsed?: string[];
  
  // Confidence and reliability
  overallConfidence: number;
  reliability: number;
}

export interface InvestigationStrategy {
  currentPhase: 'initial_assessment' | 'focused_exploration' | 'selector_determination';
  recommendedInvestigations: SuggestedInvestigation[];
  investigationPriority: InvestigationPriority;
  contextManagementApproach: 'minimal' | 'standard' | 'comprehensive';
  confidenceThreshold: number;
  maxInvestigationRounds: number;
}

// Storage Adapter Interface
export interface IContextStorageAdapter {
  saveSession(session: AIContextSession): Promise<void>;
  loadSession(sessionId: string): Promise<AIContextSession | null>;
  deleteSession(sessionId: string): Promise<void>;
  listSessions(): Promise<string[]>;
  
  // Investigation and memory storage
  saveInvestigationResult(sessionId: string, stepIndex: number, result: InvestigationResult): Promise<void>;
  loadInvestigationResults(sessionId: string, stepIndex: number): Promise<InvestigationResult[]>;
  saveElementDiscovery(sessionId: string, stepIndex: number, discovery: ElementDiscovery): Promise<void>;
  loadElementDiscoveries(sessionId: string, stepIndex: number): Promise<ElementDiscovery[]>;
  saveWorkingMemory(sessionId: string, memory: WorkingMemoryState): Promise<void>;
  loadWorkingMemory(sessionId: string): Promise<WorkingMemoryState | null>;
  saveContextSummary(sessionId: string, summary: StepContextSummary): Promise<void>;
  loadContextSummaries(sessionId: string, stepRange?: [number, number]): Promise<StepContextSummary[]>;
}

// Configuration
export interface AIContextConfig extends BaseModuleConfig {
  moduleId: 'ai-context-manager';
  
  // AI Context Manager specific configuration
  storage: {
    adapter: 'memory' | 'filesystem' | 'database';
    maxSessionsInMemory: number;
    sessionTTL: number; // Time-to-live in milliseconds
    maxStepsPerSession: number;
    maxEventsPerStep: number;
  };
  compression: {
    enabled: boolean;
    threshold: number; // DOM size in bytes
  };
  export: {
    formats: string[];
  };
  
  // Page Investigation Configuration
  investigation: {
    maxInvestigationsPerStep: number;
    enableWorkingMemory: boolean;
    workingMemoryTTL: number; // Time-to-live for working memory
    enableElementKnowledge: boolean;
    maxElementKnowledgeEntries: number;
    enablePatternLearning: boolean;
    patternLearningThreshold: number; // Minimum occurrences to form pattern
  };
  
  // Context Filtering Configuration
  contextFiltering: {
    enableAutoFiltering: boolean;
    maxContextSize: number; // Maximum context size in characters
    defaultFilteringLevel: 'minimal' | 'standard' | 'detailed';
    excludeFullDomByDefault: boolean;
    includeWorkingMemoryByDefault: boolean;
    confidenceThreshold: number; // Minimum confidence for inclusion
    summarizationQuality: 'fast' | 'balanced' | 'comprehensive';
  };
  
  // Working Memory Configuration
  workingMemory: {
    enabled: boolean;
    maxKnownElements: number;
    maxNavigationPatterns: number;
    maxSuccessPatterns: number;
    maxFailurePatterns: number;
    reliabilityThreshold: number; // Minimum reliability to keep element
    learningRate: number; // How quickly patterns are learned/forgotten
    memoryCleanupInterval: number; // Cleanup interval in milliseconds
  };
  
  // Inherits from BaseModuleConfig:
  // - logging: LoggingConfig
  // - performance: PerformanceConfig
  // - timeouts: TimeoutConfig
}

// Default configuration
export const DEFAULT_AI_CONTEXT_CONFIG: AIContextConfig = {
  moduleId: 'ai-context-manager',
  version: '1.0.0',
  enabled: true,
  
  storage: {
    adapter: 'memory',
    maxSessionsInMemory: 100,
    sessionTTL: 1800000, // 30 minutes
    maxStepsPerSession: 1000,
    maxEventsPerStep: 100
  },
  
  compression: {
    enabled: true,
    threshold: 100000 // 100KB DOM threshold
  },
  
  export: {
    formats: ['json', 'csv', 'xml']
  },
  
  investigation: {
    maxInvestigationsPerStep: 10,
    enableWorkingMemory: true,
    workingMemoryTTL: 3600000, // 1 hour
    enableElementKnowledge: true,
    maxElementKnowledgeEntries: 1000,
    enablePatternLearning: true,
    patternLearningThreshold: 3 // Minimum 3 occurrences
  },
  
  contextFiltering: {
    enableAutoFiltering: true,
    maxContextSize: 50000, // 50K characters
    defaultFilteringLevel: 'standard',
    excludeFullDomByDefault: true,
    includeWorkingMemoryByDefault: true,
    confidenceThreshold: 0.6,
    summarizationQuality: 'balanced'
  },
  
  workingMemory: {
    enabled: true,
    maxKnownElements: 500,
    maxNavigationPatterns: 50,
    maxSuccessPatterns: 100,
    maxFailurePatterns: 100,
    reliabilityThreshold: 0.7,
    learningRate: 0.1,
    memoryCleanupInterval: 300000 // 5 minutes
  },
  
  logging: {
    level: LogLevel.INFO,
    prefix: '[AIContext]',
    includeTimestamp: true,
    includeSessionId: true,
    includeModuleId: true,
    structured: false
  },
  
  performance: {
    maxConcurrentOperations: 50,
    cacheEnabled: true,
    cacheTTLMs: 300000, // 5 minutes
    metricsEnabled: true
  },
  
  timeouts: {
    workflowTimeoutMs: 1800000,      // 30 minutes
    stepTimeoutMs: 300000,           // 5 minutes  
    requestTimeoutMs: 30000,         // 30 seconds
    connectionTimeoutMs: 10000,      // 10 seconds
    defaultOperationTimeoutMs: 30000,
    maxRetryAttempts: 3,
    retryDelayMs: 1000,
    exponentialBackoff: true
  }
};

// Internal data structures for session management
export interface SessionData {
  session: AIContextSession;
  investigations: Map<number, InvestigationResult[]>; // stepIndex -> investigations
  elementDiscoveries: Map<number, ElementDiscovery[]>; // stepIndex -> discoveries  
  workingMemory?: WorkingMemoryState;
  contextSummaries: Map<number, StepContextSummary>; // stepIndex -> summary
}

// Error types specific to AI Context Manager
export interface ContextManagerError extends StandardError {
  moduleId: 'ai-context-manager';
  sessionId?: string;
  stepIndex?: number;
}

// Context query types for advanced features
export interface ContextQuery {
  sessionId: string;
  stepRange?: [number, number];
  eventTypes?: string[];
  timeRange?: [Date, Date];
  includePageDom?: boolean;
}

export interface ExecutionMetrics {
  sessionId: string;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  averageStepDuration: number;
  totalEvents: number;
  domSizeStats: {
    min: number;
    max: number;
    average: number;
  };
  investigationStats: {
    totalInvestigations: number;
    byType: Record<InvestigationType, number>;
    successRate: number;
  };
}

// Context compression options
export interface ContextCompressionOptions {
  compressDom: boolean;
  maxDomSize: number;
  excludeRepeatedDom: boolean;
  summarizeReasonings: boolean;
}
