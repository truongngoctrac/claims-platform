/**
 * Capacity Planning Tools
 * Advanced capacity planning for healthcare database systems
 */

export interface CapacityPlanningConfig {
  planningHorizon: number; // months
  growthProjectionMethod: 'linear' | 'exponential' | 'seasonal';
  enableHealthcareProjections: boolean;
  enableAutomatedScaling: boolean;
  resourceThresholds: ResourceThresholds;
}

export interface ResourceThresholds {
  cpuWarning: number; // percentage
  memoryWarning: number; // percentage
  diskWarning: number; // percentage
  connectionWarning: number; // percentage
  queryResponseWarning: number; // milliseconds
}

export interface CapacityMetrics {
  timestamp: Date;
  cpu: number;
  memory: number;
  disk: number;
  connections: number;
  queryThroughput: number;
  avgResponseTime: number;
  patientQueries: number;
  claimsQueries: number;
  reportingQueries: number;
}

export interface CapacityProjection {
  timeframe: string;
  projectedCPU: number;
  projectedMemory: number;
  projectedDisk: number;
  projectedConnections: number;
  projectedThroughput: number;
  recommendations: ScalingRecommendation[];
  healthcareGrowthFactors: HealthcareGrowthFactors;
}

export interface ScalingRecommendation {
  resource: 'cpu' | 'memory' | 'disk' | 'connections' | 'read-replicas';
  currentValue: number;
  recommendedValue: number;
  timeframeMonths: number;
  estimatedCost: number;
  businessJustification: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface HealthcareGrowthFactors {
  patientGrowthRate: number; // percentage per year
  claimsVolumeGrowth: number; // percentage per year
  complianceDataGrowth: number; // percentage per year
  seasonalVariation: number; // percentage variance
}

export class CapacityPlanner {
  private config: CapacityPlanningConfig;
  private historicalMetrics: CapacityMetrics[] = [];
  private projections: CapacityProjection[] = [];

  constructor(config: Partial<CapacityPlanningConfig> = {}) {
    this.config = {
      planningHorizon: 12, // 12 months
      growthProjectionMethod: 'linear',
      enableHealthcareProjections: true,
      enableAutomatedScaling: false,
      resourceThresholds: {
        cpuWarning: 80,
        memoryWarning: 85,
        diskWarning: 80,
        connectionWarning: 80,
        queryResponseWarning: 2000
      },
      ...config
    };
  }

  /**
   * Add capacity metrics for analysis
   */
  addMetrics(metrics: CapacityMetrics): void {
    this.historicalMetrics.push(metrics);
    
    // Keep only last 12 months of data
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 12);
    
    this.historicalMetrics = this.historicalMetrics.filter(m => m.timestamp > cutoffDate);
  }

  /**
   * Generate capacity projections for healthcare system
   */
  generateCapacityProjections(): CapacityProjection[] {
    console.log('📈 Generating healthcare capacity projections...');
    
    this.projections = [];
    
    // Generate projections for each month in planning horizon
    for (let month = 1; month <= this.config.planningHorizon; month++) {
      const projection = this.generateMonthlyProjection(month);
      this.projections.push(projection);
    }
    
    return this.projections;
  }

  /**
   * Generate projection for specific month
   */
  private generateMonthlyProjection(monthsAhead: number): CapacityProjection {
    const currentMetrics = this.getCurrentAverageMetrics();
    const growthFactors = this.calculateHealthcareGrowthFactors();
    const growthMultiplier = this.calculateGrowthMultiplier(monthsAhead, growthFactors);
    
    // Project resource usage
    const projectedCPU = currentMetrics.cpu * growthMultiplier.cpu;
    const projectedMemory = currentMetrics.memory * growthMultiplier.memory;
    const projectedDisk = currentMetrics.disk * growthMultiplier.disk;
    const projectedConnections = currentMetrics.connections * growthMultiplier.connections;
    const projectedThroughput = currentMetrics.queryThroughput * growthMultiplier.throughput;
    
    // Generate scaling recommendations
    const recommendations = this.generateScalingRecommendations({
      cpu: projectedCPU,
      memory: projectedMemory,
      disk: projectedDisk,
      connections: projectedConnections,
      throughput: projectedThroughput
    }, monthsAhead);
    
    return {
      timeframe: `${monthsAhead} month${monthsAhead > 1 ? 's' : ''}`,
      projectedCPU,
      projectedMemory,
      projectedDisk,
      projectedConnections,
      projectedThroughput,
      recommendations,
      healthcareGrowthFactors: growthFactors
    };
  }

