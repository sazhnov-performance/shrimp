/**
 * Frontend API Main Class
 * Implements the main Frontend API interface with standardized session management
 * and integration with backend modules
 */

import { v4 as uuidv4 } from 'uuid';
import {
  SessionStatus,
  ModuleSessionInfo,
  ModuleSessionConfig,
  SessionLifecycleCallbacks,
  SessionManagerHealth,
  SessionCoordinator,
  DIContainer,
  StandardError,
  ErrorCategory,
  ErrorSeverity,
  ERROR_CODES,
  SYSTEM_VERSION
} from '../../../types/shared-types';

import {
  IFrontendAPI,
  FrontendAPIConfig,
  StepProcessorAPI,
  SessionManagementAPI,
  StreamingAPI,
  RealtimeStreamingAPI,
  AuthenticationMiddleware,
  ValidationMiddleware,
  ErrorHandlingMiddleware,
  RateLimitMiddleware,
  APIIntegrations,
  DEFAULT_FRONTEND_API_CONFIG
} from './types';

import { FrontendAPISessionManager } from './session-manager';
import { FrontendAPIErrorHandler } from './error-handler';
import { StepProcessorAPIImpl } from './api/step-processor-api';
import { SessionManagementAPIImpl } from './api/session-management-api';
import { StreamingAPIImpl } from './api/streaming-api';
import { RealtimeStreamingAPIImpl } from './streaming/realtime-streaming-api';
import { AuthenticationMiddlewareImpl } from './middleware/authentication-middleware';
import { ValidationMiddlewareImpl } from './middleware/validation-middleware';
import { RateLimitMiddlewareImpl } from './middleware/rate-limit-middleware';

export class FrontendAPI implements IFrontendAPI {
  readonly moduleId = 'frontend-api' as const;
  
  private config: FrontendAPIConfig;
  private sessionManager: FrontendAPISessionManager;
  private errorHandler: FrontendAPIErrorHandler;
  private sessionCoordinator?: SessionCoordinator;
  private integrations?: APIIntegrations;
  private isInitialized = false;
  private isServerRunning = false;
  private server?: any; // Express server instance

  // API Layer Components
  public stepProcessor: StepProcessorAPI;
  public sessionManagement: SessionManagementAPI;
  public streaming: StreamingAPI;
  public realtimeStreaming: RealtimeStreamingAPI;

  // Middleware Layer
  public authentication: AuthenticationMiddleware;
  public validation: ValidationMiddleware;
  public errorHandling: ErrorHandlingMiddleware;
  public rateLimit: RateLimitMiddleware;

  constructor(config: FrontendAPIConfig = DEFAULT_FRONTEND_API_CONFIG) {
    this.config = { ...DEFAULT_FRONTEND_API_CONFIG, ...config };
    this.sessionManager = new FrontendAPISessionManager(this.config);
    this.errorHandler = new FrontendAPIErrorHandler(this.config);

    // Initialize API layer components
    this.stepProcessor = new StepProcessorAPIImpl(this.config, this.errorHandler);
    this.sessionManagement = new SessionManagementAPIImpl(this.config, this.sessionManager, this.errorHandler);
    this.streaming = new StreamingAPIImpl(this.config, this.errorHandler);
    this.realtimeStreaming = new RealtimeStreamingAPIImpl(this.config, this.sessionManager, this.errorHandler);

    // Initialize middleware
    this.authentication = new AuthenticationMiddlewareImpl(this.config.authentication);
    this.validation = new ValidationMiddlewareImpl(this.config.validation);
    this.errorHandling = this.errorHandler;
    this.rateLimit = new RateLimitMiddlewareImpl(this.config.rateLimit);
  }

  // ============================================================================
  // STANDARDIZED SESSION MANAGEMENT (ISessionManager Implementation)
  // ============================================================================

  async createSession(workflowSessionId: string, config?: ModuleSessionConfig): Promise<string> {
    if (!this.isInitialized) {
      throw this.createError('FRONTEND_API_NOT_INITIALIZED', 'Frontend API not initialized');
    }

    try {
      const sessionId = await this.sessionManager.createSession(workflowSessionId, config);
      
      this.logInfo(`Created frontend API session ${sessionId} for workflow ${workflowSessionId}`);
      return sessionId;
    } catch (error) {
      const wrappedError = this.createError('SESSION_CREATION_FAILED', 'Failed to create frontend API session', error);
      this.logError('Session creation failed', wrappedError);
      throw wrappedError;
    }
  }

