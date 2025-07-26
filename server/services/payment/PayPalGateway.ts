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

export class PayPalGateway extends PaymentGatewayBase {
  private apiBaseUrl: string;
  private accessToken?: string;
  private tokenExpiryTime?: number;

  constructor(config: any) {
    super(config);
    this.apiBaseUrl = config.environment === 'production' 
      ? 'https://api.paypal.com' 
      : 'https://api.sandbox.paypal.com';
  }

  async processPayment(request: PaymentRequest): Promise<PaymentResponse> {
    this.validateRequest(request);

    try {
      await this.ensureAccessToken();
      
      const fees = this.calculateFees(request.amount);
      const transactionId = this.generateTransactionId();

      // Create PayPal order
      const order = await this.createOrder(request, transactionId);

      return {
        id: transactionId,
        status: PaymentStatus.PENDING,
        amount: request.amount,
        currency: request.currency,
        gateway: PaymentGateway.PAYPAL,
        method: request.method,
        transactionId,
        gatewayTransactionId: order.id,
        redirectUrl: order.links.find((link: any) => link.rel === 'approve')?.href,
        fees,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours for PayPal
        metadata: request.metadata,
      };
    } catch (error) {
      throw new Error(`PayPal payment processing failed: ${error.message}`);
    }
  }

  async processRefund(request: RefundRequest): Promise<RefundResponse> {
    try {
      await this.ensureAccessToken();
      
      const refundId = `REFUND_${Date.now()}`;
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
          gateway: 0, // PayPal doesn't charge for refunds within 180 days
          platform: 0,
          total: 0,
        },
        createdAt: new Date(),
        metadata: request.metadata,
      };
    } catch (error) {
      throw new Error(`PayPal refund processing failed: ${error.message}`);
    }
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    try {
      await this.ensureAccessToken();
      
      const order = await this.getOrder(paymentId);
      return this.mapPayPalStatus(order.status);
    } catch (error) {
      throw new Error(`Failed to get PayPal payment status: ${error.message}`);
    }
  }

  async verifyWebhook(event: PaymentWebhookEvent): Promise<boolean> {
    try {
      // PayPal webhook verification involves calling their verification endpoint
      const verificationData = {
        auth_algo: event.data.auth_algo,
        cert_id: event.data.cert_id,
        transmission_id: event.data.transmission_id,
        transmission_sig: event.signature,
        transmission_time: event.data.transmission_time,
        webhook_id: this.config.webhookSecret,
        webhook_event: event.data,
      };

      const isValid = await this.verifyWebhookWithPayPal(verificationData);
      return isValid;
    } catch (error) {
      return false;
    }
  }

  async handleWebhook(event: PaymentWebhookEvent): Promise<void> {
    const { type, data } = event;

    switch (type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        await this.handlePaymentSuccess(data);
        break;
      case 'PAYMENT.CAPTURE.DENIED':
        await this.handlePaymentFailure(data);
        break;
      case 'CUSTOMER.DISPUTE.CREATED':
        await this.handleChargeback(data);
        break;
      case 'BILLING.SUBSCRIPTION.PAYMENT.COMPLETED':
        await this.handleSubscriptionPayment(data);
        break;
      default:
        console.log(`Unhandled PayPal webhook event: ${type}`);
    }
  }

  // Private helper methods
  private async ensureAccessToken(): Promise<void> {
    if (this.accessToken && this.tokenExpiryTime && Date.now() < this.tokenExpiryTime) {
      return;
    }

    const tokenData = await this.getAccessToken();
    this.accessToken = tokenData.access_token;
    this.tokenExpiryTime = Date.now() + (tokenData.expires_in * 1000) - 60000; // 1 min buffer
  }

  private async getAccessToken(): Promise<any> {
    // Mock PayPal OAuth token request
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      access_token: `A21AAL_${Math.random().toString(36).substr(2, 50)}`,
      token_type: 'Bearer',
      expires_in: 32400, // 9 hours
    };
  }

  private async createOrder(request: PaymentRequest, transactionId: string): Promise<any> {
    // Mock PayPal order creation
    await new Promise(resolve => setTimeout(resolve, 150));
    
    const orderId = `${Math.random().toString(36).substr(2, 17).toUpperCase()}`;
    
    return {
      id: orderId,
      status: 'CREATED',
      links: [
        {
          href: `https://www.sandbox.paypal.com/checkoutnow?token=${orderId}`,
          rel: 'approve',
          method: 'GET'
        },
        {
          href: `${this.apiBaseUrl}/v2/checkout/orders/${orderId}`,
          rel: 'self',
          method: 'GET'
        },
        {
          href: `${this.apiBaseUrl}/v2/checkout/orders/${orderId}/capture`,
          rel: 'capture',
          method: 'POST'
        }
      ]
    };
  }

  private async createRefund(request: RefundRequest): Promise<any> {
    // Mock PayPal refund creation
    await new Promise(resolve => setTimeout(resolve, 200));
    
    return {
      id: `${Math.random().toString(36).substr(2, 17).toUpperCase()}`,
      status: 'COMPLETED',
      amount: {
        value: request.amount?.toString() || '0.00',
        currency_code: 'USD'
      }
    };
  }

  private async getOrder(orderId: string): Promise<any> {
    // Mock PayPal order retrieval
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      id: orderId,
      status: 'COMPLETED',
      purchase_units: [
        {
          amount: {
            value: '100.00',
            currency_code: 'USD'
          }
        }
      ]
    };
  }

  private async verifyWebhookWithPayPal(verificationData: any): Promise<boolean> {
    // Mock PayPal webhook verification
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return true; // In real implementation, this would call PayPal's verification endpoint
  }

  private mapPayPalStatus(paypalStatus: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      'CREATED': PaymentStatus.PENDING,
      'SAVED': PaymentStatus.PENDING,
      'APPROVED': PaymentStatus.PROCESSING,
      'VOIDED': PaymentStatus.CANCELLED,
      'COMPLETED': PaymentStatus.COMPLETED,
      'PAYER_ACTION_REQUIRED': PaymentStatus.PENDING,
    };

    return statusMap[paypalStatus] || PaymentStatus.FAILED;
  }

  private async handlePaymentSuccess(data: any): Promise<void> {
    console.log('PayPal payment succeeded:', data.id);
    // Update payment status in database
    // Send notification to customer
    // Update claim status if applicable
  }

  private async handlePaymentFailure(data: any): Promise<void> {
    console.log('PayPal payment failed:', data.id);
    // Update payment status in database
    // Send notification to customer
    // Log failure reason
  }

  private async handleChargeback(data: any): Promise<void> {
    console.log('PayPal dispute created:', data.dispute_id);
    // Create chargeback record
    // Notify finance team
    // Update payment status
  }

  private async handleSubscriptionPayment(data: any): Promise<void> {
    console.log('PayPal subscription payment completed:', data.id);
    // Update subscription status
    // Send receipt to customer
  }
}
