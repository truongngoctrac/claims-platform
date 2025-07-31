/**
 * Capacity Planning Automation
 * Automates capacity planning for healthcare infrastructure using predictive analytics and historical data
 */

import { 
  CapacityPlanningData,
  GrowthTrend,
  SeasonalPattern,
  CapacityRecommendation,
  OptimizationRecommendation 
} from './types';

export class CapacityPlanningAutomation {
  private historicalData: Map<string, any[]> = new Map();
  private capacityMetrics: CapacityPlanningData[] = [];
  private planningInterval: NodeJS.Timeout | null = null;
  private lastPlanningRun: number = 0;

  constructor() {}

  public async initialize(): Promise<void> {
    console.log('📊 Initializing Capacity Planning Automation...');
    await this.loadHistoricalData();
    await this.initializeMetricsCollection();
    this.startCapacityPlanning();
  }

  private async loadHistoricalData(): Promise<void> {
    console.log('📈 Loading historical capacity data...');
    
    // Simulate loading historical data for different metrics
    const metrics = [
      'cpu-usage', 'memory-usage', 'storage-usage', 'network-throughput',
      'user-requests', 'database-connections', 'api-calls', 'concurrent-users'
    ];

    for (const metric of metrics) {
      const historicalPoints = this.generateHistoricalData(metric);
      this.historicalData.set(metric, historicalPoints);
    }
  }

  private generateHistoricalData(metric: string): any[] {
    const data = [];
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    
    // Generate 90 days of historical data
    for (let i = 90; i >= 0; i--) {
      const timestamp = now - (i * oneDay);
      const baseValue = this.getBaselineValue(metric);
      
      // Add seasonal variation
      const seasonalMultiplier = this.getSeasonalMultiplier(timestamp, metric);
      
      // Add weekly pattern (higher during weekdays for business metrics)
      const weeklyMultiplier = this.getWeeklyMultiplier(timestamp, metric);
      
      // Add some random variation
      const randomVariation = 0.8 + (Math.random() * 0.4); // ±20% variation
      
      const value = baseValue * seasonalMultiplier * weeklyMultiplier * randomVariation;
      
      data.push({
        timestamp,
        value: Math.max(0, value),
        metric
      });
    }
    
    return data;
  }

  private getBaselineValue(metric: string): number {
    const baselines = {
      'cpu-usage': 45,
      'memory-usage': 60,
      'storage-usage': 70,
      'network-throughput': 500,
      'user-requests': 1000,
      'database-connections': 50,
      'api-calls': 2000,
      'concurrent-users': 150
    };
    
    return baselines[metric as keyof typeof baselines] || 50;
  }

  private getSeasonalMultiplier(timestamp: number, metric: string): number {
    const date = new Date(timestamp);
    const month = date.getMonth(); // 0-11
    
    // Healthcare typically sees higher activity in winter months (flu season)
    const healthcareSeasonality = [
      1.2, 1.3, 1.1, 0.9, 0.8, 0.7, // Jan-Jun
      0.8, 0.9, 1.0, 1.1, 1.2, 1.3  // Jul-Dec
    ];
    
    // General business metrics might follow different patterns
    const businessSeasonality = [
      0.9, 1.0, 1.1, 1.2, 1.1, 1.0, // Jan-Jun
      0.8, 0.9, 1.1, 1.2, 1.1, 1.0  // Jul-Dec
    ];
    
    const isHealthcareMetric = ['user-requests', 'api-calls', 'concurrent-users'].includes(metric);
    const seasonality = isHealthcareMetric ? healthcareSeasonality : businessSeasonality;
    
    return seasonality[month];
  }

  private getWeeklyMultiplier(timestamp: number, metric: string): number {
    const date = new Date(timestamp);
    const dayOfWeek = date.getDay(); // 0 = Sunday
    
    // Business hours pattern - higher during weekdays
    const businessPattern = [0.3, 1.0, 1.2, 1.2, 1.2, 1.1, 0.4]; // Sun-Sat
    
    // Healthcare pattern - more consistent but still higher during weekdays
    const healthcarePattern = [0.7, 1.0, 1.1, 1.1, 1.1, 1.0, 0.8]; // Sun-Sat
    
    const isBusinessMetric = ['api-calls', 'database-connections'].includes(metric);
    const pattern = isBusinessMetric ? businessPattern : healthcarePattern;
    
    return pattern[dayOfWeek];
  }

  private async initializeMetricsCollection(): Promise<void> {
    console.log('🔧 Initializing capacity metrics collection...');
    
    // Perform initial capacity analysis
    const initialData = await this.analyzeCurrentCapacity();
    this.capacityMetrics.push(initialData);
  }

