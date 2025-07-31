/**
 * Horizontal Scaling Implementation
 * Healthcare Claims Processing System
 */

export * from './LoadBalancerManager';
export * from './AutoScalingService';
export * from './DatabaseClusterManager';
export * from './MicroserviceScalingManager';
export * from './KubernetesOrchestrator';
export * from './ServiceMeshManager';
export * from './TrafficRoutingOptimizer';
export * from './HealthCheckAutomation';
export * from './FailoverManager';
export * from './CircuitBreakerManager';
export * from './GracefulShutdownManager';
export * from './BlueGreenDeployment';
export * from './CanaryDeployment';
export * from './RollingUpdateManager';
export * from './ZeroDowntimeDeployment';

import { HorizontalScalingConfig } from '../types';
import { LoadBalancerManager } from './LoadBalancerManager';
import { AutoScalingService } from './AutoScalingService';
import { DatabaseClusterManager } from './DatabaseClusterManager';
import { HealthCheckAutomation } from './HealthCheckAutomation';

export class HorizontalScalingManager {
  private loadBalancerManager: LoadBalancerManager;
  private autoScalingService: AutoScalingService;
  private databaseClusterManager: DatabaseClusterManager;
  private healthCheckAutomation: HealthCheckAutomation;

  constructor(private config: HorizontalScalingConfig) {
    this.loadBalancerManager = new LoadBalancerManager(config.loadBalancer);
    this.autoScalingService = new AutoScalingService(config.autoScaling);
    this.databaseClusterManager = new DatabaseClusterManager(config.databaseCluster);
    this.healthCheckAutomation = new HealthCheckAutomation();
  }

  async initialize(): Promise<void> {
    console.log('🔄 Initializing Horizontal Scaling Components');
    
    await Promise.all([
      this.loadBalancerManager.initialize(),
      this.autoScalingService.initialize(),
      this.databaseClusterManager.initialize(),
      this.healthCheckAutomation.initialize()
    ]);

    console.log('✅ Horizontal Scaling Components initialized');
  }

  async scaleService(serviceName: string, replicas: number): Promise<void> {
    console.log(`📈 Scaling service ${serviceName} to ${replicas} replicas`);
    
    // Update load balancer configuration
    await this.loadBalancerManager.updateServiceEndpoints(serviceName, replicas);
    
    // Trigger auto-scaling
    await this.autoScalingService.scaleService(serviceName, replicas);
    
    // Verify health after scaling
    await this.healthCheckAutomation.verifyServiceHealth(serviceName);
    
    console.log(`✅ Service ${serviceName} scaled successfully`);
  }

  async getMetrics(): Promise<any> {
    return {
      loadBalancer: await this.loadBalancerManager.getMetrics(),
      autoScaling: await this.autoScalingService.getMetrics(),
      database: await this.databaseClusterManager.getMetrics(),
      healthChecks: await this.healthCheckAutomation.getMetrics()
    };
  }

  async performHealthCheck(): Promise<boolean> {
    try {
      const results = await Promise.all([
        this.loadBalancerManager.isHealthy(),
        this.autoScalingService.isHealthy(),
        this.databaseClusterManager.isHealthy(),
        this.healthCheckAutomation.isHealthy()
      ]);

      return results.every(result => result === true);
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
}
