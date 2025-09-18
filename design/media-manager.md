# Media Manager Module Design

## Overview

The Media Manager is a simple, minimalistic module responsible for storing and retrieving images with UUID-based identification. It provides a clean interface for image storage, path resolution, and data encoding for AI integration workflows.

## Purpose

- Store images with automatic UUID generation for unique identification
- Provide path resolution for stored images
- Generate URI-encoded image data for AI service integration (OpenAI)
- Maintain organized file storage with UUID-based naming
- Support image retrieval workflows in automation tasks

## Core Interface

### Media Management (Singleton Pattern)
```typescript
interface IMediaManager {
  // Singleton instance access
  static getInstance(): IMediaManager;
  
  // Store image and return UUID identifier
  storeImage(imagePath: string): Promise<string>;
  
  // Get stored image path by UUID
  getImagePath(uuid: string): string;
  
  // Get URI-encoded image data for AI services
  getImageData(uuid: string): Promise<string>;
  
  // Get HTTP URL for serving image through Next.js route
  getImageUrl(uuid: string): string;
}

interface MediaManagerConfig {
  storageDirectory: string;
  maxStoredImages: number;
  supportedFormats: string[];
  baseUrl: string;
}
```

### Data Structures
```typescript
interface ImageMetadata {
  uuid: string;
  originalPath: string;
  storedPath: string;
  format: string;
  storedAt: Date;
  fileSize: number;
}
```

## Functional Requirements

### Image Storage
- **Function**: `storeImage(imagePath: string): Promise<string>`
- **Purpose**: Store an image file and return unique identifier
- **Behavior**: 
  - Generates UUID for the image
  - Copies image to managed storage directory
  - Stores image with UUID-based filename
  - Returns UUID string for future reference
  - Throws error if image path is invalid or copy fails

### Path Resolution
- **Function**: `getImagePath(uuid: string): string`
- **Purpose**: Retrieve file system path for stored image
- **Behavior**:
  - Returns absolute path to stored image file
  - Throws error if UUID doesn't exist
  - Path format: `{storageDirectory}/{uuid}.{originalExtension}`

### Data Encoding
- **Function**: `getImageData(uuid: string): Promise<string>`
- **Purpose**: Get base64 URI-encoded image data for AI services
- **Behavior**:
  - Reads stored image file
  - Encodes as base64 data URI
  - Format: `data:image/{format};base64,{encodedData}`
  - Returns string suitable for OpenAI API
  - Throws error if UUID doesn't exist or file read fails

### URL Generation
- **Function**: `getImageUrl(uuid: string): string`
- **Purpose**: Generate HTTP URL for serving image through Next.js route
- **Behavior**:
  - Constructs URL using configured base URL and UUID
  - Format: `{baseUrl}/api/media/{uuid}`
  - Returns HTTP URL string for image access
  - Throws error if UUID doesn't exist
  - Assumes Next.js API route handles image serving

## Implementation Constraints

### File Storage
- UUID-based filename generation using crypto.randomUUID()
- Preserve original file extension for format identification
- Organized storage in single configured directory
- No subdirectory structure (flat storage)

### Data Format
- Support common image formats: PNG, JPEG, GIF, WebP
- Base64 encoding for URI data format
- MIME type detection based on file extension
- OpenAI-compatible data URI format

### Configuration
- Base URL configured via environment variable `MEDIA_BASE_URL` (default: `http://localhost:3000`)
- Storage directory and other settings use hardcoded defaults
- No runtime configuration parameters
- Environment variables read once during singleton initialization

### Error Handling
- Throw descriptive errors for invalid operations
- Use standard JavaScript Error types
- Include UUID and operation details in error messages
- Handle file system errors gracefully

### Performance Considerations
- Async operations for file I/O
- Minimal memory footprint for metadata tracking
- Efficient UUID-based lookups
- No image processing or transformation

## Module Integration

### Dependencies
- Node.js `fs/promises` for file operations
- Node.js `crypto` for UUID generation
- Node.js `path` for file path operations
- No external dependencies

## Example Usage

```typescript
// Get singleton instance (configuration from environment variables)
const mediaManager = IMediaManager.getInstance();

// Store an image
const screenshotPath = './screenshots/capture.png';
const imageUuid = await mediaManager.storeImage(screenshotPath);
console.log(`Stored image with UUID: ${imageUuid}`);

// Retrieve image path
const storedPath = mediaManager.getImagePath(imageUuid);
console.log(`Image stored at: ${storedPath}`);

// Get data for AI API
const encodedData = await mediaManager.getImageData(imageUuid);
// encodedData format: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."

// Get HTTP URL for serving through Next.js route
const imageUrl = mediaManager.getImageUrl(imageUuid);
console.log(`Image URL: ${imageUrl}`);
// imageUrl format: "http://localhost:3000/api/media/{uuid}" (or custom MEDIA_BASE_URL)
```

## Non-Functional Requirements

### Simplicity
- Minimal API surface with 4 core methods
- Environment-based configuration with sensible defaults
- Straightforward UUID-based identification

### Modularity  
- Self-contained file management functionality
- Clear interface boundaries
- No side effects on other modules

### Reliability
- Consistent error handling
- Predictable file storage behavior
- Safe concurrent operations

## Implementation Structure

```
/src/modules/media-manager/
  ├── index.ts                    # Main module interface
  ├── media-manager.ts            # Core media management implementation
  └── types.ts                    # TypeScript type definitions
```

### Storage Directory Structure
```
{configuredStorageDirectory}/
  ├── {uuid1}.png
  ├── {uuid2}.jpg
  ├── {uuid3}.png
  └── ...
```

### Singleton Implementation Pattern
```typescript
class MediaManager implements IMediaManager {
  private static instance: MediaManager | null = null;
  private imageMetadata: Map<string, ImageMetadata> = new Map();
  private config: MediaManagerConfig;

  private constructor() {
    this.config = {
      storageDirectory: './media-storage',
      maxStoredImages: 1000,
      supportedFormats: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
      baseUrl: process.env.MEDIA_BASE_URL || 'http://localhost:3000'
    };
  }

  static getInstance(): IMediaManager {
    if (!MediaManager.instance) {
      MediaManager.instance = new MediaManager();
    }
    return MediaManager.instance;
  }

  // Implementation of interface methods...
  async storeImage(imagePath: string): Promise<string> {
    // Implementation
  }

  getImagePath(uuid: string): string {
    // Implementation
  }

  async getImageData(uuid: string): Promise<string> {
    // Implementation
  }

  getImageUrl(uuid: string): string {
    // Implementation
  }
}
```

## Dependencies
- Node.js built-in modules: `fs/promises`, `crypto`, `path`
- No external npm dependencies

## Testing Requirements
- Unit tests for image storage and retrieval
- UUID generation and uniqueness validation
- Error handling scenarios
- Base64 encoding format validation
- File system operation tests

## Out of Scope

- Image processing or transformation
- Multiple storage backends
- Image compression or optimization
- Batch operations
- Image metadata extraction beyond basic file info
- Authentication or authorization
- Network-based storage
- Image format conversion
- Cleanup or garbage collection of old images
- Storage quota management
- Image validation beyond format checking
- Concurrent access control beyond basic thread safety
- Configuration persistence
- Logging or monitoring (module-level)
- Image preview or thumbnail generation
