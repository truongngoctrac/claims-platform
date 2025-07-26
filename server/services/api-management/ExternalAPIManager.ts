import { EventEmitter } from 'events';
import crypto from 'crypto';
import { IntegrationManager } from '../integrations/IntegrationManager';
import { Logger } from 'winston';

export interface ExternalAPIConfig {
  name: string;
  version: string;
  baseUrl: string;
  apiKey?: string;
  authentication: {
    type: 'api-key' | 'oauth2' | 'basic' | 'jwt' | 'certificate';
    headers?: Record<string, string>;
    credentials?: {
      username?: string;
      password?: string;
      clientId?: string;
      clientSecret?: string;
      tokenUrl?: string;
      certificatePath?: string;
    };
  };
  rateLimits: {
    requestsPerSecond: number;
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
  timeout: number;
  retries: {
    maxAttempts: number;
    backoffMultiplier: number;
    initialDelay: number;
  };
  circuit: {
    failureThreshold: number;
    resetTimeout: number;
    monitoringWindow: number;
  };
  caching: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
    strategies: ('memory' | 'redis' | 'file')[];
  };
  enabled: boolean;
  tags: string[];
  metadata: Record<string, any>;
}

export interface APIRequestLog {
  id: string;
  apiName: string;
  endpoint: string;
  method: string;
  timestamp: Date;
  requestHeaders: Record<string, string>;
  requestBody?: any;
  responseStatus: number;
  responseHeaders: Record<string, string>;
  responseBody?: any;
  responseTime: number;
  success: boolean;
  error?: string;
  clientId?: string;
  userId?: string;
  sessionId?: string;
}

export interface APIMetrics {
  apiName: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  percentile95ResponseTime: number;
  percentile99ResponseTime: number;
  rateLimitHits: number;
  circuitBreakerTrips: number;
  cacheHits: number;
  cacheMisses: number;
  errorsByType: Record<string, number>;
  requestsByEndpoint: Record<string, number>;
  requestsByHour: Record<string, number>;
  uptime: number;
  lastFailure?: Date;
  healthStatus: 'healthy' | 'degraded' | 'down';
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
  successCount: number;
}

export class ExternalAPIManager extends EventEmitter {
  private apis: Map<string, ExternalAPIConfig> = new Map();
  private requestLogs: Map<string, APIRequestLog[]> = new Map();
  private metrics: Map<string, APIMetrics> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private rateLimitBuckets: Map<string, Map<string, number[]>> = new Map();
  private cache: Map<string, { data: any; expiry: number; hits: number }> = new Map();
  private logger: Logger;
  private integrationManager: IntegrationManager;
  
  constructor(logger: Logger) {
    super();
    this.logger = logger;
    this.integrationManager = new IntegrationManager();
    this.initializeAPIs();
    this.startCleanupTasks();
  }

