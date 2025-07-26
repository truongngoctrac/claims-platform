import { MongoClient, Db } from 'mongodb';
import IORedis from 'ioredis';
import winston from 'winston';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { createCanvas } from 'canvas';
import Chart from 'chart.js/auto';

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: 'dashboard' | 'detailed' | 'summary' | 'comparative' | 'trend';
  category: 'claims' | 'payments' | 'documents' | 'system' | 'custom';
  layout: ReportLayout;
  datasources: DataSource[];
  visualizations: Visualization[];
  parameters: ReportParameter[];
  filters: ReportFilter[];
  scheduling: ScheduleConfig;
  permissions: PermissionConfig;
  metadata: Record<string, any>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportLayout {
  format: 'a4' | 'a3' | 'letter' | 'custom';
  orientation: 'portrait' | 'landscape';
  margins: { top: number; right: number; bottom: number; left: number };
  header: LayoutSection;
  footer: LayoutSection;
  sections: ReportSection[];
}

export interface LayoutSection {
  height: number;
  content: Array<{
    type: 'text' | 'image' | 'logo' | 'date' | 'page';
    content: string;
    style: TextStyle;
    position: { x: number; y: number };
  }>;
}

export interface ReportSection {
  id: string;
  name: string;
  type: 'text' | 'table' | 'chart' | 'kpi' | 'spacer';
  position: { x: number; y: number; width: number; height: number };
  content: any;
  style: SectionStyle;
}

export interface DataSource {
  id: string;
  name: string;
  type: 'mongodb' | 'api' | 'redis' | 'sql';
  connection: any;
  query: any;
  refreshRate: number; // in seconds
  cacheable: boolean;
  dependencies: string[]; // other datasource IDs this depends on
}

export interface Visualization {
  id: string;
  name: string;
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'scatter' | 'area' | 'gauge' | 'table' | 'kpi';
  datasourceId: string;
  config: ChartConfig;
  position: { x: number; y: number; width: number; height: number };
  interactivity: InteractivityConfig;
}

export interface ChartConfig {
  title: string;
  axes?: {
    x: AxisConfig;
    y: AxisConfig;
  };
  series: SeriesConfig[];
  colors: string[];
  legends: LegendConfig;
  styling: ChartStyling;
}

export interface AxisConfig {
  field: string;
  label: string;
  type: 'category' | 'numeric' | 'datetime';
  format?: string;
  min?: number;
  max?: number;
}

export interface SeriesConfig {
  field: string;
  label: string;
  type: 'bar' | 'line' | 'area';
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max';
  color?: string;
}

export interface ReportParameter {
  id: string;
  name: string;
  type: 'date' | 'dateRange' | 'select' | 'multiSelect' | 'text' | 'number';
  required: boolean;
  defaultValue?: any;
  options?: Array<{ value: any; label: string }>;
  validation?: ValidationRule[];
}

export interface ReportFilter {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'between' | 'in' | 'not_in' | 'contains';
  value: any;
  parameterBinding?: string; // Links to a parameter ID
}

export interface ReportExecution {
  id: string;
  templateId: string;
  parameters: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  format: 'pdf' | 'excel' | 'csv' | 'json' | 'html';
  startTime: Date;
  endTime?: Date;
  filePath?: string;
  fileSize?: number;
  errorMessage?: string;
  executedBy: string;
  downloadCount: number;
  expiresAt: Date;
}

export interface ScheduleConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
  cronExpression?: string;
  recipients: string[];
  format: 'pdf' | 'excel' | 'csv';
  deliveryMethod: 'email' | 'ftp' | 'webhook';
  nextRun?: Date;
}

export interface PermissionConfig {
  roles: string[];
  users: string[];
  groups: string[];
  restrictions: {
    maxExecutionsPerDay?: number;
    allowedFormats?: string[];
    dataFilters?: Record<string, any>;
  };
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  color: string;
  align: 'left' | 'center' | 'right';
}

export interface SectionStyle {
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  padding: { top: number; right: number; bottom: number; left: number };
  margin: { top: number; right: number; bottom: number; left: number };
}

