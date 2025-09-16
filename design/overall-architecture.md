# Overall System Architecture

## Overview

This document provides a high-level overview of the AI-powered web automation system architecture. The system enables users to describe automation workflows in natural language, which are then executed by an AI-driven browser automation engine with real-time feedback and learning capabilities.

## System Components

### Core Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interface Layer                     │
├─────────────────────────────────────────────────────────────────┤
│                        API Gateway Layer                        │
├─────────────────────────────────────────────────────────────────┤
│                      Orchestration Layer                        │
├─────────────────────────────────────────────────────────────────┤
│                        AI Processing Layer                      │
├─────────────────────────────────────────────────────────────────┤
│                       Execution Layer                           │
├─────────────────────────────────────────────────────────────────┤
│                        Session Layer                            │
└─────────────────────────────────────────────────────────────────┘
```

## Module Overview

### 1. User Interface Layer
- **UI Automation Interface**: Web-based interface for step input and real-time monitoring
- **Frontend API**: REST API and WebSocket endpoints for UI communication

### 2. Orchestration Layer  
- **Step Processor**: Main workflow orchestrator that coordinates all modules
- **Session Coordinator**: Manages unified sessions across all modules

### 3. AI Processing Layer
- **Task Loop**: Implements ACT-REFLECT cycle for intelligent automation
- **AI Integration**: Manages communication with OpenAI APIs
- **AI Context Manager**: Tracks execution history and reasoning
- **AI Prompt Manager**: Generates context-aware prompts
- **AI Schema Manager**: Defines AI response schemas and validation

### 4. Execution Layer
- **Executor**: Browser automation engine using Playwright
- **Executor Streamer**: Real-time event streaming and monitoring

### 5. Session Layer
- **Shared Types**: Common interfaces and data structures
- **Session Management**: Standardized session coordination

## High-Level Data Flow

### 1. Workflow Initiation
```
User Input → UI Interface → Frontend API → Step Processor
```

1. User enters automation steps in natural language
2. UI validates and sends to Frontend API
3. Frontend API forwards to Step Processor
4. Step Processor creates unified workflow session

### 2. Session Coordination
```
Step Processor → Session Coordinator → All Modules
```

1. Session Coordinator creates workflow session with unique ID
2. Links module-specific sessions (executor, AI, streaming)
3. Each module initializes with consistent session context

### 3. Step Processing (ACT-REFLECT Cycle)
```
Task Loop ↔ AI Modules ↔ Executor → Context Manager → Executor Streamer
```

**ACT Phase:**
1. **Task Loop** requests prompt from **AI Prompt Manager**
2. **AI Prompt Manager** gets context from **AI Context Manager**
3. **Task Loop** sends prompt to **AI Integration** (OpenAI)
4. **AI Integration** returns response validated by **AI Schema Manager**
5. **Task Loop** extracts commands and sends to **Executor**
6. **Executor** performs browser actions and captures screenshots

**REFLECT Phase:**
1. **Task Loop** analyzes results and generates reflection prompt
2. AI evaluates success/failure and decides next action
3. If retry needed, cycle repeats; if successful, continues to next step

### 4. Real-Time Monitoring
```
All Modules → Executor Streamer → Frontend API → UI Interface
```

1. Modules publish events to **Executor Streamer**
2. **Executor Streamer** broadcasts via WebSocket
3. **Frontend API** relays to **UI Interface**
4. Users see live updates of AI reasoning, commands, and screenshots

## Key Interactions

### Module Communication Patterns

#### 1. Session Management
```
Step Processor ←→ Session Coordinator ←→ All Modules
```
- Centralized session creation and coordination
- Consistent session IDs across all modules
- Lifecycle management and cleanup

#### 2. AI Processing Pipeline
```
Task Loop → AI Prompt Manager → AI Context Manager
          ↓
AI Integration ← AI Schema Manager
```
- Context-aware prompt generation
- Structured AI responses with validation
- Execution history tracking for learning

#### 3. Browser Automation
```
Task Loop → Executor → Screenshot Storage
     ↓           ↓
