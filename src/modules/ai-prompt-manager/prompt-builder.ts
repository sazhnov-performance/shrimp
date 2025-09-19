/**
 * Core prompt generation logic for AI automation agents
 */

import { ContextData } from '../ai-context-manager/types';
import { ContextualHistory, PromptContent } from './types';
import { 
  SYSTEM_TEMPLATE, 
  USER_TEMPLATE
} from './templates';

export class PromptBuilder {
  private maxPromptLength: number;
  private contextTruncateLimit: number;
  private contextHistoryLimit: number;

  constructor(maxPromptLength?: number) {
    // Get max prompt length from environment variable, default to 8000
    const maxPromptEnvValue = process.env.MAX_PROMPT_LENGTH;
    const maxPromptParsedValue = maxPromptEnvValue ? parseInt(maxPromptEnvValue, 10) : 8000;
    this.maxPromptLength = maxPromptLength ?? (isNaN(maxPromptParsedValue) ? 8000 : maxPromptParsedValue);
    
    // Get truncation limit from environment variable, default to 1000
    const envValue = process.env.CONTEXT_TRUNCATE_RESULT;
    const parsedValue = envValue ? parseInt(envValue, 10) : 1000;
    this.contextTruncateLimit = isNaN(parsedValue) ? 1000 : parsedValue;
    
    // Get history limit from environment variable, default to 2000 characters
    const historyEnvValue = process.env.CONTEXT_HISTORY_LIMIT;
    const historyParsedValue = historyEnvValue ? parseInt(historyEnvValue, 10) : 2000;
    this.contextHistoryLimit = isNaN(historyParsedValue) ? 2000 : historyParsedValue;
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
      const currentPageState = this.formatCurrentPageState(context, stepId);
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
        .replace('{currentPageState}', currentPageState)
        .replace('{contextualHistory}', history);
      
      // Check total length and apply progressive truncation if needed
      const totalLength = systemMessage.length + userMessage.length;
      if (totalLength > this.maxPromptLength) {
        // Calculate how much space we need to free up
        const excessLength = totalLength - this.maxPromptLength;
        const historyLength = history.length;
        
        // Only reduce history if it's actually large enough to make a difference
        if (historyLength > excessLength + 500) { // Keep some buffer
          // Calculate target history length that would fit within limits
          const targetHistoryLength = Math.max(500, historyLength - excessLength - 200); // Reserve 200 chars buffer
          
          // Temporarily reduce history limit for this specific truncation
          const originalLimit = this.contextHistoryLimit;
          this.contextHistoryLimit = Math.min(originalLimit, targetHistoryLength);
          
          const reducedHistory = this.formatExecutionHistory(context, stepId);
          const userMessageReduced = USER_TEMPLATE
            .replace('{sessionId}', context.contextId)
            .replace('{stepNumber}', (stepId + 1).toString())
            .replace('{totalSteps}', context.steps.length.toString())
            .replace('{stepName}', stepName)
            .replace('{currentStepName}', stepName)
            .replace('{currentPageState}', currentPageState)
            .replace('{contextualHistory}', reducedHistory);
          
          // Restore original limit
          this.contextHistoryLimit = originalLimit;
          
          // If still too long after intelligent reduction, use minimal history
          const reducedTotalLength = systemMessage.length + userMessageReduced.length;
          if (reducedTotalLength > this.maxPromptLength) {
            const minimalHistory = 'History truncated due to length limits.';
            const userMessageMinimal = USER_TEMPLATE
              .replace('{sessionId}', context.contextId)
              .replace('{stepNumber}', (stepId + 1).toString())
              .replace('{totalSteps}', context.steps.length.toString())
              .replace('{stepName}', stepName)
              .replace('{currentStepName}', stepName)
              .replace('{currentPageState}', currentPageState)
              .replace('{contextualHistory}', minimalHistory);
            
            return {
              system: systemMessage,
              user: userMessageMinimal
            };
          }
          
          return {
            system: systemMessage,
            user: userMessageReduced
          };
        } else {
          // History is not the problem, just use minimal history
          const minimalHistory = 'History truncated due to length limits.';
          const userMessageMinimal = USER_TEMPLATE
            .replace('{sessionId}', context.contextId)
            .replace('{stepNumber}', (stepId + 1).toString())
            .replace('{totalSteps}', context.steps.length.toString())
            .replace('{stepName}', stepName)
            .replace('{currentStepName}', stepName)
            .replace('{currentPageState}', currentPageState)
            .replace('{contextualHistory}', minimalHistory);
          
          return {
            system: systemMessage,
            user: userMessageMinimal
          };
        }
      }

      return {
        system: systemMessage,
        user: userMessage
      };
    } catch (error) {
      // Use main templates with minimal context if building fails
      const stepName = context.steps?.[stepId] || 'Unknown Step';
      const schemaText = JSON.stringify(schema, null, 2);
      const sessionId = context.contextId || 'unknown-session';
      const totalSteps = context.steps?.length || 1;
      
      const systemMessage = SYSTEM_TEMPLATE.replace('{responseSchema}', schemaText);
      const userMessage = USER_TEMPLATE
        .replace('{sessionId}', sessionId)
        .replace('{stepNumber}', (stepId + 1).toString())
        .replace('{totalSteps}', totalSteps.toString())
        .replace('{stepName}', stepName)
        .replace('{currentStepName}', stepName)
        .replace('{currentPageState}', 'Error retrieving current page state')
        .replace('{contextualHistory}', 'Error retrieving execution history');
      
      return {
        system: systemMessage,
        user: userMessage
      };
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
      // Use the new buildMessages method which handles truncation internally
      const messages = this.buildMessages(context, stepId, schema);
      return `${messages.system}\n\n---\n\n${messages.user}`;
    } catch (error) {
      // Use main templates with minimal context if building fails
      const stepName = context.steps?.[stepId] || 'Unknown Step';
      const schemaText = JSON.stringify(schema, null, 2);
      const sessionId = context.contextId || 'unknown-session';
      const totalSteps = context.steps?.length || 1;
      
      const systemMessage = SYSTEM_TEMPLATE.replace('{responseSchema}', schemaText);
      const userMessage = USER_TEMPLATE
        .replace('{sessionId}', sessionId)
        .replace('{stepNumber}', (stepId + 1).toString())
        .replace('{totalSteps}', totalSteps.toString())
        .replace('{stepName}', stepName)
        .replace('{currentStepName}', stepName)
        .replace('{currentPageState}', 'Error retrieving current page state')
        .replace('{contextualHistory}', 'Error retrieving execution history');
      
      return `${systemMessage}\n\n---\n\n${userMessage}`;
    }
  }

  /**
   * Smart truncation that preserves important content structure
   * @param history Full history string to truncate
   * @returns Intelligently truncated history
   */
  private smartTruncateHistory(history: string): string {
    try {
      // Strategy: Preserve the most recent content and important structure
      const targetLength = this.contextHistoryLimit;
      
      // Split history into sections to identify important parts
      const sections = history.split('\n\n');
      let truncatedHistory = '';
      let remainingLength = targetLength - 100; // Reserve space for truncation message
      
      // Always try to preserve current step attempts (most important)
      const currentStepIndex = sections.findIndex(section => section.includes('CURRENT STEP ATTEMPTS:'));
      if (currentStepIndex >= 0) {
        const currentStepSection = sections[currentStepIndex];
        if (currentStepSection.length <= remainingLength) {
          truncatedHistory = currentStepSection;
          remainingLength -= currentStepSection.length;
          sections.splice(currentStepIndex, 1); // Remove from consideration
        }
      }
      
      // Then try to add previous steps summary (working backwards for most recent)
      const previousStepsIndex = sections.findIndex(section => section.includes('PREVIOUS STEPS:'));
      if (previousStepsIndex >= 0 && remainingLength > 200) {
        const previousStepsSection = sections[previousStepsIndex];
        if (previousStepsSection.length <= remainingLength) {
          if (truncatedHistory) {
            truncatedHistory = previousStepsSection + '\n\n' + truncatedHistory;
          } else {
            truncatedHistory = previousStepsSection;
          }
          remainingLength -= previousStepsSection.length;
        } else {
          // Truncate previous steps section intelligently
          const lines = previousStepsSection.split('\n');
          let partialSection = lines[0] + '\n'; // Keep the header
          remainingLength -= partialSection.length;
          
          // Add as many recent lines as possible
          for (let i = lines.length - 1; i >= 1 && remainingLength > 0; i--) {
            const line = lines[i];
            if (line.length < remainingLength) {
              partialSection += line + '\n';
              remainingLength -= (line.length + 1);
            } else {
              break;
            }
          }
          
          if (truncatedHistory) {
            truncatedHistory = partialSection + '\n' + truncatedHistory;
          } else {
            truncatedHistory = partialSection;
          }
        }
      }
      
      // If still no content, take the last portion of history with better boundary detection
      if (!truncatedHistory) {
        const tailLength = Math.min(targetLength - 200, history.length);
        const tailHistory = history.substring(history.length - tailLength);
        
        // Find a good starting point (prefer start of a line that's not mid-sentence)
        let startIndex = 0;
        const lines = tailHistory.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          // Look for lines that start with recognizable patterns
          if (line.match(/^(PREVIOUS STEPS:|CURRENT STEP ATTEMPTS:|Step \d+:|Attempt \d+:|- )/)) {
            startIndex = tailHistory.indexOf(lines[i]);
            break;
          }
        }
        
        truncatedHistory = tailHistory.substring(startIndex);
      }
      
      // Add truncation message
      const originalLength = history.length;
      const truncatedLength = truncatedHistory.length;
      const message = `History truncated due to length limits. Showing ${truncatedLength} of ${originalLength} characters (most recent content preserved).\n\n`;
      
      return message + truncatedHistory;
    } catch (error) {
      // Fallback to simple tail truncation if smart truncation fails
      const simpleLimit = Math.max(500, this.contextHistoryLimit - 200);
      const simpleTail = history.substring(history.length - simpleLimit);
      return `History truncated due to length limits.\n\n${simpleTail}`;
    }
  }

  /**
   * Format current page state - preserve original JSON structure as-is
   * @param context Execution context data
   * @param currentStepId Current step index
   * @returns Current page state as JSON string
   */
  private formatCurrentPageState(context: ContextData, currentStepId: number): string {
    try {
      // Find the latest screenshot description across all steps up to and including current step
      let latestScreenshot: any = null;
      let latestTimestamp: Date | null = null;
      
      for (let stepId = 0; stepId <= currentStepId; stepId++) {
        const stepScreenshots = context.screenshotDescriptions?.[stepId] || [];
        for (const screenshot of stepScreenshots) {
          if (!latestTimestamp || screenshot.timestamp > latestTimestamp) {
            latestScreenshot = screenshot;
            latestTimestamp = screenshot.timestamp;
          }
        }
      }
      
      if (!latestScreenshot) {
        return 'No screenshot data available';
      }
      
      // Return the screenshot analysis as pure JSON to preserve original structure
      // This maintains the AI analysis format exactly as it came from the AI
      const pageStateJson = {
        overallDescription: latestScreenshot.description,
        interactibleElements: latestScreenshot.interactibleElements || []
      };
      
      return JSON.stringify(pageStateJson, null, 2);
    } catch (error) {
      return 'Error retrieving current page state';
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

      // Format previous steps summary - ACTION HISTORY ONLY, NO SCREENSHOT ANALYSIS
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
          
          // REMOVED: Screenshot descriptions should NOT be in execution history
          // History should only contain actions taken, not screenshot analysis
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


      // Apply intelligent truncation if history exceeds the limit
      if (history.length > this.contextHistoryLimit) {
        return this.smartTruncateHistory(history);
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


}
