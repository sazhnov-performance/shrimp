/**
 * Executor Streamer Module
 * Main implementation and exports
 */

import { v4 as uuidv4 } from 'uuid';
import { Response as HttpResponse } from 'express';
import { WebSocket } from 'ws';
import {
  SessionStatus,
  SessionLifecycleCallbacks,
  SessionManagerHealth,
  ModuleSessionInfo,
  ModuleSessionConfig,
  StreamEvent,
  StreamEventType,
  CommandAction,
  ScreenshotInfo
} from '../../../types/shared-types';
import {
  IExecutorStreamer,
  ExecutorStreamerConfig,
  StreamConfig,
  StreamInfo,
  StreamClient,
  ClientType,
  StreamFilter,
  ErrorContext,
  StreamAnalytics,
  HealthStatus,
  StreamStatistics
} from './types';
import { StreamManager } from './stream-manager';
import { EventPublisher } from './event-publisher';

// Default configuration
export const DEFAULT_EXECUTOR_STREAMER_CONFIG: ExecutorStreamerConfig = {
  moduleId: 'executor-streamer',
  server: {
    port: 3001,
    host: 'localhost',
    maxConnections: 1000
  },
  security: {
    corsOrigins: ['*'],
    authenticationRequired: false,
    rateLimiting: {
      enabled: true,
      maxRequestsPerMinute: 1000,
      maxEventsPerSecond: 100
    }
  },
  compression: {
    enabled: true,
    algorithm: 'gzip',
    threshold: 1024
  },
  defaultStreamConfig: {
    maxHistorySize: 10000,
    bufferSize: 1000,
    enableReplay: true,
    compressionEnabled: true,
    heartbeatInterval: 30000,
    maxClients: 100,
    eventFilters: [],
    persistence: {
      enabled: false,
      storageType: 'memory',
      retentionPeriod: 3600000 // 1 hour
    }
  }
};

export class ExecutorStreamer implements IExecutorStreamer {
  public readonly moduleId = 'executor-streamer';
  
  private config: ExecutorStreamerConfig;
  private streamManager: StreamManager;
  private eventPublisher: EventPublisher;
  private clientConnections = new Map<string, { sessionId: string; client: StreamClient }>();
  private startTime = new Date();

  constructor(config?: Partial<ExecutorStreamerConfig>) {
    this.config = this.mergeConfig(DEFAULT_EXECUTOR_STREAMER_CONFIG, config);
    this.streamManager = new StreamManager(this.config);
    this.eventPublisher = new EventPublisher();
    
    // Set up event callback to handle storage and broadcasting
    this.eventPublisher.setEventCallback(async (event: StreamEvent) => {
      await this.handleEventPublished(event);
    });
  }

  private mergeConfig(defaultConfig: ExecutorStreamerConfig, userConfig?: Partial<ExecutorStreamerConfig>): ExecutorStreamerConfig {
    if (!userConfig) return { ...defaultConfig };
    
    return {
      ...defaultConfig,
      ...userConfig,
      server: { ...defaultConfig.server, ...userConfig.server },
      security: { 
        ...defaultConfig.security, 
        ...userConfig.security,
        rateLimiting: { ...defaultConfig.security.rateLimiting, ...userConfig.security?.rateLimiting }
      },
      compression: { ...defaultConfig.compression, ...userConfig.compression },
      defaultStreamConfig: { 
        ...defaultConfig.defaultStreamConfig, 
        ...userConfig.defaultStreamConfig,
        persistence: { 
          ...defaultConfig.defaultStreamConfig.persistence, 
          ...userConfig.defaultStreamConfig?.persistence 
        }
      }
    };
  }

  // Configuration
  getConfiguration(): ExecutorStreamerConfig {
    return { ...this.config };
  }

  updateConfiguration(config: Partial<ExecutorStreamerConfig>): void {
    this.config = this.mergeConfig(this.config, config);
    this.streamManager.updateConfig(this.config);
  }

