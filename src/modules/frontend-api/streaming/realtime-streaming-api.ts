/**
 * Real-time Streaming API Implementation
 * Handles WebSocket and Server-Sent Events for real-time communication
 */

import { v4 as uuidv4 } from 'uuid';
import {
  StreamEvent,
  StreamEventType
} from '../../../../types/shared-types';
import {
  RealtimeStreamingAPI,
  WSClientMessage,
  WSServerMessage,
  StreamClient,
  ClientType,
  StreamFilter,
  ClientConnection,
  StreamConnection,
  FrontendAPIConfig
} from '../types';
import { FrontendAPISessionManager } from '../session-manager';
import { FrontendAPIErrorHandler } from '../error-handler';

export class RealtimeStreamingAPIImpl implements RealtimeStreamingAPI {
  private config: FrontendAPIConfig;
  private sessionManager: FrontendAPISessionManager;
  private errorHandler: FrontendAPIErrorHandler;
  private streamManager?: any; // IExecutorStreamerManager interface
  private activeClients: Map<string, StreamClient> = new Map();
  private streamSubscriptions: Map<string, Set<string>> = new Map(); // streamId -> clientIds

  constructor(
    config: FrontendAPIConfig,
    sessionManager: FrontendAPISessionManager,
    errorHandler: FrontendAPIErrorHandler
  ) {
    this.config = config;
    this.sessionManager = sessionManager;
    this.errorHandler = errorHandler;
  }

  /**
   * Initialize with stream manager integration
   */
  async initialize?(streamManager: any): Promise<void> {
    this.streamManager = streamManager;
    
    // Subscribe to stream events if stream manager supports it
    if (this.streamManager?.onStreamEvent) {
      this.streamManager.onStreamEvent(this.handleStreamEvent.bind(this));
    }
  }

  /**
   * Handles WebSocket connection for real-time streaming
   */
  async handleWebSocketConnection(streamId: string, socket: any, query: any): Promise<void> {
    try {
      // 1. Validate stream exists
      const stream = await this.validateStream(streamId);
      if (!stream) {
        socket.close(4404, 'Stream not found');
        return;
      }

      // 2. Create client registration
      const clientId = this.generateClientId();
      const client: StreamClient = {
        id: clientId,
        type: ClientType.WEBSOCKET,
        connection: socket,
        connectedAt: new Date(),
        lastPing: new Date(),
        filters: this.parseFilters(query.filters),
        isActive: true
      };

      // 3. Register client
      this.activeClients.set(clientId, client);
      this.addClientToStream(streamId, clientId);

      // 4. Register with session manager
      const workflowSessionId = await this.findWorkflowSessionForStream(streamId);
      if (workflowSessionId) {
        const clientConnection: ClientConnection = {
          clientId,
          type: 'websocket',
          connectedAt: client.connectedAt,
          lastActivity: client.connectedAt,
          isActive: true
        };
        await this.sessionManager.addClientConnection(workflowSessionId, clientConnection);
      }

      // 5. Send connection acknowledgment
      this.sendWebSocketMessage(socket, {
        type: 'connection_ack',
        payload: {
          metadata: {
            clientId,
            streamId,
            connectedAt: client.connectedAt.toISOString(),
            availableEventTypes: Object.values(StreamEventType)
          }
        }
      });

      // 6. Send history if requested
      if (query.includeHistory === 'true') {
        await this.sendHistoryToClient(client, streamId, parseInt(query.historyLimit) || 50);
      }

      // 7. Setup message handlers
      socket.on('message', (data: any) => this.handleClientMessage(client, data));
      socket.on('close', () => this.handleClientDisconnect(streamId, clientId));
      socket.on('error', (error: any) => this.handleClientError(client, error));

      // 8. Setup heartbeat
      this.setupHeartbeat(client);

    } catch (error) {
      socket.close(4500, 'Connection setup failed');
    }
  }

