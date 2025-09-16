/**
 * Executor Streamer Module Type Definitions
 * Defines all interfaces and types for real-time streaming of executor and AI data
 */

import { CommandAction, ErrorContext, ScreenshotInfo, LogLevel } from './executor';

// Core Stream Types
export interface StreamSession {
  id: string;
  executorSessionId: string;
  createdAt: Date;
  lastActivity: Date;
  isActive: boolean;
  clients: StreamClient[];
  history: StreamEvent[];
  config: StreamConfig;
}

export interface StreamManager {
  createStream(executorSessionId: string, config?: Partial<StreamConfig>): Promise<string>;
  getStream(streamId: string): StreamSession | null;
  destroyStream(streamId: string): Promise<void>;
  listActiveStreams(): string[];
  attachClient(streamId: string, client: StreamClient): Promise<void>;
  detachClient(streamId: string, clientId: string): Promise<void>;
}

// Stream Configuration
export interface StreamConfig {
  maxHistorySize: number; // Maximum number of events to keep in history
  bufferSize: number; // Event buffer size for performance
  enableReplay: boolean; // Allow clients to replay historical events
  compressionEnabled: boolean; // Compress large payloads
  heartbeatInterval: number; // Client heartbeat interval in ms
  maxClients: number; // Maximum concurrent clients per stream
  eventFilters: StreamFilter[]; // Default filters for new clients
  persistence: {
    enabled: boolean;
    storageType: 'memory' | 'file' | 'database';
    retentionPeriod: number; // Retention in milliseconds
  };
}

// Stream Event System
export enum StreamEventType {
  AI_REASONING = 'AI_REASONING',
  COMMAND_STARTED = 'COMMAND_STARTED', 
  COMMAND_COMPLETED = 'COMMAND_COMPLETED',
  COMMAND_FAILED = 'COMMAND_FAILED',
  SCREENSHOT_CAPTURED = 'SCREENSHOT_CAPTURED',
  VARIABLE_UPDATED = 'VARIABLE_UPDATED',
  SESSION_STATUS = 'SESSION_STATUS',
  ERROR_OCCURRED = 'ERROR_OCCURRED'
}

export enum CommandStatus {
  QUEUED = 'QUEUED',
  EXECUTING = 'EXECUTING', 
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export interface StreamEvent {
  id: string;
  type: StreamEventType;
  timestamp: Date;
  sessionId: string;
  data: StreamEventData;
  metadata?: Record<string, any>;
}

export interface StreamEventData {
  // AI Reasoning data
  reasoning?: {
    thought: string;
    confidence: number;
    reasoning_type: 'analysis' | 'decision' | 'plan' | 'reflection';
    context?: Record<string, any>;
  };
  
  // Command execution data
  command?: {
    name: string;
    action: CommandAction;
    parameters: Record<string, any>;
    status: CommandStatus;
    duration?: number;
    result?: any;
  };
  
  // Screenshot data
  screenshot?: {
    id: string;
    path: string;
    actionType: string;
    thumbnailPath?: string;
    dimensions: { width: number; height: number };
    fileSize: number;
  };
  
  // Variable data
  variable?: {
    name: string;
    value: string;
    previous_value?: string;
  };
  
  // Status updates
  status?: {
    type: 'session' | 'executor' | 'stream';
    status: string;
    message?: string;
  };
  
  // Error information
  error?: {
    type: string;
    message: string;
    code?: string;
    details?: Record<string, any>;
  };
}

// Client Management
export enum ClientType {
  WEBSOCKET = 'WEBSOCKET',
  SERVER_SENT_EVENTS = 'SERVER_SENT_EVENTS',
  HTTP_POLLING = 'HTTP_POLLING'
}

export interface StreamClient {
  id: string;
  type: ClientType;
  connection: any; // WebSocket or Response object
  connectedAt: Date;
  lastPing: Date;
  filters?: StreamFilter[];
  isActive: boolean;
}

export interface StreamFilter {
  eventTypes?: StreamEventType[];
  sessionIds?: string[];
  timeRange?: { start: Date; end: Date };
  customFilter?: (event: StreamEvent) => boolean;
}

// Publisher Interface
export interface IStreamPublisher {
  // AI Reasoning methods
  publishReasoning(sessionId: string, thought: string, confidence: number, type: string, context?: Record<string, any>): Promise<void>;
  
