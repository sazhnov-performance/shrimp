import {
  AIContextJson,
  ExecutionFlowItem,
  SessionData,
  AIContextConfig,
  ExecutionEvent,
  ContextManagerError
} from './types';
import { SessionStatus } from '../../../types/shared-types';

export class ContextGenerator {
  private config: AIContextConfig;

  constructor(config: AIContextConfig) {
    this.config = config;
  }

  // Core Context Generation

  async generateContextJson(sessionData: SessionData, targetStep: number): Promise<AIContextJson> {
    // Validate inputs
    this.validateSessionData(sessionData);
    this.validateTargetStep(sessionData, targetStep);

    try {
      // Collect execution flow data
      const executionFlow = await this.collectExecutionFlow(sessionData, targetStep);

      // Extract page DOM states
      const { previousPageDom, currentPageDom } = await this.extractPageDomStates(sessionData, targetStep);

      // Generate summary information
      const summary = this.generateSummaryInformation(sessionData, targetStep);

      // Create context JSON
      const contextJson: AIContextJson = {
        sessionId: sessionData.session.linkedWorkflowSessionId,
        targetStep,
        generatedAt: new Date(),
        executionFlow,
        previousPageDom,
        currentPageDom,
        ...summary
      };

      return contextJson;
    } catch (error) {
      throw this.createError(
        'CONTEXT_GENERATION_FAILED',
        `Failed to generate context for step ${targetStep}`,
        { 
          targetStep, 
          sessionId: sessionData.session.sessionId,
          error: error instanceof Error ? error.message : String(error)
        }
      );
    }
  }

  // Execution Flow Collection

