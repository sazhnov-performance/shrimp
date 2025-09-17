/**
 * Event Publisher - Handles publishing and validation of stream events
 * Manages event publishing to all connected clients with filtering and validation
 */

import {
  StreamEvent,
  StreamEventType,
  StreamEventData,
  CommandAction
} from '../../../types/shared-types';

import {
  IStreamPublisher,
  StreamSession,
  StreamClient,
  StreamFilter,
  ErrorContext,
  ScreenshotInfo,
  EventValidator,
  EventValidationResult
} from './types';

export class EventPublisher implements IStreamPublisher {
  private eventValidator: EventValidator;

  constructor() {
    this.eventValidator = new StreamEventValidator();
  }

  // AI Reasoning methods
  async publishReasoning(
    sessionId: string, 
    thought: string, 
    confidence: number, 
    type: string, 
    context?: Record<string, any>
  ): Promise<void> {
    const event: StreamEvent = {
      id: this.generateEventId(),
      type: StreamEventType.AI_REASONING,
      timestamp: new Date(),
      sessionId,
      data: {
        reasoning: {
          thought,
          confidence,
          reasoningType: type as any,
          context
        }
      }
    };

    await this.publishEvent(sessionId, event);
  }

  // Command execution methods
  async publishCommandStarted(
    sessionId: string, 
    commandName: string, 
    action: CommandAction, 
    parameters: Record<string, any>
  ): Promise<void> {
    const event: StreamEvent = {
      id: this.generateEventId(),
      type: StreamEventType.COMMAND_STARTED,
      timestamp: new Date(),
      sessionId,
      data: {
        command: {
          commandId: commandName,
          action,
          parameters,
          status: 'EXECUTING' as any
        }
      }
    };

    await this.publishEvent(sessionId, event);
  }

  async publishCommandCompleted(
    sessionId: string, 
    commandName: string, 
    result: any, 
    duration: number
  ): Promise<void> {
    const event: StreamEvent = {
      id: this.generateEventId(),
      type: StreamEventType.COMMAND_COMPLETED,
      timestamp: new Date(),
      sessionId,
      data: {
        command: {
          commandId: commandName,
          action: result.action || 'UNKNOWN' as CommandAction,
          parameters: result.parameters || {},
          status: 'COMPLETED' as any,
          duration,
          result
        }
      }
    };

    await this.publishEvent(sessionId, event);
  }

  async publishCommandFailed(
    sessionId: string, 
    commandName: string, 
    error: ErrorContext, 
    duration: number
  ): Promise<void> {
    const event: StreamEvent = {
      id: this.generateEventId(),
      type: StreamEventType.COMMAND_FAILED,
      timestamp: new Date(),
      sessionId,
      data: {
        command: {
          commandId: commandName,
          action: 'UNKNOWN' as CommandAction,
          parameters: {},
          status: 'FAILED' as any,
          duration
        },
        error
      }
    };

    await this.publishEvent(sessionId, event);
  }

  // Screenshot methods
  async publishScreenshot(sessionId: string, screenshotInfo: ScreenshotInfo): Promise<void> {
    const event: StreamEvent = {
      id: this.generateEventId(),
      type: StreamEventType.SCREENSHOT_CAPTURED,
      timestamp: new Date(),
      sessionId,
      stepIndex: screenshotInfo.stepIndex,
      data: {
        screenshot: screenshotInfo
      }
    };

    await this.publishEvent(sessionId, event);
  }

  // Variable methods
  async publishVariableUpdate(
    sessionId: string, 
    name: string, 
    value: string, 
    previousValue?: string
  ): Promise<void> {
    const event: StreamEvent = {
      id: this.generateEventId(),
      type: StreamEventType.VARIABLE_UPDATED,
      timestamp: new Date(),
      sessionId,
      data: {
        variable: {
          name,
          value,
          previousValue,
          timestamp: new Date(),
          sessionId,
          source: 'extracted' as any
        }
      }
    };

    await this.publishEvent(sessionId, event);
  }

  // Status methods
  async publishStatus(
    sessionId: string, 
    type: string, 
    status: string, 
    message?: string
  ): Promise<void> {
    const event: StreamEvent = {
      id: this.generateEventId(),
      type: StreamEventType.SESSION_STATUS,
      timestamp: new Date(),
      sessionId,
      data: {
        message,
        details: {
          type,
          status
        }
      }
    };

    await this.publishEvent(sessionId, event);
  }

  // Error methods
  async publishError(sessionId: string, error: ErrorContext): Promise<void> {
    const event: StreamEvent = {
      id: this.generateEventId(),
      type: StreamEventType.ERROR_OCCURRED,
      timestamp: new Date(),
      sessionId,
      data: {
        error
      }
    };

    await this.publishEvent(sessionId, event);
  }

  // Generic event publishing
  async publishEvent(sessionId: string, event: StreamEvent): Promise<void> {
    // Validate event
    const validation = this.eventValidator.validateEvent(event);
    if (!validation.isValid) {
      throw new Error(`Event validation failed: ${validation.errors.join(', ')}`);
    }

    // This method will be called by StreamManager to actually distribute the event
    // For now, this is a placeholder that would be integrated with the stream manager
    // The actual broadcasting will be handled by the main ExecutorStreamer class
  }

  // Event validation
  validateEvent(event: StreamEvent): EventValidationResult {
    return this.eventValidator.validateEvent(event);
  }

