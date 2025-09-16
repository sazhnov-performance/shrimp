# UI Automation Interface Design Document (SIMPLIFIED)

## Overview
The UI Automation Interface provides a minimal, focused web interface for the single use case:
1. User enters automation steps in natural language
2. User clicks "GOOOO" button to execute
3. System streams real-time execution logs

## Core Responsibilities (SIMPLIFIED)
- Provide simple step input textarea
- Execute automation workflows via Frontend API  
- Display real-time streaming output from execution
- Handle basic execution states (idle, executing, completed, failed)
- Show AI reasoning, commands, and basic execution feedback

## UI Components (SIMPLIFIED)

### 1. Step Input Component
```typescript
// FIXED: Use shared types from frontend-api.md
import { StepProcessingRequest } from './shared-types';

interface SimpleStepInputComponent {
  // Input Management
  stepText: string;
  setStepText: (text: string) => void;
  
  // Execution Control  
  onExecute: () => Promise<void>;
  isExecuting: boolean;
  
  // Basic validation
  isEmpty: boolean;
  error: string | null;
}
```

#### Visual Design:
- **Layout**: Simple textarea, auto-resizing
- **Styling**: Clean, minimal design
- **Execute Button**: Large "GOOOO" button, disabled during execution
- **Basic Error Display**: Simple error message below textarea if needed

### 2. Streaming Output Component (SIMPLIFIED)
```typescript
// FIXED: Use shared types from frontend-api.md
import { StreamEvent, StreamEventType } from './shared-types';

interface SimpleStreamingOutputComponent {
  // Stream Data
  events: StreamEvent[];                    // FIXED: Use shared type
  sessionId: string | null;
  streamConnection: WebSocket | null;
  
  // Simple Display State
  autoScroll: boolean;
  isConnected: boolean;
  error: string | null;
}
```

#### Visual Design:
- **Layout**: Scrollable log area, fixed height
- **Event Display**: Simple text-based log entries with timestamps
- **Auto-scroll**: Always scroll to bottom on new events
- **Connection Status**: Simple indicator if stream is connected

## Page Layout (SIMPLIFIED)

### Main Interface Layout
```typescript
interface SimpleAutomationInterfaceLayout {
  stepInput: SimpleStepInputSection;
  streamingOutput: SimpleStreamingOutputSection;
}

interface SimpleStepInputSection {
  height: 'auto'; // Auto-sizing textarea
  position: 'top';
  components: [
    StepTextarea,
    ExecuteButton
  ];
}

interface SimpleStreamingOutputSection {
  height: 'calc(100vh - 200px)'; // Remaining height
  position: 'bottom';
  components: [
    EventLogStream
  ];
}
```

### Layout Structure
- **Top**: Step input textarea + GOOOO button
- **Bottom**: Streaming log output
- **No complex responsive breakpoints** - works on desktop first

## Event Display Types (SIMPLIFIED)

### Simple Log Entry Format
```typescript
// FIXED: Use shared event types and consistent formatting
import { StreamEvent, StreamEventType } from './shared-types';

interface SimpleLogEntry {
  timestamp: string;
  type: StreamEventType;           // FIXED: Use shared enum
  message: string;
  level: 'info' | 'success' | 'warning' | 'error';
}

// Simple formatting function
function formatLogEntry(event: StreamEvent): SimpleLogEntry {
  const timestamp = new Date(event.timestamp).toLocaleTimeString();
  
  switch (event.type) {
    case 'AI_REASONING':
      return {
        timestamp,
        type: event.type,
        message: `🧠 AI: ${event.data.thought}`,
        level: 'info'
      };
      
    case 'COMMAND_STARTED':
      return {
        timestamp,
        type: event.type,
        message: `⚡ Starting: ${event.data.action}`,
        level: 'info'
      };
      
    case 'COMMAND_COMPLETED':
      return {
        timestamp,
        type: event.type,
        message: `✅ Completed: ${event.data.action}`,
        level: 'success'
      };
      
    case 'COMMAND_FAILED':
      return {
        timestamp,
        type: event.type,
        message: `❌ Failed: ${event.data.action} - ${event.data.error}`,
        level: 'error'
      };
      
    default:
      return {
        timestamp,
        type: event.type,
        message: `ℹ️ ${event.type}: ${JSON.stringify(event.data)}`,
        level: 'info'
      };
  }
}
```

## Integration Interfaces (SIMPLIFIED)

