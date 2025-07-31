/**
 * Scaling Performance Monitoring System
 * Healthcare Claims Processing System
 */

export interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  source: string;
  category: 'resource' | 'application' | 'business' | 'healthcare';
  criticality: 'low' | 'medium' | 'high' | 'critical';
  tags: { [key: string]: string };
}

export interface ScalingPerformanceSnapshot {
  timestamp: Date;
  scalingEvent: ScalingEventInfo;
  beforeMetrics: PerformanceMetric[];
  afterMetrics: PerformanceMetric[];
  impactAnalysis: ScalingImpactAnalysis;
  healthcareMetrics: HealthcarePerformanceMetrics;
}

export interface ScalingEventInfo {
  eventId: string;
  serviceName: string;
  action: 'scale-up' | 'scale-down' | 'migrate' | 'failover';
  fromReplicas: number;
  toReplicas: number;
  trigger: string;
  duration: number;
  cost: number;
  success: boolean;
  region: string;
}

export interface ScalingImpactAnalysis {
  responseTimeImprovement: number;
  throughputImprovement: number;
  errorRateChange: number;
  resourceUtilizationChange: number;
  costEfficiency: number;
  overallImpactScore: number;
  recommendations: string[];
}

export interface HealthcarePerformanceMetrics {
  claimProcessingRate: number;
  documentProcessingLatency: number;
  complianceScore: number;
  patientSafetyScore: number;
  emergencyResponseTime: number;
  dataIntegrityScore: number;
  auditTrailCompleteness: number;
  hipaaViolations: number;
}

export interface PerformanceAlert {
  id: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  description: string;
  metric: string;
  currentValue: number;
  threshold: number;
  serviceName: string;
  healthcareImpact: string;
  recommendedActions: string[];
  escalated: boolean;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface PerformanceTrend {
  metricName: string;
  timeRange: number;
  trend: 'improving' | 'degrading' | 'stable' | 'volatile';
  changeRate: number;
  confidence: number;
  prediction: {
    nextHour: number;
    nextDay: number;
    nextWeek: number;
  };
  seasonalPattern: boolean;
}

export interface MonitoringConfiguration {
  metricsCollectionInterval: number;
  alertingEnabled: boolean;
  retentionPeriod: number;
  aggregationWindows: number[];
  healthcareSpecific: {
    patientSafetyMonitoring: boolean;
    complianceTracking: boolean;
    emergencyResponseTracking: boolean;
    auditLogging: boolean;
  };
  integrations: {
    prometheus: boolean;
    datadog: boolean;
    newrelic: boolean;
    splunk: boolean;
  };
}

export interface HealthcareComplianceMetrics {
  hipaaCompliance: {
    score: number;
    violations: number;
    lastAudit: Date;
    nextAudit: Date;
  };
  dataResidency: {
    compliant: boolean;
    violations: string[];
    regions: string[];
  };
  auditTrail: {
    completeness: number;
    lastBackup: Date;
    integrity: boolean;
  };
  accessControls: {
    score: number;
    failedAttempts: number;
    privilegedAccess: number;
  };
}

export class ScalingPerformanceMonitoring {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private snapshots: ScalingPerformanceSnapshot[] = [];
  private alerts: Map<string, PerformanceAlert> = new Map();
  private trends: Map<string, PerformanceTrend> = new Map();
  private config: MonitoringConfiguration;
  private isMonitoring: boolean = false;
  private monitoringTimer?: NodeJS.Timeout;

  constructor(config: MonitoringConfiguration) {
    this.config = config;
    this.initializeHealthcareMonitoring();
  }

  /**
   * Initialize healthcare-specific monitoring
   */
  private initializeHealthcareMonitoring(): void {
    console.log('🏥 Initializing healthcare performance monitoring');
    
    // Setup healthcare-specific metric collection
    if (this.config.healthcareSpecific.patientSafetyMonitoring) {
      this.setupPatientSafetyMonitoring();
    }
    
    if (this.config.healthcareSpecific.complianceTracking) {
      this.setupComplianceTracking();
    }
    
    if (this.config.healthcareSpecific.emergencyResponseTracking) {
      this.setupEmergencyResponseTracking();
    }
    
    if (this.config.healthcareSpecific.auditLogging) {
      this.setupAuditLogging();
    }
  }

