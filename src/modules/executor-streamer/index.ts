/**
 * Executor Streamer Module - Main Interface
 * Provides real-time streaming capabilities for AI reasoning processes, 
 * executor command execution, status updates, and screenshots
 */

import {
  ISessionManager,
  ModuleSessionInfo,
  SessionStatus,
  SessionLifecycleCallbacks,
  ModuleSessionConfig,
  SessionManagerHealth,
  StreamEvent,
  CommandAction
} from '../../../types/shared-types';

import {
  IExecutorStreamerManager,
  IStreamPublisher,
  StreamSession,
  StreamConfig,
  StreamClient,
  ClientType,
  StreamFilter,
  ExecutorStreamerConfig,
  DEFAULT_EXECUTOR_STREAMER_CONFIG,
  ErrorContext,
  ScreenshotInfo
} from './types';

import { StreamManager } from './stream-manager';
import { EventPublisher } from './event-publisher';
import { ClientManager } from './client-manager';
import { WebSocketHandler } from './websocket-handler';
import { SSEHandler } from './sse-handler';
import { HistoryManager } from './history-manager';
import { AnalyticsManager } from './analytics';

export interface IExecutorStreamer extends ISessionManager, IStreamPublisher {
  readonly moduleId: 'executor-streamer';
  
  // Stream Management (from IExecutorStreamerManager)
  createStream(workflowSessionId: string, config?: StreamConfig): Promise<string>;
  getStream(workflowSessionId: string): StreamSession | null;
  destroyStream(workflowSessionId: string): Promise<void>;
  listActiveStreams(): string[];
  attachClient(workflowSessionId: string, client: StreamClient): Promise<void>;
  detachClient(workflowSessionId: string, clientId: string): Promise<void>;
  
  // Client Connection Management
  handleWebSocketConnection(ws: WebSocket, workflowSessionId: string, filters?: StreamFilter[]): Promise<string>;
  handleSSEConnection(response: Response, workflowSessionId: string, filters?: StreamFilter[]): Promise<string>;
  disconnectClient(clientId: string, reason?: string): Promise<void>;
  
  // Event Broadcasting
  broadcastEvent(workflowSessionId: string, event: StreamEvent, excludeClient?: string): Promise<void>;
  broadcastToAllStreams(event: StreamEvent, excludeClient?: string): Promise<void>;
  
  // History and Replay
  getEventHistory(workflowSessionId: string, filters?: any): Promise<StreamEvent[]>;
  replayEventsToClient(clientId: string, filters?: any): Promise<void>;
  
  // Analytics and Monitoring
  getStreamAnalytics(): any;
  getHealthStatus(): Promise<any>;
  
  // Configuration
  updateConfiguration(config: Partial<ExecutorStreamerConfig>): void;
  getConfiguration(): ExecutorStreamerConfig;
}

export class ExecutorStreamer implements IExecutorStreamer {
  readonly moduleId = 'executor-streamer' as const;
  
  private config: ExecutorStreamerConfig;
  
  // Component managers
  private streamManager: StreamManager;
  private eventPublisher: EventPublisher;
  private clientManager: ClientManager;
  private webSocketHandler: WebSocketHandler;
  private sseHandler: SSEHandler;
  private historyManager: HistoryManager;
  private analyticsManager: AnalyticsManager;
  
  constructor(config: ExecutorStreamerConfig = DEFAULT_EXECUTOR_STREAMER_CONFIG) {
    this.config = { ...DEFAULT_EXECUTOR_STREAMER_CONFIG, ...config };
    
    // Initialize components
    this.streamManager = new StreamManager(this.config);
    this.eventPublisher = new EventPublisher();
    this.clientManager = new ClientManager(this.config);
    this.webSocketHandler = new WebSocketHandler(this.clientManager, this.eventPublisher, this.config);
    this.sseHandler = new SSEHandler(this.clientManager, this.eventPublisher, this.config);
    this.historyManager = new HistoryManager(this.eventPublisher, this.config);
    this.analyticsManager = new AnalyticsManager(
      this.streamManager,
      this.clientManager,
      this.historyManager,
      this.config
    );
    
    console.log('ExecutorStreamer initialized');
  }

  // ISessionManager Implementation

  async createSession(workflowSessionId: string, config?: ModuleSessionConfig): Promise<string> {
    return await this.streamManager.createSession(workflowSessionId, config);
  }

  async destroySession(workflowSessionId: string): Promise<void> {
    // Get the stream before destroying
    const stream = this.streamManager.getStream(workflowSessionId);
    
    if (stream) {
      // Disconnect all clients first
      for (const client of stream.clients) {
        await this.disconnectClient(client.id, 'Stream session destroyed');
      }
      
      // Clear history
      await this.historyManager.clearHistory(stream.streamId);
    }
    
    await this.streamManager.destroySession(workflowSessionId);
  }

