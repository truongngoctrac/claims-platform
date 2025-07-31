/**
 * Distributed Caching Implementation
 * Healthcare Claims Processing System - Distributed Systems
 */

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  ttl: number;
  createdAt: number;
  accessedAt: number;
  version: number;
  tags: string[];
  metadata: Record<string, any>;
}

export interface CacheNode {
  id: string;
  host: string;
  port: number;
  weight: number;
  isHealthy: boolean;
  lastHealthCheck: Date;
  connections: number;
  region?: string;
}

export interface DistributedCacheConfig {
  nodes: CacheNode[];
  replicationFactor: number;
  consistencyLevel: 'eventual' | 'strong' | 'weak';
  partitionStrategy: 'hash' | 'range' | 'consistent_hash';
  defaultTTL: number;
  maxSize: number;
  evictionPolicy: 'lru' | 'lfu' | 'ttl' | 'random';
  syncInterval: number;
  healthCheckInterval: number;
}

export interface CacheOperation {
  type: 'set' | 'get' | 'delete' | 'invalidate';
  key: string;
  value?: any;
  ttl?: number;
  version?: number;
  timestamp: number;
  nodeId: string;
}

export abstract class DistributedCache {
  protected config: DistributedCacheConfig;
  protected nodes: Map<string, CacheNode> = new Map();
  protected localCache: Map<string, CacheEntry> = new Map();
  protected operationLog: CacheOperation[] = [];

  constructor(config: DistributedCacheConfig) {
    this.config = config;
    config.nodes.forEach(node => this.nodes.set(node.id, node));
    this.startHealthChecks();
    this.startSynchronization();
  }

  abstract set(key: string, value: any, ttl?: number): Promise<boolean>;
  abstract get(key: string): Promise<any>;
  abstract delete(key: string): Promise<boolean>;
  abstract invalidate(pattern: string): Promise<number>;
  abstract getNodes(key: string): CacheNode[];

  protected abstract partition(key: string): string[];
  protected abstract replicate(operation: CacheOperation): Promise<void>;

  private startHealthChecks(): void {
    setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval);
  }

  private startSynchronization(): void {
    setInterval(async () => {
      if (this.config.consistencyLevel === 'eventual') {
        await this.synchronizeNodes();
      }
    }, this.config.syncInterval);
  }

  private async performHealthChecks(): Promise<void> {
    const healthPromises = Array.from(this.nodes.values()).map(async (node) => {
      try {
        const isHealthy = await this.checkNodeHealth(node);
        node.isHealthy = isHealthy;
        node.lastHealthCheck = new Date();
      } catch (error) {
        console.error(`❌ Health check failed for node ${node.id}:`, error);
        node.isHealthy = false;
      }
    });

    await Promise.allSettled(healthPromises);
  }

  private async checkNodeHealth(node: CacheNode): Promise<boolean> {
    // Simulate health check - in real implementation would ping the node
    return Math.random() > 0.1; // 90% success rate
  }

  private async synchronizeNodes(): Promise<void> {
    // Implement eventual consistency synchronization
    const recentOperations = this.operationLog.filter(
      op => Date.now() - op.timestamp < this.config.syncInterval * 2
    );

    if (recentOperations.length === 0) return;

    console.log(`🔄 Synchronizing ${recentOperations.length} operations`);

    for (const operation of recentOperations) {
      await this.replicateOperation(operation);
    }

    // Clean old operations
    this.operationLog = this.operationLog.filter(
      op => Date.now() - op.timestamp < this.config.syncInterval * 10
    );
  }

  private async replicateOperation(operation: CacheOperation): Promise<void> {
    const targetNodes = this.getNodes(operation.key);
    
    const promises = targetNodes.map(async (node) => {
      if (node.isHealthy && node.id !== operation.nodeId) {
        try {
          await this.sendOperationToNode(node, operation);
        } catch (error) {
          console.error(`❌ Failed to replicate to ${node.id}:`, error);
        }
      }
    });

    await Promise.allSettled(promises);
  }

  private async sendOperationToNode(node: CacheNode, operation: CacheOperation): Promise<void> {
    // Simulate sending operation to node
    console.log(`📤 Sending ${operation.type} operation to ${node.id}`);
  }

  protected logOperation(operation: CacheOperation): void {
    this.operationLog.push(operation);
  }

  protected isExpired(entry: CacheEntry): boolean {
    return Date.now() > entry.createdAt + entry.ttl;
  }

  protected shouldEvict(): boolean {
    return this.localCache.size >= this.config.maxSize;
  }

  protected evictEntries(): void {
    const entriesToEvict = Math.floor(this.config.maxSize * 0.1); // Evict 10%
    
    switch (this.config.evictionPolicy) {
      case 'lru':
        this.evictLRU(entriesToEvict);
        break;
      case 'lfu':
        this.evictLFU(entriesToEvict);
        break;
      case 'ttl':
        this.evictExpired();
        break;
      case 'random':
        this.evictRandom(entriesToEvict);
        break;
    }
  }

  private evictLRU(count: number): void {
    const sorted = Array.from(this.localCache.entries())
      .sort(([, a], [, b]) => a.accessedAt - b.accessedAt);
    
    for (let i = 0; i < Math.min(count, sorted.length); i++) {
      this.localCache.delete(sorted[i][0]);
    }
  }

  private evictLFU(count: number): void {
    // Implementation would track access frequency
    this.evictRandom(count);
  }

  private evictExpired(): void {
    for (const [key, entry] of this.localCache.entries()) {
      if (this.isExpired(entry)) {
        this.localCache.delete(key);
      }
    }
  }

  private evictRandom(count: number): void {
    const keys = Array.from(this.localCache.keys());
    for (let i = 0; i < Math.min(count, keys.length); i++) {
      const randomKey = keys[Math.floor(Math.random() * keys.length)];
      this.localCache.delete(randomKey);
    }
  }
}

