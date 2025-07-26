import { EventEmitter } from 'events';

// Base Smart Recommendation Interfaces
export interface SmartRecommendation {
  id: string;
  type: RecommendationType;
  title: string;
  description: string;
  confidence: number;
  priority: Priority;
  category: RecommendationCategory;
  targetUser: string;
  context: RecommendationContext;
  data: any;
  metadata: RecommendationMetadata;
  expiry: Date;
  triggers: RecommendationTrigger[];
}

export interface RecommendationMetadata {
  source: string;
  algorithm: string;
  version: string;
  generatedAt: Date;
  personalizedFor: string;
  A_BTestGroup?: string;
  clickThroughRate?: number;
  conversionRate?: number;
  userFeedback?: UserFeedback[];
}

export interface RecommendationContext {
  userId: string;
  sessionId: string;
  currentPage: string;
  userProfile: UserProfile;
  currentTask: string;
  environmentVariables: Record<string, any>;
  timestamp: Date;
  locale: string;
  device: DeviceInfo;
}

export interface RecommendationTrigger {
  condition: string;
  threshold: number;
  action: string;
  weight: number;
}

export interface UserFeedback {
  feedbackId: string;
  userId: string;
  recommendationId: string;
  rating: number;
  helpful: boolean;
  action: FeedbackAction;
  comments?: string;
  timestamp: Date;
}

export type RecommendationType = 
  | 'document'
  | 'form_autofill'
  | 'process_optimization'
  | 'policy'
  | 'next_action'
  | 'content'
  | 'notification'
  | 'ui_optimization'
  | 'personalization';

export type RecommendationCategory = 
  | 'efficiency'
  | 'compliance'
  | 'user_experience'
  | 'cost_savings'
  | 'risk_reduction'
  | 'personalization'
  | 'automation'
  | 'quality_improvement';

export type Priority = 
  | 'low'
  | 'medium'
  | 'high'
  | 'urgent'
  | 'critical';

export type FeedbackAction = 
  | 'accepted'
  | 'rejected'
  | 'partially_accepted'
  | 'dismissed'
  | 'saved_for_later';

// Document Recommendation Interfaces
export interface DocumentRecommendation extends SmartRecommendation {
  documentType: DocumentType;
  requiredDocuments: RequiredDocument[];
  optionalDocuments: OptionalDocument[];
  uploadGuidelines: UploadGuideline[];
  qualityRequirements: QualityRequirement[];
  similarCases: SimilarCase[];
}

export interface RequiredDocument {
  type: DocumentType;
  name: string;
  description: string;
  format: DocumentFormat[];
  sizeLimit: number;
  quality: QualityStandard;
  urgency: DocumentUrgency;
  alternatives: string[];
}

export interface OptionalDocument {
  type: DocumentType;
  name: string;
  description: string;
  benefit: string;
  impactOnProcessing: ProcessingImpact;
}

export interface UploadGuideline {
  step: number;
  instruction: string;
  tips: string[];
  commonMistakes: string[];
  exampleImages?: string[];
}

export interface QualityRequirement {
  aspect: QualityAspect;
  minimum: number;
  recommended: number;
  description: string;
  checkMethod: string;
}

export interface SimilarCase {
  caseId: string;
  similarity: number;
  documentsUsed: DocumentType[];
  outcome: CaseOutcome;
  processingTime: number;
  lessons: string[];
}

export type DocumentType = 
  | 'medical_report'
  | 'prescription'
  | 'invoice'
  | 'receipt'
  | 'discharge_summary'
  | 'lab_result'
  | 'diagnostic_image'
  | 'referral_letter'
  | 'insurance_card'
  | 'identification'
  | 'consent_form'
  | 'medical_history';

export type DocumentFormat = 
  | 'pdf'
  | 'jpg'
  | 'png'
  | 'tiff'
  | 'doc'
  | 'docx';

export type QualityStandard = 
  | 'basic'
  | 'standard'
  | 'high'
  | 'premium';

export type DocumentUrgency = 
  | 'immediate'
  | 'urgent'
  | 'normal'
  | 'optional';

export type ProcessingImpact = 
  | 'faster_processing'
  | 'higher_approval_chance'
  | 'reduced_queries'
  | 'better_audit_trail';

export type QualityAspect = 
  | 'resolution'
  | 'clarity'
  | 'completeness'
  | 'authenticity'
  | 'readability';

export type CaseOutcome = 
  | 'approved'
  | 'rejected'
  | 'pending'
  | 'requires_additional_info';

