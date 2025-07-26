import { Db, MongoClient } from 'mongodb';
import { EventEmitter } from 'events';
import * as winston from 'winston';
import IORedis from 'ioredis';

export interface ExportConfiguration {
  id: string;
  name: string;
  description: string;
  dataSource: DataSourceConfig;
  format: ExportFormat;
  transformation: TransformationConfig;
  compression: CompressionConfig;
  encryption: EncryptionConfig;
  destination: DestinationConfig[];
  schedule?: ScheduleConfig;
  filters: ExportFilter[];
  options: ExportOptions;
  metadata: ExportMetadata;
  permissions: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface DataSourceConfig {
  type: 'mongodb' | 'sql' | 'api' | 'file' | 'warehouse' | 'stream';
  connectionString: string;
  query: string;
  parameters: Record<string, any>;
  pagination: PaginationConfig;
  incremental: IncrementalConfig;
  validation: ValidationConfig;
}

export interface PaginationConfig {
  enabled: boolean;
  pageSize: number;
  maxPages?: number;
  strategy: 'offset' | 'cursor' | 'timestamp';
}

export interface IncrementalConfig {
  enabled: boolean;
  field: string;
  strategy: 'timestamp' | 'sequence' | 'checksum';
  lastValue?: any;
}

export interface ValidationConfig {
  enabled: boolean;
  rules: ValidationRule[];
  onError: 'skip' | 'fail' | 'log';
}

export interface ValidationRule {
  field: string;
  type: 'required' | 'type' | 'range' | 'pattern' | 'custom';
  condition: any;
  message: string;
}

export interface ExportFormat {
  type: 'csv' | 'excel' | 'json' | 'xml' | 'parquet' | 'avro' | 'pdf' | 'sql' | 'delimited';
  options: FormatOptions;
  schema?: SchemaDefinition;
  template?: string;
}

export interface FormatOptions {
  delimiter?: string;
  quote?: string;
  escape?: string;
  encoding?: string;
  headers?: boolean;
  dateFormat?: string;
  nullValue?: string;
  booleanFormat?: { true: string; false: string };
  precision?: number;
  arrayFormat?: 'json' | 'delimited' | 'separate_columns';
  objectFormat?: 'json' | 'flatten' | 'nested';
}

export interface SchemaDefinition {
  fields: SchemaField[];
  metadata?: Record<string, any>;
  version?: string;
}

export interface SchemaField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  required: boolean;
  nullable: boolean;
  defaultValue?: any;
  description?: string;
  constraints?: FieldConstraints;
}

export interface FieldConstraints {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
  enum?: any[];
}

export interface TransformationConfig {
  enabled: boolean;
  steps: TransformationStep[];
  mapping: FieldMapping[];
  aggregations: AggregationStep[];
  postProcessing: PostProcessingStep[];
}

export interface TransformationStep {
  type: 'filter' | 'map' | 'reduce' | 'sort' | 'group' | 'join' | 'pivot' | 'unpivot';
  configuration: Record<string, any>;
  order: number;
  condition?: string;
}

export interface FieldMapping {
  source: string;
  target: string;
  transformation?: string;
  defaultValue?: any;
}

export interface AggregationStep {
  groupBy: string[];
  aggregations: {
    field: string;
    function: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'distinct' | 'first' | 'last';
    alias: string;
  }[];
}

export interface PostProcessingStep {
  type: 'sort' | 'limit' | 'deduplicate' | 'validate' | 'enrich';
  configuration: Record<string, any>;
}

export interface CompressionConfig {
  enabled: boolean;
  algorithm: 'gzip' | 'zip' | 'bzip2' | 'lz4' | 'zstd';
  level: number;
  splitSize?: number;
}

export interface EncryptionConfig {
  enabled: boolean;
  algorithm: 'aes-256-gcm' | 'chacha20-poly1305' | 'rsa-oaep';
  keyId: string;
  keyRotation: boolean;
}

export interface DestinationConfig {
  type: 'file' | 's3' | 'azure' | 'gcp' | 'ftp' | 'sftp' | 'database' | 'api' | 'email';
  path: string;
  credentials: Record<string, string>;
  options: DestinationOptions;
  retryPolicy: RetryPolicy;
}

export interface DestinationOptions {
  overwrite?: boolean;
  createDirectories?: boolean;
  permissions?: string;
  metadata?: Record<string, string>;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface RetryPolicy {
  enabled: boolean;
  maxAttempts: number;
  backoffStrategy: 'linear' | 'exponential' | 'fixed';
  initialDelay: number;
  maxDelay: number;
}

export interface ScheduleConfig {
  enabled: boolean;
  cronExpression: string;
  timezone: string;
  startDate?: Date;
  endDate?: Date;
}

export interface ExportFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains' | 'regex';
  value: any;
  dynamic?: boolean;
}

export interface ExportOptions {
  maxRecords?: number;
  timeout?: number;
  parallel?: boolean;
  parallelism?: number;
  streaming?: boolean;
  bufferSize?: number;
  checksum?: boolean;
  notification: NotificationConfig;
  monitoring: MonitoringConfig;
}

export interface NotificationConfig {
  onStart: boolean;
  onComplete: boolean;
  onError: boolean;
  channels: string[];
  recipients: string[];
  template: string;
}

export interface MonitoringConfig {
  enabled: boolean;
  metrics: string[];
  alerts: AlertConfig[];
}

export interface AlertConfig {
  condition: string;
  threshold: number;
  action: 'email' | 'webhook' | 'slack';
  recipients: string[];
}

export interface ExportMetadata {
  tags: string[];
  category: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  cost?: number;
  sla?: {
    maxDuration: number;
    maxSize: number;
  };
}

