import {
  WorkingMemoryState,
  WorkingMemoryUpdate,
  ElementKnowledge,
  NavigationPattern,
  VariableContext,
  SuccessPattern,
  FailurePattern,
  InvestigationPreferences,
  InvestigationType,
  PageInsight,
  SessionData,
  AIContextConfig,
  IContextStorageAdapter,
  ContextManagerError
} from './types';

export class WorkingMemoryManager {
  private config: AIContextConfig;
  private storageAdapter: IContextStorageAdapter;

  constructor(config: AIContextConfig, storageAdapter: IContextStorageAdapter) {
    this.config = config;
    this.storageAdapter = storageAdapter;
  }

  // Working Memory Initialization

  initializeWorkingMemory(sessionData: SessionData): WorkingMemoryState {
    const workingMemory: WorkingMemoryState = {
      sessionId: sessionData.session.linkedWorkflowSessionId,
      lastUpdated: new Date(),
      knownElements: new Map(),
      extractedVariables: new Map(),
      successfulPatterns: [],
      failurePatterns: [],
      investigationPreferences: this.createDefaultInvestigationPreferences()
    };

    sessionData.workingMemory = workingMemory;
    return workingMemory;
  }

  getWorkingMemory(sessionData: SessionData): WorkingMemoryState {
    if (!sessionData.workingMemory) {
      return this.initializeWorkingMemory(sessionData);
    }
    return sessionData.workingMemory;
  }

  async clearWorkingMemory(sessionData: SessionData): Promise<void> {
    if (sessionData.workingMemory) {
      sessionData.workingMemory.knownElements.clear();
      sessionData.workingMemory.extractedVariables.clear();
      sessionData.workingMemory.successfulPatterns = [];
      sessionData.workingMemory.failurePatterns = [];
      sessionData.workingMemory.currentPageInsight = undefined;
      sessionData.workingMemory.navigationPattern = undefined;
      sessionData.workingMemory.lastUpdated = new Date();

      await this.storageAdapter.saveWorkingMemory(sessionData.session.sessionId, sessionData.workingMemory);
    }
  }

  // Working Memory Updates

  async updateWorkingMemory(
    sessionData: SessionData, 
    stepIndex: number, 
    memory: WorkingMemoryUpdate
  ): Promise<void> {
    const workingMemory = this.getWorkingMemory(sessionData);
    
    switch (memory.updateType) {
      case 'element_discovery':
        await this.updateElementKnowledge(workingMemory, memory.data, memory.confidence, memory.source);
        break;
      case 'page_insight':
        await this.updatePageInsight(workingMemory, memory.data, memory.confidence);
        break;
      case 'variable_extraction':
        await this.updateVariableContext(workingMemory, memory.data, memory.confidence, memory.source);
        break;
      case 'pattern_learning':
        await this.updatePatternLearning(workingMemory, memory.data, memory.confidence);
        break;
      case 'investigation_preference':
        await this.updateInvestigationPreferences(workingMemory, memory.data, memory.confidence);
        break;
      default:
        throw this.createError(
          'UNKNOWN_UPDATE_TYPE',
          `Unknown working memory update type: ${memory.updateType}`,
          { updateType: memory.updateType, stepIndex }
        );
    }

    workingMemory.lastUpdated = new Date();
    await this.storageAdapter.saveWorkingMemory(sessionData.session.sessionId, workingMemory);
  }

  // Element Knowledge Management

  private async updateElementKnowledge(
    workingMemory: WorkingMemoryState,
    elementData: any,
    confidence: number,
    source: string
  ): Promise<void> {
    const { selector, elementType, purpose, alternativeSelectors, interactionNotes } = elementData;

    if (!selector || typeof selector !== 'string') {
      throw this.createError(
        'INVALID_ELEMENT_DATA',
        'Element selector is required and must be a string',
        { elementData }
      );
    }

    const existing = workingMemory.knownElements.get(selector);
    
    if (existing) {
      // Update existing element knowledge
      existing.reliability = this.calculateUpdatedReliability(existing.reliability, confidence);
      existing.lastSeen = new Date();
      existing.discoveryHistory.push(`${source} (confidence: ${confidence})`);
      
      if (alternativeSelectors) {
        existing.alternativeSelectors = [
          ...(existing.alternativeSelectors || []),
          ...alternativeSelectors.filter((s: string) => !existing.alternativeSelectors?.includes(s))
        ];
      }
      
      if (interactionNotes) {
        existing.interactionNotes = interactionNotes;
      }
    } else {
      // Add new element knowledge
      const elementKnowledge: ElementKnowledge = {
        selector,
        elementType: elementType || 'unknown',
        purpose: purpose || 'unknown',
        reliability: confidence,
        lastSeen: new Date(),
        discoveryHistory: [`${source} (confidence: ${confidence})`],
        alternativeSelectors,
        interactionNotes
      };

      workingMemory.knownElements.set(selector, elementKnowledge);
    }

    // Cleanup old elements if we exceed the limit
    await this.cleanupElementKnowledge(workingMemory);
  }

