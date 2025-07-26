import { MongoClient, Db } from 'mongodb';
import IORedis from 'ioredis';
import winston from 'winston';
import cron from 'node-cron';

export interface ETLJob {
  id: string;
  name: string;
  description: string;
  source: {
    type: 'mongodb' | 'api' | 'file' | 'redis';
    connectionString?: string;
    collection?: string;
    query?: any;
    endpoint?: string;
    filePath?: string;
  };
  transformations: Transformation[];
  destination: {
    type: 'mongodb' | 'redis' | 'file';
    connectionString?: string;
    collection?: string;
    filePath?: string;
    key?: string;
  };
  schedule: string; // Cron expression
  isActive: boolean;
  lastRun?: Date;
  nextRun?: Date;
  status: 'idle' | 'running' | 'success' | 'error';
  metadata: Record<string, any>;
}

export interface Transformation {
  type: 'map' | 'filter' | 'aggregate' | 'join' | 'pivot' | 'clean' | 'validate';
  config: any;
  order: number;
}

export interface ETLMetrics {
  jobId: string;
  runId: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'success' | 'error';
  recordsProcessed: number;
  recordsTransformed: number;
  recordsLoaded: number;
  errors: string[];
  performance: {
    extractionTime: number;
    transformationTime: number;
    loadTime: number;
    totalTime: number;
  };
}

