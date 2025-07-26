import { RetryConfig } from '../types';
import { IntegrationConfigManager } from '../config/IntegrationConfig';

export class RetryManager {
  private configManager: IntegrationConfigManager;

  constructor() {
    this.configManager = IntegrationConfigManager.getInstance();
  }

  public async executeWithRetry<T>(
    operation: () => Promise<T>,
    service: string,
    customConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const config = { ...this.configManager.getRetryConfig(), ...customConfig };
    let lastError: Error;
    
    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Don't retry on final attempt
        if (attempt === config.maxAttempts) {
          break;
        }
        
        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          throw lastError;
        }
        
        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt, config);
        await this.sleep(delay);
        
        console.log(`Retry attempt ${attempt + 1}/${config.maxAttempts} for ${service} after ${delay}ms delay`);
      }
    }
    
    throw lastError!;
  }

  private isRetryableError(error: any): boolean {
    // Network errors
    if (error.code === 'ECONNRESET' || 
        error.code === 'ENOTFOUND' || 
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT') {
      return true;
    }
    
    // HTTP status codes that are retryable
    if (error.response && error.response.status) {
      const status = error.response.status;
      return status === 429 || // Too Many Requests
             status === 500 || // Internal Server Error
             status === 502 || // Bad Gateway
             status === 503 || // Service Unavailable
             status === 504;   // Gateway Timeout
    }
    
    // Timeout errors
    if (error.message && error.message.includes('timeout')) {
      return true;
    }
    
    return false;
  }

  private calculateDelay(attempt: number, config: RetryConfig): number {
    const exponentialDelay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    const jitteredDelay = exponentialDelay * (0.5 + Math.random() * 0.5); // Add jitter
    return Math.min(jitteredDelay, config.maxDelay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    service: string,
    options: {
      failureThreshold?: number;
      resetTimeout?: number;
      monitoringPeriod?: number;
    } = {}
  ): Promise<T> {
    const {
      failureThreshold = 5,
      resetTimeout = 60000, // 1 minute
      monitoringPeriod = 600000 // 10 minutes
    } = options;

    const circuitKey = `circuit_${service}`;
    const now = Date.now();
    
    // Get circuit state from cache/storage (simplified version)
    const circuitState = this.getCircuitState(circuitKey);
    
    // Check if circuit is open
    if (circuitState.state === 'open') {
      if (now - circuitState.lastFailureTime < resetTimeout) {
        throw new Error(`Circuit breaker is open for ${service}. Try again later.`);
      } else {
        // Move to half-open state
        circuitState.state = 'half-open';
        this.updateCircuitState(circuitKey, circuitState);
      }
    }
    
    try {
      const result = await operation();
      
      // Success - reset circuit if it was half-open
      if (circuitState.state === 'half-open') {
        circuitState.state = 'closed';
        circuitState.failureCount = 0;
        this.updateCircuitState(circuitKey, circuitState);
      }
      
      return result;
    } catch (error) {
      circuitState.failureCount++;
      circuitState.lastFailureTime = now;
      
      // Open circuit if failure threshold exceeded
      if (circuitState.failureCount >= failureThreshold) {
        circuitState.state = 'open';
      }
      
      this.updateCircuitState(circuitKey, circuitState);
      throw error;
    }
  }

  private getCircuitState(key: string): {
    state: 'closed' | 'open' | 'half-open';
    failureCount: number;
    lastFailureTime: number;
  } {
    // In a real implementation, this would be stored in Redis or similar
    // For now, using in-memory storage
    if (!this.circuitStates) {
      this.circuitStates = new Map();
    }
    
    return this.circuitStates.get(key) || {
      state: 'closed',
      failureCount: 0,
      lastFailureTime: 0
    };
  }

  private circuitStates?: Map<string, any>;

  private updateCircuitState(key: string, state: any): void {
    if (!this.circuitStates) {
      this.circuitStates = new Map();
    }
    this.circuitStates.set(key, state);
  }

  public async batchExecuteWithRetry<T>(
    operations: Array<() => Promise<T>>,
    service: string,
    options: {
      concurrency?: number;
      retryConfig?: Partial<RetryConfig>;
    } = {}
  ): Promise<Array<{success: boolean; data?: T; error?: string}>> {
    const { concurrency = 5, retryConfig } = options;
    const results: Array<{success: boolean; data?: T; error?: string}> = [];
    
    // Process operations in batches
    for (let i = 0; i < operations.length; i += concurrency) {
      const batch = operations.slice(i, i + concurrency);
      
      const batchResults = await Promise.allSettled(
        batch.map(operation => 
          this.executeWithRetry(operation, service, retryConfig)
        )
      );
      
      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push({ success: true, data: result.value });
        } else {
          results.push({ 
            success: false, 
            error: result.reason?.message || 'Unknown error' 
          });
        }
      });
    }
    
    return results;
  }

  public getRetryMetrics(service: string): {
    totalRetries: number;
    successfulRetries: number;
    failedRetries: number;
    averageAttempts: number;
  } {
    // In a real implementation, this would track actual metrics
    // Placeholder implementation
    return {
      totalRetries: 0,
      successfulRetries: 0,
      failedRetries: 0,
      averageAttempts: 1
    };
  }
}
