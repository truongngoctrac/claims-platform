/**
 * Health Check Automation
 * Healthcare Claims Processing - Automated Health Monitoring
 */

import { HealthCheckConfig } from '../types';

interface HealthCheckResult {
  service: string;
  endpoint: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  timestamp: Date;
  error?: string;
  metadata?: any;
}

export class HealthCheckAutomation {
  private healthChecks: Map<string, HealthCheckResult[]> = new Map();
  private healthCheckIntervals: Map<string, NodeJS.Timer> = new Map();
  private config: HealthCheckConfig;

  constructor(config?: HealthCheckConfig) {
    this.config = config || {
      intervalSeconds: 30,
      timeoutSeconds: 10,
      failureThreshold: 3,
      successThreshold: 2,
      endpoints: [
        '/api/health',
        '/api/claims/health',
        '/api/users/health',
        '/api/policies/health'
      ]
    };
  }

  async initialize(): Promise<void> {
    console.log('🔄 Initializing Health Check Automation');
    
    // Initialize health check storage
    const services = [
      'claims-service',
      'user-service', 
      'policy-service',
      'database-cluster',
      'load-balancer',
      'api-gateway'
    ];

    for (const service of services) {
      this.healthChecks.set(service, []);
    }

    // Start automated health checks
    await this.startHealthChecks();
    
    console.log('✅ Health Check Automation initialized');
  }

  private async startHealthChecks(): Promise<void> {
    const services = Array.from(this.healthChecks.keys());
    
    for (const service of services) {
      const interval = setInterval(async () => {
        await this.performServiceHealthCheck(service);
      }, this.config.intervalSeconds * 1000);
      
      this.healthCheckIntervals.set(service, interval);
    }

    console.log(`🔄 Started health checks for ${services.length} services`);
  }

  private async performServiceHealthCheck(serviceName: string): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const endpoint = this.getServiceHealthEndpoint(serviceName);
      const result = await this.checkEndpoint(serviceName, endpoint);
      
      // Store health check result
      const history = this.healthChecks.get(serviceName) || [];
      history.push(result);
      
      // Keep only last 100 results
      if (history.length > 100) {
        history.shift();
      }
      
      this.healthChecks.set(serviceName, history);
      
      // Evaluate service health status
      await this.evaluateServiceHealth(serviceName);
      
