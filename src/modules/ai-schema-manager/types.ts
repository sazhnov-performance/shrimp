/**
 * AI Schema Manager Type Definitions
 * Based on design/ai-schema-manager.md specifications
 */

import { 
  CommandAction, 
  CommandParameters,
  DecisionAction,
  BaseModuleConfig,
  LoggingConfig,
  PerformanceConfig,
  TimeoutConfig
} from '../../../types/shared-types';

// Configuration Types
export interface AISchemaManagerConfig extends BaseModuleConfig {
  moduleId: 'ai-schema-manager';
  
  // AI Schema Manager specific configuration
  schema: {
    version: string;
    defaultOptions: SchemaOptions;
    cacheEnabled: boolean;
    validationMode: 'strict' | 'lenient';
    reasoningRequired: boolean;
    screenshotAnalysisConfig: ScreenshotAnalysisConfig;
  };
  
  // Inherits from BaseModuleConfig:
  // - logging: LoggingConfig
  // - performance: PerformanceConfig
  // - timeouts: TimeoutConfig
}

export interface ScreenshotAnalysisConfig {
  enableCoordinateValidation: boolean;
  requireConfidenceScores: boolean;
  minConfidenceThreshold: number;
  maxBoundingBoxSize: number;
  enableAccessibilityValidation: boolean;
  strictElementDetection: boolean;
  cacheAnalysisSchemas: boolean;
}

// Schema Options
export interface SchemaOptions {
  includeOptionalFields?: boolean;
  requireReasoning?: boolean;
  validationMode?: 'strict' | 'lenient';
}

export interface ScreenshotSchemaOptions {
  includeCoordinates?: boolean;
  includeConfidenceScores?: boolean;
  requireDetectedElements?: boolean;
  includeAccessibilityInfo?: boolean;
  validationMode?: 'strict' | 'lenient';
}

export interface ComparisonSchemaOptions {
  includePixelDifferences?: boolean;
  includeSimilarityScore?: boolean;
  requireChangeDescription?: boolean;
  includeCoordinates?: boolean;
  validationMode?: 'strict' | 'lenient';
}

// Screenshot Analysis Types
export enum ScreenshotAnalysisType {
  CONTENT_SUMMARY = 'CONTENT_SUMMARY',
  ELEMENT_DETECTION = 'ELEMENT_DETECTION',
  UI_STRUCTURE = 'UI_STRUCTURE',
  TEXT_EXTRACTION = 'TEXT_EXTRACTION',
  ACCESSIBILITY_AUDIT = 'ACCESSIBILITY_AUDIT',
  COMPARISON = 'COMPARISON'
}

// Schema Structure Types
export interface ResponseSchema {
  $schema: string;
  type: 'object';
  properties: {
    decision: DecisionSchema;
    reasoning: ReasoningSchema;
    command?: CommandSchema;  // UPDATED: Single optional command (not array)
    context?: ContextSchema;
  };
  required: string[];
  additionalProperties: boolean;
}

export interface DecisionSchema {
  type: 'object';
  properties: {
    action: ActionDecisionSchema;
    resultValidation?: ResultValidationSchema;
    message: StringSchema;
  };
  required: string[];
}

export interface ActionDecisionSchema {
  enum: ['PROCEED', 'RETRY', 'ABORT'];
  type: 'string';
  description: string;
}

export interface ResultValidationSchema {
  type: 'object';
  properties: {
    success: BooleanSchema;
    expectedElements: ArraySchema;
    actualState: StringSchema;
    issues?: ArraySchema;
  };
  required: string[];
}

export interface ReasoningSchema {
  type: 'object';
  properties: {
    analysis: StringSchema;
    rationale: StringSchema;
    expectedOutcome: StringSchema;
    alternatives?: StringSchema;
  };
  required: string[];
}

export interface CommandSchema {
  type: 'object';
  properties: {
    action: CommandActionSchema;
    parameters: CommandParametersSchema;
    reasoning?: { type: 'string'; description: 'Explanation for this specific command' };
  };
  required: ['action', 'parameters'];
  additionalProperties: false;
}

