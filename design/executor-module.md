# Executor Module Design Document

## Overview
The Executor module provides a Playwright-based automation engine that manages browser sessions and executes web automation commands. It supports session management, command execution, variable interpolation, and comprehensive error handling with detailed logging.

## Core Responsibilities
- Create and manage Playwright browser sessions
- Execute web automation commands on specific sessions
- Handle variable storage and interpolation in selectors
- Capture and manage screenshots after each action execution
- Provide comprehensive error handling and context
- Maintain detailed logging with multiple log levels
- Return full DOM state and screenshot ID after each interaction

## Module Interface

### Session Management (STANDARDIZED)
```typescript
// Import standardized session management types
import { 
  ISessionManager,
  ModuleSessionInfo,
  SessionStatus,
  SessionLifecycleCallbacks,
  ModuleSessionConfig
} from './shared-types';

interface ExecutorSession extends ModuleSessionInfo {
  moduleId: 'executor';
  browser: Browser;
  page: Page;
  variables: Map<string, string>;
  // Inherits: sessionId, linkedWorkflowSessionId, status, createdAt, lastActivity, metadata
}

interface IExecutorSessionManager extends ISessionManager {
  readonly moduleId: 'executor';
  
  // Standardized session management (inherited)
  createSession(workflowSessionId: string, config?: ExecutorConfig): Promise<string>;
  destroySession(workflowSessionId: string): Promise<void>;
  getSession(workflowSessionId: string): ModuleSessionInfo | null;
  sessionExists(workflowSessionId: string): boolean;
  
  // Executor-specific session access
  getExecutorSession(workflowSessionId: string): ExecutorSession | null;
  listActiveSessions(): string[];
}
```

### Command Interface
```typescript
interface ExecutorCommand {
  sessionId: string;
  action: CommandAction;
  parameters: CommandParameters;
}

// Import standardized error handling
import { StandardError, ErrorCategory, ErrorSeverity, ERROR_CODES } from './shared-types';

interface CommandResponse {
  success: boolean;
  commandId: string;              // FIXED: Added for tracking consistency
  dom: string;                    // Full DOM of current page
  screenshotId: string;           // Unique ID of screenshot taken after action execution
  duration: number;               // FIXED: Execution time in ms for consistency
  error?: StandardError;          // FIXED: Uses shared StandardError
  metadata?: Record<string, any>; // FIXED: Added for extensibility
}
```

### Command Types
```typescript
enum CommandAction {
  OPEN_PAGE = 'OPEN_PAGE',
  CLICK_ELEMENT = 'CLICK_ELEMENT',
  INPUT_TEXT = 'INPUT_TEXT',
  SAVE_VARIABLE = 'SAVE_VARIABLE',
  GET_DOM = 'GET_DOM'
}

interface CommandParameters {
  url?: string;           // For OPEN_PAGE
  selector?: string;      // For CLICK_ELEMENT, INPUT_TEXT, SAVE_VARIABLE
  text?: string;          // For INPUT_TEXT
  variableName?: string;  // For SAVE_VARIABLE
}
```

## Core Functionality

### 1. Session Creation
- Create new Playwright browser instance
- Initialize new page
- Generate unique session ID
- Initialize empty variables map
- Return session ID for future operations

### 2. Command Execution
The executor supports these primary commands:

#### Open Web Page
```typescript
async openPage(sessionId: string, url: string): Promise<CommandResponse>
```
- Navigate to specified URL
- Wait for page load
- Capture screenshot and save to filesystem with unique ID
- Return full DOM state and screenshot ID

#### Click Element
```typescript
async clickElement(sessionId: string, selector: string): Promise<CommandResponse>
```
- Resolve variables in selector
- Locate element by selector
- Perform click action
- Capture screenshot and save to filesystem with unique ID
- Return updated DOM state and screenshot ID

#### Input Text
```typescript
async inputText(sessionId: string, selector: string, text: string): Promise<CommandResponse>
```
- Resolve variables in selector and text
- Locate input field by selector
- Clear existing text and input new text
- Capture screenshot and save to filesystem with unique ID
- Return updated DOM state and screenshot ID

#### Save Variable
```typescript
async saveVariable(sessionId: string, selector: string, variableName: string): Promise<CommandResponse>
```
- Resolve variables in selector
- Extract text/value from element
- Store in session variables map
- Capture screenshot and save to filesystem with unique ID
- Return current DOM state and screenshot ID

### 3. Variable Interpolation
- Support `${variable_name}` syntax in all selectors and text inputs
- Replace variables before processing selectors
- Maintain session-specific variable scope
- Support nested variable references

### 4. Screenshot Management
The executor automatically captures screenshots after each action execution:

