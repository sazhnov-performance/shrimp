/**
 * Event Publisher implementation for Executor Streamer
 * Handles event publishing functionality and validation
 */

import { 
  IEventPublisher,
  ExecutorStreamerConfig,
  ExecutorStreamerError,
  EXECUTOR_STREAMER_ERRORS 
} from './types';
import { StreamManager } from './stream-manager';

/**
 * EventPublisher class handles event publishing and validation
 */
export class EventPublisher implements IEventPublisher {
  private streamManager: StreamManager;
  private config: ExecutorStreamerConfig;

  constructor(streamManager: StreamManager, config: ExecutorStreamerConfig) {
    this.streamManager = streamManager;
    this.config = config;
  }

  /**
   * Publishes an event to the specified stream
   * @param streamId Target stream ID
   * @param eventData Event data to publish
   * @throws ExecutorStreamerError if stream not found or event data invalid
   */
  async publishEvent(streamId: string, eventData: string): Promise<void> {
    // Validate stream exists
    if (!this.streamManager.streamExists(streamId)) {
      throw new ExecutorStreamerError(
        EXECUTOR_STREAMER_ERRORS.STREAM_NOT_FOUND,
        `Stream ${streamId} not found`,
        streamId
      );
    }

    // Validate event data
    if (!this.validateEventData(eventData)) {
      throw new ExecutorStreamerError(
        EXECUTOR_STREAMER_ERRORS.INVALID_STREAM_ID,
        `Invalid event data provided`,
        streamId
      );
    }

    // Format the event data
    const formattedEvent = this.formatEvent(eventData);

    // Add event to stream
    await this.streamManager.addEvent(streamId, formattedEvent);
  }

  /**
   * Validates event data before publishing
   * @param eventData Event data to validate
   * @returns true if event data is valid
   */
  validateEventData(eventData: string): boolean {
    // Basic validation rules
    if (typeof eventData !== 'string') {
      return false;
    }

    if (eventData.length === 0) {
      return false;
    }

    // Check maximum event size (reasonable limit to prevent memory issues)
    const maxEventSize = 10 * 1024; // 10KB per event
    if (eventData.length > maxEventSize) {
      return false;
    }

    // Validate that it's valid UTF-8 string (no null bytes or control characters)
    try {
      // Check for null bytes
      if (eventData.includes('\0')) {
        return false;
      }

      // Check for problematic control characters (except newlines, tabs, carriage returns)
      const hasInvalidControlChars = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(eventData);
      if (hasInvalidControlChars) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Formats event data with timestamp and metadata
   * @param eventData Raw event data
   * @returns Formatted event string
   */
  formatEvent(eventData: string): string {
    const timestamp = new Date().toISOString();
    
    // Create a structured event format
    const formattedEvent = {
      timestamp,
      data: eventData,
      id: this.generateEventId()
    };

    return JSON.stringify(formattedEvent);
  }

  /**
   * Generates a unique event ID
   * @returns Unique event identifier
   */
  private generateEventId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `evt_${timestamp}_${random}`;
  }

  /**
   * Batch publishes multiple events to a stream
   * @param streamId Target stream ID
   * @param events Array of event data strings
   * @throws ExecutorStreamerError if stream not found or any event data invalid
   */
  async publishBatchEvents(streamId: string, events: string[]): Promise<void> {
    // Validate stream exists
    if (!this.streamManager.streamExists(streamId)) {
      throw new ExecutorStreamerError(
        EXECUTOR_STREAMER_ERRORS.STREAM_NOT_FOUND,
        `Stream ${streamId} not found`,
        streamId
      );
    }

    // Validate all events first
    for (let i = 0; i < events.length; i++) {
      if (!this.validateEventData(events[i])) {
        throw new ExecutorStreamerError(
          EXECUTOR_STREAMER_ERRORS.INVALID_STREAM_ID,
          `Invalid event data at index ${i}`,
          streamId
        );
      }
    }

    // Publish all events
    for (const eventData of events) {
      const formattedEvent = this.formatEvent(eventData);
      await this.streamManager.addEvent(streamId, formattedEvent);
    }
  }

  /**
   * Publishes a structured event with additional metadata
   * @param streamId Target stream ID
   * @param eventType Type of the event
   * @param eventData Event data
   * @param metadata Additional metadata
   * @throws ExecutorStreamerError if stream not found or event data invalid
   */
  async publishStructuredEvent(
    streamId: string, 
    eventType: string, 
    eventData: string, 
    metadata?: Record<string, any>
  ): Promise<void> {
    // Validate stream exists
    if (!this.streamManager.streamExists(streamId)) {
      throw new ExecutorStreamerError(
        EXECUTOR_STREAMER_ERRORS.STREAM_NOT_FOUND,
        `Stream ${streamId} not found`,
        streamId
      );
    }

    // Create structured event
    const structuredEvent = {
      type: eventType,
      data: eventData,
      metadata: metadata || {},
      timestamp: new Date().toISOString(),
      id: this.generateEventId()
    };

    const eventString = JSON.stringify(structuredEvent);

    // Validate the serialized event
    if (!this.validateEventData(eventString)) {
      throw new ExecutorStreamerError(
        EXECUTOR_STREAMER_ERRORS.INVALID_STREAM_ID,
        `Invalid structured event data`,
        streamId
      );
    }

    // Add event to stream (already formatted as JSON)
    await this.streamManager.addEvent(streamId, eventString);
  }

  /**
   * Gets event publishing statistics for a stream
   * @param streamId Target stream ID
   * @returns Publishing statistics
   */
  async getPublishingStats(streamId: string): Promise<{
    totalEvents: number;
    lastPublished: Date;
    streamAge: number;
  }> {
    if (!this.streamManager.streamExists(streamId)) {
      throw new ExecutorStreamerError(
        EXECUTOR_STREAMER_ERRORS.STREAM_NOT_FOUND,
        `Stream ${streamId} not found`,
        streamId
      );
    }

    const metadata = this.streamManager.getStreamMetadata(streamId);
    const now = new Date();
    
    return {
      totalEvents: metadata.eventCount,
      lastPublished: metadata.lastAccessedAt,
      streamAge: now.getTime() - metadata.createdAt.getTime()
    };
  }
}