  private async collectExecutionFlow(sessionData: SessionData, targetStep: number): Promise<ExecutionFlowItem[]> {
    const executionFlow: ExecutionFlowItem[] = [];

    // Process steps from 0 to targetStep
    for (let stepIndex = 0; stepIndex <= targetStep; stepIndex++) {
      const stepExecution = sessionData.session.stepExecutions.find(se => se.stepIndex === stepIndex);
      
      if (stepExecution) {
        // Process all events in this step
        for (const event of stepExecution.events) {
          const flowItem = this.createExecutionFlowItem(stepExecution, event);
          if (flowItem) {
            executionFlow.push(flowItem);
          }
        }
      } else {
        // Create placeholder for steps that haven't been executed
        const stepName = sessionData.session.steps[stepIndex] || `Step ${stepIndex}`;
        executionFlow.push({
          stepIndex,
          stepName,
          reasoning: 'Step not yet executed',
          executorMethod: 'PENDING',
          timestamp: new Date(),
          status: SessionStatus.INITIALIZING
        });
      }
    }

    // Sort by timestamp to maintain chronological order
    return executionFlow.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private createExecutionFlowItem(stepExecution: any, event: ExecutionEvent): ExecutionFlowItem | null {
    // Skip events without meaningful content
    if (!event.reasoning && !event.executorMethod) {
      return null;
    }

    return {
      stepIndex: stepExecution.stepIndex,
      stepName: stepExecution.stepName,
      reasoning: event.reasoning || 'No reasoning provided',
      executorMethod: event.executorMethod,
      timestamp: event.timestamp,
      status: stepExecution.status,
      screenshotId: event.screenshotId
    };
  }

  // Page DOM State Extraction

  private async extractPageDomStates(
    sessionData: SessionData, 
    targetStep: number
  ): Promise<{ previousPageDom?: string; currentPageDom?: string }> {
    let previousPageDom: string | undefined;
    let currentPageDom: string | undefined;

    // Get DOM from step (targetStep - 1) if available
    if (targetStep > 0) {
      previousPageDom = this.getLastDomFromStep(sessionData, targetStep - 1);
    }

    // Get DOM from targetStep if available
    currentPageDom = this.getLastDomFromStep(sessionData, targetStep);

    // Apply compression if enabled
    if (this.config.compression.enabled) {
      if (previousPageDom && previousPageDom.length > this.config.compression.threshold) {
        previousPageDom = this.compressDOM(previousPageDom);
      }
      if (currentPageDom && currentPageDom.length > this.config.compression.threshold) {
        currentPageDom = this.compressDOM(currentPageDom);
      }
    }

    return { previousPageDom, currentPageDom };
  }

  private getLastDomFromStep(sessionData: SessionData, stepIndex: number): string | undefined {
    const stepExecution = sessionData.session.stepExecutions.find(se => se.stepIndex === stepIndex);
    
    if (!stepExecution || stepExecution.events.length === 0) {
      return undefined;
    }

    // Find the last event with a DOM
    for (let i = stepExecution.events.length - 1; i >= 0; i--) {
      const event = stepExecution.events[i];
      if (event.pageDom && event.pageDom.trim().length > 0) {
        return event.pageDom;
      }
    }

    return undefined;
  }

  // Summary Information Generation

  private generateSummaryInformation(sessionData: SessionData, targetStep: number): {
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
  } {
    const totalSteps = sessionData.session.steps.length;
    let completedSteps = 0;
    let failedSteps = 0;

    // Count step statuses up to target step
    for (let i = 0; i <= Math.min(targetStep, totalSteps - 1); i++) {
      const stepExecution = sessionData.session.stepExecutions.find(se => se.stepIndex === i);
      
      if (stepExecution) {
        switch (stepExecution.status) {
          case SessionStatus.COMPLETED:
            completedSteps++;
            break;
          case SessionStatus.FAILED:
          case SessionStatus.CANCELLED:
            failedSteps++;
            break;
        }
      }
    }

    return {
      totalSteps,
      completedSteps,
      failedSteps
    };
  }

  // Context Optimization

  async optimizeContextForSize(context: AIContextJson, maxSizeBytes: number): Promise<AIContextJson> {
    let currentSize = this.calculateContextSize(context);
    
    if (currentSize <= maxSizeBytes) {
      return context;
    }

    const optimizedContext = { ...context };

    // Step 1: Compress DOM content more aggressively
    if (optimizedContext.previousPageDom) {
      optimizedContext.previousPageDom = this.aggressivelyCompressDOM(optimizedContext.previousPageDom);
    }
    if (optimizedContext.currentPageDom) {
      optimizedContext.currentPageDom = this.aggressivelyCompressDOM(optimizedContext.currentPageDom);
    }

    currentSize = this.calculateContextSize(optimizedContext);
    if (currentSize <= maxSizeBytes) {
      return optimizedContext;
    }

    // Step 2: Reduce execution flow detail
    optimizedContext.executionFlow = this.trimExecutionFlow(optimizedContext.executionFlow, maxSizeBytes * 0.6);

    currentSize = this.calculateContextSize(optimizedContext);
    if (currentSize <= maxSizeBytes) {
      return optimizedContext;
    }

    // Step 3: Remove DOM content if still too large
    if (optimizedContext.currentPageDom && optimizedContext.currentPageDom.length > 10000) {
      optimizedContext.currentPageDom = this.createDOMSummary(optimizedContext.currentPageDom);
    }
    if (optimizedContext.previousPageDom && optimizedContext.previousPageDom.length > 10000) {
      optimizedContext.previousPageDom = this.createDOMSummary(optimizedContext.previousPageDom);
    }

    return optimizedContext;
  }

  // Context Analysis

  analyzeContextQuality(context: AIContextJson): {
    quality: 'high' | 'medium' | 'low';
    issues: string[];
    recommendations: string[];
    metrics: {
      executionFlowCompleteness: number;
      domContentAvailability: number;
      temporalCoverage: number;
      overallScore: number;
    };
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Analyze execution flow completeness
    const expectedEvents = context.targetStep + 1;
    const actualEvents = context.executionFlow.length;
    const executionFlowCompleteness = actualEvents / expectedEvents;

    if (executionFlowCompleteness < 0.5) {
      issues.push('Significant gaps in execution flow');
      recommendations.push('Ensure all step executions are properly recorded');
    }

    // Analyze DOM content availability
    let domContentAvailability = 0;
    if (context.currentPageDom) domContentAvailability += 0.6;
    if (context.previousPageDom) domContentAvailability += 0.4;

    if (domContentAvailability < 0.6) {
      issues.push('Limited page DOM content available');
      recommendations.push('Ensure DOM capture is working correctly');
    }

    // Analyze temporal coverage
    const timeSpan = context.executionFlow.length > 1 ? 
      context.executionFlow[context.executionFlow.length - 1].timestamp.getTime() - 
      context.executionFlow[0].timestamp.getTime() : 0;
    const temporalCoverage = timeSpan > 0 ? Math.min(1, timeSpan / (1000 * 60 * 30)) : 0; // 30 minutes max

    // Calculate overall score
    const overallScore = (executionFlowCompleteness * 0.4 + domContentAvailability * 0.4 + temporalCoverage * 0.2);

    let quality: 'high' | 'medium' | 'low';
    if (overallScore >= 0.8) {
      quality = 'high';
    } else if (overallScore >= 0.5) {
      quality = 'medium';
    } else {
      quality = 'low';
      recommendations.push('Consider collecting more execution data before proceeding');
    }

    return {
      quality,
      issues,
      recommendations,
      metrics: {
        executionFlowCompleteness,
        domContentAvailability,
        temporalCoverage,
        overallScore
      }
    };
  }

  // Context Export and Formatting

  exportContextAsMarkdown(context: AIContextJson): string {
    const lines: string[] = [];
    
    lines.push(`# AI Context - Session ${context.sessionId}`);
    lines.push(`Generated: ${context.generatedAt.toISOString()}`);
    lines.push(`Target Step: ${context.targetStep}`);
    lines.push('');

    // Summary
    lines.push('## Summary');
    lines.push(`- Total Steps: ${context.totalSteps}`);
    lines.push(`- Completed Steps: ${context.completedSteps}`);
    lines.push(`- Failed Steps: ${context.failedSteps}`);
    lines.push('');

    // Execution Flow
    lines.push('## Execution Flow');
    context.executionFlow.forEach((item, index) => {
      lines.push(`### ${index + 1}. ${item.stepName} (Step ${item.stepIndex})`);
      lines.push(`**Status:** ${item.status}`);
      lines.push(`**Method:** ${item.executorMethod}`);
      lines.push(`**Time:** ${item.timestamp.toISOString()}`);
      lines.push(`**Reasoning:** ${item.reasoning}`);
      if (item.screenshotId) {
        lines.push(`**Screenshot:** ${item.screenshotId}`);
      }
      lines.push('');
    });

    // Page Content Summary
    if (context.currentPageDom || context.previousPageDom) {
      lines.push('## Page Content');
      if (context.previousPageDom) {
        lines.push(`**Previous Page DOM:** ${context.previousPageDom.length} characters`);
      }
      if (context.currentPageDom) {
        lines.push(`**Current Page DOM:** ${context.currentPageDom.length} characters`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  // Helper Methods

  private calculateContextSize(context: AIContextJson): number {
    return JSON.stringify(context).length;
  }

  private compressDOM(dom: string): string {
    return dom
      .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
      .replace(/>\s+</g, '><') // Remove whitespace between tags
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim();
  }

  private aggressivelyCompressDOM(dom: string): string {
    return this.compressDOM(dom)
      .replace(/<script[\s\S]*?<\/script>/gi, '') // Remove scripts
      .replace(/<style[\s\S]*?<\/style>/gi, '') // Remove styles
      .replace(/\s(class|id|style)="[^"]*"/g, '') // Remove attributes
      .substring(0, 50000); // Truncate to 50KB
  }

  private createDOMSummary(dom: string): string {
    const titleMatch = dom.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : 'Unknown page';
    
    const bodyStart = dom.indexOf('<body');
    const bodyContent = bodyStart > -1 ? dom.substring(bodyStart, bodyStart + 1000) : dom.substring(0, 1000);
    
    return `Page: ${title}\nBody preview: ${this.compressDOM(bodyContent)}...`;
  }

  private trimExecutionFlow(flow: ExecutionFlowItem[], targetSizeBytes: number): ExecutionFlowItem[] {
    // Keep the most recent and most important items
    const sortedFlow = [...flow].sort((a, b) => {
      // Prioritize by step index (more recent) and status (completed/failed over pending)
      const stepPriority = b.stepIndex - a.stepIndex;
      const statusPriority = this.getStatusPriority(b.status) - this.getStatusPriority(a.status);
      return stepPriority * 1000 + statusPriority;
    });

    // Keep items until we reach the size limit
    const trimmedFlow: ExecutionFlowItem[] = [];
    let currentSize = 0;

    for (const item of sortedFlow) {
      const itemSize = JSON.stringify(item).length;
      if (currentSize + itemSize <= targetSizeBytes) {
        trimmedFlow.push(item);
        currentSize += itemSize;
      } else {
        break;
      }
    }

    // Sort back to chronological order
    return trimmedFlow.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private getStatusPriority(status: SessionStatus): number {
    switch (status) {
      case SessionStatus.COMPLETED: return 3;
      case SessionStatus.FAILED: return 2;
      case SessionStatus.ACTIVE: return 1;
      default: return 0;
    }
  }

  private validateSessionData(sessionData: SessionData): void {
    if (!sessionData) {
      throw this.createError('INVALID_SESSION_DATA', 'Session data is required');
    }

    if (!sessionData.session) {
      throw this.createError('INVALID_SESSION_DATA', 'Session information is required');
    }

    if (!Array.isArray(sessionData.session.steps)) {
      throw this.createError('INVALID_SESSION_DATA', 'Session steps must be an array');
    }

    if (!Array.isArray(sessionData.session.stepExecutions)) {
      throw this.createError('INVALID_SESSION_DATA', 'Step executions must be an array');
    }
  }

  private validateTargetStep(sessionData: SessionData, targetStep: number): void {
    if (typeof targetStep !== 'number' || targetStep < 0) {
      throw this.createError(
        'INVALID_TARGET_STEP',
        'Target step must be a non-negative number',
        { targetStep }
      );
    }

    if (targetStep >= sessionData.session.steps.length) {
      throw this.createError(
        'TARGET_STEP_OUT_OF_RANGE',
        `Target step ${targetStep} is beyond the available steps (0-${sessionData.session.steps.length - 1})`,
        { targetStep, maxStep: sessionData.session.steps.length - 1 }
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
      case 'CONTEXT_GENERATION_FAILED':
        return 'Check session data integrity and retry context generation';
      case 'INVALID_SESSION_DATA':
        return 'Ensure session data is properly initialized';
      case 'INVALID_TARGET_STEP':
        return 'Provide a valid target step index';
      case 'TARGET_STEP_OUT_OF_RANGE':
        return 'Use a target step within the available range';
      default:
        return 'Review context generation parameters and try again';
    }
  }

  // Context Validation

  validateGeneratedContext(context: AIContextJson): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields validation
    if (!context.sessionId) {
      errors.push('Session ID is required');
    }

    if (typeof context.targetStep !== 'number') {
      errors.push('Target step must be a number');
    }

    if (!context.generatedAt || !(context.generatedAt instanceof Date)) {
      errors.push('Generated timestamp is required');
    }

    if (!Array.isArray(context.executionFlow)) {
      errors.push('Execution flow must be an array');
    }

    // Warnings for potential issues
    if (context.executionFlow.length === 0) {
      warnings.push('No execution flow data available');
    }

    if (!context.currentPageDom && !context.previousPageDom) {
      warnings.push('No page DOM content available');
    }

    if (context.completedSteps === 0 && context.targetStep > 0) {
      warnings.push('No completed steps found');
    }

    const contextSize = this.calculateContextSize(context);
    if (contextSize > this.config.contextFiltering.maxContextSize) {
      warnings.push(`Context size (${contextSize}) exceeds recommended limit`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}
