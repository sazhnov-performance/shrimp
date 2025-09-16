# AI Integration Module Design Document

## Overview
The AI Integration module provides a comprehensive interface for connecting to and communicating with OpenAI services. It manages authentication, request/response handling, rate limiting, error recovery, and response streaming while maintaining session-based context and ensuring secure API interactions.

## Core Responsibilities
- Establish and maintain secure connections to OpenAI API
- Handle API key authentication and token management
- Process AI requests with proper formatting and validation
- Stream and manage AI responses with real-time updates
- Implement rate limiting and quota management
- Provide comprehensive error handling and retry mechanisms
- Support multiple AI models and configuration options
- Log all interactions for debugging and monitoring
- Store raw AI requests and responses to dedicated log files in `/log` directory
- Support multimodal requests with screenshots and images
- Provide screenshot analysis and content summarization capabilities
- Handle vision-capable AI models for image understanding

## Module Interface

### Connection Management (STANDARDIZED)
```typescript
// Import standardized session management types
import { 
  ISessionManager,
  ModuleSessionInfo,
  SessionStatus,
  SessionLifecycleCallbacks,
  ModuleSessionConfig
} from './shared-types';

// Map AI Connection to standardized session model
interface AIConnectionSession extends ModuleSessionInfo {
  moduleId: 'ai-integration';
  connectionId: string;       // AI-specific connection ID
  apiKey: string;
  organizationId?: string;
  baseUrl: string;
  model: string;
  connectionStatus: ConnectionStatus; // AI-specific status
  // Inherits: sessionId, linkedWorkflowSessionId, status (mapped), createdAt, lastActivity, metadata
}

interface IAIConnectionManager extends ISessionManager {
  readonly moduleId: 'ai-integration';
  
  // Standardized session management (inherited)
  createSession(workflowSessionId: string, config?: AIConnectionConfig): Promise<string>;
  destroySession(workflowSessionId: string): Promise<void>;
  getSession(workflowSessionId: string): ModuleSessionInfo | null;
  sessionExists(workflowSessionId: string): boolean;
  
  // AI Connection specific methods (mapped to session management)
  createConnection(workflowSessionId: string, config: AIConnectionConfig): Promise<string>;
  getConnection(workflowSessionId: string): AIConnectionSession | null;
  testConnection(workflowSessionId: string): Promise<ConnectionTestResult>;
  destroyConnection(workflowSessionId: string): Promise<void>;
  listActiveConnections(): string[];
  
  // Status mapping helper
  mapConnectionStatusToSessionStatus(connectionStatus: ConnectionStatus): SessionStatus;
}
```

### Core Interface (STANDARDIZED: Extends ISessionManager)
```typescript
interface IAIIntegrationManager extends ISessionManager {
  readonly moduleId: 'ai-integration';
  
  // Standardized Session Management (inherited from ISessionManager)
  createSession(workflowSessionId: string, config?: AIConnectionConfig): Promise<string>;
  destroySession(workflowSessionId: string): Promise<void>;
  getSession(workflowSessionId: string): ModuleSessionInfo | null;
  sessionExists(workflowSessionId: string): boolean;
  updateSessionStatus(workflowSessionId: string, status: SessionStatus): Promise<void>;
  getSessionStatus(workflowSessionId: string): SessionStatus | null;
  recordActivity(workflowSessionId: string): Promise<void>;
  getLastActivity(workflowSessionId: string): Date | null;
  setLifecycleCallbacks(callbacks: SessionLifecycleCallbacks): void;
  healthCheck(): Promise<SessionManagerHealth>;
  
  // AI Connection Management (uses workflowSessionId consistently)
  createConnection(workflowSessionId: string, config: AIConnectionConfig): Promise<string>;
  destroyConnection(workflowSessionId: string): Promise<void>;
  testConnection(workflowSessionId: string): Promise<ConnectionTestResult>;
  
  // Request Processing (uses workflowSessionId for tracking)
  sendRequest(workflowSessionId: string, request: AIRequest): Promise<AIResponse>;
  sendStreamRequest(workflowSessionId: string, request: AIRequest): AsyncGenerator<AIStreamChunk>;
  
  // Model Management (uses workflowSessionId for session context)
  listAvailableModels(workflowSessionId: string): Promise<AIModel[]>;
  getModelInfo(workflowSessionId: string, modelId: string): Promise<AIModelInfo>;
  
  // Usage Monitoring (uses workflowSessionId for tracking)
  getUsageStats(workflowSessionId: string): Promise<AIUsageStats>;
  getRateLimitStatus(workflowSessionId: string): Promise<RateLimitStatus>;
  
  // Configuration (uses workflowSessionId consistently)
  updateConnectionConfig(workflowSessionId: string, config: Partial<AIConnectionConfig>): Promise<void>;
  getConnectionConfig(workflowSessionId: string): AIConnectionConfig | null;
  
  // Raw Request/Response Logging (uses workflowSessionId consistently)
  enableRawLogging(workflowSessionId: string, logConfig: RawLoggingConfig): Promise<void>;
  disableRawLogging(workflowSessionId: string): Promise<void>;
  getRawLogFiles(workflowSessionId: string, dateRange?: [Date, Date]): Promise<string[]>;
  cleanupRawLogs(workflowSessionId: string, olderThan: Date): Promise<void>;
  
  // Screenshot Analysis (uses workflowSessionId for tracking)
  analyzeScreenshot(workflowSessionId: string, request: ScreenshotAnalysisRequest): Promise<ScreenshotAnalysisResponse>;
  analyzeScreenshotStream(workflowSessionId: string, request: ScreenshotAnalysisRequest): AsyncGenerator<AIStreamChunk>;
}
```