  // Command execution methods
  publishCommandStarted(sessionId: string, commandName: string, action: CommandAction, parameters: Record<string, any>): Promise<void>;
  publishCommandCompleted(sessionId: string, commandName: string, result: any, duration: number): Promise<void>;
  publishCommandFailed(sessionId: string, commandName: string, error: ErrorContext, duration: number): Promise<void>;
  
  // Screenshot methods
  publishScreenshot(sessionId: string, screenshotInfo: ScreenshotInfo): Promise<void>;
  
  // Variable methods
  publishVariableUpdate(sessionId: string, name: string, value: string, previousValue?: string): Promise<void>;
  
  // Status methods
  publishStatus(sessionId: string, type: string, status: string, message?: string): Promise<void>;
  
  // Error methods
  publishError(sessionId: string, error: ErrorContext): Promise<void>;
  
  // Generic event publishing
  publishEvent(sessionId: string, event: StreamEvent): Promise<void>;
}

// Connection Handlers
export interface WebSocketHandler {
  handleConnection(ws: any, streamId: string, filters?: StreamFilter[]): Promise<void>;
  handleDisconnection(clientId: string): Promise<void>;
  broadcastToClient(clientId: string, event: StreamEvent): Promise<void>;
  broadcastToStream(streamId: string, event: StreamEvent, excludeClient?: string): Promise<void>;
}

export interface SSEHandler {
  createConnection(streamId: string, response: any, filters?: StreamFilter[]): Promise<string>;
  sendEvent(clientId: string, event: StreamEvent): Promise<void>;
  closeConnection(clientId: string): Promise<void>;
}

// History Management
export interface HistoryFilter {
  eventTypes?: StreamEventType[];
  limit?: number;
  offset?: number;
  startTime?: Date;
  endTime?: Date;
  searchText?: string;
}

export interface StreamHistory {
  addEvent(streamId: string, event: StreamEvent): Promise<void>;
  getEvents(streamId: string, filters?: HistoryFilter): Promise<StreamEvent[]>;
  getEventsByTimeRange(streamId: string, start: Date, end: Date): Promise<StreamEvent[]>;
  getEventsByType(streamId: string, types: StreamEventType[]): Promise<StreamEvent[]>;
  clearHistory(streamId: string): Promise<void>;
  compactHistory(streamId: string, keepCount: number): Promise<void>;
}

export interface StreamReplay {
  replayToClient(clientId: string, filters?: HistoryFilter): Promise<void>;
  replayFromTimestamp(clientId: string, timestamp: Date): Promise<void>;
  replayLastEvents(clientId: string, count: number): Promise<void>;
}

// Analytics and Monitoring
export interface StreamMetrics {
  totalStreams: number;
  activeStreams: number;
  totalClients: number;
  eventsPerSecond: number;
  averageEventSize: number;
  memoryUsage: number;
  errorRate: number;
  uptime: number;
  clientsByType: Record<ClientType, number>;
}

export interface StreamStats {
  streamId: string;
  clientCount: number;
  totalEvents: number;
  eventsInLastHour: number;
  averageEventFrequency: number;
  largestEventSize: number;
  memoryUsage: number;
}

export interface ClientActivityReport {
  clientId: string;
  type: ClientType;
  connectedAt: Date;
  disconnectedAt?: Date;
  eventsReceived: number;
  totalDataTransferred: number; // bytes
  averageLatency: number; // ms
}

export interface StreamAnalytics {
  getMetrics(): StreamMetrics;
  getStreamStats(streamId: string): StreamStats;
  getEventDistribution(timeRange: { start: Date; end: Date }): Record<StreamEventType, number>;
  getClientActivity(timeRange: { start: Date; end: Date }): ClientActivityReport[];
}

// Protocol Messages
export interface ClientMessage {
  type: 'subscribe' | 'unsubscribe' | 'replay' | 'ping' | 'filter';
  streamId?: string;
  filters?: StreamFilter[];
  replayOptions?: HistoryFilter;
}

export interface ServerMessage {
  type: 'event' | 'error' | 'pong' | 'connection_ack';
  event?: StreamEvent;
  error?: { code: string; message: string };
  metadata?: Record<string, any>;
}

// Configuration
export interface ExecutorStreamerConfig {
  port?: number; // Port for WebSocket/SSE server
  host?: string; // Host binding
  maxConnections: number; // Global client limit
  defaultStreamConfig: StreamConfig;
  security: {
    corsOrigins: string[];
    authenticationRequired: boolean;
    rateLimiting: {
      enabled: boolean;
      maxRequestsPerMinute: number;
      maxEventsPerSecond: number;
    };
  };
  persistence: {
    enabled: boolean;
    storageBackend: 'memory' | 'file' | 'redis' | 'database';
    connectionString?: string;
  };
  compression: {
    enabled: boolean;
    threshold: number; // Minimum event size to compress (bytes)
    algorithm: 'gzip' | 'brotli';
  };
  logging: {
    level: LogLevel;
    logClientConnections: boolean;
    logEventDetails: boolean;
  };
}

// Core Interface
export interface IExecutorStreamer {
  // Stream Management
  createStream(executorSessionId: string, config?: Partial<StreamConfig>): Promise<string>;
  destroyStream(streamId: string): Promise<void>;
  getStream(streamId: string): StreamSession | null;
  listActiveStreams(): string[];
  
