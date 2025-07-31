import { SecurityMetrics, SecurityConfiguration, ThreatDetectionEvent } from '../types';
import { EventEmitter } from 'events';

interface SecurityAlert {
  id: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'authentication' | 'authorization' | 'data_access' | 'system_health' | 'compliance' | 'threat';
  title: string;
  description: string;
  source: string;
  affected_systems: string[];
  indicators: Record<string, any>;
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
  assigned_to?: string;
  actions_taken: string[];
  resolution_notes?: string;
}

interface MonitoringRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: {
    field: string;
    operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'regex';
    value: any;
  }[];
  time_window: number; // minutes
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  actions: string[];
  notification_channels: string[];
  created_at: Date;
  updated_at: Date;
}

export class SecurityMonitoringService extends EventEmitter {
  private alerts: SecurityAlert[] = [];
  private monitoringRules: MonitoringRule[] = [];
  private metrics: SecurityMetrics[] = [];
  private eventBuffer: Array<{ timestamp: Date; event: any }> = [];
  private isMonitoring = false;
  private alertChannels: Map<string, (alert: SecurityAlert) => void> = new Map();

  constructor() {
    super();
    this.initializeMonitoringRules();
    this.initializeAlertChannels();
  }

  async initialize(): Promise<void> {
    if (this.isMonitoring) return;
    
    await this.startRealTimeMonitoring();
    await this.startMetricsCollection();
    this.isMonitoring = true;
    
    this.emit('monitoring_started', { timestamp: new Date() });
  }

  async createAlert(
    type: SecurityAlert['type'],
    severity: SecurityAlert['severity'],
    title: string,
    description: string,
    source: string,
    indicators: Record<string, any> = {}
  ): Promise<string> {
    const alert: SecurityAlert = {
      id: `alert_${Date.now()}`,
      timestamp: new Date(),
      severity,
      type,
      title,
      description,
      source,
      affected_systems: this.extractAffectedSystems(indicators),
      indicators,
      status: 'open',
      actions_taken: []
    };

    this.alerts.push(alert);
    await this.processAlert(alert);
    
    this.emit('alert_created', alert);
    return alert.id;
  }

  private async processAlert(alert: SecurityAlert): Promise<void> {
    // Auto-assign based on severity and type
    if (alert.severity === 'critical') {
      alert.assigned_to = 'security_team_lead';
    } else if (alert.severity === 'high') {
      alert.assigned_to = 'security_analyst';
    }

    // Trigger automated responses
    await this.executeAutomatedResponse(alert);
    
    // Send notifications
    await this.sendAlertNotifications(alert);
    
    // Log to SIEM
    await this.logToSIEM(alert);
  }

  private async executeAutomatedResponse(alert: SecurityAlert): Promise<void> {
    const responses = [];

    switch (alert.type) {
      case 'authentication':
        if (alert.severity === 'high' || alert.severity === 'critical') {
          responses.push('block_ip_address');
          responses.push('require_mfa_reset');
        }
        break;
      
      case 'threat':
        if (alert.severity === 'critical') {
          responses.push('isolate_affected_systems');
          responses.push('escalate_to_incident_response');
        }
        break;
      
      case 'data_access':
        if (alert.severity === 'high' || alert.severity === 'critical') {
          responses.push('audit_data_access');
          responses.push('notify_compliance_team');
        }
        break;
    }

    alert.actions_taken.push(...responses);
    
    for (const action of responses) {
      try {
        await this.executeSecurityAction(action, alert);
      } catch (error) {
        this.emit('response_error', { action, alert: alert.id, error });
      }
    }
  }

  private async executeSecurityAction(action: string, alert: SecurityAlert): Promise<void> {
    switch (action) {
      case 'block_ip_address':
        await this.blockIPAddress(alert.indicators.ip_address);
        break;
      case 'require_mfa_reset':
        await this.requireMFAReset(alert.indicators.user_id);
        break;
      case 'isolate_affected_systems':
        await this.isolateAffectedSystems(alert.affected_systems);
        break;
      case 'escalate_to_incident_response':
        await this.escalateToIncidentResponse(alert);
        break;
      case 'audit_data_access':
        await this.auditDataAccess(alert.indicators);
        break;
      case 'notify_compliance_team':
        await this.notifyComplianceTeam(alert);
        break;
    }
  }

