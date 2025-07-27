import { AuthenticationEvent } from '../types';
import { EventEmitter } from 'events';
import crypto from 'crypto';

interface Session {
  id: string;
  user_id: string;
  device_fingerprint: string;
  ip_address: string;
  user_agent: string;
  location: { country: string; city: string };
  created_at: Date;
  last_activity: Date;
  expires_at: Date;
  security_level: 'standard' | 'elevated' | 'privileged';
  mfa_verified: boolean;
  risk_score: number;
  concurrent_session_count: number;
  permissions: string[];
  revoked: boolean;
  revoke_reason?: string;
}

interface SessionPolicy {
  id: string;
  name: string;
  max_concurrent_sessions: number;
  idle_timeout_minutes: number;
  absolute_timeout_minutes: number;
  require_mfa_renewal: boolean;
  mfa_renewal_interval_minutes: number;
  risk_threshold: number;
  allowed_locations: string[];
  device_binding: boolean;
  enabled: boolean;
}

export class SessionManagementService extends EventEmitter {
  private sessions: Map<string, Session> = new Map();
  private sessionPolicies: SessionPolicy[] = [];
  private sessionTokens: Map<string, string> = new Map(); // token -> session_id

  async initialize(): Promise<void> {
    this.initializePolicies();
    this.startSessionMonitoring();
    this.emit('session_management_initialized');
  }

  async createSession(
    userId: string,
    deviceFingerprint: string,
    ipAddress: string,
    userAgent: string,
    location: { country: string; city: string },
    securityLevel: Session['security_level'] = 'standard'
  ): Promise<{ session_id: string; token: string; expires_at: Date; security_requirements: string[] }> {
    // Check concurrent session limits
    const policy = this.getApplicablePolicy(userId, securityLevel);
    const existingSessions = this.getActiveSessions(userId);
    
    if (existingSessions.length >= policy.max_concurrent_sessions) {
      // Revoke oldest session
      const oldestSession = existingSessions.sort((a, b) => a.last_activity.getTime() - b.last_activity.getTime())[0];
      await this.revokeSession(oldestSession.id, 'concurrent_limit_exceeded');
    }

    const sessionId = this.generateSessionId();
    const token = this.generateSecureToken();
    const expiresAt = new Date(Date.now() + policy.absolute_timeout_minutes * 60 * 1000);

    const session: Session = {
      id: sessionId,
      user_id: userId,
      device_fingerprint: deviceFingerprint,
      ip_address: ipAddress,
      user_agent: userAgent,
      location,
      created_at: new Date(),
      last_activity: new Date(),
      expires_at: expiresAt,
      security_level: securityLevel,
      mfa_verified: false,
      risk_score: await this.calculateSessionRisk(userId, ipAddress, location, deviceFingerprint),
      concurrent_session_count: existingSessions.length + 1,
      permissions: this.getDefaultPermissions(securityLevel),
      revoked: false
    };

    this.sessions.set(sessionId, session);
    this.sessionTokens.set(token, sessionId);

    const securityRequirements = this.determineSecurityRequirements(session, policy);

    this.emit('session_created', {
      session_id: sessionId,
      user_id: userId,
      security_level: securityLevel,
      risk_score: session.risk_score
    });

    return {
      session_id: sessionId,
      token,
      expires_at: expiresAt,
      security_requirements: securityRequirements
    };
  }

  async validateSession(token: string): Promise<{
    valid: boolean;
    session?: Session;
    requires_renewal?: boolean;
    security_actions?: string[];
  }> {
    const sessionId = this.sessionTokens.get(token);
    if (!sessionId) {
      return { valid: false };
    }

    const session = this.sessions.get(sessionId);
    if (!session || session.revoked || session.expires_at < new Date()) {
      return { valid: false };
    }

    const policy = this.getApplicablePolicy(session.user_id, session.security_level);
    const idleTime = Date.now() - session.last_activity.getTime();
    
    if (idleTime > policy.idle_timeout_minutes * 60 * 1000) {
      await this.revokeSession(sessionId, 'idle_timeout');
      return { valid: false };
    }

    // Update last activity
    session.last_activity = new Date();

    // Check if MFA renewal is required
    const requiresRenewal = this.checkMFARenewalRequired(session, policy);
    const securityActions = await this.assessSecurityActions(session, policy);

    return {
      valid: true,
      session,
      requires_renewal: requiresRenewal,
      security_actions: securityActions
    };
  }

