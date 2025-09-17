/**
 * Client Manager - Handles client connection management and lifecycle
 * Manages WebSocket and SSE client connections with heartbeat and cleanup
 */

import {
  StreamEvent
} from '../../../types/shared-types';

import {
  StreamClient,
  StreamSession,
  ClientType,
  StreamFilter,
  ClientMessage,
  ServerMessage,
  ExecutorStreamerConfig
} from './types';

export class ClientManager {
  private clients: Map<string, StreamClient> = new Map();
  private config: ExecutorStreamerConfig;
  private heartbeatInterval?: NodeJS.Timeout;

  constructor(config: ExecutorStreamerConfig) {
    this.config = config;
    this.startHeartbeatMonitoring();
  }

  // Client Registration and Management

  registerClient(
    streamId: string,
    connection: WebSocket | Response,
    type: ClientType,
    filters?: StreamFilter[]
  ): StreamClient {
    const clientId = this.generateClientId();
    const now = new Date();

    const client: StreamClient = {
      id: clientId,
      type,
      connection,
      connectedAt: now,
      lastPing: now,
      filters,
      isActive: true
    };

    this.clients.set(clientId, client);
    return client;
  }

  unregisterClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.isActive = false;
      this.clients.delete(clientId);
    }
  }

  getClient(clientId: string): StreamClient | null {
    return this.clients.get(clientId) || null;
  }

  getActiveClients(): StreamClient[] {
    return Array.from(this.clients.values()).filter(client => client.isActive);
  }

  getClientsByType(type: ClientType): StreamClient[] {
    return Array.from(this.clients.values()).filter(client => 
      client.isActive && client.type === type
    );
  }

  getClientCount(): number {
    return this.clients.size;
  }

  getActiveClientCount(): number {
    return this.getActiveClients().length;
  }

  // Client Communication

  async sendToClient(clientId: string, message: ServerMessage): Promise<boolean> {
    const client = this.clients.get(clientId);
    if (!client || !client.isActive) {
      return false;
    }

    try {
      switch (client.type) {
        case ClientType.WEBSOCKET:
          await this.sendWebSocketMessage(client, message);
          break;
        case ClientType.SERVER_SENT_EVENTS:
          await this.sendSSEMessage(client, message);
          break;
        case ClientType.HTTP_POLLING:
          // HTTP polling doesn't send messages directly
          // Messages are queued and retrieved via polling
          break;
        default:
          throw new Error(`Unsupported client type: ${client.type}`);
      }
      return true;
    } catch (error) {
      console.error(`Failed to send message to client ${clientId}:`, error);
      await this.handleClientError(clientId, error);
      return false;
    }
  }

  async broadcastToClients(
    clients: StreamClient[], 
    message: ServerMessage, 
    excludeClientId?: string
  ): Promise<number> {
    const filteredClients = clients.filter(client => 
      client.isActive && client.id !== excludeClientId
    );

    const sendPromises = filteredClients.map(client => 
      this.sendToClient(client.id, message)
    );

    const results = await Promise.allSettled(sendPromises);
    return results.filter(result => 
      result.status === 'fulfilled' && result.value === true
    ).length;
  }

  async sendEventToClient(clientId: string, event: StreamEvent): Promise<boolean> {
    const message: ServerMessage = {
      type: 'event',
      event,
      metadata: {
        timestamp: new Date().toISOString(),
        clientId
      }
    };

    return await this.sendToClient(clientId, message);
  }

  async broadcastEvent(
    clients: StreamClient[], 
    event: StreamEvent, 
    excludeClientId?: string
  ): Promise<number> {
    const message: ServerMessage = {
      type: 'event',
      event,
      metadata: {
        timestamp: new Date().toISOString()
      }
    };

    return await this.broadcastToClients(clients, message, excludeClientId);
  }

  // Client Lifecycle Management

  async handleClientMessage(clientId: string, rawMessage: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client || !client.isActive) {
      return;
    }

    try {
      const message: ClientMessage = JSON.parse(rawMessage);
      
      // Update last ping time
      client.lastPing = new Date();

      switch (message.type) {
        case 'ping':
          await this.handlePing(clientId);
          break;
        case 'subscribe':
          await this.handleSubscribe(clientId, message);
          break;
        case 'unsubscribe':
          await this.handleUnsubscribe(clientId, message);
          break;
        case 'filter':
          await this.handleFilterUpdate(clientId, message);
          break;
        case 'replay':
          await this.handleReplay(clientId, message);
          break;
        default:
          await this.sendErrorToClient(clientId, 'INVALID_MESSAGE_TYPE', `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      await this.sendErrorToClient(clientId, 'MESSAGE_PARSE_ERROR', 'Failed to parse client message');
      console.error(`Error handling client message from ${clientId}:`, error);
    }
  }

  async disconnectClient(clientId: string, reason?: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    try {
      // Send disconnection notice if possible
      if (client.isActive) {
        await this.sendErrorToClient(clientId, 'DISCONNECTING', reason || 'Connection closed by server');
      }

      // Close the connection
      await this.closeClientConnection(client);
    } catch (error) {
      console.error(`Error during client disconnection ${clientId}:`, error);
    } finally {
      this.unregisterClient(clientId);
    }
  }

  async disconnectAllClients(reason?: string): Promise<void> {
    const clientIds = Array.from(this.clients.keys());
    
    const disconnectPromises = clientIds.map(clientId => 
      this.disconnectClient(clientId, reason)
    );

    await Promise.allSettled(disconnectPromises);
  }

  // Heartbeat and Health Monitoring

  private startHeartbeatMonitoring(): void {
    const interval = this.config.defaultStreamConfig.heartbeatInterval;
    
    this.heartbeatInterval = setInterval(() => {
      this.checkClientHeartbeats();
    }, interval);
  }

  private async checkClientHeartbeats(): Promise<void> {
    const now = Date.now();
    const timeout = this.config.defaultStreamConfig.heartbeatInterval * 2; // 2x heartbeat interval
    
    const staleClients: string[] = [];

    for (const [clientId, client] of this.clients) {
      if (client.isActive) {
        const timeSinceLastPing = now - client.lastPing.getTime();
        
        if (timeSinceLastPing > timeout) {
          staleClients.push(clientId);
        }
      }
    }

    // Disconnect stale clients
    for (const clientId of staleClients) {
      await this.disconnectClient(clientId, 'Heartbeat timeout');
    }
  }

  private stopHeartbeatMonitoring(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  // Message Handlers

  private async handlePing(clientId: string): Promise<void> {
    const pongMessage: ServerMessage = {
      type: 'pong',
      metadata: {
        timestamp: new Date().toISOString(),
        clientId
      }
    };

    await this.sendToClient(clientId, pongMessage);
  }

  private async handleSubscribe(clientId: string, message: ClientMessage): Promise<void> {
    // TODO: Implement subscription logic
    // This would involve coordinating with the stream manager to add the client to streams
  }

  private async handleUnsubscribe(clientId: string, message: ClientMessage): Promise<void> {
    // TODO: Implement unsubscription logic
    // This would involve coordinating with the stream manager to remove the client from streams
  }

  private async handleFilterUpdate(clientId: string, message: ClientMessage): Promise<void> {
    const client = this.clients.get(clientId);
    if (client && message.filters) {
      client.filters = message.filters;
      
      // Send acknowledgment
      const ackMessage: ServerMessage = {
        type: 'connection_ack',
        metadata: {
          message: 'Filters updated successfully',
          filters: client.filters
        }
      };
      
      await this.sendToClient(clientId, ackMessage);
    }
  }

  private async handleReplay(clientId: string, message: ClientMessage): Promise<void> {
    // TODO: Implement replay logic
    // This would involve coordinating with the history manager to replay events
  }

  // Transport-specific implementations

  private async sendWebSocketMessage(client: StreamClient, message: ServerMessage): Promise<void> {
    const ws = client.connection as WebSocket;
    
    if (ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket connection is not open');
    }

    const serialized = JSON.stringify(message);
    ws.send(serialized);
  }

  private async sendSSEMessage(client: StreamClient, message: ServerMessage): Promise<void> {
    const response = client.connection as Response;
    
    // TODO: Implement SSE message sending
    // This would involve writing to the SSE response stream
    throw new Error('SSE message sending not implemented yet');
  }

  private async closeClientConnection(client: StreamClient): Promise<void> {
    client.isActive = false;

    try {
      switch (client.type) {
        case ClientType.WEBSOCKET:
          const ws = client.connection as any;
          if (ws && typeof ws.close === 'function') {
            ws.close(1000, 'Normal closure');
          }
          break;
        case ClientType.SERVER_SENT_EVENTS:
          // TODO: Close SSE connection
          break;
        case ClientType.HTTP_POLLING:
          // HTTP polling connections are stateless
          break;
      }
    } catch (error) {
      console.error('Error closing client connection:', error);
    }
  }

  // Error Handling

  private async handleClientError(clientId: string, error: any): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    // Mark client as inactive if error is connection-related
    if (this.isConnectionError(error)) {
      client.isActive = false;
      this.unregisterClient(clientId);
    } else {
      // Try to send error message to client
      await this.sendErrorToClient(clientId, 'SERVER_ERROR', 'Internal server error occurred');
    }
  }

  private async sendErrorToClient(clientId: string, code: string, message: string): Promise<void> {
    const errorMessage: ServerMessage = {
      type: 'error',
      error: { code, message },
      metadata: {
        timestamp: new Date().toISOString(),
        clientId
      }
    };

    try {
      await this.sendToClient(clientId, errorMessage);
    } catch (error) {
      // If we can't send the error message, the connection is probably broken
      console.error(`Failed to send error message to client ${clientId}:`, error);
    }
  }

  private isConnectionError(error: any): boolean {
    // Check for common connection-related errors
    const connectionErrors = [
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'EPIPE',
      'Connection closed'
    ];

    const errorMessage = error?.message || String(error);
    return connectionErrors.some(errType => errorMessage.includes(errType));
  }

  // Utility Methods

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getClientStats() {
    const total = this.clients.size;
    const active = this.getActiveClientCount();
    const byType: Record<ClientType, number> = {
      [ClientType.WEBSOCKET]: 0,
      [ClientType.SERVER_SENT_EVENTS]: 0,
      [ClientType.HTTP_POLLING]: 0
    };

    for (const client of this.clients.values()) {
      if (client.isActive) {
        byType[client.type]++;
      }
    }

    return {
      total,
      active,
      byType,
      averageConnectionTime: this.calculateAverageConnectionTime()
    };
  }

  private calculateAverageConnectionTime(): number {
    const activeClients = this.getActiveClients();
    if (activeClients.length === 0) {
      return 0;
    }

    const now = Date.now();
    const totalConnectionTime = activeClients.reduce((sum, client) => {
      return sum + (now - client.connectedAt.getTime());
    }, 0);

    return totalConnectionTime / activeClients.length;
  }

  // Cleanup
  async shutdown(): Promise<void> {
    this.stopHeartbeatMonitoring();
    await this.disconnectAllClients('Server shutting down');
  }
}
