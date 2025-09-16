/**
 * AI Integration Module Type Definitions
 * 
 * This file contains all TypeScript type definitions for the AI Integration module
 * as specified in the design document: design/ai-integration-module.md
 */

// ============================================================================
// Connection Management Types
// ============================================================================

export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
  RATE_LIMITED = 'RATE_LIMITED'
}

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export enum FinishReason {
  STOP = 'stop',
  LENGTH = 'length',
  CONTENT_FILTER = 'content_filter',
  ERROR = 'error'
}

export enum AIErrorType {
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  MODEL_ERROR = 'MODEL_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  CONTENT_FILTER = 'CONTENT_FILTER'
}

export interface AIConnection {
  connectionId: string;
  apiKey: string;
  organizationId?: string;
  baseUrl: string;
  model: string;
  createdAt: Date;
  lastUsed: Date;
  status: ConnectionStatus;
  metadata?: Record<string, any>;
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  tokensPerMinute: number;
  maxConcurrentRequests: number;
  queueEnabled: boolean;
  queueMaxSize: number;
}

export interface AIConnectionConfig {
  apiKey: string;
  organizationId?: string;
  baseUrl?: string; // Default: https://api.openai.com/v1
  model: string; // e.g., 'gpt-4', 'gpt-3.5-turbo'
  timeout: number; // Request timeout in milliseconds
  maxRetries: number; // Maximum retry attempts
  retryDelay: number; // Delay between retries in milliseconds
  rateLimiting: RateLimitConfig;
  streamingEnabled: boolean;
  logLevel: LogLevel;
  rawLogging: RawLoggingConfig;
}

export interface ConnectionTestResult {
  success: boolean;
  latency: number; // milliseconds
  model: string;
  error?: string;
  timestamp: Date;
}

// ============================================================================
// Request/Response Types
// ============================================================================

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

export interface AIRequestParameters {
  temperature?: number; // 0.0 to 2.0
  maxTokens?: number;
  topP?: number; // 0.0 to 1.0
  frequencyPenalty?: number; // -2.0 to 2.0
  presencePenalty?: number; // -2.0 to 2.0
  stop?: string | string[];
  stream?: boolean;
}

export interface AIRequest {
  messages: AIMessage[];
  parameters?: AIRequestParameters;
  metadata?: Record<string, any>;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost?: number; // USD
}

export interface AIResponse {
  id: string;
  content: string;
  model: string;
  usage: TokenUsage;
  finishReason: FinishReason;
  timestamp: Date;
  processingTime: number; // milliseconds
  metadata?: Record<string, any>;
}

export interface AIStreamChunk {
  id: string;
  delta: string;
  isComplete: boolean;
  usage?: TokenUsage;
  timestamp: Date;
}

// ============================================================================
// Model Management Types
// ============================================================================

export interface AIModel {
  id: string;
  name: string;
  description: string;
  maxTokens: number;
  costPerToken: number;
  capabilities: string[];
  deprecated: boolean;
  created: Date;
}

export interface AIModelInfo {
  id: string;
  name: string;
  description: string;
  maxTokens: number;
  costPer1KTokens: {
    input: number;
    output: number;
  };
  capabilities: ModelCapability[];
  limitations: string[];
  recommendedUse: string[];
  deprecated: boolean;
  replacementModel?: string;
}

export interface ModelCapability {
  type: string;
  description: string;
  supported: boolean;
}

// ============================================================================
// Usage Monitoring Types
// ============================================================================

export interface DailyUsageStats {
  date: Date;
  requests: number;
  tokens: number;
  cost: number;
  averageResponseTime: number;
}

export interface AIUsageStats {
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

export interface RateLimitStatus {
  requestsRemaining: number;
  tokensRemaining: number;
  resetTime: Date;
  currentQueueSize: number;
  isThrottled: boolean;
}

// ============================================================================
// Error Handling Types
// ============================================================================

export interface AIError {
  type: AIErrorType;
  message: string;
  code?: string;
  retryable: boolean;
  details: any;
  timestamp: Date;
  connectionId: string;
}

export interface RetryPolicy {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface SecurityConfig {
  encryptApiKeys: boolean;
  allowedOrigins: string[];
  requestValidation: boolean;
  sanitizeResponses: boolean;
}

export interface LoggingConfig {
  level: LogLevel;
  format: 'json' | 'text';
  includeRequestDetails: boolean;
  includeResponseDetails: boolean;
  logToFile: boolean;
  logFilePath?: string;
  maxLogFileSize: number; // bytes
  maxLogFiles: number;
}

export interface RawLoggingConfig {
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

export interface CachingConfig {
  enabled: boolean;
  ttl: number; // Time to live in milliseconds
  maxSize: number; // Maximum cache size in MB
  strategy: 'lru' | 'lfu' | 'ttl';
  persistToDisk: boolean;
  cacheDirectory?: string;
}

export interface AIIntegrationConfig {
  defaultModel: string;
  globalTimeout: number;
  defaultRateLimit: RateLimitConfig;
  retryPolicy: RetryPolicy;
  loggingConfig: LoggingConfig;
  securityConfig: SecurityConfig;
  cachingConfig: CachingConfig;
  rawLoggingConfig: RawLoggingConfig;
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
}

// ============================================================================
// Interface Definitions
// ============================================================================

export interface ConnectionManager {
  createConnection(config: AIConnectionConfig): Promise<string>;
  getConnection(connectionId: string): AIConnection | null;
  testConnection(connectionId: string): Promise<ConnectionTestResult>;
  destroyConnection(connectionId: string): Promise<void>;
  listActiveConnections(): string[];
}

export interface IAIIntegrationManager {
  // Connection Management
  createConnection(config: AIConnectionConfig): Promise<string>;
  destroyConnection(connectionId: string): Promise<void>;
  testConnection(connectionId: string): Promise<ConnectionTestResult>;
  
