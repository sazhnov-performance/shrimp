/**
 * Core prompt generation logic for AI automation agents
 */

import { ContextData } from '../ai-context-manager/types';
import { ContextualHistory, PromptContent } from './types';
import { 
  SYSTEM_TEMPLATE, 
  USER_TEMPLATE, 
  FALLBACK_SYSTEM_TEMPLATE, 
  FALLBACK_USER_TEMPLATE 
} from './templates';

export class PromptBuilder {
  private maxPromptLength: number;
  private contextTruncateLimit: number;

  constructor(maxPromptLength: number = 8000) {
    this.maxPromptLength = maxPromptLength;
    // Get truncation limit from environment variable, default to 1000
    const envValue = process.env.CONTEXT_TRUNCATE_RESULT;
    const parsedValue = envValue ? parseInt(envValue, 10) : 1000;
    this.contextTruncateLimit = isNaN(parsedValue) ? 1000 : parsedValue;
  }

  /**
   * Truncate text with informative message if needed
   * @param text Text to potentially truncate
   * @param limit Maximum character limit
   * @returns Truncated text with message if truncation occurred
   */
  private truncateWithMessage(text: string, limit: number): string {
    if (!text || text.length <= limit) {
      return text;
    }
    
    const truncated = text.substring(0, limit);
    const message = `Value is truncated, shown ${limit} out of ${text.length} characters`;
    return `${truncated}\n\n[${message}]`;
  }

  /**
   * Build system and user messages separately (new approach)
   * @param context Execution context data
   * @param stepId Current step index
   * @param schema JSON schema for AI responses
   * @returns Object with system and user message content
   */
  buildMessages(context: ContextData, stepId: number, schema: object): PromptContent {
    try {
      const stepName = context.steps[stepId] || 'Unknown Step';
      const history = this.formatExecutionHistory(context, stepId);
      const schemaText = JSON.stringify(schema, null, 2);
      
      // Build system message (instructions, rules, capabilities)
      const systemMessage = SYSTEM_TEMPLATE
        .replace('{responseSchema}', schemaText);
      
      // Build user message (current context and request)
      const userMessage = USER_TEMPLATE
        .replace('{sessionId}', context.contextId)
        .replace('{stepNumber}', (stepId + 1).toString())
        .replace('{totalSteps}', context.steps.length.toString())
        .replace('{stepName}', stepName)
        .replace('{currentStepName}', stepName)
        .replace('{contextualHistory}', history);
      
      // Check total length - let context manager handle DOM truncation
      const totalLength = systemMessage.length + userMessage.length;
      if (totalLength > this.maxPromptLength) {
        return this.buildFallbackMessages(stepName, '{"type": "object", "required": ["reasoning", "confidence", "flowControl"]}');
      }

      return {
        system: systemMessage,
        user: userMessage
      };
    } catch (error) {
      // Fallback to basic messages if building fails
      const stepName = context.steps[stepId] || 'Unknown Step';
      const schemaText = JSON.stringify(schema, null, 2);
      return this.buildFallbackMessages(stepName, schemaText);
    }
  }

  /**
   * Build complete prompt with context, schema, and step information (legacy method)
   * @param context Execution context data
   * @param stepId Current step index
   * @param schema JSON schema for AI responses
   * @returns Formatted prompt string
   */
  buildPrompt(context: ContextData, stepId: number, schema: object): string {
    try {
      // Use the new buildMessages method and combine for backward compatibility
      const messages = this.buildMessages(context, stepId, schema);
      const prompt = `${messages.system}\n\n---\n\n${messages.user}`;

      // Check prompt length - let context manager handle DOM truncation
      if (prompt.length > this.maxPromptLength) {
        const stepName = context.steps[stepId] || 'Unknown Step';
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
        
        // Handle both numeric and string confidence in legacy format
        let legacyConfidence: string;
        if (typeof log?.confidence === 'number') {
          if (log.confidence >= 80) {
            legacyConfidence = 'HIGH';
          } else if (log.confidence >= 50) {
            legacyConfidence = 'MEDIUM';
          } else {
            legacyConfidence = 'LOW';
          }
        } else {
          legacyConfidence = log?.confidence || 'LOW';
        }
        
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
              let result: string;
              if (typeof executionResult.result === 'string') {
                if (legacyAction === 'GET_TEXT') {
                  // For GET_TEXT: apply environment-configured truncation with message
                  result = this.truncateWithMessage(executionResult.result, this.contextTruncateLimit);
                } else {
                  // For other commands: use original 100-character truncation
                  result = executionResult.result.substring(0, 100);
                  if (executionResult.result.length > 100) {
                    result += '...';
                  }
                }
              } else {
                result = 'Success';
              }
              legacyAttemptDetails += `\n    Result: ✓ ${result}`;
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
      
      // Handle both numeric confidence (90) and string confidence ('HIGH')
      let confidence: string;
      if (typeof aiResponse?.confidence === 'number') {
        // Convert numeric confidence to string representation
        if (aiResponse.confidence >= 80) {
          confidence = 'HIGH';
        } else if (aiResponse.confidence >= 50) {
          confidence = 'MEDIUM';
        } else {
          confidence = 'LOW';
        }
      } else {
        confidence = aiResponse?.confidence || 'LOW';
      }
      
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
            let result: string;
            if (typeof executionResult.result === 'string') {
              if (action === 'GET_TEXT') {
                // For GET_TEXT: apply environment-configured truncation with message
                result = this.truncateWithMessage(executionResult.result, this.contextTruncateLimit);
              } else {
                // For other commands: use original 100-character truncation
                result = executionResult.result.substring(0, 100);
                if (executionResult.result.length > 100) {
                  result += '...';
                }
              }
            } else {
              result = 'Success';
            }
            attemptDetails += `\n    Result: ✓ ${result}`;
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
    const fallbackMessages = this.buildFallbackMessages(stepName, schemaText);
    return `${fallbackMessages.system}\n\n---\n\n${fallbackMessages.user}`;
  }

  /**
   * Build fallback system and user messages when main building fails
   * @param stepName Current step name
   * @param schemaText JSON schema as string
   * @returns Fallback PromptContent
   */
  private buildFallbackMessages(stepName: string, schemaText: string): PromptContent {
    const systemMessage = FALLBACK_SYSTEM_TEMPLATE
      .replace('{responseSchema}', schemaText);
    
    const userMessage = FALLBACK_USER_TEMPLATE
      .replace('{stepName}', stepName);
    
    return {
      system: systemMessage,
      user: userMessage
    };
  }
}
