/**
 * Media Manager Implementation
 * 
 * A simple, minimalistic module responsible for storing and retrieving images
 * with UUID-based identification. Provides image storage, path resolution,
 * and data encoding for AI integration workflows.
 */

import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import { join, extname, dirname } from 'path';
import { IMediaManager, MediaManagerConfig, ImageMetadata } from './types';

export class MediaManager implements IMediaManager {
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
    
    // Load existing images on initialization
    this.loadExistingImages().catch(error => {
      console.error('Failed to load existing images on MediaManager initialization:', error);
    });
  }

  static getInstance(): IMediaManager {
    if (!MediaManager.instance) {
      MediaManager.instance = new MediaManager();
    }
    return MediaManager.instance;
  }

  async storeImage(imagePath: string): Promise<string> {
    try {
      // Check if file exists
      await fs.access(imagePath);
      
      // Get file stats
      const stats = await fs.stat(imagePath);
      if (!stats.isFile()) {
        throw new Error(`Path "${imagePath}" is not a file`);
      }

      // Get file extension and validate format
      const fileExtension = extname(imagePath).toLowerCase().substring(1);
      if (!this.config.supportedFormats.includes(fileExtension)) {
        throw new Error(`Unsupported image format: ${fileExtension}. Supported formats: ${this.config.supportedFormats.join(', ')}`);
      }

      // Generate UUID for the image
      const uuid = randomUUID();

      // Ensure storage directory exists
      await fs.mkdir(this.config.storageDirectory, { recursive: true });

      // Create destination path with UUID filename
      const storedPath = join(this.config.storageDirectory, `${uuid}.${fileExtension}`);

      // Copy file to storage directory
      await fs.copyFile(imagePath, storedPath);

      // Store metadata
      const metadata: ImageMetadata = {
        uuid,
        originalPath: imagePath,
        storedPath,
        format: fileExtension,
        storedAt: new Date(),
        fileSize: stats.size
      };

      this.imageMetadata.set(uuid, metadata);

      return uuid;
    } catch (error) {
      throw new Error(`Failed to store image "${imagePath}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getImagePath(uuid: string): string {
    const metadata = this.imageMetadata.get(uuid);
    if (!metadata) {
      throw new Error(`Image with UUID "${uuid}" does not exist`);
    }

    return metadata.storedPath;
  }

  async getImageData(uuid: string): Promise<string> {
    const metadata = this.imageMetadata.get(uuid);
    if (!metadata) {
      throw new Error(`Image with UUID "${uuid}" does not exist`);
    }

    try {
      // Read image file as buffer
      const imageBuffer = await fs.readFile(metadata.storedPath);
      
      // Convert to base64
      const base64Data = imageBuffer.toString('base64');
      
      // Create data URI with proper MIME type
      const mimeType = this.getMimeType(metadata.format);
      return `data:${mimeType};base64,${base64Data}`;
    } catch (error) {
      throw new Error(`Failed to read image data for UUID "${uuid}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getImageUrl(uuid: string): string {
    const metadata = this.imageMetadata.get(uuid);
    if (!metadata) {
      throw new Error(`Image with UUID "${uuid}" does not exist`);
    }

    return `${this.config.baseUrl}/api/media/${uuid}`;
  }

  private getMimeType(format: string): string {
    const mimeTypes: Record<string, string> = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'webp': 'image/webp'
    };

    return mimeTypes[format] || 'image/png';
  }

  /**
   * Load existing images from storage directory into metadata map
   * This is called during initialization to restore metadata for existing files
   */
  private async loadExistingImages(): Promise<void> {
    try {
      // Ensure storage directory exists
      await fs.mkdir(this.config.storageDirectory, { recursive: true });
      
      // Read all files in storage directory
      const files = await fs.readdir(this.config.storageDirectory);
      
      // Process each file to extract UUID and metadata
      for (const filename of files) {
        const filePath = join(this.config.storageDirectory, filename);
        
        try {
          // Check if it's a file (not directory)
          const stats = await fs.stat(filePath);
          if (!stats.isFile()) continue;
          
          // Extract UUID and extension from filename
          const parts = filename.split('.');
          if (parts.length < 2) continue; // Skip files without extension
          
          const uuid = parts[0];
          const extension = parts[parts.length - 1].toLowerCase();
          
          // Validate UUID format (simple check)
          if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) {
            continue; // Skip files that don't have UUID naming
          }
          
          // Validate format
          if (!this.config.supportedFormats.includes(extension)) {
            continue; // Skip unsupported formats
          }
          
          // Create metadata entry
          const metadata: ImageMetadata = {
            uuid,
            originalPath: '', // Unknown for existing files
            storedPath: filePath,
            format: extension,
            storedAt: stats.birthtime || stats.mtime, // Use file creation/modification time
            fileSize: stats.size
          };
          
          this.imageMetadata.set(uuid, metadata);
          console.log(`[MediaManager] Loaded existing image: ${uuid}.${extension}`);
        } catch (error) {
          console.warn(`[MediaManager] Failed to process file ${filename}:`, error);
          continue; // Skip this file and continue with others
        }
      }
      
      console.log(`[MediaManager] Loaded ${this.imageMetadata.size} existing images from storage`);
    } catch (error) {
      console.error('[MediaManager] Failed to load existing images:', error);
      // Don't throw - this shouldn't prevent MediaManager from working
    }
  }
}
