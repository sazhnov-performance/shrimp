# Frontend API Design Document (Simplified)

## Overview
The Frontend API is a **minimal HTTP server** that provides a simple bridge between web frontends and the automation system. It exposes only the essential functionality needed for the core use case: executing automation steps and streaming real-time results.

## Core Responsibilities
- **HTTP Server**: Simple Express.js server with minimal endpoints
- **Step Execution**: Single endpoint to execute automation steps
- **Real-time Streaming**: WebSocket connection for live automation updates
- **Basic Error Handling**: Convert errors to appropriate HTTP responses
- **Basic CORS**: Allow web frontend access

## Simplified Architecture

### HTTP Server Structure
```
Simplified Frontend API
├── Express.js Application
├── Single Execute Endpoint (/api/automation/execute)
├── WebSocket Server (/api/stream/ws/:streamId)
├── Basic CORS middleware
└── Step Processor Bridge

Web Frontend → POST /api/automation/execute → Step Processor → Response + Stream ID
Web Frontend → WebSocket /api/stream/ws/:streamId → Real-time Updates
```

### Core Components
```typescript
interface SimplifiedFrontendAPI {
  // Server Management
  start(port: number): Promise<void>;
  stop(): Promise<void>;
  
  // Single Execute Endpoint
  executeSteps(request: StepProcessingRequest): Promise<ExecuteResponse>;
  
  // WebSocket Streaming
  handleWebSocketConnection(streamId: string): WebSocket;
  
  // Internal Module Access (minimal)
  stepProcessor: IStepProcessor;
}
```

### Request Flow
```
1. Web Frontend: POST /api/automation/execute with steps
2. Frontend API: Execute via Step Processor
3. Frontend API: Return session ID and stream ID
4. Web Frontend: Connect to WebSocket /api/stream/ws/:streamId
5. Real-time updates flow through WebSocket
```

## Simplified API Endpoints

### Single Execute Endpoint

#### Execute Automation Steps
```typescript
POST /api/automation/execute
```

**Request:**
```typescript
import { StepProcessingRequest } from './shared-types';

// Simple request using shared types
type ExecuteRequest = StepProcessingRequest;
```

**Response:**
```typescript
interface ExecuteResponse {
  success: boolean;
  data: {
    sessionId: string;
    streamId?: string;
    initialStatus: SessionStatus;
    estimatedDuration?: number;
    createdAt: string;
  };
  metadata: {
    timestamp: string;
    requestId: string;
    version: string;
    processingTimeMs: number;
    streamUrl?: string;      // WebSocket URL: /api/stream/ws/:streamId
  };
  error?: {
    code: string;
    message: string;
  };
}
```

**Simple Implementation:**
```typescript
async executeSteps(req: Request, res: Response): Promise<void> {
  try {
    // Basic validation
    const { steps } = req.body;
    if (!steps || !Array.isArray(steps)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Steps field is required and must be an array'
        }
      });
    }

    // Process steps via Step Processor with default config
    const processingRequest: StepProcessingRequest = {
      steps,
      config: getDefaultConfig()
    };
    
    const result = await this.stepProcessor.processSteps(processingRequest);

    // Response matching UI expectations
    res.status(200).json({
      success: true,
      data: {
        sessionId: result.sessionId,
        streamId: result.streamId,
        initialStatus: result.initialStatus,
        estimatedDuration: result.estimatedDuration,
        createdAt: result.createdAt.toISOString()
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        version: '1.0.0',
        processingTimeMs: Date.now() - startTime,
        streamUrl: result.streamId ? `/api/stream/ws/${result.streamId}` : undefined
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'EXECUTION_ERROR',
        message: error.message || 'Failed to execute steps'
      }
    });
  }
}
```

## WebSocket Streaming

### Simple WebSocket Connection
```
WebSocket: /api/stream/ws/:streamId
```

**Connection Flow:**
1. Frontend receives `streamId` from execute response
2. Frontend connects to WebSocket at `/api/stream/ws/:streamId`
3. Real-time events flow through WebSocket connection
4. Frontend receives live updates of automation progress

**Message Format:**
```typescript
// Server -> Client: Stream events
interface StreamMessage {
  type: 'event';
  data: StreamEvent;  // Uses shared StreamEvent type
}

// Server -> Client: Errors
interface ErrorMessage {
  type: 'error';
  error: string;
}
```

## Simple Implementation Structure

### Minimal File Structure
```
/src/modules/frontend-api/
  ├── index.ts                    # Main server and exports
  ├── server.ts                   # Simple Express server
  ├── execute-handler.ts          # Single execute endpoint handler
  └── websocket-handler.ts        # Simple WebSocket streaming
```

### Simple Server Implementation
```typescript
// server.ts - Minimal Express server
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

export class SimpleFrontendAPI {
  private app = express();
  private server: any;
  private wsServer!: WebSocketServer;

  constructor(private stepProcessor: IStepProcessor) {
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(cors());
  }

  private setupRoutes(): void {
    // Single execute endpoint
    this.app.post('/api/automation/execute', this.handleExecute.bind(this));
  }

  async start(port: number = 3000): Promise<void> {
    this.server = createServer(this.app);
    
    // Setup WebSocket server
    this.wsServer = new WebSocketServer({ 
      server: this.server,
      path: '/api/stream/ws'
    });
    
    this.wsServer.on('connection', this.handleWebSocket.bind(this));
    
    return new Promise(resolve => {
      this.server.listen(port, () => {
        console.log(`Frontend API running on port ${port}`);
        resolve();
      });
    });
  }
}
```

## Summary

This simplified Frontend API design focuses only on the core automation use case:

**What was removed:**
- Authentication and authorization systems
- Rate limiting middleware
- Complex session management APIs
- Health check endpoints
- Screenshot management APIs
- Template and export functionality
- Server-Sent Events (SSE) support
- Complex validation middleware
- Multiple route files and controllers
- Advanced configuration options
- Monitoring and analytics features
- Complex error handling frameworks

**What remains (essential functionality):**
- Single execute endpoint: `POST /api/automation/execute` 
- WebSocket streaming: `/api/stream/ws/:streamId`
- Basic CORS support
- Basic error handling
- Simple Express server setup

This reduces the frontend API from **17+ endpoints** with complex middleware to **2 endpoints** with minimal configuration, perfectly suited for the core use case of executing automation steps and streaming real-time results.
