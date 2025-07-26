import { EventEmitter } from 'events';

// Base Predictive Analytics Interfaces
export interface PredictiveModel {
  id: string;
  name: string;
  version: string;
  type: ModelType;
  status: ModelStatus;
  accuracy: number;
  lastTrained: Date;
  nextRetraining: Date;
  metadata: ModelMetadata;
  features: ModelFeatures;
  performance: ModelPerformance;
}

export interface ModelMetadata {
  trainingDataSize: number;
  validationAccuracy: number;
  testAccuracy: number;
  modelSize: number;
  parameters: Record<string, any>;
  hyperparameters: Record<string, any>;
  featureImportance: Record<string, number>;
  lastEvaluated: Date;
  deploymentEnvironment: string;
}

export interface ModelFeatures {
  inputFeatures: string[];
  outputTargets: string[];
  featureEngineering: FeatureEngineering[];
  scalingMethods: ScalingMethod[];
}

export interface FeatureEngineering {
  name: string;
  type: 'normalization' | 'encoding' | 'transformation' | 'selection';
  parameters: Record<string, any>;
}

export interface ModelPerformance {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  auc: number;
  rmse?: number;
  mae?: number;
  r2Score?: number;
  trainingTime: number;
  inferenceTime: number;
  memoryUsage: number;
}

export type ModelType = 
  | 'processing_time_prediction'
  | 'claim_approval_scoring'
  | 'risk_assessment'
  | 'customer_behavior'
  | 'demand_forecasting'
  | 'anomaly_detection'
  | 'churn_prediction'
  | 'resource_optimization'
  | 'performance_prediction';

export type ModelStatus = 
  | 'training'
  | 'ready'
  | 'deploying'
  | 'deprecated'
  | 'failed'
  | 'retraining';

export type ScalingMethod = 
  | 'standardization'
  | 'normalization'
  | 'robust_scaling'
  | 'quantile_transformation';

// Processing Time Prediction Interfaces
export interface ProcessingTimePrediction {
  claimId: string;
  predictedDays: number;
  confidence: number;
  factors: ProcessingTimeFactor[];
  riskLevel: RiskLevel;
  bottlenecks: Bottleneck[];
  recommendations: string[];
  estimatedCompletionDate: Date;
}

export interface ProcessingTimeFactor {
  factor: string;
  impact: number;
  description: string;
  weight: number;
}

export interface Bottleneck {
  stage: string;
  expectedDelay: number;
  probability: number;
  mitigation: string;
}

// Claim Approval Probability Interfaces
export interface ClaimApprovalPrediction {
  claimId: string;
  approvalProbability: number;
  riskScore: number;
  confidence: number;
  factors: ApprovalFactor[];
  redFlags: RedFlag[];
  recommendations: ApprovalRecommendation[];
  estimatedAmount: number;
  alternativeActions: AlternativeAction[];
}

export interface ApprovalFactor {
  factor: string;
  impact: number;
  weight: number;
  contribution: number;
  description: string;
}

export interface RedFlag {
  type: RedFlagType;
  severity: Severity;
  description: string;
  impact: number;
  requiredAction: string;
}

export interface ApprovalRecommendation {
  action: string;
  priority: Priority;
  description: string;
  expectedOutcome: string;
  confidence: number;
}

export interface AlternativeAction {
  action: string;
  probability: number;
  impact: string;
  timeline: string;
}

export type RedFlagType = 
  | 'duplicate_claim'
  | 'fraudulent_pattern'
  | 'unusual_amount'
  | 'policy_violation'
  | 'provider_risk'
  | 'timing_anomaly'
  | 'documentation_issue'
  | 'behavioral_anomaly';

// Risk Assessment Interfaces
export interface RiskAssessment {
  entityId: string;
  entityType: EntityType;
  overallRiskScore: number;
  riskLevel: RiskLevel;
  riskFactors: RiskFactor[];
  historicalTrends: HistoricalTrend[];
  mitigation: MitigationStrategy[];
  monitoring: MonitoringRecommendation[];
  lastAssessment: Date;
  nextAssessment: Date;
}

export interface RiskFactor {
  category: RiskCategory;
  factor: string;
  score: number;
  weight: number;
  evidence: Evidence[];
  trend: Trend;
  mitigation: string;
}

export interface Evidence {
  type: string;
  value: any;
  source: string;
  timestamp: Date;
  reliability: number;
}

