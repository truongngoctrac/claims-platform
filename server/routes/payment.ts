import { RequestHandler } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../auth';
import { PaymentService } from '../services/payment/PaymentService';
import { FraudDetectionService } from '../services/payment/FraudDetectionService';
import { PaymentAnalyticsService } from '../services/payment/PaymentAnalyticsService';
import { ReconciliationService } from '../services/payment/ReconciliationService';
import {
  PaymentRequestSchema,
  RefundRequestSchema,
  PaymentGateway,
  PaymentMethod,
  Currency,
  PaymentStatus,
  ApiResponse,
} from '../../shared/payment';

// Initialize services
const paymentService = new PaymentService();
const fraudService = new FraudDetectionService();
const analyticsService = new PaymentAnalyticsService();
const reconciliationService = new ReconciliationService();

// 3.2.1 & 3.2.2 Process Payment
export const handleProcessPayment: RequestHandler = async (
  req: AuthRequest,
  res
) => {
  try {
    const validatedRequest = PaymentRequestSchema.parse(req.body);

    // Add client metadata
    const enrichedRequest = {
      ...validatedRequest,
      metadata: {
        ...validatedRequest.metadata,
        clientIP: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id,
      }
    };

    const paymentResponse = await paymentService.processPayment(enrichedRequest);

    const response: ApiResponse<typeof paymentResponse> = {
      success: true,
      data: paymentResponse,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'PAYMENT_FAILED',
        message: error.message,
        details: { error: error.toString() },
      },
    };
    res.status(400).json(response);
  }
};

// 3.2.10 Process Refund
export const handleProcessRefund: RequestHandler = async (
  req: AuthRequest,
  res
) => {
  try {
    const validatedRequest = RefundRequestSchema.parse(req.body);
    const refundResponse = await paymentService.processRefund(validatedRequest);

    const response: ApiResponse<typeof refundResponse> = {
      success: true,
      data: refundResponse,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'REFUND_FAILED',
        message: error.message,
      },
    };
    res.status(400).json(response);
  }
};

// Get Payment Status
export const handleGetPaymentStatus: RequestHandler = async (
  req: AuthRequest,
  res
) => {
  try {
    const { paymentId } = req.params;
    
    if (!paymentId) {
      throw new Error('Payment ID is required');
    }

    // This would typically query the database
    const mockStatus = PaymentStatus.COMPLETED;

    const response: ApiResponse<{ status: PaymentStatus }> = {
      success: true,
      data: { status: mockStatus },
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'STATUS_CHECK_FAILED',
        message: error.message,
      },
    };
    res.status(400).json(response);
  }
};

// 3.2.9 Schedule Payment
export const handleSchedulePayment: RequestHandler = async (
  req: AuthRequest,
  res
) => {
  try {
    const scheduleSchema = z.object({
      claimId: z.string().optional(),
      customerId: z.string(),
      amount: z.number().positive(),
      currency: z.nativeEnum(Currency),
      gateway: z.nativeEnum(PaymentGateway),
      method: z.nativeEnum(PaymentMethod),
      description: z.string(),
      frequency: z.enum(['once', 'daily', 'weekly', 'monthly', 'yearly']),
      startDate: z.string().datetime(),
      endDate: z.string().datetime().optional(),
      maxPayments: z.number().optional(),
      metadata: z.record(z.string()).optional(),
    });

    const validatedRequest = scheduleSchema.parse(req.body);
    
    const schedule = await paymentService.schedulePayment({
      ...validatedRequest,
      startDate: new Date(validatedRequest.startDate),
      endDate: validatedRequest.endDate ? new Date(validatedRequest.endDate) : undefined,
    });

    const response: ApiResponse<typeof schedule> = {
      success: true,
      data: schedule,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'SCHEDULE_FAILED',
        message: error.message,
      },
    };
    res.status(400).json(response);
  }
};