      return result;
      
    } catch (error) {
      const result: HealthCheckResult = {
        service: serviceName,
        endpoint: this.getServiceHealthEndpoint(serviceName),
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : String(error)
      };
      
      const history = this.healthChecks.get(serviceName) || [];
      history.push(result);
      this.healthChecks.set(serviceName, history);
      
      return result;
    }
  }

  private getServiceHealthEndpoint(serviceName: string): string {
    const serviceEndpoints: { [key: string]: string } = {
      'claims-service': 'http://claims-service:3001/health',
      'user-service': 'http://user-service:3002/health',
      'policy-service': 'http://policy-service:3003/health',
      'database-cluster': 'mongodb://mongo-primary:27017/admin',
      'load-balancer': 'http://load-balancer:80/health',
      'api-gateway': 'http://api-gateway:8080/health'
    };
    
    return serviceEndpoints[serviceName] || `http://${serviceName}:3000/health`;
  }

  private async checkEndpoint(serviceName: string, endpoint: string): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Simulate health check based on service type
      const responseTime = await this.simulateHealthCheck(serviceName);
      
      const result: HealthCheckResult = {
        service: serviceName,
        endpoint,
        status: responseTime < 1000 ? 'healthy' : 'degraded',
        responseTime,
        timestamp: new Date(),
        metadata: await this.getServiceMetadata(serviceName)
      };
      
      return result;
      
    } catch (error) {
      throw new Error(`Health check failed for ${serviceName}: ${error}`);
    }
  }

  private async simulateHealthCheck(serviceName: string): Promise<number> {
    // Simulate different response times and occasional failures
    const baseResponseTime = Math.random() * 500;
    const jitter = Math.random() * 200;
    
    // Simulate occasional service issues
    if (Math.random() < 0.05) { // 5% chance of timeout
      throw new Error('Service timeout');
    }
    
    if (Math.random() < 0.02) { // 2% chance of connection refused
      throw new Error('Connection refused');
    }
    
    // Database checks are typically slower
    if (serviceName === 'database-cluster') {
      return baseResponseTime + 200 + jitter;
    }
    
    return baseResponseTime + jitter;
  }

  private async getServiceMetadata(serviceName: string): Promise<any> {
    // Return simulated service metadata
    return {
      version: '1.0.0',
      uptime: Math.floor(Math.random() * 86400), // seconds
      memoryUsage: Math.random() * 1024, // MB
      cpuUsage: Math.random() * 100, // percentage
      activeConnections: Math.floor(Math.random() * 100),
      requestsPerSecond: Math.floor(Math.random() * 1000)
    };
  }

  private async evaluateServiceHealth(serviceName: string): Promise<void> {
    const history = this.healthChecks.get(serviceName) || [];
    if (history.length === 0) return;

    const recentResults = history.slice(-this.config.failureThreshold);
    const failureCount = recentResults.filter(r => r.status === 'unhealthy').length;
    const successCount = recentResults.filter(r => r.status === 'healthy').length;

    // Check for service failure
    if (failureCount >= this.config.failureThreshold) {
      await this.handleServiceFailure(serviceName, recentResults);
    }
    
    // Check for service recovery
    if (successCount >= this.config.successThreshold && 
        history[history.length - this.config.successThreshold - 1]?.status === 'unhealthy') {
      await this.handleServiceRecovery(serviceName);
    }

    // Check for degraded performance
    const avgResponseTime = recentResults.reduce((sum, r) => sum + r.responseTime, 0) / recentResults.length;
    if (avgResponseTime > 2000) {
      await this.handleServiceDegradation(serviceName, avgResponseTime);
    }
  }

  private async handleServiceFailure(serviceName: string, failedChecks: HealthCheckResult[]): Promise<void> {
    console.error(`🚨 Service failure detected: ${serviceName}`);
    console.error(`Failed checks: ${failedChecks.map(c => c.error).join(', ')}`);
    
    // Trigger failover or scaling actions
    await this.triggerFailoverActions(serviceName);
    
    // Send alerts
    await this.sendAlert('CRITICAL', `Service ${serviceName} is down`, {
      service: serviceName,
      failureCount: failedChecks.length,
      lastError: failedChecks[failedChecks.length - 1]?.error
    });
  }

  private async handleServiceRecovery(serviceName: string): Promise<void> {
    console.log(`✅ Service recovery detected: ${serviceName}`);
    
    await this.sendAlert('INFO', `Service ${serviceName} has recovered`, {
      service: serviceName,
      timestamp: new Date()
    });
  }

  private async handleServiceDegradation(serviceName: string, avgResponseTime: number): Promise<void> {
    console.warn(`⚠️ Service degradation detected: ${serviceName} (avg response: ${avgResponseTime.toFixed(0)}ms)`);
    
    await this.sendAlert('WARNING', `Service ${serviceName} performance degraded`, {
      service: serviceName,
      averageResponseTime: avgResponseTime,
      threshold: 2000
    });
  }

  private async triggerFailoverActions(serviceName: string): Promise<void> {
    // Integration points for failover systems
    console.log(`🔄 Triggering failover actions for ${serviceName}`);
    
    switch (serviceName) {
      case 'database-cluster':
        // Trigger database failover
        console.log('📊 Initiating database failover');
        break;
      case 'load-balancer':
        // Switch to backup load balancer
        console.log('⚖️ Switching to backup load balancer');
        break;
      default:
        // Scale up service or restart container
        console.log(`📈 Scaling up ${serviceName} or restarting container`);
        break;
    }
  }

  private async sendAlert(severity: string, message: string, metadata: any): Promise<void> {
    // Integration with alerting systems (PagerDuty, Slack, email, etc.)
    const alert = {
      timestamp: new Date().toISOString(),
      severity,
      message,
      metadata,
      source: 'healthcare-claims-health-check'
    };
    
    console.log(`🚨 ALERT [${severity}]: ${message}`, alert);
    
    // In production, send to actual alerting systems
    // await pagerDuty.sendAlert(alert);
    // await slack.sendMessage(alert);
    // await emailService.sendAlert(alert);
  }

  async verifyServiceHealth(serviceName: string): Promise<boolean> {
    const result = await this.performServiceHealthCheck(serviceName);
    return result.status === 'healthy';
  }

  async getServiceHealth(serviceName: string): Promise<HealthCheckResult[]> {
    return this.healthChecks.get(serviceName) || [];
  }

  async getAllServicesHealth(): Promise<{ [serviceName: string]: HealthCheckResult[] }> {
    const result: { [serviceName: string]: HealthCheckResult[] } = {};
    
    for (const [serviceName, history] of this.healthChecks.entries()) {
      result[serviceName] = history;
    }
    
    return result;
  }

  async getHealthSummary(): Promise<any> {
    const summary: any = {
      totalServices: this.healthChecks.size,
      healthyServices: 0,
      unhealthyServices: 0,
      degradedServices: 0,
      lastCheckTime: new Date(),
      services: {}
    };

    for (const [serviceName, history] of this.healthChecks.entries()) {
      const latestCheck = history[history.length - 1];
      
      if (latestCheck) {
        summary.services[serviceName] = {
          status: latestCheck.status,
          responseTime: latestCheck.responseTime,
          lastCheck: latestCheck.timestamp,
          metadata: latestCheck.metadata
        };

        switch (latestCheck.status) {
          case 'healthy':
            summary.healthyServices++;
            break;
          case 'unhealthy':
            summary.unhealthyServices++;
            break;
          case 'degraded':
            summary.degradedServices++;
            break;
        }
      }
    }

    return summary;
  }

  async getMetrics(): Promise<any> {
    const summary = await this.getHealthSummary();
    
    return {
      ...summary,
      config: this.config,
      checksPerformed: Array.from(this.healthChecks.values())
        .reduce((total, history) => total + history.length, 0),
      averageResponseTime: this.calculateAverageResponseTime(),
      uptimePercentage: this.calculateUptimePercentage()
    };
  }

  private calculateAverageResponseTime(): number {
    let totalResponseTime = 0;
    let totalChecks = 0;

    for (const history of this.healthChecks.values()) {
      for (const check of history) {
        if (check.status === 'healthy' || check.status === 'degraded') {
          totalResponseTime += check.responseTime;
          totalChecks++;
        }
      }
    }

    return totalChecks > 0 ? totalResponseTime / totalChecks : 0;
  }

  private calculateUptimePercentage(): number {
    let totalChecks = 0;
    let successfulChecks = 0;

    for (const history of this.healthChecks.values()) {
      for (const check of history) {
        totalChecks++;
        if (check.status === 'healthy' || check.status === 'degraded') {
          successfulChecks++;
        }
      }
    }

    return totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 100;
  }

  async isHealthy(): Promise<boolean> {
    const summary = await this.getHealthSummary();
    return summary.unhealthyServices === 0;
  }

  async stopHealthChecks(): Promise<void> {
    console.log('⏹️ Stopping health checks');
    
    for (const [serviceName, interval] of this.healthCheckIntervals.entries()) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(serviceName);
    }
    
    console.log('✅ Health checks stopped');
  }

  async addService(serviceName: string, endpoint?: string): Promise<void> {
    if (!this.healthChecks.has(serviceName)) {
      this.healthChecks.set(serviceName, []);
      
      // Start health checks for the new service
      const interval = setInterval(async () => {
        await this.performServiceHealthCheck(serviceName);
      }, this.config.intervalSeconds * 1000);
      
      this.healthCheckIntervals.set(serviceName, interval);
      
      console.log(`➕ Added health checks for service: ${serviceName}`);
    }
  }

  async removeService(serviceName: string): Promise<void> {
    const interval = this.healthCheckIntervals.get(serviceName);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(serviceName);
    }
    
    this.healthChecks.delete(serviceName);
    
    console.log(`➖ Removed health checks for service: ${serviceName}`);
  }
}
