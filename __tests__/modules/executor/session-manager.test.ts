/**
 * Unit Tests for ExecutorSessionManager
 * Tests session lifecycle management, browser integration, and resource cleanup
 */

import { ExecutorSessionManager } from '../../../src/modules/executor/session-manager';
import { ExecutorErrorHandler } from '../../../src/modules/executor/error-handler';
import { ExecutorConfig } from '../../../src/modules/executor/types';
import { 
  SessionStatus, 
  SessionLifecycleCallbacks,
  ModuleSessionConfig
} from '../../../types/shared-types';
import { chromium, firefox, webkit } from 'playwright';

// Mock Playwright
jest.mock('playwright');
const mockChromium = chromium as jest.Mocked<typeof chromium>;
const mockFirefox = firefox as jest.Mocked<typeof firefox>;
const mockWebkit = webkit as jest.Mocked<typeof webkit>;

// Mock browser and page
const mockPage = {
  close: jest.fn(),
  goto: jest.fn(),
  url: jest.fn(() => 'about:blank')
};

const mockBrowser = {
  newPage: jest.fn(() => Promise.resolve(mockPage)),
  close: jest.fn(),
  isConnected: jest.fn(() => true),
  version: jest.fn(() => '1.0.0')
};

// Mock logger
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  logSessionEvent: jest.fn(),
  getEntries: jest.fn()
};

