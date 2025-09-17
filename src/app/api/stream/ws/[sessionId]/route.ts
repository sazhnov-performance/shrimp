/**
 * WebSocket /api/stream/ws/[sessionId]
 * WebSocket event streaming endpoint
 * Based on design/frontend-api.md specifications
 */

import { NextRequest } from 'next/server';
import { WebSocketServer, WebSocket } from 'ws';
import { ExecutorStreamer } from '../../../../../../src/modules/executor-streamer';
import { StreamEvent } from '../../../../../../types/shared-types';

// WebSocket message format based on design
interface WebSocketMessage {
  type: 'event' | 'error' | 'close';
  sessionId: string;
  data: string;
  timestamp: string;
}

// Global WebSocket server instance
let wss: WebSocketServer | null = null;

/**
 * Initialize WebSocket server if not already initialized
 */
function initializeWebSocketServer(): WebSocketServer {
  if (!wss) {
    wss = new WebSocketServer({ noServer: true });
    console.log('[Frontend API] WebSocket server initialized');
  }
  return wss;
}

/**
 * Creates executor streamer instance  
 * As per design: reads events using executorStreamer.getEvents(sessionId)
 */
function createExecutorStreamer(): ExecutorStreamer {
  // TODO: Replace with proper dependency injection
  return new ExecutorStreamer();
}

/**
 * Polls for new events from executor streamer
 * As per design: calls executorStreamer.getEvents(sessionId)
 */
async function pollForEvents(sessionId: string, executorStreamer: ExecutorStreamer): Promise<StreamEvent[]> {
  try {
    // Use getEventHistory as specified in the ExecutorStreamer interface
    return await executorStreamer.getEventHistory(sessionId);
  } catch (error) {
    console.error(`[Frontend API] Error polling events for session ${sessionId}:`, error);
    return [];
  }
}

/**
 * Sends WebSocket message to client
 */
function sendMessage(ws: WebSocket, message: WebSocketMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('[Frontend API] Error sending WebSocket message:', error);
    }
  }
}

/**
 * Handles WebSocket upgrade and connection
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const sessionId = params.sessionId;
  
  console.log(`[Frontend API] WebSocket connection request for session: ${sessionId}`);

  // Validate session ID format
  if (!sessionId || typeof sessionId !== 'string' || sessionId.trim().length === 0) {
    return new Response('Invalid session ID', { status: 400 });
  }

  // Initialize WebSocket server
  const wss = initializeWebSocketServer();
  const executorStreamer = createExecutorStreamer();

  // Check if session exists or create stream
  try {
    const stream = executorStreamer.getStream(sessionId);
    if (!stream) {
      // Create stream if it doesn't exist
      await executorStreamer.createStream(sessionId);
      console.log(`[Frontend API] Created new stream for session: ${sessionId}`);
    }
  } catch (error) {
    console.error(`[Frontend API] Error creating/checking stream for session ${sessionId}:`, error);
    return new Response('Failed to initialize stream', { status: 500 });
  }

  // Handle WebSocket upgrade
  const upgradeHeader = request.headers.get('upgrade');
  if (upgradeHeader !== 'websocket') {
    return new Response('Expected WebSocket upgrade', { status: 426 });
  }

  // For Next.js API routes, we need to handle WebSocket differently
  // This is a simplified implementation - in production, you might want to use a different approach
  return new Response('WebSocket endpoint - upgrade handling would be implemented here', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}

/**
 * WebSocket connection handler (would be called by upgrade handler)
 */
export async function handleWebSocketConnection(
  ws: WebSocket,
  sessionId: string
): Promise<void> {
  console.log(`[Frontend API] WebSocket connected for session: ${sessionId}`);
  
  const executorStreamer = createExecutorStreamer();
  let isConnected = true;
  let eventsSent = new Set<string>();

  // Send initial message
  const initialMessage: WebSocketMessage = {
    type: 'event',
    sessionId,
    data: 'Connected to event stream',
    timestamp: new Date().toISOString()
  };
  sendMessage(ws, initialMessage);

  // Set up polling for events
  const pollInterval = setInterval(async () => {
    if (!isConnected) {
      clearInterval(pollInterval);
      return;
    }

    try {
      const events = await pollForEvents(sessionId, executorStreamer);
      
      // Send new events to client
      for (const event of events) {
        if (!eventsSent.has(event.id)) {
          const message: WebSocketMessage = {
            type: 'event',
            sessionId,
            data: JSON.stringify(event),
            timestamp: new Date().toISOString()
          };
          
          sendMessage(ws, message);
          eventsSent.add(event.id);
        }
      }
    } catch (error) {
      console.error(`[Frontend API] Error polling events for session ${sessionId}:`, error);
      
      const errorMessage: WebSocketMessage = {
        type: 'error',
        sessionId,
        data: `Polling error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString()
      };
      sendMessage(ws, errorMessage);
    }
  }, 1000); // Poll every 1 second

  // Handle WebSocket events
  ws.on('close', () => {
    console.log(`[Frontend API] WebSocket disconnected for session: ${sessionId}`);
    isConnected = false;
    clearInterval(pollInterval);
    
    const closeMessage: WebSocketMessage = {
      type: 'close',
      sessionId,
      data: 'Connection closed',
      timestamp: new Date().toISOString()
    };
    // Note: Can't send message after close, this is for logging
  });

  ws.on('error', (error) => {
    console.error(`[Frontend API] WebSocket error for session ${sessionId}:`, error);
    isConnected = false;
    clearInterval(pollInterval);
  });

  ws.on('ping', () => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.pong();
    }
  });
}

/**
 * Alternative implementation using Server-Sent Events (SSE)
 * This can be used as a fallback when WebSocket upgrade is not available
 */
export async function handleSSEConnection(
  request: NextRequest,
  sessionId: string
): Promise<Response> {
  console.log(`[Frontend API] SSE connection request for session: ${sessionId}`);
  
  const executorStreamer = createExecutorStreamer();
  
  // Check if session exists
  const stream = executorStreamer.getStream(sessionId);
  if (!stream) {
    return new Response('Stream not found', { status: 404 });
  }

  // Create readable stream for SSE
  const encoder = new TextEncoder();
  let eventsSent = new Set<string>();
  
  const stream_response = new ReadableStream({
    start(controller) {
      // Send initial connection event
      const initialData = `data: ${JSON.stringify({
        type: 'event',
        sessionId,
        data: 'Connected to SSE stream',
        timestamp: new Date().toISOString()
      })}\n\n`;
      controller.enqueue(encoder.encode(initialData));

      // Set up polling
      const pollInterval = setInterval(async () => {
        try {
          const events = await pollForEvents(sessionId, executorStreamer);
          
          for (const event of events) {
            if (!eventsSent.has(event.id)) {
              const message: WebSocketMessage = {
                type: 'event',
                sessionId,
                data: JSON.stringify(event),
                timestamp: new Date().toISOString()
              };
              
              const sseData = `data: ${JSON.stringify(message)}\n\n`;
              controller.enqueue(encoder.encode(sseData));
              eventsSent.add(event.id);
            }
          }
        } catch (error) {
          console.error(`[Frontend API] SSE polling error for session ${sessionId}:`, error);
          controller.error(error);
        }
      }, 1000);

      // Cleanup on stream close
      return () => {
        clearInterval(pollInterval);
      };
    },
  });

  return new Response(stream_response, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  });
}
