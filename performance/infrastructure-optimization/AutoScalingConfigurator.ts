/**
 * Auto Scaling Configurator
 * Configures and optimizes auto-scaling policies for healthcare applications
 */

import { 
  AutoScalingMetrics, 
  ScalingEvent,
  InfrastructureOptimizationConfig, 
  OptimizationRecommendation 
} from './types';

export class AutoScalingConfigurator {
  private config: InfrastructureOptimizationConfig['autoScaling'];
  private metrics: AutoScalingMetrics[] = [];
  private scalingEvents: ScalingEvent[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private cooldownTimer: NodeJS.Timeout | null = null;
  private inCooldown: boolean = false;

  constructor(config: InfrastructureOptimizationConfig['autoScaling']) {
    this.config = config;
  }

  public async initialize(): Promise<void> {
    console.log('📈 Initializing Auto Scaling Configurator...');
    await this.validateConfiguration();
    await this.setupScalingPolicies();
    this.startMonitoring();
  }

  private async validateConfiguration(): Promise<void> {
    console.log('✅ Validating auto-scaling configuration...');
    
    // Validate configuration parameters
    if (this.config.minInstances >= this.config.maxInstances) {
      throw new Error('Min instances must be less than max instances');
    }
    
    if (this.config.scaleUpThreshold <= this.config.scaleDownThreshold) {
      throw new Error('Scale up threshold must be greater than scale down threshold');
    }
    
    if (this.config.cooldownPeriod < 60000) {
      console.warn('⚠️ Cooldown period is less than 60 seconds, which may cause rapid scaling');
    }
  }

  private async setupScalingPolicies(): Promise<void> {
    console.log('⚙️ Setting up scaling policies...');
    
    // Configure scale-up policy
    await this.configureScaleUpPolicy();
    
    // Configure scale-down policy
    await this.configureScaleDownPolicy();
    
    // Configure alarm-based scaling
    await this.configureAlarmBasedScaling();
    
    // Configure predictive scaling
    await this.configurePredictiveScaling();
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      await this.collectMetrics();
      await this.evaluateScalingConditions();
      await this.optimizeScalingPolicies();
    }, 30000); // Monitor every 30 seconds
  }

  private async collectMetrics(): Promise<AutoScalingMetrics> {
    const metrics: AutoScalingMetrics = {
      currentCapacity: await this.getCurrentCapacity(),
      desiredCapacity: await this.getDesiredCapacity(),
      minCapacity: this.config.minInstances,
      maxCapacity: this.config.maxInstances,
      scalingEvents: [...this.scalingEvents],
      cooldownPeriod: this.config.cooldownPeriod,
      utilizationTarget: this.config.scaleUpThreshold
    };

    this.metrics.push(metrics);
    this.trimMetricsHistory();
    
    return metrics;
  }

  private async getCurrentCapacity(): Promise<number> {
    // Simulate current instance count
    return Math.floor(Math.random() * (this.config.maxInstances - this.config.minInstances)) + this.config.minInstances;
  }

  private async getDesiredCapacity(): Promise<number> {
    // Simulate desired capacity calculation based on current load
    const currentUtilization = await this.getCurrentUtilization();
    const currentCapacity = await this.getCurrentCapacity();
    
    if (currentUtilization > this.config.scaleUpThreshold) {
      return Math.min(currentCapacity + 1, this.config.maxInstances);
    } else if (currentUtilization < this.config.scaleDownThreshold) {
      return Math.max(currentCapacity - 1, this.config.minInstances);
    }
    
    return currentCapacity;
  }

  private async getCurrentUtilization(): Promise<number> {
    // Simulate current resource utilization
    return Math.random() * 100;
  }

  private trimMetricsHistory(): void {
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }
    
    // Keep only recent scaling events (last 24 hours)
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    this.scalingEvents = this.scalingEvents.filter(event => event.timestamp > oneDayAgo);
  }

  private async evaluateScalingConditions(): Promise<void> {
    if (this.inCooldown) {
      console.log('⏳ Auto-scaling in cooldown period, skipping evaluation');
      return;
    }

    const currentUtilization = await this.getCurrentUtilization();
    const currentCapacity = await this.getCurrentCapacity();
    
    // Evaluate scale-up conditions
    if (currentUtilization > this.config.scaleUpThreshold && currentCapacity < this.config.maxInstances) {
      await this.scaleUp('high-utilization');
    }
    
    // Evaluate scale-down conditions
    else if (currentUtilization < this.config.scaleDownThreshold && currentCapacity > this.config.minInstances) {
      await this.scaleDown('low-utilization');
    }
    
    // Evaluate custom metric-based scaling
    await this.evaluateCustomMetrics();
    
    // Evaluate predictive scaling
    await this.evaluatePredictiveScaling();
  }

  private async scaleUp(reason: string): Promise<void> {
    const currentCapacity = await this.getCurrentCapacity();
    const newCapacity = Math.min(currentCapacity + this.calculateScaleUpAmount(), this.config.maxInstances);
    
    if (newCapacity > currentCapacity) {
      console.log(`📈 Scaling up: ${currentCapacity} → ${newCapacity} (${reason})`);
      
      await this.executeScaling(newCapacity);
      
      this.recordScalingEvent({
        timestamp: Date.now(),
        action: 'scale-up',
        reason,
        oldCapacity: currentCapacity,
        newCapacity,
        triggeredBy: 'auto-scaling'
      });
      
      this.startCooldown();
    }
  }

  private async scaleDown(reason: string): Promise<void> {
    const currentCapacity = await this.getCurrentCapacity();
    const newCapacity = Math.max(currentCapacity - this.calculateScaleDownAmount(), this.config.minInstances);
    
    if (newCapacity < currentCapacity) {
      console.log(`📉 Scaling down: ${currentCapacity} → ${newCapacity} (${reason})`);
      
      await this.executeScaling(newCapacity);
      
      this.recordScalingEvent({
        timestamp: Date.now(),
        action: 'scale-down',
        reason,
        oldCapacity: currentCapacity,
        newCapacity,
        triggeredBy: 'auto-scaling'
      });
      
      this.startCooldown();
    }
  }

  private calculateScaleUpAmount(): number {
    // Calculate how many instances to add based on current load and configuration
    const recentEvents = this.getRecentScalingEvents(5 * 60 * 1000); // Last 5 minutes
    const recentScaleUpEvents = recentEvents.filter(e => e.action === 'scale-up');
    
    // If we've been scaling up frequently, scale more aggressively
    if (recentScaleUpEvents.length > 1) {
      return Math.min(3, Math.ceil(this.config.maxInstances * 0.2)); // Up to 20% or 3 instances
    }
    
    return 1; // Default: add 1 instance
  }

  private calculateScaleDownAmount(): number {
    // Calculate how many instances to remove based on current load
    const currentUtilization = 50; // This would come from actual metrics
    
    // Scale down more aggressively if utilization is very low
    if (currentUtilization < this.config.scaleDownThreshold * 0.5) {
      return 2;
    }
    
    return 1; // Default: remove 1 instance
  }

  private async executeScaling(targetCapacity: number): Promise<void> {
    console.log(`🎯 Executing scaling to ${targetCapacity} instances`);
    // Implementation would interact with cloud provider APIs to scale instances
    
    // Simulate scaling time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log(`✅ Scaling completed to ${targetCapacity} instances`);
  }

  private recordScalingEvent(event: ScalingEvent): void {
    this.scalingEvents.push(event);
    console.log(`📝 Recorded scaling event: ${event.action} (${event.reason})`);
  }

  private startCooldown(): void {
    this.inCooldown = true;
    console.log(`⏰ Starting cooldown period (${this.config.cooldownPeriod}ms)`);
    
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
    }
    
    this.cooldownTimer = setTimeout(() => {
      this.inCooldown = false;
      console.log('✅ Cooldown period ended');
    }, this.config.cooldownPeriod);
  }

  private getRecentScalingEvents(timeWindow: number): ScalingEvent[] {
    const cutoff = Date.now() - timeWindow;
    return this.scalingEvents.filter(event => event.timestamp > cutoff);
  }

  private async evaluateCustomMetrics(): Promise<void> {
    // Evaluate custom metrics for scaling decisions
    for (const metric of this.config.scalingMetrics) {
      const value = await this.getCustomMetricValue(metric);
      await this.evaluateCustomMetric(metric, value);
    }
  }

  private async getCustomMetricValue(metric: string): Promise<number> {
    // Simulate custom metric collection
    switch (metric) {
      case 'response-time':
        return Math.random() * 1000; // 0-1000ms
      case 'queue-length':
        return Math.floor(Math.random() * 100); // 0-100 items
      case 'active-connections':
        return Math.floor(Math.random() * 1000); // 0-1000 connections
      case 'memory-usage':
        return Math.random() * 100; // 0-100%
      default:
        return Math.random() * 100;
    }
  }

  private async evaluateCustomMetric(metric: string, value: number): Promise<void> {
    // Define thresholds for custom metrics
    const thresholds = {
      'response-time': { scaleUp: 800, scaleDown: 200 },
      'queue-length': { scaleUp: 50, scaleDown: 10 },
      'active-connections': { scaleUp: 800, scaleDown: 200 },
      'memory-usage': { scaleUp: 85, scaleDown: 40 }
    };

    const threshold = thresholds[metric as keyof typeof thresholds];
    if (!threshold) return;

    if (value > threshold.scaleUp) {
      await this.scaleUp(`high-${metric}`);
    } else if (value < threshold.scaleDown) {
      await this.scaleDown(`low-${metric}`);
    }
  }

  private async evaluatePredictiveScaling(): Promise<void> {
    // Implement predictive scaling based on historical patterns
    const prediction = await this.predictFutureLoad();
    
    if (prediction.confidence > 0.8) {
      if (prediction.expectedLoad > this.config.scaleUpThreshold) {
        console.log('🔮 Predictive scaling: preparing for expected load increase');
        await this.scaleUp('predictive-scaling');
      }
    }
  }

  private async predictFutureLoad(): Promise<{ expectedLoad: number; confidence: number }> {
    // Simulate load prediction based on historical data
    // In real implementation, this would use ML models or time series analysis
    
    const recentMetrics = this.metrics.slice(-10);
    if (recentMetrics.length === 0) {
      return { expectedLoad: 50, confidence: 0 };
    }

    // Simple trend analysis
    const utilizationTrend = this.calculateTrend(recentMetrics.map(m => m.utilizationTarget));
    const expectedLoad = Math.max(0, Math.min(100, utilizationTrend.slope * 5 + utilizationTrend.current));
    
    return {
      expectedLoad,
      confidence: Math.min(0.9, utilizationTrend.correlation)
    };
  }

  private calculateTrend(values: number[]): { slope: number; current: number; correlation: number } {
    if (values.length < 2) {
      return { slope: 0, current: values[0] || 50, correlation: 0 };
    }

    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
    const sumXX = x.reduce((a, b) => a + b * b, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const correlation = Math.abs(slope) / (Math.max(...y) - Math.min(...y) + 1);

    return {
      slope,
      current: y[y.length - 1],
      correlation: Math.min(1, correlation)
    };
  }

  private async configureScaleUpPolicy(): Promise<void> {
    console.log('📈 Configuring scale-up policy...');
    // Implementation would configure cloud provider scale-up policies
  }

  private async configureScaleDownPolicy(): Promise<void> {
    console.log('📉 Configuring scale-down policy...');
    // Implementation would configure cloud provider scale-down policies
  }

  private async configureAlarmBasedScaling(): Promise<void> {
    console.log('🚨 Configuring alarm-based scaling...');
    // Implementation would set up CloudWatch alarms or similar
  }

  private async configurePredictiveScaling(): Promise<void> {
    console.log('🔮 Configuring predictive scaling...');
    // Implementation would set up predictive scaling policies
  }

  private async optimizeScalingPolicies(): Promise<void> {
    // Analyze scaling performance and optimize policies
    const recentEvents = this.getRecentScalingEvents(60 * 60 * 1000); // Last hour
    
    if (recentEvents.length > 10) {
      console.warn('⚠️ High scaling frequency detected, reviewing policies...');
      await this.adjustScalingThresholds();
    }
    
    await this.analyzeScalingEffectiveness();
  }

  private async adjustScalingThresholds(): Promise<void> {
    console.log('🎛️ Adjusting scaling thresholds...');
    
    // Analyze recent scaling events to optimize thresholds
    const scaleUpEvents = this.scalingEvents.filter(e => e.action === 'scale-up');
    const scaleDownEvents = this.scalingEvents.filter(e => e.action === 'scale-down');
    
    // If too many rapid scale-up/down cycles, increase thresholds gap
    if (scaleUpEvents.length > 5 && scaleDownEvents.length > 5) {
      console.log('📊 Detected rapid scaling cycles, increasing threshold gap');
      // Implementation would adjust thresholds
    }
  }

  private async analyzeScalingEffectiveness(): Promise<void> {
    // Analyze how effective recent scaling actions were
    const recentEvents = this.getRecentScalingEvents(30 * 60 * 1000); // Last 30 minutes
    
    for (const event of recentEvents) {
      const effectiveness = await this.calculateScalingEffectiveness(event);
      
      if (effectiveness < 0.5) {
        console.warn(`⚠️ Low effectiveness for scaling event: ${event.action} (${effectiveness.toFixed(2)})`);
      }
    }
  }

  private async calculateScalingEffectiveness(event: ScalingEvent): Promise<number> {
    // Calculate how effective a scaling action was
    // This would typically involve analyzing metrics before and after scaling
    
    // Simulate effectiveness calculation
    return Math.random() * 0.5 + 0.5; // 0.5-1.0 effectiveness
  }

  public getOptimizationRecommendations(): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];
    
    if (this.metrics.length === 0) return recommendations;

    const recentEvents = this.getRecentScalingEvents(24 * 60 * 60 * 1000); // Last 24 hours
    const scaleUpEvents = recentEvents.filter(e => e.action === 'scale-up');
    const scaleDownEvents = recentEvents.filter(e => e.action === 'scale-down');

    // Frequent scaling recommendations
    if (recentEvents.length > 20) {
      recommendations.push({
        id: 'autoscaling-frequent',
        category: 'auto-scaling',
        priority: 'high',
        title: 'Frequent Auto-Scaling Events',
        description: 'Too many scaling events may indicate inefficient configuration',
        expectedImpact: 'Reduce scaling frequency and improve stability',
        implementation: [
          'Increase cooldown period',
          'Adjust scaling thresholds',
          'Implement predictive scaling',
          'Review custom metrics'
        ],
        estimatedCost: 500,
        estimatedSavings: 2000,
        timeline: '1 week'
      });
    }

    // Ineffective scaling recommendations
    const avgCapacity = this.calculateAverageCapacity();
    if (avgCapacity < this.config.minInstances * 1.2) {
      recommendations.push({
        id: 'autoscaling-underutilized',
        category: 'auto-scaling',
        priority: 'medium',
        title: 'Auto-Scaling Underutilization',
        description: 'Capacity often near minimum, consider adjusting baseline',
        expectedImpact: 'Optimize baseline capacity and cost efficiency',
        implementation: [
          'Reduce minimum instance count',
          'Adjust scale-down thresholds',
          'Implement scheduled scaling',
          'Review capacity planning'
        ],
        estimatedCost: 200,
        estimatedSavings: 1500,
        timeline: '3-5 days'
      });
    }

    // Predictive scaling recommendations
    if (scaleUpEvents.length > 5 && !this.isPredictiveScalingEnabled()) {
      recommendations.push({
        id: 'autoscaling-predictive',
        category: 'auto-scaling',
        priority: 'medium',
        title: 'Enable Predictive Scaling',
        description: 'Frequent scale-up events suggest predictive scaling would help',
        expectedImpact: 'Proactive scaling for better performance',
        implementation: [
          'Enable predictive scaling',
          'Configure machine learning models',
          'Set up historical data analysis',
          'Implement scheduled scaling for known patterns'
        ],
        estimatedCost: 1000,
        estimatedSavings: 3000,
        timeline: '2-3 weeks'
      });
    }

    return recommendations;
  }

  private calculateAverageCapacity(): number {
    if (this.metrics.length === 0) return this.config.minInstances;
    
    const sum = this.metrics.reduce((acc, metric) => acc + metric.currentCapacity, 0);
    return sum / this.metrics.length;
  }

  private isPredictiveScalingEnabled(): boolean {
    // Check if predictive scaling is already enabled
    return this.config.scalingMetrics.includes('predictive');
  }

  public generateAutoScalingReport(): any {
    const recentEvents = this.getRecentScalingEvents(24 * 60 * 60 * 1000);
    
    return {
      timestamp: Date.now(),
      currentMetrics: this.metrics[this.metrics.length - 1] || null,
      configuration: {
        minInstances: this.config.minInstances,
        maxInstances: this.config.maxInstances,
        scaleUpThreshold: this.config.scaleUpThreshold,
        scaleDownThreshold: this.config.scaleDownThreshold,
        cooldownPeriod: this.config.cooldownPeriod,
        scalingMetrics: this.config.scalingMetrics
      },
      scalingActivity: {
        last24Hours: recentEvents.length,
        scaleUpEvents: recentEvents.filter(e => e.action === 'scale-up').length,
        scaleDownEvents: recentEvents.filter(e => e.action === 'scale-down').length,
        recentEvents: recentEvents.slice(-10)
      },
      performance: {
        averageCapacity: this.calculateAverageCapacity(),
        capacityUtilization: this.calculateCapacityUtilization(),
        scalingEfficiency: this.calculateScalingEfficiency()
      },
      recommendations: this.getOptimizationRecommendations(),
      autoScalingHealth: this.getAutoScalingHealthStatus()
    };
  }

  private calculateCapacityUtilization(): number {
    const avgCapacity = this.calculateAverageCapacity();
    const maxCapacity = this.config.maxInstances;
    return (avgCapacity / maxCapacity) * 100;
  }

  private calculateScalingEfficiency(): number {
    // Calculate how efficiently auto-scaling is working
    const recentEvents = this.getRecentScalingEvents(24 * 60 * 60 * 1000);
    
    if (recentEvents.length === 0) return 100;
    
    // Penalize frequent scaling events
    const scalingFrequencyPenalty = Math.max(0, 100 - (recentEvents.length * 2));
    
    return Math.max(0, scalingFrequencyPenalty);
  }

  private getAutoScalingHealthStatus(): string {
    const recentEvents = this.getRecentScalingEvents(60 * 60 * 1000); // Last hour
    const scalingEfficiency = this.calculateScalingEfficiency();
    
    if (recentEvents.length > 10 || scalingEfficiency < 50) {
      return 'Critical';
    } else if (recentEvents.length > 5 || scalingEfficiency < 75) {
      return 'Warning';
    } else {
      return 'Healthy';
    }
  }

  public cleanup(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
      this.cooldownTimer = null;
    }
    
    console.log('📈 Auto Scaling Configurator cleaned up');
  }
}
