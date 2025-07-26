import fetch from 'node-fetch';
import nodemailer from 'nodemailer';

// Alert severity levels
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

// Alert types for Vietnamese healthcare system
export type AlertType = 
  | 'service_down'
  | 'performance_degraded'
  | 'database_error'
  | 'compliance_violation'
  | 'security_incident'
  | 'patient_data_breach'
  | 'system_overload'
  | 'backup_failed'
  | 'ssl_certificate_expiring'
  | 'healthcare_service_unavailable';

// Alert notification interface
export interface AlertNotification {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  timestamp: Date;
  service: string;
  environment: string;
  metrics?: {
    responseTime?: number;
    errorRate?: number;
    uptime?: number;
    [key: string]: any;
  };
  additionalData?: Record<string, any>;
  tags?: string[];
}

// Notification channel configuration
export interface NotificationChannel {
  name: string;
  enabled: boolean;
  config: Record<string, any>;
}

// Alert notification service
export class HealthcareAlertService {
  private channels: Map<string, NotificationChannel> = new Map();
  private emailTransporter?: nodemailer.Transporter;

  constructor() {
    this.initializeChannels();
    this.setupEmailTransporter();
  }

  private initializeChannels() {
    // Slack notification channel
    this.channels.set('slack', {
      name: 'Slack',
      enabled: !!process.env.SLACK_WEBHOOK_URL,
      config: {
        webhookUrl: process.env.SLACK_WEBHOOK_URL,
        channel: process.env.SLACK_CHANNEL || '#healthcare-alerts',
        username: 'HealthcareMonitor',
        iconEmoji: ':hospital:'
      }
    });

    // Microsoft Teams channel
    this.channels.set('teams', {
      name: 'Microsoft Teams',
      enabled: !!process.env.TEAMS_WEBHOOK_URL,
      config: {
        webhookUrl: process.env.TEAMS_WEBHOOK_URL
      }
    });

    // Email channel
    this.channels.set('email', {
      name: 'Email',
      enabled: !!(process.env.EMAIL_SMTP_HOST && process.env.EMAIL_USERNAME),
      config: {
        recipients: [
          'devops@healthcare-claims.vn',
          'oncall@healthcare-claims.vn',
          'security@healthcare-claims.vn'
        ]
      }
    });

    // PagerDuty channel
    this.channels.set('pagerduty', {
      name: 'PagerDuty',
      enabled: !!process.env.PAGERDUTY_INTEGRATION_KEY,
      config: {
        integrationKey: process.env.PAGERDUTY_INTEGRATION_KEY,
        apiUrl: 'https://events.pagerduty.com/v2/enqueue'
      }
    });

    // Custom webhook channel
    this.channels.set('webhook', {
      name: 'Custom Webhook',
      enabled: !!process.env.CUSTOM_WEBHOOK_URL,
      config: {
        url: process.env.CUSTOM_WEBHOOK_URL,
        headers: {
          'Authorization': `Bearer ${process.env.WEBHOOK_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    });
  }

  private setupEmailTransporter() {
    if (process.env.EMAIL_SMTP_HOST && process.env.EMAIL_USERNAME) {
      this.emailTransporter = nodemailer.createTransporter({
        host: process.env.EMAIL_SMTP_HOST,
        port: parseInt(process.env.EMAIL_SMTP_PORT || '587'),
        secure: process.env.EMAIL_USE_TLS === 'true',
        auth: {
          user: process.env.EMAIL_USERNAME,
          pass: process.env.EMAIL_PASSWORD
        }
      });
    }
  }

  // Send alert notification to all enabled channels
  async sendAlert(alert: AlertNotification): Promise<void> {
    const promises: Promise<void>[] = [];

    // Determine which channels to use based on severity
    const channelsToUse = this.getChannelsForSeverity(alert.severity);

    for (const channelName of channelsToUse) {
      const channel = this.channels.get(channelName);
      if (channel?.enabled) {
        switch (channelName) {
          case 'slack':
            promises.push(this.sendSlackNotification(alert, channel));
            break;
          case 'teams':
            promises.push(this.sendTeamsNotification(alert, channel));
            break;
          case 'email':
            promises.push(this.sendEmailNotification(alert, channel));
            break;
          case 'pagerduty':
            promises.push(this.sendPagerDutyNotification(alert, channel));
            break;
          case 'webhook':
            promises.push(this.sendWebhookNotification(alert, channel));
            break;
        }
      }
    }

    // Wait for all notifications to be sent
    const results = await Promise.allSettled(promises);
    
    // Log any failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Failed to send notification via ${channelsToUse[index]}:`, result.reason);
      }
    });
  }

