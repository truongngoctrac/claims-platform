import { EventEmitter } from 'events';
import {
  SmartComponent,
  ComponentStatus,
  ComponentPerformance,
  SmartRecommendation,
  DocumentRecommendation,
  DocumentType,
  RequiredDocument,
  OptionalDocument,
  UploadGuideline,
  QualityRequirement,
  SimilarCase,
  UserFeedback,
  RecommendationContext,
  DocumentFormat,
  QualityStandard,
  DocumentUrgency,
  ProcessingImpact,
  QualityAspect,
  CaseOutcome
} from './interfaces';

export interface DocumentRecommendationInput {
  userId: string;
  claimType: string;
  claimAmount: number;
  customerProfile: CustomerProfile;
  medicalCondition?: MedicalCondition;
  providerInfo?: ProviderInfo;
  currentDocuments: CurrentDocument[];
  context: RecommendationContext;
}

export interface CustomerProfile {
  age: number;
  gender: string;
  medicalHistory: string[];
  policyType: string;
  previousClaims: number;
  riskProfile: string;
  preferredLanguage: string;
}

export interface MedicalCondition {
  primaryDiagnosis: string;
  secondaryDiagnoses: string[];
  severity: string;
  chronic: boolean;
  treatmentType: string;
  specialtyRequired: string[];
}

export interface ProviderInfo {
  providerId: string;
  type: string;
  specialty: string[];
  accreditation: string[];
  reputation: number;
}

export interface CurrentDocument {
  type: DocumentType;
  quality: number;
  completeness: number;
  uploaded: boolean;
  issues: string[];
}

export class DocumentRecommendationEngine extends EventEmitter implements SmartComponent {
  private isInitialized: boolean = false;
  private isLearning: boolean = false;
  private isProcessing: boolean = false;
  private startTime: Date = new Date();
  private totalRecommendations: number = 0;
  private lastRecommendation?: Date;
  private lastError?: string;

  // Document requirements database
  private documentRequirements = new Map<string, DocumentRequirement[]>();
  private qualityStandards = new Map<DocumentType, QualityRequirement[]>();
  private uploadGuidelines = new Map<DocumentType, UploadGuideline[]>();
  private similarCaseDatabase: SimilarCase[] = [];

  // Learning and optimization data
  private userDocumentPatterns = new Map<string, UserDocumentPattern>();
  private feedbackHistory: UserFeedback[] = [];
  private performance: ComponentPerformance;

  constructor() {
    super();
    this.performance = this.initializePerformance();
    this.initializeDocumentDatabase();
  }

  async initialize(): Promise<void> {
    this.emit('initializing');
    
    try {
      await this.loadDocumentRequirements();
      await this.loadQualityStandards();
      await this.loadUploadGuidelines();
      await this.loadSimilarCases();
      await this.loadUserPatterns();
      
      this.isInitialized = true;
      this.emit('initialized');
      
    } catch (error) {
      this.lastError = error.message;
      this.emit('error', error);
      throw error;
    }
  }

  async recommend(input: DocumentRecommendationInput, options?: any): Promise<SmartRecommendation[]> {
    if (!this.isInitialized) {
      throw new Error('Document recommendation engine not initialized');
    }

    this.isProcessing = true;
    this.emit('recommendation_started', { userId: input.userId, claimType: input.claimType });

    try {
      // Analyze current document state
      const documentGaps = this.analyzeDocumentGaps(input);
      
      // Get required documents for claim type
      const requiredDocs = this.getRequiredDocuments(input.claimType, input.medicalCondition);
      
      // Get optional documents that could help
      const optionalDocs = this.getOptionalDocuments(input);
      
      // Find similar cases for guidance
      const similarCases = this.findSimilarCases(input);
      
      // Generate quality recommendations
      const qualityRecommendations = this.generateQualityRecommendations(input.currentDocuments);
      
      // Create personalized recommendations
      const recommendations = this.createDocumentRecommendations(
        input,
        documentGaps,
        requiredDocs,
        optionalDocs,
        similarCases,
        qualityRecommendations
      );

      this.totalRecommendations += recommendations.length;
      this.lastRecommendation = new Date();
      this.isProcessing = false;
      
      this.emit('recommendation_completed', { 
        userId: input.userId, 
        recommendationCount: recommendations.length 
      });

      return recommendations;

    } catch (error) {
      this.lastError = error.message;
      this.isProcessing = false;
      this.emit('error', error);
      throw error;
    }
  }