  getElementKnowledge(sessionData: SessionData, selector: string): ElementKnowledge | null {
    const workingMemory = this.getWorkingMemory(sessionData);
    return workingMemory.knownElements.get(selector) || null;
  }

  getReliableElements(sessionData: SessionData, minReliability?: number): ElementKnowledge[] {
    const workingMemory = this.getWorkingMemory(sessionData);
    const threshold = minReliability || this.config.workingMemory.reliabilityThreshold;
    
    return Array.from(workingMemory.knownElements.values())
      .filter(element => element.reliability >= threshold)
      .sort((a, b) => b.reliability - a.reliability);
  }

  // Page Insight Management

  private async updatePageInsight(
    workingMemory: WorkingMemoryState,
    insightData: any,
    confidence: number
  ): Promise<void> {
    const insight: PageInsight = {
      stepIndex: insightData.stepIndex || 0,
      pageUrl: insightData.pageUrl,
      pageTitle: insightData.pageTitle,
      layoutType: insightData.layoutType,
      mainSections: insightData.mainSections || [],
      keyElements: insightData.keyElements || [],
      navigationStructure: insightData.navigationStructure,
      formElements: insightData.formElements || [],
      interactiveElements: insightData.interactiveElements || [],
      visualDescription: insightData.visualDescription,
      complexity: insightData.complexity || 'medium'
    };

    workingMemory.currentPageInsight = insight;
  }

  getCurrentPageInsight(sessionData: SessionData): PageInsight | null {
    const workingMemory = this.getWorkingMemory(sessionData);
    return workingMemory.currentPageInsight || null;
  }

  // Variable Context Management

  private async updateVariableContext(
    workingMemory: WorkingMemoryState,
    variableData: any,
    confidence: number,
    source: string
  ): Promise<void> {
    const { name, value, extractionMethod, sourceElement } = variableData;

    if (!name || typeof name !== 'string') {
      throw this.createError(
        'INVALID_VARIABLE_DATA',
        'Variable name is required and must be a string',
        { variableData }
      );
    }

    const variableContext: VariableContext = {
      name,
      value: value || '',
      extractionMethod: extractionMethod || source,
      reliability: confidence,
      lastUpdated: new Date(),
      sourceElement
    };

    workingMemory.extractedVariables.set(name, variableContext);
  }

  getVariableContext(sessionData: SessionData, variableName: string): VariableContext | null {
    const workingMemory = this.getWorkingMemory(sessionData);
    return workingMemory.extractedVariables.get(variableName) || null;
  }

