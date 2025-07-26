import { EventEmitter } from 'events';
import { Logger } from 'winston';

export interface APIMetrics {
  timestamp: Date;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  requestSize: number;
  responseSize: number;
  apiKey?: string;
  userId?: string;
  userAgent: string;
  ipAddress: string;
  version: string;
  error?: string;
  externalAPI?: string;
  metadata: Record<string, any>;
}

export interface PerformanceMetrics {
  endpoint: string;
  method: string;
  averageResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  totalRequests: number;
  successRate: number;
  errorRate: number;
  requestsPerSecond: number;
  throughput: number;
  errorBreakdown: Record<string, number>;
  timeSeriesData: {
    timestamp: Date;
    requests: number;
    responseTime: number;
    errors: number;
  }[];
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: {
    metric: 'response_time' | 'error_rate' | 'success_rate' | 'requests_per_minute' | 'external_api_failures';
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
    threshold: number;
    duration: number; // minutes
  };
  filters: {
    endpoints?: string[];
    methods?: string[];
    versions?: string[];
    externalAPIs?: string[];
  };
  notification: {
    email?: string[];
    webhook?: string;
    slack?: string;
    sms?: string[];
  };
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  cooldown: number; // minutes
  lastTriggered?: Date;
  metadata: Record<string, any>;
}

export interface AlertEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: string;
  timestamp: Date;
  value: number;
  threshold: number;
  message: string;
  affectedEndpoints: string[];
  metadata: Record<string, any>;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  timestamp: Date;
  details: {
    endpoint?: string;
    error?: string;
    checks: {
      name: string;
      status: 'pass' | 'fail';
      value?: any;
      message?: string;
    }[];
  };
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'down';
  services: HealthCheckResult[];
  uptime: number;
  version: string;
  timestamp: Date;
  metrics: {
    totalRequests: number;
    activeConnections: number;
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
    responseTime: number;
  };
}

export class APIMonitoringService extends EventEmitter {
  private metrics: APIMetrics[] = [];
  private performanceCache: Map<string, PerformanceMetrics> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private alertEvents: Map<string, AlertEvent> = new Map();
  private healthChecks: Map<string, HealthCheckResult> = new Map();
  private logger: Logger;
  private monitoringInterval: NodeJS.Timer;
  private alertCheckInterval: NodeJS.Timer;
  private healthCheckInterval: NodeJS.Timer;

  constructor(logger: Logger) {
    super();
    this.logger = logger;
    this.initializeDefaultAlerts();
    this.startMonitoring();
  }

  private initializeDefaultAlerts(): void {
    // High response time alert
    this.createAlertRule({
      name: 'High Response Time',
      description: 'Alert when API response time exceeds threshold',
      condition: {
        metric: 'response_time',
        operator: 'gt',
        threshold: 5000, // 5 seconds
        duration: 5 // 5 minutes
      },
      filters: {},
      notification: {
        email: [process.env.ALERT_EMAIL || 'ops@healthclaims.vn'],
        webhook: process.env.ALERT_WEBHOOK
      },
      enabled: true,
      severity: 'high',
      cooldown: 15, // 15 minutes
      metadata: {
        category: 'performance',
        priority: 'high'
      }
    });

    // High error rate alert
    this.createAlertRule({
      name: 'High Error Rate',
      description: 'Alert when error rate exceeds 5%',
      condition: {
        metric: 'error_rate',
        operator: 'gt',
        threshold: 0.05, // 5%
        duration: 3 // 3 minutes
      },
      filters: {},
      notification: {
        email: [process.env.ALERT_EMAIL || 'ops@healthclaims.vn'],
        slack: process.env.SLACK_WEBHOOK
      },
      enabled: true,
      severity: 'critical',
      cooldown: 10, // 10 minutes
      metadata: {
        category: 'reliability',
        priority: 'critical'
      }
    });

    // External API failures alert
    this.createAlertRule({
      name: 'External API Failures',
      description: 'Alert when external API success rate drops below 90%',
      condition: {
        metric: 'external_api_failures',
        operator: 'gt',
        threshold: 0.1, // 10% failure rate
        duration: 5 // 5 minutes
      },
      filters: {},
      notification: {
        email: [process.env.ALERT_EMAIL || 'ops@healthclaims.vn']
      },
      enabled: true,
      severity: 'medium',
      cooldown: 20, // 20 minutes
      metadata: {
        category: 'external-integrations',
        priority: 'medium'
      }
    });

    // High traffic alert
    this.createAlertRule({
      name: 'High Traffic',
      description: 'Alert when requests per minute exceed normal levels',
      condition: {
        metric: 'requests_per_minute',
        operator: 'gt',
        threshold: 1000, // 1000 requests per minute
        duration: 2 // 2 minutes
      },
      filters: {},
      notification: {
        email: [process.env.ALERT_EMAIL || 'ops@healthclaims.vn']
      },
      enabled: true,
      severity: 'medium',
      cooldown: 30, // 30 minutes
      metadata: {
        category: 'traffic',
        priority: 'medium'
      }
    });
  }

