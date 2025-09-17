/**
 * Event Publisher Tests
 * Tests for event publishing, validation, and filtering functionality
 */

import {
  StreamEventType,
  CommandAction
} from '../../../types/shared-types';

import {
  EventPublisher,
  StreamClient,
  ClientType,
  StreamFilter,
  ErrorContext,
  ScreenshotInfo
} from '../../../src/modules/executor-streamer';

describe('EventPublisher', () => {
  let eventPublisher: EventPublisher;

  beforeEach(() => {
    eventPublisher = new EventPublisher();
  });

  describe('Event Publishing', () => {
    test('should publish reasoning events', async () => {
      const sessionId = 'test-session';
      const thought = 'Analyzing page structure';
      const confidence = 0.85;
      const type = 'analysis';
      const context = { pageUrl: 'https://example.com' };

      // This method doesn't return anything but should not throw
      await expect(
        eventPublisher.publishReasoning(sessionId, thought, confidence, type, context)
      ).resolves.toBeUndefined();
    });

    test('should publish command started events', async () => {
      const sessionId = 'test-session';
      const commandName = 'cmd_click_button';
      const action = CommandAction.CLICK_ELEMENT;
      const parameters = { selector: '#submit-btn' };

      await expect(
        eventPublisher.publishCommandStarted(sessionId, commandName, action, parameters)
      ).resolves.toBeUndefined();
    });

    test('should publish command completed events', async () => {
      const sessionId = 'test-session';
      const commandName = 'cmd_click_button';
      const result = { success: true, element: 'button' };
      const duration = 250;

      await expect(
        eventPublisher.publishCommandCompleted(sessionId, commandName, result, duration)
      ).resolves.toBeUndefined();
    });

    test('should publish command failed events', async () => {
      const sessionId = 'test-session';
      const commandName = 'cmd_click_button';
      const error: ErrorContext = {
        id: 'err_001',
        code: 'ELEMENT_NOT_FOUND',
        message: 'Element not found',
        timestamp: new Date(),
        moduleId: 'executor',
        recoverable: true,
        retryable: true
      };
      const duration = 100;

      await expect(
        eventPublisher.publishCommandFailed(sessionId, commandName, error, duration)
      ).resolves.toBeUndefined();
    });

    test('should publish screenshot events', async () => {
      const sessionId = 'test-session';
      const screenshotInfo: ScreenshotInfo = {
        id: 'screenshot_001',
        sessionId,
        stepIndex: 1,
        actionType: 'CLICK_ELEMENT',
        timestamp: new Date(),
        filePath: '/path/to/screenshot.png',
        dimensions: { width: 1920, height: 1080 },
        fileSize: 123456
      };

      await expect(
        eventPublisher.publishScreenshot(sessionId, screenshotInfo)
      ).resolves.toBeUndefined();
    });

    test('should publish variable update events', async () => {
      const sessionId = 'test-session';
      const name = 'userName';
      const value = 'john_doe';
      const previousValue = 'old_user';

      await expect(
        eventPublisher.publishVariableUpdate(sessionId, name, value, previousValue)
      ).resolves.toBeUndefined();
    });

    test('should publish status events', async () => {
      const sessionId = 'test-session';
      const type = 'workflow';
      const status = 'progress';
      const message = 'Step 3 of 5 completed';

      await expect(
        eventPublisher.publishStatus(sessionId, type, status, message)
      ).resolves.toBeUndefined();
    });

    test('should publish error events', async () => {
      const sessionId = 'test-session';
      const error: ErrorContext = {
        id: 'err_002',
        code: 'NETWORK_ERROR',
        message: 'Connection timeout',
        timestamp: new Date(),
        moduleId: 'executor-streamer',
        recoverable: true,
        retryable: true
      };

      await expect(
        eventPublisher.publishError(sessionId, error)
      ).resolves.toBeUndefined();
    });
  });

  describe('Event Validation', () => {
    test('should validate valid events', () => {
      const validEvent = {
        id: 'evt_123',
        type: StreamEventType.AI_REASONING,
        timestamp: new Date(),
        sessionId: 'test-session',
        data: {
          reasoning: {
            thought: 'Test thought',
            confidence: 0.8,
            reasoningType: 'analysis' as any
          }
        }
      };

      const validation = eventPublisher.validateEvent(validEvent);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should reject invalid events', () => {
      const invalidEvent = {
        id: '', // Invalid: empty ID
        type: 'INVALID_TYPE' as any, // Invalid: not a valid event type
        timestamp: 'not-a-date' as any, // Invalid: not a Date object
        sessionId: '', // Invalid: empty session ID
        data: null as any // Invalid: null data
      };

      const validation = eventPublisher.validateEvent(invalidEvent);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('should validate events with missing optional fields', () => {
      const eventWithOptionalFields = {
        id: 'evt_456',
        type: StreamEventType.COMMAND_STARTED,
        timestamp: new Date(),
        sessionId: 'test-session',
        stepIndex: 2, // Optional field
        data: {
          command: {
            commandId: 'cmd_test',
            action: CommandAction.CLICK_ELEMENT,
            parameters: {},
            status: 'EXECUTING' as any
          }
        },
        metadata: { custom: 'data' } // Optional field
      };

      const validation = eventPublisher.validateEvent(eventWithOptionalFields);
      expect(validation.isValid).toBe(true);
    });

    test('should generate warnings for suspicious events', () => {
      const futureEvent = {
        id: 'evt_future',
        type: StreamEventType.AI_REASONING,
        timestamp: new Date(Date.now() + 120000), // 2 minutes in the future
        sessionId: 'test-session',
        data: {
          reasoning: {
            thought: 'Future thought',
            confidence: 0.9,
            reasoningType: 'analysis' as any
          }
        }
      };

      const validation = eventPublisher.validateEvent(futureEvent);
      expect(validation.isValid).toBe(true);
      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings[0]).toContain('future');
    });
  });

  describe('Event Filtering', () => {
    const createMockClient = (filters?: StreamFilter[]): StreamClient => ({
      id: 'client_test',
      type: ClientType.WEBSOCKET,
      connection: {} as any,
      connectedAt: new Date(),
      lastPing: new Date(),
      filters,
      isActive: true
    });

    const createMockEvent = (type: StreamEventType, sessionId: string = 'test-session') => ({
      id: 'evt_test',
      type,
      timestamp: new Date(),
      sessionId,
      data: {}
    });

    test('should pass events through when no filters are set', () => {
      const client = createMockClient();
      const events = [
        createMockEvent(StreamEventType.AI_REASONING),
        createMockEvent(StreamEventType.COMMAND_STARTED),
        createMockEvent(StreamEventType.SCREENSHOT_CAPTURED)
      ];

      const filtered = eventPublisher.filterEventsForClient(events, client);
      expect(filtered).toHaveLength(3);
    });

    test('should filter events by type', () => {
      const client = createMockClient([{
        eventTypes: [StreamEventType.AI_REASONING, StreamEventType.COMMAND_COMPLETED]
      }]);

      const events = [
        createMockEvent(StreamEventType.AI_REASONING),
        createMockEvent(StreamEventType.COMMAND_STARTED),
        createMockEvent(StreamEventType.COMMAND_COMPLETED),
        createMockEvent(StreamEventType.SCREENSHOT_CAPTURED)
      ];

      const filtered = eventPublisher.filterEventsForClient(events, client);
      expect(filtered).toHaveLength(2);
      expect(filtered[0].type).toBe(StreamEventType.AI_REASONING);
      expect(filtered[1].type).toBe(StreamEventType.COMMAND_COMPLETED);
    });

    test('should filter events by session ID', () => {
      const client = createMockClient([{
        sessionIds: ['session_1', 'session_3']
      }]);

      const events = [
        createMockEvent(StreamEventType.AI_REASONING, 'session_1'),
        createMockEvent(StreamEventType.AI_REASONING, 'session_2'),
        createMockEvent(StreamEventType.AI_REASONING, 'session_3'),
        createMockEvent(StreamEventType.AI_REASONING, 'session_4')
      ];

      const filtered = eventPublisher.filterEventsForClient(events, client);
      expect(filtered).toHaveLength(2);
      expect(filtered[0].sessionId).toBe('session_1');
      expect(filtered[1].sessionId).toBe('session_3');
    });

    test('should filter events by time range', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600000);
      const twoHoursAgo = new Date(now.getTime() - 7200000);

      const client = createMockClient([{
        timeRange: {
          start: oneHourAgo,
          end: now
        }
      }]);

      const events = [
        { ...createMockEvent(StreamEventType.AI_REASONING), timestamp: twoHoursAgo }, // Too old
        { ...createMockEvent(StreamEventType.AI_REASONING), timestamp: oneHourAgo }, // On boundary
        { ...createMockEvent(StreamEventType.AI_REASONING), timestamp: now }, // On boundary
        { ...createMockEvent(StreamEventType.AI_REASONING), timestamp: new Date(now.getTime() + 1000) } // Too new
      ];

      const filtered = eventPublisher.filterEventsForClient(events, client);
      expect(filtered).toHaveLength(2);
    });

    test('should apply custom filters', () => {
      const client = createMockClient([{
        customFilter: (event) => event.id.includes('important')
      }]);

      const events = [
        { ...createMockEvent(StreamEventType.AI_REASONING), id: 'important_event_1' },
        { ...createMockEvent(StreamEventType.AI_REASONING), id: 'normal_event_1' },
        { ...createMockEvent(StreamEventType.AI_REASONING), id: 'important_event_2' },
        { ...createMockEvent(StreamEventType.AI_REASONING), id: 'normal_event_2' }
      ];

      const filtered = eventPublisher.filterEventsForClient(events, client);
      expect(filtered).toHaveLength(2);
      expect(filtered[0].id).toBe('important_event_1');
      expect(filtered[1].id).toBe('important_event_2');
    });

    test('should combine multiple filters with AND logic', () => {
      const client = createMockClient([{
        eventTypes: [StreamEventType.AI_REASONING],
        sessionIds: ['session_1'],
        customFilter: (event) => event.id.includes('special')
      }]);

      const events = [
        { ...createMockEvent(StreamEventType.AI_REASONING, 'session_1'), id: 'special_event_1' }, // Matches all
        { ...createMockEvent(StreamEventType.AI_REASONING, 'session_1'), id: 'normal_event_1' }, // Wrong ID
        { ...createMockEvent(StreamEventType.AI_REASONING, 'session_2'), id: 'special_event_2' }, // Wrong session
        { ...createMockEvent(StreamEventType.COMMAND_STARTED, 'session_1'), id: 'special_event_3' } // Wrong type
      ];

      const filtered = eventPublisher.filterEventsForClient(events, client);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('special_event_1');
    });

    test('should handle multiple filters with OR logic', () => {
      const client = createMockClient([
        { eventTypes: [StreamEventType.AI_REASONING] },
        { eventTypes: [StreamEventType.COMMAND_STARTED] }
      ]);

      const events = [
        createMockEvent(StreamEventType.AI_REASONING),
        createMockEvent(StreamEventType.COMMAND_STARTED),
        createMockEvent(StreamEventType.COMMAND_COMPLETED),
        createMockEvent(StreamEventType.SCREENSHOT_CAPTURED)
      ];

      const filtered = eventPublisher.filterEventsForClient(events, client);
      expect(filtered).toHaveLength(2);
      expect(filtered.some(e => e.type === StreamEventType.AI_REASONING)).toBe(true);
      expect(filtered.some(e => e.type === StreamEventType.COMMAND_STARTED)).toBe(true);
    });

    test('should handle filter errors gracefully', () => {
      const client = createMockClient([{
        customFilter: () => {
          throw new Error('Filter error');
        }
      }]);

      const events = [createMockEvent(StreamEventType.AI_REASONING)];

      // Should not throw, but should filter out the event
      const filtered = eventPublisher.filterEventsForClient(events, client);
      expect(filtered).toHaveLength(0);
    });
  });

  describe('Event Serialization', () => {
    test('should serialize events to JSON', () => {
      const event = {
        id: 'evt_serialize',
        type: StreamEventType.AI_REASONING,
        timestamp: new Date('2024-01-01T10:00:00Z'),
        sessionId: 'test-session',
        stepIndex: 1,
        data: {
          reasoning: {
            thought: 'Test serialization',
            confidence: 0.9,
            reasoningType: 'test' as any
          }
        },
        metadata: { custom: 'data' }
      };

      const serialized = eventPublisher.serializeEvent(event);
      const parsed = JSON.parse(serialized);

      expect(parsed.id).toBe('evt_serialize');
      expect(parsed.type).toBe(StreamEventType.AI_REASONING);
      expect(parsed.timestamp).toBe('2024-01-01T10:00:00.000Z');
      expect(parsed.sessionId).toBe('test-session');
      expect(parsed.stepIndex).toBe(1);
      expect(parsed.data.reasoning.thought).toBe('Test serialization');
      expect(parsed.metadata.custom).toBe('data');
    });

    test('should handle serialization errors', () => {
      const circularEvent = {
        id: 'evt_circular',
        type: StreamEventType.AI_REASONING,
        timestamp: new Date(),
        sessionId: 'test-session',
        data: {}
      };

      // Create circular reference
      (circularEvent.data as any).circular = circularEvent;

      expect(() => {
        eventPublisher.serializeEvent(circularEvent);
      }).toThrow('Failed to serialize event');
    });
  });

  describe('Individual Filter Methods', () => {
    test('should correctly apply event type filters', () => {
      const filter: StreamFilter = {
        eventTypes: [StreamEventType.AI_REASONING, StreamEventType.COMMAND_STARTED]
      };

      const reasoningEvent = createMockEvent(StreamEventType.AI_REASONING);
      const commandEvent = createMockEvent(StreamEventType.COMMAND_STARTED);
      const screenshotEvent = createMockEvent(StreamEventType.SCREENSHOT_CAPTURED);

      expect(eventPublisher.shouldEventPassFilter(reasoningEvent, filter)).toBe(true);
      expect(eventPublisher.shouldEventPassFilter(commandEvent, filter)).toBe(true);
      expect(eventPublisher.shouldEventPassFilter(screenshotEvent, filter)).toBe(false);
    });

    test('should correctly apply session ID filters', () => {
      const filter: StreamFilter = {
        sessionIds: ['session_a', 'session_b']
      };

      const eventA = createMockEvent(StreamEventType.AI_REASONING, 'session_a');
      const eventB = createMockEvent(StreamEventType.AI_REASONING, 'session_b');
      const eventC = createMockEvent(StreamEventType.AI_REASONING, 'session_c');

      expect(eventPublisher.shouldEventPassFilter(eventA, filter)).toBe(true);
      expect(eventPublisher.shouldEventPassFilter(eventB, filter)).toBe(true);
      expect(eventPublisher.shouldEventPassFilter(eventC, filter)).toBe(false);
    });

    test('should correctly apply time range filters', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 3600000);
      const oneHourFromNow = new Date(now.getTime() + 3600000);

      const filter: StreamFilter = {
        timeRange: {
          start: oneHourAgo,
          end: oneHourFromNow
        }
      };

      const oldEvent = { ...createMockEvent(StreamEventType.AI_REASONING), timestamp: new Date(oneHourAgo.getTime() - 1000) };
      const currentEvent = { ...createMockEvent(StreamEventType.AI_REASONING), timestamp: now };
      const futureEvent = { ...createMockEvent(StreamEventType.AI_REASONING), timestamp: new Date(oneHourFromNow.getTime() + 1000) };

      expect(eventPublisher.shouldEventPassFilter(oldEvent, filter)).toBe(false);
      expect(eventPublisher.shouldEventPassFilter(currentEvent, filter)).toBe(true);
      expect(eventPublisher.shouldEventPassFilter(futureEvent, filter)).toBe(false);
    });
  });

  const createMockEvent = (type: StreamEventType, sessionId: string = 'test-session') => ({
    id: 'evt_test',
    type,
    timestamp: new Date(),
    sessionId,
    data: {}
  });
});
