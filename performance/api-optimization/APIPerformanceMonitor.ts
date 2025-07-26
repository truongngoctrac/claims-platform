import { EventEmitter } from 'events';
import { Request, Response } from 'express';

export interface MonitoringConfig {
  enableRealTimeMetrics: boolean;
  enableAlerting: boolean;
  enableProfiling: boolean;
  metricsRetentionDays: number;
  alertThresholds: AlertThresholds;
  samplingRate: number; // 0-1, percentage of requests to monitor
  enableDetailedTracing: boolean;
}

export interface AlertThresholds {
  responseTime: number; // ms
  errorRate: number; // percentage
  throughput: number; // requests per second
  cpuUsage: number; // percentage
  memoryUsage: number; // MB
  diskUsage: number; // percentage
}

export interface PerformanceMetric {
  timestamp: Date;
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  userId?: string;
  userAgent?: string;
  ip?: string;
  requestSize: number;
  responseSize: number;
  cpuUsage?: number;
  memoryUsage?: number;
  dbQueryTime?: number;
  cacheHit?: boolean;
  traceId?: string;
}

export interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
  };
  activeConnections: number;
  eventLoopLag: number;
}

export interface Alert {
  id: string;
  type: 'performance' | 'error' | 'system' | 'security';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: any;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface PerformanceReport {
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalRequests: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    errorRate: number;
    throughput: number;
  };
  endpoints: Array<{
    endpoint: string;
    requests: number;
    averageTime: number;
    errorRate: number;
  }>;
  trends: {
    responseTimeTrend: string;
    throughputTrend: string;
    errorTrend: string;
  };
  alerts: Alert[];
  recommendations: string[];
}

export class APIPerformanceMonitor extends EventEmitter {
  private config: MonitoringConfig;
  private metrics: PerformanceMetric[] = [];
  private systemMetrics: SystemMetrics[] = [];
  private alerts: Alert[] = [];
  private activeTraces: Map<string, any> = new Map();
  private endpointStats: Map<string, any> = new Map();
  private monitoringInterval: NodeJS.Timeout;
  private alertCheckInterval: NodeJS.Timeout;

  constructor(config: MonitoringConfig) {
    super();
    this.config = config;
    this.startSystemMonitoring();
    this.startAlertChecking();
  }

  middleware() {
    return (req: Request, res: Response, next: any) => {
      // Sampling check
      if (Math.random() > this.config.samplingRate) {
        return next();
      }

      const startTime = Date.now();
      const startMemory = process.memoryUsage();
      const startCpu = process.cpuUsage();
      const traceId = this.generateTraceId();

      // Store trace information
      if (this.config.enableDetailedTracing) {
        this.startTrace(traceId, req);
      }

      // Override res.end to capture metrics
      const originalEnd = res.end.bind(res);
      res.end = function(chunk?: any, encoding?: any): Response {
        const endTime = Date.now();
        const endMemory = process.memoryUsage();
        const endCpu = process.cpuUsage(startCpu);

        const metric: PerformanceMetric = {
          timestamp: new Date(startTime),
          endpoint: req.path,
          method: req.method,
          responseTime: endTime - startTime,
          statusCode: res.statusCode,
          userId: req.headers['x-user-id'] as string,
          userAgent: req.get('user-agent'),
          ip: req.ip,
          requestSize: parseInt(req.get('content-length') || '0'),
          responseSize: parseInt(res.get('content-length') || '0'),
          cpuUsage: (endCpu.user + endCpu.system) / 1000 / 1000, // Convert to ms
          memoryUsage: endMemory.heapUsed - startMemory.heapUsed,
          traceId
        };

        this.recordMetric(metric);

        if (this.config.enableDetailedTracing) {
          this.endTrace(traceId, metric);
        }

        return originalEnd(chunk, encoding);
      }.bind(this);

      next();
    };
  }

  private recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    // Keep only recent metrics based on retention policy
    const retentionMs = this.config.metricsRetentionDays * 24 * 60 * 60 * 1000;
    const cutoffTime = new Date(Date.now() - retentionMs);
    this.metrics = this.metrics.filter(m => m.timestamp > cutoffTime);

    // Update endpoint statistics
    this.updateEndpointStats(metric);

    // Emit real-time metric if enabled
    if (this.config.enableRealTimeMetrics) {
      this.emit('metricRecorded', metric);
    }