// 3.2.13 Webhook Handler
export const handlePaymentWebhook: RequestHandler = async (req, res) => {
  try {
    const { gateway } = req.params;
    const signature = req.get('X-Signature') || req.get('Stripe-Signature') || '';

    if (!Object.values(PaymentGateway).includes(gateway as PaymentGateway)) {
      throw new Error('Invalid payment gateway');
    }

    const webhookEvent = {
      id: `WEBHOOK_${Date.now()}`,
      type: req.body.type || req.body.event_type,
      gateway: gateway as PaymentGateway,
      paymentId: req.body.data?.object?.id || '',
      data: req.body,
      signature,
      receivedAt: new Date(),
      status: 'pending' as const,
      retryCount: 0,
      maxRetries: 3,
    };

    await paymentService.handleWebhook(gateway as PaymentGateway, webhookEvent);

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook processing failed:', error);
    res.status(400).json({ error: error.message });
  }
};

// 3.2.7 Payment Analytics
export const handleGetPaymentAnalytics: RequestHandler = async (
  req: AuthRequest,
  res
) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      throw new Error('Start date and end date are required');
    }

    const analytics = await analyticsService.generateAnalytics(
      new Date(startDate as string),
      new Date(endDate as string)
    );

    const response: ApiResponse<typeof analytics> = {
      success: true,
      data: analytics,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'ANALYTICS_FAILED',
        message: error.message,
      },
    };
    res.status(400).json(response);
  }
};

// 3.2.7 Generate Payment Report
export const handleGenerateReport: RequestHandler = async (
  req: AuthRequest,
  res
) => {
  try {
    const reportSchema = z.object({
      type: z.enum(['daily', 'weekly', 'monthly', 'custom']),
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
      format: z.enum(['json', 'csv', 'pdf']).default('json'),
    });

    const { type, startDate, endDate, format } = reportSchema.parse(req.body);

    const report = await analyticsService.generateReport(
      type,
      new Date(startDate),
      new Date(endDate),
      format
    );

    const response: ApiResponse<typeof report> = {
      success: true,
      data: report,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'REPORT_GENERATION_FAILED',
        message: error.message,
      },
    };
    res.status(400).json(response);
  }
};

// 3.2.3 Reconciliation
export const handleReconcilePayments: RequestHandler = async (
  req: AuthRequest,
  res
) => {
  try {
    const { date } = req.body;

    if (!date) {
      throw new Error('Date is required for reconciliation');
    }

    const reports = await reconciliationService.reconcileForDate(new Date(date));

    const response: ApiResponse<typeof reports> = {
      success: true,
      data: reports,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'RECONCILIATION_FAILED',
        message: error.message,
      },
    };
    res.status(400).json(response);
  }
};

// Get Reconciliation Reports
export const handleGetReconciliationReports: RequestHandler = async (
  req: AuthRequest,
  res
) => {
  try {
    const { startDate, endDate, gateway } = req.query;

    const reports = await reconciliationService.getReconciliationReports(
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined,
      gateway as PaymentGateway | undefined
    );

    const response: ApiResponse<typeof reports> = {
      success: true,
      data: reports,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'FETCH_REPORTS_FAILED',
        message: error.message,
      },
    };
    res.status(400).json(response);
  }
};

// 3.2.4 Fraud Detection
export const handleCheckFraud: RequestHandler = async (
  req: AuthRequest,
  res
) => {
  try {
    const request = PaymentRequestSchema.parse(req.body);
    const fraudCheck = await fraudService.checkPayment(request);

    const response: ApiResponse<typeof fraudCheck> = {
      success: true,
      data: fraudCheck,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'FRAUD_CHECK_FAILED',
        message: error.message,
      },
    };
    res.status(400).json(response);
  }
};

// Fraud Management - Get Rules
export const handleGetFraudRules: RequestHandler = async (
  req: AuthRequest,
  res
) => {
  try {
    const rules = await fraudService.getRules();

    const response: ApiResponse<typeof rules> = {
      success: true,
      data: rules,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'FETCH_RULES_FAILED',
        message: error.message,
      },
    };
    res.status(400).json(response);
  }
};

