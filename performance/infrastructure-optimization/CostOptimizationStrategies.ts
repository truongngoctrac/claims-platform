/**
 * Cost Optimization Strategies
 * Implements comprehensive cost optimization strategies for healthcare infrastructure
 */

import { 
  CostOptimizationMetrics,
  ResourceUtilization,
  RightsizingOpportunity,
  UnusedResource,
  OptimizationRecommendation 
} from './types';

export class CostOptimizationStrategies {
  private metrics: CostOptimizationMetrics[] = [];
  private resourceInventory: Map<string, any> = new Map();
  private costAnalysisInterval: NodeJS.Timeout | null = null;
  private lastAnalysis: number = 0;

  constructor() {}

  public async initialize(): Promise<void> {
    console.log('💰 Initializing Cost Optimization Strategies...');
    await this.discoverResources();
    await this.initializeCostTracking();
    this.startCostAnalysis();
  }

  private async discoverResources(): Promise<void> {
    console.log('🔍 Discovering infrastructure resources...');
    
    // Simulate resource discovery
    const resources = [
      { id: 'ec2-instance-1', type: 'compute', size: 't3.large', cost: 0.083, utilization: 45 },
      { id: 'ec2-instance-2', type: 'compute', size: 't3.xlarge', cost: 0.166, utilization: 78 },
      { id: 'rds-instance-1', type: 'database', size: 'db.t3.medium', cost: 0.068, utilization: 62 },
      { id: 'elasticache-1', type: 'cache', size: 'cache.t3.micro', cost: 0.017, utilization: 23 },
      { id: 'lb-healthcare-1', type: 'load-balancer', size: 'application', cost: 0.025, utilization: 88 },
      { id: 'ebs-volume-1', type: 'storage', size: '100GB-gp3', cost: 0.08, utilization: 34 },
      { id: 'ebs-volume-2', type: 'storage', size: '500GB-gp3', cost: 0.40, utilization: 91 },
      { id: 'nat-gateway-1', type: 'network', size: 'standard', cost: 0.045, utilization: 12 },
      { id: 's3-bucket-backups', type: 'storage', size: '2TB', cost: 0.046, utilization: 85 },
      { id: 'cloudfront-dist-1', type: 'cdn', size: 'standard', cost: 0.12, utilization: 56 }
    ];

    for (const resource of resources) {
      this.resourceInventory.set(resource.id, {
        ...resource,
        lastActivity: Date.now() - (Math.random() * 7 * 24 * 60 * 60 * 1000), // Random activity within last week
        tags: this.generateResourceTags(resource.type),
        recommendations: []
      });
    }
  }

  private generateResourceTags(resourceType: string): Record<string, string> {
    const commonTags = {
      Environment: Math.random() > 0.5 ? 'production' : 'staging',
      Application: 'healthcare-claims',
      Owner: 'devops-team',
      Project: 'claimflow'
    };

    const typeSpecificTags = {
      compute: { Role: 'web-server', AutoShutdown: 'enabled' },
      database: { BackupRetention: '7-days', MaintenanceWindow: 'sunday-3am' },
      storage: { StorageClass: 'standard', Lifecycle: 'enabled' },
      network: { Purpose: 'nat-gateway', Monitoring: 'enabled' }
    };

    return { ...commonTags, ...(typeSpecificTags[resourceType as keyof typeof typeSpecificTags] || {}) };
  }

  private async initializeCostTracking(): Promise<void> {
    console.log('📊 Initializing cost tracking...');
    
    // Initialize cost tracking for different resource categories
    const initialMetrics = await this.collectCostMetrics();
    this.metrics.push(initialMetrics);
  }

  private startCostAnalysis(): void {
    console.log('🔍 Starting continuous cost analysis...');
    
    this.costAnalysisInterval = setInterval(async () => {
      await this.performCostAnalysis();
      await this.identifyOptimizationOpportunities();
      await this.updateRecommendations();
    }, 3600000); // Analyze every hour
  }

