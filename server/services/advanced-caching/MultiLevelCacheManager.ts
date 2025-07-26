import NodeCache from 'node-cache';
import { RedisClusterManager } from './RedisClusterManager';
import { EventEmitter } from 'events';

export interface CacheLevel {
  name: string;
  type: 'memory' | 'redis' | 'persistent';
  ttl: number;
  maxSize?: number;
  compression?: boolean;
  enabled: boolean;
}

export interface CacheOptions {
  ttl?: number;
  level?: 'L1' | 'L2' | 'L3' | 'all';
  skipIfExists?: boolean;
  compression?: boolean;
  tags?: string[];
}

export interface CacheStats {
  level: string;
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  maxSize?: number;
  memoryUsage: number;
  evictions: number;
  lastAccessed?: Date;
}

export interface CacheItem<T = any> {
  key: string;
  value: T;
  ttl: number;
  level: string;
  createdAt: Date;
  accessedAt: Date;
  hits: number;
  tags: string[];
  compressed: boolean;
  size: number;
}

export class MultiLevelCacheManager extends EventEmitter {
  private l1Cache: NodeCache; // Memory cache (fastest)
  private l2Cache: NodeCache; // Secondary memory cache
  private redisCluster: RedisClusterManager | null = null; // L3 distributed cache
  private levels: Map<string, CacheLevel> = new Map();
  private stats: Map<string, CacheStats> = new Map();
  private enabled = true;

  constructor(redisCluster?: RedisClusterManager) {
    super();
    this.redisCluster = redisCluster;

    // Initialize L1 Cache (Hot data, very fast access)
    this.l1Cache = new NodeCache({
      stdTTL: 300, // 5 minutes
      checkperiod: 60, // Check for expired keys every 60 seconds
      maxKeys: 10000,
      useClones: false,
      deleteOnExpire: true,
    });

    // Initialize L2 Cache (Warm data, moderate speed)
    this.l2Cache = new NodeCache({
      stdTTL: 1800, // 30 minutes
      checkperiod: 120,
      maxKeys: 50000,
      useClones: false,
      deleteOnExpire: true,
    });

    this.setupCacheLevels();
    this.setupEventListeners();
    this.initializeStats();
  }

  private setupCacheLevels(): void {
    this.levels.set('L1', {
      name: 'L1-Memory',
      type: 'memory',
      ttl: 300,
      maxSize: 10000,
      compression: false,
      enabled: true,
    });

    this.levels.set('L2', {
      name: 'L2-Memory',
      type: 'memory',
      ttl: 1800,
      maxSize: 50000,
      compression: false,
      enabled: true,
    });

    this.levels.set('L3', {
      name: 'L3-Redis',
      type: 'redis',
      ttl: 3600,
      compression: true,
      enabled: !!this.redisCluster,
    });
  }

  private setupEventListeners(): void {
    // L1 Cache events
    this.l1Cache.on('set', (key, value) => {
      this.updateStats('L1', 'set');
      this.emit('cache-set', { level: 'L1', key, value });
    });

    this.l1Cache.on('get', (key, value) => {
      this.updateStats('L1', value ? 'hit' : 'miss');
      this.emit('cache-get', { level: 'L1', key, hit: !!value });
    });

    this.l1Cache.on('del', (key, value) => {
      this.updateStats('L1', 'delete');
      this.emit('cache-delete', { level: 'L1', key });
    });

    this.l1Cache.on('expired', (key, value) => {
      this.updateStats('L1', 'expired');
      this.emit('cache-expired', { level: 'L1', key });
    });

    // L2 Cache events
    this.l2Cache.on('set', (key, value) => {
      this.updateStats('L2', 'set');
      this.emit('cache-set', { level: 'L2', key, value });
    });

    this.l2Cache.on('get', (key, value) => {
      this.updateStats('L2', value ? 'hit' : 'miss');
      this.emit('cache-get', { level: 'L2', key, hit: !!value });
    });

    this.l2Cache.on('del', (key, value) => {
      this.updateStats('L2', 'delete');
      this.emit('cache-delete', { level: 'L2', key });
    });

    this.l2Cache.on('expired', (key, value) => {
      this.updateStats('L2', 'expired');
      this.emit('cache-expired', { level: 'L2', key });
    });
  }

  private initializeStats(): void {
    this.stats.set('L1', {
      level: 'L1',
      hits: 0,
      misses: 0,
      hitRate: 0,
      size: 0,
      maxSize: 10000,
      memoryUsage: 0,
      evictions: 0,
    });

    this.stats.set('L2', {
      level: 'L2',
      hits: 0,
      misses: 0,
      hitRate: 0,
      size: 0,
      maxSize: 50000,
      memoryUsage: 0,
      evictions: 0,
    });

    this.stats.set('L3', {
      level: 'L3',
      hits: 0,
      misses: 0,
      hitRate: 0,
      size: 0,
      memoryUsage: 0,
      evictions: 0,
    });
  }

