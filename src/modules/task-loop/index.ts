import { v4 as uuidv4 } from 'uuid';
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
  CommandAction,
  ErrorCategory,
  ErrorSeverity
} from '../../types/shared-types';

import {
  ITaskLoop,
  ExecutionState,
  ExecutionPhase,
  ReflectionData,
  DecisionAction,
  RiskAssessment,
  InvestigationState,
  InvestigationPhaseRequest,
  InvestigationPhaseResult,
  InvestigationToolRequest,
  InvestigationToolResult,
  InvestigationToolParameters,
  PageInvestigationContext,
  InvestigationOptions,
  ElementKnowledge,
  InvestigationOutput,
  InvestigationStrategy,
  SuggestedInvestigation,
  InvestigationPriority,
  WorkingMemoryUpdate,
  WorkingMemoryState,
  InvestigationResult,
  InvestigationInput,
  NavigationPattern,
  VariableContext,
  SuccessPattern,
  FailurePattern,
  InvestigationPreferences,
  ActResult,
  ReflectResult,
  InvestigationCycleResult,
  InvestigationContextSummary,
  TaskLoopConfig,
  PromptOptions,
  LoopMetrics,
  TaskLoopErrorType,
  TaskLoopError,
  AIIntegrationInterface,
  AIRequest,
  AIMessage,
  AIParameters,
  ExecutorInterface,
  AIContextManagerInterface,
  AIPromptManagerInterface,
  ActionPromptRequest,
  ReflectionPromptRequest,
  InvestigationPromptRequest,
  ActionWithInvestigationRequest,
  GeneratedPrompt,
  DEFAULT_TASK_LOOP_CONFIG
} from './types';

import { Logger } from './logger';
import { TaskLoopErrorHandler } from './error-handler';

/**
 * Task Loop module implementation
 * Implements the core ACT-REFLECT cycle for AI-driven web automation with sophisticated page investigation capabilities
 */
export class TaskLoop implements ITaskLoop {
  readonly moduleId = 'task-loop' as const;
  
  private sessions: Map<string, TaskLoopSession> = new Map();
  private config: TaskLoopConfig;
  private logger: Logger;
  private errorHandler: TaskLoopErrorHandler;
  private lifecycleCallbacks?: SessionLifecycleCallbacks;
  private eventPublisher?: IEventPublisher;
  
  // Injected dependencies
  private aiIntegration?: AIIntegrationInterface;
  private executor?: ExecutorInterface;
  private contextManager?: AIContextManagerInterface;
  private promptManager?: AIPromptManagerInterface;
  
  constructor(config: TaskLoopConfig = DEFAULT_TASK_LOOP_CONFIG) {
    this.config = config;
    this.logger = new Logger(config.logging);
    this.errorHandler = new TaskLoopErrorHandler(this.logger);
    
    this.logger.info('TaskLoop module initialized', { 
      moduleId: this.moduleId, 
      version: config.version 
    });
  }

  // ============================================================================
  // DEPENDENCY INJECTION
  // ============================================================================

  async initialize(container: DIContainer): Promise<void> {
    try {
      this.logger.info('Initializing TaskLoop dependencies');
      
      this.aiIntegration = container.resolve<AIIntegrationInterface>(DEPENDENCY_TOKENS.AI_INTEGRATION);
      this.executor = container.resolve<ExecutorInterface>(DEPENDENCY_TOKENS.EXECUTOR);
      this.contextManager = container.resolve<AIContextManagerInterface>(DEPENDENCY_TOKENS.CONTEXT_MANAGER);
      this.promptManager = container.resolve<AIPromptManagerInterface>(DEPENDENCY_TOKENS.PROMPT_MANAGER);
      
      this.logger.info('TaskLoop dependencies initialized successfully');
    } catch (error) {
      const taskLoopError = this.errorHandler.createStandardError(
        TaskLoopErrorType.VALIDATION_ERROR,
        'Failed to initialize TaskLoop dependencies',
        { error: error instanceof Error ? error.message : String(error) },
        error instanceof Error ? error : undefined
      );
      this.logger.error('TaskLoop initialization failed', taskLoopError);
      throw taskLoopError;
    }
  }

  // ============================================================================
  // SESSION MANAGEMENT (ISessionManager Implementation)
  // ============================================================================

