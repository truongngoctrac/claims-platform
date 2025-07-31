// Data Protection Security Services - Main Export File
// Healthcare Claims System - Comprehensive Security Implementation

export { default as EndToEndEncryptionService } from "./EndToEndEncryptionService";
export { default as DatabaseEncryptionOptimizer } from "./DatabaseEncryptionOptimizer";
export { default as BackupEncryptionService } from "./BackupEncryptionService";
export { default as SecureCommunicationService } from "./SecureCommunicationService";
export { default as DataMaskingService } from "./DataMaskingService";
export { default as TokenizationService } from "./TokenizationService";
export { default as AccessControlOptimizer } from "./AccessControlOptimizer";
export { default as PrivilegeEscalationPrevention } from "./PrivilegeEscalationPrevention";
export { default as DataLeakagePreventionService } from "./DataLeakagePreventionService";
export { default as SecureDevelopmentPractices } from "./SecureDevelopmentPractices";
export { default as CodeSecurityScanner } from "./CodeSecurityScanner";
export { default as DependencySecurityMonitor } from "./DependencySecurityMonitor";
export { default as ContainerSecurityService } from "./ContainerSecurityService";
export { default as NetworkSecurityOptimizer } from "./NetworkSecurityOptimizer";

// Re-export types for easier consumption
export type {
  EncryptionConfig,
  EncryptionKeyPair,
  EncryptedData,
  E2EEncryptionMetrics,
} from "./EndToEndEncryptionService";

export type {
  EncryptionPerformanceMetrics,
  DatabaseEncryptionConfig,
  ColumnEncryptionConfig,
} from "./DatabaseEncryptionOptimizer";

export type {
  BackupEncryptionConfig,
  BackupMetadata,
  BackupStats,
} from "./BackupEncryptionService";

export type {
  TLSConfig,
  SecurityHeaders,
  SecureMessage,
  APISecurityConfig,
} from "./SecureCommunicationService";

export type {
  MaskingRule,
  MaskingProfile,
  MaskingMetrics,
} from "./DataMaskingService";

export type {
  TokenizationConfig,
  TokenVault,
  TokenizationMetrics,
} from "./TokenizationService";

export type {
  AccessPolicy,
  AccessDecision,
  AccessMetrics,
} from "./AccessControlOptimizer";

export type {
  PrivilegeRequest,
  EscalationRule,
  EscalationMetrics,
} from "./PrivilegeEscalationPrevention";

export type {
  DLPPolicy,
  DataClassification,
  DLPIncident,
  DLPMetrics,
} from "./DataLeakagePreventionService";

export type {
  SecurityGuideline,
  SecurityReview,
  DeveloperTraining,
  ComplianceFramework,
} from "./SecureDevelopmentPractices";

export type {
  ScanConfiguration,
  ScanResult,
  Vulnerability,
  SecurityRule,
} from "./CodeSecurityScanner";

export type {
  DependencyScanResult,
  PackageVulnerability,
  DependencyTree,
} from "./DependencySecurityMonitor";

export type {
  ContainerImage,
  ContainerScanResult,
  SecurityPolicy,
  RuntimeSecurityEvent,
} from "./ContainerSecurityService";

export type {
  NetworkConfiguration,
  NetworkThreat,
  SecurityEvent,
  NetworkMetrics,
} from "./NetworkSecurityOptimizer";

