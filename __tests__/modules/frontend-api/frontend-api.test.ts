/**
 * Frontend API Unit Tests
 * Tests for the main Frontend API class and session management
 */

import { FrontendAPI } from '../../../src/modules/frontend-api/frontend-api';
import { FrontendAPIConfig, DEFAULT_FRONTEND_API_CONFIG } from '../../../src/modules/frontend-api/types';
import { SessionStatus, LogLevel } from '../../../types/shared-types';

// Mock dependencies
const mockSessionCoordinator = {
  registerModule: jest.fn(),
  createWorkflowSession: jest.fn(),
  destroyWorkflowSession: jest.fn(),
  getWorkflowSession: jest.fn(),
  listActiveWorkflowSessions: jest.fn(),
  linkModuleSession: jest.fn(),
  unlinkModuleSession: jest.fn(),
  getLinkedSessions: jest.fn(),
  onWorkflowSessionCreated: jest.fn(),
  onWorkflowSessionDestroyed: jest.fn(),
  onModuleSessionLinked: jest.fn(),
  getCoordinatorHealth: jest.fn(),
  validateSessionIntegrity: jest.fn()
};

const mockDIContainer = {
  register: jest.fn(),
  resolve: jest.fn(),
  resolveAll: jest.fn(),
  createScope: jest.fn()
};

const mockStepProcessor = {
  processSteps: jest.fn(),
  getExecutionProgress: jest.fn(),
  pauseSession: jest.fn(),
  resumeSession: jest.fn(),
  cancelSession: jest.fn()
};

const mockExecutorStreamer = {
  getStreamInfo: jest.fn(),
  getClientCount: jest.fn(),
  getEventCount: jest.fn(),
  getEventHistory: jest.fn()
};

describe('FrontendAPI', () => {
  let frontendAPI: FrontendAPI;
  let testConfig: FrontendAPIConfig;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create test configuration
    testConfig = {
      ...DEFAULT_FRONTEND_API_CONFIG,
      logging: {
        level: LogLevel.DEBUG,
        prefix: '[FrontendAPI-Test]',
        includeTimestamp: true,
        includeSessionId: true,
        includeModuleId: true,
        structured: false
      },
      server: {
        port: 3001,
        host: 'localhost',
        cors: {
          origins: ['http://localhost:3000'],
          methods: ['GET', 'POST'],
          allowedHeaders: ['Content-Type']
        }
      }
    };

    // Create Frontend API instance
    frontendAPI = new FrontendAPI(testConfig);

    // Setup DI container mocks
    mockDIContainer.resolve.mockImplementation((token: string) => {
      switch (token) {
        case 'SessionCoordinator':
          return mockSessionCoordinator;
        case 'IStepProcessor':
          return mockStepProcessor;
        case 'IExecutorStreamer':
          return mockExecutorStreamer;
        case 'IExecutorStreamerManager':
          return mockExecutorStreamer;
        case 'ITaskLoop':
          return {};
        case 'IAIIntegration':
          return {};
        case 'IAIContextManager':
          return {};
        default:
          return {};
      }
    });
  });

  describe('Initialization', () => {
    it('should create Frontend API instance with default config', () => {
      const defaultAPI = new FrontendAPI();
      expect(defaultAPI.moduleId).toBe('frontend-api');
      expect(defaultAPI.isInitializedStatus()).toBe(false);
      expect(defaultAPI.isRunning()).toBe(false);
    });

    it('should create Frontend API instance with custom config', () => {
      expect(frontendAPI.moduleId).toBe('frontend-api');
      expect(frontendAPI.getConfig().server.port).toBe(3001);
      expect(frontendAPI.isInitializedStatus()).toBe(false);
    });

    it('should initialize with DI container', async () => {
      try {
        await frontendAPI.initialize(mockDIContainer);
        
        expect(frontendAPI.isInitializedStatus()).toBe(true);
        expect(mockSessionCoordinator.registerModule).toHaveBeenCalledWith(
          'frontend-api',
          frontendAPI
        );
      } catch (error) {
        console.error('Initialization error:', error);
        throw error;
      }
    });

    it('should not initialize twice', async () => {
      await frontendAPI.initialize(mockDIContainer);
      await frontendAPI.initialize(mockDIContainer);
      
      // Should only register once
      expect(mockSessionCoordinator.registerModule).toHaveBeenCalledTimes(1);
    });
  });

  describe('Session Management', () => {
    beforeEach(async () => {
      await frontendAPI.initialize(mockDIContainer);
    });

    it('should create a session', async () => {
      const workflowSessionId = 'test-workflow-session';
      const sessionId = await frontendAPI.createSession(workflowSessionId);
      
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(frontendAPI.sessionExists(workflowSessionId)).toBe(true);
    });

    it('should get session information', async () => {
      const workflowSessionId = 'test-workflow-session';
      await frontendAPI.createSession(workflowSessionId);
      
      const session = frontendAPI.getSession(workflowSessionId);
      expect(session).toBeDefined();
      expect(session?.moduleId).toBe('frontend-api');
      expect(session?.linkedWorkflowSessionId).toBe(workflowSessionId);
    });

    it('should update session status', async () => {
      const workflowSessionId = 'test-workflow-session';
      await frontendAPI.createSession(workflowSessionId);
      
      await frontendAPI.updateSessionStatus(workflowSessionId, SessionStatus.ACTIVE);
      const status = frontendAPI.getSessionStatus(workflowSessionId);
      expect(status).toBe(SessionStatus.ACTIVE);
    });

    it('should record session activity', async () => {
      const workflowSessionId = 'test-workflow-session';
      await frontendAPI.createSession(workflowSessionId);
      
      const initialActivity = frontendAPI.getLastActivity(workflowSessionId);
      
      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      await frontendAPI.recordActivity(workflowSessionId);
      
      const updatedActivity = frontendAPI.getLastActivity(workflowSessionId);
      expect(updatedActivity).toBeDefined();
      expect(updatedActivity!.getTime()).toBeGreaterThan(initialActivity!.getTime());
    });

    it('should destroy a session', async () => {
      const workflowSessionId = 'test-workflow-session';
      await frontendAPI.createSession(workflowSessionId);
      
      expect(frontendAPI.sessionExists(workflowSessionId)).toBe(true);
      
      await frontendAPI.destroySession(workflowSessionId);
      expect(frontendAPI.sessionExists(workflowSessionId)).toBe(false);
    });

    it('should perform health check', async () => {
      const health = await frontendAPI.healthCheck();
      
      expect(health).toBeDefined();
      expect(health.moduleId).toBe('frontend-api');
      expect(health.isHealthy).toBe(true);
      expect(health.activeSessions).toBe(0);
      expect(health.totalSessions).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when creating session without initialization', async () => {
      const workflowSessionId = 'test-workflow-session';
      
      await expect(frontendAPI.createSession(workflowSessionId))
        .rejects.toThrow('Frontend API not initialized');
    });

    it('should handle session not found gracefully', async () => {
      await frontendAPI.initialize(mockDIContainer);
      
      const nonExistentSession = 'non-existent-session';
      expect(frontendAPI.getSession(nonExistentSession)).toBeNull();
      expect(frontendAPI.getSessionStatus(nonExistentSession)).toBeNull();
      expect(frontendAPI.getLastActivity(nonExistentSession)).toBeNull();
    });
  });

  describe('Configuration', () => {
    it('should return configuration', () => {
      const config = frontendAPI.getConfig();
      expect(config).toBeDefined();
      expect(config.moduleId).toBe('frontend-api');
      expect(config.server.port).toBe(3001);
    });

    it('should have integrations after initialization', async () => {
      expect(frontendAPI.getIntegrations()).toBeNull();
      
      await frontendAPI.initialize(mockDIContainer);
      
      const integrations = frontendAPI.getIntegrations();
      expect(integrations).toBeDefined();
      expect(integrations?.stepProcessor).toBeDefined();
      expect(integrations?.sessionCoordinator).toBeDefined();
    });
  });

  describe('Session Coordinator Integration', () => {
    beforeEach(async () => {
      await frontendAPI.initialize(mockDIContainer);
    });

    it('should set and get session coordinator', () => {
      const coordinator = frontendAPI.getSessionCoordinator();
      expect(coordinator).toBe(mockSessionCoordinator);
    });

    it('should register with session coordinator on initialization', () => {
      expect(mockSessionCoordinator.registerModule).toHaveBeenCalledWith(
        'frontend-api',
        frontendAPI
      );
    });
  });
});

