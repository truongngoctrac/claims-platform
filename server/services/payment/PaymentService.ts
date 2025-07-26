import {
  PaymentGateway,
  PaymentMethod,
  PaymentStatus,
  Currency,
  PaymentRequest,
  PaymentResponse,
  RefundRequest,
  RefundResponse,
  PaymentDetails,
  PaymentGatewayConfig,
  PaymentSplit,
  FraudCheckResult,
  RiskLevel,
  PaymentAnalytics,
  PaymentSchedule,
  ExchangeRate,
  PaymentWebhookEvent,
  Chargeback,
  TransactionType,
} from '../../../shared/payment';
import { PaymentGatewayBase } from './PaymentGatewayBase';
import { StripeGateway } from './StripeGateway';
import { VNPayGateway } from './VNPayGateway';
import { PayPalGateway } from './PayPalGateway';
import { FraudDetectionService } from './FraudDetectionService';
import { PaymentAnalyticsService } from './PaymentAnalyticsService';
import { ReconciliationService } from './ReconciliationService';
import { ComplianceService } from './ComplianceService';
import { SecurityService } from './SecurityService';
import { NotificationService } from '../notification/NotificationService';

export class PaymentService {
  private gateways: Map<PaymentGateway, PaymentGatewayBase> = new Map();
  private fraudDetection: FraudDetectionService;
  private analytics: PaymentAnalyticsService;
  private reconciliation: ReconciliationService;
  private compliance: ComplianceService;
  private security: SecurityService;
  private notifications: NotificationService;
  private paymentStore: Map<string, PaymentDetails> = new Map();
  private exchangeRates: Map<string, ExchangeRate> = new Map();

  constructor() {
    this.initializeGateways();
    this.fraudDetection = new FraudDetectionService();
    this.analytics = new PaymentAnalyticsService();
    this.reconciliation = new ReconciliationService();
    this.compliance = new ComplianceService();
    this.security = new SecurityService();
    this.notifications = new NotificationService();
    this.loadExchangeRates();
  }

  // 3.2.1 Multiple payment gateway support
  private initializeGateways(): void {
    const configs: PaymentGatewayConfig[] = [
      {
        gateway: PaymentGateway.STRIPE,
        enabled: true,
        apiKey: process.env.STRIPE_API_KEY || 'sk_test_',
        secretKey: process.env.STRIPE_SECRET_KEY || '',
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
        environment: 'sandbox',
        supportedMethods: [PaymentMethod.CREDIT_CARD, PaymentMethod.DEBIT_CARD, PaymentMethod.E_WALLET],
        supportedCurrencies: [Currency.USD, Currency.EUR, Currency.SGD],
        fees: { percentage: 2.9, fixed: 0.3, currency: Currency.USD },
        limits: { minAmount: 0.5, maxAmount: 999999, dailyLimit: 100000, monthlyLimit: 1000000 },
        features: {
          refunds: true,
          partialRefunds: true,
          subscriptions: true,
          paymentSplitting: true,
          fraudDetection: true,
        },
      },
      {
        gateway: PaymentGateway.VNPAY,
        enabled: true,
        apiKey: process.env.VNPAY_TMN_CODE || '',
        secretKey: process.env.VNPAY_HASH_SECRET || '',
        webhookSecret: process.env.VNPAY_WEBHOOK_SECRET || '',
        environment: 'sandbox',
        supportedMethods: [PaymentMethod.BANK_TRANSFER, PaymentMethod.QR_CODE, PaymentMethod.E_WALLET],
        supportedCurrencies: [Currency.VND],
        fees: { percentage: 1.5, fixed: 0, currency: Currency.VND },
        limits: { minAmount: 1000, maxAmount: 500000000, dailyLimit: 100000000, monthlyLimit: 1000000000 },
        features: {
          refunds: true,
          partialRefunds: true,
          subscriptions: false,
          paymentSplitting: false,
          fraudDetection: false,
        },
      },
      {
        gateway: PaymentGateway.PAYPAL,
        enabled: true,
        apiKey: process.env.PAYPAL_CLIENT_ID || '',
        secretKey: process.env.PAYPAL_CLIENT_SECRET || '',
        webhookSecret: process.env.PAYPAL_WEBHOOK_ID || '',
        environment: 'sandbox',
        supportedMethods: [PaymentMethod.E_WALLET, PaymentMethod.CREDIT_CARD, PaymentMethod.BANK_TRANSFER],
        supportedCurrencies: [Currency.USD, Currency.EUR],
        fees: { percentage: 3.4, fixed: 0.35, currency: Currency.USD },
        limits: { minAmount: 1, maxAmount: 10000, dailyLimit: 100000, monthlyLimit: 500000 },
        features: {
          refunds: true,
          partialRefunds: true,
          subscriptions: true,
          paymentSplitting: true,
          fraudDetection: true,
        },
      },
    ];

    configs.forEach(config => {
      let gateway: PaymentGatewayBase;
      
      switch (config.gateway) {
        case PaymentGateway.STRIPE:
          gateway = new StripeGateway(config);
          break;
        case PaymentGateway.VNPAY:
          gateway = new VNPayGateway(config);
          break;
        case PaymentGateway.PAYPAL:
          gateway = new PayPalGateway(config);
          break;
        default:
          throw new Error(`Unsupported gateway: ${config.gateway}`);
      }

      this.gateways.set(config.gateway, gateway);
    });
  }

