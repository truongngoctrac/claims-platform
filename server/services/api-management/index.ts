import { Logger } from 'winston';
import { ExternalAPIManager, getExternalAPIManager } from './ExternalAPIManager';
import { APIVersionManager, defaultVersioningStrategies } from './APIVersionManager';
import { APIDocumentationManager } from './APIDocumentationManager';
import { APIKeyManager, getAPIKeyManager } from './APIKeyManager';
import { APIMonitoringService, getAPIMonitoringService } from './APIMonitoringService';

export interface APIManagementConfig {
  versioning: {
    strategy: 'header' | 'url-path' | 'query-param' | 'content-type';
    defaultVersion: string;
    supportedVersions: string[];
  };
  documentation: {
    outputDir: string;
    autoGenerate: boolean;
    formats: ('yaml' | 'json')[];
  };
  monitoring: {
    enabled: boolean;
    alerting: boolean;
    retention: {
      metrics: number; // days
      logs: number; // days
      alerts: number; // days
    };
  };
  externalAPIs: {
    timeout: number;
    retries: number;
    rateLimiting: boolean;
    circuitBreaker: boolean;
  };
  security: {
    apiKeys: {
      enabled: boolean;
      keyRotation: boolean;
      rotationInterval: number; // days
    };
    ipWhitelisting: boolean;
    rateLimiting: {
      enabled: boolean;
      defaultLimits: {
        requestsPerSecond: number;
        requestsPerMinute: number;
        requestsPerHour: number;
        requestsPerDay: number;
      };
    };
  };
}

export class APIManagementService {
  private logger: Logger;
  private config: APIManagementConfig;
  private externalAPIManager: ExternalAPIManager;
  private versionManager: APIVersionManager;
  private documentationManager: APIDocumentationManager;
  private keyManager: APIKeyManager;
  private monitoringService: APIMonitoringService;

  constructor(logger: Logger, config?: Partial<APIManagementConfig>) {
    this.logger = logger;
    this.config = this.mergeConfig(config);
    
    // Initialize all managers
    this.initializeManagers();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Start automated tasks
    this.startAutomatedTasks();
  }

  private mergeConfig(userConfig?: Partial<APIManagementConfig>): APIManagementConfig {
    const defaultConfig: APIManagementConfig = {
      versioning: {
        strategy: 'header',
        defaultVersion: '2.0.0',
        supportedVersions: ['1.0.0', '2.0.0', '3.0.0']
      },
      documentation: {
        outputDir: 'docs/api',
        autoGenerate: true,
        formats: ['yaml', 'json']
      },
      monitoring: {
        enabled: true,
        alerting: true,
        retention: {
          metrics: 30,
          logs: 90,
          alerts: 365
        }
      },
      externalAPIs: {
        timeout: 30000,
        retries: 3,
        rateLimiting: true,
        circuitBreaker: true
      },
      security: {
        apiKeys: {
          enabled: true,
          keyRotation: true,
          rotationInterval: 90
        },
        ipWhitelisting: true,
        rateLimiting: {
          enabled: true,
          defaultLimits: {
            requestsPerSecond: 10,
            requestsPerMinute: 100,
            requestsPerHour: 1000,
            requestsPerDay: 10000
          }
        }
      }
    };

    return { ...defaultConfig, ...userConfig };
  }

  private initializeManagers(): void {
    // Initialize External API Manager
    this.externalAPIManager = getExternalAPIManager(this.logger);

    // Initialize Version Manager
    const versioningStrategy = this.config.versioning.strategy === 'header' 
      ? defaultVersioningStrategies.header
      : this.config.versioning.strategy === 'url-path'
      ? defaultVersioningStrategies.urlPath
      : defaultVersioningStrategies.queryParam;

    versioningStrategy.defaultVersion = this.config.versioning.defaultVersion;
    versioningStrategy.supportedVersions = this.config.versioning.supportedVersions;

    this.versionManager = new APIVersionManager(versioningStrategy);

    // Initialize Documentation Manager
    this.documentationManager = new APIDocumentationManager(this.config.documentation.outputDir);

    // Initialize API Key Manager
    this.keyManager = getAPIKeyManager();

    // Initialize Monitoring Service
    this.monitoringService = getAPIMonitoringService(this.logger);

    this.logger.info('API Management service initialized', {
      versioning: this.config.versioning.strategy,
      monitoring: this.config.monitoring.enabled,
      keyManagement: this.config.security.apiKeys.enabled
    });
  }

