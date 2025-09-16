# AI Prompt Manager Design Document

## Overview
The AI Prompt Manager module generates structured prompts for an AI web browser agent that operates in an ACT-REFLECT-ACT loop. It constructs context-aware prompts that include execution history, page states, and validation requirements, enabling the AI to make informed decisions about web automation tasks while adhering to predefined response schemas.

## Core Responsibilities
- Generate context-aware prompts for AI web browser agent
- Support ACT-REFLECT-ACT execution loop pattern
- Integrate execution context from AI Context Manager
- Apply response schemas from AI Schema Manager
- Handle both initial action prompts and reflection/validation prompts
- Include chronological execution history and page state information
- Generate result validation prompts for non-initial steps
- Maintain prompt templates and customization options

## Module Interface

### Core Prompt Generation
```typescript
interface AIPromptManager {
  generateActionPrompt(request: ActionPromptRequest): Promise<GeneratedPrompt>;
  generateReflectionPrompt(request: ReflectionPromptRequest): Promise<GeneratedPrompt>;
  getPromptTemplates(): PromptTemplateCollection;
  updatePromptTemplate(templateId: string, template: PromptTemplate): void;
  validatePromptStructure(prompt: GeneratedPrompt): PromptValidationResult;
}

interface ActionPromptRequest {
  sessionId: string;
  currentStepIndex: number;
  currentStepContent: string;
  includeValidation: boolean;
  promptOptions?: PromptOptions;
}

interface ReflectionPromptRequest {
  sessionId: string;
  completedStepIndex: number;
  nextStepIndex: number;
  nextStepContent: string;
  expectedOutcome?: string;
  promptOptions?: PromptOptions;
}
```

### Prompt Structure
```typescript
interface GeneratedPrompt {
  promptId: string;
  sessionId: string;
  stepIndex: number;
  promptType: PromptType;
  content: PromptContent;
  schema: ResponseSchema;
  generatedAt: Date;
  metadata?: Record<string, any>;
}

enum PromptType {
  INITIAL_ACTION = 'INITIAL_ACTION',
  ACTION_WITH_VALIDATION = 'ACTION_WITH_VALIDATION',
  REFLECTION_AND_ACTION = 'REFLECTION_AND_ACTION'
}

interface PromptContent {
  systemMessage: string;
  contextSection: ContextSection;
  instructionSection: InstructionSection;
  validationSection?: ValidationSection;
  schemaSection: SchemaSection;
  examplesSection?: ExamplesSection;
}
```

### Context Integration
```typescript
interface ContextSection {
  currentStep: StepContext;
  executionHistory: ExecutionHistorySection;
  pageStates: PageStateSection;
  sessionMetadata?: Record<string, any>;
}

interface StepContext {
  stepIndex: number;
  stepContent: string;
  stepType: 'initial' | 'continuation' | 'validation';
  totalSteps: number;
}

interface ExecutionHistorySection {
  previousSteps: StepExecutionSummary[];
  chronologicalEvents: ExecutionEventSummary[];
  successfulActions: number;
  failedActions: number;
}

interface StepExecutionSummary {
  stepIndex: number;
  stepName: string;
  reasoning: string;
  executorMethod: string;
  status: ExecutionStatus;
  timestamp: Date;
}

interface ExecutionEventSummary {
  stepIndex: number;
  reasoning: string;
  executorMethod: string;
  outcome: string;
  timestamp: Date;
}
```

### Page State Management
```typescript
interface PageStateSection {
  previousPageDom?: string;
  currentPageDom?: string;
  domComparison?: DomComparisonResult;
  relevantElements?: ElementContext[];
}

interface DomComparisonResult {
  hasChanges: boolean;
  addedElements: string[];
  removedElements: string[];
  modifiedElements: string[];
  summary: string;
}

interface ElementContext {
  selector: string;
  elementType: string;
  textContent?: string;
  attributes?: Record<string, string>;
  relevanceScore: number;
}
```

### Validation and Reflection
```typescript
interface ValidationSection {
  lastActionValidation: ActionValidationPrompt;
  resultAnalysis: ResultAnalysisPrompt;
  decisionFramework: DecisionFrameworkPrompt;
}

interface ActionValidationPrompt {
  expectedOutcome: string;
  actualState: string;
  validationCriteria: ValidationCriteria[];
  successIndicators: string[];
  failureIndicators: string[];
}

interface ValidationCriteria {
  criterion: string;
  evaluationMethod: string;
  weight: number;
  description: string;
}

interface ResultAnalysisPrompt {
  analysisInstructions: string;
  comparisonPoints: string[];
  domAnalysisGuidance: string;
  errorDetectionGuidance: string;
}

interface DecisionFrameworkPrompt {
  decisionOptions: DecisionOption[];
  decisionCriteria: string[];
  proceedConditions: string[];
  retryConditions: string[];
  abortConditions: string[];
}

interface DecisionOption {
  action: DecisionAction;
  description: string;
  conditions: string[];
  consequences: string[];
}
```

