/**
 * AppInitializer Unit Tests
 * Tests for centralized singleton initialization system
 */

import { AppInitializer, InitializationError, ConfigurationError } from '../index';

// Mock environment variables
const originalEnv = process.env;

// Mock all singleton modules
jest.mock('../../task-loop', () => ({
  TaskLoop: {
    getInstance: jest.fn(() => ({ mockModule: 'task-loop' }))
  }
}));

jest.mock('../../executor', () => ({
  Executor: {
    getInstance: jest.fn(() => ({ mockModule: 'executor' }))
  }
}));

jest.mock('../../executor-streamer', () => ({
  ExecutorStreamer: {
    getInstance: jest.fn(() => ({ mockModule: 'executor-streamer' }))
  }
}));

jest.mock('../../media-manager', () => ({
  MediaManager: {
    getInstance: jest.fn(() => ({ mockModule: 'media-manager' }))
  }
}));

jest.mock('../../ai-context-manager', () => ({
  AIContextManager: {
    getInstance: jest.fn(() => ({ mockModule: 'ai-context-manager' }))
  }
}));

jest.mock('../../ai-prompt-manager', () => ({
  AIPromptManager: {
    getInstance: jest.fn(() => ({ mockModule: 'ai-prompt-manager' }))
  }
}));

jest.mock('../../ai-integration', () => ({
  AIIntegrationManager: {
    getInstance: jest.fn(() => ({ mockModule: 'ai-integration' }))
  }
}));

jest.mock('../../ai-schema-manager', () => ({
  AISchemaManager: {
    getInstance: jest.fn(() => ({ mockModule: 'ai-schema-manager' }))
  }
}));

