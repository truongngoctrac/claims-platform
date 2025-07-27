import { DataClassification } from '../types';
import { EventEmitter } from 'events';

interface DLPPolicy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  data_types: string[];
  channels: ('email' | 'upload' | 'download' | 'api' | 'clipboard' | 'print' | 'usb')[];
  conditions: {
    contains_patterns: string[];
    size_threshold?: number;
    recipient_domains?: string[];
    time_restrictions?: { start: string; end: string; days: string[] };
    user_groups?: string[];
    location_restrictions?: string[];
  };
  actions: {
    primary: 'block' | 'quarantine' | 'encrypt' | 'watermark' | 'alert';
    secondary?: string[];
    notification_recipients: string[];
    require_justification: boolean;
    allow_override: boolean;
    override_approvers?: string[];
  };
  compliance_frameworks: string[];
  created_at: Date;
  updated_at: Date;
  violation_count: number;
  last_triggered: Date | null;
}

interface DLPViolation {
  id: string;
  timestamp: Date;
  policy_id: string;
  policy_name: string;
  user_id: string;
  user_email: string;
  channel: string;
  action_attempted: string;
  data_classification: DataClassification['classification'];
  sensitive_data_detected: string[];
  file_name?: string;
  file_size?: number;
  recipient_email?: string;
  source_ip: string;
  user_agent: string;
  action_taken: string;
  justification?: string;
  override_approved: boolean;
  override_approver?: string;
  risk_score: number;
  location: {
    country: string;
    city: string;
  };
}

interface PatientDataScanner {
  id: string;
  name: string;
  patterns: {
    patient_id: RegExp[];
    medical_record_number: RegExp[];
    health_insurance_number: RegExp[];
    social_security_number: RegExp[];
    phone_number: RegExp[];
    email: RegExp[];
    medical_diagnosis: string[];
    medication_names: string[];
    vietnamese_names: RegExp[];
  };
  confidence_threshold: number;
  enabled: boolean;
}

interface EncryptionRule {
  id: string;
  data_classification: DataClassification['classification'];
  encryption_algorithm: 'AES-256' | 'RSA-2048' | 'RSA-4096';
  key_rotation_days: number;
  required_for_channels: string[];
  enabled: boolean;
}

export class DataLossPreventionService extends EventEmitter {
  private dlpPolicies: DLPPolicy[] = [];
  private violations: DLPViolation[] = [];
  private dataClassifications: DataClassification[] = [];
  private patientDataScanners: PatientDataScanner[] = [];
  private encryptionRules: EncryptionRule[] = [];
  private quarantineStorage: Map<string, any> = new Map();
  private isActive = false;

  constructor() {
    super();
    this.initializeDLPPolicies();
    this.initializePatientDataScanners();
    this.initializeEncryptionRules();
    this.initializeDataClassifications();
  }

  async initialize(): Promise<void> {
    if (this.isActive) return;
    
    await this.startRealTimeMonitoring();
    await this.loadQuarantineData();
    
    this.isActive = true;
    this.emit('dlp_service_started', { timestamp: new Date() });
  }

