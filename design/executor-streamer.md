# Executor Streamer Design Document

## Overview
The Executor Streamer module provides a simple real-time event streaming system for workflow execution monitoring. It manages event streams by ID and allows modules to publish events and API endpoints to consume them.

## Core Responsibilities
- Create event streams with unique IDs
- Accept string events and queue them in streams
- Provide queue-based access for message consumption by other modules
- Allow API endpoints to read all events without consuming them
- **Out of scope**: WebSocket broadcasting, event filtering, complex event processing

## Module Interface

### Stream Management (Singleton Pattern)
```typescript
interface IExecutorStreamer {
  // Singleton instance access
  static getInstance(config?: ExecutorStreamerConfig): IExecutorStreamer;
  
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
```

### Stream Operations

#### Create Stream
```typescript
async createStream(streamId: string): Promise<void>
```
- Creates a new event stream with the provided ID
- Initializes empty event queue for the stream
- Throws error if stream ID already exists

#### Put Event
```typescript
async putEvent(streamId: string, eventData: string): Promise<void>
```
- Adds a string event to the end of the specified stream queue
- Events are queued in order of arrival (FIFO)
- Throws error if stream ID does not exist

#### Extract Last Event
```typescript
async extractLastEvent(streamId: string): Promise<string | null>
```
- Removes and returns the last (most recent) event from the queue
- Returns null if queue is empty
- Used by modules for real-time event consumption
- Throws error if stream ID does not exist

#### Extract All Events
```typescript
async extractAllEvents(streamId: string): Promise<string[]>
```
- Removes and returns all events from the queue in chronological order
- Clears the queue after extraction
- Returns empty array if queue was already empty
- Throws error if stream ID does not exist

#### Get Events (Read-Only)
```typescript
async getEvents(streamId: string): Promise<string[]>
```
- Returns all events in the queue without removing them
- Used by API endpoints to retrieve stream data for monitoring
- Returns events in chronological order
- Returns empty array if queue is empty
- Throws error if stream ID does not exist

#### Has Events
```typescript
async hasEvents(streamId: string): Promise<boolean>
```
- Checks if the stream has any queued events
- Used for efficient polling by other modules
- Returns false if queue is empty
- Throws error if stream ID does not exist

## Error Handling
```typescript
// Standard error codes for Executor Streamer
const EXECUTOR_STREAMER_ERRORS = {
  STREAM_NOT_FOUND: 'ES001',
  STREAM_ALREADY_EXISTS: 'ES002',
  INVALID_STREAM_ID: 'ES003'
} as const;
```

## Implementation Structure
```
/src/modules/executor-streamer/
  ├── index.ts              # Main interface implementation
  ├── stream-manager.ts     # Core stream storage and operations
  ├── event-publisher.ts    # Event publishing functionality
  ├── db-manager.ts         # SQLite database operations for event queues
  └── types.ts              # TypeScript type definitions
```

### Storage Backend - SQLite Integration

The module now uses SQLite as the persistent storage backend for event queues instead of in-memory Map storage. This provides:

- **Persistence**: Events survive application restarts
- **Concurrency**: Multiple processes can safely access the same event queues
- **Scalability**: Better performance for large numbers of events
- **Reliability**: ACID transactions ensure data integrity

#### Database Schema
```sql
-- Event queues table
CREATE TABLE IF NOT EXISTS event_queues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stream_id TEXT NOT NULL,
  event_data TEXT NOT NULL,
  event_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_stream_id (stream_id),
  INDEX idx_created_at (created_at)
);

-- Stream metadata table
CREATE TABLE IF NOT EXISTS stream_metadata (
  stream_id TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  event_count INTEGER DEFAULT 0
);
```

### Singleton Implementation Pattern
```typescript
class ExecutorStreamer implements IExecutorStreamer {
  private static instance: ExecutorStreamer | null = null;
  private streamManager: StreamManager;
  private eventPublisher: EventPublisher;
  private config: ExecutorStreamerConfig;

  private constructor(config: ExecutorStreamerConfig = DEFAULT_CONFIG) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.streamManager = new StreamManager(this.config);
    this.eventPublisher = new EventPublisher(this.streamManager, this.config);
  }

  static getInstance(config?: ExecutorStreamerConfig): IExecutorStreamer {
    if (!ExecutorStreamer.instance) {
      ExecutorStreamer.instance = new ExecutorStreamer(config);
    }
    return ExecutorStreamer.instance;
  }

  async createStream(streamId: string): Promise<void> {
    await this.streamManager.createStream(streamId);
  }

  async putEvent(streamId: string, eventData: string): Promise<void> {
    await this.eventPublisher.publishEvent(streamId, eventData);
  }

  // ... other interface methods
}
```

## Configuration
```typescript
interface ExecutorStreamerConfig {
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

const DEFAULT_CONFIG: ExecutorStreamerConfig = {
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
```

## Queue Behavior
- **putEvent**: Always adds to the end of the queue
- **extractLastEvent**: Removes from the end of the queue (most recent event)
- **extractAllEvents**: Removes all events, maintaining chronological order
- **getEvents**: Non-destructive read of all events in chronological order
- **hasEvents**: Efficient check for queue emptiness

This design provides queue-based event management with both consumption and monitoring capabilities.
