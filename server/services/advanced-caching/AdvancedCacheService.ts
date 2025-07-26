import { EventEmitter } from 'events';
import { RedisClusterManager, RedisClusterConfig } from './RedisClusterManager';
import { MultiLevelCacheManager } from './MultiLevelCacheManager';
import { CacheInvalidationManager } from './CacheInvalidationManager';
import { DistributedCacheManager } from './DistributedCacheManager';
import { CacheWarmingManager } from './CacheWarmingManager';
import { CacheAnalyticsService } from './CacheAnalyticsService';
import { CacheCompressionManager } from './CacheCompressionManager';
import { CachePartitionManager } from './CachePartitionManager';
import { CacheBackupManager } from './CacheBackupManager';
import { CachePerformanceOptimizer } from './CachePerformanceOptimizer';

export interface AdvancedCacheConfig {
  redis: {
    enabled: boolean;
    cluster: RedisClusterConfig;
  };
  multiLevel: {
    enabled: boolean;
    l1Size: number;
    l2Size: number;
    l1TTL: number;
    l2TTL: number;
    l3TTL: number;
  };
  compression: {
    enabled: boolean;
    defaultAlgorithm: string;
    threshold: number;
    adaptive: boolean;
  };
  partitioning: {
    enabled: boolean;
    strategy: 'hash' | 'pattern' | 'business_logic';
    rebalancing: boolean;
  };
  warming: {
    enabled: boolean;
    predictive: boolean;
    scheduled: boolean;
  };
  backup: {
    enabled: boolean;
    directory: string;
    schedule: string;
    retention: number;
  };
  analytics: {
    enabled: boolean;
    retentionDays: number;
    alerting: boolean;
  };
  optimization: {
    enabled: boolean;
    adaptive: boolean;
    aggressiveness: 'conservative' | 'moderate' | 'aggressive';
  };
}

export interface CacheOperationOptions {
  ttl?: number;
  level?: 'L1' | 'L2' | 'L3' | 'all';
  compression?: boolean;
  partition?: string;
  tags?: string[];
  dependencies?: string[];
  skipIfExists?: boolean;
}

export interface ServiceHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    redis: 'healthy' | 'degraded' | 'unhealthy';
    multiLevel: 'healthy' | 'degraded' | 'unhealthy';
    compression: 'healthy' | 'degraded' | 'unhealthy';
    partitioning: 'healthy' | 'degraded' | 'unhealthy';
    warming: 'healthy' | 'degraded' | 'unhealthy';
    backup: 'healthy' | 'degraded' | 'unhealthy';
    analytics: 'healthy' | 'degraded' | 'unhealthy';
    optimization: 'healthy' | 'degraded' | 'unhealthy';
  };
  metrics: {
    hitRate: number;
    averageLatency: number;
    memoryUsage: number;
    operationsPerSecond: number;
    errorRate: number;
  };
  alerts: number;
  lastHealthCheck: Date;
}

export class AdvancedCacheService extends EventEmitter {
  private config: AdvancedCacheConfig;
  private redisCluster?: RedisClusterManager;
  private multiLevelCache?: MultiLevelCacheManager;
  private invalidationManager?: CacheInvalidationManager;
  private distributedCache?: DistributedCacheManager;
  private warmingManager?: CacheWarmingManager;
  private analyticsService?: CacheAnalyticsService;
  private compressionManager?: CacheCompressionManager;
  private partitionManager?: CachePartitionManager;
  private backupManager?: CacheBackupManager;
  private performanceOptimizer?: CachePerformanceOptimizer;
  
  private isInitialized = false;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(config: AdvancedCacheConfig) {
    super();
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('AdvancedCacheService is already initialized');
    }

    this.emit('initialization-started');