  /**
   * Handles Server-Sent Events connection for real-time streaming
   */
  async handleSSEConnection(streamId: string, request: any, response: any): Promise<void> {
    try {
      // 1. Validate stream exists
      const stream = await this.validateStream(streamId);
      if (!stream) {
        response.status(404).json({ error: 'Stream not found' });
        return;
      }

      // 2. Set SSE headers
      response.setHeader('Content-Type', 'text/event-stream');
      response.setHeader('Cache-Control', 'no-cache');
      response.setHeader('Connection', 'keep-alive');
      response.setHeader('Access-Control-Allow-Origin', '*');

      // 3. Create client registration
      const clientId = this.generateClientId();
      const client: StreamClient = {
        id: clientId,
        type: ClientType.SERVER_SENT_EVENTS,
        connection: response,
        connectedAt: new Date(),
        lastPing: new Date(),
        filters: this.parseFilters(request.query.filters as string),
        isActive: true
      };

      // 4. Register client
      this.activeClients.set(clientId, client);
      this.addClientToStream(streamId, clientId);

      // 5. Register with session manager
      const workflowSessionId = await this.findWorkflowSessionForStream(streamId);
      if (workflowSessionId) {
        const clientConnection: ClientConnection = {
          clientId,
          type: 'sse',
          connectedAt: client.connectedAt,
          lastActivity: client.connectedAt,
          isActive: true
        };
        await this.sessionManager.addClientConnection(workflowSessionId, clientConnection);
      }

      // 6. Send initial connection event
      this.sendSSEEvent(response, 'connection_ack', {
        clientId,
        streamId,
        timestamp: new Date().toISOString()
      });

      // 7. Send history if requested
      if (request.query.includeHistory === 'true') {
        await this.sendHistoryToClient(client, streamId, parseInt(request.query.historyLimit) || 50);
      }

      // 8. Setup heartbeat
      const heartbeat = setInterval(() => {
        if (response.writableEnded) {
          clearInterval(heartbeat);
          return;
        }
        this.sendSSEEvent(response, 'heartbeat', { timestamp: new Date().toISOString() });
      }, this.config.executorStreamer.heartbeatInterval);

      // 9. Handle client disconnect
      request.on('close', async () => {
        clearInterval(heartbeat);
        await this.handleClientDisconnect(streamId, clientId);
      });

    } catch (error) {
      response.status(500).json({ error: 'SSE connection setup failed' });
    }
  }

  /**
   * Broadcasts an event to all subscribed clients
   */
  async broadcastEvent(event: StreamEvent): Promise<void> {
    const streamId = await this.findStreamForSession(event.sessionId);
    if (!streamId) {
      return; // No stream associated with this session
    }

    const clientIds = this.streamSubscriptions.get(streamId) || new Set();
    
    for (const clientId of clientIds) {
      const client = this.activeClients.get(clientId);
      if (client && client.isActive) {
        if (this.shouldSendEventToClient(event, client)) {
          await this.sendEventToClient(client, event);
        }
      }
    }
  }

  /**
   * Gets all connected clients, optionally filtered by stream
   */
  getConnectedClients(streamId?: string): ClientConnection[] {
    const clients: ClientConnection[] = [];
    
    if (streamId) {
      const clientIds = this.streamSubscriptions.get(streamId) || new Set();
      for (const clientId of clientIds) {
        const client = this.activeClients.get(clientId);
        if (client && client.isActive) {
          clients.push(this.mapStreamClientToClientConnection(client));
        }
      }
    } else {
      for (const client of this.activeClients.values()) {
        if (client.isActive) {
          clients.push(this.mapStreamClientToClientConnection(client));
        }
      }
    }

    return clients;
  }

  // ============================================================================
  // PRIVATE MESSAGE HANDLING METHODS
  // ============================================================================

