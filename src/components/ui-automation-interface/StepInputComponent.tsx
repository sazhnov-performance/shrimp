/**
 * Step Input Component
 * Simple textarea for step input with GOOOO button
 * Based on design/ui-automation-interface.md
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
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
        <label htmlFor="step-input" className="block text-lg font-light text-slate-200 mb-4 tracking-wide">
          Automation Workflow
        </label>
        
        <textarea
          ref={textareaRef}
          id="step-input"
          value={stepText}
          onChange={(e) => setStepText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Describe your automation workflow using natural language...

Examples:

• Open https://example.com and take a screenshot
• Click the 'Sign In' button and enter credentials  
• Fill out the contact form and submit
• Navigate through multiple pages and validate content

Feel free to describe complex workflows with multiple steps!`}
          className={`w-full min-h-[340px] max-h-[620px] p-5 bg-slate-700/20 backdrop-blur-sm border rounded-xl resize-none text-slate-100 placeholder-slate-400 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 font-light leading-7 whitespace-pre-line overflow-y-auto scrollbar-thin scrollbar-track-slate-700/20 scrollbar-thumb-slate-500/50 hover:scrollbar-thumb-slate-400/70 ${
            error ? 'border-red-400/50 focus:ring-red-400/50 focus:border-red-400/50' : 'border-slate-600/30'
          }`}
          disabled={isExecuting}
        />
        
        {/* Character count hint */}
        <div className="absolute bottom-3 right-4 text-xs text-slate-500 font-light">
          {stepText.length} characters
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-900/20 border border-red-400/30 rounded-xl p-4 backdrop-blur-sm">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-red-300 text-sm font-light">{error}</p>
          </div>
        </div>
      )}

      {/* Execute Button */}
      <div className="flex justify-center">
        <button
          onClick={handleExecute}
          disabled={isEmpty || isExecuting}
          className={`group relative overflow-hidden px-8 py-4 rounded-xl font-light text-base tracking-wide transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center min-w-[200px] ${
            isExecuting 
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/25'
              : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40'
          }`}
        >
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 transform translate-x-[-100%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>
          
          {/* Button content */}
          <div className="relative flex items-center space-x-3">
            {isExecuting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 group-hover:translate-x-0.5 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                </svg>
                <span>Execute Workflow</span>
              </>
            )}
          </div>
        </button>
      </div>

      {/* Keyboard shortcut hint */}
      <div className="text-center">
        <p className="text-sm text-slate-400 font-light">
          Press <kbd className="px-3 py-1 bg-slate-700/40 border border-slate-600/30 rounded-lg text-xs font-mono tracking-wider">Ctrl + Enter</kbd> to execute
        </p>
      </div>
    </div>
  );
}
