/**
 * Stream Manager implementation for Executor Streamer
 * Handles core stream storage and operations
 */

import { 
  IStreamManager, 
  ExecutorStreamerConfig, 
  ExecutorStreamerError,
  EXECUTOR_STREAMER_ERRORS,
  StreamMetadata 
} from './types';

/**
 * Internal stream data structure
 */
interface StreamData {
  events: string[];
  metadata: StreamMetadata;
}

  /**
   * StreamManager class handles the core stream storage and queue operations
   */
  export class StreamManager implements IStreamManager {
    private streams: Map<string, StreamData> = new Map();
    private config: ExecutorStreamerConfig;
    private cleanupTimer?: NodeJS.Timeout;

    constructor(config: ExecutorStreamerConfig) {
      this.config = config;
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

    if (this.streams.has(streamId)) {
      throw new ExecutorStreamerError(
        EXECUTOR_STREAMER_ERRORS.STREAM_ALREADY_EXISTS,
        `Stream ${streamId} already exists`,
        streamId
      );
    }

    // Check if we've reached the maximum number of streams
    if (this.streams.size >= this.config.maxStreams) {
      throw new ExecutorStreamerError(
        EXECUTOR_STREAMER_ERRORS.INVALID_STREAM_ID,
        `Maximum number of streams (${this.config.maxStreams}) reached`,
        streamId
      );
    }

    const now = new Date();
    this.streams.set(streamId, {
      events: [],
      metadata: {
        id: streamId,
        createdAt: now,
        lastAccessedAt: now,
        eventCount: 0
      }
    });
  }

  /**
   * Deletes a stream and all its events
   * @param streamId Stream identifier to delete
   */
  async deleteStream(streamId: string): Promise<void> {
    this.streams.delete(streamId);
  }

  /**
   * Checks if a stream exists
   * @param streamId Stream identifier to check
   * @returns true if stream exists
   */
  streamExists(streamId: string): boolean {
    return this.streams.has(streamId);
  }

  /**
   * Gets all current stream IDs
   * @returns Array of stream IDs
   */
  getStreamIds(): string[] {
    return Array.from(this.streams.keys());
  }

  /**
   * Gets the current number of streams
   * @returns Number of active streams
   */
  getStreamCount(): number {
    return this.streams.size;
  }

  /**
   * Adds an event to the specified stream
   * @param streamId Target stream ID
   * @param eventData Event data to add
   * @throws ExecutorStreamerError if stream not found
   */
  async addEvent(streamId: string, eventData: string): Promise<void> {
    const streamData = this.getStreamData(streamId);
    
    // Check if we've reached the maximum events per stream
    if (streamData.events.length >= this.config.maxEventsPerStream) {
      // Remove oldest event to make room (FIFO)
      streamData.events.shift();
    }

    streamData.events.push(eventData);
    streamData.metadata.eventCount++;
    streamData.metadata.lastAccessedAt = new Date();
  }

  /**
   * Extracts the last (most recent) event from the queue
   * @param streamId Target stream ID
   * @returns The last event or null if queue is empty
   * @throws ExecutorStreamerError if stream not found
   */
  async extractLastEvent(streamId: string): Promise<string | null> {
    const streamData = this.getStreamData(streamId);
    streamData.metadata.lastAccessedAt = new Date();
    
    return streamData.events.pop() || null;
  }

  /**
   * Extracts all events from the queue in chronological order
   * @param streamId Target stream ID
   * @returns Array of all events (chronological order)
   * @throws ExecutorStreamerError if stream not found
   */
  async extractAllEvents(streamId: string): Promise<string[]> {
    const streamData = this.getStreamData(streamId);
    streamData.metadata.lastAccessedAt = new Date();
    
    const events = [...streamData.events]; // Copy events in chronological order
    streamData.events.length = 0; // Clear the queue
    
    return events;
  }

  /**
   * Gets all events without removing them (read-only)
   * @param streamId Target stream ID
   * @returns Array of all events (chronological order)
   * @throws ExecutorStreamerError if stream not found
   */
  async getEvents(streamId: string): Promise<string[]> {
    const streamData = this.getStreamData(streamId);
    streamData.metadata.lastAccessedAt = new Date();
    
    return [...streamData.events]; // Return copy to prevent external modification
  }

  /**
   * Checks if the stream has any events
   * @param streamId Target stream ID
   * @returns true if stream has events
   * @throws ExecutorStreamerError if stream not found
   */
  async hasEvents(streamId: string): Promise<boolean> {
    const streamData = this.getStreamData(streamId);
    streamData.metadata.lastAccessedAt = new Date();
    
    return streamData.events.length > 0;
  }

  /**
   * Gets stream metadata
   * @param streamId Target stream ID
   * @returns Stream metadata
   * @throws ExecutorStreamerError if stream not found
   */
  getStreamMetadata(streamId: string): StreamMetadata {
    const streamData = this.getStreamData(streamId);
    return { ...streamData.metadata };
  }

  /**
   * Gets stream data or throws error if not found
   * @param streamId Target stream ID
   * @returns Stream data
   * @throws ExecutorStreamerError if stream not found
   */
  private getStreamData(streamId: string): StreamData {
    const streamData = this.streams.get(streamId);
    if (!streamData) {
      throw new ExecutorStreamerError(
        EXECUTOR_STREAMER_ERRORS.STREAM_NOT_FOUND,
        `Stream ${streamId} not found`,
        streamId
      );
    }
    return streamData;
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
    this.streams.clear();
  }

  /**
   * Removes expired streams based on TTL configuration
   */
  private cleanupExpiredStreams(): void {
    const now = new Date().getTime();
    const ttl = this.config.streamTTL;

    for (const [streamId, streamData] of this.streams.entries()) {
      const lastAccessed = streamData.metadata.lastAccessedAt.getTime();
      if (now - lastAccessed > ttl) {
        this.streams.delete(streamId);
      }
    }
  }
}
