/**
 * Cross-Service Communication Implementation
 * Healthcare Claims Processing System - Distributed Systems
 */

export interface ServiceEndpoint {
  serviceId: string;
  serviceName: string;
  version: string;
  host: string;
  port: number;
  protocol: 'http' | 'https' | 'grpc' | 'websocket';
  healthCheckPath: string;
  isHealthy: boolean;
  lastHealthCheck: Date;
  responseTime: number;
  metadata: Record<string, any>;
}

export interface CommunicationConfig {
  timeoutMs: number;
  retryAttempts: number;
  retryDelayMs: number;
  circuitBreakerConfig: CircuitBreakerConfig;
  rateLimitConfig: RateLimitConfig;
  authConfig: AuthConfig;
  loadBalancer: LoadBalancerConfig;
  tracingEnabled: boolean;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeoutMs: number;
  halfOpenMaxCalls: number;
  monitoringPeriodMs: number;
}

export interface RateLimitConfig {
  requestsPerSecond: number;
  burstSize: number;
  windowSizeMs: number;
}

export interface AuthConfig {
  type: 'none' | 'jwt' | 'oauth2' | 'api_key' | 'mtls';
  tokenEndpoint?: string;
  clientId?: string;
  clientSecret?: string;
  audience?: string;
}

export interface LoadBalancerConfig {
  strategy: 'round_robin' | 'least_connections' | 'weighted' | 'random';
  healthCheckInterval: number;
  failoverTimeout: number;
}

export interface ServiceRequest {
  requestId: string;
  serviceId: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
  metadata?: Record<string, any>;
}

export interface ServiceResponse {
  requestId: string;
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  responseTime: number;
  fromService: string;
  fromEndpoint: string;
  metadata?: Record<string, any>;
}

export abstract class ServiceCommunicator {
  protected config: CommunicationConfig;
  protected endpoints: Map<string, ServiceEndpoint[]> = new Map();

  constructor(config: CommunicationConfig) {
    this.config = config;
  }

  abstract registerService(endpoint: ServiceEndpoint): Promise<void>;
  abstract deregisterService(serviceId: string, endpointId: string): Promise<void>;
  abstract call(request: ServiceRequest): Promise<ServiceResponse>;
  abstract healthCheck(serviceId: string): Promise<boolean>;
}

export class HTTPServiceCommunicator extends ServiceCommunicator {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private rateLimiters: Map<string, RateLimiter> = new Map();
  private loadBalancer: LoadBalancer;
  private authProvider: AuthProvider;

  constructor(config: CommunicationConfig) {
    super(config);
    this.loadBalancer = new LoadBalancer(config.loadBalancer);
    this.authProvider = new AuthProvider(config.authConfig);
    this.startHealthChecking();
  }

  async registerService(endpoint: ServiceEndpoint): Promise<void> {
    console.log(`📝 Registering service ${endpoint.serviceName} at ${endpoint.host}:${endpoint.port}`);
    
    if (!this.endpoints.has(endpoint.serviceId)) {
      this.endpoints.set(endpoint.serviceId, []);
    }
    
    this.endpoints.get(endpoint.serviceId)!.push(endpoint);
    
    // Initialize circuit breaker and rate limiter
    const endpointKey = `${endpoint.serviceId}:${endpoint.host}:${endpoint.port}`;
    this.circuitBreakers.set(endpointKey, new CircuitBreaker(this.config.circuitBreakerConfig));
    this.rateLimiters.set(endpointKey, new RateLimiter(this.config.rateLimitConfig));
    
    // Initial health check
    await this.performHealthCheck(endpoint);
  }

  async deregisterService(serviceId: string, endpointId: string): Promise<void> {
    console.log(`🔄 Deregistering service ${serviceId} endpoint ${endpointId}`);
    
    const endpoints = this.endpoints.get(serviceId);
    if (endpoints) {
      const filtered = endpoints.filter(ep => ep.serviceId !== endpointId);
      this.endpoints.set(serviceId, filtered);
    }
  }

