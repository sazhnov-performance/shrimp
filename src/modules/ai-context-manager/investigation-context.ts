import {
  InvestigationContextJson,
  InvestigationResult,
  ElementDiscovery,
  PageInsight,
  WorkingMemoryState,
  SuggestedInvestigation,
  InvestigationPriority,
  InvestigationType,
  SessionData,
  AIContextConfig,
  ContextManagerError
} from './types';

export class InvestigationContextManager {
  private config: AIContextConfig;

  constructor(config: AIContextConfig) {
    this.config = config;
  }

  // Investigation Context Generation

  async generateInvestigationContext(
    sessionData: SessionData,
    stepIndex: number
  ): Promise<InvestigationContextJson> {
    // Validate inputs
    this.validateStepIndex(sessionData, stepIndex);

    try {
      // Gather investigation data
      const currentInvestigations = this.getCurrentInvestigations(sessionData, stepIndex);
      const elementsDiscovered = this.getElementsDiscovered(sessionData, stepIndex);
      const pageInsight = await this.generatePageInsight(sessionData, stepIndex);
      const workingMemory = this.getWorkingMemoryState(sessionData);
      
      // Generate investigation strategy
      const suggestedInvestigations = await this.generateSuggestedInvestigations(
        sessionData, 
        stepIndex, 
        currentInvestigations
      );
      const investigationPriority = this.generateInvestigationPriority(
        sessionData, 
        stepIndex, 
        currentInvestigations
      );

      return {
        sessionId: sessionData.session.linkedWorkflowSessionId,
        stepIndex,
        generatedAt: new Date(),
        currentInvestigations,
        elementsDiscovered,
        pageInsight,
        workingMemory,
        suggestedInvestigations,
        investigationPriority
      };
    } catch (error) {
      throw this.createError(
        'INVESTIGATION_CONTEXT_GENERATION_FAILED',
        `Failed to generate investigation context for step ${stepIndex}`,
        { 
          stepIndex, 
          sessionId: sessionData.session.sessionId,
          error: error instanceof Error ? error.message : String(error)
        }
      );
    }
  }

  // Current Investigation State

