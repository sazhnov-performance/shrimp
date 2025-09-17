/**
 * Frontend API Module Types
 * Defines interfaces, types, and configurations for the Frontend API module
 * Based on design/frontend-api.md specifications
 */

import {
  ISessionManager,
  ModuleSessionInfo,
  SessionStatus,
  SessionLifecycleCallbacks,
  SessionCoordinator,
  DIContainer,
  ModuleSessionConfig,
  SessionManagerHealth,
  BaseModuleConfig,
  LoggingConfig,
  PerformanceConfig,
  TimeoutConfig,
  DEFAULT_TIMEOUT_CONFIG,
  LogLevel,
  StreamEvent,
  StreamEventType,
  StandardError,
  APIResponse,
  APIError,
  StepProcessingRequest,
  ProcessingConfig,
  StepProcessingResult,
  ExecutionProgress,
  ScreenshotInfo,
  SYSTEM_VERSION
} from '../../../types/shared-types';

// ============================================================================
// FRONTEND API SESSION MANAGEMENT (STANDARDIZED)
// ============================================================================

export interface FrontendAPISession extends ModuleSessionInfo {
  moduleId: 'frontend-api';
  clientConnections: ClientConnection[];
  streamConnections: StreamConnection[];
  // Inherits: sessionId, linkedWorkflowSessionId, status, createdAt, lastActivity, metadata
}

export interface ClientConnection {
  clientId: string;
  type: 'http' | 'websocket' | 'sse';
  connectedAt: Date;
  lastActivity: Date;
  isActive: boolean;
}

export interface StreamConnection {
  streamId: string;
  clientId: string;
  type: 'websocket' | 'sse';
  filters?: StreamFilter[];
  connectedAt: Date;
  lastActivity: Date;
}

export interface StreamFilter {
  eventTypes?: StreamEventType[];
  includeHistory?: boolean;
  historyLimit?: number;
}

// ============================================================================
// CORE FRONTEND API INTERFACE
// ============================================================================

export interface IFrontendAPI extends ISessionManager {
  readonly moduleId: 'frontend-api';
  
  // Standardized Session Management (inherited from ISessionManager)
  createSession(workflowSessionId: string, config?: ModuleSessionConfig): Promise<string>;
  destroySession(workflowSessionId: string): Promise<void>;
  getSession(workflowSessionId: string): ModuleSessionInfo | null;
  sessionExists(workflowSessionId: string): boolean;
  updateSessionStatus(workflowSessionId: string, status: SessionStatus): Promise<void>;
  getSessionStatus(workflowSessionId: string): SessionStatus | null;
  recordActivity(workflowSessionId: string): Promise<void>;
  getLastActivity(workflowSessionId: string): Date | null;
  setLifecycleCallbacks(callbacks: SessionLifecycleCallbacks): void;
  healthCheck(): Promise<SessionManagerHealth>;
  
  // API Layer Components
  stepProcessor: StepProcessorAPI;
  sessionManagement: SessionManagementAPI;
  streaming: StreamingAPI;
  realtimeStreaming: RealtimeStreamingAPI;
  
  // Middleware Layer
  authentication: AuthenticationMiddleware;
  validation: ValidationMiddleware;
  errorHandling: ErrorHandlingMiddleware;
  rateLimit: RateLimitMiddleware;
  
  // Session Coordinator Integration
  setSessionCoordinator(coordinator: SessionCoordinator): void;
  getSessionCoordinator(): SessionCoordinator | null;
  
  // Dependency Injection
  initialize(container: DIContainer): Promise<void>;
  
  // Server Management
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
}

// ============================================================================
// API LAYER INTERFACES
// ============================================================================

export interface StepProcessorAPI {
  executeSteps(request: ExecuteStepsRequest): Promise<ExecuteStepsResponse>;
  validateSteps(request: ValidateStepsRequest): Promise<ValidateStepsResponse>;
}

