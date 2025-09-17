/**
 * Event Publisher Implementation
 * Handles event publishing, validation, and filtering
 */

import { v4 as uuidv4 } from 'uuid';
import {
  StreamEvent,
  StreamEventType,
  StreamEventData,
  CommandAction,
  CommandStatus,
  ScreenshotInfo,
  VariableInfo
} from '../../../types/shared-types';
import {
  IEventPublisher,
  StreamClient,
  StreamFilter,
  ErrorContext,
  EventValidationResult
} from './types';

export class EventPublisher implements IEventPublisher {
  
  // Core publishing methods
  async publishReasoning(
    sessionId: string, 
    thought: string, 
    confidence: number, 
    reasoningType: string, 
    context?: Record<string, any>
  ): Promise<void> {
    const event: StreamEvent = {
      id: uuidv4(),
      type: StreamEventType.AI_REASONING,
      timestamp: new Date(),
      sessionId,
      data: {
        reasoning: {
          thought,
          confidence,
          reasoningType: reasoningType as any,
          context
        }
      }
    };

    await this.publishEvent(event);
  }

  async publishCommandStarted(
    sessionId: string, 
    commandName: string, 
    action: CommandAction, 
    parameters: Record<string, any>
  ): Promise<void> {
    const event: StreamEvent = {
      id: uuidv4(),
      type: StreamEventType.COMMAND_STARTED,
      timestamp: new Date(),
      sessionId,
      data: {
        command: {
          commandId: commandName,
          action,
          parameters: parameters as any,
          status: CommandStatus.EXECUTING
        }
      }
    };

    await this.publishEvent(event);
  }

  async publishCommandCompleted(
    sessionId: string, 
    commandName: string, 
    result: Record<string, any>, 
    duration: number
  ): Promise<void> {
    const event: StreamEvent = {
      id: uuidv4(),
      type: StreamEventType.COMMAND_COMPLETED,
      timestamp: new Date(),
      sessionId,
      data: {
        command: {
          commandId: commandName,
          action: CommandAction.CLICK_ELEMENT, // This would need to be tracked from the original command
          parameters: {},
          status: CommandStatus.COMPLETED,
          duration,
          result: result as any
        }
      }
    };

    await this.publishEvent(event);
  }

  async publishCommandFailed(
    sessionId: string, 
    commandName: string, 
    error: ErrorContext, 
    duration: number
  ): Promise<void> {
    const event: StreamEvent = {
      id: uuidv4(),
      type: StreamEventType.COMMAND_FAILED,
      timestamp: new Date(),
      sessionId,
      data: {
        command: {
          commandId: commandName,
          action: CommandAction.CLICK_ELEMENT, // This would need to be tracked from the original command
          parameters: {},
          status: CommandStatus.FAILED,
          duration
        },
        error
      }
    };

    await this.publishEvent(event);
  }

  async publishScreenshot(sessionId: string, screenshotInfo: ScreenshotInfo): Promise<void> {
    const event: StreamEvent = {
      id: uuidv4(),
      type: StreamEventType.SCREENSHOT_CAPTURED,
      timestamp: new Date(),
      sessionId,
      data: {
        screenshot: screenshotInfo
      }
    };

    await this.publishEvent(event);
  }

  async publishVariableUpdate(
    sessionId: string, 
    name: string, 
    value: string, 
    previousValue?: string
  ): Promise<void> {
    const variableInfo: VariableInfo = {
      name,
      value,
      previousValue,
      timestamp: new Date(),
      sessionId,
      source: 'extracted'
    };

    const event: StreamEvent = {
      id: uuidv4(),
      type: StreamEventType.VARIABLE_UPDATED,
      timestamp: new Date(),
      sessionId,
      data: {
        variable: variableInfo
      }
    };

    await this.publishEvent(event);
  }

  async publishStatus(
    sessionId: string, 
    type: string, 
    status: string, 
    message: string
  ): Promise<void> {
    const event: StreamEvent = {
      id: uuidv4(),
      type: StreamEventType.SESSION_STATUS,
      timestamp: new Date(),
      sessionId,
      data: {
        message,
        details: { type, status }
      }
    };

    await this.publishEvent(event);
  }

  async publishError(sessionId: string, error: ErrorContext): Promise<void> {
    const event: StreamEvent = {
      id: uuidv4(),
      type: StreamEventType.ERROR_OCCURRED,
      timestamp: new Date(),
      sessionId,
      data: {
        error
      }
    };

    await this.publishEvent(event);
  }

  // Private helper to handle actual event publishing
  private async publishEvent(event: StreamEvent): Promise<void> {
    // In a real implementation, this would:
    // 1. Validate the event
    // 2. Add to stream histories
    // 3. Broadcast to connected clients
    // 4. Handle persistence if enabled
    
    // For now, this is a placeholder
    console.log('Publishing event:', event.type, 'for session:', event.sessionId);
  }

  // Event validation
  validateEvent(event: StreamEvent): EventValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required fields
    if (!event.id || event.id.trim() === '') {
      errors.push('Event ID is required and cannot be empty');
    }

    if (!event.sessionId || event.sessionId.trim() === '') {
      errors.push('Session ID is required and cannot be empty');
    }

    if (!Object.values(StreamEventType).includes(event.type)) {
      errors.push(`Invalid event type: ${event.type}`);
    }

    if (!(event.timestamp instanceof Date)) {
      errors.push('Timestamp must be a Date object');
    }

    if (!event.data) {
      errors.push('Event data is required');
    }

    // Check for future timestamps (suspicious)
    if (event.timestamp instanceof Date) {
      const now = new Date();
      const timeDiff = event.timestamp.getTime() - now.getTime();
      if (timeDiff > 60000) { // More than 1 minute in the future
        warnings.push('Event timestamp is significantly in the future');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Event filtering
  filterEventsForClient(events: StreamEvent[], client: StreamClient): StreamEvent[] {
    if (!client.filters || client.filters.length === 0) {
      return events;
    }

    return events.filter(event => {
      // OR logic between filters - event passes if it matches ANY filter
      return client.filters!.some(filter => this.shouldEventPassFilter(event, filter));
    });
  }

  shouldEventPassFilter(event: StreamEvent, filter: StreamFilter): boolean {
    try {
      // Event type filter
      if (filter.eventTypes && filter.eventTypes.length > 0) {
        if (!filter.eventTypes.includes(event.type)) {
          return false;
        }
      }

      // Session ID filter
      if (filter.sessionIds && filter.sessionIds.length > 0) {
        if (!filter.sessionIds.includes(event.sessionId)) {
          return false;
        }
      }

      // Time range filter
      if (filter.timeRange) {
        const eventTime = event.timestamp.getTime();
        const startTime = filter.timeRange.start.getTime();
        const endTime = filter.timeRange.end.getTime();
        
        if (eventTime < startTime || eventTime > endTime) {
          return false;
        }
      }

      // Custom filter
      if (filter.customFilter) {
        return filter.customFilter(event);
      }

      return true;
    } catch (error) {
      // Filter errors should not crash the system
      console.warn('Error in event filter:', error);
      return false;
    }
  }

  // Serialization
  serializeEvent(event: StreamEvent): string {
    try {
      return JSON.stringify(event, (key, value) => {
        // Convert Date objects to ISO strings
        if (value instanceof Date) {
          return value.toISOString();
        }
        return value;
      });
    } catch (error) {
      throw new Error(`Failed to serialize event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
