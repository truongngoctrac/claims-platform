import { Client } from '@elastic/elasticsearch';
import winston from 'winston';
import { ElasticsearchClusterService } from './ElasticsearchClusterService';

interface PerformanceMetrics {
  timestamp: Date;
  queryId: string;
  indexName: string;
  query: any;
  executionTime: number;
  totalHits: number;
  shardsQueried: number;
  shardsSuccessful: number;
  shardsFailed: number;
  peakMemoryUsage: number;
  cacheHits: number;
  cacheMisses: number;
  slowQuery: boolean;
  errorOccurred: boolean;
  errorMessage?: string;
  userId?: string;
  sessionId?: string;
}

interface ClusterPerformance {
  timestamp: Date;
  clusterHealth: 'green' | 'yellow' | 'red';
  nodeCount: number;
  activeShards: number;
  relocatingShards: number;
  initializingShards: number;
  unassignedShards: number;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  searchRate: number;
  indexingRate: number;
  avgSearchLatency: number;
  avgIndexingLatency: number;
}

interface PerformanceAlert {
  id: string;
  type: 'slow_query' | 'high_error_rate' | 'cluster_health' | 'resource_usage' | 'shard_failures';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  metrics: any;
  resolved: boolean;
  resolvedAt?: Date;
}

interface PerformanceThreshold {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  value: number;
  duration: number; // milliseconds
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface PerformanceReport {
  period: string;
  totalQueries: number;
  averageResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  slowQueries: number;
  errorRate: number;
  cacheHitRate: number;
  clusterHealth: {
    uptime: number;
    averageCpuUsage: number;
    averageMemoryUsage: number;
    averageDiskUsage: number;
  };
  topSlowQueries: Array<{
    query: string;
    averageTime: number;
    count: number;
  }>;
  alerts: PerformanceAlert[];
}

export class SearchPerformanceMonitoringService {
  private client: Client;
  private logger: winston.Logger;
  private clusterService: ElasticsearchClusterService;
  private performanceMetrics: PerformanceMetrics[] = [];
  private clusterMetrics: ClusterPerformance[] = [];
  private activeAlerts: Map<string, PerformanceAlert> = new Map();
  private thresholds: PerformanceThreshold[] = [];
  private metricsIndex: string = 'search-performance-metrics';
  private alertsIndex: string = 'search-performance-alerts';
  private monitoringInterval: NodeJS.Timeout | null = null;
  private maxMetricsHistory: number = 10000;

