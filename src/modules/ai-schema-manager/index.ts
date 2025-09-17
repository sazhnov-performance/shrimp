/**
 * AI Schema Manager Module
 * Main interface implementation
 * Based on design/ai-schema-manager.md specifications
 */

import { IAISchemaManager } from '../../../types/ai-schema-manager-types';
import { AISchemaManager } from './schemas';

// Export the main implementation
export { AISchemaManager };

// Export the interface
export type { IAISchemaManager };

// Export additional types that might be useful for consumers
export type {
  AIResponseSchema,
  ExecutorActionSchema,
  AIResponseData,
  ExecutorAction,
  FlowControlOption,
  ExecutorCommand
} from '../../../types/ai-schema-manager-types';

// Factory function for creating AI Schema Manager instances
export function createAISchemaManager(): IAISchemaManager {
  return new AISchemaManager();
}

// Default export
export default AISchemaManager;
