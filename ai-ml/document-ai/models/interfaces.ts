import { EventEmitter } from 'events';

// Core AI/ML Interfaces
export interface AIModel {
  id: string;
  name: string;
  version: string;
  type: ModelType;
  status: ModelStatus;
  accuracy: number;
  lastTrained: Date;
  metadata: ModelMetadata;
}

export interface ModelMetadata {
  trainingDataSize: number;
  validationAccuracy: number;
  testAccuracy: number;
  modelSize: number;
  parameters: Record<string, any>;
  performance: PerformanceMetrics;
}

export interface PerformanceMetrics {
  inferenceTime: number;
  memoryUsage: number;
  cpuUsage: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
}

export type ModelType = 
  | 'ocr'
  | 'classification'
  | 'extraction'
  | 'similarity'
  | 'fraud'
  | 'handwriting'
  | 'quality'
  | 'workflow';

export type ModelStatus = 
  | 'training'
  | 'ready'
  | 'deploying'
  | 'deprecated'
  | 'failed';

// Document Processing Interfaces
export interface DocumentProcessingRequest {
  documentId: string;
  documentBuffer: Buffer;
  metadata: DocumentMetadata;
  options: ProcessingOptions;
}

export interface DocumentMetadata {
  filename: string;
  size: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: Date;
  source: string;
  language?: string;
  expectedDocumentType?: string;
}

export interface ProcessingOptions {
  enableOCR: boolean;
  enableClassification: boolean;
  enableExtraction: boolean;
  enableSimilarityCheck: boolean;
  enableFraudDetection: boolean;
  enableQualityCheck: boolean;
  preprocessingOptions: PreprocessingOptions;
  extractionLevel: 'basic' | 'standard' | 'comprehensive';
  confidenceThreshold: number;
}

export interface PreprocessingOptions {
  denoise: boolean;
  deskew: boolean;
  enhance: boolean;
  binarize: boolean;
  removeBackground: boolean;
  resolutionEnhancement: boolean;
  contrastOptimization: boolean;
}

// Processing Results
export interface DocumentProcessingResult {
  documentId: string;
  success: boolean;
  processingTime: number;
  results: {
    ocr?: OCRResult;
    classification?: ClassificationResult;
    extraction?: ExtractionResult;
    similarity?: SimilarityResult;
    fraud?: FraudResult;
    quality?: QualityResult;
    handwriting?: HandwritingResult;
    workflow?: WorkflowResult;
  };
  errors: ProcessingError[];
  warnings: ProcessingWarning[];
  metadata: ResultMetadata;
}

export interface ResultMetadata {
  processingSteps: string[];
  modelsUsed: string[];
  performanceMetrics: PerformanceMetrics;
  qualityScore: number;
  confidence: number;
}

// OCR Interfaces
export interface OCRResult {
  text: string;
  confidence: number;
  words: OCRWord[];
  lines: OCRLine[];
  blocks: OCRBlock[];
  pages: OCRPage[];
  detectedLanguage: string;
  handwritingDetected: boolean;
  qualityScore: number;
  metadata: OCRMetadata;
}

export interface OCRWord {
  text: string;
  confidence: number;
  boundingBox: BoundingBox;
  fontSize: number;
  fontStyle: string;
  isHandwritten: boolean;
  language: string;
}

export interface OCRLine {
  text: string;
  confidence: number;
  boundingBox: BoundingBox;
  words: OCRWord[];
  baseline: number;
  isHandwritten: boolean;
}

export interface OCRBlock {
  text: string;
  confidence: number;
  boundingBox: BoundingBox;
  lines: OCRLine[];
  blockType: BlockType;
  isHandwritten: boolean;
}

export interface OCRPage {
  pageNumber: number;
  blocks: OCRBlock[];
  dimensions: PageDimensions;
  orientation: number;
  skewAngle: number;
}

export interface OCRMetadata {
  ocrEngine: string;
  modelVersion: string;
  processingTime: number;
  preprocessingApplied: string[];
  languageDetectionConfidence: number;
  handwritingConfidence: number;
}

