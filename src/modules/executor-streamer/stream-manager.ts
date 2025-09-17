/**
 * Stream Manager Implementation
 * Manages stream sessions and client connections
 */

import { v4 as uuidv4 } from 'uuid';
import {
  SessionStatus,
  SessionLifecycleCallbacks,
  SessionManagerHealth,
  ModuleSessionInfo,
  ModuleSessionConfig
} from '../../../types/shared-types';
import {
  IStreamManager,
  StreamInfo,
  StreamConfig,
  StreamClient,
  ExecutorStreamerConfig,
  StreamManagerStats
} from './types';

export class StreamManager implements IStreamManager {
  public readonly moduleId = 'executor-streamer';
  
  private sessions = new Map<string, ModuleSessionInfo>();
  private streams = new Map<string, StreamInfo>();
  private config: ExecutorStreamerConfig;
  private lifecycleCallbacks?: SessionLifecycleCallbacks;
  private startTime = new Date();

  constructor(config: ExecutorStreamerConfig) {
    this.config = { ...config };
  }

  // Session Management (ISessionManager implementation)
  async createSession(workflowSessionId: string, config?: ModuleSessionConfig): Promise<string> {
    if (this.sessions.has(workflowSessionId)) {
      throw new Error('Stream session already exists');
    }

    const moduleSessionId = uuidv4();
    const now = new Date();
    
    const sessionInfo: ModuleSessionInfo = {
      moduleId: this.moduleId,
      sessionId: moduleSessionId,
      linkedWorkflowSessionId: workflowSessionId,
      status: SessionStatus.ACTIVE,
      createdAt: now,
      lastActivity: now,
      metadata: config?.metadata
    };

    this.sessions.set(workflowSessionId, sessionInfo);

    // Call lifecycle callback
    if (this.lifecycleCallbacks?.onSessionCreated) {
      try {
        await this.lifecycleCallbacks.onSessionCreated(this.moduleId, workflowSessionId, moduleSessionId);
      } catch (error) {
        // Log but don't fail session creation
        console.error('Error in onSessionCreated callback:', error);
      }
    }

    return moduleSessionId;
  }

  async destroySession(workflowSessionId: string): Promise<void> {
    const session = this.sessions.get(workflowSessionId);
    if (!session) {
      return; // Gracefully handle non-existent sessions
    }

    // Destroy associated stream if exists
    const stream = this.streams.get(workflowSessionId);
    if (stream) {
      // Disconnect all clients
      for (const client of stream.clients) {
        try {
          if ('close' in client.connection) {
            client.connection.close();
          } else if ('end' in client.connection) {
            client.connection.end();
          }
        } catch (error) {
          // Ignore client disconnect errors during cleanup
          console.warn('Error disconnecting client during session destruction:', error);
        }
      }
      this.streams.delete(workflowSessionId);
    }

    this.sessions.delete(workflowSessionId);

    // Call lifecycle callback
    if (this.lifecycleCallbacks?.onSessionDestroyed) {
      try {
        await this.lifecycleCallbacks.onSessionDestroyed(this.moduleId, workflowSessionId);
      } catch (error) {
        console.error('Error in onSessionDestroyed callback:', error);
      }
    }
  }

  getSession(workflowSessionId: string): ModuleSessionInfo | null {
    return this.sessions.get(workflowSessionId) || null;
  }

  sessionExists(workflowSessionId: string): boolean {
    return this.sessions.has(workflowSessionId);
  }

  async updateSessionStatus(workflowSessionId: string, status: SessionStatus): Promise<void> {
    const session = this.sessions.get(workflowSessionId);
    if (!session) {
      throw new Error('Stream session not found');
    }

    const oldStatus = session.status;
    session.status = status;
    session.lastActivity = new Date();

    // Call lifecycle callback
    if (this.lifecycleCallbacks?.onSessionStatusChanged) {
      try {
        await this.lifecycleCallbacks.onSessionStatusChanged(this.moduleId, workflowSessionId, oldStatus, status);
      } catch (error) {
        console.error('Error in onSessionStatusChanged callback:', error);
      }
    }
  }

  getSessionStatus(workflowSessionId: string): SessionStatus | null {
    const session = this.sessions.get(workflowSessionId);
    return session?.status || null;
  }