  /**
   * Start performance monitoring
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.log('⚠️ Performance monitoring is already running');
      return;
    }

    console.log('📊 Starting scaling performance monitoring');
    this.isMonitoring = true;

    // Start periodic metrics collection
    this.monitoringTimer = setInterval(async () => {
      await this.collectPerformanceMetrics();
      await this.analyzePerformanceTrends();
      await this.checkAlertConditions();
    }, this.config.metricsCollectionInterval);

    console.log('✅ Performance monitoring started');
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = undefined;
    }
    
    this.isMonitoring = false;
    console.log('⏹️ Performance monitoring stopped');
  }

  /**
   * Record scaling performance snapshot
   */
  async recordScalingSnapshot(scalingEvent: ScalingEventInfo): Promise<ScalingPerformanceSnapshot> {
    console.log(`📸 Recording scaling performance snapshot for: ${scalingEvent.serviceName}`);

    // Collect before metrics (if available from cache)
    const beforeMetrics = await this.getRecentMetrics(scalingEvent.serviceName, 300000); // 5 minutes before

    // Wait for scaling to complete and collect after metrics
    await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
    const afterMetrics = await this.collectServiceMetrics(scalingEvent.serviceName);

    // Analyze impact
    const impactAnalysis = this.analyzeScalingImpact(beforeMetrics, afterMetrics);

    // Collect healthcare-specific metrics
    const healthcareMetrics = await this.collectHealthcareMetrics(scalingEvent.serviceName);

    const snapshot: ScalingPerformanceSnapshot = {
      timestamp: new Date(),
      scalingEvent,
      beforeMetrics,
      afterMetrics,
      impactAnalysis,
      healthcareMetrics
    };

    this.snapshots.push(snapshot);

    // Keep only recent snapshots
    if (this.snapshots.length > 100) {
      this.snapshots.splice(0, this.snapshots.length - 100);
    }

    console.log(`✅ Scaling snapshot recorded with impact score: ${impactAnalysis.overallImpactScore}`);
    return snapshot;
  }

  /**
   * Collect current performance metrics
   */
  private async collectPerformanceMetrics(): Promise<void> {
    const timestamp = new Date();
    const services = ['claims-processor', 'document-processor', 'emergency-processor', 'notification-service'];

    for (const service of services) {
      const serviceMetrics = await this.collectServiceMetrics(service);
      
      if (!this.metrics.has(service)) {
        this.metrics.set(service, []);
      }
      
      const metrics = this.metrics.get(service)!;
      metrics.push(...serviceMetrics);
      
      // Keep only recent metrics based on retention period
      const cutoff = new Date(Date.now() - this.config.retentionPeriod);
      const filteredMetrics = metrics.filter(m => m.timestamp > cutoff);
      this.metrics.set(service, filteredMetrics);
    }
  }