// Form Auto-fill Interfaces
export interface FormAutoFillRecommendation extends SmartRecommendation {
  formId: string;
  suggestions: FieldSuggestion[];
  prefilledData: PrefilledData;
  validationRules: ValidationRule[];
  completionEstimate: CompletionEstimate;
  smartDefaults: SmartDefault[];
}

export interface FieldSuggestion {
  fieldId: string;
  fieldName: string;
  suggestedValue: any;
  confidence: number;
  source: DataSource;
  alternatives: AlternativeValue[];
  validation: FieldValidation;
  explanation: string;
}

export interface PrefilledData {
  userId: string;
  source: DataSource;
  data: Record<string, any>;
  lastUpdated: Date;
  accuracy: number;
  scope: DataScope;
}

export interface ValidationRule {
  fieldId: string;
  rule: string;
  errorMessage: string;
  severity: ValidationSeverity;
  dependencies: string[];
}

export interface CompletionEstimate {
  timeToComplete: number;
  complexity: FormComplexity;
  stepsRemaining: number;
  progressPercentage: number;
  blockers: FormBlocker[];
}

export interface SmartDefault {
  fieldId: string;
  defaultValue: any;
  reason: string;
  learningSource: LearningSource;
  adaptability: number;
}

export interface AlternativeValue {
  value: any;
  confidence: number;
  reason: string;
  frequency: number;
}

export interface FieldValidation {
  isValid: boolean;
  errorMessages: string[];
  warnings: string[];
  suggestions: string[];
}

export type DataSource = 
  | 'user_profile'
  | 'previous_forms'
  | 'external_database'
  | 'government_registry'
  | 'insurance_records'
  | 'medical_history'
  | 'smart_prediction';

export type DataScope = 
  | 'personal'
  | 'medical'
  | 'financial'
  | 'contact'
  | 'insurance'
  | 'emergency';

export type ValidationSeverity = 
  | 'error'
  | 'warning'
  | 'info'
  | 'suggestion';

export type FormComplexity = 
  | 'simple'
  | 'moderate'
  | 'complex'
  | 'advanced';

export interface FormBlocker {
  field: string;
  issue: string;
  severity: BlockerSeverity;
  solution: string;
  estimatedTime: number;
}

export type BlockerSeverity = 
  | 'minor'
  | 'moderate'
  | 'major'
  | 'critical';

export type LearningSource = 
  | 'user_behavior'
  | 'similar_users'
  | 'historical_data'
  | 'external_api'
  | 'machine_learning';

// Process Optimization Interfaces
export interface ProcessOptimizationRecommendation extends SmartRecommendation {
  processId: string;
  currentProcess: ProcessStep[];
  optimizedProcess: ProcessStep[];
  improvements: ProcessImprovement[];
  metrics: OptimizationMetrics;
  implementation: ImplementationPlan;
  risks: OptimizationRisk[];
}

export interface ProcessStep {
  stepId: string;
  name: string;
  description: string;
  duration: number;
  effort: EffortLevel;
  automation: AutomationLevel;
  dependencies: string[];
  resources: ResourceRequirement[];
  qualityGates: QualityGate[];
}

export interface ProcessImprovement {
  type: ImprovementType;
  description: string;
  impact: ImpactAssessment;
  effort: EffortLevel;
  timeline: string;
  prerequisites: string[];
  successMetrics: SuccessMetric[];
}

export interface OptimizationMetrics {
  timeReduction: number;
  costSavings: number;
  qualityImprovement: number;
  userSatisfaction: number;
  errorReduction: number;
  automationIncrease: number;
}

export interface ImplementationPlan {
  phases: ImplementationPhase[];
  timeline: string;
  resources: ResourceAllocation[];
  milestones: Milestone[];
  rollbackPlan: RollbackStrategy;
}

export interface OptimizationRisk {
  risk: string;
  probability: number;
  impact: RiskImpact;
  mitigation: string;
  contingency: string;
}

export type ImprovementType = 
  | 'automation'
  | 'elimination'
  | 'simplification'
  | 'parallelization'
  | 'integration'
  | 'digitization';

export interface ImpactAssessment {
  efficiency: number;
  quality: number;
  cost: number;
  satisfaction: number;
  compliance: number;
}

export type EffortLevel = 
  | 'minimal'
  | 'low'
  | 'moderate'
  | 'high'
  | 'extensive';

export type AutomationLevel = 
  | 'manual'
  | 'semi_automated'
  | 'automated'
  | 'fully_automated';

export interface ResourceRequirement {
  type: ResourceType;
  quantity: number;
  duration: string;
  skillLevel: SkillLevel;
  cost: number;
}

export interface QualityGate {
  name: string;
  criteria: string[];
  threshold: number;
  automated: boolean;
}

