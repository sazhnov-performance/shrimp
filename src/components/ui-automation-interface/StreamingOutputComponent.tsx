/**
 * Streaming Output Component
 * Displays real-time automation execution logs
 * Based on design/ui-automation-interface.md
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Activity, AlertCircle, ExternalLink } from 'lucide-react';
import { StreamEvent, SimpleLogEntry, ScreenshotLogMessage } from './types';
import { formatLogEntry, getLevelColor, getLevelBgColor } from './log-formatter';

interface StreamingOutputComponentProps {
  events: StreamEvent[];
  sessionId: string | null;
  isConnected: boolean;
  error: string | null;
  autoScroll?: boolean;
  isReconnecting?: boolean;
  reconnectAttempt?: number;
}

export function StreamingOutputComponent({
  events,
  sessionId,
  isConnected,
  error,
  autoScroll = true,
  isReconnecting = false,
  reconnectAttempt = 0
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
      <div className="flex items-center justify-between p-5 border-b border-slate-600/30 bg-slate-700/20">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <Activity className="text-white" size={16} />
          </div>
          <h2 className="text-lg font-light text-slate-200 tracking-wide">Execution Monitor</h2>
        </div>
        
        {/* Connection Status */}
        <div className="flex items-center space-x-3">
          {sessionId && (
            <span className="text-xs text-slate-400 font-mono bg-slate-700/40 px-2 py-1 rounded-lg">
              {sessionId.slice(0, 8)}
            </span>
          )}
          
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-lg text-xs font-light backdrop-blur-sm ${
            isConnected 
              ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-500/20' 
              : isReconnecting
                ? 'bg-amber-900/30 text-amber-300 border border-amber-500/20'
                : 'bg-red-900/30 text-red-300 border border-red-500/20'
          }`}>
            {isConnected ? (
              <>
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <span>Live</span>
              </>
            ) : isReconnecting ? (
              <>
                <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                <span>Reconnecting ({reconnectAttempt}/3)</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                <span>Offline</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-5 bg-red-900/20 border-b border-red-400/20 backdrop-blur-sm">
          <div className="flex items-center space-x-3 text-red-300">
            <div className="w-6 h-6 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <AlertCircle size={14} />
            </div>
            <span className="text-sm font-light">{error}</span>
          </div>
        </div>
      )}

      {/* Log Output */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-5 space-y-3 min-h-0"
      >
        {logEntries.length === 0 ? (
          <div className="text-center text-slate-400 py-16">
            {sessionId ? (
              <div className="space-y-4">
                <div className="w-12 h-12 mx-auto rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Activity className="animate-pulse" size={24} />
                </div>
                <div className="space-y-2">
                  <p className="font-light text-lg">Monitoring Execution</p>
                  <p className="text-sm text-slate-500">Waiting for workflow events...</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-700/30 flex items-center justify-center">
                  <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h4.125m0-15.75c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V8.25m-6.75 0V4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V8.25" />
                  </svg>
                </div>
                <div className="space-y-2">
                  <p className="font-light text-lg">Ready to Execute</p>
                  <p className="text-sm text-slate-500">Define your workflow and execute to see real-time logs</p>
                </div>
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
      <div className="p-4 border-t border-slate-600/30 bg-slate-700/20">
        <div className="flex items-center justify-between text-xs text-slate-400 font-light">
          <span className="bg-slate-700/40 px-2 py-1 rounded-lg">
            {logEntries.length} {logEntries.length === 1 ? 'event' : 'events'}
          </span>
          {autoScroll && (
            <span className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              <span>Auto-scroll active</span>
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
  
  // Check if this is a screenshot event
  const isScreenshot = entry.structuredData?.type === 'screenshot';
  const screenshotData = isScreenshot ? entry.structuredData as ScreenshotLogMessage : null;

  return (
    <div className={`p-4 rounded-xl border backdrop-blur-sm ${levelBgColor} transition-all hover:bg-slate-600/10 group`}>
      <div className="flex items-start space-x-4">
        {/* Timestamp */}
        <span className="text-xs text-slate-500 font-mono min-w-[70px] mt-1 bg-slate-700/30 px-2 py-1 rounded-lg">
          {new Date(entry.timestamp).toLocaleTimeString()}
        </span>
        
        {/* Message and content */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm ${levelColor} break-words font-light leading-relaxed`}>
            {entry.message}
          </p>
          
          {/* Screenshot thumbnail if available */}
          {isScreenshot && screenshotData && (
            <div className="mt-2">
              <ScreenshotThumbnail 
                screenshotUrl={screenshotData.screenshotUrl}
                screenshotId={screenshotData.screenshotId}
                actionName={screenshotData.actionName}
              />
            </div>
          )}
          
          {/* Confidence indicator for reasoning events */}
          {entry.structuredData?.type === 'reasoning' && (
            <div className="mt-3">
              <span className={`inline-flex items-center text-xs px-3 py-1 rounded-lg font-light ${
                entry.structuredData.confidence === 'high' ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-500/20' :
                entry.structuredData.confidence === 'medium' ? 'bg-amber-900/30 text-amber-300 border border-amber-500/20' :
                'bg-red-900/30 text-red-300 border border-red-500/20'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full mr-2 ${
                  entry.structuredData.confidence === 'high' ? 'bg-emerald-400' :
                  entry.structuredData.confidence === 'medium' ? 'bg-amber-400' :
                  'bg-red-400'
                }`}></div>
                {entry.structuredData.confidence} confidence
              </span>
            </div>
          )}
          
          {/* Step and iteration info for structured events */}
          {entry.structuredData && (
            <div className="flex items-center space-x-3 mt-3">
              <span className="text-xs text-slate-400 font-mono bg-slate-700/30 px-2 py-1 rounded-lg">
                Step {entry.structuredData.stepId}
              </span>
              {entry.structuredData.iteration && (
                <span className="text-xs text-slate-400 font-mono bg-slate-700/30 px-2 py-1 rounded-lg">
                  Iteration {entry.structuredData.iteration}
                </span>
              )}
              <span className="text-xs text-slate-500 font-light bg-slate-800/30 px-2 py-1 rounded-lg">
                {entry.structuredData.type}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Screenshot thumbnail component
interface ScreenshotThumbnailProps {
  screenshotUrl?: string;
  screenshotId: string;
  actionName?: string;
}

function ScreenshotThumbnail({ screenshotUrl, screenshotId, actionName }: ScreenshotThumbnailProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Return early if no screenshot URL is provided
  if (!screenshotUrl) {
    return (
      <div className="p-4 rounded-xl border border-slate-600/30 bg-slate-800/20 text-slate-400 text-sm font-light">
        <div className="flex items-center space-x-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>Screenshot not available</span>
        </div>
      </div>
    );
  }

  // Generate thumbnail URL by appending -thumbnail to the image ID
  const thumbnailUrl = screenshotUrl.replace(`/${screenshotId}`, `/${screenshotId}-thumbnail`);
  
  const handleImageClick = () => {
    setIsModalOpen(true);
  };

  return (
    <>
      {/* Screenshot Card */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-600/30 overflow-hidden group cursor-pointer hover:border-blue-400/40 transition-all duration-300 hover:bg-slate-700/30">
        <div className="p-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-sm font-light text-slate-300">Screenshot Captured</span>
            </div>
            <button
              onClick={handleImageClick}
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 rounded-lg hover:bg-slate-600/30"
            >
              <svg className="w-4 h-4 text-slate-400 hover:text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          </div>

          {/* Image Container */}
          <div className="relative rounded-lg overflow-hidden bg-slate-900/50">
            {!imageLoaded && (
              <div className="aspect-video flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-slate-500/30 border-t-slate-400 rounded-full animate-spin"></div>
              </div>
            )}
            <img
              src={thumbnailUrl}
              alt={`Screenshot${actionName ? ` for ${actionName}` : ''}`}
              className={`w-full h-auto transition-all duration-300 group-hover:scale-[1.02] ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              onClick={handleImageClick}
              onLoad={() => setImageLoaded(true)}
              onError={(e) => {
                // If thumbnail fails, try the original image
                const img = e.target as HTMLImageElement;
                if (img.src === thumbnailUrl) {
                  img.src = screenshotUrl;
                }
              }}
            />
            
            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
              <div className="bg-slate-900/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-slate-600/30">
                <div className="flex items-center space-x-2 text-slate-200">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span className="text-sm font-light">View Full Size</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action name footer */}
          {actionName && (
            <div className="mt-3 px-2 py-1 bg-slate-700/30 rounded-lg">
              <span className="text-xs text-slate-400 font-light">{actionName}</span>
            </div>
          )}
        </div>
      </div>

      {/* Full-size Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}>
          <div className="relative max-w-5xl max-h-[90vh] w-full">
            {/* Modal Header */}
            <div className="bg-slate-900/90 backdrop-blur-sm border border-slate-600/30 rounded-t-xl p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-light text-slate-200">Screenshot Preview</h3>
                  {actionName && <p className="text-sm text-slate-400">{actionName}</p>}
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-700/30 transition-colors"
              >
                <svg className="w-5 h-5 text-slate-400 hover:text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="bg-slate-900/90 backdrop-blur-sm border-x border-b border-slate-600/30 rounded-b-xl overflow-hidden">
              <img
                src={screenshotUrl}
                alt={`Screenshot${actionName ? ` for ${actionName}` : ''}`}
                className="w-full h-auto max-h-[70vh] object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