## Data Structures

### Connection Configuration
```typescript
interface AIConnectionConfig {
  apiKey: string;
  organizationId?: string;
  baseUrl?: string; // Default: https://api.openai.com/v1
  model: string; // e.g., 'gpt-4', 'gpt-3.5-turbo'
  
  // Timeout configuration - uses values from shared TimeoutConfig hierarchy
  // These values should be <= corresponding values in TimeoutConfig
  requestTimeoutMs?: number; // Override request timeout (must be <= stepTimeoutMs from parent config)
  connectionTimeoutMs?: number; // Override connection timeout (must be <= requestTimeoutMs)
  
  maxRetries: number; // Maximum retry attempts
  retryDelayMs: number; // Delay between retries in milliseconds
  rateLimiting: RateLimitConfig;
  streamingEnabled: boolean;
  logLevel: LogLevel;
  rawLogging: RawLoggingConfig;
}

interface RateLimitConfig {
  requestsPerMinute: number;
  tokensPerMinute: number;
  maxConcurrentRequests: number;
  queueEnabled: boolean;
  queueMaxSize: number;
}

interface RawLoggingConfig {
  enabled: boolean;
  logDirectory: string; // Default: ./log
  logRequests: boolean;
  logResponses: boolean;
  logStreamChunks: boolean;
  fileRotation: {
    enabled: boolean;
    maxFileSize: number; // bytes
    maxFiles: number;
    rotationPattern: 'daily' | 'hourly' | 'size-based';
  };
  compression: {
    enabled: boolean;
    algorithm: 'gzip' | 'brotli';
    compressAfterDays: number;
  };
  encryption: {
    enabled: boolean;
    algorithm: string;
    keyPath?: string;
  };
  retention: {
    enabled: boolean;
    retentionDays: number;
    autoCleanup: boolean;
  };
}
```

### Request/Response Types
```typescript
interface AIRequest {
  messages: AIMessage[];
  parameters?: AIRequestParameters;
  metadata?: Record<string, any>;
}

interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | MultimodalContent[];
  timestamp?: Date;
}

interface MultimodalContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
}

interface AIRequestParameters {
  temperature?: number; // 0.0 to 2.0
  maxTokens?: number;
  topP?: number; // 0.0 to 1.0
  frequencyPenalty?: number; // -2.0 to 2.0
  presencePenalty?: number; // -2.0 to 2.0
  stop?: string | string[];
  stream?: boolean;
}

interface AIResponse {
  id: string;
  content: string;
  model: string;
  usage: TokenUsage;
  finishReason: FinishReason;
  timestamp: Date;
  processingTime: number; // milliseconds
  metadata?: Record<string, any>;
}

interface AIStreamChunk {
  id: string;
  delta: string;
  isComplete: boolean;
  usage?: TokenUsage;
  timestamp: Date;
}

### Screenshot Analysis Types
```typescript
interface ScreenshotAnalysisRequest {
  image: ImageInput;
  analysisType: ScreenshotAnalysisType;
  options?: ScreenshotAnalysisOptions;
  metadata?: Record<string, any>;
}

interface ImageInput {
  type: 'base64' | 'url' | 'buffer';
  data: string | Buffer;
  format: 'png' | 'jpeg' | 'webp';
  quality?: 'low' | 'high' | 'auto';
}

