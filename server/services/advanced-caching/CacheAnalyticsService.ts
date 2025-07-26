import { EventEmitter } from 'events';
import { MultiLevelCacheManager } from './MultiLevelCacheManager';
import { RedisClusterManager } from './RedisClusterManager';
import { CacheInvalidationManager } from './CacheInvalidationManager';
import { CacheWarmingManager } from './CacheWarmingManager';

export interface CacheMetrics {
  timestamp: Date;
  level: string;
  operation: string;
  key: string;
  hit: boolean;
  latency: number;
  size?: number;
  ttl?: number;
  tags?: string[];
}

export interface AggregatedMetrics {
  timeRange: { start: Date; end: Date };
  totalOperations: number;
  hitRate: number;
  missRate: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  operationsPerSecond: number;
  errorRate: number;
  memoryUsage: number;
  keyCount: number;
  levelBreakdown: Map<string, LevelMetrics>;
  topKeys: Array<{ key: string; hits: number; misses: number }>;
  errorsByType: Map<string, number>;
}

export interface LevelMetrics {
  level: string;
  hitRate: number;
  missRate: number;
  averageLatency: number;
  keyCount: number;
  memoryUsage: number;
  evictions: number;
  operationsPerSecond: number;
}

export interface PerformanceAlert {
  id: string;
  type: 'hit_rate_low' | 'latency_high' | 'memory_full' | 'error_rate_high' | 'node_down';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  acknowledged: boolean;
  resolvedAt?: Date;
  metadata?: any;
}

export interface CacheTrend {
  metric: string;
  timePoints: Array<{ timestamp: Date; value: number }>;
  trend: 'increasing' | 'decreasing' | 'stable';
  slope: number;
  correlation: number;
  forecast: Array<{ timestamp: Date; value: number; confidence: number }>;
}

export interface HotspotAnalysis {
  timeWindow: { start: Date; end: Date };
  hotKeys: Array<{
    key: string;
    accessCount: number;
    hitRate: number;
    avgLatency: number;
    memoryUsage: number;
    lastAccessed: Date;
  }>;
  coldKeys: Array<{
    key: string;
    lastAccessed: Date;
    memoryUsage: number;
    ttl: number;
  }>;
  patterns: Array<{
    pattern: string;
    frequency: number;
    performance: number;
  }>;
}

export interface CacheEfficiencyReport {
  overall: {
    efficiency: number; // 0-100 score
    recommendations: string[];
    potentialSavings: number;
  };
  levels: Map<string, {
    efficiency: number;
    utilizationRate: number;
    hitRateOptimal: boolean;
    recommendations: string[];
  }>;
  keyAnalysis: {
    duplicateKeys: string[];
    unusedKeys: string[];
    oversizedKeys: Array<{ key: string; size: number; recommendation: string }>;
  };
  timingAnalysis: {
    peakHours: Array<{ hour: number; load: number }>;
    lowUtilizationPeriods: Array<{ start: Date; end: Date }>;
  };
}

export class CacheAnalyticsService extends EventEmitter {
  private cacheManager: MultiLevelCacheManager;
  private redisCluster: RedisClusterManager | null;
  private invalidationManager: CacheInvalidationManager | null;
  private warmingManager: CacheWarmingManager | null;
  private metrics: CacheMetrics[] = [];
  private aggregatedMetrics: Map<string, AggregatedMetrics> = new Map();
  private alerts: Map<string, PerformanceAlert> = new Map();
  private trends: Map<string, CacheTrend> = new Map();
  private alertThresholds: Map<string, any> = new Map();
  private retentionDays = 30;
  private metricsBuffer: CacheMetrics[] = [];
  private bufferFlushInterval = 10000; // 10 seconds
  private aggregationInterval = 60000; // 1 minute

  constructor(
    cacheManager: MultiLevelCacheManager,
    redisCluster?: RedisClusterManager,
    invalidationManager?: CacheInvalidationManager,
    warmingManager?: CacheWarmingManager
  ) {
    super();
    this.cacheManager = cacheManager;
    this.redisCluster = redisCluster || null;
    this.invalidationManager = invalidationManager || null;
    this.warmingManager = warmingManager || null;

    this.setupDefaultAlertThresholds();
    this.setupEventListeners();
    this.startMetricsCollection();
    this.startAggregation();
    this.startCleanup();
  }

