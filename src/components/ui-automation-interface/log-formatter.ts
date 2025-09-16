/**
 * Log Entry Formatter
 * Converts StreamEvents into simple UI-friendly log entries
 * Based on design/ui-automation-interface.md
 */

import { StreamEvent, StreamEventType } from '../../../types/shared-types';
import { SimpleLogEntry } from './types';

export function formatLogEntry(event: StreamEvent): SimpleLogEntry {
  const timestamp = new Date(event.timestamp).toLocaleTimeString();
  
  switch (event.type) {
    case StreamEventType.AI_REASONING:
      return {
        timestamp,
        type: event.type,
        message: `🧠 AI: ${event.data.reasoning?.thought || 'Processing...'}`,
        level: 'info'
      };
      
    case StreamEventType.COMMAND_STARTED:
      return {
        timestamp,
        type: event.type,
        message: `⚡ Starting: ${event.data.command?.action || 'Unknown action'}`,
        level: 'info'
      };
      
    case StreamEventType.COMMAND_COMPLETED:
      return {
        timestamp,
        type: event.type,
        message: `✅ Completed: ${event.data.command?.action || 'Unknown action'}`,
        level: 'success'
      };
      
    case StreamEventType.COMMAND_FAILED:
      return {
        timestamp,
        type: event.type,
        message: `❌ Failed: ${event.data.command?.action || 'Unknown action'} - ${event.data.error?.message || 'Unknown error'}`,
        level: 'error'
      };

    case StreamEventType.STEP_STARTED:
      return {
        timestamp,
        type: event.type,
        message: `🚀 Step ${event.stepIndex !== undefined ? event.stepIndex + 1 : '?'}: Started`,
        level: 'info'
      };

    case StreamEventType.STEP_COMPLETED:
      return {
        timestamp,
        type: event.type,
        message: `✅ Step ${event.stepIndex !== undefined ? event.stepIndex + 1 : '?'}: Completed successfully`,
        level: 'success'
      };

    case StreamEventType.STEP_FAILED:
      return {
        timestamp,
        type: event.type,
        message: `❌ Step ${event.stepIndex !== undefined ? event.stepIndex + 1 : '?'}: Failed - ${event.data.error?.message || 'Unknown error'}`,
        level: 'error'
      };

    case StreamEventType.WORKFLOW_STARTED:
      return {
        timestamp,
        type: event.type,
        message: `🎯 Workflow started`,
        level: 'info'
      };

    case StreamEventType.WORKFLOW_COMPLETED:
      return {
        timestamp,
        type: event.type,
        message: `🎉 Workflow completed successfully`,
        level: 'success'
      };

    case StreamEventType.WORKFLOW_FAILED:
      return {
        timestamp,
        type: event.type,
        message: `💥 Workflow failed: ${event.data.error?.message || 'Unknown error'}`,
        level: 'error'
      };

    case StreamEventType.SCREENSHOT_CAPTURED:
      return {
        timestamp,
        type: event.type,
        message: `📸 Screenshot captured`,
        level: 'info'
      };

    case StreamEventType.PAGE_NAVIGATED:
      return {
        timestamp,
        type: event.type,
        message: `🌐 Navigated to: ${event.data.page?.url || 'Unknown URL'}`,
        level: 'info'
      };

    case StreamEventType.VARIABLE_UPDATED:
      return {
        timestamp,
        type: event.type,
        message: `📝 Variable updated: ${event.data.variable?.name || 'Unknown'} = ${event.data.variable?.value || 'Unknown'}`,
        level: 'info'
      };

    case StreamEventType.ERROR_OCCURRED:
      return {
        timestamp,
        type: event.type,
        message: `🚨 Error: ${event.data.error?.message || 'Unknown error'}`,
        level: 'error'
      };

    case StreamEventType.WARNING_ISSUED:
      return {
        timestamp,
        type: event.type,
        message: `⚠️ Warning: ${event.data.warning?.message || 'Unknown warning'}`,
        level: 'warning'
      };

    // Investigation events
    case StreamEventType.INVESTIGATION_STARTED:
      return {
        timestamp,
        type: event.type,
        message: `🔍 Investigation started`,
        level: 'info'
      };

    case StreamEventType.INVESTIGATION_COMPLETED:
      return {
        timestamp,
        type: event.type,
        message: `🔍 Investigation completed`,
        level: 'success'
      };

    case StreamEventType.ELEMENT_DISCOVERED:
      return {
        timestamp,
        type: event.type,
        message: `🎯 Element discovered: ${event.data.elementDiscovery?.elementType || 'Unknown element'}`,
        level: 'info'
      };
      
    default:
      return {
        timestamp,
        type: event.type,
        message: `ℹ️ ${event.type}: ${event.data.message || JSON.stringify(event.data)}`,
        level: 'info'
      };
  }
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
