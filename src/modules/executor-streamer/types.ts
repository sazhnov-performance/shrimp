/**
 * Executor Streamer Types
 * Type definitions for the executor streamer module
 */

import { Response as HttpResponse } from 'express';
import { WebSocket } from 'ws';
import {
  SessionStatus,
  SessionLifecycleCallbacks,
  SessionManagerHealth,
  ISessionManager,
  ModuleSessionConfig,
  StreamEvent,
  StreamEventType,
  CommandAction,
  StandardError,
  ScreenshotInfo,
  VariableInfo,
  PageInfo
} from '../../../types/shared-types';

// Error Context (specialized StandardError for executor-streamer)
export interface ErrorContext extends StandardError {
  moduleId: 'executor-streamer';
}

// Client Types
export enum ClientType {
  WEBSOCKET = 'WEBSOCKET',
  SERVER_SENT_EVENTS = 'SERVER_SENT_EVENTS'
}

export interface StreamClient {
  id: string;
  type: ClientType;
  connection: WebSocket | HttpResponse;
  connectedAt: Date;
  lastPing: Date;
  isActive: boolean;
  filters?: StreamFilter[];
}

// Filtering
export interface StreamFilter {
  eventTypes?: StreamEventType[];
  sessionIds?: string[];
  timeRange?: {
    start: Date;
    end: Date;
  };
  customFilter?: (event: StreamEvent) => boolean;
}

// Stream Configuration
export interface StreamConfig {
  maxHistorySize: number;
  bufferSize: number;
  enableReplay: boolean;
  compressionEnabled: boolean;
  heartbeatInterval: number;
  maxClients: number;
  eventFilters: StreamFilter[];
  persistence: {
    enabled: boolean;
    storageType: 'memory' | 'redis' | 'file';
    retentionPeriod: number;
  };
}

// Stream Information
export interface StreamInfo {
  streamId: string;
  sessionId: string;
  isActive: boolean;
  clients: StreamClient[];
  history: StreamEvent[];
  config: StreamConfig;
  createdAt: Date;
  lastActivity: Date;
}

// Configuration
export interface ExecutorStreamerServerConfig {
  port: number;
  host: string;
  maxConnections: number;
}

export interface ExecutorStreamerSecurityConfig {
  corsOrigins: string[];
  authenticationRequired: boolean;
  rateLimiting: {
    enabled: boolean;
    maxRequestsPerMinute: number;
    maxEventsPerSecond: number;
  };
}

export interface ExecutorStreamerCompressionConfig {
  enabled: boolean;
  algorithm: 'gzip' | 'deflate' | 'brotli';
  threshold: number;
}

export interface ExecutorStreamerConfig {
  moduleId: string;
  server: ExecutorStreamerServerConfig;
  security: ExecutorStreamerSecurityConfig;
  compression: ExecutorStreamerCompressionConfig;
  defaultStreamConfig: StreamConfig;
}

// Event validation
export interface EventValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Analytics
export interface StreamAnalytics {
  metrics: {
    totalStreams: number;
    activeStreams: number;
    totalClients: number;
    totalEvents: number;
    eventsPerSecond: number;
  };
  performance: {
    averageEventProcessingTime: number;
    averageClientResponseTime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  resources: {
    activeConnections: number;
    queuedEvents: number;
    diskUsage: number;
  };
  health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    issues: string[];
    lastCheck: Date;
  };
}

export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    streamManager: 'healthy' | 'degraded' | 'unhealthy';
    analytics: 'healthy' | 'degraded' | 'unhealthy';
    networking: 'healthy' | 'degraded' | 'unhealthy';
  };
  timestamp: Date;
}

export interface StreamStatistics {
  streams: {
    total: number;
    active: number;
    averageClients: number;
  };
  clients: {
    total: number;
    websocket: number;
    sse: number;
  };
  history: {
    totalEvents: number;
    averageEventsPerStream: number;
  };
  analytics: {
    uptime: number;
    lastReset: Date;
  };
}

// Stream Manager Interface
export interface IStreamManager extends ISessionManager {
  // Stream-specific operations
  createStream(workflowSessionId: string, config?: StreamConfig): Promise<string>;
  destroyStream(workflowSessionId: string): Promise<void>;
  getStream(workflowSessionId: string): StreamInfo | null;
  listActiveStreams(): string[];
  
