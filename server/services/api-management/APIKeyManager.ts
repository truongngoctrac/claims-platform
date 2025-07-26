import crypto from 'crypto';
import { EventEmitter } from 'events';
import bcrypt from 'bcryptjs';

export interface APIKey {
  id: string;
  name: string;
  key: string;
  hashedKey: string;
  environment: 'production' | 'staging' | 'development';
  type: 'live' | 'test';
  userId: string;
  organizationId: string;
  scopes: string[];
  permissions: APIPermission[];
  status: 'active' | 'inactive' | 'revoked' | 'expired';
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  lastUsedAt?: Date;
  usageCount: number;
  rateLimits: {
    requestsPerSecond: number;
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
    requestsPerMonth: number;
  };
  ipWhitelist: string[];
  allowedOrigins: string[];
  metadata: Record<string, any>;
  rotationSchedule?: {
    enabled: boolean;
    intervalDays: number;
    notifyBeforeDays: number;
  };
  webhookUrl?: string;
  description?: string;
  tags: string[];
}

export interface APIPermission {
  resource: string;
  actions: string[];
  conditions?: {
    ipRestrictions?: string[];
    timeRestrictions?: {
      allowedHours: number[];
      allowedDays: number[];
      timezone: string;
    };
    amountLimits?: {
      maxClaimAmount: number;
      dailyLimit: number;
      monthlyLimit: number;
    };
  };
}

export interface APIKeyUsage {
  keyId: string;
  timestamp: Date;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  ipAddress: string;
  userAgent: string;
  requestSize: number;
  responseSize: number;
  error?: string;
  metadata: Record<string, any>;
}

export interface APIKeyStats {
  keyId: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastUsed: Date;
  topEndpoints: { endpoint: string; count: number }[];
  errorBreakdown: { error: string; count: number }[];
  hourlyUsage: { hour: number; requests: number }[];
  dailyUsage: { date: string; requests: number }[];
  bandwidthUsed: number;
  rateLimitHits: number;
}

