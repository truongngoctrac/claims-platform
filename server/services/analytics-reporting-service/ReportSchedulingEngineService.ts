import { Db, MongoClient } from 'mongodb';
import { EventEmitter } from 'events';
import * as winston from 'winston';
import IORedis from 'ioredis';
import * as cron from 'node-cron';

export interface ScheduledReport {
  id: string;
  name: string;
  description: string;
  templateId: string;
  schedule: ScheduleConfiguration;
  parameters: ReportParameters;
  output: OutputConfiguration;
  distribution: DistributionConfiguration;
  notifications: NotificationConfiguration;
  retry: RetryConfiguration;
  dependencies: DependencyConfiguration[];
  permissions: PermissionConfiguration;
  status: 'active' | 'paused' | 'disabled' | 'archived';
  metadata: ScheduleMetadata;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  lastRun?: Date;
  nextRun?: Date;
}

export interface ScheduleConfiguration {
  type: 'cron' | 'interval' | 'event' | 'manual';
  cronExpression?: string;
  interval?: {
    value: number;
    unit: 'minutes' | 'hours' | 'days' | 'weeks' | 'months';
  };
  timezone: string;
  startDate?: Date;
  endDate?: Date;
  maxExecutions?: number;
  runOnHolidays: boolean;
  businessHoursOnly: boolean;
  weekdays?: number[];
  months?: number[];
  conditions?: ScheduleCondition[];
}

export interface ScheduleCondition {
  type: 'data_threshold' | 'file_exists' | 'api_status' | 'custom';
  condition: string;
  parameters: Record<string, any>;
}

export interface ReportParameters {
  static: Record<string, any>;
  dynamic: DynamicParameter[];
  computed: ComputedParameter[];
}

export interface DynamicParameter {
  name: string;
  source: 'database' | 'api' | 'file' | 'environment';
  query: string;
  defaultValue?: any;
  transformation?: string;
}

export interface ComputedParameter {
  name: string;
  expression: string;
  dependencies: string[];
}

export interface OutputConfiguration {
  formats: OutputFormat[];
  naming: NamingConfiguration;
  compression: CompressionConfiguration;
  retention: RetentionConfiguration;
  storage: StorageConfiguration[];
}

export interface OutputFormat {
  type: 'pdf' | 'excel' | 'csv' | 'json' | 'html' | 'xml';
  options: Record<string, any>;
  postProcessing?: PostProcessingStep[];
}

export interface PostProcessingStep {
  type: 'watermark' | 'encryption' | 'signature' | 'conversion' | 'merge';
  configuration: Record<string, any>;
}

export interface NamingConfiguration {
  template: string;
  includeTimestamp: boolean;
  timestampFormat: string;
  includeBuildNumber: boolean;
  customSuffix?: string;
}

export interface CompressionConfiguration {
  enabled: boolean;
  algorithm: 'zip' | 'gzip' | '7z' | 'rar';
  level: number;
  password?: string;
}

export interface RetentionConfiguration {
  keepVersions: number;
  maxAge: number;
  archiveAfter: number;
  deleteAfter: number;
}

export interface StorageConfiguration {
  type: 'local' | 's3' | 'azure' | 'gcp' | 'ftp' | 'sftp';
  path: string;
  credentials?: Record<string, string>;
  options?: Record<string, any>;
}

export interface DistributionConfiguration {
  enabled: boolean;
  channels: DistributionChannel[];
  timing: DistributionTiming;
  failover: FailoverConfiguration;
}

export interface DistributionChannel {
  type: 'email' | 'slack' | 'teams' | 'webhook' | 'ftp' | 'api';
  recipients: string[];
  template: string;
  attachFiles: boolean;
  embedContent: boolean;
  customHeaders?: Record<string, string>;
  authentication?: Record<string, string>;
}

export interface DistributionTiming {
  immediate: boolean;
  delay?: number;
  businessHoursOnly: boolean;
  timezone: string;
}

export interface FailoverConfiguration {
  enabled: boolean;
  maxRetries: number;
  retryDelay: number;
  fallbackChannels: string[];
}

export interface NotificationConfiguration {
  onSuccess: NotificationSettings;
  onFailure: NotificationSettings;
  onRetry: NotificationSettings;
  summary: SummaryNotificationSettings;
}

export interface NotificationSettings {
  enabled: boolean;
  channels: string[];
  recipients: string[];
  template: string;
  includeDetails: boolean;
}

export interface SummaryNotificationSettings {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  schedule: string;
  channels: string[];
  recipients: string[];
  includeMetrics: boolean;
}

export interface RetryConfiguration {
  enabled: boolean;
  maxAttempts: number;
  backoffStrategy: 'linear' | 'exponential' | 'fixed';
  initialDelay: number;
  maxDelay: number;
  retryOn: RetryCondition[];
}

export interface RetryCondition {
  type: 'error_type' | 'status_code' | 'timeout' | 'resource_unavailable';
  pattern: string;
}

export interface DependencyConfiguration {
  type: 'schedule' | 'file' | 'database' | 'api' | 'service';
  reference: string;
  condition: string;
  timeout: number;
  optional: boolean;
}

export interface PermissionConfiguration {
  canView: string[];
  canEdit: string[];
  canExecute: string[];
  canDelete: string[];
  accessHours?: {
    start: string;
    end: string;
    timezone: string;
  };
}