Context Manager  Executor Streamer
```
- Command execution with session isolation
- Automatic screenshot capture
- Result tracking and streaming

#### 4. Real-Time Updates
```
Task Loop    }
Executor     } → Executor Streamer → Frontend API → UI
AI Integration}
```
- Event-driven architecture
- Real-time streaming to multiple clients
- Filtered event delivery

## Session Management

### Unified Session Model
Each workflow creates a **WorkflowSession** that coordinates:
- **Primary Session ID**: Main workflow identifier
- **Executor Session ID**: Browser session for automation
- **Stream ID**: Real-time streaming session
- **AI Connection ID**: OpenAI API connection

### Session Lifecycle
1. **Creation**: Step Processor requests unified session
2. **Initialization**: All modules create linked sessions
3. **Execution**: Task Loop processes steps with full context
4. **Monitoring**: Executor Streamer provides real-time updates
5. **Cleanup**: Coordinated destruction of all related sessions

## AI-Driven Intelligence

### ACT-REFLECT Cycle
The system implements continuous learning through:

**ACT Phase:**
- Generate context-aware prompts with execution history
- Get AI reasoning and decisions
- Execute browser automation commands
- Capture results and screenshots

**REFLECT Phase:**
- Analyze action outcomes
- Validate against expectations
- Decide: proceed, retry, or abort
- Learn from successes and failures

### Context Awareness
- **Execution History**: Complete log of previous actions
- **Page State**: DOM snapshots and screenshots
- **AI Reasoning**: Thought processes and confidence levels
- **Variable Tracking**: Dynamic data extraction and usage

## Security & Performance

### Security Measures
- Session isolation across workflows
- Input sanitization and validation
- Secure API key management
- Rate limiting and quota management

### Performance Optimizations
- Parallel module operations where possible
- Efficient event streaming with filtering
- Screenshot optimization and caching
- Memory management for long-running sessions

### Scalability Features
- Stateless session management
- Horizontal scaling support
- Connection pooling for external services
- Configurable resource limits

## Configuration Management

### Hierarchical Configuration
```
Global Config → Module Config → Session Config → Operation Config
```

### Timeout Hierarchy
```
Workflow (30 min) → Step (5 min) → Request (30 sec) → Connection (10 sec)
```

### Error Handling
- Standardized error types across all modules
- Automatic retry with exponential backoff
- Graceful degradation strategies
- Comprehensive error context and recovery

## Monitoring & Observability

### Logging Strategy
- Structured logging with consistent format
- Module-specific prefixes and context
- Session ID tracking across all logs
- Configurable log levels and output

### Metrics Collection
- Execution timing and success rates
- AI response quality and confidence
- Resource usage and performance
- Error rates and patterns

### Real-Time Monitoring
- Live execution progress
- AI reasoning visualization
- Screenshot timeline
- Performance metrics dashboard

## Development Principles

### Modular Design
- Clear separation of concerns
- Standardized interfaces
- Dependency injection
- Event-driven communication

### Type Safety
- Shared TypeScript interfaces
- Comprehensive type definitions
- Compile-time validation
- Runtime type checking

### Testing Strategy
- Unit tests for individual modules
- Integration tests for module interactions
- End-to-end workflow testing
- Performance and load testing

## Deployment Architecture

### Service Organization
```
Frontend (UI + API) → Load Balancer → Backend Services
                                    ├── Step Processor
                                    ├── Task Loop
                                    ├── AI Integration
                                    ├── Executor Cluster
                                    └── Streaming Service
```

### External Dependencies
- **OpenAI API**: AI reasoning and decision making
- **Browser Engine**: Playwright for web automation
- **Storage**: Screenshots and session data
- **Monitoring**: Logging and metrics collection

## Future Evolution

### Planned Enhancements
- Multi-model AI support with fallbacks
- Visual element recognition and interaction
- Advanced debugging and step-by-step execution
- Collaborative workflow development
- Integration with testing frameworks

### Scalability Roadmap
- Distributed session management
- Multi-region deployment
- Advanced caching strategies
- Machine learning model optimization

This architecture provides a robust, scalable foundation for AI-powered web automation with comprehensive monitoring, error handling, and real-time feedback capabilities.