  private getChannelsForSeverity(severity: AlertSeverity): string[] {
    switch (severity) {
      case 'critical':
        return ['slack', 'teams', 'email', 'pagerduty', 'webhook'];
      case 'high':
        return ['slack', 'teams', 'email'];
      case 'medium':
        return ['slack', 'teams'];
      case 'low':
        return ['slack'];
      case 'info':
        return ['slack'];
      default:
        return ['slack'];
    }
  }

  // Slack notification
  private async sendSlackNotification(alert: AlertNotification, channel: NotificationChannel): Promise<void> {
    const color = this.getSeverityColor(alert.severity);
    const emoji = this.getSeverityEmoji(alert.severity);
    
    const payload = {
      channel: channel.config.channel,
      username: channel.config.username,
      icon_emoji: channel.config.iconEmoji,
      attachments: [
        {
          color: color,
          title: `${emoji} ${alert.title}`,
          text: alert.message,
          fields: [
            {
              title: 'Dịch vụ', // Service in Vietnamese
              value: alert.service,
              short: true
            },
            {
              title: 'Môi trường', // Environment in Vietnamese
              value: alert.environment,
              short: true
            },
            {
              title: 'Mức độ nghiêm trọng', // Severity in Vietnamese
              value: this.getSeverityLabel(alert.severity),
              short: true
            },
            {
              title: 'Thời gian', // Time in Vietnamese
              value: alert.timestamp.toLocaleString('vi-VN', {
                timeZone: 'Asia/Ho_Chi_Minh'
              }),
              short: true
            }
          ],
          footer: 'Hệ thống Giám sát Y tế Việt Nam', // Vietnamese Healthcare Monitoring System
          ts: Math.floor(alert.timestamp.getTime() / 1000)
        }
      ]
    };

    // Add metrics if available
    if (alert.metrics) {
      const metricsFields = Object.entries(alert.metrics).map(([key, value]) => ({
        title: key,
        value: value.toString(),
        short: true
      }));
      payload.attachments[0].fields.push(...metricsFields);
    }

    const response = await fetch(channel.config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Slack notification failed: ${response.statusText}`);
    }
  }

  // Microsoft Teams notification
  private async sendTeamsNotification(alert: AlertNotification, channel: NotificationChannel): Promise<void> {
    const color = this.getSeverityColor(alert.severity);
    const emoji = this.getSeverityEmoji(alert.severity);

    const payload = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: color.replace('#', ''),
      summary: alert.title,
      sections: [
        {
          activityTitle: `${emoji} ${alert.title}`,
          activitySubtitle: alert.message,
          facts: [
            {
              name: 'Dịch vụ',
              value: alert.service
            },
            {
              name: 'Môi trường',
              value: alert.environment
            },
            {
              name: 'Mức độ nghiêm trọng',
              value: this.getSeverityLabel(alert.severity)
            },
            {
              name: 'Thời gian',
              value: alert.timestamp.toLocaleString('vi-VN', {
                timeZone: 'Asia/Ho_Chi_Minh'
              })
            }
          ]
        }
      ]
    };

    // Add metrics section if available
    if (alert.metrics) {
      const metricsFacts = Object.entries(alert.metrics).map(([key, value]) => ({
        name: key,
        value: value.toString()
      }));
      payload.sections.push({
        activityTitle: 'Thông số kỹ thuật', // Metrics in Vietnamese
        facts: metricsFacts
      });
    }

    const response = await fetch(channel.config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Teams notification failed: ${response.statusText}`);
    }
  }

  // Email notification
  private async sendEmailNotification(alert: AlertNotification, channel: NotificationChannel): Promise<void> {
    if (!this.emailTransporter) {
      throw new Error('Email transporter not configured');
    }

    const subject = `[${alert.severity.toUpperCase()}] ${alert.title} - ${alert.service}`;
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <div style="background-color: ${this.getSeverityColor(alert.severity)}; color: white; padding: 20px; border-radius: 5px 5px 0 0;">
          <h2 style="margin: 0;">${this.getSeverityEmoji(alert.severity)} ${alert.title}</h2>
        </div>
        
        <div style="border: 1px solid #ddd; border-top: none; padding: 20px; border-radius: 0 0 5px 5px;">
          <p><strong>Thông báo:</strong> ${alert.message}</p>
          
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <tr style="background-color: #f5f5f5;">
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>Dịch vụ</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd;">${alert.service}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>Môi trường</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd;">${alert.environment}</td>
            </tr>
            <tr style="background-color: #f5f5f5;">
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>Mức độ nghiêm trọng</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd;">${this.getSeverityLabel(alert.severity)}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>Thời gian</strong></td>
              <td style="padding: 10px; border: 1px solid #ddd;">${alert.timestamp.toLocaleString('vi-VN', {
                timeZone: 'Asia/Ho_Chi_Minh'
              })}</td>
            </tr>
          </table>
          
          ${alert.metrics ? `
            <h3>Thông số kỹ thuật:</h3>
            <table style="width: 100%; border-collapse: collapse;">
              ${Object.entries(alert.metrics).map(([key, value]) => `
                <tr>
                  <td style="padding: 8px; border: 1px solid #ddd;"><strong>${key}</strong></td>
                  <td style="padding: 8px; border: 1px solid #ddd;">${value}</td>
                </tr>
              `).join('')}
            </table>
          ` : ''}
          
          <hr style="margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            Thông báo này được gửi từ Hệ thống Giám sát Y tế Việt Nam<br>
            ID Cảnh báo: ${alert.id}
          </p>
        </div>
      </div>
    `;

    await this.emailTransporter.sendMail({
      from: process.env.EMAIL_FROM_ADDRESS || 'alerts@healthcare-claims.vn',
      to: channel.config.recipients.join(', '),
      subject: subject,
      html: htmlContent
    });
  }

  // PagerDuty notification
  private async sendPagerDutyNotification(alert: AlertNotification, channel: NotificationChannel): Promise<void> {
    const payload = {
      routing_key: channel.config.integrationKey,
      event_action: 'trigger',
      dedup_key: `${alert.service}-${alert.type}-${alert.environment}`,
      payload: {
        summary: alert.title,
        source: alert.service,
        severity: alert.severity,
        timestamp: alert.timestamp.toISOString(),
        component: alert.service,
        group: 'healthcare-claims',
        class: alert.type,
        custom_details: {
          environment: alert.environment,
          message: alert.message,
          metrics: alert.metrics,
          tags: alert.tags
        }
      }
    };

    const response = await fetch(channel.config.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`PagerDuty notification failed: ${response.statusText}`);
    }
  }

  // Custom webhook notification
  private async sendWebhookNotification(alert: AlertNotification, channel: NotificationChannel): Promise<void> {
    const payload = {
      alert_id: alert.id,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      service: alert.service,
      environment: alert.environment,
      timestamp: alert.timestamp.toISOString(),
      metrics: alert.metrics,
      additional_data: alert.additionalData,
      tags: alert.tags
    };

    const response = await fetch(channel.config.url, {
      method: 'POST',
      headers: channel.config.headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Webhook notification failed: ${response.statusText}`);
    }
  }

  // Helper methods
  private getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case 'critical': return '#FF0000';
      case 'high': return '#FF6600';
      case 'medium': return '#FFAA00';
      case 'low': return '#FFFF00';
      case 'info': return '#00AAFF';
      default: return '#CCCCCC';
    }
  }

  private getSeverityEmoji(severity: AlertSeverity): string {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '📊';
      case 'low': return 'ℹ️';
      case 'info': return '💡';
      default: return '❓';
    }
  }

  private getSeverityLabel(severity: AlertSeverity): string {
    switch (severity) {
      case 'critical': return 'Nghiêm trọng'; // Critical in Vietnamese
      case 'high': return 'Cao'; // High in Vietnamese
      case 'medium': return 'Trung bình'; // Medium in Vietnamese
      case 'low': return 'Thấp'; // Low in Vietnamese
      case 'info': return 'Thông tin'; // Info in Vietnamese
      default: return 'Không xác định'; // Unknown in Vietnamese
    }
  }

  // Healthcare-specific alert methods
  async sendHealthcareComplianceAlert(violation: {
    type: string;
    description: string;
    service: string;
    patient_affected?: boolean;
    regulation_violated: string;
  }): Promise<void> {
    const alert: AlertNotification = {
      id: `compliance-${Date.now()}`,
      type: 'compliance_violation',
      severity: violation.patient_affected ? 'critical' : 'high',
      title: `Vi phạm Tuân thủ Y tế: ${violation.type}`,
      message: `${violation.description}. Quy định vi phạm: ${violation.regulation_violated}`,
      timestamp: new Date(),
      service: violation.service,
      environment: process.env.NODE_ENV || 'development',
      tags: ['healthcare', 'compliance', violation.regulation_violated.toLowerCase()],
      additionalData: violation
    };

    await this.sendAlert(alert);
  }

  async sendPatientDataAlert(incident: {
    type: 'access' | 'modification' | 'breach';
    description: string;
    service: string;
    patient_count?: number;
    unauthorized_access?: boolean;
  }): Promise<void> {
    const alert: AlertNotification = {
      id: `patient-data-${Date.now()}`,
      type: 'patient_data_breach',
      severity: incident.unauthorized_access ? 'critical' : 'high',
      title: `Cảnh báo Dữ liệu Bệnh nhân: ${incident.type}`,
      message: incident.description,
      timestamp: new Date(),
      service: incident.service,
      environment: process.env.NODE_ENV || 'development',
      tags: ['healthcare', 'patient-data', 'security'],
      additionalData: incident
    };

    await this.sendAlert(alert);
  }
}

// Singleton instance
export const healthcareAlertService = new HealthcareAlertService();

// Healthcare-specific alert helper functions
export const createServiceDownAlert = (service: string, environment: string): AlertNotification => ({
  id: `service-down-${service}-${Date.now()}`,
  type: 'service_down',
  severity: 'critical',
  title: `Dịch vụ không khả dụng: ${service}`,
  message: `Dịch vụ ${service} đang không phản hồi hoặc trả về lỗi.`,
  timestamp: new Date(),
  service,
  environment,
  tags: ['availability', 'downtime']
});

export const createPerformanceAlert = (
  service: string,
  environment: string,
  responseTime: number,
  threshold: number
): AlertNotification => ({
  id: `performance-${service}-${Date.now()}`,
  type: 'performance_degraded',
  severity: responseTime > threshold * 2 ? 'high' : 'medium',
  title: `Hiệu suất giảm: ${service}`,
  message: `Thời gian phản hồi của ${service} cao bất thường: ${responseTime}ms (ngưỡng: ${threshold}ms)`,
  timestamp: new Date(),
  service,
  environment,
  metrics: {
    responseTime,
    threshold,
    percentageOver: Math.round(((responseTime - threshold) / threshold) * 100)
  },
  tags: ['performance', 'response-time']
});
