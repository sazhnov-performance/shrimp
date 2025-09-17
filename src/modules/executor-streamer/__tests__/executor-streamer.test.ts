/**
 * Unit tests for Executor Streamer module
 * Tests all core functionality including singleton pattern, stream management, and event operations
 */

import {
  ExecutorStreamer,
  IExecutorStreamer,
  ExecutorStreamerError,
  EXECUTOR_STREAMER_ERRORS,
  DEFAULT_CONFIG
} from '../index';

describe('ExecutorStreamer', () => {
  let streamer: IExecutorStreamer;

  beforeEach(() => {
    // Reset singleton instance before each test
    (ExecutorStreamer as any).resetInstance();
    streamer = ExecutorStreamer.getInstance();
  });

  afterEach(() => {
    // Clean up after each test
    (ExecutorStreamer as any).resetInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = ExecutorStreamer.getInstance();
      const instance2 = ExecutorStreamer.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should use default config when no config provided', () => {
      const instance = ExecutorStreamer.getInstance();
      const config = (instance as any).getConfig();
      
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it('should use provided config on first instantiation', () => {
      (ExecutorStreamer as any).resetInstance();
      const customConfig = {
        ...DEFAULT_CONFIG,
        maxStreams: 50,
        maxEventsPerStream: 500
      };
      
      const instance = ExecutorStreamer.getInstance(customConfig);
      const config = (instance as any).getConfig();
      
      expect(config.maxStreams).toBe(50);
      expect(config.maxEventsPerStream).toBe(500);
    });
  });

  describe('Stream Management', () => {
    it('should create a new stream successfully', async () => {
      await expect(streamer.createStream('test-stream')).resolves.not.toThrow();
      expect(streamer.streamExists('test-stream')).toBe(true);
    });

    it('should throw error when creating stream with existing ID', async () => {
      await streamer.createStream('test-stream');
      
      await expect(streamer.createStream('test-stream'))
        .rejects.toThrow(ExecutorStreamerError);
    });

    it('should throw error when creating stream with invalid ID', async () => {
      await expect(streamer.createStream(''))
        .rejects.toThrow(ExecutorStreamerError);
    });

    it('should list active streams', async () => {
      await streamer.createStream('stream1');
      await streamer.createStream('stream2');
      
      const streams = streamer.getActiveStreams();
      expect(streams).toContain('stream1');
      expect(streams).toContain('stream2');
      expect(streams.length).toBe(2);
    });

    it('should get correct stream count', async () => {
      expect(streamer.getStreamCount()).toBe(0);
      
      await streamer.createStream('stream1');
      expect(streamer.getStreamCount()).toBe(1);
      
      await streamer.createStream('stream2');
      expect(streamer.getStreamCount()).toBe(2);
    });

    it('should delete streams successfully', async () => {
      await streamer.createStream('test-stream');
      expect(streamer.streamExists('test-stream')).toBe(true);
      
      await streamer.deleteStream('test-stream');
      expect(streamer.streamExists('test-stream')).toBe(false);
    });
  });

  describe('Event Operations', () => {
    beforeEach(async () => {
      await streamer.createStream('test-stream');
    });

    it('should put and get events successfully', async () => {
      await streamer.putEvent('test-stream', 'test event');
      
      const events = await streamer.getEvents('test-stream');
      expect(events.length).toBe(1);
      
      // Parse the formatted event
      const parsedEvent = JSON.parse(events[0]);
      expect(parsedEvent.data).toBe('test event');
      expect(parsedEvent.timestamp).toBeDefined();
      expect(parsedEvent.id).toBeDefined();
    });

    it('should check if stream has events', async () => {
      expect(await streamer.hasEvents('test-stream')).toBe(false);
      
      await streamer.putEvent('test-stream', 'test event');
      expect(await streamer.hasEvents('test-stream')).toBe(true);
    });

    it('should extract last event', async () => {
      await streamer.putEvent('test-stream', 'event1');
      await streamer.putEvent('test-stream', 'event2');
      
      const lastEvent = await streamer.extractLastEvent('test-stream');
      expect(lastEvent).not.toBeNull();
      
      // Parse the formatted event
      const parsedEvent = JSON.parse(lastEvent!);
      expect(parsedEvent.data).toBe('event2');
      
      // Should have one event remaining
      expect(await streamer.hasEvents('test-stream')).toBe(true);
      const remainingEvents = await streamer.getEvents('test-stream');
      expect(remainingEvents.length).toBe(1);
    });

    it('should extract all events', async () => {
      await streamer.putEvent('test-stream', 'event1');
      await streamer.putEvent('test-stream', 'event2');
      await streamer.putEvent('test-stream', 'event3');
      
      const allEvents = await streamer.extractAllEvents('test-stream');
      expect(allEvents.length).toBe(3);
      
      // Should be in chronological order
      const parsedEvents = allEvents.map(event => JSON.parse(event));
      expect(parsedEvents[0].data).toBe('event1');
      expect(parsedEvents[1].data).toBe('event2');
      expect(parsedEvents[2].data).toBe('event3');
      
      // Stream should be empty now
      expect(await streamer.hasEvents('test-stream')).toBe(false);
    });

    it('should return null when extracting from empty stream', async () => {
      const lastEvent = await streamer.extractLastEvent('test-stream');
      expect(lastEvent).toBeNull();
    });

    it('should return empty array when extracting all from empty stream', async () => {
      const allEvents = await streamer.extractAllEvents('test-stream');
      expect(allEvents).toEqual([]);
    });

    it('should throw error when operating on non-existent stream', async () => {
      await expect(streamer.putEvent('non-existent', 'event'))
        .rejects.toThrow(ExecutorStreamerError);
      
      await expect(streamer.getEvents('non-existent'))
        .rejects.toThrow(ExecutorStreamerError);
      
      await expect(streamer.hasEvents('non-existent'))
        .rejects.toThrow(ExecutorStreamerError);
    });
  });

  describe('Batch Operations', () => {
    beforeEach(async () => {
      await streamer.createStream('test-stream');
    });

    it('should publish batch events successfully', async () => {
      const events = ['event1', 'event2', 'event3'];
      await streamer.putBatchEvents('test-stream', events);
      
      const storedEvents = await streamer.getEvents('test-stream');
      expect(storedEvents.length).toBe(3);
      
      // Verify all events are stored correctly
      const parsedEvents = storedEvents.map(event => JSON.parse(event));
      expect(parsedEvents[0].data).toBe('event1');
      expect(parsedEvents[1].data).toBe('event2');
      expect(parsedEvents[2].data).toBe('event3');
    });

    it('should publish structured events successfully', async () => {
      const metadata = { source: 'test', priority: 'high' };
      await streamer.putStructuredEvent('test-stream', 'user-action', 'button clicked', metadata);
      
      const events = await streamer.getEvents('test-stream');
      expect(events.length).toBe(1);
      
      const parsedEvent = JSON.parse(events[0]);
      expect(parsedEvent.type).toBe('user-action');
      expect(parsedEvent.data).toBe('button clicked');
      expect(parsedEvent.metadata).toEqual(metadata);
      expect(parsedEvent.timestamp).toBeDefined();
      expect(parsedEvent.id).toBeDefined();
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should get stream statistics', async () => {
      await streamer.createStream('test-stream');
      await streamer.putEvent('test-stream', 'test event');
      
      const stats = await streamer.getStreamStats('test-stream');
      expect(stats.eventCount).toBe(1);
      expect(stats.hasEvents).toBe(true);
      expect(stats.createdAt).toBeInstanceOf(Date);
      expect(stats.lastAccessedAt).toBeInstanceOf(Date);
    });

    it('should get system statistics', async () => {
      // Ensure clean state
      expect(streamer.getStreamCount()).toBe(0);
      
      await streamer.createStream('stream1');
      await streamer.createStream('stream2');
      
      const systemStats = streamer.getSystemStats();
      expect(systemStats.totalStreams).toBe(2);
      expect(systemStats.maxStreams).toBe(DEFAULT_CONFIG.maxStreams);
      expect(systemStats.streamUtilization).toBe(2 / DEFAULT_CONFIG.maxStreams);
      expect(systemStats.config).toEqual(DEFAULT_CONFIG);
    });
  });

  describe('Error Handling', () => {
    it('should throw ExecutorStreamerError with correct error codes', async () => {
      // Test stream not found error
      try {
        await streamer.putEvent('non-existent', 'event');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ExecutorStreamerError);
        expect((error as ExecutorStreamerError).code).toBe(EXECUTOR_STREAMER_ERRORS.STREAM_NOT_FOUND);
        expect((error as ExecutorStreamerError).streamId).toBe('non-existent');
      }

      // Test stream already exists error
      await streamer.createStream('test-stream');
      try {
        await streamer.createStream('test-stream');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ExecutorStreamerError);
        expect((error as ExecutorStreamerError).code).toBe(EXECUTOR_STREAMER_ERRORS.STREAM_ALREADY_EXISTS);
        expect((error as ExecutorStreamerError).streamId).toBe('test-stream');
      }
    });

    it('should validate event data properly', async () => {
      await streamer.createStream('test-stream');
      
      // Test empty string (should be rejected by validation)
      await expect(streamer.putEvent('test-stream', ''))
        .rejects.toThrow(ExecutorStreamerError);
    });
  });

  describe('Configuration Limits', () => {
    beforeEach(() => {
      (ExecutorStreamer as any).resetInstance();
    });

    it('should respect maxEventsPerStream limit', async () => {
      const customConfig = {
        ...DEFAULT_CONFIG,
        maxEventsPerStream: 2
      };
      
      const customStreamer = ExecutorStreamer.getInstance(customConfig);
      await customStreamer.createStream('test-stream');
      
      // Add events up to the limit
      await customStreamer.putEvent('test-stream', 'event1');
      await customStreamer.putEvent('test-stream', 'event2');
      
      // Add one more event (should remove the oldest)
      await customStreamer.putEvent('test-stream', 'event3');
      
      const events = await customStreamer.getEvents('test-stream');
      expect(events.length).toBe(2);
      
      // Should contain the latest events (event2 and event3)
      const parsedEvents = events.map(event => JSON.parse(event));
      expect(parsedEvents[0].data).toBe('event2');
      expect(parsedEvents[1].data).toBe('event3');
    });

    it('should respect maxStreams limit', async () => {
      const customConfig = {
        ...DEFAULT_CONFIG,
        maxStreams: 2
      };
      
      const customStreamer = ExecutorStreamer.getInstance(customConfig);
      
      await customStreamer.createStream('stream1');
      await customStreamer.createStream('stream2');
      
      // Third stream should fail
      await expect(customStreamer.createStream('stream3'))
        .rejects.toThrow(ExecutorStreamerError);
    });
  });

  describe('FIFO Queue Behavior', () => {
    beforeEach(async () => {
      await streamer.createStream('test-stream');
    });

    it('should maintain FIFO order for putEvent and getEvents', async () => {
      await streamer.putEvent('test-stream', 'first');
      await streamer.putEvent('test-stream', 'second');
      await streamer.putEvent('test-stream', 'third');
      
      const events = await streamer.getEvents('test-stream');
      const parsedEvents = events.map(event => JSON.parse(event));
      
      expect(parsedEvents[0].data).toBe('first');
      expect(parsedEvents[1].data).toBe('second');
      expect(parsedEvents[2].data).toBe('third');
    });

    it('should extract last event (LIFO for extraction)', async () => {
      await streamer.putEvent('test-stream', 'first');
      await streamer.putEvent('test-stream', 'second');
      await streamer.putEvent('test-stream', 'third');
      
      // extractLastEvent should return the most recent (last added)
      const lastEvent = await streamer.extractLastEvent('test-stream');
      const parsedEvent = JSON.parse(lastEvent!);
      expect(parsedEvent.data).toBe('third');
      
      // Remaining events should still be in FIFO order
      const remainingEvents = await streamer.getEvents('test-stream');
      const parsedRemaining = remainingEvents.map(event => JSON.parse(event));
      expect(parsedRemaining[0].data).toBe('first');
      expect(parsedRemaining[1].data).toBe('second');
    });
  });
});