  // Client Management
  attachClient(streamId: string, client: StreamClient): Promise<void>;
  detachClient(streamId: string, clientId: string): Promise<void>;
  getClients(streamId: string): StreamClient[];
  
  // Event Publishing
  publishEvent(streamId: string, event: StreamEvent): Promise<void>;
  publishReasoning(streamId: string, thought: string, confidence: number, type: string, context?: Record<string, any>): Promise<void>;
  publishCommandStatus(streamId: string, commandName: string, status: CommandStatus, details?: any): Promise<void>;
  publishScreenshot(streamId: string, screenshotInfo: ScreenshotInfo): Promise<void>;
  
  // History and Replay
  getHistory(streamId: string, filters?: HistoryFilter): Promise<StreamEvent[]>;
  replayToClient(clientId: string, filters?: HistoryFilter): Promise<void>;
  
  // Analytics
  getMetrics(): StreamMetrics;
  getStreamStats(streamId: string): StreamStats;
  
  // Lifecycle
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
}

// Event Emitter for Internal Communication
export enum StreamerEventType {
  STREAM_CREATED = 'STREAM_CREATED',
  STREAM_DESTROYED = 'STREAM_DESTROYED',
  CLIENT_CONNECTED = 'CLIENT_CONNECTED',
  CLIENT_DISCONNECTED = 'CLIENT_DISCONNECTED',
  EVENT_PUBLISHED = 'EVENT_PUBLISHED',
  ERROR_OCCURRED = 'ERROR_OCCURRED'
}

export interface StreamerEvent {
  type: StreamerEventType;
  streamId?: string;
  clientId?: string;
  timestamp: Date;
  data?: Record<string, any>;
}

export interface IStreamerEventEmitter {
  on(event: StreamerEventType, listener: (event: StreamerEvent) => void): void;
  emit(event: StreamerEventType, data: StreamerEvent): void;
  removeListener(event: StreamerEventType, listener: Function): void;
}

// Error Types
export enum StreamerErrorType {
  STREAM_NOT_FOUND = 'STREAM_NOT_FOUND',
  CLIENT_CONNECTION_ERROR = 'CLIENT_CONNECTION_ERROR',
  EVENT_PUBLISHING_ERROR = 'EVENT_PUBLISHING_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SERIALIZATION_ERROR = 'SERIALIZATION_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR'
}

export interface StreamerError extends Error {
  type: StreamerErrorType;
  streamId?: string;
  clientId?: string;
  details?: Record<string, any>;
}
