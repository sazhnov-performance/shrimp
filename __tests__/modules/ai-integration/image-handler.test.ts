/**
 * Unit Tests for ImageHandler
 * Tests image file processing and base64 encoding functionality
 */

import { ImageHandler } from '../../../src/modules/ai-integration/image-handler';
import * as fs from 'fs';
import * as path from 'path';

// Mock filesystem
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  statSync: jest.fn(),
  readFileSync: jest.fn()
}));

// Mock the entire path module
jest.mock('path', () => ({
  extname: jest.fn()
}));

describe('ImageHandler', () => {
  let imageHandler: ImageHandler;

  beforeEach(() => {
    imageHandler = new ImageHandler();
    jest.clearAllMocks();
  });

  describe('processImageFile', () => {
    const mockImageBuffer = Buffer.from('fake-image-data');
    const mockStats = {
      size: 1024,
      isFile: () => true
    };

    beforeEach(() => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.statSync as jest.Mock).mockReturnValue(mockStats);
      (fs.readFileSync as jest.Mock).mockReturnValue(mockImageBuffer);
      (path.extname as jest.Mock).mockReturnValue('.png');
    });

    test('should process PNG image successfully', async () => {
      const result = await imageHandler.processImageFile('test.png');

      expect(result.format).toBe('png');
      expect(result.dataUrl).toContain('data:image/png;base64,');
      expect(result.size).toBe(1024);
      expect(fs.existsSync).toHaveBeenCalledWith('test.png');
      expect(fs.readFileSync).toHaveBeenCalledWith('test.png');
    });

    test('should process JPEG image successfully', async () => {
      (path.extname as jest.Mock).mockReturnValue('.jpg');
      
      const result = await imageHandler.processImageFile('test.jpg');

      expect(result.format).toBe('jpeg');
      expect(result.dataUrl).toContain('data:image/jpeg;base64,');
    });

    test('should handle .jpeg extension', async () => {
      (path.extname as jest.Mock).mockReturnValue('.jpeg');
      
      const result = await imageHandler.processImageFile('test.jpeg');

      expect(result.format).toBe('jpeg');
      expect(result.dataUrl).toContain('data:image/jpeg;base64,');
    });

    test('should process WebP image successfully', async () => {
      (path.extname as jest.Mock).mockReturnValue('.webp');
      
      const result = await imageHandler.processImageFile('test.webp');

      expect(result.format).toBe('webp');
      expect(result.dataUrl).toContain('data:image/webp;base64,');
    });

    test('should process GIF image successfully', async () => {
      (path.extname as jest.Mock).mockReturnValue('.gif');
      
      const result = await imageHandler.processImageFile('test.gif');

      expect(result.format).toBe('gif');
      expect(result.dataUrl).toContain('data:image/gif;base64,');
    });

    test('should throw error for non-existent file', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      try {
        await imageHandler.processImageFile('nonexistent.png');
        fail('Expected error to be thrown');
      } catch (error: any) {
        expect(error.code).toBe('AI006');
        expect(error.message).toContain('Image file not found');
      }
    });

    test('should throw error for non-file path', async () => {
      (fs.statSync as jest.Mock).mockReturnValue({
        size: 1024,
        isFile: () => false
      });

      try {
        await imageHandler.processImageFile('directory');
        fail('Expected error to be thrown');
      } catch (error: any) {
        expect(error.code).toBe('AI006');
        expect(error.message).toContain('Path is not a file');
      }
    });

    test('should throw error for oversized file', async () => {
      const largeSize = 11 * 1024 * 1024; // 11MB
      (fs.statSync as jest.Mock).mockReturnValue({
        size: largeSize,
        isFile: () => true
      });

      try {
        await imageHandler.processImageFile('large.png');
        fail('Expected error to be thrown');
      } catch (error: any) {
        expect(error.code).toBe('AI006');
        expect(error.message).toContain('Image file too large');
      }
    });

    test('should throw error for unsupported format', async () => {
      (path.extname as jest.Mock).mockReturnValue('.bmp');

      try {
        await imageHandler.processImageFile('test.bmp');
        fail('Expected error to be thrown');
      } catch (error: any) {
        expect(error.code).toBe('AI006');
        expect(error.message).toContain('Unsupported image format');
      }
    });

    test('should handle filesystem read errors', async () => {
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      try {
        await imageHandler.processImageFile('test.png');
        fail('Expected error to be thrown');
      } catch (error: any) {
        expect(error.code).toBe('AI006');
        expect(error.message).toContain('Failed to process image file');
      }
    });

    test('should generate correct base64 data URL', async () => {
      const testBuffer = Buffer.from('test-image-data');
      (fs.readFileSync as jest.Mock).mockReturnValue(testBuffer);
      
      const result = await imageHandler.processImageFile('test.png');
      
      const expectedBase64 = testBuffer.toString('base64');
      expect(result.dataUrl).toBe(`data:image/png;base64,${expectedBase64}`);
    });
  });

  describe('getImageInfo', () => {
    test('should return image info for existing file', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.statSync as jest.Mock).mockReturnValue({ size: 2048 });
      (path.extname as jest.Mock).mockReturnValue('.png');

      const info = await imageHandler.getImageInfo('test.png');

      expect(info.exists).toBe(true);
      expect(info.format).toBe('png');
      expect(info.size).toBe(2048);
    });

    test('should return default info for non-existent file', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const info = await imageHandler.getImageInfo('nonexistent.png');

      expect(info.exists).toBe(false);
      expect(info.format).toBe('unknown');
      expect(info.size).toBe(0);
    });

    test('should handle errors gracefully', async () => {
      (fs.existsSync as jest.Mock).mockImplementation(() => {
        throw new Error('Access denied');
      });

      const info = await imageHandler.getImageInfo('test.png');

      expect(info.exists).toBe(false);
      expect(info.format).toBe('unknown');
      expect(info.size).toBe(0);
    });
  });

  describe('format detection', () => {
    test('should detect format from extension correctly', async () => {
      const testCases = [
        { ext: '.png', expected: 'png' },
        { ext: '.jpg', expected: 'jpeg' },
        { ext: '.jpeg', expected: 'jpeg' },
        { ext: '.webp', expected: 'webp' },
        { ext: '.gif', expected: 'gif' },
        { ext: '.PNG', expected: 'png' }, // Case insensitive
        { ext: '.JPG', expected: 'jpeg' }
      ];

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.statSync as jest.Mock).mockReturnValue({ size: 1024, isFile: () => true });
      (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from('test'));

      for (const testCase of testCases) {
        (path.extname as jest.Mock).mockReturnValue(testCase.ext);
        
        const result = await imageHandler.processImageFile(`test${testCase.ext}`);
        expect(result.format).toBe(testCase.expected);
      }
    });
  });

  describe('MIME type mapping', () => {
    test('should generate correct MIME types', async () => {
      const testCases = [
        { ext: '.png', mime: 'image/png' },
        { ext: '.jpg', mime: 'image/jpeg' },
        { ext: '.webp', mime: 'image/webp' },
        { ext: '.gif', mime: 'image/gif' }
      ];

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.statSync as jest.Mock).mockReturnValue({ size: 1024, isFile: () => true });
      (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from('test'));

      for (const testCase of testCases) {
        (path.extname as jest.Mock).mockReturnValue(testCase.ext);
        
        const result = await imageHandler.processImageFile(`test${testCase.ext}`);
        expect(result.dataUrl).toContain(`data:${testCase.mime};base64,`);
      }
    });
  });
});