  private setupEventListeners(): void {
    // External API events
    this.externalAPIManager.on('api-registered', (api) => {
      this.logger.info('External API registered', { apiName: api.name, version: api.version });
    });

    this.externalAPIManager.on('circuit-breaker-opened', (data) => {
      this.logger.warn('Circuit breaker opened', { apiName: data.apiName });
    });

    // Version management events
    this.versionManager.on('version-deprecated', (data) => {
      this.logger.warn('API version deprecated', { version: data.version, sunsetDate: data.sunsetDate });
    });

    // API Key events
    this.keyManager.on('key-generated', (key) => {
      this.logger.info('API key generated', { 
        keyId: key.id, 
        name: key.name, 
        environment: key.environment,
        userId: key.userId 
      });
    });

    this.keyManager.on('key-revoked', (data) => {
      this.logger.warn('API key revoked', { keyId: data.keyId, reason: data.reason });
    });

    // Monitoring events
    this.monitoringService.on('alert-triggered', (alert) => {
      this.logger.error('Alert triggered', {
        alertId: alert.id,
        ruleName: alert.ruleName,
        severity: alert.severity,
        value: alert.value,
        threshold: alert.threshold
      });
    });

    this.monitoringService.on('health-check-failed', (result) => {
      this.logger.error('Health check failed', {
        service: result.service,
        error: result.details.error
      });
    });

    // Documentation events
    this.documentationManager.on('documentation-exported', (data) => {
      this.logger.info('Documentation exported', {
        version: data.version,
        format: data.format,
        outputDir: data.outputDir
      });
    });
  }

