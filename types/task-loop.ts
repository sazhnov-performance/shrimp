/**
 * Task Loop Module Type Definitions
 * Defines all interfaces and types for ACT-REFLECT cycle AI automation
 */

import { CommandAction, CommandParameters, CommandResponse, LogLevel } from './executor';
import { AIRequest, AIResponse, AIStreamChunk } from './ai-integration-module';
import { ActionPromptRequest, ReflectionPromptRequest, GeneratedPrompt, PromptOptions } from './ai-prompt-manager';
import { ResponseSchema, DecisionAction } from './ai-schema-manager';
import { ExecutionEvent, ExecutionStatus } from './ai-context-manager';
import { StreamEventType, ScreenshotInfo } from './executor-streamer';

// Core Task Loop Interface
export interface ITaskLoop {
  // Main Processing
  processStep(request: StepProcessingRequest): Promise<StepProcessingResult>;
  
  // Flow Control
  pauseExecution(sessionId: string, stepIndex: number): Promise<void>;
  resumeExecution(sessionId: string, stepIndex: number): Promise<void>;
  cancelExecution(sessionId: string, stepIndex: number): Promise<void>;
  
  // Callback Registration
  registerCallbacks(callbacks: TaskLoopCallbacks): void;
  
  // Status and Monitoring
  getExecutionState(sessionId: string, stepIndex: number): Promise<ExecutionState>;
  getLoopMetrics(sessionId: string): Promise<LoopMetrics>;
}

// Request and Response Types
export interface StepProcessingRequest {
  sessionId: string;
  stepIndex: number;
  stepContent: string;
  streamId?: string;
  options?: ProcessingOptions;
}

export interface StepProcessingResult {
  sessionId: string;
  stepIndex: number;
  success: boolean;
  executedActions: ExecutedAction[];
  finalState: ExecutionState;
  duration: number;
  error?: TaskLoopError;
}

export interface ProcessingOptions {
  maxIterations?: number; // Maximum ACT-REFLECT cycles
  reflectionEnabled?: boolean;
  validationMode?: 'strict' | 'lenient';
  timeoutMs?: number;
  retryOnFailure?: boolean;
  maxRetries?: number;
  confidenceThreshold?: number;
  adaptiveLearningEnabled?: boolean;
}

// Execution State Management
export interface ExecutionState {
  phase: ExecutionPhase;
  currentIteration: number;
  maxIterations: number;
  lastAction?: ExecutedAction;
  aiReasoning?: string;
  confidence?: number;
  nextDecision?: DecisionAction;
  reflectionData?: ReflectionData;
  startTime: Date;
  phaseStartTime: Date;
}

export enum ExecutionPhase {
  INITIALIZING = 'INITIALIZING',
  GENERATING_PROMPT = 'GENERATING_PROMPT',
  QUERYING_AI = 'QUERYING_AI',
  PROCESSING_RESPONSE = 'PROCESSING_RESPONSE',
  EXECUTING_ACTION = 'EXECUTING_ACTION',
  REFLECTING = 'REFLECTING',
  VALIDATING = 'VALIDATING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export interface ExecutedAction {
  actionId: string;
  command: ParsedCommand;
  result: ExecutionResult;
  timestamp: Date;
  duration: number;
  screenshotId?: string;
  reasoning?: string;
}

// ACT Phase Types
export interface ActResult {
  success: boolean;
  executionResults: ExecutionResult[];
  aiReasoning: string;
  confidence: number;
  expectedOutcome?: string;
  actualOutcome?: string;
  screenshotIds: string[];
  duration: number;
}

export interface ExecutionResult {
  success: boolean;
  command: ParsedCommand;
  response?: CommandResponse;
  error?: any;
  timestamp: Date;
  duration: number;
}

// REFLECT Phase Types
export interface ReflectionData {
  decision: DecisionAction;
  reasoning: string;
  confidence: number;
  suggestedModifications?: string;
  riskAssessment?: RiskAssessment;
  validationResults?: ValidationResults;
  improvementSuggestions?: string[];
}

export interface ReflectResult {
  decision: DecisionAction;
  reasoning: string;
  confidence: number;
  suggestedModifications?: string;
  riskAssessment?: RiskAssessment;
  nextActionRecommendation?: string;
}

export interface RiskAssessment {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  potentialIssues: string[];
  recommendations: string[];
  confidenceInAssessment: number;
}

export interface ValidationResults {
  pageStateValid: boolean;
  expectedElementsPresent: boolean;
  unexpectedChanges: string[];
  validationScore: number;
  issues: ValidationIssue[];
}

export interface ValidationIssue {
  type: 'ERROR' | 'WARNING' | 'INFO';
  message: string;
  selector?: string;
  recommendation?: string;
}

