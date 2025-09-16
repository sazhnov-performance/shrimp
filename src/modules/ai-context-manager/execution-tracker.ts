import { 
  ExecutorCommand,
  CommandResponse,
  StreamEvent,
  StreamEventType
} from '../../../types/shared-types';
import {
  ExecutionEvent,
  StepExecution,
  SessionData,
  ContextManagerError,
  AIContextConfig,
  IContextStorageAdapter
} from './types';

export class ExecutionTracker {
  private config: AIContextConfig;
  private storageAdapter: IContextStorageAdapter;

  constructor(config: AIContextConfig, storageAdapter: IContextStorageAdapter) {
    this.config = config;
    this.storageAdapter = storageAdapter;
  }

  // Event Management

  async addExecutionEvent(
    sessionData: SessionData,
    stepIndex: number,
    command: ExecutorCommand,
    result: CommandResponse,
    reasoning?: string,
    screenshotId?: string
  ): Promise<string> {
    // Validate step index
    this.validateStepIndex(sessionData, stepIndex);

    // Get or create step execution
    let stepExecution = this.getOrCreateStepExecution(sessionData, stepIndex);

    // Check event limits
    if (stepExecution.events.length >= this.config.storage.maxEventsPerStep) {
      throw this.createError(
        'MAX_EVENTS_EXCEEDED',
        `Maximum events per step (${this.config.storage.maxEventsPerStep}) exceeded`,
        { stepIndex, currentEvents: stepExecution.events.length }
      );
    }

    // Create execution event
    const event: ExecutionEvent = {
      eventId: crypto.randomUUID(),
      timestamp: new Date(),
      reasoning: reasoning || '',
      executorMethod: command.action,
      executorCommand: command,
      commandResult: result,
      pageDom: result.dom,
      screenshotId,
      metadata: {
        duration: result.duration,
        success: result.success
      }
    };

    // Add event to step execution
    stepExecution.events.push(event);

    // Ensure temporal ordering
    this.ensureTemporalOrdering(stepExecution);

    // Update step execution in session data
    this.updateStepExecutionInSession(sessionData, stepExecution);

    // Update session activity
    sessionData.session.lastActivity = new Date();

    return event.eventId;
  }

  async addExecutionEventFromStream(
    sessionData: SessionData,
    stepIndex: number,
    streamEvent: StreamEvent
  ): Promise<string> {
    // Validate step index
    this.validateStepIndex(sessionData, stepIndex);

    // Extract relevant data from stream event
    const reasoning = streamEvent.data.reasoning?.thought || '';
    const executorMethod = this.extractExecutorMethodFromStream(streamEvent);
    const command = streamEvent.data.command?.commandId ? {
      sessionId: streamEvent.sessionId,
      action: streamEvent.data.command.action,
      parameters: streamEvent.data.command.parameters,
      commandId: streamEvent.data.command.commandId,
      timestamp: streamEvent.timestamp
    } as ExecutorCommand : undefined;

    const result = streamEvent.data.command?.result;

    // Get or create step execution
    let stepExecution = this.getOrCreateStepExecution(sessionData, stepIndex);

    // Create execution event
    const event: ExecutionEvent = {
      eventId: crypto.randomUUID(),
      timestamp: streamEvent.timestamp,
      reasoning,
      executorMethod,
      executorCommand: command,
      commandResult: result,
      pageDom: result?.dom || '',
      screenshotId: streamEvent.data.screenshot?.id,
      metadata: {
        streamEventId: streamEvent.id,
        streamEventType: streamEvent.type,
        ...streamEvent.data.details
      }
    };

    // Add event to step execution
    stepExecution.events.push(event);

    // Ensure temporal ordering
    this.ensureTemporalOrdering(stepExecution);

    // Update step execution in session data
    this.updateStepExecutionInSession(sessionData, stepExecution);

    // Update session activity
    sessionData.session.lastActivity = new Date();

    return event.eventId;
  }

