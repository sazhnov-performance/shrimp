# Task Loop Module Design Document

## Overview
The Task Loop module implements the core ACT-REFLECT cycle for AI-driven web automation with sophisticated page investigation capabilities. It orchestrates the interaction between AI reasoning, prompt generation, page investigation tools, executor commands, and context management to perform intelligent web automation with continuous learning and adaptation while preventing context overflow.

## Core Responsibilities
- Implement ACT-REFLECT cycle with integrated page investigation phases
- Orchestrate page investigation cycles (Initial Assessment → Focused Exploration → Selector Determination)
- Generate context-aware AI prompts for both action and investigation phases
- Process AI responses and extract actionable commands (supports multiple commands)
- Execute investigation tools (screenshot analysis, text extraction, DOM retrieval, sub-DOM extraction)
- Execute web automation commands through the Executor module with session ID injection
- Manage progressive context building and working memory integration
- Store execution results, investigation findings, and AI reasoning in Context Manager
- Implement context overflow prevention through filtered context integration
- Publish real-time updates to Executor Streamer
- Handle error recovery and retry mechanisms for both action and investigation phases
- Maintain execution state, investigation state, and decision history
- Coordinate session management with Step Processor

## Module Interface

### Primary Interface (STANDARDIZED: Implements ISessionManager)
```typescript
// Import standardized session management types
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
  InvestigationPhase,
  InvestigationTool,
  ElementDiscovery,
  PageInsight
} from './shared-types';

interface ITaskLoop extends ISessionManager {
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
  
  // Investigation Processing (NEW)
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
```

### Core Data Structures (Updated)
All core data structures now use shared types:
- `TaskLoopStepRequest` - From shared types (replaces old StepProcessingRequest)
- `StepResult` - Shared type (FIXED: was missing, now defined)
- `ProcessingOptions` - From shared ProcessingConfig
- `ExecutionState` - Enhanced with shared error types and investigation state
- `AIResponse` - FIXED: Now supports multiple commands array
- `ExecutorCommand` - Shared type with session ID included

### Investigation Data Structures (NEW)
Investigation-specific data structures for page exploration:
- `InvestigationPhaseRequest` - Request to process an investigation phase
- `InvestigationPhaseResult` - Result of investigation phase processing
- `InvestigationToolRequest` - Request to execute specific investigation tool
- `InvestigationToolResult` - Result of investigation tool execution
- `InvestigationState` - State tracking for investigation cycles
- `PageInvestigationContext` - Context for current page investigation

### Processing Options
Processing options are now defined in `shared-types.md` as `ProcessingOptions` interface.
- Supports maxIterations for ACT-REFLECT cycles
- Configurable reflection, validation, timeouts, and retry behavior
- All options inherit from the shared ProcessingOptions interface