// AI Response Processing Types
export interface ResponseParser {
  parseActionResponse(response: AIResponse): ParsedActionResponse;
  parseReflectionResponse(response: AIResponse): ParsedReflectionResponse;
  validateResponseSchema(response: any, schema: ResponseSchema): ValidationResult;
}

export interface ParsedActionResponse {
  reasoning: string;
  confidence: number;
  commands: ParsedCommand[];
  expectedOutcome?: string;
  metadata?: Record<string, any>;
  isValid: boolean;
  validationErrors?: string[];
}

export interface ParsedReflectionResponse {
  decision: DecisionAction;
  reasoning: string;
  confidence: number;
  analysis: string;
  suggestedModifications?: string;
  riskAssessment?: RiskAssessment;
  isValid: boolean;
  validationErrors?: string[];
}

export interface ParsedCommand {
  commandId: string;
  action: CommandAction;
  parameters: CommandParameters;
  reasoning?: string;
  priority?: number;
  expectedOutcome?: string;
  startTime: number;
  timeout?: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
  score: number;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'ERROR' | 'WARNING';
}

// Decision Making Types
export interface DecisionEngine {
  shouldReflect(actResult: ActResult): boolean;
  shouldRetry(reflectionResult: ReflectResult): boolean;
  shouldAbort(executionState: ExecutionState): boolean;
  calculateConfidenceThreshold(stepIndex: number, previousResults: ActResult[]): number;
  assessRisk(executionState: ExecutionState, actResult: ActResult): RiskAssessment;
}

export interface DecisionCriteria {
  confidenceThreshold: number;
  maxRetries: number;
  timeoutThreshold: number;
  errorRateThreshold: number;
  riskToleranceLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

// Integration Interface Types
export interface PromptManagerIntegration {
  generateActionPrompt(request: ActionPromptRequest): Promise<GeneratedPrompt>;
  generateReflectionPrompt(request: ReflectionPromptRequest): Promise<GeneratedPrompt>;
  validatePromptStructure(prompt: GeneratedPrompt): PromptValidationResult;
}

export interface PromptValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  qualityScore: number;
}

export interface AIIntegrationIntegration {
  sendRequest(connectionId: string, request: AIRequest): Promise<AIResponse>;
  sendStreamRequest(connectionId: string, request: AIRequest): AsyncGenerator<AIStreamChunk>;
  getConnectionStatus(connectionId: string): Promise<ConnectionStatus>;
  validateConnection(connectionId: string): Promise<boolean>;
}

export interface ConnectionStatus {
  connected: boolean;
  latency: number;
  lastUsed: Date;
  errorCount: number;
}

export interface ExecutorIntegration {
  openPage(sessionId: string, url: string): Promise<CommandResponse>;
  clickElement(sessionId: string, selector: string): Promise<CommandResponse>;
  inputText(sessionId: string, selector: string, text: string): Promise<CommandResponse>;
  saveVariable(sessionId: string, selector: string, variableName: string): Promise<CommandResponse>;
  getDom(sessionId: string): Promise<CommandResponse>;
  getScreenshot(sessionId: string): Promise<ScreenshotInfo>;
}

export interface ContextManagerIntegration {
  addExecutionEvent(sessionId: string, stepIndex: number, event: Omit<ExecutionEvent, 'eventId'>): Promise<string>;
  updateStepExecution(sessionId: string, stepIndex: number, updates: Partial<StepExecution>): Promise<void>;
  generateContextJson(sessionId: string, targetStep: number): Promise<AIContextJson>;
  getLatestDom(sessionId: string): Promise<string>;
}

export interface StepExecution {
  stepIndex: number;
  stepName: string;
  status: ExecutionStatus;
  startTime: Date;
  endTime?: Date;
  iterations: number;
  events: ExecutionEvent[];
}

export interface AIContextJson {
  sessionId: string;
  targetStep: number;
  executionFlow: any[];
  previousPageDom?: string;
  currentPageDom?: string;
}

export interface StreamerIntegration {
  publishReasoning(streamId: string, thought: string, confidence: number, type: string, context?: Record<string, any>): Promise<void>;
  publishCommandStarted(streamId: string, commandName: string, action: CommandAction, parameters: Record<string, any>): Promise<void>;
  publishCommandCompleted(streamId: string, commandName: string, result: any, duration: number): Promise<void>;
  publishCommandFailed(streamId: string, commandName: string, error: any, duration: number): Promise<void>;
  publishScreenshot(streamId: string, screenshotInfo: ScreenshotInfo): Promise<void>;
  publishEvent(streamId: string, event: any): Promise<void>;
}

