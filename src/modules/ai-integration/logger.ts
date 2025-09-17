/**
 * Logger
 * Handles logging of AI requests and responses to a single log file
 * Based on design/ai-integration-module.md specifications
 */

import * as fs from 'fs';
import * as path from 'path';
import { LogEntry, createAIIntegrationError } from './types';

export class Logger {
  private logFilePath: string;
  private requestCounter: number = 0;

  /**
   * Initialize logger with log file path
   * @param logFilePath Path to the log file
   */
  constructor(logFilePath: string = './ai-requests.log') {
    this.logFilePath = path.resolve(logFilePath);
    this.ensureLogDirectoryExists();
  }

  /**
   * Log a request to the log file
   * @param request Request data to log
   * @returns Unique request ID for correlation
   */
  logRequest(request: any): string {
    const requestId = this.generateRequestId();
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      type: 'request',
      data: {
        requestId,
        ...this.sanitizeRequestData(request)
      }
    };

    this.writeLogEntry(logEntry);
    return requestId;
  }

  /**
   * Log a response to the log file
   * @param requestId The ID of the corresponding request
   * @param response Response data to log
   */
  logResponse(requestId: string, response: any): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      type: 'response',
      data: {
        requestId,
        ...this.sanitizeResponseData(response)
      }
    };

    this.writeLogEntry(logEntry);
  }

  /**
   * Log an error that occurred during request processing
   * @param requestId The ID of the corresponding request
   * @param error Error data to log
   */
  logError(requestId: string, error: any): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      type: 'response',
      data: {
        requestId,
        error: true,
        errorCode: error.code || error.errorCode || 'UNKNOWN_ERROR',
        errorMessage: error.message || String(error),
        errorDetails: error.details || {}
      }
    };

    this.writeLogEntry(logEntry);
  }

  /**
   * Generate a unique request ID for correlation
   * @returns Unique request ID string
   */
  private generateRequestId(): string {
    this.requestCounter++;
    const timestamp = Date.now();
    const counter = this.requestCounter.toString().padStart(4, '0');
    return `req_${timestamp}_${counter}`;
  }

  /**
   * Sanitize request data for logging (remove sensitive information)
   * @param request Raw request data
   * @returns Sanitized request data
   */
  private sanitizeRequestData(request: any): any {
    const sanitized = { ...request };

    // Remove or mask sensitive data
    if (sanitized.headers && sanitized.headers.Authorization) {
      sanitized.headers.Authorization = this.maskAuthHeader(sanitized.headers.Authorization);
    }

    // Truncate very long text content for readability
    if (sanitized.messages && Array.isArray(sanitized.messages)) {
      sanitized.messages = sanitized.messages.map((message: any) => {
        if (typeof message.content === 'string' && message.content.length > 1000) {
          return {
            ...message,
            content: message.content.substring(0, 1000) + '... [truncated]',
            originalLength: message.content.length
          };
        }
        return message;
      });
    }

    // Handle base64 image data - don't log the full data
    if (sanitized.messages && Array.isArray(sanitized.messages)) {
      sanitized.messages = sanitized.messages.map((message: any) => {
        if (Array.isArray(message.content)) {
          return {
            ...message,
            content: message.content.map((item: any) => {
              if (item.type === 'image_url' && item.image_url?.url?.startsWith('data:')) {
                return {
                  ...item,
                  image_url: {
                    url: '[base64 image data removed for logging]'
                  },
                  originalDataSize: item.image_url.url.length
                };
              }
              return item;
            })
          };
        }
        return message;
      });
    }

    return sanitized;
  }

  /**
   * Sanitize response data for logging
   * @param response Raw response data
   * @returns Sanitized response data
   */
  private sanitizeResponseData(response: any): any {
    const sanitized = { ...response };

    // Add response metadata for debugging
    if (sanitized.headers) {
      sanitized.responseHeaders = {
        'content-type': sanitized.headers['content-type'],
        'x-ratelimit-remaining': sanitized.headers['x-ratelimit-remaining'],
        'x-ratelimit-reset': sanitized.headers['x-ratelimit-reset']
      };
      delete sanitized.headers;
    }

    return sanitized;
  }

  /**
   * Mask authorization header for logging
   * @param authHeader Authorization header value
   * @returns Masked authorization header
   */
  private maskAuthHeader(authHeader: string): string {
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (token.length <= 8) {
        return 'Bearer ***';
      }
      return `Bearer ${token.substring(0, 4)}${'*'.repeat(token.length - 8)}${token.substring(token.length - 4)}`;
    }
    return '*** [masked]';
  }

  /**
   * Write log entry to file
   * @param logEntry The log entry to write
   */
  private writeLogEntry(logEntry: LogEntry): void {
    try {
      const logLine = JSON.stringify(logEntry) + '\n';
      fs.appendFileSync(this.logFilePath, logLine, 'utf8');
    } catch (error) {
      // If we can't write to the log file, we should at least try to report this
      // but we shouldn't crash the main operation
      console.error(`[AI Integration Logger] Failed to write to log file: ${error}`);
      
      // Attempt to throw a standardized error only if it's a critical issue
      if (error instanceof Error && error.message.includes('ENOSPC')) {
        throw createAIIntegrationError(
          'API_ERROR',
          'Failed to write to log file: disk space full',
          { logFilePath: this.logFilePath, originalError: error.message }
        );
      }
    }
  }

  /**
   * Ensure the log directory exists
   */
  private ensureLogDirectoryExists(): void {
    try {
      const logDir = path.dirname(this.logFilePath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    } catch (error) {
      throw createAIIntegrationError(
        'API_ERROR',
        `Failed to create log directory: ${error instanceof Error ? error.message : String(error)}`,
        { logFilePath: this.logFilePath, logDir: path.dirname(this.logFilePath) }
      );
    }
  }

  /**
   * Get log file path
   * @returns Current log file path
   */
  getLogFilePath(): string {
    return this.logFilePath;
  }

  /**
   * Check if log file is writable
   * @returns True if log file can be written to
   */
  isLogFileWritable(): boolean {
    try {
      // Try to append an empty string to test writability
      fs.appendFileSync(this.logFilePath, '', 'utf8');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get log file size in bytes
   * @returns Log file size or 0 if file doesn't exist
   */
  getLogFileSize(): number {
    try {
      const stats = fs.statSync(this.logFilePath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Rotate log file if it gets too large
   * @param maxSizeBytes Maximum file size before rotation (default: 100MB)
   */
  rotateLogFileIfNeeded(maxSizeBytes: number = 100 * 1024 * 1024): void {
    try {
      const currentSize = this.getLogFileSize();
      if (currentSize > maxSizeBytes) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedPath = `${this.logFilePath}.${timestamp}`;
        fs.renameSync(this.logFilePath, rotatedPath);
        
        // Log the rotation event
        this.writeLogEntry({
          timestamp: new Date().toISOString(),
          type: 'request',
          data: {
            requestId: 'LOG_ROTATION',
            event: 'log_rotated',
            oldFile: rotatedPath,
            newFile: this.logFilePath,
            oldSize: currentSize
          }
        });
      }
    } catch (error) {
      console.error(`[AI Integration Logger] Failed to rotate log file: ${error}`);
    }
  }
}
