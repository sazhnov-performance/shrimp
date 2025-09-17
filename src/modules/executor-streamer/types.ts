/**
 * Type definitions for the Executor Streamer module
 * Provides event streaming capabilities for workflow execution monitoring
 */

// Standard error codes for Executor Streamer
export const EXECUTOR_STREAMER_ERRORS = {
  STREAM_NOT_FOUND: 'ES001',
  STREAM_ALREADY_EXISTS: 'ES002',
  INVALID_STREAM_ID: 'ES003'
} as const;

export type ExecutorStreamerErrorCode = typeof EXECUTOR_STREAMER_ERRORS[keyof typeof EXECUTOR_STREAMER_ERRORS];

/**
 * Configuration interface for ExecutorStreamer
 */
export interface ExecutorStreamerConfig {
  maxStreams: number;          // Maximum number of concurrent streams
  maxEventsPerStream: number;  // Maximum events queued per stream
  streamTTL: number;           // Stream time-to-live in milliseconds
  queueMode: 'fifo' | 'lifo';  // Queue ordering (First-In-First-Out or Last-In-First-Out)
}

/**
 * Default configuration for ExecutorStreamer
 */
export const DEFAULT_CONFIG: ExecutorStreamerConfig = {
  maxStreams: 100,
  maxEventsPerStream: 1000,
  streamTTL: 3600000,  // 1 hour
  queueMode: 'fifo'    // First-In-First-Out by default
};

/**
 * Main interface for the Executor Streamer module
 * Provides singleton pattern with stream management capabilities
 */
export interface IExecutorStreamer {
  // Core streaming operations
  createStream(streamId: string): Promise<void>;
  putEvent(streamId: string, eventData: string): Promise<void>;
  
  // Queue-based consumption (removes messages)
  extractLastEvent(streamId: string): Promise<string | null>;
  extractAllEvents(streamId: string): Promise<string[]>;
  
  // Read-only access (for API endpoints)
  getEvents(streamId: string): Promise<string[]>;
  hasEvents(streamId: string): Promise<boolean>;
}

/**
 * Interface for stream management operations
 */
export interface IStreamManager {
  createStream(streamId: string): Promise<void>;
  deleteStream(streamId: string): Promise<void>;
  streamExists(streamId: string): boolean;
  getStreamIds(): string[];
  getStreamCount(): number;
}

/**
 * Interface for event publishing operations
 */
export interface IEventPublisher {
  publishEvent(streamId: string, eventData: string): Promise<void>;
  validateEventData(eventData: string): boolean;
  formatEvent(eventData: string): string;
}

/**
 * Custom error class for Executor Streamer specific errors
 */
export class ExecutorStreamerError extends Error {
  public readonly code: ExecutorStreamerErrorCode;
  public readonly streamId?: string;

  constructor(code: ExecutorStreamerErrorCode, message: string, streamId?: string) {
    super(message);
    this.name = 'ExecutorStreamerError';
    this.code = code;
    this.streamId = streamId;
  }
}

/**
 * Stream metadata interface for internal tracking
 */
export interface StreamMetadata {
  id: string;
  createdAt: Date;
  lastAccessedAt: Date;
  eventCount: number;
}