  private updateStats(level: string, operation: string): void {
    const stats = this.stats.get(level);
    if (!stats) return;

    switch (operation) {
      case 'hit':
        stats.hits++;
        stats.lastAccessed = new Date();
        break;
      case 'miss':
        stats.misses++;
        break;
      case 'set':
        stats.size++;
        break;
      case 'delete':
      case 'expired':
        stats.size = Math.max(0, stats.size - 1);
        break;
      case 'eviction':
        stats.evictions++;
        break;
    }

    stats.hitRate = stats.hits / (stats.hits + stats.misses) || 0;
    this.stats.set(level, stats);
  }

  async get<T = any>(key: string, options?: CacheOptions): Promise<T | null> {
    if (!this.enabled) return null;

    const targetLevels = this.getTargetLevels(options?.level);
    let value: T | null = null;
    let sourceLevel: string | null = null;

    // Try to get from each level in order (L1 -> L2 -> L3)
    for (const level of targetLevels) {
      if (!this.levels.get(level)?.enabled) continue;

      try {
        switch (level) {
          case 'L1':
            value = this.l1Cache.get<T>(key) || null;
            break;
          case 'L2':
            value = this.l2Cache.get<T>(key) || null;
            break;
          case 'L3':
            if (this.redisCluster?.isReady()) {
              const cluster = this.redisCluster.getCluster();
              if (cluster) {
                const cachedValue = await cluster.get(key);
                if (cachedValue) {
                  try {
                    value = JSON.parse(cachedValue);
                  } catch {
                    value = cachedValue as T;
                  }
                }
              }
            }
            break;
        }

        if (value !== null) {
          sourceLevel = level;
          this.updateStats(level, 'hit');
          break;
        } else {
          this.updateStats(level, 'miss');
        }
      } catch (error) {
        console.error(`Error getting from ${level} cache:`, error);
        this.updateStats(level, 'miss');
      }
    }

    // If found in lower level, promote to higher levels
    if (value !== null && sourceLevel) {
      await this.promoteToHigherLevels(key, value, sourceLevel, options);
    }

    this.emit('cache-lookup', { key, hit: value !== null, sourceLevel });
    return value;
  }

  async set<T = any>(key: string, value: T, options?: CacheOptions): Promise<void> {
    if (!this.enabled) return;

    const targetLevels = this.getTargetLevels(options?.level);
    const ttl = options?.ttl;

    const promises: Promise<void>[] = [];

    for (const level of targetLevels) {
      if (!this.levels.get(level)?.enabled) continue;

      promises.push(this.setToLevel(key, value, level, ttl, options));
    }

    await Promise.allSettled(promises);
    this.emit('cache-set-complete', { key, levels: targetLevels });
  }

  private async setToLevel<T>(
    key: string, 
    value: T, 
    level: string, 
    ttl?: number, 
    options?: CacheOptions
  ): Promise<void> {
    const levelConfig = this.levels.get(level);
    if (!levelConfig?.enabled) return;

    const effectiveTTL = ttl || levelConfig.ttl;

    try {
      switch (level) {
        case 'L1':
          this.l1Cache.set(key, value, effectiveTTL);
          break;
        case 'L2':
          this.l2Cache.set(key, value, effectiveTTL);
          break;
        case 'L3':
          if (this.redisCluster?.isReady()) {
            const cluster = this.redisCluster.getCluster();
            if (cluster) {
              const serialized = typeof value === 'string' ? value : JSON.stringify(value);
              await cluster.setex(key, effectiveTTL, serialized);
            }
          }
          break;
      }
      this.updateStats(level, 'set');
    } catch (error) {
      console.error(`Error setting to ${level} cache:`, error);
      throw error;
    }
  }

  private async promoteToHigherLevels<T>(
    key: string, 
    value: T, 
    sourceLevel: string, 
    options?: CacheOptions
  ): Promise<void> {
    const levelOrder = ['L1', 'L2', 'L3'];
    const sourceIndex = levelOrder.indexOf(sourceLevel);
    
    if (sourceIndex <= 0) return; // Already at highest level or invalid

    // Promote to all higher levels
    const higherLevels = levelOrder.slice(0, sourceIndex);
    
    for (const level of higherLevels) {
      if (this.levels.get(level)?.enabled) {
        try {
          await this.setToLevel(key, value, level, undefined, options);
        } catch (error) {
          console.error(`Error promoting to ${level}:`, error);
        }
      }
    }
  }

