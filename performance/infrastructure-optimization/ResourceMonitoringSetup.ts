/**
 * Resource Monitoring Setup
 * Sets up comprehensive monitoring for infrastructure resources with alerts and dashboards
 */

import { 
  MonitoringSetupConfig,
  AlertingRule,
  Dashboard,
  Widget,
  OptimizationRecommendation 
} from './types';

export class ResourceMonitoringSetup {
  private config: MonitoringSetupConfig;
  private alertingRules: Map<string, AlertingRule> = new Map();
  private dashboards: Map<string, Dashboard> = new Map();
  private metricsCollectors: Map<string, any> = new Map();
  private alertHistory: any[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(config: MonitoringSetupConfig) {
    this.config = config;
  }

  public async initialize(): Promise<void> {
    console.log('📊 Initializing Resource Monitoring Setup...');
    await this.setupMetricsCollection();
    await this.configureAlerting();
    await this.createDashboards();
    await this.startMonitoring();
  }

  private async setupMetricsCollection(): Promise<void> {
    console.log('📈 Setting up metrics collection...');
    
    // Setup collectors for different metric types
    for (const metric of this.config.metrics) {
      const collector = await this.createMetricsCollector(metric);
      this.metricsCollectors.set(metric, collector);
    }
  }

  private async createMetricsCollector(metricType: string): Promise<any> {
    const collector = {
      metricType,
      lastCollection: Date.now(),
      collectionInterval: this.getCollectionInterval(metricType),
      dataPoints: [],
      status: 'active'
    };

    console.log(`📊 Created metrics collector for: ${metricType}`);
    return collector;
  }

  private getCollectionInterval(metricType: string): number {
    // Different metrics have different collection frequencies
    const intervals = {
      'cpu-usage': 30000,        // 30 seconds
      'memory-usage': 30000,     // 30 seconds
      'disk-usage': 60000,       // 1 minute
      'network-io': 30000,       // 30 seconds
      'response-time': 15000,    // 15 seconds
      'error-rate': 30000,       // 30 seconds
      'throughput': 30000,       // 30 seconds
      'queue-length': 30000,     // 30 seconds
      'active-connections': 30000, // 30 seconds
      'cache-hit-rate': 60000,   // 1 minute
      'database-connections': 60000, // 1 minute
      'ssl-certificate-expiry': 86400000, // 24 hours
      'backup-status': 3600000,  // 1 hour
      'security-events': 300000  // 5 minutes
    };

    return intervals[metricType as keyof typeof intervals] || 60000; // Default 1 minute
  }

  private async configureAlerting(): Promise<void> {
    console.log('🚨 Configuring alerting rules...');
    
    // Setup alerting rules from configuration
    for (const rule of this.config.alertingRules) {
      this.alertingRules.set(rule.name, rule);
      await this.setupAlertingRule(rule);
    }

    // Setup default alerting rules for critical metrics
    await this.setupDefaultAlertingRules();
  }

  private async setupAlertingRule(rule: AlertingRule): Promise<void> {
    console.log(`⚠️ Setting up alerting rule: ${rule.name}`);
    
    // Configure the alerting rule with monitoring system
    // Implementation would integrate with monitoring platforms like Prometheus, CloudWatch, etc.
  }

  private async setupDefaultAlertingRules(): Promise<void> {
    const defaultRules: AlertingRule[] = [
      {
        name: 'high-cpu-usage',
        condition: 'cpu_usage > 85',
        threshold: 85,
        severity: 'warning',
        notifications: ['email', 'slack'],
        description: 'CPU usage is consistently high'
      },
      {
        name: 'critical-cpu-usage',
        condition: 'cpu_usage > 95',
        threshold: 95,
        severity: 'critical',
        notifications: ['email', 'slack', 'pagerduty'],
        description: 'CPU usage is critically high'
      },
      {
        name: 'high-memory-usage',
        condition: 'memory_usage > 90',
        threshold: 90,
        severity: 'warning',
        notifications: ['email', 'slack'],
        description: 'Memory usage is high'
      },
      {
        name: 'disk-space-low',
        condition: 'disk_free_space < 10',
        threshold: 10,
        severity: 'critical',
        notifications: ['email', 'slack', 'pagerduty'],
        description: 'Disk space is critically low'
      },
      {
        name: 'high-error-rate',
        condition: 'error_rate > 5',
        threshold: 5,
        severity: 'critical',
        notifications: ['email', 'slack', 'pagerduty'],
        description: 'Application error rate is high'
      },
      {
        name: 'slow-response-time',
        condition: 'response_time > 2000',
        threshold: 2000,
        severity: 'warning',
        notifications: ['email', 'slack'],
        description: 'Application response time is slow'
      }
    ];

    for (const rule of defaultRules) {
      if (!this.alertingRules.has(rule.name)) {
        this.alertingRules.set(rule.name, rule);
        await this.setupAlertingRule(rule);
      }
    }
  }

  private async createDashboards(): Promise<void> {
    console.log('📊 Creating monitoring dashboards...');
    
    // Create dashboards from configuration
    for (const dashboard of this.config.dashboards) {
      this.dashboards.set(dashboard.name, dashboard);
      await this.createDashboard(dashboard);
    }

    // Create default dashboards
    await this.createDefaultDashboards();
  }

  private async createDashboard(dashboard: Dashboard): Promise<void> {
    console.log(`📈 Creating dashboard: ${dashboard.name}`);
    
    // Implementation would create dashboard in monitoring platform
    for (const widget of dashboard.widgets) {
      await this.createWidget(dashboard.name, widget);
    }
  }

  private async createWidget(dashboardName: string, widget: Widget): Promise<void> {
    console.log(`📊 Creating widget: ${widget.title} for dashboard: ${dashboardName}`);
    
    // Implementation would create specific widget types
    switch (widget.type) {
      case 'chart':
        await this.createChartWidget(widget);
        break;
      case 'table':
        await this.createTableWidget(widget);
        break;
      case 'gauge':
        await this.createGaugeWidget(widget);
        break;
      case 'stat':
        await this.createStatWidget(widget);
        break;
    }
  }

  private async createDefaultDashboards(): Promise<void> {
    // Infrastructure Overview Dashboard
    const infrastructureDashboard: Dashboard = {
      name: 'Infrastructure Overview',
      refreshInterval: 30,
      timeRange: '1h',
      widgets: [
        {
          type: 'chart',
          title: 'CPU Usage',
          query: 'avg(cpu_usage) by (instance)',
          visualization: { type: 'line', unit: '%' }
        },
        {
          type: 'chart',
          title: 'Memory Usage',
          query: 'avg(memory_usage) by (instance)',
          visualization: { type: 'line', unit: '%' }
        },
        {
          type: 'chart',
          title: 'Disk Usage',
          query: 'avg(disk_usage) by (instance)',
          visualization: { type: 'line', unit: '%' }
        },
        {
          type: 'gauge',
          title: 'Network Throughput',
          query: 'sum(network_throughput)',
          visualization: { type: 'gauge', unit: 'Mbps', max: 1000 }
        }
      ]
    };

    // Application Performance Dashboard
    const applicationDashboard: Dashboard = {
      name: 'Application Performance',
      refreshInterval: 15,
      timeRange: '30m',
      widgets: [
        {
          type: 'chart',
          title: 'Response Time',
          query: 'avg(response_time) by (endpoint)',
          visualization: { type: 'line', unit: 'ms' }
        },
        {
          type: 'chart',
          title: 'Error Rate',
          query: 'rate(http_requests_total{status=~"5.."}[5m])',
          visualization: { type: 'line', unit: '%' }
        },
        {
          type: 'stat',
          title: 'Total Requests',
          query: 'sum(rate(http_requests_total[5m]))',
          visualization: { type: 'stat', unit: 'req/s' }
        },
        {
          type: 'table',
          title: 'Top Endpoints by Traffic',
          query: 'topk(10, sum(rate(http_requests_total[5m])) by (endpoint))',
          visualization: { type: 'table' }
        }
      ]
    };

    // Database Performance Dashboard
    const databaseDashboard: Dashboard = {
      name: 'Database Performance',
      refreshInterval: 60,
      timeRange: '2h',
      widgets: [
        {
          type: 'chart',
          title: 'Database Connections',
          query: 'sum(database_connections_active)',
          visualization: { type: 'line', unit: 'connections' }
        },
        {
          type: 'chart',
          title: 'Query Response Time',
          query: 'avg(database_query_duration)',
          visualization: { type: 'line', unit: 'ms' }
        },
        {
          type: 'gauge',
          title: 'Cache Hit Rate',
          query: 'avg(cache_hit_rate)',
          visualization: { type: 'gauge', unit: '%', max: 100 }
        }
      ]
    };

    const defaultDashboards = [infrastructureDashboard, applicationDashboard, databaseDashboard];
    
    for (const dashboard of defaultDashboards) {
      if (!this.dashboards.has(dashboard.name)) {
        this.dashboards.set(dashboard.name, dashboard);
        await this.createDashboard(dashboard);
      }
    }
  }

  private async createChartWidget(widget: Widget): Promise<void> {
    // Implementation would create chart widget
    console.log(`📈 Created chart widget: ${widget.title}`);
  }

  private async createTableWidget(widget: Widget): Promise<void> {
    // Implementation would create table widget
    console.log(`📋 Created table widget: ${widget.title}`);
  }

  private async createGaugeWidget(widget: Widget): Promise<void> {
    // Implementation would create gauge widget
    console.log(`🎛️ Created gauge widget: ${widget.title}`);
  }

  private async createStatWidget(widget: Widget): Promise<void> {
    // Implementation would create stat widget
    console.log(`📊 Created stat widget: ${widget.title}`);
  }

  private async startMonitoring(): Promise<void> {
    console.log('🔍 Starting continuous monitoring...');
    
    this.monitoringInterval = setInterval(async () => {
      await this.collectAllMetrics();
      await this.evaluateAlerts();
      await this.performHealthChecks();
    }, 30000); // Monitor every 30 seconds
  }

  private async collectAllMetrics(): Promise<void> {
    // Collect metrics from all configured collectors
    for (const [metricType, collector] of this.metricsCollectors) {
      if (Date.now() - collector.lastCollection >= collector.collectionInterval) {
        await this.collectMetric(metricType, collector);
      }
    }
  }

  private async collectMetric(metricType: string, collector: any): Promise<void> {
    try {
      const value = await this.getMetricValue(metricType);
      
      collector.dataPoints.push({
        timestamp: Date.now(),
        value,
        metricType
      });
      
      collector.lastCollection = Date.now();
      
      // Keep only recent data points
      if (collector.dataPoints.length > 1000) {
        collector.dataPoints = collector.dataPoints.slice(-1000);
      }
      
    } catch (error) {
      console.error(`Failed to collect metric ${metricType}:`, error);
      collector.status = 'error';
    }
  }

  private async getMetricValue(metricType: string): Promise<number> {
    // Simulate metric collection based on type
    switch (metricType) {
      case 'cpu-usage':
        return Math.random() * 100;
      case 'memory-usage':
        return Math.random() * 100;
      case 'disk-usage':
        return Math.random() * 100;
      case 'network-io':
        return Math.random() * 1000;
      case 'response-time':
        return Math.random() * 2000 + 100;
      case 'error-rate':
        return Math.random() * 10;
      case 'throughput':
        return Math.random() * 1000 + 100;
      case 'queue-length':
        return Math.floor(Math.random() * 100);
      case 'active-connections':
        return Math.floor(Math.random() * 1000);
      case 'cache-hit-rate':
        return Math.random() * 100;
      case 'database-connections':
        return Math.floor(Math.random() * 200);
      default:
        return Math.random() * 100;
    }
  }

  private async evaluateAlerts(): Promise<void> {
    // Evaluate all alerting rules against current metrics
    for (const [ruleName, rule] of this.alertingRules) {
      await this.evaluateAlertingRule(ruleName, rule);
    }
  }

  private async evaluateAlertingRule(ruleName: string, rule: AlertingRule): Promise<void> {
    try {
      const shouldAlert = await this.checkAlertCondition(rule);
      
      if (shouldAlert) {
        await this.triggerAlert(ruleName, rule);
      }
      
    } catch (error) {
      console.error(`Failed to evaluate alerting rule ${ruleName}:`, error);
    }
  }

  private async checkAlertCondition(rule: AlertingRule): Promise<boolean> {
    // Parse and evaluate the alerting condition
    // This is a simplified implementation
    
    const metricType = this.extractMetricFromCondition(rule.condition);
    const collector = this.metricsCollectors.get(metricType);
    
    if (!collector || collector.dataPoints.length === 0) {
      return false;
    }
    
    const latestValue = collector.dataPoints[collector.dataPoints.length - 1].value;
    
    // Simple threshold comparison
    if (rule.condition.includes('>')) {
      return latestValue > rule.threshold;
    } else if (rule.condition.includes('<')) {
      return latestValue < rule.threshold;
    }
    
    return false;
  }

  private extractMetricFromCondition(condition: string): string {
    // Extract metric name from condition string
    const metricMatch = condition.match(/([a-zA-Z_-]+)/);
    return metricMatch ? metricMatch[1].replace('_', '-') : 'cpu-usage';
  }

  private async triggerAlert(ruleName: string, rule: AlertingRule): Promise<void> {
    // Check if this alert was recently triggered to avoid spam
    const recentAlert = this.alertHistory.find(alert => 
      alert.ruleName === ruleName && 
      Date.now() - alert.timestamp < 300000 // 5 minutes
    );
    
    if (recentAlert) {
      return; // Don't trigger duplicate alerts within 5 minutes
    }
    
    console.warn(`🚨 ALERT TRIGGERED [${rule.severity.toUpperCase()}]: ${rule.description}`);
    
    const alertRecord = {
      ruleName,
      rule,
      timestamp: Date.now(),
      severity: rule.severity,
      description: rule.description
    };
    
    this.alertHistory.push(alertRecord);
    
    // Send notifications
    for (const channel of rule.notifications) {
      await this.sendNotification(channel, alertRecord);
    }
    
    // Keep alert history manageable
    if (this.alertHistory.length > 1000) {
      this.alertHistory = this.alertHistory.slice(-1000);
    }
  }

  private async sendNotification(channel: string, alert: any): Promise<void> {
    console.log(`📢 Sending ${channel} notification for alert: ${alert.ruleName}`);
    
    switch (channel) {
      case 'email':
        await this.sendEmailNotification(alert);
        break;
      case 'slack':
        await this.sendSlackNotification(alert);
        break;
      case 'pagerduty':
        await this.sendPagerDutyNotification(alert);
        break;
      case 'webhook':
        await this.sendWebhookNotification(alert);
        break;
    }
  }

  private async sendEmailNotification(alert: any): Promise<void> {
    // Implementation would send email notification
    console.log(`📧 Email notification sent for: ${alert.ruleName}`);
  }

  private async sendSlackNotification(alert: any): Promise<void> {
    // Implementation would send Slack notification
    console.log(`💬 Slack notification sent for: ${alert.ruleName}`);
  }

  private async sendPagerDutyNotification(alert: any): Promise<void> {
    // Implementation would send PagerDuty notification
    console.log(`📟 PagerDuty notification sent for: ${alert.ruleName}`);
  }

  private async sendWebhookNotification(alert: any): Promise<void> {
    // Implementation would send webhook notification
    console.log(`🔗 Webhook notification sent for: ${alert.ruleName}`);
  }

  private async performHealthChecks(): Promise<void> {
    // Perform health checks on monitoring infrastructure itself
    await this.checkCollectorHealth();
    await this.checkAlertingHealth();
    await this.checkDashboardHealth();
  }

  private async checkCollectorHealth(): Promise<void> {
    for (const [metricType, collector] of this.metricsCollectors) {
      const timeSinceLastCollection = Date.now() - collector.lastCollection;
      
      if (timeSinceLastCollection > collector.collectionInterval * 3) {
        console.warn(`⚠️ Collector for ${metricType} is lagging: ${timeSinceLastCollection}ms since last collection`);
        collector.status = 'lagging';
      } else {
        collector.status = 'active';
      }
    }
  }

  private async checkAlertingHealth(): Promise<void> {
    // Check if alerting system is functioning properly
    const recentAlerts = this.alertHistory.filter(alert => 
      Date.now() - alert.timestamp < 3600000 // Last hour
    );
    
    console.log(`📊 Alerting health: ${recentAlerts.length} alerts in the last hour`);
  }

  private async checkDashboardHealth(): Promise<void> {
    // Check if dashboards are accessible and updating
    console.log(`📈 Dashboard health: ${this.dashboards.size} dashboards configured`);
  }

  public getOptimizationRecommendations(): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];
    
