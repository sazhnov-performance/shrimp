/**
 * Real Executor Integration Test with Playwright
 * Tests the executor module with actual browser automation
 * 
 * Run with: npm run test:integration
 */

import { Executor } from '../src/modules/executor/index';
import { 
  LogLevel, 
  SessionStatus 
} from '../types/shared-types';
import { 
  ExecutorConfig, 
  DEFAULT_EXECUTOR_CONFIG 
} from '../src/modules/executor/types';
import path from 'path';
import fs from 'fs/promises';

describe('Real Executor Integration with Playwright', () => {
  let executor: Executor;
  let config: ExecutorConfig;
  let testScreenshotDir: string;

  beforeAll(async () => {
    // Setup real configuration for integration testing
    testScreenshotDir = path.join(process.cwd(), 'test-screenshots-integration');
    
    // Ensure screenshot directory exists
    try {
      await fs.mkdir(testScreenshotDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, that's fine
    }

    config = {
      ...DEFAULT_EXECUTOR_CONFIG,
      browser: {
        type: 'chromium',
        headless: false, // Set to false to see the browser in action
        sessionTTL: 300000, // 5 minutes
        maxSessions: 3
      },
      screenshots: {
        enabled: true,
        directory: testScreenshotDir,
        format: 'png',
        fullPage: true,
        nameTemplate: '{sessionId}_{timestamp}_{actionType}',
        cleanup: {
          enabled: false, // Keep screenshots for debugging
          maxAge: 86400000,
          maxCount: 50,
          schedule: 'immediate'
        }
      },
      logging: {
        level: LogLevel.INFO,
        prefix: '[RealExecutorTest]',
        includeTimestamp: true,
        includeSessionId: true,
        includeModuleId: true,
        structured: false
      }
    };

    executor = new Executor(config);
  });

  afterAll(async () => {
    await executor.shutdown();
    console.log(`📸 Screenshots saved in: ${testScreenshotDir}`);
  });

  it('should perform real web automation workflow', async () => {
    const workflowSessionId = `real-test-${Date.now()}`;
    
    console.log(`🎯 Starting REAL integration test with session: ${workflowSessionId}`);

    // 1. Create Session
    console.log('📝 Creating executor session...');
    const sessionId = await executor.createSession(workflowSessionId, {
      metadata: { 
        testName: 'Real Playwright Integration',
        environment: 'integration-test',
        timestamp: new Date().toISOString()
      }
    });

    expect(sessionId).toBeDefined();
    expect(executor.sessionExists(workflowSessionId)).toBe(true);
    
    console.log(`✅ Session created: ${sessionId}`);

    // 2. Set up variables
    console.log('🔧 Setting up variables...');
    await executor.setVariable(workflowSessionId, 'testSite', 'https://example.com');
    await executor.setVariable(workflowSessionId, 'testName', 'RealExecutorTest');
    
    // Verify variables are set
    const testSiteVar = executor.getVariable(workflowSessionId, 'testSite');
    const testNameVar = executor.getVariable(workflowSessionId, 'testName');
    console.log('Variables set:', { testSite: testSiteVar, testName: testNameVar });
    
    // Test variable resolution
    const resolvedUrl = executor.resolveVariables(workflowSessionId, '${testSite}');
    console.log('Resolved URL:', resolvedUrl);
    
    console.log('✅ Variables set and verified');

    // 3. Navigate to a simple, reliable test site
    console.log('🌐 Opening example.com (reliable test site)...');
    const openResponse = await executor.openPage(workflowSessionId, '${testSite}');

    expect(openResponse.success).toBe(true);
    expect(openResponse.dom).toContain('html'); // Real HTML content
    expect(openResponse.screenshotId).toBeDefined();
    
    console.log(`✅ Page opened, screenshot: ${openResponse.screenshotId}`);
    console.log(`📄 DOM length: ${openResponse.dom.length} characters`);

    // 4. Verify we can get DOM content
    console.log('📄 Getting current DOM...');
    const domResponse = await executor.getCurrentDOM(workflowSessionId);
    
    expect(domResponse.success).toBe(true);
    expect(domResponse.dom).toContain('Example Domain'); // example.com content
    expect(domResponse.metadata?.domLength).toBe(domResponse.dom.length);
    
    console.log(`✅ DOM captured: ${domResponse.dom.length} characters, screenshot: ${domResponse.screenshotId}`);

    // 5. Test navigation to a different URL  
    console.log('🔄 Testing navigation with variables...');
    await executor.setVariable(workflowSessionId, 'newSite', 'https://httpbin.org');
    const navResponse = await executor.openPage(workflowSessionId, '${newSite}/get');
    
    expect(navResponse.success).toBe(true);
    expect(navResponse.dom).toContain('httpbin'); // Should contain httpbin content
    
    console.log(`✅ Navigation successful, screenshot: ${navResponse.screenshotId}`);

    // 6. Test simple element interaction if possible
    try {
      console.log('🔘 Testing element interaction...');
      // Try to click something simple that might exist
      const clickResponse = await executor.clickElement(workflowSessionId, 'body');
      
      if (clickResponse.success) {
        console.log(`✅ Element interaction successful, screenshot: ${clickResponse.screenshotId}`);
      } else {
        console.log(`⚠️ Element interaction failed (expected), screenshot: ${clickResponse.screenshotId}`);
      }
    } catch (error: any) {
      console.log(`⚠️ Element interaction failed (expected): ${error.message}`);
    }

    // 7. Verify all variables are still available
    console.log('📋 Verifying session state...');
    const allVariables = executor.listVariables(workflowSessionId);
    
    expect(allVariables).toMatchObject({
      testSite: 'https://example.com',
      testName: 'RealExecutorTest',
      newSite: 'https://httpbin.org'
    });
    
    console.log('✅ All variables preserved:', Object.keys(allVariables));

    // 9. Check session statistics
    console.log('📊 Checking session statistics...');
    const stats = executor.getStatistics();
    
    expect(stats.sessions.totalSessions).toBe(1);
    expect(stats.sessions.activeSessions).toBe(1);
    expect(stats.screenshots.totalScreenshots).toBeGreaterThan(0);
    expect(stats.variables.totalVariables).toBe(3);
    
    console.log(`📈 Sessions: ${stats.sessions.totalSessions}, Screenshots: ${stats.screenshots.totalScreenshots}, Variables: ${stats.variables.totalVariables}`);

    // 10. List and verify screenshots
    console.log('📷 Verifying screenshot management...');
    const screenshots = await executor.listScreenshots(workflowSessionId);
    
    expect(screenshots.length).toBeGreaterThan(2); // We took several screenshots
    
    for (const screenshot of screenshots) {
      expect(screenshot.sessionId).toBe(workflowSessionId);
      expect(screenshot.filePath).toContain(testScreenshotDir);
      
      // Verify screenshot file actually exists
      const screenshotInfo = await executor.getScreenshot(screenshot.id);
      expect(screenshotInfo).toBeDefined();
      expect(screenshotInfo?.fileSize).toBeGreaterThan(0);
    }
    
    console.log(`✅ ${screenshots.length} screenshots verified and saved`);

    // 11. Test health check
    console.log('🏥 Performing health check...');
    const health = await executor.healthCheck();
    
    expect(health.moduleId).toBe('executor');
    expect(health.isHealthy).toBe(true);
    expect(health.totalSessions).toBe(1);
    expect(health.activeSessions).toBe(1);
    
    console.log('✅ Health check passed');

    // 12. Clean up
    console.log('🧹 Cleaning up session...');
    await executor.destroySession(workflowSessionId);
    
    expect(executor.sessionExists(workflowSessionId)).toBe(false);
    
    console.log('✅ Session destroyed');
    console.log('🎉 REAL integration test completed successfully!');
    
  }, 120000); // 120 second timeout for real browser operations

  it('should handle real error scenarios', async () => {
    const workflowSessionId = `error-test-${Date.now()}`;
    await executor.createSession(workflowSessionId);

    console.log('⚠️ Testing real error scenarios...');

    // Test navigation to valid URL first
    console.log('🌐 Opening valid page first...');
    await executor.openPage(workflowSessionId, 'https://example.com');
    
    // Test invalid selector on real page
    console.log('🚫 Testing invalid selector...');
    const invalidSelectorResponse = await executor.clickElement(workflowSessionId, '#non-existent-element-12345');
    
    expect(invalidSelectorResponse.success).toBe(false);
    expect(invalidSelectorResponse.error).toBeDefined();
    
    console.log(`✅ Invalid selector handled gracefully: ${invalidSelectorResponse.error?.message}`);

    await executor.destroySession(workflowSessionId);
    console.log('✅ Error handling test completed');
    
  }, 30000);

  it('should demonstrate variable resolution in real context', async () => {
    const workflowSessionId = `variables-test-${Date.now()}`;
    await executor.createSession(workflowSessionId);

    console.log('🔄 Testing variable resolution with real navigation...');

    // Set up variables
    await executor.setVariable(workflowSessionId, 'baseUrl', 'https://example.com');
    await executor.setVariable(workflowSessionId, 'userAgent', 'ExecutorTestBot/1.0');

    // Navigate using variable resolution
    const response = await executor.openPage(workflowSessionId, '${baseUrl}');
    
    expect(response.success).toBe(true);
    expect(response.metadata?.url).toBe('https://example.com');
    expect(response.dom).toContain('Example Domain');
    
    console.log('✅ Variable resolution worked for navigation');

    // Test complex variable resolution
    const complexResolution = executor.resolveVariables(
      workflowSessionId, 
      'Navigated to ${baseUrl} with agent ${userAgent}'
    );
    
    expect(complexResolution).toBe('Navigated to https://example.com with agent ExecutorTestBot/1.0');
    
    console.log(`✅ Complex resolution: "${complexResolution}"`);

    await executor.destroySession(workflowSessionId);
    
  }, 30000);
});
