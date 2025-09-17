# AI Context Manager Module Design Document

## Overview
The AI Context Manager module manages the execution context and reasoning history for AI-driven automation sessions. It tracks step definitions, execution events, reasoning processes, and page states to provide comprehensive context for AI decision-making and debugging.

## Core Responsibilities
- Manage session-based execution context
- Store and organize step definitions for automation workflows
- Track step execution events with temporal ordering
- Capture reasoning, executor methods, and page DOM states
- Generate contextual JSON for AI analysis and debugging
- Provide historical context retrieval for decision-making

## Module Interface

### Session Context Management (STANDARDIZED)
```typescript
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
  ModuleSessionConfig
} from './shared-types';

// AI Context Module implements standardized session management
interface AIContextSession extends ModuleSessionInfo {
  moduleId: 'ai-context-manager';
  steps: string[];
  stepExecutions: StepExecution[];
  executorSessionId: string;      // Link to executor browser session
  // Inherits: sessionId, linkedWorkflowSessionId, status, createdAt, lastActivity, metadata
}

interface StepExecution {
  stepIndex: number;
  stepName: string;
  events: ExecutionEvent[];
  startTime: Date;
  endTime?: Date;
  status: SessionStatus;          // FIXED: Uses shared enum
}

interface ExecutionEvent {
  eventId: string;
  timestamp: Date;
  reasoning: string;
  executorMethod: string;
  executorCommand?: ExecutorCommand;     // FIXED: Full command context
  commandResult?: CommandResponse;       // FIXED: Full result context
  pageDom: string;
  screenshotId?: string;
  metadata?: Record<string, any>;
}
```

### Core Interface (STANDARDIZED: Implements ISessionManager)
```typescript
interface IAIContextManager extends ISessionManager {
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
```

## Data Structures (FIXED: Uses Shared Types)

### Status Management (FIXED: Uses Shared SessionStatus)
```typescript
// Import and use shared SessionStatus for all status tracking
import { SessionStatus } from './shared-types';

// All status fields use SessionStatus from shared types
// SessionStatus includes: INITIALIZING, ACTIVE, PAUSED, COMPLETED, FAILED, CANCELLED, CLEANUP
```

### Context JSON Output
```typescript
interface AIContextJson {
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

interface ExecutionFlowItem {
  stepIndex: number;
  stepName: string;
  reasoning: string;
  executorMethod: string;
  timestamp: Date;
  status: SessionStatus;
  screenshotId?: string;
}

// Page Investigation Data Structures
interface InvestigationResult {
  investigationId: string;
  investigationType: InvestigationType;
  timestamp: Date;
  input: InvestigationInput;
  output: InvestigationOutput;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

enum InvestigationType {
  SCREENSHOT_ANALYSIS = 'SCREENSHOT_ANALYSIS',
  TEXT_EXTRACTION = 'TEXT_EXTRACTION', 
  FULL_DOM_RETRIEVAL = 'FULL_DOM_RETRIEVAL',
  SUB_DOM_EXTRACTION = 'SUB_DOM_EXTRACTION'
}

interface InvestigationInput {
  selector?: string;          // For text/DOM extraction
  screenshotId?: string;      // For screenshot analysis
  parameters?: Record<string, any>;
}

interface InvestigationOutput {
  textContent?: string;       // For text extraction
  domContent?: string;        // For DOM retrieval (excluded from context)
  visualDescription?: string; // For screenshot analysis
  elementCount?: number;      // For DOM queries
  summary?: string;           // High-level summary for context
}

interface ElementDiscovery {
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

// Context Filtering and Summarization
interface FilteredContextJson {
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

interface InvestigationContextJson {
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

interface SuggestedInvestigation {
  type: InvestigationType;
  purpose: string;
  parameters?: Record<string, any>;
  priority: number;
  reasoning: string;
}

interface InvestigationPriority {
  primary: InvestigationType;
  fallbacks: InvestigationType[];
  reasoning: string;
}

// Working Memory Management
interface WorkingMemoryState {
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

interface WorkingMemoryUpdate {
  updateType: 'element_discovery' | 'page_insight' | 'variable_extraction' | 'pattern_learning' | 'investigation_preference';
  data: any;
  confidence: number;
  source: string;
}

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
  preferredOrder: InvestigationType[];
  qualityThresholds: Record<InvestigationType, number>;
  fallbackStrategies: Record<InvestigationType, InvestigationType[]>;
}

// Context Filtering Options
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

interface StepContextSummary {
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

interface InvestigationStrategy {
  currentPhase: 'initial_assessment' | 'focused_exploration' | 'selector_determination';
  recommendedInvestigations: SuggestedInvestigation[];
  investigationPriority: InvestigationPriority;
  contextManagementApproach: 'minimal' | 'standard' | 'comprehensive';
  confidenceThreshold: number;
  maxInvestigationRounds: number;
}
```