export interface HistoricalTrend {
  metric: string;
  values: TrendPoint[];
  direction: TrendDirection;
  volatility: number;
  seasonality: SeasonalPattern[];
}

export interface TrendPoint {
  timestamp: Date;
  value: number;
  confidence: number;
}

export interface MitigationStrategy {
  strategy: string;
  priority: Priority;
  timeline: string;
  resources: string[];
  expectedImpact: number;
  cost: number;
}

export interface MonitoringRecommendation {
  metric: string;
  frequency: MonitoringFrequency;
  threshold: number;
  alertLevel: AlertLevel;
  action: string;
}

export type EntityType = 
  | 'customer'
  | 'provider'
  | 'claim'
  | 'policy'
  | 'transaction'
  | 'facility';

export type RiskCategory = 
  | 'financial'
  | 'operational'
  | 'fraud'
  | 'compliance'
  | 'reputational'
  | 'strategic';

export type RiskLevel = 
  | 'very_low'
  | 'low'
  | 'medium'
  | 'high'
  | 'very_high'
  | 'critical';

export type Trend = 
  | 'increasing'
  | 'decreasing'
  | 'stable'
  | 'volatile'
  | 'seasonal';

export type TrendDirection = 
  | 'upward'
  | 'downward'
  | 'sideways'
  | 'cyclical';

export type MonitoringFrequency = 
  | 'real_time'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly';

export type AlertLevel = 
  | 'info'
  | 'warning'
  | 'critical'
  | 'emergency';

// Customer Behavior Analysis Interfaces
export interface CustomerBehaviorAnalysis {
  customerId: string;
  behaviorProfile: BehaviorProfile;
  patterns: BehaviorPattern[];
  preferences: CustomerPreference[];
  predictions: BehaviorPrediction[];
  segments: CustomerSegment[];
  lifecycle: LifecycleStage;
  satisfaction: SatisfactionMetrics;
  recommendations: PersonalizationRecommendation[];
}

export interface BehaviorProfile {
  activityLevel: ActivityLevel;
  digitalEngagement: DigitalEngagement;
  claimFrequency: ClaimFrequency;
  paymentBehavior: PaymentBehavior;
  communicationPreferences: CommunicationPreference[];
  riskTolerance: RiskTolerance;
}

export interface BehaviorPattern {
  pattern: string;
  frequency: number;
  strength: number;
  seasonality: SeasonalPattern[];
  triggers: Trigger[];
  outcomes: PatternOutcome[];
}

export interface CustomerPreference {
  category: PreferenceCategory;
  preference: string;
  strength: number;
  confidence: number;
  source: string;
  lastUpdated: Date;
}

export interface BehaviorPrediction {
  prediction: string;
  probability: number;
  timeframe: string;
  factors: PredictionFactor[];
  confidence: number;
  impact: ImpactAssessment;
}

export interface CustomerSegment {
  segmentId: string;
  segmentName: string;
  characteristics: string[];
  size: number;
  behavior: SegmentBehavior;
  value: SegmentValue;
}

export interface LifecycleStage {
  stage: CustomerStage;
  tenure: number;
  stageEntry: Date;
  expectedDuration: number;
  nextStage: CustomerStage;
  transitionProbability: number;
}

export interface SatisfactionMetrics {
  npsScore: number;
  csat: number;
  ces: number;
  sentiment: SentimentScore;
  feedbackSummary: FeedbackSummary;
  improvementAreas: string[];
}

export interface PersonalizationRecommendation {
  type: PersonalizationType;
  recommendation: string;
  priority: Priority;
  expectedLift: number;
  implementation: string;
  timeline: string;
}

export type ActivityLevel = 
  | 'very_low'
  | 'low'
  | 'moderate'
  | 'high'
  | 'very_high';

export type ClaimFrequency = 
  | 'never'
  | 'rare'
  | 'occasional'
  | 'frequent'
  | 'very_frequent';

export type PaymentBehavior = 
  | 'always_on_time'
  | 'usually_on_time'
  | 'sometimes_late'
  | 'often_late'
  | 'chronic_late';

export type RiskTolerance = 
  | 'very_conservative'
  | 'conservative'
  | 'moderate'
  | 'aggressive'
  | 'very_aggressive';

export type PreferenceCategory = 
  | 'communication'
  | 'product'
  | 'service'
  | 'channel'
  | 'timing'
  | 'content';

export type CustomerStage = 
  | 'prospect'
  | 'new'
  | 'active'
  | 'at_risk'
  | 'dormant'
  | 'churned'
  | 'win_back';

