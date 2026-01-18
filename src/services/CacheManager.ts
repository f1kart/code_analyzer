// CacheManager.ts - Enterprise-grade multi-level caching system
// Provides memory, Redis, and CDN caching with intelligent cache strategies

import { PerformanceMonitor } from './PerformanceMonitor';

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  ttl: number; // Time to live in seconds
  createdAt: Date;
  accessedAt: Date;
  accessCount: number;
  size: number; // Size in bytes
  tags: string[];
  metadata: Record<string, any>;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalEntries: number;
  totalSize: number; // bytes
  evictions: number;
  averageAccessTime: number;
  memoryUsage: number;
  redisUsage?: number;
  cdnUsage?: number;
}

export interface CacheConfig {
  maxMemorySize: number; // bytes
  defaultTTL: number; // seconds
  maxEntries: number;
  evictionPolicy: 'lru' | 'lfu' | 'ttl' | 'random';
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  enableMetrics: boolean;
  enableDistributed: boolean;
  redisConfig?: RedisConfig;
  cdnConfig?: CDNConfig;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  database: number;
  keyPrefix: string;
  ttl: number;
  maxRetries: number;
}

export interface CDNConfig {
  provider: 'cloudflare' | 'aws' | 'azure' | 'custom';
  baseUrl: string;
  apiKey?: string;
  ttl: number;
  regions: string[];
}

export interface CacheStrategy {
  name: string;
  readStrategy: 'cache_first' | 'network_first' | 'cache_only' | 'network_only';
  writeStrategy: 'write_through' | 'write_back' | 'write_around';
  fallbackStrategy: 'stale_while_revalidate' | 'network_only' | 'cache_only';
  ttl: number;
}

