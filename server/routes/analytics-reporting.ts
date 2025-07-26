import { RequestHandler } from "express";
import { z } from "zod";
import { DataWarehouseService } from "../services/analytics-reporting-service/DataWarehouseService";
import { ETLPipelineService } from "../services/analytics-reporting-service/ETLPipelineService";
import { RealTimeAnalyticsService } from "../services/analytics-reporting-service/RealTimeAnalyticsService";
import { CustomReportGenerationService } from "../services/analytics-reporting-service/CustomReportGenerationService";
import { KPICalculationEngine } from "../services/analytics-reporting-service/KPICalculationEngine";
import { TrendAnalysisService } from "../services/analytics-reporting-service/TrendAnalysisService";
import { PredictiveAnalyticsService } from "../services/analytics-reporting-service/PredictiveAnalyticsService";
import { DataAggregationService } from "../services/analytics-reporting-service/DataAggregationService";
import { PerformanceBenchmarkingService } from "../services/analytics-reporting-service/PerformanceBenchmarkingService";
import { AutomatedReportingSystemService } from "../services/analytics-reporting-service/AutomatedReportingSystemService";
import { DataVisualizationAPIService } from "../services/analytics-reporting-service/DataVisualizationAPIService";
import { ReportSchedulingEngineService } from "../services/analytics-reporting-service/ReportSchedulingEngineService";
import { DataExportService } from "../services/analytics-reporting-service/DataExportService";
import { AnalyticsCachingLayerService } from "../services/analytics-reporting-service/AnalyticsCachingLayerService";
import { BusinessIntelligenceService } from "../services/analytics-reporting-service/BusinessIntelligenceService";
import { WebSocketService } from "../services/real-time/WebSocketService";

// Lazy-initialized services
let dataWarehouseService: DataWarehouseService | null = null;
let etlPipelineService: ETLPipelineService | null = null;
let realTimeAnalyticsService: RealTimeAnalyticsService | null = null;
let customReportService: CustomReportGenerationService | null = null;
let kpiCalculationEngine: KPICalculationEngine | null = null;
let trendAnalysisService: TrendAnalysisService | null = null;
let predictiveAnalyticsService: PredictiveAnalyticsService | null = null;
let dataAggregationService: DataAggregationService | null = null;
let performanceBenchmarkingService: PerformanceBenchmarkingService | null = null;
let automatedReportingSystemService: AutomatedReportingSystemService | null = null;
let dataVisualizationAPIService: DataVisualizationAPIService | null = null;
let reportSchedulingEngineService: ReportSchedulingEngineService | null = null;
let dataExportService: DataExportService | null = null;
let analyticsCachingLayerService: AnalyticsCachingLayerService | null = null;
let businessIntelligenceService: BusinessIntelligenceService | null = null;

let servicesInitialized = false;
let initializationError: string | null = null;

// Initialize services only when first needed
const initializeAnalyticsServices = async () => {
  if (servicesInitialized || initializationError) {
    return;
  }

  try {
    const wsService = new WebSocketService();

    dataWarehouseService = new DataWarehouseService({
      connectionString: process.env.MONGODB_CONNECTION_STRING || 'mongodb://localhost:27017',
      databaseName: process.env.DATABASE_NAME || 'healthcare_analytics',
      collections: {
        claims: 'claims',
        payments: 'payments',
        documents: 'documents',
        users: 'users',
        analytics: 'analytics_data',
        dimensions: 'dimensions',
        facts: 'fact_tables'
      },
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      }
    });

    etlPipelineService = new ETLPipelineService(
      process.env.MONGODB_CONNECTION_STRING || 'mongodb://localhost:27017',
      process.env.DATABASE_NAME || 'healthcare_analytics',
      {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      }
    );

    realTimeAnalyticsService = new RealTimeAnalyticsService(
      {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      },
      wsService
    );

    customReportService = new CustomReportGenerationService(
      process.env.MONGODB_CONNECTION_STRING || 'mongodb://localhost:27017',
      process.env.DATABASE_NAME || 'healthcare_analytics',
      {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      },
      {
        basePath: process.env.REPORTS_STORAGE_PATH || './storage/reports',
        maxFileSize: parseInt(process.env.MAX_REPORT_SIZE || '104857600'), // 100MB
        retentionDays: parseInt(process.env.REPORT_RETENTION_DAYS || '30')
      }
    );

    kpiCalculationEngine = new KPICalculationEngine(
      process.env.MONGODB_CONNECTION_STRING || 'mongodb://localhost:27017',
      process.env.DATABASE_NAME || 'healthcare_analytics',
      {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      }
    );

    trendAnalysisService = new TrendAnalysisService(
      process.env.MONGODB_CONNECTION_STRING || 'mongodb://localhost:27017',
      process.env.DATABASE_NAME || 'healthcare_analytics',
      {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      }
    );

    predictiveAnalyticsService = new PredictiveAnalyticsService(
      process.env.MONGODB_CONNECTION_STRING || 'mongodb://localhost:27017',
      process.env.DATABASE_NAME || 'healthcare_analytics',
      {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      }
    );

    dataAggregationService = new DataAggregationService(
      process.env.MONGODB_CONNECTION_STRING || 'mongodb://localhost:27017',
      process.env.DATABASE_NAME || 'healthcare_analytics',
      {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      }
    );

    // Initialize new analytics services
    performanceBenchmarkingService = new PerformanceBenchmarkingService();
    automatedReportingSystemService = new AutomatedReportingSystemService();
    dataVisualizationAPIService = new DataVisualizationAPIService();
    reportSchedulingEngineService = new ReportSchedulingEngineService();
    dataExportService = new DataExportService();
    analyticsCachingLayerService = new AnalyticsCachingLayerService();
    businessIntelligenceService = new BusinessIntelligenceService();

    await Promise.all([
      dataWarehouseService.initialize(),
      etlPipelineService.initialize(),
      realTimeAnalyticsService.initialize(),
      customReportService.initialize(),
      kpiCalculationEngine.initialize(),
      trendAnalysisService.initialize(),
      predictiveAnalyticsService.initialize(),
      dataAggregationService.initialize(),
      performanceBenchmarkingService.initialize(),
      automatedReportingSystemService.initialize(),
      dataVisualizationAPIService.initialize(),
      reportSchedulingEngineService.initialize(),
      dataExportService.initialize(),
      analyticsCachingLayerService.initialize(),
      businessIntelligenceService.initialize()
    ]);

    servicesInitialized = true;
    console.log('All analytics services initialized successfully');
  } catch (error) {
    initializationError = error instanceof Error ? error.message : String(error);
    console.warn('Analytics services initialization failed (Redis/MongoDB not available):', initializationError);
    console.log('Analytics endpoints will return error responses. Install Redis and MongoDB for full functionality.');
  }
};

