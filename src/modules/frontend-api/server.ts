/**
 * Simplified Frontend API Server
 * Minimal Express.js server with only essential endpoints
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { 
  StepProcessingRequest,
  ProcessingConfig,
  SYSTEM_VERSION,
  DIContainer,
  DEPENDENCY_TOKENS
} from '../../../types/shared-types';

export interface SimplifiedFrontendAPIConfig {
  port: number;
  host: string;
}

export class SimplifiedFrontendAPI {
  private app = express();
  private server: any;
  private wsServer!: WebSocketServer;
  private stepProcessor: any;
  private executorStreamer: any;
  private isRunning = false;

  constructor(private config: SimplifiedFrontendAPIConfig) {
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Initialize with dependency injection
   */
  async initialize(container: DIContainer): Promise<void> {
    // Get required services from container
    this.stepProcessor = container.resolve(DEPENDENCY_TOKENS.STEP_PROCESSOR);
    
    try {
      this.executorStreamer = container.resolve(DEPENDENCY_TOKENS.EXECUTOR_STREAMER);
    } catch (error) {
      console.warn('[FrontendAPI] Executor streamer not available, streaming may not work');
    }
    
    if (!this.stepProcessor) {
      throw new Error('Step processor is required');
    }
  }

  /**
   * Setup minimal middleware
   */
  private setupMiddleware(): void {
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(cors());
    
    // Add request logging for debugging
    this.app.use((req, res, next) => {
      console.log(`[FrontendAPI] ${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Setup simplified routes
   */
  private setupRoutes(): void {
    // Single execute endpoint
    this.app.post('/api/automation/execute', this.handleExecute.bind(this));
    
    // Simple health check
    this.app.get('/api/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: `${SYSTEM_VERSION.major}.${SYSTEM_VERSION.minor}.${SYSTEM_VERSION.patch}`
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Endpoint ${req.method} ${req.originalUrl} not found`
        }
      });
    });
  }

  /**
   * Handle step execution
   */
  private async handleExecute(req: express.Request, res: express.Response): Promise<express.Response | void> {
    const startTime = Date.now();
    const requestId = uuidv4();
    
    try {
      // Basic validation
      const { steps, config } = req.body;
      if (!steps || !Array.isArray(steps)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Steps field is required and must be an array'
          }
        });
      }

      // Create processing request with defaults
      const processingRequest: StepProcessingRequest = {
        steps,
        config: config || this.getDefaultConfig(),
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          source: 'frontend-api'
        }
      };

      console.log(`[FrontendAPI] Processing ${steps.length} steps`);
      console.log(`[FrontendAPI] Request details:`, {
        stepCount: steps.length,
        sessionId: requestId,
        hasConfig: !!config
      });

      // Execute steps via Step Processor
      let result: any;
      try {
        console.log(`[FrontendAPI] Calling step processor...`);
        result = await this.stepProcessor.processSteps(processingRequest);
        console.log(`[FrontendAPI] Step processor returned:`, {
          sessionId: result.sessionId,
          streamId: result.streamId,
          status: result.initialStatus
        });
      } catch (stepProcessorError: any) {
        console.error(`[FrontendAPI] Step processor failed:`, {
          error: stepProcessorError.message,
          code: stepProcessorError.code,
          details: stepProcessorError.details,
          stack: stepProcessorError.stack?.split('\n').slice(0, 5)
        });
        
        // Re-throw with additional context
        throw new Error(`Step processing failed: ${stepProcessorError.message}`);
      }

      // Response matching UI expectations
      const response = {
        success: true,
        data: {
          sessionId: result.sessionId,
          streamId: result.streamId,
          initialStatus: result.initialStatus,
          estimatedDuration: result.estimatedDuration,
          createdAt: result.createdAt.toISOString()
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId,
          version: `${SYSTEM_VERSION.major}.${SYSTEM_VERSION.minor}.${SYSTEM_VERSION.patch}`,
          processingTimeMs: Date.now() - startTime,
          streamUrl: result.streamId ? `/api/stream/ws/${result.streamId}` : undefined
        }
      };

      console.log(`[FrontendAPI] Execution started - SessionID: ${result.sessionId}, StreamID: ${result.streamId}`);
      res.status(200).json(response);

    } catch (error: any) {
      console.error('[FrontendAPI] Execution failed:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: error?.message || 'Failed to execute steps'
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId,
          version: `${SYSTEM_VERSION.major}.${SYSTEM_VERSION.minor}.${SYSTEM_VERSION.patch}`,
          processingTimeMs: Date.now() - startTime
        }
      });
    }
  }

  /**
   * Handle WebSocket connections
   */
  private handleWebSocket(ws: any, request: any): void {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const pathParts = url.pathname.split('/');
    const streamId = pathParts[pathParts.length - 1];

    console.log(`[FrontendAPI] WebSocket connection for stream: ${streamId}`);

    if (!streamId) {
      ws.close(4400, 'Stream ID required');
      return;
    }

    // Basic connection acknowledgment
    ws.send(JSON.stringify({
      type: 'connection_ack',
      payload: {
        streamId,
        timestamp: new Date().toISOString()
      }
    }));

    // If we have an executor streamer, register the client
    if (this.executorStreamer) {
      try {
        // Register WebSocket client with executor streamer
        this.executorStreamer.attachClient(streamId, {
          id: uuidv4(),
          type: 'WEBSOCKET',
          connection: ws,
          connectedAt: new Date(),
          lastPing: new Date(),
          filters: [],
          isActive: true
        });
      } catch (error) {
        console.error('[FrontendAPI] Failed to register WebSocket client:', error);
      }
    }

    // Handle client messages
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
          case 'subscribe':
            // Client wants to subscribe - already handled above
            break;
          default:
            console.log(`[FrontendAPI] Unknown message type: ${message.type}`);
        }
      } catch (error) {
        console.error('[FrontendAPI] Error parsing WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      console.log(`[FrontendAPI] WebSocket disconnected for stream: ${streamId}`);
    });

    ws.on('error', (error: any) => {
      console.error('[FrontendAPI] WebSocket error:', error);
    });
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Server is already running');
    }

    return new Promise((resolve, reject) => {
      try {
        // Create HTTP server
        this.server = createServer(this.app);
        
        // Setup WebSocket server
        this.wsServer = new WebSocketServer({ 
          server: this.server,
          path: '/api/stream/ws'
        });
        
        // Handle WebSocket connections
        this.wsServer.on('connection', this.handleWebSocket.bind(this));

        // Start listening
        this.server.listen(this.config.port, this.config.host, () => {
          this.isRunning = true;
          console.log(`[FrontendAPI] Server started on http://${this.config.host}:${this.config.port}`);
          resolve();
        });

        this.server.on('error', (error: any) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    return new Promise((resolve, reject) => {
      // Close WebSocket server
      if (this.wsServer) {
        this.wsServer.close();
      }

      // Close HTTP server
      if (this.server) {
        this.server.close((error: any) => {
          if (error) {
            reject(error);
          } else {
            this.isRunning = false;
            console.log('[FrontendAPI] Server stopped');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Check if server is running
   */
  getRunningStatus(): boolean {
    return this.isRunning;
  }

  /**
   * Get the Express app (for testing)
   */
  getApp(): express.Application {
    return this.app;
  }

  /**
   * Get default processing configuration
   */
  private getDefaultConfig(): ProcessingConfig {
    return {
      maxExecutionTime: 300000,      // 5 minutes
      enableStreaming: true,
      enableReflection: true,
      retryOnFailure: false,
      maxRetries: 3,
      parallelExecution: false,
      aiConfig: {
        connectionId: 'default-ai-connection',
        model: 'gpt-4',
        temperature: 0.1,
        maxTokens: 4000,
        timeoutMs: 30000
      },
      executorConfig: {
        browserType: 'chromium',
        headless: true,
        timeoutMs: 30000,
        screenshotsEnabled: true
      },
      streamConfig: {
        bufferSize: 1000,
        maxHistorySize: 10000,
        compressionEnabled: true
      }
    };
  }
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: SimplifiedFrontendAPIConfig = {
  port: 3000,
  host: 'localhost'
};

/**
 * Factory function
 */
export function createSimplifiedFrontendAPI(config?: Partial<SimplifiedFrontendAPIConfig>): SimplifiedFrontendAPI {
  return new SimplifiedFrontendAPI({
    ...DEFAULT_CONFIG,
    ...config
  });
}