export interface KeyGenerationOptions {
  name: string;
  environment: 'production' | 'staging' | 'development';
  type: 'live' | 'test';
  userId: string;
  organizationId: string;
  scopes: string[];
  permissions: APIPermission[];
  expiresIn?: number; // days
  rateLimits?: Partial<APIKey['rateLimits']>;
  ipWhitelist?: string[];
  allowedOrigins?: string[];
  description?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export class APIKeyManager extends EventEmitter {
  private keys: Map<string, APIKey> = new Map();
  private hashedKeys: Map<string, string> = new Map(); // hashedKey -> keyId
  private usage: Map<string, APIKeyUsage[]> = new Map();
  private stats: Map<string, APIKeyStats> = new Map();
  private cleanupInterval: NodeJS.Timer;

  constructor() {
    super();
    this.initializeDefaultKeys();
    this.startCleanupTasks();
  }

  private initializeDefaultKeys(): void {
    // Create default system keys for different environments
    const defaultKeys = [
      {
        name: 'System Admin Key',
        environment: 'production' as const,
        type: 'live' as const,
        userId: 'system',
        organizationId: 'healthclaim-system',
        scopes: ['*'],
        permissions: [
          {
            resource: '*',
            actions: ['*']
          }
        ],
        description: 'System-level administrative access',
        tags: ['system', 'admin']
      },
      {
        name: 'Integration Test Key',
        environment: 'development' as const,
        type: 'test' as const,
        userId: 'test-user',
        organizationId: 'test-org',
        scopes: ['claims:read', 'claims:submit'],
        permissions: [
          {
            resource: 'claims',
            actions: ['read', 'submit'],
            conditions: {
              amountLimits: {
                maxClaimAmount: 1000000,
                dailyLimit: 10000000,
                monthlyLimit: 100000000
              }
            }
          }
        ],
        description: 'Key for integration testing',
        tags: ['test', 'integration']
      }
    ];

    for (const keyConfig of defaultKeys) {
      this.generateKey(keyConfig);
    }
  }

  public generateKey(options: KeyGenerationOptions): APIKey {
    const keyId = crypto.randomUUID();
    const rawKey = this.generateRawKey(options.environment, options.type);
    const hashedKey = bcrypt.hashSync(rawKey, 10);

    const now = new Date();
    const expiresAt = options.expiresIn 
      ? new Date(now.getTime() + options.expiresIn * 24 * 60 * 60 * 1000)
      : undefined;

    const defaultRateLimits = {
      requestsPerSecond: 10,
      requestsPerMinute: 100,
      requestsPerHour: 1000,
      requestsPerDay: 10000,
      requestsPerMonth: 100000
    };

    const apiKey: APIKey = {
      id: keyId,
      name: options.name,
      key: rawKey,
      hashedKey,
      environment: options.environment,
      type: options.type,
      userId: options.userId,
      organizationId: options.organizationId,
      scopes: options.scopes,
      permissions: options.permissions,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      expiresAt,
      usageCount: 0,
      rateLimits: { ...defaultRateLimits, ...options.rateLimits },
      ipWhitelist: options.ipWhitelist || [],
      allowedOrigins: options.allowedOrigins || [],
      metadata: options.metadata || {},
      description: options.description,
      tags: options.tags || []
    };

    this.keys.set(keyId, apiKey);
    this.hashedKeys.set(hashedKey, keyId);
    this.initializeKeyStats(keyId);

    this.emit('key-generated', apiKey);
    return apiKey;
  }

  private generateRawKey(environment: string, type: string): string {
    const prefix = `hc_${type}_${environment.charAt(0)}`;
    const randomBytes = crypto.randomBytes(32);
    const encoded = randomBytes.toString('base64url');
    return `${prefix}_${encoded}`;
  }

  public validateKey(rawKey: string): {
    valid: boolean;
    key?: APIKey;
    reason?: string;
  } {
    // Find the key by comparing with all hashed keys
    for (const [hashedKey, keyId] of this.hashedKeys.entries()) {
      if (bcrypt.compareSync(rawKey, hashedKey)) {
        const key = this.keys.get(keyId);
        
        if (!key) {
          return { valid: false, reason: 'Key not found' };
        }

        // Check if key is active
        if (key.status !== 'active') {
          return { valid: false, reason: `Key is ${key.status}` };
        }

        // Check if key is expired
        if (key.expiresAt && new Date() > key.expiresAt) {
          this.updateKeyStatus(keyId, 'expired');
          return { valid: false, reason: 'Key has expired' };
        }

        // Update last used timestamp
        this.updateKeyUsage(keyId);

        return { valid: true, key };
      }
    }

    return { valid: false, reason: 'Invalid key' };
  }

  public revokeKey(keyId: string, reason?: string): boolean {
    const key = this.keys.get(keyId);
    if (!key) return false;

    key.status = 'revoked';
    key.updatedAt = new Date();
    key.metadata.revocationReason = reason;

    this.emit('key-revoked', { keyId, reason });
    return true;
  }

  public rotateKey(keyId: string): APIKey | null {
    const oldKey = this.keys.get(keyId);
    if (!oldKey) return null;

    // Generate new key with same configuration
    const newKey = this.generateKey({
      name: `${oldKey.name} (Rotated)`,
      environment: oldKey.environment,
      type: oldKey.type,
      userId: oldKey.userId,
      organizationId: oldKey.organizationId,
      scopes: oldKey.scopes,
      permissions: oldKey.permissions,
      expiresIn: oldKey.expiresAt ? Math.ceil((oldKey.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : undefined,
      rateLimits: oldKey.rateLimits,
      ipWhitelist: oldKey.ipWhitelist,
      allowedOrigins: oldKey.allowedOrigins,
      description: oldKey.description,
      tags: oldKey.tags,
      metadata: { ...oldKey.metadata, rotatedFrom: keyId }
    });

    // Mark old key as rotated
    oldKey.status = 'revoked';
    oldKey.metadata.rotatedTo = newKey.id;
    oldKey.updatedAt = new Date();

    this.emit('key-rotated', { oldKeyId: keyId, newKeyId: newKey.id });
    return newKey;
  }

  public updateKeyPermissions(keyId: string, permissions: APIPermission[]): boolean {
    const key = this.keys.get(keyId);
    if (!key) return false;

    key.permissions = permissions;
    key.updatedAt = new Date();

    this.emit('key-permissions-updated', { keyId, permissions });
    return true;
  }

  public updateRateLimits(keyId: string, rateLimits: Partial<APIKey['rateLimits']>): boolean {
    const key = this.keys.get(keyId);
    if (!key) return false;

    key.rateLimits = { ...key.rateLimits, ...rateLimits };
    key.updatedAt = new Date();

    this.emit('key-rate-limits-updated', { keyId, rateLimits });
    return true;
  }

  public addIPToWhitelist(keyId: string, ip: string): boolean {
    const key = this.keys.get(keyId);
    if (!key) return false;

    if (!key.ipWhitelist.includes(ip)) {
      key.ipWhitelist.push(ip);
      key.updatedAt = new Date();
      this.emit('ip-whitelisted', { keyId, ip });
    }
    
    return true;
  }

  public removeIPFromWhitelist(keyId: string, ip: string): boolean {
    const key = this.keys.get(keyId);
    if (!key) return false;

    const index = key.ipWhitelist.indexOf(ip);
    if (index > -1) {
      key.ipWhitelist.splice(index, 1);
      key.updatedAt = new Date();
      this.emit('ip-removed-from-whitelist', { keyId, ip });
    }
    
    return true;
  }

  public checkRateLimit(keyId: string, endpoint: string): {
    allowed: boolean;
    remainingRequests: number;
    resetTime: Date;
    limitType: string;
  } {
    const key = this.keys.get(keyId);
    if (!key) {
      return { allowed: false, remainingRequests: 0, resetTime: new Date(), limitType: 'none' };
    }

    const now = Date.now();
    const stats = this.stats.get(keyId);
    if (!stats) {
      return { allowed: true, remainingRequests: key.rateLimits.requestsPerSecond, resetTime: new Date(now + 1000), limitType: 'per-second' };
    }

    // Check per-second limit
    const secondWindow = Math.floor(now / 1000) * 1000;
    const secondRequests = this.getRequestsInWindow(keyId, secondWindow, 1000);
    if (secondRequests >= key.rateLimits.requestsPerSecond) {
      return {
        allowed: false,
        remainingRequests: 0,
        resetTime: new Date(secondWindow + 1000),
        limitType: 'per-second'
      };
    }

    // Check per-minute limit
    const minuteWindow = Math.floor(now / 60000) * 60000;
    const minuteRequests = this.getRequestsInWindow(keyId, minuteWindow, 60000);
    if (minuteRequests >= key.rateLimits.requestsPerMinute) {
      return {
        allowed: false,
        remainingRequests: 0,
        resetTime: new Date(minuteWindow + 60000),
        limitType: 'per-minute'
      };
    }

    // Check per-hour limit
    const hourWindow = Math.floor(now / 3600000) * 3600000;
    const hourRequests = this.getRequestsInWindow(keyId, hourWindow, 3600000);
    if (hourRequests >= key.rateLimits.requestsPerHour) {
      return {
        allowed: false,
        remainingRequests: 0,
        resetTime: new Date(hourWindow + 3600000),
        limitType: 'per-hour'
      };
    }

    // Check per-day limit
    const dayWindow = Math.floor(now / 86400000) * 86400000;
    const dayRequests = this.getRequestsInWindow(keyId, dayWindow, 86400000);
    if (dayRequests >= key.rateLimits.requestsPerDay) {
      return {
        allowed: false,
        remainingRequests: 0,
        resetTime: new Date(dayWindow + 86400000),
        limitType: 'per-day'
      };
    }

    return {
      allowed: true,
      remainingRequests: key.rateLimits.requestsPerSecond - secondRequests,
      resetTime: new Date(secondWindow + 1000),
      limitType: 'per-second'
    };
  }

  private getRequestsInWindow(keyId: string, windowStart: number, windowSize: number): number {
    const usage = this.usage.get(keyId) || [];
    const windowEnd = windowStart + windowSize;
    
    return usage.filter(record => 
      record.timestamp.getTime() >= windowStart && 
      record.timestamp.getTime() < windowEnd
    ).length;
  }

  public logUsage(keyId: string, usageData: Omit<APIKeyUsage, 'keyId' | 'timestamp'>): void {
    const usage: APIKeyUsage = {
      keyId,
      timestamp: new Date(),
      ...usageData
    };

    const keyUsage = this.usage.get(keyId) || [];
    keyUsage.push(usage);
    
    // Keep only last 10000 usage records per key
    if (keyUsage.length > 10000) {
      keyUsage.shift();
    }
    
    this.usage.set(keyId, keyUsage);
    this.updateStats(keyId, usage);
  }

  private updateStats(keyId: string, usage: APIKeyUsage): void {
    let stats = this.stats.get(keyId);
    if (!stats) {
      this.initializeKeyStats(keyId);
      stats = this.stats.get(keyId)!;
    }

    stats.totalRequests++;
    stats.lastUsed = usage.timestamp;
    stats.bandwidthUsed += usage.requestSize + usage.responseSize;

    if (usage.statusCode >= 200 && usage.statusCode < 400) {
      stats.successfulRequests++;
    } else {
      stats.failedRequests++;
      
      if (usage.error) {
        const errorEntry = stats.errorBreakdown.find(e => e.error === usage.error);
        if (errorEntry) {
          errorEntry.count++;
        } else {
          stats.errorBreakdown.push({ error: usage.error, count: 1 });
        }
      }
    }

    // Update response time average
    stats.averageResponseTime = 
      (stats.averageResponseTime * (stats.totalRequests - 1) + usage.responseTime) / stats.totalRequests;

    // Update top endpoints
    const endpointEntry = stats.topEndpoints.find(e => e.endpoint === usage.endpoint);
    if (endpointEntry) {
      endpointEntry.count++;
    } else {
      stats.topEndpoints.push({ endpoint: usage.endpoint, count: 1 });
    }
    
    // Keep only top 10 endpoints
    stats.topEndpoints.sort((a, b) => b.count - a.count);
    stats.topEndpoints = stats.topEndpoints.slice(0, 10);

    // Update hourly usage
    const hour = usage.timestamp.getHours();
    const hourEntry = stats.hourlyUsage.find(h => h.hour === hour);
    if (hourEntry) {
      hourEntry.requests++;
    } else {
      stats.hourlyUsage.push({ hour, requests: 1 });
    }

    // Update daily usage
    const date = usage.timestamp.toISOString().split('T')[0];
    const dayEntry = stats.dailyUsage.find(d => d.date === date);
    if (dayEntry) {
      dayEntry.requests++;
    } else {
      stats.dailyUsage.push({ date, requests: 1 });
    }
    
    // Keep only last 30 days
    stats.dailyUsage.sort((a, b) => b.date.localeCompare(a.date));
    stats.dailyUsage = stats.dailyUsage.slice(0, 30);
  }

  private initializeKeyStats(keyId: string): void {
    this.stats.set(keyId, {
      keyId,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastUsed: new Date(),
      topEndpoints: [],
      errorBreakdown: [],
      hourlyUsage: [],
      dailyUsage: [],
      bandwidthUsed: 0,
      rateLimitHits: 0
    });
  }

  private updateKeyUsage(keyId: string): void {
    const key = this.keys.get(keyId);
    if (key) {
      key.lastUsedAt = new Date();
      key.usageCount++;
    }
  }

  private updateKeyStatus(keyId: string, status: APIKey['status']): void {
    const key = this.keys.get(keyId);
    if (key) {
      key.status = status;
      key.updatedAt = new Date();
      this.emit('key-status-changed', { keyId, status });
    }
  }

  private startCleanupTasks(): void {
    // Clean up old usage records every hour
    this.cleanupInterval = setInterval(() => {
      const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      
      for (const [keyId, usage] of this.usage.entries()) {
        const filtered = usage.filter(record => record.timestamp > cutoffDate);
        this.usage.set(keyId, filtered);
      }
    }, 60 * 60 * 1000); // 1 hour

    // Check for expired keys every day
    setInterval(() => {
      const now = new Date();
      for (const [keyId, key] of this.keys.entries()) {
        if (key.expiresAt && now > key.expiresAt && key.status === 'active') {
          this.updateKeyStatus(keyId, 'expired');
        }
      }
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  // Public API methods
  public getKey(keyId: string): APIKey | undefined {
    return this.keys.get(keyId);
  }

  public getKeyByUserId(userId: string): APIKey[] {
    return Array.from(this.keys.values()).filter(key => key.userId === userId);
  }

  public getKeysByOrganization(organizationId: string): APIKey[] {
    return Array.from(this.keys.values()).filter(key => key.organizationId === organizationId);
  }

  public getKeysByEnvironment(environment: string): APIKey[] {
    return Array.from(this.keys.values()).filter(key => key.environment === environment);
  }

  public getKeyStats(keyId: string): APIKeyStats | undefined {
    return this.stats.get(keyId);
  }

  public getKeyUsage(keyId: string, limit: number = 100): APIKeyUsage[] {
    const usage = this.usage.get(keyId) || [];
    return usage.slice(-limit);
  }

  public getAllKeys(): APIKey[] {
    return Array.from(this.keys.values());
  }

  public getActiveKeys(): APIKey[] {
    return Array.from(this.keys.values()).filter(key => key.status === 'active');
  }

  public searchKeys(query: {
    name?: string;
    userId?: string;
    organizationId?: string;
    environment?: string;
    status?: string;
    tags?: string[];
  }): APIKey[] {
    return Array.from(this.keys.values()).filter(key => {
      if (query.name && !key.name.toLowerCase().includes(query.name.toLowerCase())) return false;
      if (query.userId && key.userId !== query.userId) return false;
      if (query.organizationId && key.organizationId !== query.organizationId) return false;
      if (query.environment && key.environment !== query.environment) return false;
      if (query.status && key.status !== query.status) return false;
      if (query.tags && !query.tags.every(tag => key.tags.includes(tag))) return false;
      return true;
    });
  }

  public exportKeys(keyIds?: string[]): any[] {
    const keysToExport = keyIds 
      ? keyIds.map(id => this.keys.get(id)).filter(Boolean) as APIKey[]
      : Array.from(this.keys.values());

    return keysToExport.map(key => ({
      id: key.id,
      name: key.name,
      environment: key.environment,
      type: key.type,
      userId: key.userId,
      organizationId: key.organizationId,
      scopes: key.scopes,
      permissions: key.permissions,
      status: key.status,
      createdAt: key.createdAt,
      expiresAt: key.expiresAt,
      lastUsedAt: key.lastUsedAt,
      usageCount: key.usageCount,
      rateLimits: key.rateLimits,
      ipWhitelist: key.ipWhitelist,
      allowedOrigins: key.allowedOrigins,
      description: key.description,
      tags: key.tags
      // Note: Excluding actual key and hashedKey for security
    }));
  }

  public getSystemStats(): {
    totalKeys: number;
    activeKeys: number;
    revokedKeys: number;
    expiredKeys: number;
    totalRequests: number;
    requestsToday: number;
    averageResponseTime: number;
    topUsers: { userId: string; requests: number }[];
  } {
    const keys = Array.from(this.keys.values());
    const stats = Array.from(this.stats.values());
    
    const today = new Date().toISOString().split('T')[0];
    const requestsToday = stats.reduce((sum, stat) => {
      const todayUsage = stat.dailyUsage.find(d => d.date === today);
      return sum + (todayUsage?.requests || 0);
    }, 0);

    const totalRequests = stats.reduce((sum, stat) => sum + stat.totalRequests, 0);
    const averageResponseTime = stats.length > 0 
      ? stats.reduce((sum, stat) => sum + stat.averageResponseTime, 0) / stats.length 
      : 0;

    // Calculate top users by request count
    const userRequests = new Map<string, number>();
    keys.forEach(key => {
      const keyStats = this.stats.get(key.id);
      if (keyStats) {
        const current = userRequests.get(key.userId) || 0;
        userRequests.set(key.userId, current + keyStats.totalRequests);
      }
    });

    const topUsers = Array.from(userRequests.entries())
      .map(([userId, requests]) => ({ userId, requests }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);

    return {
      totalKeys: keys.length,
      activeKeys: keys.filter(k => k.status === 'active').length,
      revokedKeys: keys.filter(k => k.status === 'revoked').length,
      expiredKeys: keys.filter(k => k.status === 'expired').length,
      totalRequests,
      requestsToday,
      averageResponseTime,
      topUsers
    };
  }

  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.removeAllListeners();
  }
}

// Export singleton instance
let instance: APIKeyManager | null = null;

export function getAPIKeyManager(): APIKeyManager {
  if (!instance) {
    instance = new APIKeyManager();
  }
  return instance;
}
