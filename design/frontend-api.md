# Frontend API Design Document

## Overview
The Frontend API serves as the integration layer between the UI Automation Interface and the backend modules (Step Processor and Executor Streamer). It provides a REST API for workflow management and WebSocket/SSE endpoints for real-time streaming, translating UI requirements into backend module calls and providing a web-friendly interface for automation workflow execution.

## Core Responsibilities
- Expose REST API endpoints for step processing and session management
- Provide WebSocket and Server-Sent Events endpoints for real-time streaming
- Bridge UI Automation Interface with Step Processor and Executor Streamer modules
- Handle request validation, authentication, and error handling
- Manage session lifecycle from frontend perspective
- Provide data transformation between UI and backend formats
- Handle concurrent client connections and rate limiting

## Architecture Overview

### API Layer Structure (STANDARDIZED)
```typescript
// Import standardized session management types
import { 
  ISessionManager,
  ModuleSessionInfo,
  SessionStatus,
  SessionLifecycleCallbacks,
  SessionCoordinator,
  DIContainer,
  ModuleSessionConfig,
  SessionManagerHealth
} from './shared-types';

interface FrontendAPISession extends ModuleSessionInfo {
  moduleId: 'frontend-api';
  clientConnections: ClientConnection[];
  streamConnections: StreamConnection[];
  // Inherits: sessionId, linkedWorkflowSessionId, status, createdAt, lastActivity, metadata
}

interface ClientConnection {
  clientId: string;
  type: 'http' | 'websocket' | 'sse';
  connectedAt: Date;
  lastActivity: Date;
  isActive: boolean;
}

interface StreamConnection {
  streamId: string;
  clientId: string;
  type: 'websocket' | 'sse';
  filters?: StreamFilter[];
  connectedAt: Date;
  lastActivity: Date;
}

interface FrontendAPI extends ISessionManager {
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
  
  // REST API Layer
  stepProcessor: StepProcessorAPI;
  sessionManagement: SessionManagementAPI;
  streaming: StreamingAPI;
  
  // WebSocket/SSE Layer
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
}
```

### Integration Points (STANDARDIZED)
```typescript
interface APIIntegrations {
  stepProcessor: IStepProcessor;                // From step-processor module
  executorStreamer: IStreamPublisher;           // From executor-streamer module  
  streamManager: IExecutorStreamerManager;      // From executor-streamer module
  sessionCoordinator: SessionCoordinator;       // Session coordination
  taskLoop: ITaskLoop;                          // From task-loop module
  aiIntegration: IAIIntegrationManager;         // From ai-integration module
  contextManager: IAIContextManager;            // From ai-context-manager module
}
```

## REST API Endpoints

### 1. Step Processing Endpoints

#### Execute Steps (FIXED: Uses Shared Types)
```typescript
POST /api/automation/execute
```

**Request (FIXED: Uses shared StepProcessingRequest):**
```typescript
// Import shared types for consistency
import { StepProcessingRequest, ProcessingConfig } from './shared-types';

// Frontend API uses the same request format as Step Processor
type ExecuteStepsRequest = StepProcessingRequest;
```

**Response (FIXED: Uses shared types):**
```typescript
import { APIResponse, StepProcessingResult } from './shared-types';

interface ExecuteStepsResponse extends APIResponse<StepProcessingResult> {
  data: StepProcessingResult;
  metadata: {
    timestamp: string;
    requestId: string;
    version: string;
    processingTimeMs: number;
    streamUrl?: string;        // WebSocket URL for real-time updates
  };
}
```

