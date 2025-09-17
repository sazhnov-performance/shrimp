/**
 * Context Integrator
 * 
 * Integrates with AI Context Manager to build context sections for prompts
 * Handles traditional context, filtered context, and investigation context
 */

import {
  ContextSection,
  StepContext,
  ExecutionHistorySection,
  PageStateSection,
  FilteredContextSection,
  InvestigationHistorySection,
  WorkingMemorySection,
  ContextConfig,
  PromptOptions,
  InvestigationPhase,
  ContextManagerIntegration,
  ContextFilterOptions,
  PromptManagerError,
  PromptManagerErrorType
} from '../../../types/ai-prompt-manager';

export class ContextIntegrator {
  private config: ContextConfig;
  private contextManager?: ContextManagerIntegration;

  constructor(config: ContextConfig, contextManager?: ContextManagerIntegration) {
    this.config = config;
    this.contextManager = contextManager;
  }

  /**
   * Build standard context section
   */
  async buildContextSection(
    sessionId: string,
    stepIndex: number,
    options?: PromptOptions,
    overrides?: { includeExecutionHistory?: boolean; includeValidation?: boolean }
  ): Promise<ContextSection> {
    try {
      // Build current step context
      const currentStep = this.buildStepContext(stepIndex, options);

      // Build execution history if requested
      const executionHistory = overrides?.includeExecutionHistory !== false
        ? await this.buildExecutionHistorySection(sessionId, stepIndex, options)
        : this.createEmptyExecutionHistory();

      // Build page states section
      const pageStates = await this.buildPageStateSection(sessionId, stepIndex, options);

      // Build filtered context if enabled
      const filteredContext = options?.useFilteredContext && this.contextManager
        ? await this.buildFilteredContextSection(sessionId, stepIndex, options)
        : undefined;

      // Build investigation history if requested
      const investigationHistory = options?.includeInvestigationHistory && this.contextManager
        ? await this.buildInvestigationHistorySection(sessionId, stepIndex)
        : undefined;

      const contextSection: ContextSection = {
        currentStep,
        executionHistory,
        pageStates,
        filteredContext,
        investigationHistory,
        sessionMetadata: {
          sessionId,
          stepIndex,
          contextGeneratedAt: new Date(),
          useFilteredContext: options?.useFilteredContext || false
        }
      };

      return contextSection;
    } catch (error) {
      throw new PromptManagerError(
        `Failed to build context section: ${error.message}`,
        PromptManagerErrorType.CONTEXT_UNAVAILABLE,
        sessionId,
        stepIndex
      );
    }
  }

  /**
   * Build investigation-specific context section
   */
  async buildInvestigationContextSection(
    sessionId: string,
    stepIndex: number,
    investigationPhase: InvestigationPhase
  ): Promise<ContextSection> {
    try {
      const baseOptions: PromptOptions = {
        useFilteredContext: true,
        includeWorkingMemory: this.config.includeWorkingMemoryByDefault,
        includeInvestigationHistory: true,
        includeElementKnowledge: this.config.elementKnowledgeThreshold > 0,
        contextManagementApproach: 'standard'
      };

      const context = await this.buildContextSection(sessionId, stepIndex, baseOptions);

      // Enhance context for investigation
      context.currentStep.investigationPhase = investigationPhase;
      context.currentStep.stepType = 'investigation';

      return context;
    } catch (error) {
      throw new PromptManagerError(
        `Failed to build investigation context section: ${error.message}`,
        PromptManagerErrorType.INVESTIGATION_CONTEXT_UNAVAILABLE,
        sessionId,
        stepIndex
      );
    }
  }

  /**
   * Build context section with investigation results
   */
  async buildContextSectionWithInvestigation(
    sessionId: string,
    stepIndex: number,
    investigationContext: any
  ): Promise<ContextSection> {
    try {
      const baseContext = await this.buildContextSection(sessionId, stepIndex, {
        useFilteredContext: true,
        includeWorkingMemory: true,
        includeElementKnowledge: true,
        contextManagementApproach: 'comprehensive'
      });

      // Enhance with investigation results
      baseContext.currentStep.stepType = 'action_with_investigation';
      baseContext.sessionMetadata!.investigationContext = investigationContext;

      return baseContext;
    } catch (error) {
      throw new PromptManagerError(
        `Failed to build context with investigation: ${error.message}`,
        PromptManagerErrorType.INVESTIGATION_CONTEXT_UNAVAILABLE,
        sessionId,
        stepIndex
      );
    }
  }

