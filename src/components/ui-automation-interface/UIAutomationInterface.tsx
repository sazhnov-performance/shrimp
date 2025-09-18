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
      setState(prev => ({
        ...prev,
        events: [...prev.events, event]
      }));
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
    setState(prev => ({
      ...prev,
      events: [...prev.events, event]
    }));
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-400 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-white mb-2">
            {initError ? 'Initialization Failed' : 'Initializing Application...'}
          </h2>
          {initError ? (
            <p className="text-red-400">
              {initError.message || 'Failed to initialize the application'}
            </p>
          ) : (
            <p className="text-gray-300">
              Setting up automation modules...
            </p>
          )}
        </div>
      </div>
    );
  }

  // Main UI content starts here - no more hooks after this point
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/20 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-2">
              🤖 <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                AI Automation Interface
              </span>
            </h1>
            <p className="text-gray-300 text-lg">
              Describe what you want to automate in natural language
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-200px)]">
          
          {/* Left Panel - Step Input */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <StepInputComponent
              stepText={state.stepText}
              setStepText={setStepText}
              onExecute={executeSteps}
              isExecuting={state.isExecuting}
              error={state.error}
            />
          </div>

          {/* Right Panel - Streaming Output */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
            <StreamingOutputComponent
              events={state.events}
              sessionId={state.sessionId}
              isConnected={state.isConnected}
              error={state.error}
              autoScroll={false}
            />
          </div>
        </div>

        {/* Reset Button */}
        {(state.sessionId || state.events.length > 0) && (
          <div className="flex justify-center mt-6">
            <button
              onClick={reset}
              className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition-colors"
              disabled={state.isExecuting}
            >
              🔄 Reset Session
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-white/10 bg-black/20 backdrop-blur-md mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="text-center text-gray-400 text-sm">
            <p>Powered by AI-driven browser automation • Real-time streaming • Natural language processing</p>
          </div>
        </div>
      </div>
    </div>
  );
}