  // Session Management (delegated to StreamManager)
  async createSession(workflowSessionId: string, config?: ModuleSessionConfig): Promise<string> {
    return this.streamManager.createSession(workflowSessionId, config);
  }

  async destroySession(workflowSessionId: string): Promise<void> {
    // Disconnect all clients for this session
    const clientIds = Array.from(this.clientConnections.entries())
      .filter(([_, { sessionId }]) => sessionId === workflowSessionId)
      .map(([clientId, _]) => clientId);
    
    for (const clientId of clientIds) {
      await this.disconnectClient(clientId);
    }

    return this.streamManager.destroySession(workflowSessionId);
  }

  getSession(workflowSessionId: string): ModuleSessionInfo | null {
    return this.streamManager.getSession(workflowSessionId);
  }

  sessionExists(workflowSessionId: string): boolean {
    return this.streamManager.sessionExists(workflowSessionId);
  }

  async updateSessionStatus(workflowSessionId: string, status: SessionStatus): Promise<void> {
    return this.streamManager.updateSessionStatus(workflowSessionId, status);
  }

  getSessionStatus(workflowSessionId: string): SessionStatus | null {
    return this.streamManager.getSessionStatus(workflowSessionId);
  }

  async recordActivity(workflowSessionId: string): Promise<void> {
    return this.streamManager.recordActivity(workflowSessionId);
  }

  getLastActivity(workflowSessionId: string): Date | null {
    return this.streamManager.getLastActivity(workflowSessionId);
  }

  setLifecycleCallbacks(callbacks: SessionLifecycleCallbacks): void {
    this.streamManager.setLifecycleCallbacks(callbacks);
  }

  async healthCheck(): Promise<SessionManagerHealth> {
    return this.streamManager.healthCheck();
  }

  // Stream management (delegated to StreamManager)
  async createStream(workflowSessionId: string, config?: StreamConfig): Promise<string> {
    return this.streamManager.createStream(workflowSessionId, config);
  }

  async destroyStream(workflowSessionId: string): Promise<void> {
    return this.streamManager.destroyStream(workflowSessionId);
  }

  getStream(workflowSessionId: string): StreamInfo | null {
    return this.streamManager.getStream(workflowSessionId);
  }

  listActiveStreams(): string[] {
    return this.streamManager.listActiveStreams();
  }

  // Client connection management
  async handleWebSocketConnection(ws: WebSocket, workflowSessionId: string, filters?: StreamFilter[]): Promise<string> {
    // Auto-create stream if it doesn't exist
    if (!this.streamManager.getStream(workflowSessionId)) {
      await this.createStream(workflowSessionId);
    }

    const clientId = uuidv4();
    const client: StreamClient = {
      id: clientId,
      type: ClientType.WEBSOCKET,
      connection: ws,
      connectedAt: new Date(),
      lastPing: new Date(),
      isActive: true,
      filters
    };

    await this.streamManager.attachClient(workflowSessionId, client);
    this.clientConnections.set(clientId, { sessionId: workflowSessionId, client });

    // Set up WebSocket event handlers
    ws.on('ping', () => {
      client.lastPing = new Date();
      ws.pong();
    });

    ws.on('close', async () => {
      await this.disconnectClient(clientId);
    });

    ws.on('error', async (error) => {
      console.error('WebSocket error:', error);
      await this.disconnectClient(clientId);
    });

    return clientId;
  }

  async handleSSEConnection(res: HttpResponse, workflowSessionId: string, filters?: StreamFilter[]): Promise<string> {
    // Auto-create stream if it doesn't exist
    if (!this.streamManager.getStream(workflowSessionId)) {
      await this.createStream(workflowSessionId);
    }

    const clientId = uuidv4();
    
    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    const client: StreamClient = {
      id: clientId,
      type: ClientType.SERVER_SENT_EVENTS,
      connection: res,
      connectedAt: new Date(),
      lastPing: new Date(),
      isActive: true,
      filters
    };

    await this.streamManager.attachClient(workflowSessionId, client);
    this.clientConnections.set(clientId, { sessionId: workflowSessionId, client });

    // Handle client disconnect
    res.on('close', async () => {
      await this.disconnectClient(clientId);
    });

    res.on('error', async (error) => {
      console.error('SSE error:', error);
      await this.disconnectClient(clientId);
    });

    return clientId;
  }

