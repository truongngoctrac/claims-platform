import { EventEmitter } from 'events';
import crypto from 'crypto';

export interface FraudDetectionResult {
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  suspiciousActivities: SuspiciousActivity[];
  fraudIndicators: FraudIndicator[];
  recommendations: FraudRecommendation[];
  confidence: number;
  metadata: {
    processingTime: number;
    detectorVersion: string;
    rulesApplied: number;
    modelVersion: string;
  };
}

export interface SuspiciousActivity {
  type: SuspiciousActivityType;
  severity: 'low' | 'medium' | 'high' | 'critical';
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
  priority: 'low' | 'medium' | 'high' | 'urgent';
  action: string;
  description: string;
  automated: boolean;
}

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

export interface FraudRule {
  id: string;
  name: string;
  category: FraudCategory;
  description: string;
  enabled: boolean;
  weight: number;
  threshold: number;
  check: (document: any, extractedData: any, metadata: any, history: any[]) => Promise<FraudIndicator[]>;
}

export interface DocumentFingerprint {
  structuralHash: string;
  contentHash: string;
  visualHash: string;
  metadataHash: string;
  similarityScore: number;
}

export interface FraudPattern {
  id: string;
  name: string;
  description: string;
  indicators: string[];
  riskScore: number;
  examples: any[];
}

export class FraudDetectionService extends EventEmitter {
  private fraudRules: FraudRule[] = [];
  private documentHistory: Map<string, any[]> = new Map();
  private blacklistedEntities: Set<string> = new Set();
  private fraudPatterns: FraudPattern[] = [];
  private documentFingerprints: Map<string, DocumentFingerprint> = new Map();
  private riskThresholds = {
    low: 25,
    medium: 50,
    high: 75,
    critical: 90
  };

  constructor() {
    super();
    this.initializeFraudRules();
    this.initializeFraudPatterns();
    this.initializeBlacklists();
  }