## Core Functionality

### 1. Session Initialization
```typescript
async createSession(sessionId: string): Promise<void>
```
- Create new context session with unique ID
- Initialize empty steps array and execution history
- Set creation timestamp
- Validate session ID uniqueness

### 2. Step Definition Management
```typescript
async setSteps(sessionId: string, steps: string[]): Promise<void>
```
- Store ordered list of step descriptions
- Clear any existing step definitions
- Initialize step execution tracking structure
- Validate step format and content

### 3. Step Execution Tracking
```typescript
async addStepExecution(sessionId: string, stepExecution: StepExecution): Promise<void>
```
- Add new step execution record
- Ensure temporal ordering of events
- Link to corresponding step definition
- Update session metadata

### 4. Event Logging
```typescript
async addExecutionEvent(sessionId: string, stepIndex: number, command: ExecutorCommand, result: CommandResponse, reasoning?: string, screenshotId?: string): Promise<string>
```
- Add execution event to specific step
- Maintain chronological order
- Store reasoning, executor method, page DOM, and screenshot ID
- Generate unique event IDs
- Link screenshots to execution events for visual context

### 5. Context Generation
```typescript
async generateContextJson(sessionId: string, targetStep: number): Promise<AIContextJson>
```
The core method that produces AI-consumable context:

#### Process Flow:
1. **Validate Input**: Check session exists and target step is valid
2. **Collect Execution Flow**: Gather all reasoning and executor methods from start to target step
3. **Extract Page DOM States**:
   - Get DOM from step (targetStep - 1) if available
   - Get DOM from targetStep if available
4. **Generate Summary**: Calculate completion statistics
5. **Format Output**: Structure data for AI consumption

#### Data Aggregation Rules:
- **Execution Flow**: Include all events from step 0 to targetStep with screenshot IDs
- **Previous DOM**: Last DOM from step (targetStep - 1)
- **Current DOM**: Last DOM from targetStep
- **Chronological Order**: Maintain temporal sequence of all events
- **Screenshot References**: Include screenshot IDs for visual context linkage

### 6. Page Investigation Support

#### Investigation Result Management
```typescript
async addInvestigationResult(sessionId: string, stepIndex: number, investigation: InvestigationResult): Promise<string>
```
- Store results from AI page investigation tools
- Track investigation type, input parameters, and output
- Maintain investigation history for learning and optimization
- Link investigations to specific steps and execution events

#### Element Discovery Tracking
```typescript
async addPageElementDiscovery(sessionId: string, stepIndex: number, discovery: ElementDiscovery): Promise<void>
```
- Record discovered page elements and their properties
- Track discovery method, reliability, and confidence scores
- Build knowledge base of element selectors and interactions
- Support progressive element understanding across investigations

### 7. Context Filtering and Summarization

#### Filtered Context Generation
```typescript
async generateFilteredContext(sessionId: string, targetStep: number, options: ContextFilterOptions): Promise<FilteredContextJson>
```
The core method that implements context overflow prevention:

**Context Filtering Strategy:**
1. **Exclude Full DOM Content**: Removes large DOM strings from context
2. **High-Level Execution Summary**: Provides step outcomes without full details
3. **Page Insights**: Summarizes page understanding without raw content
4. **Element Knowledge**: Tracks selector discoveries and reliability
5. **Working Memory**: Maintains current page understanding state

**Filtering Process:**
1. Extract high-level execution outcomes and reasoning
2. Summarize page investigations without including full DOM/content
3. Preserve element selector knowledge and discovery history
4. Include only screenshot IDs and visual descriptions
5. Maintain working memory of page understanding patterns

#### Context Summarization
```typescript
async addContextSummary(sessionId: string, stepIndex: number, summary: StepContextSummary): Promise<void>
```
- Create compact summaries of step execution and findings
- Exclude full page content while preserving key insights
- Track elements discovered, variables extracted, and patterns learned
- Maintain confidence and reliability metrics for context quality

### 8. Working Memory Management

#### Working Memory Updates
```typescript
async updateWorkingMemory(sessionId: string, stepIndex: number, memory: WorkingMemoryUpdate): Promise<void>
```
- Maintain AI's understanding of current page state
- Track known elements, navigation patterns, and variables
- Learn from successful and failed interaction patterns
- Update investigation preferences based on experience

**Working Memory Components:**
- **Page Insight**: Current understanding of page structure and purpose
- **Element Knowledge**: Map of discovered elements and their reliability
- **Navigation Patterns**: Understanding of site flow and structure
- **Variable Context**: Extracted data and its sources
- **Pattern Learning**: Successful and failed interaction strategies
- **Investigation Preferences**: Optimized investigation approaches