  private startCapacityPlanning(): void {
    console.log('🚀 Starting automated capacity planning...');
    
    // Run capacity planning analysis daily
    this.planningInterval = setInterval(async () => {
      await this.performCapacityAnalysis();
      await this.updateCapacityRecommendations();
    }, 24 * 60 * 60 * 1000); // Run daily
  }

  private async performCapacityAnalysis(): Promise<void> {
    console.log('📊 Performing capacity analysis...');
    
    const capacityData = await this.analyzeCurrentCapacity();
    this.capacityMetrics.push(capacityData);
    
    // Keep only last 30 days of capacity metrics
    if (this.capacityMetrics.length > 30) {
      this.capacityMetrics = this.capacityMetrics.slice(-30);
    }
    
    this.lastPlanningRun = Date.now();
  }

  private async analyzeCurrentCapacity(): Promise<CapacityPlanningData> {
    const currentCapacity = await this.getCurrentCapacity();
    const growthTrends = await this.analyzeGrowthTrends();
    const seasonalPatterns = await this.analyzeSeasonalPatterns();
    const recommendations = await this.generateCapacityRecommendations(growthTrends, seasonalPatterns);
    
    const projectedGrowth = this.calculateProjectedGrowth(growthTrends);
    const recommendedCapacity = this.calculateRecommendedCapacity(currentCapacity, projectedGrowth);

    return {
      currentCapacity,
      projectedGrowth,
      recommendedCapacity,
      growthTrends,
      seasonalPatterns,
      capacityRecommendations: recommendations
    };
  }

  private async getCurrentCapacity(): Promise<number> {
    // Simulate current capacity calculation (could be in compute units, storage GB, etc.)
    // This would typically aggregate across all resource types
    
    const cpuCapacity = 100; // Total CPU cores
    const memoryCapacity = 500; // Total GB RAM
    const storageCapacity = 5000; // Total GB storage
    
    // Weighted capacity score
    return (cpuCapacity * 0.4) + (memoryCapacity * 0.4) + (storageCapacity * 0.2);
  }

  private async analyzeGrowthTrends(): Promise<GrowthTrend[]> {
    const trends: GrowthTrend[] = [];
    
    for (const [metric, data] of this.historicalData) {
      const trend = this.calculateTrend(data);
      
      trends.push({
        metric,
        currentValue: trend.currentValue,
        projectedValue: trend.projectedValue,
        growthRate: trend.growthRate,
        confidence: trend.confidence,
        timeframe: '3-months'
      });
    }
    
    return trends;
  }