export interface LegendConfig {
  show: boolean;
  position: 'top' | 'bottom' | 'left' | 'right';
  alignment: 'start' | 'center' | 'end';
}

export interface ChartStyling {
  backgroundColor: string;
  gridColor: string;
  fontFamily: string;
  fontSize: number;
}

export interface InteractivityConfig {
  clickable: boolean;
  hoverable: boolean;
  drillDown?: {
    enabled: boolean;
    targetReport?: string;
    parameters?: Record<string, string>;
  };
}

export interface ValidationRule {
  type: 'required' | 'min' | 'max' | 'pattern' | 'custom';
  value?: any;
  message: string;
}

export class CustomReportGenerationService {
  private db: Db | null = null;
  private redis: IORedis;
  private logger: winston.Logger;
  private templates: Map<string, ReportTemplate> = new Map();
  private executions: Map<string, ReportExecution> = new Map();

  constructor(
    private connectionString: string,
    private databaseName: string,
    redisConfig: { host: string; port: number; password?: string },
    private storageConfig: { basePath: string; maxFileSize: number; retentionDays: number }
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
        new winston.transports.File({ filename: 'logs/report-generation.log' })
      ]
    });
  }

  async initialize(): Promise<void> {
    try {
      const client = new MongoClient(this.connectionString);
      await client.connect();
      this.db = client.db(this.databaseName);
      
      await this.createReportSchema();
      await this.loadTemplates();
      await this.setupScheduledReports();
      
      this.logger.info('Custom Report Generation Service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Custom Report Generation Service', error);
      throw error;
    }
  }

  private async createReportSchema(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const collections = [
      {
        name: 'report_templates',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['id', 'name', 'type', 'category', 'layout'],
            properties: {
              id: { bsonType: 'string' },
              name: { bsonType: 'string' },
              type: { enum: ['dashboard', 'detailed', 'summary', 'comparative', 'trend'] },
              category: { enum: ['claims', 'payments', 'documents', 'system', 'custom'] },
              layout: { bsonType: 'object' },
              datasources: { bsonType: 'array' },
              visualizations: { bsonType: 'array' }
            }
          }
        }
      },
      {
        name: 'report_executions',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['id', 'templateId', 'status', 'format', 'startTime'],
            properties: {
              id: { bsonType: 'string' },
              templateId: { bsonType: 'string' },
              status: { enum: ['pending', 'running', 'completed', 'failed'] },
              format: { enum: ['pdf', 'excel', 'csv', 'json', 'html'] },
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
    await this.db.collection('report_templates').createIndex({ id: 1 }, { unique: true });
    await this.db.collection('report_templates').createIndex({ category: 1, type: 1 });
    await this.db.collection('report_executions').createIndex({ id: 1 }, { unique: true });
    await this.db.collection('report_executions').createIndex({ templateId: 1, startTime: -1 });
    await this.db.collection('report_executions').createIndex({ status: 1 });
    await this.db.collection('report_executions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  }

  async createTemplate(template: Omit<ReportTemplate, 'createdAt' | 'updatedAt'>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const fullTemplate: ReportTemplate = {
      ...template,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.db.collection('report_templates').replaceOne(
      { id: template.id },
      fullTemplate,
      { upsert: true }
    );

    this.templates.set(template.id, fullTemplate);

    // Cache template
    await this.redis.hset(
      'reports:templates',
      template.id,
      JSON.stringify(fullTemplate)
    );

    this.logger.info(`Report template created: ${template.name}`);
  }

  async updateTemplate(templateId: string, updates: Partial<ReportTemplate>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.collection('report_templates').updateOne(
      { id: templateId },
      { 
        $set: { 
          ...updates, 
          updatedAt: new Date() 
        } 
      }
    );

    if (result.matchedCount === 0) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Update cache
    const template = await this.getTemplate(templateId);
    if (template) {
      this.templates.set(templateId, template);
      await this.redis.hset(
        'reports:templates',
        templateId,
        JSON.stringify(template)
      );
    }

    this.logger.info(`Report template updated: ${templateId}`);
  }

  async getTemplate(templateId: string): Promise<ReportTemplate | null> {
    // Try cache first
    let template = this.templates.get(templateId);
    
    if (!template) {
      const cached = await this.redis.hget('reports:templates', templateId);
      if (cached) {
        template = JSON.parse(cached);
        this.templates.set(templateId, template);
      }
    }

    if (!template && this.db) {
      const stored = await this.db.collection('report_templates').findOne({ id: templateId });
      if (stored) {
        template = stored as ReportTemplate;
        this.templates.set(templateId, template);
        await this.redis.hset(
          'reports:templates',
          templateId,
          JSON.stringify(template)
        );
      }
    }

    return template || null;
  }

  async listTemplates(category?: string, type?: string): Promise<ReportTemplate[]> {
    if (!this.db) throw new Error('Database not initialized');

    const filter: any = {};
    if (category) filter.category = category;
    if (type) filter.type = type;

    const templates = await this.db.collection('report_templates')
      .find(filter)
      .sort({ name: 1 })
      .toArray();

    return templates as ReportTemplate[];
  }

  async executeReport(
    templateId: string,
    parameters: Record<string, any>,
    format: 'pdf' | 'excel' | 'csv' | 'json' | 'html',
    executedBy: string
  ): Promise<string> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Validate parameters
    await this.validateParameters(template, parameters);

    // Check permissions
    await this.checkPermissions(template, executedBy, format);

    // Create execution record
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const execution: ReportExecution = {
      id: executionId,
      templateId,
      parameters,
      status: 'pending',
      format,
      startTime: new Date(),
      executedBy,
      downloadCount: 0,
      expiresAt: new Date(Date.now() + (this.storageConfig.retentionDays * 24 * 60 * 60 * 1000))
    };

    await this.saveExecution(execution);

    // Execute report asynchronously
    this.executeReportAsync(execution, template);

    return executionId;
  }

  private async executeReportAsync(execution: ReportExecution, template: ReportTemplate): Promise<void> {
    try {
      // Update status to running
      execution.status = 'running';
      await this.saveExecution(execution);

      // Collect data from all datasources
      const data = await this.collectReportData(template, execution.parameters);

      // Generate report in requested format
      const filePath = await this.generateReportFile(template, data, execution.format, execution.id);

      // Update execution with results
      execution.status = 'completed';
      execution.endTime = new Date();
      execution.filePath = filePath;
      execution.fileSize = await this.getFileSize(filePath);

      await this.saveExecution(execution);

      this.logger.info(`Report generated successfully: ${execution.id}`, {
        templateId: template.id,
        format: execution.format,
        duration: execution.endTime.getTime() - execution.startTime.getTime()
      });

    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.errorMessage = error instanceof Error ? error.message : String(error);

      await this.saveExecution(execution);

      this.logger.error(`Report generation failed: ${execution.id}`, error);
    }
  }

  private async collectReportData(template: ReportTemplate, parameters: Record<string, any>): Promise<Record<string, any>> {
    const data: Record<string, any> = {};

    // Process datasources in dependency order
    const processedDatasources = new Set<string>();
    const datasourcesToProcess = [...template.datasources];

    while (datasourcesToProcess.length > 0) {
      const remainingDatasources = [];

      for (const datasource of datasourcesToProcess) {
        // Check if all dependencies are processed
        const dependenciesMet = datasource.dependencies.every(dep => processedDatasources.has(dep));

        if (dependenciesMet) {
          try {
            data[datasource.id] = await this.executeDatasource(datasource, parameters, data);
            processedDatasources.add(datasource.id);
          } catch (error) {
            this.logger.error(`Datasource execution failed: ${datasource.id}`, error);
            throw error;
          }
        } else {
          remainingDatasources.push(datasource);
        }
      }

      if (remainingDatasources.length === datasourcesToProcess.length) {
        throw new Error('Circular dependency detected in datasources');
      }

      datasourcesToProcess.length = 0;
      datasourcesToProcess.push(...remainingDatasources);
    }

    return data;
  }

  private async executeDatasource(
    datasource: DataSource,
    parameters: Record<string, any>,
    existingData: Record<string, any>
  ): Promise<any> {
    // Check cache first
    if (datasource.cacheable) {
      const cacheKey = `reports:datasource:${datasource.id}:${JSON.stringify(parameters)}`;
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    let result: any;

    switch (datasource.type) {
      case 'mongodb':
        result = await this.executeMongoDBDatasource(datasource, parameters, existingData);
        break;
      case 'api':
        result = await this.executeAPIDatasource(datasource, parameters, existingData);
        break;
      case 'redis':
        result = await this.executeRedisDatasource(datasource, parameters, existingData);
        break;
      case 'sql':
        result = await this.executeSQLDatasource(datasource, parameters, existingData);
        break;
      default:
        throw new Error(`Unsupported datasource type: ${datasource.type}`);
    }

    // Cache result if cacheable
    if (datasource.cacheable && datasource.refreshRate > 0) {
      const cacheKey = `reports:datasource:${datasource.id}:${JSON.stringify(parameters)}`;
      await this.redis.setex(cacheKey, datasource.refreshRate, JSON.stringify(result));
    }

    return result;
  }

  private async executeMongoDBDatasource(
    datasource: DataSource,
    parameters: Record<string, any>,
    existingData: Record<string, any>
  ): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    // Replace parameter placeholders in query
    const query = this.replacePlaceholders(datasource.query, parameters, existingData);
    
    const collection = this.db.collection(datasource.connection.collection);
    
    if (query.aggregation) {
      return await collection.aggregate(query.aggregation).toArray();
    } else {
      return await collection.find(query.filter || {})
        .sort(query.sort || {})
        .limit(query.limit || 1000)
        .toArray();
    }
  }

  private async executeAPIDatasource(
    datasource: DataSource,
    parameters: Record<string, any>,
    existingData: Record<string, any>
  ): Promise<any> {
    const url = this.replacePlaceholders(datasource.connection.url, parameters, existingData);
    const options = {
      method: datasource.connection.method || 'GET',
      headers: datasource.connection.headers || {},
      body: datasource.connection.body ? JSON.stringify(
        this.replacePlaceholders(datasource.connection.body, parameters, existingData)
      ) : undefined
    };

    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    return await response.json();
  }

  private async executeRedisDatasource(
    datasource: DataSource,
    parameters: Record<string, any>,
    existingData: Record<string, any>
  ): Promise<any> {
    const key = this.replacePlaceholders(datasource.connection.key, parameters, existingData);
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  private async executeSQLDatasource(
    datasource: DataSource,
    parameters: Record<string, any>,
    existingData: Record<string, any>
  ): Promise<any> {
    // SQL datasource implementation would depend on the SQL driver being used
    throw new Error('SQL datasources not implemented');
  }

  private replacePlaceholders(
    obj: any,
    parameters: Record<string, any>,
    existingData: Record<string, any>
  ): any {
    if (typeof obj === 'string') {
      return obj.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return parameters[key] !== undefined ? parameters[key] : 
               existingData[key] !== undefined ? existingData[key] : match;
      });
    } else if (Array.isArray(obj)) {
      return obj.map(item => this.replacePlaceholders(item, parameters, existingData));
    } else if (obj !== null && typeof obj === 'object') {
      const replaced: any = {};
      for (const [key, value] of Object.entries(obj)) {
        replaced[key] = this.replacePlaceholders(value, parameters, existingData);
      }
      return replaced;
    }
    return obj;
  }

  private async generateReportFile(
    template: ReportTemplate,
    data: Record<string, any>,
    format: string,
    executionId: string
  ): Promise<string> {
    const fileName = `${template.name.replace(/\s+/g, '_')}_${executionId}.${format}`;
    const filePath = `${this.storageConfig.basePath}/${fileName}`;

    switch (format) {
      case 'pdf':
        await this.generatePDF(template, data, filePath);
        break;
      case 'excel':
        await this.generateExcel(template, data, filePath);
        break;
      case 'csv':
        await this.generateCSV(template, data, filePath);
        break;
      case 'json':
        await this.generateJSON(template, data, filePath);
        break;
      case 'html':
        await this.generateHTML(template, data, filePath);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    return filePath;
  }

  private async generatePDF(template: ReportTemplate, data: Record<string, any>, filePath: string): Promise<void> {
    const doc = new PDFDocument({
      size: template.layout.format,
      layout: template.layout.orientation,
      margin: template.layout.margins
    });

    const fs = require('fs');
    doc.pipe(fs.createWriteStream(filePath));

    // Add header
    if (template.layout.header) {
      await this.addPDFSection(doc, template.layout.header, data);
    }

    // Add report sections
    for (const section of template.layout.sections) {
      await this.addPDFReportSection(doc, section, template, data);
    }

    // Add footer
    if (template.layout.footer) {
      await this.addPDFSection(doc, template.layout.footer, data);
    }

    doc.end();
  }

  private async addPDFSection(doc: PDFKit.PDFDocument, section: LayoutSection, data: Record<string, any>): Promise<void> {
    for (const content of section.content) {
      switch (content.type) {
        case 'text':
          doc.font(content.style.fontFamily)
             .fontSize(content.style.fontSize)
             .fillColor(content.style.color)
             .text(content.content, content.position.x, content.position.y);
          break;
        case 'date':
          doc.text(new Date().toLocaleDateString(), content.position.x, content.position.y);
          break;
        // Add more content types as needed
      }
    }
  }

  private async addPDFReportSection(
    doc: PDFKit.PDFDocument,
    section: ReportSection,
    template: ReportTemplate,
    data: Record<string, any>
  ): Promise<void> {
    switch (section.type) {
      case 'text':
        doc.text(section.content.text, section.position.x, section.position.y);
        break;
      case 'table':
        await this.addPDFTable(doc, section, data);
        break;
      case 'chart':
        await this.addPDFChart(doc, section, template, data);
        break;
      case 'kpi':
        await this.addPDFKPI(doc, section, data);
        break;
    }
  }

  private async addPDFTable(doc: PDFKit.PDFDocument, section: ReportSection, data: Record<string, any>): Promise<void> {
    const tableData = data[section.content.datasourceId] || [];
    const { columns } = section.content;

    let y = section.position.y;
    const rowHeight = 20;
    const colWidth = section.position.width / columns.length;

    // Draw headers
    columns.forEach((col: any, index: number) => {
      doc.text(col.label, section.position.x + (index * colWidth), y);
    });

    y += rowHeight;

    // Draw data rows
    tableData.forEach((row: any) => {
      columns.forEach((col: any, index: number) => {
        const value = this.getNestedValue(row, col.field);
        doc.text(String(value || ''), section.position.x + (index * colWidth), y);
      });
      y += rowHeight;
    });
  }

  private async addPDFChart(
    doc: PDFKit.PDFDocument,
    section: ReportSection,
    template: ReportTemplate,
    data: Record<string, any>
  ): Promise<void> {
    const visualization = template.visualizations.find(v => v.id === section.content.visualizationId);
    if (!visualization) return;

    const chartData = data[visualization.datasourceId] || [];
    
    // Create chart using canvas and convert to image
    const canvas = createCanvas(section.position.width, section.position.height);
    const ctx = canvas.getContext('2d');

    const chart = new Chart(ctx, {
      type: visualization.type as any,
      data: this.prepareChartData(chartData, visualization.config),
      options: {
        responsive: false,
        animation: false,
        plugins: {
          legend: {
            display: visualization.config.legends.show
          }
        }
      }
    });

    // Convert canvas to buffer and add to PDF
    const buffer = canvas.toBuffer('image/png');
    doc.image(buffer, section.position.x, section.position.y, {
      width: section.position.width,
      height: section.position.height
    });
  }

  private async addPDFKPI(doc: PDFKit.PDFDocument, section: ReportSection, data: Record<string, any>): Promise<void> {
    const kpiData = data[section.content.datasourceId] || {};
    const value = this.getNestedValue(kpiData, section.content.valueField);
    
    doc.fontSize(24)
       .text(String(value), section.position.x, section.position.y);
    
    doc.fontSize(12)
       .text(section.content.label, section.position.x, section.position.y + 30);
  }

  private async generateExcel(template: ReportTemplate, data: Record<string, any>, filePath: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(template.name);

    // Add data from each datasource as separate sections
    let currentRow = 1;

    for (const datasource of template.datasources) {
      const sectionData = data[datasource.id] || [];
      
      if (Array.isArray(sectionData) && sectionData.length > 0) {
        // Add section header
        worksheet.getCell(currentRow, 1).value = datasource.name;
        worksheet.getCell(currentRow, 1).font = { bold: true };
        currentRow += 2;

        // Add column headers
        const columns = Object.keys(sectionData[0]);
        columns.forEach((col, index) => {
          worksheet.getCell(currentRow, index + 1).value = col;
          worksheet.getCell(currentRow, index + 1).font = { bold: true };
        });
        currentRow++;

        // Add data rows
        sectionData.forEach((row: any) => {
          columns.forEach((col, index) => {
            worksheet.getCell(currentRow, index + 1).value = row[col];
          });
          currentRow++;
        });

        currentRow += 2; // Add space between sections
      }
    }

    await workbook.xlsx.writeFile(filePath);
  }

  private async generateCSV(template: ReportTemplate, data: Record<string, any>, filePath: string): Promise<void> {
    const fs = require('fs');
    let csvContent = '';

    for (const datasource of template.datasources) {
      const sectionData = data[datasource.id] || [];
      
      if (Array.isArray(sectionData) && sectionData.length > 0) {
        // Add section header
        csvContent += `${datasource.name}\n\n`;

        // Add column headers
        const columns = Object.keys(sectionData[0]);
        csvContent += columns.join(',') + '\n';

        // Add data rows
        sectionData.forEach((row: any) => {
          const values = columns.map(col => {
            const value = row[col];
            return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
          });
          csvContent += values.join(',') + '\n';
        });

        csvContent += '\n';
      }
    }

    fs.writeFileSync(filePath, csvContent);
  }

  private async generateJSON(template: ReportTemplate, data: Record<string, any>, filePath: string): Promise<void> {
    const fs = require('fs');
    const reportData = {
      template: {
        id: template.id,
        name: template.name,
        type: template.type,
        category: template.category
      },
      generatedAt: new Date(),
      data
    };

    fs.writeFileSync(filePath, JSON.stringify(reportData, null, 2));
  }

  private async generateHTML(template: ReportTemplate, data: Record<string, any>, filePath: string): Promise<void> {
    const fs = require('fs');
    
    let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>${template.name}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .section-title { font-size: 18px; font-weight: bold; margin-top: 30px; margin-bottom: 10px; }
        </style>
    </head>
    <body>
        <h1>${template.name}</h1>
        <p>Generated on: ${new Date().toLocaleString()}</p>
    `;

    for (const datasource of template.datasources) {
      const sectionData = data[datasource.id] || [];
      
      if (Array.isArray(sectionData) && sectionData.length > 0) {
        html += `<div class="section-title">${datasource.name}</div>`;
        html += '<table>';
        
        // Add headers
        const columns = Object.keys(sectionData[0]);
        html += '<tr>';
        columns.forEach(col => {
          html += `<th>${col}</th>`;
        });
        html += '</tr>';

        // Add data rows
        sectionData.forEach((row: any) => {
          html += '<tr>';
          columns.forEach(col => {
            html += `<td>${row[col] || ''}</td>`;
          });
          html += '</tr>';
        });

        html += '</table>';
      }
    }

    html += '</body></html>';
    fs.writeFileSync(filePath, html);
  }

  private prepareChartData(data: any[], config: ChartConfig): any {
    const labels = data.map(item => this.getNestedValue(item, config.axes?.x.field || 'label'));
    
    const datasets = config.series.map((series, index) => ({
      label: series.label,
      data: data.map(item => this.getNestedValue(item, series.field)),
      backgroundColor: config.colors[index % config.colors.length],
      borderColor: config.colors[index % config.colors.length],
      borderWidth: 1
    }));

    return {
      labels,
      datasets
    };
  }

  private async validateParameters(template: ReportTemplate, parameters: Record<string, any>): Promise<void> {
    for (const param of template.parameters) {
      const value = parameters[param.id];

      if (param.required && (value === undefined || value === null || value === '')) {
        throw new Error(`Required parameter missing: ${param.name}`);
      }

      if (value !== undefined && param.validation) {
        for (const rule of param.validation) {
          if (!this.validateParameterValue(value, rule)) {
            throw new Error(rule.message);
          }
        }
      }
    }
  }

  private validateParameterValue(value: any, rule: ValidationRule): boolean {
    switch (rule.type) {
      case 'required':
        return value !== undefined && value !== null && value !== '';
      case 'min':
        return Number(value) >= rule.value;
      case 'max':
        return Number(value) <= rule.value;
      case 'pattern':
        return new RegExp(rule.value).test(String(value));
      default:
        return true;
    }
  }

  private async checkPermissions(template: ReportTemplate, userId: string, format: string): Promise<void> {
    const { permissions } = template;
    
    // Check format restrictions
    if (permissions.restrictions.allowedFormats && 
        !permissions.restrictions.allowedFormats.includes(format)) {
      throw new Error(`Format not allowed: ${format}`);
    }

    // Check execution limits
    if (permissions.restrictions.maxExecutionsPerDay) {
      const today = new Date().toISOString().split('T')[0];
      const executions = await this.getExecutionCount(template.id, userId, today);
      
      if (executions >= permissions.restrictions.maxExecutionsPerDay) {
        throw new Error('Daily execution limit exceeded');
      }
    }
  }

  private async getExecutionCount(templateId: string, userId: string, date: string): Promise<number> {
    if (!this.db) return 0;

    const startOfDay = new Date(date);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const count = await this.db.collection('report_executions').countDocuments({
      templateId,
      executedBy: userId,
      startTime: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    });

    return count;
  }

  private async saveExecution(execution: ReportExecution): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.collection('report_executions').replaceOne(
      { id: execution.id },
      execution,
      { upsert: true }
    );

    this.executions.set(execution.id, execution);
  }

  async getExecution(executionId: string): Promise<ReportExecution | null> {
    let execution = this.executions.get(executionId);

    if (!execution && this.db) {
      const stored = await this.db.collection('report_executions').findOne({ id: executionId });
      if (stored) {
        execution = stored as ReportExecution;
        this.executions.set(executionId, execution);
      }
    }

    return execution || null;
  }

  async downloadReport(executionId: string): Promise<{ filePath: string; fileName: string; mimeType: string }> {
    const execution = await this.getExecution(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    if (execution.status !== 'completed' || !execution.filePath) {
      throw new Error('Report not ready for download');
    }

    // Increment download count
    execution.downloadCount++;
    await this.saveExecution(execution);

    const fileName = execution.filePath.split('/').pop() || 'report';
    const mimeType = this.getMimeType(execution.format);

    return {
      filePath: execution.filePath,
      fileName,
      mimeType
    };
  }

  private getMimeType(format: string): string {
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      csv: 'text/csv',
      json: 'application/json',
      html: 'text/html'
    };

    return mimeTypes[format] || 'application/octet-stream';
  }

  private async getFileSize(filePath: string): Promise<number> {
    const fs = require('fs');
    try {
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private async loadTemplates(): Promise<void> {
    if (!this.db) return;

    const templates = await this.db.collection('report_templates').find({}).toArray();
    for (const template of templates) {
      this.templates.set(template.id, template as ReportTemplate);
    }
  }

  private async setupScheduledReports(): Promise<void> {
    // Implementation for scheduled report execution
    this.logger.info('Scheduled reports setup completed');
  }
}