  /**
   * Collect metrics for specific service
   */
  private async collectServiceMetrics(serviceName: string): Promise<PerformanceMetric[]> {
    const timestamp = new Date();
    const metrics: PerformanceMetric[] = [];

    // Resource metrics
    metrics.push(
      {
        id: `${serviceName}-cpu-${timestamp.getTime()}`,
        name: 'CPU Utilization',
        value: Math.random() * 80 + 10, // 10-90%
        unit: 'percentage',
        timestamp,
        source: serviceName,
        category: 'resource',
        criticality: 'high',
        tags: { service: serviceName, type: 'cpu' }
      },
      {
        id: `${serviceName}-memory-${timestamp.getTime()}`,
        name: 'Memory Utilization',
        value: Math.random() * 75 + 15, // 15-90%
        unit: 'percentage',
        timestamp,
        source: serviceName,
        category: 'resource',
        criticality: 'high',
        tags: { service: serviceName, type: 'memory' }
      },
      {
        id: `${serviceName}-disk-${timestamp.getTime()}`,
        name: 'Disk I/O',
        value: Math.random() * 1000 + 100, // 100-1100 IOPS
        unit: 'iops',
        timestamp,
        source: serviceName,
        category: 'resource',
        criticality: 'medium',
        tags: { service: serviceName, type: 'disk' }
      }
    );

    // Application metrics
    metrics.push(
      {
        id: `${serviceName}-response-time-${timestamp.getTime()}`,
        name: 'Response Time P95',
        value: Math.random() * 1000 + 100, // 100-1100ms
        unit: 'milliseconds',
        timestamp,
        source: serviceName,
        category: 'application',
        criticality: 'critical',
        tags: { service: serviceName, type: 'performance' }
      },
      {
        id: `${serviceName}-throughput-${timestamp.getTime()}`,
        name: 'Throughput',
        value: Math.random() * 500 + 50, // 50-550 RPS
        unit: 'requests_per_second',
        timestamp,
        source: serviceName,
        category: 'application',
        criticality: 'high',
        tags: { service: serviceName, type: 'throughput' }
      },
      {
        id: `${serviceName}-error-rate-${timestamp.getTime()}`,
        name: 'Error Rate',
        value: Math.random() * 5, // 0-5%
        unit: 'percentage',
        timestamp,
        source: serviceName,
        category: 'application',
        criticality: 'critical',
        tags: { service: serviceName, type: 'errors' }
      }
    );

    // Healthcare-specific metrics
    if (serviceName.includes('claims') || serviceName.includes('emergency')) {
      metrics.push(
        {
          id: `${serviceName}-claim-processing-rate-${timestamp.getTime()}`,
          name: 'Claim Processing Rate',
          value: Math.random() * 100 + 20, // 20-120 claims/min
          unit: 'claims_per_minute',
          timestamp,
          source: serviceName,
          category: 'healthcare',
          criticality: 'high',
          tags: { service: serviceName, type: 'healthcare', metric: 'claims' }
        },
        {
          id: `${serviceName}-compliance-score-${timestamp.getTime()}`,
          name: 'HIPAA Compliance Score',
          value: 95 + Math.random() * 5, // 95-100%
          unit: 'percentage',
          timestamp,
          source: serviceName,
          category: 'healthcare',
          criticality: 'critical',
          tags: { service: serviceName, type: 'compliance', standard: 'hipaa' }
        }
      );
    }

    return metrics;
  }

  /**
   * Collect healthcare-specific performance metrics
   */
  private async collectHealthcareMetrics(serviceName: string): Promise<HealthcarePerformanceMetrics> {
    // Simulate healthcare metrics collection
    return {
      claimProcessingRate: 80 + Math.random() * 40, // 80-120 claims/min
      documentProcessingLatency: 500 + Math.random() * 1000, // 500-1500ms
      complianceScore: 95 + Math.random() * 5, // 95-100%
      patientSafetyScore: 98 + Math.random() * 2, // 98-100%
      emergencyResponseTime: 30 + Math.random() * 60, // 30-90 seconds
      dataIntegrityScore: 99 + Math.random() * 1, // 99-100%
      auditTrailCompleteness: 97 + Math.random() * 3, // 97-100%
      hipaaViolations: Math.floor(Math.random() * 3) // 0-2 violations
    };
  }

  /**
   * Analyze scaling impact
   */
  private analyzeScalingImpact(
    beforeMetrics: PerformanceMetric[],
    afterMetrics: PerformanceMetric[]
  ): ScalingImpactAnalysis {
    const getMetricValue = (metrics: PerformanceMetric[], name: string): number => {
      const metric = metrics.find(m => m.name === name);
      return metric ? metric.value : 0;
    };

    const beforeResponseTime = getMetricValue(beforeMetrics, 'Response Time P95');
    const afterResponseTime = getMetricValue(afterMetrics, 'Response Time P95');
    const responseTimeImprovement = ((beforeResponseTime - afterResponseTime) / beforeResponseTime) * 100;

    const beforeThroughput = getMetricValue(beforeMetrics, 'Throughput');
    const afterThroughput = getMetricValue(afterMetrics, 'Throughput');
    const throughputImprovement = ((afterThroughput - beforeThroughput) / beforeThroughput) * 100;

    const beforeErrorRate = getMetricValue(beforeMetrics, 'Error Rate');
    const afterErrorRate = getMetricValue(afterMetrics, 'Error Rate');
    const errorRateChange = afterErrorRate - beforeErrorRate;

    const beforeCPU = getMetricValue(beforeMetrics, 'CPU Utilization');
    const afterCPU = getMetricValue(afterMetrics, 'CPU Utilization');
    const resourceUtilizationChange = afterCPU - beforeCPU;

    // Calculate cost efficiency (simplified)
    const costEfficiency = (throughputImprovement - resourceUtilizationChange) / 2;

    // Overall impact score
    const overallImpactScore = (
      (responseTimeImprovement * 0.3) +
      (throughputImprovement * 0.3) +
      (-errorRateChange * 10 * 0.2) + // Negative error rate change is good
      (-resourceUtilizationChange * 0.1) +
      (costEfficiency * 0.1)
    );

    const recommendations: string[] = [];
    
    if (responseTimeImprovement < 0) {
      recommendations.push('Consider increasing resources further to improve response time');
    }
    
    if (errorRateChange > 1) {
      recommendations.push('Monitor error rate closely as it increased after scaling');
    }
    
    if (costEfficiency < 0) {
      recommendations.push('Review cost efficiency - scaling may not be cost-effective');
    }

    return {
      responseTimeImprovement,
      throughputImprovement,
      errorRateChange,
      resourceUtilizationChange,
      costEfficiency,
      overallImpactScore,
      recommendations
    };
  }