  private calculateTrend(data: any[]): {
    currentValue: number;
    projectedValue: number;
    growthRate: number;
    confidence: number;
  } {
    if (data.length < 30) {
      return { currentValue: 0, projectedValue: 0, growthRate: 0, confidence: 0 };
    }

    // Get recent data points (last 30 days)
    const recentData = data.slice(-30);
    const values = recentData.map(d => d.value);
    
    // Calculate linear regression
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
    const sumXX = x.reduce((acc, xi) => acc + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const currentValue = values[values.length - 1];
    const projectedValue = slope * (n + 90) + intercept; // Project 90 days ahead
    const growthRate = ((projectedValue - currentValue) / currentValue) * 100;

    // Calculate confidence based on R-squared
    const yMean = sumY / n;
    const ssRes = y.reduce((acc, yi, i) => acc + Math.pow(yi - (slope * x[i] + intercept), 2), 0);
    const ssTot = y.reduce((acc, yi) => acc + Math.pow(yi - yMean, 2), 0);
    const rSquared = 1 - (ssRes / ssTot);
    const confidence = Math.max(0, Math.min(1, rSquared));

    return {
      currentValue,
      projectedValue: Math.max(0, projectedValue),
      growthRate,
      confidence
    };
  }

  private async analyzeSeasonalPatterns(): Promise<SeasonalPattern[]> {
    const patterns: SeasonalPattern[] = [];
    
    for (const [metric, data] of this.historicalData) {
      const pattern = this.detectSeasonalPattern(data);
      
      patterns.push({
        metric,
        pattern: pattern.type,
        peakPeriods: pattern.peaks,
        lowPeriods: pattern.lows,
        scalingRecommendation: pattern.recommendation
      });
    }
    
    return patterns;
  }

  private detectSeasonalPattern(data: any[]): {
    type: string;
    peaks: string[];
    lows: string[];
    recommendation: string;
  } {
    // Analyze monthly averages to detect seasonal patterns
    const monthlyAverages = Array(12).fill(0);
    const monthlyCounts = Array(12).fill(0);
    
    data.forEach(point => {
      const month = new Date(point.timestamp).getMonth();
      monthlyAverages[month] += point.value;
      monthlyCounts[month]++;
    });
    
    // Calculate averages
    for (let i = 0; i < 12; i++) {
      if (monthlyCounts[i] > 0) {
        monthlyAverages[i] /= monthlyCounts[i];
      }
    }
    
    const overallAverage = monthlyAverages.reduce((a, b) => a + b, 0) / 12;
    const peaks: string[] = [];
    const lows: string[] = [];
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    monthlyAverages.forEach((avg, index) => {
      if (avg > overallAverage * 1.2) {
        peaks.push(months[index]);
      } else if (avg < overallAverage * 0.8) {
        lows.push(months[index]);
      }
    });
    
    let patternType = 'stable';
    let recommendation = 'Maintain current capacity';
    
    if (peaks.length > 0 && lows.length > 0) {
      patternType = 'seasonal';
      recommendation = 'Implement seasonal auto-scaling policies';
    } else if (peaks.length > 2) {
      patternType = 'high-variance';
      recommendation = 'Consider dynamic scaling with higher thresholds';
    }
    
    return {
      type: patternType,
      peaks,
      lows,
      recommendation
    };
  }

  private async generateCapacityRecommendations(
    growthTrends: GrowthTrend[], 
    seasonalPatterns: SeasonalPattern[]
  ): Promise<CapacityRecommendation[]> {
    const recommendations: CapacityRecommendation[] = [];
    
    // CPU capacity recommendations
    const cpuTrend = growthTrends.find(t => t.metric === 'cpu-usage');
    if (cpuTrend && cpuTrend.confidence > 0.7) {
      recommendations.push(this.createCapacityRecommendation('CPU', cpuTrend));
    }
    
    // Memory capacity recommendations
    const memoryTrend = growthTrends.find(t => t.metric === 'memory-usage');
    if (memoryTrend && memoryTrend.confidence > 0.7) {
      recommendations.push(this.createCapacityRecommendation('Memory', memoryTrend));
    }
    
    // Storage capacity recommendations
    const storageTrend = growthTrends.find(t => t.metric === 'storage-usage');
    if (storageTrend && storageTrend.confidence > 0.7) {
      recommendations.push(this.createCapacityRecommendation('Storage', storageTrend));
    }
    
    // Network capacity recommendations
    const networkTrend = growthTrends.find(t => t.metric === 'network-throughput');
    if (networkTrend && networkTrend.confidence > 0.7) {
      recommendations.push(this.createCapacityRecommendation('Network', networkTrend));
    }
    
    return recommendations;
  }

  private createCapacityRecommendation(resource: string, trend: GrowthTrend): CapacityRecommendation {
    let action: 'increase' | 'decrease' | 'maintain' = 'maintain';
    let timeline = '3-6 months';
    let reason = 'Stable growth pattern detected';
    
    if (trend.growthRate > 20) {
      action = 'increase';
      timeline = '1-2 months';
      reason = `High growth rate (${trend.growthRate.toFixed(1)}%) requires capacity increase`;
    } else if (trend.growthRate < -10) {
      action = 'decrease';
      timeline = '2-3 months';
      reason = `Negative growth rate (${trend.growthRate.toFixed(1)}%) suggests capacity reduction`;
    } else if (trend.growthRate > 10) {
      action = 'increase';
      timeline = '2-3 months';
      reason = `Moderate growth rate (${trend.growthRate.toFixed(1)}%) requires gradual increase`;
    }
    
    const currentCapacity = trend.currentValue;
    let recommendedCapacity = currentCapacity;
    
    if (action === 'increase') {
      recommendedCapacity = currentCapacity * (1 + (trend.growthRate / 100) * 1.2); // Add 20% buffer
    } else if (action === 'decrease') {
      recommendedCapacity = currentCapacity * 0.9; // Reduce by 10%
    }
    
    return {
      resource,
      action,
      currentCapacity,
      recommendedCapacity,
      timeline,
      reason
    };
  }

  private calculateProjectedGrowth(growthTrends: GrowthTrend[]): number {
    // Calculate weighted average growth rate across all metrics
    let totalGrowth = 0;
    let totalWeight = 0;
    
    growthTrends.forEach(trend => {
      const weight = trend.confidence;
      totalGrowth += trend.growthRate * weight;
      totalWeight += weight;
    });
    
    return totalWeight > 0 ? totalGrowth / totalWeight : 0;
  }

  private calculateRecommendedCapacity(currentCapacity: number, projectedGrowth: number): number {
    // Add growth buffer and safety margin
    const growthMultiplier = 1 + (projectedGrowth / 100);
    const safetyMargin = 1.15; // 15% safety margin
    
    return currentCapacity * growthMultiplier * safetyMargin;
  }

  private async updateCapacityRecommendations(): Promise<void> {
    console.log('🔄 Updating capacity recommendations...');
    
    const latestData = this.capacityMetrics[this.capacityMetrics.length - 1];
    
    if (latestData) {
      // Check if immediate action is needed
      const urgentRecommendations = latestData.capacityRecommendations.filter(rec => 
        rec.action !== 'maintain' && rec.timeline.includes('1-2')
      );
      
      if (urgentRecommendations.length > 0) {
        console.warn(`⚠️ ${urgentRecommendations.length} urgent capacity recommendations require attention`);
      }
    }
  }

  public async forecastCapacityNeeds(timeframe: string): Promise<any> {
    console.log(`🔮 Forecasting capacity needs for ${timeframe}...`);
    
    const growthTrends = await this.analyzeGrowthTrends();
    const forecast: any = {};
    
    const multipliers = {
      '1-month': 1/12,
      '3-months': 3/12,
      '6-months': 6/12,
      '1-year': 1
    };
    
    const multiplier = multipliers[timeframe as keyof typeof multipliers] || 1;
    
    growthTrends.forEach(trend => {
      if (trend.confidence > 0.5) {
        const projectedIncrease = trend.growthRate * multiplier;
        forecast[trend.metric] = {
          currentValue: trend.currentValue,
          projectedValue: trend.currentValue * (1 + projectedIncrease / 100),
          expectedGrowth: projectedIncrease,
          confidence: trend.confidence
        };
      }
    });
    
    return forecast;
  }

  public getOptimizationRecommendations(): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];
    
