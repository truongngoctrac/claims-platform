import { MongoClient, Db } from 'mongodb';
import IORedis from 'ioredis';
import winston from 'winston';
import cron from 'node-cron';

export interface AggregationRule {
  id: string;
  name: string;
  description: string;
  source: DataSourceConfig;
  aggregations: AggregationConfig[];
  dimensions: DimensionConfig[];
  timeWindow: TimeWindowConfig;
  output: OutputConfig;
  filters: FilterConfig[];
  schedule: ScheduleConfig;
  performance: PerformanceConfig;
  isActive: boolean;
  priority: 'high' | 'medium' | 'low';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  lastExecuted?: Date;
  executionStats: ExecutionStats;
}

export interface DataSourceConfig {
  type: 'mongodb' | 'api' | 'file' | 'stream' | 'kpi';
  connection: any;
  query?: any;
  fields: string[];
  timeField?: string;
  partitioning?: PartitionConfig;
}

export interface PartitionConfig {
  field: string;
  strategy: 'daily' | 'weekly' | 'monthly' | 'hourly';
  retention: number; // in days
}

export interface AggregationConfig {
  field: string;
  function: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'distinct' | 'median' | 'percentile' | 'stddev' | 'variance' | 'first' | 'last' | 'custom';
  alias?: string;
  parameters?: Record<string, any>;
  condition?: string; // SQL-like condition
}

export interface DimensionConfig {
  field: string;
  alias?: string;
  type: 'categorical' | 'numeric' | 'datetime' | 'boolean';
  binning?: BinningConfig;
  hierarchy?: string[];
  rollup?: boolean;
}

export interface BinningConfig {
  type: 'equal_width' | 'equal_frequency' | 'custom';
  bins: number | number[];
  labels?: string[];
}

export interface TimeWindowConfig {
  size: number;
  unit: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
  type: 'tumbling' | 'sliding' | 'session';
  step?: number; // for sliding windows
  sessionTimeout?: number; // for session windows
  alignment?: 'calendar' | 'processing_time';
}

export interface OutputConfig {
  type: 'mongodb' | 'redis' | 'file' | 'api' | 'materialized_view';
  destination: any;
  format: 'json' | 'csv' | 'parquet' | 'avro';
  compression?: 'gzip' | 'snappy' | 'lz4';
  partitioning?: PartitionConfig;
  indexing?: IndexConfig[];
}

export interface IndexConfig {
  fields: string[];
  type: 'btree' | 'hash' | 'compound';
  unique?: boolean;
}

export interface FilterConfig {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'in' | 'not_in' | 'like' | 'regex' | 'between' | 'exists';
  value: any;
  logicalOperator?: 'AND' | 'OR' | 'NOT';
}

export interface ScheduleConfig {
  type: 'cron' | 'interval' | 'trigger' | 'real_time';
  expression?: string; // cron expression or interval
  triggers?: TriggerConfig[];
  dependencies?: string[]; // other aggregation rule IDs
  maxDelay?: number; // maximum delay before forcing execution
}

export interface TriggerConfig {
  type: 'data_arrival' | 'time_based' | 'threshold' | 'external';
  condition: any;
  cooldown?: number; // minimum time between triggers
}

export interface PerformanceConfig {
  batchSize: number;
  parallelism: number;
  memoryLimit: number; // in MB
  timeout: number; // in seconds
  retries: number;
  optimization: OptimizationConfig;
}

export interface OptimizationConfig {
  pushdownFilters: boolean;
  indexHints: string[];
  caching: CachingConfig;
  approximation?: ApproximationConfig;
}

export interface CachingConfig {
  enabled: boolean;
  ttl: number; // in seconds
  strategy: 'lru' | 'lfu' | 'ttl';
  maxSize: number; // in MB
}

export interface ApproximationConfig {
  enabled: boolean;
  algorithm: 'hyperloglog' | 'bloom_filter' | 'count_min_sketch' | 'reservoir_sampling';
  accuracy: number; // 0.01 for 1% error
}

export interface ExecutionStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  lastExecutionTime?: number;
  lastError?: string;
  dataProcessed: number;
  outputGenerated: number;
}

export interface AggregationJob {
  id: string;
  ruleId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  inputRecords: number;
  outputRecords: number;
  processingTime: number;
  memoryUsed: number;
  errorMessage?: string;
  metadata: Record<string, any>;
}

export interface AggregationResult {
  ruleId: string;
  jobId: string;
  timestamp: Date;
  timeWindow: {
    start: Date;
    end: Date;
  };
  dimensions: Record<string, any>;
  aggregates: Record<string, any>;
  metadata: {
    inputRecords: number;
    processingTime: number;
    dataQuality: number;
  };
}

