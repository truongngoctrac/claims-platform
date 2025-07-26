import sgMail from '@sendgrid/mail';
import { EmailConfig, IntegrationResponse } from '../types';
import { IntegrationConfigManager } from '../config/IntegrationConfig';
import { RateLimitManager } from '../utils/RateLimitManager';
import { RetryManager } from '../utils/RetryManager';
import crypto from 'crypto';

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  template?: string;
  templateData?: Record<string, any>;
  attachments?: EmailAttachment[];
  cc?: string[];
  bcc?: string[];
}

export interface EmailAttachment {
  content: string; // Base64 encoded
  filename: string;
  type: string;
  disposition?: 'attachment' | 'inline';
  contentId?: string;
}

export interface EmailResponse {
  messageId: string;
  status: 'sent' | 'failed' | 'queued';
  accepted: string[];
  rejected: string[];
  errorMessage?: string;
}

export class EmailService {
  private configManager: IntegrationConfigManager;
  private rateLimitManager: RateLimitManager;
  private retryManager: RetryManager;
  private initialized = false;

  constructor() {
    this.configManager = IntegrationConfigManager.getInstance();
    this.rateLimitManager = new RateLimitManager();
    this.retryManager = new RetryManager();
    this.initializeService();
  }

  private initializeService(): void {
    const config = this.configManager.getConfig<EmailConfig>('email-sendgrid');
    
    if (config?.enabled && config.apiKey) {
      sgMail.setApiKey(config.apiKey);
      this.initialized = true;
    }
  }

