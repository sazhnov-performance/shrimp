/**
 * Streaming API Implementation
 * Handles stream details and history endpoints
 */

import { v4 as uuidv4 } from 'uuid';
import {
  StreamEvent,
  StreamEventType
} from '../../../../types/shared-types';
import {
  StreamingAPI,
  StreamDetailsResponse,
  StreamHistoryQuery,
  StreamHistoryResponse,
  FrontendAPIConfig
} from '../types';
import { FrontendAPIErrorHandler } from '../error-handler';

export class StreamingAPIImpl implements StreamingAPI {
  private config: FrontendAPIConfig;
  private errorHandler: FrontendAPIErrorHandler;
  private executorStreamer?: any; // IExecutorStreamer interface

  constructor(config: FrontendAPIConfig, errorHandler: FrontendAPIErrorHandler) {
    this.config = config;
    this.errorHandler = errorHandler;
  }

  /**
   * Initialize with executor streamer integration
   */
  async initialize?(executorStreamer: any): Promise<void> {
    this.executorStreamer = executorStreamer;
  }

  /**
   * Gets detailed information about a stream
   */
  async getStreamDetails(streamId: string): Promise<StreamDetailsResponse> {
    try {
      if (!this.executorStreamer) {
        throw new Error('Executor streamer not initialized');
      }

      // Get stream information from executor streamer
      const streamInfo = await this.executorStreamer.getStreamInfo?.(streamId);
      if (!streamInfo) {
        throw this.errorHandler.createNotFoundErrorResponse('Stream', streamId);
      }

      // Get client count and event count
      const clientCount = await this.executorStreamer.getClientCount?.(streamId) || 0;
      const eventCount = await this.executorStreamer.getEventCount?.(streamId) || 0;

      return {
        streamId,
        sessionId: streamInfo.sessionId || 'unknown',
        status: this.mapStreamStatus(streamInfo.status),
        clientCount,
        eventCount,
        createdAt: streamInfo.createdAt?.toISOString() || new Date().toISOString(),
        lastActivity: streamInfo.lastActivity?.toISOString() || new Date().toISOString(),
        config: {
          maxHistorySize: streamInfo.config?.maxHistorySize || this.config.executorStreamer.heartbeatInterval,
          enableReplay: streamInfo.config?.enableReplay || true,
          compressionEnabled: streamInfo.config?.compressionEnabled || true
        }
      };

    } catch (error) {
      if (error.data) {
        throw error; // Already a formatted error response
      }
      throw this.errorHandler.wrapError(error);
    }
  }