  private initializeFraudRules(): void {
    this.fraudRules = [
      {
        id: 'duplicate_document_check',
        name: 'Duplicate Document Detection',
        category: 'document_authenticity',
        description: 'Detect identical or near-identical documents',
        enabled: true,
        weight: 0.3,
        threshold: 0.9,
        check: async (document, extractedData, metadata, history) => {
          const indicators: FraudIndicator[] = [];
          
          // Generate document fingerprint
          const fingerprint = await this.generateDocumentFingerprint(document, extractedData);
          
          // Check against existing fingerprints
          for (const [docId, existingFingerprint] of this.documentFingerprints.entries()) {
            const similarity = this.calculateSimilarity(fingerprint, existingFingerprint);
            
            if (similarity > this.fraudRules.find(r => r.id === 'duplicate_document_check')!.threshold) {
              indicators.push({
                category: 'document_authenticity',
                indicator: 'duplicate_document',
                value: similarity,
                threshold: 0.9,
                exceeded: true,
                weight: 0.3
              });
              break;
            }
          }
          
          // Store fingerprint for future comparisons
          this.documentFingerprints.set(metadata.documentId || 'unknown', fingerprint);
          
          return indicators;
        }
      },
      {
        id: 'amount_manipulation_check',
        name: 'Amount Manipulation Detection',
        category: 'data_integrity',
        description: 'Detect manipulated monetary amounts',
        enabled: true,
        weight: 0.4,
        threshold: 2.0,
        check: async (document, extractedData, metadata, history) => {
          const indicators: FraudIndicator[] = [];
          
          if (extractedData.totalAmount) {
            const amount = parseFloat(extractedData.totalAmount.toString().replace(/[^0-9.]/g, ''));
            
            // Check for unusual amount patterns
            const amountStr = amount.toString();
            
            // Detect round numbers (possible manipulation)
            if (amount > 1000000 && amountStr.endsWith('000000')) {
              indicators.push({
                category: 'data_integrity',
                indicator: 'suspicious_round_amount',
                value: amount,
                threshold: 1000000,
                exceeded: true,
                weight: 0.2
              });
            }
            
            // Check against historical amounts for same provider
            const providerHistory = history.filter(h => 
              h.extractedData.hospitalName === extractedData.hospitalName ||
              h.extractedData.labName === extractedData.labName
            );
            
            if (providerHistory.length > 0) {
              const avgAmount = providerHistory.reduce((sum, h) => {
                const amt = parseFloat(h.extractedData.totalAmount?.toString().replace(/[^0-9.]/g, '') || '0');
                return sum + amt;
              }, 0) / providerHistory.length;
              
              const deviationRatio = amount / avgAmount;
              
              if (deviationRatio > 5 || deviationRatio < 0.2) {
                indicators.push({
                  category: 'data_integrity',
                  indicator: 'amount_deviation',
                  value: deviationRatio,
                  threshold: 2.0,
                  exceeded: true,
                  weight: 0.3
                });
              }
            }
          }
          
          return indicators;
        }
      },
      {
        id: 'date_manipulation_check',
        name: 'Date Manipulation Detection',
        category: 'temporal_analysis',
        description: 'Detect manipulated or suspicious dates',
        enabled: true,
        weight: 0.3,
        threshold: 1.0,
        check: async (document, extractedData, metadata, history) => {
          const indicators: FraudIndicator[] = [];
          
          // Check for future dates
          const billDate = new Date(extractedData.billDate || extractedData.prescriptionDate || extractedData.testDate);
          const now = new Date();
          
          if (billDate > now) {
            indicators.push({
              category: 'temporal_analysis',
              indicator: 'future_date',
              value: billDate,
              threshold: now,
              exceeded: true,
              weight: 0.4
            });
          }
          
          // Check for suspicious date patterns (e.g., same date for multiple documents)
          const sameDate = history.filter(h => {
            const hDate = new Date(h.extractedData.billDate || h.extractedData.prescriptionDate || h.extractedData.testDate);
            return Math.abs(billDate.getTime() - hDate.getTime()) < 24 * 60 * 60 * 1000; // Same day
          });
          
          if (sameDate.length > 3) {
            indicators.push({
              category: 'temporal_analysis',
              indicator: 'duplicate_dates',
              value: sameDate.length,
              threshold: 3,
              exceeded: true,
              weight: 0.2
            });
          }
          
          // Check for weekend/holiday service dates (suspicious for some services)
          const dayOfWeek = billDate.getDay();
          if ((dayOfWeek === 0 || dayOfWeek === 6) && extractedData.documentType === 'lab_result') {
            indicators.push({
              category: 'temporal_analysis',
              indicator: 'weekend_service',
              value: dayOfWeek,
              threshold: 6,
              exceeded: false,
              weight: 0.1
            });
          }
          
          return indicators;
        }
      },
      {
        id: 'identity_verification_check',
        name: 'Identity Verification',
        category: 'identity_verification',
        description: 'Verify patient and provider identities',
        enabled: true,
        weight: 0.5,
        threshold: 0.8,
        check: async (document, extractedData, metadata, history) => {
          const indicators: FraudIndicator[] = [];
          
          // Check if patient name appears in blacklist
          const patientName = extractedData.patientName?.toLowerCase();
          if (patientName && this.blacklistedEntities.has(patientName)) {
            indicators.push({
              category: 'identity_verification',
              indicator: 'blacklisted_patient',
              value: patientName,
              threshold: 'blacklist',
              exceeded: true,
              weight: 0.8
            });
          }
          
          // Check for identity inconsistencies across documents
          const patientHistory = history.filter(h => 
            h.extractedData.patientName?.toLowerCase() === patientName
          );
          
          if (patientHistory.length > 0) {
            // Check for different hospitals for same patient in short time
            const recentHistory = patientHistory.filter(h => {
              const hDate = new Date(h.extractedData.billDate || h.extractedData.prescriptionDate);
              const docDate = new Date(extractedData.billDate || extractedData.prescriptionDate);
              return Math.abs(docDate.getTime() - hDate.getTime()) < 7 * 24 * 60 * 60 * 1000; // 7 days
            });
            
            const uniqueHospitals = new Set(recentHistory.map(h => h.extractedData.hospitalName));
            if (uniqueHospitals.size > 3) {
              indicators.push({
                category: 'identity_verification',
                indicator: 'multiple_hospitals',
                value: uniqueHospitals.size,
                threshold: 3,
                exceeded: true,
                weight: 0.3
              });
            }
          }
          
          return indicators;
        }
      },
      {
        id: 'document_structure_analysis',
        name: 'Document Structure Analysis',
        category: 'document_authenticity',
        description: 'Analyze document structure for authenticity',
        enabled: true,
        weight: 0.4,
        threshold: 0.7,
        check: async (document, extractedData, metadata, history) => {
          const indicators: FraudIndicator[] = [];
          
          // Check for required fields based on document type
          const requiredFields = this.getRequiredFields(extractedData.documentType);
          const missingFields = requiredFields.filter(field => !extractedData[field]);
          
          if (missingFields.length > 0) {
            indicators.push({
              category: 'document_authenticity',
              indicator: 'missing_required_fields',
              value: missingFields.length,
              threshold: 0,
              exceeded: true,
              weight: 0.3
            });
          }
          
          // Check for suspicious formatting patterns
          if (extractedData.billNumber && !/^[A-Z]{2,4}\d{6,12}$/.test(extractedData.billNumber)) {
            indicators.push({
              category: 'document_authenticity',
              indicator: 'invalid_bill_format',
              value: extractedData.billNumber,
              threshold: 'valid_format',
              exceeded: true,
              weight: 0.2
            });
          }
          
          return indicators;
        }
      },
      {
        id: 'behavioral_pattern_analysis',
        name: 'Behavioral Pattern Analysis',
        category: 'behavioral_analysis',
        description: 'Detect unusual behavioral patterns',
        enabled: true,
        weight: 0.3,
        threshold: 3.0,
        check: async (document, extractedData, metadata, history) => {
          const indicators: FraudIndicator[] = [];
          
          // Analyze submission frequency
          const userHistory = history.filter(h => h.metadata.uploadedBy === metadata.uploadedBy);
          
          if (userHistory.length > 0) {
            // Check for bulk submissions
            const recentSubmissions = userHistory.filter(h => {
              const hDate = new Date(h.metadata.uploadedAt);
              const now = new Date();
              return (now.getTime() - hDate.getTime()) < 24 * 60 * 60 * 1000; // Last 24 hours
            });
            
            if (recentSubmissions.length > 10) {
              indicators.push({
                category: 'behavioral_analysis',
                indicator: 'bulk_submission',
                value: recentSubmissions.length,
                threshold: 10,
                exceeded: true,
                weight: 0.4
              });
            }
            
            // Check for unusual timing patterns
            const submissionHours = userHistory.map(h => new Date(h.metadata.uploadedAt).getHours());
            const nightSubmissions = submissionHours.filter(hour => hour < 6 || hour > 22).length;
            const nightSubmissionRatio = nightSubmissions / submissionHours.length;
            
            if (nightSubmissionRatio > 0.7 && userHistory.length > 5) {
              indicators.push({
                category: 'behavioral_analysis',
                indicator: 'unusual_timing',
                value: nightSubmissionRatio,
                threshold: 0.7,
                exceeded: true,
                weight: 0.2
              });
            }
          }
          
          return indicators;
        }
      }
    ];
  }