  private getCurrentInvestigations(sessionData: SessionData, stepIndex: number): InvestigationResult[] {
    const investigations = sessionData.investigations.get(stepIndex) || [];
    
    // Sort by timestamp (most recent first) and limit to recent investigations
    return investigations
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, this.config.investigation.maxInvestigationsPerStep);
  }

  private getElementsDiscovered(sessionData: SessionData, stepIndex: number): ElementDiscovery[] {
    const discoveries = sessionData.elementDiscoveries.get(stepIndex) || [];
    
    // Filter for reliable discoveries and sort by confidence
    return discoveries
      .filter(d => d.confidence >= this.config.workingMemory.reliabilityThreshold)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 20); // Limit to top 20 discoveries
  }

  // Page Insight Generation

  private async generatePageInsight(sessionData: SessionData, stepIndex: number): Promise<PageInsight> {
    // Try to get insight from working memory first
    if (sessionData.workingMemory?.currentPageInsight) {
      return sessionData.workingMemory.currentPageInsight;
    }

    // Generate insight from current step data
    const stepExecution = sessionData.session.stepExecutions.find(se => se.stepIndex === stepIndex);
    
    if (stepExecution && stepExecution.events.length > 0) {
      return this.generatePageInsightFromStepData(stepExecution, stepIndex);
    }

    // Fallback to basic insight
    return this.createBasicPageInsight(stepIndex);
  }

  private generatePageInsightFromStepData(stepExecution: any, stepIndex: number): PageInsight {
    const lastEvent = stepExecution.events[stepExecution.events.length - 1];
    const dom = lastEvent.pageDom || '';
    
    // Extract basic page information
    const titleMatch = dom.match(/<title[^>]*>([^<]+)<\/title>/i);
    const pageTitle = titleMatch ? titleMatch[1].trim() : undefined;
    
    // Count different types of elements
    const formElements = this.countElements(dom, /<(form|input|select|textarea|button)/gi);
    const interactiveElements = this.countElements(dom, /<(a|button|input|select|textarea)/gi);
    const navigationElements = this.countElements(dom, /<(nav|menu|ul|ol)/gi);
    
    // Determine complexity based on element counts
    let complexity: 'low' | 'medium' | 'high' = 'low';
    const totalInteractive = formElements.length + interactiveElements.length;
    
    if (totalInteractive > 50) {
      complexity = 'high';
    } else if (totalInteractive > 15) {
      complexity = 'medium';
    }

    return {
      stepIndex,
      pageTitle,
      formElements: formElements.slice(0, 10), // Limit to first 10
      interactiveElements: interactiveElements.slice(0, 15), // Limit to first 15
      navigationStructure: navigationElements.length > 0 ? `${navigationElements.length} navigation elements` : undefined,
      complexity
    };
  }

  private createBasicPageInsight(stepIndex: number): PageInsight {
    return {
      stepIndex,
      complexity: 'medium'
    };
  }

  private countElements(dom: string, pattern: RegExp): string[] {
    const matches = dom.match(pattern) || [];
    return matches.map((match, index) => `${match} (${index + 1})`);
  }

  // Working Memory State

  private getWorkingMemoryState(sessionData: SessionData): WorkingMemoryState {
    if (sessionData.workingMemory) {
      return sessionData.workingMemory;
    }

    // Create minimal working memory if none exists
    return {
      sessionId: sessionData.session.linkedWorkflowSessionId,
      lastUpdated: new Date(),
      knownElements: new Map(),
      extractedVariables: new Map(),
      successfulPatterns: [],
      failurePatterns: [],
      investigationPreferences: {
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
      }
    };
  }

  // Investigation Strategy Generation

  private async generateSuggestedInvestigations(
    sessionData: SessionData,
    stepIndex: number,
    currentInvestigations: InvestigationResult[]
  ): Promise<SuggestedInvestigation[]> {
    const suggestions: SuggestedInvestigation[] = [];
    
    // Analyze current investigation state
    const investigationTypes = new Set(currentInvestigations.map(inv => inv.investigationType));
    const successfulTypes = new Set(
      currentInvestigations.filter(inv => inv.success).map(inv => inv.investigationType)
    );
    const failedTypes = new Set(
      currentInvestigations.filter(inv => !inv.success).map(inv => inv.investigationType)
    );

    // Get working memory preferences
    const workingMemory = this.getWorkingMemoryState(sessionData);
    const preferences = workingMemory.investigationPreferences;

    // Generate suggestions based on current state
    if (currentInvestigations.length === 0) {
      // No investigations yet - start with preferred approach
      suggestions.push({
        type: preferences.preferredOrder[0],
        purpose: 'Initial page assessment',
        priority: 1,
        reasoning: 'Starting investigation with preferred method'
      });
    } else if (successfulTypes.size === 0) {
      // No successful investigations - try alternative approaches
      const untriedTypes = preferences.preferredOrder.filter(type => !investigationTypes.has(type));
      
      if (untriedTypes.length > 0) {
        suggestions.push({
          type: untriedTypes[0],
          purpose: 'Alternative investigation approach',
          priority: 1,
          reasoning: 'Previous investigations unsuccessful, trying different approach'
        });
      }
    } else {
      // Some successful investigations - build on success
      const mostSuccessfulType = this.findMostSuccessfulInvestigationType(currentInvestigations);
      
      if (mostSuccessfulType && !this.hasRecentInvestigation(currentInvestigations, mostSuccessfulType)) {
        suggestions.push({
          type: mostSuccessfulType,
          purpose: 'Follow up on successful approach',
          priority: 1,
          reasoning: 'Building on previously successful investigation method'
        });
      }
    }

    // Add fallback suggestions
    this.addFallbackSuggestions(suggestions, investigationTypes, failedTypes, preferences);

    // Add specialized suggestions based on context
    this.addContextSpecificSuggestions(suggestions, sessionData, stepIndex);

    return suggestions.slice(0, 5); // Limit to top 5 suggestions
  }

  private findMostSuccessfulInvestigationType(investigations: InvestigationResult[]): InvestigationType | null {
    const successCounts = new Map<InvestigationType, number>();
    
    investigations.forEach(inv => {
      if (inv.success) {
        successCounts.set(inv.investigationType, (successCounts.get(inv.investigationType) || 0) + 1);
      }
    });

    if (successCounts.size === 0) return null;

    const [mostSuccessful] = Array.from(successCounts.entries())
      .sort((a, b) => b[1] - a[1]);

    return mostSuccessful[0];
  }

  private hasRecentInvestigation(investigations: InvestigationResult[], type: InvestigationType): boolean {
    const recentThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes
    return investigations.some(inv => 
      inv.investigationType === type && inv.timestamp >= recentThreshold
    );
  }

  private addFallbackSuggestions(
    suggestions: SuggestedInvestigation[],
    investigationTypes: Set<InvestigationType>,
    failedTypes: Set<InvestigationType>,
    preferences: any
  ): void {
    // Add untried investigation types
    for (const type of Object.values(InvestigationType)) {
      if (!investigationTypes.has(type) && !failedTypes.has(type) && suggestions.length < 3) {
        suggestions.push({
          type,
          purpose: 'Unexplored investigation method',
          priority: 2,
          reasoning: `${type} hasn't been attempted yet`
        });
      }
    }
  }

  private addContextSpecificSuggestions(
    suggestions: SuggestedInvestigation[],
    sessionData: SessionData,
    stepIndex: number
  ): void {
    // Get current step description
    const stepDescription = sessionData.session.steps[stepIndex] || '';
    const lowerDescription = stepDescription.toLowerCase();

    // Add context-specific suggestions based on step content
    if (lowerDescription.includes('click') || lowerDescription.includes('button')) {
      if (!suggestions.some(s => s.type === InvestigationType.SCREENSHOT_ANALYSIS)) {
        suggestions.push({
          type: InvestigationType.SCREENSHOT_ANALYSIS,
          purpose: 'Locate clickable elements visually',
          priority: 2,
          reasoning: 'Step involves clicking - visual analysis recommended'
        });
      }
    }

    if (lowerDescription.includes('form') || lowerDescription.includes('input') || lowerDescription.includes('enter')) {
      if (!suggestions.some(s => s.type === InvestigationType.SUB_DOM_EXTRACTION)) {
        suggestions.push({
          type: InvestigationType.SUB_DOM_EXTRACTION,
          purpose: 'Extract form structure',
          priority: 2,
          reasoning: 'Step involves form interaction - DOM extraction recommended'
        });
      }
    }

    if (lowerDescription.includes('text') || lowerDescription.includes('content') || lowerDescription.includes('read')) {
      if (!suggestions.some(s => s.type === InvestigationType.TEXT_EXTRACTION)) {
        suggestions.push({
          type: InvestigationType.TEXT_EXTRACTION,
          purpose: 'Extract relevant text content',
          priority: 2,
          reasoning: 'Step involves text content - text extraction recommended'
        });
      }
    }
  }

  // Investigation Priority Generation

  private generateInvestigationPriority(
    sessionData: SessionData,
    stepIndex: number,
    currentInvestigations: InvestigationResult[]
  ): InvestigationPriority {
    const workingMemory = this.getWorkingMemoryState(sessionData);
    
    // Analyze success patterns
    const successfulTypes = currentInvestigations
      .filter(inv => inv.success)
      .map(inv => inv.investigationType);

    if (successfulTypes.length > 0) {
      // Prioritize based on recent success
      const mostSuccessful = this.findMostSuccessfulInvestigationType(currentInvestigations);
      const fallbacks = workingMemory.investigationPreferences.preferredOrder
        .filter(type => type !== mostSuccessful);

      return {
        primary: mostSuccessful || workingMemory.investigationPreferences.preferredOrder[0],
        fallbacks,
        reasoning: 'Prioritizing based on recent successful investigations'
      };
    }

    // No successful investigations - use preferences but avoid failed types
    const failedTypes = new Set(
      currentInvestigations.filter(inv => !inv.success).map(inv => inv.investigationType)
    );

    const preferredOrder = workingMemory.investigationPreferences.preferredOrder
      .filter(type => !failedTypes.has(type));

    if (preferredOrder.length === 0) {
      // All preferred types have failed - reset to default order
      return {
        primary: InvestigationType.SCREENSHOT_ANALYSIS,
        fallbacks: [
          InvestigationType.TEXT_EXTRACTION,
          InvestigationType.SUB_DOM_EXTRACTION,
          InvestigationType.FULL_DOM_RETRIEVAL
        ],
        reasoning: 'Resetting to default priority after investigation failures'
      };
    }

    return {
      primary: preferredOrder[0],
      fallbacks: preferredOrder.slice(1),
      reasoning: 'Using learned preferences while avoiding failed methods'
    };
  }

  // Investigation Analysis

  analyzeInvestigationCycle(
    sessionData: SessionData,
    stepIndex: number
  ): {
    cyclePhase: 'exploring' | 'focusing' | 'executing' | 'completed';
    confidence: number;
    nextRecommendation: string;
    issues: string[];
  } {
    const investigations = this.getCurrentInvestigations(sessionData, stepIndex);
    const discoveries = this.getElementsDiscovered(sessionData, stepIndex);
    const issues: string[] = [];

    // Determine cycle phase
    let cyclePhase: 'exploring' | 'focusing' | 'executing' | 'completed' = 'exploring';
    let confidence = 0;

    if (investigations.length === 0) {
      cyclePhase = 'exploring';
      confidence = 0;
    } else {
      const successfulInvestigations = investigations.filter(inv => inv.success);
      const reliableDiscoveries = discoveries.filter(d => d.isReliable);

      if (successfulInvestigations.length === 0) {
        cyclePhase = 'exploring';
        confidence = 0.1;
        issues.push('No successful investigations yet');
      } else if (reliableDiscoveries.length === 0) {
        cyclePhase = 'focusing';
        confidence = 0.3;
        issues.push('Investigations successful but no reliable elements found');
      } else if (reliableDiscoveries.length < 3) {
        cyclePhase = 'focusing';
        confidence = 0.6;
      } else {
        cyclePhase = 'executing';
        confidence = 0.8;
      }

      // Check for completion
      const stepExecution = sessionData.session.stepExecutions.find(se => se.stepIndex === stepIndex);
      if (stepExecution && stepExecution.status === 'COMPLETED') {
        cyclePhase = 'completed';
        confidence = 1.0;
      }
    }

    // Generate next recommendation
    let nextRecommendation: string;
    switch (cyclePhase) {
      case 'exploring':
        nextRecommendation = 'Start with screenshot analysis to understand the page layout';
        break;
      case 'focusing':
        nextRecommendation = 'Focus on targeted investigations to find reliable selectors';
        break;
      case 'executing':
        nextRecommendation = 'Proceed with automation using discovered elements';
        break;
      case 'completed':
        nextRecommendation = 'Investigation cycle completed successfully';
        break;
    }

    return {
      cyclePhase,
      confidence,
      nextRecommendation,
      issues
    };
  }

  // Helper Methods

  private validateStepIndex(sessionData: SessionData, stepIndex: number): void {
    if (stepIndex < 0 || stepIndex >= sessionData.session.steps.length) {
      throw this.createError(
        'INVALID_STEP_INDEX',
        `Step index ${stepIndex} is out of range`,
        { stepIndex, maxIndex: sessionData.session.steps.length - 1 }
      );
    }
  }

  private createError(code: string, message: string, details?: Record<string, any>): ContextManagerError {
    return {
      id: crypto.randomUUID(),
      category: 'EXECUTION' as any,
      severity: 'HIGH' as any,
      code,
      message,
      details,
      timestamp: new Date(),
      moduleId: 'ai-context-manager',
      recoverable: false,
      retryable: true,
      suggestedAction: this.getSuggestedAction(code)
    };
  }

  private getSuggestedAction(code: string): string {
    switch (code) {
      case 'INVESTIGATION_CONTEXT_GENERATION_FAILED':
        return 'Check investigation data integrity and retry context generation';
      case 'INVALID_STEP_INDEX':
        return 'Provide a valid step index within the available range';
      default:
        return 'Review investigation context parameters and try again';
    }
  }

  // Context Export

  exportInvestigationContextAsMarkdown(context: InvestigationContextJson): string {
    const lines: string[] = [];
    
    lines.push(`# Investigation Context - Step ${context.stepIndex}`);
    lines.push(`Session: ${context.sessionId}`);
    lines.push(`Generated: ${context.generatedAt.toISOString()}`);
    lines.push('');

    // Current Investigations
    lines.push('## Current Investigations');
    if (context.currentInvestigations.length === 0) {
      lines.push('No investigations performed yet.');
    } else {
      context.currentInvestigations.forEach((inv, index) => {
        lines.push(`### ${index + 1}. ${inv.investigationType} ${inv.success ? '✓' : '✗'}`);
        lines.push(`**Time:** ${inv.timestamp.toISOString()}`);
        if (inv.output.summary) {
          lines.push(`**Summary:** ${inv.output.summary}`);
        }
        if (inv.error) {
          lines.push(`**Error:** ${inv.error}`);
        }
        lines.push('');
      });
    }

    // Elements Discovered
    lines.push('## Elements Discovered');
    if (context.elementsDiscovered.length === 0) {
      lines.push('No reliable elements discovered yet.');
    } else {
      context.elementsDiscovered.forEach((elem, index) => {
        lines.push(`### ${index + 1}. ${elem.elementType} (${Math.round(elem.confidence * 100)}% confidence)`);
        lines.push(`**Selector:** \`${elem.selector}\``);
        lines.push(`**Method:** ${elem.discoveryMethod}`);
        lines.push(`**Reliable:** ${elem.isReliable ? 'Yes' : 'No'}`);
        lines.push('');
      });
    }

    // Suggested Investigations
    lines.push('## Suggested Next Investigations');
    context.suggestedInvestigations.forEach((suggestion, index) => {
      lines.push(`### ${index + 1}. ${suggestion.type} (Priority: ${suggestion.priority})`);
      lines.push(`**Purpose:** ${suggestion.purpose}`);
      lines.push(`**Reasoning:** ${suggestion.reasoning}`);
      lines.push('');
    });

    // Investigation Priority
    lines.push('## Investigation Priority');
    lines.push(`**Primary:** ${context.investigationPriority.primary}`);
    lines.push(`**Fallbacks:** ${context.investigationPriority.fallbacks.join(', ')}`);
    lines.push(`**Reasoning:** ${context.investigationPriority.reasoning}`);

    return lines.join('\n');
  }
}