### Execution State (Enhanced with Investigation)
```typescript
interface ExecutionState {
  phase: ExecutionPhase;
  currentIteration: number;
  maxIterations: number;
  lastCommands?: ExecutorCommand[]; // FIXED: Array of commands
  aiResponse?: AIResponse;          // FIXED: Full AI response
  reflectionData?: ReflectionData;
  investigationState?: InvestigationState; // NEW: Investigation state
  error?: StandardError;            // FIXED: Standardized error
}

enum ExecutionPhase {
  INITIALIZING = 'INITIALIZING',
  GENERATING_PROMPT = 'GENERATING_PROMPT',
  QUERYING_AI = 'QUERYING_AI',
  PROCESSING_RESPONSE = 'PROCESSING_RESPONSE',
  // NEW: Investigation phases
  INVESTIGATING = 'INVESTIGATING',
  INITIAL_ASSESSMENT = 'INITIAL_ASSESSMENT',
  FOCUSED_EXPLORATION = 'FOCUSED_EXPLORATION',
  SELECTOR_DETERMINATION = 'SELECTOR_DETERMINATION',
  BUILDING_CONTEXT = 'BUILDING_CONTEXT',
  // Existing phases
  EXECUTING_COMMANDS = 'EXECUTING_COMMANDS',  // FIXED: plural
  REFLECTING = 'REFLECTING',
  VALIDATING = 'VALIDATING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

### Investigation State and Interfaces (NEW)
```typescript
interface InvestigationState {
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

// Investigation types are defined in shared-types.md to prevent duplication
// enum InvestigationPhase and enum InvestigationTool imported from shared-types

interface InvestigationPhaseRequest {
  sessionId: string;
  stepIndex: number;
  stepContent: string;
  phase: InvestigationPhase;
  investigationOptions?: InvestigationOptions;
  context?: PageInvestigationContext;
}

interface InvestigationPhaseResult {
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

interface InvestigationToolRequest {
  sessionId: string;
  stepIndex: number;
  tool: InvestigationTool;
  parameters?: InvestigationToolParameters;
  context?: PageInvestigationContext;
}

interface InvestigationToolResult {
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

interface InvestigationToolParameters {
  selector?: string;          // For text/DOM extraction
  screenshotId?: string;      // For screenshot analysis
  maxDomSize?: number;        // For DOM retrieval
  includeStyles?: boolean;    // For DOM extraction
  includeHiddenText?: boolean; // For text extraction
  maxTextLength?: number;     // For text extraction
}

interface PageInvestigationContext {
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

interface InvestigationOptions {
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

// Types imported from shared-types (to prevent duplication)
// interface ElementDiscovery - imported from shared-types.md

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

// interface PageInsight - imported from shared-types.md

interface InvestigationOutput {
  textContent?: string;       // For text extraction
  domContent?: string;        // For DOM retrieval (excluded from context)
  visualDescription?: string; // For screenshot analysis
  elementCount?: number;      // For DOM queries
  summary?: string;           // High-level summary for context
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

interface InvestigationPriority {
  primary: InvestigationTool;
  fallbacks: InvestigationTool[];
  reasoning: string;
}

interface WorkingMemoryUpdate {
  updateType: 'element_discovery' | 'page_insight' | 'variable_extraction' | 'pattern_learning' | 'investigation_preference';
  data: any;
  confidence: number;
  source: string;
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
```

## Core Functionality

### 1. ACT-REFLECT Cycle Implementation with Investigation

```typescript
async processStep(request: TaskLoopStepRequest): Promise<StepResult>
```

#### Main Processing Flow (Enhanced with Investigation):
```typescript
async processStep(request: TaskLoopStepRequest): Promise<StepResult> {
  const { sessionId, stepIndex, stepContent, streamId } = request;
  const executionState = this.initializeExecutionState(request);
  
  try {
    // ACT-REFLECT Loop with Investigation
    while (!this.isExecutionComplete(executionState) && 
           executionState.currentIteration < executionState.maxIterations) {
      
      // ACT Phase (Enhanced with Investigation)
      const actResult = await this.executeEnhancedActPhase(sessionId, stepIndex, stepContent, executionState);
      
      // REFLECT Phase (if enabled and needed)
      if (request.options?.reflectionEnabled && this.shouldReflect(actResult)) {
        const reflectResult = await this.executeReflectPhase(sessionId, stepIndex, actResult, executionState);
        
        // Update execution state based on reflection
        if (reflectResult.decision === DecisionAction.RETRY) {
          executionState.currentIteration++;
          continue;
        } else if (reflectResult.decision === DecisionAction.ABORT) {
          executionState.phase = ExecutionPhase.FAILED;
          break;
        }
      }
      
      // Mark as completed if ACT phase was successful
      executionState.phase = ExecutionPhase.COMPLETED;
      break;
    }
    
    return this.buildStepProcessingResult(sessionId, stepIndex, executionState);
    
  } catch (error) {
    return this.handleProcessingError(sessionId, stepIndex, error, executionState);
  }
}

#### Enhanced ACT Phase with Investigation Cycle:
async executeEnhancedActPhase(sessionId: string, stepIndex: number, stepContent: string, state: ExecutionState): Promise<ActResult> {
  const investigationOptions = this.getInvestigationOptions(state);
  
  // Check if investigation is enabled
  if (investigationOptions.enableInvestigation) {
    // Execute Investigation Cycle
    const investigationResult = await this.executeInvestigationCycle(sessionId, stepIndex, stepContent, investigationOptions);
    
    // Store investigation state
    state.investigationState = investigationResult.investigationState;
    
    // Generate action prompt with investigation context
    return await this.executeActionWithInvestigationContext(sessionId, stepIndex, stepContent, investigationResult, state);
  } else {
    // Execute traditional ACT phase
    return await this.executeActPhase(sessionId, stepIndex, stepContent, state);
  }
}
```

### 2. Investigation Cycle Implementation (NEW)

The investigation cycle follows the three-phase approach defined in the overall architecture:

1. **Initial Assessment**: High-level page understanding via screenshot analysis
2. **Focused Exploration**: Targeted exploration using text extraction and sub-DOM analysis  
3. **Selector Determination**: Synthesize findings to determine optimal selectors

```typescript
async executeInvestigationCycle(sessionId: string, stepIndex: number, stepContent: string, options: InvestigationOptions): Promise<InvestigationCycleResult> {
  const investigationState = this.initializeInvestigationState(options);
  const investigationContext = await this.buildInvestigationContext(sessionId, stepIndex, stepContent);
  
  try {
    // Phase 1: Initial Assessment
    investigationState.currentPhase = InvestigationPhase.INITIAL_ASSESSMENT;
    const initialResult = await this.executeInvestigationPhase({
      sessionId, stepIndex, stepContent,
      phase: InvestigationPhase.INITIAL_ASSESSMENT,
      investigationOptions: options,
      context: investigationContext
    });
    
    // Phase 2: Focused Exploration  
    investigationState.currentPhase = InvestigationPhase.FOCUSED_EXPLORATION;
    const explorationResult = await this.executeInvestigationPhase({
      sessionId, stepIndex, stepContent,
      phase: InvestigationPhase.FOCUSED_EXPLORATION,
      investigationOptions: options,
      context: investigationContext
    });
    
    // Phase 3: Selector Determination
    investigationState.currentPhase = InvestigationPhase.SELECTOR_DETERMINATION;
    const determinationResult = await this.executeInvestigationPhase({
      sessionId, stepIndex, stepContent,
      phase: InvestigationPhase.SELECTOR_DETERMINATION,
      investigationOptions: options,
      context: investigationContext
    });
    
    // Store investigation results and update working memory
    await this.storeInvestigationResults(sessionId, stepIndex, investigationState);
    await this.updateWorkingMemoryFromInvestigation(sessionId, stepIndex, investigationState);
    
    return {
      success: true,
      investigationState,
      investigationContext,
      readyForAction: determinationResult.readyForAction,
      totalDuration: Date.now() - investigationState.startTime.getTime()
    };
    
  } catch (error) {
    return {
      success: false,
      investigationState,
      investigationContext,
      readyForAction: false,
      totalDuration: Date.now() - investigationState.startTime.getTime(),
      error: this.wrapError(error, 'INVESTIGATION_CYCLE_FAILED')
    };
  }
}

interface InvestigationCycleResult {
  success: boolean;
  investigationState: InvestigationState;
  investigationContext: PageInvestigationContext;
  readyForAction: boolean;
  totalDuration: number;
  error?: StandardError;
}
```

### 3. Traditional ACT Phase Implementation (FIXED)

```typescript
async executeActPhase(sessionId: string, stepIndex: number, stepContent: string, state: ExecutionState): Promise<ActResult>
```

#### Act Phase Process (FIXED: Multiple Commands Support):
1. **Generate AI Prompt**: Use AI Prompt Manager to create context-aware prompt
2. **Query AI**: Send prompt to AI Integration Module  
3. **Parse Response**: Extract multiple commands and reasoning from AI response (FIXED)
4. **Inject Session IDs**: Transform AI commands to Executor commands with session IDs (FIXED)
5. **Execute Commands**: Execute automation commands via Executor Module
6. **Store Results**: Save execution data in AI Context Manager
7. **Publish Updates**: Send updates to Executor Streamer

```typescript
async executeActPhase(sessionId: string, stepIndex: number, stepContent: string, state: ExecutionState): Promise<ActResult> {
  // Phase 1: Generate Prompt
  state.phase = ExecutionPhase.GENERATING_PROMPT;
  await this.publishPhaseUpdate(sessionId, stepIndex, state);
  
  const promptRequest: ActionPromptRequest = {
    sessionId,
    currentStepIndex: stepIndex,
    currentStepContent: stepContent,
    includeValidation: true,
    promptOptions: this.buildPromptOptions(state)
  };
  
  const generatedPrompt = await this.promptManager.generateActionPrompt(promptRequest);
  
  // Phase 2: Query AI
  state.phase = ExecutionPhase.QUERYING_AI;
  await this.publishPhaseUpdate(sessionId, stepIndex, state);
  
  const aiRequest: AIRequest = {
    messages: this.buildAIMessages(generatedPrompt),
    parameters: this.buildAIParameters()
  };
  
  const aiResponse = await this.aiIntegration.sendRequest(this.aiConnectionId, aiRequest);
  
  // Publish AI reasoning
  await this.publishAIReasoning(sessionId, stepIndex, aiResponse);
  
  // Phase 3: Process AI Response (FIXED: Supports multiple commands)
  state.phase = ExecutionPhase.PROCESSING_RESPONSE;
  const parsedResponse: AIResponse = await this.parseAIResponse(aiResponse);
  
  // Phase 4: Transform AI Commands to Executor Commands (FIXED: Session ID Injection)
  const executorCommands: ExecutorCommand[] = this.injectSessionIds(sessionId, parsedResponse.commands);
  
  // Phase 5: Execute Commands (FIXED: Plural)
  state.phase = ExecutionPhase.EXECUTING_COMMANDS;
  const commandResults: CommandResponse[] = [];
  
  for (const executorCommand of executorCommands) {
    const result = await this.executeCommand(executorCommand);
    commandResults.push(result);
    
    // Publish command execution
    await this.publishCommandExecution(sessionId, stepIndex, executorCommand, result);
    
    // Store in context manager (FIXED: Use correct method signature)
    await this.contextManager.addExecutionEvent(sessionId, stepIndex, executorCommand, result, parsedResponse.reasoning?.analysis, result.screenshotId);
  }
  
  // Store state for reflection
  state.lastCommands = executorCommands;
  state.aiResponse = parsedResponse;
  
  return {
    success: commandResults.every(r => r.success),
    commandResults,
    executorCommands,
    aiResponse: parsedResponse,
    duration: Date.now() - state.startTime
  };
}

// Investigation Tool Execution Implementation
async executeInvestigationTool(request: InvestigationToolRequest): Promise<InvestigationToolResult> {
  const { sessionId, stepIndex, tool, parameters, context } = request;
  const startTime = Date.now();
  
  try {
    let toolResult: Partial<InvestigationToolResult>;
    
    switch (tool) {
      case InvestigationTool.SCREENSHOT_ANALYSIS:
        toolResult = await this.executeScreenshotAnalysis(sessionId, parameters);
        break;
        
      case InvestigationTool.TEXT_EXTRACTION:
        toolResult = await this.executeTextExtraction(sessionId, parameters);
        break;
        
      case InvestigationTool.FULL_DOM_RETRIEVAL:
        toolResult = await this.executeFullDomRetrieval(sessionId, parameters);
        break;
        
      case InvestigationTool.SUB_DOM_EXTRACTION:
        toolResult = await this.executeSubDomExtraction(sessionId, parameters);
        break;
        
      default:
        throw this.createStandardError(
          'UNSUPPORTED_INVESTIGATION_TOOL',
          `Unsupported investigation tool: ${tool}`,
          { tool, parameters }
        );
    }
    
    return {
      success: true,
      tool,
      output: toolResult.output || {},
      elementsDiscovered: toolResult.elementsDiscovered,
      pageInsightUpdates: toolResult.pageInsightUpdates,
      workingMemoryUpdates: toolResult.workingMemoryUpdates,
      confidence: toolResult.confidence || 0.8,
      duration: Date.now() - startTime
    };
    
  } catch (error) {
    return {
      success: false,
      tool,
      output: {},
      confidence: 0,
      duration: Date.now() - startTime,
      error: this.wrapError(error, 'INVESTIGATION_TOOL_FAILED')
    };
  }
}

// Individual investigation tool implementations
private async executeScreenshotAnalysis(sessionId: string, parameters?: InvestigationToolParameters): Promise<Partial<InvestigationToolResult>> {
  // Capture screenshot through executor
  const screenshotResult = await this.executor.getDom(sessionId);
  
  if (!screenshotResult.success) {
    throw new Error(`Screenshot capture failed: ${screenshotResult.error?.message}`);
  }
  
  // TODO: Integrate with AI Vision for detailed screenshot analysis
  // For now, return basic screenshot info with ID for future analysis
  return {
    output: {
      visualDescription: `Screenshot captured with ID: ${screenshotResult.screenshotId}`,
      summary: 'Page screenshot taken and available for visual analysis'
    },
    confidence: 0.8,
    pageInsightUpdates: {
      visualDescription: `Screenshot available: ${screenshotResult.screenshotId}`
    }
  };
}

private async executeTextExtraction(sessionId: string, parameters?: InvestigationToolParameters): Promise<Partial<InvestigationToolResult>> {
  const selector = parameters?.selector || 'body';
  const maxTextLength = parameters?.maxTextLength || 5000;
  
  // Use executor's GET_CONTENT command
  const textResult = await this.executor.getContent(sessionId, selector, 'textContent', false);
  
  if (!textResult.success) {
    throw new Error(`Text extraction failed: ${textResult.error?.message}`);
  }
  
  const textContent = textResult.metadata?.content as string || '';
  const truncatedText = textContent.length > maxTextLength 
    ? textContent.substring(0, maxTextLength) + '...' 
    : textContent;
  
  return {
    output: {
      textContent: truncatedText,
      summary: `Extracted ${textContent.length} characters from ${selector}`
    },
    confidence: 0.9,
    pageInsightUpdates: {
      keyElements: [`Text content from ${selector}: ${textContent.substring(0, 100)}...`]
    }
  };
}

private async executeFullDomRetrieval(sessionId: string, parameters?: InvestigationToolParameters): Promise<Partial<InvestigationToolResult>> {
  const maxDomSize = parameters?.maxDomSize || 100000;
  
  // Get full DOM through executor
  const domResult = await this.executor.getDom(sessionId);
  
  if (!domResult.success) {
    throw new Error(`DOM retrieval failed: ${domResult.error?.message}`);
  }
  
  const fullDom = domResult.dom;
  
  // Check size limits
  if (fullDom.length > maxDomSize) {
    throw new Error(`DOM size (${fullDom.length}) exceeds limit (${maxDomSize})`);
  }
  
  const elementCount = (fullDom.match(/<[^>]+>/g) || []).length;
  
  return {
    output: {
      domContent: fullDom,
      elementCount,
      summary: `Retrieved full DOM with ${fullDom.length} characters and ${elementCount} elements`
    },
    confidence: 1.0,
    pageInsightUpdates: {
      complexity: elementCount > 500 ? 'high' : elementCount > 100 ? 'medium' : 'low'
    }
  };
}

private async executeSubDomExtraction(sessionId: string, parameters?: InvestigationToolParameters): Promise<Partial<InvestigationToolResult>> {
  const selector = parameters?.selector || 'main, .content, #content, article, section';
  const maxDomSize = parameters?.maxDomSize || 50000;
  
  // Use executor's GET_SUBDOM command
  const subDomResult = await this.executor.getSubDOM(sessionId, selector, maxDomSize);
  
  if (!subDomResult.success) {
    throw new Error(`Sub-DOM extraction failed: ${subDomResult.error?.message}`);
  }
  
  const subDomElements = subDomResult.metadata?.subDomElements as string[] || [];
  const totalSize = subDomElements.join('').length;
  
  return {
    output: {
      domContent: subDomElements.join('\n'),
      elementCount: subDomElements.length,
      summary: `Extracted ${subDomElements.length} elements (${totalSize} characters) matching ${selector}`
    },
    confidence: 0.9,
    pageInsightUpdates: {
      mainSections: [`Content sections found: ${subDomElements.length} elements`]
    }
  };
}

// FIXED: Session ID Injection Logic
private injectSessionIds(sessionId: string, aiCommands: AIGeneratedCommand[]): ExecutorCommand[] {
  return aiCommands.map((aiCommand, index) => ({
    sessionId,                            // FIXED: Inject session ID
    action: aiCommand.action,
    parameters: aiCommand.parameters,
    commandId: crypto.randomUUID(),       // Generate unique command ID
    timestamp: new Date()
  }));
}
```

### 3. Action Execution with Investigation Context (NEW)

```typescript
async executeActionWithInvestigationContext(sessionId: string, stepIndex: number, stepContent: string, investigationResult: InvestigationCycleResult, state: ExecutionState): Promise<ActResult> {
  // Generate investigation context summary for AI prompt
  const investigationContextSummary = await this.buildInvestigationContextSummary(investigationResult);
  
  // Generate action prompt with investigation context
  const actionPrompt = await this.promptManager.generateActionWithInvestigationPrompt({
    sessionId,
    stepIndex,
    stepContent,
    investigationContext: investigationContextSummary,
    promptOptions: this.buildPromptOptions(state)
  });
  
  // Query AI for action with full investigation context
  const aiRequest: AIRequest = {
    messages: this.buildAIMessages(actionPrompt),
    parameters: this.buildAIParameters()
  };
  
  const aiResponse = await this.aiIntegration.sendRequest(this.aiConnectionId, aiRequest);
  
  // Parse and execute commands using discovered elements and context
  const parsedResponse: AIResponse = await this.parseAIResponse(aiResponse);
  const executorCommands: ExecutorCommand[] = this.injectSessionIds(sessionId, parsedResponse.commands);
  
  // Execute commands with enhanced error context from investigation
  const commandResults: CommandResponse[] = [];
  for (const executorCommand of executorCommands) {
    const result = await this.executeCommand(executorCommand);
    commandResults.push(result);
    
    // Store execution with investigation context
    await this.contextManager.addExecutionEvent(sessionId, stepIndex, executorCommand, result, parsedResponse.reasoning?.analysis, result.screenshotId);
  }
  
  // Update working memory with action results
  await this.updateWorkingMemoryFromAction(sessionId, stepIndex, parsedResponse, commandResults, investigationResult);
  
  return {
    success: commandResults.every(r => r.success),
    commandResults,
    executorCommands,
    aiResponse: parsedResponse,
    investigationContext: investigationContextSummary,
    duration: Date.now() - state.startTime
  };
}

// Working Memory and Context Management Implementation
async updateWorkingMemoryFromInvestigation(sessionId: string, stepIndex: number, investigationState: InvestigationState): Promise<void> {
  const workingMemoryUpdates: WorkingMemoryUpdate[] = [];
  
  // Add element discoveries to working memory
  for (const element of investigationState.elementsDiscovered) {
    workingMemoryUpdates.push({
      updateType: 'element_discovery',
      data: {
        selector: element.selector,
        elementType: element.elementType,
        reliability: element.confidence,
        discoveryMethod: element.discoveryMethod
      },
      confidence: element.confidence,
      source: 'investigation_cycle'
    });
  }
  
  // Update working memory through context manager
  for (const update of workingMemoryUpdates) {
    await this.contextManager.updateWorkingMemory(sessionId, stepIndex, update);
  }
}

async storeInvestigationResults(sessionId: string, stepIndex: number, investigationState: InvestigationState): Promise<void> {
  // Store investigation results and element discoveries in context manager
  for (const element of investigationState.elementsDiscovered) {
    await this.contextManager.addPageElementDiscovery(sessionId, stepIndex, element);
  }
}
```

### 4. REFLECT Phase Implementation

```typescript
async executeReflectPhase(sessionId: string, stepIndex: number, actResult: ActResult, state: ExecutionState): Promise<ReflectResult>
```

#### Reflect Phase Process:
1. **Generate Reflection Prompt**: Create prompt for result validation
2. **Query AI for Reflection**: Get AI assessment of action results
3. **Analyze Outcomes**: Determine if step was successful or needs retry
4. **Make Decision**: Decide whether to proceed, retry, or abort

```typescript
async executeReflectPhase(sessionId: string, stepIndex: number, actResult: ActResult, state: ExecutionState): Promise<ReflectResult> {
  state.phase = ExecutionPhase.REFLECTING;
  await this.publishPhaseUpdate(sessionId, stepIndex, state);
  
  // Generate reflection prompt
  const reflectionRequest: ReflectionPromptRequest = {
    sessionId,
    completedStepIndex: stepIndex,
    nextStepIndex: stepIndex + 1,
    nextStepContent: await this.getNextStepContent(sessionId, stepIndex),
    expectedOutcome: actResult.expectedOutcome,
    promptOptions: this.buildReflectionPromptOptions(state)
  };
  
  const reflectionPrompt = await this.promptManager.generateReflectionPrompt(reflectionRequest);
  
  // Query AI for reflection
  const aiRequest: AIRequest = {
    messages: this.buildReflectionMessages(reflectionPrompt, actResult),
    parameters: this.buildReflectionAIParameters()
  };
  
  const reflectionResponse = await this.aiIntegration.sendRequest(this.connectionId, aiRequest);
  
  // Parse reflection response
  const reflectionResult = await this.parseReflectionResponse(reflectionResponse);
  
  // Store reflection data
  await this.storeReflectionData(sessionId, stepIndex, reflectionResult);
  
  // Publish reflection reasoning
  await this.publishReflectionReasoning(sessionId, stepIndex, reflectionResult);
  
  return reflectionResult;
}
```

### 4. Command Execution (FIXED)

```typescript
async executeCommand(command: ExecutorCommand): Promise<CommandResponse>
```

#### Command Types and Execution (FIXED: Uses ExecutorCommand with session ID):
```typescript
async executeCommand(command: ExecutorCommand): Promise<CommandResponse> {
  try {
    let executorResponse: CommandResponse;
    
    // Commands now include sessionId - no need to pass separately
    switch (command.action) {
      case CommandAction.OPEN_PAGE:
        executorResponse = await this.executor.openPage(command.sessionId, command.parameters.url!);
        break;
        
      case CommandAction.CLICK_ELEMENT:
        executorResponse = await this.executor.clickElement(command.sessionId, command.parameters.selector!);
        break;
        
      case CommandAction.INPUT_TEXT:
        executorResponse = await this.executor.inputText(
          command.sessionId, 
          command.parameters.selector!, 
          command.parameters.text!
        );
        break;
        
      case CommandAction.SAVE_VARIABLE:
        executorResponse = await this.executor.saveVariable(
          command.sessionId,
          command.parameters.selector!,
          command.parameters.variableName!
        );
        break;
        
      case CommandAction.GET_DOM:
        executorResponse = await this.executor.getDom(command.sessionId);
        break;
        
      default:
        throw this.createStandardError(
          'UNSUPPORTED_COMMAND',
          `Unsupported command action: ${command.action}`,
          { command }
        );
    }
    
    // Ensure response includes command ID for tracking
    return {
      ...executorResponse,
      commandId: command.commandId
    };
    
  } catch (error) {
    // Return failed response with proper error handling
    return {
      success: false,
      commandId: command.commandId,
      dom: '',
      screenshotId: '',
      duration: 0,
      error: this.wrapError(error, command)
    };
  }
}

// Helper method to wrap errors with context
private wrapError(error: any, command: ExecutorCommand): StandardError {
  return this.createStandardError(
    'COMMAND_EXECUTION_FAILED',
    `Failed to execute ${command.action}: ${error.message}`,
    { 
      command,
      originalError: error 
    },
    error
  );
}
```

## Integration with Other Modules

### AI Prompt Manager Integration
```typescript
interface PromptManagerIntegration {
  generateActionPrompt(request: ActionPromptRequest): Promise<GeneratedPrompt>;
  generateReflectionPrompt(request: ReflectionPromptRequest): Promise<GeneratedPrompt>;
  validatePromptStructure(prompt: GeneratedPrompt): PromptValidationResult;
}
```

### AI Integration Module Integration
```typescript
interface AIIntegrationIntegration {
  sendRequest(connectionId: string, request: AIRequest): Promise<AIResponse>;
  sendStreamRequest(connectionId: string, request: AIRequest): AsyncGenerator<AIStreamChunk>;
  getConnectionStatus(connectionId: string): Promise<ConnectionStatus>;
}
```

### Executor Module Integration
```typescript
interface ExecutorIntegration {
  openPage(sessionId: string, url: string): Promise<CommandResponse>;
  clickElement(sessionId: string, selector: string): Promise<CommandResponse>;
  inputText(sessionId: string, selector: string, text: string): Promise<CommandResponse>;
  saveVariable(sessionId: string, selector: string, variableName: string): Promise<CommandResponse>;
  getDom(sessionId: string): Promise<CommandResponse>;
}
```

### AI Context Manager Integration (FIXED: Method Signatures Match)
```typescript
interface ContextManagerIntegration {
  // FIXED: Method signature now matches AI Context Manager interface
  addExecutionEvent(workflowSessionId: string, stepIndex: number, command: ExecutorCommand, result: CommandResponse, reasoning?: string, screenshotId?: string): Promise<string>;
  addExecutionEventFromStream(workflowSessionId: string, stepIndex: number, streamEvent: StreamEvent): Promise<string>;
  updateStepExecution(workflowSessionId: string, stepIndex: number, updates: Partial<StepExecution>): Promise<void>;
  generateContextJson(workflowSessionId: string, targetStep: number): Promise<AIContextJson>;
  linkExecutorSession(workflowSessionId: string, executorSessionId: string): Promise<void>;
}
```

### Executor Streamer Integration
```typescript
interface StreamerIntegration {
  publishReasoning(streamId: string, thought: string, confidence: number, type: string, context?: Record<string, any>): Promise<void>;
  publishCommandStarted(streamId: string, commandName: string, action: CommandAction, parameters: Record<string, any>): Promise<void>;
  publishCommandCompleted(streamId: string, commandName: string, result: any, duration: number): Promise<void>;
  publishScreenshot(streamId: string, screenshotInfo: ScreenshotInfo): Promise<void>;
}
```

## Advanced Features

### 1. AI Response Parsing (FIXED: Matches Shared Schema)
```typescript
// Response parser now works with shared AIResponse format (multiple commands)
class TaskLoopResponseParser {
  
