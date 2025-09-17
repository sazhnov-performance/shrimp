/**
 * Core prompt generation logic for AI automation agents
 */

import { ContextData } from '../ai-context-manager/types';
import { ContextualHistory } from './types';
import { PROMPT_TEMPLATE, FALLBACK_TEMPLATE } from './templates';

export class PromptBuilder {
  private maxPromptLength: number;

  constructor(maxPromptLength: number = 8000) {
    this.maxPromptLength = maxPromptLength;
  }

  /**
   * Build complete prompt with context, schema, and step information
   * @param context Execution context data
   * @param stepId Current step index
   * @param schema JSON schema for AI responses
   * @returns Formatted prompt string
   */
  buildPrompt(context: ContextData, stepId: number, schema: object): string {
    try {
      const stepName = context.steps[stepId] || 'Unknown Step';
      const history = this.formatExecutionHistory(context, stepId);
      const schemaText = JSON.stringify(schema, null, 2);
      
      const prompt = PROMPT_TEMPLATE
        .replace('{sessionId}', context.contextId)
        .replace('{stepNumber}', (stepId + 1).toString())
        .replace('{totalSteps}', context.steps.length.toString())
        .replace('{stepName}', stepName)
        .replace('{currentStepName}', stepName)
        .replace('{contextualHistory}', history)
        .replace('{responseSchema}', schemaText);

      // Check prompt length and handle DOM size limits
      if (prompt.length > this.maxPromptLength) {
        // Check if the issue is caused by large DOM content from GET_SUBDOM
        if (history.includes('DOM CONTENT:')) {
          return `CRITICAL ERROR: GET_SUBDOM returned DOM content that exceeds context limits.

The DOM content is too large (${prompt.length} characters, limit: ${this.maxPromptLength}) to fit in the AI context.

This GET_SUBDOM operation must FAIL. Please:
1. Use a more specific selector to get a smaller DOM section
2. Target specific elements instead of large containers
3. Consider using GET_CONTENT for specific data extraction

RESPONSE FORMAT:
{
  "reasoning": "DOM content too large for context - need more specific selector",
  "confidence": "LOW",
  "flowControl": "stop_failure"
}`;
        }
        
        return this.buildFallbackPrompt(stepName, '{"type": "object", "required": ["reasoning", "confidence", "flowControl"]}');
      }

      return prompt;
    } catch (error) {
      // Fallback to basic prompt if building fails
      const stepName = context.steps[stepId] || 'Unknown Step';
      const schemaText = JSON.stringify(schema, null, 2);
      return this.buildFallbackPrompt(stepName, schemaText);
    }
  }

  /**
   * Format execution history for inclusion in prompts
   * @param context Execution context data
   * @param currentStepId Current step index
   * @returns Formatted history string
   */
  private formatExecutionHistory(context: ContextData, currentStepId: number): string {
    try {
      let history = '';

      // Format previous steps summary
      if (currentStepId > 0) {
        history += 'PREVIOUS STEPS:\n';
        for (let i = 0; i < currentStepId; i++) {
          const stepName = context.steps[i];
          const stepLogs = context.stepLogs[i] || [];
          const outcome = this.determineStepOutcome(stepLogs);
          const summary = this.summarizeStep(stepName, stepLogs);
          
          history += `- Step ${i + 1}: "${stepName}" - ${outcome}\n`;
          if (summary) {
            history += `  Summary: ${summary}\n`;
          }
        }
        history += '\n';
      }

      // Format current step attempts
      const currentStepLogs = context.stepLogs[currentStepId] || [];
      if (currentStepLogs.length > 0) {
        history += 'CURRENT STEP ATTEMPTS:\n';
        const lastTenLogs = currentStepLogs.slice(-10); // Show last 10 attempts
        const startingAttemptNumber = Math.max(1, currentStepLogs.length - 9); // Calculate correct starting attempt number
        
        lastTenLogs.forEach((log, index) => {
          const attemptNumber = startingAttemptNumber + index;
          const attempt = this.formatLogEntry(log, attemptNumber);
          history += `${attempt}\n`;
        });
      }

      return history || 'No execution history available.';
    } catch (error) {
      return 'Error formatting execution history.';
    }
  }

  /**
   * Determine step outcome from logs
   * @param logs Step execution logs
   * @returns Step outcome status
   */
  private determineStepOutcome(logs: any[]): string {
    if (!logs || logs.length === 0) {
      return 'not started';
    }

    const lastLog = logs[logs.length - 1];
    
    // Check for success/failure indicators in the nested aiResponse
    const flowControl = lastLog?.aiResponse?.flowControl;
    if (flowControl === 'stop_success') {
      return 'success';
    } else if (flowControl === 'stop_failure') {
      return 'failure';
    } else {
      return 'in progress';
    }
  }

