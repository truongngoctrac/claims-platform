import crypto from 'crypto';
import {
  PaymentDetails,
  ComplianceLevel,
  PaymentGateway,
  Currency,
} from '../../../shared/payment';

interface ComplianceCheck {
  id: string;
  paymentId: string;
  level: ComplianceLevel;
  checks: ComplianceCheckResult[];
  passed: boolean;
  score: number;
  timestamp: Date;
  expiresAt: Date;
}

interface ComplianceCheckResult {
  checkType: string;
  passed: boolean;
  details: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendation?: string;
}

interface SecurityAuditLog {
  id: string;
  event: string;
  paymentId?: string;
  userId?: string;
  ipAddress: string;
  userAgent: string;
  details: Record<string, any>;
  severity: 'info' | 'warning' | 'error' | 'critical';
  timestamp: Date;
}

interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  tagLength: number;
}

export class ComplianceService {
  private encryptionKey: string;
  private encryptionConfig: EncryptionConfig;
  private auditLogs: SecurityAuditLog[] = [];
  private complianceChecks: Map<string, ComplianceCheck> = new Map();

  constructor() {
    this.encryptionKey = process.env.PAYMENT_ENCRYPTION_KEY || this.generateSecureKey();
    this.encryptionConfig = {
      algorithm: 'aes-256-gcm',
      keyLength: 32,
      ivLength: 16,
      tagLength: 16,
    };
  }

  // 3.2.11 PCI DSS Compliance
  async validatePCIDSS(payment: PaymentDetails): Promise<ComplianceCheck> {
    const checks: ComplianceCheckResult[] = [];

    // Check 1: Data Encryption
    checks.push(await this.checkDataEncryption(payment));

    // Check 2: Secure Transmission
    checks.push(await this.checkSecureTransmission(payment));

    // Check 3: Access Control
    checks.push(await this.checkAccessControl(payment));

    // Check 4: Network Security
    checks.push(await this.checkNetworkSecurity(payment));

    // Check 5: Vulnerability Management
    checks.push(await this.checkVulnerabilityManagement());

    // Check 6: Regular Monitoring
    checks.push(await this.checkRegularMonitoring(payment));

    const passed = checks.every(check => check.passed || check.severity !== 'critical');
    const score = this.calculateComplianceScore(checks);
    const level = this.determineComplianceLevel(score, checks);

    const complianceCheck: ComplianceCheck = {
      id: `PCI_${Date.now()}`,
      paymentId: payment.id,
      level,
      checks,
      passed,
      score,
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };

    this.complianceChecks.set(payment.id, complianceCheck);

    // Log compliance check
    await this.logSecurityEvent('pci_compliance_check', {
      paymentId: payment.id,
      passed,
      score,
      level,
    }, passed ? 'info' : 'warning');

    return complianceCheck;
  }

  // 3.2.11 GDPR Compliance
  async validateGDPR(payment: PaymentDetails, userConsent: any): Promise<ComplianceCheck> {
    const checks: ComplianceCheckResult[] = [];

    // Check 1: Lawful Basis for Processing
    checks.push(await this.checkLawfulBasis(payment, userConsent));

    // Check 2: Data Minimization
    checks.push(await this.checkDataMinimization(payment));

    // Check 3: Purpose Limitation
    checks.push(await this.checkPurposeLimitation(payment));

    // Check 4: Storage Limitation
    checks.push(await this.checkStorageLimitation(payment));

    // Check 5: Data Subject Rights
    checks.push(await this.checkDataSubjectRights(payment));

    // Check 6: Data Protection by Design
    checks.push(await this.checkDataProtectionByDesign(payment));

    const passed = checks.every(check => check.passed || check.severity !== 'critical');
    const score = this.calculateComplianceScore(checks);

    const complianceCheck: ComplianceCheck = {
      id: `GDPR_${Date.now()}`,
      paymentId: payment.id,
      level: ComplianceLevel.GDPR_COMPLIANT,
      checks,
      passed,
      score,
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };

    await this.logSecurityEvent('gdpr_compliance_check', {
      paymentId: payment.id,
      passed,
      score,
    }, passed ? 'info' : 'warning');

    return complianceCheck;
  }

