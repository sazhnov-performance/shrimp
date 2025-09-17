/**
 * Main UI Automation Interface Component
 * Combines step input and streaming output with state management
 * Based on design/ui-automation-interface.md
 */

'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { StreamEvent, SimpleUIState, ERROR_MESSAGES } from './types';
import { StepInputComponent } from './StepInputComponent';
import { StreamingOutputComponent } from './StreamingOutputComponent';
import { FrontendAPIIntegration, buildExecuteRequest, validateStepInput } from './api-integration';

export function UIAutomationInterface() {
  // State management
  const [state, setState] = useState<SimpleUIState>({
    stepText: '',
    sessionId: null,
    streamId: null,
    isExecuting: false,
    events: [],
    isConnected: false,
    error: null
  });

  // API integration
  const apiRef = useRef<FrontendAPIIntegration | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Initialize API integration
  useEffect(() => {
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

    return () => {
      // Cleanup WebSocket connection
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Actions
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
    // Close existing WebSocket connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
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

      // Connect to stream if available
      if (response.data.streamId) {
        try {
          const ws = await apiRef.current!.connectToStream(response.data.streamId);
          wsRef.current = ws;
          
          setState(prev => ({
            ...prev,
            isConnected: true
          }));

          // Handle WebSocket events
          ws.onclose = () => {
            setState(prev => ({
              ...prev,
              isConnected: false,
              isExecuting: false
            }));
          };

          ws.onerror = () => {
            setState(prev => ({
              ...prev,
              isConnected: false,
              isExecuting: false,
              error: ERROR_MESSAGES.CONNECTION_LOST
            }));
          };

        } catch (streamError) {
          console.error('Failed to connect to stream:', streamError);
          setError(ERROR_MESSAGES.CONNECTION_LOST);
          setState(prev => ({
            ...prev,
            isExecuting: false
          }));
        }
      } else {
        // No streaming, just mark as not executing
        setState(prev => ({
          ...prev,
          isExecuting: false
        }));
      }

    } catch (error) {
      console.error('Execution failed:', error);
      setError(
        error instanceof Error 
          ? error.message 
          : ERROR_MESSAGES.EXECUTION_FAILED
      );
      setState(prev => ({
        ...prev,
        isExecuting: false
      }));
    }
  }, [state.stepText]);

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
              streamConnection={wsRef.current}
              isConnected={state.isConnected}
              error={state.error}
              autoScroll={true}
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
