/**
 * WebSocket Handler - Manages WebSocket connections for real-time streaming
 * Handles WebSocket protocol, connection management, and message routing
 */

import {
  StreamEvent
} from '../../../types/shared-types';

import {
  WebSocketHandler as IWebSocketHandler,
  StreamClient,
  ClientType,
  StreamFilter,
  ClientMessage,
  ServerMessage,
  ExecutorStreamerConfig
} from './types';

import { ClientManager } from './client-manager';
import { EventPublisher } from './event-publisher';

// WebSocket implementation (using ws library interface)
interface WebSocket {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  on(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener: (...args: any[]) => void): void;
  ping(): void;
  pong(data?: Buffer): void;
}

// WebSocket states
const WEBSOCKET_STATES = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
} as const;

export class WebSocketHandler implements IWebSocketHandler {
  private clientManager: ClientManager;
  private eventPublisher: EventPublisher;
  private config: ExecutorStreamerConfig;
  private activeConnections: Map<string, WebSocket> = new Map();

  constructor(
    clientManager: ClientManager,
    eventPublisher: EventPublisher,
    config: ExecutorStreamerConfig
  ) {
    this.clientManager = clientManager;
    this.eventPublisher = eventPublisher;
    this.config = config;
  }

  async handleConnection(
    ws: WebSocket, 
    streamId: string, 
    filters?: StreamFilter[]
  ): Promise<void> {
    // Register the client
    const client = this.clientManager.registerClient(
      streamId,
      ws,
      ClientType.WEBSOCKET,
      filters
    );

    // Store WebSocket reference
    this.activeConnections.set(client.id, ws);

    // Set up WebSocket event handlers
    this.setupWebSocketHandlers(ws, client.id, streamId);

    // Send connection acknowledgment
    await this.sendConnectionAck(client.id, {
      clientId: client.id,
      streamId,
      timestamp: new Date().toISOString(),
      filters: client.filters,
      serverCapabilities: {
        compression: this.config.compression.enabled,
        heartbeat: this.config.defaultStreamConfig.heartbeatInterval,
        maxMessageSize: 1024 * 1024 // 1MB default
      }
    });

    console.log(`WebSocket client connected: ${client.id} to stream: ${streamId}`);
  }

  async handleDisconnection(clientId: string): Promise<void> {
    const ws = this.activeConnections.get(clientId);
    
    if (ws) {
      // Remove event listeners
      this.removeWebSocketHandlers(ws);
      
      // Close connection if still open
      if (ws.readyState === WEBSOCKET_STATES.OPEN || ws.readyState === undefined) {
        try {
          ws.close(1000, 'Normal closure');
        } catch (error) {
          console.warn(`Error closing WebSocket for client ${clientId}:`, error);
        }
      }
      
      // Remove from active connections
      this.activeConnections.delete(clientId);
    }

    // Unregister client
    this.clientManager.unregisterClient(clientId);

    console.log(`WebSocket client disconnected: ${clientId}`);
  }

  async broadcastToClient(clientId: string, event: StreamEvent): Promise<void> {
    const client = this.clientManager.getClient(clientId);
    if (!client || client.type !== ClientType.WEBSOCKET) {
      return;
    }

    // Filter event for client
    const filteredEvents = this.eventPublisher.filterEventsForClient([event], client);
    if (filteredEvents.length === 0) {
      return;
    }

    const ws = this.activeConnections.get(clientId);
    if (!ws || ws.readyState !== WEBSOCKET_STATES.OPEN) {
      // Connection is not available, handle disconnection
      await this.handleDisconnection(clientId);
      return;
    }

    try {
      const message: ServerMessage = {
        type: 'event',
        event,
        metadata: {
          timestamp: new Date().toISOString(),
          clientId
        }
      };

      await this.sendMessage(ws, message);
    } catch (error) {
      console.error(`Failed to broadcast to WebSocket client ${clientId}:`, error);
      await this.handleDisconnection(clientId);
    }
  }

  async broadcastToStream(
    streamId: string, 
    event: StreamEvent, 
    excludeClient?: string
  ): Promise<void> {
    const clients = this.clientManager.getClientsByType(ClientType.WEBSOCKET);
    
    const streamClients = clients.filter(client => {
      // TODO: Filter clients by streamId - this would require tracking which clients belong to which streams
      // For now, broadcast to all WebSocket clients except excluded one
      return client.id !== excludeClient;
    });

    const broadcastPromises = streamClients.map(client => 
      this.broadcastToClient(client.id, event)
    );

    await Promise.allSettled(broadcastPromises);
  }

  // Private WebSocket Management Methods

  private setupWebSocketHandlers(ws: WebSocket, clientId: string, streamId: string): void {
    // Message handler
    const messageHandler = async (data: string) => {
      try {
        await this.handleClientMessage(clientId, data);
      } catch (error) {
        console.error(`Error handling WebSocket message from ${clientId}:`, error);
        await this.sendError(clientId, 'MESSAGE_PROCESSING_ERROR', 'Failed to process message');
      }
    };

    // Error handler
    const errorHandler = (error: Error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      this.handleDisconnection(clientId);
    };

    // Close handler
    const closeHandler = (code: number, reason: string) => {
      console.log(`WebSocket closed for client ${clientId}: ${code} - ${reason}`);
      this.handleDisconnection(clientId);
    };

    // Ping handler (for keeping connection alive)
    const pingHandler = () => {
      try {
        ws.pong();
        // Update last ping time
        const client = this.clientManager.getClient(clientId);
        if (client) {
          client.lastPing = new Date();
        }
      } catch (error) {
        console.error(`Error responding to ping from ${clientId}:`, error);
      }
    };

    // Pong handler
    const pongHandler = () => {
      // Update last ping time
      const client = this.clientManager.getClient(clientId);
      if (client) {
        client.lastPing = new Date();
      }
    };

    // Set up event listeners
    ws.on('message', messageHandler);
    ws.on('error', errorHandler);
    ws.on('close', closeHandler);
    ws.on('ping', pingHandler);
    ws.on('pong', pongHandler);

    // Store handlers for cleanup
    (ws as any)._handlers = {
      message: messageHandler,
      error: errorHandler,
      close: closeHandler,
      ping: pingHandler,
      pong: pongHandler
    };
  }

