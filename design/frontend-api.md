# Frontend API Design Document

## Overview
Minimalistic API for UI Automation Interface using Next.js App Router. Provides 2 endpoints: execute automation steps and stream real-time logs.

## API Endpoints

### 1. Execute Automation Steps
```
POST /api/automation/execute
```

**Request:**
```typescript
interface ExecuteStepsRequest {
  steps: string[];
}
```

**Response:**
```typescript
interface ExecuteStepsResponse {
  sessionId: string;
  status: 'started';
  message: string;
}
```

**Example:**
```json
// Request
{
  "steps": [
    "Open google.com", 
    "Search for automation",
    "Click first result"
  ]
}

// Response
{
  "sessionId": "sess_abc123",
  "status": "started", 
  "message": "Automation execution started"
}
```

### 2. WebSocket Event Streaming
```
WebSocket: /api/stream/ws/:sessionId
```

**Message Format:**
```typescript
interface WebSocketMessage {
  type: 'event' | 'error' | 'close';
  sessionId: string;
  data: string;
  timestamp: string;
}
```

## Module Integration

### Step Processor
- Calls `stepProcessor.init(steps)` to get session ID
- Returns session ID immediately for UI tracking

### Executor Streamer  
- Reads events from existing stream: `executorStreamer.getEvents(sessionId)`
- Polls for new events: `executorStreamer.extractLastEvent(sessionId)`

## Next.js App Router Structure
```
/src/app/api/
  ├── automation/execute/route.ts     # Execute steps endpoint
  └── stream/ws/[sessionId]/route.ts  # WebSocket streaming
```

## Integration Flow
1. UI sends steps to execute endpoint
2. API calls step processor to get session ID
3. API returns session ID to UI
4. UI connects to WebSocket for real-time updates
5. Execution modules create stream and publish events
6. API polls stream and forwards events to UI

## Error Handling
- 400: Invalid steps array
- 404: Stream not found  
- 500: Execution failed