    // Check for immediate alerts
    this.checkMetricAlerts(metric);
  }

  private updateEndpointStats(metric: PerformanceMetric): void {
    const key = `${metric.method} ${metric.endpoint}`;
    const stats = this.endpointStats.get(key) || {
      count: 0,
      totalTime: 0,
      errors: 0,
      lastSeen: new Date()
    };

    stats.count++;
    stats.totalTime += metric.responseTime;
    stats.lastSeen = metric.timestamp;
    
    if (metric.statusCode >= 400) {
      stats.errors++;
    }

    this.endpointStats.set(key, stats);
  }

  private checkMetricAlerts(metric: PerformanceMetric): void {
    if (!this.config.enableAlerting) return;

    const thresholds = this.config.alertThresholds;

    // Response time alert
    if (metric.responseTime > thresholds.responseTime) {
      this.createAlert('performance', 'high', 
        `Slow response time: ${metric.responseTime}ms for ${metric.method} ${metric.endpoint}`,
        { metric, threshold: thresholds.responseTime }
      );
    }

    // Error rate alert (check recent errors)
    const recentMetrics = this.getRecentMetrics(300000); // Last 5 minutes
    const errorRate = this.calculateErrorRate(recentMetrics);
    
    if (errorRate > thresholds.errorRate) {
      this.createAlert('error', 'high',
        `High error rate: ${errorRate.toFixed(2)}%`,
        { errorRate, threshold: thresholds.errorRate }
      );
    }
  }

  private startSystemMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 10000); // Every 10 seconds
  }

  private collectSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const systemMetric: SystemMetrics = {
      timestamp: new Date(),
      cpu: {
        usage: this.calculateCPUUsage(cpuUsage),
        loadAverage: this.getLoadAverage()
      },
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
      },
      disk: this.getDiskUsage(),
      network: this.getNetworkStats(),
      activeConnections: this.getActiveConnections(),
      eventLoopLag: this.measureEventLoopLag()
    };

    this.systemMetrics.push(systemMetric);
    
    // Keep only recent system metrics
    if (this.systemMetrics.length > 1000) {
      this.systemMetrics = this.systemMetrics.slice(-1000);
    }

    this.checkSystemAlerts(systemMetric);
    
    if (this.config.enableRealTimeMetrics) {
      this.emit('systemMetric', systemMetric);
    }
  }

  private calculateCPUUsage(cpuUsage: NodeJS.CpuUsage): number {
    // Simplified CPU usage calculation
    const totalTime = cpuUsage.user + cpuUsage.system;
    return (totalTime / 1000000) * 100; // Convert microseconds to percentage
  }

  private getLoadAverage(): number[] {
    try {
      const os = require('os');
      return os.loadavg();
    } catch {
      return [0, 0, 0];
    }
  }

  private getDiskUsage(): { used: number; total: number; percentage: number } {
    // Simplified disk usage - in production use proper system calls
    try {
      const fs = require('fs');
      const stats = fs.statSync('.');
      return {
        used: stats.size || 0,
        total: 1024 * 1024 * 1024, // 1GB placeholder
        percentage: 50 // Placeholder
      };
    } catch {
      return { used: 0, total: 0, percentage: 0 };
    }
  }

  private getNetworkStats(): { bytesIn: number; bytesOut: number } {
    // Placeholder - in production, use system network stats
    return {
      bytesIn: Math.random() * 1000000,
      bytesOut: Math.random() * 1000000
    };
  }

  private getActiveConnections(): number {
    // Placeholder - in production, track actual connections
    return Math.floor(Math.random() * 100);
  }

  private measureEventLoopLag(): number {
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
      return lag;
    });
    return 0; // Simplified for this implementation
  }

  private checkSystemAlerts(metric: SystemMetrics): void {
    if (!this.config.enableAlerting) return;

    const thresholds = this.config.alertThresholds;

    // CPU alert
    if (metric.cpu.usage > thresholds.cpuUsage) {
      this.createAlert('system', 'high',
        `High CPU usage: ${metric.cpu.usage.toFixed(2)}%`,
        { metric, threshold: thresholds.cpuUsage }
      );
    }

    // Memory alert
    if (metric.memory.used / 1024 / 1024 > thresholds.memoryUsage) {
      this.createAlert('system', 'high',
        `High memory usage: ${(metric.memory.used / 1024 / 1024).toFixed(2)}MB`,
        { metric, threshold: thresholds.memoryUsage }
      );
    }

    // Disk alert
    if (metric.disk.percentage > thresholds.diskUsage) {
      this.createAlert('system', 'medium',
        `High disk usage: ${metric.disk.percentage.toFixed(2)}%`,
        { metric, threshold: thresholds.diskUsage }
      );
    }
  }

  private startAlertChecking(): void {
    this.alertCheckInterval = setInterval(() => {
      this.checkAggregatedAlerts();
    }, 60000); // Every minute
  }

  private checkAggregatedAlerts(): void {
    const recentMetrics = this.getRecentMetrics(300000); // Last 5 minutes
    
    if (recentMetrics.length === 0) return;

    // Check throughput
    const throughput = recentMetrics.length / 5; // per second over 5 minutes
    if (throughput < this.config.alertThresholds.throughput) {
      this.createAlert('performance', 'medium',
        `Low throughput: ${throughput.toFixed(2)} req/s`,
        { throughput, threshold: this.config.alertThresholds.throughput }
      );
    }
  }

  private createAlert(type: Alert['type'], severity: Alert['severity'], message: string, details: any): void {
    const alert: Alert = {
      id: this.generateAlertId(),
      type,
      severity,
      message,
      details,
      timestamp: new Date(),
      resolved: false
    };

    this.alerts.push(alert);
    
    // Keep only recent alerts
    if (this.alerts.length > 500) {
      this.alerts = this.alerts.slice(-500);
    }

    this.emit('alert', alert);
    
    // Log critical alerts
    if (severity === 'critical' || severity === 'high') {
      console.warn(`ALERT [${severity.toUpperCase()}]: ${message}`);
    }
  }

  private startTrace(traceId: string, req: Request): void {
    this.activeTraces.set(traceId, {
      startTime: Date.now(),
      request: {
        method: req.method,
        url: req.url,
        headers: req.headers,
        params: req.params,
        query: req.query
      },
      spans: []
    });
  }

  private endTrace(traceId: string, metric: PerformanceMetric): void {
    const trace = this.activeTraces.get(traceId);
    if (trace) {
      trace.endTime = Date.now();
      trace.duration = trace.endTime - trace.startTime;
      trace.metric = metric;
      
      this.emit('traceCompleted', trace);
      this.activeTraces.delete(traceId);
    }
  }

  addSpanToTrace(traceId: string, spanName: string, duration: number, details?: any): void {
    const trace = this.activeTraces.get(traceId);
    if (trace) {
      trace.spans.push({
        name: spanName,
        duration,
        details,
        timestamp: new Date()
      });
    }
  }

  getRecentMetrics(timeWindow: number): PerformanceMetric[] {
    const cutoff = new Date(Date.now() - timeWindow);
    return this.metrics.filter(m => m.timestamp > cutoff);
  }

  calculateErrorRate(metrics: PerformanceMetric[]): number {
    if (metrics.length === 0) return 0;
    
    const errorCount = metrics.filter(m => m.statusCode >= 400).length;
    return (errorCount / metrics.length) * 100;
  }

  getPerformanceReport(startTime: Date, endTime: Date): PerformanceReport {
    const metrics = this.metrics.filter(m => 
      m.timestamp >= startTime && m.timestamp <= endTime
    );

    const totalRequests = metrics.length;
    const averageResponseTime = totalRequests > 0 ?
      metrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests : 0;

    const sortedTimes = metrics.map(m => m.responseTime).sort((a, b) => a - b);
    const p95ResponseTime = this.getPercentile(sortedTimes, 95);
    const p99ResponseTime = this.getPercentile(sortedTimes, 99);

    const errorRate = this.calculateErrorRate(metrics);
    const throughput = totalRequests / ((endTime.getTime() - startTime.getTime()) / 1000);

    // Endpoint statistics
    const endpointMap = new Map<string, any>();
    metrics.forEach(m => {
      const key = `${m.method} ${m.endpoint}`;
      const stats = endpointMap.get(key) || {
        endpoint: key,
        requests: 0,
        totalTime: 0,
        errors: 0
      };
      
      stats.requests++;
      stats.totalTime += m.responseTime;
      if (m.statusCode >= 400) stats.errors++;
      
      endpointMap.set(key, stats);
    });

    const endpoints = Array.from(endpointMap.values()).map(stats => ({
      endpoint: stats.endpoint,
      requests: stats.requests,
      averageTime: stats.totalTime / stats.requests,
      errorRate: (stats.errors / stats.requests) * 100
    }));

    // Calculate trends
    const trends = this.calculateTrends(metrics);

    // Get alerts for the period
    const periodAlerts = this.alerts.filter(a =>
      a.timestamp >= startTime && a.timestamp <= endTime
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(metrics, endpoints);

    return {
      period: { start: startTime, end: endTime },
      summary: {
        totalRequests,
        averageResponseTime,
        p95ResponseTime,
        p99ResponseTime,
        errorRate,
        throughput
      },
      endpoints,
      trends,
      alerts: periodAlerts,
      recommendations
    };
  }

  private getPercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[index] || 0;
  }

  private calculateTrends(metrics: PerformanceMetric[]): any {
    // Simple trend calculation - compare first half vs second half
    const midpoint = Math.floor(metrics.length / 2);
    const firstHalf = metrics.slice(0, midpoint);
    const secondHalf = metrics.slice(midpoint);

    const firstAvgTime = firstHalf.length > 0 ?
      firstHalf.reduce((sum, m) => sum + m.responseTime, 0) / firstHalf.length : 0;
    const secondAvgTime = secondHalf.length > 0 ?
      secondHalf.reduce((sum, m) => sum + m.responseTime, 0) / secondHalf.length : 0;

    const firstThroughput = firstHalf.length;
    const secondThroughput = secondHalf.length;

    const firstErrorRate = this.calculateErrorRate(firstHalf);
    const secondErrorRate = this.calculateErrorRate(secondHalf);

    return {
      responseTimeTrend: this.getTrend(firstAvgTime, secondAvgTime),
      throughputTrend: this.getTrend(firstThroughput, secondThroughput),
      errorTrend: this.getTrend(firstErrorRate, secondErrorRate)
    };
  }

  private getTrend(first: number, second: number): string {
    if (first === 0 && second === 0) return 'stable';
    if (first === 0) return 'increasing';
    
    const change = ((second - first) / first) * 100;
    
    if (change > 10) return 'increasing';
    if (change < -10) return 'decreasing';
    return 'stable';
  }

  private generateRecommendations(metrics: PerformanceMetric[], endpoints: any[]): string[] {
    const recommendations: string[] = [];

    // Slow endpoint recommendations
    const slowEndpoints = endpoints.filter(e => e.averageTime > 1000);
    if (slowEndpoints.length > 0) {
      recommendations.push(`Optimize slow endpoints: ${slowEndpoints.map(e => e.endpoint).join(', ')}`);
    }

    // High error rate recommendations
    const errorEndpoints = endpoints.filter(e => e.errorRate > 5);
    if (errorEndpoints.length > 0) {
      recommendations.push(`Investigate high error rates in: ${errorEndpoints.map(e => e.endpoint).join(', ')}`);
    }

    // Memory usage recommendations
    const avgMemoryUsage = metrics.reduce((sum, m) => sum + (m.memoryUsage || 0), 0) / metrics.length;
    if (avgMemoryUsage > 50 * 1024 * 1024) { // 50MB
      recommendations.push('High memory usage detected - consider memory optimization');
    }

    // Response time distribution
    const slowRequests = metrics.filter(m => m.responseTime > 2000).length;
    const slowRequestPercentage = (slowRequests / metrics.length) * 100;
    if (slowRequestPercentage > 5) {
      recommendations.push('High percentage of slow requests - investigate performance bottlenecks');
    }

    return recommendations;
  }

  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      this.emit('alertResolved', alert);
    }
  }

  getActiveAlerts(): Alert[] {
    return this.alerts.filter(a => !a.resolved);
  }

  getMetricsSummary(): {
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    throughput: number;
    activeAlerts: number;
  } {
    const recentMetrics = this.getRecentMetrics(3600000); // Last hour
    
    return {
      totalRequests: recentMetrics.length,
      averageResponseTime: recentMetrics.length > 0 ?
        recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length : 0,
      errorRate: this.calculateErrorRate(recentMetrics),
      throughput: recentMetrics.length / 3600, // per second over last hour
      activeAlerts: this.getActiveAlerts().length
    };
  }

  exportMetrics(): string {
    return JSON.stringify({
      config: this.config,
      metrics: this.metrics,
      systemMetrics: this.systemMetrics,
      alerts: this.alerts,
      endpointStats: Array.from(this.endpointStats.entries()),
      exportedAt: new Date()
    }, null, 2);
  }

  private generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  shutdown(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
    }

    this.activeTraces.clear();
    console.log('API performance monitor shutdown complete');
  }
}

