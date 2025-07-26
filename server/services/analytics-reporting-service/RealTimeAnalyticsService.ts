import { EventEmitter } from 'events';
import IORedis from 'ioredis';
import winston from 'winston';
import { WebSocketService } from '../real-time/WebSocketService';

export interface RealTimeMetric {
  id: string;
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary' | 'rate';
  value: number;
  timestamp: Date;
  dimensions: Record<string, string>;
  metadata: Record<string, any>;
}

export interface MetricEvent {
  metricId: string;
  event: 'increment' | 'decrement' | 'set' | 'reset';
  value?: number;
  dimensions?: Record<string, string>;
  timestamp: Date;
}

export interface AlertRule {
  id: string;
  name: string;
  metricId: string;
  condition: {
    operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
    threshold: number;
    timeWindow: number; // in seconds
    aggregation: 'avg' | 'sum' | 'min' | 'max' | 'count';
  };
  actions: AlertAction[];
  isEnabled: boolean;
  lastTriggered?: Date;
  cooldownPeriod: number; // in seconds
}

export interface AlertAction {
  type: 'webhook' | 'email' | 'websocket' | 'log';
  config: Record<string, any>;
}

export interface StreamConfig {
  id: string;
  name: string;
  source: {
    type: 'kafka' | 'redis' | 'websocket' | 'database_change';
    config: Record<string, any>;
  };
  processors: StreamProcessor[];
  output: {
    type: 'metrics' | 'alerts' | 'webhook' | 'database';
    config: Record<string, any>;
  };
  isActive: boolean;
}

export interface StreamProcessor {
  id: string;
  type: 'filter' | 'transform' | 'aggregate' | 'enrich' | 'window';
  config: Record<string, any>;
  order: number;
}

export interface TimeWindow {
  id: string;
  metricId: string;
  windowType: 'sliding' | 'tumbling' | 'session';
  size: number; // in seconds
  step?: number; // for sliding windows
  aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'distinct';
  values: Array<{ timestamp: Date; value: number }>;
}

export class RealTimeAnalyticsService extends EventEmitter {
  private redis: IORedis;
  private redisSubscriber: IORedis;
  private logger: winston.Logger;
  private metrics: Map<string, RealTimeMetric> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private timeWindows: Map<string, TimeWindow> = new Map();
  private streams: Map<string, StreamConfig> = new Map();
  private intervalHandlers: Map<string, NodeJS.Timeout> = new Map();
  private wsService: WebSocketService;

