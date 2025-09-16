# Executor Streamer Module Design Document

## Overview
The Executor Streamer module provides real-time streaming capabilities for AI reasoning processes, executor command execution, status updates, and screenshots. It creates session-based streams that can be consumed by web interfaces for live monitoring of automation workflows.

## Core Responsibilities
- Create and manage real-time streams tied to executor sessions
- Stream AI reasoning data and thought processes
- Stream executor command names and execution statuses
- Stream screenshot updates and metadata
- Provide web-friendly stream interfaces (WebSocket, Server-Sent Events)
- Handle stream lifecycle management and cleanup
- Maintain stream history and replay capabilities
- Provide interfaces for other modules to push data to streams

## Module Interface

### Stream Management (STANDARDIZED)
```typescript
// Import standardized session management types
import { 
  ISessionManager,
  ModuleSessionInfo,
  SessionStatus,
  SessionLifecycleCallbacks,
  ModuleSessionConfig
} from './shared-types';

interface StreamSession extends ModuleSessionInfo {
  moduleId: 'executor-streamer';
  streamId: string;           // Stream ID (matches streamId from WorkflowSession)
  isActive: boolean;
  clients: StreamClient[];
  history: StreamEvent[];
  config: StreamConfig;
  // Inherits: sessionId, linkedWorkflowSessionId, status, createdAt, lastActivity, metadata
}

interface IExecutorStreamerManager extends ISessionManager {
  readonly moduleId: 'executor-streamer';
  
  // Standardized session management (inherited)
  createSession(workflowSessionId: string, config?: StreamConfig): Promise<string>;
  destroySession(workflowSessionId: string): Promise<void>;
  getSession(workflowSessionId: string): ModuleSessionInfo | null;
  sessionExists(workflowSessionId: string): boolean;
  
  // Stream-specific methods (use workflowSessionId consistently)
  createStream(workflowSessionId: string, config?: StreamConfig): Promise<string>;
  getStream(workflowSessionId: string): StreamSession | null;
  destroyStream(workflowSessionId: string): Promise<void>;
  listActiveStreams(): string[];
  attachClient(workflowSessionId: string, client: StreamClient): Promise<void>;
  detachClient(workflowSessionId: string, clientId: string): Promise<void>;
}
```

### Stream Data Types (Using Shared Types)
```typescript
// Import shared types to avoid duplication
import { 
  StreamEventType,
  StreamEvent,
  StreamEventData,
  CommandStatus,
  CommandAction
} from './shared-types';

// All stream event types and data structures are now defined in shared-types.md
// This ensures consistency across all modules and prevents conflicts
```

### Client Management
```typescript
interface StreamClient {
  id: string;
  type: ClientType;
  connection: WebSocket | Response; // WebSocket or SSE Response
  connectedAt: Date;
  lastPing: Date;
  filters?: StreamFilter[];
  isActive: boolean;
}

enum ClientType {
  WEBSOCKET = 'WEBSOCKET',
  SERVER_SENT_EVENTS = 'SERVER_SENT_EVENTS',
  HTTP_POLLING = 'HTTP_POLLING'
}

interface StreamFilter {
  eventTypes?: StreamEventType[];
  sessionIds?: string[];
  timeRange?: { start: Date; end: Date };
  customFilter?: (event: StreamEvent) => boolean;
}
```

## Core Functionality

### 1. Stream Creation and Management

#### Create Stream
```typescript
async createStream(streamId: string, sessionId: string, config?: Partial<StreamConfig>): Promise<void>
```
- Create new stream session with provided stream ID linked to session
- Initialize empty client list and event history  
- Apply configuration settings
- Stream is ready for client connections

#### Stream Configuration
```typescript
interface StreamConfig {
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
```

### 2. Event Publishing Interface

#### Publisher Interface
```typescript
interface IStreamPublisher {
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
```

### 3. Client Connection Management

#### WebSocket Support
```typescript
interface WebSocketHandler {
  handleConnection(ws: WebSocket, streamId: string, filters?: StreamFilter[]): Promise<void>;
  handleDisconnection(clientId: string): Promise<void>;
  broadcastToClient(clientId: string, event: StreamEvent): Promise<void>;
  broadcastToStream(streamId: string, event: StreamEvent, excludeClient?: string): Promise<void>;
}
```

#### Server-Sent Events Support
```typescript
interface SSEHandler {
  createConnection(streamId: string, response: Response, filters?: StreamFilter[]): Promise<string>;
  sendEvent(clientId: string, event: StreamEvent): Promise<void>;
  closeConnection(clientId: string): Promise<void>;
}
```

### 4. Stream History and Replay

#### History Management
```typescript
interface StreamHistory {
  addEvent(streamId: string, event: StreamEvent): Promise<void>;
  getEvents(streamId: string, filters?: HistoryFilter): Promise<StreamEvent[]>;
  getEventsByTimeRange(streamId: string, start: Date, end: Date): Promise<StreamEvent[]>;
  getEventsByType(streamId: string, types: StreamEventType[]): Promise<StreamEvent[]>;
  clearHistory(streamId: string): Promise<void>;
  compactHistory(streamId: string, keepCount: number): Promise<void>;
}

interface HistoryFilter {
  eventTypes?: StreamEventType[];
  limit?: number;
  offset?: number;
  startTime?: Date;
  endTime?: Date;
  searchText?: string;
}
```