export type PersonalizationType = 
  | 'product'
  | 'service'
  | 'communication'
  | 'pricing'
  | 'experience';

// Demand Forecasting Interfaces
export interface DemandForecast {
  forecastId: string;
  category: ForecastCategory;
  timeHorizon: TimeHorizon;
  predictions: ForecastPrediction[];
  accuracy: ForecastAccuracy;
  factors: DemandFactor[];
  scenarios: ForecastScenario[];
  recommendations: CapacityRecommendation[];
  confidence: ConfidenceBand;
}

export interface ForecastPrediction {
  period: string;
  predictedValue: number;
  upperBound: number;
  lowerBound: number;
  confidence: number;
  components: ForecastComponent[];
}

export interface ForecastAccuracy {
  mape: number;
  mae: number;
  rmse: number;
  r2: number;
  bias: number;
  lastValidation: Date;
}

export interface DemandFactor {
  factor: string;
  impact: number;
  confidence: number;
  trend: Trend;
  elasticity: number;
}

export interface ForecastScenario {
  scenario: string;
  probability: number;
  impact: number;
  description: string;
  adjustments: ScenarioAdjustment[];
}

export interface ScenarioAdjustment {
  factor: string;
  adjustment: number;
  rationale: string;
}

export interface CapacityRecommendation {
  resource: string;
  recommendedCapacity: number;
  currentCapacity: number;
  gap: number;
  priority: Priority;
  timeline: string;
  cost: number;
}

export interface ConfidenceBand {
  confidence90: [number, number];
  confidence95: [number, number];
  confidence99: [number, number];
}

export type ForecastCategory = 
  | 'claims'
  | 'customers'
  | 'revenue'
  | 'costs'
  | 'capacity'
  | 'resources';

export type TimeHorizon = 
  | 'short_term'
  | 'medium_term'
  | 'long_term';

export interface ForecastComponent {
  component: string;
  contribution: number;
  trend: Trend;
}

// Anomaly Detection Interfaces
export interface AnomalyDetection {
  entityId: string;
  entityType: EntityType;
  anomalies: Anomaly[];
  overallScore: number;
  riskLevel: RiskLevel;
  patterns: AnomalyPattern[];
  recommendations: AnomalyRecommendation[];
  monitoring: AnomalyMonitoring;
}

export interface Anomaly {
  anomalyId: string;
  type: AnomalyType;
  severity: Severity;
  confidence: number;
  description: string;
  detectedAt: Date;
  features: AnomalyFeature[];
  impact: ImpactAssessment;
  status: AnomalyStatus;
  investigation: Investigation;
}

export interface AnomalyFeature {
  feature: string;
  expectedValue: number;
  actualValue: number;
  deviation: number;
  threshold: number;
  contribution: number;
}

export interface AnomalyPattern {
  pattern: string;
  frequency: number;
  typicalTime: string;
  indicators: string[];
  severity: Severity;
}

export interface AnomalyRecommendation {
  anomalyId: string;
  action: string;
  priority: Priority;
  timeline: string;
  resources: string[];
  expectedOutcome: string;
}

export interface AnomalyMonitoring {
  alertThresholds: AlertThreshold[];
  monitoringRules: MonitoringRule[];
  escalationPaths: EscalationPath[];
  reportingSchedule: ReportingSchedule;
}

export interface Investigation {
  status: InvestigationStatus;
  assignedTo: string;
  findings: string[];
  actions: string[];
  resolution: string;
  closeDate?: Date;
}

export type AnomalyType = 
  | 'statistical'
  | 'behavioral'
  | 'temporal'
  | 'contextual'
  | 'collective'
  | 'point';

export type AnomalyStatus = 
  | 'detected'
  | 'investigating'
  | 'confirmed'
  | 'false_positive'
  | 'resolved';

export type InvestigationStatus = 
  | 'open'
  | 'in_progress'
  | 'pending_review'
  | 'closed';

// Churn Prediction Interfaces
export interface ChurnPrediction {
  customerId: string;
  churnProbability: number;
  churnRisk: ChurnRisk;
  timeToChurn: number;
  confidence: number;
  factors: ChurnFactor[];
  interventions: ChurnIntervention[];
  retention: RetentionStrategy[];
  value: CustomerValue;
}

export interface ChurnFactor {
  factor: string;
  impact: number;
  trend: Trend;
  weight: number;
  mitigation: string;
}