    try {
      // Initialize Redis Cluster if enabled
      if (this.config.redis.enabled) {
        this.redisCluster = new RedisClusterManager(this.config.redis.cluster);
        await this.redisCluster.initialize();
        this.emit('redis-initialized');
      }

      // Initialize Multi-Level Cache Manager
      if (this.config.multiLevel.enabled) {
        this.multiLevelCache = new MultiLevelCacheManager(this.redisCluster);
        this.emit('multi-level-cache-initialized');
      }

      // Initialize Compression Manager
      if (this.config.compression.enabled) {
        this.compressionManager = new CacheCompressionManager();
        if (this.config.compression.adaptive) {
          this.compressionManager.updateAdaptiveSettings({ enabled: true });
        }
        this.emit('compression-initialized');
      }

      // Initialize Cache Invalidation Manager
      if (this.multiLevelCache) {
        this.invalidationManager = new CacheInvalidationManager(
          this.multiLevelCache,
          this.redisCluster
        );
        this.emit('invalidation-initialized');
      }

      // Initialize Distributed Cache Manager
      if (this.redisCluster) {
        this.distributedCache = new DistributedCacheManager(
          {
            virtualNodeCount: 150,
            replicationFactor: 2,
            hashAlgorithm: 'sha256',
            loadBalancing: 'consistent_hash',
            failoverEnabled: true,
            healthCheckInterval: 30000,
            nodeTimeout: 5000,
          },
          this.redisCluster
        );
        this.emit('distributed-cache-initialized');
      }

      // Initialize Partition Manager
      if (this.config.partitioning.enabled && this.multiLevelCache) {
        this.partitionManager = new CachePartitionManager(this.multiLevelCache);
        this.emit('partitioning-initialized');
      }

      // Initialize Cache Warming Manager
      if (this.config.warming.enabled && this.multiLevelCache) {
        this.warmingManager = new CacheWarmingManager(this.multiLevelCache);
        this.emit('warming-initialized');
      }

      // Initialize Analytics Service
      if (this.config.analytics.enabled && this.multiLevelCache) {
        this.analyticsService = new CacheAnalyticsService(
          this.multiLevelCache,
          this.redisCluster,
          this.invalidationManager,
          this.warmingManager
        );
        this.emit('analytics-initialized');
      }

      // Initialize Backup Manager
      if (this.config.backup.enabled && this.multiLevelCache) {
        this.backupManager = new CacheBackupManager(
          this.multiLevelCache,
          this.config.backup.directory,
          this.redisCluster
        );
        this.emit('backup-initialized');
      }

      // Initialize Performance Optimizer
      if (this.config.optimization.enabled && this.multiLevelCache && this.analyticsService) {
        this.performanceOptimizer = new CachePerformanceOptimizer(
          this.multiLevelCache,
          this.analyticsService,
          this.partitionManager,
          this.warmingManager,
          this.compressionManager
        );
        
        this.performanceOptimizer.updateAdaptiveConfig({
          enabled: this.config.optimization.adaptive,
          aggressiveness: this.config.optimization.aggressiveness,
        });
        
        this.emit('optimization-initialized');
      }

      // Set up cross-service event listeners
      this.setupEventListeners();

      // Start health monitoring
      this.startHealthMonitoring();

      this.isInitialized = true;
      this.emit('initialization-completed');

    } catch (error) {
      this.emit('initialization-failed', error);
      throw error;
    }
  }

  private setupEventListeners(): void {
    // Forward important events from sub-services
    if (this.redisCluster) {
      this.redisCluster.on('cluster-unhealthy', (health) => {
        this.emit('redis-cluster-unhealthy', health);
      });
      
      this.redisCluster.on('node-failed', (nodeId) => {
        this.emit('redis-node-failed', nodeId);
      });
    }

    if (this.analyticsService) {
      this.analyticsService.on('alert-created', (alert) => {
        this.emit('performance-alert', alert);
      });
      
      this.analyticsService.on('anomaly-detected', (anomaly) => {
        this.emit('performance-anomaly', anomaly);
      });
    }

    if (this.performanceOptimizer) {
      this.performanceOptimizer.on('optimization-completed', (job) => {
        this.emit('optimization-completed', job);
      });
      
      this.performanceOptimizer.on('optimization-approval-required', (data) => {
        this.emit('optimization-approval-required', data);
      });
    }

    if (this.backupManager) {
      this.backupManager.on('backup-completed', (job) => {
        this.emit('backup-completed', job);
      });
      
      this.backupManager.on('backup-failed', (data) => {
        this.emit('backup-failed', data);
      });
    }

    if (this.warmingManager) {
      this.warmingManager.on('job-completed', (job) => {
        this.emit('warming-completed', job);
      });
    }
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      const health = await this.getHealth();
      this.emit('health-check', health);

      if (health.overall === 'unhealthy') {
        this.emit('service-unhealthy', health);
      }
    }, 60000); // Check every minute
  }

  // Primary Cache Operations
  async get<T = any>(key: string, options?: CacheOperationOptions): Promise<T | null> {
    this.ensureInitialized();

    try {
      // Use partition manager if available and partition specified
      if (this.partitionManager && options?.partition) {
        return await this.partitionManager.get<T>(key);
      }

      // Use multi-level cache if available
      if (this.multiLevelCache) {
        return await this.multiLevelCache.get<T>(key, options);
      }

      // Fallback to distributed cache
      if (this.distributedCache) {
        return await this.distributedCache.get<T>(key);
      }

      return null;
    } catch (error) {
      this.emit('cache-operation-error', { operation: 'get', key, error });
      throw error;
    }
  }

  async set<T = any>(key: string, value: T, options?: CacheOperationOptions): Promise<void> {
    this.ensureInitialized();

    try {
      let processedValue = value;

      // Apply compression if enabled
      if (this.compressionManager && (options?.compression ?? this.config.compression.enabled)) {
        const compressionResult = await this.compressionManager.compress(value, {
          algorithm: this.config.compression.defaultAlgorithm,
          level: 6,
          threshold: this.config.compression.threshold,
        });
        
        if (compressionResult.metadata.algorithm !== 'none') {
          processedValue = {
            __compressed: true,
            __algorithm: compressionResult.metadata.algorithm,
            __data: compressionResult.compressedData.toString('base64'),
          } as any;
        }
      }

      // Add tags and dependencies for invalidation
      if (this.invalidationManager && (options?.tags || options?.dependencies)) {
        this.invalidationManager.addTaggedItem(
          key,
          options.tags || [],
          options.dependencies,
          options.level || 'L1'
        );
      }

      // Use partition manager if available and partition specified
      if (this.partitionManager && options?.partition) {
        await this.partitionManager.set(key, processedValue, options);
        return;
      }

      // Use multi-level cache if available
      if (this.multiLevelCache) {
        await this.multiLevelCache.set(key, processedValue, options);
        return;
      }

      // Fallback to distributed cache
      if (this.distributedCache) {
        await this.distributedCache.set(key, processedValue, options?.ttl);
      }

    } catch (error) {
      this.emit('cache-operation-error', { operation: 'set', key, error });
      throw error;
    }
  }

  async delete(key: string, options?: CacheOperationOptions): Promise<boolean> {
    this.ensureInitialized();

    try {
      // Remove from invalidation tracking
      if (this.invalidationManager) {
        this.invalidationManager.removeTaggedItem(key);
      }

      // Use partition manager if available and partition specified
      if (this.partitionManager && options?.partition) {
        return await this.partitionManager.delete(key);
      }

      // Use multi-level cache if available
      if (this.multiLevelCache) {
        await this.multiLevelCache.delete(key, options);
        return true;
      }

      // Fallback to distributed cache
      if (this.distributedCache) {
        return await this.distributedCache.delete(key);
      }

      return false;
    } catch (error) {
      this.emit('cache-operation-error', { operation: 'delete', key, error });
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    this.ensureInitialized();

    try {
      if (this.distributedCache) {
        return await this.distributedCache.exists(key);
      }

      // For multi-level cache, check if value exists
      if (this.multiLevelCache) {
        const value = await this.multiLevelCache.get(key);
        return value !== null;
      }

      return false;
    } catch (error) {
      this.emit('cache-operation-error', { operation: 'exists', key, error });
      return false;
    }
  }

  // Invalidation Operations
  async invalidateByPattern(pattern: string | RegExp, level?: 'L1' | 'L2' | 'L3' | 'all'): Promise<number> {
    this.ensureInitialized();

    if (!this.invalidationManager) {
      throw new Error('Invalidation manager not available');
    }

    return await this.invalidationManager.invalidateByPattern(pattern, level);
  }

  async invalidateByTag(tag: string, level?: 'L1' | 'L2' | 'L3' | 'all'): Promise<number> {
    this.ensureInitialized();

    if (!this.invalidationManager) {
      throw new Error('Invalidation manager not available');
    }

    return await this.invalidationManager.invalidateByTag(tag, level);
  }

  async invalidateByDependency(dependency: string, level?: 'L1' | 'L2' | 'L3' | 'all'): Promise<number> {
    this.ensureInitialized();

    if (!this.invalidationManager) {
      throw new Error('Invalidation manager not available');
    }

    return await this.invalidationManager.invalidateByDependency(dependency, level);
  }

  // Warming Operations
  async warmCache(keys: string[], level?: 'L1' | 'L2' | 'L3'): Promise<void> {
    this.ensureInitialized();

    if (!this.warmingManager) {
      throw new Error('Warming manager not available');
    }

    await this.warmingManager.warmup(keys, level);
  }

  async predictiveWarming(): Promise<void> {
    this.ensureInitialized();

    if (!this.warmingManager) {
      throw new Error('Warming manager not available');
    }

    await this.warmingManager.predictiveWarming();
  }

  // Analytics Operations
  getCurrentStats() {
    this.ensureInitialized();

    if (!this.analyticsService) {
      throw new Error('Analytics service not available');
    }

    return this.analyticsService.getCurrentStats();
  }

  getMetricsForTimeRange(start: Date, end: Date) {
    this.ensureInitialized();

    if (!this.analyticsService) {
      throw new Error('Analytics service not available');
    }

    return this.analyticsService.getMetricsForTimeRange(start, end);
  }

  generateHotspotAnalysis(hours = 24) {
    this.ensureInitialized();

    if (!this.analyticsService) {
      throw new Error('Analytics service not available');
    }

    return this.analyticsService.generateHotspotAnalysis(hours);
  }

  // Backup Operations
  async createBackup(configId: string): Promise<string> {
    this.ensureInitialized();

    if (!this.backupManager) {
      throw new Error('Backup manager not available');
    }

    return await this.backupManager.executeBackup(configId);
  }

  async restoreFromBackup(backupJobId: string, options?: any): Promise<string> {
    this.ensureInitialized();

    if (!this.backupManager) {
      throw new Error('Backup manager not available');
    }

    return await this.backupManager.restoreFromBackup(backupJobId, options);
  }

  // Performance Optimization
  getOptimizationRecommendations() {
    this.ensureInitialized();

    if (!this.performanceOptimizer) {
      throw new Error('Performance optimizer not available');
    }

    return this.performanceOptimizer.getRecommendations();
  }

  async runPerformanceBenchmark(name: string, configurations: any[], scenario: string): Promise<string> {
    this.ensureInitialized();

    if (!this.performanceOptimizer) {
      throw new Error('Performance optimizer not available');
    }

    return await this.performanceOptimizer.runPerformanceBenchmark(name, configurations, scenario);
  }

  // Health and Monitoring
  async getHealth(): Promise<ServiceHealth> {
    const health: ServiceHealth = {
      overall: 'healthy',
      services: {
        redis: 'healthy',
        multiLevel: 'healthy',
        compression: 'healthy',
        partitioning: 'healthy',
        warming: 'healthy',
        backup: 'healthy',
        analytics: 'healthy',
        optimization: 'healthy',
      },
      metrics: {
        hitRate: 0,
        averageLatency: 0,
        memoryUsage: 0,
        operationsPerSecond: 0,
        errorRate: 0,
      },
      alerts: 0,
      lastHealthCheck: new Date(),
    };

    try {
      // Check Redis cluster health
      if (this.redisCluster) {
        const clusterHealth = await this.redisCluster.getClusterHealth();
        health.services.redis = clusterHealth.isConnected ? 'healthy' : 'unhealthy';
      }

      // Check multi-level cache health
      if (this.multiLevelCache) {
        const isEnabled = this.multiLevelCache.isEnabled();
        health.services.multiLevel = isEnabled ? 'healthy' : 'degraded';
      }

      // Get current metrics if analytics is available
      if (this.analyticsService) {
        const currentStats = this.analyticsService.getCurrentStats();
        if (currentStats) {
          health.metrics = {
            hitRate: currentStats.hitRate,
            averageLatency: currentStats.averageLatency,
            memoryUsage: currentStats.memoryUsage,
            operationsPerSecond: currentStats.operationsPerSecond,
            errorRate: currentStats.errorRate,
          };
        }

        // Count unacknowledged alerts
        const alerts = this.analyticsService.getAlerts(true);
        health.alerts = alerts.length;
      }

      // Determine overall health
      const serviceStates = Object.values(health.services);
      if (serviceStates.some(state => state === 'unhealthy')) {
        health.overall = 'unhealthy';
      } else if (serviceStates.some(state => state === 'degraded')) {
        health.overall = 'degraded';
      }

      // Additional health checks based on metrics
      if (health.metrics.hitRate < 50) {
        health.overall = 'degraded';
      }
      if (health.metrics.errorRate > 5) {
        health.overall = 'unhealthy';
      }

    } catch (error) {
      health.overall = 'unhealthy';
      this.emit('health-check-error', error);
    }

    return health;
  }

  // Configuration Management
  updateConfig(updates: Partial<AdvancedCacheConfig>): void {
    this.config = { ...this.config, ...updates };
    this.emit('config-updated', this.config);

    // Apply config changes to running services
    if (this.compressionManager && updates.compression) {
      this.compressionManager.updateAdaptiveSettings({
        enabled: updates.compression.adaptive,
      });
    }

    if (this.performanceOptimizer && updates.optimization) {
      this.performanceOptimizer.updateAdaptiveConfig({
        enabled: updates.optimization.adaptive,
        aggressiveness: updates.optimization.aggressiveness,
      });
    }
  }

  getConfig(): AdvancedCacheConfig {
    return { ...this.config };
  }

  // Service Management
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('AdvancedCacheService must be initialized before use');
    }
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  async shutdown(): Promise<void> {
    this.emit('shutdown-started');

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Shutdown services in reverse order of initialization
    const shutdownPromises: Promise<void>[] = [];

    if (this.performanceOptimizer) {
      shutdownPromises.push(this.performanceOptimizer.shutdown());
    }

    if (this.backupManager) {
      shutdownPromises.push(this.backupManager.shutdown());
    }

    if (this.analyticsService) {
      shutdownPromises.push(this.analyticsService.shutdown());
    }

    if (this.warmingManager) {
      shutdownPromises.push(this.warmingManager.shutdown());
    }

    if (this.partitionManager) {
      shutdownPromises.push(this.partitionManager.shutdown());
    }

    if (this.distributedCache) {
      shutdownPromises.push(this.distributedCache.shutdown());
    }

    if (this.invalidationManager) {
      shutdownPromises.push(this.invalidationManager.shutdown());
    }

    if (this.multiLevelCache) {
      shutdownPromises.push(this.multiLevelCache.shutdown());
    }

    if (this.redisCluster) {
      shutdownPromises.push(this.redisCluster.shutdown());
    }

    await Promise.allSettled(shutdownPromises);

    this.isInitialized = false;
    this.emit('shutdown-completed');
  }

  // Utility Methods
  exportConfiguration(): string {
    return JSON.stringify(this.config, null, 2);
  }

  async importConfiguration(configJson: string): Promise<void> {
    try {
      const newConfig = JSON.parse(configJson) as AdvancedCacheConfig;
      this.updateConfig(newConfig);
    } catch (error) {
      throw new Error('Invalid configuration JSON');
    }
  }

  getServiceInfo(): any {
    return {
      version: '1.0.0',
      initialized: this.isInitialized,
      config: this.config,
      services: {
        redisCluster: !!this.redisCluster,
        multiLevelCache: !!this.multiLevelCache,
        invalidationManager: !!this.invalidationManager,
        distributedCache: !!this.distributedCache,
        warmingManager: !!this.warmingManager,
        analyticsService: !!this.analyticsService,
        compressionManager: !!this.compressionManager,
        partitionManager: !!this.partitionManager,
        backupManager: !!this.backupManager,
        performanceOptimizer: !!this.performanceOptimizer,
      },
    };
  }
}

// Export singleton instance for global use
export class AdvancedCacheSingleton {
  private static instance: AdvancedCacheService | null = null;

  static async initialize(config: AdvancedCacheConfig): Promise<AdvancedCacheService> {
    if (!this.instance) {
      this.instance = new AdvancedCacheService(config);
      await this.instance.initialize();
    }
    return this.instance;
  }

  static getInstance(): AdvancedCacheService | null {
    return this.instance;
  }

  static async shutdown(): Promise<void> {
    if (this.instance) {
      await this.instance.shutdown();
      this.instance = null;
    }
  }
}
