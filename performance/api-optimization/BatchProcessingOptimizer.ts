import { EventEmitter } from 'events';

export interface BatchConfig {
  maxBatchSize: number;
  maxWaitTime: number; // Maximum time to wait before processing batch
  minBatchSize: number;
  concurrentBatches: number;
  retryAttempts: number;
  retryDelay: number;
  enablePrioritization: boolean;
  enableCompression: boolean;
  enableMetrics: boolean;
}

export interface BatchItem<T = any> {
  id: string;
  data: T;
  priority: number;
  addedAt: Date;
  retryCount: number;
  processingTime?: number;
  error?: string;
}

export interface BatchResult<T = any> {
  batchId: string;
  items: BatchItem<T>[];
  startTime: Date;
  endTime?: Date;
  duration?: number;
  successCount: number;
  errorCount: number;
  results: any[];
  errors: string[];
}

export interface BatchStats {
  totalBatches: number;
  successfulBatches: number;
  failedBatches: number;
  totalItems: number;
  processedItems: number;
  failedItems: number;
  averageBatchSize: number;
  averageProcessingTime: number;
  throughput: number; // items per second
  compressionRatio: number;
}

export interface BatchProcessor<T = any> {
  (items: BatchItem<T>[]): Promise<any[]>;
}

export class BatchProcessingOptimizer<T = any> extends EventEmitter {
  private config: BatchConfig;
  private pendingItems: BatchItem<T>[] = [];
  private processingBatches: Map<string, BatchResult<T>> = new Map();
  private completedBatches: BatchResult<T>[] = [];
  private processors: Map<string, BatchProcessor<T>> = new Map();
  private stats: BatchStats;
  private batchTimer: NodeJS.Timeout | null = null;
  private activeBatches = 0;

  constructor(config: BatchConfig) {
    super();
    this.config = config;
    this.stats = this.initializeStats();
    this.startBatchProcessor();
  }

  private initializeStats(): BatchStats {
    return {
      totalBatches: 0,
      successfulBatches: 0,
      failedBatches: 0,
      totalItems: 0,
      processedItems: 0,
      failedItems: 0,
      averageBatchSize: 0,
      averageProcessingTime: 0,
      throughput: 0,
      compressionRatio: 0
    };
  }

  private startBatchProcessor(): void {
    this.processPendingBatches();
    
    // Set up timer for periodic processing
    this.batchTimer = setInterval(() => {
      this.processPendingBatches();
    }, this.config.maxWaitTime);
  }

  registerProcessor(type: string, processor: BatchProcessor<T>): void {
    this.processors.set(type, processor);
    this.emit('processorRegistered', type);
  }

  async addItem(data: T, options: {
    id?: string;
    priority?: number;
    type?: string;
  } = {}): Promise<string> {
    const item: BatchItem<T> = {
      id: options.id || this.generateItemId(),
      data,
      priority: options.priority || 5,
      addedAt: new Date(),
      retryCount: 0
    };

    this.pendingItems.push(item);
    this.stats.totalItems++;

    // Trigger immediate processing if batch is full
    if (this.pendingItems.length >= this.config.maxBatchSize) {
      this.processPendingBatches();
    }

    this.emit('itemAdded', item);
    return item.id;
  }

  async addItems(items: Array<{data: T, priority?: number, id?: string}>): Promise<string[]> {
    const batchItems = items.map(item => ({
      id: item.id || this.generateItemId(),
      data: item.data,
      priority: item.priority || 5,
      addedAt: new Date(),
      retryCount: 0
    }));

    this.pendingItems.push(...batchItems);
    this.stats.totalItems += batchItems.length;

    // Process immediately if we have enough items
    if (this.pendingItems.length >= this.config.maxBatchSize) {
      this.processPendingBatches();
    }

    const ids = batchItems.map(item => item.id);
    this.emit('itemsAdded', { count: batchItems.length, ids });
    
    return ids;
  }

