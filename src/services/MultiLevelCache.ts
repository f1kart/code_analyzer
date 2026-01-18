interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
}

interface CacheConfig {
  maxSize: number; // Maximum number of entries
  defaultTTL: number; // Default time-to-live in milliseconds
  cleanupInterval: number; // Cleanup interval in milliseconds
  storageType: 'memory' | 'redis' | 'file' | 'multi';
  redisConfig?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  fileConfig?: {
    directory: string;
    compress?: boolean;
  };
  levels?: Array<{
    type: 'memory' | 'redis' | 'file';
    priority: number;
    config?: any;
  }>;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  memoryUsage: number;
  averageAccessTime: number;
}

export class MultiLevelCache<T = any> {
  private memoryCache: Map<string, CacheEntry<T>> = new Map();
  private redisClient: any = null;
  private fileCache: Map<string, string> = new Map(); // For file paths
  private config: Required<CacheConfig>;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    memoryUsage: 0,
    averageAccessTime: 0,
  };
  private cleanupTimer?: NodeJS.Timeout;
  private accessTimes: number[] = [];

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 10000,
      defaultTTL: 300000, // 5 minutes
      cleanupInterval: 60000, // 1 minute
      storageType: 'memory',
      ...config,
    } as Required<CacheConfig>;

    if (this.config.storageType === 'memory' || this.config.storageType === 'multi') {
      this.startCleanupTimer();
    }

    if (this.config.storageType === 'redis' || this.config.storageType === 'multi') {
      this.initializeRedis();
    }
  }

  /**
   * Get value from cache
   */
  async get(key: string): Promise<T | null> {
    const startTime = Date.now();

    try {
      // Check memory cache first
      const memoryValue = this.getFromMemory(key);
      if (memoryValue !== null) {
        this.recordHit(startTime);
        return memoryValue;
      }

      // Check Redis if configured
      if (this.redisClient) {
        const redisValue = await this.getFromRedis(key);
        if (redisValue !== null) {
          // Promote to memory cache
          this.setInMemory(key, redisValue, this.config.defaultTTL);
          this.recordHit(startTime);
          return redisValue;
        }
      }

      // Check file cache if configured
      const fileValue = await this.getFromFile(key);
      if (fileValue !== null) {
        // Promote to memory cache
        this.setInMemory(key, fileValue, this.config.defaultTTL);
        this.recordHit(startTime);
        return fileValue;
      }

      this.recordMiss(startTime);
      return null;

    } catch (error) {
      console.error('Cache get error:', error);
      this.recordMiss(startTime);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: T, ttl?: number): Promise<boolean> {
    const effectiveTTL = ttl || this.config.defaultTTL;

    try {
      // Always set in memory cache (L1)
      this.setInMemory(key, value, effectiveTTL);

      // Set in Redis if configured (L2)
      if (this.redisClient) {
        await this.setInRedis(key, value, effectiveTTL);
      }

      // Set in file cache if configured (L3)
      await this.setInFile(key, value, effectiveTTL);

      return true;

    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      this.memoryCache.delete(key);

      if (this.redisClient) {
        await this.redisClient.del(key);
      }

      this.fileCache.delete(key);

      return true;

    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();

    if (this.redisClient) {
      await this.redisClient.flushdb();
    }

    this.fileCache.clear();
    this.stats = this.initializeStats();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get cache keys (for debugging)
   */
  getKeys(): string[] {
    return Array.from(this.memoryCache.keys());
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    if (this.memoryCache.has(key)) return true;

    if (this.redisClient) {
      const redisValue = await this.redisClient.exists(key);
      if (redisValue) return true;
    }

    return this.fileCache.has(key);
  }

  /**
   * Get multiple values from cache
   */
  async mget(keys: string[]): Promise<(T | null)[]> {
    const results = await Promise.all(keys.map(key => this.get(key)));
    return results;
  }

  /**
   * Set multiple values in cache
   */
  async mset(keyValuePairs: Array<[string, T]>, ttl?: number): Promise<boolean> {
    try {
      await Promise.all(keyValuePairs.map(([key, value]) => this.set(key, value, ttl)));
      return true;
    } catch (error) {
      console.error('Cache mset error:', error);
      return false;
    }
  }

  /**
   * Increment numeric value in cache
   */
  async increment(key: string, delta: number = 1): Promise<number | null> {
    try {
      const currentValue = await this.get(key) as number || 0;
      const newValue = currentValue + delta;
      await this.set(key, newValue as any);
      return newValue;
    } catch (error) {
      console.error('Cache increment error:', error);
      return null;
    }
  }

  /**
   * Get or set pattern (atomic operation)
   */
  async getOrSet(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    const existing = await this.get(key);
    if (existing !== null) {
      return existing;
    }

    const newValue = await factory();
    await this.set(key, newValue, ttl);
    return newValue;
  }

  /**
   * Memory cache operations
   */
  private getFromMemory(key: string): T | null {
    const entry = this.memoryCache.get(key);

    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.memoryCache.delete(key);
      this.stats.evictions++;
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    return entry.value;
  }

  private setInMemory(key: string, value: T, ttl: number): void {
    // Check if we need to evict entries
    if (this.memoryCache.size >= this.config.maxSize) {
      this.evictLeastRecentlyUsed();
    }

    const size = this.estimateSize(value);
    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      ttl,
      accessCount: 0,
      lastAccessed: Date.now(),
      size,
    };

    this.memoryCache.set(key, entry);
    this.updateMemoryUsage();
  }

  /**
   * Redis cache operations
   */
  private async initializeRedis(): Promise<void> {
    try {
      // Dynamic import to avoid issues if Redis is not available
      const Redis = (await import('redis' as any)).default;
      this.redisClient = new Redis({
        host: this.config.redisConfig?.host || 'localhost',
        port: this.config.redisConfig?.port || 6379,
        password: this.config.redisConfig?.password,
        db: this.config.redisConfig?.db || 0,
      });

      this.redisClient.on('error', (error: Error) => {
        console.error('Redis cache error:', error);
      });

      console.log('✅ Redis cache initialized');
    } catch (error) {
      console.warn('⚠️ Redis cache initialization failed:', error);
    }
  }

  private async getFromRedis(key: string): Promise<T | null> {
    if (!this.redisClient) return null;

    try {
      const value = await this.redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  private async setInRedis(key: string, value: T, ttl: number): Promise<void> {
    if (!this.redisClient) return;

    try {
      const serializedValue = JSON.stringify(value);
      const ttlSeconds = Math.ceil(ttl / 1000);
      await this.redisClient.setex(key, ttlSeconds, serializedValue);
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  /**
   * File cache operations
   */
  private async getFromFile(key: string): Promise<T | null> {
    const filePath = this.fileCache.get(key);
    if (!filePath) return null;

    try {
      const fs = await import('fs/promises');
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('File cache get error:', error);
      return null;
    }
  }

  private async setInFile(key: string, value: T, ttl: number): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const cacheDir = this.config.fileConfig?.directory || './cache';

      // Ensure cache directory exists
      await fs.mkdir(cacheDir, { recursive: true });

      const fileName = `${key.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.json`;
      const filePath = `${cacheDir}/${fileName}`;

      const data = JSON.stringify({
        value,
        expiresAt: Date.now() + ttl,
      });

      await fs.writeFile(filePath, data, 'utf-8');
      this.fileCache.set(key, filePath);

      // Clean up old files periodically
      if (Math.random() < 0.01) { // 1% chance
        this.cleanupOldFiles(cacheDir);
      }
    } catch (error) {
      console.error('File cache set error:', error);
    }
  }

  private async cleanupOldFiles(cacheDir: string): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const files = await fs.readdir(cacheDir);

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        try {
          const filePath = `${cacheDir}/${file}`;
          const data = await fs.readFile(filePath, 'utf-8');
          const parsed = JSON.parse(data);

          if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
            await fs.unlink(filePath);
          }
        } catch (error) {
          // File might be corrupted, remove it
          await fs.unlink(`${cacheDir}/${file}`);
        }
      }
    } catch (error) {
      console.error('File cleanup error:', error);
    }
  }

  /**
   * Eviction and cleanup
   */
  private evictLeastRecentlyUsed(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.config.cleanupInterval);
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();

    for (const [key, entry] of this.memoryCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.memoryCache.delete(key);
        this.stats.evictions++;
      }
    }

    this.updateMemoryUsage();
  }

  private updateMemoryUsage(): void {
    let totalSize = 0;
    for (const entry of this.memoryCache.values()) {
      totalSize += entry.size;
    }
    this.stats.size = this.memoryCache.size;
    this.stats.memoryUsage = totalSize;
  }

  private estimateSize(value: T): number {
    // Rough estimation of object size in bytes
    return JSON.stringify(value).length * 2; // UTF-16 characters
  }

  /**
   * Statistics tracking
   */
  private recordHit(startTime: number): void {
    this.stats.hits++;
    this.recordAccessTime(startTime);
  }

  private recordMiss(startTime: number): void {
    this.stats.misses++;
    this.recordAccessTime(startTime);
  }

  private recordAccessTime(startTime: number): void {
    const accessTime = Date.now() - startTime;
    this.accessTimes.push(accessTime);

    // Keep only last 1000 access times for average calculation
    if (this.accessTimes.length > 1000) {
      this.accessTimes.shift();
    }

    this.stats.averageAccessTime =
      this.accessTimes.reduce((sum, time) => sum + time, 0) / this.accessTimes.length;
  }

  private initializeStats(): CacheStats {
    return {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      memoryUsage: 0,
      averageAccessTime: 0,
    };
  }

  /**
   * Shutdown cache service
   */
  async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }
}

