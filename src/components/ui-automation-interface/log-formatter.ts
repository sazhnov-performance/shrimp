/**
 * Log Entry Formatter
 * Converts StreamEvents into simple UI-friendly log entries
 * Based on design/ui-automation-interface.md
 */

import { StreamEvent, StreamEventType, SimpleLogEntry } from './types';

export function formatLogEntry(event: StreamEvent): SimpleLogEntry {
  // For structured events, we may want to enhance the message
  if (event.structuredData) {
    switch (event.structuredData.type) {
      case 'reasoning':
        // Keep the text as is, but indicate confidence in the display
        return {
          ...event,
          message: `💭 ${event.structuredData.text}`
        };
      case 'action':
        // Enhanced action message with status
        const statusIcon = event.structuredData.success ? '✅' : '❌';
        return {
          ...event,
          message: `${statusIcon} ${event.structuredData.actionName}${event.structuredData.success ? '' : `: ${event.structuredData.error || 'Failed'}`}`
        };
      case 'screenshot':
        // Screenshot message with image icon
        return {
          ...event,
          message: `📸 Screenshot captured${event.structuredData.actionName ? ` for ${event.structuredData.actionName}` : ''}`
        };
    }
  }
  
  // Default formatting for regular events
  return event;
}

export function getLevelColor(level: SimpleLogEntry['level']): string {
  switch (level) {
    case 'success':
      return 'text-green-400';
    case 'error':
      return 'text-red-400';
    case 'warning':
      return 'text-yellow-400';
    case 'info':
    default:
      return 'text-gray-300';
  }
}

export function getLevelBgColor(level: SimpleLogEntry['level']): string {
  switch (level) {
    case 'success':
      return 'bg-green-900/20 border-green-500/20';
    case 'error':
      return 'bg-red-900/20 border-red-500/20';
    case 'warning':
      return 'bg-yellow-900/20 border-yellow-500/20';
    case 'info':
    default:
      return 'bg-white/5 border-white/10';
  }
}