export interface SuccessMetric {
  metric: string;
  baseline: number;
  target: number;
  measurement: string;
  frequency: MeasurementFrequency;
}

export interface ImplementationPhase {
  phase: string;
  duration: string;
  activities: Activity[];
  deliverables: string[];
  dependencies: string[];
}

export interface ResourceAllocation {
  resource: string;
  allocation: number;
  period: string;
  cost: number;
}

export interface Milestone {
  name: string;
  date: Date;
  criteria: string[];
  dependencies: string[];
}

export interface RollbackStrategy {
  triggers: string[];
  steps: string[];
  timeline: string;
  impact: string;
}

export type ResourceType = 
  | 'human'
  | 'technology'
  | 'financial'
  | 'infrastructure'
  | 'training';

export type SkillLevel = 
  | 'basic'
  | 'intermediate'
  | 'advanced'
  | 'expert';

export type MeasurementFrequency = 
  | 'real_time'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly';

export type RiskImpact = 
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

export interface Activity {
  name: string;
  duration: string;
  resources: string[];
  dependencies: string[];
}

// Policy Recommendation Interfaces
export interface PolicyRecommendation extends SmartRecommendation {
  policyType: PolicyType;
  currentPolicy: PolicyDetails;
  recommendedPolicy: PolicyDetails;
  comparison: PolicyComparison;
  benefits: PolicyBenefit[];
  eligibility: EligibilityAssessment;
  premiumAnalysis: PremiumAnalysis;
}

export interface PolicyDetails {
  policyId: string;
  name: string;
  type: PolicyType;
  coverage: CoverageDetails;
  premiums: PremiumStructure;
  benefits: Benefit[];
  exclusions: string[];
  terms: PolicyTerms;
}

export interface PolicyComparison {
  coverageIncrease: number;
  premiumDifference: number;
  benefitImprovements: string[];
  tradoffs: string[];
  riskReduction: number;
  suitabilityScore: number;
}

export interface PolicyBenefit {
  benefit: string;
  value: number;
  probability: number;
  timeframe: string;
  conditions: string[];
}

export interface EligibilityAssessment {
  eligible: boolean;
  requirements: EligibilityRequirement[];
  missingRequirements: string[];
  improvementSuggestions: string[];
  timeline: string;
}

export interface PremiumAnalysis {
  currentPremium: number;
  recommendedPremium: number;
  factors: PremiumFactor[];
  discounts: DiscountOpportunity[];
  paymentOptions: PaymentOption[];
}

export type PolicyType = 
  | 'basic_health'
  | 'comprehensive_health'
  | 'family_health'
  | 'senior_health'
  | 'critical_illness'
  | 'dental'
  | 'vision'
  | 'maternity'
  | 'accident'
  | 'disability';

export interface CoverageDetails {
  inpatient: CoverageLevel;
  outpatient: CoverageLevel;
  emergency: CoverageLevel;
  specialist: CoverageLevel;
  pharmacy: CoverageLevel;
  preventive: CoverageLevel;
  dental: CoverageLevel;
  vision: CoverageLevel;
}

export interface CoverageLevel {
  covered: boolean;
  percentage: number;
  limit: number;
  deductible: number;
  copay: number;
  coinsurance: number;
}

export interface PremiumStructure {
  monthly: number;
  quarterly: number;
  semiAnnual: number;
  annual: number;
  discounts: PremiumDiscount[];
}

export interface Benefit {
  name: string;
  amount: number;
  frequency: BenefitFrequency;
  conditions: string[];
  limitations: string[];
}

export interface PolicyTerms {
  duration: string;
  renewalPolicy: string;
  cancellationPolicy: string;
  graceperiod: number;
  waitingPeriod: number;
}

export interface EligibilityRequirement {
  requirement: string;
  mandatory: boolean;
  description: string;
  documentation: string[];
  verificationMethod: string;
}

export interface PremiumFactor {
  factor: string;
  impact: number;
  controllable: boolean;
  improvementTips: string[];
}

export interface DiscountOpportunity {
  discount: string;
  amount: number;
  requirements: string[];
  validity: string;
  action: string;
}

export interface PaymentOption {
  method: string;
  frequency: PaymentFrequency;
  discount: number;
  convenience: ConvenienceRating;
  autoPayAvailable: boolean;
}

export interface PremiumDiscount {
  type: string;
  percentage: number;
  conditions: string[];
  duration: string;
}

export type BenefitFrequency = 
  | 'per_incident'
  | 'annual'
  | 'lifetime'
  | 'per_condition';

export type PaymentFrequency = 
  | 'monthly'
  | 'quarterly'
  | 'semi_annual'
  | 'annual';

