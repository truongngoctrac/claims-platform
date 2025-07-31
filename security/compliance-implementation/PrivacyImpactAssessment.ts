import {
  PrivacyImpactAssessment,
  DataType,
  DataProcessingPurpose,
  PrivacyRisk,
  RiskMitigation,
  PIAStatus,
  RiskLevel,
  PIAMonitoring,
  ComplianceServiceResponse,
  ComplianceMetadata,
  DataClassification,
} from "./types";

export class PrivacyImpactAssessmentService {
  private assessments: Map<string, PrivacyImpactAssessment> = new Map();
  private piaTemplates: Map<string, PIATemplate> = new Map();
  private riskRegistry: Map<string, PrivacyRiskDefinition> = new Map();
  private stakeholderRegistry: Map<string, Stakeholder> = new Map();

  constructor(
    private config: PIAConfig,
    private logger: any,
  ) {
    this.initializePIATemplates();
    this.initializeRiskRegistry();
  }

  // Create Privacy Impact Assessment following Vietnamese and GDPR requirements
  async createPrivacyImpactAssessment(
    request: PIARequest,
  ): Promise<ComplianceServiceResponse<PrivacyImpactAssessment>> {
    try {
      const piaId = this.generatePIAId();

      // Determine if PIA is mandatory based on Vietnamese and GDPR criteria
      const piaRequirement = await this.assessPIARequirement(request);

      const pia: PrivacyImpactAssessment = {
        id: piaId,
        projectName: request.projectName,
        description: request.description,
        dataController: request.dataController,
        dataProcessor: request.dataProcessor,
        assessmentDate: new Date(),
        reviewer: request.reviewer,
        status: PIAStatus.DRAFT,
        riskLevel: RiskLevel.MEDIUM,
        dataTypes: request.dataTypes,
        dataSubjects: request.dataSubjects,
        processingPurposes: request.processingPurposes,
        risks: [],
        mitigations: [],
        monitoring: {
          reviewSchedule: "annually",
          nextReviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          keyIndicators: [],
          monitoringPlan: "",
          escalationProcedure: "",
        },
        metadata: this.createMetadata(),
      };

      // Populate assessment based on Vietnamese requirements
      await this.populateVietnameseRequirements(pia, request);

      // Populate assessment based on GDPR requirements
      await this.populateGDPRRequirements(pia, request);

      // Perform initial risk assessment
      pia.risks = await this.conductInitialRiskAssessment(pia, request);
      pia.riskLevel = this.calculateOverallRiskLevel(pia.risks);

      // Generate initial mitigations
      pia.mitigations = await this.generateInitialMitigations(pia.risks);

      this.assessments.set(piaId, pia);

      return {
        success: true,
        data: pia,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "PIA creation failed",
      };
    }
  }

  // Conduct comprehensive privacy risk assessment
  async conductPrivacyRiskAssessment(
    piaId: string,
  ): Promise<ComplianceServiceResponse<PrivacyRiskAssessmentResult>> {
    try {
      const pia = this.assessments.get(piaId);
      if (!pia) {
        return {
          success: false,
          error: "PIA not found",
        };
      }

      const riskAssessment: PrivacyRiskAssessmentResult = {
        pia_id: piaId,
        assessment_date: new Date(),
        risk_methodology: "Vietnamese_GDPR_Combined",
        identified_risks: [],
        risk_matrix: await this.generateRiskMatrix(pia),
        high_priority_risks: [],
        systemic_risks: await this.identifySystemicRisks(pia),
        data_subject_impact: await this.assessDataSubjectImpact(pia),
        organizational_impact: await this.assessOrganizationalImpact(pia),
        compliance_risks: await this.assessComplianceRisks(pia),
        technical_risks: await this.assessTechnicalRisks(pia),
        operational_risks: await this.assessOperationalRisks(pia),
        reputational_risks: await this.assessReputationalRisks(pia),
        overall_risk_score: 0,
        recommendations: [],
      };

      // Conduct detailed risk analysis
      riskAssessment.identified_risks = await this.identifyAllPrivacyRisks(pia);
      riskAssessment.high_priority_risks =
        riskAssessment.identified_risks.filter(
          (risk) =>
            risk.overallRisk === RiskLevel.HIGH ||
            risk.overallRisk === RiskLevel.VERY_HIGH,
        );

      riskAssessment.overall_risk_score = this.calculateOverallRiskScore(
        riskAssessment.identified_risks,
      );
      riskAssessment.recommendations =
        await this.generateRiskRecommendations(riskAssessment);

      // Update PIA with detailed risks
      pia.risks = riskAssessment.identified_risks;
      pia.riskLevel = this.mapScoreToRiskLevel(
        riskAssessment.overall_risk_score,
      );

      return {
        success: true,
        data: riskAssessment,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Risk assessment failed",
      };
    }
  }

