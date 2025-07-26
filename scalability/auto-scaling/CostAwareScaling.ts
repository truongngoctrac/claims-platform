/**
 * Cost-Aware Scaling System
 * Healthcare Claims Processing System
 */

export interface CostProfile {
  serviceId: string;
  serviceName: string;
  region: string;
  instanceType: string;
  hourlyCost: number;
  resourceUnits: {
    cpu: number;
    memory: number;
    storage: number;
    network: number;
  };
  commitment: 'on-demand' | 'reserved' | 'spot';
  discountRate: number;
  availabilityZone: string;
}

export interface CostBudget {
  id: string;
  name: string;
  timeframe: 'hourly' | 'daily' | 'weekly' | 'monthly';
  limit: number;
  alertThresholds: number[];
  services: string[];
  enforced: boolean;
  flexibilityMargin: number;
  emergencyOverride: boolean;
}

export interface CostOptimizationRule {
  id: string;
  name: string;
  priority: number;
  condition: string;
  action: 'scale-down' | 'migrate-instance' | 'switch-commitment' | 'defer-scaling';
  savings: number;
  riskLevel: 'low' | 'medium' | 'high';
  healthcareImpact: 'none' | 'minimal' | 'moderate' | 'significant';
  enabled: boolean;
}

export interface CostPrediction {
  timestamp: Date;
  timeHorizon: number;
  predictedCost: number;
  confidence: number;
  breakdown: {
    compute: number;
    storage: number;
    network: number;
    other: number;
  };
  recommendations: CostRecommendation[];
}

export interface CostRecommendation {
  type: 'optimization' | 'alert' | 'migration' | 'scheduling';
  description: string;
  potentialSavings: number;
  implementationEffort: 'low' | 'medium' | 'high';
  riskAssessment: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  healthcareConsiderations: string;
}

export interface HealthcareCostContext {
  claimProcessingPeriod: 'peak' | 'normal' | 'low';
  regulatoryRequirements: string[];
  slaRequirements: {
    availability: number;
    responseTime: number;
    dataRetention: number;
  };
  complianceCosts: number;
  emergencyScalingAllowance: number;
}

export interface ScalingCostAnalysis {
  currentCost: number;
  projectedCost: number;
  costChange: number;
  costPerformanceRatio: number;
  roi: number;
  paybackPeriod: number;
  breakEvenPoint: number;
  riskAdjustedSavings: number;
}

export class CostAwareScaling {
  private costProfiles: Map<string, CostProfile> = new Map();
  private budgets: Map<string, CostBudget> = new Map();
  private optimizationRules: Map<string, CostOptimizationRule> = new Map();
  private costHistory: Map<string, Array<{ timestamp: Date; cost: number; usage: any }>> = new Map();
  private healthcareContext: HealthcareCostContext;

  constructor(healthcareContext: HealthcareCostContext) {
    this.healthcareContext = healthcareContext;
    this.initializeHealthcareCostProfiles();
    this.initializeCostOptimizationRules();
    this.initializeHealthcareBudgets();
  }

  /**
   * Initialize healthcare-specific cost profiles
   */
  private initializeHealthcareCostProfiles(): void {
    // Claims processing service cost profile
    this.costProfiles.set('claims-processor', {
      serviceId: 'claims-processor',
      serviceName: 'Claims Processing Service',
      region: 'us-east-1',
      instanceType: 'c5.large',
      hourlyCost: 0.096,
      resourceUnits: {
        cpu: 2,
        memory: 4,
        storage: 10,
        network: 0.1
      },
      commitment: 'on-demand',
      discountRate: 0,
      availabilityZone: 'us-east-1a'
    });

    // Document processing service cost profile
    this.costProfiles.set('document-processor', {
      serviceId: 'document-processor',
      serviceName: 'Document Processing Service',
      region: 'us-east-1',
      instanceType: 'm5.xlarge',
      hourlyCost: 0.192,
      resourceUnits: {
        cpu: 4,
        memory: 16,
        storage: 50,
        network: 0.2
      },
      commitment: 'reserved',
      discountRate: 0.3,
      availabilityZone: 'us-east-1b'
    });

    // Emergency processing service cost profile
    this.costProfiles.set('emergency-processor', {
      serviceId: 'emergency-processor',
      serviceName: 'Emergency Claims Processing',
      region: 'us-east-1',
      instanceType: 'c5.2xlarge',
      hourlyCost: 0.34,
      resourceUnits: {
        cpu: 8,
        memory: 16,
        storage: 20,
        network: 0.5
      },
      commitment: 'spot',
      discountRate: 0.7,
      availabilityZone: 'us-east-1c'
    });
  }