  parseAIResponse(rawResponse: any): AIResponse {
    // Validate response structure against shared schema
    this.validateResponseStructure(rawResponse);
    
    // Parse according to shared AIResponse format
    const parsed: AIResponse = {
      decision: {
        action: rawResponse.decision?.action || DecisionAction.PROCEED,
        message: rawResponse.decision?.message || '',
        resultValidation: rawResponse.decision?.resultValidation
      },
      reasoning: {
        analysis: rawResponse.reasoning?.analysis || '',
        rationale: rawResponse.reasoning?.rationale || '',
        expectedOutcome: rawResponse.reasoning?.expectedOutcome || '',
        confidence: rawResponse.reasoning?.confidence || 0.5,
        alternatives: rawResponse.reasoning?.alternatives
      },
      commands: this.parseCommands(rawResponse.commands || []), // FIXED: Array support
      context: rawResponse.context
    };
    
    return parsed;
  }
  
  private parseCommands(commandsData: any[]): AIGeneratedCommand[] {
    // FIXED: Parse array of commands from AI response
    return commandsData.map((cmdData, index) => ({
      action: this.parseCommandAction(cmdData.action),
      parameters: this.parseCommandParameters(cmdData.parameters),
      reasoning: cmdData.reasoning,
      priority: cmdData.priority || index + 1
    }));
  }
  
