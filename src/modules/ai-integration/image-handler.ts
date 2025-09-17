/**
 * Image Handler
 * Processes image files for AI requests, including reading, validation, and base64 encoding
 * Based on design/ai-integration-module.md specifications
 */

import * as fs from 'fs';
import * as path from 'path';
import { ProcessedImageData, SUPPORTED_IMAGE_FORMATS, SupportedImageFormat, createAIIntegrationError } from './types';

export class ImageHandler {
  /**
   * Process image file from disk for AI request
   * @param filePath Path to the image file
   * @returns Promise resolving to processed image data with data URL
   * @throws Error if file not found or invalid format
   */
  async processImageFile(filePath: string): Promise<ProcessedImageData> {
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw createAIIntegrationError(
          'IMAGE_ERROR',
          `Image file not found: ${filePath}`,
          { filePath, exists: false }
        );
      }

      // Get file stats
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        throw createAIIntegrationError(
          'IMAGE_ERROR',
          `Path is not a file: ${filePath}`,
          { filePath, isFile: false }
        );
      }

      // Validate file size (reasonable limit for base64 encoding)
      const maxSizeBytes = 10 * 1024 * 1024; // 10MB
      if (stats.size > maxSizeBytes) {
        throw createAIIntegrationError(
          'IMAGE_ERROR',
          `Image file too large: ${stats.size} bytes (max: ${maxSizeBytes} bytes)`,
          { filePath, fileSize: stats.size, maxSize: maxSizeBytes }
        );
      }

      // Detect and validate image format
      const format = this.detectImageFormat(filePath);
      if (!this.isValidImageFormat(format)) {
        throw createAIIntegrationError(
          'IMAGE_ERROR',
          `Unsupported image format: ${format}. Supported formats: ${SUPPORTED_IMAGE_FORMATS.join(', ')}`,
          { filePath, detectedFormat: format, supportedFormats: SUPPORTED_IMAGE_FORMATS }
        );
      }

      // Read file and encode to base64
      const fileBuffer = fs.readFileSync(filePath);
      const base64Data = fileBuffer.toString('base64');
      
      // Create data URL
      const mimeType = this.getMimeType(format);
      const dataUrl = `data:${mimeType};base64,${base64Data}`;

      return {
        dataUrl,
        format,
        size: stats.size
      };

    } catch (error) {
      // Re-throw our own errors
      if (error && typeof error === 'object' && 'moduleId' in error && error.moduleId === 'ai-integration') {
        throw error;
      }

      // Handle unexpected errors
      throw createAIIntegrationError(
        'IMAGE_ERROR',
        `Failed to process image file: ${error instanceof Error ? error.message : String(error)}`,
        { 
          filePath,
          originalError: error instanceof Error ? error.message : String(error)
        }
      );
    }
  }

  /**
   * Detect image format from file extension
   * @param filePath Path to the image file
   * @returns Detected format string
   */
  private detectImageFormat(filePath: string): string {
    const extension = path.extname(filePath).toLowerCase().substring(1);
    
    // Handle common variations
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'jpeg';
      case 'png':
        return 'png';
      case 'webp':
        return 'webp';
      case 'gif':
        return 'gif';
      default:
        return extension;
    }
  }

  /**
   * Check if image format is supported
   * @param format Image format string
   * @returns True if format is supported
   */
  private isValidImageFormat(format: string): format is SupportedImageFormat {
    return SUPPORTED_IMAGE_FORMATS.includes(format as SupportedImageFormat);
  }

  /**
   * Get MIME type for image format
   * @param format Image format string
   * @returns MIME type string
   */
  private getMimeType(format: SupportedImageFormat): string {
    switch (format) {
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'gif':
        return 'image/gif';
      default:
        return `image/${format}`;
    }
  }

  /**
   * Validate image data by attempting to parse header information
   * This provides additional validation beyond file extension
   * @param fileBuffer Buffer containing image data
   * @param expectedFormat Expected image format
   * @returns True if image data appears valid
   */
  private validateImageData(fileBuffer: Buffer, expectedFormat: SupportedImageFormat): boolean {
    if (fileBuffer.length < 8) {
      return false;
    }

    // Check magic bytes for common formats
    const header = fileBuffer.subarray(0, 8);
    
    switch (expectedFormat) {
      case 'png':
        // PNG signature: 89 50 4E 47 0D 0A 1A 0A
        return header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47;
      
      case 'jpeg':
        // JPEG signature: FF D8 FF
        return header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF;
      
      case 'webp':
        // WebP signature: RIFF ???? WEBP
        return header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 &&
               fileBuffer.length >= 12 && fileBuffer[8] === 0x57 && fileBuffer[9] === 0x45 && 
               fileBuffer[10] === 0x42 && fileBuffer[11] === 0x50;
      
      case 'gif':
        // GIF signature: GIF87a or GIF89a
        const gifHeader = header.toString('ascii', 0, 6);
        return gifHeader === 'GIF87a' || gifHeader === 'GIF89a';
      
      default:
        // For other formats, just check that it's not empty
        return true;
    }
  }

  /**
   * Get image format information for logging/debugging
   * @param filePath Path to the image file
   * @returns Object with image format details
   */
  async getImageInfo(filePath: string): Promise<{ format: string; size: number; exists: boolean }> {
    try {
      if (!fs.existsSync(filePath)) {
        return { format: 'unknown', size: 0, exists: false };
      }

      const stats = fs.statSync(filePath);
      const format = this.detectImageFormat(filePath);

      return {
        format,
        size: stats.size,
        exists: true
      };
    } catch (error) {
      return { format: 'unknown', size: 0, exists: false };
    }
  }
}