  async call(request: ServiceRequest): Promise<ServiceResponse> {
    const startTime = Date.now();
    
    // Get available endpoints for the service
    const endpoints = this.endpoints.get(request.serviceId);
    if (!endpoints || endpoints.length === 0) {
      throw new Error(`No endpoints available for service ${request.serviceId}`);
    }

    // Select endpoint using load balancer
    const endpoint = this.loadBalancer.selectEndpoint(endpoints);
    if (!endpoint) {
      throw new Error(`No healthy endpoints available for service ${request.serviceId}`);
    }

    const endpointKey = `${endpoint.serviceId}:${endpoint.host}:${endpoint.port}`;
    const circuitBreaker = this.circuitBreakers.get(endpointKey)!;
    const rateLimiter = this.rateLimiters.get(endpointKey)!;

    // Check circuit breaker
    if (!circuitBreaker.canExecute()) {
      throw new Error(`Circuit breaker is open for ${endpoint.serviceName}`);
    }

    // Check rate limit
    if (!rateLimiter.allowRequest()) {
      throw new Error(`Rate limit exceeded for ${endpoint.serviceName}`);
    }

    try {
      const response = await this.executeRequest(endpoint, request);
      circuitBreaker.recordSuccess();
      
      response.responseTime = Date.now() - startTime;
      response.fromService = endpoint.serviceName;
      response.fromEndpoint = `${endpoint.host}:${endpoint.port}`;
      
      return response;
    } catch (error) {
      circuitBreaker.recordFailure();
      throw error;
    }
  }

  async healthCheck(serviceId: string): Promise<boolean> {
    const endpoints = this.endpoints.get(serviceId);
    if (!endpoints || endpoints.length === 0) {
      return false;
    }

    const healthyEndpoints = await Promise.all(
      endpoints.map(endpoint => this.performHealthCheck(endpoint))
    );

    return healthyEndpoints.some(isHealthy => isHealthy);
  }

  private async executeRequest(endpoint: ServiceEndpoint, request: ServiceRequest): Promise<ServiceResponse> {
    const url = `${endpoint.protocol}://${endpoint.host}:${endpoint.port}${request.path}`;
    const timeout = request.timeout || this.config.timeoutMs;

    // Get authentication token if needed
    const authHeaders = await this.authProvider.getAuthHeaders();
    const headers = { ...request.headers, ...authHeaders };

    console.log(`📤 Calling ${request.method} ${url}`);

    // Simulate HTTP request
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

    // Simulate response
    const isSuccess = Math.random() > 0.1; // 90% success rate
    
    if (!isSuccess) {
      throw new Error(`HTTP ${Math.random() > 0.5 ? 500 : 503} from ${endpoint.serviceName}`);
    }

    return {
      requestId: request.requestId,
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: { success: true, data: 'simulated response' },
      responseTime: 0, // Will be set by caller
      fromService: endpoint.serviceName,
      fromEndpoint: `${endpoint.host}:${endpoint.port}`,
    };
  }

  private async performHealthCheck(endpoint: ServiceEndpoint): Promise<boolean> {
    try {
      const healthUrl = `${endpoint.protocol}://${endpoint.host}:${endpoint.port}${endpoint.healthCheckPath}`;
      console.log(`🔍 Health checking ${healthUrl}`);
      
      // Simulate health check
      const isHealthy = Math.random() > 0.05; // 95% uptime
      
      endpoint.isHealthy = isHealthy;
      endpoint.lastHealthCheck = new Date();
      endpoint.responseTime = Math.random() * 50 + 10; // 10-60ms
      
      return isHealthy;
    } catch (error) {
      endpoint.isHealthy = false;
      endpoint.lastHealthCheck = new Date();
      return false;
    }
  }

  private startHealthChecking(): void {
    setInterval(async () => {
      const allEndpoints = Array.from(this.endpoints.values()).flat();
      
      const healthPromises = allEndpoints.map(endpoint =>
        this.performHealthCheck(endpoint)
      );
      
      await Promise.allSettled(healthPromises);
    }, this.config.loadBalancer.healthCheckInterval);
  }
}

export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: 'closed' | 'open' | 'half_open' = 'closed';
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private halfOpenCallCount: number = 0;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  canExecute(): boolean {
    switch (this.state) {
      case 'closed':
        return true;
      case 'open':
        return this.shouldAttemptReset();
      case 'half_open':
        return this.halfOpenCallCount < this.config.halfOpenMaxCalls;
    }
  }

  recordSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === 'half_open') {
      this.state = 'closed';
      this.halfOpenCallCount = 0;
      console.log(`✅ Circuit breaker closed (recovered)`);
    }
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.state === 'closed' && this.failureCount >= this.config.failureThreshold) {
      this.state = 'open';
      console.log(`🔴 Circuit breaker opened`);
    } else if (this.state === 'half_open') {
      this.state = 'open';
      this.halfOpenCallCount = 0;
      console.log(`🔴 Circuit breaker re-opened`);
    }
  }

  private shouldAttemptReset(): boolean {
    const elapsed = Date.now() - this.lastFailureTime;
    
    if (elapsed >= this.config.recoveryTimeoutMs) {
      this.state = 'half_open';
      this.halfOpenCallCount = 0;
      console.log(`🟡 Circuit breaker half-open`);
      return true;
    }
    
    return false;
  }

  getState(): string {
    return this.state;
  }
}