export interface ChurnIntervention {
  intervention: string;
  probability: number;
  cost: number;
  expectedRoi: number;
  timeline: string;
  prerequisites: string[];
}

export interface RetentionStrategy {
  strategy: string;
  effectiveness: number;
  cost: number;
  timeline: string;
  targetSegment: string;
  success: SuccessMetrics;
}

export interface CustomerValue {
  ltv: number;
  clv: number;
  monthlyValue: number;
  retentionValue: number;
  acquisitionCost: number;
}

export interface SuccessMetrics {
  retentionRate: number;
  engagement: number;
  satisfaction: number;
  revenue: number;
}

export type ChurnRisk = 
  | 'very_low'
  | 'low'
  | 'medium'
  | 'high'
  | 'very_high'
  | 'imminent';

// Resource Optimization Interfaces
export interface ResourceOptimization {
  resourceType: ResourceType;
  currentAllocation: ResourceAllocation;
  optimizedAllocation: ResourceAllocation;
  efficiency: EfficiencyMetrics;
  recommendations: OptimizationRecommendation[];
  scenarios: OptimizationScenario[];
  constraints: ResourceConstraint[];
}

export interface ResourceAllocation {
  resources: Resource[];
  totalCapacity: number;
  utilization: number;
  cost: number;
  performance: number;
}

export interface Resource {
  resourceId: string;
  type: string;
  capacity: number;
  utilization: number;
  cost: number;
  performance: number;
  availability: Availability;
}

export interface EfficiencyMetrics {
  overallEfficiency: number;
  costEfficiency: number;
  timeEfficiency: number;
  qualityMetrics: QualityMetrics;
  bottlenecks: ResourceBottleneck[];
}

export interface OptimizationRecommendation {
  recommendation: string;
  impact: number;
  cost: number;
  timeline: string;
  priority: Priority;
  dependencies: string[];
}

export interface OptimizationScenario {
  scenario: string;
  allocation: ResourceAllocation;
  performance: number;
  cost: number;
  tradeoffs: string[];
}

export interface ResourceConstraint {
  constraint: string;
  type: ConstraintType;
  value: number;
  flexibility: number;
}

export interface Availability {
  schedule: Schedule[];
  utilization: number;
  downtime: number;
  maintenance: MaintenanceWindow[];
}

export type ResourceType = 
  | 'human'
  | 'technical'
  | 'financial'
  | 'physical'
  | 'time';

export type ConstraintType = 
  | 'hard'
  | 'soft'
  | 'preference';

// Performance Prediction Interfaces
export interface PerformancePrediction {
  entityId: string;
  entityType: EntityType;
  predictions: PerformanceMetric[];
  trends: PerformanceTrend[];
  benchmarks: Benchmark[];
  factors: PerformanceFactor[];
  recommendations: PerformanceRecommendation[];
  scenarios: PerformanceScenario[];
}

export interface PerformanceMetric {
  metric: string;
  currentValue: number;
  predictedValue: number;
  target: number;
  confidence: number;
  timeframe: string;
}

export interface PerformanceTrend {
  metric: string;
  direction: TrendDirection;
  velocity: number;
  acceleration: number;
  volatility: number;
  seasonality: SeasonalPattern[];
}

export interface Benchmark {
  metric: string;
  internalBenchmark: number;
  industryBenchmark: number;
  bestInClass: number;
  percentile: number;
}

export interface PerformanceFactor {
  factor: string;
  impact: number;
  controllability: number;
  trend: Trend;
  interventions: string[];
}

export interface PerformanceRecommendation {
  metric: string;
  recommendation: string;
  expectedImprovement: number;
  effort: EffortLevel;
  timeline: string;
  priority: Priority;
}

export interface PerformanceScenario {
  scenario: string;
  probability: number;
  outcomes: ScenarioOutcome[];
  triggers: Trigger[];
}

export interface ScenarioOutcome {
  metric: string;
  value: number;
  confidence: number;
}

export type EffortLevel = 
  | 'low'
  | 'medium'
  | 'high'
  | 'very_high';

// Model Lifecycle Management Interfaces
export interface ModelLifecycle {
  modelId: string;
  lifecycle: LifecycleStage[];
  currentStage: LifecycleStageInfo;
  monitoring: ModelMonitoring;
  governance: ModelGovernance;
  deployment: ModelDeployment;
  retirement: RetirementPlan;
}

export interface LifecycleStageInfo {
  stage: ModelLifecycleStage;
  entryDate: Date;
  expectedDuration: number;
  completionCriteria: string[];
  nextStage: ModelLifecycleStage;
  approvals: Approval[];
}