  async createSession(workflowSessionId: string, config?: ModuleSessionConfig): Promise<string> {
    try {
      this.logger.info('Creating TaskLoop session', { workflowSessionId });
      
      if (this.sessions.has(workflowSessionId)) {
        throw this.errorHandler.createStandardError(
          TaskLoopErrorType.VALIDATION_ERROR,
          'Session already exists',
          { workflowSessionId }
        );
      }

      const session: TaskLoopSession = {
        moduleId: this.moduleId,
        sessionId: uuidv4(),
        linkedWorkflowSessionId: workflowSessionId,
        status: SessionStatus.INITIALIZING,
        createdAt: new Date(),
        lastActivity: new Date(),
        metadata: config?.metadata || {},
        executionStates: new Map(),
        metrics: this.initializeMetrics(workflowSessionId)
      };

      this.sessions.set(workflowSessionId, session);
      
      // Update status to active
      await this.updateSessionStatus(workflowSessionId, SessionStatus.ACTIVE);
      await this.recordActivity(workflowSessionId);
      
      // Call lifecycle callback
      if (this.lifecycleCallbacks?.onSessionCreated) {
        await this.lifecycleCallbacks.onSessionCreated(this.moduleId, workflowSessionId, session.sessionId);
      }
      
      this.logger.info('TaskLoop session created successfully', { 
        workflowSessionId, 
        sessionId: session.sessionId 
      });
      
      return session.sessionId;
    } catch (error) {
      const taskLoopError = this.errorHandler.wrapError(
        error,
        TaskLoopErrorType.CONTEXT_STORAGE_ERROR,
        'Failed to create TaskLoop session',
        { workflowSessionId }
      );
      this.logger.error('Session creation failed', taskLoopError);
      throw taskLoopError;
    }
  }

  async destroySession(workflowSessionId: string): Promise<void> {
    try {
      this.logger.info('Destroying TaskLoop session', { workflowSessionId });
      
      const session = this.sessions.get(workflowSessionId);
      if (!session) {
        this.logger.warn('Attempting to destroy non-existent session', { workflowSessionId });
        return;
      }

      // Update status to cleanup
      await this.updateSessionStatus(workflowSessionId, SessionStatus.CLEANUP);
      
      // Call lifecycle callback
      if (this.lifecycleCallbacks?.onSessionDestroyed) {
        await this.lifecycleCallbacks.onSessionDestroyed(this.moduleId, workflowSessionId);
      }
      
      // Remove session
      this.sessions.delete(workflowSessionId);
      
      this.logger.info('TaskLoop session destroyed successfully', { workflowSessionId });
    } catch (error) {
      const taskLoopError = this.errorHandler.wrapError(
        error,
        TaskLoopErrorType.CONTEXT_STORAGE_ERROR,
        'Failed to destroy TaskLoop session',
        { workflowSessionId }
      );
      this.logger.error('Session destruction failed', taskLoopError);
      throw taskLoopError;
    }
  }

  getSession(workflowSessionId: string): ModuleSessionInfo | null {
    const session = this.sessions.get(workflowSessionId);
    if (!session) {
      return null;
    }

    return {
      moduleId: session.moduleId,
      sessionId: session.sessionId,
      linkedWorkflowSessionId: session.linkedWorkflowSessionId,
      status: session.status,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      metadata: session.metadata
    };
  }

  sessionExists(workflowSessionId: string): boolean {
    return this.sessions.has(workflowSessionId);
  }

  async updateSessionStatus(workflowSessionId: string, status: SessionStatus): Promise<void> {
    const session = this.sessions.get(workflowSessionId);
    if (!session) {
      throw this.errorHandler.createStandardError(
        TaskLoopErrorType.VALIDATION_ERROR,
        'Session not found',
        { workflowSessionId }
      );
    }

    const oldStatus = session.status;
    session.status = status;
    session.lastActivity = new Date();
    
    // Call lifecycle callback
    if (this.lifecycleCallbacks?.onSessionStatusChanged) {
      await this.lifecycleCallbacks.onSessionStatusChanged(this.moduleId, workflowSessionId, oldStatus, status);
    }
    
    this.logger.debug('Session status updated', { 
      workflowSessionId, 
      oldStatus, 
      newStatus: status 
    });
  }

  getSessionStatus(workflowSessionId: string): SessionStatus | null {
    const session = this.sessions.get(workflowSessionId);
    return session ? session.status : null;
  }

