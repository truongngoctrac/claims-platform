/**
 * Auto-Scaling System - Main Integration
 * Healthcare Claims Processing System
 */

export * from './MetricsBasedScaling';
export * from './PredictiveScaling';
export * from './ResourceThresholdManagement';
export * from './ScalingPolicyOptimization';
export * from './CostAwareScaling';
export * from './MultiRegionScaling';
export * from './ScalingAutomationTesting';
export * from './ScalingPerformanceMonitoring';
export * from './ScalingDecisionLogging';
export * from './ScalingStrategyOptimization';

// Main imports
import { MetricsBasedScaling, ScalingDecision, MetricThresholds } from './MetricsBasedScaling';
import { PredictiveScaling, ScalingPrediction, PredictiveScalingConfig } from './PredictiveScaling';
import { ResourceThresholdManagement, ResourceThreshold, ThresholdBreach } from './ResourceThresholdManagement';
import { ScalingPolicyOptimization, ScalingPolicy, OptimizationResult } from './ScalingPolicyOptimization';
import { CostAwareScaling, ScalingCostAnalysis, HealthcareCostContext } from './CostAwareScaling';
import { MultiRegionScaling, GlobalLoadDistribution, RegionFailover } from './MultiRegionScaling';
import { ScalingAutomationTesting, TestScenario, TestExecution } from './ScalingAutomationTesting';
import { ScalingPerformanceMonitoring, ScalingPerformanceSnapshot, PerformanceAlert } from './ScalingPerformanceMonitoring';
import { ScalingDecisionLogging, ScalingDecisionLog, LogAnalytics } from './ScalingDecisionLogging';
import { ScalingStrategyOptimization, ScalingStrategy, StrategyOptimizationResult } from './ScalingStrategyOptimization';

/**
 * Auto-Scaling System Configuration
 */
export interface AutoScalingConfig {
  healthcareContext: HealthcareCostContext;
  metricsConfig: {
    interval: number;
    retention: number;
    sources: string[];
    aggregationWindow: number;
  };
  thresholds: MetricThresholds;
  predictiveConfig: PredictiveScalingConfig;
  costAwareness: {
    enabled: boolean;
    budgetLimits: { [timeframe: string]: number };
    emergencyOverride: boolean;
  };
  multiRegion: {
    enabled: boolean;
    primaryRegion: string;
    secondaryRegions: string[];
  };
  monitoring: {
    metricsCollectionInterval: number;
    alertingEnabled: boolean;
    retentionPeriod: number;
    healthcareSpecific: {
      patientSafetyMonitoring: boolean;
      complianceTracking: boolean;
      emergencyResponseTracking: boolean;
      auditLogging: boolean;
    };
  };
  testing: {
    enabled: boolean;
    scenarios: string[];
    automatedTesting: boolean;
    chaosEngineering: boolean;
  };
  logging: {
    enabled: boolean;
    retentionPeriod: number;
    complianceLogging: boolean;
    auditTrail: boolean;
  };
}

/**
 * Comprehensive Auto-Scaling Manager for Healthcare Claims Processing
 */
export class HealthcareAutoScalingManager {
  private metricsBasedScaling: MetricsBasedScaling;
  private predictiveScaling: PredictiveScaling;
  private thresholdManagement: ResourceThresholdManagement;
  private policyOptimization: ScalingPolicyOptimization;
  private costAwareScaling: CostAwareScaling;
  private multiRegionScaling: MultiRegionScaling;
  private automationTesting: ScalingAutomationTesting;
  private performanceMonitoring: ScalingPerformanceMonitoring;
  private decisionLogging: ScalingDecisionLogging;
  private strategyOptimization: ScalingStrategyOptimization;

  private config: AutoScalingConfig;
  private isActive: boolean = false;
  private scalingInProgress: Map<string, boolean> = new Map();

  constructor(config: AutoScalingConfig) {
    this.config = config;
    this.initializeComponents();
  }