// Callback Interface Types
export interface TaskLoopCallbacks {
  onStepStarted(sessionId: string, stepIndex: number): Promise<void>;
  onStepCompleted(sessionId: string, stepIndex: number, result: StepProcessingResult): Promise<void>;
  onStepFailed(sessionId: string, stepIndex: number, error: TaskLoopError): Promise<void>;
  onReasoningUpdate(sessionId: string, stepIndex: number, reasoning: string, confidence: number): Promise<void>;
  onExecutorMethodCalled(sessionId: string, stepIndex: number, method: string, parameters: any, result: any): Promise<void>;
  onPhaseChanged(sessionId: string, stepIndex: number, phase: ExecutionPhase): Promise<void>;
  onReflectionTriggered(sessionId: string, stepIndex: number, reason: string): Promise<void>;
}

// Adaptive Learning Types
export interface AdaptiveLearning {
  updateSuccessPatterns(sessionId: string, stepIndex: number, result: ActResult): Promise<void>;
  getSuccessPatterns(sessionId: string, stepContent: string): Promise<SuccessPattern[]>;
  updateFailurePatterns(sessionId: string, stepIndex: number, error: any): Promise<void>;
  optimizePromptGeneration(sessionId: string, stepIndex: number): Promise<PromptOptimization>;
  learnFromReflection(sessionId: string, stepIndex: number, reflectionData: ReflectionData): Promise<void>;
}

export interface SuccessPattern {
  id: string;
  stepPattern: string;
  successfulActions: CommandAction[];
  contextFactors: string[];
  confidence: number;
  usageCount: number;
  successRate: number;
  lastUsed: Date;
  metadata?: Record<string, any>;
}

export interface FailurePattern {
  id: string;
  stepPattern: string;
  failureActions: CommandAction[];
  errorPatterns: string[];
  frequency: number;
  lastOccurrence: Date;
  mitigationStrategies: string[];
}

export interface PromptOptimization {
  recommendedOptions: PromptOptions;
  expectedImprovement: number;
  confidence: number;
  reasoning: string;
}

// Configuration Types
export interface TaskLoopConfig {
  execution: {
    maxIterations: number;
    defaultTimeoutMs: number;
    enableReflection: boolean;
    reflectionThreshold: number; // Confidence threshold for reflection
    adaptiveLearningEnabled: boolean;
  };
  ai: {
    connectionId: string;
    maxTokens: number;
    temperature: number;
    timeoutMs: number;
    retryAttempts: number;
    retryDelayMs: number;
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
    publishPhaseChanges: boolean;
  };
  performance: {
    parallelCommands: boolean;
    cacheResponsePatterns: boolean;
    maxConcurrentActions: number;
  };
  validation: {
    enableResponseValidation: boolean;
    strictSchemaValidation: boolean;
    validateDomChanges: boolean;
  };
  decision: {
    defaultConfidenceThreshold: number;
    maxReflectionCycles: number;
    riskToleranceLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  logging: {
    level: LogLevel;
    includeAIResponses: boolean;
    includeExecutorResponses: boolean;
    includePromptDetails: boolean;
  };
}

// Metrics and Analytics Types
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
  reflectionSuccessRate: number;
  confidenceDistribution: ConfidenceDistribution;
  errorBreakdown: Record<TaskLoopErrorType, number>;
  phaseDistribution: Record<ExecutionPhase, number>;
}

export interface ConfidenceDistribution {
  high: number; // > 0.8
  medium: number; // 0.5 - 0.8
  low: number; // < 0.5
  average: number;
}

export interface PerformanceMetrics {
  sessionId: string;
  stepIndex: number;
  totalDuration: number;
  phaseDurations: Record<ExecutionPhase, number>;
  iterationCount: number;
  commandCount: number;
  reflectionCount: number;
  errorCount: number;
  confidenceScores: number[];
}

// Event Types
export enum TaskLoopEventType {
  STEP_STARTED = 'STEP_STARTED',
  PHASE_CHANGED = 'PHASE_CHANGED',
  AI_RESPONSE_RECEIVED = 'AI_RESPONSE_RECEIVED',
  COMMAND_EXECUTED = 'COMMAND_EXECUTED',
  REFLECTION_TRIGGERED = 'REFLECTION_TRIGGERED',
  DECISION_MADE = 'DECISION_MADE',
  STEP_COMPLETED = 'STEP_COMPLETED',
  STEP_FAILED = 'STEP_FAILED',
  ITERATION_COMPLETED = 'ITERATION_COMPLETED'
}

export interface TaskLoopEvent {
  type: TaskLoopEventType;
  sessionId: string;
  stepIndex: number;
  iteration?: number;
  phase?: ExecutionPhase;
  timestamp: Date;
  data?: Record<string, any>;
}

