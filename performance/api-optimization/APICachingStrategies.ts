import { createHash } from 'crypto';
import { Request, Response, NextFunction } from 'express';

export interface CacheConfig {
  ttl: number; // Time to live in seconds
  maxSize: number; // Maximum cache size in MB
  strategy: 'lru' | 'lfu' | 'fifo' | 'ttl';
  compression: boolean;
  serialize: boolean;
  warming: boolean;
}

export interface CacheEntry {
  key: string;
  value: any;
  ttl: number;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  size: number;
  compressed: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalSize: number;
  entryCount: number;
  averageResponseTime: number;
  memoryUsage: number;
}

export class APICachingStrategies {
  private cache: Map<string, CacheEntry> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalSize: 0,
    entryCount: 0,
    averageResponseTime: 0,
    memoryUsage: 0
  };
  private config: CacheConfig;
  private cleanupInterval: NodeJS.Timeout;

  constructor(config: CacheConfig) {
    this.config = config;
    this.startCleanupProcess();
  }

  middleware(options: {
    keyGenerator?: (req: Request) => string;
    condition?: (req: Request, res: Response) => boolean;
    ttl?: number;
    varyBy?: string[];
  } = {}) {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip caching for non-GET requests by default
      if (req.method !== 'GET' && !options.condition?.(req, res)) {
        return next();
      }

      const cacheKey = options.keyGenerator ? 
        options.keyGenerator(req) : 
        this.generateCacheKey(req, options.varyBy);

      const startTime = Date.now();

      // Try to get from cache
      const cachedResponse = this.get(cacheKey);
      if (cachedResponse) {
        this.recordHit(Date.now() - startTime);
        
        // Set cache headers
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Key', cacheKey);
        
        return res.json(cachedResponse);
      }

      // Cache miss - proceed with request
      this.recordMiss();
      res.set('X-Cache', 'MISS');
      res.set('X-Cache-Key', cacheKey);

      // Override res.json to cache the response
      const originalJson = res.json.bind(res);
      res.json = (body: any) => {
        const responseTime = Date.now() - startTime;
        
        // Cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const ttl = options.ttl || this.config.ttl;
          this.set(cacheKey, body, ttl);
        }

        this.updateResponseTime(responseTime);
        return originalJson(body);
      };

      next();
    };
  }

  private generateCacheKey(req: Request, varyBy: string[] = []): string {
    const baseKey = `${req.method}:${req.path}`;
    const queryString = new URLSearchParams(req.query as any).toString();
    
    let keyComponents = [baseKey];
    
    if (queryString) {
      keyComponents.push(queryString);
    }

    // Add vary-by headers
    varyBy.forEach(header => {
      const value = req.get(header);
      if (value) {
        keyComponents.push(`${header}:${value}`);
      }
    });

    const fullKey = keyComponents.join('|');
    return createHash('md5').update(fullKey).digest('hex');
  }

  set(key: string, value: any, ttl?: number): boolean {
    try {
      const serializedValue = this.config.serialize ? JSON.stringify(value) : value;
      const compressed = this.config.compression ? this.compress(serializedValue) : serializedValue;
      const size = this.calculateSize(compressed);
      
      // Check if adding this entry would exceed max size
      if (this.stats.totalSize + size > this.config.maxSize * 1024 * 1024) {
        this.evictEntries(size);
      }

      const entry: CacheEntry = {
        key,
        value: compressed,
        ttl: ttl || this.config.ttl,
        createdAt: new Date(),
        lastAccessed: new Date(),
        accessCount: 0,
        size,
        compressed: this.config.compression
      };

      // Remove existing entry if it exists
      if (this.cache.has(key)) {
        const existingEntry = this.cache.get(key)!;
        this.stats.totalSize -= existingEntry.size;
        this.stats.entryCount--;
      }

      this.cache.set(key, entry);
      this.stats.totalSize += size;
      this.stats.entryCount++;

      return true;
    } catch (error) {
      console.error('Error setting cache entry:', error);
      return false;
    }
  }

  get(key: string): any {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if entry has expired
    const now = new Date();
    const expiredAt = new Date(entry.createdAt.getTime() + entry.ttl * 1000);
    
    if (now > expiredAt) {
      this.delete(key);
      return null;
    }

    // Update access statistics
    entry.lastAccessed = now;
    entry.accessCount++;

    // Decompress and deserialize if needed
    let value = entry.value;
    if (entry.compressed) {
      value = this.decompress(value);
    }
    if (this.config.serialize) {
      value = JSON.parse(value);
    }

    return value;
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.stats.totalSize -= entry.size;
      this.stats.entryCount--;
      return this.cache.delete(key);
    }
    return false;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check if expired
    const now = new Date();
    const expiredAt = new Date(entry.createdAt.getTime() + entry.ttl * 1000);
    
    if (now > expiredAt) {
      this.delete(key);
      return false;
    }

    return true;
  }

  clear(): void {
    this.cache.clear();
    this.stats.totalSize = 0;
    this.stats.entryCount = 0;
  }

  private evictEntries(requiredSize: number): void {
    const maxSize = this.config.maxSize * 1024 * 1024;
    const targetSize = maxSize * 0.8; // Keep 80% full after eviction
    
    let freedSize = 0;
    const entries = Array.from(this.cache.values());

    switch (this.config.strategy) {
      case 'lru':
        entries.sort((a, b) => a.lastAccessed.getTime() - b.lastAccessed.getTime());
        break;
      case 'lfu':
        entries.sort((a, b) => a.accessCount - b.accessCount);
        break;
      case 'fifo':
        entries.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        break;
      case 'ttl':
        entries.sort((a, b) => {
          const aExpiry = a.createdAt.getTime() + a.ttl * 1000;
          const bExpiry = b.createdAt.getTime() + b.ttl * 1000;
          return aExpiry - bExpiry;
        });
        break;
    }

    for (const entry of entries) {
      if (this.stats.totalSize - freedSize <= targetSize) {
        break;
      }

      this.delete(entry.key);
      freedSize += entry.size;
    }

    console.log(`Cache eviction completed. Freed ${freedSize} bytes using ${this.config.strategy} strategy.`);
  }

  private compress(data: string): string {
    // Simple compression simulation - in production, use zlib or similar
    try {
      return Buffer.from(data).toString('base64');
    } catch {
      return data;
    }
  }

  private decompress(data: string): string {
    // Simple decompression simulation
    try {
      return Buffer.from(data, 'base64').toString();
    } catch {
      return data;
    }
  }

  private calculateSize(data: any): number {
    if (typeof data === 'string') {
      return Buffer.byteLength(data, 'utf8');
    }
    return Buffer.byteLength(JSON.stringify(data), 'utf8');
  }

  private recordHit(responseTime: number): void {
    this.stats.hits++;
    this.updateHitRate();
    this.updateResponseTime(responseTime);
  }

  private recordMiss(): void {
    this.stats.misses++;
    this.updateHitRate();
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  private updateResponseTime(responseTime: number): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.averageResponseTime = total > 1 ? 
      (this.stats.averageResponseTime * (total - 1) + responseTime) / total :
      responseTime;
  }

  private startCleanupProcess(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Run every minute
  }

  private cleanup(): void {
    const now = new Date();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      const expiredAt = new Date(entry.createdAt.getTime() + entry.ttl * 1000);
      if (now > expiredAt) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.delete(key));
    
    // Update memory usage
    this.stats.memoryUsage = this.stats.totalSize;

    if (expiredKeys.length > 0) {
      console.log(`Cache cleanup: removed ${expiredKeys.length} expired entries`);
    }
  }

  warmup(entries: Array<{key: string, value: any, ttl?: number}>): Promise<void> {
    if (!this.config.warming) {
      return Promise.resolve();
    }

    console.log(`Warming up cache with ${entries.length} entries...`);

    return new Promise((resolve) => {
      entries.forEach(entry => {
        this.set(entry.key, entry.value, entry.ttl);
      });
      
      console.log('Cache warmup completed');
      resolve();
    });
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  getTopKeys(limit: number = 10): Array<{key: string, accessCount: number, size: number}> {
    return Array.from(this.cache.values())
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit)
      .map(entry => ({
        key: entry.key,
        accessCount: entry.accessCount,
        size: entry.size
      }));
  }

  getExpiringSoon(minutes: number = 5): Array<{key: string, expiresAt: Date}> {
    const now = new Date();
    const threshold = new Date(now.getTime() + minutes * 60 * 1000);

    return Array.from(this.cache.values())
      .map(entry => ({
        key: entry.key,
        expiresAt: new Date(entry.createdAt.getTime() + entry.ttl * 1000)
      }))
      .filter(item => item.expiresAt <= threshold && item.expiresAt > now)
      .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());
  }

  exportCache(): string {
    const cacheData = {
      entries: Array.from(this.cache.entries()),
      stats: this.stats,
      config: this.config,
      timestamp: new Date()
    };

    return JSON.stringify(cacheData, null, 2);
  }

  importCache(data: string): boolean {
    try {
      const cacheData = JSON.parse(data);
      
      this.clear();
      
      cacheData.entries.forEach(([key, entry]: [string, CacheEntry]) => {
        this.cache.set(key, entry);
        this.stats.totalSize += entry.size;
        this.stats.entryCount++;
      });

      console.log(`Cache imported: ${this.stats.entryCount} entries`);
      return true;
    } catch (error) {
      console.error('Error importing cache:', error);
      return false;
    }
  }

  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
    console.log('API caching strategies shutdown complete');
  }
}

// Predefined caching strategies
export const CachingPresets = {
  aggressive: {
    ttl: 3600, // 1 hour
    maxSize: 256, // 256MB
    strategy: 'lru' as const,
    compression: true,
    serialize: true,
    warming: true
  },
  
  moderate: {
    ttl: 900, // 15 minutes
    maxSize: 128, // 128MB
    strategy: 'lfu' as const,
    compression: true,
    serialize: true,
    warming: false
  },
  
  conservative: {
    ttl: 300, // 5 minutes
    maxSize: 64, // 64MB
    strategy: 'ttl' as const,
    compression: false,
    serialize: true,
    warming: false
  },

  realtime: {
    ttl: 60, // 1 minute
    maxSize: 32, // 32MB
    strategy: 'fifo' as const,
    compression: false,
    serialize: true,
    warming: false
  }
};
