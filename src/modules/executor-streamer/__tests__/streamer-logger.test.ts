/**
 * Tests for StreamerLogger
 * Verifies structured logging functionality
 */

import { StreamerLogger } from '../streamer-logger';
import { ExecutorStreamer } from '../index';
import { LogMessageType } from '../types';

describe('StreamerLogger', () => {
  let streamer: ExecutorStreamer;
  let logger: StreamerLogger;
  const testSessionId = 'test-session-123';

  beforeEach(() => {
    // Reset singleton instance for each test
    (ExecutorStreamer as any).resetInstance();
    streamer = ExecutorStreamer.getInstance();
    logger = new StreamerLogger(streamer, true);
  });

  afterEach(() => {
    // Clean up
    (ExecutorStreamer as any).resetInstance();
  });

  describe('logReasoning', () => {
    it('should log reasoning message successfully', async () => {
      await logger.logReasoning(testSessionId, 1, 'Test reasoning', 'high', 1);
      
      // Verify stream was created and event was added
      expect(streamer.streamExists(testSessionId)).toBe(true);
      const events = await streamer.getEvents(testSessionId);
      expect(events.length).toBe(1);
      
      // Parse the event and verify structure
      const eventWrapper = JSON.parse(events[0]);
      const eventData = JSON.parse(eventWrapper.data);
      expect(eventData.type).toBe(LogMessageType.REASONING);
      expect(eventData.text).toBe('Test reasoning');
      expect(eventData.confidence).toBe('high');
      expect(eventData.stepId).toBe(1);
      expect(eventData.iteration).toBe(1);
    });

    it('should handle different confidence levels', async () => {
      await logger.logReasoning(testSessionId, 1, 'Low confidence reasoning', 'low');
      await logger.logReasoning(testSessionId, 2, 'Medium confidence reasoning', 'medium');
      await logger.logReasoning(testSessionId, 3, 'High confidence reasoning', 'high');
      
      const events = await streamer.getEvents(testSessionId);
      expect(events.length).toBe(3);
      
      const event1 = JSON.parse(JSON.parse(events[0]).data);
      const event2 = JSON.parse(JSON.parse(events[1]).data);
      const event3 = JSON.parse(JSON.parse(events[2]).data);
      
      expect(event1.confidence).toBe('low');
      expect(event2.confidence).toBe('medium');
      expect(event3.confidence).toBe('high');
    });
  });

  describe('logAction', () => {
    it('should log successful action', async () => {
      await logger.logAction(testSessionId, 1, 'CLICK_ELEMENT', true, 'Element clicked successfully');
      
      const events = await streamer.getEvents(testSessionId);
      expect(events.length).toBe(1);
      
      const eventWrapper = JSON.parse(events[0]);
      const eventData = JSON.parse(eventWrapper.data);
      expect(eventData.type).toBe(LogMessageType.ACTION);
      expect(eventData.actionName).toBe('CLICK_ELEMENT');
      expect(eventData.success).toBe(true);
      expect(eventData.result).toBe('Element clicked successfully');
      expect(eventData.error).toBeUndefined();
    });

    it('should log failed action with error', async () => {
      await logger.logAction(testSessionId, 1, 'CLICK_ELEMENT', false, undefined, 'Element not found');
      
      const events = await streamer.getEvents(testSessionId);
      expect(events.length).toBe(1);
      
      const eventWrapper = JSON.parse(events[0]);
      const eventData = JSON.parse(eventWrapper.data);
      expect(eventData.type).toBe(LogMessageType.ACTION);
      expect(eventData.actionName).toBe('CLICK_ELEMENT');
      expect(eventData.success).toBe(false);
      expect(eventData.error).toBe('Element not found');
      expect(eventData.result).toBeUndefined();
    });
  });

  describe('logScreenshot', () => {
    it('should log screenshot with action name', async () => {
      const screenshotId = 'screenshot-123';
      const screenshotUrl = '/api/media/screenshot-123';
      
      await logger.logScreenshot(testSessionId, 1, screenshotId, screenshotUrl, 'CLICK_ELEMENT');
      
      const events = await streamer.getEvents(testSessionId);
      expect(events.length).toBe(1);
      
      const eventWrapper = JSON.parse(events[0]);
      const eventData = JSON.parse(eventWrapper.data);
      expect(eventData.type).toBe(LogMessageType.SCREENSHOT);
      expect(eventData.screenshotId).toBe(screenshotId);
      expect(eventData.screenshotUrl).toBe(screenshotUrl);
      expect(eventData.actionName).toBe('CLICK_ELEMENT');
    });

    it('should log screenshot without action name', async () => {
      const screenshotId = 'screenshot-456';
      const screenshotUrl = '/api/media/screenshot-456';
      
      await logger.logScreenshot(testSessionId, 2, screenshotId, screenshotUrl);
      
      const events = await streamer.getEvents(testSessionId);
      expect(events.length).toBe(1);
      
      const eventWrapper = JSON.parse(events[0]);
      const eventData = JSON.parse(eventWrapper.data);
      expect(eventData.type).toBe(LogMessageType.SCREENSHOT);
      expect(eventData.screenshotId).toBe(screenshotId);
      expect(eventData.screenshotUrl).toBe(screenshotUrl);
      expect(eventData.actionName).toBeUndefined();
    });
  });

  describe('logging control', () => {
    it('should respect logging enabled/disabled setting', async () => {
      // Disable logging
      logger.setLoggingEnabled(false);
      expect(logger.isLoggingEnabled()).toBe(false);
      
      await logger.logReasoning(testSessionId, 1, 'Test reasoning', 'high');
      
      // Stream should not be created when logging is disabled
      expect(streamer.streamExists(testSessionId)).toBe(false);
      
      // Re-enable logging
      logger.setLoggingEnabled(true);
      expect(logger.isLoggingEnabled()).toBe(true);
      
      await logger.logReasoning(testSessionId, 1, 'Test reasoning', 'high');
      expect(streamer.streamExists(testSessionId)).toBe(true);
    });
  });

  describe('data sanitization', () => {
    it('should sanitize control characters from action results and errors', async () => {
      // Test data with problematic control characters
      const resultWithControlChars = `<html>\x00\x0B\x0C\x1F\x7F<body>Test content\x08with control chars</body></html>`;
      const errorWithControlChars = `Error message\x00with\x1Fnull\x7Fbytes and control chars`;
      
      await logger.logAction(testSessionId, 1, 'GET_DOM', true, resultWithControlChars, undefined, 1);
      await logger.logAction(testSessionId, 2, 'CLICK_ELEMENT', false, undefined, errorWithControlChars, 1);
      
      const events = await streamer.getEvents(testSessionId);
      expect(events.length).toBe(2);
      
      // Parse the events and verify control characters were removed
      const event1 = JSON.parse(JSON.parse(events[0]).data);
      const event2 = JSON.parse(JSON.parse(events[1]).data);
      
      // Should have control characters removed but preserve meaningful content
      expect(event1.result).toBe('<html><body>Test contentwith control chars</body></html>');
      expect(event2.error).toBe('Error messagewithnullbytes and control chars');
      
      // Should not contain any control characters
      expect(event1.result).not.toMatch(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/);
      expect(event2.error).not.toMatch(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/);
    });

    it('should sanitize control characters from reasoning text', async () => {
      const reasoningWithControlChars = `AI reasoning\x00text\x1Fwith\x7Fcontrol characters`;
      
      await logger.logReasoning(testSessionId, 1, reasoningWithControlChars, 'high', 1);
      
      const events = await streamer.getEvents(testSessionId);
      expect(events.length).toBe(1);
      
      const event = JSON.parse(JSON.parse(events[0]).data);
      expect(event.text).toBe('AI reasoningtextwithcontrol characters');
      expect(event.text).not.toMatch(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/);
    });

    it('should preserve meaningful whitespace characters', async () => {
      const textWithWhitespace = `Text with\nnewlines\tand\rtabs`;
      
      await logger.logReasoning(testSessionId, 1, textWithWhitespace, 'medium', 1);
      
      const events = await streamer.getEvents(testSessionId);
      expect(events.length).toBe(1);
      
      const event = JSON.parse(JSON.parse(events[0]).data);
      // Should preserve \n, \t, \r but remove other control chars
      expect(event.text).toBe('Text with\nnewlines\tand\rtabs');
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully and not throw', async () => {
      // Create a mock streamer that throws errors
      const mockStreamer = {
        streamExists: jest.fn().mockReturnValue(false),
        createStream: jest.fn().mockRejectedValue(new Error('Stream creation failed')),
        putStructuredEvent: jest.fn().mockRejectedValue(new Error('Event publishing failed'))
      } as any;
      
      const errorLogger = new StreamerLogger(mockStreamer, true);
      
      // Should not throw even if streamer operations fail
      await expect(errorLogger.logReasoning(testSessionId, 1, 'Test', 'high')).resolves.not.toThrow();
      await expect(errorLogger.logAction(testSessionId, 1, 'TEST', true)).resolves.not.toThrow();
      await expect(errorLogger.logScreenshot(testSessionId, 1, 'test', '/test')).resolves.not.toThrow();
    });
  });
});
