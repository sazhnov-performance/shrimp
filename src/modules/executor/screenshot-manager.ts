/**
 * Screenshot Manager
 * Implements screenshot capture, storage, and cleanup functionality
 */

import { Page } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CommandAction } from './types';
import { 
  IScreenshotManager, 
  ScreenshotInfo, 
  ScreenshotConfig, 
  CleanupResult 
} from './types';
import { ExecutorErrorHandler } from './error-handler';
import { IExecutorLogger } from './types';
import { IMediaManager } from '../media-manager/types';

export class ScreenshotManager implements IScreenshotManager {
  private config: ScreenshotConfig;
  private errorHandler: ExecutorErrorHandler;
  private logger: IExecutorLogger;
  private screenshots: Map<string, ScreenshotInfo> = new Map();
  private mediaManager: IMediaManager;

  constructor(
    config: ScreenshotConfig, 
    errorHandler: ExecutorErrorHandler, 
    logger: IExecutorLogger
  ) {
    this.config = config;
    this.errorHandler = errorHandler;
    this.logger = logger;
    // Lazy load MediaManager to avoid Node.js API imports at build time
    this.mediaManager = this.getMediaManager();
  }

  /**
   * Lazy load MediaManager to avoid Node.js APIs during compilation
   */
  private getMediaManager(): IMediaManager {
    if (!this.mediaManager) {
      // Use dynamic import to avoid loading Node.js APIs at build time
      const { MediaManager } = require('../media-manager/media-manager');
      this.mediaManager = MediaManager.getInstance();
    }
    return this.mediaManager;
  }

