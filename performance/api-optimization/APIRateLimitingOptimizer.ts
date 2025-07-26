import { Request, Response, NextFunction } from 'express';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  algorithm: 'fixed' | 'sliding' | 'token-bucket' | 'leaky-bucket';
  keyGenerator: (req: Request) => string;
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
  enableBurst: boolean;
  burstSize?: number;
  queueSize?: number;
  costFunction?: (req: Request) => number;
}

export interface RateLimitEntry {
  count: number;
  resetTime: Date;
  tokens?: number;
  queue?: Array<{request: Request, resolve: Function, reject: Function}>;
  lastRefill?: Date;
}

export interface RateLimitStats {
  totalRequests: number;
  blockedRequests: number;
  averageLatency: number;
  peakRequestsPerSecond: number;
  currentActiveKeys: number;
  queuedRequests: number;
}

export class APIRateLimitingOptimizer {
  private store: Map<string, RateLimitEntry> = new Map();
  private config: RateLimitConfig;
  private stats: RateLimitStats;
  private cleanupInterval: NodeJS.Timeout;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.stats = {
      totalRequests: 0,
      blockedRequests: 0,
      averageLatency: 0,
      peakRequestsPerSecond: 0,
      currentActiveKeys: 0,
      queuedRequests: 0
    };
    