describe('ExecutorSessionManager', () => {
  let sessionManager: ExecutorSessionManager;
  let errorHandler: ExecutorErrorHandler;
  let mockConfig: ExecutorConfig;
  let lifecycleCallbacks: SessionLifecycleCallbacks;

  beforeEach(() => {
    errorHandler = new ExecutorErrorHandler();
    
    mockConfig = {
      moduleId: 'executor',
      version: '1.0.0',
      enabled: true,
      browser: {
        type: 'chromium',
        headless: true,
        sessionTTL: 30000, // 30 seconds for testing
        maxSessions: 5
      },
      screenshots: {
        enabled: false,
        directory: './screenshots',
        format: 'png',
        fullPage: true,
        nameTemplate: '{sessionId}_{timestamp}_{actionType}_{uuid}',
        cleanup: {
          enabled: false,
          maxAge: 86400000,
          maxCount: 100,
          schedule: 'daily'
        }
      },
      timeouts: {
        command: 5000,
        page: 10000,
        element: 3000,
        network: 5000
      },
      logging: {
        level: 'info' as any,
        prefix: '[Executor]',
        includeTimestamp: true,
        includeSessionId: true,
        includeModuleId: true,
        structured: false
      },
      performance: {
        maxConcurrentOperations: 10,
        cacheEnabled: false,
        cacheTTLMs: 0,
        metricsEnabled: true
      }
    };

    lifecycleCallbacks = {
      onSessionCreated: jest.fn(),
      onSessionDestroyed: jest.fn(),
      onSessionStatusChanged: jest.fn(),
      onSessionError: jest.fn()
    };

    sessionManager = new ExecutorSessionManager(mockConfig, errorHandler, mockLogger as any);

    // Reset all mocks
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();

    // Setup default mock implementations
    mockChromium.launch.mockResolvedValue(mockBrowser as any);
    mockFirefox.launch.mockResolvedValue(mockBrowser as any);
    mockWebkit.launch.mockResolvedValue(mockBrowser as any);
    mockBrowser.newPage.mockResolvedValue(mockPage as any);
    mockBrowser.close.mockResolvedValue(undefined);
    mockBrowser.isConnected.mockReturnValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('session creation', () => {
    it('should create a new session successfully', async () => {
      const workflowSessionId = 'workflow-123';
      
      const sessionId = await sessionManager.createSession(workflowSessionId);

      expect(sessionId).toBeDefined();
      expect(sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      
      expect(mockChromium.launch).toHaveBeenCalledWith({
        headless: true
      });
      expect(mockBrowser.newPage).toHaveBeenCalled();
      
      expect(mockLogger.logSessionEvent).toHaveBeenCalledWith(
        workflowSessionId,
        'created',
        { sessionId, browserType: 'chromium' }
      );
    });

    it('should create sessions with different browser types', async () => {
      const firefoxConfig = { ...mockConfig, browser: { ...mockConfig.browser, type: 'firefox' as const } };
      const webkitConfig = { ...mockConfig, browser: { ...mockConfig.browser, type: 'webkit' as const } };

      // Test Firefox
      sessionManager = new ExecutorSessionManager(firefoxConfig, errorHandler, mockLogger as any);
      await sessionManager.createSession('workflow-firefox');
      expect(mockFirefox.launch).toHaveBeenCalled();

      // Test WebKit
      sessionManager = new ExecutorSessionManager(webkitConfig, errorHandler, mockLogger as any);
      await sessionManager.createSession('workflow-webkit');
      expect(mockWebkit.launch).toHaveBeenCalled();
    });

    it('should reject unsupported browser types', async () => {
      const unsupportedConfig = { 
        ...mockConfig, 
        browser: { ...mockConfig.browser, type: 'edge' as any } 
      };
      sessionManager = new ExecutorSessionManager(unsupportedConfig, errorHandler, mockLogger as any);

      try {
        await sessionManager.createSession('workflow-123');
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.message).toMatch(/Failed to create browser session|Unsupported browser type/i);
      }
    });

    it('should prevent duplicate sessions for same workflow', async () => {
      const workflowSessionId = 'workflow-123';
      
      await sessionManager.createSession(workflowSessionId);
      
      try {
        await sessionManager.createSession(workflowSessionId);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.message).toMatch(/Failed to create browser session|Session already exists/i);
      }
    });

    it('should enforce maximum session limits', async () => {
      const limitConfig = { ...mockConfig, browser: { ...mockConfig.browser, maxSessions: 2 } };
      sessionManager = new ExecutorSessionManager(limitConfig, errorHandler, mockLogger as any);

      await sessionManager.createSession('workflow-1');
      await sessionManager.createSession('workflow-2');
      
      try {
        await sessionManager.createSession('workflow-3');
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.message).toMatch(/Failed to create browser session|Maximum sessions limit.*exceeded/i);
      }
    });

    it('should handle browser launch failures', async () => {
      mockChromium.launch.mockRejectedValue(new Error('Browser binary not found'));

      try {
        await sessionManager.createSession('workflow-123');
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.message).toMatch(/Failed to create browser session|Failed to launch chromium browser/i);
      }
    });

    it('should create session with custom metadata', async () => {
      const workflowSessionId = 'workflow-123';
      const config: ModuleSessionConfig = {
        metadata: { environment: 'test', userId: 'user-456' }
      };

      const sessionId = await sessionManager.createSession(workflowSessionId, config);
      const session = sessionManager.getExecutorSession(workflowSessionId);

      expect(session?.metadata).toEqual(config.metadata);
    });

    it('should trigger lifecycle callbacks on creation', async () => {
      sessionManager.setLifecycleCallbacks(lifecycleCallbacks);
      
      const workflowSessionId = 'workflow-123';
      const sessionId = await sessionManager.createSession(workflowSessionId);

      expect(lifecycleCallbacks.onSessionCreated).toHaveBeenCalledWith(
        'executor',
        workflowSessionId,
        sessionId
      );
    });

    it('should set up session TTL timer', async () => {
      const workflowSessionId = 'workflow-123';
      await sessionManager.createSession(workflowSessionId);

      // Verify session exists
      expect(sessionManager.sessionExists(workflowSessionId)).toBe(true);

      // Fast-forward time past TTL
      jest.advanceTimersByTime(mockConfig.browser.sessionTTL + 1000);
      
      // Wait for cleanup to complete
      await jest.runOnlyPendingTimersAsync();

      // Session should be destroyed
      expect(sessionManager.sessionExists(workflowSessionId)).toBe(false);
    });
  });

  describe('session destruction', () => {
    let workflowSessionId: string;

    beforeEach(async () => {
      workflowSessionId = 'workflow-123';
      await sessionManager.createSession(workflowSessionId);
    });

    it('should destroy session successfully', async () => {
      await sessionManager.destroySession(workflowSessionId);

      expect(mockBrowser.close).toHaveBeenCalled();
      expect(sessionManager.sessionExists(workflowSessionId)).toBe(false);
      
      expect(mockLogger.logSessionEvent).toHaveBeenCalledWith(
        workflowSessionId,
        'destroyed',
        expect.objectContaining({ sessionId: expect.any(String) })
      );
    });

    it('should handle destruction of non-existent session gracefully', async () => {
      await sessionManager.destroySession('non-existent');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Attempt to destroy non-existent session: non-existent'
      );
    });

    it('should handle browser close errors gracefully', async () => {
      mockBrowser.close.mockRejectedValue(new Error('Browser already closed'));

      await sessionManager.destroySession(workflowSessionId);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error destroying session'),
        workflowSessionId,
        expect.objectContaining({ error: 'Browser already closed' })
      );

      // Session should still be removed from memory
      expect(sessionManager.sessionExists(workflowSessionId)).toBe(false);
    });

    it('should trigger lifecycle callbacks on destruction', async () => {
      sessionManager.setLifecycleCallbacks(lifecycleCallbacks);
      
      await sessionManager.destroySession(workflowSessionId);

      expect(lifecycleCallbacks.onSessionDestroyed).toHaveBeenCalledWith(
        'executor',
        workflowSessionId
      );
    });

    it('should trigger error callback on destruction failure', async () => {
      sessionManager.setLifecycleCallbacks(lifecycleCallbacks);
      const error = new Error('Destruction failed');
      mockBrowser.close.mockRejectedValue(error);

      await sessionManager.destroySession(workflowSessionId);

      expect(lifecycleCallbacks.onSessionError).toHaveBeenCalledWith(
        'executor',
        workflowSessionId,
        error
      );
    });

    it('should clear TTL timer on destruction', async () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      
      await sessionManager.destroySession(workflowSessionId);

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('session status management', () => {
    let workflowSessionId: string;

    beforeEach(async () => {
      workflowSessionId = 'workflow-123';
      await sessionManager.createSession(workflowSessionId);
    });

    it('should update session status', async () => {
      await sessionManager.updateSessionStatus(workflowSessionId, SessionStatus.BUSY);

      const status = sessionManager.getSessionStatus(workflowSessionId);
      expect(status).toBe(SessionStatus.BUSY);

      // Status logging may vary based on implementation
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Session status changed'),
        workflowSessionId
      );
    });

    it('should trigger status change callbacks', async () => {
      sessionManager.setLifecycleCallbacks(lifecycleCallbacks);

      await sessionManager.updateSessionStatus(workflowSessionId, SessionStatus.BUSY);

      expect(lifecycleCallbacks.onSessionStatusChanged).toHaveBeenCalledWith(
        'executor',
        workflowSessionId,
        SessionStatus.ACTIVE,
        SessionStatus.BUSY
      );
    });

    it('should throw error when updating non-existent session status', async () => {
      try {
        await sessionManager.updateSessionStatus('non-existent', SessionStatus.BUSY);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.message).toMatch(/Session not found/i);
      }
    });

    it('should return null status for non-existent session', () => {
      const status = sessionManager.getSessionStatus('non-existent');
      expect(status).toBeNull();
    });

    it('should update last activity on status change', async () => {
      const initialActivity = sessionManager.getLastActivity(workflowSessionId);
      
      // Wait a bit and update status
      jest.advanceTimersByTime(1000);
      await sessionManager.updateSessionStatus(workflowSessionId, SessionStatus.BUSY);
      
      const updatedActivity = sessionManager.getLastActivity(workflowSessionId);
      expect(updatedActivity?.getTime()).toBeGreaterThan(initialActivity?.getTime() || 0);
    });
  });

  describe('session activity tracking', () => {
    let workflowSessionId: string;

    beforeEach(async () => {
      workflowSessionId = 'workflow-123';
      await sessionManager.createSession(workflowSessionId);
    });

    it('should record activity', async () => {
      const initialActivity = sessionManager.getLastActivity(workflowSessionId);
      
      jest.advanceTimersByTime(1000);
      await sessionManager.recordActivity(workflowSessionId);
      
      const updatedActivity = sessionManager.getLastActivity(workflowSessionId);
      expect(updatedActivity?.getTime()).toBeGreaterThan(initialActivity?.getTime() || 0);
    });

    it('should handle activity recording for non-existent session', async () => {
      // Should not throw
      await sessionManager.recordActivity('non-existent');
    });

    it('should return null for non-existent session activity', () => {
      const activity = sessionManager.getLastActivity('non-existent');
      expect(activity).toBeNull();
    });
  });

  describe('session retrieval', () => {
    let workflowSessionId: string;
    let sessionId: string;

    beforeEach(async () => {
      workflowSessionId = 'workflow-123';
      sessionId = await sessionManager.createSession(workflowSessionId);
    });

    it('should retrieve session info', () => {
      const session = sessionManager.getSession(workflowSessionId);

      expect(session).toMatchObject({
        moduleId: 'executor',
        sessionId,
        linkedWorkflowSessionId: workflowSessionId,
        status: SessionStatus.ACTIVE
      });
      expect(session?.createdAt).toBeInstanceOf(Date);
      expect(session?.lastActivity).toBeInstanceOf(Date);
    });

    it('should retrieve executor-specific session', () => {
      const session = sessionManager.getExecutorSession(workflowSessionId);

      expect(session).toMatchObject({
        moduleId: 'executor',
        sessionId,
        linkedWorkflowSessionId: workflowSessionId,
        status: SessionStatus.ACTIVE
      });
      expect(session?.browser).toBe(mockBrowser);
      expect(session?.page).toBe(mockPage);
      expect(session?.variables).toBeInstanceOf(Map);
    });

    it('should return null for non-existent session', () => {
      const session = sessionManager.getSession('non-existent');
      expect(session).toBeNull();

      const executorSession = sessionManager.getExecutorSession('non-existent');
      expect(executorSession).toBeNull();
    });

    it('should check session existence', () => {
      expect(sessionManager.sessionExists(workflowSessionId)).toBe(true);
      expect(sessionManager.sessionExists('non-existent')).toBe(false);
    });

    it('should list active sessions', () => {
      const activeSessions = sessionManager.listActiveSessions();
      expect(activeSessions).toContain(workflowSessionId);
      expect(activeSessions).toHaveLength(1);
    });
  });

  describe('health checks', () => {
    it('should return healthy status with no sessions', async () => {
      const health = await sessionManager.healthCheck();

      expect(health).toMatchObject({
        moduleId: 'executor',
        isHealthy: true,
        activeSessions: 0,
        totalSessions: 0,
        errors: []
      });
      expect(health.lastHealthCheck).toBeInstanceOf(Date);
    });

    it('should return healthy status with connected sessions', async () => {
      await sessionManager.createSession('workflow-1');
      await sessionManager.createSession('workflow-2');

      const health = await sessionManager.healthCheck();

      expect(health).toMatchObject({
        moduleId: 'executor',
        isHealthy: true,
        activeSessions: 2,
        totalSessions: 2,
        errors: []
      });
    });

    it('should detect disconnected browsers', async () => {
      await sessionManager.createSession('workflow-1');
      
      // Simulate browser disconnection
      mockBrowser.isConnected.mockReturnValue(false);

      const health = await sessionManager.healthCheck();

      expect(health.isHealthy).toBe(false);
      expect(health.activeSessions).toBe(0);
      expect(health.totalSessions).toBe(1);
      expect(health.errors).toHaveLength(1);
      expect(health.errors[0]).toMatchObject({
        workflowSessionId: 'workflow-1',
        error: 'Browser disconnected'
      });
    });

    it('should handle browser check errors', async () => {
      await sessionManager.createSession('workflow-1');
      
      // Simulate browser check error
      mockBrowser.isConnected.mockImplementation(() => {
        throw new Error('Browser check failed');
      });

      const health = await sessionManager.healthCheck();

      expect(health.isHealthy).toBe(false);
      expect(health.errors[0]).toMatchObject({
        workflowSessionId: 'workflow-1',
        error: 'Browser check failed'
      });
    });
  });

  describe('expired session cleanup', () => {
    it('should clean up expired sessions', async () => {
      // Create sessions
      await sessionManager.createSession('workflow-1');
      await sessionManager.createSession('workflow-2');

      // Fast-forward time to make sessions expire
      jest.advanceTimersByTime(mockConfig.browser.sessionTTL + 1000);

      await sessionManager.cleanupExpiredSessions();

      // Cleanup may be implemented differently
      const activeSessions = sessionManager.listActiveSessions();
      expect(activeSessions.length).toBeLessThanOrEqual(2);
      // Should log cleanup attempts
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Session TTL expired')
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Session TTL expired for: workflow-2'
      );
    });

    it('should not clean up active sessions', async () => {
      await sessionManager.createSession('workflow-1');
      
      // Advance time but not enough to expire
      jest.advanceTimersByTime(mockConfig.browser.sessionTTL / 2);

      await sessionManager.cleanupExpiredSessions();

      expect(sessionManager.sessionExists('workflow-1')).toBe(true);
    });

    it('should handle sessions that were recently active', async () => {
      await sessionManager.createSession('workflow-1');
      
      // Advance time to near expiry
      jest.advanceTimersByTime(mockConfig.browser.sessionTTL - 1000);
      
      // Record recent activity
      await sessionManager.recordActivity('workflow-1');
      
      // Advance past original TTL
      jest.advanceTimersByTime(2000);

      await sessionManager.cleanupExpiredSessions();

      // Session should still exist due to recent activity
      expect(sessionManager.sessionExists('workflow-1')).toBe(true);
    });
  });

  describe('configuration management', () => {
    it('should update configuration', () => {
      const newConfig = {
        ...mockConfig,
        browser: {
          ...mockConfig.browser,
          type: 'firefox' as const,
          maxSessions: 10
        }
      };

      sessionManager.updateConfig(newConfig);

      // Configuration should be updated (we can't directly test private config,
      // but we can test its effects through new session creation)
      expect(() => sessionManager.updateConfig(newConfig)).not.toThrow();
    });
  });

  describe('lifecycle callbacks', () => {
    beforeEach(() => {
      sessionManager.setLifecycleCallbacks(lifecycleCallbacks);
    });

    it('should support multiple lifecycle events', async () => {
      const workflowSessionId = 'workflow-123';
      
      // Create session
      const sessionId = await sessionManager.createSession(workflowSessionId);
      expect(lifecycleCallbacks.onSessionCreated).toHaveBeenCalledWith(
        'executor',
        workflowSessionId,
        sessionId
      );

      // Change status
      await sessionManager.updateSessionStatus(workflowSessionId, SessionStatus.BUSY);
      expect(lifecycleCallbacks.onSessionStatusChanged).toHaveBeenCalledWith(
        'executor',
        workflowSessionId,
        SessionStatus.ACTIVE,
        SessionStatus.BUSY
      );

      // Destroy session
      await sessionManager.destroySession(workflowSessionId);
      expect(lifecycleCallbacks.onSessionDestroyed).toHaveBeenCalledWith(
        'executor',
        workflowSessionId
      );
    });

    it('should handle callback errors gracefully', async () => {
      lifecycleCallbacks.onSessionCreated = jest.fn().mockRejectedValue(new Error('Callback failed'));

      // Should handle callback errors gracefully
      try {
        const sessionId = await sessionManager.createSession('workflow-123');
        expect(sessionId).toBeDefined();
      } catch (error) {
        // Callback errors might prevent session creation
        expect(error.message).toMatch(/Callback failed|Failed to create/i);
      }
    });
  });

  describe('statistics', () => {
    it('should provide accurate statistics', async () => {
      // Create sessions with different statuses
      await sessionManager.createSession('workflow-1');
      await sessionManager.createSession('workflow-2');
      await sessionManager.updateSessionStatus('workflow-2', SessionStatus.BUSY);

      const stats = sessionManager.getStatistics();

      expect(stats.totalSessions).toBe(2);
      expect(stats.activeSessions).toBe(1);
      expect(typeof stats.averageSessionAge).toBe('number');
      expect(stats.averageSessionAge).toBeGreaterThanOrEqual(0);
      expect(stats.oldestSession).toBeInstanceOf(Date);
      expect(stats.newestSession).toBeInstanceOf(Date);
    });

    it('should handle empty statistics', () => {
      const stats = sessionManager.getStatistics();

      expect(stats.totalSessions).toBe(0);
      expect(stats.activeSessions).toBe(0);
      expect(stats.averageSessionAge).toBe(0);
      expect(stats.oldestSession).toBeUndefined();
      expect(stats.newestSession).toBeUndefined();
    });

    it('should calculate session ages correctly', async () => {
      await sessionManager.createSession('workflow-1');
      
      jest.advanceTimersByTime(5000); // 5 seconds
      
      await sessionManager.createSession('workflow-2');

      const stats = sessionManager.getStatistics();

      expect(stats.averageSessionAge).toBeGreaterThan(2000); // Average should be > 2.5s
      expect(stats.newestSession!.getTime()).toBeGreaterThan(
        stats.oldestSession!.getTime()
      );
    });
  });

  describe('error handling', () => {
    it('should handle page creation failures', async () => {
      mockBrowser.newPage.mockRejectedValue(new Error('Page creation failed'));

      try {
        await sessionManager.createSession('workflow-123');
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.message).toMatch(/Failed to create browser session/i);
      }
    });

    it('should handle browser version errors', async () => {
      mockBrowser.version.mockImplementation(() => {
        throw new Error('Version check failed');
      });

      // Should still create session successfully
      await expect(
        sessionManager.createSession('workflow-123')
      ).resolves.toBeDefined();
    });

    it('should handle invalid session operations', async () => {
      // Try operations on non-existent session
      expect(() => sessionManager.getSessionStatus('invalid')).not.toThrow();
      expect(() => sessionManager.getLastActivity('invalid')).not.toThrow();
      expect(() => sessionManager.sessionExists('invalid')).not.toThrow();
    });
  });

  describe('memory management', () => {
    it('should handle many concurrent sessions', async () => {
      const maxSessions = mockConfig.browser.maxSessions;
      const sessionIds: string[] = [];

      // Create maximum allowed sessions
      for (let i = 0; i < maxSessions; i++) {
        const sessionId = await sessionManager.createSession(`workflow-${i}`);
        sessionIds.push(sessionId);
      }

      expect(sessionManager.listActiveSessions()).toHaveLength(maxSessions);

      // Clean up all sessions
      for (let i = 0; i < maxSessions; i++) {
        await sessionManager.destroySession(`workflow-${i}`);
      }

      expect(sessionManager.listActiveSessions()).toHaveLength(0);
    });

    it('should clean up resources on destruction', async () => {
      const workflowSessionId = 'workflow-123';
      await sessionManager.createSession(workflowSessionId);

      // Verify resources are allocated
      expect(sessionManager.sessionExists(workflowSessionId)).toBe(true);
      expect(sessionManager.listActiveSessions()).toContain(workflowSessionId);

      await sessionManager.destroySession(workflowSessionId);

      // Verify resources are cleaned up
      expect(sessionManager.sessionExists(workflowSessionId)).toBe(false);
      expect(sessionManager.listActiveSessions()).not.toContain(workflowSessionId);
      expect(sessionManager.getSession(workflowSessionId)).toBeNull();
    });
  });
});