export type ConvenienceRating = 
  | 'low'
  | 'medium'
  | 'high'
  | 'excellent';

// Next Best Action Interfaces
export interface NextBestActionRecommendation extends SmartRecommendation {
  actions: ActionOption[];
  reasoning: ActionReasoning;
  urgency: ActionUrgency;
  resources: ActionResource[];
  expectedOutcome: ExpectedOutcome;
  alternatives: AlternativeAction[];
}

export interface ActionOption {
  actionId: string;
  name: string;
  description: string;
  type: ActionType;
  steps: ActionStep[];
  timeRequired: number;
  effort: EffortLevel;
  impact: ActionImpact;
  prerequisites: string[];
  success: SuccessProbability;
}

export interface ActionReasoning {
  primaryGoal: string;
  decisionFactors: DecisionFactor[];
  dataPoints: DataPoint[];
  riskAssessment: ActionRisk;
  opportunityCost: number;
  confidence: number;
}

export interface ActionUrgency {
  level: UrgencyLevel;
  deadline?: Date;
  consequences: string[];
  escalationTriggers: string[];
}

export interface ActionResource {
  type: ResourceType;
  amount: number;
  availability: Availability;
  cost: number;
  alternatives: string[];
}

export interface ExpectedOutcome {
  primaryBenefit: string;
  quantifiedBenefits: QuantifiedBenefit[];
  risks: OutcomeRisk[];
  timeline: OutcomeTimeline;
  successIndicators: SuccessIndicator[];
}

export interface AlternativeAction {
  action: string;
  reason: string;
  trade_offs: string[];
  suitability: number;
  complexity: ActionComplexity;
}

export type ActionType = 
  | 'immediate'
  | 'scheduled'
  | 'conditional'
  | 'preventive'
  | 'corrective'
  | 'optimization';

export interface ActionStep {
  step: number;
  description: string;
  duration: number;
  dependencies: string[];
  validation: string;
  rollback?: string;
}

export interface ActionImpact {
  business: number;
  user: number;
  operational: number;
  financial: number;
  strategic: number;
}

export interface SuccessProbability {
  probability: number;
  factors: SuccessFactor[];
  historical: HistoricalSuccess;
  confidence: number;
}

export interface DecisionFactor {
  factor: string;
  weight: number;
  value: number;
  source: string;
  confidence: number;
}

export interface DataPoint {
  metric: string;
  value: any;
  source: string;
  timestamp: Date;
  relevance: number;
}

export interface ActionRisk {
  risks: Risk[];
  overallRisk: number;
  mitigation: string[];
  monitoring: string[];
}

export type UrgencyLevel = 
  | 'low'
  | 'medium'
  | 'high'
  | 'critical'
  | 'emergency';

export interface Availability {
  immediate: boolean;
  timeline: string;
  constraints: string[];
  alternatives: string[];
}

export interface QuantifiedBenefit {
  benefit: string;
  value: number;
  unit: string;
  timeframe: string;
  confidence: number;
}

export interface OutcomeRisk {
  risk: string;
  probability: number;
  impact: number;
  mitigation: string;
}

export interface OutcomeTimeline {
  immediate: string[];
  shortTerm: string[];
  mediumTerm: string[];
  longTerm: string[];
}

export interface SuccessIndicator {
  indicator: string;
  target: number;
  measurement: string;
  frequency: string;
}

export type ActionComplexity = 
  | 'simple'
  | 'moderate'
  | 'complex'
  | 'very_complex';

export interface SuccessFactor {
  factor: string;
  contribution: number;
  controllable: boolean;
  current_status: string;
}

export interface HistoricalSuccess {
  similar_actions: number;
  success_rate: number;
  average_impact: number;
  lessons_learned: string[];
}

export interface Risk {
  description: string;
  probability: number;
  impact: number;
  category: RiskCategory;
  mitigation: string;
}

export type RiskCategory = 
  | 'technical'
  | 'business'
  | 'operational'
  | 'financial'
  | 'regulatory'
  | 'reputational';

// Personalization Engine Interfaces
export interface PersonalizationProfile {
  userId: string;
  preferences: UserPreferences;
  behaviors: UserBehavior;
  segments: UserSegment[];
  adaptations: Adaptation[];
  learningHistory: LearningEvent[];
  lastUpdated: Date;
}

export interface UserPreferences {
  language: string;
  locale: string;
  timezone: string;
  communication: CommunicationPreferences;
  ui: UIPreferences;
  content: ContentPreferences;
  notifications: NotificationPreferences;
  privacy: PrivacyPreferences;
}

