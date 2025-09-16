/**
 * Frontend API Type Definitions
 * 
 * Type definitions for the Frontend API that bridges the UI Automation Interface
 * with the Step Processor and Executor Streamer modules.
 */

import { ProcessingStatus, SessionStatus, ProcessingError, StepProcessingRequest, ExecutionProgress } from './step-processor';
import { StreamEvent, StreamEventType, StreamFilter, StreamClient, ClientType } from './executor-streamer';

// ===============================
// Core API Interfaces
// ===============================

export interface FrontendAPI {
  stepProcessor: StepProcessorAPI;
  sessionManagement: SessionManagementAPI;
  streaming: StreamingAPI;
  realtimeStreaming: RealtimeStreamingAPI;
  authentication: AuthenticationMiddleware;
  validation: ValidationMiddleware;
  errorHandling: ErrorHandlingMiddleware;
  rateLimit: RateLimitMiddleware;
}

export interface APIIntegrations {
  stepProcessor: any; // IStepProcessor from step-processor module
  executorStreamer: any; // IStreamPublisher from executor-streamer module
  streamManager: any; // StreamManager from executor-streamer module
}

// ===============================
// Request/Response Types
// ===============================

export interface ExecuteStepsRequest {
  steps: string[];
  config?: {
    enableStreaming?: boolean;
    enableReflection?: boolean;
    retryOnFailure?: boolean;
    maxRetries?: number;
    maxExecutionTime?: number;
  };
  metadata?: Record<string, any>;
}

export interface ExecuteStepsResponse {
  sessionId: string;
  streamId?: string;
  status: ProcessingStatus;
  estimatedDuration?: number;
  createdAt: string; // ISO timestamp
  streamUrl?: string; // WebSocket URL for real-time updates
}

export interface ValidateStepsRequest {
  steps: string[];
}

export interface ValidateStepsResponse {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  stepCount: number;
  estimatedDuration?: number;
}

export interface ValidationError {
  line: number;
  type: 'syntax' | 'semantic' | 'format';
  message: string;
  suggestion?: string;
}

export interface ValidationWarning {
  line: number;
  type: 'performance' | 'best_practice' | 'compatibility';
  message: string;
  suggestion?: string;
}

// ===============================
// Session Management Types
// ===============================

export interface SessionStatusResponse {
  sessionId: string;
  streamId?: string;
  status: ProcessingStatus;
  progress: {
    currentStepIndex: number;
    totalSteps: number;
    percentage: number;
    currentStepName: string;
  };
  timing: {
    startTime: string;
    lastActivity: string;
    estimatedTimeRemaining?: number;
    averageStepDuration?: number;
  };
  error?: {
    type: string;
    message: string;
    stepIndex?: number;
    timestamp: string;
  };
}

export interface SessionControlResponse {
  sessionId: string;
  status: ProcessingStatus;
  message: string;
  timestamp: string;
}

export interface SessionListResponse {
  sessions: SessionSummary[];
  total: number;
  offset: number;
  limit: number;
}

export interface SessionSummary {
  sessionId: string;
  status: ProcessingStatus;
  startTime: string;
  lastActivity: string;
  stepCount: number;
  progress: number; // 0-100 percentage
}

export interface SessionHistoryResponse {
  sessionId: string;
  events: StreamEvent[];
  total: number;
  filters: {
    eventTypes?: string[];
    limit: number;
    offset: number;
  };
}

// ===============================
// Streaming Types
// ===============================

export interface StreamDetailsResponse {
  streamId: string;
  sessionId: string;
  status: 'active' | 'inactive' | 'completed';
  clientCount: number;
  eventCount: number;
  createdAt: string;
  lastActivity: string;
  config: {
    maxHistorySize: number;
    enableReplay: boolean;
    compressionEnabled: boolean;
  };
}

export interface SessionScreenshotsResponse {
  sessionId: string;
  screenshots: ScreenshotInfo[];
  total: number;
}

export interface ScreenshotInfo {
  id: string;
  actionType: string;
  timestamp: string;
  dimensions: { width: number; height: number };
  fileSize: number;
  thumbnailUrl: string;
  fullImageUrl: string;
}

// ===============================
// WebSocket Types
// ===============================

