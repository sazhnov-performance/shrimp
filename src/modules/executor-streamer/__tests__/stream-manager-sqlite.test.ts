/**
 * Unit tests for StreamManager with SQLite backend
 */

import { promises as fs } from 'fs';
import { StreamManager } from '../stream-manager';
import { 
  ExecutorStreamerConfig,
  ExecutorStreamerError,
  EXECUTOR_STREAMER_ERRORS,
  DEFAULT_CONFIG 
} from '../types';

describe('StreamManager with SQLite Backend', () => {
  let streamManager: StreamManager;
  let testConfig: ExecutorStreamerConfig;
  let testDbPath: string;

  beforeEach(async () => {
    // Create a unique test database for each test
    testDbPath = `./test-stream-manager-${Date.now()}-${Math.random().toString(36).substring(2)}.db`;
    testConfig = {
      ...DEFAULT_CONFIG,
      database: {
        ...DEFAULT_CONFIG.database,
        path: testDbPath
      }
    };
    
    streamManager = new StreamManager(testConfig);
  });

  afterEach(async () => {
    // Clean up
    streamManager.destroy();
    
    // Remove test database file
    try {
      await fs.unlink(testDbPath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  });

  describe('Stream Creation and Management', () => {
    test('should create stream successfully', async () => {
      const streamId = 'test-stream-1';
      
      expect(streamManager.streamExists(streamId)).toBe(false);
      await streamManager.createStream(streamId);
      expect(streamManager.streamExists(streamId)).toBe(true);
      
      const ids = streamManager.getStreamIds();
      expect(ids).toContain(streamId);
      expect(streamManager.getStreamCount()).toBe(1);
    });

    test('should throw error for invalid stream ID', async () => {
      await expect(streamManager.createStream(''))
        .rejects
        .toThrow(ExecutorStreamerError);
    });

    test('should throw error for duplicate stream', async () => {
      const streamId = 'duplicate-stream';
      await streamManager.createStream(streamId);
      
      await expect(streamManager.createStream(streamId))
        .rejects
        .toThrow(ExecutorStreamerError);
    });

    test('should enforce maximum streams limit', async () => {
      const limitedConfig = {
        ...testConfig,
        maxStreams: 2
      };
      
      streamManager.destroy();
      streamManager = new StreamManager(limitedConfig);
      
      await streamManager.createStream('stream-1');
      await streamManager.createStream('stream-2');
      
      await expect(streamManager.createStream('stream-3'))
        .rejects
        .toThrow(ExecutorStreamerError);
    });

    test('should delete stream and its events', async () => {
      const streamId = 'deletable-stream';
      
      await streamManager.createStream(streamId);
      const formattedEvent = JSON.stringify({
        timestamp: new Date().toISOString(),
        data: 'test event',
        id: 'test_delete_event'
      });
      await streamManager.addEvent(streamId, formattedEvent);
      
      expect(await streamManager.hasEvents(streamId)).toBe(true);
      
      await streamManager.deleteStream(streamId);
      
      expect(streamManager.streamExists(streamId)).toBe(false);
    });
  });

  describe('Event Operations', () => {
    const streamId = 'event-test-stream';

    beforeEach(async () => {
      await streamManager.createStream(streamId);
    });

    test('should add and retrieve events', async () => {
      const eventData = 'test event data';
      // Format the event as the EventPublisher would
      const formattedEvent = JSON.stringify({
        timestamp: new Date().toISOString(),
        data: eventData,
        id: 'test_event_id'
      });
      
      await streamManager.addEvent(streamId, formattedEvent);
      
      expect(await streamManager.hasEvents(streamId)).toBe(true);
      const events = await streamManager.getEvents(streamId);
      expect(events).toHaveLength(1);
      expect(JSON.parse(events[0]).data).toBe(eventData);
    });

    test('should extract last event', async () => {
      const events = ['first', 'second', 'third'];
      
      for (const event of events) {
        const formattedEvent = JSON.stringify({
          timestamp: new Date().toISOString(),
          data: event,
          id: `test_event_${event}`
        });
        await streamManager.addEvent(streamId, formattedEvent);
      }
      
      const lastEvent = await streamManager.extractLastEvent(streamId);
      expect(lastEvent).toBeDefined();
      const parsedEvent = JSON.parse(lastEvent!);
      expect(parsedEvent.data).toBe('third');
      
      // Should have one less event
      const remainingEvents = await streamManager.getEvents(streamId);
      expect(remainingEvents).toHaveLength(2);
    });

    test('should extract all events in chronological order', async () => {
      const events = ['alpha', 'beta', 'gamma'];
      
      for (const event of events) {
        const formattedEvent = JSON.stringify({
          timestamp: new Date().toISOString(),
          data: event,
          id: `test_event_${event}`
        });
        await streamManager.addEvent(streamId, formattedEvent);
      }
      
      const extractedEvents = await streamManager.extractAllEvents(streamId);
      expect(extractedEvents).toHaveLength(3);
      
      // Verify chronological order
      for (let i = 0; i < events.length; i++) {
        const parsedEvent = JSON.parse(extractedEvents[i]);
        expect(parsedEvent.data).toBe(events[i]);
      }
      
      // Stream should be empty
      expect(await streamManager.hasEvents(streamId)).toBe(false);
    });

    test('should return null when extracting from empty stream', async () => {
      const result = await streamManager.extractLastEvent(streamId);
      expect(result).toBeNull();
    });

    test('should get events without removing them', async () => {
      const formattedEvent = JSON.stringify({
        timestamp: new Date().toISOString(),
        data: 'persistent event',
        id: 'test_persistent_event'
      });
      await streamManager.addEvent(streamId, formattedEvent);
      
      const events1 = await streamManager.getEvents(streamId);
      expect(events1).toHaveLength(1);
      
      const events2 = await streamManager.getEvents(streamId);
      expect(events2).toHaveLength(1);
      expect(events1).toEqual(events2);
    });

    test('should handle empty stream operations', async () => {
      expect(await streamManager.hasEvents(streamId)).toBe(false);
      expect(await streamManager.getEvents(streamId)).toEqual([]);
      expect(await streamManager.extractLastEvent(streamId)).toBeNull();
      expect(await streamManager.extractAllEvents(streamId)).toEqual([]);
    });
  });

  describe('Stream Metadata', () => {
    test('should track stream metadata correctly', async () => {
      const streamId = 'metadata-stream';
      await streamManager.createStream(streamId);
      
      const metadata = streamManager.getStreamMetadata(streamId);
      expect(metadata.id).toBe(streamId);
      expect(metadata.eventCount).toBe(0);
      expect(metadata.createdAt).toBeInstanceOf(Date);
      expect(metadata.lastAccessedAt).toBeInstanceOf(Date);
      
      const formattedEvent = JSON.stringify({
        timestamp: new Date().toISOString(),
        data: 'test event',
        id: 'test_metadata_event'
      });
      await streamManager.addEvent(streamId, formattedEvent);
      
      const updatedMetadata = streamManager.getStreamMetadata(streamId);
      expect(updatedMetadata.eventCount).toBe(1);
      expect(updatedMetadata.lastAccessedAt.getTime())
        .toBeGreaterThanOrEqual(metadata.lastAccessedAt.getTime());
    });
  });

  describe('Error Handling', () => {
    test('should throw errors for non-existent streams', async () => {
      const nonExistentId = 'does-not-exist';
      
      await expect(streamManager.addEvent(nonExistentId, 'data'))
        .rejects
        .toThrow(ExecutorStreamerError);
        
      await expect(streamManager.extractLastEvent(nonExistentId))
        .rejects
        .toThrow(ExecutorStreamerError);
        
      await expect(streamManager.extractAllEvents(nonExistentId))
        .rejects
        .toThrow(ExecutorStreamerError);
        
      await expect(streamManager.getEvents(nonExistentId))
        .rejects
        .toThrow(ExecutorStreamerError);
        
      await expect(streamManager.hasEvents(nonExistentId))
        .rejects
        .toThrow(ExecutorStreamerError);
        
      expect(() => streamManager.getStreamMetadata(nonExistentId))
        .toThrow(ExecutorStreamerError);
    });
  });

  describe('Persistence and Recovery', () => {
    test('should persist data across manager instances', async () => {
      const streamId = 'persistent-stream';
      const eventData = 'persistent event data';
      
      // Create stream and add event with first manager
      await streamManager.createStream(streamId);
      const formattedEvent = JSON.stringify({
        timestamp: new Date().toISOString(),
        data: eventData,
        id: 'test_persistent_event'
      });
      await streamManager.addEvent(streamId, formattedEvent);
      
      // Verify data exists
      expect(await streamManager.hasEvents(streamId)).toBe(true);
      
      // Destroy first manager
      streamManager.destroy();
      
      // Create new manager with same database
      const newStreamManager = new StreamManager(testConfig);
      
      try {
        // Verify data persisted
        expect(newStreamManager.streamExists(streamId)).toBe(true);
        expect(await newStreamManager.hasEvents(streamId)).toBe(true);
        
        const events = await newStreamManager.getEvents(streamId);
        expect(events).toHaveLength(1);
        
        const parsedEvent = JSON.parse(events[0]);
        expect(parsedEvent.data).toBe(eventData);
        
        const metadata = newStreamManager.getStreamMetadata(streamId);
        expect(metadata.eventCount).toBe(1);
        expect(metadata.id).toBe(streamId);
      } finally {
        newStreamManager.destroy();
      }
    });
  });

  describe('Concurrent Operations', () => {
    test('should handle concurrent event additions', async () => {
      const streamId = 'concurrent-stream';
      await streamManager.createStream(streamId);
      
      // Add events concurrently
      const promises = [];
      for (let i = 0; i < 10; i++) {
        const formattedEvent = JSON.stringify({
          timestamp: new Date().toISOString(),
          data: `event-${i}`,
          id: `test_concurrent_${i}`
        });
        promises.push(streamManager.addEvent(streamId, formattedEvent));
      }
      
      await Promise.all(promises);
      
      const events = await streamManager.getEvents(streamId);
      expect(events).toHaveLength(10);
      
      const metadata = streamManager.getStreamMetadata(streamId);
      expect(metadata.eventCount).toBe(10);
    });

    test('should handle mixed concurrent operations', async () => {
      const streamId = 'mixed-concurrent-stream';
      await streamManager.createStream(streamId);
      
      // Add some initial events
      for (let i = 0; i < 5; i++) {
        const formattedEvent = JSON.stringify({
          timestamp: new Date().toISOString(),
          data: `initial-${i}`,
          id: `test_initial_${i}`
        });
        await streamManager.addEvent(streamId, formattedEvent);
      }
      
      // Mix of operations
      const operations = [
        streamManager.addEvent(streamId, JSON.stringify({ timestamp: new Date().toISOString(), data: 'new-event-1', id: 'test_new_1' })),
        streamManager.addEvent(streamId, JSON.stringify({ timestamp: new Date().toISOString(), data: 'new-event-2', id: 'test_new_2' })),
        streamManager.getEvents(streamId),
        streamManager.hasEvents(streamId),
        streamManager.addEvent(streamId, JSON.stringify({ timestamp: new Date().toISOString(), data: 'new-event-3', id: 'test_new_3' }))
      ];
      
      const results = await Promise.all(operations);
      
      // Verify all operations completed
      expect(Array.isArray(results[2])).toBe(true); // getEvents result
      expect(typeof results[3]).toBe('boolean'); // hasEvents result
      
      const finalEvents = await streamManager.getEvents(streamId);
      expect(finalEvents.length).toBeGreaterThanOrEqual(5); // At least initial events
    });
  });

  describe('Event Format Validation', () => {
    test('should format events with timestamps and IDs', async () => {
      const streamId = 'format-test-stream';
      await streamManager.createStream(streamId);
      
      const originalData = 'test event for formatting';
      const formattedEvent = JSON.stringify({
        timestamp: new Date().toISOString(),
        data: originalData,
        id: 'test_format_event'
      });
      await streamManager.addEvent(streamId, formattedEvent);
      
      const events = await streamManager.getEvents(streamId);
      expect(events).toHaveLength(1);
      
      const parsedEvent = JSON.parse(events[0]);
      expect(parsedEvent).toHaveProperty('timestamp');
      expect(parsedEvent).toHaveProperty('data');
      expect(parsedEvent).toHaveProperty('id');
      
      expect(parsedEvent.data).toBe(originalData);
      expect(parsedEvent.id).toBe('test_format_event');
      expect(new Date(parsedEvent.timestamp)).toBeInstanceOf(Date);
    });
  });
});