  private analyzeDocumentGaps(input: DocumentRecommendationInput): DocumentGap[] {
    const gaps: DocumentGap[] = [];
    const requirements = this.documentRequirements.get(input.claimType) || [];
    
    for (const requirement of requirements) {
      const currentDoc = input.currentDocuments.find(doc => doc.type === requirement.documentType);
      
      if (!currentDoc) {
        gaps.push({
          type: requirement.documentType,
          severity: requirement.mandatory ? 'critical' : 'medium',
          impact: requirement.processingImpact,
          recommendation: `Upload ${requirement.name} to proceed with your claim`
        });
      } else if (currentDoc.quality < requirement.minQuality) {
        gaps.push({
          type: requirement.documentType,
          severity: 'medium',
          impact: 'quality_issues',
          recommendation: `Improve quality of ${requirement.name} for faster processing`
        });
      } else if (currentDoc.completeness < 0.8) {
        gaps.push({
          type: requirement.documentType,
          severity: 'medium',
          impact: 'incomplete_information',
          recommendation: `Complete all required fields in ${requirement.name}`
        });
      }
    }
    
    return gaps;
  }

  private getRequiredDocuments(claimType: string, condition?: MedicalCondition): RequiredDocument[] {
    const baseRequirements = this.getBaseRequirements(claimType);
    const conditionSpecific = condition ? this.getConditionSpecificRequirements(condition) : [];
    
    return [...baseRequirements, ...conditionSpecific];
  }

  private getBaseRequirements(claimType: string): RequiredDocument[] {
    const requirements: Record<string, RequiredDocument[]> = {
      'medical': [
        {
          type: 'medical_report',
          name: 'Medical Report',
          description: 'Detailed medical report from treating physician',
          format: ['pdf', 'jpg', 'png'],
          sizeLimit: 10 * 1024 * 1024, // 10MB
          quality: 'standard',
          urgency: 'urgent',
          alternatives: ['discharge_summary', 'specialist_report']
        },
        {
          type: 'invoice',
          name: 'Medical Invoice',
          description: 'Itemized bill for medical services received',
          format: ['pdf', 'jpg', 'png'],
          sizeLimit: 5 * 1024 * 1024,
          quality: 'standard',
          urgency: 'urgent',
          alternatives: ['receipt']
        },
        {
          type: 'prescription',
          name: 'Prescription',
          description: 'Original prescription from doctor if medications were prescribed',
          format: ['pdf', 'jpg', 'png'],
          sizeLimit: 5 * 1024 * 1024,
          quality: 'standard',
          urgency: 'normal',
          alternatives: ['medication_list']
        }
      ],
      'dental': [
        {
          type: 'medical_report',
          name: 'Dental Report',
          description: 'Detailed dental examination report',
          format: ['pdf', 'jpg', 'png'],
          sizeLimit: 10 * 1024 * 1024,
          quality: 'high',
          urgency: 'urgent',
          alternatives: ['x_ray_report']
        },
        {
          type: 'diagnostic_image',
          name: 'Dental X-rays',
          description: 'X-ray images showing dental condition',
          format: ['jpg', 'png', 'tiff'],
          sizeLimit: 20 * 1024 * 1024,
          quality: 'high',
          urgency: 'urgent',
          alternatives: []
        }
      ],
      'emergency': [
        {
          type: 'discharge_summary',
          name: 'Emergency Discharge Summary',
          description: 'Summary of emergency treatment provided',
          format: ['pdf', 'jpg', 'png'],
          sizeLimit: 10 * 1024 * 1024,
          quality: 'standard',
          urgency: 'immediate',
          alternatives: ['medical_report']
        },
        {
          type: 'invoice',
          name: 'Emergency Bill',
          description: 'Detailed bill for emergency services',
          format: ['pdf', 'jpg', 'png'],
          sizeLimit: 10 * 1024 * 1024,
          quality: 'standard',
          urgency: 'immediate',
          alternatives: []
        }
      ]
    };

    return requirements[claimType] || requirements['medical'];
  }