describe('FrontendAPI Lifecycle Callbacks', () => {
  let frontendAPI: FrontendAPI;
  let lifecycleCallbacks: any;

  beforeEach(async () => {
    frontendAPI = new FrontendAPI(DEFAULT_FRONTEND_API_CONFIG);
    await frontendAPI.initialize(mockDIContainer);

    lifecycleCallbacks = {
      onSessionCreated: jest.fn(),
      onSessionStatusChanged: jest.fn(),
      onSessionDestroyed: jest.fn(),
      onSessionError: jest.fn()
    };

    frontendAPI.setLifecycleCallbacks(lifecycleCallbacks);
  });

  it('should trigger onSessionCreated callback', async () => {
    const workflowSessionId = 'test-workflow-session';
    const sessionId = await frontendAPI.createSession(workflowSessionId);
    
    expect(lifecycleCallbacks.onSessionCreated).toHaveBeenCalledWith(
      'frontend-api',
      workflowSessionId,
      sessionId
    );
  });

  it('should trigger onSessionStatusChanged callback', async () => {
    const workflowSessionId = 'test-workflow-session';
    await frontendAPI.createSession(workflowSessionId);
    
    await frontendAPI.updateSessionStatus(workflowSessionId, SessionStatus.PAUSED);
    
    expect(lifecycleCallbacks.onSessionStatusChanged).toHaveBeenCalledWith(
      'frontend-api',
      workflowSessionId,
      SessionStatus.ACTIVE,
      SessionStatus.PAUSED
    );
  });

  it('should trigger onSessionDestroyed callback', async () => {
    const workflowSessionId = 'test-workflow-session';
    await frontendAPI.createSession(workflowSessionId);
    
    await frontendAPI.destroySession(workflowSessionId);
    
    expect(lifecycleCallbacks.onSessionDestroyed).toHaveBeenCalledWith(
      'frontend-api',
      workflowSessionId
    );
  });
});