  /**
   * Initialize cost optimization rules for healthcare
   */
  private initializeCostOptimizationRules(): void {
    // Rule: Scale down during low activity periods
    this.optimizationRules.set('low-activity-scale-down', {
      id: 'low-activity-scale-down',
      name: 'Scale Down During Low Activity',
      priority: 1,
      condition: 'usage < 30% AND time_of_day NOT IN business_hours',
      action: 'scale-down',
      savings: 25,
      riskLevel: 'low',
      healthcareImpact: 'minimal',
      enabled: true
    });

    // Rule: Use spot instances for non-critical processing
    this.optimizationRules.set('spot-instances-non-critical', {
      id: 'spot-instances-non-critical',
      name: 'Use Spot Instances for Non-Critical Processing',
      priority: 2,
      condition: 'service_type = batch_processing AND urgency = low',
      action: 'migrate-instance',
      savings: 60,
      riskLevel: 'medium',
      healthcareImpact: 'minimal',
      enabled: true
    });

    // Rule: Emergency override for critical claims
    this.optimizationRules.set('emergency-override', {
      id: 'emergency-override',
      name: 'Emergency Scaling Override',
      priority: 10,
      condition: 'emergency_alert = true OR claim_priority = critical',
      action: 'defer-scaling',
      savings: -50, // Negative savings (increased cost) for emergency scaling
      riskLevel: 'low',
      healthcareImpact: 'none',
      enabled: true
    });

    // Rule: Optimize during maintenance windows
    this.optimizationRules.set('maintenance-optimization', {
      id: 'maintenance-optimization',
      name: 'Maintenance Window Optimization',
      priority: 3,
      condition: 'maintenance_window = true',
      action: 'scale-down',
      savings: 40,
      riskLevel: 'low',
      healthcareImpact: 'none',
      enabled: true
    });
  }

  /**
   * Initialize healthcare-specific budgets
   */
  private initializeHealthcareBudgets(): void {
    // Daily operational budget
    this.budgets.set('daily-operations', {
      id: 'daily-operations',
      name: 'Daily Operations Budget',
      timeframe: 'daily',
      limit: 500,
      alertThresholds: [0.7, 0.85, 0.95],
      services: ['claims-processor', 'document-processor'],
      enforced: true,
      flexibilityMargin: 0.1,
      emergencyOverride: true
    });

    // Monthly infrastructure budget
    this.budgets.set('monthly-infrastructure', {
      id: 'monthly-infrastructure',
      name: 'Monthly Infrastructure Budget',
      timeframe: 'monthly',
      limit: 15000,
      alertThresholds: [0.6, 0.8, 0.9],
      services: ['all'],
      enforced: true,
      flexibilityMargin: 0.05,
      emergencyOverride: true
    });

    // Emergency response budget
    this.budgets.set('emergency-response', {
      id: 'emergency-response',
      name: 'Emergency Response Budget',
      timeframe: 'weekly',
      limit: 2000,
      alertThresholds: [0.5, 0.7, 0.9],
      services: ['emergency-processor'],
      enforced: false,
      flexibilityMargin: 0.2,
      emergencyOverride: true
    });
  }

