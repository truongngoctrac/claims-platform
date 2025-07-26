/**
 * Scalability Types and Interfaces
 * Healthcare Claims Processing System
 */

// Base scalability configuration
export interface ScalabilityConfig {
  horizontalScaling: HorizontalScalingConfig;
  monitoring: MonitoringConfig;
  deployment: DeploymentConfig;
}

// Horizontal scaling configuration
export interface HorizontalScalingConfig {
  loadBalancer: LoadBalancerConfig;
  autoScaling: AutoScalingConfig;
  databaseCluster: DatabaseClusterConfig;
  kubernetes: KubernetesConfig;
  serviceMesh: ServiceMeshConfig;
}

// Load balancer configuration
export interface LoadBalancerConfig {
  type: 'nginx' | 'haproxy' | 'traefik';
  healthCheckPath: string;
  maxConnections: number;
  timeoutMs: number;
  sslEnabled: boolean;
  algorithms: 'round-robin' | 'least-connections' | 'ip-hash';
}

// Auto-scaling configuration
export interface AutoScalingConfig {
  enabled: boolean;
  minInstances: number;
  maxInstances: number;
  targetCPUUtilization: number;
  targetMemoryUtilization: number;
  scaleUpCooldown: number;
  scaleDownCooldown: number;
  metrics: string[];
}

// Database cluster configuration
export interface DatabaseClusterConfig {
  type: 'mongodb' | 'postgresql' | 'mysql';
  replicationFactor: number;
  shardingEnabled: boolean;
  backupStrategy: 'continuous' | 'periodic';
  readReplicas: number;
  writeNodes: number;
}

// Kubernetes configuration
export interface KubernetesConfig {
  namespace: string;
  clusterName: string;
  resourceLimits: ResourceLimits;
  persistentStorage: PersistentStorageConfig;
  networking: NetworkingConfig;
}

export interface ResourceLimits {
  cpu: string;
  memory: string;
  storage: string;
}

export interface PersistentStorageConfig {
  storageClass: string;
  size: string;
  accessModes: string[];
}

export interface NetworkingConfig {
  serviceMeshEnabled: boolean;
  ingressController: string;
  networkPolicies: boolean;
}

// Service mesh configuration
export interface ServiceMeshConfig {
  provider: 'istio' | 'linkerd' | 'consul-connect';
  enableMTLS: boolean;
  tracing: boolean;
  metrics: boolean;
  rateLimiting: boolean;
}

// Monitoring configuration
export interface MonitoringConfig {
  healthChecks: HealthCheckConfig;
  metrics: MetricsConfig;
  alerting: AlertingConfig;
}

export interface HealthCheckConfig {
  intervalSeconds: number;
  timeoutSeconds: number;
  failureThreshold: number;
  successThreshold: number;
  endpoints: string[];
}

export interface MetricsConfig {
  provider: 'prometheus' | 'datadog' | 'newrelic';
  retentionDays: number;
  scrapeInterval: number;
  customMetrics: string[];
}

export interface AlertingConfig {
  provider: 'pagerduty' | 'slack' | 'email';
  thresholds: AlertThresholds;
  channels: string[];
}

export interface AlertThresholds {
  cpuUsage: number;
  memoryUsage: number;
  responseTime: number;
  errorRate: number;
  diskUsage: number;
}

// Deployment configuration
export interface DeploymentConfig {
  strategy: DeploymentStrategy;
  blueGreen: BlueGreenConfig;
  canary: CanaryConfig;
  rollingUpdate: RollingUpdateConfig;
}

export type DeploymentStrategy = 'blue-green' | 'canary' | 'rolling-update' | 'recreate';

export interface BlueGreenConfig {
  enabled: boolean;
  routingPercentage: number;
  rollbackThreshold: number;
  verificationSteps: string[];
}

export interface CanaryConfig {
  enabled: boolean;
  initialTrafficPercentage: number;
  incrementPercentage: number;
  intervalMinutes: number;
  successMetrics: string[];
}

export interface RollingUpdateConfig {
  maxUnavailable: string;
  maxSurge: string;
  batchSize: number;
  pauseBetweenBatches: number;
}

// Service definition
export interface ServiceDefinition {
  name: string;
  version: string;
  replicas: number;
  image: string;
  ports: ServicePort[];
  resources: ResourceLimits;
  healthCheck: HealthCheckConfig;
  environment: { [key: string]: string };
}

export interface ServicePort {
  name: string;
  port: number;
  targetPort: number;
  protocol: 'TCP' | 'UDP';
}

// Scaling event types
export interface ScalingEvent {
  timestamp: Date;
  serviceName: string;
  action: 'scale-up' | 'scale-down' | 'maintain';
  fromReplicas: number;
  toReplicas: number;
  reason: string;
  metrics: { [key: string]: number };
}

// Circuit breaker configuration
export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  monitoringPeriodMs: number;
  expectedExceptionTypes: string[];
}

// Traffic routing configuration
export interface TrafficRoutingConfig {
  rules: TrafficRule[];
  defaultBackend: string;
  enableStickySession: boolean;
  sessionAffinityTTL: number;
}

export interface TrafficRule {
  host: string;
  path: string;
  backend: string;
  weight: number;
  headers?: { [key: string]: string };
}

// Failover configuration
export interface FailoverConfig {
  enabled: boolean;
  detectionTimeoutMs: number;
  maxRetries: number;
  backupRegions: string[];
  autoFailback: boolean;
}

// Infrastructure as Code types
export interface InfrastructureTemplate {
  version: string;
  provider: 'aws' | 'gcp' | 'azure' | 'kubernetes';
  resources: InfrastructureResource[];
  variables: { [key: string]: any };
}

export interface InfrastructureResource {
  type: string;
  name: string;
  properties: { [key: string]: any };
  dependencies?: string[];
}