#### Memory State Retrieval
```typescript
getWorkingMemory(sessionId: string): WorkingMemoryState
```
- Provide current AI understanding state
- Include element knowledge and navigation patterns
- Support decision-making with learned preferences
- Enable context-aware investigation strategy selection

### 9. Investigation Context Generation

#### Investigation-Specific Context
```typescript
async generateInvestigationContext(sessionId: string, stepIndex: number): Promise<InvestigationContextJson>
```
Specialized context generation for investigation cycles:

**Investigation Context Features:**
- Current investigation results and their outcomes
- Elements discovered in this step with confidence scores
- Page insight summary without full content
- Working memory state for informed decisions
- Suggested next investigations based on current knowledge
- Investigation priority recommendations

**Context Management Strategy:**
1. **Progressive Building**: Each investigation builds upon previous knowledge
2. **Selective Inclusion**: Include only investigation summaries, not raw data
3. **Confidence Tracking**: Maintain reliability scores for discovered elements
4. **Strategy Optimization**: Learn optimal investigation patterns for similar pages

## Implementation Structure

### Module Organization
```
/src/modules/ai-context-manager/
  ├── index.ts                    # Main module interface
  ├── context-session-manager.ts  # Session lifecycle management
  ├── step-manager.ts             # Step definition handling
  ├── execution-tracker.ts        # Step execution and event tracking
  ├── context-generator.ts        # Context JSON generation logic
  ├── investigation-manager.ts    # Page investigation result tracking
  ├── element-discovery.ts        # Element discovery and knowledge management
  ├── context-filter.ts           # Context filtering and summarization
  ├── working-memory.ts           # AI working memory management
  ├── investigation-context.ts    # Investigation-specific context generation
  ├── storage-adapter.ts          # Data persistence abstraction
  └── types.ts                    # TypeScript type definitions
```

### Storage Strategy
```typescript
interface IContextStorageAdapter {
  saveSession(session: AIContextSession): Promise<void>;
  loadSession(sessionId: string): Promise<AIContextSession | null>;
  deleteSession(sessionId: string): Promise<void>;
  listSessions(): Promise<string[]>;
}
```

Support multiple storage backends:
- **Memory**: Fast access for development and testing
- **File System**: JSON files for simple persistence
- **Database**: SQL/NoSQL for production environments

## Integration with Executor Module

### Event Capture Integration
```typescript
// Executor calls context manager after each command
interface ExecutorIntegration {
  onCommandExecuted(sessionId: string, stepIndex: number, event: {
    reasoning: string;
    executorMethod: string;
    pageDom: string;
    timestamp: Date;
    screenshotId?: string;
  }): Promise<void>;
}
```

### Data Flow

#### Traditional Execution Flow
1. **AI Engine** sets steps via `setSteps()`
2. **Executor Module** performs automation commands
3. **Context Manager** captures events via `addExecutionEvent()`
4. **AI Engine** requests context via `generateContextJson()`
5. **AI Engine** makes decisions based on historical context

#### Investigation-Enhanced Flow
1. **Task Loop** initiates step with high-level description
2. **Task Loop** requests investigation context via `generateInvestigationContext()`
3. **Task Loop** performs investigation cycle:
   - Screenshot analysis → `addInvestigationResult()`
   - Text extraction → `addInvestigationResult()`
   - DOM retrieval → `addInvestigationResult()` (content filtered)
   - Element discovery → `addPageElementDiscovery()`
4. **Task Loop** updates working memory via `updateWorkingMemory()`
5. **Task Loop** requests filtered context via `generateFilteredContext()`
6. **Task Loop** determines optimal selector and executes action
7. **Context Manager** captures execution via `addExecutionEvent()`
8. **Context Manager** creates step summary via `addContextSummary()`

#### Context Management Benefits
- **No Context Overflow**: Full DOM/page content excluded from AI context
- **Progressive Learning**: Working memory builds understanding over time
- **Intelligent Investigation**: AI learns optimal investigation patterns
- **Element Knowledge**: Reliable selector discovery and validation
- **Pattern Recognition**: Success/failure patterns improve future decisions

## Advanced Features

### Context Querying
```typescript
interface ContextQuery {
  sessionId: string;
  stepRange?: [number, number];
  eventTypes?: string[];
  timeRange?: [Date, Date];
  includePageDom?: boolean;
}

interface IAdvancedQuerying {
  queryContext(query: ContextQuery): Promise<any>;
  searchReasonings(sessionId: string, searchTerm: string): Promise<ExecutionEvent[]>;
  getExecutionMetrics(sessionId: string): Promise<ExecutionMetrics>;
}
```