  private initializeFraudPatterns(): void {
    this.fraudPatterns = [
      {
        id: 'fake_prescription_pattern',
        name: 'Fake Prescription Pattern',
        description: 'Common patterns found in fraudulent prescriptions',
        indicators: [
          'missing_doctor_license',
          'invalid_prescription_format',
          'suspicious_medication_combination',
          'altered_dosage'
        ],
        riskScore: 85,
        examples: []
      },
      {
        id: 'inflated_bill_pattern',
        name: 'Inflated Medical Bill Pattern',
        description: 'Patterns indicating artificially inflated medical bills',
        indicators: [
          'excessive_amount',
          'duplicate_services',
          'non_existent_procedures',
          'round_number_amounts'
        ],
        riskScore: 90,
        examples: []
      },
      {
        id: 'identity_fraud_pattern',
        name: 'Identity Fraud Pattern',
        description: 'Patterns indicating stolen or fake identity usage',
        indicators: [
          'blacklisted_patient',
          'inconsistent_personal_data',
          'multiple_identities',
          'suspicious_location_changes'
        ],
        riskScore: 95,
        examples: []
      }
    ];
  }

  private initializeBlacklists(): void {
    // Mock blacklisted entities
    const blacklistedNames = [
      'nguyễn văn fake',
      'trần thị fraud',
      'lê văn scam',
      'phạm thị test'
    ];
    
    blacklistedNames.forEach(name => this.blacklistedEntities.add(name));
  }

