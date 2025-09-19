/**
 * Database Manager for Executor Streamer
 * Handles SQLite operations for event queue persistence
 */

import Database from 'better-sqlite3';
import { promises as fs } from 'fs';
import { dirname } from 'path';
import { 
  ExecutorStreamerConfig,
  ExecutorStreamerError,
  EXECUTOR_STREAMER_ERRORS,
  StreamMetadata 
} from './types';

/**
 * Event queue record interface for database operations
 */
export interface EventQueueRecord {
  id: number;
  stream_id: string;
  event_data: string;
  event_id: string;
  created_at: string;
}

/**
 * Stream metadata record interface for database operations
 */
export interface StreamMetadataRecord {
  stream_id: string;
  created_at: string;
  last_accessed_at: string;
  event_count: number;
}

/**
 * Database Manager class for SQLite event queue operations
 */
export class DBManager {
  private db: Database.Database;
  private config: ExecutorStreamerConfig;

  constructor(config: ExecutorStreamerConfig) {
    this.config = config;
    this.db = this.initializeDatabase();
    this.setupDatabase();
  }

  /**
   * Initialize SQLite database connection
   * @returns Database instance
   */
  private initializeDatabase(): Database.Database {
    try {
      // Ensure directory exists
      const dbDir = dirname(this.config.database.path);
      fs.mkdir(dbDir, { recursive: true }).catch(error => {
        console.warn(`[DBManager] Failed to create database directory: ${error.message}`);
      });

      const db = new Database(this.config.database.path);
      
      // Configure database options
      if (this.config.database.enableWAL) {
        db.pragma('journal_mode = WAL');
      }
      
      db.pragma(`busy_timeout = ${this.config.database.busyTimeout}`);
      db.pragma('foreign_keys = ON');
      
      console.log(`[DBManager] SQLite database initialized at: ${this.config.database.path}`);
      return db;
    } catch (error) {
      throw new ExecutorStreamerError(
        EXECUTOR_STREAMER_ERRORS.INVALID_STREAM_ID,
        `Failed to initialize database: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Setup database schema and tables
   */
  private setupDatabase(): void {
    try {
      // Create event queues table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS event_queues (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          stream_id TEXT NOT NULL,
          event_data TEXT NOT NULL,
          event_id TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create stream metadata table  
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS stream_metadata (
          stream_id TEXT PRIMARY KEY,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          event_count INTEGER DEFAULT 0
        )
      `);

      // Create indexes for better performance
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_event_queues_stream_id 
        ON event_queues(stream_id)
      `);

      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_event_queues_created_at 
        ON event_queues(created_at)
      `);

      console.log('[DBManager] Database schema setup completed');
    } catch (error) {
      throw new ExecutorStreamerError(
        EXECUTOR_STREAMER_ERRORS.INVALID_STREAM_ID,
        `Failed to setup database schema: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Create a new stream in the database
   * @param streamId Unique stream identifier
   */
  async createStream(streamId: string): Promise<void> {
    try {
      const exists = this.streamExists(streamId);
      if (exists) {
        throw new ExecutorStreamerError(
          EXECUTOR_STREAMER_ERRORS.STREAM_ALREADY_EXISTS,
          `Stream ${streamId} already exists`,
          streamId
        );
      }

      const stmt = this.db.prepare(`
        INSERT INTO stream_metadata (stream_id, created_at, last_accessed_at, event_count)
        VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)
      `);
      
      stmt.run(streamId);
      console.log(`[DBManager] Stream created: ${streamId}`);
    } catch (error) {
      if (error instanceof ExecutorStreamerError) {
        throw error;
      }
      throw new ExecutorStreamerError(
        EXECUTOR_STREAMER_ERRORS.INVALID_STREAM_ID,
        `Failed to create stream ${streamId}: ${error instanceof Error ? error.message : String(error)}`,
        streamId
      );
    }
  }

  /**
   * Check if a stream exists
   * @param streamId Stream identifier to check
   * @returns true if stream exists
   */
  streamExists(streamId: string): boolean {
    try {
      const stmt = this.db.prepare('SELECT 1 FROM stream_metadata WHERE stream_id = ?');
      const result = stmt.get(streamId);
      return result !== undefined;
    } catch (error) {
      console.warn(`[DBManager] Error checking stream existence: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Delete a stream and all its events
   * @param streamId Stream identifier to delete
   */
  async deleteStream(streamId: string): Promise<void> {
    try {
      const transaction = this.db.transaction(() => {
        // Delete all events for this stream
        const deleteEvents = this.db.prepare('DELETE FROM event_queues WHERE stream_id = ?');
        deleteEvents.run(streamId);

        // Delete stream metadata
        const deleteMetadata = this.db.prepare('DELETE FROM stream_metadata WHERE stream_id = ?');
        deleteMetadata.run(streamId);
      });

      transaction();
      console.log(`[DBManager] Stream deleted: ${streamId}`);
    } catch (error) {
      throw new ExecutorStreamerError(
        EXECUTOR_STREAMER_ERRORS.INVALID_STREAM_ID,
        `Failed to delete stream ${streamId}: ${error instanceof Error ? error.message : String(error)}`,
        streamId
      );
    }
  }

  /**
   * Add an event to a stream
   * @param streamId Target stream identifier
   * @param eventData Event data to add
   * @param eventId Unique event identifier
   */
  async addEvent(streamId: string, eventData: string, eventId: string): Promise<void> {
    try {
      if (!this.streamExists(streamId)) {
        throw new ExecutorStreamerError(
          EXECUTOR_STREAMER_ERRORS.STREAM_NOT_FOUND,
          `Stream ${streamId} not found`,
          streamId
        );
      }

      const transaction = this.db.transaction(() => {
        // Add event to queue
        const insertEvent = this.db.prepare(`
          INSERT INTO event_queues (stream_id, event_data, event_id, created_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `);
        insertEvent.run(streamId, eventData, eventId);

        // Update stream metadata
        const updateMetadata = this.db.prepare(`
          UPDATE stream_metadata 
          SET event_count = event_count + 1, last_accessed_at = CURRENT_TIMESTAMP
          WHERE stream_id = ?
        `);
        updateMetadata.run(streamId);

        // Check and enforce max events per stream
        this.enforceMaxEventsPerStream(streamId);
      });

      transaction();
    } catch (error) {
      if (error instanceof ExecutorStreamerError) {
        throw error;
      }
      throw new ExecutorStreamerError(
        EXECUTOR_STREAMER_ERRORS.INVALID_STREAM_ID,
        `Failed to add event to stream ${streamId}: ${error instanceof Error ? error.message : String(error)}`,
        streamId
      );
    }
  }

  /**
   * Extract the last (most recent) event from a stream
   * @param streamId Target stream identifier
   * @returns Event data or null if no events
   */
  async extractLastEvent(streamId: string): Promise<string | null> {
    try {
      if (!this.streamExists(streamId)) {
        throw new ExecutorStreamerError(
          EXECUTOR_STREAMER_ERRORS.STREAM_NOT_FOUND,
          `Stream ${streamId} not found`,
          streamId
        );
      }

      let result: string | null = null;

      const transaction = this.db.transaction(() => {
        // Get the most recent event
        const selectEvent = this.db.prepare(`
          SELECT event_data FROM event_queues 
          WHERE stream_id = ? 
          ORDER BY created_at DESC, id DESC 
          LIMIT 1
        `);
        const event = selectEvent.get(streamId) as { event_data: string } | undefined;

        if (event) {
          result = event.event_data;

          // Remove the event
          const deleteEvent = this.db.prepare(`
            DELETE FROM event_queues 
            WHERE id = (
              SELECT id FROM event_queues 
              WHERE stream_id = ? 
              ORDER BY created_at DESC, id DESC 
              LIMIT 1
            )
          `);
          deleteEvent.run(streamId);

          // Update stream metadata
          const updateMetadata = this.db.prepare(`
            UPDATE stream_metadata 
            SET event_count = event_count - 1, last_accessed_at = CURRENT_TIMESTAMP
            WHERE stream_id = ?
          `);
          updateMetadata.run(streamId);
        } else {
          // Update last accessed time even if no events
          const updateAccessed = this.db.prepare(`
            UPDATE stream_metadata 
            SET last_accessed_at = CURRENT_TIMESTAMP
            WHERE stream_id = ?
          `);
          updateAccessed.run(streamId);
        }
      });

      transaction();
      return result;
    } catch (error) {
      if (error instanceof ExecutorStreamerError) {
        throw error;
      }
      throw new ExecutorStreamerError(
        EXECUTOR_STREAMER_ERRORS.INVALID_STREAM_ID,
        `Failed to extract last event from stream ${streamId}: ${error instanceof Error ? error.message : String(error)}`,
        streamId
      );
    }
  }

  /**
   * Extract all events from a stream in chronological order
   * @param streamId Target stream identifier
   * @returns Array of event data in chronological order
   */
  async extractAllEvents(streamId: string): Promise<string[]> {
    try {
      if (!this.streamExists(streamId)) {
        throw new ExecutorStreamerError(
          EXECUTOR_STREAMER_ERRORS.STREAM_NOT_FOUND,
          `Stream ${streamId} not found`,
          streamId
        );
      }

      let result: string[] = [];

      const transaction = this.db.transaction(() => {
        // Get all events in chronological order
        const selectEvents = this.db.prepare(`
          SELECT event_data FROM event_queues 
          WHERE stream_id = ? 
          ORDER BY created_at ASC, id ASC
        `);
        const events = selectEvents.all(streamId) as { event_data: string }[];
        result = events.map(event => event.event_data);

        // Delete all events for this stream
        const deleteEvents = this.db.prepare('DELETE FROM event_queues WHERE stream_id = ?');
        deleteEvents.run(streamId);

        // Reset event count and update last accessed time
        const updateMetadata = this.db.prepare(`
          UPDATE stream_metadata 
          SET event_count = 0, last_accessed_at = CURRENT_TIMESTAMP
          WHERE stream_id = ?
        `);
        updateMetadata.run(streamId);
      });

      transaction();
      return result;
    } catch (error) {
      if (error instanceof ExecutorStreamerError) {
        throw error;
      }
      throw new ExecutorStreamerError(
        EXECUTOR_STREAMER_ERRORS.INVALID_STREAM_ID,
        `Failed to extract all events from stream ${streamId}: ${error instanceof Error ? error.message : String(error)}`,
        streamId
      );
    }
  }

  /**
   * Get all events from a stream without removing them (read-only)
   * @param streamId Target stream identifier
   * @returns Array of event data in chronological order
   */
  async getEvents(streamId: string): Promise<string[]> {
    try {
      if (!this.streamExists(streamId)) {
        throw new ExecutorStreamerError(
          EXECUTOR_STREAMER_ERRORS.STREAM_NOT_FOUND,
          `Stream ${streamId} not found`,
          streamId
        );
      }

      // Update last accessed time
      const updateAccessed = this.db.prepare(`
        UPDATE stream_metadata 
        SET last_accessed_at = CURRENT_TIMESTAMP
        WHERE stream_id = ?
      `);
      updateAccessed.run(streamId);

      // Get all events in chronological order
      const stmt = this.db.prepare(`
        SELECT event_data FROM event_queues 
        WHERE stream_id = ? 
        ORDER BY created_at ASC, id ASC
      `);
      const events = stmt.all(streamId) as { event_data: string }[];
      return events.map(event => event.event_data);
    } catch (error) {
      if (error instanceof ExecutorStreamerError) {
        throw error;
      }
      throw new ExecutorStreamerError(
        EXECUTOR_STREAMER_ERRORS.INVALID_STREAM_ID,
        `Failed to get events from stream ${streamId}: ${error instanceof Error ? error.message : String(error)}`,
        streamId
      );
    }
  }

  /**
   * Check if a stream has any events
   * @param streamId Target stream identifier
   * @returns true if stream has events
   */
  async hasEvents(streamId: string): Promise<boolean> {
    try {
      if (!this.streamExists(streamId)) {
        throw new ExecutorStreamerError(
          EXECUTOR_STREAMER_ERRORS.STREAM_NOT_FOUND,
          `Stream ${streamId} not found`,
          streamId
        );
      }

      // Update last accessed time
      const updateAccessed = this.db.prepare(`
        UPDATE stream_metadata 
        SET last_accessed_at = CURRENT_TIMESTAMP
        WHERE stream_id = ?
      `);
      updateAccessed.run(streamId);

      // Check if any events exist
      const stmt = this.db.prepare('SELECT 1 FROM event_queues WHERE stream_id = ? LIMIT 1');
      const result = stmt.get(streamId);
      return result !== undefined;
    } catch (error) {
      if (error instanceof ExecutorStreamerError) {
        throw error;
      }
      throw new ExecutorStreamerError(
        EXECUTOR_STREAMER_ERRORS.INVALID_STREAM_ID,
        `Failed to check events in stream ${streamId}: ${error instanceof Error ? error.message : String(error)}`,
        streamId
      );
    }
  }

  /**
   * Get stream metadata
   * @param streamId Target stream identifier
   * @returns Stream metadata
   */
  getStreamMetadata(streamId: string): StreamMetadata {
    try {
      if (!this.streamExists(streamId)) {
        throw new ExecutorStreamerError(
          EXECUTOR_STREAMER_ERRORS.STREAM_NOT_FOUND,
          `Stream ${streamId} not found`,
          streamId
        );
      }

      const stmt = this.db.prepare(`
        SELECT stream_id, created_at, last_accessed_at, event_count 
        FROM stream_metadata 
        WHERE stream_id = ?
      `);
      const record = stmt.get(streamId) as StreamMetadataRecord | undefined;

      if (!record) {
        throw new ExecutorStreamerError(
          EXECUTOR_STREAMER_ERRORS.STREAM_NOT_FOUND,
          `Stream metadata not found for ${streamId}`,
          streamId
        );
      }

      return {
        id: record.stream_id,
        createdAt: new Date(record.created_at),
        lastAccessedAt: new Date(record.last_accessed_at),
        eventCount: record.event_count
      };
    } catch (error) {
      if (error instanceof ExecutorStreamerError) {
        throw error;
      }
      throw new ExecutorStreamerError(
        EXECUTOR_STREAMER_ERRORS.INVALID_STREAM_ID,
        `Failed to get metadata for stream ${streamId}: ${error instanceof Error ? error.message : String(error)}`,
        streamId
      );
    }
  }

  /**
   * Get all active stream IDs
   * @returns Array of stream IDs
   */
  getStreamIds(): string[] {
    try {
      const stmt = this.db.prepare('SELECT stream_id FROM stream_metadata ORDER BY created_at');
      const records = stmt.all() as { stream_id: string }[];
      return records.map(record => record.stream_id);
    } catch (error) {
      console.warn(`[DBManager] Error getting stream IDs: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Get the total number of active streams
   * @returns Number of streams
   */
  getStreamCount(): number {
    try {
      const stmt = this.db.prepare('SELECT COUNT(*) as count FROM stream_metadata');
      const result = stmt.get() as { count: number } | undefined;
      return result?.count || 0;
    } catch (error) {
      console.warn(`[DBManager] Error getting stream count: ${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }
  }

  /**
   * Clean up expired streams based on TTL configuration
   */
  cleanupExpiredStreams(): void {
    try {
      const ttlMs = this.config.streamTTL;
      const cutoffTime = new Date(Date.now() - ttlMs).toISOString();

      const transaction = this.db.transaction(() => {
        // Get expired stream IDs
        const getExpired = this.db.prepare(`
          SELECT stream_id FROM stream_metadata 
          WHERE last_accessed_at < ?
        `);
        const expiredStreams = getExpired.all(cutoffTime) as { stream_id: string }[];

        // Delete events for expired streams
        const deleteEvents = this.db.prepare('DELETE FROM event_queues WHERE stream_id = ?');
        const deleteMetadata = this.db.prepare('DELETE FROM stream_metadata WHERE stream_id = ?');

        for (const stream of expiredStreams) {
          deleteEvents.run(stream.stream_id);
          deleteMetadata.run(stream.stream_id);
        }

        if (expiredStreams.length > 0) {
          console.log(`[DBManager] Cleaned up ${expiredStreams.length} expired streams`);
        }
      });

      transaction();
    } catch (error) {
      console.warn(`[DBManager] Error cleaning up expired streams: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Enforce maximum events per stream by removing oldest events
   * @param streamId Target stream identifier
   */
  private enforceMaxEventsPerStream(streamId: string): void {
    try {
      const maxEvents = this.config.maxEventsPerStream;
      
      // Count current events
      const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM event_queues WHERE stream_id = ?');
      const countResult = countStmt.get(streamId) as { count: number } | undefined;
      const currentCount = countResult?.count || 0;

      if (currentCount > maxEvents) {
        const toDelete = currentCount - maxEvents;
        
        // Delete oldest events (FIFO)
        const deleteStmt = this.db.prepare(`
          DELETE FROM event_queues 
          WHERE id IN (
            SELECT id FROM event_queues 
            WHERE stream_id = ? 
            ORDER BY created_at ASC, id ASC 
            LIMIT ?
          )
        `);
        deleteStmt.run(streamId, toDelete);

        // Update event count in metadata
        const updateCount = this.db.prepare(`
          UPDATE stream_metadata 
          SET event_count = ? 
          WHERE stream_id = ?
        `);
        updateCount.run(maxEvents, streamId);
      }
    } catch (error) {
      console.warn(`[DBManager] Error enforcing max events for stream ${streamId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Close database connection and cleanup resources
   */
  destroy(): void {
    try {
      if (this.db) {
        this.db.close();
        console.log('[DBManager] Database connection closed');
      }
    } catch (error) {
      console.warn(`[DBManager] Error closing database: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