  async disconnectClient(clientId: string): Promise<void> {
    const connection = this.clientConnections.get(clientId);
    if (!connection) {
      return;
    }

    const { sessionId, client } = connection;

    try {
      // Close the connection
      if (client.type === ClientType.WEBSOCKET && 'close' in client.connection) {
        client.connection.close();
      } else if (client.type === ClientType.SERVER_SENT_EVENTS && 'end' in client.connection) {
        client.connection.end();
      }
    } catch (error) {
      console.warn('Error closing client connection:', error);
    }

    // Remove from stream manager and local tracking
    await this.streamManager.detachClient(sessionId, clientId);
    this.clientConnections.delete(clientId);
  }

  // Event publishing (delegated to EventPublisher)
  async publishReasoning(sessionId: string, thought: string, confidence: number, reasoningType: string, context?: Record<string, any>): Promise<void> {
    await this.eventPublisher.publishReasoning(sessionId, thought, confidence, reasoningType, context);
  }

  async publishCommandStarted(sessionId: string, commandName: string, action: CommandAction, parameters: Record<string, any>): Promise<void> {
    await this.eventPublisher.publishCommandStarted(sessionId, commandName, action, parameters);
  }

  async publishCommandCompleted(sessionId: string, commandName: string, result: Record<string, any>, duration: number): Promise<void> {
    await this.eventPublisher.publishCommandCompleted(sessionId, commandName, result, duration);
  }

  async publishCommandFailed(sessionId: string, commandName: string, error: ErrorContext, duration: number): Promise<void> {
    await this.eventPublisher.publishCommandFailed(sessionId, commandName, error, duration);
  }

  async publishScreenshot(sessionId: string, screenshotInfo: ScreenshotInfo): Promise<void> {
    await this.eventPublisher.publishScreenshot(sessionId, screenshotInfo);
  }

  async publishVariableUpdate(sessionId: string, name: string, value: string, previousValue?: string): Promise<void> {
    await this.eventPublisher.publishVariableUpdate(sessionId, name, value, previousValue);
  }

  async publishStatus(sessionId: string, type: string, status: string, message: string): Promise<void> {
    await this.eventPublisher.publishStatus(sessionId, type, status, message);
  }

  async publishError(sessionId: string, error: ErrorContext): Promise<void> {
    await this.eventPublisher.publishError(sessionId, error);
  }

  // Event history and replay
  async getEventHistory(sessionId: string, filter?: { eventTypes?: StreamEventType[] }): Promise<StreamEvent[]> {
    const stream = this.streamManager.getStream(sessionId);
    if (!stream) {
      return [];
    }

    let history = stream.history;
    
    if (filter?.eventTypes) {
      history = history.filter(event => filter.eventTypes!.includes(event.type));
    }

    return history;
  }

  async replayEventsToClient(clientId: string): Promise<void> {
    const connection = this.clientConnections.get(clientId);
    if (!connection) {
      return;
    }

    const { sessionId, client } = connection;
    const history = await this.getEventHistory(sessionId);
    const filteredEvents = this.eventPublisher.filterEventsForClient(history, client);

    for (const event of filteredEvents) {
      await this.sendEventToClient(client, event);
    }
  }

  // Broadcasting
  async broadcastToAllStreams(event: StreamEvent): Promise<void> {
    for (const [clientId, { client }] of this.clientConnections) {
      const filteredEvents = this.eventPublisher.filterEventsForClient([event], client);
      if (filteredEvents.length > 0) {
        await this.sendEventToClient(client, event);
      }
    }
  }