  /**
   * Analyze performance trends
   */
  private async analyzePerformanceTrends(): Promise<void> {
    const services = Array.from(this.metrics.keys());
    
    for (const service of services) {
      const serviceMetrics = this.metrics.get(service) || [];
      const metricNames = [...new Set(serviceMetrics.map(m => m.name))];
      
      for (const metricName of metricNames) {
        const metricData = serviceMetrics
          .filter(m => m.name === metricName)
          .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        
        if (metricData.length >= 10) { // Need at least 10 data points
          const trend = this.calculateTrend(metricData);
          this.trends.set(`${service}-${metricName}`, trend);
        }
      }
    }
  }

  /**
   * Calculate trend for metric data
   */
  private calculateTrend(metricData: PerformanceMetric[]): PerformanceTrend {
    const values = metricData.map(m => m.value);
    const timeRange = metricData[metricData.length - 1].timestamp.getTime() - metricData[0].timestamp.getTime();
    
    // Simple linear regression for trend
    const n = values.length;
    const sumX = values.reduce((sum, _, i) => sum + i, 0);
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + i * val, 0);
    const sumXX = values.reduce((sum, _, i) => sum + i * i, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const changeRate = slope * 100; // Percentage change per data point
    
    // Determine trend direction
    let trend: 'improving' | 'degrading' | 'stable' | 'volatile' = 'stable';
    if (Math.abs(changeRate) > 5) {
      trend = changeRate > 0 ? 'degrading' : 'improving'; // For most metrics, increasing is degrading
    }
    
    // Check volatility
    const variance = values.reduce((sum, val) => {
      const mean = sumY / n;
      return sum + Math.pow(val - mean, 2);
    }, 0) / n;
    
    if (variance > 100) { // Threshold for volatility
      trend = 'volatile';
    }
    
    // Calculate confidence based on R-squared
    const yMean = sumY / n;
    const totalSumSquares = values.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
    const predictions = values.map((_, i) => slope * i + (sumY - slope * sumX) / n);
    const residualSumSquares = values.reduce((sum, val, i) => sum + Math.pow(val - predictions[i], 2), 0);
    const confidence = Math.max(0, 1 - (residualSumSquares / totalSumSquares));
    
    // Simple predictions (linear extrapolation)
    const currentValue = values[values.length - 1];
    const hourlyChange = slope * (3600000 / (timeRange / n)); // Adjust for hourly change
    
    return {
      metricName: metricData[0].name,
      timeRange,
      trend,
      changeRate,
      confidence,
      prediction: {
        nextHour: currentValue + hourlyChange,
        nextDay: currentValue + hourlyChange * 24,
        nextWeek: currentValue + hourlyChange * 24 * 7
      },
      seasonalPattern: false // Simplified - would need more sophisticated analysis
    };
  }

  /**
   * Check alert conditions
   */
  private async checkAlertConditions(): Promise<void> {
    if (!this.config.alertingEnabled) return;

    for (const [service, serviceMetrics] of this.metrics) {
      const recentMetrics = serviceMetrics.filter(m => 
        m.timestamp.getTime() > Date.now() - 300000 // Last 5 minutes
      );

      for (const metric of recentMetrics) {
        await this.evaluateMetricForAlerts(service, metric);
      }
    }
  }

