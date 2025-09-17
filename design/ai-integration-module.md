# AI Integration Module Design Document

## Overview
The AI Integration module provides a simple interface for sending requests to OpenAI API and receiving responses. It handles authentication and logs all interactions to a single log file.

## Core Responsibilities
- Provide interface to send requests and pass back responses
- Handle authentication to OpenAI API
- Log raw requests and responses to single log file

## Module Interface

```typescript
interface IAIIntegrationManager {
  // Send request to OpenAI and get response
  sendRequest(request: string, imageFilePath?: string): Promise<AIResponse>;
}
```

## Data Structures

### Configuration
```typescript
interface AIConfig {
  apiKey: string;
  model: string; // 'gpt-4o-mini'
  baseUrl?: string; // Default: https://api.openai.com/v1
  logFilePath?: string; // Default: './ai-requests.log'
}
```

### Request/Response Types
- Request: `string` (text content to send)
- Response object: Coontains `status`, and OpenAI response data
- Image file path: `string` (optional parameter)

```typescript
interface AIResponse {
  status: 'success' | 'error';
  data?: any; // OpenAI response data (when successful)
  error?: string; // Error message (when failed)
  errorCode?: string;
}
```

## Core Functionality

### 1. Request Processing
```typescript
async sendRequest(request: string, imageFilePath?: string): Promise<AIResponse>
```
- Validate API key
- If imageFilePath provided: read image file from disk, encode to base64
- Format request for OpenAI API (text + image data if provided)
- Send request to OpenAI API
- Parse response from OpenAI
- Log request and response
- Return structured response with errorCode, status, and data

### 2. Authentication
- Store API key from configuration
- Include API key in request headers
- Handle authentication errors

### 3. Image Processing
```typescript
async processImageFile(filePath: string): Promise<string>
```
- Read image file from disk
- Detect image format (png, jpg, jpeg, webp, gif)
- Encode to base64
- Create data URL format: `data:image/jpeg;base64,{base64Data}`
- Handle file not found errors

### 4. Logging
- Log every request and response to single file
- Include timestamp, request ID, and full data
- Simple append-only logging

## Implementation Structure

```
/src/modules/ai-integration/
  ├── index.ts                    # Main module interface
  ├── request-processor.ts        # Request/response handling
  ├── image-handler.ts            # Image file processing and base64 encoding
  ├── logger.ts                   # Simple file logging
  ├── auth-handler.ts             # API key management
  └── types.ts                    # Type definitions
```

## Log Format

Each log entry is a single line JSON:
```json
{"timestamp": "2023-12-01T10:30:00.000Z", "type": "request", "data": {...}}
{"timestamp": "2023-12-01T10:30:01.000Z", "type": "response", "data": {...}}
```

## Error Handling

Simple error categories:
- `AUTHENTICATION_ERROR`: Invalid API key
- `REQUEST_ERROR`: Malformed request
- `API_ERROR`: OpenAI API error
- `NETWORK_ERROR`: Connection issues
- `IMAGE_ERROR`: Image file not found or invalid format

## Usage Example

```typescript
const aiManager = new AIIntegrationManager();

// Text-only request
const response1 = await aiManager.sendRequest('Hello, how are you?');
// Returns: { errorCode: null, status: 'success', data: { ... OpenAI response ... } }

// Request with image from disk
const response2 = await aiManager.sendRequest('What do you see in this image?', './screenshot.png');
// Returns: { errorCode: null, status: 'success', data: { ... OpenAI response ... } }

// Error case
const response3 = await aiManager.sendRequest('test', './nonexistent.png');
// Returns: { errorCode: 'IMAGE_ERROR', status: 'error', error: 'File not found' }
```

## Testing Requirements
- Unit tests for request/response processing
- Unit tests for image file processing and base64 encoding
- Integration tests with OpenAI API
- Error handling validation
- File not found error handling

## everything else is out of scope