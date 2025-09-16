import {
  FilteredContextJson,
  ContextFilterOptions,
  ExecutionSummaryItem,
  PageInsight,
  ElementKnowledge,
  InvestigationStrategy,
  StepContextSummary,
  SessionData,
  AIContextConfig,
  IContextStorageAdapter,
  InvestigationType,
  SuggestedInvestigation,
  InvestigationPriority
} from './types';
import { SessionStatus } from '../../../types/shared-types';

export class ContextFilterManager {
  private config: AIContextConfig;
  private storageAdapter: IContextStorageAdapter;

  constructor(config: AIContextConfig, storageAdapter: IContextStorageAdapter) {
    this.config = config;
    this.storageAdapter = storageAdapter;
  }

  // Filtered Context Generation

  async generateFilteredContext(
    sessionData: SessionData,
    targetStep: number,
    options: ContextFilterOptions
  ): Promise<FilteredContextJson> {
    // Validate inputs
    this.validateTargetStep(sessionData, targetStep);
    this.validateFilterOptions(options);

    // Determine context size limit
    const sizeLimit = this.calculateContextSizeLimit(options);

    // Generate context components
    const executionSummary = await this.generateExecutionSummary(sessionData, targetStep, options);
    const pageInsights = await this.generatePageInsights(sessionData, targetStep, options);
    const elementKnowledge = await this.generateElementKnowledge(sessionData, targetStep, options);
    const workingMemory = this.getFilteredWorkingMemory(sessionData, options);
    const investigationStrategy = await this.generateInvestigationStrategy(sessionData, targetStep, options);

    // Create filtered context
    const filteredContext: FilteredContextJson = {
      sessionId: sessionData.session.linkedWorkflowSessionId,
      targetStep,
      generatedAt: new Date(),
      executionSummary,
      pageInsights,
      elementKnowledge,
      workingMemory,
      investigationStrategy
    };

    // Apply size constraints if needed
    if (this.config.contextFiltering.enableAutoFiltering) {
      return await this.applySizeConstraints(filteredContext, sizeLimit, options);
    }

    return filteredContext;
  }

  // Execution Summary Generation

  private async generateExecutionSummary(
    sessionData: SessionData,
    targetStep: number,
    options: ContextFilterOptions
  ): Promise<ExecutionSummaryItem[]> {
    const summary: ExecutionSummaryItem[] = [];
    
    // Determine step range
    const startStep = Math.max(0, targetStep - options.maxHistorySteps);
    const endStep = Math.min(targetStep, sessionData.session.stepExecutions.length - 1);

    for (let stepIndex = startStep; stepIndex <= endStep; stepIndex++) {
      const stepExecution = sessionData.session.stepExecutions.find(se => se.stepIndex === stepIndex);
      
      if (stepExecution) {
        const summaryItem = await this.createExecutionSummaryItem(sessionData, stepExecution, options);
        if (summaryItem) {
          summary.push(summaryItem);
        }
      }
    }

    return summary.sort((a, b) => a.stepIndex - b.stepIndex);
  }

  private async createExecutionSummaryItem(
    sessionData: SessionData,
    stepExecution: any,
    options: ContextFilterOptions
  ): Promise<ExecutionSummaryItem | null> {
    // Skip low-confidence steps if threshold is set
    const lastEvent = stepExecution.events[stepExecution.events.length - 1];
    const confidence = lastEvent?.metadata?.confidence || 0.5;
    
    if (confidence < options.confidenceThreshold) {
      return null;
    }

    // Determine outcome
    let outcome: 'success' | 'failure' | 'retry' | 'investigating';
    switch (stepExecution.status) {
      case SessionStatus.COMPLETED:
        outcome = 'success';
        break;
      case SessionStatus.FAILED:
        outcome = 'failure';
        break;
      case SessionStatus.ACTIVE:
        outcome = 'investigating';
        break;
      default:
        outcome = 'retry';
    }

    // Extract key findings
    const keyFindings = this.extractKeyFindings(stepExecution, options);

    // Get latest screenshot
    const screenshotId = lastEvent?.screenshotId;

    return {
      stepIndex: stepExecution.stepIndex,
      stepName: stepExecution.stepName,
      reasoning: this.summarizeReasoning(stepExecution.events, options.summarizationLevel),
      actionTaken: this.summarizeActions(stepExecution.events),
      outcome,
      confidence,
      timestamp: stepExecution.endTime || stepExecution.startTime,
      screenshotId,
      keyFindings
    };
  }

