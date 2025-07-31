// API Performance Optimization Suite
// Comprehensive collection of API optimization tools and utilities

export { ResponseTimeOptimizer, type ResponseTimeMetrics, type ResponseTimeConfig } from './ResponseTimeOptimizer';
export { AsyncProcessingManager, type AsyncTask, type WorkerConfig, type TaskHandler, type JobContext } from './AsyncProcessingManager';
export { BackgroundJobOptimizer, type JobConfig, type JobExecution, type JobHandler, type JobStats } from './BackgroundJobOptimizer';
export { APICachingStrategies, type CacheConfig, type CacheEntry, type CacheStats, CachingPresets } from './APICachingStrategies';
export { ResponseCompressionManager, type CompressionConfig, type CompressionStats, CompressionPresets } from './ResponseCompressionManager';
export { APIRateLimitingOptimizer, type RateLimitConfig, type RateLimitStats, RateLimitPresets } from './APIRateLimitingOptimizer';
export { DatabaseConnectionOptimizer, type ConnectionPoolConfig, type Connection, type PoolStats, PoolPresets } from './DatabaseConnectionOptimizer';
export { MemoryUsageOptimizer, type MemoryConfig, type MemorySnapshot, type MemoryStats, MemoryPresets } from './MemoryUsageOptimizer';
export { CPUUtilizationOptimizer, type CPUConfig, type CPUMetrics, type CPUStats, CPUPresets } from './CPUUtilizationOptimizer';
export { BatchProcessingOptimizer, type BatchConfig, type BatchItem, type BatchResult, BatchPresets } from './BatchProcessingOptimizer';
export { APIPerformanceMonitor, type MonitoringConfig, type PerformanceMetric, type Alert, MonitoringPresets } from './APIPerformanceMonitor';

import { ResponseTimeOptimizer } from './ResponseTimeOptimizer';
import { AsyncProcessingManager } from './AsyncProcessingManager';
import { BackgroundJobOptimizer } from './BackgroundJobOptimizer';
import { APICachingStrategies } from './APICachingStrategies';
import { ResponseCompressionManager } from './ResponseCompressionManager';
import { APIRateLimitingOptimizer } from './APIRateLimitingOptimizer';
import { DatabaseConnectionOptimizer } from './DatabaseConnectionOptimizer';
import { MemoryUsageOptimizer } from './MemoryUsageOptimizer';
import { CPUUtilizationOptimizer } from './CPUUtilizationOptimizer';
import { BatchProcessingOptimizer } from './BatchProcessingOptimizer';
import { APIPerformanceMonitor } from './APIPerformanceMonitor';

/**
 * Comprehensive API Optimization Manager
 * Orchestrates all performance optimization components
 */
export class APIOptimizationManager {
  private responseTimeOptimizer?: ResponseTimeOptimizer;
  private asyncProcessingManager?: AsyncProcessingManager;
  private backgroundJobOptimizer?: BackgroundJobOptimizer;
  private cachingStrategies?: APICachingStrategies;
  private compressionManager?: ResponseCompressionManager;
  private rateLimitingOptimizer?: APIRateLimitingOptimizer;
  private databaseOptimizer?: DatabaseConnectionOptimizer;
  private memoryOptimizer?: MemoryUsageOptimizer;
  private cpuOptimizer?: CPUUtilizationOptimizer;
  private batchProcessor?: BatchProcessingOptimizer;
  private performanceMonitor?: APIPerformanceMonitor;

  private isInitialized = false;
  private components: string[] = [];

  constructor(private config: APIOptimizationConfig = {}) {}