  async scanAndProtectData(request: {
    user_id: string;
    user_email: string;
    action: 'upload' | 'download' | 'email' | 'api_call' | 'clipboard' | 'print' | 'usb_transfer';
    data: string | Buffer;
    metadata: {
      file_name?: string;
      file_size?: number;
      recipient_email?: string;
      source_ip: string;
      user_agent: string;
      location: { country: string; city: string };
      endpoint?: string;
    };
  }): Promise<{
    allowed: boolean;
    action_taken: string;
    violated_policies: string[];
    data_classification: DataClassification['classification'];
    sensitive_data_found: string[];
    risk_score: number;
    requires_justification: boolean;
    requires_approval: boolean;
    encrypted_data?: string;
    watermarked_data?: string;
  }> {
    try {
      // Classify the data
      const classification = await this.classifyData(request.data);
      
      // Scan for sensitive healthcare data
      const sensitiveDataFound = await this.scanForSensitiveData(request.data);
      
      // Calculate risk score
      const riskScore = await this.calculateRiskScore(request, classification, sensitiveDataFound);
      
      // Evaluate DLP policies
      const policyEvaluation = await this.evaluateDLPPolicies(request, classification, sensitiveDataFound, riskScore);
      
      if (policyEvaluation.violations.length > 0) {
        // Log violation
        await this.logViolation(request, classification, sensitiveDataFound, policyEvaluation, riskScore);
        
        // Execute protective actions
        const protectionResult = await this.executeProtectiveActions(request, policyEvaluation);
        
        return {
          allowed: protectionResult.allowed,
          action_taken: protectionResult.action_taken,
          violated_policies: policyEvaluation.violations.map(v => v.name),
          data_classification: classification,
          sensitive_data_found: sensitiveDataFound,
          risk_score: riskScore,
          requires_justification: protectionResult.requires_justification,
          requires_approval: protectionResult.requires_approval,
          encrypted_data: protectionResult.encrypted_data,
          watermarked_data: protectionResult.watermarked_data
        };
      }

      // Data is allowed - apply automatic protection if required
      const autoProtection = await this.applyAutomaticProtection(request, classification);
      
      return {
        allowed: true,
        action_taken: 'allowed',
        violated_policies: [],
        data_classification: classification,
        sensitive_data_found: sensitiveDataFound,
        risk_score: riskScore,
        requires_justification: false,
        requires_approval: false,
        encrypted_data: autoProtection.encrypted_data,
        watermarked_data: autoProtection.watermarked_data
      };

    } catch (error) {
      this.emit('dlp_scan_error', { request, error });
      // Fail secure - block the action if we can't scan properly
      return {
        allowed: false,
        action_taken: 'blocked_due_to_scan_error',
        violated_policies: [],
        data_classification: 'restricted',
        sensitive_data_found: [],
        risk_score: 10,
        requires_justification: false,
        requires_approval: false
      };
    }
  }

  private async classifyData(data: string | Buffer): Promise<DataClassification['classification']> {
    const dataString = typeof data === 'string' ? data : data.toString();
    
    // Check for highly sensitive Vietnamese healthcare data
    if (this.containsVietnameseHealthcareData(dataString)) {
      return 'restricted';
    }
    
    // Check for PHI (Protected Health Information)
    if (this.containsPHI(dataString)) {
      return 'restricted';
    }
    
    // Check for PII (Personally Identifiable Information)
    if (this.containsPII(dataString)) {
      return 'confidential';
    }
    
    // Check for financial data
    if (this.containsFinancialData(dataString)) {
      return 'confidential';
    }
    
    // Check for internal business data
    if (this.containsInternalData(dataString)) {
      return 'internal';
    }
    
    return 'public';
  }

  private async scanForSensitiveData(data: string | Buffer): Promise<string[]> {
    const dataString = typeof data === 'string' ? data : data.toString();
    const sensitiveDataFound: string[] = [];

    for (const scanner of this.patientDataScanners.filter(s => s.enabled)) {
      // Patient ID patterns
      for (const pattern of scanner.patterns.patient_id) {
        if (pattern.test(dataString)) {
          sensitiveDataFound.push('patient_id');
          break;
        }
      }

      // Medical record numbers
      for (const pattern of scanner.patterns.medical_record_number) {
        if (pattern.test(dataString)) {
          sensitiveDataFound.push('medical_record_number');
          break;
        }
      }

      // Health insurance numbers
      for (const pattern of scanner.patterns.health_insurance_number) {
        if (pattern.test(dataString)) {
          sensitiveDataFound.push('health_insurance_number');
          break;
        }
      }

      // Social security numbers
      for (const pattern of scanner.patterns.social_security_number) {
        if (pattern.test(dataString)) {
          sensitiveDataFound.push('social_security_number');
          break;
        }
      }

      // Vietnamese names
      for (const pattern of scanner.patterns.vietnamese_names) {
        if (pattern.test(dataString)) {
          sensitiveDataFound.push('vietnamese_names');
          break;
        }
      }

      // Medical diagnoses
      for (const diagnosis of scanner.patterns.medical_diagnosis) {
        if (dataString.toLowerCase().includes(diagnosis.toLowerCase())) {
          sensitiveDataFound.push('medical_diagnosis');
          break;
        }
      }

      // Medication names
      for (const medication of scanner.patterns.medication_names) {
        if (dataString.toLowerCase().includes(medication.toLowerCase())) {
          sensitiveDataFound.push('medication_names');
          break;
        }
      }
    }

    return Array.from(new Set(sensitiveDataFound));
  }