  /**
   * Calculate healthcare-specific growth factors
   */
  private calculateHealthcareGrowthFactors(): HealthcareGrowthFactors {
    if (!this.config.enableHealthcareProjections) {
      return {
        patientGrowthRate: 5, // 5% annual growth
        claimsVolumeGrowth: 8, // 8% annual growth
        complianceDataGrowth: 15, // 15% annual growth (increasing regulations)
        seasonalVariation: 10 // 10% seasonal variance
      };
    }

    // Analyze historical patterns
    const recentMetrics = this.historicalMetrics.slice(-90); // Last 3 months
    const olderMetrics = this.historicalMetrics.slice(-180, -90); // Previous 3 months
    
    let patientGrowthRate = 5;
    let claimsVolumeGrowth = 8;
    let complianceDataGrowth = 15;
    
    if (recentMetrics.length > 0 && olderMetrics.length > 0) {
      const recentPatientAvg = recentMetrics.reduce((sum, m) => sum + m.patientQueries, 0) / recentMetrics.length;
      const olderPatientAvg = olderMetrics.reduce((sum, m) => sum + m.patientQueries, 0) / olderMetrics.length;
      patientGrowthRate = ((recentPatientAvg - olderPatientAvg) / olderPatientAvg) * 100 * 4; // Annualized
      
      const recentClaimsAvg = recentMetrics.reduce((sum, m) => sum + m.claimsQueries, 0) / recentMetrics.length;
      const olderClaimsAvg = olderMetrics.reduce((sum, m) => sum + m.claimsQueries, 0) / olderMetrics.length;
      claimsVolumeGrowth = ((recentClaimsAvg - olderClaimsAvg) / olderClaimsAvg) * 100 * 4; // Annualized
    }
    
    return {
      patientGrowthRate: Math.max(0, patientGrowthRate),
      claimsVolumeGrowth: Math.max(0, claimsVolumeGrowth),
      complianceDataGrowth,
      seasonalVariation: 10
    };
  }

  /**
   * Calculate growth multiplier for different resources
   */
  private calculateGrowthMultiplier(monthsAhead: number, growthFactors: HealthcareGrowthFactors): any {
    const yearsFraction = monthsAhead / 12;
    
    // Different resources grow at different rates
    const baseGrowthRate = (growthFactors.patientGrowthRate + growthFactors.claimsVolumeGrowth) / 2 / 100;
    
    return {
      cpu: 1 + (baseGrowthRate * yearsFraction * 1.2), // CPU grows faster due to complexity
      memory: 1 + (baseGrowthRate * yearsFraction * 1.1), // Memory grows with data
      disk: 1 + (growthFactors.complianceDataGrowth / 100 * yearsFraction), // Disk grows with compliance data
      connections: 1 + (baseGrowthRate * yearsFraction), // Connections grow with users
      throughput: 1 + (baseGrowthRate * yearsFraction * 1.3) // Throughput grows with usage patterns
    };
  }

  /**
   * Get current average metrics
   */
  private getCurrentAverageMetrics(): CapacityMetrics {
    if (this.historicalMetrics.length === 0) {
      // Return defaults if no historical data
      return {
        timestamp: new Date(),
        cpu: 45,
        memory: 60,
        disk: 40,
        connections: 25,
        queryThroughput: 150,
        avgResponseTime: 200,
        patientQueries: 1000,
        claimsQueries: 800,
        reportingQueries: 200
      };
    }
    
    // Calculate averages from recent data (last 30 days)
    const recentMetrics = this.historicalMetrics.slice(-30);
    const count = recentMetrics.length;
    
    return {
      timestamp: new Date(),
      cpu: recentMetrics.reduce((sum, m) => sum + m.cpu, 0) / count,
      memory: recentMetrics.reduce((sum, m) => sum + m.memory, 0) / count,
      disk: recentMetrics.reduce((sum, m) => sum + m.disk, 0) / count,
      connections: recentMetrics.reduce((sum, m) => sum + m.connections, 0) / count,
      queryThroughput: recentMetrics.reduce((sum, m) => sum + m.queryThroughput, 0) / count,
      avgResponseTime: recentMetrics.reduce((sum, m) => sum + m.avgResponseTime, 0) / count,
      patientQueries: recentMetrics.reduce((sum, m) => sum + m.patientQueries, 0) / count,
      claimsQueries: recentMetrics.reduce((sum, m) => sum + m.claimsQueries, 0) / count,
      reportingQueries: recentMetrics.reduce((sum, m) => sum + m.reportingQueries, 0) / count
    };
  }

