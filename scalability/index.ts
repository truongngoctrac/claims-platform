/**
 * Scalability Management System
 * Healthcare Claims Processing - Horizontal Scaling Implementation
 */

export * from './horizontal-scaling';
export * from './types';

// Main scalability manager
import { HorizontalScalingManager } from './horizontal-scaling';
import { ScalabilityConfig } from './types';

export class ScalabilityManager {
  private horizontalScalingManager: HorizontalScalingManager;

  constructor(private config: ScalabilityConfig) {
    this.horizontalScalingManager = new HorizontalScalingManager(config.horizontalScaling);
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Scalability Management System');
    await this.horizontalScalingManager.initialize();
    console.log('✅ Scalability Management System initialized');
  }

  async scaleUp(serviceName: string, replicas: number): Promise<void> {
    return this.horizontalScalingManager.scaleService(serviceName, replicas);
  }

  async scaleDown(serviceName: string, replicas: number): Promise<void> {
    return this.horizontalScalingManager.scaleService(serviceName, replicas);
  }

  async getScalingMetrics(): Promise<any> {
    return this.horizontalScalingManager.getMetrics();
  }

  async performHealthCheck(): Promise<boolean> {
    return this.horizontalScalingManager.performHealthCheck();
  }
}
