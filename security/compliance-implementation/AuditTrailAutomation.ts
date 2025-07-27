import {
  AuditTrailEntry,
  AuditAction,
  ComplianceImpact,
  ComplianceServiceResponse,
  ComplianceMetadata,
  DataType,
  RiskLevel
} from './types';

export class AuditTrailAutomationService {
  private auditEntries: Map<string, AuditTrailEntry> = new Map();
  private auditRules: Map<string, AuditRule> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private retentionPolicies: Map<string, AuditRetentionPolicy> = new Map();

  constructor(
    private config: AuditTrailConfig,
    private logger: any,
    private alertService: any,
    private storageService: any
  ) {
    this.initializeAuditRules();
  }

  // Core Audit Logging
  async logAuditEvent(
    auditEvent: AuditEventInput
  ): Promise<ComplianceServiceResponse<AuditTrailEntry>> {
    try {
      const auditEntry = await this.createAuditEntry(auditEvent);
      
      // Apply enrichment
      const enrichedEntry = await this.enrichAuditEntry(auditEntry, auditEvent);
      
      // Store the audit entry
      this.auditEntries.set(enrichedEntry.id, enrichedEntry);
      
      // Apply retention policy
      await this.applyRetentionPolicy(enrichedEntry);
      
      // Persist to storage
      await this.persistAuditEntry(enrichedEntry);
      
      // Check for alerts
      await this.checkAlertRules(enrichedEntry);
      
      // Real-time monitoring
      await this.processRealTimeMonitoring(enrichedEntry);

      return {
        success: true,
        data: enrichedEntry
      };
    } catch (error) {
      this.logger.error('Audit logging failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Audit logging failed'
      };
    }
  }

