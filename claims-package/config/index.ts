// Claims Module Configuration
// Central configuration for the entire Claims module

export interface ClaimsConfig {
  // Database configuration
  database: {
    mongodb: {
      uri: string;
      dbName: string;
      options?: any;
    };
    redis: {
      url: string;
      options?: any;
    };
  };

  // AI/ML Services
  ai: {
    openai: {
      apiKey: string;
      model: string;
    };
    documentProcessing: {
      endpoint: string;
      apiKey: string;
    };
  };

  // Payment Gateways
  payment: {
    vnpay: {
      merchantId: string;
      secretKey: string;
      endpoint: string;
    };
    stripe: {
      publicKey: string;
      secretKey: string;
    };
    paypal: {
      clientId: string;
      clientSecret: string;
      environment: 'sandbox' | 'live';
    };
  };

  // External Integrations
  integrations: {
    bhxh: {
      endpoint: string;
      apiKey: string;
    };
    hospitals: {
      hisEndpoint: string;
      apiKey: string;
    };
    elasticsearch: {
      url: string;
      index: string;
    };
  };

  // Application settings
  app: {
    name: string;
    version: string;
    environment: 'development' | 'staging' | 'production';
    baseUrl: string;
    apiPrefix: string;
  };

  // Security settings
  security: {
    jwtSecret: string;
    encryption: {
      algorithm: string;
      key: string;
    };
    rateLimiting: {
      windowMs: number;
      maxRequests: number;
    };
  };

  // File upload settings
  upload: {
    maxFileSize: number;
    allowedTypes: string[];
    storage: 'local' | 'aws' | 'gcs';
    path: string;
  };

  // Email/SMS notifications
  notifications: {
    email: {
      provider: 'sendgrid' | 'ses';
      apiKey: string;
      fromEmail: string;
    };
    sms: {
      provider: 'twilio' | 'vietguys';
      apiKey: string;
      fromNumber: string;
    };
  };
}

// Default configuration
const defaultConfig: ClaimsConfig = {
  database: {
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
      dbName: process.env.MONGODB_DB_NAME || 'claims_db',
    },
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    },
  },

  ai: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4',
    },
    documentProcessing: {
      endpoint: process.env.DOCUMENT_AI_ENDPOINT || '',
      apiKey: process.env.DOCUMENT_AI_KEY || '',
    },
  },

  payment: {
    vnpay: {
      merchantId: process.env.VNPAY_MERCHANT_ID || '',
      secretKey: process.env.VNPAY_SECRET_KEY || '',
      endpoint: process.env.VNPAY_ENDPOINT || 'https://sandbox.vnpayment.vn',
    },
    stripe: {
      publicKey: process.env.STRIPE_PUBLIC_KEY || '',
      secretKey: process.env.STRIPE_SECRET_KEY || '',
    },
    paypal: {
      clientId: process.env.PAYPAL_CLIENT_ID || '',
      clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
      environment: (process.env.PAYPAL_ENVIRONMENT as 'sandbox' | 'live') || 'sandbox',
    },
  },

  integrations: {
    bhxh: {
      endpoint: process.env.BHXH_ENDPOINT || '',
      apiKey: process.env.BHXH_API_KEY || '',
    },
    hospitals: {
      hisEndpoint: process.env.HIS_ENDPOINT || '',
      apiKey: process.env.HIS_API_KEY || '',
    },
    elasticsearch: {
      url: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
      index: process.env.ELASTICSEARCH_INDEX || 'claims',
    },
  },

  app: {
    name: 'Claims Module',
    version: '1.0.0',
    environment: (process.env.NODE_ENV as any) || 'development',
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    apiPrefix: process.env.API_PREFIX || '/api',
  },

  security: {
    jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret-key',
    encryption: {
      algorithm: 'aes-256-gcm',
      key: process.env.ENCRYPTION_KEY || 'your-encryption-key',
    },
    rateLimiting: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    },
  },

  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
    allowedTypes: ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'],
    storage: (process.env.UPLOAD_STORAGE as any) || 'local',
    path: process.env.UPLOAD_PATH || './uploads',
  },

  notifications: {
    email: {
      provider: (process.env.EMAIL_PROVIDER as any) || 'sendgrid',
      apiKey: process.env.EMAIL_API_KEY || '',
      fromEmail: process.env.FROM_EMAIL || 'noreply@claimflow.vn',
    },
    sms: {
      provider: (process.env.SMS_PROVIDER as any) || 'twilio',
      apiKey: process.env.SMS_API_KEY || '',
      fromNumber: process.env.SMS_FROM_NUMBER || '',
    },
  },
};

// Configuration manager
export class ConfigManager {
  private static instance: ConfigManager;
  private config: ClaimsConfig;

  private constructor() {
    this.config = { ...defaultConfig };
    this.loadConfig();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private loadConfig(): void {
    // Load configuration from environment, files, or external sources
    // This can be extended to load from JSON files, remote config, etc.
    
    // Validate required configuration
    this.validateConfig();
  }

  private validateConfig(): void {
    const requiredFields = [
      'database.mongodb.uri',
      'security.jwtSecret',
    ];

    for (const field of requiredFields) {
      const value = this.getNestedValue(this.config, field);
      if (!value) {
        throw new Error(`Required configuration field missing: ${field}`);
      }
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  public get(): ClaimsConfig {
    return this.config;
  }

  public set(updates: Partial<ClaimsConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  public getDatabaseConfig() {
    return this.config.database;
  }

  public getAIConfig() {
    return this.config.ai;
  }

  public getPaymentConfig() {
    return this.config.payment;
  }

  public getIntegrationsConfig() {
    return this.config.integrations;
  }

  public getAppConfig() {
    return this.config.app;
  }

  public getSecurityConfig() {
    return this.config.security;
  }

  public getUploadConfig() {
    return this.config.upload;
  }

  public getNotificationsConfig() {
    return this.config.notifications;
  }

  public isProduction(): boolean {
    return this.config.app.environment === 'production';
  }

  public isDevelopment(): boolean {
    return this.config.app.environment === 'development';
  }
}

// Export singleton instance
export const config = ConfigManager.getInstance();

// Export default config for reference
export { defaultConfig };
