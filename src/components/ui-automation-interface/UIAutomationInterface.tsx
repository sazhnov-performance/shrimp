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

      // Connect to stream if available - small delay to ensure proper message ordering
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-gray-200 rounded-full animate-spin border-t-pink-600 mx-auto mb-8"></div>
            <div className="absolute inset-0 w-20 h-20 border-4 border-transparent rounded-full animate-pulse border-t-pink-400 mx-auto"></div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            {initError ? 'Initialization Failed' : 'Initializing System'}
          </h2>
          {initError ? (
            <p className="text-red-600 text-sm font-medium max-w-md mx-auto">
              {initError.message || 'Failed to initialize the application'}
            </p>
          ) : (
            <p className="text-gray-600 text-sm font-medium">
              Preparing automation environment...
            </p>
          )}
        </div>
      </div>
    );
  }

  // Main UI content starts here - no more hooks after this point
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white shadow-sm">
        <div className="w-4/5 mx-auto px-6 py-4">
          <div className="text-center">
            <div className="inline-flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-600 to-pink-700 flex items-center justify-center shadow-lg">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="text-left">
                <h1 className="text-3xl font-bold text-gray-900">
                  <span className="text-pink-600">
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
            <div className="bg-white border border-gray-200 rounded-xl p-6 h-full shadow-lg">
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
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden h-full shadow-lg flex flex-col">
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
              className="group px-6 py-3 bg-white hover:bg-gray-50 text-gray-900 rounded-lg border border-gray-300 hover:border-pink-300 transition-all duration-200 font-medium shadow-sm"
              disabled={state.isExecuting}
            >
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Reset Session</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-gray-200 bg-white mt-12">
        <div className="w-4/5 mx-auto px-6 py-6">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-6 text-gray-600 text-sm font-medium">
              <span className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-pink-600 rounded-full"></div>
                <span>AI-Powered Automation</span>
              </span>
              <span className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Real-time Monitoring</span>
              </span>
              <span className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>Natural Language Processing</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