  // Batch Audit Processing
  async processBatchAudit(
    events: AuditEventInput[]
  ): Promise<ComplianceServiceResponse<BatchAuditResult>> {
    try {
      const results: AuditProcessingResult[] = [];
      const batchId = this.generateBatchId();

      for (const event of events) {
        try {
          const result = await this.logAuditEvent(event);
          results.push({
            event_id: event.eventId || this.generateId(),
            success: result.success,
            audit_id: result.data?.id,
            error: result.error
          });
        } catch (error) {
          results.push({
            event_id: event.eventId || this.generateId(),
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      const batchResult: BatchAuditResult = {
        batch_id: batchId,
        processed_at: new Date(),
        total_events: events.length,
        successful_events: results.filter(r => r.success).length,
        failed_events: results.filter(r => !r.success).length,
        processing_results: results,
        batch_metrics: await this.calculateBatchMetrics(results)
      };

      return {
        success: true,
        data: batchResult
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Batch audit processing failed'
      };
    }
  }

  // Audit Query and Search
  async queryAuditTrail(
    query: AuditQuery
  ): Promise<ComplianceServiceResponse<AuditQueryResult>> {
    try {
      const filteredEntries = await this.filterAuditEntries(query);
      const sortedEntries = await this.sortAuditEntries(filteredEntries, query.sortBy);
      const paginatedEntries = await this.paginateResults(sortedEntries, query.pagination);

      const queryResult: AuditQueryResult = {
        query_id: this.generateId(),
        executed_at: new Date(),
        total_matches: filteredEntries.length,
        returned_count: paginatedEntries.length,
        entries: paginatedEntries,
        aggregations: await this.calculateAggregations(filteredEntries, query.aggregations),
        query_metadata: {
          execution_time: Date.now(),
          query_complexity: this.assessQueryComplexity(query),
          cache_hit: false
        }
      };

      return {
        success: true,
        data: queryResult
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Audit query failed'
      };
    }
  }

  // Real-time Audit Monitoring
  async startRealTimeMonitoring(
    monitoringRules: MonitoringRule[]
  ): Promise<ComplianceServiceResponse<MonitoringSession>> {
    try {
      const sessionId = this.generateSessionId();
      const session: MonitoringSession = {
        id: sessionId,
        started_at: new Date(),
        rules: monitoringRules,
        status: 'active',
        events_processed: 0,
        alerts_triggered: 0,
        last_activity: new Date()
      };

      // Initialize monitoring infrastructure
      await this.initializeMonitoringSession(session);

      return {
        success: true,
        data: session
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Monitoring initialization failed'
      };
    }
  }

  // Compliance Audit Reporting
  async generateComplianceAuditReport(
    reportRequest: AuditReportRequest
  ): Promise<ComplianceServiceResponse<ComplianceAuditReport>> {
    try {
      const auditEntries = await this.getAuditEntriesForPeriod(
        reportRequest.startDate,
        reportRequest.endDate
      );

      const report: ComplianceAuditReport = {
        report_id: this.generateId(),
        generated_at: new Date(),
        reporting_period: {
          start: reportRequest.startDate,
          end: reportRequest.endDate
        },
        total_events: auditEntries.length,
        compliance_summary: await this.generateComplianceSummary(auditEntries),
        risk_analysis: await this.performRiskAnalysis(auditEntries),
        user_activity_analysis: await this.analyzeUserActivity(auditEntries),
        system_activity_analysis: await this.analyzeSystemActivity(auditEntries),
        data_access_patterns: await this.analyzeDataAccessPatterns(auditEntries),
        security_incidents: await this.identifySecurityIncidents(auditEntries),
        policy_violations: await this.identifyPolicyViolations(auditEntries),
        trends_and_anomalies: await this.identifyTrendsAndAnomalies(auditEntries),
        recommendations: await this.generateRecommendations(auditEntries),
        regulatory_compliance: await this.assessRegulatoryCompliance(auditEntries)
      };

      return {
        success: true,
        data: report
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Audit report generation failed'
      };
    }
  }

  // Audit Data Integrity and Verification
  async verifyAuditIntegrity(
    verificationRequest: IntegrityVerificationRequest
  ): Promise<ComplianceServiceResponse<IntegrityVerificationResult>> {
    try {
      const entries = await this.getAuditEntriesForVerification(verificationRequest);
      const verificationResults: EntryVerificationResult[] = [];

      for (const entry of entries) {
        const verification = await this.verifyEntryIntegrity(entry);
        verificationResults.push(verification);
      }

      const overallResult: IntegrityVerificationResult = {
        verification_id: this.generateId(),
        verified_at: new Date(),
        total_entries: entries.length,
        verified_entries: verificationResults.filter(r => r.verified).length,
        corrupted_entries: verificationResults.filter(r => !r.verified).length,
        verification_results: verificationResults,
        integrity_score: this.calculateIntegrityScore(verificationResults),
        recommendations: await this.generateIntegrityRecommendations(verificationResults)
      };

      return {
        success: true,
        data: overallResult
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Integrity verification failed'
      };
    }
  }

  // Audit Configuration Management
  async configureAuditRules(
    rulesConfig: AuditRulesConfiguration
  ): Promise<ComplianceServiceResponse<AuditRulesResult>> {
    try {
      const results: RuleConfigurationResult[] = [];

      // Process audit rules
      for (const rule of rulesConfig.auditRules) {
        try {
          await this.validateAuditRule(rule);
          this.auditRules.set(rule.id, rule);
          results.push({
            rule_id: rule.id,
            rule_type: 'audit',
            success: true,
            message: 'Rule configured successfully'
          });
        } catch (error) {
          results.push({
            rule_id: rule.id,
            rule_type: 'audit',
            success: false,
            message: error instanceof Error ? error.message : 'Configuration failed'
          });
        }
      }

      // Process alert rules
      for (const rule of rulesConfig.alertRules) {
        try {
          await this.validateAlertRule(rule);
          this.alertRules.set(rule.id, rule);
          results.push({
            rule_id: rule.id,
            rule_type: 'alert',
            success: true,
            message: 'Alert rule configured successfully'
          });
        } catch (error) {
          results.push({
            rule_id: rule.id,
            rule_type: 'alert',
            success: false,
            message: error instanceof Error ? error.message : 'Configuration failed'
          });
        }
      }

      const configResult: AuditRulesResult = {
        configuration_id: this.generateId(),
        configured_at: new Date(),
        total_rules: rulesConfig.auditRules.length + rulesConfig.alertRules.length,
        successful_configurations: results.filter(r => r.success).length,
        failed_configurations: results.filter(r => !r.success).length,
        configuration_results: results
      };

      return {
        success: true,
        data: configResult
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Rules configuration failed'
      };
    }
  }

  // Automated Audit Analysis
  async performAutomatedAnalysis(
    analysisRequest: AutomatedAnalysisRequest
  ): Promise<ComplianceServiceResponse<AutomatedAnalysisResult>> {
    try {
      const auditData = await this.getAuditDataForAnalysis(analysisRequest);
      
      const analysisResult: AutomatedAnalysisResult = {
        analysis_id: this.generateId(),
        performed_at: new Date(),
        analysis_type: analysisRequest.analysisType,
        data_period: analysisRequest.period,
        findings: [],
        risk_indicators: [],
        recommendations: [],
        confidence_score: 0
      };

      switch (analysisRequest.analysisType) {
        case 'anomaly_detection':
          analysisResult.findings = await this.performAnomalyDetection(auditData);
          break;
        case 'pattern_analysis':
          analysisResult.findings = await this.performPatternAnalysis(auditData);
          break;
        case 'risk_assessment':
          analysisResult.risk_indicators = await this.performRiskAssessment(auditData);
          break;
        case 'compliance_check':
          analysisResult.findings = await this.performComplianceCheck(auditData);
          break;
        case 'fraud_detection':
          analysisResult.findings = await this.performFraudDetection(auditData);
          break;
        default:
          throw new Error(`Unsupported analysis type: ${analysisRequest.analysisType}`);
      }

      analysisResult.recommendations = await this.generateAnalysisRecommendations(analysisResult);
      analysisResult.confidence_score = await this.calculateConfidenceScore(analysisResult);

      return {
        success: true,
        data: analysisResult
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Automated analysis failed'
      };
    }
  }

  // Private helper methods
  private async createAuditEntry(event: AuditEventInput): Promise<AuditTrailEntry> {
    const entry: AuditTrailEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      userId: event.userId,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      dataSubjectId: event.dataSubjectId,
      details: event.details || {},
      ipAddress: event.context?.ipAddress || 'unknown',
      userAgent: event.context?.userAgent || 'unknown',
      sessionId: event.context?.sessionId || 'unknown',
      result: event.result,
      complianceImpact: event.complianceImpact,
      metadata: this.createMetadata()
    };

    return entry;
  }

  private async enrichAuditEntry(
    entry: AuditTrailEntry,
    originalEvent: AuditEventInput
  ): Promise<AuditTrailEntry> {
    // Add geolocation if available
    if (entry.ipAddress !== 'unknown') {
      entry.details.geolocation = await this.getGeolocation(entry.ipAddress);
    }

    // Add risk score
    entry.details.riskScore = await this.calculateRiskScore(entry);

    // Add classification
    entry.details.classification = await this.classifyAuditEvent(entry);

    // Add correlation ID
    entry.details.correlationId = await this.generateCorrelationId(entry);

    return entry;
  }

  private async applyRetentionPolicy(entry: AuditTrailEntry): Promise<void> {
    const policy = this.getRetentionPolicyForEntry(entry);
    if (policy) {
      entry.details.retentionPolicy = policy.id;
      entry.details.retentionExpiry = new Date(
        Date.now() + policy.retentionPeriodDays * 24 * 60 * 60 * 1000
      );
    }
  }

  private async checkAlertRules(entry: AuditTrailEntry): Promise<void> {
    for (const rule of this.alertRules.values()) {
      if (await this.evaluateAlertRule(rule, entry)) {
        await this.triggerAlert(rule, entry);
      }
    }
  }

  private async filterAuditEntries(query: AuditQuery): Promise<AuditTrailEntry[]> {
    let entries = Array.from(this.auditEntries.values());

    // Apply filters
    if (query.filters.dateRange) {
      entries = entries.filter(entry => 
        entry.timestamp >= query.filters.dateRange!.start &&
        entry.timestamp <= query.filters.dateRange!.end
      );
    }

    if (query.filters.userId) {
      entries = entries.filter(entry => entry.userId === query.filters.userId);
    }

    if (query.filters.action) {
      entries = entries.filter(entry => entry.action === query.filters.action);
    }

    if (query.filters.resourceType) {
      entries = entries.filter(entry => entry.resourceType === query.filters.resourceType);
    }

    if (query.filters.complianceImpact) {
      entries = entries.filter(entry => entry.complianceImpact === query.filters.complianceImpact);
    }

    return entries;
  }

  private generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createMetadata(): ComplianceMetadata {
    return {
      id: this.generateId(),
      version: '1.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'audit-trail-service',
      updatedBy: 'audit-trail-service',
      tags: ['audit', 'compliance'],
      classification: 'confidential' as any
    };
  }

  private initializeAuditRules(): void {
    // Initialize default audit rules
    const defaultRules: AuditRule[] = [
      {
        id: 'default-high-risk',
        name: 'High Risk Activity Monitor',
        description: 'Monitor high-risk activities',
        conditions: [
          { field: 'complianceImpact', operator: 'equals', value: ComplianceImpact.HIGH }
        ],
        actions: ['log', 'alert'],
        enabled: true
      },
      {
        id: 'default-data-access',
        name: 'Sensitive Data Access Monitor',
        description: 'Monitor access to sensitive data',
        conditions: [
          { field: 'action', operator: 'equals', value: AuditAction.READ },
          { field: 'resourceType', operator: 'contains', value: 'sensitive' }
        ],
        actions: ['log', 'alert'],
        enabled: true
      }
    ];

    defaultRules.forEach(rule => this.auditRules.set(rule.id, rule));
  }

  // Placeholder implementations for complex operations
  private async getGeolocation(ipAddress: string): Promise<any> {
    return { country: 'Unknown', city: 'Unknown' };
  }

  private async calculateRiskScore(entry: AuditTrailEntry): Promise<number> {
    return Math.random() * 100; // Placeholder
  }

  private async classifyAuditEvent(entry: AuditTrailEntry): Promise<string> {
    return 'standard'; // Placeholder
  }

  private async generateCorrelationId(entry: AuditTrailEntry): Promise<string> {
    return `corr_${entry.userId}_${entry.sessionId}`;
  }

  private getRetentionPolicyForEntry(entry: AuditTrailEntry): AuditRetentionPolicy | undefined {
    return Array.from(this.retentionPolicies.values()).find(policy => 
      policy.applicableActions.includes(entry.action) ||
      policy.applicableResourceTypes.includes(entry.resourceType)
    );
  }

  private async evaluateAlertRule(rule: AlertRule, entry: AuditTrailEntry): Promise<boolean> {
    return rule.conditions.every(condition => 
      this.evaluateCondition(condition, entry)
    );
  }

  private evaluateCondition(condition: RuleCondition, entry: AuditTrailEntry): boolean {
    const fieldValue = this.getFieldValue(entry, condition.field);
    
    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'contains':
        return typeof fieldValue === 'string' && fieldValue.includes(condition.value);
      case 'greater_than':
        return typeof fieldValue === 'number' && fieldValue > condition.value;
      case 'less_than':
        return typeof fieldValue === 'number' && fieldValue < condition.value;
      default:
        return false;
    }
  }

  private getFieldValue(entry: AuditTrailEntry, field: string): any {
    switch (field) {
      case 'action':
        return entry.action;
      case 'resourceType':
        return entry.resourceType;
      case 'complianceImpact':
        return entry.complianceImpact;
      case 'userId':
        return entry.userId;
      default:
        return entry.details[field];
    }
  }

  private async triggerAlert(rule: AlertRule, entry: AuditTrailEntry): Promise<void> {
    const alert = {
      rule_id: rule.id,
      rule_name: rule.name,
      entry_id: entry.id,
      severity: rule.severity,
      message: rule.alertMessage || `Alert triggered by rule: ${rule.name}`,
      timestamp: new Date(),
      details: entry
    };

    await this.alertService.sendAlert(alert);
  }

  private calculateIntegrityScore(results: EntryVerificationResult[]): number {
    if (results.length === 0) return 100;
    const verifiedCount = results.filter(r => r.verified).length;
    return (verifiedCount / results.length) * 100;
  }
}

// Supporting interfaces and types
export interface AuditTrailConfig {
  retentionPeriodDays: number;
  encryptionEnabled: boolean;
  realTimeMonitoringEnabled: boolean;
  batchProcessingEnabled: boolean;
  integrityCheckInterval: number;
}

export interface AuditEventInput {
  eventId?: string;
  userId: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  dataSubjectId?: string;
  details?: Record<string, any>;
  result: 'success' | 'failure' | 'warning';
  complianceImpact: ComplianceImpact;
  context?: AuditContext;
}

export interface AuditContext {
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  location?: string;
  deviceInfo?: any;
}

export interface AuditRule {
  id: string;
  name: string;
  description: string;
  conditions: RuleCondition[];
  actions: string[];
  enabled: boolean;
  priority?: number;
  tags?: string[];
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  conditions: RuleCondition[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  alertMessage?: string;
  enabled: boolean;
  cooldownPeriod?: number;
}

export interface RuleCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'matches';
  value: any;
}

export interface AuditRetentionPolicy {
  id: string;
  name: string;
  retentionPeriodDays: number;
  applicableActions: AuditAction[];
  applicableResourceTypes: string[];
  complianceFramework?: string;
}

export interface AuditQuery {
  filters: AuditFilters;
  sortBy?: AuditSortOptions;
  pagination?: PaginationOptions;
  aggregations?: AggregationOptions[];
}

export interface AuditFilters {
  dateRange?: { start: Date; end: Date };
  userId?: string;
  action?: AuditAction;
  resourceType?: string;
  complianceImpact?: ComplianceImpact;
  result?: 'success' | 'failure' | 'warning';
  customFilters?: Record<string, any>;
}

export interface AuditSortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

export interface PaginationOptions {
  offset: number;
  limit: number;
}

export interface AggregationOptions {
  field: string;
  operation: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'group_by';
}

export interface MonitoringRule {
  id: string;
  name: string;
  conditions: RuleCondition[];
  alertThreshold: number;
  timeWindow: number;
  enabled: boolean;
}

export interface AuditReportRequest {
  startDate: Date;
  endDate: Date;
  includeUserActivity: boolean;
  includeSystemActivity: boolean;
  includeSecurityIncidents: boolean;
  format: 'json' | 'pdf' | 'csv';
}

export interface IntegrityVerificationRequest {
  startDate?: Date;
  endDate?: Date;
  entryIds?: string[];
  verificationLevel: 'basic' | 'comprehensive';
}

export interface AuditRulesConfiguration {
  auditRules: AuditRule[];
  alertRules: AlertRule[];
  retentionPolicies: AuditRetentionPolicy[];
}

export interface AutomatedAnalysisRequest {
  analysisType: 'anomaly_detection' | 'pattern_analysis' | 'risk_assessment' | 'compliance_check' | 'fraud_detection';
  period: { start: Date; end: Date };
  parameters?: Record<string, any>;
}

// Result interfaces
export interface BatchAuditResult {
  batch_id: string;
  processed_at: Date;
  total_events: number;
  successful_events: number;
  failed_events: number;
  processing_results: AuditProcessingResult[];
  batch_metrics: BatchMetrics;
}

export interface AuditProcessingResult {
  event_id: string;
  success: boolean;
  audit_id?: string;
  error?: string;
}

export interface BatchMetrics {
  average_processing_time: number;
  total_processing_time: number;
  throughput: number;
  error_rate: number;
}

export interface AuditQueryResult {
  query_id: string;
  executed_at: Date;
  total_matches: number;
  returned_count: number;
  entries: AuditTrailEntry[];
  aggregations?: Record<string, any>;
  query_metadata: QueryMetadata;
}

export interface QueryMetadata {
  execution_time: number;
  query_complexity: string;
  cache_hit: boolean;
}

export interface MonitoringSession {
  id: string;
  started_at: Date;
  rules: MonitoringRule[];
  status: 'active' | 'paused' | 'stopped';
  events_processed: number;
  alerts_triggered: number;
  last_activity: Date;
}

export interface ComplianceAuditReport {
  report_id: string;
  generated_at: Date;
  reporting_period: { start: Date; end: Date };
  total_events: number;
  compliance_summary: ComplianceSummary;
  risk_analysis: RiskAnalysis;
  user_activity_analysis: UserActivityAnalysis;
  system_activity_analysis: SystemActivityAnalysis;
  data_access_patterns: DataAccessPattern[];
  security_incidents: SecurityIncident[];
  policy_violations: PolicyViolation[];
  trends_and_anomalies: TrendAnalysis;
  recommendations: string[];
  regulatory_compliance: RegulatoryComplianceAssessment;
}

export interface IntegrityVerificationResult {
  verification_id: string;
  verified_at: Date;
  total_entries: number;
  verified_entries: number;
  corrupted_entries: number;
  verification_results: EntryVerificationResult[];
  integrity_score: number;
  recommendations: string[];
}

export interface EntryVerificationResult {
  entry_id: string;
  verified: boolean;
  integrity_hash: string;
  verification_method: string;
  issues?: string[];
}

export interface AuditRulesResult {
  configuration_id: string;
  configured_at: Date;
  total_rules: number;
  successful_configurations: number;
  failed_configurations: number;
  configuration_results: RuleConfigurationResult[];
}

export interface RuleConfigurationResult {
  rule_id: string;
  rule_type: 'audit' | 'alert';
  success: boolean;
  message: string;
}

export interface AutomatedAnalysisResult {
  analysis_id: string;
  performed_at: Date;
  analysis_type: string;
  data_period: { start: Date; end: Date };
  findings: AnalysisFinding[];
  risk_indicators: RiskIndicator[];
  recommendations: string[];
  confidence_score: number;
}

export interface AnalysisFinding {
  id: string;
  type: string;
  severity: RiskLevel;
  description: string;
  evidence: any[];
  confidence: number;
}

export interface RiskIndicator {
  id: string;
  category: string;
  risk_level: RiskLevel;
  description: string;
  likelihood: number;
  impact: number;
}

export interface ComplianceSummary {
  compliance_score: number;
  policy_adherence: number;
  regulatory_compliance: number;
  security_posture: number;
}

export interface RiskAnalysis {
  overall_risk_score: number;
  risk_distribution: Record<RiskLevel, number>;
  top_risks: RiskIndicator[];
  risk_trends: any[];
}

export interface UserActivityAnalysis {
  total_users: number;
  active_users: number;
  high_risk_users: string[];
  activity_patterns: any[];
}

export interface SystemActivityAnalysis {
  total_systems: number;
  system_usage: any[];
  performance_metrics: any[];
  availability_metrics: any[];
}

export interface DataAccessPattern {
  pattern_type: string;
  frequency: number;
  users: string[];
  resources: string[];
  risk_level: RiskLevel;
}

export interface SecurityIncident {
  incident_id: string;
  type: string;
  severity: RiskLevel;
  detected_at: Date;
  affected_resources: string[];
  description: string;
}

export interface PolicyViolation {
  violation_id: string;
  policy: string;
  severity: RiskLevel;
  user: string;
  resource: string;
  description: string;
}

export interface TrendAnalysis {
  activity_trends: any[];
  risk_trends: any[];
  compliance_trends: any[];
  anomalies: any[];
}

export interface RegulatoryComplianceAssessment {
  frameworks: Record<string, ComplianceFrameworkAssessment>;
  overall_compliance: number;
  gaps: ComplianceGap[];
}

export interface ComplianceFrameworkAssessment {
  framework: string;
  compliance_score: number;
  requirements_met: number;
  requirements_total: number;
  gaps: string[];
}

export interface ComplianceGap {
  requirement: string;
  current_state: string;
  required_state: string;
  severity: RiskLevel;
  remediation: string;
}