  private startAutomatedTasks(): void {
    // Auto-generate documentation if enabled
    if (this.config.documentation.autoGenerate) {
      setInterval(async () => {
        await this.generateAllDocumentation();
      }, 24 * 60 * 60 * 1000); // Daily
    }

    // Key rotation if enabled
    if (this.config.security.apiKeys.keyRotation) {
      setInterval(() => {
        this.rotateExpiredKeys();
      }, 24 * 60 * 60 * 1000); // Daily
    }

    // Health checks
    setInterval(() => {
      this.performSystemHealthCheck();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private async generateAllDocumentation(): Promise<void> {
    try {
      const versions = this.versionManager.getAllVersions();
      
      for (const version of versions) {
        for (const format of this.config.documentation.formats) {
          await this.documentationManager.exportDocumentation(version.version, format);
        }
        
        // Generate Postman collection
        await this.documentationManager.exportPostmanCollection(version.version);
      }
      
      this.logger.info('Documentation auto-generation completed');
    } catch (error) {
      this.logger.error('Documentation auto-generation failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private rotateExpiredKeys(): void {
    const rotationThreshold = new Date(Date.now() - this.config.security.apiKeys.rotationInterval * 24 * 60 * 60 * 1000);
    const activeKeys = this.keyManager.getActiveKeys();
    
    for (const key of activeKeys) {
      if (key.createdAt < rotationThreshold && key.rotationSchedule?.enabled) {
        const newKey = this.keyManager.rotateKey(key.id);
        if (newKey) {
          this.logger.info('API key auto-rotated', {
            oldKeyId: key.id,
            newKeyId: newKey.id,
            keyName: key.name
          });
        }
      }
    }
  }

  private async performSystemHealthCheck(): Promise<void> {
    // Check external API health
    const apis = this.externalAPIManager.getAllAPIs();
    for (const api of apis) {
      if (api.enabled) {
        try {
          await this.externalAPIManager.makeRequest(api.name, '/health', {
            method: 'GET',
            useCache: false,
            metadata: { healthCheck: true }
          });
        } catch (error) {
          this.logger.warn('External API health check failed', {
            apiName: api.name,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }

    // Update system health metrics
    const systemHealth = this.monitoringService.getSystemHealth();
    if (systemHealth.overall !== 'healthy') {
      this.logger.warn('System health degraded', {
        status: systemHealth.overall,
        services: systemHealth.services.filter(s => s.status !== 'healthy')
      });
    }
  }

  // Public API methods

  // External API Management
  public async callExternalAPI(
    apiName: string, 
    endpoint: string, 
    options: any
  ): Promise<any> {
    return this.externalAPIManager.makeRequest(apiName, endpoint, options);
  }

  public getExternalAPIStatus(): any {
    return {
      apis: this.externalAPIManager.getAllAPIs().map(api => ({
        name: api.name,
        enabled: api.enabled,
        version: api.version,
        tags: api.tags
      })),
      metrics: this.externalAPIManager.getAllAPIs().map(api => ({
        name: api.name,
        health: this.externalAPIManager.getAPIConfig(api.name),
        circuitBreaker: this.externalAPIManager.getCircuitBreakerStatus(api.name)
      }))
    };
  }

  // Version Management
  public resolveAPIVersion(request: any): string {
    return this.versionManager.resolveVersion(request);
  }

  public validateAPIRequest(version: string, endpoint: string, method: string, data: any): any {
    return this.versionManager.validateRequest(version, endpoint, method, data);
  }

  public getVersionInfo(): any {
    return {
      current: this.config.versioning.defaultVersion,
      supported: this.config.versioning.supportedVersions,
      strategy: this.config.versioning.strategy,
      versions: this.versionManager.getAllVersions().map(v => ({
        version: v.version,
        status: v.status,
        releaseDate: v.releaseDate,
        deprecationDate: v.deprecationDate,
        sunsetDate: v.sunsetDate
      }))
    };
  }

  // API Key Management
  public validateAPIKey(rawKey: string): any {
    return this.keyManager.validateKey(rawKey);
  }

  public createAPIKey(options: any): any {
    return this.keyManager.generateKey(options);
  }

  public getAPIKeyInfo(keyId: string): any {
    const key = this.keyManager.getKey(keyId);
    const stats = this.keyManager.getKeyStats(keyId);
    
    return key ? {
      id: key.id,
      name: key.name,
      environment: key.environment,
      status: key.status,
      scopes: key.scopes,
      rateLimits: key.rateLimits,
      stats
    } : null;
  }

  // Monitoring and Analytics
  public recordAPIMetric(metric: any): void {
    this.monitoringService.recordMetric(metric);
  }

  public getAnalytics(filters?: any): any {
    return {
      dashboard: this.monitoringService.getDashboardData(),
      metrics: this.monitoringService.getMetrics(filters),
      performance: this.monitoringService.getPerformanceMetrics(),
      alerts: this.monitoringService.getAlertEvents()
    };
  }

  public getSystemHealth(): any {
    return this.monitoringService.getSystemHealth();
  }

  // Documentation
  public async generateDocumentation(version: string, format: 'yaml' | 'json' = 'yaml'): Promise<string> {
    if (format === 'yaml') {
      return this.documentationManager.generateOpenAPISpec(version);
    } else {
      return this.documentationManager.generateSwaggerJSON(version);
    }
  }

  public getAPIDocumentation(version: string): any {
    return {
      documentation: this.documentationManager.getDocumentation(version),
      examples: this.documentationManager.getExamples(version),
      guides: this.documentationManager.getGuides(version)
    };
  }

  // Rate Limiting
  public checkRateLimit(keyId: string, endpoint: string): any {
    return this.keyManager.checkRateLimit(keyId, endpoint);
  }

  // Circuit Breaker
  public getCircuitBreakerStatus(apiName?: string): any {
    return this.externalAPIManager.getCircuitBreakerStatus(apiName);
  }

  public resetCircuitBreaker(apiName: string): boolean {
    return this.externalAPIManager.resetCircuitBreaker(apiName);
  }

  // Configuration
  public getConfiguration(): APIManagementConfig {
    return { ...this.config };
  }

  public updateConfiguration(updates: Partial<APIManagementConfig>): void {
    this.config = { ...this.config, ...updates };
    this.logger.info('API Management configuration updated', updates);
  }

  // Health and Status
  public getStatus(): any {
    return {
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      config: {
        versioning: this.config.versioning,
        monitoring: this.config.monitoring.enabled,
        keyManagement: this.config.security.apiKeys.enabled
      },
      managers: {
        externalAPI: 'active',
        versioning: 'active',
        documentation: 'active',
        keyManagement: 'active',
        monitoring: 'active'
      },
      systemHealth: this.getSystemHealth()
    };
  }

  // Cleanup
  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down API Management service');
    
    await this.externalAPIManager.shutdown();
    this.keyManager.destroy();
    this.monitoringService.destroy();
    
    this.logger.info('API Management service shutdown complete');
  }
}

// Export types
export * from './ExternalAPIManager';
export * from './APIVersionManager';
export * from './APIDocumentationManager';
export * from './APIKeyManager';
export * from './APIMonitoringService';

// Export singleton instance
let instance: APIManagementService | null = null;

export function getAPIManagementService(logger: Logger, config?: Partial<APIManagementConfig>): APIManagementService {
  if (!instance) {
    instance = new APIManagementService(logger, config);
  }
  return instance;
}

export { APIManagementService };