export type BlockType = 
  | 'paragraph'
  | 'heading'
  | 'table'
  | 'image'
  | 'separator'
  | 'header'
  | 'footer'
  | 'form_field'
  | 'signature';

// Classification Interfaces
export interface ClassificationResult {
  primaryClass: string;
  confidence: number;
  allClasses: ClassificationScore[];
  features: DocumentFeatures;
  metadata: ClassificationMetadata;
}

export interface ClassificationScore {
  className: string;
  confidence: number;
  probability: number;
}

export interface DocumentFeatures {
  textFeatures: TextFeatures;
  visualFeatures: VisualFeatures;
  structuralFeatures: StructuralFeatures;
  metadataFeatures: MetadataFeatures;
}

export interface TextFeatures {
  keywords: string[];
  entities: NamedEntity[];
  language: string;
  textDensity: number;
  vocabularyComplexity: number;
  medicalTerminology: number;
}

export interface VisualFeatures {
  layout: LayoutFeatures;
  hasLogo: boolean;
  hasTable: boolean;
  hasSignature: boolean;
  hasHandwriting: boolean;
  colorProfile: string[];
  imageQuality: number;
}

export interface StructuralFeatures {
  hasHeader: boolean;
  hasFooter: boolean;
  hasTitle: boolean;
  sectionCount: number;
  paragraphCount: number;
  listCount: number;
  formFieldCount: number;
}

export interface MetadataFeatures {
  fileSize: number;
  pageCount: number;
  hasFormFields: boolean;
  isScanned: boolean;
  compressionLevel: number;
  colorDepth: number;
}

// Information Extraction Interfaces
export interface ExtractionResult {
  entities: NamedEntity[];
  relationships: EntityRelationship[];
  structuredData: StructuredData;
  medicalCodes: MedicalCode[];
  dates: ExtractedDate[];
  amounts: ExtractedAmount[];
  metadata: ExtractionMetadata;
}

export interface NamedEntity {
  text: string;
  type: EntityType;
  confidence: number;
  position: TextPosition;
  normalizedValue?: string;
  attributes: Record<string, any>;
}

export interface EntityRelationship {
  sourceEntity: string;
  targetEntity: string;
  relationship: RelationType;
  confidence: number;
}

export interface StructuredData {
  patientInfo: PatientInfo;
  providerInfo: ProviderInfo;
  serviceInfo: ServiceInfo;
  billing: BillingInfo;
  diagnosis: DiagnosisInfo;
  medication: MedicationInfo[];
  labResults: LabResult[];
}

export interface MedicalCode {
  code: string;
  system: CodeSystem;
  description: string;
  confidence: number;
  position: TextPosition;
}

export interface ExtractedDate {
  value: Date;
  format: string;
  confidence: number;
  position: TextPosition;
  type: DateType;
}

export interface ExtractedAmount {
  value: number;
  currency: string;
  confidence: number;
  position: TextPosition;
  type: AmountType;
}

// Similarity Detection Interfaces
export interface SimilarityResult {
  similarDocuments: SimilarDocument[];
  duplicateDocuments: DuplicateDocument[];
  fingerprint: DocumentFingerprint;
  metadata: SimilarityMetadata;
}

export interface SimilarDocument {
  documentId: string;
  similarity: number;
  matchType: MatchType;
  confidence: number;
  matchedFeatures: string[];
}

export interface DuplicateDocument {
  documentId: string;
  similarity: number;
  isDuplicate: boolean;
  confidence: number;
  duplicateType: DuplicateType;
}

export interface DocumentFingerprint {
  structuralHash: string;
  contentHash: string;
  visualHash: string;
  metadataHash: string;
  semanticEmbedding: number[];
}

// Fraud Detection Interfaces
export interface FraudResult {
  riskScore: number;
  riskLevel: RiskLevel;
  suspiciousActivities: SuspiciousActivity[];
  fraudIndicators: FraudIndicator[];
  recommendations: FraudRecommendation[];
  confidence: number;
  metadata: FraudMetadata;
}

export interface SuspiciousActivity {
  type: SuspiciousActivityType;
  severity: Severity;
  description: string;
  evidence: any[];
  confidence: number;
  riskContribution: number;
}

