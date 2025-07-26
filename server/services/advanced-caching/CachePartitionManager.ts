import { EventEmitter } from 'events';
import { MultiLevelCacheManager } from './MultiLevelCacheManager';

export interface CachePartition {
  id: string;
  name: string;
  keyPattern?: string | RegExp;
  keyPrefix?: string;
  size: number;
  maxSize: number;
  ttl: number;
  priority: number;
  isolation: 'strict' | 'soft' | 'none';
  evictionPolicy: 'lru' | 'lfu' | 'fifo' | 'ttl' | 'priority';
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  replicationFactor: number;
  metadata: {
    description?: string;
    owner?: string;
    tags?: string[];
    environment?: 'dev' | 'staging' | 'prod';
    businessCriticality?: 'low' | 'medium' | 'high' | 'critical';
    dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted';
  };
  stats: PartitionStats;
  createdAt: Date;
  lastAccessed?: Date;
}

export interface PartitionStats {
  hits: number;
  misses: number;
  hitRate: number;
  keyCount: number;
  memoryUsage: number;
  avgLatency: number;
  evictions: number;
  lastEviction?: Date;
  topKeys: Array<{ key: string; accessCount: number; lastAccessed: Date }>;
}

export interface PartitioningStrategy {
  name: string;
  type: 'hash' | 'range' | 'directory' | 'pattern' | 'business_logic';
  config: {
    partitionCount?: number;
    hashFunction?: 'md5' | 'sha1' | 'crc32' | 'murmur3';
    rangeKey?: string;
    ranges?: Array<{ min: any; max: any; partition: string }>;
    patterns?: Array<{ pattern: string | RegExp; partition: string }>;
    businessLogic?: (key: string, value: any) => string;
  };
}

export interface PartitioningRule {
  id: string;
  name: string;
  condition: {
    type: 'key_pattern' | 'value_type' | 'data_size' | 'access_frequency' | 'custom';
    pattern?: string | RegExp;
    valueType?: string;
    sizeThreshold?: number;
    accessThreshold?: number;
    customFunction?: (key: string, value: any) => boolean;
  };
  action: {
    partitionId: string;
    priority?: number;
    ttlOverride?: number;
  };
  enabled: boolean;
  priority: number;
}

export interface PartitionRebalanceConfig {
  enabled: boolean;
  threshold: number; // Percentage difference to trigger rebalance
  minInterval: number; // Minimum time between rebalances (ms)
  maxMigrationRate: number; // Keys per second
  preserveOrder: boolean;
}

export interface MigrationJob {
  id: string;
  fromPartition: string;
  toPartition: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  totalKeys: number;
  migratedKeys: number;
  failedKeys: number;
  startTime?: Date;
  endTime?: Date;
  estimatedCompletion?: Date;
  errors: Array<{ key: string; error: string }>;
}

export class CachePartitionManager extends EventEmitter {
  private cacheManager: MultiLevelCacheManager;
  private partitions: Map<string, CachePartition> = new Map();
  private partitioningRules: Map<string, PartitioningRule> = new Map();
  private keyToPartition: Map<string, string> = new Map();
  private migrationJobs: Map<string, MigrationJob> = new Map();
  private rebalanceConfig: PartitionRebalanceConfig;
  private lastRebalance = 0;

  constructor(cacheManager: MultiLevelCacheManager) {
    super();
    this.cacheManager = cacheManager;
    
    this.rebalanceConfig = {
      enabled: true,
      threshold: 20, // 20% difference
      minInterval: 300000, // 5 minutes
      maxMigrationRate: 100, // 100 keys/second
      preserveOrder: false,
    };

    this.setupDefaultPartitions();
    this.setupEventListeners();
    this.startPeriodicTasks();
  }

