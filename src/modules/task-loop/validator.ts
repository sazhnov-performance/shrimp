/**
 * Task Loop AI Response Validator
 * Validates AI responses against the expected schema
 */

import { AIResponse, TaskLoopError, TaskLoopErrorType } from './types';

/**
 * Validates AI response data against the expected schema
 * @param data Raw response data from AI Integration
 * @param sessionId Session identifier for error context
 * @param stepId Step identifier for error context
 * @returns Validated AIResponse object
 * @throws TaskLoopError if validation fails
 */
export function validateAIResponse(
  data: any, 
  sessionId: string, 
  stepId: number
): AIResponse {
  if (!data || typeof data !== 'object') {
    throw createValidationError(
      'Response data is not an object',
      sessionId,
      stepId,
      { receivedType: typeof data, receivedData: data }
    );
  }

  // Validate required fields
  validateRequiredFields(data, sessionId, stepId);
  
  // Validate reasoning field
  validateReasoning(data.reasoning, sessionId, stepId);
  
  // Validate confidence field
  validateConfidence(data.confidence, sessionId, stepId);
  
  // Validate flowControl field
  validateFlowControl(data.flowControl, sessionId, stepId);
  
  // Validate action field (if present)
  if (data.action !== undefined) {
    validateAction(data.action, sessionId, stepId);
  }

  // Check if action is required but missing
  if (data.flowControl === 'continue' && !data.action) {
    throw createValidationError(
      'Action is required when flowControl is "continue"',
      sessionId,
      stepId,
      { flowControl: data.flowControl, hasAction: false }
    );
  }

  return {
    reasoning: data.reasoning,
    confidence: data.confidence,
    flowControl: data.flowControl,
    ...(data.action && { action: data.action })
  };
}

/**
 * Validates that all required fields are present
 */
function validateRequiredFields(data: any, sessionId: string, stepId: number): void {
  const requiredFields = ['reasoning', 'confidence', 'flowControl'];
  const missingFields = requiredFields.filter(field => !(field in data));
  
  if (missingFields.length > 0) {
    throw createValidationError(
      `Missing required fields: ${missingFields.join(', ')}`,
      sessionId,
      stepId,
      { missingFields, receivedFields: Object.keys(data) }
    );
  }
}

/**
 * Validates the reasoning field
 */
function validateReasoning(reasoning: any, sessionId: string, stepId: number): void {
  if (typeof reasoning !== 'string') {
    throw createValidationError(
      'Reasoning field must be a string',
      sessionId,
      stepId,
      { receivedType: typeof reasoning, receivedValue: reasoning }
    );
  }

  if (reasoning.trim().length === 0) {
    throw createValidationError(
      'Reasoning field cannot be empty',
      sessionId,
      stepId,
      { receivedValue: reasoning }
    );
  }

  // Check for reasonable reasoning length
  if (reasoning.length > 5000) {
    throw createValidationError(
      'Reasoning field is too long (max 5000 characters)',
      sessionId,
      stepId,
      { receivedLength: reasoning.length, maxLength: 5000 }
    );
  }
}

/**
 * Validates the confidence field
 */
function validateConfidence(confidence: any, sessionId: string, stepId: number): void {
  if (!Number.isInteger(confidence)) {
    throw createValidationError(
      'Confidence field must be an integer',
      sessionId,
      stepId,
      { receivedType: typeof confidence, receivedValue: confidence }
    );
  }

  if (confidence < 0 || confidence > 100) {
    throw createValidationError(
      'Confidence field must be between 0 and 100',
      sessionId,
      stepId,
      { receivedValue: confidence, validRange: [0, 100] }
    );
  }
}

/**
 * Validates the flowControl field
 */
function validateFlowControl(flowControl: any, sessionId: string, stepId: number): void {
  const validValues = ['continue', 'stop_success', 'stop_failure'];
  
  if (typeof flowControl !== 'string') {
    throw createValidationError(
      'FlowControl field must be a string',
      sessionId,
      stepId,
      { receivedType: typeof flowControl, receivedValue: flowControl }
    );
  }

  if (!validValues.includes(flowControl)) {
    throw createValidationError(
      `FlowControl field must be one of: ${validValues.join(', ')}`,
      sessionId,
      stepId,
      { receivedValue: flowControl, validValues }
    );
  }
}

/**
 * Validates the action field
 */
function validateAction(action: any, sessionId: string, stepId: number): void {
  if (!action || typeof action !== 'object') {
    throw createValidationError(
      'Action field must be an object',
      sessionId,
      stepId,
      { receivedType: typeof action, receivedValue: action }
    );
  }

  // Validate required action fields
  if (!('command' in action) || !('parameters' in action)) {
    throw createValidationError(
      'Action must have "command" and "parameters" fields',
      sessionId,
      stepId,
      { receivedFields: Object.keys(action) }
    );
  }

  // Validate command field
  if (typeof action.command !== 'string') {
    throw createValidationError(
      'Action command must be a string',
      sessionId,
      stepId,
      { receivedType: typeof action.command, receivedValue: action.command }
    );
  }

  // Validate known commands
  const validCommands = ['OPEN_PAGE', 'CLICK_ELEMENT', 'INPUT_TEXT', 'GET_SUBDOM'];
  if (!validCommands.includes(action.command)) {
    throw createValidationError(
      `Unknown command: ${action.command}. Valid commands: ${validCommands.join(', ')}`,
      sessionId,
      stepId,
      { receivedCommand: action.command, validCommands }
    );
  }

  // Validate parameters field
  if (!action.parameters || typeof action.parameters !== 'object') {
    throw createValidationError(
      'Action parameters must be an object',
      sessionId,
      stepId,
      { receivedType: typeof action.parameters, receivedValue: action.parameters }
    );
  }
}

/**
 * Creates a standardized validation error
 */
function createValidationError(
  message: string,
  sessionId: string,
  stepId: number,
  details?: Record<string, any>
): TaskLoopError {
  const error = new Error(message) as TaskLoopError;
  error.type = TaskLoopErrorType.VALIDATION_FAILED;
  error.sessionId = sessionId;
  error.stepId = stepId;
  error.details = details;
  error.name = 'TaskLoopValidationError';
  
  return error;
}
