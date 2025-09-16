# UI Automation Interface Design Document

## Overview
The UI Automation Interface provides a simple, intuitive web interface for users to input automation steps and monitor real-time execution progress. It consists of two main components: a step input area where users can define their automation workflow, and a streaming output area that displays live execution feedback including commands, AI reasoning, and screenshots.

## Core Responsibilities
- Provide intuitive step input interface with validation
- Execute automation workflows via Step Processor module
- Display real-time streaming output from Executor Streamer
- Show execution progress, AI reasoning, and visual feedback
- Handle execution control (pause, resume, cancel)
- Manage session state and provide execution history
- Display screenshots and visual automation feedback
- Provide responsive design for various screen sizes

## UI Components

### 1. Step Input Component
```typescript
interface StepInputComponent {
  // Input Management
  stepText: string;
  setStepText: (text: string) => void;
  isValid: boolean;
  validationErrors: ValidationError[];
  
  // Execution Control
  onExecute: () => Promise<void>;
  isExecuting: boolean;
  canExecute: boolean;
  
  // UI State
  lineCount: number;
  maxLines: number; // 10 lines as specified
  placeholder: string;
}

interface ValidationError {
  line: number;
  message: string;
  type: 'warning' | 'error';
}
```

#### Visual Design:
- **Layout**: Fixed height textarea with 10 visible lines
- **Styling**: Modern dark theme with purple/pink accents matching existing design
- **Validation**: Real-time line-by-line validation with inline indicators
- **Execute Button**: Prominent gradient button, disabled during execution
- **Line Numbers**: Optional line numbering for better step reference

### 2. Streaming Output Component
```typescript
interface StreamingOutputComponent {
  // Stream Data
  events: StreamEvent[];
  currentSessionId: string | null;
  streamConnection: WebSocket | EventSource | null;
  
  // Display State
  autoScroll: boolean;
  filterSettings: OutputFilter;
  expandedEvents: Set<string>;
  
  // Screenshot Management
  screenshots: Map<string, ScreenshotInfo>;
  selectedScreenshot: string | null;
  screenshotModal: boolean;
}

interface OutputFilter {
  showReasoning: boolean;
  showCommands: boolean;
  showScreenshots: boolean;
  showErrors: boolean;
  showStatusUpdates: boolean;
}

interface StreamEvent {
  id: string;
  type: StreamEventType;
  timestamp: Date;
  data: StreamEventData;
  processed: boolean;
}
```

#### Visual Design:
- **Layout**: Scrollable area filling remaining window height
- **Event Cards**: Distinct card design for different event types
- **Auto-scroll**: Smart auto-scroll that respects user interaction
- **Filtering**: Toggle controls for different event types
- **Screenshots**: Inline thumbnails with click-to-expand modal
- **Timestamps**: Relative time display with hover for absolute time

## Page Layout

### Main Interface Layout
```typescript
interface AutomationInterfaceLayout {
  header: HeaderComponent;
  stepInput: StepInputSection;
  streamingOutput: StreamingOutputSection;
  footer?: FooterComponent;
}

interface StepInputSection {
  height: '300px'; // Fixed height for 10 lines + controls
  position: 'top';
  components: [
    StepTextarea,
    ExecutionControls,
    ValidationFeedback
  ];
}

interface StreamingOutputSection {
  height: 'calc(100vh - 400px)'; // Remaining height
  position: 'bottom';
  components: [
    OutputFilters,
    EventStream,
    SessionControls
  ];
}
```

### Responsive Breakpoints
```typescript
interface ResponsiveBreakpoints {
  mobile: {
    maxWidth: '768px';
    layout: 'vertical-stack';
    stepInputHeight: '250px';
    adaptations: [
      'hide-line-numbers',
      'simplified-filters',
      'compact-event-cards'
    ];
  };
  tablet: {
    maxWidth: '1024px';
    layout: 'vertical-stack';
    stepInputHeight: '300px';
    adaptations: [
      'show-essential-filters',
      'medium-event-cards'
    ];
  };
  desktop: {
    minWidth: '1025px';
    layout: 'vertical-stack';
    stepInputHeight: '350px';
    adaptations: [
      'full-feature-set',
      'large-event-cards'
    ];
  };
}
```

## Event Display Types

### 1. AI Reasoning Events
```typescript
interface ReasoningEventDisplay {
  type: 'AI_REASONING';
  icon: 'brain-icon';
  color: 'purple-gradient';
  
  content: {
    thought: string;
    confidence: number; // Display as progress bar
    reasoning_type: 'analysis' | 'decision' | 'plan' | 'reflection';
    context?: Record<string, any>; // Collapsible JSON viewer
  };
  
  layout: {
    header: `🧠 AI Reasoning - ${reasoning_type}`;
    body: thought;
    footer: `Confidence: ${confidence}%`;
    expandable: context ? true : false;
  };
}
```

