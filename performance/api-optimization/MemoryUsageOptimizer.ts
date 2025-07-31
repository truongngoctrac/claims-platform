import { EventEmitter } from 'events';

export interface MemoryConfig {
  maxHeapUsage: number; // Maximum heap usage in MB
  gcThreshold: number; // GC threshold percentage
  memoryLeakThreshold: number; // Memory leak threshold in MB
  monitoringInterval: number; // Monitoring interval in ms
  enableGCOptimization: boolean;
  enableMemoryProfiling: boolean;
  enableLeakDetection: boolean;
  snapshotInterval: number;
}

export interface MemorySnapshot {
  timestamp: Date;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
  gcCount: number;
  gcDuration: number;
}

export interface MemoryStats {
  currentUsage: NodeJS.MemoryUsage;
  peakUsage: NodeJS.MemoryUsage;
  averageUsage: NodeJS.MemoryUsage;
  gcStats: {
    totalGCs: number;
    totalGCTime: number;
    averageGCTime: number;
    lastGCTime: Date;
  };
  memoryTrend: 'stable' | 'increasing' | 'decreasing' | 'volatile';
  leakSuspicion: number; // 0-100 percentage
}

export interface MemoryLeak {
  type: string;
  size: number;
  location: string;
  detectedAt: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class MemoryUsageOptimizer extends EventEmitter {
  private config: MemoryConfig;
  private snapshots: MemorySnapshot[] = [];
  private stats: MemoryStats;
  private monitoringInterval: NodeJS.Timeout;
  private snapshotInterval: NodeJS.Timeout;
  private gcObserver: any;
  private suspectedLeaks: MemoryLeak[] = [];
  private objectTracker: Map<string, WeakRef<any>> = new Map();
  private allocationTracker: Map<string, number> = new Map();

  constructor(config: MemoryConfig) {
    super();
    this.config = config;
    this.stats = this.initializeStats();
    this.setupGCObserver();
    this.startMonitoring();
    
    if (this.config.enableMemoryProfiling) {
      this.startProfiling();
    }
  }

  private initializeStats(): MemoryStats {
    const currentUsage = process.memoryUsage();
    
    return {
      currentUsage,
      peakUsage: { ...currentUsage },
      averageUsage: { ...currentUsage },
      gcStats: {
        totalGCs: 0,
        totalGCTime: 0,
        averageGCTime: 0,
        lastGCTime: new Date()
      },
      memoryTrend: 'stable',
      leakSuspicion: 0
    };
  }

  private setupGCObserver(): void {
    if (!this.config.enableGCOptimization) return;

    try {
      const { PerformanceObserver, performance } = require('perf_hooks');
      
      this.gcObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        
        entries.forEach((entry) => {
          if (entry.entryType === 'gc') {
            this.handleGCEvent(entry);
          }
        });
      });

      this.gcObserver.observe({ entryTypes: ['gc'] });
    } catch (error) {
      console.warn('GC observation not available:', error);
    }
  }

  private handleGCEvent(entry: any): void {
    this.stats.gcStats.totalGCs++;
    this.stats.gcStats.totalGCTime += entry.duration;
    this.stats.gcStats.averageGCTime = 
      this.stats.gcStats.totalGCTime / this.stats.gcStats.totalGCs;
    this.stats.gcStats.lastGCTime = new Date();

    // Check if GC is happening too frequently
    if (entry.duration > 100) { // GC taking more than 100ms
      this.emit('slowGC', {
        duration: entry.duration,
        type: entry.detail?.type || 'unknown',
        timestamp: new Date()
      });
    }

    // Suggest GC optimization
    if (this.stats.gcStats.averageGCTime > 50) {
      this.suggestGCOptimization();
    }
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.collectMemorySnapshot();
      this.analyzeMemoryTrends();
      this.checkMemoryThresholds();
      
      if (this.config.enableLeakDetection) {
        this.detectMemoryLeaks();
      }
    }, this.config.monitoringInterval);

    // Take periodic snapshots
    this.snapshotInterval = setInterval(() => {
      this.takeDetailedSnapshot();
    }, this.config.snapshotInterval);
  }

  private collectMemorySnapshot(): void {
    const usage = process.memoryUsage();
    
    const snapshot: MemorySnapshot = {
      timestamp: new Date(),
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss,
      arrayBuffers: usage.arrayBuffers,
      gcCount: this.stats.gcStats.totalGCs,
      gcDuration: this.stats.gcStats.totalGCTime
    };

    this.snapshots.push(snapshot);
    
    // Keep only recent snapshots (last 1000)
    if (this.snapshots.length > 1000) {
      this.snapshots = this.snapshots.slice(-1000);
    }

    // Update current stats
    this.stats.currentUsage = usage;
    this.updatePeakUsage(usage);
    this.updateAverageUsage(usage);
  }

  private updatePeakUsage(usage: NodeJS.MemoryUsage): void {
    Object.keys(usage).forEach(key => {
      const typedKey = key as keyof NodeJS.MemoryUsage;
      if (usage[typedKey] > this.stats.peakUsage[typedKey]) {
        this.stats.peakUsage[typedKey] = usage[typedKey];
      }
    });
  }

  private updateAverageUsage(usage: NodeJS.MemoryUsage): void {
    const snapshotCount = this.snapshots.length;
    if (snapshotCount === 0) return;

    Object.keys(usage).forEach(key => {
      const typedKey = key as keyof NodeJS.MemoryUsage;
      this.stats.averageUsage[typedKey] = 
        (this.stats.averageUsage[typedKey] * (snapshotCount - 1) + usage[typedKey]) / snapshotCount;
    });
  }

  private analyzeMemoryTrends(): void {
    if (this.snapshots.length < 10) return;

    const recent = this.snapshots.slice(-10);
    const older = this.snapshots.slice(-20, -10);

    if (older.length === 0) return;

    const recentAvg = recent.reduce((sum, s) => sum + s.heapUsed, 0) / recent.length;
    const olderAvg = older.reduce((sum, s) => sum + s.heapUsed, 0) / older.length;

    const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100;

    if (Math.abs(changePercent) < 5) {
      this.stats.memoryTrend = 'stable';
    } else if (changePercent > 15) {
      this.stats.memoryTrend = 'increasing';
    } else if (changePercent < -15) {
      this.stats.memoryTrend = 'decreasing';
    } else {
      this.stats.memoryTrend = 'volatile';
    }

    // Calculate leak suspicion
    if (this.stats.memoryTrend === 'increasing') {
      this.stats.leakSuspicion = Math.min(100, this.stats.leakSuspicion + 10);
    } else if (this.stats.memoryTrend === 'stable' || this.stats.memoryTrend === 'decreasing') {
      this.stats.leakSuspicion = Math.max(0, this.stats.leakSuspicion - 5);
    }
  }

  private checkMemoryThresholds(): void {
    const heapUsedMB = this.stats.currentUsage.heapUsed / 1024 / 1024;
    const maxHeapMB = this.config.maxHeapUsage;

    // Check heap usage threshold
    if (heapUsedMB > maxHeapMB * (this.config.gcThreshold / 100)) {
      this.emit('memoryThresholdExceeded', {
        current: heapUsedMB,
        threshold: maxHeapMB * (this.config.gcThreshold / 100),
        percentage: (heapUsedMB / maxHeapMB) * 100
      });

      // Trigger GC if necessary
      if (this.config.enableGCOptimization && heapUsedMB > maxHeapMB * 0.8) {
        this.triggerGarbageCollection();
      }
    }

    // Check for memory leaks
    if (heapUsedMB > this.config.memoryLeakThreshold) {
      this.emit('memoryLeakSuspected', {
        heapUsed: heapUsedMB,
        threshold: this.config.memoryLeakThreshold,
        suspicionLevel: this.stats.leakSuspicion
      });
    }
  }

  private triggerGarbageCollection(): void {
    if (global.gc) {
      const beforeGC = process.memoryUsage();
      const startTime = Date.now();
      
      global.gc();
      
      const afterGC = process.memoryUsage();
      const duration = Date.now() - startTime;
      
      const freedMemory = beforeGC.heapUsed - afterGC.heapUsed;
      
      this.emit('gcTriggered', {
        duration,
        freedMemory: freedMemory / 1024 / 1024, // MB
        beforeGC,
        afterGC
      });
      
      console.log(`Manual GC completed: freed ${(freedMemory / 1024 / 1024).toFixed(2)}MB in ${duration}ms`);
    } else {
      console.warn('Garbage collection not available (run with --expose-gc)');
    }
  }

  private detectMemoryLeaks(): void {
    if (this.snapshots.length < 50) return;

    const recent = this.snapshots.slice(-10);
    const older = this.snapshots.slice(-50, -40);

    // Check for sustained memory growth
    const recentAvg = recent.reduce((sum, s) => sum + s.heapUsed, 0) / recent.length;
    const olderAvg = older.reduce((sum, s) => sum + s.heapUsed, 0) / older.length;
    
    const growthRate = (recentAvg - olderAvg) / olderAvg;

    if (growthRate > 0.1) { // 10% growth over time period
      const leak: MemoryLeak = {
        type: 'heap_growth',
        size: recentAvg - olderAvg,
        location: 'heap',
        detectedAt: new Date(),
        severity: this.categorizeSeverity(growthRate)
      };

      this.suspectedLeaks.push(leak);
      this.emit('memoryLeakDetected', leak);
    }

    // Check for object leaks
    this.detectObjectLeaks();
  }

  private detectObjectLeaks(): void {
    // This is a simplified implementation
    // In production, you'd use more sophisticated tools like memwatch-next
    
    const heapStats = this.getHeapStatistics();
    
    if (heapStats.used_heap_size > heapStats.heap_size_limit * 0.9) {
      const leak: MemoryLeak = {
        type: 'heap_limit_approach',
        size: heapStats.used_heap_size,
        location: 'heap',
        detectedAt: new Date(),
        severity: 'critical'
      };

      this.suspectedLeaks.push(leak);
      this.emit('memoryLeakDetected', leak);
    }
  }

  private categorizeSeverity(growthRate: number): 'low' | 'medium' | 'high' | 'critical' {
    if (growthRate > 0.5) return 'critical';
    if (growthRate > 0.3) return 'high';
    if (growthRate > 0.2) return 'medium';
    return 'low';
  }

  private getHeapStatistics(): any {
    try {
      const v8 = require('v8');
      return v8.getHeapStatistics();
    } catch {
      return {
        used_heap_size: this.stats.currentUsage.heapUsed,
        heap_size_limit: this.config.maxHeapUsage * 1024 * 1024
      };
    }
  }

  private suggestGCOptimization(): void {
    const suggestions = [];

    if (this.stats.gcStats.averageGCTime > 100) {
      suggestions.push('Consider reducing object allocation frequency');
    }

    if (this.stats.gcStats.totalGCs > 1000) {
      suggestions.push('High GC frequency detected - optimize memory usage patterns');
    }

    if (this.stats.currentUsage.heapUsed > this.stats.currentUsage.heapTotal * 0.8) {
      suggestions.push('Heap utilization is high - consider increasing heap size');
    }

    this.emit('optimizationSuggestion', {
      type: 'gc',
      suggestions,
      stats: this.stats.gcStats
    });
  }

  private startProfiling(): void {
    // Track object allocations and references
    this.setupAllocationTracking();
  }

  private setupAllocationTracking(): void {
    // This would integrate with profiling tools in production
    // Simplified implementation for demonstration
    
    const originalSetTimeout = global.setTimeout;
    global.setTimeout = (...args) => {
      this.trackAllocation('setTimeout', 1);
      return originalSetTimeout.apply(global, args);
    };

    const originalSetInterval = global.setInterval;
    global.setInterval = (...args) => {
      this.trackAllocation('setInterval', 1);
      return originalSetInterval.apply(global, args);
    };
  }

  private trackAllocation(type: string, size: number): void {
    const current = this.allocationTracker.get(type) || 0;
    this.allocationTracker.set(type, current + size);
  }

  private takeDetailedSnapshot(): void {
    try {
      const v8 = require('v8');
      const heapSnapshot = v8.writeHeapSnapshot();
      
      this.emit('heapSnapshotTaken', {
        filename: heapSnapshot,
        timestamp: new Date(),
        heapUsed: this.stats.currentUsage.heapUsed
      });
    } catch (error) {
      console.warn('Could not take heap snapshot:', error);
    }
  }

  optimizeMemoryUsage(): {
    actions: string[];
    estimatedSavings: number;
    recommendations: string[];
  } {
    const actions: string[] = [];
    const recommendations: string[] = [];
    let estimatedSavings = 0;

    // Check for immediate optimizations
    if (this.stats.currentUsage.heapUsed > this.config.maxHeapUsage * 1024 * 1024 * 0.7) {
      actions.push('Trigger garbage collection');
      estimatedSavings += this.stats.currentUsage.heapUsed * 0.1; // Estimate 10% savings
    }

    // Analyze allocation patterns
    const topAllocators = Array.from(this.allocationTracker.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);

    topAllocators.forEach(([type, count]) => {
      if (count > 100) {
        recommendations.push(`High allocation count for ${type}: ${count} - consider optimization`);
      }
    });

    // Check memory trend
    if (this.stats.memoryTrend === 'increasing') {
      recommendations.push('Memory usage is increasing - investigate potential leaks');
    }

    if (this.stats.leakSuspicion > 50) {
      recommendations.push('High memory leak suspicion - perform detailed analysis');
    }

    return {
      actions,
      estimatedSavings,
      recommendations
    };
  }

  getMemoryStats(): MemoryStats {
    return { ...this.stats };
  }

  getMemorySnapshots(count?: number): MemorySnapshot[] {
    return count ? this.snapshots.slice(-count) : [...this.snapshots];
  }

  getSuspectedLeaks(): MemoryLeak[] {
    return [...this.suspectedLeaks];
  }

  getAllocationStats(): Array<{type: string, count: number}> {
    return Array.from(this.allocationTracker.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }

  generateMemoryReport(): {
    summary: {
      currentHeapMB: number;
      peakHeapMB: number;
      utilizationPercent: number;
      gcEfficiency: number;
    };
    trends: {
      memoryTrend: string;
      leakSuspicion: number;
      averageGrowthRate: number;
    };
    recommendations: string[];
    criticalIssues: string[];
  } {
    const heapUsedMB = this.stats.currentUsage.heapUsed / 1024 / 1024;
    const peakHeapMB = this.stats.peakUsage.heapUsed / 1024 / 1024;
    const utilizationPercent = (heapUsedMB / this.config.maxHeapUsage) * 100;
    
    const gcEfficiency = this.stats.gcStats.totalGCs > 0 ? 
      (this.stats.gcStats.totalGCTime / this.stats.gcStats.totalGCs) : 0;

    const recommendations: string[] = [];
    const criticalIssues: string[] = [];

    // Generate recommendations
    if (utilizationPercent > 80) {
      criticalIssues.push('Memory utilization is critically high');
      recommendations.push('Increase heap size or optimize memory usage');
    }

    if (this.stats.leakSuspicion > 70) {
      criticalIssues.push('High probability of memory leak');
      recommendations.push('Perform detailed memory leak analysis');
    }

    if (gcEfficiency > 100) {
      recommendations.push('GC is taking too long - optimize object lifecycle');
    }

    if (this.stats.memoryTrend === 'increasing') {
      recommendations.push('Memory usage is consistently increasing - investigate root cause');
    }

    // Calculate average growth rate
    let averageGrowthRate = 0;
    if (this.snapshots.length > 20) {
      const recent = this.snapshots.slice(-10);
      const older = this.snapshots.slice(-20, -10);
      
      const recentAvg = recent.reduce((sum, s) => sum + s.heapUsed, 0) / recent.length;
      const olderAvg = older.reduce((sum, s) => sum + s.heapUsed, 0) / older.length;
      
      averageGrowthRate = ((recentAvg - olderAvg) / olderAvg) * 100;
    }

    return {
      summary: {
        currentHeapMB: heapUsedMB,
        peakHeapMB,
        utilizationPercent,
        gcEfficiency
      },
      trends: {
        memoryTrend: this.stats.memoryTrend,
        leakSuspicion: this.stats.leakSuspicion,
        averageGrowthRate
      },
      recommendations,
      criticalIssues
    };
  }

  clearSuspectedLeaks(): void {
    this.suspectedLeaks = [];
  }

  resetStats(): void {
    this.snapshots = [];
    this.stats = this.initializeStats();
    this.suspectedLeaks = [];
    this.allocationTracker.clear();
  }

  shutdown(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
    }

    if (this.gcObserver) {
      this.gcObserver.disconnect();
    }

    console.log('Memory usage optimizer shutdown complete');
  }
}

// Predefined memory configurations
export const MemoryPresets = {
  development: {
    maxHeapUsage: 512, // 512MB
    gcThreshold: 70,
    memoryLeakThreshold: 256,
    monitoringInterval: 5000,
    enableGCOptimization: true,
    enableMemoryProfiling: true,
    enableLeakDetection: true,
    snapshotInterval: 60000
  },

  production: {
    maxHeapUsage: 2048, // 2GB
    gcThreshold: 80,
    memoryLeakThreshold: 1024,
    monitoringInterval: 10000,
    enableGCOptimization: true,
    enableMemoryProfiling: false,
    enableLeakDetection: true,
    snapshotInterval: 300000
  },

  highMemory: {
    maxHeapUsage: 8192, // 8GB
    gcThreshold: 85,
    memoryLeakThreshold: 4096,
    monitoringInterval: 15000,
    enableGCOptimization: true,
    enableMemoryProfiling: false,
    enableLeakDetection: true,
    snapshotInterval: 600000
  }
};