  // Page Insights Generation

  private async generatePageInsights(
    sessionData: SessionData,
    targetStep: number,
    options: ContextFilterOptions
  ): Promise<PageInsight[]> {
    const insights: PageInsight[] = [];
    
    // Get working memory page insight
    if (sessionData.workingMemory?.currentPageInsight) {
      insights.push(sessionData.workingMemory.currentPageInsight);
    }

    // Generate insights from recent step executions
    const recentSteps = Math.min(3, options.maxHistorySteps); // Look at last few steps
    const startStep = Math.max(0, targetStep - recentSteps);

    for (let stepIndex = startStep; stepIndex <= targetStep; stepIndex++) {
      const insight = await this.generatePageInsightFromStep(sessionData, stepIndex, options);
      if (insight) {
        insights.push(insight);
      }
    }

    // Remove duplicates and merge similar insights
    return this.mergePageInsights(insights);
  }

  private async generatePageInsightFromStep(
    sessionData: SessionData,
    stepIndex: number,
    options: ContextFilterOptions
  ): Promise<PageInsight | null> {
    const stepExecution = sessionData.session.stepExecutions.find(se => se.stepIndex === stepIndex);
    if (!stepExecution || stepExecution.events.length === 0) {
      return null;
    }

    const lastEvent = stepExecution.events[stepExecution.events.length - 1];
    
    // Extract page information from DOM without including full content
    if (options.excludePageContent) {
      return this.extractPageInsightFromMetadata(lastEvent, stepIndex);
    }

    return this.extractPageInsightFromDOM(lastEvent.pageDom, stepIndex);
  }

  // Element Knowledge Generation

  private async generateElementKnowledge(
    sessionData: SessionData,
    targetStep: number,
    options: ContextFilterOptions
  ): Promise<ElementKnowledge[]> {
    if (!options.includeElementKnowledge) {
      return [];
    }

    const allKnowledge: ElementKnowledge[] = [];

    // Get element knowledge from working memory
    if (sessionData.workingMemory?.knownElements) {
      for (const [selector, knowledge] of sessionData.workingMemory.knownElements.entries()) {
        if (knowledge.reliability >= options.confidenceThreshold) {
          allKnowledge.push(knowledge);
        }
      }
    }

    // Get element discoveries from recent steps
    const recentSteps = Math.min(5, options.maxHistorySteps);
    const startStep = Math.max(0, targetStep - recentSteps);

    for (let stepIndex = startStep; stepIndex <= targetStep; stepIndex++) {
      const discoveries = sessionData.elementDiscoveries.get(stepIndex) || [];
      
      for (const discovery of discoveries) {
        if (discovery.confidence >= options.confidenceThreshold) {
          const knowledge = this.convertDiscoveryToKnowledge(discovery);
          allKnowledge.push(knowledge);
        }
      }
    }

    // Remove duplicates and sort by reliability
    return this.deduplicateElementKnowledge(allKnowledge)
      .sort((a, b) => b.reliability - a.reliability)
      .slice(0, 50); // Limit to top 50 elements
  }

  // Investigation Strategy Generation

  private async generateInvestigationStrategy(
    sessionData: SessionData,
    targetStep: number,
    options: ContextFilterOptions
  ): Promise<InvestigationStrategy> {
    // Determine current investigation phase
    const currentPhase = this.determineInvestigationPhase(sessionData, targetStep);
    
    // Generate recommended investigations
    const recommendedInvestigations = await this.generateRecommendedInvestigations(
      sessionData, 
      targetStep, 
      options
    );

    // Determine investigation priority
    const investigationPriority = this.generateInvestigationPriority(sessionData, targetStep);

    // Determine context management approach
    const contextManagementApproach = this.determineContextManagementApproach(options);

    return {
      currentPhase,
      recommendedInvestigations,
      investigationPriority,
      contextManagementApproach,
      confidenceThreshold: options.confidenceThreshold,
      maxInvestigationRounds: this.config.investigation.maxInvestigationsPerStep
    };
  }

  // Context Summarization