  async evaluateMonitoringRules(event: any): Promise<void> {
    for (const rule of this.monitoringRules.filter(r => r.enabled)) {
      try {
        const matches = await this.evaluateRule(rule, event);
        if (matches) {
          await this.triggerRuleAction(rule, event);
        }
      } catch (error) {
        this.emit('rule_evaluation_error', { rule: rule.id, error });
      }
    }
  }

  private async evaluateRule(rule: MonitoringRule, event: any): Promise<boolean> {
    return rule.conditions.every(condition => {
      const eventValue = this.getEventValue(event, condition.field);
      
      switch (condition.operator) {
        case 'equals':
          return eventValue === condition.value;
        case 'contains':
          return String(eventValue).includes(condition.value);
        case 'greater_than':
          return Number(eventValue) > Number(condition.value);
        case 'less_than':
          return Number(eventValue) < Number(condition.value);
        case 'in':
          return Array.isArray(condition.value) && condition.value.includes(eventValue);
        case 'regex':
          return new RegExp(condition.value).test(String(eventValue));
        default:
          return false;
      }
    });
  }

  private async triggerRuleAction(rule: MonitoringRule, event: any): Promise<void> {
    const recentEvents = this.getRecentEvents(rule.time_window);
    const matchingEvents = recentEvents.filter(e => this.evaluateRule(rule, e.event));

    if (matchingEvents.length >= rule.threshold) {
      await this.createAlert(
        'system_health',
        rule.severity,
        `Monitoring Rule Triggered: ${rule.name}`,
        `Rule "${rule.name}" triggered with ${matchingEvents.length} matching events`,
        'monitoring_service',
        { rule_id: rule.id, event_count: matchingEvents.length, events: matchingEvents.slice(-10) }
      );
    }
  }

  async getSecurityMetrics(): Promise<SecurityMetrics> {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentAlerts = this.alerts.filter(a => a.timestamp >= dayAgo);
    const recentEvents = this.eventBuffer.filter(e => e.timestamp >= dayAgo);

    const authEvents = recentEvents.filter(e => e.event.type === 'authentication');
    const failedLogins = authEvents.filter(e => !e.event.success).length;
    const successfulLogins = authEvents.filter(e => e.event.success).length;

    const criticalAlerts = recentAlerts.filter(a => a.severity === 'critical').length;
    const incidentCount = recentAlerts.filter(a => a.type === 'threat').length;

    // Calculate response times
    const resolvedAlerts = this.alerts.filter(a => a.status === 'resolved');
    const detectTimes = resolvedAlerts.map(a => this.calculateDetectionTime(a));
    const responseTimes = resolvedAlerts.map(a => this.calculateResponseTime(a));
    const resolutionTimes = resolvedAlerts.map(a => this.calculateResolutionTime(a));

    const metrics: SecurityMetrics = {
      timestamp: now,
      vulnerabilities_detected: this.getVulnerabilityCount(),
      vulnerabilities_resolved: this.getResolvedVulnerabilityCount(),
      security_incidents: incidentCount,
      failed_login_attempts: failedLogins,
      successful_authentications: successfulLogins,
      data_breaches: this.getDataBreachCount(),
      compliance_violations: this.getComplianceViolationCount(),
      security_training_completion: await this.getTrainingCompletionRate(),
      mean_time_to_detect: this.calculateMean(detectTimes),
      mean_time_to_respond: this.calculateMean(responseTimes),
      mean_time_to_resolve: this.calculateMean(resolutionTimes),
      security_score: this.calculateSecurityScore()
    };

    this.metrics.push(metrics);
    return metrics;
  }

