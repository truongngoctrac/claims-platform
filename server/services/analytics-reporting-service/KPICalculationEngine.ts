import { MongoClient, Db } from 'mongodb';
import IORedis from 'ioredis';
import winston from 'winston';
import cron from 'node-cron';

export interface KPIDefinition {
  id: string;
  name: string;
  description: string;
  category: 'financial' | 'operational' | 'quality' | 'performance' | 'compliance' | 'custom';
  type: 'simple' | 'compound' | 'ratio' | 'percentage' | 'trend' | 'threshold';
  formula: KPIFormula;
  target?: {
    value: number;
    operator: '>' | '<' | '>=' | '<=' | '=' | 'between';
    range?: { min: number; max: number };
  };
  dimensions: string[]; // Fields to group by
  timeGranularity: 'real-time' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  dataSource: DataSourceConfig;
  calculation: CalculationConfig;
  alerts: KPIAlert[];
  permissions: PermissionConfig;
  metadata: Record<string, any>;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface KPIFormula {
  type: 'aggregation' | 'expression' | 'custom';
  numerator?: FormulaComponent;
  denominator?: FormulaComponent;
  expression?: string;
  customFunction?: string;
  constants?: Record<string, number>;
}

export interface FormulaComponent {
  dataSource: string;
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct' | 'first' | 'last';
  field?: string;
  filters?: FilterCondition[];
}

export interface FilterCondition {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'in' | 'not_in' | 'like' | 'between';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export interface DataSourceConfig {
  type: 'mongodb' | 'api' | 'redis' | 'calculated';
  connection: any;
  collection?: string;
  query?: any;
  refreshInterval: number; // in seconds
  cacheable: boolean;
}

export interface CalculationConfig {
  schedule: string; // Cron expression
  lookbackPeriod: number; // in days
  rollingWindow?: number; // for moving averages
  compareWithPrevious: boolean;
  seasonalAdjustment: boolean;
  outlierDetection: boolean;
}

export interface KPIAlert {
  id: string;
  name: string;
  condition: {
    operator: '>' | '<' | '>=' | '<=' | '=' | '!=' | 'trend_up' | 'trend_down' | 'no_data';
    threshold?: number;
    percentage?: number; // for percentage changes
    consecutivePeriods?: number; // for trend alerts
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  actions: AlertAction[];
  isEnabled: boolean;
  cooldownPeriod: number; // in seconds
  lastTriggered?: Date;
}

export interface AlertAction {
  type: 'email' | 'webhook' | 'dashboard' | 'log' | 'escalate';
  config: Record<string, any>;
}

export interface PermissionConfig {
  viewRoles: string[];
  editRoles: string[];
  deleteRoles: string[];
  dataFilters?: Record<string, any>;
}

export interface KPIValue {
  kpiId: string;
  value: number;
  previousValue?: number;
  target?: number;
  variance?: number;
  percentageChange?: number;
  trend: 'up' | 'down' | 'stable';
  status: 'good' | 'warning' | 'critical' | 'unknown';
  dimensions: Record<string, string>;
  timestamp: Date;
  calculationTime: number;
  dataQuality: {
    completeness: number;
    accuracy: number;
    timeliness: number;
    consistency: number;
  };
  metadata: Record<string, any>;
}

export interface KPICalculationJob {
  id: string;
  kpiId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  errorMessage?: string;
  valuesCalculated: number;
  executionTime: number;
}

export interface KPIComparison {
  kpiId: string;
  current: KPIValue;
  previous?: KPIValue;
  target?: number;
  benchmark?: number;
  percentile?: number;
  ranking?: number;
}

export class KPICalculationEngine {
  private db: Db | null = null;
  private redis: IORedis;
  private logger: winston.Logger;
  private kpiDefinitions: Map<string, KPIDefinition> = new Map();
  private calculationJobs: Map<string, KPICalculationJob> = new Map();
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();
  private runningCalculations: Set<string> = new Set();

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
        new winston.transports.File({ filename: 'logs/kpi-calculation.log' })
      ]
    });
  }

  async initialize(): Promise<void> {
    try {
      const client = new MongoClient(this.connectionString);
      await client.connect();
      this.db = client.db(this.databaseName);
      
      await this.createKPISchema();
      await this.loadKPIDefinitions();
      await this.scheduleCalculations();
      await this.createDefaultKPIs();
      
      this.logger.info('KPI Calculation Engine initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize KPI Calculation Engine', error);
      throw error;
    }
  }

  private async createKPISchema(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const collections = [
      {
        name: 'kpi_definitions',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['id', 'name', 'category', 'type', 'formula', 'dataSource'],
            properties: {
              id: { bsonType: 'string' },
              name: { bsonType: 'string' },
              category: { enum: ['financial', 'operational', 'quality', 'performance', 'compliance', 'custom'] },
              type: { enum: ['simple', 'compound', 'ratio', 'percentage', 'trend', 'threshold'] },
              formula: { bsonType: 'object' },
              timeGranularity: { enum: ['real-time', 'hourly', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'] }
            }
          }
        }
      },
      {
        name: 'kpi_values',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['kpiId', 'value', 'timestamp'],
            properties: {
              kpiId: { bsonType: 'string' },
              value: { bsonType: 'number' },
              timestamp: { bsonType: 'date' },
              trend: { enum: ['up', 'down', 'stable'] },
              status: { enum: ['good', 'warning', 'critical', 'unknown'] }
            }
          }
        }
      },
      {
        name: 'kpi_calculation_jobs',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['id', 'kpiId', 'status', 'startTime'],
            properties: {
              id: { bsonType: 'string' },
              kpiId: { bsonType: 'string' },
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
    await this.db.collection('kpi_definitions').createIndex({ id: 1 }, { unique: true });
    await this.db.collection('kpi_definitions').createIndex({ category: 1, isActive: 1 });
    await this.db.collection('kpi_values').createIndex({ kpiId: 1, timestamp: -1 });
    await this.db.collection('kpi_values').createIndex({ timestamp: -1 });
    await this.db.collection('kpi_calculation_jobs').createIndex({ kpiId: 1, startTime: -1 });
    await this.db.collection('kpi_calculation_jobs').createIndex({ status: 1 });
  }

  async createKPI(kpi: Omit<KPIDefinition, 'createdAt' | 'updatedAt'>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const fullKPI: KPIDefinition = {
      ...kpi,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.db.collection('kpi_definitions').replaceOne(
      { id: kpi.id },
      fullKPI,
      { upsert: true }
    );

    this.kpiDefinitions.set(kpi.id, fullKPI);

    // Cache KPI definition
    await this.redis.hset(
      'kpi:definitions',
      kpi.id,
      JSON.stringify(fullKPI)
    );

    // Schedule calculation if active
    if (kpi.isActive) {
      await this.scheduleKPICalculation(fullKPI);
    }

    this.logger.info(`KPI created: ${kpi.name}`);
  }

  async updateKPI(kpiId: string, updates: Partial<KPIDefinition>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.collection('kpi_definitions').updateOne(
      { id: kpiId },
      { $set: { ...updates, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      throw new Error(`KPI not found: ${kpiId}`);
    }

    // Update cache
    const kpi = await this.getKPI(kpiId);
    if (kpi) {
      this.kpiDefinitions.set(kpiId, kpi);
      await this.redis.hset(
        'kpi:definitions',
        kpiId,
        JSON.stringify(kpi)
      );

      // Reschedule if calculation config changed
      if (updates.calculation || updates.isActive !== undefined) {
        await this.unscheduleKPICalculation(kpiId);
        if (kpi.isActive) {
          await this.scheduleKPICalculation(kpi);
        }
      }
    }

    this.logger.info(`KPI updated: ${kpiId}`);
  }

  async getKPI(kpiId: string): Promise<KPIDefinition | null> {
    // Try cache first
    let kpi = this.kpiDefinitions.get(kpiId);
    
    if (!kpi) {
      const cached = await this.redis.hget('kpi:definitions', kpiId);
      if (cached) {
        kpi = JSON.parse(cached);
        this.kpiDefinitions.set(kpiId, kpi);
      }
    }

    if (!kpi && this.db) {
      const stored = await this.db.collection('kpi_definitions').findOne({ id: kpiId });
      if (stored) {
        kpi = stored as KPIDefinition;
        this.kpiDefinitions.set(kpiId, kpi);
        await this.redis.hset(
          'kpi:definitions',
          kpiId,
          JSON.stringify(kpi)
        );
      }
    }

    return kpi || null;
  }

  async listKPIs(category?: string, active?: boolean): Promise<KPIDefinition[]> {
    if (!this.db) throw new Error('Database not initialized');

    const filter: any = {};
    if (category) filter.category = category;
    if (active !== undefined) filter.isActive = active;

    const kpis = await this.db.collection('kpi_definitions')
      .find(filter)
      .sort({ name: 1 })
      .toArray();

    return kpis as KPIDefinition[];
  }

  async calculateKPI(kpiId: string, manual: boolean = false): Promise<string> {
    if (this.runningCalculations.has(kpiId)) {
      throw new Error(`KPI calculation already running: ${kpiId}`);
    }

    const kpi = await this.getKPI(kpiId);
    if (!kpi) {
      throw new Error(`KPI not found: ${kpiId}`);
    }

    const jobId = `job_${kpiId}_${Date.now()}`;
    const job: KPICalculationJob = {
      id: jobId,
      kpiId,
      status: 'pending',
      startTime: new Date(),
      valuesCalculated: 0,
      executionTime: 0
    };

    this.calculationJobs.set(jobId, job);
    this.runningCalculations.add(kpiId);

    try {
      await this.saveCalculationJob(job);
      job.status = 'running';
      await this.saveCalculationJob(job);

      // Calculate KPI values
      const values = await this.executeKPICalculation(kpi);
      
      // Save calculated values
      for (const value of values) {
        await this.saveKPIValue(value);
      }

      // Check alerts
      for (const value of values) {
        await this.checkKPIAlerts(kpi, value);
      }

      job.status = 'completed';
      job.endTime = new Date();
      job.valuesCalculated = values.length;
      job.executionTime = job.endTime.getTime() - job.startTime.getTime();

      await this.saveCalculationJob(job);

      this.logger.info(`KPI calculation completed: ${kpiId}`, {
        jobId,
        valuesCalculated: values.length,
        executionTime: job.executionTime
      });

    } catch (error) {
      job.status = 'failed';
      job.endTime = new Date();
      job.errorMessage = error instanceof Error ? error.message : String(error);
      job.executionTime = job.endTime.getTime() - job.startTime.getTime();

      await this.saveCalculationJob(job);

      this.logger.error(`KPI calculation failed: ${kpiId}`, error);
      throw error;
    } finally {
      this.runningCalculations.delete(kpiId);
    }

    return jobId;
  }

  private async executeKPICalculation(kpi: KPIDefinition): Promise<KPIValue[]> {
    const startTime = Date.now();
    
    // Get data from data source
    const rawData = await this.fetchKPIData(kpi);
    
    // Group data by dimensions if specified
    const groupedData = this.groupDataByDimensions(rawData, kpi.dimensions);
    
    const values: KPIValue[] = [];

    for (const [dimensionKey, data] of Object.entries(groupedData)) {
      // Calculate KPI value using formula
      const calculatedValue = await this.applyKPIFormula(kpi.formula, data, kpi);
      
      // Get previous value for comparison
      const previousValue = await this.getPreviousKPIValue(kpi.id, this.parseDimensionKey(dimensionKey));
      
      // Calculate additional metrics
      const kpiValue = await this.enrichKPIValue(kpi, calculatedValue, previousValue, this.parseDimensionKey(dimensionKey));
      
      kpiValue.calculationTime = Date.now() - startTime;
      values.push(kpiValue);
    }

    return values;
  }

  private async fetchKPIData(kpi: KPIDefinition): Promise<any[]> {
    const { dataSource } = kpi;
    
    switch (dataSource.type) {
      case 'mongodb':
        return await this.fetchMongoDBData(dataSource);
      case 'api':
        return await this.fetchAPIData(dataSource);
      case 'redis':
        return await this.fetchRedisData(dataSource);
      case 'calculated':
        return await this.fetchCalculatedData(dataSource);
      default:
        throw new Error(`Unsupported data source type: ${dataSource.type}`);
    }
  }

  private async fetchMongoDBData(dataSource: DataSourceConfig): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    const collection = this.db.collection(dataSource.collection!);
    
    if (dataSource.query?.aggregation) {
      return await collection.aggregate(dataSource.query.aggregation).toArray();
    } else {
      return await collection.find(dataSource.query?.filter || {})
        .sort(dataSource.query?.sort || {})
        .limit(dataSource.query?.limit || 10000)
        .toArray();
    }
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

  private async fetchCalculatedData(dataSource: DataSourceConfig): Promise<any[]> {
    // For calculated data sources, fetch from other KPIs or calculated metrics
    const kpiId = dataSource.connection.kpiId;
    const values = await this.getKPIValues(kpiId, { limit: 1000 });
    return values;
  }

  private groupDataByDimensions(data: any[], dimensions: string[]): Record<string, any[]> {
    if (dimensions.length === 0) {
      return { 'default': data };
    }

    const grouped: Record<string, any[]> = {};
    
    for (const item of data) {
      const dimensionValues = dimensions.map(dim => this.getNestedValue(item, dim));
      const key = dimensionValues.join('|');
      
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(item);
    }

    return grouped;
  }

  private async applyKPIFormula(formula: KPIFormula, data: any[], kpi: KPIDefinition): Promise<number> {
    switch (formula.type) {
      case 'aggregation':
        return await this.calculateAggregationFormula(formula, data);
      case 'expression':
        return await this.calculateExpressionFormula(formula, data, kpi);
      case 'custom':
        return await this.calculateCustomFormula(formula, data, kpi);
      default:
        throw new Error(`Unsupported formula type: ${formula.type}`);
    }
  }

  private async calculateAggregationFormula(formula: KPIFormula, data: any[]): Promise<number> {
    if (!formula.numerator) {
      throw new Error('Numerator required for aggregation formula');
    }

    const numeratorValue = this.calculateFormulaComponent(formula.numerator, data);
    
    if (formula.denominator) {
      const denominatorValue = this.calculateFormulaComponent(formula.denominator, data);
      return denominatorValue !== 0 ? numeratorValue / denominatorValue : 0;
    }
    
    return numeratorValue;
  }

  private calculateFormulaComponent(component: FormulaComponent, data: any[]): number {
    // Apply filters first
    let filteredData = data;
    if (component.filters && component.filters.length > 0) {
      filteredData = this.applyFilters(data, component.filters);
    }

    // Extract field values if specified
    let values: number[];
    if (component.field) {
      values = filteredData.map(item => Number(this.getNestedValue(item, component.field!)) || 0);
    } else {
      values = [filteredData.length]; // Count records
    }

    // Apply aggregation
    switch (component.aggregation) {
      case 'sum':
        return values.reduce((sum, val) => sum + val, 0);
      case 'avg':
        return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
      case 'count':
        return filteredData.length;
      case 'min':
        return values.length > 0 ? Math.min(...values) : 0;
      case 'max':
        return values.length > 0 ? Math.max(...values) : 0;
      case 'distinct':
        return new Set(values).size;
      case 'first':
        return values[0] || 0;
      case 'last':
        return values[values.length - 1] || 0;
      default:
        return 0;
    }
  }

  private applyFilters(data: any[], filters: FilterCondition[]): any[] {
    return data.filter(item => {
      let result = true;
      let currentResult = true;

      for (let i = 0; i < filters.length; i++) {
        const filter = filters[i];
        const fieldValue = this.getNestedValue(item, filter.field);
        
        const conditionMet = this.evaluateFilterCondition(fieldValue, filter);
        
        if (i === 0) {
          currentResult = conditionMet;
        } else {
          const logicalOp = filters[i - 1].logicalOperator || 'AND';
          if (logicalOp === 'AND') {
            currentResult = currentResult && conditionMet;
          } else {
            currentResult = currentResult || conditionMet;
          }
        }
      }

      return currentResult;
    });
  }

  private evaluateFilterCondition(fieldValue: any, filter: FilterCondition): boolean {
    switch (filter.operator) {
      case '=':
        return fieldValue === filter.value;
      case '!=':
        return fieldValue !== filter.value;
      case '>':
        return Number(fieldValue) > Number(filter.value);
      case '<':
        return Number(fieldValue) < Number(filter.value);
      case '>=':
        return Number(fieldValue) >= Number(filter.value);
      case '<=':
        return Number(fieldValue) <= Number(filter.value);
      case 'in':
        return Array.isArray(filter.value) && filter.value.includes(fieldValue);
      case 'not_in':
        return Array.isArray(filter.value) && !filter.value.includes(fieldValue);
      case 'like':
        return String(fieldValue).toLowerCase().includes(String(filter.value).toLowerCase());
      case 'between':
        const num = Number(fieldValue);
        return Array.isArray(filter.value) && num >= filter.value[0] && num <= filter.value[1];
      default:
        return true;
    }
  }

  private async calculateExpressionFormula(formula: KPIFormula, data: any[], kpi: KPIDefinition): Promise<number> {
    if (!formula.expression) {
      throw new Error('Expression required for expression formula');
    }

    // Calculate intermediate values
    const variables: Record<string, number> = {};
    
    // Add constants
    if (formula.constants) {
      Object.assign(variables, formula.constants);
    }

    // Add data aggregations (simplified expression evaluation)
    variables.COUNT = data.length;
    variables.SUM = data.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    variables.AVG = variables.COUNT > 0 ? variables.SUM / variables.COUNT : 0;

    // Evaluate expression (in production, use a proper expression engine)
    try {
      const expression = formula.expression.replace(/\{(\w+)\}/g, (match, varName) => {
        return variables[varName] !== undefined ? variables[varName].toString() : '0';
      });
      
      return eval(expression);
    } catch (error) {
      this.logger.error(`Expression evaluation failed: ${formula.expression}`, error);
      return 0;
    }
  }

  private async calculateCustomFormula(formula: KPIFormula, data: any[], kpi: KPIDefinition): Promise<number> {
    // Custom formula implementation would call registered custom functions
    this.logger.warn(`Custom formula not implemented: ${formula.customFunction}`);
    return 0;
  }

  private async enrichKPIValue(
    kpi: KPIDefinition,
    value: number,
    previousValue: KPIValue | null,
    dimensions: Record<string, string>
  ): Promise<KPIValue> {
    const kpiValue: KPIValue = {
      kpiId: kpi.id,
      value,
      previousValue: previousValue?.value,
      dimensions,
      timestamp: new Date(),
      calculationTime: 0,
      trend: 'stable',
      status: 'unknown',
      dataQuality: {
        completeness: 1.0,
        accuracy: 1.0,
        timeliness: 1.0,
        consistency: 1.0
      },
      metadata: {}
    };

    // Calculate target and variance
    if (kpi.target) {
      kpiValue.target = kpi.target.value;
      kpiValue.variance = value - kpi.target.value;
    }

    // Calculate percentage change
    if (previousValue) {
      if (previousValue.value !== 0) {
        kpiValue.percentageChange = ((value - previousValue.value) / previousValue.value) * 100;
      }
      
      // Determine trend
      if (value > previousValue.value) {
        kpiValue.trend = 'up';
      } else if (value < previousValue.value) {
        kpiValue.trend = 'down';
      } else {
        kpiValue.trend = 'stable';
      }
    }

    // Determine status based on target
    if (kpi.target) {
      kpiValue.status = this.determineKPIStatus(value, kpi.target);
    } else {
      kpiValue.status = 'good'; // Default if no target defined
    }

    return kpiValue;
  }

  private determineKPIStatus(value: number, target: KPIDefinition['target']): 'good' | 'warning' | 'critical' | 'unknown' {
    if (!target) return 'unknown';

    switch (target.operator) {
      case '>':
        return value > target.value ? 'good' : 'critical';
      case '<':
        return value < target.value ? 'good' : 'critical';
      case '>=':
        return value >= target.value ? 'good' : 'critical';
      case '<=':
        return value <= target.value ? 'good' : 'critical';
      case '=':
        return value === target.value ? 'good' : 'critical';
      case 'between':
        if (target.range) {
          if (value >= target.range.min && value <= target.range.max) {
            return 'good';
          } else if (value >= target.range.min * 0.9 && value <= target.range.max * 1.1) {
            return 'warning';
          } else {
            return 'critical';
          }
        }
        return 'unknown';
      default:
        return 'unknown';
    }
  }

  private async getPreviousKPIValue(kpiId: string, dimensions: Record<string, string>): Promise<KPIValue | null> {
    if (!this.db) return null;

    const filter: any = { kpiId };
    
    // Add dimension filters
    for (const [key, value] of Object.entries(dimensions)) {
      filter[`dimensions.${key}`] = value;
    }

    const previous = await this.db.collection('kpi_values')
      .findOne(filter, { sort: { timestamp: -1 } });

    return previous as KPIValue | null;
  }

  private async saveKPIValue(value: KPIValue): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.collection('kpi_values').insertOne(value);

    // Cache latest value
    await this.redis.hset(
      'kpi:latest_values',
      `${value.kpiId}:${JSON.stringify(value.dimensions)}`,
      JSON.stringify(value)
    );

    // Publish real-time update
    await this.redis.publish('kpi:updates', JSON.stringify({
      type: 'value_updated',
      kpiId: value.kpiId,
      value: value.value,
      status: value.status,
      timestamp: value.timestamp
    }));
  }

  private async checkKPIAlerts(kpi: KPIDefinition, value: KPIValue): Promise<void> {
    for (const alert of kpi.alerts) {
      if (!alert.isEnabled) continue;

      // Check cooldown period
      if (alert.lastTriggered) {
        const timeSinceLastTrigger = Date.now() - alert.lastTriggered.getTime();
        if (timeSinceLastTrigger < alert.cooldownPeriod * 1000) {
          continue;
        }
      }

      const isTriggered = await this.evaluateAlertCondition(alert, value);
      
      if (isTriggered) {
        await this.triggerKPIAlert(kpi, alert, value);
      }
    }
  }

  private async evaluateAlertCondition(alert: KPIAlert, value: KPIValue): Promise<boolean> {
    const { condition } = alert;

    switch (condition.operator) {
      case '>':
        return condition.threshold !== undefined && value.value > condition.threshold;
      case '<':
        return condition.threshold !== undefined && value.value < condition.threshold;
      case '>=':
        return condition.threshold !== undefined && value.value >= condition.threshold;
      case '<=':
        return condition.threshold !== undefined && value.value <= condition.threshold;
      case '=':
        return condition.threshold !== undefined && value.value === condition.threshold;
      case '!=':
        return condition.threshold !== undefined && value.value !== condition.threshold;
      case 'trend_up':
        return value.trend === 'up' && this.checkConsecutiveTrend(value, 'up', condition.consecutivePeriods || 1);
      case 'trend_down':
        return value.trend === 'down' && this.checkConsecutiveTrend(value, 'down', condition.consecutivePeriods || 1);
      case 'no_data':
        return false; // This would be checked separately
      default:
        return false;
    }
  }

  private async checkConsecutiveTrend(value: KPIValue, trendDirection: 'up' | 'down', periods: number): Promise<boolean> {
    if (!this.db || periods <= 1) return true;

    const recentValues = await this.db.collection('kpi_values')
      .find({ 
        kpiId: value.kpiId,
        dimensions: value.dimensions,
        timestamp: { $lt: value.timestamp }
      })
      .sort({ timestamp: -1 })
      .limit(periods - 1)
      .toArray();

    return recentValues.every((val: any) => val.trend === trendDirection);
  }

  private async triggerKPIAlert(kpi: KPIDefinition, alert: KPIAlert, value: KPIValue): Promise<void> {
    // Update last triggered time
    alert.lastTriggered = new Date();
    await this.updateKPI(kpi.id, { alerts: kpi.alerts });

    // Execute alert actions
    for (const action of alert.actions) {
      await this.executeKPIAlertAction(action, kpi, alert, value);
    }

    this.logger.warn(`KPI alert triggered: ${alert.name}`, {
      kpiId: kpi.id,
      alertId: alert.id,
      value: value.value,
      severity: alert.severity
    });
  }

  private async executeKPIAlertAction(
    action: AlertAction,
    kpi: KPIDefinition,
    alert: KPIAlert,
    value: KPIValue
  ): Promise<void> {
    const alertData = {
      kpiId: kpi.id,
      kpiName: kpi.name,
      alertId: alert.id,
      alertName: alert.name,
      severity: alert.severity,
      value: value.value,
      target: value.target,
      variance: value.variance,
      percentageChange: value.percentageChange,
      trend: value.trend,
      status: value.status,
      timestamp: value.timestamp,
      dimensions: value.dimensions
    };

    switch (action.type) {
      case 'email':
        // Email implementation would depend on email service
        this.logger.info(`Email alert would be sent for KPI: ${kpi.name}`);
        break;
      case 'webhook':
        await this.sendWebhook(alertData, action.config);
        break;
      case 'dashboard':
        await this.redis.publish('dashboard:alerts', JSON.stringify(alertData));
        break;
      case 'log':
        this.logger.warn(`KPI Alert: ${alert.name}`, alertData);
        break;
      case 'escalate':
        // Escalation logic would depend on organization structure
        this.logger.info(`Alert escalation triggered for KPI: ${kpi.name}`);
        break;
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

  async getKPIValues(
    kpiId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      dimensions?: Record<string, string>;
      limit?: number;
    } = {}
  ): Promise<KPIValue[]> {
    if (!this.db) throw new Error('Database not initialized');

    const filter: any = { kpiId };
    
    if (options.startDate || options.endDate) {
      filter.timestamp = {};
      if (options.startDate) filter.timestamp.$gte = options.startDate;
      if (options.endDate) filter.timestamp.$lte = options.endDate;
    }

    if (options.dimensions) {
      for (const [key, value] of Object.entries(options.dimensions)) {
        filter[`dimensions.${key}`] = value;
      }
    }

    const values = await this.db.collection('kpi_values')
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(options.limit || 100)
      .toArray();

    return values as KPIValue[];
  }

  async getKPIComparison(kpiId: string, dimensions?: Record<string, string>): Promise<KPIComparison> {
    const current = await this.getLatestKPIValue(kpiId, dimensions);
    if (!current) {
      throw new Error(`No current value found for KPI: ${kpiId}`);
    }

    const previous = await this.getPreviousKPIValue(kpiId, dimensions || {});
    const kpi = await this.getKPI(kpiId);

    return {
      kpiId,
      current,
      previous: previous || undefined,
      target: kpi?.target?.value,
      benchmark: undefined, // Would be calculated based on industry benchmarks
      percentile: undefined, // Would be calculated based on peer comparison
      ranking: undefined // Would be calculated based on ranking system
    };
  }

  private async getLatestKPIValue(kpiId: string, dimensions?: Record<string, string>): Promise<KPIValue | null> {
    // Try cache first
    const cacheKey = `${kpiId}:${JSON.stringify(dimensions || {})}`;
    const cached = await this.redis.hget('kpi:latest_values', cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    // Fallback to database
    const values = await this.getKPIValues(kpiId, { dimensions, limit: 1 });
    return values[0] || null;
  }

  private async scheduleKPICalculation(kpi: KPIDefinition): Promise<void> {
    if (this.scheduledTasks.has(kpi.id)) {
      this.scheduledTasks.get(kpi.id)?.destroy();
    }

    const task = cron.schedule(kpi.calculation.schedule, async () => {
      try {
        await this.calculateKPI(kpi.id);
      } catch (error) {
        this.logger.error(`Scheduled KPI calculation failed: ${kpi.id}`, error);
      }
    }, {
      scheduled: false
    });

    task.start();
    this.scheduledTasks.set(kpi.id, task);
    
    this.logger.info(`KPI calculation scheduled: ${kpi.name} with schedule ${kpi.calculation.schedule}`);
  }

  private async unscheduleKPICalculation(kpiId: string): Promise<void> {
    const task = this.scheduledTasks.get(kpiId);
    if (task) {
      task.destroy();
      this.scheduledTasks.delete(kpiId);
      this.logger.info(`KPI calculation unscheduled: ${kpiId}`);
    }
  }

  private async saveCalculationJob(job: KPICalculationJob): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.collection('kpi_calculation_jobs').replaceOne(
      { id: job.id },
      job,
      { upsert: true }
    );

    this.calculationJobs.set(job.id, job);
  }

  private parseDimensionKey(key: string): Record<string, string> {
    if (key === 'default') return {};
    
    // This would parse the dimension key back to object
    // Implementation depends on how dimensions are encoded
    return {};
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private async loadKPIDefinitions(): Promise<void> {
    if (!this.db) return;

    const kpis = await this.db.collection('kpi_definitions').find({}).toArray();
    for (const kpi of kpis) {
      this.kpiDefinitions.set(kpi.id, kpi as KPIDefinition);
    }
  }

  private async scheduleCalculations(): Promise<void> {
    for (const kpi of this.kpiDefinitions.values()) {
      if (kpi.isActive) {
        await this.scheduleKPICalculation(kpi);
      }
    }
  }

  private async createDefaultKPIs(): Promise<void> {
    const defaultKPIs: Omit<KPIDefinition, 'createdAt' | 'updatedAt'>[] = [
      {
        id: 'claims_approval_rate',
        name: 'Claims Approval Rate',
        description: 'Percentage of claims that are approved',
        category: 'operational',
        type: 'percentage',
        formula: {
          type: 'aggregation',
          numerator: {
            dataSource: 'claims',
            aggregation: 'count',
            filters: [{ field: 'status', operator: '=', value: 'approved' }]
          },
          denominator: {
            dataSource: 'claims',
            aggregation: 'count'
          }
        },
        target: {
          value: 0.85, // 85% target
          operator: '>='
        },
        dimensions: ['hospitalId', 'claimType'],
        timeGranularity: 'daily',
        dataSource: {
          type: 'mongodb',
          connection: { collection: 'claims' },
          query: {},
          refreshInterval: 3600,
          cacheable: true
        },
        calculation: {
          schedule: '0 2 * * *', // Daily at 2 AM
          lookbackPeriod: 1,
          compareWithPrevious: true,
          seasonalAdjustment: false,
          outlierDetection: false
        },
        alerts: [
          {
            id: 'low_approval_rate',
            name: 'Low Approval Rate Alert',
            condition: {
              operator: '<',
              threshold: 0.75
            },
            severity: 'medium',
            actions: [
              {
                type: 'dashboard',
                config: {}
              }
            ],
            isEnabled: true,
            cooldownPeriod: 3600
          }
        ],
        permissions: {
          viewRoles: ['admin', 'manager', 'analyst'],
          editRoles: ['admin'],
          deleteRoles: ['admin']
        },
        metadata: {},
        isActive: true,
        createdBy: 'system'
      },
      {
        id: 'average_processing_time',
        name: 'Average Processing Time',
        description: 'Average time to process claims in hours',
        category: 'performance',
        type: 'simple',
        formula: {
          type: 'aggregation',
          numerator: {
            dataSource: 'claims',
            aggregation: 'avg',
            field: 'processingTimeHours'
          }
        },
        target: {
          value: 24, // 24 hours target
          operator: '<='
        },
        dimensions: ['hospitalId', 'claimType'],
        timeGranularity: 'daily',
        dataSource: {
          type: 'mongodb',
          connection: { collection: 'claims' },
          query: {
            filter: { 
              status: { $in: ['approved', 'paid'] },
              processingTimeHours: { $exists: true }
            }
          },
          refreshInterval: 3600,
          cacheable: true
        },
        calculation: {
          schedule: '0 3 * * *', // Daily at 3 AM
          lookbackPeriod: 1,
          compareWithPrevious: true,
          seasonalAdjustment: false,
          outlierDetection: true
        },
        alerts: [],
        permissions: {
          viewRoles: ['admin', 'manager', 'analyst'],
          editRoles: ['admin'],
          deleteRoles: ['admin']
        },
        metadata: {},
        isActive: true,
        createdBy: 'system'
      }
    ];

    for (const kpi of defaultKPIs) {
      try {
        const existing = await this.getKPI(kpi.id);
        if (!existing) {
          await this.createKPI(kpi);
        }
      } catch (error) {
        this.logger.error(`Failed to create default KPI: ${kpi.name}`, error);
      }
    }
  }
}
