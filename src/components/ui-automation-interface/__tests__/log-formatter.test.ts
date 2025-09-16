/**
 * Unit Tests for Log Formatter
 * Tests the log entry formatting functions
 */

import { StreamEventType } from '../../../../types/shared-types';
import { formatLogEntry, getLevelColor, getLevelBgColor } from '../log-formatter';

describe('log-formatter', () => {
  describe('formatLogEntry', () => {
    test('formats AI_REASONING event', () => {
      const event = {
        id: 'test-1',
        type: StreamEventType.AI_REASONING,
        timestamp: new Date('2024-01-01T10:00:00Z'),
        sessionId: 'session-1',
        data: {
          reasoning: {
            thought: 'Analyzing the page structure'
          }
        }
      };

      const result = formatLogEntry(event);
      
      expect(result.type).toBe(StreamEventType.AI_REASONING);
      expect(result.message).toBe('🧠 AI: Analyzing the page structure');
      expect(result.level).toBe('info');
      expect(typeof result.timestamp).toBe('string');
      expect(result.timestamp).toMatch(/\d{1,2}:\d{2}:\d{2}/); // Matches time format
    });

    test('formats COMMAND_STARTED event', () => {
      const event = {
        id: 'test-2',
        type: StreamEventType.COMMAND_STARTED,
        timestamp: new Date('2024-01-01T10:00:00Z'),
        sessionId: 'session-1',
        data: {
          command: {
            action: 'CLICK_ELEMENT'
          }
        }
      };

      const result = formatLogEntry(event);
      
      expect(result.message).toBe('⚡ Starting: CLICK_ELEMENT');
      expect(result.level).toBe('info');
    });

    test('formats COMMAND_COMPLETED event', () => {
      const event = {
        id: 'test-3',
        type: StreamEventType.COMMAND_COMPLETED,
        timestamp: new Date('2024-01-01T10:00:00Z'),
        sessionId: 'session-1',
        data: {
          command: {
            action: 'OPEN_PAGE'
          }
        }
      };

      const result = formatLogEntry(event);
      
      expect(result.message).toBe('✅ Completed: OPEN_PAGE');
      expect(result.level).toBe('success');
    });

    test('formats COMMAND_FAILED event', () => {
      const event = {
        id: 'test-4',
        type: StreamEventType.COMMAND_FAILED,
        timestamp: new Date('2024-01-01T10:00:00Z'),
        sessionId: 'session-1',
        data: {
          command: {
            action: 'CLICK_ELEMENT'
          },
          error: {
            message: 'Element not found'
          }
        }
      };

      const result = formatLogEntry(event);
      
      expect(result.message).toBe('❌ Failed: CLICK_ELEMENT - Element not found');
      expect(result.level).toBe('error');
    });

    test('formats STEP_STARTED event with step index', () => {
      const event = {
        id: 'test-5',
        type: StreamEventType.STEP_STARTED,
        timestamp: new Date('2024-01-01T10:00:00Z'),
        sessionId: 'session-1',
        stepIndex: 0,
        data: {}
      };

      const result = formatLogEntry(event);
      
      expect(result.message).toBe('🚀 Step 1: Started');
      expect(result.level).toBe('info');
    });

    test('formats unknown event type', () => {
      const event = {
        id: 'test-6',
        type: 'UNKNOWN_EVENT' as StreamEventType,
        timestamp: new Date('2024-01-01T10:00:00Z'),
        sessionId: 'session-1',
        data: {
          message: 'Unknown event occurred'
        }
      };

      const result = formatLogEntry(event);
      
      expect(result.message).toContain('ℹ️ UNKNOWN_EVENT');
      expect(result.level).toBe('info');
    });
  });

  describe('getLevelColor', () => {
    test('returns correct colors for each level', () => {
      expect(getLevelColor('success')).toBe('text-green-400');
      expect(getLevelColor('error')).toBe('text-red-400');
      expect(getLevelColor('warning')).toBe('text-yellow-400');
      expect(getLevelColor('info')).toBe('text-gray-300');
    });
  });

  describe('getLevelBgColor', () => {
    test('returns correct background colors for each level', () => {
      expect(getLevelBgColor('success')).toBe('bg-green-900/20 border-green-500/20');
      expect(getLevelBgColor('error')).toBe('bg-red-900/20 border-red-500/20');
      expect(getLevelBgColor('warning')).toBe('bg-yellow-900/20 border-yellow-500/20');
      expect(getLevelBgColor('info')).toBe('bg-white/5 border-white/10');
    });
  });
});
