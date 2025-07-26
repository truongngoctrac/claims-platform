export interface IntegrationConfig {
  name: string;
  enabled: boolean;
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  retryAttempts?: number;
  rateLimitPerMinute?: number;
}

export interface SMSConfig extends IntegrationConfig {
  provider: 'viettel' | 'vnpt';
  fromNumber: string;
  templates: Record<string, string>;
}

export interface EmailConfig extends IntegrationConfig {
  provider: 'sendgrid';
  fromEmail: string;
  fromName: string;
  templates: Record<string, string>;
}

export interface CloudStorageConfig extends IntegrationConfig {
  provider: 'aws-s3' | 'minio';
  bucket: string;
  region?: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface OCRConfig extends IntegrationConfig {
  provider: 'google-vision' | 'aws-textract' | 'azure-cognitive';
  supportedFormats: string[];
  maxFileSize: number;
}

export interface MapsConfig extends IntegrationConfig {
  provider: 'google-maps' | 'here-maps';
  defaultLanguage: string;
}

export interface IdentityVerificationConfig extends IntegrationConfig {
  provider: 'civic-id' | 'government-portal';
  verificationLevels: string[];
}

export interface PaymentGatewayConfig extends IntegrationConfig {
  provider: 'vnpay' | 'momo' | 'zalopay';
  merchantId: string;
  secretKey: string;
  environment: 'sandbox' | 'production';
}

export interface HospitalDatabaseConfig extends IntegrationConfig {
  connectionString: string;
  databases: string[];
  syncInterval: number;
}

export interface GovernmentAPIConfig extends IntegrationConfig {
  endpoints: Record<string, string>;
  certificatePath?: string;
  authMethod: 'api-key' | 'oauth2' | 'certificate';
}

export interface IntegrationResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  requestId: string;
  timestamp: Date;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface RetryConfig {
  maxAttempts: number;
  backoffMultiplier: number;
  initialDelay: number;
  maxDelay: number;
}