  // 3.2.2 Payment method management
  async processPayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      // Validate and normalize request
    await this.validatePaymentRequest(request);

    // 3.2.15 Security threat detection
    const securityThreats = await this.security.detectThreats(request, request.metadata || {});
    if (securityThreats.some(threat => threat.severity === 'critical')) {
      throw new Error(`Payment blocked due to security threats: ${securityThreats.map(t => t.type).join(', ')}`);
    }

    // 3.2.4 Fraud detection
    const fraudCheck = await this.fraudDetection.checkPayment(request);
      if (fraudCheck.action === 'decline') {
        throw new Error(`Payment declined due to fraud risk: ${fraudCheck.recommendations.join(', ')}`);
      }

      // 3.2.8 Multi-currency support
      const convertedRequest = await this.convertCurrency(request);

      // Select best gateway
      const gateway = await this.selectOptimalGateway(convertedRequest);
      
      // Process payment
      const response = await gateway.processPayment(convertedRequest);

      // 3.2.5 Payment splitting logic
      let splitPayments: PaymentSplit[] = [];
      if (request.metadata?.splitRecipients) {
        splitPayments = await this.processSplitPayments(response, request.metadata.splitRecipients);
      }

      // 3.2.11 Compliance validation
      const complianceCheck = await this.compliance.validatePCIDSS(response as any);
      if (!complianceCheck.passed) {
        throw new Error(`Payment failed compliance check: ${complianceCheck.checks.filter(c => !c.passed).map(c => c.details).join(', ')}`);
      }

      // Store payment details
      const paymentDetails: PaymentDetails = {
        id: response.id,
        claimId: request.claimId,
        customerId: request.customerId,
        amount: response.amount,
        currency: response.currency,
        status: response.status,
        gateway: response.gateway,
        method: response.method,
        description: request.description,
        transactionId: response.transactionId,
        gatewayTransactionId: response.gatewayTransactionId,
        fees: response.fees,
        splitPayments,
        fraudCheck,
        compliance: {
          level: fraudCheck.riskLevel === RiskLevel.LOW ? 
            require('../../../shared/payment').ComplianceLevel.PCI_DSS_LEVEL_1 : 
            require('../../../shared/payment').ComplianceLevel.PCI_DSS_LEVEL_2,
          verified: true,
          verifiedAt: new Date(),
        },
        riskAssessment: {
          level: fraudCheck.riskLevel,
          score: fraudCheck.riskScore,
          factors: fraudCheck.factors,
        },
        timeline: [{
          id: `${Date.now()}`,
          type: 'payment_initiated',
          status: response.status,
          message: 'Payment initiated successfully',
          createdAt: new Date(),
        }],
        createdAt: response.createdAt,
        updatedAt: response.updatedAt,
        metadata: response.metadata,
      };

      this.paymentStore.set(response.id, paymentDetails);

      // 3.2.13 Payment notification system
      await this.sendPaymentNotification(paymentDetails, 'payment_initiated');

      // 3.2.7 Analytics tracking
      await this.analytics.trackPayment(paymentDetails);