export class RateLimiter {
  private config: RateLimitConfig;
  private tokens: number;
  private lastRefill: number;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.tokens = config.burstSize;
    this.lastRefill = Date.now();
  }

  allowRequest(): boolean {
    this.refillTokens();
    
    if (this.tokens > 0) {
      this.tokens--;
      return true;
    }
    
    return false;
  }

  private refillTokens(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = Math.floor(elapsed * this.config.requestsPerSecond / 1000);
    
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.config.burstSize, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }
}

export class LoadBalancer {
  private config: LoadBalancerConfig;
  private roundRobinIndex: number = 0;

  constructor(config: LoadBalancerConfig) {
    this.config = config;
  }

  selectEndpoint(endpoints: ServiceEndpoint[]): ServiceEndpoint | null {
    const healthyEndpoints = endpoints.filter(ep => ep.isHealthy);
    
    if (healthyEndpoints.length === 0) {
      return null;
    }

    switch (this.config.strategy) {
      case 'round_robin':
        return this.roundRobin(healthyEndpoints);
      case 'least_connections':
        return this.leastConnections(healthyEndpoints);
      case 'weighted':
        return this.weighted(healthyEndpoints);
      case 'random':
        return this.random(healthyEndpoints);
      default:
        return healthyEndpoints[0];
    }
  }

  private roundRobin(endpoints: ServiceEndpoint[]): ServiceEndpoint {
    const endpoint = endpoints[this.roundRobinIndex % endpoints.length];
    this.roundRobinIndex++;
    return endpoint;
  }

  private leastConnections(endpoints: ServiceEndpoint[]): ServiceEndpoint {
    // In a real implementation, would track connection counts
    return endpoints.reduce((min, current) => 
      current.responseTime < min.responseTime ? current : min
    );
  }

  private weighted(endpoints: ServiceEndpoint[]): ServiceEndpoint {
    // Simplified weighted selection based on response time
    const weights = endpoints.map(ep => 1 / (ep.responseTime + 1));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const random = Math.random() * totalWeight;
    
    let current = 0;
    for (let i = 0; i < endpoints.length; i++) {
      current += weights[i];
      if (random <= current) {
        return endpoints[i];
      }
    }
    
    return endpoints[0];
  }

  private random(endpoints: ServiceEndpoint[]): ServiceEndpoint {
    const index = Math.floor(Math.random() * endpoints.length);
    return endpoints[index];
  }
}

export class AuthProvider {
  private config: AuthConfig;
  private tokenCache: Map<string, { token: string; expiresAt: number }> = new Map();

  constructor(config: AuthConfig) {
    this.config = config;
  }

  async getAuthHeaders(): Promise<Record<string, string>> {
    switch (this.config.type) {
      case 'none':
        return {};
      case 'jwt':
        return this.getJWTHeaders();
      case 'oauth2':
        return this.getOAuth2Headers();
      case 'api_key':
        return this.getAPIKeyHeaders();
      case 'mtls':
        return this.getMTLSHeaders();
      default:
        return {};
    }
  }

  private async getJWTHeaders(): Promise<Record<string, string>> {
    const token = await this.getJWTToken();
    return { 'Authorization': `Bearer ${token}` };
  }

  private async getOAuth2Headers(): Promise<Record<string, string>> {
    const token = await this.getOAuth2Token();
    return { 'Authorization': `Bearer ${token}` };
  }

  private getAPIKeyHeaders(): Promise<Record<string, string>> {
    return Promise.resolve({ 'X-API-Key': 'your-api-key' });
  }

  private getMTLSHeaders(): Promise<Record<string, string>> {
    // mTLS is handled at the TLS layer, not in headers
    return Promise.resolve({});
  }

  private async getJWTToken(): Promise<string> {
    const cacheKey = 'jwt_token';
    const cached = this.tokenCache.get(cacheKey);
    
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    // Generate or fetch new JWT token
    const token = this.generateMockJWT();
    this.tokenCache.set(cacheKey, {
      token,
      expiresAt: Date.now() + 3600000, // 1 hour
    });

    return token;
  }