**Implementation (FIXED: Uses Shared Types):**
```typescript
async executeSteps(req: Request, res: Response): Promise<void> {
  try {
    // 1. Validate request using shared validation
    const validationResult = await this.validateStepsRequest(req.body);
    if (!validationResult.isValid) {
      const errorResponse: APIResponse = {
        success: false,
        error: {
          code: ERROR_CODES.FRONTEND_API.REQUEST_VALIDATION_FAILED,
          message: 'Invalid step format',
          details: validationResult.errors,
          retryable: false,
          timestamp: new Date().toISOString()
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId: crypto.randomUUID(),
          version: SYSTEM_VERSION.major + '.' + SYSTEM_VERSION.minor,
          processingTimeMs: 0
        }
      };
      return res.status(400).json(errorResponse);
    }

    // 2. Create processing request (FIXED: Uses shared type directly)
    const processingRequest: StepProcessingRequest = req.body;

    // 3. Process steps via Step Processor
    const result = await this.stepProcessor.processSteps(processingRequest);

    // 4. Build standardized response
    const response: ExecuteStepsResponse = {
      success: true,
      data: result,
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        version: SYSTEM_VERSION.major + '.' + SYSTEM_VERSION.minor,
        processingTimeMs: Date.now() - startTime,
        streamUrl: result.streamId ? `/api/stream/ws/${result.streamId}` : undefined
      }
    };

    res.status(201).json(response);
  } catch (error) {
    await this.handleStandardError(error, res);
  }
}

private getDefaultProcessingConfig(): ProcessingConfig {
  return {
    maxExecutionTime: 300000,      // 5 minutes
    enableStreaming: true,
    enableReflection: true,
    retryOnFailure: false,
    maxRetries: 3,
    parallelExecution: false,
    aiConfig: {
      connectionId: this.defaultAIConnectionId,
      model: 'gpt-4',
      temperature: 0.1,
      maxTokens: 4000,
      timeoutMs: 30000
    },
    executorConfig: {
      browserType: 'chromium',
      headless: true,
      timeoutMs: 30000,
      screenshotsEnabled: true
    },
    streamConfig: {
      bufferSize: 1000,
      maxHistorySize: 10000,
      compressionEnabled: true
    }
  };
}
```

#### Validate Steps
```typescript
POST /api/automation/validate
```

**Request:**
```typescript
interface ValidateStepsRequest {
  steps: string[];
}
```

**Response:**
```typescript
interface ValidateStepsResponse {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  stepCount: number;
  estimatedDuration?: number;
}

interface ValidationError {
  line: number;
  type: 'syntax' | 'semantic' | 'format';
  message: string;
  suggestion?: string;
}

interface ValidationWarning {
  line: number;
  type: 'performance' | 'best_practice' | 'compatibility';
  message: string;
  suggestion?: string;
}
```

### 2. Session Management Endpoints

#### Get Session Status
```typescript
GET /api/automation/sessions/:sessionId
```

**Response:**
```typescript
import { SessionStatus, ExecutionProgress, StandardError } from './shared-types';

interface SessionStatusResponse {
  sessionId: string;
  streamId?: string;
  status: SessionStatus;                    // FIXED: Uses shared enum
  progress: ExecutionProgress;              // FIXED: Uses shared type
  timing: {
    startTime: string;
    lastActivity: string;
    estimatedTimeRemaining?: number;
    averageStepDuration?: number;
  };
  error?: StandardError;                   // FIXED: Uses shared error type
}
```

#### Control Session Execution
```typescript
POST /api/automation/sessions/:sessionId/pause
POST /api/automation/sessions/:sessionId/resume
POST /api/automation/sessions/:sessionId/cancel
```

**Response:**
```typescript
interface SessionControlResponse {
  sessionId: string;
  status: SessionStatus;                    // FIXED: Uses shared enum
  message: string;
  timestamp: string;
}
```

#### List Active Sessions
```typescript
GET /api/automation/sessions
```

**Query Parameters:**
- `status`: Filter by status (active, paused, completed, failed)
- `limit`: Number of sessions to return (default: 50)
- `offset`: Pagination offset (default: 0)

**Response:**
```typescript
interface SessionListResponse {
  sessions: SessionSummary[];
  total: number;
  offset: number;
  limit: number;
}

interface SessionSummary {
  sessionId: string;
  status: SessionStatus;                    // FIXED: Uses shared enum
  startTime: string;
  lastActivity: string;
  stepCount: number;
  progress: number; // 0-100 percentage
}
```

#### Get Session History
```typescript
GET /api/automation/sessions/:sessionId/history
```

**Query Parameters:**
- `eventTypes`: Comma-separated event types to include
- `limit`: Number of events to return
- `offset`: Pagination offset