// Error Types
export enum TaskLoopErrorType {
  PROMPT_GENERATION_ERROR = 'PROMPT_GENERATION_ERROR',
  AI_COMMUNICATION_ERROR = 'AI_COMMUNICATION_ERROR',
  RESPONSE_PARSING_ERROR = 'RESPONSE_PARSING_ERROR',
  COMMAND_EXECUTION_ERROR = 'COMMAND_EXECUTION_ERROR',
  CONTEXT_STORAGE_ERROR = 'CONTEXT_STORAGE_ERROR',
  STREAMING_ERROR = 'STREAMING_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNSUPPORTED_COMMAND = 'UNSUPPORTED_COMMAND',
  REFLECTION_ERROR = 'REFLECTION_ERROR',
  DECISION_ERROR = 'DECISION_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR'
}

export interface TaskLoopError extends Error {
  type: TaskLoopErrorType;
  sessionId: string;
  stepIndex: number;
  phase: ExecutionPhase;
  iteration?: number;
  details?: Record<string, any>;
  timestamp: Date;
  retryable: boolean;
}

// State Management Types
export interface StateManager {
  saveExecutionState(sessionId: string, stepIndex: number, state: ExecutionState): Promise<void>;
  loadExecutionState(sessionId: string, stepIndex: number): Promise<ExecutionState | null>;
  clearExecutionState(sessionId: string, stepIndex: number): Promise<void>;
  listActiveStates(): Promise<{ sessionId: string; stepIndex: number }[]>;
}

export interface ExecutionContext {
  sessionId: string;
  stepIndex: number;
  stepContent: string;
  streamId?: string;
  startTime: Date;
  options: ProcessingOptions;
  state: ExecutionState;
  callbacks?: TaskLoopCallbacks;
}

// Command Builder Types
export interface CommandBuilder {
  buildCommands(aiResponse: ParsedActionResponse): ParsedCommand[];
  validateCommand(command: ParsedCommand): ValidationResult;
  optimizeCommandSequence(commands: ParsedCommand[]): ParsedCommand[];
  estimateExecutionTime(commands: ParsedCommand[]): number;
}

export interface CommandExecutor {
  executeCommand(sessionId: string, command: ParsedCommand): Promise<ExecutionResult>;
  executeCommands(sessionId: string, commands: ParsedCommand[]): Promise<ExecutionResult[]>;
  validateExecution(result: ExecutionResult): boolean;
  handleExecutionError(command: ParsedCommand, error: any): ExecutionResult;
}

// Event Emitter Interface
export interface ITaskLoopEventEmitter {
  on(event: TaskLoopEventType, listener: (event: TaskLoopEvent) => void): void;
  emit(event: TaskLoopEventType, data: TaskLoopEvent): void;
  removeListener(event: TaskLoopEventType, listener: Function): void;
}

// Cache Types
export interface ResponseCache {
  get(key: string): ParsedActionResponse | ParsedReflectionResponse | null;
  set(key: string, response: ParsedActionResponse | ParsedReflectionResponse, ttlMs?: number): void;
  delete(key: string): boolean;
  clear(): void;
  getStats(): CacheStats;
}

export interface CacheStats {
  totalEntries: number;
  hitRate: number;
  memoryUsage: number;
  averageResponseTime: number;
}

// Utility Types
export type ExecutionPhaseKey = keyof typeof ExecutionPhase;
export type TaskLoopErrorTypeKey = keyof typeof TaskLoopErrorType;
export type TaskLoopEventTypeKey = keyof typeof TaskLoopEventType;
export type DecisionActionKey = keyof typeof DecisionAction;

// Constants
export const TASK_LOOP_VERSION = '1.0.0';
export const DEFAULT_MAX_ITERATIONS = 5;
export const DEFAULT_TIMEOUT_MS = 30 * 1000; // 30 seconds
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.7;
export const DEFAULT_REFLECTION_THRESHOLD = 0.6;
export const DEFAULT_MAX_RETRIES = 3;

// Processing Constants
export const PROCESSING_LIMITS = {
  MAX_COMMANDS_PER_STEP: 10,
  MAX_REFLECTION_CYCLES: 3,
  MAX_STEP_CONTENT_LENGTH: 2000,
  MAX_REASONING_LENGTH: 5000,
  MAX_CONCURRENT_COMMANDS: 5
} as const;

// Confidence Thresholds
export const CONFIDENCE_LEVELS = {
  HIGH: 0.8,
  MEDIUM: 0.5,
  LOW: 0.3,
  CRITICAL: 0.9
} as const;

// Phase Timeouts (milliseconds)
export const PHASE_TIMEOUTS = {
  GENERATING_PROMPT: 10000,
  QUERYING_AI: 30000,
  PROCESSING_RESPONSE: 5000,
  EXECUTING_ACTION: 60000,
  REFLECTING: 20000,
  VALIDATING: 10000
} as const;
