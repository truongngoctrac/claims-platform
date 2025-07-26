import { EventEmitter } from 'events';
import { MultiLevelCacheManager } from './MultiLevelCacheManager';
import cron from 'node-cron';

export interface WarmingStrategy {
  id: string;
  name: string;
  type: 'scheduled' | 'predictive' | 'on_demand' | 'event_driven' | 'background';
  enabled: boolean;
  priority: number;
  config: WarmingConfig;
  schedule?: string; // Cron expression for scheduled warming
  conditions?: WarmingCondition[];
  dataSource: DataSource;
  createdAt: Date;
  lastExecuted?: Date;
  executionCount: number;
  successRate: number;
}

export interface WarmingConfig {
  batchSize: number;
  concurrency: number;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  targetLevel: 'L1' | 'L2' | 'L3' | 'all';
  maxMemoryUsage?: number;
  cacheTTL?: number;
  compressionEnabled?: boolean;
}

export interface WarmingCondition {
  type: 'time' | 'cache_miss_rate' | 'cpu_usage' | 'memory_usage' | 'request_count';
  operator: 'greater_than' | 'less_than' | 'equals' | 'between';
  value: number | [number, number];
  window?: number; // Time window in minutes
}

export interface DataSource {
  type: 'database' | 'api' | 'file' | 'function' | 'cache_analytics';
  config: {
    connection?: string;
    query?: string;
    endpoint?: string;
    filePath?: string;
    function?: () => Promise<Array<{ key: string; value: any; ttl?: number }>>;
    analyticsConfig?: {
      period: number;
      minHits: number;
      topN: number;
    };
  };
}

export interface WarmingJob {
  id: string;
  strategyId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime?: Date;
  endTime?: Date;
  totalItems: number;
  processedItems: number;
  failedItems: number;
  errors: Array<{ key: string; error: string }>;
  estimatedCompletion?: Date;
  progressPercentage: number;
}

export interface WarmingStats {
  totalStrategies: number;
  activeStrategies: number;
  totalJobs: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalItemsWarmed: number;
  averageWarmingTime: number;
  cacheHitImprovement: number;
  memoryUsageIncrease: number;
}

export interface PredictiveModel {
  name: string;
  algorithm: 'linear_regression' | 'arima' | 'neural_network' | 'collaborative_filtering';
  trainingData: Array<{ timestamp: Date; key: string; accessCount: number }>;
  predictions: Array<{ key: string; probability: number; nextAccess?: Date }>;
  accuracy: number;
  lastTrained: Date;
}

export class CacheWarmingManager extends EventEmitter {
  private cacheManager: MultiLevelCacheManager;
  private strategies: Map<string, WarmingStrategy> = new Map();
  private jobs: Map<string, WarmingJob> = new Map();
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  private stats: WarmingStats;
  private predictiveModel: PredictiveModel | null = null;
  private accessPatterns: Map<string, Array<{ timestamp: Date; count: number }>> = new Map();
  private isRunning = false;

  constructor(cacheManager: MultiLevelCacheManager) {
    super();
    this.cacheManager = cacheManager;
    
    this.stats = {
      totalStrategies: 0,
      activeStrategies: 0,
      totalJobs: 0,
      runningJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      totalItemsWarmed: 0,
      averageWarmingTime: 0,
      cacheHitImprovement: 0,
      memoryUsageIncrease: 0,
    };

    this.setupEventListeners();
    this.startAccessPatternTracking();
  }

  private setupEventListeners(): void {
    this.cacheManager.on('cache-get', (event) => {
      this.trackAccess(event.key, event.hit);
    });

    this.cacheManager.on('cache-miss', (event) => {
      this.handleCacheMiss(event.key);
    });
  }

  private startAccessPatternTracking(): void {
    // Track access patterns for predictive warming
    setInterval(() => {
      this.updateAccessPatterns();
    }, 60000); // Update every minute
  }

