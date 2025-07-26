/**
 * Auto-Scaling Service
 * Healthcare Claims Processing - Horizontal Auto-Scaling Implementation
 */

import { AutoScalingConfig, ScalingEvent } from '../types';

export class AutoScalingService {
  private scalingEvents: ScalingEvent[] = [];
  private currentReplicas: Map<string, number> = new Map();
  private lastScaleAction: Map<string, Date> = new Map();
  private metricsCache: Map<string, any> = new Map();

  constructor(private config: AutoScalingConfig) {
    // Initialize default replica counts
    this.currentReplicas.set('claims-service', 3);
    this.currentReplicas.set('user-service', 2);
    this.currentReplicas.set('policy-service', 2);
  }

  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      console.log('⚠️ Auto-scaling is disabled');
      return;
    }

    console.log('🔄 Initializing Auto-Scaling Service');
    
    // Start metrics collection
    this.startMetricsCollection();
    
    // Start scaling decision engine
    this.startScalingEngine();
    
    console.log('✅ Auto-Scaling Service initialized');
  }

  private startMetricsCollection(): void {
    setInterval(async () => {
      await this.collectMetrics();
    }, 30000); // Collect metrics every 30 seconds
  }

  private startScalingEngine(): void {
    setInterval(async () => {
      await this.evaluateScalingDecisions();
    }, 60000); // Evaluate scaling every minute
  }

  private async collectMetrics(): Promise<void> {
    try {
      // In production, collect real metrics from monitoring system
      const services = ['claims-service', 'user-service', 'policy-service'];
      
      for (const service of services) {
        const metrics = await this.getServiceMetrics(service);
        this.metricsCache.set(service, {
          ...metrics,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('Error collecting metrics:', error);
    }
  }

  private async getServiceMetrics(serviceName: string): Promise<any> {
    // Simulate metrics collection
    // In production, this would query Prometheus, CloudWatch, etc.
    return {
      cpuUtilization: Math.random() * 100,
      memoryUtilization: Math.random() * 100,
      requestsPerSecond: Math.random() * 1000,
      responseTime: Math.random() * 1000,
      errorRate: Math.random() * 5,
      activeConnections: Math.random() * 500
    };
  }

  private async evaluateScalingDecisions(): Promise<void> {
    if (!this.config.enabled) return;

    const services = Array.from(this.currentReplicas.keys());
    
    for (const service of services) {
      const metrics = this.metricsCache.get(service);
      if (!metrics) continue;

      const scalingDecision = this.makeScalingDecision(service, metrics);
      
      if (scalingDecision.action !== 'maintain') {
        await this.executeScalingAction(service, scalingDecision);
      }
    }
  }

  private makeScalingDecision(serviceName: string, metrics: any): {
    action: 'scale-up' | 'scale-down' | 'maintain';
    targetReplicas: number;
    reason: string;
  } {
    const currentReplicas = this.currentReplicas.get(serviceName) || 1;
    const lastAction = this.lastScaleAction.get(serviceName);
    
    // Check cooldown period
    if (lastAction) {
      const timeSinceLastAction = Date.now() - lastAction.getTime();
      const cooldownPeriod = this.config.scaleUpCooldown * 1000; // Convert to milliseconds
      
      if (timeSinceLastAction < cooldownPeriod) {
        return {
          action: 'maintain',
          targetReplicas: currentReplicas,
          reason: 'Cooldown period active'
        };
      }
    }

    // Scale up conditions
    if (
      (metrics.cpuUtilization > this.config.targetCPUUtilization + 10) ||
      (metrics.memoryUtilization > this.config.targetMemoryUtilization + 10) ||
      (metrics.responseTime > 2000) ||
      (metrics.errorRate > 2)
    ) {
      const targetReplicas = Math.min(currentReplicas + 1, this.config.maxInstances);
      
      if (targetReplicas > currentReplicas) {
        return {
          action: 'scale-up',
          targetReplicas,
          reason: `High resource utilization: CPU=${metrics.cpuUtilization.toFixed(1)}%, Memory=${metrics.memoryUtilization.toFixed(1)}%`
        };
      }
    }

    // Scale down conditions
    if (
      (metrics.cpuUtilization < this.config.targetCPUUtilization - 20) &&
      (metrics.memoryUtilization < this.config.targetMemoryUtilization - 20) &&
      (metrics.responseTime < 500) &&
      (metrics.errorRate < 0.5)
    ) {
      const targetReplicas = Math.max(currentReplicas - 1, this.config.minInstances);
      
      if (targetReplicas < currentReplicas) {
        return {
          action: 'scale-down',
          targetReplicas,
          reason: `Low resource utilization: CPU=${metrics.cpuUtilization.toFixed(1)}%, Memory=${metrics.memoryUtilization.toFixed(1)}%`
        };
      }
    }

    return {
      action: 'maintain',
      targetReplicas: currentReplicas,
      reason: 'Metrics within target thresholds'
    };
  }

  private async executeScalingAction(
    serviceName: string, 
    decision: { action: string; targetReplicas: number; reason: string }
  ): Promise<void> {
    const currentReplicas = this.currentReplicas.get(serviceName) || 1;
    
    console.log(
      `🎯 Scaling ${serviceName}: ${currentReplicas} → ${decision.targetReplicas} replicas (${decision.reason})`
    );

    try {
      // Execute the scaling action
      await this.scaleService(serviceName, decision.targetReplicas);
      
      // Record the scaling event
      const scalingEvent: ScalingEvent = {
        timestamp: new Date(),
        serviceName,
        action: decision.action as 'scale-up' | 'scale-down',
        fromReplicas: currentReplicas,
        toReplicas: decision.targetReplicas,
        reason: decision.reason,
        metrics: this.metricsCache.get(serviceName) || {}
      };
      
      this.scalingEvents.push(scalingEvent);
      this.currentReplicas.set(serviceName, decision.targetReplicas);
      this.lastScaleAction.set(serviceName, new Date());
      
      console.log(`✅ Successfully scaled ${serviceName}`);
      
    } catch (error) {
      console.error(`❌ Failed to scale ${serviceName}:`, error);
    }
  }

  async scaleService(serviceName: string, replicas: number): Promise<void> {
    // In production, this would interact with Kubernetes, Docker Swarm, etc.
    console.log(`🔄 Scaling ${serviceName} to ${replicas} replicas`);
    
    // Simulate scaling delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Update internal state
    this.currentReplicas.set(serviceName, replicas);
    
    // Generate scaling commands based on environment
    await this.generateScalingCommands(serviceName, replicas);
  }

  private async generateScalingCommands(serviceName: string, replicas: number): Promise<void> {
    const kubernetesCommand = `kubectl scale deployment ${serviceName} --replicas=${replicas}`;
    const dockerCommand = `docker service scale ${serviceName}=${replicas}`;
    const composeCommand = `docker-compose up -d --scale ${serviceName}=${replicas}`;
    
    console.log('📋 Generated scaling commands:');
    console.log(`  Kubernetes: ${kubernetesCommand}`);
    console.log(`  Docker Swarm: ${dockerCommand}`);
    console.log(`  Docker Compose: ${composeCommand}`);
    
    // In production, execute the appropriate command based on orchestration platform
  }

  async getMetrics(): Promise<any> {
    const serviceMetrics = Array.from(this.currentReplicas.entries()).map(([service, replicas]) => ({
      service,
      currentReplicas: replicas,
      minReplicas: this.config.minInstances,
      maxReplicas: this.config.maxInstances,
      metrics: this.metricsCache.get(service) || {},
      lastScaleAction: this.lastScaleAction.get(service)
    }));

    return {
      enabled: this.config.enabled,
      totalServices: this.currentReplicas.size,
      totalReplicas: Array.from(this.currentReplicas.values()).reduce((sum, count) => sum + count, 0),
      scalingEvents: this.scalingEvents.slice(-10), // Last 10 events
      services: serviceMetrics,
      config: {
        targetCPUUtilization: this.config.targetCPUUtilization,
        targetMemoryUtilization: this.config.targetMemoryUtilization,
        scaleUpCooldown: this.config.scaleUpCooldown,
        scaleDownCooldown: this.config.scaleDownCooldown
      }
    };
  }

  async isHealthy(): Promise<boolean> {
    if (!this.config.enabled) return true;

    try {
      // Check if metrics are being collected
      const metricsAge = Date.now() - (this.metricsCache.get('claims-service')?.timestamp?.getTime() || 0);
      if (metricsAge > 120000) { // 2 minutes
        console.warn('Auto-scaling metrics are stale');
        return false;
      }

      // Check if all services are within replica bounds
      for (const [service, replicas] of this.currentReplicas.entries()) {
        if (replicas < this.config.minInstances || replicas > this.config.maxInstances) {
          console.warn(`Service ${service} has ${replicas} replicas, outside bounds [${this.config.minInstances}, ${this.config.maxInstances}]`);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Auto-scaling health check failed:', error);
      return false;
    }
  }

  async forceScale(serviceName: string, replicas: number): Promise<void> {
    if (replicas < this.config.minInstances || replicas > this.config.maxInstances) {
      throw new Error(`Replica count ${replicas} is outside allowed bounds [${this.config.minInstances}, ${this.config.maxInstances}]`);
    }

    console.log(`🚀 Force scaling ${serviceName} to ${replicas} replicas`);
    await this.scaleService(serviceName, replicas);
  }

  getScalingHistory(serviceName?: string): ScalingEvent[] {
    if (serviceName) {
      return this.scalingEvents.filter(event => event.serviceName === serviceName);
    }
    return this.scalingEvents;
  }

  async setTargetMetrics(cpuTarget: number, memoryTarget: number): Promise<void> {
    this.config.targetCPUUtilization = cpuTarget;
    this.config.targetMemoryUtilization = memoryTarget;
    
    console.log(`🎯 Updated scaling targets: CPU=${cpuTarget}%, Memory=${memoryTarget}%`);
  }
}