export interface FraudIndicator {
  category: FraudCategory;
  indicator: string;
  value: any;
  threshold: any;
  exceeded: boolean;
  weight: number;
}

export interface FraudRecommendation {
  priority: Priority;
  action: string;
  description: string;
  automated: boolean;
  estimatedTime: number;
}

// Quality Assessment Interfaces
export interface QualityResult {
  overallScore: number;
  qualityIndicators: QualityIndicator[];
  improvementSuggestions: ImprovementSuggestion[];
  processability: boolean;
  metadata: QualityMetadata;
}

export interface QualityIndicator {
  aspect: QualityAspect;
  score: number;
  description: string;
  impact: QualityImpact;
}

export interface ImprovementSuggestion {
  aspect: QualityAspect;
  suggestion: string;
  priority: Priority;
  estimatedImprovement: number;
}

// Handwriting Recognition Interfaces
export interface HandwritingResult {
  detectedRegions: HandwritingRegion[];
  extractedText: string;
  confidence: number;
  isSignature: boolean;
  metadata: HandwritingMetadata;
}

export interface HandwritingRegion {
  boundingBox: BoundingBox;
  text: string;
  confidence: number;
  type: HandwritingType;
  language: string;
}

// Workflow Automation Interfaces
export interface WorkflowResult {
  recommendedWorkflow: WorkflowStep[];
  automatedActions: AutomatedAction[];
  manualReviewRequired: boolean;
  priorityLevel: Priority;
  estimatedProcessingTime: number;
  metadata: WorkflowMetadata;
}

export interface WorkflowStep {
  stepId: string;
  description: string;
  automated: boolean;
  estimatedTime: number;
  dependencies: string[];
  requiredRole: string;
}

export interface AutomatedAction {
  actionId: string;
  description: string;
  executed: boolean;
  result: any;
  timestamp: Date;
}

// Common Utility Interfaces
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextPosition {
  start: number;
  end: number;
  line: number;
  column: number;
}

export interface PageDimensions {
  width: number;
  height: number;
  dpi: number;
}

export interface LayoutFeatures {
  columnCount: number;
  marginSizes: MarginSizes;
  fontSizes: number[];
  alignment: TextAlignment;
  hasWatermark: boolean;
}

