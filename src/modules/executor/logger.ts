/**
 * Executor Logger
 * Implements standardized logging with [Executor] prefix and session tracking
 */

import { LogLevel, LogEntry, IExecutorLogger, LogContext } from './types';
import * as winston from 'winston';

export class ExecutorLogger implements IExecutorLogger {
  private entries: LogEntry[] = [];
  private winstonLogger: winston.Logger;
  private maxEntries: number = 1000;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.winstonLogger = winston.createLogger({
      level: level.toLowerCase(),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, sessionId, context }) => {
          const sessionPart = sessionId ? ` [${sessionId}]` : '';
          const contextPart = context ? ` ${JSON.stringify(context)}` : '';
          return `${timestamp} [Executor][${level.toUpperCase()}]${sessionPart} ${message}${contextPart}`;
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
          filename: 'logs/executor.log',
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5
        })
      ]
    });
  }

  debug(message: string, sessionId?: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, sessionId, context);
  }

  info(message: string, sessionId?: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, sessionId, context);
  }

  warn(message: string, sessionId?: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, sessionId, context);
  }

  error(message: string, sessionId?: string, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, sessionId, context);
  }

  private log(level: LogLevel, message: string, sessionId?: string, context?: LogContext): void {
    const entry: LogEntry = {
      level,
      message,
      sessionId,
      timestamp: new Date(),
      context
    };

    // Add to internal entries
    this.entries.push(entry);
    this.trimEntries();

    // Log via winston with error handling
    try {
      this.winstonLogger.log({
        level: level.toLowerCase(),
        message,
        sessionId,
        context
      });
    } catch (error) {
      // Fallback to console if winston fails
      console.error(`Winston logging failed: ${error}. Original message: ${message}`);
    }
  }

  getEntries(level?: LogLevel, sessionId?: string): LogEntry[] {
    let filtered = this.entries;

    if (level) {
      const levelPriority = this.getLevelPriority(level);
      filtered = filtered.filter(entry => 
        this.getLevelPriority(entry.level) >= levelPriority
      );
    }

    if (sessionId) {
      filtered = filtered.filter(entry => entry.sessionId === sessionId);
    }

    return [...filtered]; // Return copy
  }

  private getLevelPriority(level: LogLevel): number {
    const priorities = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 1,
      [LogLevel.WARN]: 2,
      [LogLevel.ERROR]: 3
    };
    return priorities[level] || 0;
  }

  private trimEntries(): void {
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
  }

  /**
   * Sets the maximum number of log entries to keep in memory
   */
  setMaxEntries(max: number): void {
    this.maxEntries = max;
    this.trimEntries();
  }

  /**
   * Clears all log entries for a specific session
   */
  clearSessionLogs(sessionId: string): void {
    this.entries = this.entries.filter(entry => entry.sessionId !== sessionId);
  }

  /**
   * Gets statistics about logged entries
   */
  getLogStats(): { total: number; byLevel: Record<string, number>; bySessions: number } {
    const byLevel: Record<string, number> = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 0,
      [LogLevel.WARN]: 0,
      [LogLevel.ERROR]: 0
    };

    const sessions = new Set<string>();

    this.entries.forEach(entry => {
      byLevel[entry.level]++;
      if (entry.sessionId) {
        sessions.add(entry.sessionId);
      }
    });

    return {
      total: this.entries.length,
      byLevel,
      bySessions: sessions.size
    };
  }

  /**
   * Updates the winston logger level
   */
  setLogLevel(level: LogLevel): void {
    this.winstonLogger.level = level.toLowerCase();
  }

  /**
   * Logs a formatted command execution
   */
  logCommandExecution(
    sessionId: string, 
    action: string, 
    duration: number, 
    success: boolean,
    details?: LogContext
  ): void {
    const message = `Command ${action} ${success ? 'completed' : 'failed'} in ${duration}ms`;
    const context = { action, duration, success, ...details };
    
    if (success) {
      this.info(message, sessionId, context);
    } else {
      this.error(message, sessionId, context);
    }
  }

  /**
   * Logs variable interpolation details
   */
  logVariableInterpolation(
    sessionId: string, 
    original: string, 
    resolved: string, 
    variables: Record<string, string>
  ): void {
    this.debug(
      `Interpolating selector: ${original} -> ${resolved}`, 
      sessionId, 
      { original, resolved, variables }
    );
  }

  /**
   * Logs session lifecycle events
   */
  logSessionEvent(sessionId: string, event: string, details?: LogContext): void {
    this.info(`Session ${event}`, sessionId, details);
  }

  /**
   * Logs screenshot capture events
   */
  logScreenshotCapture(
    sessionId: string, 
    screenshotId: string, 
    actionType: string, 
    success: boolean,
    details?: LogContext
  ): void {
    const message = `Screenshot ${success ? 'captured' : 'failed'}: ${screenshotId} for action ${actionType}`;
    const context = { screenshotId, actionType, success, ...details };
    
    if (success) {
      this.debug(message, sessionId, context);
    } else {
      this.warn(message, sessionId, context);
    }
  }

  /**
   * Logs performance metrics
   */
  logPerformanceMetric(
    sessionId: string, 
    metric: string, 
    value: number, 
    unit: string = 'ms'
  ): void {
    this.debug(
      `Performance: ${metric} = ${value}${unit}`, 
      sessionId, 
      { metric, value, unit }
    );
  }
}

