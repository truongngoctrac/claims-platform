/**
 * Circuit Breaker Manager
 * Healthcare Claims Processing - Circuit Breaker Pattern Implementation
 */

import { CircuitBreakerConfig } from '../types';

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

interface CircuitBreakerStatus {
  serviceName: string;
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
  nextRetryTime?: Date;
}

export class CircuitBreakerManager {
  private circuitBreakers: Map<string, CircuitBreakerStatus> = new Map();
  private configs: Map<string, CircuitBreakerConfig> = new Map();

  async initialize(): Promise<void> {
    console.log('🔄 Initializing Circuit Breaker Manager');
    
    const services = ['claims-service', 'user-service', 'policy-service'];
    
    for (const service of services) {
      await this.setupCircuitBreaker(service);
    }
    
    console.log('✅ Circuit Breaker Manager initialized');
  }

  private async setupCircuitBreaker(serviceName: string): Promise<void> {
    const config: CircuitBreakerConfig = {
      failureThreshold: 5,
      resetTimeoutMs: 60000,
      monitoringPeriodMs: 10000,
      expectedExceptionTypes: ['TimeoutError', 'ConnectionError', 'ServiceUnavailable']
    };

    this.configs.set(serviceName, config);
    this.circuitBreakers.set(serviceName, {
      serviceName,
      state: CircuitState.CLOSED,
      failureCount: 0,
      successCount: 0
    });

    console.log(`⚡ Circuit breaker configured for ${serviceName}`);
  }

  async recordSuccess(serviceName: string): Promise<void> {
    const breaker = this.circuitBreakers.get(serviceName);
    if (!breaker) return;

    breaker.successCount++;
    
    if (breaker.state === CircuitState.HALF_OPEN && breaker.successCount >= 3) {
      this.closeCircuit(serviceName);
    }
    
    this.circuitBreakers.set(serviceName, breaker);
  }

  async recordFailure(serviceName: string, error: string): Promise<void> {
    const breaker = this.circuitBreakers.get(serviceName);
    const config = this.configs.get(serviceName);
    
    if (!breaker || !config) return;

    breaker.failureCount++;
    breaker.lastFailureTime = new Date();
    
    if (breaker.failureCount >= config.failureThreshold) {
      this.openCircuit(serviceName);
    }
    
    this.circuitBreakers.set(serviceName, breaker);
  }

  private openCircuit(serviceName: string): void {
    const breaker = this.circuitBreakers.get(serviceName);
    const config = this.configs.get(serviceName);
    
    if (!breaker || !config) return;

    breaker.state = CircuitState.OPEN;
    breaker.nextRetryTime = new Date(Date.now() + config.resetTimeoutMs);
    
    console.log(`🚫 Circuit breaker OPENED for ${serviceName}`);
    this.circuitBreakers.set(serviceName, breaker);
  }

  private closeCircuit(serviceName: string): void {
    const breaker = this.circuitBreakers.get(serviceName);
    if (!breaker) return;

    breaker.state = CircuitState.CLOSED;
    breaker.failureCount = 0;
    breaker.successCount = 0;
    breaker.nextRetryTime = undefined;
    
    console.log(`✅ Circuit breaker CLOSED for ${serviceName}`);
    this.circuitBreakers.set(serviceName, breaker);
  }

  async canExecute(serviceName: string): Promise<boolean> {
    const breaker = this.circuitBreakers.get(serviceName);
    if (!breaker) return true;

    switch (breaker.state) {
      case CircuitState.CLOSED:
        return true;
      
      case CircuitState.OPEN:
        if (breaker.nextRetryTime && Date.now() >= breaker.nextRetryTime.getTime()) {
          breaker.state = CircuitState.HALF_OPEN;
          breaker.successCount = 0;
          this.circuitBreakers.set(serviceName, breaker);
          console.log(`🔄 Circuit breaker HALF-OPEN for ${serviceName}`);
          return true;
        }
        return false;
      
      case CircuitState.HALF_OPEN:
        return true;
      
      default:
        return false;
    }
  }

  async getMetrics(): Promise<any> {
    const metrics: any = {
      totalCircuitBreakers: this.circuitBreakers.size,
      states: { CLOSED: 0, OPEN: 0, HALF_OPEN: 0 },
      services: {}
    };

    for (const [serviceName, breaker] of this.circuitBreakers.entries()) {
      metrics.states[breaker.state]++;
      metrics.services[serviceName] = {
        state: breaker.state,
        failureCount: breaker.failureCount,
        successCount: breaker.successCount,
        lastFailureTime: breaker.lastFailureTime,
        nextRetryTime: breaker.nextRetryTime
      };
    }

    return metrics;
  }

  async isHealthy(): Promise<boolean> {
    const openCircuits = Array.from(this.circuitBreakers.values())
      .filter(cb => cb.state === CircuitState.OPEN).length;
    
    return openCircuits === 0;
  }
}