  private async processPendingBatches(): Promise<void> {
    // Check if we can process more batches
    if (this.activeBatches >= this.config.concurrentBatches) {
      return;
    }

    // Check if we have enough items or if we've waited long enough
    const shouldProcess = this.pendingItems.length >= this.config.minBatchSize ||
      (this.pendingItems.length > 0 && this.getOldestItemAge() >= this.config.maxWaitTime);

    if (!shouldProcess) {
      return;
    }

    // Sort items by priority if enabled
    if (this.config.enablePrioritization) {
      this.pendingItems.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority; // Higher priority first
        }
        return a.addedAt.getTime() - b.addedAt.getTime(); // FIFO for same priority
      });
    }

    // Create batch
    const batchSize = Math.min(this.config.maxBatchSize, this.pendingItems.length);
    const batchItems = this.pendingItems.splice(0, batchSize);

    await this.processBatch(batchItems);
  }

  private async processBatch(items: BatchItem<T>[]): Promise<void> {
    const batchId = this.generateBatchId();
    const batchResult: BatchResult<T> = {
      batchId,
      items,
      startTime: new Date(),
      successCount: 0,
      errorCount: 0,
      results: [],
      errors: []
    };

    this.processingBatches.set(batchId, batchResult);
    this.activeBatches++;
    this.stats.totalBatches++;

    this.emit('batchStarted', { batchId, itemCount: items.length });

    try {
      // Get the appropriate processor
      const processor = this.getProcessor();
      if (!processor) {
        throw new Error('No processor available');
      }

      // Compress batch if enabled
      const processedItems = this.config.enableCompression ? 
        this.compressBatch(items) : items;

      // Process the batch
      const results = await this.executeWithTimeout(
        processor(processedItems),
        this.calculateTimeout(items.length)
      );

      // Handle results
      batchResult.results = results;
      batchResult.successCount = results.length;
      batchResult.endTime = new Date();
      batchResult.duration = batchResult.endTime.getTime() - batchResult.startTime.getTime();

      this.stats.processedItems += batchResult.successCount;
      this.stats.successfulBatches++;

      this.emit('batchCompleted', batchResult);

    } catch (error) {
      batchResult.endTime = new Date();
      batchResult.duration = batchResult.endTime.getTime() - batchResult.startTime.getTime();
      batchResult.errorCount = items.length;
      batchResult.errors = [error instanceof Error ? error.message : String(error)];

      this.stats.failedItems += items.length;
      this.stats.failedBatches++;

      // Handle retry logic
      await this.handleBatchError(batchResult, error);

      this.emit('batchFailed', { batchResult, error });
    }

    // Update batch result and statistics
    this.processingBatches.delete(batchId);
    this.completedBatches.push(batchResult);
    this.activeBatches--;

    // Keep only recent completed batches
    if (this.completedBatches.length > 100) {
      this.completedBatches = this.completedBatches.slice(-100);
    }

    this.updateStatistics(batchResult);
  }

  private getProcessor(): BatchProcessor<T> | undefined {
    // Simple implementation - use the first available processor
    // In production, you might want more sophisticated routing
    const processors = Array.from(this.processors.values());
    return processors[0];
  }

  private compressBatch(items: BatchItem<T>[]): BatchItem<T>[] {
    // Simple compression implementation
    // In production, you might use actual compression algorithms
    
    // Group similar items together for better processing efficiency
    const grouped = new Map<string, BatchItem<T>[]>();
    
    items.forEach(item => {
      const key = this.getItemKey(item);
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(item);
    });

    // Flatten back to array, but maintain grouping
    const compressed: BatchItem<T>[] = [];
    for (const group of grouped.values()) {
      compressed.push(...group);
    }

    // Calculate compression ratio
    const originalSize = JSON.stringify(items).length;
    const compressedSize = JSON.stringify(compressed).length;
    const ratio = compressedSize / originalSize;
    
    this.stats.compressionRatio = (this.stats.compressionRatio + ratio) / 2;

    return compressed;
  }

  private getItemKey(item: BatchItem<T>): string {
    // Generate a key for grouping similar items
    // This is a simplified implementation
    if (typeof item.data === 'object' && item.data !== null) {
      const obj = item.data as any;
      return `${obj.type || 'default'}_${obj.category || 'default'}`;
    }
    return 'default';
  }

  private async executeWithTimeout<R>(promise: Promise<R>, timeout: number): Promise<R> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Batch processing timeout')), timeout)
      )
    ]);
  }

  private calculateTimeout(itemCount: number): number {
    // Base timeout + additional time per item
    const baseTimeout = 5000; // 5 seconds
    const perItemTimeout = 100; // 100ms per item
    return baseTimeout + (itemCount * perItemTimeout);
  }

  private async handleBatchError(batchResult: BatchResult<T>, error: any): Promise<void> {
    const retryableItems = batchResult.items.filter(
      item => item.retryCount < this.config.retryAttempts
    );

    if (retryableItems.length > 0) {
      // Increment retry count and add back to pending
      retryableItems.forEach(item => {
        item.retryCount++;
      });

      // Add delay before retrying
      setTimeout(() => {
        this.pendingItems.unshift(...retryableItems);
        this.emit('itemsRetried', { count: retryableItems.length, batchId: batchResult.batchId });
      }, this.config.retryDelay * Math.pow(2, retryableItems[0].retryCount)); // Exponential backoff
    }
  }

  private getOldestItemAge(): number {
    if (this.pendingItems.length === 0) return 0;
    
    const oldest = this.pendingItems.reduce((oldest, current) => 
      current.addedAt < oldest.addedAt ? current : oldest
    );

    return Date.now() - oldest.addedAt.getTime();
  }

  private updateStatistics(batchResult: BatchResult<T>): void {
    // Update average batch size
    this.stats.averageBatchSize = 
      (this.stats.averageBatchSize * (this.stats.totalBatches - 1) + batchResult.items.length) /
      this.stats.totalBatches;

    // Update average processing time
    if (batchResult.duration) {
      this.stats.averageProcessingTime = 
        (this.stats.averageProcessingTime * (this.stats.totalBatches - 1) + batchResult.duration) /
        this.stats.totalBatches;
    }

    // Calculate throughput (items per second)
    const totalTime = this.completedBatches.reduce((sum, batch) => sum + (batch.duration || 0), 0);
    this.stats.throughput = totalTime > 0 ? (this.stats.processedItems / totalTime) * 1000 : 0;
  }

  async waitForItem(itemId: string, timeout: number = 30000): Promise<any> {
    return new Promise((resolve, reject) => {
      let found = false;
      
      const checkCompleted = () => {
        for (const batch of this.completedBatches) {
          const itemIndex = batch.items.findIndex(item => item.id === itemId);
          if (itemIndex !== -1) {
            found = true;
            if (batch.errorCount > 0) {
              reject(new Error(batch.errors[0] || 'Item processing failed'));
            } else {
              resolve(batch.results[itemIndex]);
            }
            return;
          }
        }
      };

      // Check if already completed
      checkCompleted();
      if (found) return;

      // Listen for batch completions
      const onBatchCompleted = (batch: BatchResult<T>) => {
        const itemIndex = batch.items.findIndex(item => item.id === itemId);
        if (itemIndex !== -1) {
          found = true;
          this.removeListener('batchCompleted', onBatchCompleted);
          this.removeListener('batchFailed', onBatchFailed);
          resolve(batch.results[itemIndex]);
        }
      };

      const onBatchFailed = (data: {batchResult: BatchResult<T>, error: any}) => {
        const itemIndex = data.batchResult.items.findIndex(item => item.id === itemId);
        if (itemIndex !== -1) {
          found = true;
          this.removeListener('batchCompleted', onBatchCompleted);
          this.removeListener('batchFailed', onBatchFailed);
          reject(data.error);
        }
      };

      this.on('batchCompleted', onBatchCompleted);
      this.on('batchFailed', onBatchFailed);

      // Set timeout
      setTimeout(() => {
        if (!found) {
          this.removeListener('batchCompleted', onBatchCompleted);
          this.removeListener('batchFailed', onBatchFailed);
          reject(new Error('Timeout waiting for item processing'));
        }
      }, timeout);
    });
  }

  getStats(): BatchStats {
    return { ...this.stats };
  }

  getPendingItems(): BatchItem<T>[] {
    return [...this.pendingItems];
  }

  getProcessingBatches(): BatchResult<T>[] {
    return Array.from(this.processingBatches.values());
  }

  getCompletedBatches(limit?: number): BatchResult<T>[] {
    return limit ? this.completedBatches.slice(-limit) : [...this.completedBatches];
  }

  optimizeBatchSize(): {
    recommendedBatchSize: number;
    recommendedWaitTime: number;
    reasoning: string[];
  } {
    const reasoning: string[] = [];
    let recommendedBatchSize = this.config.maxBatchSize;
    let recommendedWaitTime = this.config.maxWaitTime;

    // Analyze processing times vs batch sizes
    const avgProcessingTime = this.stats.averageProcessingTime;
    const avgBatchSize = this.stats.averageBatchSize;

    if (avgProcessingTime > 10000 && avgBatchSize > 50) {
      recommendedBatchSize = Math.max(this.config.minBatchSize, avgBatchSize * 0.7);
      reasoning.push('High processing time detected - reduce batch size');
    }

    if (avgProcessingTime < 1000 && avgBatchSize < this.config.maxBatchSize * 0.5) {
      recommendedBatchSize = Math.min(this.config.maxBatchSize * 1.5, avgBatchSize * 1.5);
      reasoning.push('Low processing time - can increase batch size');
    }

    // Analyze wait times
    const avgAge = this.getOldestItemAge();
    if (avgAge > this.config.maxWaitTime * 1.5) {
      recommendedWaitTime = Math.max(1000, this.config.maxWaitTime * 0.8);
      reasoning.push('Items waiting too long - reduce wait time');
    }

    // Analyze throughput
    if (this.stats.throughput < 10) { // Less than 10 items per second
      recommendedBatchSize = Math.max(this.config.minBatchSize, recommendedBatchSize * 0.8);
      recommendedWaitTime = Math.max(1000, recommendedWaitTime * 0.8);
      reasoning.push('Low throughput - optimize batch parameters');
    }

    return {
      recommendedBatchSize,
      recommendedWaitTime,
      reasoning
    };
  }

  generateReport(): {
    efficiency: {
      successRate: number;
      throughput: number;
      averageLatency: number;
      compressionRatio: number;
    };
    performance: {
      batchUtilization: number;
      processingEfficiency: number;
      retryRate: number;
    };
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    
    const successRate = this.stats.totalBatches > 0 ? 
      (this.stats.successfulBatches / this.stats.totalBatches) * 100 : 0;

    const batchUtilization = this.stats.averageBatchSize / this.config.maxBatchSize * 100;
    
    const processingEfficiency = this.stats.totalItems > 0 ?
      (this.stats.processedItems / this.stats.totalItems) * 100 : 0;

    const retryRate = this.stats.totalItems > 0 ?
      (this.stats.failedItems / this.stats.totalItems) * 100 : 0;

    // Generate recommendations
    if (successRate < 95) {
      recommendations.push('Low success rate - investigate error causes');
    }

    if (batchUtilization < 70) {
      recommendations.push('Low batch utilization - consider reducing batch size or wait time');
    }

    if (this.stats.throughput < 50) {
      recommendations.push('Low throughput - optimize processing logic or increase concurrency');
    }

    if (retryRate > 10) {
      recommendations.push('High retry rate - investigate underlying issues');
    }

    if (this.activeBatches === this.config.concurrentBatches) {
      recommendations.push('Consider increasing concurrent batch limit');
    }

    return {
      efficiency: {
        successRate,
        throughput: this.stats.throughput,
        averageLatency: this.stats.averageProcessingTime,
        compressionRatio: this.stats.compressionRatio
      },
      performance: {
        batchUtilization,
        processingEfficiency,
        retryRate
      },
      recommendations
    };
  }

  async flush(): Promise<void> {
    // Process all pending items immediately
    while (this.pendingItems.length > 0) {
      await this.processPendingBatches();
      
      // Wait a bit for processing to complete
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Wait for all active batches to complete
    while (this.activeBatches > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private generateItemId(): string {
    return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  shutdown(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }

    // Process remaining items or save them
    this.emit('shutdown', {
      pendingItems: this.pendingItems.length,
      activeBatches: this.activeBatches
    });

    console.log('Batch processing optimizer shutdown complete');
  }
}

// Predefined batch configurations
export const BatchPresets = {
  realtime: {
    maxBatchSize: 10,
    maxWaitTime: 1000, // 1 second
    minBatchSize: 1,
    concurrentBatches: 5,
    retryAttempts: 2,
    retryDelay: 500,
    enablePrioritization: true,
    enableCompression: false,
    enableMetrics: true
  },

  balanced: {
    maxBatchSize: 50,
    maxWaitTime: 5000, // 5 seconds
    minBatchSize: 5,
    concurrentBatches: 3,
    retryAttempts: 3,
    retryDelay: 1000,
    enablePrioritization: true,
    enableCompression: true,
    enableMetrics: true
  },

  throughput: {
    maxBatchSize: 200,
    maxWaitTime: 10000, // 10 seconds
    minBatchSize: 20,
    concurrentBatches: 2,
    retryAttempts: 5,
    retryDelay: 2000,
    enablePrioritization: false,
    enableCompression: true,
    enableMetrics: true
  },

  bulk: {
    maxBatchSize: 1000,
    maxWaitTime: 30000, // 30 seconds
    minBatchSize: 100,
    concurrentBatches: 1,
    retryAttempts: 3,
    retryDelay: 5000,
    enablePrioritization: false,
    enableCompression: true,
    enableMetrics: true
  }
};