  private parseCommandAction(action: string): CommandAction {
    const validActions = Object.values(CommandAction);
    if (!validActions.includes(action as CommandAction)) {
      throw this.createStandardError(
        'INVALID_COMMAND_ACTION',
        `Unknown command action: ${action}`
      );
    }
    return action as CommandAction;
  }
  
  private parseCommandParameters(params: any): CommandParameters {
    return {
      url: params?.url,
      selector: params?.selector,
      text: params?.text,
      variableName: params?.variableName
    };
  }
  
  parseReflectionResponse(rawResponse: any): ReflectionResult {
    return {
      decision: rawResponse.decision?.action || DecisionAction.PROCEED,
      reasoning: rawResponse.reasoning?.analysis || '',
      confidence: rawResponse.reasoning?.confidence || 0.5,
      suggestedModifications: rawResponse.decision?.message,
      riskAssessment: this.parseRiskAssessment(rawResponse.risk)
    };
  }
  
  private validateResponseStructure(response: any): void {
    const required = ['decision', 'reasoning'];
    for (const field of required) {
      if (!response[field]) {
        throw this.createStandardError(
          'INVALID_AI_RESPONSE',
          `Missing required field: ${field}`,
          { response }
        );
      }
    }
  }
}
```

### 2. Decision Making Framework
```typescript
interface DecisionEngine {
  shouldReflect(actResult: ActResult): boolean;
  shouldRetry(reflectionResult: ReflectionResult): boolean;
  shouldAbort(executionState: ExecutionState): boolean;
  calculateConfidenceThreshold(stepIndex: number, previousResults: ActResult[]): number;
}

interface ReflectionResult {
  decision: DecisionAction;
  reasoning: string;
  confidence: number;
  suggestedModifications?: string;
  riskAssessment?: RiskAssessment;
}

interface RiskAssessment {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  potentialIssues: string[];
  recommendations: string[];
}
```

### 3. Adaptive Learning
```typescript
interface AdaptiveLearning {
  updateSuccessPatterns(sessionId: string, stepIndex: number, result: ActResult): Promise<void>;
  getSuccessPatterns(sessionId: string, stepContent: string): Promise<SuccessPattern[]>;
  updateFailurePatterns(sessionId: string, stepIndex: number, error: any): Promise<void>;
  optimizePromptGeneration(sessionId: string, stepIndex: number): Promise<PromptOptimization>;
}

interface SuccessPattern {
  stepPattern: string;
  successfulActions: CommandAction[];
  contextFactors: string[];
  confidence: number;
  usageCount: number;
}
```

## Error Handling

### Error Types
```typescript
enum TaskLoopErrorType {
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
  