  async detectFraud(
    documentBuffer: Buffer,
    extractedData: any,
    metadata: any = {}
  ): Promise<FraudDetectionResult> {
    const startTime = Date.now();

    try {
      const suspiciousActivities: SuspiciousActivity[] = [];
      const fraudIndicators: FraudIndicator[] = [];
      const recommendations: FraudRecommendation[] = [];

      // Get historical data for comparison
      const history = Array.from(this.documentHistory.values()).flat();

      // Run fraud detection rules
      let totalWeight = 0;
      let totalScore = 0;

      for (const rule of this.fraudRules.filter(r => r.enabled)) {
        try {
          const indicators = await rule.check(documentBuffer, extractedData, metadata, history);
          fraudIndicators.push(...indicators);

          // Calculate weighted score contribution
          const ruleScore = indicators.reduce((score, indicator) => {
            return score + (indicator.exceeded ? indicator.weight * 100 : 0);
          }, 0);

          totalScore += ruleScore * rule.weight;
          totalWeight += rule.weight;

          // Generate suspicious activities
          indicators.forEach(indicator => {
            if (indicator.exceeded) {
              suspiciousActivities.push({
                type: this.mapIndicatorToActivity(indicator.indicator),
                severity: this.calculateSeverity(indicator.weight),
                description: this.generateActivityDescription(indicator),
                evidence: [indicator],
                confidence: 0.8,
                riskContribution: indicator.weight * 100
              });
            }
          });

        } catch (error) {
          console.error(`Error executing fraud rule ${rule.id}:`, error);
        }
      }

      // Normalize risk score
      const riskScore = totalWeight > 0 ? Math.min(100, totalScore / totalWeight) : 0;
      const riskLevel = this.calculateRiskLevel(riskScore);

      // Pattern analysis
      const detectedPatterns = await this.analyzePatterns(fraudIndicators, extractedData);
      detectedPatterns.forEach(pattern => {
        suspiciousActivities.push({
          type: 'unusual_pattern',
          severity: 'high',
          description: `Detected fraud pattern: ${pattern.name}`,
          evidence: pattern.indicators,
          confidence: 0.9,
          riskContribution: pattern.riskScore
        });
      });

      // Generate recommendations
      recommendations.push(...await this.generateRecommendations(riskLevel, suspiciousActivities, fraudIndicators));

      // Calculate overall confidence
      const avgConfidence = suspiciousActivities.length > 0 
        ? suspiciousActivities.reduce((sum, activity) => sum + activity.confidence, 0) / suspiciousActivities.length
        : 1.0;

      const result: FraudDetectionResult = {
        riskScore,
        riskLevel,
        suspiciousActivities,
        fraudIndicators,
        recommendations,
        confidence: avgConfidence,
        metadata: {
          processingTime: Date.now() - startTime,
          detectorVersion: '2.1.0',
          rulesApplied: this.fraudRules.filter(r => r.enabled).length,
          modelVersion: '1.0.0'
        }
      };

      // Store document history
      const documentId = metadata.documentId || crypto.randomUUID();
      if (!this.documentHistory.has(documentId)) {
        this.documentHistory.set(documentId, []);
      }
      this.documentHistory.get(documentId)!.push({
        extractedData,
        metadata: { ...metadata, analysisDate: new Date() },
        fraudResult: result
      });

      this.emit('fraudAnalysisCompleted', {
        riskScore,
        riskLevel,
        suspiciousActivitiesCount: suspiciousActivities.length,
        processingTime: result.metadata.processingTime
      });

      return result;

    } catch (error) {
      this.emit('fraudAnalysisError', { error: error.message });
      throw new Error(`Fraud detection failed: ${error.message}`);
    }
  }