### Frontend API Integration
```typescript
// FIXED: Use exact types from frontend-api.md
import { 
  StepProcessingRequest, 
  ExecuteStepsResponse, 
  StreamEvent, 
  APIResponse 
} from './shared-types';

interface SimpleFrontendAPIIntegration {
  // Execute steps (single endpoint from frontend-api.md)
  executeSteps(request: StepProcessingRequest): Promise<ExecuteStepsResponse>;
  
  // WebSocket connection for streaming
  connectToStream(streamId: string): Promise<WebSocket>;
  onEvent(callback: (event: StreamEvent) => void): void;
  onError(callback: (error: string) => void): void;
}

// Simple request builder
function buildExecuteRequest(stepText: string): StepProcessingRequest {
  return {
    steps: stepText.split('\n').filter(step => step.trim()),
    config: {
      maxExecutionTime: 300000,     // 5 minutes  
      enableStreaming: true,
      enableReflection: true,
      retryOnFailure: false
    }
  };
}
```

## State Management (SIMPLIFIED)

### Application State
```typescript
// FIXED: Minimal state aligned with simple use case and shared types
import { StreamEvent, SessionStatus } from './shared-types';

interface SimpleUIState {
  // Step Input
  stepText: string;
  
  // Execution
  sessionId: string | null;
  streamId: string | null; 
  isExecuting: boolean;
  
  // Streaming
  events: StreamEvent[];                    // FIXED: Use shared type
  isConnected: boolean;
  
  // Error handling
  error: string | null;
}

// Simple state actions
interface UIActions {
  setStepText: (text: string) => void;
  executeSteps: () => Promise<void>;
  addEvent: (event: StreamEvent) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}
```

## Error Handling (SIMPLIFIED)

### Basic Error Display
```typescript
// FIXED: Use shared error types from frontend-api.md
import { APIError } from './shared-types';

interface SimpleErrorHandling {
  // Display simple error messages
  displayError: (error: string | APIError) => void;
  clearError: () => void;
  
  // Connection error handling
  handleConnectionLoss: () => void;
  handleReconnect: () => void;
}

// Simple error messages for common cases
const ERROR_MESSAGES = {
  EMPTY_STEPS: 'Please enter some automation steps',
  EXECUTION_FAILED: 'Automation execution failed',
  CONNECTION_LOST: 'Connection lost - trying to reconnect...',
  INVALID_RESPONSE: 'Invalid response from server'
};
```

## Implementation Plan (SIMPLIFIED)

### Core Implementation Steps
1. **Basic HTML Structure**
   - Simple textarea for step input
   - Large "GOOOO" button
   - Scrollable log output area

2. **JavaScript Integration**
   - Call `POST /api/automation/execute` with step text
   - Connect to WebSocket stream for real-time events
   - Display formatted log entries as they arrive

3. **Error Handling**
   - Show simple error messages
   - Handle connection failures gracefully
   - Basic retry on disconnect

### Minimal Feature Set
```typescript
// FIXED: Aligned with frontend-api.md endpoints
const REQUIRED_FEATURES = [
  'Step text input',
  'Execute button (calls /api/automation/execute)',
  'WebSocket streaming (/api/stream/ws/:streamId)',
  'Simple log display',
  'Basic error handling'
];

const REMOVED_FEATURES = [
  'Step templates',
  'Syntax highlighting', 
  'Advanced validation',
  'Screenshot modals',
  'Export functionality',
  'User preferences',
  'Complex responsive design',
  'Accessibility enhancements',
  'Performance optimizations'
];
```

## Simple Implementation Timeline

### Single Implementation Phase (Week 1)
**Day 1-2: Basic Structure**
- Create simple HTML page with textarea and button
- Add basic CSS styling

**Day 3-4: API Integration** 
- Implement `executeSteps()` function calling Frontend API
- Add WebSocket connection for streaming
- Handle basic request/response flow

**Day 5-7: Log Display**
- Format streaming events as simple log entries  
- Add auto-scroll to bottom
- Basic error display

### Success Criteria
✅ User can enter steps and click GOOOO  
✅ System executes via Frontend API  
✅ Real-time logs appear in output area  
✅ Basic errors are shown to user  

### REMOVED Complex Features
- All advanced UI components
- Complex state management 
- Screenshot viewing/management
- Export/import functionality
- User preferences/customization
- Advanced error recovery
- Performance optimizations
- Accessibility enhancements

**Result: Simple, working automation interface focused solely on the core use case.**