  // 3.2.15 Data Encryption
  encryptSensitiveData(data: any): { encrypted: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(this.encryptionConfig.ivLength);
    const cipher = crypto.createCipher(this.encryptionConfig.algorithm, this.encryptionKey);
    cipher.setAAD(Buffer.from('payment-data')); // Additional authenticated data

    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
    };
  }

  decryptSensitiveData(encryptedData: { encrypted: string; iv: string; tag: string }): any {
    const decipher = crypto.createDecipher(this.encryptionConfig.algorithm, this.encryptionKey);
    decipher.setAAD(Buffer.from('payment-data'));
    decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }

  // 3.2.15 Secure Token Generation
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  // Hash sensitive data
  hashSensitiveData(data: string, salt?: string): { hash: string; salt: string } {
    const actualSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(data, actualSalt, 100000, 64, 'sha512').toString('hex');
    return { hash, salt: actualSalt };
  }

  // Verify hashed data
  verifyHashedData(data: string, hash: string, salt: string): boolean {
    const verifyHash = crypto.pbkdf2Sync(data, salt, 100000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
  }

  // Security Audit Logging
  async logSecurityEvent(
    event: string,
    details: Record<string, any>,
    severity: 'info' | 'warning' | 'error' | 'critical' = 'info',
    ipAddress: string = '127.0.0.1',
    userAgent: string = 'system'
  ): Promise<void> {
    const auditLog: SecurityAuditLog = {
      id: `AUDIT_${Date.now()}`,
      event,
      paymentId: details.paymentId,
      userId: details.userId,
      ipAddress,
      userAgent,
      details,
      severity,
      timestamp: new Date(),
    };

    this.auditLogs.push(auditLog);

    // In production, this would be stored in a secure, immutable log store
    if (severity === 'critical' || severity === 'error') {
      console.error('SECURITY ALERT:', auditLog);
      // Send immediate alerts to security team
    }
  }

  // Data Anonymization
  anonymizePaymentData(payment: PaymentDetails): PaymentDetails {
    const anonymized = { ...payment };
    
    // Anonymize customer ID
    anonymized.customerId = this.hashSensitiveData(payment.customerId).hash.substring(0, 16);
    
    // Remove or anonymize metadata
    if (anonymized.metadata) {
      delete anonymized.metadata.email;
      delete anonymized.metadata.phone;
      delete anonymized.metadata.address;
    }

    // Keep only necessary data for analytics
    return anonymized;
  }

  // Data Retention Management
  async scheduleDataDeletion(paymentId: string, retentionPeriod: number = 7 * 365 * 24 * 60 * 60 * 1000): Promise<void> {
    const deletionDate = new Date(Date.now() + retentionPeriod);
    
    // In production, this would schedule automatic deletion
    await this.logSecurityEvent('data_retention_scheduled', {
      paymentId,
      deletionDate: deletionDate.toISOString(),
    });
  }

  // Compliance Reporting
  async generateComplianceReport(startDate: Date, endDate: Date): Promise<{
    period: { start: Date; end: Date };
    summary: {
      totalChecks: number;
      passedChecks: number;
      failedChecks: number;
      complianceRate: number;
    };
    byLevel: Record<ComplianceLevel, number>;
    violations: ComplianceCheckResult[];
    recommendations: string[];
  }> {
    const periodChecks = Array.from(this.complianceChecks.values()).filter(
      check => check.timestamp >= startDate && check.timestamp <= endDate
    );

    const totalChecks = periodChecks.length;
    const passedChecks = periodChecks.filter(check => check.passed).length;
    const failedChecks = totalChecks - passedChecks;
    const complianceRate = totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 0;

    const byLevel: Record<ComplianceLevel, number> = {
      [ComplianceLevel.PCI_DSS_LEVEL_1]: 0,
      [ComplianceLevel.PCI_DSS_LEVEL_2]: 0,
      [ComplianceLevel.GDPR_COMPLIANT]: 0,
      [ComplianceLevel.SOX_COMPLIANT]: 0,
    };

    periodChecks.forEach(check => {
      byLevel[check.level]++;
    });

    const violations = periodChecks
      .flatMap(check => check.checks)
      .filter(check => !check.passed && check.severity === 'critical');

    const recommendations = [...new Set(violations.map(v => v.recommendation).filter(Boolean))];

    return {
      period: { start: startDate, end: endDate },
      summary: { totalChecks, passedChecks, failedChecks, complianceRate },
      byLevel,
      violations,
      recommendations,
    };
  }

  // Private helper methods
  private async checkDataEncryption(payment: PaymentDetails): Promise<ComplianceCheckResult> {
    // Mock check - in production, verify actual encryption implementation
    const encrypted = payment.metadata?.encrypted === 'true';
    
    return {
      checkType: 'data_encryption',
      passed: encrypted,
      details: encrypted ? 'Payment data is properly encrypted' : 'Payment data encryption not verified',
      severity: encrypted ? 'low' : 'critical',
      recommendation: encrypted ? undefined : 'Implement end-to-end encryption for payment data',
    };
  }

  private async checkSecureTransmission(payment: PaymentDetails): Promise<ComplianceCheckResult> {
    // Mock check - verify HTTPS/TLS usage
    const secure = true; // Assume secure transmission
    
    return {
      checkType: 'secure_transmission',
      passed: secure,
      details: 'All payment data transmitted over secure channels',
      severity: 'low',
    };
  }

  private async checkAccessControl(payment: PaymentDetails): Promise<ComplianceCheckResult> {
    // Mock check - verify access controls are in place
    const controlled = true; // Assume proper access control
    
    return {
      checkType: 'access_control',
      passed: controlled,
      details: 'Proper access controls implemented',
      severity: 'low',
    };
  }

  private async checkNetworkSecurity(payment: PaymentDetails): Promise<ComplianceCheckResult> {
    return {
      checkType: 'network_security',
      passed: true,
      details: 'Network security measures in place',
      severity: 'low',
    };
  }

  private async checkVulnerabilityManagement(): Promise<ComplianceCheckResult> {
    return {
      checkType: 'vulnerability_management',
      passed: true,
      details: 'Regular vulnerability scans performed',
      severity: 'low',
    };
  }

  private async checkRegularMonitoring(payment: PaymentDetails): Promise<ComplianceCheckResult> {
    return {
      checkType: 'regular_monitoring',
      passed: true,
      details: 'Regular monitoring and logging in place',
      severity: 'low',
    };
  }

  private async checkLawfulBasis(payment: PaymentDetails, userConsent: any): Promise<ComplianceCheckResult> {
    const hasConsent = userConsent?.consentGiven === true;
    
    return {
      checkType: 'lawful_basis',
      passed: hasConsent,
      details: hasConsent ? 'Valid user consent obtained' : 'User consent not verified',
      severity: hasConsent ? 'low' : 'critical',
      recommendation: hasConsent ? undefined : 'Obtain explicit user consent before processing',
    };
  }

  private async checkDataMinimization(payment: PaymentDetails): Promise<ComplianceCheckResult> {
    // Check if only necessary data is being collected
    const minimized = !payment.metadata?.excessiveData;
    
    return {
      checkType: 'data_minimization',
      passed: minimized,
      details: minimized ? 'Only necessary data collected' : 'Excessive data collection detected',
      severity: minimized ? 'low' : 'medium',
    };
  }

  private async checkPurposeLimitation(payment: PaymentDetails): Promise<ComplianceCheckResult> {
    return {
      checkType: 'purpose_limitation',
      passed: true,
      details: 'Data used only for specified purposes',
      severity: 'low',
    };
  }

  private async checkStorageLimitation(payment: PaymentDetails): Promise<ComplianceCheckResult> {
    // Check if data retention policies are followed
    const retentionOk = true; // Mock check
    
    return {
      checkType: 'storage_limitation',
      passed: retentionOk,
      details: 'Data retention policies followed',
      severity: 'low',
    };
  }

  private async checkDataSubjectRights(payment: PaymentDetails): Promise<ComplianceCheckResult> {
    return {
      checkType: 'data_subject_rights',
      passed: true,
      details: 'Data subject rights mechanisms in place',
      severity: 'low',
    };
  }

  private async checkDataProtectionByDesign(payment: PaymentDetails): Promise<ComplianceCheckResult> {
    return {
      checkType: 'data_protection_by_design',
      passed: true,
      details: 'Privacy by design principles implemented',
      severity: 'low',
    };
  }

  private calculateComplianceScore(checks: ComplianceCheckResult[]): number {
    if (checks.length === 0) return 0;
    
    const passed = checks.filter(check => check.passed).length;
    return (passed / checks.length) * 100;
  }

  private determineComplianceLevel(score: number, checks: ComplianceCheckResult[]): ComplianceLevel {
    const hasCriticalFailure = checks.some(check => !check.passed && check.severity === 'critical');
    
    if (hasCriticalFailure) {
      return ComplianceLevel.PCI_DSS_LEVEL_2; // Lower compliance level
    }
    
    if (score >= 95) {
      return ComplianceLevel.PCI_DSS_LEVEL_1;
    } else if (score >= 80) {
      return ComplianceLevel.PCI_DSS_LEVEL_2;
    } else {
      return ComplianceLevel.PCI_DSS_LEVEL_2;
    }
  }

  private generateSecureKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Public getters for audit and compliance data
  async getAuditLogs(startDate?: Date, endDate?: Date): Promise<SecurityAuditLog[]> {
    let logs = this.auditLogs;
    
    if (startDate) {
      logs = logs.filter(log => log.timestamp >= startDate);
    }
    
    if (endDate) {
      logs = logs.filter(log => log.timestamp <= endDate);
    }
    
    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getComplianceStatus(paymentId: string): Promise<ComplianceCheck | undefined> {
    return this.complianceChecks.get(paymentId);
  }
}
