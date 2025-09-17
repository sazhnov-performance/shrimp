/**
 * Step Processor Logger Implementation
 * Provides structured logging functionality for the Step Processor module
 * Based on design/step-processor.md specifications
 */

import { 
  StandardError, 
  LogLevel, 
  LoggingConfig 
} from '../../../types/shared-types';
import { 
  ILoggerInterface, 
  LogContext,
  StepProcessorConfig 
} from './types';

export class StepProcessorLogger implements ILoggerInterface {
  private config: LoggingConfig;

  constructor(config: LoggingConfig) {
    this.config = config;
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: StandardError, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, { ...context, error });
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.shouldLog(level)) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      module: 'step-processor',
      sessionId: context?.sessionId,
      stepIndex: context?.stepIndex,
      workflowSessionId: context?.workflowSession?.sessionId,
      message,
      context: this.sanitizeContext(context)
    };

    if (this.config.structured) {
      this.outputStructuredLog(logEntry);
    } else {
      this.outputFormattedLog(logEntry);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levelHierarchy = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 1,
      [LogLevel.WARN]: 2,
      [LogLevel.ERROR]: 3
    };

    return levelHierarchy[level] >= levelHierarchy[this.config.level];
  }

  private outputStructuredLog(logEntry: any): void {
    console.log(JSON.stringify(logEntry));
  }

  private outputFormattedLog(logEntry: any): void {
    const parts: string[] = [];

    // Module prefix
    if (this.config.includeModuleId) {
      parts.push(this.config.prefix || '[StepProcessor]');
    }

    // Log level
    parts.push(`[${logEntry.level}]`);

    // Timestamp
    if (this.config.includeTimestamp) {
      parts.push(`[${logEntry.timestamp}]`);
    }

    // Session ID
    if (this.config.includeSessionId && logEntry.sessionId) {
      parts.push(`[${logEntry.sessionId}]`);
    }

    // Workflow Session ID (if different from session ID)
    if (logEntry.workflowSessionId && logEntry.workflowSessionId !== logEntry.sessionId) {
      parts.push(`[WF:${logEntry.workflowSessionId}]`);
    }

    // Step index
    if (logEntry.stepIndex !== undefined) {
      parts.push(`:${logEntry.stepIndex}`);
    }

    // Message
    const prefix = parts.join(' ');
    const fullMessage = `${prefix} ${logEntry.message}`;

    // Output based on log level
    switch (logEntry.level) {
      case LogLevel.ERROR:
        console.error(fullMessage, logEntry.context?.error || '');
        break;
      case LogLevel.WARN:
        console.warn(fullMessage);
        break;
      case LogLevel.INFO:
        console.info(fullMessage);
        break;
      case LogLevel.DEBUG:
        console.debug(fullMessage);
        break;
      default:
        console.log(fullMessage);
    }

    // Output additional context if present and not in structured mode
    if (logEntry.context && Object.keys(logEntry.context).length > 0) {
      console.log(`${prefix} Context:`, this.formatContext(logEntry.context));
    }
  }

  private sanitizeContext(context?: LogContext): any {
    if (!context) return undefined;

    const sanitized: any = {};

    // Copy basic properties
    if (context.sessionId) sanitized.sessionId = context.sessionId;
    if (context.stepIndex !== undefined) sanitized.stepIndex = context.stepIndex;
    if (context.duration !== undefined) sanitized.duration = context.duration;

    // Include workflow session info (but only key fields to avoid circular references)
    if (context.workflowSession) {
      sanitized.workflowSession = {
        sessionId: context.workflowSession.sessionId,
        status: context.workflowSession.status,
        createdAt: context.workflowSession.createdAt,
        lastActivity: context.workflowSession.lastActivity
      };
    }

    // Include error info
    if (context.error) {
      sanitized.error = {
        id: context.error.id,
        code: context.error.code,
        message: context.error.message,
        category: context.error.category,
        severity: context.error.severity,
        recoverable: context.error.recoverable,
        retryable: context.error.retryable
      };
    }

    // Include additional details (but limit size)
    if (context.details) {
      sanitized.details = this.limitObjectSize(context.details, 1000);
    }

    return sanitized;
  }

  private formatContext(context: any): string {
    try {
      return JSON.stringify(context, null, 2);
    } catch (error) {
      return '[Context serialization failed]';
    }
  }

  private limitObjectSize(obj: any, maxLength: number): any {
    const str = JSON.stringify(obj);
    if (str.length <= maxLength) {
      return obj;
    }

    // Truncate and indicate truncation
    const truncated = str.substring(0, maxLength - 20) + '...[truncated]';
    try {
      return JSON.parse(truncated + '}');
    } catch {
      return { truncated: true, partialData: str.substring(0, maxLength - 50) };
    }
  }

  // Step Processor specific logging methods
  logWorkflowStarted(sessionId: string, totalSteps: number, context?: LogContext): void {
    this.info(`Workflow processing started with ${totalSteps} steps`, {
      ...context,
      sessionId,
      details: { totalSteps }
    });
  }

  logWorkflowCompleted(sessionId: string, duration: number, context?: LogContext): void {
    this.info(`Workflow processing completed successfully`, {
      ...context,
      sessionId,
      duration,
      details: { status: 'completed' }
    });
  }

  logWorkflowFailed(sessionId: string, error: StandardError, context?: LogContext): void {
    this.error(`Workflow processing failed`, error, {
      ...context,
      sessionId
    });
  }

  logStepStarted(sessionId: string, stepIndex: number, stepContent: string, context?: LogContext): void {
    this.info(`Step started: "${stepContent}"`, {
      ...context,
      sessionId,
      stepIndex,
      details: { stepContent: stepContent.substring(0, 100) }
    });
  }

  logStepCompleted(sessionId: string, stepIndex: number, duration: number, context?: LogContext): void {
    this.info(`Step completed successfully`, {
      ...context,
      sessionId,
      stepIndex,
      duration,
      details: { status: 'completed' }
    });
  }

  logStepFailed(sessionId: string, stepIndex: number, error: StandardError, context?: LogContext): void {
    this.error(`Step execution failed`, error, {
      ...context,
      sessionId,
      stepIndex
    });
  }

  logSessionCreated(sessionId: string, workflowSessionId: string, context?: LogContext): void {
    this.debug(`Created workflow session with linked sessions`, {
      ...context,
      sessionId,
      details: { workflowSessionId }
    });
  }

  logSessionDestroyed(sessionId: string, context?: LogContext): void {
    this.debug(`Destroyed workflow session and linked sessions`, {
      ...context,
      sessionId
    });
  }

  logEventPublished(eventType: string, sessionId: string, streamId?: string, context?: LogContext): void {
    this.debug(`Published event: ${eventType}`, {
      ...context,
      sessionId,
      details: { eventType, streamId }
    });
  }

  logDependencyResolution(moduleId: string, dependencyToken: string, success: boolean, context?: LogContext): void {
    const message = success 
      ? `Resolved dependency: ${dependencyToken} for ${moduleId}`
      : `Failed to resolve dependency: ${dependencyToken} for ${moduleId}`;
    
    if (success) {
      this.debug(message, {
        ...context,
        details: { moduleId, dependencyToken, success }
      });
    } else {
      this.warn(message, {
        ...context,
        details: { moduleId, dependencyToken, success }
      });
    }
  }

  logPerformanceMetric(operation: string, duration: number, sessionId?: string, context?: LogContext): void {
    const message = `Performance: ${operation} completed in ${duration}ms`;
    
    if (duration > 5000) { // Warn if operation takes more than 5 seconds
      this.warn(message, {
        ...context,
        sessionId,
        duration,
        details: { operation, performance: 'slow' }
      });
    } else {
      this.debug(message, {
        ...context,
        sessionId,
        duration,
        details: { operation, performance: 'normal' }
      });
    }
  }
}

// Factory function for creating logger instances
export function createStepProcessorLogger(config: LoggingConfig): ILoggerInterface {
  return new StepProcessorLogger(config);
}

// Helper function to create logger from Step Processor config
export function createLoggerFromConfig(config: StepProcessorConfig): ILoggerInterface {
  return new StepProcessorLogger(config.logging);
}

// Default logger instance (can be used for testing or simple scenarios)
export function createDefaultLogger(): ILoggerInterface {
  const defaultConfig: LoggingConfig = {
    level: LogLevel.INFO,
    prefix: '[StepProcessor]',
    includeTimestamp: true,
    includeSessionId: true,
    includeModuleId: true,
    structured: false
  };
  
  return new StepProcessorLogger(defaultConfig);
}