enum ScreenshotAnalysisType {
  CONTENT_SUMMARY = 'CONTENT_SUMMARY',
  ELEMENT_DETECTION = 'ELEMENT_DETECTION', 
  UI_STRUCTURE = 'UI_STRUCTURE',
  TEXT_EXTRACTION = 'TEXT_EXTRACTION',
  ACCESSIBILITY_AUDIT = 'ACCESSIBILITY_AUDIT',
  COMPARISON = 'COMPARISON'
}

interface ScreenshotAnalysisOptions {
  includeCoordinates?: boolean;
  includeElementDetails?: boolean;
  includeTextContent?: boolean;
  includeColors?: boolean;
  includeLayout?: boolean;
  focusAreas?: BoundingBox[];
  comparisonImage?: ImageInput;
  customPrompt?: string;
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ScreenshotAnalysisResponse {
  id: string;
  analysisType: ScreenshotAnalysisType;
  summary: string;
  elements?: DetectedElement[];
  structure?: UIStructure;
  textContent?: ExtractedText[];
  accessibility?: AccessibilityAudit;
  comparison?: ComparisonResult;
  confidence: number;
  processingTime: number;
  usage: TokenUsage;
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface DetectedElement {
  type: string;
  confidence: number;
  boundingBox: BoundingBox;
  attributes?: Record<string, string>;
  text?: string;
  interactable: boolean;
  selector?: string;
}

interface UIStructure {
  layout: 'grid' | 'flex' | 'absolute' | 'table' | 'mixed';
  sections: UISection[];
  navigation?: NavigationElement[];
  forms?: FormElement[];
  interactive?: InteractiveElement[];
}

interface UISection {
  type: 'header' | 'footer' | 'sidebar' | 'main' | 'content' | 'navigation';
  boundingBox: BoundingBox;
  elements: DetectedElement[];
}

interface NavigationElement {
  type: 'menu' | 'breadcrumb' | 'pagination' | 'tabs';
  items: NavigationItem[];
  boundingBox: BoundingBox;
}

interface NavigationItem {
  text: string;
  href?: string;
  active: boolean;
  boundingBox: BoundingBox;
}

interface FormElement {
  action?: string;
  method?: string;
  fields: FormField[];
  submitButtons: DetectedElement[];
  boundingBox: BoundingBox;
}

interface FormField {
  type: 'input' | 'textarea' | 'select' | 'checkbox' | 'radio';
  name?: string;
  label?: string;
  placeholder?: string;
  required: boolean;
  value?: string;
  boundingBox: BoundingBox;
}

interface InteractiveElement {
  type: 'button' | 'link' | 'input' | 'dropdown' | 'toggle';
  text?: string;
  action?: string;
  state?: 'enabled' | 'disabled' | 'loading';
  boundingBox: BoundingBox;
}

interface ExtractedText {
  content: string;
  type: 'heading' | 'paragraph' | 'link' | 'button' | 'label' | 'error' | 'success';
  boundingBox: BoundingBox;
  fontSize?: number;
  fontWeight?: string;
  color?: string;
}

interface AccessibilityAudit {
  score: number;
  issues: AccessibilityIssue[];
  recommendations: string[];
  compliance: {
    wcag_aa: boolean;
    wcag_aaa: boolean;
    section508: boolean;
  };
}

interface AccessibilityIssue {
  type: 'contrast' | 'alt_text' | 'keyboard_navigation' | 'aria_labels' | 'semantic_structure';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  element?: DetectedElement;
  recommendation: string;
}

interface ComparisonResult {
  similarity: number;
  differences: ImageDifference[];
  summary: string;
  significantChanges: boolean;
}

interface ImageDifference {
  type: 'added' | 'removed' | 'modified' | 'moved';
  description: string;
  boundingBox: BoundingBox;
  confidence: number;
}
```

### Status and Monitoring Types
```typescript
enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
  RATE_LIMITED = 'RATE_LIMITED'
}

enum FinishReason {
  STOP = 'stop',
  LENGTH = 'length',
  CONTENT_FILTER = 'content_filter',
  ERROR = 'error'
}

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost?: number; // USD
}

interface ConnectionTestResult {
  success: boolean;
  latency: number; // milliseconds
  model: string;
  error?: string;
  timestamp: Date;
}

interface AIUsageStats {
  connectionId: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokensUsed: number;
  estimatedTotalCost: number;
  averageResponseTime: number;
  lastRequestTime: Date;
  dailyUsage: DailyUsageStats[];
}