export class ConsistentHashCache extends DistributedCache {
  private hashRing: Map<number, string> = new Map();
  private virtualNodes: number = 100;

  constructor(config: DistributedCacheConfig) {
    super(config);
    this.buildHashRing();
  }

  private buildHashRing(): void {
    this.hashRing.clear();
    
    this.nodes.forEach((node) => {
      for (let i = 0; i < this.virtualNodes; i++) {
        const hash = this.hash(`${node.id}:${i}`);
        this.hashRing.set(hash, node.id);
      }
    });
  }

  private hash(key: string): number {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  protected partition(key: string): string[] {
    const keyHash = this.hash(key);
    const sortedHashes = Array.from(this.hashRing.keys()).sort((a, b) => a - b);
    
    let targetHash = sortedHashes.find(hash => hash >= keyHash);
    if (!targetHash) {
      targetHash = sortedHashes[0]; // Wrap around
    }
    
    const primaryNode = this.hashRing.get(targetHash)!;
    const nodeIds = [primaryNode];
    
    // Add replica nodes
    let currentIndex = sortedHashes.indexOf(targetHash);
    for (let i = 1; i < this.config.replicationFactor; i++) {
      currentIndex = (currentIndex + 1) % sortedHashes.length;
      const replicaNode = this.hashRing.get(sortedHashes[currentIndex])!;
      if (!nodeIds.includes(replicaNode)) {
        nodeIds.push(replicaNode);
      }
    }
    
    return nodeIds;
  }

  getNodes(key: string): CacheNode[] {
    const nodeIds = this.partition(key);
    return nodeIds.map(id => this.nodes.get(id)!).filter(node => node.isHealthy);
  }

  async set(key: string, value: any, ttl = this.config.defaultTTL): Promise<boolean> {
    const entry: CacheEntry = {
      key,
      value,
      ttl,
      createdAt: Date.now(),
      accessedAt: Date.now(),
      version: 1,
      tags: [],
      metadata: {},
    };

    if (this.shouldEvict()) {
      this.evictEntries();
    }

    this.localCache.set(key, entry);

    const operation: CacheOperation = {
      type: 'set',
      key,
      value,
      ttl,
      version: entry.version,
      timestamp: Date.now(),
      nodeId: 'local', // In real implementation, would be actual node ID
    };

    this.logOperation(operation);
    await this.replicate(operation);

    return true;
  }

  async get(key: string): Promise<any> {
    const localEntry = this.localCache.get(key);
    
    if (localEntry && !this.isExpired(localEntry)) {
      localEntry.accessedAt = Date.now();
      return localEntry.value;
    }

    // Try to get from other nodes
    if (this.config.consistencyLevel === 'strong') {
      return this.getFromNodes(key);
    }

    return null;
  }

  private async getFromNodes(key: string): Promise<any> {
    const targetNodes = this.getNodes(key);
    
    for (const node of targetNodes) {
      try {
        const value = await this.getFromNode(node, key);
        if (value !== null) {
          // Cache locally
          await this.set(key, value);
          return value;
        }
      } catch (error) {
        console.error(`❌ Failed to get from node ${node.id}:`, error);
      }
    }
    
    return null;
  }

  private async getFromNode(node: CacheNode, key: string): Promise<any> {
    // Simulate getting value from remote node
    return null;
  }

  async delete(key: string): Promise<boolean> {
    const deleted = this.localCache.delete(key);

    const operation: CacheOperation = {
      type: 'delete',
      key,
      timestamp: Date.now(),
      nodeId: 'local',
    };

    this.logOperation(operation);
    await this.replicate(operation);

    return deleted;
  }

  async invalidate(pattern: string): Promise<number> {
    let invalidated = 0;
    const regex = new RegExp(pattern);
    
    for (const [key] of this.localCache.entries()) {
      if (regex.test(key)) {
        await this.delete(key);
        invalidated++;
      }
    }

    return invalidated;
  }

  protected async replicate(operation: CacheOperation): Promise<void> {
    const targetNodes = this.getNodes(operation.key);
    
    const promises = targetNodes.map(async (node) => {
      if (node.isHealthy) {
        try {
          await this.sendOperationToNode(node, operation);
        } catch (error) {
          console.error(`❌ Failed to replicate to ${node.id}:`, error);
        }
      }
    });

    if (this.config.consistencyLevel === 'strong') {
      await Promise.all(promises);
    } else {
      await Promise.allSettled(promises);
    }
  }
}

export class RedisClusterCache extends DistributedCache {
  private redisClients: Map<string, any> = new Map();