  /**
   * Initialize all auto-scaling components
   */
  private initializeComponents(): void {
    console.log('🚀 Initializing Healthcare Auto-Scaling System');

    // Initialize core scaling components
    this.metricsBasedScaling = new MetricsBasedScaling(
      this.config.thresholds,
      this.config.metricsConfig
    );

    this.predictiveScaling = new PredictiveScaling(this.config.predictiveConfig);

    this.thresholdManagement = new ResourceThresholdManagement();

    this.policyOptimization = new ScalingPolicyOptimization();

    this.costAwareScaling = new CostAwareScaling(this.config.healthcareContext);

    this.multiRegionScaling = new MultiRegionScaling();

    // Initialize monitoring and testing components
    this.automationTesting = new ScalingAutomationTesting();

    this.performanceMonitoring = new ScalingPerformanceMonitoring(this.config.monitoring);

    this.decisionLogging = new ScalingDecisionLogging();

    this.strategyOptimization = new ScalingStrategyOptimization();

    console.log('✅ All auto-scaling components initialized');
  }

  /**
   * Start the auto-scaling system
   */
  async start(): Promise<void> {
    if (this.isActive) {
      console.log('⚠️ Auto-scaling system is already active');
      return;
    }

    console.log('🎯 Starting Healthcare Auto-Scaling System');

    try {
      // Start core components
      await this.metricsBasedScaling.startCollection();
      await this.performanceMonitoring.startMonitoring();

      // Apply healthcare-specific configurations
      await this.setupHealthcareOptimizations();

      this.isActive = true;
      console.log('✅ Healthcare Auto-Scaling System started successfully');

    } catch (error) {
      console.error('❌ Failed to start auto-scaling system:', error);
      throw error;
    }
  }

  /**
   * Stop the auto-scaling system
   */
  async stop(): Promise<void> {
    if (!this.isActive) {
      console.log('⚠️ Auto-scaling system is not active');
      return;
    }

    console.log('🛑 Stopping Healthcare Auto-Scaling System');

    try {
      // Stop all components gracefully
      this.metricsBasedScaling.stopCollection();
      this.performanceMonitoring.stopMonitoring();
      this.decisionLogging.stopLogging();

      // Wait for any ongoing scaling operations to complete
      await this.waitForScalingCompletion();

      this.isActive = false;
      console.log('✅ Healthcare Auto-Scaling System stopped successfully');

    } catch (error) {
      console.error('❌ Error stopping auto-scaling system:', error);
      throw error;
    }
  }