  /**
   * Analyze cost impact of scaling decision
   */
  async analyzeCostImpact(
    serviceId: string,
    currentReplicas: number,
    targetReplicas: number,
    duration: number = 3600000
  ): Promise<ScalingCostAnalysis> {
    const costProfile = this.costProfiles.get(serviceId);
    if (!costProfile) {
      throw new Error(`Cost profile not found for service: ${serviceId}`);
    }

    const hourlyDuration = duration / 3600000;
    
    // Calculate current cost
    const currentHourlyCost = currentReplicas * costProfile.hourlyCost * (1 - costProfile.discountRate);
    const currentCost = currentHourlyCost * hourlyDuration;

    // Calculate projected cost
    const projectedHourlyCost = targetReplicas * costProfile.hourlyCost * (1 - costProfile.discountRate);
    const projectedCost = projectedHourlyCost * hourlyDuration;

    // Calculate cost change
    const costChange = projectedCost - currentCost;
    const costChangePercentage = currentCost > 0 ? (costChange / currentCost) * 100 : 0;

    // Estimate performance improvement
    const performanceImprovementRatio = this.estimatePerformanceImpact(
      serviceId, 
      currentReplicas, 
      targetReplicas
    );

    // Calculate cost-performance ratio
    const costPerformanceRatio = costChangePercentage / (performanceImprovementRatio * 100);

    // Calculate ROI based on healthcare value
    const healthcareValue = this.calculateHealthcareValue(serviceId, performanceImprovementRatio);
    const roi = healthcareValue > 0 ? ((healthcareValue - Math.abs(costChange)) / Math.abs(costChange)) * 100 : 0;

    // Calculate payback period (in hours)
    const paybackPeriod = roi > 0 ? Math.abs(costChange) / (healthcareValue / hourlyDuration) : Infinity;

    // Calculate break-even point
    const breakEvenPoint = this.calculateBreakEvenPoint(costProfile, currentReplicas, targetReplicas);

    // Risk-adjusted savings
    const riskAdjustedSavings = this.calculateRiskAdjustedSavings(
      costChange, 
      serviceId, 
      targetReplicas
    );

    return {
      currentCost,
      projectedCost,
      costChange,
      costPerformanceRatio,
      roi,
      paybackPeriod,
      breakEvenPoint,
      riskAdjustedSavings
    };
  }

