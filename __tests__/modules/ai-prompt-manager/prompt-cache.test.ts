/**
 * Prompt Cache Tests
 * Unit tests for prompt caching functionality
 */

import { PromptCache } from '../../../src/modules/ai-prompt-manager/prompt-cache';
import { GeneratedPrompt, EnhancedPromptType } from '../../../src/modules/ai-prompt-manager/types';
import { PerformanceConfig } from '../../../types/shared-types';

// Helper function to create test prompts
function createTestPrompt(id: string, sessionId: string = 'test-session'): GeneratedPrompt {
  return {
    promptId: id,
    sessionId,
    stepIndex: 1,
    promptType: EnhancedPromptType.INITIAL_ACTION as any,
    content: {
      systemMessage: `Test system message for ${id}`,
      contextSection: {
        currentStep: { stepIndex: 1, stepContent: 'test', stepType: 'initial', totalSteps: 5 },
        executionHistory: { previousSteps: [], chronologicalEvents: [], successfulActions: 0, failedActions: 0 },
        pageStates: {}
      },
      instructionSection: {
        currentStepInstruction: `Test instruction for ${id}`,
        actionGuidance: 'Test guidance',
        constraints: [],
        objectives: []
      },
      schemaSection: {
        responseFormat: 'JSON',
        schemaDefinition: { type: 'object', properties: {}, required: [] },
        validationRules: []
      }
    },
    schema: { type: 'object', properties: {}, required: [] },
    generatedAt: new Date(),
    metadata: {
      generationTimeMs: 100 + Math.random() * 200
    }
  };
}