  async getDashboardData(): Promise<{
    active_alerts: SecurityAlert[];
    recent_metrics: SecurityMetrics;
    system_health: any;
    threat_overview: any;
  }> {
    const activeAlerts = this.alerts
      .filter(a => a.status === 'open' || a.status === 'investigating')
      .sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      })
      .slice(0, 10);

    const recentMetrics = await this.getSecurityMetrics();
    
    const systemHealth = {
      monitoring_status: this.isMonitoring ? 'active' : 'inactive',
      active_rules: this.monitoringRules.filter(r => r.enabled).length,
      total_rules: this.monitoringRules.length,
      alert_channels: this.alertChannels.size,
      events_per_minute: this.calculateEventsPerMinute()
    };

    const threatOverview = {
      high_severity_alerts: activeAlerts.filter(a => a.severity === 'high' || a.severity === 'critical').length,
      authentication_threats: activeAlerts.filter(a => a.type === 'authentication').length,
      data_access_threats: activeAlerts.filter(a => a.type === 'data_access').length,
      system_threats: activeAlerts.filter(a => a.type === 'threat').length
    };

    return {
      active_alerts: activeAlerts,
      recent_metrics: recentMetrics,
      system_health: systemHealth,
      threat_overview: threatOverview
    };
  }

  async addMonitoringRule(rule: Omit<MonitoringRule, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    const newRule: MonitoringRule = {
      ...rule,
      id: `rule_${Date.now()}`,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    this.monitoringRules.push(newRule);
    this.emit('monitoring_rule_added', newRule);
    
    return newRule.id;
  }

  async updateMonitoringRule(ruleId: string, updates: Partial<MonitoringRule>): Promise<boolean> {
    const rule = this.monitoringRules.find(r => r.id === ruleId);
    if (!rule) return false;
    
    Object.assign(rule, updates, { updated_at: new Date() });
    this.emit('monitoring_rule_updated', rule);
    
    return true;
  }

  async deleteMonitoringRule(ruleId: string): Promise<boolean> {
    const index = this.monitoringRules.findIndex(r => r.id === ruleId);
    if (index === -1) return false;
    
    this.monitoringRules.splice(index, 1);
    this.emit('monitoring_rule_deleted', ruleId);
    
    return true;
  }

  async updateAlertStatus(alertId: string, status: SecurityAlert['status'], notes?: string): Promise<boolean> {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) return false;
    
    alert.status = status;
    if (notes) alert.resolution_notes = notes;
    
    this.emit('alert_updated', alert);
    return true;
  }

  async isHealthy(): Promise<boolean> {
    return this.isMonitoring &&
           this.monitoringRules.filter(r => r.enabled).length > 0 &&
           this.alertChannels.size > 0;
  }

  // Helper methods
  private extractAffectedSystems(indicators: Record<string, any>): string[] {
    const systems = [];
    if (indicators.application) systems.push(indicators.application);
    if (indicators.database) systems.push(indicators.database);
    if (indicators.server) systems.push(indicators.server);
    return systems;
  }

  private getEventValue(event: any, field: string): any {
    return field.split('.').reduce((obj, key) => obj?.[key], event);
  }

  private getRecentEvents(windowMinutes: number): Array<{ timestamp: Date; event: any }> {
    const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);
    return this.eventBuffer.filter(e => e.timestamp >= cutoff);
  }

  private calculateDetectionTime(alert: SecurityAlert): number {
    // Mock calculation - would use actual incident timestamps
    return Math.random() * 30; // 0-30 minutes
  }

  private calculateResponseTime(alert: SecurityAlert): number {
    // Mock calculation
    return Math.random() * 60; // 0-60 minutes
  }

  private calculateResolutionTime(alert: SecurityAlert): number {
    // Mock calculation
    return Math.random() * 240; // 0-240 minutes
  }

  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private getVulnerabilityCount(): number {
    return Math.floor(Math.random() * 50);
  }

  private getResolvedVulnerabilityCount(): number {
    return Math.floor(Math.random() * 40);
  }

  private getDataBreachCount(): number {
    return Math.floor(Math.random() * 3);
  }

  private getComplianceViolationCount(): number {
    return Math.floor(Math.random() * 10);
  }

  private async getTrainingCompletionRate(): Promise<number> {
    return Math.random() * 100;
  }

  private calculateSecurityScore(): number {
    // Calculate overall security score based on various factors
    const baseScore = 100;
    const criticalAlerts = this.alerts.filter(a => a.severity === 'critical' && a.status === 'open').length;
    const highAlerts = this.alerts.filter(a => a.severity === 'high' && a.status === 'open').length;
    
    return Math.max(0, baseScore - (criticalAlerts * 10) - (highAlerts * 5));
  }

  private calculateEventsPerMinute(): number {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    return this.eventBuffer.filter(e => e.timestamp >= oneMinuteAgo).length;
  }

  // Mock implementations for security actions
  private async blockIPAddress(ipAddress: string): Promise<void> {
    this.emit('ip_blocked', { ip: ipAddress, timestamp: new Date() });
  }

  private async requireMFAReset(userId: string): Promise<void> {
    this.emit('mfa_reset_required', { userId, timestamp: new Date() });
  }

  private async isolateAffectedSystems(systems: string[]): Promise<void> {
    this.emit('systems_isolated', { systems, timestamp: new Date() });
  }

  private async escalateToIncidentResponse(alert: SecurityAlert): Promise<void> {
    this.emit('incident_escalated', { alert, timestamp: new Date() });
  }

  private async auditDataAccess(indicators: Record<string, any>): Promise<void> {
    this.emit('data_access_audit_triggered', { indicators, timestamp: new Date() });
  }

  private async notifyComplianceTeam(alert: SecurityAlert): Promise<void> {
    this.emit('compliance_notification_sent', { alert, timestamp: new Date() });
  }

  private async sendAlertNotifications(alert: SecurityAlert): Promise<void> {
    for (const [channel, handler] of this.alertChannels) {
      try {
        await handler(alert);
      } catch (error) {
        this.emit('notification_error', { channel, alert: alert.id, error });
      }
    }
  }

  private async logToSIEM(alert: SecurityAlert): Promise<void> {
    // Mock SIEM logging
    this.emit('siem_logged', { alert, timestamp: new Date() });
  }

  private async startRealTimeMonitoring(): Promise<void> {
    // Mock real-time monitoring setup
    setInterval(() => {
      const mockEvent = {
        timestamp: new Date(),
        type: Math.random() > 0.7 ? 'authentication' : 'data_access',
        success: Math.random() > 0.1,
        user_id: `user_${Math.floor(Math.random() * 1000)}`,
        ip_address: `192.168.1.${Math.floor(Math.random() * 255)}`,
        application: 'claims_system'
      };
      
      this.eventBuffer.push({ timestamp: new Date(), event: mockEvent });
      this.evaluateMonitoringRules(mockEvent);
      
      // Keep buffer size manageable
      if (this.eventBuffer.length > 10000) {
        this.eventBuffer = this.eventBuffer.slice(-5000);
      }
    }, 5000); // Every 5 seconds
  }

  private async startMetricsCollection(): Promise<void> {
    // Collect metrics every 5 minutes
    setInterval(async () => {
      try {
        await this.getSecurityMetrics();
      } catch (error) {
        this.emit('metrics_collection_error', error);
      }
    }, 5 * 60 * 1000);
  }

  private initializeMonitoringRules(): void {
    this.monitoringRules = [
      {
        id: 'failed_login_threshold',
        name: 'Failed Login Threshold',
        description: 'Alert when failed login attempts exceed threshold',
        enabled: true,
        conditions: [
          { field: 'type', operator: 'equals', value: 'authentication' },
          { field: 'success', operator: 'equals', value: false }
        ],
        time_window: 15,
        threshold: 5,
        severity: 'high',
        actions: ['block_ip_address', 'notify_security_team'],
        notification_channels: ['email', 'slack'],
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 'admin_access_monitor',
        name: 'Administrative Access Monitor',
        description: 'Monitor all administrative access attempts',
        enabled: true,
        conditions: [
          { field: 'user_role', operator: 'in', value: ['admin', 'super_admin'] }
        ],
        time_window: 60,
        threshold: 1,
        severity: 'medium',
        actions: ['audit_access', 'log_activity'],
        notification_channels: ['email'],
        created_at: new Date(),
        updated_at: new Date()
      }
    ];
  }

  private initializeAlertChannels(): void {
    this.alertChannels.set('email', async (alert: SecurityAlert) => {
      // Mock email notification
      this.emit('email_sent', { to: 'security@company.com', alert });
    });

    this.alertChannels.set('slack', async (alert: SecurityAlert) => {
      // Mock Slack notification
      this.emit('slack_message_sent', { channel: '#security-alerts', alert });
    });

    this.alertChannels.set('sms', async (alert: SecurityAlert) => {
      // Mock SMS notification for critical alerts
      if (alert.severity === 'critical') {
        this.emit('sms_sent', { to: '+1234567890', alert });
      }
    });
  }
}
