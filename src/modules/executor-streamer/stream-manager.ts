/**
 * Stream Manager implementation for Executor Streamer
 * Handles core stream storage and operations using SQLite backend
 */

import { 
  IStreamManager, 
  ExecutorStreamerConfig, 
  ExecutorStreamerError,
  EXECUTOR_STREAMER_ERRORS,
  StreamMetadata 
} from './types';
import { DBManager } from './db-manager';

  /**
   * StreamManager class handles the core stream storage and queue operations using SQLite
   */
  export class StreamManager implements IStreamManager {
    private dbManager: DBManager;
    private config: ExecutorStreamerConfig;
    private cleanupTimer?: NodeJS.Timeout;

    constructor(config: ExecutorStreamerConfig) {
      this.config = config;
      this.dbManager = new DBManager(config);
      this.startCleanupTimer();
    }

  /**
   * Creates a new event stream with the provided ID
   * @param streamId Unique identifier for the stream
   * @throws ExecutorStreamerError if stream already exists or invalid ID
   */
  async createStream(streamId: string): Promise<void> {
    if (!this.isValidStreamId(streamId)) {
      throw new ExecutorStreamerError(
        EXECUTOR_STREAMER_ERRORS.INVALID_STREAM_ID,
        `Invalid stream ID: ${streamId}`,
        streamId
      );
    }

    // Check if we've reached the maximum number of streams
    if (this.dbManager.getStreamCount() >= this.config.maxStreams) {
      throw new ExecutorStreamerError(
        EXECUTOR_STREAMER_ERRORS.INVALID_STREAM_ID,
        `Maximum number of streams (${this.config.maxStreams}) reached`,
        streamId
      );
    }

    await this.dbManager.createStream(streamId);
  }

  /**
   * Deletes a stream and all its events
   * @param streamId Stream identifier to delete
   */
  async deleteStream(streamId: string): Promise<void> {
    await this.dbManager.deleteStream(streamId);
  }

  /**
   * Checks if a stream exists
   * @param streamId Stream identifier to check
   * @returns true if stream exists
   */
  streamExists(streamId: string): boolean {
    return this.dbManager.streamExists(streamId);
  }

  /**
   * Gets all current stream IDs
   * @returns Array of stream IDs
   */
  getStreamIds(): string[] {
    return this.dbManager.getStreamIds();
  }

  /**
   * Gets the current number of streams
   * @returns Number of active streams
   */
  getStreamCount(): number {
    return this.dbManager.getStreamCount();
  }

  /**
   * Adds an event to the specified stream
   * @param streamId Target stream ID
   * @param eventData Event data to add
   * @throws ExecutorStreamerError if stream not found
   */
  async addEvent(streamId: string, eventData: string): Promise<void> {
    // Generate a unique event ID and format the event
    const eventId = this.generateEventId();
    const formattedEvent = this.formatEvent(eventData, eventId);
    await this.dbManager.addEvent(streamId, formattedEvent, eventId);
  }

  /**
   * Extracts the last (most recent) event from the queue
   * @param streamId Target stream ID
   * @returns The last event or null if queue is empty
   * @throws ExecutorStreamerError if stream not found
   */
  async extractLastEvent(streamId: string): Promise<string | null> {
    return await this.dbManager.extractLastEvent(streamId);
  }

  /**
   * Extracts all events from the queue in chronological order
   * @param streamId Target stream ID
   * @returns Array of all events (chronological order)
   * @throws ExecutorStreamerError if stream not found
   */
  async extractAllEvents(streamId: string): Promise<string[]> {
    return await this.dbManager.extractAllEvents(streamId);
  }

  /**
   * Gets all events without removing them (read-only)
   * @param streamId Target stream ID
   * @returns Array of all events (chronological order)
   * @throws ExecutorStreamerError if stream not found
   */
  async getEvents(streamId: string): Promise<string[]> {
    return await this.dbManager.getEvents(streamId);
  }

  /**
   * Checks if the stream has any events
   * @param streamId Target stream ID
   * @returns true if stream has events
   * @throws ExecutorStreamerError if stream not found
   */
  async hasEvents(streamId: string): Promise<boolean> {
    return await this.dbManager.hasEvents(streamId);
  }

  /**
   * Gets stream metadata
   * @param streamId Target stream ID
   * @returns Stream metadata
   * @throws ExecutorStreamerError if stream not found
   */
  getStreamMetadata(streamId: string): StreamMetadata {
    return this.dbManager.getStreamMetadata(streamId);
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
   * Formats event data with timestamp and metadata
   * @param eventData Raw event data
   * @param eventId Event identifier
   * @returns Formatted event string
   */
  private formatEvent(eventData: string, eventId: string): string {
    const timestamp = new Date().toISOString();
    
    // Create a structured event format
    const formattedEvent = {
      timestamp,
      data: eventData,
      id: eventId
    };

    return JSON.stringify(formattedEvent);
  }

  /**
   * Validates stream ID format
   * @param streamId Stream ID to validate
   * @returns true if valid
   */
  private isValidStreamId(streamId: string): boolean {
    return typeof streamId === 'string' && streamId.length > 0 && streamId.length <= 255;
  }

  /**
   * Starts periodic cleanup timer for expired streams
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredStreams();
    }, this.config.streamTTL / 10); // Check every 1/10th of TTL
  }

  /**
   * Stops the cleanup timer (for testing and cleanup)
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * Destroys the stream manager and cleans up resources
   */
  destroy(): void {
    this.stopCleanupTimer();
    this.dbManager.destroy();
  }

  /**
   * Removes expired streams based on TTL configuration
   */
  private cleanupExpiredStreams(): void {
    this.dbManager.cleanupExpiredStreams();
  }
}