  /**
   * Build working memory section
   */
  async buildWorkingMemorySection(sessionId: string): Promise<WorkingMemorySection | undefined> {
    try {
      if (!this.contextManager) {
        return undefined;
      }

      const workingMemory = this.contextManager.getWorkingMemory(sessionId);
      if (!workingMemory) {
        return undefined;
      }

      return {
        currentPageInsight: workingMemory.currentPageInsight ? {
          pageType: 'web_page',
          mainSections: ['header', 'main', 'footer'],
          keyElements: [],
          complexity: workingMemory.currentPageInsight.complexity || 'medium',
          navigationStructure: 'standard'
        } : undefined,
        knownElements: Array.from(workingMemory.knownElements.values()).map(element => ({
          selector: element.selector,
          elementType: element.elementType,
          purpose: element.purpose,
          reliability: element.reliability,
          lastValidated: element.lastSeen,
          alternativeSelectors: element.alternativeSelectors
        })),
        navigationPatterns: [],
        extractedVariables: Array.from(workingMemory.extractedVariables.values()).map(variable => ({
          name: variable.name,
          value: variable.value,
          source: variable.extractionMethod,
          reliability: variable.reliability
        })),
        successfulPatterns: workingMemory.successfulPatterns.map(pattern => ({
          pattern: pattern.pattern,
          context: pattern.context,
          reliability: pattern.successRate,
          frequency: pattern.usageCount
        })),
        failurePatterns: workingMemory.failurePatterns.map(pattern => ({
          pattern: pattern.pattern,
          context: pattern.context,
          reliability: 1 - (pattern.failureReasons.length / 10), // Simple calculation
          frequency: 1
        })),
        investigationPreferences: {
          preferredToolOrder: workingMemory.investigationPreferences.preferredOrder,
          qualityThresholds: workingMemory.investigationPreferences.qualityThresholds as Record<string, number>,
          adaptiveStrategies: []
        },
        memoryLastUpdated: workingMemory.lastUpdated,
        confidenceLevel: this.calculateOverallConfidence(workingMemory)
      };
    } catch (error) {
      // Working memory is optional, so we can gracefully handle errors
      console.warn(`Failed to build working memory section: ${error.message}`);
      return undefined;
    }
  }

  /**
   * Build step context
   */
  private buildStepContext(stepIndex: number, options?: PromptOptions): StepContext {
    return {
      stepIndex,
      stepContent: '', // Will be filled by caller
      stepType: stepIndex === 0 ? 'initial' : 'continuation',
      totalSteps: 0, // Will be determined from session context
      investigationPhase: undefined,
      currentInvestigationRound: undefined,
      maxInvestigationRounds: options?.maxInvestigationRounds || this.config.investigationHistoryDepth
    };
  }

  /**
   * Build execution history section
   */
  private async buildExecutionHistorySection(
    sessionId: string,
    stepIndex: number,
    options?: PromptOptions
  ): Promise<ExecutionHistorySection> {
    try {
      if (!this.contextManager) {
        return this.createEmptyExecutionHistory();
      }

      const maxSteps = options?.maxHistorySteps || this.config.maxHistoryItems;
      const stepHistory = await this.contextManager.getStepHistory(sessionId, maxSteps);

      return {
        previousSteps: stepHistory.map(step => ({
          stepIndex: step.stepIndex,
          stepName: step.stepName,
          reasoning: step.reasoning,
          executorMethod: step.executorMethod,
          status: step.status as any,
          timestamp: step.timestamp
        })),
        chronologicalEvents: [], // Would be built from detailed execution context
        successfulActions: stepHistory.filter(s => s.status === 'COMPLETED').length,
        failedActions: stepHistory.filter(s => s.status === 'FAILED').length
      };
    } catch (error) {
      console.warn(`Failed to build execution history: ${error.message}`);
      return this.createEmptyExecutionHistory();
    }
  }

  /**
   * Build page state section
   */
  private async buildPageStateSection(
    sessionId: string,
    stepIndex: number,
    options?: PromptOptions
  ): Promise<PageStateSection> {
    try {
      if (!this.contextManager) {
        return {};
      }

      const currentPageState = await this.contextManager.getCurrentPageState(sessionId);
      const previousPageState = stepIndex > 0 
        ? await this.contextManager.getPreviousPageState(sessionId, stepIndex - 1)
        : null;

      const pageStates: PageStateSection = {
        currentPageDom: this.config.maxDomSize > 0 && currentPageState.length <= this.config.maxDomSize
          ? currentPageState
          : undefined,
        previousPageDom: previousPageState && previousPageState.length <= this.config.maxDomSize
          ? previousPageState
          : undefined
      };

      // Add DOM comparison if both states are available
      if (pageStates.currentPageDom && pageStates.previousPageDom) {
        pageStates.domComparison = this.generateDomComparison(
          pageStates.previousPageDom,
          pageStates.currentPageDom
        );
      }

      return pageStates;
    } catch (error) {
      console.warn(`Failed to build page state section: ${error.message}`);
      return {};
    }
  }