  private async calculateRiskScore(
    request: any,
    classification: DataClassification['classification'],
    sensitiveDataFound: string[]
  ): Promise<number> {
    let riskScore = 0;

    // Base risk by classification
    const classificationRisk = {
      'public': 1,
      'internal': 3,
      'confidential': 6,
      'restricted': 9,
      'top_secret': 10
    };
    riskScore += classificationRisk[classification] || 0;

    // Risk by sensitive data types
    riskScore += sensitiveDataFound.length * 2;

    // Risk by action type
    const actionRisk = {
      'email': 4,
      'upload': 3,
      'download': 2,
      'usb_transfer': 5,
      'print': 3,
      'clipboard': 2,
      'api_call': 3
    };
    riskScore += actionRisk[request.action] || 0;

    // Risk by location
    if (request.metadata.location.country !== 'Vietnam') {
      riskScore += 3;
    }

    // Risk by recipient domain (for emails)
    if (request.action === 'email' && request.metadata.recipient_email) {
      const domain = request.metadata.recipient_email.split('@')[1];
      if (!this.isTrustedDomain(domain)) {
        riskScore += 4;
      }
    }

    // Risk by file size (large files might contain more sensitive data)
    if (request.metadata.file_size && request.metadata.file_size > 10 * 1024 * 1024) { // 10MB
      riskScore += 2;
    }

    return Math.min(10, riskScore); // Cap at 10
  }

  private async evaluateDLPPolicies(
    request: any,
    classification: DataClassification['classification'],
    sensitiveDataFound: string[],
    riskScore: number
  ): Promise<{ violations: DLPPolicy[]; highestPriorityAction: string }> {
    const violations: DLPPolicy[] = [];
    let highestPriorityAction = 'alert';

    for (const policy of this.dlpPolicies.filter(p => p.enabled).sort((a, b) => b.priority - a.priority)) {
      const violates = await this.evaluatePolicy(policy, request, classification, sensitiveDataFound, riskScore);
      
      if (violates) {
        violations.push(policy);
        policy.violation_count++;
        policy.last_triggered = new Date();
        
        if (this.getActionPriority(policy.actions.primary) > this.getActionPriority(highestPriorityAction)) {
          highestPriorityAction = policy.actions.primary;
        }
      }
    }

    return { violations, highestPriorityAction };
  }

  private async evaluatePolicy(
    policy: DLPPolicy,
    request: any,
    classification: DataClassification['classification'],
    sensitiveDataFound: string[],
    riskScore: number
  ): Promise<boolean> {
    // Check if policy applies to this channel
    if (!policy.channels.includes(request.action)) {
      return false;
    }

    // Check data types
    if (policy.data_types.length > 0) {
      const hasMatchingDataType = policy.data_types.some(type => 
        sensitiveDataFound.includes(type) || 
        this.matchesDataType(type, classification, sensitiveDataFound)
      );
      if (!hasMatchingDataType) {
        return false;
      }
    }

    // Check content patterns
    const dataString = typeof request.data === 'string' ? request.data : request.data.toString();
    if (policy.conditions.contains_patterns.length > 0) {
      const hasMatchingPattern = policy.conditions.contains_patterns.some(pattern => {
        try {
          return new RegExp(pattern, 'i').test(dataString);
        } catch (error) {
          this.emit('pattern_error', { policy: policy.id, pattern, error });
          return false;
        }
      });
      if (!hasMatchingPattern) {
        return false;
      }
    }

    // Check size threshold
    if (policy.conditions.size_threshold && request.metadata.file_size) {
      if (request.metadata.file_size < policy.conditions.size_threshold) {
        return false;
      }
    }

    // Check recipient domains (for email)
    if (policy.conditions.recipient_domains && request.metadata.recipient_email) {
      const domain = request.metadata.recipient_email.split('@')[1];
      if (!policy.conditions.recipient_domains.includes(domain)) {
        return false;
      }
    }

    // Check time restrictions
    if (policy.conditions.time_restrictions) {
      if (!this.isWithinTimeRestrictions(policy.conditions.time_restrictions)) {
        return false;
      }
    }

    // Check location restrictions
    if (policy.conditions.location_restrictions) {
      if (!policy.conditions.location_restrictions.includes(request.metadata.location.country)) {
        return false;
      }
    }

    return true;
  }