export interface UserBehavior {
  sessionPatterns: SessionPattern[];
  clickPatterns: ClickPattern[];
  navigationPaths: NavigationPath[];
  taskCompletionRate: number;
  errorPatterns: ErrorPattern[];
  helpUsage: HelpUsagePattern[];
  searchBehavior: SearchBehavior;
}

export interface UserSegment {
  segmentId: string;
  name: string;
  characteristics: string[];
  confidence: number;
  behaviors: SegmentBehavior[];
  preferences: SegmentPreferences;
}

export interface Adaptation {
  type: AdaptationType;
  change: string;
  reason: string;
  impact: number;
  timestamp: Date;
  effectiveness: number;
}

export interface LearningEvent {
  event: string;
  timestamp: Date;
  context: any;
  outcome: LearningOutcome;
  confidence: number;
}

export interface CommunicationPreferences {
  channels: PreferredChannel[];
  frequency: CommunicationFrequency;
  tone: CommunicationTone;
  format: ContentFormat[];
  timing: PreferredTiming[];
}

export interface UIPreferences {
  theme: UITheme;
  layout: LayoutPreference;
  density: InformationDensity;
  accessibility: AccessibilitySettings;
  shortcuts: KeyboardShortcut[];
  customizations: UICustomization[];
}

export interface ContentPreferences {
  topics: TopicPreference[];
  formats: FormatPreference[];
  complexity: ContentComplexity;
  examples: ExamplePreference;
  multimedia: MultimediaPreference;
}

export interface NotificationPreferences {
  types: NotificationType[];
  channels: NotificationChannel[];
  frequency: NotificationFrequency;
  urgency: UrgencyPreference[];
  quiet_hours: QuietHours;
  grouping: NotificationGrouping;
}

export interface PrivacyPreferences {
  dataSharing: DataSharingLevel;
  analytics: AnalyticsConsent;
  personalization: PersonalizationConsent;
  marketing: MarketingConsent;
  retention: DataRetentionPreference;
}

export type AdaptationType = 
  | 'ui_layout'
  | 'content_recommendation'
  | 'workflow_optimization'
  | 'feature_visibility'
  | 'notification_timing'
  | 'help_content';

export interface LearningOutcome {
  successful: boolean;
  metrics: OutcomeMetric[];
  feedback: string;
  improvements: string[];
}

export interface PreferredChannel {
  channel: CommunicationChannel;
  preference: number;
  context: string[];
}

export type CommunicationFrequency = 
  | 'immediate'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'as_needed';

export type CommunicationTone = 
  | 'formal'
  | 'casual'
  | 'friendly'
  | 'professional'
  | 'technical';

export type ContentFormat = 
  | 'text'
  | 'video'
  | 'audio'
  | 'interactive'
  | 'infographic';

export interface PreferredTiming {
  timeOfDay: string;
  dayOfWeek: string[];
  context: string;
  urgency: UrgencyLevel;
}

export type UITheme = 
  | 'light'
  | 'dark'
  | 'auto'
  | 'high_contrast'
  | 'custom';

export type LayoutPreference = 
  | 'compact'
  | 'comfortable'
  | 'spacious'
  | 'custom';

export type InformationDensity = 
  | 'minimal'
  | 'standard'
  | 'detailed'
  | 'comprehensive';

export interface AccessibilitySettings {
  fontSize: FontSize;
  contrastLevel: ContrastLevel;
  screenReader: boolean;
  keyboardNavigation: boolean;
  motionReduction: boolean;
  colorBlindness: ColorBlindnessType;
}

export interface KeyboardShortcut {
  action: string;
  shortcut: string;
  context: string[];
  frequency: number;
}

export interface UICustomization {
  element: string;
  modification: string;
  reason: string;
  effectiveness: number;
}

export interface TopicPreference {
  topic: string;
  interest: number;
  expertise: ExpertiseLevel;
  frequency: number;
}

export interface FormatPreference {
  format: ContentFormat;
  preference: number;
  context: string[];
}

export type ContentComplexity = 
  | 'beginner'
  | 'intermediate'
  | 'advanced'
  | 'expert';

export type ExamplePreference = 
  | 'none'
  | 'minimal'
  | 'comprehensive'
  | 'interactive';

export interface MultimediaPreference {
  images: boolean;
  videos: boolean;
  audio: boolean;
  animations: boolean;
  bandwidth: BandwidthPreference;
}

export type NotificationType = 
  | 'claim_updates'
  | 'system_alerts'
  | 'reminders'
  | 'recommendations'
  | 'promotions'
  | 'educational';

