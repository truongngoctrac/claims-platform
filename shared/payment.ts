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

// Payment Details Interface
export interface PaymentDetails {
  id: string;
  claimId?: string;
  customerId: string;
  amount: number;
  currency: Currency;
  status: PaymentStatus;
  gateway: PaymentGateway;
  method: PaymentMethod;
  description: string;
  transactionId: string;
  gatewayTransactionId?: string;
  parentTransactionId?: string; // For refunds, chargebacks
  fees: {
    gateway: number;
    platform: number;
    processing: number;
    total: number;
  };
  splitPayments?: PaymentSplit[];
  fraudCheck?: FraudCheckResult;
  compliance: {
    level: ComplianceLevel;
    verified: boolean;
    verifiedAt?: Date;
  };
  riskAssessment: {
    level: RiskLevel;
    score: number;
    factors: FraudRiskFactors;
  };
  timeline: PaymentEvent[];
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  metadata?: Record<string, string>;
}

// Payment Split Interface
export interface PaymentSplit {
  id: string;
  recipient: string;
  amount: number;
  currency: Currency;
  percentage?: number;
  description: string;
  status: PaymentStatus;
  gatewayTransactionId?: string;
}

// Fraud Check Result Interface
export interface FraudCheckResult {
  id: string;
  paymentId: string;
  riskScore: number;
  riskLevel: RiskLevel;
  factors: FraudRiskFactors;
  rules: FraudRule[];
  recommendations: string[];
  action: 'approve' | 'review' | 'decline';
  confidence: number;
  checkedAt: Date;
}

// Fraud Rule Interface
export interface FraudRule {
  id: string;
  name: string;
  description: string;
  triggered: boolean;
  score: number;
  severity: RiskLevel;
  details?: Record<string, any>;
}

// Payment Event Interface
export interface PaymentEvent {
  id: string;
  type: string;
  status: PaymentStatus;
  message: string;
  data?: Record<string, any>;
  createdAt: Date;
}

// Refund Request Schema
export const RefundRequestSchema = z.object({
  paymentId: z.string(),
  amount: z.number().positive().optional(),
  reason: z.string(),
  metadata: z.record(z.string()).optional(),
});

export type RefundRequest = z.infer<typeof RefundRequestSchema>;

// Refund Response Interface
export interface RefundResponse {
  id: string;
  paymentId: string;
  amount: number;
  currency: Currency;
  status: PaymentStatus;
  reason: string;
  gatewayRefundId?: string;
  estimatedAt?: Date;
  completedAt?: Date;
  fees: {
    gateway: number;
    platform: number;
    total: number;
  };
  createdAt: Date;
  metadata?: Record<string, string>;
}

// Chargeback Interface
export interface Chargeback {
  id: string;
  paymentId: string;
  amount: number;
  currency: Currency;
  reason: string;
  reasonCode: string;
  status: 'received' | 'disputed' | 'accepted' | 'won' | 'lost';
  dueDate: Date;
  evidence?: ChargebackEvidence[];
  timeline: ChargebackEvent[];
  createdAt: Date;
  updatedAt: Date;
}

// Chargeback Evidence Interface
export interface ChargebackEvidence {
  id: string;
  type: string;
  description: string;
  fileUrl?: string;
  uploadedAt: Date;
}

// Chargeback Event Interface
export interface ChargebackEvent {
  id: string;
  type: string;
  status: string;
  message: string;
  createdAt: Date;
}

// Payment Analytics Interface
export interface PaymentAnalytics {
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalPayments: number;
    totalAmount: number;
    totalFees: number;
    totalRefunds: number;
    totalChargebacks: number;
    successRate: number;
    averageAmount: number;
    averageProcessingTime: number;
  };
  byGateway: Record<PaymentGateway, {
    count: number;
    amount: number;
    fees: number;
    successRate: number;
  }>;
  byMethod: Record<PaymentMethod, {
    count: number;
    amount: number;
    successRate: number;
  }>;
  byCurrency: Record<Currency, {
    count: number;
    amount: number;
  }>;
  trends: {
    daily: Array<{
      date: string;
      payments: number;
      amount: number;
      successRate: number;
    }>;
    hourly: Array<{
      hour: number;
      payments: number;
      amount: number;
    }>;
  };
  topFailureReasons: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
}

// Payment Webhook Event Interface
export interface PaymentWebhookEvent {
  id: string;
  type: string;
  gateway: PaymentGateway;
  paymentId: string;
  data: Record<string, any>;
  signature: string;
  receivedAt: Date;
  processedAt?: Date;
  status: 'pending' | 'processed' | 'failed';
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date;
}

// Payment Schedule Interface
export interface PaymentSchedule {
  id: string;
  claimId?: string;
  customerId: string;
  amount: number;
  currency: Currency;
  gateway: PaymentGateway;
  method: PaymentMethod;
  description: string;
  frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate: Date;
  endDate?: Date;
  maxPayments?: number;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  lastPaymentAt?: Date;
  nextPaymentAt?: Date;
  paymentCount: number;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, string>;
}

// Multi-currency Exchange Rate Interface
export interface ExchangeRate {
  from: Currency;
  to: Currency;
  rate: number;
  updatedAt: Date;
  source: string;
}

// Payment Report Interface
export interface PaymentReport {
  id: string;
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  period: {
    start: Date;
    end: Date;
  };
  data: PaymentAnalytics;
  generatedAt: Date;
  generatedBy: string;
  format: 'json' | 'csv' | 'pdf';
  downloadUrl?: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

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