  private async performCostAnalysis(): Promise<void> {
    const metrics = await this.collectCostMetrics();
    this.metrics.push(metrics);
    
    // Keep only last 30 days of metrics
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    this.metrics = this.metrics.filter(m => m.currentMonthlyCost > thirtyDaysAgo);
    
    this.lastAnalysis = Date.now();
  }

  private async collectCostMetrics(): Promise<CostOptimizationMetrics> {
    const resourceUtilization = await this.analyzeResourceUtilization();
    const rightsizingOpportunities = await this.identifyRightsizingOpportunities();
    const unusedResources = await this.identifyUnusedResources();
    
    const currentMonthlyCost = this.calculateCurrentMonthlyCost();
    const projectedMonthlyCost = this.calculateProjectedMonthlyCost(rightsizingOpportunities, unusedResources);
    const potentialSavings = currentMonthlyCost - projectedMonthlyCost;

    return {
      currentMonthlyCost,
      projectedMonthlyCost,
      potentialSavings,
      resourceUtilization,
      rightsizingOpportunities,
      unusedResources
    };
  }

  private async analyzeResourceUtilization(): Promise<ResourceUtilization[]> {
    const utilization: ResourceUtilization[] = [];

    for (const [resourceId, resource] of this.resourceInventory) {
      const utilizationPercentage = resource.utilization;
      const hourlyCost = resource.cost;
      const monthlyCost = hourlyCost * 24 * 30; // Approximate monthly cost

      let recommendation = 'Optimal usage';
      if (utilizationPercentage < 30) {
        recommendation = 'Consider downsizing or terminating';
      } else if (utilizationPercentage > 85) {
        recommendation = 'Consider upgrading for better performance';
      } else if (utilizationPercentage < 50) {
        recommendation = 'Consider downsizing to save costs';
      }

      utilization.push({
        resourceType: resource.type,
        resourceId,
        utilizationPercentage,
        cost: monthlyCost,
        recommendation
      });
    }

    return utilization;
  }

  private async identifyRightsizingOpportunities(): Promise<RightsizingOpportunity[]> {
    const opportunities: RightsizingOpportunity[] = [];

    for (const [resourceId, resource] of this.resourceInventory) {
      if (resource.type === 'compute' && resource.utilization < 50) {
        const currentSize = resource.size;
        const recommendedSize = this.getRecommendedSize(currentSize, resource.utilization);
        
        if (recommendedSize !== currentSize) {
          const currentCost = resource.cost * 24 * 30;
          const projectedCost = this.getCostForSize(recommendedSize) * 24 * 30;
          const savings = currentCost - projectedCost;

          opportunities.push({
            resourceId,
            currentSize,
            recommendedSize,
            currentCost,
            projectedCost,
            savings
          });
        }
      }
    }

    return opportunities;
  }

  private getRecommendedSize(currentSize: string, utilization: number): string {
    const sizeMapping = {
      't3.nano': { cpu: 2, memory: 0.5, cost: 0.0052 },
      't3.micro': { cpu: 2, memory: 1, cost: 0.0104 },
      't3.small': { cpu: 2, memory: 2, cost: 0.0208 },
      't3.medium': { cpu: 2, memory: 4, cost: 0.0416 },
      't3.large': { cpu: 2, memory: 8, cost: 0.0832 },
      't3.xlarge': { cpu: 4, memory: 16, cost: 0.1664 },
      't3.2xlarge': { cpu: 8, memory: 32, cost: 0.3328 }
    };

    const sizes = Object.keys(sizeMapping);
    const currentIndex = sizes.indexOf(currentSize);
    
    if (utilization < 30 && currentIndex > 0) {
      return sizes[Math.max(0, currentIndex - 2)]; // Downsize by 2 levels
    } else if (utilization < 50 && currentIndex > 0) {
      return sizes[currentIndex - 1]; // Downsize by 1 level
    } else if (utilization > 85 && currentIndex < sizes.length - 1) {
      return sizes[currentIndex + 1]; // Upsize by 1 level
    }
    
    return currentSize;
  }

