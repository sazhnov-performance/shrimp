/**
 * Unit tests for Executor module - GET_TEXT functionality
 */

import { Executor } from '../index';
import { CommandAction, ExecutorConfig, DEFAULT_EXECUTOR_CONFIG } from '../types';
import { ExecutorCommand, CommandResponse } from '../types';
import { chromium } from 'playwright';

// Mock dependencies
jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn().mockResolvedValue({
      newPage: jest.fn().mockResolvedValue({
        goto: jest.fn(),
        waitForLoadState: jest.fn(),
        content: jest.fn().mockResolvedValue('<html><body>Mock DOM</body></html>'),
        url: jest.fn().mockReturnValue('https://example.com'),
        waitForSelector: jest.fn().mockResolvedValue({
          textContent: jest.fn().mockResolvedValue('Mock element text'),
          evaluate: jest.fn().mockResolvedValue('<div>Mock HTML content for readability test</div>')
        }),
        $: jest.fn().mockResolvedValue({
          textContent: jest.fn().mockResolvedValue('Mock element text'),
          evaluate: jest.fn().mockResolvedValue('<div>Mock HTML content for readability test</div>')
        }),
        $$: jest.fn().mockResolvedValue([
          {
            evaluate: jest.fn().mockResolvedValue('<div role="dialog">Dialog 1 content</div>')
          },
          {
            evaluate: jest.fn().mockResolvedValue('<div role="dialog">Dialog 2 content</div>')
          }
        ]),
        screenshot: jest.fn().mockResolvedValue(Buffer.from('fake-screenshot')),
        close: jest.fn()
      }),
      close: jest.fn()
    })
  }
}));

jest.mock('@mozilla/readability', () => ({
  Readability: jest.fn().mockImplementation(() => ({
    parse: jest.fn().mockReturnValue({
      content: '<div>This is clean, readable content extracted by Mozilla Readability.</div>',
      title: 'Test Article'
    })
  }))
}));

jest.mock('jsdom', () => ({
  JSDOM: jest.fn().mockImplementation((html: string) => ({
    window: {
      document: {
        body: {
          textContent: 'This is clean, readable content extracted by Mozilla Readability.',
          innerText: 'This is clean, readable content extracted by Mozilla Readability.'
        }
      }
    }
  }))
}));

// Mock file system for screenshot storage
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    access: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    readdir: jest.fn().mockResolvedValue([]),
    stat: jest.fn().mockResolvedValue({ size: 1024, birthtime: new Date() }),
    unlink: jest.fn().mockResolvedValue(undefined)
  }
}));

// Mock sharp for image processing (if used)
jest.mock('sharp', () => jest.fn().mockReturnValue({
  resize: jest.fn().mockReturnThis(),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('fake-image')),
  metadata: jest.fn().mockResolvedValue({ width: 800, height: 600 })
}));

