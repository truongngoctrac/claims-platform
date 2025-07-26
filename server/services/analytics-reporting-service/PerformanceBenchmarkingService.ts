import { Db, MongoClient } from 'mongodb';
import { EventEmitter } from 'events';
import * as winston from 'winston';
import IORedis from 'ioredis';

export interface BenchmarkSuite {
  id: string;
  name: string;
  description: string;
  metrics: BenchmarkMetric[];
  targets: PerformanceTarget[];
  schedule?: {
    cronExpression: string;
    enabled: boolean;
  };
  environment: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface BenchmarkMetric {
  name: string;
  type: 'latency' | 'throughput' | 'memory' | 'cpu' | 'disk' | 'network' | 'custom';
  unit: string;
  aggregation: 'avg' | 'min' | 'max' | 'p50' | 'p95' | 'p99' | 'sum' | 'count';
  query?: string;
  endpoint?: string;
  threshold?: {
    warning: number;
    critical: number;
  };
}

export interface PerformanceTarget {
  metricName: string;
  baseline: number;
  target: number;
  tolerance: number;
  comparison: 'greater_than' | 'less_than' | 'equal_to' | 'within_range';
}

export interface BenchmarkRun {
  id: string;
  suiteId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  results: BenchmarkResult[];
  summary: BenchmarkSummary;
  metadata: {
    triggeredBy: string;
    environment: string;
    version?: string;
    commit?: string;
  };
}

export interface BenchmarkResult {
  metricName: string;
  value: number;
  unit: string;
  status: 'pass' | 'warning' | 'fail';
  baseline?: number;
  target?: number;
  deviation?: number;
  percentile?: Record<string, number>;
  samples: number;
  timestamp: Date;
}

export interface BenchmarkSummary {
  totalMetrics: number;
  passedMetrics: number;
  warningMetrics: number;
  failedMetrics: number;
  overallStatus: 'pass' | 'warning' | 'fail';
  performanceScore: number;
  regressions: string[];
  improvements: string[];
}

export interface PerformanceComparison {
  suiteId: string;
  baselineRun: string;
  currentRun: string;
  comparison: MetricComparison[];
  overallTrend: 'improved' | 'degraded' | 'stable';
  significantChanges: SignificantChange[];
}

export interface MetricComparison {
  metricName: string;
  baseline: number;
  current: number;
  change: number;
  changePercent: number;
  significance: 'significant' | 'minor' | 'noise';
  trend: 'improved' | 'degraded' | 'stable';
}

export interface SignificantChange {
  metricName: string;
  type: 'regression' | 'improvement';
  magnitude: number;
  impact: 'low' | 'medium' | 'high' | 'critical';
  recommendation?: string;
}

export interface PerformanceAlert {
  id: string;
  suiteId: string;
  runId: string;
  metricName: string;
  alertType: 'threshold_exceeded' | 'regression_detected' | 'target_missed';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  value: number;
  threshold?: number;
  actions: AlertAction[];
  acknowledged: boolean;
  createdAt: Date;
}

export interface AlertAction {
  type: 'email' | 'webhook' | 'slack' | 'pagerduty';
  target: string;
  template: string;
  executed: boolean;
  executedAt?: Date;
}

export class PerformanceBenchmarkingService extends EventEmitter {
  private db: Db | null = null;
  private redis: IORedis;
  private logger: winston.Logger;
  private activeBenchmarks: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
    this.redis = new IORedis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'performance-benchmarking.log' })
      ]
    });
  }

  async initialize(): Promise<void> {
    try {
      const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
      await client.connect();
      this.db = client.db('healthcare_claims');

      await this.ensureIndexes();
      await this.redis.connect();
      
      this.logger.info('Performance Benchmarking Service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Performance Benchmarking Service:', error);
      throw error;
    }
  }

  private async ensureIndexes(): Promise<void> {
    if (!this.db) return;

    const collections = {
      benchmark_suites: [
        { key: { id: 1 }, unique: true },
        { key: { environment: 1, tags: 1 } },
        { key: { 'schedule.enabled': 1 } }
      ],
      benchmark_runs: [
        { key: { id: 1 }, unique: true },
        { key: { suiteId: 1, startTime: -1 } },
        { key: { status: 1 } },
        { key: { 'metadata.environment': 1 } }
      ],
      performance_alerts: [
        { key: { id: 1 }, unique: true },
        { key: { suiteId: 1, severity: 1 } },
        { key: { acknowledged: 1, createdAt: -1 } }
      ]
    };

    for (const [collection, indexes] of Object.entries(collections)) {
      for (const index of indexes) {
        await this.db.collection(collection).createIndex(index.key, { 
          unique: index.unique || false,
          background: true 
        });
      }
    }
  }

  async createBenchmarkSuite(suite: Omit<BenchmarkSuite, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const benchmarkSuite: BenchmarkSuite = {
      id: `suite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...suite,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.db.collection('benchmark_suites').insertOne(benchmarkSuite);
    
    if (benchmarkSuite.schedule?.enabled) {
      await this.scheduleRecurringBenchmark(benchmarkSuite.id, benchmarkSuite.schedule.cronExpression);
    }

    this.logger.info(`Created benchmark suite: ${benchmarkSuite.id}`);
  }

  async runBenchmark(suiteId: string, triggeredBy: string, metadata?: Record<string, any>): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    const suite = await this.db.collection('benchmark_suites').findOne({ id: suiteId });
    if (!suite) throw new Error(`Benchmark suite not found: ${suiteId}`);

    const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const benchmarkRun: BenchmarkRun = {
      id: runId,
      suiteId,
      status: 'running',
      startTime: new Date(),
      results: [],
      summary: {
        totalMetrics: suite.metrics.length,
        passedMetrics: 0,
        warningMetrics: 0,
        failedMetrics: 0,
        overallStatus: 'pass',
        performanceScore: 0,
        regressions: [],
        improvements: []
      },
      metadata: {
        triggeredBy,
        environment: suite.environment,
        ...metadata
      }
    };

    await this.db.collection('benchmark_runs').insertOne(benchmarkRun);
    this.emit('benchmarkStarted', { runId, suiteId });

    try {
      // Execute benchmark metrics
      const results: BenchmarkResult[] = [];
      
      for (const metric of suite.metrics) {
        const result = await this.executeBenchmarkMetric(metric, suite.environment);
        results.push(result);
        
        // Check thresholds and targets
        const status = await this.evaluateMetricResult(result, metric, suite.targets);
        result.status = status;
        
        // Update summary
        if (status === 'pass') benchmarkRun.summary.passedMetrics++;
        else if (status === 'warning') benchmarkRun.summary.warningMetrics++;
        else benchmarkRun.summary.failedMetrics++;
      }

      // Calculate performance score
      const score = this.calculatePerformanceScore(results, suite.targets);
      
      // Determine overall status
      const overallStatus = benchmarkRun.summary.failedMetrics > 0 ? 'fail' : 
                          benchmarkRun.summary.warningMetrics > 0 ? 'warning' : 'pass';

      // Complete the run
      benchmarkRun.status = 'completed';
      benchmarkRun.endTime = new Date();
      benchmarkRun.duration = benchmarkRun.endTime.getTime() - benchmarkRun.startTime.getTime();
      benchmarkRun.results = results;
      benchmarkRun.summary.overallStatus = overallStatus;
      benchmarkRun.summary.performanceScore = score;

      await this.db.collection('benchmark_runs').updateOne(
        { id: runId },
        { $set: benchmarkRun }
      );

      // Check for regressions and improvements
      await this.analyzePerformanceChanges(runId, suiteId);

      // Generate alerts if needed
      await this.checkPerformanceAlerts(runId, suite, results);

      this.emit('benchmarkCompleted', { runId, suiteId, status: overallStatus, score });
      this.logger.info(`Benchmark run completed: ${runId}, Score: ${score}`);

      return runId;

    } catch (error) {
      benchmarkRun.status = 'failed';
      benchmarkRun.endTime = new Date();
      
      await this.db.collection('benchmark_runs').updateOne(
        { id: runId },
        { $set: { status: 'failed', endTime: benchmarkRun.endTime } }
      );

      this.emit('benchmarkFailed', { runId, suiteId, error: error.message });
      this.logger.error(`Benchmark run failed: ${runId}`, error);
      throw error;
    }
  }

  private async executeBenchmarkMetric(metric: BenchmarkMetric, environment: string): Promise<BenchmarkResult> {
    const startTime = Date.now();
    let value: number;
    let samples = 1;
    let percentile: Record<string, number> = {};

    try {
      switch (metric.type) {
        case 'latency':
          const latencyResults = await this.measureLatency(metric.endpoint!, environment);
          value = latencyResults.average;
          samples = latencyResults.samples;
          percentile = latencyResults.percentiles;
          break;

        case 'throughput':
          value = await this.measureThroughput(metric.endpoint!, environment);
          break;

        case 'memory':
          value = await this.measureMemoryUsage(environment);
          break;

        case 'cpu':
          value = await this.measureCpuUsage(environment);
          break;

        case 'disk':
          value = await this.measureDiskUsage(environment);
          break;

        case 'network':
          value = await this.measureNetworkLatency(environment);
          break;

        case 'custom':
          value = await this.executeCustomMetric(metric.query!, environment);
          break;

        default:
          throw new Error(`Unsupported metric type: ${metric.type}`);
      }

      return {
        metricName: metric.name,
        value,
        unit: metric.unit,
        status: 'pass',
        percentile,
        samples,
        timestamp: new Date()
      };

    } catch (error) {
      this.logger.error(`Failed to execute metric ${metric.name}:`, error);
      return {
        metricName: metric.name,
        value: -1,
        unit: metric.unit,
        status: 'fail',
        percentile: {},
        samples: 0,
        timestamp: new Date()
      };
    }
  }

  private async measureLatency(endpoint: string, environment: string): Promise<{
    average: number;
    samples: number;
    percentiles: Record<string, number>;
  }> {
    const measurements: number[] = [];
    const sampleCount = 100;

    for (let i = 0; i < sampleCount; i++) {
      const start = process.hrtime.bigint();
      try {
        await fetch(endpoint);
        const end = process.hrtime.bigint();
        measurements.push(Number(end - start) / 1000000); // Convert to milliseconds
      } catch (error) {
        // Handle failed requests
        measurements.push(10000); // 10 second timeout
      }
    }

    measurements.sort((a, b) => a - b);
    
    return {
      average: measurements.reduce((a, b) => a + b, 0) / measurements.length,
      samples: sampleCount,
      percentiles: {
        p50: measurements[Math.floor(measurements.length * 0.5)],
        p95: measurements[Math.floor(measurements.length * 0.95)],
        p99: measurements[Math.floor(measurements.length * 0.99)]
      }
    };
  }

  private async measureThroughput(endpoint: string, environment: string): Promise<number> {
    const duration = 10000; // 10 seconds
    const startTime = Date.now();
    let requests = 0;

    while (Date.now() - startTime < duration) {
      try {
        await fetch(endpoint);
        requests++;
      } catch (error) {
        // Continue counting failed requests
      }
    }

    return requests / (duration / 1000); // requests per second
  }

  private async measureMemoryUsage(environment: string): Promise<number> {
    const memUsage = process.memoryUsage();
    return memUsage.heapUsed / 1024 / 1024; // MB
  }

  private async measureCpuUsage(environment: string): Promise<number> {
    // Simplified CPU measurement
    const start = process.cpuUsage();
    await new Promise(resolve => setTimeout(resolve, 1000));
    const end = process.cpuUsage(start);
    
    return (end.user + end.system) / 1000; // milliseconds
  }

  private async measureDiskUsage(environment: string): Promise<number> {
    // Mock disk usage measurement
    return Math.random() * 100; // Percentage
  }

  private async measureNetworkLatency(environment: string): Promise<number> {
    const start = Date.now();
    try {
      await fetch('https://google.com');
      return Date.now() - start;
    } catch (error) {
      return 5000; // 5 second timeout
    }
  }

  private async executeCustomMetric(query: string, environment: string): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      // Execute custom aggregation query
      const result = await this.db.collection('performance_metrics').aggregate([
        { $match: { environment } },
        ...JSON.parse(query)
      ]).toArray();

      return result[0]?.value || 0;
    } catch (error) {
      this.logger.error('Failed to execute custom metric query:', error);
      return 0;
    }
  }

  private async evaluateMetricResult(
    result: BenchmarkResult, 
    metric: BenchmarkMetric, 
    targets: PerformanceTarget[]
  ): Promise<'pass' | 'warning' | 'fail'> {
    // Check threshold
    if (metric.threshold) {
      if (result.value >= metric.threshold.critical) return 'fail';
      if (result.value >= metric.threshold.warning) return 'warning';
    }

    // Check targets
    const target = targets.find(t => t.metricName === metric.name);
    if (target) {
      const deviation = Math.abs(result.value - target.target) / target.target;
      result.target = target.target;
      result.baseline = target.baseline;
      result.deviation = deviation;

      if (deviation > target.tolerance) {
        switch (target.comparison) {
          case 'less_than':
            return result.value > target.target ? 'fail' : 'pass';
          case 'greater_than':
            return result.value < target.target ? 'fail' : 'pass';
          default:
            return 'fail';
        }
      }
    }

    return 'pass';
  }

  private calculatePerformanceScore(results: BenchmarkResult[], targets: PerformanceTarget[]): number {
    let totalScore = 0;
    let scoredMetrics = 0;

    for (const result of results) {
      const target = targets.find(t => t.metricName === result.metricName);
      if (target && result.deviation !== undefined) {
        const score = Math.max(0, 100 - (result.deviation * 100));
        totalScore += score;
        scoredMetrics++;
      }
    }

    return scoredMetrics > 0 ? totalScore / scoredMetrics : 0;
  }

  private async analyzePerformanceChanges(runId: string, suiteId: string): Promise<void> {
    if (!this.db) return;

    const previousRuns = await this.db.collection('benchmark_runs')
      .find({ suiteId, status: 'completed', id: { $ne: runId } })
      .sort({ startTime: -1 })
      .limit(5)
      .toArray();

    if (previousRuns.length === 0) return;

    const currentRun = await this.db.collection('benchmark_runs').findOne({ id: runId });
    if (!currentRun) return;

    const baselineRun = previousRuns[0];
    const comparison = await this.comparePerformanceRuns(currentRun, baselineRun);

    // Update run with comparison data
    await this.db.collection('benchmark_runs').updateOne(
      { id: runId },
      { 
        $set: { 
          'summary.regressions': comparison.significantChanges
            .filter(c => c.type === 'regression')
            .map(c => c.metricName),
          'summary.improvements': comparison.significantChanges
            .filter(c => c.type === 'improvement')
            .map(c => c.metricName)
        }
      }
    );
  }

  private async comparePerformanceRuns(currentRun: BenchmarkRun, baselineRun: BenchmarkRun): Promise<PerformanceComparison> {
    const comparison: MetricComparison[] = [];
    const significantChanges: SignificantChange[] = [];

    for (const currentResult of currentRun.results) {
      const baselineResult = baselineRun.results.find(r => r.metricName === currentResult.metricName);
      if (!baselineResult) continue;

      const change = currentResult.value - baselineResult.value;
      const changePercent = (change / baselineResult.value) * 100;
      
      const metricComparison: MetricComparison = {
        metricName: currentResult.metricName,
        baseline: baselineResult.value,
        current: currentResult.value,
        change,
        changePercent,
        significance: Math.abs(changePercent) > 10 ? 'significant' : 
                     Math.abs(changePercent) > 5 ? 'minor' : 'noise',
        trend: change > 0 ? 'degraded' : change < 0 ? 'improved' : 'stable'
      };

      comparison.push(metricComparison);

      // Identify significant changes
      if (metricComparison.significance === 'significant') {
        significantChanges.push({
          metricName: currentResult.metricName,
          type: metricComparison.trend === 'degraded' ? 'regression' : 'improvement',
          magnitude: Math.abs(changePercent),
          impact: Math.abs(changePercent) > 50 ? 'critical' :
                 Math.abs(changePercent) > 25 ? 'high' :
                 Math.abs(changePercent) > 15 ? 'medium' : 'low'
        });
      }
    }

    const overallTrend = significantChanges.length > 0 ?
      (significantChanges.filter(c => c.type === 'regression').length > 
       significantChanges.filter(c => c.type === 'improvement').length ? 'degraded' : 'improved') : 'stable';

    return {
      suiteId: currentRun.suiteId,
      baselineRun: baselineRun.id,
      currentRun: currentRun.id,
      comparison,
      overallTrend,
      significantChanges
    };
  }

  private async checkPerformanceAlerts(runId: string, suite: BenchmarkSuite, results: BenchmarkResult[]): Promise<void> {
    if (!this.db) return;

    for (const result of results) {
      const alerts: PerformanceAlert[] = [];

      // Threshold alerts
      const metric = suite.metrics.find(m => m.name === result.metricName);
      if (metric?.threshold) {
        if (result.value >= metric.threshold.critical) {
          alerts.push(this.createAlert(runId, suite.id, result, 'threshold_exceeded', 'critical'));
        } else if (result.value >= metric.threshold.warning) {
          alerts.push(this.createAlert(runId, suite.id, result, 'threshold_exceeded', 'warning'));
        }
      }

      // Regression alerts
      if (result.status === 'fail' && result.deviation && result.deviation > 0.2) {
        alerts.push(this.createAlert(runId, suite.id, result, 'regression_detected', 'warning'));
      }

      // Target miss alerts
      if (result.target && result.value > result.target * 1.1) {
        alerts.push(this.createAlert(runId, suite.id, result, 'target_missed', 'warning'));
      }

      // Store alerts
      for (const alert of alerts) {
        await this.db.collection('performance_alerts').insertOne(alert);
        this.emit('performanceAlert', alert);
      }
    }
  }

  private createAlert(
    runId: string, 
    suiteId: string, 
    result: BenchmarkResult, 
    alertType: PerformanceAlert['alertType'],
    severity: PerformanceAlert['severity']
  ): PerformanceAlert {
    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      suiteId,
      runId,
      metricName: result.metricName,
      alertType,
      severity,
      message: `Performance ${alertType.replace('_', ' ')} for ${result.metricName}: ${result.value}${result.unit}`,
      value: result.value,
      threshold: result.target,
      actions: [],
      acknowledged: false,
      createdAt: new Date()
    };
  }

  private async scheduleRecurringBenchmark(suiteId: string, cronExpression: string): Promise<void> {
    // Mock cron scheduling - in real implementation would use node-cron
    this.logger.info(`Scheduled recurring benchmark for suite ${suiteId} with expression: ${cronExpression}`);
  }

  async getBenchmarkHistory(suiteId: string, limit: number = 50): Promise<BenchmarkRun[]> {
    if (!this.db) throw new Error('Database not initialized');

    return await this.db.collection('benchmark_runs')
      .find({ suiteId })
      .sort({ startTime: -1 })
      .limit(limit)
      .toArray();
  }

  async getPerformanceComparison(suiteId: string, runId1: string, runId2: string): Promise<PerformanceComparison> {
    if (!this.db) throw new Error('Database not initialized');

    const [run1, run2] = await Promise.all([
      this.db.collection('benchmark_runs').findOne({ id: runId1 }),
      this.db.collection('benchmark_runs').findOne({ id: runId2 })
    ]);

    if (!run1 || !run2) throw new Error('Benchmark runs not found');

    return await this.comparePerformanceRuns(run1, run2);
  }

  async getPerformanceAlerts(filters?: {
    suiteId?: string;
    severity?: string;
    acknowledged?: boolean;
  }): Promise<PerformanceAlert[]> {
    if (!this.db) throw new Error('Database not initialized');

    const query: any = {};
    if (filters?.suiteId) query.suiteId = filters.suiteId;
    if (filters?.severity) query.severity = filters.severity;
    if (filters?.acknowledged !== undefined) query.acknowledged = filters.acknowledged;

    return await this.db.collection('performance_alerts')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
  }

  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.collection('performance_alerts').updateOne(
      { id: alertId },
      { 
        $set: { 
          acknowledged: true, 
          acknowledgedBy, 
          acknowledgedAt: new Date() 
        } 
      }
    );
  }
}