  private async getOAuth2Token(): Promise<string> {
    const cacheKey = 'oauth2_token';
    const cached = this.tokenCache.get(cacheKey);
    
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    // Fetch OAuth2 token from token endpoint
    const token = await this.fetchOAuth2Token();
    this.tokenCache.set(cacheKey, {
      token,
      expiresAt: Date.now() + 3600000, // 1 hour
    });

    return token;
  }

  private generateMockJWT(): string {
    // In a real implementation, would generate proper JWT
    return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock.jwt.token';
  }

  private async fetchOAuth2Token(): Promise<string> {
    // In a real implementation, would make HTTP request to token endpoint
    console.log(`🔑 Fetching OAuth2 token from ${this.config.tokenEndpoint}`);
    return 'mock_oauth2_token';
  }
}

export class ServiceRegistry {
  private services: Map<string, ServiceEndpoint[]> = new Map();
  private communicator: ServiceCommunicator;

  constructor(communicator: ServiceCommunicator) {
    this.communicator = communicator;
  }

  async register(endpoint: ServiceEndpoint): Promise<void> {
    if (!this.services.has(endpoint.serviceId)) {
      this.services.set(endpoint.serviceId, []);
    }
    
    this.services.get(endpoint.serviceId)!.push(endpoint);
    await this.communicator.registerService(endpoint);
  }

  async deregister(serviceId: string, endpointId: string): Promise<void> {
    const endpoints = this.services.get(serviceId);
    if (endpoints) {
      const filtered = endpoints.filter(ep => ep.serviceId !== endpointId);
      this.services.set(serviceId, filtered);
      await this.communicator.deregisterService(serviceId, endpointId);
    }
  }

  getService(serviceId: string): ServiceEndpoint[] {
    return this.services.get(serviceId) || [];
  }

  getAllServices(): Map<string, ServiceEndpoint[]> {
    return new Map(this.services);
  }
}

export class HealthcareServiceMesh {
  private communicator: HTTPServiceCommunicator;
  private registry: ServiceRegistry;

  constructor(config: CommunicationConfig) {
    this.communicator = new HTTPServiceCommunicator(config);
    this.registry = new ServiceRegistry(this.communicator);
    this.setupHealthcareServices();
  }

  private async setupHealthcareServices(): Promise<void> {
    const services: ServiceEndpoint[] = [
      {
        serviceId: 'patient-service',
        serviceName: 'Patient Management Service',
        version: '1.0.0',
        host: 'patient-service.internal',
        port: 8001,
        protocol: 'http',
        healthCheckPath: '/health',
        isHealthy: true,
        lastHealthCheck: new Date(),
        responseTime: 25,
        metadata: { region: 'us-east-1', datacenter: 'dc1' },
      },
      {
        serviceId: 'claims-service',
        serviceName: 'Claims Processing Service',
        version: '1.0.0',
        host: 'claims-service.internal',
        port: 8002,
        protocol: 'http',
        healthCheckPath: '/health',
        isHealthy: true,
        lastHealthCheck: new Date(),
        responseTime: 30,
        metadata: { region: 'us-east-1', datacenter: 'dc1' },
      },
      {
        serviceId: 'payment-service',
        serviceName: 'Payment Processing Service',
        version: '1.0.0',
        host: 'payment-service.internal',
        port: 8003,
        protocol: 'https',
        healthCheckPath: '/health',
        isHealthy: true,
        lastHealthCheck: new Date(),
        responseTime: 45,
        metadata: { region: 'us-east-1', datacenter: 'dc1' },
      },
      {
        serviceId: 'notification-service',
        serviceName: 'Notification Service',
        version: '1.0.0',
        host: 'notification-service.internal',
        port: 8004,
        protocol: 'http',
        healthCheckPath: '/health',
        isHealthy: true,
        lastHealthCheck: new Date(),
        responseTime: 20,
        metadata: { region: 'us-east-1', datacenter: 'dc1' },
      },
    ];

    for (const service of services) {
      await this.registry.register(service);
    }
  }

  async getPatientData(patientId: string): Promise<any> {
    const request: ServiceRequest = {
      requestId: this.generateRequestId(),
      serviceId: 'patient-service',
      method: 'GET',
      path: `/patients/${patientId}`,
      headers: { 'Content-Type': 'application/json' },
    };

    return this.communicator.call(request);
  }

