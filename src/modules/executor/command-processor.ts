/**
 * Command Processor
 * Implements command execution logic for all supported automation commands
 */

import { CommandAction } from './types';
import { 
  ExecutorSession, 
  ExecutorCommand, 
  CommandResponse, 
  ICommandProcessor,
  NetworkIdleConfig 
} from './types';
import { ExecutorErrorHandler } from './error-handler';
import { IExecutorLogger } from './types';
import { IVariableResolver } from './types';
import { IScreenshotManager } from './types';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

export class CommandProcessor implements ICommandProcessor {
  private errorHandler: ExecutorErrorHandler;
  private logger: IExecutorLogger;
  private variableResolver: IVariableResolver;
  private screenshotManager: IScreenshotManager;
  private networkIdleConfig: NetworkIdleConfig;

  constructor(
    errorHandler: ExecutorErrorHandler,
    logger: IExecutorLogger,
    variableResolver: IVariableResolver,
    screenshotManager: IScreenshotManager,
    networkIdleConfig: NetworkIdleConfig
  ) {
    this.errorHandler = errorHandler;
    this.logger = logger;
    this.variableResolver = variableResolver;
    this.screenshotManager = screenshotManager;
    this.networkIdleConfig = networkIdleConfig;
  }

  /**
   * Wait for network idle state based on configuration
   * @param session The executor session
   * @param actionType The type of action that was performed
   * @param context Additional context for logging
   */
  private async waitForNetworkIdle(
    session: ExecutorSession, 
    actionType: CommandAction, 
    context?: string
  ): Promise<void> {
    if (!this.networkIdleConfig.enabled) {
      return;
    }

    // Check if network idle is enabled for this specific action
    const shouldWaitForAction = 
      (actionType === CommandAction.CLICK_ELEMENT && this.networkIdleConfig.actions.clickElement) ||
      (actionType === CommandAction.INPUT_TEXT && this.networkIdleConfig.actions.inputText) ||
      (actionType === CommandAction.OPEN_PAGE && this.networkIdleConfig.actions.openPage);

    if (!shouldWaitForAction) {
      return;
    }

    const startTime = Date.now();
    const actionName = actionType.toLowerCase().replace('_', ' ');
    
    this.logger.debug(
      `Waiting for network idle after ${actionName}${context ? ` (${context})` : ''}`,
      session.linkedWorkflowSessionId,
      { 
        actionType, 
        timeout: this.networkIdleConfig.timeout,
        maxConcurrentRequests: this.networkIdleConfig.maxConcurrentRequests
      }
    );

    try {
      // Wait for network idle state
      await session.page.waitForLoadState('networkidle', { 
        timeout: this.networkIdleConfig.timeout 
      });

      const duration = Date.now() - startTime;
      this.logger.debug(
        `Network idle achieved after ${actionName} in ${duration}ms`,
        session.linkedWorkflowSessionId,
        { actionType, duration, success: true }
      );

    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Log timeout warning but don't fail the command
      this.logger.warn(
        `Network idle timeout after ${actionName} (${duration}ms)`,
        session.linkedWorkflowSessionId,
        { 
          actionType, 
          duration, 
          timeout: this.networkIdleConfig.timeout,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      
      // Continue execution - network idle timeout is not a fatal error
    }
  }

  /**
   * Main command execution entry point
   */
  async executeCommand(session: ExecutorSession, command: ExecutorCommand): Promise<CommandResponse> {
    const startTime = Date.now();
    
    this.logger.info(
      `Executing command: ${command.action}`,
      session.linkedWorkflowSessionId,
      { commandId: command.commandId, action: command.action, parameters: command.parameters }
    );

    try {
      let response: CommandResponse;

      switch (command.action) {
        case CommandAction.OPEN_PAGE:
          if (!command.parameters.url) {
            throw this.errorHandler.createInvalidCommandError(
              command,
              'URL parameter is required for OPEN_PAGE action'
            );
          }
          response = await this.openPage(session, command.parameters.url, command.commandId);
          break;

        case CommandAction.CLICK_ELEMENT:
          if (!command.parameters.selector) {
            throw this.errorHandler.createInvalidCommandError(
              command,
              'Selector parameter is required for CLICK_ELEMENT action'
            );
          }
          response = await this.clickElement(session, command.parameters.selector, command.commandId);
          break;

        case CommandAction.INPUT_TEXT:
          if (!command.parameters.selector || !command.parameters.text) {
            throw this.errorHandler.createInvalidCommandError(
              command,
              'Selector and text parameters are required for INPUT_TEXT action'
            );
          }
          response = await this.inputText(
            session, 
            command.parameters.selector, 
            command.parameters.text, 
            command.commandId
          );
          break;

        case CommandAction.SAVE_VARIABLE:
          if (!command.parameters.selector || !command.parameters.variableName) {
            throw this.errorHandler.createInvalidCommandError(
              command,
              'Selector and variableName parameters are required for SAVE_VARIABLE action'
            );
          }
          response = await this.saveVariable(
            session, 
            command.parameters.selector, 
            command.parameters.variableName, 
            command.commandId
          );
          break;

        case CommandAction.GET_DOM:
          response = await this.getCurrentDOM(session, command.commandId);
          break;

        case CommandAction.GET_CONTENT:
          if (!command.parameters.selector) {
            throw this.errorHandler.createInvalidCommandError(
              command,
              'Selector parameter is required for GET_CONTENT action'
            );
          }
          response = await this.getContent(
            session, 
            command.parameters.selector, 
            command.parameters.attribute,
            command.parameters.multiple,
            command.commandId
          );
          break;

        case CommandAction.GET_SUBDOM:
          if (!command.parameters.selector) {
            throw this.errorHandler.createInvalidCommandError(
              command,
              'Selector parameter is required for GET_SUBDOM action'
            );
          }
          response = await this.getSubDOM(
            session, 
            command.parameters.selector, 
            command.parameters.maxDomSize,
            command.commandId
          );
          break;

        case CommandAction.GET_TEXT:
          if (!command.parameters.selector) {
            throw this.errorHandler.createInvalidCommandError(
              command,
              'Selector parameter is required for GET_TEXT action'
            );
          }
          response = await this.getText(
            session, 
            command.parameters.selector,
            command.commandId
          );
          break;

        default:
          throw this.errorHandler.createInvalidCommandError(
            command,
            `Unsupported action: ${command.action}`
          );
      }

      const duration = Date.now() - startTime;
      this.logger.logCommandExecution(
        session.linkedWorkflowSessionId,
        command.action,
        duration,
        response.success,
        { commandId: command.commandId }
      );

      return response;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.logCommandExecution(
        session.linkedWorkflowSessionId,
        command.action,
        duration,
        false,
        { 
          commandId: command.commandId, 
          error: error instanceof Error ? error.message : String(error) 
        }
      );

      // Preserve known standard errors, wrap unknown ones
      const standardError = (error && typeof error === 'object' && 'code' in error && 'moduleId' in error)
        ? error as any
        : this.errorHandler.createStandardError(
            'COMMAND_EXECUTION_FAILED',
            `Command execution failed: ${error instanceof Error ? error.message : String(error)}`,
            { command, duration },
            error instanceof Error ? error : undefined
          );

      return {
        success: false,
        commandId: command.commandId,
        dom: '',
        screenshotId: '',
        duration,
        error: standardError,
        metadata: { command, executedAt: new Date() }
      };
    }
  }

  /**
   * Opens a web page
   */
  async openPage(session: ExecutorSession, url: string, commandId: string): Promise<CommandResponse> {
    const startTime = Date.now();

    try {
      // Resolve variables in URL
      const resolvedUrl = this.variableResolver.resolve(session.linkedWorkflowSessionId, url);
      
      this.logger.debug(
        `Opening page: ${resolvedUrl}`,
        session.linkedWorkflowSessionId,
        { originalUrl: url, resolvedUrl }
      );

      // Navigate to page
      await session.page.goto(resolvedUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });

      // Wait for page to be ready
      await session.page.waitForLoadState('networkidle', { timeout: 10000 });

      // Get DOM and capture screenshot
      const dom = await session.page.content();
      const screenshotId = await this.screenshotManager.captureScreenshot(
        session.linkedWorkflowSessionId,
        CommandAction.OPEN_PAGE,
        session.page,
        { url: resolvedUrl }
      );

      const duration = Date.now() - startTime;

      return {
        success: true,
        commandId,
        dom,
        screenshotId,
        duration,
        metadata: { url: resolvedUrl, originalUrl: url }
      };

    } catch (error) {
      throw this.errorHandler.createPageLoadError(
        url,
        30000,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Clicks an element
   */
  async clickElement(session: ExecutorSession, selector: string, commandId: string): Promise<CommandResponse> {
    const startTime = Date.now();

    try {
      // Resolve variables in selector
      const resolvedSelector = this.variableResolver.resolve(session.linkedWorkflowSessionId, selector);
      
      this.logger.logVariableInterpolation(
        session.linkedWorkflowSessionId,
        selector,
        resolvedSelector,
        this.variableResolver.listVariables(session.linkedWorkflowSessionId)
      );

      // Wait for element and click
      const element = await session.page.waitForSelector(resolvedSelector, { 
        timeout: 10000,
        state: 'visible'
      });

      if (!element) {
        throw this.errorHandler.createSelectorError(resolvedSelector);
      }

      // Check if element is interactable
      const isEnabled = await element.isEnabled();
      if (!isEnabled) {
        throw this.errorHandler.createElementError(resolvedSelector, 'click - element is disabled');
      }

      // Perform click
      await element.click();

      // Wait for network idle if configured
      await this.waitForNetworkIdle(session, CommandAction.CLICK_ELEMENT, resolvedSelector);

      // Get DOM and capture screenshot
      const dom = await session.page.content();
      const screenshotId = await this.screenshotManager.captureScreenshot(
        session.linkedWorkflowSessionId,
        CommandAction.CLICK_ELEMENT,
        session.page,
        { selector: resolvedSelector, originalSelector: selector }
      );

      const duration = Date.now() - startTime;

      return {
        success: true,
        commandId,
        dom,
        screenshotId,
        duration,
        metadata: { selector: resolvedSelector, originalSelector: selector }
      };

    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      
      throw this.errorHandler.createElementError(
        selector,
        'click',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Inputs text into an element
   */
  async inputText(
    session: ExecutorSession, 
    selector: string, 
    text: string, 
    commandId: string
  ): Promise<CommandResponse> {
    const startTime = Date.now();

    try {
      // Resolve variables in selector and text
      const resolvedSelector = this.variableResolver.resolve(session.linkedWorkflowSessionId, selector);
      const resolvedText = this.variableResolver.resolve(session.linkedWorkflowSessionId, text);
      
      this.logger.logVariableInterpolation(
        session.linkedWorkflowSessionId,
        `${selector} -> ${text}`,
        `${resolvedSelector} -> ${resolvedText}`,
        this.variableResolver.listVariables(session.linkedWorkflowSessionId)
      );

      // Wait for element
      const element = await session.page.waitForSelector(resolvedSelector, { 
        timeout: 10000,
        state: 'visible'
      });

      if (!element) {
        throw this.errorHandler.createSelectorError(resolvedSelector);
      }

      // Check if element is interactable
      const isEnabled = await element.isEnabled();
      if (!isEnabled) {
        throw this.errorHandler.createElementError(resolvedSelector, 'input text - element is disabled');
      }

      // Clear existing text and input new text
      await element.fill(''); // Clear first
      await element.fill(resolvedText);

      // Wait for network idle if configured
      await this.waitForNetworkIdle(session, CommandAction.INPUT_TEXT, resolvedSelector);

      // Get DOM and capture screenshot
      const dom = await session.page.content();
      const screenshotId = await this.screenshotManager.captureScreenshot(
        session.linkedWorkflowSessionId,
        CommandAction.INPUT_TEXT,
        session.page,
        { 
          selector: resolvedSelector, 
          originalSelector: selector,
          text: resolvedText,
          originalText: text
        }
      );

      const duration = Date.now() - startTime;

      return {
        success: true,
        commandId,
        dom,
        screenshotId,
        duration,
        metadata: { 
          selector: resolvedSelector, 
          originalSelector: selector,
          text: resolvedText,
          originalText: text
        }
      };

    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      
      throw this.errorHandler.createElementError(
        selector,
        'input text',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Saves a variable from an element's text/value
   */
  async saveVariable(
    session: ExecutorSession, 
    selector: string, 
    variableName: string, 
    commandId: string
  ): Promise<CommandResponse> {
    const startTime = Date.now();

    try {
      // Resolve variables in selector
      const resolvedSelector = this.variableResolver.resolve(session.linkedWorkflowSessionId, selector);
      
      this.logger.logVariableInterpolation(
        session.linkedWorkflowSessionId,
        selector,
        resolvedSelector,
        this.variableResolver.listVariables(session.linkedWorkflowSessionId)
      );

      // Wait for element
      const element = await session.page.waitForSelector(resolvedSelector, { 
        timeout: 10000,
        state: 'attached'
      });

      if (!element) {
        throw this.errorHandler.createSelectorError(resolvedSelector);
      }

      // Extract value (try different methods)
      let value: string;
      const tagName = await element.evaluate(el => el.tagName.toLowerCase());
      
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
        value = await element.inputValue();
      } else {
        value = await element.textContent() || '';
      }

      // Store variable
      this.variableResolver.setVariable(session.linkedWorkflowSessionId, variableName, value);

      this.logger.debug(
        `Variable saved: ${variableName} = "${value}"`,
        session.linkedWorkflowSessionId,
        { variableName, value, selector: resolvedSelector }
      );

      // Get DOM and capture screenshot
      const dom = await session.page.content();
      const screenshotId = await this.screenshotManager.captureScreenshot(
        session.linkedWorkflowSessionId,
        CommandAction.SAVE_VARIABLE,
        session.page,
        { 
          selector: resolvedSelector, 
          originalSelector: selector,
          variableName,
          value
        }
      );

      const duration = Date.now() - startTime;

      return {
        success: true,
        commandId,
        dom,
        screenshotId,
        duration,
        metadata: { 
          selector: resolvedSelector, 
          originalSelector: selector,
          variableName,
          value
        }
      };

    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      
      throw this.errorHandler.createElementError(
        selector,
        'save variable',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gets current DOM state
   */
  async getCurrentDOM(session: ExecutorSession, commandId: string): Promise<CommandResponse> {
    const startTime = Date.now();

    try {
      // Get DOM
      const dom = await session.page.content();
      
      // Capture screenshot
      const screenshotId = await this.screenshotManager.captureScreenshot(
        session.linkedWorkflowSessionId,
        CommandAction.GET_DOM,
        session.page
      );

      const duration = Date.now() - startTime;

      this.logger.debug(
        `DOM captured: ${dom.length} characters`,
        session.linkedWorkflowSessionId,
        { domLength: dom.length }
      );

      return {
        success: true,
        commandId,
        dom,
        screenshotId,
        duration,
        metadata: { domLength: dom.length, url: session.page.url() }
      };

    } catch (error) {
      throw this.errorHandler.createStandardError(
        'DOM_CAPTURE_FAILED',
        `Failed to capture DOM: ${error instanceof Error ? error.message : String(error)}`,
        { commandId },
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gets content from element(s) matching the selector
   */
  async getContent(
    session: ExecutorSession, 
    selector: string, 
    attribute?: string, 
    multiple?: boolean,
    commandId?: string
  ): Promise<CommandResponse> {
    const startTime = Date.now();
    const finalCommandId = commandId || `get_content_${Date.now()}`;

    try {
      // Resolve variables in selector
      const resolvedSelector = this.variableResolver.resolve(session.linkedWorkflowSessionId, selector);
      
      this.logger.logVariableInterpolation(
        session.linkedWorkflowSessionId,
        selector,
        resolvedSelector,
        this.variableResolver.listVariables(session.linkedWorkflowSessionId)
      );

      // Wait for at least one element to exist
      await session.page.waitForSelector(resolvedSelector, { 
        timeout: 10000,
        state: 'attached'
      });

      let content: string | string[];

      if (multiple) {
        // Get all matching elements
        const elements = await session.page.$$(resolvedSelector);
        
        if (elements.length === 0) {
          throw this.errorHandler.createSelectorError(resolvedSelector);
        }

        // Extract content from all elements
        const contentArray: string[] = [];
        for (const element of elements) {
          let value: string;
          
          if (attribute) {
            if (attribute === 'textContent' || attribute === 'text') {
              value = await element.textContent() || '';
            } else if (attribute === 'innerText') {
              value = await element.innerText() || '';
            } else if (attribute === 'innerHTML') {
              value = await element.innerHTML() || '';
            } else if (attribute === 'value') {
              value = await element.inputValue() || '';
            } else {
              // Custom attribute
              value = await element.getAttribute(attribute) || '';
            }
          } else {
            // Default to text content
            const tagName = await element.evaluate(el => el.tagName.toLowerCase());
            if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
              value = await element.inputValue() || '';
            } else {
              value = await element.textContent() || '';
            }
          }
          
          contentArray.push(value);
        }
        
        content = contentArray;
        
      } else {
        // Get first matching element
        const element = await session.page.$(resolvedSelector);
        
        if (!element) {
          throw this.errorHandler.createSelectorError(resolvedSelector);
        }

        if (attribute) {
          if (attribute === 'textContent' || attribute === 'text') {
            content = await element.textContent() || '';
          } else if (attribute === 'innerText') {
            content = await element.innerText() || '';
          } else if (attribute === 'innerHTML') {
            content = await element.innerHTML() || '';
          } else if (attribute === 'value') {
            content = await element.inputValue() || '';
          } else {
            // Custom attribute
            content = await element.getAttribute(attribute) || '';
          }
        } else {
          // Default behavior - extract value based on element type
          const tagName = await element.evaluate(el => el.tagName.toLowerCase());
          if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
            content = await element.inputValue() || '';
          } else {
            content = await element.textContent() || '';
          }
        }
      }

      this.logger.debug(
        `Content extracted from selector: ${resolvedSelector}`,
        session.linkedWorkflowSessionId,
        { 
          selector: resolvedSelector, 
          originalSelector: selector,
          attribute,
          multiple,
          contentType: Array.isArray(content) ? 'array' : 'string',
          contentLength: Array.isArray(content) ? content.length : (content as string).length
        }
      );

      // Get DOM and capture screenshot
      const dom = await session.page.content();
      const screenshotId = await this.screenshotManager.captureScreenshot(
        session.linkedWorkflowSessionId,
        CommandAction.GET_CONTENT,
        session.page,
        { 
          selector: resolvedSelector, 
          originalSelector: selector,
          attribute,
          multiple,
          contentType: Array.isArray(content) ? 'array' : 'string'
        }
      );

      const duration = Date.now() - startTime;

      return {
        success: true,
        commandId: finalCommandId,
        dom,
        screenshotId,
        duration,
        metadata: { 
          selector: resolvedSelector, 
          originalSelector: selector,
          attribute,
          multiple,
          content,
          contentType: Array.isArray(content) ? 'array' : 'string',
          elementsFound: Array.isArray(content) ? content.length : 1
        }
      };

    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      
      throw this.errorHandler.createElementError(
        selector,
        'get content',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gets sub-DOM elements matching the selector
   */
  async getSubDOM(
    session: ExecutorSession, 
    selector: string, 
    maxDomSize?: number,
    commandId?: string
  ): Promise<CommandResponse> {
    const startTime = Date.now();
    const finalCommandId = commandId || `get_subdom_${Date.now()}`;
    const maxSize = maxDomSize || 100000; // Default 100KB limit

    try {
      // Resolve variables in selector
      const resolvedSelector = this.variableResolver.resolve(session.linkedWorkflowSessionId, selector);
      
      this.logger.logVariableInterpolation(
        session.linkedWorkflowSessionId,
        selector,
        resolvedSelector,
        this.variableResolver.listVariables(session.linkedWorkflowSessionId)
      );

      // Wait for at least one element to exist
      await session.page.waitForSelector(resolvedSelector, { 
        timeout: 10000,
        state: 'attached'
      });

      // Get all matching elements
      const elements = await session.page.$$(resolvedSelector);
      
      if (elements.length === 0) {
        throw this.errorHandler.createSelectorError(resolvedSelector);
      }

      // Extract HTML from all matching elements
      const subDomElements: string[] = [];
      let totalSize = 0;

      for (const element of elements) {
        const outerHTML = await element.evaluate(el => el.outerHTML);
        const elementSize = outerHTML.length;
        
        // Check size limit before adding
        if (totalSize + elementSize > maxSize) {
          throw this.errorHandler.createStandardError(
            'SUBDOM_SIZE_EXCEEDED',
            `Sub-DOM size would exceed limit of ${maxSize} characters. Found ${elements.length} elements with total size ${totalSize + elementSize} characters.`,
            { 
              maxSize, 
              currentSize: totalSize, 
              elementSize, 
              elementsProcessed: subDomElements.length,
              totalElementsFound: elements.length,
              selector: resolvedSelector 
            }
          );
        }
        
        subDomElements.push(outerHTML);
        totalSize += elementSize;
      }

      this.logger.debug(
        `Sub-DOM extracted from selector: ${resolvedSelector}`,
        session.linkedWorkflowSessionId,
        { 
          selector: resolvedSelector, 
          originalSelector: selector,
          elementsFound: elements.length,
          totalSize,
          maxSize
        }
      );

      // Get current DOM and capture screenshot
      const dom = await session.page.content();
      const screenshotId = await this.screenshotManager.captureScreenshot(
        session.linkedWorkflowSessionId,
        CommandAction.GET_SUBDOM,
        session.page,
        { 
          selector: resolvedSelector, 
          originalSelector: selector,
          elementsFound: elements.length,
          totalSize,
          maxSize
        }
      );

      const duration = Date.now() - startTime;

      return {
        success: true,
        commandId: finalCommandId,
        dom: subDomElements.join('\n'), // Return the sub-DOM elements instead of full page
        screenshotId,
        duration,
        metadata: { 
          selector: resolvedSelector, 
          originalSelector: selector,
          subDOM: subDomElements,
          elementsFound: elements.length,
          totalSize,
          maxSize,
          sizeUtilization: (totalSize / maxSize * 100).toFixed(2) + '%',
          fullPageDOM: dom // Keep full page DOM in metadata for reference
        }
      };

    } catch (error) {
      // Check if it's a StandardError (like SUBDOM_SIZE_EXCEEDED)
      if (error && typeof error === 'object' && 'code' in error && 'moduleId' in error) {
        throw error;
      }
      
      throw this.errorHandler.createElementError(
        selector,
        'get sub-DOM',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gets readable text from element(s) matching the selector using readability
   */
  async getText(
    session: ExecutorSession, 
    selector: string,
    commandId?: string
  ): Promise<CommandResponse> {
    const startTime = Date.now();
    const finalCommandId = commandId || `get_text_${Date.now()}`;

    try {
      // Resolve variables in selector
      const resolvedSelector = this.variableResolver.resolve(session.linkedWorkflowSessionId, selector);
      
      this.logger.logVariableInterpolation(
        session.linkedWorkflowSessionId,
        selector,
        resolvedSelector,
        this.variableResolver.listVariables(session.linkedWorkflowSessionId)
      );

      // Wait for element to exist
      await session.page.waitForSelector(resolvedSelector, { 
        timeout: 10000,
        state: 'attached'
      });

      // Get the element
      const element = await session.page.$(resolvedSelector);
      
      if (!element) {
        throw this.errorHandler.createSelectorError(resolvedSelector);
      }

      // Get the element's outerHTML
      const elementHTML = await element.evaluate(el => el.outerHTML);
      
      // Create a JSDOM instance from the element HTML
      const dom = new JSDOM(`<html><head></head><body>${elementHTML}</body></html>`, {
        url: session.page.url()
      });
      
      // Determine if we should use Readability or direct text extraction
      // Use direct extraction for body/html elements (to get ALL text including modals)
      // Use readability for specific content elements like articles
      const shouldUseReadability = !['body', 'html'].includes(resolvedSelector.toLowerCase().trim()) && 
                                   !resolvedSelector.includes('body') && 
                                   !resolvedSelector.includes('html');
      
      let readableText = '';
      let usedReadability = false;
      
      if (shouldUseReadability) {
        // Use Readability for specific content extraction (articles, specific sections)
        const reader = new Readability(dom.window.document, {
          debug: false,
          maxElemsToParse: 0, // No limit
          nbTopCandidates: 5,
          charThreshold: 500,
          classesToPreserve: [],
          keepClasses: false
        });
        
        const article = reader.parse();
        
        if (article && article.content) {
          // Extract just the text content, removing HTML tags
          const textDiv = new JSDOM(article.content);
          readableText = textDiv.window.document.body.textContent || textDiv.window.document.body.innerText || '';
          // Normalize whitespace but preserve line breaks
          readableText = readableText
            .replace(/[ \t]+/g, ' ') // Collapse spaces and tabs
            .replace(/\n\s*\n/g, '\n\n') // Normalize multiple line breaks to double
            .replace(/^\s+|\s+$/g, '') // Trim start/end
            .replace(/\n /g, '\n') // Remove spaces at start of lines
            .replace(/ \n/g, '\n'); // Remove spaces at end of lines
          usedReadability = true;
        }
      }
      
      if (!usedReadability || !readableText) {
        // Direct text extraction for body, html, or when readability fails
        
        // For body/html elements, use comprehensive text extraction to capture ALL visible text
        if (resolvedSelector.toLowerCase().trim() === 'body' || resolvedSelector.toLowerCase().trim() === 'html' || 
            resolvedSelector.includes('body') || resolvedSelector.includes('html')) {
          
          readableText = await element.evaluate((el) => {
            // Get all elements that are currently visible
            const allElements = Array.from(document.querySelectorAll('*')).filter((element) => {
              const style = window.getComputedStyle(element);
              const rect = element.getBoundingClientRect();
              
              // Element must be visible and have some dimensions or be positioned
              return style.display !== 'none' && 
                     style.visibility !== 'hidden' && 
                     style.opacity !== '0' &&
                     !(element as HTMLElement).hidden &&
                     (rect.width > 0 || rect.height > 0 || 
                      style.position === 'fixed' || style.position === 'absolute');
            });
            
            // Extract text from all visible elements, avoiding duplicates
            const textSet = new Set<string>();
            allElements.forEach(element => {
              // Get direct text content (not including children to avoid duplicates)
              for (const node of element.childNodes) {
                if (node.nodeType === Node.TEXT_NODE) {
                  const text = node.textContent?.trim();
                  if (text && text.length > 0) {
                    textSet.add(text);
                  }
                }
              }
            });
            
            return Array.from(textSet).join(' ');
          }) || '';
          
        } else {
          // For specific elements, use simple text extraction (better for tests and most cases)
          try {
            // Try innerText first (respects CSS visibility)
            readableText = await element.innerText() || '';
          } catch {
            // Fallback to textContent
            readableText = await element.textContent() || '';
          }
        }
        
        // Normalize whitespace but preserve line structure
        readableText = readableText
          .replace(/[ \t]+/g, ' ') // Collapse spaces and tabs
          .replace(/\n\s*\n\s*\n+/g, '\n\n') // Normalize multiple line breaks
          .replace(/^\s+|\s+$/g, '') // Trim start/end
          .replace(/\n /g, '\n') // Remove spaces at start of lines
          .replace(/ \n/g, '\n'); // Remove spaces at end of lines
      }

      this.logger.debug(
        `Text extracted from selector: ${resolvedSelector}`,
        session.linkedWorkflowSessionId,
        { 
          selector: resolvedSelector, 
          originalSelector: selector,
          textLength: readableText.length,
          usedReadability,
          extractionMethod: usedReadability ? 'readability' : 'direct'
        }
      );

      // Get DOM and capture screenshot
      const dom_content = await session.page.content();
      const screenshotId = await this.screenshotManager.captureScreenshot(
        session.linkedWorkflowSessionId,
        CommandAction.GET_TEXT,
        session.page,
        { 
          selector: resolvedSelector, 
          originalSelector: selector,
          textLength: readableText.length,
          usedReadability,
          extractionMethod: usedReadability ? 'readability' : 'direct'
        }
      );

      const duration = Date.now() - startTime;

      return {
        success: true,
        commandId: finalCommandId,
        dom: readableText, // Return readable text instead of full DOM
        screenshotId,
        duration,
        metadata: { 
          selector: resolvedSelector, 
          originalSelector: selector,
          readableText,
          textLength: readableText.length,
          usedReadability,
          extractionMethod: usedReadability ? 'readability' : 'direct',
          fullDomLength: dom_content.length // Keep track of original DOM size for reference
        }
      };

    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }
      
      throw this.errorHandler.createElementError(
        selector,
        'get readable text',
        error instanceof Error ? error : undefined
      );
    }
  }
}

