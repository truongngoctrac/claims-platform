import {
  PaymentGateway,
  PaymentMethod,
  PaymentStatus,
  Currency,
  PaymentRequest,
  PaymentResponse,
  RefundRequest,
  RefundResponse,
  PaymentWebhookEvent,
} from '../../../shared/payment';
import { PaymentGatewayBase } from './PaymentGatewayBase';
import crypto from 'crypto';

export class StripeGateway extends PaymentGatewayBase {
  private apiBaseUrl: string;

  constructor(config: any) {
    super(config);
    this.apiBaseUrl = config.environment === 'production' 
      ? 'https://api.stripe.com/v1' 
      : 'https://api.stripe.com/v1'; // Stripe uses same URL for both
  }

  async processPayment(request: PaymentRequest): Promise<PaymentResponse> {
    this.validateRequest(request);

    try {
      const fees = this.calculateFees(request.amount);
      const transactionId = this.generateTransactionId();

      // Mock Stripe Payment Intent creation
      const paymentIntent = await this.createPaymentIntent(request);

      return {
        id: transactionId,
        status: PaymentStatus.PENDING,
        amount: request.amount,
        currency: request.currency,
        gateway: PaymentGateway.STRIPE,
        method: request.method,
        transactionId,
        gatewayTransactionId: paymentIntent.id,
        redirectUrl: paymentIntent.next_action?.redirect_to_url?.url,
        fees,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
        metadata: request.metadata,
      };
    } catch (error) {
      throw new Error(`Stripe payment processing failed: ${error.message}`);
    }
  }

  async processRefund(request: RefundRequest): Promise<RefundResponse> {
    try {
      const refundId = `re_${Math.random().toString(36).substr(2, 24)}`;
      
      // Mock Stripe refund creation
      const refund = await this.createRefund(request);

      return {
        id: refundId,
        paymentId: request.paymentId,
        amount: request.amount || 0,
        currency: Currency.USD, // Would be retrieved from original payment
        status: PaymentStatus.PROCESSING,
        reason: request.reason,
        gatewayRefundId: refund.id,
        fees: {
          gateway: 0, // Stripe doesn't charge for refunds
          platform: 0,
          total: 0,
        },
        createdAt: new Date(),
        metadata: request.metadata,
      };
    } catch (error) {
      throw new Error(`Stripe refund processing failed: ${error.message}`);
    }
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    try {
      // Mock Stripe payment intent retrieval
      const paymentIntent = await this.retrievePaymentIntent(paymentId);
      
      return this.mapStripeStatus(paymentIntent.status);
    } catch (error) {
      throw new Error(`Failed to get Stripe payment status: ${error.message}`);
    }
  }

  async verifyWebhook(event: PaymentWebhookEvent): Promise<boolean> {
    try {
      const signature = event.signature;
      const payload = JSON.stringify(event.data);
      
      const expectedSignature = crypto
        .createHmac('sha256', this.config.webhookSecret)
        .update(payload, 'utf8')
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      return false;
    }
  }

  async handleWebhook(event: PaymentWebhookEvent): Promise<void> {
    const { type, data } = event;

    switch (type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(data);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailure(data);
        break;
      case 'charge.dispute.created':
        await this.handleChargeback(data);
        break;
      case 'invoice.payment_succeeded':
        await this.handleSubscriptionPayment(data);
        break;
      default:
        console.log(`Unhandled Stripe webhook event: ${type}`);
    }
  }

  // Private helper methods
  private async createPaymentIntent(request: PaymentRequest): Promise<any> {
    // Mock Stripe API call
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      id: `pi_${Math.random().toString(36).substr(2, 24)}`,
      amount: request.amount * 100, // Stripe uses cents
      currency: request.currency.toLowerCase(),
      status: 'requires_payment_method',
      client_secret: `pi_${Math.random().toString(36).substr(2, 24)}_secret_${Math.random().toString(36).substr(2, 16)}`,
      next_action: {
        type: 'redirect_to_url',
        redirect_to_url: {
          url: `https://checkout.stripe.com/pay/${Math.random().toString(36).substr(2, 24)}`,
          return_url: request.returnUrl
        }
      }
    };
  }

  private async createRefund(request: RefundRequest): Promise<any> {
    // Mock Stripe refund API call
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      id: `re_${Math.random().toString(36).substr(2, 24)}`,
      amount: request.amount ? request.amount * 100 : undefined,
      status: 'pending',
      charge: request.paymentId,
      reason: request.reason,
    };
  }

  private async retrievePaymentIntent(paymentId: string): Promise<any> {
    // Mock Stripe API call
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return {
      id: paymentId,
      status: 'succeeded',
      amount: 10000,
      currency: 'usd',
    };
  }

  private mapStripeStatus(stripeStatus: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      'requires_payment_method': PaymentStatus.PENDING,
      'requires_confirmation': PaymentStatus.PENDING,
      'requires_action': PaymentStatus.PENDING,
      'processing': PaymentStatus.PROCESSING,
      'requires_capture': PaymentStatus.PROCESSING,
      'succeeded': PaymentStatus.COMPLETED,
      'canceled': PaymentStatus.CANCELLED,
    };

    return statusMap[stripeStatus] || PaymentStatus.FAILED;
  }

  private async handlePaymentSuccess(data: any): Promise<void> {
    console.log('Stripe payment succeeded:', data.id);
    // Update payment status in database
    // Send notification to customer
    // Update claim status if applicable
  }

  private async handlePaymentFailure(data: any): Promise<void> {
    console.log('Stripe payment failed:', data.id);
    // Update payment status in database
    // Send notification to customer
    // Log failure reason
  }

  private async handleChargeback(data: any): Promise<void> {
    console.log('Stripe chargeback created:', data.id);
    // Create chargeback record
    // Notify finance team
    // Update payment status
  }

  private async handleSubscriptionPayment(data: any): Promise<void> {
    console.log('Stripe subscription payment succeeded:', data.subscription);
    // Update subscription status
    // Send receipt to customer
  }
}
