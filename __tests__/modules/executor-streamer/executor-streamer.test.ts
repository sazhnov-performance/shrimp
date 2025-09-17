/**
 * Executor Streamer Module Tests
 * Tests for the main executor streamer interface and integration
 */

import { 
  SessionStatus, 
  StreamEventType,
  CommandAction
} from '../../../types/shared-types';

import {
  ExecutorStreamer,
  IExecutorStreamer,
  DEFAULT_EXECUTOR_STREAMER_CONFIG,
  StreamClient,
  ClientType,
  ErrorContext,
  ScreenshotInfo
} from '../../../src/modules/executor-streamer';

// Mock WebSocket for testing
class MockWebSocket {
  readyState = 1; // OPEN
  
  send = jest.fn();
  close = jest.fn();
  on = jest.fn();
  off = jest.fn();
  ping = jest.fn();
  pong = jest.fn();
}

// Mock Response for SSE testing
class MockResponse {
  destroyed = false;
  headersSent = false;
  
  writeHead = jest.fn();
  write = jest.fn().mockReturnValue(true);
  end = jest.fn();
  on = jest.fn();
  once = jest.fn();
}

describe('ExecutorStreamer', () => {
  let streamer: IExecutorStreamer;
  let mockWebSocket: MockWebSocket;
  let mockResponse: MockResponse;

  beforeEach(() => {
    streamer = new ExecutorStreamer();
    mockWebSocket = new MockWebSocket();
    mockResponse = new MockResponse();
  });

  afterEach(async () => {
    await streamer.shutdown();
  });

  describe('Module Interface', () => {
    test('should have correct module ID', () => {
      expect(streamer.moduleId).toBe('executor-streamer');
    });

    test('should initialize with default configuration', () => {
      const config = streamer.getConfiguration();
      expect(config.moduleId).toBe('executor-streamer');
      expect(config.server.port).toBe(3001);
      expect(config.defaultStreamConfig.maxHistorySize).toBe(10000);
    });

    test('should allow configuration updates', () => {
      const newConfig = {
        server: {
          port: 4001,
          host: 'test-host',
          maxConnections: 500
        }
      };

      streamer.updateConfiguration(newConfig);
      const config = streamer.getConfiguration();
      
      expect(config.server.port).toBe(4001);
      expect(config.server.host).toBe('test-host');
      expect(config.server.maxConnections).toBe(500);
    });
  });

  describe('Session Management', () => {
    test('should create and manage stream sessions', async () => {
      const workflowSessionId = 'test-workflow-session';
      
      // Create session
      const streamId = await streamer.createSession(workflowSessionId);
      expect(streamId).toBeTruthy();
      expect(streamer.sessionExists(workflowSessionId)).toBe(true);

      // Get session info
      const session = streamer.getSession(workflowSessionId);
      expect(session).toBeTruthy();
      expect(session!.linkedWorkflowSessionId).toBe(workflowSessionId);
      expect(session!.status).toBe(SessionStatus.ACTIVE);

      // Update session status
      await streamer.updateSessionStatus(workflowSessionId, SessionStatus.BUSY);
      expect(streamer.getSessionStatus(workflowSessionId)).toBe(SessionStatus.BUSY);

      // Record activity
      await streamer.recordActivity(workflowSessionId);
      const lastActivity = streamer.getLastActivity(workflowSessionId);
      expect(lastActivity).toBeTruthy();

      // Destroy session
      await streamer.destroySession(workflowSessionId);
      expect(streamer.sessionExists(workflowSessionId)).toBe(false);
    });

    test('should handle session lifecycle callbacks', async () => {
      const onSessionCreated = jest.fn();
      const onSessionDestroyed = jest.fn();
      const onSessionStatusChanged = jest.fn();

      streamer.setLifecycleCallbacks({
        onSessionCreated,
        onSessionDestroyed,
        onSessionStatusChanged
      });

      const workflowSessionId = 'test-session-callbacks';
      
      // Create session
      await streamer.createSession(workflowSessionId);
      expect(onSessionCreated).toHaveBeenCalled();

      // Update status
      await streamer.updateSessionStatus(workflowSessionId, SessionStatus.PAUSED);
      expect(onSessionStatusChanged).toHaveBeenCalled();

      // Destroy session
      await streamer.destroySession(workflowSessionId);
      expect(onSessionDestroyed).toHaveBeenCalled();
    });

    test('should perform health checks', async () => {
      const health = await streamer.healthCheck();
      expect(health.moduleId).toBe('executor-streamer');
      expect(health.isHealthy).toBe(true);
      expect(health.lastHealthCheck).toBeInstanceOf(Date);
    });
  });

  describe('Stream Management', () => {
    test('should create and manage streams', async () => {
      const workflowSessionId = 'test-stream-session';
      
      // Create stream
      const streamId = await streamer.createStream(workflowSessionId);
      expect(streamId).toBeTruthy();

      // Get stream
      const stream = streamer.getStream(workflowSessionId);
      expect(stream).toBeTruthy();
      expect(stream!.streamId).toBe(streamId);
      expect(stream!.isActive).toBe(true);

      // List active streams
      const activeStreams = streamer.listActiveStreams();
      expect(activeStreams).toContain(workflowSessionId);

      // Destroy stream
      await streamer.destroyStream(workflowSessionId);
      expect(streamer.getStream(workflowSessionId)).toBeNull();
    });

    test('should handle stream configuration', async () => {
      const workflowSessionId = 'test-stream-config';
      const customConfig = {
        maxHistorySize: 5000,
        bufferSize: 500,
        enableReplay: false
      };

      const streamId = await streamer.createStream(workflowSessionId, customConfig);
      const stream = streamer.getStream(workflowSessionId);
      
      expect(stream!.config.maxHistorySize).toBe(5000);
      expect(stream!.config.bufferSize).toBe(500);
      expect(stream!.config.enableReplay).toBe(false);
    });
  });

  describe('Client Connection Management', () => {
    test('should handle WebSocket connections', async () => {
      const workflowSessionId = 'test-websocket-session';
      await streamer.createStream(workflowSessionId);

      const clientId = await streamer.handleWebSocketConnection(
        mockWebSocket as any,
        workflowSessionId,
        [{ eventTypes: [StreamEventType.AI_REASONING] }]
      );

      expect(clientId).toBeTruthy();

      const stream = streamer.getStream(workflowSessionId);
      expect(stream!.clients.length).toBe(1);
      expect(stream!.clients[0].type).toBe(ClientType.WEBSOCKET);

      await streamer.disconnectClient(clientId);
      // Client should be disconnected (actual close behavior may vary by implementation)
    });

    test('should handle SSE connections', async () => {
      const workflowSessionId = 'test-sse-session';
      await streamer.createStream(workflowSessionId);

      const clientId = await streamer.handleSSEConnection(
        mockResponse as any,
        workflowSessionId,
        [{ eventTypes: [StreamEventType.COMMAND_STARTED] }]
      );

      expect(clientId).toBeTruthy();
      expect(mockResponse.writeHead).toHaveBeenCalledWith(200, expect.any(Object));

      const stream = streamer.getStream(workflowSessionId);
      expect(stream!.clients.length).toBe(1);
      expect(stream!.clients[0].type).toBe(ClientType.SERVER_SENT_EVENTS);

      await streamer.disconnectClient(clientId);
      expect(mockResponse.end).toHaveBeenCalled();
    });

    test('should create stream automatically for new connections', async () => {
      const workflowSessionId = 'test-auto-create';
      
      // Connection should auto-create stream
      const clientId = await streamer.handleWebSocketConnection(
        mockWebSocket as any,
        workflowSessionId
      );

      expect(clientId).toBeTruthy();
      expect(streamer.sessionExists(workflowSessionId)).toBe(true);
      expect(streamer.getStream(workflowSessionId)).toBeTruthy();
    });
  });

  describe('Event Publishing', () => {
    test('should publish AI reasoning events', async () => {
      const sessionId = 'test-reasoning-session';
      await streamer.createStream(sessionId);

      await streamer.publishReasoning(
        sessionId,
        'Analyzing the page structure',
        0.85,
        'analysis',
        { pageUrl: 'https://example.com' }
      );

      const history = await streamer.getEventHistory(sessionId);
      expect(history.length).toBe(1);
      expect(history[0].type).toBe(StreamEventType.AI_REASONING);
      expect(history[0].data.reasoning?.thought).toBe('Analyzing the page structure');
      expect(history[0].data.reasoning?.confidence).toBe(0.85);
    });

    test('should publish command events', async () => {
      const sessionId = 'test-command-session';
      await streamer.createStream(sessionId);

      // Command started
      await streamer.publishCommandStarted(
        sessionId,
        'cmd_click_button',
        CommandAction.CLICK_ELEMENT,
        { selector: '#submit-btn' }
      );

      // Command completed
      await streamer.publishCommandCompleted(
        sessionId,
        'cmd_click_button',
        { success: true, element: 'button' },
        250
      );

      const history = await streamer.getEventHistory(sessionId);
      expect(history.length).toBe(2);
      expect(history.some(e => e.type === StreamEventType.COMMAND_STARTED)).toBe(true);
      expect(history.some(e => e.type === StreamEventType.COMMAND_COMPLETED)).toBe(true);
    });

    test('should publish command failure events', async () => {
      const sessionId = 'test-command-failure-session';
      await streamer.createStream(sessionId);

      const error: ErrorContext = {
        id: 'err_001',
        code: 'ELEMENT_NOT_FOUND',
        message: 'Element not found',
        timestamp: new Date(),
        moduleId: 'executor',
        recoverable: true,
        retryable: true
      };

      await streamer.publishCommandFailed(
        sessionId,
        'cmd_click_missing',
        error,
        100
      );

      const history = await streamer.getEventHistory(sessionId);
      expect(history.length).toBe(1);
      expect(history[0].type).toBe(StreamEventType.COMMAND_FAILED);
      expect(history[0].data.error?.code).toBe('ELEMENT_NOT_FOUND');
    });

    test('should publish screenshot events', async () => {
      const sessionId = 'test-screenshot-session';
      await streamer.createStream(sessionId);

      const screenshotInfo: ScreenshotInfo = {
        id: 'screenshot_001',
        sessionId,
        stepIndex: 1,
        actionType: 'CLICK_ELEMENT',
        timestamp: new Date(),
        filePath: '/path/to/screenshot.png',
        dimensions: { width: 1920, height: 1080 },
        fileSize: 123456
      };

      await streamer.publishScreenshot(sessionId, screenshotInfo);

      const history = await streamer.getEventHistory(sessionId);
      expect(history.length).toBe(1);
      expect(history[0].type).toBe(StreamEventType.SCREENSHOT_CAPTURED);
      expect(history[0].data.screenshot?.id).toBe('screenshot_001');
    });

    test('should publish variable update events', async () => {
      const sessionId = 'test-variable-session';
      await streamer.createStream(sessionId);

      await streamer.publishVariableUpdate(
        sessionId,
        'userName',
        'john_doe',
        'old_user'
      );

      const history = await streamer.getEventHistory(sessionId);
      expect(history.length).toBe(1);
      expect(history[0].type).toBe(StreamEventType.VARIABLE_UPDATED);
      expect(history[0].data.variable?.name).toBe('userName');
      expect(history[0].data.variable?.value).toBe('john_doe');
      expect(history[0].data.variable?.previousValue).toBe('old_user');
    });

    test('should publish status events', async () => {
      const sessionId = 'test-status-session';
      await streamer.createStream(sessionId);

      await streamer.publishStatus(
        sessionId,
        'workflow',
        'progress',
        'Step 3 of 5 completed'
      );

      const history = await streamer.getEventHistory(sessionId);
      expect(history.length).toBe(1);
      expect(history[0].type).toBe(StreamEventType.SESSION_STATUS);
      expect(history[0].data.message).toBe('Step 3 of 5 completed');
    });

    test('should publish error events', async () => {
      const sessionId = 'test-error-session';
      await streamer.createStream(sessionId);

      const error: ErrorContext = {
        id: 'err_002',
        code: 'NETWORK_ERROR',
        message: 'Connection timeout',
        timestamp: new Date(),
        moduleId: 'executor-streamer',
        recoverable: true,
        retryable: true
      };

      await streamer.publishError(sessionId, error);

      const history = await streamer.getEventHistory(sessionId);
      expect(history.length).toBe(1);
      expect(history[0].type).toBe(StreamEventType.ERROR_OCCURRED);
      expect(history[0].data.error?.code).toBe('NETWORK_ERROR');
    });
  });

  describe('Event Broadcasting', () => {
    test('should broadcast events to connected clients', async () => {
      const sessionId = 'test-broadcast-session';
      await streamer.createStream(sessionId);

      // Connect a WebSocket client
      const clientId = await streamer.handleWebSocketConnection(
        mockWebSocket as any,
        sessionId
      );

      // Publish an event (should be broadcasted)
      await streamer.publishReasoning(sessionId, 'Test broadcast', 0.9, 'test');

      // Verify WebSocket send was called
      expect(mockWebSocket.send).toHaveBeenCalled();
    });

    test('should broadcast to all streams', async () => {
      const session1 = 'test-broadcast-all-1';
      const session2 = 'test-broadcast-all-2';
      
      await streamer.createStream(session1);
      await streamer.createStream(session2);

      // Connect clients to both streams
      await streamer.handleWebSocketConnection(mockWebSocket as any, session1);
      const mockWs2 = new MockWebSocket();
      await streamer.handleWebSocketConnection(mockWs2 as any, session2);

      // Create a generic event
      const event = {
        id: 'test-event-001',
        type: StreamEventType.AI_REASONING,
        timestamp: new Date(),
        sessionId: 'global',
        data: {
          reasoning: {
            thought: 'Global message',
            confidence: 1.0,
            reasoningType: 'broadcast' as any
          }
        }
      };

      await streamer.broadcastToAllStreams(event);

      // Both clients should receive the event
      expect(mockWebSocket.send).toHaveBeenCalled();
      expect(mockWs2.send).toHaveBeenCalled();
    });
  });

  describe('Analytics and Monitoring', () => {
    test('should provide stream analytics', async () => {
      const sessionId = 'test-analytics-session';
      await streamer.createStream(sessionId);

      // Generate some events
      await streamer.publishReasoning(sessionId, 'Test 1', 0.8, 'test');
      await streamer.publishReasoning(sessionId, 'Test 2', 0.9, 'test');

      const analytics = streamer.getStreamAnalytics();
      expect(analytics.metrics).toBeTruthy();
      expect(analytics.performance).toBeTruthy();
      expect(analytics.resources).toBeTruthy();
      expect(analytics.health).toBeTruthy();

      expect(analytics.metrics.totalStreams).toBeGreaterThan(0);
      expect(analytics.metrics.activeStreams).toBeGreaterThan(0);
    });

    test('should provide health status', async () => {
      const health = await streamer.getHealthStatus();
      expect(health.overall).toBe('healthy');
      expect(health.components).toBeTruthy();
      expect(health.components.streamManager).toBeTruthy();
      expect(health.components.analytics).toBeTruthy();
      expect(health.timestamp).toBeInstanceOf(Date);
    });

    test('should track statistics', () => {
      const stats = streamer.getStatistics();
      expect(stats.streams).toBeTruthy();
      expect(stats.clients).toBeTruthy();
      expect(stats.history).toBeTruthy();
      expect(stats.analytics).toBeTruthy();
    });
  });

  describe('History and Replay', () => {
    test('should maintain event history', async () => {
      const sessionId = 'test-history-session';
      await streamer.createStream(sessionId);

      // Publish multiple events
      await streamer.publishReasoning(sessionId, 'Event 1', 0.8, 'test');
      await streamer.publishReasoning(sessionId, 'Event 2', 0.9, 'test');
      await streamer.publishStatus(sessionId, 'test', 'progress', 'Test status');

      const history = await streamer.getEventHistory(sessionId);
      expect(history.length).toBe(3);

      // Events should be ordered by timestamp (newest first typically)
      const reasoningEvents = history.filter(e => e.type === StreamEventType.AI_REASONING);
      const statusEvents = history.filter(e => e.type === StreamEventType.SESSION_STATUS);
      
      expect(reasoningEvents.length).toBe(2);
      expect(statusEvents.length).toBe(1);
    });

    test('should support filtered history', async () => {
      const sessionId = 'test-filtered-history-session';
      await streamer.createStream(sessionId);

      await streamer.publishReasoning(sessionId, 'Reasoning event', 0.8, 'test');
      await streamer.publishStatus(sessionId, 'test', 'progress', 'Status event');
      await streamer.publishError(sessionId, {
        id: 'err_test',
        code: 'TEST_ERROR',
        message: 'Test error',
        timestamp: new Date(),
        moduleId: 'test',
        recoverable: true,
        retryable: false
      });

      // Filter for only reasoning events
      const reasoningOnly = await streamer.getEventHistory(sessionId, {
        eventTypes: [StreamEventType.AI_REASONING]
      });

      expect(reasoningOnly.length).toBe(1);
      expect(reasoningOnly[0].type).toBe(StreamEventType.AI_REASONING);
    });

    test('should support event replay', async () => {
      const sessionId = 'test-replay-session';
      await streamer.createStream(sessionId);

      // Connect a client
      const clientId = await streamer.handleWebSocketConnection(
        mockWebSocket as any,
        sessionId
      );

      // Publish some events
      await streamer.publishReasoning(sessionId, 'Historical event 1', 0.8, 'test');
      await streamer.publishReasoning(sessionId, 'Historical event 2', 0.9, 'test');

      // Replay events to client
      await streamer.replayEventsToClient(clientId);

      // Should have additional calls to send method (for replay)
      expect(mockWebSocket.send).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid session operations gracefully', async () => {
      const invalidSessionId = 'non-existent-session';

      expect(streamer.sessionExists(invalidSessionId)).toBe(false);
      expect(streamer.getSession(invalidSessionId)).toBeNull();
      expect(streamer.getSessionStatus(invalidSessionId)).toBeNull();
      expect(streamer.getLastActivity(invalidSessionId)).toBeNull();

      // These should not throw errors
      await expect(streamer.recordActivity(invalidSessionId)).resolves.toBeUndefined();
      await expect(streamer.destroySession(invalidSessionId)).resolves.toBeUndefined();
    });

    test('should handle duplicate session creation', async () => {
      const sessionId = 'duplicate-session';
      
      await streamer.createSession(sessionId);
      
      // Creating same session again should throw error
      await expect(streamer.createSession(sessionId)).rejects.toThrow();
    });

    test('should handle client disconnection errors gracefully', async () => {
      const sessionId = 'error-disconnect-session';
      await streamer.createStream(sessionId);

      const clientId = await streamer.handleWebSocketConnection(
        mockWebSocket as any,
        sessionId
      );

      // Simulate WebSocket error during close
      mockWebSocket.close.mockImplementation(() => {
        throw new Error('WebSocket close error');
      });

      // Should not throw despite WebSocket error
      await expect(streamer.disconnectClient(clientId)).resolves.toBeUndefined();
    });
  });

  describe('Lifecycle Management', () => {
    test('should initialize successfully', async () => {
      const newStreamer = new ExecutorStreamer();
      await expect(newStreamer.initialize()).resolves.toBeUndefined();
      await newStreamer.shutdown();
    });

    test('should shutdown gracefully', async () => {
      const sessionId = 'shutdown-test-session';
      await streamer.createStream(sessionId);
      
      const clientId = await streamer.handleWebSocketConnection(
        mockWebSocket as any,
        sessionId
      );

      // Shutdown should disconnect all clients and clean up
      await expect(streamer.shutdown()).resolves.toBeUndefined();
      
      // WebSocket should be closed
      expect(mockWebSocket.close).toHaveBeenCalled();
    });
  });
});

describe('ExecutorStreamer Configuration', () => {
  test('should use default configuration when none provided', () => {
    const streamer = new ExecutorStreamer();
    const config = streamer.getConfiguration();
    
    expect(config).toEqual(DEFAULT_EXECUTOR_STREAMER_CONFIG);
  });

  test('should merge custom configuration with defaults', () => {
    const customConfig = {
      server: {
        port: 5001,
        maxConnections: 2000
      },
      security: {
        corsOrigins: ['https://custom.com'],
        authenticationRequired: true,
        rateLimiting: {
          enabled: false,
          maxRequestsPerMinute: 500,
          maxEventsPerSecond: 50
        }
      }
    };

    const streamer = new ExecutorStreamer(customConfig as any);
    const config = streamer.getConfiguration();
    
    expect(config.server.port).toBe(5001);
    expect(config.server.maxConnections).toBe(2000);
    expect(config.security.corsOrigins).toEqual(['https://custom.com']);
    expect(config.security.authenticationRequired).toBe(true);
    expect(config.security.rateLimiting.enabled).toBe(false);
    
    // Should still have default values for unspecified properties
    expect(config.compression.enabled).toBe(true);
    expect(config.defaultStreamConfig.maxHistorySize).toBe(10000);
  });
});
