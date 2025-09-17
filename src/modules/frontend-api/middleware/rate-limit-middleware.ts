/**
 * Rate Limit Middleware Implementation
 * Handles request rate limiting to prevent abuse
 */

import { v4 as uuidv4 } from 'uuid';
import {
  StandardError,
  ErrorCategory,
  ErrorSeverity,
  ERROR_CODES
} from '../../../../types/shared-types';
import {
  RateLimitMiddleware,
  RateLimitConfig
} from '../types';

interface RateLimitWindow {
  requests: number;
  windowStart: number;
  resetTime: number;
}

interface SessionLimit {
  sessionCount: number;
  sessions: Set<string>;
  lastReset: number;
}

export class RateLimitMiddlewareImpl implements RateLimitMiddleware {
  private config: RateLimitConfig;
  private requestWindows: Map<string, RateLimitWindow> = new Map();
  private sessionLimits: Map<string, SessionLimit> = new Map();
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.startCleanupTimer();
  }

  /**
   * Express middleware function for rate limiting
   */
  checkRequestLimit = async (request: any, response: any, next: any): Promise<void> => {
    try {
      const key = this.config.keyGenerator(request);
      const now = Date.now();

      // Get or create rate limit window
      let window = this.requestWindows.get(key);
      if (!window || now >= window.resetTime) {
        window = {
          requests: 0,
          windowStart: now,
          resetTime: now + this.config.windowMs
        };
        this.requestWindows.set(key, window);
      }

      // Check if limit exceeded
      if (window.requests >= this.config.maxRequests) {
        return this.sendRateLimitError(response, window);
      }

      // Increment request count (skip if configured to do so for successful requests)
      if (!this.config.skipSuccessfulRequests) {
        window.requests++;
      } else {
        // We'll increment after the response if it's successful
        response.on('finish', () => {
          if (response.statusCode < 400) {
            window.requests++;
          }
        });
        window.requests++; // Increment now for failed requests
      }

      // Add rate limit headers
      this.addRateLimitHeaders(response, window);

      next();
    } catch (error) {
      // Don't block requests due to rate limit errors, just log and continue
      console.error('Rate limit middleware error:', error);
      next();
    }
  };

  /**
   * Checks session-based rate limiting for concurrent sessions
   */
  async checkSessionLimit(userId: string): Promise<boolean> {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    // Get or create session limit tracking
    let sessionLimit = this.sessionLimits.get(userId);
    if (!sessionLimit || now - sessionLimit.lastReset > oneHour) {
      sessionLimit = {
        sessionCount: 0,
        sessions: new Set(),
        lastReset: now
      };
      this.sessionLimits.set(userId, sessionLimit);
    }

    // Check if user has exceeded concurrent session limit
    return sessionLimit.sessionCount < this.config.maxConcurrentSessions;
  }

  /**
   * Registers a new session for a user
   */
  registerSession(userId: string, sessionId: string): boolean {
    const sessionLimit = this.sessionLimits.get(userId);
    if (!sessionLimit) {
      // Create new session limit if it doesn't exist
      this.sessionLimits.set(userId, {
        sessionCount: 1,
        sessions: new Set([sessionId]),
        lastReset: Date.now()
      });
      return true;
    }

    if (sessionLimit.sessionCount >= this.config.maxConcurrentSessions) {
      return false;
    }

    sessionLimit.sessions.add(sessionId);
    sessionLimit.sessionCount = sessionLimit.sessions.size;
    return true;
  }

  /**
   * Unregisters a session for a user
   */
  unregisterSession(userId: string, sessionId: string): void {
    const sessionLimit = this.sessionLimits.get(userId);
    if (sessionLimit) {
      sessionLimit.sessions.delete(sessionId);
      sessionLimit.sessionCount = sessionLimit.sessions.size;
    }
  }

  /**
   * Gets current rate limit status for a key
   */
  getRateLimitStatus(key: string): {
    requests: number;
    maxRequests: number;
    remaining: number;
    resetTime: number;
    windowMs: number;
  } | null {
    const window = this.requestWindows.get(key);
    if (!window) {
      return null;
    }

    return {
      requests: window.requests,
      maxRequests: this.config.maxRequests,
      remaining: Math.max(0, this.config.maxRequests - window.requests),
      resetTime: window.resetTime,
      windowMs: this.config.windowMs
    };
  }

  /**
   * Gets session limit status for a user
   */
  getSessionLimitStatus(userId: string): {
    activeSessions: number;
    maxSessions: number;
    remaining: number;
  } {
    const sessionLimit = this.sessionLimits.get(userId);
    const activeSessions = sessionLimit ? sessionLimit.sessionCount : 0;

    return {
      activeSessions,
      maxSessions: this.config.maxConcurrentSessions,
      remaining: Math.max(0, this.config.maxConcurrentSessions - activeSessions)
    };
  }

  /**
   * Resets rate limit for a specific key (admin function)
   */
  resetRateLimit(key: string): void {
    this.requestWindows.delete(key);
  }

  /**
   * Resets session limit for a specific user (admin function)
   */
  resetSessionLimit(userId: string): void {
    this.sessionLimits.delete(userId);
  }

  /**
   * Gets rate limiting statistics
   */
  getStats(): {
    activeWindows: number;
    activeSessionLimits: number;
    totalRequests: number;
    rateLimitHits: number;
  } {
    let totalRequests = 0;
    let rateLimitHits = 0;

    for (const window of this.requestWindows.values()) {
      totalRequests += window.requests;
      if (window.requests >= this.config.maxRequests) {
        rateLimitHits++;
      }
    }

    return {
      activeWindows: this.requestWindows.size,
      activeSessionLimits: this.sessionLimits.size,
      totalRequests,
      rateLimitHits
    };
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private sendRateLimitError(response: any, window: RateLimitWindow): void {
    const error: StandardError = {
      id: uuidv4(),
      category: ErrorCategory.SYSTEM,
      severity: ErrorSeverity.MEDIUM,
      code: ERROR_CODES.FRONTEND_API.RATE_LIMIT_EXCEEDED,
      message: 'Rate limit exceeded',
      details: {
        maxRequests: this.config.maxRequests,
        windowMs: this.config.windowMs,
        resetTime: window.resetTime,
        retryAfter: Math.ceil((window.resetTime - Date.now()) / 1000)
      },
      timestamp: new Date(),
      moduleId: 'frontend-api',
      recoverable: true,
      retryable: true,
      suggestedAction: 'Wait for rate limit window to reset before retrying'
    };

    // Add rate limit headers
    this.addRateLimitHeaders(response, window);
    response.setHeader('Retry-After', Math.ceil((window.resetTime - Date.now()) / 1000));

    response.status(429).json({
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

  private addRateLimitHeaders(response: any, window: RateLimitWindow): void {
    const remaining = Math.max(0, this.config.maxRequests - window.requests);
    const resetTimeSeconds = Math.ceil(window.resetTime / 1000);

    response.setHeader('X-RateLimit-Limit', this.config.maxRequests);
    response.setHeader('X-RateLimit-Remaining', remaining);
    response.setHeader('X-RateLimit-Reset', resetTimeSeconds);
    response.setHeader('X-RateLimit-Window', this.config.windowMs);
  }

  private startCleanupTimer(): void {
    // Clean up expired windows every 5 minutes
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredWindows();
    }, 5 * 60 * 1000);
  }

  private cleanupExpiredWindows(): void {
    const now = Date.now();
    
    // Clean up expired request windows
    for (const [key, window] of this.requestWindows.entries()) {
      if (now >= window.resetTime + this.config.windowMs) {
        this.requestWindows.delete(key);
      }
    }

    // Clean up old session limits (older than 24 hours)
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    for (const [userId, sessionLimit] of this.sessionLimits.entries()) {
      if (sessionLimit.lastReset < oneDayAgo && sessionLimit.sessionCount === 0) {
        this.sessionLimits.delete(userId);
      }
    }
  }

  /**
   * Creates a rate limit bypass for specific keys (admin function)
   */
  addBypass(key: string, durationMs: number = 60000): void {
    // Set a very high limit for the key temporarily
    const window: RateLimitWindow = {
      requests: 0,
      windowStart: Date.now(),
      resetTime: Date.now() + durationMs
    };
    this.requestWindows.set(`bypass_${key}`, window);
  }

  /**
   * Removes a rate limit bypass
   */
  removeBypass(key: string): void {
    this.requestWindows.delete(`bypass_${key}`);
  }

  /**
   * Checks if a key has an active bypass
   */
  hasBypass(key: string): boolean {
    const bypassWindow = this.requestWindows.get(`bypass_${key}`);
    if (!bypassWindow) {
      return false;
    }

    if (Date.now() >= bypassWindow.resetTime) {
      this.requestWindows.delete(`bypass_${key}`);
      return false;
    }

    return true;
  }

  /**
   * Applies dynamic rate limiting based on system load
   */
  applyDynamicLimits(loadFactor: number): void {
    // Adjust limits based on system load (0.0 to 1.0)
    // When load is high, reduce rate limits
    const adjustedMaxRequests = Math.floor(this.config.maxRequests * (1 - loadFactor * 0.5));
    
    // Update the config temporarily
    this.config = {
      ...this.config,
      maxRequests: Math.max(1, adjustedMaxRequests)
    };
  }

  /**
   * Restores original rate limits
   */
  restoreOriginalLimits(originalConfig: RateLimitConfig): void {
    this.config = { ...originalConfig };
  }

  /**
   * Destructor to clean up timers
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }
}