### 2. Command Execution Events
```typescript
interface CommandEventDisplay {
  type: 'COMMAND_STARTED' | 'COMMAND_COMPLETED' | 'COMMAND_FAILED';
  icon: 'terminal-icon';
  color: {
    STARTED: 'blue-gradient';
    COMPLETED: 'green-gradient';
    FAILED: 'red-gradient';
  };
  
  content: {
    commandName: string;
    action: CommandAction;
    parameters: Record<string, any>;
    status: CommandStatus;
    duration?: number;
    result?: any;
    error?: ErrorContext;
  };
  
  layout: {
    header: `⚡ ${commandName} - ${status}`;
    body: formatCommandDetails(action, parameters);
    footer: duration ? `Duration: ${duration}ms` : '';
    expandable: true;
  };
}
```

### 3. Screenshot Events
```typescript
interface ScreenshotEventDisplay {
  type: 'SCREENSHOT_CAPTURED';
  icon: 'camera-icon';
  color: 'cyan-gradient';
  
  content: {
    screenshotId: string;
    thumbnailUrl: string;
    fullImageUrl: string;
    actionType: string;
    dimensions: { width: number; height: number };
    fileSize: number;
  };
  
  layout: {
    header: `📸 Screenshot - ${actionType}`;
    body: ThumbnailImage;
    footer: `${dimensions.width}x${dimensions.height} (${formatFileSize(fileSize)})`;
    expandable: true; // Opens full-size modal
  };
}
```

### 4. Session Status Events
```typescript
interface StatusEventDisplay {
  type: 'SESSION_STATUS';
  icon: 'status-icon';
  color: 'gray-gradient';
  
  content: {
    status: ProcessingStatus;
    message?: string;
    progress?: {
      current: number;
      total: number;
      percentage: number;
    };
  };
  
  layout: {
    header: `ℹ️ Status Update - ${status}`;
    body: message || `Session ${status.toLowerCase()}`;
    footer: progress ? `Progress: ${progress.percentage}%` : '';
    expandable: false;
  };
}
```

## Integration Interfaces

### Step Processor Integration
```typescript
interface StepProcessorIntegration {
  // Send steps for execution
  executeSteps(steps: string[]): Promise<ExecutionResponse>;
  
  // Control execution
  pauseExecution(sessionId: string): Promise<void>;
  resumeExecution(sessionId: string): Promise<void>;
  cancelExecution(sessionId: string): Promise<void>;
  
  // Query status
  getSessionStatus(sessionId: string): Promise<SessionStatus>;
  getExecutionProgress(sessionId: string): Promise<ExecutionProgress>;
}

interface ExecutionResponse {
  sessionId: string;
  streamId?: string;
  initialStatus: ProcessingStatus;
  estimatedDuration?: number;
  createdAt: Date;
}
```

### Executor Streamer Integration
```typescript
interface ExecutorStreamerIntegration {
  // WebSocket connection management
  connectToStream(streamId: string): Promise<WebSocket>;
  disconnectFromStream(): void;
  
  // Event handling
  onEvent(callback: (event: StreamEvent) => void): void;
  onError(callback: (error: StreamError) => void): void;
  onConnectionChange(callback: (connected: boolean) => void): void;
  
  // Replay and history
  requestReplay(filters?: HistoryFilter): Promise<void>;
  getStreamHistory(streamId: string): Promise<StreamEvent[]>;
}
```

## State Management

### Application State
```typescript
interface AutomationUIState {
  // Step Input
  stepInput: {
    text: string;
    isValid: boolean;
    errors: ValidationError[];
    lineCount: number;
  };
  
  // Execution
  execution: {
    sessionId: string | null;
    streamId: string | null;
    status: ProcessingStatus;
    progress: ExecutionProgress | null;
    isExecuting: boolean;
    canPause: boolean;
    canResume: boolean;
    canCancel: boolean;
  };
  
  // Streaming
  streaming: {
    connected: boolean;
    events: StreamEvent[];
    autoScroll: boolean;
    filters: OutputFilter;
    expandedEvents: Set<string>;
  };
  
  // Screenshots
  screenshots: {
    items: Map<string, ScreenshotInfo>;
    selectedId: string | null;
    modalOpen: boolean;
    thumbnailSize: 'small' | 'medium' | 'large';
  };
  
  // UI
  ui: {
    theme: 'dark' | 'light';
    layout: 'compact' | 'comfortable';
    sidebarOpen: boolean;
    notificationsEnabled: boolean;
  };
}
```