**Response:**
```typescript
import { StreamEvent } from './shared-types';

interface SessionHistoryResponse {
  sessionId: string;
  events: StreamEvent[];                   // FIXED: Uses shared type
  total: number;
  filters: {
    eventTypes?: string[];
    limit: number;
    offset: number;
  };
}
```

### 3. Streaming Management Endpoints

#### Get Stream Details
```typescript
GET /api/streams/:streamId
```

**Response:**
```typescript
interface StreamDetailsResponse {
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
```

#### Get Stream History
```typescript
GET /api/streams/:streamId/events
```

**Query Parameters:**
- `types`: Event types filter
- `limit`: Number of events
- `offset`: Pagination offset
- `startTime`: Filter events after timestamp
- `endTime`: Filter events before timestamp

### 4. Screenshot Management Endpoints

#### Get Screenshot
```typescript
GET /api/screenshots/:screenshotId
GET /api/screenshots/:screenshotId/thumbnail
```

**Response:** Binary image data with appropriate content-type headers

#### List Session Screenshots
```typescript
GET /api/automation/sessions/:sessionId/screenshots
```

**Response:**
```typescript
interface SessionScreenshotsResponse {
  sessionId: string;
  screenshots: ScreenshotInfo[];
  total: number;
}

// ScreenshotInfo is defined in shared-types.md to ensure consistency
import { ScreenshotInfo } from './shared-types';
```

### 5. Template and Utility Endpoints

#### Get Step Templates
```typescript
GET /api/automation/templates
```

**Response:**
```typescript
interface StepTemplatesResponse {
  templates: StepTemplate[];
  categories: string[];
}

interface StepTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  steps: string[];
  tags: string[];
  usage_count: number;
}
```

#### Export Session Data
```typescript
POST /api/automation/sessions/:sessionId/export
```

**Request:**
```typescript
interface ExportSessionRequest {
  format: 'json' | 'csv' | 'html' | 'pdf';
  includeScreenshots: boolean;
  eventTypes?: string[];
  timeRange?: {
    start: string;
    end: string;
  };
}
```

**Response:** File download with appropriate content-type

## WebSocket API

### Connection Management

#### WebSocket Endpoint
```
WS /api/stream/ws/:streamId
```

#### Connection Protocol
```typescript
import { StreamEventType, StreamFilter } from './shared-types';

// Client connection with optional filters
interface WSConnectionParams {
  streamId: string;
  filters?: {
    eventTypes?: StreamEventType[];        // FIXED: Uses shared enum
    includeHistory?: boolean;
    historyLimit?: number;
  };
}

// Client -> Server messages
interface WSClientMessage {
  type: 'subscribe' | 'unsubscribe' | 'replay' | 'ping' | 'filter_update';
  payload?: {
    filters?: StreamFilter[];                 // FIXED: Uses shared type
    replayOptions?: {
      fromTimestamp?: string;
      eventCount?: number;
      eventTypes?: StreamEventType[];         // FIXED: Uses shared enum
    };
  };
}

// Server -> Client messages
interface WSServerMessage {
  type: 'event' | 'error' | 'pong' | 'connection_ack' | 'replay_complete';
  payload?: {
    event?: StreamEvent;                     // FIXED: Uses shared type
    error?: APIError;                        // FIXED: Uses shared type
    metadata?: Record<string, any>;
  };
}
```