  private async executeProtectiveActions(request: any, policyEvaluation: any): Promise<{
    allowed: boolean;
    action_taken: string;
    requires_justification: boolean;
    requires_approval: boolean;
    encrypted_data?: string;
    watermarked_data?: string;
  }> {
    const primaryAction = policyEvaluation.highestPriorityAction;
    const policy = policyEvaluation.violations[0]; // Use highest priority policy

    switch (primaryAction) {
      case 'block':
        return {
          allowed: false,
          action_taken: 'blocked',
          requires_justification: policy.actions.require_justification,
          requires_approval: false
        };

      case 'quarantine':
        await this.quarantineData(request);
        return {
          allowed: false,
          action_taken: 'quarantined',
          requires_justification: policy.actions.require_justification,
          requires_approval: policy.actions.allow_override
        };

      case 'encrypt':
        const encryptedData = await this.encryptData(request.data);
        return {
          allowed: true,
          action_taken: 'encrypted',
          requires_justification: false,
          requires_approval: false,
          encrypted_data: encryptedData
        };

      case 'watermark':
        const watermarkedData = await this.watermarkData(request.data, request.user_email);
        return {
          allowed: true,
          action_taken: 'watermarked',
          requires_justification: false,
          requires_approval: false,
          watermarked_data: watermarkedData
        };

      case 'alert':
      default:
        await this.sendSecurityAlert(request, policyEvaluation);
        return {
          allowed: true,
          action_taken: 'alert_sent',
          requires_justification: policy.actions.require_justification,
          requires_approval: false
        };
    }
  }

  private async logViolation(
    request: any,
    classification: DataClassification['classification'],
    sensitiveDataFound: string[],
    policyEvaluation: any,
    riskScore: number
  ): Promise<void> {
    const violation: DLPViolation = {
      id: `violation_${Date.now()}`,
      timestamp: new Date(),
      policy_id: policyEvaluation.violations[0]?.id || 'unknown',
      policy_name: policyEvaluation.violations[0]?.name || 'Unknown Policy',
      user_id: request.user_id,
      user_email: request.user_email,
      channel: request.action,
      action_attempted: request.action,
      data_classification: classification,
      sensitive_data_detected: sensitiveDataFound,
      file_name: request.metadata.file_name,
      file_size: request.metadata.file_size,
      recipient_email: request.metadata.recipient_email,
      source_ip: request.metadata.source_ip,
      user_agent: request.metadata.user_agent,
      action_taken: policyEvaluation.highestPriorityAction,
      override_approved: false,
      risk_score: riskScore,
      location: request.metadata.location
    };

    this.violations.push(violation);
    this.emit('dlp_violation', violation);
  }

  async getDLPStatistics(): Promise<{
    total_violations: number;
    by_policy: Record<string, number>;
    by_channel: Record<string, number>;
    by_user: Record<string, number>;
    by_data_type: Record<string, number>;
    blocked_percentage: number;
    high_risk_violations: number;
    recent_trends: any;
  }> {
    const total = this.violations.length;
    const byPolicy: Record<string, number> = {};
    const byChannel: Record<string, number> = {};
    const byUser: Record<string, number> = {};
    const byDataType: Record<string, number> = {};

    let blockedCount = 0;
    let highRiskCount = 0;

    this.violations.forEach(violation => {
      byPolicy[violation.policy_name] = (byPolicy[violation.policy_name] || 0) + 1;
      byChannel[violation.channel] = (byChannel[violation.channel] || 0) + 1;
      byUser[violation.user_email] = (byUser[violation.user_email] || 0) + 1;

      violation.sensitive_data_detected.forEach(dataType => {
        byDataType[dataType] = (byDataType[dataType] || 0) + 1;
      });

      if (violation.action_taken === 'blocked' || violation.action_taken === 'quarantined') {
        blockedCount++;
      }

      if (violation.risk_score >= 8) {
        highRiskCount++;
      }
    });

    return {
      total_violations: total,
      by_policy: byPolicy,
      by_channel: byChannel,
      by_user: byUser,
      by_data_type: byDataType,
      blocked_percentage: total > 0 ? (blockedCount / total) * 100 : 0,
      high_risk_violations: highRiskCount,
      recent_trends: this.calculateDLPTrends()
    };
  }

