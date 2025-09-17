/**
 * Schema Cache
 * Provides caching and optimization for frequently used schemas
 * Based on design/ai-schema-manager.md specifications
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as zlib from 'zlib';
import { promisify } from 'util';
import {
  ResponseSchema,
  ScreenshotAnalysisSchema,
  ScreenshotComparisonSchema,
  SchemaCacheEntry,
  SchemaCacheConfig,
  SchemaCacheStats
} from './types';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export class SchemaCache {
  private cache: Map<string, SchemaCacheEntry>;
  private config: SchemaCacheConfig;
  private stats: SchemaCacheStats;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: Partial<SchemaCacheConfig> = {}) {
    this.cache = new Map();
    this.config = {
      maxEntries: 100,
      ttlMs: 3600000, // 1 hour
      cleanupIntervalMs: 300000, // 5 minutes
      enableCompression: true,
      persistToDisk: false,
      ...config
    };
    
    this.stats = {
      totalEntries: 0,
      hitCount: 0,
      missCount: 0,
      hitRate: 0,
      totalMemoryUsage: 0,
      averageResponseTime: 0,
      lastCleanup: new Date()
    };

    this.startCleanupTimer();
  }

  /**
   * Get schema from cache
   */
  async get(key: string): Promise<ResponseSchema | ScreenshotAnalysisSchema | ScreenshotComparisonSchema | null> {
    const startTime = Date.now();
    
    try {
      const entry = this.cache.get(key);
      
      if (!entry) {
        this.stats.missCount++;
        this.updateHitRate();
        return null;
      }

      // Check if entry has expired
      if (entry.expiresAt && entry.expiresAt < new Date()) {
        this.cache.delete(key);
        this.stats.missCount++;
        this.updateHitRate();
        return null;
      }

      // Update access statistics
      entry.lastAccessed = new Date();
      entry.accessCount++;
      
      this.stats.hitCount++;
      this.updateHitRate();
      this.updateAverageResponseTime(Date.now() - startTime);

      return entry.schema;
    } catch (error) {
      console.error('Schema cache get error:', error);
      this.stats.missCount++;
      this.updateHitRate();
      return null;
    }
  }

  /**
   * Store schema in cache
   */
  async set(
    key: string, 
    schema: ResponseSchema | ScreenshotAnalysisSchema | ScreenshotComparisonSchema,
    ttlMs?: number
  ): Promise<void> {
    try {
      // Check if we need to make room
      if (this.cache.size >= this.config.maxEntries) {
        await this.evictLRU();
      }

      const now = new Date();
      const expiresAt = ttlMs ? new Date(now.getTime() + ttlMs) : 
                      new Date(now.getTime() + this.config.ttlMs);

      const entry: SchemaCacheEntry = {
        key,
        schema,
        createdAt: now,
        lastAccessed: now,
        accessCount: 0,
        expiresAt
      };

      this.cache.set(key, entry);
      this.stats.totalEntries = this.cache.size;
      this.updateMemoryUsage();

      // Persist to disk if enabled
      if (this.config.persistToDisk) {
        await this.persistEntry(key, entry);
      }
    } catch (error) {
      console.error('Schema cache set error:', error);
    }
  }

  /**
   * Check if schema exists in cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Check expiration
    if (entry.expiresAt && entry.expiresAt < new Date()) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Remove schema from cache
   */
  async delete(key: string): Promise<boolean> {
    const existed = this.cache.delete(key);
    
    if (existed) {
      this.stats.totalEntries = this.cache.size;
      this.updateMemoryUsage();
      
      // Remove from disk if persistence is enabled
      if (this.config.persistToDisk && this.config.diskCachePath) {
        try {
          const filePath = path.join(this.config.diskCachePath, `${key}.json.gz`);
          await fs.unlink(filePath);
        } catch (error) {
          // File might not exist, ignore error
        }
      }
    }
    
    return existed;
  }

  /**
   * Clear all cached schemas
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.stats = {
      totalEntries: 0,
      hitCount: 0,
      missCount: 0,
      hitRate: 0,
      totalMemoryUsage: 0,
      averageResponseTime: 0,
      lastCleanup: new Date()
    };

    // Clear disk cache if enabled
    if (this.config.persistToDisk && this.config.diskCachePath) {
      try {
        const files = await fs.readdir(this.config.diskCachePath);
        const deletePromises = files
          .filter(file => file.endsWith('.json.gz'))
          .map(file => fs.unlink(path.join(this.config.diskCachePath!, file)));
        
        await Promise.all(deletePromises);
      } catch (error) {
        console.error('Error clearing disk cache:', error);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): SchemaCacheStats {
    return { ...this.stats };
  }

  /**
   * Get cache configuration
   */
  getConfig(): SchemaCacheConfig {
    return { ...this.config };
  }

  /**
   * Update cache configuration
   */
  updateConfig(newConfig: Partial<SchemaCacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart cleanup timer if interval changed
    if (newConfig.cleanupIntervalMs) {
      this.stopCleanupTimer();
      this.startCleanupTimer();
    }
  }

  /**
   * Generate cache key for schema options
   */
  generateKey(
    type: 'response' | 'screenshot-analysis' | 'screenshot-comparison',
    options: any = {}
  ): string {
    const keyData = {
      type,
      options: this.normalizeOptions(options)
    };
    
    return Buffer.from(JSON.stringify(keyData)).toString('base64');
  }

  /**
   * Preload frequently used schemas
   */
  async preloadCommonSchemas(): Promise<void> {
    const commonSchemaConfigs = [
      { type: 'response', options: { requireReasoning: true, validationMode: 'strict' } },
      { type: 'response', options: { requireReasoning: false, validationMode: 'lenient' } },
      { type: 'screenshot-analysis', options: { analysisType: 'ELEMENT_DETECTION' } },
      { type: 'screenshot-analysis', options: { analysisType: 'CONTENT_SUMMARY' } },
      { type: 'screenshot-comparison', options: { includeCoordinates: true } }
    ];

    for (const config of commonSchemaConfigs) {
      const key = this.generateKey(config.type as any, config.options);
      if (!this.has(key)) {
        // Generate and cache the schema
        // This would typically be done by the SchemaGenerator
        // For now, we just mark the entry for future loading
        console.log(`Would preload schema: ${config.type} with options:`, config.options);
      }
    }
  }

  /**
   * Load cache from disk
   */
  async loadFromDisk(): Promise<void> {
    if (!this.config.persistToDisk || !this.config.diskCachePath) {
      return;
    }

    try {
      // Ensure directory exists
      await fs.mkdir(this.config.diskCachePath, { recursive: true });
      
      const files = await fs.readdir(this.config.diskCachePath);
      const cacheFiles = files.filter(file => file.endsWith('.json.gz'));
      
      for (const file of cacheFiles) {
        try {
          const filePath = path.join(this.config.diskCachePath, file);
          const compressedData = await fs.readFile(filePath);
          const jsonData = await gunzip(compressedData);
          const entry: SchemaCacheEntry = JSON.parse(jsonData.toString());
          
          // Convert date strings back to Date objects
          entry.createdAt = new Date(entry.createdAt);
          entry.lastAccessed = new Date(entry.lastAccessed);
          if (entry.expiresAt) {
            entry.expiresAt = new Date(entry.expiresAt);
          }
          
          // Check if entry is still valid
          if (!entry.expiresAt || entry.expiresAt > new Date()) {
            this.cache.set(entry.key, entry);
          } else {
            // Delete expired file
            await fs.unlink(filePath);
          }
        } catch (error) {
          console.error(`Error loading cache file ${file}:`, error);
        }
      }
      
      this.stats.totalEntries = this.cache.size;
      this.updateMemoryUsage();
    } catch (error) {
      console.error('Error loading cache from disk:', error);
    }
  }

  /**
   * Persist single entry to disk
   */
  private async persistEntry(key: string, entry: SchemaCacheEntry): Promise<void> {
    if (!this.config.diskCachePath) return;

    try {
      await fs.mkdir(this.config.diskCachePath, { recursive: true });
      
      const filePath = path.join(this.config.diskCachePath, `${key}.json.gz`);
      const jsonData = Buffer.from(JSON.stringify(entry));
      
      if (this.config.enableCompression) {
        const compressedData = await gzip(jsonData);
        await fs.writeFile(filePath, compressedData);
      } else {
        await fs.writeFile(filePath.replace('.gz', ''), jsonData);
      }
    } catch (error) {
      console.error('Error persisting cache entry to disk:', error);
    }
  }

  /**
   * Evict least recently used entry
   */
  private async evictLRU(): Promise<void> {
    let oldestEntry: SchemaCacheEntry | null = null;
    let oldestKey: string | null = null;
    
    for (const [key, entry] of this.cache) {
      if (!oldestEntry || entry.lastAccessed < oldestEntry.lastAccessed) {
        oldestEntry = entry;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      await this.delete(oldestKey);
    }
  }

  /**
   * Cleanup expired entries
   */
  private async cleanup(): Promise<void> {
    const now = new Date();
    const expiredKeys: string[] = [];
    
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt && entry.expiresAt < now) {
        expiredKeys.push(key);
      }
    }
    
    for (const key of expiredKeys) {
      await this.delete(key);
    }
    
    this.stats.lastCleanup = now;
    this.updateMemoryUsage();
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch(error => {
        console.error('Cache cleanup error:', error);
      });
    }, this.config.cleanupIntervalMs);
  }

  /**
   * Stop automatic cleanup timer
   */
  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * Update hit rate statistics
   */
  private updateHitRate(): void {
    const total = this.stats.hitCount + this.stats.missCount;
    this.stats.hitRate = total > 0 ? this.stats.hitCount / total : 0;
  }

  /**
   * Update average response time
   */
  private updateAverageResponseTime(responseTime: number): void {
    const total = this.stats.hitCount + this.stats.missCount;
    const currentAverage = this.stats.averageResponseTime;
    this.stats.averageResponseTime = 
      (currentAverage * (total - 1) + responseTime) / total;
  }

  /**
   * Update memory usage statistics
   */
  private updateMemoryUsage(): void {
    let totalSize = 0;
    
    for (const entry of this.cache.values()) {
      // Rough estimation of memory usage
      totalSize += JSON.stringify(entry).length * 2; // UTF-16 characters
    }
    
    this.stats.totalMemoryUsage = totalSize;
  }

  /**
   * Normalize options for consistent key generation
   */
  private normalizeOptions(options: any): any {
    if (!options || typeof options !== 'object') {
      return {};
    }
    
    // Sort keys for consistent serialization
    const normalized: any = {};
    const sortedKeys = Object.keys(options).sort();
    
    for (const key of sortedKeys) {
      normalized[key] = options[key];
    }
    
    return normalized;
  }

  /**
   * Get cache size information
   */
  getSizeInfo(): {
    entryCount: number;
    memoryUsageBytes: number;
    memoryUsageMB: number;
    averageEntrySize: number;
  } {
    const memoryUsageBytes = this.stats.totalMemoryUsage;
    const memoryUsageMB = memoryUsageBytes / (1024 * 1024);
    const averageEntrySize = this.cache.size > 0 ? memoryUsageBytes / this.cache.size : 0;
    
    return {
      entryCount: this.cache.size,
      memoryUsageBytes,
      memoryUsageMB,
      averageEntrySize
    };
  }

  /**
   * Destroy cache and cleanup resources
   */
  async destroy(): Promise<void> {
    this.stopCleanupTimer();
    await this.clear();
  }
}