export interface MaterializedView {
  id: string;
  name: string;
  ruleId: string;
  schema: ViewSchema;
  partitions: ViewPartition[];
  statistics: ViewStatistics;
  refreshStrategy: RefreshStrategy;
  isActive: boolean;
  createdAt: Date;
  lastRefreshed?: Date;
}

export interface ViewSchema {
  dimensions: Array<{
    name: string;
    type: string;
    nullable: boolean;
  }>;
  measures: Array<{
    name: string;
    type: string;
    aggregation: string;
  }>;
  indexes: IndexConfig[];
}

export interface ViewPartition {
  id: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  recordCount: number;
  dataSize: number;
  status: 'active' | 'archived' | 'deleted';
}

export interface ViewStatistics {
  totalRecords: number;
  totalSize: number;
  partitionCount: number;
  averageQueryTime: number;
  hitRate: number;
  lastCompacted?: Date;
}

export interface RefreshStrategy {
  type: 'full' | 'incremental' | 'streaming';
  schedule: string;
  incrementalKey?: string;
  watermark?: number; // for late data handling
}

export class DataAggregationService {
  private db: Db | null = null;
  private redis: IORedis;
  private logger: winston.Logger;
  private aggregationRules: Map<string, AggregationRule> = new Map();
  private runningJobs: Map<string, AggregationJob> = new Map();
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();
  private materializedViews: Map<string, MaterializedView> = new Map();

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
        new winston.transports.File({ filename: 'logs/data-aggregation.log' })
      ]
    });
  }

  async initialize(): Promise<void> {
    try {
      const client = new MongoClient(this.connectionString);
      await client.connect();
      this.db = client.db(this.databaseName);
      
      await this.createAggregationSchema();
      await this.loadAggregationRules();
      await this.loadMaterializedViews();
      await this.scheduleAggregations();
      await this.createDefaultAggregations();
      
      this.logger.info('Data Aggregation Service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Data Aggregation Service', error);
      throw error;
    }
  }

  private async createAggregationSchema(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const collections = [
      {
        name: 'aggregation_rules',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['id', 'name', 'source', 'aggregations', 'timeWindow'],
            properties: {
              id: { bsonType: 'string' },
              name: { bsonType: 'string' },
              source: { bsonType: 'object' },
              aggregations: { bsonType: 'array' },
              timeWindow: { bsonType: 'object' }
            }
          }
        }
      },
      {
        name: 'aggregation_jobs',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['id', 'ruleId', 'status', 'startTime'],
            properties: {
              id: { bsonType: 'string' },
              ruleId: { bsonType: 'string' },
              status: { enum: ['pending', 'running', 'completed', 'failed', 'cancelled'] },
              startTime: { bsonType: 'date' }
            }
          }
        }
      },
      {
        name: 'aggregation_results',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['ruleId', 'jobId', 'timestamp'],
            properties: {
              ruleId: { bsonType: 'string' },
              jobId: { bsonType: 'string' },
              timestamp: { bsonType: 'date' }
            }
          }
        }
      },
      {
        name: 'materialized_views',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['id', 'name', 'ruleId', 'schema'],
            properties: {
              id: { bsonType: 'string' },
              name: { bsonType: 'string' },
              ruleId: { bsonType: 'string' },
              schema: { bsonType: 'object' }
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
    await this.db.collection('aggregation_rules').createIndex({ id: 1 }, { unique: true });
    await this.db.collection('aggregation_rules').createIndex({ isActive: 1, priority: 1 });
    await this.db.collection('aggregation_jobs').createIndex({ ruleId: 1, startTime: -1 });
    await this.db.collection('aggregation_jobs').createIndex({ status: 1 });
    await this.db.collection('aggregation_results').createIndex({ ruleId: 1, timestamp: -1 });
    await this.db.collection('aggregation_results').createIndex({ 'timeWindow.start': 1, 'timeWindow.end': 1 });
    await this.db.collection('materialized_views').createIndex({ id: 1 }, { unique: true });
    await this.db.collection('materialized_views').createIndex({ ruleId: 1 });
  }

  async createAggregationRule(rule: Omit<AggregationRule, 'createdAt' | 'updatedAt' | 'executionStats'>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const fullRule: AggregationRule = {
      ...rule,
      createdAt: new Date(),
      updatedAt: new Date(),
      executionStats: {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageExecutionTime: 0,
        dataProcessed: 0,
        outputGenerated: 0
      }
    };

    await this.db.collection('aggregation_rules').replaceOne(
      { id: rule.id },
      fullRule,
      { upsert: true }
    );

    this.aggregationRules.set(rule.id, fullRule);

    // Cache rule
    await this.redis.hset(
      'aggregation:rules',
      rule.id,
      JSON.stringify(fullRule)
    );

    // Schedule aggregation if active
    if (rule.isActive) {
      await this.scheduleAggregationRule(fullRule);
    }

    this.logger.info(`Aggregation rule created: ${rule.name}`);
  }

  async executeAggregation(ruleId: string, manual: boolean = false): Promise<string> {
    const rule = await this.getAggregationRule(ruleId);
    if (!rule) {
      throw new Error(`Aggregation rule not found: ${ruleId}`);
    }

    const jobId = `job_${ruleId}_${Date.now()}`;
    const job: AggregationJob = {
      id: jobId,
      ruleId,
      status: 'pending',
      startTime: new Date(),
      inputRecords: 0,
      outputRecords: 0,
      processingTime: 0,
      memoryUsed: 0,
      metadata: { manual }
    };

    this.runningJobs.set(jobId, job);
    await this.saveAggregationJob(job);

    // Execute aggregation asynchronously
    this.executeAggregationAsync(job, rule);

    return jobId;
  }

  private async executeAggregationAsync(job: AggregationJob, rule: AggregationRule): Promise<void> {
    const startTime = Date.now();
    
    try {
      job.status = 'running';
      await this.saveAggregationJob(job);

      // 1. Fetch source data
      const sourceData = await this.fetchSourceData(rule.source, rule.timeWindow, rule.filters);
      job.inputRecords = sourceData.length;

      // 2. Apply time windowing
      const windowedData = await this.applyTimeWindowing(sourceData, rule.timeWindow, rule.source.timeField);

      // 3. Group by dimensions
      const groupedData = await this.groupByDimensions(windowedData, rule.dimensions);

      // 4. Apply aggregations
      const aggregatedResults = await this.applyAggregations(groupedData, rule.aggregations);

      // 5. Save results
      await this.saveAggregationResults(aggregatedResults, job, rule);
      job.outputRecords = aggregatedResults.length;

      // 6. Update materialized views if configured
      if (rule.output.type === 'materialized_view') {
        await this.updateMaterializedView(rule.id, aggregatedResults);
      }

      job.status = 'completed';
      job.endTime = new Date();
      job.processingTime = Date.now() - startTime;

      // Update execution statistics
      await this.updateExecutionStats(rule.id, job);

      this.logger.info(`Aggregation completed: ${rule.id}`, {
        jobId: job.id,
        inputRecords: job.inputRecords,
        outputRecords: job.outputRecords,
        processingTime: job.processingTime
      });

    } catch (error) {
      job.status = 'failed';
      job.endTime = new Date();
      job.processingTime = Date.now() - startTime;
      job.errorMessage = error instanceof Error ? error.message : String(error);

      // Update execution statistics
      await this.updateExecutionStats(rule.id, job);

      this.logger.error(`Aggregation failed: ${rule.id}`, error);
    } finally {
      await this.saveAggregationJob(job);
      this.runningJobs.delete(job.id);
    }
  }

  private async fetchSourceData(
    source: DataSourceConfig,
    timeWindow: TimeWindowConfig,
    filters: FilterConfig[]
  ): Promise<any[]> {
    switch (source.type) {
      case 'mongodb':
        return await this.fetchMongoData(source, timeWindow, filters);
      case 'api':
        return await this.fetchAPIData(source, timeWindow, filters);
      case 'kpi':
        return await this.fetchKPIData(source, timeWindow, filters);
      default:
        throw new Error(`Unsupported source type: ${source.type}`);
    }
  }

  private async fetchMongoData(
    source: DataSourceConfig,
    timeWindow: TimeWindowConfig,
    filters: FilterConfig[]
  ): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    const collection = this.db.collection(source.connection.collection);
    let pipeline: any[] = [];

    // Build match stage
    const matchStage: any = {};

    // Apply time window filter
    if (source.timeField) {
      const now = new Date();
      const windowStart = this.calculateWindowStart(now, timeWindow);
      matchStage[source.timeField] = {
        $gte: windowStart,
        $lt: now
      };
    }

    // Apply additional filters
    for (const filter of filters) {
      const filterCondition = this.buildFilterCondition(filter);
      if (filter.logicalOperator === 'OR') {
        if (!matchStage.$or) matchStage.$or = [];
        matchStage.$or.push({ [filter.field]: filterCondition });
      } else {
        matchStage[filter.field] = filterCondition;
      }
    }

    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    // Project only required fields
    if (source.fields.length > 0) {
      const projectStage: any = {};
      for (const field of source.fields) {
        projectStage[field] = 1;
      }
      if (source.timeField && !source.fields.includes(source.timeField)) {
        projectStage[source.timeField] = 1;
      }
      pipeline.push({ $project: projectStage });
    }

    // Apply query if specified
    if (source.query) {
      pipeline = pipeline.concat(source.query);
    }

    return await collection.aggregate(pipeline).toArray();
  }

  private async fetchAPIData(
    source: DataSourceConfig,
    timeWindow: TimeWindowConfig,
    filters: FilterConfig[]
  ): Promise<any[]> {
    const url = new URL(source.connection.url);
    
    // Add time window parameters
    if (source.timeField) {
      const now = new Date();
      const windowStart = this.calculateWindowStart(now, timeWindow);
      url.searchParams.set('start_time', windowStart.toISOString());
      url.searchParams.set('end_time', now.toISOString());
    }

    // Add filter parameters
    for (const filter of filters) {
      url.searchParams.set(filter.field, String(filter.value));
    }

    const response = await fetch(url.toString(), {
      method: source.connection.method || 'GET',
      headers: source.connection.headers || {}
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [data];
  }

  private async fetchKPIData(
    source: DataSourceConfig,
    timeWindow: TimeWindowConfig,
    filters: FilterConfig[]
  ): Promise<any[]> {
    if (!this.db) return [];

    const now = new Date();
    const windowStart = this.calculateWindowStart(now, timeWindow);

    const matchFilter: any = {
      kpiId: source.connection.kpiId,
      timestamp: {
        $gte: windowStart,
        $lt: now
      }
    };

    // Apply additional filters
    for (const filter of filters) {
      matchFilter[filter.field] = this.buildFilterCondition(filter);
    }

    const values = await this.db.collection('kpi_values')
      .find(matchFilter)
      .sort({ timestamp: 1 })
      .toArray();

    return values;
  }

  private calculateWindowStart(now: Date, timeWindow: TimeWindowConfig): Date {
    const windowStart = new Date(now);
    
    switch (timeWindow.unit) {
      case 'minute':
        windowStart.setMinutes(windowStart.getMinutes() - timeWindow.size);
        break;
      case 'hour':
        windowStart.setHours(windowStart.getHours() - timeWindow.size);
        break;
      case 'day':
        windowStart.setDate(windowStart.getDate() - timeWindow.size);
        break;
      case 'week':
        windowStart.setDate(windowStart.getDate() - (timeWindow.size * 7));
        break;
      case 'month':
        windowStart.setMonth(windowStart.getMonth() - timeWindow.size);
        break;
      case 'quarter':
        windowStart.setMonth(windowStart.getMonth() - (timeWindow.size * 3));
        break;
      case 'year':
        windowStart.setFullYear(windowStart.getFullYear() - timeWindow.size);
        break;
    }

    return windowStart;
  }

  private buildFilterCondition(filter: FilterConfig): any {
    switch (filter.operator) {
      case '=': return filter.value;
      case '!=': return { $ne: filter.value };
      case '>': return { $gt: filter.value };
      case '<': return { $lt: filter.value };
      case '>=': return { $gte: filter.value };
      case '<=': return { $lte: filter.value };
      case 'in': return { $in: Array.isArray(filter.value) ? filter.value : [filter.value] };
      case 'not_in': return { $nin: Array.isArray(filter.value) ? filter.value : [filter.value] };
      case 'like': return { $regex: filter.value, $options: 'i' };
      case 'regex': return { $regex: filter.value };
      case 'between': return { $gte: filter.value[0], $lte: filter.value[1] };
      case 'exists': return { $exists: Boolean(filter.value) };
      default: return filter.value;
    }
  }

  private async applyTimeWindowing(
    data: any[],
    timeWindow: TimeWindowConfig,
    timeField?: string
  ): Promise<any[][]> {
    if (!timeField || timeWindow.type === 'tumbling') {
      return [data]; // Single window for tumbling or no time field
    }

    const windows: any[][] = [];
    const sortedData = data.sort((a, b) => 
      new Date(a[timeField]).getTime() - new Date(b[timeField]).getTime()
    );

    if (timeWindow.type === 'sliding') {
      const step = timeWindow.step || timeWindow.size;
      const windowSizeMs = this.getWindowSizeInMs(timeWindow);
      const stepMs = this.getWindowSizeInMs({ ...timeWindow, size: step });

      let windowStart = new Date(sortedData[0][timeField]);
      while (windowStart.getTime() < new Date(sortedData[sortedData.length - 1][timeField]).getTime()) {
        const windowEnd = new Date(windowStart.getTime() + windowSizeMs);
        const windowData = sortedData.filter(item => {
          const itemTime = new Date(item[timeField]);
          return itemTime >= windowStart && itemTime < windowEnd;
        });
        
        if (windowData.length > 0) {
          windows.push(windowData);
        }
        
        windowStart = new Date(windowStart.getTime() + stepMs);
      }
    } else if (timeWindow.type === 'session') {
      // Session-based windowing
      const sessionTimeout = timeWindow.sessionTimeout || 300000; // 5 minutes default
      let currentSession: any[] = [];
      let lastEventTime: Date | null = null;

      for (const item of sortedData) {
        const eventTime = new Date(item[timeField]);
        
        if (lastEventTime && (eventTime.getTime() - lastEventTime.getTime()) > sessionTimeout) {
          // Start new session
          if (currentSession.length > 0) {
            windows.push([...currentSession]);
          }
          currentSession = [];
        }
        
        currentSession.push(item);
        lastEventTime = eventTime;
      }
      
      if (currentSession.length > 0) {
        windows.push(currentSession);
      }
    }

    return windows.length > 0 ? windows : [data];
  }

  private getWindowSizeInMs(timeWindow: TimeWindowConfig): number {
    const multipliers = {
      minute: 60 * 1000,
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      quarter: 90 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000
    };

    return timeWindow.size * multipliers[timeWindow.unit];
  }

  private async groupByDimensions(
    windows: any[][],
    dimensions: DimensionConfig[]
  ): Promise<Map<string, any[]>[]> {
    const groupedWindows: Map<string, any[]>[] = [];

    for (const windowData of windows) {
      const grouped = new Map<string, any[]>();

      for (const item of windowData) {
        const dimensionKey = this.buildDimensionKey(item, dimensions);
        
        if (!grouped.has(dimensionKey)) {
          grouped.set(dimensionKey, []);
        }
        grouped.get(dimensionKey)!.push(item);
      }

      groupedWindows.push(grouped);
    }

    return groupedWindows;
  }

  private buildDimensionKey(item: any, dimensions: DimensionConfig[]): string {
    if (dimensions.length === 0) {
      return 'default';
    }

    const keyParts: string[] = [];
    
    for (const dimension of dimensions) {
      let value = this.getNestedValue(item, dimension.field);
      
      // Apply binning if configured
      if (dimension.binning && dimension.type === 'numeric') {
        value = this.applyBinning(value, dimension.binning);
      }
      
      keyParts.push(String(value || 'null'));
    }

    return keyParts.join('|');
  }

  private applyBinning(value: number, binning: BinningConfig): string {
    if (typeof value !== 'number' || isNaN(value)) {
      return 'unknown';
    }

    if (binning.type === 'custom' && Array.isArray(binning.bins)) {
      // Custom bin edges
      const bins = binning.bins as number[];
      for (let i = 0; i < bins.length - 1; i++) {
        if (value >= bins[i] && value < bins[i + 1]) {
          return binning.labels ? binning.labels[i] : `${bins[i]}-${bins[i + 1]}`;
        }
      }
      return binning.labels ? binning.labels[bins.length - 1] : `>=${bins[bins.length - 1]}`;
    } else {
      // Equal width binning (simplified)
      const numBins = typeof binning.bins === 'number' ? binning.bins : 10;
      const binIndex = Math.floor(value / numBins);
      return binning.labels ? binning.labels[binIndex] || 'other' : `bin_${binIndex}`;
    }
  }

  private async applyAggregations(
    groupedWindows: Map<string, any[]>[],
    aggregations: AggregationConfig[]
  ): Promise<AggregationResult[]> {
    const results: AggregationResult[] = [];

    for (let windowIndex = 0; windowIndex < groupedWindows.length; windowIndex++) {
      const grouped = groupedWindows[windowIndex];

      for (const [dimensionKey, items] of grouped) {
        const aggregates: Record<string, any> = {};
        
        for (const aggregation of aggregations) {
          const aggregateValue = await this.calculateAggregate(items, aggregation);
          const key = aggregation.alias || `${aggregation.function}_${aggregation.field}`;
          aggregates[key] = aggregateValue;
        }

        const dimensions = this.parseDimensionKey(dimensionKey);
        
        results.push({
          ruleId: '', // Will be set by caller
          jobId: '', // Will be set by caller
          timestamp: new Date(),
          timeWindow: {
            start: new Date(), // Will be calculated properly
            end: new Date()
          },
          dimensions,
          aggregates,
          metadata: {
            inputRecords: items.length,
            processingTime: 0,
            dataQuality: this.calculateDataQuality(items)
          }
        });
      }
    }

    return results;
  }

  private async calculateAggregate(items: any[], aggregation: AggregationConfig): Promise<any> {
    if (items.length === 0) {
      return null;
    }

    // Extract values for the field
    let values = items.map(item => this.getNestedValue(item, aggregation.field))
                     .filter(val => val != null);

    // Apply condition filter if specified
    if (aggregation.condition) {
      values = items.filter(item => this.evaluateCondition(item, aggregation.condition))
                   .map(item => this.getNestedValue(item, aggregation.field))
                   .filter(val => val != null);
    }

    if (values.length === 0) {
      return null;
    }

    // Convert to numbers for numeric aggregations
    const numericValues = values.map(val => Number(val)).filter(val => !isNaN(val));

    switch (aggregation.function) {
      case 'sum':
        return numericValues.reduce((sum, val) => sum + val, 0);
      
      case 'avg':
        return numericValues.length > 0 ? 
          numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length : null;
      
      case 'min':
        return numericValues.length > 0 ? Math.min(...numericValues) : null;
      
      case 'max':
        return numericValues.length > 0 ? Math.max(...numericValues) : null;
      
      case 'count':
        return values.length;
      
      case 'distinct':
        return new Set(values).size;
      
      case 'median':
        if (numericValues.length === 0) return null;
        const sorted = [...numericValues].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 ? 
          (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
      
      case 'percentile':
        if (numericValues.length === 0) return null;
        const percentile = aggregation.parameters?.percentile || 50;
        const sorted2 = [...numericValues].sort((a, b) => a - b);
        const index = Math.ceil((percentile / 100) * sorted2.length) - 1;
        return sorted2[Math.max(0, index)];
      
      case 'stddev':
        if (numericValues.length < 2) return null;
        const mean = numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length;
        const variance = numericValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / numericValues.length;
        return Math.sqrt(variance);
      
      case 'variance':
        if (numericValues.length < 2) return null;
        const mean2 = numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length;
        return numericValues.reduce((sum, val) => sum + Math.pow(val - mean2, 2), 0) / numericValues.length;
      
      case 'first':
        return values[0];
      
      case 'last':
        return values[values.length - 1];
      
      case 'custom':
        return await this.calculateCustomAggregate(values, aggregation.parameters);
      
      default:
        throw new Error(`Unsupported aggregation function: ${aggregation.function}`);
    }
  }

  private evaluateCondition(item: any, condition: string): boolean {
    // Simple condition evaluation (would be more sophisticated in production)
    try {
      // Replace field references with actual values
      const evaluableCondition = condition.replace(/\{(\w+)\}/g, (match, field) => {
        const value = this.getNestedValue(item, field);
        return typeof value === 'string' ? `"${value}"` : String(value);
      });
      
      return eval(evaluableCondition);
    } catch {
      return true; // Default to include if condition evaluation fails
    }
  }

  private async calculateCustomAggregate(values: any[], parameters?: Record<string, any>): Promise<any> {
    // Placeholder for custom aggregation functions
    const customFunction = parameters?.function;
    
    switch (customFunction) {
      case 'geometric_mean':
        const product = values.reduce((prod, val) => prod * Number(val), 1);
        return Math.pow(product, 1 / values.length);
      
      case 'harmonic_mean':
        const reciprocalSum = values.reduce((sum, val) => sum + (1 / Number(val)), 0);
        return values.length / reciprocalSum;
      
      default:
        return null;
    }
  }

  private calculateDataQuality(items: any[]): number {
    if (items.length === 0) return 0;

    let qualityScore = 1.0;
    
    // Check for missing values
    const totalFields = Object.keys(items[0] || {}).length;
    let missingValues = 0;
    
    for (const item of items) {
      for (const key in item) {
        if (item[key] == null || item[key] === '') {
          missingValues++;
        }
      }
    }
    
    const completeness = 1 - (missingValues / (items.length * totalFields));
    qualityScore *= completeness;
    
    return Math.max(0, Math.min(1, qualityScore));
  }

  private parseDimensionKey(key: string): Record<string, any> {
    if (key === 'default') {
      return {};
    }
    
    // Simple parsing - in production would maintain dimension metadata
    const parts = key.split('|');
    const dimensions: Record<string, any> = {};
    
    parts.forEach((part, index) => {
      dimensions[`dim_${index}`] = part === 'null' ? null : part;
    });
    
    return dimensions;
  }

  private async saveAggregationResults(
    results: AggregationResult[],
    job: AggregationJob,
    rule: AggregationRule
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Set job and rule IDs
    for (const result of results) {
      result.ruleId = rule.id;
      result.jobId = job.id;
    }

    // Save to database
    if (results.length > 0) {
      await this.db.collection('aggregation_results').insertMany(results);
    }

    // Save to output destination
    await this.saveToOutputDestination(results, rule.output);

    // Cache latest results
    await this.redis.hset(
      'aggregation:latest_results',
      rule.id,
      JSON.stringify(results.slice(-10)) // Keep last 10 results
    );
  }

  private async saveToOutputDestination(results: AggregationResult[], output: OutputConfig): Promise<void> {
    switch (output.type) {
      case 'mongodb':
        await this.saveToMongoDB(results, output);
        break;
      case 'redis':
        await this.saveToRedis(results, output);
        break;
      case 'file':
        await this.saveToFile(results, output);
        break;
      case 'api':
        await this.saveToAPI(results, output);
        break;
      case 'materialized_view':
        // Handled separately in updateMaterializedView
        break;
    }
  }

  private async saveToMongoDB(results: AggregationResult[], output: OutputConfig): Promise<void> {
    if (!this.db) return;

    const collection = this.db.collection(output.destination.collection);
    
    if (results.length > 0) {
      await collection.insertMany(results);
    }
  }

  private async saveToRedis(results: AggregationResult[], output: OutputConfig): Promise<void> {
    const key = output.destination.key;
    
    for (const result of results) {
      const value = JSON.stringify(result);
      
      if (output.destination.type === 'list') {
        await this.redis.lpush(key, value);
        await this.redis.ltrim(key, 0, output.destination.maxSize || 1000);
      } else {
        await this.redis.set(`${key}:${result.timestamp.getTime()}`, value);
        if (output.destination.ttl) {
          await this.redis.expire(`${key}:${result.timestamp.getTime()}`, output.destination.ttl);
        }
      }
    }
  }

  private async saveToFile(results: AggregationResult[], output: OutputConfig): Promise<void> {
    // File saving implementation would depend on the specific file system
    this.logger.info(`Would save ${results.length} results to file: ${output.destination.path}`);
  }

  private async saveToAPI(results: AggregationResult[], output: OutputConfig): Promise<void> {
    try {
      await fetch(output.destination.url, {
        method: output.destination.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...output.destination.headers
        },
        body: JSON.stringify(results)
      });
    } catch (error) {
      this.logger.error(`Failed to save to API: ${output.destination.url}`, error);
    }
  }

  private async updateMaterializedView(ruleId: string, results: AggregationResult[]): Promise<void> {
    const view = Array.from(this.materializedViews.values()).find(v => v.ruleId === ruleId);
    if (!view) return;

    // Update view data (simplified implementation)
    view.statistics.totalRecords += results.length;
    view.lastRefreshed = new Date();

    await this.saveMaterializedView(view);
  }

  private async updateExecutionStats(ruleId: string, job: AggregationJob): Promise<void> {
    const rule = this.aggregationRules.get(ruleId);
    if (!rule) return;

    rule.executionStats.totalExecutions++;
    
    if (job.status === 'completed') {
      rule.executionStats.successfulExecutions++;
      rule.executionStats.dataProcessed += job.inputRecords;
      rule.executionStats.outputGenerated += job.outputRecords;
      
      // Update average execution time
      const totalTime = (rule.executionStats.averageExecutionTime * (rule.executionStats.successfulExecutions - 1)) + job.processingTime;
      rule.executionStats.averageExecutionTime = totalTime / rule.executionStats.successfulExecutions;
    } else {
      rule.executionStats.failedExecutions++;
      rule.executionStats.lastError = job.errorMessage;
    }

    rule.executionStats.lastExecutionTime = job.processingTime;
    rule.lastExecuted = job.endTime || job.startTime;
    rule.updatedAt = new Date();

    await this.saveAggregationRule(rule);
  }

  private async getAggregationRule(ruleId: string): Promise<AggregationRule | null> {
    let rule = this.aggregationRules.get(ruleId);
    
    if (!rule) {
      const cached = await this.redis.hget('aggregation:rules', ruleId);
      if (cached) {
        rule = JSON.parse(cached);
        this.aggregationRules.set(ruleId, rule);
      }
    }

    if (!rule && this.db) {
      const stored = await this.db.collection('aggregation_rules').findOne({ id: ruleId });
      if (stored) {
        rule = stored as AggregationRule;
        this.aggregationRules.set(ruleId, rule);
        await this.redis.hset('aggregation:rules', ruleId, JSON.stringify(rule));
      }
    }

    return rule || null;
  }

  private async saveAggregationRule(rule: AggregationRule): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.collection('aggregation_rules').replaceOne(
      { id: rule.id },
      rule,
      { upsert: true }
    );

    this.aggregationRules.set(rule.id, rule);
    
    await this.redis.hset(
      'aggregation:rules',
      rule.id,
      JSON.stringify(rule)
    );
  }

  private async saveAggregationJob(job: AggregationJob): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.collection('aggregation_jobs').replaceOne(
      { id: job.id },
      job,
      { upsert: true }
    );

    this.runningJobs.set(job.id, job);
  }

  private async saveMaterializedView(view: MaterializedView): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.collection('materialized_views').replaceOne(
      { id: view.id },
      view,
      { upsert: true }
    );

    this.materializedViews.set(view.id, view);
  }

  private async scheduleAggregationRule(rule: AggregationRule): Promise<void> {
    if (this.scheduledTasks.has(rule.id)) {
      this.scheduledTasks.get(rule.id)?.destroy();
    }

    if (rule.schedule.type === 'cron' && rule.schedule.expression) {
      const task = cron.schedule(rule.schedule.expression, async () => {
        try {
          await this.executeAggregation(rule.id);
        } catch (error) {
          this.logger.error(`Scheduled aggregation failed: ${rule.id}`, error);
        }
      }, {
        scheduled: false
      });

      task.start();
      this.scheduledTasks.set(rule.id, task);
      
      this.logger.info(`Aggregation scheduled: ${rule.name} with expression ${rule.schedule.expression}`);
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private async loadAggregationRules(): Promise<void> {
    if (!this.db) return;

    const rules = await this.db.collection('aggregation_rules').find({}).toArray();
    for (const rule of rules) {
      this.aggregationRules.set(rule.id, rule as AggregationRule);
    }
  }

  private async loadMaterializedViews(): Promise<void> {
    if (!this.db) return;

    const views = await this.db.collection('materialized_views').find({}).toArray();
    for (const view of views) {
      this.materializedViews.set(view.id, view as MaterializedView);
    }
  }

  private async scheduleAggregations(): Promise<void> {
    for (const rule of this.aggregationRules.values()) {
      if (rule.isActive) {
        await this.scheduleAggregationRule(rule);
      }
    }
  }

  private async createDefaultAggregations(): Promise<void> {
    const defaultRules: Omit<AggregationRule, 'createdAt' | 'updatedAt' | 'executionStats'>[] = [
      {
        id: 'daily_claims_summary',
        name: 'Daily Claims Summary',
        description: 'Daily aggregation of claims by status and hospital',
        source: {
          type: 'mongodb',
          connection: { collection: 'claims' },
          fields: ['status', 'hospitalId', 'amount', 'claimType', 'createdAt'],
          timeField: 'createdAt'
        },
        aggregations: [
          { field: 'amount', function: 'sum', alias: 'total_amount' },
          { field: 'amount', function: 'avg', alias: 'avg_amount' },
          { field: 'status', function: 'count', alias: 'claim_count' },
          { field: 'claimType', function: 'distinct', alias: 'unique_claim_types' }
        ],
        dimensions: [
          { field: 'status', type: 'categorical' },
          { field: 'hospitalId', type: 'categorical' },
          { field: 'claimType', type: 'categorical' }
        ],
        timeWindow: {
          size: 1,
          unit: 'day',
          type: 'tumbling',
          alignment: 'calendar'
        },
        output: {
          type: 'mongodb',
          destination: { collection: 'daily_claims_summary' },
          format: 'json'
        },
        filters: [],
        schedule: {
          type: 'cron',
          expression: '0 1 * * *' // Daily at 1 AM
        },
        performance: {
          batchSize: 10000,
          parallelism: 4,
          memoryLimit: 512,
          timeout: 300,
          retries: 3,
          optimization: {
            pushdownFilters: true,
            indexHints: ['createdAt_1', 'status_1'],
            caching: {
              enabled: true,
              ttl: 3600,
              strategy: 'ttl',
              maxSize: 100
            }
          }
        },
        isActive: true,
        priority: 'high',
        createdBy: 'system'
      }
    ];

    for (const rule of defaultRules) {
      try {
        const existing = await this.getAggregationRule(rule.id);
        if (!existing) {
          await this.createAggregationRule(rule);
        }
      } catch (error) {
        this.logger.error(`Failed to create default aggregation rule: ${rule.name}`, error);
      }
    }
  }

  async listAggregationRules(active?: boolean): Promise<AggregationRule[]> {
    const rules = Array.from(this.aggregationRules.values());
    
    if (active !== undefined) {
      return rules.filter(rule => rule.isActive === active);
    }
    
    return rules;
  }

  async getAggregationJob(jobId: string): Promise<AggregationJob | null> {
    let job = this.runningJobs.get(jobId);

    if (!job && this.db) {
      const stored = await this.db.collection('aggregation_jobs').findOne({ id: jobId });
      if (stored) {
        job = stored as AggregationJob;
      }
    }

    return job || null;
  }

  async getAggregationResults(
    ruleId: string,
    options: {
      startTime?: Date;
      endTime?: Date;
      dimensions?: Record<string, any>;
      limit?: number;
    } = {}
  ): Promise<AggregationResult[]> {
    if (!this.db) throw new Error('Database not initialized');

    const filter: any = { ruleId };
    
    if (options.startTime || options.endTime) {
      filter.timestamp = {};
      if (options.startTime) filter.timestamp.$gte = options.startTime;
      if (options.endTime) filter.timestamp.$lte = options.endTime;
    }

    if (options.dimensions) {
      for (const [key, value] of Object.entries(options.dimensions)) {
        filter[`dimensions.${key}`] = value;
      }
    }

    const results = await this.db.collection('aggregation_results')
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(options.limit || 100)
      .toArray();

    return results as AggregationResult[];
  }
}
