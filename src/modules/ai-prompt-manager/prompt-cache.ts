/**
 * Prompt Cache Implementation
 * High-performance caching system for generated prompts
 */

import { GeneratedPrompt, PerformanceConfig } from './types';

export interface CacheEntry {
  key: string;
  prompt: GeneratedPrompt;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  ttlMs: number;
  expiresAt: Date;
}

export interface CacheStats {
  totalEntries: number;
  hitRate: number;
  memoryUsage: number;
  oldestEntry: Date;
  newestEntry: Date;
  averageGenerationTime: number;
}

export interface CacheExportData {
  config: PerformanceConfig;
  createdAt: Date;
  exportedAt: Date;
  entries: CacheEntry[];
  stats: CacheStats;
}

export class PromptCache {
  private cache = new Map<string, CacheEntry>();
  private hits = 0;
  private misses = 0;

  constructor(private config: PerformanceConfig) {}

  /**
   * Store a prompt in the cache
   */
  set(key: string, prompt: GeneratedPrompt, customTTL?: number): void {
    if (!this.config.cacheEnabled) {
      return;
    }

    try {
      const ttl = customTTL ?? this.config.cacheTTLMs;
      const now = new Date();
      
      const entry: CacheEntry = {
        key,
        prompt,
        createdAt: now,
        lastAccessed: now,
        accessCount: 0,
        ttlMs: ttl,
        expiresAt: new Date(now.getTime() + ttl)
      };

      // Check if we need to evict entries
      if (this.config.maxCacheSize && this.cache.size >= this.config.maxCacheSize) {
        this.evictLeastRecentlyUsed();
      }

      this.cache.set(key, entry);
    } catch (error) {
      // Silently handle cache errors to not break the application
      console.warn('Cache set operation failed:', error);
    }
  }

  /**
   * Retrieve a prompt from the cache
   */
  get(key: string): GeneratedPrompt | null {
    if (!this.config.cacheEnabled) {
      return null;
    }

    try {
      const entry = this.cache.get(key);
      
      if (!entry) {
        this.misses++;
        return null;
      }

      // Check if entry has expired
      if (entry.expiresAt < new Date()) {
        this.cache.delete(key);
        this.misses++;
        return null;
      }

      // Update access statistics
      entry.lastAccessed = new Date();
      entry.accessCount++;
      this.hits++;

      return entry.prompt;
    } catch (error) {
      console.warn('Cache get operation failed:', error);
      this.misses++;
      return null;
    }
  }

  /**
   * Delete a specific cache entry
   */
  delete(key: string): boolean {
    try {
      return this.cache.delete(key);
    } catch (error) {
      console.warn('Cache delete operation failed:', error);
      return false;
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    try {
      this.cache.clear();
      this.hits = 0;
      this.misses = 0;
    } catch (error) {
      console.warn('Cache clear operation failed:', error);
    }
  }

  /**
   * Get cache entry details
   */
  getCacheEntry(key: string): CacheEntry | null {
    const entry = this.cache.get(key);
    return entry || null;
  }

  /**
   * Get all cache keys
   */
  getCacheKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    try {
      const entries = Array.from(this.cache.values());
      const now = new Date();
      
      if (entries.length === 0) {
        return {
          totalEntries: 0,
          hitRate: 0,
          memoryUsage: 0,
          oldestEntry: now,
          newestEntry: now,
          averageGenerationTime: 0
        };
      }

      const totalRequests = this.hits + this.misses;
      const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;
      
      const creationTimes = entries.map(e => e.createdAt.getTime());
      const oldestEntry = new Date(Math.min(...creationTimes));
      const newestEntry = new Date(Math.max(...creationTimes));
      
      // Estimate memory usage (rough calculation)
      const avgPromptSize = entries.reduce((sum, entry) => {
        return sum + JSON.stringify(entry.prompt).length;
      }, 0) / entries.length;
      
      const memoryUsage = entries.length * avgPromptSize;
      
      // Average generation time from metadata
      const generationTimes = entries
        .map(e => e.prompt.metadata?.generationTimeMs)
        .filter(t => t !== undefined) as number[];
      
      const averageGenerationTime = generationTimes.length > 0
        ? generationTimes.reduce((sum, time) => sum + time, 0) / generationTimes.length
        : 0;

      return {
        totalEntries: entries.length,
        hitRate,
        memoryUsage,
        oldestEntry,
        newestEntry,
        averageGenerationTime
      };
    } catch (error) {
      console.warn('Cache stats generation failed:', error);
      const now = new Date();
      return {
        totalEntries: 0,
        hitRate: 0,
        memoryUsage: 0,
        oldestEntry: now,
        newestEntry: now,
        averageGenerationTime: 0
      };
    }
  }

  /**
   * Validate cache integrity
   */
  validateCacheIntegrity(): boolean {
    try {
      for (const [key, entry] of this.cache.entries()) {
        if (entry.key !== key) {
          return false;
        }
        
        if (!entry.prompt || !entry.prompt.promptId) {
          return false;
        }
        
        if (entry.createdAt > new Date()) {
          return false;
        }
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Perform cache maintenance
   */
  performMaintenance(): void {
    try {
      const now = new Date();
      
      // Remove expired entries
      for (const [key, entry] of this.cache.entries()) {
        if (entry.expiresAt < now) {
          this.cache.delete(key);
        }
      }
      
      // If still over size limit, evict least recently used
      if (this.config.maxCacheSize && this.cache.size > this.config.maxCacheSize) {
        while (this.cache.size > this.config.maxCacheSize) {
          this.evictLeastRecentlyUsed();
        }
      }
    } catch (error) {
      console.warn('Cache maintenance failed:', error);
    }
  }

  /**
   * Export cache data for analysis
   */
  exportCacheData(): CacheExportData {
    const now = new Date();
    
    return {
      config: this.config,
      createdAt: now,
      exportedAt: now,
      entries: Array.from(this.cache.values()),
      stats: this.getStats()
    };
  }

  /**
   * Evict the least recently used entry
   */
  private evictLeastRecentlyUsed(): void {
    let oldestKey: string | null = null;
    let oldestTime = new Date();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}