  async recordActivity(workflowSessionId: string): Promise<void> {
    const session = this.sessions.get(workflowSessionId);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  getLastActivity(workflowSessionId: string): Date | null {
    const session = this.sessions.get(workflowSessionId);
    return session ? session.lastActivity : null;
  }

  setLifecycleCallbacks(callbacks: SessionLifecycleCallbacks): void {
    this.lifecycleCallbacks = callbacks;
  }

  async healthCheck(): Promise<SessionManagerHealth> {
    const activeSessions = Array.from(this.sessions.values()).filter(
      session => session.status === SessionStatus.ACTIVE
    ).length;

    return {
      moduleId: this.moduleId,
      isHealthy: true,
      activeSessions,
      totalSessions: this.sessions.size,
      errors: [],
      lastHealthCheck: new Date()
    };
  }

  // ============================================================================
  // EVENT PUBLISHING
  // ============================================================================

  setEventPublisher(publisher: IEventPublisher): void {
    this.eventPublisher = publisher;
    this.logger.debug('Event publisher set');
  }

  private async publishEvent(event: TaskLoopEvent): Promise<void> {
    if (this.eventPublisher) {
      try {
        await this.eventPublisher.publishEvent(event);
      } catch (error) {
        this.logger.warn('Failed to publish event', { 
          eventType: event.type, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }
  }

  private async publishPhaseUpdate(sessionId: string, stepIndex: number, state: ExecutionState): Promise<void> {
    const event: TaskLoopEvent = {
      type: TaskLoopEventType.STEP_STARTED,
      sessionId,
      stepIndex,
      data: {
        progress: {
          sessionId,
          totalSteps: 0, // Will be filled by Step Processor
          completedSteps: 0,
          currentStepIndex: stepIndex,
          currentStepName: state.phase,
          overallProgress: 0,
          averageStepDuration: 0,
          lastActivity: new Date()
        }
      },
      timestamp: new Date()
    };
    
    await this.publishEvent(event);
  }

  private async publishAIReasoning(sessionId: string, stepIndex: number, aiResponse: AIResponse): Promise<void> {
    const event: TaskLoopEvent = {
      type: TaskLoopEventType.AI_REASONING_UPDATE,
      sessionId,
      stepIndex,
      data: {
        reasoning: {
          content: aiResponse.reasoning.analysis,
          confidence: aiResponse.reasoning.confidence
        }
      },
      timestamp: new Date()
    };
    
    await this.publishEvent(event);
  }

  private async publishCommandExecution(sessionId: string, stepIndex: number, command: ExecutorCommand, result: CommandResponse): Promise<void> {
    const event: TaskLoopEvent = {
      type: TaskLoopEventType.COMMAND_EXECUTED,
      sessionId,
      stepIndex,
      data: {
        command: {
          command,
          result
        }
      },
      timestamp: new Date()
    };
    
    await this.publishEvent(event);
  }

  // ============================================================================
  // MAIN PROCESSING - ACT-REFLECT CYCLE
  // ============================================================================

  async processStep(request: TaskLoopStepRequest): Promise<StepResult> {
    const { sessionId, stepIndex, stepContent, streamId } = request;
    const executionState = this.initializeExecutionState(request);
    
    try {
      this.logger.info('Starting step processing', { 
        sessionId, 
        stepIndex, 
        stepContent: stepContent.substring(0, 100) + '...' 
      });
      
      await this.recordActivity(sessionId);
      
      // Store execution state
      const session = this.getTaskLoopSession(sessionId);
      session.executionStates.set(stepIndex, executionState);
      
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
      
      const result = this.buildStepProcessingResult(sessionId, stepIndex, executionState);
      
      // Publish completion event
      const completionEvent: TaskLoopEvent = {
        type: TaskLoopEventType.STEP_COMPLETED,
        sessionId,
        stepIndex,
        data: {
          result
        },
        timestamp: new Date()
      };
      await this.publishEvent(completionEvent);
      
      this.logger.info('Step processing completed', { 
        sessionId, 
        stepIndex, 
        success: result.success 
      });
      
      return result;
      
    } catch (error) {
      const result = this.handleProcessingError(sessionId, stepIndex, error, executionState);
      
      // Publish failure event
      const failureEvent: TaskLoopEvent = {
        type: TaskLoopEventType.STEP_FAILED,
        sessionId,
        stepIndex,
        data: {
          error: result.error
        },
        timestamp: new Date()
      };
      await this.publishEvent(failureEvent);
      
      this.logger.error('Step processing failed', { 
        sessionId, 
        stepIndex, 
        error: result.error 
      });
      
      return result;
    }
  }

  // ============================================================================
  // ENHANCED ACT PHASE WITH INVESTIGATION
  // ============================================================================

  private async executeEnhancedActPhase(sessionId: string, stepIndex: number, stepContent: string, state: ExecutionState): Promise<ActResult> {
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

  // ============================================================================
  // INVESTIGATION CYCLE IMPLEMENTATION
  // ============================================================================

  async executeInvestigationCycle(sessionId: string, stepIndex: number, stepContent: string, options: InvestigationOptions): Promise<InvestigationCycleResult> {
    const investigationState = this.initializeInvestigationState(options);
    const investigationContext = await this.buildInvestigationContext(sessionId, stepIndex, stepContent);
    
    try {
      this.logger.info('Starting investigation cycle', { sessionId, stepIndex });
      
      // Phase 1: Initial Assessment
      investigationState.currentPhase = InvestigationPhase.INITIAL_ASSESSMENT;
      const initialResult = await this.processInvestigationPhase({
        sessionId, stepIndex, stepContent,
        phase: InvestigationPhase.INITIAL_ASSESSMENT,
        investigationOptions: options,
        context: investigationContext
      });
      
      // Phase 2: Focused Exploration  
      investigationState.currentPhase = InvestigationPhase.FOCUSED_EXPLORATION;
      const explorationResult = await this.processInvestigationPhase({
        sessionId, stepIndex, stepContent,
        phase: InvestigationPhase.FOCUSED_EXPLORATION,
        investigationOptions: options,
        context: investigationContext
      });
      
      // Phase 3: Selector Determination
      investigationState.currentPhase = InvestigationPhase.SELECTOR_DETERMINATION;
      const determinationResult = await this.processInvestigationPhase({
        sessionId, stepIndex, stepContent,
        phase: InvestigationPhase.SELECTOR_DETERMINATION,
        investigationOptions: options,
        context: investigationContext
      });
      
      // Store investigation results and update working memory
      await this.storeInvestigationResults(sessionId, stepIndex, investigationState);
      await this.updateWorkingMemoryFromInvestigation(sessionId, stepIndex, investigationState);
      
      this.logger.info('Investigation cycle completed successfully', { sessionId, stepIndex });
      
      return {
        success: true,
        investigationState,
        investigationContext,
        readyForAction: determinationResult.readyForAction,
        totalDuration: Date.now() - investigationState.startTime.getTime()
      };
      
    } catch (error) {
      this.logger.error('Investigation cycle failed', { sessionId, stepIndex, error });
      
      return {
        success: false,
        investigationState,
        investigationContext,
        readyForAction: false,
        totalDuration: Date.now() - investigationState.startTime.getTime(),
        error: this.errorHandler.wrapError(error, TaskLoopErrorType.INVESTIGATION_CYCLE_FAILED, 'Investigation cycle failed')
      };
    }
  }

  async processInvestigationPhase(request: InvestigationPhaseRequest): Promise<InvestigationPhaseResult> {
    const { sessionId, stepIndex, stepContent, phase, investigationOptions, context } = request;
    const startTime = Date.now();
    
    try {
      this.logger.info('Processing investigation phase', { sessionId, stepIndex, phase });
      
      // Publish investigation phase start event
      const startEvent: TaskLoopEvent = {
        type: TaskLoopEventType.INVESTIGATION_PHASE_STARTED,
        sessionId,
        stepIndex,
        data: {
          investigation: {
            phase: this.mapInvestigationPhaseToString(phase),
            toolsUsed: [],
            elementsDiscovered: 0,
            confidence: 0
          }
        },
        timestamp: new Date()
      };
      await this.publishEvent(startEvent);
      
      // Generate investigation prompt
      if (!this.promptManager) {
        throw this.errorHandler.createStandardError(
          TaskLoopErrorType.VALIDATION_ERROR,
          'Prompt manager not initialized'
        );
      }
      
      const investigationPrompt = await this.promptManager.generateInvestigationPrompt({
        sessionId,
        stepIndex,
        stepContent,
        investigationPhase: phase,
        availableTools: investigationOptions?.preferredTools || this.config.investigation.enabledTools,
        investigationOptions
      });
      
      // Execute investigation tools based on phase
      const toolsToExecute = this.selectInvestigationTools(phase, investigationOptions);
      const toolResults: InvestigationToolResult[] = [];
      const elementsDiscovered: ElementDiscovery[] = [];
      
      for (const tool of toolsToExecute) {
        const toolResult = await this.executeInvestigationTool({
          sessionId,
          stepIndex,
          tool,
          parameters: this.getToolParameters(tool, phase),
          context
        });
        
        toolResults.push(toolResult);
        
        if (toolResult.elementsDiscovered) {
          elementsDiscovered.push(...toolResult.elementsDiscovered);
        }
      }
      
      // Calculate overall confidence
      const overallConfidence = toolResults.reduce((sum, result) => sum + result.confidence, 0) / toolResults.length;
      
      // Determine readiness for action
      const readyForAction = this.determineActionReadiness(phase, toolResults, overallConfidence);
      
      // Publish investigation phase completion event
      const completionEvent: TaskLoopEvent = {
        type: TaskLoopEventType.INVESTIGATION_PHASE_COMPLETED,
        sessionId,
        stepIndex,
        data: {
          investigation: {
            phase: this.mapInvestigationPhaseToString(phase),
            toolsUsed: toolsToExecute.map(tool => tool.toString()),
            elementsDiscovered: elementsDiscovered.length,
            confidence: overallConfidence,
            duration: Date.now() - startTime,
            readyForAction
          }
        },
        timestamp: new Date()
      };
      await this.publishEvent(completionEvent);
      
      this.logger.info('Investigation phase completed', { 
        sessionId, 
        stepIndex, 
        phase, 
        confidence: overallConfidence, 
        readyForAction 
      });
      
      return {
        success: true,
        phase,
        toolsExecuted: toolsToExecute,
        elementsDiscovered,
        pageInsight: await this.generatePageInsight(toolResults),
        workingMemoryUpdates: this.generateWorkingMemoryUpdates(toolResults),
        nextPhaseRecommendation: this.recommendNextPhase(phase, overallConfidence),
        readyForAction,
        confidence: overallConfidence,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      this.logger.error('Investigation phase failed', { sessionId, stepIndex, phase, error });
      
      return {
        success: false,
        phase,
        toolsExecuted: [],
        elementsDiscovered: [],
        readyForAction: false,
        confidence: 0,
        duration: Date.now() - startTime,
        error: this.errorHandler.wrapError(error, TaskLoopErrorType.INVESTIGATION_PHASE_FAILED, `Investigation phase ${phase} failed`)
      };
    }
  }

  async executeInvestigationTool(request: InvestigationToolRequest): Promise<InvestigationToolResult> {
    const { sessionId, stepIndex, tool, parameters, context } = request;
    const startTime = Date.now();
    
    try {
      this.logger.info('Executing investigation tool', { sessionId, stepIndex, tool });
      
      // Publish investigation tool start event
      const startEvent: TaskLoopEvent = {
        type: TaskLoopEventType.INVESTIGATION_TOOL_STARTED,
        sessionId,
        stepIndex,
        data: {
          investigationTool: {
            tool: tool.toString(),
            success: false,
            confidence: 0,
            duration: 0
          }
        },
        timestamp: new Date()
      };
      await this.publishEvent(startEvent);
      
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
          throw this.errorHandler.createStandardError(
            TaskLoopErrorType.UNSUPPORTED_INVESTIGATION_TOOL,
            `Unsupported investigation tool: ${tool}`,
            { tool, parameters }
          );
      }
      
      const result: InvestigationToolResult = {
        success: true,
        tool,
        output: toolResult.output || {},
        elementsDiscovered: toolResult.elementsDiscovered,
        pageInsightUpdates: toolResult.pageInsightUpdates,
        workingMemoryUpdates: toolResult.workingMemoryUpdates,
        confidence: toolResult.confidence || 0.8,
        duration: Date.now() - startTime
      };
      
      // Publish investigation tool completion event
      const completionEvent: TaskLoopEvent = {
        type: TaskLoopEventType.INVESTIGATION_TOOL_COMPLETED,
        sessionId,
        stepIndex,
        data: {
          investigationTool: {
            tool: tool.toString(),
            success: true,
            confidence: result.confidence,
            duration: result.duration,
            elementsFound: result.elementsDiscovered?.length || 0,
            summary: result.output.summary
          }
        },
        timestamp: new Date()
      };
      await this.publishEvent(completionEvent);
      
      this.logger.info('Investigation tool executed successfully', { 
        sessionId, 
        stepIndex, 
        tool, 
        confidence: result.confidence 
      });
      
      return result;
      
    } catch (error) {
      this.logger.error('Investigation tool execution failed', { sessionId, stepIndex, tool, error });
      
      return {
        success: false,
        tool,
        output: {},
        confidence: 0,
        duration: Date.now() - startTime,
        error: this.errorHandler.wrapError(error, TaskLoopErrorType.INVESTIGATION_TOOL_FAILED, `Investigation tool ${tool} failed`)
      };
    }
  }

  // ============================================================================
  // INVESTIGATION TOOL IMPLEMENTATIONS
  // ============================================================================

  private async executeScreenshotAnalysis(sessionId: string, parameters?: InvestigationToolParameters): Promise<Partial<InvestigationToolResult>> {
    if (!this.executor) {
      throw this.errorHandler.createStandardError(
        TaskLoopErrorType.VALIDATION_ERROR,
        'Executor not initialized'
      );
    }
    
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
    if (!this.executor) {
      throw this.errorHandler.createStandardError(
        TaskLoopErrorType.VALIDATION_ERROR,
        'Executor not initialized'
      );
    }
    
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
    if (!this.executor) {
      throw this.errorHandler.createStandardError(
        TaskLoopErrorType.VALIDATION_ERROR,
        'Executor not initialized'
      );
    }
    
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
    if (!this.executor) {
      throw this.errorHandler.createStandardError(
        TaskLoopErrorType.VALIDATION_ERROR,
        'Executor not initialized'
      );
    }
    
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

  // ============================================================================
  // HELPER METHODS AND UTILITIES
  // ============================================================================

  private getTaskLoopSession(sessionId: string): TaskLoopSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw this.errorHandler.createStandardError(
        TaskLoopErrorType.VALIDATION_ERROR,
        'Session not found',
        { sessionId }
      );
    }
    return session;
  }

  private initializeExecutionState(request: TaskLoopStepRequest): ExecutionState {
    return {
      phase: ExecutionPhase.INITIALIZING,
      currentIteration: 0,
      maxIterations: request.options?.maxIterations || this.config.execution.maxIterations,
      startTime: new Date()
    };
  }

  private initializeInvestigationState(options: InvestigationOptions): InvestigationState {
    return {
      currentPhase: InvestigationPhase.INITIAL_ASSESSMENT,
      phasesCompleted: [],
      investigationRound: 0,
      maxInvestigationRounds: options.maxInvestigationRounds,
      toolsUsed: [],
      elementsDiscovered: [],
      startTime: new Date(),
      phaseStartTime: new Date()
    };
  }

  private initializeMetrics(sessionId: string): LoopMetrics {
    return {
      sessionId,
      totalSteps: 0,
      completedSteps: 0,
      totalIterations: 0,
      averageIterationsPerStep: 0,
      successRate: 0,
      averageExecutionTime: 0,
      aiResponseTime: 0,
      executorResponseTime: 0,
      reflectionUsage: 0,
      errorBreakdown: {}
    };
  }

  private getInvestigationOptions(state: ExecutionState): InvestigationOptions {
    return {
      enableInvestigation: this.config.investigation.enabled,
      maxInvestigationRounds: this.config.investigation.maxInvestigationRounds,
      confidenceThreshold: this.config.investigation.confidenceThreshold,
      preferredTools: this.config.investigation.enabledTools,
      contextManagementApproach: this.config.investigation.contextManagementApproach,
      enableWorkingMemory: this.config.investigation.enableWorkingMemory,
      enableElementKnowledge: this.config.investigation.enableElementKnowledge,
      enableProgressiveContext: this.config.investigation.enableProgressiveContext,
      investigationTimeoutMs: this.config.investigation.investigationTimeoutMs
    };
  }

  private isExecutionComplete(state: ExecutionState): boolean {
    return state.phase === ExecutionPhase.COMPLETED || state.phase === ExecutionPhase.FAILED;
  }

  private shouldReflect(actResult: ActResult): boolean {
    // Implement reflection decision logic
    return !actResult.success || actResult.aiResponse.reasoning.confidence < this.config.execution.reflectionThreshold;
  }

  private async buildInvestigationContext(sessionId: string, stepIndex: number, stepContent: string): Promise<PageInvestigationContext> {
    if (!this.contextManager) {
      throw this.errorHandler.createStandardError(
        TaskLoopErrorType.VALIDATION_ERROR,
        'Context manager not initialized'
      );
    }
    
    return {
      sessionId,
      stepIndex,
      stepObjective: stepContent,
      currentUrl: '', // TODO: Get from executor
      previousInvestigations: [],
      elementsKnown: [],
      workingMemory: this.contextManager.getWorkingMemory(sessionId),
      investigationStrategy: this.generateInvestigationStrategy(),
      contextSize: 0,
      maxContextSize: this.config.investigation.maxContextSize
    };
  }

  private generateInvestigationStrategy(): InvestigationStrategy {
    return {
      currentPhase: 'initial_assessment',
      recommendedInvestigations: [],
      investigationPriority: {
        primary: InvestigationTool.SCREENSHOT_ANALYSIS,
        fallbacks: [InvestigationTool.TEXT_EXTRACTION, InvestigationTool.SUB_DOM_EXTRACTION],
        reasoning: 'Start with visual understanding, then drill down'
      },
      contextManagementApproach: this.config.investigation.contextManagementApproach,
      confidenceThreshold: this.config.investigation.confidenceThreshold,
      maxInvestigationRounds: this.config.investigation.maxInvestigationRounds
    };
  }

  private selectInvestigationTools(phase: InvestigationPhase, options?: InvestigationOptions): InvestigationTool[] {
    const preferredTools = options?.preferredTools || this.config.investigation.toolPriorityOrder;
    
    switch (phase) {
      case InvestigationPhase.INITIAL_ASSESSMENT:
        return [InvestigationTool.SCREENSHOT_ANALYSIS];
      case InvestigationPhase.FOCUSED_EXPLORATION:
        return [InvestigationTool.TEXT_EXTRACTION, InvestigationTool.SUB_DOM_EXTRACTION];
      case InvestigationPhase.SELECTOR_DETERMINATION:
        return [InvestigationTool.SUB_DOM_EXTRACTION, InvestigationTool.FULL_DOM_RETRIEVAL];
      default:
        return [preferredTools[0]];
    }
  }

  private getToolParameters(tool: InvestigationTool, phase: InvestigationPhase): InvestigationToolParameters {
    const baseParams: InvestigationToolParameters = {};
    
    switch (tool) {
      case InvestigationTool.TEXT_EXTRACTION:
        baseParams.maxTextLength = 5000;
        baseParams.includeHiddenText = false;
        break;
      case InvestigationTool.SUB_DOM_EXTRACTION:
        baseParams.maxDomSize = 50000;
        baseParams.includeStyles = false;
        break;
      case InvestigationTool.FULL_DOM_RETRIEVAL:
        baseParams.maxDomSize = 100000;
        break;
    }
    
    return baseParams;
  }

  private determineActionReadiness(phase: InvestigationPhase, toolResults: InvestigationToolResult[], confidence: number): boolean {
    if (phase === InvestigationPhase.SELECTOR_DETERMINATION && confidence >= this.config.investigation.confidenceThreshold) {
      return true;
    }
    return false;
  }

  private async generatePageInsight(toolResults: InvestigationToolResult[]): Promise<PageInsight | undefined> {
    // Implement page insight generation from tool results
    return undefined;
  }

  private generateWorkingMemoryUpdates(toolResults: InvestigationToolResult[]): WorkingMemoryUpdate[] {
    const updates: WorkingMemoryUpdate[] = [];
    
    for (const result of toolResults) {
      if (result.elementsDiscovered) {
        for (const element of result.elementsDiscovered) {
          updates.push({
            updateType: 'element_discovery',
            data: element,
            confidence: element.confidence,
            source: `investigation_tool_${result.tool}`
          });
        }
      }
    }
    
    return updates;
  }

  private recommendNextPhase(currentPhase: InvestigationPhase, confidence: number): InvestigationPhase | undefined {
    if (confidence < this.config.investigation.confidenceThreshold) {
      return currentPhase; // Retry current phase
    }
    
    switch (currentPhase) {
      case InvestigationPhase.INITIAL_ASSESSMENT:
        return InvestigationPhase.FOCUSED_EXPLORATION;
      case InvestigationPhase.FOCUSED_EXPLORATION:
        return InvestigationPhase.SELECTOR_DETERMINATION;
      default:
        return undefined;
    }
  }

  private mapInvestigationPhaseToString(phase: InvestigationPhase): 'initial_assessment' | 'focused_exploration' | 'selector_determination' {
    switch (phase) {
      case InvestigationPhase.INITIAL_ASSESSMENT:
        return 'initial_assessment';
      case InvestigationPhase.FOCUSED_EXPLORATION:
        return 'focused_exploration';
      case InvestigationPhase.SELECTOR_DETERMINATION:
        return 'selector_determination';
      default:
        return 'initial_assessment';
    }
  }

  // ============================================================================
  // TRADITIONAL ACT AND REFLECT PHASES (Stub implementations)
  // ============================================================================

  private async executeActPhase(sessionId: string, stepIndex: number, stepContent: string, state: ExecutionState): Promise<ActResult> {
    // TODO: Implement traditional ACT phase
    throw new Error('Traditional ACT phase not yet implemented');
  }

  private async executeActionWithInvestigationContext(sessionId: string, stepIndex: number, stepContent: string, investigationResult: InvestigationCycleResult, state: ExecutionState): Promise<ActResult> {
    // TODO: Implement action execution with investigation context
    throw new Error('Action with investigation context not yet implemented');
  }

  private async executeReflectPhase(sessionId: string, stepIndex: number, actResult: ActResult, state: ExecutionState): Promise<ReflectResult> {
    // TODO: Implement REFLECT phase
    throw new Error('REFLECT phase not yet implemented');
  }

  private async storeInvestigationResults(sessionId: string, stepIndex: number, investigationState: InvestigationState): Promise<void> {
    // TODO: Implement investigation results storage
  }

  private async updateWorkingMemoryFromInvestigation(sessionId: string, stepIndex: number, investigationState: InvestigationState): Promise<void> {
    // TODO: Implement working memory updates from investigation
  }

  private buildStepProcessingResult(sessionId: string, stepIndex: number, executionState: ExecutionState): StepResult {
    // TODO: Implement step result building
    return {
      stepIndex,
      success: executionState.phase === ExecutionPhase.COMPLETED,
      executedCommands: executionState.lastCommands || [],
      commandResults: [],
      aiReasoning: executionState.aiResponse?.reasoning.analysis || '',
      duration: Date.now() - executionState.startTime.getTime(),
      error: executionState.error,
      finalPageState: {
        dom: '',
        screenshotId: '',
        url: ''
      }
    };
  }

  private handleProcessingError(sessionId: string, stepIndex: number, error: any, executionState: ExecutionState): StepResult {
    const taskLoopError = this.errorHandler.wrapError(error, TaskLoopErrorType.COMMAND_EXECUTION_ERROR, 'Step processing failed');
    
    return {
      stepIndex,
      success: false,
      executedCommands: [],
      commandResults: [],
      aiReasoning: '',
      duration: Date.now() - executionState.startTime.getTime(),
      error: taskLoopError,
      finalPageState: {
        dom: '',
        screenshotId: '',
        url: ''
      }
    };
  }

  // ============================================================================
  // FLOW CONTROL AND MONITORING (Stub implementations)
  // ============================================================================

  async pauseExecution(workflowSessionId: string, stepIndex: number): Promise<void> {
    // TODO: Implement execution pausing
  }

  async resumeExecution(workflowSessionId: string, stepIndex: number): Promise<void> {
    // TODO: Implement execution resuming
  }

  async cancelExecution(workflowSessionId: string, stepIndex: number): Promise<void> {
    // TODO: Implement execution cancellation
  }

  async pauseInvestigation(workflowSessionId: string, stepIndex: number): Promise<void> {
    // TODO: Implement investigation pausing
  }

  async resumeInvestigation(workflowSessionId: string, stepIndex: number): Promise<void> {
    // TODO: Implement investigation resuming
  }

  async getExecutionState(workflowSessionId: string, stepIndex: number): Promise<ExecutionState> {
    const session = this.getTaskLoopSession(workflowSessionId);
    const state = session.executionStates.get(stepIndex);
    
    if (!state) {
      throw this.errorHandler.createStandardError(
        TaskLoopErrorType.VALIDATION_ERROR,
        'Execution state not found',
        { workflowSessionId, stepIndex }
      );
    }
    
    return state;
  }

  async getLoopMetrics(workflowSessionId: string): Promise<LoopMetrics> {
    const session = this.getTaskLoopSession(workflowSessionId);
    return session.metrics;
  }
}

// ============================================================================
// SESSION DATA STRUCTURE
// ============================================================================

interface TaskLoopSession extends ModuleSessionInfo {
  moduleId: 'task-loop';
  executionStates: Map<number, ExecutionState>;
  metrics: LoopMetrics;
}

export default TaskLoop;