  private getCostForSize(size: string): number {
    const costs: Record<string, number> = {
      't3.nano': 0.0052,
      't3.micro': 0.0104,
      't3.small': 0.0208,
      't3.medium': 0.0416,
      't3.large': 0.0832,
      't3.xlarge': 0.1664,
      't3.2xlarge': 0.3328
    };
    
    return costs[size] || 0.0832; // Default to t3.large cost
  }

  private async identifyUnusedResources(): Promise<UnusedResource[]> {
    const unused: UnusedResource[] = [];
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    for (const [resourceId, resource] of this.resourceInventory) {
      // Consider resource unused if very low utilization and no recent activity
      if (resource.utilization < 10 && resource.lastActivity < oneWeekAgo) {
        const monthlyCost = resource.cost * 24 * 30;
        
        unused.push({
          resourceId,
          resourceType: resource.type,
          cost: monthlyCost,
          lastActivity: resource.lastActivity,
          recommendation: this.getUnusedResourceRecommendation(resource)
        });
      }
    }

    return unused;
  }

  private getUnusedResourceRecommendation(resource: any): string {
    switch (resource.type) {
      case 'compute':
        return 'Consider terminating if no longer needed, or schedule shutdown during off-hours';
      case 'storage':
        return 'Archive to cheaper storage tier or delete if backup data is available';
      case 'database':
        return 'Take final snapshot and terminate if no longer needed';
      case 'network':
        return 'Remove if associated resources have been terminated';
      default:
        return 'Review usage and consider termination';
    }
  }

  private calculateCurrentMonthlyCost(): number {
    let totalCost = 0;
    
    for (const [, resource] of this.resourceInventory) {
      totalCost += resource.cost * 24 * 30; // Convert hourly to monthly
    }
    
    return totalCost;
  }

  private calculateProjectedMonthlyCost(
    rightsizingOpportunities: RightsizingOpportunity[], 
    unusedResources: UnusedResource[]
  ): number {
    let projectedCost = this.calculateCurrentMonthlyCost();
    
    // Subtract savings from rightsizing
    for (const opportunity of rightsizingOpportunities) {
      projectedCost -= opportunity.savings;
    }
    
    // Subtract costs from unused resources
    for (const unused of unusedResources) {
      projectedCost -= unused.cost;
    }
    
    return Math.max(0, projectedCost);
  }

  private async identifyOptimizationOpportunities(): Promise<void> {
    console.log('🎯 Identifying cost optimization opportunities...');
    
    // Reserved Instance opportunities
    await this.analyzeReservedInstanceOpportunities();
    
    // Spot Instance opportunities
    await this.analyzeSpotInstanceOpportunities();
    
    // Storage optimization opportunities
    await this.analyzeStorageOptimizationOpportunities();
    
    // Auto-scaling opportunities
    await this.analyzeAutoScalingOpportunities();
    
    // Scheduled shutdown opportunities
    await this.analyzeScheduledShutdownOpportunities();
  }

  private async analyzeReservedInstanceOpportunities(): Promise<void> {
    console.log('📝 Analyzing Reserved Instance opportunities...');
    
    const stableInstances = Array.from(this.resourceInventory.values())
      .filter(resource => 
        resource.type === 'compute' && 
        resource.tags.Environment === 'production' &&
        resource.utilization > 60
      );

    if (stableInstances.length > 0) {
      console.log(`💡 Found ${stableInstances.length} instances suitable for Reserved Instance pricing`);
    }
  }

  private async analyzeSpotInstanceOpportunities(): Promise<void> {
    console.log('⚡ Analyzing Spot Instance opportunities...');
    
    const developmentInstances = Array.from(this.resourceInventory.values())
      .filter(resource => 
        resource.type === 'compute' && 
        resource.tags.Environment !== 'production' &&
        !resource.tags.Role?.includes('database')
      );

    if (developmentInstances.length > 0) {
      console.log(`💡 Found ${developmentInstances.length} instances suitable for Spot pricing`);
    }
  }