  private initializeAPIs(): void {
    // Initialize popular Vietnamese external APIs
    
    // VietQR API for QR code payments
    this.registerAPI({
      name: 'vietqr-api',
      version: 'v2',
      baseUrl: 'https://api.vietqr.io',
      authentication: {
        type: 'api-key',
        headers: { 'x-client-id': process.env.VIETQR_CLIENT_ID || '' }
      },
      rateLimits: {
        requestsPerSecond: 10,
        requestsPerMinute: 100,
        requestsPerHour: 1000,
        requestsPerDay: 10000
      },
      timeout: 30000,
      retries: {
        maxAttempts: 3,
        backoffMultiplier: 2,
        initialDelay: 1000
      },
      circuit: {
        failureThreshold: 5,
        resetTimeout: 60000,
        monitoringWindow: 300000
      },
      caching: {
        enabled: true,
        ttl: 300000,
        maxSize: 1000,
        strategies: ['memory', 'redis']
      },
      enabled: process.env.VIETQR_ENABLED === 'true',
      tags: ['payment', 'qr', 'banking', 'vietnam'],
      metadata: {
        description: 'Vietnamese QR payment API',
        supportedBanks: ['VCB', 'TCB', 'MB', 'VTB', 'BIDV', 'ACB'],
        currency: 'VND'
      }
    });

    // eSocialInsurance API for social insurance verification
    this.registerAPI({
      name: 'esocial-insurance',
      version: 'v1',
      baseUrl: 'https://api.baohiemxahoi.gov.vn',
      authentication: {
        type: 'certificate',
        credentials: {
          certificatePath: process.env.ESOCIAL_CERT_PATH
        }
      },
      rateLimits: {
        requestsPerSecond: 2,
        requestsPerMinute: 50,
        requestsPerHour: 500,
        requestsPerDay: 5000
      },
      timeout: 45000,
      retries: {
        maxAttempts: 2,
        backoffMultiplier: 3,
        initialDelay: 2000
      },
      circuit: {
        failureThreshold: 3,
        resetTimeout: 120000,
        monitoringWindow: 600000
      },
      caching: {
        enabled: true,
        ttl: 3600000, // 1 hour
        maxSize: 500,
        strategies: ['redis']
      },
      enabled: process.env.ESOCIAL_ENABLED === 'true',
      tags: ['government', 'insurance', 'verification', 'vietnam'],
      metadata: {
        description: 'Vietnam Social Insurance Verification API',
        requiresCertificate: true,
        governmentAPI: true
      }
    });

    // Vietnam National ID Database
    this.registerAPI({
      name: 'national-id-verification',
      version: 'v1',
      baseUrl: 'https://api.hochinhminh.gov.vn',
      authentication: {
        type: 'oauth2',
        credentials: {
          clientId: process.env.NATIONAL_ID_CLIENT_ID,
          clientSecret: process.env.NATIONAL_ID_CLIENT_SECRET,
          tokenUrl: 'https://auth.hochinhminh.gov.vn/oauth/token'
        }
      },
      rateLimits: {
        requestsPerSecond: 1,
        requestsPerMinute: 20,
        requestsPerHour: 200,
        requestsPerDay: 1000
      },
      timeout: 60000,
      retries: {
        maxAttempts: 2,
        backoffMultiplier: 2,
        initialDelay: 3000
      },
      circuit: {
        failureThreshold: 3,
        resetTimeout: 180000,
        monitoringWindow: 900000
      },
      caching: {
        enabled: true,
        ttl: 7200000, // 2 hours
        maxSize: 200,
        strategies: ['redis']
      },
      enabled: process.env.NATIONAL_ID_ENABLED === 'true',
      tags: ['government', 'identity', 'verification', 'vietnam'],
      metadata: {
        description: 'Vietnam National ID Verification API',
        requiresOAuth: true,
        governmentAPI: true
      }
    });

    // MoMo e-wallet API
    this.registerAPI({
      name: 'momo-ewallet',
      version: 'v2',
      baseUrl: 'https://api.momo.vn',
      authentication: {
        type: 'api-key',
        headers: { 
          'Authorization': `Bearer ${process.env.MOMO_API_KEY}`,
          'X-Partner-Code': process.env.MOMO_PARTNER_CODE || ''
        }
      },
      rateLimits: {
        requestsPerSecond: 20,
        requestsPerMinute: 500,
        requestsPerHour: 5000,
        requestsPerDay: 50000
      },
      timeout: 30000,
      retries: {
        maxAttempts: 3,
        backoffMultiplier: 2,
        initialDelay: 1000
      },
      circuit: {
        failureThreshold: 5,
        resetTimeout: 60000,
        monitoringWindow: 300000
      },
      caching: {
        enabled: false, // Payment APIs should not cache
        ttl: 0,
        maxSize: 0,
        strategies: []
      },
      enabled: process.env.MOMO_ENABLED === 'true',
      tags: ['payment', 'ewallet', 'vietnam', 'fintech'],
      metadata: {
        description: 'MoMo e-wallet payment API',
        paymentMethods: ['QR', 'app', 'web'],
        currency: 'VND'
      }
    });

    // Vietnam Post eKYC API
    this.registerAPI({
      name: 'vnpost-ekyc',
      version: 'v1',
      baseUrl: 'https://api.vnpost.vn/ekyc',
      authentication: {
        type: 'api-key',
        headers: { 'X-API-Key': process.env.VNPOST_API_KEY || '' }
      },
      rateLimits: {
        requestsPerSecond: 5,
        requestsPerMinute: 100,
        requestsPerHour: 1000,
        requestsPerDay: 5000
      },
      timeout: 45000,
      retries: {
        maxAttempts: 2,
        backoffMultiplier: 2,
        initialDelay: 2000
      },
      circuit: {
        failureThreshold: 4,
        resetTimeout: 90000,
        monitoringWindow: 450000
      },
      caching: {
        enabled: true,
        ttl: 1800000, // 30 minutes
        maxSize: 300,
        strategies: ['memory', 'redis']
      },
      enabled: process.env.VNPOST_EKYC_ENABLED === 'true',
      tags: ['ekyc', 'verification', 'vnpost', 'vietnam'],
      metadata: {
        description: 'Vietnam Post eKYC verification service',
        verificationTypes: ['face', 'id-card', 'liveness']
      }
    });

    // FPT.AI API for OCR and NLP
    this.registerAPI({
      name: 'fpt-ai',
      version: 'v3',
      baseUrl: 'https://api.fpt.ai',
      authentication: {
        type: 'api-key',
        headers: { 'api-key': process.env.FPT_AI_API_KEY || '' }
      },
      rateLimits: {
        requestsPerSecond: 15,
        requestsPerMinute: 300,
        requestsPerHour: 3000,
        requestsPerDay: 30000
      },
      timeout: 60000,
      retries: {
        maxAttempts: 3,
        backoffMultiplier: 2,
        initialDelay: 1000
      },
      circuit: {
        failureThreshold: 5,
        resetTimeout: 60000,
        monitoringWindow: 300000
      },
      caching: {
        enabled: true,
        ttl: 600000, // 10 minutes
        maxSize: 500,
        strategies: ['memory', 'redis']
      },
      enabled: process.env.FPT_AI_ENABLED === 'true',
      tags: ['ai', 'ocr', 'nlp', 'vietnamese', 'fpt'],
      metadata: {
        description: 'FPT.AI API for OCR and NLP processing',
        languages: ['vi', 'en'],
        services: ['ocr', 'text-analysis', 'translation']
      }
    });

    // Zalo Official Account API
    this.registerAPI({
      name: 'zalo-oa',
      version: 'v2.0',
      baseUrl: 'https://openapi.zalo.me',
      authentication: {
        type: 'oauth2',
        credentials: {
          clientId: process.env.ZALO_APP_ID,
          clientSecret: process.env.ZALO_APP_SECRET,
          tokenUrl: 'https://oauth.zaloapp.com/v4/oa/access_token'
        }
      },
      rateLimits: {
        requestsPerSecond: 10,
        requestsPerMinute: 200,
        requestsPerHour: 2000,
        requestsPerDay: 20000
      },
      timeout: 30000,
      retries: {
        maxAttempts: 3,
        backoffMultiplier: 2,
        initialDelay: 1000
      },
      circuit: {
        failureThreshold: 5,
        resetTimeout: 60000,
        monitoringWindow: 300000
      },
      caching: {
        enabled: false, // Messaging APIs should not cache
        ttl: 0,
        maxSize: 0,
        strategies: []
      },
      enabled: process.env.ZALO_OA_ENABLED === 'true',
      tags: ['messaging', 'notification', 'zalo', 'vietnam'],
      metadata: {
        description: 'Zalo Official Account API for messaging',
        messageTypes: ['text', 'image', 'template', 'interactive']
      }
    });

    // VPBank Open Banking API
    this.registerAPI({
      name: 'vpbank-openapi',
      version: 'v1',
      baseUrl: 'https://api.vpbank.com.vn',
      authentication: {
        type: 'oauth2',
        credentials: {
          clientId: process.env.VPBANK_CLIENT_ID,
          clientSecret: process.env.VPBANK_CLIENT_SECRET,
          tokenUrl: 'https://api.vpbank.com.vn/oauth/token'
        }
      },
      rateLimits: {
        requestsPerSecond: 5,
        requestsPerMinute: 100,
        requestsPerHour: 1000,
        requestsPerDay: 5000
      },
      timeout: 45000,
      retries: {
        maxAttempts: 2,
        backoffMultiplier: 3,
        initialDelay: 2000
      },
      circuit: {
        failureThreshold: 3,
        resetTimeout: 120000,
        monitoringWindow: 600000
      },
      caching: {
        enabled: false, // Banking APIs should not cache sensitive data
        ttl: 0,
        maxSize: 0,
        strategies: []
      },
      enabled: process.env.VPBANK_ENABLED === 'true',
      tags: ['banking', 'openapi', 'vpbank', 'vietnam'],
      metadata: {
        description: 'VPBank Open Banking API',
        services: ['account-info', 'balance', 'transaction-history'],
        requiresConsent: true
      }
    });
  }

