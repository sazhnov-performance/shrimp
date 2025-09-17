/**
 * Image Handler
 * Image file processing and base64 encoding
 */

import * as fs from 'fs';
import * as path from 'path';

export class ImageHandler {
  private static readonly SUPPORTED_FORMATS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];

  /**
   * Process image file from disk and return base64 data URL
   */
  async processImageFile(filePath: string): Promise<string> {
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error('File not found');
      }

      // Detect image format
      const format = this.detectImageFormat(filePath);
      if (!format) {
        throw new Error('Unsupported image format');
      }

      // Read image file
      const imageBuffer = fs.readFileSync(filePath);
      
      // Encode to base64
      const base64Data = imageBuffer.toString('base64');
      
      // Create data URL format
      const dataUrl = `data:image/${format};base64,${base64Data}`;
      
      return dataUrl;
    } catch (error) {
      throw new Error(`Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Detect image format from file extension
   */
  private detectImageFormat(filePath: string): string | null {
    const ext = path.extname(filePath).toLowerCase().substring(1);
    
    if (ImageHandler.SUPPORTED_FORMATS.includes(ext)) {
      // Normalize jpeg to jpg for data URL
      return ext === 'jpeg' ? 'jpg' : ext;
    }
    
    return null;
  }

  /**
   * Validate if file is a supported image format
   */
  isValidImageFile(filePath: string): boolean {
    const format = this.detectImageFormat(filePath);
    return format !== null;
  }
}