  async addContextSummary(
    sessionData: SessionData,
    stepIndex: number,
    summary: StepContextSummary
  ): Promise<void> {
    // Validate step index
    this.validateStepIndex(sessionData, stepIndex);

    // Store in session data
    sessionData.contextSummaries.set(stepIndex, summary);

    // Save to persistent storage
    await this.storageAdapter.saveContextSummary(sessionData.session.sessionId, summary);

    // Update session activity
    sessionData.session.lastActivity = new Date();
  }

  getContextSummaries(
    sessionData: SessionData,
    stepRange?: [number, number]
  ): StepContextSummary[] {
    const summaries = Array.from(sessionData.contextSummaries.values());
    
    if (stepRange) {
      const [start, end] = stepRange;
      return summaries.filter(s => s.stepIndex >= start && s.stepIndex <= end);
    }
    
    return summaries.sort((a, b) => a.stepIndex - b.stepIndex);
  }

  // Size Constraint Management

  private async applySizeConstraints(
    context: FilteredContextJson,
    sizeLimit: number,
    options: ContextFilterOptions
  ): Promise<FilteredContextJson> {
    let currentSize = this.calculateContextSize(context);
    
    if (currentSize <= sizeLimit) {
      return context;
    }

    // Apply progressive filtering
    const optimizedContext = { ...context };

    // 1. Reduce execution summary
    if (currentSize > sizeLimit) {
      optimizedContext.executionSummary = this.trimExecutionSummary(
        optimizedContext.executionSummary,
        Math.floor(sizeLimit * 0.4) // 40% of budget
      );
      currentSize = this.calculateContextSize(optimizedContext);
    }

    // 2. Reduce page insights
    if (currentSize > sizeLimit) {
      optimizedContext.pageInsights = this.trimPageInsights(
        optimizedContext.pageInsights,
        Math.floor(sizeLimit * 0.2) // 20% of budget
      );
      currentSize = this.calculateContextSize(optimizedContext);
    }

    // 3. Reduce element knowledge
    if (currentSize > sizeLimit) {
      optimizedContext.elementKnowledge = this.trimElementKnowledge(
        optimizedContext.elementKnowledge,
        Math.floor(sizeLimit * 0.3) // 30% of budget
      );
      currentSize = this.calculateContextSize(optimizedContext);
    }

    // 4. Reduce working memory if still too large
    if (currentSize > sizeLimit) {
      optimizedContext.workingMemory = this.trimWorkingMemory(
        optimizedContext.workingMemory,
        Math.floor(sizeLimit * 0.1) // 10% of budget
      );
    }

    return optimizedContext;
  }

  // Helper Methods

  private calculateContextSizeLimit(options: ContextFilterOptions): number {
    if (this.config.contextFiltering.enableAutoFiltering) {
      return this.config.contextFiltering.maxContextSize;
    }
    return options.maxHistorySteps * 10000; // Rough estimate
  }

  private calculateContextSize(context: FilteredContextJson): number {
    return JSON.stringify(context).length;
  }

  private extractKeyFindings(stepExecution: any, options: ContextFilterOptions): string[] {
    const findings: string[] = [];
    
    // Extract from successful command results
    stepExecution.events.forEach((event: any) => {
      if (event.commandResult?.success) {
        if (event.executorMethod === 'SAVE_VARIABLE') {
          findings.push(`Variable saved: ${event.executorCommand?.parameters?.variableName}`);
        }
        if (event.executorMethod === 'CLICK_ELEMENT') {
          findings.push(`Successfully clicked: ${event.executorCommand?.parameters?.selector}`);
        }
      }
    });

    return findings.slice(0, 5); // Limit to 5 key findings
  }

  private summarizeReasoning(events: any[], level: 'minimal' | 'standard' | 'detailed'): string {
    if (events.length === 0) return '';
    
    const reasonings = events.map(e => e.reasoning).filter(r => r && r.length > 0);
    
    switch (level) {
      case 'minimal':
        return reasonings[reasonings.length - 1] || '';
      case 'detailed':
        return reasonings.join(' → ');
      default: // standard
        return reasonings.slice(-2).join(' → ');
    }
  }

  private summarizeActions(events: any[]): string {
    const actions = events.map(e => e.executorMethod).filter(a => a);
    const uniqueActions = [...new Set(actions)];
    return uniqueActions.join(', ');
  }

