/**
 * Infrastructure Optimization Manager
 * Central coordinator for all infrastructure optimization components
 */

import { InfrastructureOptimizationConfig, OptimizationRecommendation } from './types';
import { ServerResourceOptimizer } from './ServerResourceOptimizer';
import { ContainerOptimizer } from './ContainerOptimizer';
import { NetworkPerformanceTuner } from './NetworkPerformanceTuner';
import { StorageOptimizer } from './StorageOptimizer';
import { LoadBalancerOptimizer } from './LoadBalancerOptimizer';
import { AutoScalingConfigurator } from './AutoScalingConfigurator';
import { ResourceMonitoringSetup } from './ResourceMonitoringSetup';
import { CostOptimizationStrategies } from './CostOptimizationStrategies';
import { CapacityPlanningAutomation } from './CapacityPlanningAutomation';
import { InfrastructureAsCodeOptimizer } from './InfrastructureAsCodeOptimizer';

export class InfrastructureOptimizationManager {
  private static instance: InfrastructureOptimizationManager;
  private config: InfrastructureOptimizationConfig;
  
  // Optimization components
  private serverOptimizer: ServerResourceOptimizer;
  private containerOptimizer: ContainerOptimizer;
  private networkTuner: NetworkPerformanceTuner;
  private storageOptimizer: StorageOptimizer;
  private loadBalancerOptimizer: LoadBalancerOptimizer;
  private autoScalingConfigurator: AutoScalingConfigurator;
  private monitoringSetup: ResourceMonitoringSetup;
  private costOptimizer: CostOptimizationStrategies;
  private capacityPlanner: CapacityPlanningAutomation;
  private iacOptimizer: InfrastructureAsCodeOptimizer;

  private optimizationInterval: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;

  private constructor(config: InfrastructureOptimizationConfig) {
    this.config = config;
    
    // Initialize optimization components
    this.serverOptimizer = new ServerResourceOptimizer(config.server);
    this.containerOptimizer = new ContainerOptimizer(config.container);
    this.networkTuner = new NetworkPerformanceTuner(config.network);
    this.storageOptimizer = new StorageOptimizer(config.storage);
    this.loadBalancerOptimizer = new LoadBalancerOptimizer(config.loadBalancer);
    this.autoScalingConfigurator = new AutoScalingConfigurator(config.autoScaling);
    this.monitoringSetup = new ResourceMonitoringSetup({
      metrics: ['cpu-usage', 'memory-usage', 'disk-usage', 'network-io', 'response-time', 'error-rate'],
      alertingRules: [],
      dashboards: [],
      retentionPeriod: 30 * 24 * 60 * 60 * 1000, // 30 days
      samplingRate: 1
    });
    this.costOptimizer = new CostOptimizationStrategies();
    this.capacityPlanner = new CapacityPlanningAutomation();
    this.iacOptimizer = new InfrastructureAsCodeOptimizer();
  }

  public static getInstance(config?: InfrastructureOptimizationConfig): InfrastructureOptimizationManager {
    if (!InfrastructureOptimizationManager.instance && config) {
      InfrastructureOptimizationManager.instance = new InfrastructureOptimizationManager(config);
    }
    return InfrastructureOptimizationManager.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('🔧 Infrastructure Optimization Manager already initialized');
      return;
    }