  // Request Processing
  sendRequest(connectionId: string, request: AIRequest): Promise<AIResponse>;
  sendStreamRequest(connectionId: string, request: AIRequest): AsyncGenerator<AIStreamChunk>;
  
  // Model Management
  listAvailableModels(connectionId: string): Promise<AIModel[]>;
  getModelInfo(connectionId: string, modelId: string): Promise<AIModelInfo>;
  
  // Usage Monitoring
  getUsageStats(connectionId: string): Promise<AIUsageStats>;
  getRateLimitStatus(connectionId: string): Promise<RateLimitStatus>;
  
  // Configuration
  updateConnectionConfig(connectionId: string, config: Partial<AIConnectionConfig>): Promise<void>;
  getConnectionConfig(connectionId: string): AIConnectionConfig | null;
  
  // Raw Request/Response Logging
  enableRawLogging(connectionId: string, logConfig: RawLoggingConfig): Promise<void>;
  disableRawLogging(connectionId: string): Promise<void>;
  getRawLogFiles(connectionId: string, dateRange?: [Date, Date]): Promise<string[]>;
  cleanupRawLogs(connectionId: string, olderThan: Date): Promise<void>;
}

// ============================================================================
// Advanced Features Types
// ============================================================================

export interface ConversationManager {
  createConversation(connectionId: string): Promise<string>;
  addMessage(conversationId: string, message: AIMessage): Promise<void>;
  getConversationHistory(conversationId: string): Promise<AIMessage[]>;
  clearConversation(conversationId: string): Promise<void>;
  deleteConversation(conversationId: string): Promise<void>;
  listConversations(connectionId: string): Promise<string[]>;
}

export interface CacheStats {
  hitRate: number;
  missRate: number;
  totalRequests: number;
  cacheSize: number; // in MB
  itemCount: number;
  oldestEntry: Date;
  newestEntry: Date;
}

export interface ResponseCache {
  cacheResponse(requestHash: string, response: AIResponse): Promise<void>;
  getCachedResponse(requestHash: string): Promise<AIResponse | null>;
  invalidateCache(pattern: string): Promise<void>;
  getCacheStats(): Promise<CacheStats>;
  clearCache(): Promise<void>;
}

export interface PerformanceMetrics {
  connectionId: string;
  timeRange: [Date, Date];
  totalRequests: number;
  averageResponseTime: number;
  medianResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  successRate: number;
  throughput: number; // requests per minute
  tokenUsageRate: number; // tokens per minute
}

export interface RequestAnalytics {
  trackRequest(connectionId: string, request: AIRequest, response: AIResponse): Promise<void>;
  getPerformanceMetrics(connectionId: string, timeRange: [Date, Date]): Promise<PerformanceMetrics>;
  generateUsageReport(connectionId: string, format: 'json' | 'csv' | 'pdf'): Promise<string>;
  getErrorAnalysis(connectionId: string, timeRange: [Date, Date]): Promise<ErrorAnalysis>;
}

export interface ErrorAnalysis {
  totalErrors: number;
  errorsByType: Record<AIErrorType, number>;
  errorsByTimeOfDay: Record<string, number>;
  mostCommonErrors: Array<{
    type: AIErrorType;
    message: string;
    count: number;
    firstOccurrence: Date;
    lastOccurrence: Date;
  }>;
  resolutionSuggestions: string[];
}

// ============================================================================
// Integration Types
// ============================================================================

export interface ExecutorAIIntegration {
  analyzePageContext(connectionId: string, dom: string, screenshot: string): Promise<AIResponse>;
  generateAutomationSteps(connectionId: string, objective: string, context: string): Promise<string[]>;
  troubleshootError(connectionId: string, error: string, context: string): Promise<string>;
  optimizeSelector(connectionId: string, currentSelector: string, pageContext: string): Promise<string>;
}

export interface ContextAIIntegration {
  analyzeExecutionHistory(connectionId: string, context: any): Promise<AIResponse>;
  optimizeSteps(connectionId: string, executionHistory: any[]): Promise<string[]>;
  predictNextAction(connectionId: string, currentState: string): Promise<string>;
  generateInsights(connectionId: string, sessionData: any): Promise<ExecutionInsight[]>;
}

export interface ExecutionInsight {
  type: 'optimization' | 'warning' | 'suggestion' | 'error_prevention';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  actionable: boolean;
  recommendation?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// Rate Limiting Types
// ============================================================================

export interface RateLimitManager {
  checkRateLimit(connectionId: string): Promise<boolean>;
  waitForRateLimit(connectionId: string): Promise<void>;
  updateUsage(connectionId: string, usage: TokenUsage): Promise<void>;
  getRemainingQuota(connectionId: string): Promise<RateLimitStatus>;
  resetLimits(connectionId: string): Promise<void>;
}

export interface QueueManager {
  enqueueRequest(connectionId: string, request: AIRequest): Promise<string>;
  dequeueRequest(connectionId: string): Promise<QueuedRequest | null>;
  getQueueSize(connectionId: string): number;
  clearQueue(connectionId: string): Promise<void>;
  getQueuedRequest(requestId: string): QueuedRequest | null;
}

export interface QueuedRequest {
  id: string;
  connectionId: string;
  request: AIRequest;
  priority: number;
  enqueuedAt: Date;
  estimatedProcessingTime?: Date;
}

// ============================================================================
// Event Types
// ============================================================================

export interface AIIntegrationEvent {
  type: AIIntegrationEventType;
  connectionId: string;
  timestamp: Date;
  data: any;
}

export enum AIIntegrationEventType {
  CONNECTION_CREATED = 'CONNECTION_CREATED',
  CONNECTION_DESTROYED = 'CONNECTION_DESTROYED',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  REQUEST_SENT = 'REQUEST_SENT',
  RESPONSE_RECEIVED = 'RESPONSE_RECEIVED',
  RATE_LIMIT_HIT = 'RATE_LIMIT_HIT',
  CACHE_HIT = 'CACHE_HIT',
  CACHE_MISS = 'CACHE_MISS',
  STREAM_STARTED = 'STREAM_STARTED',
  STREAM_ENDED = 'STREAM_ENDED',
  ERROR_OCCURRED = 'ERROR_OCCURRED'
}

export interface EventEmitter {
  on(event: AIIntegrationEventType, listener: (event: AIIntegrationEvent) => void): void;
  off(event: AIIntegrationEventType, listener: (event: AIIntegrationEvent) => void): void;
  emit(event: AIIntegrationEventType, data: any): void;
}

// ============================================================================
// Raw Logging Types
// ============================================================================

export interface RawLogEntry {
  timestamp: Date;
  requestId: string;
  connectionId: string;
  type: 'request' | 'response' | 'stream_chunk';
  sequenceNumber?: number;
  data: any;
  metadata: RawLogMetadata;
}

export interface RawLogMetadata {
  model: string;
  endpoint: string;
  contentLength: number;
  encrypted: boolean;
  compressed: boolean;
  version: string;
  sessionId?: string;
  userAgent?: string;
}

export interface RawLogger {
  logRequest(connectionId: string, requestId: string, request: AIRequest): Promise<void>;
  logResponse(connectionId: string, requestId: string, response: AIResponse): Promise<void>;
  logStreamChunk(connectionId: string, requestId: string, chunk: AIStreamChunk): Promise<void>;
  rotateLogFiles(connectionId: string): Promise<void>;
  compressOldLogs(connectionId: string): Promise<void>;
  cleanupExpiredLogs(connectionId: string): Promise<void>;
  getLogFiles(connectionId: string, dateRange?: [Date, Date]): Promise<string[]>;
  createLogDirectory(connectionId: string): Promise<void>;
}

export interface LogFileInfo {
  path: string;
  size: number;
  created: Date;
  modified: Date;
  compressed: boolean;
  encrypted: boolean;
  entryCount: number;
}

export interface LogRetentionManager {
  checkRetentionPolicy(connectionId: string): Promise<void>;
  cleanupExpiredFiles(connectionId: string, retentionDays: number): Promise<string[]>;
  compressOldFiles(connectionId: string, compressAfterDays: number): Promise<string[]>;
  generateRetentionReport(connectionId: string): Promise<LogRetentionReport>;
}

export interface LogRetentionReport {
  connectionId: string;
  totalLogFiles: number;
  totalLogSize: number; // bytes
  oldestLogDate: Date;
  newestLogDate: Date;
  compressedFiles: number;
  encryptedFiles: number;
  filesToCleanup: string[];
  estimatedSpaceSavings: number; // bytes
}

// ============================================================================
// Utility Types
// ============================================================================

export type RequestId = string;
export type ConnectionId = string;
export type ConversationId = string;
export type ModelId = string;

export interface RequestMetadata {
  requestId: RequestId;
  connectionId: ConnectionId;
  initiatedAt: Date;
  source: string;
  userAgent?: string;
  sessionId?: string;
}

export interface ResponseMetadata {
  requestId: RequestId;
  connectionId: ConnectionId;
  completedAt: Date;
  processedBy: string;
  cacheHit: boolean;
  retryCount: number;
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  suggestion?: string;
}

export interface RequestValidator {
  validateRequest(request: AIRequest): ValidationResult;
  validateConfig(config: AIConnectionConfig): ValidationResult;
  validateApiKey(apiKey: string): ValidationResult;
}
