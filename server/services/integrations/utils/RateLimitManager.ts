import { RateLimitConfig } from '../types';
import { IntegrationConfigManager } from '../config/IntegrationConfig';

interface RateLimitEntry {
  requests: number;
  resetTime: number;
}

export class RateLimitManager {
  private rateLimits: Map<string, RateLimitEntry> = new Map();
  private configManager: IntegrationConfigManager;

  constructor() {
    this.configManager = IntegrationConfigManager.getInstance();
    
    // Clean up expired entries every minute
    setInterval(() => this.cleanupExpiredEntries(), 60000);
  }

  public async checkRateLimit(service: string, requestId: string): Promise<void> {
    const config = this.configManager.getRateLimitConfig(service);
    const now = Date.now();
    const key = service;

    const entry = this.rateLimits.get(key);
    
    if (!entry || now >= entry.resetTime) {
      // Reset or create new entry
      this.rateLimits.set(key, {
        requests: 1,
        resetTime: now + config.windowMs
      });
      return;
    }

    if (entry.requests >= config.maxRequests) {
      const resetIn = Math.ceil((entry.resetTime - now) / 1000);
      throw new Error(`Rate limit exceeded for ${service}. Reset in ${resetIn} seconds.`);
    }

    // Increment request count
    entry.requests++;
    this.rateLimits.set(key, entry);
  }

  public getRemainingRequests(service: string): number {
    const config = this.configManager.getRateLimitConfig(service);
    const entry = this.rateLimits.get(service);
    
    if (!entry || Date.now() >= entry.resetTime) {
      return config.maxRequests;
    }
    
    return Math.max(0, config.maxRequests - entry.requests);
  }

  public getResetTime(service: string): Date | null {
    const entry = this.rateLimits.get(service);
    return entry ? new Date(entry.resetTime) : null;
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.rateLimits.entries()) {
      if (now >= entry.resetTime) {
        this.rateLimits.delete(key);
      }
    }
  }

  public resetRateLimit(service: string): void {
    this.rateLimits.delete(service);
  }

  public getAllRateLimits(): Record<string, {current: number, limit: number, resetTime: Date | null}> {
    const result: Record<string, {current: number, limit: number, resetTime: Date | null}> = {};
    
    for (const [service] of this.rateLimits.keys()) {
      const config = this.configManager.getRateLimitConfig(service);
      const entry = this.rateLimits.get(service);
      
      result[service] = {
        current: entry ? entry.requests : 0,
        limit: config.maxRequests,
        resetTime: entry ? new Date(entry.resetTime) : null
      };
    }
    
    return result;
  }
}