export class CacheManager {
  private performanceMonitor: PerformanceMonitor;
  private memoryCache: Map<string, CacheEntry> = new Map();
  private redisClient?: any; // Redis client
  private cdnClient?: any; // CDN client
  private config: CacheConfig;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalEntries: 0,
    totalSize: 0,
    evictions: 0,
    averageAccessTime: 0,
    memoryUsage: 0
  };
  private accessTimes: number[] = [];

  constructor(performanceMonitor?: PerformanceMonitor, config?: Partial<CacheConfig>) {
    this.performanceMonitor = performanceMonitor || new PerformanceMonitor();
    this.config = {
      maxMemorySize: 100 * 1024 * 1024, // 100MB
      defaultTTL: 3600, // 1 hour
      maxEntries: 10000,
      evictionPolicy: 'lru',
      compressionEnabled: true,
      encryptionEnabled: false,
      enableMetrics: true,
      enableDistributed: false,
      ...config
    };

    this.initializeCache();
  }

  /**
   * Gets a value from cache with multi-level fallback
   * @param key Cache key
   * @param strategy Cache strategy
   * @returns Cached value or null if not found
   */
  async get<T>(key: string, strategy: CacheStrategy = this.getDefaultStrategy()): Promise<T | null> {
    const startTime = Date.now();

    try {
      // Try memory cache first
      let value = await this.getFromMemory<T>(key);

      if (value !== null && strategy.readStrategy === 'cache_first') {
        this.recordCacheHit(key, 'memory', Date.now() - startTime);
        return value;
      }

      // Try Redis if enabled and not found in memory
      if (this.config.enableDistributed && !value && this.redisClient) {
        value = await this.getFromRedis<T>(key);

        if (value !== null) {
          // Populate memory cache
          await this.setInMemory(key, value, strategy.ttl);
          this.recordCacheHit(key, 'redis', Date.now() - startTime);
          return value;
        }
      }

      // Try CDN for static assets
      if (!value && this.cdnClient && this.isStaticAsset(key)) {
        value = await this.getFromCDN<T>(key);

        if (value !== null) {
          await this.setInMemory(key, value, strategy.ttl);
          this.recordCacheHit(key, 'cdn', Date.now() - startTime);
          return value;
        }
      }

      // Network fallback
      if (strategy.fallbackStrategy === 'network_only') {
        this.recordCacheMiss(key, Date.now() - startTime);
        return null;
      }

      // Stale while revalidate
      if (value && strategy.fallbackStrategy === 'stale_while_revalidate') {
        // In background, refresh the cache
        this.refreshCache(key, strategy).catch(console.error);
        this.recordCacheHit(key, 'memory', Date.now() - startTime);
        return value;
      }

      this.recordCacheMiss(key, Date.now() - startTime);
      return null;

    } catch (error) {
      console.error('Cache get error:', error);
      this.recordCacheMiss(key, Date.now() - startTime);
      return null;
    }
  }

  /**
   * Sets a value in cache across all levels
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Time to live in seconds
   * @param tags Optional tags for cache management
   * @param strategy Cache strategy
   */
  async set<T>(
    key: string,
    value: T,
    ttl?: number,
    tags: string[] = [],
    strategy: CacheStrategy = this.getDefaultStrategy()
  ): Promise<void> {
    const entry: CacheEntry<T> = {
      key,
      value,
      ttl: ttl || this.config.defaultTTL,
      createdAt: new Date(),
      accessedAt: new Date(),
      accessCount: 0,
      size: this.calculateSize(value),
      tags,
      metadata: {}
    };

    try {
      // Set in memory cache
      await this.setInMemory(key, value, entry.ttl, tags);

      // Set in Redis if enabled
      if (this.config.enableDistributed && this.redisClient) {
        await this.setInRedis(key, value, entry.ttl);
      }

      // Set in CDN for static assets
      if (this.cdnClient && this.isStaticAsset(key)) {
        await this.setInCDN(key, value, entry.ttl);
      }

      // Record metrics
      this.performanceMonitor.recordMetric(
        'cache_set',
        1,
        'count',
        { key, strategy: strategy.name }
      );

    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Deletes a value from all cache levels
   * @param key Cache key
   * @param strategy Cache strategy
   */
  async delete(key: string, strategy: CacheStrategy = this.getDefaultStrategy()): Promise<void> {
    try {
      // Delete from memory cache
      this.memoryCache.delete(key);

      // Delete from Redis if enabled
      if (this.config.enableDistributed && this.redisClient) {
        await this.deleteFromRedis(key);
      }

      // Delete from CDN if applicable
      if (this.cdnClient && this.isStaticAsset(key)) {
        await this.deleteFromCDN(key);
      }

      // Record metrics
      this.performanceMonitor.recordMetric(
        'cache_delete',
        1,
        'count',
        { key }
      );

    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  /**
   * Clears all cache levels
   * @param pattern Optional key pattern to clear
   */
  async clear(pattern?: string): Promise<void> {
    try {
      // Clear memory cache
      if (pattern) {
        for (const key of this.memoryCache.keys()) {
          if (this.matchesPattern(key, pattern)) {
            this.memoryCache.delete(key);
          }
        }
      } else {
        this.memoryCache.clear();
      }

      // Clear Redis if enabled
      if (this.config.enableDistributed && this.redisClient) {
        if (pattern) {
          await this.clearRedisPattern(pattern);
        } else {
          await this.clearRedis();
        }
      }

      // Clear CDN if applicable
      if (this.cdnClient) {
        await this.clearCDN(pattern);
      }

      // Record metrics
      this.performanceMonitor.recordMetric(
        'cache_clear',
        1,
        'count',
        { pattern: pattern || 'all' }
      );

    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * Gets cache statistics
   * @returns Cache statistics
   */
  getStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Warms up cache with commonly accessed data
   * @param warmupData Data to preload into cache
   */
  async warmup(warmupData: Array<{ key: string; value: any; ttl?: number; tags?: string[] }>): Promise<void> {
    console.log(`🔥 Warming up cache with ${warmupData.length} entries...`);

    for (const item of warmupData) {
      await this.set(item.key, item.value, item.ttl, item.tags);
    }

    console.log('✅ Cache warmup completed');
  }

  /**
   * Configures Redis caching
   * @param config Redis configuration
   */
  async configureRedis(config: RedisConfig): Promise<void> {
    this.config.redisConfig = config;

    // Initialize Redis client (simplified for demo)
    this.redisClient = {
      get: async (key: string) => {
        // Simulate Redis get operation
        return null; // Would return actual cached value
      },
      set: async (key: string, value: string, ttl?: number) => {
        // Simulate Redis set operation
      },
      del: async (key: string) => {
        // Simulate Redis delete operation
      }
    };

    console.log('✅ Redis cache configured');
  }

  /**
   * Configures CDN caching
   * @param config CDN configuration
   */
  async configureCDN(config: CDNConfig): Promise<void> {
    this.config.cdnConfig = config;

    // Initialize CDN client (simplified for demo)
    this.cdnClient = {
      get: async (key: string) => {
        // Simulate CDN get operation
        return null;
      },
      set: async (key: string, value: any, ttl?: number) => {
        // Simulate CDN set operation
      },
      delete: async (key: string) => {
        // Simulate CDN delete operation
      }
    };

    console.log('✅ CDN cache configured');
  }

  /**
   * Gets cache entries by tag
   * @param tag Tag to search for
   * @returns Cache entries with the specified tag
   */
  getByTag(tag: string): CacheEntry[] {
    return Array.from(this.memoryCache.values()).filter(entry => entry.tags.includes(tag));
  }

  /**
   * Invalidates cache entries by tag
   * @param tag Tag to invalidate
   */
  async invalidateByTag(tag: string): Promise<void> {
    const entriesToDelete = this.getByTag(tag);

    for (const entry of entriesToDelete) {
      await this.delete(entry.key);
    }

    console.log(`🗑️ Invalidated ${entriesToDelete.length} cache entries with tag: ${tag}`);
  }

  /**
   * Gets cache performance report
   * @param timeRange Time range for analysis
   * @returns Cache performance report
   */
  async getPerformanceReport(timeRange: { start: Date; end: Date }): Promise<CachePerformanceReport> {
    const metrics = await this.performanceMonitor.getRealtimeMetrics(['cache_hit', 'cache_miss', 'cache_set', 'cache_delete']);

    return {
      timeRange,
      summary: {
        totalRequests: (metrics.cache_hit || 0) + (metrics.cache_miss || 0),
        hitRate: this.stats.hitRate,
        averageResponseTime: this.stats.averageAccessTime,
        memoryUsage: this.stats.memoryUsage,
        redisUsage: this.stats.redisUsage || 0,
        cdnUsage: this.stats.cdnUsage || 0
      },
      tierBreakdown: {
        memoryHits: metrics.cache_hit || 0,
        redisHits: 0, // Would be tracked separately
        cdnHits: 0, // Would be tracked separately
        misses: metrics.cache_miss || 0
      },
      recommendations: this.generateCacheRecommendations()
    };
  }

  private initializeCache(): void {
    // Initialize cache with default strategies
    this.setupEvictionPolicy();
    this.startCleanupTimer();
  }

  private async getFromMemory<T>(key: string): Promise<T | null> {
    const entry = this.memoryCache.get(key);

    if (!entry) {
      return null;
    }

    // Check TTL
    if (this.isExpired(entry)) {
      this.memoryCache.delete(key);
      this.stats.evictions++;
      return null;
    }

    // Update access statistics
    entry.accessedAt = new Date();
    entry.accessCount++;

    return entry.value as T;
  }

  private async setInMemory<T>(key: string, value: T, ttl: number, tags: string[] = []): Promise<void> {
    // Check if we need to evict entries
    if (this.memoryCache.size >= this.config.maxEntries) {
      this.evictEntries();
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      ttl,
      createdAt: new Date(),
      accessedAt: new Date(),
      accessCount: 0,
      size: this.calculateSize(value),
      tags,
      metadata: {}
    };

    this.memoryCache.set(key, entry);
    this.updateStats();
  }

  private async getFromRedis<T>(key: string): Promise<T | null> {
    if (!this.redisClient) return null;

    try {
      const value = await this.redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  private async setInRedis(key: string, value: any, ttl: number): Promise<void> {
    if (!this.redisClient) return;

    try {
      const serializedValue = JSON.stringify(value);
      await this.redisClient.set(key, serializedValue, ttl);
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  private async deleteFromRedis(key: string): Promise<void> {
    if (!this.redisClient) return;

    try {
      await this.redisClient.del(key);
    } catch (error) {
      console.error('Redis delete error:', error);
    }
  }

  private async clearRedis(): Promise<void> {
    if (!this.redisClient) return;

    try {
      // Clear all keys with our prefix
      const pattern = this.config.redisConfig?.keyPrefix ?
        `${this.config.redisConfig.keyPrefix}*` : '*';
      // In production, would use SCAN and DEL commands
    } catch (error) {
      console.error('Redis clear error:', error);
    }
  }

  private async clearRedisPattern(pattern: string): Promise<void> {
    // Clear Redis keys matching pattern
    // Implementation would depend on Redis client
  }

  private async getFromCDN<T>(key: string): Promise<T | null> {
    if (!this.cdnClient) return null;

    try {
      return await this.cdnClient.get(key);
    } catch (error) {
      console.error('CDN get error:', error);
      return null;
    }
  }

  private async setInCDN(key: string, value: any, ttl: number): Promise<void> {
    if (!this.cdnClient) return;

    try {
      await this.cdnClient.set(key, value, ttl);
    } catch (error) {
      console.error('CDN set error:', error);
    }
  }

  private async deleteFromCDN(key: string): Promise<void> {
    if (!this.cdnClient) return;

    try {
      await this.cdnClient.delete(key);
    } catch (error) {
      console.error('CDN delete error:', error);
    }
  }

  private async clearCDN(pattern?: string): Promise<void> {
    if (!this.cdnClient) return;

    try {
      await this.cdnClient.clear(pattern);
    } catch (error) {
      console.error('CDN clear error:', error);
    }
  }

  private async refreshCache(key: string, strategy: CacheStrategy): Promise<void> {
    // In production, this would fetch fresh data from the source
    // For demo, we'll just log the refresh attempt
    console.log(`🔄 Refreshing cache for key: ${key}`);
  }

  private recordCacheHit(key: string, tier: string, accessTime: number): void {
    this.stats.hits++;
    this.accessTimes.push(accessTime);

    // Keep only last 1000 access times for average calculation
    if (this.accessTimes.length > 1000) {
      this.accessTimes.shift();
    }

    this.performanceMonitor.recordMetric(
      'cache_hit',
      1,
      'count',
      { key, tier }
    );
  }

  private recordCacheMiss(key: string, accessTime: number): void {
    this.stats.misses++;
    this.accessTimes.push(accessTime);

    this.performanceMonitor.recordMetric(
      'cache_miss',
      1,
      'count',
      { key }
    );
  }

  private isExpired(entry: CacheEntry): boolean {
    const now = Date.now();
    const expiryTime = entry.createdAt.getTime() + (entry.ttl * 1000);
    return now > expiryTime;
  }

  private calculateSize(value: any): number {
    // Calculate approximate size in bytes
    return new Blob([JSON.stringify(value)]).size;
  }

  private evictEntries(): void {
    const entries = Array.from(this.memoryCache.entries());

    switch (this.config.evictionPolicy) {
      case 'lru':
        // Evict least recently used
        entries.sort((a, b) => a[1].accessedAt.getTime() - b[1].accessedAt.getTime());
        break;

      case 'lfu':
        // Evict least frequently used
        entries.sort((a, b) => a[1].accessCount - b[1].accessCount);
        break;

      case 'ttl':
        // Evict entries closest to expiry
        entries.sort((a, b) => {
          const aExpiry = a[1].createdAt.getTime() + (a[1].ttl * 1000);
          const bExpiry = b[1].createdAt.getTime() + (b[1].ttl * 1000);
          return aExpiry - bExpiry;
        });
        break;

      case 'random':
        // Random eviction
        for (let i = entries.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [entries[i], entries[j]] = [entries[j], entries[i]];
        }
        break;
    }

    // Remove entries until we're under the limit
    const entriesToRemove = Math.ceil(entries.length * 0.1); // Remove 10% of entries
    for (let i = 0; i < entriesToRemove && entries.length > 0; i++) {
      const [key] = entries[i];
      this.memoryCache.delete(key);
      this.stats.evictions++;
    }
  }

  private updateStats(): void {
    const totalAccesses = this.stats.hits + this.stats.misses;
    this.stats.hitRate = totalAccesses > 0 ? this.stats.hits / totalAccesses : 0;
    this.stats.totalEntries = this.memoryCache.size;
    this.stats.totalSize = Array.from(this.memoryCache.values()).reduce((sum, entry) => sum + entry.size, 0);
    this.stats.averageAccessTime = this.accessTimes.length > 0 ?
      this.accessTimes.reduce((sum, time) => sum + time, 0) / this.accessTimes.length : 0;
    this.stats.memoryUsage = this.stats.totalSize;
  }

  private setupEvictionPolicy(): void {
    // Set up automatic eviction based on memory usage
    if (this.config.evictionPolicy === 'lru') {
      // LRU eviction is handled in evictEntries method
    }
  }

  private startCleanupTimer(): void {
    // Start cleanup timer every 5 minutes
    setInterval(() => {
      this.performCleanup();
    }, 5 * 60 * 1000);
  }

  private performCleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    // Find expired entries
    for (const [key, entry] of this.memoryCache) {
      const expiryTime = entry.createdAt.getTime() + (entry.ttl * 1000);
      if (now > expiryTime) {
        expiredKeys.push(key);
      }
    }

    // Remove expired entries
    for (const key of expiredKeys) {
      this.memoryCache.delete(key);
      this.stats.evictions++;
    }

    if (expiredKeys.length > 0) {
      console.log(`🧹 Cleaned up ${expiredKeys.length} expired cache entries`);
    }

    this.updateStats();
  }

  private matchesPattern(key: string, pattern: string): boolean {
    // Simple pattern matching (in production would use proper glob matching)
    const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp(`^${regexPattern}$`).test(key);
  }

  private isStaticAsset(key: string): boolean {
    // Check if key represents a static asset that should be cached in CDN
    const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.woff', '.woff2'];
    return staticExtensions.some(ext => key.endsWith(ext));
  }

  private getDefaultStrategy(): CacheStrategy {
    return {
      name: 'default',
      readStrategy: 'cache_first',
      writeStrategy: 'write_through',
      fallbackStrategy: 'stale_while_revalidate',
      ttl: this.config.defaultTTL
    };
  }

  private generateCacheRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.stats.hitRate < 0.8) {
      recommendations.push('Cache hit rate is low - consider increasing cache size or adjusting TTL');
    }

    if (this.stats.evictions > this.stats.hits * 0.1) {
      recommendations.push('High eviction rate - consider increasing cache size');
    }

    if (this.stats.averageAccessTime > 10) {
      recommendations.push('Cache access time is high - consider cache optimization');
    }

    if (recommendations.length === 0) {
      recommendations.push('Cache performance is optimal');
    }

    return recommendations;
  }
}

interface CachePerformanceReport {
  timeRange: { start: Date; end: Date };
  summary: {
    totalRequests: number;
    hitRate: number;
    averageResponseTime: number;
    memoryUsage: number;
    redisUsage?: number;
    cdnUsage?: number;
  };
  tierBreakdown: {
    memoryHits: number;
    redisHits: number;
    cdnHits: number;
    misses: number;
  };
  recommendations: string[];
}