interface RateLimitStatus {
  requestsRemaining: number;
  tokensRemaining: number;
  resetTime: Date;
  currentQueueSize: number;
  isThrottled: boolean;
}
```

## Core Functionality

### 1. Connection Establishment
```typescript
async createConnection(config: AIConnectionConfig): Promise<string>
```
- Validate API key format and permissions
- Test initial connection to OpenAI API
- Generate unique connection ID
- Initialize rate limiting mechanisms
- Store connection configuration securely
- Return connection ID for future operations

### 2. Authentication Management
```typescript
async authenticateConnection(connectionId: string): Promise<boolean>
```
- Verify API key validity
- Check organization permissions
- Handle token refresh if applicable
- Update connection status
- Log authentication results

### 3. Request Processing
```typescript
async sendRequest(connectionId: string, request: AIRequest): Promise<AIResponse>
```
#### Process Flow:
1. **Validate Request**: Check message format, parameters, and token limits
2. **Rate Limit Check**: Ensure request complies with rate limits
3. **Format Request**: Convert to OpenAI API format
4. **Send Request**: Make HTTP request with retry logic
5. **Process Response**: Parse and validate response
6. **Update Metrics**: Track usage statistics
7. **Return Response**: Formatted response object

#### Error Handling:
- API rate limit exceeded
- Invalid API key or permissions
- Model not available
- Request timeout
- Network connectivity issues
- Invalid request format

### 4. Streaming Support
```typescript
async sendStreamRequest(connectionId: string, request: AIRequest): AsyncGenerator<AIStreamChunk>
```
- Enable real-time response streaming
- Handle partial response chunks
- Manage stream interruption and recovery
- Provide incremental token usage updates
- Support stream cancellation

### 5. Rate Limiting
```typescript
class RateLimitManager {
  async checkRateLimit(connectionId: string): Promise<boolean>;
  async waitForRateLimit(connectionId: string): Promise<void>;
  async updateUsage(connectionId: string, usage: TokenUsage): Promise<void>;
}
```
- Track requests per minute/hour/day
- Monitor token usage against quotas
- Implement intelligent queuing system
- Provide rate limit status information
- Handle burst capacity management

### 6. Model Management
```typescript
async listAvailableModels(connectionId: string): Promise<AIModel[]>
```
- Fetch available models from OpenAI API
- Cache model information
- Validate model permissions
- Provide model capabilities and pricing
- Support model selection recommendations

### 7. Screenshot Analysis
```typescript
async analyzeScreenshot(workflowSessionId: string, request: ScreenshotAnalysisRequest): Promise<ScreenshotAnalysisResponse>
```
#### Process Flow:
1. **Image Validation**: Verify image format, size, and quality
2. **Image Preprocessing**: Convert to appropriate format, resize if needed
3. **Vision Model Selection**: Choose appropriate vision-capable model
4. **Prompt Construction**: Build analysis prompt based on analysis type
5. **API Request**: Send multimodal request to OpenAI Vision API
6. **Response Processing**: Parse and structure the analysis results
7. **Post-processing**: Extract structured data (elements, coordinates, etc.)
8. **Return Analysis**: Formatted screenshot analysis response

#### Supported Analysis Types:
- **CONTENT_SUMMARY**: General description of page content and purpose
- **ELEMENT_DETECTION**: Identify and locate interactive elements
- **UI_STRUCTURE**: Analyze layout, navigation, and page structure
- **TEXT_EXTRACTION**: Extract and categorize all visible text
- **ACCESSIBILITY_AUDIT**: Evaluate accessibility compliance
- **COMPARISON**: Compare with reference image for changes

### 8. Streaming Screenshot Analysis
```typescript
async analyzeScreenshotStream(workflowSessionId: string, request: ScreenshotAnalysisRequest): AsyncGenerator<AIStreamChunk>
```
- Real-time streaming analysis for large or complex screenshots
- Incremental result delivery for better user experience
- Support for cancellation and partial results
- Optimized for processing time-sensitive analysis

### 9. Image Processing
```typescript
class ImageProcessor {
  async preprocessImage(image: ImageInput): Promise<ProcessedImage>;
  async resizeImage(image: ImageInput, maxSize: number): Promise<ImageInput>;
  async compressImage(image: ImageInput, quality: number): Promise<ImageInput>;
  async convertFormat(image: ImageInput, targetFormat: string): Promise<ImageInput>;
  async validateImage(image: ImageInput): Promise<ImageValidationResult>;
}
```
- Automatic image optimization for AI processing
- Format conversion and compression
- Size validation and automatic resizing
- Quality assessment and enhancement

### 10. Raw Request/Response Logging
```typescript
class RawLogger {
  async logRequest(connectionId: string, requestId: string, request: AIRequest): Promise<void>;
  async logResponse(connectionId: string, requestId: string, response: AIResponse): Promise<void>;
  async logStreamChunk(connectionId: string, requestId: string, chunk: AIStreamChunk): Promise<void>;
  async rotateLogFiles(connectionId: string): Promise<void>;
  async compressOldLogs(connectionId: string): Promise<void>;
  async cleanupExpiredLogs(connectionId: string): Promise<void>;
}
```
#### Process Flow:
1. **Log File Preparation**: Create connection-specific log directory structure
2. **Request Logging**: Store raw request data with timestamp and metadata
3. **Response Logging**: Store complete response data with correlation ID
4. **Stream Chunk Logging**: Store incremental stream chunks with sequence numbers
5. **File Rotation**: Automatically rotate logs based on size or time
6. **Compression**: Compress old log files to save storage space
7. **Cleanup**: Automatically remove logs older than retention period

#### Log File Structure:
```
/log/
  ├── connections/
  │   └── {connectionId}/
  │       ├── requests/
  │       │   ├── YYYY-MM-DD-HH.json
  │       │   ├── YYYY-MM-DD-HH.json.gz (compressed)
  │       │   └── ...
  │       ├── responses/
  │       │   ├── YYYY-MM-DD-HH.json
  │       │   ├── YYYY-MM-DD-HH.json.gz (compressed)
  │       │   └── ...
  │       └── streams/
  │           ├── YYYY-MM-DD-HH.json
  │           ├── YYYY-MM-DD-HH.json.gz (compressed)
  │           └── ...
  └── metadata/
      ├── connections.json
      └── retention-policy.json
