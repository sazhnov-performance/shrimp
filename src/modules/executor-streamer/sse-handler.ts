/**
 * Server-Sent Events Handler - Manages SSE connections for real-time streaming
 * Handles SSE protocol, connection management, and event streaming
 */

import {
  StreamEvent
} from '../../../types/shared-types';

import {
  SSEHandler as ISSEHandler,
  StreamClient,
  ClientType,
  StreamFilter,
  ServerMessage,
  ExecutorStreamerConfig
} from './types';

import { ClientManager } from './client-manager';
import { EventPublisher } from './event-publisher';

// SSE Response interface (simplified)
interface SSEResponse {
  writeHead(statusCode: number, headers: Record<string, string>): void;
  write(data: string): boolean;
  end(): void;
  on(event: string, listener: (...args: any[]) => void): void;
  once(event: string, listener: (...args: any[]) => void): void;
  destroyed: boolean;
  headersSent: boolean;
}

export class SSEHandler implements ISSEHandler {
  private clientManager: ClientManager;
  private eventPublisher: EventPublisher;
  private config: ExecutorStreamerConfig;
  private activeConnections: Map<string, SSEResponse> = new Map();
  private keepAliveIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    clientManager: ClientManager,
    eventPublisher: EventPublisher,
    config: ExecutorStreamerConfig
  ) {
    this.clientManager = clientManager;
    this.eventPublisher = eventPublisher;
    this.config = config;
  }

  async createConnection(
    streamId: string, 
    response: Response, 
    filters?: StreamFilter[]
  ): Promise<string> {
    const sseResponse = response as unknown as SSEResponse;
    
    // Set SSE headers
    this.setSSEHeaders(sseResponse);

    // Register the client
    const client = this.clientManager.registerClient(
      streamId,
      response,
      ClientType.SERVER_SENT_EVENTS,
      filters
    );

    // Store SSE response reference
    this.activeConnections.set(client.id, sseResponse);

    // Set up SSE connection handlers
    this.setupSSEHandlers(sseResponse, client.id, streamId);

    // Send connection establishment event
    await this.sendConnectionEstablished(client.id, {
      clientId: client.id,
      streamId,
      timestamp: new Date().toISOString(),
      filters: client.filters,
      serverCapabilities: {
        heartbeat: this.config.defaultStreamConfig.heartbeatInterval,
        compression: this.config.compression.enabled
      }
    });

    // Start keep-alive mechanism
    this.startKeepAlive(client.id);

    console.log(`SSE client connected: ${client.id} to stream: ${streamId}`);
    return client.id;
  }

  async sendEvent(clientId: string, event: StreamEvent): Promise<void> {
    const client = this.clientManager.getClient(clientId);
    if (!client || client.type !== ClientType.SERVER_SENT_EVENTS) {
      return;
    }

    // Filter event for client
    const filteredEvents = this.eventPublisher.filterEventsForClient([event], client);
    if (filteredEvents.length === 0) {
      return;
    }

    const sseResponse = this.activeConnections.get(clientId);
    if (!sseResponse || sseResponse.destroyed) {
      // Connection is not available, handle disconnection
      await this.closeConnection(clientId);
      return;
    }

    try {
      const eventData = {
        id: event.id,
        type: event.type,
        timestamp: event.timestamp.toISOString(),
        sessionId: event.sessionId,
        stepIndex: event.stepIndex,
        data: event.data,
        metadata: event.metadata
      };

      await this.writeSSEEvent('stream_event', eventData, sseResponse);
    } catch (error) {
      console.error(`Failed to send SSE event to client ${clientId}:`, error);
      await this.closeConnection(clientId);
    }
  }

  async closeConnection(clientId: string): Promise<void> {
    // Stop keep-alive
    this.stopKeepAlive(clientId);

    const sseResponse = this.activeConnections.get(clientId);
    
    if (sseResponse) {
      try {
        // Send connection closing event
        if (!sseResponse.destroyed && !sseResponse.headersSent) {
          await this.writeSSEEvent('connection_close', {
            clientId,
            timestamp: new Date().toISOString(),
            reason: 'Connection closed by server'
          }, sseResponse);
        }

        // Close the response stream
        if (!sseResponse.destroyed) {
          sseResponse.end();
        }
      } catch (error) {
        console.error(`Error closing SSE connection for client ${clientId}:`, error);
      }
      
      // Remove from active connections
      this.activeConnections.delete(clientId);
    }

    // Unregister client
    this.clientManager.unregisterClient(clientId);

    console.log(`SSE client disconnected: ${clientId}`);
  }

  // Private SSE Management Methods

  private setSSEHeaders(response: SSEResponse): void {
    const headers = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    // Apply CORS settings from config
    if (this.config.security.corsOrigins.length > 0) {
      headers['Access-Control-Allow-Origin'] = this.config.security.corsOrigins.join(', ');
    }

    response.writeHead(200, headers);
  }

  private setupSSEHandlers(
    response: SSEResponse, 
    clientId: string, 
    streamId: string
  ): void {
    // Handle client disconnection
    const closeHandler = () => {
      console.log(`SSE client ${clientId} disconnected`);
      this.closeConnection(clientId);
    };

    // Handle response errors
    const errorHandler = (error: Error) => {
      console.error(`SSE error for client ${clientId}:`, error);
      this.closeConnection(clientId);
    };

    response.on('close', closeHandler);
    response.on('error', errorHandler);
    response.once('finish', closeHandler);

    // Store handlers for cleanup
    (response as any)._handlers = {
      close: closeHandler,
      error: errorHandler
    };
  }

  private async writeSSEEvent(
    eventType: string, 
    data: any, 
    response: SSEResponse
  ): Promise<void> {
    if (response.destroyed) {
      throw new Error('SSE response stream is destroyed');
    }

    try {
      const eventId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const serializedData = JSON.stringify(data);
      
      // Check data size
      const dataSize = Buffer.byteLength(serializedData, 'utf8');
      const maxSize = 64 * 1024; // 64KB limit for SSE
      
      if (dataSize > maxSize) {
        throw new Error(`SSE event data too large: ${dataSize} bytes (max: ${maxSize})`);
      }

      // Format SSE event
      let sseEvent = '';
      sseEvent += `id: ${eventId}\n`;
      sseEvent += `event: ${eventType}\n`;
      sseEvent += `data: ${serializedData}\n\n`;

      // Write to response
      const written = response.write(sseEvent);
      
      if (!written) {
        // If write returns false, the buffer is full
        // We should handle backpressure, but for now just log it
        console.warn(`SSE write buffer full for client`);
      }
    } catch (error) {
      throw new Error(`Failed to write SSE event: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async sendConnectionEstablished(clientId: string, metadata: any): Promise<void> {
    const response = this.activeConnections.get(clientId);
    if (!response) {
      return;
    }

    await this.writeSSEEvent('connection_established', metadata, response);
  }

  private startKeepAlive(clientId: string): void {
    const interval = this.config.defaultStreamConfig.heartbeatInterval;
    
    const keepAliveTimer = setInterval(async () => {
      const response = this.activeConnections.get(clientId);
      if (!response || response.destroyed) {
        this.stopKeepAlive(clientId);
        return;
      }

      try {
        // Send heartbeat event
        await this.writeSSEEvent('heartbeat', {
          timestamp: new Date().toISOString(),
          active_clients: this.activeConnections.size
        }, response);

        // Update client's last ping time
        const client = this.clientManager.getClient(clientId);
        if (client) {
          client.lastPing = new Date();
        }
      } catch (error) {
        console.error(`SSE heartbeat failed for client ${clientId}:`, error);
        this.stopKeepAlive(clientId);
        await this.closeConnection(clientId);
      }
    }, interval);

    this.keepAliveIntervals.set(clientId, keepAliveTimer);
  }

  private stopKeepAlive(clientId: string): void {
    const timer = this.keepAliveIntervals.get(clientId);
    if (timer) {
      clearInterval(timer);
      this.keepAliveIntervals.delete(clientId);
    }
  }

  // Public utility methods

  async broadcastToStream(
    streamId: string, 
    event: StreamEvent, 
    excludeClient?: string
  ): Promise<void> {
    const clients = this.clientManager.getClientsByType(ClientType.SERVER_SENT_EVENTS);
    
    const streamClients = clients.filter(client => {
      // TODO: Filter clients by streamId - this would require tracking which clients belong to which streams
      // For now, broadcast to all SSE clients except excluded one
      return client.id !== excludeClient;
    });

    const sendPromises = streamClients.map(client => 
      this.sendEvent(client.id, event)
    );

    await Promise.allSettled(sendPromises);
  }

  async sendCustomEvent(
    clientId: string, 
    eventType: string, 
    data: any
  ): Promise<void> {
    const response = this.activeConnections.get(clientId);
    if (!response || response.destroyed) {
      return;
    }

    await this.writeSSEEvent(eventType, data, response);
  }

  async broadcastCustomEvent(
    eventType: string, 
    data: any, 
    excludeClient?: string
  ): Promise<void> {
    const clients = this.clientManager.getClientsByType(ClientType.SERVER_SENT_EVENTS);
    
    const sendPromises = clients
      .filter(client => client.id !== excludeClient)
      .map(client => this.sendCustomEvent(client.id, eventType, data));

    await Promise.allSettled(sendPromises);
  }

  getConnectionStats() {
    const totalConnections = this.activeConnections.size;
    const activeConnections = Array.from(this.activeConnections.values())
      .filter(response => !response.destroyed).length;
    const keepAliveTimers = this.keepAliveIntervals.size;

    return {
      total: totalConnections,
      active: activeConnections,
      destroyed: totalConnections - activeConnections,
      keepAliveTimers
    };
  }

  // Health monitoring
  async performHealthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    stats: ReturnType<typeof this.getConnectionStats>;
  }> {
    const issues: string[] = [];
    const stats = this.getConnectionStats();

    // Check for connection/timer mismatches
    if (stats.keepAliveTimers !== stats.active) {
      issues.push('Mismatch between active connections and keep-alive timers');
    }

    // Check for too many destroyed connections
    if (stats.destroyed > stats.total * 0.1) { // More than 10% destroyed
      issues.push('High number of destroyed connections detected');
    }

    // Check for connection leaks
    const registeredClients = this.clientManager.getClientsByType(ClientType.SERVER_SENT_EVENTS).length;
    if (this.activeConnections.size > registeredClients * 1.1) { // 10% tolerance
      issues.push('Potential SSE connection leak detected');
    }

    return {
      healthy: issues.length === 0,
      issues,
      stats
    };
  }

  // Cleanup
  async shutdown(): Promise<void> {
    console.log('Shutting down SSE handler...');
    
    // Stop all keep-alive timers
    for (const [clientId, timer] of this.keepAliveIntervals) {
      clearInterval(timer);
    }
    this.keepAliveIntervals.clear();

    // Close all connections
    const clientIds = Array.from(this.activeConnections.keys());
    
    const closePromises = clientIds.map(clientId =>
      this.closeConnection(clientId)
    );

    await Promise.allSettled(closePromises);
    
    // Clear connections map
    this.activeConnections.clear();
    
    console.log('SSE handler shutdown complete');
  }
}