  private mergePageInsights(insights: PageInsight[]): PageInsight[] {
    // Simple deduplication by URL
    const uniqueInsights = new Map<string, PageInsight>();
    
    insights.forEach(insight => {
      const key = insight.pageUrl || `step-${insight.stepIndex}`;
      if (!uniqueInsights.has(key) || insight.stepIndex > uniqueInsights.get(key)!.stepIndex) {
        uniqueInsights.set(key, insight);
      }
    });

    return Array.from(uniqueInsights.values());
  }

  private extractPageInsightFromMetadata(event: any, stepIndex: number): PageInsight | null {
    // Extract minimal page info without full content
    return {
      stepIndex,
      pageUrl: event.metadata?.pageUrl,
      pageTitle: event.metadata?.pageTitle,
      complexity: 'medium' // Default complexity
    };
  }

  private extractPageInsightFromDOM(dom: string, stepIndex: number): PageInsight | null {
    // Extract page insight from DOM without including the full DOM
    try {
      // Simple extraction - in a real implementation, this would use a DOM parser
      const titleMatch = dom.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1] : undefined;
      
      // Count interactive elements
      const interactiveElements = (dom.match(/<(button|input|select|textarea|a)/gi) || []).length;
      const formElements = (dom.match(/<(form|input|select|textarea)/gi) || []).length;
      
      const complexity = interactiveElements > 20 ? 'high' : interactiveElements > 5 ? 'medium' : 'low';

      return {
        stepIndex,
        pageTitle: title,
        interactiveElements: [`${interactiveElements} interactive elements found`],
        formElements: [`${formElements} form elements found`],
        complexity
      };
    } catch (error) {
      return null;
    }
  }

  private convertDiscoveryToKnowledge(discovery: any): ElementKnowledge {
    return {
      selector: discovery.selector,
      elementType: discovery.elementType,
      purpose: 'unknown',
      reliability: discovery.confidence,
      lastSeen: discovery.timestamp,
      discoveryHistory: [`${discovery.discoveryMethod} (${discovery.confidence})`]
    };
  }

  private deduplicateElementKnowledge(knowledge: ElementKnowledge[]): ElementKnowledge[] {
    const uniqueKnowledge = new Map<string, ElementKnowledge>();
    
    knowledge.forEach(k => {
      const existing = uniqueKnowledge.get(k.selector);
      if (!existing || k.reliability > existing.reliability) {
        uniqueKnowledge.set(k.selector, k);
      }
    });

    return Array.from(uniqueKnowledge.values());
  }

  private determineInvestigationPhase(sessionData: SessionData, targetStep: number): 'initial_assessment' | 'focused_exploration' | 'selector_determination' {
    const investigations = sessionData.investigations.get(targetStep) || [];
    
    if (investigations.length === 0) {
      return 'initial_assessment';
    }
    
    const successfulInvestigations = investigations.filter(i => i.success);
    if (successfulInvestigations.length === 0) {
      return 'focused_exploration';
    }
    
    return 'selector_determination';
  }

  private async generateRecommendedInvestigations(
    sessionData: SessionData,
    targetStep: number,
    options: ContextFilterOptions
  ): Promise<SuggestedInvestigation[]> {
    const suggestions: SuggestedInvestigation[] = [];
    const phase = this.determineInvestigationPhase(sessionData, targetStep);

    switch (phase) {
      case 'initial_assessment':
        suggestions.push({
          type: InvestigationType.SCREENSHOT_ANALYSIS,
          purpose: 'Initial page assessment',
          priority: 1,
          reasoning: 'Start with visual analysis to understand page layout'
        });
        break;
      
      case 'focused_exploration':
        suggestions.push({
          type: InvestigationType.TEXT_EXTRACTION,
          purpose: 'Extract relevant text content',
          priority: 1,
          reasoning: 'Focus on text extraction to find actionable elements'
        });
        break;
      
      case 'selector_determination':
        suggestions.push({
          type: InvestigationType.SUB_DOM_EXTRACTION,
          purpose: 'Locate specific elements',
          priority: 1,
          reasoning: 'Use targeted DOM extraction to find precise selectors'
        });
        break;
    }

    return suggestions;
  }

  private generateInvestigationPriority(sessionData: SessionData, targetStep: number): InvestigationPriority {
    const preferences = sessionData.workingMemory?.investigationPreferences;
    
    if (preferences) {
      return {
        primary: preferences.preferredOrder[0],
        fallbacks: preferences.preferredOrder.slice(1),
        reasoning: 'Based on learned investigation preferences'
      };
    }

    return {
      primary: InvestigationType.SCREENSHOT_ANALYSIS,
      fallbacks: [InvestigationType.TEXT_EXTRACTION, InvestigationType.SUB_DOM_EXTRACTION],
      reasoning: 'Default investigation priority order'
    };
  }

  private determineContextManagementApproach(options: ContextFilterOptions): 'minimal' | 'standard' | 'comprehensive' {
    if (options.excludeFullDom && options.excludePageContent) {
      return 'minimal';
    }
    if (options.includeWorkingMemory && options.includeElementKnowledge) {
      return 'comprehensive';
    }
    return 'standard';
  }

  private getFilteredWorkingMemory(sessionData: SessionData, options: ContextFilterOptions): any {
    if (!options.includeWorkingMemory || !sessionData.workingMemory) {
      return {
        sessionId: sessionData.session.linkedWorkflowSessionId,
        lastUpdated: new Date(),
        knownElements: new Map(),
        extractedVariables: new Map(),
        successfulPatterns: [],
        failurePatterns: [],
        investigationPreferences: {
          preferredOrder: [InvestigationType.SCREENSHOT_ANALYSIS],
          qualityThresholds: {},
          fallbackStrategies: {}
        }
      };
    }

    // Filter working memory by confidence threshold
    const filteredMemory = { ...sessionData.workingMemory };
    
    // Filter known elements
    const filteredElements = new Map();
    for (const [selector, knowledge] of sessionData.workingMemory.knownElements.entries()) {
      if (knowledge.reliability >= options.confidenceThreshold) {
        filteredElements.set(selector, knowledge);
      }
    }
    filteredMemory.knownElements = filteredElements;

    return filteredMemory;
  }

  // Trimming methods for size constraints
  private trimExecutionSummary(summary: ExecutionSummaryItem[], targetSize: number): ExecutionSummaryItem[] {
    const trimmed = summary.slice(-10); // Keep last 10 items
    
    // Further trim if still too large
    let currentSize = JSON.stringify(trimmed).length;
    if (currentSize > targetSize) {
      return trimmed.map(item => ({
        ...item,
        reasoning: item.reasoning.substring(0, 100),
        keyFindings: item.keyFindings?.slice(0, 2) || []
      }));
    }
    
    return trimmed;
  }

  private trimPageInsights(insights: PageInsight[], targetSize: number): PageInsight[] {
    return insights.slice(-3).map(insight => ({
      ...insight,
      mainSections: insight.mainSections?.slice(0, 3),
      keyElements: insight.keyElements?.slice(0, 5),
      formElements: insight.formElements?.slice(0, 3),
      interactiveElements: insight.interactiveElements?.slice(0, 5)
    }));
  }

  private trimElementKnowledge(knowledge: ElementKnowledge[], targetSize: number): ElementKnowledge[] {
    return knowledge.slice(0, 20).map(k => ({
      ...k,
      discoveryHistory: k.discoveryHistory.slice(-2),
      alternativeSelectors: k.alternativeSelectors?.slice(0, 2)
    }));
  }

  private trimWorkingMemory(memory: any, targetSize: number): any {
    return {
      ...memory,
      successfulPatterns: memory.successfulPatterns.slice(-5),
      failurePatterns: memory.failurePatterns.slice(-3)
    };
  }

  private validateTargetStep(sessionData: SessionData, targetStep: number): void {
    if (targetStep < 0 || targetStep >= sessionData.session.steps.length) {
      throw new Error(`Target step ${targetStep} is out of range`);
    }
  }

  private validateStepIndex(sessionData: SessionData, stepIndex: number): void {
    if (stepIndex < 0 || stepIndex >= sessionData.session.steps.length) {
      throw new Error(`Step index ${stepIndex} is out of range`);
    }
  }

  private validateFilterOptions(options: ContextFilterOptions): void {
    if (options.confidenceThreshold < 0 || options.confidenceThreshold > 1) {
      throw new Error('Confidence threshold must be between 0 and 1');
    }
    
    if (options.maxHistorySteps < 1) {
      throw new Error('Max history steps must be at least 1');
    }
  }
}
