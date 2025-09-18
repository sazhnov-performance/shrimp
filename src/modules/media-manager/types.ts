/**
 * Media Manager Type Definitions
 */

export interface IMediaManager {
  // Store image and return UUID identifier
  storeImage(imagePath: string): Promise<string>;
  
  // Get stored image path by UUID
  getImagePath(uuid: string): string;
  
  // Get URI-encoded image data for AI services
  getImageData(uuid: string): Promise<string>;
  
  // Get HTTP URL for serving image through Next.js route
  getImageUrl(uuid: string): string;
}

export interface MediaManagerConfig {
  storageDirectory: string;
  maxStoredImages: number;
  supportedFormats: string[];
  baseUrl: string;
}

export interface ImageMetadata {
  uuid: string;
  originalPath: string;
  storedPath: string;
  format: string;
  storedAt: Date;
  fileSize: number;
}