  private getConditionSpecificRequirements(condition: MedicalCondition): RequiredDocument[] {
    const requirements: RequiredDocument[] = [];

    // Add lab results for certain conditions
    if (condition.primaryDiagnosis.includes('diabetes') || 
        condition.primaryDiagnosis.includes('kidney') ||
        condition.primaryDiagnosis.includes('liver')) {
      requirements.push({
        type: 'lab_result',
        name: 'Laboratory Results',
        description: 'Recent lab test results related to your condition',
        format: ['pdf', 'jpg', 'png'],
        sizeLimit: 5 * 1024 * 1024,
        quality: 'standard',
        urgency: 'urgent',
        alternatives: []
      });
    }

    // Add diagnostic images for certain conditions
    if (condition.primaryDiagnosis.includes('fracture') ||
        condition.primaryDiagnosis.includes('cancer') ||
        condition.primaryDiagnosis.includes('tumor')) {
      requirements.push({
        type: 'diagnostic_image',
        name: 'Diagnostic Images',
        description: 'X-rays, CT scans, or MRI images showing the condition',
        format: ['jpg', 'png', 'tiff'],
        sizeLimit: 50 * 1024 * 1024,
        quality: 'high',
        urgency: 'urgent',
        alternatives: []
      });
    }

    // Add specialist reports for complex conditions
    if (condition.specialtyRequired.length > 0) {
      requirements.push({
        type: 'referral_letter',
        name: 'Specialist Referral',
        description: `Referral letter to ${condition.specialtyRequired.join(', ')} specialist`,
        format: ['pdf', 'jpg', 'png'],
        sizeLimit: 5 * 1024 * 1024,
        quality: 'standard',
        urgency: 'normal',
        alternatives: ['specialist_report']
      });
    }

    return requirements;
  }

  private getOptionalDocuments(input: DocumentRecommendationInput): OptionalDocument[] {
    const optional: OptionalDocument[] = [];

    // Medical history for better context
    if (input.customerProfile.medicalHistory.length > 0) {
      optional.push({
        type: 'medical_history',
        name: 'Medical History',
        description: 'Previous medical records showing treatment history',
        benefit: 'Provides context for current condition and treatment',
        impactOnProcessing: 'faster_processing'
      });
    }

    // Insurance card for verification
    optional.push({
      type: 'insurance_card',
      name: 'Insurance Card Copy',
      description: 'Clear photo of both sides of insurance card',
      benefit: 'Faster verification of coverage and benefits',
      impactOnProcessing: 'reduced_queries'
    });

    // Consent forms for complex procedures
    if (input.claimAmount > 5000000) { // 5M VND
      optional.push({
        type: 'consent_form',
        name: 'Informed Consent',
        description: 'Signed consent form for the medical procedure',
        benefit: 'Demonstrates proper procedure authorization',
        impactOnProcessing: 'higher_approval_chance'
      });
    }

    return optional;
  }