#### Replay Capabilities
```typescript
interface StreamReplay {
  replayToClient(clientId: string, filters?: HistoryFilter): Promise<void>;
  replayFromTimestamp(clientId: string, timestamp: Date): Promise<void>;
  replayLastEvents(clientId: string, count: number): Promise<void>;
}
```

### 5. Stream Analytics and Monitoring

#### Stream Metrics
```typescript
interface StreamMetrics {
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

interface StreamAnalytics {
  getMetrics(): StreamMetrics;
  getStreamStats(streamId: string): StreamStats;
  getEventDistribution(timeRange: { start: Date; end: Date }): Record<StreamEventType, number>;
  getClientActivity(timeRange: { start: Date; end: Date }): ClientActivityReport[];
}

interface StreamStats {
  streamId: string;
  clientCount: number;
  totalEvents: number;
  eventsInLastHour: number;
  averageEventFrequency: number;
  largestEventSize: number;
  memoryUsage: number;
}
```

## Implementation Guidelines

### Modular Structure
```
/src/modules/executor-streamer/
  ├── index.ts                # Main streamer interface
  ├── stream-manager.ts       # Stream lifecycle management
  ├── event-publisher.ts      # Event publishing and validation
  ├── client-manager.ts       # Client connection handling
  ├── websocket-handler.ts    # WebSocket connection management
  ├── sse-handler.ts         # Server-Sent Events handling
  ├── history-manager.ts     # Event history and persistence
  ├── analytics.ts           # Stream analytics and monitoring
  ├── filters.ts             # Event filtering logic
  ├── compression.ts         # Event compression utilities
  └── types.ts              # TypeScript type definitions
```

### Dependencies
- ws: WebSocket server implementation
- express or similar: HTTP server for SSE endpoints
- uuid: Event and client ID generation
- winston: Structured logging
- compression libraries: gzip, brotli for event compression
- optional: Redis for distributed streaming across multiple processes

### Configuration (FIXED: Extends BaseModuleConfig)
```typescript
// Import shared configuration pattern
import { BaseModuleConfig, DEFAULT_TIMEOUT_CONFIG } from './shared-types';

interface ExecutorStreamerConfig extends BaseModuleConfig {
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

// Default configuration
const DEFAULT_EXECUTOR_STREAMER_CONFIG: ExecutorStreamerConfig = {
  moduleId: 'executor-streamer',
  version: '1.0.0',
  enabled: true,
  
  server: {
    port: 3001,
    host: 'localhost',
    maxConnections: 1000
  },
  
  defaultStreamConfig: {
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
  },
  
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
}
```

## Web Interface Integration

### REST API Endpoints
```typescript
// Stream management
GET    /api/streams                    // List all active streams
POST   /api/streams                    // Create new stream
GET    /api/streams/:id                // Get stream details
DELETE /api/streams/:id                // Destroy stream

// Client connections
GET    /api/streams/:id/clients        // List stream clients
DELETE /api/streams/:id/clients/:clientId // Disconnect client

// History and replay
GET    /api/streams/:id/history        // Get event history
POST   /api/streams/:id/replay/:clientId // Trigger replay

// Analytics
GET    /api/streams/metrics            // Global metrics
GET    /api/streams/:id/stats          // Stream-specific stats
```

### WebSocket Protocol
```typescript
// Client -> Server messages
interface ClientMessage {
  type: 'subscribe' | 'unsubscribe' | 'replay' | 'ping' | 'filter';
  streamId?: string;
  filters?: StreamFilter[];
  replayOptions?: HistoryFilter;
}

// Server -> Client messages  
interface ServerMessage {
  type: 'event' | 'error' | 'pong' | 'connection_ack';
  event?: StreamEvent;
  error?: { code: string; message: string };
  metadata?: Record<string, any>;
}
```

### Server-Sent Events Format
```
event: stream_event
data: {"id":"evt_123","type":"COMMAND_STARTED","timestamp":"2024-01-01T10:00:00Z","data":{...}}

event: heartbeat
data: {"timestamp":"2024-01-01T10:00:30Z","active_clients":5}

event: error
data: {"code":"STREAM_ERROR","message":"Stream disconnected"}
```

## Testing Requirements
- Unit tests for all stream operations
- WebSocket connection lifecycle tests
- Server-Sent Events functionality tests
- Event publishing and filtering tests
- History and replay functionality tests
- Client disconnection and cleanup tests
- Performance tests for high-frequency events
- Stress tests for multiple concurrent clients
- Memory leak detection for long-running streams

## Security Considerations
- Validate all client input and filters
- Implement authentication for stream access
- Rate limiting for event publishing and client connections
- Sanitize event data before transmission
- Implement CORS policies for web clients
- Secure WebSocket upgrades
- Prevent event injection attacks

## Performance Requirements
- Support up to 100 concurrent clients per stream
- Handle up to 1000 events per second per stream
- Event delivery latency under 100ms
- Memory usage should not exceed 1GB for 24-hour operation
- Automatic cleanup of inactive clients (30-second timeout)
- Efficient event serialization and compression

## Error Handling
- Client disconnection recovery
- Stream recreation after executor session restart
- Event delivery failure handling
- Memory pressure management
- Network interruption resilience
- Invalid event data handling

## Future Enhancements
- Multi-server scaling with message brokers
- Event persistence to database for audit trails
- Advanced filtering with complex query languages
- Real-time collaboration features for multiple viewers
- Stream recording and playback
- Custom dashboard widgets for different event types
- Integration with monitoring and alerting systems
- Event-driven triggers and automation
