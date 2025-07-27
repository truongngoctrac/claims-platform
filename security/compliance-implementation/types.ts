export interface ComplianceMetadata {
  id: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  tags: string[];
  classification: DataClassification;
}

export interface DataSubject {
  id: string;
  email: string;
  userId?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  address?: Address;
  consentStatus: ConsentStatus;
  dataProcessingPurposes: DataProcessingPurpose[];
  lastInteraction: Date;
  metadata: ComplianceMetadata;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  region: DataRegion;
}

export interface ConsentRecord {
  id: string;
  dataSubjectId: string;
  purpose: DataProcessingPurpose;
  status: ConsentStatus;
  consentDate: Date;
  withdrawalDate?: Date;
  expiryDate?: Date;
  granularity: ConsentGranularity;
  legalBasis: LegalBasis;
  consentMethod: ConsentMethod;
  ipAddress?: string;
  userAgent?: string;
  evidence: ConsentEvidence;
  metadata: ComplianceMetadata;
}

export interface ConsentEvidence {
  type:
    | "checkbox"
    | "signature"
    | "verbal"
    | "implicit"
    | "opt-in"
    | "double-opt-in";
  evidence: string;
  witnessId?: string;
  documentId?: string;
  timestamp: Date;
  verificationCode?: string;
}

export interface DataProcessingRecord {
  id: string;
  dataSubjectId: string;
  purpose: DataProcessingPurpose;
  dataTypes: DataType[];
  processingDate: Date;
  retentionPeriod: number;
  legalBasis: LegalBasis;
  recipientCategories: string[];
  thirdCountryTransfers: ThirdCountryTransfer[];
  securityMeasures: SecurityMeasure[];
  metadata: ComplianceMetadata;
}

export interface ThirdCountryTransfer {
  id: string;
  country: string;
  region: DataRegion;
  transferMechanism: TransferMechanism;
  adequacyDecision?: string;
  safeguards: Safeguard[];
  transferDate: Date;
  purpose: string;
  dataTypes: DataType[];
  recipientEntity: string;
  metadata: ComplianceMetadata;
}

export interface AuditTrailEntry {
  id: string;
  timestamp: Date;
  userId: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string;
  dataSubjectId?: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  sessionId: string;
  result: "success" | "failure" | "warning";
  complianceImpact: ComplianceImpact;
  metadata: ComplianceMetadata;
}

export interface ComplianceReport {
  id: string;
  type: ComplianceReportType;
  period: ReportingPeriod;
  generatedAt: Date;
  generatedBy: string;
  data: ComplianceReportData;
  status: ReportStatus;
  regulatoryFramework: RegulatoryFramework;
  scope: ComplianceScope;
  findings: ComplianceFinding[];
  recommendations: ComplianceRecommendation[];
  metadata: ComplianceMetadata;
}

export interface PrivacyImpactAssessment {
  id: string;
  projectName: string;
  description: string;
  dataController: string;
  dataProcessor?: string;
  assessmentDate: Date;
  reviewer: string;
  status: PIAStatus;
  riskLevel: RiskLevel;
  dataTypes: DataType[];
  dataSubjects: string[];
  processingPurposes: DataProcessingPurpose[];
  risks: PrivacyRisk[];
  mitigations: RiskMitigation[];
  monitoring: PIAMonitoring;
  metadata: ComplianceMetadata;
}

export interface LegalHold {
  id: string;
  name: string;
  description: string;
  custodians: string[];
  legalBasis: string;
  startDate: Date;
  endDate?: Date;
  status: LegalHoldStatus;
  preservationScope: PreservationScope;
  retainedData: RetainedData[];
  relatedMatters: string[];
  notifications: LegalHoldNotification[];
  metadata: ComplianceMetadata;
}

export interface ComplianceTraining {
  id: string;
  name: string;
  description: string;
  type: TrainingType;
  targetAudience: string[];
  modules: TrainingModule[];
  assessments: TrainingAssessment[];
  completionRequirements: CompletionRequirement[];
  validityPeriod: number;
  mandatoryForRoles: string[];
  status: TrainingStatus;
  metadata: ComplianceMetadata;
}

// Enums and Types
export enum ConsentStatus {
  GIVEN = "given",
  WITHDRAWN = "withdrawn",
  EXPIRED = "expired",
  PENDING = "pending",
  REJECTED = "rejected",
}

export enum DataProcessingPurpose {
  HEALTHCARE_SERVICES = "healthcare_services",
  CLAIMS_PROCESSING = "claims_processing",
  FRAUD_PREVENTION = "fraud_prevention",
  ANALYTICS = "analytics",
  MARKETING = "marketing",
  CUSTOMER_SUPPORT = "customer_support",
  REGULATORY_COMPLIANCE = "regulatory_compliance",
  RESEARCH = "research",
}

