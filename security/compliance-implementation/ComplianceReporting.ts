import {
  ComplianceReport,
  ComplianceReportType,
  RegulatoryFramework,
  ComplianceScope,
  ComplianceFinding,
  ComplianceRecommendation,
  ReportingPeriod,
  ReportStatus,
  ComplianceServiceResponse,
  ComplianceMetadata,
  RiskLevel,
  ComplianceReportData,
} from "./types";

export class ComplianceReportingService {
  private reports: Map<string, ComplianceReport> = new Map();
  private reportTemplates: Map<string, ReportTemplate> = new Map();
  private schedules: Map<string, ReportSchedule> = new Map();
  private dataCollectors: Map<string, DataCollector> = new Map();

  constructor(
    private config: ComplianceReportingConfig,
    private logger: any,
    private dataService: any,
    private renderingService: any,
    private distributionService: any,
  ) {
    this.initializeReportTemplates();
    this.initializeDataCollectors();
  }

  // Generate Compliance Reports
  async generateComplianceReport(
    reportRequest: ComplianceReportRequest,
  ): Promise<ComplianceServiceResponse<ComplianceReport>> {
    try {
      const reportId = this.generateReportId();

      // Initialize report
      const report: ComplianceReport = {
        id: reportId,
        type: reportRequest.type,
        period: reportRequest.period,
        generatedAt: new Date(),
        generatedBy: reportRequest.generatedBy,
        data: {} as ComplianceReportData,
        status: ReportStatus.GENERATING,
        regulatoryFramework: reportRequest.framework,
        scope: reportRequest.scope,
        findings: [],
        recommendations: [],
        metadata: this.createMetadata(),
      };

      this.reports.set(reportId, report);

      // Collect data based on report type
      const reportData = await this.collectReportData(reportRequest);

      // Generate findings and analysis
      const findings = await this.generateFindings(reportData, reportRequest);
      const recommendations = await this.generateRecommendations(
        findings,
        reportRequest,
      );

      // Update report with collected data
      report.data = reportData;
      report.findings = findings;
      report.recommendations = recommendations;
      report.status = ReportStatus.COMPLETED;

      // Generate executive summary
      report.data.summary = await this.generateExecutiveSummary(report);

      return {
        success: true,
        data: report,
      };
    } catch (error) {
      const report = this.reports.get(reportRequest.reportId || "");
      if (report) {
        report.status = ReportStatus.FAILED;
      }

      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Report generation failed",
      };
    }
  }

  // Scheduled Reporting
  async scheduleReport(
    scheduleRequest: ReportScheduleRequest,
  ): Promise<ComplianceServiceResponse<ReportSchedule>> {
    try {
      const scheduleId = this.generateScheduleId();

      const schedule: ReportSchedule = {
        id: scheduleId,
        name: scheduleRequest.name,
        description: scheduleRequest.description,
        reportType: scheduleRequest.reportType,
        framework: scheduleRequest.framework,
        frequency: scheduleRequest.frequency,
        recipients: scheduleRequest.recipients,
        parameters: scheduleRequest.parameters,
        enabled: true,
        nextExecution: this.calculateNextExecution(scheduleRequest.frequency),
        lastExecution: undefined,
        createdAt: new Date(),
        createdBy: scheduleRequest.createdBy,
      };

      this.schedules.set(scheduleId, schedule);

      // Schedule the automated execution
      await this.scheduleAutomatedExecution(schedule);

      return {
        success: true,
        data: schedule,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Report scheduling failed",
      };
    }
  }

  // Execute Scheduled Reports
  async executeScheduledReports(): Promise<
    ComplianceServiceResponse<ScheduledReportExecutionResult>
  > {
    try {
      const dueSchedules = Array.from(this.schedules.values()).filter(
        (schedule) => schedule.enabled && this.isExecutionDue(schedule),
      );

      const executionResults: ScheduleExecutionResult[] = [];

      for (const schedule of dueSchedules) {
        try {
          const reportRequest = this.createReportRequestFromSchedule(schedule);
          const reportResult =
            await this.generateComplianceReport(reportRequest);

          if (reportResult.success) {
            // Distribute the report
            await this.distributeReport(
              reportResult.data!,
              schedule.recipients,
            );

            // Update schedule
            schedule.lastExecution = new Date();
            schedule.nextExecution = this.calculateNextExecution(
              schedule.frequency,
            );

            executionResults.push({
              schedule_id: schedule.id,
              report_id: reportResult.data!.id,
              success: true,
              execution_time: new Date(),
              recipients_notified: schedule.recipients.length,
            });
          } else {
            executionResults.push({
              schedule_id: schedule.id,
              success: false,
              error: reportResult.error,
              execution_time: new Date(),
            });
          }
        } catch (error) {
          executionResults.push({
            schedule_id: schedule.id,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            execution_time: new Date(),
          });
        }
      }

      const result: ScheduledReportExecutionResult = {
        execution_id: this.generateId(),
        executed_at: new Date(),
        schedules_due: dueSchedules.length,
        reports_generated: executionResults.filter((r) => r.success).length,
        reports_failed: executionResults.filter((r) => !r.success).length,
        execution_results: executionResults,
      };

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Scheduled report execution failed",
      };
    }
  }

  // Export Reports
  async exportReport(
    reportId: string,
    exportFormat: ExportFormat,
    exportOptions?: ExportOptions,
  ): Promise<ComplianceServiceResponse<ExportResult>> {
    try {
      const report = this.reports.get(reportId);
      if (!report) {
        return {
          success: false,
          error: "Report not found",
        };
      }

      const exportResult = await this.performExport(
        report,
        exportFormat,
        exportOptions,
      );

      return {
        success: true,
        data: exportResult,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Report export failed",
      };
    }
  }

  // Generate Dashboard Metrics
  async generateDashboardMetrics(
    dashboardRequest: DashboardMetricsRequest,
  ): Promise<ComplianceServiceResponse<DashboardMetrics>> {
    try {
      const metrics: DashboardMetrics = {
        period: dashboardRequest.period,
        generated_at: new Date(),
        compliance_overview:
          await this.generateComplianceOverview(dashboardRequest),
        risk_summary: await this.generateRiskSummary(dashboardRequest),
        trend_analysis: await this.generateTrendAnalysis(dashboardRequest),
        key_metrics: await this.generateKeyMetrics(dashboardRequest),
        recent_activities: await this.getRecentActivities(dashboardRequest),
        upcoming_deadlines: await this.getUpcomingDeadlines(dashboardRequest),
        action_items: await this.getActionItems(dashboardRequest),
      };

      return {
        success: true,
        data: metrics,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Dashboard metrics generation failed",
      };
    }
  }

  // Generate Regulatory Reports
  async generateRegulatoryReport(
    regulatoryRequest: RegulatoryReportRequest,
  ): Promise<ComplianceServiceResponse<RegulatoryReport>> {
    try {
      const report: RegulatoryReport = {
        id: this.generateReportId(),
        framework: regulatoryRequest.framework,
        reporting_period: regulatoryRequest.period,
        generated_at: new Date(),
        organization_info: await this.getOrganizationInfo(),
        compliance_statement:
          await this.generateComplianceStatement(regulatoryRequest),
        detailed_assessment:
          await this.generateDetailedAssessment(regulatoryRequest),
        evidence_documentation:
          await this.collectEvidenceDocumentation(regulatoryRequest),
        remediation_plans:
          await this.generateRemediationPlans(regulatoryRequest),
        certifications: await this.getCertifications(
          regulatoryRequest.framework,
        ),
        attestation: await this.generateAttestation(regulatoryRequest),
        submission_metadata: {
          prepared_by: regulatoryRequest.preparedBy,
          reviewed_by: regulatoryRequest.reviewedBy,
          approved_by: regulatoryRequest.approvedBy,
          submission_date: new Date(),
          version: "1.0",
        },
      };

      return {
        success: true,
        data: report,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Regulatory report generation failed",
      };
    }
  }

  // Compliance Benchmarking
  async generateBenchmarkReport(
    benchmarkRequest: BenchmarkReportRequest,
  ): Promise<ComplianceServiceResponse<BenchmarkReport>> {
    try {
      const report: BenchmarkReport = {
        id: this.generateReportId(),
        benchmark_type: benchmarkRequest.benchmarkType,
        comparison_period: benchmarkRequest.period,
        generated_at: new Date(),
        internal_metrics: await this.getInternalMetrics(benchmarkRequest),
        industry_benchmarks: await this.getIndustryBenchmarks(benchmarkRequest),
        peer_comparisons: await this.getPeerComparisons(benchmarkRequest),
        performance_gaps: await this.identifyPerformanceGaps(benchmarkRequest),
        improvement_opportunities:
          await this.identifyImprovementOpportunities(benchmarkRequest),
        recommendations:
          await this.generateBenchmarkRecommendations(benchmarkRequest),
        action_plan: await this.generateImprovementActionPlan(benchmarkRequest),
      };

      return {
        success: true,
        data: report,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Benchmark report generation failed",
      };
    }
  }

  // Report Analytics and Insights
  async generateReportAnalytics(
    analyticsRequest: ReportAnalyticsRequest,
  ): Promise<ComplianceServiceResponse<ReportAnalytics>> {
    try {
      const analytics: ReportAnalytics = {
        analysis_id: this.generateId(),
        generated_at: new Date(),
        period: analyticsRequest.period,
        compliance_trends: await this.analyzeComplianceTrends(analyticsRequest),
        risk_patterns: await this.analyzeRiskPatterns(analyticsRequest),
        performance_metrics:
          await this.analyzePerformanceMetrics(analyticsRequest),
        predictive_insights:
          await this.generatePredictiveInsights(analyticsRequest),
        anomaly_detection: await this.detectAnomalies(analyticsRequest),
        correlation_analysis:
          await this.performCorrelationAnalysis(analyticsRequest),
        recommendations:
          await this.generateAnalyticsRecommendations(analyticsRequest),
      };

      return {
        success: true,
        data: analytics,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Report analytics generation failed",
      };
    }
  }

  // Private helper methods
  private async collectReportData(
    request: ComplianceReportRequest,
  ): Promise<ComplianceReportData> {
    const collector = this.dataCollectors.get(request.type);
    if (!collector) {
      throw new Error(
        `No data collector found for report type: ${request.type}`,
      );
    }

    return await collector.collect(request);
  }

  private async generateFindings(
    data: ComplianceReportData,
    request: ComplianceReportRequest,
  ): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = [];

    // Analyze compliance violations
    if (data.violations && data.violations.length > 0) {
      for (const violation of data.violations) {
        findings.push({
          id: this.generateId(),
          category: "compliance_violation",
          severity: violation.severity,
          description: violation.description,
          evidence: violation.evidence || [],
          impactAssessment:
            violation.impactAssessment || "Impact assessment pending",
          status: "open",
        });
      }
    }

    // Check for trending issues
    const trends = data.trends || {};
    for (const [metric, trend] of Object.entries(trends)) {
      if (this.isTrendConcerning(trend as any)) {
        findings.push({
          id: this.generateId(),
          category: "trending_concern",
          severity: this.assessTrendSeverity(trend as any),
          description: `Concerning trend detected in ${metric}`,
          evidence: [trend],
          impactAssessment: "Requires monitoring and potential intervention",
          status: "open",
        });
      }
    }

    return findings;
  }

  private async generateRecommendations(
    findings: ComplianceFinding[],
    request: ComplianceReportRequest,
  ): Promise<ComplianceRecommendation[]> {
    const recommendations: ComplianceRecommendation[] = [];

    for (const finding of findings) {
      const recommendation: ComplianceRecommendation = {
        id: this.generateId(),
        priority: this.mapSeverityToPriority(finding.severity),
        category: finding.category,
        description: await this.generateRecommendationDescription(finding),
        implementation: await this.generateImplementationGuidance(finding),
        timeline: await this.estimateImplementationTimeline(finding),
        assignee: await this.suggestAssignee(finding),
        estimatedCost: await this.estimateImplementationCost(finding),
      };

      recommendations.push(recommendation);
    }

    return recommendations;
  }

  private async performExport(
    report: ComplianceReport,
    format: ExportFormat,
    options?: ExportOptions,
  ): Promise<ExportResult> {
    const exportId = this.generateId();

    let exportedData: Buffer;
    let mimeType: string;
    let fileExtension: string;

    switch (format) {
      case ExportFormat.PDF:
        exportedData = await this.renderingService.renderToPDF(report, options);
        mimeType = "application/pdf";
        fileExtension = "pdf";
        break;
      case ExportFormat.EXCEL:
        exportedData = await this.renderingService.renderToExcel(
          report,
          options,
        );
        mimeType =
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        fileExtension = "xlsx";
        break;
      case ExportFormat.CSV:
        exportedData = await this.renderingService.renderToCSV(report, options);
        mimeType = "text/csv";
        fileExtension = "csv";
        break;
      case ExportFormat.JSON:
        exportedData = Buffer.from(JSON.stringify(report, null, 2));
        mimeType = "application/json";
        fileExtension = "json";
        break;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    const result: ExportResult = {
      export_id: exportId,
      report_id: report.id,
      format,
      file_name: `compliance_report_${report.id}.${fileExtension}`,
      file_size: exportedData.length,
      mime_type: mimeType,
      exported_at: new Date(),
      download_url: await this.generateDownloadUrl(exportId, exportedData),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };

    return result;
  }

  private generateReportId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateScheduleId(): string {
    return `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateId(): string {
    return `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createMetadata(): ComplianceMetadata {
    return {
      id: this.generateId(),
      version: "1.0",
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: "compliance-reporting-service",
      updatedBy: "compliance-reporting-service",
      tags: ["compliance", "reporting"],
      classification: "confidential" as any,
    };
  }

  private initializeReportTemplates(): void {
    // Initialize standard report templates
    this.reportTemplates.set("gdpr_compliance", {
      id: "gdpr_compliance",
      name: "GDPR Compliance Report",
      framework: RegulatoryFramework.GDPR,
      sections: [
        "executive_summary",
        "data_processing_activities",
        "consent_management",
        "data_subject_rights",
        "security_measures",
      ],
      requiredData: [
        "consent_records",
        "processing_activities",
        "subject_requests",
        "security_incidents",
      ],
    });

    this.reportTemplates.set("data_breach", {
      id: "data_breach",
      name: "Data Breach Report",
      framework: RegulatoryFramework.GDPR,
      sections: [
        "incident_overview",
        "impact_assessment",
        "containment_actions",
        "notification_timeline",
        "lessons_learned",
      ],
      requiredData: [
        "incident_details",
        "affected_data",
        "response_actions",
        "notifications",
      ],
    });
  }

  private initializeDataCollectors(): void {
    // Initialize data collectors for different report types
    this.dataCollectors.set(ComplianceReportType.GDPR_COMPLIANCE, {
      collect: async (request: ComplianceReportRequest) => {
        return {
          summary: await this.dataService.getGDPRComplianceSummary(
            request.period,
          ),
          metrics: await this.dataService.getGDPRMetrics(request.period),
          trends: await this.dataService.getGDPRTrends(request.period),
          violations: await this.dataService.getGDPRViolations(request.period),
          recommendations: [],
        };
      },
    });

    this.dataCollectors.set(ComplianceReportType.DATA_BREACH, {
      collect: async (request: ComplianceReportRequest) => {
        return {
          summary: await this.dataService.getDataBreachSummary(request.period),
          metrics: await this.dataService.getDataBreachMetrics(request.period),
          trends: await this.dataService.getDataBreachTrends(request.period),
          violations: [],
          recommendations: [],
        };
      },
    });
  }

  private calculateNextExecution(frequency: ReportFrequency): Date {
    const now = new Date();
    switch (frequency) {
      case ReportFrequency.DAILY:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case ReportFrequency.WEEKLY:
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case ReportFrequency.MONTHLY:
        return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
      case ReportFrequency.QUARTERLY:
        return new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());
      case ReportFrequency.ANNUALLY:
        return new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  private isExecutionDue(schedule: ReportSchedule): boolean {
    return schedule.nextExecution <= new Date();
  }

  private createReportRequestFromSchedule(
    schedule: ReportSchedule,
  ): ComplianceReportRequest {
    return {
      type: schedule.reportType,
      framework: schedule.framework,
      period: this.calculatePeriodFromFrequency(schedule.frequency),
      scope: schedule.parameters.scope || this.getDefaultScope(),
      generatedBy: "system",
      includeExecutiveSummary: true,
      includeRecommendations: true,
    };
  }

  private calculatePeriodFromFrequency(
    frequency: ReportFrequency,
  ): ReportingPeriod {
    const end = new Date();
    let start: Date;

    switch (frequency) {
      case ReportFrequency.DAILY:
        start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
        break;
      case ReportFrequency.WEEKLY:
        start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case ReportFrequency.MONTHLY:
        start = new Date(end.getFullYear(), end.getMonth() - 1, end.getDate());
        break;
      case ReportFrequency.QUARTERLY:
        start = new Date(end.getFullYear(), end.getMonth() - 3, end.getDate());
        break;
      case ReportFrequency.ANNUALLY:
        start = new Date(end.getFullYear() - 1, end.getMonth(), end.getDate());
        break;
      default:
        start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return {
      type: frequency === ReportFrequency.CUSTOM ? "custom" : frequency,
      start,
      end,
    };
  }

  private getDefaultScope(): ComplianceScope {
    return {
      dataTypes: [],
      regions: [],
      businessUnits: [],
      timeRange: {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date(),
      },
    };
  }

  // Placeholder implementations
  private isTrendConcerning(trend: any): boolean {
    return false; // Placeholder
  }

  private assessTrendSeverity(trend: any): RiskLevel {
    return RiskLevel.MEDIUM; // Placeholder
  }

  private mapSeverityToPriority(
    severity: RiskLevel,
  ): "high" | "medium" | "low" {
    switch (severity) {
      case RiskLevel.VERY_HIGH:
      case RiskLevel.HIGH:
        return "high";
      case RiskLevel.MEDIUM:
        return "medium";
      default:
        return "low";
    }
  }

  private async generateRecommendationDescription(
    finding: ComplianceFinding,
  ): Promise<string> {
    return `Address ${finding.category} finding with ${finding.severity} severity`;
  }

  private async generateImplementationGuidance(
    finding: ComplianceFinding,
  ): Promise<string> {
    return "Implementation guidance pending";
  }

  private async estimateImplementationTimeline(
    finding: ComplianceFinding,
  ): Promise<string> {
    return "30 days";
  }

  private async suggestAssignee(finding: ComplianceFinding): Promise<string> {
    return "compliance-team";
  }

  private async estimateImplementationCost(
    finding: ComplianceFinding,
  ): Promise<number> {
    return 5000; // Placeholder
  }

  private async generateDownloadUrl(
    exportId: string,
    data: Buffer,
  ): Promise<string> {
    return `https://api.example.com/reports/download/${exportId}`;
  }

  private async generateExecutiveSummary(
    report: ComplianceReport,
  ): Promise<Record<string, any>> {
    return {
      overview: "Executive summary content",
      key_findings: report.findings.length,
      recommendations: report.recommendations.length,
      risk_level: "medium",
    };
  }
}

// Supporting interfaces and types
export interface ComplianceReportingConfig {
  defaultRetentionDays: number;
  maxReportSize: number;
  enableScheduledReports: boolean;
  exportFormats: ExportFormat[];
  distributionMethods: string[];
}

export interface ComplianceReportRequest {
  reportId?: string;
  type: ComplianceReportType;
  framework: RegulatoryFramework;
  period: ReportingPeriod;
  scope: ComplianceScope;
  generatedBy: string;
  includeExecutiveSummary?: boolean;
  includeRecommendations?: boolean;
  customParameters?: Record<string, any>;
}

export interface ReportScheduleRequest {
  name: string;
  description: string;
  reportType: ComplianceReportType;
  framework: RegulatoryFramework;
  frequency: ReportFrequency;
  recipients: ReportRecipient[];
  parameters: ReportParameters;
  createdBy: string;
}

export interface ReportSchedule {
  id: string;
  name: string;
  description: string;
  reportType: ComplianceReportType;
  framework: RegulatoryFramework;
  frequency: ReportFrequency;
  recipients: ReportRecipient[];
  parameters: ReportParameters;
  enabled: boolean;
  nextExecution: Date;
  lastExecution?: Date;
  createdAt: Date;
  createdBy: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  framework: RegulatoryFramework;
  sections: string[];
  requiredData: string[];
}

export interface DataCollector {
  collect(request: ComplianceReportRequest): Promise<ComplianceReportData>;
}

export interface DashboardMetricsRequest {
  period: ReportingPeriod;
  frameworks?: RegulatoryFramework[];
  scope?: ComplianceScope;
}

export interface RegulatoryReportRequest {
  framework: RegulatoryFramework;
  period: ReportingPeriod;
  preparedBy: string;
  reviewedBy?: string;
  approvedBy?: string;
  includeEvidence: boolean;
}

export interface BenchmarkReportRequest {
  benchmarkType: "industry" | "peer" | "historical";
  period: ReportingPeriod;
  comparisonTargets: string[];
  metrics: string[];
}

export interface ReportAnalyticsRequest {
  period: ReportingPeriod;
  analysisTypes: string[];
  includePredict: boolean;
}

export interface ExportOptions {
  includeCharts?: boolean;
  includeRawData?: boolean;
  templateId?: string;
  customStyling?: any;
}

export interface ReportRecipient {
  type: "email" | "webhook" | "system";
  address: string;
  format: ExportFormat;
  accessLevel: "full" | "summary" | "executive";
}

export interface ReportParameters {
  scope: ComplianceScope;
  includeRecommendations: boolean;
  includeExecutiveSummary: boolean;
  customFilters?: Record<string, any>;
}

export enum ExportFormat {
  PDF = "pdf",
  EXCEL = "excel",
  CSV = "csv",
  JSON = "json",
  HTML = "html",
}

export enum ReportFrequency {
  DAILY = "daily",
  WEEKLY = "weekly",
  MONTHLY = "monthly",
  QUARTERLY = "quarterly",
  ANNUALLY = "annually",
  CUSTOM = "custom",
}

// Result interfaces
export interface ScheduledReportExecutionResult {
  execution_id: string;
  executed_at: Date;
  schedules_due: number;
  reports_generated: number;
  reports_failed: number;
  execution_results: ScheduleExecutionResult[];
}

export interface ScheduleExecutionResult {
  schedule_id: string;
  report_id?: string;
  success: boolean;
  error?: string;
  execution_time: Date;
  recipients_notified?: number;
}

export interface ExportResult {
  export_id: string;
  report_id: string;
  format: ExportFormat;
  file_name: string;
  file_size: number;
  mime_type: string;
  exported_at: Date;
  download_url: string;
  expires_at: Date;
}

export interface DashboardMetrics {
  period: ReportingPeriod;
  generated_at: Date;
  compliance_overview: ComplianceOverview;
  risk_summary: RiskSummary;
  trend_analysis: TrendAnalysis;
  key_metrics: KeyMetric[];
  recent_activities: Activity[];
  upcoming_deadlines: Deadline[];
  action_items: ActionItem[];
}

export interface RegulatoryReport {
  id: string;
  framework: RegulatoryFramework;
  reporting_period: ReportingPeriod;
  generated_at: Date;
  organization_info: OrganizationInfo;
  compliance_statement: ComplianceStatement;
  detailed_assessment: DetailedAssessment;
  evidence_documentation: EvidenceDocumentation;
  remediation_plans: RemediationPlan[];
  certifications: Certification[];
  attestation: Attestation;
  submission_metadata: SubmissionMetadata;
}

export interface BenchmarkReport {
  id: string;
  benchmark_type: string;
  comparison_period: ReportingPeriod;
  generated_at: Date;
  internal_metrics: BenchmarkMetric[];
  industry_benchmarks: BenchmarkMetric[];
  peer_comparisons: PeerComparison[];
  performance_gaps: PerformanceGap[];
  improvement_opportunities: ImprovementOpportunity[];
  recommendations: string[];
  action_plan: ActionPlan;
}

export interface ReportAnalytics {
  analysis_id: string;
  generated_at: Date;
  period: ReportingPeriod;
  compliance_trends: ComplianceTrend[];
  risk_patterns: RiskPattern[];
  performance_metrics: PerformanceMetric[];
  predictive_insights: PredictiveInsight[];
  anomaly_detection: Anomaly[];
  correlation_analysis: CorrelationAnalysis;
  recommendations: string[];
}

// Supporting data types
export interface ComplianceOverview {
  overall_score: number;
  framework_scores: Record<string, number>;
  trend: "improving" | "stable" | "declining";
}

export interface RiskSummary {
  total_risks: number;
  high_priority_risks: number;
  risk_distribution: Record<RiskLevel, number>;
}

export interface TrendAnalysis {
  compliance_trend: "improving" | "stable" | "declining";
  risk_trend: "increasing" | "stable" | "decreasing";
  key_changes: string[];
}

export interface KeyMetric {
  name: string;
  value: number;
  target?: number;
  trend: "up" | "down" | "stable";
  importance: "high" | "medium" | "low";
}

export interface Activity {
  date: Date;
  type: string;
  description: string;
  impact: RiskLevel;
}

export interface Deadline {
  date: Date;
  description: string;
  priority: "high" | "medium" | "low";
  responsible: string;
}

export interface ActionItem {
  id: string;
  description: string;
  priority: "high" | "medium" | "low";
  due_date: Date;
  assignee: string;
  status: "open" | "in_progress" | "completed";
}

export interface OrganizationInfo {
  name: string;
  address: string;
  contact_person: string;
  registration_number: string;
  industry: string;
}

export interface ComplianceStatement {
  framework: RegulatoryFramework;
  compliance_level: string;
  assessment_date: Date;
  assessor: string;
  validity_period: string;
}

export interface DetailedAssessment {
  requirements: RequirementAssessment[];
  overall_compliance: number;
  gaps: ComplianceGap[];
}

export interface RequirementAssessment {
  requirement_id: string;
  description: string;
  compliance_status: "compliant" | "partial" | "non_compliant";
  evidence: string[];
  notes: string;
}

export interface ComplianceGap {
  requirement: string;
  current_state: string;
  required_state: string;
  severity: RiskLevel;
  remediation: string;
}

export interface EvidenceDocumentation {
  documents: EvidenceDocument[];
  total_items: number;
  last_updated: Date;
}

export interface EvidenceDocument {
  id: string;
  title: string;
  type: string;
  url: string;
  last_modified: Date;
}

export interface RemediationPlan {
  gap_id: string;
  description: string;
  steps: RemediationStep[];
  timeline: string;
  responsible: string;
  budget: number;
}

export interface RemediationStep {
  order: number;
  description: string;
  timeline: string;
  dependencies: number[];
}

export interface Certification {
  name: string;
  issuer: string;
  issue_date: Date;
  expiry_date: Date;
  certificate_url: string;
}

export interface Attestation {
  attester_name: string;
  attester_title: string;
  attestation_date: Date;
  statement: string;
  signature: string;
}

export interface SubmissionMetadata {
  prepared_by: string;
  reviewed_by?: string;
  approved_by?: string;
  submission_date: Date;
  version: string;
}

export interface BenchmarkMetric {
  metric_name: string;
  value: number;
  unit: string;
  category: string;
}

export interface PeerComparison {
  peer_name: string;
  metrics: BenchmarkMetric[];
  relative_performance: number;
}

export interface PerformanceGap {
  metric: string;
  current_value: number;
  benchmark_value: number;
  gap_percentage: number;
  significance: "high" | "medium" | "low";
}

export interface ImprovementOpportunity {
  area: string;
  description: string;
  potential_impact: number;
  effort_required: "high" | "medium" | "low";
  priority: "high" | "medium" | "low";
}

export interface ActionPlan {
  objectives: Objective[];
  timeline: string;
  budget: number;
  success_metrics: string[];
}

export interface Objective {
  id: string;
  description: string;
  target: string;
  timeline: string;
  responsible: string;
  metrics: string[];
}

export interface ComplianceTrend {
  framework: RegulatoryFramework;
  trend_direction: "improving" | "stable" | "declining";
  change_rate: number;
  key_drivers: string[];
}

export interface RiskPattern {
  pattern_type: string;
  frequency: number;
  trend: "increasing" | "stable" | "decreasing";
  impact_level: RiskLevel;
}

export interface PerformanceMetric {
  metric_name: string;
  current_value: number;
  previous_value: number;
  change_percentage: number;
  trend: "improving" | "stable" | "declining";
}

export interface PredictiveInsight {
  insight_type: string;
  prediction: string;
  confidence: number;
  timeframe: string;
  potential_impact: RiskLevel;
}

export interface Anomaly {
  type: string;
  description: string;
  severity: RiskLevel;
  detected_at: Date;
  affected_areas: string[];
}

export interface CorrelationAnalysis {
  correlations: Correlation[];
  insights: string[];
}

export interface Correlation {
  metric1: string;
  metric2: string;
  correlation_coefficient: number;
  significance: "high" | "medium" | "low";
}
