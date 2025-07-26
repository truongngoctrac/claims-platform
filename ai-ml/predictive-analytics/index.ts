// Main Predictive Analytics Module
export * from './interfaces';

// Core Prediction Services
export { ProcessingTimePredictionService } from './ProcessingTimePrediction';
export { ClaimApprovalScoringService } from './ClaimApprovalScoring';
export { RiskAssessmentService } from './RiskAssessment';

// Import additional services (to be implemented)
import { ProcessingTimePredictionService } from './ProcessingTimePrediction';
import { ClaimApprovalScoringService } from './ClaimApprovalScoring';
import { RiskAssessmentService } from './RiskAssessment';

import {
  PredictiveComponent,
  ComponentStatus,
  ModelPerformance,
  PredictiveModel
} from './interfaces';

export interface PredictiveAnalyticsConfig {
  enableProcessingTimePrediction: boolean;
  enableClaimApprovalScoring: boolean;
  enableRiskAssessment: boolean;
  enableCustomerBehaviorAnalysis: boolean;
  enableDemandForecasting: boolean;
  enableAnomalyDetection: boolean;
  enableChurnPrediction: boolean;
  enableResourceOptimization: boolean;
  enablePerformancePrediction: boolean;
  enableModelLifecycleManagement: boolean;
  modelUpdateFrequency: number; // days
  cachingEnabled: boolean;
  batchProcessingEnabled: boolean;
  realTimeProcessingEnabled: boolean;
}

export class PredictiveAnalyticsEngine {
  private config: PredictiveAnalyticsConfig;
  private services: Map<string, PredictiveComponent> = new Map();
  private isInitialized: boolean = false;

  // Core Services
  private processingTimePrediction?: ProcessingTimePredictionService;
  private claimApprovalScoring?: ClaimApprovalScoringService;
  private riskAssessment?: RiskAssessmentService;

  constructor(config: PredictiveAnalyticsConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    console.log('Initializing Predictive Analytics Engine...');

    try {
      // Initialize enabled services
      if (this.config.enableProcessingTimePrediction) {
        this.processingTimePrediction = new ProcessingTimePredictionService();
        await this.processingTimePrediction.initialize();
        this.services.set('processing_time_prediction', this.processingTimePrediction);
        console.log('✓ Processing Time Prediction service initialized');
      }

      if (this.config.enableClaimApprovalScoring) {
        this.claimApprovalScoring = new ClaimApprovalScoringService();
        await this.claimApprovalScoring.initialize();
        this.services.set('claim_approval_scoring', this.claimApprovalScoring);
        console.log('✓ Claim Approval Scoring service initialized');
      }

      if (this.config.enableRiskAssessment) {
        this.riskAssessment = new RiskAssessmentService();
        await this.riskAssessment.initialize();
        this.services.set('risk_assessment', this.riskAssessment);
        console.log('✓ Risk Assessment service initialized');
      }

      // TODO: Initialize other services when implemented
      if (this.config.enableCustomerBehaviorAnalysis) {
        console.log('⚠ Customer Behavior Analysis service not yet implemented');
      }

      if (this.config.enableDemandForecasting) {
        console.log('⚠ Demand Forecasting service not yet implemented');
      }

      if (this.config.enableAnomalyDetection) {
        console.log('⚠ Anomaly Detection service not yet implemented');
      }

      if (this.config.enableChurnPrediction) {
        console.log('⚠ Churn Prediction service not yet implemented');
      }

      if (this.config.enableResourceOptimization) {
        console.log('⚠ Resource Optimization service not yet implemented');
      }

      if (this.config.enablePerformancePrediction) {
        console.log('⚠ Performance Prediction service not yet implemented');
      }

      if (this.config.enableModelLifecycleManagement) {
        console.log('⚠ Model Lifecycle Management service not yet implemented');
      }

      this.isInitialized = true;
      console.log('✓ Predictive Analytics Engine fully initialized');

    } catch (error) {
      console.error('Failed to initialize Predictive Analytics Engine:', error);
      throw error;
    }
  }

  // Service Getters
  getProcessingTimePrediction(): ProcessingTimePredictionService | undefined {
    return this.processingTimePrediction;
  }

  getClaimApprovalScoring(): ClaimApprovalScoringService | undefined {
    return this.claimApprovalScoring;
  }

  getRiskAssessment(): RiskAssessmentService | undefined {
    return this.riskAssessment;
  }

  // Generic service access
  getService(serviceName: string): PredictiveComponent | undefined {
    return this.services.get(serviceName);
  }

  // Engine Status and Health
  getEngineStatus(): EngineStatus {
    const serviceStatuses = new Map<string, ComponentStatus>();
    
    for (const [name, service] of this.services) {
      serviceStatuses.set(name, service.getStatus());
    }

    return {
      isInitialized: this.isInitialized,
      totalServices: this.services.size,
      healthyServices: Array.from(serviceStatuses.values()).filter(s => s.isReady).length,
      serviceStatuses: Object.fromEntries(serviceStatuses),
      lastHealthCheck: new Date()
    };
  }

