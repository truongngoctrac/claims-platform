/**
 * Predictive Scaling Algorithms
 * Healthcare Claims Processing System
 */

export interface TimeSeriesData {
  timestamp: Date;
  value: number;
  metadata?: { [key: string]: any };
}

export interface PredictionModel {
  name: string;
  type: 'linear' | 'polynomial' | 'exponential' | 'seasonal' | 'neural';
  accuracy: number;
  lastTrained: Date;
  parameters: { [key: string]: any };
}

export interface ScalingPrediction {
  timestamp: Date;
  predictedValue: number;
  confidence: number;
  model: string;
  timeHorizon: number;
  recommendedAction: 'scale-up' | 'scale-down' | 'maintain' | 'prepare-scale';
  recommendedReplicas: number;
}

export interface PredictiveScalingConfig {
  models: string[];
  trainingWindow: number;
  predictionHorizon: number;
  retrainInterval: number;
  confidenceThreshold: number;
  seasonalPatterns: boolean;
  businessHours: { start: number; end: number };
  peakDays: number[];
}

export interface HealthcarePattern {
  type: 'daily' | 'weekly' | 'monthly' | 'seasonal' | 'emergency';
  pattern: number[];
  confidence: number;
  description: string;
}

export class PredictiveScaling {
  private models: Map<string, PredictionModel> = new Map();
  private historicalData: Map<string, TimeSeriesData[]> = new Map();
  private patterns: Map<string, HealthcarePattern> = new Map();
  private config: PredictiveScalingConfig;

  constructor(config: PredictiveScalingConfig) {
    this.config = config;
    this.initializeHealthcarePatterns();
  }

  /**
   * Initialize healthcare-specific patterns
   */
  private initializeHealthcarePatterns(): void {
    // Daily pattern - higher claims during business hours
    this.patterns.set('daily_business_hours', {
      type: 'daily',
      pattern: [
        0.2, 0.1, 0.1, 0.1, 0.1, 0.2, 0.4, 0.6, // 0-7 AM
        0.8, 1.0, 1.0, 0.9, 0.7, 0.8, 0.9, 1.0, // 8-15 PM
        0.8, 0.6, 0.4, 0.3, 0.2, 0.2, 0.2, 0.1  // 16-23 PM
      ],
      confidence: 0.85,
      description: 'Business hours claim submission pattern'
    });

    // Weekly pattern - lower activity on weekends
    this.patterns.set('weekly_pattern', {
      type: 'weekly',
      pattern: [0.6, 1.0, 1.0, 1.0, 1.0, 1.0, 0.3], // Mon-Sun
      confidence: 0.75,
      description: 'Weekly business day pattern'
    });

    // Monthly pattern - higher activity at month end
    this.patterns.set('monthly_billing', {
      type: 'monthly',
      pattern: Array.from({ length: 31 }, (_, i) => {
        const day = i + 1;
        if (day <= 5 || day >= 28) return 1.2; // Higher at start/end of month
        if (day >= 10 && day <= 20) return 0.8; // Lower mid-month
        return 1.0;
      }),
      confidence: 0.65,
      description: 'Monthly billing cycle pattern'
    });

    // Emergency pattern - sudden spikes during health emergencies
    this.patterns.set('emergency_surge', {
      type: 'emergency',
      pattern: [1.0, 2.5, 4.0, 3.0, 2.0, 1.5, 1.2], // Spike and gradual decline
      confidence: 0.90,
      description: 'Emergency health event surge pattern'
    });
  }

  /**
   * Add historical data point
   */
  addDataPoint(metric: string, data: TimeSeriesData): void {
    if (!this.historicalData.has(metric)) {
      this.historicalData.set(metric, []);
    }
    
    const series = this.historicalData.get(metric)!;
    series.push(data);
    
    // Keep only data within training window
    const cutoff = new Date(Date.now() - this.config.trainingWindow);
    const filteredData = series.filter(d => d.timestamp > cutoff);
    this.historicalData.set(metric, filteredData);
  }