  private setupDefaultAlertThresholds(): void {
    this.alertThresholds.set('hit_rate_low', { threshold: 80, severity: 'medium' });
    this.alertThresholds.set('latency_high', { threshold: 100, severity: 'high' });
    this.alertThresholds.set('memory_full', { threshold: 90, severity: 'critical' });
    this.alertThresholds.set('error_rate_high', { threshold: 5, severity: 'high' });
    this.alertThresholds.set('eviction_rate_high', { threshold: 10, severity: 'medium' });
  }

  private setupEventListeners(): void {
    // Cache Manager Events
    this.cacheManager.on('cache-get', (event) => {
      this.recordMetric({
        timestamp: new Date(),
        level: event.level || 'unknown',
        operation: 'get',
        key: event.key,
        hit: event.hit,
        latency: event.latency || 0,
      });
    });

    this.cacheManager.on('cache-set', (event) => {
      this.recordMetric({
        timestamp: new Date(),
        level: event.level || 'unknown',
        operation: 'set',
        key: event.key,
        hit: true,
        latency: event.latency || 0,
        size: event.size,
        ttl: event.ttl,
      });
    });

    this.cacheManager.on('cache-delete', (event) => {
      this.recordMetric({
        timestamp: new Date(),
        level: event.level || 'unknown',
        operation: 'delete',
        key: event.key,
        hit: true,
        latency: event.latency || 0,
      });
    });

    this.cacheManager.on('cache-expired', (event) => {
      this.recordMetric({
        timestamp: new Date(),
        level: event.level || 'unknown',
        operation: 'expire',
        key: event.key,
        hit: false,
        latency: 0,
      });
    });

    // Redis Cluster Events
    if (this.redisCluster) {
      this.redisCluster.on('node-error', (event) => {
        this.createAlert('node_down', 'critical', `Node ${event.node} is down`, 1, 0, event);
      });

      this.redisCluster.on('cluster-unhealthy', (health) => {
        const healthScore = (health.nodesCount - health.failedNodes.length) / health.nodesCount * 100;
        if (healthScore < 80) {
          this.createAlert('cluster_health', 'high', `Cluster health at ${healthScore}%`, healthScore, 80);
        }
      });
    }

    // Invalidation Manager Events
    if (this.invalidationManager) {
      this.invalidationManager.on('invalidation-error', (event) => {
        this.recordMetric({
          timestamp: new Date(),
          level: 'all',
          operation: 'invalidate',
          key: event.key || 'unknown',
          hit: false,
          latency: 0,
        });
      });
    }
  }