export interface ScheduleMetadata {
  tags: string[];
  category: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  cost?: {
    estimated: number;
    actual: number;
    currency: string;
  };
  sla?: {
    maxDuration: number;
    maxFailureRate: number;
  };
  monitoring: {
    enabled: boolean;
    alerts: string[];
    dashboards: string[];
  };
}

export interface ScheduleExecution {
  id: string;
  scheduleId: string;
  status: 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled' | 'retrying';
  triggerType: 'scheduled' | 'manual' | 'dependency' | 'api';
  triggeredBy: string;
  scheduledTime: Date;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  attempt: number;
  maxAttempts: number;
  parameters: Record<string, any>;
  outputs: ExecutionOutput[];
  distributions: ExecutionDistribution[];
  errors?: ExecutionError[];
  metrics: ExecutionMetrics;
  logs: ExecutionLog[];
}

export interface ExecutionOutput {
  format: string;
  filePath: string;
  fileSize: number;
  checksum: string;
  storage: string;
  accessUrl?: string;
}

export interface ExecutionDistribution {
  channel: string;
  recipient: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  sentAt?: Date;
  deliveredAt?: Date;
  error?: string;
  tracking?: Record<string, any>;
}

export interface ExecutionError {
  type: 'parameter' | 'data' | 'template' | 'output' | 'distribution' | 'system';
  code: string;
  message: string;
  details: any;
  timestamp: Date;
  recoverable: boolean;
}

export interface ExecutionMetrics {
  parameterResolutionTime: number;
  dataFetchTime: number;
  reportGenerationTime: number;
  outputProcessingTime: number;
  distributionTime: number;
  totalExecutionTime: number;
  memoryUsage: number;
  cpuUsage: number;
  storageUsed: number;
  networkUsage: number;
}

export interface ExecutionLog {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: Date;
  context?: any;
}

export interface ScheduleQueue {
  id: string;
  scheduleId: string;
  priority: number;
  scheduledTime: Date;
  dependencies: string[];
  dependencyStatus: Record<string, boolean>;
  parameters: Record<string, any>;
  queuedAt: Date;
  estimatedDuration?: number;
  resourceRequirements?: {
    cpu: number;
    memory: number;
    storage: number;
  };
}

export interface ScheduleAnalytics {
  scheduleId: string;
  period: {
    start: Date;
    end: Date;
  };
  executions: {
    total: number;
    successful: number;
    failed: number;
    cancelled: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
  };
  reliability: {
    successRate: number;
    uptime: number;
    mtbf: number;
    mttr: number;
  };
  performance: {
    avgExecutionTime: number;
    p95ExecutionTime: number;
    avgResourceUsage: ExecutionMetrics;
    peakResourceUsage: ExecutionMetrics;
  };
  distribution: {
    totalSent: number;
    deliveryRate: number;
    failuresByChannel: Record<string, number>;
  };
  costs: {
    total: number;
    perExecution: number;
    byResource: Record<string, number>;
  };
}

export class ReportSchedulingEngineService extends EventEmitter {
  private db: Db | null = null;
  private redis: IORedis;
  private logger: winston.Logger;
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();
  private executionQueue: ScheduleQueue[] = [];
  private isProcessing = false;
  private maxConcurrentExecutions = 5;
  private runningExecutions = new Set<string>();

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
        new winston.transports.File({ filename: 'report-scheduling.log' })
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
      this.startDependencyResolver();
      this.startHealthMonitor();
      