export interface ContextSchema {
  type: 'object';
  properties: Record<string, any>;
  additionalProperties: boolean;
}

// Command Schema Types
export interface CommandActionSchema {
  enum: CommandAction[];
  type: 'string';
  description: 'Type of automation command to execute';
}

export interface CommandParametersSchema {
  type: 'object';
  properties: {
    url: { 
      type: 'string'; 
      format: 'uri';
      description: 'URL to navigate to (OPEN_PAGE only)';
    };
    selector: { 
      type: 'string'; 
      minLength: 1;
      description: 'CSS selector for target element';
    };
    text: { 
      type: 'string';
      description: 'Text to input (INPUT_TEXT only)';
    };
    variableName: { 
      type: 'string'; 
      pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$';
      description: 'Variable name for stored value (SAVE_VARIABLE only)';
    };
    attribute?: {
      type: 'string';
      description: 'Attribute to extract (GET_CONTENT only)';
    };
    multiple?: {
      type: 'boolean';
      description: 'Return array of values from all matching elements (GET_CONTENT only)';
    };
    maxDomSize?: {
      type: 'number';
      minimum: 1000;
      maximum: 1000000;
      description: 'Maximum size of returned DOM in characters (GET_SUBDOM only)';
    };
  };
  additionalProperties: false;
}

// Command-specific schemas with proper parameter requirements
export interface AutomationCommandSchemas {
  OPEN_PAGE: {
    type: 'object';
    properties: {
      action: { const: 'OPEN_PAGE' };
      parameters: {
        type: 'object';
        properties: {
          url: { type: 'string'; format: 'uri' };
        };
        required: ['url'];
        additionalProperties: false;
      };
    };
    required: ['action', 'parameters'];
  };
  
  CLICK_ELEMENT: {
    type: 'object';
    properties: {
      action: { const: 'CLICK_ELEMENT' };
      parameters: {
        type: 'object';
        properties: {
          selector: { type: 'string'; minLength: 1 };
        };
        required: ['selector'];
        additionalProperties: false;
      };
    };
    required: ['action', 'parameters'];
  };
  
  INPUT_TEXT: {
    type: 'object';
    properties: {
      action: { const: 'INPUT_TEXT' };
      parameters: {
        type: 'object';
        properties: {
          selector: { type: 'string'; minLength: 1 };
          text: { type: 'string' };
        };
        required: ['selector', 'text'];
        additionalProperties: false;
      };
    };
    required: ['action', 'parameters'];
  };
  