export type NotificationChannel = 
  | 'email'
  | 'sms'
  | 'push'
  | 'in_app'
  | 'desktop';

export type NotificationFrequency = 
  | 'real_time'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'never';

export interface UrgencyPreference {
  urgency: UrgencyLevel;
  channels: NotificationChannel[];
  delay: number;
}

export interface QuietHours {
  enabled: boolean;
  start: string;
  end: string;
  timezone: string;
  exceptions: UrgencyLevel[];
}

export type NotificationGrouping = 
  | 'individual'
  | 'by_type'
  | 'by_priority'
  | 'digest';

export type DataSharingLevel = 
  | 'none'
  | 'minimal'
  | 'standard'
  | 'full';

export interface AnalyticsConsent {
  usage: boolean;
  performance: boolean;
  errors: boolean;
  improvements: boolean;
}

export interface PersonalizationConsent {
  recommendations: boolean;
  content: boolean;
  ui_adaptation: boolean;
  behavior_analysis: boolean;
}

export interface MarketingConsent {
  product_updates: boolean;
  promotions: boolean;
  surveys: boolean;
  third_party: boolean;
}

export interface DataRetentionPreference {
  duration: RetentionDuration;
  deletion_method: DeletionMethod;
  backup_consent: boolean;
}

export interface SessionPattern {
  duration: number;
  pages_visited: number;
  actions_performed: number;
  time_of_day: string;
  day_of_week: string;
  frequency: number;
}

export interface ClickPattern {
  element_type: string;
  location: string;
  frequency: number;
  success_rate: number;
  context: string;
}

export interface NavigationPath {
  path: string[];
  frequency: number;
  completion_rate: number;
  duration: number;
  abandonment_points: string[];
}

export interface ErrorPattern {
  error_type: string;
  frequency: number;
  context: string;
  resolution: string;
  user_reaction: string;
}

export interface HelpUsagePattern {
  help_type: HelpType;
  frequency: number;
  topics: string[];
  effectiveness: number;
  timing: string;
}

export interface SearchBehavior {
  query_patterns: SearchQuery[];
  result_interaction: SearchInteraction[];
  refinement_patterns: SearchRefinement[];
  success_rate: number;
}

export interface SegmentBehavior {
  behavior: string;
  frequency: number;
  impact: number;
  context: string[];
}

export interface SegmentPreferences {
  preferences: string[];
  strength: number;
  stability: number;
  evolution: string;
}

export interface OutcomeMetric {
  metric: string;
  baseline: number;
  actual: number;
  target: number;
  variance: number;
}

export type CommunicationChannel = 
  | 'email'
  | 'sms'
  | 'phone'
  | 'chat'
  | 'notification'
  | 'letter';

export type FontSize = 
  | 'small'
  | 'medium'
  | 'large'
  | 'extra_large';

export type ContrastLevel = 
  | 'normal'
  | 'high'
  | 'very_high'
  | 'maximum';

export type ColorBlindnessType = 
  | 'none'
  | 'protanopia'
  | 'deuteranopia'
  | 'tritanopia'
  | 'monochromacy';

export type ExpertiseLevel = 
  | 'novice'
  | 'beginner'
  | 'intermediate'
  | 'advanced'
  | 'expert';

export type BandwidthPreference = 
  | 'unlimited'
  | 'high'
  | 'medium'
  | 'low'
  | 'data_saver';

export type RetentionDuration = 
  | '1_month'
  | '3_months'
  | '6_months'
  | '1_year'
  | '2_years'
  | 'indefinite';

export type DeletionMethod = 
  | 'soft_delete'
  | 'hard_delete'
  | 'anonymize'
  | 'archive';

export type HelpType = 
  | 'tooltip'
  | 'guide'
  | 'documentation'
  | 'video'
  | 'chat_support'
  | 'faq';

export interface SearchQuery {
  query: string;
  frequency: number;
  intent: SearchIntent;
  success: boolean;
  refinements: number;
}

export interface SearchInteraction {
  result_position: number;
  click_rate: number;
  dwell_time: number;
  bounce_rate: number;
}

export interface SearchRefinement {
  original_query: string;
  refined_query: string;
  improvement: number;
  strategy: RefinementStrategy;
}

export type SearchIntent = 
  | 'informational'
  | 'navigational'
  | 'transactional'
  | 'troubleshooting';

export type RefinementStrategy = 
  | 'narrowing'
  | 'broadening'
  | 'alternative_terms'
  | 'filtering'
  | 'sorting';