  public registerAPI(config: ExternalAPIConfig): void {
    this.apis.set(config.name, config);
    this.initializeAPIMetrics(config.name);
    this.initializeCircuitBreaker(config.name);
    this.initializeRateLimitBucket(config.name);
    
    this.logger.info(`External API registered: ${config.name} v${config.version}`, {
      apiName: config.name,
      version: config.version,
      enabled: config.enabled,
      tags: config.tags
    });
    
    this.emit('api-registered', config);
  }

  public async makeRequest(
    apiName: string,
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      headers?: Record<string, string>;
      body?: any;
      params?: Record<string, string>;
      useCache?: boolean;
      cacheKey?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<{
    success: boolean;
    data?: any;
    error?: string;
    requestId: string;
    fromCache: boolean;
    responseTime: number;
  }> {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    try {
      const api = this.apis.get(apiName);
      if (!api) {
        throw new Error(`API ${apiName} not found`);
      }

      if (!api.enabled) {
        throw new Error(`API ${apiName} is disabled`);
      }

      // Check circuit breaker
      const circuitState = this.circuitBreakers.get(apiName);
      if (circuitState?.state === 'open') {
        if (Date.now() < (circuitState.nextAttemptTime?.getTime() || 0)) {
          throw new Error(`Circuit breaker is open for ${apiName}`);
        } else {
          // Transition to half-open
          circuitState.state = 'half-open';
          circuitState.successCount = 0;
        }
      }

      // Check rate limits
      if (!this.checkRateLimit(apiName)) {
        this.updateMetrics(apiName, false, Date.now() - startTime, 'rate-limit');
        throw new Error(`Rate limit exceeded for ${apiName}`);
      }

      // Check cache
      const cacheKey = options.cacheKey || `${apiName}:${endpoint}:${JSON.stringify(options.params || {})}`;
      if (options.useCache !== false && api.caching.enabled) {
        const cached = this.getFromCache(cacheKey);
        if (cached) {
          this.updateMetrics(apiName, true, Date.now() - startTime, 'cache-hit');
          return {
            success: true,
            data: cached,
            requestId,
            fromCache: true,
            responseTime: Date.now() - startTime
          };
        }
      }

      // Make the actual request
      const response = await this.executeRequest(api, endpoint, options);
      const responseTime = Date.now() - startTime;

      // Cache successful responses
      if (response.success && api.caching.enabled && options.useCache !== false) {
        this.setCache(cacheKey, response.data, api.caching.ttl);
      }

      // Update circuit breaker and metrics
      this.updateCircuitBreaker(apiName, true);
      this.updateMetrics(apiName, true, responseTime);

      // Log the request
      this.logRequest(apiName, endpoint, options, response, requestId, responseTime);

      return {
        ...response,
        requestId,
        fromCache: false,
        responseTime
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.updateCircuitBreaker(apiName, false);
      this.updateMetrics(apiName, false, responseTime, errorMessage);

      // Log the error
      this.logRequest(apiName, endpoint, options, { success: false, error: errorMessage }, requestId, responseTime);

      this.logger.error(`External API request failed: ${apiName}`, {
        apiName,
        endpoint,
        error: errorMessage,
        requestId,
        responseTime
      });

      return {
        success: false,
        error: errorMessage,
        requestId,
        fromCache: false,
        responseTime
      };
    }
  }

  private async executeRequest(
    api: ExternalAPIConfig,
    endpoint: string,
    options: any
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const url = new URL(endpoint, api.baseUrl);
    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'HealthCare-Claim-System/1.0',
      ...api.authentication.headers,
      ...options.headers
    };

    // Add authentication
    await this.addAuthentication(api, headers);

    const fetchOptions: RequestInit = {
      method: options.method || 'GET',
      headers,
      signal: AbortSignal.timeout(api.timeout)
    };

    if (options.body && (options.method === 'POST' || options.method === 'PUT' || options.method === 'PATCH')) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= api.retries.maxAttempts; attempt++) {
      try {
        const response = await fetch(url.toString(), fetchOptions);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return { success: true, data };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < api.retries.maxAttempts) {
          const delay = api.retries.initialDelay * Math.pow(api.retries.backoffMultiplier, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return { 
      success: false, 
      error: lastError?.message || 'Request failed after all retries' 
    };
  }

  private async addAuthentication(api: ExternalAPIConfig, headers: Record<string, string>): Promise<void> {
    switch (api.authentication.type) {
      case 'api-key':
        if (api.apiKey) {
          headers['Authorization'] = `Bearer ${api.apiKey}`;
        }
        break;
      
      case 'basic':
        if (api.authentication.credentials?.username && api.authentication.credentials?.password) {
          const credentials = Buffer.from(
            `${api.authentication.credentials.username}:${api.authentication.credentials.password}`
          ).toString('base64');
          headers['Authorization'] = `Basic ${credentials}`;
        }
        break;
      
      case 'oauth2':
        // OAuth2 token handling would go here
        // This is a simplified version - in practice, you'd manage token refresh
        break;
      
      case 'jwt':
        // JWT token handling
        break;
      
      case 'certificate':
        // Certificate-based authentication
        break;
    }
  }

  private checkRateLimit(apiName: string): boolean {
    const api = this.apis.get(apiName);
    if (!api) return false;

    const now = Date.now();
    const buckets = this.rateLimitBuckets.get(apiName) || new Map();
    
    // Check each rate limit window
    const checks = [
      { window: 1000, limit: api.rateLimits.requestsPerSecond, key: 'second' },
      { window: 60000, limit: api.rateLimits.requestsPerMinute, key: 'minute' },
      { window: 3600000, limit: api.rateLimits.requestsPerHour, key: 'hour' },
      { window: 86400000, limit: api.rateLimits.requestsPerDay, key: 'day' }
    ];

    for (const check of checks) {
      const windowStart = Math.floor(now / check.window) * check.window;
      const requests = buckets.get(check.key) || [];
      
      // Remove old requests
      const validRequests = requests.filter(time => time >= windowStart);
      
      if (validRequests.length >= check.limit) {
        return false;
      }
      
      // Add current request
      validRequests.push(now);
      buckets.set(check.key, validRequests);
    }

    this.rateLimitBuckets.set(apiName, buckets);
    return true;
  }

  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() > cached.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    cached.hits++;
    return cached.data;
  }

  private setCache(key: string, data: any, ttl: number): void {
    // Implement cache size limits
    if (this.cache.size >= 10000) { // Max cache size
      // Remove oldest entries
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].expiry - b[1].expiry);
      for (let i = 0; i < entries.length * 0.1; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
    
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl,
      hits: 0
    });
  }

