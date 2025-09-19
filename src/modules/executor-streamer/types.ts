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
  database: {
    path: string;              // SQLite database file path
    enableWAL: boolean;        // Enable Write-Ahead Logging for better concurrency
    busyTimeout: number;       // Timeout for database operations in milliseconds
    maxConnections: number;    // Maximum number of database connections
  };
}

/**
 * Default configuration for ExecutorStreamer
 */
export const DEFAULT_CONFIG: ExecutorStreamerConfig = {
  maxStreams: 100,
  maxEventsPerStream: 1000,
  streamTTL: 3600000,  // 1 hour
  queueMode: 'fifo',   // First-In-First-Out by default
  database: {
    path: './data/event-queues.db',
    enableWAL: true,
    busyTimeout: 5000,
    maxConnections: 10
  }
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

  // Stream management operations
  deleteStream(streamId: string): Promise<void>;
  streamExists(streamId: string): boolean;
  getActiveStreams(): string[];
  getStreamCount(): number;

  // Advanced event operations
  putBatchEvents(streamId: string, events: string[]): Promise<void>;
  putStructuredEvent(streamId: string, eventType: string, eventData: string, metadata?: Record<string, unknown>): Promise<void>;

  // Statistics and monitoring
  getStreamStats(streamId: string): Promise<{
    eventCount: number;
    createdAt: Date;
    lastAccessedAt: Date;
    hasEvents: boolean;
  }>;
  getSystemStats(): {
    totalStreams: number;
    maxStreams: number;
    streamUtilization: number;
    config: ExecutorStreamerConfig;
  };

  // Configuration access
  getConfig(): ExecutorStreamerConfig;
  
  // Debug/Monitoring
  getInstanceId(): number;
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
  addEvent(streamId: string, eventData: string): Promise<void>;
  extractLastEvent(streamId: string): Promise<string | null>;
  extractAllEvents(streamId: string): Promise<string[]>;
  getEvents(streamId: string): Promise<string[]>;
  hasEvents(streamId: string): Promise<boolean>;
  getStreamMetadata(streamId: string): StreamMetadata;
  destroy(): void;
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

/**
 * Log message types for streamer communication
 */
export enum LogMessageType {
  REASONING = 'reasoning',
  ACTION = 'action',
  SCREENSHOT = 'screenshot'
}

/**
 * Reasoning log message - contains AI reasoning with confidence
 */
export interface ReasoningLogMessage {
  type: LogMessageType.REASONING;
  text: string;
  confidence: 'low' | 'medium' | 'high';
  sessionId: string;
  stepId: number;
  iteration?: number;
  timestamp: Date;
}

/**
 * Action log message - contains action name and result
 */
export interface ActionLogMessage {
  type: LogMessageType.ACTION;
  actionName: string;
  success: boolean;
  result?: string;
  error?: string;
  sessionId: string;
  stepId: number;
  iteration?: number;
  timestamp: Date;
}

/**
 * Screenshot log message - contains screenshot URL
 */
export interface ScreenshotLogMessage {
  type: LogMessageType.SCREENSHOT;
  screenshotUrl: string;
  screenshotId: string;
  actionName?: string;
  sessionId: string;
  stepId: number;
  iteration?: number;
  timestamp: Date;
}

/**
 * Union type for all log messages
 */
export type LogMessage = ReasoningLogMessage | ActionLogMessage | ScreenshotLogMessage;

/**
 * Interface for the logger class that modules can use
 */
export interface IStreamerLogger {
  logReasoning(sessionId: string, stepId: number, text: string, confidence: 'low' | 'medium' | 'high', iteration?: number): Promise<void>;
  logAction(sessionId: string, stepId: number, actionName: string, success: boolean, result?: string, error?: string, iteration?: number): Promise<void>;
  logScreenshot(sessionId: string, stepId: number, screenshotId: string, screenshotUrl: string, actionName?: string, iteration?: number): Promise<void>;
  ensureStreamExists(sessionId: string): Promise<void>;
  setLoggingEnabled(enabled: boolean): void;
  isLoggingEnabled(): boolean;
}