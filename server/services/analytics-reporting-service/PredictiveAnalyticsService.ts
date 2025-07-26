import { MongoClient, Db } from 'mongodb';
import IORedis from 'ioredis';
import winston from 'winston';
import cron from 'node-cron';

export interface PredictiveModel {
  id: string;
  name: string;
  description: string;
  type: 'regression' | 'classification' | 'time_series' | 'clustering' | 'anomaly_detection';
  algorithm: ModelAlgorithm;
  features: FeatureDefinition[];
  target: TargetDefinition;
  dataSource: ModelDataSource;
  preprocessing: PreprocessingConfig;
  training: TrainingConfig;
  validation: ValidationConfig;
  hyperparameters: Record<string, any>;
  performance: ModelPerformance;
  deployment: DeploymentConfig;
  monitoring: MonitoringConfig;
  version: number;
  status: 'draft' | 'training' | 'trained' | 'deployed' | 'retired';
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  lastTrainedAt?: Date;
  lastPredictionAt?: Date;
}

export interface ModelAlgorithm {
  type: 'linear_regression' | 'random_forest' | 'gradient_boosting' | 'neural_network' | 'svm' | 'lstm' | 'arima' | 'prophet' | 'kmeans' | 'isolation_forest';
  framework: 'scikit-learn' | 'tensorflow' | 'pytorch' | 'xgboost' | 'lightgbm' | 'custom';
  config: Record<string, any>;
}

export interface FeatureDefinition {
  name: string;
  type: 'numeric' | 'categorical' | 'datetime' | 'text' | 'boolean';
  source: string; // field path in data
  transformation?: FeatureTransformation;
  importance?: number;
  isRequired: boolean;
  description?: string;
}

export interface FeatureTransformation {
  type: 'scale' | 'normalize' | 'log' | 'polynomial' | 'binning' | 'encoding' | 'embedding';
  config: Record<string, any>;
}

export interface TargetDefinition {
  name: string;
  type: 'numeric' | 'categorical' | 'binary';
  source: string;
  transformation?: FeatureTransformation;
}

export interface ModelDataSource {
  type: 'mongodb' | 'api' | 'file' | 'kpi' | 'real_time';
  connection: any;
  query: any;
  timeRange?: {
    start: Date;
    end: Date;
    field: string;
  };
  filters?: any[];
  sampling?: {
    method: 'random' | 'stratified' | 'time_based';
    size: number;
  };
}

export interface PreprocessingConfig {
  missingValues: {
    strategy: 'drop' | 'mean' | 'median' | 'mode' | 'forward_fill' | 'backward_fill' | 'interpolate';
    threshold: number; // percentage of missing values to drop column
  };
  outliers: {
    detection: 'zscore' | 'iqr' | 'isolation_forest';
    treatment: 'remove' | 'clip' | 'transform';
    threshold: number;
  };
  scaling: {
    method: 'standard' | 'minmax' | 'robust' | 'none';
    features: string[];
  };
  encoding: {
    categorical: 'onehot' | 'label' | 'target' | 'ordinal';
    text: 'tfidf' | 'word2vec' | 'bert' | 'bag_of_words';
  };
  featureSelection: {
    method: 'correlation' | 'mutual_info' | 'chi2' | 'rfe' | 'lasso';
    numFeatures?: number;
    threshold?: number;
  };
}

export interface TrainingConfig {
  splitStrategy: 'random' | 'time_based' | 'stratified';
  trainSize: number; // 0.8 for 80%
  validationSize: number; // 0.1 for 10%
  testSize: number; // 0.1 for 10%
  crossValidation: {
    enabled: boolean;
    folds: number;
    strategy: 'kfold' | 'stratified_kfold' | 'time_series_split';
  };
  earlyStoppingPatience?: number;
  maxEpochs?: number;
  batchSize?: number;
}

export interface ValidationConfig {
  metrics: string[]; // ['accuracy', 'precision', 'recall', 'f1', 'auc', 'mse', 'mae', 'r2']
  thresholds: Record<string, number>;
  backtesting?: {
    enabled: boolean;
    periods: number;
    strategy: 'rolling' | 'expanding';
  };
}

export interface ModelPerformance {
  training: Record<string, number>;
  validation: Record<string, number>;
  test: Record<string, number>;
  crossValidation?: {
    mean: Record<string, number>;
    std: Record<string, number>;
  };
  featureImportance?: Array<{
    feature: string;
    importance: number;
  }>;
  confusionMatrix?: number[][];
  rocCurve?: Array<{ fpr: number; tpr: number; threshold: number }>;
  calibrationCurve?: Array<{ meanPredicted: number; fractionPositive: number }>;
}

export interface DeploymentConfig {
  environment: 'development' | 'staging' | 'production';
  endpoint?: string;
  batchSize: number;
  predictionInterval: number; // in seconds
  enableRealTime: boolean;
  enableBatch: boolean;
  autoRetrain: {
    enabled: boolean;
    schedule: string; // cron expression
    performanceThreshold: number;
    dataThreshold: number; // minimum new data points
  };
}

