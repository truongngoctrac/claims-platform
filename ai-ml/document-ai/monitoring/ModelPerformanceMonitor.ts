import { EventEmitter } from 'events';
import { AIComponent, ComponentStatus, PerformanceMetrics, DocumentProcessingResult, ModelMonitoringData, ModelAlert, DriftMetrics, PredictionDistribution } from '../models/interfaces';

export class ModelPerformanceMonitor extends EventEmitter implements AIComponent {
  private status: ComponentStatus = {
    isReady: false,
    isProcessing: false,
    uptime: 0,
    totalProcessed: 0
  };

  private monitoringData: ModelMonitoringData[] = [];
  private alerts: ModelAlert[] = [];

  async initialize(): Promise<void> {
    this.status.isReady = true;
    this.emit('initialization_completed');
  }

  async process(input: any): Promise<any> {
    // This component doesn't have a standard process method
    throw new Error('Use recordProcessing() method instead');
  }

  async recordProcessing(result: DocumentProcessingResult): Promise<void> {
    const monitoringRecord: ModelMonitoringData = {
      modelId: 'document_ai_ensemble',
      timestamp: new Date(),
      performanceMetrics: result.metadata.performanceMetrics,
      predictionDistribution: this.calculatePredictionDistribution(result),
      driftMetrics: this.calculateDriftMetrics(result),
      alerts: []
    };

    this.monitoringData.push(monitoringRecord);
    
    // Keep only last 1000 records
    if (this.monitoringData.length > 1000) {
      this.monitoringData.shift();
    }

    // Check for performance degradation
    await this.checkPerformanceAlerts(monitoringRecord);

    this.status.totalProcessed++;
  }

  async collectMetrics(): Promise<void> {
    if (this.monitoringData.length === 0) return;

    const recentData = this.monitoringData.slice(-10); // Last 10 records
    const avgAccuracy = recentData.reduce((sum, data) => sum + data.performanceMetrics.accuracy, 0) / recentData.length;
    const avgProcessingTime = recentData.reduce((sum, data) => sum + data.performanceMetrics.inferenceTime, 0) / recentData.length;

    // Check for accuracy degradation
    if (avgAccuracy < 0.8) {
      this.createAlert('ACCURACY_DROP', 'high', `Average accuracy dropped to ${avgAccuracy.toFixed(2)}`);
    }

    // Check for performance degradation
    if (avgProcessingTime > 5000) {
      this.createAlert('PERFORMANCE_DEGRADATION', 'medium', `Average processing time increased to ${avgProcessingTime}ms`);
    }

    this.emit('metrics_collected', {
      avgAccuracy,
      avgProcessingTime,
      alertCount: this.alerts.length
    });
  }

  private calculatePredictionDistribution(result: DocumentProcessingResult): PredictionDistribution {
    return {
      totalPredictions: 1,
      confidenceDistribution: [
        { range: [0.8, 1.0], count: 1, percentage: 100 }
      ],
      classDistribution: [
        { className: result.results.classification?.primaryClass || 'unknown', count: 1, percentage: 100 }
      ]
    };
  }

  private calculateDriftMetrics(result: DocumentProcessingResult): DriftMetrics {
    // Mock drift calculation
    return {
      dataDrift: 0.05,
      modelDrift: 0.03,
      conceptDrift: 0.02,
      driftDetected: false
    };
  }

  private async checkPerformanceAlerts(data: ModelMonitoringData): Promise<void> {
    // Check for various alert conditions
    if (data.performanceMetrics.accuracy < 0.7) {
      this.createAlert('ACCURACY_DROP', 'critical', 'Model accuracy dropped below 70%');
    }

    if (data.performanceMetrics.inferenceTime > 10000) {
      this.createAlert('HIGH_LATENCY', 'high', 'Processing time exceeded 10 seconds');
    }

    if (data.driftMetrics.driftDetected) {
      this.createAlert('DATA_DRIFT', 'medium', 'Data drift detected in model inputs');
    }
  }

  private createAlert(type: string, severity: 'low' | 'medium' | 'high' | 'critical', message: string): void {
    const alert: ModelAlert = {
      alertId: `alert_${Date.now()}`,
      type: type as any,
      severity,
      message,
      timestamp: new Date(),
      acknowledged: false
    };

    this.alerts.push(alert);
    
    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }

    this.emit('alert_created', alert);
  }

  getStatus(): ComponentStatus {
    return { ...this.status };
  }

  getMetrics(): PerformanceMetrics {
    return {
      inferenceTime: 25,
      memoryUsage: 64,
      cpuUsage: 5,
      accuracy: 1.0, // Monitoring accuracy
      precision: 1.0,
      recall: 1.0,
      f1Score: 1.0
    };
  }

  getMonitoringData(): ModelMonitoringData[] {
    return [...this.monitoringData];
  }

  getAlerts(): ModelAlert[] {
    return [...this.alerts];
  }

  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.alertId === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.emit('alert_acknowledged', { alertId });
    }
  }

  getPerformanceSummary(): any {
    if (this.monitoringData.length === 0) {
      return {
        totalRecords: 0,
        avgAccuracy: 0,
        avgProcessingTime: 0,
        alertCount: 0
      };
    }

    const avgAccuracy = this.monitoringData.reduce((sum, data) => sum + data.performanceMetrics.accuracy, 0) / this.monitoringData.length;
    const avgProcessingTime = this.monitoringData.reduce((sum, data) => sum + data.performanceMetrics.inferenceTime, 0) / this.monitoringData.length;

    return {
      totalRecords: this.monitoringData.length,
      avgAccuracy,
      avgProcessingTime,
      alertCount: this.alerts.filter(a => !a.acknowledged).length,
      lastUpdated: this.monitoringData[this.monitoringData.length - 1]?.timestamp
    };
  }
}
