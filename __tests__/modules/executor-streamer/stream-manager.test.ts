/**
 * Stream Manager Tests
 * Tests for stream session management and standardized interface compliance
 */

import {
  SessionStatus,
  SessionLifecycleCallbacks
} from '../../../types/shared-types';

import {
  StreamManager,
  DEFAULT_EXECUTOR_STREAMER_CONFIG,
  StreamConfig,
  StreamClient,
  ClientType
} from '../../../src/modules/executor-streamer';

describe('StreamManager', () => {
  let streamManager: StreamManager;

  beforeEach(() => {
    streamManager = new StreamManager(DEFAULT_EXECUTOR_STREAMER_CONFIG);
  });

  afterEach(async () => {
    await streamManager.shutdown();
  });

  describe('Module Interface', () => {
    test('should have correct module ID', () => {
      expect(streamManager.moduleId).toBe('executor-streamer');
    });

    test('should start with no sessions', () => {
      const stats = streamManager.getStats();
      expect(stats.totalSessions).toBe(0);
      expect(stats.activeSessions).toBe(0);
      expect(stats.totalClients).toBe(0);
    });
  });

  describe('Session Management', () => {
    test('should create stream sessions', async () => {
      const workflowSessionId = 'test-workflow-session';
      
      const streamId = await streamManager.createSession(workflowSessionId);
      
      expect(streamId).toBeTruthy();
      expect(streamManager.sessionExists(workflowSessionId)).toBe(true);
      
      const session = streamManager.getSession(workflowSessionId);
      expect(session).toBeTruthy();
      expect(session!.linkedWorkflowSessionId).toBe(workflowSessionId);
      expect(session!.status).toBe(SessionStatus.ACTIVE);
      expect(session!.moduleId).toBe('executor-streamer');
    });

    test('should prevent duplicate session creation', async () => {
      const workflowSessionId = 'duplicate-session';
      
      await streamManager.createSession(workflowSessionId);
      
      await expect(streamManager.createSession(workflowSessionId))
        .rejects.toThrow('Stream session already exists');
    });

    test('should destroy sessions', async () => {
      const workflowSessionId = 'destroy-session';
      
      await streamManager.createSession(workflowSessionId);
      expect(streamManager.sessionExists(workflowSessionId)).toBe(true);
      
      await streamManager.destroySession(workflowSessionId);
      expect(streamManager.sessionExists(workflowSessionId)).toBe(false);
      expect(streamManager.getSession(workflowSessionId)).toBeNull();
    });

    test('should handle destroying non-existent session gracefully', async () => {
      await expect(streamManager.destroySession('non-existent'))
        .resolves.toBeUndefined();
    });

    test('should update session status', async () => {
      const workflowSessionId = 'status-session';
      
      await streamManager.createSession(workflowSessionId);
      expect(streamManager.getSessionStatus(workflowSessionId)).toBe(SessionStatus.ACTIVE);
      
      await streamManager.updateSessionStatus(workflowSessionId, SessionStatus.BUSY);
      expect(streamManager.getSessionStatus(workflowSessionId)).toBe(SessionStatus.BUSY);
      
      await streamManager.updateSessionStatus(workflowSessionId, SessionStatus.PAUSED);
      expect(streamManager.getSessionStatus(workflowSessionId)).toBe(SessionStatus.PAUSED);
    });

    test('should throw error when updating non-existent session status', async () => {
      await expect(streamManager.updateSessionStatus('non-existent', SessionStatus.BUSY))
        .rejects.toThrow('Stream session not found');
    });

    test('should record and retrieve activity', async () => {
      const workflowSessionId = 'activity-session';
      
      await streamManager.createSession(workflowSessionId);
      const initialActivity = streamManager.getLastActivity(workflowSessionId);
      expect(initialActivity).toBeTruthy();
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 50));
      
      await streamManager.recordActivity(workflowSessionId);
      const updatedActivity = streamManager.getLastActivity(workflowSessionId);
      
      expect(updatedActivity!.getTime()).toBeGreaterThanOrEqual(initialActivity!.getTime());
    }, 10000);

    test('should handle activity recording for non-existent session', async () => {
      await expect(streamManager.recordActivity('non-existent'))
        .resolves.toBeUndefined();
      
      expect(streamManager.getLastActivity('non-existent')).toBeNull();
    });
  });

  describe('Stream-specific Operations', () => {
    test('should create streams', async () => {
      const workflowSessionId = 'stream-create-session';
      
      const streamId = await streamManager.createStream(workflowSessionId);
      expect(streamId).toBeTruthy();
      
      const stream = streamManager.getStream(workflowSessionId);
      expect(stream).toBeTruthy();
      expect(stream!.streamId).toBe(streamId);
      expect(stream!.isActive).toBe(true);
      expect(stream!.clients).toEqual([]);
      expect(stream!.history).toEqual([]);
    });

    test('should create streams with custom configuration', async () => {
      const workflowSessionId = 'custom-config-session';
      const customConfig: StreamConfig = {
        maxHistorySize: 5000,
        bufferSize: 500,
        enableReplay: false,
        compressionEnabled: false,
        heartbeatInterval: 60000,
        maxClients: 50,
        eventFilters: [],
        persistence: {
          enabled: false,
          storageType: 'memory',
          retentionPeriod: 3600000
        }
      };
      
      const streamId = await streamManager.createStream(workflowSessionId, customConfig);
      const stream = streamManager.getStream(workflowSessionId);
      
      expect(stream!.config.maxHistorySize).toBe(5000);
      expect(stream!.config.bufferSize).toBe(500);
      expect(stream!.config.enableReplay).toBe(false);
      expect(stream!.config.compressionEnabled).toBe(false);
      expect(stream!.config.heartbeatInterval).toBe(60000);
      expect(stream!.config.maxClients).toBe(50);
      expect(stream!.config.persistence.enabled).toBe(false);
    });

    test('should list active streams', async () => {
      const session1 = 'active-stream-1';
      const session2 = 'active-stream-2';
      const session3 = 'inactive-stream';
      
      await streamManager.createStream(session1);
      await streamManager.createStream(session2);
      await streamManager.createStream(session3);
      
      // Make one stream inactive
      await streamManager.updateSessionStatus(session3, SessionStatus.COMPLETED);
      
      const activeStreams = streamManager.listActiveStreams();
      expect(activeStreams).toContain(session1);
      expect(activeStreams).toContain(session2);
      expect(activeStreams).not.toContain(session3);
    });

    test('should destroy streams', async () => {
      const workflowSessionId = 'destroy-stream-session';
      
      await streamManager.createStream(workflowSessionId);
      expect(streamManager.getStream(workflowSessionId)).toBeTruthy();
      
      await streamManager.destroyStream(workflowSessionId);
      expect(streamManager.getStream(workflowSessionId)).toBeNull();
    });
  });

  describe('Client Management', () => {
    test('should attach clients to streams', async () => {
      const workflowSessionId = 'client-attach-session';
      await streamManager.createStream(workflowSessionId);
      
      const mockClient: StreamClient = {
        id: 'client_001',
        type: ClientType.WEBSOCKET,
        connection: {} as any,
        connectedAt: new Date(),
        lastPing: new Date(),
        isActive: true
      };
      
      await streamManager.attachClient(workflowSessionId, mockClient);
      
      const stream = streamManager.getStream(workflowSessionId);
      expect(stream!.clients).toHaveLength(1);
      expect(stream!.clients[0].id).toBe('client_001');
      expect(stream!.clients[0].type).toBe(ClientType.WEBSOCKET);
    });

    test('should detach clients from streams', async () => {
      const workflowSessionId = 'client-detach-session';
      await streamManager.createStream(workflowSessionId);
      
      const mockClient: StreamClient = {
        id: 'client_002',
        type: ClientType.SERVER_SENT_EVENTS,
        connection: {} as any,
        connectedAt: new Date(),
        lastPing: new Date(),
        isActive: true
      };
      
      await streamManager.attachClient(workflowSessionId, mockClient);
      
      let stream = streamManager.getStream(workflowSessionId);
      expect(stream!.clients).toHaveLength(1);
      
      await streamManager.detachClient(workflowSessionId, 'client_002');
      
      stream = streamManager.getStream(workflowSessionId);
      expect(stream!.clients).toHaveLength(0);
    });

    test('should handle client limit enforcement', async () => {
      const workflowSessionId = 'client-limit-session';
      const customConfig: StreamConfig = {
        ...DEFAULT_EXECUTOR_STREAMER_CONFIG.defaultStreamConfig,
        maxClients: 2
      };
      
      await streamManager.createStream(workflowSessionId, customConfig);
      
      const client1: StreamClient = {
        id: 'client_1',
        type: ClientType.WEBSOCKET,
        connection: {} as any,
        connectedAt: new Date(),
        lastPing: new Date(),
        isActive: true
      };
      
      const client2: StreamClient = {
        id: 'client_2',
        type: ClientType.WEBSOCKET,
        connection: {} as any,
        connectedAt: new Date(),
        lastPing: new Date(),
        isActive: true
      };
      
      const client3: StreamClient = {
        id: 'client_3',
        type: ClientType.WEBSOCKET,
        connection: {} as any,
        connectedAt: new Date(),
        lastPing: new Date(),
        isActive: true
      };
      
      await streamManager.attachClient(workflowSessionId, client1);
      await streamManager.attachClient(workflowSessionId, client2);
      
      await expect(streamManager.attachClient(workflowSessionId, client3))
        .rejects.toThrow('Maximum clients limit reached');
    });

    test('should handle attaching client to non-existent stream', async () => {
      const mockClient: StreamClient = {
        id: 'client_orphan',
        type: ClientType.WEBSOCKET,
        connection: {} as any,
        connectedAt: new Date(),
        lastPing: new Date(),
        isActive: true
      };
      
      await expect(streamManager.attachClient('non-existent', mockClient))
        .rejects.toThrow('Stream session not found');
    });

    test('should handle detaching client from non-existent stream gracefully', async () => {
      await expect(streamManager.detachClient('non-existent', 'client_id'))
        .resolves.toBeUndefined();
    });
  });

  describe('Lifecycle Callbacks', () => {
    test('should call lifecycle callbacks', async () => {
      const onSessionCreated = jest.fn();
      const onSessionDestroyed = jest.fn();
      const onSessionStatusChanged = jest.fn();
      const onSessionError = jest.fn();
      
      const callbacks: SessionLifecycleCallbacks = {
        onSessionCreated,
        onSessionDestroyed,
        onSessionStatusChanged,
        onSessionError
      };
      
      streamManager.setLifecycleCallbacks(callbacks);
      
      const workflowSessionId = 'callback-session';
      
      // Create session
      await streamManager.createSession(workflowSessionId);
      expect(onSessionCreated).toHaveBeenCalledWith(
        'executor-streamer',
        workflowSessionId,
        expect.any(String)
      );
      
      // Update status
      await streamManager.updateSessionStatus(workflowSessionId, SessionStatus.BUSY);
      expect(onSessionStatusChanged).toHaveBeenCalledWith(
        'executor-streamer',
        workflowSessionId,
        SessionStatus.ACTIVE,
        SessionStatus.BUSY
      );
      
      // Destroy session
      await streamManager.destroySession(workflowSessionId);
      expect(onSessionDestroyed).toHaveBeenCalledWith(
        'executor-streamer',
        workflowSessionId
      );
    });
  });

  describe('Health Checks', () => {
    test('should perform health checks on healthy system', async () => {
      const workflowSessionId = 'healthy-session';
      await streamManager.createSession(workflowSessionId);
      
      const health = await streamManager.healthCheck();
      
      expect(health.moduleId).toBe('executor-streamer');
      expect(health.isHealthy).toBe(true);
      expect(health.activeSessions).toBe(1);
      expect(health.totalSessions).toBe(1);
      expect(health.errors).toHaveLength(0);
      expect(health.lastHealthCheck).toBeInstanceOf(Date);
    });

    test('should detect stale sessions in health check', async () => {
      const workflowSessionId = 'stale-session';
      await streamManager.createSession(workflowSessionId);
      
      // Get the stream and manually set old activity time
      const stream = streamManager.getStream(workflowSessionId);
      stream!.lastActivity = new Date(Date.now() - 20 * 60 * 1000); // 20 minutes ago
      
      const health = await streamManager.healthCheck();
      
      expect(health.isHealthy).toBe(false);
      expect(health.errors.length).toBeGreaterThan(0);
      expect(health.errors[0]).toMatchObject({
        sessionId: workflowSessionId,
        error: 'Session appears stale'
      });
    });

    test('should detect stale clients in health check', async () => {
      const workflowSessionId = 'stale-client-session';
      await streamManager.createStream(workflowSessionId);
      
      const staleClient: StreamClient = {
        id: 'stale_client',
        type: ClientType.WEBSOCKET,
        connection: {} as any,
        connectedAt: new Date(),
        lastPing: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
        isActive: true
      };
      
      await streamManager.attachClient(workflowSessionId, staleClient);
      
      const health = await streamManager.healthCheck();
      
      expect(health.isHealthy).toBe(false);
      expect(health.errors.length).toBeGreaterThan(0);
      expect(health.errors[0]).toMatchObject({
        sessionId: workflowSessionId,
        error: 'Stale clients detected',
        staleClientsCount: 1
      });
    });
  });

  describe('Configuration Management', () => {
    test('should update configuration', () => {
      const newConfig = {
        ...DEFAULT_EXECUTOR_STREAMER_CONFIG,
        server: {
          port: 5001,
          host: 'new-host',
          maxConnections: 2000
        }
      };
      
      streamManager.updateConfig(newConfig);
      const config = streamManager.getConfig();
      
      expect(config.server.port).toBe(5001);
      expect(config.server.host).toBe('new-host');
      expect(config.server.maxConnections).toBe(2000);
    });

    test('should return copy of configuration', () => {
      const config1 = streamManager.getConfig();
      const config2 = streamManager.getConfig();
      
      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Should be different objects
      
      // Modifying returned config should not affect internal config
      config1.server.port = 9999;
      expect(streamManager.getConfig().server.port).not.toBe(9999);
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should provide accurate statistics', async () => {
      const session1 = 'stats-session-1';
      const session2 = 'stats-session-2';
      
      await streamManager.createStream(session1);
      await streamManager.createStream(session2);
      
      const mockClient: StreamClient = {
        id: 'stats_client',
        type: ClientType.WEBSOCKET,
        connection: {} as any,
        connectedAt: new Date(),
        lastPing: new Date(),
        isActive: true
      };
      
      await streamManager.attachClient(session1, mockClient);
      
      const stats = streamManager.getStats();
      
      expect(stats.totalSessions).toBe(2);
      expect(stats.activeSessions).toBe(2);
      expect(stats.totalClients).toBe(1);
      expect(stats.averageClientsPerStream).toBe(0.5);
      expect(stats.uptime).toBeGreaterThan(0);
    });

    test('should track uptime correctly', async () => {
      const initialStats = streamManager.getStats();
      const initialUptime = initialStats.uptime;
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const laterStats = streamManager.getStats();
      const laterUptime = laterStats.uptime;
      
      expect(laterUptime).toBeGreaterThan(initialUptime);
    });
  });

  describe('Error Handling', () => {
    test('should handle session creation errors gracefully', async () => {
      const workflowSessionId = 'error-session';
      
      // Create a session first
      await streamManager.createSession(workflowSessionId);
      
      // Try to create again - should throw error and not leave partial state
      await expect(streamManager.createSession(workflowSessionId))
        .rejects.toThrow();
      
      // Original session should still exist and be valid
      expect(streamManager.sessionExists(workflowSessionId)).toBe(true);
      expect(streamManager.getStream(workflowSessionId)).toBeTruthy();
    });

    test('should handle session destruction errors gracefully', async () => {
      const workflowSessionId = 'destroy-error-session';
      await streamManager.createStream(workflowSessionId);
      
      // Get the stream and add a problematic client
      const stream = streamManager.getStream(workflowSessionId);
      const problematicClient: StreamClient = {
        id: 'problem_client',
        type: ClientType.WEBSOCKET,
        connection: {
          close: () => { throw new Error('Close error'); }
        } as any,
        connectedAt: new Date(),
        lastPing: new Date(),
        isActive: true
      };
      
      stream!.clients.push(problematicClient);
      
      // Destruction should succeed despite client close error
      await expect(streamManager.destroySession(workflowSessionId))
        .resolves.toBeUndefined();
      
      expect(streamManager.sessionExists(workflowSessionId)).toBe(false);
    });
  });

  describe('Shutdown', () => {
    test('should shutdown gracefully', async () => {
      const session1 = 'shutdown-session-1';
      const session2 = 'shutdown-session-2';
      
      await streamManager.createStream(session1);
      await streamManager.createStream(session2);
      
      expect(streamManager.getStats().totalSessions).toBe(2);
      
      await streamManager.shutdown();
      
      // All sessions should be destroyed
      expect(streamManager.sessionExists(session1)).toBe(false);
      expect(streamManager.sessionExists(session2)).toBe(false);
      expect(streamManager.getStats().totalSessions).toBe(0);
    });

    test('should handle shutdown errors gracefully', async () => {
      const workflowSessionId = 'shutdown-error-session';
      await streamManager.createStream(workflowSessionId);
      
      // Mock a client that will error on disconnect
      const stream = streamManager.getStream(workflowSessionId);
      const errorClient: StreamClient = {
        id: 'error_client',
        type: ClientType.WEBSOCKET,
        connection: {
          close: () => { throw new Error('Shutdown error'); }
        } as any,
        connectedAt: new Date(),
        lastPing: new Date(),
        isActive: true
      };
      
      stream!.clients.push(errorClient);
      
      // Shutdown should complete despite errors
      await expect(streamManager.shutdown()).resolves.toBeUndefined();
    });
  });
});