export interface SessionManagementAPI {
  getSessionStatus(sessionId: string): Promise<SessionStatusResponse>;
  pauseSession(sessionId: string): Promise<SessionControlResponse>;
  resumeSession(sessionId: string): Promise<SessionControlResponse>;
  cancelSession(sessionId: string): Promise<SessionControlResponse>;
  listSessions(query: SessionListQuery): Promise<SessionListResponse>;
  getSessionHistory(sessionId: string, query: SessionHistoryQuery): Promise<SessionHistoryResponse>;
}

export interface StreamingAPI {
  getStreamDetails(streamId: string): Promise<StreamDetailsResponse>;
  getStreamHistory(streamId: string, query: StreamHistoryQuery): Promise<StreamHistoryResponse>;
}

export interface RealtimeStreamingAPI {
  handleWebSocketConnection(streamId: string, socket: any, query: any): Promise<void>;
  handleSSEConnection(streamId: string, request: any, response: any): Promise<void>;
  broadcastEvent(event: StreamEvent): Promise<void>;
  getConnectedClients(streamId?: string): ClientConnection[];
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

// Step Processing
export type ExecuteStepsRequest = StepProcessingRequest;

export interface ExecuteStepsResponse extends APIResponse<StepProcessingResult> {
  data: StepProcessingResult;
  metadata: {
    timestamp: string;
    requestId: string;
    version: string;
    processingTimeMs: number;
    streamUrl?: string;
  };
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

// Session Management
export interface SessionStatusResponse {
  sessionId: string;
  streamId?: string;
  status: SessionStatus;
  progress: ExecutionProgress;
  timing: {
    startTime: string;
    lastActivity: string;
    estimatedTimeRemaining?: number;
    averageStepDuration?: number;
  };
  error?: StandardError;
}

export interface SessionControlResponse {
  sessionId: string;
  status: SessionStatus;
  message: string;
  timestamp: string;
}

export interface SessionListQuery {
  status?: SessionStatus;
  limit?: number;
  offset?: number;
}

export interface SessionListResponse {
  sessions: SessionSummary[];
  total: number;
  offset: number;
  limit: number;
}

export interface SessionSummary {
  sessionId: string;
  status: SessionStatus;
  startTime: string;
  lastActivity: string;
  stepCount: number;
  progress: number; // 0-100 percentage
}

export interface SessionHistoryQuery {
  eventTypes?: string[];
  limit?: number;
  offset?: number;
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

// Streaming
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

export interface StreamHistoryQuery {
  types?: string[];
  limit?: number;
  offset?: number;
  startTime?: string;
  endTime?: string;
}

export interface StreamHistoryResponse {
  streamId: string;
  events: StreamEvent[];
  total: number;
  filters: StreamHistoryQuery;
}

// Screenshots
export interface SessionScreenshotsResponse {
  sessionId: string;
  screenshots: ScreenshotInfo[];
  total: number;
}

// Templates
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

// Export
export interface ExportSessionRequest {
  format: 'json' | 'csv' | 'html' | 'pdf';
  includeScreenshots: boolean;
  eventTypes?: string[];
  timeRange?: {
    start: string;
    end: string;
  };
}

// ============================================================================
// WEBSOCKET/SSE TYPES
// ============================================================================

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

export interface StreamClient {
  id: string;
  type: ClientType;
  connection: any; // WebSocket or Response object
  connectedAt: Date;
  lastPing: Date;
  filters: StreamFilter[];
  isActive: boolean;
}

export enum ClientType {
  WEBSOCKET = 'WEBSOCKET',
  SERVER_SENT_EVENTS = 'SERVER_SENT_EVENTS'
}

// ============================================================================
// MIDDLEWARE INTERFACES
// ============================================================================

export interface AuthenticationMiddleware {
  authenticate(request: any, response: any, next: any): Promise<void>;
  generateToken(user: User): string;
  validateToken(token: string): Promise<User | null>;
}

export interface ValidationMiddleware {
  validateStepsRequest(request: any): Promise<ValidationResult>;
  validateSessionId(sessionId: string): boolean;
  validateStreamId(streamId: string): boolean;
}

export interface ErrorHandlingMiddleware {
  handleStandardError(error: any, response: any): Promise<void>;
  wrapError(error: any): StandardError;
  getHttpStatus(error: StandardError): number;
}

export interface RateLimitMiddleware {
  checkRequestLimit(request: any, response: any, next: any): Promise<void>;
  checkSessionLimit(userId: string): Promise<boolean>;
}

export interface User {
  id: string;
  username: string;
  permissions: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings?: ValidationWarning[];
}

// ============================================================================
// CONFIGURATION (STANDARDIZED)
// ============================================================================

export interface FrontendAPIConfig extends BaseModuleConfig {
  moduleId: 'frontend-api';
  
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
  