```

#### Log Entry Format:
```json
{
  "timestamp": "2023-12-01T10:30:00.000Z",
  "requestId": "req_abc123",
  "connectionId": "conn_xyz789",
  "type": "request|response|stream_chunk",
  "sequenceNumber": 1,
  "data": {
    // Raw AI request/response data
  },
  "metadata": {
    "model": "gpt-4",
    "endpoint": "/v1/chat/completions",
    "contentLength": 1024,
    "encrypted": false
  }
}
```

## Implementation Structure

### Module Organization
```
/src/modules/ai-integration/
  ├── index.ts                    # Main module interface
  ├── connection-manager.ts       # Connection lifecycle management
  ├── request-processor.ts        # Request/response handling
  ├── stream-handler.ts           # Streaming response management
  ├── rate-limit-manager.ts       # Rate limiting and quota management
  ├── authentication-handler.ts   # API key and auth management
  ├── model-manager.ts            # Model information and selection
  ├── usage-tracker.ts            # Usage statistics and monitoring
  ├── error-handler.ts            # Error categorization and recovery
  ├── logger.ts                   # Structured logging
  ├── raw-logger.ts               # Raw request/response logging
  ├── screenshot-analyzer.ts      # Screenshot analysis and processing
  ├── image-processor.ts          # Image preprocessing and optimization
  ├── vision-handler.ts           # Vision model integration and handling
  └── types.ts                    # TypeScript type definitions
```

### Configuration Management (FIXED: Uses BaseModuleConfig)
```typescript
// Import shared configuration pattern
import { BaseModuleConfig, LoggingConfig, PerformanceConfig, TimeoutConfig } from './shared-types';

interface AIIntegrationConfig extends BaseModuleConfig {
  moduleId: 'ai-integration';
  
  // AI Integration specific configuration
  ai: {
    defaultModel: string;
    defaultVisionModel: string;
    defaultRateLimit: RateLimitConfig;
    retryPolicy: RetryPolicy;
    securityConfig: SecurityConfig;
    cachingConfig: CachingConfig;
    rawLoggingConfig: RawLoggingConfig;
    imageProcessingConfig: ImageProcessingConfig;
  };
  
  // Inherits from BaseModuleConfig:
  // - logging: LoggingConfig
  // - performance: PerformanceConfig  
  // - timeouts: TimeoutConfig (provides requestTimeoutMs and connectionTimeoutMs aligned with hierarchy)
}

