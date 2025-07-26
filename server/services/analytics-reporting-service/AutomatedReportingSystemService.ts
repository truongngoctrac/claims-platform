import { Db, MongoClient } from 'mongodb';
import { EventEmitter } from 'events';
import * as winston from 'winston';
import IORedis from 'ioredis';
import * as cron from 'node-cron';

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  type: 'dashboard' | 'table' | 'chart' | 'summary' | 'detailed' | 'executive';
  dataSource: DataSourceConfig;
  layout: ReportLayout;
  filters: ReportFilter[];
  parameters: ReportParameter[];
  formatting: ReportFormatting;
  accessLevel: string[];
  tags: string[];
  version: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface DataSourceConfig {
  type: 'mongodb' | 'sql' | 'api' | 'file' | 'warehouse';
  connection: string;
  query: string;
  transformations: DataTransformation[];
  refreshRate: number;
  cacheable: boolean;
}

export interface DataTransformation {
  type: 'filter' | 'map' | 'aggregate' | 'join' | 'pivot' | 'sort' | 'limit';
  config: Record<string, any>;
  order: number;
}

export interface ReportLayout {
  sections: ReportSection[];
  theme: string;
  responsive: boolean;
  printFriendly: boolean;
  customCss?: string;
}

export interface ReportSection {
  id: string;
  type: 'header' | 'chart' | 'table' | 'text' | 'metric' | 'image' | 'spacer';
  title?: string;
  content: any;
  styling: {
    width: string;
    height: string;
    position: { x: number; y: number };
    padding: string;
    margin: string;
  };
  conditional?: {
    field: string;
    operator: string;
    value: any;
  };
}

export interface ReportFilter {
  field: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'range';
  options?: string[];
  defaultValue?: any;
  required: boolean;
  validation?: {
    min?: any;
    max?: any;
    pattern?: string;
  };
}

export interface ReportParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array';
  defaultValue: any;
  description: string;
  validation?: any;
}

export interface ReportFormatting {
  numberFormat: {
    decimals: number;
    thousandSeparator: string;
    currency?: string;
  };
  dateFormat: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  fonts: {
    header: string;
    body: string;
    size: string;
  };
}

export interface ReportSchedule {
  id: string;
  templateId: string;
  name: string;
  description: string;
  cronExpression: string;
  timezone: string;
  enabled: boolean;
  outputFormat: 'pdf' | 'excel' | 'csv' | 'html' | 'json';
  distribution: DistributionConfig;
  parameters: Record<string, any>;
  filters: Record<string, any>;
  lastRun?: Date;
  nextRun?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DistributionConfig {
  type: 'email' | 'ftp' | 's3' | 'webhook' | 'slack' | 'teams';
  recipients: string[];
  subject?: string;
  template?: string;
  attachments: boolean;
  compression: boolean;
  encryption?: {
    enabled: boolean;
    password?: string;
  };
}

export interface ReportExecution {
  id: string;
  scheduleId?: string;
  templateId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  parameters: Record<string, any>;
  filters: Record<string, any>;
  outputPath?: string;
  outputSize?: number;
  rowsProcessed?: number;
  errors?: ReportError[];
  metrics: ExecutionMetrics;
  triggeredBy: string;
  triggerType: 'manual' | 'scheduled' | 'api' | 'webhook';
}

export interface ReportError {
  type: 'data' | 'rendering' | 'distribution' | 'system';
  message: string;
  code?: string;
  timestamp: Date;
  context?: any;
}

export interface ExecutionMetrics {
  dataFetchTime: number;
  processingTime: number;
  renderingTime: number;
  distributionTime: number;
  memoryUsage: number;
  cpuUsage: number;
}

export interface ReportQueue {
  id: string;
  templateId: string;
  scheduleId?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  parameters: Record<string, any>;
  filters: Record<string, any>;
  requestedBy: string;
  requestedAt: Date;
  estimatedDuration?: number;
  dependencies?: string[];
  retryCount: number;
  maxRetries: number;
}

export interface ReportDistribution {
  id: string;
  executionId: string;
  type: DistributionConfig['type'];
  recipient: string;
  status: 'pending' | 'sent' | 'failed' | 'delivered' | 'bounced';
  attempts: number;
  lastAttempt?: Date;
  deliveredAt?: Date;
  error?: string;
  tracking?: {
    opened?: Date;
    clicked?: Date;
    downloaded?: Date;
  };
}

export interface ReportAnalytics {
  templateId: string;
  period: {
    start: Date;
    end: Date;
  };
  executions: {
    total: number;
    successful: number;
    failed: number;
    avgDuration: number;
    totalDataProcessed: number;
  };
  usage: {
    uniqueUsers: number;
    totalViews: number;
    peakUsageTime: string;
    popularFilters: Record<string, number>;
  };
  performance: {
    avgLoadTime: number;
    p95LoadTime: number;
    errorRate: number;
    cacheHitRate: number;
  };
  distribution: {
    totalSent: number;
    deliveryRate: number;
    openRate: number;
    clickRate: number;
  };
}

export class AutomatedReportingSystemService extends EventEmitter {
  private db: Db | null = null;
  private redis: IORedis;
  private logger: winston.Logger;
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();
  private processingQueue: ReportQueue[] = [];
  private isProcessing = false;

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
        new winston.transports.File({ filename: 'automated-reporting.log' })
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
      await this.loadScheduledReports();
      this.startQueueProcessor();
      