  /**
   * Make comprehensive scaling decision for a service
   */
  async makeScalingDecision(
    serviceName: string,
    currentReplicas: number,
    urgency: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    userId?: string,
    userRole?: string
  ): Promise<{
    approved: boolean;
    finalReplicas: number;
    reason: string;
    logId: string;
    costAnalysis?: ScalingCostAnalysis;
    predictions?: ScalingPrediction;
    multiRegionActions?: any[];
  }> {
    if (!this.isActive) {
      throw new Error('Auto-scaling system is not active');
    }

    if (this.scalingInProgress.get(serviceName)) {
      throw new Error(`Scaling already in progress for service: ${serviceName}`);
    }

    this.scalingInProgress.set(serviceName, true);

    try {
      console.log(`🎯 Making scaling decision for ${serviceName}: ${currentReplicas} replicas (${urgency} urgency)`);

      // Step 1: Collect current metrics and analyze thresholds
      const metricsDecision = await this.metricsBasedScaling.makeScalingDecision(
        serviceName,
        currentReplicas
      );

      // Step 2: Get predictive insights
      const prediction = await this.predictiveScaling.predict(serviceName);

      // Step 3: Evaluate thresholds
      const currentMetrics = await this.getCurrentMetrics(serviceName);
      const thresholdEvaluations = await this.thresholdManagement.evaluateThresholds(currentMetrics);

      // Step 4: Determine recommended action
      let recommendedReplicas = this.determineRecommendedReplicas(
        currentReplicas,
        metricsDecision,
        prediction,
        thresholdEvaluations
      );

      // Step 5: Cost-aware analysis
      const costDecision = await this.costAwareScaling.makeCostAwareScalingDecision(
        serviceName,
        currentReplicas,
        recommendedReplicas,
        urgency
      );

      // Step 6: Multi-region considerations
      let multiRegionActions: any[] = [];
      if (this.config.multiRegion.enabled && costDecision.approved) {
        const multiRegionResult = await this.multiRegionScaling.executeMultiRegionScaling(
          this.config.multiRegion.primaryRegion,
          recommendedReplicas,
          urgency
        );
        multiRegionActions = multiRegionResult.actions;
      }

      // Step 7: Create scaling context for logging
      const scalingContext = {
        currentMetrics,
        thresholds: this.config.thresholds,
        businessContext: {
          timeOfDay: new Date().getHours().toString(),
          dayOfWeek: new Date().getDay().toString(),
          isBusinessHours: this.isBusinessHours(),
          seasonality: this.getCurrentSeason(),
          specialEvents: []
        },
        systemContext: {
          currentLoad: currentMetrics.cpu || 0,
          availableCapacity: 100 - (currentMetrics.cpu || 0),
          regionHealth: 'healthy',
          networkLatency: currentMetrics.responseTime || 0,
          errorRate: currentMetrics.errorRate || 0
        },
        costContext: {
          currentCost: costDecision.costImpact.currentCost,
          projectedCost: costDecision.costImpact.projectedCost,
          budgetRemaining: 10000, // Simplified
          costEfficiency: costDecision.costImpact.costPerformanceRatio
        }
      };

      // Step 8: Create scaling decision details
      const scalingDecisionDetails = {
        action: this.determineScalingAction(currentReplicas, costDecision.finalReplicas) as 'scale-up' | 'scale-down' | 'maintain' | 'migrate' | 'failover',
        fromReplicas: currentReplicas,
        toReplicas: costDecision.finalReplicas,
        reason: costDecision.reason,
        triggeredBy: metricsDecision.triggeredBy,
        confidence: metricsDecision.confidence,
        algorithm: 'comprehensive-healthcare-scaling',
        overrideReason: urgency === 'critical' ? 'Emergency healthcare override' : undefined,
        emergencyFlag: urgency === 'critical'
      };

      // Step 9: Log the scaling decision
      const logId = await this.decisionLogging.logScalingDecision(
        serviceName,
        scalingDecisionDetails,
        scalingContext,
        userId,
        userRole
      );

      // Step 10: Record performance snapshot if scaling approved
      if (costDecision.approved && costDecision.finalReplicas !== currentReplicas) {
        const scalingEvent = {
          eventId: `scaling-${Date.now()}`,
          serviceName,
          action: scalingDecisionDetails.action,
          fromReplicas: currentReplicas,
          toReplicas: costDecision.finalReplicas,
          trigger: scalingDecisionDetails.reason,
          duration: 0, // Will be updated when scaling completes
          cost: costDecision.costImpact.costChange,
          success: true, // Optimistic, will be updated
          region: this.config.multiRegion.primaryRegion
        };

        // Record performance snapshot (fire and forget)
        this.performanceMonitoring.recordScalingSnapshot(scalingEvent).catch(error => {
          console.error('Error recording performance snapshot:', error);
        });
      }

      console.log(`✅ Scaling decision completed for ${serviceName}: ${costDecision.approved ? 'APPROVED' : 'DENIED'} (${costDecision.finalReplicas} replicas)`);

      return {
        approved: costDecision.approved,
        finalReplicas: costDecision.finalReplicas,
        reason: costDecision.reason,
        logId,
        costAnalysis: costDecision.costImpact,
        predictions: prediction,
        multiRegionActions
      };

    } finally {
      this.scalingInProgress.set(serviceName, false);
    }
  }

  /**
   * Execute automated scaling based on current conditions
   */
  async executeAutomatedScaling(): Promise<void> {
    if (!this.isActive) {
      console.log('⚠️ Auto-scaling system is not active');
      return;
    }

    console.log('🤖 Executing automated scaling analysis');

    const services = ['claims-processor', 'document-processor', 'emergency-processor', 'notification-service'];

    for (const serviceName of services) {
      try {
        if (this.scalingInProgress.get(serviceName)) {
          console.log(`⏳ Skipping ${serviceName} - scaling in progress`);
          continue;
        }

        // Get current replica count (simulated)
        const currentReplicas = await this.getCurrentReplicaCount(serviceName);

        // Make scaling decision
        const decision = await this.makeScalingDecision(serviceName, currentReplicas, 'medium', 'system', 'auto-scaler');

        if (decision.approved && decision.finalReplicas !== currentReplicas) {
          console.log(`🔄 Auto-scaling ${serviceName}: ${currentReplicas} → ${decision.finalReplicas} replicas`);
          // In real implementation, would execute actual scaling
          await this.executeScaling(serviceName, decision.finalReplicas, decision.logId);
        }

      } catch (error) {
        console.error(`❌ Auto-scaling failed for ${serviceName}:`, error);
      }
    }
  }