  async renewSession(sessionId: string, mfaVerified: boolean = false): Promise<{
    renewed: boolean;
    new_expiry: Date;
    additional_permissions?: string[];
  }> {
    const session = this.sessions.get(sessionId);
    if (!session || session.revoked) {
      return { renewed: false, new_expiry: new Date() };
    }

    const policy = this.getApplicablePolicy(session.user_id, session.security_level);
    
    if (mfaVerified) {
      session.mfa_verified = true;
    }

    // Extend session
    session.expires_at = new Date(Date.now() + policy.absolute_timeout_minutes * 60 * 1000);
    session.last_activity = new Date();

    const additionalPermissions = mfaVerified ? this.getElevatedPermissions(session.security_level) : [];

    this.emit('session_renewed', {
      session_id: sessionId,
      user_id: session.user_id,
      mfa_verified: mfaVerified
    });

    return {
      renewed: true,
      new_expiry: session.expires_at,
      additional_permissions: additionalPermissions
    };
  }

  async revokeSession(sessionId: string, reason: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.revoked = true;
    session.revoke_reason = reason;

    // Remove token mapping
    for (const [token, id] of this.sessionTokens.entries()) {
      if (id === sessionId) {
        this.sessionTokens.delete(token);
        break;
      }
    }

    this.emit('session_revoked', {
      session_id: sessionId,
      user_id: session.user_id,
      reason
    });

    return true;
  }

  async revokeAllUserSessions(userId: string, reason: string): Promise<number> {
    const userSessions = this.getActiveSessions(userId);
    let revokedCount = 0;

    for (const session of userSessions) {
      const success = await this.revokeSession(session.id, reason);
      if (success) revokedCount++;
    }

    return revokedCount;
  }

  async getSessionStatistics(): Promise<{
    total_active_sessions: number;
    by_security_level: Record<string, number>;
    by_user: Record<string, number>;
    average_session_duration: number;
    high_risk_sessions: number;
    mfa_verified_sessions: number;
  }> {
    const activeSessions = Array.from(this.sessions.values()).filter(s => !s.revoked && s.expires_at > new Date());
    
    const bySecurityLevel: Record<string, number> = {};
    const byUser: Record<string, number> = {};
    let totalDuration = 0;
    let highRiskCount = 0;
    let mfaVerifiedCount = 0;

    activeSessions.forEach(session => {
      bySecurityLevel[session.security_level] = (bySecurityLevel[session.security_level] || 0) + 1;
      byUser[session.user_id] = (byUser[session.user_id] || 0) + 1;
      
      totalDuration += Date.now() - session.created_at.getTime();
      
      if (session.risk_score > 7) highRiskCount++;
      if (session.mfa_verified) mfaVerifiedCount++;
    });

    return {
      total_active_sessions: activeSessions.length,
      by_security_level: bySecurityLevel,
      by_user: byUser,
      average_session_duration: activeSessions.length > 0 ? totalDuration / activeSessions.length : 0,
      high_risk_sessions: highRiskCount,
      mfa_verified_sessions: mfaVerifiedCount
    };
  }

  async isHealthy(): Promise<boolean> {
    return this.sessionPolicies.filter(p => p.enabled).length > 0;
  }

  // Private methods
  private getActiveSessions(userId: string): Session[] {
    return Array.from(this.sessions.values()).filter(
      s => s.user_id === userId && !s.revoked && s.expires_at > new Date()
    );
  }

  private getApplicablePolicy(userId: string, securityLevel: string): SessionPolicy {
    return this.sessionPolicies.find(p => p.enabled) || this.sessionPolicies[0];
  }

  private generateSessionId(): string {
    return crypto.randomUUID();
  }

  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private async calculateSessionRisk(userId: string, ipAddress: string, location: any, deviceFingerprint: string): Promise<number> {
    let risk = 0;
    
    // Location risk
    if (location.country !== 'Vietnam') risk += 2;
    
    // IP risk (mock)
    if (ipAddress.startsWith('192.168.')) risk += 0; // Local network
    else risk += 1;
    
    // Device risk (mock)
    const knownDevice = Math.random() > 0.3; // 70% chance it's a known device
    if (!knownDevice) risk += 3;
    
    return Math.min(10, risk);
  }