    if (this.capacityMetrics.length === 0) return recommendations;

    const latestData = this.capacityMetrics[this.capacityMetrics.length - 1];
    
    // High growth recommendations
    const highGrowthTrends = latestData.growthTrends.filter(t => t.growthRate > 20 && t.confidence > 0.7);
    if (highGrowthTrends.length > 0) {
      recommendations.push({
        id: 'capacity-high-growth',
        category: 'capacity-planning',
        priority: 'high',
        title: 'High Growth Capacity Planning',
        description: `${highGrowthTrends.length} metrics showing high growth rates`,
        expectedImpact: 'Prevent capacity bottlenecks and performance degradation',
        implementation: [
          'Implement predictive auto-scaling',
          'Increase baseline capacity',
          'Set up proactive monitoring alerts',
          'Plan infrastructure expansion'
        ],
        estimatedCost: 5000,
        estimatedSavings: 15000,
        timeline: '2-4 weeks'
      });
    }

    // Seasonal scaling recommendations
    const seasonalMetrics = latestData.seasonalPatterns.filter(p => p.pattern === 'seasonal');
    if (seasonalMetrics.length > 0) {
      recommendations.push({
        id: 'capacity-seasonal-scaling',
        category: 'capacity-planning',
        priority: 'medium',
        title: 'Implement Seasonal Scaling',
        description: `${seasonalMetrics.length} metrics show seasonal patterns`,
        expectedImpact: 'Optimize costs and performance for seasonal variations',
        implementation: [
          'Configure seasonal auto-scaling policies',
          'Set up scheduled capacity changes',
          'Implement pre-scaling for peak periods',
          'Create seasonal monitoring dashboards'
        ],
        estimatedCost: 2000,
        estimatedSavings: 8000,
        timeline: '3-4 weeks'
      });
    }

    // Over-provisioning recommendations
    const currentUtilization = this.calculateCurrentUtilization();
    if (currentUtilization < 50) {
      recommendations.push({
        id: 'capacity-over-provisioning',
        category: 'capacity-planning',
        priority: 'medium',
        title: 'Address Over-Provisioning',
        description: 'Current capacity utilization is low, indicating over-provisioning',
        expectedImpact: 'Reduce infrastructure costs while maintaining performance',
        implementation: [
          'Right-size infrastructure resources',
          'Implement gradual capacity reduction',
          'Set up utilization-based scaling',
          'Monitor performance during downsizing'
        ],
        estimatedCost: 1000,
        estimatedSavings: 5000,
        timeline: '2-3 weeks'
      });
    }

