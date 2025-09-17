import { LoggingConfig, LogLevel } from '../../types/shared-types';

/**
 * Logger implementation for Task Loop module
 * Provides structured logging with configurable levels and formatting
 */
export class Logger {
  private config: LoggingConfig;

  constructor(config: LoggingConfig) {
    this.config = config;
  }

  /**
   * Log debug level message
   */
  debug(message: string, context?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.log(LogLevel.DEBUG, message, context);
    }
  }

  /**
   * Log info level message
   */
  info(message: string, context?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.log(LogLevel.INFO, message, context);
    }
  }

  /**
   * Log warning level message
   */
  warn(message: string, context?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.log(LogLevel.WARN, message, context);
    }
  }

  /**
   * Log error level message
   */
  error(message: string, context?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.log(LogLevel.ERROR, message, context);
    }
  }

  /**
   * Check if a log level should be logged based on configuration
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const configLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);
    
    return messageLevelIndex >= configLevelIndex;
  }

  /**
   * Internal log method that formats and outputs the message
   */
  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    const logEntry = this.formatLogEntry(level, message, context);
    
    // Output to console (in production, this would go to a proper logging system)
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(logEntry);
        break;
      case LogLevel.INFO:
        console.info(logEntry);
        break;
      case LogLevel.WARN:
        console.warn(logEntry);
        break;
      case LogLevel.ERROR:
        console.error(logEntry);
        break;
    }
  }

  /**
   * Format log entry according to configuration
   */
  private formatLogEntry(level: LogLevel, message: string, context?: Record<string, any>): string {
    if (this.config.structured) {
      return this.formatStructuredLog(level, message, context);
    } else {
      return this.formatPlainLog(level, message, context);
    }
  }

  /**
   * Format structured JSON log entry
   */
  private formatStructuredLog(level: LogLevel, message: string, context?: Record<string, any>): string {
    const logObject: Record<string, any> = {
      level,
      message
    };

    if (this.config.includeTimestamp) {
      logObject.timestamp = new Date().toISOString();
    }

    if (this.config.includeModuleId) {
      logObject.moduleId = 'task-loop';
    }

    if (context) {
      if (this.config.includeSessionId && context.sessionId) {
        logObject.sessionId = context.sessionId;
      }
      
      if (this.config.includeSessionId && context.workflowSessionId) {
        logObject.sessionId = context.workflowSessionId;
      }
      
      // Include other context properties
      Object.keys(context).forEach(key => {
        if (key !== 'sessionId' && key !== 'workflowSessionId') {
          logObject[key] = context[key];
        }
      });
    }

    return JSON.stringify(logObject);
  }

  /**
   * Format plain text log entry
   */
  private formatPlainLog(level: LogLevel, message: string, context?: Record<string, any>): string {
    let logLine = '';

    // Add prefix
    logLine += this.config.prefix;

    // Add level
    logLine += `[${level}]`;

    // Add timestamp if enabled
    if (this.config.includeTimestamp) {
      logLine += ` [${new Date().toISOString()}]`;
    }

    // Add session ID if enabled and available
    if (this.config.includeSessionId && context) {
      const sessionId = context.sessionId || context.workflowSessionId;
      if (sessionId) {
        logLine += ` [${sessionId}]`;
      }
    }

    // Add module ID if enabled
    if (this.config.includeModuleId) {
      logLine += ` [task-loop]`;
    }

    // Add message
    logLine += ` ${message}`;

    // Add context if available
    if (context && Object.keys(context).length > 0) {
      const contextCopy = { ...context };
      
      // Remove session IDs as they're already included in the log line
      delete contextCopy.sessionId;
      delete contextCopy.workflowSessionId;
      
      if (Object.keys(contextCopy).length > 0) {
        logLine += ` ${JSON.stringify(contextCopy)}`;
      }
    }

    return logLine;
  }
}

export default Logger;
