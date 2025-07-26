import { 
  IntegrationConfig, 
  SMSConfig, 
  EmailConfig, 
  CloudStorageConfig,
  OCRConfig,
  MapsConfig,
  IdentityVerificationConfig,
  PaymentGatewayConfig,
  HospitalDatabaseConfig,
  GovernmentAPIConfig,
  RateLimitConfig,
  RetryConfig
} from '../types';

export class IntegrationConfigManager {
  private static instance: IntegrationConfigManager;
  private configs: Map<string, IntegrationConfig> = new Map();

  private constructor() {
    this.loadConfigurations();
  }

  public static getInstance(): IntegrationConfigManager {
    if (!IntegrationConfigManager.instance) {
      IntegrationConfigManager.instance = new IntegrationConfigManager();
    }
    return IntegrationConfigManager.instance;
  }

  private loadConfigurations(): void {
    // SMS Configurations
    this.configs.set('sms-viettel', {
      name: 'SMS Viettel',
      enabled: process.env.SMS_VIETTEL_ENABLED === 'true',
      apiKey: process.env.SMS_VIETTEL_API_KEY,
      baseUrl: process.env.SMS_VIETTEL_BASE_URL || 'https://api.viettel.vn/sms',
      provider: 'viettel',
      fromNumber: process.env.SMS_VIETTEL_FROM_NUMBER || '',
      templates: {
        claim_submitted: 'Yêu cầu bồi thường #{claimId} đã được gửi thành công.',
        claim_approved: 'Yêu cầu bồi thường #{claimId} đã được phê duyệt.',
        claim_rejected: 'Yêu cầu bồi thường #{claimId} đã bị từ chối. Lý do: {reason}',
        otp_verification: 'Mã OTP của bạn là: {code}. Có hiệu lực trong 5 phút.'
      },
      timeout: 30000,
      retryAttempts: 3,
      rateLimitPerMinute: 100
    } as SMSConfig);

    this.configs.set('sms-vnpt', {
      name: 'SMS VNPT',
      enabled: process.env.SMS_VNPT_ENABLED === 'true',
      apiKey: process.env.SMS_VNPT_API_KEY,
      baseUrl: process.env.SMS_VNPT_BASE_URL || 'https://api.vnpt.vn/sms',
      provider: 'vnpt',
      fromNumber: process.env.SMS_VNPT_FROM_NUMBER || '',
      templates: {
        claim_submitted: 'Yêu cầu bồi thường #{claimId} đã được gửi thành công.',
        claim_approved: 'Yêu cầu bồi thường #{claimId} đã được phê duyệt.',
        claim_rejected: 'Yêu cầu bồi thường #{claimId} đã bị từ chối. Lý do: {reason}',
        otp_verification: 'Mã OTP của bạn là: {code}. Có hiệu lực trong 5 phút.'
      },
      timeout: 30000,
      retryAttempts: 3,
      rateLimitPerMinute: 100
    } as SMSConfig);

    // Email Configuration
    this.configs.set('email-sendgrid', {
      name: 'SendGrid Email',
      enabled: process.env.SENDGRID_ENABLED === 'true',
      apiKey: process.env.SENDGRID_API_KEY,
      baseUrl: 'https://api.sendgrid.com/v3',
      provider: 'sendgrid',
      fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@healthclaim.vn',
      fromName: process.env.SENDGRID_FROM_NAME || 'Healthcare Claim System',
      templates: {
        welcome: 'd-welcome-template-id',
        claim_submitted: 'd-claim-submitted-template-id',
        claim_approved: 'd-claim-approved-template-id',
        claim_rejected: 'd-claim-rejected-template-id',
        password_reset: 'd-password-reset-template-id'
      },
      timeout: 30000,
      retryAttempts: 3,
      rateLimitPerMinute: 600
    } as EmailConfig);

    // Cloud Storage Configuration
    this.configs.set('storage-aws-s3', {
      name: 'AWS S3 Storage',
      enabled: process.env.AWS_S3_ENABLED === 'true',
      provider: 'aws-s3',
      bucket: process.env.AWS_S3_BUCKET || 'healthcare-claims-storage',
      region: process.env.AWS_REGION || 'ap-southeast-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      timeout: 60000,
      retryAttempts: 3
    } as CloudStorageConfig);

    this.configs.set('storage-minio', {
      name: 'MinIO Storage',
      enabled: process.env.MINIO_ENABLED === 'true',
      provider: 'minio',
      bucket: process.env.MINIO_BUCKET || 'healthcare-claims',
      endpoint: process.env.MINIO_ENDPOINT || 'localhost:9000',
      accessKeyId: process.env.MINIO_ACCESS_KEY || '',
      secretAccessKey: process.env.MINIO_SECRET_KEY || '',
      timeout: 60000,
      retryAttempts: 3
    } as CloudStorageConfig);

    // OCR Configuration
    this.configs.set('ocr-google-vision', {
      name: 'Google Vision OCR',
      enabled: process.env.GOOGLE_VISION_ENABLED === 'true',
      apiKey: process.env.GOOGLE_VISION_API_KEY,
      baseUrl: 'https://vision.googleapis.com/v1',
      provider: 'google-vision',
      supportedFormats: ['image/jpeg', 'image/png', 'application/pdf'],
      maxFileSize: 20 * 1024 * 1024, // 20MB
      timeout: 120000,
      retryAttempts: 2
    } as OCRConfig);

    // Maps Configuration
    this.configs.set('maps-google', {
      name: 'Google Maps',
      enabled: process.env.GOOGLE_MAPS_ENABLED === 'true',
      apiKey: process.env.GOOGLE_MAPS_API_KEY,
      baseUrl: 'https://maps.googleapis.com/maps/api',
      provider: 'google-maps',
      defaultLanguage: 'vi',
      timeout: 15000,
      retryAttempts: 2
    } as MapsConfig);

    // Identity Verification Configuration
    this.configs.set('identity-civic', {
      name: 'Civic ID Verification',
      enabled: process.env.CIVIC_ID_ENABLED === 'true',
      apiKey: process.env.CIVIC_ID_API_KEY,
      baseUrl: process.env.CIVIC_ID_BASE_URL || 'https://api.civic.gov.vn',
      provider: 'civic-id',
      verificationLevels: ['basic', 'enhanced', 'premium'],
      timeout: 30000,
      retryAttempts: 2
    } as IdentityVerificationConfig);

    // Payment Gateway Configurations
    this.configs.set('payment-vnpay', {
      name: 'VNPay Payment Gateway',
      enabled: process.env.VNPAY_ENABLED === 'true',
      apiKey: process.env.VNPAY_API_KEY,
      baseUrl: process.env.VNPAY_BASE_URL || 'https://sandbox-web.vnpay.vn',
      provider: 'vnpay',
      merchantId: process.env.VNPAY_MERCHANT_ID || '',
      secretKey: process.env.VNPAY_SECRET_KEY || '',
      environment: (process.env.VNPAY_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
      timeout: 30000,
      retryAttempts: 2
    } as PaymentGatewayConfig);

    // Hospital Database Configuration
    this.configs.set('hospital-database', {
      name: 'Hospital Database Integration',
      enabled: process.env.HOSPITAL_DB_ENABLED === 'true',
      connectionString: process.env.HOSPITAL_DB_CONNECTION_STRING || '',
      databases: process.env.HOSPITAL_DB_NAMES?.split(',') || ['hospital_system'],
      syncInterval: parseInt(process.env.HOSPITAL_DB_SYNC_INTERVAL || '3600000'), // 1 hour
      timeout: 60000,
      retryAttempts: 3
    } as HospitalDatabaseConfig);

    // Government API Configuration
    this.configs.set('government-api', {
      name: 'Government API Integration',
      enabled: process.env.GOVERNMENT_API_ENABLED === 'true',
      apiKey: process.env.GOVERNMENT_API_KEY,
      baseUrl: process.env.GOVERNMENT_API_BASE_URL || 'https://api.gov.vn',
      endpoints: {
        citizen_lookup: '/api/v1/citizen/lookup',
        insurance_verification: '/api/v1/insurance/verify',
        hospital_registry: '/api/v1/hospitals',
        medical_codes: '/api/v1/medical-codes'
      },
      certificatePath: process.env.GOVERNMENT_API_CERT_PATH,
      authMethod: (process.env.GOVERNMENT_API_AUTH_METHOD as 'api-key' | 'oauth2' | 'certificate') || 'api-key',
      timeout: 45000,
      retryAttempts: 2
    } as GovernmentAPIConfig);
  }

  public getConfig<T extends IntegrationConfig>(name: string): T | undefined {
    return this.configs.get(name) as T;
  }

  public getAllConfigs(): Map<string, IntegrationConfig> {
    return new Map(this.configs);
  }

  public updateConfig(name: string, config: Partial<IntegrationConfig>): void {
    const existingConfig = this.configs.get(name);
    if (existingConfig) {
      this.configs.set(name, { ...existingConfig, ...config });
    }
  }

  public getRetryConfig(): RetryConfig {
    return {
      maxAttempts: 3,
      backoffMultiplier: 2,
      initialDelay: 1000,
      maxDelay: 30000
    };
  }

  public getRateLimitConfig(service: string): RateLimitConfig {
    const config = this.getConfig(service);
    return {
      windowMs: 60000, // 1 minute
      maxRequests: config?.rateLimitPerMinute || 100,
      skipSuccessfulRequests: false,
      skipFailedRequests: false
    };
  }
}