  private recordMetric(metric: CacheMetrics): void {
    this.metricsBuffer.push(metric);
    
    if (this.metricsBuffer.length >= 1000) { // Flush buffer if it gets too large
      this.flushMetricsBuffer();
    }
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      this.flushMetricsBuffer();
    }, this.bufferFlushInterval);
  }

  private flushMetricsBuffer(): void {
    if (this.metricsBuffer.length === 0) return;

    this.metrics.push(...this.metricsBuffer);
    this.metricsBuffer = [];

    // Keep only metrics within retention period
    const cutoff = Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000);
    this.metrics = this.metrics.filter(m => m.timestamp.getTime() > cutoff);

    this.emit('metrics-flushed', { count: this.metricsBuffer.length });
  }

  private startAggregation(): void {
    setInterval(() => {
      this.aggregateMetrics();
      this.detectAnomalies();
      this.updateTrends();
    }, this.aggregationInterval);
  }

  private aggregateMetrics(): void {
    const now = new Date();
    const intervals = [
      { key: '1m', duration: 60 * 1000 },
      { key: '5m', duration: 5 * 60 * 1000 },
      { key: '1h', duration: 60 * 60 * 1000 },
      { key: '1d', duration: 24 * 60 * 60 * 1000 },
    ];

    for (const interval of intervals) {
      const start = new Date(now.getTime() - interval.duration);
      const intervalMetrics = this.metrics.filter(m => 
        m.timestamp >= start && m.timestamp <= now
      );

      if (intervalMetrics.length === 0) continue;

      const aggregated = this.calculateAggregatedMetrics(intervalMetrics, start, now);
      this.aggregatedMetrics.set(`${interval.key}_${now.getTime()}`, aggregated);

      // Check for alerts
      this.checkAlerts(aggregated);
    }

    // Cleanup old aggregated metrics
    const cutoff = Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000);
    for (const [key, metrics] of this.aggregatedMetrics) {
      if (metrics.timeRange.start.getTime() < cutoff) {
        this.aggregatedMetrics.delete(key);
      }
    }
  }

  private calculateAggregatedMetrics(metrics: CacheMetrics[], start: Date, end: Date): AggregatedMetrics {
    const totalOperations = metrics.length;
    const hits = metrics.filter(m => m.hit).length;
    const misses = totalOperations - hits;
    const hitRate = totalOperations > 0 ? (hits / totalOperations) * 100 : 0;
    const missRate = 100 - hitRate;

    const latencies = metrics.map(m => m.latency).sort((a, b) => a - b);
    const averageLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length || 0;
    const p95Index = Math.floor(latencies.length * 0.95);
    const p99Index = Math.floor(latencies.length * 0.99);
    const p95Latency = latencies[p95Index] || 0;
    const p99Latency = latencies[p99Index] || 0;

    const duration = (end.getTime() - start.getTime()) / 1000;
    const operationsPerSecond = totalOperations / duration;

    // Calculate level breakdown
    const levelBreakdown = new Map<string, LevelMetrics>();
    const levelGroups = this.groupBy(metrics, m => m.level);

    for (const [level, levelMetrics] of levelGroups) {
      const levelHits = levelMetrics.filter(m => m.hit).length;
      const levelTotal = levelMetrics.length;
      const levelLatencies = levelMetrics.map(m => m.latency);
      const levelAvgLatency = levelLatencies.reduce((sum, l) => sum + l, 0) / levelLatencies.length || 0;

      levelBreakdown.set(level, {
        level,
        hitRate: levelTotal > 0 ? (levelHits / levelTotal) * 100 : 0,
        missRate: levelTotal > 0 ? ((levelTotal - levelHits) / levelTotal) * 100 : 0,
        averageLatency: levelAvgLatency,
        keyCount: new Set(levelMetrics.map(m => m.key)).size,
        memoryUsage: 0, // Would need to be calculated based on actual cache state
        evictions: 0, // Would need to track eviction events
        operationsPerSecond: levelMetrics.length / duration,
      });
    }

    // Calculate top keys
    const keyGroups = this.groupBy(metrics, m => m.key);
    const topKeys = Array.from(keyGroups.entries())
      .map(([key, keyMetrics]) => ({
        key,
        hits: keyMetrics.filter(m => m.hit).length,
        misses: keyMetrics.filter(m => !m.hit).length,
      }))
      .sort((a, b) => (b.hits + b.misses) - (a.hits + a.misses))
      .slice(0, 100);

    return {
      timeRange: { start, end },
      totalOperations,
      hitRate,
      missRate,
      averageLatency,
      p95Latency,
      p99Latency,
      operationsPerSecond,
      errorRate: 0, // Would need to track errors separately
      memoryUsage: 0, // Would need to query actual memory usage
      keyCount: new Set(metrics.map(m => m.key)).size,
      levelBreakdown,
      topKeys,
      errorsByType: new Map(),
    };
  }

  private groupBy<T, K>(array: T[], keyFn: (item: T) => K): Map<K, T[]> {
    const groups = new Map<K, T[]>();
    for (const item of array) {
      const key = keyFn(item);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    }
    return groups;
  }

  private checkAlerts(metrics: AggregatedMetrics): void {
    // Hit rate alert
    const hitRateThreshold = this.alertThresholds.get('hit_rate_low');
    if (metrics.hitRate < hitRateThreshold.threshold) {
      this.createAlert(
        'hit_rate_low',
        hitRateThreshold.severity,
        `Cache hit rate is ${metrics.hitRate.toFixed(2)}%`,
        metrics.hitRate,
        hitRateThreshold.threshold
      );
    }

    // Latency alert
    const latencyThreshold = this.alertThresholds.get('latency_high');
    if (metrics.p95Latency > latencyThreshold.threshold) {
      this.createAlert(
        'latency_high',
        latencyThreshold.severity,
        `P95 latency is ${metrics.p95Latency.toFixed(2)}ms`,
        metrics.p95Latency,
        latencyThreshold.threshold
      );
    }

    // Memory usage alert (if available)
    if (metrics.memoryUsage > 0) {
      const memoryThreshold = this.alertThresholds.get('memory_full');
      if (metrics.memoryUsage > memoryThreshold.threshold) {
        this.createAlert(
          'memory_full',
          memoryThreshold.severity,
          `Memory usage is ${metrics.memoryUsage.toFixed(2)}%`,
          metrics.memoryUsage,
          memoryThreshold.threshold
        );
      }
    }
  }

  private createAlert(
    type: string,
    severity: string,
    message: string,
    value: number,
    threshold: number,
    metadata?: any
  ): void {
    const alertId = `${type}_${Date.now()}`;
    
    const alert: PerformanceAlert = {
      id: alertId,
      type: type as any,
      severity: severity as any,
      message,
      value,
      threshold,
      timestamp: new Date(),
      acknowledged: false,
      metadata,
    };

    this.alerts.set(alertId, alert);
    this.emit('alert-created', alert);
  }

  private detectAnomalies(): void {
    // Simple anomaly detection based on standard deviation
    const recentMetrics = this.getMetricsForTimeRange(
      new Date(Date.now() - 60 * 60 * 1000), // Last hour
      new Date()
    );

    if (recentMetrics.length < 10) return; // Need sufficient data

    const latencies = recentMetrics.map(m => m.latency);
    const mean = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
    const variance = latencies.reduce((sum, l) => sum + Math.pow(l - mean, 2), 0) / latencies.length;
    const stdDev = Math.sqrt(variance);

    // Check for latency anomalies (values more than 3 standard deviations from mean)
    const anomalies = recentMetrics.filter(m => Math.abs(m.latency - mean) > 3 * stdDev);
    
    if (anomalies.length > 0) {
      this.emit('anomaly-detected', {
        type: 'latency',
        count: anomalies.length,
        threshold: 3 * stdDev,
        samples: anomalies.slice(0, 5), // First 5 anomalies
      });
    }
  }

  private updateTrends(): void {
    const metrics = ['hitRate', 'averageLatency', 'operationsPerSecond'];
    
    for (const metric of metrics) {
      const trend = this.calculateTrend(metric);
      if (trend) {
        this.trends.set(metric, trend);
      }
    }
  }

  private calculateTrend(metric: string): CacheTrend | null {
    // Get last 24 hours of aggregated metrics
    const now = new Date();
    const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const relevantMetrics = Array.from(this.aggregatedMetrics.values())
      .filter(m => m.timeRange.start >= start)
      .sort((a, b) => a.timeRange.start.getTime() - b.timeRange.start.getTime());

    if (relevantMetrics.length < 5) return null; // Need enough data points

    const timePoints = relevantMetrics.map(m => ({
      timestamp: m.timeRange.start,
      value: this.extractMetricValue(m, metric),
    }));

    // Simple linear regression
    const n = timePoints.length;
    const sumX = timePoints.reduce((sum, p, i) => sum + i, 0);
    const sumY = timePoints.reduce((sum, p) => sum + p.value, 0);
    const sumXY = timePoints.reduce((sum, p, i) => sum + i * p.value, 0);
    const sumXX = timePoints.reduce((sum, p, i) => sum + i * i, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const correlation = this.calculateCorrelation(timePoints);

    const trend: 'increasing' | 'decreasing' | 'stable' = 
      Math.abs(slope) < 0.01 ? 'stable' : 
      slope > 0 ? 'increasing' : 'decreasing';

    // Simple forecast (next 6 hours)
    const forecast = [];
    const lastValue = timePoints[timePoints.length - 1].value;
    for (let i = 1; i <= 6; i++) {
      const forecastValue = lastValue + slope * i;
      const confidence = Math.max(0, 1 - Math.abs(slope) * i * 0.1); // Decreasing confidence
      
      forecast.push({
        timestamp: new Date(now.getTime() + i * 60 * 60 * 1000),
        value: forecastValue,
        confidence,
      });
    }

    return {
      metric,
      timePoints,
      trend,
      slope,
      correlation,
      forecast,
    };
  }

  private extractMetricValue(aggregated: AggregatedMetrics, metric: string): number {
    switch (metric) {
      case 'hitRate':
        return aggregated.hitRate;
      case 'averageLatency':
        return aggregated.averageLatency;
      case 'operationsPerSecond':
        return aggregated.operationsPerSecond;
      default:
        return 0;
    }
  }

  private calculateCorrelation(timePoints: Array<{ timestamp: Date; value: number }>): number {
    const n = timePoints.length;
    const x = timePoints.map((_, i) => i);
    const y = timePoints.map(p => p.value);

    const meanX = x.reduce((sum, val) => sum + val, 0) / n;
    const meanY = y.reduce((sum, val) => sum + val, 0) / n;

    const numerator = x.reduce((sum, val, i) => sum + (val - meanX) * (y[i] - meanY), 0);
    const denomX = Math.sqrt(x.reduce((sum, val) => sum + Math.pow(val - meanX, 2), 0));
    const denomY = Math.sqrt(y.reduce((sum, val) => sum + Math.pow(val - meanY, 2), 0));

    return denomX * denomY === 0 ? 0 : numerator / (denomX * denomY);
  }

  private startCleanup(): void {
    // Cleanup old data every hour
    setInterval(() => {
      this.cleanupOldData();
    }, 60 * 60 * 1000);
  }

  private cleanupOldData(): void {
    const cutoff = Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000);

    // Clean metrics
    this.metrics = this.metrics.filter(m => m.timestamp.getTime() > cutoff);

    // Clean aggregated metrics
    for (const [key, metrics] of this.aggregatedMetrics) {
      if (metrics.timeRange.start.getTime() < cutoff) {
        this.aggregatedMetrics.delete(key);
      }
    }

    // Clean resolved alerts older than 7 days
    const alertCutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
    for (const [id, alert] of this.alerts) {
      if (alert.resolvedAt && alert.resolvedAt.getTime() < alertCutoff) {
        this.alerts.delete(id);
      }
    }

    this.emit('cleanup-completed', {
      metricsCount: this.metrics.length,
      aggregatedCount: this.aggregatedMetrics.size,
      alertsCount: this.alerts.size,
    });
  }

  // Public API methods

  getMetricsForTimeRange(start: Date, end: Date): CacheMetrics[] {
    return this.metrics.filter(m => m.timestamp >= start && m.timestamp <= end);
  }

  getAggregatedMetrics(interval: string, start: Date, end: Date): AggregatedMetrics[] {
    return Array.from(this.aggregatedMetrics.values())
      .filter(m => 
        m.timeRange.start >= start && 
        m.timeRange.end <= end
      );
  }

  getCurrentStats(): AggregatedMetrics | null {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const recentMetrics = this.getMetricsForTimeRange(fiveMinutesAgo, now);
    
    if (recentMetrics.length === 0) return null;
    
    return this.calculateAggregatedMetrics(recentMetrics, fiveMinutesAgo, now);
  }

  getAlerts(onlyUnacknowledged = false): PerformanceAlert[] {
    const alerts = Array.from(this.alerts.values());
    return onlyUnacknowledged ? alerts.filter(a => !a.acknowledged) : alerts;
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.acknowledged = true;
    this.alerts.set(alertId, alert);
    this.emit('alert-acknowledged', alert);
    
    return true;
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.resolvedAt = new Date();
    this.alerts.set(alertId, alert);
    this.emit('alert-resolved', alert);
    
    return true;
  }

  getTrends(): Map<string, CacheTrend> {
    return new Map(this.trends);
  }

  generateHotspotAnalysis(hours = 24): HotspotAnalysis {
    const end = new Date();
    const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
    const metrics = this.getMetricsForTimeRange(start, end);

    const keyGroups = this.groupBy(metrics, m => m.key);
    const hotKeys = [];
    const coldKeys = [];

    for (const [key, keyMetrics] of keyGroups) {
      const accessCount = keyMetrics.length;
      const hits = keyMetrics.filter(m => m.hit).length;
      const hitRate = hits / accessCount * 100;
      const avgLatency = keyMetrics.reduce((sum, m) => sum + m.latency, 0) / keyMetrics.length;
      const lastAccessed = new Date(Math.max(...keyMetrics.map(m => m.timestamp.getTime())));

      if (accessCount > 10) { // Hot key threshold
        hotKeys.push({
          key,
          accessCount,
          hitRate,
          avgLatency,
          memoryUsage: 0, // Would need to calculate from cache
          lastAccessed,
        });
      } else if (accessCount === 0) { // Cold key (no recent access)
        coldKeys.push({
          key,
          lastAccessed,
          memoryUsage: 0,
          ttl: 0,
        });
      }
    }

    // Sort hot keys by access count
    hotKeys.sort((a, b) => b.accessCount - a.accessCount);

    // Analyze patterns
    const patterns = [];
    const keyPatterns = new Map<string, number>();
    
    for (const key of keyGroups.keys()) {
      // Simple pattern detection (prefix-based)
      const parts = key.split(':');
      if (parts.length > 1) {
        const pattern = parts[0] + ':*';
        keyPatterns.set(pattern, (keyPatterns.get(pattern) || 0) + 1);
      }
    }

    for (const [pattern, frequency] of keyPatterns) {
      patterns.push({
        pattern,
        frequency,
        performance: 100, // Placeholder performance score
      });
    }

    return {
      timeWindow: { start, end },
      hotKeys: hotKeys.slice(0, 100),
      coldKeys: coldKeys.slice(0, 100),
      patterns: patterns.sort((a, b) => b.frequency - a.frequency).slice(0, 20),
    };
  }

  generateEfficiencyReport(): CacheEfficiencyReport {
    const stats = this.cacheManager.getOverallStats();
    const currentStats = this.getCurrentStats();
    
    const overall = {
      efficiency: currentStats?.hitRate || 0,
      recommendations: [],
      potentialSavings: 0,
    };

    // Add recommendations based on performance
    if (overall.efficiency < 50) {
      overall.recommendations.push('Consider implementing cache warming strategies');
      overall.recommendations.push('Review cache TTL settings');
    }
    
    if (currentStats?.averageLatency > 50) {
      overall.recommendations.push('Optimize cache storage backend');
      overall.recommendations.push('Consider cache partitioning');
    }

    const levels = new Map();
    for (const [level, levelStats] of stats.levels) {
      levels.set(level, {
        efficiency: levelStats.hitRate,
        utilizationRate: levelStats.size / (levelStats.maxSize || levelStats.size) * 100,
        hitRateOptimal: levelStats.hitRate > 80,
        recommendations: levelStats.hitRate < 80 ? ['Increase cache size', 'Optimize TTL'] : [],
      });
    }

    return {
      overall,
      levels,
      keyAnalysis: {
        duplicateKeys: [], // Would need cross-level analysis
        unusedKeys: [], // Would need to track key usage
        oversizedKeys: [], // Would need size analysis
      },
      timingAnalysis: {
        peakHours: [], // Would need hourly analysis
        lowUtilizationPeriods: [], // Would need usage pattern analysis
      },
    };
  }

  setAlertThreshold(type: string, threshold: number, severity: string): void {
    this.alertThresholds.set(type, { threshold, severity });
    this.emit('threshold-updated', { type, threshold, severity });
  }

  exportMetrics(format: 'json' | 'csv', start: Date, end: Date): string {
    const metrics = this.getMetricsForTimeRange(start, end);
    
    if (format === 'csv') {
      const headers = ['timestamp', 'level', 'operation', 'key', 'hit', 'latency', 'size', 'ttl'];
      const rows = metrics.map(m => [
        m.timestamp.toISOString(),
        m.level,
        m.operation,
        m.key,
        m.hit,
        m.latency,
        m.size || '',
        m.ttl || '',
      ]);
      
      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
    
    return JSON.stringify(metrics, null, 2);
  }

  async shutdown(): Promise<void> {
    this.flushMetricsBuffer();
    this.emit('shutdown');
  }
}