  async submitClaim(claimData: any): Promise<any> {
    const request: ServiceRequest = {
      requestId: this.generateRequestId(),
      serviceId: 'claims-service',
      method: 'POST',
      path: '/claims',
      headers: { 'Content-Type': 'application/json' },
      body: claimData,
    };

    return this.communicator.call(request);
  }

  async processPayment(paymentData: any): Promise<any> {
    const request: ServiceRequest = {
      requestId: this.generateRequestId(),
      serviceId: 'payment-service',
      method: 'POST',
      path: '/payments',
      headers: { 'Content-Type': 'application/json' },
      body: paymentData,
    };

    return this.communicator.call(request);
  }

  async sendNotification(notificationData: any): Promise<any> {
    const request: ServiceRequest = {
      requestId: this.generateRequestId(),
      serviceId: 'notification-service',
      method: 'POST',
      path: '/notifications',
      headers: { 'Content-Type': 'application/json' },
      body: notificationData,
    };

    return this.communicator.call(request);
  }

  async getServiceHealth(): Promise<Record<string, boolean>> {
    const services = this.registry.getAllServices();
    const healthStatus: Record<string, boolean> = {};

    for (const [serviceId] of services) {
      healthStatus[serviceId] = await this.communicator.healthCheck(serviceId);
    }

    return healthStatus;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export class ServiceMeshManager {
  private serviceMesh: HealthcareServiceMesh;
  private metricsCollector: ServiceMeshMetrics;

  constructor(config: CommunicationConfig) {
    this.serviceMesh = new HealthcareServiceMesh(config);
    this.metricsCollector = new ServiceMeshMetrics();
  }

  async processClaimWorkflow(claimData: any): Promise<any> {
    const startTime = Date.now();
    
    try {
      // 1. Validate patient
      const patientResponse = await this.serviceMesh.getPatientData(claimData.patientId);
      
      // 2. Submit claim
      const claimResponse = await this.serviceMesh.submitClaim(claimData);
      
      // 3. Process payment if claim is approved
      let paymentResponse = null;
      if (claimResponse.body.status === 'approved') {
        paymentResponse = await this.serviceMesh.processPayment({
          claimId: claimResponse.body.claimId,
          amount: claimResponse.body.approvedAmount,
        });
      }
      
      // 4. Send notification
      await this.serviceMesh.sendNotification({
        type: 'claim_processed',
        patientId: claimData.patientId,
        claimId: claimResponse.body.claimId,
        status: claimResponse.body.status,
      });
      
      this.metricsCollector.recordWorkflow('claim_processing', Date.now() - startTime, true);
      
      return {
        success: true,
        claimId: claimResponse.body.claimId,
        status: claimResponse.body.status,
        paymentId: paymentResponse?.body?.paymentId,
      };
      
    } catch (error) {
      this.metricsCollector.recordWorkflow('claim_processing', Date.now() - startTime, false);
      throw error;
    }
  }

  async getSystemHealth(): Promise<any> {
    const serviceHealth = await this.serviceMesh.getServiceHealth();
    const metrics = this.metricsCollector.getMetrics();
    
    return {
      services: serviceHealth,
      metrics,
      overallHealth: Object.values(serviceHealth).every(health => health),
    };
  }
}

export class ServiceMeshMetrics {
  private metrics = {
    workflows: {
      claim_processing: { count: 0, totalTime: 0, errors: 0 },
    },
    services: {} as Record<string, { requests: number; errors: number; avgResponseTime: number }>,
  };

  recordWorkflow(workflow: string, duration: number, success: boolean): void {
    const workflowMetrics = this.metrics.workflows[workflow as keyof typeof this.metrics.workflows];
    
    if (workflowMetrics) {
      workflowMetrics.count++;
      workflowMetrics.totalTime += duration;
      
      if (!success) {
        workflowMetrics.errors++;
      }
    }
  }

  recordServiceCall(serviceId: string, responseTime: number, success: boolean): void {
    if (!this.metrics.services[serviceId]) {
      this.metrics.services[serviceId] = { requests: 0, errors: 0, avgResponseTime: 0 };
    }
    
    const serviceMetrics = this.metrics.services[serviceId];
    serviceMetrics.requests++;
    serviceMetrics.avgResponseTime = (serviceMetrics.avgResponseTime + responseTime) / 2;
    
    if (!success) {
      serviceMetrics.errors++;
    }
  }

  getMetrics(): any {
    return { ...this.metrics };
  }
}