  constructor(config: DistributedCacheConfig) {
    super(config);
    this.initializeRedisClients();
  }

  private initializeRedisClients(): void {
    this.nodes.forEach((node) => {
      // In real implementation, would create Redis client
      const client = {
        host: node.host,
        port: node.port,
        // Redis client instance
      };
      this.redisClients.set(node.id, client);
    });
  }

  protected partition(key: string): string[] {
    // Redis Cluster uses CRC16 hash slot calculation
    const slot = this.calculateSlot(key);
    const slotsPerNode = 16384 / this.nodes.size;
    const nodeIndex = Math.floor(slot / slotsPerNode);
    const nodeIds = Array.from(this.nodes.keys());
    
    return [nodeIds[nodeIndex % nodeIds.length]];
  }

  private calculateSlot(key: string): number {
    // Simplified CRC16 calculation for Redis Cluster
    let crc = 0;
    for (let i = 0; i < key.length; i++) {
      crc = ((crc << 1) ^ key.charCodeAt(i)) & 0xFFFF;
    }
    return crc % 16384;
  }

  getNodes(key: string): CacheNode[] {
    const nodeIds = this.partition(key);
    return nodeIds.map(id => this.nodes.get(id)!).filter(node => node.isHealthy);
  }

  async set(key: string, value: any, ttl = this.config.defaultTTL): Promise<boolean> {
    const targetNodes = this.getNodes(key);
    
    const promises = targetNodes.map(async (node) => {
      const client = this.redisClients.get(node.id);
      try {
        // await client.setex(key, ttl, JSON.stringify(value));
        console.log(`💾 Set ${key} on Redis node ${node.id}`);
        return true;
      } catch (error) {
        console.error(`❌ Failed to set on node ${node.id}:`, error);
        return false;
      }
    });

    const results = await Promise.allSettled(promises);
    return results.some(result => result.status === 'fulfilled' && result.value);
  }

  async get(key: string): Promise<any> {
    const targetNodes = this.getNodes(key);
    
    for (const node of targetNodes) {
      const client = this.redisClients.get(node.id);
      try {
        // const value = await client.get(key);
        // return value ? JSON.parse(value) : null;
        console.log(`📖 Get ${key} from Redis node ${node.id}`);
        return null; // Simulated
      } catch (error) {
        console.error(`❌ Failed to get from node ${node.id}:`, error);
      }
    }
    
    return null;
  }

  async delete(key: string): Promise<boolean> {
    const targetNodes = this.getNodes(key);
    
    const promises = targetNodes.map(async (node) => {
      const client = this.redisClients.get(node.id);
      try {
        // const result = await client.del(key);
        console.log(`🗑️ Delete ${key} from Redis node ${node.id}`);
        return true;
      } catch (error) {
        console.error(`❌ Failed to delete from node ${node.id}:`, error);
        return false;
      }
    });

    const results = await Promise.allSettled(promises);
    return results.some(result => result.status === 'fulfilled' && result.value);
  }