  private findSimilarCases(input: DocumentRecommendationInput): SimilarCase[] {
    return this.similarCaseDatabase
      .filter(case_ => {
        const typeMatch = case_.caseId.includes(input.claimType);
        const amountSimilar = Math.abs(case_.outcome === 'approved' ? 1 : 0) > 0.5;
        return typeMatch || amountSimilar;
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3); // Top 3 similar cases
  }

  private generateQualityRecommendations(currentDocs: CurrentDocument[]): QualityRecommendation[] {
    const recommendations: QualityRecommendation[] = [];

    for (const doc of currentDocs) {
      if (doc.quality < 0.8) {
        recommendations.push({
          documentType: doc.type,
          currentQuality: doc.quality,
          targetQuality: 0.9,
          improvements: this.getQualityImprovements(doc.type, doc.quality),
          impact: 'Improved document quality will speed up processing time'
        });
      }

      if (doc.issues.length > 0) {
        recommendations.push({
          documentType: doc.type,
          currentQuality: doc.quality,
          targetQuality: 1.0,
          improvements: doc.issues.map(issue => `Resolve: ${issue}`),
          impact: 'Fixing document issues will prevent processing delays'
        });
      }
    }

    return recommendations;
  }

  private getQualityImprovements(docType: DocumentType, currentQuality: number): string[] {
    const improvements: string[] = [];

    if (currentQuality < 0.5) {
      improvements.push('Ensure document is clearly visible and not blurry');
      improvements.push('Use good lighting when taking photos');
      improvements.push('Avoid shadows and glare');
    }

    if (currentQuality < 0.7) {
      improvements.push('Ensure all text is readable');
      improvements.push('Include all pages of the document');
      improvements.push('Use high resolution scanner or camera');
    }

    if (currentQuality < 0.9) {
      improvements.push('Ensure document is properly oriented');
      improvements.push('Crop unnecessary borders');
      improvements.push('Use PDF format for multi-page documents');
    }

    // Document-specific improvements
    switch (docType) {
      case 'medical_report':
        improvements.push('Ensure doctor\'s signature and stamp are visible');
        improvements.push('Include all pages of the report');
        break;
      case 'invoice':
        improvements.push('Ensure all line items and amounts are visible');
        improvements.push('Include payment terms and due dates');
        break;
      case 'diagnostic_image':
        improvements.push('Use DICOM format if available');
        improvements.push('Include patient information and date');
        break;
    }

    return improvements;
  }

  private createDocumentRecommendations(
    input: DocumentRecommendationInput,
    gaps: DocumentGap[],
    required: RequiredDocument[],
    optional: OptionalDocument[],
    similarCases: SimilarCase[],
    qualityRecs: QualityRecommendation[]
  ): DocumentRecommendation[] {
    const recommendations: DocumentRecommendation[] = [];

    // Main document recommendation
    const mainRecommendation: DocumentRecommendation = {
      id: `doc_rec_${Date.now()}_${input.userId}`,
      type: 'document',
      title: 'Document Requirements for Your Claim',
      description: this.generateMainDescription(input.claimType, gaps.length),
      confidence: this.calculateConfidence(gaps, required),
      priority: gaps.some(g => g.severity === 'critical') ? 'urgent' : 'high',
      category: 'compliance',
      targetUser: input.userId,
      context: input.context,
      data: {
        gaps,
        requiredDocuments: required,
        optionalDocuments: optional,
        qualityRecommendations: qualityRecs
      },
      metadata: {
        source: 'document_recommendation_engine',
        algorithm: 'rule_based_with_ml',
        version: '1.0.0',
        generatedAt: new Date(),
        personalizedFor: input.userId
      },
      expiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      triggers: [
        {
          condition: 'document_uploaded',
          threshold: 1,
          action: 'refresh_recommendations',
          weight: 1.0
        }
      ],
      documentType: required.length > 0 ? required[0].type : 'medical_report',
      requiredDocuments: required,
      optionalDocuments: optional,
      uploadGuidelines: this.generateUploadGuidelines(required),
      qualityRequirements: this.generateQualityRequirements(required),
      similarCases
    };

    recommendations.push(mainRecommendation);

    // Individual document recommendations for high-priority gaps
    for (const gap of gaps.filter(g => g.severity === 'critical')) {
      const docRecommendation: DocumentRecommendation = {
        id: `doc_gap_${Date.now()}_${gap.type}_${input.userId}`,
        type: 'document',
        title: `Missing Required Document: ${this.getDocumentDisplayName(gap.type)}`,
        description: gap.recommendation,
        confidence: 0.95,
        priority: 'urgent',
        category: 'compliance',
        targetUser: input.userId,
        context: input.context,
        data: { gap, urgentAction: true },
        metadata: {
          source: 'document_gap_analyzer',
          algorithm: 'rule_based',
          version: '1.0.0',
          generatedAt: new Date(),
          personalizedFor: input.userId
        },
        expiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours for urgent
        triggers: [],
        documentType: gap.type,
        requiredDocuments: required.filter(r => r.type === gap.type),
        optionalDocuments: [],
        uploadGuidelines: this.uploadGuidelines.get(gap.type) || [],
        qualityRequirements: this.qualityStandards.get(gap.type) || [],
        similarCases: []
      };

      recommendations.push(docRecommendation);
    }

    return recommendations;
  }

  private generateMainDescription(claimType: string, gapCount: number): string {
    if (gapCount === 0) {
      return `Your ${claimType} claim documentation is complete! Here are some optional documents that could help speed up processing.`;
    } else if (gapCount === 1) {
      return `Your ${claimType} claim is missing 1 required document. Please upload it to proceed with processing.`;
    } else {
      return `Your ${claimType} claim is missing ${gapCount} required documents. Please upload them to proceed with processing.`;
    }
  }

  private calculateConfidence(gaps: DocumentGap[], required: RequiredDocument[]): number {
    if (required.length === 0) return 0.5;
    
    const criticalGaps = gaps.filter(g => g.severity === 'critical').length;
    const totalRequired = required.filter(r => r.urgency === 'urgent' || r.urgency === 'immediate').length;
    
    if (criticalGaps === 0) return 0.95;
    if (criticalGaps <= totalRequired * 0.3) return 0.85;
    if (criticalGaps <= totalRequired * 0.6) return 0.75;
    return 0.65;
  }

  private generateUploadGuidelines(required: RequiredDocument[]): UploadGuideline[] {
    const guidelines: UploadGuideline[] = [
      {
        step: 1,
        instruction: 'Prepare your documents',
        tips: [
          'Gather all required documents before starting',
          'Ensure documents are recent and complete',
          'Check that all signatures and stamps are visible'
        ],
        commonMistakes: [
          'Uploading incomplete documents',
          'Using poor quality images',
          'Missing required signatures'
        ]
      },
      {
        step: 2,
        instruction: 'Scan or photograph documents',
        tips: [
          'Use good lighting and avoid shadows',
          'Keep camera steady to avoid blur',
          'Ensure entire document is visible in frame'
        ],
        commonMistakes: [
          'Blurry or dark images',
          'Cut-off portions of documents',
          'Uploading photos of computer screens'
        ]
      },
      {
        step: 3,
        instruction: 'Upload documents',
        tips: [
          'Use supported file formats (PDF, JPG, PNG)',
          'Keep file sizes under the specified limits',
          'Upload documents in the correct categories'
        ],
        commonMistakes: [
          'Using unsupported file formats',
          'Exceeding file size limits',
          'Uploading to wrong document category'
        ]
      }
    ];

    return guidelines;
  }

  private generateQualityRequirements(required: RequiredDocument[]): QualityRequirement[] {
    return [
      {
        aspect: 'resolution',
        minimum: 300,
        recommended: 600,
        description: 'DPI resolution for clear text reading',
        checkMethod: 'automated_analysis'
      },
      {
        aspect: 'clarity',
        minimum: 0.7,
        recommended: 0.9,
        description: 'Overall image clarity and sharpness',
        checkMethod: 'ml_vision_analysis'
      },
      {
        aspect: 'completeness',
        minimum: 0.95,
        recommended: 1.0,
        description: 'All document content must be visible',
        checkMethod: 'template_matching'
      },
      {
        aspect: 'authenticity',
        minimum: 0.8,
        recommended: 0.95,
        description: 'Document authenticity verification',
        checkMethod: 'digital_forensics'
      }
    ];
  }

  private getDocumentDisplayName(docType: DocumentType): string {
    const names: Record<DocumentType, string> = {
      'medical_report': 'Medical Report',
      'prescription': 'Prescription',
      'invoice': 'Medical Invoice',
      'receipt': 'Payment Receipt',
      'discharge_summary': 'Discharge Summary',
      'lab_result': 'Laboratory Results',
      'diagnostic_image': 'Diagnostic Images',
      'referral_letter': 'Referral Letter',
      'insurance_card': 'Insurance Card',
      'identification': 'Identification Document',
      'consent_form': 'Consent Form',
      'medical_history': 'Medical History'
    };

    return names[docType] || docType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  // Learning and feedback methods
  async learn(feedback: UserFeedback[], options?: any): Promise<any> {
    this.isLearning = true;
    this.emit('learning_started');

    try {
      this.feedbackHistory.push(...feedback);
      
      // Update user patterns based on feedback
      for (const fb of feedback) {
        await this.updateUserPattern(fb);
      }

      // Update performance metrics
      this.updatePerformanceMetrics();

      this.isLearning = false;
      this.emit('learning_completed');
      
      return { success: true, feedbackProcessed: feedback.length };

    } catch (error) {
      this.isLearning = false;
      this.emit('error', error);
      throw error;
    }
  }

  async updateProfile(userId: string, updates: any): Promise<void> {
    // Update user-specific patterns and preferences
    const pattern = this.userDocumentPatterns.get(userId) || this.createDefaultUserPattern(userId);
    
    if (updates.documentPreferences) {
      pattern.preferences = { ...pattern.preferences, ...updates.documentPreferences };
    }
    
    if (updates.uploadBehavior) {
      pattern.uploadBehavior = { ...pattern.uploadBehavior, ...updates.uploadBehavior };
    }

    this.userDocumentPatterns.set(userId, pattern);
  }

  getStatus(): ComponentStatus {
    return {
      isReady: this.isInitialized,
      isLearning: this.isLearning,
      isProcessing: this.isProcessing,
      lastError: this.lastError,
      uptime: Date.now() - this.startTime.getTime(),
      totalRecommendations: this.totalRecommendations,
      lastRecommendation: this.lastRecommendation
    };
  }

  getMetrics(): ComponentPerformance {
    return this.performance;
  }

  // Private utility methods
  private initializePerformance(): ComponentPerformance {
    return {
      accuracy: 0.85,
      precision: 0.82,
      recall: 0.88,
      clickThroughRate: 0.65,
      conversionRate: 0.45,
      userSatisfaction: 4.2,
      responseTime: 150,
      throughput: 100
    };
  }

  private initializeDocumentDatabase(): void {
    // Initialize with sample similar cases
    this.similarCaseDatabase = [
      {
        caseId: 'medical_001',
        similarity: 0.9,
        documentsUsed: ['medical_report', 'invoice', 'prescription'],
        outcome: 'approved',
        processingTime: 3,
        lessons: ['Complete medical reports speed up approval', 'Original prescriptions required for medication claims']
      },
      {
        caseId: 'dental_002',
        similarity: 0.85,
        documentsUsed: ['medical_report', 'diagnostic_image', 'invoice'],
        outcome: 'approved',
        processingTime: 2,
        lessons: ['X-ray images are essential for dental claims', 'Detailed treatment plans help approval']
      },
      {
        caseId: 'emergency_003',
        similarity: 0.8,
        documentsUsed: ['discharge_summary', 'invoice'],
        outcome: 'approved',
        processingTime: 1,
        lessons: ['Emergency discharge summaries are sufficient for urgent claims']
      }
    ];
  }

  private async loadDocumentRequirements(): Promise<void> {
    // Simulate loading from database
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Initialize document requirements for different claim types
    this.documentRequirements.set('medical', [
      { documentType: 'medical_report', mandatory: true, minQuality: 0.8, processingImpact: 'required' },
      { documentType: 'invoice', mandatory: true, minQuality: 0.7, processingImpact: 'required' },
      { documentType: 'prescription', mandatory: false, minQuality: 0.7, processingImpact: 'helpful' }
    ]);

    this.documentRequirements.set('dental', [
      { documentType: 'medical_report', mandatory: true, minQuality: 0.8, processingImpact: 'required' },
      { documentType: 'diagnostic_image', mandatory: true, minQuality: 0.9, processingImpact: 'required' },
      { documentType: 'invoice', mandatory: true, minQuality: 0.7, processingImpact: 'required' }
    ]);
  }

  private async loadQualityStandards(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));
    // Quality standards loaded
  }

