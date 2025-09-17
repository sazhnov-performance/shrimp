/**
 * Executor Streamer Module Types
 * Defines all types and interfaces for the executor streamer module
 * Based on design/executor-streamer.md specifications
 */

import { 
  ISessionManager,
  ModuleSessionInfo,
  SessionStatus,
  SessionLifecycleCallbacks,
  ModuleSessionConfig,
  BaseModuleConfig,
  DEFAULT_TIMEOUT_CONFIG,
  LogLevel,
  StreamEventType,
  StreamEvent,
  StreamEventData,
  CommandStatus,
  CommandAction
} from '../../../types/shared-types';

// Stream Session Types
export interface StreamSession extends ModuleSessionInfo {
  moduleId: 'executor-streamer';
  streamId: string;           // Stream ID (matches streamId from WorkflowSession)
  isActive: boolean;
  clients: StreamClient[];
  history: StreamEvent[];
  config: StreamConfig;
  // Inherits: sessionId, linkedWorkflowSessionId, status, createdAt, lastActivity, metadata
}

// Stream Configuration
export interface StreamConfig {
  maxHistorySize: number;     // Maximum number of events to keep in history
  bufferSize: number;         // Event buffer size for performance
  enableReplay: boolean;      // Allow clients to replay historical events
  compressionEnabled: boolean; // Compress large payloads
  heartbeatInterval: number;  // Client heartbeat interval in ms
  maxClients: number;         // Maximum concurrent clients per stream
  eventFilters: StreamFilter[]; // Default filters for new clients
  persistence: {
    enabled: boolean;
    storageType: 'memory' | 'file' | 'database';
    retentionPeriod: number; // Retention in milliseconds
  };
}

// Client Management Types
export interface StreamClient {
  id: string;
  type: ClientType;
  connection: WebSocket | Response; // WebSocket or SSE Response
  connectedAt: Date;
  lastPing: Date;
  filters?: StreamFilter[];
  isActive: boolean;
}

export enum ClientType {
  WEBSOCKET = 'WEBSOCKET',
  SERVER_SENT_EVENTS = 'SERVER_SENT_EVENTS',
  HTTP_POLLING = 'HTTP_POLLING'
}

export interface StreamFilter {
  eventTypes?: StreamEventType[];
  sessionIds?: string[];
  timeRange?: { start: Date; end: Date };
  customFilter?: (event: StreamEvent) => boolean;
}

// Interface Extensions
export interface IExecutorStreamerManager extends ISessionManager {
  readonly moduleId: 'executor-streamer';
  
  // Stream-specific methods (use workflowSessionId consistently)
  createStream(workflowSessionId: string, config?: StreamConfig): Promise<string>;
  getStream(workflowSessionId: string): StreamSession | null;
  destroyStream(workflowSessionId: string): Promise<void>;
  listActiveStreams(): string[];
  attachClient(workflowSessionId: string, client: StreamClient): Promise<void>;
  detachClient(workflowSessionId: string, clientId: string): Promise<void>;
}

// Event Publisher Interface
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

// Error Context for stream events
export interface ErrorContext {
  id: string;
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
  moduleId: string;
  recoverable: boolean;
  retryable: boolean;
  suggestedAction?: string;
}

// Screenshot Info for stream events
export interface ScreenshotInfo {
  id: string;
  sessionId: string;
  stepIndex?: number;
  commandId?: string;
  actionType: string;
  timestamp: Date;
  filePath: string;
  thumbnailPath?: string;
  dimensions: { width: number; height: number };
  fileSize: number;
  metadata?: Record<string, any>;
}

// WebSocket Handler Interface
export interface WebSocketHandler {
  handleConnection(ws: WebSocket, streamId: string, filters?: StreamFilter[]): Promise<void>;
  handleDisconnection(clientId: string): Promise<void>;
  broadcastToClient(clientId: string, event: StreamEvent): Promise<void>;
  broadcastToStream(streamId: string, event: StreamEvent, excludeClient?: string): Promise<void>;
}

// Server-Sent Events Handler Interface
export interface SSEHandler {
  createConnection(streamId: string, response: Response, filters?: StreamFilter[]): Promise<string>;
  sendEvent(clientId: string, event: StreamEvent): Promise<void>;
  closeConnection(clientId: string): Promise<void>;
}