  private removeWebSocketHandlers(ws: WebSocket): void {
    const handlers = (ws as any)._handlers;
    if (handlers) {
      ws.off('message', handlers.message);
      ws.off('error', handlers.error);
      ws.off('close', handlers.close);
      ws.off('ping', handlers.ping);
      ws.off('pong', handlers.pong);
      delete (ws as any)._handlers;
    }
  }

  private async handleClientMessage(clientId: string, rawMessage: string): Promise<void> {
    try {
      const message: ClientMessage = JSON.parse(rawMessage);
      
      // Update client's last ping time
      const client = this.clientManager.getClient(clientId);
      if (client) {
        client.lastPing = new Date();
      }

      // Delegate to client manager for message processing
      await this.clientManager.handleClientMessage(clientId, rawMessage);
    } catch (error) {
      await this.sendError(clientId, 'INVALID_MESSAGE', 'Failed to parse message');
    }
  }

  private async sendMessage(ws: WebSocket, message: ServerMessage): Promise<void> {
    if (ws.readyState !== WEBSOCKET_STATES.OPEN) {
      throw new Error('WebSocket is not in OPEN state');
    }

    let serialized: string;
    
    try {
      // Serialize message
      serialized = JSON.stringify(message);
      
      // Check message size
      const messageSize = Buffer.byteLength(serialized, 'utf8');
      const maxSize = 1024 * 1024; // 1MB
      
      if (messageSize > maxSize) {
        // Try compression if enabled
        if (this.config.compression.enabled && messageSize > this.config.compression.threshold) {
          // TODO: Implement message compression
          console.warn(`Large message (${messageSize} bytes) sent without compression`);
        } else {
          throw new Error(`Message too large: ${messageSize} bytes`);
        }
      }
      
      ws.send(serialized);
    } catch (error) {
      throw new Error(`Failed to send WebSocket message: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async sendConnectionAck(clientId: string, metadata: any): Promise<void> {
    const ws = this.activeConnections.get(clientId);
    if (!ws) {
      return;
    }

    const ackMessage: ServerMessage = {
      type: 'connection_ack',
      metadata
    };

    await this.sendMessage(ws, ackMessage);
  }

  private async sendError(clientId: string, code: string, message: string): Promise<void> {
    const ws = this.activeConnections.get(clientId);
    if (!ws) {
      return;
    }

    const errorMessage: ServerMessage = {
      type: 'error',
      error: { code, message },
      metadata: {
        timestamp: new Date().toISOString(),
        clientId
      }
    };

    try {
      await this.sendMessage(ws, errorMessage);
    } catch (error) {
      console.error(`Failed to send error message to client ${clientId}:`, error);
    }
  }

  // WebSocket-specific utilities

  async pingClient(clientId: string): Promise<void> {
    const ws = this.activeConnections.get(clientId);
    if (ws && ws.readyState === WEBSOCKET_STATES.OPEN) {
      try {
        ws.ping();
      } catch (error) {
        console.error(`Failed to ping client ${clientId}:`, error);
        await this.handleDisconnection(clientId);
      }
    }
  }

  async pingAllClients(): Promise<void> {
    const pingPromises = Array.from(this.activeConnections.keys()).map(clientId =>
      this.pingClient(clientId)
    );

    await Promise.allSettled(pingPromises);
  }

  getConnectionStats() {
    const totalConnections = this.activeConnections.size;
    const openConnections = Array.from(this.activeConnections.values())
      .filter(ws => ws.readyState === WEBSOCKET_STATES.OPEN).length;
    const connectingConnections = Array.from(this.activeConnections.values())
      .filter(ws => ws.readyState === WEBSOCKET_STATES.CONNECTING).length;
    const closingConnections = Array.from(this.activeConnections.values())
      .filter(ws => ws.readyState === WEBSOCKET_STATES.CLOSING).length;

    return {
      total: totalConnections,
      open: openConnections,
      connecting: connectingConnections,
      closing: closingConnections,
      closed: totalConnections - openConnections - connectingConnections - closingConnections
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

    // Check for too many stale connections
    if (stats.closing > stats.total * 0.1) { // More than 10% closing
      issues.push('High number of closing connections detected');
    }

    // Check for connection leaks
    const registeredClients = this.clientManager.getClientsByType(ClientType.WEBSOCKET).length;
    if (this.activeConnections.size > registeredClients * 1.1) { // 10% tolerance
      issues.push('Potential connection leak detected');
    }

    return {
      healthy: issues.length === 0,
      issues,
      stats
    };
  }

  // Cleanup
  async shutdown(): Promise<void> {
    console.log('Shutting down WebSocket handler...');
    
    // Disconnect all clients
    const clientIds = Array.from(this.activeConnections.keys());
    
    const disconnectPromises = clientIds.map(clientId =>
      this.handleDisconnection(clientId)
    );

    await Promise.allSettled(disconnectPromises);
    
    // Clear connections map
    this.activeConnections.clear();
    
    console.log('WebSocket handler shutdown complete');
  }
}