export class ETLPipelineService {
  private db: Db | null = null;
  private redis: IORedis;
  private logger: winston.Logger;
  private runningJobs: Map<string, boolean> = new Map();
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();

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
        new winston.transports.File({ filename: 'logs/etl-pipeline.log' })
      ]
    });
  }

  async initialize(): Promise<void> {
    try {
      const client = new MongoClient(this.connectionString);
      await client.connect();
      this.db = client.db(this.databaseName);
      
      await this.createETLSchema();
      await this.loadScheduledJobs();
      
      this.logger.info('ETL Pipeline Service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize ETL Pipeline Service', error);
      throw error;
    }
  }

  private async createETLSchema(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const collections = [
      {
        name: 'etl_jobs',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['id', 'name', 'source', 'destination', 'schedule'],
            properties: {
              id: { bsonType: 'string' },
              name: { bsonType: 'string' },
              description: { bsonType: 'string' },
              source: { bsonType: 'object' },
              transformations: { bsonType: 'array' },
              destination: { bsonType: 'object' },
              schedule: { bsonType: 'string' },
              isActive: { bsonType: 'bool' },
              status: { enum: ['idle', 'running', 'success', 'error'] }
            }
          }
        }
      },
      {
        name: 'etl_metrics',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['jobId', 'runId', 'startTime', 'status'],
            properties: {
              jobId: { bsonType: 'string' },
              runId: { bsonType: 'string' },
              startTime: { bsonType: 'date' },
              endTime: { bsonType: 'date' },
              status: { enum: ['running', 'success', 'error'] },
              recordsProcessed: { bsonType: 'number' },
              recordsTransformed: { bsonType: 'number' },
              recordsLoaded: { bsonType: 'number' }
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
    await this.db.collection('etl_jobs').createIndex({ id: 1 }, { unique: true });
    await this.db.collection('etl_jobs').createIndex({ isActive: 1, schedule: 1 });
    await this.db.collection('etl_metrics').createIndex({ jobId: 1, startTime: -1 });
    await this.db.collection('etl_metrics').createIndex({ runId: 1 }, { unique: true });
  }

  async createJob(job: ETLJob): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.collection('etl_jobs').replaceOne(
      { id: job.id },
      { ...job, createdAt: new Date(), updatedAt: new Date() },
      { upsert: true }
    );

    if (job.isActive) {
      await this.scheduleJob(job);
    }

    this.logger.info(`ETL job created: ${job.name}`);
  }

  async updateJob(jobId: string, updates: Partial<ETLJob>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.collection('etl_jobs').updateOne(
      { id: jobId },
      { $set: { ...updates, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      throw new Error(`ETL job not found: ${jobId}`);
    }

    // Reschedule if schedule or active status changed
    if (updates.schedule || updates.isActive !== undefined) {
      await this.unscheduleJob(jobId);
      if (updates.isActive) {
        const job = await this.getJob(jobId);
        if (job) {
          await this.scheduleJob(job);
        }
      }
    }

    this.logger.info(`ETL job updated: ${jobId}`);
  }

  async getJob(jobId: string): Promise<ETLJob | null> {
    if (!this.db) throw new Error('Database not initialized');

    const job = await this.db.collection('etl_jobs').findOne({ id: jobId });
    return job as ETLJob | null;
  }

  async listJobs(): Promise<ETLJob[]> {
    if (!this.db) throw new Error('Database not initialized');

    const jobs = await this.db.collection('etl_jobs').find({}).toArray();
    return jobs as ETLJob[];
  }

  async runJob(jobId: string, manual: boolean = false): Promise<string> {
    if (this.runningJobs.get(jobId)) {
      throw new Error(`Job ${jobId} is already running`);
    }

    const job = await this.getJob(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const runId = `${jobId}_${Date.now()}`;
    this.runningJobs.set(jobId, true);

    const metrics: ETLMetrics = {
      jobId,
      runId,
      startTime: new Date(),
      status: 'running',
      recordsProcessed: 0,
      recordsTransformed: 0,
      recordsLoaded: 0,
      errors: [],
      performance: {
        extractionTime: 0,
        transformationTime: 0,
        loadTime: 0,
        totalTime: 0
      }
    };

    try {
      // Save initial metrics
      await this.saveMetrics(metrics);
      
      // Update job status
      await this.updateJobStatus(jobId, 'running');

      // Execute ETL pipeline
      await this.executeETLPipeline(job, metrics);

      // Mark as success
      metrics.status = 'success';
      metrics.endTime = new Date();
      metrics.performance.totalTime = metrics.endTime.getTime() - metrics.startTime.getTime();

      await this.saveMetrics(metrics);
      await this.updateJobStatus(jobId, 'success', new Date());

      this.logger.info(`ETL job completed successfully: ${jobId}`, {
        runId,
        recordsProcessed: metrics.recordsProcessed,
        totalTime: metrics.performance.totalTime
      });

    } catch (error) {
      metrics.status = 'error';
      metrics.endTime = new Date();
      metrics.errors.push(error instanceof Error ? error.message : String(error));
      metrics.performance.totalTime = metrics.endTime.getTime() - metrics.startTime.getTime();

      await this.saveMetrics(metrics);
      await this.updateJobStatus(jobId, 'error');

      this.logger.error(`ETL job failed: ${jobId}`, error);
      throw error;
    } finally {
      this.runningJobs.delete(jobId);
    }

    return runId;
  }

  private async executeETLPipeline(job: ETLJob, metrics: ETLMetrics): Promise<void> {
    // Extract phase
    const extractStart = Date.now();
    const rawData = await this.extractData(job.source);
    metrics.recordsProcessed = Array.isArray(rawData) ? rawData.length : 1;
    metrics.performance.extractionTime = Date.now() - extractStart;

    // Transform phase
    const transformStart = Date.now();
    const transformedData = await this.transformData(rawData, job.transformations);
    metrics.recordsTransformed = Array.isArray(transformedData) ? transformedData.length : 1;
    metrics.performance.transformationTime = Date.now() - transformStart;

    // Load phase
    const loadStart = Date.now();
    await this.loadData(transformedData, job.destination);
    metrics.recordsLoaded = metrics.recordsTransformed;
    metrics.performance.loadTime = Date.now() - loadStart;
  }

  private async extractData(source: ETLJob['source']): Promise<any> {
    switch (source.type) {
      case 'mongodb':
        return this.extractFromMongoDB(source);
      case 'api':
        return this.extractFromAPI(source);
      case 'file':
        return this.extractFromFile(source);
      case 'redis':
        return this.extractFromRedis(source);
      default:
        throw new Error(`Unsupported source type: ${source.type}`);
    }
  }

  private async extractFromMongoDB(source: ETLJob['source']): Promise<any[]> {
    if (!source.connectionString || !source.collection) {
      throw new Error('MongoDB source requires connectionString and collection');
    }

    const client = new MongoClient(source.connectionString);
    await client.connect();
    
    try {
      const db = client.db();
      const collection = db.collection(source.collection);
      const data = await collection.find(source.query || {}).toArray();
      return data;
    } finally {
      await client.close();
    }
  }

  private async extractFromAPI(source: ETLJob['source']): Promise<any> {
    if (!source.endpoint) {
      throw new Error('API source requires endpoint');
    }

    const response = await fetch(source.endpoint);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    return response.json();
  }

  private async extractFromFile(source: ETLJob['source']): Promise<any> {
    // Implementation would depend on file type (CSV, JSON, XML, etc.)
    throw new Error('File extraction not implemented');
  }

  private async extractFromRedis(source: ETLJob['source']): Promise<any> {
    if (!source.key) {
      throw new Error('Redis source requires key');
    }

    const data = await this.redis.get(source.key);
    return data ? JSON.parse(data) : null;
  }

  private async transformData(data: any, transformations: Transformation[]): Promise<any> {
    let result = data;

    // Sort transformations by order
    const sortedTransformations = transformations.sort((a, b) => a.order - b.order);

    for (const transformation of sortedTransformations) {
      result = await this.applyTransformation(result, transformation);
    }

    return result;
  }

  private async applyTransformation(data: any, transformation: Transformation): Promise<any> {
    switch (transformation.type) {
      case 'map':
        return this.mapTransformation(data, transformation.config);
      case 'filter':
        return this.filterTransformation(data, transformation.config);
      case 'aggregate':
        return this.aggregateTransformation(data, transformation.config);
      case 'join':
        return this.joinTransformation(data, transformation.config);
      case 'pivot':
        return this.pivotTransformation(data, transformation.config);
      case 'clean':
        return this.cleanTransformation(data, transformation.config);
      case 'validate':
        return this.validateTransformation(data, transformation.config);
      default:
        throw new Error(`Unsupported transformation type: ${transformation.type}`);
    }
  }

  private mapTransformation(data: any[], config: any): any[] {
    if (!Array.isArray(data)) return data;
    
    return data.map(item => {
      const mapped: any = {};
      for (const [targetField, sourceField] of Object.entries(config.mapping)) {
        mapped[targetField] = this.getNestedValue(item, sourceField as string);
      }
      return mapped;
    });
  }

  private filterTransformation(data: any[], config: any): any[] {
    if (!Array.isArray(data)) return data;
    
    return data.filter(item => {
      return this.evaluateCondition(item, config.condition);
    });
  }

  private aggregateTransformation(data: any[], config: any): any {
    if (!Array.isArray(data)) return data;

    const grouped: { [key: string]: any[] } = {};
    
    // Group by specified fields
    for (const item of data) {
      const groupKey = config.groupBy.map((field: string) => 
        this.getNestedValue(item, field)
      ).join('|');
      
      if (!grouped[groupKey]) {
        grouped[groupKey] = [];
      }
      grouped[groupKey].push(item);
    }

    // Apply aggregations
    const result = [];
    for (const [groupKey, items] of Object.entries(grouped)) {
      const aggregated: any = {};
      
      // Add group by fields
      config.groupBy.forEach((field: string, index: number) => {
        aggregated[field] = groupKey.split('|')[index];
      });

      // Apply aggregation functions
      for (const [field, func] of Object.entries(config.aggregations)) {
        aggregated[field] = this.applyAggregationFunction(items, func as string, field);
      }
      
      result.push(aggregated);
    }

    return result;
  }

  private joinTransformation(data: any[], config: any): any[] {
    // Implementation for joining with external data
    // This would require loading the join source and matching records
    return data;
  }

  private pivotTransformation(data: any[], config: any): any[] {
    // Implementation for pivoting data
    return data;
  }

  private cleanTransformation(data: any[], config: any): any[] {
    if (!Array.isArray(data)) return data;

    return data.map(item => {
      const cleaned = { ...item };
      
      for (const [field, cleanConfig] of Object.entries(config.fields)) {
        if (cleaned[field] !== undefined) {
          cleaned[field] = this.cleanField(cleaned[field], cleanConfig);
        }
      }
      
      return cleaned;
    });
  }

  private validateTransformation(data: any[], config: any): any[] {
    if (!Array.isArray(data)) return data;

    return data.filter(item => {
      for (const [field, validation] of Object.entries(config.validations)) {
        if (!this.validateField(item[field], validation)) {
          return false;
        }
      }
      return true;
    });
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private evaluateCondition(item: any, condition: any): boolean {
    // Simple condition evaluation
    const { field, operator, value } = condition;
    const fieldValue = this.getNestedValue(item, field);

    switch (operator) {
      case '=': return fieldValue === value;
      case '!=': return fieldValue !== value;
      case '>': return fieldValue > value;
      case '<': return fieldValue < value;
      case '>=': return fieldValue >= value;
      case '<=': return fieldValue <= value;
      case 'in': return Array.isArray(value) && value.includes(fieldValue);
      case 'exists': return fieldValue !== undefined && fieldValue !== null;
      default: return true;
    }
  }

  private applyAggregationFunction(items: any[], func: string, field: string): any {
    const values = items.map(item => this.getNestedValue(item, field)).filter(v => v != null);

    switch (func) {
      case 'count': return items.length;
      case 'sum': return values.reduce((sum, val) => sum + (Number(val) || 0), 0);
      case 'avg': return values.length > 0 ? values.reduce((sum, val) => sum + (Number(val) || 0), 0) / values.length : 0;
      case 'min': return Math.min(...values.map(Number));
      case 'max': return Math.max(...values.map(Number));
      case 'first': return values[0];
      case 'last': return values[values.length - 1];
      default: return null;
    }
  }

  private cleanField(value: any, config: any): any {
    let cleaned = value;

    if (config.trim && typeof cleaned === 'string') {
      cleaned = cleaned.trim();
    }

    if (config.uppercase && typeof cleaned === 'string') {
      cleaned = cleaned.toUpperCase();
    }

    if (config.lowercase && typeof cleaned === 'string') {
      cleaned = cleaned.toLowerCase();
    }

    if (config.removeNulls && (cleaned === null || cleaned === undefined)) {
      cleaned = config.defaultValue || '';
    }

    return cleaned;
  }

  private validateField(value: any, validation: any): boolean {
    if (validation.required && (value === null || value === undefined || value === '')) {
      return false;
    }

    if (validation.type && typeof value !== validation.type) {
      return false;
    }

    if (validation.min && Number(value) < validation.min) {
      return false;
    }

    if (validation.max && Number(value) > validation.max) {
      return false;
    }

    return true;
  }

  private async loadData(data: any, destination: ETLJob['destination']): Promise<void> {
    switch (destination.type) {
      case 'mongodb':
        await this.loadToMongoDB(data, destination);
        break;
      case 'redis':
        await this.loadToRedis(data, destination);
        break;
      case 'file':
        await this.loadToFile(data, destination);
        break;
      default:
        throw new Error(`Unsupported destination type: ${destination.type}`);
    }
  }

  private async loadToMongoDB(data: any, destination: ETLJob['destination']): Promise<void> {
    if (!destination.connectionString || !destination.collection) {
      throw new Error('MongoDB destination requires connectionString and collection');
    }

    const client = new MongoClient(destination.connectionString);
    await client.connect();
    
    try {
      const db = client.db();
      const collection = db.collection(destination.collection);
      
      if (Array.isArray(data)) {
        if (data.length > 0) {
          await collection.insertMany(data);
        }
      } else {
        await collection.insertOne(data);
      }
    } finally {
      await client.close();
    }
  }

  private async loadToRedis(data: any, destination: ETLJob['destination']): Promise<void> {
    if (!destination.key) {
      throw new Error('Redis destination requires key');
    }

    await this.redis.set(destination.key, JSON.stringify(data));
  }

  private async loadToFile(data: any, destination: ETLJob['destination']): Promise<void> {
    // Implementation would depend on file type and format
    throw new Error('File loading not implemented');
  }

  private async scheduleJob(job: ETLJob): Promise<void> {
    if (this.scheduledTasks.has(job.id)) {
      this.scheduledTasks.get(job.id)?.destroy();
    }

    const task = cron.schedule(job.schedule, async () => {
      try {
        await this.runJob(job.id);
      } catch (error) {
        this.logger.error(`Scheduled job failed: ${job.id}`, error);
      }
    }, {
      scheduled: false
    });

    task.start();
    this.scheduledTasks.set(job.id, task);
    
    this.logger.info(`Job scheduled: ${job.name} with schedule ${job.schedule}`);
  }

  private async unscheduleJob(jobId: string): Promise<void> {
    const task = this.scheduledTasks.get(jobId);
    if (task) {
      task.destroy();
      this.scheduledTasks.delete(jobId);
      this.logger.info(`Job unscheduled: ${jobId}`);
    }
  }

  private async loadScheduledJobs(): Promise<void> {
    const jobs = await this.listJobs();
    for (const job of jobs) {
      if (job.isActive) {
        await this.scheduleJob(job);
      }
    }
  }

  private async saveMetrics(metrics: ETLMetrics): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.collection('etl_metrics').replaceOne(
      { runId: metrics.runId },
      metrics,
      { upsert: true }
    );
  }

  private async updateJobStatus(jobId: string, status: string, lastRun?: Date): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const update: any = { status };
    if (lastRun) {
      update.lastRun = lastRun;
    }

    await this.db.collection('etl_jobs').updateOne(
      { id: jobId },
      { $set: update }
    );
  }

  async getJobMetrics(jobId: string, limit: number = 10): Promise<ETLMetrics[]> {
    if (!this.db) throw new Error('Database not initialized');

    const metrics = await this.db.collection('etl_metrics')
      .find({ jobId })
      .sort({ startTime: -1 })
      .limit(limit)
      .toArray();

    return metrics as ETLMetrics[];
  }
}
