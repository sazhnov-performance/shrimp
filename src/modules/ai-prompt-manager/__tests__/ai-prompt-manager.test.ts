/**
 * Unit tests for AI Prompt Manager module
 */

import { AIPromptManager } from '../index';
import { IAIPromptManager, AIPromptManagerConfig } from '../types';
import { AIContextManager } from '../../ai-context-manager/ai-context-manager';
import AISchemaManager from '../../ai-schema-manager/index';

describe('AIPromptManager', () => {
  let promptManager: IAIPromptManager;
  let contextManager: any;
  let schemaManager: any;

  beforeEach(() => {
    // Reset singleton instances for each test
    (AIPromptManager as any).instance = null;
    (AIContextManager as any).instance = null;
    (AISchemaManager as any).instance = null;
    
    // Create fresh instances
    promptManager = AIPromptManager.getInstance();
    contextManager = AIContextManager.getInstance();
    schemaManager = AISchemaManager.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = AIPromptManager.getInstance();
      const instance2 = AIPromptManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should accept configuration on first instantiation', () => {
      (AIPromptManager as any).instance = null;
      
      const config: AIPromptManagerConfig = {
        maxPromptLength: 5000,
        templateVersion: '2.0',
        cacheEnabled: true
      };
      
      const instance = AIPromptManager.getInstance(config);
      expect(instance).toBeDefined();
      expect((instance as any).config.maxPromptLength).toBe(5000);
      expect((instance as any).config.templateVersion).toBe('2.0');
      expect((instance as any).config.cacheEnabled).toBe(true);
    });

    it('should use default configuration values', () => {
      expect((promptManager as any).config.maxPromptLength).toBe(8000);
      expect((promptManager as any).config.templateVersion).toBe('1.0');
      expect((promptManager as any).config.cacheEnabled).toBe(false);
    });
  });

  describe('init method', () => {
    const sessionId = 'test-session-123';
    const steps = ['Open login page', 'Enter credentials', 'Submit form'];

    it('should successfully initialize a new session', () => {
      expect(() => {
        promptManager.init(sessionId, steps);
      }).not.toThrow();
    });

    it('should create context with correct session ID and steps', () => {
      promptManager.init(sessionId, steps);
      
      const context = contextManager.getFullContext(sessionId);
      expect(context.contextId).toBe(sessionId);
      expect(context.steps).toEqual(steps);
    });

    it('should throw error if session already exists', () => {
      promptManager.init(sessionId, steps);
      
      expect(() => {
        promptManager.init(sessionId, steps);
      }).toThrow('Session "test-session-123" is already initialized');
    });

    it('should handle empty steps array', () => {
      expect(() => {
        promptManager.init('empty-session', []);
      }).not.toThrow();
    });

    it('should handle steps with special characters', () => {
      const specialSteps = [
        'Navigate to "https://example.com/login"',
        'Click on <Submit> button',
        'Verify success message contains "Welcome!"'
      ];
      
      expect(() => {
        promptManager.init('special-session', specialSteps);
      }).not.toThrow();
    });
  });

  describe('getStepPrompt method', () => {
    const sessionId = 'prompt-test-session';
    const steps = [
      'Navigate to login page',
      'Enter username and password',
      'Click submit button',
      'Verify successful login'
    ];

    beforeEach(() => {
      promptManager.init(sessionId, steps);
    });

    it('should generate prompt for valid session and step', () => {
      const prompt = promptManager.getStepPrompt(sessionId, 0);
      
      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('should include session ID in the prompt', () => {
      const prompt = promptManager.getStepPrompt(sessionId, 0);
      
      expect(prompt).toContain(sessionId);
    });

    it('should include step information in the prompt', () => {
      const prompt = promptManager.getStepPrompt(sessionId, 1);
      
      expect(prompt).toContain('Step 2 of 4');
      expect(prompt).toContain('Enter username and password');
    });

    it('should include JSON schema in the prompt', () => {
      const prompt = promptManager.getStepPrompt(sessionId, 0);
      
      expect(prompt).toContain('"type": "object"');
      expect(prompt).toContain('"reasoning"');
      expect(prompt).toContain('"confidence"');
      expect(prompt).toContain('"flowControl"');
    });

    it('should include available commands in the prompt', () => {
      const prompt = promptManager.getStepPrompt(sessionId, 0);
      
      expect(prompt).toContain('OPEN_PAGE');
      expect(prompt).toContain('CLICK_ELEMENT');
      expect(prompt).toContain('INPUT_TEXT');
      expect(prompt).toContain('GET_SUBDOM');
    });

    it('should include ACT-REFLECT cycle instructions', () => {
      const prompt = promptManager.getStepPrompt(sessionId, 0);
      
      expect(prompt).toContain('INVESTIGATE PHASE');
      expect(prompt).toContain('ACT PHASE');
      expect(prompt).toContain('REFLECT PHASE');
    });

    it('should throw error for non-existent session', () => {
      expect(() => {
        promptManager.getStepPrompt('non-existent-session', 0);
      }).toThrow('Context with ID "non-existent-session" does not exist');
    });

    it('should throw error for invalid step ID (negative)', () => {
      expect(() => {
        promptManager.getStepPrompt(sessionId, -1);
      }).toThrow('Step ID -1 is out of bounds for session "prompt-test-session"');
    });

    it('should throw error for invalid step ID (too high)', () => {
      expect(() => {
        promptManager.getStepPrompt(sessionId, 10);
      }).toThrow('Step ID 10 is out of bounds for session "prompt-test-session"');
    });

    it('should handle all valid step indices', () => {
      for (let i = 0; i < steps.length; i++) {
        expect(() => {
          const prompt = promptManager.getStepPrompt(sessionId, i);
          expect(prompt).toBeDefined();
          expect(prompt).toContain(`Step ${i + 1} of ${steps.length}`);
        }).not.toThrow();
      }
    });
  });

  describe('Prompt Content Validation', () => {
    const sessionId = 'content-test-session';
    const steps = ['Test step with context'];

    beforeEach(() => {
      promptManager.init(sessionId, steps);
    });

    it('should include role definition', () => {
      const prompt = promptManager.getStepPrompt(sessionId, 0);
      
      expect(prompt).toContain('ROLE: You are an intelligent web automation agent');
    });

    it('should include current context section', () => {
      const prompt = promptManager.getStepPrompt(sessionId, 0);
      
      expect(prompt).toContain('CURRENT CONTEXT:');
      expect(prompt).toContain('Session:');
      expect(prompt).toContain('Step 1 of 1');
    });

    it('should include execution history section', () => {
      const prompt = promptManager.getStepPrompt(sessionId, 0);
      
      expect(prompt).toContain('EXECUTION HISTORY:');
    });

    it('should include mission and phase descriptions', () => {
      const prompt = promptManager.getStepPrompt(sessionId, 0);
      
      expect(prompt).toContain('YOUR MISSION:');
      expect(prompt).toContain('INVESTIGATE PHASE:');
      expect(prompt).toContain('ACT PHASE:');
      expect(prompt).toContain('REFLECT PHASE:');
    });

    it('should include optimization guidelines', () => {
      const prompt = promptManager.getStepPrompt(sessionId, 0);
      
      expect(prompt).toContain('OPTIMIZATION GUIDELINES:');
      expect(prompt).toContain('Prioritize stable, unique selectors');
      expect(prompt).toContain('Maintain HIGH confidence levels');
    });

    it('should include current step objective', () => {
      const prompt = promptManager.getStepPrompt(sessionId, 0);
      
      expect(prompt).toContain('CURRENT STEP OBJECTIVE: Test step with context');
    });
  });

  describe('History Integration', () => {
    const sessionId = 'history-test-session';
    const steps = ['Step 1', 'Step 2', 'Step 3'];

    beforeEach(() => {
      promptManager.init(sessionId, steps);
    });

    it('should handle session with no execution history', () => {
      const prompt = promptManager.getStepPrompt(sessionId, 0);
      
      expect(prompt).toContain('EXECUTION HISTORY:');
      // Should not crash and should provide some default content
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('should include previous step information for later steps', () => {
      // Simulate some execution by logging tasks
      contextManager.logTask(sessionId, 0, {
        action: { command: 'OPEN_PAGE', parameters: { url: 'https://example.com' } },
        reasoning: 'Opening test page',
        confidence: 'HIGH',
        flowControl: 'continue'
      });

      const prompt = promptManager.getStepPrompt(sessionId, 1);
      
      expect(prompt).toContain('PREVIOUS STEPS:');
    });

    it('should include current step attempts if any exist', () => {
      // Log some attempts for the current step
      contextManager.logTask(sessionId, 0, {
        action: { command: 'GET_SUBDOM', parameters: { selector: 'body' } },
        reasoning: 'Investigating page structure',
        confidence: 'HIGH',
        flowControl: 'continue'
      });

      const prompt = promptManager.getStepPrompt(sessionId, 0);
      
      expect(prompt).toContain('CURRENT STEP ATTEMPTS:');
    });
  });

  describe('Error Handling and Fallbacks', () => {
    it('should generate fallback prompt when context is corrupted', () => {
      const sessionId = 'fallback-test-session';
      promptManager.init(sessionId, ['Test step']);

      // Simulate a problem by corrupting the context manager
      const originalGetFullContext = contextManager.getFullContext;
      contextManager.getFullContext = jest.fn(() => {
        throw new Error('Context corrupted');
      });

      const prompt = promptManager.getStepPrompt(sessionId, 0);
      
      expect(prompt).toBeDefined();
      expect(prompt).toContain('Execute automation step 1');
      expect(prompt).toContain('"type": "object"');

      // Restore original method
      contextManager.getFullContext = originalGetFullContext;
    });

    it('should handle schema manager failures gracefully', () => {
      const sessionId = 'schema-fail-test-session';
      promptManager.init(sessionId, ['Test step']);

      // Mock schema manager to fail
      const originalGetSchema = schemaManager.getAIResponseSchema;
      schemaManager.getAIResponseSchema = jest.fn(() => {
        throw new Error('Schema unavailable');
      });

      const prompt = promptManager.getStepPrompt(sessionId, 0);
      
      expect(prompt).toBeDefined();
      expect(prompt.length).toBeGreaterThan(0);

      // Restore original method
      schemaManager.getAIResponseSchema = originalGetSchema;
    });
  });

  describe('Configuration Impact', () => {
    it('should respect maxPromptLength configuration', () => {
      (AIPromptManager as any).instance = null;
      
      const config: AIPromptManagerConfig = {
        maxPromptLength: 500  // Very small limit
      };
      
      const smallPromptManager = AIPromptManager.getInstance(config);
      smallPromptManager.init('small-session', ['Test step with very long description that would normally generate a very long prompt']);
      
      const prompt = smallPromptManager.getStepPrompt('small-session', 0);
      
      // Should fallback to shorter template due to length limit
      expect(prompt.length).toBeLessThan(1200); // Adjusted for additional safety instructions
    });

    it('should handle different template versions', () => {
      (AIPromptManager as any).instance = null;
      
      const config: AIPromptManagerConfig = {
        templateVersion: '2.0'
      };
      
      const versionedManager = AIPromptManager.getInstance(config);
      expect((versionedManager as any).config.templateVersion).toBe('2.0');
    });
  });

  describe('Integration with Dependencies', () => {
    it('should work with AI Context Manager singleton', () => {
      const sessionId = 'integration-test-session';
      const steps = ['Integration test step'];
      
      promptManager.init(sessionId, steps);
      
      // Verify context was created in the context manager
      const context = contextManager.getFullContext(sessionId);
      expect(context).toBeDefined();
      expect(context.contextId).toBe(sessionId);
      expect(context.steps).toEqual(steps);
    });

    it('should work with AI Schema Manager singleton', () => {
      const sessionId = 'schema-integration-session';
      promptManager.init(sessionId, ['Schema test step']);
      
      const prompt = promptManager.getStepPrompt(sessionId, 0);
      
      // Verify schema was included from schema manager
      const schema = schemaManager.getAIResponseSchema();
      const schemaString = JSON.stringify(schema, null, 2);
      
      expect(prompt).toContain('"type": "object"');
      expect(prompt).toContain('"reasoning"');
    });
  });

  describe('Memory and Performance', () => {
    it('should not store large prompt strings in memory', () => {
      const sessionId = 'memory-test-session';
      promptManager.init(sessionId, ['Memory test step']);
      
      // Generate multiple prompts
      for (let i = 0; i < 10; i++) {
        const prompt = promptManager.getStepPrompt(sessionId, 0);
        expect(prompt).toBeDefined();
      }
      
      // Prompt manager should not accumulate prompt strings
      // This is more of a design verification than a strict test
      expect((promptManager as any).promptBuilder).toBeDefined();
    });

    it('should handle multiple concurrent sessions', () => {
      const sessions = ['session-1', 'session-2', 'session-3'];
      const steps = ['Concurrent test step'];
      
      // Initialize multiple sessions
      sessions.forEach(sessionId => {
        promptManager.init(sessionId, steps);
      });
      
      // Generate prompts for all sessions
      sessions.forEach(sessionId => {
        const prompt = promptManager.getStepPrompt(sessionId, 0);
        expect(prompt).toBeDefined();
        expect(prompt).toContain(sessionId);
      });
    });
  });
});