  private async analyzeStorageOptimizationOpportunities(): Promise<void> {
    console.log('💾 Analyzing storage optimization opportunities...');
    
    const storageResources = Array.from(this.resourceInventory.values())
      .filter(resource => resource.type === 'storage');

    for (const storage of storageResources) {
      if (storage.utilization < 50) {
        console.log(`💡 Storage ${storage.id} could benefit from lifecycle policies or compression`);
      }
    }
  }

  private async analyzeAutoScalingOpportunities(): Promise<void> {
    console.log('📈 Analyzing auto-scaling opportunities...');
    
    const computeResources = Array.from(this.resourceInventory.values())
      .filter(resource => resource.type === 'compute');

    const variableUtilization = computeResources.filter(resource => {
      // Simulate checking if utilization varies significantly
      return Math.random() > 0.7; // 30% chance of variable utilization
    });

    if (variableUtilization.length > 0) {
      console.log(`💡 Found ${variableUtilization.length} instances with variable utilization suitable for auto-scaling`);
    }
  }

  private async analyzeScheduledShutdownOpportunities(): Promise<void> {
    console.log('⏰ Analyzing scheduled shutdown opportunities...');
    
    const nonProductionResources = Array.from(this.resourceInventory.values())
      .filter(resource => resource.tags.Environment !== 'production');

    const shutdownCandidates = nonProductionResources.filter(resource => 
      resource.tags.AutoShutdown !== 'enabled'
    );

    if (shutdownCandidates.length > 0) {
      console.log(`💡 Found ${shutdownCandidates.length} non-production resources without auto-shutdown`);
    }
  }

  private async updateRecommendations(): Promise<void> {
    // Update recommendations for each resource based on analysis
    for (const [resourceId, resource] of this.resourceInventory) {
      resource.recommendations = await this.generateResourceRecommendations(resource);
    }
  }

  private async generateResourceRecommendations(resource: any): Promise<string[]> {
    const recommendations: string[] = [];

    // Utilization-based recommendations
    if (resource.utilization < 30) {
      recommendations.push('Consider downsizing or terminating this resource');
    } else if (resource.utilization > 85) {
      recommendations.push('Consider upgrading for better performance');
    }

    // Environment-based recommendations
    if (resource.tags.Environment !== 'production') {
      if (resource.tags.AutoShutdown !== 'enabled') {
        recommendations.push('Enable auto-shutdown during off-hours');
      }
      if (resource.type === 'compute') {
        recommendations.push('Consider using Spot Instances for cost savings');
      }
    } else {
      if (resource.type === 'compute' && resource.utilization > 60) {
        recommendations.push('Consider Reserved Instance pricing for stable workloads');
      }
    }

    // Type-specific recommendations
    switch (resource.type) {
      case 'storage':
        if (resource.utilization < 50) {
          recommendations.push('Implement lifecycle policies to move data to cheaper tiers');
        }
        break;
      case 'database':
        if (resource.utilization < 60) {
          recommendations.push('Consider read replicas or connection pooling optimization');
        }
        break;
      case 'network':
        if (resource.utilization < 20) {
          recommendations.push('Review necessity of this network resource');
        }
        break;
    }

    return recommendations;
  }

