/**
 * Executor Module Main Interface
 * Main entry point that brings together all executor components
 */

import {
  SessionStatus,
  ModuleSessionInfo,
  ModuleSessionConfig,
  SessionLifecycleCallbacks,
  SessionManagerHealth
} from './types';
import {
  ExecutorSession,
  ExecutorCommand,
  CommandResponse,
  ExecutorConfig,
  DEFAULT_EXECUTOR_CONFIG,
  CleanupResult,
  ScreenshotInfo
} from './types';
import { ExecutorSessionManager } from './session-manager';
import { CommandProcessor } from './command-processor';
import { VariableResolver } from './variable-resolver';
import { ScreenshotManager } from './screenshot-manager';
import { ExecutorErrorHandler } from './error-handler';
import { ExecutorLogger } from './logger';

export interface IExecutor {
  readonly moduleId: 'executor';
  
  // Standardized Session Management
  createSession(workflowSessionId: string, config?: ModuleSessionConfig): Promise<string>;
  destroySession(workflowSessionId: string): Promise<void>;
  getSession(workflowSessionId: string): ModuleSessionInfo | null;
  sessionExists(workflowSessionId: string): boolean;
  updateSessionStatus(workflowSessionId: string, status: SessionStatus): Promise<void>;
  getSessionStatus(workflowSessionId: string): SessionStatus | null;
  recordActivity(workflowSessionId: string): Promise<void>;
  getLastActivity(workflowSessionId: string): Date | null;
  setLifecycleCallbacks(callbacks: SessionLifecycleCallbacks): void;
  healthCheck(): Promise<SessionManagerHealth>;
  
  // Executor-specific session access
  getSessionInfo(workflowSessionId: string): ExecutorSession | null;
  
  // Command Execution
  executeCommand(command: ExecutorCommand): Promise<CommandResponse>;
  
  // Specific Command Methods
  openPage(workflowSessionId: string, url: string): Promise<CommandResponse>;
  clickElement(workflowSessionId: string, selector: string): Promise<CommandResponse>;
  inputText(workflowSessionId: string, selector: string, text: string): Promise<CommandResponse>;
  saveVariable(workflowSessionId: string, selector: string, variableName: string): Promise<CommandResponse>;
  getCurrentDOM(workflowSessionId: string): Promise<CommandResponse>;
  getContent(workflowSessionId: string, selector: string, attribute?: string, multiple?: boolean): Promise<CommandResponse>;
  getSubDOM(workflowSessionId: string, selector: string, maxDomSize?: number): Promise<CommandResponse>;
  getText(workflowSessionId: string, selector: string): Promise<CommandResponse>;
  
  // Variable Management
  setVariable(workflowSessionId: string, name: string, value: string): Promise<void>;
  getVariable(workflowSessionId: string, name: string): string | null;
  listVariables(workflowSessionId: string): Record<string, string>;
  
  // Utility Methods
  resolveVariables(workflowSessionId: string, input: string): string;
  
  // Screenshot Management
  getScreenshot(screenshotId: string): Promise<ScreenshotInfo | null>;
  listScreenshots(workflowSessionId: string): Promise<ScreenshotInfo[]>;
  deleteScreenshot(screenshotId: string): Promise<void>;
  cleanupScreenshots(workflowSessionId?: string): Promise<CleanupResult>;
}

export class Executor implements IExecutor {
  readonly moduleId = 'executor' as const;
  
  private static instance: Executor | null = null;
  private sessionManager: ExecutorSessionManager;
  private commandProcessor: CommandProcessor;
  private variableResolver: VariableResolver;
  private screenshotManager: ScreenshotManager;
  private errorHandler: ExecutorErrorHandler;
  private logger: ExecutorLogger;
  private config: ExecutorConfig;

