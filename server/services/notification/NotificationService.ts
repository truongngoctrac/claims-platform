import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import nodemailer from 'nodemailer';
import cron from 'node-cron';

export interface NotificationTemplate {
  id: string;
  name: string;
  type: NotificationType;
  subject: string;
  body: string;
  variables: string[];
  language: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreferences {
  userId: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  frequency: 'immediate' | 'daily' | 'weekly';
  categories: {
    claimUpdates: boolean;
    systemAlerts: boolean;
    marketing: boolean;
    reminders: boolean;
  };
  quietHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
  };
}

export interface NotificationJob {
  id: string;
  userId: string;
  templateId: string;
  type: NotificationType;
  channel: NotificationChannel;
  recipient: string;
  subject: string;
  body: string;
  data: Record<string, any>;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  scheduledAt?: Date;
  sentAt?: Date;
  attempts: number;
  maxAttempts: number;
  failureReason?: string;
  deliveryStatus?: DeliveryStatus;
  createdAt: Date;
}

export type NotificationType = 
  | 'claim_submitted'
  | 'claim_approved'
  | 'claim_rejected'
  | 'claim_requires_documents'
  | 'payment_processed'
  | 'system_maintenance'
  | 'reminder'
  | 'marketing'
  | 'security_alert';

export type NotificationChannel = 'email' | 'sms' | 'push' | 'in_app';

export interface DeliveryStatus {
  delivered: boolean;
  deliveredAt?: Date;
  opened?: boolean;
  openedAt?: Date;
  clicked?: boolean;
  clickedAt?: Date;
  bounced?: boolean;
  bounceReason?: string;
}

export interface NotificationAnalytics {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
}

export class NotificationService extends EventEmitter {
  private templates: Map<string, NotificationTemplate> = new Map();
  private preferences: Map<string, NotificationPreferences> = new Map();
  private jobs: Map<string, NotificationJob> = new Map();
  private queue: NotificationJob[] = [];
  private rateLimits: Map<string, { count: number; resetAt: Date }> = new Map();
  private emailTransporter: any;
  private processing = false;

  constructor() {
    super();
    this.initializeEmailTransporter();
    this.initializeDefaultTemplates();
    this.startQueueProcessor();
    this.setupScheduledTasks();
  }

