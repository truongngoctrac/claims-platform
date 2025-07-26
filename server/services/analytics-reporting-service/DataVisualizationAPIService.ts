import { Db, MongoClient } from 'mongodb';
import { EventEmitter } from 'events';
import * as winston from 'winston';
import IORedis from 'ioredis';

export interface VisualizationConfig {
  id: string;
  name: string;
  description: string;
  type: 'line' | 'bar' | 'pie' | 'scatter' | 'heatmap' | 'treemap' | 'gauge' | 'funnel' | 'radar' | 'waterfall' | 'candlestick';
  subtype?: string;
  dataSource: DataSourceConnection;
  dimensions: VisualizationDimension[];
  measures: VisualizationMeasure[];
  filters: VisualizationFilter[];
  styling: VisualizationStyling;
  interactivity: InteractivityConfig;
  responsive: boolean;
  accessibility: AccessibilityConfig;
  caching: CachingConfig;
  permissions: string[];
  tags: string[];
  version: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  isPublic: boolean;
}

export interface DataSourceConnection {
  type: 'mongodb' | 'sql' | 'api' | 'file' | 'realtime' | 'warehouse';
  connectionString: string;
  query: string;
  refreshInterval: number;
  timeout: number;
  parameters: Record<string, any>;
  authentication?: {
    type: 'none' | 'basic' | 'bearer' | 'oauth' | 'api_key';
    credentials: Record<string, string>;
  };
}

export interface VisualizationDimension {
  field: string;
  label: string;
  type: 'categorical' | 'temporal' | 'ordinal' | 'geographic';
  format?: string;
  sorting?: {
    enabled: boolean;
    direction: 'asc' | 'desc';
    custom?: string[];
  };
  grouping?: {
    enabled: boolean;
    interval?: string;
    customGroups?: Record<string, string[]>;
  };
}

export interface VisualizationMeasure {
  field: string;
  label: string;
  aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'distinct' | 'median' | 'mode';
  format: {
    type: 'number' | 'currency' | 'percentage' | 'duration';
    decimals: number;
    prefix?: string;
    suffix?: string;
    currency?: string;
  };
  target?: {
    value: number;
    type: 'line' | 'band' | 'color';
  };
  calculation?: {
    type: 'running_total' | 'percentage_of_total' | 'difference' | 'growth_rate';
    baseField?: string;
  };
}

export interface VisualizationFilter {
  field: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'range' | 'boolean';
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains' | 'startswith' | 'endswith';
  value: any;
  defaultValue?: any;
  options?: string[];
  dynamic?: {
    enabled: boolean;
    sourceField: string;
    dependsOn?: string[];
  };
}

export interface VisualizationStyling {
  theme: 'light' | 'dark' | 'custom';
  colors: {
    primary: string[];
    secondary: string[];
    background: string;
    text: string;
    grid: string;
    accent: string;
  };
  fonts: {
    family: string;
    sizes: {
      title: number;
      subtitle: number;
      axis: number;
      legend: number;
      tooltip: number;
    };
  };
  layout: {
    margin: { top: number; right: number; bottom: number; left: number };
    padding: number;
    showLegend: boolean;
    legendPosition: 'top' | 'bottom' | 'left' | 'right' | 'none';
    showGrid: boolean;
    showAxes: boolean;
    showTooltips: boolean;
  };
  animations: {
    enabled: boolean;
    duration: number;
    easing: string;
  };
}

export interface InteractivityConfig {
  zoom: {
    enabled: boolean;
    type: 'x' | 'y' | 'xy';
  };
  pan: {
    enabled: boolean;
    type: 'x' | 'y' | 'xy';
  };
  selection: {
    enabled: boolean;
    type: 'single' | 'multiple' | 'brush';
    crossFilter: boolean;
  };
  drill: {
    enabled: boolean;
    levels: string[];
  };
  hover: {
    enabled: boolean;
    highlight: boolean;
    showDetails: boolean;
  };
  click: {
    enabled: boolean;
    action: 'none' | 'filter' | 'drill' | 'navigate' | 'custom';
    target?: string;
  };
}

export interface AccessibilityConfig {
  altText: string;
  colorBlindSafe: boolean;
  keyboardNavigation: boolean;
  screenReaderSupport: boolean;
  highContrast: boolean;
  textAlternatives: {
    enabled: boolean;
    includeData: boolean;
    includeInsights: boolean;
  };
}

export interface CachingConfig {
  enabled: boolean;
  ttl: number;
  strategy: 'memory' | 'redis' | 'database' | 'cdn';
  invalidation: {
    manual: boolean;
    onDataChange: boolean;
    schedule?: string;
  };
}

export interface VisualizationData {
  id: string;
  configId: string;
  data: any[];
  metadata: {
    totalRows: number;
    columns: ColumnMetadata[];
    generatedAt: Date;
    executionTime: number;
    fromCache: boolean;
    dataSourceInfo: any;
  };
  processedData: ProcessedVisualizationData;
  chartConfig: ChartConfiguration;
}

export interface ColumnMetadata {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  nullable: boolean;
  unique: boolean;
  distribution?: {
    min?: any;
    max?: any;
    mean?: number;
    median?: number;
    mode?: any;
    stdDev?: number;
    nullCount: number;
    uniqueCount: number;
  };
}

export interface ProcessedVisualizationData {
  series: DataSeries[];
  categories: string[];
  summary: DataSummary;
  insights: DataInsight[];
}