  /**
   * Build filtered context section
   */
  private async buildFilteredContextSection(
    sessionId: string,
    stepIndex: number,
    options?: PromptOptions
  ): Promise<FilteredContextSection> {
    try {
      if (!this.contextManager) {
        throw new Error('Context manager not available');
      }

      const filterOptions: ContextFilterOptions = {
        excludeFullDom: true,
        excludePageContent: false,
        maxHistorySteps: options?.maxHistorySteps || this.config.maxHistoryItems,
        includeWorkingMemory: options?.includeWorkingMemory || false,
        includeElementKnowledge: options?.includeElementKnowledge || false,
        includeInvestigationHistory: options?.includeInvestigationHistory || false,
        summarizationLevel: this.config.defaultFilteringLevel,
        confidenceThreshold: this.config.elementKnowledgeThreshold
      };

      const filteredContext = await this.contextManager.generateFilteredContext(
        sessionId,
        stepIndex,
        filterOptions
      );

      return {
        executionSummary: filteredContext.executionSummary,
        pageInsights: filteredContext.pageInsights,
        elementKnowledge: filteredContext.elementKnowledge,
        contextSource: 'filtered',
        filteringLevel: this.config.defaultFilteringLevel,
        confidenceThreshold: this.config.elementKnowledgeThreshold
      };
    } catch (error) {
      throw new PromptManagerError(
        `Failed to build filtered context: ${error.message}`,
        PromptManagerErrorType.CONTEXT_FILTERING_FAILED,
        sessionId,
        stepIndex
      );
    }
  }

  /**
   * Build investigation history section
   */
  private async buildInvestigationHistorySection(
    sessionId: string,
    stepIndex: number
  ): Promise<InvestigationHistorySection> {
    try {
      if (!this.contextManager) {
        return {
          currentStepInvestigations: [],
          previousStepInvestigations: [],
          totalInvestigationsPerformed: 0,
          investigationStrategy: {
            currentApproach: 'standard',
            adaptations: [],
            learningsApplied: []
          }
        };
      }

      const investigationHistory = this.contextManager.getInvestigationHistory(sessionId, stepIndex);
      const currentStepInvestigations = investigationHistory.filter(inv => 
        inv.metadata?.stepIndex === stepIndex
      );
      const previousStepInvestigations = investigationHistory.filter(inv => 
        inv.metadata?.stepIndex === stepIndex - 1
      );

      return {
        currentStepInvestigations: currentStepInvestigations.map(this.mapInvestigationResult),
        previousStepInvestigations: previousStepInvestigations.map(this.mapInvestigationResult),
        totalInvestigationsPerformed: investigationHistory.length,
        investigationStrategy: {
          currentApproach: 'adaptive',
          adaptations: ['tool_priority_adjustment', 'confidence_threshold_tuning'],
          learningsApplied: ['element_selector_patterns', 'page_structure_recognition']
        }
      };
    } catch (error) {
      console.warn(`Failed to build investigation history: ${error.message}`);
      return {
        currentStepInvestigations: [],
        previousStepInvestigations: [],
        totalInvestigationsPerformed: 0,
        investigationStrategy: {
          currentApproach: 'standard',
          adaptations: [],
          learningsApplied: []
        }
      };
    }
  }

  /**
   * Create empty execution history
   */
  private createEmptyExecutionHistory(): ExecutionHistorySection {
    return {
      previousSteps: [],
      chronologicalEvents: [],
      successfulActions: 0,
      failedActions: 0
    };
  }

  /**
   * Generate DOM comparison
   */
  private generateDomComparison(previousDom: string, currentDom: string): any {
    // Simple DOM comparison - in real implementation this would be more sophisticated
    const hasChanges = previousDom !== currentDom;
    
    return {
      hasChanges,
      addedElements: hasChanges ? ['new_elements_detected'] : [],
      removedElements: hasChanges ? ['removed_elements_detected'] : [],
      modifiedElements: hasChanges ? ['modified_elements_detected'] : [],
      summary: hasChanges ? 'Page content has changed' : 'Page content unchanged'
    };
  }

  /**
   * Map investigation result to summary
   */
  private mapInvestigationResult(result: any): any {
    return {
      investigationType: result.investigationType,
      objective: result.metadata?.objective || 'Page investigation',
      outcome: result.success ? 'success' : 'failure',
      keyFindings: result.output?.summary ? [result.output.summary] : [],
      confidence: 0.8, // Would be calculated from actual results
      timestamp: result.timestamp
    };
  }

  /**
   * Calculate overall confidence from working memory
   */
  private calculateOverallConfidence(workingMemory: any): number {
    const factors = [
      workingMemory.knownElements.size > 0 ? 0.3 : 0,
      workingMemory.successfulPatterns.length > 0 ? 0.2 : 0,
      workingMemory.currentPageInsight ? 0.3 : 0,
      workingMemory.extractedVariables.size > 0 ? 0.2 : 0
    ];

    return factors.reduce((sum, factor) => sum + factor, 0);
  }

  /**
   * Set context manager integration
   */
  setContextManager(contextManager: ContextManagerIntegration): void {
    this.contextManager = contextManager;
  }

  /**
   * Update configuration
   */
  updateConfig(config: ContextConfig): void {
    this.config = config;
  }

  /**
   * Get current configuration
   */
  getConfig(): ContextConfig {
    return { ...this.config };
  }
}
