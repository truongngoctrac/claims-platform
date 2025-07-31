import { z } from 'zod';

// Payment Gateway Types
export enum PaymentGateway {
  STRIPE = 'stripe',
  PAYPAL = 'paypal',
  VNPAY = 'vnpay',
  MOMO = 'momo',
  ZALOPAY = 'zalopay',
}

// Payment Method Types
export enum PaymentMethod {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  BANK_TRANSFER = 'bank_transfer',
  E_WALLET = 'e_wallet',
  QR_CODE = 'qr_code',
  CRYPTOCURRENCY = 'cryptocurrency',
}

// Payment Status Types
export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
  DISPUTED = 'disputed',
  CHARGEBACK = 'chargeback',
}

// Transaction Types
export enum TransactionType {
  PAYMENT = 'payment',
  REFUND = 'refund',
  CHARGEBACK = 'chargeback',
  FEE = 'fee',
  SPLIT = 'split',
  TOPUP = 'topup',
}

// Currency Types
export enum Currency {
  VND = 'VND',
  USD = 'USD',
  EUR = 'EUR',
  SGD = 'SGD',
  THB = 'THB',
}

// Compliance Types
export enum ComplianceLevel {
  PCI_DSS_LEVEL_1 = 'pci_dss_level_1',
  PCI_DSS_LEVEL_2 = 'pci_dss_level_2',
  GDPR_COMPLIANT = 'gdpr_compliant',
  SOX_COMPLIANT = 'sox_compliant',
}

// Risk Level Types
export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Fraud Detection Types
export interface FraudRiskFactors {
  ipRisk: number;
  deviceRisk: number;
  behaviorRisk: number;
  locationRisk: number;
  velocityRisk: number;
  overallRisk: number;
}

// Payment Gateway Configuration
export interface PaymentGatewayConfig {
  gateway: PaymentGateway;
  enabled: boolean;
  apiKey: string;
  secretKey: string;
  webhookSecret: string;
  environment: 'sandbox' | 'production';
  supportedMethods: PaymentMethod[];
  supportedCurrencies: Currency[];
  fees: {
    percentage: number;
    fixed: number;
    currency: Currency;
  };
  limits: {
    minAmount: number;
    maxAmount: number;
    dailyLimit: number;
    monthlyLimit: number;
  };
  features: {
    refunds: boolean;
    partialRefunds: boolean;
    subscriptions: boolean;
    paymentSplitting: boolean;
    fraudDetection: boolean;
  };
}

// Payment Request Schema
export const PaymentRequestSchema = z.object({
  amount: z.number().positive(),
  currency: z.nativeEnum(Currency),
  gateway: z.nativeEnum(PaymentGateway),
  method: z.nativeEnum(PaymentMethod),
  description: z.string(),
  claimId: z.string().optional(),
  customerId: z.string(),
  metadata: z.record(z.string()).optional(),
  returnUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  webhookUrl: z.string().url().optional(),
});

export type PaymentRequest = z.infer<typeof PaymentRequestSchema>;

// Payment Response Interface
export interface PaymentResponse {
  id: string;
  status: PaymentStatus;
  amount: number;
  currency: Currency;
  gateway: PaymentGateway;
  method: PaymentMethod;
  transactionId?: string;
  gatewayTransactionId?: string;
  redirectUrl?: string;
  qrCode?: string;
  deepLink?: string;
  fees: {
    gateway: number;
    platform: number;
    total: number;
  };
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, string>;
}

// Additional interfaces... (truncated for brevity, but would include all from original file)

// Validation helper functions
export const validatePaymentAmount = (amount: number, currency: Currency): boolean => {
  const minimums: Record<Currency, number> = {
    [Currency.VND]: 1000,
    [Currency.USD]: 0.5,
    [Currency.EUR]: 0.5,
    [Currency.SGD]: 0.5,
    [Currency.THB]: 15,
  };
  
  return amount >= minimums[currency];
};

export const formatCurrency = (amount: number, currency: Currency): string => {
  const formatter = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: currency === Currency.VND ? 0 : 2,
  });
  
  return formatter.format(amount);
};

export const calculateFees = (amount: number, gatewayConfig: PaymentGatewayConfig): number => {
  const percentageFee = amount * (gatewayConfig.fees.percentage / 100);
  const fixedFee = gatewayConfig.fees.fixed;
  return percentageFee + fixedFee;
};