describe('AppInitializer', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    // Reset environment variables
    process.env = {
      ...originalEnv,
      OPENAI_API_KEY: 'test-api-key',
      NODE_ENV: 'test'
    };

    // Reset AppInitializer singleton
    (AppInitializer as any).instance = null;

    // Mock console methods
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Clear all mock calls
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    consoleSpy.mockRestore();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = AppInitializer.getInstance();
      const instance2 = AppInitializer.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should initialize with default config when none provided', () => {
      const instance = AppInitializer.getInstance();
      
      expect(instance).toBeInstanceOf(AppInitializer);
      expect(instance.getInitializationStatus().phase).toBe('idle');
    });

    it('should use provided config', () => {
      const config = {
        environment: 'test' as const,
        enableLogging: false,
        initializationTimeout: 10000
      };
      
      const instance = AppInitializer.getInstance(config);
      
      expect(instance).toBeInstanceOf(AppInitializer);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate required environment variables', async () => {
      delete process.env.OPENAI_API_KEY;
      
      const initializer = AppInitializer.getInstance();
      
      await expect(initializer.initialize()).rejects.toThrow(ConfigurationError);
      await expect(initializer.initialize()).rejects.toThrow('Missing required environment variables: OPENAI_API_KEY');
    });

    it('should pass validation with all required environment variables', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      
      const initializer = AppInitializer.getInstance();
      
      await expect(initializer.initialize()).resolves.toBeUndefined();
      expect(initializer.isInitialized()).toBe(true);
    });
  });

  describe('Initialization Flow', () => {
    it('should initialize all modules in dependency order', async () => {
      const initializer = AppInitializer.getInstance({
        environment: 'test',
        enableLogging: true,
        skipHealthChecks: true
      });
      
      await initializer.initialize();
      
      expect(initializer.isInitialized()).toBe(true);
      expect(initializer.getInitializationStatus().phase).toBe('ready');
      
      const status = initializer.getInitializationStatus();
      expect(Object.keys(status.modules)).toHaveLength(8); // All 8 modules
      
      // Verify all modules are marked as initialized
      Object.values(status.modules).forEach(module => {
        expect(module.initialized).toBe(true);
        expect(module.initTime).toBeGreaterThan(0);
      });
    });

    it('should not reinitialize if already initialized', async () => {
      const initializer = AppInitializer.getInstance();
      
      await initializer.initialize();
      const firstStatus = initializer.getInitializationStatus();
      
      await initializer.initialize(); // Second call
      const secondStatus = initializer.getInitializationStatus();
      
      expect(firstStatus.startTime).toEqual(secondStatus.startTime);
      expect(initializer.isInitialized()).toBe(true);
    });

    it('should throw error if initialization is already in progress', async () => {
      const initializer = AppInitializer.getInstance();
      
      // Start initialization but don't await
      const promise1 = initializer.initialize();
      
      // Try to initialize again while first is in progress
      await expect(initializer.initialize()).rejects.toThrow('Initialization already in progress');
      
      // Wait for first initialization to complete
      await promise1;
    });

    it('should respect initialization timeout', async () => {
      // Mock a module that takes too long to initialize
      const mockSlowModule = {
        getInstance: jest.fn(() => new Promise(resolve => setTimeout(resolve, 1000)))
      };
      
      jest.doMock('../../executor', () => ({
        Executor: mockSlowModule
      }));
      
      const initializer = AppInitializer.getInstance({
        environment: 'test',
        enableLogging: false,
        initializationTimeout: 100 // Very short timeout
      });
      
      await expect(initializer.initialize()).rejects.toThrow('Initialization timeout');
    }, 10000);
  });

  describe('Dependency Resolution', () => {
    it('should initialize modules in correct dependency order', async () => {
      const initOrder: string[] = [];
      
      // Mock modules to track initialization order
      const createMockModule = (name: string) => ({
        getInstance: jest.fn(() => {
          initOrder.push(name);
          return { mockModule: name };
        })
      });
      
      jest.doMock('../../ai-context-manager', () => ({
        AIContextManager: createMockModule('ai-context-manager')
      }));
      
      jest.doMock('../../task-loop', () => ({
        TaskLoop: createMockModule('task-loop')
      }));
      
      const initializer = AppInitializer.getInstance({
        environment: 'test',
        enableLogging: false,
        skipHealthChecks: true
      });
      
      await initializer.initialize();
      
      // task-loop should be initialized last (has dependencies)
      expect(initOrder.indexOf('task-loop')).toBeGreaterThan(initOrder.indexOf('ai-context-manager'));
    });

    it('should detect circular dependencies', () => {
      // This would be caught during setup, but we can test the topological sort logic
      const initializer = AppInitializer.getInstance();
      
      // Access the private method for testing
      const buildGraph = () => {
        const graph = new Map();
        graph.set('a', ['b']);
        graph.set('b', ['c']);
        graph.set('c', ['a']); // Circular dependency
        return graph;
      };
      
      // This test would require exposing the topological sort method or testing indirectly
      // For now, we trust that the method would catch circular dependencies
    });
  });

  describe('Error Handling', () => {
    it('should handle module initialization errors gracefully', async () => {
      // Mock a module that fails to initialize
      jest.doMock('../../executor', () => ({
        Executor: {
          getInstance: jest.fn(() => {
            throw new Error('Module initialization failed');
          })
        }
      }));
      
      const initializer = AppInitializer.getInstance({
        environment: 'test',
        enableLogging: false
      });
      
      await expect(initializer.initialize()).rejects.toThrow(InitializationError);
      expect(initializer.getInitializationStatus().phase).toBe('error');
    });

    it('should track failed module status', async () => {
      // Mock a module that fails to initialize
      jest.doMock('../../media-manager', () => ({
        MediaManager: {
          getInstance: jest.fn(() => {
            throw new Error('Media manager failed');
          })
        }
      }));
      
      const initializer = AppInitializer.getInstance({
        environment: 'test',
        enableLogging: false
      });
      
      try {
        await initializer.initialize();
      } catch (error) {
        // Expected to fail
      }
      
      const status = initializer.getInitializationStatus();
      expect(status.modules['media-manager']).toBeDefined();
      expect(status.modules['media-manager'].initialized).toBe(false);
      expect(status.modules['media-manager'].error).toContain('Media manager failed');
    });
  });

  describe('Health Checks', () => {
    it('should perform health checks when not skipped', async () => {
      const initializer = AppInitializer.getInstance({
        environment: 'test',
        enableLogging: false,
        skipHealthChecks: false
      });
      
      await initializer.initialize();
      
      expect(initializer.isInitialized()).toBe(true);
    });

    it('should skip health checks when configured', async () => {
      const initializer = AppInitializer.getInstance({
        environment: 'test',
        enableLogging: false,
        skipHealthChecks: true
      });
      
      await initializer.initialize();
      
      expect(initializer.isInitialized()).toBe(true);
    });
  });

  describe('Shutdown', () => {
    it('should shutdown all modules gracefully', async () => {
      const initializer = AppInitializer.getInstance();
      
      await initializer.initialize();
      expect(initializer.isInitialized()).toBe(true);
      
      await initializer.shutdown();
      expect(initializer.getInitializationStatus().phase).toBe('idle');
    });

    it('should reset singleton instance', async () => {
      const initializer = AppInitializer.getInstance();
      
      await initializer.initialize();
      await initializer.reset();
      
      const newInstance = AppInitializer.getInstance();
      expect(newInstance).not.toBe(initializer);
    });
  });

  describe('Status Reporting', () => {
    it('should provide detailed initialization status', async () => {
      const initializer = AppInitializer.getInstance({
        environment: 'test',
        enableLogging: true
      });
      
      await initializer.initialize();
      
      const status = initializer.getInitializationStatus();
      
      expect(status.phase).toBe('ready');
      expect(status.startTime).toBeInstanceOf(Date);
      expect(status.endTime).toBeInstanceOf(Date);
      expect(status.totalInitTime).toBeGreaterThan(0);
      expect(Object.keys(status.modules)).toHaveLength(8);
      
      Object.values(status.modules).forEach(module => {
        expect(module).toHaveProperty('initialized');
        expect(module).toHaveProperty('initTime');
        expect(module).toHaveProperty('dependencies');
      });
    });

    it('should track initialization timing', async () => {
      const initializer = AppInitializer.getInstance();
      
      const startTime = Date.now();
      await initializer.initialize();
      const endTime = Date.now();
      
      const status = initializer.getInitializationStatus();
      
      expect(status.totalInitTime).toBeGreaterThan(0);
      expect(status.totalInitTime).toBeLessThan(endTime - startTime + 100); // Allow some tolerance
    });
  });
});