  // Client management
  attachClient(workflowSessionId: string, client: StreamClient): Promise<void>;
  detachClient(workflowSessionId: string, clientId: string): Promise<void>;
  
  // Configuration
  updateConfig(config: ExecutorStreamerConfig): void;
  getConfig(): ExecutorStreamerConfig;
  
  // Statistics
  getStats(): StreamManagerStats;
  
  // Shutdown
  shutdown(): Promise<void>;
}

export interface StreamManagerStats {
  totalSessions: number;
  activeSessions: number;
  totalClients: number;
  averageClientsPerStream: number;
  uptime: number;
}

// Event Publisher Interface
export interface IEventPublisher {
  // Core publishing methods
  publishReasoning(sessionId: string, thought: string, confidence: number, reasoningType: string, context?: Record<string, any>): Promise<void>;
  publishCommandStarted(sessionId: string, commandName: string, action: CommandAction, parameters: Record<string, any>): Promise<void>;
  publishCommandCompleted(sessionId: string, commandName: string, result: Record<string, any>, duration: number): Promise<void>;
  publishCommandFailed(sessionId: string, commandName: string, error: ErrorContext, duration: number): Promise<void>;
  publishScreenshot(sessionId: string, screenshotInfo: ScreenshotInfo): Promise<void>;
  publishVariableUpdate(sessionId: string, name: string, value: string, previousValue?: string): Promise<void>;
  publishStatus(sessionId: string, type: string, status: string, message: string): Promise<void>;
  publishError(sessionId: string, error: ErrorContext): Promise<void>;
  
  // Event validation and filtering
  validateEvent(event: StreamEvent): EventValidationResult;
  filterEventsForClient(events: StreamEvent[], client: StreamClient): StreamEvent[];
  shouldEventPassFilter(event: StreamEvent, filter: StreamFilter): boolean;
  
  // Serialization
  serializeEvent(event: StreamEvent): string;
}

// Main Executor Streamer Interface
export interface IExecutorStreamer extends ISessionManager {
  // Configuration
  getConfiguration(): ExecutorStreamerConfig;
  updateConfiguration(config: Partial<ExecutorStreamerConfig>): void;
  
  // Stream management
  createStream(workflowSessionId: string, config?: StreamConfig): Promise<string>;
  destroyStream(workflowSessionId: string): Promise<void>;
  getStream(workflowSessionId: string): StreamInfo | null;
  listActiveStreams(): string[];
  
  // Client connection management
  handleWebSocketConnection(ws: WebSocket, workflowSessionId: string, filters?: StreamFilter[]): Promise<string>;
  handleSSEConnection(res: HttpResponse, workflowSessionId: string, filters?: StreamFilter[]): Promise<string>;
  disconnectClient(clientId: string): Promise<void>;
  
  // Event publishing (delegated to EventPublisher)
  publishReasoning(sessionId: string, thought: string, confidence: number, reasoningType: string, context?: Record<string, any>): Promise<void>;
  publishCommandStarted(sessionId: string, commandName: string, action: CommandAction, parameters: Record<string, any>): Promise<void>;
  publishCommandCompleted(sessionId: string, commandName: string, result: Record<string, any>, duration: number): Promise<void>;
  publishCommandFailed(sessionId: string, commandName: string, error: ErrorContext, duration: number): Promise<void>;
  publishScreenshot(sessionId: string, screenshotInfo: ScreenshotInfo): Promise<void>;
  publishVariableUpdate(sessionId: string, name: string, value: string, previousValue?: string): Promise<void>;
  publishStatus(sessionId: string, type: string, status: string, message: string): Promise<void>;
  publishError(sessionId: string, error: ErrorContext): Promise<void>;
  
  // Event history and replay
  getEventHistory(sessionId: string, filter?: { eventTypes?: StreamEventType[] }): Promise<StreamEvent[]>;
  replayEventsToClient(clientId: string): Promise<void>;
  
  // Broadcasting
  broadcastToAllStreams(event: StreamEvent): Promise<void>;
  
  // Analytics and monitoring
  getStreamAnalytics(): StreamAnalytics;
  getHealthStatus(): Promise<HealthStatus>;
  getStatistics(): StreamStatistics;
  
  // Lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}
