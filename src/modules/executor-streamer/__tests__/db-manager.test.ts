/**
 * Unit tests for DBManager SQLite operations
 */

import { promises as fs } from 'fs';
import { dirname } from 'path';
import { DBManager } from '../db-manager';
import { 
  ExecutorStreamerConfig,
  ExecutorStreamerError,
  EXECUTOR_STREAMER_ERRORS,
  DEFAULT_CONFIG 
} from '../types';

describe('DBManager', () => {
  let dbManager: DBManager;
  let testConfig: ExecutorStreamerConfig;
  let testDbPath: string;

  beforeEach(async () => {
    // Create a unique test database for each test
    testDbPath = `./test-db-${Date.now()}-${Math.random().toString(36).substring(2)}.db`;
    testConfig = {
      ...DEFAULT_CONFIG,
      database: {
        ...DEFAULT_CONFIG.database,
        path: testDbPath
      }
    };
    
    dbManager = new DBManager(testConfig);
  });

  afterEach(async () => {
    // Clean up
    dbManager.destroy();
    
    // Remove test database file
    try {
      await fs.unlink(testDbPath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  });

  describe('Database Initialization', () => {
    test('should initialize database and create tables', () => {
      expect(dbManager).toBeDefined();
      // Database should be created and tables should exist
      expect(dbManager.getStreamCount()).toBe(0);
    });

    test('should handle database directory creation', async () => {
      const nestedPath = `./test-nested/dir/test-${Date.now()}.db`;
      const config = {
        ...testConfig,
        database: { ...testConfig.database, path: nestedPath }
      };
      
      const nestedDbManager = new DBManager(config);
      expect(nestedDbManager).toBeDefined();
      
      nestedDbManager.destroy();
      
      // Clean up nested directories
      try {
        await fs.unlink(nestedPath);
        await fs.rmdir(dirname(nestedPath));
        await fs.rmdir('./test-nested');
      } catch (error) {
        // Ignore cleanup errors
      }
    });
  });

  describe('Stream Management', () => {
    test('should create a new stream', async () => {
      const streamId = 'test-stream-1';
      
      expect(dbManager.streamExists(streamId)).toBe(false);
      await dbManager.createStream(streamId);
      expect(dbManager.streamExists(streamId)).toBe(true);
      
      const metadata = dbManager.getStreamMetadata(streamId);
      expect(metadata.id).toBe(streamId);
      expect(metadata.eventCount).toBe(0);
      expect(metadata.createdAt).toBeInstanceOf(Date);
      expect(metadata.lastAccessedAt).toBeInstanceOf(Date);
    });

    test('should throw error when creating duplicate stream', async () => {
      const streamId = 'test-stream-duplicate';
      
      await dbManager.createStream(streamId);
      
      await expect(dbManager.createStream(streamId))
        .rejects
        .toThrow(ExecutorStreamerError);
    });

    test('should delete a stream and all its events', async () => {
      const streamId = 'test-stream-delete';
      
      await dbManager.createStream(streamId);
      await dbManager.addEvent(streamId, 'test event 1', 'evt_1');
      await dbManager.addEvent(streamId, 'test event 2', 'evt_2');
      
      expect(await dbManager.hasEvents(streamId)).toBe(true);
      
      await dbManager.deleteStream(streamId);
      
      expect(dbManager.streamExists(streamId)).toBe(false);
    });

    test('should get stream IDs', async () => {
      const streamIds = ['stream-1', 'stream-2', 'stream-3'];
      
      for (const streamId of streamIds) {
        await dbManager.createStream(streamId);
      }
      
      const retrievedIds = dbManager.getStreamIds();
      expect(retrievedIds).toEqual(expect.arrayContaining(streamIds));
      expect(retrievedIds.length).toBe(streamIds.length);
    });

    test('should get stream count', async () => {
      expect(dbManager.getStreamCount()).toBe(0);
      
      await dbManager.createStream('stream-1');
      expect(dbManager.getStreamCount()).toBe(1);
      
      await dbManager.createStream('stream-2');
      expect(dbManager.getStreamCount()).toBe(2);
      
      await dbManager.deleteStream('stream-1');
      expect(dbManager.getStreamCount()).toBe(1);
    });
  });

  describe('Event Operations', () => {
    const streamId = 'test-event-stream';

    beforeEach(async () => {
      await dbManager.createStream(streamId);
    });

    test('should add events to stream', async () => {
      const eventData = 'test event data';
      const eventId = 'evt_test_1';
      
      await dbManager.addEvent(streamId, eventData, eventId);
      
      expect(await dbManager.hasEvents(streamId)).toBe(true);
      const events = await dbManager.getEvents(streamId);
      expect(events).toHaveLength(1);
      expect(events[0]).toBe(eventData);
      
      const metadata = dbManager.getStreamMetadata(streamId);
      expect(metadata.eventCount).toBe(1);
    });

    test('should throw error when adding event to non-existent stream', async () => {
      await expect(dbManager.addEvent('non-existent', 'data', 'evt_1'))
        .rejects
        .toThrow(ExecutorStreamerError);
    });

    test('should extract last event', async () => {
      const events = ['event 1', 'event 2', 'event 3'];
      
      for (let i = 0; i < events.length; i++) {
        await dbManager.addEvent(streamId, events[i], `evt_${i}`);
      }
      
      const lastEvent = await dbManager.extractLastEvent(streamId);
      expect(lastEvent).toBe('event 3'); // Most recent event
      
      // Should have one less event now
      const remainingEvents = await dbManager.getEvents(streamId);
      expect(remainingEvents).toHaveLength(2);
      expect(remainingEvents).toEqual(['event 1', 'event 2']);
    });

    test('should return null when extracting from empty stream', async () => {
      const result = await dbManager.extractLastEvent(streamId);
      expect(result).toBeNull();
    });

    test('should extract all events in chronological order', async () => {
      const events = ['first event', 'second event', 'third event'];
      
      for (let i = 0; i < events.length; i++) {
        await dbManager.addEvent(streamId, events[i], `evt_${i}`);
      }
      
      const extractedEvents = await dbManager.extractAllEvents(streamId);
      expect(extractedEvents).toEqual(events);
      
      // Stream should be empty now
      expect(await dbManager.hasEvents(streamId)).toBe(false);
      const metadata = dbManager.getStreamMetadata(streamId);
      expect(metadata.eventCount).toBe(0);
    });

    test('should get events without removing them', async () => {
      const events = ['event A', 'event B', 'event C'];
      
      for (let i = 0; i < events.length; i++) {
        await dbManager.addEvent(streamId, events[i], `evt_${i}`);
      }
      
      const retrievedEvents = await dbManager.getEvents(streamId);
      expect(retrievedEvents).toEqual(events);
      
      // Events should still be there
      expect(await dbManager.hasEvents(streamId)).toBe(true);
      const stillThere = await dbManager.getEvents(streamId);
      expect(stillThere).toEqual(events);
    });

    test('should check if stream has events', async () => {
      expect(await dbManager.hasEvents(streamId)).toBe(false);
      
      await dbManager.addEvent(streamId, 'test event', 'evt_1');
      expect(await dbManager.hasEvents(streamId)).toBe(true);
      
      await dbManager.extractLastEvent(streamId);
      expect(await dbManager.hasEvents(streamId)).toBe(false);
    });

    test('should enforce max events per stream', async () => {
      const config = {
        ...testConfig,
        maxEventsPerStream: 3
      };
      
      dbManager.destroy();
      dbManager = new DBManager(config);
      await dbManager.createStream(streamId);
      
      // Add more events than the limit
      for (let i = 0; i < 5; i++) {
        await dbManager.addEvent(streamId, `event ${i}`, `evt_${i}`);
      }
      
      const events = await dbManager.getEvents(streamId);
      expect(events.length).toBe(3); // Should be limited to maxEventsPerStream
      expect(events).toEqual(['event 2', 'event 3', 'event 4']); // Oldest events removed
    });
  });

  describe('Stream Metadata', () => {
    test('should update last accessed time on operations', async () => {
      const streamId = 'metadata-test-stream';
      await dbManager.createStream(streamId);
      
      const initialMetadata = dbManager.getStreamMetadata(streamId);
      
      // Small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await dbManager.addEvent(streamId, 'test event', 'evt_1');
      const afterAddMetadata = dbManager.getStreamMetadata(streamId);
      
      expect(afterAddMetadata.lastAccessedAt.getTime())
        .toBeGreaterThan(initialMetadata.lastAccessedAt.getTime());
      expect(afterAddMetadata.eventCount).toBe(1);
    });

    test('should throw error when getting metadata for non-existent stream', () => {
      expect(() => dbManager.getStreamMetadata('non-existent'))
        .toThrow(ExecutorStreamerError);
    });
  });

  describe('Cleanup Operations', () => {
    test('should clean up expired streams', async () => {
      // Create config with very short TTL
      const shortTTLConfig = {
        ...testConfig,
        streamTTL: 50 // 50ms
      };
      
      dbManager.destroy();
      dbManager = new DBManager(shortTTLConfig);
      
      const streamId = 'expiring-stream';
      await dbManager.createStream(streamId);
      
      expect(dbManager.streamExists(streamId)).toBe(true);
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 60));
      
      dbManager.cleanupExpiredStreams();
      
      expect(dbManager.streamExists(streamId)).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle operations on non-existent streams', async () => {
      const nonExistentId = 'non-existent-stream';
      
      await expect(dbManager.addEvent(nonExistentId, 'data', 'evt_1'))
        .rejects
        .toThrow(ExecutorStreamerError);
        
      await expect(dbManager.extractLastEvent(nonExistentId))
        .rejects
        .toThrow(ExecutorStreamerError);
        
      await expect(dbManager.extractAllEvents(nonExistentId))
        .rejects
        .toThrow(ExecutorStreamerError);
        
      await expect(dbManager.getEvents(nonExistentId))
        .rejects
        .toThrow(ExecutorStreamerError);
        
      await expect(dbManager.hasEvents(nonExistentId))
        .rejects
        .toThrow(ExecutorStreamerError);
    });
  });

  describe('Transaction Safety', () => {
    test('should handle concurrent operations safely', async () => {
      const streamId = 'concurrent-test-stream';
      await dbManager.createStream(streamId);
      
      // Perform multiple concurrent operations
      const operations = [];
      for (let i = 0; i < 10; i++) {
        operations.push(dbManager.addEvent(streamId, `event ${i}`, `evt_${i}`));
      }
      
      await Promise.all(operations);
      
      const events = await dbManager.getEvents(streamId);
      expect(events.length).toBe(10);
      
      const metadata = dbManager.getStreamMetadata(streamId);
      expect(metadata.eventCount).toBe(10);
    });
  });
});