  public getOptimizationRecommendations(): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];
    
    if (this.metrics.length === 0) return recommendations;

    const latestMetrics = this.metrics[this.metrics.length - 1];

    // Unused resources recommendations
    if (latestMetrics.unusedResources.length > 0) {
      const totalUnusedCost = latestMetrics.unusedResources.reduce((sum, resource) => sum + resource.cost, 0);
      
      recommendations.push({
        id: 'unused-resources',
        category: 'cost-optimization',
        priority: 'high',
        title: 'Remove Unused Resources',
        description: `${latestMetrics.unusedResources.length} unused resources identified`,
        expectedImpact: `Save $${totalUnusedCost.toFixed(2)} per month`,
        implementation: [
          'Review and validate unused resources',
          'Take necessary backups before termination',
          'Gradually terminate unused resources',
          'Set up automated unused resource detection'
        ],
        estimatedCost: 100,
        estimatedSavings: totalUnusedCost,
        timeline: '1-2 weeks'
      });
    }

    // Rightsizing recommendations
    if (latestMetrics.rightsizingOpportunities.length > 0) {
      const totalRightsizingSavings = latestMetrics.rightsizingOpportunities.reduce((sum, opp) => sum + opp.savings, 0);
      
      recommendations.push({
        id: 'rightsizing-opportunities',
        category: 'cost-optimization',
        priority: 'medium',
        title: 'Rightsize Infrastructure Resources',
        description: `${latestMetrics.rightsizingOpportunities.length} rightsizing opportunities found`,
        expectedImpact: `Save $${totalRightsizingSavings.toFixed(2)} per month`,
        implementation: [
          'Analyze current resource utilization patterns',
          'Test performance with smaller instance sizes',
          'Implement gradual rightsizing with monitoring',
          'Set up automated rightsizing recommendations'
        ],
        estimatedCost: 500,
        estimatedSavings: totalRightsizingSavings,
        timeline: '2-3 weeks'
      });
    }

    // Reserved Instance recommendations
    const productionCompute = Array.from(this.resourceInventory.values())
      .filter(r => r.type === 'compute' && r.tags.Environment === 'production' && r.utilization > 60);
    
    if (productionCompute.length > 0) {
      const reservedInstanceSavings = productionCompute.length * 100; // Approximate $100/month savings per instance
      
      recommendations.push({
        id: 'reserved-instances',
        category: 'cost-optimization',
        priority: 'medium',
        title: 'Implement Reserved Instance Strategy',
        description: `${productionCompute.length} stable production instances suitable for Reserved Instance pricing`,
        expectedImpact: `Save approximately $${reservedInstanceSavings} per month`,
        implementation: [
          'Analyze instance usage patterns over 3-6 months',
          'Purchase Reserved Instances for stable workloads',
          'Consider Convertible RIs for flexibility',
          'Set up RI utilization monitoring'
        ],
        estimatedCost: 0,
        estimatedSavings: reservedInstanceSavings,
        timeline: '1 week'
      });
    }

    // Auto-shutdown recommendations
    const nonProductionWithoutShutdown = Array.from(this.resourceInventory.values())
      .filter(r => r.tags.Environment !== 'production' && r.tags.AutoShutdown !== 'enabled');
    
    if (nonProductionWithoutShutdown.length > 0) {
      const shutdownSavings = nonProductionWithoutShutdown.reduce((sum, r) => sum + (r.cost * 24 * 30 * 0.6), 0); // 60% savings from off-hours shutdown
      
      recommendations.push({
        id: 'auto-shutdown',
        category: 'cost-optimization',
        priority: 'low',
        title: 'Implement Auto-Shutdown for Non-Production Resources',
        description: `${nonProductionWithoutShutdown.length} non-production resources without auto-shutdown`,
        expectedImpact: `Save approximately $${shutdownSavings.toFixed(2)} per month`,
        implementation: [
          'Set up automated shutdown schedules',
          'Configure startup schedules for business hours',
          'Implement exception handling for special cases',
          'Monitor and adjust schedules based on usage'
        ],
        estimatedCost: 200,
        estimatedSavings: shutdownSavings,
        timeline: '1 week'
      });
    }

    return recommendations;
  }

  public generateCostOptimizationReport(): any {
    const latestMetrics = this.metrics[this.metrics.length - 1];
    
    if (!latestMetrics) {
      return {
        timestamp: Date.now(),
        error: 'No cost metrics available',
        recommendations: []
      };
    }

    const costTrend = this.calculateCostTrend();
    const utilizationSummary = this.calculateUtilizationSummary(latestMetrics.resourceUtilization);
    
    return {
      timestamp: Date.now(),
      costMetrics: {
        currentMonthlyCost: latestMetrics.currentMonthlyCost,
        projectedMonthlyCost: latestMetrics.projectedMonthlyCost,
        potentialSavings: latestMetrics.potentialSavings,
        savingsPercentage: (latestMetrics.potentialSavings / latestMetrics.currentMonthlyCost) * 100,
        costTrend
      },
      resourceAnalysis: {
        totalResources: this.resourceInventory.size,
        resourcesByType: this.getResourcesByType(),
        utilizationSummary,
        unusedResourcesCount: latestMetrics.unusedResources.length,
        rightsizingOpportunitiesCount: latestMetrics.rightsizingOpportunities.length
      },
      optimizationOpportunities: {
        unusedResources: latestMetrics.unusedResources,
        rightsizingOpportunities: latestMetrics.rightsizingOpportunities,
        estimatedMonthlySavings: latestMetrics.potentialSavings
      },
      recommendations: this.getOptimizationRecommendations(),
      costOptimizationHealth: this.getCostOptimizationHealthStatus(latestMetrics),
      lastAnalysis: this.lastAnalysis
    };
  }

  private calculateCostTrend(): { direction: string; percentage: number } {
    if (this.metrics.length < 2) {
      return { direction: 'stable', percentage: 0 };
    }

    const current = this.metrics[this.metrics.length - 1].currentMonthlyCost;
    const previous = this.metrics[this.metrics.length - 2].currentMonthlyCost;
    
    const change = ((current - previous) / previous) * 100;
    
    let direction = 'stable';
    if (change > 5) direction = 'increasing';
    else if (change < -5) direction = 'decreasing';
    
    return { direction, percentage: Math.abs(change) };
  }

  private calculateUtilizationSummary(resourceUtilization: ResourceUtilization[]): any {
    if (resourceUtilization.length === 0) {
      return { average: 0, underutilized: 0, overutilized: 0, optimal: 0 };
    }

    const total = resourceUtilization.reduce((sum, r) => sum + r.utilizationPercentage, 0);
    const average = total / resourceUtilization.length;
    
    const underutilized = resourceUtilization.filter(r => r.utilizationPercentage < 50).length;
    const overutilized = resourceUtilization.filter(r => r.utilizationPercentage > 85).length;
    const optimal = resourceUtilization.length - underutilized - overutilized;
    
    return {
      average: average.toFixed(1),
      underutilized,
      overutilized,
      optimal,
      distribution: {
        'Under 30%': resourceUtilization.filter(r => r.utilizationPercentage < 30).length,
        '30-50%': resourceUtilization.filter(r => r.utilizationPercentage >= 30 && r.utilizationPercentage < 50).length,
        '50-70%': resourceUtilization.filter(r => r.utilizationPercentage >= 50 && r.utilizationPercentage < 70).length,
        '70-85%': resourceUtilization.filter(r => r.utilizationPercentage >= 70 && r.utilizationPercentage <= 85).length,
        'Over 85%': resourceUtilization.filter(r => r.utilizationPercentage > 85).length
      }
    };
  }

  private getResourcesByType(): Record<string, number> {
    const typeCount: Record<string, number> = {};
    
    for (const [, resource] of this.resourceInventory) {
      typeCount[resource.type] = (typeCount[resource.type] || 0) + 1;
    }
    
    return typeCount;
  }

  private getCostOptimizationHealthStatus(metrics: CostOptimizationMetrics): string {
    const savingsPercentage = (metrics.potentialSavings / metrics.currentMonthlyCost) * 100;
    const unusedResourcesRatio = metrics.unusedResources.length / this.resourceInventory.size;
    
    if (savingsPercentage > 30 || unusedResourcesRatio > 0.2) {
      return 'Critical - High cost optimization potential';
    } else if (savingsPercentage > 15 || unusedResourcesRatio > 0.1) {
      return 'Warning - Moderate optimization opportunities';
    } else {
      return 'Healthy - Well optimized costs';
    }
  }

  public cleanup(): void {
    if (this.costAnalysisInterval) {
      clearInterval(this.costAnalysisInterval);
      this.costAnalysisInterval = null;
    }
    
    console.log('💰 Cost Optimization Strategies cleaned up');
  }
}
