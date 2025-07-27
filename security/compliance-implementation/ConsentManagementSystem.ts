import {
  ConsentRecord,
  ConsentStatus,
  ConsentEvidence,
  DataProcessingPurpose,
  LegalBasis,
  ConsentGranularity,
  ConsentMethod,
  ComplianceServiceResponse,
  ComplianceMetadata,
  DataSubject,
  AuditTrailEntry,
  AuditAction,
  ComplianceImpact,
  ConsentValidationResult
} from './types';

export class ConsentManagementSystemService {
  private consentRecords: Map<string, ConsentRecord> = new Map();
  private consentHistory: Map<string, ConsentHistoryEntry[]> = new Map();
  private consentPolicies: Map<string, ConsentPolicy> = new Map();
  private withdrawalRequests: Map<string, WithdrawalRequest> = new Map();

  constructor(
    private config: ConsentManagementConfig,
    private logger: any,
    private auditService: any,
    private notificationService: any
  ) {}

  // Consent Collection and Recording
  async recordConsent(
    consentRequest: ConsentRequest
  ): Promise<ComplianceServiceResponse<ConsentRecord>> {
    try {
      const validation = await this.validateConsentRequest(consentRequest);
      if (!validation.valid) {
        return {
          success: false,
          error: `Invalid consent request: ${validation.errors.join(', ')}`
        };
      }

      const consentId = this.generateConsentId();
      const evidence = await this.collectConsentEvidence(consentRequest);
      
      const consentRecord: ConsentRecord = {
        id: consentId,
        dataSubjectId: consentRequest.dataSubjectId,
        purpose: consentRequest.purpose,
        status: ConsentStatus.GIVEN,
        consentDate: new Date(),
        expiryDate: await this.calculateExpiryDate(consentRequest),
        granularity: consentRequest.granularity,
        legalBasis: LegalBasis.CONSENT,
        consentMethod: consentRequest.method,
        ipAddress: consentRequest.context.ipAddress,
        userAgent: consentRequest.context.userAgent,
        evidence: evidence,
        metadata: this.createMetadata()
      };

      // Store the consent record
      this.consentRecords.set(consentId, consentRecord);

      // Add to history
      await this.addToConsentHistory(consentRequest.dataSubjectId, {
        action: 'consent_given',
        consentId,
        timestamp: new Date(),
        purpose: consentRequest.purpose,
        details: { method: consentRequest.method, granularity: consentRequest.granularity }
      });

      // Audit logging
      await this.auditService.log({
        action: AuditAction.CONSENT_GIVEN,
        resourceType: 'consent_record',
        resourceId: consentId,
        dataSubjectId: consentRequest.dataSubjectId,
        details: {
          purpose: consentRequest.purpose,
          method: consentRequest.method,
          granularity: consentRequest.granularity
        },
        result: 'success',
        complianceImpact: ComplianceImpact.HIGH
      });

      // Trigger consent given notifications
      await this.triggerConsentNotifications(consentRecord, 'consent_given');

      return {
        success: true,
        data: consentRecord
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Consent recording failed'
      };
    }
  }