  getSession(workflowSessionId: string): ModuleSessionInfo | null {
    return this.streamManager.getSession(workflowSessionId);
  }

  sessionExists(workflowSessionId: string): boolean {
    return this.streamManager.sessionExists(workflowSessionId);
  }

  async updateSessionStatus(workflowSessionId: string, status: SessionStatus): Promise<void> {
    await this.streamManager.updateSessionStatus(workflowSessionId, status);
  }

  getSessionStatus(workflowSessionId: string): SessionStatus | null {
    return this.streamManager.getSessionStatus(workflowSessionId);
  }

  async recordActivity(workflowSessionId: string): Promise<void> {
    await this.streamManager.recordActivity(workflowSessionId);
  }

  getLastActivity(workflowSessionId: string): Date | null {
    return this.streamManager.getLastActivity(workflowSessionId);
  }

  setLifecycleCallbacks(callbacks: SessionLifecycleCallbacks): void {
    this.streamManager.setLifecycleCallbacks(callbacks);
  }

  async healthCheck(): Promise<SessionManagerHealth> {
    return await this.streamManager.healthCheck();
  }

  // Stream Management

  async createStream(workflowSessionId: string, config?: StreamConfig): Promise<string> {
    return await this.streamManager.createStream(workflowSessionId, config);
  }

  getStream(workflowSessionId: string): StreamSession | null {
    return this.streamManager.getStream(workflowSessionId);
  }

  async destroyStream(workflowSessionId: string): Promise<void> {
    await this.streamManager.destroyStream(workflowSessionId);
  }

  listActiveStreams(): string[] {
    return this.streamManager.listActiveStreams();
  }

  async attachClient(workflowSessionId: string, client: StreamClient): Promise<void> {
    await this.streamManager.attachClient(workflowSessionId, client);
  }

  async detachClient(workflowSessionId: string, clientId: string): Promise<void> {
    await this.streamManager.detachClient(workflowSessionId, clientId);
  }

  // Client Connection Management

  async handleWebSocketConnection(
    ws: WebSocket, 
    workflowSessionId: string, 
    filters?: StreamFilter[]
  ): Promise<string> {
    // Get or create stream for the workflow session
    let stream = this.streamManager.getStream(workflowSessionId);
    if (!stream) {
      await this.createStream(workflowSessionId);
      stream = this.streamManager.getStream(workflowSessionId);
      if (!stream) {
        throw new Error(`Failed to create stream for session: ${workflowSessionId}`);
      }
    }

    // Handle WebSocket connection
    await this.webSocketHandler.handleConnection(ws, stream.streamId, filters);
    
    // Register client with stream
    const client = this.clientManager.registerClient(
      stream.streamId,
      ws,
      ClientType.WEBSOCKET,
      filters
    );
    
    await this.attachClient(workflowSessionId, client);
    
    return client.id;
  }

  async handleSSEConnection(
    response: Response, 
    workflowSessionId: string, 
    filters?: StreamFilter[]
  ): Promise<string> {
    // Get or create stream for the workflow session
    let stream = this.streamManager.getStream(workflowSessionId);
    if (!stream) {
      await this.createStream(workflowSessionId);
      stream = this.streamManager.getStream(workflowSessionId);
      if (!stream) {
        throw new Error(`Failed to create stream for session: ${workflowSessionId}`);
      }
    }

    // Create SSE connection
    const clientId = await this.sseHandler.createConnection(stream.streamId, response, filters);
    
    // Get the registered client and attach to stream
    const client = this.clientManager.getClient(clientId);
    if (client) {
      await this.attachClient(workflowSessionId, client);
    }
    
    return clientId;
  }

  async disconnectClient(clientId: string, reason?: string): Promise<void> {
    const client = this.clientManager.getClient(clientId);
    if (!client) {
      return;
    }

    // Handle disconnection based on client type
    switch (client.type) {
      case ClientType.WEBSOCKET:
        await this.webSocketHandler.handleDisconnection(clientId);
        break;
      case ClientType.SERVER_SENT_EVENTS:
        await this.sseHandler.closeConnection(clientId);
        break;
      default:
        await this.clientManager.disconnectClient(clientId, reason);
    }
  }

  // Event Broadcasting