  constructor(
    redisConfig: { host: string; port: number; password?: string },
    wsService: WebSocketService
  ) {
    super();
    
    this.redis = new IORedis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3
    });

    this.redisSubscriber = new IORedis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3
    });

    this.wsService = wsService;

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/realtime-analytics.log' })
      ]
    });
  }

  async initialize(): Promise<void> {
    try {
      // Subscribe to Redis channels for real-time events
      await this.redisSubscriber.subscribe(
        'analytics:metrics',
        'analytics:events',
        'healthcare:claims',
        'healthcare:payments',
        'system:events'
      );

      this.redisSubscriber.on('message', this.handleRedisMessage.bind(this));

      // Load existing metrics and rules
      await this.loadMetrics();
      await this.loadAlertRules();
      await this.loadTimeWindows();
      await this.loadStreamConfigs();

      // Start background processing
      this.startBackgroundProcessing();

      this.logger.info('Real-time Analytics Service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Real-time Analytics Service', error);
      throw error;
    }
  }

  // Metric Management
  async createMetric(metric: Omit<RealTimeMetric, 'timestamp'>): Promise<void> {
    const fullMetric: RealTimeMetric = {
      ...metric,
      timestamp: new Date()
    };

    this.metrics.set(metric.id, fullMetric);
    
    // Persist to Redis
    await this.redis.hset(
      'analytics:metrics',
      metric.id,
      JSON.stringify(fullMetric)
    );

    // Publish metric creation event
    await this.redis.publish('analytics:events', JSON.stringify({
      type: 'metric_created',
      metricId: metric.id,
      timestamp: new Date()
    }));

    this.emit('metricCreated', fullMetric);
    this.logger.info(`Real-time metric created: ${metric.name}`);
  }

  async updateMetric(metricId: string, event: MetricEvent): Promise<void> {
    const metric = this.metrics.get(metricId);
    if (!metric) {
      throw new Error(`Metric not found: ${metricId}`);
    }

    const previousValue = metric.value;
    
    switch (event.event) {
      case 'increment':
        metric.value += event.value || 1;
        break;
      case 'decrement':
        metric.value -= event.value || 1;
        break;
      case 'set':
        metric.value = event.value || 0;
        break;
      case 'reset':
        metric.value = 0;
        break;
    }

    metric.timestamp = event.timestamp;
    if (event.dimensions) {
      metric.dimensions = { ...metric.dimensions, ...event.dimensions };
    }

    // Update in memory and Redis
    this.metrics.set(metricId, metric);
    await this.redis.hset(
      'analytics:metrics',
      metricId,
      JSON.stringify(metric)
    );

    // Store historical data
    await this.storeHistoricalMetric(metric);

    // Update time windows
    await this.updateTimeWindows(metricId, metric.value, metric.timestamp);

    // Check alert rules
    await this.checkAlertRules(metricId, metric, previousValue);

    // Broadcast real-time update
    this.wsService.broadcast('analytics:metric_updated', {
      metricId,
      metric,
      previousValue
    });

    this.emit('metricUpdated', metric, previousValue);
  }

  async getMetric(metricId: string): Promise<RealTimeMetric | null> {
    let metric = this.metrics.get(metricId);
    
    if (!metric) {
      // Try loading from Redis
      const stored = await this.redis.hget('analytics:metrics', metricId);
      if (stored) {
        metric = JSON.parse(stored);
        this.metrics.set(metricId, metric);
      }
    }

    return metric || null;
  }

  async getAllMetrics(): Promise<RealTimeMetric[]> {
    return Array.from(this.metrics.values());
  }

  // Alert Rule Management
  async createAlertRule(rule: AlertRule): Promise<void> {
    this.alertRules.set(rule.id, rule);
    
    await this.redis.hset(
      'analytics:alert_rules',
      rule.id,
      JSON.stringify(rule)
    );

    this.logger.info(`Alert rule created: ${rule.name}`);
  }

  async updateAlertRule(ruleId: string, updates: Partial<AlertRule>): Promise<void> {
    const rule = this.alertRules.get(ruleId);
    if (!rule) {
      throw new Error(`Alert rule not found: ${ruleId}`);
    }

    const updatedRule = { ...rule, ...updates };
    this.alertRules.set(ruleId, updatedRule);
    
    await this.redis.hset(
      'analytics:alert_rules',
      ruleId,
      JSON.stringify(updatedRule)
    );

    this.logger.info(`Alert rule updated: ${ruleId}`);
  }

  async deleteAlertRule(ruleId: string): Promise<void> {
    this.alertRules.delete(ruleId);
    await this.redis.hdel('analytics:alert_rules', ruleId);
    this.logger.info(`Alert rule deleted: ${ruleId}`);
  }

  // Time Window Management
  async createTimeWindow(window: Omit<TimeWindow, 'values'>): Promise<void> {
    const fullWindow: TimeWindow = {
      ...window,
      values: []
    };

    this.timeWindows.set(window.id, fullWindow);
    
    await this.redis.hset(
      'analytics:time_windows',
      window.id,
      JSON.stringify(fullWindow)
    );

    this.logger.info(`Time window created: ${window.id}`);
  }

  // Stream Processing
  async createStream(stream: StreamConfig): Promise<void> {
    this.streams.set(stream.id, stream);
    
    await this.redis.hset(
      'analytics:streams',
      stream.id,
      JSON.stringify(stream)
    );

    if (stream.isActive) {
      await this.startStreamProcessing(stream);
    }

    this.logger.info(`Stream created: ${stream.name}`);
  }

  private async startStreamProcessing(stream: StreamConfig): Promise<void> {
    switch (stream.source.type) {
      case 'redis':
        await this.startRedisStream(stream);
        break;
      case 'websocket':
        await this.startWebSocketStream(stream);
        break;
      case 'database_change':
        await this.startDatabaseChangeStream(stream);
        break;
      default:
        this.logger.warn(`Unsupported stream type: ${stream.source.type}`);
    }
  }

  private async startRedisStream(stream: StreamConfig): Promise<void> {
    const { channel } = stream.source.config;
    
    this.redisSubscriber.subscribe(channel);
    this.redisSubscriber.on('message', async (receivedChannel, message) => {
      if (receivedChannel === channel) {
        await this.processStreamMessage(stream, JSON.parse(message));
      }
    });
  }

  private async startWebSocketStream(stream: StreamConfig): Promise<void> {
    const { eventType } = stream.source.config;
    
    this.wsService.on(eventType, async (data: any) => {
      await this.processStreamMessage(stream, data);
    });
  }

  private async startDatabaseChangeStream(stream: StreamConfig): Promise<void> {
    // Implementation would depend on database type and change detection mechanism
    this.logger.info(`Database change stream started for: ${stream.id}`);
  }

  private async processStreamMessage(stream: StreamConfig, data: any): Promise<void> {
    try {
      let processedData = data;

      // Apply processors in order
      const sortedProcessors = stream.processors.sort((a, b) => a.order - b.order);
      
      for (const processor of sortedProcessors) {
        processedData = await this.applyStreamProcessor(processedData, processor);
        if (processedData === null) {
          return; // Data was filtered out
        }
      }

      // Send to output
      await this.sendToStreamOutput(stream.output, processedData);

    } catch (error) {
      this.logger.error(`Stream processing error for ${stream.id}`, error);
    }
  }

  private async applyStreamProcessor(data: any, processor: StreamProcessor): Promise<any> {
    switch (processor.type) {
      case 'filter':
        return this.filterProcessor(data, processor.config);
      case 'transform':
        return this.transformProcessor(data, processor.config);
      case 'aggregate':
        return this.aggregateProcessor(data, processor.config);
      case 'enrich':
        return this.enrichProcessor(data, processor.config);
      case 'window':
        return this.windowProcessor(data, processor.config);
      default:
        return data;
    }
  }

  private filterProcessor(data: any, config: any): any {
    const { field, operator, value } = config;
    const fieldValue = this.getNestedValue(data, field);

    switch (operator) {
      case '=': return fieldValue === value ? data : null;
      case '!=': return fieldValue !== value ? data : null;
      case '>': return fieldValue > value ? data : null;
      case '<': return fieldValue < value ? data : null;
      case 'exists': return fieldValue !== undefined ? data : null;
      default: return data;
    }
  }

  private transformProcessor(data: any, config: any): any {
    const transformed = { ...data };
    
    for (const [targetField, sourceField] of Object.entries(config.mapping)) {
      transformed[targetField] = this.getNestedValue(data, sourceField as string);
    }

    return transformed;
  }

  private aggregateProcessor(data: any, config: any): any {
    // For real-time aggregation, this would typically accumulate values
    // and emit aggregated results based on time windows or count windows
    return data;
  }

  private enrichProcessor(data: any, config: any): any {
    // Add additional data from external sources
    const enriched = { ...data };
    
    // Add timestamp if not present
    if (!enriched.timestamp) {
      enriched.timestamp = new Date();
    }

    // Add computed fields
    if (config.computedFields) {
      for (const [field, expression] of Object.entries(config.computedFields)) {
        enriched[field] = this.evaluateExpression(data, expression as string);
      }
    }

    return enriched;
  }

  private windowProcessor(data: any, config: any): any {
    // Window processing for real-time analytics
    return data;
  }

  private async sendToStreamOutput(output: StreamConfig['output'], data: any): Promise<void> {
    switch (output.type) {
      case 'metrics':
        await this.updateMetricFromStream(data, output.config);
        break;
      case 'alerts':
        await this.checkAlertsFromStream(data, output.config);
        break;
      case 'webhook':
        await this.sendWebhook(data, output.config);
        break;
      case 'database':
        await this.saveToDatabase(data, output.config);
        break;
    }
  }

  private async updateMetricFromStream(data: any, config: any): Promise<void> {
    const { metricId, valueField, eventType = 'set' } = config;
    const value = this.getNestedValue(data, valueField);

    if (value !== undefined) {
      await this.updateMetric(metricId, {
        metricId,
        event: eventType,
        value: Number(value),
        timestamp: new Date(),
        dimensions: data.dimensions || {}
      });
    }
  }

  private async checkAlertsFromStream(data: any, config: any): Promise<void> {
    // Check if the data triggers any alerts
    for (const rule of this.alertRules.values()) {
      if (rule.isEnabled) {
        await this.evaluateAlertRule(rule, data);
      }
    }
  }

  private async sendWebhook(data: any, config: any): Promise<void> {
    const { url, method = 'POST', headers = {} } = config;
    
    try {
      await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify(data)
      });
    } catch (error) {
      this.logger.error(`Webhook failed: ${url}`, error);
    }
  }

  private async saveToDatabase(data: any, config: any): Promise<void> {
    // Save processed data to database
    const { collection, timestampField = 'timestamp' } = config;
    
    const document = {
      ...data,
      [timestampField]: new Date()
    };

    await this.redis.lpush(`analytics:${collection}`, JSON.stringify(document));
  }

  // Helper methods
  private async handleRedisMessage(channel: string, message: string): Promise<void> {
    try {
      const data = JSON.parse(message);
      
      switch (channel) {
        case 'analytics:metrics':
          await this.handleMetricMessage(data);
          break;
        case 'healthcare:claims':
          await this.handleClaimMessage(data);
          break;
        case 'healthcare:payments':
          await this.handlePaymentMessage(data);
          break;
        case 'system:events':
          await this.handleSystemMessage(data);
          break;
      }
    } catch (error) {
      this.logger.error(`Error processing Redis message from ${channel}`, error);
    }
  }

  private async handleMetricMessage(data: any): Promise<void> {
    // Process incoming metric events
    if (data.metricId && data.event) {
      await this.updateMetric(data.metricId, data);
    }
  }

  private async handleClaimMessage(data: any): Promise<void> {
    // Process claim-related events for real-time analytics
    const events: MetricEvent[] = [
      {
        metricId: 'claims_total',
        event: 'increment',
        timestamp: new Date(),
        dimensions: { 
          status: data.status,
          type: data.claimType,
          hospital: data.hospitalId 
        }
      }
    ];

    if (data.amount) {
      events.push({
        metricId: 'claims_amount',
        event: 'increment',
        value: data.amount,
        timestamp: new Date(),
        dimensions: { 
          status: data.status,
          type: data.claimType 
        }
      });
    }

    for (const event of events) {
      await this.updateMetric(event.metricId, event);
    }
  }

  private async handlePaymentMessage(data: any): Promise<void> {
    // Process payment-related events
    const events: MetricEvent[] = [
      {
        metricId: 'payments_total',
        event: 'increment',
        timestamp: new Date(),
        dimensions: { 
          status: data.status,
          gateway: data.gateway 
        }
      }
    ];

    if (data.amount) {
      events.push({
        metricId: 'payments_amount',
        event: 'increment',
        value: data.amount,
        timestamp: new Date(),
        dimensions: { 
          status: data.status,
          gateway: data.gateway 
        }
      });
    }

    for (const event of events) {
      await this.updateMetric(event.metricId, event);
    }
  }

  private async handleSystemMessage(data: any): Promise<void> {
    // Process system events
    await this.updateMetric('system_events', {
      metricId: 'system_events',
      event: 'increment',
      timestamp: new Date(),
      dimensions: { 
        type: data.type,
        severity: data.severity 
      }
    });
  }

  private async storeHistoricalMetric(metric: RealTimeMetric): Promise<void> {
    const key = `analytics:history:${metric.id}:${this.getDateKey(metric.timestamp)}`;
    await this.redis.lpush(key, JSON.stringify({
      value: metric.value,
      timestamp: metric.timestamp,
      dimensions: metric.dimensions
    }));

    // Set expiry for historical data (e.g., 30 days)
    await this.redis.expire(key, 30 * 24 * 60 * 60);
  }

  private async updateTimeWindows(metricId: string, value: number, timestamp: Date): Promise<void> {
    for (const window of this.timeWindows.values()) {
      if (window.metricId === metricId) {
        await this.updateTimeWindow(window, value, timestamp);
      }
    }
  }

  private async updateTimeWindow(window: TimeWindow, value: number, timestamp: Date): Promise<void> {
    // Add new value
    window.values.push({ timestamp, value });

    // Remove old values based on window size
    const cutoffTime = new Date(timestamp.getTime() - (window.size * 1000));
    window.values = window.values.filter(v => v.timestamp > cutoffTime);

    // Update in Redis
    await this.redis.hset(
      'analytics:time_windows',
      window.id,
      JSON.stringify(window)
    );

    // Calculate aggregated value
    const aggregatedValue = this.calculateWindowAggregation(window);
    
    // Emit window update event
    this.emit('windowUpdated', {
      windowId: window.id,
      metricId: window.metricId,
      aggregatedValue,
      timestamp
    });
  }

  private calculateWindowAggregation(window: TimeWindow): number {
    if (window.values.length === 0) return 0;

    const values = window.values.map(v => v.value);

    switch (window.aggregation) {
      case 'sum': return values.reduce((sum, val) => sum + val, 0);
      case 'avg': return values.reduce((sum, val) => sum + val, 0) / values.length;
      case 'min': return Math.min(...values);
      case 'max': return Math.max(...values);
      case 'count': return values.length;
      case 'distinct': return new Set(values).size;
      default: return 0;
    }
  }

  private async checkAlertRules(metricId: string, metric: RealTimeMetric, previousValue: number): Promise<void> {
    for (const rule of this.alertRules.values()) {
      if (rule.metricId === metricId && rule.isEnabled) {
        await this.evaluateAlertRule(rule, { metric, previousValue });
      }
    }
  }

  private async evaluateAlertRule(rule: AlertRule, data: any): Promise<void> {
    const { condition } = rule;
    const currentTime = new Date();

    // Check cooldown period
    if (rule.lastTriggered) {
      const timeSinceLastTrigger = currentTime.getTime() - rule.lastTriggered.getTime();
      if (timeSinceLastTrigger < rule.cooldownPeriod * 1000) {
        return;
      }
    }

    // Get metric value for comparison
    let valueToCheck = 0;
    if (data.metric) {
      valueToCheck = data.metric.value;
    } else {
      const metric = await this.getMetric(rule.metricId);
      valueToCheck = metric?.value || 0;
    }

    // For time window conditions, get aggregated value
    if (condition.timeWindow > 0) {
      const window = Array.from(this.timeWindows.values())
        .find(w => w.metricId === rule.metricId);
      
      if (window) {
        valueToCheck = this.calculateWindowAggregation(window);
      }
    }

    // Evaluate condition
    const isTriggered = this.evaluateCondition(valueToCheck, condition);

    if (isTriggered) {
      await this.triggerAlert(rule, valueToCheck, currentTime);
    }
  }

  private evaluateCondition(value: number, condition: AlertRule['condition']): boolean {
    switch (condition.operator) {
      case '>': return value > condition.threshold;
      case '<': return value < condition.threshold;
      case '>=': return value >= condition.threshold;
      case '<=': return value <= condition.threshold;
      case '==': return value === condition.threshold;
      case '!=': return value !== condition.threshold;
      default: return false;
    }
  }

  private async triggerAlert(rule: AlertRule, value: number, timestamp: Date): Promise<void> {
    // Update last triggered time
    rule.lastTriggered = timestamp;
    this.alertRules.set(rule.id, rule);
    
    await this.redis.hset(
      'analytics:alert_rules',
      rule.id,
      JSON.stringify(rule)
    );

    // Execute alert actions
    for (const action of rule.actions) {
      await this.executeAlertAction(action, rule, value, timestamp);
    }

    // Emit alert event
    this.emit('alertTriggered', {
      ruleId: rule.id,
      ruleName: rule.name,
      metricId: rule.metricId,
      value,
      threshold: rule.condition.threshold,
      timestamp
    });

    this.logger.warn(`Alert triggered: ${rule.name}`, {
      ruleId: rule.id,
      value,
      threshold: rule.condition.threshold
    });
  }

  private async executeAlertAction(action: AlertAction, rule: AlertRule, value: number, timestamp: Date): Promise<void> {
    const alertData = {
      ruleId: rule.id,
      ruleName: rule.name,
      metricId: rule.metricId,
      value,
      threshold: rule.condition.threshold,
      timestamp,
      message: `Alert: ${rule.name} - Value ${value} ${rule.condition.operator} ${rule.condition.threshold}`
    };

    switch (action.type) {
      case 'webhook':
        await this.sendWebhook(alertData, action.config);
        break;
      case 'websocket':
        this.wsService.broadcast('analytics:alert', alertData);
        break;
      case 'email':
        // Implementation would depend on email service
        this.logger.info(`Email alert would be sent: ${rule.name}`);
        break;
      case 'log':
        this.logger.warn(`Alert: ${rule.name}`, alertData);
        break;
    }
  }

  private startBackgroundProcessing(): Promise<void> {
    // Clean up old data every hour
    const cleanupInterval = setInterval(async () => {
      await this.cleanupOldData();
    }, 60 * 60 * 1000);

    this.intervalHandlers.set('cleanup', cleanupInterval);

    // Aggregate metrics every minute
    const aggregationInterval = setInterval(async () => {
      await this.performPeriodicAggregation();
    }, 60 * 1000);

    this.intervalHandlers.set('aggregation', aggregationInterval);

    return Promise.resolve();
  }

  private async cleanupOldData(): Promise<void> {
    try {
      // Clean up old historical data
      const cutoffDate = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)); // 30 days
      const dateKey = this.getDateKey(cutoffDate);
      
      // This would be more sophisticated in a real implementation
      this.logger.info('Cleaning up old analytics data');
    } catch (error) {
      this.logger.error('Error during data cleanup', error);
    }
  }

  private async performPeriodicAggregation(): Promise<void> {
    try {
      // Perform periodic aggregations for better performance
      const currentTime = new Date();
      
      // Aggregate hourly metrics
      for (const metric of this.metrics.values()) {
        await this.aggregateMetricHourly(metric, currentTime);
      }
    } catch (error) {
      this.logger.error('Error during periodic aggregation', error);
    }
  }

  private async aggregateMetricHourly(metric: RealTimeMetric, timestamp: Date): Promise<void> {
    const hourKey = this.getHourKey(timestamp);
    const aggregationKey = `analytics:hourly:${metric.id}:${hourKey}`;
    
    // Store hourly aggregation
    await this.redis.hset(aggregationKey, 'value', metric.value.toString());
    await this.redis.hset(aggregationKey, 'timestamp', timestamp.toISOString());
    await this.redis.expire(aggregationKey, 7 * 24 * 60 * 60); // 7 days
  }

  // Data loading methods
  private async loadMetrics(): Promise<void> {
    const stored = await this.redis.hgetall('analytics:metrics');
    for (const [id, data] of Object.entries(stored)) {
      this.metrics.set(id, JSON.parse(data));
    }
  }

  private async loadAlertRules(): Promise<void> {
    const stored = await this.redis.hgetall('analytics:alert_rules');
    for (const [id, data] of Object.entries(stored)) {
      this.alertRules.set(id, JSON.parse(data));
    }
  }

  private async loadTimeWindows(): Promise<void> {
    const stored = await this.redis.hgetall('analytics:time_windows');
    for (const [id, data] of Object.entries(stored)) {
      this.timeWindows.set(id, JSON.parse(data));
    }
  }

  private async loadStreamConfigs(): Promise<void> {
    const stored = await this.redis.hgetall('analytics:streams');
    for (const [id, data] of Object.entries(stored)) {
      const stream = JSON.parse(data);
      this.streams.set(id, stream);
      
      if (stream.isActive) {
        await this.startStreamProcessing(stream);
      }
    }
  }

  // Utility methods
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private evaluateExpression(data: any, expression: string): any {
    // Simple expression evaluation - in production, use a proper expression engine
    try {
      // For safety, this would need proper sandboxing
      return eval(expression.replace(/\{(\w+)\}/g, (match, field) => {
        const value = this.getNestedValue(data, field);
        return typeof value === 'string' ? `"${value}"` : value;
      }));
    } catch {
      return null;
    }
  }

  private getDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private getHourKey(date: Date): string {
    const hour = date.getUTCHours().toString().padStart(2, '0');
    return `${this.getDateKey(date)}-${hour}`;
  }

  async shutdown(): Promise<void> {
    // Clean up intervals
    for (const interval of this.intervalHandlers.values()) {
      clearInterval(interval);
    }

    // Close Redis connections
    await this.redis.quit();
    await this.redisSubscriber.quit();

    this.logger.info('Real-time Analytics Service shut down');
  }
}