export interface MarginSizes {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

// Error and Warning Interfaces
export interface ProcessingError {
  code: string;
  message: string;
  severity: Severity;
  component: string;
  timestamp: Date;
  details?: any;
}

export interface ProcessingWarning {
  code: string;
  message: string;
  component: string;
  timestamp: Date;
  details?: any;
}

// Training and Model Management Interfaces
export interface TrainingRequest {
  modelType: ModelType;
  trainingData: TrainingData[];
  validationData: TrainingData[];
  hyperparameters: Record<string, any>;
  options: TrainingOptions;
}

export interface TrainingData {
  input: Buffer;
  expectedOutput: any;
  metadata: Record<string, any>;
}

export interface TrainingOptions {
  epochs: number;
  batchSize: number;
  learningRate: number;
  validationSplit: number;
  earlyStopping: boolean;
  saveCheckpoints: boolean;
}

export interface TrainingResult {
  modelId: string;
  success: boolean;
  finalAccuracy: number;
  trainingHistory: TrainingMetrics[];
  modelPath: string;
  metadata: TrainingResultMetadata;
}

export interface TrainingMetrics {
  epoch: number;
  loss: number;
  accuracy: number;
  validationLoss: number;
  validationAccuracy: number;
  timestamp: Date;
}

// Monitoring Interfaces
export interface ModelMonitoringData {
  modelId: string;
  timestamp: Date;
  performanceMetrics: PerformanceMetrics;
  predictionDistribution: PredictionDistribution;
  driftMetrics: DriftMetrics;
  alerts: ModelAlert[];
}

export interface PredictionDistribution {
  totalPredictions: number;
  confidenceDistribution: ConfidenceBucket[];
  classDistribution: ClassBucket[];
}

export interface ConfidenceBucket {
  range: [number, number];
  count: number;
  percentage: number;
}

export interface ClassBucket {
  className: string;
  count: number;
  percentage: number;
}

export interface DriftMetrics {
  dataDrift: number;
  modelDrift: number;
  conceptDrift: number;
  driftDetected: boolean;
}

export interface ModelAlert {
  alertId: string;
  type: AlertType;
  severity: Severity;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

// Enums and Types
export type EntityType = 
  | 'PERSON'
  | 'ORG'
  | 'DATE'
  | 'MONEY'
  | 'MEDICAL_CODE'
  | 'PROCEDURE'
  | 'MEDICATION'
  | 'DIAGNOSIS'
  | 'HOSPITAL'
  | 'DOCTOR'
  | 'PATIENT_ID'
  | 'INSURANCE_NUMBER'
  | 'PHONE'
  | 'ADDRESS'
  | 'EMAIL';

export type RelationType = 
  | 'PATIENT_OF'
  | 'DOCTOR_AT'
  | 'PRESCRIBED_BY'
  | 'DIAGNOSED_WITH'
  | 'TREATED_AT'
  | 'ORDERED_BY'
  | 'BILLED_TO'
  | 'PERFORMED_ON';

export type CodeSystem = 
  | 'ICD10'
  | 'CPT'
  | 'LOINC'
  | 'SNOMED'
  | 'RxNorm'
  | 'NDC'
  | 'Vietnamese_Medical';

export type DateType = 
  | 'SERVICE_DATE'
  | 'BIRTH_DATE'
  | 'PRESCRIPTION_DATE'
  | 'TEST_DATE'
  | 'BILLING_DATE'
  | 'ADMISSION_DATE'
  | 'DISCHARGE_DATE';

export type AmountType = 
  | 'TOTAL_AMOUNT'
  | 'COPAY'
  | 'DEDUCTIBLE'
  | 'SERVICE_FEE'
  | 'MEDICATION_COST'
  | 'LAB_FEE'
  | 'ROOM_CHARGE';

export type MatchType = 
  | 'EXACT'
  | 'NEAR_DUPLICATE'
  | 'SIMILAR_CONTENT'
  | 'SIMILAR_STRUCTURE'
  | 'SIMILAR_VISUAL';

export type DuplicateType = 
  | 'IDENTICAL'
  | 'NEAR_IDENTICAL'
  | 'RESUBMISSION'
  | 'ALTERED_COPY';

export type RiskLevel = 
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

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

export type SuspiciousActivityType = 
  | 'duplicate_document'
  | 'altered_document'
  | 'fake_document'
  | 'identity_mismatch'
  | 'amount_manipulation'
  | 'date_manipulation'
  | 'forged_signature'
  | 'inconsistent_data'
  | 'unusual_pattern'
  | 'blacklist_match'
  | 'behavioral_anomaly';

export type FraudCategory = 
  | 'document_authenticity'
  | 'data_integrity'
  | 'behavioral_analysis'
  | 'pattern_analysis'
  | 'identity_verification'
  | 'amount_analysis'
  | 'temporal_analysis'
  | 'cross_reference';

export type QualityAspect = 
  | 'IMAGE_CLARITY'
  | 'TEXT_READABILITY'
  | 'DOCUMENT_COMPLETENESS'
  | 'STRUCTURAL_INTEGRITY'
  | 'COLOR_QUALITY'
  | 'RESOLUTION'
  | 'ORIENTATION'
  | 'NOISE_LEVEL'
  | 'CONTRAST'
  | 'BRIGHTNESS';

export type QualityImpact = 
  | 'CRITICAL'
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'MINIMAL';

export type HandwritingType = 
  | 'CURSIVE'
  | 'PRINT'
  | 'SIGNATURE'
  | 'MEDICAL_NOTES'
  | 'FORM_FILL'
  | 'ANNOTATION';

export type TextAlignment = 
  | 'left'
  | 'center'
  | 'right'
  | 'justified'
  | 'mixed';

export type AlertType = 
  | 'PERFORMANCE_DEGRADATION'
  | 'ACCURACY_DROP'
  | 'DATA_DRIFT'
  | 'MODEL_DRIFT'
  | 'HIGH_ERROR_RATE'
  | 'UNUSUAL_PREDICTIONS'
  | 'SYSTEM_ERROR';

// Domain-specific Interfaces
export interface PatientInfo {
  name: string;
  id: string;
  birthDate: Date;
  gender: string;
  address: string;
  phone: string;
  insuranceNumber: string;
}

export interface ProviderInfo {
  name: string;
  license: string;
  specialty: string;
  hospital: string;
  address: string;
  phone: string;
}

export interface ServiceInfo {
  procedures: Procedure[];
  diagnoses: Diagnosis[];
  serviceDate: Date;
  department: string;
  roomNumber: string;
}

export interface BillingInfo {
  billNumber: string;
  totalAmount: number;
  currency: string;
  itemizedCharges: ChargeItem[];
  insurance: InsuranceInfo;
  paymentMethod: string;
}

export interface DiagnosisInfo {
  primaryDiagnosis: Diagnosis;
  secondaryDiagnoses: Diagnosis[];
  symptoms: string[];
  treatmentPlan: string;
}

export interface MedicationInfo {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  prescribedBy: string;
  rxNumber: string;
}

export interface LabResult {
  testName: string;
  value: string;
  unit: string;
  referenceRange: string;
  abnormal: boolean;
  testDate: Date;
}

export interface Procedure {
  code: string;
  description: string;
  date: Date;
  provider: string;
  cost: number;
}

export interface Diagnosis {
  code: string;
  description: string;
  type: 'primary' | 'secondary';
  date: Date;
}

export interface ChargeItem {
  description: string;
  code: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export interface InsuranceInfo {
  provider: string;
  policyNumber: string;
  groupNumber: string;
  coverage: number;
  copay: number;
  deductible: number;
}

// Event Emitter Interface for AI Components
export interface AIComponent extends EventEmitter {
  initialize(): Promise<void>;
  process(input: any, options?: any): Promise<any>;
  getStatus(): ComponentStatus;
  getMetrics(): PerformanceMetrics;
}

export interface ComponentStatus {
  isReady: boolean;
  isProcessing: boolean;
  lastError?: string;
  uptime: number;
  totalProcessed: number;
}

// Configuration Interfaces
export interface AIModelConfig {
  modelPath: string;
  version: string;
  parameters: Record<string, any>;
  performanceTargets: PerformanceTargets;
}

export interface PerformanceTargets {
  maxInferenceTime: number;
  minAccuracy: number;
  maxMemoryUsage: number;
  maxCpuUsage: number;
}

// Additional metadata interfaces
export interface ClassificationMetadata {
  modelVersion: string;
  featuresUsed: string[];
  processingTime: number;
  confidenceThreshold: number;
  featureImportance?: Record<string, number>;
}

export interface ExtractionMetadata {
  extractorVersion: string;
  entitiesFound: number;
  relationshipsFound: number;
  processingTime: number;
  qualityScore: number;
}

export interface SimilarityMetadata {
  algorithm: string;
  threshold: number;
  comparisonsPerformed: number;
  processingTime: number;
}

export interface FraudMetadata {
  detectorVersion: string;
  rulesApplied: number;
  modelVersion: string;
  processingTime: number;
}

export interface QualityMetadata {
  assessmentVersion: string;
  aspectsEvaluated: string[];
  processingTime: number;
  improvementPotential: number;
}

export interface HandwritingMetadata {
  recognitionEngine: string;
  modelVersion: string;
  languageModel: string;
  processingTime: number;
  regionsAnalyzed: number;
}

export interface WorkflowMetadata {
  workflowEngine: string;
  rulesApplied: string[];
  automationLevel: number;
  processingTime: number;
}

export interface TrainingResultMetadata {
  trainingDuration: number;
  datasetSize: number;
  modelComplexity: number;
  computeResources: ComputeResources;
}

export interface ComputeResources {
  cpuHours: number;
  memoryPeakGB: number;
  gpuHours?: number;
  storageUsedGB: number;
}