  /**
   * Evaluate metric for alert conditions
   */
  private async evaluateMetricForAlerts(serviceName: string, metric: PerformanceMetric): Promise<void> {
    const alertConditions = this.getAlertConditions(metric.name, metric.category);
    
    for (const condition of alertConditions) {
      if (this.shouldTriggerAlert(metric, condition)) {
        await this.createAlert(serviceName, metric, condition);
      }
    }
  }

  /**
   * Get alert conditions for metric
   */
  private getAlertConditions(metricName: string, category: string): Array<{
    threshold: number;
    operator: 'gt' | 'lt' | 'eq';
    severity: 'info' | 'warning' | 'error' | 'critical';
  }> {
    const conditions = [];
    
    switch (metricName) {
      case 'CPU Utilization':
        conditions.push(
          { threshold: 80, operator: 'gt', severity: 'warning' },
          { threshold: 90, operator: 'gt', severity: 'critical' }
        );
        break;
      case 'Memory Utilization':
        conditions.push(
          { threshold: 85, operator: 'gt', severity: 'warning' },
          { threshold: 95, operator: 'gt', severity: 'critical' }
        );
        break;
      case 'Response Time P95':
        conditions.push(
          { threshold: 2000, operator: 'gt', severity: 'warning' },
          { threshold: 5000, operator: 'gt', severity: 'critical' }
        );
        break;
      case 'Error Rate':
        conditions.push(
          { threshold: 2, operator: 'gt', severity: 'warning' },
          { threshold: 5, operator: 'gt', severity: 'critical' }
        );
        break;
      case 'HIPAA Compliance Score':
        conditions.push(
          { threshold: 98, operator: 'lt', severity: 'warning' },
          { threshold: 95, operator: 'lt', severity: 'critical' }
        );
        break;
    }
    
    return conditions as Array<{
      threshold: number;
      operator: 'gt' | 'lt' | 'eq';
      severity: 'info' | 'warning' | 'error' | 'critical';
    }>;
  }

  /**
   * Check if alert should be triggered
   */
  private shouldTriggerAlert(
    metric: PerformanceMetric, 
    condition: { threshold: number; operator: 'gt' | 'lt' | 'eq'; severity: string }
  ): boolean {
    switch (condition.operator) {
      case 'gt':
        return metric.value > condition.threshold;
      case 'lt':
        return metric.value < condition.threshold;
      case 'eq':
        return metric.value === condition.threshold;
      default:
        return false;
    }
  }

  /**
   * Create performance alert
   */
  private async createAlert(
    serviceName: string, 
    metric: PerformanceMetric, 
    condition: { threshold: number; operator: string; severity: string }
  ): Promise<void> {
    const alertId = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const alert: PerformanceAlert = {
      id: alertId,
      timestamp: new Date(),
      severity: condition.severity as 'info' | 'warning' | 'error' | 'critical',
      title: `${metric.name} Alert - ${serviceName}`,
      description: `${metric.name} is ${metric.value}${metric.unit}, which exceeds threshold of ${condition.threshold}${metric.unit}`,
      metric: metric.name,
      currentValue: metric.value,
      threshold: condition.threshold,
      serviceName,
      healthcareImpact: this.assessHealthcareImpact(metric, condition.severity),
      recommendedActions: this.generateRecommendedActions(metric, condition),
      escalated: condition.severity === 'critical',
      resolved: false
    };

    this.alerts.set(alertId, alert);
    
    console.log(`🚨 Alert created: ${alert.title} (${alert.severity})`);
    
    // If healthcare-critical, log additional context
    if (metric.category === 'healthcare' || condition.severity === 'critical') {
      console.log(`🏥 Healthcare Impact: ${alert.healthcareImpact}`);
    }
  }

  /**
   * Assess healthcare impact of performance issue
   */
  private assessHealthcareImpact(metric: PerformanceMetric, severity: string): string {
    if (metric.category === 'healthcare') {
      switch (severity) {
        case 'critical':
          return 'Immediate impact on patient care and claim processing';
        case 'error':
          return 'Significant impact on healthcare service delivery';
        case 'warning':
          return 'Potential degradation in healthcare service quality';
        default:
          return 'Minimal impact on healthcare operations';
      }
    }
    
    if (metric.name.includes('Response Time') && severity === 'critical') {
      return 'May delay critical healthcare claim processing';
    }
    
    if (metric.name.includes('Error Rate') && severity === 'critical') {
      return 'Could affect patient data integrity and care coordination';
    }
    
    return 'No direct healthcare impact identified';
  }