### Template Management
```typescript
interface PromptTemplateCollection {
  systemMessageTemplate: PromptTemplate;
  actionPromptTemplate: PromptTemplate;
  reflectionPromptTemplate: PromptTemplate;
  validationPromptTemplate: PromptTemplate;
  contextTemplate: PromptTemplate;
  schemaTemplate: PromptTemplate;
}

interface PromptTemplate {
  templateId: string;
  name: string;
  description: string;
  template: string;
  variables: TemplateVariable[];
  version: string;
  lastModified: Date;
}

interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
  defaultValue?: any;
}
```

### Configuration and Options
```typescript
interface PromptOptions {
  includeExecutionHistory?: boolean;
  maxHistorySteps?: number;
  includeDomComparison?: boolean;
  includeElementContext?: boolean;
  validationMode?: 'strict' | 'lenient';
  reasoningDepth?: 'basic' | 'detailed' | 'comprehensive';
  includeExamples?: boolean;
  customInstructions?: string;
}

// Import shared configuration pattern
import { BaseModuleConfig, DEFAULT_TIMEOUT_CONFIG } from './shared-types';

interface AIPromptManagerConfig extends BaseModuleConfig {
  moduleId: 'ai-prompt-manager';
  
  // AI Prompt Manager specific configuration
  defaultPromptOptions: PromptOptions;
  templateConfig: TemplateConfig;
  contextConfig: ContextConfig;
  validationConfig: ValidationConfig;
  
  // Inherits from BaseModuleConfig:
  // - logging: LoggingConfig
  // - performance: PerformanceConfig (renamed from performanceConfig)
  // - timeouts: TimeoutConfig
}

interface TemplateConfig {
  enableCustomTemplates: boolean;
  templateCacheEnabled: boolean;
  templateValidationEnabled: boolean;
  fallbackToDefault: boolean;
}

interface ContextConfig {
  maxDomSize: number;
  maxHistoryItems: number;
  includeTimestamps: boolean;
  compressLargeDom: boolean;
  highlightRelevantElements: boolean;
}

interface ValidationConfig {
  enableActionValidation: boolean;
  enableResultAnalysis: boolean;
  validationTimeoutMs: number;
  requireExplicitValidation: boolean;
}

interface PerformanceConfig {
  promptCacheEnabled: boolean;
  cacheTTLMs: number;
  maxCacheSize: number;
  asyncGeneration: boolean;
}
```

### Integration Interfaces
```typescript
interface SchemaManagerIntegration {
  getResponseSchema(options?: SchemaOptions): Promise<ResponseSchema>;
  validateSchemaCompatibility(schema: ResponseSchema): boolean;
  getSchemaVersion(): string;
}

interface ContextManagerIntegration {
  getExecutionContext(sessionId: string, stepIndex: number): Promise<AIContextJson>;
  getStepHistory(sessionId: string, maxSteps?: number): Promise<StepExecutionSummary[]>;
  getCurrentPageState(sessionId: string): Promise<string>;
  getPreviousPageState(sessionId: string, stepIndex: number): Promise<string | null>;
}
```

### Validation and Quality Assurance
```typescript
interface PromptValidationResult {
  isValid: boolean;
  errors: PromptValidationError[];
  warnings: string[];
  qualityScore: number;
  suggestions: string[];
}

interface PromptValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  code: string;
}

interface IPromptValidator {
  validatePromptStructure(prompt: GeneratedPrompt): PromptValidationResult;
  validateTemplateVariables(template: PromptTemplate, variables: Record<string, any>): boolean;
  validateSchemaIntegration(prompt: GeneratedPrompt): boolean;
  assessPromptQuality(prompt: GeneratedPrompt): QualityAssessment;
}

interface QualityAssessment {
  clarityScore: number;
  completenessScore: number;
  contextRelevanceScore: number;
  schemaAlignmentScore: number;
  overallScore: number;
  improvements: string[];
}
```

## Prompt Generation Flow

### Initial Action Prompt Flow
1. Receive action prompt request for step index 0
2. Retrieve current step content and context
3. Load system message template and action prompt template
4. Generate schema section using AI Schema Manager
5. Build context section (minimal for first step)
6. Construct instruction section for the specific step
7. Combine all sections into structured prompt
8. Validate prompt structure and quality
9. Return generated prompt with schema

### Reflection and Action Prompt Flow
1. Receive reflection prompt request for step index > 0
2. Retrieve execution context from AI Context Manager
3. Get previous and current page DOM states
4. Load reflection prompt template with validation sections
5. Build comprehensive context section with execution history
6. Generate validation section with last action analysis
7. Create result analysis and decision framework sections
8. Include current step instruction for next action
9. Generate schema section for AI response format
10. Validate complete prompt structure
11. Return reflection prompt with validation requirements

