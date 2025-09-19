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
  data: unknown, 
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
  
  // Validate confidence field (and normalize if numeric)
  const normalizedConfidence = validateConfidence(data.confidence, sessionId, stepId);
  
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
    confidence: normalizedConfidence,
    flowControl: data.flowControl,
    ...(data.action && { action: data.action })
  };
}

/**
 * Validates that all required fields are present
 */
function validateRequiredFields(data: unknown, sessionId: string, stepId: number): void {
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
function validateReasoning(reasoning: unknown, sessionId: string, stepId: number): void {
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
function validateConfidence(confidence: unknown, sessionId: string, stepId: number): string {
  // Handle numeric confidence values from AI (convert to string enum)
  if (typeof confidence === 'number') {
    if (confidence >= 80) {
      return 'HIGH';
    } else if (confidence >= 50) {
      return 'MEDIUM';
    } else {
      return 'LOW';
    }
  }
  
  if (typeof confidence !== 'string') {
    throw createValidationError(
      'Confidence field must be a string or number',
      sessionId,
      stepId,
      { receivedType: typeof confidence, receivedValue: confidence }
    );
  }

  const validValues = ['LOW', 'MEDIUM', 'HIGH'];
  
  if (!validValues.includes(confidence)) {
    throw createValidationError(
      `Confidence field must be one of: ${validValues.join(', ')}`,
      sessionId,
      stepId,
      { receivedValue: confidence, validValues }
    );
  }
  
  return confidence;
}

/**
 * Validates the flowControl field
 */
function validateFlowControl(flowControl: unknown, sessionId: string, stepId: number): void {
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
function validateAction(action: unknown, sessionId: string, stepId: number): void {
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
  const validCommands = ['OPEN_PAGE', 'CLICK_ELEMENT', 'INPUT_TEXT', 'SAVE_VARIABLE', 'GET_DOM', 'GET_CONTENT', 'GET_SUBDOM', 'GET_TEXT'];
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

  // Validate command-specific parameters
  validateCommandParameters(action.command, action.parameters, sessionId, stepId);
}

/**
 * Validates command-specific parameters
 */
function validateCommandParameters(
  command: string, 
  parameters: Record<string, unknown>, 
  sessionId: string, 
  stepId: number
): void {
  switch (command) {
    case 'OPEN_PAGE':
      if (!parameters.url || typeof parameters.url !== 'string') {
        throw createValidationError(
          'OPEN_PAGE command requires a valid "url" parameter (string)',
          sessionId,
          stepId,
          { command, receivedParameters: parameters }
        );
      }
      break;

    case 'CLICK_ELEMENT':
      if (!parameters.selector || typeof parameters.selector !== 'string') {
        throw createValidationError(
          'CLICK_ELEMENT command requires a valid "selector" parameter (string)',
          sessionId,
          stepId,
          { command, receivedParameters: parameters }
        );
      }
      break;

    case 'INPUT_TEXT':
      if (!parameters.selector || typeof parameters.selector !== 'string') {
        throw createValidationError(
          'INPUT_TEXT command requires a valid "selector" parameter (string)',
          sessionId,
          stepId,
          { command, receivedParameters: parameters }
        );
      }
      if (!parameters.text || typeof parameters.text !== 'string') {
        throw createValidationError(
          'INPUT_TEXT command requires a valid "text" parameter (string)',
          sessionId,
          stepId,
          { command, receivedParameters: parameters }
        );
      }
      break;

    case 'SAVE_VARIABLE':
      if (!parameters.selector || typeof parameters.selector !== 'string') {
        throw createValidationError(
          'SAVE_VARIABLE command requires a valid "selector" parameter (string)',
          sessionId,
          stepId,
          { command, receivedParameters: parameters }
        );
      }
      if (!parameters.variableName || typeof parameters.variableName !== 'string') {
        throw createValidationError(
          'SAVE_VARIABLE command requires a valid "variableName" parameter (string)',
          sessionId,
          stepId,
          { command, receivedParameters: parameters }
        );
      }
      break;

    case 'GET_DOM':
      // GET_DOM has no required parameters
      break;

    case 'GET_CONTENT':
      if (!parameters.selector || typeof parameters.selector !== 'string') {
        throw createValidationError(
          'GET_CONTENT command requires a valid "selector" parameter (string)',
          sessionId,
          stepId,
          { command, receivedParameters: parameters }
        );
      }
      // attribute and multiple are optional parameters
      if (parameters.attribute !== undefined && typeof parameters.attribute !== 'string') {
        throw createValidationError(
          'GET_CONTENT command "attribute" parameter must be a string if provided',
          sessionId,
          stepId,
          { command, receivedParameters: parameters }
        );
      }
      if (parameters.multiple !== undefined && typeof parameters.multiple !== 'boolean') {
        throw createValidationError(
          'GET_CONTENT command "multiple" parameter must be a boolean if provided',
          sessionId,
          stepId,
          { command, receivedParameters: parameters }
        );
      }
      break;

    case 'GET_SUBDOM':
      if (!parameters.selector || typeof parameters.selector !== 'string') {
        throw createValidationError(
          'GET_SUBDOM command requires a valid "selector" parameter (string)',
          sessionId,
          stepId,
          { command, receivedParameters: parameters }
        );
      }
      // maxDomSize is optional parameter
      if (parameters.maxDomSize !== undefined && typeof parameters.maxDomSize !== 'number') {
        throw createValidationError(
          'GET_SUBDOM command "maxDomSize" parameter must be a number if provided',
          sessionId,
          stepId,
          { command, receivedParameters: parameters }
        );
      }
      break;

    case 'GET_TEXT':
      if (!parameters.selector || typeof parameters.selector !== 'string') {
        throw createValidationError(
          'GET_TEXT command requires a valid "selector" parameter (string)',
          sessionId,
          stepId,
          { command, receivedParameters: parameters }
        );
      }
      break;

    default:
      // This should not happen as command validation is done earlier
      throw createValidationError(
        `Unknown command for parameter validation: ${command}`,
        sessionId,
        stepId,
        { command, receivedParameters: parameters }
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
  details?: Record<string, unknown>
): TaskLoopError {
  const error = new Error(message) as TaskLoopError;
  error.type = TaskLoopErrorType.VALIDATION_FAILED;
  error.sessionId = sessionId;
  error.stepId = stepId;
  error.details = details;
  error.name = 'TaskLoopValidationError';
  
  return error;
}
