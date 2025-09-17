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

      // Check prompt length and truncate if necessary
      if (prompt.length > this.maxPromptLength) {
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
        currentStepLogs.slice(-5).forEach((log, index) => { // Show last 5 attempts
          const attempt = this.formatLogEntry(log, index + 1);
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
    
    // Check for success/failure indicators in the log
    if (lastLog?.flowControl === 'stop_success') {
      return 'success';
    } else if (lastLog?.flowControl === 'stop_failure') {
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
    
    if (lastLog?.reasoning) {
      // Truncate reasoning to keep summary concise
      const reasoning = lastLog.reasoning.substring(0, 100);
      return `${actionCount} action(s) taken. Last: ${reasoning}${reasoning.length >= 100 ? '...' : ''}`;
    }

    return `${actionCount} action(s) taken`;
  }

  /**
   * Format a single log entry for history display
   * @param log Log entry
   * @param attemptNumber Attempt number
   * @returns Formatted log string
   */
  private formatLogEntry(log: any, attemptNumber: number): string {
    try {
      const action = log?.action?.command || 'Unknown';
      const reasoning = log?.reasoning ? log.reasoning.substring(0, 80) : 'No reasoning provided';
      const confidence = log?.confidence || 0;
      
      return `  Attempt ${attemptNumber}: ${action} (Confidence: ${confidence}%) - ${reasoning}${reasoning.length >= 80 ? '...' : ''}`;
    } catch (error) {
      return `  Attempt ${attemptNumber}: Error formatting log entry`;
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