describe('Executor - GET_TEXT functionality', () => {
  let executor: Executor;
  let mockSessionId: string;

  beforeEach(async () => {
    // Reset singleton instance for each test
    (Executor as any).instance = null;
    
    // Create configuration with screenshots disabled for testing
    const testConfig = {
      ...DEFAULT_EXECUTOR_CONFIG,
      screenshots: {
        ...DEFAULT_EXECUTOR_CONFIG.screenshots,
        enabled: false
      }
    };
    
    // Create fresh executor instance
    executor = Executor.getInstance(testConfig);
    
    // Create a mock session
    mockSessionId = await executor.createSession('test-workflow-session');
  });

  afterEach(async () => {
    // Cleanup sessions after each test
    try {
      await executor.destroySession('test-workflow-session');
    } catch (error) {
      // Ignore cleanup errors in tests
    }
    
    // Reset instance
    (Executor as any).instance = null;
  });

  describe('getText method', () => {
    it('should successfully extract readable text using readability', async () => {
      const command: ExecutorCommand = {
        sessionId: 'test-workflow-session',
        action: CommandAction.GET_TEXT,
        parameters: {
          selector: 'article'
        },
        commandId: 'test-cmd-1',
        timestamp: new Date()
      };

      const response = await executor.executeCommand(command);

      expect(response.success).toBe(true);
      expect(response.commandId).toBe('test-cmd-1');
      expect(response.dom).toBeDefined();
      expect(response.screenshotId).toBeDefined();
      expect(response.duration).toBeGreaterThan(0);
      expect(response.metadata).toBeDefined();
      
      // Check that readability was used successfully
      expect(response.metadata?.usedReadability).toBe(true);
      expect(response.metadata?.extractionMethod).toBe('readability');
      expect(response.metadata?.readableText).toBe('This is clean, readable content extracted by Mozilla Readability.');
      expect(response.metadata?.textLength).toBeGreaterThan(0);
    });

    it('should use direct method call', async () => {
      const response = await executor.getText('test-workflow-session', 'article');

      expect(response.success).toBe(true);
      expect(response.commandId).toBeDefined();
      expect(response.dom).toBeDefined();
      expect(response.screenshotId).toBeDefined();
      expect(response.duration).toBeGreaterThan(0);
      expect(response.metadata).toBeDefined();
      
      // Check metadata
      expect(response.metadata?.selector).toBe('article');
      expect(response.metadata?.originalSelector).toBe('article');
      expect(response.metadata?.usedReadability).toBe(true);
      expect(response.metadata?.extractionMethod).toBe('readability');
      expect(response.metadata?.readableText).toBeDefined();
      expect(response.metadata?.textLength).toBeGreaterThan(0);
    });

    it('should handle fallback when readability fails', async () => {
      // Mock readability to return null (failure case)
      const { Readability } = require('@mozilla/readability');
      (Readability as any).mockImplementation(() => ({
        parse: jest.fn().mockReturnValue(null)
      }));

      const response = await executor.getText('test-workflow-session', 'div.content');

      expect(response.success).toBe(true);
      expect(response.metadata?.usedReadability).toBe(false);
      expect(response.metadata?.extractionMethod).toBe('direct');
      expect(response.metadata?.readableText).toBe('Mock element text');
    });

    it('should handle fallback when readability returns no content', async () => {
      // Mock readability to return article without content
      const { Readability } = require('@mozilla/readability');
      (Readability as any).mockImplementation(() => ({
        parse: jest.fn().mockReturnValue({
          title: 'Test Article',
          content: null
        })
      }));

      const response = await executor.getText('test-workflow-session', 'div.content');

      expect(response.success).toBe(true);
      expect(response.metadata?.usedReadability).toBe(false);
      expect(response.metadata?.extractionMethod).toBe('direct');
      expect(response.metadata?.readableText).toBe('Mock element text');
    });

    it('should resolve variables in selector', async () => {
      // Set a variable first
      await executor.setVariable('test-workflow-session', 'elementClass', 'main-content');

      const response = await executor.getText('test-workflow-session', 'div.${elementClass}');

      expect(response.success).toBe(true);
      expect(response.metadata?.originalSelector).toBe('div.${elementClass}');
      expect(response.metadata?.selector).toBe('div.main-content');
    });

    it('should throw error for empty selector', async () => {
      await expect(
        executor.getText('test-workflow-session', '')
      ).rejects.toThrow('Selector parameter is required and cannot be empty');

      await expect(
        executor.getText('test-workflow-session', '   ')
      ).rejects.toThrow('Selector parameter is required and cannot be empty');
    });

    it('should throw error for non-existent session', async () => {
      await expect(
        executor.getText('non-existent-session', 'div')
      ).rejects.toThrow('Session not found: non-existent-session');
    });

    it('should handle selector not found with error response', async () => {
      // Mock the page to simulate selector not found  
      const mockSession = executor.getSessionInfo('test-workflow-session');
      if (mockSession) {
        (mockSession.page.waitForSelector as jest.Mock).mockRejectedValueOnce(new Error('Selector not found'));
      }

      const response = await executor.getText('test-workflow-session', '.non-existent-selector');
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    it('should include proper metadata in response', async () => {
      const response = await executor.getText('test-workflow-session', 'article.post');

      expect(response.metadata).toEqual(
        expect.objectContaining({
          selector: 'article.post',
          originalSelector: 'article.post',
          readableText: expect.any(String),
          textLength: expect.any(Number),
          usedReadability: expect.any(Boolean),
          extractionMethod: expect.stringMatching(/^(readability|direct)$/)
        })
      );
    });

    it('should clean up whitespace in extracted text', async () => {
      // For this test, we'll verify the whitespace cleanup behavior by checking
      // that the readableText doesn't have extra whitespace at start/end
      const response = await executor.getText('test-workflow-session', 'article');

      expect(response.metadata?.readableText).toBeDefined();
      expect(response.metadata?.readableText?.trim()).toEqual(response.metadata?.readableText);
    });

    it('should handle screenshots based on configuration', async () => {
      const response = await executor.getText('test-workflow-session', 'article');

      // Since screenshots are disabled in test config, screenshotId should be empty
      expect(response.screenshotId).toBeDefined();
      expect(response.screenshotId).toBe('');
    });
  });

  describe('executeCommand with GET_TEXT action', () => {
    it('should handle GET_TEXT command through executeCommand', async () => {
      const command: ExecutorCommand = {
        sessionId: 'test-workflow-session',
        action: CommandAction.GET_TEXT,
        parameters: {
          selector: '.content'
        },
        commandId: 'test-get-text-cmd',
        timestamp: new Date()
      };

      const response = await executor.executeCommand(command);

      expect(response.success).toBe(true);
      expect(response.commandId).toBe('test-get-text-cmd');
      expect(response.metadata?.readableText).toBeDefined();
    });

    it('should validate selector parameter in command', async () => {
      const command: ExecutorCommand = {
        sessionId: 'test-workflow-session',
        action: CommandAction.GET_TEXT,
        parameters: {
          // No selector provided
        },
        commandId: 'test-invalid-cmd',
        timestamp: new Date()
      };

      const response = await executor.executeCommand(command);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.error?.code).toContain('INVALID_COMMAND');
    });
  });

  describe('getSubDOM', () => {
    beforeEach(async () => {
      // Create a fresh session for each test
      await executor.createSession('test-workflow-session');
    });

    afterEach(async () => {
      // Clean up session after each test
      await executor.destroySession('test-workflow-session');
    });

    it('should return sub-DOM elements for matching selector', async () => {
      const response = await executor.getSubDOM('test-workflow-session', '[role="dialog"]');

      expect(response.success).toBe(true);
      expect(response.dom).toBe('<div role="dialog">Dialog 1 content</div>\n<div role="dialog">Dialog 2 content</div>');
      expect(response.metadata?.subDOM).toEqual([
        '<div role="dialog">Dialog 1 content</div>',
        '<div role="dialog">Dialog 2 content</div>'
      ]);
      expect(response.metadata?.elementsFound).toBe(2);
      expect(response.metadata?.totalSize).toBeGreaterThan(0);
      expect(response.metadata?.maxSize).toBe(100000);
      expect(response.metadata?.sizeUtilization).toBeDefined();
      expect(response.metadata?.fullPageDOM).toBe('<html><body>Mock DOM</body></html>');
    });

    it('should return single sub-DOM element for single match', async () => {
      // Mock single element response by updating the global mock
      const { chromium } = require('playwright');
      const mockBrowser = await chromium.launch();
      const mockPage = await mockBrowser.newPage();
      mockPage.$$ = jest.fn().mockResolvedValue([
        {
          evaluate: jest.fn().mockResolvedValue('<button id="submit">Submit</button>')
        }
      ]);

      const response = await executor.getSubDOM('test-workflow-session', '#submit');

      expect(response.success).toBe(true);
      expect(response.dom).toBe('<button id="submit">Submit</button>');
      expect(response.metadata?.subDOM).toEqual(['<button id="submit">Submit</button>']);
      expect(response.metadata?.elementsFound).toBe(1);
    });

    it('should handle custom maxDomSize parameter', async () => {
      const response = await executor.getSubDOM('test-workflow-session', '[role="dialog"]', 50000);

      expect(response.success).toBe(true);
      expect(response.metadata?.maxSize).toBe(50000);
    });

    it('should reject if maxDomSize exceeds limit', async () => {
      // Mock large content that exceeds limit
      const { chromium } = require('playwright');
      const mockBrowser = await chromium.launch();
      const mockPage = await mockBrowser.newPage();
      mockPage.$$ = jest.fn().mockResolvedValue([
        {
          evaluate: jest.fn().mockResolvedValue('x'.repeat(60000)) // 60KB content
        }
      ]);

      try {
        await executor.getSubDOM('test-workflow-session', '.large-content', 50000);
        fail('Should have thrown size exceeded error');
      } catch (error: any) {
        expect(error.code).toContain('SUBDOM_SIZE_EXCEEDED');
      }
    });

    it('should validate selector parameter', async () => {
      try {
        await executor.getSubDOM('test-workflow-session', '');
        fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.code).toContain('INVALID_COMMAND');
        expect(error.message).toContain('Selector parameter is required');
      }
    });

    it('should validate maxDomSize parameter', async () => {
      try {
        await executor.getSubDOM('test-workflow-session', '[role="dialog"]', -1);
        fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.code).toContain('INVALID_COMMAND');
        expect(error.message).toContain('maxDomSize parameter must be a positive integer');
      }
    });

    it('should handle session not found error', async () => {
      try {
        await executor.getSubDOM('non-existent-session', '[role="dialog"]');
        fail('Should have thrown session not found error');
      } catch (error: any) {
        expect(error.code).toContain('SESSION_NOT_FOUND');
      }
    });

    it('should include screenshot metadata', async () => {
      const response = await executor.getSubDOM('test-workflow-session', '[role="dialog"]');

      // Since screenshots are disabled in test config, screenshotId should be empty
      expect(response.screenshotId).toBeDefined();
      expect(response.screenshotId).toBe('');
    });
  });

  describe('executeCommand with GET_SUBDOM action', () => {
    beforeEach(async () => {
      await executor.createSession('test-workflow-session');
    });

    afterEach(async () => {
      await executor.destroySession('test-workflow-session');
    });

    it('should handle GET_SUBDOM command through executeCommand', async () => {
      const command: ExecutorCommand = {
        sessionId: 'test-workflow-session',
        action: CommandAction.GET_SUBDOM,
        parameters: {
          selector: '[role="dialog"]'
        },
        commandId: 'test-get-subdom-cmd',
        timestamp: new Date()
      };

      const response = await executor.executeCommand(command);

      expect(response.success).toBe(true);
      expect(response.commandId).toBe('test-get-subdom-cmd');
      expect(response.dom).toBe('<div role="dialog">Dialog 1 content</div>\n<div role="dialog">Dialog 2 content</div>');
      expect(response.metadata?.subDOM).toBeDefined();
      expect(response.metadata?.elementsFound).toBe(2);
    });

    it('should validate selector parameter in command', async () => {
      const command: ExecutorCommand = {
        sessionId: 'test-workflow-session',
        action: CommandAction.GET_SUBDOM,
        parameters: {
          // No selector provided
        },
        commandId: 'test-invalid-cmd',
        timestamp: new Date()
      };

      const response = await executor.executeCommand(command);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.error?.code).toContain('INVALID_COMMAND');
    });

    it('should handle maxDomSize parameter in command', async () => {
      const command: ExecutorCommand = {
        sessionId: 'test-workflow-session',
        action: CommandAction.GET_SUBDOM,
        parameters: {
          selector: '[role="dialog"]',
          maxDomSize: 75000
        },
        commandId: 'test-get-subdom-cmd',
        timestamp: new Date()
      };

      const response = await executor.executeCommand(command);

      expect(response.success).toBe(true);
      expect(response.metadata?.maxSize).toBe(75000);
    });
  });
});