  /**
   * Train prediction models
   */
  async trainModels(metric: string): Promise<void> {
    console.log(`🧠 Training predictive models for metric: ${metric}`);
    
    const data = this.historicalData.get(metric) || [];
    if (data.length < 10) {
      console.log('⚠️ Insufficient data for training');
      return;
    }

    // Train multiple models
    await Promise.all([
      this.trainLinearModel(metric, data),
      this.trainSeasonalModel(metric, data),
      this.trainHealthcarePatternModel(metric, data),
      this.trainNeuralNetworkModel(metric, data)
    ]);

    console.log(`✅ Models trained for ${metric}`);
  }

  /**
   * Train linear regression model
   */
  private async trainLinearModel(metric: string, data: TimeSeriesData[]): Promise<void> {
    const values = data.map(d => d.value);
    const timestamps = data.map(d => d.timestamp.getTime());
    
    // Simple linear regression
    const n = values.length;
    const sumX = timestamps.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = timestamps.reduce((sum, x, i) => sum + x * values[i], 0);
    const sumXX = timestamps.reduce((sum, x) => sum + x * x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R-squared for accuracy
    const predictions = timestamps.map(x => slope * x + intercept);
    const meanY = sumY / n;
    const totalSumSquares = values.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0);
    const residualSumSquares = values.reduce((sum, y, i) => sum + Math.pow(y - predictions[i], 2), 0);
    const rSquared = 1 - (residualSumSquares / totalSumSquares);
    
    this.models.set(`${metric}_linear`, {
      name: 'Linear Regression',
      type: 'linear',
      accuracy: Math.max(0, rSquared),
      lastTrained: new Date(),
      parameters: { slope, intercept }
    });
  }

  /**
   * Train seasonal decomposition model
   */
  private async trainSeasonalModel(metric: string, data: TimeSeriesData[]): Promise<void> {
    if (!this.config.seasonalPatterns) return;
    
    const values = data.map(d => d.value);
    const hourlyAverages = new Array(24).fill(0);
    const hourlyCounts = new Array(24).fill(0);
    
    // Calculate hourly averages
    data.forEach(d => {
      const hour = d.timestamp.getHours();
      hourlyAverages[hour] += d.value;
      hourlyCounts[hour]++;
    });
    
    for (let i = 0; i < 24; i++) {
      if (hourlyCounts[i] > 0) {
        hourlyAverages[i] /= hourlyCounts[i];
      }
    }
    
    // Calculate trend component
    const trend = this.calculateTrend(values);
    
    this.models.set(`${metric}_seasonal`, {
      name: 'Seasonal Decomposition',
      type: 'seasonal',
      accuracy: 0.7, // Estimated accuracy
      lastTrained: new Date(),
      parameters: { hourlyAverages, trend }
    });
  }

  /**
   * Train healthcare pattern recognition model
   */
  private async trainHealthcarePatternModel(metric: string, data: TimeSeriesData[]): Promise<void> {
    const values = data.map(d => d.value);
    const maxValue = Math.max(...values);
    const normalizedValues = values.map(v => v / maxValue);
    
    // Detect patterns matching healthcare scenarios
    let bestPattern = '';
    let bestCorrelation = 0;
    
    for (const [patternName, pattern] of this.patterns) {
      const correlation = this.calculatePatternCorrelation(normalizedValues, pattern.pattern);
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestPattern = patternName;
      }
    }
    