  private async generateDocumentFingerprint(
    documentBuffer: Buffer,
    extractedData: any
  ): Promise<DocumentFingerprint> {
    
    // Generate structural hash based on document layout
    const structuralFeatures = {
      fieldCount: Object.keys(extractedData).length,
      hasTable: !!extractedData.services || !!extractedData.results,
      hasSignature: !!extractedData.signature,
      pageCount: 1 // Simplified
    };
    const structuralHash = crypto.createHash('md5')
      .update(JSON.stringify(structuralFeatures))
      .digest('hex');

    // Generate content hash based on extracted text
    const contentText = Object.values(extractedData)
      .filter(value => typeof value === 'string')
      .join(' ')
      .replace(/\d+/g, 'X') // Replace numbers to focus on structure
      .toLowerCase();
    const contentHash = crypto.createHash('md5')
      .update(contentText)
      .digest('hex');

    // Generate visual hash based on document image (simplified)
    const visualHash = crypto.createHash('md5')
      .update(documentBuffer.slice(0, 1024)) // Use first 1KB for quick comparison
      .digest('hex');

    // Generate metadata hash
    const metadataFeatures = {
      documentType: extractedData.documentType,
      hasLogo: extractedData.hasLogo,
      language: extractedData.language || 'vie'
    };
    const metadataHash = crypto.createHash('md5')
      .update(JSON.stringify(metadataFeatures))
      .digest('hex');

    return {
      structuralHash,
      contentHash,
      visualHash,
      metadataHash,
      similarityScore: 0
    };
  }

  private calculateSimilarity(fp1: DocumentFingerprint, fp2: DocumentFingerprint): number {
    let similarity = 0;
    let weights = 0;

    // Compare structural similarity
    if (fp1.structuralHash === fp2.structuralHash) {
      similarity += 0.3;
    }
    weights += 0.3;

    // Compare content similarity
    if (fp1.contentHash === fp2.contentHash) {
      similarity += 0.4;
    }
    weights += 0.4;

    // Compare visual similarity
    if (fp1.visualHash === fp2.visualHash) {
      similarity += 0.2;
    }
    weights += 0.2;

    // Compare metadata similarity
    if (fp1.metadataHash === fp2.metadataHash) {
      similarity += 0.1;
    }
    weights += 0.1;

    return weights > 0 ? similarity / weights : 0;
  }

  private getRequiredFields(documentType: string): string[] {
    switch (documentType) {
      case 'medical_bill':
        return ['hospitalName', 'billNumber', 'billDate', 'patientName', 'totalAmount'];
      case 'prescription':
        return ['doctorName', 'patientName', 'prescriptionDate', 'medications'];
      case 'lab_result':
        return ['labName', 'patientName', 'testDate', 'results'];
      default:
        return ['patientName'];
    }
  }

  private mapIndicatorToActivity(indicator: string): SuspiciousActivityType {
    const mapping: Record<string, SuspiciousActivityType> = {
      'duplicate_document': 'duplicate_document',
      'suspicious_round_amount': 'amount_manipulation',
      'amount_deviation': 'amount_manipulation',
      'future_date': 'date_manipulation',
      'duplicate_dates': 'date_manipulation',
      'blacklisted_patient': 'identity_mismatch',
      'multiple_hospitals': 'behavioral_anomaly',
      'missing_required_fields': 'fake_document',
      'invalid_bill_format': 'altered_document',
      'bulk_submission': 'behavioral_anomaly',
      'unusual_timing': 'behavioral_anomaly'
    };

    return mapping[indicator] || 'inconsistent_data';
  }

  private calculateSeverity(weight: number): SuspiciousActivity['severity'] {
    if (weight >= 0.7) return 'critical';
    if (weight >= 0.5) return 'high';
    if (weight >= 0.3) return 'medium';
    return 'low';
  }