  /**
   * Make cost-aware scaling decision
   */
  async makeCostAwareScalingDecision(
    serviceId: string,
    currentReplicas: number,
    recommendedReplicas: number,
    urgency: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<{
    approved: boolean;
    finalReplicas: number;
    reason: string;
    costImpact: ScalingCostAnalysis;
    alternatives: Array<{ replicas: number; cost: number; reason: string }>;
  }> {
    console.log(`💰 Analyzing cost-aware scaling for ${serviceId}: ${currentReplicas} → ${recommendedReplicas}`);

    const costAnalysis = await this.analyzeCostImpact(serviceId, currentReplicas, recommendedReplicas);
    
    // Check budget constraints
    const budgetCheck = await this.checkBudgetConstraints(serviceId, costAnalysis.projectedCost);
    
    // Apply optimization rules
    const rulesResult = await this.applyOptimizationRules(serviceId, currentReplicas, recommendedReplicas, urgency);
    
    // Emergency override logic
    if (urgency === 'critical' || this.healthcareContext.emergencyScalingAllowance > 0) {
      if (urgency === 'critical') {
        console.log('🚨 Critical urgency - approving scaling with emergency override');
        return {
          approved: true,
          finalReplicas: recommendedReplicas,
          reason: 'Emergency override - critical healthcare operation',
          costImpact: costAnalysis,
          alternatives: []
        };
      }
    }

    // Budget enforcement
    if (budgetCheck.exceeded && budgetCheck.budget.enforced) {
      const alternatives = await this.generateCostAlternatives(
        serviceId, 
        currentReplicas, 
        recommendedReplicas
      );
      
      if (alternatives.length > 0) {
        const bestAlternative = alternatives[0];
        console.log(`💡 Budget exceeded, suggesting alternative: ${bestAlternative.replicas} replicas`);
        
        return {
          approved: true,
          finalReplicas: bestAlternative.replicas,
          reason: `Budget constraint - using cost-optimized alternative (${bestAlternative.reason})`,
          costImpact: await this.analyzeCostImpact(serviceId, currentReplicas, bestAlternative.replicas),
          alternatives
        };
      } else {
        console.log('❌ Budget exceeded with no viable alternatives');
        return {
          approved: false,
          finalReplicas: currentReplicas,
          reason: 'Budget exceeded - no cost-effective alternatives available',
          costImpact: costAnalysis,
          alternatives: []
        };
      }
    }

    // Cost-benefit analysis
    if (costAnalysis.roi < -50 && urgency !== 'high') {
      console.log('📊 Poor ROI detected, suggesting optimization');
      
      const optimizedReplicas = await this.optimizeForCostEfficiency(
        serviceId, 
        currentReplicas, 
        recommendedReplicas
      );
      
      return {
        approved: true,
        finalReplicas: optimizedReplicas,
        reason: 'Cost-optimized scaling based on ROI analysis',
        costImpact: await this.analyzeCostImpact(serviceId, currentReplicas, optimizedReplicas),
        alternatives: await this.generateCostAlternatives(serviceId, currentReplicas, recommendedReplicas)
      };
    }

    // Apply rules-based decision
    if (!rulesResult.approved) {
      console.log(`📋 Scaling blocked by rule: ${rulesResult.rule}`);
      return {
        approved: false,
        finalReplicas: currentReplicas,
        reason: `Blocked by optimization rule: ${rulesResult.rule}`,
        costImpact: costAnalysis,
        alternatives: await this.generateCostAlternatives(serviceId, currentReplicas, recommendedReplicas)
      };
    }

    // Approve scaling
    console.log('✅ Cost-aware scaling approved');
    return {
      approved: true,
      finalReplicas: recommendedReplicas,
      reason: 'Cost analysis approved - within budget and performance targets',
      costImpact: costAnalysis,
      alternatives: []
    };
  }

  /**
   * Generate cost predictions for different time horizons
   */
  async generateCostPredictions(
    serviceId: string,
    timeHorizons: number[] = [3600000, 86400000, 604800000] // 1h, 1d, 1w
  ): Promise<CostPrediction[]> {
    const predictions: CostPrediction[] = [];
    
    for (const horizon of timeHorizons) {
      const prediction = await this.predictCostForHorizon(serviceId, horizon);
      predictions.push(prediction);
    }
    
    return predictions;
  }

  /**
   * Predict cost for specific time horizon
   */
  private async predictCostForHorizon(serviceId: string, timeHorizon: number): Promise<CostPrediction> {
    const costProfile = this.costProfiles.get(serviceId);
    if (!costProfile) {
      throw new Error(`Cost profile not found for service: ${serviceId}`);
    }

    // Get historical usage patterns
    const historicalData = this.costHistory.get(serviceId) || [];
    const recentUsage = historicalData.slice(-24); // Last 24 data points
    
    // Predict usage based on healthcare patterns
    const predictedUsage = this.predictHealthcareUsage(serviceId, timeHorizon, recentUsage);
    
    // Calculate predicted cost
    const hourlyDuration = timeHorizon / 3600000;
    const baseCost = predictedUsage.averageReplicas * costProfile.hourlyCost * (1 - costProfile.discountRate);
    const predictedCost = baseCost * hourlyDuration;
    
    // Generate recommendations
    const recommendations = await this.generateCostRecommendations(serviceId, predictedCost, timeHorizon);
    
    return {
      timestamp: new Date(),
      timeHorizon,
      predictedCost,
      confidence: predictedUsage.confidence,
      breakdown: {
        compute: predictedCost * 0.7,
        storage: predictedCost * 0.15,
        network: predictedCost * 0.1,
        other: predictedCost * 0.05
      },
      recommendations
    };
  }

  /**
   * Predict healthcare usage patterns
   */
  private predictHealthcareUsage(
    serviceId: string,
    timeHorizon: number,
    historicalData: Array<{ timestamp: Date; cost: number; usage: any }>
  ): { averageReplicas: number; confidence: number } {
    const currentHour = new Date().getHours();
    const currentDay = new Date().getDay();
    const hoursAhead = timeHorizon / 3600000;
    
    // Healthcare-specific patterns
    let usageMultiplier = 1.0;
    let confidence = 0.7;
    
    // Business hours pattern
    if (currentHour >= 8 && currentHour < 18) {
      usageMultiplier *= 1.5;
      confidence += 0.1;
    } else if (currentHour >= 22 || currentHour < 6) {
      usageMultiplier *= 0.3;
      confidence += 0.1;
    }
    
    // Weekend pattern
    if (currentDay === 0 || currentDay === 6) {
      usageMultiplier *= 0.4;
      confidence += 0.05;
    }
    
    // Seasonal patterns based on healthcare context
    switch (this.healthcareContext.claimProcessingPeriod) {
      case 'peak':
        usageMultiplier *= 2.0;
        confidence += 0.15;
        break;
      case 'low':
        usageMultiplier *= 0.6;
        confidence += 0.1;
        break;
      default:
        confidence += 0.05;
    }
    
    // Base replicas estimation
    const baseReplicas = historicalData.length > 0 
      ? historicalData.reduce((sum, d) => sum + (d.usage?.replicas || 2), 0) / historicalData.length
      : 2;
    
    const averageReplicas = Math.max(1, Math.round(baseReplicas * usageMultiplier));
    
    return {
      averageReplicas,
      confidence: Math.min(1.0, confidence)
    };
  }

  /**
   * Generate cost optimization recommendations
   */
  private async generateCostRecommendations(
    serviceId: string,
    predictedCost: number,
    timeHorizon: number
  ): Promise<CostRecommendation[]> {
    const recommendations: CostRecommendation[] = [];
    const costProfile = this.costProfiles.get(serviceId);
    
    if (!costProfile) return recommendations;
    
    // Reserved instance recommendation
    if (timeHorizon > 2592000000 && costProfile.commitment === 'on-demand') { // > 30 days
      recommendations.push({
        type: 'optimization',
        description: 'Consider reserved instances for long-term predictable workloads',
        potentialSavings: predictedCost * 0.3,
        implementationEffort: 'medium',
        riskAssessment: 'Low risk - provides cost savings with commitment',
        urgency: 'medium',
        healthcareConsiderations: 'Ensure reserved capacity aligns with healthcare demand patterns'
      });
    }
    
    // Spot instance recommendation for non-critical workloads
    if (serviceId !== 'emergency-processor') {
      recommendations.push({
        type: 'optimization',
        description: 'Use spot instances for batch processing and non-critical tasks',
        potentialSavings: predictedCost * 0.6,
        implementationEffort: 'medium',
        riskAssessment: 'Medium risk - potential interruptions',
        urgency: 'low',
        healthcareConsiderations: 'Only for non-critical claim processing that can tolerate interruptions'
      });
    }
    
    // Auto-scaling schedule recommendation
    recommendations.push({
      type: 'scheduling',
      description: 'Implement time-based scaling for predictable healthcare patterns',
      potentialSavings: predictedCost * 0.25,
      implementationEffort: 'low',
      riskAssessment: 'Low risk - follows established patterns',
      urgency: 'medium',
      healthcareConsiderations: 'Schedule should account for emergency claim surges and business hours'
    });
    
    return recommendations;
  }

  /**
   * Check budget constraints
   */
  private async checkBudgetConstraints(
    serviceId: string,
    projectedCost: number
  ): Promise<{ exceeded: boolean; budget: CostBudget; utilization: number }> {
    for (const budget of this.budgets.values()) {
      if (budget.services.includes(serviceId) || budget.services.includes('all')) {
        const currentSpend = await this.getCurrentSpend(budget);
        const totalProjected = currentSpend + projectedCost;
        const utilization = totalProjected / budget.limit;
        
        if (utilization > 1.0) {
          return { exceeded: true, budget, utilization };
        }
      }
    }
    
    return { exceeded: false, budget: this.budgets.values().next().value, utilization: 0 };
  }

  /**
   * Apply cost optimization rules
   */
  private async applyOptimizationRules(
    serviceId: string,
    currentReplicas: number,
    targetReplicas: number,
    urgency: string
  ): Promise<{ approved: boolean; rule?: string }> {
    const activeRules = Array.from(this.optimizationRules.values())
      .filter(rule => rule.enabled)
      .sort((a, b) => b.priority - a.priority);
    
    for (const rule of activeRules) {
      const applies = await this.evaluateRuleCondition(rule.condition, {
        serviceId,
        currentReplicas,
        targetReplicas,
        urgency,
        context: this.healthcareContext
      });
      
      if (applies) {
        console.log(`📋 Applying rule: ${rule.name}`);
        
        if (rule.action === 'defer-scaling' && urgency !== 'critical') {
          return { approved: false, rule: rule.name };
        }
        
        // Other rule actions would be applied here
      }
    }
    
    return { approved: true };
  }

  /**
   * Generate cost-effective alternatives
   */
  private async generateCostAlternatives(
    serviceId: string,
    currentReplicas: number,
    targetReplicas: number
  ): Promise<Array<{ replicas: number; cost: number; reason: string }>> {
    const alternatives: Array<{ replicas: number; cost: number; reason: string }> = [];
    
    // Generate scaled alternatives
    const step = targetReplicas > currentReplicas ? 1 : -1;
    const range = Math.abs(targetReplicas - currentReplicas);
    
    for (let i = 1; i < range; i++) {
      const altReplicas = currentReplicas + (step * i);
      const analysis = await this.analyzeCostImpact(serviceId, currentReplicas, altReplicas);
      
      alternatives.push({
        replicas: altReplicas,
        cost: analysis.projectedCost,
        reason: `Gradual scaling approach - ${i}/${range} steps`
      });
    }
    
    // Sort by cost efficiency
    alternatives.sort((a, b) => a.cost - b.cost);
    
    return alternatives.slice(0, 3); // Return top 3 alternatives
  }

  // Helper methods

  private estimatePerformanceImpact(serviceId: string, currentReplicas: number, targetReplicas: number): number {
    const replicaRatio = targetReplicas / currentReplicas;
    // Diminishing returns for performance scaling
    return Math.log(replicaRatio + 1) / Math.log(2);
  }

  private calculateHealthcareValue(serviceId: string, performanceImprovement: number): number {
    // Healthcare-specific value calculation
    const baseValue = 100; // Base value per performance unit
    const criticalityMultiplier = serviceId.includes('emergency') ? 3 : 1;
    const slaValue = this.healthcareContext.slaRequirements.availability * 10;
    
    return baseValue * performanceImprovement * criticalityMultiplier + slaValue;
  }

  private calculateBreakEvenPoint(costProfile: CostProfile, currentReplicas: number, targetReplicas: number): number {
    const additionalCost = (targetReplicas - currentReplicas) * costProfile.hourlyCost;
    const valuePerHour = 50; // Estimated value per hour for healthcare processing
    
    return additionalCost > 0 ? additionalCost / valuePerHour : 0;
  }

  private calculateRiskAdjustedSavings(costChange: number, serviceId: string, targetReplicas: number): number {
    let riskMultiplier = 1.0;
    
    // Higher risk for emergency services
    if (serviceId.includes('emergency')) {
      riskMultiplier = 0.7;
    }
    
    // Higher risk for aggressive scaling
    if (targetReplicas > 10) {
      riskMultiplier *= 0.8;
    }
    
    return costChange * riskMultiplier;
  }

  private async getCurrentSpend(budget: CostBudget): Promise<number> {
    // Simulate current spending calculation
    const timeframHours = this.getTimeframeHours(budget.timeframe);
    return Math.random() * budget.limit * 0.8; // 80% of budget on average
  }

  private getTimeframeHours(timeframe: string): number {
    switch (timeframe) {
      case 'hourly': return 1;
      case 'daily': return 24;
      case 'weekly': return 168;
      case 'monthly': return 720;
      default: return 24;
    }
  }

  private async optimizeForCostEfficiency(
    serviceId: string,
    currentReplicas: number,
    targetReplicas: number
  ): Promise<number> {
    // Find the sweet spot between cost and performance
    let bestReplicas = currentReplicas;
    let bestRatio = -Infinity;
    
    const step = targetReplicas > currentReplicas ? 1 : -1;
    const range = Math.abs(targetReplicas - currentReplicas);
    
    for (let i = 0; i <= range; i++) {
      const testReplicas = currentReplicas + (step * i);
      const analysis = await this.analyzeCostImpact(serviceId, currentReplicas, testReplicas);
      
      if (analysis.costPerformanceRatio > bestRatio) {
        bestRatio = analysis.costPerformanceRatio;
        bestReplicas = testReplicas;
      }
    }
    
    return bestReplicas;
  }

  private async evaluateRuleCondition(condition: string, context: any): Promise<boolean> {
    // Simplified rule evaluation
    if (condition.includes('emergency_alert') && context.urgency === 'critical') {
      return true;
    }
    
    if (condition.includes('business_hours')) {
      const hour = new Date().getHours();
      return hour >= 8 && hour < 18;
    }
    
    if (condition.includes('usage < 30%')) {
      return Math.random() < 0.3; // Simulate low usage
    }
    
    return false;
  }

  /**
   * Get cost profile for service
   */
  getCostProfile(serviceId: string): CostProfile | undefined {
    return this.costProfiles.get(serviceId);
  }

  /**
   * Get all cost profiles
   */
  getAllCostProfiles(): CostProfile[] {
    return Array.from(this.costProfiles.values());
  }

  /**
   * Get budget information
   */
  getBudget(budgetId: string): CostBudget | undefined {
    return this.budgets.get(budgetId);
  }

  /**
   * Get cost optimization rules
   */
  getOptimizationRules(): CostOptimizationRule[] {
    return Array.from(this.optimizationRules.values());
  }

  /**
   * Update healthcare context
   */
  updateHealthcareContext(context: Partial<HealthcareCostContext>): void {
    this.healthcareContext = { ...this.healthcareContext, ...context };
    console.log('✅ Updated healthcare cost context');
  }
}
