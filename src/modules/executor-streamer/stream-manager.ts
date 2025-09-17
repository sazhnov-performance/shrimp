/**
 * Stream Manager - Session Management for Executor Streamer
 * Implements standardized session management interface with stream-specific functionality
 */

import {
  ISessionManager,
  ModuleSessionInfo,
  SessionStatus,
  SessionLifecycleCallbacks,
  ModuleSessionConfig,
  SessionManagerHealth
} from '../../../types/shared-types';

import {
  IExecutorStreamerManager,
  StreamSession,
  StreamConfig,
  StreamClient,
  ExecutorStreamerConfig,
  DEFAULT_STREAM_CONFIG
} from './types';

export class StreamManager implements IExecutorStreamerManager {
  readonly moduleId = 'executor-streamer' as const;
  
  private sessions: Map<string, StreamSession> = new Map();
  private config: ExecutorStreamerConfig;
  private lifecycleCallbacks?: SessionLifecycleCallbacks;
  private startTime: Date = new Date();

  constructor(config: ExecutorStreamerConfig) {
    this.config = config;
  }

  // ISessionManager Implementation

  async createSession(workflowSessionId: string, config?: ModuleSessionConfig): Promise<string> {
    if (this.sessions.has(workflowSessionId)) {
      throw new Error(`Stream session already exists for workflow session: ${workflowSessionId}`);
    }

    // Generate unique stream ID
    const streamId = this.generateStreamId();
    
    // Create stream session
    const streamSession: StreamSession = {
      moduleId: 'executor-streamer',
      sessionId: streamId,
      linkedWorkflowSessionId: workflowSessionId,
      streamId: streamId,
      status: SessionStatus.INITIALIZING,
      createdAt: new Date(),
      lastActivity: new Date(),
      isActive: false,
      clients: [],
      history: [],
      config: { ...this.config.defaultStreamConfig },
      metadata: config?.metadata || {}
    };

    this.sessions.set(workflowSessionId, streamSession);

    try {
      // Initialize stream
      await this.initializeStream(streamSession);
      
      // Update status to active
      streamSession.status = SessionStatus.ACTIVE;
      streamSession.isActive = true;
      streamSession.lastActivity = new Date();

      // Fire lifecycle callback
      if (this.lifecycleCallbacks?.onSessionCreated) {
        await this.lifecycleCallbacks.onSessionCreated(
          this.moduleId,
          workflowSessionId,
          streamId
        );
      }

      return streamId;
    } catch (error) {
      // Cleanup on failure
      this.sessions.delete(workflowSessionId);
      throw new Error(`Failed to create stream session: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async destroySession(workflowSessionId: string): Promise<void> {
    const session = this.sessions.get(workflowSessionId);
    if (!session) {
      return; // Already destroyed or never existed
    }

    try {
      // Update status
      session.status = SessionStatus.CLEANUP;
      session.isActive = false;

      // Disconnect all clients
      await this.disconnectAllClients(session);

      // Clear history if configured
      if (session.config.persistence.enabled) {
        await this.persistSessionHistory(session);
      }
      session.history = [];

      // Fire lifecycle callback
      if (this.lifecycleCallbacks?.onSessionDestroyed) {
        await this.lifecycleCallbacks.onSessionDestroyed(this.moduleId, workflowSessionId);
      }

      // Remove from sessions map
      this.sessions.delete(workflowSessionId);
    } catch (error) {
      // Still remove the session even if cleanup fails
      this.sessions.delete(workflowSessionId);
      throw new Error(`Error during stream session cleanup: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  getSession(workflowSessionId: string): ModuleSessionInfo | null {
    const session = this.sessions.get(workflowSessionId);
    if (!session) {
      return null;
    }

    return {
      moduleId: session.moduleId,
      sessionId: session.sessionId,
      linkedWorkflowSessionId: session.linkedWorkflowSessionId,
      status: session.status,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      metadata: session.metadata
    };
  }

  sessionExists(workflowSessionId: string): boolean {
    return this.sessions.has(workflowSessionId);
  }

  async updateSessionStatus(workflowSessionId: string, status: SessionStatus): Promise<void> {
    const session = this.sessions.get(workflowSessionId);
    if (!session) {
      throw new Error(`Stream session not found: ${workflowSessionId}`);
    }

    const oldStatus = session.status;
    session.status = status;
    session.lastActivity = new Date();

    // Update active flag based on status
    session.isActive = status === SessionStatus.ACTIVE || status === SessionStatus.BUSY;

    // Fire lifecycle callback
    if (this.lifecycleCallbacks?.onSessionStatusChanged) {
      await this.lifecycleCallbacks.onSessionStatusChanged(
        this.moduleId,
        workflowSessionId,
        oldStatus,
        status
      );
    }
  }

  getSessionStatus(workflowSessionId: string): SessionStatus | null {
    const session = this.sessions.get(workflowSessionId);
    return session ? session.status : null;
  }

  async recordActivity(workflowSessionId: string): Promise<void> {
    const session = this.sessions.get(workflowSessionId);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  getLastActivity(workflowSessionId: string): Date | null {
    const session = this.sessions.get(workflowSessionId);
    return session ? session.lastActivity : null;
  }

  setLifecycleCallbacks(callbacks: SessionLifecycleCallbacks): void {
    this.lifecycleCallbacks = callbacks;
  }

  async healthCheck(): Promise<SessionManagerHealth> {
    const activeSessions = Array.from(this.sessions.values()).filter(s => s.isActive).length;
    const totalSessions = this.sessions.size;
    const errors: any[] = [];

    // Check for unhealthy sessions
    for (const [workflowSessionId, session] of this.sessions) {
      try {
        // Check if session is stale (no activity for too long)
        const staleThreshold = this.config.timeouts.stepTimeoutMs * 2; // 2x step timeout
        const timeSinceActivity = Date.now() - session.lastActivity.getTime();
        
        if (session.isActive && timeSinceActivity > staleThreshold) {
          errors.push({
            sessionId: workflowSessionId,
            error: 'Session appears stale',
            timeSinceActivity,
            threshold: staleThreshold
          });
        }

        // Check for clients that haven't sent heartbeats
        const staleClients = session.clients.filter(client => {
          const timeSinceLastPing = Date.now() - client.lastPing.getTime();
          return timeSinceLastPing > session.config.heartbeatInterval * 2;
        });

        if (staleClients.length > 0) {
          errors.push({
            sessionId: workflowSessionId,
            error: 'Stale clients detected',
            staleClientsCount: staleClients.length
          });
        }
      } catch (error) {
        errors.push({
          sessionId: workflowSessionId,
          error: 'Health check failed',
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return {
      moduleId: this.moduleId,
      isHealthy: errors.length === 0,
      activeSessions,
      totalSessions,
      errors,
      lastHealthCheck: new Date()
    };
  }

  // Stream-specific Methods

  async createStream(workflowSessionId: string, config?: StreamConfig): Promise<string> {
    return await this.createSession(workflowSessionId, { metadata: { streamConfig: config } });
  }

  getStream(workflowSessionId: string): StreamSession | null {
    return this.sessions.get(workflowSessionId) || null;
  }

  async destroyStream(workflowSessionId: string): Promise<void> {
    await this.destroySession(workflowSessionId);
  }

  listActiveStreams(): string[] {
    return Array.from(this.sessions.values())
      .filter(session => session.isActive)
      .map(session => session.linkedWorkflowSessionId);
  }

  async attachClient(workflowSessionId: string, client: StreamClient): Promise<void> {
    const session = this.sessions.get(workflowSessionId);
    if (!session) {
      throw new Error(`Stream session not found: ${workflowSessionId}`);
    }

    // Check client limits
    if (session.clients.length >= session.config.maxClients) {
      throw new Error(`Maximum clients limit reached for stream: ${workflowSessionId}`);
    }

    // Check global connection limit
    const totalConnections = this.getTotalClientCount();
    if (totalConnections >= this.config.server.maxConnections) {
      throw new Error(`Global connection limit reached: ${this.config.server.maxConnections}`);
    }

    // Add client to session
    session.clients.push(client);
    session.lastActivity = new Date();

    // Send connection acknowledgment
    await this.sendConnectionAck(client);
  }

  async detachClient(workflowSessionId: string, clientId: string): Promise<void> {
    const session = this.sessions.get(workflowSessionId);
    if (!session) {
      return; // Session might have been destroyed
    }

    const clientIndex = session.clients.findIndex(c => c.id === clientId);
    if (clientIndex >= 0) {
      const client = session.clients[clientIndex];
      
      // Close connection gracefully
      try {
        await this.closeClientConnection(client);
      } catch (error) {
        // Log error but continue cleanup
        console.warn(`Error closing client connection ${clientId}:`, error);
      }

      // Remove client from session
      session.clients.splice(clientIndex, 1);
      session.lastActivity = new Date();
    }
  }

  // Utility Methods

  private generateStreamId(): string {
    return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async initializeStream(session: StreamSession): Promise<void> {
    // Apply any custom stream configuration
    if (session.metadata?.streamConfig) {
      session.config = { ...session.config, ...session.metadata.streamConfig };
    }

    // Initialize history buffer
    session.history = [];

    // Set up any persistence if enabled
    if (session.config.persistence.enabled) {
      await this.initializePersistence(session);
    }
  }

  private async initializePersistence(session: StreamSession): Promise<void> {
    // Initialize persistence based on storage type
    switch (session.config.persistence.storageType) {
      case 'memory':
        // Already using in-memory storage
        break;
      case 'file':
        // TODO: Initialize file-based persistence
        break;
      case 'database':
        // TODO: Initialize database persistence
        break;
    }
  }

  private async disconnectAllClients(session: StreamSession): Promise<void> {
    const disconnectPromises = session.clients.map(async (client) => {
      try {
        await this.closeClientConnection(client);
      } catch (error) {
        console.warn(`Error disconnecting client ${client.id}:`, error);
      }
    });

    await Promise.allSettled(disconnectPromises);
    session.clients = [];
  }

  private async persistSessionHistory(session: StreamSession): Promise<void> {
    if (!session.config.persistence.enabled) {
      return;
    }

    // TODO: Implement actual persistence based on storage type
    // For now, just clear the history as it's already in memory
  }

  private async sendConnectionAck(client: StreamClient): Promise<void> {
    const ackMessage = {
      type: 'connection_ack' as const,
      metadata: {
        clientId: client.id,
        timestamp: new Date().toISOString(),
        filters: client.filters
      }
    };

    // TODO: Send message based on client type
    // This will be implemented in the specific handlers
  }

  private async closeClientConnection(client: StreamClient): Promise<void> {
    client.isActive = false;

    // TODO: Close connection based on client type
    // This will be implemented in the specific handlers
  }

  private getTotalClientCount(): number {
    return Array.from(this.sessions.values())
      .reduce((total, session) => total + session.clients.length, 0);
  }

  // Configuration and Monitoring

  updateConfig(config: ExecutorStreamerConfig): void {
    this.config = config;
  }

  getConfig(): ExecutorStreamerConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  getStats() {
    const totalSessions = this.sessions.size;
    const activeSessions = Array.from(this.sessions.values()).filter(s => s.isActive).length;
    const totalClients = this.getTotalClientCount();
    const uptime = Date.now() - this.startTime.getTime();

    return {
      totalSessions,
      activeSessions,
      totalClients,
      uptime,
      averageClientsPerStream: totalSessions > 0 ? totalClients / totalSessions : 0
    };
  }

  // Cleanup
  async shutdown(): Promise<void> {
    const sessionIds = Array.from(this.sessions.keys());
    
    for (const workflowSessionId of sessionIds) {
      try {
        await this.destroySession(workflowSessionId);
      } catch (error) {
        console.error(`Error destroying session ${workflowSessionId} during shutdown:`, error);
      }
    }
  }
}