  private async handleEventPublished(event: StreamEvent): Promise<void> {
    // Store event in stream history
    const stream = this.streamManager.getStream(event.sessionId);
    if (stream) {
      stream.history.push(event);
      
      // Maintain max history size
      if (stream.history.length > stream.config.maxHistorySize) {
        stream.history.shift();
      }
      
      stream.lastActivity = new Date();
    }
    
    // Broadcast to connected clients
    await this.broadcastEventToClients(event);
  }
  
  private async broadcastEventToClients(event: StreamEvent): Promise<void> {
    for (const [clientId, connection] of this.clientConnections) {
      if (connection.sessionId === event.sessionId) {
        const filteredEvents = this.eventPublisher.filterEventsForClient([event], connection.client);
        if (filteredEvents.length > 0) {
          await this.sendEventToClient(connection.client, event);
        }
      }
    }
  }

  private async sendEventToClient(client: StreamClient, event: StreamEvent): Promise<void> {
    try {
      const serialized = this.eventPublisher.serializeEvent(event);
      
      if (client.type === ClientType.WEBSOCKET && 'send' in client.connection) {
        client.connection.send(serialized);
      } else if (client.type === ClientType.SERVER_SENT_EVENTS && 'write' in client.connection) {
        client.connection.write(`data: ${serialized}\n\n`);
      }
    } catch (error) {
      console.error('Error sending event to client:', error);
    }
  }

  // Analytics and monitoring
  getStreamAnalytics(): StreamAnalytics {
    const stats = this.streamManager.getStats();
    
    return {
      metrics: {
        totalStreams: stats.totalSessions,
        activeStreams: stats.activeSessions,
        totalClients: stats.totalClients,
        totalEvents: 0, // Would be tracked in a real implementation
        eventsPerSecond: 0
      },
      performance: {
        averageEventProcessingTime: 0,
        averageClientResponseTime: 0,
        memoryUsage: process.memoryUsage().heapUsed,
        cpuUsage: 0
      },
      resources: {
        activeConnections: this.clientConnections.size,
        queuedEvents: 0,
        diskUsage: 0
      },
      health: {
        status: 'healthy',
        issues: [],
        lastCheck: new Date()
      }
    };
  }

  async getHealthStatus(): Promise<HealthStatus> {
    return {
      overall: 'healthy',
      components: {
        streamManager: 'healthy',
        analytics: 'healthy',
        networking: 'healthy'
      },
      timestamp: new Date()
    };
  }

  getStatistics(): StreamStatistics {
    const managerStats = this.streamManager.getStats();
    const wsClients = Array.from(this.clientConnections.values()).filter(c => c.client.type === ClientType.WEBSOCKET).length;
    const sseClients = Array.from(this.clientConnections.values()).filter(c => c.client.type === ClientType.SERVER_SENT_EVENTS).length;

    return {
      streams: {
        total: managerStats.totalSessions,
        active: managerStats.activeSessions,
        averageClients: managerStats.averageClientsPerStream
      },
      clients: {
        total: this.clientConnections.size,
        websocket: wsClients,
        sse: sseClients
      },
      history: {
        totalEvents: 0, // Would be tracked in a real implementation
        averageEventsPerStream: 0
      },
      analytics: {
        uptime: Date.now() - this.startTime.getTime(),
        lastReset: this.startTime
      }
    };
  }

  // Lifecycle
  async initialize(): Promise<void> {
    // Initialization logic if needed
    console.log('ExecutorStreamer initialized');
  }

  async shutdown(): Promise<void> {
    // Disconnect all clients
    const clientIds = Array.from(this.clientConnections.keys());
    for (const clientId of clientIds) {
      await this.disconnectClient(clientId);
    }

    // Shutdown stream manager
    await this.streamManager.shutdown();
  }
}

// Re-export types and implementations
export * from './types';
export { StreamManager } from './stream-manager';
export { EventPublisher } from './event-publisher';