    // Check for monitoring gaps
    const criticalMetrics = ['cpu-usage', 'memory-usage', 'disk-usage', 'response-time', 'error-rate'];
    const missingMetrics = criticalMetrics.filter(metric => !this.metricsCollectors.has(metric));
    
    if (missingMetrics.length > 0) {
      recommendations.push({
        id: 'monitoring-gaps',
        category: 'monitoring',
        priority: 'high',
        title: 'Monitoring Coverage Gaps',
        description: `Missing monitoring for critical metrics: ${missingMetrics.join(', ')}`,
        expectedImpact: 'Improve observability and incident response',
        implementation: [
          'Add missing metrics collectors',
          'Configure appropriate alerting rules',
          'Create dashboard widgets for new metrics',
          'Set up notification channels'
        ],
        estimatedCost: 500,
        estimatedSavings: 2000,
        timeline: '1 week'
      });
    }

    // Check alert frequency
    const recentAlerts = this.alertHistory.filter(alert => 
      Date.now() - alert.timestamp < 24 * 60 * 60 * 1000 // Last 24 hours
    );
    
    if (recentAlerts.length > 50) {
      recommendations.push({
        id: 'alert-optimization',
        category: 'monitoring',
        priority: 'medium',
        title: 'Alert Optimization Required',
        description: 'High alert frequency may indicate threshold tuning needed',
        expectedImpact: 'Reduce alert fatigue and improve signal-to-noise ratio',
        implementation: [
          'Review and adjust alert thresholds',
          'Implement alert correlation',
          'Add alert suppression rules',
          'Create escalation policies'
        ],
        estimatedCost: 1000,
        estimatedSavings: 1500,
        timeline: '1-2 weeks'
      });
    }