      return response;
    } catch (error) {
      // 3.2.6 Automatic retry mechanisms
      if (this.isRetryableError(error)) {
        return this.retryPayment(request, error);
      }
      throw error;
    }
  }

  // 3.2.10 Refund automation
  async processRefund(request: RefundRequest): Promise<RefundResponse> {
    const payment = this.paymentStore.get(request.paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new Error('Can only refund completed payments');
    }

    const gateway = this.gateways.get(payment.gateway);
    if (!gateway) {
      throw new Error(`Gateway ${payment.gateway} not available`);
    }

    // Process refund
    const refundResponse = await gateway.processRefund(request);

    // Update payment timeline
    payment.timeline.push({
      id: `${Date.now()}`,
      type: 'refund_initiated',
      status: PaymentStatus.PROCESSING,
      message: `Refund initiated: ${request.reason}`,
      data: { refundId: refundResponse.id, amount: refundResponse.amount },
      createdAt: new Date(),
    });

    // Send notification
    await this.sendPaymentNotification(payment, 'refund_initiated');

    return refundResponse;
  }

  // 3.2.12 Transaction monitoring
  async monitorTransactions(): Promise<void> {
    for (const [paymentId, payment] of this.paymentStore) {
      if (payment.status === PaymentStatus.PENDING || payment.status === PaymentStatus.PROCESSING) {
        const gateway = this.gateways.get(payment.gateway);
        if (gateway) {
          try {
            const currentStatus = await gateway.getPaymentStatus(payment.gatewayTransactionId || paymentId);
            if (currentStatus !== payment.status) {
              await this.updatePaymentStatus(paymentId, currentStatus);
            }
          } catch (error) {
            console.error(`Failed to monitor payment ${paymentId}:`, error);
          }
        }
      }
    }
  }

  // 3.2.14 Chargeback management
  async handleChargeback(chargebackData: Partial<Chargeback>): Promise<Chargeback> {
    const chargeback: Chargeback = {
      id: `CB_${Date.now()}`,
      paymentId: chargebackData.paymentId!,
      amount: chargebackData.amount!,
      currency: chargebackData.currency!,
      reason: chargebackData.reason!,
      reasonCode: chargebackData.reasonCode!,
      status: 'received',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      evidence: [],
      timeline: [{
        id: `${Date.now()}`,
        type: 'chargeback_received',
        status: 'received',
        message: 'Chargeback received from bank',
        createdAt: new Date(),
      }],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Notify finance team
    await this.notifications.send({
      userId: 'finance-team',
      type: 'chargeback_received',
      message: `New chargeback received for payment ${chargeback.paymentId}`,
      data: { chargebackId: chargeback.id, amount: chargeback.amount },
    });

    return chargeback;
  }

  // 3.2.9 Payment scheduling system
  async schedulePayment(schedule: Omit<PaymentSchedule, 'id' | 'createdAt' | 'updatedAt'>): Promise<PaymentSchedule> {
    const paymentSchedule: PaymentSchedule = {
      ...schedule,
      id: `SCHED_${Date.now()}`,
      status: 'active',
      paymentCount: 0,
      failureCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Schedule first payment
    await this.scheduleNextPayment(paymentSchedule);

    return paymentSchedule;
  }

  // 3.2.3 Advanced reconciliation system
  async reconcilePayments(date: Date): Promise<void> {
    await this.reconciliation.reconcileForDate(date);
  }

  // 3.2.7 Payment analytics and reporting
  async getPaymentAnalytics(startDate: Date, endDate: Date): Promise<PaymentAnalytics> {
    return this.analytics.generateAnalytics(startDate, endDate);
  }

  // Private helper methods
  private async validatePaymentRequest(request: PaymentRequest): Promise<void> {
    if (!request.amount || request.amount <= 0) {
      throw new Error('Invalid payment amount');
    }

    if (!request.customerId) {
      throw new Error('Customer ID is required');
    }

    if (!this.gateways.has(request.gateway)) {
      throw new Error(`Unsupported payment gateway: ${request.gateway}`);
    }
  }

  private async selectOptimalGateway(request: PaymentRequest): Promise<PaymentGatewayBase> {
    // Simple gateway selection logic - can be enhanced with routing rules
    const requestedGateway = this.gateways.get(request.gateway);
    if (!requestedGateway) {
      throw new Error(`Gateway ${request.gateway} not available`);
    }

    return requestedGateway;
  }

  private async convertCurrency(request: PaymentRequest): Promise<PaymentRequest> {
    // If conversion needed, apply exchange rate
    return request; // For now, return as-is
  }

  private async processSplitPayments(payment: PaymentResponse, recipients: string): Promise<PaymentSplit[]> {
    // Implement payment splitting logic
    const splits: PaymentSplit[] = [];
    
    try {
      const splitData = JSON.parse(recipients);
      for (const split of splitData) {
        splits.push({
          id: `SPLIT_${Date.now()}_${Math.random()}`,
          recipient: split.recipient,
          amount: split.amount || (payment.amount * split.percentage / 100),
          currency: payment.currency,
          percentage: split.percentage,
          description: split.description || 'Payment split',
          status: PaymentStatus.PENDING,
        });
      }
    } catch (error) {
      console.error('Failed to process split payments:', error);
    }

    return splits;
  }

  private isRetryableError(error: any): boolean {
    const retryableErrors = ['network_error', 'timeout', 'temporary_failure'];
    return retryableErrors.some(type => error.message?.includes(type));
  }

  private async retryPayment(request: PaymentRequest, error: any, retryCount = 0): Promise<PaymentResponse> {
    const maxRetries = 3;
    const retryDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff

    if (retryCount >= maxRetries) {
      throw new Error(`Payment failed after ${maxRetries} retries: ${error.message}`);
    }

    await new Promise(resolve => setTimeout(resolve, retryDelay));

    try {
      return await this.processPayment(request);
    } catch (retryError) {
      return this.retryPayment(request, retryError, retryCount + 1);
    }
  }

  private async updatePaymentStatus(paymentId: string, newStatus: PaymentStatus): Promise<void> {
    const payment = this.paymentStore.get(paymentId);
    if (!payment) return;

    const oldStatus = payment.status;
    payment.status = newStatus;
    payment.updatedAt = new Date();

    payment.timeline.push({
      id: `${Date.now()}`,
      type: 'status_changed',
      status: newStatus,
      message: `Status changed from ${oldStatus} to ${newStatus}`,
      createdAt: new Date(),
    });

    // Send status update notification
    await this.sendPaymentNotification(payment, 'status_updated');

    if (newStatus === PaymentStatus.COMPLETED) {
      payment.completedAt = new Date();
    }
  }

  private async sendPaymentNotification(payment: PaymentDetails, eventType: string): Promise<void> {
    await this.notifications.send({
      userId: payment.customerId,
      type: eventType,
      message: `Payment ${payment.id} ${eventType.replace('_', ' ')}`,
      data: { 
        paymentId: payment.id, 
        amount: payment.amount, 
        currency: payment.currency,
        status: payment.status 
      },
    });
  }

  private async scheduleNextPayment(schedule: PaymentSchedule): Promise<void> {
    // Calculate next payment date based on frequency
    const now = new Date();
    let nextDate = new Date(schedule.nextPaymentAt || schedule.startDate);

    switch (schedule.frequency) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
    }

    schedule.nextPaymentAt = nextDate;
    schedule.updatedAt = new Date();
  }

  private loadExchangeRates(): void {
    // Mock exchange rates - in production, this would fetch from a real service
    const rates: ExchangeRate[] = [
      { from: Currency.USD, to: Currency.VND, rate: 24000, updatedAt: new Date(), source: 'mock' },
      { from: Currency.EUR, to: Currency.VND, rate: 26000, updatedAt: new Date(), source: 'mock' },
      { from: Currency.VND, to: Currency.USD, rate: 0.0000417, updatedAt: new Date(), source: 'mock' },
    ];

    rates.forEach(rate => {
      this.exchangeRates.set(`${rate.from}-${rate.to}`, rate);
    });
  }

  // Webhook handling
  async handleWebhook(gateway: PaymentGateway, event: PaymentWebhookEvent): Promise<void> {
    const gatewayInstance = this.gateways.get(gateway);
    if (!gatewayInstance) {
      throw new Error(`Gateway ${gateway} not found`);
    }

    const isValid = await gatewayInstance.verifyWebhook(event);
    if (!isValid) {
      throw new Error('Invalid webhook signature');
    }

    await gatewayInstance.handleWebhook(event);
  }
}