  // Stakeholder consultation process
  async conductStakeholderConsultation(
    piaId: string,
    consultationRequest: StakeholderConsultationRequest,
  ): Promise<ComplianceServiceResponse<StakeholderConsultationResult>> {
    try {
      const pia = this.assessments.get(piaId);
      if (!pia) {
        return {
          success: false,
          error: "PIA not found",
        };
      }

      const consultation: StakeholderConsultationResult = {
        pia_id: piaId,
        consultation_date: new Date(),
        stakeholders_consulted: consultationRequest.stakeholders,
        consultation_methods: consultationRequest.methods,
        feedback_summary:
          await this.collectStakeholderFeedback(consultationRequest),
        concerns_raised:
          await this.identifyStakeholderConcerns(consultationRequest),
        suggestions_received:
          await this.collectStakeholderSuggestions(consultationRequest),
        consensus_areas: await this.identifyConsensusAreas(consultationRequest),
        disagreement_areas:
          await this.identifyDisagreementAreas(consultationRequest),
        follow_up_actions:
          await this.defineFollowUpActions(consultationRequest),
        consultation_effectiveness:
          await this.assessConsultationEffectiveness(consultationRequest),
        documentation:
          await this.generateConsultationDocumentation(consultationRequest),
      };

      return {
        success: true,
        data: consultation,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Stakeholder consultation failed",
      };
    }
  }

  // Data flow mapping for PIA
  async mapDataFlows(
    piaId: string,
  ): Promise<ComplianceServiceResponse<DataFlowMappingResult>> {
    try {
      const pia = this.assessments.get(piaId);
      if (!pia) {
        return {
          success: false,
          error: "PIA not found",
        };
      }

      const dataFlowMapping: DataFlowMappingResult = {
        pia_id: piaId,
        mapping_date: new Date(),
        data_sources: await this.identifyDataSources(pia),
        data_collection_points: await this.identifyCollectionPoints(pia),
        processing_activities: await this.mapProcessingActivities(pia),
        data_sharing: await this.mapDataSharing(pia),
        international_transfers: await this.mapInternationalTransfers(pia),
        data_storage: await this.mapDataStorage(pia),
        data_retention: await this.mapDataRetention(pia),
        data_disposal: await this.mapDataDisposal(pia),
        access_controls: await this.mapAccessControls(pia),
        data_lifecycle: await this.mapDataLifecycle(pia),
        integration_points: await this.identifyIntegrationPoints(pia),
        security_controls: await this.mapSecurityControls(pia),
      };

      return {
        success: true,
        data: dataFlowMapping,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Data flow mapping failed",
      };
    }
  }

  // Mitigation planning and implementation
  async developMitigationPlan(
    piaId: string,
    mitigationRequest: MitigationPlanRequest,
  ): Promise<ComplianceServiceResponse<MitigationPlan>> {
    try {
      const pia = this.assessments.get(piaId);
      if (!pia) {
        return {
          success: false,
          error: "PIA not found",
        };
      }

      const mitigationPlan: MitigationPlan = {
        id: this.generateId(),
        pia_id: piaId,
        plan_name: mitigationRequest.planName,
        description: mitigationRequest.description,
        created_date: new Date(),
        target_risks: mitigationRequest.targetRisks,
        mitigation_strategies: await this.developMitigationStrategies(
          pia,
          mitigationRequest,
        ),
        implementation_timeline:
          await this.createImplementationTimeline(mitigationRequest),
        resource_requirements:
          await this.assessResourceRequirements(mitigationRequest),
        success_metrics: await this.defineMitigationMetrics(mitigationRequest),
        monitoring_plan:
          await this.createMitigationMonitoringPlan(mitigationRequest),
        contingency_plans:
          await this.developContingencyPlans(mitigationRequest),
        stakeholder_responsibilities:
          await this.assignStakeholderResponsibilities(mitigationRequest),
        budget_estimate: await this.estimateMitigationBudget(mitigationRequest),
        approval_workflow:
          await this.defineMitigationApprovalWorkflow(mitigationRequest),
        status: "draft",
      };

      return {
        success: true,
        data: mitigationPlan,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Mitigation plan development failed",
      };
    }
  }

