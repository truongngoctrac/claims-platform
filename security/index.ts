export * from './types';
export * from './advanced-security/SecurityAuditService';
export * from './advanced-security/PenetrationTestingService';
export * from './advanced-security/VulnerabilityScanningService';
export * from './advanced-security/SecurityMonitoringService';
export * from './advanced-security/ThreatDetectionService';
export * from './advanced-security/IntrusionPreventionService';
export * from './advanced-security/SecurityIncidentResponseService';
export * from './advanced-security/DataLossPreventionService';
export * from './advanced-security/AdvancedEncryptionService';
export * from './advanced-security/KeyManagementService';
export * from './advanced-security/ZeroTrustArchitectureService';
export * from './advanced-security/MultiFactorAuthService';
export * from './advanced-security/BiometricAuthenticationService';
export * from './advanced-security/SessionManagementService';
export * from './advanced-security/SecurityTrainingService';

import { SecurityAuditService } from './advanced-security/SecurityAuditService';
import { PenetrationTestingService } from './advanced-security/PenetrationTestingService';
import { VulnerabilityScanningService } from './advanced-security/VulnerabilityScanningService';
import { SecurityMonitoringService } from './advanced-security/SecurityMonitoringService';
import { ThreatDetectionService } from './advanced-security/ThreatDetectionService';
import { IntrusionPreventionService } from './advanced-security/IntrusionPreventionService';
import { SecurityIncidentResponseService } from './advanced-security/SecurityIncidentResponseService';
import { DataLossPreventionService } from './advanced-security/DataLossPreventionService';
import { AdvancedEncryptionService } from './advanced-security/AdvancedEncryptionService';
import { KeyManagementService } from './advanced-security/KeyManagementService';
import { ZeroTrustArchitectureService } from './advanced-security/ZeroTrustArchitectureService';
import { MultiFactorAuthService } from './advanced-security/MultiFactorAuthService';
import { BiometricAuthenticationService } from './advanced-security/BiometricAuthenticationService';
import { SessionManagementService } from './advanced-security/SessionManagementService';
import { SecurityTrainingService } from './advanced-security/SecurityTrainingService';

export class SecurityManager {
  private static instance: SecurityManager;
  
  public readonly audit: SecurityAuditService;
  public readonly pentest: PenetrationTestingService;
  public readonly vulnerability: VulnerabilityScanningService;
  public readonly monitoring: SecurityMonitoringService;
  public readonly threatDetection: ThreatDetectionService;
  public readonly intrusion: IntrusionPreventionService;
  public readonly incident: SecurityIncidentResponseService;
  public readonly dlp: DataLossPreventionService;
  public readonly encryption: AdvancedEncryptionService;
  public readonly keyManagement: KeyManagementService;
  public readonly zeroTrust: ZeroTrustArchitectureService;
  public readonly mfa: MultiFactorAuthService;
  public readonly biometric: BiometricAuthenticationService;
  public readonly session: SessionManagementService;
  public readonly training: SecurityTrainingService;

  private constructor() {
    this.audit = new SecurityAuditService();
    this.pentest = new PenetrationTestingService();
    this.vulnerability = new VulnerabilityScanningService();
    this.monitoring = new SecurityMonitoringService();
    this.threatDetection = new ThreatDetectionService();
    this.intrusion = new IntrusionPreventionService();
    this.incident = new SecurityIncidentResponseService();
    this.dlp = new DataLossPreventionService();
    this.encryption = new AdvancedEncryptionService();
    this.keyManagement = new KeyManagementService();
    this.zeroTrust = new ZeroTrustArchitectureService();
    this.mfa = new MultiFactorAuthService();
    this.biometric = new BiometricAuthenticationService();
    this.session = new SessionManagementService();
    this.training = new SecurityTrainingService();
  }

  public static getInstance(): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager();
    }
    return SecurityManager.instance;
  }

  public async initialize(): Promise<void> {
    await Promise.all([
      this.monitoring.initialize(),
      this.threatDetection.initialize(),
      this.intrusion.initialize(),
      this.dlp.initialize(),
      this.zeroTrust.initialize(),
      this.session.initialize()
    ]);
  }

  public async performHealthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, boolean>;
    metrics: any;
  }> {
    const services = {
      audit: await this.audit.isHealthy(),
      monitoring: await this.monitoring.isHealthy(),
      threatDetection: await this.threatDetection.isHealthy(),
      intrusion: await this.intrusion.isHealthy(),
      dlp: await this.dlp.isHealthy(),
      encryption: await this.encryption.isHealthy(),
      keyManagement: await this.keyManagement.isHealthy(),
      zeroTrust: await this.zeroTrust.isHealthy(),
      mfa: await this.mfa.isHealthy(),
      session: await this.session.isHealthy()
    };

    const healthyServices = Object.values(services).filter(Boolean).length;
    const totalServices = Object.keys(services).length;
    const healthPercentage = (healthyServices / totalServices) * 100;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthPercentage >= 90) status = 'healthy';
    else if (healthPercentage >= 70) status = 'degraded';
    else status = 'unhealthy';

    const metrics = await this.monitoring.getSecurityMetrics();

    return {
      status,
      services,
      metrics
    };
  }

  public async getSecurityDashboard(): Promise<any> {
    const [
      auditResults,
      vulnerabilities,
      threats,
      incidents,
      metrics
    ] = await Promise.all([
      this.audit.getRecentAudits(10),
      this.vulnerability.getRecentVulnerabilities(10),
      this.threatDetection.getRecentThreats(10),
      this.incident.getActiveIncidents(),
      this.monitoring.getSecurityMetrics()
    ]);

    return {
      overview: {
        security_score: metrics.security_score,
        active_threats: threats.filter(t => t.severity === 'high' || t.severity === 'critical').length,
        open_incidents: incidents.length,
        critical_vulnerabilities: vulnerabilities.filter(v => v.severity === 'critical').length
      },
      recent_activity: {
        audits: auditResults,
        vulnerabilities: vulnerabilities.slice(0, 5),
        threats: threats.slice(0, 5),
        incidents: incidents.slice(0, 5)
      },
      metrics
    };
  }
}

export const securityManager = SecurityManager.getInstance();
