/**
 * Unit tests for Media Manager module
 */

import { MediaManager } from '../index';
import { IMediaManager, MediaManagerConfig, ImageMetadata } from '../types';
import { promises as fs, Stats } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    stat: jest.fn(),
    mkdir: jest.fn(),
    copyFile: jest.fn(),
    readFile: jest.fn(),
  }
}));

// Mock crypto module
jest.mock('crypto', () => ({
  randomUUID: jest.fn()
}));

// Mock path module
jest.mock('path', () => ({
  join: jest.fn(),
  extname: jest.fn(),
  dirname: jest.fn()
}));

const mockFs = fs as jest.Mocked<typeof fs>;
const mockRandomUUID = randomUUID as jest.MockedFunction<typeof randomUUID>;
const mockJoin = join as jest.MockedFunction<typeof join>;
const mockExtname = jest.requireMock('path').extname;

describe('MediaManager', () => {
  let mediaManager: IMediaManager;
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset singleton instance for each test
    // @ts-expect-error - accessing private property for testing
    MediaManager.instance = null;
    
    // Reset environment variables
    process.env = { ...originalEnv };
    delete process.env.MEDIA_BASE_URL;
    
    // Create fresh instance
    mediaManager = MediaManager.getInstance();
    
    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup default mock implementations
    mockJoin.mockImplementation((...args) => args.join('/'));
    mockExtname.mockImplementation((path: string) => {
      const parts = path.split('.');
      return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
    });
  });

  afterEach(() => {
    // Restore environment variables
    process.env = originalEnv;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = MediaManager.getInstance();
      const instance2 = MediaManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should use default configuration', () => {
      const config = (mediaManager as IMediaManager & { config: MediaManagerConfig }).config;
      
      expect(config.storageDirectory).toBe('./media-storage');
      expect(config.maxStoredImages).toBe(1000);
      expect(config.supportedFormats).toEqual(['png', 'jpg', 'jpeg', 'gif', 'webp']);
      expect(config.baseUrl).toBe('http://localhost:3000');
    });

    it('should use MEDIA_BASE_URL environment variable when provided', () => {
      process.env.MEDIA_BASE_URL = 'https://example.com';
      // @ts-expect-error - accessing private property for testing
      MediaManager.instance = null;
      
      const instance = MediaManager.getInstance();
      const config = (instance as IMediaManager & { config: MediaManagerConfig }).config;
      
      expect(config.baseUrl).toBe('https://example.com');
    });
  });

  describe('storeImage', () => {
    const mockImagePath = '/test/image.png';
    const mockUuid = '123e4567-e89b-12d3-a456-426614174000';
    const mockStoredPath = './media-storage/123e4567-e89b-12d3-a456-426614174000.png';

    beforeEach(() => {
      mockRandomUUID.mockReturnValue(mockUuid);
      mockExtname.mockReturnValue('.png');
      mockJoin.mockReturnValue(mockStoredPath);
      
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: 1024
      } as Stats);
    });

    it('should store image successfully and return UUID', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.copyFile.mockResolvedValue(undefined);

      const result = await mediaManager.storeImage(mockImagePath);

      expect(result).toBe(mockUuid);
      expect(mockFs.access).toHaveBeenCalledWith(mockImagePath);
      expect(mockFs.stat).toHaveBeenCalledWith(mockImagePath);
      expect(mockFs.mkdir).toHaveBeenCalledWith('./media-storage', { recursive: true });
      expect(mockFs.copyFile).toHaveBeenCalledWith(mockImagePath, mockStoredPath);
    });

    it('should throw error if file does not exist', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));

      await expect(mediaManager.storeImage(mockImagePath))
        .rejects.toThrow('Failed to store image "/test/image.png": File not found');
    });

    it('should throw error if path is not a file', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.stat.mockResolvedValue({
        isFile: () => false,
        size: 0
      } as Stats);

      await expect(mediaManager.storeImage(mockImagePath))
        .rejects.toThrow('Path "/test/image.png" is not a file');
    });

    it('should throw error for unsupported file format', async () => {
      mockExtname.mockReturnValue('.txt');
      mockFs.access.mockResolvedValue(undefined);

      await expect(mediaManager.storeImage('/test/file.txt'))
        .rejects.toThrow('Unsupported image format: txt. Supported formats: png, jpg, jpeg, gif, webp');
    });

    it('should handle file copy errors', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.copyFile.mockRejectedValue(new Error('Copy failed'));

      await expect(mediaManager.storeImage(mockImagePath))
        .rejects.toThrow('Failed to store image "/test/image.png": Copy failed');
    });

    it('should store metadata correctly', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.copyFile.mockResolvedValue(undefined);

      const result = await mediaManager.storeImage(mockImagePath);
      const metadata = (mediaManager as IMediaManager & { imageMetadata: Map<string, ImageMetadata> }).imageMetadata.get(result);

      expect(metadata).toBeDefined();
      expect(metadata?.uuid).toBe(mockUuid);
      expect(metadata?.originalPath).toBe(mockImagePath);
      expect(metadata?.storedPath).toBe(mockStoredPath);
      expect(metadata?.format).toBe('png');
      expect(metadata?.fileSize).toBe(1024);
      expect(metadata?.storedAt).toBeInstanceOf(Date);
    });
  });

  describe('getImagePath', () => {
    it('should return stored path for valid UUID', async () => {
      // First store an image
      const mockImagePath = '/test/image.png';
      const mockUuid = '123e4567-e89b-12d3-a456-426614174000';
      const mockStoredPath = './media-storage/123e4567-e89b-12d3-a456-426614174000.png';
      
      mockRandomUUID.mockReturnValue(mockUuid);
      mockExtname.mockReturnValue('.png');
      mockJoin.mockReturnValue(mockStoredPath);
      mockFs.access.mockResolvedValue(undefined);
      mockFs.stat.mockResolvedValue({ isFile: () => true, size: 1024 } as Stats);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.copyFile.mockResolvedValue(undefined);

      const uuid = await mediaManager.storeImage(mockImagePath);
      const path = mediaManager.getImagePath(uuid);

      expect(path).toBe(mockStoredPath);
    });

    it('should throw error for non-existent UUID', () => {
      expect(() => mediaManager.getImagePath('non-existent-uuid'))
        .toThrow('Image with UUID "non-existent-uuid" does not exist');
    });
  });

  describe('getImageData', () => {
    const mockUuid = '123e4567-e89b-12d3-a456-426614174000';
    const mockImageBuffer = Buffer.from('fake-image-data');
    const expectedBase64 = mockImageBuffer.toString('base64');

    beforeEach(async () => {
      // Store an image first
      const mockImagePath = '/test/image.png';
      const mockStoredPath = './media-storage/123e4567-e89b-12d3-a456-426614174000.png';
      
      mockRandomUUID.mockReturnValue(mockUuid);
      mockExtname.mockReturnValue('.png');
      mockJoin.mockReturnValue(mockStoredPath);
      mockFs.access.mockResolvedValue(undefined);
      mockFs.stat.mockResolvedValue({ isFile: () => true, size: 1024 } as Stats);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.copyFile.mockResolvedValue(undefined);

      await mediaManager.storeImage(mockImagePath);
    });

    it('should return base64 encoded image data', async () => {
      mockFs.readFile.mockResolvedValue(mockImageBuffer);

      const result = await mediaManager.getImageData(mockUuid);

      expect(result).toBe(`data:image/png;base64,${expectedBase64}`);
      expect(mockFs.readFile).toHaveBeenCalledWith('./media-storage/123e4567-e89b-12d3-a456-426614174000.png');
    });

    it('should handle different image formats', async () => {
      // Store a JPEG image
      const mockJpegPath = '/test/image.jpg';
      const mockJpegUuid = '456e7890-e89b-12d3-a456-426614174001';
      const mockJpegStoredPath = './media-storage/456e7890-e89b-12d3-a456-426614174001.jpg';
      
      mockRandomUUID.mockReturnValue(mockJpegUuid);
      mockExtname.mockReturnValue('.jpg');
      mockJoin.mockReturnValue(mockJpegStoredPath);
      
      await mediaManager.storeImage(mockJpegPath);
      
      mockFs.readFile.mockResolvedValue(mockImageBuffer);
      const result = await mediaManager.getImageData(mockJpegUuid);

      expect(result).toBe(`data:image/jpeg;base64,${expectedBase64}`);
    });

    it('should throw error for non-existent UUID', async () => {
      await expect(mediaManager.getImageData('non-existent-uuid'))
        .rejects.toThrow('Image with UUID "non-existent-uuid" does not exist');
    });

    it('should handle file read errors', async () => {
      mockFs.readFile.mockRejectedValue(new Error('Read failed'));

      await expect(mediaManager.getImageData(mockUuid))
        .rejects.toThrow(`Failed to read image data for UUID "${mockUuid}": Read failed`);
    });
  });

  describe('getImageUrl', () => {
    const mockUuid = '123e4567-e89b-12d3-a456-426614174000';

    beforeEach(async () => {
      // Store an image first
      const mockImagePath = '/test/image.png';
      const mockStoredPath = './media-storage/123e4567-e89b-12d3-a456-426614174000.png';
      
      mockRandomUUID.mockReturnValue(mockUuid);
      mockExtname.mockReturnValue('.png');
      mockJoin.mockReturnValue(mockStoredPath);
      mockFs.access.mockResolvedValue(undefined);
      mockFs.stat.mockResolvedValue({ isFile: () => true, size: 1024 } as Stats);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.copyFile.mockResolvedValue(undefined);

      await mediaManager.storeImage(mockImagePath);
    });

    it('should return correct URL with default base URL', () => {
      const result = mediaManager.getImageUrl(mockUuid);
      expect(result).toBe(`http://localhost:3000/api/media/${mockUuid}`);
    });

    it('should return correct URL with custom base URL', () => {
      process.env.MEDIA_BASE_URL = 'https://example.com';
      // @ts-expect-error - accessing private property for testing
      MediaManager.instance = null;
      const customManager = MediaManager.getInstance();
      
      // Store image in custom manager
      mockFs.access.mockResolvedValue(undefined);
      mockFs.stat.mockResolvedValue({ isFile: () => true, size: 1024 } as Stats);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.copyFile.mockResolvedValue(undefined);
      
      const storePromise = customManager.storeImage('/test/image.png');
      storePromise.then((uuid) => {
        const result = customManager.getImageUrl(uuid);
        expect(result).toBe(`https://example.com/api/media/${uuid}`);
      });
    });

    it('should throw error for non-existent UUID', () => {
      expect(() => mediaManager.getImageUrl('non-existent-uuid'))
        .toThrow('Image with UUID "non-existent-uuid" does not exist');
    });
  });

  describe('getMimeType', () => {
    it('should return correct MIME types for supported formats', () => {
      const manager = mediaManager as IMediaManager & { getMimeType(format: string): string };
      
      expect(manager.getMimeType('png')).toBe('image/png');
      expect(manager.getMimeType('jpg')).toBe('image/jpeg');
      expect(manager.getMimeType('jpeg')).toBe('image/jpeg');
      expect(manager.getMimeType('gif')).toBe('image/gif');
      expect(manager.getMimeType('webp')).toBe('image/webp');
    });

    it('should return default MIME type for unknown formats', () => {
      const manager = mediaManager as IMediaManager & { getMimeType(format: string): string };
      expect(manager.getMimeType('unknown')).toBe('image/png');
    });
  });
});