  createStrategy(strategy: Omit<WarmingStrategy, 'id' | 'createdAt' | 'executionCount' | 'successRate'>): string {
    const id = `warming_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const fullStrategy: WarmingStrategy = {
      id,
      createdAt: new Date(),
      executionCount: 0,
      successRate: 0,
      ...strategy,
    };

    this.strategies.set(id, fullStrategy);

    // Schedule if it's a scheduled strategy
    if (fullStrategy.type === 'scheduled' && fullStrategy.schedule) {
      this.scheduleStrategy(fullStrategy);
    }

    this.updateStats();
    this.emit('strategy-created', fullStrategy);
    
    return id;
  }

  updateStrategy(strategyId: string, updates: Partial<WarmingStrategy>): boolean {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) return false;

    // If schedule changed, update cron job
    if (updates.schedule && updates.schedule !== strategy.schedule) {
      this.unscheduleStrategy(strategyId);
      const updatedStrategy = { ...strategy, ...updates };
      this.strategies.set(strategyId, updatedStrategy);
      this.scheduleStrategy(updatedStrategy);
    } else {
      this.strategies.set(strategyId, { ...strategy, ...updates });
    }

    this.emit('strategy-updated', this.strategies.get(strategyId));
    return true;
  }

  deleteStrategy(strategyId: string): boolean {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) return false;

    this.unscheduleStrategy(strategyId);
    this.strategies.delete(strategyId);
    
    this.updateStats();
    this.emit('strategy-deleted', strategyId);
    
    return true;
  }

  private scheduleStrategy(strategy: WarmingStrategy): void {
    if (!strategy.schedule || strategy.type !== 'scheduled') return;

    try {
      const task = cron.schedule(strategy.schedule, async () => {
        await this.executeStrategy(strategy.id);
      }, {
        scheduled: strategy.enabled,
      });

      this.cronJobs.set(strategy.id, task);
    } catch (error) {
      console.error(`Failed to schedule strategy ${strategy.id}:`, error);
    }
  }

  private unscheduleStrategy(strategyId: string): void {
    const task = this.cronJobs.get(strategyId);
    if (task) {
      task.stop();
      this.cronJobs.delete(strategyId);
    }
  }

  async executeStrategy(strategyId: string): Promise<string> {
    const strategy = this.strategies.get(strategyId);
    if (!strategy || !strategy.enabled) {
      throw new Error(`Strategy ${strategyId} not found or disabled`);
    }

    // Check conditions
    if (strategy.conditions && !await this.evaluateConditions(strategy.conditions)) {
      this.emit('strategy-skipped', { strategyId, reason: 'conditions not met' });
      return 'skipped';
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job: WarmingJob = {
      id: jobId,
      strategyId,
      status: 'pending',
      totalItems: 0,
      processedItems: 0,
      failedItems: 0,
      errors: [],
      progressPercentage: 0,
    };

    this.jobs.set(jobId, job);
    this.emit('job-started', job);

    try {
      // Get data to warm
      const data = await this.fetchDataFromSource(strategy.dataSource);
      
      job.totalItems = data.length;
      job.status = 'running';
      job.startTime = new Date();
      this.jobs.set(jobId, job);

      // Process data in batches
      await this.processWarmingData(job, data, strategy.config);

      job.status = 'completed';
      job.endTime = new Date();
      job.progressPercentage = 100;
      this.jobs.set(jobId, job);

      // Update strategy stats
      strategy.executionCount++;
      strategy.lastExecuted = new Date();
      strategy.successRate = (strategy.successRate * (strategy.executionCount - 1) + 
        (job.failedItems === 0 ? 100 : 0)) / strategy.executionCount;
      this.strategies.set(strategyId, strategy);

      this.updateStats();
      this.emit('job-completed', job);

    } catch (error) {
      job.status = 'failed';
      job.endTime = new Date();
      this.jobs.set(jobId, job);

      strategy.executionCount++;
      strategy.successRate = (strategy.successRate * (strategy.executionCount - 1)) / strategy.executionCount;
      this.strategies.set(strategyId, strategy);

      this.emit('job-failed', { job, error });
      throw error;
    }

    return jobId;
  }

  private async evaluateConditions(conditions: WarmingCondition[]): Promise<boolean> {
    for (const condition of conditions) {
      const currentValue = await this.getCurrentMetricValue(condition.type, condition.window);
      
      switch (condition.operator) {
        case 'greater_than':
          if (currentValue <= condition.value as number) return false;
          break;
        case 'less_than':
          if (currentValue >= condition.value as number) return false;
          break;
        case 'equals':
          if (currentValue !== condition.value as number) return false;
          break;
        case 'between':
          const [min, max] = condition.value as [number, number];
          if (currentValue < min || currentValue > max) return false;
          break;
      }
    }
    return true;
  }

  private async getCurrentMetricValue(type: string, window?: number): Promise<number> {
    switch (type) {
      case 'cache_miss_rate':
        const stats = this.cacheManager.getOverallStats();
        return (stats.totalMisses / (stats.totalHits + stats.totalMisses)) * 100;
      
      case 'cpu_usage':
        // Implementation depends on your monitoring setup
        return 0;
      
      case 'memory_usage':
        const memUsage = process.memoryUsage();
        return (memUsage.heapUsed / memUsage.heapTotal) * 100;
      
      case 'request_count':
        // Implementation depends on your metrics collection
        return 0;
      
      default:
        return 0;
    }
  }

  private async fetchDataFromSource(dataSource: DataSource): Promise<Array<{ key: string; value: any; ttl?: number }>> {
    switch (dataSource.type) {
      case 'function':
        if (dataSource.config.function) {
          return await dataSource.config.function();
        }
        break;

      case 'cache_analytics':
        return await this.getPopularKeysFromAnalytics(dataSource.config.analyticsConfig);

      case 'database':
        return await this.fetchFromDatabase(dataSource.config);

      case 'api':
        return await this.fetchFromAPI(dataSource.config);

      case 'file':
        return await this.fetchFromFile(dataSource.config);
    }

    return [];
  }

  private async getPopularKeysFromAnalytics(config?: any): Promise<Array<{ key: string; value: any; ttl?: number }>> {
    const period = config?.period || 60; // minutes
    const minHits = config?.minHits || 5;
    const topN = config?.topN || 100;

    const popularKeys: Array<{ key: string; value: any; ttl?: number }> = [];
    
    // Analyze access patterns to find popular keys
    for (const [key, patterns] of this.accessPatterns) {
      const recentAccesses = patterns.filter(p => 
        p.timestamp.getTime() > Date.now() - (period * 60 * 1000)
      );
      
      const totalHits = recentAccesses.reduce((sum, p) => sum + p.count, 0);
      
      if (totalHits >= minHits) {
        // Try to get current value or use placeholder
        const value = await this.cacheManager.get(key) || `placeholder_${key}`;
        popularKeys.push({ key, value, ttl: 3600 });
      }
    }

    // Sort by popularity and return top N
    return popularKeys.slice(0, topN);
  }

  private async fetchFromDatabase(config: any): Promise<Array<{ key: string; value: any; ttl?: number }>> {
    // Implementation would depend on your database setup
    // This is a placeholder
    return [];
  }

  private async fetchFromAPI(config: any): Promise<Array<{ key: string; value: any; ttl?: number }>> {
    try {
      const response = await fetch(config.endpoint);
      const data = await response.json();
      return Array.isArray(data) ? data : [data];
    } catch (error) {
      console.error('Error fetching from API:', error);
      return [];
    }
  }

  private async fetchFromFile(config: any): Promise<Array<{ key: string; value: any; ttl?: number }>> {
    try {
      const fs = await import('fs/promises');
      const content = await fs.readFile(config.filePath, 'utf-8');
      const data = JSON.parse(content);
      return Array.isArray(data) ? data : [data];
    } catch (error) {
      console.error('Error reading file:', error);
      return [];
    }
  }

  private async processWarmingData(
    job: WarmingJob, 
    data: Array<{ key: string; value: any; ttl?: number }>, 
    config: WarmingConfig
  ): Promise<void> {
    const batches = this.createBatches(data, config.batchSize);
    
    for (const batch of batches) {
      const promises = batch.map(item => this.warmCacheItem(item, config, job));
      
      // Process batch with concurrency limit
      const results = await this.processConcurrently(promises, config.concurrency);
      
      // Update job progress
      job.processedItems += batch.length;
      job.progressPercentage = (job.processedItems / job.totalItems) * 100;
      
      // Estimate completion time
      const elapsed = Date.now() - (job.startTime?.getTime() || Date.now());
      const rate = job.processedItems / elapsed;
      const remaining = job.totalItems - job.processedItems;
      job.estimatedCompletion = new Date(Date.now() + (remaining / rate));
      
      this.jobs.set(job.id, job);
      this.emit('job-progress', job);

      // Check memory usage
      if (config.maxMemoryUsage) {
        const memUsage = process.memoryUsage();
        const usagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
        
        if (usagePercent > config.maxMemoryUsage) {
          this.emit('memory-threshold-exceeded', { job, memoryUsage: usagePercent });
          break;
        }
      }
    }
  }

  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  private async processConcurrently<T>(promises: Promise<T>[], concurrency: number): Promise<T[]> {
    const results: T[] = [];
    
    for (let i = 0; i < promises.length; i += concurrency) {
      const batch = promises.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(batch);
      
      results.push(
        ...batchResults.map(result => 
          result.status === 'fulfilled' ? result.value : null
        ).filter(Boolean)
      );
    }
    
    return results;
  }

  private async warmCacheItem(
    item: { key: string; value: any; ttl?: number }, 
    config: WarmingConfig, 
    job: WarmingJob
  ): Promise<void> {
    try {
      await this.cacheManager.set(item.key, item.value, {
        level: config.targetLevel,
        ttl: item.ttl || config.cacheTTL,
        compression: config.compressionEnabled,
      });
    } catch (error) {
      job.failedItems++;
      job.errors.push({ key: item.key, error: error.message });
      this.emit('item-warming-failed', { key: item.key, error });
    }
  }

  async predictiveWarming(): Promise<void> {
    if (!this.predictiveModel) {
      await this.trainPredictiveModel();
    }

    if (this.predictiveModel) {
      const predictions = this.predictiveModel.predictions
        .filter(p => p.probability > 0.7) // High probability threshold
        .slice(0, 100); // Top 100 predictions

      const data = predictions.map(p => ({
        key: p.key,
        value: `predicted_${p.key}`,
        ttl: 1800, // 30 minutes for predicted data
      }));

      // Create a predictive warming strategy
      const strategyId = this.createStrategy({
        name: 'Predictive Warming',
        type: 'predictive',
        enabled: true,
        priority: 1,
        config: {
          batchSize: 10,
          concurrency: 3,
          timeout: 5000,
          retryAttempts: 2,
          retryDelay: 1000,
          targetLevel: 'L1',
          cacheTTL: 1800,
        },
        dataSource: {
          type: 'function',
          config: {
            function: async () => data,
          },
        },
      });

      await this.executeStrategy(strategyId);
    }
  }

  private async trainPredictiveModel(): Promise<void> {
    // Simple collaborative filtering based on access patterns
    const trainingData: Array<{ timestamp: Date; key: string; accessCount: number }> = [];
    
    for (const [key, patterns] of this.accessPatterns) {
      for (const pattern of patterns) {
        trainingData.push({
          timestamp: pattern.timestamp,
          key,
          accessCount: pattern.count,
        });
      }
    }

    // Generate predictions based on access frequency and recency
    const predictions: Array<{ key: string; probability: number; nextAccess?: Date }> = [];
    
    for (const [key, patterns] of this.accessPatterns) {
      const recentAccesses = patterns.filter(p => 
        p.timestamp.getTime() > Date.now() - (24 * 60 * 60 * 1000) // Last 24 hours
      );
      
      const totalAccesses = recentAccesses.reduce((sum, p) => sum + p.count, 0);
      const frequency = totalAccesses / 24; // Accesses per hour
      
      // Simple probability calculation
      const probability = Math.min(frequency / 10, 1); // Normalize to 0-1
      
      predictions.push({
        key,
        probability,
        nextAccess: new Date(Date.now() + (60 * 60 * 1000 / frequency)), // Predicted next access
      });
    }

    this.predictiveModel = {
      name: 'Simple Collaborative Filtering',
      algorithm: 'collaborative_filtering',
      trainingData,
      predictions,
      accuracy: 0.7, // Placeholder accuracy
      lastTrained: new Date(),
    };

    this.emit('model-trained', this.predictiveModel);
  }

  private trackAccess(key: string, hit: boolean): void {
    if (!this.accessPatterns.has(key)) {
      this.accessPatterns.set(key, []);
    }

    const patterns = this.accessPatterns.get(key)!;
    const now = new Date();
    
    // Find or create entry for current minute
    const currentMinute = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());
    let entry = patterns.find(p => p.timestamp.getTime() === currentMinute.getTime());
    
    if (!entry) {
      entry = { timestamp: currentMinute, count: 0 };
      patterns.push(entry);
    }
    
    entry.count++;
    
    // Keep only last 7 days of data
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const filtered = patterns.filter(p => p.timestamp.getTime() > cutoff);
    this.accessPatterns.set(key, filtered);
  }

  private handleCacheMiss(key: string): void {
    // Trigger on-demand warming for frequently missed keys
    const patterns = this.accessPatterns.get(key) || [];
    const recentMisses = patterns.filter(p => 
      p.timestamp.getTime() > Date.now() - (60 * 1000) // Last minute
    ).length;

    if (recentMisses > 3) { // Threshold for frequent misses
      this.emit('frequent-miss-detected', { key, misses: recentMisses });
      // Could trigger immediate warming here
    }
  }

  private updateAccessPatterns(): void {
    // Cleanup old patterns and update model if needed
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    for (const [key, patterns] of this.accessPatterns) {
      const filtered = patterns.filter(p => p.timestamp.getTime() > cutoff);
      if (filtered.length === 0) {
        this.accessPatterns.delete(key);
      } else {
        this.accessPatterns.set(key, filtered);
      }
    }

    // Retrain model periodically
    if (this.predictiveModel && 
        Date.now() - this.predictiveModel.lastTrained.getTime() > (24 * 60 * 60 * 1000)) {
      this.trainPredictiveModel();
    }
  }

  private updateStats(): void {
    this.stats.totalStrategies = this.strategies.size;
    this.stats.activeStrategies = Array.from(this.strategies.values())
      .filter(s => s.enabled).length;
    
    this.stats.totalJobs = this.jobs.size;
    this.stats.runningJobs = Array.from(this.jobs.values())
      .filter(j => j.status === 'running').length;
    this.stats.completedJobs = Array.from(this.jobs.values())
      .filter(j => j.status === 'completed').length;
    this.stats.failedJobs = Array.from(this.jobs.values())
      .filter(j => j.status === 'failed').length;
  }

  getStats(): WarmingStats {
    this.updateStats();
    return { ...this.stats };
  }

  getStrategies(): WarmingStrategy[] {
    return Array.from(this.strategies.values());
  }

  getJobs(): WarmingJob[] {
    return Array.from(this.jobs.values());
  }

  getJob(jobId: string): WarmingJob | null {
    return this.jobs.get(jobId) || null;
  }

  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'running') return false;

    job.status = 'cancelled';
    job.endTime = new Date();
    this.jobs.set(jobId, job);
    
    this.emit('job-cancelled', job);
    return true;
  }

  getPredictiveModel(): PredictiveModel | null {
    return this.predictiveModel;
  }

  getAccessPatterns(): Map<string, Array<{ timestamp: Date; count: number }>> {
    return new Map(this.accessPatterns);
  }

  async shutdown(): Promise<void> {
    // Stop all cron jobs
    for (const [, task] of this.cronJobs) {
      task.stop();
    }
    this.cronJobs.clear();

    // Cancel running jobs
    for (const [jobId, job] of this.jobs) {
      if (job.status === 'running') {
        this.cancelJob(jobId);
      }
    }

    this.emit('shutdown');
  }
}
