/**
 * Test Executor API Route
 * Demonstrates real browser automation with the executor module
 */

import { NextRequest, NextResponse } from 'next/server';
import { Executor } from '../../../modules/executor/index';
import { LogLevel } from '../../../../types/shared-types';
import { DEFAULT_EXECUTOR_CONFIG } from '../../../modules/executor/types';
import * as fs from 'fs/promises';

export async function POST(request: NextRequest) {
  let executor: Executor | null = null;
  let sessionId: string | null = null;

  try {
    console.log('🚀 Starting Executor Test API...');

    // Initialize executor with real browser configuration
    const config = {
      ...DEFAULT_EXECUTOR_CONFIG,
      browser: {
        type: 'chromium' as const,
        headless: false, // Show browser for demo
        sessionTTL: 300000, // 5 minutes
        maxSessions: 1
      },
      logging: {
        level: LogLevel.INFO,
        prefix: '[TestAPI]',
        includeTimestamp: true,
        includeSessionId: true,
        includeModuleId: true,
        structured: false
      },
      screenshots: {
        enabled: true,
        directory: './test-screenshots-api',
        format: 'png' as const,
        fullPage: true,
        nameTemplate: '{sessionId}_{timestamp}_{actionType}_{uuid}',
        cleanup: {
          enabled: false,
          maxAge: 3600000,
          maxCount: 100,
          schedule: 'daily' as const
        }
      }
    };

    // Ensure screenshot directory exists
    try {
      await fs.mkdir('./test-screenshots-api', { recursive: true });
    } catch (error) {
      console.warn('Screenshot directory creation warning:', error);
    }

    executor = new Executor(config);
    console.log('✅ Executor initialized');

    // Create a test session
    sessionId = `api-test-${Date.now()}`;
    await executor.createSession(sessionId);
    console.log(`✅ Session created: ${sessionId}`);

    const results = {
      sessionId,
      steps: [] as any[],
      variables: {},
      screenshots: [] as string[],
      totalDuration: 0
    };

    const startTime = Date.now();

    // Step 1: Set up test variables
    console.log('📝 Setting up variables...');
    await executor.setVariable(sessionId, 'testSite', 'https://example.com');
    await executor.setVariable(sessionId, 'testTitle', 'Example Domain');
    await executor.setVariable(sessionId, 'userAgent', 'DrumsBrowserTest/1.0');
    
    results.steps.push({
      step: 1,
      action: 'Set Variables',
      description: 'Set up test variables for the session',
      success: true,
      duration: Date.now() - startTime
    });

    // Step 2: Navigate to test website  
    console.log('🌐 Opening test website...');
    const stepStart = Date.now();
    
    // Resolve the URL before navigation
    const resolvedUrl = executor.resolveVariables(sessionId, '${testSite}');
    console.log(`🔗 Resolved URL: ${resolvedUrl}`);
    
    const openResponse = await executor.openPage(sessionId, resolvedUrl);
    
    results.steps.push({
      step: 2,
      action: 'Open Page',
      description: 'Navigate to ${testSite} (resolved to https://example.com)',
      success: openResponse.success,
      duration: Date.now() - stepStart,
      screenshotId: openResponse.screenshotId,
      url: openResponse.metadata?.url
    });

    if (openResponse.screenshotId) {
      results.screenshots.push(openResponse.screenshotId);
    }

    // Step 3: Extract page title and save as variable
    console.log('📄 Extracting page information...');
    const titleStepStart = Date.now();
    const titleResponse = await executor.saveVariable(
      sessionId, 
      'h1', 
      'extractedTitle'
    );

    results.steps.push({
      step: 3,
      action: 'Extract Title',
      description: 'Extract H1 text content and save as variable',
      success: titleResponse.success,
      duration: Date.now() - titleStepStart,
      screenshotId: titleResponse.screenshotId,
      extractedValue: titleResponse.metadata?.extractedValue
    });

    if (titleResponse.screenshotId) {
      results.screenshots.push(titleResponse.screenshotId);
    }

    // Step 4: Get current DOM state
    console.log('🔍 Capturing DOM state...');
    const domStepStart = Date.now();
    const domResponse = await executor.getCurrentDOM(sessionId);
    
    results.steps.push({
      step: 4,
      action: 'Get DOM',
      description: 'Capture current page DOM state',
      success: domResponse.success,
      duration: Date.now() - domStepStart,
      screenshotId: domResponse.screenshotId,
      domLength: domResponse.dom?.length || 0
    });

    if (domResponse.screenshotId) {
      results.screenshots.push(domResponse.screenshotId);
    }

    // Step 5: Navigate to another page for more testing
    console.log('🔗 Navigating to info page...');
    const infoStepStart = Date.now();
    await executor.setVariable(sessionId, 'infoUrl', 'https://httpbin.org/json');
    
    // Resolve the URL before navigation
    const resolvedInfoUrl = executor.resolveVariables(sessionId, '${infoUrl}');
    console.log(`🔗 Resolved info URL: ${resolvedInfoUrl}`);
    
    const infoResponse = await executor.openPage(sessionId, resolvedInfoUrl);
    
    results.steps.push({
      step: 5,
      action: 'Navigate to JSON API',
      description: 'Navigate to ${infoUrl} (resolved to https://httpbin.org/json)',
      success: infoResponse.success,
      duration: Date.now() - infoStepStart,
      screenshotId: infoResponse.screenshotId,
      url: infoResponse.metadata?.url
    });

    if (infoResponse.screenshotId) {
      results.screenshots.push(infoResponse.screenshotId);
    }

    // Get final variables state
    results.variables = executor.listVariables(sessionId);
    results.totalDuration = Date.now() - startTime;

    // Get session statistics
    const stats = executor.getStatistics();
    
    console.log('✅ Test completed successfully!');
    console.log(`📊 Session stats:`, stats);

    return NextResponse.json({
      success: true,
      message: 'Executor test completed successfully!',
      results,
      sessionStats: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Executor test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      sessionId,
      timestamp: new Date().toISOString()
    }, { status: 500 });

  } finally {
    // Clean up session
    if (executor && sessionId) {
      try {
        await executor.destroySession(sessionId);
        console.log('🧹 Session cleaned up');
      } catch (cleanupError) {
        console.warn('⚠️ Session cleanup failed:', cleanupError);
      }
    }

    // Shutdown executor
    if (executor) {
      try {
        await executor.shutdown();
        console.log('🛑 Executor shutdown complete');
      } catch (shutdownError) {
        console.warn('⚠️ Executor shutdown failed:', shutdownError);
      }
    }
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Executor Test API',
    description: 'POST to this endpoint to run a browser automation test',
    endpoints: {
      'POST /api/test-executor': 'Run executor test with real browser automation'
    }
  });
}