// Helper function to ensure services are available
const ensureServiceAvailable = async <T>(service: T | null, serviceName: string): Promise<T> => {
  if (!servicesInitialized && !initializationError) {
    await initializeAnalyticsServices();
  }

  if (initializationError) {
    throw new Error(`Analytics services unavailable: ${initializationError}`);
  }

  if (!service) {
    throw new Error(`${serviceName} not initialized`);
  }

  return service;
};

// Validation schemas
const DimensionSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['date', 'category', 'numeric', 'text']),
  source: z.string(),
  field: z.string(),
  hierarchy: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional()
});

const FactTableSchema = z.object({
  id: z.string(),
  name: z.string(),
  source: z.string(),
  dimensions: z.array(z.string()),
  measures: z.array(z.string()),
  granularity: z.enum(['daily', 'hourly', 'monthly', 'yearly']),
  partitioning: z.enum(['date', 'category', 'hash'])
});

const ETLJobSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  source: z.object({
    type: z.enum(['mongodb', 'api', 'file', 'redis']),
    connectionString: z.string().optional(),
    collection: z.string().optional(),
    query: z.any().optional(),
    endpoint: z.string().optional(),
    filePath: z.string().optional(),
    key: z.string().optional()
  }),
  transformations: z.array(z.object({
    type: z.enum(['map', 'filter', 'aggregate', 'join', 'pivot', 'clean', 'validate']),
    config: z.any(),
    order: z.number()
  })),
  destination: z.object({
    type: z.enum(['mongodb', 'redis', 'file']),
    connectionString: z.string().optional(),
    collection: z.string().optional(),
    filePath: z.string().optional(),
    key: z.string().optional()
  }),
  schedule: z.string(),
  isActive: z.boolean(),
  metadata: z.record(z.any()).optional()
});

const ReportTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  type: z.enum(['dashboard', 'detailed', 'summary', 'comparative', 'trend']),
  category: z.enum(['claims', 'payments', 'documents', 'system', 'custom']),
  layout: z.any(),
  datasources: z.array(z.any()),
  visualizations: z.array(z.any()),
  parameters: z.array(z.any()),
  filters: z.array(z.any()),
  scheduling: z.any(),
  permissions: z.any(),
  metadata: z.record(z.any()).optional(),
  createdBy: z.string()
});

const KPIDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  category: z.enum(['financial', 'operational', 'quality', 'performance', 'compliance', 'custom']),
  type: z.enum(['simple', 'compound', 'ratio', 'percentage', 'trend', 'threshold']),
  formula: z.any(),
  target: z.object({
    value: z.number(),
    operator: z.enum(['>', '<', '>=', '<=', '=', 'between']),
    range: z.object({ min: z.number(), max: z.number() }).optional()
  }).optional(),
  dimensions: z.array(z.string()),
  timeGranularity: z.enum(['real-time', 'hourly', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly']),
  dataSource: z.any(),
  calculation: z.any(),
  alerts: z.array(z.any()),
  permissions: z.any(),
  metadata: z.record(z.any()).optional(),
  isActive: z.boolean(),
  createdBy: z.string()
});

const PredictiveModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  type: z.enum(['regression', 'classification', 'time_series', 'clustering', 'anomaly_detection']),
  algorithm: z.any(),
  features: z.array(z.any()),
  target: z.any(),
  dataSource: z.any(),
  preprocessing: z.any(),
  training: z.any(),
  validation: z.any(),
  hyperparameters: z.record(z.any()),
  deployment: z.any(),
  monitoring: z.any(),
  status: z.enum(['draft', 'training', 'trained', 'deployed', 'retired']),
  isActive: z.boolean(),
  createdBy: z.string()
});

// ===== DATA WAREHOUSE ENDPOINTS =====

