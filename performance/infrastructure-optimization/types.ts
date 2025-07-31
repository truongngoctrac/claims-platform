/**
 * Infrastructure Optimization Types and Interfaces
 * Comprehensive types for infrastructure performance optimization
 */

export interface ServerResourceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkIOPS: number;
  loadAverage: number[];
  uptime: number;
  activeConnections: number;
  processingTime: number;
}

export interface ContainerMetrics {
  containerId: string;
  containerName: string;
  cpuUsage: number;
  memoryUsage: number;
  memoryLimit: number;
  networkRx: number;
  networkTx: number;
  diskRead: number;
  diskWrite: number;
  restartCount: number;
  status: 'running' | 'stopped' | 'failed' | 'pending';
}

export interface NetworkPerformanceMetrics {
  latency: number;
  throughput: number;
  packetLoss: number;
  bandwidth: number;
  connectionPoolSize: number;
  activeConnections: number;
  connectionErrors: number;
  responseTime: number;
}

export interface StorageMetrics {
  readLatency: number;
  writeLatency: number;
  iops: number;
  throughput: number;
  utilization: number;
  availableSpace: number;
  fragmentationLevel: number;
  backupStatus: 'success' | 'failed' | 'in-progress' | 'pending';
}

export interface LoadBalancerMetrics {
  totalRequests: number;
  activeConnections: number;
  responseTime: number;
  errorRate: number;
  targetHealthStatus: TargetHealth[];
  sslTerminationTime: number;
  requestDistribution: RequestDistribution[];
}

export interface TargetHealth {
  targetId: string;
  status: 'healthy' | 'unhealthy' | 'draining';
  responseTime: number;
  activeConnections: number;
}

export interface RequestDistribution {
  targetId: string;
  requestCount: number;
  responseTime: number;
  errorCount: number;
}

export interface AutoScalingMetrics {
  currentCapacity: number;
  desiredCapacity: number;
  minCapacity: number;
  maxCapacity: number;
  scalingEvents: ScalingEvent[];
  cooldownPeriod: number;
  utilizationTarget: number;
}

export interface ScalingEvent {
  timestamp: number;
  action: 'scale-up' | 'scale-down';
  reason: string;
  oldCapacity: number;
  newCapacity: number;
  triggeredBy: string;
}

export interface InfrastructureOptimizationConfig {
  server: {
    cpuThreshold: number;
    memoryThreshold: number;
    diskThreshold: number;
    optimizationInterval: number;
    alertThresholds: {
      cpu: number;
      memory: number;
      disk: number;
    };
  };
  container: {
    memoryLimit: number;
    cpuLimit: number;
    restartPolicy: 'always' | 'on-failure' | 'unless-stopped';
    healthCheck: {
      interval: number;
      timeout: number;
      retries: number;
    };
  };
  network: {
    maxConnections: number;
    keepAliveTimeout: number;
    connectionPoolSize: number;
    compressionEnabled: boolean;
    cachingStrategy: 'redis' | 'memory' | 'hybrid';
  };
  storage: {
    cacheSize: number;
    backupFrequency: number;
    compressionEnabled: boolean;
    encryptionEnabled: boolean;
    retentionPolicy: number;
  };
  loadBalancer: {
    algorithm: 'round-robin' | 'least-connections' | 'ip-hash' | 'weighted';
    sessionStickiness: boolean;
    healthCheckInterval: number;
    timeoutSettings: {
      idle: number;
      request: number;
    };
  };
  autoScaling: {
    scaleUpThreshold: number;
    scaleDownThreshold: number;
    cooldownPeriod: number;
    minInstances: number;
    maxInstances: number;
    scalingMetrics: string[];
  };
}

export interface OptimizationRecommendation {
  id: string;
  category: 'server' | 'container' | 'network' | 'storage' | 'load-balancer' | 'auto-scaling';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  expectedImpact: string;
  implementation: string[];
  estimatedCost: number;
  estimatedSavings: number;
  timeline: string;
}

export interface CostOptimizationMetrics {
  currentMonthlyCost: number;
  projectedMonthlyCost: number;
  potentialSavings: number;
  resourceUtilization: ResourceUtilization[];
  rightsizingOpportunities: RightsizingOpportunity[];
  unusedResources: UnusedResource[];
}

export interface ResourceUtilization {
  resourceType: string;
  resourceId: string;
  utilizationPercentage: number;
  cost: number;
  recommendation: string;
}

export interface RightsizingOpportunity {
  resourceId: string;
  currentSize: string;
  recommendedSize: string;
  currentCost: number;
  projectedCost: number;
  savings: number;
}

export interface UnusedResource {
  resourceId: string;
  resourceType: string;
  cost: number;
  lastActivity: number;
  recommendation: string;
}

export interface CapacityPlanningData {
  currentCapacity: number;
  projectedGrowth: number;
  recommendedCapacity: number;
  growthTrends: GrowthTrend[];
  seasonalPatterns: SeasonalPattern[];
  capacityRecommendations: CapacityRecommendation[];
}

export interface GrowthTrend {
  metric: string;
  currentValue: number;
  projectedValue: number;
  growthRate: number;
  confidence: number;
  timeframe: string;
}

export interface SeasonalPattern {
  metric: string;
  pattern: string;
  peakPeriods: string[];
  lowPeriods: string[];
  scalingRecommendation: string;
}

export interface CapacityRecommendation {
  resource: string;
  action: 'increase' | 'decrease' | 'maintain';
  currentCapacity: number;
  recommendedCapacity: number;
  timeline: string;
  reason: string;
}

export interface InfrastructureAsCodeMetrics {
  templateCompliance: number;
  resourceDrift: ResourceDrift[];
  securityCompliance: SecurityCompliance[];
  costOptimizationScore: number;
  bestPracticesScore: number;
}

export interface ResourceDrift {
  resourceId: string;
  resourceType: string;
  driftType: 'configuration' | 'tags' | 'security' | 'policy';
  currentState: any;
  expectedState: any;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface SecurityCompliance {
  rule: string;
  status: 'compliant' | 'non-compliant' | 'not-applicable';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  remediation: string;
}

export interface MonitoringSetupConfig {
  metrics: string[];
  alertingRules: AlertingRule[];
  dashboards: Dashboard[];
  retentionPeriod: number;
  samplingRate: number;
}

export interface AlertingRule {
  name: string;
  condition: string;
  threshold: number;
  severity: 'critical' | 'warning' | 'info';
  notifications: string[];
  description: string;
}

export interface Dashboard {
  name: string;
  widgets: Widget[];
  refreshInterval: number;
  timeRange: string;
}

export interface Widget {
  type: 'chart' | 'table' | 'gauge' | 'stat';
  title: string;
  query: string;
  visualization: any;
}
