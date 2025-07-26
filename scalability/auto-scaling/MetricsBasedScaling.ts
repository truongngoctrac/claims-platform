/**
 * Metrics-Based Auto Scaling System
 * Healthcare Claims Processing System
 */

export interface MetricData {
  timestamp: Date;
  value: number;
  unit: string;
  source: string;
}

export interface ScalingMetrics {
  cpu: MetricData;
  memory: MetricData;
  requestRate: MetricData;
  responseTime: MetricData;
  errorRate: MetricData;
  queueLength: MetricData;
  customMetrics: { [key: string]: MetricData };
}

export interface MetricThresholds {
  cpu: { scaleUp: number; scaleDown: number };
  memory: { scaleUp: number; scaleDown: number };
  requestRate: { scaleUp: number; scaleDown: number };
  responseTime: { scaleUp: number; scaleDown: number };
  errorRate: { scaleUp: number; scaleDown: number };
  queueLength: { scaleUp: number; scaleDown: number };
}

export interface ScalingDecision {
  action: 'scale-up' | 'scale-down' | 'maintain';
  currentReplicas: number;
  targetReplicas: number;
  triggeredBy: string[];
  confidence: number;
  timestamp: Date;
  metrics: ScalingMetrics;
}

export interface MetricsCollectorConfig {
  interval: number;
  retention: number;
  sources: string[];
  aggregationWindow: number;
}

export class MetricsBasedScaling {
  private metrics: Map<string, MetricData[]> = new Map();
  private thresholds: MetricThresholds;
  private config: MetricsCollectorConfig;
  private collectionTimer?: NodeJS.Timeout;

  constructor(
    thresholds: MetricThresholds,
    config: MetricsCollectorConfig
  ) {
    this.thresholds = thresholds;
    this.config = config;
  }

  /**
   * Start metrics collection
   */
  async startCollection(): Promise<void> {
    console.log('🔄 Starting metrics-based scaling collection');
    
    this.collectionTimer = setInterval(async () => {
      await this.collectMetrics();
    }, this.config.interval);

    console.log('✅ Metrics collection started');
  }