export interface ExportJob {
  id: string;
  configId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';
  progress: ExportProgress;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  triggeredBy: string;
  triggerType: 'manual' | 'scheduled' | 'api';
  parameters: Record<string, any>;
  outputs: ExportOutput[];
  errors: ExportError[];
  metrics: ExportMetrics;
  logs: ExportLog[];
}

export interface ExportProgress {
  phase: 'initializing' | 'extracting' | 'transforming' | 'exporting' | 'finalizing';
  percentage: number;
  recordsProcessed: number;
  totalRecords?: number;
  currentOperation: string;
  estimatedTimeRemaining?: number;
}

export interface ExportOutput {
  destination: string;
  path: string;
  format: string;
  size: number;
  checksum?: string;
  recordCount: number;
  compressed: boolean;
  encrypted: boolean;
  url?: string;
  expiresAt?: Date;
}

export interface ExportError {
  type: 'validation' | 'transformation' | 'destination' | 'system';
  code: string;
  message: string;
  details: any;
  timestamp: Date;
  recordIndex?: number;
}

export interface ExportMetrics {
  extractionTime: number;
  transformationTime: number;
  exportTime: number;
  totalTime: number;
  recordsExtracted: number;
  recordsTransformed: number;
  recordsExported: number;
  recordsSkipped: number;
  recordsErrored: number;
  dataSize: number;
  throughput: number;
  memoryUsage: number;
  cpuUsage: number;
  networkUsage: number;
}

export interface ExportLog {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: Date;
  phase: string;
  recordIndex?: number;
  context?: any;
}

export interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  format: string;
  dataSource: string;
  defaultConfig: Partial<ExportConfiguration>;
  requiredFields: string[];
  optionalFields: string[];
  useCases: string[];
  popularity: number;
  createdAt: Date;
}

export interface DataProfile {
  source: string;
  totalRecords: number;
  columns: ColumnProfile[];
  quality: QualityMetrics;
  relationships: DataRelationship[];
  generatedAt: Date;
}

export interface ColumnProfile {
  name: string;
  type: string;
  nullable: boolean;
  unique: boolean;
  statistics: ColumnStatistics;
  distribution: ValueDistribution;
  patterns: string[];
}

export interface ColumnStatistics {
  count: number;
  nullCount: number;
  uniqueCount: number;
  duplicateCount: number;
  min?: any;
  max?: any;
  mean?: number;
  median?: number;
  stdDev?: number;
}

export interface ValueDistribution {
  topValues: { value: any; count: number; percentage: number }[];
  histogram?: { bin: string; count: number }[];
}

export interface DataRelationship {
  sourceColumn: string;
  targetColumn: string;
  type: 'foreign_key' | 'reference' | 'similarity';
  confidence: number;
}

export interface QualityMetrics {
  completeness: number;
  validity: number;
  consistency: number;
  accuracy: number;
  uniqueness: number;
  overall: number;
  issues: QualityIssue[];
}

export interface QualityIssue {
  type: 'missing_values' | 'invalid_format' | 'duplicates' | 'outliers' | 'inconsistency';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  count: number;
  examples: any[];
}

export class DataExportService extends EventEmitter {
  private db: Db | null = null;
  private redis: IORedis;
  private logger: winston.Logger;
  private jobQueue: ExportJob[] = [];
  private runningJobs = new Set<string>();
  private maxConcurrentJobs = 3;