export interface MonitoringConfig {
  dataQuality: {
    enabled: boolean;
    checks: string[]; // ['missing_values', 'outliers', 'drift', 'schema']
    thresholds: Record<string, number>;
  };
  modelDrift: {
    enabled: boolean;
    method: 'psi' | 'ks_test' | 'chi2';
    threshold: number;
    windowSize: number;
  };
  performanceMonitoring: {
    enabled: boolean;
    metrics: string[];
    alertThresholds: Record<string, number>;
  };
  predictionMonitoring: {
    enabled: boolean;
    logPredictions: boolean;
    sampleRate: number;
  };
}

export interface PredictionRequest {
  modelId: string;
  features: Record<string, any>;
  returnProbability?: boolean;
  returnExplanation?: boolean;
  metadata?: Record<string, any>;
}

export interface PredictionResponse {
  modelId: string;
  prediction: any;
  probability?: number[];
  confidence: number;
  explanation?: FeatureExplanation[];
  metadata: {
    timestamp: Date;
    processingTime: number;
    modelVersion: number;
  };
}

export interface FeatureExplanation {
  feature: string;
  value: any;
  contribution: number;
  importance: number;
}

export interface BatchPredictionJob {
  id: string;
  modelId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  inputSource: any;
  outputDestination: any;
  startTime: Date;
  endTime?: Date;
  recordsProcessed: number;
  recordsSuccessful: number;
  recordsFailed: number;
  errorMessage?: string;
}

export interface ModelTrainingJob {
  id: string;
  modelId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  config: any;
  startTime: Date;
  endTime?: Date;
  performance?: ModelPerformance;
  errorMessage?: string;
  logs: string[];
}

export interface ModelMetrics {
  modelId: string;
  timestamp: Date;
  predictionCount: number;
  averageLatency: number;
  errorRate: number;
  dataDriftScore: number;
  performanceMetrics: Record<string, number>;
}

