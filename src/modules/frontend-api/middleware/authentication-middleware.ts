/**
 * Authentication Middleware Implementation
 * Handles user authentication for API requests
 */

// Optional import - only needed if JWT authentication is used
let jwt: any;
try {
  jwt = require('jsonwebtoken');
} catch (e) {
  // JWT library not available - JWT authentication will be disabled
  jwt = null;
}
import { v4 as uuidv4 } from 'uuid';
import {
  StandardError,
  ErrorCategory,
  ErrorSeverity,
  ERROR_CODES
} from '../../../../types/shared-types';
import {
  AuthenticationMiddleware,
  AuthenticationConfig,
  User
} from '../types';

export class AuthenticationMiddlewareImpl implements AuthenticationMiddleware {
  private config: AuthenticationConfig;
  private validApiKeys: Set<string> = new Set();
  private activeSessions: Map<string, { user: User; expires: Date }> = new Map();

  constructor(config: AuthenticationConfig) {
    this.config = config;
    this.initializeDefaults();
  }

  /**
   * Express middleware function for authentication
   */
  async authenticate(request: any, response: any, next: any): Promise<void> {
    try {
      // Skip authentication if disabled
      if (!this.config.enabled) {
        return next();
      }

      const user = await this.authenticateRequest(request);
      if (!user) {
        return this.sendAuthenticationError(response, 'Authentication required');
      }

      // Attach user to request
      request.user = user;
      request.userId = user.id;

      next();
    } catch (error) {
      this.sendAuthenticationError(response, error.message || 'Authentication failed');
    }
  }

  /**
   * Generates a JWT token for a user
   */
  generateToken(user: User): string {
    if (this.config.type !== 'jwt' || !this.config.jwtSecret) {
      throw new Error('JWT not configured');
    }

    if (!jwt) {
      throw new Error('JWT library not available. Install jsonwebtoken package to use JWT authentication.');
    }

    const payload = {
      id: user.id,
      username: user.username,
      permissions: user.permissions,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    };

    return jwt.sign(payload, this.config.jwtSecret);
  }

  /**
   * Validates a JWT token and returns the user
   */
  async validateToken(token: string): Promise<User | null> {
    if (this.config.type !== 'jwt' || !this.config.jwtSecret) {
      return null;
    }

    if (!jwt) {
      console.warn('JWT library not available. JWT authentication disabled.');
      return null;
    }

    try {
      const decoded = jwt.verify(token, this.config.jwtSecret) as any;
      
      if (!decoded.id || !decoded.username) {
        return null;
      }

      return {
        id: decoded.id,
        username: decoded.username,
        permissions: decoded.permissions || []
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Registers a valid API key
   */
  registerApiKey(apiKey: string): void {
    this.validApiKeys.add(apiKey);
  }

  /**
   * Removes an API key
   */
  revokeApiKey(apiKey: string): void {
    this.validApiKeys.delete(apiKey);
  }

  /**
   * Creates a session-based authentication session
   */
  createSession(user: User, durationMs: number = 24 * 60 * 60 * 1000): string {
    const sessionId = uuidv4();
    const expires = new Date(Date.now() + durationMs);
    
    this.activeSessions.set(sessionId, { user, expires });
    
    // Clean up expired sessions periodically
    this.cleanupExpiredSessions();
    
    return sessionId;
  }

  /**
   * Validates a session and returns the user
   */
  validateSession(sessionId: string): User | null {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return null;
    }

    if (session.expires < new Date()) {
      this.activeSessions.delete(sessionId);
      return null;
    }

    return session.user;
  }

  /**
   * Destroys a session
   */
  destroySession(sessionId: string): void {
    this.activeSessions.delete(sessionId);
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private async authenticateRequest(request: any): Promise<User | null> {
    switch (this.config.type) {
      case 'jwt':
        return await this.authenticateJWT(request);
      case 'api_key':
        return await this.authenticateApiKey(request);
      case 'session':
        return await this.authenticateSession(request);
      default:
        throw new Error(`Unsupported authentication type: ${this.config.type}`);
    }
  }

  private async authenticateJWT(request: any): Promise<User | null> {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    return await this.validateToken(token);
  }

  private async authenticateApiKey(request: any): Promise<User | null> {
    const apiKeyHeader = this.config.apiKeyHeader || 'X-API-Key';
    const apiKey = request.headers[apiKeyHeader.toLowerCase()];
    
    if (!apiKey || !this.validApiKeys.has(apiKey)) {
      return null;
    }

    // For API key authentication, create a generic user
    return {
      id: `api_key_${apiKey.substring(0, 8)}`,
      username: 'api_user',
      permissions: ['api_access']
    };
  }

  private async authenticateSession(request: any): Promise<User | null> {
    const cookieName = this.config.sessionCookieName || 'session';
    let sessionId: string | null = null;

    // Try to get session ID from cookie
    if (request.cookies && request.cookies[cookieName]) {
      sessionId = request.cookies[cookieName];
    }

    // Try to get session ID from header as fallback
    if (!sessionId && request.headers['x-session-id']) {
      sessionId = request.headers['x-session-id'];
    }

    if (!sessionId) {
      return null;
    }

    return this.validateSession(sessionId);
  }

  private sendAuthenticationError(response: any, message: string): void {
    const error: StandardError = {
      id: uuidv4(),
      category: ErrorCategory.USER,
      severity: ErrorSeverity.MEDIUM,
      code: ERROR_CODES.FRONTEND_API.AUTHENTICATION_FAILED,
      message,
      timestamp: new Date(),
      moduleId: 'frontend-api',
      recoverable: true,
      retryable: false,
      suggestedAction: 'Provide valid authentication credentials'
    };

    response.status(401).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        retryable: error.retryable,
        timestamp: error.timestamp.toISOString()
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: uuidv4(),
        version: '1.0.0',
        processingTimeMs: 0
      }
    });
  }

  private cleanupExpiredSessions(): void {
    const now = new Date();
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.expires < now) {
        this.activeSessions.delete(sessionId);
      }
    }
  }

  private initializeDefaults(): void {
    // Add a default API key for development if none configured
    if (this.config.type === 'api_key' && this.validApiKeys.size === 0) {
      const defaultApiKey = process.env.DEFAULT_API_KEY || 'default-dev-key';
      this.validApiKeys.add(defaultApiKey);
    }

    // Setup periodic cleanup of expired sessions
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60000); // Clean up every minute
  }

  /**
   * Gets authentication statistics for monitoring
   */
  getAuthStats(): {
    type: string;
    activeApiKeys: number;
    activeSessions: number;
    enabled: boolean;
  } {
    return {
      type: this.config.type,
      activeApiKeys: this.validApiKeys.size,
      activeSessions: this.activeSessions.size,
      enabled: this.config.enabled
    };
  }

  /**
   * Checks if a user has specific permissions
   */
  hasPermission(user: User, permission: string): boolean {
    return user.permissions.includes(permission) || user.permissions.includes('*');
  }

  /**
   * Requires specific permissions (middleware helper)
   */
  requirePermission(permission: string) {
    return (request: any, response: any, next: any) => {
      if (!request.user) {
        return this.sendAuthenticationError(response, 'Authentication required');
      }

      if (!this.hasPermission(request.user, permission)) {
        return response.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: `Permission required: ${permission}`,
            retryable: false,
            timestamp: new Date().toISOString()
          }
        });
      }

      next();
    };
  }
}
