/**
 * Streaming Output Component
 * Displays real-time automation execution logs
 * Based on design/ui-automation-interface.md
 */

'use client';

import React, { useEffect, useRef } from 'react';
import { Wifi, WifiOff, Activity, AlertCircle } from 'lucide-react';
import { StreamEvent, SimpleLogEntry } from './types';
import { formatLogEntry, getLevelColor, getLevelBgColor } from './log-formatter';

interface StreamingOutputComponentProps {
  events: StreamEvent[];
  sessionId: string | null;
  streamConnection: WebSocket | null;
  isConnected: boolean;
  error: string | null;
  autoScroll?: boolean;
}

export function StreamingOutputComponent({
  events,
  sessionId,
  streamConnection,
  isConnected,
  error,
  autoScroll = true
}: StreamingOutputComponentProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (autoScroll && endOfMessagesRef.current) {
      endOfMessagesRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events, autoScroll]);

  // Format events for display
  const logEntries: SimpleLogEntry[] = events.map(formatLogEntry);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
        <div className="flex items-center space-x-3">
          <Activity className="text-purple-400" size={20} />
          <h2 className="text-lg font-semibold text-white">Execution Log</h2>
        </div>
        
        {/* Connection Status */}
        <div className="flex items-center space-x-2">
          {sessionId && (
            <span className="text-xs text-gray-400 font-mono">
              Session: {sessionId.slice(0, 8)}...
            </span>
          )}
          
          <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs ${
            isConnected 
              ? 'bg-green-900/20 text-green-400' 
              : 'bg-red-900/20 text-red-400'
          }`}>
            {isConnected ? (
              <>
                <Wifi size={12} />
                <span>Connected</span>
              </>
            ) : (
              <>
                <WifiOff size={12} />
                <span>Disconnected</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-900/20 border-b border-red-500/20">
          <div className="flex items-center space-x-2 text-red-400">
            <AlertCircle size={16} />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Log Output */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0"
      >
        {logEntries.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            {sessionId ? (
              <div className="space-y-2">
                <Activity className="mx-auto animate-pulse" size={32} />
                <p>Waiting for execution logs...</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-4xl">📝</div>
                <p>Enter automation steps above and click GOOOO to start</p>
              </div>
            )}
          </div>
        ) : (
          <>
            {logEntries.map((entry, index) => (
              <LogEntry key={`${entry.timestamp}-${index}`} entry={entry} />
            ))}
            <div ref={endOfMessagesRef} />
          </>
        )}
      </div>
      
      {/* Footer */}
      <div className="p-2 border-t border-white/10 bg-white/5">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{logEntries.length} events</span>
          {autoScroll && (
            <span className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span>Auto-scroll enabled</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Individual log entry component
interface LogEntryProps {
  entry: SimpleLogEntry;
}

function LogEntry({ entry }: LogEntryProps) {
  const levelColor = getLevelColor(entry.level);
  const levelBgColor = getLevelBgColor(entry.level);

  return (
    <div className={`p-3 rounded-lg border ${levelBgColor} transition-all hover:bg-white/10`}>
      <div className="flex items-start space-x-3">
        {/* Timestamp */}
        <span className="text-xs text-gray-500 font-mono min-w-[60px] mt-0.5">
          {new Date(entry.timestamp).toLocaleTimeString()}
        </span>
        
        {/* Message */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm ${levelColor} break-words`}>
            {entry.message}
          </p>
          
          {/* Event type hint */}
          <span className="text-xs text-gray-500 font-mono">
            {entry.type}
          </span>
        </div>
      </div>
    </div>
  );
}