export class PredictiveAnalyticsService {
  private db: Db | null = null;
  private redis: IORedis;
  private logger: winston.Logger;
  private models: Map<string, PredictiveModel> = new Map();
  private trainingJobs: Map<string, ModelTrainingJob> = new Map();
  private batchJobs: Map<string, BatchPredictionJob> = new Map();
  private modelCache: Map<string, any> = new Map(); // Cached trained models

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
        new winston.transports.File({ filename: 'logs/predictive-analytics.log' })
      ]
    });
  }

  async initialize(): Promise<void> {
    try {
      const client = new MongoClient(this.connectionString);
      await client.connect();
      this.db = client.db(this.databaseName);
      
      await this.createPredictiveAnalyticsSchema();
      await this.loadModels();
      await this.createDefaultModels();
      await this.scheduleModelMonitoring();
      
      this.logger.info('Predictive Analytics Service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Predictive Analytics Service', error);
      throw error;
    }
  }

  private async createPredictiveAnalyticsSchema(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const collections = [
      {
        name: 'predictive_models',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['id', 'name', 'type', 'algorithm', 'features', 'target'],
            properties: {
              id: { bsonType: 'string' },
              name: { bsonType: 'string' },
              type: { enum: ['regression', 'classification', 'time_series', 'clustering', 'anomaly_detection'] },
              algorithm: { bsonType: 'object' },
              features: { bsonType: 'array' },
              target: { bsonType: 'object' },
              status: { enum: ['draft', 'training', 'trained', 'deployed', 'retired'] }
            }
          }
        }
      },
      {
        name: 'model_predictions',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['modelId', 'prediction', 'timestamp'],
            properties: {
              modelId: { bsonType: 'string' },
              prediction: {},
              timestamp: { bsonType: 'date' }
            }
          }
        }
      },
      {
        name: 'model_training_jobs',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['id', 'modelId', 'status', 'startTime'],
            properties: {
              id: { bsonType: 'string' },
              modelId: { bsonType: 'string' },
              status: { enum: ['pending', 'running', 'completed', 'failed'] },
              startTime: { bsonType: 'date' }
            }
          }
        }
      },
      {
        name: 'batch_prediction_jobs',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['id', 'modelId', 'status', 'startTime'],
            properties: {
              id: { bsonType: 'string' },
              modelId: { bsonType: 'string' },
              status: { enum: ['pending', 'running', 'completed', 'failed'] },
              startTime: { bsonType: 'date' }
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
    await this.db.collection('predictive_models').createIndex({ id: 1 }, { unique: true });
    await this.db.collection('predictive_models').createIndex({ type: 1, status: 1 });
    await this.db.collection('model_predictions').createIndex({ modelId: 1, timestamp: -1 });
    await this.db.collection('model_training_jobs').createIndex({ modelId: 1, startTime: -1 });
    await this.db.collection('batch_prediction_jobs').createIndex({ modelId: 1, startTime: -1 });
  }

  async createModel(model: Omit<PredictiveModel, 'createdAt' | 'updatedAt' | 'version' | 'performance'>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const fullModel: PredictiveModel = {
      ...model,
      version: 1,
      performance: {
        training: {},
        validation: {},
        test: {}
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.db.collection('predictive_models').replaceOne(
      { id: model.id },
      fullModel,
      { upsert: true }
    );

    this.models.set(model.id, fullModel);

    // Cache model definition
    await this.redis.hset(
      'ml:models',
      model.id,
      JSON.stringify(fullModel)
    );

    this.logger.info(`Predictive model created: ${model.name}`);
  }

  async trainModel(modelId: string): Promise<string> {
    const model = await this.getModel(modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    const jobId = `train_${modelId}_${Date.now()}`;
    const job: ModelTrainingJob = {
      id: jobId,
      modelId,
      status: 'pending',
      config: {
        algorithm: model.algorithm,
        features: model.features,
        target: model.target,
        training: model.training
      },
      startTime: new Date(),
      logs: []
    };

    this.trainingJobs.set(jobId, job);
    await this.saveTrainingJob(job);

    // Execute training asynchronously
    this.executeModelTraining(job, model);

    return jobId;
  }

  private async executeModelTraining(job: ModelTrainingJob, model: PredictiveModel): Promise<void> {
    try {
      job.status = 'running';
      job.logs.push(`Training started at ${new Date().toISOString()}`);
      await this.saveTrainingJob(job);

      // 1. Fetch training data
      job.logs.push('Fetching training data...');
      const rawData = await this.fetchTrainingData(model);
      
      // 2. Preprocess data
      job.logs.push('Preprocessing data...');
      const { features, target, preprocessor } = await this.preprocessTrainingData(rawData, model);
      
      // 3. Split data
      job.logs.push('Splitting data...');
      const { trainX, trainY, valX, valY, testX, testY } = await this.splitTrainingData(features, target, model.training);
      
      // 4. Train model
      job.logs.push('Training model...');
      const trainedModel = await this.trainModelAlgorithm(trainX, trainY, valX, valY, model);
      
      // 5. Evaluate model
      job.logs.push('Evaluating model...');
      const performance = await this.evaluateModel(trainedModel, trainX, trainY, valX, valY, testX, testY, model);
      
      // 6. Save trained model
      job.logs.push('Saving trained model...');
      await this.saveTrainedModel(model.id, trainedModel, preprocessor, performance);
      
      // Update job and model
      job.status = 'completed';
      job.endTime = new Date();
      job.performance = performance;
      job.logs.push(`Training completed at ${job.endTime.toISOString()}`);

      // Update model in database
      await this.updateModelStatus(model.id, 'trained', performance);

      this.logger.info(`Model training completed: ${model.id}`, {
        jobId: job.id,
        performance: performance.test
      });

    } catch (error) {
      job.status = 'failed';
      job.endTime = new Date();
      job.errorMessage = error instanceof Error ? error.message : String(error);
      job.logs.push(`Training failed: ${job.errorMessage}`);

      this.logger.error(`Model training failed: ${model.id}`, error);
    } finally {
      await this.saveTrainingJob(job);
    }
  }

  private async fetchTrainingData(model: PredictiveModel): Promise<any[]> {
    const { dataSource } = model;
    
    switch (dataSource.type) {
      case 'mongodb':
        return await this.fetchMongoTrainingData(dataSource);
      case 'api':
        return await this.fetchAPITrainingData(dataSource);
      case 'kpi':
        return await this.fetchKPITrainingData(dataSource);
      default:
        throw new Error(`Unsupported data source type: ${dataSource.type}`);
    }
  }

  private async fetchMongoTrainingData(dataSource: ModelDataSource): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    const collection = this.db.collection(dataSource.connection.collection);
    let query = dataSource.query || {};

    // Apply time range filter
    if (dataSource.timeRange) {
      query[dataSource.timeRange.field] = {
        $gte: dataSource.timeRange.start,
        $lte: dataSource.timeRange.end
      };
    }

    // Apply filters
    if (dataSource.filters) {
      for (const filter of dataSource.filters) {
        Object.assign(query, filter);
      }
    }

    let data = await collection.find(query).toArray();

    // Apply sampling if configured
    if (dataSource.sampling) {
      data = this.applySampling(data, dataSource.sampling);
    }

    return data;
  }

  private async fetchAPITrainingData(dataSource: ModelDataSource): Promise<any[]> {
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

  private async fetchKPITrainingData(dataSource: ModelDataSource): Promise<any[]> {
    // Fetch KPI historical data for training
    if (this.db) {
      const values = await this.db.collection('kpi_values')
        .find({
          kpiId: dataSource.connection.kpiId,
          timestamp: {
            $gte: dataSource.timeRange?.start || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
            $lte: dataSource.timeRange?.end || new Date()
          }
        })
        .sort({ timestamp: 1 })
        .toArray();
      
      return values;
    }
    return [];
  }

  private applySampling(data: any[], sampling: ModelDataSource['sampling']): any[] {
    if (!sampling) return data;

    switch (sampling.method) {
      case 'random':
        return this.randomSample(data, sampling.size);
      case 'stratified':
        // Would implement stratified sampling
        return data.slice(0, sampling.size);
      case 'time_based':
        // Would implement time-based sampling
        return data.slice(0, sampling.size);
      default:
        return data;
    }
  }

  private randomSample(data: any[], size: number): any[] {
    if (size >= data.length) return data;
    
    const shuffled = [...data].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, size);
  }

  private async preprocessTrainingData(
    rawData: any[],
    model: PredictiveModel
  ): Promise<{ features: number[][]; target: number[]; preprocessor: any }> {
    // Extract features and target
    const features: any[][] = [];
    const target: any[] = [];

    for (const row of rawData) {
      const featureRow: any[] = [];
      
      for (const feature of model.features) {
        const value = this.extractFeatureValue(row, feature);
        featureRow.push(value);
      }
      
      const targetValue = this.extractFeatureValue(row, model.target);
      
      features.push(featureRow);
      target.push(targetValue);
    }

    // Apply preprocessing
    const preprocessor = await this.buildPreprocessor(features, model.preprocessing);
    const processedFeatures = await this.applyPreprocessing(features, preprocessor);
    const processedTarget = await this.preprocessTarget(target, model.target);

    return {
      features: processedFeatures,
      target: processedTarget,
      preprocessor
    };
  }

  private extractFeatureValue(row: any, feature: FeatureDefinition | TargetDefinition): any {
    let value = this.getNestedValue(row, feature.source);
    
    // Apply feature transformation if specified
    if (feature.transformation) {
      value = this.applyFeatureTransformation(value, feature.transformation);
    }

    return value;
  }

  private applyFeatureTransformation(value: any, transformation: FeatureTransformation): any {
    switch (transformation.type) {
      case 'log':
        return value > 0 ? Math.log(value) : 0;
      case 'scale':
        // Would apply scaling transformation
        return value;
      case 'normalize':
        // Would apply normalization
        return value;
      default:
        return value;
    }
  }

  private async buildPreprocessor(features: any[][], config: PreprocessingConfig): Promise<any> {
    // Build preprocessing pipeline (simplified implementation)
    const preprocessor = {
      scalers: new Map(),
      encoders: new Map(),
      imputors: new Map(),
      statistics: new Map()
    };

    // Calculate statistics for each feature
    for (let i = 0; i < features[0].length; i++) {
      const column = features.map(row => row[i]).filter(val => val != null);
      
      if (column.length > 0) {
        const mean = column.reduce((sum, val) => sum + Number(val), 0) / column.length;
        const variance = column.reduce((sum, val) => sum + Math.pow(Number(val) - mean, 2), 0) / column.length;
        const std = Math.sqrt(variance);
        
        preprocessor.statistics.set(i, {
          mean,
          std,
          min: Math.min(...column.map(Number)),
          max: Math.max(...column.map(Number))
        });
      }
    }

    return preprocessor;
  }

  private async applyPreprocessing(features: any[][], preprocessor: any): Promise<number[][]> {
    const processed: number[][] = [];
    
    for (const row of features) {
      const processedRow: number[] = [];
      
      for (let i = 0; i < row.length; i++) {
        let value = Number(row[i]);
        
        // Handle missing values
        if (isNaN(value) || value == null) {
          const stats = preprocessor.statistics.get(i);
          value = stats ? stats.mean : 0;
        }
        
        // Apply scaling (standard scaling)
        const stats = preprocessor.statistics.get(i);
        if (stats && stats.std > 0) {
          value = (value - stats.mean) / stats.std;
        }
        
        processedRow.push(value);
      }
      
      processed.push(processedRow);
    }
    
    return processed;
  }

  private async preprocessTarget(target: any[], targetDef: TargetDefinition): Promise<number[]> {
    return target.map(val => {
      if (targetDef.type === 'categorical') {
        // Simple label encoding for categorical targets
        return typeof val === 'string' ? val.charCodeAt(0) % 10 : Number(val);
      }
      return Number(val) || 0;
    });
  }

  private async splitTrainingData(
    features: number[][],
    target: number[],
    config: TrainingConfig
  ): Promise<{
    trainX: number[][];
    trainY: number[];
    valX: number[][];
    valY: number[];
    testX: number[][];
    testY: number[];
  }> {
    const totalSize = features.length;
    const trainSize = Math.floor(totalSize * config.trainSize);
    const valSize = Math.floor(totalSize * config.validationSize);
    
    let indices = Array.from({ length: totalSize }, (_, i) => i);
    
    if (config.splitStrategy === 'random') {
      indices = indices.sort(() => 0.5 - Math.random());
    }
    // For time_based, we keep the original order
    
    const trainIndices = indices.slice(0, trainSize);
    const valIndices = indices.slice(trainSize, trainSize + valSize);
    const testIndices = indices.slice(trainSize + valSize);
    
    return {
      trainX: trainIndices.map(i => features[i]),
      trainY: trainIndices.map(i => target[i]),
      valX: valIndices.map(i => features[i]),
      valY: valIndices.map(i => target[i]),
      testX: testIndices.map(i => features[i]),
      testY: testIndices.map(i => target[i])
    };
  }

  private async trainModelAlgorithm(
    trainX: number[][],
    trainY: number[],
    valX: number[][],
    valY: number[],
    model: PredictiveModel
  ): Promise<any> {
    switch (model.algorithm.type) {
      case 'linear_regression':
        return this.trainLinearRegression(trainX, trainY, model.hyperparameters);
      case 'random_forest':
        return this.trainRandomForest(trainX, trainY, model.hyperparameters);
      case 'neural_network':
        return this.trainNeuralNetwork(trainX, trainY, valX, valY, model.hyperparameters);
      default:
        throw new Error(`Unsupported algorithm: ${model.algorithm.type}`);
    }
  }

  private trainLinearRegression(trainX: number[][], trainY: number[], hyperparams: any): any {
    // Simplified linear regression implementation
    if (trainX.length === 0 || trainX[0].length === 0) {
      throw new Error('No training data available');
    }

    const numFeatures = trainX[0].length;
    const weights = new Array(numFeatures + 1).fill(0); // +1 for bias

    // Simple gradient descent
    const learningRate = hyperparams.learningRate || 0.01;
    const epochs = hyperparams.epochs || 1000;

    for (let epoch = 0; epoch < epochs; epoch++) {
      const gradients = new Array(numFeatures + 1).fill(0);
      
      for (let i = 0; i < trainX.length; i++) {
        const prediction = this.predictLinearRegression(trainX[i], weights);
        const error = prediction - trainY[i];
        
        // Update gradients
        gradients[0] += error; // bias gradient
        for (let j = 0; j < numFeatures; j++) {
          gradients[j + 1] += error * trainX[i][j];
        }
      }
      
      // Update weights
      for (let j = 0; j < weights.length; j++) {
        weights[j] -= learningRate * gradients[j] / trainX.length;
      }
    }

    return {
      type: 'linear_regression',
      weights,
      predict: (features: number[]) => this.predictLinearRegression(features, weights)
    };
  }

  private predictLinearRegression(features: number[], weights: number[]): number {
    let prediction = weights[0]; // bias
    for (let i = 0; i < features.length; i++) {
      prediction += features[i] * weights[i + 1];
    }
    return prediction;
  }

  private trainRandomForest(trainX: number[][], trainY: number[], hyperparams: any): any {
    // Simplified random forest (single decision tree for demo)
    return {
      type: 'random_forest',
      trees: [], // Would contain trained decision trees
      predict: (features: number[]) => {
        // Simple prediction based on feature averages
        return trainY.reduce((sum, val) => sum + val, 0) / trainY.length;
      }
    };
  }

  private trainNeuralNetwork(
    trainX: number[][],
    trainY: number[],
    valX: number[][],
    valY: number[],
    hyperparams: any
  ): any {
    // Simplified neural network placeholder
    return {
      type: 'neural_network',
      layers: [], // Would contain neural network layers
      predict: (features: number[]) => {
        // Simple prediction
        return trainY.reduce((sum, val) => sum + val, 0) / trainY.length;
      }
    };
  }

  private async evaluateModel(
    trainedModel: any,
    trainX: number[][],
    trainY: number[],
    valX: number[][],
    valY: number[],
    testX: number[][],
    testY: number[],
    model: PredictiveModel
  ): Promise<ModelPerformance> {
    const performance: ModelPerformance = {
      training: {},
      validation: {},
      test: {}
    };

    // Evaluate on training set
    const trainPredictions = trainX.map(features => trainedModel.predict(features));
    performance.training = this.calculateMetrics(trainY, trainPredictions, model.type);

    // Evaluate on validation set
    if (valX.length > 0) {
      const valPredictions = valX.map(features => trainedModel.predict(features));
      performance.validation = this.calculateMetrics(valY, valPredictions, model.type);
    }

    // Evaluate on test set
    if (testX.length > 0) {
      const testPredictions = testX.map(features => trainedModel.predict(features));
      performance.test = this.calculateMetrics(testY, testPredictions, model.type);
    }

    return performance;
  }

  private calculateMetrics(actual: number[], predicted: number[], modelType: string): Record<string, number> {
    const metrics: Record<string, number> = {};

    if (modelType === 'regression') {
      // Mean Absolute Error
      metrics.mae = actual.reduce((sum, val, i) => sum + Math.abs(val - predicted[i]), 0) / actual.length;
      
      // Mean Squared Error
      metrics.mse = actual.reduce((sum, val, i) => sum + Math.pow(val - predicted[i], 2), 0) / actual.length;
      
      // Root Mean Squared Error
      metrics.rmse = Math.sqrt(metrics.mse);
      
      // R-squared
      const meanActual = actual.reduce((sum, val) => sum + val, 0) / actual.length;
      const ssTotal = actual.reduce((sum, val) => sum + Math.pow(val - meanActual, 2), 0);
      const ssResidual = actual.reduce((sum, val, i) => sum + Math.pow(val - predicted[i], 2), 0);
      metrics.r2 = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0;
    } else if (modelType === 'classification') {
      // Accuracy
      const correct = actual.filter((val, i) => Math.round(predicted[i]) === val).length;
      metrics.accuracy = correct / actual.length;
      
      // Would calculate precision, recall, F1, etc.
    }

    return metrics;
  }

  private async saveTrainedModel(
    modelId: string,
    trainedModel: any,
    preprocessor: any,
    performance: ModelPerformance
  ): Promise<void> {
    // Cache the trained model in memory
    this.modelCache.set(modelId, {
      model: trainedModel,
      preprocessor,
      performance,
      loadedAt: new Date()
    });

    // Save model artifacts to Redis
    await this.redis.hset(
      'ml:trained_models',
      modelId,
      JSON.stringify({
        model: trainedModel,
        preprocessor,
        performance,
        savedAt: new Date()
      })
    );

    this.logger.info(`Trained model saved: ${modelId}`);
  }

  async predict(request: PredictionRequest): Promise<PredictionResponse> {
    const startTime = Date.now();
    
    const model = await this.getModel(request.modelId);
    if (!model) {
      throw new Error(`Model not found: ${request.modelId}`);
    }

    if (model.status !== 'trained' && model.status !== 'deployed') {
      throw new Error(`Model not ready for predictions: ${model.status}`);
    }

    // Load trained model if not cached
    let trainedModel = this.modelCache.get(request.modelId);
    if (!trainedModel) {
      trainedModel = await this.loadTrainedModel(request.modelId);
    }

    // Preprocess features
    const features = await this.preprocessPredictionFeatures(request.features, model, trainedModel.preprocessor);
    
    // Make prediction
    const prediction = trainedModel.model.predict(features);
    
    // Calculate confidence (simplified)
    const confidence = this.calculatePredictionConfidence(prediction, model.type);
    
    const response: PredictionResponse = {
      modelId: request.modelId,
      prediction,
      confidence,
      metadata: {
        timestamp: new Date(),
        processingTime: Date.now() - startTime,
        modelVersion: model.version
      }
    };

    // Add probability for classification
    if (request.returnProbability && model.type === 'classification') {
      response.probability = [confidence, 1 - confidence]; // Simplified
    }

    // Add feature explanations
    if (request.returnExplanation) {
      response.explanation = await this.generateFeatureExplanations(
        request.features,
        model,
        prediction
      );
    }

    // Log prediction if monitoring is enabled
    if (model.monitoring.predictionMonitoring.enabled && model.monitoring.predictionMonitoring.logPredictions) {
      await this.logPrediction(response, request);
    }

    return response;
  }

  private async loadTrainedModel(modelId: string): Promise<any> {
    const cached = await this.redis.hget('ml:trained_models', modelId);
    if (!cached) {
      throw new Error(`Trained model not found: ${modelId}`);
    }

    const trainedModel = JSON.parse(cached);
    this.modelCache.set(modelId, trainedModel);
    
    return trainedModel;
  }

  private async preprocessPredictionFeatures(
    features: Record<string, any>,
    model: PredictiveModel,
    preprocessor: any
  ): Promise<number[]> {
    const processedFeatures: number[] = [];
    
    for (let i = 0; i < model.features.length; i++) {
      const feature = model.features[i];
      let value = features[feature.name];
      
      // Apply feature transformation
      if (feature.transformation) {
        value = this.applyFeatureTransformation(value, feature.transformation);
      }
      
      // Convert to number and handle missing values
      let numValue = Number(value);
      if (isNaN(numValue) || numValue == null) {
        const stats = preprocessor.statistics.get(i);
        numValue = stats ? stats.mean : 0;
      }
      
      // Apply scaling
      const stats = preprocessor.statistics.get(i);
      if (stats && stats.std > 0) {
        numValue = (numValue - stats.mean) / stats.std;
      }
      
      processedFeatures.push(numValue);
    }
    
    return processedFeatures;
  }

  private calculatePredictionConfidence(prediction: any, modelType: string): number {
    // Simplified confidence calculation
    if (modelType === 'classification') {
      return Math.abs(prediction - 0.5) * 2; // Distance from decision boundary
    } else {
      return 0.8; // Default confidence for regression
    }
  }

  private async generateFeatureExplanations(
    features: Record<string, any>,
    model: PredictiveModel,
    prediction: any
  ): Promise<FeatureExplanation[]> {
    const explanations: FeatureExplanation[] = [];
    
    for (const feature of model.features) {
      explanations.push({
        feature: feature.name,
        value: features[feature.name],
        contribution: Math.random() - 0.5, // Simplified SHAP-like contribution
        importance: feature.importance || 0.5
      });
    }
    
    return explanations.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  }

  private async logPrediction(response: PredictionResponse, request: PredictionRequest): Promise<void> {
    if (!this.db) return;

    await this.db.collection('model_predictions').insertOne({
      modelId: response.modelId,
      prediction: response.prediction,
      confidence: response.confidence,
      features: request.features,
      timestamp: response.metadata.timestamp,
      processingTime: response.metadata.processingTime,
      modelVersion: response.metadata.modelVersion
    });
  }

  async batchPredict(
    modelId: string,
    inputSource: any,
    outputDestination: any
  ): Promise<string> {
    const jobId = `batch_${modelId}_${Date.now()}`;
    const job: BatchPredictionJob = {
      id: jobId,
      modelId,
      status: 'pending',
      inputSource,
      outputDestination,
      startTime: new Date(),
      recordsProcessed: 0,
      recordsSuccessful: 0,
      recordsFailed: 0
    };

    this.batchJobs.set(jobId, job);
    await this.saveBatchJob(job);

    // Execute batch prediction asynchronously
    this.executeBatchPrediction(job);

    return jobId;
  }

  private async executeBatchPrediction(job: BatchPredictionJob): Promise<void> {
    try {
      job.status = 'running';
      await this.saveBatchJob(job);

      // Load input data
      const inputData = await this.loadBatchInputData(job.inputSource);
      job.recordsProcessed = inputData.length;

      // Make predictions
      const results = [];
      for (const record of inputData) {
        try {
          const prediction = await this.predict({
            modelId: job.modelId,
            features: record
          });
          
          results.push({
            ...record,
            prediction: prediction.prediction,
            confidence: prediction.confidence
          });
          
          job.recordsSuccessful++;
        } catch (error) {
          job.recordsFailed++;
          this.logger.error(`Batch prediction failed for record`, error);
        }
      }

      // Save results
      await this.saveBatchResults(job.outputDestination, results);

      job.status = 'completed';
      job.endTime = new Date();

      this.logger.info(`Batch prediction completed: ${job.id}`, {
        recordsProcessed: job.recordsProcessed,
        recordsSuccessful: job.recordsSuccessful,
        recordsFailed: job.recordsFailed
      });

    } catch (error) {
      job.status = 'failed';
      job.endTime = new Date();
      job.errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error(`Batch prediction failed: ${job.id}`, error);
    } finally {
      await this.saveBatchJob(job);
    }
  }

  private async loadBatchInputData(inputSource: any): Promise<any[]> {
    // Implementation would depend on input source type
    return [];
  }

  private async saveBatchResults(outputDestination: any, results: any[]): Promise<void> {
    // Implementation would depend on output destination type
    this.logger.info(`Saving ${results.length} batch prediction results`);
  }

  async getModel(modelId: string): Promise<PredictiveModel | null> {
    let model = this.models.get(modelId);
    
    if (!model) {
      const cached = await this.redis.hget('ml:models', modelId);
      if (cached) {
        model = JSON.parse(cached);
        this.models.set(modelId, model);
      }
    }

    if (!model && this.db) {
      const stored = await this.db.collection('predictive_models').findOne({ id: modelId });
      if (stored) {
        model = stored as PredictiveModel;
        this.models.set(modelId, model);
        await this.redis.hset('ml:models', modelId, JSON.stringify(model));
      }
    }

    return model || null;
  }

  private async updateModelStatus(modelId: string, status: PredictiveModel['status'], performance?: ModelPerformance): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const update: any = { status, updatedAt: new Date() };
    if (performance) {
      update.performance = performance;
      update.lastTrainedAt = new Date();
    }

    await this.db.collection('predictive_models').updateOne(
      { id: modelId },
      { $set: update }
    );

    // Update cache
    const model = await this.getModel(modelId);
    if (model) {
      Object.assign(model, update);
      this.models.set(modelId, model);
      await this.redis.hset('ml:models', modelId, JSON.stringify(model));
    }
  }

  private async saveTrainingJob(job: ModelTrainingJob): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.collection('model_training_jobs').replaceOne(
      { id: job.id },
      job,
      { upsert: true }
    );

    this.trainingJobs.set(job.id, job);
  }

  private async saveBatchJob(job: BatchPredictionJob): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.collection('batch_prediction_jobs').replaceOne(
      { id: job.id },
      job,
      { upsert: true }
    );

    this.batchJobs.set(job.id, job);
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private async loadModels(): Promise<void> {
    if (!this.db) return;

    const models = await this.db.collection('predictive_models').find({}).toArray();
    for (const model of models) {
      this.models.set(model.id, model as PredictiveModel);
    }
  }

  private async scheduleModelMonitoring(): Promise<void> {
    // Schedule periodic model monitoring tasks
    cron.schedule('0 */6 * * *', async () => { // Every 6 hours
      await this.monitorModelPerformance();
    });

    cron.schedule('0 2 * * *', async () => { // Daily at 2 AM
      await this.checkModelDrift();
    });
  }

  private async monitorModelPerformance(): Promise<void> {
    for (const model of this.models.values()) {
      if (model.status === 'deployed' && model.monitoring.performanceMonitoring.enabled) {
        try {
          await this.collectModelMetrics(model);
        } catch (error) {
          this.logger.error(`Model monitoring failed: ${model.id}`, error);
        }
      }
    }
  }

  private async checkModelDrift(): Promise<void> {
    for (const model of this.models.values()) {
      if (model.status === 'deployed' && model.monitoring.modelDrift.enabled) {
        try {
          await this.detectModelDrift(model);
        } catch (error) {
          this.logger.error(`Model drift detection failed: ${model.id}`, error);
        }
      }
    }
  }

  private async collectModelMetrics(model: PredictiveModel): Promise<void> {
    // Collect metrics from prediction logs
    this.logger.info(`Collecting metrics for model: ${model.id}`);
  }

  private async detectModelDrift(model: PredictiveModel): Promise<void> {
    // Check for data drift in model inputs
    this.logger.info(`Checking drift for model: ${model.id}`);
  }

  private async createDefaultModels(): Promise<void> {
    const defaultModels: Omit<PredictiveModel, 'createdAt' | 'updatedAt' | 'version' | 'performance'>[] = [
      {
        id: 'claim_approval_predictor',
        name: 'Claim Approval Predictor',
        description: 'Predicts the likelihood of claim approval based on claim characteristics',
        type: 'classification',
        algorithm: {
          type: 'random_forest',
          framework: 'scikit-learn',
          config: {
            n_estimators: 100,
            max_depth: 10,
            random_state: 42
          }
        },
        features: [
          {
            name: 'claim_amount',
            type: 'numeric',
            source: 'amount',
            isRequired: true,
            description: 'Claim amount in VND'
          },
          {
            name: 'claim_type',
            type: 'categorical',
            source: 'claimType',
            isRequired: true,
            description: 'Type of medical claim'
          },
          {
            name: 'patient_age',
            type: 'numeric',
            source: 'patient.age',
            isRequired: true,
            description: 'Patient age in years'
          },
          {
            name: 'hospital_rating',
            type: 'numeric',
            source: 'hospital.rating',
            isRequired: false,
            description: 'Hospital quality rating'
          }
        ],
        target: {
          name: 'approval_status',
          type: 'binary',
          source: 'status'
        },
        dataSource: {
          type: 'mongodb',
          connection: { collection: 'claims' },
          query: {
            status: { $in: ['approved', 'rejected'] }
          },
          timeRange: {
            start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
            end: new Date(),
            field: 'createdAt'
          }
        },
        preprocessing: {
          missingValues: {
            strategy: 'mean',
            threshold: 0.5
          },
          outliers: {
            detection: 'zscore',
            treatment: 'clip',
            threshold: 3
          },
          scaling: {
            method: 'standard',
            features: ['claim_amount', 'patient_age', 'hospital_rating']
          },
          encoding: {
            categorical: 'onehot',
            text: 'tfidf'
          },
          featureSelection: {
            method: 'correlation',
            threshold: 0.01
          }
        },
        training: {
          splitStrategy: 'stratified',
          trainSize: 0.7,
          validationSize: 0.15,
          testSize: 0.15,
          crossValidation: {
            enabled: true,
            folds: 5,
            strategy: 'stratified_kfold'
          }
        },
        validation: {
          metrics: ['accuracy', 'precision', 'recall', 'f1', 'auc'],
          thresholds: {
            accuracy: 0.8,
            f1: 0.75
          }
        },
        hyperparameters: {
          n_estimators: 100,
          max_depth: 10,
          min_samples_split: 5,
          random_state: 42
        },
        deployment: {
          environment: 'production',
          batchSize: 100,
          predictionInterval: 300,
          enableRealTime: true,
          enableBatch: true,
          autoRetrain: {
            enabled: true,
            schedule: '0 2 * * 0', // Weekly on Sunday at 2 AM
            performanceThreshold: 0.05,
            dataThreshold: 1000
          }
        },
        monitoring: {
          dataQuality: {
            enabled: true,
            checks: ['missing_values', 'outliers', 'drift'],
            thresholds: {
              missing_values: 0.1,
              outliers: 0.05,
              drift: 0.1
            }
          },
          modelDrift: {
            enabled: true,
            method: 'psi',
            threshold: 0.2,
            windowSize: 1000
          },
          performanceMonitoring: {
            enabled: true,
            metrics: ['accuracy', 'f1'],
            alertThresholds: {
              accuracy: 0.75,
              f1: 0.7
            }
          },
          predictionMonitoring: {
            enabled: true,
            logPredictions: true,
            sampleRate: 0.1
          }
        },
        status: 'draft',
        isActive: true,
        createdBy: 'system'
      }
    ];

    for (const model of defaultModels) {
      try {
        const existing = await this.getModel(model.id);
        if (!existing) {
          await this.createModel(model);
        }
      } catch (error) {
        this.logger.error(`Failed to create default model: ${model.name}`, error);
      }
    }
  }

  async listModels(type?: string, status?: string): Promise<PredictiveModel[]> {
    if (!this.db) throw new Error('Database not initialized');

    const filter: any = {};
    if (type) filter.type = type;
    if (status) filter.status = status;

    const models = await this.db.collection('predictive_models')
      .find(filter)
      .sort({ updatedAt: -1 })
      .toArray();

    return models as PredictiveModel[];
  }

  async getTrainingJob(jobId: string): Promise<ModelTrainingJob | null> {
    let job = this.trainingJobs.get(jobId);

    if (!job && this.db) {
      const stored = await this.db.collection('model_training_jobs').findOne({ id: jobId });
      if (stored) {
        job = stored as ModelTrainingJob;
        this.trainingJobs.set(jobId, job);
      }
    }

    return job || null;
  }

  async getBatchJob(jobId: string): Promise<BatchPredictionJob | null> {
    let job = this.batchJobs.get(jobId);

    if (!job && this.db) {
      const stored = await this.db.collection('batch_prediction_jobs').findOne({ id: jobId });
      if (stored) {
        job = stored as BatchPredictionJob;
        this.batchJobs.set(jobId, job);
      }
    }

    return job || null;
  }
}