export interface DataSeries {
  name: string;
  data: DataPoint[];
  type?: string;
  color?: string;
  visible: boolean;
}

export interface DataPoint {
  x: any;
  y: any;
  label?: string;
  color?: string;
  size?: number;
  metadata?: Record<string, any>;
}

export interface DataSummary {
  totalPoints: number;
  timeRange?: {
    start: Date;
    end: Date;
  };
  valueRange?: {
    min: number;
    max: number;
  };
  categories: {
    total: number;
    distribution: Record<string, number>;
  };
  measures: {
    total: number;
    averages: Record<string, number>;
    sums: Record<string, number>;
  };
}

export interface DataInsight {
  type: 'trend' | 'outlier' | 'correlation' | 'seasonal' | 'anomaly' | 'distribution';
  title: string;
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  data: any;
  visualization?: {
    type: string;
    config: any;
  };
}

export interface ChartConfiguration {
  type: string;
  library: 'chartjs' | 'd3' | 'plotly' | 'echarts' | 'highcharts';
  config: any;
  responsive: boolean;
  accessibility: any;
}

export interface VisualizationTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  chartType: string;
  previewImage: string;
  defaultConfig: Partial<VisualizationConfig>;
  requiredFields: string[];
  optionalFields: string[];
  useCases: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  popularity: number;
  createdAt: Date;
}

export interface VisualizationExport {
  id: string;
  configId: string;
  format: 'png' | 'svg' | 'pdf' | 'html' | 'json' | 'csv' | 'excel';
  options: ExportOptions;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  filePath?: string;
  fileSize?: number;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface ExportOptions {
  width?: number;
  height?: number;
  resolution?: number;
  quality?: number;
  includeData?: boolean;
  includeConfig?: boolean;
  watermark?: {
    enabled: boolean;
    text?: string;
    opacity?: number;
  };
  theme?: 'light' | 'dark';
}

export class DataVisualizationAPIService extends EventEmitter {
  private db: Db | null = null;
  private redis: IORedis;
  private logger: winston.Logger;
  private chartRenderers: Map<string, any> = new Map();

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
        new winston.transports.File({ filename: 'data-visualization.log' })
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
      await this.initializeChartRenderers();
      await this.loadVisualizationTemplates();
      