#### Implementation Example
```typescript
class WebSocketHandler {
  async handleConnection(ws: WebSocket, streamId: string, query: any): Promise<void> {
    try {
      // 1. Validate stream exists
      const stream = await this.streamManager.getStream(streamId);
      if (!stream) {
        ws.close(4404, 'Stream not found');
        return;
      }

      // 2. Create client registration
      const clientId = this.generateClientId();
      const client: StreamClient = {
        id: clientId,
        type: ClientType.WEBSOCKET,
        connection: ws,
        connectedAt: new Date(),
        lastPing: new Date(),
        filters: this.parseFilters(query.filters),
        isActive: true
      };

      // 3. Register with stream manager
      await this.streamManager.attachClient(streamId, client);

      // 4. Send connection acknowledgment
      ws.send(JSON.stringify({
        type: 'connection_ack',
        payload: {
          clientId,
          streamId,
          metadata: {
            connectedAt: client.connectedAt.toISOString(),
            availableEventTypes: Object.values(StreamEventType)
          }
        }
      }));

      // 5. Send history if requested
      if (query.includeHistory) {
        await this.sendHistoryToClient(client, streamId, query.historyLimit);
      }

      // 6. Setup message handlers
      ws.on('message', (data) => this.handleClientMessage(client, data));
      ws.on('close', () => this.handleClientDisconnect(streamId, clientId));
      ws.on('error', (error) => this.handleClientError(client, error));

    } catch (error) {
      ws.close(4500, 'Connection setup failed');
    }
  }

  private async handleClientMessage(client: StreamClient, data: Buffer): Promise<void> {
    try {
      const message: WSClientMessage = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'ping':
          client.lastPing = new Date();
          (client.connection as WebSocket).send(JSON.stringify({ type: 'pong' }));
          break;
          
        case 'filter_update':
          client.filters = message.payload?.filters || [];
          break;
          
        case 'replay':
          await this.handleReplayRequest(client, message.payload?.replayOptions);
          break;
      }
    } catch (error) {
      this.sendErrorToClient(client, 'INVALID_MESSAGE', 'Failed to parse message');
    }
  }
}
```

## Server-Sent Events API

### SSE Endpoint
```
GET /api/stream/sse/:streamId
```

### SSE Implementation
```typescript
interface SSEHandler {
  async createSSEConnection(req: Request, res: Response, streamId: string): Promise<void> {
    // 1. Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // 2. Create client and register
    const clientId = this.generateClientId();
    const client: StreamClient = {
      id: clientId,
      type: ClientType.SERVER_SENT_EVENTS,
      connection: res,
      connectedAt: new Date(),
      lastPing: new Date(),
      filters: this.parseFilters(req.query.filters as string),
      isActive: true
    };

    await this.streamManager.attachClient(streamId, client);

    // 3. Send initial connection event
    this.sendSSEEvent(res, 'connection_ack', {
      clientId,
      streamId,
      timestamp: new Date().toISOString()
    });

    // 4. Setup heartbeat
    const heartbeat = setInterval(() => {
      if (res.writableEnded) {
        clearInterval(heartbeat);
        return;
      }
      this.sendSSEEvent(res, 'heartbeat', { timestamp: new Date().toISOString() });
    }, 30000);

    // 5. Handle client disconnect
    req.on('close', async () => {
      clearInterval(heartbeat);
      await this.streamManager.detachClient(streamId, clientId);
    });
  }

  private sendSSEEvent(res: Response, eventType: string, data: any): void {
    if (res.writableEnded) return;
    
    res.write(`event: ${eventType}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}
```

## Data Transformation Layer

### UI to Backend Mapping
```typescript
interface DataTransformer {
  // Transform UI step format to backend format
  transformStepsForProcessing(uiSteps: string[]): string[];
  
  // Transform backend events for UI consumption
  transformStreamEventForUI(event: StreamEvent): UIStreamEvent;
  
  // Transform session status for UI
  transformSessionStatusForUI(status: SessionStatus): UISessionStatus;
  
  // Transform validation results
  transformValidationResults(results: any): ValidationError[];
}

interface UIStreamEvent {
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
```

## Error Handling (Standardized)

### Error Types and Responses (Using Shared Error Framework)
```typescript
// Import shared error types and codes
import { 
  StandardError, 
  ErrorCategory, 
  ErrorSeverity, 
  ERROR_CODES,
  APIResponse,
  APIError,
  SYSTEM_VERSION
} from './shared-types';

class FrontendAPIErrorHandler {
  
  async handleStandardError(error: any, res: Response): Promise<void> {
    const standardError = this.wrapError(error);
    const httpStatus = this.getHttpStatus(standardError);
    
    const errorResponse: APIResponse = {
      success: false,
      error: {
        code: standardError.code,
        message: standardError.message,
        details: standardError.details,
        retryable: standardError.retryable,
        timestamp: standardError.timestamp.toISOString()
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        version: SYSTEM_VERSION.major + '.' + SYSTEM_VERSION.minor,
        processingTimeMs: 0
      }
    };
    
    res.status(httpStatus).json(errorResponse);
  }