// A/B Testing Framework Interfaces
export interface ABTestConfiguration {
  testId: string;
  name: string;
  description: string;
  hypothesis: string;
  variants: TestVariant[];
  targetAudience: AudienceDefinition;
  metrics: TestMetric[];
  duration: TestDuration;
  status: TestStatus;
  trafficAllocation: TrafficAllocation;
}

export interface TestVariant {
  variantId: string;
  name: string;
  description: string;
  changes: VariantChange[];
  allocation: number;
  isControl: boolean;
}

export interface VariantChange {
  component: string;
  property: string;
  value: any;
  type: ChangeType;
}

export interface AudienceDefinition {
  criteria: AudienceCriteria[];
  size: number;
  inclusion: InclusionRule[];
  exclusion: ExclusionRule[];
}

export interface TestMetric {
  metricId: string;
  name: string;
  type: MetricType;
  goal: MetricGoal;
  primary: boolean;
  threshold: number;
}

export interface TestDuration {
  startDate: Date;
  endDate: Date;
  minDuration: number;
  maxDuration: number;
  earlyStopConditions: StopCondition[];
}

export interface TrafficAllocation {
  percentage: number;
  rampUpSchedule: RampUpPhase[];
  geographicLimits: string[];
  deviceLimits: string[];
}

export interface ABTestResult {
  testId: string;
  status: TestStatus;
  participants: ParticipantStats;
  results: VariantResult[];
  significance: StatisticalSignificance;
  recommendation: TestRecommendation;
  insights: TestInsight[];
}

export interface ParticipantStats {
  total: number;
  byVariant: VariantParticipation[];
  demographics: DemographicBreakdown;
  retention: RetentionStats;
}

export interface VariantResult {
  variantId: string;
  participants: number;
  metrics: MetricResult[];
  performance: PerformanceComparison;
  userFeedback: FeedbackSummary;
}

export interface StatisticalSignificance {
  overall: number;
  byMetric: MetricSignificance[];
  confidence: number;
  powerAnalysis: PowerAnalysis;
}

export interface TestRecommendation {
  decision: TestDecision;
  winningVariant?: string;
  confidence: number;
  reasoning: string[];
  nextSteps: string[];
  rolloutPlan?: RolloutPlan;
}

export interface TestInsight {
  insight: string;
  supporting_data: any[];
  significance: number;
  actionable: boolean;
  category: InsightCategory;
}

export type ChangeType = 
  | 'ui_element'
  | 'content'
  | 'workflow'
  | 'feature'
  | 'algorithm'
  | 'layout';

export interface AudienceCriteria {
  dimension: string;
  operator: ComparisonOperator;
  value: any;
  weight: number;
}

export interface InclusionRule {
  condition: string;
  priority: number;
}

export interface ExclusionRule {
  condition: string;
  reason: string;
}

export type MetricType = 
  | 'conversion'
  | 'engagement'
  | 'retention'
  | 'satisfaction'
  | 'performance'
  | 'revenue';

export type MetricGoal = 
  | 'increase'
  | 'decrease'
  | 'maintain'
  | 'optimize';

export interface StopCondition {
  condition: string;
  threshold: number;
  action: StopAction;
}

export interface RampUpPhase {
  phase: number;
  percentage: number;
  duration: string;
  criteria: string[];
}

export type TestStatus = 
  | 'draft'
  | 'scheduled'
  | 'running'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface VariantParticipation {
  variantId: string;
  count: number;
  percentage: number;
  demographic: DemographicProfile;
}

export interface DemographicBreakdown {
  age: AgeDistribution;
  gender: GenderDistribution;
  location: LocationDistribution;
  device: DeviceDistribution;
  experience: ExperienceDistribution;
}

export interface RetentionStats {
  day1: number;
  day7: number;
  day30: number;
  cohortAnalysis: CohortData[];
}

export interface MetricResult {
  metricId: string;
  value: number;
  improvement: number;
  confidence: number;
  trend: TrendDirection;
}

export interface PerformanceComparison {
  relativeTo: string;
  improvement: number;
  significance: number;
  effect_size: number;
}

export interface FeedbackSummary {
  totalResponses: number;
  satisfaction: number;
  sentiment: SentimentAnalysis;
  themes: FeedbackTheme[];
}

export interface MetricSignificance {
  metricId: string;
  pValue: number;
  significant: boolean;
  effect_size: number;
}

export interface PowerAnalysis {
  power: number;
  sample_size: number;
  effect_size: number;
  alpha: number;
}

export type TestDecision = 
  | 'implement_winner'
  | 'continue_testing'
  | 'no_clear_winner'
  | 'abandon_test'
  | 'iterate_design';

export interface RolloutPlan {
  strategy: RolloutStrategy;
  phases: RolloutPhase[];
  monitoring: MonitoringPlan;
  rollback: RollbackPlan;
}