### State Persistence
```typescript
interface StatePersistence {
  // Local Storage Keys
  STEP_INPUT_DRAFT: 'drums_step_input_draft';
  UI_PREFERENCES: 'drums_ui_preferences';
  RECENT_SESSIONS: 'drums_recent_sessions';
  
  // Persistence Methods
  saveStepDraft(text: string): void;
  loadStepDraft(): string;
  saveUIPreferences(prefs: UIPreferences): void;
  loadUIPreferences(): UIPreferences;
  saveRecentSession(session: SessionSummary): void;
  getRecentSessions(): SessionSummary[];
}
```

## User Experience Features

### 1. Step Input Enhancements
```typescript
interface StepInputFeatures {
  // Auto-complete
  autoComplete: {
    enabled: boolean;
    suggestions: string[];
    triggerChars: string[]; // ['.', ' ', '\n']
  };
  
  // Syntax highlighting
  syntaxHighlight: {
    enabled: boolean;
    highlightRules: SyntaxRule[];
  };
  
  // Templates
  stepTemplates: {
    common: StepTemplate[];
    custom: StepTemplate[];
    insertTemplate: (template: StepTemplate) => void;
  };
  
  // Validation
  realTimeValidation: {
    enabled: boolean;
    debounceMs: 300;
    showLineNumbers: boolean;
    highlightErrors: boolean;
  };
}

interface StepTemplate {
  name: string;
  description: string;
  steps: string[];
  category: 'navigation' | 'forms' | 'testing' | 'data-extraction';
}
```

### 2. Output Enhancements
```typescript
interface OutputFeatures {
  // Search and Filter
  search: {
    query: string;
    caseSensitive: boolean;
    useRegex: boolean;
    highlightResults: boolean;
  };
  
  // Export
  export: {
    formats: ['json', 'csv', 'html', 'pdf'];
    includeScreenshots: boolean;
    dateRange?: { start: Date; end: Date };
  };
  
  // Sharing
  sharing: {
    generateShareableLink: (sessionId: string) => string;
    exportSession: (format: ExportFormat) => Blob;
    copyEventDetails: (eventId: string) => void;
  };
  
  // Performance
  virtualization: {
    enabled: boolean;
    itemHeight: number;
    overscan: number;
    maxItems: number;
  };
}
```

### 3. Accessibility Features
```typescript
interface AccessibilityFeatures {
  // Keyboard Navigation
  keyboard: {
    shortcuts: KeyboardShortcut[];
    focusManagement: FocusManager;
    announcements: ScreenReaderAnnouncements;
  };
  
  // Visual Accessibility
  visual: {
    highContrast: boolean;
    reducedMotion: boolean;
    fontSizeMultiplier: number;
    colorBlindSafe: boolean;
  };
  
  // Screen Reader Support
  screenReader: {
    liveRegions: LiveRegion[];
    roleDescriptions: Map<string, string>;
    announceEvents: boolean;
  };
}

interface KeyboardShortcut {
  key: string;
  modifiers: ('ctrl' | 'alt' | 'shift' | 'meta')[];
  action: string;
  description: string;
}
```

## Error Handling

### User-Facing Errors
```typescript
interface UIErrorHandling {
  // Connection Errors
  connectionErrors: {
    streamDisconnected: () => void;
    stepProcessorUnavailable: () => void;
    networkTimeout: () => void;
  };
  
  // Validation Errors
  validationErrors: {
    invalidStepFormat: (line: number, message: string) => void;
    emptyStepList: () => void;
    tooManySteps: (max: number) => void;
  };
  
  // Execution Errors
  executionErrors: {
    sessionCreationFailed: (error: string) => void;
    executionTimeout: () => void;
    unexpectedFailure: (error: string) => void;
  };
  
  // UI Errors
  uiErrors: {
    screenshotLoadFailed: (screenshotId: string) => void;
    exportFailed: (format: string) => void;
    persistenceError: (operation: string) => void;
  };
}
```

### Error Recovery
```typescript
interface ErrorRecovery {
  // Automatic Recovery
  autoRecovery: {
    reconnectAttempts: number;
    retryDelay: number;
    exponentialBackoff: boolean;
  };
  
  // User-Initiated Recovery
  userRecovery: {
    retryExecution: () => Promise<void>;
    reconnectStream: () => Promise<void>;
    clearCache: () => void;
    restoreDefaults: () => void;
  };
  
  // Graceful Degradation
  degradation: {
    offlineMode: boolean;
    disableRealTime: boolean;
    simplifiedUI: boolean;
  };
}
```

## Performance Optimizations

### Rendering Optimizations
```typescript
interface RenderingOptimizations {
  // Virtual Scrolling
  virtualScrolling: {
    enabled: boolean;
    itemHeight: number;
    buffer: number;
    maxItems: number;
  };
  
  // Event Batching
  eventBatching: {
    enabled: boolean;
    batchSize: number;
    flushInterval: number;
  };
  
  // Image Optimization
  imageOptimization: {
    lazyLoading: boolean;
    thumbnailGeneration: boolean;
    compressionQuality: number;
    maxDisplaySize: { width: number; height: number };
  };
  
  // Memory Management
  memoryManagement: {
    maxEvents: number;
    cleanupInterval: number;
    screenshotCacheSize: number;
  };
}
```