  // PIA approval workflow
  async submitForApproval(
    piaId: string,
    submissionRequest: PIASubmissionRequest,
  ): Promise<ComplianceServiceResponse<PIAApprovalResult>> {
    try {
      const pia = this.assessments.get(piaId);
      if (!pia) {
        return {
          success: false,
          error: "PIA not found",
        };
      }

      // Validate PIA completeness
      const validation = await this.validatePIACompleteness(pia);
      if (!validation.isComplete) {
        return {
          success: false,
          error: `PIA is incomplete: ${validation.missingElements.join(", ")}`,
        };
      }

      // Vietnamese DPO review (if applicable)
      const dpoReview = await this.conductDPOReview(pia);

      // Legal review
      const legalReview = await this.conductLegalReview(pia);

      // Technical review
      const technicalReview = await this.conductTechnicalReview(pia);

      const approvalResult: PIAApprovalResult = {
        pia_id: piaId,
        submission_date: new Date(),
        submitted_by: submissionRequest.submittedBy,
        dpo_review: dpoReview,
        legal_review: legalReview,
        technical_review: technicalReview,
        overall_recommendation: await this.generateOverallRecommendation(
          dpoReview,
          legalReview,
          technicalReview,
        ),
        approval_status: "pending",
        conditions: await this.identifyApprovalConditions(
          dpoReview,
          legalReview,
          technicalReview,
        ),
        next_steps: await this.defineApprovalNextSteps(pia),
        estimated_approval_date: await this.estimateApprovalDate(),
      };

      // Update PIA status
      pia.status = PIAStatus.IN_REVIEW;

      return {
        success: true,
        data: approvalResult,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "PIA submission failed",
      };
    }
  }

  // Monitoring and review
  async schedulePeriodicReview(
    piaId: string,
    reviewSchedule: PIAReviewSchedule,
  ): Promise<ComplianceServiceResponse<PIAReviewScheduleResult>> {
    try {
      const pia = this.assessments.get(piaId);
      if (!pia) {
        return {
          success: false,
          error: "PIA not found",
        };
      }

      const scheduleResult: PIAReviewScheduleResult = {
        pia_id: piaId,
        schedule_created: new Date(),
        review_frequency: reviewSchedule.frequency,
        next_review_date: this.calculateNextReviewDate(
          reviewSchedule.frequency,
        ),
        review_triggers: await this.defineReviewTriggers(pia, reviewSchedule),
        monitoring_indicators: await this.defineMonitoringIndicators(pia),
        automated_checks: await this.setupAutomatedChecks(pia),
        notification_schedule:
          await this.setupNotificationSchedule(reviewSchedule),
        escalation_procedures: await this.defineEscalationProcedures(pia),
        review_responsibilities:
          await this.assignReviewResponsibilities(reviewSchedule),
      };

      // Update PIA monitoring plan
      pia.monitoring = {
        reviewSchedule: reviewSchedule.frequency,
        nextReviewDate: scheduleResult.next_review_date,
        keyIndicators: scheduleResult.monitoring_indicators,
        monitoringPlan: "Automated monitoring with periodic reviews",
        escalationProcedure: JSON.stringify(
          scheduleResult.escalation_procedures,
        ),
      };

      return {
        success: true,
        data: scheduleResult,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Review scheduling failed",
      };
    }
  }

  // Vietnamese-specific PIA requirements
  private async populateVietnameseRequirements(
    pia: PrivacyImpactAssessment,
    request: PIARequest,
  ): Promise<void> {
    // Apply Vietnamese Cybersecurity Law requirements
    const vietnameseRequirements: VietnameseVNSpecificRequirements = {
      cybersecurity_law_compliance:
        await this.assessCybersecurityLawCompliance(request),
      data_localization_requirements:
        await this.assessDataLocalizationRequirements(request),
      cross_border_transfer_approval:
        await this.assessCrossBorderTransferRequirements(request),
      government_agency_notification:
        await this.assessGovernmentNotificationRequirements(request),
      vietnamese_dpo_requirements:
        await this.assessVietnameseDPORequirements(request),
      healthcare_specific_requirements:
        await this.assessHealthcareSpecificRequirements(request),
      ministry_of_health_guidelines:
        await this.applyMinistryOfHealthGuidelines(request),
      vietnam_social_security_requirements:
        await this.assessVietnamSocialSecurityRequirements(request),
    };

    // Extend PIA metadata with Vietnamese requirements
    pia.metadata.tags.push(
      "vietnam_cybersecurity_law",
      "vietnam_healthcare",
      "ministry_of_health",
    );
  }

  // GDPR-specific PIA requirements
  private async populateGDPRRequirements(
    pia: PrivacyImpactAssessment,
    request: PIARequest,
  ): Promise<void> {
    // Apply GDPR Article 35 requirements
    const gdprRequirements: GDPRSpecificRequirements = {
      article_35_threshold: await this.assessGDPRThreshold(request),
      systematic_monitoring: await this.assessSystematicMonitoring(request),
      large_scale_processing: await this.assessLargeScaleProcessing(request),
      special_category_data: await this.assessSpecialCategoryData(request),
      automated_decision_making:
        await this.assessAutomatedDecisionMaking(request),
      data_subject_rights_impact:
        await this.assessDataSubjectRightsImpact(request),
      supervisory_authority_consultation:
        await this.assessSupervisoryAuthorityConsultation(request),
    };

    // Extend PIA metadata with GDPR requirements
    pia.metadata.tags.push("gdpr_article_35", "european_data_protection");
  }

