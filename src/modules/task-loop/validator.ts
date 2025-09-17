/**
 * Task Loop AI Response Validator
 * Validates AI responses against the expected schema
 * Based on design/task-loop.md specifications
 */

import { AIResponse, ValidationError } from './types';
import { VALIDATION, ERROR_MESSAGES } from './config';

/**
 * Validates an AI response object against the expected schema
 * @param data Raw data from AI response
 * @param sessionId Session ID for error context
 * @param stepId Step ID for error context
 * @returns Validated AIResponse object
 * @throws ValidationError if validation fails
 */
export function validateAIResponse(
  data: any, 
  sessionId?: string, 
  stepId?: number
): AIResponse {
  if (!data || typeof data !== 'object') {
    throw new ValidationError(
      'AI response must be an object',
      sessionId,
      stepId
    );
  }

  // Validate required fields
  for (const field of VALIDATION.REQUIRED_FIELDS) {
    if (!(field in data)) {
      throw new ValidationError(
        `Missing required field: ${field}`,
        sessionId,
        stepId
      );
    }
  }

  // Validate reasoning
  if (typeof data.reasoning !== 'string' || data.reasoning.trim().length === 0) {
    throw new ValidationError(
      'Reasoning must be a non-empty string',
      sessionId,
      stepId
    );
  }

  // Validate confidence
  if (typeof data.confidence !== 'number' || 
      data.confidence < VALIDATION.MIN_CONFIDENCE || 
      data.confidence > VALIDATION.MAX_CONFIDENCE) {
    throw new ValidationError(
      `Confidence must be a number between ${VALIDATION.MIN_CONFIDENCE} and ${VALIDATION.MAX_CONFIDENCE}`,
      sessionId,
      stepId
    );
  }

  // Validate flowControl
  if (!VALIDATION.VALID_FLOW_CONTROL_VALUES.includes(data.flowControl)) {
    throw new ValidationError(
      `flowControl must be one of: ${VALIDATION.VALID_FLOW_CONTROL_VALUES.join(', ')}`,
      sessionId,
      stepId
    );
  }

  // Validate action if flowControl is 'continue'
  if (data.flowControl === 'continue') {
    if (!data.action) {
      throw new ValidationError(
        'Action is required when flowControl is "continue"',
        sessionId,
        stepId
      );
    }

    if (!validateAction(data.action)) {
      throw new ValidationError(
        'Invalid action structure',
        sessionId,
        stepId
      );
    }
  }

  // Return validated response
  return {
    action: data.action,
    reasoning: data.reasoning,
    confidence: data.confidence,
    flowControl: data.flowControl
  };
}

/**
 * Validates the action portion of an AI response
 * @param action Action object to validate
 * @returns true if valid, false otherwise
 */
function validateAction(action: any): boolean {
  if (!action || typeof action !== 'object') {
    return false;
  }

  // Check required fields
  if (typeof action.command !== 'string' || action.command.trim().length === 0) {
    return false;
  }

  if (!action.parameters || typeof action.parameters !== 'object') {
    return false;
  }

  return true;
}

/**
 * Validates that the data conforms to the schema structure
 * This is a more detailed validation that could use a JSON schema library
 * @param data Data to validate
 * @param schema Schema object (from AI Schema Manager)
 * @returns true if valid, false otherwise
 */
export function validateAgainstSchema(data: any, schema: object): boolean {
  // For now, this is a placeholder implementation
  // In a full implementation, this would use a JSON schema validation library
  // like ajv or joi to validate against the schema from AI Schema Manager
  
  try {
    validateAIResponse(data);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Sanitizes and normalizes an AI response
 * @param response Raw AI response
 * @returns Sanitized response
 */
export function sanitizeAIResponse(response: any): any {
  if (!response || typeof response !== 'object') {
    return response;
  }

  const sanitized = { ...response };

  // Trim reasoning string
  if (typeof sanitized.reasoning === 'string') {
    sanitized.reasoning = sanitized.reasoning.trim();
  }

  // Ensure confidence is a number
  if (typeof sanitized.confidence === 'string') {
    const parsed = parseFloat(sanitized.confidence);
    if (!isNaN(parsed)) {
      sanitized.confidence = parsed;
    }
  }

  // Ensure flowControl is lowercase
  if (typeof sanitized.flowControl === 'string') {
    sanitized.flowControl = sanitized.flowControl.toLowerCase();
  }

  return sanitized;
}