    return recommendations;
  }

  private calculateCurrentUtilization(): number {
    // Calculate average utilization across key metrics
    const utilizationMetrics = ['cpu-usage', 'memory-usage', 'storage-usage'];
    let totalUtilization = 0;
    let count = 0;
    
    utilizationMetrics.forEach(metric => {
      const data = this.historicalData.get(metric);
      if (data && data.length > 0) {
        const recentData = data.slice(-7); // Last 7 days
        const avgUtilization = recentData.reduce((sum, point) => sum + point.value, 0) / recentData.length;
        totalUtilization += avgUtilization;
        count++;
      }
    });
    
    return count > 0 ? totalUtilization / count : 0;
  }

  public generateCapacityReport(): any {
    const latestData = this.capacityMetrics[this.capacityMetrics.length - 1];
    
    if (!latestData) {
      return {
        timestamp: Date.now(),
        error: 'No capacity planning data available',
        recommendations: []
      };
    }

    const utilizationTrend = this.calculateUtilizationTrend();
    const capacityHealth = this.assessCapacityHealth(latestData);
    
    return {
      timestamp: Date.now(),
      currentStatus: {
        currentCapacity: latestData.currentCapacity,
        projectedGrowth: latestData.projectedGrowth,
        recommendedCapacity: latestData.recommendedCapacity,
        utilizationTrend,
        capacityHealth
      },
      growthAnalysis: {
        growthTrends: latestData.growthTrends,
        highGrowthMetrics: latestData.growthTrends.filter(t => t.growthRate > 15),
        stableMetrics: latestData.growthTrends.filter(t => Math.abs(t.growthRate) < 5),
        decliningMetrics: latestData.growthTrends.filter(t => t.growthRate < -5)
      },
      seasonalAnalysis: {
        seasonalPatterns: latestData.seasonalPatterns,
        seasonalMetrics: latestData.seasonalPatterns.filter(p => p.pattern === 'seasonal').length,
        stableMetrics: latestData.seasonalPatterns.filter(p => p.pattern === 'stable').length
      },
      capacityRecommendations: latestData.capacityRecommendations,
      optimizationRecommendations: this.getOptimizationRecommendations(),
      forecast: {
        '1-month': await this.forecastCapacityNeeds('1-month'),
        '3-months': await this.forecastCapacityNeeds('3-months'),
        '6-months': await this.forecastCapacityNeeds('6-months')
      },
      lastAnalysis: this.lastPlanningRun
    };
  }

  private calculateUtilizationTrend(): { direction: string; percentage: number } {
    const currentUtilization = this.calculateCurrentUtilization();
    
    // Compare with historical average
    const historicalUtilization = this.calculateHistoricalUtilization();
    const change = ((currentUtilization - historicalUtilization) / historicalUtilization) * 100;
    
    let direction = 'stable';
    if (change > 10) direction = 'increasing';
    else if (change < -10) direction = 'decreasing';
    
    return { direction, percentage: Math.abs(change) };
  }

  private calculateHistoricalUtilization(): number {
    // Calculate utilization over the last 30 days
    const utilizationMetrics = ['cpu-usage', 'memory-usage', 'storage-usage'];
    let totalUtilization = 0;
    let count = 0;
    
    utilizationMetrics.forEach(metric => {
      const data = this.historicalData.get(metric);
      if (data && data.length > 30) {
        const historicalData = data.slice(-30, -7); // 30-7 days ago
        const avgUtilization = historicalData.reduce((sum, point) => sum + point.value, 0) / historicalData.length;
        totalUtilization += avgUtilization;
        count++;
      }
    });
    
    return count > 0 ? totalUtilization / count : 0;
  }

  private assessCapacityHealth(data: CapacityPlanningData): string {
    const utilizationRatio = this.calculateCurrentUtilization() / 100;
    const hasHighGrowth = data.growthTrends.some(t => t.growthRate > 25 && t.confidence > 0.7);
    const hasUrgentRecommendations = data.capacityRecommendations.some(r => 
      r.action !== 'maintain' && r.timeline.includes('1-2')
    );
    
    if (utilizationRatio > 0.9 || hasUrgentRecommendations || hasHighGrowth) {
      return 'Critical - Immediate capacity planning needed';
    } else if (utilizationRatio > 0.75 || data.growthTrends.some(t => t.growthRate > 15)) {
      return 'Warning - Monitor capacity closely';
    } else {
      return 'Healthy - Adequate capacity with good planning';
    }
  }

  public cleanup(): void {
    if (this.planningInterval) {
      clearInterval(this.planningInterval);
      this.planningInterval = null;
    }
    
    console.log('📊 Capacity Planning Automation cleaned up');
  }
}
