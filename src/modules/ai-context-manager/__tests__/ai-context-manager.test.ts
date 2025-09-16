import { AIContextManager } from '../index';
import { 
  SessionStatus,
  ExecutorCommand,
  CommandResponse,
  CommandAction
} from '../../../../types/shared-types';
import {
  InvestigationType,
  ElementDiscovery,
  InvestigationResult,
  DEFAULT_AI_CONTEXT_CONFIG
} from '../types';

describe('AIContextManager', () => {
  let contextManager: AIContextManager;
  let workflowSessionId: string;

  beforeEach(async () => {
    // Use memory storage for tests
    const config = {
      ...DEFAULT_AI_CONTEXT_CONFIG,
      storage: {
        ...DEFAULT_AI_CONTEXT_CONFIG.storage,
        adapter: 'memory' as const
      }
    };
    
    contextManager = new AIContextManager(config);
    await contextManager.initialize();
    
    // Create a test session
    const moduleSessionId = await contextManager.createSession('test-workflow-session-1');
    workflowSessionId = 'test-workflow-session-1';
  });

  afterEach(async () => {
    if (contextManager.sessionExists(workflowSessionId)) {
      await contextManager.destroySession(workflowSessionId);
    }
    await contextManager.destroy();
  });

  describe('Session Management', () => {
    test('should create and manage sessions', async () => {
      expect(contextManager.sessionExists(workflowSessionId)).toBe(true);
      
      const session = contextManager.getSession(workflowSessionId);
      expect(session).toBeTruthy();
      expect(session?.moduleId).toBe('ai-context-manager');
      expect(session?.linkedWorkflowSessionId).toBe(workflowSessionId);
    });

    test('should update session status', async () => {
      await contextManager.updateSessionStatus(workflowSessionId, SessionStatus.ACTIVE);
      const status = contextManager.getSessionStatus(workflowSessionId);
      expect(status).toBe(SessionStatus.ACTIVE);
    });

    test('should link executor session', async () => {
      await contextManager.linkExecutorSession(workflowSessionId, 'executor-session-123');
      const sessionContext = contextManager.getSessionContext(workflowSessionId);
      expect(sessionContext?.executorSessionId).toBe('executor-session-123');
    });

    test('should perform health check', async () => {
      const health = await contextManager.healthCheck();
      expect(health.moduleId).toBe('ai-context-manager');
      expect(health.isHealthy).toBe(true);
      expect(health.activeSessions).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Step Management', () => {
    test('should set and retrieve steps', async () => {
      const steps = [
        'Navigate to login page',
        'Enter username and password',
        'Click login button',
        'Verify successful login'
      ];

      await contextManager.setSteps(workflowSessionId, steps);
      const retrievedSteps = contextManager.getSteps(workflowSessionId);
      
      expect(retrievedSteps).toEqual(steps);
    });

    test('should add and update step executions', async () => {
      const steps = ['Test step 1', 'Test step 2'];
      await contextManager.setSteps(workflowSessionId, steps);

      const stepExecution = {
        stepIndex: 0,
        stepName: 'Test step 1',
        events: [],
        startTime: new Date(),
        status: SessionStatus.ACTIVE
      };

      await contextManager.addStepExecution(workflowSessionId, stepExecution);
      
      let execution = contextManager.getStepExecution(workflowSessionId, 0);
      expect(execution).toBeTruthy();
      expect(execution?.stepName).toBe('Test step 1');
      expect(execution?.status).toBe(SessionStatus.ACTIVE);

      // Update the execution
      await contextManager.updateStepExecution(workflowSessionId, 0, {
        status: SessionStatus.COMPLETED,
        endTime: new Date()
      });

      execution = contextManager.getStepExecution(workflowSessionId, 0);
      expect(execution?.status).toBe(SessionStatus.COMPLETED);
      expect(execution?.endTime).toBeTruthy();
    });
  });

  describe('Event Management', () => {
    beforeEach(async () => {
      const steps = ['Navigate to page', 'Click element'];
      await contextManager.setSteps(workflowSessionId, steps);
    });

    test('should add execution events', async () => {
      const command: ExecutorCommand = {
        sessionId: workflowSessionId,
        action: CommandAction.OPEN_PAGE,
        parameters: { url: 'https://example.com' },
        commandId: 'cmd-1',
        timestamp: new Date()
      };

      const result: CommandResponse = {
        success: true,
        commandId: 'cmd-1',
        dom: '<html><head><title>Example</title></head><body>Content</body></html>',
        screenshotId: 'screenshot-1',
        duration: 1000
      };

      const eventId = await contextManager.addExecutionEvent(
        workflowSessionId,
        0,
        command,
        result,
        'Opening the target page',
        'screenshot-1'
      );

      expect(eventId).toBeTruthy();

      const events = contextManager.getExecutionEvents(workflowSessionId, 0);
      expect(events).toHaveLength(1);
      expect(events[0].reasoning).toBe('Opening the target page');
      expect(events[0].executorMethod).toBe(CommandAction.OPEN_PAGE);
      expect(events[0].screenshotId).toBe('screenshot-1');
    });
  });

  describe('Investigation Management', () => {
    beforeEach(async () => {
      const steps = ['Find and click submit button'];
      await contextManager.setSteps(workflowSessionId, steps);
    });

    test('should add investigation results', async () => {
      const investigation: InvestigationResult = {
        investigationId: 'inv-1',
        investigationType: InvestigationType.SCREENSHOT_ANALYSIS,
        timestamp: new Date(),
        input: {
          screenshotId: 'screenshot-1'
        },
        output: {
          visualDescription: 'Page shows a login form with username and password fields',
          summary: 'Login form detected'
        },
        success: true
      };

      const investigationId = await contextManager.addInvestigationResult(
        workflowSessionId,
        0,
        investigation
      );

      expect(investigationId).toBe('inv-1');

      const history = contextManager.getInvestigationHistory(workflowSessionId, 0);
      expect(history).toHaveLength(1);
      expect(history[0].investigationType).toBe(InvestigationType.SCREENSHOT_ANALYSIS);
      expect(history[0].success).toBe(true);
    });

    test('should add element discoveries', async () => {
      const discovery: ElementDiscovery = {
        discoveryId: 'disc-1',
        timestamp: new Date(),
        selector: '#submit-button',
        elementType: 'button',
        properties: {
          tagName: 'button',
          textContent: 'Submit',
          isVisible: true,
          isInteractable: true,
          attributes: {
            id: 'submit-button',
            type: 'submit'
          }
        },
        confidence: 0.9,
        discoveryMethod: InvestigationType.SUB_DOM_EXTRACTION,
        isReliable: true
      };

      await contextManager.addPageElementDiscovery(workflowSessionId, 0, discovery);

      const discoveries = contextManager.getPageElementsDiscovered(workflowSessionId, 0);
      expect(discoveries).toHaveLength(1);
      expect(discoveries[0].selector).toBe('#submit-button');
      expect(discoveries[0].confidence).toBe(0.9);
      expect(discoveries[0].isReliable).toBe(true);
    });
  });

  describe('Context Generation', () => {
    beforeEach(async () => {
      const steps = ['Navigate to page', 'Fill form', 'Submit form'];
      await contextManager.setSteps(workflowSessionId, steps);

      // Add some execution data
      const command: ExecutorCommand = {
        sessionId: workflowSessionId,
        action: CommandAction.OPEN_PAGE,
        parameters: { url: 'https://example.com' },
        commandId: 'cmd-1',
        timestamp: new Date()
      };

      const result: CommandResponse = {
        success: true,
        commandId: 'cmd-1',
        dom: '<html><head><title>Test Page</title></head><body><form><input type="text" id="username"/><button type="submit">Submit</button></form></body></html>',
        screenshotId: 'screenshot-1',
        duration: 1000
      };

      await contextManager.addExecutionEvent(
        workflowSessionId,
        0,
        command,
        result,
        'Loading the test page'
      );
    });

    test('should generate AI context JSON', async () => {
      const context = await contextManager.generateContextJson(workflowSessionId, 1);

      expect(context.sessionId).toBe(workflowSessionId);
      expect(context.targetStep).toBe(1);
      expect(context.totalSteps).toBe(3);
      expect(context.executionFlow).toHaveLength(2); // Should include steps 0 and 1
      expect(context.executionFlow[0].reasoning).toBe('Loading the test page');
      expect(context.executionFlow[1].reasoning).toBe('Step not yet executed'); // Placeholder for step 1
      // Check previousPageDom since that's where step 0's DOM would be
      expect(context.previousPageDom).toContain('<title>Test Page</title>');
    });

    test('should generate investigation context', async () => {
      // Add an investigation result first
      const investigation: InvestigationResult = {
        investigationId: 'inv-1',
        investigationType: InvestigationType.SCREENSHOT_ANALYSIS,
        timestamp: new Date(),
        input: { screenshotId: 'screenshot-1' },
        output: { summary: 'Form page detected' },
        success: true
      };

      await contextManager.addInvestigationResult(workflowSessionId, 0, investigation);

      const investigationContext = await contextManager.generateInvestigationContext(workflowSessionId, 0);

      expect(investigationContext.sessionId).toBe(workflowSessionId);
      expect(investigationContext.stepIndex).toBe(0);
      expect(investigationContext.currentInvestigations).toHaveLength(1);
      expect(investigationContext.suggestedInvestigations.length).toBeGreaterThan(0);
      expect(investigationContext.investigationPriority.primary).toBeTruthy();
    });

    test('should generate filtered context', async () => {
      const filterOptions = {
        excludeFullDom: true,
        excludePageContent: false,
        maxHistorySteps: 10,
        includeWorkingMemory: true,
        includeElementKnowledge: true,
        includeInvestigationHistory: false,
        summarizationLevel: 'standard' as const,
        confidenceThreshold: 0.5
      };

      const filteredContext = await contextManager.generateFilteredContext(
        workflowSessionId,
        1,
        filterOptions
      );

      expect(filteredContext.sessionId).toBe(workflowSessionId);
      expect(filteredContext.targetStep).toBe(1);
      expect(filteredContext.executionSummary).toBeTruthy();
      expect(filteredContext.workingMemory).toBeTruthy();
    });
  });

  describe('Working Memory Management', () => {
    beforeEach(async () => {
      const steps = ['Test step'];
      await contextManager.setSteps(workflowSessionId, steps);
    });

    test('should update and retrieve working memory', async () => {
      const memoryUpdate = {
        updateType: 'element_discovery' as const,
        data: {
          selector: '#test-element',
          elementType: 'button',
          purpose: 'form submission'
        },
        confidence: 0.8,
        source: 'test'
      };

      await contextManager.updateWorkingMemory(workflowSessionId, 0, memoryUpdate);

      const workingMemory = contextManager.getWorkingMemory(workflowSessionId);
      expect(workingMemory.sessionId).toBe(workflowSessionId);
      expect(workingMemory.knownElements.size).toBeGreaterThan(0);
    });

    test('should clear working memory', async () => {
      // Add some memory first
      const memoryUpdate = {
        updateType: 'variable_extraction' as const,
        data: {
          name: 'testVar',
          value: 'testValue',
          extractionMethod: 'test'
        },
        confidence: 0.9,
        source: 'test'
      };

      await contextManager.updateWorkingMemory(workflowSessionId, 0, memoryUpdate);

      let workingMemory = contextManager.getWorkingMemory(workflowSessionId);
      expect(workingMemory.extractedVariables.size).toBeGreaterThan(0);

      // Clear memory
      await contextManager.clearWorkingMemory(workflowSessionId);

      workingMemory = contextManager.getWorkingMemory(workflowSessionId);
      expect(workingMemory.extractedVariables.size).toBe(0);
    });
  });

  describe('Analytics and Reporting', () => {
    beforeEach(async () => {
      const steps = ['Step 1', 'Step 2'];
      await contextManager.setSteps(workflowSessionId, steps);

      // Add some test data
      const command: ExecutorCommand = {
        sessionId: workflowSessionId,
        action: CommandAction.CLICK_ELEMENT,
        parameters: { selector: '#button' },
        commandId: 'cmd-1',
        timestamp: new Date()
      };

      const result: CommandResponse = {
        success: true,
        commandId: 'cmd-1',
        dom: '<html><body><div>Success</div></body></html>',
        screenshotId: 'screenshot-1',
        duration: 500
      };

      await contextManager.addExecutionEvent(workflowSessionId, 0, command, result);
    });

    test('should generate analytics report', async () => {
      const report = await contextManager.generateAnalyticsReport(workflowSessionId);

      expect(report.sessionSummary.sessionId).toBe(workflowSessionId);
      expect(report.sessionSummary.totalSteps).toBe(2);
      expect(report.sessionSummary.totalEvents).toBe(1);
      expect(report.investigationSummary).toBeTruthy();
      expect(report.elementDiscoverySummary).toBeTruthy();
      expect(report.workingMemorySummary).toBeTruthy();
    });
  });

  describe('Configuration', () => {
    test('should allow configuration updates', () => {
      const originalConfig = contextManager.getConfiguration();
      expect(originalConfig.storage.adapter).toBe('memory');

      contextManager.updateConfiguration({
        investigation: {
          ...originalConfig.investigation,
          maxInvestigationsPerStep: 20
        }
      });

      const updatedConfig = contextManager.getConfiguration();
      expect(updatedConfig.investigation.maxInvestigationsPerStep).toBe(20);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid session operations', async () => {
      const invalidSessionId = 'non-existent-session';

      expect(() => contextManager.getWorkingMemory(invalidSessionId)).toThrow();
      
      await expect(
        contextManager.setSteps(invalidSessionId, ['test step'])
      ).rejects.toThrow();

      await expect(
        contextManager.generateContextJson(invalidSessionId, 0)
      ).rejects.toThrow();
    });

    test('should handle invalid step indices', async () => {
      const steps = ['Step 1'];
      await contextManager.setSteps(workflowSessionId, steps);

      await expect(
        contextManager.addExecutionEvent(
          workflowSessionId,
          5, // Invalid step index
          {} as ExecutorCommand,
          {} as CommandResponse
        )
      ).rejects.toThrow();
    });
  });
});

describe('AIContextManager Integration', () => {
  test('should perform complete workflow simulation', async () => {
    const contextManager = new AIContextManager();
    await contextManager.initialize();

    try {
      // Create session
      const workflowSessionId = 'integration-test-session';
      await contextManager.createSession(workflowSessionId);
      
      // Set up workflow
      const steps = [
        'Navigate to login page',
        'Enter credentials', 
        'Submit login form',
        'Verify dashboard access'
      ];
      await contextManager.setSteps(workflowSessionId, steps);

      // Simulate step execution with investigations
      for (let stepIndex = 0; stepIndex < 2; stepIndex++) {
        // Add investigation
        const investigation: InvestigationResult = {
          investigationId: `inv-${stepIndex}`,
          investigationType: InvestigationType.SCREENSHOT_ANALYSIS,
          timestamp: new Date(),
          input: { screenshotId: `screenshot-${stepIndex}` },
          output: { summary: `Step ${stepIndex} analysis complete` },
          success: true
        };
        await contextManager.addInvestigationResult(workflowSessionId, stepIndex, investigation);

        // Add element discovery
        if (stepIndex === 1) {
          const discovery: ElementDiscovery = {
            discoveryId: `disc-${stepIndex}`,
            timestamp: new Date(),
            selector: '#login-button',
            elementType: 'button',
            properties: {
              tagName: 'button',
              isVisible: true,
              isInteractable: true
            },
            confidence: 0.95,
            discoveryMethod: InvestigationType.SUB_DOM_EXTRACTION,
            isReliable: true
          };
          await contextManager.addPageElementDiscovery(workflowSessionId, stepIndex, discovery);
        }

        // Add execution event
        const command: ExecutorCommand = {
          sessionId: workflowSessionId,
          action: stepIndex === 0 ? CommandAction.OPEN_PAGE : CommandAction.CLICK_ELEMENT,
          parameters: stepIndex === 0 ? { url: 'https://app.example.com/login' } : { selector: '#login-button' },
          commandId: `cmd-${stepIndex}`,
          timestamp: new Date()
        };

        const result: CommandResponse = {
          success: true,
          commandId: `cmd-${stepIndex}`,
          dom: `<html><body>Step ${stepIndex} content</body></html>`,
          screenshotId: `screenshot-${stepIndex}`,
          duration: 1000 + stepIndex * 500
        };

        await contextManager.addExecutionEvent(
          workflowSessionId,
          stepIndex,
          command,
          result,
          `Executing step ${stepIndex}`
        );
      }

      // Generate comprehensive context
      const context = await contextManager.generateContextJson(workflowSessionId, 1);
      expect(context.executionFlow.length).toBeGreaterThan(0);
      expect(context.totalSteps).toBe(4);
      expect(context.completedSteps).toBe(0); // No completed steps yet

      // Generate investigation context
      const investigationContext = await contextManager.generateInvestigationContext(workflowSessionId, 1);
      expect(investigationContext.currentInvestigations.length).toBeGreaterThan(0);
      expect(investigationContext.elementsDiscovered.length).toBeGreaterThan(0);

      // Generate analytics report
      const analytics = await contextManager.generateAnalyticsReport(workflowSessionId);
      expect(analytics.sessionSummary.totalEvents).toBe(2);
      expect(analytics.investigationSummary.totalInvestigations).toBe(2);
      expect(analytics.elementDiscoverySummary.totalDiscoveries).toBe(1);

      // Clean up
      await contextManager.destroySession(workflowSessionId);
      
    } finally {
      await contextManager.destroy();
    }
  });
});