  private wrapError(error: any): StandardError {
    // If already a StandardError, return as-is
    if (error.id && error.category && error.severity) {
      return error as StandardError;
    }

    // Determine error category and code
    let code = 'INTERNAL_ERROR';
    let category = ErrorCategory.SYSTEM;
    let severity = ErrorSeverity.HIGH;

    if (error.name === 'ValidationError') {
      code = ERROR_CODES.FRONTEND_API.REQUEST_VALIDATION_FAILED;
      category = ErrorCategory.VALIDATION;
      severity = ErrorSeverity.MEDIUM;
    } else if (error.message?.includes('not found')) {
      code = 'RESOURCE_NOT_FOUND';
      category = ErrorCategory.USER;
      severity = ErrorSeverity.LOW;
    } else if (error.message?.includes('timeout')) {
      code = 'REQUEST_TIMEOUT';
      category = ErrorCategory.EXECUTION;
      severity = ErrorSeverity.MEDIUM;
    }

    return {
      id: crypto.randomUUID(),
      category,
      severity,
      code,
      message: error.message || 'An unexpected error occurred',
      details: {
        originalError: error.name,
        stack: error.stack
      },
      timestamp: new Date(),
      moduleId: 'frontend-api',
      recoverable: this.isRecoverable(category),
      retryable: this.isRetryable(code),
      suggestedAction: this.getSuggestedAction(code)
    };
  }

  private getHttpStatus(error: StandardError): number {
    switch (error.category) {
      case ErrorCategory.VALIDATION:
        return 400;
      case ErrorCategory.USER:
        if (error.code.includes('NOT_FOUND')) return 404;
        if (error.code.includes('AUTHENTICATION')) return 401;
        if (error.code.includes('AUTHORIZATION')) return 403;
        return 400;
      case ErrorCategory.EXECUTION:
        if (error.code.includes('TIMEOUT')) return 408;
        return 500;
      case ErrorCategory.SYSTEM:
        if (error.code.includes('RATE_LIMIT')) return 429;
        return 500;
      default:
        return 500;
    }
  }

  private isRecoverable(category: ErrorCategory): boolean {
    return category !== ErrorCategory.VALIDATION;
  }

  private isRetryable(code: string): boolean {
    const retryableCodes = ['REQUEST_TIMEOUT', 'RATE_LIMIT_EXCEEDED', 'INTERNAL_ERROR'];
    return retryableCodes.some(retryCode => code.includes(retryCode));
  }

  private getSuggestedAction(code: string): string {
    const actions = {
      'REQUEST_VALIDATION_FAILED': 'Check request format and required fields',
      'AUTHENTICATION_FAILED': 'Verify API credentials',
      'RATE_LIMIT_EXCEEDED': 'Wait before retrying request',
      'REQUEST_TIMEOUT': 'Retry with shorter execution time',
      'RESOURCE_NOT_FOUND': 'Verify resource ID exists'
    };
    return actions[code] || 'Contact system administrator';
  }
}
```

### Error Response Examples
```typescript
// 400 - Validation Error
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid step format at line 3",
  "details": {
    "line": 3,
    "issue": "Missing action verb",
    "suggestion": "Steps should start with an action like 'click', 'type', 'navigate'"
  },
  "timestamp": "2024-01-01T10:00:00Z",
  "requestId": "req_123456"
}

// 404 - Session Not Found  
{
  "error": "SESSION_NOT_FOUND",
  "message": "Session abc123 does not exist or has been completed",
  "timestamp": "2024-01-01T10:00:00Z"
}

// 500 - Processing Error
{
  "error": "PROCESSING_ERROR", 
  "message": "Step processor failed to initialize session",
  "details": {
    "originalError": "Connection timeout to executor module",
    "retryable": true
  },
  "timestamp": "2024-01-01T10:00:00Z"
}
```

## Authentication and Security

### Authentication Middleware
```typescript
interface AuthenticationConfig {
  enabled: boolean;
  type: 'jwt' | 'api_key' | 'session';
  jwtSecret?: string;
  apiKeyHeader?: string;
  sessionCookieName?: string;
}