  async getRecentViolations(limit: number = 10): Promise<DLPViolation[]> {
    return this.violations
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  async addDLPPolicy(policy: Omit<DLPPolicy, 'id' | 'created_at' | 'updated_at' | 'violation_count' | 'last_triggered'>): Promise<string> {
    const newPolicy: DLPPolicy = {
      ...policy,
      id: `policy_${Date.now()}`,
      created_at: new Date(),
      updated_at: new Date(),
      violation_count: 0,
      last_triggered: null
    };

    this.dlpPolicies.push(newPolicy);
    this.emit('dlp_policy_added', newPolicy);

    return newPolicy.id;
  }

  async isHealthy(): Promise<boolean> {
    return this.isActive &&
           this.dlpPolicies.filter(p => p.enabled).length > 0 &&
           this.patientDataScanners.filter(s => s.enabled).length > 0;
  }

  // Helper methods
  private containsVietnameseHealthcareData(data: string): boolean {
    const vietnameseHealthcarePatterns = [
      /bệnh viện/i,
      /bác sĩ/i,
      /chẩn đoán/i,
      /điều trị/i,
      /bệnh án/i,
      /khám bệnh/i,
      /thuốc men/i,
      /xét nghiệm/i
    ];

    return vietnameseHealthcarePatterns.some(pattern => pattern.test(data));
  }

  private containsPHI(data: string): boolean {
    const phiPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b\d{10,12}\b/, // Medical record numbers
      /patient|health|medical|diagnosis|treatment/i
    ];

    return phiPatterns.some(pattern => pattern.test(data));
  }

  private containsPII(data: string): boolean {
    const piiPatterns = [
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
      /\b\d{3}-\d{3}-\d{4}\b/, // Phone
      /\b\d{1,5}\s\w+\s(?:street|st|avenue|ave|road|rd|boulevard|blvd)\b/i // Address
    ];

    return piiPatterns.some(pattern => pattern.test(data));
  }

  private containsFinancialData(data: string): boolean {
    const financialPatterns = [
      /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/, // Credit card
      /\b\d{9,18}\b/, // Bank account
      /\$\d+(?:,\d{3})*(?:\.\d{2})?/ // Currency amounts
    ];

    return financialPatterns.some(pattern => pattern.test(data));
  }

  private containsInternalData(data: string): boolean {
    const internalPatterns = [
      /confidential|internal|proprietary|restricted/i,
      /company|organization|business/i
    ];

    return internalPatterns.some(pattern => pattern.test(data));
  }

  private matchesDataType(type: string, classification: string, sensitiveDataFound: string[]): boolean {
    return sensitiveDataFound.includes(type) || 
           (type === 'phi' && classification === 'restricted') ||
           (type === 'pii' && ['confidential', 'restricted'].includes(classification));
  }

  private getActionPriority(action: string): number {
    const priorities = {
      'alert': 1,
      'watermark': 2,
      'encrypt': 3,
      'quarantine': 4,
      'block': 5
    };
    return priorities[action] || 0;
  }

  private isWithinTimeRestrictions(restrictions: { start: string; end: string; days: string[] }): boolean {
    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const currentTime = now.toTimeString().slice(0, 5);

    return restrictions.days.includes(currentDay) &&
           currentTime >= restrictions.start &&
           currentTime <= restrictions.end;
  }

  private isTrustedDomain(domain: string): boolean {
    const trustedDomains = [
      'company.com',
      'healthcare.gov.vn',
      'hospital.vn',
      'medicalcenter.vn'
    ];
    return trustedDomains.includes(domain);
  }

  private async quarantineData(request: any): Promise<void> {
    const quarantineId = `quarantine_${Date.now()}`;
    this.quarantineStorage.set(quarantineId, {
      id: quarantineId,
      user_id: request.user_id,
      data: request.data,
      metadata: request.metadata,
      quarantined_at: new Date(),
      reason: 'DLP policy violation'
    });

    this.emit('data_quarantined', { id: quarantineId, user: request.user_id });
  }

  private async encryptData(data: string | Buffer): Promise<string> {
    // Mock encryption - in reality, use proper encryption libraries
    const dataString = typeof data === 'string' ? data : data.toString();
    return Buffer.from(dataString).toString('base64');
  }