  /**
   * Stop metrics collection
   */
  stopCollection(): void {
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = undefined;
    }
    console.log('⏹️ Metrics collection stopped');
  }

  /**
   * Collect current system metrics
   */
  private async collectMetrics(): Promise<ScalingMetrics> {
    const timestamp = new Date();

    const metrics: ScalingMetrics = {
      cpu: await this.getCPUMetrics(),
      memory: await this.getMemoryMetrics(),
      requestRate: await this.getRequestRateMetrics(),
      responseTime: await this.getResponseTimeMetrics(),
      errorRate: await this.getErrorRateMetrics(),
      queueLength: await this.getQueueLengthMetrics(),
      customMetrics: await this.getCustomMetrics()
    };

    // Store metrics for historical analysis
    this.storeMetrics(metrics);

    return metrics;
  }

  /**
   * Get CPU utilization metrics
   */
  private async getCPUMetrics(): Promise<MetricData> {
    // In a real implementation, this would connect to monitoring systems
    // like Prometheus, DataDog, or AWS CloudWatch
    const cpuUsage = await this.simulateCPUCollection();
    
    return {
      timestamp: new Date(),
      value: cpuUsage,
      unit: 'percentage',
      source: 'system'
    };
  }

  /**
   * Get memory utilization metrics
   */
  private async getMemoryMetrics(): Promise<MetricData> {
    const memoryUsage = await this.simulateMemoryCollection();
    
    return {
      timestamp: new Date(),
      value: memoryUsage,
      unit: 'percentage',
      source: 'system'
    };
  }

  /**
   * Get request rate metrics
   */
  private async getRequestRateMetrics(): Promise<MetricData> {
    const requestRate = await this.simulateRequestRateCollection();
    
    return {
      timestamp: new Date(),
      value: requestRate,
      unit: 'requests/second',
      source: 'application'
    };
  }

  /**
   * Get response time metrics
   */
  private async getResponseTimeMetrics(): Promise<MetricData> {
    const responseTime = await this.simulateResponseTimeCollection();
    
    return {
      timestamp: new Date(),
      value: responseTime,
      unit: 'milliseconds',
      source: 'application'
    };
  }

  /**
   * Get error rate metrics
   */
  private async getErrorRateMetrics(): Promise<MetricData> {
    const errorRate = await this.simulateErrorRateCollection();
    
    return {
      timestamp: new Date(),
      value: errorRate,
      unit: 'percentage',
      source: 'application'
    };
  }

  /**
   * Get queue length metrics for healthcare claims processing
   */
  private async getQueueLengthMetrics(): Promise<MetricData> {
    const queueLength = await this.simulateQueueLengthCollection();
    
    return {
      timestamp: new Date(),
      value: queueLength,
      unit: 'count',
      source: 'queue'
    };
  }

  /**
   * Get custom metrics specific to healthcare claims
   */
  private async getCustomMetrics(): Promise<{ [key: string]: MetricData }> {
    return {
      claimProcessingRate: {
        timestamp: new Date(),
        value: await this.simulateClaimProcessingRate(),
        unit: 'claims/minute',
        source: 'healthcare'
      },
      documentProcessingQueue: {
        timestamp: new Date(),
        value: await this.simulateDocumentProcessingQueue(),
        unit: 'count',
        source: 'healthcare'
      },
      apiCallsPerSecond: {
        timestamp: new Date(),
        value: await this.simulateAPICallsPerSecond(),
        unit: 'calls/second',
        source: 'api'
      }
    };
  }

  /**
   * Analyze metrics and make scaling decision
   */
  async makeScalingDecision(serviceName: string, currentReplicas: number): Promise<ScalingDecision> {
    const metrics = await this.collectMetrics();
    const triggeredBy: string[] = [];
    let targetReplicas = currentReplicas;
    let action: 'scale-up' | 'scale-down' | 'maintain' = 'maintain';

    // Check CPU threshold
    if (metrics.cpu.value > this.thresholds.cpu.scaleUp) {
      triggeredBy.push(`cpu-high-${metrics.cpu.value}%`);
      targetReplicas = Math.min(targetReplicas + 1, 10); // Max 10 replicas
      action = 'scale-up';
    } else if (metrics.cpu.value < this.thresholds.cpu.scaleDown && currentReplicas > 1) {
      triggeredBy.push(`cpu-low-${metrics.cpu.value}%`);
      targetReplicas = Math.max(targetReplicas - 1, 1); // Min 1 replica
      action = 'scale-down';
    }

    // Check memory threshold
    if (metrics.memory.value > this.thresholds.memory.scaleUp) {
      triggeredBy.push(`memory-high-${metrics.memory.value}%`);
      if (action !== 'scale-up') {
        targetReplicas = Math.min(targetReplicas + 1, 10);
        action = 'scale-up';
      }
    } else if (metrics.memory.value < this.thresholds.memory.scaleDown && currentReplicas > 1) {
      triggeredBy.push(`memory-low-${metrics.memory.value}%`);
      if (action !== 'scale-up') {
        targetReplicas = Math.max(targetReplicas - 1, 1);
        action = 'scale-down';
      }
    }

    // Check request rate threshold
    if (metrics.requestRate.value > this.thresholds.requestRate.scaleUp) {
      triggeredBy.push(`request-rate-high-${metrics.requestRate.value}`);
      if (action !== 'scale-up') {
        targetReplicas = Math.min(targetReplicas + 2, 10); // Scale up by 2 for high request rate
        action = 'scale-up';
      }
    }

    // Check response time threshold
    if (metrics.responseTime.value > this.thresholds.responseTime.scaleUp) {
      triggeredBy.push(`response-time-high-${metrics.responseTime.value}ms`);
      if (action !== 'scale-up') {
        targetReplicas = Math.min(targetReplicas + 1, 10);
        action = 'scale-up';
      }
    }

    // Check error rate threshold
    if (metrics.errorRate.value > this.thresholds.errorRate.scaleUp) {
      triggeredBy.push(`error-rate-high-${metrics.errorRate.value}%`);
      if (action !== 'scale-up') {
        targetReplicas = Math.min(targetReplicas + 1, 10);
        action = 'scale-up';
      }
    }

    // Check queue length for healthcare-specific scaling
    if (metrics.queueLength.value > this.thresholds.queueLength.scaleUp) {
      triggeredBy.push(`queue-length-high-${metrics.queueLength.value}`);
      if (action !== 'scale-up') {
        targetReplicas = Math.min(targetReplicas + 2, 10);
        action = 'scale-up';
      }
    }

    // Calculate confidence based on number of triggered metrics
    const confidence = Math.min(triggeredBy.length * 0.25, 1.0);

    return {
      action,
      currentReplicas,
      targetReplicas,
      triggeredBy,
      confidence,
      timestamp: new Date(),
      metrics
    };
  }

  /**
   * Store metrics for historical analysis
   */
  private storeMetrics(metrics: ScalingMetrics): void {
    const timestamp = new Date();
    
    // Store each metric type
    Object.entries(metrics).forEach(([key, value]) => {
      if (key !== 'customMetrics') {
        const metricArray = this.metrics.get(key) || [];
        metricArray.push(value as MetricData);
        
        // Keep only recent metrics based on retention policy
        const cutoff = new Date(Date.now() - this.config.retention);
        const filteredMetrics = metricArray.filter(m => m.timestamp > cutoff);
        
        this.metrics.set(key, filteredMetrics);
      }
    });

    // Store custom metrics
    Object.entries(metrics.customMetrics).forEach(([key, value]) => {
      const metricArray = this.metrics.get(`custom_${key}`) || [];
      metricArray.push(value);
      
      const cutoff = new Date(Date.now() - this.config.retention);
      const filteredMetrics = metricArray.filter(m => m.timestamp > cutoff);
      
      this.metrics.set(`custom_${key}`, filteredMetrics);
    });
  }

  /**
   * Get historical metrics for analysis
   */
  getHistoricalMetrics(metricName: string, timeRange?: number): MetricData[] {
    const metrics = this.metrics.get(metricName) || [];
    
    if (!timeRange) {
      return metrics;
    }
    
    const cutoff = new Date(Date.now() - timeRange);
    return metrics.filter(m => m.timestamp > cutoff);
  }

  /**
   * Get aggregated metrics over time window
   */
  getAggregatedMetrics(metricName: string, timeWindow: number): {
    avg: number;
    min: number;
    max: number;
    count: number;
  } {
    const metrics = this.getHistoricalMetrics(metricName, timeWindow);
    
    if (metrics.length === 0) {
      return { avg: 0, min: 0, max: 0, count: 0 };
    }
    
    const values = metrics.map(m => m.value);
    
    return {
      avg: values.reduce((sum, val) => sum + val, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length
    };
  }

  // Simulation methods (replace with actual monitoring integrations)
  private async simulateCPUCollection(): Promise<number> {
    return Math.random() * 100;
  }

  private async simulateMemoryCollection(): Promise<number> {
    return Math.random() * 100;
  }

  private async simulateRequestRateCollection(): Promise<number> {
    return Math.random() * 1000;
  }

  private async simulateResponseTimeCollection(): Promise<number> {
    return Math.random() * 500;
  }

  private async simulateErrorRateCollection(): Promise<number> {
    return Math.random() * 10;
  }

  private async simulateQueueLengthCollection(): Promise<number> {
    return Math.floor(Math.random() * 100);
  }

  private async simulateClaimProcessingRate(): Promise<number> {
    return Math.random() * 50;
  }

  private async simulateDocumentProcessingQueue(): Promise<number> {
    return Math.floor(Math.random() * 200);
  }

  private async simulateAPICallsPerSecond(): Promise<number> {
    return Math.random() * 100;
  }
}
