/**
 * Frontend API Module
 * Main entry point for the Frontend API module
 * 
 * This module provides a REST API and WebSocket/SSE endpoints for real-time communication
 * with the automation system. It serves as the integration layer between the UI and backend modules.
 */

// Main Frontend API class
export { FrontendAPI } from './frontend-api';

// Session management
export { FrontendAPISessionManager } from './session-manager';

// Error handling
export { FrontendAPIErrorHandler } from './error-handler';

// API implementations
export { StepProcessorAPIImpl } from './api/step-processor-api';
export { SessionManagementAPIImpl } from './api/session-management-api';
export { StreamingAPIImpl } from './api/streaming-api';

// Real-time streaming
export { RealtimeStreamingAPIImpl } from './streaming/realtime-streaming-api';

// Middleware
export { AuthenticationMiddlewareImpl } from './middleware/authentication-middleware';
export { ValidationMiddlewareImpl } from './middleware/validation-middleware';
export { RateLimitMiddlewareImpl } from './middleware/rate-limit-middleware';

// Types and interfaces
export * from './types';

// Re-export commonly used shared types
export {
  SessionStatus,
  StreamEvent,
  StreamEventType,
  APIResponse,
  APIError,
  StandardError,
  ExecutionProgress
} from '../../types/shared-types';

/**
 * Factory function to create a configured Frontend API instance
 */
import { FrontendAPI } from './frontend-api';
import { FrontendAPIConfig, DEFAULT_FRONTEND_API_CONFIG } from './types';

export function createFrontendAPI(config?: Partial<FrontendAPIConfig>): FrontendAPI {
  const mergedConfig = {
    ...DEFAULT_FRONTEND_API_CONFIG,
    ...config
  };
  
  return new FrontendAPI(mergedConfig);
}

/**
 * Version information
 */
export const FRONTEND_API_VERSION = '1.0.0';

/**
 * Module metadata for dependency injection and module registration
 */
export const FRONTEND_API_MODULE_INFO = {
  moduleId: 'frontend-api',
  version: FRONTEND_API_VERSION,
  dependencies: [
    'IStepProcessor',
    'IExecutorStreamer', 
    'IExecutorStreamerManager',
    'SessionCoordinator',
    'ITaskLoop',
    'IAIIntegration',
    'IAIContextManager'
  ],
  interfaces: [
    'IFrontendAPI'
  ],
  description: 'REST API and WebSocket/SSE endpoints for UI communication'
} as const;