  private async watermarkData(data: string | Buffer, userEmail: string): Promise<string> {
    const dataString = typeof data === 'string' ? data : data.toString();
    const watermark = `\n\n--- CONFIDENTIAL - Accessed by ${userEmail} on ${new Date().toISOString()} ---`;
    return dataString + watermark;
  }

  private async sendSecurityAlert(request: any, policyEvaluation: any): Promise<void> {
    this.emit('security_alert_sent', {
      user: request.user_id,
      policies: policyEvaluation.violations.map((p: any) => p.name),
      action: request.action,
      timestamp: new Date()
    });
  }

  private async applyAutomaticProtection(request: any, classification: DataClassification['classification']): Promise<{
    encrypted_data?: string;
    watermarked_data?: string;
  }> {
    const result: any = {};

    // Auto-encrypt restricted data
    if (classification === 'restricted' || classification === 'top_secret') {
      result.encrypted_data = await this.encryptData(request.data);
    }

    // Auto-watermark confidential data for email
    if (classification === 'confidential' && request.action === 'email') {
      result.watermarked_data = await this.watermarkData(request.data, request.user_email);
    }

    return result;
  }

  private calculateDLPTrends(): any {
    const last24h = this.violations.filter(
      v => v.timestamp.getTime() > Date.now() - 24 * 60 * 60 * 1000
    );

    return {
      last_24h_count: last24h.length,
      most_violated_policy: 'Healthcare Data Protection',
      most_common_channel: 'email',
      trend_direction: 'stable'
    };
  }

  private async startRealTimeMonitoring(): Promise<void> {
    // Mock real-time monitoring
    this.emit('real_time_monitoring_started', { timestamp: new Date() });
  }

  private async loadQuarantineData(): Promise<void> {
    // Mock loading quarantined data from persistent storage
    this.quarantineStorage.clear();
  }

  // Initialization methods
  private initializeDLPPolicies(): void {
    this.dlpPolicies = [
      {
        id: 'vietnamese_healthcare_protection',
        name: 'Vietnamese Healthcare Data Protection',
        description: 'Protects Vietnamese patient healthcare information',
        enabled: true,
        priority: 100,
        data_types: ['phi', 'patient_id', 'medical_record_number', 'vietnamese_names'],
        channels: ['email', 'upload', 'download', 'usb_transfer'],
        conditions: {
          contains_patterns: [
            'bệnh viện', 'bác sĩ', 'chẩn đoán', 'điều trị',
            '\\b\\d{10,12}\\b', // Medical record patterns
            '[A-Za-z]+ [A-Za-z]+ [A-Za-z]+' // Vietnamese names
          ],
          recipient_domains: ['gmail.com', 'yahoo.com', 'hotmail.com'] // Block external emails
        },
        actions: {
          primary: 'block',
          secondary: ['alert', 'audit'],
          notification_recipients: ['security@company.com', 'compliance@company.com'],
          require_justification: true,
          allow_override: true,
          override_approvers: ['security_manager', 'compliance_officer']
        },
        compliance_frameworks: ['VIETNAMESE_HEALTHCARE', 'HIPAA'],
        created_at: new Date(),
        updated_at: new Date(),
        violation_count: 0,
        last_triggered: null
      },
      {
        id: 'phi_email_protection',
        name: 'PHI Email Protection',
        description: 'Prevents unencrypted PHI transmission via email',
        enabled: true,
        priority: 90,
        data_types: ['phi', 'medical_diagnosis', 'medication_names'],
        channels: ['email'],
        conditions: {
          contains_patterns: [
            'patient', 'diagnosis', 'treatment', 'medication',
            'health insurance', 'medical record'
          ],
          size_threshold: 1024 // 1KB
        },
        actions: {
          primary: 'encrypt',
          secondary: ['watermark', 'alert'],
          notification_recipients: ['privacy@company.com'],
          require_justification: false,
          allow_override: false
        },
        compliance_frameworks: ['HIPAA', 'VIETNAMESE_HEALTHCARE'],
        created_at: new Date(),
        updated_at: new Date(),
        violation_count: 0,
        last_triggered: null
      },
      {
        id: 'pii_external_transfer',
        name: 'PII External Transfer Control',
        description: 'Controls transfer of PII to external recipients',
        enabled: true,
        priority: 80,
        data_types: ['pii', 'social_security_number', 'phone_number'],
        channels: ['email', 'upload', 'usb_transfer'],
        conditions: {
          contains_patterns: [
            '\\b\\d{3}-\\d{2}-\\d{4}\\b', // SSN
            '\\b\\d{3}-\\d{3}-\\d{4}\\b', // Phone
            '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b' // Email
          ],
          recipient_domains: ['gmail.com', 'yahoo.com', 'outlook.com'],
          location_restrictions: ['Vietnam'] // Only allow from Vietnam
        },
        actions: {
          primary: 'quarantine',
          secondary: ['alert'],
          notification_recipients: ['security@company.com'],
          require_justification: true,
          allow_override: true,
          override_approvers: ['security_manager']
        },
        compliance_frameworks: ['GDPR', 'VIETNAMESE_PRIVACY'],
        created_at: new Date(),
        updated_at: new Date(),
        violation_count: 0,
        last_triggered: null
      }
    ];
  }

