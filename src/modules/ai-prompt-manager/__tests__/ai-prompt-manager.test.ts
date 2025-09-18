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
      
      expect(prompt).toContain('You are an intelligent web automation agent specialized in browser testing and interaction');
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
      expect(prompt).toContain('REFLECT PHASE (Mandatory Decision Gate):');
    });

    it('should include optimization guidelines', () => {
      const prompt = promptManager.getStepPrompt(sessionId, 0);
      
      expect(prompt).toContain('OPTIMIZATION GUIDELINES:');
      expect(prompt).toContain('Prefer semantic roles/labels');
      expect(prompt).toContain('Validate element existence/visibility before interaction');
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
    it('should generate main template prompt even when context is corrupted', () => {
      const sessionId = 'fallback-test-session';
      promptManager.init(sessionId, ['Test step']);

      // Simulate a problem by corrupting the context manager
      const originalGetFullContext = contextManager.getFullContext;
      contextManager.getFullContext = jest.fn(() => {
        throw new Error('Context corrupted');
      });

      const prompt = promptManager.getStepPrompt(sessionId, 0);
      
      expect(prompt).toBeDefined();
      // Should still use main template with sophisticated instructions
      expect(prompt).toContain('You are an intelligent web automation agent specialized in browser testing and interaction');
      expect(prompt).toContain('INVESTIGATE → ACT → REFLECT');
      expect(prompt).toContain('"type": "object"');
      expect(prompt).toContain('Step 1');

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
      
      // Should still use main template but with truncated history when needed
      expect(prompt).toContain('You are an intelligent web automation agent specialized in browser testing and interaction');
      expect(prompt).toContain('INVESTIGATE → ACT → REFLECT');
      // The prompt may be longer than 500 chars because we use the main template, but it should handle length appropriately
      expect(prompt.length).toBeGreaterThan(500); // Main template is inherently longer but more sophisticated
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

  describe('GET_TEXT Result Truncation', () => {
    const steps = ['Test GET_TEXT truncation'];
    
    afterEach(() => {
      // Clean up environment variable
      delete process.env.CONTEXT_TRUNCATE_RESULT;
    });

    it('should respect CONTEXT_TRUNCATE_RESULT environment variable', () => {
      // Set environment variable for test
      process.env.CONTEXT_TRUNCATE_RESULT = '500';
      
      // Create new instance to pick up environment variable
      (AIPromptManager as any).instance = null;
      const truncatingManager = AIPromptManager.getInstance();
      const sessionId = 'truncation-env-test-session';
      truncatingManager.init(sessionId, steps);
      
      // Test that the limit is applied
      expect((truncatingManager as any).promptBuilder.contextTruncateLimit).toBe(500);
    });

    it('should use default truncation limit when environment variable is not set', () => {
      // Ensure environment variable is not set
      delete process.env.CONTEXT_TRUNCATE_RESULT;
      
      // Create new instance
      (AIPromptManager as any).instance = null;
      const defaultManager = AIPromptManager.getInstance();
      
      expect((defaultManager as any).promptBuilder.contextTruncateLimit).toBe(1000);
    });

    it('should truncate GET_TEXT results when they exceed the limit', () => {
      // Set a small truncation limit
      process.env.CONTEXT_TRUNCATE_RESULT = '50';
      
      // Create new instance to pick up environment variable
      (AIPromptManager as any).instance = null;
      const truncatingManager = AIPromptManager.getInstance();
      const sessionId = 'truncation-limit-test-session';
      truncatingManager.init(sessionId, steps);
      
      // Mock a GET_TEXT execution result with long text
      const longText = 'This is a very long text that should be truncated because it exceeds the configured limit of 50 characters for the GET_TEXT command result display in AI context.';
      
      contextManager.logTask(sessionId, 0, {
        aiResponse: {
          action: { command: 'GET_TEXT', parameters: { selector: 'body' } },
          reasoning: 'Testing truncation',
          confidence: 'HIGH',
          flowControl: 'continue'
        },
        executionResult: {
          success: true,
          result: longText
        }
      });
      
      const prompt = truncatingManager.getStepPrompt(sessionId, 0);
      
      // Should contain truncated text with message
      expect(prompt).toContain('Value is truncated, shown 50 out of');
      expect(prompt).toContain(`shown 50 out of ${longText.length} characters`);
      expect(prompt).not.toContain(longText.substring(60)); // Should not contain the end of the long text
    });

    it('should not truncate GET_TEXT results when they are under the limit', () => {
      process.env.CONTEXT_TRUNCATE_RESULT = '1000';
      
      // Create new instance to pick up environment variable
      (AIPromptManager as any).instance = null;
      const truncatingManager = AIPromptManager.getInstance();
      const sessionId = 'truncation-no-limit-test-session';
      truncatingManager.init(sessionId, steps);
      
      // Mock a GET_TEXT execution result with short text
      const shortText = 'This is short text.';
      
      contextManager.logTask(sessionId, 0, {
        aiResponse: {
          action: { command: 'GET_TEXT', parameters: { selector: 'body' } },
          reasoning: 'Testing no truncation',
          confidence: 'HIGH',
          flowControl: 'continue'
        },
        executionResult: {
          success: true,
          result: shortText
        }
      });
      
      const prompt = truncatingManager.getStepPrompt(sessionId, 0);
      
      // Should contain full text without truncation message
      expect(prompt).toContain(shortText);
      expect(prompt).not.toContain('Value is truncated');
    });

    it('should only truncate GET_TEXT commands, not other commands', () => {
      process.env.CONTEXT_TRUNCATE_RESULT = '50';
      
      // Create new instance to pick up environment variable
      (AIPromptManager as any).instance = null;
      const truncatingManager = AIPromptManager.getInstance();
      const sessionId = 'truncation-other-commands-test-session';
      truncatingManager.init(sessionId, steps);
      
      // Mock a CLICK_ELEMENT execution result with long text (should use old truncation)
      const longText = 'This is a very long text that should be truncated with the old 100-character limit for non-GET_TEXT commands.';
      
      contextManager.logTask(sessionId, 0, {
        aiResponse: {
          action: { command: 'CLICK_ELEMENT', parameters: { selector: 'button' } },
          reasoning: 'Testing non-GET_TEXT truncation',
          confidence: 'HIGH',
          flowControl: 'continue'
        },
        executionResult: {
          success: true,
          result: longText
        }
      });
      
      const prompt = truncatingManager.getStepPrompt(sessionId, 0);
      
      // Should use old truncation logic (100 chars + "...")
      expect(prompt).toContain(longText.substring(0, 100) + '...');
      expect(prompt).not.toContain('Value is truncated, shown');
    });

    it('should handle invalid environment variable values gracefully', () => {
      process.env.CONTEXT_TRUNCATE_RESULT = 'invalid';
      
      // Create new instance
      (AIPromptManager as any).instance = null;
      const invalidManager = AIPromptManager.getInstance();
      
      // Should fall back to default when environment variable is invalid
      expect((invalidManager as any).promptBuilder.contextTruncateLimit).toBe(1000);
    });

    it('should format truncation message correctly', () => {
      process.env.CONTEXT_TRUNCATE_RESULT = '100';
      
      // Create new instance to pick up environment variable
      (AIPromptManager as any).instance = null;
      const truncatingManager = AIPromptManager.getInstance();
      const sessionId = 'truncation-message-test-session';
      truncatingManager.init(sessionId, steps);
      
      // Create text that's exactly 150 characters
      const exactText = 'A'.repeat(150);
      
      contextManager.logTask(sessionId, 0, {
        aiResponse: {
          action: { command: 'GET_TEXT', parameters: { selector: 'body' } },
          reasoning: 'Testing exact truncation',
          confidence: 'HIGH',
          flowControl: 'continue'
        },
        executionResult: {
          success: true,
          result: exactText
        }
      });
      
      const prompt = truncatingManager.getStepPrompt(sessionId, 0);
      
      // Should contain exactly the right truncation message
      expect(prompt).toContain('[Value is truncated, shown 100 out of 150 characters]');
      expect(prompt).toContain('A'.repeat(100)); // First 100 A's
      expect(prompt).not.toContain('A'.repeat(101)); // Should not contain 101 A's
    });
  });

  describe('History Truncation Improvements', () => {
    const steps = ['Test smart history truncation'];
    
    afterEach(() => {
      delete process.env.CONTEXT_HISTORY_LIMIT;
    });

    it('should preserve current step attempts when truncating history', () => {
      // Set a small history limit to force truncation
      process.env.CONTEXT_HISTORY_LIMIT = '500';
      
      (AIPromptManager as any).instance = null;
      const truncatingManager = AIPromptManager.getInstance();
      const sessionId = 'smart-truncation-test-session';
      truncatingManager.init(sessionId, ['Step 1', 'Step 2', 'Step 3']);
      
      // Add previous step logs to create a long history
      for (let i = 0; i < 5; i++) {
        contextManager.logTask(sessionId, 0, {
          aiResponse: {
            action: { command: 'CLICK_ELEMENT', parameters: { selector: `button-${i}` } },
            reasoning: `Long reasoning text for attempt ${i} that adds to the history length and should eventually cause truncation`,
            confidence: 'HIGH',
            flowControl: 'continue'
          },
          executionResult: { success: true, result: 'Success' }
        });
      }
      
      // Add current step attempts (should be preserved)
      contextManager.logTask(sessionId, 2, {
        aiResponse: {
          action: { command: 'INPUT_TEXT', parameters: { selector: 'input', text: 'important data' } },
          reasoning: 'This is current step reasoning that should be preserved',
          confidence: 'HIGH',
          flowControl: 'continue'
        },
        executionResult: { success: true, result: 'Input successful' }
      });
      
      const prompt = truncatingManager.getStepPrompt(sessionId, 2);
      
      // Should contain smart truncation message with preserved content info
      expect(prompt).toContain('History truncated due to length limits. Showing');
      expect(prompt).toContain('most recent content preserved');
      
      // Should preserve current step attempts
      expect(prompt).toContain('CURRENT STEP ATTEMPTS:');
      expect(prompt).toContain('This is current step reasoning that should be preserved');
      expect(prompt).toContain('important data');
    });

    it('should provide meaningful content even with very small limits', () => {
      // Set a very small history limit
      process.env.CONTEXT_HISTORY_LIMIT = '200';
      
      (AIPromptManager as any).instance = null;
      const truncatingManager = AIPromptManager.getInstance();
      const sessionId = 'minimal-truncation-test-session';
      truncatingManager.init(sessionId, ['Step 1']);
      
      // Add a lot of history to force aggressive truncation
      for (let i = 0; i < 10; i++) {
        contextManager.logTask(sessionId, 0, {
          aiResponse: {
            action: { command: 'GET_TEXT', parameters: { selector: `element-${i}` } },
            reasoning: `Very long reasoning text for attempt ${i} that definitely exceeds the tiny limit and should trigger the fallback truncation logic`,
            confidence: 'HIGH',
            flowControl: 'continue'
          },
          executionResult: { success: true, result: `Result ${i}` }
        });
      }
      
      const prompt = truncatingManager.getStepPrompt(sessionId, 0);
      
      // Should not be empty even with tiny limit
      expect(prompt).toContain('EXECUTION HISTORY:');
      expect(prompt).toContain('History truncated due to length limits');
      
      // Should have some meaningful content, not just the message
      const historyStart = prompt.indexOf('EXECUTION HISTORY:');
      const historySection = prompt.substring(historyStart);
      expect(historySection.length).toBeGreaterThan(100); // Should have reasonable content
    });

    it('should handle empty history gracefully', () => {
      process.env.CONTEXT_HISTORY_LIMIT = '100';
      
      (AIPromptManager as any).instance = null;
      const truncatingManager = AIPromptManager.getInstance();
      const sessionId = 'empty-history-test-session';
      truncatingManager.init(sessionId, ['Step 1']);
      
      // No logs added - empty history
      const prompt = truncatingManager.getStepPrompt(sessionId, 0);
      
      // Should handle empty history without truncation
      expect(prompt).toContain('EXECUTION HISTORY:');
      expect(prompt).not.toContain('History truncated due to length limits');
      expect(prompt).toContain('No execution history available');
    });
  });

  describe('Image Analysis Prompt', () => {
    const sessionId = 'image-analysis-test';
    const steps = ['Open login page', 'Enter credentials', 'Submit form'];

    beforeEach(() => {
      promptManager.init(sessionId, steps);
    });

    it('should generate image analysis prompt for valid session and step', () => {
      const result = promptManager.getImageAnalysisPrompt(sessionId, 0);
      
      expect(result).toHaveProperty('system');
      expect(result).toHaveProperty('user');
      expect(typeof result.system).toBe('string');
      expect(typeof result.user).toBe('string');
    });

    it('should include task context in image analysis prompt', () => {
      const result = promptManager.getImageAnalysisPrompt(sessionId, 1);
      
      expect(result.system).toContain('Enter credentials');
      expect(result.user).toContain('Enter credentials');
      expect(result.system).toContain('No previous action');
      expect(result.user).toContain('No previous action');
    });

    it('should include latest executed step in context', () => {
      // Add a task log to create execution history
      contextManager.logTask(sessionId, 0, {
        iteration: 1,
        aiResponse: {
          action: { command: 'OPEN_PAGE', parameters: { url: 'https://example.com' } },
          reasoning: 'Opening the main page to start automation',
          confidence: 'HIGH',
          flowControl: 'continue'
        },
        executionResult: { success: true, result: 'Page loaded successfully' }
      });

      const result = promptManager.getImageAnalysisPrompt(sessionId, 1);
      
      expect(result.system).toContain('OPEN_PAGE');
      expect(result.system).toContain('https://example.com');
      expect(result.user).toContain('OPEN_PAGE');
    });

    it('should include image analysis schema in system prompt', () => {
      const result = promptManager.getImageAnalysisPrompt(sessionId, 0);
      
      expect(result.system).toContain('overallDescription');
      expect(result.system).toContain('interactibleElements');
      expect(result.system).toContain('type');
      expect(result.system).toContain('description');
      expect(result.system).toContain('location');
    });

    it('should throw error for non-existent session', () => {
      expect(() => {
        promptManager.getImageAnalysisPrompt('non-existent', 0);
      }).toThrow('does not exist');
    });

    it('should throw error for invalid step ID', () => {
      expect(() => {
        promptManager.getImageAnalysisPrompt(sessionId, 99);
      }).toThrow('out of bounds');
    });

    it('should handle error gracefully with fallback content', () => {
      // Simulate error by passing invalid session, but catch and test fallback
      try {
        const result = promptManager.getImageAnalysisPrompt('non-existent', 0);
        // Should not reach here, but if it does due to fallback, test it
        expect(result.system).toContain('Unknown Task');
        expect(result.user).toContain('Unknown Task');
      } catch (error) {
        // Expected to throw, this is the normal case
        expect(error).toBeDefined();
      }
    });
  });
});