  /**
   * Initialize all optimization components
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('API Optimization Manager already initialized');
    }

    console.log('Initializing API Optimization Manager...');

    try {
      // Initialize components based on configuration
      if (this.config.enableResponseTimeOptimization !== false) {
        await this.initializeResponseTimeOptimizer();
      }

      if (this.config.enableAsyncProcessing !== false) {
        await this.initializeAsyncProcessing();
      }

      if (this.config.enableBackgroundJobs !== false) {
        await this.initializeBackgroundJobs();
      }

      if (this.config.enableCaching !== false) {
        await this.initializeCaching();
      }

      if (this.config.enableCompression !== false) {
        await this.initializeCompression();
      }

      if (this.config.enableRateLimiting !== false) {
        await this.initializeRateLimiting();
      }

      if (this.config.enableDatabaseOptimization !== false) {
        await this.initializeDatabaseOptimization();
      }

      if (this.config.enableMemoryOptimization !== false) {
        await this.initializeMemoryOptimization();
      }

      if (this.config.enableCPUOptimization !== false) {
        await this.initializeCPUOptimization();
      }

      if (this.config.enableBatchProcessing !== false) {
        await this.initializeBatchProcessing();
      }

      if (this.config.enablePerformanceMonitoring !== false) {
        await this.initializePerformanceMonitoring();
      }

      this.isInitialized = true;
      console.log(`API Optimization Manager initialized with components: ${this.components.join(', ')}`);

    } catch (error) {
      console.error('Failed to initialize API Optimization Manager:', error);
      throw error;
    }
  }

  private async initializeResponseTimeOptimizer(): Promise<void> {
    this.responseTimeOptimizer = new ResponseTimeOptimizer(
      this.config.responseTimeConfig || {
        maxResponseTime: 2000,
        slowQueryThreshold: 1000,
        alertThreshold: 3000,
        enableDetailedLogging: false
      }
    );
    this.components.push('Response Time Optimizer');
  }

  private async initializeAsyncProcessing(): Promise<void> {
    this.asyncProcessingManager = new AsyncProcessingManager(
      this.config.asyncProcessingConfig || {
        maxWorkers: 4,
        taskTimeout: 30000,
        retryDelay: 1000,
        maxQueueSize: 1000
      }
    );
    this.components.push('Async Processing Manager');
  }

  private async initializeBackgroundJobs(): Promise<void> {
    this.backgroundJobOptimizer = new BackgroundJobOptimizer();
    this.components.push('Background Job Optimizer');
  }

  private async initializeCaching(): Promise<void> {
    this.cachingStrategies = new APICachingStrategies(
      this.config.cachingConfig || {
        ttl: 300,
        maxSize: 128,
        strategy: 'lru',
        compression: true,
        serialize: true,
        warming: false
      }
    );
    this.components.push('API Caching Strategies');
  }

  private async initializeCompression(): Promise<void> {
    this.compressionManager = new ResponseCompressionManager(
      this.config.compressionConfig || {
        threshold: 1024,
        level: 6,
        algorithms: ['gzip', 'br', 'deflate'],
        chunkSize: 16 * 1024,
        windowBits: 15,
        memLevel: 8,
        strategy: 'defaultStrategy',
        enableETags: true,
        enableVary: true
      }
    );
    this.components.push('Response Compression Manager');
  }

  private async initializeRateLimiting(): Promise<void> {
    this.rateLimitingOptimizer = new APIRateLimitingOptimizer(
      this.config.rateLimitingConfig || {
        windowMs: 60000,
        maxRequests: 100,
        algorithm: 'sliding',
        keyGenerator: (req) => req.ip,
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
        enableBurst: true
      }
    );
    this.components.push('API Rate Limiting Optimizer');
  }

  private async initializeDatabaseOptimization(): Promise<void> {
    if (!this.config.databaseConnectionFactory) {
      console.warn('Database connection factory not provided, skipping database optimization');
      return;
    }

    this.databaseOptimizer = new DatabaseConnectionOptimizer(
      this.config.databaseConfig || {
        min: 2,
        max: 10,
        acquireTimeoutMs: 5000,
        createTimeoutMs: 3000,
        destroyTimeoutMs: 1000,
        idleTimeoutMs: 30000,
        reapIntervalMs: 10000,
        createRetryIntervalMs: 1000,
        validateInterval: 60000,
        enableHealthCheck: true,
        enableMetrics: true
      },
      this.config.databaseConnectionFactory
    );
    this.components.push('Database Connection Optimizer');
  }

  private async initializeMemoryOptimization(): Promise<void> {
    this.memoryOptimizer = new MemoryUsageOptimizer(
      this.config.memoryConfig || {
        maxHeapUsage: 512,
        gcThreshold: 70,
        memoryLeakThreshold: 256,
        monitoringInterval: 5000,
        enableGCOptimization: true,
        enableMemoryProfiling: false,
        enableLeakDetection: true,
        snapshotInterval: 60000
      }
    );
    this.components.push('Memory Usage Optimizer');
  }

  private async initializeCPUOptimization(): Promise<void> {
    this.cpuOptimizer = new CPUUtilizationOptimizer(
      this.config.cpuConfig || {
        maxUtilization: 75,
        monitoringInterval: 2000,
        enableProcessBalancing: true,
        enableTaskDistribution: true,
        enableCPUProfiling: false,
        taskQueueSize: 500,
        cpuIntensiveThreshold: 50
      }
    );
    this.components.push('CPU Utilization Optimizer');
  }

  private async initializeBatchProcessing(): Promise<void> {
    this.batchProcessor = new BatchProcessingOptimizer(
      this.config.batchConfig || {
        maxBatchSize: 50,
        maxWaitTime: 5000,
        minBatchSize: 5,
        concurrentBatches: 3,
        retryAttempts: 3,
        retryDelay: 1000,
        enablePrioritization: true,
        enableCompression: true,
        enableMetrics: true
      }
    );
    this.components.push('Batch Processing Optimizer');
  }

  private async initializePerformanceMonitoring(): Promise<void> {
    this.performanceMonitor = new APIPerformanceMonitor(
      this.config.monitoringConfig || {
        enableRealTimeMetrics: true,
        enableAlerting: true,
        enableProfiling: false,
        metricsRetentionDays: 7,
        alertThresholds: {
          responseTime: 2000,
          errorRate: 5,
          throughput: 10,
          cpuUsage: 75,
          memoryUsage: 512,
          diskUsage: 80
        },
        samplingRate: 0.1,
        enableDetailedTracing: false
      }
    );
    this.components.push('API Performance Monitor');
  }

  /**
   * Get Express middleware for all enabled optimizations
   */
  getMiddleware(): any[] {
    if (!this.isInitialized) {
      throw new Error('API Optimization Manager not initialized');
    }

    const middleware: any[] = [];

    if (this.performanceMonitor) {
      middleware.push(this.performanceMonitor.middleware());
    }

    if (this.responseTimeOptimizer) {
      middleware.push(this.responseTimeOptimizer.middleware());
    }

    if (this.rateLimitingOptimizer) {
      middleware.push(this.rateLimitingOptimizer.middleware());
    }

    if (this.cachingStrategies) {
      middleware.push(this.cachingStrategies.middleware());
    }

    if (this.compressionManager) {
      middleware.push(this.compressionManager.middleware());
    }

    return middleware;
  }