#### Screenshot Capture Process
```typescript
async captureScreenshot(sessionId: string, actionType: CommandAction): Promise<string>
```
- Generate unique screenshot ID using format: `{sessionId}_{timestamp}_{actionType}_{uuid}`
- Capture full page or viewport screenshot based on configuration
- Save screenshot to configured directory with generated filename
- Store screenshot metadata (dimensions, file size, timestamp)
- Return unique screenshot ID for reference

#### Screenshot Storage Strategy
- **Filename Format**: Configurable template supporting variables:
  - `{sessionId}` - Session identifier
  - `{timestamp}` - ISO timestamp or epoch
  - `{actionType}` - Type of action executed
  - `{uuid}` - Unique identifier
- **Directory Structure**: Organized by session or date
- **File Formats**: Support PNG and JPEG with quality settings
- **Metadata Storage**: JSON sidecar files or database entries

#### Screenshot Cleanup
- **Automatic Cleanup**: Configurable policies for old screenshot removal
- **Size Management**: Remove screenshots exceeding session limits
- **Age-based**: Delete screenshots older than specified duration
- **Manual Cleanup**: API methods for explicit screenshot management

### 5. Error Handling
All methods must handle and categorize errors:

#### Playwright Errors
- Selector not found
- Element not interactable
- Timeout errors
- Network errors

#### Application Errors
- Invalid session ID
- Invalid selector syntax
- Variable not found
- Browser crash/disconnect

#### Error Response Format (FIXED: Uses StandardError)
```typescript
// Executor Error Handler using shared framework
class ExecutorErrorHandler {
  createStandardError(code: string, message: string, details?: Record<string, any>, cause?: Error): StandardError {
    return {
      id: crypto.randomUUID(),
      category: this.categorizeError(code),
      severity: this.determineSeverity(code),
      code: ERROR_CODES.EXECUTOR[code] || code,
      message,
      details,
      cause: cause ? this.wrapError(cause) : undefined,
      timestamp: new Date(),
      moduleId: 'executor',
      recoverable: this.isRecoverable(code),
      retryable: this.isRetryable(code),
      suggestedAction: this.getSuggestedAction(code)
    };
  }

  private categorizeError(code: string): ErrorCategory {
    const validationErrors = ['SELECTOR_NOT_FOUND', 'ELEMENT_NOT_INTERACTABLE'];
    const executionErrors = ['PAGE_LOAD_TIMEOUT', 'SCREENSHOT_FAILED'];
    const systemErrors = ['BROWSER_LAUNCH_FAILED'];
    
    if (validationErrors.includes(code)) return ErrorCategory.VALIDATION;
    if (executionErrors.includes(code)) return ErrorCategory.EXECUTION;
    if (systemErrors.includes(code)) return ErrorCategory.SYSTEM;
    return ErrorCategory.INTEGRATION;
  }

  private determineSeverity(code: string): ErrorSeverity {
    const criticalErrors = ['BROWSER_LAUNCH_FAILED'];
    const highErrors = ['PAGE_LOAD_TIMEOUT'];
    const mediumErrors = ['SELECTOR_NOT_FOUND', 'ELEMENT_NOT_INTERACTABLE'];
    
    if (criticalErrors.includes(code)) return ErrorSeverity.CRITICAL;
    if (highErrors.includes(code)) return ErrorSeverity.HIGH;
    if (mediumErrors.includes(code)) return ErrorSeverity.MEDIUM;
    return ErrorSeverity.LOW;
  }

  private isRecoverable(code: string): boolean {
    const unrecoverableErrors = ['BROWSER_LAUNCH_FAILED'];
    return !unrecoverableErrors.includes(code);
  }

  private isRetryable(code: string): boolean {
    const retryableErrors = ['PAGE_LOAD_TIMEOUT', 'SCREENSHOT_FAILED'];
    return retryableErrors.includes(code);
  }

  private getSuggestedAction(code: string): string {
    const actions = {
      'BROWSER_LAUNCH_FAILED': 'Check browser installation and permissions',
      'SELECTOR_NOT_FOUND': 'Verify element selector and wait for page load',
      'ELEMENT_NOT_INTERACTABLE': 'Wait for element to become visible and enabled',
      'PAGE_LOAD_TIMEOUT': 'Check network connection and increase timeout',
      'SCREENSHOT_FAILED': 'Verify screenshot directory permissions'
    };
    return actions[code] || 'Check system resources and retry';
  }

  private wrapError(cause: Error): StandardError {
    return this.createStandardError(
      'WRAPPED_ERROR',
      `Wrapped error: ${cause.message}`,
      { originalError: cause.name, stack: cause.stack },
      undefined
    );
  }
}
```

## Logging Requirements

### Log Levels
- **DEBUG**: Detailed execution steps, variable interpolation
- **INFO**: Command execution, session operations
- **WARN**: Recoverable errors, performance issues
- **ERROR**: Command failures, critical errors