  getAllVariables(sessionData: SessionData): VariableContext[] {
    const workingMemory = this.getWorkingMemory(sessionData);
    return Array.from(workingMemory.extractedVariables.values())
      .sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());
  }

  // Pattern Learning Management

  private async updatePatternLearning(
    workingMemory: WorkingMemoryState,
    patternData: any,
    confidence: number
  ): Promise<void> {
    const { type, pattern, context, success, failureReasons, avoidanceStrategy } = patternData;

    if (success) {
      await this.updateSuccessPattern(workingMemory, pattern, context, confidence);
    } else {
      await this.updateFailurePattern(workingMemory, pattern, context, failureReasons, avoidanceStrategy);
    }
  }

  private async updateSuccessPattern(
    workingMemory: WorkingMemoryState,
    pattern: string,
    context: string,
    confidence: number
  ): Promise<void> {
    const existing = workingMemory.successfulPatterns.find(p => p.pattern === pattern && p.context === context);
    
    if (existing) {
      existing.usageCount++;
      existing.successRate = this.calculateUpdatedSuccessRate(existing.successRate, existing.usageCount, true);
      existing.lastUsed = new Date();
    } else {
      const successPattern: SuccessPattern = {
        pattern,
        context,
        successRate: confidence,
        usageCount: 1,
        lastUsed: new Date()
      };
      
      workingMemory.successfulPatterns.push(successPattern);
    }

    // Cleanup old patterns
    await this.cleanupSuccessPatterns(workingMemory);
  }

  private async updateFailurePattern(
    workingMemory: WorkingMemoryState,
    pattern: string,
    context: string,
    failureReasons: string[],
    avoidanceStrategy?: string
  ): Promise<void> {
    const existing = workingMemory.failurePatterns.find(p => p.pattern === pattern && p.context === context);
    
    if (existing) {
      existing.failureReasons = [...new Set([...existing.failureReasons, ...failureReasons])];
      existing.lastEncountered = new Date();
      if (avoidanceStrategy) {
        existing.avoidanceStrategy = avoidanceStrategy;
      }
    } else {
      const failurePattern: FailurePattern = {
        pattern,
        context,
        failureReasons: [...failureReasons],
        lastEncountered: new Date(),
        avoidanceStrategy
      };
      
      workingMemory.failurePatterns.push(failurePattern);
    }

    // Cleanup old patterns
    await this.cleanupFailurePatterns(workingMemory);
  }

  getSuccessfulPatterns(sessionData: SessionData, context?: string): SuccessPattern[] {
    const workingMemory = this.getWorkingMemory(sessionData);
    let patterns = workingMemory.successfulPatterns;
    
    if (context) {
      patterns = patterns.filter(p => p.context === context);
    }
    
    return patterns.sort((a, b) => b.successRate - a.successRate);
  }

  getFailurePatterns(sessionData: SessionData, context?: string): FailurePattern[] {
    const workingMemory = this.getWorkingMemory(sessionData);
    let patterns = workingMemory.failurePatterns;
    
    if (context) {
      patterns = patterns.filter(p => p.context === context);
    }
    
    return patterns.sort((a, b) => b.lastEncountered.getTime() - a.lastEncountered.getTime());
  }

  // Investigation Preferences Management

  private async updateInvestigationPreferences(
    workingMemory: WorkingMemoryState,
    preferenceData: any,
    confidence: number
  ): Promise<void> {
    const { preferredOrder, qualityThresholds, fallbackStrategies } = preferenceData;

    if (preferredOrder) {
      workingMemory.investigationPreferences.preferredOrder = preferredOrder;
    }

    if (qualityThresholds) {
      Object.assign(workingMemory.investigationPreferences.qualityThresholds, qualityThresholds);
    }

    if (fallbackStrategies) {
      Object.assign(workingMemory.investigationPreferences.fallbackStrategies, fallbackStrategies);
    }
  }

  getInvestigationPreferences(sessionData: SessionData): InvestigationPreferences {
    const workingMemory = this.getWorkingMemory(sessionData);
    return workingMemory.investigationPreferences;
  }

  // Navigation Pattern Management

  updateNavigationPattern(sessionData: SessionData, urlPattern: string, navigationSteps: string[]): void {
    const workingMemory = this.getWorkingMemory(sessionData);
    
    const existing = workingMemory.navigationPattern;
    if (existing && existing.urlPattern === urlPattern) {
      existing.reliability = Math.min(1.0, existing.reliability + this.config.workingMemory.learningRate);
      existing.lastUsed = new Date();
    } else {
      workingMemory.navigationPattern = {
        urlPattern,
        navigationSteps: [...navigationSteps],
        reliability: 0.5,
        lastUsed: new Date()
      };
    }
  }

  getNavigationPattern(sessionData: SessionData): NavigationPattern | null {
    const workingMemory = this.getWorkingMemory(sessionData);
    return workingMemory.navigationPattern || null;
  }

  // Memory Statistics and Analytics

  getMemoryStatistics(sessionData: SessionData): {
    totalElements: number;
    reliableElements: number;
    totalVariables: number;
    successPatterns: number;
    failurePatterns: number;
    memoryAge: number;
    lastUpdated: Date;
  } {
    const workingMemory = this.getWorkingMemory(sessionData);
    const reliableElements = this.getReliableElements(sessionData).length;
    
    return {
      totalElements: workingMemory.knownElements.size,
      reliableElements,
      totalVariables: workingMemory.extractedVariables.size,
      successPatterns: workingMemory.successfulPatterns.length,
      failurePatterns: workingMemory.failurePatterns.length,
      memoryAge: Date.now() - workingMemory.lastUpdated.getTime(),
      lastUpdated: workingMemory.lastUpdated
    };
  }

  // Cleanup Methods

  private async cleanupElementKnowledge(workingMemory: WorkingMemoryState): Promise<void> {
    if (workingMemory.knownElements.size <= this.config.workingMemory.maxKnownElements) {
      return;
    }

    // Remove elements with lowest reliability
    const elements = Array.from(workingMemory.knownElements.entries())
      .sort((a, b) => a[1].reliability - b[1].reliability);

    const toRemove = elements.slice(0, elements.length - this.config.workingMemory.maxKnownElements);
    for (const [selector] of toRemove) {
      workingMemory.knownElements.delete(selector);
    }
  }

  private async cleanupSuccessPatterns(workingMemory: WorkingMemoryState): Promise<void> {
    if (workingMemory.successfulPatterns.length <= this.config.workingMemory.maxSuccessPatterns) {
      return;
    }

    // Keep patterns with highest success rate and recent usage
    workingMemory.successfulPatterns.sort((a, b) => {
      const scoreA = a.successRate * 0.7 + (a.usageCount / 100) * 0.3;
      const scoreB = b.successRate * 0.7 + (b.usageCount / 100) * 0.3;
      return scoreB - scoreA;
    });

    workingMemory.successfulPatterns = workingMemory.successfulPatterns
      .slice(0, this.config.workingMemory.maxSuccessPatterns);
  }

  private async cleanupFailurePatterns(workingMemory: WorkingMemoryState): Promise<void> {
    if (workingMemory.failurePatterns.length <= this.config.workingMemory.maxFailurePatterns) {
      return;
    }

    // Keep most recent failure patterns
    workingMemory.failurePatterns.sort((a, b) => 
      b.lastEncountered.getTime() - a.lastEncountered.getTime()
    );

    workingMemory.failurePatterns = workingMemory.failurePatterns
      .slice(0, this.config.workingMemory.maxFailurePatterns);
  }

  // Helper Methods

  private createDefaultInvestigationPreferences(): InvestigationPreferences {
    return {
      preferredOrder: [
        InvestigationType.SCREENSHOT_ANALYSIS,
        InvestigationType.TEXT_EXTRACTION,
        InvestigationType.SUB_DOM_EXTRACTION,
        InvestigationType.FULL_DOM_RETRIEVAL
      ],
      qualityThresholds: {
        [InvestigationType.SCREENSHOT_ANALYSIS]: 0.7,
        [InvestigationType.TEXT_EXTRACTION]: 0.8,
        [InvestigationType.SUB_DOM_EXTRACTION]: 0.6,
        [InvestigationType.FULL_DOM_RETRIEVAL]: 0.5
      },
      fallbackStrategies: {
        [InvestigationType.SCREENSHOT_ANALYSIS]: [InvestigationType.TEXT_EXTRACTION],
        [InvestigationType.TEXT_EXTRACTION]: [InvestigationType.SUB_DOM_EXTRACTION],
        [InvestigationType.SUB_DOM_EXTRACTION]: [InvestigationType.FULL_DOM_RETRIEVAL],
        [InvestigationType.FULL_DOM_RETRIEVAL]: []
      }
    };
  }

  private calculateUpdatedReliability(currentReliability: number, newConfidence: number): number {
    // Weighted average with learning rate
    const learningRate = this.config.workingMemory.learningRate;
    return currentReliability * (1 - learningRate) + newConfidence * learningRate;
  }

  private calculateUpdatedSuccessRate(currentRate: number, usageCount: number, success: boolean): number {
    // Update success rate based on new outcome
    const successValue = success ? 1 : 0;
    return (currentRate * (usageCount - 1) + successValue) / usageCount;
  }

  private createError(code: string, message: string, details?: Record<string, any>): ContextManagerError {
    return {
      id: crypto.randomUUID(),
      category: 'VALIDATION' as any,
      severity: 'MEDIUM' as any,
      code,
      message,
      details,
      timestamp: new Date(),
      moduleId: 'ai-context-manager',
      recoverable: true,
      retryable: false,
      suggestedAction: 'Review working memory update data and try again'
    };
  }

  // Memory Persistence

  async saveWorkingMemory(sessionData: SessionData): Promise<void> {
    if (sessionData.workingMemory) {
      await this.storageAdapter.saveWorkingMemory(sessionData.session.sessionId, sessionData.workingMemory);
    }
  }

  async loadWorkingMemory(sessionData: SessionData): Promise<void> {
    const workingMemory = await this.storageAdapter.loadWorkingMemory(sessionData.session.sessionId);
    if (workingMemory) {
      sessionData.workingMemory = workingMemory;
    }
  }
}
