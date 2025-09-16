/**
 * Executor Session Manager
 * Implements standardized session management for Playwright browser sessions
 */

import { chromium, firefox, webkit, Browser, Page } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import { 
  SessionStatus,
  ModuleSessionInfo,
  ModuleSessionConfig,
  SessionLifecycleCallbacks,
  SessionManagerHealth
} from '../../../types/shared-types';
import { 
  ExecutorSession, 
  IExecutorSessionManager, 
  ExecutorConfig 
} from './types';
import { ExecutorErrorHandler } from './error-handler';
import { IExecutorLogger } from './types';

export class ExecutorSessionManager implements IExecutorSessionManager {
  readonly moduleId = 'executor' as const;
  
  private sessions: Map<string, ExecutorSession> = new Map();
  private sessionTTLTimers: Map<string, NodeJS.Timeout> = new Map();
  private config: ExecutorConfig;
  private errorHandler: ExecutorErrorHandler;
  private logger: IExecutorLogger;
  private lifecycleCallbacks?: SessionLifecycleCallbacks;

  constructor(
    config: ExecutorConfig,
    errorHandler: ExecutorErrorHandler,
    logger: IExecutorLogger
  ) {
    this.config = config;
    this.errorHandler = errorHandler;
    this.logger = logger;
  }