  private async handleClientMessage(client: StreamClient, data: Buffer | string): Promise<void> {
    try {
      const messageStr = typeof data === 'string' ? data : data.toString();
      const message: WSClientMessage = JSON.parse(messageStr);
      
      switch (message.type) {
        case 'ping':
          client.lastPing = new Date();
          if (client.type === ClientType.WEBSOCKET) {
            this.sendWebSocketMessage(client.connection, { type: 'pong' });
          }
          break;
          
        case 'filter_update':
          client.filters = message.payload?.filters || [];
          break;
          
        case 'replay':
          await this.handleReplayRequest(client, message.payload?.replayOptions);
          break;

        case 'subscribe':
          // Handle additional stream subscriptions
          break;

        case 'unsubscribe':
          // Handle stream unsubscriptions
          break;
      }
    } catch (error) {
      this.sendErrorToClient(client, 'INVALID_MESSAGE', 'Failed to parse message');
    }
  }

  private async handleClientDisconnect(streamId: string, clientId: string): Promise<void> {
    const client = this.activeClients.get(clientId);
    if (client) {
      client.isActive = false;
    }

    // Remove from stream subscriptions
    this.removeClientFromStream(streamId, clientId);

    // Remove from session manager
    const workflowSessionId = await this.findWorkflowSessionForStream(streamId);
    if (workflowSessionId) {
      await this.sessionManager.removeClientConnection(workflowSessionId, clientId);
    }

    // Clean up client
    this.activeClients.delete(clientId);
  }

  private handleClientError(client: StreamClient, error: any): void {
    this.sendErrorToClient(client, 'CONNECTION_ERROR', error.message || 'Unknown connection error');
    
    // Mark client as inactive
    client.isActive = false;
  }

  private async handleStreamEvent(event: StreamEvent): Promise<void> {
    // This is called when the stream manager publishes an event
    await this.broadcastEvent(event);
  }

  // ============================================================================
  // PRIVATE UTILITY METHODS
  // ============================================================================

  private generateClientId(): string {
    return `client_${uuidv4()}`;
  }

  private parseFilters(filtersParam?: string): StreamFilter[] {
    if (!filtersParam) {
      return [];
    }

    try {
      if (typeof filtersParam === 'string') {
        return JSON.parse(filtersParam);
      }
      return filtersParam;
    } catch {
      return [];
    }
  }

  private addClientToStream(streamId: string, clientId: string): void {
    if (!this.streamSubscriptions.has(streamId)) {
      this.streamSubscriptions.set(streamId, new Set());
    }
    this.streamSubscriptions.get(streamId)!.add(clientId);
  }

  private removeClientFromStream(streamId: string, clientId: string): void {
    const clients = this.streamSubscriptions.get(streamId);
    if (clients) {
      clients.delete(clientId);
      if (clients.size === 0) {
        this.streamSubscriptions.delete(streamId);
      }
    }
  }

  private async validateStream(streamId: string): Promise<boolean> {
    if (!this.streamManager) {
      return false;
    }

    try {
      const stream = await this.streamManager.getStream?.(streamId);
      return !!stream;
    } catch {
      return false;
    }
  }

  private async findWorkflowSessionForStream(streamId: string): Promise<string | null> {
    if (!this.streamManager) {
      return null;
    }

    try {
      const stream = await this.streamManager.getStream?.(streamId);
      return stream?.sessionId || null;
    } catch {
      return null;
    }
  }

  private async findStreamForSession(sessionId: string): Promise<string | null> {
    // This would need to be implemented based on how sessions and streams are linked
    // For now, assuming the session coordinator or stream manager provides this mapping
    if (this.streamManager?.getStreamForSession) {
      try {
        return await this.streamManager.getStreamForSession(sessionId);
      } catch {
        return null;
      }
    }
    return null;
  }

  private shouldSendEventToClient(event: StreamEvent, client: StreamClient): boolean {
    // Check filters
    for (const filter of client.filters) {
      if (filter.eventTypes && filter.eventTypes.length > 0) {
        if (!filter.eventTypes.includes(event.type)) {
          return false;
        }
      }
    }
    return true;
  }

