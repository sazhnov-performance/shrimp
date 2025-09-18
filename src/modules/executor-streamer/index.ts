/**
 * Executor Streamer Module
 * Main interface implementation with singleton pattern
 * Provides real-time event streaming system for workflow execution monitoring
 */

import {
  DEFAULT_CONFIG,
  ExecutorStreamerError,
  EXECUTOR_STREAMER_ERRORS
} from './types';
import type {
  IExecutorStreamer,
  ExecutorStreamerConfig
} from './types';
import { StreamManager } from './stream-manager';
import { EventPublisher } from './event-publisher';

/**
 * ExecutorStreamer class implementing the singleton pattern
 * Provides centralized event streaming capabilities
 */
class ExecutorStreamer implements IExecutorStreamer {
  private static instance: ExecutorStreamer | null = null;
  private static instanceCounter = 0;
  private instanceId: number;
  private streamManager: StreamManager;
  private eventPublisher: EventPublisher;
  private config: ExecutorStreamerConfig;

  /**
   * Private constructor to enforce singleton pattern
   * @param config Configuration options
   */
  private constructor(config: ExecutorStreamerConfig = DEFAULT_CONFIG) {
    this.instanceId = ++ExecutorStreamer.instanceCounter;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.streamManager = new StreamManager(this.config);
    this.eventPublisher = new EventPublisher(this.streamManager, this.config);
    
    console.log(`[ExecutorStreamer] Instance #${this.instanceId} created`);
  }

  /**
   * Gets the singleton instance of ExecutorStreamer
   * @param config Optional configuration (only used on first instantiation)
   * @returns ExecutorStreamer instance
   */
  static getInstance(config?: ExecutorStreamerConfig): IExecutorStreamer {
    if (!ExecutorStreamer.instance) {
      ExecutorStreamer.instance = new ExecutorStreamer(config);
    } else {
      console.log(`[ExecutorStreamer] Returning existing instance #${ExecutorStreamer.instance.instanceId}`);
    }
    return ExecutorStreamer.instance;
  }

  /**
   * Resets the singleton instance (primarily for testing)
   * @internal
   */
  static resetInstance(): void {
    if (ExecutorStreamer.instance) {
      ExecutorStreamer.instance.streamManager.destroy();
    }
    ExecutorStreamer.instance = null;
  }

  /**
   * Creates a new event stream with the provided ID
   * @param streamId Unique identifier for the stream
   * @throws ExecutorStreamerError if stream already exists or invalid ID
   */
  async createStream(streamId: string): Promise<void> {
    await this.streamManager.createStream(streamId);
  }

  /**
   * Adds a string event to the end of the specified stream queue
   * @param streamId Target stream ID
   * @param eventData Event data to add
   * @throws ExecutorStreamerError if stream not found
   */
  async putEvent(streamId: string, eventData: string): Promise<void> {
    await this.eventPublisher.publishEvent(streamId, eventData);
  }

  /**
   * Removes and returns the last (most recent) event from the queue
   * @param streamId Target stream ID
   * @returns The last event or null if queue is empty
   * @throws ExecutorStreamerError if stream not found
   */
  async extractLastEvent(streamId: string): Promise<string | null> {
    return await this.streamManager.extractLastEvent(streamId);
  }

  /**
   * Removes and returns all events from the queue in chronological order
   * @param streamId Target stream ID
   * @returns Array of all events (chronological order)
   * @throws ExecutorStreamerError if stream not found
   */
  async extractAllEvents(streamId: string): Promise<string[]> {
    return await this.streamManager.extractAllEvents(streamId);
  }

  /**
   * Returns all events in the queue without removing them (read-only)
   * @param streamId Target stream ID
   * @returns Array of all events (chronological order)
   * @throws ExecutorStreamerError if stream not found
   */
  async getEvents(streamId: string): Promise<string[]> {
    return await this.streamManager.getEvents(streamId);
  }

  /**
   * Checks if the stream has any queued events
   * @param streamId Target stream ID
   * @returns true if stream has events
   * @throws ExecutorStreamerError if stream not found
   */
  async hasEvents(streamId: string): Promise<boolean> {
    return await this.streamManager.hasEvents(streamId);
  }

  /**
   * Gets current configuration
   * @returns Current ExecutorStreamer configuration
   */
  getConfig(): ExecutorStreamerConfig {
    return { ...this.config };
  }

  /**
   * Gets stream statistics
   * @param streamId Target stream ID
   * @returns Stream statistics
   * @throws ExecutorStreamerError if stream not found
   */
  async getStreamStats(streamId: string): Promise<{
    eventCount: number;
    createdAt: Date;
    lastAccessedAt: Date;
    hasEvents: boolean;
  }> {
    const metadata = this.streamManager.getStreamMetadata(streamId);
    const hasEvents = await this.streamManager.hasEvents(streamId);

    return {
      eventCount: metadata.eventCount,
      createdAt: metadata.createdAt,
      lastAccessedAt: metadata.lastAccessedAt,
      hasEvents
    };
  }

  /**
   * Lists all active stream IDs
   * @returns Array of active stream IDs
   */
  getActiveStreams(): string[] {
    return this.streamManager.getStreamIds();
  }

  /**
   * Gets the total number of active streams
   * @returns Number of active streams
   */
  getStreamCount(): number {
    return this.streamManager.getStreamCount();
  }

  /**
   * Deletes a stream and all its events
   * @param streamId Stream ID to delete
   */
  async deleteStream(streamId: string): Promise<void> {
    await this.streamManager.deleteStream(streamId);
  }

  /**
   * Checks if a stream exists
   * @param streamId Stream ID to check
   * @returns true if stream exists
   */
  streamExists(streamId: string): boolean {
    return this.streamManager.streamExists(streamId);
  }

  /**
   * Publishes multiple events to a stream in batch
   * @param streamId Target stream ID
   * @param events Array of event data strings
   * @throws ExecutorStreamerError if stream not found or any event invalid
   */
  async putBatchEvents(streamId: string, events: string[]): Promise<void> {
    await this.eventPublisher.publishBatchEvents(streamId, events);
  }

  /**
   * Publishes a structured event with type and metadata
   * @param streamId Target stream ID
   * @param eventType Type of the event
   * @param eventData Event data
   * @param metadata Additional metadata
   * @throws ExecutorStreamerError if stream not found or event invalid
   */
  async putStructuredEvent(
    streamId: string,
    eventType: string,
    eventData: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.eventPublisher.publishStructuredEvent(streamId, eventType, eventData, metadata);
  }

  /**
   * Gets comprehensive system statistics
   * @returns System-wide statistics
   */
  getSystemStats(): {
    totalStreams: number;
    maxStreams: number;
    streamUtilization: number;
    instanceId: number;
    config: ExecutorStreamerConfig;
  } {
    const totalStreams = this.getStreamCount();
    const maxStreams = this.config.maxStreams;
    
    return {
      totalStreams,
      maxStreams,
      streamUtilization: totalStreams / maxStreams,
      instanceId: this.instanceId,
      config: this.getConfig()
    };
  }

  /**
   * Get the instance ID for verification purposes
   * @returns The unique instance ID
   */
  getInstanceId(): number {
    return this.instanceId;
  }
}

// Export the main interface and types
export {
  ExecutorStreamer,
  ExecutorStreamerError,
  EXECUTOR_STREAMER_ERRORS,
  DEFAULT_CONFIG
};
export type {
  IExecutorStreamer,
  ExecutorStreamerConfig
};

// Export default singleton access function
export default ExecutorStreamer.getInstance;