export enum DataClassification {
  PUBLIC = "public",
  INTERNAL = "internal",
  CONFIDENTIAL = "confidential",
  RESTRICTED = "restricted",
  SENSITIVE_PERSONAL = "sensitive_personal",
  SPECIAL_CATEGORY = "special_category",
}

export enum DataType {
  PERSONAL_IDENTIFIERS = "personal_identifiers",
  HEALTH_DATA = "health_data",
  FINANCIAL_DATA = "financial_data",
  BIOMETRIC_DATA = "biometric_data",
  LOCATION_DATA = "location_data",
  BEHAVIORAL_DATA = "behavioral_data",
  COMMUNICATION_DATA = "communication_data",
  TECHNICAL_DATA = "technical_data",
}

export enum LegalBasis {
  CONSENT = "consent",
  CONTRACT = "contract",
  LEGAL_OBLIGATION = "legal_obligation",
  VITAL_INTERESTS = "vital_interests",
  PUBLIC_TASK = "public_task",
  LEGITIMATE_INTERESTS = "legitimate_interests",
}

export enum DataRegion {
  EU = "eu",
  US = "us",
  APAC = "apac",
  CANADA = "canada",
  UK = "uk",
  VIETNAM = "vietnam",
  OTHER = "other",
}

export enum TransferMechanism {
  ADEQUACY_DECISION = "adequacy_decision",
  STANDARD_CONTRACTUAL_CLAUSES = "standard_contractual_clauses",
  BINDING_CORPORATE_RULES = "binding_corporate_rules",
  CERTIFICATION = "certification",
  CODE_OF_CONDUCT = "code_of_conduct",
  DEROGATIONS = "derogations",
}

export enum ConsentGranularity {
  GLOBAL = "global",
  PURPOSE_SPECIFIC = "purpose_specific",
  DATA_TYPE_SPECIFIC = "data_type_specific",
  PROCESSING_SPECIFIC = "processing_specific",
}

export enum ConsentMethod {
  CHECKBOX = "checkbox",
  DIGITAL_SIGNATURE = "digital_signature",
  VERBAL = "verbal",
  WRITTEN = "written",
  OPT_IN = "opt_in",
  DOUBLE_OPT_IN = "double_opt_in",
}

export enum AuditAction {
  CREATE = "create",
  READ = "read",
  UPDATE = "update",
  DELETE = "delete",
  EXPORT = "export",
  ACCESS = "access",
  CONSENT_GIVEN = "consent_given",
  CONSENT_WITHDRAWN = "consent_withdrawn",
  DATA_ERASURE = "data_erasure",
  DATA_PORTABILITY = "data_portability",
}

export enum ComplianceImpact {
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low",
  NONE = "none",
}

export enum ComplianceReportType {
  GDPR_COMPLIANCE = "gdpr_compliance",
  DATA_BREACH = "data_breach",
  CONSENT_ANALYSIS = "consent_analysis",
  DATA_RETENTION = "data_retention",
  CROSS_BORDER_TRANSFER = "cross_border_transfer",
  AUDIT_SUMMARY = "audit_summary",
}

export enum RegulatoryFramework {
  GDPR = "gdpr",
  CCPA = "ccpa",
  HIPAA = "hipaa",
  SOX = "sox",
  PCI_DSS = "pci_dss",
  ISO_27001 = "iso_27001",
  VIETNAM_CYBERSECURITY_LAW = "vietnam_cybersecurity_law",
}

export enum PIAStatus {
  DRAFT = "draft",
  IN_REVIEW = "in_review",
  APPROVED = "approved",
  REJECTED = "rejected",
  REQUIRES_UPDATE = "requires_update",
}

export enum RiskLevel {
  VERY_LOW = "very_low",
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  VERY_HIGH = "very_high",
}

export enum LegalHoldStatus {
  ACTIVE = "active",
  RELEASED = "released",
  EXPIRED = "expired",
  SUSPENDED = "suspended",
}

export enum TrainingType {
  ONBOARDING = "onboarding",
  ANNUAL_REFRESHER = "annual_refresher",
  SPECIALIZED = "specialized",
  INCIDENT_RESPONSE = "incident_response",
}

export enum TrainingStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
  ARCHIVED = "archived",
}

export enum ReportStatus {
  GENERATING = "generating",
  COMPLETED = "completed",
  FAILED = "failed",
  SCHEDULED = "scheduled",
}

// Complex Nested Types
export interface SecurityMeasure {
  type: string;
  description: string;
  implementation: string;
  effectivenessRating: number;
}

export interface Safeguard {
  type: string;
  description: string;
  implementationDate: Date;
  reviewDate: Date;
  status: "active" | "inactive" | "pending";
}

