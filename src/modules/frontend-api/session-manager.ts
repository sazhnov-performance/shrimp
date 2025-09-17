/**
 * Frontend API Session Manager
 * Implements standardized session management for Frontend API client connections
 */

import { v4 as uuidv4 } from 'uuid';
import {
  SessionStatus,
  ModuleSessionInfo,
  ModuleSessionConfig,
  SessionLifecycleCallbacks,
  SessionManagerHealth,
  StandardError,
  ErrorCategory,
  ErrorSeverity
} from '../../../types/shared-types';
import {
  FrontendAPISession,
  ClientConnection,
  StreamConnection,
  FrontendAPIConfig
} from './types';

export class FrontendAPISessionManager {
  readonly moduleId = 'frontend-api' as const;
  
  private sessions: Map<string, FrontendAPISession> = new Map();
  private sessionTTLTimers: Map<string, NodeJS.Timeout> = new Map();
  private config: FrontendAPIConfig;
  private lifecycleCallbacks?: SessionLifecycleCallbacks;

  constructor(config: FrontendAPIConfig) {
    this.config = config;
  }

  /**
   * Creates a new Frontend API session for client connections
   */
  async createSession(workflowSessionId: string, config?: ModuleSessionConfig): Promise<string> {
    const sessionId = uuidv4();
    const now = new Date();
    
    const session: FrontendAPISession = {
      moduleId: this.moduleId,
      sessionId,
      linkedWorkflowSessionId: workflowSessionId,
      status: SessionStatus.INITIALIZING,
      createdAt: now,
      lastActivity: now,
      clientConnections: [],
      streamConnections: [],
      metadata: {
        ...config?.metadata,
        maxConcurrentConnections: this.config.performance.maxConcurrentOperations,
        createdBy: 'frontend-api'
      }
    };

    this.sessions.set(workflowSessionId, session);
    
    // Set up session TTL cleanup if configured
    if (config?.timeoutMs) {
      const timer = setTimeout(async () => {
        await this.destroySession(workflowSessionId);
      }, config.timeoutMs);
      this.sessionTTLTimers.set(workflowSessionId, timer);
    }

    // Update status to active
    await this.updateSessionStatus(workflowSessionId, SessionStatus.ACTIVE);

    // Trigger lifecycle callback
    if (this.lifecycleCallbacks?.onSessionCreated) {
      await this.lifecycleCallbacks.onSessionCreated(
        this.moduleId,
        workflowSessionId,
        sessionId
      );
    }

    return sessionId;
  }

  /**
   * Destroys a Frontend API session and cleans up all connections
   */
  async destroySession(workflowSessionId: string): Promise<void> {
    const session = this.sessions.get(workflowSessionId);
    if (!session) {
      return; // Already destroyed or never existed
    }

    // Clean up client connections
    for (const clientConnection of session.clientConnections) {
      await this.disconnectClient(workflowSessionId, clientConnection.clientId);
    }

    // Clean up stream connections
    for (const streamConnection of session.streamConnections) {
      await this.disconnectStream(workflowSessionId, streamConnection.streamId);
    }

    // Clear TTL timer
    const timer = this.sessionTTLTimers.get(workflowSessionId);
    if (timer) {
      clearTimeout(timer);
      this.sessionTTLTimers.delete(workflowSessionId);
    }

    // Update status to cleanup
    await this.updateSessionStatus(workflowSessionId, SessionStatus.CLEANUP);

    // Remove session
    this.sessions.delete(workflowSessionId);

    // Trigger lifecycle callback
    if (this.lifecycleCallbacks?.onSessionDestroyed) {
      await this.lifecycleCallbacks.onSessionDestroyed(
        this.moduleId,
        workflowSessionId
      );
    }
  }

  /**
   * Gets session information by workflow session ID
   */
  getSession(workflowSessionId: string): ModuleSessionInfo | null {
    return this.sessions.get(workflowSessionId) || null;
  }

  /**
   * Gets full Frontend API session information 
   */
  getFrontendAPISession(workflowSessionId: string): FrontendAPISession | null {
    return this.sessions.get(workflowSessionId) || null;
  }

  /**
   * Checks if session exists
   */
  sessionExists(workflowSessionId: string): boolean {
    return this.sessions.has(workflowSessionId);
  }

  /**
   * Updates session status
   */
  async updateSessionStatus(workflowSessionId: string, status: SessionStatus): Promise<void> {
    const session = this.sessions.get(workflowSessionId);
    if (!session) {
      throw new Error(`Session ${workflowSessionId} not found`);
    }

    const oldStatus = session.status;
    session.status = status;
    session.lastActivity = new Date();

    // Trigger lifecycle callback
    if (this.lifecycleCallbacks?.onSessionStatusChanged) {
      await this.lifecycleCallbacks.onSessionStatusChanged(
        this.moduleId,
        workflowSessionId,
        oldStatus,
        status
      );
    }
  }

  /**
   * Gets current session status
   */
  getSessionStatus(workflowSessionId: string): SessionStatus | null {
    const session = this.sessions.get(workflowSessionId);
    return session ? session.status : null;
  }