  /**
   * Generate scaling recommendations
   */
  private generateScalingRecommendations(
    projectedUsage: any, 
    monthsAhead: number
  ): ScalingRecommendation[] {
    const recommendations: ScalingRecommendation[] = [];
    
    // CPU scaling recommendation
    if (projectedUsage.cpu > this.config.resourceThresholds.cpuWarning) {
      recommendations.push({
        resource: 'cpu',
        currentValue: this.getCurrentAverageMetrics().cpu,
        recommendedValue: Math.ceil(projectedUsage.cpu * 1.2), // 20% buffer
        timeframeMonths: monthsAhead,
        estimatedCost: this.estimateCPUCost(projectedUsage.cpu),
        businessJustification: 'Prevent patient care delays due to slow database response times',
        priority: projectedUsage.cpu > 90 ? 'critical' : 'high'
      });
    }
    
    // Memory scaling recommendation
    if (projectedUsage.memory > this.config.resourceThresholds.memoryWarning) {
      recommendations.push({
        resource: 'memory',
        currentValue: this.getCurrentAverageMetrics().memory,
        recommendedValue: Math.ceil(projectedUsage.memory * 1.15), // 15% buffer
        timeframeMonths: monthsAhead,
        estimatedCost: this.estimateMemoryCost(projectedUsage.memory),
        businessJustification: 'Maintain query performance for healthcare operations',
        priority: projectedUsage.memory > 95 ? 'critical' : 'medium'
      });
    }
    
    // Disk scaling recommendation
    if (projectedUsage.disk > this.config.resourceThresholds.diskWarning) {
      recommendations.push({
        resource: 'disk',
        currentValue: this.getCurrentAverageMetrics().disk,
        recommendedValue: Math.ceil(projectedUsage.disk * 1.3), // 30% buffer for healthcare compliance
        timeframeMonths: monthsAhead,
        estimatedCost: this.estimateDiskCost(projectedUsage.disk),
        businessJustification: 'Ensure adequate storage for patient data and compliance requirements',
        priority: projectedUsage.disk > 90 ? 'critical' : 'medium'
      });
    }
    
    // Connection scaling recommendation
    if (projectedUsage.connections > this.config.resourceThresholds.connectionWarning) {
      recommendations.push({
        resource: 'connections',
        currentValue: this.getCurrentAverageMetrics().connections,
        recommendedValue: Math.ceil(projectedUsage.connections * 1.25), // 25% buffer
        timeframeMonths: monthsAhead,
        estimatedCost: this.estimateConnectionCost(projectedUsage.connections),
        businessJustification: 'Support increased concurrent healthcare users and applications',
        priority: 'medium'
      });
    }
    
    // Read replica recommendation for high throughput
    if (projectedUsage.throughput > 500) { // 500 QPS threshold
      recommendations.push({
        resource: 'read-replicas',
        currentValue: 1,
        recommendedValue: Math.ceil(projectedUsage.throughput / 300), // 300 QPS per replica
        timeframeMonths: monthsAhead,
        estimatedCost: this.estimateReplicaCost(projectedUsage.throughput),
        businessJustification: 'Distribute read load for reporting and analytics without impacting patient care',
        priority: 'medium'
      });
    }
    
    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Cost estimation methods
   */
  private estimateCPUCost(usage: number): number {
    // Simplified cost model: $50 per month per CPU core
    const currentCores = 8;
    const projectedCores = Math.ceil((usage / 100) * currentCores * 1.2);
    return (projectedCores - currentCores) * 50;
  }

  private estimateMemoryCost(usage: number): number {
    // Simplified cost model: $20 per month per GB
    const currentMemoryGB = 32;
    const projectedMemoryGB = Math.ceil((usage / 100) * currentMemoryGB * 1.15);
    return (projectedMemoryGB - currentMemoryGB) * 20;
  }

  private estimateDiskCost(usage: number): number {
    // Simplified cost model: $0.10 per month per GB
    const currentDiskGB = 1000;
    const projectedDiskGB = Math.ceil((usage / 100) * currentDiskGB * 1.3);
    return (projectedDiskGB - currentDiskGB) * 0.10;
  }

  private estimateConnectionCost(usage: number): number {
    // Connection scaling usually involves upgrading instance type
    return usage > 80 ? 200 : 0; // $200 for instance upgrade
  }

  private estimateReplicaCost(throughput: number): number {
    // Cost of additional read replicas
    const replicasNeeded = Math.ceil(throughput / 300) - 1;
    return replicasNeeded * 150; // $150 per replica per month
  }

  /**
   * Generate capacity planning report
   */
  generateCapacityReport(): string {
    if (this.projections.length === 0) {
      this.generateCapacityProjections();
    }

    const criticalRecommendations = this.projections
      .flatMap(p => p.recommendations)
      .filter(r => r.priority === 'critical');

    const totalEstimatedCost = this.projections
      .flatMap(p => p.recommendations)
      .reduce((sum, r) => sum + r.estimatedCost, 0);

    return `
# Healthcare Database Capacity Planning Report

## Executive Summary
- **Planning Horizon**: ${this.config.planningHorizon} months
- **Critical Recommendations**: ${criticalRecommendations.length}
- **Total Estimated Investment**: $${totalEstimatedCost.toLocaleString()}/month
- **Healthcare Growth Analysis**: ${this.config.enableHealthcareProjections ? 'Enabled' : 'Disabled'}

## Current Capacity Status
${this.generateCurrentCapacityStatus()}

## Growth Projections
${this.generateGrowthProjections()}

## Scaling Recommendations
${this.generateScalingRecommendationsSummary()}

## Healthcare-Specific Considerations
${this.generateHealthcareConsiderations()}

## Implementation Timeline
${this.generateImplementationTimeline()}

## Cost-Benefit Analysis
${this.generateCostBenefitAnalysis()}

## Risk Assessment
${this.generateRiskAssessment()}
    `.trim();
  }

  private generateCurrentCapacityStatus(): string {
    const current = this.getCurrentAverageMetrics();
    
    return `
- **CPU Usage**: ${current.cpu.toFixed(1)}% (${current.cpu > this.config.resourceThresholds.cpuWarning ? '⚠️ Warning' : '✅ Normal'})
- **Memory Usage**: ${current.memory.toFixed(1)}% (${current.memory > this.config.resourceThresholds.memoryWarning ? '⚠️ Warning' : '✅ Normal'})
- **Disk Usage**: ${current.disk.toFixed(1)}% (${current.disk > this.config.resourceThresholds.diskWarning ? '⚠️ Warning' : '✅ Normal'})
- **Connection Usage**: ${current.connections.toFixed(1)}% (${current.connections > this.config.resourceThresholds.connectionWarning ? '⚠️ Warning' : '✅ Normal'})
- **Query Throughput**: ${current.queryThroughput.toFixed(1)} QPS
- **Average Response Time**: ${current.avgResponseTime.toFixed(1)}ms
    `.trim();
  }

  private generateGrowthProjections(): string {
    const shortTerm = this.projections.find(p => p.timeframe.includes('3'));
    const mediumTerm = this.projections.find(p => p.timeframe.includes('6'));
    const longTerm = this.projections.find(p => p.timeframe.includes('12'));

    return `
### 3-Month Projection
${shortTerm ? `- CPU: ${shortTerm.projectedCPU.toFixed(1)}%, Memory: ${shortTerm.projectedMemory.toFixed(1)}%, Disk: ${shortTerm.projectedDisk.toFixed(1)}%` : 'Not available'}

### 6-Month Projection  
${mediumTerm ? `- CPU: ${mediumTerm.projectedCPU.toFixed(1)}%, Memory: ${mediumTerm.projectedMemory.toFixed(1)}%, Disk: ${mediumTerm.projectedDisk.toFixed(1)}%` : 'Not available'}

### 12-Month Projection
${longTerm ? `- CPU: ${longTerm.projectedCPU.toFixed(1)}%, Memory: ${longTerm.projectedMemory.toFixed(1)}%, Disk: ${longTerm.projectedDisk.toFixed(1)}%` : 'Not available'}
    `.trim();
  }

  private generateScalingRecommendationsSummary(): string {
    const allRecommendations = this.projections.flatMap(p => p.recommendations);
    const byPriority = allRecommendations.reduce((acc, rec) => {
      acc[rec.priority] = (acc[rec.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return `
### Priority Breakdown
- **Critical**: ${byPriority.critical || 0} recommendations
- **High**: ${byPriority.high || 0} recommendations  
- **Medium**: ${byPriority.medium || 0} recommendations
- **Low**: ${byPriority.low || 0} recommendations

### Top Recommendations
${allRecommendations.slice(0, 3).map((rec, i) => `
${i + 1}. **${rec.resource.toUpperCase()}** (${rec.priority})
   - Scale from ${rec.currentValue} to ${rec.recommendedValue}
   - Timeline: ${rec.timeframeMonths} months
   - Cost: $${rec.estimatedCost}/month
   - Justification: ${rec.businessJustification}
`).join('')}
    `.trim();
  }

  private generateHealthcareConsiderations(): string {
    const growthFactors = this.calculateHealthcareGrowthFactors();
    
    return `
### Healthcare Data Growth Patterns
- **Patient Registration Growth**: ${growthFactors.patientGrowthRate.toFixed(1)}% annually
- **Claims Volume Growth**: ${growthFactors.claimsVolumeGrowth.toFixed(1)}% annually
- **Compliance Data Growth**: ${growthFactors.complianceDataGrowth.toFixed(1)}% annually
- **Seasonal Variation**: ±${growthFactors.seasonalVariation}%

### Compliance Requirements
- **Data Retention**: 7+ years for healthcare records
- **Backup Requirements**: Daily backups with 4-hour RTO
- **High Availability**: 99.9% uptime requirement
- **HIPAA Compliance**: Encrypted storage and transmission

### Business Impact Factors
- **Patient Care**: Database performance directly affects patient access
- **Provider Satisfaction**: Slow systems impact provider workflow
- **Regulatory Compliance**: Adequate resources needed for audit trails
- **Financial Operations**: Claims processing efficiency affects cash flow
    `.trim();
  }

  private generateImplementationTimeline(): string {
    const criticalItems = this.projections
      .flatMap(p => p.recommendations)
      .filter(r => r.priority === 'critical')
      .sort((a, b) => a.timeframeMonths - b.timeframeMonths);

    return `
### Immediate Actions (0-3 months)
${criticalItems.filter(r => r.timeframeMonths <= 3).map(r => 
  `- Scale ${r.resource}: ${r.businessJustification}`
).join('\n') || '- No immediate critical actions required'}

### Short-term Actions (3-6 months)
${criticalItems.filter(r => r.timeframeMonths > 3 && r.timeframeMonths <= 6).map(r => 
  `- Scale ${r.resource}: ${r.businessJustification}`
).join('\n') || '- Continue monitoring current capacity'}

### Long-term Planning (6-12 months)
${criticalItems.filter(r => r.timeframeMonths > 6).map(r => 
  `- Scale ${r.resource}: ${r.businessJustification}`
).join('\n') || '- Plan for projected growth patterns'}
    `.trim();
  }

  private generateCostBenefitAnalysis(): string {
    const totalCost = this.projections
      .flatMap(p => p.recommendations)
      .reduce((sum, r) => sum + r.estimatedCost, 0);
    
    const estimatedRevenueLoss = 50000; // $50k monthly revenue at risk from poor performance
    
    return `
### Investment vs Risk
- **Total Monthly Investment**: $${totalCost.toLocaleString()}
- **Estimated Revenue at Risk**: $${estimatedRevenueLoss.toLocaleString()}/month
- **ROI from Prevented Downtime**: ${((estimatedRevenueLoss - totalCost) / totalCost * 100).toFixed(1)}%
- **Patient Care Continuity**: Priceless

### Business Benefits
- **Improved Patient Satisfaction**: Faster access to medical records
- **Enhanced Provider Efficiency**: Reduced wait times for claims processing
- **Regulatory Compliance**: Adequate resources for audit and reporting
- **Business Continuity**: Reduced risk of system outages
    `.trim();
  }

  private generateRiskAssessment(): string {
    const highUsageResources = this.projections
      .flatMap(p => [
        { name: 'CPU', value: p.projectedCPU, months: p.timeframe },
        { name: 'Memory', value: p.projectedMemory, months: p.timeframe },
        { name: 'Disk', value: p.projectedDisk, months: p.timeframe }
      ])
      .filter(r => r.value > 90);

    return `
### Capacity Risks
${highUsageResources.length > 0 ? 
  highUsageResources.map(r => `- **${r.name}** exceeds 90% in ${r.months}`).join('\n') :
  '- No critical capacity risks identified'
}

### Business Risks
- **Patient Care Disruption**: Database slowdowns affect clinical workflows
- **Compliance Violations**: Inadequate audit trail storage capacity
- **Provider Satisfaction**: Poor performance impacts provider retention
- **Revenue Impact**: Claims processing delays affect cash flow

### Mitigation Strategies
- **Proactive Scaling**: Implement recommendations before reaching thresholds
- **Monitoring Alerts**: Set up early warning systems at 70% utilization
- **Load Balancing**: Distribute workload across read replicas
- **Disaster Recovery**: Maintain adequate backup and recovery capabilities
    `.trim();
  }

  getProjections(): CapacityProjection[] {
    return [...this.projections];
  }

  getCurrentMetrics(): CapacityMetrics {
    return this.getCurrentAverageMetrics();
  }
}