export interface ModelMonitoring {
  metrics: MonitoringMetric[];
  alerts: ModelAlert[];
  performance: PerformanceTracking;
  drift: DriftDetection;
  health: ModelHealth;
}

export interface ModelGovernance {
  policies: GovernancePolicy[];
  compliance: ComplianceStatus;
  documentation: ModelDocumentation;
  auditTrail: AuditEvent[];
  approvals: Approval[];
}

export interface ModelDeployment {
  environment: DeploymentEnvironment;
  version: string;
  rolloutStrategy: RolloutStrategy;
  canaryMetrics: CanaryMetrics;
  rollback: RollbackPlan;
}

export interface RetirementPlan {
  retirementDate: Date;
  reason: string;
  successor: string;
  transitionPlan: TransitionPlan;
  dataRetention: DataRetentionPolicy;
}

export type ModelLifecycleStage = 
  | 'development'
  | 'validation'
  | 'testing'
  | 'staging'
  | 'production'
  | 'monitoring'
  | 'retraining'
  | 'retirement';

// Common Utility Interfaces
export interface SeasonalPattern {
  pattern: string;
  strength: number;
  period: string;
  peak: string;
  trough: string;
}

export interface Trigger {
  trigger: string;
  condition: string;
  threshold: number;
  probability: number;
}

export interface PatternOutcome {
  outcome: string;
  probability: number;
  impact: number;
}

export interface PredictionFactor {
  factor: string;
  weight: number;
  confidence: number;
  trend: Trend;
}

export interface ImpactAssessment {
  financial: number;
  operational: number;
  reputational: number;
  compliance: number;
  overall: number;
}

export interface DigitalEngagement {
  channelUsage: ChannelUsage[];
  sessionMetrics: SessionMetrics;
  featureUsage: FeatureUsage[];
  engagement: EngagementScore;
}

export interface ChannelUsage {
  channel: string;
  frequency: number;
  preference: number;
  satisfaction: number;
}

export interface SessionMetrics {
  averageDuration: number;
  pageViews: number;
  bounceRate: number;
  conversionRate: number;
}

export interface FeatureUsage {
  feature: string;
  usage: number;
  satisfaction: number;
  abandonment: number;
}

export interface EngagementScore {
  overall: number;
  digital: number;
  content: number;
  interaction: number;
}

export interface CommunicationPreference {
  channel: string;
  frequency: string;
  timing: string;
  content: string[];
}

export interface SegmentBehavior {
  traits: string[];
  patterns: string[];
  preferences: string[];
  lifecycle: LifecycleDistribution;
}

export interface SegmentValue {
  averageValue: number;
  totalValue: number;
  growth: number;
  profitability: number;
}

export interface LifecycleDistribution {
  [stage: string]: number;
}

export interface SentimentScore {
  overall: number;
  positive: number;
  neutral: number;
  negative: number;
  confidence: number;
}

export interface FeedbackSummary {
  totalFeedback: number;
  averageRating: number;
  themes: FeedbackTheme[];
  trends: FeedbackTrend[];
}

export interface FeedbackTheme {
  theme: string;
  frequency: number;
  sentiment: number;
  priority: Priority;
}

export interface FeedbackTrend {
  metric: string;
  direction: TrendDirection;
  significance: number;
}

export interface AlertThreshold {
  metric: string;
  threshold: number;
  operator: ComparisonOperator;
  severity: Severity;
}

export interface MonitoringRule {
  rule: string;
  condition: string;
  action: string;
  frequency: MonitoringFrequency;
}

export interface EscalationPath {
  level: number;
  contact: string;
  timeframe: string;
  condition: string;
}

export interface ReportingSchedule {
  frequency: string;
  recipients: string[];
  format: string;
  content: string[];
}

export interface ResourceBottleneck {
  resource: string;
  utilization: number;
  impact: number;
  recommendations: string[];
}

export interface QualityMetrics {
  accuracy: number;
  completeness: number;
  timeliness: number;
  consistency: number;
}

export interface Schedule {
  day: string;
  startTime: string;
  endTime: string;
  capacity: number;
}

export interface MaintenanceWindow {
  start: Date;
  end: Date;
  type: string;
  impact: string;
}

export interface MonitoringMetric {
  metric: string;
  value: number;
  threshold: number;
  status: MetricStatus;
  lastUpdate: Date;
}

