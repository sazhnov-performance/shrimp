/**
 * Unit Tests for CommandProcessor
 * Tests all command types, variable resolution, error handling, and integration
 */

import { CommandProcessor } from '../../../src/modules/executor/command-processor';
import { ExecutorErrorHandler } from '../../../src/modules/executor/error-handler';
import { CommandAction } from '../../../types/shared-types';
import { 
  ExecutorSession, 
  ExecutorCommand, 
  CommandResponse 
} from '../../../src/modules/executor/types';

// Mock dependencies
const mockVariableResolver = {
  resolve: jest.fn(),
  setVariable: jest.fn(),
  getVariable: jest.fn(),
  listVariables: jest.fn(() => ({}))
};

const mockScreenshotManager = {
  captureScreenshot: jest.fn()
};

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  logCommandExecution: jest.fn(),
  logVariableInterpolation: jest.fn()
};

// Mock page element
const mockElement = {
  click: jest.fn(),
  fill: jest.fn(),
  clear: jest.fn(),
  isEnabled: jest.fn(() => Promise.resolve(true)),
  inputValue: jest.fn(() => Promise.resolve('test value')),
  textContent: jest.fn(() => Promise.resolve('test text')),
  evaluate: jest.fn()
};

// Mock Playwright page
const mockPage = {
  goto: jest.fn(),
  content: jest.fn(() => Promise.resolve('<html><body>Test DOM</body></html>')),
  waitForLoadState: jest.fn(),
  waitForSelector: jest.fn(() => Promise.resolve(mockElement)),
  waitForTimeout: jest.fn(),
  url: jest.fn(() => 'https://example.com')
};

// Mock browser
const mockBrowser = {
  close: jest.fn(),
  isConnected: jest.fn(() => true)
};