  private initializePatientDataScanners(): void {
    this.patientDataScanners = [
      {
        id: 'vietnamese_healthcare_scanner',
        name: 'Vietnamese Healthcare Data Scanner',
        patterns: {
          patient_id: [
            /BN\d{8,12}/i, // Patient ID format: BN12345678
            /HS\d{8,12}/i  // Medical record format: HS12345678
          ],
          medical_record_number: [
            /MRN\d{8,12}/i,
            /\b\d{10,12}\b/
          ],
          health_insurance_number: [
            /BHYT\d{10,15}/i,
            /\d{2}\.\d{2}\.\d{3}\.\d{2}\.\d{5}/
          ],
          social_security_number: [
            /\b\d{3}-\d{2}-\d{4}\b/,
            /\b\d{9}\b/
          ],
          phone_number: [
            /\+84\d{9,10}/,
            /0\d{9,10}/,
            /\b\d{3}-\d{3}-\d{4}\b/
          ],
          email: [
            /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/
          ],
          medical_diagnosis: [
            'viêm phổi', 'tiểu đường', 'cao huyết áp', 'ung thư',
            'tuberculosis', 'diabetes', 'hypertension', 'cancer',
            'covid-19', 'sars-cov-2', 'pneumonia', 'influenza'
          ],
          medication_names: [
            'paracetamol', 'ibuprofen', 'aspirin', 'insulin',
            'metformin', 'lisinopril', 'amoxicillin', 'omeprazole'
          ],
          vietnamese_names: [
            /\b[A-Z][a-z]+ [A-Z][a-z]+ [A-Z][a-z]+\b/, // Vietnamese name pattern
            /(Nguyễn|Trần|Lê|Phạm|Hoàng|Huỳnh|Vũ|Võ|Đặng|Bùi) [A-Z][a-z]+ [A-Z][a-z]+/
          ]
        },
        confidence_threshold: 0.7,
        enabled: true
      }
    ];
  }

  private initializeEncryptionRules(): void {
    this.encryptionRules = [
      {
        id: 'restricted_data_encryption',
        data_classification: 'restricted',
        encryption_algorithm: 'AES-256',
        key_rotation_days: 90,
        required_for_channels: ['email', 'upload', 'download', 'api_call'],
        enabled: true
      },
      {
        id: 'confidential_data_encryption',
        data_classification: 'confidential',
        encryption_algorithm: 'AES-256',
        key_rotation_days: 180,
        required_for_channels: ['email', 'usb_transfer'],
        enabled: true
      }
    ];
  }

  private initializeDataClassifications(): void {
    this.dataClassifications = [
      {
        id: 'vietnamese_phi',
        classification: 'restricted',
        data_type: 'phi',
        sensitivity_score: 10,
        retention_period: 7 * 365, // 7 years
        encryption_required: true,
        access_controls: ['mfa_required', 'role_based_access'],
        geographical_restrictions: ['Vietnam'],
        compliance_requirements: ['VIETNAMESE_HEALTHCARE', 'HIPAA'],
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 'patient_pii',
        classification: 'confidential',
        data_type: 'pii',
        sensitivity_score: 8,
        retention_period: 5 * 365, // 5 years
        encryption_required: true,
        access_controls: ['role_based_access'],
        geographical_restrictions: [],
        compliance_requirements: ['GDPR', 'VIETNAMESE_PRIVACY'],
        created_at: new Date(),
        updated_at: new Date()
      }
    ];
  }
}