// Default configuration with proper timeout hierarchy
const DEFAULT_AI_INTEGRATION_CONFIG: AIIntegrationConfig = {
  moduleId: 'ai-integration',
  version: '1.0.0',
  enabled: true,
  
  ai: {
    defaultModel: 'gpt-4',
    defaultVisionModel: 'gpt-4-vision-preview',
    defaultRateLimit: {
      requestsPerMinute: 60,
      tokensPerMinute: 40000,
      maxConcurrentRequests: 5,
      queueEnabled: true,
      queueMaxSize: 100
    },
    retryPolicy: {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      retryableErrors: ['NETWORK_ERROR', 'TIMEOUT_ERROR', 'RATE_LIMIT_ERROR']
    },
    securityConfig: {
      encryptApiKeys: true,
      allowedOrigins: ['localhost'],
      requestValidation: true,
      sanitizeResponses: true
    },
    cachingConfig: {
      enabled: true,
      maxSize: 1000,
      ttlMs: 300000 // 5 minutes
    },
    rawLoggingConfig: {
      enabled: false,
      logDirectory: './log',
      logRequests: true,
      logResponses: true,
      logStreamChunks: false,
      fileRotation: { enabled: true, maxFileSize: 10485760, maxFiles: 5, rotationPattern: 'daily' },
      compression: { enabled: true, algorithm: 'gzip', compressAfterDays: 1 },
      encryption: { enabled: false, algorithm: 'aes-256-gcm' },
      retention: { enabled: true, retentionDays: 30, autoCleanup: true }
    },
    imageProcessingConfig: {
      maxImageSize: 20971520,        // 20MB
      maxImageDimensions: 2048,      // 2048x2048 pixels
      supportedFormats: ['png', 'jpeg', 'webp'],
      defaultQuality: 'high',
      autoResize: true,
      autoCompress: true,
      preserveAspectRatio: true,
      compressionQuality: 0.85,
      cacheProcessedImages: true,
      cacheTTLMs: 300000             // 5 minutes
    }
  },
  
  timeouts: {
    workflowTimeoutMs: 1800000,      // 30 minutes (inherited from Step Processor)
    stepTimeoutMs: 300000,           // 5 minutes (inherited from Step Processor)
    requestTimeoutMs: 30000,         // 30 seconds (for AI API calls)
    connectionTimeoutMs: 10000,      // 10 seconds (for connection establishment)
    defaultOperationTimeoutMs: 30000,
    maxRetryAttempts: 3,
    retryDelayMs: 1000,
    exponentialBackoff: true
  },
  
  logging: {
    level: LogLevel.INFO,
    prefix: '[AI-Integration]',
    includeTimestamp: true,
    includeSessionId: true,
    includeModuleId: true,
    structured: false
  },
  
  performance: {
    maxConcurrentOperations: 5,
    cacheEnabled: true,
    cacheTTLMs: 300000,
    metricsEnabled: true
  }
}

interface RetryPolicy {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

interface SecurityConfig {
  encryptApiKeys: boolean;
  allowedOrigins: string[];
  requestValidation: boolean;
  sanitizeResponses: boolean;
}

interface ImageProcessingConfig {
  maxImageSize: number;              // Maximum file size in bytes
  maxImageDimensions: number;        // Maximum width/height in pixels
  supportedFormats: string[];        // Supported image formats
  defaultQuality: 'low' | 'high' | 'auto';
  autoResize: boolean;               // Automatically resize large images
  autoCompress: boolean;             // Automatically compress images
  preserveAspectRatio: boolean;      // Maintain aspect ratio during resize
  compressionQuality: number;        // Compression quality (0.0-1.0)
  cacheProcessedImages: boolean;     // Cache processed images
  cacheTTLMs: number;               // Cache time-to-live in milliseconds
}

interface ProcessedImage {
  data: string | Buffer;
  format: string;
  width: number;
  height: number;
  size: number;
  quality: string;
  processingTime: number;
}

interface ImageValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  originalSize: number;
  suggestedSize?: number;
  supportedFormat: boolean;
}
```

## Integration with Other Modules

### Executor Module Integration
```typescript
interface ExecutorAIIntegration {
  analyzePageContext(connectionId: string, dom: string, screenshot: string): Promise<AIResponse>;
  generateAutomationSteps(connectionId: string, objective: string, context: string): Promise<string[]>;
  troubleshootError(connectionId: string, error: string, context: string): Promise<string>;
  analyzePageScreenshot(connectionId: string, screenshot: ImageInput, analysisType: ScreenshotAnalysisType): Promise<ScreenshotAnalysisResponse>;
  comparePageStates(connectionId: string, beforeImage: ImageInput, afterImage: ImageInput): Promise<ComparisonResult>;
}
```

### Context Manager Integration
```typescript
interface ContextAIIntegration {
  analyzeExecutionHistory(connectionId: string, context: AIContextJson): Promise<AIResponse>;
  optimizeSteps(connectionId: string, executionHistory: ExecutionFlowItem[]): Promise<string[]>;
  predictNextAction(connectionId: string, currentState: string): Promise<string>;
  analyzePageProgression(connectionId: string, screenshots: ImageInput[], stepContexts: string[]): Promise<ProgressionAnalysis>;
  generateVisualSummary(connectionId: string, executionHistory: ExecutionFlowItem[], screenshots: ImageInput[]): Promise<VisualExecutionSummary>;
}

