/**
 * Unit Tests for AI Context Manager
 * Tests the core functionality of the AI Context Manager module
 */

import { AIContextManager } from '../../../src/modules/ai-context-manager/ai-context-manager';
import { AIContextManagerError } from '../../../types/ai-context-manager-types';

describe('AIContextManager', () => {
  let contextManager: AIContextManager;

  beforeEach(() => {
    contextManager = new AIContextManager();
  });

  describe('Constructor and Configuration', () => {
    it('should create instance with default configuration', () => {
      const manager = new AIContextManager();
      const config = manager.getConfig();
      
      expect(config.maxContexts).toBe(100);
      expect(config.maxLogsPerStep).toBe(1000);
      expect(config.enableMetrics).toBe(false);
    });

    it('should create instance with custom configuration', () => {
      const customConfig = {
        maxContexts: 50,
        maxLogsPerStep: 500,
        enableMetrics: true
      };
      
      const manager = new AIContextManager(customConfig);
      const config = manager.getConfig();
      
      expect(config.maxContexts).toBe(50);
      expect(config.maxLogsPerStep).toBe(500);
      expect(config.enableMetrics).toBe(true);
    });

    it('should create instance with partial configuration', () => {
      const partialConfig = {
        maxContexts: 75
      };
      
      const manager = new AIContextManager(partialConfig);
      const config = manager.getConfig();
      
      expect(config.maxContexts).toBe(75);
      expect(config.maxLogsPerStep).toBe(1000); // default
      expect(config.enableMetrics).toBe(false); // default
    });
  });

  describe('createContext', () => {
    it('should create a new context successfully', () => {
      const contextId = 'test-context-1';
      
      contextManager.createContext(contextId);
      
      expect(contextManager.contextExists(contextId)).toBe(true);
      const context = contextManager.getFullContext(contextId);
      expect(context.contextId).toBe(contextId);
      expect(context.steps).toEqual([]);
      expect(context.stepLogs).toEqual({});
      expect(context.createdAt).toBeInstanceOf(Date);
      expect(context.lastUpdated).toBeInstanceOf(Date);
    });

    it('should throw error when creating context with existing ID', () => {
      const contextId = 'duplicate-context';
      
      contextManager.createContext(contextId);
      
      expect(() => {
        contextManager.createContext(contextId);
      }).toThrow(AIContextManagerError);
      
      expect(() => {
        contextManager.createContext(contextId);
      }).toThrow(`Context with ID '${contextId}' already exists`);
    });

    it('should throw error for invalid context ID', () => {
      expect(() => {
        contextManager.createContext('');
      }).toThrow(AIContextManagerError);
      
      expect(() => {
        contextManager.createContext(null as any);
      }).toThrow(AIContextManagerError);
      
      expect(() => {
        contextManager.createContext(undefined as any);
      }).toThrow(AIContextManagerError);
    });

    it('should throw error when maximum contexts exceeded', () => {
      const manager = new AIContextManager({ maxContexts: 2 });
      
      manager.createContext('context-1');
      manager.createContext('context-2');
      
      expect(() => {
        manager.createContext('context-3');
      }).toThrow(AIContextManagerError);
      
      expect(() => {
        manager.createContext('context-3');
      }).toThrow('Maximum number of contexts (2) exceeded');
    });
  });

  describe('setSteps', () => {
    beforeEach(() => {
      contextManager.createContext('test-context');
    });

    it('should set steps for existing context', () => {
      const steps = ['Step 1', 'Step 2', 'Step 3'];
      
      contextManager.setSteps('test-context', steps);
      
      const context = contextManager.getFullContext('test-context');
      expect(context.steps).toEqual(steps);
      expect(Object.keys(context.stepLogs)).toHaveLength(3);
      expect(context.stepLogs[0]).toEqual([]);
      expect(context.stepLogs[1]).toEqual([]);
      expect(context.stepLogs[2]).toEqual([]);
    });

    it('should reset step logs when steps are redefined', () => {
      const initialSteps = ['Step 1', 'Step 2'];
      const newSteps = ['New Step 1', 'New Step 2', 'New Step 3'];
      
      contextManager.setSteps('test-context', initialSteps);
      contextManager.logTask('test-context', 0, { data: 'test' });
      
      contextManager.setSteps('test-context', newSteps);
      
      const context = contextManager.getFullContext('test-context');
      expect(context.steps).toEqual(newSteps);
      expect(Object.keys(context.stepLogs)).toHaveLength(3);
      expect(context.stepLogs[0]).toEqual([]);
    });

    it('should handle empty steps array', () => {
      contextManager.setSteps('test-context', []);
      
      const context = contextManager.getFullContext('test-context');
      expect(context.steps).toEqual([]);
      expect(context.stepLogs).toEqual({});
    });

    it('should throw error for non-existent context', () => {
      expect(() => {
        contextManager.setSteps('non-existent', ['Step 1']);
      }).toThrow(AIContextManagerError);
      
      expect(() => {
        contextManager.setSteps('non-existent', ['Step 1']);
      }).toThrow(`Context with ID 'non-existent' does not exist`);
    });

    it('should throw error for non-array steps', () => {
      expect(() => {
        contextManager.setSteps('test-context', 'not an array' as any);
      }).toThrow(AIContextManagerError);
      
      expect(() => {
        contextManager.setSteps('test-context', 'not an array' as any);
      }).toThrow('Steps must be an array');
    });

    it('should update lastUpdated timestamp', () => {
      const beforeTime = new Date();
      
      contextManager.setSteps('test-context', ['Step 1']);
      
      const context = contextManager.getFullContext('test-context');
      expect(context.lastUpdated.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    });
  });

  describe('logTask', () => {
    beforeEach(() => {
      contextManager.createContext('test-context');
      contextManager.setSteps('test-context', ['Step 1', 'Step 2']);
    });

    it('should log task for valid context and step', () => {
      const taskData = { action: 'click', element: 'button' };
      
      contextManager.logTask('test-context', 0, taskData);
      
      const stepLogs = contextManager.getStepContext('test-context', 0);
      expect(stepLogs).toHaveLength(1);
      expect(stepLogs[0]).toEqual(taskData);
    });

    it('should handle different data types', () => {
      const stringData = 'test string';
      const numberData = 42;
      const objectData = { complex: { nested: 'data' } };
      const arrayData = [1, 2, 3];
      const nullData = null;
      
      contextManager.logTask('test-context', 0, stringData);
      contextManager.logTask('test-context', 0, numberData);
      contextManager.logTask('test-context', 0, objectData);
      contextManager.logTask('test-context', 0, arrayData);
      contextManager.logTask('test-context', 0, nullData);
      
      const stepLogs = contextManager.getStepContext('test-context', 0);
      expect(stepLogs).toHaveLength(5);
      expect(stepLogs[0]).toBe(stringData);
      expect(stepLogs[1]).toBe(numberData);
      expect(stepLogs[2]).toEqual(objectData);
      expect(stepLogs[3]).toEqual(arrayData);
      expect(stepLogs[4]).toBe(nullData);
    });

    it('should append tasks to existing logs', () => {
      contextManager.logTask('test-context', 0, 'task1');
      contextManager.logTask('test-context', 0, 'task2');
      contextManager.logTask('test-context', 0, 'task3');
      
      const stepLogs = contextManager.getStepContext('test-context', 0);
      expect(stepLogs).toEqual(['task1', 'task2', 'task3']);
    });

    it('should throw error for non-existent context', () => {
      expect(() => {
        contextManager.logTask('non-existent', 0, 'task');
      }).toThrow(AIContextManagerError);
      
      expect(() => {
        contextManager.logTask('non-existent', 0, 'task');
      }).toThrow(`Context with ID 'non-existent' does not exist`);
    });

    it('should throw error for invalid step ID', () => {
      expect(() => {
        contextManager.logTask('test-context', -1, 'task');
      }).toThrow(AIContextManagerError);
      
      expect(() => {
        contextManager.logTask('test-context', 2, 'task');
      }).toThrow(AIContextManagerError);
      
      expect(() => {
        contextManager.logTask('test-context', 1.5, 'task');
      }).toThrow(AIContextManagerError);
    });

    it('should throw error when maximum logs per step exceeded', () => {
      const manager = new AIContextManager({ maxLogsPerStep: 2 });
      manager.createContext('test');
      manager.setSteps('test', ['Step 1']);
      
      manager.logTask('test', 0, 'task1');
      manager.logTask('test', 0, 'task2');
      
      expect(() => {
        manager.logTask('test', 0, 'task3');
      }).toThrow(AIContextManagerError);
      
      expect(() => {
        manager.logTask('test', 0, 'task3');
      }).toThrow('Maximum number of logs per step (2) exceeded for step 0');
    });

    it('should update lastUpdated timestamp', () => {
      const beforeTime = new Date();
      
      contextManager.logTask('test-context', 0, 'task');
      
      const context = contextManager.getFullContext('test-context');
      expect(context.lastUpdated.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    });
  });

  describe('getStepContext', () => {
    beforeEach(() => {
      contextManager.createContext('test-context');
      contextManager.setSteps('test-context', ['Step 1', 'Step 2']);
    });

    it('should return step logs for valid context and step', () => {
      const taskData1 = { id: 1 };
      const taskData2 = { id: 2 };
      
      contextManager.logTask('test-context', 0, taskData1);
      contextManager.logTask('test-context', 0, taskData2);
      
      const stepLogs = contextManager.getStepContext('test-context', 0);
      expect(stepLogs).toEqual([taskData1, taskData2]);
    });

    it('should return empty array for step with no logs', () => {
      const stepLogs = contextManager.getStepContext('test-context', 1);
      expect(stepLogs).toEqual([]);
    });

    it('should return copy of logs to prevent mutations', () => {
      const originalTask = { mutable: 'data' };
      contextManager.logTask('test-context', 0, originalTask);
      
      const stepLogs = contextManager.getStepContext('test-context', 0);
      stepLogs[0].mutable = 'modified';
      
      const stepLogsAgain = contextManager.getStepContext('test-context', 0);
      expect(stepLogsAgain[0].mutable).toBe('data');
    });

    it('should throw error for non-existent context', () => {
      expect(() => {
        contextManager.getStepContext('non-existent', 0);
      }).toThrow(AIContextManagerError);
    });

    it('should throw error for invalid step ID', () => {
      expect(() => {
        contextManager.getStepContext('test-context', -1);
      }).toThrow(AIContextManagerError);
      
      expect(() => {
        contextManager.getStepContext('test-context', 2);
      }).toThrow(AIContextManagerError);
    });
  });

  describe('getFullContext', () => {
    beforeEach(() => {
      contextManager.createContext('test-context');
      contextManager.setSteps('test-context', ['Step 1', 'Step 2']);
      contextManager.logTask('test-context', 0, 'task1');
      contextManager.logTask('test-context', 1, 'task2');
    });

    it('should return complete context data', () => {
      const context = contextManager.getFullContext('test-context');
      
      expect(context.contextId).toBe('test-context');
      expect(context.steps).toEqual(['Step 1', 'Step 2']);
      expect(context.stepLogs[0]).toEqual(['task1']);
      expect(context.stepLogs[1]).toEqual(['task2']);
      expect(context.createdAt).toBeInstanceOf(Date);
      expect(context.lastUpdated).toBeInstanceOf(Date);
    });

    it('should return deep copy to prevent mutations', () => {
      const context = contextManager.getFullContext('test-context');
      
      // Try to mutate the returned data
      context.steps.push('Modified Step');
      context.stepLogs[0].push('Modified Task');
      
      // Get context again and verify no changes
      const contextAgain = contextManager.getFullContext('test-context');
      expect(contextAgain.steps).toEqual(['Step 1', 'Step 2']);
      expect(contextAgain.stepLogs[0]).toEqual(['task1']);
    });

    it('should throw error for non-existent context', () => {
      expect(() => {
        contextManager.getFullContext('non-existent');
      }).toThrow(AIContextManagerError);
      
      expect(() => {
        contextManager.getFullContext('non-existent');
      }).toThrow(`Context with ID 'non-existent' does not exist`);
    });
  });

  describe('Utility Methods', () => {
    beforeEach(() => {
      contextManager.createContext('context1');
      contextManager.createContext('context2');
      contextManager.setSteps('context1', ['Step 1', 'Step 2']);
      contextManager.setSteps('context2', ['Step A']);
    });

    describe('getContextIds', () => {
      it('should return all context IDs', () => {
        const contextIds = contextManager.getContextIds();
        expect(contextIds).toContain('context1');
        expect(contextIds).toContain('context2');
        expect(contextIds).toHaveLength(2);
      });

      it('should return empty array when no contexts exist', () => {
        const emptyManager = new AIContextManager();
        const contextIds = emptyManager.getContextIds();
        expect(contextIds).toEqual([]);
      });
    });

    describe('contextExists', () => {
      it('should return true for existing context', () => {
        expect(contextManager.contextExists('context1')).toBe(true);
        expect(contextManager.contextExists('context2')).toBe(true);
      });

      it('should return false for non-existent context', () => {
        expect(contextManager.contextExists('non-existent')).toBe(false);
      });
    });

    describe('getMemoryStats', () => {
      it('should return accurate memory statistics', () => {
        contextManager.logTask('context1', 0, 'task1');
        contextManager.logTask('context1', 1, 'task2');
        contextManager.logTask('context2', 0, 'task3');
        
        const stats = contextManager.getMemoryStats();
        
        expect(stats.totalContexts).toBe(2);
        expect(stats.totalSteps).toBe(3); // context1: 2 steps, context2: 1 step
        expect(stats.totalLogs).toBe(3);
        expect(stats.avgLogsPerStep).toBe(1);
      });

      it('should handle empty contexts', () => {
        const emptyManager = new AIContextManager();
        const stats = emptyManager.getMemoryStats();
        
        expect(stats.totalContexts).toBe(0);
        expect(stats.totalSteps).toBe(0);
        expect(stats.totalLogs).toBe(0);
        expect(stats.avgLogsPerStep).toBe(0);
      });
    });

    describe('clearAllContexts', () => {
      it('should remove all contexts', () => {
        expect(contextManager.getContextIds()).toHaveLength(2);
        
        contextManager.clearAllContexts();
        
        expect(contextManager.getContextIds()).toHaveLength(0);
        expect(contextManager.contextExists('context1')).toBe(false);
        expect(contextManager.contextExists('context2')).toBe(false);
      });
    });
  });

  describe('Error Handling', () => {
    it('should include proper error information in AIContextManagerError', () => {
      contextManager.createContext('test-context');
      
      try {
        contextManager.logTask('test-context', 999, 'task');
      } catch (error) {
        expect(error).toBeInstanceOf(AIContextManagerError);
        const contextError = error as AIContextManagerError;
        expect(contextError.contextId).toBe('test-context');
        expect(contextError.stepId).toBe(999);
        expect(contextError.operation).toBe('logTask');
        expect(contextError.name).toBe('AIContextManagerError');
      }
    });

    it('should handle concurrent operations safely', () => {
      contextManager.createContext('concurrent-test');
      contextManager.setSteps('concurrent-test', ['Step 1']);
      
      // Simulate concurrent logging
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          Promise.resolve().then(() => {
            contextManager.logTask('concurrent-test', 0, `task-${i}`);
          })
        );
      }
      
      return Promise.all(promises).then(() => {
        const stepLogs = contextManager.getStepContext('concurrent-test', 0);
        expect(stepLogs).toHaveLength(10);
      });
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete workflow', () => {
      const workflowId = 'workflow-123';
      const steps = [
        'Navigate to login page',
        'Enter credentials',
        'Verify dashboard'
      ];
      
      // Initialize workflow
      contextManager.createContext(workflowId);
      contextManager.setSteps(workflowId, steps);
      
      // Simulate step execution
      contextManager.logTask(workflowId, 0, {
        action: 'navigate',
        url: 'https://example.com/login',
        result: 'success'
      });
      
      contextManager.logTask(workflowId, 1, {
        action: 'input',
        field: 'username',
        value: 'testuser'
      });
      
      contextManager.logTask(workflowId, 1, {
        action: 'input',
        field: 'password',
        value: '****'
      });
      
      contextManager.logTask(workflowId, 2, {
        action: 'verify',
        element: 'dashboard',
        result: 'visible'
      });
      
      // Verify complete context
      const fullContext = contextManager.getFullContext(workflowId);
      expect(fullContext.steps).toEqual(steps);
      expect(fullContext.stepLogs[0]).toHaveLength(1);
      expect(fullContext.stepLogs[1]).toHaveLength(2);
      expect(fullContext.stepLogs[2]).toHaveLength(1);
      
      // Verify individual step contexts
      const step0Logs = contextManager.getStepContext(workflowId, 0);
      expect(step0Logs[0].action).toBe('navigate');
      
      const step1Logs = contextManager.getStepContext(workflowId, 1);
      expect(step1Logs[0].field).toBe('username');
      expect(step1Logs[1].field).toBe('password');
    });
  });
});