  private constructor(config: ExecutorConfig = DEFAULT_EXECUTOR_CONFIG) {
    this.config = config;
    
    // Initialize components
    this.errorHandler = new ExecutorErrorHandler();
    this.logger = new ExecutorLogger(config.logging.level);
    this.variableResolver = new VariableResolver(this.errorHandler);
    this.screenshotManager = new ScreenshotManager(
      config.screenshots,
      this.errorHandler,
      this.logger
    );
    this.sessionManager = new ExecutorSessionManager(
      config,
      this.errorHandler,
      this.logger
    );
    this.commandProcessor = new CommandProcessor(
      this.errorHandler,
      this.logger,
      this.variableResolver,
      this.screenshotManager,
      config.networkIdle
    );

    this.logger.info('Executor module initialized', undefined, { 
      moduleId: this.moduleId,
      config: {
        browserType: config.browser.type,
        headless: config.browser.headless,
        maxSessions: config.browser.maxSessions,
        screenshotsEnabled: config.screenshots.enabled
      }
    });
  }

  /**
   * Get singleton instance of Executor
   * @param config Optional configuration for the executor
   * @returns Executor instance
   */
  static getInstance(config?: ExecutorConfig): Executor {
    if (!Executor.instance) {
      Executor.instance = new Executor(config);
    }
    return Executor.instance;
  }

  // Session Management Implementation
  async createSession(workflowSessionId: string, config?: ModuleSessionConfig): Promise<string> {
    // Check session limits
    const stats = this.sessionManager.getStatistics();
    if (stats.activeSessions >= this.config.browser.maxSessions) {
      throw this.errorHandler.createStandardError(
        'SESSION_LIMIT_EXCEEDED',
        `Maximum sessions limit of ${this.config.browser.maxSessions} exceeded`,
        { currentSessions: stats.activeSessions, maxSessions: this.config.browser.maxSessions }
      );
    }
    
    return await this.sessionManager.createSession(workflowSessionId, config);
  }

  async destroySession(workflowSessionId: string): Promise<void> {
    await this.sessionManager.destroySession(workflowSessionId);
  }

  getSession(workflowSessionId: string): ModuleSessionInfo | null {
    return this.sessionManager.getSession(workflowSessionId);
  }

  sessionExists(workflowSessionId: string): boolean {
    return this.sessionManager.sessionExists(workflowSessionId);
  }

  async updateSessionStatus(workflowSessionId: string, status: SessionStatus): Promise<void> {
    await this.sessionManager.updateSessionStatus(workflowSessionId, status);
  }

  getSessionStatus(workflowSessionId: string): SessionStatus | null {
    return this.sessionManager.getSessionStatus(workflowSessionId);
  }

  async recordActivity(workflowSessionId: string): Promise<void> {
    await this.sessionManager.recordActivity(workflowSessionId);
  }

  getLastActivity(workflowSessionId: string): Date | null {
    return this.sessionManager.getLastActivity(workflowSessionId);
  }

  setLifecycleCallbacks(callbacks: SessionLifecycleCallbacks): void {
    this.sessionManager.setLifecycleCallbacks(callbacks);
  }

  async healthCheck(): Promise<SessionManagerHealth> {
    return await this.sessionManager.healthCheck();
  }

  // Executor-specific Methods
  getSessionInfo(workflowSessionId: string): ExecutorSession | null {
    return this.sessionManager.getExecutorSession(workflowSessionId);
  }

  async executeCommand(command: ExecutorCommand): Promise<CommandResponse> {
    const session = this.sessionManager.getExecutorSession(command.sessionId);
    if (!session) {
      throw this.errorHandler.createSessionNotFoundError(command.sessionId);
    }

    // Record activity
    await this.recordActivity(command.sessionId);

    return await this.commandProcessor.executeCommand(session, command);
  }

  // Specific Command Methods
  async openPage(workflowSessionId: string, url: string): Promise<CommandResponse> {
    const session = this.sessionManager.getExecutorSession(workflowSessionId);
    if (!session) {
      throw this.errorHandler.createSessionNotFoundError(workflowSessionId);
    }

    if (!url || url.trim() === '') {
      throw this.errorHandler.createInvalidCommandError(
        { action: 'OPEN_PAGE' } as any,
        'URL parameter is required and cannot be empty'
      );
    }

    const commandId = this.generateCommandId();
    await this.recordActivity(workflowSessionId);

    return await this.commandProcessor.openPage(session, url, commandId);
  }