  /**
   * Records activity for session
   */
  async recordActivity(workflowSessionId: string): Promise<void> {
    const session = this.sessions.get(workflowSessionId);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  /**
   * Gets last activity timestamp
   */
  getLastActivity(workflowSessionId: string): Date | null {
    const session = this.sessions.get(workflowSessionId);
    return session ? session.lastActivity : null;
  }

  /**
   * Sets lifecycle callbacks
   */
  setLifecycleCallbacks(callbacks: SessionLifecycleCallbacks): void {
    this.lifecycleCallbacks = callbacks;
  }

  /**
   * Performs health check
   */
  async healthCheck(): Promise<SessionManagerHealth> {
    const sessions = Array.from(this.sessions.values());
    const activeSessions = sessions.filter(s => 
      s.status === SessionStatus.ACTIVE || s.status === SessionStatus.BUSY
    ).length;

    const errors: StandardError[] = [];
    
    // Check for sessions with excessive connections
    for (const session of sessions) {
      const totalConnections = session.clientConnections.length + session.streamConnections.length;
      if (totalConnections > this.config.performance.maxConcurrentOperations) {
        errors.push({
          id: uuidv4(),
          category: ErrorCategory.SYSTEM,
          severity: ErrorSeverity.MEDIUM,
          code: 'EXCESSIVE_CONNECTIONS',
          message: `Session ${session.linkedWorkflowSessionId} has ${totalConnections} connections`,
          timestamp: new Date(),
          moduleId: this.moduleId,
          recoverable: true,
          retryable: false
        });
      }
    }

    return {
      moduleId: this.moduleId,
      isHealthy: errors.length === 0,
      activeSessions,
      totalSessions: sessions.length,
      errors,
      lastHealthCheck: new Date()
    };
  }

  /**
   * Lists all active sessions
   */
  listActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  // ============================================================================
  // CLIENT CONNECTION MANAGEMENT
  // ============================================================================

  /**
   * Adds a client connection to a session
   */
  async addClientConnection(
    workflowSessionId: string, 
    clientConnection: ClientConnection
  ): Promise<void> {
    const session = this.sessions.get(workflowSessionId);
    if (!session) {
      throw new Error(`Session ${workflowSessionId} not found`);
    }

    session.clientConnections.push(clientConnection);
    await this.recordActivity(workflowSessionId);
  }

  /**
   * Removes a client connection from a session
   */
  async removeClientConnection(
    workflowSessionId: string, 
    clientId: string
  ): Promise<void> {
    const session = this.sessions.get(workflowSessionId);
    if (!session) {
      return; // Session may have been destroyed
    }

    session.clientConnections = session.clientConnections.filter(
      conn => conn.clientId !== clientId
    );
    await this.recordActivity(workflowSessionId);
  }

  /**
   * Disconnects a client
   */
  async disconnectClient(workflowSessionId: string, clientId: string): Promise<void> {
    const session = this.sessions.get(workflowSessionId);
    if (!session) {
      return;
    }

    const connection = session.clientConnections.find(conn => conn.clientId === clientId);
    if (connection) {
      connection.isActive = false;
      // Close connection if it's a WebSocket
      if (connection.type === 'websocket' && connection.type) {
        // WebSocket cleanup would happen here
      }
      await this.removeClientConnection(workflowSessionId, clientId);
    }
  }

  // ============================================================================
  // STREAM CONNECTION MANAGEMENT
  // ============================================================================

  /**
   * Adds a stream connection to a session
   */
  async addStreamConnection(
    workflowSessionId: string, 
    streamConnection: StreamConnection
  ): Promise<void> {
    const session = this.sessions.get(workflowSessionId);
    if (!session) {
      throw new Error(`Session ${workflowSessionId} not found`);
    }

    session.streamConnections.push(streamConnection);
    await this.recordActivity(workflowSessionId);
  }

  /**
   * Removes a stream connection from a session
   */
  async removeStreamConnection(
    workflowSessionId: string, 
    streamId: string
  ): Promise<void> {
    const session = this.sessions.get(workflowSessionId);
    if (!session) {
      return; // Session may have been destroyed
    }

    session.streamConnections = session.streamConnections.filter(
      conn => conn.streamId !== streamId
    );
    await this.recordActivity(workflowSessionId);
  }

  /**
   * Disconnects a stream
   */
  async disconnectStream(workflowSessionId: string, streamId: string): Promise<void> {
    const session = this.sessions.get(workflowSessionId);
    if (!session) {
      return;
    }

    await this.removeStreamConnection(workflowSessionId, streamId);
  }

  /**
   * Gets all client connections for a session
   */
  getClientConnections(workflowSessionId: string): ClientConnection[] {
    const session = this.sessions.get(workflowSessionId);
    return session ? session.clientConnections : [];
  }

  /**
   * Gets all stream connections for a session
   */
  getStreamConnections(workflowSessionId: string): StreamConnection[] {
    const session = this.sessions.get(workflowSessionId);
    return session ? session.streamConnections : [];
  }

  /**
   * Gets connection statistics for monitoring
   */
  getConnectionStats(): {
    totalSessions: number;
    totalClientConnections: number;
    totalStreamConnections: number;
    activeConnections: number;
  } {
    let totalClientConnections = 0;
    let totalStreamConnections = 0;
    let activeConnections = 0;

    for (const session of this.sessions.values()) {
      totalClientConnections += session.clientConnections.length;
      totalStreamConnections += session.streamConnections.length;
      activeConnections += session.clientConnections.filter(c => c.isActive).length;
    }

    return {
      totalSessions: this.sessions.size,
      totalClientConnections,
      totalStreamConnections,
      activeConnections
    };
  }
}