interface ProgressionAnalysis {
  overallProgress: number;
  completedSteps: string[];
  currentState: string;
  nextRecommendedAction: string;
  potentialIssues: string[];
  visualChanges: ImageDifference[];
}

interface VisualExecutionSummary {
  executionOverview: string;
  keyVisualMilestones: VisualMilestone[];
  errorScreenshots: ImageInput[];
  successIndicators: string[];
  recommendations: string[];
}

interface VisualMilestone {
  stepIndex: number;
  description: string;
  screenshot: ImageInput;
  significance: 'low' | 'medium' | 'high';
  changesSincePrevious: string[];
}
```

## Advanced Features

### Conversation Management
```typescript
interface ConversationManager {
  createConversation(connectionId: string): Promise<string>;
  addMessage(conversationId: string, message: AIMessage): Promise<void>;
  getConversationHistory(conversationId: string): Promise<AIMessage[]>;
  clearConversation(conversationId: string): Promise<void>;
}
```

### Response Caching
```typescript
interface ResponseCache {
  cacheResponse(requestHash: string, response: AIResponse): Promise<void>;
  getCachedResponse(requestHash: string): Promise<AIResponse | null>;
  invalidateCache(pattern: string): Promise<void>;
  getCacheStats(): Promise<CacheStats>;
}
```

### Request Analytics
```typescript
interface RequestAnalytics {
  trackRequest(connectionId: string, request: AIRequest, response: AIResponse): Promise<void>;
  getPerformanceMetrics(connectionId: string, timeRange: [Date, Date]): Promise<PerformanceMetrics>;
  generateUsageReport(connectionId: string, format: 'json' | 'csv' | 'pdf'): Promise<string>;
}
```

## Error Handling

### Error Categories (FIXED: Uses StandardError)
```typescript
// Import standardized error handling
import { 
  StandardError, 
  ErrorCategory, 
  ErrorSeverity, 
  ERROR_CODES 
} from './shared-types';

// AI Integration Error Handler using shared framework
class AIIntegrationErrorHandler {
  createStandardError(code: string, message: string, details?: Record<string, any>, connectionId?: string): StandardError {
    return {
      id: crypto.randomUUID(),
      category: this.categorizeError(code),
      severity: this.determineSeverity(code),
      code: ERROR_CODES.AI_INTEGRATION[code] || code,
      message,
      details: {
        ...details,
        connectionId
      },
      timestamp: new Date(),
      moduleId: 'ai-integration',
      recoverable: this.isRecoverable(code),
      retryable: this.isRetryable(code),
      suggestedAction: this.getSuggestedAction(code)
    };
  }

  private categorizeError(code: string): ErrorCategory {
    const validationErrors = ['INVALID_RESPONSE', 'CONTENT_FILTER'];
    const executionErrors = ['MODEL_ERROR', 'TIMEOUT_ERROR'];
    const systemErrors = ['RATE_LIMIT_EXCEEDED', 'QUOTA_EXCEEDED'];
    const integrationErrors = ['CONNECTION_FAILED', 'AUTHENTICATION_ERROR'];
    
    if (validationErrors.includes(code)) return ErrorCategory.VALIDATION;
    if (executionErrors.includes(code)) return ErrorCategory.EXECUTION;
    if (systemErrors.includes(code)) return ErrorCategory.SYSTEM;
    if (integrationErrors.includes(code)) return ErrorCategory.INTEGRATION;
    return ErrorCategory.SYSTEM;
  }

  private determineSeverity(code: string): ErrorSeverity {
    const criticalErrors = ['AUTHENTICATION_ERROR', 'CONNECTION_FAILED'];
    const highErrors = ['QUOTA_EXCEEDED', 'MODEL_ERROR'];
    const mediumErrors = ['RATE_LIMIT_EXCEEDED', 'TIMEOUT_ERROR'];
    
    if (criticalErrors.includes(code)) return ErrorSeverity.CRITICAL;
    if (highErrors.includes(code)) return ErrorSeverity.HIGH;
    if (mediumErrors.includes(code)) return ErrorSeverity.MEDIUM;
    return ErrorSeverity.LOW;
  }