  // Inherits from BaseModuleConfig:
  // - logging: LoggingConfig
  // - performance: PerformanceConfig  
  // - timeouts: TimeoutConfig
}

export interface AuthenticationConfig {
  enabled: boolean;
  type: 'jwt' | 'api_key' | 'session';
  jwtSecret?: string;
  apiKeyHeader?: string;
  sessionCookieName?: string;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  maxConcurrentSessions: number;
  skipSuccessfulRequests: boolean;
  keyGenerator: (req: any) => string;
}

// Default Configuration
export const DEFAULT_FRONTEND_API_CONFIG: FrontendAPIConfig = {
  moduleId: 'frontend-api',
  version: '1.0.0',
  enabled: true,
  
  server: {
    port: 3000,
    host: 'localhost',
    cors: {
      origins: ['http://localhost:3000'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }
  },
  
  authentication: {
    enabled: false,
    type: 'jwt',
    jwtSecret: process.env.JWT_SECRET,
    apiKeyHeader: 'X-API-Key',
    sessionCookieName: 'session'
  },
  
  rateLimit: {
    windowMs: 900000,           // 15 minutes
    maxRequests: 100,           // per window
    maxConcurrentSessions: 10,  // per user
    skipSuccessfulRequests: false,
    keyGenerator: (req) => req.ip
  },
  
  stepProcessor: {
    serviceUrl: 'http://localhost:3001',
    retryAttempts: 3
  },
  
  executorStreamer: {
    serviceUrl: 'http://localhost:3002',
    websocketPath: '/ws',
    ssePath: '/sse',
    heartbeatInterval: 30000
  },
  
  validation: {
    maxStepsPerRequest: 100,
    maxStepLength: 1000,
    allowedStepFormats: ['natural_language', 'structured']
  },
  
  storage: {
    screenshotBaseUrl: '/api/screenshots',
    tempFileCleanupInterval: 3600000  // 1 hour
  },
  
  timeouts: DEFAULT_TIMEOUT_CONFIG,
  
  logging: {
    level: LogLevel.INFO,
    prefix: '[FrontendAPI]',
    includeTimestamp: true,
    includeSessionId: true,
    includeModuleId: true,
    structured: false
  },
  
  performance: {
    maxConcurrentOperations: 100,
    cacheEnabled: true,
    cacheTTLMs: 300000,         // 5 minutes
    metricsEnabled: true
  }
};

// ============================================================================
// INTEGRATION POINTS (STANDARDIZED)
// ============================================================================

export interface APIIntegrations {
  stepProcessor: any;           // IStepProcessor interface 
  executorStreamer: any;        // IStreamPublisher interface
  streamManager: any;           // IExecutorStreamerManager interface
  sessionCoordinator: SessionCoordinator;
  taskLoop: any;                // ITaskLoop interface
  aiIntegration: any;           // IAIIntegrationManager interface
  contextManager: any;          // IAIContextManager interface
}

// ============================================================================
// MONITORING AND METRICS
// ============================================================================

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

// ============================================================================
// UI TRANSFORMATION TYPES
// ============================================================================

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
  status: SessionStatus;
  displayStatus: string;
  progress: number;
  statusColor: string;
  statusIcon: string;
}