  /**
   * Run automated testing scenarios
   */
  async runAutomatedTests(): Promise<void> {
    if (!this.config.testing.enabled) {
      console.log('🧪 Automated testing is disabled');
      return;
    }

    console.log('🧪 Running automated scaling tests');

    try {
      for (const scenarioId of this.config.testing.scenarios) {
        const execution = await this.automationTesting.executeTest(scenarioId);
        console.log(`📊 Test ${scenarioId}: ${execution.status} (${execution.validationResults.filter(v => v.passed).length}/${execution.validationResults.length} validations passed)`);
      }

      // Run chaos engineering tests if enabled
      if (this.config.testing.chaosEngineering) {
        const chaosExecution = await this.automationTesting.executeChaosTest();
        console.log(`🌪️ Chaos test: ${chaosExecution.status}`);
      }

    } catch (error) {
      console.error('❌ Automated testing failed:', error);
    }
  }

  /**
   * Optimize scaling strategies
   */
  async optimizeStrategies(): Promise<void> {
    console.log('🔧 Optimizing scaling strategies');

    try {
      const strategies = this.strategyOptimization.getAllStrategies();

      for (const strategy of strategies) {
        if (strategy.enabled) {
          const result = await this.strategyOptimization.optimizeStrategy(strategy.id);
          console.log(`📈 Strategy ${strategy.name}: ${(result.improvements.overall * 100).toFixed(2)}% improvement (confidence: ${(result.confidence * 100).toFixed(1)}%)`);
        }
      }

    } catch (error) {
      console.error('❌ Strategy optimization failed:', error);
    }
  }

  /**
   * Get comprehensive system status
   */
  getSystemStatus(): {
    active: boolean;
    services: { [service: string]: any };
    performance: any;
    costs: any;
    compliance: any;
    alerts: PerformanceAlert[];
  } {
    const activeAlerts = this.performanceMonitoring.getActiveAlerts();
    
    return {
      active: this.isActive,
      services: {
        'claims-processor': { replicas: 3, status: 'healthy', load: 65 },
        'document-processor': { replicas: 2, status: 'healthy', load: 45 },
        'emergency-processor': { replicas: 1, status: 'healthy', load: 25 },
        'notification-service': { replicas: 1, status: 'healthy', load: 30 }
      },
      performance: {
        avgResponseTime: 850,
        throughput: 250,
        errorRate: 1.2,
        availability: 99.7
      },
      costs: {
        currentHourly: 85,
        projectedDaily: 2040,
        monthlyBudget: 50000,
        efficiency: 0.87
      },
      compliance: {
        hipaaScore: 98.5,
        dataResidency: true,
        auditTrail: true,
        violations: 0
      },
      alerts: activeAlerts
    };
  }

  /**
   * Get analytics and insights
   */
  async getAnalytics(timeRange?: { start: Date; end: Date }): Promise<{
    scaling: LogAnalytics;
    performance: any;
    strategies: any;
    predictions: any;
  }> {
    const [scalingAnalytics, performanceSnapshots, strategyPerformance] = await Promise.all([
      this.decisionLogging.generateAnalytics(timeRange),
      this.performanceMonitoring.getPerformanceSnapshots(20),
      this.getStrategyPerformance()
    ]);

    return {
      scaling: scalingAnalytics,
      performance: {
        snapshots: performanceSnapshots,
        trends: this.performanceMonitoring.getPerformanceTrends()
      },
      strategies: strategyPerformance,
      predictions: {
        // Would include predictive analytics data
        accuracy: 85,
        nextHourPredictions: {},
        trends: {}
      }
    };
  }

  // Helper methods

  private async setupHealthcareOptimizations(): Promise<void> {
    console.log('🏥 Setting up healthcare-specific optimizations');
    
    // Apply healthcare-specific thresholds
    this.thresholdManagement.applyTemplate('healthcare-claims-basic', 'claims-processor');
    this.thresholdManagement.applyTemplate('healthcare-emergency', 'emergency-processor');
    
    // Configure healthcare cost context
    this.costAwareScaling.updateHealthcareContext({
      claimProcessingPeriod: 'normal',
      regulatoryRequirements: ['HIPAA', 'HITECH'],
      slaRequirements: {
        availability: 99.9,
        responseTime: 2000,
        dataRetention: 2555
      },
      complianceCosts: 5000,
      emergencyScalingAllowance: 10000
    });
  }