      this.logger.info('Data Visualization API Service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Data Visualization API Service:', error);
      throw error;
    }
  }

  private async ensureIndexes(): Promise<void> {
    if (!this.db) return;

    const collections = {
      visualization_configs: [
        { key: { id: 1 }, unique: true },
        { key: { type: 1, isPublic: 1 } },
        { key: { createdBy: 1, updatedAt: -1 } },
        { key: { tags: 1 } },
        { key: { permissions: 1 } }
      ],
      visualization_data: [
        { key: { id: 1 }, unique: true },
        { key: { configId: 1, 'metadata.generatedAt': -1 } },
        { key: { 'metadata.generatedAt': 1 }, expireAfterSeconds: 3600 }
      ],
      visualization_templates: [
        { key: { id: 1 }, unique: true },
        { key: { category: 1, popularity: -1 } },
        { key: { chartType: 1 } },
        { key: { difficulty: 1 } }
      ],
      visualization_exports: [
        { key: { id: 1 }, unique: true },
        { key: { configId: 1, createdAt: -1 } },
        { key: { status: 1 } },
        { key: { createdAt: 1 }, expireAfterSeconds: 86400 }
      ]
    };

    for (const [collection, indexes] of Object.entries(collections)) {
      for (const index of indexes) {
        await this.db.collection(collection).createIndex(index.key, { 
          unique: index.unique || false,
          background: true,
          expireAfterSeconds: index.expireAfterSeconds
        });
      }
    }
  }

  private async initializeChartRenderers(): Promise<void> {
    // Initialize chart rendering engines
    this.chartRenderers.set('chartjs', {
      render: this.renderChartJS.bind(this),
      export: this.exportChartJS.bind(this)
    });
    
    this.chartRenderers.set('d3', {
      render: this.renderD3.bind(this),
      export: this.exportD3.bind(this)
    });

    this.logger.info('Chart renderers initialized');
  }

  async createVisualizationConfig(config: Omit<VisualizationConfig, 'id' | 'version' | 'createdAt' | 'updatedAt'>): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    const visualizationConfig: VisualizationConfig = {
      id: `viz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      version: 1,
      ...config,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.db.collection('visualization_configs').insertOne(visualizationConfig);
    
    this.logger.info(`Created visualization config: ${visualizationConfig.id}`);
    return visualizationConfig.id;
  }

  async generateVisualization(configId: string, filters?: Record<string, any>): Promise<VisualizationData> {
    if (!this.db) throw new Error('Database not initialized');

    const config = await this.db.collection('visualization_configs').findOne({ id: configId });
    if (!config) throw new Error(`Visualization config not found: ${configId}`);

    // Check cache first
    if (config.caching.enabled) {
      const cached = await this.getCachedVisualization(configId, filters);
      if (cached) {
        this.logger.info(`Returning cached visualization: ${configId}`);
        return cached;
      }
    }

    const startTime = Date.now();
    
    try {
      // Fetch data
      const rawData = await this.fetchVisualizationData(config.dataSource, filters);
      
      // Process data
      const processedData = await this.processVisualizationData(rawData, config);
      
      // Generate chart configuration
      const chartConfig = await this.generateChartConfig(config, processedData);
      
      // Analyze data for insights
      const insights = await this.generateDataInsights(rawData, config);
      
      const visualizationData: VisualizationData = {
        id: `data_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        configId,
        data: rawData,
        metadata: {
          totalRows: rawData.length,
          columns: this.analyzeColumns(rawData),
          generatedAt: new Date(),
          executionTime: Date.now() - startTime,
          fromCache: false,
          dataSourceInfo: {
            type: config.dataSource.type,
            refreshInterval: config.dataSource.refreshInterval
          }
        },
        processedData: {
          ...processedData,
          insights
        },
        chartConfig
      };

      // Cache if enabled
      if (config.caching.enabled) {
        await this.cacheVisualization(configId, filters, visualizationData, config.caching.ttl);
      }

      await this.db.collection('visualization_data').insertOne(visualizationData);
      
      this.emit('visualizationGenerated', { configId, dataId: visualizationData.id });
      this.logger.info(`Generated visualization: ${configId}, execution time: ${visualizationData.metadata.executionTime}ms`);

      return visualizationData;

    } catch (error) {
      this.logger.error(`Failed to generate visualization: ${configId}`, error);
      throw error;
    }
  }

  private async fetchVisualizationData(dataSource: DataSourceConnection, filters?: Record<string, any>): Promise<any[]> {
    switch (dataSource.type) {
      case 'mongodb':
        return await this.fetchMongoData(dataSource, filters);
      case 'sql':
        return await this.fetchSqlData(dataSource, filters);
      case 'api':
        return await this.fetchApiData(dataSource, filters);
      case 'realtime':
        return await this.fetchRealtimeData(dataSource, filters);
      case 'warehouse':
        return await this.fetchWarehouseData(dataSource, filters);
      default:
        throw new Error(`Unsupported data source type: ${dataSource.type}`);
    }
  }

  private async fetchMongoData(dataSource: DataSourceConnection, filters?: Record<string, any>): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const query = this.interpolateQuery(dataSource.query, { ...dataSource.parameters, ...filters });
      const pipeline = JSON.parse(query);
      
      return await this.db.collection(dataSource.connectionString).aggregate(pipeline).toArray();
    } catch (error) {
      this.logger.error('Failed to fetch MongoDB data:', error);
      throw error;
    }
  }

  private async fetchSqlData(dataSource: DataSourceConnection, filters?: Record<string, any>): Promise<any[]> {
    // Mock SQL data fetching
    this.logger.info('Fetching SQL data - mock implementation');
    return this.generateMockData('sql', 100);
  }

  private async fetchApiData(dataSource: DataSourceConnection, filters?: Record<string, any>): Promise<any[]> {
    try {
      const url = this.interpolateQuery(dataSource.connectionString, { ...dataSource.parameters, ...filters });
      const response = await fetch(url, {
        timeout: dataSource.timeout || 30000,
        headers: this.buildAuthHeaders(dataSource.authentication)
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [data];
    } catch (error) {
      this.logger.error('Failed to fetch API data:', error);
      throw error;
    }
  }

  private async fetchRealtimeData(dataSource: DataSourceConnection, filters?: Record<string, any>): Promise<any[]> {
    // Mock realtime data fetching
    this.logger.info('Fetching realtime data - mock implementation');
    return this.generateMockData('realtime', 50);
  }

  private async fetchWarehouseData(dataSource: DataSourceConnection, filters?: Record<string, any>): Promise<any[]> {
    // Mock warehouse data fetching
    this.logger.info('Fetching warehouse data - mock implementation');
    return this.generateMockData('warehouse', 200);
  }

  private generateMockData(type: string, count: number): any[] {
    const data = [];
    const categories = ['Category A', 'Category B', 'Category C', 'Category D'];
    const startDate = new Date('2024-01-01');
    
    for (let i = 0; i < count; i++) {
      data.push({
        id: i + 1,
        category: categories[Math.floor(Math.random() * categories.length)],
        value: Math.floor(Math.random() * 1000) + 100,
        percentage: Math.random() * 100,
        date: new Date(startDate.getTime() + (i * 24 * 60 * 60 * 1000)),
        status: Math.random() > 0.5 ? 'active' : 'inactive',
        region: ['North', 'South', 'East', 'West'][Math.floor(Math.random() * 4)]
      });
    }
    
    return data;
  }

  private interpolateQuery(query: string, variables: Record<string, any>): string {
    let interpolated = query;
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      interpolated = interpolated.replace(regex, typeof value === 'string' ? `"${value}"` : String(value));
    }

    return interpolated;
  }

  private buildAuthHeaders(auth?: DataSourceConnection['authentication']): Record<string, string> {
    const headers: Record<string, string> = {};
    
    if (!auth || auth.type === 'none') return headers;

    switch (auth.type) {
      case 'basic':
        const basicAuth = Buffer.from(`${auth.credentials.username}:${auth.credentials.password}`).toString('base64');
        headers.Authorization = `Basic ${basicAuth}`;
        break;
      case 'bearer':
        headers.Authorization = `Bearer ${auth.credentials.token}`;
        break;
      case 'api_key':
        headers[auth.credentials.header || 'X-API-Key'] = auth.credentials.key;
        break;
    }

    return headers;
  }

  private async processVisualizationData(rawData: any[], config: VisualizationConfig): Promise<ProcessedVisualizationData> {
    // Apply filters
    let filteredData = this.applyFilters(rawData, config.filters);
    
    // Process dimensions and measures
    const series = await this.createDataSeries(filteredData, config);
    const categories = this.extractCategories(filteredData, config.dimensions);
    const summary = this.createDataSummary(filteredData, config);

    return {
      series,
      categories,
      summary,
      insights: [] // Will be populated separately
    };
  }

  private applyFilters(data: any[], filters: VisualizationFilter[]): any[] {
    return data.filter(item => {
      return filters.every(filter => {
        const value = this.getNestedValue(item, filter.field);
        return this.evaluateFilter(value, filter);
      });
    });
  }

  private evaluateFilter(value: any, filter: VisualizationFilter): boolean {
    switch (filter.operator) {
      case 'eq': return value === filter.value;
      case 'ne': return value !== filter.value;
      case 'gt': return value > filter.value;
      case 'gte': return value >= filter.value;
      case 'lt': return value < filter.value;
      case 'lte': return value <= filter.value;
      case 'in': return Array.isArray(filter.value) && filter.value.includes(value);
      case 'nin': return Array.isArray(filter.value) && !filter.value.includes(value);
      case 'contains': return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
      case 'startswith': return String(value).toLowerCase().startsWith(String(filter.value).toLowerCase());
      case 'endswith': return String(value).toLowerCase().endsWith(String(filter.value).toLowerCase());
      default: return true;
    }
  }

  private async createDataSeries(data: any[], config: VisualizationConfig): Promise<DataSeries[]> {
    const series: DataSeries[] = [];
    
    if (config.measures.length === 0) return series;

    // Group data by dimensions
    const grouped = this.groupDataByDimensions(data, config.dimensions);
    
    for (const measure of config.measures) {
      const seriesData: DataPoint[] = [];
      
      for (const [group, items] of grouped) {
        const aggregatedValue = this.aggregateValues(
          items.map(item => this.getNestedValue(item, measure.field)),
          measure.aggregation
        );
        
        seriesData.push({
          x: group,
          y: aggregatedValue,
          label: `${measure.label}: ${this.formatValue(aggregatedValue, measure.format)}`,
          metadata: {
            count: items.length,
            rawData: items
          }
        });
      }
      
      series.push({
        name: measure.label,
        data: seriesData,
        type: config.type,
        visible: true
      });
    }

    return series;
  }

  private groupDataByDimensions(data: any[], dimensions: VisualizationDimension[]): Map<string, any[]> {
    const grouped = new Map<string, any[]>();
    
    for (const item of data) {
      const key = dimensions.map(dim => {
        const value = this.getNestedValue(item, dim.field);
        return this.formatDimensionValue(value, dim);
      }).join('|');
      
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(item);
    }

    return grouped;
  }

  private formatDimensionValue(value: any, dimension: VisualizationDimension): string {
    if (dimension.type === 'temporal' && value instanceof Date) {
      return dimension.format ? 
        new Intl.DateTimeFormat('en-US', { ...JSON.parse(dimension.format) }).format(value) :
        value.toISOString().split('T')[0];
    }
    
    return String(value);
  }

  private aggregateValues(values: any[], aggregation: VisualizationMeasure['aggregation']): number {
    const numValues = values.filter(v => typeof v === 'number' && !isNaN(v));
    
    switch (aggregation) {
      case 'sum': return numValues.reduce((a, b) => a + b, 0);
      case 'avg': return numValues.length > 0 ? numValues.reduce((a, b) => a + b, 0) / numValues.length : 0;
      case 'min': return Math.min(...numValues);
      case 'max': return Math.max(...numValues);
      case 'count': return values.length;
      case 'distinct': return new Set(values).size;
      case 'median': {
        const sorted = [...numValues].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      }
      case 'mode': {
        const frequency = new Map();
        for (const value of values) {
          frequency.set(value, (frequency.get(value) || 0) + 1);
        }
        let maxFreq = 0;
        let mode = null;
        for (const [value, freq] of frequency) {
          if (freq > maxFreq) {
            maxFreq = freq;
            mode = value;
          }
        }
        return Number(mode) || 0;
      }
      default: return 0;
    }
  }

  private formatValue(value: number, format: VisualizationMeasure['format']): string {
    switch (format.type) {
      case 'currency':
        return new Intl.NumberFormat('en-US', { 
          style: 'currency', 
          currency: format.currency || 'USD',
          minimumFractionDigits: format.decimals,
          maximumFractionDigits: format.decimals
        }).format(value);
      case 'percentage':
        return new Intl.NumberFormat('en-US', { 
          style: 'percent',
          minimumFractionDigits: format.decimals,
          maximumFractionDigits: format.decimals
        }).format(value / 100);
      case 'duration':
        return `${Math.floor(value / 60)}:${(value % 60).toString().padStart(2, '0')}`;
      default:
        const formatted = new Intl.NumberFormat('en-US', {
          minimumFractionDigits: format.decimals,
          maximumFractionDigits: format.decimals
        }).format(value);
        return `${format.prefix || ''}${formatted}${format.suffix || ''}`;
    }
  }

  private extractCategories(data: any[], dimensions: VisualizationDimension[]): string[] {
    const categories = new Set<string>();
    
    for (const item of data) {
      for (const dimension of dimensions) {
        const value = this.getNestedValue(item, dimension.field);
        categories.add(this.formatDimensionValue(value, dimension));
      }
    }

    return Array.from(categories);
  }

  private createDataSummary(data: any[], config: VisualizationConfig): DataSummary {
    const summary: DataSummary = {
      totalPoints: data.length,
      categories: {
        total: 0,
        distribution: {}
      },
      measures: {
        total: config.measures.length,
        averages: {},
        sums: {}
      }
    };

    // Calculate category distribution
    for (const dimension of config.dimensions) {
      const values = data.map(item => this.getNestedValue(item, dimension.field));
      const distribution: Record<string, number> = {};
      
      for (const value of values) {
        const key = this.formatDimensionValue(value, dimension);
        distribution[key] = (distribution[key] || 0) + 1;
      }
      
      summary.categories.distribution = { ...summary.categories.distribution, ...distribution };
    }
    summary.categories.total = Object.keys(summary.categories.distribution).length;

    // Calculate measure statistics
    for (const measure of config.measures) {
      const values = data.map(item => this.getNestedValue(item, measure.field))
        .filter(v => typeof v === 'number' && !isNaN(v));
      
      if (values.length > 0) {
        summary.measures.averages[measure.field] = values.reduce((a, b) => a + b, 0) / values.length;
        summary.measures.sums[measure.field] = values.reduce((a, b) => a + b, 0);
      }
    }

    // Calculate time range if temporal data exists
    const temporalDimensions = config.dimensions.filter(d => d.type === 'temporal');
    if (temporalDimensions.length > 0) {
      const dates = data.map(item => {
        const value = this.getNestedValue(item, temporalDimensions[0].field);
        return value instanceof Date ? value : new Date(value);
      }).filter(d => !isNaN(d.getTime()));
      
      if (dates.length > 0) {
        summary.timeRange = {
          start: new Date(Math.min(...dates.map(d => d.getTime()))),
          end: new Date(Math.max(...dates.map(d => d.getTime())))
        };
      }
    }

    // Calculate value range for numeric measures
    const numericValues = config.measures.flatMap(measure => 
      data.map(item => this.getNestedValue(item, measure.field))
        .filter(v => typeof v === 'number' && !isNaN(v))
    );
    
    if (numericValues.length > 0) {
      summary.valueRange = {
        min: Math.min(...numericValues),
        max: Math.max(...numericValues)
      };
    }

    return summary;
  }

  private async generateDataInsights(data: any[], config: VisualizationConfig): Promise<DataInsight[]> {
    const insights: DataInsight[] = [];

    // Trend analysis for temporal data
    insights.push(...await this.analyzeTrends(data, config));
    
    // Outlier detection
    insights.push(...await this.detectOutliers(data, config));
    
    // Distribution analysis
    insights.push(...await this.analyzeDistribution(data, config));
    
    // Correlation analysis
    insights.push(...await this.analyzeCorrelations(data, config));

    return insights.filter(insight => insight.confidence > 0.7);
  }

  private async analyzeTrends(data: any[], config: VisualizationConfig): Promise<DataInsight[]> {
    const insights: DataInsight[] = [];
    
    const temporalDimensions = config.dimensions.filter(d => d.type === 'temporal');
    if (temporalDimensions.length === 0) return insights;

    for (const measure of config.measures) {
      const timeSeries = data
        .map(item => ({
          date: new Date(this.getNestedValue(item, temporalDimensions[0].field)),
          value: this.getNestedValue(item, measure.field)
        }))
        .filter(point => !isNaN(point.date.getTime()) && typeof point.value === 'number')
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      if (timeSeries.length < 3) continue;

      // Simple linear trend calculation
      const n = timeSeries.length;
      const sumX = timeSeries.reduce((sum, point, i) => sum + i, 0);
      const sumY = timeSeries.reduce((sum, point) => sum + point.value, 0);
      const sumXY = timeSeries.reduce((sum, point, i) => sum + i * point.value, 0);
      const sumXX = timeSeries.reduce((sum, point, i) => sum + i * i, 0);

      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;

      const trendDirection = slope > 0 ? 'increasing' : slope < 0 ? 'decreasing' : 'stable';
      const confidence = Math.min(Math.abs(slope) * 100, 1);

      if (Math.abs(slope) > 0.1) {
        insights.push({
          type: 'trend',
          title: `${measure.label} Trend`,
          description: `${measure.label} shows a ${trendDirection} trend over time`,
          confidence,
          impact: Math.abs(slope) > 0.5 ? 'high' : Math.abs(slope) > 0.2 ? 'medium' : 'low',
          data: {
            slope,
            intercept,
            direction: trendDirection,
            series: timeSeries
          }
        });
      }
    }

    return insights;
  }

  private async detectOutliers(data: any[], config: VisualizationConfig): Promise<DataInsight[]> {
    const insights: DataInsight[] = [];

    for (const measure of config.measures) {
      const values = data.map(item => this.getNestedValue(item, measure.field))
        .filter(v => typeof v === 'number' && !isNaN(v));

      if (values.length < 10) continue;

      const sorted = [...values].sort((a, b) => a - b);
      const q1 = sorted[Math.floor(sorted.length * 0.25)];
      const q3 = sorted[Math.floor(sorted.length * 0.75)];
      const iqr = q3 - q1;
      const lowerBound = q1 - 1.5 * iqr;
      const upperBound = q3 + 1.5 * iqr;

      const outliers = values.filter(v => v < lowerBound || v > upperBound);
      
      if (outliers.length > 0) {
        const outlierRate = outliers.length / values.length;
        insights.push({
          type: 'outlier',
          title: `${measure.label} Outliers Detected`,
          description: `Found ${outliers.length} outliers (${(outlierRate * 100).toFixed(1)}%) in ${measure.label}`,
          confidence: Math.min(outliers.length / 10, 1),
          impact: outlierRate > 0.1 ? 'high' : outlierRate > 0.05 ? 'medium' : 'low',
          data: {
            outliers,
            outlierRate,
            bounds: { lower: lowerBound, upper: upperBound },
            quartiles: { q1, q3, iqr }
          }
        });
      }
    }

    return insights;
  }

  private async analyzeDistribution(data: any[], config: VisualizationConfig): Promise<DataInsight[]> {
    const insights: DataInsight[] = [];

    for (const dimension of config.dimensions.filter(d => d.type === 'categorical')) {
      const values = data.map(item => this.getNestedValue(item, dimension.field));
      const distribution: Record<string, number> = {};
      
      for (const value of values) {
        const key = String(value);
        distribution[key] = (distribution[key] || 0) + 1;
      }

      const total = values.length;
      const sortedEntries = Object.entries(distribution).sort((a, b) => b[1] - a[1]);
      const topCategory = sortedEntries[0];
      const dominance = topCategory[1] / total;

      if (dominance > 0.5) {
        insights.push({
          type: 'distribution',
          title: `${dimension.label} Distribution`,
          description: `${topCategory[0]} dominates ${dimension.label} with ${(dominance * 100).toFixed(1)}% of data`,
          confidence: dominance,
          impact: dominance > 0.8 ? 'high' : dominance > 0.6 ? 'medium' : 'low',
          data: {
            distribution,
            dominant: { category: topCategory[0], percentage: dominance },
            diversity: Object.keys(distribution).length
          }
        });
      }
    }

    return insights;
  }

  private async analyzeCorrelations(data: any[], config: VisualizationConfig): Promise<DataInsight[]> {
    const insights: DataInsight[] = [];
    
    const numericMeasures = config.measures.filter(m => 
      data.some(item => typeof this.getNestedValue(item, m.field) === 'number')
    );

    if (numericMeasures.length < 2) return insights;

    for (let i = 0; i < numericMeasures.length; i++) {
      for (let j = i + 1; j < numericMeasures.length; j++) {
        const measure1 = numericMeasures[i];
        const measure2 = numericMeasures[j];
        
        const pairs = data.map(item => ({
          x: this.getNestedValue(item, measure1.field),
          y: this.getNestedValue(item, measure2.field)
        })).filter(pair => 
          typeof pair.x === 'number' && typeof pair.y === 'number' && 
          !isNaN(pair.x) && !isNaN(pair.y)
        );

        if (pairs.length < 10) continue;

        const correlation = this.calculateCorrelation(pairs);
        
        if (Math.abs(correlation) > 0.5) {
          const direction = correlation > 0 ? 'positive' : 'negative';
          const strength = Math.abs(correlation) > 0.8 ? 'strong' : 'moderate';
          
          insights.push({
            type: 'correlation',
            title: `${measure1.label} vs ${measure2.label} Correlation`,
            description: `${strength} ${direction} correlation (${correlation.toFixed(2)}) between ${measure1.label} and ${measure2.label}`,
            confidence: Math.abs(correlation),
            impact: Math.abs(correlation) > 0.8 ? 'high' : 'medium',
            data: {
              correlation,
              measures: [measure1.label, measure2.label],
              pairs: pairs.slice(0, 100) // Limit data size
            }
          });
        }
      }
    }

    return insights;
  }

  private calculateCorrelation(pairs: { x: number; y: number }[]): number {
    const n = pairs.length;
    const sumX = pairs.reduce((sum, pair) => sum + pair.x, 0);
    const sumY = pairs.reduce((sum, pair) => sum + pair.y, 0);
    const sumXY = pairs.reduce((sum, pair) => sum + pair.x * pair.y, 0);
    const sumXX = pairs.reduce((sum, pair) => sum + pair.x * pair.x, 0);
    const sumYY = pairs.reduce((sum, pair) => sum + pair.y * pair.y, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  private async generateChartConfig(config: VisualizationConfig, processedData: ProcessedVisualizationData): Promise<ChartConfiguration> {
    const library = this.selectOptimalLibrary(config.type, processedData.series.length);
    
    switch (library) {
      case 'chartjs':
        return {
          type: config.type,
          library: 'chartjs',
          config: this.generateChartJSConfig(config, processedData),
          responsive: config.responsive,
          accessibility: this.generateAccessibilityConfig(config.accessibility)
        };
      case 'd3':
        return {
          type: config.type,
          library: 'd3',
          config: this.generateD3Config(config, processedData),
          responsive: config.responsive,
          accessibility: this.generateAccessibilityConfig(config.accessibility)
        };
      default:
        throw new Error(`Unsupported chart library: ${library}`);
    }
  }

  private selectOptimalLibrary(chartType: string, seriesCount: number): ChartConfiguration['library'] {
    // Simple library selection logic
    if (seriesCount > 100 || chartType === 'heatmap' || chartType === 'treemap') {
      return 'd3';
    }
    return 'chartjs';
  }

  private generateChartJSConfig(config: VisualizationConfig, processedData: ProcessedVisualizationData): any {
    const chartData = {
      labels: processedData.categories,
      datasets: processedData.series.map((series, index) => ({
        label: series.name,
        data: series.data.map(point => point.y),
        backgroundColor: config.styling.colors.primary[index % config.styling.colors.primary.length],
        borderColor: config.styling.colors.primary[index % config.styling.colors.primary.length],
        borderWidth: 2,
        fill: config.type === 'line' ? false : true
      }))
    };

    const options = {
      responsive: config.responsive,
      maintainAspectRatio: false,
      animation: {
        duration: config.styling.animations.enabled ? config.styling.animations.duration : 0
      },
      plugins: {
        legend: {
          display: config.styling.layout.showLegend,
          position: config.styling.layout.legendPosition
        },
        tooltip: {
          enabled: config.styling.layout.showTooltips
        }
      },
      scales: {
        x: {
          display: config.styling.layout.showAxes,
          grid: {
            display: config.styling.layout.showGrid
          }
        },
        y: {
          display: config.styling.layout.showAxes,
          grid: {
            display: config.styling.layout.showGrid
          }
        }
      },
      interaction: {
        intersect: false,
        mode: 'index'
      }
    };

    return { type: config.type, data: chartData, options };
  }

  private generateD3Config(config: VisualizationConfig, processedData: ProcessedVisualizationData): any {
    return {
      type: config.type,
      data: processedData.series,
      width: 800,
      height: 600,
      margin: config.styling.layout.margin,
      colors: config.styling.colors.primary,
      theme: config.styling.theme,
      animations: config.styling.animations,
      interactivity: config.interactivity
    };
  }

  private generateAccessibilityConfig(accessibility: AccessibilityConfig): any {
    return {
      altText: accessibility.altText,
      keyboardNavigation: accessibility.keyboardNavigation,
      screenReader: accessibility.screenReaderSupport,
      highContrast: accessibility.highContrast,
      colorBlindSafe: accessibility.colorBlindSafe
    };
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((curr, prop) => curr?.[prop], obj);
  }

  private analyzeColumns(data: any[]): ColumnMetadata[] {
    if (data.length === 0) return [];

    const columns: ColumnMetadata[] = [];
    const sampleItem = data[0];

    for (const [key, value] of Object.entries(sampleItem)) {
      const allValues = data.map(item => item[key]);
      const nonNullValues = allValues.filter(v => v != null);
      
      const metadata: ColumnMetadata = {
        name: key,
        type: this.inferDataType(value),
        nullable: allValues.some(v => v == null),
        unique: new Set(allValues).size === allValues.length,
        distribution: {
          nullCount: allValues.length - nonNullValues.length,
          uniqueCount: new Set(allValues).size
        }
      };

      if (metadata.type === 'number') {
        const numValues = nonNullValues.filter(v => typeof v === 'number');
        if (numValues.length > 0) {
          metadata.distribution!.min = Math.min(...numValues);
          metadata.distribution!.max = Math.max(...numValues);
          metadata.distribution!.mean = numValues.reduce((a, b) => a + b, 0) / numValues.length;
          
          const sorted = [...numValues].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          metadata.distribution!.median = sorted.length % 2 ? 
            sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        }
      }

      columns.push(metadata);
    }

    return columns;
  }

  private inferDataType(value: any): ColumnMetadata['type'] {
    if (value == null) return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (value instanceof Date) return 'date';
    if (typeof value === 'string' && !isNaN(Date.parse(value))) return 'date';
    return 'string';
  }

  private async getCachedVisualization(configId: string, filters?: Record<string, any>): Promise<VisualizationData | null> {
    try {
      const cacheKey = this.generateCacheKey(configId, filters);
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        const data = JSON.parse(cached);
        data.metadata.fromCache = true;
        return data;
      }
    } catch (error) {
      this.logger.warn('Failed to get cached visualization:', error);
    }
    
    return null;
  }

  private async cacheVisualization(configId: string, filters: Record<string, any> | undefined, data: VisualizationData, ttl: number): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(configId, filters);
      await this.redis.setex(cacheKey, ttl, JSON.stringify(data));
    } catch (error) {
      this.logger.warn('Failed to cache visualization:', error);
    }
  }

  private generateCacheKey(configId: string, filters?: Record<string, any>): string {
    const filterString = filters ? JSON.stringify(filters) : '';
    return `viz:${configId}:${Buffer.from(filterString).toString('base64')}`;
  }

  private async renderChartJS(config: any): Promise<Buffer> {
    // Mock Chart.js rendering
    this.logger.info('Rendering Chart.js visualization - mock implementation');
    return Buffer.from('mock-chartjs-image');
  }

  private async exportChartJS(config: any, options: ExportOptions): Promise<string> {
    // Mock Chart.js export
    this.logger.info('Exporting Chart.js visualization - mock implementation');
    return './exports/chart.png';
  }

  private async renderD3(config: any): Promise<Buffer> {
    // Mock D3 rendering
    this.logger.info('Rendering D3 visualization - mock implementation');
    return Buffer.from('mock-d3-image');
  }

  private async exportD3(config: any, options: ExportOptions): Promise<string> {
    // Mock D3 export
    this.logger.info('Exporting D3 visualization - mock implementation');
    return './exports/d3-chart.svg';
  }

  private async loadVisualizationTemplates(): Promise<void> {
    if (!this.db) return;

    const templates: VisualizationTemplate[] = [
      {
        id: 'line-chart-basic',
        name: 'Basic Line Chart',
        description: 'Simple line chart for showing trends over time',
        category: 'time-series',
        chartType: 'line',
        previewImage: '/templates/line-chart.png',
        defaultConfig: {
          type: 'line',
          styling: {
            theme: 'light',
            colors: { primary: ['#2196F3', '#FF9800', '#4CAF50'] },
            layout: { showLegend: true, showGrid: true }
          }
        },
        requiredFields: ['date', 'value'],
        optionalFields: ['category'],
        useCases: ['Trend analysis', 'Time series data', 'Performance metrics'],
        difficulty: 'beginner',
        tags: ['line', 'time-series', 'trend'],
        popularity: 95,
        createdAt: new Date()
      },
      {
        id: 'bar-chart-grouped',
        name: 'Grouped Bar Chart',
        description: 'Compare multiple categories across different groups',
        category: 'comparison',
        chartType: 'bar',
        previewImage: '/templates/bar-chart.png',
        defaultConfig: {
          type: 'bar',
          styling: {
            theme: 'light',
            colors: { primary: ['#FF5722', '#9C27B0', '#607D8B'] },
            layout: { showLegend: true, legendPosition: 'top' }
          }
        },
        requiredFields: ['category', 'value'],
        optionalFields: ['subcategory'],
        useCases: ['Category comparison', 'Sales analysis', 'Survey results'],
        difficulty: 'beginner',
        tags: ['bar', 'comparison', 'categorical'],
        popularity: 88,
        createdAt: new Date()
      }
    ];

    for (const template of templates) {
      await this.db.collection('visualization_templates').updateOne(
        { id: template.id },
        { $set: template },
        { upsert: true }
      );
    }

    this.logger.info(`Loaded ${templates.length} visualization templates`);
  }

  async getVisualizationTemplates(category?: string): Promise<VisualizationTemplate[]> {
    if (!this.db) throw new Error('Database not initialized');

    const query = category ? { category } : {};
    return await this.db.collection('visualization_templates')
      .find(query)
      .sort({ popularity: -1 })
      .toArray();
  }

  async exportVisualization(configId: string, format: VisualizationExport['format'], options: ExportOptions = {}): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    const exportId = `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const exportRecord: VisualizationExport = {
      id: exportId,
      configId,
      format,
      options,
      status: 'pending',
      createdAt: new Date()
    };

    await this.db.collection('visualization_exports').insertOne(exportRecord);

    try {
      exportRecord.status = 'processing';
      await this.db.collection('visualization_exports').updateOne(
        { id: exportId },
        { $set: { status: 'processing' } }
      );

      // Generate visualization first
      const visualizationData = await this.generateVisualization(configId);
      
      // Export based on format
      let filePath: string;
      switch (format) {
        case 'png':
        case 'svg':
          const renderer = this.chartRenderers.get(visualizationData.chartConfig.library);
          filePath = await renderer.export(visualizationData.chartConfig.config, options);
          break;
        case 'pdf':
          filePath = await this.exportToPDF(visualizationData, options);
          break;
        case 'html':
          filePath = await this.exportToHTML(visualizationData, options);
          break;
        case 'json':
          filePath = await this.exportToJSON(visualizationData, options);
          break;
        case 'csv':
          filePath = await this.exportToCSV(visualizationData, options);
          break;
        case 'excel':
          filePath = await this.exportToExcel(visualizationData, options);
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      exportRecord.status = 'completed';
      exportRecord.filePath = filePath;
      exportRecord.completedAt = new Date();
      
      await this.db.collection('visualization_exports').updateOne(
        { id: exportId },
        { $set: exportRecord }
      );

      this.emit('visualizationExported', { exportId, configId, format, filePath });
      return exportId;

    } catch (error) {
      exportRecord.status = 'failed';
      exportRecord.error = error.message;
      
      await this.db.collection('visualization_exports').updateOne(
        { id: exportId },
        { $set: exportRecord }
      );

      throw error;
    }
  }

  private async exportToPDF(data: VisualizationData, options: ExportOptions): Promise<string> {
    this.logger.info('Exporting to PDF - mock implementation');
    return './exports/visualization.pdf';
  }

  private async exportToHTML(data: VisualizationData, options: ExportOptions): Promise<string> {
    this.logger.info('Exporting to HTML - mock implementation');
    return './exports/visualization.html';
  }

  private async exportToJSON(data: VisualizationData, options: ExportOptions): Promise<string> {
    this.logger.info('Exporting to JSON - mock implementation');
    return './exports/visualization.json';
  }

  private async exportToCSV(data: VisualizationData, options: ExportOptions): Promise<string> {
    this.logger.info('Exporting to CSV - mock implementation');
    return './exports/visualization.csv';
  }

  private async exportToExcel(data: VisualizationData, options: ExportOptions): Promise<string> {
    this.logger.info('Exporting to Excel - mock implementation');
    return './exports/visualization.xlsx';
  }

  async getVisualizationConfigs(filters?: {
    type?: string;
    createdBy?: string;
    tags?: string[];
  }): Promise<VisualizationConfig[]> {
    if (!this.db) throw new Error('Database not initialized');

    const query: any = {};
    if (filters?.type) query.type = filters.type;
    if (filters?.createdBy) query.createdBy = filters.createdBy;
    if (filters?.tags) query.tags = { $in: filters.tags };

    return await this.db.collection('visualization_configs')
      .find(query)
      .sort({ updatedAt: -1 })
      .toArray();
  }

  async getVisualizationData(dataId: string): Promise<VisualizationData | null> {
    if (!this.db) throw new Error('Database not initialized');

    return await this.db.collection('visualization_data').findOne({ id: dataId });
  }

  async deleteVisualizationConfig(configId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.collection('visualization_configs').deleteOne({ id: configId });
    await this.db.collection('visualization_data').deleteMany({ configId });
    
    // Clear cache
    const cachePattern = `viz:${configId}:*`;
    const keys = await this.redis.keys(cachePattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }

    this.emit('visualizationDeleted', { configId });
  }
}