  private generateActivityDescription(indicator: FraudIndicator): string {
    const descriptions: Record<string, string> = {
      'duplicate_document': `Document appears to be a duplicate (similarity: ${(indicator.value * 100).toFixed(1)}%)`,
      'suspicious_round_amount': `Suspicious round amount detected: ${indicator.value} VND`,
      'amount_deviation': `Amount deviates significantly from average (ratio: ${indicator.value.toFixed(2)})`,
      'future_date': `Document dated in the future: ${indicator.value}`,
      'duplicate_dates': `Multiple documents with same date detected (${indicator.value} documents)`,
      'blacklisted_patient': `Patient name matches blacklist: ${indicator.value}`,
      'multiple_hospitals': `Patient visited ${indicator.value} different hospitals in short period`,
      'missing_required_fields': `${indicator.value} required fields are missing`,
      'invalid_bill_format': `Bill number format is invalid: ${indicator.value}`,
      'bulk_submission': `Bulk document submission detected (${indicator.value} documents in 24h)`,
      'unusual_timing': `Unusual submission timing pattern (${(indicator.value * 100).toFixed(1)}% night submissions)`
    };

    return descriptions[indicator.indicator] || `Suspicious indicator: ${indicator.indicator}`;
  }

  private calculateRiskLevel(riskScore: number): FraudDetectionResult['riskLevel'] {
    if (riskScore >= this.riskThresholds.critical) return 'critical';
    if (riskScore >= this.riskThresholds.high) return 'high';
    if (riskScore >= this.riskThresholds.medium) return 'medium';
    return 'low';
  }

  private async analyzePatterns(
    fraudIndicators: FraudIndicator[],
    extractedData: any
  ): Promise<FraudPattern[]> {
    const detectedPatterns: FraudPattern[] = [];
    const indicatorNames = fraudIndicators.map(i => i.indicator);

    for (const pattern of this.fraudPatterns) {
      const matchCount = pattern.indicators.filter(indicator => 
        indicatorNames.includes(indicator)
      ).length;

      const matchRatio = matchCount / pattern.indicators.length;
      
      if (matchRatio >= 0.6) { // 60% pattern match threshold
        detectedPatterns.push({
          ...pattern,
          riskScore: pattern.riskScore * matchRatio
        });
      }
    }

    return detectedPatterns;
  }

  private async generateRecommendations(
    riskLevel: FraudDetectionResult['riskLevel'],
    suspiciousActivities: SuspiciousActivity[],
    fraudIndicators: FraudIndicator[]
  ): Promise<FraudRecommendation[]> {
    const recommendations: FraudRecommendation[] = [];

    switch (riskLevel) {
      case 'critical':
        recommendations.push({
          priority: 'urgent',
          action: 'immediate_review',
          description: 'Document requires immediate manual review by fraud specialist',
          automated: false
        });
        recommendations.push({
          priority: 'urgent',
          action: 'flag_account',
          description: 'Flag submitter account for additional scrutiny',
          automated: true
        });
        break;

      case 'high':
        recommendations.push({
          priority: 'high',
          action: 'manual_verification',
          description: 'Require manual verification of suspicious elements',
          automated: false
        });
        recommendations.push({
          priority: 'high',
          action: 'additional_documentation',
          description: 'Request additional supporting documentation',
          automated: false
        });
        break;

      case 'medium':
        recommendations.push({
          priority: 'medium',
          action: 'enhanced_monitoring',
          description: 'Apply enhanced monitoring to this account',
          automated: true
        });
        recommendations.push({
          priority: 'medium',
          action: 'automated_verification',
          description: 'Run additional automated verification checks',
          automated: true
        });
        break;

      case 'low':
        recommendations.push({
          priority: 'low',
          action: 'routine_processing',
          description: 'Continue with routine processing',
          automated: true
        });
        break;
    }

    // Specific recommendations based on detected activities
    suspiciousActivities.forEach(activity => {
      switch (activity.type) {
        case 'duplicate_document':
          recommendations.push({
            priority: 'high',
            action: 'duplicate_investigation',
            description: 'Investigate potential duplicate submission',
            automated: false
          });
          break;

        case 'identity_mismatch':
          recommendations.push({
            priority: 'high',
            action: 'identity_verification',
            description: 'Verify patient identity with additional documentation',
            automated: false
          });
          break;

        case 'amount_manipulation':
          recommendations.push({
            priority: 'medium',
            action: 'amount_verification',
            description: 'Verify amount with healthcare provider',
            automated: false
          });
          break;
      }
    });

    return recommendations;
  }