  /**
   * Generate comprehensive performance report
   */
  generateReport(): APIOptimizationReport {
    if (!this.isInitialized) {
      throw new Error('API Optimization Manager not initialized');
    }

    const report: APIOptimizationReport = {
      timestamp: new Date(),
      components: this.components,
      performance: {},
      recommendations: []
    };

    // Collect metrics from all components
    if (this.responseTimeOptimizer) {
      report.performance.responseTime = this.responseTimeOptimizer.generatePerformanceReport();
    }

    if (this.cachingStrategies) {
      report.performance.caching = this.cachingStrategies.getStats();
    }

    if (this.compressionManager) {
      report.performance.compression = this.compressionManager.generateCompressionReport();
    }

    if (this.rateLimitingOptimizer) {
      report.performance.rateLimiting = this.rateLimitingOptimizer.generateReport();
    }

    if (this.databaseOptimizer) {
      report.performance.database = this.databaseOptimizer.generateReport();
    }

    if (this.memoryOptimizer) {
      report.performance.memory = this.memoryOptimizer.generateMemoryReport();
    }

    if (this.cpuOptimizer) {
      report.performance.cpu = this.cpuOptimizer.generateCPUReport();
    }

    if (this.batchProcessor) {
      report.performance.batchProcessing = this.batchProcessor.generateReport();
    }

    if (this.performanceMonitor) {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 3600000); // Last hour
      report.performance.monitoring = this.performanceMonitor.getPerformanceReport(startTime, endTime);
    }

    // Generate overall recommendations
    report.recommendations = this.generateOverallRecommendations(report);