  /**
   * Gets stream event history with filtering and pagination
   */
  async getStreamHistory(streamId: string, query: StreamHistoryQuery): Promise<StreamHistoryResponse> {
    try {
      if (!this.executorStreamer) {
        throw new Error('Executor streamer not initialized');
      }

      // Verify stream exists
      const streamInfo = await this.executorStreamer.getStreamInfo?.(streamId);
      if (!streamInfo) {
        throw this.errorHandler.createNotFoundErrorResponse('Stream', streamId);
      }

      // Get events from executor streamer
      let events: StreamEvent[] = [];
      
      try {
        events = await this.executorStreamer.getEventHistory?.(streamId, {
          eventTypes: query.types,
          limit: Math.min(query.limit || 100, 1000), // Cap at 1000
          offset: query.offset || 0,
          startTime: query.startTime ? new Date(query.startTime) : undefined,
          endTime: query.endTime ? new Date(query.endTime) : undefined
        }) || [];
      } catch (e) {
        // Events might not be available or streamer might not support history
        events = [];
      }

      // Apply client-side filtering if needed (in case streamer doesn't support all filters)
      let filteredEvents = events;

      if (query.types && query.types.length > 0) {
        const eventTypes = query.types.map(type => type as StreamEventType);
        filteredEvents = events.filter(event => eventTypes.includes(event.type));
      }

      if (query.startTime) {
        const startTime = new Date(query.startTime);
        filteredEvents = filteredEvents.filter(event => event.timestamp >= startTime);
      }

      if (query.endTime) {
        const endTime = new Date(query.endTime);
        filteredEvents = filteredEvents.filter(event => event.timestamp <= endTime);
      }

      // Apply pagination if not already done by streamer
      const offset = query.offset || 0;
      const limit = Math.min(query.limit || 100, 1000);
      const paginatedEvents = filteredEvents.slice(offset, offset + limit);

      return {
        streamId,
        events: paginatedEvents,
        total: filteredEvents.length,
        filters: {
          types: query.types,
          limit,
          offset,
          startTime: query.startTime,
          endTime: query.endTime
        }
      };

    } catch (error) {
      if (error.data) {
        throw error; // Already a formatted error response
      }
      throw this.errorHandler.wrapError(error);
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private mapStreamStatus(status: any): 'active' | 'inactive' | 'completed' {
    if (!status) {
      return 'inactive';
    }

    const statusStr = status.toString().toLowerCase();
    
    if (statusStr.includes('active') || statusStr.includes('running') || statusStr.includes('streaming')) {
      return 'active';
    }
    
    if (statusStr.includes('completed') || statusStr.includes('finished') || statusStr.includes('done')) {
      return 'completed';
    }
    
    return 'inactive';
  }

  /**
   * Validates stream ID format
   */
  private isValidStreamId(streamId: string): boolean {
    // Basic validation - should be a UUID or similar identifier
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(streamId) || /^[a-zA-Z0-9\-_]{8,64}$/.test(streamId);
  }

  /**
   * Validates time range for history queries
   */
  private validateTimeRange(startTime?: string, endTime?: string): { isValid: boolean; error?: string } {
    if (!startTime && !endTime) {
      return { isValid: true };
    }

    if (startTime && isNaN(Date.parse(startTime))) {
      return { isValid: false, error: 'Invalid startTime format' };
    }

    if (endTime && isNaN(Date.parse(endTime))) {
      return { isValid: false, error: 'Invalid endTime format' };
    }

    if (startTime && endTime) {
      const start = new Date(startTime);
      const end = new Date(endTime);
      
      if (start >= end) {
        return { isValid: false, error: 'startTime must be before endTime' };
      }

      // Check if time range is reasonable (not too far back)
      const maxHistoryDays = 30;
      const maxHistoryMs = maxHistoryDays * 24 * 60 * 60 * 1000;
      const now = new Date();
      
      if (now.getTime() - start.getTime() > maxHistoryMs) {
        return { isValid: false, error: `History can only go back ${maxHistoryDays} days` };
      }
    }

    return { isValid: true };
  }

  /**
   * Sanitizes event types for filtering
   */
  private sanitizeEventTypes(types?: string[]): StreamEventType[] {
    if (!types || !Array.isArray(types)) {
      return [];
    }

    const validEventTypes = Object.values(StreamEventType);
    return types
      .filter(type => validEventTypes.includes(type as StreamEventType))
      .map(type => type as StreamEventType);
  }

  /**
   * Creates a summary of events for analytics
   */
  private createEventSummary(events: StreamEvent[]): any {
    const summary = {
      totalEvents: events.length,
      eventTypes: {} as Record<string, number>,
      timeRange: {
        start: null as string | null,
        end: null as string | null
      },
      errorCount: 0,
      warningCount: 0
    };

    if (events.length === 0) {
      return summary;
    }

    // Sort events by timestamp to get accurate time range
    const sortedEvents = [...events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    summary.timeRange.start = sortedEvents[0].timestamp.toISOString();
    summary.timeRange.end = sortedEvents[sortedEvents.length - 1].timestamp.toISOString();

    // Count event types and errors/warnings
    for (const event of events) {
      summary.eventTypes[event.type] = (summary.eventTypes[event.type] || 0) + 1;
      
      if (event.type === StreamEventType.ERROR_OCCURRED) {
        summary.errorCount++;
      }
      
      if (event.type === StreamEventType.WARNING_ISSUED) {
        summary.warningCount++;
      }
    }

    return summary;
  }
}
