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

export class VNPayGateway extends PaymentGatewayBase {
  private apiBaseUrl: string;
  private version = '2.1.0';

  constructor(config: any) {
    super(config);
    this.apiBaseUrl = config.environment === 'production' 
      ? 'https://pay.vnpay.vn' 
      : 'https://sandbox.vnpayment.vn';
  }

  async processPayment(request: PaymentRequest): Promise<PaymentResponse> {
    this.validateRequest(request);

    try {
      const fees = this.calculateFees(request.amount);
      const transactionId = this.generateTransactionId();

      // Create VNPay payment URL
      const paymentUrl = await this.createPaymentUrl(request, transactionId);

      return {
        id: transactionId,
        status: PaymentStatus.PENDING,
        amount: request.amount,
        currency: request.currency,
        gateway: PaymentGateway.VNPAY,
        method: request.method,
        transactionId,
        gatewayTransactionId: transactionId,
        redirectUrl: paymentUrl,
        fees,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes for VNPay
        metadata: request.metadata,
      };
    } catch (error) {
      throw new Error(`VNPay payment processing failed: ${error.message}`);
    }
  }

  async processRefund(request: RefundRequest): Promise<RefundResponse> {
    try {
      const refundId = `REFUND_${Date.now()}`;
      
      // VNPay refund API call
      const refundData = await this.createRefund(request, refundId);

      return {
        id: refundId,
        paymentId: request.paymentId,
        amount: request.amount || 0,
        currency: Currency.VND,
        status: PaymentStatus.PROCESSING,
        reason: request.reason,
        gatewayRefundId: refundData.vnp_TransactionNo,
        fees: {
          gateway: 1000, // VNPay refund fee
          platform: 0,
          total: 1000,
        },
        createdAt: new Date(),
        metadata: request.metadata,
      };
    } catch (error) {
      throw new Error(`VNPay refund processing failed: ${error.message}`);
    }
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    try {
      // Query VNPay transaction status
      const statusData = await this.queryTransaction(paymentId);
      
      return this.mapVNPayStatus(statusData.vnp_TransactionStatus);
    } catch (error) {
      throw new Error(`Failed to get VNPay payment status: ${error.message}`);
    }
  }

  async verifyWebhook(event: PaymentWebhookEvent): Promise<boolean> {
    try {
      const { data } = event;
      const signature = data.vnp_SecureHash;
      
      // Remove signature from data for verification
      const verifyData = { ...data };
      delete verifyData.vnp_SecureHash;
      delete verifyData.vnp_SecureHashType;

      // Create query string for signature verification
      const queryString = this.createQueryString(verifyData);
      const expectedSignature = this.createSignature(queryString);

      return signature === expectedSignature;
    } catch (error) {
      return false;
    }
  }

  async handleWebhook(event: PaymentWebhookEvent): Promise<void> {
    const { data } = event;
    const { vnp_ResponseCode, vnp_TransactionStatus, vnp_TxnRef } = data;

    if (vnp_ResponseCode === '00' && vnp_TransactionStatus === '00') {
      await this.handlePaymentSuccess(data);
    } else {
      await this.handlePaymentFailure(data);
    }
  }

  // Private helper methods
  private async createPaymentUrl(request: PaymentRequest, transactionId: string): Promise<string> {
    const vnpParams: Record<string, string> = {
      vnp_Version: this.version,
      vnp_Command: 'pay',
      vnp_TmnCode: this.config.apiKey,
      vnp_Amount: (request.amount * 100).toString(), // VNPay uses xu (1/100 VND)
      vnp_CreateDate: this.formatDate(new Date()),
      vnp_CurrCode: 'VND',
      vnp_IpAddr: '127.0.0.1', // Should be actual client IP
      vnp_Locale: 'vn',
      vnp_OrderInfo: request.description,
      vnp_OrderType: 'billpayment',
      vnp_ReturnUrl: request.returnUrl || 'https://example.com/return',
      vnp_TxnRef: transactionId,
      vnp_ExpireDate: this.formatDate(new Date(Date.now() + 15 * 60 * 1000)),
    };

    // Add bank code for specific payment methods
    if (request.method === PaymentMethod.BANK_TRANSFER) {
      vnpParams.vnp_BankCode = 'VNBANK';
    } else if (request.method === PaymentMethod.E_WALLET) {
      vnpParams.vnp_BankCode = 'VNPAYQR';
    }

    // Create signature
    const queryString = this.createQueryString(vnpParams);
    const signature = this.createSignature(queryString);
    vnpParams.vnp_SecureHash = signature;

    // Build payment URL
    const finalQueryString = this.createQueryString(vnpParams);
    return `${this.apiBaseUrl}/paymentv2/vpcpay.html?${finalQueryString}`;
  }

  private async createRefund(request: RefundRequest, refundId: string): Promise<any> {
    // Mock VNPay refund API call
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const refundParams = {
      vnp_RequestId: refundId,
      vnp_Version: this.version,
      vnp_Command: 'refund',
      vnp_TmnCode: this.config.apiKey,
      vnp_TransactionType: '02',
      vnp_TxnRef: request.paymentId,
      vnp_Amount: request.amount ? (request.amount * 100).toString() : '0',
      vnp_OrderInfo: request.reason,
      vnp_TransactionNo: `${Date.now()}`,
      vnp_TransactionDate: this.formatDate(new Date()),
      vnp_CreateDate: this.formatDate(new Date()),
      vnp_CreateBy: 'system',
      vnp_IpAddr: '127.0.0.1',
    };

    return {
      vnp_ResponseCode: '00',
      vnp_Message: 'Confirm Success',
      vnp_TransactionNo: refundParams.vnp_TransactionNo,
    };
  }

  private async queryTransaction(transactionId: string): Promise<any> {
    // Mock VNPay query API call
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      vnp_ResponseCode: '00',
      vnp_Message: 'Confirm Success',
      vnp_TransactionStatus: '00',
      vnp_TxnRef: transactionId,
      vnp_Amount: '1000000',
      vnp_PayDate: this.formatDate(new Date()),
    };
  }

  private mapVNPayStatus(vnpStatus: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      '00': PaymentStatus.COMPLETED,
      '01': PaymentStatus.PENDING,
      '02': PaymentStatus.PROCESSING,
      '04': PaymentStatus.FAILED,
      '05': PaymentStatus.FAILED,
      '06': PaymentStatus.FAILED,
      '07': PaymentStatus.FAILED,
      '09': PaymentStatus.CANCELLED,
    };

    return statusMap[vnpStatus] || PaymentStatus.FAILED;
  }

  private createQueryString(params: Record<string, string>): string {
    return Object.keys(params)
      .sort()
      .map(key => `${key}=${encodeURIComponent(params[key])}`)
      .join('&');
  }

  private createSignature(queryString: string): string {
    return crypto
      .createHmac('sha512', this.config.secretKey)
      .update(queryString, 'utf8')
      .digest('hex');
  }

  private formatDate(date: Date): string {
    return date.toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, '');
  }

  private async handlePaymentSuccess(data: any): Promise<void> {
    console.log('VNPay payment succeeded:', data.vnp_TxnRef);
    // Update payment status in database
    // Send notification to customer
    // Update claim status if applicable
  }

  private async handlePaymentFailure(data: any): Promise<void> {
    console.log('VNPay payment failed:', data.vnp_TxnRef);
    // Update payment status in database
    // Send notification to customer
    // Log failure reason
  }
}