  async clickElement(workflowSessionId: string, selector: string): Promise<CommandResponse> {
    const session = this.sessionManager.getExecutorSession(workflowSessionId);
    if (!session) {
      throw this.errorHandler.createSessionNotFoundError(workflowSessionId);
    }

    const commandId = this.generateCommandId();
    await this.recordActivity(workflowSessionId);

    return await this.commandProcessor.clickElement(session, selector, commandId);
  }

  async inputText(workflowSessionId: string, selector: string, text: string): Promise<CommandResponse> {
    const session = this.sessionManager.getExecutorSession(workflowSessionId);
    if (!session) {
      throw this.errorHandler.createSessionNotFoundError(workflowSessionId);
    }

    const commandId = this.generateCommandId();
    await this.recordActivity(workflowSessionId);

    return await this.commandProcessor.inputText(session, selector, text, commandId);
  }

  async saveVariable(workflowSessionId: string, selector: string, variableName: string): Promise<CommandResponse> {
    const session = this.sessionManager.getExecutorSession(workflowSessionId);
    if (!session) {
      throw this.errorHandler.createSessionNotFoundError(workflowSessionId);
    }

    const commandId = this.generateCommandId();
    await this.recordActivity(workflowSessionId);

    return await this.commandProcessor.saveVariable(session, selector, variableName, commandId);
  }

  async getCurrentDOM(workflowSessionId: string): Promise<CommandResponse> {
    const session = this.sessionManager.getExecutorSession(workflowSessionId);
    if (!session) {
      throw this.errorHandler.createSessionNotFoundError(workflowSessionId);
    }

    const commandId = this.generateCommandId();
    await this.recordActivity(workflowSessionId);

    return await this.commandProcessor.getCurrentDOM(session, commandId);
  }

  async getContent(workflowSessionId: string, selector: string, attribute?: string, multiple?: boolean): Promise<CommandResponse> {
    const session = this.sessionManager.getExecutorSession(workflowSessionId);
    if (!session) {
      throw this.errorHandler.createSessionNotFoundError(workflowSessionId);
    }

    if (!selector || selector.trim() === '') {
      throw this.errorHandler.createInvalidCommandError(
        { action: 'GET_CONTENT' } as any,
        'Selector parameter is required and cannot be empty'
      );
    }

    const commandId = this.generateCommandId();
    await this.recordActivity(workflowSessionId);

    return await this.commandProcessor.getContent(session, selector, attribute, multiple, commandId);
  }

  async getSubDOM(workflowSessionId: string, selector: string, maxDomSize?: number): Promise<CommandResponse> {
    const session = this.sessionManager.getExecutorSession(workflowSessionId);
    if (!session) {
      throw this.errorHandler.createSessionNotFoundError(workflowSessionId);
    }

    if (!selector || selector.trim() === '') {
      throw this.errorHandler.createInvalidCommandError(
        { action: 'GET_SUBDOM' } as any,
        'Selector parameter is required and cannot be empty'
      );
    }

    // Validate maxDomSize if provided
    if (maxDomSize !== undefined && (maxDomSize <= 0 || !Number.isInteger(maxDomSize))) {
      throw this.errorHandler.createInvalidCommandError(
        { action: 'GET_SUBDOM' } as any,
        'maxDomSize parameter must be a positive integer'
      );
    }

    const commandId = this.generateCommandId();
    await this.recordActivity(workflowSessionId);

    return await this.commandProcessor.getSubDOM(session, selector, maxDomSize, commandId);
  }

  async getText(workflowSessionId: string, selector: string): Promise<CommandResponse> {
    const session = this.sessionManager.getExecutorSession(workflowSessionId);
    if (!session) {
      throw this.errorHandler.createSessionNotFoundError(workflowSessionId);
    }

    if (!selector || selector.trim() === '') {
      throw this.errorHandler.createInvalidCommandError(
        { action: 'GET_TEXT' } as any,
        'Selector parameter is required and cannot be empty'
      );
    }

    const commandId = this.generateCommandId();
    await this.recordActivity(workflowSessionId);

    return await this.commandProcessor.getText(session, selector, commandId);
  }