  private initializeAPIMetrics(apiName: string): void {
    this.metrics.set(apiName, {
      apiName,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      percentile95ResponseTime: 0,
      percentile99ResponseTime: 0,
      rateLimitHits: 0,
      circuitBreakerTrips: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errorsByType: {},
      requestsByEndpoint: {},
      requestsByHour: {},
      uptime: 100,
      healthStatus: 'healthy'
    });
  }

  private initializeCircuitBreaker(apiName: string): void {
    this.circuitBreakers.set(apiName, {
      state: 'closed',
      failureCount: 0,
      successCount: 0
    });
  }

  private initializeRateLimitBucket(apiName: string): void {
    this.rateLimitBuckets.set(apiName, new Map());
  }

  private updateCircuitBreaker(apiName: string, success: boolean): void {
    const api = this.apis.get(apiName);
    const breaker = this.circuitBreakers.get(apiName);
    if (!api || !breaker) return;

    if (success) {
      breaker.successCount++;
      
      if (breaker.state === 'half-open' && breaker.successCount >= 3) {
        breaker.state = 'closed';
        breaker.failureCount = 0;
        breaker.successCount = 0;
      } else if (breaker.state === 'closed') {
        breaker.failureCount = Math.max(0, breaker.failureCount - 1);
      }
    } else {
      breaker.failureCount++;
      breaker.lastFailureTime = new Date();
      breaker.successCount = 0;

      if (breaker.failureCount >= api.circuit.failureThreshold) {
        breaker.state = 'open';
        breaker.nextAttemptTime = new Date(Date.now() + api.circuit.resetTimeout);
        
        const metrics = this.metrics.get(apiName);
        if (metrics) {
          metrics.circuitBreakerTrips++;
        }
        
        this.emit('circuit-breaker-opened', { apiName, breaker });
      }
    }
  }