  private isRecoverable(code: string): boolean {
    const unrecoverableErrors = ['AUTHENTICATION_ERROR', 'QUOTA_EXCEEDED'];
    return !unrecoverableErrors.includes(code);
  }

  private isRetryable(code: string): boolean {
    const retryableErrors = ['RATE_LIMIT_EXCEEDED', 'TIMEOUT_ERROR', 'CONNECTION_FAILED'];
    return retryableErrors.includes(code);
  }

  private getSuggestedAction(code: string): string {
    const actions = {
      'AUTHENTICATION_ERROR': 'Check API key and organization settings',
      'RATE_LIMIT_EXCEEDED': 'Wait for rate limit reset or reduce request frequency',
      'CONNECTION_FAILED': 'Check network connection and API endpoint',
      'TIMEOUT_ERROR': 'Retry request or increase timeout value',
      'MODEL_ERROR': 'Try different model or check request parameters',
      'QUOTA_EXCEEDED': 'Check usage limits and billing status',
      'INVALID_RESPONSE': 'Validate request format and parameters',
      'CONTENT_FILTER': 'Modify request content to comply with policies'
    };
    return actions[code] || 'Check API documentation and retry';
  }
}
```

### Recovery Mechanisms
- Automatic retry with exponential backoff
- Graceful degradation for non-critical requests
- Connection health monitoring and auto-recovery
- Queue management during rate limit periods
- Alternative model fallback options

## Performance Considerations

### Response Time Optimization
- Connection pooling and reuse
- Request batching for efficiency
- Intelligent caching strategies
- Streaming for large responses
- Parallel request processing

### Memory Management
- Conversation history pruning
- Response data compression
- Cache size limitations
- Resource cleanup for destroyed connections

### Scalability
- Support for multiple concurrent connections
- Load balancing across API endpoints
- Horizontal scaling capabilities
- Connection health monitoring

## Security Considerations

### API Key Security
- Encrypted storage of API keys
- Secure transmission protocols
- Key rotation support
- Access logging and monitoring
- Environment-based configuration

### Request/Response Security
- Input sanitization and validation
- Response content filtering
- Audit logging for all interactions
- Rate limiting to prevent abuse
- SSL/TLS encryption for all communications

## Monitoring and Logging

### Logging Requirements
All log entries must start with `[AI-Integration]` prefix:
```
[AI-Integration][LEVEL] [ConnectionID] Message with context
```

### Log Categories
- **DEBUG**: Request/response details, token usage
- **INFO**: Connection events, successful operations
- **WARN**: Rate limiting, retries, performance issues
- **ERROR**: Failed requests, authentication errors

### Monitoring Metrics
- Request success/failure rates
- Average response times
- Token usage patterns
- Rate limit violations
- Error frequency by type
- Cost tracking and budgeting

## Testing Requirements
- Unit tests for all core functionality
- Integration tests with OpenAI API
- Rate limiting behavior validation
- Error handling and recovery tests
- Performance benchmarks
- Security vulnerability testing
- Load testing for concurrent connections
- Streaming functionality tests

## Configuration Options
```typescript
interface AIIntegrationConfig {
  openai: {
    apiKey: string;
    organizationId?: string;
    baseUrl?: string;
  };
  models: {
    default: string;
    available: string[];
    fallbackOrder: string[];
  };
  performance: {
    timeout: number;
    maxRetries: number;
    rateLimiting: RateLimitConfig;
    caching: CachingConfig;
  };
  security: SecurityConfig;
  logging: LoggingConfig;
  rawLogging: RawLoggingConfig;
}
```

## Future Enhancements
- Support for additional AI providers (Anthropic, Google, etc.)
- Advanced conversation threading and context management
- AI model fine-tuning integration
- Real-time collaboration features
- Advanced analytics and insights
- Cost optimization recommendations
- ✅ Multi-modal support (images, audio) - **IMPLEMENTED: Screenshot analysis with vision models**
- Advanced image analysis with OCR and element detection
- Video analysis for dynamic page interactions
- Audio processing for voice-controlled automation
- Plugin system for custom AI workflows
- Integration with vector databases for enhanced context
- Automated prompt optimization and testing
- Machine learning-based image preprocessing optimization
- Real-time collaborative screenshot annotation
- Integration with accessibility testing tools