export interface WSConnectionParams {
  streamId: string;
  filters?: {
    eventTypes?: StreamEventType[];
    includeHistory?: boolean;
    historyLimit?: number;
  };
}

export interface WSClientMessage {
  type: 'subscribe' | 'unsubscribe' | 'replay' | 'ping' | 'filter_update';
  payload?: {
    filters?: StreamFilter[];
    replayOptions?: {
      fromTimestamp?: string;
      eventCount?: number;
      eventTypes?: StreamEventType[];
    };
  };
}

export interface WSServerMessage {
  type: 'event' | 'error' | 'pong' | 'connection_ack' | 'replay_complete';
  payload?: {
    event?: StreamEvent;
    error?: APIError;
    metadata?: Record<string, any>;
  };
}

// ===============================
// Template and Utility Types
// ===============================

export interface StepTemplatesResponse {
  templates: StepTemplate[];
  categories: string[];
}

export interface StepTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  steps: string[];
  tags: string[];
  usage_count: number;
}

export interface ExportSessionRequest {
  format: 'json' | 'csv' | 'html' | 'pdf';
  includeScreenshots: boolean;
  eventTypes?: string[];
  timeRange?: {
    start: string;
    end: string;
  };
}

// ===============================
// Data Transformation Types
// ===============================

export interface DataTransformer {
  transformStepsForProcessing(uiSteps: string[]): string[];
  transformStreamEventForUI(event: StreamEvent): UIStreamEvent;
  transformSessionStatusForUI(status: SessionStatus): UISessionStatus;
  transformValidationResults(results: any): ValidationError[];
}

export interface UIStreamEvent {
  id: string;
  type: StreamEventType;
  timestamp: string; // ISO format
  displayData: {
    title: string;
    description: string;
    icon: string;
    color: string;
    details?: Record<string, any>;
  };
  rawData: StreamEvent;
}

export interface UISessionStatus {
  sessionId: string;
  status: ProcessingStatus;
  progress: number;
  currentStep: string;
  timeElapsed: number;
  timeRemaining?: number;
  error?: string;
}

// ===============================
// Error Types
// ===============================

export enum APIErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  STREAM_NOT_FOUND = 'STREAM_NOT_FOUND',
  PROCESSING_ERROR = 'PROCESSING_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

export interface APIError {
  error: APIErrorType;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
  requestId?: string;
}

export interface ErrorHandler {
  handleProcessingError(error: ProcessingError, res: any): Promise<void>;
  handleStreamError(error: any, client: StreamClient): Promise<void>;
  handleValidationError(errors: ValidationError[], res: any): Promise<void>;
}

// ===============================
// Authentication and Security Types
// ===============================

export interface AuthenticationConfig {
  enabled: boolean;
  type: 'jwt' | 'api_key' | 'session';
  jwtSecret?: string;
  apiKeyHeader?: string;
  sessionCookieName?: string;
}

export interface AuthenticationMiddleware {
  authenticate(req: any, res: any, next: any): Promise<void>;
  generateToken(user: User): string;
  validateToken(token: string): Promise<User | null>;
}

export interface User {
  id: string;
  username: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export interface RateLimitConfig {
  windowMs: number; // 15 minutes
  maxRequests: number; // per window
  maxConcurrentSessions: number; // per user
  skipSuccessfulRequests: boolean;
  keyGenerator: (req: any) => string;
}

export interface RateLimitMiddleware {
  checkRequestLimit(req: any, res: any, next: any): Promise<void>;
  checkSessionLimit(userId: string): Promise<boolean>;
}

// ===============================
// Configuration Types
// ===============================

export interface FrontendAPIConfig {
  server: {
    port: number;
    host: string;
    cors: {
      origins: string[];
      methods: string[];
      allowedHeaders: string[];
    };
  };
  
  authentication: AuthenticationConfig;
  rateLimit: RateLimitConfig;
  
  stepProcessor: {
    serviceUrl: string;
    timeout: number;
    retryAttempts: number;
  };
  
  executorStreamer: {
    serviceUrl: string;
    websocketPath: string;
    ssePath: string;
    heartbeatInterval: number;
  };
  
  validation: {
    maxStepsPerRequest: number;
    maxStepLength: number;
    allowedStepFormats: string[];
  };
  
