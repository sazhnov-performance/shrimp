/**
 * Step Input Component
 * Simple textarea for step input with GOOOO button
 * Based on design/ui-automation-interface.md
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Play, Square } from 'lucide-react';
import { SimpleStepInputComponent } from './types';

interface StepInputComponentProps {
  stepText: string;
  setStepText: (text: string) => void;
  onExecute: () => Promise<void>;
  isExecuting: boolean;
  error: string | null;
}

export function StepInputComponent({
  stepText,
  setStepText,
  onExecute,
  isExecuting,
  error
}: StepInputComponentProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isEmpty = !stepText || stepText.trim().length === 0;

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(120, textarea.scrollHeight)}px`;
    }
  }, [stepText]);

  const handleExecute = async () => {
    if (isEmpty || isExecuting) return;
    
    try {
      await onExecute();
    } catch (error) {
      console.error('Execution error:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter to execute
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleExecute();
    }
  };

  return (
    <div className="space-y-4">
      {/* Step Input Area */}
      <div className="relative">
        <label htmlFor="step-input" className="block text-lg font-semibold text-white mb-3">
          📝 Automation Steps
        </label>
        
        <textarea
          ref={textareaRef}
          id="step-input"
          value={stepText}
          onChange={(e) => setStepText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter your automation steps in natural language, one per line:

Example:
Open https://example.com
Click on the login button
Type my username in the email field
Type my password in the password field
Click the submit button"
          className={`w-full min-h-[120px] max-h-[400px] p-4 bg-white/5 backdrop-blur-sm border rounded-lg resize-none text-gray-100 placeholder-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 ${
            error ? 'border-red-500/50' : 'border-white/20'
          }`}
          disabled={isExecuting}
        />
        
        {/* Character count hint */}
        <div className="absolute bottom-2 right-2 text-xs text-gray-500">
          {stepText.length} chars
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-3">
          <p className="text-red-400 text-sm">❌ {error}</p>
        </div>
      )}

      {/* Execute Button */}
      <div className="flex justify-center">
        <button
          onClick={handleExecute}
          disabled={isEmpty || isExecuting}
          className={`group relative overflow-hidden px-12 py-4 rounded-full text-xl font-bold transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center ${
            isExecuting 
              ? 'bg-gradient-to-r from-red-500 to-red-600 text-white animate-pulse'
              : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600'
          }`}
        >
          {/* Background animation when executing */}
          {isExecuting && (
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 animate-pulse"></div>
          )}
          
          {/* Button content */}
          <div className="relative flex items-center">
            {isExecuting ? (
              <>
                <Square className="mr-3" size={24} />
                EXECUTING...
              </>
            ) : (
              <>
                <Play className="mr-3 group-hover:translate-x-1 transition-transform" size={24} />
                GOOOO!
              </>
            )}
          </div>
        </button>
      </div>

      {/* Keyboard shortcut hint */}
      <div className="text-center">
        <p className="text-sm text-gray-400">
          Press <kbd className="px-2 py-1 bg-white/10 rounded text-xs">Ctrl + Enter</kbd> to execute
        </p>
      </div>
    </div>
  );
}