  async recordActivity(workflowSessionId: string): Promise<void> {
    const session = this.sessions.get(workflowSessionId);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  getLastActivity(workflowSessionId: string): Date | null {
    const session = this.sessions.get(workflowSessionId);
    return session?.lastActivity || null;
  }

  setLifecycleCallbacks(callbacks: SessionLifecycleCallbacks): void {
    this.lifecycleCallbacks = callbacks;
  }

  async healthCheck(): Promise<SessionManagerHealth> {
    const now = new Date();
    const errors: any[] = [];
    
    // Check for stale sessions (no activity for 15 minutes)
    const staleThreshold = 15 * 60 * 1000;
    for (const [workflowSessionId, session] of this.sessions) {
      const timeSinceActivity = now.getTime() - session.lastActivity.getTime();
      if (timeSinceActivity > staleThreshold) {
        errors.push({
          sessionId: workflowSessionId,
          error: 'Session appears stale'
        });
      }
    }

    // Check for stale clients (no ping for 5 minutes) 
    const staleClientThreshold = 5 * 60 * 1000;
    for (const [workflowSessionId, stream] of this.streams) {
      const staleClients = stream.clients.filter(client => {
        const timeSinceLastPing = now.getTime() - client.lastPing.getTime();
        return timeSinceLastPing > staleClientThreshold;
      });
      
      if (staleClients.length > 0) {
        errors.push({
          sessionId: workflowSessionId,
          error: 'Stale clients detected',
          staleClientsCount: staleClients.length
        });
      }
    }

    return {
      moduleId: this.moduleId,
      isHealthy: errors.length === 0,
      activeSessions: Array.from(this.sessions.values()).filter(s => s.status === SessionStatus.ACTIVE).length,
      totalSessions: this.sessions.size,
      errors,
      lastHealthCheck: now
    };
  }

  // Stream-specific operations
  async createStream(workflowSessionId: string, config?: StreamConfig): Promise<string> {
    // Create session if it doesn't exist
    if (!this.sessions.has(workflowSessionId)) {
      await this.createSession(workflowSessionId);
    }

    // Don't throw error if stream already exists, just return existing stream ID
    const existingStream = this.streams.get(workflowSessionId);
    if (existingStream) {
      return existingStream.streamId;
    }

    const streamId = uuidv4();
    const now = new Date();
    
    const streamConfig = config || this.config.defaultStreamConfig;
    
    const streamInfo: StreamInfo = {
      streamId,
      sessionId: workflowSessionId,
      isActive: true,
      clients: [],
      history: [],
      config: { ...streamConfig },
      createdAt: now,
      lastActivity: now
    };

    this.streams.set(workflowSessionId, streamInfo);
    return streamId;
  }

  async destroyStream(workflowSessionId: string): Promise<void> {
    const stream = this.streams.get(workflowSessionId);
    if (!stream) {
      return;
    }

    // Disconnect all clients
    for (const client of stream.clients) {
      try {
        if ('close' in client.connection) {
          client.connection.close();
        } else if ('end' in client.connection) {
          client.connection.end();
        }
      } catch (error) {
        console.warn('Error disconnecting client during stream destruction:', error);
      }
    }

    this.streams.delete(workflowSessionId);
  }

  getStream(workflowSessionId: string): StreamInfo | null {
    return this.streams.get(workflowSessionId) || null;
  }

  listActiveStreams(): string[] {
    const activeStreams: string[] = [];
    for (const [workflowSessionId, session] of this.sessions) {
      if (session.status === SessionStatus.ACTIVE || session.status === SessionStatus.BUSY) {
        if (this.streams.has(workflowSessionId)) {
          activeStreams.push(workflowSessionId);
        }
      }
    }
    return activeStreams;
  }

  // Client management
  async attachClient(workflowSessionId: string, client: StreamClient): Promise<void> {
    const stream = this.streams.get(workflowSessionId);
    if (!stream) {
      throw new Error('Stream session not found');
    }

    // Check client limit
    if (stream.clients.length >= stream.config.maxClients) {
      throw new Error('Maximum clients limit reached');
    }

    stream.clients.push(client);
    stream.lastActivity = new Date();
  }

  async detachClient(workflowSessionId: string, clientId: string): Promise<void> {
    const stream = this.streams.get(workflowSessionId);
    if (!stream) {
      return; // Gracefully handle non-existent stream
    }

    const clientIndex = stream.clients.findIndex(c => c.id === clientId);
    if (clientIndex >= 0) {
      stream.clients.splice(clientIndex, 1);
      stream.lastActivity = new Date();
    }
  }

  // Configuration
  updateConfig(config: ExecutorStreamerConfig): void {
    this.config = { ...config };
  }

  getConfig(): ExecutorStreamerConfig {
    // Return deep copy to prevent external modifications
    return JSON.parse(JSON.stringify(this.config));
  }

  // Statistics
  getStats(): StreamManagerStats {
    const activeSessions = Array.from(this.sessions.values()).filter(
      s => s.status === SessionStatus.ACTIVE || s.status === SessionStatus.BUSY
    ).length;
    
    const totalClients = Array.from(this.streams.values()).reduce(
      (total, stream) => total + stream.clients.length, 0
    );

    const averageClientsPerStream = this.streams.size > 0 ? totalClients / this.streams.size : 0;
    const uptime = Date.now() - this.startTime.getTime();

    return {
      totalSessions: this.sessions.size,
      activeSessions,
      totalClients,
      averageClientsPerStream,
      uptime
    };
  }

  // Shutdown
  async shutdown(): Promise<void> {
    // Destroy all sessions and streams
    const sessionIds = Array.from(this.sessions.keys());
    for (const sessionId of sessionIds) {
      await this.destroySession(sessionId);
    }
  }
}