  async destroySession(workflowSessionId: string): Promise<void> {
    try {
      await this.sessionManager.destroySession(workflowSessionId);
      this.logInfo(`Destroyed frontend API session for workflow ${workflowSessionId}`);
    } catch (error) {
      const wrappedError = this.createError('SESSION_DESTRUCTION_FAILED', 'Failed to destroy frontend API session', error);
      this.logError('Session destruction failed', wrappedError);
      throw wrappedError;
    }
  }

  getSession(workflowSessionId: string): ModuleSessionInfo | null {
    return this.sessionManager.getSession(workflowSessionId);
  }

  sessionExists(workflowSessionId: string): boolean {
    return this.sessionManager.sessionExists(workflowSessionId);
  }

  async updateSessionStatus(workflowSessionId: string, status: SessionStatus): Promise<void> {
    try {
      await this.sessionManager.updateSessionStatus(workflowSessionId, status);
      this.logInfo(`Updated session ${workflowSessionId} status to ${status}`);
    } catch (error) {
      const wrappedError = this.createError('SESSION_STATUS_UPDATE_FAILED', 'Failed to update session status', error);
      this.logError('Session status update failed', wrappedError);
      throw wrappedError;
    }
  }

  getSessionStatus(workflowSessionId: string): SessionStatus | null {
    return this.sessionManager.getSessionStatus(workflowSessionId);
  }

  async recordActivity(workflowSessionId: string): Promise<void> {
    await this.sessionManager.recordActivity(workflowSessionId);
  }

  getLastActivity(workflowSessionId: string): Date | null {
    return this.sessionManager.getLastActivity(workflowSessionId);
  }

  setLifecycleCallbacks(callbacks: SessionLifecycleCallbacks): void {
    this.sessionManager.setLifecycleCallbacks(callbacks);
  }

  async healthCheck(): Promise<SessionManagerHealth> {
    return await this.sessionManager.healthCheck();
  }

  // ============================================================================
  // SESSION COORDINATOR INTEGRATION
  // ============================================================================

  setSessionCoordinator(coordinator: SessionCoordinator): void {
    this.sessionCoordinator = coordinator;
    
    // Register this module with the coordinator
    coordinator.registerModule(this.moduleId, this);
    
    this.logInfo('Session coordinator set and module registered');
  }

  getSessionCoordinator(): SessionCoordinator | null {
    return this.sessionCoordinator || null;
  }

  // ============================================================================
  // DEPENDENCY INJECTION AND INITIALIZATION
  // ============================================================================

  async initialize(container: DIContainer): Promise<void> {
    if (this.isInitialized) {
      this.logWarn('Frontend API already initialized');
      return;
    }

    try {
      // Resolve integrations from DI container
      this.integrations = {
        stepProcessor: container.resolve('IStepProcessor'),
        executorStreamer: container.resolve('IExecutorStreamer'),
        streamManager: container.resolve('IExecutorStreamerManager'),
        sessionCoordinator: container.resolve('SessionCoordinator'),
        taskLoop: container.resolve('ITaskLoop'),
        aiIntegration: container.resolve('IAIIntegration'),
        contextManager: container.resolve('IAIContextManager')
      };

      // Set session coordinator
      this.setSessionCoordinator(this.integrations.sessionCoordinator);

      // Initialize API components with integrations
      await this.initializeAPIComponents();

      this.isInitialized = true;
      this.logInfo('Frontend API initialized successfully');

    } catch (error) {
      const wrappedError = this.createError('INITIALIZATION_FAILED', 'Failed to initialize Frontend API', error);
      this.logError('Initialization failed', wrappedError);
      throw wrappedError;
    }
  }