// History Management Types
export interface StreamHistory {
  addEvent(streamId: string, event: StreamEvent): Promise<void>;
  getEvents(streamId: string, filters?: HistoryFilter): Promise<StreamEvent[]>;
  getEventsByTimeRange(streamId: string, start: Date, end: Date): Promise<StreamEvent[]>;
  getEventsByType(streamId: string, types: StreamEventType[]): Promise<StreamEvent[]>;
  clearHistory(streamId: string): Promise<void>;
  compactHistory(streamId: string, keepCount: number): Promise<void>;
}

export interface HistoryFilter {
  eventTypes?: StreamEventType[];
  limit?: number;
  offset?: number;
  startTime?: Date;
  endTime?: Date;
  searchText?: string;
}

// Replay Interface
export interface StreamReplay {
  replayToClient(clientId: string, filters?: HistoryFilter): Promise<void>;
  replayFromTimestamp(clientId: string, timestamp: Date): Promise<void>;
  replayLastEvents(clientId: string, count: number): Promise<void>;
}

// Analytics Types
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

export interface StreamAnalytics {
  getMetrics(): StreamMetrics;
  getStreamStats(streamId: string): StreamStats;
  getEventDistribution(timeRange: { start: Date; end: Date }): Record<StreamEventType, number>;
  getClientActivity(timeRange: { start: Date; end: Date }): ClientActivityReport[];
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
  clientType: ClientType;
  connectTime: Date;
  disconnectTime?: Date;
  eventsReceived: number;
  lastActivity: Date;
  isActive: boolean;
}

// Configuration Types
export interface ExecutorStreamerConfig extends BaseModuleConfig {
  moduleId: 'executor-streamer';
  
  // Executor Streamer specific configuration
  server: {
    port?: number; // Port for WebSocket/SSE server
    host?: string; // Host binding
    maxConnections: number; // Global client limit
  };
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
  
  // Inherits from BaseModuleConfig:
  // - logging: LoggingConfig
  // - performance: PerformanceConfig  
  // - timeouts: TimeoutConfig
}

// Protocol Types for WebSocket/SSE
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

// Default configurations
export const DEFAULT_STREAM_CONFIG: StreamConfig = {
  maxHistorySize: 10000,
  bufferSize: 1000,
  enableReplay: true,
  compressionEnabled: true,
  heartbeatInterval: 30000,
  maxClients: 100,
  eventFilters: [],
  persistence: {
    enabled: true,
    storageType: 'memory',
    retentionPeriod: 86400000 // 24 hours
  }
};

export const DEFAULT_EXECUTOR_STREAMER_CONFIG: ExecutorStreamerConfig = {
  moduleId: 'executor-streamer',
  version: '1.0.0',
  enabled: true,
  
  server: {
    port: 3001,
    host: 'localhost',
    maxConnections: 1000
  },
  
  defaultStreamConfig: DEFAULT_STREAM_CONFIG,
  
  security: {
    corsOrigins: ['http://localhost:3000'],
    authenticationRequired: false,
    rateLimiting: {
      enabled: true,
      maxRequestsPerMinute: 1000,
      maxEventsPerSecond: 100
    }
  },
  
  persistence: {
    enabled: true,
    storageBackend: 'memory'
  },
  
  compression: {
    enabled: true,
    threshold: 1024, // 1KB
    algorithm: 'gzip'
  },
  
  timeouts: DEFAULT_TIMEOUT_CONFIG,
  
  logging: {
    level: LogLevel.INFO,
    prefix: '[ExecutorStreamer]',
    includeTimestamp: true,
    includeSessionId: true,
    includeModuleId: true,
    structured: false
  },
  
  performance: {
    maxConcurrentOperations: 100,
    cacheEnabled: true,
    cacheTTLMs: 300000, // 5 minutes
    metricsEnabled: true
  }
};

// Event validation types
export interface EventValidator {
  validateEvent(event: StreamEvent): EventValidationResult;
  validateEventData(eventType: StreamEventType, data: StreamEventData): boolean;
}

export interface EventValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