  public async sendEmail(message: EmailMessage): Promise<IntegrationResponse<EmailResponse>> {
    const requestId = crypto.randomUUID();
    
    try {
      if (!this.initialized) {
        throw new Error('Email service is not properly configured');
      }

      // Check rate limits
      await this.rateLimitManager.checkRateLimit('email-sendgrid', requestId);

      const config = this.configManager.getConfig<EmailConfig>('email-sendgrid')!;
      const emailData = await this.prepareEmailData(message, config);

      const response = await this.retryManager.executeWithRetry(
        () => sgMail.send(emailData),
        'email-sendgrid'
      );

      return {
        success: true,
        data: {
          messageId: response[0].headers['x-message-id'] || requestId,
          status: 'sent',
          accepted: Array.isArray(message.to) ? message.to : [message.to],
          rejected: []
        },
        requestId,
        timestamp: new Date()
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Email send failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  private async prepareEmailData(message: EmailMessage, config: EmailConfig): Promise<any> {
    const emailData: any = {
      from: {
        email: config.fromEmail,
        name: config.fromName
      },
      subject: message.subject,
      personalizations: [{
        to: Array.isArray(message.to) 
          ? message.to.map(email => ({ email }))
          : [{ email: message.to }]
      }]
    };

    // Add CC and BCC if provided
    if (message.cc && message.cc.length > 0) {
      emailData.personalizations[0].cc = message.cc.map(email => ({ email }));
    }

    if (message.bcc && message.bcc.length > 0) {
      emailData.personalizations[0].bcc = message.bcc.map(email => ({ email }));
    }

    // Handle template or content
    if (message.template && config.templates[message.template]) {
      emailData.templateId = config.templates[message.template];
      if (message.templateData) {
        emailData.personalizations[0].dynamicTemplateData = message.templateData;
      }
    } else {
      emailData.content = [];
      
      if (message.text) {
        emailData.content.push({
          type: 'text/plain',
          value: message.text
        });
      }
      
      if (message.html) {
        emailData.content.push({
          type: 'text/html',
          value: message.html
        });
      }

      if (emailData.content.length === 0) {
        throw new Error('Email must have either template or content');
      }
    }

    // Add attachments if provided
    if (message.attachments && message.attachments.length > 0) {
      emailData.attachments = message.attachments.map(attachment => ({
        content: attachment.content,
        filename: attachment.filename,
        type: attachment.type,
        disposition: attachment.disposition || 'attachment',
        content_id: attachment.contentId
      }));
    }

    return emailData;
  }

  public async sendBulkEmail(messages: EmailMessage[]): Promise<IntegrationResponse<EmailResponse[]>> {
    const requestId = crypto.randomUUID();
    
    try {
      const results = await Promise.allSettled(
        messages.map(message => this.sendEmail(message))
      );

      const responses = results.map(result => 
        result.status === 'fulfilled' ? result.value.data : null
      ).filter(Boolean) as EmailResponse[];

      return {
        success: true,
        data: responses,
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Bulk email send failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  public async sendWelcomeEmail(
    userEmail: string, 
    userName: string, 
    temporaryPassword?: string
  ): Promise<IntegrationResponse<EmailResponse>> {
    return this.sendEmail({
      to: userEmail,
      subject: 'Chào mừng bạn đến với Hệ thống Bồi thường Y tế',
      template: 'welcome',
      templateData: {
        userName,
        temporaryPassword,
        loginUrl: process.env.FRONTEND_URL || 'https://healthclaim.vn/login'
      }
    });
  }

  public async sendClaimNotificationEmail(
    userEmail: string,
    userName: string,
    claimId: string,
    status: 'submitted' | 'approved' | 'rejected',
    claimAmount?: number,
    rejectionReason?: string
  ): Promise<IntegrationResponse<EmailResponse>> {
    const template = `claim_${status}`;
    const templateData: Record<string, any> = {
      userName,
      claimId,
      claimUrl: `${process.env.FRONTEND_URL || 'https://healthclaim.vn'}/claims/${claimId}`
    };

    if (claimAmount) {
      templateData.claimAmount = claimAmount.toLocaleString('vi-VN', {
        style: 'currency',
        currency: 'VND'
      });
    }

    if (rejectionReason) {
      templateData.rejectionReason = rejectionReason;
    }

    let subject = '';
    switch (status) {
      case 'submitted':
        subject = `Yêu cầu bồi thường #${claimId} đã được gửi thành công`;
        break;
      case 'approved':
        subject = `Yêu cầu bồi thường #${claimId} đã được phê duyệt`;
        break;
      case 'rejected':
        subject = `Yêu cầu bồi thường #${claimId} đã bị từ chối`;
        break;
    }

    return this.sendEmail({
      to: userEmail,
      subject,
      template,
      templateData
    });
  }

  public async sendPasswordResetEmail(
    userEmail: string,
    userName: string,
    resetToken: string
  ): Promise<IntegrationResponse<EmailResponse>> {
    return this.sendEmail({
      to: userEmail,
      subject: 'Đặt lại mật khẩu - Hệ thống Bồi thường Y tế',
      template: 'password_reset',
      templateData: {
        userName,
        resetUrl: `${process.env.FRONTEND_URL || 'https://healthclaim.vn'}/reset-password?token=${resetToken}`,
        expiryTime: '24 giờ'
      }
    });
  }

  public async sendDocumentProcessedEmail(
    userEmail: string,
    userName: string,
    documentName: string,
    processingResult: 'success' | 'failed',
    extractedData?: Record<string, any>,
    errorMessage?: string
  ): Promise<IntegrationResponse<EmailResponse>> {
    const subject = processingResult === 'success' 
      ? `Tài liệu "${documentName}" đã được xử lý thành công`
      : `Lỗi xử lý tài liệu "${documentName}"`;

    const templateData: Record<string, any> = {
      userName,
      documentName,
      processingResult,
      dashboardUrl: `${process.env.FRONTEND_URL || 'https://healthclaim.vn'}/dashboard`
    };

    if (extractedData) {
      templateData.extractedData = extractedData;
    }

    if (errorMessage) {
      templateData.errorMessage = errorMessage;
    }

    return this.sendEmail({
      to: userEmail,
      subject,
      template: 'document_processed',
      templateData
    });
  }

  public async getEmailStatus(messageId: string): Promise<IntegrationResponse<{status: string, events: any[]}>> {
    const requestId = crypto.randomUUID();
    
    try {
      // Note: SendGrid doesn't provide a direct API to get message status by message ID
      // This would typically require webhook implementation or using their Event API
      
      return {
        success: true,
        data: {
          status: 'unknown',
          events: []
        },
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Status check failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  public async validateEmailAddress(email: string): Promise<boolean> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  public async validateEmailTemplate(templateId: string): Promise<boolean> {
    try {
      const config = this.configManager.getConfig<EmailConfig>('email-sendgrid');
      return config?.templates && Object.values(config.templates).includes(templateId) || false;
    } catch {
      return false;
    }
  }
}