      this.logger.info('Report Scheduling Engine Service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Report Scheduling Engine Service:', error);
      throw error;
    }
  }

  private async ensureIndexes(): Promise<void> {
    if (!this.db) return;

    const collections = {
      scheduled_reports: [
        { key: { id: 1 }, unique: true },
        { key: { status: 1, nextRun: 1 } },
        { key: { templateId: 1 } },
        { key: { 'metadata.category': 1 } },
        { key: { createdBy: 1 } }
      ],
      schedule_executions: [
        { key: { id: 1 }, unique: true },
        { key: { scheduleId: 1, scheduledTime: -1 } },
        { key: { status: 1 } },
        { key: { triggerType: 1, startTime: -1 } }
      ],
      schedule_queue: [
        { key: { id: 1 }, unique: true },
        { key: { priority: -1, scheduledTime: 1 } },
        { key: { scheduleId: 1 } },
        { key: { dependencies: 1 } }
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

  async createScheduledReport(schedule: Omit<ScheduledReport, 'id' | 'createdAt' | 'updatedAt' | 'nextRun'>): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    const scheduledReport: ScheduledReport = {
      id: `sched_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...schedule,
      nextRun: this.calculateNextRun(schedule.schedule),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.db.collection('scheduled_reports').insertOne(scheduledReport);

    if (scheduledReport.status === 'active') {
      await this.scheduleReport(scheduledReport);
    }

    this.logger.info(`Created scheduled report: ${scheduledReport.id}`);
    return scheduledReport.id;
  }

  private calculateNextRun(schedule: ScheduleConfiguration): Date {
    const now = new Date();

    switch (schedule.type) {
      case 'cron':
        if (!schedule.cronExpression) throw new Error('Cron expression required');
        return this.calculateNextCronRun(schedule.cronExpression, schedule.timezone);

      case 'interval':
        if (!schedule.interval) throw new Error('Interval configuration required');
        return this.calculateNextIntervalRun(schedule.interval);

      case 'event':
        // Event-based schedules don't have a fixed next run time
        return new Date(now.getTime() + 24 * 60 * 60 * 1000); // Default to 24 hours

      case 'manual':
        // Manual schedules don't have automatic next runs
        return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // Far future

      default:
        throw new Error(`Unsupported schedule type: ${schedule.type}`);
    }
  }

  private calculateNextCronRun(cronExpression: string, timezone: string): Date {
    try {
      // Simplified cron calculation - in production use a proper cron library
      const now = new Date();
      return new Date(now.getTime() + 60 * 60 * 1000); // Next hour for simplicity
    } catch (error) {
      this.logger.error('Failed to calculate next cron run:', error);
      throw error;
    }
  }

  private calculateNextIntervalRun(interval: ScheduleConfiguration['interval']): Date {
    if (!interval) throw new Error('Interval is required');

    const now = new Date();
    let milliseconds = 0;

    switch (interval.unit) {
      case 'minutes':
        milliseconds = interval.value * 60 * 1000;
        break;
      case 'hours':
        milliseconds = interval.value * 60 * 60 * 1000;
        break;
      case 'days':
        milliseconds = interval.value * 24 * 60 * 60 * 1000;
        break;
      case 'weeks':
        milliseconds = interval.value * 7 * 24 * 60 * 60 * 1000;
        break;
      case 'months':
        milliseconds = interval.value * 30 * 24 * 60 * 60 * 1000; // Approximate
        break;
    }

    return new Date(now.getTime() + milliseconds);
  }

  private async scheduleReport(schedule: ScheduledReport): Promise<void> {
    if (schedule.schedule.type === 'cron' && schedule.schedule.cronExpression) {
      try {
        const task = cron.schedule(
          schedule.schedule.cronExpression,
          async () => {
            await this.triggerScheduledReport(schedule.id, 'scheduled');
          },
          {
            scheduled: false,
            timezone: schedule.schedule.timezone
          }
        );

        task.start();
        this.scheduledTasks.set(schedule.id, task);
        
        this.logger.info(`Scheduled cron task for report: ${schedule.id}`);
      } catch (error) {
        this.logger.error(`Failed to schedule cron task for report: ${schedule.id}`, error);
      }
    } else if (schedule.schedule.type === 'interval') {
      // Handle interval-based scheduling
      const interval = setInterval(async () => {
        await this.triggerScheduledReport(schedule.id, 'scheduled');
      }, this.getIntervalMilliseconds(schedule.schedule.interval!));

      // Store interval reference (in a real implementation)
      this.logger.info(`Scheduled interval task for report: ${schedule.id}`);
    }
  }

  private getIntervalMilliseconds(interval: ScheduleConfiguration['interval']): number {
    if (!interval) return 0;

    switch (interval.unit) {
      case 'minutes': return interval.value * 60 * 1000;
      case 'hours': return interval.value * 60 * 60 * 1000;
      case 'days': return interval.value * 24 * 60 * 60 * 1000;
      case 'weeks': return interval.value * 7 * 24 * 60 * 60 * 1000;
      case 'months': return interval.value * 30 * 24 * 60 * 60 * 1000;
      default: return 0;
    }
  }

  async triggerScheduledReport(scheduleId: string, triggerType: ScheduleExecution['triggerType'], triggeredBy: string = 'system'): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    const schedule = await this.db.collection('scheduled_reports').findOne({ id: scheduleId });
    if (!schedule) throw new Error(`Scheduled report not found: ${scheduleId}`);

    if (schedule.status !== 'active') {
      throw new Error(`Scheduled report is not active: ${scheduleId}`);
    }

    // Check dependencies
    const dependenciesMet = await this.checkDependencies(schedule.dependencies);
    if (!dependenciesMet.allMet) {
      this.logger.info(`Dependencies not met for schedule: ${scheduleId}, queuing for later`);
      await this.queueExecution(schedule, triggerType, triggeredBy, dependenciesMet.missing);
      return 'queued';
    }

    // Resolve parameters
    const resolvedParameters = await this.resolveParameters(schedule.parameters);

    // Create execution record
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const execution: ScheduleExecution = {
      id: executionId,
      scheduleId,
      status: 'scheduled',
      triggerType,
      triggeredBy,
      scheduledTime: new Date(),
      attempt: 1,
      maxAttempts: schedule.retry.enabled ? schedule.retry.maxAttempts : 1,
      parameters: resolvedParameters,
      outputs: [],
      distributions: [],
      metrics: {
        parameterResolutionTime: 0,
        dataFetchTime: 0,
        reportGenerationTime: 0,
        outputProcessingTime: 0,
        distributionTime: 0,
        totalExecutionTime: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        storageUsed: 0,
        networkUsage: 0
      },
      logs: []
    };

    await this.db.collection('schedule_executions').insertOne(execution);

    // Execute immediately or queue based on capacity
    if (this.runningExecutions.size < this.maxConcurrentExecutions) {
      await this.executeScheduledReport(executionId);
    } else {
      await this.queueExecution(schedule, triggerType, triggeredBy, []);
    }

    return executionId;
  }

  private async checkDependencies(dependencies: DependencyConfiguration[]): Promise<{
    allMet: boolean;
    missing: string[];
  }> {
    const missing: string[] = [];

    for (const dependency of dependencies) {
      const isMet = await this.checkSingleDependency(dependency);
      if (!isMet && !dependency.optional) {
        missing.push(dependency.reference);
      }
    }

    return {
      allMet: missing.length === 0,
      missing
    };
  }

  private async checkSingleDependency(dependency: DependencyConfiguration): Promise<boolean> {
    try {
      switch (dependency.type) {
        case 'schedule':
          return await this.checkScheduleDependency(dependency);
        case 'file':
          return await this.checkFileDependency(dependency);
        case 'database':
          return await this.checkDatabaseDependency(dependency);
        case 'api':
          return await this.checkApiDependency(dependency);
        case 'service':
          return await this.checkServiceDependency(dependency);
        default:
          this.logger.warn(`Unknown dependency type: ${dependency.type}`);
          return false;
      }
    } catch (error) {
      this.logger.error(`Failed to check dependency: ${dependency.reference}`, error);
      return false;
    }
  }

  private async checkScheduleDependency(dependency: DependencyConfiguration): Promise<boolean> {
    if (!this.db) return false;

    const recentExecution = await this.db.collection('schedule_executions')
      .findOne({
        scheduleId: dependency.reference,
        status: 'completed',
        endTime: { $gte: new Date(Date.now() - dependency.timeout) }
      });

    return !!recentExecution;
  }

  private async checkFileDependency(dependency: DependencyConfiguration): Promise<boolean> {
    // Mock file dependency check
    this.logger.info(`Checking file dependency: ${dependency.reference} - mock implementation`);
    return Math.random() > 0.3; // 70% success rate for demo
  }

  private async checkDatabaseDependency(dependency: DependencyConfiguration): Promise<boolean> {
    if (!this.db) return false;

    try {
      // Execute dependency condition as a query
      const result = await this.db.collection('temp').findOne(JSON.parse(dependency.condition));
      return !!result;
    } catch (error) {
      this.logger.error('Failed to check database dependency:', error);
      return false;
    }
  }

  private async checkApiDependency(dependency: DependencyConfiguration): Promise<boolean> {
    try {
      const response = await fetch(dependency.reference, { 
        method: 'GET',
        timeout: dependency.timeout 
      });
      return response.ok;
    } catch (error) {
      this.logger.error(`API dependency check failed: ${dependency.reference}`, error);
      return false;
    }
  }

  private async checkServiceDependency(dependency: DependencyConfiguration): Promise<boolean> {
    // Mock service dependency check
    this.logger.info(`Checking service dependency: ${dependency.reference} - mock implementation`);
    return Math.random() > 0.2; // 80% success rate for demo
  }

  private async resolveParameters(parameters: ReportParameters): Promise<Record<string, any>> {
    const resolved = { ...parameters.static };

    // Resolve dynamic parameters
    for (const dynParam of parameters.dynamic) {
      try {
        const value = await this.resolveDynamicParameter(dynParam);
        resolved[dynParam.name] = value;
      } catch (error) {
        this.logger.error(`Failed to resolve dynamic parameter: ${dynParam.name}`, error);
        if (dynParam.defaultValue !== undefined) {
          resolved[dynParam.name] = dynParam.defaultValue;
        }
      }
    }

    // Resolve computed parameters
    for (const compParam of parameters.computed) {
      try {
        const value = await this.resolveComputedParameter(compParam, resolved);
        resolved[compParam.name] = value;
      } catch (error) {
        this.logger.error(`Failed to resolve computed parameter: ${compParam.name}`, error);
      }
    }

    return resolved;
  }

  private async resolveDynamicParameter(parameter: DynamicParameter): Promise<any> {
    switch (parameter.source) {
      case 'database':
        return await this.resolveFromDatabase(parameter);
      case 'api':
        return await this.resolveFromApi(parameter);
      case 'file':
        return await this.resolveFromFile(parameter);
      case 'environment':
        return process.env[parameter.query] || parameter.defaultValue;
      default:
        throw new Error(`Unsupported parameter source: ${parameter.source}`);
    }
  }

  private async resolveFromDatabase(parameter: DynamicParameter): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const query = JSON.parse(parameter.query);
      const result = await this.db.collection('temp').findOne(query);
      
      if (parameter.transformation) {
        return this.applyTransformation(result, parameter.transformation);
      }
      
      return result;
    } catch (error) {
      throw new Error(`Failed to resolve database parameter: ${error.message}`);
    }
  }

  private async resolveFromApi(parameter: DynamicParameter): Promise<any> {
    try {
      const response = await fetch(parameter.query);
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (parameter.transformation) {
        return this.applyTransformation(data, parameter.transformation);
      }
      
      return data;
    } catch (error) {
      throw new Error(`Failed to resolve API parameter: ${error.message}`);
    }
  }

  private async resolveFromFile(parameter: DynamicParameter): Promise<any> {
    // Mock file parameter resolution
    this.logger.info(`Resolving file parameter: ${parameter.query} - mock implementation`);
    return `file_value_${Date.now()}`;
  }

  private applyTransformation(data: any, transformation: string): any {
    // Simple transformation engine - in production use a proper expression evaluator
    try {
      const func = new Function('data', `return ${transformation}`);
      return func(data);
    } catch (error) {
      this.logger.error('Failed to apply transformation:', error);
      return data;
    }
  }

  private async resolveComputedParameter(parameter: ComputedParameter, context: Record<string, any>): Promise<any> {
    try {
      // Check if all dependencies are available
      for (const dep of parameter.dependencies) {
        if (!(dep in context)) {
          throw new Error(`Missing dependency: ${dep}`);
        }
      }

      // Evaluate expression with context
      const func = new Function(...Object.keys(context), `return ${parameter.expression}`);
      return func(...Object.values(context));
    } catch (error) {
      throw new Error(`Failed to compute parameter: ${error.message}`);
    }
  }

  private async queueExecution(
    schedule: ScheduledReport, 
    triggerType: ScheduleExecution['triggerType'], 
    triggeredBy: string,
    dependencies: string[]
  ): Promise<void> {
    if (!this.db) return;

    const queueItem: ScheduleQueue = {
      id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      scheduleId: schedule.id,
      priority: this.calculatePriority(schedule.metadata.priority),
      scheduledTime: new Date(),
      dependencies,
      dependencyStatus: {},
      parameters: {},
      queuedAt: new Date(),
      estimatedDuration: schedule.metadata.sla?.maxDuration
    };

    await this.db.collection('schedule_queue').insertOne(queueItem);
    this.executionQueue.push(queueItem);
    this.sortQueue();

    this.emit('executionQueued', queueItem);
  }

  private calculatePriority(priority: ScheduleMetadata['priority']): number {
    switch (priority) {
      case 'critical': return 1;
      case 'high': return 2;
      case 'normal': return 3;
      case 'low': return 4;
      default: return 3;
    }
  }

  private sortQueue(): void {
    this.executionQueue.sort((a, b) => {
      // First by priority, then by scheduled time
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.scheduledTime.getTime() - b.scheduledTime.getTime();
    });
  }

  private async executeScheduledReport(executionId: string): Promise<void> {
    if (!this.db) return;

    this.runningExecutions.add(executionId);

    try {
      const execution = await this.db.collection('schedule_executions').findOne({ id: executionId });
      if (!execution) throw new Error(`Execution not found: ${executionId}`);

      const schedule = await this.db.collection('scheduled_reports').findOne({ id: execution.scheduleId });
      if (!schedule) throw new Error(`Schedule not found: ${execution.scheduleId}`);

      const startTime = Date.now();

      // Update execution status
      await this.updateExecutionStatus(executionId, 'running', { startTime: new Date() });

      this.emit('executionStarted', { executionId, scheduleId: execution.scheduleId });

      // Generate report
      const reportResult = await this.generateReport(schedule, execution);

      // Process outputs
      const outputs = await this.processOutputs(reportResult, schedule.output, execution);

      // Distribute reports
      const distributions = await this.distributeReports(outputs, schedule.distribution, execution);

      // Calculate final metrics
      const endTime = Date.now();
      const finalMetrics = {
        ...execution.metrics,
        totalExecutionTime: endTime - startTime
      };

      // Complete execution
      await this.updateExecutionStatus(executionId, 'completed', {
        endTime: new Date(),
        duration: endTime - startTime,
        outputs,
        distributions,
        metrics: finalMetrics
      });

      // Update schedule next run time
      await this.updateNextRunTime(schedule.id);

      // Send success notifications
      if (schedule.notifications.onSuccess.enabled) {
        await this.sendNotifications(schedule.notifications.onSuccess, execution, 'success');
      }

      this.emit('executionCompleted', { executionId, scheduleId: execution.scheduleId });
      this.logger.info(`Execution completed: ${executionId}, duration: ${endTime - startTime}ms`);

    } catch (error) {
      await this.handleExecutionError(executionId, error);
    } finally {
      this.runningExecutions.delete(executionId);
    }
  }

  private async generateReport(schedule: ScheduledReport, execution: ScheduleExecution): Promise<any> {
    // Mock report generation - in production integrate with report generation service
    this.logger.info(`Generating report for template: ${schedule.templateId}`);
    
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing time
    
    return {
      data: [{ id: 1, value: 'mock data' }],
      metadata: {
        generatedAt: new Date(),
        recordCount: 1,
        templateId: schedule.templateId
      }
    };
  }

  private async processOutputs(
    reportResult: any, 
    outputConfig: OutputConfiguration, 
    execution: ScheduleExecution
  ): Promise<ExecutionOutput[]> {
    const outputs: ExecutionOutput[] = [];

    for (const format of outputConfig.formats) {
      try {
        const fileName = this.generateFileName(outputConfig.naming, format.type, execution);
        const filePath = await this.generateOutput(reportResult, format, fileName);
        
        // Apply post-processing
        const processedPath = await this.applyPostProcessing(filePath, format.postProcessing || []);
        
        // Store in configured locations
        const storedPaths = await this.storeOutput(processedPath, outputConfig.storage);
        
        outputs.push({
          format: format.type,
          filePath: processedPath,
          fileSize: 1024, // Mock file size
          checksum: 'mock-checksum',
          storage: storedPaths[0] || 'local',
          accessUrl: this.generateAccessUrl(processedPath)
        });

      } catch (error) {
        this.logger.error(`Failed to process output format ${format.type}:`, error);
      }
    }

    return outputs;
  }

  private generateFileName(naming: NamingConfiguration, format: string, execution: ScheduleExecution): string {
    let fileName = naming.template;
    
    // Replace placeholders
    fileName = fileName.replace('{scheduleId}', execution.scheduleId);
    fileName = fileName.replace('{executionId}', execution.id);
    fileName = fileName.replace('{format}', format);
    
    if (naming.includeTimestamp) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      fileName = fileName.replace('{timestamp}', timestamp);
    }
    
    if (naming.customSuffix) {
      fileName += `_${naming.customSuffix}`;
    }
    
    return `${fileName}.${format}`;
  }

  private async generateOutput(reportResult: any, format: OutputFormat, fileName: string): Promise<string> {
    // Mock output generation
    this.logger.info(`Generating ${format.type} output: ${fileName}`);
    return `./outputs/${fileName}`;
  }

  private async applyPostProcessing(filePath: string, steps: PostProcessingStep[]): Promise<string> {
    let processedPath = filePath;
    
    for (const step of steps) {
      this.logger.info(`Applying post-processing step: ${step.type}`);
      // Mock post-processing
      processedPath = `${processedPath}.processed`;
    }
    
    return processedPath;
  }

  private async storeOutput(filePath: string, storageConfigs: StorageConfiguration[]): Promise<string[]> {
    const storedPaths: string[] = [];
    
    for (const storage of storageConfigs) {
      this.logger.info(`Storing output to ${storage.type}: ${storage.path}`);
      storedPaths.push(`${storage.type}:${storage.path}`);
    }
    
    return storedPaths;
  }

  private generateAccessUrl(filePath: string): string {
    return `https://reports.example.com/access/${encodeURIComponent(filePath)}`;
  }

  private async distributeReports(
    outputs: ExecutionOutput[], 
    distributionConfig: DistributionConfiguration, 
    execution: ScheduleExecution
  ): Promise<ExecutionDistribution[]> {
    if (!distributionConfig.enabled) return [];

    const distributions: ExecutionDistribution[] = [];

    for (const channel of distributionConfig.channels) {
      for (const recipient of channel.recipients) {
        try {
          const distribution: ExecutionDistribution = {
            channel: channel.type,
            recipient,
            status: 'pending',
            sentAt: new Date()
          };

          await this.sendToChannel(channel, recipient, outputs, execution);
          
          distribution.status = 'sent';
          distribution.deliveredAt = new Date();
          
          distributions.push(distribution);

        } catch (error) {
          this.logger.error(`Failed to distribute to ${channel.type}:${recipient}:`, error);
          
          distributions.push({
            channel: channel.type,
            recipient,
            status: 'failed',
            error: error.message
          });
        }
      }
    }

    return distributions;
  }

  private async sendToChannel(
    channel: DistributionChannel, 
    recipient: string, 
    outputs: ExecutionOutput[], 
    execution: ScheduleExecution
  ): Promise<void> {
    switch (channel.type) {
      case 'email':
        await this.sendEmail(recipient, outputs, channel, execution);
        break;
      case 'slack':
        await this.sendSlack(recipient, outputs, channel, execution);
        break;
      case 'webhook':
        await this.sendWebhook(recipient, outputs, channel, execution);
        break;
      default:
        this.logger.warn(`Unsupported distribution channel: ${channel.type}`);
    }
  }

  private async sendEmail(recipient: string, outputs: ExecutionOutput[], channel: DistributionChannel, execution: ScheduleExecution): Promise<void> {
    this.logger.info(`Sending email to ${recipient} with ${outputs.length} attachments - mock implementation`);
  }

  private async sendSlack(recipient: string, outputs: ExecutionOutput[], channel: DistributionChannel, execution: ScheduleExecution): Promise<void> {
    this.logger.info(`Sending Slack message to ${recipient} - mock implementation`);
  }

  private async sendWebhook(recipient: string, outputs: ExecutionOutput[], channel: DistributionChannel, execution: ScheduleExecution): Promise<void> {
    this.logger.info(`Sending webhook to ${recipient} - mock implementation`);
  }

  private async updateExecutionStatus(executionId: string, status: ScheduleExecution['status'], updates: any = {}): Promise<void> {
    if (!this.db) return;

    await this.db.collection('schedule_executions').updateOne(
      { id: executionId },
      { $set: { status, ...updates } }
    );
  }

  private async updateNextRunTime(scheduleId: string): Promise<void> {
    if (!this.db) return;

    const schedule = await this.db.collection('scheduled_reports').findOne({ id: scheduleId });
    if (!schedule) return;

    const nextRun = this.calculateNextRun(schedule.schedule);
    
    await this.db.collection('scheduled_reports').updateOne(
      { id: scheduleId },
      { 
        $set: { 
          lastRun: new Date(),
          nextRun: nextRun,
          updatedAt: new Date()
        } 
      }
    );
  }

  private async handleExecutionError(executionId: string, error: any): Promise<void> {
    if (!this.db) return;

    const execution = await this.db.collection('schedule_executions').findOne({ id: executionId });
    if (!execution) return;

    const schedule = await this.db.collection('scheduled_reports').findOne({ id: execution.scheduleId });
    if (!schedule) return;

    const executionError: ExecutionError = {
      type: 'system',
      code: 'EXECUTION_FAILED',
      message: error.message,
      details: error,
      timestamp: new Date(),
      recoverable: this.isRecoverableError(error)
    };

    // Check if retry is needed
    if (schedule.retry.enabled && 
        execution.attempt < execution.maxAttempts && 
        this.shouldRetry(executionError, schedule.retry.retryOn)) {
      
      await this.scheduleRetry(executionId, execution.attempt + 1, schedule.retry);
      
      if (schedule.notifications.onRetry.enabled) {
        await this.sendNotifications(schedule.notifications.onRetry, execution, 'retry', executionError);
      }
      
    } else {
      // Mark as failed
      await this.updateExecutionStatus(executionId, 'failed', {
        endTime: new Date(),
        errors: [executionError]
      });

      if (schedule.notifications.onFailure.enabled) {
        await this.sendNotifications(schedule.notifications.onFailure, execution, 'failure', executionError);
      }

      this.emit('executionFailed', { executionId, scheduleId: execution.scheduleId, error: executionError });
    }

    this.logger.error(`Execution failed: ${executionId}`, error);
  }

  private isRecoverableError(error: any): boolean {
    // Simple logic to determine if error is recoverable
    const recoverablePatterns = [
      'timeout',
      'network',
      'connection',
      'temporary',
      'rate limit'
    ];

    const errorMessage = error.message?.toLowerCase() || '';
    return recoverablePatterns.some(pattern => errorMessage.includes(pattern));
  }

  private shouldRetry(error: ExecutionError, retryConditions: RetryCondition[]): boolean {
    return retryConditions.some(condition => {
      switch (condition.type) {
        case 'error_type':
          return error.type === condition.pattern;
        case 'status_code':
          return error.code === condition.pattern;
        default:
          return false;
      }
    });
  }

  private async scheduleRetry(executionId: string, attempt: number, retryConfig: RetryConfiguration): Promise<void> {
    const delay = this.calculateRetryDelay(attempt, retryConfig);
    
    setTimeout(async () => {
      await this.updateExecutionStatus(executionId, 'retrying', { attempt });
      await this.executeScheduledReport(executionId);
    }, delay);

    this.logger.info(`Scheduled retry for execution ${executionId}, attempt ${attempt}, delay ${delay}ms`);
  }

  private calculateRetryDelay(attempt: number, retryConfig: RetryConfiguration): number {
    switch (retryConfig.backoffStrategy) {
      case 'linear':
        return Math.min(retryConfig.initialDelay * attempt, retryConfig.maxDelay);
      case 'exponential':
        return Math.min(retryConfig.initialDelay * Math.pow(2, attempt - 1), retryConfig.maxDelay);
      case 'fixed':
        return retryConfig.initialDelay;
      default:
        return retryConfig.initialDelay;
    }
  }

  private async sendNotifications(
    notificationSettings: NotificationSettings, 
    execution: ScheduleExecution, 
    type: 'success' | 'failure' | 'retry',
    error?: ExecutionError
  ): Promise<void> {
    this.logger.info(`Sending ${type} notification for execution: ${execution.id} - mock implementation`);
  }

  private async loadScheduledReports(): Promise<void> {
    if (!this.db) return;

    const schedules = await this.db.collection('scheduled_reports')
      .find({ status: 'active' })
      .toArray();

    for (const schedule of schedules) {
      await this.scheduleReport(schedule);
    }

    this.logger.info(`Loaded ${schedules.length} active scheduled reports`);
  }

  private startQueueProcessor(): void {
    setInterval(async () => {
      if (!this.isProcessing && 
          this.executionQueue.length > 0 && 
          this.runningExecutions.size < this.maxConcurrentExecutions) {
        
        await this.processQueuedExecution();
      }
    }, 5000); // Check every 5 seconds
  }

  private async processQueuedExecution(): Promise<void> {
    if (this.executionQueue.length === 0) return;

    this.isProcessing = true;

    try {
      const queueItem = this.executionQueue.shift()!;
      
      // Check dependencies again
      const dependenciesMet = await this.checkDependencies(
        queueItem.dependencies.map(dep => ({ 
          type: 'schedule' as const, 
          reference: dep, 
          condition: '', 
          timeout: 30000, 
          optional: false 
        }))
      );

      if (dependenciesMet.allMet) {
        // Dependencies are now met, execute
        await this.triggerScheduledReport(queueItem.scheduleId, 'scheduled');
        await this.removeFromQueue(queueItem.id);
      } else {
        // Still waiting, put back in queue
        this.executionQueue.push(queueItem);
        this.sortQueue();
      }

    } catch (error) {
      this.logger.error('Failed to process queued execution:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async removeFromQueue(queueId: string): Promise<void> {
    if (!this.db) return;
    
    await this.db.collection('schedule_queue').deleteOne({ id: queueId });
    this.executionQueue = this.executionQueue.filter(q => q.id !== queueId);
  }

  private startDependencyResolver(): void {
    setInterval(async () => {
      // Check and resolve dependencies for queued items
      await this.resolveDependencies();
    }, 30000); // Check every 30 seconds
  }

  private async resolveDependencies(): Promise<void> {
    // Implementation for resolving dependencies
    this.logger.debug('Checking dependencies for queued executions');
  }

  private startHealthMonitor(): void {
    setInterval(async () => {
      await this.performHealthCheck();
    }, 60000); // Check every minute
  }

  private async performHealthCheck(): Promise<void> {
    try {
      // Check queue size
      if (this.executionQueue.length > 100) {
        this.logger.warn(`Large queue size detected: ${this.executionQueue.length}`);
      }

      // Check running executions
      if (this.runningExecutions.size >= this.maxConcurrentExecutions) {
        this.logger.info(`At maximum concurrent executions: ${this.runningExecutions.size}`);
      }

      // Check for stuck executions
      await this.checkStuckExecutions();

    } catch (error) {
      this.logger.error('Health check failed:', error);
    }
  }

  private async checkStuckExecutions(): Promise<void> {
    if (!this.db) return;

    const stuckThreshold = 2 * 60 * 60 * 1000; // 2 hours
    const stuckExecutions = await this.db.collection('schedule_executions')
      .find({
        status: 'running',
        startTime: { $lt: new Date(Date.now() - stuckThreshold) }
      })
      .toArray();

    for (const execution of stuckExecutions) {
      this.logger.warn(`Detected stuck execution: ${execution.id}`);
      await this.handleExecutionError(execution.id, new Error('Execution timeout'));
    }
  }

  async getScheduledReports(filters?: {
    status?: string;
    category?: string;
    createdBy?: string;
  }): Promise<ScheduledReport[]> {
    if (!this.db) throw new Error('Database not initialized');

    const query: any = {};
    if (filters?.status) query.status = filters.status;
    if (filters?.category) query['metadata.category'] = filters.category;
    if (filters?.createdBy) query.createdBy = filters.createdBy;

    return await this.db.collection('scheduled_reports')
      .find(query)
      .sort({ updatedAt: -1 })
      .toArray();
  }

  async getScheduleExecutions(scheduleId: string, limit: number = 50): Promise<ScheduleExecution[]> {
    if (!this.db) throw new Error('Database not initialized');

    return await this.db.collection('schedule_executions')
      .find({ scheduleId })
      .sort({ scheduledTime: -1 })
      .limit(limit)
      .toArray();
  }

  async getScheduleAnalytics(scheduleId: string, startDate: Date, endDate: Date): Promise<ScheduleAnalytics> {
    if (!this.db) throw new Error('Database not initialized');

    const executions = await this.db.collection('schedule_executions')
      .find({
        scheduleId,
        scheduledTime: { $gte: startDate, $lte: endDate }
      })
      .toArray();

    const successful = executions.filter(e => e.status === 'completed');
    const failed = executions.filter(e => e.status === 'failed');
    const cancelled = executions.filter(e => e.status === 'cancelled');

    const durations = successful.map(e => e.duration || 0).filter(d => d > 0);

    return {
      scheduleId,
      period: { start: startDate, end: endDate },
      executions: {
        total: executions.length,
        successful: successful.length,
        failed: failed.length,
        cancelled: cancelled.length,
        avgDuration: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
        minDuration: durations.length > 0 ? Math.min(...durations) : 0,
        maxDuration: durations.length > 0 ? Math.max(...durations) : 0
      },
      reliability: {
        successRate: executions.length > 0 ? successful.length / executions.length : 0,
        uptime: 0.99, // Mock data
        mtbf: 0, // Mean time between failures
        mttr: 0  // Mean time to recovery
      },
      performance: {
        avgExecutionTime: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
        p95ExecutionTime: 0, // Would calculate actual P95
        avgResourceUsage: {
          parameterResolutionTime: 0,
          dataFetchTime: 0,
          reportGenerationTime: 0,
          outputProcessingTime: 0,
          distributionTime: 0,
          totalExecutionTime: 0,
          memoryUsage: 0,
          cpuUsage: 0,
          storageUsed: 0,
          networkUsage: 0
        },
        peakResourceUsage: {
          parameterResolutionTime: 0,
          dataFetchTime: 0,
          reportGenerationTime: 0,
          outputProcessingTime: 0,
          distributionTime: 0,
          totalExecutionTime: 0,
          memoryUsage: 0,
          cpuUsage: 0,
          storageUsed: 0,
          networkUsage: 0
        }
      },
      distribution: {
        totalSent: 0,
        deliveryRate: 0.95,
        failuresByChannel: {}
      },
      costs: {
        total: 0,
        perExecution: 0,
        byResource: {}
      }
    };
  }

  async pauseSchedule(scheduleId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.collection('scheduled_reports').updateOne(
      { id: scheduleId },
      { $set: { status: 'paused', updatedAt: new Date() } }
    );

    // Stop cron task
    const task = this.scheduledTasks.get(scheduleId);
    if (task) {
      task.stop();
      this.scheduledTasks.delete(scheduleId);
    }

    this.emit('schedulePaused', { scheduleId });
  }

  async resumeSchedule(scheduleId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const schedule = await this.db.collection('scheduled_reports').findOne({ id: scheduleId });
    if (!schedule) throw new Error(`Schedule not found: ${scheduleId}`);

    await this.db.collection('scheduled_reports').updateOne(
      { id: scheduleId },
      { $set: { status: 'active', updatedAt: new Date() } }
    );

    await this.scheduleReport(schedule);
    this.emit('scheduleResumed', { scheduleId });
  }

  async cancelExecution(executionId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.updateExecutionStatus(executionId, 'cancelled', {
      endTime: new Date()
    });

    this.runningExecutions.delete(executionId);
    this.emit('executionCancelled', { executionId });
  }
}