  private async waitForScalingCompletion(): Promise<void> {
    const maxWaitTime = 300000; // 5 minutes
    const startTime = Date.now();

    while (Array.from(this.scalingInProgress.values()).some(inProgress => inProgress)) {
      if (Date.now() - startTime > maxWaitTime) {
        console.log('⚠️ Timeout waiting for scaling operations to complete');
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  private determineRecommendedReplicas(
    currentReplicas: number,
    metricsDecision: ScalingDecision,
    prediction: ScalingPrediction,
    thresholdEvaluations: any[]
  ): number {
    let recommendedReplicas = metricsDecision.targetReplicas;

    // Adjust based on prediction if available
    if (prediction.recommendedAction === 'scale-up') {
      recommendedReplicas = Math.max(recommendedReplicas, prediction.recommendedReplicas);
    } else if (prediction.recommendedAction === 'scale-down') {
      recommendedReplicas = Math.min(recommendedReplicas, prediction.recommendedReplicas);
    }

    // Apply threshold-based adjustments
    const criticalThresholds = thresholdEvaluations.filter(t => t.breached && t.action !== 'none');
    if (criticalThresholds.length > 0) {
      // Increase recommended replicas if critical thresholds are breached
      recommendedReplicas = Math.max(recommendedReplicas, currentReplicas + 2);
    }

    return Math.max(1, Math.min(20, recommendedReplicas)); // Bounds check
  }

  private determineScalingAction(currentReplicas: number, targetReplicas: number): string {
    if (targetReplicas > currentReplicas) return 'scale-up';
    if (targetReplicas < currentReplicas) return 'scale-down';
    return 'maintain';
  }

  private async getCurrentMetrics(serviceName: string): Promise<{ [key: string]: number }> {
    // Simulate current metrics collection
    return {
      cpu: 60 + Math.random() * 30,
      memory: 55 + Math.random() * 35,
      responseTime: 800 + Math.random() * 400,
      errorRate: Math.random() * 3,
      throughput: 100 + Math.random() * 100,
      queueLength: Math.floor(Math.random() * 50)
    };
  }

  private async getCurrentReplicaCount(serviceName: string): Promise<number> {
    // Simulate getting current replica count
    const baseCounts: { [key: string]: number } = {
      'claims-processor': 3,
      'document-processor': 2,
      'emergency-processor': 1,
      'notification-service': 1
    };
    return baseCounts[serviceName] || 1;
  }

  private async executeScaling(serviceName: string, targetReplicas: number, logId: string): Promise<void> {
    console.log(`🔄 Executing scaling for ${serviceName} to ${targetReplicas} replicas`);
    
    // Simulate scaling execution
    const startTime = new Date();
    
    // Update execution status
    await this.decisionLogging.updateScalingExecution(logId, {
      status: 'in-progress',
      steps: [{
        stepId: 'scaling-start',
        name: 'Scaling Initiated',
        startTime,
        status: 'completed',
        details: `Starting scaling to ${targetReplicas} replicas`
      }]
    });
    
    // Simulate scaling delay
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Update execution completion
    const endTime = new Date();
    await this.decisionLogging.updateScalingExecution(logId, {
      status: 'completed',
      endTime,
      finalMetrics: await this.getCurrentMetrics(serviceName),
      steps: [{
        stepId: 'scaling-complete',
        name: 'Scaling Completed',
        startTime: endTime,
        endTime,
        status: 'completed',
        details: `Successfully scaled to ${targetReplicas} replicas`
      }]
    });
  }

  private isBusinessHours(): boolean {
    const hour = new Date().getHours();
    return hour >= 8 && hour < 18;
  }

  private getCurrentSeason(): string {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
  }

  private async getStrategyPerformance(): Promise<any> {
    const strategies = this.strategyOptimization.getAllStrategies();
    return strategies.map(strategy => ({
      id: strategy.id,
      name: strategy.name,
      performance: strategy.performance,
      lastOptimized: strategy.lastOptimized
    }));
  }

  /**
   * Emergency scaling override for critical healthcare situations
   */
  async emergencyScalingOverride(
    serviceName: string,
    targetReplicas: number,
    reason: string,
    userId: string
  ): Promise<string> {
    console.log(`🚨 EMERGENCY SCALING OVERRIDE: ${serviceName} to ${targetReplicas} replicas`);
    
    const decision = await this.makeScalingDecision(
      serviceName,
      await this.getCurrentReplicaCount(serviceName),
      'critical',
      userId,
      'emergency-operator'
    );

    // Force approval for emergency
    if (!decision.approved) {
      console.log('🔴 Forcing emergency approval despite system recommendation');
      await this.executeScaling(serviceName, targetReplicas, decision.logId);
      
      // Add emergency approval
      await this.decisionLogging.addApproval(decision.logId, {
        approverType: 'emergency-override',
        approverId: userId,
        timestamp: new Date(),
        reason: `EMERGENCY OVERRIDE: ${reason}`,
        conditions: ['patient_safety_critical', 'system_override']
      });
    }

    return decision.logId;
  }

  /**
   * Check if auto-scaling system is healthy
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    components: { [component: string]: boolean };
    issues: string[];
  }> {
    const components: { [component: string]: boolean } = {};
    const issues: string[] = [];

    // Check core components
    components.metricsCollection = this.isActive;
    components.performanceMonitoring = this.performanceMonitoring.isMonitoringActive();
    components.costAwareness = true; // Simplified check
    components.compliance = true; // Simplified check

    if (!components.metricsCollection) {
      issues.push('Metrics collection is not active');
    }

    if (!components.performanceMonitoring) {
      issues.push('Performance monitoring is not active');
    }

    // Check for critical alerts
    const activeAlerts = this.performanceMonitoring.getActiveAlerts();
    const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'critical');
    
    if (criticalAlerts.length > 0) {
      issues.push(`${criticalAlerts.length} critical alerts active`);
      components.alerting = false;
    } else {
      components.alerting = true;
    }

    const healthy = Object.values(components).every(status => status) && issues.length === 0;

    return {
      healthy,
      components,
      issues
    };
  }
}

/**
 * Default healthcare auto-scaling configuration
 */
export const defaultHealthcareAutoScalingConfig: AutoScalingConfig = {
  healthcareContext: {
    claimProcessingPeriod: 'normal',
    regulatoryRequirements: ['HIPAA', 'HITECH'],
    slaRequirements: {
      availability: 99.9,
      responseTime: 2000,
      dataRetention: 2555
    },
    complianceCosts: 5000,
    emergencyScalingAllowance: 10000
  },
  metricsConfig: {
    interval: 30000, // 30 seconds
    retention: 86400000, // 24 hours
    sources: ['prometheus', 'cloudwatch', 'custom'],
    aggregationWindow: 300000 // 5 minutes
  },
  thresholds: {
    cpu: { scaleUp: 70, scaleDown: 30 },
    memory: { scaleUp: 80, scaleDown: 40 },
    requestRate: { scaleUp: 1000, scaleDown: 200 },
    responseTime: { scaleUp: 2000, scaleDown: 500 },
    errorRate: { scaleUp: 5, scaleDown: 1 },
    queueLength: { scaleUp: 100, scaleDown: 20 }
  },
  predictiveConfig: {
    models: ['linear', 'seasonal', 'neural'],
    trainingWindow: 7200000, // 2 hours
    predictionHorizon: 3600000, // 1 hour
    retrainInterval: 86400000, // 24 hours
    confidenceThreshold: 0.8,
    seasonalPatterns: true,
    businessHours: { start: 8, end: 18 },
    peakDays: [1, 2, 3, 4, 5] // Monday to Friday
  },
  costAwareness: {
    enabled: true,
    budgetLimits: {
      hourly: 500,
      daily: 10000,
      monthly: 300000
    },
    emergencyOverride: true
  },
  multiRegion: {
    enabled: true,
    primaryRegion: 'us-east-1',
    secondaryRegions: ['us-west-2', 'ca-central-1']
  },
  monitoring: {
    metricsCollectionInterval: 30000,
    alertingEnabled: true,
    retentionPeriod: 2592000000, // 30 days
    healthcareSpecific: {
      patientSafetyMonitoring: true,
      complianceTracking: true,
      emergencyResponseTracking: true,
      auditLogging: true
    }
  },
  testing: {
    enabled: true,
    scenarios: ['emergency-surge', 'business-hours-optimization', 'regional-failover'],
    automatedTesting: true,
    chaosEngineering: false // Disabled by default for production safety
  },
  logging: {
    enabled: true,
    retentionPeriod: 31536000000, // 1 year
    complianceLogging: true,
    auditTrail: true
  }
};
