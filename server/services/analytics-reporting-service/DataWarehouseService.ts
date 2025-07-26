import { MongoClient, Db } from 'mongodb';
import IORedis from 'ioredis';
import winston from 'winston';

export interface DataWarehouseConfig {
  connectionString: string;
  databaseName: string;
  collections: {
    claims: string;
    payments: string;
    documents: string;
    users: string;
    analytics: string;
    dimensions: string;
    facts: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
}

export interface Dimension {
  id: string;
  name: string;
  type: 'date' | 'category' | 'numeric' | 'text';
  source: string;
  field: string;
  hierarchy?: string[];
  metadata: Record<string, any>;
}

export interface FactTable {
  id: string;
  name: string;
  source: string;
  dimensions: string[];
  measures: string[];
  granularity: 'daily' | 'hourly' | 'monthly' | 'yearly';
  partitioning: 'date' | 'category' | 'hash';
}

export interface DataMart {
  id: string;
  name: string;
  description: string;
  facts: string[];
  dimensions: string[];
  refreshSchedule: string;
  lastRefresh: Date;
}

export class DataWarehouseService {
  private db: Db | null = null;
  private redis: IORedis;
  private logger: winston.Logger;
  private config: DataWarehouseConfig;

  constructor(config: DataWarehouseConfig) {
    this.config = config;
    this.redis = new IORedis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
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
        new winston.transports.File({ filename: 'logs/data-warehouse.log' })
      ]
    });
  }

  async initialize(): Promise<void> {
    try {
      const client = new MongoClient(this.config.connectionString);
      await client.connect();
      this.db = client.db(this.config.databaseName);
      
      await this.createDataWarehouseSchema();
      await this.createIndexes();
      await this.setupDimensions();
      await this.setupFactTables();
      
      this.logger.info('Data warehouse initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize data warehouse', error);
      throw error;
    }
  }

  private async createDataWarehouseSchema(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Create collections with proper schema validation
    const collections = [
      {
        name: this.config.collections.dimensions,
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['id', 'name', 'type', 'source', 'field'],
            properties: {
              id: { bsonType: 'string' },
              name: { bsonType: 'string' },
              type: { enum: ['date', 'category', 'numeric', 'text'] },
              source: { bsonType: 'string' },
              field: { bsonType: 'string' },
              hierarchy: { bsonType: 'array' },
              metadata: { bsonType: 'object' }
            }
          }
        }
      },
      {
        name: this.config.collections.facts,
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['id', 'name', 'source', 'dimensions', 'measures'],
            properties: {
              id: { bsonType: 'string' },
              name: { bsonType: 'string' },
              source: { bsonType: 'string' },
              dimensions: { bsonType: 'array' },
              measures: { bsonType: 'array' },
              granularity: { enum: ['daily', 'hourly', 'monthly', 'yearly'] },
              partitioning: { enum: ['date', 'category', 'hash'] }
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
        if (error.code !== 48) { // Collection already exists
          throw error;
        }
      }
    }
  }

  private async createIndexes(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const indexes = [
      // Dimensions indexes
      { collection: this.config.collections.dimensions, index: { id: 1 }, unique: true },
      { collection: this.config.collections.dimensions, index: { type: 1, source: 1 } },
      
      // Facts indexes
      { collection: this.config.collections.facts, index: { id: 1 }, unique: true },
      { collection: this.config.collections.facts, index: { source: 1, granularity: 1 } },
      
      // Analytics indexes for time-series data
      { collection: this.config.collections.analytics, index: { timestamp: -1, type: 1 } },
      { collection: this.config.collections.analytics, index: { 'dimensions.date': -1 } },
      { collection: this.config.collections.analytics, index: { 'measures.value': 1 } }
    ];

    for (const indexSpec of indexes) {
      try {
        await this.db.collection(indexSpec.collection).createIndex(
          indexSpec.index,
          { unique: indexSpec.unique || false, background: true }
        );
      } catch (error) {
        this.logger.warn(`Failed to create index on ${indexSpec.collection}`, error);
      }
    }
  }

  private async setupDimensions(): Promise<void> {
    const defaultDimensions: Dimension[] = [
      {
        id: 'dim_date',
        name: 'Date Dimension',
        type: 'date',
        source: 'system',
        field: 'date',
        hierarchy: ['year', 'quarter', 'month', 'week', 'day'],
        metadata: { format: 'YYYY-MM-DD', timezone: 'Asia/Ho_Chi_Minh' }
      },
      {
        id: 'dim_claim_status',
        name: 'Claim Status',
        type: 'category',
        source: 'claims',
        field: 'status',
        metadata: { values: ['pending', 'approved', 'rejected', 'processing', 'paid'] }
      },
      {
        id: 'dim_hospital',
        name: 'Hospital',
        type: 'category',
        source: 'claims',
        field: 'hospitalId',
        hierarchy: ['region', 'province', 'district', 'hospital'],
        metadata: { type: 'organizational' }
      },
      {
        id: 'dim_patient_age_group',
        name: 'Patient Age Group',
        type: 'category',
        source: 'patients',
        field: 'ageGroup',
        metadata: { ranges: ['0-18', '19-35', '36-50', '51-65', '65+'] }
      },
      {
        id: 'dim_claim_type',
        name: 'Claim Type',
        type: 'category',
        source: 'claims',
        field: 'claimType',
        metadata: { values: ['outpatient', 'inpatient', 'emergency', 'prescription', 'dental'] }
      }
    ];

    await this.saveDimensions(defaultDimensions);
  }

  private async setupFactTables(): Promise<void> {
    const defaultFactTables: FactTable[] = [
      {
        id: 'fact_claims_daily',
        name: 'Daily Claims Facts',
        source: 'claims',
        dimensions: ['dim_date', 'dim_claim_status', 'dim_hospital', 'dim_claim_type'],
        measures: ['count', 'total_amount', 'avg_processing_time', 'approval_rate'],
        granularity: 'daily',
        partitioning: 'date'
      },
      {
        id: 'fact_payments_hourly',
        name: 'Hourly Payment Facts',
        source: 'payments',
        dimensions: ['dim_date', 'dim_hospital', 'dim_claim_type'],
        measures: ['payment_count', 'payment_amount', 'processing_fee', 'success_rate'],
        granularity: 'hourly',
        partitioning: 'date'
      },
      {
        id: 'fact_documents_daily',
        name: 'Daily Document Facts',
        source: 'documents',
        dimensions: ['dim_date', 'dim_hospital'],
        measures: ['upload_count', 'processing_time', 'error_rate', 'quality_score'],
        granularity: 'daily',
        partitioning: 'date'
      }
    ];

    await this.saveFactTables(defaultFactTables);
  }

  async saveDimensions(dimensions: Dimension[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const collection = this.db.collection(this.config.collections.dimensions);
    
    for (const dimension of dimensions) {
      await collection.replaceOne(
        { id: dimension.id },
        { ...dimension, createdAt: new Date(), updatedAt: new Date() },
        { upsert: true }
      );
    }

    // Cache in Redis
    await this.redis.setex(
      'warehouse:dimensions',
      3600,
      JSON.stringify(dimensions)
    );
  }

  async saveFactTables(factTables: FactTable[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const collection = this.db.collection(this.config.collections.facts);
    
    for (const factTable of factTables) {
      await collection.replaceOne(
        { id: factTable.id },
        { ...factTable, createdAt: new Date(), updatedAt: new Date() },
        { upsert: true }
      );
    }

    // Cache in Redis
    await this.redis.setex(
      'warehouse:facts',
      3600,
      JSON.stringify(factTables)
    );
  }

  async getDimensions(): Promise<Dimension[]> {
    // Try cache first
    const cached = await this.redis.get('warehouse:dimensions');
    if (cached) {
      return JSON.parse(cached);
    }

    if (!this.db) throw new Error('Database not initialized');
    
    const dimensions = await this.db
      .collection(this.config.collections.dimensions)
      .find({})
      .toArray();

    // Cache result
    await this.redis.setex(
      'warehouse:dimensions',
      3600,
      JSON.stringify(dimensions)
    );

    return dimensions as Dimension[];
  }

  async getFactTables(): Promise<FactTable[]> {
    // Try cache first
    const cached = await this.redis.get('warehouse:facts');
    if (cached) {
      return JSON.parse(cached);
    }

    if (!this.db) throw new Error('Database not initialized');
    
    const factTables = await this.db
      .collection(this.config.collections.facts)
      .find({})
      .toArray();

    // Cache result
    await this.redis.setex(
      'warehouse:facts',
      3600,
      JSON.stringify(factTables)
    );

    return factTables as FactTable[];
  }

  async createDataMart(dataMart: DataMart): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.collection('data_marts').replaceOne(
      { id: dataMart.id },
      { ...dataMart, createdAt: new Date(), updatedAt: new Date() },
      { upsert: true }
    );

    this.logger.info(`Data mart created: ${dataMart.name}`);
  }

  async refreshDataMart(dataMartId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const dataMart = await this.db
      .collection('data_marts')
      .findOne({ id: dataMartId });

    if (!dataMart) {
      throw new Error(`Data mart not found: ${dataMartId}`);
    }

    // Implement data mart refresh logic
    const startTime = new Date();
    
    try {
      // Refresh fact tables
      for (const factId of dataMart.facts) {
        await this.refreshFactTable(factId);
      }

      // Update last refresh time
      await this.db.collection('data_marts').updateOne(
        { id: dataMartId },
        { 
          $set: { 
            lastRefresh: new Date(),
            lastRefreshDuration: Date.now() - startTime.getTime()
          }
        }
      );

      this.logger.info(`Data mart refreshed: ${dataMart.name}`);
    } catch (error) {
      this.logger.error(`Failed to refresh data mart: ${dataMart.name}`, error);
      throw error;
    }
  }

  private async refreshFactTable(factId: string): Promise<void> {
    // Implementation for refreshing specific fact table
    // This would involve ETL operations to update the fact table
    this.logger.info(`Refreshing fact table: ${factId}`);
  }

  async getWarehouseMetrics(): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    const stats = await this.db.admin().dbStats();
    const collections = await this.db.listCollections().toArray();
    
    return {
      database: {
        size: stats.dataSize,
        storageSize: stats.storageSize,
        collections: collections.length,
        indexes: stats.indexes
      },
      performance: {
        avgObjSize: stats.avgObjSize,
        totalSize: stats.totalSize
      },
      timestamp: new Date()
    };
  }
}