  private getDefaultPermissions(securityLevel: string): string[] {
    const permissions = {
      'standard': ['read_basic', 'write_basic'],
      'elevated': ['read_basic', 'write_basic', 'read_sensitive'],
      'privileged': ['read_basic', 'write_basic', 'read_sensitive', 'write_sensitive', 'admin_functions']
    };
    return permissions[securityLevel] || permissions['standard'];
  }

  private getElevatedPermissions(securityLevel: string): string[] {
    if (securityLevel === 'privileged') {
      return ['super_admin', 'emergency_override'];
    }
    return ['read_sensitive', 'write_sensitive'];
  }

  private determineSecurityRequirements(session: Session, policy: SessionPolicy): string[] {
    const requirements = [];
    
    if (session.risk_score > policy.risk_threshold) {
      requirements.push('additional_verification');
    }
    
    if (session.security_level === 'privileged') {
      requirements.push('mfa_required');
    }
    
    if (policy.device_binding && !session.device_fingerprint) {
      requirements.push('device_registration');
    }
    
    return requirements;
  }

  private checkMFARenewalRequired(session: Session, policy: SessionPolicy): boolean {
    if (!policy.require_mfa_renewal) return false;
    
    const timeSinceCreation = Date.now() - session.created_at.getTime();
    return timeSinceCreation > policy.mfa_renewal_interval_minutes * 60 * 1000;
  }

  private async assessSecurityActions(session: Session, policy: SessionPolicy): Promise<string[]> {
    const actions = [];
    
    if (session.risk_score > 8) {
      actions.push('elevated_monitoring');
    }
    
    if (session.concurrent_session_count > 5) {
      actions.push('concurrent_session_warning');
    }
    
    return actions;
  }

  private startSessionMonitoring(): void {
    setInterval(() => {
      this.cleanupExpiredSessions();
      this.monitorSuspiciousActivity();
    }, 60 * 1000); // Every minute
  }

  private cleanupExpiredSessions(): void {
    const now = new Date();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expires_at < now && !session.revoked) {
        this.revokeSession(sessionId, 'expired');
      }
    }
  }

  private monitorSuspiciousActivity(): void {
    // Monitor for unusual patterns
    const activeSessions = Array.from(this.sessions.values()).filter(s => !s.revoked);
    
    // Group by user to detect anomalies
    const userSessions = new Map<string, Session[]>();
    activeSessions.forEach(session => {
      const sessions = userSessions.get(session.user_id) || [];
      sessions.push(session);
      userSessions.set(session.user_id, sessions);
    });

    userSessions.forEach((sessions, userId) => {
      // Check for sessions from multiple countries
      const countries = new Set(sessions.map(s => s.location.country));
      if (countries.size > 1) {
        this.emit('suspicious_activity', {
          type: 'multiple_countries',
          user_id: userId,
          countries: Array.from(countries)
        });
      }
    });
  }

  private initializePolicies(): void {
    this.sessionPolicies = [
      {
        id: 'healthcare_standard',
        name: 'Healthcare Standard Policy',
        max_concurrent_sessions: 3,
        idle_timeout_minutes: 30,
        absolute_timeout_minutes: 480, // 8 hours
        require_mfa_renewal: true,
        mfa_renewal_interval_minutes: 120, // 2 hours
        risk_threshold: 6,
        allowed_locations: ['Vietnam'],
        device_binding: true,
        enabled: true
      },
      {
        id: 'healthcare_privileged',
        name: 'Healthcare Privileged Policy',
        max_concurrent_sessions: 1,
        idle_timeout_minutes: 15,
        absolute_timeout_minutes: 240, // 4 hours
        require_mfa_renewal: true,
        mfa_renewal_interval_minutes: 60, // 1 hour
        risk_threshold: 3,
        allowed_locations: ['Vietnam'],
        device_binding: true,
        enabled: true
      }
    ];
  }
}