  private async sendEventToClient(client: StreamClient, event: StreamEvent): Promise<void> {
    const message: WSServerMessage = {
      type: 'event',
      payload: { event }
    };

    if (client.type === ClientType.WEBSOCKET) {
      this.sendWebSocketMessage(client.connection, message);
    } else if (client.type === ClientType.SERVER_SENT_EVENTS) {
      this.sendSSEEvent(client.connection, 'stream_event', event);
    }
  }

  private sendWebSocketMessage(socket: any, message: WSServerMessage): void {
    if (socket.readyState === 1) { // WebSocket.OPEN
      socket.send(JSON.stringify(message));
    }
  }

  private sendSSEEvent(response: any, eventType: string, data: any): void {
    if (response.writableEnded) return;
    
    response.write(`event: ${eventType}\n`);
    response.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  private sendErrorToClient(client: StreamClient, code: string, message: string): void {
    const errorMessage: WSServerMessage = {
      type: 'error',
      payload: {
        error: {
          code,
          message,
          details: {},
          retryable: false,
          timestamp: new Date().toISOString()
        }
      }
    };

    if (client.type === ClientType.WEBSOCKET) {
      this.sendWebSocketMessage(client.connection, errorMessage);
    } else if (client.type === ClientType.SERVER_SENT_EVENTS) {
      this.sendSSEEvent(client.connection, 'error', errorMessage.payload?.error);
    }
  }

  private async sendHistoryToClient(client: StreamClient, streamId: string, limit: number): Promise<void> {
    if (!this.streamManager) {
      return;
    }

    try {
      const events = await this.streamManager.getEventHistory?.(streamId, { limit });
      if (events && events.length > 0) {
        for (const event of events) {
          if (this.shouldSendEventToClient(event, client)) {
            await this.sendEventToClient(client, event);
          }
        }
      }

      // Send replay complete message
      const completeMessage: WSServerMessage = {
        type: 'replay_complete',
        payload: {
          metadata: {
            eventsReplayed: events?.length || 0,
            streamId
          }
        }
      };

      if (client.type === ClientType.WEBSOCKET) {
        this.sendWebSocketMessage(client.connection, completeMessage);
      } else if (client.type === ClientType.SERVER_SENT_EVENTS) {
        this.sendSSEEvent(client.connection, 'replay_complete', completeMessage.payload?.metadata);
      }
    } catch (error) {
      this.sendErrorToClient(client, 'HISTORY_REPLAY_FAILED', 'Failed to replay event history');
    }
  }

  private async handleReplayRequest(client: StreamClient, replayOptions: any): Promise<void> {
    // Implementation would depend on the specific replay requirements
    // For now, just send recent events
    const limit = replayOptions?.eventCount || 50;
    
    // Find the stream this client is connected to
    for (const [streamId, clientIds] of this.streamSubscriptions.entries()) {
      if (clientIds.has(client.id)) {
        await this.sendHistoryToClient(client, streamId, limit);
        break;
      }
    }
  }

  private setupHeartbeat(client: StreamClient): void {
    if (client.type === ClientType.WEBSOCKET) {
      const heartbeat = setInterval(() => {
        if (!client.isActive) {
          clearInterval(heartbeat);
          return;
        }

        // Check if client is still responsive
        const timeSinceLastPing = Date.now() - client.lastPing.getTime();
        if (timeSinceLastPing > this.config.executorStreamer.heartbeatInterval * 2) {
          // Client is unresponsive
          client.isActive = false;
          clearInterval(heartbeat);
          return;
        }

        // Send ping
        this.sendWebSocketMessage(client.connection, { type: 'ping' });
      }, this.config.executorStreamer.heartbeatInterval);
    }
  }

  private mapStreamClientToClientConnection(client: StreamClient): ClientConnection {
    return {
      clientId: client.id,
      type: client.type === ClientType.WEBSOCKET ? 'websocket' : 'sse',
      connectedAt: client.connectedAt,
      lastActivity: client.lastPing,
      isActive: client.isActive
    };
  }
}
