/**
 * Container Optimizer
 * Optimizes Docker containers for healthcare applications including resource limits and health monitoring
 */

import { 
  ContainerMetrics, 
  InfrastructureOptimizationConfig, 
  OptimizationRecommendation 
} from './types';

export class ContainerOptimizer {
  private config: InfrastructureOptimizationConfig['container'];
  private containerMetrics: Map<string, ContainerMetrics[]> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(config: InfrastructureOptimizationConfig['container']) {
    this.config = config;
  }

  public async initialize(): Promise<void> {
    console.log('🐳 Initializing Container Optimizer...');
    await this.startHealthChecks();
    await this.optimizeExistingContainers();
  }

  private async startHealthChecks(): Promise<void> {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheck.interval);
  }

  public async getContainerMetrics(containerId?: string): Promise<ContainerMetrics[]> {
    if (containerId) {
      return this.containerMetrics.get(containerId) || [];
    }
    
    // Return all container metrics
    const allMetrics: ContainerMetrics[] = [];
    this.containerMetrics.forEach(metrics => {
      allMetrics.push(...metrics);
    });
    return allMetrics;
  }

  private async performHealthChecks(): Promise<void> {
    const containers = await this.getRunningContainers();
    
    for (const container of containers) {
      const metrics = await this.collectContainerMetrics(container.containerId);
      this.storeMetrics(container.containerId, metrics);
      
      await this.checkContainerHealth(metrics);
      await this.optimizeContainerResources(metrics);
    }
  }

  private async getRunningContainers(): Promise<{ containerId: string; containerName: string }[]> {
    // In real implementation, this would query Docker API
    return [
      { containerId: 'container-1', containerName: 'claims-api' },
      { containerId: 'container-2', containerName: 'user-service' },
      { containerId: 'container-3', containerName: 'policy-service' },
      { containerId: 'container-4', containerName: 'frontend' },
      { containerId: 'container-5', containerName: 'redis-cache' }
    ];
  }

  private async collectContainerMetrics(containerId: string): Promise<ContainerMetrics> {
    // Simulate container metrics collection
    const metrics: ContainerMetrics = {
      containerId,
      containerName: `container-${containerId}`,
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * this.config.memoryLimit,
      memoryLimit: this.config.memoryLimit,
      networkRx: Math.random() * 1000000,
      networkTx: Math.random() * 1000000,
      diskRead: Math.random() * 10000,
      diskWrite: Math.random() * 10000,
      restartCount: Math.floor(Math.random() * 5),
      status: Math.random() > 0.1 ? 'running' : 'failed'
    };

    return metrics;
  }

  private storeMetrics(containerId: string, metrics: ContainerMetrics): void {
    if (!this.containerMetrics.has(containerId)) {
      this.containerMetrics.set(containerId, []);
    }
    
    const containerHistory = this.containerMetrics.get(containerId)!;
    containerHistory.push(metrics);
    
    // Keep only last 50 entries per container
    if (containerHistory.length > 50) {
      containerHistory.splice(0, containerHistory.length - 50);
    }
  }

  private async checkContainerHealth(metrics: ContainerMetrics): Promise<void> {
    const issues = [];

    // Check CPU usage
    if (metrics.cpuUsage > 90) {
      issues.push({
        type: 'high-cpu',
        severity: 'critical',
        message: `Container ${metrics.containerName} CPU usage: ${metrics.cpuUsage.toFixed(2)}%`
      });
    }

    // Check memory usage
    const memoryPercentage = (metrics.memoryUsage / metrics.memoryLimit) * 100;
    if (memoryPercentage > 85) {
      issues.push({
        type: 'high-memory',
        severity: 'warning',
        message: `Container ${metrics.containerName} memory usage: ${memoryPercentage.toFixed(2)}%`
      });
    }

    // Check container status
    if (metrics.status !== 'running') {
      issues.push({
        type: 'container-down',
        severity: 'critical',
        message: `Container ${metrics.containerName} is not running: ${metrics.status}`
      });
    }

    // Check restart count
    if (metrics.restartCount > 3) {
      issues.push({
        type: 'frequent-restarts',
        severity: 'warning',
        message: `Container ${metrics.containerName} has restarted ${metrics.restartCount} times`
      });
    }

    if (issues.length > 0) {
      await this.handleContainerIssues(metrics.containerId, issues);
    }
  }

  private async handleContainerIssues(containerId: string, issues: any[]): Promise<void> {
    for (const issue of issues) {
      console.warn(`🚨 Container Issue [${issue.severity.toUpperCase()}]: ${issue.message}`);
      
      switch (issue.type) {
        case 'high-cpu':
          await this.optimizeCPUUsage(containerId);
          break;
        case 'high-memory':
          await this.optimizeMemoryUsage(containerId);
          break;
        case 'container-down':
          await this.restartContainer(containerId);
          break;
        case 'frequent-restarts':
          await this.investigateRestartCauses(containerId);
          break;
      }
    }
  }

  private async optimizeContainerResources(metrics: ContainerMetrics): Promise<void> {
    // Dynamic resource optimization based on usage patterns
    const history = this.containerMetrics.get(metrics.containerId) || [];
    
    if (history.length >= 10) {
      const avgCpuUsage = history.slice(-10).reduce((sum, m) => sum + m.cpuUsage, 0) / 10;
      const avgMemoryUsage = history.slice(-10).reduce((sum, m) => sum + m.memoryUsage, 0) / 10;
      
      await this.adjustResourceLimits(metrics.containerId, avgCpuUsage, avgMemoryUsage);
    }
  }

  private async adjustResourceLimits(containerId: string, avgCpuUsage: number, avgMemoryUsage: number): Promise<void> {
    const recommendations = [];

    // CPU scaling recommendations
    if (avgCpuUsage > 80) {
      recommendations.push({
        resource: 'cpu',
        action: 'increase',
        currentLimit: this.config.cpuLimit,
        recommendedLimit: this.config.cpuLimit * 1.5
      });
    } else if (avgCpuUsage < 30) {
      recommendations.push({
        resource: 'cpu',
        action: 'decrease',
        currentLimit: this.config.cpuLimit,
        recommendedLimit: this.config.cpuLimit * 0.8
      });
    }

    // Memory scaling recommendations
    const memoryUsagePercentage = (avgMemoryUsage / this.config.memoryLimit) * 100;
    if (memoryUsagePercentage > 80) {
      recommendations.push({
        resource: 'memory',
        action: 'increase',
        currentLimit: this.config.memoryLimit,
        recommendedLimit: this.config.memoryLimit * 1.3
      });
    } else if (memoryUsagePercentage < 40) {
      recommendations.push({
        resource: 'memory',
        action: 'decrease',
        currentLimit: this.config.memoryLimit,
        recommendedLimit: this.config.memoryLimit * 0.9
      });
    }

    if (recommendations.length > 0) {
      console.log(`🔧 Resource adjustment recommendations for ${containerId}:`, recommendations);
      await this.applyResourceAdjustments(containerId, recommendations);
    }
  }

  private async applyResourceAdjustments(containerId: string, recommendations: any[]): Promise<void> {
    // In real implementation, this would apply Docker resource constraints
    console.log(`⚙️ Applying resource adjustments for container ${containerId}`);
    
    for (const rec of recommendations) {
      console.log(`  📊 ${rec.resource}: ${rec.action} from ${rec.currentLimit} to ${rec.recommendedLimit}`);
    }
  }

  private async optimizeCPUUsage(containerId: string): Promise<void> {
    console.log(`⚡ Optimizing CPU usage for container ${containerId}`);
    
    // CPU optimization strategies
    await this.enableCPUThrottling(containerId);
    await this.optimizeProcessScheduling(containerId);
    await this.scaleContainerReplicas(containerId);
  }

  private async optimizeMemoryUsage(containerId: string): Promise<void> {
    console.log(`🧠 Optimizing memory usage for container ${containerId}`);
    
    // Memory optimization strategies
    await this.forceGarbageCollection(containerId);
    await this.optimizeMemoryAllocation(containerId);
    await this.enableMemorySwapping(containerId);
  }

  private async restartContainer(containerId: string): Promise<void> {
    console.log(`🔄 Restarting container ${containerId}`);
    // Implementation would restart the container
  }

  private async investigateRestartCauses(containerId: string): Promise<void> {
    console.log(`🔍 Investigating restart causes for container ${containerId}`);
    // Implementation would analyze container logs and restart patterns
  }

  private async enableCPUThrottling(containerId: string): Promise<void> {
    console.log(`🎚️ Enabling CPU throttling for container ${containerId}`);
    // Implementation would configure CPU throttling
  }

  private async optimizeProcessScheduling(containerId: string): Promise<void> {
    console.log(`⏱️ Optimizing process scheduling for container ${containerId}`);
    // Implementation would optimize process scheduling
  }

  private async scaleContainerReplicas(containerId: string): Promise<void> {
    console.log(`📈 Scaling container replicas for ${containerId}`);
    // Implementation would scale container replicas
  }

  private async forceGarbageCollection(containerId: string): Promise<void> {
    console.log(`🗑️ Forcing garbage collection for container ${containerId}`);
    // Implementation would trigger garbage collection
  }

  private async optimizeMemoryAllocation(containerId: string): Promise<void> {
    console.log(`🎯 Optimizing memory allocation for container ${containerId}`);
    // Implementation would optimize memory allocation
  }

  private async enableMemorySwapping(containerId: string): Promise<void> {
    console.log(`💾 Enabling memory swapping for container ${containerId}`);
    // Implementation would configure memory swapping
  }

  private async optimizeExistingContainers(): Promise<void> {
    const containers = await this.getRunningContainers();
    
    for (const container of containers) {
      await this.optimizeContainerConfiguration(container.containerId);
    }
  }

  private async optimizeContainerConfiguration(containerId: string): Promise<void> {
    console.log(`🔧 Optimizing configuration for container ${containerId}`);
    
    // Container optimization strategies
    await this.optimizeDockerfile(containerId);
    await this.configureHealthChecks(containerId);
    await this.optimizeNetworking(containerId);
    await this.configureLogging(containerId);
  }

  private async optimizeDockerfile(containerId: string): Promise<void> {
    console.log(`📄 Optimizing Dockerfile for container ${containerId}`);
    // Implementation would optimize Dockerfile
  }

  private async configureHealthChecks(containerId: string): Promise<void> {
    console.log(`🏥 Configuring health checks for container ${containerId}`);
    // Implementation would configure container health checks
  }

  private async optimizeNetworking(containerId: string): Promise<void> {
    console.log(`🌐 Optimizing networking for container ${containerId}`);
    // Implementation would optimize container networking
  }

  private async configureLogging(containerId: string): Promise<void> {
    console.log(`📝 Configuring logging for container ${containerId}`);
    // Implementation would configure container logging
  }

  public getOptimizationRecommendations(): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];
    
    // Analyze all container metrics for recommendations
    this.containerMetrics.forEach((metrics, containerId) => {
      const latestMetrics = metrics[metrics.length - 1];
      
      if (latestMetrics) {
        const memoryUsagePercentage = (latestMetrics.memoryUsage / latestMetrics.memoryLimit) * 100;
        
        if (latestMetrics.cpuUsage > 80) {
          recommendations.push({
            id: `cpu-${containerId}`,
            category: 'container',
            priority: 'high',
            title: `CPU Optimization for ${latestMetrics.containerName}`,
            description: 'High CPU usage detected in container',
            expectedImpact: 'Improve container response times',
            implementation: [
              'Increase CPU limits',
              'Optimize application code',
              'Scale container replicas',
              'Enable CPU throttling'
            ],
            estimatedCost: 500,
            estimatedSavings: 1500,
            timeline: '1 week'
          });
        }

        if (memoryUsagePercentage > 85) {
          recommendations.push({
            id: `memory-${containerId}`,
            category: 'container',
            priority: 'critical',
            title: `Memory Optimization for ${latestMetrics.containerName}`,
            description: 'High memory usage may cause container crashes',
            expectedImpact: 'Prevent out-of-memory errors',
            implementation: [
              'Increase memory limits',
              'Optimize memory allocation',
              'Enable memory compression',
              'Fix memory leaks'
            ],
            estimatedCost: 300,
            estimatedSavings: 2000,
            timeline: '3 days'
          });
        }
      }
    });

    return recommendations;
  }

  public generateContainerReport(): any {
    const allMetrics: ContainerMetrics[] = [];
    const containerSummaries: any[] = [];

    this.containerMetrics.forEach((metrics, containerId) => {
      allMetrics.push(...metrics);
      
      if (metrics.length > 0) {
        const latest = metrics[metrics.length - 1];
        const avgCpu = metrics.reduce((sum, m) => sum + m.cpuUsage, 0) / metrics.length;
        const avgMemory = metrics.reduce((sum, m) => sum + m.memoryUsage, 0) / metrics.length;
        
        containerSummaries.push({
          containerId,
          containerName: latest.containerName,
          status: latest.status,
          currentCpuUsage: latest.cpuUsage,
          averageCpuUsage: avgCpu,
          currentMemoryUsage: latest.memoryUsage,
          averageMemoryUsage: avgMemory,
          memoryUtilization: (latest.memoryUsage / latest.memoryLimit) * 100,
          restartCount: latest.restartCount,
          healthStatus: this.getContainerHealthStatus(latest)
        });
      }
    });

    return {
      timestamp: Date.now(),
      totalContainers: containerSummaries.length,
      healthyContainers: containerSummaries.filter(c => c.healthStatus === 'healthy').length,
      containerSummaries,
      recommendations: this.getOptimizationRecommendations(),
      overallHealth: this.getOverallContainerHealth(containerSummaries)
    };
  }

  private getContainerHealthStatus(metrics: ContainerMetrics): string {
    if (metrics.status !== 'running') return 'unhealthy';
    if (metrics.cpuUsage > 90 || (metrics.memoryUsage / metrics.memoryLimit) > 0.9) return 'warning';
    if (metrics.restartCount > 3) return 'warning';
    return 'healthy';
  }

  private getOverallContainerHealth(containerSummaries: any[]): string {
    const unhealthyCount = containerSummaries.filter(c => c.healthStatus === 'unhealthy').length;
    const warningCount = containerSummaries.filter(c => c.healthStatus === 'warning').length;
    
    if (unhealthyCount > 0) return 'critical';
    if (warningCount > containerSummaries.length * 0.3) return 'warning';
    return 'healthy';
  }

  public cleanup(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    console.log('🐳 Container Optimizer cleaned up');
  }
}
