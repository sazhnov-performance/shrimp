/**
 * UI Automation Interface Module Exports
 * Provides clean imports for the automation interface components
 */

export { UIAutomationInterface } from './UIAutomationInterface';
export { StepInputComponent } from './StepInputComponent';
export { StreamingOutputComponent } from './StreamingOutputComponent';
export { FrontendAPIIntegration, buildExecuteRequest, validateStepInput } from './api-integration';
export { formatLogEntry, getLevelColor, getLevelBgColor } from './log-formatter';
export * from './types';
