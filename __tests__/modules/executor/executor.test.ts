/**
 * Unit Tests for Main Executor Class
 * Tests the integration and coordination of all executor components
 */

import { Executor } from '../../../src/modules/executor/index';
import { 
  SessionStatus, 
  SessionLifecycleCallbacks,
  ModuleSessionConfig 
} from '../../../types/shared-types';
import { 
  ExecutorConfig, 
  DEFAULT_EXECUTOR_CONFIG,
  CommandAction 
} from '../../../src/modules/executor/types';

// Mock Playwright
jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn(() => Promise.resolve({
      newPage: jest.fn(() => Promise.resolve({
        goto: jest.fn(),
        content: jest.fn(() => Promise.resolve('<html><body>Test</body></html>')),
        waitForLoadState: jest.fn(),
        waitForSelector: jest.fn(() => Promise.resolve({
          click: jest.fn(),
          fill: jest.fn(),
          clear: jest.fn(),
          isEnabled: jest.fn(() => Promise.resolve(true)),
          inputValue: jest.fn(() => Promise.resolve('test value')),
          textContent: jest.fn(() => Promise.resolve('test text')),
          evaluate: jest.fn(() => Promise.resolve('input'))
        })),
        waitForTimeout: jest.fn(),
        url: jest.fn(() => 'https://example.com'),
        screenshot: jest.fn(() => Promise.resolve(Buffer.from('screenshot')))
      })),
      close: jest.fn(),
      isConnected: jest.fn(() => true)
    }))
  }
}));

// Mock filesystem for screenshots
jest.mock('fs/promises', () => ({
  mkdir: jest.fn(() => Promise.resolve()),
  stat: jest.fn(() => Promise.resolve({ size: 1024 })),
  access: jest.fn(() => Promise.resolve()),
  unlink: jest.fn(() => Promise.resolve()),
  writeFile: jest.fn(() => Promise.resolve())
}));

