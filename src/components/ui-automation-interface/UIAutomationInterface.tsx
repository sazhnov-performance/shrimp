/**
 * Main UI Automation Interface Component
 * Combines step input and streaming output with state management
 * Based on design/ui-automation-interface.md
 */

'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { StreamEvent, StreamEventType, SimpleUIState, ERROR_MESSAGES } from './types';
import { StepInputComponent } from './StepInputComponent';
import { StreamingOutputComponent } from './StreamingOutputComponent';
import { FrontendAPIIntegration, buildExecuteRequest, validateStepInput } from './api-integration';
// Remove direct import to avoid Node.js API loading on client-side

export function UIAutomationInterface() {
  // Client-side initialization check via API
  const [appInitialized, setAppInitialized] = React.useState(false);
  const [initError, setInitError] = React.useState<Error | null>(null);
  
  // State management
  const [state, setState] = useState<SimpleUIState>({
    stepText: '',
    sessionId: null,
    streamId: null,
    isExecuting: false,
    events: [],
    isConnected: false,
    error: null,
    reconnectAttempt: 0,
    isReconnecting: false
  });

  // API integration refs - ALL HOOKS MUST BE DECLARED BEFORE ANY CONDITIONAL RETURNS
  const apiRef = useRef<FrontendAPIIntegration | null>(null);
  const sseRef = useRef<EventSource | null>(null);

  // Initialize API integration - MOVED BEFORE EARLY RETURN
  useEffect(() => {
    if (!appInitialized) return; // Don't initialize until app is ready
    
    apiRef.current = new FrontendAPIIntegration();
    
    // Set up event handlers
    apiRef.current.onEvent((event: StreamEvent) => {
      setState(prev => {
        const newEvents = [...prev.events, event].sort((a, b) => {
          const timeA = new Date(a.timestamp).getTime();
          const timeB = new Date(b.timestamp).getTime();
          return timeA - timeB;
        });
        return {
          ...prev,
          events: newEvents
        };
      });
    });

    apiRef.current.onError((error: string) => {
      setState(prev => ({
        ...prev,
        error,
        isConnected: false
      }));
    });

    apiRef.current.onReconnecting((attempt: number, delay: number) => {
      setState(prev => ({
        ...prev,
        isReconnecting: true,
        reconnectAttempt: attempt,
        error: `Reconnecting... (${attempt}/3) in ${delay/1000}s`,
        isConnected: false
      }));
    });

    apiRef.current.onReconnected(() => {
      setState(prev => ({
        ...prev,
        isReconnecting: false,
        reconnectAttempt: 0,
        error: null,
        isConnected: true
      }));
    });

    // Cleanup function
    return () => {
      if (apiRef.current) {
        apiRef.current = null;
      }
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
    };
  }, [appInitialized]); // Re-run when initialization status changes

  // Actions - ALL useCallback HOOKS MOVED BEFORE EARLY RETURN
  const setStepText = useCallback((text: string) => {
    setState(prev => ({
      ...prev,
      stepText: text,
      error: null // Clear error when user starts typing
    }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({
      ...prev,
      error
    }));
  }, []);

  const addEvent = useCallback((event: StreamEvent) => {
    setState(prev => {
      const newEvents = [...prev.events, event].sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeA - timeB;
      });
      return {
        ...prev,
        events: newEvents
      };
    });
  }, []);

  const reset = useCallback(() => {
    // Close existing SSE connection
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }

    setState(prev => ({
      ...prev,
      sessionId: null,
      streamId: null,
      isExecuting: false,
      events: [],
      isConnected: false,
      error: null
    }));
  }, []);

  const executeSteps = useCallback(async () => {
    if (!apiRef.current) {
      setError('API integration not initialized');
      return;
    }

    // Validate input
    const validation = validateStepInput(state.stepText);
    if (!validation.isValid) {
      setError(validation.error || ERROR_MESSAGES.EMPTY_STEPS);
      return;
    }

    try {
      // Clear previous state
      setState(prev => ({
        ...prev,
        isExecuting: true,
        error: null,
        events: [],
        sessionId: null,
        streamId: null,
        isConnected: false
      }));

      // Build request
      const request = buildExecuteRequest(state.stepText);
      
      // Execute steps
      console.log('Executing steps:', request);
      const response = await apiRef.current.executeSteps(request);
      
      console.log('Execution response:', response);

      // Update state with session info
      setState(prev => ({
        ...prev,
        sessionId: response.data.sessionId,
        streamId: response.data.streamId || null
      }));

      // Connect to stream if available - small delay to ensure "Stream Initiated" is sent first
      if (response.data.streamId) {
        try {
          // Small delay to ensure proper message ordering
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const sse = await apiRef.current!.connectToStream(response.data.streamId);
          sseRef.current = sse;
          
          setState(prev => ({
            ...prev,
            isConnected: true
          }));

          // Handle SSE events
          sse.onmessage = (event) => {
            try {
              const message = JSON.parse(event.data);
              
              // Convert SSE message format to StreamEvent format
              if (message.type === 'structured_event') {
                // Parse the structured data from the message
                const structuredData = JSON.parse(message.data);
                
                let eventType: StreamEventType;
                let level: 'info' | 'success' | 'warning' | 'error';
                let displayMessage: string;
                
                switch (structuredData.type) {
                  case 'reasoning':
                    eventType = StreamEventType.STRUCTURED_REASONING;
                    level = structuredData.confidence === 'high' ? 'info' : structuredData.confidence === 'medium' ? 'warning' : 'error';
                    displayMessage = structuredData.text;
                    break;
                  case 'action':
                    eventType = StreamEventType.STRUCTURED_ACTION;
                    level = structuredData.success ? 'success' : 'error';
                    displayMessage = `${structuredData.actionName}: ${structuredData.success ? 'Success' : 'Failed'}`;
                    if (structuredData.error) displayMessage += ` - ${structuredData.error}`;
                    break;
                  case 'screenshot':
                    eventType = StreamEventType.STRUCTURED_SCREENSHOT;
                    level = 'info';
                    displayMessage = `Screenshot captured${structuredData.actionName ? ` for ${structuredData.actionName}` : ''}`;
                    break;
                  default:
                    console.warn('Unknown structured event type:', structuredData);
                    return;
                }
                
                const streamEvent: StreamEvent = {
                  id: `structured_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  type: eventType,
                  timestamp: new Date(structuredData.timestamp),
                  sessionId: message.sessionId,
                  stepIndex: structuredData.stepId,
                  message: displayMessage,
                  level,
                  structuredData
                };
                
                addEvent(streamEvent);
                
              } else if (message.type === 'event') {
                // Regular event
                const streamEvent: StreamEvent = {
                  id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  type: StreamEventType.WORKFLOW_PROGRESS,
                  timestamp: new Date(message.timestamp),
                  sessionId: message.sessionId,
                  message: message.data,
                  level: 'info' as const
                };
                
                addEvent(streamEvent);
                
              } else {
                console.warn('Unknown SSE message type:', message.type);
              }
            } catch (err) {
              console.error('Failed to parse SSE event:', err);
            }
          };

          sse.onerror = (event) => {
            console.error('SSE connection error:', event);
            setState(prev => ({
              ...prev,
              isConnected: false,
              error: 'Connection lost'
            }));
          };

          sse.onopen = () => {
            setState(prev => ({
              ...prev,
              isConnected: true,
              error: null
            }));
          };

        } catch (streamError) {
          console.error('Failed to connect to stream:', streamError);
          setError('Failed to connect to event stream');
        }
      }

      // Mark execution as complete
      setState(prev => ({
        ...prev,
        isExecuting: false
      }));

    } catch (error) {
      console.error('Execution failed:', error);
      setError(error instanceof Error ? error.message : 'Execution failed');
      setState(prev => ({
        ...prev,
        isExecuting: false
      }));
    }
  }, [state.stepText, setError, addEvent]);

  // Initialization check effect - MOVED AFTER ALL OTHER HOOKS
  React.useEffect(() => {
    const checkInitialization = async () => {
      try {
        // Check initialization status via health API
        const response = await fetch('/api/health');
        const data = await response.json();
        
        if (data.initialized) {
          setAppInitialized(true);
        } else if (data.status === 'error') {
          setInitError(new Error(data.error || 'Initialization failed'));
        } else {
          // Still initializing - poll again
          setTimeout(checkInitialization, 1000);
        }
      } catch (err) {
        setInitError(err instanceof Error ? err : new Error('Failed to check initialization status'));
      }
    };

    checkInitialization();
  }, []);

  // Show initialization status - NOW AFTER ALL HOOKS
  if (!appInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-blue-500/30 rounded-full animate-spin border-t-blue-400 mx-auto mb-8"></div>
            <div className="absolute inset-0 w-20 h-20 border-4 border-transparent rounded-full animate-pulse border-t-blue-300/50 mx-auto"></div>
          </div>
          <h2 className="text-2xl font-light text-white mb-3 tracking-wide">
            {initError ? 'Initialization Failed' : 'Initializing System'}
          </h2>
          {initError ? (
            <p className="text-red-300 text-sm font-light max-w-md mx-auto">
              {initError.message || 'Failed to initialize the application'}
            </p>
          ) : (
            <p className="text-slate-300 text-sm font-light">
              Preparing automation environment...
            </p>
          )}
        </div>
      </div>
    );
  }

  // Main UI content starts here - no more hooks after this point
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950">
      {/* Header */}
      <div className="border-b border-slate-700/30 bg-slate-900/30 backdrop-blur-xl">
        <div className="w-4/5 mx-auto px-6 py-8">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="text-left">
                <h1 className="text-4xl font-light text-white tracking-wide">
                  <span className="bg-gradient-to-r from-blue-300 to-indigo-300 bg-clip-text text-transparent">
                    SHRIMP
                  </span>
                </h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-4/5 mx-auto px-6 py-8 h-[calc(100vh-200px)] flex flex-col">
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 flex-1 min-h-0">
          
          {/* Left Panel - Step Input */}
          <div className="xl:col-span-2 min-h-0">
            <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-600/30 rounded-2xl p-6 h-full shadow-2xl">
              <StepInputComponent
                stepText={state.stepText}
                setStepText={setStepText}
                onExecute={executeSteps}
                isExecuting={state.isExecuting}
                error={state.error}
              />
            </div>
          </div>

          {/* Right Panel - Streaming Output */}
          <div className="xl:col-span-3 min-h-0">
            <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-600/30 rounded-2xl overflow-hidden h-full shadow-2xl flex flex-col">
              <StreamingOutputComponent
                events={state.events}
                sessionId={state.sessionId}
                isConnected={state.isConnected}
                error={state.error}
                autoScroll={true}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Reset Button */}
      {(state.sessionId || state.events.length > 0) && (
        <div className="w-4/5 mx-auto px-6 pb-8">
          <div className="flex justify-center">
            <button
              onClick={reset}
              className="group px-6 py-3 bg-slate-700/50 hover:bg-slate-600/50 text-slate-200 rounded-xl border border-slate-600/50 hover:border-slate-500/50 transition-all duration-200 font-light tracking-wide backdrop-blur-sm"
              disabled={state.isExecuting}
            >
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Reset Session</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-slate-700/30 bg-slate-900/30 backdrop-blur-xl mt-12">
        <div className="w-4/5 mx-auto px-6 py-6">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-6 text-slate-400 text-sm font-light">
              <span className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span>AI-Powered Automation</span>
              </span>
              <span className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>Real-time Monitoring</span>
              </span>
              <span className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                <span>Natural Language Processing</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