  /**
   * Generate recommended actions for alert
   */
  private generateRecommendedActions(
    metric: PerformanceMetric, 
    condition: { threshold: number; operator: string; severity: string }
  ): string[] {
    const actions: string[] = [];
    
    switch (metric.name) {
      case 'CPU Utilization':
        actions.push('Scale up instances to distribute load');
        actions.push('Investigate CPU-intensive processes');
        if (condition.severity === 'critical') {
          actions.push('Enable emergency scaling override');
        }
        break;
      case 'Memory Utilization':
        actions.push('Scale up to larger instance types');
        actions.push('Check for memory leaks');
        actions.push('Optimize application memory usage');
        break;
      case 'Response Time P95':
        actions.push('Scale out to reduce per-instance load');
        actions.push('Check database performance');
        actions.push('Review application bottlenecks');
        break;
      case 'Error Rate':
        actions.push('Investigate error logs immediately');
        actions.push('Check downstream dependencies');
        if (metric.category === 'healthcare') {
          actions.push('Verify patient data integrity');
          actions.push('Check HIPAA compliance logs');
        }
        break;
      case 'HIPAA Compliance Score':
        actions.push('Review security controls immediately');
        actions.push('Check audit logs for violations');
        actions.push('Notify compliance team');
        break;
    }
    
    return actions;
  }

  // Setup methods for healthcare-specific monitoring

  private setupPatientSafetyMonitoring(): void {
    console.log('👤 Setting up patient safety monitoring');
    // Implementation would setup specific patient safety metrics
  }

  private setupComplianceTracking(): void {
    console.log('📋 Setting up compliance tracking');
    // Implementation would setup HIPAA and regulatory compliance monitoring
  }

  private setupEmergencyResponseTracking(): void {
    console.log('🚨 Setting up emergency response tracking');
    // Implementation would setup emergency claim processing monitoring
  }

  private setupAuditLogging(): void {
    console.log('📝 Setting up audit logging');
    // Implementation would setup comprehensive audit trail monitoring
  }

  /**
   * Get recent metrics for service
   */
  private async getRecentMetrics(serviceName: string, timeWindow: number): Promise<PerformanceMetric[]> {
    const serviceMetrics = this.metrics.get(serviceName) || [];
    const cutoff = new Date(Date.now() - timeWindow);
    return serviceMetrics.filter(m => m.timestamp > cutoff);
  }

  /**
   * Get performance snapshots
   */
  getPerformanceSnapshots(limit?: number): ScalingPerformanceSnapshot[] {
    const snapshots = this.snapshots.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return limit ? snapshots.slice(0, limit) : snapshots;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Get performance trends
   */
  getPerformanceTrends(): PerformanceTrend[] {
    return Array.from(this.trends.values());
  }

  /**
   * Get metrics for service
   */
  getServiceMetrics(serviceName: string, timeWindow?: number): PerformanceMetric[] {
    const serviceMetrics = this.metrics.get(serviceName) || [];
    
    if (!timeWindow) {
      return serviceMetrics;
    }
    
    const cutoff = new Date(Date.now() - timeWindow);
    return serviceMetrics.filter(m => m.timestamp > cutoff);
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      console.log(`✅ Alert resolved: ${alert.title}`);
      return true;
    }
    return false;
  }

  /**
   * Get compliance metrics
   */
  async getComplianceMetrics(): Promise<HealthcareComplianceMetrics> {
    // Simulate compliance metrics collection
    return {
      hipaaCompliance: {
        score: 98.5,
        violations: 0,
        lastAudit: new Date(Date.now() - 7776000000), // 90 days ago
        nextAudit: new Date(Date.now() + 7776000000) // 90 days from now
      },
      dataResidency: {
        compliant: true,
        violations: [],
        regions: ['us-east-1', 'us-west-2']
      },
      auditTrail: {
        completeness: 99.8,
        lastBackup: new Date(Date.now() - 86400000), // 1 day ago
        integrity: true
      },
      accessControls: {
        score: 96.2,
        failedAttempts: 3,
        privilegedAccess: 12
      }
    };
  }

  /**
   * Check if monitoring is active
   */
  isMonitoringActive(): boolean {
    return this.isMonitoring;
  }
}