  private setupDefaultPartitions(): void {
    // Default user data partition
    this.createPartition({
      id: 'user_data',
      name: 'User Data',
      keyPattern: /^user:/,
      maxSize: 10000,
      ttl: 3600,
      priority: 5,
      isolation: 'soft',
      evictionPolicy: 'lru',
      compressionEnabled: true,
      encryptionEnabled: false,
      replicationFactor: 2,
      metadata: {
        description: 'User-specific cached data',
        businessCriticality: 'high',
        dataClassification: 'internal',
      },
    });

    // Session data partition
    this.createPartition({
      id: 'session_data',
      name: 'Session Data',
      keyPattern: /^session:/,
      maxSize: 5000,
      ttl: 1800,
      priority: 8,
      isolation: 'strict',
      evictionPolicy: 'ttl',
      compressionEnabled: false,
      encryptionEnabled: true,
      replicationFactor: 3,
      metadata: {
        description: 'User session information',
        businessCriticality: 'critical',
        dataClassification: 'confidential',
      },
    });

    // Analytics data partition
    this.createPartition({
      id: 'analytics',
      name: 'Analytics Data',
      keyPattern: /^analytics:/,
      maxSize: 20000,
      ttl: 86400,
      priority: 3,
      isolation: 'none',
      evictionPolicy: 'lfu',
      compressionEnabled: true,
      encryptionEnabled: false,
      replicationFactor: 1,
      metadata: {
        description: 'Analytics and reporting data',
        businessCriticality: 'medium',
        dataClassification: 'internal',
      },
    });

    // Temporary data partition
    this.createPartition({
      id: 'temp_data',
      name: 'Temporary Data',
      keyPattern: /^temp:/,
      maxSize: 1000,
      ttl: 300,
      priority: 1,
      isolation: 'none',
      evictionPolicy: 'fifo',
      compressionEnabled: false,
      encryptionEnabled: false,
      replicationFactor: 1,
      metadata: {
        description: 'Short-lived temporary data',
        businessCriticality: 'low',
        dataClassification: 'public',
      },
    });
  }

  private setupEventListeners(): void {
    this.cacheManager.on('cache-get', (event) => {
      this.updatePartitionStats(event.key, 'get', event.hit, event.latency);
    });

    this.cacheManager.on('cache-set', (event) => {
      this.updatePartitionStats(event.key, 'set', true, event.latency);
    });

    this.cacheManager.on('cache-delete', (event) => {
      this.updatePartitionStats(event.key, 'delete', true, event.latency);
      this.keyToPartition.delete(event.key);
    });

    this.cacheManager.on('cache-expired', (event) => {
      this.updatePartitionStats(event.key, 'expire', false, 0);
      this.keyToPartition.delete(event.key);
    });
  }

  private startPeriodicTasks(): void {
    // Periodic rebalancing check
    setInterval(() => {
      if (this.rebalanceConfig.enabled) {
        this.checkRebalanceNeeded();
      }
    }, 60000); // Check every minute

    // Periodic stats update
    setInterval(() => {
      this.updateAllPartitionStats();
    }, 30000); // Update every 30 seconds

    // Cleanup completed migration jobs
    setInterval(() => {
      this.cleanupMigrationJobs();
    }, 300000); // Cleanup every 5 minutes
  }

  createPartition(config: Omit<CachePartition, 'size' | 'stats' | 'createdAt'>): string {
    const partition: CachePartition = {
      ...config,
      size: 0,
      stats: {
        hits: 0,
        misses: 0,
        hitRate: 0,
        keyCount: 0,
        memoryUsage: 0,
        avgLatency: 0,
        evictions: 0,
        topKeys: [],
      },
      createdAt: new Date(),
    };

    this.partitions.set(config.id, partition);
    this.emit('partition-created', partition);
    
    return config.id;
  }

  updatePartition(partitionId: string, updates: Partial<CachePartition>): boolean {
    const partition = this.partitions.get(partitionId);
    if (!partition) return false;

    const updatedPartition = { ...partition, ...updates };
    this.partitions.set(partitionId, updatedPartition);
    
    this.emit('partition-updated', updatedPartition);
    return true;
  }

  deletePartition(partitionId: string, migrateData = true): Promise<boolean> {
    const partition = this.partitions.get(partitionId);
    if (!partition) return Promise.resolve(false);

    return new Promise(async (resolve) => {
      try {
        if (migrateData && partition.size > 0) {
          // Find alternative partition for migration
          const targetPartition = this.findBestMigrationTarget(partitionId);
          if (targetPartition) {
            await this.migratePartition(partitionId, targetPartition);
          }
        }

        // Remove all keys from the partition
        const keysToRemove = Array.from(this.keyToPartition.entries())
          .filter(([, pid]) => pid === partitionId)
          .map(([key]) => key);

        for (const key of keysToRemove) {
          await this.cacheManager.delete(key);
          this.keyToPartition.delete(key);
        }

        this.partitions.delete(partitionId);
        this.emit('partition-deleted', partitionId);
        resolve(true);

      } catch (error) {
        this.emit('partition-deletion-error', { partitionId, error });
        resolve(false);
      }
    });
  }