  private async loadUploadGuidelines(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));
    // Upload guidelines loaded
  }

  private async loadSimilarCases(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 400));
    // Similar cases loaded from database
  }

  private async loadUserPatterns(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 200));
    // User patterns loaded
  }

  private async updateUserPattern(feedback: UserFeedback): Promise<void> {
    const userId = feedback.userId;
    const pattern = this.userDocumentPatterns.get(userId) || this.createDefaultUserPattern(userId);
    
    // Update based on feedback
    if (feedback.helpful) {
      pattern.successfulRecommendations++;
    } else {
      pattern.rejectedRecommendations++;
    }

    pattern.lastInteraction = feedback.timestamp;
    this.userDocumentPatterns.set(userId, pattern);
  }

  private createDefaultUserPattern(userId: string): UserDocumentPattern {
    return {
      userId,
      preferences: {
        preferredFormats: ['pdf'],
        qualityStandard: 'standard',
        uploadMethod: 'mobile'
      },
      uploadBehavior: {
        averageTime: 300, // seconds
        retryRate: 0.1,
        errorRate: 0.05
      },
      successfulRecommendations: 0,
      rejectedRecommendations: 0,
      lastInteraction: new Date()
    };
  }

  private updatePerformanceMetrics(): void {
    const recentFeedback = this.feedbackHistory.slice(-100); // Last 100 feedback items
    
    if (recentFeedback.length > 0) {
      const helpful = recentFeedback.filter(f => f.helpful).length;
      const accepted = recentFeedback.filter(f => f.action === 'accepted').length;
      
      this.performance.userSatisfaction = helpful / recentFeedback.length * 5;
      this.performance.conversionRate = accepted / recentFeedback.length;
      this.performance.clickThroughRate = recentFeedback.filter(f => f.action !== 'dismissed').length / recentFeedback.length;
    }
  }
}

// Supporting interfaces
interface DocumentGap {
  type: DocumentType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  impact: string;
  recommendation: string;
}

interface DocumentRequirement {
  documentType: DocumentType;
  mandatory: boolean;
  minQuality: number;
  processingImpact: string;
}

interface QualityRecommendation {
  documentType: DocumentType;
  currentQuality: number;
  targetQuality: number;
  improvements: string[];
  impact: string;
}

interface UserDocumentPattern {
  userId: string;
  preferences: {
    preferredFormats: string[];
    qualityStandard: string;
    uploadMethod: string;
  };
  uploadBehavior: {
    averageTime: number;
    retryRate: number;
    errorRate: number;
  };
  successfulRecommendations: number;
  rejectedRecommendations: number;
  lastInteraction: Date;
}