## Configuration

### UI Configuration
```typescript
interface UIConfiguration {
  // Layout
  layout: {
    stepInputHeight: number;
    streamingOutputMaxHeight: number;
    eventCardHeight: number;
    thumbnailSize: number;
  };
  
  // Behavior
  behavior: {
    autoScrollEnabled: boolean;
    autoScrollPauseOnInteraction: boolean;
    realTimeValidation: boolean;
    saveStepDrafts: boolean;
  };
  
  // Performance
  performance: {
    enableVirtualScrolling: boolean;
    maxEventsInMemory: number;
    screenshotCacheSize: number;
    eventBatchSize: number;
  };
  
  // Appearance
  appearance: {
    theme: 'dark' | 'light' | 'auto';
    density: 'compact' | 'comfortable' | 'spacious';
    animations: boolean;
    colorScheme: 'purple' | 'blue' | 'green' | 'custom';
  };
}
```

## API Integration

### REST API Endpoints
```typescript
// UI-specific endpoints
GET    /api/ui/templates              // Get step templates
POST   /api/ui/validate-steps         // Validate step input
GET    /api/ui/session/:id/summary    // Get session summary
POST   /api/ui/session/:id/export     // Export session data

// Screenshot endpoints
GET    /api/screenshots/:id           // Get full screenshot
GET    /api/screenshots/:id/thumbnail // Get thumbnail
GET    /api/screenshots/session/:id   // Get session screenshots

// User preferences
GET    /api/user/preferences          // Get UI preferences
PUT    /api/user/preferences          // Update preferences
```

### WebSocket Protocol
```typescript
// Client messages
interface UIClientMessage {
  type: 'ui_preferences' | 'filter_update' | 'request_replay';
  filters?: OutputFilter;
  preferences?: UIPreferences;
  replayOptions?: HistoryFilter;
}

// Server messages specific to UI
interface UIServerMessage {
  type: 'ui_event' | 'preference_update' | 'theme_change';
  event?: EnhancedStreamEvent;
  preferences?: UIPreferences;
  theme?: ThemeData;
}
```

## Testing Strategy

### Component Testing
```typescript
interface ComponentTests {
  // Step Input Component
  stepInput: [
    'renders correctly',
    'validates input correctly', 
    'handles execute button states',
    'preserves input on reload',
    'shows validation errors',
    'supports keyboard shortcuts'
  ];
  
  // Streaming Output Component
  streamingOutput: [
    'displays events correctly',
    'filters events properly',
    'handles auto-scroll',
    'loads screenshots',
    'exports data correctly',
    'maintains performance with many events'
  ];
  
  // Integration Tests
  integration: [
    'step processor communication',
    'streaming connection management',
    'error handling flows',
    'session state management',
    'offline functionality',
    'accessibility compliance'
  ];
}
```

### User Experience Testing
```typescript
interface UXTests {
  usability: [
    'first-time user onboarding',
    'step input efficiency',
    'execution monitoring clarity',
    'error message helpfulness',
    'mobile responsiveness',
    'keyboard-only navigation'
  ];
  
  performance: [
    'initial page load time',
    'real-time update latency', 
    'memory usage over time',
    'screenshot loading speed',
    'large session handling',
    'concurrent user handling'
  ];
}
```

## Implementation Phases

### Phase 1: Core Interface (Week 1-2)
- Basic step input textarea with 10-line limit
- Execute button with Step Processor integration
- Simple streaming output with basic event display
- WebSocket connection to Executor Streamer
- Basic error handling and loading states

### Phase 2: Enhanced Display (Week 3-4)
- Rich event card designs for different event types
- Screenshot display with thumbnails and modal
- Event filtering and search functionality
- Auto-scroll with user interaction detection
- Responsive design for mobile and tablet

### Phase 3: Advanced Features (Week 5-6)
- Step input validation and syntax highlighting
- Step templates and auto-completion
- Session management and history
- Export and sharing capabilities
- Performance optimizations and virtual scrolling

### Phase 4: Polish and Accessibility (Week 7-8)
- Full accessibility compliance
- Comprehensive error handling and recovery
- User preferences and customization
- Performance monitoring and optimization
- Comprehensive testing and bug fixes

## Future Enhancements
- Visual step builder with drag-and-drop interface
- Collaborative editing for multi-user sessions
- Advanced analytics and execution insights
- Integration with external automation tools
- AI-powered step suggestions and optimizations
- Real-time collaboration with live cursors
- Voice control for hands-free operation
- Advanced screenshot comparison and diff tools