    this.models.set(`${metric}_healthcare`, {
      name: 'Healthcare Pattern Recognition',
      type: 'seasonal',
      accuracy: bestCorrelation,
      lastTrained: new Date(),
      parameters: { bestPattern, correlation: bestCorrelation, maxValue }
    });
  }

  /**
   * Train neural network model (simplified)
   */
  private async trainNeuralNetworkModel(metric: string, data: TimeSeriesData[]): Promise<void> {
    // Simplified neural network simulation
    // In production, use TensorFlow.js or similar
    const values = data.map(d => d.value);
    const windowSize = 5;
    
    if (values.length < windowSize + 1) return;
    
    const inputs: number[][] = [];
    const outputs: number[] = [];
    
    for (let i = windowSize; i < values.length; i++) {
      inputs.push(values.slice(i - windowSize, i));
      outputs.push(values[i]);
    }
    
    // Simulate training (in real implementation, use proper ML library)
    const weights = Array.from({ length: windowSize }, () => Math.random());
    const bias = Math.random();
    
    this.models.set(`${metric}_neural`, {
      name: 'Neural Network',
      type: 'neural',
      accuracy: 0.75, // Simulated accuracy
      lastTrained: new Date(),
      parameters: { weights, bias, windowSize }
    });
  }

  /**
   * Make prediction using ensemble of models
   */
  async predict(metric: string, timeHorizon: number = 3600000): Promise<ScalingPrediction> {
    const models = Array.from(this.models.entries())
      .filter(([key]) => key.startsWith(metric))
      .map(([key, model]) => ({ key, model }));
    
    if (models.length === 0) {
      throw new Error(`No trained models found for metric: ${metric}`);
    }
    
    const predictions: Array<{ value: number; confidence: number; model: string }> = [];
    
    // Get predictions from each model
    for (const { key, model } of models) {
      const prediction = await this.getPredictionFromModel(key, model, timeHorizon);
      predictions.push(prediction);
    }
    
    // Ensemble prediction using weighted average
    const totalWeight = predictions.reduce((sum, p) => sum + p.confidence, 0);
    const weightedValue = predictions.reduce((sum, p) => sum + p.value * p.confidence, 0) / totalWeight;
    const avgConfidence = predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length;
    
    // Determine recommended action
    const currentData = this.historicalData.get(metric) || [];
    const recentAverage = this.getRecentAverage(currentData, 300000); // 5 minutes
    
    let recommendedAction: 'scale-up' | 'scale-down' | 'maintain' | 'prepare-scale' = 'maintain';
    let recommendedReplicas = 1;
    
    const changePercentage = ((weightedValue - recentAverage) / recentAverage) * 100;
    
    if (changePercentage > 20 && avgConfidence > this.config.confidenceThreshold) {
      recommendedAction = 'scale-up';
      recommendedReplicas = Math.ceil(1 + changePercentage / 50);
    } else if (changePercentage > 10) {
      recommendedAction = 'prepare-scale';
      recommendedReplicas = Math.ceil(1 + changePercentage / 100);
    } else if (changePercentage < -20 && avgConfidence > this.config.confidenceThreshold) {
      recommendedAction = 'scale-down';
      recommendedReplicas = Math.max(1, Math.ceil(1 + changePercentage / 50));
    }
    
    return {
      timestamp: new Date(),
      predictedValue: weightedValue,
      confidence: avgConfidence,
      model: 'ensemble',
      timeHorizon,
      recommendedAction,
      recommendedReplicas: Math.min(10, Math.max(1, recommendedReplicas))
    };
  }

  /**
   * Get prediction from specific model
   */
  private async getPredictionFromModel(
    modelKey: string, 
    model: PredictionModel, 
    timeHorizon: number
  ): Promise<{ value: number; confidence: number; model: string }> {
    const metric = modelKey.split('_')[0];
    const data = this.historicalData.get(metric) || [];
    
    switch (model.type) {
      case 'linear':
        return this.predictLinear(model, timeHorizon);
      case 'seasonal':
        return this.predictSeasonal(model, data, timeHorizon);
      case 'neural':
        return this.predictNeural(model, data, timeHorizon);
      default:
        return { value: 0, confidence: 0, model: model.name };
    }
  }

  /**
   * Linear prediction
   */
  private predictLinear(model: PredictionModel, timeHorizon: number): {
    value: number; confidence: number; model: string;
  } {
    const { slope, intercept } = model.parameters;
    const futureTimestamp = Date.now() + timeHorizon;
    const predictedValue = slope * futureTimestamp + intercept;
    
    return {
      value: Math.max(0, predictedValue),
      confidence: model.accuracy,
      model: model.name
    };
  }

  /**
   * Seasonal prediction
   */
  private predictSeasonal(
    model: PredictionModel, 
    data: TimeSeriesData[], 
    timeHorizon: number
  ): { value: number; confidence: number; model: string } {
    const { hourlyAverages, trend } = model.parameters;
    const futureDate = new Date(Date.now() + timeHorizon);
    const hour = futureDate.getHours();
    
    const seasonalComponent = hourlyAverages[hour] || 0;
    const trendComponent = trend || 0;
    const predictedValue = seasonalComponent + trendComponent;
    
    return {
      value: Math.max(0, predictedValue),
      confidence: model.accuracy,
      model: model.name
    };
  }

  /**
   * Neural network prediction (simplified)
   */
  private predictNeural(
    model: PredictionModel, 
    data: TimeSeriesData[], 
    timeHorizon: number
  ): { value: number; confidence: number; model: string } {
    const { weights, bias, windowSize } = model.parameters;
    
    if (data.length < windowSize) {
      return { value: 0, confidence: 0, model: model.name };
    }
    
    const recentValues = data.slice(-windowSize).map(d => d.value);
    const prediction = recentValues.reduce((sum, val, i) => sum + val * weights[i], bias);
    
    return {
      value: Math.max(0, prediction),
      confidence: model.accuracy,
      model: model.name
    };
  }

  /**
   * Calculate correlation between data and pattern
   */
  private calculatePatternCorrelation(data: number[], pattern: number[]): number {
    if (data.length === 0 || pattern.length === 0) return 0;
    
    const minLength = Math.min(data.length, pattern.length);
    const dataSubset = data.slice(-minLength);
    const patternSubset = pattern.slice(0, minLength);
    
    const meanData = dataSubset.reduce((a, b) => a + b, 0) / dataSubset.length;
    const meanPattern = patternSubset.reduce((a, b) => a + b, 0) / patternSubset.length;
    
    let numerator = 0;
    let sumSquareData = 0;
    let sumSquarePattern = 0;
    
    for (let i = 0; i < minLength; i++) {
      const diffData = dataSubset[i] - meanData;
      const diffPattern = patternSubset[i] - meanPattern;
      
      numerator += diffData * diffPattern;
      sumSquareData += diffData * diffData;
      sumSquarePattern += diffPattern * diffPattern;
    }
    
    const denominator = Math.sqrt(sumSquareData * sumSquarePattern);
    return denominator === 0 ? 0 : Math.abs(numerator / denominator);
  }

  /**
   * Calculate trend component
   */
  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.ceil(values.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    return secondAvg - firstAvg;
  }

  /**
   * Get recent average value
   */
  private getRecentAverage(data: TimeSeriesData[], timeWindow: number): number {
    const cutoff = new Date(Date.now() - timeWindow);
    const recentData = data.filter(d => d.timestamp > cutoff);
    
    if (recentData.length === 0) return 0;
    
    return recentData.reduce((sum, d) => sum + d.value, 0) / recentData.length;
  }

  /**
   * Get model performance metrics
   */
  getModelPerformance(): { [key: string]: any } {
    const performance: { [key: string]: any } = {};
    
    for (const [key, model] of this.models) {
      performance[key] = {
        name: model.name,
        type: model.type,
        accuracy: model.accuracy,
        lastTrained: model.lastTrained,
        age: Date.now() - model.lastTrained.getTime()
      };
    }
    
    return performance;
  }

  /**
   * Check if models need retraining
   */
  needsRetraining(): boolean {
    const now = Date.now();
    
    for (const model of this.models.values()) {
      const age = now - model.lastTrained.getTime();
      if (age > this.config.retrainInterval) {
        return true;
      }
    }
    
    return false;
  }
}