  private updateMetrics(apiName: string, success: boolean, responseTime: number, errorType?: string): void {
    const metrics = this.metrics.get(apiName);
    if (!metrics) return;

    metrics.totalRequests++;
    
    if (success) {
      metrics.successfulRequests++;
      if (errorType === 'cache-hit') {
        metrics.cacheHits++;
      } else {
        metrics.cacheMisses++;
      }
    } else {
      metrics.failedRequests++;
      
      if (errorType === 'rate-limit') {
        metrics.rateLimitHits++;
      } else if (errorType) {
        metrics.errorsByType[errorType] = (metrics.errorsByType[errorType] || 0) + 1;
      }
    }

    // Update average response time
    metrics.averageResponseTime = 
      (metrics.averageResponseTime * (metrics.totalRequests - 1) + responseTime) / metrics.totalRequests;

    // Update health status
    const successRate = metrics.successfulRequests / metrics.totalRequests;
    if (successRate >= 0.95) {
      metrics.healthStatus = 'healthy';
    } else if (successRate >= 0.85) {
      metrics.healthStatus = 'degraded';
    } else {
      metrics.healthStatus = 'down';
    }

    // Update uptime
    metrics.uptime = successRate * 100;

    // Track hourly requests
    const hour = new Date().getHours().toString();
    metrics.requestsByHour[hour] = (metrics.requestsByHour[hour] || 0) + 1;
  }