### Log Format
All log entries must start with `[Executor]` prefix:
```
[Executor][LEVEL] [SessionID] Message with context
```

Examples:
```
[Executor][INFO] [session-123] Opening page: https://example.com
[Executor][DEBUG] [session-123] Interpolating selector: input[name="${username_field}"] -> input[name="email"]
[Executor][ERROR] [session-123] Click failed: Selector 'button.submit' not found
[Executor][WARN] [session-123] Page load took 8.5s, exceeding threshold
```

## Implementation Guidelines

### Modular Structure
```
/src/modules/executor/
  ├── index.ts              # Main executor interface
  ├── session-manager.ts    # Session lifecycle management
  ├── command-processor.ts  # Command execution logic
  ├── variable-resolver.ts  # Variable interpolation
  ├── screenshot-manager.ts # Screenshot capture and management
  ├── error-handler.ts      # Error categorization and context
  ├── logger.ts             # Logging implementation
  └── types.ts              # TypeScript type definitions
```

### Dependencies
- playwright: Browser automation
- uuid: Session ID generation
- winston or similar: Structured logging
- fs/path: File system operations for screenshot storage
- sharp (optional): Image optimization and processing

### Configuration (FIXED: Extends BaseModuleConfig)
```typescript
// Import shared configuration pattern
import { BaseModuleConfig, DEFAULT_TIMEOUT_CONFIG } from './shared-types';

interface ExecutorConfig extends BaseModuleConfig {
  moduleId: 'executor';
  
  // Executor specific configuration
  browser: {
    type: 'chromium' | 'firefox' | 'webkit';
    headless: boolean;
    sessionTTL: number; // Session time-to-live in milliseconds
    maxSessions: number;
  };
  screenshots: ScreenshotConfig;
  
  // Inherits from BaseModuleConfig:
  // - logging: LoggingConfig
  // - performance: PerformanceConfig  
  // - timeouts: TimeoutConfig (provides proper timeout hierarchy)
}

// Default configuration
const DEFAULT_EXECUTOR_CONFIG: ExecutorConfig = {
  moduleId: 'executor',
  version: '1.0.0',
  enabled: true,
  
  browser: {
    type: 'chromium',
    headless: true,
    sessionTTL: 1800000, // 30 minutes
    maxSessions: 10
  },
  
  screenshots: {
    enabled: true,
    directory: './screenshots',
    format: 'png',
    fullPage: true,
    nameTemplate: '{sessionId}_{timestamp}_{actionType}_{uuid}',
    cleanup: {
      enabled: true,
      maxAge: 86400000, // 24 hours
      maxCount: 100,
      schedule: 'daily'
    }
  },
  
  timeouts: DEFAULT_TIMEOUT_CONFIG,
  
  logging: {
    level: LogLevel.INFO,
    prefix: '[Executor]',
    includeTimestamp: true,
    includeSessionId: true,
    includeModuleId: true,
    structured: false
  },
  
  performance: {
    maxConcurrentOperations: 10,
    cacheEnabled: false,
    cacheTTLMs: 0,
    metricsEnabled: true
  }
}

interface ScreenshotConfig {
  enabled: boolean;
  directory: string; // Directory to save screenshots
  format: 'png' | 'jpeg';
  quality?: number; // For JPEG format (0-100)
  fullPage: boolean; // Capture full page or just viewport
  nameTemplate: string; // Template for screenshot filename
  cleanup: ScreenshotCleanupConfig;
}

interface ScreenshotCleanupConfig {
  enabled: boolean;
  maxAge: number; // Maximum age in milliseconds
  maxCount: number; // Maximum number of screenshots per session
  schedule: 'immediate' | 'daily' | 'weekly'; // Cleanup schedule
}
```

## Testing Requirements
- Unit tests for all command types
- Session management lifecycle tests
- Variable interpolation edge cases
- Screenshot capture and storage tests
- Screenshot cleanup functionality tests
- Error handling scenarios
- Logging output verification
- Performance benchmarks for command execution
- File system operations and cleanup validation

## Security Considerations
- Sanitize all user inputs before passing to Playwright
- Validate selector syntax to prevent injection
- Implement session isolation
- Secure variable storage per session
- Rate limiting for command execution

## Performance Requirements
- Command execution should complete within 30 seconds
- Screenshot capture should not add more than 2 seconds to command execution
- Support up to 10 concurrent sessions
- Memory cleanup for destroyed sessions
- Efficient DOM serialization for large pages
- Automatic screenshot cleanup to prevent disk space issues

## Future Enhancements
- Screenshot comparison and visual diff detection
- Video recording of automation sessions
- OCR-based text extraction from screenshots
- Advanced selector strategies (XPath, CSS, accessibility)
- Conditional command execution
- Parallel command execution within sessions
- Screenshot annotation and markup
- Thumbnail generation for screenshot galleries
