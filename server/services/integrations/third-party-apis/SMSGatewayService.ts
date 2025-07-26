import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { SMSConfig, IntegrationResponse } from '../types';
import { IntegrationConfigManager } from '../config/IntegrationConfig';
import { RateLimitManager } from '../utils/RateLimitManager';
import { RetryManager } from '../utils/RetryManager';

export interface SMSMessage {
  to: string;
  message: string;
  template?: string;
  variables?: Record<string, string>;
}

export interface SMSResponse {
  messageId: string;
  status: 'sent' | 'failed' | 'pending';
  cost?: number;
  errorMessage?: string;
}

export class SMSGatewayService {
  private configManager: IntegrationConfigManager;
  private rateLimitManager: RateLimitManager;
  private retryManager: RetryManager;
  private viettelClient: AxiosInstance;
  private vnptClient: AxiosInstance;

  constructor() {
    this.configManager = IntegrationConfigManager.getInstance();
    this.rateLimitManager = new RateLimitManager();
    this.retryManager = new RetryManager();
    this.initializeClients();
  }

  private initializeClients(): void {
    const viettelConfig = this.configManager.getConfig<SMSConfig>('sms-viettel');
    const vnptConfig = this.configManager.getConfig<SMSConfig>('sms-vnpt');

    if (viettelConfig?.enabled) {
      this.viettelClient = axios.create({
        baseURL: viettelConfig.baseUrl,
        timeout: viettelConfig.timeout,
        headers: {
          'Authorization': `Bearer ${viettelConfig.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
    }

    if (vnptConfig?.enabled) {
      this.vnptClient = axios.create({
        baseURL: vnptConfig.baseUrl,
        timeout: vnptConfig.timeout,
        headers: {
          'Authorization': `Bearer ${vnptConfig.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
    }
  }

  public async sendSMS(
    message: SMSMessage, 
    provider: 'viettel' | 'vnpt' = 'viettel'
  ): Promise<IntegrationResponse<SMSResponse>> {
    const requestId = crypto.randomUUID();
    
    try {
      // Check rate limits
      await this.rateLimitManager.checkRateLimit(`sms-${provider}`, requestId);

      const config = this.configManager.getConfig<SMSConfig>(`sms-${provider}`);
      if (!config?.enabled) {
        throw new Error(`SMS provider ${provider} is not enabled`);
      }

      const processedMessage = this.processMessage(message, config);
      
      const response = await this.retryManager.executeWithRetry(
        () => this.sendSMSRequest(processedMessage, provider, config),
        `sms-${provider}`
      );

      return {
        success: true,
        data: response,
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        requestId,
        timestamp: new Date()
      };
    }
  }

  private processMessage(message: SMSMessage, config: SMSConfig): SMSMessage {
    let processedMessage = message.message;

    // Use template if specified
    if (message.template && config.templates[message.template]) {
      processedMessage = config.templates[message.template];
    }

    // Replace variables
    if (message.variables) {
      Object.entries(message.variables).forEach(([key, value]) => {
        processedMessage = processedMessage.replace(`{${key}}`, value);
      });
    }

    return {
      ...message,
      message: processedMessage
    };
  }

  private async sendSMSRequest(
    message: SMSMessage, 
    provider: 'viettel' | 'vnpt',
    config: SMSConfig
  ): Promise<SMSResponse> {
    if (provider === 'viettel') {
      return this.sendViettelSMS(message, config);
    } else {
      return this.sendVNPTSMS(message, config);
    }
  }

  private async sendViettelSMS(message: SMSMessage, config: SMSConfig): Promise<SMSResponse> {
    const payload = {
      from: config.fromNumber,
      to: message.to,
      text: message.message,
      unicode: this.containsUnicode(message.message)
    };

    const response = await this.viettelClient.post('/send', payload);
    
    return {
      messageId: response.data.messageId || crypto.randomUUID(),
      status: response.data.status === 'success' ? 'sent' : 'failed',
      cost: response.data.cost,
      errorMessage: response.data.error
    };
  }

  private async sendVNPTSMS(message: SMSMessage, config: SMSConfig): Promise<SMSResponse> {
    const payload = {
      username: config.fromNumber,
      password: config.apiKey,
      msisdn: message.to,
      message: message.message,
      cpcode: 'HEALTHCARE',
      requestid: crypto.randomUUID()
    };

    const response = await this.vnptClient.post('/mt', payload);
    
    return {
      messageId: response.data.requestid || crypto.randomUUID(),
      status: response.data.result === '0' ? 'sent' : 'failed',
      errorMessage: response.data.result !== '0' ? response.data.description : undefined
    };
  }

  private containsUnicode(text: string): boolean {
    return /[^\u0000-\u007F]/.test(text);
  }

  public async sendBulkSMS(
    messages: SMSMessage[], 
    provider: 'viettel' | 'vnpt' = 'viettel'
  ): Promise<IntegrationResponse<SMSResponse[]>> {
    const requestId = crypto.randomUUID();
    
    try {
      const results = await Promise.allSettled(
        messages.map(message => this.sendSMS(message, provider))
      );

      const responses = results.map(result => 
        result.status === 'fulfilled' ? result.value.data : null
      ).filter(Boolean) as SMSResponse[];

      return {
        success: true,
        data: responses,
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Bulk SMS send failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  public async getDeliveryStatus(messageId: string, provider: 'viettel' | 'vnpt' = 'viettel'): Promise<IntegrationResponse<{status: string, deliveredAt?: Date}>> {
    const requestId = crypto.randomUUID();
    
    try {
      const config = this.configManager.getConfig<SMSConfig>(`sms-${provider}`);
      if (!config?.enabled) {
        throw new Error(`SMS provider ${provider} is not enabled`);
      }

      let response;
      if (provider === 'viettel') {
        response = await this.viettelClient.get(`/status/${messageId}`);
      } else {
        response = await this.vnptClient.get(`/dlr/${messageId}`);
      }

      return {
        success: true,
        data: {
          status: response.data.status,
          deliveredAt: response.data.deliveredAt ? new Date(response.data.deliveredAt) : undefined
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

  public async sendOTP(phoneNumber: string, code: string, provider: 'viettel' | 'vnpt' = 'viettel'): Promise<IntegrationResponse<SMSResponse>> {
    return this.sendSMS({
      to: phoneNumber,
      message: '',
      template: 'otp_verification',
      variables: { code }
    }, provider);
  }

  public async sendClaimNotification(
    phoneNumber: string, 
    claimId: string, 
    status: 'submitted' | 'approved' | 'rejected',
    reason?: string,
    provider: 'viettel' | 'vnpt' = 'viettel'
  ): Promise<IntegrationResponse<SMSResponse>> {
    const template = `claim_${status}`;
    const variables: Record<string, string> = { claimId };
    
    if (reason) {
      variables.reason = reason;
    }

    return this.sendSMS({
      to: phoneNumber,
      message: '',
      template,
      variables
    }, provider);
  }
}