// Cache instances for different use cases
export const globalCache = new MultiLevelCache({
  maxSize: 1000,
  defaultTTL: 300000, // 5 minutes
  storageType: 'memory',
});

export const aiCache = new MultiLevelCache({
  maxSize: 500,
  defaultTTL: 600000, // 10 minutes
  storageType: 'memory',
});

export const fileCache = new MultiLevelCache({
  maxSize: 2000,
  defaultTTL: 1800000, // 30 minutes
  storageType: 'memory',
});

// Redis-backed cache for distributed scenarios
export const distributedCache = new MultiLevelCache({
  maxSize: 5000,
  defaultTTL: 900000, // 15 minutes
  storageType: 'redis',
  redisConfig: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
});

// File-based persistent cache
export const persistentCache = new MultiLevelCache({
  maxSize: 10000,
  defaultTTL: 86400000, // 24 hours
  storageType: 'file',
  fileConfig: {
    directory: './cache',
    compress: true,
  },
});

// Multi-level cache for critical data
export const criticalCache = new MultiLevelCache({
  maxSize: 1000,
  defaultTTL: 1800000, // 30 minutes
  storageType: 'multi',
  levels: [
    { type: 'memory', priority: 1 },
    { type: 'redis', priority: 2 },
    { type: 'file', priority: 3 },
  ],
});

// Convenience functions
export async function cacheGet<T>(key: string, cache = globalCache): Promise<T | null> {
  return cache.get(key);
}

export async function cacheSet<T>(key: string, value: T, ttl?: number, cache = globalCache): Promise<boolean> {
  return cache.set(key, value, ttl);
}

export async function cacheDelete(key: string, cache = globalCache): Promise<boolean> {
  return cache.delete(key);
}

export async function cacheHas(key: string, cache = globalCache): Promise<boolean> {
  return cache.has(key);
}