  /**
   * Create a summary of step execution
   * @param stepName Name of the step
   * @param logs Step execution logs
   * @returns Summary string
   */
  private summarizeStep(stepName: string, logs: any[]): string {
    if (!logs || logs.length === 0) {
      return 'No actions taken';
    }

    const actionCount = logs.length;
    const lastLog = logs[logs.length - 1];
    
    // Access reasoning from nested aiResponse structure
    const reasoning = lastLog?.aiResponse?.reasoning;
    const executionResult = lastLog?.executionResult;
    
    let summary = `${actionCount} action(s) taken`;
    
    // Add execution outcome if available
    if (executionResult) {
      if (executionResult.success) {
        summary += ' (succeeded)';
      } else {
        const error = executionResult.error ? executionResult.error.substring(0, 50) : 'failed';
        summary += ` (failed: ${error}${executionResult.error && executionResult.error.length > 50 ? '...' : ''})`;
      }
    }
    
    if (reasoning) {
      // Include full reasoning in summary - AI needs complete context
      summary += `. Last reasoning: ${reasoning}`;
    }

    return summary;
  }

  /**
   * Format a single log entry for history display
   * @param log Log entry
   * @param attemptNumber Attempt number
   * @returns Formatted log string
   */
  private formatLogEntry(log: any, attemptNumber: number): string {
    try {
      // Check if log exists and has expected structure
      if (!log) {
        return `  Attempt ${attemptNumber}: No data available`;
      }

      // Access data from nested aiResponse structure
      const aiResponse = log?.aiResponse;
      const executionResult = log?.executionResult;
      
      // Handle case where aiResponse is missing or malformed
      if (!aiResponse) {
        // Check if data is in the log directly (legacy format)
        const legacyAction = log?.action?.command || log?.command || 'Unknown';
        const legacyParameters = log?.action?.parameters || log?.parameters;
        const legacyParametersText = legacyParameters ? JSON.stringify(legacyParameters, null, 2) : 'No parameters';
        const legacyReasoning = log?.reasoning || 'No reasoning provided'; // Show full reasoning, no truncation
        const legacyConfidence = log?.confidence || 'LOW';
        
        // Format legacy attempt with full details
        let legacyAttemptDetails = `  Attempt ${attemptNumber}: ${legacyAction} (Confidence: ${legacyConfidence})\n`;
        legacyAttemptDetails += `    Reasoning: ${legacyReasoning}\n`;
        legacyAttemptDetails += `    Parameters: ${legacyParametersText}`;
        
        // Handle execution result in legacy format
        if (executionResult) {
          if (executionResult.success) {
            // ONLY for GET_SUBDOM: include full DOM content
            if (legacyAction === 'GET_SUBDOM' && typeof executionResult.result === 'string') {
              legacyAttemptDetails += `\n    Result: ✓ DOM retrieved successfully\n\nDOM CONTENT:\n${executionResult.result}`;
            } else if (legacyAction === 'OPEN_PAGE') {
              // For OPEN_PAGE: just show success, don't include full page HTML
              legacyAttemptDetails += `\n    Result: ✓ Page opened successfully`;
            } else {
              // For other commands: show truncated result
              const result = typeof executionResult.result === 'string' 
                ? executionResult.result.substring(0, 100)
                : 'Success';
              legacyAttemptDetails += `\n    Result: ✓ ${result}${typeof executionResult.result === 'string' && executionResult.result.length > 100 ? '...' : ''}`;
            }
          } else {
            const error = executionResult.error || 'Unknown error';
            legacyAttemptDetails += `\n    Result: ✗ ${error}`;
          }
        }
        
        return legacyAttemptDetails;
      }
      
      const action = aiResponse?.action?.command || 'Unknown';
      const actionParameters = aiResponse?.action?.parameters ? JSON.stringify(aiResponse.action.parameters, null, 2) : 'No parameters';
      const reasoning = aiResponse?.reasoning || 'No reasoning provided'; // Show full reasoning, no truncation
      const confidence = aiResponse?.confidence !== undefined ? aiResponse.confidence : 'LOW';
      
      // Format the attempt with full details
      let attemptDetails = `  Attempt ${attemptNumber}: ${action} (Confidence: ${confidence})\n`;
      attemptDetails += `    Reasoning: ${reasoning}\n`;
      attemptDetails += `    Parameters: ${actionParameters}`;
      
      // Add execution result
      if (executionResult) {
        if (executionResult.success) {
          // ONLY for GET_SUBDOM: include full DOM content
          if (action === 'GET_SUBDOM' && typeof executionResult.result === 'string') {
            attemptDetails += `\n    Result: ✓ DOM retrieved successfully\n\nDOM CONTENT:\n${executionResult.result}`;
          } else if (action === 'OPEN_PAGE') {
            // For OPEN_PAGE: just show success, don't include full page HTML
            attemptDetails += `\n    Result: ✓ Page opened successfully`;
          } else {
            // For other commands: show truncated result
            const result = typeof executionResult.result === 'string' 
              ? executionResult.result.substring(0, 100)
              : 'Success';
            attemptDetails += `\n    Result: ✓ ${result}${typeof executionResult.result === 'string' && executionResult.result.length > 100 ? '...' : ''}`;
          }
        } else {
          const error = executionResult.error || 'Unknown error';
          attemptDetails += `\n    Result: ✗ ${error}`;
        }
      }
      
      return attemptDetails;
    } catch (error) {
      return `  Attempt ${attemptNumber}: Error formatting log entry - ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Build fallback prompt when full prompt fails or is too long
   * @param stepName Current step name
   * @param schemaText JSON schema string
   * @returns Fallback prompt
   */
  private buildFallbackPrompt(stepName: string, schemaText: string): string {
    return FALLBACK_TEMPLATE
      .replace('{stepName}', stepName)
      .replace('{responseSchema}', schemaText);
  }
}
