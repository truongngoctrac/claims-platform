import {
  PaymentGateway,
  PaymentMethod,
  PaymentStatus,
  Currency,
  PaymentRequest,
  PaymentResponse,
  RefundRequest,
  RefundResponse,
  PaymentGatewayConfig,
  PaymentWebhookEvent,
} from '../../../shared/payment';

export abstract class PaymentGatewayBase {
  protected config: PaymentGatewayConfig;

  constructor(config: PaymentGatewayConfig) {
    this.config = config;
  }

  // Abstract methods that must be implemented by each gateway
  abstract processPayment(request: PaymentRequest): Promise<PaymentResponse>;
  abstract processRefund(request: RefundRequest): Promise<RefundResponse>;
  abstract getPaymentStatus(paymentId: string): Promise<PaymentStatus>;
  abstract verifyWebhook(event: PaymentWebhookEvent): Promise<boolean>;
  abstract handleWebhook(event: PaymentWebhookEvent): Promise<void>;

  // Common utility methods
  protected generateTransactionId(): string {
    return `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  protected calculateFees(amount: number): { gateway: number; platform: number; total: number } {
    const gatewayFee = amount * (this.config.fees.percentage / 100) + this.config.fees.fixed;
    const platformFee = amount * 0.001; // 0.1% platform fee
    return {
      gateway: Math.round(gatewayFee * 100) / 100,
      platform: Math.round(platformFee * 100) / 100,
      total: Math.round((gatewayFee + platformFee) * 100) / 100,
    };
  }

  protected validateRequest(request: PaymentRequest): void {
    if (!this.config.enabled) {
      throw new Error(`Payment gateway ${this.config.gateway} is disabled`);
    }

    if (!this.config.supportedCurrencies.includes(request.currency)) {
      throw new Error(`Currency ${request.currency} not supported by ${this.config.gateway}`);
    }

    if (!this.config.supportedMethods.includes(request.method)) {
      throw new Error(`Payment method ${request.method} not supported by ${this.config.gateway}`);
    }

    if (request.amount < this.config.limits.minAmount || request.amount > this.config.limits.maxAmount) {
      throw new Error(`Amount ${request.amount} is outside allowed limits for ${this.config.gateway}`);
    }
  }

  // Get gateway configuration
  getConfig(): PaymentGatewayConfig {
    return { ...this.config, apiKey: '***', secretKey: '***', webhookSecret: '***' };
  }

  // Check if gateway supports specific feature
  supportsFeature(feature: keyof PaymentGatewayConfig['features']): boolean {
    return this.config.features[feature];
  }

  // Get supported payment methods
  getSupportedMethods(): PaymentMethod[] {
    return this.config.supportedMethods;
  }

  // Get supported currencies
  getSupportedCurrencies(): Currency[] {
    return this.config.supportedCurrencies;
  }
}