  private async initializeAPIComponents(): Promise<void> {
    if (!this.integrations) {
      throw new Error('Integrations not available');
    }

    try {
      // Initialize API components with backend integrations
      if (this.stepProcessor && typeof this.stepProcessor.initialize === 'function') {
        await this.stepProcessor.initialize(this.integrations.stepProcessor);
      }
      
      if (this.sessionManagement && typeof this.sessionManagement.initialize === 'function') {
        await this.sessionManagement.initialize(this.integrations);
      }
      
      if (this.streaming && typeof this.streaming.initialize === 'function') {
        await this.streaming.initialize(this.integrations.executorStreamer);
      }
      
      if (this.realtimeStreaming && typeof this.realtimeStreaming.initialize === 'function') {
        await this.realtimeStreaming.initialize(this.integrations.streamManager);
      }
    } catch (error) {
      throw new Error(`Failed to initialize API components: ${error.message}`);
    }
  }

  // ============================================================================
  // SERVER MANAGEMENT
  // ============================================================================

  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw this.createError('FRONTEND_API_NOT_INITIALIZED', 'Cannot start server: Frontend API not initialized');
    }

    if (this.isServerRunning) {
      this.logWarn('Server already running');
      return;
    }

    try {
      // Create Express server with all routes and middleware
      this.server = await this.createExpressServer();
      
      // Start listening
      await new Promise<void>((resolve, reject) => {
        this.server.listen(this.config.server.port, this.config.server.host, (error?: Error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      this.isServerRunning = true;
      this.logInfo(`Frontend API server started on ${this.config.server.host}:${this.config.server.port}`);

    } catch (error) {
      const wrappedError = this.createError('SERVER_START_FAILED', 'Failed to start Frontend API server', error);
      this.logError('Server start failed', wrappedError);
      throw wrappedError;
    }
  }

  async stop(): Promise<void> {
    if (!this.isServerRunning) {
      this.logWarn('Server not running');
      return;
    }

    try {
      // Close all active sessions
      const activeSessions = this.sessionManager.listActiveSessions();
      for (const sessionId of activeSessions) {
        await this.destroySession(sessionId);
      }

      // Close server
      if (this.server) {
        await new Promise<void>((resolve, reject) => {
          this.server.close((error?: Error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        });
      }

      this.isServerRunning = false;
      this.logInfo('Frontend API server stopped');

    } catch (error) {
      const wrappedError = this.createError('SERVER_STOP_FAILED', 'Failed to stop Frontend API server', error);
      this.logError('Server stop failed', wrappedError);
      throw wrappedError;
    }
  }

  isRunning(): boolean {
    return this.isServerRunning;
  }

  private async createExpressServer(): Promise<any> {
    // This would create the actual Express server with all routes
    // For now, returning a placeholder that matches the interface
    let express: any;
    try {
      express = require('express');
    } catch (e) {
      throw new Error('Express library not available. Install express package to run the server.');
    }
    
    const app = express();

    // Add middleware
    app.use(express.json());
    app.use(this.setupCORS());
    
    // Add authentication middleware if enabled
    if (this.config.authentication.enabled) {
      app.use('/api', this.authentication.authenticate);
    }
    
    // Add rate limiting
    app.use('/api', this.rateLimit.checkRequestLimit);
    
    // Add validation middleware
    app.use('/api', this.validation.validateRequest);

    // Add API routes (these would be implemented in separate route files)
    this.setupRoutes(app);

    // Add error handling middleware (must be last)
    app.use(this.errorHandling.handleStandardError);

    return app;
  }

  private setupCORS(): any {
    return (req: any, res: any, next: any) => {
      const origin = req.headers.origin;
      if (this.config.server.cors.origins.includes(origin) || this.config.server.cors.origins.includes('*')) {
        res.header('Access-Control-Allow-Origin', origin);
      }
      res.header('Access-Control-Allow-Methods', this.config.server.cors.methods.join(', '));
      res.header('Access-Control-Allow-Headers', this.config.server.cors.allowedHeaders.join(', '));
      next();
    };
  }

  private setupRoutes(app: any): void {
    // Step processing routes
    app.post('/api/automation/execute', this.stepProcessor.executeSteps);
    app.post('/api/automation/validate', this.stepProcessor.validateSteps);

    // Session management routes
    app.get('/api/automation/sessions/:sessionId', this.sessionManagement.getSessionStatus);
    app.post('/api/automation/sessions/:sessionId/pause', this.sessionManagement.pauseSession);
    app.post('/api/automation/sessions/:sessionId/resume', this.sessionManagement.resumeSession);
    app.post('/api/automation/sessions/:sessionId/cancel', this.sessionManagement.cancelSession);
    app.get('/api/automation/sessions', this.sessionManagement.listSessions);
    app.get('/api/automation/sessions/:sessionId/history', this.sessionManagement.getSessionHistory);

    // Streaming routes
    app.get('/api/streams/:streamId', this.streaming.getStreamDetails);
    app.get('/api/streams/:streamId/events', this.streaming.getStreamHistory);

    // WebSocket and SSE endpoints
    app.ws('/api/stream/ws/:streamId', this.realtimeStreaming.handleWebSocketConnection);
    app.get('/api/stream/sse/:streamId', this.realtimeStreaming.handleSSEConnection);

    // Health check
    app.get('/api/health', this.handleHealthCheck.bind(this));
    app.get('/api/health/detailed', this.handleDetailedHealthCheck.bind(this));
  }

  private async handleHealthCheck(req: any, res: any): Promise<void> {
    try {
      const health = await this.healthCheck();
      const status = health.isHealthy ? 'healthy' : 'unhealthy';
      
      res.status(health.isHealthy ? 200 : 503).json({
        status,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: `${SYSTEM_VERSION.major}.${SYSTEM_VERSION.minor}.${SYSTEM_VERSION.patch}`
      });
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      });
    }
  }

  private async handleDetailedHealthCheck(req: any, res: any): Promise<void> {
    try {
      const health = await this.healthCheck();
      const connectionStats = this.sessionManager.getConnectionStats();

      res.status(health.isHealthy ? 200 : 503).json({
        status: health.isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: `${SYSTEM_VERSION.major}.${SYSTEM_VERSION.minor}.${SYSTEM_VERSION.patch}`,
        dependencies: {
          stepProcessor: this.integrations?.stepProcessor ? 'healthy' : 'unhealthy',
          executorStreamer: this.integrations?.executorStreamer ? 'healthy' : 'unhealthy'
        },
        metrics: {
          sessions: connectionStats,
          errors: health.errors
        }
      });
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Detailed health check failed'
      });
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private createError(code: string, message: string, cause?: any): StandardError {
    return {
      id: uuidv4(),
      category: ErrorCategory.SYSTEM,
      severity: ErrorSeverity.HIGH,
      code: ERROR_CODES.FRONTEND_API[code] || code,
      message,
      cause,
      timestamp: new Date(),
      moduleId: this.moduleId,
      recoverable: false,
      retryable: false
    };
  }

  private logInfo(message: string, metadata?: any): void {
    if (this.config.logging.level === LogLevel.DEBUG || this.config.logging.level === LogLevel.INFO) {
      const logMessage = this.config.logging.structured 
        ? JSON.stringify({ level: 'INFO', module: this.moduleId, message, metadata, timestamp: new Date().toISOString() })
        : `${this.config.logging.prefix} [INFO] ${message}`;
      console.log(logMessage);
    }
  }

  private logWarn(message: string, metadata?: any): void {
    if (this.config.logging.level !== LogLevel.ERROR) {
      const logMessage = this.config.logging.structured 
        ? JSON.stringify({ level: 'WARN', module: this.moduleId, message, metadata, timestamp: new Date().toISOString() })
        : `${this.config.logging.prefix} [WARN] ${message}`;
      console.warn(logMessage);
    }
  }

  private logError(message: string, error?: any): void {
    const logMessage = this.config.logging.structured 
      ? JSON.stringify({ level: 'ERROR', module: this.moduleId, message, error, timestamp: new Date().toISOString() })
      : `${this.config.logging.prefix} [ERROR] ${message}`;
    console.error(logMessage);
  }

  // ============================================================================
  // GETTERS FOR CONFIGURATION AND STATE
  // ============================================================================

  getConfig(): FrontendAPIConfig {
    return { ...this.config };
  }

  getIntegrations(): APIIntegrations | null {
    return this.integrations || null;
  }

  isInitializedStatus(): boolean {
    return this.isInitialized;
  }
}