  // Variable Management
  async setVariable(workflowSessionId: string, name: string, value: string): Promise<void> {
    if (!this.sessionExists(workflowSessionId)) {
      throw this.errorHandler.createSessionNotFoundError(workflowSessionId);
    }

    this.variableResolver.setVariable(workflowSessionId, name, value);
    await this.recordActivity(workflowSessionId);

    this.logger.debug(
      `Variable set: ${name} = "${value}"`,
      workflowSessionId,
      { variableName: name, value }
    );
  }

  getVariable(workflowSessionId: string, name: string): string | null {
    if (!this.sessionExists(workflowSessionId)) {
      return null;
    }

    return this.variableResolver.getVariable(workflowSessionId, name);
  }

  listVariables(workflowSessionId: string): Record<string, string> {
    if (!this.sessionExists(workflowSessionId)) {
      return {};
    }

    return this.variableResolver.listVariables(workflowSessionId);
  }

  // Utility Methods
  resolveVariables(workflowSessionId: string, input: string): string {
    if (!this.sessionExists(workflowSessionId)) {
      return input;
    }

    return this.variableResolver.resolve(workflowSessionId, input);
  }

  // Screenshot Management
  async getScreenshot(screenshotId: string): Promise<ScreenshotInfo | null> {
    return await this.screenshotManager.getScreenshot(screenshotId);
  }

  async listScreenshots(workflowSessionId: string): Promise<ScreenshotInfo[]> {
    return await this.screenshotManager.listScreenshots(workflowSessionId);
  }

  async deleteScreenshot(screenshotId: string): Promise<void> {
    await this.screenshotManager.deleteScreenshot(screenshotId);
  }

  async cleanupScreenshots(workflowSessionId?: string): Promise<CleanupResult> {
    return await this.screenshotManager.cleanupScreenshots(workflowSessionId);
  }

  // Configuration Management
  updateConfig(config: ExecutorConfig): void {
    this.config = config;
    this.sessionManager.updateConfig(config);
    this.screenshotManager.updateConfig(config.screenshots);
    this.logger.setLogLevel(config.logging.level);

    this.logger.info('Executor configuration updated', undefined, { 
      moduleId: this.moduleId,
      config: {
        browserType: config.browser.type,
        headless: config.browser.headless,
        maxSessions: config.browser.maxSessions,
        screenshotsEnabled: config.screenshots.enabled
      }
    });
  }

  getConfig(): ExecutorConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  // Statistics and Monitoring
  getStatistics(): {
    sessions: ReturnType<ExecutorSessionManager['getStatistics']>;
    screenshots: ReturnType<ScreenshotManager['getStatistics']>;
    variables: ReturnType<VariableResolver['getStatistics']>;
    logs: ReturnType<ExecutorLogger['getLogStats']>;
  } {
    return {
      sessions: this.sessionManager.getStatistics(),
      screenshots: this.screenshotManager.getStatistics(),
      variables: this.variableResolver.getStatistics(),
      logs: this.logger.getLogStats()
    };
  }

  private generateCommandId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Cleanup and Shutdown
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down executor module');
    
    // Destroy all sessions
    const activeSessions = this.sessionManager.listActiveSessions();
    for (const workflowSessionId of activeSessions) {
      try {
        await this.destroySession(workflowSessionId);
      } catch (error) {
        this.logger.error(
          `Error destroying session during shutdown: ${workflowSessionId}`,
          workflowSessionId,
          { error: error instanceof Error ? error.message : String(error) }
        );
      }
    }

    this.logger.info('Executor module shutdown complete');
  }
}

// Export main interface and implementation
export { Executor as default };

// Export types and components for testing
export type {
  ExecutorSession,
  ExecutorCommand,
  CommandResponse,
  ExecutorConfig,
  CleanupResult,
  ScreenshotInfo,
  ActionScreenshotConfig,
  ScreenshotConfig
} from './types';

export {
  DEFAULT_EXECUTOR_CONFIG
} from './types';

export {
  ExecutorSessionManager,
  CommandProcessor,
  VariableResolver,
  ScreenshotManager,
  ExecutorErrorHandler,
  ExecutorLogger
};