describe('PromptCache', () => {
  let cache: PromptCache;
  let config: PerformanceConfig;

  beforeEach(() => {
    config = {
      maxConcurrentOperations: 5,
      cacheEnabled: true,
      cacheTTLMs: 60000, // 1 minute
      metricsEnabled: true
    };
    cache = new PromptCache(config);
  });

  afterEach(() => {
    cache.clear();
  });

  describe('basic cache operations', () => {
    it('should store and retrieve cached prompts', () => {
      const prompt = createTestPrompt('test-prompt-1');
      const cacheKey = 'test-key-1';

      cache.set(cacheKey, prompt);
      const retrieved = cache.get(cacheKey);

      expect(retrieved).toBeDefined();
      expect(retrieved?.promptId).toBe('test-prompt-1');
      expect(retrieved?.sessionId).toBe('test-session');
    });

    it('should return null for non-existent cache keys', () => {
      const retrieved = cache.get('non-existent-key');
      expect(retrieved).toBeNull();
    });

    it('should delete cached prompts', () => {
      const prompt = createTestPrompt('test-prompt-2');
      const cacheKey = 'test-key-2';

      cache.set(cacheKey, prompt);
      expect(cache.get(cacheKey)).toBeDefined();

      const deleted = cache.delete(cacheKey);
      expect(deleted).toBe(true);
      expect(cache.get(cacheKey)).toBeNull();
    });

    it('should clear all cached prompts', () => {
      const prompt1 = createTestPrompt('test-prompt-3');
      const prompt2 = createTestPrompt('test-prompt-4');

      cache.set('key1', prompt1);
      cache.set('key2', prompt2);

      expect(cache.get('key1')).toBeDefined();
      expect(cache.get('key2')).toBeDefined();

      cache.clear();

      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
    });

    it('should not cache when caching is disabled', () => {
      config.cacheEnabled = false;
      cache = new PromptCache(config);

      const prompt = createTestPrompt('test-prompt-5');
      const cacheKey = 'test-key-5';

      cache.set(cacheKey, prompt);
      const retrieved = cache.get(cacheKey);

      expect(retrieved).toBeNull();
    });
  });

  describe('TTL (Time To Live) functionality', () => {
    it('should expire cached prompts after TTL', async () => {
      config.cacheTTLMs = 100; // 100ms TTL
      cache = new PromptCache(config);

      const prompt = createTestPrompt('test-prompt-ttl');
      const cacheKey = 'test-key-ttl';

      cache.set(cacheKey, prompt);
      expect(cache.get(cacheKey)).toBeDefined();

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(cache.get(cacheKey)).toBeNull();
    });

    it('should use custom TTL when provided', async () => {
      const prompt = createTestPrompt('test-prompt-custom-ttl');
      const cacheKey = 'test-key-custom-ttl';
      const customTTL = 50; // 50ms

      cache.set(cacheKey, prompt, customTTL);
      expect(cache.get(cacheKey)).toBeDefined();

      // Wait for custom TTL to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(cache.get(cacheKey)).toBeNull();
    });

    it('should not expire prompts before TTL', async () => {
      config.cacheTTLMs = 1000; // 1 second TTL
      cache = new PromptCache(config);

      const prompt = createTestPrompt('test-prompt-not-expired');
      const cacheKey = 'test-key-not-expired';

      cache.set(cacheKey, prompt);
      
      // Wait less than TTL
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(cache.get(cacheKey)).toBeDefined();
    });
  });

  describe('cache size limits and eviction', () => {
    it('should evict oldest entries when cache is full', () => {
      config.maxCacheSize = 3;
      cache = new PromptCache(config);

      const prompts = [
        createTestPrompt('prompt-1'),
        createTestPrompt('prompt-2'),
        createTestPrompt('prompt-3'),
        createTestPrompt('prompt-4') // This should trigger eviction
      ];

      // Fill cache to capacity
      cache.set('key1', prompts[0]);
      cache.set('key2', prompts[1]);
      cache.set('key3', prompts[2]);

      // Access key1 to make it recently used
      cache.get('key1');

      // Add another item, should evict least recently used (key2)
      cache.set('key4', prompts[3]);

      expect(cache.get('key1')).toBeDefined(); // Recently accessed, should remain
      expect(cache.get('key2')).toBeNull(); // Should be evicted
      expect(cache.get('key3')).toBeDefined(); // Should remain
      expect(cache.get('key4')).toBeDefined(); // Newly added
    });

    it('should handle cache size of 1', () => {
      config.maxCacheSize = 1;
      cache = new PromptCache(config);

      const prompt1 = createTestPrompt('prompt-1');
      const prompt2 = createTestPrompt('prompt-2');

      cache.set('key1', prompt1);
      expect(cache.get('key1')).toBeDefined();

      cache.set('key2', prompt2);
      expect(cache.get('key1')).toBeNull(); // Should be evicted
      expect(cache.get('key2')).toBeDefined();
    });
  });

  describe('access tracking and statistics', () => {
    it('should track access count and last accessed time', () => {
      const prompt = createTestPrompt('test-prompt-access');
      const cacheKey = 'test-key-access';

      cache.set(cacheKey, prompt);
      
      // Access the cached item multiple times
      cache.get(cacheKey);
      cache.get(cacheKey);
      cache.get(cacheKey);

      const entry = cache.getCacheEntry(cacheKey);
      expect(entry).toBeDefined();
      expect(entry?.accessCount).toBe(3);
      expect(entry?.lastAccessed).toBeInstanceOf(Date);
    });

    it('should generate cache statistics', () => {
      const prompts = [
        createTestPrompt('stats-prompt-1'),
        createTestPrompt('stats-prompt-2'),
        createTestPrompt('stats-prompt-3')
      ];

      cache.set('stats-key-1', prompts[0]);
      cache.set('stats-key-2', prompts[1]);
      cache.set('stats-key-3', prompts[2]);

      // Access some items
      cache.get('stats-key-1');
      cache.get('stats-key-1');
      cache.get('stats-key-2');

      const stats = cache.getStats();

      expect(stats.totalEntries).toBe(3);
      expect(stats.hitRate).toBeGreaterThan(0);
      expect(stats.memoryUsage).toBeGreaterThan(0);
      expect(stats.oldestEntry).toBeInstanceOf(Date);
      expect(stats.newestEntry).toBeInstanceOf(Date);
      expect(stats.averageGenerationTime).toBeGreaterThan(0);
    });

    it('should handle empty cache statistics', () => {
      const stats = cache.getStats();

      expect(stats.totalEntries).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(stats.memoryUsage).toBe(0);
      expect(stats.oldestEntry).toBeInstanceOf(Date);
      expect(stats.newestEntry).toBeInstanceOf(Date);
    });
  });

  describe('cache integrity and maintenance', () => {
    it('should validate cache integrity', () => {
      const prompt = createTestPrompt('integrity-prompt');
      cache.set('integrity-key', prompt);

      const isValid = cache.validateCacheIntegrity();
      expect(isValid).toBe(true);
    });

    it('should detect integrity issues', () => {
      const prompt = createTestPrompt('integrity-prompt');
      cache.set('integrity-key', prompt);

      // Manually corrupt cache data to test integrity check
      const cacheData = (cache as any).cache;
      const entry = cacheData.get('integrity-key');
      if (entry) {
        entry.key = 'wrong-key'; // Corrupt the key
      }

      const isValid = cache.validateCacheIntegrity();
      expect(isValid).toBe(false);
    });

    it('should perform maintenance operations', () => {
      config.maxCacheSize = 10;
      cache = new PromptCache(config);

      // Fill cache with some items
      for (let i = 0; i < 5; i++) {
        cache.set(`key-${i}`, createTestPrompt(`prompt-${i}`));
      }

      expect(() => {
        cache.performMaintenance();
      }).not.toThrow();

      // Cache should still be functional after maintenance
      expect(cache.get('key-0')).toBeDefined();
    });

    it('should export cache data for analysis', () => {
      const prompt = createTestPrompt('export-prompt');
      cache.set('export-key', prompt);

      const exportData = cache.exportCacheData();

      expect(exportData).toBeDefined();
      expect(exportData.config).toBeDefined();
      expect(exportData.createdAt).toBeInstanceOf(Date);
      expect(exportData.exportedAt).toBeInstanceOf(Date);
      expect(exportData.entries).toBeInstanceOf(Array);
      expect(exportData.stats).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully during get operations', () => {
      // Simulate error by corrupting internal cache structure
      (cache as any).cache = {
        get: () => { throw new Error('Cache error'); }
      };

      const result = cache.get('test-key');
      expect(result).toBeNull();
    });

    it('should handle errors gracefully during set operations', () => {
      // Simulate error by corrupting internal cache structure
      (cache as any).cache = {
        set: () => { throw new Error('Cache error'); },
        size: 0
      };

      expect(() => {
        cache.set('test-key', createTestPrompt('test'));
      }).not.toThrow();
    });

    it('should handle errors gracefully during delete operations', () => {
      const prompt = createTestPrompt('delete-error-prompt');
      cache.set('delete-error-key', prompt);

      // Simulate error
      (cache as any).cache = {
        delete: () => { throw new Error('Delete error'); }
      };

      const result = cache.delete('delete-error-key');
      expect(result).toBe(false);
    });

    it('should handle errors gracefully during clear operations', () => {
      const prompt = createTestPrompt('clear-error-prompt');
      cache.set('clear-error-key', prompt);

      // Simulate error
      (cache as any).cache = {
        clear: () => { throw new Error('Clear error'); }
      };

      expect(() => {
        cache.clear();
      }).not.toThrow();
    });

    it('should handle errors gracefully during stats generation', () => {
      // Simulate error by corrupting cache structure
      (cache as any).cache = {
        values: () => { throw new Error('Values error'); }
      };

      const stats = cache.getStats();
      expect(stats).toBeDefined();
      expect(stats.totalEntries).toBe(0);
    });
  });

  describe('cache keys and management', () => {
    it('should get all cache keys', () => {
      const prompts = [
        createTestPrompt('keys-prompt-1'),
        createTestPrompt('keys-prompt-2'),
        createTestPrompt('keys-prompt-3')
      ];

      cache.set('keys-key-1', prompts[0]);
      cache.set('keys-key-2', prompts[1]);
      cache.set('keys-key-3', prompts[2]);

      const keys = cache.getCacheKeys();
      expect(keys).toEqual(['keys-key-1', 'keys-key-2', 'keys-key-3']);
    });

    it('should get specific cache entry details', () => {
      const prompt = createTestPrompt('entry-details-prompt');
      cache.set('entry-details-key', prompt);

      const entry = cache.getCacheEntry('entry-details-key');
      expect(entry).toBeDefined();
      expect(entry?.key).toBe('entry-details-key');
      expect(entry?.prompt.promptId).toBe('entry-details-prompt');
      expect(entry?.createdAt).toBeInstanceOf(Date);
      expect(entry?.accessCount).toBe(0);
      expect(entry?.ttlMs).toBe(config.cacheTTLMs);
    });

    it('should return null for non-existent cache entry', () => {
      const entry = cache.getCacheEntry('non-existent-entry');
      expect(entry).toBeNull();
    });
  });

  describe('performance considerations', () => {
    it('should handle large number of cache operations efficiently', () => {
      const startTime = Date.now();
      const numOperations = 1000;

      // Perform many cache operations
      for (let i = 0; i < numOperations; i++) {
        const prompt = createTestPrompt(`perf-prompt-${i}`);
        cache.set(`perf-key-${i}`, prompt);
        
        if (i % 2 === 0) {
          cache.get(`perf-key-${i}`);
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (less than 1 second for 1000 operations)
      expect(duration).toBeLessThan(1000);
      
      const stats = cache.getStats();
      expect(stats.totalEntries).toBeGreaterThan(0);
    });

    it('should maintain performance with frequent access patterns', () => {
      const prompts = Array.from({ length: 10 }, (_, i) => 
        createTestPrompt(`frequent-prompt-${i}`)
      );

      // Set up cache
      prompts.forEach((prompt, i) => {
        cache.set(`frequent-key-${i}`, prompt);
      });

      const startTime = Date.now();

      // Simulate frequent access pattern
      for (let round = 0; round < 100; round++) {
        for (let i = 0; i < 10; i++) {
          cache.get(`frequent-key-${i}`);
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should handle frequent access efficiently
      expect(duration).toBeLessThan(500);
    });
  });
});