  async broadcastEvent(
    workflowSessionId: string, 
    event: StreamEvent, 
    excludeClient?: string
  ): Promise<void> {
    const stream = this.streamManager.getStream(workflowSessionId);
    if (!stream) {
      return;
    }

    // Add event to history
    await this.historyManager.addEvent(stream.streamId, event);
    
    // Record analytics
    const eventSize = JSON.stringify(event).length;
    this.analyticsManager.recordEvent(event.type, eventSize);

    // Broadcast to WebSocket clients
    await this.webSocketHandler.broadcastToStream(stream.streamId, event, excludeClient);
    
    // Broadcast to SSE clients
    await this.sseHandler.broadcastToStream(stream.streamId, event, excludeClient);
    
    // Record activity
    await this.recordActivity(workflowSessionId);
  }

  async broadcastToAllStreams(event: StreamEvent, excludeClient?: string): Promise<void> {
    const activeStreams = this.listActiveStreams();
    
    const broadcastPromises = activeStreams.map(workflowSessionId =>
      this.broadcastEvent(workflowSessionId, event, excludeClient)
    );

    await Promise.allSettled(broadcastPromises);
  }

  // IStreamPublisher Implementation

  async publishReasoning(
    sessionId: string, 
    thought: string, 
    confidence: number, 
    type: string, 
    context?: Record<string, any>
  ): Promise<void> {
    await this.eventPublisher.publishReasoning(sessionId, thought, confidence, type, context);
    
    // Get the event and broadcast it
    const event: StreamEvent = {
      id: this.generateEventId(),
      type: 'AI_REASONING' as any,
      timestamp: new Date(),
      sessionId,
      data: {
        reasoning: {
          thought,
          confidence,
          reasoningType: type as any,
          context
        }
      }
    };
    
    await this.broadcastEvent(sessionId, event);
  }

  async publishCommandStarted(
    sessionId: string, 
    commandName: string, 
    action: CommandAction, 
    parameters: Record<string, any>
  ): Promise<void> {
    await this.eventPublisher.publishCommandStarted(sessionId, commandName, action, parameters);
    
    const event: StreamEvent = {
      id: this.generateEventId(),
      type: 'COMMAND_STARTED' as any,
      timestamp: new Date(),
      sessionId,
      data: {
        command: {
          commandId: commandName,
          action,
          parameters,
          status: 'EXECUTING' as any
        }
      }
    };
    
    await this.broadcastEvent(sessionId, event);
  }

  async publishCommandCompleted(
    sessionId: string, 
    commandName: string, 
    result: any, 
    duration: number
  ): Promise<void> {
    await this.eventPublisher.publishCommandCompleted(sessionId, commandName, result, duration);
    
    const event: StreamEvent = {
      id: this.generateEventId(),
      type: 'COMMAND_COMPLETED' as any,
      timestamp: new Date(),
      sessionId,
      data: {
        command: {
          commandId: commandName,
          action: result.action || 'UNKNOWN' as CommandAction,
          parameters: result.parameters || {},
          status: 'COMPLETED' as any,
          duration,
          result
        }
      }
    };
    
    await this.broadcastEvent(sessionId, event);
  }

  async publishCommandFailed(
    sessionId: string, 
    commandName: string, 
    error: ErrorContext, 
    duration: number
  ): Promise<void> {
    await this.eventPublisher.publishCommandFailed(sessionId, commandName, error, duration);
    this.analyticsManager.recordError('command_failed');
    
    const event: StreamEvent = {
      id: this.generateEventId(),
      type: 'COMMAND_FAILED' as any,
      timestamp: new Date(),
      sessionId,
      data: {
        command: {
          commandId: commandName,
          action: 'UNKNOWN' as CommandAction,
          parameters: {},
          status: 'FAILED' as any,
          duration
        },
        error
      }
    };
    
    await this.broadcastEvent(sessionId, event);
  }

  async publishScreenshot(sessionId: string, screenshotInfo: ScreenshotInfo): Promise<void> {
    await this.eventPublisher.publishScreenshot(sessionId, screenshotInfo);
    
    const event: StreamEvent = {
      id: this.generateEventId(),
      type: 'SCREENSHOT_CAPTURED' as any,
      timestamp: new Date(),
      sessionId,
      stepIndex: screenshotInfo.stepIndex,
      data: {
        screenshot: screenshotInfo
      }
    };
    
    await this.broadcastEvent(sessionId, event);
  }

  async publishVariableUpdate(
    sessionId: string, 
    name: string, 
    value: string, 
    previousValue?: string
  ): Promise<void> {
    await this.eventPublisher.publishVariableUpdate(sessionId, name, value, previousValue);
    
    const event: StreamEvent = {
      id: this.generateEventId(),
      type: 'VARIABLE_UPDATED' as any,
      timestamp: new Date(),
      sessionId,
      data: {
        variable: {
          name,
          value,
          previousValue,
          timestamp: new Date(),
          sessionId,
          source: 'extracted' as any
        }
      }
    };
    
    await this.broadcastEvent(sessionId, event);
  }