export interface ModelAlert {
  alertId: string;
  type: AlertType;
  severity: Severity;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  resolver?: string;
}

export interface PerformanceTracking {
  metrics: PerformanceMetric[];
  baseline: Baseline;
  degradation: DegradationAnalysis;
  improvement: ImprovementOpportunity[];
}

export interface DriftDetection {
  dataDrift: DriftMetric;
  modelDrift: DriftMetric;
  conceptDrift: DriftMetric;
  overallDrift: number;
}

export interface DriftMetric {
  score: number;
  threshold: number;
  status: DriftStatus;
  lastDetected: Date;
}

export interface ModelHealth {
  overall: number;
  availability: number;
  performance: number;
  accuracy: number;
  reliability: number;
}

export interface GovernancePolicy {
  policy: string;
  requirements: string[];
  compliance: boolean;
  lastReview: Date;
}

export interface ComplianceStatus {
  overall: boolean;
  violations: Violation[];
  recommendations: string[];
  lastAudit: Date;
}

export interface ModelDocumentation {
  specification: string;
  training: string;
  validation: string;
  deployment: string;
  monitoring: string;
}

export interface AuditEvent {
  eventId: string;
  type: string;
  timestamp: Date;
  user: string;
  description: string;
  impact: string;
}

export interface Approval {
  approver: string;
  timestamp: Date;
  status: ApprovalStatus;
  comments: string;
}

export interface DeploymentEnvironment {
  name: string;
  type: EnvironmentType;
  configuration: Record<string, any>;
  resources: Resource[];
}

export interface RolloutStrategy {
  type: RolloutType;
  phases: RolloutPhase[];
  criteria: RolloutCriteria;
  rollback: RollbackTrigger[];
}

export interface CanaryMetrics {
  successRate: number;
  errorRate: number;
  latency: number;
  throughput: number;
}

export interface RollbackPlan {
  triggers: RollbackTrigger[];
  procedure: string[];
  timeline: string;
  verification: string[];
}

export interface TransitionPlan {
  phases: TransitionPhase[];
  timeline: string;
  resources: string[];
  risks: string[];
}

export interface DataRetentionPolicy {
  period: string;
  storage: string;
  access: string[];
  disposal: string;
}

export interface RolloutPhase {
  phase: string;
  percentage: number;
  duration: string;
  criteria: string[];
}

export interface RolloutCriteria {
  successThreshold: number;
  errorThreshold: number;
  duration: string;
}

export interface RollbackTrigger {
  metric: string;
  threshold: number;
  timeframe: string;
  action: string;
}

export interface TransitionPhase {
  phase: string;
  activities: string[];
  timeline: string;
  dependencies: string[];
}

export interface Baseline {
  metric: string;
  value: number;
  timestamp: Date;
  confidence: number;
}

export interface DegradationAnalysis {
  detected: boolean;
  severity: Severity;
  cause: string;
  impact: number;
  recommendation: string;
}

export interface ImprovementOpportunity {
  area: string;
  potential: number;
  effort: EffortLevel;
  timeline: string;
}

export interface Violation {
  rule: string;
  severity: Severity;
  description: string;
  remediation: string;
}

export type MetricStatus = 
  | 'healthy'
  | 'warning'
  | 'critical'
  | 'unknown';

export type DriftStatus = 
  | 'stable'
  | 'warning'
  | 'drifting'
  | 'critical';

export type ApprovalStatus = 
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired';

export type EnvironmentType = 
  | 'development'
  | 'staging'
  | 'production'
  | 'canary';

export type RolloutType = 
  | 'blue_green'
  | 'canary'
  | 'rolling'
  | 'immediate';

export type ComparisonOperator = 
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'eq'
  | 'neq';

export type Severity = 
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

export type Priority = 
  | 'low'
  | 'medium'
  | 'high'
  | 'urgent';

// Base Predictive Component Interface
export interface PredictiveComponent extends EventEmitter {
  initialize(): Promise<void>;
  predict(input: any, options?: any): Promise<any>;
  train(data: any, options?: any): Promise<any>;
  evaluate(testData: any): Promise<ModelPerformance>;
  getStatus(): ComponentStatus;
  getMetrics(): ModelPerformance;
  getModel(): PredictiveModel;
}

export interface ComponentStatus {
  isReady: boolean;
  isTraining: boolean;
  isProcessing: boolean;
  lastError?: string;
  uptime: number;
  totalPredictions: number;
  lastPrediction?: Date;
}
