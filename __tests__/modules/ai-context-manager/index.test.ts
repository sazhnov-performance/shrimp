/**
 * Unit Tests for AI Context Manager Module Exports
 * Tests the module's export structure and public API
 */

import { 
  AIContextManager,
  AI_CONTEXT_MANAGER_TOKEN
} from '../../../src/modules/ai-context-manager';

import type { 
  IAIContextManager, 
  ContextData, 
  AIContextManagerConfig
} from '../../../src/modules/ai-context-manager';

describe('AI Context Manager Module Exports', () => {
  describe('Class Exports', () => {
    it('should export AIContextManager class', () => {
      expect(AIContextManager).toBeDefined();
      expect(typeof AIContextManager).toBe('function');
    });

    it('should create AIContextManager instance', () => {
      const manager = new AIContextManager();
      expect(manager).toBeInstanceOf(AIContextManager);
    });

    it('should implement IAIContextManager interface', () => {
      const manager = new AIContextManager();
      
      // Check that all interface methods exist
      expect(typeof manager.createContext).toBe('function');
      expect(typeof manager.setSteps).toBe('function');
      expect(typeof manager.logTask).toBe('function');
      expect(typeof manager.getStepContext).toBe('function');
      expect(typeof manager.getFullContext).toBe('function');
    });
  });

  describe('Type Exports', () => {
    it('should export AI_CONTEXT_MANAGER_TOKEN', () => {
      expect(AI_CONTEXT_MANAGER_TOKEN).toBeDefined();
      expect(typeof AI_CONTEXT_MANAGER_TOKEN).toBe('string');
      expect(AI_CONTEXT_MANAGER_TOKEN).toBe('IAIContextManager');
    });
  });

  describe('Interface Compliance', () => {
    let manager: IAIContextManager;

    beforeEach(() => {
      manager = new AIContextManager();
    });

    it('should comply with IAIContextManager interface contract', () => {
      const contextId = 'interface-test';
      const steps = ['Step 1', 'Step 2'];
      const taskData = { test: 'data' };

      // Test interface contract
      manager.createContext(contextId);
      manager.setSteps(contextId, steps);
      manager.logTask(contextId, 0, taskData);
      
      const stepContext = manager.getStepContext(contextId, 0);
      const fullContext = manager.getFullContext(contextId);

      expect(stepContext).toEqual([taskData]);
      expect(fullContext.contextId).toBe(contextId);
      expect(fullContext.steps).toEqual(steps);
    });

    it('should return properly typed ContextData', () => {
      const contextId = 'type-test';
      
      manager.createContext(contextId);
      manager.setSteps(contextId, ['Test Step']);
      
      const context: ContextData = manager.getFullContext(contextId);
      
      expect(typeof context.contextId).toBe('string');
      expect(Array.isArray(context.steps)).toBe(true);
      expect(typeof context.stepLogs).toBe('object');
      expect(context.createdAt).toBeInstanceOf(Date);
      expect(context.lastUpdated).toBeInstanceOf(Date);
    });
  });

  describe('Configuration Types', () => {
    it('should accept AIContextManagerConfig type', () => {
      const config: AIContextManagerConfig = {
        maxContexts: 50,
        maxLogsPerStep: 200,
        enableMetrics: true
      };

      const manager = new AIContextManager(config);
      const actualConfig = manager.getConfig();
      
      expect(actualConfig.maxContexts).toBe(config.maxContexts);
      expect(actualConfig.maxLogsPerStep).toBe(config.maxLogsPerStep);
      expect(actualConfig.enableMetrics).toBe(config.enableMetrics);
    });

    it('should accept partial AIContextManagerConfig', () => {
      const partialConfig: AIContextManagerConfig = {
        maxContexts: 25
      };

      const manager = new AIContextManager(partialConfig);
      const actualConfig = manager.getConfig();
      
      expect(actualConfig.maxContexts).toBe(25);
      expect(actualConfig.maxLogsPerStep).toBe(1000); // default
      expect(actualConfig.enableMetrics).toBe(false); // default
    });
  });
});