  /**
   * Creates a new executor session with browser and page
   */
  async createSession(workflowSessionId: string, config?: ModuleSessionConfig): Promise<string> {
    try {
      // Check if session already exists
      if (this.sessions.has(workflowSessionId)) {
        throw this.errorHandler.createStandardError(
          'SESSION_ALREADY_EXISTS',
          `Session already exists for workflow: ${workflowSessionId}`,
          { workflowSessionId }
        );
      }

      // Check session limits
      if (this.sessions.size >= this.config.browser.maxSessions) {
        throw this.errorHandler.createStandardError(
          'MAX_SESSIONS_EXCEEDED',
          `Maximum sessions limit (${this.config.browser.maxSessions}) exceeded`,
          { currentSessions: this.sessions.size, maxSessions: this.config.browser.maxSessions }
        );
      }

      // Generate session ID
      const sessionId = uuidv4();

      // Launch browser
      const browser = await this.launchBrowser();
      const page = await browser.newPage();

      // Create session object
      const session: ExecutorSession = {
        moduleId: this.moduleId,
        sessionId,
        linkedWorkflowSessionId: workflowSessionId,
        status: SessionStatus.INITIALIZING,
        createdAt: new Date(),
        lastActivity: new Date(),
        browser,
        page,
        variables: new Map(),
        metadata: config?.metadata || {}
      };

      // Store session
      this.sessions.set(workflowSessionId, session);

      // Set up TTL timer
      this.setupSessionTTL(workflowSessionId);

      // Update status to active
      await this.updateSessionStatus(workflowSessionId, SessionStatus.ACTIVE);

      this.logger.logSessionEvent(workflowSessionId, 'created', { 
        sessionId, 
        browserType: this.config.browser.type 
      });

      // Trigger lifecycle callback
      if (this.lifecycleCallbacks?.onSessionCreated) {
        await this.lifecycleCallbacks.onSessionCreated(this.moduleId, workflowSessionId, sessionId);
      }

      return sessionId;

    } catch (error) {
      this.logger.error(
        `Failed to create session for workflow ${workflowSessionId}`,
        workflowSessionId,
        { error: error instanceof Error ? error.message : String(error) }
      );
      
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      
      throw this.errorHandler.createBrowserError(
        `Failed to create browser session: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Destroys an executor session and cleans up resources
   */
  async destroySession(workflowSessionId: string): Promise<void> {
    const session = this.sessions.get(workflowSessionId);
    if (!session) {
      this.logger.warn(`Attempt to destroy non-existent session: ${workflowSessionId}`);
      return;
    }

    try {
      // Update status
      await this.updateSessionStatus(workflowSessionId, SessionStatus.CLEANUP);

      // Clear TTL timer
      const timer = this.sessionTTLTimers.get(workflowSessionId);
      if (timer) {
        clearTimeout(timer);
        this.sessionTTLTimers.delete(workflowSessionId);
      }

      // Close browser
      await session.browser.close();

      // Remove from sessions
      this.sessions.delete(workflowSessionId);

      this.logger.logSessionEvent(workflowSessionId, 'destroyed', { 
        sessionId: session.sessionId 
      });

      // Trigger lifecycle callback
      if (this.lifecycleCallbacks?.onSessionDestroyed) {
        await this.lifecycleCallbacks.onSessionDestroyed(this.moduleId, workflowSessionId);
      }

    } catch (error) {
      this.logger.error(
        `Error destroying session ${workflowSessionId}`,
        workflowSessionId,
        { error: error instanceof Error ? error.message : String(error) }
      );

      // Force remove from sessions even if cleanup failed
      this.sessions.delete(workflowSessionId);
      this.sessionTTLTimers.delete(workflowSessionId);

      // Trigger error callback
      if (this.lifecycleCallbacks?.onSessionError) {
        await this.lifecycleCallbacks.onSessionError(this.moduleId, workflowSessionId, error);
      }
    }
  }

  /**
   * Gets session information
   */
  getSession(workflowSessionId: string): ModuleSessionInfo | null {
    return this.sessions.get(workflowSessionId) || null;
  }

  /**
   * Gets executor-specific session with browser and page
   */
  getExecutorSession(workflowSessionId: string): ExecutorSession | null {
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
      throw this.errorHandler.createSessionNotFoundError(workflowSessionId);
    }

    const oldStatus = session.status;
    session.status = status;
    session.lastActivity = new Date();

    this.logger.debug(
      `Session status changed: ${oldStatus} -> ${status}`,
      workflowSessionId
    );

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
   * Records activity for session (updates lastActivity timestamp)
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
    const errors: any[] = [];
    const totalSessions = this.sessions.size;
    let activeSessions = 0;

    // Check each session
    for (const [workflowSessionId, session] of this.sessions) {
      try {
        // Check if browser is still connected
        if (session.browser.isConnected()) {
          activeSessions++;
        } else {
          errors.push({
            workflowSessionId,
            error: 'Browser disconnected'
          });
        }
      } catch (error) {
        errors.push({
          workflowSessionId,
          error: error instanceof Error ? error.message : String(error)
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

  /**
   * Lists all active session IDs
   */
  listActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Cleans up expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [workflowSessionId, session] of this.sessions) {
      const age = now - session.lastActivity.getTime();
      if (age > this.config.browser.sessionTTL) {
        expiredSessions.push(workflowSessionId);
      }
    }

    for (const workflowSessionId of expiredSessions) {
      this.logger.info(`Cleaning up expired session: ${workflowSessionId}`);
      await this.destroySession(workflowSessionId);
    }
  }

  private async launchBrowser(): Promise<Browser> {
    try {
      const browserType = this.config.browser.type;
      const options = {
        headless: this.config.browser.headless
      };

      switch (browserType) {
        case 'chromium':
          return await chromium.launch(options);
        case 'firefox':
          return await firefox.launch(options);
        case 'webkit':
          return await webkit.launch(options);
        default:
          throw new Error(`Unsupported browser type: ${browserType}`);
      }
    } catch (error) {
      throw this.errorHandler.createBrowserError(
        `Failed to launch ${this.config.browser.type} browser`,
        error instanceof Error ? error : undefined
      );
    }
  }

  private setupSessionTTL(workflowSessionId: string): void {
    const timer = setTimeout(async () => {
      this.logger.info(`Session TTL expired for: ${workflowSessionId}`);
      await this.destroySession(workflowSessionId);
    }, this.config.browser.sessionTTL);

    this.sessionTTLTimers.set(workflowSessionId, timer);
  }

  /**
   * Updates configuration
   */
  updateConfig(config: ExecutorConfig): void {
    this.config = config;
  }

  /**
   * Gets session statistics
   */
  getStatistics(): {
    totalSessions: number;
    activeSessions: number;
    averageSessionAge: number;
    oldestSession?: Date;
    newestSession?: Date;
  } {
    const sessions = Array.from(this.sessions.values());
    const now = Date.now();
    
    const activeSessions = sessions.filter(s => s.status === SessionStatus.ACTIVE).length;
    const ages = sessions.map(s => now - s.createdAt.getTime());
    const timestamps = sessions.map(s => s.createdAt.getTime());
    
    return {
      totalSessions: sessions.length,
      activeSessions,
      averageSessionAge: ages.length > 0 ? ages.reduce((sum, age) => sum + age, 0) / ages.length : 0,
      oldestSession: timestamps.length > 0 ? new Date(Math.min(...timestamps)) : undefined,
      newestSession: timestamps.length > 0 ? new Date(Math.max(...timestamps)) : undefined
    };
  }
}