  async invalidate(pattern: string): Promise<number> {
    let totalInvalidated = 0;
    
    const promises = Array.from(this.nodes.values()).map(async (node) => {
      const client = this.redisClients.get(node.id);
      try {
        // const keys = await client.keys(pattern);
        // const deleted = await client.del(...keys);
        console.log(`🧹 Invalidate pattern ${pattern} on Redis node ${node.id}`);
        return 0; // Simulated
      } catch (error) {
        console.error(`❌ Failed to invalidate on node ${node.id}:`, error);
        return 0;
      }
    });

    const results = await Promise.allSettled(promises);
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        totalInvalidated += result.value;
      }
    });

    return totalInvalidated;
  }

  protected async replicate(operation: CacheOperation): Promise<void> {
    // Redis Cluster handles replication internally
    console.log(`🔄 Redis Cluster replication for ${operation.type} ${operation.key}`);
  }
}

export class CacheManager {
  private cache: DistributedCache;
  private metricsCollector: CacheMetricsCollector;

  constructor(type: 'consistent-hash' | 'redis-cluster', config: DistributedCacheConfig) {
    switch (type) {
      case 'consistent-hash':
        this.cache = new ConsistentHashCache(config);
        break;
      case 'redis-cluster':
        this.cache = new RedisClusterCache(config);
        break;
      default:
        throw new Error(`Unsupported cache type: ${type}`);
    }
    
    this.metricsCollector = new CacheMetricsCollector();
  }

  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    const startTime = Date.now();
    try {
      const result = await this.cache.set(key, value, ttl);
      this.metricsCollector.recordOperation('set', Date.now() - startTime, true);
      return result;
    } catch (error) {
      this.metricsCollector.recordOperation('set', Date.now() - startTime, false);
      throw error;
    }
  }

  async get(key: string): Promise<any> {
    const startTime = Date.now();
    try {
      const result = await this.cache.get(key);
      this.metricsCollector.recordOperation('get', Date.now() - startTime, result !== null);
      return result;
    } catch (error) {
      this.metricsCollector.recordOperation('get', Date.now() - startTime, false);
      throw error;
    }
  }

  async delete(key: string): Promise<boolean> {
    const startTime = Date.now();
    try {
      const result = await this.cache.delete(key);
      this.metricsCollector.recordOperation('delete', Date.now() - startTime, true);
      return result;
    } catch (error) {
      this.metricsCollector.recordOperation('delete', Date.now() - startTime, false);
      throw error;
    }
  }

  async invalidate(pattern: string): Promise<number> {
    const startTime = Date.now();
    try {
      const result = await this.cache.invalidate(pattern);
      this.metricsCollector.recordOperation('invalidate', Date.now() - startTime, true);
      return result;
    } catch (error) {
      this.metricsCollector.recordOperation('invalidate', Date.now() - startTime, false);
      throw error;
    }
  }

  getMetrics(): any {
    return this.metricsCollector.getMetrics();
  }
}

export class CacheMetricsCollector {
  private metrics = {
    operations: {
      set: { count: 0, totalTime: 0, errors: 0 },
      get: { count: 0, totalTime: 0, errors: 0, hits: 0, misses: 0 },
      delete: { count: 0, totalTime: 0, errors: 0 },
      invalidate: { count: 0, totalTime: 0, errors: 0 },
    },
    hitRate: 0,
    avgResponseTime: 0,
  };

  recordOperation(operation: string, duration: number, success: boolean): void {
    const opMetrics = this.metrics.operations[operation as keyof typeof this.metrics.operations];
    
    if (opMetrics) {
      opMetrics.count++;
      opMetrics.totalTime += duration;
      
      if (!success) {
        opMetrics.errors++;
      }
      
      if (operation === 'get') {
        if (success) {
          (opMetrics as any).hits++;
        } else {
          (opMetrics as any).misses++;
        }
      }
    }
    
    this.updateAggregateMetrics();
  }

  private updateAggregateMetrics(): void {
    const getOp = this.metrics.operations.get;
    this.metrics.hitRate = getOp.count > 0 ? getOp.hits / getOp.count : 0;
    
    const totalOps = Object.values(this.metrics.operations).reduce((sum, op) => sum + op.count, 0);
    const totalTime = Object.values(this.metrics.operations).reduce((sum, op) => sum + op.totalTime, 0);
    this.metrics.avgResponseTime = totalOps > 0 ? totalTime / totalOps : 0;
  }

  getMetrics(): any {
    return { ...this.metrics };
  }
}