  private findBestMigrationTarget(sourcePartitionId: string): string | null {
    const sourcePartition = this.partitions.get(sourcePartitionId);
    if (!sourcePartition) return null;

    // Find partitions with similar characteristics and available space
    let bestTarget: string | null = null;
    let bestScore = 0;

    for (const [partitionId, partition] of this.partitions) {
      if (partitionId === sourcePartitionId) continue;

      const availableSpace = partition.maxSize - partition.size;
      if (availableSpace < sourcePartition.size) continue;

      // Score based on similarity
      let score = 0;
      
      // Priority similarity
      score += Math.max(0, 10 - Math.abs(partition.priority - sourcePartition.priority));
      
      // TTL similarity
      const ttlDiff = Math.abs(partition.ttl - sourcePartition.ttl) / Math.max(partition.ttl, sourcePartition.ttl);
      score += Math.max(0, 10 - ttlDiff * 10);
      
      // Business criticality similarity
      if (partition.metadata.businessCriticality === sourcePartition.metadata.businessCriticality) {
        score += 5;
      }

      if (score > bestScore) {
        bestScore = score;
        bestTarget = partitionId;
      }
    }

    return bestTarget;
  }

  addPartitioningRule(rule: Omit<PartitioningRule, 'id'>): string {
    const id = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullRule: PartitioningRule = { id, ...rule };
    
    this.partitioningRules.set(id, fullRule);
    this.emit('partitioning-rule-added', fullRule);
    
    return id;
  }

  removePartitioningRule(ruleId: string): boolean {
    const removed = this.partitioningRules.delete(ruleId);
    if (removed) {
      this.emit('partitioning-rule-removed', ruleId);
    }
    return removed;
  }

  determinePartition(key: string, value?: any): string {
    // Check if key is already assigned to a partition
    const existingPartition = this.keyToPartition.get(key);
    if (existingPartition && this.partitions.has(existingPartition)) {
      return existingPartition;
    }

    // Apply partitioning rules in priority order
    const rules = Array.from(this.partitioningRules.values())
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of rules) {
      if (this.evaluateRule(rule, key, value)) {
        const partitionId = rule.action.partitionId;
        if (this.partitions.has(partitionId)) {
          this.keyToPartition.set(key, partitionId);
          return partitionId;
        }
      }
    }

    // Fall back to pattern matching
    for (const [partitionId, partition] of this.partitions) {
      if (this.matchesPartitionPattern(key, partition)) {
        this.keyToPartition.set(key, partitionId);
        return partitionId;
      }
    }

    // Default to first available partition
    const defaultPartition = this.partitions.keys().next().value;
    if (defaultPartition) {
      this.keyToPartition.set(key, defaultPartition);
      return defaultPartition;
    }