export interface ComplianceReportData {
  summary: Record<string, any>;
  metrics: Record<string, number>;
  trends: Record<string, any[]>;
  violations: ComplianceViolation[];
  recommendations: string[];
}

export interface ComplianceViolation {
  id: string;
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  affectedRecords: number;
  detectedAt: Date;
  resolvedAt?: Date;
  remediation: string;
}

export interface ComplianceScope {
  dataTypes: DataType[];
  regions: DataRegion[];
  businessUnits: string[];
  timeRange: {
    start: Date;
    end: Date;
  };
}

export interface ComplianceFinding {
  id: string;
  category: string;
  severity: RiskLevel;
  description: string;
  evidence: string[];
  impactAssessment: string;
  status: "open" | "in_progress" | "resolved" | "accepted_risk";
}

export interface ComplianceRecommendation {
  id: string;
  priority: "high" | "medium" | "low";
  category: string;
  description: string;
  implementation: string;
  timeline: string;
  assignee?: string;
  estimatedCost?: number;
}

export interface ReportingPeriod {
  type: "daily" | "weekly" | "monthly" | "quarterly" | "annual" | "custom";
  start: Date;
  end: Date;
}

export interface PrivacyRisk {
  id: string;
  category: string;
  description: string;
  likelihood: RiskLevel;
  impact: RiskLevel;
  overallRisk: RiskLevel;
  dataTypesAffected: DataType[];
  individualRights: string[];
}

export interface RiskMitigation {
  id: string;
  riskId: string;
  measure: string;
  description: string;
  implementation: string;
  timeline: string;
  responsible: string;
  status: "planned" | "in_progress" | "implemented" | "verified";
  residualRisk: RiskLevel;
}

export interface PIAMonitoring {
  reviewSchedule: string;
  nextReviewDate: Date;
  keyIndicators: string[];
  monitoringPlan: string;
  escalationProcedure: string;
}

export interface PreservationScope {
  dataTypes: DataType[];
  timeRange: {
    start: Date;
    end?: Date;
  };
  custodians: string[];
  systems: string[];
  exclusions: string[];
}

export interface RetainedData {
  id: string;
  type: string;
  description: string;
  location: string;
  custodian: string;
  preservationDate: Date;
  hash: string;
  size: number;
  metadata: Record<string, any>;
}

export interface LegalHoldNotification {
  id: string;
  recipient: string;
  sentAt: Date;
  acknowledgedAt?: Date;
  method: "email" | "system" | "manual";
  content: string;
  status: "sent" | "delivered" | "acknowledged" | "failed";
}

export interface TrainingModule {
  id: string;
  name: string;
  description: string;
  content: string;
  duration: number;
  prerequisites: string[];
  learningObjectives: string[];
  materials: TrainingMaterial[];
}

export interface TrainingMaterial {
  id: string;
  type: "video" | "document" | "interactive" | "quiz";
  title: string;
  url?: string;
  content?: string;
  duration?: number;
}

export interface TrainingAssessment {
  id: string;
  name: string;
  type: "quiz" | "assignment" | "practical";
  questions: AssessmentQuestion[];
  passingScore: number;
  maxAttempts: number;
  timeLimit?: number;
}

export interface AssessmentQuestion {
  id: string;
  type: "multiple_choice" | "true_false" | "short_answer" | "essay";
  question: string;
  options?: string[];
  correctAnswer: string | string[];
  explanation?: string;
  points: number;
}

export interface CompletionRequirement {
  type: "module" | "assessment" | "time" | "attendance";
  target: string;
  threshold: number;
  description: string;
}

// Service Response Types
export interface ComplianceServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    timestamp: Date;
    requestId: string;
    processingTime: number;
  };
}

export interface DataAnonymizationResult {
  originalRecordCount: number;
  anonymizedRecordCount: number;
  techniques: string[];
  qualityMetrics: Record<string, number>;
  riskAssessment: {
    reidentificationRisk: number;
    utility: number;
    privacy: number;
  };
}

export interface DataErasureResult {
  recordsIdentified: number;
  recordsErased: number;
  systemsAffected: string[];
  completionTime: Date;
  verification: {
    confirmed: boolean;
    checksumBefore: string;
    checksumAfter: string;
  };
}

export interface ConsentValidationResult {
  isValid: boolean;
  consentId: string;
  validationChecks: Record<string, boolean>;
  expiryDate?: Date;
  recommendations: string[];
}

export interface ComplianceHealth {
  overallScore: number;
  components: {
    dataProtection: number;
    consentManagement: number;
    auditTrail: number;
    reporting: number;
    training: number;
  };
  criticalIssues: string[];
  lastAssessment: Date;
  nextAssessment: Date;
}
