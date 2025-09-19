/**
 * Server-Sent Events (SSE) Event Streaming API Endpoint
 * GET /api/stream/ws/[sessionId] - Uses SSE for Next.js App Router compatibility
 * 
 * Provides real-time event streaming for automation execution monitoring
 */

import { NextRequest } from 'next/server';
import getExecutorStreamer from '@/modules/executor-streamer';
import { WebSocketMessage } from '../../../types';
import { ensureInitialized } from '@/lib/ensure-initialized';

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
    // Ensure application is initialized before streaming
    await ensureInitialized();
    
    // Get executor streamer instance
    const executorStreamer = getExecutorStreamer();
    
    // Verify singleton instance
    const instanceId = executorStreamer.getInstanceId();
    console.log(`[SSE API] Using ExecutorStreamer instance #${instanceId}`);

    // Check if stream exists - first try to find it, if not found, create it
    let streamExists = executorStreamer.streamExists(sessionId);
    
    if (!streamExists) {
      console.log(`[SSE API] Stream not found for session ${sessionId}, attempting to create it`);
      try {
        await executorStreamer.createStream(sessionId);
        streamExists = true;
        console.log(`[SSE API] Created stream for session ${sessionId}`);
      } catch (error) {
        // If creation fails, check if it already exists (race condition)
        if (executorStreamer.streamExists(sessionId)) {
          streamExists = true;
          console.log(`[SSE API] Stream was created by another process for session ${sessionId}`);
        } else {
          console.error(`[SSE API] Failed to create stream for session ${sessionId}:`, error instanceof Error ? error.message : error);
          return new Response(`Failed to create stream for session ${sessionId}`, { status: 500 });
        }
      }
    } else {
      console.log(`[SSE API] Stream found for session ${sessionId}`);
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
       // controller.enqueue(encoder.encode(`data: ${JSON.stringify(connectMessage)}\n\n`));

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
              // Parse the event wrapper first (events are double-JSON-encoded)
              try {
                const eventWrapper = JSON.parse(latestEvent);
                //console.log('[SSE] Event wrapper:', eventWrapper);
                
                // Check if this is a structured event by looking at the inner data
                let isStructuredEvent = false;
                let eventData = eventWrapper.data || latestEvent;
                
                try {
                  // Try to parse the inner data
                  const innerData = JSON.parse(eventWrapper.data);
                 // console.log('[SSE] Inner data:', innerData);
                  
                  // Check if it's a structured log message
                  if (innerData && innerData.type && ['reasoning', 'action', 'screenshot'].includes(innerData.type)) {
                    isStructuredEvent = true;
                    eventData = eventWrapper.data; // Keep as JSON string for UI to parse
                  } else {
                    // Regular event - use the inner data as the message
                    eventData = innerData;
                  }
                } catch (innerParseError) {
                  // If inner parsing fails, use the wrapper data as is
                  //console.log('[SSE] Using wrapper data as is:', eventWrapper.data);
                  eventData = eventWrapper.data || 'Event data unavailable';
                }
                
                const eventMessage: WebSocketMessage = {
                  type: isStructuredEvent ? 'structured_event' : 'event',
                  sessionId,
                  data: eventData,
                  timestamp: new Date().toISOString()
                };
                
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(eventMessage)}\n\n`));
                
              } catch (wrapperParseError) {
                console.error('[SSE] Failed to parse event wrapper:', wrapperParseError);
                // Fallback: send the raw event
                const fallbackMessage: WebSocketMessage = {
                  type: 'event',
                  sessionId,
                  data: latestEvent,
                  timestamp: new Date().toISOString()
                };
                
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(fallbackMessage)}\n\n`));
              }
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
        //console.log(`[SSE] Stream cancelled for session ${sessionId}`);
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