    // Check for missing dashboards
    if (this.dashboards.size < 3) {
      recommendations.push({
        id: 'dashboard-enhancement',
        category: 'monitoring',
        priority: 'medium',
        title: 'Enhanced Dashboard Coverage',
        description: 'Additional dashboards needed for comprehensive monitoring',
        expectedImpact: 'Improve visibility into system performance',
        implementation: [
          'Create application-specific dashboards',
          'Add business metrics dashboards',
          'Implement custom KPI tracking',
          'Set up executive summary dashboards'
        ],
        estimatedCost: 800,
        estimatedSavings: 1200,
        timeline: '1 week'
      });
    }

    return recommendations;
  }

  public generateMonitoringReport(): any {
    const activeCollectors = Array.from(this.metricsCollectors.values()).filter(c => c.status === 'active').length;
    const totalCollectors = this.metricsCollectors.size;
    
    const recentAlerts = this.alertHistory.filter(alert => 
      Date.now() - alert.timestamp < 24 * 60 * 60 * 1000
    );
    
    return {
      timestamp: Date.now(),
      metricsCollection: {
        totalMetrics: this.config.metrics.length,
        activeCollectors,
        totalCollectors,
        collectorHealth: (activeCollectors / totalCollectors) * 100,
        collectorStatus: Object.fromEntries(
          Array.from(this.metricsCollectors.entries()).map(([name, collector]) => [
            name, 
            { status: collector.status, dataPoints: collector.dataPoints.length }
          ])
        )
      },
      alerting: {
        totalRules: this.alertingRules.size,
        recentAlerts: recentAlerts.length,
        alertsBySeveity: {
          critical: recentAlerts.filter(a => a.severity === 'critical').length,
          warning: recentAlerts.filter(a => a.severity === 'warning').length,
          info: recentAlerts.filter(a => a.severity === 'info').length
        },
        recentAlertHistory: recentAlerts.slice(-10)
      },
      dashboards: {
        totalDashboards: this.dashboards.size,
        dashboardList: Array.from(this.dashboards.keys()),
        widgetCount: Array.from(this.dashboards.values()).reduce((sum, d) => sum + d.widgets.length, 0)
      },
      configuration: {
        retentionPeriod: this.config.retentionPeriod,
        samplingRate: this.config.samplingRate,
        metricsConfigured: this.config.metrics
      },
      recommendations: this.getOptimizationRecommendations(),
      monitoringHealth: this.getMonitoringHealthStatus()
    };
  }

  private getMonitoringHealthStatus(): string {
    const activeCollectors = Array.from(this.metricsCollectors.values()).filter(c => c.status === 'active').length;
    const totalCollectors = this.metricsCollectors.size;
    const collectorHealth = totalCollectors > 0 ? (activeCollectors / totalCollectors) * 100 : 100;
    
    const recentAlerts = this.alertHistory.filter(alert => 
      Date.now() - alert.timestamp < 60 * 60 * 1000 // Last hour
    );
    
    if (collectorHealth < 80 || recentAlerts.length > 20) {
      return 'Critical';
    } else if (collectorHealth < 95 || recentAlerts.length > 10) {
      return 'Warning';
    } else {
      return 'Healthy';
    }
  }

  public cleanup(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    console.log('📊 Resource Monitoring Setup cleaned up');
  }
}