  // Initialize PIA templates for different scenarios
  private initializePIATemplates(): void {
    // Vietnamese Healthcare PIA Template
    this.piaTemplates.set("vietnam_healthcare", {
      id: "vietnam_healthcare",
      name: "Vietnam Healthcare PIA Template",
      description: "PIA template for Vietnamese healthcare organizations",
      applicable_frameworks: [
        "vietnam_cybersecurity_law",
        "vietnam_data_protection_decree",
        "gdpr",
      ],
      sections: [
        {
          id: "project_overview",
          title: "Tổng quan dự án",
          required_fields: [
            "project_name",
            "description",
            "data_controller",
            "data_processor",
          ],
          vietnamese_specific: true,
        },
        {
          id: "data_mapping",
          title: "Sơ đồ dữ liệu",
          required_fields: [
            "data_types",
            "data_sources",
            "processing_purposes",
          ],
          vietnamese_specific: false,
        },
        {
          id: "legal_compliance",
          title: "Tuân thủ pháp lý",
          required_fields: ["legal_basis", "cybersecurity_law_compliance"],
          vietnamese_specific: true,
        },
        {
          id: "risk_assessment",
          title: "Đánh giá rủi ro",
          required_fields: [
            "privacy_risks",
            "security_risks",
            "compliance_risks",
          ],
          vietnamese_specific: false,
        },
        {
          id: "mitigation_measures",
          title: "Biện pháp giảm thiểu",
          required_fields: ["technical_measures", "organizational_measures"],
          vietnamese_specific: false,
        },
        {
          id: "monitoring_plan",
          title: "Kế hoạch giám sát",
          required_fields: ["monitoring_indicators", "review_schedule"],
          vietnamese_specific: true,
        },
      ],
      risk_categories: [
        "unauthorized_access",
        "data_breach",
        "cross_border_transfer",
        "government_compliance",
        "patient_privacy",
        "insurance_fraud",
      ],
    });

    // International GDPR PIA Template
    this.piaTemplates.set("gdpr_standard", {
      id: "gdpr_standard",
      name: "GDPR Standard PIA Template",
      description: "Standard GDPR Article 35 PIA template",
      applicable_frameworks: ["gdpr"],
      sections: [
        {
          id: "processing_description",
          title: "Description of Processing",
          required_fields: [
            "processing_purposes",
            "data_categories",
            "recipients",
          ],
          vietnamese_specific: false,
        },
        {
          id: "necessity_assessment",
          title: "Necessity and Proportionality Assessment",
          required_fields: [
            "legitimate_interests",
            "necessity_test",
            "proportionality_test",
          ],
          vietnamese_specific: false,
        },
        {
          id: "risk_assessment",
          title: "Risk Assessment",
          required_fields: ["privacy_risks", "likelihood", "severity"],
          vietnamese_specific: false,
        },
        {
          id: "consultation",
          title: "Consultation Process",
          required_fields: [
            "stakeholder_consultation",
            "data_subject_consultation",
          ],
          vietnamese_specific: false,
        },
      ],
      risk_categories: [
        "discrimination",
        "identity_theft",
        "financial_loss",
        "reputational_damage",
        "loss_of_control",
        "limitation_of_rights",
      ],
    });
  }

  // Initialize privacy risk registry
  private initializeRiskRegistry(): void {
    // Vietnamese healthcare-specific risks
    this.riskRegistry.set("patient_data_breach", {
      id: "patient_data_breach",
      category: "data_security",
      title: "Vi phạm dữ liệu bệnh nhân",
      description: "Rủi ro rò rỉ thông tin y tế cá nhân của bệnh nhân",
      applicable_contexts: ["healthcare", "insurance"],
      vietnamese_specific: true,
      severity_factors: [
        "data_sensitivity",
        "number_of_subjects",
        "disclosure_scope",
      ],
      regulatory_impact: [
        "vietnam_cybersecurity_law",
        "ministry_of_health_regulations",
      ],
    });

    this.riskRegistry.set("cross_border_transfer_violation", {
      id: "cross_border_transfer_violation",
      category: "data_transfer",
      title: "Vi phạm quy định chuyển giao dữ liệu qua biên giới",
      description: "Rủi ro vi phạm quy định chuyển dữ liệu ra nước ngoài",
      applicable_contexts: ["international_processing", "cloud_services"],
      vietnamese_specific: true,
      severity_factors: [
        "destination_country",
        "data_sensitivity",
        "transfer_volume",
      ],
      regulatory_impact: [
        "vietnam_cybersecurity_law",
        "data_protection_decree",
      ],
    });

    // International privacy risks
    this.riskRegistry.set("gdpr_non_compliance", {
      id: "gdpr_non_compliance",
      category: "regulatory_compliance",
      title: "GDPR Non-compliance",
      description: "Risk of violating GDPR requirements",
      applicable_contexts: ["eu_processing", "international_business"],
      vietnamese_specific: false,
      severity_factors: [
        "violation_type",
        "systematic_nature",
        "data_subject_count",
      ],
      regulatory_impact: ["gdpr"],
    });
  }

