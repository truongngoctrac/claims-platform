import { MongoClient, Db } from 'mongodb';
import IORedis from 'ioredis';
import winston from 'winston';

export interface TrendAnalysisConfig {
  id: string;
  name: string;
  description: string;
  dataSource: DataSourceConfig;
  analysisType: 'linear' | 'exponential' | 'polynomial' | 'seasonal' | 'prophet' | 'arima' | 'custom';
  algorithm: AlgorithmConfig;
  timeFrame: {
    granularity: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
    lookback: number; // Number of periods to analyze
    forecast: number; // Number of periods to forecast
  };
  features: FeatureConfig[];
  seasonality: SeasonalityConfig;
  outlierDetection: OutlierDetectionConfig;
  confidenceInterval: number; // 0.95 for 95% confidence
  notifications: NotificationConfig[];
  isActive: boolean;
  schedule: string; // Cron expression
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DataSourceConfig {
  type: 'mongodb' | 'api' | 'redis' | 'kpi';
  connection: any;
  query: any;
  timeField: string;
  valueField: string;
  groupByFields?: string[];
  filters?: FilterCondition[];
}

export interface AlgorithmConfig {
  type: 'linear_regression' | 'polynomial_regression' | 'exponential_smoothing' | 'holt_winters' | 'arima' | 'prophet' | 'neural_network';
  parameters: Record<string, any>;
  validation: {
    method: 'holdout' | 'cross_validation' | 'time_series_split';
    testSize: number; // 0.2 for 20% test data
    metrics: ('mae' | 'mse' | 'rmse' | 'mape' | 'r2')[];
  };
}

export interface FeatureConfig {
  name: string;
  type: 'lag' | 'moving_average' | 'seasonal' | 'trend' | 'external' | 'engineered';
  config: Record<string, any>;
}

export interface SeasonalityConfig {
  enabled: boolean;
  patterns: ('daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly')[];
  autoDetect: boolean;
  customPeriods?: number[];
}

export interface OutlierDetectionConfig {
  enabled: boolean;
  method: 'zscore' | 'iqr' | 'isolation_forest' | 'dbscan';
  threshold: number;
  treatment: 'remove' | 'interpolate' | 'flag';
}

export interface NotificationConfig {
  id: string;
  name: string;
  trigger: 'trend_change' | 'forecast_deviation' | 'anomaly_detected' | 'model_performance';
  condition: any;
  actions: NotificationAction[];
  isEnabled: boolean;
}

export interface NotificationAction {
  type: 'email' | 'webhook' | 'dashboard' | 'log';
  config: Record<string, any>;
}

export interface FilterCondition {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'in' | 'not_in' | 'between';
  value: any;
}

export interface TrendAnalysisResult {
  id: string;
  configId: string;
  analysisDate: Date;
  dataPoints: DataPoint[];
  trendLine: TrendPoint[];
  forecast: ForecastPoint[];
  statistics: TrendStatistics;
  seasonality: SeasonalityResult;
  outliers: OutlierResult[];
  modelPerformance: ModelPerformance;
  insights: TrendInsight[];
  confidence: number;
  executionTime: number;
}

export interface DataPoint {
  timestamp: Date;
  value: number;
  dimensions?: Record<string, string>;
  isOutlier?: boolean;
  adjustedValue?: number;
}

export interface TrendPoint {
  timestamp: Date;
  value: number;
  slope: number;
  confidence: number;
}

export interface ForecastPoint {
  timestamp: Date;
  predicted: number;
  lower: number;
  upper: number;
  confidence: number;
}

export interface TrendStatistics {
  slope: number;
  intercept: number;
  r_squared: number;
  correlation: number;
  volatility: number;
  growth_rate: number;
  acceleration: number;
  direction: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  strength: 'strong' | 'moderate' | 'weak';
  changePoints: ChangePoint[];
}

export interface ChangePoint {
  timestamp: Date;
  confidence: number;
  type: 'trend_change' | 'level_shift' | 'volatility_change';
  magnitude: number;
}

export interface SeasonalityResult {
  detected: boolean;
  patterns: DetectedPattern[];
  strength: number;
  adjustedData: DataPoint[];
}

export interface DetectedPattern {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  period: number;
  strength: number;
  phase: number;
}

export interface OutlierResult {
  timestamp: Date;
  value: number;
  expected: number;
  deviation: number;
  method: string;
  confidence: number;
}

export interface ModelPerformance {
  mae: number; // Mean Absolute Error
  mse: number; // Mean Squared Error
  rmse: number; // Root Mean Squared Error
  mape: number; // Mean Absolute Percentage Error
  r2: number; // R-squared
  aic?: number; // Akaike Information Criterion
  bic?: number; // Bayesian Information Criterion
}

export interface TrendInsight {
  type: 'trend_reversal' | 'acceleration' | 'deceleration' | 'seasonality_shift' | 'anomaly_cluster';
  confidence: number;
  description: string;
  impact: 'high' | 'medium' | 'low';
  timeframe: { start: Date; end: Date };
  recommendation?: string;
}

export class TrendAnalysisService {
  private db: Db | null = null;
  private redis: IORedis;
  private logger: winston.Logger;
  private analysisConfigs: Map<string, TrendAnalysisConfig> = new Map();
  private runningAnalyses: Set<string> = new Set();

