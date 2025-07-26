import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

// Sentry configuration for Vietnamese Healthcare Claims System
export const initSentry = () => {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_ENVIRONMENT || 'development',
    release: import.meta.env.VITE_APP_VERSION || '1.0.0',
    
    // Performance monitoring
    integrations: [
      new BrowserTracing({
        // Capture interactions and navigation
        tracePropagationTargets: [
          'localhost',
          /^https:\/\/api\.healthcare-claims\.vn/,
          /^https:\/\/staging\.healthcare-claims\.vn/
        ],
        routingInstrumentation: Sentry.reactRouterV6Instrumentation(
          React.useEffect,
          useLocation,
          useNavigationType,
          createRoutesFromChildren,
          matchRoutes
        )
      })
    ],
    
    // Performance monitoring sample rate
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    
    // Session replay for debugging (healthcare data privacy compliant)
    replaysSessionSampleRate: 0.0, // Disabled for healthcare data privacy
    replaysOnErrorSampleRate: 0.0, // Disabled for healthcare data privacy
    
    // Error filtering
    beforeSend(event, hint) {
      // Filter out sensitive healthcare data
      if (event.exception) {
        const error = hint.originalException;
        
        // Don't send errors containing potential PII/PHI
        if (error && typeof error === 'object' && 'message' in error) {
          const message = (error as Error).message.toLowerCase();
          if (
            message.includes('patient') ||
            message.includes('medical') ||
            message.includes('ssn') ||
            message.includes('passport') ||
            message.includes('phone') ||
            message.includes('email') ||
            message.includes('address')
          ) {
            // Sanitize the message
            event.exception!.values![0].value = 'Healthcare data processing error (sanitized)';
          }
        }
      }
      
      // Filter out known non-critical errors
      if (event.exception?.values?.[0]?.type === 'ChunkLoadError') {
        return null; // Don't send chunk load errors
      }
      
      // In development, log to console instead
      if (import.meta.env.DEV) {
        console.error('Sentry Event:', event);
        return null;
      }
      
      return event;
    },
    
    // Custom tags for healthcare context
    initialScope: {
      tags: {
        component: 'frontend',
        healthcare_system: 'vietnamese_claims',
        compliance: 'gdpr_hipaa'
      }
    }
  });
};

// Healthcare-specific error reporting utilities
export const reportHealthcareError = (
  error: Error,
  context: {
    userId?: string;
    sessionId?: string;
    feature?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    additionalData?: Record<string, any>;
  }
) => {
  Sentry.withScope((scope) => {
    // Set user context (without PII)
    if (context.userId) {
      scope.setUser({
        id: context.userId, // Use anonymized user ID
      });
    }
    
    // Set session context
    if (context.sessionId) {
      scope.setTag('session_id', context.sessionId);
    }
    
    // Set feature context
    if (context.feature) {
      scope.setTag('feature', context.feature);
    }
    
    // Set severity level
    if (context.severity) {
      scope.setLevel(context.severity === 'critical' ? 'fatal' : context.severity);
    }
    
    // Add additional context (sanitized)
    if (context.additionalData) {
      const sanitizedData = sanitizeHealthcareData(context.additionalData);
      scope.setContext('additional_data', sanitizedData);
    }
    
    // Add healthcare-specific tags
    scope.setTag('error_category', 'healthcare_processing');
    scope.setTag('compliance_status', 'gdpr_compliant');
    
    Sentry.captureException(error);
  });
};

// Performance monitoring for critical healthcare operations
export const measureHealthcareOperation = <T>(
  operationName: string,
  operation: () => Promise<T>,
  context?: {
    feature?: string;
    userId?: string;
    criticalOperation?: boolean;
  }
): Promise<T> => {
  return Sentry.startSpan(
    {
      name: operationName,
      op: 'healthcare.operation',
      data: {
        feature: context?.feature,
        critical: context?.criticalOperation || false
      }
    },
    async (span) => {
      try {
        const result = await operation();
        span.setStatus({ code: 2, message: 'ok' }); // Success
        return result;
      } catch (error) {
        span.setStatus({ code: 1, message: 'error' }); // Error
        
        // Report healthcare-specific error
        if (error instanceof Error) {
          reportHealthcareError(error, {
            userId: context?.userId,
            feature: context?.feature,
            severity: context?.criticalOperation ? 'critical' : 'medium',
            additionalData: { operation: operationName }
          });
        }
        
        throw error;
      }
    }
  );
};

// Sanitize healthcare data to prevent PII/PHI exposure
const sanitizeHealthcareData = (data: Record<string, any>): Record<string, any> => {
  const sensitiveKeys = [
    'patient_id', 'patient_name', 'patient_phone', 'patient_email',
    'medical_record', 'diagnosis', 'treatment', 'medication',
    'ssn', 'passport', 'national_id', 'insurance_number',
    'address', 'full_name', 'birth_date', 'phone', 'email'
  ];
  
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(data)) {
    const keyLower = key.toLowerCase();
    
    if (sensitiveKeys.some(sensitive => keyLower.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeHealthcareData(value as Record<string, any>);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};

// User feedback for healthcare errors
export const showHealthcareFeedbackDialog = (eventId: string) => {
  Sentry.showReportDialog({
    eventId,
    title: 'Báo cáo lỗi hệ thống y tế', // Vietnamese: Healthcare System Error Report
    subtitle: 'Vui lòng mô tả vấn đề bạn gặp phải', // Please describe the issue you encountered
    subtitle2: 'Thông tin y tế của bạn được bảo mật', // Your medical information is protected
    labelName: 'Họ và tên', // Full name
    labelEmail: 'Email',
    labelComments: 'Mô tả vấn đề', // Describe the issue
    labelClose: 'Đóng', // Close
    labelSubmit: 'Gửi báo cáo', // Send report
    errorGeneric: 'Đã xảy ra lỗi khi gửi báo cáo. Vui lòng thử lại.', // Error occurred while sending report
    errorFormEntry: 'Vui lòng điền đầy đủ thông tin.', // Please fill in all information
    successMessage: 'Cảm ơn bạn đã báo cáo! Chúng tôi sẽ xem xét và khắc phục sớm nhất.' // Thank you for reporting!
  });
};

// Healthcare compliance monitoring
export const trackComplianceEvent = (
  event: string,
  data: {
    userId?: string;
    feature: string;
    complianceType: 'gdpr' | 'hipaa' | 'vietnamese_law';
    action: 'access' | 'modify' | 'delete' | 'export' | 'audit';
    resource?: string;
  }
) => {
  Sentry.addBreadcrumb({
    message: `Compliance event: ${event}`,
    category: 'healthcare.compliance',
    level: 'info',
    data: {
      feature: data.feature,
      compliance_type: data.complianceType,
      action: data.action,
      resource: data.resource,
      timestamp: new Date().toISOString(),
      user_id: data.userId
    }
  });
};

// Export error boundary for React components
export const HealthcareErrorBoundary = Sentry.withErrorBoundary;

// Custom hook for healthcare error handling
export const useHealthcareErrorHandler = () => {
  return {
    reportError: reportHealthcareError,
    measureOperation: measureHealthcareOperation,
    trackCompliance: trackComplianceEvent,
    showFeedback: showHealthcareFeedbackDialog
  };
};