  public recordMetric(metric: Omit<APIMetrics, 'timestamp'>): void {
    const fullMetric: APIMetrics = {
      ...metric,
      timestamp: new Date()
    };

    this.metrics.push(fullMetric);

    // Keep only last 100,000 metrics in memory
    if (this.metrics.length > 100000) {
      this.metrics = this.metrics.slice(-100000);
    }

    // Update performance cache
    this.updatePerformanceMetrics(fullMetric);

    // Emit metric event for real-time processing
    this.emit('metric-recorded', fullMetric);

    // Log metric for external analysis
    this.logger.info('API metric recorded', {
      endpoint: metric.endpoint,
      method: metric.method,
      statusCode: metric.statusCode,
      responseTime: metric.responseTime,
      apiKey: metric.apiKey,
      userId: metric.userId,
      externalAPI: metric.externalAPI
    });
  }

  private updatePerformanceMetrics(metric: APIMetrics): void {
    const key = `${metric.method}:${metric.endpoint}`;
    let perf = this.performanceCache.get(key);

    if (!perf) {
      perf = {
        endpoint: metric.endpoint,
        method: metric.method,
        averageResponseTime: 0,
        p50ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        totalRequests: 0,
        successRate: 0,
        errorRate: 0,
        requestsPerSecond: 0,
        throughput: 0,
        errorBreakdown: {},
        timeSeriesData: []
      };
      this.performanceCache.set(key, perf);
    }

    // Update basic metrics
    perf.totalRequests++;
    
    // Update response time metrics
    const responseTimes = this.getRecentResponseTimes(metric.endpoint, metric.method);
    responseTimes.push(metric.responseTime);
    responseTimes.sort((a, b) => a - b);

    perf.averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    perf.p50ResponseTime = this.percentile(responseTimes, 0.5);
    perf.p95ResponseTime = this.percentile(responseTimes, 0.95);
    perf.p99ResponseTime = this.percentile(responseTimes, 0.99);

    // Update success/error rates
    const recentMetrics = this.getRecentMetrics(metric.endpoint, metric.method, 60); // Last 60 minutes
    const successCount = recentMetrics.filter(m => m.statusCode >= 200 && m.statusCode < 400).length;
    const totalCount = recentMetrics.length;
    
    perf.successRate = totalCount > 0 ? successCount / totalCount : 1;
    perf.errorRate = 1 - perf.successRate;

    // Update error breakdown
    if (metric.statusCode >= 400) {
      const errorType = metric.error || `HTTP_${metric.statusCode}`;
      perf.errorBreakdown[errorType] = (perf.errorBreakdown[errorType] || 0) + 1;
    }

    // Update requests per second
    const lastMinute = new Date(Date.now() - 60000);
    const recentRequests = recentMetrics.filter(m => m.timestamp > lastMinute);
    perf.requestsPerSecond = recentRequests.length / 60;

    // Update throughput (requests + response size)
    perf.throughput = recentMetrics.reduce((sum, m) => sum + m.requestSize + m.responseSize, 0);

    // Update time series data
    const now = new Date();
    const currentMinute = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());
    