    try {
      console.log('🚀 Initializing Infrastructure Optimization Manager...');
      
      // Initialize all optimization components in parallel
      await Promise.all([
        this.serverOptimizer.initialize(),
        this.containerOptimizer.initialize(),
        this.networkTuner.initialize(),
        this.storageOptimizer.initialize(),
        this.loadBalancerOptimizer.initialize(),
        this.autoScalingConfigurator.initialize(),
        this.monitoringSetup.initialize(),
        this.costOptimizer.initialize(),
        this.capacityPlanner.initialize(),
        this.iacOptimizer.initialize()
      ]);

      // Start coordinated optimization process
      this.startOptimizationCoordination();
      
      this.isInitialized = true;
      console.log('✅ Infrastructure Optimization Manager initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize Infrastructure Optimization Manager:', error);
      throw error;
    }
  }

  private startOptimizationCoordination(): void {
    console.log('🔄 Starting optimization coordination...');
    
    // Run coordinated optimization every 6 hours
    this.optimizationInterval = setInterval(async () => {
      await this.performCoordinatedOptimization();
    }, 6 * 60 * 60 * 1000);
  }

  private async performCoordinatedOptimization(): Promise<void> {
    console.log('🎯 Performing coordinated infrastructure optimization...');
    
    try {
      // Gather recommendations from all components
      const recommendations = await this.gatherAllRecommendations();
      
      // Prioritize and coordinate recommendations
      const prioritizedRecommendations = this.prioritizeRecommendations(recommendations);
      
      // Execute high-priority optimizations automatically
      await this.executeAutomaticOptimizations(prioritizedRecommendations);
      
      // Generate comprehensive optimization report
      const report = await this.generateComprehensiveReport();
      
      console.log('📊 Optimization coordination completed');
      
      // Log summary of actions taken
      this.logOptimizationSummary(prioritizedRecommendations);
      
    } catch (error) {
      console.error('❌ Error during coordinated optimization:', error);
    }
  }

  private async gatherAllRecommendations(): Promise<OptimizationRecommendation[]> {
    const allRecommendations: OptimizationRecommendation[] = [];
    
    // Gather recommendations from all components
    const componentRecommendations = await Promise.all([
      this.serverOptimizer.getOptimizationRecommendations(),
      this.containerOptimizer.getOptimizationRecommendations(),
      this.networkTuner.getOptimizationRecommendations(),
      this.storageOptimizer.getOptimizationRecommendations(),
      this.loadBalancerOptimizer.getOptimizationRecommendations(),
      this.autoScalingConfigurator.getOptimizationRecommendations(),
      this.monitoringSetup.getOptimizationRecommendations(),
      this.costOptimizer.getOptimizationRecommendations(),
      this.capacityPlanner.getOptimizationRecommendations(),
      this.iacOptimizer.getOptimizationRecommendations()
    ]);

    // Flatten all recommendations
    componentRecommendations.forEach(recommendations => {
      allRecommendations.push(...recommendations);
    });

    return allRecommendations;
  }

  private prioritizeRecommendations(recommendations: OptimizationRecommendation[]): OptimizationRecommendation[] {
    // Sort recommendations by priority and potential impact
    return recommendations.sort((a, b) => {
      // Priority scoring
      const priorityScore = (rec: OptimizationRecommendation): number => {
        switch (rec.priority) {
          case 'critical': return 1000;
          case 'high': return 100;
          case 'medium': return 10;
          case 'low': return 1;
          default: return 0;
        }
      };

      // ROI scoring (savings - cost)
      const roiScore = (rec: OptimizationRecommendation): number => {
        return rec.estimatedSavings - rec.estimatedCost;
      };

      const aScore = priorityScore(a) + (roiScore(a) * 0.1);
      const bScore = priorityScore(b) + (roiScore(b) * 0.1);

      return bScore - aScore; // Descending order
    });
  }

  private async executeAutomaticOptimizations(recommendations: OptimizationRecommendation[]): Promise<void> {
    // Define which optimizations can be executed automatically
    const autoExecutableCategories = ['monitoring', 'auto-scaling'];
    const autoExecutablePriorities = ['low']; // Only execute low-risk optimizations automatically
    
    const autoRecommendations = recommendations.filter(rec => 
      autoExecutableCategories.includes(rec.category) && 
      autoExecutablePriorities.includes(rec.priority)
    );

    for (const recommendation of autoRecommendations.slice(0, 3)) { // Limit to 3 automatic optimizations
      try {
        console.log(`🤖 Auto-executing optimization: ${recommendation.title}`);
        await this.executeOptimization(recommendation);
      } catch (error) {
        console.error(`❌ Failed to auto-execute optimization ${recommendation.id}:`, error);
      }
    }
  }

  private async executeOptimization(recommendation: OptimizationRecommendation): Promise<void> {
    // This would contain the actual implementation logic for each optimization
    // For now, we'll just log the execution
    console.log(`🔧 Executing optimization: ${recommendation.title}`);
    console.log(`📋 Implementation steps: ${recommendation.implementation.join(', ')}`);
  }

  private logOptimizationSummary(recommendations: OptimizationRecommendation[]): void {
    const summary = {
      total: recommendations.length,
      critical: recommendations.filter(r => r.priority === 'critical').length,
      high: recommendations.filter(r => r.priority === 'high').length,
      medium: recommendations.filter(r => r.priority === 'medium').length,
      low: recommendations.filter(r => r.priority === 'low').length,
      totalPotentialSavings: recommendations.reduce((sum, r) => sum + r.estimatedSavings, 0),
      totalEstimatedCost: recommendations.reduce((sum, r) => sum + r.estimatedCost, 0)
    };

    console.log('📊 Optimization Summary:', summary);
  }

  public async generateComprehensiveReport(): Promise<any> {
    console.log('📋 Generating comprehensive infrastructure optimization report...');

    try {
      // Gather reports from all components
      const [
        serverReport,
        containerReport,
        networkReport,
        storageReport,
        loadBalancerReport,
        autoScalingReport,
        monitoringReport,
        costReport,
        capacityReport,
        iacReport
      ] = await Promise.all([
        this.serverOptimizer.generateOptimizationReport(),
        this.containerOptimizer.generateContainerReport(),
        this.networkTuner.generateNetworkReport(),
        this.storageOptimizer.generateStorageReport(),
        this.loadBalancerOptimizer.generateLoadBalancerReport(),
        this.autoScalingConfigurator.generateAutoScalingReport(),
        this.monitoringSetup.generateMonitoringReport(),
        this.costOptimizer.generateCostOptimizationReport(),
        this.capacityPlanner.generateCapacityReport(),
        this.iacOptimizer.generateIaCReport()
      ]);

      // Aggregate all recommendations
      const allRecommendations = await this.gatherAllRecommendations();
      const prioritizedRecommendations = this.prioritizeRecommendations(allRecommendations);

      // Calculate overall health scores
      const healthScores = this.calculateOverallHealthScores([
        serverReport,
        containerReport,
        networkReport,
        storageReport,
        loadBalancerReport,
        autoScalingReport,
        monitoringReport,
        costReport,
        capacityReport,
        iacReport
      ]);

      return {
        timestamp: Date.now(),
        summary: {
          totalRecommendations: allRecommendations.length,
          criticalRecommendations: allRecommendations.filter(r => r.priority === 'critical').length,
          totalPotentialSavings: allRecommendations.reduce((sum, r) => sum + r.estimatedSavings, 0),
          overallHealthScore: healthScores.overall,
          healthByCategory: healthScores.byCategory
        },
        componentReports: {
          server: serverReport,
          container: containerReport,
          network: networkReport,
          storage: storageReport,
          loadBalancer: loadBalancerReport,
          autoScaling: autoScalingReport,
          monitoring: monitoringReport,
          cost: costReport,
          capacity: capacityReport,
          infrastructureAsCode: iacReport
        },
        recommendations: {
          all: allRecommendations,
          prioritized: prioritizedRecommendations.slice(0, 10), // Top 10 recommendations
          byCategory: this.groupRecommendationsByCategory(allRecommendations),
          byPriority: this.groupRecommendationsByPriority(allRecommendations)
        },
        optimization: {
          isInitialized: this.isInitialized,
          lastOptimization: Date.now(),
          nextOptimization: Date.now() + (6 * 60 * 60 * 1000) // Next 6 hours
        }
      };

    } catch (error) {
      console.error('❌ Error generating comprehensive report:', error);
      throw error;
    }
  }

  private calculateOverallHealthScores(reports: any[]): { overall: number; byCategory: Record<string, number> } {
    const healthScores: Record<string, number> = {};
    let totalScore = 0;
    let validScores = 0;

    // Extract health scores from each report
    reports.forEach((report, index) => {
      const categories = [
        'server', 'container', 'network', 'storage', 'loadBalancer',
        'autoScaling', 'monitoring', 'cost', 'capacity', 'iac'
      ];
      
      const category = categories[index];
      let score = 100; // Default healthy score

      // Extract health status and convert to score
      if (report && typeof report === 'object') {
        const healthStatus = this.extractHealthStatus(report);
        score = this.convertHealthStatusToScore(healthStatus);
      }

      healthScores[category] = score;
      totalScore += score;
      validScores++;
    });

    return {
      overall: validScores > 0 ? Math.round(totalScore / validScores) : 100,
      byCategory: healthScores
    };
  }

  private extractHealthStatus(report: any): string {
    // Try to find health status in various possible locations
    const possibleHealthKeys = [
      'health', 'status', 'overallHealth', 'healthStatus',
      'systemHealth', 'infrastructureHealth', 'performanceHealth'
    ];

    for (const key of possibleHealthKeys) {
      if (report[key]) {
        return report[key];
      }
    }

    return 'Healthy'; // Default status
  }

  private convertHealthStatusToScore(healthStatus: string): number {
    const status = healthStatus.toLowerCase();
    
    if (status.includes('critical')) return 25;
    if (status.includes('warning') || status.includes('moderate')) return 60;
    if (status.includes('healthy') || status.includes('good')) return 100;
    
    return 75; // Default moderate score
  }

  private groupRecommendationsByCategory(recommendations: OptimizationRecommendation[]): Record<string, OptimizationRecommendation[]> {
    const grouped: Record<string, OptimizationRecommendation[]> = {};
    
    recommendations.forEach(rec => {
      if (!grouped[rec.category]) {
        grouped[rec.category] = [];
      }
      grouped[rec.category].push(rec);
    });

    return grouped;
  }

  private groupRecommendationsByPriority(recommendations: OptimizationRecommendation[]): Record<string, OptimizationRecommendation[]> {
    const grouped: Record<string, OptimizationRecommendation[]> = {
      critical: [],
      high: [],
      medium: [],
      low: []
    };
    
    recommendations.forEach(rec => {
      if (grouped[rec.priority]) {
        grouped[rec.priority].push(rec);
      }
    });

    return grouped;
  }

  // Public methods for manual optimization control
  public async optimizeServerResources(): Promise<any> {
    return this.serverOptimizer.generateOptimizationReport();
  }

  public async optimizeContainers(): Promise<any> {
    return this.containerOptimizer.generateContainerReport();
  }

  public async optimizeNetwork(): Promise<any> {
    return this.networkTuner.generateNetworkReport();
  }

  public async optimizeStorage(): Promise<any> {
    return this.storageOptimizer.generateStorageReport();
  }

  public async optimizeLoadBalancer(): Promise<any> {
    return this.loadBalancerOptimizer.generateLoadBalancerReport();
  }

  public async optimizeAutoScaling(): Promise<any> {
    return this.autoScalingConfigurator.generateAutoScalingReport();
  }

  public async optimizeMonitoring(): Promise<any> {
    return this.monitoringSetup.generateMonitoringReport();
  }

  public async optimizeCosts(): Promise<any> {
    return this.costOptimizer.generateCostOptimizationReport();
  }

  public async optimizeCapacity(): Promise<any> {
    return this.capacityPlanner.generateCapacityReport();
  }

  public async optimizeInfrastructureAsCode(): Promise<any> {
    return this.iacOptimizer.generateIaCReport();
  }

  public async getHealthStatus(): Promise<{ status: string; score: number; details: any }> {
    const report = await this.generateComprehensiveReport();
    const score = report.summary.overallHealthScore;
    
    let status = 'Healthy';
    if (score < 50) status = 'Critical';
    else if (score < 75) status = 'Warning';
    
    return {
      status,
      score,
      details: report.summary
    };
  }

  public cleanup(): void {
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
      this.optimizationInterval = null;
    }

    // Cleanup all optimization components
    this.serverOptimizer.cleanup();
    this.containerOptimizer.cleanup();
    this.networkTuner.cleanup();
    this.storageOptimizer.cleanup();
    this.loadBalancerOptimizer.cleanup();
    this.autoScalingConfigurator.cleanup();
    this.monitoringSetup.cleanup();
    this.costOptimizer.cleanup();
    this.capacityPlanner.cleanup();
    this.iacOptimizer.cleanup();

    this.isInitialized = false;
    console.log('🧹 Infrastructure Optimization Manager cleaned up');
  }
}