    return report;
  }

  private generateOverallRecommendations(report: APIOptimizationReport): string[] {
    const recommendations: string[] = [];

    // Analyze cross-component patterns and suggest optimizations
    if (report.performance.responseTime?.averageResponseTime > 1000) {
      recommendations.push('Consider implementing more aggressive caching or database query optimization');
    }

    if (report.performance.memory?.summary?.utilizationPercent > 80) {
      recommendations.push('Memory usage is high - consider scaling horizontally or optimizing memory allocation patterns');
    }

    if (report.performance.cpu?.utilization?.current > 75) {
      recommendations.push('CPU utilization is high - consider load balancing or optimizing CPU-intensive operations');
    }

    return recommendations;
  }

  /**
   * Shutdown all optimization components gracefully
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down API Optimization Manager...');

    const shutdownPromises: Promise<void>[] = [];

    if (this.performanceMonitor) {
      shutdownPromises.push(Promise.resolve(this.performanceMonitor.shutdown()));
    }

    if (this.batchProcessor) {
      shutdownPromises.push(Promise.resolve(this.batchProcessor.shutdown()));
    }

    if (this.cpuOptimizer) {
      shutdownPromises.push(Promise.resolve(this.cpuOptimizer.shutdown()));
    }

    if (this.memoryOptimizer) {
      shutdownPromises.push(Promise.resolve(this.memoryOptimizer.shutdown()));
    }

    if (this.databaseOptimizer) {
      shutdownPromises.push(this.databaseOptimizer.shutdown());
    }

    if (this.rateLimitingOptimizer) {
      shutdownPromises.push(Promise.resolve(this.rateLimitingOptimizer.shutdown()));
    }

    if (this.compressionManager) {
      shutdownPromises.push(Promise.resolve(this.compressionManager.shutdown()));
    }

    if (this.cachingStrategies) {
      shutdownPromises.push(Promise.resolve(this.cachingStrategies.shutdown()));
    }

    if (this.backgroundJobOptimizer) {
      shutdownPromises.push(this.backgroundJobOptimizer.shutdown());
    }

    if (this.asyncProcessingManager) {
      shutdownPromises.push(this.asyncProcessingManager.shutdown());
    }

    await Promise.allSettled(shutdownPromises);

    this.isInitialized = false;
    console.log('API Optimization Manager shutdown complete');
  }
}

// Configuration interfaces
export interface APIOptimizationConfig {
  enableResponseTimeOptimization?: boolean;
  enableAsyncProcessing?: boolean;
  enableBackgroundJobs?: boolean;
  enableCaching?: boolean;
  enableCompression?: boolean;
  enableRateLimiting?: boolean;
  enableDatabaseOptimization?: boolean;
  enableMemoryOptimization?: boolean;
  enableCPUOptimization?: boolean;
  enableBatchProcessing?: boolean;
  enablePerformanceMonitoring?: boolean;

  responseTimeConfig?: any;
  asyncProcessingConfig?: any;
  cachingConfig?: any;
  compressionConfig?: any;
  rateLimitingConfig?: any;
  databaseConfig?: any;
  databaseConnectionFactory?: () => Promise<any>;
  memoryConfig?: any;
  cpuConfig?: any;
  batchConfig?: any;
  monitoringConfig?: any;
}

export interface APIOptimizationReport {
  timestamp: Date;
  components: string[];
  performance: {
    responseTime?: any;
    caching?: any;
    compression?: any;
    rateLimiting?: any;
    database?: any;
    memory?: any;
    cpu?: any;
    batchProcessing?: any;
    monitoring?: any;
  };
  recommendations: string[];
}

// Default configuration presets
export const OptimizationPresets = {
  development: {
    enableResponseTimeOptimization: true,
    enableAsyncProcessing: true,
    enableBackgroundJobs: false,
    enableCaching: true,
    enableCompression: false,
    enableRateLimiting: false,
    enableDatabaseOptimization: false,
    enableMemoryOptimization: true,
    enableCPUOptimization: false,
    enableBatchProcessing: false,
    enablePerformanceMonitoring: true
  },

  production: {
    enableResponseTimeOptimization: true,
    enableAsyncProcessing: true,
    enableBackgroundJobs: true,
    enableCaching: true,
    enableCompression: true,
    enableRateLimiting: true,
    enableDatabaseOptimization: true,
    enableMemoryOptimization: true,
    enableCPUOptimization: true,
    enableBatchProcessing: true,
    enablePerformanceMonitoring: true
  },

  highPerformance: {
    enableResponseTimeOptimization: true,
    enableAsyncProcessing: true,
    enableBackgroundJobs: true,
    enableCaching: true,
    enableCompression: true,
    enableRateLimiting: true,
    enableDatabaseOptimization: true,
    enableMemoryOptimization: true,
    enableCPUOptimization: true,
    enableBatchProcessing: true,
    enablePerformanceMonitoring: true
  }
};