  async publishStatus(
    sessionId: string, 
    type: string, 
    status: string, 
    message?: string
  ): Promise<void> {
    await this.eventPublisher.publishStatus(sessionId, type, status, message);
    
    const event: StreamEvent = {
      id: this.generateEventId(),
      type: 'SESSION_STATUS' as any,
      timestamp: new Date(),
      sessionId,
      data: {
        message,
        details: {
          type,
          status
        }
      }
    };
    
    await this.broadcastEvent(sessionId, event);
  }

  async publishError(sessionId: string, error: ErrorContext): Promise<void> {
    await this.eventPublisher.publishError(sessionId, error);
    this.analyticsManager.recordError('publish_error');
    
    const event: StreamEvent = {
      id: this.generateEventId(),
      type: 'ERROR_OCCURRED' as any,
      timestamp: new Date(),
      sessionId,
      data: {
        error
      }
    };
    
    await this.broadcastEvent(sessionId, event);
  }

  async publishEvent(sessionId: string, event: StreamEvent): Promise<void> {
    await this.eventPublisher.publishEvent(sessionId, event);
    await this.broadcastEvent(sessionId, event);
  }

  // History and Replay

  async getEventHistory(workflowSessionId: string, filters?: any): Promise<StreamEvent[]> {
    const stream = this.streamManager.getStream(workflowSessionId);
    if (!stream) {
      return [];
    }
    
    return await this.historyManager.getEvents(stream.streamId, filters);
  }

  async replayEventsToClient(clientId: string, filters?: any): Promise<void> {
    await this.historyManager.replayToClient(clientId, filters);
  }

  // Analytics and Monitoring

  getStreamAnalytics() {
    return {
      metrics: this.analyticsManager.getMetrics(),
      performance: this.analyticsManager.getPerformanceMetrics(),
      resources: this.analyticsManager.getResourceUsage(),
      health: this.analyticsManager.getHealthMetrics()
    };
  }

  async getHealthStatus() {
    const streamManagerHealth = await this.streamManager.healthCheck();
    const analyticsHealth = this.analyticsManager.getHealthMetrics();
    
    return {
      overall: streamManagerHealth.isHealthy && analyticsHealth.overall === 'healthy' ? 'healthy' : 'unhealthy',
      components: {
        streamManager: streamManagerHealth,
        analytics: analyticsHealth
      },
      timestamp: new Date()
    };
  }

  // Configuration Management

  updateConfiguration(config: Partial<ExecutorStreamerConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Update component configurations
    this.streamManager.updateConfig(this.config);
    this.analyticsManager.updateConfig(this.config);
  }

  getConfiguration(): ExecutorStreamerConfig {
    return { ...this.config };
  }

  // Utility Methods

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getStatistics() {
    return {
      streams: this.streamManager.getStats(),
      clients: this.clientManager.getClientStats(),
      history: this.historyManager.getStorageStats(),
      analytics: this.analyticsManager.getMetrics()
    };
  }

  // Lifecycle Management

  async initialize(): Promise<void> {
    console.log('Initializing ExecutorStreamer...');
    
    // Perform health checks
    const health = await this.healthCheck();
    if (!health.isHealthy) {
      throw new Error(`ExecutorStreamer initialization failed: ${health.errors.map((e: any) => e.message || e).join(', ')}`);
    }
    
    console.log('ExecutorStreamer initialized successfully');
  }

  async shutdown(): Promise<void> {
    console.log('Shutting down ExecutorStreamer...');
    
    try {
      // Shutdown components in reverse order
      await this.analyticsManager.shutdown();
      await this.historyManager.shutdown();
      await this.sseHandler.shutdown();
      await this.webSocketHandler.shutdown();
      await this.clientManager.shutdown();
      await this.streamManager.shutdown();
      
      console.log('ExecutorStreamer shutdown complete');
    } catch (error) {
      console.error('Error during ExecutorStreamer shutdown:', error);
      throw error;
    }
  }
}

// Export main interface and implementation
export { ExecutorStreamer as default };

// Export all types and components for external use
export * from './types';
export {
  StreamManager,
  EventPublisher,
  ClientManager,
  WebSocketHandler,
  SSEHandler,
  HistoryManager,
  AnalyticsManager
};

// Export default configuration
export { DEFAULT_EXECUTOR_STREAMER_CONFIG };