export const createDimension: RequestHandler = async (req, res) => {
  try {
    const dimension = DimensionSchema.parse(req.body);
    const service = await ensureServiceAvailable(dataWarehouseService, 'DataWarehouseService');
    await service.saveDimensions([dimension]);
    res.json({ success: true, message: 'Dimension created successfully' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getDimensions: RequestHandler = async (req, res) => {
  try {
    const service = await ensureServiceAvailable(dataWarehouseService, 'DataWarehouseService');
    const dimensions = await service.getDimensions();
    res.json(dimensions);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const createFactTable: RequestHandler = async (req, res) => {
  try {
    const factTable = FactTableSchema.parse(req.body);
    await dataWarehouseService.saveFactTables([factTable]);
    res.json({ success: true, message: 'Fact table created successfully' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getFactTables: RequestHandler = async (req, res) => {
  try {
    const factTables = await dataWarehouseService.getFactTables();
    res.json(factTables);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getWarehouseMetrics: RequestHandler = async (req, res) => {
  try {
    const metrics = await dataWarehouseService.getWarehouseMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

// ===== ETL PIPELINE ENDPOINTS =====

export const createETLJob: RequestHandler = async (req, res) => {
  try {
    const job = ETLJobSchema.parse(req.body);
    await etlPipelineService.createJob(job);
    res.json({ success: true, message: 'ETL job created successfully' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const runETLJob: RequestHandler = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { manual = false } = req.body;
    const runId = await etlPipelineService.runJob(jobId, manual);
    res.json({ success: true, runId, message: 'ETL job started successfully' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getETLJobs: RequestHandler = async (req, res) => {
  try {
    const jobs = await etlPipelineService.listJobs();
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getETLJobMetrics: RequestHandler = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { limit = 10 } = req.query;
    const metrics = await etlPipelineService.getJobMetrics(jobId, parseInt(limit as string));
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

// ===== REAL-TIME ANALYTICS ENDPOINTS =====

export const createRealTimeMetric: RequestHandler = async (req, res) => {
  try {
    const { id, name, type, value = 0, dimensions = {}, metadata = {} } = req.body;
    await realTimeAnalyticsService.createMetric({ id, name, type, value, dimensions, metadata });
    res.json({ success: true, message: 'Real-time metric created successfully' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const updateRealTimeMetric: RequestHandler = async (req, res) => {
  try {
    const { metricId } = req.params;
    const { event, value, dimensions } = req.body;
    await realTimeAnalyticsService.updateMetric(metricId, {
      metricId,
      event,
      value,
      dimensions,
      timestamp: new Date()
    });
    res.json({ success: true, message: 'Real-time metric updated successfully' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getRealTimeMetrics: RequestHandler = async (req, res) => {
  try {
    const metrics = await realTimeAnalyticsService.getAllMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const createAlertRule: RequestHandler = async (req, res) => {
  try {
    const alertRule = req.body;
    await realTimeAnalyticsService.createAlertRule(alertRule);
    res.json({ success: true, message: 'Alert rule created successfully' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const createStreamConfig: RequestHandler = async (req, res) => {
  try {
    const streamConfig = req.body;
    await realTimeAnalyticsService.createStream(streamConfig);
    res.json({ success: true, message: 'Stream configuration created successfully' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

// ===== CUSTOM REPORTS ENDPOINTS =====

export const createReportTemplate: RequestHandler = async (req, res) => {
  try {
    const template = ReportTemplateSchema.parse(req.body);
    await customReportService.createTemplate(template);
    res.json({ success: true, message: 'Report template created successfully' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const executeReport: RequestHandler = async (req, res) => {
  try {
    const { templateId } = req.params;
    const { parameters = {}, format = 'pdf' } = req.body;
    const executionId = await customReportService.executeReport(
      templateId,
      parameters,
      format as any,
      req.user?.id || 'anonymous'
    );
    res.json({ success: true, executionId, message: 'Report execution started' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getReportExecution: RequestHandler = async (req, res) => {
  try {
    const { executionId } = req.params;
    const execution = await customReportService.getExecution(executionId);
    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }
    res.json(execution);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const downloadReport: RequestHandler = async (req, res) => {
  try {
    const { executionId } = req.params;
    const { filePath, fileName, mimeType } = await customReportService.downloadReport(executionId);
    
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', mimeType);
    
    // In a real implementation, you would stream the file
    res.json({ success: true, message: 'File ready for download', filePath });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const listReportTemplates: RequestHandler = async (req, res) => {
  try {
    const { category, type } = req.query;
    const templates = await customReportService.listTemplates(
      category as string,
      type as string
    );
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

// ===== KPI CALCULATION ENDPOINTS =====

export const createKPI: RequestHandler = async (req, res) => {
  try {
    const kpi = KPIDefinitionSchema.parse(req.body);
    await kpiCalculationEngine.createKPI(kpi);
    res.json({ success: true, message: 'KPI created successfully' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const calculateKPI: RequestHandler = async (req, res) => {
  try {
    const { kpiId } = req.params;
    const { manual = false } = req.body;
    const jobId = await kpiCalculationEngine.calculateKPI(kpiId, manual);
    res.json({ success: true, jobId, message: 'KPI calculation started' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getKPIValues: RequestHandler = async (req, res) => {
  try {
    const { kpiId } = req.params;
    const { startDate, endDate, limit = '100' } = req.query;
    
    const options: any = { limit: parseInt(limit as string) };
    if (startDate) options.startDate = new Date(startDate as string);
    if (endDate) options.endDate = new Date(endDate as string);
    
    const values = await kpiCalculationEngine.getKPIValues(kpiId, options);
    res.json(values);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getKPIComparison: RequestHandler = async (req, res) => {
  try {
    const { kpiId } = req.params;
    const { dimensions } = req.query;
    
    const comparison = await kpiCalculationEngine.getKPIComparison(
      kpiId,
      dimensions ? JSON.parse(dimensions as string) : undefined
    );
    res.json(comparison);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const listKPIs: RequestHandler = async (req, res) => {
  try {
    const { category, active } = req.query;
    const kpis = await kpiCalculationEngine.listKPIs(
      category as string,
      active ? active === 'true' : undefined
    );
    res.json(kpis);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

// ===== TREND ANALYSIS ENDPOINTS =====

export const createTrendAnalysis: RequestHandler = async (req, res) => {
  try {
    const config = req.body;
    await trendAnalysisService.createAnalysisConfig(config);
    res.json({ success: true, message: 'Trend analysis configuration created successfully' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const runTrendAnalysis: RequestHandler = async (req, res) => {
  try {
    const { configId } = req.params;
    const resultId = await trendAnalysisService.runTrendAnalysis(configId);
    res.json({ success: true, resultId, message: 'Trend analysis started' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getTrendAnalysisResult: RequestHandler = async (req, res) => {
  try {
    const { resultId } = req.params;
    const result = await trendAnalysisService.getAnalysisResult(resultId);
    if (!result) {
      return res.status(404).json({ error: 'Analysis result not found' });
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const listTrendAnalysisResults: RequestHandler = async (req, res) => {
  try {
    const { configId, limit = '10' } = req.query;
    const results = await trendAnalysisService.listAnalysisResults(
      configId as string,
      parseInt(limit as string)
    );
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

// ===== PREDICTIVE ANALYTICS ENDPOINTS =====

export const createPredictiveModel: RequestHandler = async (req, res) => {
  try {
    const model = PredictiveModelSchema.parse(req.body);
    await predictiveAnalyticsService.createModel(model);
    res.json({ success: true, message: 'Predictive model created successfully' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const trainPredictiveModel: RequestHandler = async (req, res) => {
  try {
    const { modelId } = req.params;
    const jobId = await predictiveAnalyticsService.trainModel(modelId);
    res.json({ success: true, jobId, message: 'Model training started' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const predictModel: RequestHandler = async (req, res) => {
  try {
    const { modelId } = req.params;
    const { features, returnProbability = false, returnExplanation = false } = req.body;
    
    const prediction = await predictiveAnalyticsService.predict({
      modelId,
      features,
      returnProbability,
      returnExplanation
    });
    
    res.json(prediction);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const batchPredict: RequestHandler = async (req, res) => {
  try {
    const { modelId } = req.params;
    const { inputSource, outputDestination } = req.body;
    
    const jobId = await predictiveAnalyticsService.batchPredict(
      modelId,
      inputSource,
      outputDestination
    );
    
    res.json({ success: true, jobId, message: 'Batch prediction started' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const listPredictiveModels: RequestHandler = async (req, res) => {
  try {
    const { type, status } = req.query;
    const models = await predictiveAnalyticsService.listModels(
      type as string,
      status as string
    );
    res.json(models);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getTrainingJob: RequestHandler = async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await predictiveAnalyticsService.getTrainingJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Training job not found' });
    }
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getBatchPredictionJob: RequestHandler = async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await predictiveAnalyticsService.getBatchJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Batch job not found' });
    }
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

// ===== DATA AGGREGATION ENDPOINTS =====

export const createAggregationRule: RequestHandler = async (req, res) => {
  try {
    const rule = req.body;
    await dataAggregationService.createAggregationRule(rule);
    res.json({ success: true, message: 'Aggregation rule created successfully' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const executeAggregation: RequestHandler = async (req, res) => {
  try {
    const { ruleId } = req.params;
    const { manual = false } = req.body;
    const jobId = await dataAggregationService.executeAggregation(ruleId, manual);
    res.json({ success: true, jobId, message: 'Aggregation started' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getAggregationResults: RequestHandler = async (req, res) => {
  try {
    const { ruleId } = req.params;
    const { startTime, endTime, limit = '100' } = req.query;
    
    const options: any = { limit: parseInt(limit as string) };
    if (startTime) options.startTime = new Date(startTime as string);
    if (endTime) options.endTime = new Date(endTime as string);
    
    const results = await dataAggregationService.getAggregationResults(ruleId, options);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const listAggregationRules: RequestHandler = async (req, res) => {
  try {
    const { active } = req.query;
    const rules = await dataAggregationService.listAggregationRules(
      active ? active === 'true' : undefined
    );
    res.json(rules);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getAggregationJob: RequestHandler = async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await dataAggregationService.getAggregationJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Aggregation job not found' });
    }
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

// ===== PERFORMANCE BENCHMARKING ENDPOINTS =====

export const createBenchmarkSuite: RequestHandler = async (req, res) => {
  try {
    const service = await ensureServiceAvailable(performanceBenchmarkingService, 'PerformanceBenchmarkingService');
    await service.createBenchmarkSuite(req.body);
    res.json({ success: true, message: 'Benchmark suite created successfully' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const runBenchmark: RequestHandler = async (req, res) => {
  try {
    const { suiteId } = req.params;
    const { triggeredBy = 'manual' } = req.body;
    const service = await ensureServiceAvailable(performanceBenchmarkingService, 'PerformanceBenchmarkingService');
    const runId = await service.runBenchmark(suiteId, 'manual', triggeredBy);
    res.json({ success: true, runId, message: 'Benchmark execution started' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getBenchmarkHistory: RequestHandler = async (req, res) => {
  try {
    const { suiteId } = req.params;
    const { limit = '50' } = req.query;
    const service = await ensureServiceAvailable(performanceBenchmarkingService, 'PerformanceBenchmarkingService');
    const history = await service.getBenchmarkHistory(suiteId, parseInt(limit as string));
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getPerformanceComparison: RequestHandler = async (req, res) => {
  try {
    const { suiteId, runId1, runId2 } = req.params;
    const service = await ensureServiceAvailable(performanceBenchmarkingService, 'PerformanceBenchmarkingService');
    const comparison = await service.getPerformanceComparison(suiteId, runId1, runId2);
    res.json(comparison);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getPerformanceAlerts: RequestHandler = async (req, res) => {
  try {
    const { suiteId, severity, acknowledged } = req.query;
    const filters: any = {};
    if (suiteId) filters.suiteId = suiteId as string;
    if (severity) filters.severity = severity as string;
    if (acknowledged !== undefined) filters.acknowledged = acknowledged === 'true';

    const service = await ensureServiceAvailable(performanceBenchmarkingService, 'PerformanceBenchmarkingService');
    const alerts = await service.getPerformanceAlerts(filters);
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const acknowledgeAlert: RequestHandler = async (req, res) => {
  try {
    const { alertId } = req.params;
    const { acknowledgedBy } = req.body;
    const service = await ensureServiceAvailable(performanceBenchmarkingService, 'PerformanceBenchmarkingService');
    await service.acknowledgeAlert(alertId, acknowledgedBy);
    res.json({ success: true, message: 'Alert acknowledged successfully' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

// ===== AUTOMATED REPORTING SYSTEM ENDPOINTS =====

export const createAutomatedReportTemplate: RequestHandler = async (req, res) => {
  try {
    const service = await ensureServiceAvailable(automatedReportingSystemService, 'AutomatedReportingSystemService');
    await service.createReportTemplate(req.body);
    res.json({ success: true, message: 'Automated report template created successfully' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const createReportSchedule: RequestHandler = async (req, res) => {
  try {
    const service = await ensureServiceAvailable(automatedReportingSystemService, 'AutomatedReportingSystemService');
    await service.createReportSchedule(req.body);
    res.json({ success: true, message: 'Report schedule created successfully' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const executeAutomatedReport: RequestHandler = async (req, res) => {
  try {
    const { templateId } = req.params;
    const { parameters = {}, filters = {}, triggeredBy = 'manual', priority = 'normal' } = req.body;
    const service = await ensureServiceAvailable(automatedReportingSystemService, 'AutomatedReportingSystemService');
    const queueId = await service.executeReport(templateId, parameters, filters, triggeredBy, priority);
    res.json({ success: true, queueId, message: 'Report execution queued' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getReportTemplates: RequestHandler = async (req, res) => {
  try {
    const { category, createdBy } = req.query;
    const filters: any = {};
    if (category) filters.category = category as string;
    if (createdBy) filters.createdBy = createdBy as string;

    const service = await ensureServiceAvailable(automatedReportingSystemService, 'AutomatedReportingSystemService');
    const templates = await service.getReportTemplates(filters);
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getReportExecutions: RequestHandler = async (req, res) => {
  try {
    const { templateId, status, startDate, endDate } = req.query;
    const filters: any = {};
    if (templateId) filters.templateId = templateId as string;
    if (status) filters.status = status as string;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const service = await ensureServiceAvailable(automatedReportingSystemService, 'AutomatedReportingSystemService');
    const executions = await service.getReportExecutions(filters);
    res.json(executions);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getReportAnalytics: RequestHandler = async (req, res) => {
  try {
    const { templateId } = req.params;
    const { startDate, endDate } = req.query;
    const service = await ensureServiceAvailable(automatedReportingSystemService, 'AutomatedReportingSystemService');
    const analytics = await service.getReportAnalytics(
      templateId,
      new Date(startDate as string),
      new Date(endDate as string)
    );
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const cancelReportExecution: RequestHandler = async (req, res) => {
  try {
    const { executionId } = req.params;
    const service = await ensureServiceAvailable(automatedReportingSystemService, 'AutomatedReportingSystemService');
    await service.cancelExecution(executionId);
    res.json({ success: true, message: 'Report execution cancelled' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

// ===== DATA VISUALIZATION API ENDPOINTS =====

export const createVisualizationConfig: RequestHandler = async (req, res) => {
  try {
    const service = await ensureServiceAvailable(dataVisualizationAPIService, 'DataVisualizationAPIService');
    const configId = await service.createVisualizationConfig(req.body);
    res.json({ success: true, configId, message: 'Visualization configuration created successfully' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const generateVisualization: RequestHandler = async (req, res) => {
  try {
    const { configId } = req.params;
    const { filters } = req.body;
    const service = await ensureServiceAvailable(dataVisualizationAPIService, 'DataVisualizationAPIService');
    const visualization = await service.generateVisualization(configId, filters);
    res.json(visualization);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getVisualizationTemplates: RequestHandler = async (req, res) => {
  try {
    const { category } = req.query;
    const service = await ensureServiceAvailable(dataVisualizationAPIService, 'DataVisualizationAPIService');
    const templates = await service.getVisualizationTemplates(category as string);
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const exportVisualization: RequestHandler = async (req, res) => {
  try {
    const { configId } = req.params;
    const { format, options = {} } = req.body;
    const service = await ensureServiceAvailable(dataVisualizationAPIService, 'DataVisualizationAPIService');
    const exportId = await service.exportVisualization(configId, format, options);
    res.json({ success: true, exportId, message: 'Visualization export started' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getVisualizationConfigs: RequestHandler = async (req, res) => {
  try {
    const { type, createdBy, tags } = req.query;
    const filters: any = {};
    if (type) filters.type = type as string;
    if (createdBy) filters.createdBy = createdBy as string;
    if (tags) filters.tags = (tags as string).split(',');

    const service = await ensureServiceAvailable(dataVisualizationAPIService, 'DataVisualizationAPIService');
    const configs = await service.getVisualizationConfigs(filters);
    res.json(configs);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getVisualizationData: RequestHandler = async (req, res) => {
  try {
    const { dataId } = req.params;
    const service = await ensureServiceAvailable(dataVisualizationAPIService, 'DataVisualizationAPIService');
    const data = await service.getVisualizationData(dataId);
    if (!data) {
      return res.status(404).json({ error: 'Visualization data not found' });
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const deleteVisualizationConfig: RequestHandler = async (req, res) => {
  try {
    const { configId } = req.params;
    const service = await ensureServiceAvailable(dataVisualizationAPIService, 'DataVisualizationAPIService');
    await service.deleteVisualizationConfig(configId);
    res.json({ success: true, message: 'Visualization configuration deleted' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

// ===== REPORT SCHEDULING ENGINE ENDPOINTS =====

export const createScheduledReport: RequestHandler = async (req, res) => {
  try {
    const service = await ensureServiceAvailable(reportSchedulingEngineService, 'ReportSchedulingEngineService');
    const scheduleId = await service.createScheduledReport(req.body);
    res.json({ success: true, scheduleId, message: 'Scheduled report created successfully' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const triggerScheduledReport: RequestHandler = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const { triggeredBy = 'manual' } = req.body;
    const service = await ensureServiceAvailable(reportSchedulingEngineService, 'ReportSchedulingEngineService');
    const executionId = await service.triggerScheduledReport(scheduleId, 'manual', triggeredBy);
    res.json({ success: true, executionId, message: 'Scheduled report triggered' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getScheduledReports: RequestHandler = async (req, res) => {
  try {
    const { status, category, createdBy } = req.query;
    const filters: any = {};
    if (status) filters.status = status as string;
    if (category) filters.category = category as string;
    if (createdBy) filters.createdBy = createdBy as string;

    const service = await ensureServiceAvailable(reportSchedulingEngineService, 'ReportSchedulingEngineService');
    const schedules = await service.getScheduledReports(filters);
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getScheduleExecutions: RequestHandler = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const { limit = '50' } = req.query;
    const service = await ensureServiceAvailable(reportSchedulingEngineService, 'ReportSchedulingEngineService');
    const executions = await service.getScheduleExecutions(scheduleId, parseInt(limit as string));
    res.json(executions);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getScheduleAnalytics: RequestHandler = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const { startDate, endDate } = req.query;
    const service = await ensureServiceAvailable(reportSchedulingEngineService, 'ReportSchedulingEngineService');
    const analytics = await service.getScheduleAnalytics(
      scheduleId,
      new Date(startDate as string),
      new Date(endDate as string)
    );
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const pauseSchedule: RequestHandler = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const service = await ensureServiceAvailable(reportSchedulingEngineService, 'ReportSchedulingEngineService');
    await service.pauseSchedule(scheduleId);
    res.json({ success: true, message: 'Schedule paused' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const resumeSchedule: RequestHandler = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const service = await ensureServiceAvailable(reportSchedulingEngineService, 'ReportSchedulingEngineService');
    await service.resumeSchedule(scheduleId);
    res.json({ success: true, message: 'Schedule resumed' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const cancelScheduleExecution: RequestHandler = async (req, res) => {
  try {
    const { executionId } = req.params;
    const service = await ensureServiceAvailable(reportSchedulingEngineService, 'ReportSchedulingEngineService');
    await service.cancelExecution(executionId);
    res.json({ success: true, message: 'Schedule execution cancelled' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

// ===== DATA EXPORT ENDPOINTS =====

export const createExportConfiguration: RequestHandler = async (req, res) => {
  try {
    const service = await ensureServiceAvailable(dataExportService, 'DataExportService');
    const configId = await service.createExportConfiguration(req.body);
    res.json({ success: true, configId, message: 'Export configuration created successfully' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const executeExport: RequestHandler = async (req, res) => {
  try {
    const { configId } = req.params;
    const { parameters = {}, triggeredBy = 'manual' } = req.body;
    const service = await ensureServiceAvailable(dataExportService, 'DataExportService');
    const jobId = await service.executeExport(configId, parameters, triggeredBy);
    res.json({ success: true, jobId, message: 'Export job started' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getExportConfigurations: RequestHandler = async (req, res) => {
  try {
    const { category, format, createdBy } = req.query;
    const filters: any = {};
    if (category) filters.category = category as string;
    if (format) filters.format = format as string;
    if (createdBy) filters.createdBy = createdBy as string;

    const service = await ensureServiceAvailable(dataExportService, 'DataExportService');
    const configs = await service.getExportConfigurations(filters);
    res.json(configs);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getExportJob: RequestHandler = async (req, res) => {
  try {
    const { jobId } = req.params;
    const service = await ensureServiceAvailable(dataExportService, 'DataExportService');
    const job = await service.getExportJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Export job not found' });
    }
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getExportJobs: RequestHandler = async (req, res) => {
  try {
    const { configId, status, triggeredBy, startDate, endDate, limit = '50' } = req.query;
    const filters: any = {};
    if (configId) filters.configId = configId as string;
    if (status) filters.status = status as string;
    if (triggeredBy) filters.triggeredBy = triggeredBy as string;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const service = await ensureServiceAvailable(dataExportService, 'DataExportService');
    const jobs = await service.getExportJobs(filters, parseInt(limit as string));
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const cancelExportJob: RequestHandler = async (req, res) => {
  try {
    const { jobId } = req.params;
    const service = await ensureServiceAvailable(dataExportService, 'DataExportService');
    await service.cancelExportJob(jobId);
    res.json({ success: true, message: 'Export job cancelled' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getExportTemplates: RequestHandler = async (req, res) => {
  try {
    const { category } = req.query;
    const service = await ensureServiceAvailable(dataExportService, 'DataExportService');
    const templates = await service.getExportTemplates(category as string);
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const generateDataProfile: RequestHandler = async (req, res) => {
  try {
    const service = await ensureServiceAvailable(dataExportService, 'DataExportService');
    const profile = await service.generateDataProfile(req.body);
    res.json(profile);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

// ===== ANALYTICS CACHING LAYER ENDPOINTS =====

export const createCacheConfiguration: RequestHandler = async (req, res) => {
  try {
    const service = await ensureServiceAvailable(analyticsCachingLayerService, 'AnalyticsCachingLayerService');
    const configId = await service.createCacheConfiguration(req.body);
    res.json({ success: true, configId, message: 'Cache configuration created successfully' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getCacheValue: RequestHandler = async (req, res) => {
  try {
    const { configId, key } = req.params;
    const { consistency, timeout } = req.query;
    const options: any = {};
    if (consistency) options.consistency = consistency as string;
    if (timeout) options.timeout = parseInt(timeout as string);

    const service = await ensureServiceAvailable(analyticsCachingLayerService, 'AnalyticsCachingLayerService');
    const value = await service.get(configId, key, options);
    res.json({ value, hit: value !== null });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const setCacheValue: RequestHandler = async (req, res) => {
  try {
    const { configId, key } = req.params;
    const { value, ttl, tags, metadata, compress, encrypt } = req.body;
    const options: any = {};
    if (ttl) options.ttl = ttl;
    if (tags) options.tags = tags;
    if (metadata) options.metadata = metadata;
    if (compress !== undefined) options.compress = compress;
    if (encrypt !== undefined) options.encrypt = encrypt;

    const service = await ensureServiceAvailable(analyticsCachingLayerService, 'AnalyticsCachingLayerService');
    await service.set(configId, key, value, options);
    res.json({ success: true, message: 'Value cached successfully' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const deleteCacheValue: RequestHandler = async (req, res) => {
  try {
    const { configId, key } = req.params;
    const service = await ensureServiceAvailable(analyticsCachingLayerService, 'AnalyticsCachingLayerService');
    await service.delete(configId, key);
    res.json({ success: true, message: 'Value deleted from cache' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const invalidateCache: RequestHandler = async (req, res) => {
  try {
    const { configId } = req.params;
    const { pattern } = req.body;
    const service = await ensureServiceAvailable(analyticsCachingLayerService, 'AnalyticsCachingLayerService');
    const count = await service.invalidate(configId, pattern);
    res.json({ success: true, invalidated: count, message: `Invalidated ${count} cache entries` });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const refreshCacheValue: RequestHandler = async (req, res) => {
  try {
    const { configId, key } = req.params;
    const { loader } = req.body;
    const service = await ensureServiceAvailable(analyticsCachingLayerService, 'AnalyticsCachingLayerService');
    const value = await service.refresh(configId, key, loader);
    res.json({ success: true, value, message: 'Cache value refreshed' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const queryCacheValues: RequestHandler = async (req, res) => {
  try {
    const { configId } = req.params;
    const service = await ensureServiceAvailable(analyticsCachingLayerService, 'AnalyticsCachingLayerService');
    const results = await service.query(configId, req.body);
    res.json(results);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const preloadCache: RequestHandler = async (req, res) => {
  try {
    const { configId } = req.params;
    const { keys, loader } = req.body;
    const service = await ensureServiceAvailable(analyticsCachingLayerService, 'AnalyticsCachingLayerService');
    const loaded = await service.preload(configId, keys, loader);
    res.json({ success: true, loaded, message: `Preloaded ${loaded} cache entries` });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const warmupCache: RequestHandler = async (req, res) => {
  try {
    const { configId } = req.params;
    const service = await ensureServiceAvailable(analyticsCachingLayerService, 'AnalyticsCachingLayerService');
    await service.warmup(configId);
    res.json({ success: true, message: 'Cache warmup completed' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getCacheConfigurations: RequestHandler = async (req, res) => {
  try {
    const { category, strategy, isActive } = req.query;
    const filters: any = {};
    if (category) filters.category = category as string;
    if (strategy) filters.strategy = strategy as string;
    if (isActive !== undefined) filters.isActive = isActive === 'true';

    const service = await ensureServiceAvailable(analyticsCachingLayerService, 'AnalyticsCachingLayerService');
    const configs = await service.getCacheConfigurations(filters);
    res.json(configs);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getCacheStatistics: RequestHandler = async (req, res) => {
  try {
    const { configId } = req.params;
    const { startDate, endDate } = req.query;
    const service = await ensureServiceAvailable(analyticsCachingLayerService, 'AnalyticsCachingLayerService');
    const stats = await service.getCacheStatistics(
      configId,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getCacheOptimizations: RequestHandler = async (req, res) => {
  try {
    const { configId } = req.params;
    const service = await ensureServiceAvailable(analyticsCachingLayerService, 'AnalyticsCachingLayerService');
    const optimizations = await service.getCacheOptimizations(configId);
    res.json(optimizations);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const flushCache: RequestHandler = async (req, res) => {
  try {
    const { configId } = req.params;
    const service = await ensureServiceAvailable(analyticsCachingLayerService, 'AnalyticsCachingLayerService');
    await service.flushCache(configId);
    res.json({ success: true, message: 'Cache flushed successfully' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const pauseCache: RequestHandler = async (req, res) => {
  try {
    const { configId } = req.params;
    const service = await ensureServiceAvailable(analyticsCachingLayerService, 'AnalyticsCachingLayerService');
    await service.pauseCache(configId);
    res.json({ success: true, message: 'Cache paused successfully' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const resumeCache: RequestHandler = async (req, res) => {
  try {
    const { configId } = req.params;
    const service = await ensureServiceAvailable(analyticsCachingLayerService, 'AnalyticsCachingLayerService');
    await service.resumeCache(configId);
    res.json({ success: true, message: 'Cache resumed successfully' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

// ===== BUSINESS INTELLIGENCE ENDPOINTS =====

export const createBIDashboard: RequestHandler = async (req, res) => {
  try {
    const service = await ensureServiceAvailable(businessIntelligenceService, 'BusinessIntelligenceService');
    const dashboardId = await service.createDashboard(req.body);
    res.json({ success: true, dashboardId, message: 'BI dashboard created successfully' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getBIDashboard: RequestHandler = async (req, res) => {
  try {
    const { dashboardId } = req.params;
    const userId = req.user?.id;
    const service = await ensureServiceAvailable(businessIntelligenceService, 'BusinessIntelligenceService');
    const dashboard = await service.getDashboard(dashboardId, userId);
    if (!dashboard) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }
    res.json(dashboard);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getBIDashboardData: RequestHandler = async (req, res) => {
  try {
    const { dashboardId } = req.params;
    const { filters } = req.body;
    const service = await ensureServiceAvailable(businessIntelligenceService, 'BusinessIntelligenceService');
    const data = await service.getDashboardData(dashboardId, filters);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const createBIAnalysis: RequestHandler = async (req, res) => {
  try {
    const service = await ensureServiceAvailable(businessIntelligenceService, 'BusinessIntelligenceService');
    const analysisId = await service.createAnalysis(req.body);
    res.json({ success: true, analysisId, message: 'BI analysis created successfully' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const executeBIAnalysis: RequestHandler = async (req, res) => {
  try {
    const { analysisId } = req.params;
    const { parameters } = req.body;
    const service = await ensureServiceAvailable(businessIntelligenceService, 'BusinessIntelligenceService');
    const result = await service.executeAnalysis(analysisId, parameters);
    res.json({ success: true, result, message: 'BI analysis executed successfully' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getBIDashboards: RequestHandler = async (req, res) => {
  try {
    const { category, createdBy, isPublic } = req.query;
    const filters: any = {};
    if (category) filters.category = category as string;
    if (createdBy) filters.createdBy = createdBy as string;
    if (isPublic !== undefined) filters.isPublic = isPublic === 'true';

    const service = await ensureServiceAvailable(businessIntelligenceService, 'BusinessIntelligenceService');
    const dashboards = await service.getDashboards(filters);
    res.json(dashboards);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getBIAnalyses: RequestHandler = async (req, res) => {
  try {
    const { type, isActive } = req.query;
    const filters: any = {};
    if (type) filters.type = type as string;
    if (isActive !== undefined) filters.isActive = isActive === 'true';

    const service = await ensureServiceAvailable(businessIntelligenceService, 'BusinessIntelligenceService');
    const analyses = await service.getAnalyses(filters);
    res.json(analyses);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getBIInsights: RequestHandler = async (req, res) => {
  try {
    const { type, priority, acknowledged, limit = '50' } = req.query;
    const filters: any = {};
    if (type) filters.type = type as string;
    if (priority) filters.priority = priority as string;
    if (acknowledged !== undefined) filters.acknowledged = acknowledged === 'true';

    const service = await ensureServiceAvailable(businessIntelligenceService, 'BusinessIntelligenceService');
    const insights = await service.getInsights(filters, parseInt(limit as string));
    res.json(insights);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const acknowledgeBIInsight: RequestHandler = async (req, res) => {
  try {
    const { insightId } = req.params;
    const { userId, action } = req.body;
    const service = await ensureServiceAvailable(businessIntelligenceService, 'BusinessIntelligenceService');
    await service.acknowledgeInsight(insightId, userId, action);
    res.json({ success: true, message: 'Insight acknowledged successfully' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const deleteBIDashboard: RequestHandler = async (req, res) => {
  try {
    const { dashboardId } = req.params;
    const service = await ensureServiceAvailable(businessIntelligenceService, 'BusinessIntelligenceService');
    await service.deleteDashboard(dashboardId);
    res.json({ success: true, message: 'BI dashboard deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const deleteBIAnalysis: RequestHandler = async (req, res) => {
  try {
    const { analysisId } = req.params;
    const service = await ensureServiceAvailable(businessIntelligenceService, 'BusinessIntelligenceService');
    await service.deleteAnalysis(analysisId);
    res.json({ success: true, message: 'BI analysis deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

// ===== ANALYTICS DASHBOARD ENDPOINTS =====

export const getAnalyticsDashboard: RequestHandler = async (req, res) => {
  try {
    const dashboard = {
      timestamp: new Date(),
      dataWarehouse: {
        dimensions: await dataWarehouseService.getDimensions(),
        factTables: await dataWarehouseService.getFactTables(),
        metrics: await dataWarehouseService.getWarehouseMetrics()
      },
      realTimeMetrics: await realTimeAnalyticsService.getAllMetrics(),
      kpis: await kpiCalculationEngine.listKPIs(undefined, true),
      etlJobs: await etlPipelineService.listJobs(),
      aggregationRules: await dataAggregationService.listAggregationRules(true)
    };
    
    res.json(dashboard);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getSystemHealth: RequestHandler = async (req, res) => {
  try {
    let metrics = null;
    let serviceStatus = 'unavailable';

    if (!initializationError) {
      try {
        await initializeAnalyticsServices();
        if (servicesInitialized && dataWarehouseService) {
          metrics = await dataWarehouseService.getWarehouseMetrics();
          serviceStatus = 'operational';
        }
      } catch (error) {
        serviceStatus = 'error';
      }
    }

    const health = {
      timestamp: new Date(),
      status: servicesInitialized ? 'healthy' : 'degraded',
      services: {
        dataWarehouse: serviceStatus,
        etlPipeline: serviceStatus,
        realTimeAnalytics: serviceStatus,
        reportGeneration: serviceStatus,
        kpiCalculation: serviceStatus,
        trendAnalysis: serviceStatus,
        predictiveAnalytics: serviceStatus,
        dataAggregation: serviceStatus,
        performanceBenchmarking: serviceStatus,
        automatedReporting: serviceStatus,
        dataVisualization: serviceStatus,
        reportScheduling: serviceStatus,
        dataExport: serviceStatus,
        analyticsCaching: serviceStatus,
        businessIntelligence: serviceStatus
      },
      message: initializationError || (servicesInitialized ? 'All services operational' : 'Services not yet initialized'),
      requirements: servicesInitialized ? null : 'Requires Redis and MongoDB to be available',
      metrics
    };

    res.json(health);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 'unhealthy',
      timestamp: new Date()
    });
  }
};