  async delete(key: string, options?: CacheOptions): Promise<void> {
    const targetLevels = this.getTargetLevels(options?.level);
    const promises: Promise<void>[] = [];

    for (const level of targetLevels) {
      if (!this.levels.get(level)?.enabled) continue;

      promises.push(this.deleteFromLevel(key, level));
    }

    await Promise.allSettled(promises);
    this.emit('cache-delete-complete', { key, levels: targetLevels });
  }

  private async deleteFromLevel(key: string, level: string): Promise<void> {
    try {
      switch (level) {
        case 'L1':
          this.l1Cache.del(key);
          break;
        case 'L2':
          this.l2Cache.del(key);
          break;
        case 'L3':
          if (this.redisCluster?.isReady()) {
            const cluster = this.redisCluster.getCluster();
            if (cluster) {
              await cluster.del(key);
            }
          }
          break;
      }
      this.updateStats(level, 'delete');
    } catch (error) {
      console.error(`Error deleting from ${level} cache:`, error);
    }
  }

  async clear(level?: 'L1' | 'L2' | 'L3'): Promise<void> {
    const targetLevels = level ? [level] : ['L1', 'L2', 'L3'];

    for (const targetLevel of targetLevels) {
      if (!this.levels.get(targetLevel)?.enabled) continue;

      try {
        switch (targetLevel) {
          case 'L1':
            this.l1Cache.flushAll();
            break;
          case 'L2':
            this.l2Cache.flushAll();
            break;
          case 'L3':
            if (this.redisCluster?.isReady()) {
              const cluster = this.redisCluster.getCluster();
              if (cluster) {
                await cluster.flushall();
              }
            }
            break;
        }
      } catch (error) {
        console.error(`Error clearing ${targetLevel} cache:`, error);
      }
    }

    this.emit('cache-cleared', { levels: targetLevels });
  }

  getStats(): Map<string, CacheStats> {
    // Update current sizes
    const l1Stats = this.stats.get('L1')!;
    const l2Stats = this.stats.get('L2')!;

    l1Stats.size = this.l1Cache.keys().length;
    l2Stats.size = this.l2Cache.keys().length;

    // Estimate memory usage (rough calculation)
    l1Stats.memoryUsage = this.l1Cache.keys().length * 1024; // Rough estimate
    l2Stats.memoryUsage = this.l2Cache.keys().length * 1024;

    return this.stats;
  }

  getOverallStats() {
    const stats = this.getStats();
    const totalHits = Array.from(stats.values()).reduce((sum, stat) => sum + stat.hits, 0);
    const totalMisses = Array.from(stats.values()).reduce((sum, stat) => sum + stat.misses, 0);
    const totalSize = Array.from(stats.values()).reduce((sum, stat) => sum + stat.size, 0);

    return {
      totalHits,
      totalMisses,
      overallHitRate: totalHits / (totalHits + totalMisses) || 0,
      totalSize,
      levels: Object.fromEntries(stats),
    };
  }

  private getTargetLevels(level?: 'L1' | 'L2' | 'L3' | 'all'): string[] {
    switch (level) {
      case 'L1':
        return ['L1'];
      case 'L2':
        return ['L2'];
      case 'L3':
        return ['L3'];
      case 'all':
      default:
        return ['L1', 'L2', 'L3'];
    }
  }

  async warmup(keys: string[], level?: 'L1' | 'L2' | 'L3'): Promise<void> {
    // Implementation for cache warming will be in the warming strategies
    this.emit('warmup-started', { keys, level });
  }

  enableLevel(level: 'L1' | 'L2' | 'L3'): void {
    const levelConfig = this.levels.get(level);
    if (levelConfig) {
      levelConfig.enabled = true;
      this.levels.set(level, levelConfig);
    }
  }

  disableLevel(level: 'L1' | 'L2' | 'L3'): void {
    const levelConfig = this.levels.get(level);
    if (levelConfig) {
      levelConfig.enabled = false;
      this.levels.set(level, levelConfig);
    }
  }

  enable(): void {
    this.enabled = true;
    this.emit('cache-enabled');
  }

  disable(): void {
    this.enabled = false;
    this.emit('cache-disabled');
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async shutdown(): Promise<void> {
    this.l1Cache.flushAll();
    this.l1Cache.close();
    
    this.l2Cache.flushAll();
    this.l2Cache.close();

    this.emit('cache-shutdown');
  }
}

// Export for easy access patterns
export const CacheLevels = {
  L1: 'L1' as const,
  L2: 'L2' as const,
  L3: 'L3' as const,
  ALL: 'all' as const,
} as const;