  // 2.2.26 Email notification system
  private initializeEmailTransporter(): void {
    this.emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER || 'healthcare@example.com',
        pass: process.env.SMTP_PASS || 'password'
      }
    });
  }

  async sendEmailNotification(job: NotificationJob): Promise<boolean> {
    try {
      const mailOptions = {
        from: 'Hệ thống Bồi thường BHYT <noreply@healthcare.vn>',
        to: job.recipient,
        subject: job.subject,
        html: job.body,
        headers: {
          'X-Notification-ID': job.id,
          'X-User-ID': job.userId
        }
      };

      const result = await this.emailTransporter.sendMail(mailOptions);
      
      job.deliveryStatus = {
        delivered: true,
        deliveredAt: new Date()
      };

      return true;
    } catch (error) {
      console.error('Email sending failed:', error);
      job.failureReason = error.message;
      return false;
    }
  }

  // 2.2.27 SMS notification integration
  async sendSMSNotification(job: NotificationJob): Promise<boolean> {
    try {
      // Mock SMS integration - in real implementation would use Twilio, AWS SNS, or Vietnamese SMS providers
      const smsData = {
        to: job.recipient,
        message: job.body,
        from: 'BHYT_SYS'
      };

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      job.deliveryStatus = {
        delivered: true,
        deliveredAt: new Date()
      };

      console.log('SMS sent:', smsData);
      return true;
    } catch (error) {
      console.error('SMS sending failed:', error);
      job.failureReason = error.message;
      return false;
    }
  }

  // 2.2.28 Push notification service
  async sendPushNotification(job: NotificationJob): Promise<boolean> {
    try {
      // Mock push notification - in real implementation would use FCM, APNs, or web push
      const pushData = {
        userId: job.userId,
        title: job.subject,
        body: job.body,
        data: job.data,
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png'
      };

      // Simulate push notification
      await new Promise(resolve => setTimeout(resolve, 500));

      job.deliveryStatus = {
        delivered: true,
        deliveredAt: new Date()
      };

      console.log('Push notification sent:', pushData);
      return true;
    } catch (error) {
      console.error('Push notification failed:', error);
      job.failureReason = error.message;
      return false;
    }
  }

  // 2.2.29 In-app notification system
  async sendInAppNotification(job: NotificationJob): Promise<boolean> {
    try {
      // Store in-app notification
      const inAppNotification = {
        id: uuidv4(),
        userId: job.userId,
        title: job.subject,
        message: job.body,
        type: job.type,
        data: job.data,
        read: false,
        createdAt: new Date()
      };

      // In real implementation, would store in database
      console.log('In-app notification created:', inAppNotification);

      // Emit real-time event for WebSocket
      this.emit('inAppNotification', inAppNotification);

      job.deliveryStatus = {
        delivered: true,
        deliveredAt: new Date()
      };

      return true;
    } catch (error) {
      console.error('In-app notification failed:', error);
      job.failureReason = error.message;
      return false;
    }
  }

  // 2.2.30 Notification template engine
  private initializeDefaultTemplates(): void {
    const defaultTemplates: NotificationTemplate[] = [
      {
        id: 'claim_submitted',
        name: 'Hồ sơ đã được nộp',
        type: 'claim_submitted',
        subject: 'Hồ sơ bồi thường {{claimNumber}} đã được tiếp nhận',
        body: `
          <h2>Xin chào {{patientName}},</h2>
          <p>Hồ sơ bồi thường của bạn đã được tiếp nhận thành công.</p>
          <ul>
            <li><strong>Mã hồ sơ:</strong> {{claimNumber}}</li>
            <li><strong>Loại hồ sơ:</strong> {{claimType}}</li>
            <li><strong>Số tiền:</strong> {{amount}} VNĐ</li>
            <li><strong>Thời gian xử lý dự kiến:</strong> {{estimatedTime}}</li>
          </ul>
          <p>Bạn có thể theo dõi tiến độ xử lý tại: <a href="{{trackingUrl}}">{{trackingUrl}}</a></p>
          <p>Trân trọng,<br>Hệ thống Bồi thường BHYT</p>
        `,
        variables: ['patientName', 'claimNumber', 'claimType', 'amount', 'estimatedTime', 'trackingUrl'],
        language: 'vi',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'claim_approved',
        name: 'Hồ sơ đã được duyệt',
        type: 'claim_approved',
        subject: 'Hồ sơ {{claimNumber}} đã được phê duyệt',
        body: `
          <h2>Tin vui! Hồ sơ của bạn đã được duyệt</h2>
          <p>Xin chào {{patientName}},</p>
          <p>Chúng tôi vui mừng thông báo hồ sơ bồi thường {{claimNumber}} của bạn đã được phê duyệt.</p>
          <ul>
            <li><strong>Số tiền được duyệt:</strong> {{approvedAmount}} VNĐ</li>
            <li><strong>Thời gian thanh toán dự kiến:</strong> {{paymentTime}}</li>
          </ul>
          <p>Số tiền sẽ được chuyển vào tài khoản ngân hàng của bạn trong vòng 3-5 ngày làm việc.</p>
          <p>Trân trọng,<br>Hệ thống Bồi thường BHYT</p>
        `,
        variables: ['patientName', 'claimNumber', 'approvedAmount', 'paymentTime'],
        language: 'vi',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'claim_requires_documents',
        name: 'Cần bổ sung tài liệu',
        type: 'claim_requires_documents',
        subject: 'Hồ sơ {{claimNumber}} cần bổ sung tài liệu',
        body: `
          <h2>Cần bổ sung tài liệu</h2>
          <p>Xin chào {{patientName}},</p>
          <p>Để x��� lý hồ sơ {{claimNumber}}, chúng tôi cần bạn bổ sung các tài liệu sau:</p>
          <ul>
            {{#each missingDocuments}}
            <li>{{this}}</li>
            {{/each}}
          </ul>
          <p>Vui lòng tải lên tài liệu tại: <a href="{{uploadUrl}}">{{uploadUrl}}</a></p>
          <p>Thời hạn bổ sung: {{deadline}}</p>
          <p>Trân trọng,<br>Hệ thống Bồi thường BHYT</p>
        `,
        variables: ['patientName', 'claimNumber', 'missingDocuments', 'uploadUrl', 'deadline'],
        language: 'vi',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    defaultTemplates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  createTemplate(template: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>): NotificationTemplate {
    const newTemplate: NotificationTemplate = {
      ...template,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.templates.set(newTemplate.id, newTemplate);
    return newTemplate;
  }

  updateTemplate(templateId: string, updates: Partial<NotificationTemplate>): NotificationTemplate | null {
    const template = this.templates.get(templateId);
    if (!template) return null;

    const updatedTemplate = {
      ...template,
      ...updates,
      updatedAt: new Date()
    };

    this.templates.set(templateId, updatedTemplate);
    return updatedTemplate;
  }

  // 2.2.31 Notification preferences management
  getUserPreferences(userId: string): NotificationPreferences {
    return this.preferences.get(userId) || this.getDefaultPreferences(userId);
  }

  updateUserPreferences(userId: string, preferences: Partial<NotificationPreferences>): NotificationPreferences {
    const current = this.getUserPreferences(userId);
    const updated = { ...current, ...preferences };
    this.preferences.set(userId, updated);
    return updated;
  }

  private getDefaultPreferences(userId: string): NotificationPreferences {
    return {
      userId,
      emailEnabled: true,
      smsEnabled: true,
      pushEnabled: true,
      inAppEnabled: true,
      frequency: 'immediate',
      categories: {
        claimUpdates: true,
        systemAlerts: true,
        marketing: false,
        reminders: true
      },
      quietHours: {
        enabled: true,
        startTime: '22:00',
        endTime: '08:00'
      }
    };
  }

  // 2.2.32 Notification queue processing
  async queueNotification(
    userId: string,
    templateId: string,
    channel: NotificationChannel,
    recipient: string,
    data: Record<string, any>,
    options: {
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      scheduledAt?: Date;
      maxAttempts?: number;
    } = {}
  ): Promise<string> {

    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    const preferences = this.getUserPreferences(userId);
    
    // Check if user has enabled this channel
    if (!this.isChannelEnabled(channel, preferences)) {
      throw new Error('Notification channel disabled by user');
    }

    // Check rate limiting
    if (!this.checkRateLimit(userId, channel)) {
      throw new Error('Rate limit exceeded');
    }

    const job: NotificationJob = {
      id: uuidv4(),
      userId,
      templateId,
      type: template.type,
      channel,
      recipient,
      subject: this.processTemplate(template.subject, data),
      body: this.processTemplate(template.body, data),
      data,
      status: 'pending',
      priority: options.priority || 'medium',
      scheduledAt: options.scheduledAt,
      attempts: 0,
      maxAttempts: options.maxAttempts || 3,
      createdAt: new Date()
    };

    this.jobs.set(job.id, job);
    this.queue.push(job);
    this.queue.sort((a, b) => this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority));

    this.emit('notificationQueued', job);

    return job.id;
  }

  // 2.2.33 Delivery status tracking
  async getDeliveryStatus(jobId: string): Promise<NotificationJob | null> {
    return this.jobs.get(jobId) || null;
  }

  async updateDeliveryStatus(jobId: string, status: Partial<DeliveryStatus>): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.deliveryStatus = { ...job.deliveryStatus, ...status };
    this.jobs.set(jobId, job);

    this.emit('deliveryStatusUpdated', { jobId, status });
  }

  // 2.2.34 Failed notification retry logic
  private async retryFailedNotification(job: NotificationJob): Promise<void> {
    if (job.attempts >= job.maxAttempts) {
      job.status = 'failed';
      this.jobs.set(job.id, job);
      this.emit('notificationFailed', job);
      return;
    }

    job.attempts++;
    job.status = 'pending';
    
    // Exponential backoff
    const delay = Math.pow(2, job.attempts) * 1000;
    setTimeout(() => {
      this.queue.unshift(job); // High priority for retries
    }, delay);

    this.jobs.set(job.id, job);
  }

  // 2.2.35 Notification analytics
  async getNotificationAnalytics(params: {
    startDate: Date;
    endDate: Date;
    type?: NotificationType;
    channel?: NotificationChannel;
    userId?: string;
  }): Promise<NotificationAnalytics> {

    const jobs = Array.from(this.jobs.values()).filter(job => {
      if (job.createdAt < params.startDate || job.createdAt > params.endDate) return false;
      if (params.type && job.type !== params.type) return false;
      if (params.channel && job.channel !== params.channel) return false;
      if (params.userId && job.userId !== params.userId) return false;
      return true;
    });

    const sent = jobs.filter(job => job.status === 'sent').length;
    const delivered = jobs.filter(job => job.deliveryStatus?.delivered).length;
    const opened = jobs.filter(job => job.deliveryStatus?.opened).length;
    const clicked = jobs.filter(job => job.deliveryStatus?.clicked).length;
    const bounced = jobs.filter(job => job.deliveryStatus?.bounced).length;

    return {
      sent,
      delivered,
      opened,
      clicked,
      bounced,
      deliveryRate: sent > 0 ? (delivered / sent) * 100 : 0,
      openRate: delivered > 0 ? (opened / delivered) * 100 : 0,
      clickRate: opened > 0 ? (clicked / opened) * 100 : 0,
      bounceRate: sent > 0 ? (bounced / sent) * 100 : 0
    };
  }

  // 2.2.36 Bulk notification support
  async sendBulkNotifications(
    notifications: Array<{
      userId: string;
      templateId: string;
      channel: NotificationChannel;
      recipient: string;
      data: Record<string, any>;
    }>,
    options: { batchSize?: number } = {}
  ): Promise<string[]> {

    const batchSize = options.batchSize || 100;
    const jobIds: string[] = [];

    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      const batchPromises = batch.map(notification =>
        this.queueNotification(
          notification.userId,
          notification.templateId,
          notification.channel,
          notification.recipient,
          notification.data
        )
      );

      const batchJobIds = await Promise.all(batchPromises);
      jobIds.push(...batchJobIds);

      // Small delay between batches to avoid overwhelming the system
      if (i + batchSize < notifications.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return jobIds;
  }

  // 2.2.37 Rate limiting implementation
  private checkRateLimit(userId: string, channel: NotificationChannel): boolean {
    const key = `${userId}:${channel}`;
    const now = new Date();
    const limit = this.rateLimits.get(key);

    // Rate limits per hour
    const maxLimits = {
      email: 50,
      sms: 10,
      push: 100,
      in_app: 200
    };

    if (!limit || limit.resetAt < now) {
      this.rateLimits.set(key, {
        count: 1,
        resetAt: new Date(now.getTime() + 60 * 60 * 1000) // 1 hour
      });
      return true;
    }

    if (limit.count >= maxLimits[channel]) {
      return false;
    }

    limit.count++;
    this.rateLimits.set(key, limit);
    return true;
  }

  // 2.2.38 Notification scheduling
  async scheduleNotification(
    userId: string,
    templateId: string,
    channel: NotificationChannel,
    recipient: string,
    data: Record<string, any>,
    scheduledAt: Date
  ): Promise<string> {

    return await this.queueNotification(
      userId,
      templateId,
      channel,
      recipient,
      data,
      { scheduledAt }
    );
  }

  async cancelScheduledNotification(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'pending') {
      return false;
    }

    job.status = 'cancelled';
    this.jobs.set(jobId, job);

    // Remove from queue
    const queueIndex = this.queue.findIndex(q => q.id === jobId);
    if (queueIndex !== -1) {
      this.queue.splice(queueIndex, 1);
    }

    return true;
  }

  // 2.2.39 Multi-language support
  async getTemplateByLanguage(templateId: string, language: string): Promise<NotificationTemplate | null> {
    // Look for language-specific template first
    const langSpecificTemplate = this.templates.get(`${templateId}_${language}`);
    if (langSpecificTemplate) {
      return langSpecificTemplate;
    }

    // Fall back to default template
    return this.templates.get(templateId) || null;
  }

  // 2.2.40 A/B testing cho templates
  async createABTest(
    templateId: string,
    variantTemplate: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>,
    testPercentage: number
  ): Promise<string> {

    const testId = uuidv4();
    const variantTemplateWithId = {
      ...variantTemplate,
      id: `${templateId}_variant_${testId}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.templates.set(variantTemplateWithId.id, variantTemplateWithId);

    // Store A/B test configuration
    // In real implementation, would store in database
    console.log(`A/B test created: ${testId}, ${testPercentage}% traffic to variant`);

    return testId;
  }

  // Queue processor
  private startQueueProcessor(): void {
    setInterval(async () => {
      if (this.processing || this.queue.length === 0) return;

      this.processing = true;
      const job = this.queue.shift();
      
      if (!job) {
        this.processing = false;
        return;
      }

      // Check if scheduled for future
      if (job.scheduledAt && job.scheduledAt > new Date()) {
        this.queue.push(job);
        this.processing = false;
        return;
      }

      // Check quiet hours
      if (this.isQuietHours(job.userId)) {
        // Reschedule for after quiet hours
        const preferences = this.getUserPreferences(job.userId);
        const nextValidTime = this.getNextValidTime(preferences.quietHours);
        job.scheduledAt = nextValidTime;
        this.queue.push(job);
        this.processing = false;
        return;
      }

      await this.processNotificationJob(job);
      this.processing = false;
    }, 1000);
  }

  private async processNotificationJob(job: NotificationJob): Promise<void> {
    job.status = 'processing';
    this.jobs.set(job.id, job);

    let success = false;

    try {
      switch (job.channel) {
        case 'email':
          success = await this.sendEmailNotification(job);
          break;
        case 'sms':
          success = await this.sendSMSNotification(job);
          break;
        case 'push':
          success = await this.sendPushNotification(job);
          break;
        case 'in_app':
          success = await this.sendInAppNotification(job);
          break;
      }

      if (success) {
        job.status = 'sent';
        job.sentAt = new Date();
        this.emit('notificationSent', job);
      } else {
        await this.retryFailedNotification(job);
      }
    } catch (error) {
      job.failureReason = error.message;
      await this.retryFailedNotification(job);
    }

    this.jobs.set(job.id, job);
  }

  private setupScheduledTasks(): void {
    // Daily cleanup of old jobs
    cron.schedule('0 2 * * *', () => {
      this.cleanupOldJobs();
    });

    // Rate limit reset
    cron.schedule('0 * * * *', () => {
      this.resetRateLimits();
    });
  }

  private cleanupOldJobs(): void {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.createdAt < cutoff) {
        this.jobs.delete(jobId);
      }
    }
  }

  private resetRateLimits(): void {
    const now = new Date();
    for (const [key, limit] of this.rateLimits.entries()) {
      if (limit.resetAt < now) {
        this.rateLimits.delete(key);
      }
    }
  }

  // Helper methods
  private processTemplate(template: string, data: Record<string, any>): string {
    let processed = template;
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processed = processed.replace(regex, String(value));
    }
    return processed;
  }

  private isChannelEnabled(channel: NotificationChannel, preferences: NotificationPreferences): boolean {
    switch (channel) {
      case 'email': return preferences.emailEnabled;
      case 'sms': return preferences.smsEnabled;
      case 'push': return preferences.pushEnabled;
      case 'in_app': return preferences.inAppEnabled;
      default: return false;
    }
  }

  private getPriorityWeight(priority: string): number {
    const weights = { low: 1, medium: 2, high: 3, urgent: 4 };
    return weights[priority as keyof typeof weights] || 2;
  }

  private isQuietHours(userId: string): boolean {
    const preferences = this.getUserPreferences(userId);
    if (!preferences.quietHours.enabled) return false;

    const now = new Date();
    const currentTime = now.getHours() * 100 + now.getMinutes();
    const startTime = parseInt(preferences.quietHours.startTime.replace(':', ''));
    const endTime = parseInt(preferences.quietHours.endTime.replace(':', ''));

    if (startTime < endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  private getNextValidTime(quietHours: { startTime: string; endTime: string }): Date {
    const now = new Date();
    const endTime = parseInt(quietHours.endTime.replace(':', ''));
    const nextDay = new Date(now);
    nextDay.setDate(now.getDate() + 1);
    nextDay.setHours(Math.floor(endTime / 100), endTime % 100, 0, 0);
    return nextDay;
  }
}
