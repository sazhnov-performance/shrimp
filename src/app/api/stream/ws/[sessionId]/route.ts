/**
 * Server-Sent Events (SSE) Event Streaming API Endpoint
 * GET /api/stream/ws/[sessionId] - Uses SSE for Next.js App Router compatibility
 * 
 * Provides real-time event streaming for automation execution monitoring
 */

import { NextRequest } from 'next/server';
import getExecutorStreamer from '@/modules/executor-streamer';
import { WebSocketMessage } from '../../../types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  // Validate session ID
  if (!sessionId || typeof sessionId !== 'string') {
    return new Response('Session ID is required', { status: 400 });
  }

  try {
    // Get executor streamer instance
    const executorStreamer = getExecutorStreamer();
    
    // Verify singleton instance
    const instanceId = (executorStreamer as any).getInstanceId?.() || 'unknown';
    console.log(`[SSE API] Using ExecutorStreamer instance #${instanceId}`);

    // Check if stream exists by trying to get events
    try {
      await executorStreamer.getEvents(sessionId);
      console.log(`[SSE API] Stream found for session ${sessionId}`);
    } catch (error) {
      console.error(`[SSE API] Stream not found for session ${sessionId}:`, error instanceof Error ? error.message : error);
      return new Response(`Stream not found for session ${sessionId}`, { status: 404 });
    }

    // Create SSE stream
    let isStreamClosed = false;
    
    const stream = new ReadableStream({
      async start(controller) {
        // Send initial connection event
        const connectMessage: WebSocketMessage = {
          type: 'event',
          sessionId,
          data: 'Stream connection established',
          timestamp: new Date().toISOString()
        };
        
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(connectMessage)}\n\n`));

        // Poll for events
        const pollForEvents = async () => {
          try {
            // Check if stream is closed
            if (isStreamClosed) {
              return;
            }

            // Get latest event
            const latestEvent = await executorStreamer.extractLastEvent(sessionId);
            
            if (latestEvent) {
              // Try to parse structured event first, fallback to raw event
              let eventData = latestEvent;
              let isStructuredEvent = false;
              
              try {
                const parsedEvent = JSON.parse(latestEvent);
                // Check if it's a structured log message
                if (parsedEvent && parsedEvent.type && ['reasoning', 'action', 'screenshot'].includes(parsedEvent.type)) {
                  isStructuredEvent = true;
                  eventData = latestEvent; // Keep as JSON string for UI to parse
                } else if (parsedEvent && typeof parsedEvent.data === 'string') {
                  eventData = parsedEvent.data;
                }
              } catch (error) {
                // If parsing fails, use the original event data
                console.warn('[SSE] Failed to parse event data, using raw event:', error);
              }
              
              const eventMessage: WebSocketMessage = {
                type: isStructuredEvent ? 'structured_event' : 'event',
                sessionId,
                data: eventData,
                timestamp: new Date().toISOString()
              };
              
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(eventMessage)}\n\n`));
            }

            // Continue polling if stream is still open
            if (!isStreamClosed) {
              setTimeout(pollForEvents, 1000); // Poll every second
            }

          } catch (error) {
            console.error('[SSE] Error polling events:', error);
            
            const errorMessage: WebSocketMessage = {
              type: 'error',
              sessionId,
              data: error instanceof Error ? error.message : 'Error polling events',
              timestamp: new Date().toISOString()
            };
            
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorMessage)}\n\n`));
            } catch (enqueueError) {
              // Stream may be closed, ignore enqueue errors
              console.error('[SSE] Error enqueueing error message:', enqueueError);
            }
          }
        };

        // Start polling
        pollForEvents();
      },

      cancel() {
        console.log(`[SSE] Stream cancelled for session ${sessionId}`);
        isStreamClosed = true;
      }
    });

    // Return SSE response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('[SSE API] Error:', error);
    return new Response(
      error instanceof Error ? error.message : 'Unknown error occurred',
      { status: 500 }
    );
  }
}