    this.startCleanup();
  }

  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      this.stats.totalRequests++;

      const key = this.config.keyGenerator(req);
      const cost = this.config.costFunction ? this.config.costFunction(req) : 1;

      try {
        const allowed = await this.checkRateLimit(key, cost, req);
        
        if (!allowed) {
          this.stats.blockedRequests++;
          
          res.status(429).json({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded',
            retryAfter: this.getRetryAfter(key)
          });
          
          return;
        }

        // Add rate limit headers
        this.addRateLimitHeaders(res, key);
        
        // Track latency
        const latency = Date.now() - startTime;
        this.updateLatencyStats(latency);

        next();
      } catch (error) {
        console.error('Rate limiting error:', error);
        next(); // Fail open
      }
    };
  }

  private async checkRateLimit(key: string, cost: number, req: Request): Promise<boolean> {
    switch (this.config.algorithm) {
      case 'fixed':
        return this.checkFixedWindow(key, cost);
      case 'sliding':
        return this.checkSlidingWindow(key, cost);
      case 'token-bucket':
        return this.checkTokenBucket(key, cost);
      case 'leaky-bucket':
        return this.checkLeakyBucket(key, cost, req);
      default:
        return true;
    }
  }

  private checkFixedWindow(key: string, cost: number): boolean {
    const now = new Date();
    let entry = this.store.get(key);

    if (!entry) {
      entry = {
        count: 0,
        resetTime: new Date(now.getTime() + this.config.windowMs)
      };
      this.store.set(key, entry);
    }

    // Check if window has expired
    if (now >= entry.resetTime) {
      entry.count = 0;
      entry.resetTime = new Date(now.getTime() + this.config.windowMs);
    }

    if (entry.count + cost <= this.config.maxRequests) {
      entry.count += cost;
      return true;
    }

    return false;
  }

  private checkSlidingWindow(key: string, cost: number): boolean {
    const now = Date.now();
    let entry = this.store.get(key);

    if (!entry) {
      entry = {
        count: 0,
        resetTime: new Date(now + this.config.windowMs),
        tokens: this.config.maxRequests
      };
      this.store.set(key, entry);
    }

    // Calculate how much the window has slid
    const timePassed = now - (entry.resetTime.getTime() - this.config.windowMs);
    const windowProgress = Math.min(timePassed / this.config.windowMs, 1);
    
    // Restore tokens based on window progress
    const tokensToRestore = Math.floor(this.config.maxRequests * windowProgress);
    entry.tokens = Math.min(this.config.maxRequests, (entry.tokens || 0) + tokensToRestore);
    entry.resetTime = new Date(now + this.config.windowMs - (timePassed % this.config.windowMs));

    if ((entry.tokens || 0) >= cost) {
      entry.tokens = (entry.tokens || 0) - cost;
      return true;
    }

    return false;
  }

  private checkTokenBucket(key: string, cost: number): boolean {
    const now = new Date();
    let entry = this.store.get(key);

    if (!entry) {
      entry = {
        count: 0,
        resetTime: now,
        tokens: this.config.maxRequests,
        lastRefill: now
      };
      this.store.set(key, entry);
    }

    // Refill tokens
    const timeSinceLastRefill = now.getTime() - (entry.lastRefill?.getTime() || now.getTime());
    const tokensToAdd = Math.floor(timeSinceLastRefill / this.config.windowMs * this.config.maxRequests);
    
    if (tokensToAdd > 0) {
      entry.tokens = Math.min(this.config.maxRequests, (entry.tokens || 0) + tokensToAdd);
      entry.lastRefill = now;
    }

    // Handle burst if enabled
    const maxTokens = this.config.enableBurst && this.config.burstSize ? 
      this.config.burstSize : this.config.maxRequests;

    if ((entry.tokens || 0) >= cost) {
      entry.tokens = (entry.tokens || 0) - cost;
      return true;
    }

    return false;
  }

  private async checkLeakyBucket(key: string, cost: number, req: Request): Promise<boolean> {
    let entry = this.store.get(key);

    if (!entry) {
      entry = {
        count: 0,
        resetTime: new Date(),
        queue: []
      };
      this.store.set(key, entry);
    }

    // Process queue (leak)
    this.processQueue(key);

    const queueSize = this.config.queueSize || this.config.maxRequests;
    
    if ((entry.queue?.length || 0) < queueSize) {
      // Add to queue
      return new Promise((resolve, reject) => {
        entry!.queue!.push({ request: req, resolve, reject });
        this.stats.queuedRequests++;
        
        // Set timeout for queued request
        setTimeout(() => {
          reject(new Error('Request timeout in queue'));
        }, this.config.windowMs);
      });
    }

    return false;
  }

  private processQueue(key: string): void {
    const entry = this.store.get(key);
    if (!entry || !entry.queue) return;

    const now = Date.now();
    const processingRate = this.config.maxRequests / this.config.windowMs;
    const itemsToProcess = Math.floor(processingRate);

    for (let i = 0; i < itemsToProcess && entry.queue.length > 0; i++) {
      const queuedItem = entry.queue.shift()!;
      this.stats.queuedRequests--;
      queuedItem.resolve(true);
    }
  }

  private getRetryAfter(key: string): number {
    const entry = this.store.get(key);
    if (!entry) return Math.ceil(this.config.windowMs / 1000);

    const now = Date.now();
    const resetTime = entry.resetTime.getTime();
    
    return Math.ceil((resetTime - now) / 1000);
  }

  private addRateLimitHeaders(res: Response, key: string): void {
    const entry = this.store.get(key);
    if (!entry) return;

    const remaining = Math.max(0, this.config.maxRequests - entry.count);
    const resetTime = Math.ceil(entry.resetTime.getTime() / 1000);

    res.set({
      'X-RateLimit-Limit': this.config.maxRequests.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': resetTime.toString(),
      'X-RateLimit-Window': this.config.windowMs.toString()
    });

    if (this.config.algorithm === 'token-bucket' && entry.tokens !== undefined) {
      res.set('X-RateLimit-Tokens', entry.tokens.toString());
    }

    if (entry.queue?.length) {
      res.set('X-RateLimit-Queue', entry.queue.length.toString());
    }
  }

  private updateLatencyStats(latency: number): void {
    this.stats.averageLatency = 
      (this.stats.averageLatency * (this.stats.totalRequests - 1) + latency) / 
      this.stats.totalRequests;
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Every minute
  }

  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.store.entries()) {
      // Remove expired entries
      if (entry.resetTime.getTime() < now - this.config.windowMs) {
        this.store.delete(key);
        cleanedCount++;
      }
    }

    this.stats.currentActiveKeys = this.store.size;

    if (cleanedCount > 0) {
      console.log(`Rate limit cleanup: removed ${cleanedCount} expired entries`);
    }
  }

  // Dynamic rate limiting based on system load
  adjustRatesBasedOnLoad(systemLoad: {
    cpuUsage: number;
    memoryUsage: number;
    activeConnections: number;
  }): void {
    let multiplier = 1;

    // Reduce rate limit if system is under stress
    if (systemLoad.cpuUsage > 80) {
      multiplier *= 0.7;
    } else if (systemLoad.cpuUsage > 60) {
      multiplier *= 0.85;
    }

    if (systemLoad.memoryUsage > 85) {
      multiplier *= 0.6;
    } else if (systemLoad.memoryUsage > 70) {
      multiplier *= 0.8;
    }

    if (systemLoad.activeConnections > 1000) {
      multiplier *= 0.8;
    }

    const newMaxRequests = Math.floor(this.config.maxRequests * multiplier);
    
    if (newMaxRequests !== this.config.maxRequests) {
      console.log(`Adjusting rate limit: ${this.config.maxRequests} → ${newMaxRequests} (load-based)`);
      this.config.maxRequests = newMaxRequests;
    }
  }

  // Implement progressive rate limiting
  getProgressiveLimit(key: string): number {
    const entry = this.store.get(key);
    if (!entry) return this.config.maxRequests;

    const violationHistory = this.getViolationHistory(key);
    
    if (violationHistory.length === 0) {
      return this.config.maxRequests;
    }

    // Reduce limit based on violation frequency
    const recentViolations = violationHistory.filter(
      time => Date.now() - time < 3600000 // Last hour
    ).length;

    const reductionFactor = Math.min(0.5, recentViolations * 0.1);
    return Math.floor(this.config.maxRequests * (1 - reductionFactor));
  }

  private getViolationHistory(key: string): number[] {
    // This would typically be stored in a separate structure
    // For simplicity, returning empty array
    return [];
  }

  // Whitelist/blacklist functionality
  private whitelistedKeys = new Set<string>();
  private blacklistedKeys = new Set<string>();

  addToWhitelist(key: string): void {
    this.whitelistedKeys.add(key);
  }

  removeFromWhitelist(key: string): void {
    this.whitelistedKeys.delete(key);
  }

  addToBlacklist(key: string): void {
    this.blacklistedKeys.add(key);
  }

  removeFromBlacklist(key: string): void {
    this.blacklistedKeys.delete(key);
  }

  isWhitelisted(key: string): boolean {
    return this.whitelistedKeys.has(key);
  }

  isBlacklisted(key: string): boolean {
    return this.blacklistedKeys.has(key);
  }

  getStats(): RateLimitStats {
    this.stats.currentActiveKeys = this.store.size;
    return { ...this.stats };
  }

  getTopConsumers(limit: number = 10): Array<{
    key: string;
    requests: number;
    tokensRemaining?: number;
    queueLength?: number;
  }> {
    return Array.from(this.store.entries())
      .map(([key, entry]) => ({
        key,
        requests: entry.count,
        tokensRemaining: entry.tokens,
        queueLength: entry.queue?.length
      }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, limit);
  }

  generateReport(): {
    blockingRate: number;
    averageLatency: number;
    peakUsage: number;
    recommendations: string[];
  } {
    const blockingRate = this.stats.totalRequests > 0 ? 
      (this.stats.blockedRequests / this.stats.totalRequests) * 100 : 0;

    const recommendations: string[] = [];

    if (blockingRate > 10) {
      recommendations.push('Consider increasing rate limits or implementing tiered pricing');
    }

    if (this.stats.averageLatency > 100) {
      recommendations.push('High latency detected - consider optimizing rate limiting algorithm');
    }

    if (this.stats.queuedRequests > this.config.maxRequests * 0.8) {
      recommendations.push('Queue utilization is high - consider increasing processing capacity');
    }

    return {
      blockingRate,
      averageLatency: this.stats.averageLatency,
      peakUsage: this.stats.peakRequestsPerSecond,
      recommendations
    };
  }

  reset(): void {
    this.store.clear();
    this.stats = {
      totalRequests: 0,
      blockedRequests: 0,
      averageLatency: 0,
      peakRequestsPerSecond: 0,
      currentActiveKeys: 0,
      queuedRequests: 0
    };
  }

  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
    console.log('API rate limiting optimizer shutdown complete');
  }
}

// Predefined rate limiting configurations
export const RateLimitPresets = {
  strict: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
    algorithm: 'sliding' as const,
    keyGenerator: (req: Request) => req.ip,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    enableBurst: false
  },

  standard: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    algorithm: 'token-bucket' as const,
    keyGenerator: (req: Request) => req.ip,
    skipSuccessfulRequests: false,
    skipFailedRequests: true,
    enableBurst: true,
    burstSize: 150
  },

  generous: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 500,
    algorithm: 'fixed' as const,
    keyGenerator: (req: Request) => req.ip,
    skipSuccessfulRequests: true,
    skipFailedRequests: true,
    enableBurst: true,
    burstSize: 1000
  },

  apiKey: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 1000,
    algorithm: 'sliding' as const,
    keyGenerator: (req: Request) => req.get('x-api-key') || req.ip,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    enableBurst: true,
    burstSize: 1500,
    costFunction: (req: Request) => {
      // Different endpoints have different costs
      if (req.path.includes('/batch')) return 10;
      if (req.path.includes('/search')) return 5;
      return 1;
    }
  }
};