  getExecutionEvents(sessionData: SessionData, stepIndex: number): ExecutionEvent[] {
    const stepExecution = sessionData.session.stepExecutions.find(
      se => se.stepIndex === stepIndex
    );

    if (!stepExecution) {
      return [];
    }

    // Return sorted copy of events
    return [...stepExecution.events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  getExecutionEvent(sessionData: SessionData, stepIndex: number, eventId: string): ExecutionEvent | null {
    const events = this.getExecutionEvents(sessionData, stepIndex);
    return events.find(event => event.eventId === eventId) || null;
  }

  // Event Querying and Analytics

  getEventsByTimeRange(
    sessionData: SessionData, 
    stepIndex: number, 
    startTime: Date, 
    endTime: Date
  ): ExecutionEvent[] {
    const events = this.getExecutionEvents(sessionData, stepIndex);
    return events.filter(event => 
      event.timestamp >= startTime && event.timestamp <= endTime
    );
  }

  getEventsByExecutorMethod(
    sessionData: SessionData, 
    stepIndex: number, 
    method: string
  ): ExecutionEvent[] {
    const events = this.getExecutionEvents(sessionData, stepIndex);
    return events.filter(event => event.executorMethod === method);
  }

  getEventsWithErrors(sessionData: SessionData, stepIndex: number): ExecutionEvent[] {
    const events = this.getExecutionEvents(sessionData, stepIndex);
    return events.filter(event => 
      event.commandResult && !event.commandResult.success
    );
  }

  getLastEvent(sessionData: SessionData, stepIndex: number): ExecutionEvent | null {
    const events = this.getExecutionEvents(sessionData, stepIndex);
    return events.length > 0 ? events[events.length - 1] : null;
  }

  getEventStatistics(sessionData: SessionData, stepIndex: number): {
    totalEvents: number;
    successfulEvents: number;
    failedEvents: number;
    averageDuration: number;
    totalDuration: number;
    methodCounts: Record<string, number>;
  } {
    const events = this.getExecutionEvents(sessionData, stepIndex);
    
    let successfulEvents = 0;
    let failedEvents = 0;
    let totalDuration = 0;
    const methodCounts: Record<string, number> = {};

    for (const event of events) {
      // Count by success/failure
      if (event.commandResult) {
        if (event.commandResult.success) {
          successfulEvents++;
        } else {
          failedEvents++;
        }
        totalDuration += event.commandResult.duration || 0;
      }

      // Count by method
      methodCounts[event.executorMethod] = (methodCounts[event.executorMethod] || 0) + 1;
    }

    return {
      totalEvents: events.length,
      successfulEvents,
      failedEvents,
      averageDuration: events.length > 0 ? totalDuration / events.length : 0,
      totalDuration,
      methodCounts
    };
  }

  // Event History Management

  getExecutionHistory(sessionData: SessionData): Array<{ stepIndex: number; events: ExecutionEvent[] }> {
    return sessionData.session.stepExecutions
      .sort((a, b) => a.stepIndex - b.stepIndex)
      .map(stepExecution => ({
        stepIndex: stepExecution.stepIndex,
        events: [...stepExecution.events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      }));
  }

  getAllEvents(sessionData: SessionData): ExecutionEvent[] {
    const allEvents: ExecutionEvent[] = [];
    
    for (const stepExecution of sessionData.session.stepExecutions) {
      allEvents.push(...stepExecution.events);
    }

    return allEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  getEventsCount(sessionData: SessionData): number {
    return sessionData.session.stepExecutions.reduce(
      (total, stepExecution) => total + stepExecution.events.length, 
      0
    );
  }

  // Event Filtering and Cleanup

  async filterEventsByConfidenceThreshold(
    sessionData: SessionData, 
    stepIndex: number, 
    threshold: number
  ): Promise<ExecutionEvent[]> {
    const events = this.getExecutionEvents(sessionData, stepIndex);
    return events.filter(event => {
      const confidence = event.metadata?.confidence;
      return typeof confidence === 'number' ? confidence >= threshold : true;
    });
  }

  async cleanupOldEvents(sessionData: SessionData, retentionMs: number): Promise<number> {
    const cutoffTime = new Date(Date.now() - retentionMs);
    let cleanedCount = 0;

    for (const stepExecution of sessionData.session.stepExecutions) {
      const originalCount = stepExecution.events.length;
      stepExecution.events = stepExecution.events.filter(
        event => event.timestamp >= cutoffTime
      );
      cleanedCount += originalCount - stepExecution.events.length;
    }

    if (cleanedCount > 0) {
      sessionData.session.lastActivity = new Date();
    }

    return cleanedCount;
  }

  // DOM Data Management

  getLatestPageDom(sessionData: SessionData, stepIndex: number): string | null {
    const lastEvent = this.getLastEvent(sessionData, stepIndex);
    return lastEvent?.pageDom || null;
  }

  getPreviousPageDom(sessionData: SessionData, stepIndex: number): string | null {
    if (stepIndex <= 0) {
      return null;
    }

    const lastEvent = this.getLastEvent(sessionData, stepIndex - 1);
    return lastEvent?.pageDom || null;
  }

  async compressDomData(sessionData: SessionData): Promise<number> {
    let compressionSavings = 0;

    for (const stepExecution of sessionData.session.stepExecutions) {
      for (const event of stepExecution.events) {
        if (event.pageDom && event.pageDom.length > this.config.compression.threshold) {
          const originalSize = event.pageDom.length;
          event.pageDom = this.compressDOM(event.pageDom);
          compressionSavings += originalSize - event.pageDom.length;
        }
      }
    }

    return compressionSavings;
  }

  // Private Helper Methods

  private validateStepIndex(sessionData: SessionData, stepIndex: number): void {
    if (stepIndex < 0 || stepIndex >= sessionData.session.steps.length) {
      throw this.createError(
        'INVALID_STEP_INDEX',
        `Step index ${stepIndex} is out of range`,
        { stepIndex, maxIndex: sessionData.session.steps.length - 1 }
      );
    }
  }

  private getOrCreateStepExecution(sessionData: SessionData, stepIndex: number): StepExecution {
    let stepExecution = sessionData.session.stepExecutions.find(
      se => se.stepIndex === stepIndex
    );

    if (!stepExecution) {
      stepExecution = {
        stepIndex,
        stepName: sessionData.session.steps[stepIndex],
        events: [],
        startTime: new Date(),
        status: 'ACTIVE' as any
      };
      sessionData.session.stepExecutions.push(stepExecution);
      sessionData.session.stepExecutions.sort((a, b) => a.stepIndex - b.stepIndex);
    }

    return stepExecution;
  }

  private updateStepExecutionInSession(sessionData: SessionData, stepExecution: StepExecution): void {
    const index = sessionData.session.stepExecutions.findIndex(
      se => se.stepIndex === stepExecution.stepIndex
    );

    if (index >= 0) {
      sessionData.session.stepExecutions[index] = stepExecution;
    }
  }

  private ensureTemporalOrdering(stepExecution: StepExecution): void {
    stepExecution.events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private extractExecutorMethodFromStream(streamEvent: StreamEvent): string {
    if (streamEvent.data.command?.action) {
      return streamEvent.data.command.action;
    }

    // Extract method from event type
    switch (streamEvent.type) {
      case StreamEventType.COMMAND_STARTED:
      case StreamEventType.COMMAND_COMPLETED:
      case StreamEventType.COMMAND_FAILED:
        return streamEvent.data.command?.action || 'UNKNOWN_COMMAND';
      case StreamEventType.SCREENSHOT_CAPTURED:
        return 'SCREENSHOT';
      case StreamEventType.PAGE_NAVIGATED:
        return 'NAVIGATE';
      case StreamEventType.VARIABLE_UPDATED:
        return 'SAVE_VARIABLE';
      default:
        return 'UNKNOWN';
    }
  }

  private compressDOM(dom: string): string {
    // Simple DOM compression - remove whitespace and comments
    return dom
      .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
      .replace(/>\s+</g, '><') // Remove whitespace between tags
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim();
  }

  private createError(code: string, message: string, details?: Record<string, any>): ContextManagerError {
    return {
      id: crypto.randomUUID(),
      category: 'EXECUTION' as any,
      severity: 'MEDIUM' as any,
      code,
      message,
      details,
      timestamp: new Date(),
      moduleId: 'ai-context-manager',
      recoverable: true,
      retryable: false,
      suggestedAction: this.getSuggestedAction(code)
    };
  }

  private getSuggestedAction(code: string): string {
    switch (code) {
      case 'INVALID_STEP_INDEX':
        return 'Verify step index is within valid range';
      case 'MAX_EVENTS_EXCEEDED':
        return 'Consider increasing maxEventsPerStep or cleaning up old events';
      default:
        return 'Review execution tracking configuration and try again';
    }
  }

  // Event Export and Import

  exportEvents(sessionData: SessionData, format: 'json' | 'csv' = 'json'): string {
    const allEvents = this.getAllEvents(sessionData);
    
    if (format === 'csv') {
      const headers = ['eventId', 'timestamp', 'stepIndex', 'executorMethod', 'reasoning', 'success', 'duration'];
      const rows = allEvents.map(event => [
        event.eventId,
        event.timestamp.toISOString(),
        sessionData.session.stepExecutions.find(se => se.events.includes(event))?.stepIndex || -1,
        event.executorMethod,
        event.reasoning.replace(/"/g, '""'), // Escape quotes for CSV
        event.commandResult?.success || false,
        event.commandResult?.duration || 0
      ]);
      
      return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    }
    
    return JSON.stringify(allEvents, null, 2);
  }

  getEventMetrics(sessionData: SessionData): {
    totalEvents: number;
    eventsPerStep: number;
    successRate: number;
    averageExecutionTime: number;
    mostUsedMethods: Array<{ method: string; count: number }>;
  } {
    const allEvents = this.getAllEvents(sessionData);
    const successfulEvents = allEvents.filter(e => e.commandResult?.success).length;
    const totalDuration = allEvents.reduce((sum, e) => sum + (e.commandResult?.duration || 0), 0);
    
    // Count methods
    const methodCounts: Record<string, number> = {};
    allEvents.forEach(event => {
      methodCounts[event.executorMethod] = (methodCounts[event.executorMethod] || 0) + 1;
    });

    const mostUsedMethods = Object.entries(methodCounts)
      .map(([method, count]) => ({ method, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalEvents: allEvents.length,
      eventsPerStep: sessionData.session.steps.length > 0 ? 
        allEvents.length / sessionData.session.steps.length : 0,
      successRate: allEvents.length > 0 ? successfulEvents / allEvents.length : 0,
      averageExecutionTime: allEvents.length > 0 ? totalDuration / allEvents.length : 0,
      mostUsedMethods
    };
  }
}