### Context Compression
For large sessions with extensive DOM data:
```typescript
interface ContextCompressionOptions {
  compressDom: boolean;
  maxDomSize: number;
  excludeRepeatedDom: boolean;
  summarizeReasonings: boolean;
}
```

### Export/Import
```typescript
interface IContextPortability {
  exportSession(sessionId: string, format: 'json' | 'xml' | 'yaml'): Promise<string>;
  importSession(data: string, format: 'json' | 'xml' | 'yaml'): Promise<string>;
  cloneSession(sourceSessionId: string, targetSessionId: string): Promise<void>;
}
```

## Performance Considerations

### Memory Management
- Implement DOM data compression for large pages
- Provide configurable retention policies
- Support pagination for large execution histories
- Lazy loading of historical data

### Scalability
- Support for concurrent session access
- Efficient indexing for temporal queries
- Batch operations for bulk data insertion
- Configurable storage backends

## Error Handling (FIXED: Uses Standardized Error Framework)

### Error Types (FIXED: Uses StandardError from shared types)
```typescript
// Import standardized error handling
import { 
  StandardError, 
  ErrorCategory, 
  ErrorSeverity, 
  ERROR_CODES 
} from './shared-types';

// Context Manager specific errors use shared framework
class ContextManagerErrorHandler {
  createStandardError(code: string, message: string, details?: Record<string, any>): StandardError {
    return {
      id: crypto.randomUUID(),
      category: this.categorizeError(code),
      severity: this.determineSeverity(code),
      code: ERROR_CODES.CONTEXT_MANAGER[code] || code,
      message,
      details,
      timestamp: new Date(),
      moduleId: 'ai-context-manager',
      recoverable: this.isRecoverable(code),
      retryable: this.isRetryable(code),
      suggestedAction: this.getSuggestedAction(code)
    };
  }
}
```

### Error Categories (FIXED: Uses Shared Categories)
- **VALIDATION**: Invalid session IDs, malformed step definitions, invalid step indices
- **EXECUTION**: Corrupted execution data, context generation failures
- **SYSTEM**: Persistence failures, storage capacity limits, data corruption
- **INTEGRATION**: Concurrent access conflicts, external service failures

### Recovery Mechanisms (FIXED: Standardized)
- Automatic session recovery using StandardError.retryable flag
- Data integrity checks with detailed error context
- Backup and restore capabilities with error tracking
- Graceful degradation strategies based on ErrorSeverity

## Configuration

### Context Manager Configuration (FIXED: Extends BaseModuleConfig)
```typescript
// Import shared configuration pattern
import { BaseModuleConfig } from './shared-types';

interface AIContextConfig extends BaseModuleConfig {
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
}

// Default configuration
const DEFAULT_AI_CONTEXT_CONFIG: AIContextConfig = {
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
  }
}
```

## Testing Requirements
- Unit tests for all core functionality
- Integration tests with executor module
- Performance tests for large session data
- Memory leak detection tests
- Concurrent access safety tests
- Data integrity validation tests

## Security Considerations
- Session ID validation and sanitization
- Access control for session data
- Secure storage of sensitive execution data
- Audit logging for context access
- Data encryption for persistent storage

## Future Enhancements

### Core Context Management
- Real-time context streaming for live monitoring
- AI-powered execution pattern analysis
- Automated context summarization
- Visual execution flow diagrams
- Context-based debugging tools
- Machine learning insights from execution patterns

### Investigation and Learning Enhancements
- **Advanced Pattern Recognition**: Machine learning models to identify optimal investigation sequences
- **Cross-Session Learning**: Share element knowledge and patterns across different automation sessions
- **Intelligent Summarization**: AI-powered content summarization to further reduce context size
- **Visual Element Mapping**: Computer vision integration for visual element identification and tracking
- **Adaptive Investigation**: Dynamic adjustment of investigation strategies based on page complexity
- **Semantic Understanding**: Natural language processing for better page content understanding

### Working Memory Evolution
- **Persistent Knowledge Base**: Long-term storage of element knowledge across sessions
- **Site-Specific Patterns**: Learn navigation and interaction patterns for specific websites
- **Predictive Investigation**: Predict optimal investigation approaches before starting
- **Context Quality Metrics**: Automatic assessment and optimization of context quality
- **Memory Compression**: Advanced compression techniques for large working memory states
- **Collaborative Learning**: Share learning across multiple AI automation instances

### Context Optimization
- **Dynamic Context Sizing**: Automatically adjust context size based on AI model capabilities
- **Smart Content Filtering**: AI-powered filtering to identify most relevant context elements
- **Context Caching**: Intelligent caching of frequently accessed context patterns
- **Multi-Modal Context**: Integration of visual, textual, and structural context types
- **Context Versioning**: Track context evolution and rollback capabilities
- **Performance Analytics**: Detailed analysis of context generation and filtering performance
