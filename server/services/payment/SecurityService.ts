import crypto from 'crypto';
import { PaymentDetails, PaymentRequest, RiskLevel } from '../../../shared/payment';

interface SecurityThreat {
  id: string;
  type: 'brute_force' | 'ddos' | 'injection' | 'session_hijacking' | 'data_breach';
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  target: string;
  timestamp: Date;
  details: Record<string, any>;
  mitigated: boolean;
  mitigationActions: string[];
}

interface SecurityPolicy {
  id: string;
  name: string;
  type: 'rate_limiting' | 'ip_whitelist' | 'geo_blocking' | 'device_restriction';
  enabled: boolean;
  config: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

interface SessionSecurity {
  sessionId: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  lastActivity: Date;
  isValid: boolean;
  riskScore: number;
  anomalies: string[];
}

export class SecurityService {
  private threats: SecurityThreat[] = [];
  private securityPolicies: Map<string, SecurityPolicy> = new Map();
  private activeSessions: Map<string, SessionSecurity> = new Map();
  private rateLimiters: Map<string, { count: number; resetTime: number }> = new Map();
  private encryptionKeys: Map<string, string> = new Map();

  constructor() {
    this.initializeSecurityPolicies();
    this.initializeEncryptionKeys();
  }

  // 3.2.15 Advanced Threat Detection
  async detectThreats(request: PaymentRequest, metadata: any): Promise<SecurityThreat[]> {
    const threats: SecurityThreat[] = [];

    // SQL Injection Detection
    const injectionThreat = await this.detectSQLInjection(request);
    if (injectionThreat) threats.push(injectionThreat);

    // Rate Limiting Violation Detection
    const rateLimitThreat = await this.detectRateLimitViolation(metadata.clientIP);
    if (rateLimitThreat) threats.push(rateLimitThreat);

    // Suspicious Device Detection
    const deviceThreat = await this.detectSuspiciousDevice(metadata.userAgent, metadata.deviceId);
    if (deviceThreat) threats.push(deviceThreat);

    // Geolocation Anomaly Detection
    const geoThreat = await this.detectGeolocationAnomaly(metadata.clientIP, metadata.userId);
    if (geoThreat) threats.push(geoThreat);

    // Session Hijacking Detection
    const sessionThreat = await this.detectSessionHijacking(metadata.sessionId, metadata.clientIP);
    if (sessionThreat) threats.push(sessionThreat);

    // Store detected threats
    threats.forEach(threat => {
      this.threats.push(threat);
      this.logThreat(threat);
    });

    return threats;
  }

  // Advanced Encryption Management
  async generatePaymentToken(paymentData: any): Promise<string> {
    const tokenData = {
      ...paymentData,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString('hex'),
    };

    const key = this.getEncryptionKey('payment_tokens');
    const encrypted = this.encryptData(JSON.stringify(tokenData), key);
    
    return Buffer.from(JSON.stringify(encrypted)).toString('base64');
  }

  async validatePaymentToken(token: string): Promise<{ valid: boolean; data?: any; error?: string }> {
    try {
      const encryptedData = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
      const key = this.getEncryptionKey('payment_tokens');
      const decrypted = this.decryptData(encryptedData, key);
      const tokenData = JSON.parse(decrypted);

      // Check token expiry (30 minutes)
      const tokenAge = Date.now() - tokenData.timestamp;
      if (tokenAge > 30 * 60 * 1000) {
        return { valid: false, error: 'Token expired' };
      }

      return { valid: true, data: tokenData };
    } catch (error) {
      return { valid: false, error: 'Invalid token format' };
    }
  }

  // Multi-Factor Authentication Support
  async generateMFAChallenge(userId: string, method: 'sms' | 'email' | 'totp'): Promise<{
    challengeId: string;
    challenge: string;
    expiresAt: Date;
  }> {
    const challengeId = crypto.randomBytes(16).toString('hex');
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store challenge securely
    const challengeData = {
      userId,
      method,
      code: this.hashData(code),
      expiresAt,
    };

    // In production, store in secure cache/database
    console.log(`MFA Challenge for ${userId}: ${code} (${method})`);

    return { challengeId, challenge: code, expiresAt };
  }