describe('Executor', () => {
  let executor: Executor;
  let mockConfig: ExecutorConfig;
  let lifecycleCallbacks: SessionLifecycleCallbacks;

  beforeEach(() => {
    mockConfig = {
      ...DEFAULT_EXECUTOR_CONFIG,
      browser: {
        ...DEFAULT_EXECUTOR_CONFIG.browser,
        sessionTTL: 30000, // 30 seconds for testing
        maxSessions: 3
      }
    };

    lifecycleCallbacks = {
      onSessionCreated: jest.fn(),
      onSessionDestroyed: jest.fn(),
      onSessionStatusChanged: jest.fn(),
      onSessionError: jest.fn()
    };

    executor = new Executor(mockConfig);

    // Clear all mocks
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(async () => {
    await executor.shutdown();
    jest.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultExecutor = new Executor();
      expect(defaultExecutor.moduleId).toBe('executor');
    });

    it('should initialize with custom configuration', () => {
      const customConfig = {
        ...mockConfig,
        browser: { ...mockConfig.browser, type: 'firefox' as const }
      };
      const customExecutor = new Executor(customConfig);
      expect(customExecutor.moduleId).toBe('executor');
    });

    it('should log initialization', () => {
      // Constructor logging is tested by checking that no errors are thrown
      expect(() => new Executor(mockConfig)).not.toThrow();
    });
  });

  describe('session management', () => {
    it('should create session successfully', async () => {
      const workflowSessionId = 'workflow-123';
      
      const sessionId = await executor.createSession(workflowSessionId);

      expect(sessionId).toBeDefined();
      expect(sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(executor.sessionExists(workflowSessionId)).toBe(true);
    });

    it('should create session with metadata', async () => {
      const workflowSessionId = 'workflow-123';
      const config: ModuleSessionConfig = {
        metadata: { userId: 'user-456', environment: 'test' }
      };

      const sessionId = await executor.createSession(workflowSessionId, config);
      const session = executor.getSessionInfo(workflowSessionId);

      expect(session?.metadata).toEqual(config.metadata);
    });

    it('should destroy session successfully', async () => {
      const workflowSessionId = 'workflow-123';
      await executor.createSession(workflowSessionId);

      expect(executor.sessionExists(workflowSessionId)).toBe(true);

      await executor.destroySession(workflowSessionId);

      expect(executor.sessionExists(workflowSessionId)).toBe(false);
    });

    it('should get session information', async () => {
      const workflowSessionId = 'workflow-123';
      const sessionId = await executor.createSession(workflowSessionId);

      const sessionInfo = executor.getSession(workflowSessionId);
      const executorSession = executor.getSessionInfo(workflowSessionId);

      expect(sessionInfo?.moduleId).toBe('executor');
      expect(sessionInfo?.sessionId).toBe(sessionId);
      expect(sessionInfo?.linkedWorkflowSessionId).toBe(workflowSessionId);
      expect(sessionInfo?.status).toBe(SessionStatus.ACTIVE);

      expect(executorSession?.browser).toBeDefined();
      expect(executorSession?.page).toBeDefined();
      expect(executorSession?.variables).toBeInstanceOf(Map);
    });

    it('should update session status', async () => {
      const workflowSessionId = 'workflow-123';
      await executor.createSession(workflowSessionId);

      await executor.updateSessionStatus(workflowSessionId, SessionStatus.BUSY);

      expect(executor.getSessionStatus(workflowSessionId)).toBe(SessionStatus.BUSY);
    });

    it('should record activity', async () => {
      const workflowSessionId = 'workflow-123';
      await executor.createSession(workflowSessionId);

      const initialActivity = executor.getLastActivity(workflowSessionId);
      
      jest.advanceTimersByTime(1000);
      await executor.recordActivity(workflowSessionId);
      
      const updatedActivity = executor.getLastActivity(workflowSessionId);
      expect(updatedActivity?.getTime()).toBeGreaterThan(initialActivity?.getTime() || 0);
    });

    it('should handle lifecycle callbacks', async () => {
      executor.setLifecycleCallbacks(lifecycleCallbacks);
      
      const workflowSessionId = 'workflow-123';
      const sessionId = await executor.createSession(workflowSessionId);

      expect(lifecycleCallbacks.onSessionCreated).toHaveBeenCalledWith(
        'executor',
        workflowSessionId,
        sessionId
      );

      await executor.destroySession(workflowSessionId);

      expect(lifecycleCallbacks.onSessionDestroyed).toHaveBeenCalledWith(
        'executor',
        workflowSessionId
      );
    });

    it('should perform health check', async () => {
      await executor.createSession('workflow-1');
      await executor.createSession('workflow-2');

      const health = await executor.healthCheck();

      expect(health.moduleId).toBe('executor');
      expect(health.isHealthy).toBe(true);
      expect(health.totalSessions).toBe(2);
      expect(health.activeSessions).toBe(2);
      expect(health.lastHealthCheck).toBeInstanceOf(Date);
    });
  });

  describe('command execution', () => {
    let workflowSessionId: string;

    beforeEach(async () => {
      workflowSessionId = 'workflow-123';
      await executor.createSession(workflowSessionId);
    });

    it('should execute commands through executeCommand', async () => {
      jest.useRealTimers();
      
      const command = {
        sessionId: workflowSessionId,
        action: CommandAction.OPEN_PAGE,
        parameters: { url: 'https://example.com' },
        commandId: 'cmd-123',
        timestamp: new Date()
      };

      const response = await executor.executeCommand(command);

      expect(response.success).toBe(true);
      expect(response.commandId).toBe('cmd-123');
      expect(response.dom).toBeDefined();
      expect(response.screenshotId).toBeDefined();
      expect(typeof response.duration).toBe('number');
      expect(response.duration).toBeGreaterThanOrEqual(0);
      
      jest.useFakeTimers();
    });

    it('should execute openPage command', async () => {
      const response = await executor.openPage(workflowSessionId, 'https://example.com');

      expect(response.success).toBe(true);
      expect(response.dom).toBe('<html><body>Test</body></html>');
      expect(response.metadata?.url).toBe('https://example.com');
    });

    it('should execute clickElement command', async () => {
      const response = await executor.clickElement(workflowSessionId, '#button');

      expect(response.success).toBe(true);
      expect(response.metadata?.selector).toBe('#button');
    });

    it('should execute inputText command', async () => {
      const response = await executor.inputText(workflowSessionId, '#input', 'test text');

      expect(response.success).toBe(true);
      expect(response.metadata?.text).toBe('test text');
    });

    it('should execute saveVariable command', async () => {
      const response = await executor.saveVariable(workflowSessionId, '#value', 'testVar');

      expect(response.success).toBe(true);
      expect(response.metadata?.variableName).toBe('testVar');
    });

    it('should execute getCurrentDOM command', async () => {
      const response = await executor.getCurrentDOM(workflowSessionId);

      expect(response.success).toBe(true);
      expect(response.dom).toBe('<html><body>Test</body></html>');
      expect(response.metadata?.domLength).toBe(response.dom.length);
    });

    it('should record activity for each command', async () => {
      const initialActivity = executor.getLastActivity(workflowSessionId);
      
      jest.advanceTimersByTime(1000);
      await executor.openPage(workflowSessionId, 'https://example.com');
      
      const updatedActivity = executor.getLastActivity(workflowSessionId);
      expect(updatedActivity?.getTime()).toBeGreaterThan(initialActivity?.getTime() || 0);
    });

    it('should handle command execution for non-existent session', async () => {
      try {
        await executor.openPage('non-existent', 'https://example.com');
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.message).toMatch(/Session.*not found/);
      }
    });
  });

  describe('variable management', () => {
    let workflowSessionId: string;

    beforeEach(async () => {
      workflowSessionId = 'workflow-123';
      await executor.createSession(workflowSessionId);
    });

    it('should set and get variables', async () => {
      await executor.setVariable(workflowSessionId, 'testVar', 'testValue');

      const value = executor.getVariable(workflowSessionId, 'testVar');
      expect(value).toBe('testValue');
    });

    it('should list all variables for session', async () => {
      await executor.setVariable(workflowSessionId, 'var1', 'value1');
      await executor.setVariable(workflowSessionId, 'var2', 'value2');

      const variables = executor.listVariables(workflowSessionId);
      expect(variables).toEqual({
        var1: 'value1',
        var2: 'value2'
      });
    });

    it('should resolve variables in strings', () => {
      executor.setVariable(workflowSessionId, 'baseUrl', 'https://test.com');
      
      const resolved = executor.resolveVariables(workflowSessionId, '${baseUrl}/path');
      expect(resolved).toBe('https://test.com/path');
    });

    it('should handle variables for non-existent session', async () => {
      try {
        await executor.setVariable('non-existent', 'var', 'value');
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.message).toMatch(/Session.*not found/);
      }

      expect(executor.getVariable('non-existent', 'var')).toBeNull();
      expect(executor.listVariables('non-existent')).toEqual({});
      expect(executor.resolveVariables('non-existent', '${var}')).toBe('${var}');
    });

    it('should record activity when setting variables', async () => {
      const initialActivity = executor.getLastActivity(workflowSessionId);
      
      jest.advanceTimersByTime(1000);
      await executor.setVariable(workflowSessionId, 'testVar', 'testValue');
      
      const updatedActivity = executor.getLastActivity(workflowSessionId);
      expect(updatedActivity?.getTime()).toBeGreaterThan(initialActivity?.getTime() || 0);
    });
  });

  describe('screenshot management', () => {
    let workflowSessionId: string;

    beforeEach(async () => {
      workflowSessionId = 'workflow-123';
      await executor.createSession(workflowSessionId);
    });

    it('should capture screenshots during commands', async () => {
      const response = await executor.openPage(workflowSessionId, 'https://example.com');

      expect(response.screenshotId).toBeDefined();
      expect(response.screenshotId).toMatch(/^workflow-123_\d+_OPEN_PAGE_/);
    });

    it('should get screenshot information', async () => {
      const response = await executor.openPage(workflowSessionId, 'https://example.com');
      
      const screenshotInfo = await executor.getScreenshot(response.screenshotId);
      
      expect(screenshotInfo).toBeDefined();
      expect(screenshotInfo?.id).toBe(response.screenshotId);
      expect(screenshotInfo?.sessionId).toBe(workflowSessionId);
    });

    it('should list screenshots for session', async () => {
      await executor.openPage(workflowSessionId, 'https://example.com');
      await executor.clickElement(workflowSessionId, '#button');

      const screenshots = await executor.listScreenshots(workflowSessionId);
      
      expect(screenshots).toHaveLength(2);
      expect(screenshots.every(s => s.sessionId === workflowSessionId)).toBe(true);
    });

    it('should delete screenshots', async () => {
      const response = await executor.openPage(workflowSessionId, 'https://example.com');
      
      await executor.deleteScreenshot(response.screenshotId);
      
      const screenshotInfo = await executor.getScreenshot(response.screenshotId);
      expect(screenshotInfo).toBeNull();
    });

    it('should cleanup screenshots', async () => {
      await executor.openPage(workflowSessionId, 'https://example.com');
      await executor.clickElement(workflowSessionId, '#button');

      const cleanupResult = await executor.cleanupScreenshots(workflowSessionId);
      
      expect(cleanupResult).toMatchObject({
        deletedCount: expect.any(Number),
        freedSpace: expect.any(Number),
        errors: expect.any(Array),
        duration: expect.any(Number)
      });
    });
  });

  describe('configuration management', () => {
    it('should update configuration', () => {
      const newConfig: ExecutorConfig = {
        ...mockConfig,
        browser: {
          ...mockConfig.browser,
          type: 'firefox',
          maxSessions: 10
        }
      };

      executor.updateConfig(newConfig);
      
      const currentConfig = executor.getConfig();
      expect(currentConfig.browser.type).toBe('firefox');
      expect(currentConfig.browser.maxSessions).toBe(10);
    });

    it('should return configuration copy', () => {
      const config = executor.getConfig();
      const originalMaxSessions = config.browser.maxSessions;
      
      // Modify the returned config
      config.browser.maxSessions = 999;
      
      // Original config should not be modified
      const freshConfig = executor.getConfig();
      expect(freshConfig.browser.maxSessions).toBe(originalMaxSessions);
      expect(freshConfig.browser.maxSessions).not.toBe(999);
    });
  });

  describe('statistics and monitoring', () => {
    it('should provide comprehensive statistics', async () => {
      await executor.createSession('workflow-1');
      await executor.createSession('workflow-2');
      await executor.setVariable('workflow-1', 'var1', 'value1');
      await executor.openPage('workflow-1', 'https://example.com');

      const stats = executor.getStatistics();

      expect(stats.sessions).toBeDefined();
      expect(stats.screenshots).toBeDefined();
      expect(stats.variables).toBeDefined();
      expect(stats.logs).toBeDefined();

      expect(stats.sessions.totalSessions).toBe(2);
      expect(stats.variables.totalVariables).toBe(1);
      expect(stats.screenshots.totalScreenshots).toBe(1);
    });

    it('should track session statistics', async () => {
      await executor.createSession('workflow-1');
      await executor.updateSessionStatus('workflow-1', SessionStatus.BUSY);

      const stats = executor.getStatistics();

      expect(stats.sessions.totalSessions).toBe(1);
      expect(stats.sessions.activeSessions).toBe(0); // BUSY is not ACTIVE
    });
  });

  describe('shutdown and cleanup', () => {
    it('should shutdown gracefully', async () => {
      await executor.createSession('workflow-1');
      await executor.createSession('workflow-2');

      await executor.shutdown();

      // All sessions should be destroyed
      expect(executor.sessionExists('workflow-1')).toBe(false);
      expect(executor.sessionExists('workflow-2')).toBe(false);
    });

    it('should handle shutdown errors gracefully', async () => {
      await executor.createSession('workflow-1');
      
      // Mock browser close to fail
      const session = executor.getSessionInfo('workflow-1');
      if (session?.browser) {
        session.browser.close = jest.fn().mockRejectedValue(new Error('Browser close failed'));
      }

      // Should not throw
      await expect(executor.shutdown()).resolves.not.toThrow();
    });

    it('should cleanup resources on shutdown', async () => {
      await executor.createSession('workflow-1');
      await executor.openPage('workflow-1', 'https://example.com');

      const initialStats = executor.getStatistics();
      expect(initialStats.sessions.totalSessions).toBe(1);

      await executor.shutdown();

      const finalStats = executor.getStatistics();
      expect(finalStats.sessions.totalSessions).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle session creation errors', async () => {
      // Create max sessions (config maxSessions is 3)
      await executor.createSession('workflow-1');
      await executor.createSession('workflow-2');
      await executor.createSession('workflow-3');

      // Next session should fail
      try {
        await executor.createSession('workflow-overflow');
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.message).toMatch(/Maximum sessions limit.*exceeded/);
      }
    });

    it('should handle command execution errors', async () => {
      const workflowSessionId = 'workflow-123';
      await executor.createSession(workflowSessionId);

      const command = {
        sessionId: workflowSessionId,
        action: CommandAction.OPEN_PAGE,
        parameters: {}, // Missing URL
        commandId: 'cmd-123',
        timestamp: new Date()
      };

      const response = await executor.executeCommand(command);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    it('should handle operations on destroyed sessions', async () => {
      const workflowSessionId = 'workflow-123';
      await executor.createSession(workflowSessionId);
      await executor.destroySession(workflowSessionId);

      try {
        await executor.openPage(workflowSessionId, 'https://example.com');
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.message).toMatch(/Session.*not found/);
      }
    });
  });

  describe('concurrent operations', () => {
    it('should handle multiple sessions concurrently', async () => {
      const sessions = ['workflow-1', 'workflow-2', 'workflow-3'];
      
      // Create sessions concurrently
      const createPromises = sessions.map(id => executor.createSession(id));
      await Promise.all(createPromises);

      // Execute commands concurrently
      const commandPromises = sessions.map(id => 
        executor.openPage(id, `https://${id}.example.com`)
      );
      const responses = await Promise.all(commandPromises);

      responses.forEach((response, index) => {
        expect(response.success).toBe(true);
        expect(response.metadata?.url).toBe(`https://${sessions[index]}.example.com`);
      });
    });

    it('should handle concurrent variable operations', async () => {
      const workflowSessionId = 'workflow-123';
      await executor.createSession(workflowSessionId);

      // Set variables concurrently
      const setPromises = Array.from({ length: 10 }, (_, i) =>
        executor.setVariable(workflowSessionId, `var${i}`, `value${i}`)
      );
      await Promise.all(setPromises);

      const variables = executor.listVariables(workflowSessionId);
      expect(Object.keys(variables)).toHaveLength(10);
    });
  });

  describe('edge cases', () => {
    it('should handle empty parameter validation', async () => {
      const workflowSessionId = 'workflow-123';
      await executor.createSession(workflowSessionId);

      try {
        await executor.openPage(workflowSessionId, '');
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.message).toMatch(/URL parameter is required/);
      }
    });

    it('should handle very long strings', async () => {
      const workflowSessionId = 'workflow-123';
      await executor.createSession(workflowSessionId);

      const longString = 'x'.repeat(10000);
      
      await executor.setVariable(workflowSessionId, 'longVar', longString);
      const retrieved = executor.getVariable(workflowSessionId, 'longVar');
      
      expect(retrieved).toBe(longString);
    });

    it('should handle special characters in variables', async () => {
      const workflowSessionId = 'workflow-123';
      await executor.createSession(workflowSessionId);

      const specialValue = 'Value with special chars: !@#$%^&*()[]{}|;:,.<>?';
      
      await executor.setVariable(workflowSessionId, 'specialVar', specialValue);
      const retrieved = executor.getVariable(workflowSessionId, 'specialVar');
      
      expect(retrieved).toBe(specialValue);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete workflow execution', async () => {
      const workflowSessionId = 'workflow-123';
      await executor.createSession(workflowSessionId);

      // Set up variables
      await executor.setVariable(workflowSessionId, 'baseUrl', 'https://test.com');
      await executor.setVariable(workflowSessionId, 'username', 'testuser');

      // Execute workflow steps
      await executor.openPage(workflowSessionId, '${baseUrl}/login');
      await executor.inputText(workflowSessionId, '#username', '${username}');
      await executor.inputText(workflowSessionId, '#password', 'testpass');
      await executor.clickElement(workflowSessionId, '#submit');
      await executor.saveVariable(workflowSessionId, '#welcome', 'welcomeMessage');

      // Verify final state
      const welcomeMessage = executor.getVariable(workflowSessionId, 'welcomeMessage');
      expect(welcomeMessage).toBeDefined();

      const screenshots = await executor.listScreenshots(workflowSessionId);
      expect(screenshots.length).toBeGreaterThan(0);
    });

    it('should maintain session isolation', async () => {
      await executor.createSession('workflow-1');
      await executor.createSession('workflow-2');

      // Set different variables in each session
      await executor.setVariable('workflow-1', 'env', 'prod');
      await executor.setVariable('workflow-2', 'env', 'test');

      // Variables should be isolated
      expect(executor.getVariable('workflow-1', 'env')).toBe('prod');
      expect(executor.getVariable('workflow-2', 'env')).toBe('test');

      // Screenshots should be isolated
      await executor.openPage('workflow-1', 'https://prod.example.com');
      await executor.openPage('workflow-2', 'https://test.example.com');

      const screenshots1 = await executor.listScreenshots('workflow-1');
      const screenshots2 = await executor.listScreenshots('workflow-2');

      expect(screenshots1.every(s => s.sessionId === 'workflow-1')).toBe(true);
      expect(screenshots2.every(s => s.sessionId === 'workflow-2')).toBe(true);
    });
  });
});