  constructor(clusterService: ElasticsearchClusterService) {
    this.clusterService = clusterService;
    this.client = clusterService.getClient();
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'search-performance-monitoring' },
      transports: [
        new winston.transports.File({ filename: 'logs/performance-monitoring-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/performance-monitoring-combined.log' }),
        new winston.transports.Console({ format: winston.format.simple() })
      ]
    });

    this.initializeIndices();
    this.initializeDefaultThresholds();
    this.startMonitoring();
  }

  private async initializeIndices(): Promise<void> {
    try {
      // Create performance metrics index
      const metricsExists = await this.client.indices.exists({ index: this.metricsIndex });
      if (!metricsExists.body) {
        await this.client.indices.create({
          index: this.metricsIndex,
          body: {
            mappings: {
              properties: {
                timestamp: { type: 'date' },
                queryId: { type: 'keyword' },
                indexName: { type: 'keyword' },
                query: { type: 'object', enabled: false },
                executionTime: { type: 'integer' },
                totalHits: { type: 'long' },
                shardsQueried: { type: 'integer' },
                shardsSuccessful: { type: 'integer' },
                shardsFailed: { type: 'integer' },
                peakMemoryUsage: { type: 'long' },
                cacheHits: { type: 'integer' },
                cacheMisses: { type: 'integer' },
                slowQuery: { type: 'boolean' },
                errorOccurred: { type: 'boolean' },
                errorMessage: { type: 'text' },
                userId: { type: 'keyword' },
                sessionId: { type: 'keyword' }
              }
            },
            settings: {
              number_of_shards: 2,
              number_of_replicas: 1,
              refresh_interval: '30s'
            }
          }
        });
      }

      // Create alerts index
      const alertsExists = await this.client.indices.exists({ index: this.alertsIndex });
      if (!alertsExists.body) {
        await this.client.indices.create({
          index: this.alertsIndex,
          body: {
            mappings: {
              properties: {
                id: { type: 'keyword' },
                type: { type: 'keyword' },
                severity: { type: 'keyword' },
                message: { type: 'text' },
                timestamp: { type: 'date' },
                metrics: { type: 'object', dynamic: true },
                resolved: { type: 'boolean' },
                resolvedAt: { type: 'date' }
              }
            }
          }
        });
      }

      this.logger.info('Performance monitoring indices initialized');
    } catch (error) {
      this.logger.error('Failed to initialize monitoring indices:', error);
      throw error;
    }
  }

  private initializeDefaultThresholds(): void {
    this.thresholds = [
      {
        metric: 'executionTime',
        operator: 'gt',
        value: 5000, // 5 seconds
        duration: 0,
        severity: 'high'
      },
      {
        metric: 'executionTime',
        operator: 'gt',
        value: 10000, // 10 seconds
        duration: 0,
        severity: 'critical'
      },
      {
        metric: 'errorRate',
        operator: 'gt',
        value: 0.05, // 5%
        duration: 60000, // 1 minute
        severity: 'medium'
      },
      {
        metric: 'errorRate',
        operator: 'gt',
        value: 0.1, // 10%
        duration: 60000,
        severity: 'high'
      },
      {
        metric: 'cacheHitRate',
        operator: 'lt',
        value: 0.7, // 70%
        duration: 300000, // 5 minutes
        severity: 'medium'
      },
      {
        metric: 'cpuUsage',
        operator: 'gt',
        value: 0.8, // 80%
        duration: 300000, // 5 minutes
        severity: 'high'
      },
      {
        metric: 'memoryUsage',
        operator: 'gt',
        value: 0.9, // 90%
        duration: 60000, // 1 minute
        severity: 'critical'
      }
    ];
  }

  async recordQueryMetrics(metrics: Omit<PerformanceMetrics, 'timestamp' | 'queryId'>): Promise<void> {
    try {
      const performanceMetrics: PerformanceMetrics = {
        ...metrics,
        timestamp: new Date(),
        queryId: this.generateQueryId()
      };

      // Store in memory
      this.performanceMetrics.push(performanceMetrics);
      if (this.performanceMetrics.length > this.maxMetricsHistory) {
        this.performanceMetrics = this.performanceMetrics.slice(-this.maxMetricsHistory);
      }

      // Index to Elasticsearch
      await this.client.index({
        index: this.metricsIndex,
        body: performanceMetrics
      });

      // Check for alerts
      await this.checkPerformanceThresholds(performanceMetrics);

      this.logger.debug(`Query metrics recorded: ${performanceMetrics.queryId}`);
    } catch (error) {
      this.logger.error('Failed to record query metrics:', error);
    }
  }

  private async checkPerformanceThresholds(metrics: PerformanceMetrics): Promise<void> {
    for (const threshold of this.thresholds) {
      if (this.evaluateThreshold(metrics, threshold)) {
        await this.createAlert({
          type: 'slow_query',
          severity: threshold.severity,
          message: `Query exceeded ${threshold.metric} threshold: ${metrics[threshold.metric as keyof PerformanceMetrics]} > ${threshold.value}`,
          metrics: {
            queryId: metrics.queryId,
            [threshold.metric]: metrics[threshold.metric as keyof PerformanceMetrics],
            threshold: threshold.value
          }
        });
      }
    }
  }

  private evaluateThreshold(metrics: PerformanceMetrics, threshold: PerformanceThreshold): boolean {
    const value = metrics[threshold.metric as keyof PerformanceMetrics] as number;
    
    switch (threshold.operator) {
      case 'gt': return value > threshold.value;
      case 'lt': return value < threshold.value;
      case 'gte': return value >= threshold.value;
      case 'lte': return value <= threshold.value;
      case 'eq': return value === threshold.value;
      default: return false;
    }
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectClusterMetrics();
        await this.analyzePerformanceTrends();
        await this.cleanupOldMetrics();
      } catch (error) {
        this.logger.error('Error during performance monitoring cycle:', error);
      }
    }, 60000); // Every minute
  }

  private async collectClusterMetrics(): Promise<void> {
    try {
      const [healthResponse, statsResponse, nodesResponse] = await Promise.all([
        this.client.cluster.health(),
        this.client.cluster.stats(),
        this.client.nodes.stats()
      ]);

      const health = healthResponse.body;
      const stats = statsResponse.body;
      const nodes = nodesResponse.body;

      // Calculate cluster-wide metrics
      let totalCpuUsage = 0;
      let totalMemoryUsage = 0;
      let totalDiskUsage = 0;
      let nodeCount = 0;

      for (const nodeId in nodes.nodes) {
        const node = nodes.nodes[nodeId];
        totalCpuUsage += node.os?.cpu?.percent || 0;
        totalMemoryUsage += node.os?.mem?.used_percent || 0;
        totalDiskUsage += node.fs?.total?.available_in_bytes ? 
          (1 - (node.fs.total.available_in_bytes / node.fs.total.total_in_bytes)) * 100 : 0;
        nodeCount++;
      }

      const clusterMetrics: ClusterPerformance = {
        timestamp: new Date(),
        clusterHealth: health.status,
        nodeCount: health.number_of_nodes,
        activeShards: health.active_shards,
        relocatingShards: health.relocating_shards,
        initializingShards: health.initializing_shards,
        unassignedShards: health.unassigned_shards,
        cpuUsage: nodeCount > 0 ? totalCpuUsage / nodeCount : 0,
        memoryUsage: nodeCount > 0 ? totalMemoryUsage / nodeCount : 0,
        diskUsage: nodeCount > 0 ? totalDiskUsage / nodeCount : 0,
        searchRate: stats.indices?.search?.query_total || 0,
        indexingRate: stats.indices?.indexing?.index_total || 0,
        avgSearchLatency: stats.indices?.search?.query_time_in_millis || 0,
        avgIndexingLatency: stats.indices?.indexing?.index_time_in_millis || 0
      };

      this.clusterMetrics.push(clusterMetrics);
      if (this.clusterMetrics.length > 1440) { // Keep 24 hours of minute-by-minute data
        this.clusterMetrics = this.clusterMetrics.slice(-1440);
      }

      // Check cluster health alerts
      await this.checkClusterHealthAlerts(clusterMetrics);

    } catch (error) {
      this.logger.error('Failed to collect cluster metrics:', error);
    }
  }

  private async checkClusterHealthAlerts(metrics: ClusterPerformance): Promise<void> {
    // Check cluster health
    if (metrics.clusterHealth === 'red') {
      await this.createAlert({
        type: 'cluster_health',
        severity: 'critical',
        message: 'Cluster health is RED - some primary shards are not available',
        metrics: { clusterHealth: metrics.clusterHealth }
      });
    } else if (metrics.clusterHealth === 'yellow') {
      await this.createAlert({
        type: 'cluster_health',
        severity: 'medium',
        message: 'Cluster health is YELLOW - some replica shards are not available',
        metrics: { clusterHealth: metrics.clusterHealth }
      });
    }

    // Check resource usage
    if (metrics.cpuUsage > 80) {
      await this.createAlert({
        type: 'resource_usage',
        severity: 'high',
        message: `High CPU usage: ${metrics.cpuUsage.toFixed(2)}%`,
        metrics: { cpuUsage: metrics.cpuUsage }
      });
    }

    if (metrics.memoryUsage > 90) {
      await this.createAlert({
        type: 'resource_usage',
        severity: 'critical',
        message: `Critical memory usage: ${metrics.memoryUsage.toFixed(2)}%`,
        metrics: { memoryUsage: metrics.memoryUsage }
      });
    }

    if (metrics.diskUsage > 85) {
      await this.createAlert({
        type: 'resource_usage',
        severity: 'high',
        message: `High disk usage: ${metrics.diskUsage.toFixed(2)}%`,
        metrics: { diskUsage: metrics.diskUsage }
      });
    }
  }

  private async analyzePerformanceTrends(): Promise<void> {
    if (this.performanceMetrics.length < 100) return; // Need sufficient data

    const recentMetrics = this.performanceMetrics.slice(-100);
    const errorRate = recentMetrics.filter(m => m.errorOccurred).length / recentMetrics.length;
    const avgResponseTime = recentMetrics.reduce((sum, m) => sum + m.executionTime, 0) / recentMetrics.length;
    
    // Check if error rate is trending upward
    if (errorRate > 0.1) {
      await this.createAlert({
        type: 'high_error_rate',
        severity: 'high',
        message: `High error rate detected: ${(errorRate * 100).toFixed(2)}% over last 100 queries`,
        metrics: { errorRate, sampleSize: recentMetrics.length }
      });
    }

    // Check if response time is degrading
    if (avgResponseTime > 3000) {
      await this.createAlert({
        type: 'slow_query',
        severity: 'medium',
        message: `Performance degradation: average response time ${avgResponseTime.toFixed(0)}ms over last 100 queries`,
        metrics: { averageResponseTime: avgResponseTime, sampleSize: recentMetrics.length }
      });
    }
  }

  private async createAlert(alertData: Omit<PerformanceAlert, 'id' | 'timestamp' | 'resolved'>): Promise<void> {
    const alert: PerformanceAlert = {
      ...alertData,
      id: this.generateAlertId(),
      timestamp: new Date(),
      resolved: false
    };

    this.activeAlerts.set(alert.id, alert);

    try {
      await this.client.index({
        index: this.alertsIndex,
        id: alert.id,
        body: alert
      });

      this.logger.warn(`Performance alert created: ${alert.type} - ${alert.message}`);
    } catch (error) {
      this.logger.error('Failed to create alert:', error);
    }
  }

  async resolveAlert(alertId: string): Promise<void> {
    try {
      const alert = this.activeAlerts.get(alertId);
      if (!alert) {
        throw new Error(`Alert not found: ${alertId}`);
      }

      alert.resolved = true;
      alert.resolvedAt = new Date();

      await this.client.update({
        index: this.alertsIndex,
        id: alertId,
        body: {
          doc: {
            resolved: true,
            resolvedAt: alert.resolvedAt
          }
        }
      });

      this.activeAlerts.delete(alertId);
      this.logger.info(`Alert resolved: ${alertId}`);
    } catch (error) {
      this.logger.error(`Failed to resolve alert ${alertId}:`, error);
      throw error;
    }
  }

  async getPerformanceReport(period: 'hour' | 'day' | 'week' | 'month' = 'day'): Promise<PerformanceReport> {
    try {
      const now = new Date();
      const startTime = new Date(now.getTime() - this.getPeriodMs(period));

      // Get metrics from the specified period
      const metricsInPeriod = this.performanceMetrics.filter(
        m => m.timestamp >= startTime && m.timestamp <= now
      );

      if (metricsInPeriod.length === 0) {
        return this.getEmptyReport(period);
      }

      // Calculate performance statistics
      const executionTimes = metricsInPeriod.map(m => m.executionTime).sort((a, b) => a - b);
      const errorCount = metricsInPeriod.filter(m => m.errorOccurred).length;
      const cacheHits = metricsInPeriod.reduce((sum, m) => sum + m.cacheHits, 0);
      const cacheMisses = metricsInPeriod.reduce((sum, m) => sum + m.cacheMisses, 0);

      // Calculate percentiles
      const p50 = this.calculatePercentile(executionTimes, 50);
      const p95 = this.calculatePercentile(executionTimes, 95);
      const p99 = this.calculatePercentile(executionTimes, 99);

      // Get slow queries
      const slowQueries = this.getTopSlowQueries(metricsInPeriod);

      // Get cluster health metrics
      const clusterMetricsInPeriod = this.clusterMetrics.filter(
        m => m.timestamp >= startTime && m.timestamp <= now
      );

      const avgCpuUsage = clusterMetricsInPeriod.length > 0 
        ? clusterMetricsInPeriod.reduce((sum, m) => sum + m.cpuUsage, 0) / clusterMetricsInPeriod.length 
        : 0;

      const avgMemoryUsage = clusterMetricsInPeriod.length > 0 
        ? clusterMetricsInPeriod.reduce((sum, m) => sum + m.memoryUsage, 0) / clusterMetricsInPeriod.length 
        : 0;

      const avgDiskUsage = clusterMetricsInPeriod.length > 0 
        ? clusterMetricsInPeriod.reduce((sum, m) => sum + m.diskUsage, 0) / clusterMetricsInPeriod.length 
        : 0;

      // Get active alerts
      const activeAlerts = Array.from(this.activeAlerts.values()).filter(
        alert => alert.timestamp >= startTime && !alert.resolved
      );

      return {
        period,
        totalQueries: metricsInPeriod.length,
        averageResponseTime: executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length,
        p50ResponseTime: p50,
        p95ResponseTime: p95,
        p99ResponseTime: p99,
        slowQueries: metricsInPeriod.filter(m => m.slowQuery).length,
        errorRate: metricsInPeriod.length > 0 ? errorCount / metricsInPeriod.length : 0,
        cacheHitRate: (cacheHits + cacheMisses) > 0 ? cacheHits / (cacheHits + cacheMisses) : 0,
        clusterHealth: {
          uptime: this.getPeriodMs(period),
          averageCpuUsage: avgCpuUsage,
          averageMemoryUsage: avgMemoryUsage,
          averageDiskUsage: avgDiskUsage
        },
        topSlowQueries: slowQueries,
        alerts: activeAlerts
      };
    } catch (error) {
      this.logger.error('Failed to generate performance report:', error);
      throw error;
    }
  }

  private getPeriodMs(period: string): number {
    switch (period) {
      case 'hour': return 60 * 60 * 1000;
      case 'day': return 24 * 60 * 60 * 1000;
      case 'week': return 7 * 24 * 60 * 60 * 1000;
      case 'month': return 30 * 24 * 60 * 60 * 1000;
      default: return 24 * 60 * 60 * 1000;
    }
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  private getTopSlowQueries(metrics: PerformanceMetrics[]): Array<{ query: string; averageTime: number; count: number }> {
    const queryMap = new Map<string, { totalTime: number; count: number }>();

    for (const metric of metrics) {
      const queryStr = JSON.stringify(metric.query);
      const existing = queryMap.get(queryStr) || { totalTime: 0, count: 0 };
      queryMap.set(queryStr, {
        totalTime: existing.totalTime + metric.executionTime,
        count: existing.count + 1
      });
    }

    return Array.from(queryMap.entries())
      .map(([query, data]) => ({
        query,
        averageTime: data.totalTime / data.count,
        count: data.count
      }))
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, 10);
  }

  private getEmptyReport(period: string): PerformanceReport {
    return {
      period,
      totalQueries: 0,
      averageResponseTime: 0,
      p50ResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      slowQueries: 0,
      errorRate: 0,
      cacheHitRate: 0,
      clusterHealth: {
        uptime: 0,
        averageCpuUsage: 0,
        averageMemoryUsage: 0,
        averageDiskUsage: 0
      },
      topSlowQueries: [],
      alerts: []
    };
  }

  private async cleanupOldMetrics(): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)); // 7 days ago

      await this.client.deleteByQuery({
        index: this.metricsIndex,
        body: {
          query: {
            range: {
              timestamp: {
                lt: cutoffDate
              }
            }
          }
        }
      });

      this.logger.info('Old performance metrics cleaned up');
    } catch (error) {
      this.logger.error('Failed to cleanup old metrics:', error);
    }
  }

  private generateQueryId(): string {
    return `query-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertId(): string {
    return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async addThreshold(threshold: PerformanceThreshold): Promise<void> {
    this.thresholds.push(threshold);
    this.logger.info(`Performance threshold added: ${threshold.metric} ${threshold.operator} ${threshold.value}`);
  }

  async removeThreshold(metric: string): Promise<void> {
    this.thresholds = this.thresholds.filter(t => t.metric !== metric);
    this.logger.info(`Performance threshold removed for metric: ${metric}`);
  }

  async getActiveAlerts(): Promise<PerformanceAlert[]> {
    return Array.from(this.activeAlerts.values());
  }

  async getRecentMetrics(limit: number = 100): Promise<PerformanceMetrics[]> {
    return this.performanceMetrics.slice(-limit);
  }

  async stop(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.logger.info('Performance monitoring stopped');
  }
}
