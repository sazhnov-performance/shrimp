/**
 * Streamer Logger Class
 * Provides a convenient interface for other modules to send structured logs to the stream
 */

import { IExecutorStreamer } from './types';
import { 
  IStreamerLogger, 
  LogMessageType, 
  ReasoningLogMessage, 
  ActionLogMessage, 
  ScreenshotLogMessage 
} from './types';

/**
 * StreamerLogger - Helper class for sending structured logs to streams
 */
export class StreamerLogger implements IStreamerLogger {
  private streamer: IExecutorStreamer;
  private enableLogging: boolean;

  constructor(streamer: IExecutorStreamer, enableLogging: boolean = true) {
    this.streamer = streamer;
    this.enableLogging = enableLogging;
  }

  /**
   * Log AI reasoning with confidence level
   */
  async logReasoning(
    sessionId: string, 
    stepId: number, 
    text: string, 
    confidence: 'low' | 'medium' | 'high', 
    iteration?: number
  ): Promise<void> {
    if (!this.enableLogging) return;

    try {
      await this.ensureStreamExists(sessionId);

      // Sanitize text to remove problematic control characters
      const sanitizedText = this.sanitizeString(text);

      const message: ReasoningLogMessage = {
        type: LogMessageType.REASONING,
        text: sanitizedText,
        confidence,
        sessionId,
        stepId,
        iteration,
        timestamp: new Date()
      };

      await this.streamer.putStructuredEvent(
        sessionId,
        LogMessageType.REASONING,
        JSON.stringify(message),
        { confidence, stepId, iteration }
      );

      if (this.enableLogging) {
        console.log(`[StreamerLogger] Reasoning logged for session ${sessionId}, step ${stepId}: ${confidence} confidence`);
      }
    } catch (error) {
      console.warn(`[StreamerLogger] Failed to log reasoning for session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Log action execution result
   */
  async logAction(
    sessionId: string, 
    stepId: number, 
    actionName: string, 
    success: boolean, 
    result?: string, 
    error?: string, 
    iteration?: number
  ): Promise<void> {
    if (!this.enableLogging) return;

    try {
      await this.ensureStreamExists(sessionId);

      // Sanitize all string fields to remove problematic control characters
      const sanitizedActionName = this.sanitizeString(actionName);
      const sanitizedResult = result ? this.sanitizeString(result) : result;
      const sanitizedError = error ? this.sanitizeString(error) : error;

      const message: ActionLogMessage = {
        type: LogMessageType.ACTION,
        actionName: sanitizedActionName,
        success,
        result: sanitizedResult,
        error: sanitizedError,
        sessionId,
        stepId,
        iteration,
        timestamp: new Date()
      };

      await this.streamer.putStructuredEvent(
        sessionId,
        LogMessageType.ACTION,
        JSON.stringify(message),
        { actionName: sanitizedActionName, success, stepId, iteration }
      );

      if (this.enableLogging) {
        console.log(`[StreamerLogger] Action logged for session ${sessionId}, step ${stepId}: ${sanitizedActionName} ${success ? 'succeeded' : 'failed'}`);
      }
    } catch (error) {
      console.warn(`[StreamerLogger] Failed to log action for session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Log screenshot capture
   */
  async logScreenshot(
    sessionId: string, 
    stepId: number, 
    screenshotId: string, 
    screenshotUrl: string, 
    actionName?: string, 
    iteration?: number
  ): Promise<void> {
    if (!this.enableLogging) return;

    try {
      await this.ensureStreamExists(sessionId);

      // Sanitize actionName if provided
      const sanitizedActionName = actionName ? this.sanitizeString(actionName) : actionName;

      const message: ScreenshotLogMessage = {
        type: LogMessageType.SCREENSHOT,
        screenshotUrl,
        screenshotId,
        actionName: sanitizedActionName,
        sessionId,
        stepId,
        iteration,
        timestamp: new Date()
      };

      await this.streamer.putStructuredEvent(
        sessionId,
        LogMessageType.SCREENSHOT,
        JSON.stringify(message),
        { screenshotId, screenshotUrl, actionName: sanitizedActionName, stepId, iteration }
      );

      if (this.enableLogging) {
        console.log(`[StreamerLogger] Screenshot logged for session ${sessionId}, step ${stepId}: ${screenshotUrl}`);
      }
    } catch (error) {
      console.warn(`[StreamerLogger] Failed to log screenshot for session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Ensure stream exists for the session
   */
  async ensureStreamExists(sessionId: string): Promise<void> {
    try {
      if (!this.streamer.streamExists(sessionId)) {
        await this.streamer.createStream(sessionId);
        if (this.enableLogging) {
          console.log(`[StreamerLogger] Created stream for session ${sessionId}`);
        }
      }
    } catch (error) {
      if (this.enableLogging) {
        console.warn(`[StreamerLogger] Failed to create stream for session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`);
      }
      // Don't throw error - streaming is not critical for execution
    }
  }

  /**
   * Enable or disable logging
   */
  setLoggingEnabled(enabled: boolean): void {
    this.enableLogging = enabled;
  }

  /**
   * Check if logging is enabled
   */
  isLoggingEnabled(): boolean {
    return this.enableLogging;
  }

  /**
   * Sanitize string by removing problematic control characters
   * @param text Text to sanitize
   * @returns Sanitized text safe for event streaming
   */
  private sanitizeString(text: string): string {
    if (!text || typeof text !== 'string') {
      return text;
    }

    // Remove problematic control characters while preserving meaningful whitespace
    // Remove: NULL bytes, most control chars except \n (newline), \t (tab), \r (carriage return)
    let sanitized = text
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars except \t, \n, \r
      .replace(/\0/g, ''); // Explicitly remove null bytes

    // Truncate very long content (especially DOM content) to prevent size issues
    const maxLength = 8192; // 8KB limit for individual field
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength) + '... [truncated]';
    }

    return sanitized;
  }
}