// Fraud Management - Update Rule
export const handleUpdateFraudRule: RequestHandler = async (
  req: AuthRequest,
  res
) => {
  try {
    const { ruleId } = req.params;
    const updates = req.body;

    await fraudService.updateRule(ruleId, updates);

    const response: ApiResponse<{ success: boolean }> = {
      success: true,
      data: { success: true },
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'UPDATE_RULE_FAILED',
        message: error.message,
      },
    };
    res.status(400).json(response);
  }
};

// Fraud Management - Blacklist Management
export const handleGetBlacklists: RequestHandler = async (
  req: AuthRequest,
  res
) => {
  try {
    const blacklists = await fraudService.getBlacklists();

    const response: ApiResponse<typeof blacklists> = {
      success: true,
      data: blacklists,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'FETCH_BLACKLISTS_FAILED',
        message: error.message,
      },
    };
    res.status(400).json(response);
  }
};

export const handleManageBlacklist: RequestHandler = async (
  req: AuthRequest,
  res
) => {
  try {
    const { type, action, value } = req.body;

    if (!['ip', 'email', 'device'].includes(type)) {
      throw new Error('Invalid blacklist type');
    }

    if (!['add', 'remove'].includes(action)) {
      throw new Error('Invalid action');
    }

    switch (type) {
      case 'ip':
        if (action === 'add') {
          await fraudService.addBlacklistedIP(value);
        } else {
          await fraudService.removeBlacklistedIP(value);
        }
        break;
      case 'email':
        if (action === 'add') {
          await fraudService.addBlacklistedEmail(value);
        } else {
          await fraudService.removeBlacklistedEmail(value);
        }
        break;
    }

    const response: ApiResponse<{ success: boolean }> = {
      success: true,
      data: { success: true },
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'BLACKLIST_MANAGEMENT_FAILED',
        message: error.message,
      },
    };
    res.status(400).json(response);
  }
};

// 3.2.12 Transaction Monitoring
export const handleGetTransactionMonitoring: RequestHandler = async (
  req: AuthRequest,
  res
) => {
  try {
    // Trigger monitoring check
    await paymentService.monitorTransactions();

    // Get real-time metrics
    const metrics = await analyticsService.getRealtimeMetrics();

    const response: ApiResponse<typeof metrics> = {
      success: true,
      data: metrics,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'MONITORING_FAILED',
        message: error.message,
      },
    };
    res.status(400).json(response);
  }
};

// Get Payment Methods and Gateways Info
export const handleGetPaymentMethods: RequestHandler = async (
  req: AuthRequest,
  res
) => {
  try {
    const methods = Object.values(PaymentMethod);
    const gateways = Object.values(PaymentGateway);
    const currencies = Object.values(Currency);

    const response: ApiResponse<{
      methods: PaymentMethod[];
      gateways: PaymentGateway[];
      currencies: Currency[];
    }> = {
      success: true,
      data: { methods, gateways, currencies },
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'FETCH_METHODS_FAILED',
        message: error.message,
      },
    };
    res.status(400).json(response);
  }
};

// 3.2.8 Exchange Rates
export const handleGetExchangeRates: RequestHandler = async (
  req: AuthRequest,
  res
) => {
  try {
    // Mock exchange rates
    const rates = {
      'USD-VND': 24000,
      'EUR-VND': 26000,
      'VND-USD': 0.0000417,
      'USD-EUR': 0.85,
      'EUR-USD': 1.18,
    };

    const response: ApiResponse<typeof rates> = {
      success: true,
      data: rates,
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: {
        code: 'FETCH_RATES_FAILED',
        message: error.message,
      },
    };
    res.status(400).json(response);
  }
};

// Health Check for Payment System
export const handlePaymentHealthCheck: RequestHandler = async (
  req: AuthRequest,
  res
) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      gateways: {
        stripe: 'operational',
        vnpay: 'operational',
        paypal: 'operational',
      },
      services: {
        fraud_detection: 'operational',
        analytics: 'operational',
        reconciliation: 'operational',
      },
    };

    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
    });
  }
};