      this.logger.info('Automated Reporting System Service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Automated Reporting System Service:', error);
      throw error;
    }
  }

  private async ensureIndexes(): Promise<void> {
    if (!this.db) return;

    const collections = {
      report_templates: [
        { key: { id: 1 }, unique: true },
        { key: { category: 1, isActive: 1 } },
        { key: { tags: 1 } },
        { key: { createdBy: 1 } }
      ],
      report_schedules: [
        { key: { id: 1 }, unique: true },
        { key: { templateId: 1 } },
        { key: { enabled: 1, nextRun: 1 } },
        { key: { createdBy: 1 } }
      ],
      report_executions: [
        { key: { id: 1 }, unique: true },
        { key: { templateId: 1, startTime: -1 } },
        { key: { scheduleId: 1, startTime: -1 } },
        { key: { status: 1 } },
        { key: { triggeredBy: 1 } }
      ],
      report_queue: [
        { key: { id: 1 }, unique: true },
        { key: { priority: 1, requestedAt: 1 } },
        { key: { templateId: 1 } }
      ],
      report_distributions: [
        { key: { id: 1 }, unique: true },
        { key: { executionId: 1 } },
        { key: { recipient: 1, status: 1 } }
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

  async createReportTemplate(template: Omit<ReportTemplate, 'id' | 'version' | 'createdAt' | 'updatedAt'>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const reportTemplate: ReportTemplate = {
      id: `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      version: 1,
      ...template,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.db.collection('report_templates').insertOne(reportTemplate);
    this.logger.info(`Created report template: ${reportTemplate.id}`);
  }

  async createReportSchedule(schedule: Omit<ReportSchedule, 'id' | 'createdAt' | 'updatedAt' | 'nextRun'>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const reportSchedule: ReportSchedule = {
      id: `sch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...schedule,
      nextRun: this.calculateNextRun(schedule.cronExpression, schedule.timezone),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.db.collection('report_schedules').insertOne(reportSchedule);

    if (reportSchedule.enabled) {
      await this.scheduleReport(reportSchedule);
    }

    this.logger.info(`Created report schedule: ${reportSchedule.id}`);
  }

  private calculateNextRun(cronExpression: string, timezone: string): Date {
    // Simplified next run calculation
    const now = new Date();
    return new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
  }

  private async scheduleReport(schedule: ReportSchedule): Promise<void> {
    try {
      const task = cron.schedule(
        schedule.cronExpression,
        async () => {
          await this.executeScheduledReport(schedule.id);
        },
        {
          scheduled: false,
          timezone: schedule.timezone
        }
      );

      task.start();
      this.scheduledJobs.set(schedule.id, task);
      
      this.logger.info(`Scheduled report: ${schedule.id} with cron: ${schedule.cronExpression}`);
    } catch (error) {
      this.logger.error(`Failed to schedule report: ${schedule.id}`, error);
    }
  }

  async executeReport(
    templateId: string, 
    parameters: Record<string, any> = {},
    filters: Record<string, any> = {},
    triggeredBy: string,
    priority: ReportQueue['priority'] = 'normal'
  ): Promise<string> {
    const queueItem: ReportQueue = {
      id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      templateId,
      priority,
      parameters,
      filters,
      requestedBy: triggeredBy,
      requestedAt: new Date(),
      retryCount: 0,
      maxRetries: 3
    };

    await this.addToQueue(queueItem);
    return queueItem.id;
  }

  private async addToQueue(queueItem: ReportQueue): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.collection('report_queue').insertOne(queueItem);
    this.processingQueue.push(queueItem);
    this.processingQueue.sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority] || 
             a.requestedAt.getTime() - b.requestedAt.getTime();
    });

    this.emit('reportQueued', queueItem);
  }

  private startQueueProcessor(): void {
    setInterval(async () => {
      if (!this.isProcessing && this.processingQueue.length > 0) {
        await this.processNextReport();
      }
    }, 5000); // Check every 5 seconds
  }

  private async processNextReport(): Promise<void> {
    if (this.processingQueue.length === 0) return;

    this.isProcessing = true;
    const queueItem = this.processingQueue.shift()!;

    try {
      const executionId = await this.executeReportInternal(queueItem);
      await this.removeFromQueue(queueItem.id);
      this.emit('reportCompleted', { queueId: queueItem.id, executionId });
    } catch (error) {
      this.logger.error(`Failed to process report queue item: ${queueItem.id}`, error);
      
      if (queueItem.retryCount < queueItem.maxRetries) {
        queueItem.retryCount++;
        this.processingQueue.push(queueItem);
        await this.updateQueueItem(queueItem);
      } else {
        await this.removeFromQueue(queueItem.id);
        this.emit('reportFailed', { queueId: queueItem.id, error: error.message });
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async executeReportInternal(queueItem: ReportQueue): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    const template = await this.db.collection('report_templates').findOne({ id: queueItem.templateId });
    if (!template) throw new Error(`Report template not found: ${queueItem.templateId}`);

    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const execution: ReportExecution = {
      id: executionId,
      scheduleId: queueItem.scheduleId,
      templateId: queueItem.templateId,
      status: 'running',
      startTime: new Date(),
      parameters: queueItem.parameters,
      filters: queueItem.filters,
      triggeredBy: queueItem.requestedBy,
      triggerType: queueItem.scheduleId ? 'scheduled' : 'manual',
      metrics: {
        dataFetchTime: 0,
        processingTime: 0,
        renderingTime: 0,
        distributionTime: 0,
        memoryUsage: 0,
        cpuUsage: 0
      }
    };

    await this.db.collection('report_executions').insertOne(execution);
    this.emit('reportStarted', execution);

    try {
      const startMemory = process.memoryUsage().heapUsed;

      // Fetch data
      const dataStartTime = Date.now();
      const data = await this.fetchReportData(template.dataSource, queueItem.parameters, queueItem.filters);
      execution.metrics.dataFetchTime = Date.now() - dataStartTime;

      // Process data
      const processStartTime = Date.now();
      const processedData = await this.processReportData(data, template.dataSource.transformations);
      execution.metrics.processingTime = Date.now() - processStartTime;
      execution.rowsProcessed = Array.isArray(processedData) ? processedData.length : 1;

      // Render report
      const renderStartTime = Date.now();
      const outputPath = await this.renderReport(template, processedData, queueItem.parameters);
      execution.metrics.renderingTime = Date.now() - renderStartTime;

      // Calculate resource usage
      const endMemory = process.memoryUsage().heapUsed;
      execution.metrics.memoryUsage = endMemory - startMemory;

      // Complete execution
      execution.status = 'completed';
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
      execution.outputPath = outputPath;

      await this.db.collection('report_executions').updateOne(
        { id: executionId },
        { $set: execution }
      );

      this.emit('reportGenerated', execution);
      this.logger.info(`Report execution completed: ${executionId}`);

      return executionId;

    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.errors = [{
        type: 'system',
        message: error.message,
        timestamp: new Date()
      }];

      await this.db.collection('report_executions').updateOne(
        { id: executionId },
        { $set: execution }
      );

      this.emit('reportError', { execution, error });
      throw error;
    }
  }

  private async fetchReportData(
    dataSource: DataSourceConfig, 
    parameters: Record<string, any>,
    filters: Record<string, any>
  ): Promise<any[]> {
    switch (dataSource.type) {
      case 'mongodb':
        return await this.fetchMongoData(dataSource, parameters, filters);
      case 'sql':
        return await this.fetchSqlData(dataSource, parameters, filters);
      case 'api':
        return await this.fetchApiData(dataSource, parameters, filters);
      case 'warehouse':
        return await this.fetchWarehouseData(dataSource, parameters, filters);
      default:
        throw new Error(`Unsupported data source type: ${dataSource.type}`);
    }
  }

  private async fetchMongoData(
    dataSource: DataSourceConfig,
    parameters: Record<string, any>,
    filters: Record<string, any>
  ): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const query = this.interpolateQuery(dataSource.query, { ...parameters, ...filters });
      const pipeline = JSON.parse(query);
      
      return await this.db.collection(dataSource.connection).aggregate(pipeline).toArray();
    } catch (error) {
      this.logger.error('Failed to fetch MongoDB data:', error);
      throw error;
    }
  }

  private async fetchSqlData(
    dataSource: DataSourceConfig,
    parameters: Record<string, any>,
    filters: Record<string, any>
  ): Promise<any[]> {
    // Mock SQL data fetching
    this.logger.info('Fetching SQL data - mock implementation');
    return [{ id: 1, value: 'mock data' }];
  }

  private async fetchApiData(
    dataSource: DataSourceConfig,
    parameters: Record<string, any>,
    filters: Record<string, any>
  ): Promise<any[]> {
    try {
      const url = this.interpolateQuery(dataSource.connection, { ...parameters, ...filters });
      const response = await fetch(url);
      
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

  private async fetchWarehouseData(
    dataSource: DataSourceConfig,
    parameters: Record<string, any>,
    filters: Record<string, any>
  ): Promise<any[]> {
    // Mock warehouse data fetching
    this.logger.info('Fetching warehouse data - mock implementation');
    return [{ dimension: 'test', fact: 100, measure: 50.5 }];
  }

  private interpolateQuery(query: string, variables: Record<string, any>): string {
    let interpolated = query;
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      interpolated = interpolated.replace(regex, typeof value === 'string' ? `"${value}"` : String(value));
    }

    return interpolated;
  }

  private async processReportData(data: any[], transformations: DataTransformation[]): Promise<any[]> {
    let processedData = [...data];

    for (const transformation of transformations.sort((a, b) => a.order - b.order)) {
      switch (transformation.type) {
        case 'filter':
          processedData = this.applyFilter(processedData, transformation.config);
          break;
        case 'map':
          processedData = this.applyMap(processedData, transformation.config);
          break;
        case 'aggregate':
          processedData = this.applyAggregation(processedData, transformation.config);
          break;
        case 'sort':
          processedData = this.applySort(processedData, transformation.config);
          break;
        case 'limit':
          processedData = processedData.slice(0, transformation.config.count);
          break;
      }
    }

    return processedData;
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

  private applyAggregation(data: any[], config: any): any[] {
    const grouped = new Map();
    
    for (const item of data) {
      const key = config.groupBy.map((field: string) => this.getNestedValue(item, field)).join('|');
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(item);
    }

    const result = [];
    for (const [key, items] of grouped) {
      const aggregated: any = {};
      
      // Add group by fields
      config.groupBy.forEach((field: string, index: number) => {
        aggregated[field] = key.split('|')[index];
      });

      // Calculate aggregations
      for (const [field, aggType] of Object.entries(config.aggregations)) {
        const values = items.map((item: any) => this.getNestedValue(item, field));
        aggregated[`${aggType}_${field}`] = this.calculateAggregation(values, aggType as string);
      }

      result.push(aggregated);
    }

    return result;
  }

  private applySort(data: any[], config: any): any[] {
    return data.sort((a, b) => {
      for (const { field, direction } of config.fields) {
        const aVal = this.getNestedValue(a, field);
        const bVal = this.getNestedValue(b, field);
        
        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((curr, prop) => curr?.[prop], obj);
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
      default: return 0;
    }
  }

  private async renderReport(template: ReportTemplate, data: any[], parameters: Record<string, any>): Promise<string> {
    const outputDir = process.env.REPORTS_OUTPUT_DIR || './reports';
    const fileName = `${template.id}_${Date.now()}.html`;
    const outputPath = `${outputDir}/${fileName}`;

    // Generate HTML report
    const html = this.generateHtmlReport(template, data, parameters);
    
    // In a real implementation, save to file system or cloud storage
    this.logger.info(`Report rendered to: ${outputPath}`);
    
    return outputPath;
  }

  private generateHtmlReport(template: ReportTemplate, data: any[], parameters: Record<string, any>): string {
    let html = `
<!DOCTYPE html>
<html>
<head>
    <title>${template.name}</title>
    <style>
        body { font-family: ${template.formatting.fonts.body}; color: ${template.formatting.colors.text}; }
        .header { background: ${template.formatting.colors.primary}; color: white; padding: 20px; }
        .section { margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: ${template.formatting.colors.secondary}; }
        ${template.layout.customCss || ''}
    </style>
</head>
<body>
    <div class="header">
        <h1>${template.name}</h1>
        <p>${template.description}</p>
        <p>Generated: ${new Date().toLocaleString()}</p>
    </div>
`;

    for (const section of template.layout.sections) {
      html += this.renderSection(section, data, parameters, template);
    }

    html += `
</body>
</html>`;

    return html;
  }

  private renderSection(section: ReportSection, data: any[], parameters: Record<string, any>, template: ReportTemplate): string {
    // Check conditional rendering
    if (section.conditional) {
      const conditionMet = this.evaluateCondition(
        parameters[section.conditional.field], 
        { [section.conditional.operator]: section.conditional.value }
      );
      if (!conditionMet) return '';
    }

    switch (section.type) {
      case 'header':
        return `<h2 class="section">${section.title || ''}</h2>`;
      
      case 'text':
        return `<div class="section">${section.content}</div>`;
      
      case 'table':
        return this.renderTable(data, section);
      
      case 'metric':
        return this.renderMetric(data, section);
      
      case 'chart':
        return this.renderChart(data, section);
      
      default:
        return `<div class="section">Unsupported section type: ${section.type}</div>`;
    }
  }

  private renderTable(data: any[], section: ReportSection): string {
    if (!Array.isArray(data) || data.length === 0) {
      return '<div class="section">No data available</div>';
    }

    const headers = Object.keys(data[0]);
    let html = `<div class="section"><h3>${section.title || 'Data Table'}</h3><table><thead><tr>`;
    
    for (const header of headers) {
      html += `<th>${header}</th>`;
    }
    html += '</tr></thead><tbody>';

    for (const row of data) {
      html += '<tr>';
      for (const header of headers) {
        html += `<td>${row[header] || ''}</td>`;
      }
      html += '</tr>';
    }

    html += '</tbody></table></div>';
    return html;
  }

  private renderMetric(data: any[], section: ReportSection): string {
    const config = section.content;
    const value = this.calculateAggregation(
      data.map(item => this.getNestedValue(item, config.field)), 
      config.aggregation
    );

    return `
      <div class="section">
        <h3>${section.title || 'Metric'}</h3>
        <div style="font-size: 2em; font-weight: bold; color: ${config.color || '#333'};">
          ${this.formatNumber(value, config.format)}
        </div>
      </div>
    `;
  }

  private renderChart(data: any[], section: ReportSection): string {
    // Placeholder for chart rendering
    return `
      <div class="section">
        <h3>${section.title || 'Chart'}</h3>
        <div style="border: 1px solid #ddd; height: 300px; display: flex; align-items: center; justify-content: center;">
          Chart visualization (${data.length} data points)
        </div>
      </div>
    `;
  }

  private formatNumber(value: number, format?: any): string {
    if (format?.type === 'currency') {
      return new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: format.currency || 'USD' 
      }).format(value);
    }
    
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: format?.decimals || 0,
      maximumFractionDigits: format?.decimals || 2
    }).format(value);
  }

  private async executeScheduledReport(scheduleId: string): Promise<void> {
    if (!this.db) return;

    try {
      const schedule = await this.db.collection('report_schedules').findOne({ id: scheduleId });
      if (!schedule || !schedule.enabled) return;

      await this.executeReport(
        schedule.templateId,
        schedule.parameters,
        schedule.filters,
        'system',
        'normal'
      );

      // Update last run and next run
      const nextRun = this.calculateNextRun(schedule.cronExpression, schedule.timezone);
      await this.db.collection('report_schedules').updateOne(
        { id: scheduleId },
        { 
          $set: { 
            lastRun: new Date(),
            nextRun: nextRun
          } 
        }
      );

    } catch (error) {
      this.logger.error(`Failed to execute scheduled report: ${scheduleId}`, error);
    }
  }

  private async loadScheduledReports(): Promise<void> {
    if (!this.db) return;

    const schedules = await this.db.collection('report_schedules')
      .find({ enabled: true })
      .toArray();

    for (const schedule of schedules) {
      await this.scheduleReport(schedule);
    }

    this.logger.info(`Loaded ${schedules.length} scheduled reports`);
  }

  private async removeFromQueue(queueId: string): Promise<void> {
    if (!this.db) return;
    
    await this.db.collection('report_queue').deleteOne({ id: queueId });
    this.processingQueue = this.processingQueue.filter(q => q.id !== queueId);
  }

  private async updateQueueItem(queueItem: ReportQueue): Promise<void> {
    if (!this.db) return;
    
    await this.db.collection('report_queue').updateOne(
      { id: queueItem.id },
      { $set: queueItem }
    );
  }

  async getReportTemplates(filters?: { category?: string; createdBy?: string }): Promise<ReportTemplate[]> {
    if (!this.db) throw new Error('Database not initialized');

    const query: any = { isActive: true };
    if (filters?.category) query.category = filters.category;
    if (filters?.createdBy) query.createdBy = filters.createdBy;

    return await this.db.collection('report_templates')
      .find(query)
      .sort({ updatedAt: -1 })
      .toArray();
  }

  async getReportExecutions(filters?: {
    templateId?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<ReportExecution[]> {
    if (!this.db) throw new Error('Database not initialized');

    const query: any = {};
    if (filters?.templateId) query.templateId = filters.templateId;
    if (filters?.status) query.status = filters.status;
    if (filters?.startDate || filters?.endDate) {
      query.startTime = {};
      if (filters.startDate) query.startTime.$gte = filters.startDate;
      if (filters.endDate) query.startTime.$lte = filters.endDate;
    }

    return await this.db.collection('report_executions')
      .find(query)
      .sort({ startTime: -1 })
      .toArray();
  }

  async getReportAnalytics(templateId: string, startDate: Date, endDate: Date): Promise<ReportAnalytics> {
    if (!this.db) throw new Error('Database not initialized');

    const executions = await this.db.collection('report_executions')
      .find({
        templateId,
        startTime: { $gte: startDate, $lte: endDate }
      })
      .toArray();

    const successful = executions.filter(e => e.status === 'completed');
    const failed = executions.filter(e => e.status === 'failed');

    return {
      templateId,
      period: { start: startDate, end: endDate },
      executions: {
        total: executions.length,
        successful: successful.length,
        failed: failed.length,
        avgDuration: successful.reduce((sum, e) => sum + (e.duration || 0), 0) / successful.length || 0,
        totalDataProcessed: successful.reduce((sum, e) => sum + (e.rowsProcessed || 0), 0)
      },
      usage: {
        uniqueUsers: new Set(executions.map(e => e.triggeredBy)).size,
        totalViews: executions.length,
        peakUsageTime: '09:00', // Mock data
        popularFilters: {} // Mock data
      },
      performance: {
        avgLoadTime: successful.reduce((sum, e) => sum + (e.metrics.dataFetchTime || 0), 0) / successful.length || 0,
        p95LoadTime: 0, // Would calculate actual P95
        errorRate: failed.length / executions.length,
        cacheHitRate: 0.8 // Mock data
      },
      distribution: {
        totalSent: 0, // Would calculate from distributions
        deliveryRate: 0.95, // Mock data
        openRate: 0.75, // Mock data
        clickRate: 0.25 // Mock data
      }
    };
  }

  async cancelExecution(executionId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.collection('report_executions').updateOne(
      { id: executionId, status: { $in: ['queued', 'running'] } },
      { 
        $set: { 
          status: 'cancelled',
          endTime: new Date()
        } 
      }
    );

    // Remove from queue if present
    await this.removeFromQueue(executionId);
    
    this.emit('reportCancelled', { executionId });
  }
}