  // Helper methods for PIA assessment
  private async assessPIARequirement(
    request: PIARequest,
  ): Promise<PIARequirementAssessment> {
    const vietnameseRequirement =
      await this.assessVietnamesePIARequirement(request);
    const gdprRequirement = await this.assessGDPRPIARequirement(request);

    return {
      vietnamese_mandatory: vietnameseRequirement.mandatory,
      gdpr_mandatory: gdprRequirement.mandatory,
      overall_mandatory:
        vietnameseRequirement.mandatory || gdprRequirement.mandatory,
      rationale: [
        ...vietnameseRequirement.rationale,
        ...gdprRequirement.rationale,
      ],
      applicable_frameworks: [
        ...(vietnameseRequirement.mandatory
          ? ["vietnam_cybersecurity_law"]
          : []),
        ...(gdprRequirement.mandatory ? ["gdpr"] : []),
      ],
    };
  }

  private async assessVietnamesePIARequirement(
    request: PIARequest,
  ): Promise<RequirementAssessment> {
    const factors = {
      healthcare_data: request.dataTypes.includes(DataType.HEALTH_DATA),
      large_scale: request.estimatedDataSubjects > 10000,
      sensitive_processing: request.dataTypes.some((type) =>
        [
          DataType.HEALTH_DATA,
          DataType.BIOMETRIC_DATA,
          DataType.FINANCIAL_DATA,
        ].includes(type),
      ),
      cross_border_transfer: request.internationalTransfers,
      automated_decision_making: request.automatedDecisionMaking,
    };

    const mandatory =
      factors.healthcare_data ||
      factors.large_scale ||
      factors.sensitive_processing;

    return {
      mandatory,
      rationale: [
        ...(factors.healthcare_data
          ? ["Processing healthcare data requires PIA under Vietnamese law"]
          : []),
        ...(factors.large_scale ? ["Large-scale processing requires PIA"] : []),
        ...(factors.sensitive_processing
          ? ["Sensitive data processing requires enhanced protection"]
          : []),
      ],
    };
  }

  private async assessGDPRPIARequirement(
    request: PIARequest,
  ): Promise<RequirementAssessment> {
    const factors = {
      systematic_monitoring: request.systematicMonitoring,
      large_scale_special_categories:
        request.largeScaleProcessing &&
        request.dataTypes.some((type) =>
          [DataType.HEALTH_DATA, DataType.BIOMETRIC_DATA].includes(type),
        ),
      automated_decision_making: request.automatedDecisionMaking,
      new_technology: request.newTechnologies,
    };

    const mandatory = Object.values(factors).some((factor) => factor);

    return {
      mandatory,
      rationale: [
        ...(factors.systematic_monitoring
          ? ["Systematic monitoring requires DPIA under GDPR Article 35"]
          : []),
        ...(factors.large_scale_special_categories
          ? ["Large-scale processing of special categories requires DPIA"]
          : []),
        ...(factors.automated_decision_making
          ? ["Automated decision-making requires DPIA"]
          : []),
        ...(factors.new_technology
          ? ["Use of new technologies requires DPIA"]
          : []),
      ],
    };
  }