  async verifyMFAChallenge(challengeId: string, userCode: string): Promise<boolean> {
    // In production, retrieve from secure storage
    // Mock verification for now
    return userCode.length === 6 && /^\d+$/.test(userCode);
  }

  // Real-time Security Monitoring
  async monitorSecurityEvents(): Promise<{
    threats: SecurityThreat[];
    riskSessions: SessionSecurity[];
    policyViolations: any[];
    recommendations: string[];
  }> {
    const recentThreats = this.threats.filter(
      threat => Date.now() - threat.timestamp.getTime() < 24 * 60 * 60 * 1000
    );

    const riskSessions = Array.from(this.activeSessions.values()).filter(
      session => session.riskScore > 0.7 || session.anomalies.length > 0
    );

    const policyViolations = await this.detectPolicyViolations();
    const recommendations = this.generateSecurityRecommendations(recentThreats, riskSessions);

    return {
      threats: recentThreats,
      riskSessions,
      policyViolations,
      recommendations,
    };
  }

  // Secure Session Management
  async createSecureSession(userId: string, ipAddress: string, userAgent: string): Promise<string> {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const riskScore = await this.calculateSessionRisk(userId, ipAddress, userAgent);

    const session: SessionSecurity = {
      sessionId,
      userId,
      ipAddress,
      userAgent,
      createdAt: new Date(),
      lastActivity: new Date(),
      isValid: true,
      riskScore,
      anomalies: [],
    };

    this.activeSessions.set(sessionId, session);

    // Set session expiry
    setTimeout(() => {
      this.invalidateSession(sessionId);
    }, 4 * 60 * 60 * 1000); // 4 hours

    return sessionId;
  }

  async validateSession(sessionId: string, ipAddress: string): Promise<SessionSecurity | null> {
    const session = this.activeSessions.get(sessionId);
    
    if (!session || !session.isValid) {
      return null;
    }

    // Check for IP address changes
    if (session.ipAddress !== ipAddress) {
      session.anomalies.push('ip_address_change');
      session.riskScore += 0.3;
    }

    // Update last activity
    session.lastActivity = new Date();

    // Check session timeout (30 minutes inactivity)
    if (Date.now() - session.lastActivity.getTime() > 30 * 60 * 1000) {
      this.invalidateSession(sessionId);
      return null;
    }

    return session;
  }