  // Investigation-specific error types (NEW)
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

interface TaskLoopError extends Error {
  type: TaskLoopErrorType;
  sessionId: string;
  stepIndex: number;
  phase: ExecutionPhase;
  details?: Record<string, any>;
  timestamp: Date;
}
```

### Recovery Mechanisms
- Automatic retry with exponential backoff
- Graceful degradation when AI services are unavailable
- Fallback prompt generation strategies
- Command execution error recovery
- State preservation during failures

#### Investigation-Specific Recovery (NEW)
- **Investigation Cycle Fallback**: Skip investigation and use traditional ACT phase when investigation fails
- **Investigation Tool Fallback**: Use alternative tools when preferred tools fail
- **Working Memory Recovery**: Initialize empty working memory when corruption detected
- **Context Filtering Fallback**: Use traditional context when filtered context generation fails
- **Element Discovery Fallback**: Continue with manual selectors when element discovery fails
- **Investigation Timeout Recovery**: Proceed with partial investigation results when timeout occurs
- **Progressive Context Fallback**: Use static context when progressive building fails

## Performance Considerations

### Optimization Strategies
- Prompt caching for similar step patterns
- Parallel execution of independent commands
- Streaming AI responses for large prompts
- Connection pooling for AI services
- Intelligent batching of context updates

### Resource Management
- Memory cleanup for completed executions
- Connection lifecycle management
- Cache size limitations and eviction policies
- Timeout management for long-running operations

## Configuration

### Module Configuration (FIXED: Extends BaseModuleConfig)
```typescript
// Import shared configuration pattern
import { BaseModuleConfig } from './shared-types';

interface TaskLoopConfig extends BaseModuleConfig {
  moduleId: 'task-loop';
  