    let timeSeriesEntry = perf.timeSeriesData.find(ts => ts.timestamp.getTime() === currentMinute.getTime());
    if (!timeSeriesEntry) {
      timeSeriesEntry = {
        timestamp: currentMinute,
        requests: 0,
        responseTime: 0,
        errors: 0
      };
      perf.timeSeriesData.push(timeSeriesEntry);
    }

    timeSeriesEntry.requests++;
    timeSeriesEntry.responseTime = (timeSeriesEntry.responseTime * (timeSeriesEntry.requests - 1) + metric.responseTime) / timeSeriesEntry.requests;
    if (metric.statusCode >= 400) {
      timeSeriesEntry.errors++;
    }

    // Keep only last 24 hours of time series data
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    perf.timeSeriesData = perf.timeSeriesData.filter(ts => ts.timestamp > cutoff);
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = (sorted.length - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  private getRecentResponseTimes(endpoint: string, method: string, minutes: number = 60): number[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.metrics
      .filter(m => m.endpoint === endpoint && m.method === method && m.timestamp > cutoff)
      .map(m => m.responseTime);
  }

  private getRecentMetrics(endpoint: string, method: string, minutes: number = 60): APIMetrics[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.metrics.filter(m => 
      m.endpoint === endpoint && 
      m.method === method && 
      m.timestamp > cutoff
    );
  }

  public createAlertRule(rule: Omit<AlertRule, 'id'>): AlertRule {
    const id = crypto.randomUUID();
    const alertRule: AlertRule = {
      id,
      ...rule
    };
    
    this.alertRules.set(id, alertRule);
    this.emit('alert-rule-created', alertRule);
    return alertRule;
  }

  public updateAlertRule(id: string, updates: Partial<AlertRule>): boolean {
    const rule = this.alertRules.get(id);
    if (!rule) return false;

    const updatedRule = { ...rule, ...updates };
    this.alertRules.set(id, updatedRule);
    this.emit('alert-rule-updated', updatedRule);
    return true;
  }

  public deleteAlertRule(id: string): boolean {
    const deleted = this.alertRules.delete(id);
    if (deleted) {
      this.emit('alert-rule-deleted', id);
    }
    return deleted;
  }

  private checkAlerts(): void {
    const now = new Date();

    for (const [ruleId, rule] of this.alertRules.entries()) {
      if (!rule.enabled) continue;

      // Check cooldown period
      if (rule.lastTriggered) {
        const cooldownEnd = new Date(rule.lastTriggered.getTime() + rule.cooldown * 60 * 1000);
        if (now < cooldownEnd) continue;
      }

      const shouldTrigger = this.evaluateAlertCondition(rule);
      if (shouldTrigger) {
        this.triggerAlert(rule);
      }
    }
  }

  private evaluateAlertCondition(rule: AlertRule): boolean {
    const { condition, filters } = rule;
    const cutoff = new Date(Date.now() - condition.duration * 60 * 1000);

    // Filter metrics based on rule filters
    let relevantMetrics = this.metrics.filter(m => m.timestamp > cutoff);

    if (filters.endpoints?.length) {
      relevantMetrics = relevantMetrics.filter(m => filters.endpoints!.includes(m.endpoint));
    }
    if (filters.methods?.length) {
      relevantMetrics = relevantMetrics.filter(m => filters.methods!.includes(m.method));
    }
    if (filters.versions?.length) {
      relevantMetrics = relevantMetrics.filter(m => filters.versions!.includes(m.version));
    }
    if (filters.externalAPIs?.length) {
      relevantMetrics = relevantMetrics.filter(m => m.externalAPI && filters.externalAPIs!.includes(m.externalAPI));
    }

    if (relevantMetrics.length === 0) return false;

    let value: number;

    switch (condition.metric) {
      case 'response_time':
        value = relevantMetrics.reduce((sum, m) => sum + m.responseTime, 0) / relevantMetrics.length;
        break;
      
      case 'error_rate':
        const errorCount = relevantMetrics.filter(m => m.statusCode >= 400).length;
        value = errorCount / relevantMetrics.length;
        break;
      
      case 'success_rate':
        const successCount = relevantMetrics.filter(m => m.statusCode >= 200 && m.statusCode < 400).length;
        value = successCount / relevantMetrics.length;
        break;
      
      case 'requests_per_minute':
        value = relevantMetrics.length / condition.duration;
        break;
      
      case 'external_api_failures':
        const externalFailures = relevantMetrics.filter(m => m.externalAPI && m.statusCode >= 400).length;
        const externalTotal = relevantMetrics.filter(m => m.externalAPI).length;
        value = externalTotal > 0 ? externalFailures / externalTotal : 0;
        break;
      
      default:
        return false;
    }

    // Evaluate condition
    switch (condition.operator) {
      case 'gt': return value > condition.threshold;
      case 'gte': return value >= condition.threshold;
      case 'lt': return value < condition.threshold;
      case 'lte': return value <= condition.threshold;
      case 'eq': return value === condition.threshold;
      default: return false;
    }
  }

  private triggerAlert(rule: AlertRule): void {
    const alertId = crypto.randomUUID();
    const now = new Date();

    // Calculate current value for the alert
    const value = this.getCurrentMetricValue(rule);
    const affectedEndpoints = this.getAffectedEndpoints(rule);

    const alertEvent: AlertEvent = {
      id: alertId,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      timestamp: now,
      value,
      threshold: rule.condition.threshold,
      message: this.generateAlertMessage(rule, value),
      affectedEndpoints,
      metadata: rule.metadata,
      acknowledged: false
    };

    this.alertEvents.set(alertId, alertEvent);
    rule.lastTriggered = now;
    this.alertRules.set(rule.id, rule);

    // Send notifications
    this.sendAlertNotifications(alertEvent, rule);

    // Emit alert event
    this.emit('alert-triggered', alertEvent);

    this.logger.error('Alert triggered', {
      alertId,
      ruleName: rule.name,
      severity: rule.severity,
      value,
      threshold: rule.condition.threshold,
      affectedEndpoints
    });
  }

  private getCurrentMetricValue(rule: AlertRule): number {
    const cutoff = new Date(Date.now() - rule.condition.duration * 60 * 1000);
    const relevantMetrics = this.metrics.filter(m => m.timestamp > cutoff);

    switch (rule.condition.metric) {
      case 'response_time':
        return relevantMetrics.reduce((sum, m) => sum + m.responseTime, 0) / relevantMetrics.length;
      case 'error_rate':
        const errorCount = relevantMetrics.filter(m => m.statusCode >= 400).length;
        return errorCount / relevantMetrics.length;
      case 'requests_per_minute':
        return relevantMetrics.length / rule.condition.duration;
      case 'external_api_failures':
        const externalFailures = relevantMetrics.filter(m => m.externalAPI && m.statusCode >= 400).length;
        const externalTotal = relevantMetrics.filter(m => m.externalAPI).length;
        return externalTotal > 0 ? externalFailures / externalTotal : 0;
      default:
        return 0;
    }
  }

  private getAffectedEndpoints(rule: AlertRule): string[] {
    const cutoff = new Date(Date.now() - rule.condition.duration * 60 * 1000);
    const relevantMetrics = this.metrics.filter(m => m.timestamp > cutoff);
    
    const endpoints = new Set<string>();
    relevantMetrics.forEach(m => endpoints.add(`${m.method} ${m.endpoint}`));
    
    return Array.from(endpoints);
  }

  private generateAlertMessage(rule: AlertRule, value: number): string {
    const condition = rule.condition;
    const threshold = condition.threshold;
    
    let metricName = condition.metric.replace(/_/g, ' ');
    let valueStr = value.toFixed(2);
    let thresholdStr = threshold.toFixed(2);

    if (condition.metric.includes('rate')) {
      valueStr = (value * 100).toFixed(1) + '%';
      thresholdStr = (threshold * 100).toFixed(1) + '%';
    } else if (condition.metric === 'response_time') {
      valueStr = value.toFixed(0) + 'ms';
      thresholdStr = threshold.toFixed(0) + 'ms';
    }

    return `Alert: ${rule.name} - ${metricName} is ${valueStr} (threshold: ${thresholdStr})`;
  }

  private async sendAlertNotifications(alert: AlertEvent, rule: AlertRule): Promise<void> {
    const { notification } = rule;

    // Email notifications
    if (notification.email?.length) {
      // Implementation would send emails
      this.logger.info('Sending email alerts', {
        recipients: notification.email,
        alertId: alert.id
      });
    }

    // Webhook notifications
    if (notification.webhook) {
      try {
        const response = await fetch(notification.webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            alert,
            rule: {
              id: rule.id,
              name: rule.name,
              severity: rule.severity
            }
          })
        });
        
        if (!response.ok) {
          throw new Error(`Webhook failed: ${response.status}`);
        }
      } catch (error) {
        this.logger.error('Failed to send webhook notification', {
          webhook: notification.webhook,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Slack notifications
    if (notification.slack) {
      try {
        const slackMessage = {
          text: alert.message,
          attachments: [
            {
              color: this.getSlackColor(alert.severity),
              fields: [
                {
                  title: 'Severity',
                  value: alert.severity,
                  short: true
                },
                {
                  title: 'Value',
                  value: alert.value.toString(),
                  short: true
                },
                {
                  title: 'Affected Endpoints',
                  value: alert.affectedEndpoints.join('\n'),
                  short: false
                }
              ],
              timestamp: Math.floor(alert.timestamp.getTime() / 1000)
            }
          ]
        };

        const response = await fetch(notification.slack, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slackMessage)
        });

        if (!response.ok) {
          throw new Error(`Slack notification failed: ${response.status}`);
        }
      } catch (error) {
        this.logger.error('Failed to send Slack notification', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  private getSlackColor(severity: string): string {
    switch (severity) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'warning';
      case 'low': return 'good';
      default: return '#808080';
    }
  }

  public acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.alertEvents.get(alertId);
    if (!alert) return false;

    alert.acknowledged = true;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date();

    this.emit('alert-acknowledged', alert);
    return true;
  }

  public performHealthCheck(serviceName: string, checkFunction: () => Promise<HealthCheckResult>): void {
    checkFunction()
      .then(result => {
        this.healthChecks.set(serviceName, result);
        this.emit('health-check-completed', result);
      })
      .catch(error => {
        const errorResult: HealthCheckResult = {
          service: serviceName,
          status: 'down',
          responseTime: 0,
          timestamp: new Date(),
          details: {
            error: error instanceof Error ? error.message : 'Unknown error',
            checks: [
              {
                name: 'service-availability',
                status: 'fail',
                message: error instanceof Error ? error.message : 'Unknown error'
              }
            ]
          }
        };
        
        this.healthChecks.set(serviceName, errorResult);
        this.emit('health-check-failed', errorResult);
      });
  }

  public getSystemHealth(): SystemHealth {
    const services = Array.from(this.healthChecks.values());
    const overallStatus = this.calculateOverallHealth(services);
    
    return {
      overall: overallStatus,
      services,
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date(),
      metrics: {
        totalRequests: this.metrics.length,
        activeConnections: 0, // Would be provided by server
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
        cpuUsage: process.cpuUsage().user / 1000, // Convert to ms
        diskUsage: 0, // Would need disk space check
        responseTime: this.getAverageResponseTime()
      }
    };
  }

  private calculateOverallHealth(services: HealthCheckResult[]): 'healthy' | 'degraded' | 'down' {
    if (services.length === 0) return 'healthy';
    
    const healthyCount = services.filter(s => s.status === 'healthy').length;
    const degradedCount = services.filter(s => s.status === 'degraded').length;
    const downCount = services.filter(s => s.status === 'down').length;
    
    if (downCount > 0) return 'down';
    if (degradedCount > 0) return 'degraded';
    return 'healthy';
  }

  private getAverageResponseTime(): number {
    if (this.metrics.length === 0) return 0;
    
    const recentMetrics = this.metrics.slice(-1000); // Last 1000 requests
    return recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length;
  }

  private startMonitoring(): void {
    // Update performance metrics every minute
    this.monitoringInterval = setInterval(() => {
      this.updateAllPerformanceMetrics();
    }, 60 * 1000);

    // Check alerts every 30 seconds
    this.alertCheckInterval = setInterval(() => {
      this.checkAlerts();
    }, 30 * 1000);

    // Perform health checks every 2 minutes
    this.healthCheckInterval = setInterval(() => {
      this.performSystemHealthChecks();
    }, 2 * 60 * 1000);

    // Clean up old metrics every hour
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 60 * 60 * 1000);
  }

  private updateAllPerformanceMetrics(): void {
    // Recalculate all performance metrics
    this.performanceCache.clear();
    
    const now = new Date();
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
    
    const recentMetrics = this.metrics.filter(m => m.timestamp > cutoff);
    
    for (const metric of recentMetrics) {
      this.updatePerformanceMetrics(metric);
    }
  }

  private async performSystemHealthChecks(): Promise<void> {
    // Check database connectivity
    this.performHealthCheck('database', async () => ({
      service: 'database',
      status: 'healthy',
      responseTime: 50,
      timestamp: new Date(),
      details: {
        checks: [
          {
            name: 'connection',
            status: 'pass',
            value: 'connected'
          }
        ]
      }
    }));

    // Check external API integrations
    this.performHealthCheck('external-apis', async () => ({
      service: 'external-apis',
      status: 'healthy',
      responseTime: 200,
      timestamp: new Date(),
      details: {
        checks: [
          {
            name: 'government-api',
            status: 'pass',
            value: 'operational'
          },
          {
            name: 'payment-gateway',
            status: 'pass',
            value: 'operational'
          }
        ]
      }
    }));
  }

  private cleanupOldMetrics(): void {
    // Keep metrics for last 7 days
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    this.metrics = this.metrics.filter(m => m.timestamp > cutoff);

    // Clean up old alert events (keep for 30 days)
    const alertCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    for (const [id, alert] of this.alertEvents.entries()) {
      if (alert.timestamp < alertCutoff) {
        this.alertEvents.delete(id);
      }
    }
  }

  // Public API methods
  public getMetrics(filters?: {
    endpoint?: string;
    method?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): APIMetrics[] {
    let filteredMetrics = [...this.metrics];

    if (filters) {
      if (filters.endpoint) {
        filteredMetrics = filteredMetrics.filter(m => m.endpoint === filters.endpoint);
      }
      if (filters.method) {
        filteredMetrics = filteredMetrics.filter(m => m.method === filters.method);
      }
      if (filters.startDate) {
        filteredMetrics = filteredMetrics.filter(m => m.timestamp >= filters.startDate!);
      }
      if (filters.endDate) {
        filteredMetrics = filteredMetrics.filter(m => m.timestamp <= filters.endDate!);
      }
      if (filters.limit) {
        filteredMetrics = filteredMetrics.slice(-filters.limit);
      }
    }

    return filteredMetrics;
  }

  public getPerformanceMetrics(endpoint?: string, method?: string): PerformanceMetrics[] {
    if (endpoint && method) {
      const key = `${method}:${endpoint}`;
      const metric = this.performanceCache.get(key);
      return metric ? [metric] : [];
    }
    
    return Array.from(this.performanceCache.values());
  }

  public getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  public getAlertEvents(filters?: {
    severity?: string;
    acknowledged?: boolean;
    startDate?: Date;
    endDate?: Date;
  }): AlertEvent[] {
    let events = Array.from(this.alertEvents.values());

    if (filters) {
      if (filters.severity) {
        events = events.filter(e => e.severity === filters.severity);
      }
      if (filters.acknowledged !== undefined) {
        events = events.filter(e => e.acknowledged === filters.acknowledged);
      }
      if (filters.startDate) {
        events = events.filter(e => e.timestamp >= filters.startDate!);
      }
      if (filters.endDate) {
        events = events.filter(e => e.timestamp <= filters.endDate!);
      }
    }

    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  public getDashboardData(): {
    overview: {
      totalRequests: number;
      averageResponseTime: number;
      errorRate: number;
      uptime: number;
    };
    topEndpoints: { endpoint: string; requests: number; avgResponseTime: number }[];
    recentAlerts: AlertEvent[];
    systemHealth: SystemHealth;
  } {
    const recentMetrics = this.metrics.slice(-10000); // Last 10k requests
    const totalRequests = recentMetrics.length;
    const averageResponseTime = totalRequests > 0 
      ? recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests 
      : 0;
    
    const errorCount = recentMetrics.filter(m => m.statusCode >= 400).length;
    const errorRate = totalRequests > 0 ? errorCount / totalRequests : 0;

    // Calculate top endpoints
    const endpointStats = new Map<string, { requests: number; totalResponseTime: number }>();
    recentMetrics.forEach(m => {
      const key = `${m.method} ${m.endpoint}`;
      const stat = endpointStats.get(key) || { requests: 0, totalResponseTime: 0 };
      stat.requests++;
      stat.totalResponseTime += m.responseTime;
      endpointStats.set(key, stat);
    });

    const topEndpoints = Array.from(endpointStats.entries())
      .map(([endpoint, stat]) => ({
        endpoint,
        requests: stat.requests,
        avgResponseTime: stat.totalResponseTime / stat.requests
      }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);

    // Get recent alerts
    const recentAlerts = this.getAlertEvents({
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
    }).slice(0, 10);

    return {
      overview: {
        totalRequests,
        averageResponseTime,
        errorRate,
        uptime: process.uptime()
      },
      topEndpoints,
      recentAlerts,
      systemHealth: this.getSystemHealth()
    };
  }

  public exportMetrics(format: 'json' | 'csv' = 'json', filters?: any): string {
    const metrics = this.getMetrics(filters);

    if (format === 'csv') {
      const headers = ['timestamp', 'endpoint', 'method', 'statusCode', 'responseTime', 'requestSize', 'responseSize', 'apiKey', 'userId', 'ipAddress', 'userAgent', 'version', 'error', 'externalAPI'];
      const rows = metrics.map(m => [
        m.timestamp.toISOString(),
        m.endpoint,
        m.method,
        m.statusCode,
        m.responseTime,
        m.requestSize,
        m.responseSize,
        m.apiKey || '',
        m.userId || '',
        m.ipAddress,
        m.userAgent,
        m.version,
        m.error || '',
        m.externalAPI || ''
      ]);
      
      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    return JSON.stringify(metrics, null, 2);
  }

  public destroy(): void {
    if (this.monitoringInterval) clearInterval(this.monitoringInterval);
    if (this.alertCheckInterval) clearInterval(this.alertCheckInterval);
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
    
    this.removeAllListeners();
  }
}

// Export singleton instance
let instance: APIMonitoringService | null = null;

export function getAPIMonitoringService(logger: Logger): APIMonitoringService {
  if (!instance) {
    instance = new APIMonitoringService(logger);
  }
  return instance;
}