  getEngineMetrics(): EngineMetrics {
    const serviceMetrics = new Map<string, ModelPerformance>();
    
    for (const [name, service] of this.services) {
      serviceMetrics.set(name, service.getMetrics());
    }

    const totalPredictions = Array.from(this.services.values())
      .reduce((sum, service) => sum + service.getStatus().totalPredictions, 0);

    const averageAccuracy = Array.from(serviceMetrics.values())
      .reduce((sum, metrics) => sum + metrics.accuracy, 0) / serviceMetrics.size;

    return {
      totalPredictions,
      averageAccuracy,
      serviceMetrics: Object.fromEntries(serviceMetrics),
      lastMetricsUpdate: new Date()
    };
  }

  // Batch Processing
  async processBatch(requests: BatchPredictionRequest[]): Promise<BatchPredictionResponse[]> {
    if (!this.config.batchProcessingEnabled) {
      throw new Error('Batch processing is not enabled');
    }

    const responses: BatchPredictionResponse[] = [];

    for (const request of requests) {
      try {
        const service = this.services.get(request.serviceType);
        if (!service) {
          responses.push({
            requestId: request.requestId,
            success: false,
            error: `Service ${request.serviceType} not available`,
            timestamp: new Date()
          });
          continue;
        }

        const result = await service.predict(request.input, request.options);
        responses.push({
          requestId: request.requestId,
          success: true,
          result,
          timestamp: new Date()
        });

      } catch (error) {
        responses.push({
          requestId: request.requestId,
          success: false,
          error: error.message,
          timestamp: new Date()
        });
      }
    }

    return responses;
  }

  // Health Check
  async performHealthCheck(): Promise<HealthCheckResult> {
    const results: ServiceHealthCheck[] = [];

    for (const [name, service] of this.services) {
      const status = service.getStatus();
      const metrics = service.getMetrics();

      results.push({
        serviceName: name,
        healthy: status.isReady && !status.lastError,
        status,
        metrics,
        lastCheck: new Date()
      });
    }

    const overallHealthy = results.every(r => r.healthy);

    return {
      overallHealthy,
      serviceResults: results,
      timestamp: new Date()
    };
  }

  // Configuration Management
  updateConfig(newConfig: Partial<PredictiveAnalyticsConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): PredictiveAnalyticsConfig {
    return { ...this.config };
  }

  // Shutdown
  async shutdown(): Promise<void> {
    console.log('Shutting down Predictive Analytics Engine...');
    
    // Cleanup services
    this.services.clear();
    this.isInitialized = false;
    
    console.log('✓ Predictive Analytics Engine shutdown complete');
  }
}

// Additional interfaces
export interface EngineStatus {
  isInitialized: boolean;
  totalServices: number;
  healthyServices: number;
  serviceStatuses: Record<string, ComponentStatus>;
  lastHealthCheck: Date;
}

export interface EngineMetrics {
  totalPredictions: number;
  averageAccuracy: number;
  serviceMetrics: Record<string, ModelPerformance>;
  lastMetricsUpdate: Date;
}

export interface BatchPredictionRequest {
  requestId: string;
  serviceType: string;
  input: any;
  options?: any;
}

export interface BatchPredictionResponse {
  requestId: string;
  success: boolean;
  result?: any;
  error?: string;
  timestamp: Date;
}

export interface ServiceHealthCheck {
  serviceName: string;
  healthy: boolean;
  status: ComponentStatus;
  metrics: ModelPerformance;
  lastCheck: Date;
}

export interface HealthCheckResult {
  overallHealthy: boolean;
  serviceResults: ServiceHealthCheck[];
  timestamp: Date;
}

// Default Configuration
export const DEFAULT_PREDICTIVE_ANALYTICS_CONFIG: PredictiveAnalyticsConfig = {
  enableProcessingTimePrediction: true,
  enableClaimApprovalScoring: true,
  enableRiskAssessment: true,
  enableCustomerBehaviorAnalysis: false, // Not yet implemented
  enableDemandForecasting: false, // Not yet implemented
  enableAnomalyDetection: false, // Not yet implemented
  enableChurnPrediction: false, // Not yet implemented
  enableResourceOptimization: false, // Not yet implemented
  enablePerformancePrediction: false, // Not yet implemented
  enableModelLifecycleManagement: false, // Not yet implemented
  modelUpdateFrequency: 90, // 90 days
  cachingEnabled: true,
  batchProcessingEnabled: true,
  realTimeProcessingEnabled: true
};

// Factory function
export function createPredictiveAnalyticsEngine(
  config?: Partial<PredictiveAnalyticsConfig>
): PredictiveAnalyticsEngine {
  const finalConfig = { ...DEFAULT_PREDICTIVE_ANALYTICS_CONFIG, ...config };
  return new PredictiveAnalyticsEngine(finalConfig);
}
