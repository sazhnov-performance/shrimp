/**
 * Logger
 * Simple file logging for AI requests and responses
 */

import * as fs from 'fs';
import * as path from 'path';

export class Logger {
  private logFilePath: string;

  constructor(logFilePath: string = './ai-requests.log') {
    this.logFilePath = logFilePath;
    this.ensureLogDirectoryExists();
  }

  /**
   * Log request data
   */
  logRequest(data: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'request',
      data: data
    };
    this.writeLogEntry(logEntry);
  }

  /**
   * Log response data
   */
  logResponse(data: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'response',
      data: data
    };
    this.writeLogEntry(logEntry);
  }

  /**
   * Write log entry to file (append-only)
   */
  private writeLogEntry(entry: any): void {
    try {
      const logLine = JSON.stringify(entry) + '\n';
      fs.appendFileSync(this.logFilePath, logLine, 'utf8');
    } catch (error) {
      // Silent fail for logging - don't break the main functionality
      console.error('Failed to write log entry:', error);
    }
  }

  /**
   * Ensure log directory exists
   */
  private ensureLogDirectoryExists(): void {
    try {
      const logDir = path.dirname(this.logFilePath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    } catch (error) {
      // Silent fail for directory creation
      console.error('Failed to create log directory:', error);
    }
  }
}