  // Utility methods
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Event filtering
  shouldEventPassFilter(event: StreamEvent, filter: StreamFilter): boolean {
    // Check event type filter
    if (filter.eventTypes && filter.eventTypes.length > 0) {
      if (!filter.eventTypes.includes(event.type)) {
        return false;
      }
    }

    // Check session ID filter
    if (filter.sessionIds && filter.sessionIds.length > 0) {
      if (!filter.sessionIds.includes(event.sessionId)) {
        return false;
      }
    }

    // Check time range filter
    if (filter.timeRange) {
      const eventTime = event.timestamp.getTime();
      const startTime = filter.timeRange.start.getTime();
      const endTime = filter.timeRange.end.getTime();
      
      if (eventTime < startTime || eventTime > endTime) {
        return false;
      }
    }

    // Check custom filter
    if (filter.customFilter) {
      try {
        return filter.customFilter(event);
      } catch (error) {
        // If custom filter throws, consider it failed
        return false;
      }
    }

    return true;
  }

  // Filter events for a client
  filterEventsForClient(events: StreamEvent[], client: StreamClient): StreamEvent[] {
    if (!client.filters || client.filters.length === 0) {
      return events;
    }

    return events.filter(event => {
      // Event passes if it matches ANY of the client's filters
      return client.filters!.some(filter => this.shouldEventPassFilter(event, filter));
    });
  }

  // Event serialization for transmission
  serializeEvent(event: StreamEvent): string {
    try {
      return JSON.stringify({
        id: event.id,
        type: event.type,
        timestamp: event.timestamp.toISOString(),
        sessionId: event.sessionId,
        stepIndex: event.stepIndex,
        data: event.data,
        metadata: event.metadata
      });
    } catch (error) {
      throw new Error(`Failed to serialize event: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Event compression (if enabled)
  async compressEvent(event: StreamEvent, algorithm: 'gzip' | 'brotli' = 'gzip'): Promise<Buffer> {
    const serialized = this.serializeEvent(event);
    
    // TODO: Implement actual compression
    // For now, just return the serialized data as buffer
    return Buffer.from(serialized, 'utf8');
  }
}

// Event Validator Implementation
class StreamEventValidator implements EventValidator {
  validateEvent(event: StreamEvent): EventValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required fields
    if (!event.id || typeof event.id !== 'string') {
      errors.push('Event ID is required and must be a string');
    }

    if (!event.type || !Object.values(StreamEventType).includes(event.type)) {
      errors.push('Valid event type is required');
    }

    if (!event.timestamp || !(event.timestamp instanceof Date)) {
      errors.push('Valid timestamp is required');
    }

    if (!event.sessionId || typeof event.sessionId !== 'string') {
      errors.push('Session ID is required and must be a string');
    }

    if (!event.data || typeof event.data !== 'object') {
      errors.push('Event data is required and must be an object');
    }

    // Validate event data based on type
    if (event.type && event.data) {
      const dataValid = this.validateEventData(event.type, event.data);
      if (!dataValid) {
        errors.push(`Event data is invalid for type: ${event.type}`);
      }
    }

    // Validate step index if present
    if (event.stepIndex !== undefined) {
      if (typeof event.stepIndex !== 'number' || event.stepIndex < 0) {
        errors.push('Step index must be a non-negative number');
      }
    }

    // Check event timestamp is not too far in the future
    const now = Date.now();
    if (event.timestamp instanceof Date) {
      const eventTime = event.timestamp.getTime();
      if (eventTime > now + 60000) { // 1 minute tolerance
        warnings.push('Event timestamp is in the future');
      }

      // Check event timestamp is not too old
      if (eventTime < now - 86400000) { // 24 hours old
        warnings.push('Event timestamp is more than 24 hours old');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  validateEventData(eventType: StreamEventType, data: StreamEventData): boolean {
    try {
      switch (eventType) {
        case StreamEventType.AI_REASONING:
          return this.validateReasoningData(data);
        
        case StreamEventType.COMMAND_STARTED:
        case StreamEventType.COMMAND_COMPLETED:
        case StreamEventType.COMMAND_FAILED:
          return this.validateCommandData(data);
        
        case StreamEventType.SCREENSHOT_CAPTURED:
          return this.validateScreenshotData(data);
        
        case StreamEventType.VARIABLE_UPDATED:
          return this.validateVariableData(data);
        
        case StreamEventType.ERROR_OCCURRED:
          return this.validateErrorData(data);
        
        case StreamEventType.SESSION_STATUS:
          return this.validateStatusData(data);
        
        default:
          // For unknown event types, just check that data exists
          return data !== null && data !== undefined;
      }
    } catch (error) {
      return false;
    }
  }

  private validateReasoningData(data: StreamEventData): boolean {
    return !!(data.reasoning?.thought && 
             typeof data.reasoning.confidence === 'number' &&
             data.reasoning.confidence >= 0 && 
             data.reasoning.confidence <= 1);
  }

  private validateCommandData(data: StreamEventData): boolean {
    return !!(data.command?.commandId && 
             data.command.action &&
             data.command.status);
  }

  private validateScreenshotData(data: StreamEventData): boolean {
    return !!(data.screenshot?.id && 
             data.screenshot.filePath &&
             data.screenshot.dimensions);
  }

  private validateVariableData(data: StreamEventData): boolean {
    return !!(data.variable?.name && 
             data.variable.value !== undefined);
  }

  private validateErrorData(data: StreamEventData): boolean {
    return !!(data.error?.id && 
             data.error.code && 
             data.error.message);
  }

  private validateStatusData(data: StreamEventData): boolean {
    return !!(data.details || data.message);
  }
}