  // Consent Withdrawal
  async withdrawConsent(
    withdrawalRequest: ConsentWithdrawalRequest
  ): Promise<ComplianceServiceResponse<ConsentWithdrawalResult>> {
    try {
      const validation = await this.validateWithdrawalRequest(withdrawalRequest);
      if (!validation.valid) {
        return {
          success: false,
          error: `Invalid withdrawal request: ${validation.errors.join(', ')}`
        };
      }

      const consentRecord = this.consentRecords.get(withdrawalRequest.consentId);
      if (!consentRecord) {
        return {
          success: false,
          error: 'Consent record not found'
        };
      }

      // Update consent status
      consentRecord.status = ConsentStatus.WITHDRAWN;
      consentRecord.withdrawalDate = new Date();

      // Process withdrawal implications
      const withdrawalResult = await this.processWithdrawalImplications(consentRecord, withdrawalRequest);

      // Add to history
      await this.addToConsentHistory(consentRecord.dataSubjectId, {
        action: 'consent_withdrawn',
        consentId: withdrawalRequest.consentId,
        timestamp: new Date(),
        purpose: consentRecord.purpose,
        details: { reason: withdrawalRequest.reason, method: withdrawalRequest.method }
      });

      // Audit logging
      await this.auditService.log({
        action: AuditAction.CONSENT_WITHDRAWN,
        resourceType: 'consent_record',
        resourceId: withdrawalRequest.consentId,
        dataSubjectId: consentRecord.dataSubjectId,
        details: {
          purpose: consentRecord.purpose,
          reason: withdrawalRequest.reason,
          implications: withdrawalResult.implications
        },
        result: 'success',
        complianceImpact: ComplianceImpact.HIGH
      });

      // Trigger withdrawal notifications
      await this.triggerConsentNotifications(consentRecord, 'consent_withdrawn');

      const result: ConsentWithdrawalResult = {
        withdrawal_id: this.generateId(),
        consent_id: withdrawalRequest.consentId,
        data_subject_id: consentRecord.dataSubjectId,
        withdrawal_date: consentRecord.withdrawalDate!,
        implications: withdrawalResult.implications,
        next_steps: withdrawalResult.nextSteps,
        confirmation_required: withdrawalResult.confirmationRequired
      };

      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Consent withdrawal failed'
      };
    }
  }

  // Consent Validation
  async validateConsent(
    dataSubjectId: string,
    purpose: DataProcessingPurpose,
    currentDate: Date = new Date()
  ): Promise<ComplianceServiceResponse<ConsentValidationResult>> {
    try {
      const relevantConsents = await this.findRelevantConsents(dataSubjectId, purpose);
      
      if (relevantConsents.length === 0) {
        return {
          success: true,
          data: {
            isValid: false,
            consentId: '',
            validationChecks: {
              consent_exists: false,
              consent_current: false,
              consent_specific: false,
              consent_informed: false,
              consent_unambiguous: false
            },
            recommendations: ['Obtain valid consent for this purpose']
          }
        };
      }

      const latestConsent = this.getLatestConsent(relevantConsents);
      const validationChecks = await this.performConsentValidationChecks(latestConsent, purpose, currentDate);
      
      const isValid = Object.values(validationChecks).every(check => check);

      const result: ConsentValidationResult = {
        isValid,
        consentId: latestConsent.id,
        validationChecks,
        expiryDate: latestConsent.expiryDate,
        recommendations: await this.generateValidationRecommendations(validationChecks, latestConsent)
      };

      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Consent validation failed'
      };
    }
  }

  // Consent Renewal and Refresh
  async renewConsent(
    renewalRequest: ConsentRenewalRequest
  ): Promise<ComplianceServiceResponse<ConsentRenewalResult>> {
    try {
      const existingConsent = this.consentRecords.get(renewalRequest.existingConsentId);
      if (!existingConsent) {
        return {
          success: false,
          error: 'Existing consent record not found'
        };
      }

      // Create new consent record
      const newConsentRequest: ConsentRequest = {
        dataSubjectId: existingConsent.dataSubjectId,
        purpose: existingConsent.purpose,
        granularity: renewalRequest.granularity || existingConsent.granularity,
        method: renewalRequest.method,
        context: renewalRequest.context,
        customTerms: renewalRequest.customTerms
      };

      const newConsentResult = await this.recordConsent(newConsentRequest);
      
      if (!newConsentResult.success) {
        return {
          success: false,
          error: `Consent renewal failed: ${newConsentResult.error}`
        };
      }

      // Mark old consent as superseded
      existingConsent.status = ConsentStatus.WITHDRAWN;
      existingConsent.withdrawalDate = new Date();

      // Add to history
      await this.addToConsentHistory(existingConsent.dataSubjectId, {
        action: 'consent_renewed',
        consentId: newConsentResult.data!.id,
        timestamp: new Date(),
        purpose: existingConsent.purpose,
        details: { 
          old_consent_id: renewalRequest.existingConsentId,
          renewal_reason: renewalRequest.reason 
        }
      });

      const result: ConsentRenewalResult = {
        renewal_id: this.generateId(),
        old_consent_id: renewalRequest.existingConsentId,
        new_consent_id: newConsentResult.data!.id,
        renewal_date: new Date(),
        reason: renewalRequest.reason,
        changes: await this.identifyConsentChanges(existingConsent, newConsentResult.data!)
      };

      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Consent renewal failed'
      };
    }
  }

  // Granular Consent Management
  async updateGranularConsent(
    updateRequest: GranularConsentUpdate
  ): Promise<ComplianceServiceResponse<GranularConsentResult>> {
    try {
      const results: GranularConsentUpdateResult[] = [];

      for (const purposeUpdate of updateRequest.purposeUpdates) {
        const updateResult = await this.updatePurposeConsent(
          updateRequest.dataSubjectId,
          purposeUpdate
        );
        results.push(updateResult);
      }

      const overallSuccess = results.every(result => result.success);

      const result: GranularConsentResult = {
        update_id: this.generateId(),
        data_subject_id: updateRequest.dataSubjectId,
        update_date: new Date(),
        purpose_updates: results,
        overall_success: overallSuccess,
        active_consents: await this.getActiveConsents(updateRequest.dataSubjectId),
        withdrawn_consents: await this.getWithdrawnConsents(updateRequest.dataSubjectId)
      };

      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Granular consent update failed'
      };
    }
  }

  // Consent Dashboard and Reporting
  async getConsentDashboard(
    dataSubjectId: string
  ): Promise<ComplianceServiceResponse<ConsentDashboard>> {
    try {
      const activeConsents = await this.getActiveConsents(dataSubjectId);
      const withdrawnConsents = await this.getWithdrawnConsents(dataSubjectId);
      const expiredConsents = await this.getExpiredConsents(dataSubjectId);
      const pendingRenewals = await this.getPendingRenewals(dataSubjectId);

      const dashboard: ConsentDashboard = {
        data_subject_id: dataSubjectId,
        last_updated: new Date(),
        active_consents: activeConsents,
        withdrawn_consents: withdrawnConsents,
        expired_consents: expiredConsents,
        pending_renewals: pendingRenewals,
        consent_summary: {
          total_consents: activeConsents.length + withdrawnConsents.length + expiredConsents.length,
          active_count: activeConsents.length,
          withdrawn_count: withdrawnConsents.length,
          expired_count: expiredConsents.length,
          pending_renewals_count: pendingRenewals.length
        },
        purpose_breakdown: await this.getConsentPurposeBreakdown(dataSubjectId),
        recent_activities: await this.getRecentConsentActivities(dataSubjectId),
        recommendations: await this.generateConsentRecommendations(dataSubjectId)
      };

      return {
        success: true,
        data: dashboard
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Dashboard generation failed'
      };
    }
  }

  // Consent Monitoring and Automation
  async monitorConsentCompliance(): Promise<ComplianceServiceResponse<ConsentComplianceReport>> {
    try {
      const allConsents = Array.from(this.consentRecords.values());
      const currentDate = new Date();

      const expiringConsents = allConsents.filter(consent => 
        this.isExpiringSoon(consent, currentDate)
      );

      const expiredConsents = allConsents.filter(consent => 
        this.isExpired(consent, currentDate)
      );

      const invalidConsents = [];
      for (const consent of allConsents) {
        const validation = await this.validateConsent(consent.dataSubjectId, consent.purpose, currentDate);
        if (validation.success && !validation.data?.isValid) {
          invalidConsents.push(consent);
        }
      }

      const report: ConsentComplianceReport = {
        report_date: currentDate,
        total_consents: allConsents.length,
        active_consents: allConsents.filter(c => c.status === ConsentStatus.GIVEN).length,
        withdrawn_consents: allConsents.filter(c => c.status === ConsentStatus.WITHDRAWN).length,
        expired_consents: expiredConsents.length,
        expiring_soon: expiringConsents.length,
        invalid_consents: invalidConsents.length,
        compliance_rate: this.calculateComplianceRate(allConsents, invalidConsents),
        trending_withdrawals: await this.analyzeTrendingWithdrawals(),
        purpose_analysis: await this.analyzeConsentByPurpose(),
        method_analysis: await this.analyzeConsentByMethod(),
        recommendations: await this.generateComplianceRecommendations(allConsents, invalidConsents),
        action_items: await this.generateActionItems(expiringConsents, expiredConsents, invalidConsents)
      };

      return {
        success: true,
        data: report
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Compliance monitoring failed'
      };
    }
  }

  // Automated Consent Renewal
  async automatedConsentRenewal(): Promise<ComplianceServiceResponse<AutomatedRenewalResult>> {
    try {
      const renewalCandidates = await this.identifyRenewalCandidates();
      const renewalResults: RenewalAttemptResult[] = [];

      for (const candidate of renewalCandidates) {
        const renewalResult = await this.attemptAutomatedRenewal(candidate);
        renewalResults.push(renewalResult);
      }

      const result: AutomatedRenewalResult = {
        execution_date: new Date(),
        candidates_identified: renewalCandidates.length,
        renewal_attempts: renewalResults.length,
        successful_renewals: renewalResults.filter(r => r.success).length,
        failed_renewals: renewalResults.filter(r => !r.success).length,
        renewal_results: renewalResults,
        next_execution: await this.scheduleNextAutomatedRenewal()
      };

      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Automated renewal failed'
      };
    }
  }

  // Privacy Preference Management
  async updatePrivacyPreferences(
    preferencesUpdate: PrivacyPreferencesUpdate
  ): Promise<ComplianceServiceResponse<PrivacyPreferencesResult>> {
    try {
      const currentPreferences = await this.getPrivacyPreferences(preferencesUpdate.dataSubjectId);
      const updatedPreferences = await this.mergePrivacyPreferences(currentPreferences, preferencesUpdate);

      // Validate preferences
      const validation = await this.validatePrivacyPreferences(updatedPreferences);
      if (!validation.valid) {
        return {
          success: false,
          error: `Invalid preferences: ${validation.errors.join(', ')}`
        };
      }

      // Apply preference changes
      const consentChanges = await this.applyPreferenceChanges(preferencesUpdate.dataSubjectId, updatedPreferences);

      // Save preferences
      await this.savePrivacyPreferences(preferencesUpdate.dataSubjectId, updatedPreferences);

      const result: PrivacyPreferencesResult = {
        preferences_id: this.generateId(),
        data_subject_id: preferencesUpdate.dataSubjectId,
        updated_preferences: updatedPreferences,
        consent_changes: consentChanges,
        effective_date: new Date(),
        notification_sent: await this.sendPreferencesUpdateNotification(preferencesUpdate.dataSubjectId, consentChanges)
      };

      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Privacy preferences update failed'
      };
    }
  }

  // Private helper methods
  private async validateConsentRequest(request: ConsentRequest): Promise<ValidationResult> {
    const errors: string[] = [];

    // Validate data subject
    if (!request.dataSubjectId) {
      errors.push('Data subject ID is required');
    }

    // Validate purpose
    if (!request.purpose) {
      errors.push('Processing purpose is required');
    }

    // Validate method
    if (!request.method) {
      errors.push('Consent method is required');
    }

    // Validate context for certain methods
    if (request.method === ConsentMethod.DIGITAL_SIGNATURE && !request.context.ipAddress) {
      errors.push('IP address is required for digital signature consent');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private async collectConsentEvidence(request: ConsentRequest): Promise<ConsentEvidence> {
    const evidence: ConsentEvidence = {
      type: this.mapMethodToEvidenceType(request.method),
      evidence: await this.generateEvidenceString(request),
      timestamp: new Date(),
      verificationCode: this.generateVerificationCode()
    };

    if (request.context.witnessId) {
      evidence.witnessId = request.context.witnessId;
    }

    return evidence;
  }

  private async calculateExpiryDate(request: ConsentRequest): Promise<Date | undefined> {
    const policy = this.consentPolicies.get(request.purpose);
    if (policy?.defaultExpiryPeriod) {
      return new Date(Date.now() + policy.defaultExpiryPeriod * 24 * 60 * 60 * 1000);
    }
    return undefined;
  }

  private async findRelevantConsents(dataSubjectId: string, purpose: DataProcessingPurpose): Promise<ConsentRecord[]> {
    return Array.from(this.consentRecords.values()).filter(consent => 
      consent.dataSubjectId === dataSubjectId && 
      consent.purpose === purpose &&
      consent.status === ConsentStatus.GIVEN
    );
  }

  private getLatestConsent(consents: ConsentRecord[]): ConsentRecord {
    return consents.reduce((latest, current) => 
      current.consentDate > latest.consentDate ? current : latest
    );
  }

  private async performConsentValidationChecks(
    consent: ConsentRecord,
    purpose: DataProcessingPurpose,
    currentDate: Date
  ): Promise<Record<string, boolean>> {
    return {
      consent_exists: true,
      consent_current: !this.isExpired(consent, currentDate),
      consent_specific: consent.purpose === purpose,
      consent_informed: await this.wasInformed(consent),
      consent_unambiguous: await this.wasUnambiguous(consent),
      consent_freely_given: await this.wasFreelyGiven(consent),
      consent_withdrawable: await this.isWithdrawable(consent)
    };
  }

  private generateId(): string {
    return `cms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateConsentId(): string {
    return `consent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateVerificationCode(): string {
    return Math.random().toString(36).substr(2, 12);
  }

  private createMetadata(): ComplianceMetadata {
    return {
      id: this.generateId(),
      version: '1.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'consent-management-service',
      updatedBy: 'consent-management-service',
      tags: ['consent', 'gdpr'],
      classification: 'confidential' as any
    };
  }

  private mapMethodToEvidenceType(method: ConsentMethod): ConsentEvidence['type'] {
    switch (method) {
      case ConsentMethod.CHECKBOX:
        return 'checkbox';
      case ConsentMethod.DIGITAL_SIGNATURE:
        return 'signature';
      case ConsentMethod.VERBAL:
        return 'verbal';
      case ConsentMethod.WRITTEN:
        return 'signature';
      case ConsentMethod.OPT_IN:
        return 'opt-in';
      case ConsentMethod.DOUBLE_OPT_IN:
        return 'double-opt-in';
      default:
        return 'checkbox';
    }
  }

  private async addToConsentHistory(dataSubjectId: string, entry: ConsentHistoryEntry): Promise<void> {
    const history = this.consentHistory.get(dataSubjectId) || [];
    history.push(entry);
    this.consentHistory.set(dataSubjectId, history);
  }

  private isExpired(consent: ConsentRecord, currentDate: Date): boolean {
    return consent.expiryDate ? consent.expiryDate < currentDate : false;
  }

  private isExpiringSoon(consent: ConsentRecord, currentDate: Date): boolean {
    if (!consent.expiryDate) return false;
    const daysUntilExpiry = (consent.expiryDate.getTime() - currentDate.getTime()) / (24 * 60 * 60 * 1000);
    return daysUntilExpiry <= this.config.expiryWarningDays;
  }

  private calculateComplianceRate(allConsents: ConsentRecord[], invalidConsents: ConsentRecord[]): number {
    return allConsents.length > 0 ? (1 - invalidConsents.length / allConsents.length) * 100 : 100;
  }

  // Placeholder implementations for complex logic
  private async generateEvidenceString(request: ConsentRequest): Promise<string> {
    return `Consent evidence for ${request.purpose} via ${request.method}`;
  }

  private async wasInformed(consent: ConsentRecord): Promise<boolean> {
    return true; // Placeholder
  }

  private async wasUnambiguous(consent: ConsentRecord): Promise<boolean> {
    return true; // Placeholder
  }

  private async wasFreelyGiven(consent: ConsentRecord): Promise<boolean> {
    return true; // Placeholder
  }

  private async isWithdrawable(consent: ConsentRecord): Promise<boolean> {
    return true; // Placeholder
  }

  private async getActiveConsents(dataSubjectId: string): Promise<ConsentRecord[]> {
    return Array.from(this.consentRecords.values()).filter(consent => 
      consent.dataSubjectId === dataSubjectId && consent.status === ConsentStatus.GIVEN
    );
  }

  private async getWithdrawnConsents(dataSubjectId: string): Promise<ConsentRecord[]> {
    return Array.from(this.consentRecords.values()).filter(consent => 
      consent.dataSubjectId === dataSubjectId && consent.status === ConsentStatus.WITHDRAWN
    );
  }

  private async getExpiredConsents(dataSubjectId: string): Promise<ConsentRecord[]> {
    const currentDate = new Date();
    return Array.from(this.consentRecords.values()).filter(consent => 
      consent.dataSubjectId === dataSubjectId && this.isExpired(consent, currentDate)
    );
  }

  private async getPendingRenewals(dataSubjectId: string): Promise<ConsentRecord[]> {
    const currentDate = new Date();
    return Array.from(this.consentRecords.values()).filter(consent => 
      consent.dataSubjectId === dataSubjectId && this.isExpiringSoon(consent, currentDate)
    );
  }
}

// Supporting interfaces and types
export interface ConsentManagementConfig {
  expiryWarningDays: number;
  automaticRenewalEnabled: boolean;
  defaultConsentLifetime: number;
  supportedMethods: ConsentMethod[];
  requiredEvidenceTypes: string[];
}

export interface ConsentRequest {
  dataSubjectId: string;
  purpose: DataProcessingPurpose;
  granularity: ConsentGranularity;
  method: ConsentMethod;
  context: ConsentContext;
  customTerms?: string[];
}

export interface ConsentContext {
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  location?: string;
  witnessId?: string;
  sessionId?: string;
}

export interface ConsentWithdrawalRequest {
  consentId: string;
  dataSubjectId: string;
  reason?: string;
  method: 'online' | 'email' | 'phone' | 'letter';
  context: ConsentContext;
}

export interface ConsentRenewalRequest {
  existingConsentId: string;
  reason: string;
  granularity?: ConsentGranularity;
  method: ConsentMethod;
  context: ConsentContext;
  customTerms?: string[];
}

export interface GranularConsentUpdate {
  dataSubjectId: string;
  purposeUpdates: PurposeConsentUpdate[];
  updateContext: ConsentContext;
}

export interface PurposeConsentUpdate {
  purpose: DataProcessingPurpose;
  action: 'grant' | 'withdraw' | 'modify';
  granularity?: ConsentGranularity;
  conditions?: string[];
}

export interface PrivacyPreferencesUpdate {
  dataSubjectId: string;
  preferences: PrivacyPreferences;
  updateContext: ConsentContext;
}

export interface PrivacyPreferences {
  marketing: boolean;
  analytics: boolean;
  personalization: boolean;
  dataSharing: boolean;
  contactMethods: ContactMethod[];
  retentionPreferences: RetentionPreferences;
}

export interface ContactMethod {
  type: 'email' | 'sms' | 'phone' | 'mail';
  allowed: boolean;
  frequency: 'daily' | 'weekly' | 'monthly' | 'never';
}

export interface RetentionPreferences {
  minimumRetention: boolean;
  customPeriods: Record<DataProcessingPurpose, number>;
}

export interface ConsentPolicy {
  purpose: DataProcessingPurpose;
  defaultExpiryPeriod?: number;
  renewalRequired: boolean;
  granularitySupported: ConsentGranularity[];
  allowedMethods: ConsentMethod[];
  evidenceRequirements: string[];
}

export interface ConsentHistoryEntry {
  action: string;
  consentId: string;
  timestamp: Date;
  purpose: DataProcessingPurpose;
  details: Record<string, any>;
}

export interface WithdrawalRequest {
  id: string;
  consentId: string;
  dataSubjectId: string;
  requestDate: Date;
  reason?: string;
  status: 'pending' | 'processed' | 'rejected';
  processedDate?: Date;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// Result interfaces
export interface ConsentWithdrawalResult {
  withdrawal_id: string;
  consent_id: string;
  data_subject_id: string;
  withdrawal_date: Date;
  implications: string[];
  next_steps: string[];
  confirmation_required: boolean;
}

export interface ConsentRenewalResult {
  renewal_id: string;
  old_consent_id: string;
  new_consent_id: string;
  renewal_date: Date;
  reason: string;
  changes: ConsentChange[];
}

export interface ConsentChange {
  field: string;
  old_value: any;
  new_value: any;
  impact: string;
}

export interface GranularConsentResult {
  update_id: string;
  data_subject_id: string;
  update_date: Date;
  purpose_updates: GranularConsentUpdateResult[];
  overall_success: boolean;
  active_consents: ConsentRecord[];
  withdrawn_consents: ConsentRecord[];
}

export interface GranularConsentUpdateResult {
  purpose: DataProcessingPurpose;
  action: string;
  success: boolean;
  consent_id?: string;
  error?: string;
}

export interface ConsentDashboard {
  data_subject_id: string;
  last_updated: Date;
  active_consents: ConsentRecord[];
  withdrawn_consents: ConsentRecord[];
  expired_consents: ConsentRecord[];
  pending_renewals: ConsentRecord[];
  consent_summary: ConsentSummary;
  purpose_breakdown: PurposeBreakdown[];
  recent_activities: ConsentActivity[];
  recommendations: string[];
}

export interface ConsentSummary {
  total_consents: number;
  active_count: number;
  withdrawn_count: number;
  expired_count: number;
  pending_renewals_count: number;
}

export interface PurposeBreakdown {
  purpose: DataProcessingPurpose;
  active: number;
  withdrawn: number;
  expired: number;
}

export interface ConsentActivity {
  date: Date;
  action: string;
  purpose: DataProcessingPurpose;
  details: string;
}

export interface ConsentComplianceReport {
  report_date: Date;
  total_consents: number;
  active_consents: number;
  withdrawn_consents: number;
  expired_consents: number;
  expiring_soon: number;
  invalid_consents: number;
  compliance_rate: number;
  trending_withdrawals: TrendingWithdrawal[];
  purpose_analysis: PurposeAnalysis[];
  method_analysis: MethodAnalysis[];
  recommendations: string[];
  action_items: ActionItem[];
}

export interface TrendingWithdrawal {
  purpose: DataProcessingPurpose;
  withdrawal_rate: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface PurposeAnalysis {
  purpose: DataProcessingPurpose;
  total_consents: number;
  consent_rate: number;
  average_lifetime: number;
}

export interface MethodAnalysis {
  method: ConsentMethod;
  usage_count: number;
  success_rate: number;
  average_duration: number;
}

export interface ActionItem {
  priority: 'high' | 'medium' | 'low';
  description: string;
  due_date: Date;
  assigned_to?: string;
}

export interface AutomatedRenewalResult {
  execution_date: Date;
  candidates_identified: number;
  renewal_attempts: number;
  successful_renewals: number;
  failed_renewals: number;
  renewal_results: RenewalAttemptResult[];
  next_execution: Date;
}

export interface RenewalAttemptResult {
  consent_id: string;
  data_subject_id: string;
  success: boolean;
  new_consent_id?: string;
  error?: string;
  method_used: string;
}

export interface PrivacyPreferencesResult {
  preferences_id: string;
  data_subject_id: string;
  updated_preferences: PrivacyPreferences;
  consent_changes: ConsentChange[];
  effective_date: Date;
  notification_sent: boolean;
}
