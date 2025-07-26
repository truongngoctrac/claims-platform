import { performance } from 'perf_hooks';
import { Request, Response, NextFunction } from 'express';

export interface ResponseTimeMetrics {
  endpoint: string;
  method: string;
  duration: number;
  timestamp: Date;
  statusCode: number;
  responseSize: number;
  userAgent?: string;
  ip?: string;
}

export interface ResponseTimeConfig {
  maxResponseTime: number;
  slowQueryThreshold: number;
  alertThreshold: number;
  enableDetailedLogging: boolean;
}

export class ResponseTimeOptimizer {
  private metrics: ResponseTimeMetrics[] = [];
  private config: ResponseTimeConfig;
  private slowQueries: Map<string, number> = new Map();

  constructor(config: ResponseTimeConfig) {
    this.config = config;
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = performance.now();
      const startMemory = process.memoryUsage();

      res.on('finish', () => {
        const endTime = performance.now();
        const duration = endTime - startTime;
        const endMemory = process.memoryUsage();
        
        const metric: ResponseTimeMetrics = {
          endpoint: req.path,
          method: req.method,
          duration,
          timestamp: new Date(),
          statusCode: res.statusCode,
          responseSize: parseInt(res.get('content-length') || '0'),
          userAgent: req.get('user-agent'),
          ip: req.ip
        };

        this.recordMetric(metric);
        this.checkPerformanceThresholds(metric);
        this.optimizeSlowEndpoints(metric);
        this.trackMemoryUsage(startMemory, endMemory, req.path);
      });

      next();
    };
  }

  private recordMetric(metric: ResponseTimeMetrics): void {
    this.metrics.push(metric);
    
    // Keep only recent metrics (last 1000 requests)
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }

    if (this.config.enableDetailedLogging) {
      console.log(`API Response Time: ${metric.method} ${metric.endpoint} - ${metric.duration.toFixed(2)}ms`);
    }
  }

  private checkPerformanceThresholds(metric: ResponseTimeMetrics): void {
    if (metric.duration > this.config.alertThreshold) {
      console.warn(`PERFORMANCE ALERT: ${metric.method} ${metric.endpoint} took ${metric.duration.toFixed(2)}ms`);
      this.triggerPerformanceAlert(metric);
    }

    if (metric.duration > this.config.slowQueryThreshold) {
      const key = `${metric.method}:${metric.endpoint}`;
      const count = this.slowQueries.get(key) || 0;
      this.slowQueries.set(key, count + 1);
    }
  }

  private optimizeSlowEndpoints(metric: ResponseTimeMetrics): void {
    const key = `${metric.method}:${metric.endpoint}`;
    const slowCount = this.slowQueries.get(key) || 0;

    if (slowCount > 5) {
      console.log(`Optimizing slow endpoint: ${key} (${slowCount} slow requests)`);
      this.implementOptimizations(metric);
    }
  }

  private implementOptimizations(metric: ResponseTimeMetrics): void {
    // Suggest caching for GET requests
    if (metric.method === 'GET' && metric.duration > this.config.slowQueryThreshold) {
      console.log(`Suggestion: Enable caching for ${metric.endpoint}`);
    }

    // Suggest pagination for large responses
    if (metric.responseSize > 1024 * 1024) { // 1MB
      console.log(`Suggestion: Implement pagination for ${metric.endpoint}`);
    }

    // Suggest database optimization
    if (metric.duration > this.config.maxResponseTime) {
      console.log(`Suggestion: Optimize database queries for ${metric.endpoint}`);
    }
  }

  private trackMemoryUsage(startMemory: NodeJS.MemoryUsage, endMemory: NodeJS.MemoryUsage, endpoint: string): void {
    const memoryDiff = {
      rss: endMemory.rss - startMemory.rss,
      heapUsed: endMemory.heapUsed - startMemory.heapUsed,
      heapTotal: endMemory.heapTotal - startMemory.heapTotal,
      external: endMemory.external - startMemory.external
    };

    if (memoryDiff.heapUsed > 10 * 1024 * 1024) { // 10MB
      console.warn(`High memory usage detected for ${endpoint}: ${(memoryDiff.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    }
  }

  private triggerPerformanceAlert(metric: ResponseTimeMetrics): void {
    // Implement alerting system (email, webhook, etc.)
    const alert = {
      type: 'PERFORMANCE_ALERT',
      severity: 'HIGH',
      message: `Slow API response detected`,
      details: metric,
      timestamp: new Date()
    };

    // Send to monitoring system
    this.sendToMonitoring(alert);
  }

  private sendToMonitoring(alert: any): void {
    // Implementation for sending alerts to monitoring systems
    console.log('Alert sent to monitoring system:', alert);
  }

  getMetrics(): ResponseTimeMetrics[] {
    return [...this.metrics];
  }

  getAverageResponseTime(endpoint?: string): number {
    let filteredMetrics = this.metrics;
    
    if (endpoint) {
      filteredMetrics = this.metrics.filter(m => m.endpoint === endpoint);
    }

    if (filteredMetrics.length === 0) return 0;

    const totalTime = filteredMetrics.reduce((sum, metric) => sum + metric.duration, 0);
    return totalTime / filteredMetrics.length;
  }

  getPercentileResponseTime(percentile: number, endpoint?: string): number {
    let filteredMetrics = this.metrics;
    
    if (endpoint) {
      filteredMetrics = this.metrics.filter(m => m.endpoint === endpoint);
    }

    if (filteredMetrics.length === 0) return 0;

    const sorted = filteredMetrics.map(m => m.duration).sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  getSlowestEndpoints(limit: number = 10): Array<{endpoint: string, averageTime: number}> {
    const endpointStats = new Map<string, {total: number, count: number}>();

    this.metrics.forEach(metric => {
      const key = `${metric.method} ${metric.endpoint}`;
      const current = endpointStats.get(key) || {total: 0, count: 0};
      endpointStats.set(key, {
        total: current.total + metric.duration,
        count: current.count + 1
      });
    });

    return Array.from(endpointStats.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        averageTime: stats.total / stats.count
      }))
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, limit);
  }

  generatePerformanceReport(): {
    totalRequests: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    slowestEndpoints: Array<{endpoint: string, averageTime: number}>;
    errorRate: number;
  } {
    const totalRequests = this.metrics.length;
    const errorCount = this.metrics.filter(m => m.statusCode >= 400).length;

    return {
      totalRequests,
      averageResponseTime: this.getAverageResponseTime(),
      p95ResponseTime: this.getPercentileResponseTime(95),
      p99ResponseTime: this.getPercentileResponseTime(99),
      slowestEndpoints: this.getSlowestEndpoints(5),
      errorRate: totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0
    };
  }

  clearMetrics(): void {
    this.metrics = [];
    this.slowQueries.clear();
  }

  exportMetrics(): string {
    return JSON.stringify({
      metrics: this.metrics,
      config: this.config,
      report: this.generatePerformanceReport(),
      timestamp: new Date()
    }, null, 2);
  }
}