  storage: {
    screenshotBaseUrl: string;
    tempFileCleanupInterval: number;
  };
  
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    logRequests: boolean;
    logResponses: boolean;
    logWebSocketEvents: boolean;
  };
}

// ===============================
// Monitoring and Analytics Types
// ===============================

export interface APIMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    averageResponseTime: number;
  };
  
  sessions: {
    active: number;
    created: number;
    completed: number;
    failed: number;
  };
  
  streaming: {
    activeConnections: number;
    totalConnections: number;
    eventsStreamed: number;
    averageEventLatency: number;
  };
  
  errors: {
    validationErrors: number;
    processingErrors: number;
    streamingErrors: number;
    rateLimitHits: number;
  };
}

export interface MetricsCollector {
  recordRequest(endpoint: string, method: string, statusCode: number, duration: number): void;
  recordSessionEvent(event: 'created' | 'completed' | 'failed'): void;
  recordStreamingEvent(event: 'connected' | 'disconnected' | 'event_sent'): void;
  getMetrics(): APIMetrics;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  dependencies: {
    stepProcessor: 'healthy' | 'unhealthy';
    executorStreamer: 'healthy' | 'unhealthy';
    database?: 'healthy' | 'unhealthy';
  };
  metrics?: APIMetrics;
}

// ===============================
// API Interface Definitions
// ===============================

export interface StepProcessorAPI {
  executeSteps(request: ExecuteStepsRequest): Promise<ExecuteStepsResponse>;
  validateSteps(request: ValidateStepsRequest): Promise<ValidateStepsResponse>;
}

export interface SessionManagementAPI {
  getSessionStatus(sessionId: string): Promise<SessionStatusResponse>;
  pauseExecution(sessionId: string): Promise<SessionControlResponse>;
  resumeExecution(sessionId: string): Promise<SessionControlResponse>;
  cancelExecution(sessionId: string): Promise<SessionControlResponse>;
  listActiveSessions(filters?: any): Promise<SessionListResponse>;
  getSessionHistory(sessionId: string, filters?: any): Promise<SessionHistoryResponse>;
}

export interface StreamingAPI {
  getStreamDetails(streamId: string): Promise<StreamDetailsResponse>;
  getStreamHistory(streamId: string, filters?: any): Promise<SessionHistoryResponse>;
  getSessionScreenshots(sessionId: string): Promise<SessionScreenshotsResponse>;
}

export interface RealtimeStreamingAPI {
  handleWebSocketConnection(ws: any, streamId: string, query: any): Promise<void>;
  handleSSEConnection(req: any, res: any, streamId: string): Promise<void>;
  broadcastEvent(streamId: string, event: StreamEvent): Promise<void>;
  attachClient(streamId: string, client: StreamClient): Promise<void>;
  detachClient(streamId: string, clientId: string): Promise<void>;
}

export interface ValidationMiddleware {
  validateStepsRequest(request: ExecuteStepsRequest): Promise<{ isValid: boolean; errors: ValidationError[] }>;
  validateSessionId(sessionId: string): boolean;
  validateStreamId(streamId: string): boolean;
  sanitizeInput(input: any): any;
}

// ===============================
// WebSocket Handler Types
// ===============================

export interface WebSocketHandler {
  handleConnection(ws: any, streamId: string, query: any): Promise<void>;
  handleClientMessage(client: StreamClient, data: Buffer): Promise<void>;
  handleClientDisconnect(streamId: string, clientId: string): Promise<void>;
  handleClientError(client: StreamClient, error: Error): Promise<void>;
  sendHistoryToClient(client: StreamClient, streamId: string, limit?: number): Promise<void>;
  sendErrorToClient(client: StreamClient, type: string, message: string): void;
}

export interface SSEHandler {
  createSSEConnection(req: any, res: any, streamId: string): Promise<void>;
  sendSSEEvent(res: any, eventType: string, data: any): void;
  handleClientDisconnect(streamId: string, clientId: string): Promise<void>;
}

// ===============================
// Utility Types
// ===============================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export type ContentType = 'application/json' | 'text/event-stream' | 'image/png' | 'image/jpeg' | 'application/pdf';

export interface RequestContext {
  requestId: string;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  ipAddress?: string;
  timestamp: Date;
}

export interface ResponseMetadata {
  duration: number;
  statusCode: number;
  contentLength?: number;
  cached?: boolean;
}
