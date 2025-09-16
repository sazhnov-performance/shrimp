/**
 * Command Processor
 * Implements command execution logic for all supported automation commands
 */

import { CommandAction } from '../../../types/shared-types';
import { 
  ExecutorSession, 
  ExecutorCommand, 
  CommandResponse, 
  ICommandProcessor 
} from './types';
import { ExecutorErrorHandler } from './error-handler';
import { IExecutorLogger } from './types';
import { IVariableResolver } from './types';
import { IScreenshotManager } from './types';

export class CommandProcessor implements ICommandProcessor {
  private errorHandler: ExecutorErrorHandler;
  private logger: IExecutorLogger;
  private variableResolver: IVariableResolver;
  private screenshotManager: IScreenshotManager;

  constructor(
    errorHandler: ExecutorErrorHandler,
    logger: IExecutorLogger,
    variableResolver: IVariableResolver,
    screenshotManager: IScreenshotManager
  ) {
    this.errorHandler = errorHandler;
    this.logger = logger;
    this.variableResolver = variableResolver;
    this.screenshotManager = screenshotManager;
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

      // Wait for any navigation or changes
      await session.page.waitForTimeout(500);

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
      await element.clear();
      await element.fill(resolvedText);

      // Wait for any changes
      await session.page.waitForTimeout(500);

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
}