  constructor() {
    super();
    this.redis = new IORedis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'data-export.log' })
      ]
    });
  }

  async initialize(): Promise<void> {
    try {
      const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
      await client.connect();
      this.db = client.db('healthcare_claims');

      await this.ensureIndexes();
      await this.redis.connect();
      this.startJobProcessor();
      
      this.logger.info('Data Export Service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Data Export Service:', error);
      throw error;
    }
  }

  private async ensureIndexes(): Promise<void> {
    if (!this.db) return;

    const collections = {
      export_configurations: [
        { key: { id: 1 }, unique: true },
        { key: { isActive: 1, 'metadata.category': 1 } },
        { key: { createdBy: 1, updatedAt: -1 } },
        { key: { 'metadata.tags': 1 } }
      ],
      export_jobs: [
        { key: { id: 1 }, unique: true },
        { key: { configId: 1, startTime: -1 } },
        { key: { status: 1 } },
        { key: { triggeredBy: 1 } },
        { key: { triggerType: 1, startTime: -1 } }
      ],
      export_templates: [
        { key: { id: 1 }, unique: true },
        { key: { category: 1, popularity: -1 } },
        { key: { format: 1 } }
      ],
      data_profiles: [
        { key: { source: 1 }, unique: true },
        { key: { generatedAt: -1 } }
      ]
    };

    for (const [collection, indexes] of Object.entries(collections)) {
      for (const index of indexes) {
        await this.db.collection(collection).createIndex(index.key, { 
          unique: index.unique || false,
          background: true 
        });
      }
    }
  }

  async createExportConfiguration(config: Omit<ExportConfiguration, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    const exportConfig: ExportConfiguration = {
      id: `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...config,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.db.collection('export_configurations').insertOne(exportConfig);
    this.logger.info(`Created export configuration: ${exportConfig.id}`);
    return exportConfig.id;
  }

  async executeExport(configId: string, parameters: Record<string, any> = {}, triggeredBy: string = 'system'): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    const config = await this.db.collection('export_configurations').findOne({ id: configId });
    if (!config) throw new Error(`Export configuration not found: ${configId}`);
    if (!config.isActive) throw new Error(`Export configuration is inactive: ${configId}`);

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const job: ExportJob = {
      id: jobId,
      configId,
      status: 'queued',
      progress: {
        phase: 'initializing',
        percentage: 0,
        recordsProcessed: 0,
        currentOperation: 'Initializing export job'
      },
      startTime: new Date(),
      triggeredBy,
      triggerType: 'manual',
      parameters,
      outputs: [],
      errors: [],
      metrics: {
        extractionTime: 0,
        transformationTime: 0,
        exportTime: 0,
        totalTime: 0,
        recordsExtracted: 0,
        recordsTransformed: 0,
        recordsExported: 0,
        recordsSkipped: 0,
        recordsErrored: 0,
        dataSize: 0,
        throughput: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        networkUsage: 0
      },
      logs: []
    };

    await this.db.collection('export_jobs').insertOne(job);
    this.addToQueue(job);
    
    this.emit('exportJobCreated', { jobId, configId });
    this.logger.info(`Created export job: ${jobId} for config: ${configId}`);
    
    return jobId;
  }

  private addToQueue(job: ExportJob): void {
    this.jobQueue.push(job);
    this.jobQueue.sort((a, b) => {
      // Priority sorting - could be enhanced with actual priority field
      return a.startTime.getTime() - b.startTime.getTime();
    });
  }

  private startJobProcessor(): void {
    setInterval(async () => {
      if (this.jobQueue.length > 0 && this.runningJobs.size < this.maxConcurrentJobs) {
        const job = this.jobQueue.shift()!;
        this.processExportJob(job);
      }
    }, 1000); // Check every second
  }

  private async processExportJob(job: ExportJob): Promise<void> {
    this.runningJobs.add(job.id);

    try {
      await this.updateJobStatus(job.id, 'running');
      
      const config = await this.db!.collection('export_configurations').findOne({ id: job.configId });
      if (!config) throw new Error(`Export configuration not found: ${job.configId}`);

      this.emit('exportJobStarted', { jobId: job.id, configId: job.configId });

      // Phase 1: Extract data
      await this.updateJobProgress(job.id, { phase: 'extracting', percentage: 10, currentOperation: 'Extracting data from source' });
      const extractedData = await this.extractData(config.dataSource, job.parameters, job);

      // Phase 2: Transform data
      await this.updateJobProgress(job.id, { phase: 'transforming', percentage: 40, currentOperation: 'Transforming data' });
      const transformedData = await this.transformData(extractedData, config.transformation, job);

      // Phase 3: Export data
      await this.updateJobProgress(job.id, { phase: 'exporting', percentage: 70, currentOperation: 'Exporting to destinations' });
      const outputs = await this.exportData(transformedData, config, job);

      // Phase 4: Finalize
      await this.updateJobProgress(job.id, { phase: 'finalizing', percentage: 90, currentOperation: 'Finalizing export' });
      await this.finalizeExport(job.id, outputs);

      await this.updateJobProgress(job.id, { phase: 'finalizing', percentage: 100, currentOperation: 'Export completed' });
      await this.updateJobStatus(job.id, 'completed', { 
        endTime: new Date(),
        duration: Date.now() - job.startTime.getTime(),
        outputs
      });

      this.emit('exportJobCompleted', { jobId: job.id, configId: job.configId, outputs });
      this.logger.info(`Export job completed: ${job.id}`);

    } catch (error) {
      await this.handleJobError(job.id, error);
    } finally {
      this.runningJobs.delete(job.id);
    }
  }

  private async extractData(dataSource: DataSourceConfig, parameters: Record<string, any>, job: ExportJob): Promise<any[]> {
    const startTime = Date.now();
    
    try {
      let data: any[] = [];
      
      switch (dataSource.type) {
        case 'mongodb':
          data = await this.extractFromMongoDB(dataSource, parameters);
          break;
        case 'sql':
          data = await this.extractFromSQL(dataSource, parameters);
          break;
        case 'api':
          data = await this.extractFromAPI(dataSource, parameters);
          break;
        case 'file':
          data = await this.extractFromFile(dataSource, parameters);
          break;
        case 'warehouse':
          data = await this.extractFromWarehouse(dataSource, parameters);
          break;
        case 'stream':
          data = await this.extractFromStream(dataSource, parameters);
          break;
        default:
          throw new Error(`Unsupported data source type: ${dataSource.type}`);
      }

      // Apply validation if enabled
      if (dataSource.validation.enabled) {
        data = await this.validateData(data, dataSource.validation, job);
      }

      const extractionTime = Date.now() - startTime;
      await this.updateJobMetrics(job.id, {
        extractionTime,
        recordsExtracted: data.length,
        dataSize: JSON.stringify(data).length
      });

      return data;

    } catch (error) {
      this.logger.error(`Data extraction failed for job ${job.id}:`, error);
      throw error;
    }
  }

  private async extractFromMongoDB(dataSource: DataSourceConfig, parameters: Record<string, any>): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const query = this.interpolateQuery(dataSource.query, { ...dataSource.parameters, ...parameters });
      const pipeline = JSON.parse(query);
      
      let cursor = this.db.collection(dataSource.connectionString).aggregate(pipeline);
      
      // Apply pagination if enabled
      if (dataSource.pagination.enabled) {
        const offset = parameters.page ? (parameters.page - 1) * dataSource.pagination.pageSize : 0;
        cursor = cursor.skip(offset).limit(dataSource.pagination.pageSize);
      }

      return await cursor.toArray();
    } catch (error) {
      this.logger.error('Failed to extract from MongoDB:', error);
      throw error;
    }
  }

  private async extractFromSQL(dataSource: DataSourceConfig, parameters: Record<string, any>): Promise<any[]> {
    // Mock SQL extraction
    this.logger.info('Extracting from SQL - mock implementation');
    return this.generateMockData(100);
  }

  private async extractFromAPI(dataSource: DataSourceConfig, parameters: Record<string, any>): Promise<any[]> {
    try {
      let allData: any[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore && (!dataSource.pagination.maxPages || page <= dataSource.pagination.maxPages)) {
        const url = this.interpolateQuery(dataSource.connectionString, { 
          ...dataSource.parameters, 
          ...parameters, 
          page, 
          pageSize: dataSource.pagination.pageSize 
        });

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();
        const records = Array.isArray(data) ? data : [data];
        allData = allData.concat(records);

        hasMore = dataSource.pagination.enabled && records.length === dataSource.pagination.pageSize;
        page++;
      }

      return allData;
    } catch (error) {
      this.logger.error('Failed to extract from API:', error);
      throw error;
    }
  }

  private async extractFromFile(dataSource: DataSourceConfig, parameters: Record<string, any>): Promise<any[]> {
    // Mock file extraction
    this.logger.info('Extracting from file - mock implementation');
    return this.generateMockData(200);
  }

  private async extractFromWarehouse(dataSource: DataSourceConfig, parameters: Record<string, any>): Promise<any[]> {
    // Mock warehouse extraction
    this.logger.info('Extracting from warehouse - mock implementation');
    return this.generateMockData(1000);
  }

  private async extractFromStream(dataSource: DataSourceConfig, parameters: Record<string, any>): Promise<any[]> {
    // Mock stream extraction
    this.logger.info('Extracting from stream - mock implementation');
    return this.generateMockData(50);
  }

  private generateMockData(count: number): any[] {
    const data = [];
    const statuses = ['active', 'pending', 'completed', 'cancelled'];
    const categories = ['medical', 'dental', 'vision', 'pharmacy'];

    for (let i = 1; i <= count; i++) {
      data.push({
        id: i,
        claimId: `CLM-${String(i).padStart(6, '0')}`,
        patientId: `PAT-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
        amount: Math.floor(Math.random() * 10000) + 100,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        category: categories[Math.floor(Math.random() * categories.length)],
        submittedDate: new Date(Date.now() - Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000)),
        processedDate: Math.random() > 0.5 ? new Date() : null,
        approved: Math.random() > 0.3,
        providerName: `Provider ${Math.floor(Math.random() * 100) + 1}`,
        diagnosis: `ICD-${Math.floor(Math.random() * 999) + 1}`,
        procedure: `CPT-${Math.floor(Math.random() * 99999) + 10000}`
      });
    }

    return data;
  }

  private async validateData(data: any[], validation: ValidationConfig, job: ExportJob): Promise<any[]> {
    const validData: any[] = [];
    let skippedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < data.length; i++) {
      const record = data[i];
      const validationResult = await this.validateRecord(record, validation.rules);

      if (validationResult.valid) {
        validData.push(record);
      } else {
        switch (validation.onError) {
          case 'skip':
            skippedCount++;
            await this.addJobLog(job.id, 'warn', `Skipping invalid record at index ${i}: ${validationResult.errors.join(', ')}`);
            break;
          case 'fail':
            throw new Error(`Validation failed at record ${i}: ${validationResult.errors.join(', ')}`);
          case 'log':
            errorCount++;
            validData.push(record); // Keep the record but log the error
            await this.addJobLog(job.id, 'error', `Validation error at index ${i}: ${validationResult.errors.join(', ')}`);
            break;
        }
      }
    }

    await this.updateJobMetrics(job.id, {
      recordsSkipped: skippedCount,
      recordsErrored: errorCount
    });

    return validData;
  }

  private async validateRecord(record: any, rules: ValidationRule[]): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    for (const rule of rules) {
      const value = this.getNestedValue(record, rule.field);
      
      switch (rule.type) {
        case 'required':
          if (value == null || value === '') {
            errors.push(`${rule.field} is required`);
          }
          break;
        case 'type':
          if (value != null && typeof value !== rule.condition) {
            errors.push(`${rule.field} must be of type ${rule.condition}`);
          }
          break;
        case 'range':
          if (typeof value === 'number' && (value < rule.condition.min || value > rule.condition.max)) {
            errors.push(`${rule.field} must be between ${rule.condition.min} and ${rule.condition.max}`);
          }
          break;
        case 'pattern':
          if (typeof value === 'string' && !new RegExp(rule.condition).test(value)) {
            errors.push(`${rule.field} does not match required pattern`);
          }
          break;
        case 'custom':
          try {
            const func = new Function('value', 'record', rule.condition);
            if (!func(value, record)) {
              errors.push(rule.message || `${rule.field} failed custom validation`);
            }
          } catch (error) {
            errors.push(`Custom validation error for ${rule.field}`);
          }
          break;
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private async transformData(data: any[], transformation: TransformationConfig, job: ExportJob): Promise<any[]> {
    if (!transformation.enabled) return data;

    const startTime = Date.now();
    let transformedData = [...data];

    try {
      // Apply transformation steps
      for (const step of transformation.steps.sort((a, b) => a.order - b.order)) {
        transformedData = await this.applyTransformationStep(transformedData, step, job);
      }

      // Apply field mappings
      if (transformation.mapping.length > 0) {
        transformedData = await this.applyFieldMappings(transformedData, transformation.mapping);
      }

      // Apply aggregations
      if (transformation.aggregations.length > 0) {
        transformedData = await this.applyAggregations(transformedData, transformation.aggregations);
      }

      // Apply post-processing
      for (const step of transformation.postProcessing) {
        transformedData = await this.applyPostProcessingStep(transformedData, step, job);
      }

      const transformationTime = Date.now() - startTime;
      await this.updateJobMetrics(job.id, {
        transformationTime,
        recordsTransformed: transformedData.length
      });

      return transformedData;

    } catch (error) {
      this.logger.error(`Data transformation failed for job ${job.id}:`, error);
      throw error;
    }
  }

  private async applyTransformationStep(data: any[], step: TransformationStep, job: ExportJob): Promise<any[]> {
    switch (step.type) {
      case 'filter':
        return this.applyFilter(data, step.configuration);
      case 'map':
        return this.applyMap(data, step.configuration);
      case 'sort':
        return this.applySort(data, step.configuration);
      case 'group':
        return this.applyGroup(data, step.configuration);
      default:
        this.logger.warn(`Unsupported transformation step: ${step.type}`);
        return data;
    }
  }

  private applyFilter(data: any[], config: any): any[] {
    return data.filter(item => {
      for (const [field, condition] of Object.entries(config)) {
        const value = this.getNestedValue(item, field);
        if (!this.evaluateCondition(value, condition)) {
          return false;
        }
      }
      return true;
    });
  }

  private applyMap(data: any[], config: any): any[] {
    return data.map(item => {
      const mapped = { ...item };
      for (const [newField, expression] of Object.entries(config)) {
        mapped[newField] = this.evaluateExpression(expression, item);
      }
      return mapped;
    });
  }

  private applySort(data: any[], config: any): any[] {
    return data.sort((a, b) => {
      for (const sortField of config.fields) {
        const aVal = this.getNestedValue(a, sortField.field);
        const bVal = this.getNestedValue(b, sortField.field);
        
        if (aVal < bVal) return sortField.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortField.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  private applyGroup(data: any[], config: any): any[] {
    const grouped = new Map();
    
    for (const item of data) {
      const key = config.by.map((field: string) => this.getNestedValue(item, field)).join('|');
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(item);
    }

    const result = [];
    for (const [key, items] of grouped) {
      const groupedItem: any = {};
      
      // Add grouping fields
      config.by.forEach((field: string, index: number) => {
        groupedItem[field] = key.split('|')[index];
      });

      // Add aggregated fields
      if (config.aggregations) {
        for (const [aggField, aggFunc] of Object.entries(config.aggregations)) {
          const values = items.map((item: any) => this.getNestedValue(item, aggField));
          groupedItem[`${aggFunc}_${aggField}`] = this.calculateAggregation(values, aggFunc as string);
        }
      }

      // Add items if requested
      if (config.includeItems) {
        groupedItem.items = items;
      }

      result.push(groupedItem);
    }

    return result;
  }

  private async applyFieldMappings(data: any[], mappings: FieldMapping[]): Promise<any[]> {
    return data.map(item => {
      const mapped: any = {};
      
      for (const mapping of mappings) {
        let value = this.getNestedValue(item, mapping.source);
        
        if (mapping.transformation) {
          value = this.evaluateExpression(mapping.transformation, { ...item, value });
        }
        
        if (value === undefined && mapping.defaultValue !== undefined) {
          value = mapping.defaultValue;
        }
        
        this.setNestedValue(mapped, mapping.target, value);
      }
      
      return mapped;
    });
  }

  private async applyAggregations(data: any[], aggregations: AggregationStep[]): Promise<any[]> {
    for (const aggStep of aggregations) {
      const grouped = this.groupBy(data, aggStep.groupBy);
      
      data = Array.from(grouped.entries()).map(([key, items]) => {
        const result: any = {};
        
        // Add group by fields
        aggStep.groupBy.forEach((field, index) => {
          result[field] = key.split('|')[index];
        });
        
        // Add aggregations
        for (const agg of aggStep.aggregations) {
          const values = items.map(item => this.getNestedValue(item, agg.field));
          result[agg.alias] = this.calculateAggregation(values, agg.function);
        }
        
        return result;
      });
    }
    
    return data;
  }

  private groupBy(data: any[], fields: string[]): Map<string, any[]> {
    const grouped = new Map();
    
    for (const item of data) {
      const key = fields.map(field => this.getNestedValue(item, field)).join('|');
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(item);
    }
    
    return grouped;
  }

  private async applyPostProcessingStep(data: any[], step: PostProcessingStep, job: ExportJob): Promise<any[]> {
    switch (step.type) {
      case 'sort':
        return this.applySort(data, step.configuration);
      case 'limit':
        return data.slice(0, step.configuration.count);
      case 'deduplicate':
        return this.deduplicateData(data, step.configuration);
      case 'validate':
        return this.validatePostProcessing(data, step.configuration, job);
      case 'enrich':
        return await this.enrichData(data, step.configuration);
      default:
        return data;
    }
  }

  private deduplicateData(data: any[], config: any): any[] {
    const seen = new Set();
    const uniqueData = [];
    
    for (const item of data) {
      const key = config.fields ? 
        config.fields.map((field: string) => this.getNestedValue(item, field)).join('|') :
        JSON.stringify(item);
      
      if (!seen.has(key)) {
        seen.add(key);
        uniqueData.push(item);
      }
    }
    
    return uniqueData;
  }

  private validatePostProcessing(data: any[], config: any, job: ExportJob): any[] {
    // Apply additional validation rules
    return data.filter(item => {
      // Implement validation logic
      return true;
    });
  }

  private async enrichData(data: any[], config: any): Promise<any[]> {
    // Mock data enrichment
    return data.map(item => ({
      ...item,
      enriched: true,
      enrichedAt: new Date()
    }));
  }

  private async exportData(data: any[], config: ExportConfiguration, job: ExportJob): Promise<ExportOutput[]> {
    const startTime = Date.now();
    const outputs: ExportOutput[] = [];

    try {
      for (const destination of config.destination) {
        const output = await this.exportToDestination(data, config.format, destination, job);
        outputs.push(output);
      }

      const exportTime = Date.now() - startTime;
      await this.updateJobMetrics(job.id, {
        exportTime,
        recordsExported: data.length
      });

      return outputs;

    } catch (error) {
      this.logger.error(`Data export failed for job ${job.id}:`, error);
      throw error;
    }
  }

  private async exportToDestination(
    data: any[], 
    format: ExportFormat, 
    destination: DestinationConfig, 
    job: ExportJob
  ): Promise<ExportOutput> {
    let content: string | Buffer;
    let compressed = false;
    let encrypted = false;

    // Generate content based on format
    content = await this.generateExportContent(data, format);

    // Apply compression if enabled
    if (destination.type !== 'database' && format.type !== 'sql') {
      // content = await this.compressContent(content, compressionConfig);
      // compressed = compressionConfig.enabled;
    }

    // Apply encryption if enabled
    // if (encryptionConfig.enabled) {
    //   content = await this.encryptContent(content, encryptionConfig);
    //   encrypted = true;
    // }

    // Export to destination
    const exportPath = await this.writeToDestination(content, destination, format, job);

    return {
      destination: destination.type,
      path: exportPath,
      format: format.type,
      size: typeof content === 'string' ? content.length : content.length,
      recordCount: data.length,
      compressed,
      encrypted,
      url: this.generateAccessUrl(exportPath, destination)
    };
  }

  private async generateExportContent(data: any[], format: ExportFormat): Promise<string> {
    switch (format.type) {
      case 'csv':
        return this.generateCSV(data, format.options);
      case 'json':
        return this.generateJSON(data, format.options);
      case 'xml':
        return this.generateXML(data, format.options);
      case 'excel':
        return this.generateExcel(data, format.options);
      case 'sql':
        return this.generateSQL(data, format.options);
      default:
        throw new Error(`Unsupported export format: ${format.type}`);
    }
  }

  private generateCSV(data: any[], options: FormatOptions): string {
    if (data.length === 0) return '';

    const delimiter = options.delimiter || ',';
    const quote = options.quote || '"';
    const headers = options.headers !== false;
    
    const columns = Object.keys(data[0]);
    let csv = '';

    if (headers) {
      csv += columns.map(col => `${quote}${col}${quote}`).join(delimiter) + '\n';
    }

    for (const row of data) {
      const values = columns.map(col => {
        let value = row[col];
        if (value == null) value = options.nullValue || '';
        if (typeof value === 'string') value = value.replace(new RegExp(quote, 'g'), quote + quote);
        return `${quote}${value}${quote}`;
      });
      csv += values.join(delimiter) + '\n';
    }

    return csv;
  }

  private generateJSON(data: any[], options: FormatOptions): string {
    return JSON.stringify(data, null, 2);
  }

  private generateXML(data: any[], options: FormatOptions): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<data>\n';
    
    for (const item of data) {
      xml += '  <record>\n';
      for (const [key, value] of Object.entries(item)) {
        xml += `    <${key}>${this.escapeXML(String(value))}</${key}>\n`;
      }
      xml += '  </record>\n';
    }
    
    xml += '</data>';
    return xml;
  }

  private escapeXML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private generateExcel(data: any[], options: FormatOptions): string {
    // Mock Excel generation - in production use a library like ExcelJS
    this.logger.info('Generating Excel file - mock implementation');
    return 'Excel content mock';
  }

  private generateSQL(data: any[], options: FormatOptions): string {
    if (data.length === 0) return '';

    const tableName = options.tableName || 'exported_data';
    const columns = Object.keys(data[0]);
    
    let sql = `-- Exported data\n`;
    
    for (const row of data) {
      const values = columns.map(col => {
        const value = row[col];
        if (value == null) return 'NULL';
        if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
        if (typeof value === 'boolean') return value ? '1' : '0';
        return String(value);
      });
      
      sql += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
    }
    
    return sql;
  }

  private async writeToDestination(
    content: string | Buffer, 
    destination: DestinationConfig, 
    format: ExportFormat, 
    job: ExportJob
  ): Promise<string> {
    switch (destination.type) {
      case 'file':
        return await this.writeToFile(content, destination, format);
      case 's3':
        return await this.writeToS3(content, destination, format);
      case 'database':
        return await this.writeToDatabase(content, destination, format);
      case 'api':
        return await this.writeToAPI(content, destination, format);
      case 'email':
        return await this.sendByEmail(content, destination, format);
      default:
        throw new Error(`Unsupported destination type: ${destination.type}`);
    }
  }

  private async writeToFile(content: string | Buffer, destination: DestinationConfig, format: ExportFormat): Promise<string> {
    // Mock file writing
    const fileName = `export_${Date.now()}.${format.type}`;
    const filePath = `${destination.path}/${fileName}`;
    this.logger.info(`Writing to file: ${filePath} - mock implementation`);
    return filePath;
  }

  private async writeToS3(content: string | Buffer, destination: DestinationConfig, format: ExportFormat): Promise<string> {
    // Mock S3 upload
    const fileName = `export_${Date.now()}.${format.type}`;
    const s3Path = `${destination.path}/${fileName}`;
    this.logger.info(`Uploading to S3: ${s3Path} - mock implementation`);
    return s3Path;
  }

  private async writeToDatabase(content: string | Buffer, destination: DestinationConfig, format: ExportFormat): Promise<string> {
    // Mock database insertion
    this.logger.info(`Writing to database: ${destination.path} - mock implementation`);
    return `database:${destination.path}`;
  }

  private async writeToAPI(content: string | Buffer, destination: DestinationConfig, format: ExportFormat): Promise<string> {
    // Mock API posting
    this.logger.info(`Posting to API: ${destination.path} - mock implementation`);
    return `api:${destination.path}`;
  }

  private async sendByEmail(content: string | Buffer, destination: DestinationConfig, format: ExportFormat): Promise<string> {
    // Mock email sending
    this.logger.info(`Sending by email to: ${destination.path} - mock implementation`);
    return `email:${destination.path}`;
  }

  private generateAccessUrl(path: string, destination: DestinationConfig): string {
    switch (destination.type) {
      case 's3':
        return `https://exports.s3.amazonaws.com/${path}`;
      case 'file':
        return `https://exports.example.com/files/${encodeURIComponent(path)}`;
      default:
        return path;
    }
  }

  // Utility methods
  private interpolateQuery(query: string, variables: Record<string, any>): string {
    let interpolated = query;
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      interpolated = interpolated.replace(regex, typeof value === 'string' ? `"${value}"` : String(value));
    }

    return interpolated;
  }

  private evaluateCondition(value: any, condition: any): boolean {
    if (typeof condition === 'object' && condition !== null) {
      const [operator, operand] = Object.entries(condition)[0];
      switch (operator) {
        case '$eq': return value === operand;
        case '$ne': return value !== operand;
        case '$gt': return value > operand;
        case '$gte': return value >= operand;
        case '$lt': return value < operand;
        case '$lte': return value <= operand;
        case '$in': return Array.isArray(operand) && operand.includes(value);
        case '$nin': return Array.isArray(operand) && !operand.includes(value);
        default: return true;
      }
    }
    return value === condition;
  }

  private evaluateExpression(expression: any, context: any): any {
    if (typeof expression === 'string') {
      // Simple field reference
      return this.getNestedValue(context, expression);
    }
    // For complex expressions, implement a proper expression evaluator
    return expression;
  }

  private calculateAggregation(values: any[], type: string): any {
    const numValues = values.filter(v => typeof v === 'number');
    
    switch (type) {
      case 'sum': return numValues.reduce((a, b) => a + b, 0);
      case 'avg': return numValues.length > 0 ? numValues.reduce((a, b) => a + b, 0) / numValues.length : 0;
      case 'min': return Math.min(...numValues);
      case 'max': return Math.max(...numValues);
      case 'count': return values.length;
      case 'distinct': return new Set(values).size;
      case 'first': return values[0];
      case 'last': return values[values.length - 1];
      default: return 0;
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((curr, prop) => curr?.[prop], obj);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((curr, key) => {
      if (!(key in curr)) curr[key] = {};
      return curr[key];
    }, obj);
    target[lastKey] = value;
  }

  // Job management methods
  private async updateJobStatus(jobId: string, status: ExportJob['status'], updates: any = {}): Promise<void> {
    if (!this.db) return;

    await this.db.collection('export_jobs').updateOne(
      { id: jobId },
      { $set: { status, ...updates } }
    );
  }

  private async updateJobProgress(jobId: string, progress: Partial<ExportProgress>): Promise<void> {
    if (!this.db) return;

    await this.db.collection('export_jobs').updateOne(
      { id: jobId },
      { $set: { progress: { ...progress } } }
    );
  }

  private async updateJobMetrics(jobId: string, metrics: Partial<ExportMetrics>): Promise<void> {
    if (!this.db) return;

    await this.db.collection('export_jobs').updateOne(
      { id: jobId },
      { $set: { [`metrics.${Object.keys(metrics)[0]}`]: Object.values(metrics)[0] } }
    );
  }

  private async addJobLog(jobId: string, level: ExportLog['level'], message: string, context?: any): Promise<void> {
    if (!this.db) return;

    const log: ExportLog = {
      level,
      message,
      timestamp: new Date(),
      phase: 'processing',
      context
    };

    await this.db.collection('export_jobs').updateOne(
      { id: jobId },
      { $push: { logs: log } }
    );
  }

  private async handleJobError(jobId: string, error: any): Promise<void> {
    await this.updateJobStatus(jobId, 'failed', {
      endTime: new Date(),
      errors: [{
        type: 'system',
        code: 'EXPORT_FAILED',
        message: error.message,
        details: error,
        timestamp: new Date()
      }]
    });

    this.emit('exportJobFailed', { jobId, error: error.message });
    this.logger.error(`Export job failed: ${jobId}`, error);
  }

  private async finalizeExport(jobId: string, outputs: ExportOutput[]): Promise<void> {
    // Cleanup temporary resources, send notifications, etc.
    this.logger.info(`Finalizing export job: ${jobId} with ${outputs.length} outputs`);
  }

  // Public API methods
  async getExportConfigurations(filters?: {
    category?: string;
    format?: string;
    createdBy?: string;
  }): Promise<ExportConfiguration[]> {
    if (!this.db) throw new Error('Database not initialized');

    const query: any = { isActive: true };
    if (filters?.category) query['metadata.category'] = filters.category;
    if (filters?.format) query['format.type'] = filters.format;
    if (filters?.createdBy) query.createdBy = filters.createdBy;

    return await this.db.collection('export_configurations')
      .find(query)
      .sort({ updatedAt: -1 })
      .toArray();
  }

  async getExportJob(jobId: string): Promise<ExportJob | null> {
    if (!this.db) throw new Error('Database not initialized');

    return await this.db.collection('export_jobs').findOne({ id: jobId });
  }

  async getExportJobs(filters?: {
    configId?: string;
    status?: string;
    triggeredBy?: string;
    startDate?: Date;
    endDate?: Date;
  }, limit: number = 50): Promise<ExportJob[]> {
    if (!this.db) throw new Error('Database not initialized');

    const query: any = {};
    if (filters?.configId) query.configId = filters.configId;
    if (filters?.status) query.status = filters.status;
    if (filters?.triggeredBy) query.triggeredBy = filters.triggeredBy;
    if (filters?.startDate || filters?.endDate) {
      query.startTime = {};
      if (filters.startDate) query.startTime.$gte = filters.startDate;
      if (filters.endDate) query.startTime.$lte = filters.endDate;
    }

    return await this.db.collection('export_jobs')
      .find(query)
      .sort({ startTime: -1 })
      .limit(limit)
      .toArray();
  }

  async cancelExportJob(jobId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.updateJobStatus(jobId, 'cancelled', {
      endTime: new Date()
    });

    // Remove from queue if present
    this.jobQueue = this.jobQueue.filter(job => job.id !== jobId);
    
    this.emit('exportJobCancelled', { jobId });
  }

  async getExportTemplates(category?: string): Promise<ExportTemplate[]> {
    if (!this.db) throw new Error('Database not initialized');

    const query = category ? { category } : {};
    return await this.db.collection('export_templates')
      .find(query)
      .sort({ popularity: -1 })
      .toArray();
  }

  async generateDataProfile(sourceConfig: DataSourceConfig): Promise<DataProfile> {
    // Extract sample data for profiling
    const sampleData = await this.extractData(sourceConfig, {}, {} as ExportJob);
    
    return this.analyzeDataProfile(sampleData, sourceConfig.connectionString);
  }

  private analyzeDataProfile(data: any[], source: string): DataProfile {
    if (data.length === 0) {
      return {
        source,
        totalRecords: 0,
        columns: [],
        quality: {
          completeness: 0,
          validity: 0,
          consistency: 0,
          accuracy: 0,
          uniqueness: 0,
          overall: 0,
          issues: []
        },
        relationships: [],
        generatedAt: new Date()
      };
    }

    const columns = this.analyzeColumns(data);
    const quality = this.analyzeDataQuality(data, columns);
    const relationships = this.analyzeRelationships(data, columns);

    return {
      source,
      totalRecords: data.length,
      columns,
      quality,
      relationships,
      generatedAt: new Date()
    };
  }

  private analyzeColumns(data: any[]): ColumnProfile[] {
    const columns: ColumnProfile[] = [];
    const sampleItem = data[0];

    for (const [key, value] of Object.entries(sampleItem)) {
      const allValues = data.map(item => item[key]);
      const nonNullValues = allValues.filter(v => v != null);
      
      const profile: ColumnProfile = {
        name: key,
        type: this.inferDataType(value),
        nullable: allValues.some(v => v == null),
        unique: new Set(allValues).size === allValues.length,
        statistics: {
          count: allValues.length,
          nullCount: allValues.length - nonNullValues.length,
          uniqueCount: new Set(allValues).size,
          duplicateCount: allValues.length - new Set(allValues).size
        },
        distribution: this.analyzeValueDistribution(allValues),
        patterns: this.identifyPatterns(nonNullValues)
      };

      // Add numeric statistics if applicable
      if (profile.type === 'number') {
        const numValues = nonNullValues.filter(v => typeof v === 'number');
        if (numValues.length > 0) {
          profile.statistics.min = Math.min(...numValues);
          profile.statistics.max = Math.max(...numValues);
          profile.statistics.mean = numValues.reduce((a, b) => a + b, 0) / numValues.length;
          
          const sorted = [...numValues].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          profile.statistics.median = sorted.length % 2 ? 
            sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        }
      }

      columns.push(profile);
    }

    return columns;
  }

  private inferDataType(value: any): string {
    if (value == null) return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (value instanceof Date) return 'date';
    if (typeof value === 'string' && !isNaN(Date.parse(value))) return 'date';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return 'string';
  }

  private analyzeValueDistribution(values: any[]): ValueDistribution {
    const frequency = new Map();
    
    for (const value of values) {
      frequency.set(value, (frequency.get(value) || 0) + 1);
    }

    const total = values.length;
    const topValues = Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([value, count]) => ({
        value,
        count,
        percentage: (count / total) * 100
      }));

    return { topValues };
  }

  private identifyPatterns(values: any[]): string[] {
    const patterns: string[] = [];
    
    // Simple pattern identification for strings
    const stringValues = values.filter(v => typeof v === 'string');
    if (stringValues.length > 0) {
      // Email pattern
      if (stringValues.some(v => /\S+@\S+\.\S+/.test(v))) {
        patterns.push('email');
      }
      
      // Phone pattern
      if (stringValues.some(v => /^\+?[\d\s\-\(\)]+$/.test(v))) {
        patterns.push('phone');
      }
      
      // ID pattern
      if (stringValues.some(v => /^[A-Z0-9\-]+$/.test(v))) {
        patterns.push('identifier');
      }
    }

    return patterns;
  }

  private analyzeDataQuality(data: any[], columns: ColumnProfile[]): QualityMetrics {
    let totalFields = 0;
    let completeFields = 0;
    let validFields = 0;
    const issues: QualityIssue[] = [];

    for (const column of columns) {
      totalFields += data.length;
      completeFields += data.length - column.statistics.nullCount;
      
      // Check for missing values
      if (column.statistics.nullCount > 0) {
        issues.push({
          type: 'missing_values',
          severity: column.statistics.nullCount / data.length > 0.1 ? 'high' : 'medium',
          description: `Column ${column.name} has ${column.statistics.nullCount} missing values`,
          count: column.statistics.nullCount,
          examples: []
        });
      }
      
      // Check for duplicates in unique fields
      if (column.statistics.duplicateCount > 0 && column.unique) {
        issues.push({
          type: 'duplicates',
          severity: 'medium',
          description: `Column ${column.name} has duplicate values but should be unique`,
          count: column.statistics.duplicateCount,
          examples: []
        });
      }
    }

    const completeness = totalFields > 0 ? completeFields / totalFields : 1;
    const validity = 0.9; // Mock calculation
    const consistency = 0.85; // Mock calculation
    const accuracy = 0.9; // Mock calculation
    const uniqueness = 0.95; // Mock calculation

    const overall = (completeness + validity + consistency + accuracy + uniqueness) / 5;

    return {
      completeness,
      validity,
      consistency,
      accuracy,
      uniqueness,
      overall,
      issues
    };
  }

  private analyzeRelationships(data: any[], columns: ColumnProfile[]): DataRelationship[] {
    // Mock relationship analysis
    return [];
  }
}