    throw new Error('No partitions available');
  }

  private evaluateRule(rule: PartitioningRule, key: string, value?: any): boolean {
    const { condition } = rule;

    switch (condition.type) {
      case 'key_pattern':
        if (condition.pattern) {
          if (typeof condition.pattern === 'string') {
            return key.includes(condition.pattern);
          } else {
            return condition.pattern.test(key);
          }
        }
        break;

      case 'value_type':
        if (condition.valueType && value !== undefined) {
          return typeof value === condition.valueType;
        }
        break;

      case 'data_size':
        if (condition.sizeThreshold && value !== undefined) {
          const size = JSON.stringify(value).length;
          return size >= condition.sizeThreshold;
        }
        break;

      case 'access_frequency':
        if (condition.accessThreshold) {
          const partition = this.keyToPartition.get(key);
          if (partition) {
            const partitionData = this.partitions.get(partition);
            const keyStats = partitionData?.stats.topKeys.find(k => k.key === key);
            return keyStats ? keyStats.accessCount >= condition.accessThreshold : false;
          }
        }
        break;

      case 'custom':
        if (condition.customFunction) {
          return condition.customFunction(key, value);
        }
        break;
    }

    return false;
  }

  private matchesPartitionPattern(key: string, partition: CachePartition): boolean {
    if (partition.keyPrefix && key.startsWith(partition.keyPrefix)) {
      return true;
    }

    if (partition.keyPattern) {
      if (typeof partition.keyPattern === 'string') {
        return key.includes(partition.keyPattern);
      } else {
        return partition.keyPattern.test(key);
      }
    }

    return false;
  }

  async get<T = any>(key: string): Promise<T | null> {
    const partitionId = this.determinePartition(key);
    const partition = this.partitions.get(partitionId);
    
    if (!partition) {
      throw new Error(`Partition ${partitionId} not found`);
    }

    // Check partition capacity and isolation
    if (partition.isolation === 'strict' && partition.size >= partition.maxSize) {
      this.emit('partition-capacity-exceeded', { partitionId, key });
      return null;
    }

    const result = await this.cacheManager.get<T>(key);
    
    if (result !== null) {
      partition.lastAccessed = new Date();
      this.partitions.set(partitionId, partition);
    }

    return result;
  }

  async set<T = any>(key: string, value: T, options?: any): Promise<void> {
    const partitionId = this.determinePartition(key, value);
    const partition = this.partitions.get(partitionId);
    
    if (!partition) {
      throw new Error(`Partition ${partitionId} not found`);
    }

    // Check partition capacity
    if (partition.size >= partition.maxSize) {
      if (partition.isolation === 'strict') {
        throw new Error(`Partition ${partitionId} is at capacity`);
      } else {
        // Try to evict keys based on eviction policy
        await this.evictFromPartition(partitionId, 1);
      }
    }

    // Apply partition-specific options
    const partitionOptions = {
      ...options,
      ttl: options?.ttl || partition.ttl,
      compression: partition.compressionEnabled,
      // Add encryption if needed
    };

    await this.cacheManager.set(key, value, partitionOptions);

    // Update partition size
    if (!this.keyToPartition.has(key)) {
      partition.size++;
      this.partitions.set(partitionId, partition);
    }

    partition.lastAccessed = new Date();
    this.keyToPartition.set(key, partitionId);
  }

  async delete(key: string): Promise<boolean> {
    const partitionId = this.keyToPartition.get(key);
    if (!partitionId) {
      return await this.cacheManager.delete(key);
    }

    const result = await this.cacheManager.delete(key);
    
    if (result) {
      const partition = this.partitions.get(partitionId);
      if (partition) {
        partition.size = Math.max(0, partition.size - 1);
        this.partitions.set(partitionId, partition);
      }
      this.keyToPartition.delete(key);
    }

    return result;
  }

  private async evictFromPartition(partitionId: string, count: number): Promise<number> {
    const partition = this.partitions.get(partitionId);
    if (!partition) return 0;

    const keysInPartition = Array.from(this.keyToPartition.entries())
      .filter(([, pid]) => pid === partitionId)
      .map(([key]) => key);

    if (keysInPartition.length === 0) return 0;

    let keysToEvict: string[] = [];

    switch (partition.evictionPolicy) {
      case 'lru':
        // Would need to track last access times
        keysToEvict = keysInPartition.slice(0, count);
        break;
      
      case 'lfu':
        // Would need to track access frequencies
        keysToEvict = keysInPartition.slice(0, count);
        break;
      
      case 'fifo':
        keysToEvict = keysInPartition.slice(0, count);
        break;
      
      case 'ttl':
        // Evict keys with shortest TTL first
        keysToEvict = keysInPartition.slice(0, count);
        break;
      
      case 'priority':
        // Would need priority information per key
        keysToEvict = keysInPartition.slice(0, count);
        break;
    }

    let evictedCount = 0;
    for (const key of keysToEvict) {
      const deleted = await this.delete(key);
      if (deleted) {
        evictedCount++;
        partition.stats.evictions++;
        partition.stats.lastEviction = new Date();
      }
    }

    this.partitions.set(partitionId, partition);
    this.emit('keys-evicted', { partitionId, count: evictedCount });

    return evictedCount;
  }

  private updatePartitionStats(key: string, operation: string, hit: boolean, latency = 0): void {
    const partitionId = this.keyToPartition.get(key);
    if (!partitionId) return;

    const partition = this.partitions.get(partitionId);
    if (!partition) return;

    const stats = partition.stats;

    switch (operation) {
      case 'get':
        if (hit) {
          stats.hits++;
        } else {
          stats.misses++;
        }
        stats.hitRate = stats.hits / (stats.hits + stats.misses) * 100;
        break;
    }

    // Update average latency
    if (latency > 0) {
      const totalOperations = stats.hits + stats.misses;
      stats.avgLatency = (stats.avgLatency * (totalOperations - 1) + latency) / totalOperations;
    }

    // Update top keys tracking
    let keyEntry = stats.topKeys.find(k => k.key === key);
    if (!keyEntry) {
      keyEntry = { key, accessCount: 0, lastAccessed: new Date() };
      stats.topKeys.push(keyEntry);
    }
    keyEntry.accessCount++;
    keyEntry.lastAccessed = new Date();

    // Keep only top 100 keys
    stats.topKeys.sort((a, b) => b.accessCount - a.accessCount);
    stats.topKeys = stats.topKeys.slice(0, 100);

    this.partitions.set(partitionId, partition);
  }

  private updateAllPartitionStats(): void {
    for (const [partitionId, partition] of this.partitions) {
      // Update key count
      const keysInPartition = Array.from(this.keyToPartition.entries())
        .filter(([, pid]) => pid === partitionId).length;
      
      partition.stats.keyCount = keysInPartition;
      partition.size = keysInPartition;
      
      // Estimate memory usage (simplified)
      partition.stats.memoryUsage = keysInPartition * 1024; // Rough estimate
      
      this.partitions.set(partitionId, partition);
    }
  }

  async migratePartition(fromPartitionId: string, toPartitionId: string): Promise<string> {
    const fromPartition = this.partitions.get(fromPartitionId);
    const toPartition = this.partitions.get(toPartitionId);

    if (!fromPartition || !toPartition) {
      throw new Error('Source or target partition not found');
    }

    const jobId = `migration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const keysToMigrate = Array.from(this.keyToPartition.entries())
      .filter(([, pid]) => pid === fromPartitionId)
      .map(([key]) => key);

    const job: MigrationJob = {
      id: jobId,
      fromPartition: fromPartitionId,
      toPartition: toPartitionId,
      status: 'pending',
      totalKeys: keysToMigrate.length,
      migratedKeys: 0,
      failedKeys: 0,
      errors: [],
    };

    this.migrationJobs.set(jobId, job);
    this.emit('migration-started', job);

    // Start migration in background
    this.performMigration(job, keysToMigrate);

    return jobId;
  }

  private async performMigration(job: MigrationJob, keys: string[]): Promise<void> {
    job.status = 'running';
    job.startTime = new Date();
    this.migrationJobs.set(job.id, job);

    const batchSize = Math.min(10, Math.ceil(this.rebalanceConfig.maxMigrationRate / 10));
    
    try {
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        
        for (const key of batch) {
          try {
            // Get the value
            const value = await this.cacheManager.get(key);
            if (value !== null) {
              // Update partition mapping
              this.keyToPartition.set(key, job.toPartition);
              job.migratedKeys++;
            }
          } catch (error) {
            job.failedKeys++;
            job.errors.push({ key, error: error.message });
          }
        }

        job.migratedKeys = Math.min(job.migratedKeys, job.totalKeys);
        
        // Estimate completion
        const rate = job.migratedKeys / (Date.now() - job.startTime!.getTime());
        const remaining = job.totalKeys - job.migratedKeys;
        job.estimatedCompletion = new Date(Date.now() + (remaining / rate));
        
        this.migrationJobs.set(job.id, job);
        this.emit('migration-progress', job);

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000 / this.rebalanceConfig.maxMigrationRate * batchSize));
      }

      job.status = 'completed';
      job.endTime = new Date();
      this.migrationJobs.set(job.id, job);
      this.emit('migration-completed', job);

    } catch (error) {
      job.status = 'failed';
      job.endTime = new Date();
      this.migrationJobs.set(job.id, job);
      this.emit('migration-failed', { job, error });
    }
  }

  private checkRebalanceNeeded(): void {
    const now = Date.now();
    if (now - this.lastRebalance < this.rebalanceConfig.minInterval) {
      return;
    }

    const partitionSizes = Array.from(this.partitions.values()).map(p => p.size);
    const averageSize = partitionSizes.reduce((sum, size) => sum + size, 0) / partitionSizes.length;
    
    const maxDeviation = Math.max(...partitionSizes.map(size => Math.abs(size - averageSize)));
    const deviationPercentage = averageSize > 0 ? (maxDeviation / averageSize) * 100 : 0;

    if (deviationPercentage > this.rebalanceConfig.threshold) {
      this.emit('rebalance-needed', { deviationPercentage, threshold: this.rebalanceConfig.threshold });
      this.performRebalance();
    }
  }

  private async performRebalance(): Promise<void> {
    this.lastRebalance = Date.now();
    this.emit('rebalance-started');

    try {
      // Find the most unbalanced partitions
      const partitions = Array.from(this.partitions.entries())
        .map(([id, partition]) => ({ id, size: partition.size, maxSize: partition.maxSize }))
        .sort((a, b) => b.size - a.size);

      const overloaded = partitions.filter(p => p.size > p.maxSize * 0.8);
      const underloaded = partitions.filter(p => p.size < p.maxSize * 0.5);

      for (const overloadedPartition of overloaded) {
        for (const underloadedPartition of underloaded) {
          if (overloadedPartition.size <= underloadedPartition.maxSize * 0.8) break;

          const keysToMove = Math.min(
            Math.floor((overloadedPartition.size - underloadedPartition.size) / 2),
            underloadedPartition.maxSize - underloadedPartition.size
          );

          if (keysToMove > 0) {
            await this.migratePartition(overloadedPartition.id, underloadedPartition.id);
          }
        }
      }

      this.emit('rebalance-completed');

    } catch (error) {
      this.emit('rebalance-failed', error);
    }
  }

  private cleanupMigrationJobs(): void {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours

    for (const [jobId, job] of this.migrationJobs) {
      if (job.endTime && job.endTime.getTime() < cutoff) {
        this.migrationJobs.delete(jobId);
      }
    }
  }

  // Public API methods
  getPartitions(): CachePartition[] {
    return Array.from(this.partitions.values());
  }

  getPartition(partitionId: string): CachePartition | null {
    return this.partitions.get(partitionId) || null;
  }

  getPartitioningRules(): PartitioningRule[] {
    return Array.from(this.partitioningRules.values());
  }

  getMigrationJobs(): MigrationJob[] {
    return Array.from(this.migrationJobs.values());
  }

  getMigrationJob(jobId: string): MigrationJob | null {
    return this.migrationJobs.get(jobId) || null;
  }

  cancelMigration(jobId: string): boolean {
    const job = this.migrationJobs.get(jobId);
    if (!job || job.status !== 'running') return false;

    job.status = 'cancelled';
    job.endTime = new Date();
    this.migrationJobs.set(jobId, job);
    
    this.emit('migration-cancelled', job);
    return true;
  }

  getRebalanceConfig(): PartitionRebalanceConfig {
    return { ...this.rebalanceConfig };
  }

  updateRebalanceConfig(config: Partial<PartitionRebalanceConfig>): void {
    this.rebalanceConfig = { ...this.rebalanceConfig, ...config };
    this.emit('rebalance-config-updated', this.rebalanceConfig);
  }

  getPartitionStats(): Map<string, PartitionStats> {
    const stats = new Map<string, PartitionStats>();
    for (const [id, partition] of this.partitions) {
      stats.set(id, { ...partition.stats });
    }
    return stats;
  }

  async clearPartition(partitionId: string): Promise<boolean> {
    const partition = this.partitions.get(partitionId);
    if (!partition) return false;

    const keysToDelete = Array.from(this.keyToPartition.entries())
      .filter(([, pid]) => pid === partitionId)
      .map(([key]) => key);

    for (const key of keysToDelete) {
      await this.delete(key);
    }

    // Reset partition stats
    partition.size = 0;
    partition.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      keyCount: 0,
      memoryUsage: 0,
      avgLatency: 0,
      evictions: 0,
      topKeys: [],
    };

    this.partitions.set(partitionId, partition);
    this.emit('partition-cleared', partitionId);

    return true;
  }

  async shutdown(): Promise<void> {
    // Cancel all running migrations
    for (const [jobId, job] of this.migrationJobs) {
      if (job.status === 'running') {
        this.cancelMigration(jobId);
      }
    }

    this.emit('shutdown');
  }
}