### Context Integration Process
1. Query AI Context Manager for session execution history
2. Retrieve chronological list of reasoning and executor commands
3. Get page DOM states (before and after last step)
4. Filter and organize context based on prompt options
5. Compress or summarize large DOM content if needed
6. Highlight relevant elements and changes
7. Format context into structured sections

### Schema Integration Process
1. Query AI Schema Manager for current response schema
2. Apply prompt-specific schema options
3. Include decision validation requirements for reflection prompts
4. Add command schema for executor integration
5. Format schema as instruction for AI response structure
6. Include examples if configured

## Error Handling and Fallbacks

### Error Types
```typescript
enum PromptManagerErrorType {
  TEMPLATE_NOT_FOUND = 'TEMPLATE_NOT_FOUND',
  CONTEXT_UNAVAILABLE = 'CONTEXT_UNAVAILABLE',
  SCHEMA_GENERATION_FAILED = 'SCHEMA_GENERATION_FAILED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  DOM_TOO_LARGE = 'DOM_TOO_LARGE',
  HISTORY_CORRUPTED = 'HISTORY_CORRUPTED',
  TEMPLATE_RENDERING_FAILED = 'TEMPLATE_RENDERING_FAILED'
}

interface PromptManagerError extends Error {
  type: PromptManagerErrorType;
  sessionId?: string;
  stepIndex?: number;
  context?: Record<string, any>;
}
```

### Fallback Strategies
- Use default templates when custom templates fail
- Generate minimal context when full context unavailable
- Compress or truncate DOM when size limits exceeded
- Provide basic schema when schema generation fails
- Create simplified prompts for critical path execution

## Performance Considerations

### Optimization Strategies
- Cache frequently used prompt templates
- Implement async prompt generation for non-blocking operations
- Compress large DOM content before inclusion
- Use streaming for very large context data
- Implement prompt deduplication for repeated scenarios

### Resource Management
- Monitor prompt generation time and optimize bottlenecks
- Limit DOM size and history depth based on configuration
- Implement garbage collection for cached prompts
- Track memory usage for large context objects

## Integration Dependencies

### AI Schema Manager
- Response schema generation
- Validation rule definitions
- Schema versioning and compatibility
- Command structure validation

### AI Context Manager
- Execution history retrieval
- Step context and metadata
- Page state management
- Session information access

### Executor Module
- Command action definitions
- Parameter structure requirements
- Response format expectations
- Error context integration

## Testing Strategy

### Unit Testing
- Template rendering with various data inputs
- Context integration with mock data
- Schema integration validation
- Error handling and fallback scenarios
- Performance with large context data

### Integration Testing
- End-to-end prompt generation flow
- Schema manager integration
- Context manager integration
- Validation with actual AI responses
- Multi-step execution scenarios

### Performance Testing
- Large DOM handling
- Extensive execution history
- Template rendering performance
- Memory usage with large prompts
- Concurrent prompt generation

## Security Considerations

### Data Sanitization
- Sanitize DOM content for prompt inclusion
- Validate template variables for injection attacks
- Filter sensitive information from context
- Limit template variable expansion depth

### Access Control
- Validate session access permissions
- Restrict template modification access
- Control context information exposure
- Implement audit logging for prompt generation

## Future Enhancements

### Advanced Features
- Machine learning for prompt optimization
- Dynamic template adaptation based on success rates
- Advanced DOM analysis and element highlighting
- Multi-language prompt support
- Voice-enabled prompt generation

### Integration Expansions
- Support for additional automation frameworks
- Integration with external AI services
- Custom validation rule engines
- Advanced debugging and visualization tools
- Real-time prompt collaboration features

## Constants and Configuration

```typescript
// Version and defaults
export const PROMPT_MANAGER_VERSION = '1.0.0';
export const DEFAULT_MAX_DOM_SIZE = 100000; // characters
export const DEFAULT_MAX_HISTORY_STEPS = 10;
export const DEFAULT_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const DEFAULT_MAX_CACHE_SIZE = 50;

// Template IDs
export const TEMPLATE_IDS = {
  SYSTEM_MESSAGE: 'system_message',
  INITIAL_ACTION: 'initial_action',
  REFLECTION_ACTION: 'reflection_action',
  VALIDATION: 'validation',
  CONTEXT: 'context',
  SCHEMA: 'schema'
} as const;

// Prompt quality thresholds
export const QUALITY_THRESHOLDS = {
  MIN_CLARITY_SCORE: 0.7,
  MIN_COMPLETENESS_SCORE: 0.8,
  MIN_OVERALL_SCORE: 0.75
} as const;
```