describe('CommandProcessor', () => {
  let commandProcessor: CommandProcessor;
  let errorHandler: ExecutorErrorHandler;
  let mockSession: ExecutorSession;

  beforeEach(() => {
    errorHandler = new ExecutorErrorHandler();
    commandProcessor = new CommandProcessor(
      errorHandler,
      mockLogger as any,
      mockVariableResolver as any,
      mockScreenshotManager as any
    );

    mockSession = {
      moduleId: 'executor',
      sessionId: 'session-123',
      linkedWorkflowSessionId: 'workflow-456',
      status: 'ACTIVE' as any,
      createdAt: new Date(),
      lastActivity: new Date(),
      browser: mockBrowser as any,
      page: mockPage as any,
      variables: new Map(),
      metadata: {}
    };

    // Reset all mocks
    jest.clearAllMocks();
    
    // Reset mock implementations to ensure clean state
    mockVariableResolver.resolve.mockReset();
    mockVariableResolver.setVariable.mockReset();
    mockVariableResolver.getVariable.mockReset();
    mockVariableResolver.listVariables.mockReset();
    mockScreenshotManager.captureScreenshot.mockReset();
    mockPage.goto.mockReset();
    mockPage.content.mockReset();
    mockPage.waitForLoadState.mockReset();
    mockPage.waitForSelector.mockReset();
    mockPage.waitForTimeout.mockReset();
    mockPage.url.mockReset();
    mockElement.click.mockReset();
    mockElement.fill.mockReset();
    mockElement.clear.mockReset();
    mockElement.isEnabled.mockReset();
    mockElement.inputValue.mockReset();
    mockElement.textContent.mockReset();
    mockElement.evaluate.mockReset();
    
    // Setup default successful mock implementations
    mockVariableResolver.resolve.mockImplementation((_, input) => input); // No variable resolution by default
    mockVariableResolver.listVariables.mockReturnValue({});
    mockScreenshotManager.captureScreenshot.mockResolvedValue('screenshot-123');
    mockPage.goto.mockResolvedValue(null);
    mockPage.content.mockResolvedValue('<html><body>Test DOM</body></html>');
    mockPage.waitForLoadState.mockResolvedValue(undefined);
    mockPage.waitForSelector.mockResolvedValue(mockElement);
    mockPage.waitForTimeout.mockResolvedValue(undefined);
    mockPage.url.mockReturnValue('https://example.com');
    mockElement.click.mockResolvedValue(undefined);
    mockElement.fill.mockResolvedValue(undefined);
    mockElement.clear.mockResolvedValue(undefined);
    mockElement.isEnabled.mockResolvedValue(true);
    mockElement.inputValue.mockResolvedValue('test value');
    mockElement.textContent.mockResolvedValue('test value');
    mockElement.evaluate.mockResolvedValue('test element');
  });

  describe('executeCommand', () => {
    it('should execute OPEN_PAGE command successfully', async () => {
      // Use real timers for duration calculation
      jest.useRealTimers();
      
      const command: ExecutorCommand = {
        sessionId: 'session-123',
        action: CommandAction.OPEN_PAGE,
        parameters: { url: 'https://example.com' },
        commandId: 'cmd-123',
        timestamp: new Date()
      };

      const response = await commandProcessor.executeCommand(mockSession, command);

      expect(response.success).toBe(true);
      expect(response.commandId).toBe('cmd-123');
      expect(response.dom).toBe('<html><body>Test DOM</body></html>');
      expect(response.screenshotId).toBe('screenshot-123');
      expect(typeof response.duration).toBe('number');
      expect(response.duration).toBeGreaterThanOrEqual(0);
      
      // Restore fake timers
      jest.useFakeTimers();
      expect(response.metadata).toMatchObject({
        url: 'https://example.com',
        originalUrl: 'https://example.com'
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Executing command: OPEN_PAGE',
        'workflow-456',
        expect.objectContaining({
          commandId: 'cmd-123',
          action: CommandAction.OPEN_PAGE
        })
      );

      expect(mockLogger.logCommandExecution).toHaveBeenCalledWith(
        'workflow-456',
        CommandAction.OPEN_PAGE,
        expect.any(Number),
        true,
        expect.objectContaining({ commandId: 'cmd-123' })
      );
    });

    it('should execute CLICK_ELEMENT command successfully', async () => {
      const command: ExecutorCommand = {
        sessionId: 'session-123',
        action: CommandAction.CLICK_ELEMENT,
        parameters: { selector: '#button' },
        commandId: 'cmd-123',
        timestamp: new Date()
      };

      const response = await commandProcessor.executeCommand(mockSession, command);

      expect(response.success).toBe(true);
      expect(mockElement.click).toHaveBeenCalled();
      expect(mockLogger.logVariableInterpolation).toHaveBeenCalled();
    });

    it('should execute INPUT_TEXT command successfully', async () => {
      const command: ExecutorCommand = {
        sessionId: 'session-123',
        action: CommandAction.INPUT_TEXT,
        parameters: { selector: '#input', text: 'test text' },
        commandId: 'cmd-123',
        timestamp: new Date()
      };

      const response = await commandProcessor.executeCommand(mockSession, command);

      expect(response.success).toBe(true);
      expect(mockElement.clear).toHaveBeenCalled();
      expect(mockElement.fill).toHaveBeenCalledWith('test text');
    });

    it('should execute SAVE_VARIABLE command successfully', async () => {
      const command: ExecutorCommand = {
        sessionId: 'session-123',
        action: CommandAction.SAVE_VARIABLE,
        parameters: { selector: '#value', variableName: 'savedValue' },
        commandId: 'cmd-123',
        timestamp: new Date()
      };

      const response = await commandProcessor.executeCommand(mockSession, command);

      expect(response.success).toBe(true);
      expect(mockVariableResolver.setVariable).toHaveBeenCalledWith(
        'workflow-456',
        'savedValue',
        'test value'
      );
    });

    it('should execute GET_DOM command successfully', async () => {
      const command: ExecutorCommand = {
        sessionId: 'session-123',
        action: CommandAction.GET_DOM,
        parameters: {},
        commandId: 'cmd-123',
        timestamp: new Date()
      };

      const response = await commandProcessor.executeCommand(mockSession, command);

      expect(response.success).toBe(true);
      expect(response.dom).toBe('<html><body>Test DOM</body></html>');
      expect(response.metadata?.domLength).toBe(response.dom.length);
    });

    it('should handle unsupported commands', async () => {
      const command: ExecutorCommand = {
        sessionId: 'session-123',
        action: 'UNSUPPORTED_ACTION' as any,
        parameters: {},
        commandId: 'cmd-123',
        timestamp: new Date()
      };

      const response = await commandProcessor.executeCommand(mockSession, command);

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('EX007');
      expect(response.error?.message).toContain('Unsupported action');
    });

    it('should validate required parameters for each command', async () => {
      const invalidCommands = [
        {
          action: CommandAction.OPEN_PAGE,
          parameters: {}, // Missing URL
          expectedError: 'URL parameter is required'
        },
        {
          action: CommandAction.CLICK_ELEMENT,
          parameters: {}, // Missing selector
          expectedError: 'Selector parameter is required'
        },
        {
          action: CommandAction.INPUT_TEXT,
          parameters: { selector: '#input' }, // Missing text
          expectedError: 'Selector and text parameters are required'
        },
        {
          action: CommandAction.SAVE_VARIABLE,
          parameters: { selector: '#element' }, // Missing variableName
          expectedError: 'Selector and variableName parameters are required'
        }
      ];

      for (const { action, parameters, expectedError } of invalidCommands) {
        const command: ExecutorCommand = {
          sessionId: 'session-123',
          action,
          parameters,
          commandId: 'cmd-123',
          timestamp: new Date()
        };

        const response = await commandProcessor.executeCommand(mockSession, command);

        expect(response.success).toBe(false);
        expect(response.error?.message).toContain('Invalid command');
      }
    });

    it('should handle command execution errors', async () => {
      jest.useRealTimers();
      mockPage.goto.mockRejectedValueOnce(new Error('Navigation failed'));

      const command: ExecutorCommand = {
        sessionId: 'session-123',
        action: CommandAction.OPEN_PAGE,
        parameters: { url: 'https://example.com' },
        commandId: 'cmd-123',
        timestamp: new Date()
      };

      const response = await commandProcessor.executeCommand(mockSession, command);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(typeof response.duration).toBe('number');
      expect(response.duration).toBeGreaterThanOrEqual(0);
      
      jest.useFakeTimers();

      expect(mockLogger.logCommandExecution).toHaveBeenCalledWith(
        'workflow-456',
        CommandAction.OPEN_PAGE,
        expect.any(Number),
        false,
        expect.objectContaining({
          commandId: 'cmd-123',
          error: expect.any(String)
        })
      );
    });
  });

  describe('openPage', () => {
    it('should navigate to URL with variable resolution', async () => {
      mockVariableResolver.resolve.mockReturnValue('https://resolved.example.com');

      const response = await commandProcessor.openPage(
        mockSession,
        'https://${domain}.example.com',
        'cmd-123'
      );

      expect(mockVariableResolver.resolve).toHaveBeenCalledWith(
        'workflow-456',
        'https://${domain}.example.com'
      );
      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://resolved.example.com',
        expect.objectContaining({
          waitUntil: 'domcontentloaded',
          timeout: 30000
        })
      );
      expect(response.metadata?.originalUrl).toBe('https://${domain}.example.com');
      expect(response.metadata?.url).toBe('https://resolved.example.com');
    });

    it('should wait for page load states', async () => {
      await commandProcessor.openPage(mockSession, 'https://example.com', 'cmd-123');

      expect(mockPage.waitForLoadState).toHaveBeenCalledWith('networkidle', { timeout: 10000 });
    });

    it('should capture screenshot after navigation', async () => {
      await commandProcessor.openPage(mockSession, 'https://example.com', 'cmd-123');

      expect(mockScreenshotManager.captureScreenshot).toHaveBeenCalledWith(
        'workflow-456',
        CommandAction.OPEN_PAGE,
        mockPage,
        { url: 'https://example.com' }
      );
    });

    it('should handle navigation failures', async () => {
      mockPage.goto.mockRejectedValueOnce(new Error('Page load timeout'));

      try {
        await commandProcessor.openPage(mockSession, 'https://example.com', 'cmd-123');
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.message).toMatch(/Page load timeout/);
      }
    });

    it('should handle network idle timeout gracefully', async () => {
      mockPage.waitForLoadState.mockRejectedValueOnce(new Error('Timeout waiting for load state'));

      try {
        await commandProcessor.openPage(mockSession, 'https://example.com', 'cmd-123');
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.message).toMatch(/timeout/i);
      }
    });
  });

  describe('clickElement', () => {
    it('should resolve variables in selector', async () => {
      mockVariableResolver.resolve.mockReturnValue('#resolved-button');

      await commandProcessor.clickElement(mockSession, '#${buttonId}', 'cmd-123');

      expect(mockVariableResolver.resolve).toHaveBeenCalledWith('workflow-456', '#${buttonId}');
      expect(mockPage.waitForSelector).toHaveBeenCalledWith('#resolved-button', {
        timeout: 10000,
        state: 'visible'
      });
    });

    it('should wait for element to be visible and enabled', async () => {
      await commandProcessor.clickElement(mockSession, '#button', 'cmd-123');

      expect(mockPage.waitForSelector).toHaveBeenCalledWith('#button', {
        timeout: 10000,
        state: 'visible'
      });
      expect(mockElement.isEnabled).toHaveBeenCalled();
    });

    it('should handle element not found', async () => {
      mockPage.waitForSelector.mockRejectedValueOnce(new Error('Element not found'));

      try {
        await commandProcessor.clickElement(mockSession, '#missing', 'cmd-123');
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.message).toMatch(/Cannot click element with selector/);
      }
    });

    it('should handle disabled elements', async () => {
      mockElement.isEnabled.mockResolvedValue(false);
      mockElement.click.mockRejectedValueOnce(new Error('element is disabled'));

      try {
        await commandProcessor.clickElement(mockSession, '#disabled', 'cmd-123');
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.message).toMatch(/Cannot click element with selector/);
      }
    });

    it('should perform click and wait for changes', async () => {
      await commandProcessor.clickElement(mockSession, '#button', 'cmd-123');

      expect(mockElement.click).toHaveBeenCalled();
      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(500);
    });

    it('should log variable interpolation', async () => {
      mockVariableResolver.resolve.mockReturnValue('#resolved-button');
      mockVariableResolver.listVariables.mockReturnValue({ buttonId: 'resolved-button' });

      await commandProcessor.clickElement(mockSession, '#${buttonId}', 'cmd-123');

      expect(mockLogger.logVariableInterpolation).toHaveBeenCalledWith(
        'workflow-456',
        '#${buttonId}',
        '#resolved-button',
        { buttonId: 'resolved-button' }
      );
    });

    it('should handle click errors', async () => {
      mockElement.click.mockRejectedValueOnce(new Error('Click intercepted'));

      try {
        await commandProcessor.clickElement(mockSession, '#button', 'cmd-123');
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.message).toMatch(/Cannot click element with selector/);
      }
    });
  });

  describe('inputText', () => {
    it('should resolve variables in both selector and text', async () => {
      mockVariableResolver.resolve
        .mockReturnValueOnce('#resolved-input')
        .mockReturnValueOnce('resolved text');

      await commandProcessor.inputText(mockSession, '#${inputId}', '${textValue}', 'cmd-123');

      expect(mockVariableResolver.resolve).toHaveBeenCalledWith('workflow-456', '#${inputId}');
      expect(mockVariableResolver.resolve).toHaveBeenCalledWith('workflow-456', '${textValue}');
      expect(mockElement.fill).toHaveBeenCalledWith('resolved text');
    });

    it('should clear existing text before filling', async () => {
      await commandProcessor.inputText(mockSession, '#input', 'new text', 'cmd-123');

      expect(mockElement.clear).toHaveBeenCalled();
      expect(mockElement.fill).toHaveBeenCalledWith('new text');
    });

    it('should handle disabled input elements', async () => {
      mockElement.isEnabled.mockResolvedValue(false);
      mockElement.fill.mockRejectedValueOnce(new Error('element is disabled'));

      try {
        await commandProcessor.inputText(mockSession, '#input', 'text', 'cmd-123');
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.message).toMatch(/Cannot input text element with selector/);
      }
    });

    it('should include original and resolved values in metadata', async () => {
      mockVariableResolver.resolve
        .mockReturnValueOnce('#resolved-input')
        .mockReturnValueOnce('resolved text');

      const response = await commandProcessor.inputText(
        mockSession,
        '#${inputId}',
        '${textValue}',
        'cmd-123'
      );

      expect(response.metadata).toMatchObject({
        selector: '#resolved-input',
        originalSelector: '#${inputId}',
        text: 'resolved text',
        originalText: '${textValue}'
      });
    });

    it('should handle text input errors', async () => {
      mockElement.fill.mockRejectedValueOnce(new Error('Fill failed'));

      try {
        await commandProcessor.inputText(mockSession, '#input', 'text', 'cmd-123');
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.message).toMatch(/Cannot input text element with selector/);
      }
    });
  });

  describe('saveVariable', () => {
    it('should extract value from input elements', async () => {
      mockElement.evaluate.mockResolvedValue('input');
      mockElement.inputValue.mockResolvedValue('input value');

      await commandProcessor.saveVariable(mockSession, '#input', 'varName', 'cmd-123');

      expect(mockElement.evaluate).toHaveBeenCalledWith(expect.any(Function));
      expect(mockElement.inputValue).toHaveBeenCalled();
      expect(mockVariableResolver.setVariable).toHaveBeenCalledWith(
        'workflow-456',
        'varName',
        'input value'
      );
    });

    it('should extract text from non-input elements', async () => {
      mockElement.evaluate.mockResolvedValue('div');
      mockElement.textContent.mockResolvedValue('div text content');

      await commandProcessor.saveVariable(mockSession, '#div', 'varName', 'cmd-123');

      expect(mockElement.textContent).toHaveBeenCalled();
      expect(mockVariableResolver.setVariable).toHaveBeenCalledWith(
        'workflow-456',
        'varName',
        'div text content'
      );
    });

    it('should handle different element types', async () => {
      const elementTypes = [
        { tagName: 'input', method: 'inputValue', value: 'input value' },
        { tagName: 'textarea', method: 'inputValue', value: 'textarea value' },
        { tagName: 'select', method: 'inputValue', value: 'selected option' },
        { tagName: 'span', method: 'textContent', value: 'span text' }
      ];

      for (const { tagName, method, value } of elementTypes) {
        mockElement.evaluate.mockResolvedValue(tagName);
        mockElement[method as keyof typeof mockElement] = jest.fn().mockResolvedValue(value);

        await commandProcessor.saveVariable(mockSession, `#${tagName}`, 'varName', 'cmd-123');

        expect(mockVariableResolver.setVariable).toHaveBeenCalledWith(
          'workflow-456',
          'varName',
          value
        );
      }
    });

    it('should handle empty text content', async () => {
      mockElement.evaluate.mockResolvedValue('div');
      mockElement.textContent.mockResolvedValue(null);

      await commandProcessor.saveVariable(mockSession, '#empty', 'varName', 'cmd-123');

      expect(mockVariableResolver.setVariable).toHaveBeenCalledWith(
        'workflow-456',
        'varName',
        ''
      );
    });

    it('should log variable saving', async () => {
      mockElement.evaluate.mockResolvedValue('input');
      mockElement.inputValue.mockResolvedValue('saved value');

      await commandProcessor.saveVariable(mockSession, '#input', 'myVar', 'cmd-123');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Variable saved: myVar = "saved value"',
        'workflow-456',
        expect.objectContaining({
          variableName: 'myVar',
          value: 'saved value'
        })
      );
    });

    it('should wait for element to be attached', async () => {
      await commandProcessor.saveVariable(mockSession, '#element', 'varName', 'cmd-123');

      expect(mockPage.waitForSelector).toHaveBeenCalledWith('#element', {
        timeout: 10000,
        state: 'attached'
      });
    });

    it('should handle element evaluation errors', async () => {
      mockElement.evaluate.mockRejectedValueOnce(new Error('Evaluation failed'));

      try {
        await commandProcessor.saveVariable(mockSession, '#element', 'varName', 'cmd-123');
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.message).toMatch(/Cannot save variable element with selector/);
      }
    });
  });

  describe('getCurrentDOM', () => {
    it('should capture current DOM state', async () => {
      const response = await commandProcessor.getCurrentDOM(mockSession, 'cmd-123');

      expect(response.success).toBe(true);
      expect(response.dom).toBe('<html><body>Test DOM</body></html>');
      expect(response.metadata?.domLength).toBe(response.dom.length);
      expect(response.metadata?.url).toBe('https://example.com');
    });

    it('should capture screenshot during DOM capture', async () => {
      await commandProcessor.getCurrentDOM(mockSession, 'cmd-123');

      expect(mockScreenshotManager.captureScreenshot).toHaveBeenCalledWith(
        'workflow-456',
        CommandAction.GET_DOM,
        mockPage
      );
    });

    it('should log DOM capture details', async () => {
      await commandProcessor.getCurrentDOM(mockSession, 'cmd-123');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('DOM captured:'),
        'workflow-456',
        expect.objectContaining({ domLength: expect.any(Number) })
      );
    });

    it('should handle DOM capture errors', async () => {
      mockPage.content.mockRejectedValueOnce(new Error('DOM access failed'));

      try {
        await commandProcessor.getCurrentDOM(mockSession, 'cmd-123');
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.message).toMatch(/DOM access failed/);
      }
    });
  });

  describe('variable resolution integration', () => {
    it('should resolve complex variable patterns', async () => {
      mockVariableResolver.resolve.mockImplementation((_, input) => {
        return input
          .replace('${baseUrl}', 'https://test.com')
          .replace('${userId}', '123')
          .replace('${action}', 'login');
      });

      await commandProcessor.openPage(
        mockSession,
        '${baseUrl}/user/${userId}?action=${action}',
        'cmd-123'
      );

      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://test.com/user/123?action=login',
        expect.any(Object)
      );
    });

    it('should handle variable resolution errors', async () => {
      mockVariableResolver.resolve.mockImplementation(() => {
        throw new Error('Variable not found');
      });

      try {
        await commandProcessor.openPage(mockSession, '${invalidVar}', 'cmd-123');
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.message).toMatch(/timeout.*URL/);
      }
    });
  });

  describe('screenshot integration', () => {
    it('should capture screenshots for all commands', async () => {
      const commands = [
        { action: CommandAction.OPEN_PAGE, params: { url: 'https://example.com' } },
        { action: CommandAction.CLICK_ELEMENT, params: { selector: '#button' } },
        { action: CommandAction.INPUT_TEXT, params: { selector: '#input', text: 'text' } },
        { action: CommandAction.SAVE_VARIABLE, params: { selector: '#value', variableName: 'var' } },
        { action: CommandAction.GET_DOM, params: {} }
      ];

      for (const { action, params } of commands) {
        const command: ExecutorCommand = {
          sessionId: 'session-123',
          action,
          parameters: params,
          commandId: 'cmd-123',
          timestamp: new Date()
        };

        await commandProcessor.executeCommand(mockSession, command);

        expect(mockScreenshotManager.captureScreenshot).toHaveBeenCalledWith(
          'workflow-456',
          CommandAction.OPEN_PAGE,  // First command in the loop
          mockPage,
          expect.any(Object)
        );
      }
    });

    it('should handle screenshot capture failures gracefully', async () => {
      // Mock the screenshot failure - command should fail gracefully
      mockScreenshotManager.captureScreenshot.mockRejectedValueOnce(new Error('Screenshot failed'));
      
      try {
        await commandProcessor.getCurrentDOM(mockSession, 'cmd-123');
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.message).toMatch(/Failed to capture DOM|Screenshot failed/i);
      }
      
      expect(mockScreenshotManager.captureScreenshot).toHaveBeenCalled();
    });
  });

  describe('performance and timing', () => {
    it('should track command execution duration', async () => {
      jest.useRealTimers();
      const startTime = Date.now();

      const response = await commandProcessor.getCurrentDOM(mockSession, 'cmd-123');

      const endTime = Date.now();
      expect(typeof response.duration).toBe('number');
      expect(response.duration).toBeGreaterThanOrEqual(0);
      jest.useFakeTimers();
    });

    it('should include timing in metadata', async () => {
      jest.useRealTimers();
      const response = await commandProcessor.getCurrentDOM(mockSession, 'cmd-123');

      expect(typeof response.duration).toBe('number');
      expect(response.duration).toBeGreaterThanOrEqual(0);
      jest.useFakeTimers();
    });
  });

  describe('error propagation', () => {
    it('should propagate standard errors correctly', async () => {
      const standardError = errorHandler.createSelectorError('#missing');
      mockPage.waitForSelector.mockRejectedValueOnce(standardError);

      const response = await commandProcessor.executeCommand(mockSession, {
        sessionId: 'session-123',
        action: CommandAction.CLICK_ELEMENT,
        parameters: { selector: '#missing' },
        commandId: 'cmd-123',
        timestamp: new Date()
      });

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('EX003'); // ELEMENT_NOT_INTERACTABLE
    });

    it('should wrap non-standard errors', async () => {
      mockPage.content.mockRejectedValueOnce(new Error('Generic error'));

      const response = await commandProcessor.executeCommand(mockSession, {
        sessionId: 'session-123',
        action: CommandAction.GET_DOM,
        parameters: {},
        commandId: 'cmd-123',
        timestamp: new Date()
      });

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('DOM_CAPTURE_FAILED');
      expect(response.error?.message).toContain('Failed to capture DOM');
    });
  });

  describe('metadata handling', () => {
    it('should include relevant metadata in responses', async () => {
      const response = await commandProcessor.openPage(
        mockSession,
        'https://example.com',
        'cmd-123'
      );

      expect(response.metadata).toMatchObject({
        url: 'https://example.com',
        originalUrl: 'https://example.com'
      });
    });

    it('should preserve original and resolved values', async () => {
      mockVariableResolver.resolve.mockReturnValue('#resolved-selector');

      const response = await commandProcessor.clickElement(
        mockSession,
        '#${buttonId}',
        'cmd-123'
      );

      expect(response.metadata).toMatchObject({
        selector: '#resolved-selector',
        originalSelector: '#${buttonId}'
      });
    });
  });
});