export type InsightCategory = 
  | 'user_behavior'
  | 'performance'
  | 'business_impact'
  | 'technical'
  | 'design'
  | 'content';

export type ComparisonOperator = 
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'contains'
  | 'in_range';

export type StopAction = 
  | 'pause_test'
  | 'end_test'
  | 'alert_only'
  | 'redirect_traffic';

export interface AgeDistribution {
  [ageRange: string]: number;
}

export interface GenderDistribution {
  [gender: string]: number;
}

export interface LocationDistribution {
  [location: string]: number;
}

export interface DeviceDistribution {
  [device: string]: number;
}

export interface ExperienceDistribution {
  [level: string]: number;
}

export interface DemographicProfile {
  age: string;
  gender: string;
  location: string;
  device: string;
  experience: string;
}

export interface CohortData {
  cohort: string;
  retention: number[];
  size: number;
}

export type TrendDirection = 
  | 'increasing'
  | 'decreasing'
  | 'stable'
  | 'volatile';

export interface SentimentAnalysis {
  positive: number;
  neutral: number;
  negative: number;
  overall: number;
}

export interface FeedbackTheme {
  theme: string;
  frequency: number;
  sentiment: number;
  impact: number;
}

export type RolloutStrategy = 
  | 'immediate'
  | 'gradual'
  | 'canary'
  | 'blue_green'
  | 'feature_flag';

export interface RolloutPhase {
  phase: string;
  percentage: number;
  duration: string;
  success_criteria: string[];
}

export interface MonitoringPlan {
  metrics: string[];
  frequency: string;
  alerts: AlertConfiguration[];
  dashboards: string[];
}

export interface RollbackPlan {
  triggers: string[];
  procedure: string[];
  timeline: string;
  notification: string[];
}

export interface AlertConfiguration {
  metric: string;
  threshold: number;
  severity: AlertSeverity;
  recipients: string[];
}

export type AlertSeverity = 
  | 'info'
  | 'warning'
  | 'error'
  | 'critical';

// Common utility interfaces
export interface UserProfile {
  userId: string;
  demographics: DemographicProfile;
  preferences: UserPreferences;
  behavior: UserBehavior;
  history: UserHistory;
  segments: string[];
  riskProfile: UserRiskProfile;
}

export interface UserHistory {
  registrationDate: Date;
  lastLogin: Date;
  totalSessions: number;
  totalClaims: number;
  averageSessionDuration: number;
  preferredDevices: string[];
  locationHistory: LocationHistory[];
}

export interface UserRiskProfile {
  riskScore: number;
  riskFactors: string[];
  trustLevel: TrustLevel;
  verificationStatus: VerificationStatus;
}

export interface LocationHistory {
  location: string;
  frequency: number;
  lastUsed: Date;
}

export type TrustLevel = 
  | 'new'
  | 'low'
  | 'medium'
  | 'high'
  | 'verified';

export interface VerificationStatus {
  identity: boolean;
  email: boolean;
  phone: boolean;
  address: boolean;
  documents: boolean;
}

export interface DeviceInfo {
  type: DeviceType;
  os: string;
  browser: string;
  screen: ScreenInfo;
  capabilities: DeviceCapabilities;
}

export type DeviceType = 
  | 'desktop'
  | 'tablet'
  | 'mobile'
  | 'smart_tv'
  | 'kiosk';

export interface ScreenInfo {
  width: number;
  height: number;
  density: number;
  orientation: ScreenOrientation;
}

export interface DeviceCapabilities {
  touch: boolean;
  camera: boolean;
  gps: boolean;
  offline: boolean;
  push_notifications: boolean;
}

export type ScreenOrientation = 
  | 'portrait'
  | 'landscape';

// Base Smart Component Interface
export interface SmartComponent extends EventEmitter {
  initialize(): Promise<void>;
  recommend(input: any, options?: any): Promise<SmartRecommendation[]>;
  learn(feedback: UserFeedback[], options?: any): Promise<any>;
  getStatus(): ComponentStatus;
  getMetrics(): ComponentPerformance;
  updateProfile(userId: string, updates: any): Promise<void>;
}

export interface ComponentStatus {
  isReady: boolean;
  isLearning: boolean;
  isProcessing: boolean;
  lastError?: string;
  uptime: number;
  totalRecommendations: number;
  lastRecommendation?: Date;
}

export interface ComponentPerformance {
  accuracy: number;
  precision: number;
  recall: number;
  clickThroughRate: number;
  conversionRate: number;
  userSatisfaction: number;
  responseTime: number;
  throughput: number;
}