  private generatePIAId(): string {
    return `pia_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
      createdBy: "pia-service",
      updatedBy: "pia-service",
      tags: ["pia", "privacy_impact_assessment"],
      classification: DataClassification.CONFIDENTIAL,
    };
  }

  // Placeholder implementations for complex assessment methods
  private async conductInitialRiskAssessment(
    pia: PrivacyImpactAssessment,
    request: PIARequest,
  ): Promise<PrivacyRisk[]> {
    return []; // Placeholder
  }

  private calculateOverallRiskLevel(risks: PrivacyRisk[]): RiskLevel {
    return RiskLevel.MEDIUM; // Placeholder
  }

  private async generateInitialMitigations(
    risks: PrivacyRisk[],
  ): Promise<RiskMitigation[]> {
    return []; // Placeholder
  }

  private mapScoreToRiskLevel(score: number): RiskLevel {
    if (score >= 80) return RiskLevel.VERY_HIGH;
    if (score >= 60) return RiskLevel.HIGH;
    if (score >= 40) return RiskLevel.MEDIUM;
    if (score >= 20) return RiskLevel.LOW;
    return RiskLevel.VERY_LOW;
  }

  private calculateNextReviewDate(frequency: string): Date {
    const now = new Date();
    switch (frequency) {
      case "quarterly":
        return new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      case "annually":
        return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      case "biannually":
        return new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    }
  }

  // Additional placeholder implementations would go here...
  // For brevity, I'm including just the key structure and main methods
}

// Supporting interfaces for Vietnamese and international PIA requirements
export interface PIAConfig {
  vietnamese_requirements_enabled: boolean;
  gdpr_requirements_enabled: boolean;
  default_review_frequency: string;
  mandatory_stakeholders: string[];
  templates: string[];
}

export interface PIARequest {
  projectName: string;
  description: string;
  dataController: string;
  dataProcessor?: string;
  reviewer: string;
  dataTypes: DataType[];
  dataSubjects: string[];
  processingPurposes: DataProcessingPurpose[];
  estimatedDataSubjects: number;
  internationalTransfers: boolean;
  automatedDecisionMaking: boolean;
  systematicMonitoring: boolean;
  largeScaleProcessing: boolean;
  newTechnologies: boolean;
}

export interface PIATemplate {
  id: string;
  name: string;
  description: string;
  applicable_frameworks: string[];
  sections: PIASection[];
  risk_categories: string[];
}

export interface PIASection {
  id: string;
  title: string;
  required_fields: string[];
  vietnamese_specific: boolean;
}

export interface PrivacyRiskDefinition {
  id: string;
  category: string;
  title: string;
  description: string;
  applicable_contexts: string[];
  vietnamese_specific: boolean;
  severity_factors: string[];
  regulatory_impact: string[];
}

export interface Stakeholder {
  id: string;
  name: string;
  role: string;
  organization: string;
  contact_information: ContactInformation;
  consultation_preferences: ConsultationPreferences;
}

export interface ContactInformation {
  email: string;
  phone?: string;
  address?: string;
}

export interface ConsultationPreferences {
  preferred_methods: string[];
  availability: string;
  language: "vietnamese" | "english";
}

export interface VietnameseVNSpecificRequirements {
  cybersecurity_law_compliance: boolean;
  data_localization_requirements: boolean;
  cross_border_transfer_approval: boolean;
  government_agency_notification: boolean;
  vietnamese_dpo_requirements: boolean;
  healthcare_specific_requirements: boolean;
  ministry_of_health_guidelines: boolean;
  vietnam_social_security_requirements: boolean;
}

export interface GDPRSpecificRequirements {
  article_35_threshold: boolean;
  systematic_monitoring: boolean;
  large_scale_processing: boolean;
  special_category_data: boolean;
  automated_decision_making: boolean;
  data_subject_rights_impact: boolean;
  supervisory_authority_consultation: boolean;
}

export interface PIARequirementAssessment {
  vietnamese_mandatory: boolean;
  gdpr_mandatory: boolean;
  overall_mandatory: boolean;
  rationale: string[];
  applicable_frameworks: string[];
}

export interface RequirementAssessment {
  mandatory: boolean;
  rationale: string[];
}

// Result interfaces
export interface PrivacyRiskAssessmentResult {
  pia_id: string;
  assessment_date: Date;
  risk_methodology: string;
  identified_risks: PrivacyRisk[];
  risk_matrix: RiskMatrix;
  high_priority_risks: PrivacyRisk[];
  systemic_risks: SystemicRisk[];
  data_subject_impact: DataSubjectImpactAssessment;
  organizational_impact: OrganizationalImpactAssessment;
  compliance_risks: ComplianceRisk[];
  technical_risks: TechnicalRisk[];
  operational_risks: OperationalRisk[];
  reputational_risks: ReputationalRisk[];
  overall_risk_score: number;
  recommendations: string[];
}

export interface RiskMatrix {
  likelihood_scale: string[];
  impact_scale: string[];
  risk_levels: RiskLevel[][];
}

export interface SystemicRisk {
  id: string;
  description: string;
  scope: string;
  potential_cascade_effects: string[];
}

export interface DataSubjectImpactAssessment {
  affected_groups: string[];
  potential_harms: string[];
  severity_assessment: RiskLevel;
  mitigation_effectiveness: number;
}

export interface OrganizationalImpactAssessment {
  operational_impact: RiskLevel;
  financial_impact: RiskLevel;
  reputational_impact: RiskLevel;
  regulatory_impact: RiskLevel;
}

export interface ComplianceRisk {
  id: string;
  regulation: string;
  violation_type: string;
  potential_penalties: string[];
  likelihood: RiskLevel;
  impact: RiskLevel;
}

export interface TechnicalRisk {
  id: string;
  system_component: string;
  vulnerability: string;
  exploit_likelihood: RiskLevel;
  data_exposure_risk: RiskLevel;
}

export interface OperationalRisk {
  id: string;
  process: string;
  failure_mode: string;
  business_impact: RiskLevel;
  recovery_time: number;
}

export interface ReputationalRisk {
  id: string;
  scenario: string;
  stakeholder_groups: string[];
  reputation_impact: RiskLevel;
  recovery_difficulty: RiskLevel;
}

export interface StakeholderConsultationRequest {
  stakeholders: string[];
  methods: string[];
  timeline: number;
  consultation_materials: string[];
}

export interface StakeholderConsultationResult {
  pia_id: string;
  consultation_date: Date;
  stakeholders_consulted: string[];
  consultation_methods: string[];
  feedback_summary: FeedbackSummary;
  concerns_raised: Concern[];
  suggestions_received: Suggestion[];
  consensus_areas: string[];
  disagreement_areas: string[];
  follow_up_actions: string[];
  consultation_effectiveness: number;
  documentation: ConsultationDocumentation;
}

export interface FeedbackSummary {
  total_responses: number;
  response_rate: number;
  key_themes: string[];
  sentiment_analysis: SentimentAnalysis;
}

export interface SentimentAnalysis {
  positive: number;
  neutral: number;
  negative: number;
  concerns_level: RiskLevel;
}

export interface Concern {
  id: string;
  stakeholder: string;
  category: string;
  description: string;
  severity: RiskLevel;
  suggested_mitigation: string;
}

export interface Suggestion {
  id: string;
  stakeholder: string;
  category: string;
  description: string;
  feasibility: "high" | "medium" | "low";
  implementation_effort: "low" | "medium" | "high";
}

export interface ConsultationDocumentation {
  meeting_minutes: string[];
  survey_results: string[];
  feedback_analysis: string;
  decision_rationale: string;
}

export interface DataFlowMappingResult {
  pia_id: string;
  mapping_date: Date;
  data_sources: DataSource[];
  data_collection_points: DataCollectionPoint[];
  processing_activities: ProcessingActivity[];
  data_sharing: DataSharingActivity[];
  international_transfers: InternationalTransfer[];
  data_storage: DataStorageLocation[];
  data_retention: DataRetentionInfo[];
  data_disposal: DataDisposalMethod[];
  access_controls: AccessControl[];
  data_lifecycle: DataLifecycleStage[];
  integration_points: IntegrationPoint[];
  security_controls: SecurityControl[];
}

export interface DataSource {
  id: string;
  name: string;
  type: string;
  data_types: DataType[];
  collection_method: string;
  legal_basis: string;
}

export interface DataCollectionPoint {
  id: string;
  location: string;
  method: string;
  frequency: string;
  data_types: DataType[];
  consent_mechanism: string;
}

export interface ProcessingActivity {
  id: string;
  name: string;
  purpose: DataProcessingPurpose;
  data_types: DataType[];
  processing_methods: string[];
  automated: boolean;
}

export interface DataSharingActivity {
  id: string;
  recipient: string;
  purpose: string;
  data_types: DataType[];
  sharing_method: string;
  frequency: string;
  safeguards: string[];
}

export interface InternationalTransfer {
  id: string;
  destination_country: string;
  adequacy_decision: boolean;
  transfer_mechanism: string;
  data_types: DataType[];
  safeguards: string[];
}

export interface DataStorageLocation {
  id: string;
  location: string;
  storage_type: string;
  data_types: DataType[];
  encryption: boolean;
  access_controls: string[];
}

export interface DataRetentionInfo {
  id: string;
  data_type: DataType;
  retention_period: number;
  retention_basis: string;
  disposal_method: string;
}

export interface DataDisposalMethod {
  id: string;
  method: string;
  data_types: DataType[];
  verification_process: string;
  documentation_required: boolean;
}

export interface AccessControl {
  id: string;
  system: string;
  access_level: string;
  user_groups: string[];
  authentication_method: string;
  authorization_method: string;
}

export interface DataLifecycleStage {
  id: string;
  stage: string;
  duration: number;
  activities: string[];
  controls: string[];
}

export interface IntegrationPoint {
  id: string;
  system1: string;
  system2: string;
  data_flow_direction: string;
  data_types: DataType[];
  security_measures: string[];
}

export interface SecurityControl {
  id: string;
  type: string;
  description: string;
  implementation_level: string;
  effectiveness_rating: number;
}

export interface MitigationPlanRequest {
  planName: string;
  description: string;
  targetRisks: string[];
  timeline: number;
  budget: number;
  stakeholders: string[];
}

export interface MitigationPlan {
  id: string;
  pia_id: string;
  plan_name: string;
  description: string;
  created_date: Date;
  target_risks: string[];
  mitigation_strategies: MitigationStrategy[];
  implementation_timeline: ImplementationTimeline;
  resource_requirements: ResourceRequirements;
  success_metrics: SuccessMetric[];
  monitoring_plan: MonitoringPlan;
  contingency_plans: ContingencyPlan[];
  stakeholder_responsibilities: StakeholderResponsibility[];
  budget_estimate: number;
  approval_workflow: ApprovalWorkflow;
  status: string;
}

export interface MitigationStrategy {
  id: string;
  risk_id: string;
  strategy_type: string;
  description: string;
  implementation_steps: string[];
  success_criteria: string[];
  timeline: number;
  responsible_party: string;
}

export interface ImplementationTimeline {
  phases: TimelinePhase[];
  total_duration: number;
  critical_path: string[];
  dependencies: Dependency[];
}

export interface TimelinePhase {
  id: string;
  name: string;
  start_date: Date;
  end_date: Date;
  deliverables: string[];
  dependencies: string[];
}

export interface Dependency {
  id: string;
  prerequisite: string;
  dependent: string;
  dependency_type: string;
}

export interface ResourceRequirements {
  personnel: PersonnelRequirement[];
  budget: number;
  technology: TechnologyRequirement[];
  external_services: ExternalServiceRequirement[];
}

export interface PersonnelRequirement {
  role: string;
  skill_level: string;
  time_commitment: number;
  duration: number;
}

export interface TechnologyRequirement {
  technology: string;
  purpose: string;
  cost: number;
  implementation_timeline: number;
}

export interface ExternalServiceRequirement {
  service: string;
  provider: string;
  cost: number;
  duration: number;
}

export interface SuccessMetric {
  id: string;
  metric_name: string;
  measurement_method: string;
  target_value: string;
  frequency: string;
}

export interface MonitoringPlan {
  monitoring_frequency: string;
  key_indicators: string[];
  reporting_schedule: string;
  escalation_procedures: string[];
}

export interface ContingencyPlan {
  id: string;
  scenario: string;
  trigger_conditions: string[];
  response_actions: string[];
  responsible_party: string;
}

export interface StakeholderResponsibility {
  stakeholder: string;
  responsibilities: string[];
  accountability_measures: string[];
  reporting_requirements: string[];
}

export interface ApprovalWorkflow {
  steps: ApprovalStep[];
  total_timeline: number;
  escalation_procedures: string[];
}

export interface ApprovalStep {
  step_name: string;
  approver: string;
  criteria: string[];
  timeline: number;
}

export interface PIASubmissionRequest {
  submittedBy: string;
  submission_notes: string;
  supporting_documents: string[];
  urgency: "normal" | "urgent";
}

export interface PIAApprovalResult {
  pia_id: string;
  submission_date: Date;
  submitted_by: string;
  dpo_review: ReviewResult;
  legal_review: ReviewResult;
  technical_review: ReviewResult;
  overall_recommendation: string;
  approval_status: string;
  conditions: string[];
  next_steps: string[];
  estimated_approval_date: Date;
}

export interface ReviewResult {
  reviewer: string;
  review_date: Date;
  recommendation:
    | "approve"
    | "approve_with_conditions"
    | "reject"
    | "request_changes";
  comments: string;
  conditions: string[];
  risk_assessment: RiskLevel;
}

export interface PIAReviewSchedule {
  frequency: "quarterly" | "annually" | "biannually";
  stakeholders: string[];
  scope: string[];
}

export interface PIAReviewScheduleResult {
  pia_id: string;
  schedule_created: Date;
  review_frequency: string;
  next_review_date: Date;
  review_triggers: ReviewTrigger[];
  monitoring_indicators: string[];
  automated_checks: AutomatedCheck[];
  notification_schedule: NotificationSchedule;
  escalation_procedures: EscalationProcedure[];
  review_responsibilities: ReviewResponsibility[];
}

export interface ReviewTrigger {
  trigger_type: string;
  condition: string;
  action: string;
}

export interface AutomatedCheck {
  check_name: string;
  frequency: string;
  criteria: string[];
  alert_threshold: string;
}

export interface NotificationSchedule {
  recipients: string[];
  frequency: string;
  notification_types: string[];
}

export interface EscalationProcedure {
  level: number;
  trigger_condition: string;
  escalation_target: string;
  timeline: number;
}

export interface ReviewResponsibility {
  stakeholder: string;
  responsibilities: string[];
  timeline: number;
}