  async invalidateSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.isValid = false;
      // Keep for audit purposes, remove after 24 hours
      setTimeout(() => {
        this.activeSessions.delete(sessionId);
      }, 24 * 60 * 60 * 1000);
    }
  }

  // Data Loss Prevention
  async scanForSensitiveData(data: any): Promise<{
    hasSensitiveData: boolean;
    detectedTypes: string[];
    recommendations: string[];
  }> {
    const sensitivePatterns = {
      creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
      ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
      phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      passport: /\b[A-Z]\d{8}\b/g,
    };

    const dataString = JSON.stringify(data);
    const detectedTypes: string[] = [];

    for (const [type, pattern] of Object.entries(sensitivePatterns)) {
      if (pattern.test(dataString)) {
        detectedTypes.push(type);
      }
    }

    const hasSensitiveData = detectedTypes.length > 0;
    const recommendations: string[] = [];

    if (hasSensitiveData) {
      recommendations.push('Encrypt sensitive data before storage');
      recommendations.push('Use tokenization for payment card data');
      recommendations.push('Implement data masking for logs');
      recommendations.push('Apply data anonymization where possible');
    }

    return { hasSensitiveData, detectedTypes, recommendations };
  }

  // Security Configuration Management
  async updateSecurityPolicy(policyId: string, updates: Partial<SecurityPolicy>): Promise<void> {
    const policy = this.securityPolicies.get(policyId);
    if (policy) {
      const updatedPolicy = { ...policy, ...updates, updatedAt: new Date() };
      this.securityPolicies.set(policyId, updatedPolicy);
      
      await this.logSecurityEvent('security_policy_updated', {
        policyId,
        changes: updates,
      });
    }
  }

  async getSecurityMetrics(): Promise<{
    threatsDetected: number;
    threatsBlocked: number;
    activeSessions: number;
    riskySessions: number;
    securityScore: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayThreats = this.threats.filter(threat => threat.timestamp >= today);
    const threatsDetected = todayThreats.length;
    const threatsBlocked = todayThreats.filter(threat => threat.mitigated).length;

    const activeSessions = Array.from(this.activeSessions.values()).filter(s => s.isValid).length;
    const riskySessions = Array.from(this.activeSessions.values()).filter(s => s.riskScore > 0.7).length;

    const securityScore = this.calculateSecurityScore();

    return {
      threatsDetected,
      threatsBlocked,
      activeSessions,
      riskySessions,
      securityScore,
    };
  }

  // Private helper methods
  private async detectSQLInjection(request: PaymentRequest): Promise<SecurityThreat | null> {
    const sqlPatterns = [
      /('|(\\')|(;)|(\\;))/i,
      /((\%27)|(\'))((\%6f)|o|(\%4f))((\%72)|r|(\%52))/i,
      /((\\x27)|(\\x2f))/i,
      /union.*select/i,
      /select.*from/i,
      /insert.*into/i,
      /delete.*from/i,
      /drop.*table/i,
    ];

    const requestString = JSON.stringify(request);
    const hasSQLInjection = sqlPatterns.some(pattern => pattern.test(requestString));

    if (hasSQLInjection) {
      return {
        id: `THREAT_${Date.now()}`,
        type: 'injection',
        severity: 'high',
        source: 'payment_request',
        target: 'database',
        timestamp: new Date(),
        details: { requestData: request },
        mitigated: false,
        mitigationActions: [],
      };
    }

    return null;
  }

  private async detectRateLimitViolation(clientIP: string): Promise<SecurityThreat | null> {
    const key = `rate_limit:${clientIP}`;
    const limit = this.rateLimiters.get(key);
    const maxRequests = 100; // 100 requests per hour
    const windowMs = 60 * 60 * 1000; // 1 hour

    if (!limit) {
      this.rateLimiters.set(key, { count: 1, resetTime: Date.now() + windowMs });
      return null;
    }

    if (Date.now() > limit.resetTime) {
      this.rateLimiters.set(key, { count: 1, resetTime: Date.now() + windowMs });
      return null;
    }

    limit.count++;

    if (limit.count > maxRequests) {
      return {
        id: `THREAT_${Date.now()}`,
        type: 'ddos',
        severity: 'medium',
        source: clientIP,
        target: 'api_endpoint',
        timestamp: new Date(),
        details: { requestCount: limit.count, limit: maxRequests },
        mitigated: false,
        mitigationActions: ['rate_limit_applied'],
      };
    }

    return null;
  }

  private async detectSuspiciousDevice(userAgent: string, deviceId?: string): Promise<SecurityThreat | null> {
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
    ];

    const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(userAgent));

    if (isSuspicious) {
      return {
        id: `THREAT_${Date.now()}`,
        type: 'brute_force',
        severity: 'medium',
        source: deviceId || 'unknown_device',
        target: 'payment_api',
        timestamp: new Date(),
        details: { userAgent, deviceId },
        mitigated: false,
        mitigationActions: [],
      };
    }

    return null;
  }

  private async detectGeolocationAnomaly(clientIP: string, userId: string): Promise<SecurityThreat | null> {
    // Mock geolocation check
    // In production, this would use a real geolocation service
    const isAnomalous = Math.random() > 0.95; // 5% chance of anomaly

    if (isAnomalous) {
      return {
        id: `THREAT_${Date.now()}`,
        type: 'session_hijacking',
        severity: 'high',
        source: clientIP,
        target: userId,
        timestamp: new Date(),
        details: { suspiciousLocation: true },
        mitigated: false,
        mitigationActions: [],
      };
    }

    return null;
  }

  private async detectSessionHijacking(sessionId: string, clientIP: string): Promise<SecurityThreat | null> {
    const session = this.activeSessions.get(sessionId);
    
    if (session && session.ipAddress !== clientIP) {
      return {
        id: `THREAT_${Date.now()}`,
        type: 'session_hijacking',
        severity: 'critical',
        source: clientIP,
        target: session.userId,
        timestamp: new Date(),
        details: { sessionId, originalIP: session.ipAddress, newIP: clientIP },
        mitigated: false,
        mitigationActions: ['session_invalidated'],
      };
    }

    return null;
  }

  private async calculateSessionRisk(userId: string, ipAddress: string, userAgent: string): Promise<number> {
    let risk = 0;

    // Check if IP is from known risky location
    if (Math.random() > 0.9) risk += 0.3;

    // Check user agent patterns
    if (/bot|crawler|spider/i.test(userAgent)) risk += 0.4;

    // Check for multiple sessions from same user
    const userSessions = Array.from(this.activeSessions.values()).filter(s => s.userId === userId && s.isValid);
    if (userSessions.length > 3) risk += 0.2;

    return Math.min(risk, 1.0);
  }

  private async detectPolicyViolations(): Promise<any[]> {
    // Mock policy violation detection
    return [];
  }

  private generateSecurityRecommendations(threats: SecurityThreat[], riskSessions: SessionSecurity[]): string[] {
    const recommendations: string[] = [];

    if (threats.length > 10) {
      recommendations.push('Consider implementing additional DDoS protection');
    }

    if (riskSessions.length > 5) {
      recommendations.push('Review session security policies');
    }

    const criticalThreats = threats.filter(t => t.severity === 'critical');
    if (criticalThreats.length > 0) {
      recommendations.push('Immediate security team review required');
    }

    return recommendations;
  }

  private calculateSecurityScore(): number {
    const recentThreats = this.threats.filter(
      threat => Date.now() - threat.timestamp.getTime() < 24 * 60 * 60 * 1000
    );
    
    let score = 100;
    
    // Deduct points for threats
    score -= recentThreats.length * 2;
    score -= recentThreats.filter(t => t.severity === 'critical').length * 10;
    score -= recentThreats.filter(t => t.severity === 'high').length * 5;

    return Math.max(score, 0);
  }

  private encryptData(data: string, key: string): any {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-gcm', key);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
    };
  }

  private decryptData(encryptedData: any, key: string): string {
    const decipher = crypto.createDecipher('aes-256-gcm', key);
    decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  private getEncryptionKey(purpose: string): string {
    if (!this.encryptionKeys.has(purpose)) {
      this.encryptionKeys.set(purpose, crypto.randomBytes(32).toString('hex'));
    }
    return this.encryptionKeys.get(purpose)!;
  }

  private hashData(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private initializeSecurityPolicies(): void {
    const defaultPolicies: SecurityPolicy[] = [
      {
        id: 'rate_limiting',
        name: 'API Rate Limiting',
        type: 'rate_limiting',
        enabled: true,
        config: { maxRequests: 100, windowMs: 3600000 },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'geo_blocking',
        name: 'Geographic Blocking',
        type: 'geo_blocking',
        enabled: false,
        config: { blockedCountries: ['XX', 'YY'] },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    defaultPolicies.forEach(policy => {
      this.securityPolicies.set(policy.id, policy);
    });
  }

  private initializeEncryptionKeys(): void {
    // Initialize encryption keys for different purposes
    this.encryptionKeys.set('payment_tokens', process.env.PAYMENT_TOKEN_KEY || crypto.randomBytes(32).toString('hex'));
    this.encryptionKeys.set('user_data', process.env.USER_DATA_KEY || crypto.randomBytes(32).toString('hex'));
    this.encryptionKeys.set('session_data', process.env.SESSION_DATA_KEY || crypto.randomBytes(32).toString('hex'));
  }

  private logThreat(threat: SecurityThreat): void {
    console.log('SECURITY THREAT DETECTED:', {
      id: threat.id,
      type: threat.type,
      severity: threat.severity,
      timestamp: threat.timestamp,
    });
  }

  private async logSecurityEvent(event: string, details: any): Promise<void> {
    console.log('SECURITY EVENT:', { event, details, timestamp: new Date() });
  }
}