  constructor(
    private connectionString: string,
    private databaseName: string,
    redisConfig: { host: string; port: number; password?: string }
  ) {
    this.redis = new IORedis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3
    });

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/trend-analysis.log' })
      ]
    });
  }

  async initialize(): Promise<void> {
    try {
      const client = new MongoClient(this.connectionString);
      await client.connect();
      this.db = client.db(this.databaseName);
      
      await this.createTrendAnalysisSchema();
      await this.loadAnalysisConfigs();
      await this.createDefaultAnalyses();
      
      this.logger.info('Trend Analysis Service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Trend Analysis Service', error);
      throw error;
    }
  }

  private async createTrendAnalysisSchema(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const collections = [
      {
        name: 'trend_analysis_configs',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['id', 'name', 'dataSource', 'analysisType', 'algorithm'],
            properties: {
              id: { bsonType: 'string' },
              name: { bsonType: 'string' },
              analysisType: { enum: ['linear', 'exponential', 'polynomial', 'seasonal', 'prophet', 'arima', 'custom'] },
              algorithm: { bsonType: 'object' },
              dataSource: { bsonType: 'object' }
            }
          }
        }
      },
      {
        name: 'trend_analysis_results',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['id', 'configId', 'analysisDate'],
            properties: {
              id: { bsonType: 'string' },
              configId: { bsonType: 'string' },
              analysisDate: { bsonType: 'date' }
            }
          }
        }
      }
    ];

    for (const collection of collections) {
      try {
        await this.db.createCollection(collection.name, {
          validator: collection.validator
        });
      } catch (error: any) {
        if (error.code !== 48) {
          throw error;
        }
      }
    }

    // Create indexes
    await this.db.collection('trend_analysis_configs').createIndex({ id: 1 }, { unique: true });
    await this.db.collection('trend_analysis_configs').createIndex({ isActive: 1 });
    await this.db.collection('trend_analysis_results').createIndex({ configId: 1, analysisDate: -1 });
    await this.db.collection('trend_analysis_results').createIndex({ analysisDate: -1 });
  }

  async createAnalysisConfig(config: Omit<TrendAnalysisConfig, 'createdAt' | 'updatedAt'>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const fullConfig: TrendAnalysisConfig = {
      ...config,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.db.collection('trend_analysis_configs').replaceOne(
      { id: config.id },
      fullConfig,
      { upsert: true }
    );

    this.analysisConfigs.set(config.id, fullConfig);

    // Cache config
    await this.redis.hset(
      'trend:configs',
      config.id,
      JSON.stringify(fullConfig)
    );

    this.logger.info(`Trend analysis config created: ${config.name}`);
  }

  async runTrendAnalysis(configId: string): Promise<string> {
    if (this.runningAnalyses.has(configId)) {
      throw new Error(`Trend analysis already running: ${configId}`);
    }

    const config = await this.getAnalysisConfig(configId);
    if (!config) {
      throw new Error(`Analysis config not found: ${configId}`);
    }

    const resultId = `result_${configId}_${Date.now()}`;
    this.runningAnalyses.add(configId);

    try {
      const startTime = Date.now();
      
      // Fetch and prepare data
      const rawData = await this.fetchAnalysisData(config);
      const cleanedData = await this.preprocessData(rawData, config);
      
      // Perform trend analysis
      const result = await this.executeAnalysis(config, cleanedData, resultId);
      result.executionTime = Date.now() - startTime;
      
      // Save results
      await this.saveAnalysisResult(result);
      
      // Send notifications if configured
      await this.processNotifications(config, result);
      
      this.logger.info(`Trend analysis completed: ${configId}`, {
        resultId,
        dataPoints: cleanedData.length,
        executionTime: result.executionTime
      });

      return resultId;
    } catch (error) {
      this.logger.error(`Trend analysis failed: ${configId}`, error);
      throw error;
    } finally {
      this.runningAnalyses.delete(configId);
    }
  }

  private async fetchAnalysisData(config: TrendAnalysisConfig): Promise<any[]> {
    const { dataSource } = config;
    
    switch (dataSource.type) {
      case 'mongodb':
        return await this.fetchMongoData(dataSource);
      case 'api':
        return await this.fetchAPIData(dataSource);
      case 'redis':
        return await this.fetchRedisData(dataSource);
      case 'kpi':
        return await this.fetchKPIData(dataSource);
      default:
        throw new Error(`Unsupported data source type: ${dataSource.type}`);
    }
  }

  private async fetchMongoData(dataSource: DataSourceConfig): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    const collection = this.db.collection(dataSource.connection.collection);
    let query = dataSource.query || {};

    // Apply filters
    if (dataSource.filters) {
      for (const filter of dataSource.filters) {
        query[filter.field] = this.buildFilterQuery(filter);
      }
    }

    // Build aggregation pipeline
    const pipeline: any[] = [
      { $match: query }
    ];

    // Group by fields if specified
    if (dataSource.groupByFields && dataSource.groupByFields.length > 0) {
      const groupBy: any = {};
      dataSource.groupByFields.forEach(field => {
        groupBy[field] = `$${field}`;
      });

      pipeline.push({
        $group: {
          _id: groupBy,
          value: { $avg: `$${dataSource.valueField}` },
          timestamp: { $first: `$${dataSource.timeField}` },
          count: { $sum: 1 }
        }
      });
    }

    pipeline.push({ $sort: { [dataSource.timeField]: 1 } });

    return await collection.aggregate(pipeline).toArray();
  }

  private async fetchAPIData(dataSource: DataSourceConfig): Promise<any[]> {
    const response = await fetch(dataSource.connection.url, {
      method: dataSource.connection.method || 'GET',
      headers: dataSource.connection.headers || {}
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [data];
  }

  private async fetchRedisData(dataSource: DataSourceConfig): Promise<any[]> {
    const data = await this.redis.get(dataSource.connection.key);
    if (!data) return [];
    
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [parsed];
  }

  private async fetchKPIData(dataSource: DataSourceConfig): Promise<any[]> {
    // Fetch KPI historical data
    const kpiId = dataSource.connection.kpiId;
    const cacheKey = `kpi:history:${kpiId}`;
    
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Fallback to database query for KPI values
    if (this.db) {
      const values = await this.db.collection('kpi_values')
        .find({ kpiId })
        .sort({ timestamp: 1 })
        .limit(10000)
        .toArray();
      
      return values.map(v => ({
        timestamp: v.timestamp,
        value: v.value,
        dimensions: v.dimensions
      }));
    }

    return [];
  }

  private buildFilterQuery(filter: FilterCondition): any {
    switch (filter.operator) {
      case '=': return filter.value;
      case '!=': return { $ne: filter.value };
      case '>': return { $gt: filter.value };
      case '<': return { $lt: filter.value };
      case '>=': return { $gte: filter.value };
      case '<=': return { $lte: filter.value };
      case 'in': return { $in: filter.value };
      case 'not_in': return { $nin: filter.value };
      case 'between': return { $gte: filter.value[0], $lte: filter.value[1] };
      default: return filter.value;
    }
  }

  private async preprocessData(rawData: any[], config: TrendAnalysisConfig): Promise<DataPoint[]> {
    let dataPoints: DataPoint[] = rawData.map(item => ({
      timestamp: new Date(this.getNestedValue(item, config.dataSource.timeField)),
      value: Number(this.getNestedValue(item, config.dataSource.valueField)) || 0,
      dimensions: config.dataSource.groupByFields ? 
        this.extractDimensions(item, config.dataSource.groupByFields) : undefined
    }));

    // Sort by timestamp
    dataPoints.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Detect and handle outliers
    if (config.outlierDetection.enabled) {
      dataPoints = await this.detectOutliers(dataPoints, config.outlierDetection);
    }

    // Fill missing data points
    dataPoints = await this.fillMissingValues(dataPoints, config.timeFrame.granularity);

    // Apply feature engineering
    dataPoints = await this.engineerFeatures(dataPoints, config.features);

    return dataPoints;
  }

  private async detectOutliers(data: DataPoint[], config: OutlierDetectionConfig): Promise<DataPoint[]> {
    const values = data.map(dp => dp.value);
    let outlierIndices: Set<number> = new Set();

    switch (config.method) {
      case 'zscore':
        outlierIndices = this.detectOutliersZScore(values, config.threshold);
        break;
      case 'iqr':
        outlierIndices = this.detectOutliersIQR(values, config.threshold);
        break;
      case 'isolation_forest':
        // Would implement isolation forest algorithm
        break;
      case 'dbscan':
        // Would implement DBSCAN clustering for outlier detection
        break;
    }

    // Mark outliers and apply treatment
    for (let i = 0; i < data.length; i++) {
      if (outlierIndices.has(i)) {
        data[i].isOutlier = true;
        
        switch (config.treatment) {
          case 'remove':
            // Mark for removal (actual removal done later)
            break;
          case 'interpolate':
            data[i].adjustedValue = this.interpolateValue(data, i);
            break;
          case 'flag':
            // Just flag, keep original value
            break;
        }
      }
    }

    // Remove outliers if treatment is 'remove'
    if (config.treatment === 'remove') {
      data = data.filter(dp => !dp.isOutlier);
    }

    return data;
  }

  private detectOutliersZScore(values: number[], threshold: number): Set<number> {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const std = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
    
    const outliers = new Set<number>();
    for (let i = 0; i < values.length; i++) {
      const zScore = Math.abs((values[i] - mean) / std);
      if (zScore > threshold) {
        outliers.add(i);
      }
    }
    
    return outliers;
  }

  private detectOutliersIQR(values: number[], multiplier: number): Set<number> {
    const sorted = [...values].sort((a, b) => a - b);
    const q1Index = Math.floor(sorted.length * 0.25);
    const q3Index = Math.floor(sorted.length * 0.75);
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;
    
    const lowerBound = q1 - (multiplier * iqr);
    const upperBound = q3 + (multiplier * iqr);
    
    const outliers = new Set<number>();
    for (let i = 0; i < values.length; i++) {
      if (values[i] < lowerBound || values[i] > upperBound) {
        outliers.add(i);
      }
    }
    
    return outliers;
  }

  private interpolateValue(data: DataPoint[], index: number): number {
    // Simple linear interpolation
    let prevValue = 0;
    let nextValue = 0;
    
    // Find previous non-outlier value
    for (let i = index - 1; i >= 0; i--) {
      if (!data[i].isOutlier) {
        prevValue = data[i].value;
        break;
      }
    }
    
    // Find next non-outlier value
    for (let i = index + 1; i < data.length; i++) {
      if (!data[i].isOutlier) {
        nextValue = data[i].value;
        break;
      }
    }
    
    return (prevValue + nextValue) / 2;
  }

  private async fillMissingValues(data: DataPoint[], granularity: string): Promise<DataPoint[]> {
    if (data.length === 0) return data;

    const filled: DataPoint[] = [];
    const msInterval = this.getMillisecondsInterval(granularity);
    
    let currentTime = data[0].timestamp.getTime();
    const endTime = data[data.length - 1].timestamp.getTime();
    
    let dataIndex = 0;
    
    while (currentTime <= endTime) {
      const timestamp = new Date(currentTime);
      
      // Check if we have data for this timestamp
      if (dataIndex < data.length && 
          Math.abs(data[dataIndex].timestamp.getTime() - currentTime) < msInterval / 2) {
        filled.push(data[dataIndex]);
        dataIndex++;
      } else {
        // Interpolate missing value
        const interpolatedValue = this.interpolateMissingValue(data, timestamp, dataIndex);
        filled.push({
          timestamp,
          value: interpolatedValue,
          dimensions: data[Math.min(dataIndex, data.length - 1)].dimensions
        });
      }
      
      currentTime += msInterval;
    }
    
    return filled;
  }

  private getMillisecondsInterval(granularity: string): number {
    const intervals: Record<string, number> = {
      'minute': 60 * 1000,
      'hour': 60 * 60 * 1000,
      'day': 24 * 60 * 60 * 1000,
      'week': 7 * 24 * 60 * 60 * 1000,
      'month': 30 * 24 * 60 * 60 * 1000,
      'quarter': 90 * 24 * 60 * 60 * 1000,
      'year': 365 * 24 * 60 * 60 * 1000
    };
    
    return intervals[granularity] || intervals['day'];
  }

  private interpolateMissingValue(data: DataPoint[], timestamp: Date, nearestIndex: number): number {
    if (data.length === 0) return 0;
    if (nearestIndex >= data.length) return data[data.length - 1].value;
    if (nearestIndex <= 0) return data[0].value;
    
    const before = data[nearestIndex - 1];
    const after = data[Math.min(nearestIndex, data.length - 1)];
    
    const timeDiff = after.timestamp.getTime() - before.timestamp.getTime();
    if (timeDiff === 0) return before.value;
    
    const ratio = (timestamp.getTime() - before.timestamp.getTime()) / timeDiff;
    return before.value + (after.value - before.value) * ratio;
  }

  private async engineerFeatures(data: DataPoint[], features: FeatureConfig[]): Promise<DataPoint[]> {
    for (const feature of features) {
      switch (feature.type) {
        case 'lag':
          data = this.addLagFeatures(data, feature.config);
          break;
        case 'moving_average':
          data = this.addMovingAverageFeatures(data, feature.config);
          break;
        case 'seasonal':
          data = this.addSeasonalFeatures(data, feature.config);
          break;
        case 'trend':
          data = this.addTrendFeatures(data, feature.config);
          break;
      }
    }
    
    return data;
  }

  private addLagFeatures(data: DataPoint[], config: any): DataPoint[] {
    const lagPeriods = config.periods || [1, 7, 30];
    
    return data.map((point, index) => {
      const lagValues: Record<string, number> = {};
      
      for (const lag of lagPeriods) {
        const lagIndex = index - lag;
        if (lagIndex >= 0) {
          lagValues[`lag_${lag}`] = data[lagIndex].value;
        }
      }
      
      return {
        ...point,
        ...lagValues
      };
    });
  }

  private addMovingAverageFeatures(data: DataPoint[], config: any): DataPoint[] {
    const windows = config.windows || [7, 30, 90];
    
    return data.map((point, index) => {
      const maValues: Record<string, number> = {};
      
      for (const window of windows) {
        const startIndex = Math.max(0, index - window + 1);
        const windowData = data.slice(startIndex, index + 1);
        const average = windowData.reduce((sum, dp) => sum + dp.value, 0) / windowData.length;
        maValues[`ma_${window}`] = average;
      }
      
      return {
        ...point,
        ...maValues
      };
    });
  }

  private addSeasonalFeatures(data: DataPoint[], config: any): DataPoint[] {
    return data.map(point => {
      const date = point.timestamp;
      const seasonalFeatures: Record<string, number> = {};
      
      // Day of week (0-6)
      seasonalFeatures.day_of_week = date.getDay();
      
      // Day of month (1-31)
      seasonalFeatures.day_of_month = date.getDate();
      
      // Month of year (0-11)
      seasonalFeatures.month = date.getMonth();
      
      // Quarter (0-3)
      seasonalFeatures.quarter = Math.floor(date.getMonth() / 3);
      
      // Hour of day (0-23)
      seasonalFeatures.hour = date.getHours();
      
      return {
        ...point,
        ...seasonalFeatures
      };
    });
  }

  private addTrendFeatures(data: DataPoint[], config: any): DataPoint[] {
    const windowSize = config.window || 30;
    
    return data.map((point, index) => {
      if (index < windowSize) {
        return point;
      }
      
      // Calculate linear trend over window
      const windowData = data.slice(index - windowSize, index);
      const trend = this.calculateLinearTrend(windowData);
      
      return {
        ...point,
        trend_slope: trend.slope,
        trend_r2: trend.r2
      };
    });
  }

  private async executeAnalysis(
    config: TrendAnalysisConfig,
    data: DataPoint[],
    resultId: string
  ): Promise<TrendAnalysisResult> {
    const result: TrendAnalysisResult = {
      id: resultId,
      configId: config.id,
      analysisDate: new Date(),
      dataPoints: data,
      trendLine: [],
      forecast: [],
      statistics: {} as TrendStatistics,
      seasonality: { detected: false, patterns: [], strength: 0, adjustedData: [] },
      outliers: [],
      modelPerformance: {} as ModelPerformance,
      insights: [],
      confidence: config.confidenceInterval,
      executionTime: 0
    };

    // Execute specific algorithm
    switch (config.algorithm.type) {
      case 'linear_regression':
        await this.executeLinearRegression(data, config, result);
        break;
      case 'polynomial_regression':
        await this.executePolynomialRegression(data, config, result);
        break;
      case 'exponential_smoothing':
        await this.executeExponentialSmoothing(data, config, result);
        break;
      case 'holt_winters':
        await this.executeHoltWinters(data, config, result);
        break;
      case 'arima':
        await this.executeARIMA(data, config, result);
        break;
      case 'prophet':
        await this.executeProphet(data, config, result);
        break;
    }

    // Detect seasonality if enabled
    if (config.seasonality.enabled) {
      result.seasonality = await this.detectSeasonality(data, config.seasonality);
    }

    // Generate insights
    result.insights = await this.generateInsights(result, config);

    return result;
  }

  private async executeLinearRegression(
    data: DataPoint[],
    config: TrendAnalysisConfig,
    result: TrendAnalysisResult
  ): Promise<void> {
    if (data.length < 2) return;

    // Convert timestamps to numeric values for regression
    const x = data.map((dp, index) => index);
    const y = data.map(dp => dp.value);

    // Calculate linear regression
    const trend = this.calculateLinearTrend(data);
    
    result.statistics = {
      slope: trend.slope,
      intercept: trend.intercept,
      r_squared: trend.r2,
      correlation: trend.correlation,
      volatility: this.calculateVolatility(y),
      growth_rate: this.calculateGrowthRate(data),
      acceleration: 0, // Would calculate second derivative
      direction: trend.slope > 0 ? 'increasing' : trend.slope < 0 ? 'decreasing' : 'stable',
      strength: trend.r2 > 0.7 ? 'strong' : trend.r2 > 0.3 ? 'moderate' : 'weak',
      changePoints: []
    };

    // Generate trend line
    result.trendLine = data.map((dp, index) => ({
      timestamp: dp.timestamp,
      value: trend.intercept + trend.slope * index,
      slope: trend.slope,
      confidence: trend.r2
    }));

    // Generate forecast
    const forecastPeriods = config.timeFrame.forecast;
    for (let i = 1; i <= forecastPeriods; i++) {
      const forecastIndex = data.length + i - 1;
      const predicted = trend.intercept + trend.slope * forecastIndex;
      const standardError = this.calculateStandardError(data, trend);
      const margin = 1.96 * standardError; // 95% confidence interval

      result.forecast.push({
        timestamp: this.addTimeInterval(data[data.length - 1].timestamp, config.timeFrame.granularity, i),
        predicted,
        lower: predicted - margin,
        upper: predicted + margin,
        confidence: trend.r2
      });
    }

    // Calculate model performance
    const predictions = x.map(xi => trend.intercept + trend.slope * xi);
    result.modelPerformance = this.calculateModelPerformance(y, predictions);
  }

  private calculateLinearTrend(data: DataPoint[]): { slope: number; intercept: number; r2: number; correlation: number } {
    if (data.length < 2) {
      return { slope: 0, intercept: 0, r2: 0, correlation: 0 };
    }

    const n = data.length;
    const x = data.map((_, index) => index);
    const y = data.map(dp => dp.value);

    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, index) => sum + val * y[index], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    const sumYY = y.reduce((sum, val) => sum + val * val, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const meanY = sumY / n;
    const ssTotal = y.reduce((sum, val) => sum + Math.pow(val - meanY, 2), 0);
    const ssResidual = y.reduce((sum, val, index) => {
      const predicted = intercept + slope * x[index];
      return sum + Math.pow(val - predicted, 2);
    }, 0);

    const r2 = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0;

    const correlation = (n * sumXY - sumX * sumY) / 
      Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));

    return { slope, intercept, r2, correlation };
  }

  private calculateVolatility(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculateGrowthRate(data: DataPoint[]): number {
    if (data.length < 2) return 0;
    
    const firstValue = data[0].value;
    const lastValue = data[data.length - 1].value;
    
    if (firstValue === 0) return 0;
    
    const periods = data.length - 1;
    return Math.pow(lastValue / firstValue, 1 / periods) - 1;
  }

  private calculateStandardError(data: DataPoint[], trend: { slope: number; intercept: number }): number {
    const residuals = data.map((dp, index) => {
      const predicted = trend.intercept + trend.slope * index;
      return dp.value - predicted;
    });

    const sumSquaredResiduals = residuals.reduce((sum, residual) => sum + residual * residual, 0);
    const degreesOfFreedom = data.length - 2;
    
    return Math.sqrt(sumSquaredResiduals / degreesOfFreedom);
  }

  private calculateModelPerformance(actual: number[], predicted: number[]): ModelPerformance {
    const n = actual.length;
    
    // Mean Absolute Error
    const mae = actual.reduce((sum, val, index) => sum + Math.abs(val - predicted[index]), 0) / n;
    
    // Mean Squared Error
    const mse = actual.reduce((sum, val, index) => sum + Math.pow(val - predicted[index], 2), 0) / n;
    
    // Root Mean Squared Error
    const rmse = Math.sqrt(mse);
    
    // Mean Absolute Percentage Error
    const mape = actual.reduce((sum, val, index) => {
      return sum + (val !== 0 ? Math.abs((val - predicted[index]) / val) : 0);
    }, 0) / n;
    
    // R-squared
    const meanActual = actual.reduce((sum, val) => sum + val, 0) / n;
    const ssTotal = actual.reduce((sum, val) => sum + Math.pow(val - meanActual, 2), 0);
    const ssResidual = actual.reduce((sum, val, index) => sum + Math.pow(val - predicted[index], 2), 0);
    const r2 = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0;

    return { mae, mse, rmse, mape, r2 };
  }

  private addTimeInterval(date: Date, granularity: string, periods: number): Date {
    const newDate = new Date(date);
    const interval = this.getMillisecondsInterval(granularity);
    newDate.setTime(newDate.getTime() + interval * periods);
    return newDate;
  }

  // Placeholder implementations for other algorithms
  private async executePolynomialRegression(data: DataPoint[], config: TrendAnalysisConfig, result: TrendAnalysisResult): Promise<void> {
    // Polynomial regression implementation
    this.logger.info('Polynomial regression not fully implemented');
  }

  private async executeExponentialSmoothing(data: DataPoint[], config: TrendAnalysisConfig, result: TrendAnalysisResult): Promise<void> {
    // Exponential smoothing implementation
    this.logger.info('Exponential smoothing not fully implemented');
  }

  private async executeHoltWinters(data: DataPoint[], config: TrendAnalysisConfig, result: TrendAnalysisResult): Promise<void> {
    // Holt-Winters implementation
    this.logger.info('Holt-Winters not fully implemented');
  }

  private async executeARIMA(data: DataPoint[], config: TrendAnalysisConfig, result: TrendAnalysisResult): Promise<void> {
    // ARIMA implementation
    this.logger.info('ARIMA not fully implemented');
  }

  private async executeProphet(data: DataPoint[], config: TrendAnalysisConfig, result: TrendAnalysisResult): Promise<void> {
    // Prophet implementation
    this.logger.info('Prophet not fully implemented');
  }

  private async detectSeasonality(data: DataPoint[], config: SeasonalityConfig): Promise<SeasonalityResult> {
    const result: SeasonalityResult = {
      detected: false,
      patterns: [],
      strength: 0,
      adjustedData: [...data]
    };

    if (config.autoDetect) {
      // Auto-detect seasonality using FFT or autocorrelation
      result.patterns = await this.autoDetectSeasonality(data);
    }

    // Check for specific patterns
    for (const pattern of config.patterns) {
      const strength = this.detectSpecificPattern(data, pattern);
      if (strength > 0.3) { // Threshold for significance
        result.patterns.push({
          type: pattern,
          period: this.getPatternPeriod(pattern),
          strength,
          phase: 0
        });
      }
    }

    result.detected = result.patterns.length > 0;
    result.strength = Math.max(...result.patterns.map(p => p.strength), 0);

    return result;
  }

  private async autoDetectSeasonality(data: DataPoint[]): Promise<DetectedPattern[]> {
    // Simple autocorrelation-based seasonality detection
    const patterns: DetectedPattern[] = [];
    const values = data.map(dp => dp.value);
    const maxLag = Math.min(data.length / 2, 365); // Check up to 365 periods

    for (let lag = 2; lag <= maxLag; lag++) {
      const correlation = this.calculateAutocorrelation(values, lag);
      if (correlation > 0.3) { // Significant correlation
        patterns.push({
          type: 'custom',
          period: lag,
          strength: correlation,
          phase: 0
        });
      }
    }

    return patterns;
  }

  private calculateAutocorrelation(values: number[], lag: number): number {
    if (lag >= values.length) return 0;

    const n = values.length - lag;
    let sumXY = 0;
    let sumX = 0;
    let sumY = 0;
    let sumXX = 0;
    let sumYY = 0;

    for (let i = 0; i < n; i++) {
      const x = values[i];
      const y = values[i + lag];
      sumXY += x * y;
      sumX += x;
      sumY += y;
      sumXX += x * x;
      sumYY += y * y;
    }

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));

    return denominator > 0 ? numerator / denominator : 0;
  }

  private detectSpecificPattern(data: DataPoint[], pattern: string): number {
    // Detect specific seasonal patterns
    switch (pattern) {
      case 'daily':
        return this.detectDailyPattern(data);
      case 'weekly':
        return this.detectWeeklyPattern(data);
      case 'monthly':
        return this.detectMonthlyPattern(data);
      case 'yearly':
        return this.detectYearlyPattern(data);
      default:
        return 0;
    }
  }

  private detectDailyPattern(data: DataPoint[]): number {
    // Group by hour of day and check for consistent patterns
    const hourlyAverages: number[] = new Array(24).fill(0);
    const hourlyCounts: number[] = new Array(24).fill(0);

    for (const dp of data) {
      const hour = dp.timestamp.getHours();
      hourlyAverages[hour] += dp.value;
      hourlyCounts[hour]++;
    }

    // Calculate averages
    for (let i = 0; i < 24; i++) {
      if (hourlyCounts[i] > 0) {
        hourlyAverages[i] /= hourlyCounts[i];
      }
    }

    // Calculate variance to determine pattern strength
    const mean = hourlyAverages.reduce((sum, val) => sum + val, 0) / 24;
    const variance = hourlyAverages.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / 24;
    const standardDeviation = Math.sqrt(variance);

    return mean > 0 ? standardDeviation / mean : 0; // Coefficient of variation
  }

  private detectWeeklyPattern(data: DataPoint[]): number {
    // Similar to daily pattern but for days of week
    const dailyAverages: number[] = new Array(7).fill(0);
    const dailyCounts: number[] = new Array(7).fill(0);

    for (const dp of data) {
      const dayOfWeek = dp.timestamp.getDay();
      dailyAverages[dayOfWeek] += dp.value;
      dailyCounts[dayOfWeek]++;
    }

    for (let i = 0; i < 7; i++) {
      if (dailyCounts[i] > 0) {
        dailyAverages[i] /= dailyCounts[i];
      }
    }

    const mean = dailyAverages.reduce((sum, val) => sum + val, 0) / 7;
    const variance = dailyAverages.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / 7;
    const standardDeviation = Math.sqrt(variance);

    return mean > 0 ? standardDeviation / mean : 0;
  }

  private detectMonthlyPattern(data: DataPoint[]): number {
    // Similar pattern for days of month
    return 0; // Simplified for now
  }

  private detectYearlyPattern(data: DataPoint[]): number {
    // Pattern for months of year
    return 0; // Simplified for now
  }

  private getPatternPeriod(pattern: string): number {
    const periods: Record<string, number> = {
      'daily': 24,
      'weekly': 7,
      'monthly': 30,
      'quarterly': 90,
      'yearly': 365
    };
    return periods[pattern] || 1;
  }

  private async generateInsights(result: TrendAnalysisResult, config: TrendAnalysisConfig): Promise<TrendInsight[]> {
    const insights: TrendInsight[] = [];

    // Trend direction insight
    if (result.statistics.strength === 'strong') {
      insights.push({
        type: result.statistics.direction === 'increasing' ? 'acceleration' : 'deceleration',
        confidence: result.statistics.r_squared,
        description: `Strong ${result.statistics.direction} trend detected with R² of ${result.statistics.r_squared.toFixed(3)}`,
        impact: result.statistics.r_squared > 0.8 ? 'high' : 'medium',
        timeframe: {
          start: result.dataPoints[0].timestamp,
          end: result.dataPoints[result.dataPoints.length - 1].timestamp
        },
        recommendation: result.statistics.direction === 'increasing' ? 
          'Monitor for sustainability and potential capacity planning' :
          'Investigate causes and implement corrective measures'
      });
    }

    // Seasonality insight
    if (result.seasonality.detected) {
      insights.push({
        type: 'seasonality_shift',
        confidence: result.seasonality.strength,
        description: `Seasonal patterns detected with ${result.seasonality.patterns.length} cycles`,
        impact: result.seasonality.strength > 0.7 ? 'high' : 'medium',
        timeframe: {
          start: result.dataPoints[0].timestamp,
          end: result.dataPoints[result.dataPoints.length - 1].timestamp
        },
        recommendation: 'Consider seasonal adjustments in planning and forecasting'
      });
    }

    // Outlier clusters
    const outliers = result.dataPoints.filter(dp => dp.isOutlier);
    if (outliers.length > result.dataPoints.length * 0.05) { // More than 5% outliers
      insights.push({
        type: 'anomaly_cluster',
        confidence: 0.8,
        description: `High number of outliers detected (${outliers.length} out of ${result.dataPoints.length})`,
        impact: 'medium',
        timeframe: {
          start: outliers[0].timestamp,
          end: outliers[outliers.length - 1].timestamp
        },
        recommendation: 'Investigate data quality and potential external factors'
      });
    }

    return insights;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private extractDimensions(item: any, fields: string[]): Record<string, string> {
    const dimensions: Record<string, string> = {};
    for (const field of fields) {
      dimensions[field] = String(this.getNestedValue(item, field) || '');
    }
    return dimensions;
  }

  private async getAnalysisConfig(configId: string): Promise<TrendAnalysisConfig | null> {
    let config = this.analysisConfigs.get(configId);
    
    if (!config) {
      const cached = await this.redis.hget('trend:configs', configId);
      if (cached) {
        config = JSON.parse(cached);
        this.analysisConfigs.set(configId, config);
      }
    }

    if (!config && this.db) {
      const stored = await this.db.collection('trend_analysis_configs').findOne({ id: configId });
      if (stored) {
        config = stored as TrendAnalysisConfig;
        this.analysisConfigs.set(configId, config);
        await this.redis.hset('trend:configs', configId, JSON.stringify(config));
      }
    }

    return config || null;
  }

  private async saveAnalysisResult(result: TrendAnalysisResult): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.collection('trend_analysis_results').insertOne(result);

    // Cache latest result
    await this.redis.hset(
      'trend:latest_results',
      result.configId,
      JSON.stringify(result)
    );

    // Publish real-time update
    await this.redis.publish('trend:analysis_completed', JSON.stringify({
      resultId: result.id,
      configId: result.configId,
      timestamp: result.analysisDate
    }));
  }

  private async processNotifications(config: TrendAnalysisConfig, result: TrendAnalysisResult): Promise<void> {
    for (const notification of config.notifications) {
      if (!notification.isEnabled) continue;

      const shouldTrigger = await this.evaluateNotificationCondition(notification, result);
      if (shouldTrigger) {
        await this.sendNotification(notification, result);
      }
    }
  }

  private async evaluateNotificationCondition(notification: NotificationConfig, result: TrendAnalysisResult): Promise<boolean> {
    switch (notification.trigger) {
      case 'trend_change':
        return result.statistics.direction !== 'stable';
      case 'forecast_deviation':
        return result.modelPerformance.mape > (notification.condition.threshold || 0.1);
      case 'anomaly_detected':
        return result.outliers.length > 0;
      case 'model_performance':
        return result.modelPerformance.r2 < (notification.condition.threshold || 0.5);
      default:
        return false;
    }
  }

  private async sendNotification(notification: NotificationConfig, result: TrendAnalysisResult): Promise<void> {
    for (const action of notification.actions) {
      switch (action.type) {
        case 'webhook':
          await this.sendWebhook(result, action.config);
          break;
        case 'dashboard':
          await this.redis.publish('dashboard:trend_alerts', JSON.stringify(result));
          break;
        case 'log':
          this.logger.info(`Trend analysis notification: ${notification.name}`, result);
          break;
      }
    }
  }

  private async sendWebhook(data: any, config: any): Promise<void> {
    try {
      await fetch(config.url, {
        method: config.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers
        },
        body: JSON.stringify(data)
      });
    } catch (error) {
      this.logger.error(`Webhook failed: ${config.url}`, error);
    }
  }

  private async loadAnalysisConfigs(): Promise<void> {
    if (!this.db) return;

    const configs = await this.db.collection('trend_analysis_configs').find({}).toArray();
    for (const config of configs) {
      this.analysisConfigs.set(config.id, config as TrendAnalysisConfig);
    }
  }

  private async createDefaultAnalyses(): Promise<void> {
    const defaultConfigs: Omit<TrendAnalysisConfig, 'createdAt' | 'updatedAt'>[] = [
      {
        id: 'claims_volume_trend',
        name: 'Claims Volume Trend Analysis',
        description: 'Analyze trends in daily claims volume',
        dataSource: {
          type: 'mongodb',
          connection: { collection: 'claims' },
          query: {
            aggregation: [
              {
                $group: {
                  _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                  count: { $sum: 1 },
                  totalAmount: { $sum: '$amount' }
                }
              },
              { $sort: { _id: 1 } }
            ]
          },
          timeField: '_id',
          valueField: 'count',
          filters: []
        },
        analysisType: 'linear',
        algorithm: {
          type: 'linear_regression',
          parameters: {},
          validation: {
            method: 'holdout',
            testSize: 0.2,
            metrics: ['mae', 'rmse', 'r2']
          }
        },
        timeFrame: {
          granularity: 'day',
          lookback: 90,
          forecast: 30
        },
        features: [
          {
            name: 'moving_averages',
            type: 'moving_average',
            config: { windows: [7, 30] }
          },
          {
            name: 'seasonal_features',
            type: 'seasonal',
            config: {}
          }
        ],
        seasonality: {
          enabled: true,
          patterns: ['weekly', 'monthly'],
          autoDetect: true
        },
        outlierDetection: {
          enabled: true,
          method: 'zscore',
          threshold: 2.5,
          treatment: 'flag'
        },
        confidenceInterval: 0.95,
        notifications: [],
        isActive: true,
        schedule: '0 1 * * *', // Daily at 1 AM
        createdBy: 'system'
      }
    ];

    for (const config of defaultConfigs) {
      try {
        const existing = await this.getAnalysisConfig(config.id);
        if (!existing) {
          await this.createAnalysisConfig(config);
        }
      } catch (error) {
        this.logger.error(`Failed to create default trend analysis: ${config.name}`, error);
      }
    }
  }

  async getAnalysisResult(resultId: string): Promise<TrendAnalysisResult | null> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.collection('trend_analysis_results').findOne({ id: resultId });
    return result as TrendAnalysisResult | null;
  }

  async listAnalysisResults(configId?: string, limit: number = 10): Promise<TrendAnalysisResult[]> {
    if (!this.db) throw new Error('Database not initialized');

    const filter = configId ? { configId } : {};
    const results = await this.db.collection('trend_analysis_results')
      .find(filter)
      .sort({ analysisDate: -1 })
      .limit(limit)
      .toArray();

    return results as TrendAnalysisResult[];
  }
}