  // Task Loop specific configuration
  execution: {
    maxIterations: number;
    enableReflection: boolean;
    reflectionThreshold: number;        // Confidence threshold for reflection
  };
  ai: {
    connectionId: string;
    maxTokens: number;
    temperature: number;
    // Note: AI timeouts inherited from BaseModuleConfig.timeouts.requestTimeoutMs and connectionTimeoutMs
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
  
  // Investigation Configuration (NEW)
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
  
  // Context Management Configuration (NEW)
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
  
  // Inherits from BaseModuleConfig:
  // - logging: LoggingConfig
  // - performance: PerformanceConfig  
  // - timeouts: TimeoutConfig (provides stepTimeoutMs, requestTimeoutMs, connectionTimeoutMs hierarchy)
}
```

## Monitoring and Analytics

### Metrics Collection
```typescript
interface LoopMetrics {
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
```

### Performance Tracking
- Step execution timing
- AI response latency
- Command execution duration
- Reflection frequency and effectiveness
- Error rates and patterns

## Logging Requirements

### Log Format
All log entries must start with `[TaskLoop]` prefix:
```
[TaskLoop][LEVEL] [SessionID:StepIndex] [Phase] Message with context
```

### Log Categories
- **DEBUG**: ACT-REFLECT cycle details, AI prompt/response content
- **INFO**: Step processing start/completion, phase transitions
- **WARN**: Reflection triggers, retry attempts, performance issues
- **ERROR**: Processing failures, AI communication errors

Examples:
```
[TaskLoop][INFO] [session-abc123:0] [INITIALIZING] Starting step processing: "Open login page"
[TaskLoop][DEBUG] [session-abc123:0] [GENERATING_PROMPT] Generated prompt with 1500 tokens
[TaskLoop][INFO] [session-abc123:0] [EXECUTING_ACTION] Executing OPEN_PAGE command
[TaskLoop][WARN] [session-abc123:0] [REFLECTING] Low confidence (0.6), triggering reflection
[TaskLoop][ERROR] [session-abc123:0] [EXECUTING_ACTION] Command execution failed: Selector not found
```

## Testing Requirements

### Traditional Testing
- Unit tests for ACT-REFLECT cycle implementation
- Integration tests with all dependent modules
- AI response parsing and validation tests
- Error handling and recovery scenarios
- Performance benchmarks for execution cycles
- Mock AI responses for deterministic testing
- Streaming integration validation

### Investigation-Specific Testing (NEW)
- **Investigation Cycle Testing**: Unit tests for complete investigation cycle (Initial Assessment → Focused Exploration → Selector Determination)
- **Investigation Tool Testing**: Individual tool testing (screenshot analysis, text extraction, DOM retrieval, sub-DOM extraction)
- **Working Memory Testing**: Working memory persistence, updates, and corruption recovery
- **Context Management Testing**: Filtered context generation, progressive context building, overflow prevention
- **Element Discovery Testing**: Element discovery accuracy, reliability scoring, knowledge accumulation
- **Investigation Integration Testing**: End-to-end investigation flow with AI Context Manager and AI Prompt Manager
- **Investigation Error Handling**: Tool failures, timeout scenarios, partial results handling
- **Investigation Performance Testing**: Investigation cycle latency, memory usage, context generation performance
- **Investigation Fallback Testing**: Graceful degradation when investigation tools fail
- **Investigation Configuration Testing**: Various investigation configuration scenarios and their impacts

## Security Considerations
- Input sanitization for AI prompts and responses
- Secure handling of sensitive data in automation steps
- Access control for AI integration credentials
- Audit logging for all AI interactions
- Rate limiting for AI service calls

## Future Enhancements

### Traditional Enhancements
- Multi-model AI support with fallback strategies
- Advanced prompt optimization using reinforcement learning
- Natural language step interpretation
- Cross-browser automation support
- Integration with testing frameworks
- Advanced debugging and step-by-step execution
- Collaborative AI decision making

### Investigation-Specific Enhancements (NEW)
- **AI-Powered Visual Analysis**: Integration with computer vision APIs for enhanced screenshot analysis
- **Intelligent Element Recognition**: Machine learning models for automatic element identification and classification
- **Adaptive Investigation Strategies**: Dynamic investigation approach optimization based on page complexity and success rates
- **Cross-Session Learning**: Share investigation patterns and element knowledge across different automation sessions
- **Predictive Element Discovery**: Predict likely elements and selectors before investigation begins
- **Visual Investigation Guidance**: Interactive visual guides showing investigation progress and findings
- **Investigation Pattern Mining**: Automated discovery of successful investigation patterns for specific site types
- **Multi-Modal Investigation**: Integration of visual, textual, and structural investigation methods
- **Investigation Quality Metrics**: Automated assessment and optimization of investigation effectiveness
- **Collaborative Investigation**: Multi-user investigation scenarios with shared working memory and findings
- **Real-time Investigation Streaming**: Live investigation progress monitoring and collaborative debugging
- **Investigation Analytics**: Detailed analytics and reporting for investigation performance and success rates