  // Batch fraud detection
  async detectBatchFraud(
    documents: Array<{
      documentBuffer: Buffer;
      extractedData: any;
      metadata?: any;
    }>
  ): Promise<FraudDetectionResult[]> {
    const results = await Promise.all(
      documents.map(doc => 
        this.detectFraud(doc.documentBuffer, doc.extractedData, doc.metadata)
      )
    );

    this.emit('batchFraudAnalysisCompleted', {
      totalDocuments: documents.length,
      highRiskDocuments: results.filter(r => r.riskLevel === 'high' || r.riskLevel === 'critical').length,
      averageRiskScore: results.reduce((sum, r) => sum + r.riskScore, 0) / results.length
    });

    return results;
  }

  // Rule management
  async addFraudRule(rule: FraudRule): Promise<void> {
    this.fraudRules.push(rule);
    this.emit('ruleAdded', { ruleId: rule.id, ruleName: rule.name });
  }

  async enableRule(ruleId: string): Promise<void> {
    const rule = this.fraudRules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = true;
      this.emit('ruleEnabled', { ruleId });
    }
  }

  async disableRule(ruleId: string): Promise<void> {
    const rule = this.fraudRules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = false;
      this.emit('ruleDisabled', { ruleId });
    }
  }

  // Blacklist management
  async addToBlacklist(entity: string): Promise<void> {
    this.blacklistedEntities.add(entity.toLowerCase());
    this.emit('entityBlacklisted', { entity });
  }

  async removeFromBlacklist(entity: string): Promise<void> {
    this.blacklistedEntities.delete(entity.toLowerCase());
    this.emit('entityRemovedFromBlacklist', { entity });
  }

  getBlacklistedEntities(): string[] {
    return Array.from(this.blacklistedEntities);
  }

  // Analytics
  getFraudStatistics(): any {
    const allResults = Array.from(this.documentHistory.values())
      .flat()
      .map(h => h.fraudResult)
      .filter(Boolean);

    if (allResults.length === 0) {
      return { totalAnalyses: 0 };
    }

    const riskLevelCounts = allResults.reduce((counts, result) => {
      counts[result.riskLevel] = (counts[result.riskLevel] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    const avgRiskScore = allResults.reduce((sum, result) => sum + result.riskScore, 0) / allResults.length;

    const suspiciousActivityTypes = allResults
      .flatMap(result => result.suspiciousActivities)
      .reduce((counts, activity) => {
        counts[activity.type] = (counts[activity.type] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);

    return {
      totalAnalyses: allResults.length,
      riskLevelDistribution: riskLevelCounts,
      averageRiskScore: avgRiskScore,
      suspiciousActivityTypes,
      detectionRate: (allResults.length - riskLevelCounts.low || 0) / allResults.length,
      averageProcessingTime: allResults.reduce((sum, r) => sum + r.metadata.processingTime, 0) / allResults.length
    };
  }

  // Configuration
  updateRiskThresholds(thresholds: Partial<typeof this.riskThresholds>): void {
    this.riskThresholds = { ...this.riskThresholds, ...thresholds };
    this.emit('thresholdsUpdated', { thresholds: this.riskThresholds });
  }

  getFraudRules(): FraudRule[] {
    return [...this.fraudRules];
  }

  getFraudPatterns(): FraudPattern[] {
    return [...this.fraudPatterns];
  }

  getRiskThresholds(): typeof this.riskThresholds {
    return { ...this.riskThresholds };
  }
}