  /**
   * Captures a screenshot and returns its unique ID
   */
  async captureScreenshot(
    sessionId: string, 
    actionType: CommandAction, 
    page?: Page,
    metadata?: Record<string, any>
  ): Promise<string> {
    if (!this.config.enabled) {
      return '';
    }

    // Check if screenshots are enabled for this specific action
    if (!this.config.actionConfig[actionType]) {
      this.logger.debug(
        `Screenshot disabled for action type: ${actionType}`,
        sessionId,
        { actionType, configuredValue: this.config.actionConfig[actionType] }
      );
      return '';
    }

    if (!page) {
      throw this.errorHandler.createScreenshotError(
        sessionId, 
        'No page instance provided for screenshot capture'
      );
    }

    const screenshotId = this.generateScreenshotId(sessionId, actionType);
    const fileName = this.generateFileName(sessionId, actionType, screenshotId);
    const filePath = path.join(this.config.directory, fileName);

    try {
      // Ensure directory exists
      await this.ensureDirectoryExists();

      // Capture screenshot
      const screenshotBuffer = await page.screenshot({
        path: filePath,
        type: this.config.format,
        quality: this.config.format === 'jpeg' ? this.config.quality : undefined,
        fullPage: this.config.fullPage
      });

      // Get file stats
      const stats = await fs.stat(filePath);
      const dimensions = await this.getImageDimensions(screenshotBuffer);

      // Create screenshot info
      const screenshotInfo: ScreenshotInfo = {
        id: screenshotId,
        sessionId,
        fileName,
        filePath,
        actionType,
        timestamp: new Date(),
        fileSize: stats.size,
        format: this.config.format,
        dimensions,
        metadata
      };

      // Store in memory
      this.screenshots.set(screenshotId, screenshotInfo);

      // Store screenshot in media manager and get UUID
      let mediaManagerUuid = '';
      try {
        mediaManagerUuid = await this.getMediaManager().storeImage(filePath);
        
        // Update screenshot info with media manager UUID
        screenshotInfo.mediaManagerUuid = mediaManagerUuid;
        
        this.logger.logScreenshotCapture(
          sessionId, 
          screenshotId, 
          actionType, 
          true,
          { fileName, fileSize: stats.size, dimensions, mediaManagerUuid }
        );
        
        // Return media manager UUID instead of internal screenshot ID
        return mediaManagerUuid;
        
      } catch (mediaError) {
        // Log warning but continue - media manager integration is not critical
        this.logger.warn(
          `Failed to store screenshot in media manager: ${mediaError instanceof Error ? mediaError.message : String(mediaError)}`,
          sessionId,
          { screenshotId, fileName }
        );
        
        this.logger.logScreenshotCapture(
          sessionId, 
          screenshotId, 
          actionType, 
          true,
          { fileName, fileSize: stats.size, dimensions, mediaManagerError: mediaError instanceof Error ? mediaError.message : String(mediaError) }
        );
        
        // Return original screenshot ID as fallback
        return screenshotId;
      }

    } catch (error) {
      this.logger.logScreenshotCapture(
        sessionId, 
        screenshotId, 
        actionType, 
        false,
        { fileName, error: error instanceof Error ? error.message : String(error) }
      );
      
      throw this.errorHandler.createScreenshotError(
        sessionId,
        `Failed to capture screenshot: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Gets screenshot information by ID
   */
  async getScreenshot(screenshotId: string): Promise<ScreenshotInfo | null> {
    return this.screenshots.get(screenshotId) || null;
  }

  /**
   * Gets the file path for a screenshot
   */
  async getScreenshotPath(screenshotId: string): Promise<string | null> {
    const screenshot = this.screenshots.get(screenshotId);
    if (!screenshot) return null;

    // Verify file exists
    try {
      await fs.access(screenshot.filePath);
      return screenshot.filePath;
    } catch {
      // File doesn't exist, remove from memory
      this.screenshots.delete(screenshotId);
      return null;
    }
  }

  /**
   * Lists all screenshots for a session
   */
  async listScreenshots(sessionId: string): Promise<ScreenshotInfo[]> {
    const sessionScreenshots: ScreenshotInfo[] = [];
    
    for (const screenshot of Array.from(this.screenshots.values())) {
      if (screenshot.sessionId === sessionId) {
        // Verify file still exists
        try {
          await fs.access(screenshot.filePath);
          sessionScreenshots.push(screenshot);
        } catch {
          // File doesn't exist, remove from memory
          this.screenshots.delete(screenshot.id);
        }
      }
    }

    return sessionScreenshots.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Deletes a specific screenshot
   */
  async deleteScreenshot(screenshotId: string): Promise<void> {
    const screenshot = this.screenshots.get(screenshotId);
    if (!screenshot) return;

    try {
      await fs.unlink(screenshot.filePath);
      this.screenshots.delete(screenshotId);
      
      this.logger.debug(
        `Screenshot deleted: ${screenshotId}`, 
        screenshot.sessionId,
        { filePath: screenshot.filePath }
      );
    } catch (error) {
      // File might not exist, just remove from memory
      this.screenshots.delete(screenshotId);
    }
  }

  /**
   * Cleans up screenshots based on configuration
   */
  async cleanupScreenshots(sessionId?: string): Promise<CleanupResult> {
    const startTime = Date.now();
    let deletedCount = 0;
    let freedSpace = 0;
    const errors: string[] = [];

    if (!this.config.cleanup.enabled) {
      return { deletedCount: 0, freedSpace: 0, errors: [], duration: 0 };
    }

    try {
      const screenshots = sessionId 
        ? await this.listScreenshots(sessionId)
        : Array.from(this.screenshots.values());

      // Filter screenshots to cleanup
      const now = Date.now();
      const maxAge = this.config.cleanup.maxAge;
      const maxCount = this.config.cleanup.maxCount;

      // Sort by age (oldest first)
      const sortedScreenshots = screenshots.sort((a, b) => 
        a.timestamp.getTime() - b.timestamp.getTime()
      );

      const toDelete: ScreenshotInfo[] = [];

      // Add old screenshots
      sortedScreenshots.forEach(screenshot => {
        const age = now - screenshot.timestamp.getTime();
        if (age > maxAge) {
          toDelete.push(screenshot);
        }
      });

      // Add excess screenshots (beyond maxCount per session)
      if (sessionId) {
        const excess = sortedScreenshots.length - maxCount;
        if (excess > 0) {
          toDelete.push(...sortedScreenshots.slice(0, excess));
        }
      } else {
        // Group by session and check per-session limits
        const bySession = new Map<string, ScreenshotInfo[]>();
        sortedScreenshots.forEach(screenshot => {
          if (!bySession.has(screenshot.sessionId)) {
            bySession.set(screenshot.sessionId, []);
          }
          bySession.get(screenshot.sessionId)!.push(screenshot);
        });

        bySession.forEach((sessionScreenshots, sid) => {
          if (sessionScreenshots.length > maxCount) {
            const excess = sessionScreenshots.length - maxCount;
            toDelete.push(...sessionScreenshots.slice(0, excess));
          }
        });
      }

      // Remove duplicates
      const uniqueToDelete = Array.from(
        new Map(toDelete.map(s => [s.id, s])).values()
      );

      // Delete screenshots
      for (const screenshot of uniqueToDelete) {
        try {
          freedSpace += screenshot.fileSize;
          await this.deleteScreenshot(screenshot.id);
          deletedCount++;
        } catch (error) {
          errors.push(
            `Failed to delete ${screenshot.id}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      this.logger.info(
        `Screenshot cleanup completed: ${deletedCount} deleted, ${freedSpace} bytes freed`,
        sessionId,
        { deletedCount, freedSpace, errors: errors.length }
      );

    } catch (error) {
      errors.push(
        `Cleanup failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return {
      deletedCount,
      freedSpace,
      errors,
      duration: Date.now() - startTime
    };
  }

  /**
   * Validates that the screenshot directory exists and is writable
   */
  async validateScreenshotDirectory(): Promise<boolean> {
    try {
      await this.ensureDirectoryExists();
      
      // Test write permissions
      const testFile = path.join(this.config.directory, '.write-test');
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Updates the screenshot configuration
   */
  updateConfig(config: ScreenshotConfig): void {
    this.config = config;
  }

  /**
   * Gets screenshot statistics
   */
  getStatistics(): {
    totalScreenshots: number;
    totalSessions: number;
    totalFileSize: number;
    averageFileSize: number;
    oldestScreenshot?: Date;
    newestScreenshot?: Date;
  } {
    const screenshots = Array.from(this.screenshots.values());
    const sessions = new Set(screenshots.map(s => s.sessionId));
    
    const totalFileSize = screenshots.reduce((sum, s) => sum + s.fileSize, 0);
    const timestamps = screenshots.map(s => s.timestamp.getTime());
    
    return {
      totalScreenshots: screenshots.length,
      totalSessions: sessions.size,
      totalFileSize,
      averageFileSize: screenshots.length > 0 ? totalFileSize / screenshots.length : 0,
      oldestScreenshot: timestamps.length > 0 ? new Date(Math.min(...timestamps)) : undefined,
      newestScreenshot: timestamps.length > 0 ? new Date(Math.max(...timestamps)) : undefined
    };
  }

  private generateScreenshotId(sessionId: string, actionType: CommandAction): string {
    return `${sessionId}_${Date.now()}_${actionType}_${uuidv4()}`;
  }

  private generateFileName(sessionId: string, actionType: CommandAction, screenshotId: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const uuid = uuidv4().substring(0, 8);
    
    return this.config.nameTemplate
      .replace('{sessionId}', sessionId)
      .replace('{timestamp}', timestamp)
      .replace('{actionType}', actionType)
      .replace('{uuid}', uuid) + 
      '.' + this.config.format;
  }

  private async ensureDirectoryExists(): Promise<void> {
    try {
      await fs.mkdir(this.config.directory, { recursive: true });
    } catch (error) {
      throw this.errorHandler.createStandardError(
        'SCREENSHOT_DIRECTORY_ERROR',
        `Cannot create screenshot directory: ${this.config.directory}`,
        { directory: this.config.directory },
        error instanceof Error ? error : undefined
      );
    }
  }

  private async getImageDimensions(buffer: Buffer): Promise<{ width: number; height: number }> {
    // Simple implementation - could use sharp for more accurate dimensions
    // For now, return default dimensions
    return { width: 1920, height: 1080 };
  }
}