  SAVE_VARIABLE: {
    type: 'object';
    properties: {
      action: { const: 'SAVE_VARIABLE' };
      parameters: {
        type: 'object';
        properties: {
          selector: { type: 'string'; minLength: 1 };
          variableName: { type: 'string'; pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$' };
        };
        required: ['selector', 'variableName'];
        additionalProperties: false;
      };
    };
    required: ['action', 'parameters'];
  };
  
  GET_DOM: {
    type: 'object';
    properties: {
      action: { const: 'GET_DOM' };
      parameters: {
        type: 'object';
        properties: {};
        additionalProperties: false;
      };
    };
    required: ['action', 'parameters'];
  };

  GET_CONTENT: {
    type: 'object';
    properties: {
      action: { const: 'GET_CONTENT' };
      parameters: {
        type: 'object';
        properties: {
          selector: { type: 'string'; minLength: 1 };
          attribute: { type: 'string' };
          multiple: { type: 'boolean' };
        };
        required: ['selector'];
        additionalProperties: false;
      };
    };
    required: ['action', 'parameters'];
  };

  GET_SUBDOM: {
    type: 'object';
    properties: {
      action: { const: 'GET_SUBDOM' };
      parameters: {
        type: 'object';
        properties: {
          selector: { type: 'string'; minLength: 1 };
          maxDomSize: { type: 'number'; minimum: 1000; maximum: 1000000 };
        };
        required: ['selector'];
        additionalProperties: false;
      };
    };
    required: ['action', 'parameters'];
  };
}

export interface ExecutorMethodSchemas {
  commands: AutomationCommandSchemas;
  parameters: CommandParametersSchema;
}

// Screenshot Analysis Schema Types
export interface ScreenshotAnalysisSchema {
  $schema: string;
  type: 'object';
  properties: {
    analysisType: AnalysisTypeSchema;
    summary: StringSchema;
    confidence: NumberSchema;
    visualElements?: VisualElementsSchema;
    textContent?: TextContentSchema;
    uiStructure?: UIStructureSchema;
    accessibility?: AccessibilitySchema;
    metadata?: MetadataSchema;
  };
  required: string[];
  additionalProperties: boolean;
}

export interface ScreenshotComparisonSchema {
  $schema: string;
  type: 'object';
  properties: {
    similarity: NumberSchema;
    differences: DifferencesSchema;
    summary: StringSchema;
    significantChanges: BooleanSchema;
    changeAreas?: ChangeAreasSchema;
    metadata?: MetadataSchema;
  };
  required: string[];
  additionalProperties: boolean;
}

export interface ScreenshotAnalysisSchemas {
  CONTENT_SUMMARY: ScreenshotAnalysisSchema;
  ELEMENT_DETECTION: ScreenshotAnalysisSchema;
  UI_STRUCTURE: ScreenshotAnalysisSchema;
  TEXT_EXTRACTION: ScreenshotAnalysisSchema;
  ACCESSIBILITY_AUDIT: ScreenshotAnalysisSchema;
  COMPARISON: ScreenshotComparisonSchema;
}

export interface AnalysisTypeSchema {
  enum: ['CONTENT_SUMMARY', 'ELEMENT_DETECTION', 'UI_STRUCTURE', 'TEXT_EXTRACTION', 'ACCESSIBILITY_AUDIT', 'COMPARISON'];
  type: 'string';
  description: 'Type of screenshot analysis performed';
}

export interface VisualElementsSchema {
  type: 'array';
  items: {
    type: 'object';
    properties: {
      type: StringSchema;
      confidence: NumberSchema;
      boundingBox: BoundingBoxSchema;
      attributes?: ObjectSchema;
      text?: StringSchema;
      interactable: BooleanSchema;
      selector?: StringSchema;
    };
    required: ['type', 'confidence', 'boundingBox', 'interactable'];
  };
}

export interface BoundingBoxSchema {
  type: 'object';
  properties: {
    x: { type: 'number'; minimum: 0 };
    y: { type: 'number'; minimum: 0 };
    width: { type: 'number'; minimum: 0 };
    height: { type: 'number'; minimum: 0 };
  };
  required: ['x', 'y', 'width', 'height'];
  additionalProperties: false;
}

export interface TextContentSchema {
  type: 'array';
  items: {
    type: 'object';
    properties: {
      content: StringSchema;
      type: {
        enum: ['heading', 'paragraph', 'link', 'button', 'label', 'error', 'success'];
        type: 'string';
      };
      boundingBox: BoundingBoxSchema;
      fontSize?: NumberSchema;
      fontWeight?: StringSchema;
      color?: StringSchema;
    };
    required: ['content', 'type', 'boundingBox'];
  };
}

export interface UIStructureSchema {
  type: 'object';
  properties: {
    layout: {
      enum: ['grid', 'flex', 'absolute', 'table', 'mixed'];
      type: 'string';
    };
    sections: {
      type: 'array';
      items: {
        type: 'object';
        properties: {
          type: {
            enum: ['header', 'footer', 'sidebar', 'main', 'content', 'navigation'];
            type: 'string';
          };
          boundingBox: BoundingBoxSchema;
          elementCount: { type: 'number'; minimum: 0 };
        };
        required: ['type', 'boundingBox'];
      };
    };
    navigation?: {
      type: 'array';
      items: {
        type: 'object';
        properties: {
          type: {
            enum: ['menu', 'breadcrumb', 'pagination', 'tabs'];
            type: 'string';
          };
          itemCount: { type: 'number'; minimum: 0 };
          boundingBox: BoundingBoxSchema;
        };
        required: ['type', 'itemCount', 'boundingBox'];
      };
    };
    forms?: {
      type: 'array';
      items: {
        type: 'object';
        properties: {
          fieldCount: { type: 'number'; minimum: 0 };
          submitButtonCount: { type: 'number'; minimum: 0 };
          boundingBox: BoundingBoxSchema;
        };
        required: ['fieldCount', 'boundingBox'];
      };
    };
  };
  required: ['layout', 'sections'];
}

export interface AccessibilitySchema {
  type: 'object';
  properties: {
    score: { type: 'number'; minimum: 0; maximum: 100 };
    issues: {
      type: 'array';
      items: {
        type: 'object';
        properties: {
          type: {
            enum: ['contrast', 'alt_text', 'keyboard_navigation', 'aria_labels', 'semantic_structure'];
            type: 'string';
          };
          severity: {
            enum: ['low', 'medium', 'high', 'critical'];
            type: 'string';
          };
          description: StringSchema;
          recommendation: StringSchema;
          element?: VisualElementsSchema['items'];
        };
        required: ['type', 'severity', 'description', 'recommendation'];
      };
    };
    recommendations: {
      type: 'array';
      items: StringSchema;
    };
    compliance: {
      type: 'object';
      properties: {
        wcag_aa: BooleanSchema;
        wcag_aaa: BooleanSchema;
        section508: BooleanSchema;
      };
      required: ['wcag_aa', 'wcag_aaa', 'section508'];
    };
  };
  required: ['score', 'issues', 'recommendations', 'compliance'];
}

export interface DifferencesSchema {
  type: 'array';
  items: {
    type: 'object';
    properties: {
      type: {
        enum: ['added', 'removed', 'modified', 'moved'];
        type: 'string';
      };
      description: StringSchema;
      boundingBox: BoundingBoxSchema;
      confidence: { type: 'number'; minimum: 0; maximum: 1 };
    };
    required: ['type', 'description', 'boundingBox', 'confidence'];
  };
}

export interface ChangeAreasSchema {
  type: 'array';
  items: {
    type: 'object';
    properties: {
      area: BoundingBoxSchema;
      changeType: StringSchema;
      significance: {
        enum: ['minor', 'moderate', 'major'];
        type: 'string';
      };
    };
    required: ['area', 'changeType', 'significance'];
  };
}

// Basic schema types
export interface StringSchema {
  type: 'string';
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  description?: string;
}

export interface NumberSchema {
  type: 'number';
  minimum?: number;
  maximum?: number;
  description?: string;
}

export interface BooleanSchema {
  type: 'boolean';
  description?: string;
}

export interface ArraySchema {
  type: 'array';
  items?: any;
  minItems?: number;
  maxItems?: number;
  description?: string;
}

export interface ObjectSchema {
  type: 'object';
  properties?: Record<string, any>;
  required?: string[];
  additionalProperties?: boolean;
  description?: string;
}

export interface MetadataSchema {
  type: 'object';
  properties: {
    processingTime?: NumberSchema;
    imageSize?: ObjectSchema;
    analysisVersion?: StringSchema;
    timestamp?: StringSchema;
  };
  additionalProperties: true;
}

// Validation Types
export interface ValidationResult {
  valid: boolean;
  errors: SchemaValidationError[];
  warnings: string[];
  executorCompatible: boolean;
}

export interface SchemaValidationError {
  field: string;
  message: string;
  value: any;
  expectedType: string;
  path: string[];
}

// Cache Types
export interface SchemaCacheEntry {
  key: string;
  schema: ResponseSchema | ScreenshotAnalysisSchema | ScreenshotComparisonSchema;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  expiresAt?: Date;
}

export interface SchemaCacheConfig {
  maxEntries: number;
  ttlMs: number;
  cleanupIntervalMs: number;
  enableCompression: boolean;
  persistToDisk: boolean;
  diskCachePath?: string;
}

export interface SchemaCacheStats {
  totalEntries: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  totalMemoryUsage: number;
  averageResponseTime: number;
  lastCleanup: Date;
}