interface AuthenticationMiddleware {
  authenticate(req: Request, res: Response, next: NextFunction): Promise<void>;
  generateToken(user: User): string;
  validateToken(token: string): Promise<User | null>;
}
```

### Rate Limiting
```typescript
interface RateLimitConfig {
  windowMs: number; // 15 minutes
  maxRequests: number; // per window
  maxConcurrentSessions: number; // per user
  skipSuccessfulRequests: boolean;
  keyGenerator: (req: Request) => string;
}

interface RateLimitMiddleware {
  checkRequestLimit(req: Request, res: Response, next: NextFunction): Promise<void>;
  checkSessionLimit(userId: string): Promise<boolean>;
}
```

## Configuration

### Frontend API Configuration (STANDARDIZED)
```typescript
// Import shared configuration pattern
import { BaseModuleConfig, LogLevel, DEFAULT_TIMEOUT_CONFIG } from './shared-types';

interface FrontendAPIConfig extends BaseModuleConfig {
  moduleId: 'frontend-api';
  
  // Frontend API specific configuration
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
    // Note: timeout uses inherited timeouts.requestTimeoutMs
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
  // - logging: LoggingConfig (structured, includes sessionId, etc.)
  // - performance: PerformanceConfig
  // - timeouts: TimeoutConfig (provides request/connection timeout hierarchy)
}

// Default configuration
const DEFAULT_FRONTEND_API_CONFIG: FrontendAPIConfig = {
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
}
```

## Monitoring and Analytics

### API Metrics
```typescript
interface APIMetrics {
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

interface MetricsCollector {
  recordRequest(endpoint: string, method: string, statusCode: number, duration: number): void;
  recordSessionEvent(event: 'created' | 'completed' | 'failed'): void;
  recordStreamingEvent(event: 'connected' | 'disconnected' | 'event_sent'): void;
  getMetrics(): APIMetrics;
}
```

### Health Check Endpoints
```typescript
// Basic health check
GET /api/health

// Detailed health check  
GET /api/health/detailed

interface HealthCheckResponse {
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
```

## Testing Strategy

### API Testing Requirements
```typescript
interface APITestSuite {
  unitTests: [
    'request validation',
    'response transformation', 
    'error handling',
    'authentication middleware',
    'rate limiting'
  ];
  
  integrationTests: [
    'step processor communication',
    'executor streamer integration',
    'websocket connection handling',
    'sse connection handling',
    'session lifecycle management'
  ];
  
  performanceTests: [
    'concurrent request handling',
    'websocket connection limits',
    'streaming event throughput',
    'memory usage over time',
    'response time under load'
  ];
  
  securityTests: [
    'authentication bypass attempts',
    'rate limit enforcement',
    'input validation security',
    'websocket security',
    'cors policy enforcement'
  ];
}
```

## Implementation Phases

### Phase 1: Core REST API (Week 1-2)
- Basic step processing endpoints
- Session management endpoints  
- Request validation and error handling
- Integration with Step Processor module
- Basic authentication and rate limiting

### Phase 2: Streaming Integration (Week 3-4)
- WebSocket endpoint implementation
- Server-Sent Events endpoint implementation
- Integration with Executor Streamer module
- Real-time event broadcasting
- Connection management and cleanup

### Phase 3: Advanced Features (Week 5-6)
- Screenshot management endpoints
- Session history and replay functionality
- Export and template endpoints
- Advanced filtering and search
- Performance optimizations

### Phase 4: Production Readiness (Week 7-8)
- Comprehensive error handling
- Security hardening
- Monitoring and metrics
- Load testing and optimization
- Documentation and deployment guides

## Future Enhancements
- GraphQL API as alternative to REST
- Real-time collaboration features
- Advanced analytics and reporting
- API versioning and backward compatibility
- Webhook integration for external systems
- Advanced caching strategies
- Distributed deployment support
- API gateway integration