// Predefined monitoring configurations
export const MonitoringPresets = {
  development: {
    enableRealTimeMetrics: true,
    enableAlerting: false,
    enableProfiling: true,
    metricsRetentionDays: 1,
    alertThresholds: {
      responseTime: 5000,
      errorRate: 10,
      throughput: 1,
      cpuUsage: 80,
      memoryUsage: 512,
      diskUsage: 85
    },
    samplingRate: 1.0,
    enableDetailedTracing: true
  },

  production: {
    enableRealTimeMetrics: true,
    enableAlerting: true,
    enableProfiling: false,
    metricsRetentionDays: 7,
    alertThresholds: {
      responseTime: 2000,
      errorRate: 5,
      throughput: 10,
      cpuUsage: 75,
      memoryUsage: 1024,
      diskUsage: 80
    },
    samplingRate: 0.1,
    enableDetailedTracing: false
  },

  strict: {
    enableRealTimeMetrics: true,
    enableAlerting: true,
    enableProfiling: true,
    metricsRetentionDays: 30,
    alertThresholds: {
      responseTime: 1000,
      errorRate: 2,
      throughput: 50,
      cpuUsage: 60,
      memoryUsage: 512,
      diskUsage: 70
    },
    samplingRate: 0.5,
    enableDetailedTracing: true
  }
};