/**
 * Data Protection Security Suite
 *
 * This module provides comprehensive security services for healthcare applications,
 * ensuring HIPAA compliance and enterprise-grade security across all layers:
 *
 * ## Core Security Services:
 *
 * ### Encryption & Cryptography:
 * - **EndToEndEncryptionService**: Complete E2E encryption with key management
 * - **DatabaseEncryptionOptimizer**: High-performance database encryption
 * - **BackupEncryptionService**: Secure backup encryption with redundancy
 * - **SecureCommunicationService**: TLS/SSL and secure messaging
 *
 * ### Data Protection:
 * - **DataMaskingService**: Advanced data masking for privacy protection
 * - **TokenizationService**: Format-preserving tokenization system
 * - **DataLeakagePreventionService**: Real-time DLP with policy enforcement
 *
 * ### Access Control & Identity:
 * - **AccessControlOptimizer**: Role-based access control with risk assessment
 * - **PrivilegeEscalationPrevention**: Privilege monitoring and escalation control
 *
 * ### Security Development:
 * - **SecureDevelopmentPractices**: Security guidelines and training
 * - **CodeSecurityScanner**: Static application security testing (SAST)
 * - **DependencySecurityMonitor**: Vulnerability scanning for dependencies
 * - **ContainerSecurityService**: Container image and runtime security
 *
 * ### Infrastructure Security:
 * - **NetworkSecurityOptimizer**: Network security and threat detection
 *
 * ## Quick Start:
 *
 * ```typescript
 * import {
 *   EndToEndEncryptionService,
 *   AccessControlOptimizer,
 *   DataMaskingService
 * } from './security/data-protection';
 *
 * // Initialize encryption service
 * const encryption = new EndToEndEncryptionService();
 * await encryption.initialize();
 *
 * // Encrypt sensitive data
 * const encryptedData = await encryption.encryptData('patient-data', 'medical');
 *
 * // Initialize access control
 * const accessControl = new AccessControlOptimizer();
 * await accessControl.initialize();
 *
 * // Evaluate access
 * const decision = await accessControl.evaluateAccess(
 *   'user123',
 *   '/patient/records/456',
 *   'read'
 * );
 *
 * // Initialize data masking
 * const masking = new DataMaskingService();
 * await masking.initialize();
 *
 * // Mask sensitive data
 * const maskedData = await masking.maskData(sensitiveData, 'healthcare_standard');
 * ```
 *
 * ## Security Features:
 *
 * - ✅ HIPAA/HITECH Compliance
 * - ✅ End-to-End Encryption
 * - ✅ Zero-Trust Architecture
 * - ✅ Real-time Threat Detection
 * - ✅ Automated Security Scanning
 * - ✅ Comprehensive Audit Logging
 * - ✅ Role-Based Access Control
 * - ✅ Data Loss Prevention
 * - ✅ Container Security
 * - ✅ Network Security Monitoring
 * - ✅ Secure Development Lifecycle
 * - ✅ Vulnerability Management
 * - ✅ Privacy Protection
 * - ✅ Incident Response
 * - ✅ Compliance Reporting
 *
 * @version 1.0.0
 * @author Healthcare Security Team
 * @license Proprietary
 */

// Utility function to initialize all security services
export async function initializeSecuritySuite(): Promise<{
  encryption: EndToEndEncryptionService;
  accessControl: AccessControlOptimizer;
  masking: DataMaskingService;
  tokenization: TokenizationService;
  dlp: DataLeakagePreventionService;
  codeScanner: CodeSecurityScanner;
  dependencyMonitor: DependencySecurityMonitor;
  containerSecurity: ContainerSecurityService;
  networkSecurity: NetworkSecurityOptimizer;
}> {
  const services = {
    encryption: new EndToEndEncryptionService(),
    accessControl: new AccessControlOptimizer(),
    masking: new DataMaskingService(),
    tokenization: new TokenizationService(),
    dlp: new DataLeakagePreventionService(),
    codeScanner: new CodeSecurityScanner(),
    dependencyMonitor: new DependencySecurityMonitor(),
    containerSecurity: new ContainerSecurityService(),
    networkSecurity: new NetworkSecurityOptimizer(),
  };

  // Initialize all services
  await Promise.all([
    services.encryption.initialize(),
    services.accessControl.initialize(),
    services.masking.initialize(),
    services.tokenization.initialize(),
    services.dlp.initialize(),
    services.codeScanner.initialize(),
    services.dependencyMonitor.initialize(),
    services.containerSecurity.initialize(),
    services.networkSecurity.initialize(),
  ]);

  return services;
}

// Security configuration constants
export const SECURITY_CONSTANTS = {
  ENCRYPTION: {
    DEFAULT_ALGORITHM: "AES-256-GCM",
    KEY_ROTATION_INTERVAL: 24 * 7, // Weekly
    MIN_KEY_SIZE: 256,
  },
  ACCESS_CONTROL: {
    SESSION_TIMEOUT: 15 * 60, // 15 minutes
    MAX_FAILED_ATTEMPTS: 5,
    LOCKOUT_DURATION: 30 * 60, // 30 minutes
  },
  COMPLIANCE: {
    HIPAA_RETENTION_YEARS: 6,
    AUDIT_LOG_RETENTION_DAYS: 365,
    VULNERABILITY_SCAN_FREQUENCY: 24, // hours
  },
  PERFORMANCE: {
    CACHE_TTL: 60 * 60, // 1 hour
    BATCH_SIZE: 1000,
    MAX_CONCURRENT_SCANS: 5,
  },
} as const;

// Export the constants for external use
export default {
  initializeSecuritySuite,
  SECURITY_CONSTANTS,
};
