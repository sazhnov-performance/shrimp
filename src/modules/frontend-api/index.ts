/**
 * Simplified Frontend API Module
 * Exports only the essential functionality for the automation system
 */

export { 
  SimplifiedFrontendAPI, 
  createSimplifiedFrontendAPI,
  DEFAULT_CONFIG
} from './server';

export type { SimplifiedFrontendAPIConfig } from './server';

// Re-export for backward compatibility if needed
export { SimplifiedFrontendAPI as FrontendAPIServer } from './server';
export type { SimplifiedFrontendAPIConfig as FrontendAPIServerConfig } from './server';
export { createSimplifiedFrontendAPI as createFrontendAPIServer } from './server';