  private logRequest(
    apiName: string,
    endpoint: string,
    options: any,
    response: any,
    requestId: string,
    responseTime: number
  ): void {
    const log: APIRequestLog = {
      id: requestId,
      apiName,
      endpoint,
      method: options.method || 'GET',
      timestamp: new Date(),
      requestHeaders: options.headers || {},
      requestBody: options.body,
      responseStatus: response.success ? 200 : 500,
      responseHeaders: {},
      responseBody: response.data || response.error,
      responseTime,
      success: response.success,
      error: response.error,
      clientId: options.metadata?.clientId,
      userId: options.metadata?.userId,
      sessionId: options.metadata?.sessionId
    };

    const logs = this.requestLogs.get(apiName) || [];
    logs.push(log);
    
    // Keep only last 1000 logs per API
    if (logs.length > 1000) {
      logs.shift();
    }
    
    this.requestLogs.set(apiName, logs);
  }

  private startCleanupTasks(): void {
    // Clean up old cache entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.cache.entries()) {
        if (now > value.expiry) {
          this.cache.delete(key);
        }
      }
    }, 5 * 60 * 1000);

    // Clean up old rate limit buckets every minute
    setInterval(() => {
      const now = Date.now();
      for (const [apiName, buckets] of this.rateLimitBuckets.entries()) {
        for (const [window, requests] of buckets.entries()) {
          const windowMs = window === 'second' ? 1000 : 
                          window === 'minute' ? 60000 :
                          window === 'hour' ? 3600000 : 86400000;
          
          const validRequests = requests.filter(time => now - time < windowMs);
          buckets.set(window, validRequests);
        }
      }
    }, 60 * 1000);

    // Health check every 2 minutes
    setInterval(() => {
      this.performHealthChecks();
    }, 2 * 60 * 1000);
  }

  private async performHealthChecks(): Promise<void> {
    for (const [apiName, api] of this.apis.entries()) {
      if (!api.enabled) continue;

      try {
        // Perform a simple health check endpoint call
        const healthEndpoint = '/health'; // Most APIs have this
        await this.makeRequest(apiName, healthEndpoint, {
          method: 'GET',
          useCache: false,
          metadata: { healthCheck: true }
        });
      } catch (error) {
        this.logger.warn(`Health check failed for ${apiName}`, {
          apiName,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  // Public API methods
  public getAPIConfig(apiName: string): ExternalAPIConfig | undefined {
    return this.apis.get(apiName);
  }

  public getAllAPIs(): ExternalAPIConfig[] {
    return Array.from(this.apis.values());
  }

  public getAPIsByTag(tag: string): ExternalAPIConfig[] {
    return Array.from(this.apis.values()).filter(api => api.tags.includes(tag));
  }

  public getAPIMetrics(apiName?: string): APIMetrics | APIMetrics[] {
    if (apiName) {
      return this.metrics.get(apiName) || this.initializeAPIMetrics(apiName);
    }
    return Array.from(this.metrics.values());
  }

  public getCircuitBreakerStatus(apiName?: string): CircuitBreakerState | Map<string, CircuitBreakerState> {
    if (apiName) {
      return this.circuitBreakers.get(apiName) || { state: 'closed', failureCount: 0, successCount: 0 };
    }
    return this.circuitBreakers;
  }

  public getRequestLogs(apiName: string, limit: number = 100): APIRequestLog[] {
    const logs = this.requestLogs.get(apiName) || [];
    return logs.slice(-limit);
  }

  public enableAPI(apiName: string): boolean {
    const api = this.apis.get(apiName);
    if (api) {
      api.enabled = true;
      this.emit('api-enabled', apiName);
      return true;
    }
    return false;
  }

  public disableAPI(apiName: string): boolean {
    const api = this.apis.get(apiName);
    if (api) {
      api.enabled = false;
      this.emit('api-disabled', apiName);
      return true;
    }
    return false;
  }

  public resetCircuitBreaker(apiName: string): boolean {
    const breaker = this.circuitBreakers.get(apiName);
    if (breaker) {
      breaker.state = 'closed';
      breaker.failureCount = 0;
      breaker.successCount = 0;
      delete breaker.lastFailureTime;
      delete breaker.nextAttemptTime;
      
      this.emit('circuit-breaker-reset', apiName);
      return true;
    }
    return false;
  }

  public clearCache(apiName?: string): void {
    if (apiName) {
      // Clear cache for specific API
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${apiName}:`)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Clear all cache
      this.cache.clear();
    }
    
    this.emit('cache-cleared', apiName);
  }

  public async shutdown(): Promise<void> {
    this.emit('manager-shutdown');
    
    // Close any open connections
    await this.integrationManager.close();
    
    // Clear all intervals and timeouts
    this.removeAllListeners();
  }
}

// Export singleton instance
let instance: ExternalAPIManager | null = null;

export function getExternalAPIManager(logger: Logger): ExternalAPIManager {
  if (!instance) {
    instance = new ExternalAPIManager(logger);
  }
  return instance;
}
