import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { IdentityVerificationConfig, IntegrationResponse } from '../types';
import { IntegrationConfigManager } from '../config/IntegrationConfig';
import { RateLimitManager } from '../utils/RateLimitManager';
import { RetryManager } from '../utils/RetryManager';

export interface IdentityDocument {
  type: 'national_id' | 'passport' | 'driving_license' | 'insurance_card';
  frontImage: string; // Base64 encoded
  backImage?: string; // Base64 encoded
  number: string;
  issuedDate?: string;
  expiryDate?: string;
  issuer?: string;
}

export interface PersonalInfo {
  fullName: string;
  dateOfBirth: string;
  gender?: 'M' | 'F';
  nationality?: string;
  placeOfBirth?: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
}

export interface VerificationRequest {
  document: IdentityDocument;
  personalInfo: PersonalInfo;
  verificationLevel: 'basic' | 'enhanced' | 'premium';
  purpose: 'insurance_claim' | 'account_opening' | 'identity_check';
}

export interface VerificationResult {
  verificationId: string;
  status: 'verified' | 'failed' | 'pending' | 'requires_manual_review';
  confidence: number;
  verificationLevel: string;
  timestamp: Date;
  details: {
    documentVerification: DocumentVerificationResult;
    personalInfoVerification: PersonalInfoVerificationResult;
    crossChecks: CrossCheckResult[];
    warnings: string[];
    riskScore: number;
  };
}

export interface DocumentVerificationResult {
  isAuthentic: boolean;
  confidence: number;
  checks: {
    formatValidation: boolean;
    checksumValidation: boolean;
    securityFeatures: boolean;
    imageQuality: boolean;
    tamperingDetection: boolean;
  };
  extractedData: {
    documentNumber: string;
    fullName: string;
    dateOfBirth: string;
    issuedDate: string;
    expiryDate: string;
    issuer: string;
  };
}

export interface PersonalInfoVerificationResult {
  nameMatch: boolean;
  dateOfBirthMatch: boolean;
  addressMatch?: boolean;
  phoneNumberMatch?: boolean;
  overallMatch: number; // percentage
}

export interface CrossCheckResult {
  source: string;
  type: 'government_database' | 'blacklist' | 'previous_verification';
  status: 'verified' | 'not_found' | 'mismatch' | 'error';
  details?: string;
}

export interface BiometricVerification {
  faceImage: string; // Base64 encoded
  documentFaceMatch: boolean;
  livenessCheck: boolean;
  confidence: number;
}

export class IdentityVerificationService {
  private configManager: IntegrationConfigManager;
  private rateLimitManager: RateLimitManager;
  private retryManager: RetryManager;
  private civicIdClient?: AxiosInstance;

  constructor() {
    this.configManager = IntegrationConfigManager.getInstance();
    this.rateLimitManager = new RateLimitManager();
    this.retryManager = new RetryManager();
    this.initializeClients();
  }

  private initializeClients(): void {
    const config = this.configManager.getConfig<IdentityVerificationConfig>('identity-civic');
    
    if (config?.enabled && config.apiKey) {
      this.civicIdClient = axios.create({
        baseURL: config.baseUrl,
        timeout: config.timeout,
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'X-API-Version': '2024-01'
        }
      });
    }
  }

  public async verifyIdentity(
    request: VerificationRequest
  ): Promise<IntegrationResponse<VerificationResult>> {
    const requestId = crypto.randomUUID();
    
    try {
      const config = this.configManager.getConfig<IdentityVerificationConfig>('identity-civic');
      if (!config?.enabled) {
        throw new Error('Identity verification service is not enabled');
      }

      await this.rateLimitManager.checkRateLimit('identity-civic', requestId);

      const result = await this.retryManager.executeWithRetry(
        () => this.executeVerification(request, requestId),
        'identity-civic'
      );

      return {
        success: true,
        data: result,
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Identity verification failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  private async executeVerification(
    request: VerificationRequest,
    verificationId: string
  ): Promise<VerificationResult> {
    // Step 1: Document verification
    const documentResult = await this.verifyDocument(request.document);
    
    // Step 2: Personal info verification
    const personalInfoResult = await this.verifyPersonalInfo(
      request.personalInfo,
      documentResult.extractedData
    );
    
    // Step 3: Cross-checks with external databases
    const crossChecks = await this.performCrossChecks(
      request.document,
      request.personalInfo,
      request.verificationLevel
    );
    
    // Step 4: Calculate overall confidence and risk score
    const confidence = this.calculateOverallConfidence(
      documentResult,
      personalInfoResult,
      crossChecks
    );
    
    const riskScore = this.calculateRiskScore(
      documentResult,
      personalInfoResult,
      crossChecks
    );
    
    // Step 5: Determine verification status
    const status = this.determineVerificationStatus(confidence, riskScore);
    
    const warnings = this.generateWarnings(documentResult, personalInfoResult, crossChecks);

    return {
      verificationId,
      status,
      confidence,
      verificationLevel: request.verificationLevel,
      timestamp: new Date(),
      details: {
        documentVerification: documentResult,
        personalInfoVerification: personalInfoResult,
        crossChecks,
        warnings,
        riskScore
      }
    };
  }

  private async verifyDocument(document: IdentityDocument): Promise<DocumentVerificationResult> {
    if (!this.civicIdClient) {
      throw new Error('Civic ID client not initialized');
    }

    const payload = {
      document_type: document.type,
      front_image: document.frontImage,
      back_image: document.backImage,
      document_number: document.number,
      checks: [
        'format_validation',
        'checksum_validation',
        'security_features',
        'image_quality',
        'tampering_detection'
      ]
    };

    const response = await this.civicIdClient.post('/verify/document', payload);
    
    if (response.data.status !== 'success') {
      throw new Error(`Document verification failed: ${response.data.message}`);
    }

    const result = response.data.result;
    
    return {
      isAuthentic: result.authentic === true,
      confidence: result.confidence || 0,
      checks: {
        formatValidation: result.checks.format_validation === 'pass',
        checksumValidation: result.checks.checksum_validation === 'pass',
        securityFeatures: result.checks.security_features === 'pass',
        imageQuality: result.checks.image_quality === 'pass',
        tamperingDetection: result.checks.tampering_detection === 'pass'
      },
      extractedData: {
        documentNumber: result.extracted_data.document_number || document.number,
        fullName: result.extracted_data.full_name || '',
        dateOfBirth: result.extracted_data.date_of_birth || '',
        issuedDate: result.extracted_data.issued_date || document.issuedDate || '',
        expiryDate: result.extracted_data.expiry_date || document.expiryDate || '',
        issuer: result.extracted_data.issuer || document.issuer || ''
      }
    };
  }

  private async verifyPersonalInfo(
    providedInfo: PersonalInfo,
    extractedData: DocumentVerificationResult['extractedData']
  ): Promise<PersonalInfoVerificationResult> {
    // Compare provided information with extracted document data
    const nameMatch = this.compareNames(providedInfo.fullName, extractedData.fullName);
    const dateOfBirthMatch = this.compareDates(providedInfo.dateOfBirth, extractedData.dateOfBirth);
    
    let matchCount = 0;
    let totalChecks = 2;
    
    if (nameMatch) matchCount++;
    if (dateOfBirthMatch) matchCount++;
    
    // Additional checks if phone verification service is available
    let phoneNumberMatch: boolean | undefined;
    if (providedInfo.phoneNumber) {
      phoneNumberMatch = await this.verifyPhoneNumber(providedInfo.phoneNumber);
      if (phoneNumberMatch !== undefined) {
        totalChecks++;
        if (phoneNumberMatch) matchCount++;
      }
    }
    
    const overallMatch = (matchCount / totalChecks) * 100;

    return {
      nameMatch,
      dateOfBirthMatch,
      phoneNumberMatch,
      overallMatch
    };
  }

  private compareNames(provided: string, extracted: string): boolean {
    if (!provided || !extracted) return false;
    
    // Normalize names (remove accents, convert to lowercase, remove extra spaces)
    const normalize = (name: string) => {
      return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/\s+/g, ' ')
        .trim();
    };
    
    const normalizedProvided = normalize(provided);
    const normalizedExtracted = normalize(extracted);
    
    // Check for exact match
    if (normalizedProvided === normalizedExtracted) return true;
    
    // Check for partial match (allowing for different name orders)
    const providedWords = normalizedProvided.split(' ');
    const extractedWords = normalizedExtracted.split(' ');
    
    const commonWords = providedWords.filter(word => 
      extractedWords.some(extractedWord => 
        extractedWord.includes(word) || word.includes(extractedWord)
      )
    );
    
    // Require at least 60% overlap
    return commonWords.length / Math.max(providedWords.length, extractedWords.length) >= 0.6;
  }

  private compareDates(provided: string, extracted: string): boolean {
    if (!provided || !extracted) return false;
    
    try {
      const providedDate = new Date(provided);
      const extractedDate = new Date(extracted);
      
      return providedDate.getTime() === extractedDate.getTime();
    } catch {
      return false;
    }
  }

  private async verifyPhoneNumber(phoneNumber: string): Promise<boolean | undefined> {
    try {
      // This would integrate with a phone verification service
      // For now, just basic format validation
      const phoneRegex = /^(\+84|84|0)[1-9][0-9]{8}$/;
      return phoneRegex.test(phoneNumber.replace(/\s+/g, ''));
    } catch {
      return undefined;
    }
  }

  private async performCrossChecks(
    document: IdentityDocument,
    personalInfo: PersonalInfo,
    verificationLevel: string
  ): Promise<CrossCheckResult[]> {
    const crossChecks: CrossCheckResult[] = [];
    
    // Government database check (simulation)
    if (verificationLevel === 'enhanced' || verificationLevel === 'premium') {
      try {
        const govCheck = await this.checkGovernmentDatabase(document.number, document.type);
        crossChecks.push(govCheck);
      } catch (error) {
        crossChecks.push({
          source: 'Government Database',
          type: 'government_database',
          status: 'error',
          details: 'Unable to connect to government database'
        });
      }
    }
    
    // Blacklist check
    try {
      const blacklistCheck = await this.checkBlacklist(document.number, personalInfo.fullName);
      crossChecks.push(blacklistCheck);
    } catch (error) {
      crossChecks.push({
        source: 'Blacklist Database',
        type: 'blacklist',
        status: 'error',
        details: 'Unable to check blacklist'
      });
    }
    
    // Previous verification check
    if (verificationLevel === 'premium') {
      try {
        const previousCheck = await this.checkPreviousVerifications(document.number);
        crossChecks.push(previousCheck);
      } catch (error) {
        crossChecks.push({
          source: 'Previous Verifications',
          type: 'previous_verification',
          status: 'error',
          details: 'Unable to check previous verifications'
        });
      }
    }
    
    return crossChecks;
  }

  private async checkGovernmentDatabase(
    documentNumber: string,
    documentType: string
  ): Promise<CrossCheckResult> {
    // Simulation - in reality this would connect to actual government APIs
    const mockResponse = Math.random() > 0.1; // 90% success rate
    
    if (mockResponse) {
      return {
        source: 'Government Database',
        type: 'government_database',
        status: 'verified',
        details: 'Document verified in government database'
      };
    } else {
      return {
        source: 'Government Database',
        type: 'government_database',
        status: 'not_found',
        details: 'Document not found in government database'
      };
    }
  }

  private async checkBlacklist(
    documentNumber: string,
    fullName: string
  ): Promise<CrossCheckResult> {
    // Simulation - check against fraud/blacklist databases
    const isBlacklisted = Math.random() < 0.02; // 2% chance of being blacklisted
    
    if (isBlacklisted) {
      return {
        source: 'Blacklist Database',
        type: 'blacklist',
        status: 'mismatch',
        details: 'Identity found in blacklist database'
      };
    } else {
      return {
        source: 'Blacklist Database',
        type: 'blacklist',
        status: 'verified',
        details: 'Identity not found in blacklist'
      };
    }
  }

  private async checkPreviousVerifications(documentNumber: string): Promise<CrossCheckResult> {
    // Check our own database for previous verifications
    // This would connect to your internal database
    return {
      source: 'Previous Verifications',
      type: 'previous_verification',
      status: 'not_found',
      details: 'No previous verifications found'
    };
  }

  private calculateOverallConfidence(
    documentResult: DocumentVerificationResult,
    personalInfoResult: PersonalInfoVerificationResult,
    crossChecks: CrossCheckResult[]
  ): number {
    let confidence = 0;
    
    // Document confidence (40% weight)
    confidence += documentResult.confidence * 0.4;
    
    // Personal info match (30% weight)
    confidence += (personalInfoResult.overallMatch / 100) * 0.3;
    
    // Cross-checks (30% weight)
    const successfulChecks = crossChecks.filter(check => check.status === 'verified').length;
    const totalChecks = crossChecks.length;
    if (totalChecks > 0) {
      confidence += (successfulChecks / totalChecks) * 0.3;
    }
    
    return Math.min(confidence, 1.0);
  }

  private calculateRiskScore(
    documentResult: DocumentVerificationResult,
    personalInfoResult: PersonalInfoVerificationResult,
    crossChecks: CrossCheckResult[]
  ): number {
    let riskScore = 0;
    
    // Document authenticity risks
    if (!documentResult.isAuthentic) riskScore += 0.4;
    if (!documentResult.checks.tamperingDetection) riskScore += 0.2;
    if (!documentResult.checks.securityFeatures) riskScore += 0.1;
    
    // Personal info mismatch risks
    if (!personalInfoResult.nameMatch) riskScore += 0.2;
    if (!personalInfoResult.dateOfBirthMatch) riskScore += 0.1;
    
    // Cross-check risks
    const blacklistHit = crossChecks.find(check => 
      check.type === 'blacklist' && check.status === 'mismatch'
    );
    if (blacklistHit) riskScore += 0.5;
    
    const govDbFail = crossChecks.find(check => 
      check.type === 'government_database' && check.status === 'not_found'
    );
    if (govDbFail) riskScore += 0.2;
    
    return Math.min(riskScore, 1.0);
  }

  private determineVerificationStatus(
    confidence: number,
    riskScore: number
  ): 'verified' | 'failed' | 'pending' | 'requires_manual_review' {
    if (riskScore >= 0.5) {
      return 'failed';
    }
    
    if (confidence >= 0.8 && riskScore < 0.2) {
      return 'verified';
    }
    
    if (confidence >= 0.6 && riskScore < 0.3) {
      return 'requires_manual_review';
    }
    
    if (confidence >= 0.4) {
      return 'pending';
    }
    
    return 'failed';
  }

  private generateWarnings(
    documentResult: DocumentVerificationResult,
    personalInfoResult: PersonalInfoVerificationResult,
    crossChecks: CrossCheckResult[]
  ): string[] {
    const warnings: string[] = [];
    
    if (!documentResult.checks.imageQuality) {
      warnings.push('Document image quality is poor');
    }
    
    if (!personalInfoResult.nameMatch) {
      warnings.push('Provided name does not match document');
    }
    
    if (!personalInfoResult.dateOfBirthMatch) {
      warnings.push('Provided date of birth does not match document');
    }
    
    const failedChecks = crossChecks.filter(check => check.status === 'error');
    if (failedChecks.length > 0) {
      warnings.push(`Unable to verify with ${failedChecks.length} external source(s)`);
    }
    
    return warnings;
  }

  public async verifyBiometric(
    documentImage: string,
    faceImage: string,
    livenessVideo?: string
  ): Promise<IntegrationResponse<BiometricVerification>> {
    const requestId = crypto.randomUUID();
    
    try {
      if (!this.civicIdClient) {
        throw new Error('Identity verification service not initialized');
      }

      await this.rateLimitManager.checkRateLimit('identity-civic', requestId);

      const payload = {
        document_image: documentImage,
        face_image: faceImage,
        liveness_video: livenessVideo,
        checks: ['face_match', 'liveness']
      };

      const response = await this.retryManager.executeWithRetry(
        () => this.civicIdClient!.post('/verify/biometric', payload),
        'identity-civic'
      );

      const result = response.data.result;

      const verification: BiometricVerification = {
        faceImage,
        documentFaceMatch: result.face_match?.match === true,
        livenessCheck: result.liveness?.live === true,
        confidence: result.overall_confidence || 0
      };

      return {
        success: true,
        data: verification,
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Biometric verification failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  public async getVerificationStatus(
    verificationId: string
  ): Promise<IntegrationResponse<{status: string, progress: number}>> {
    const requestId = crypto.randomUUID();
    
    try {
      if (!this.civicIdClient) {
        throw new Error('Identity verification service not initialized');
      }

      const response = await this.civicIdClient.get(`/verification/${verificationId}/status`);
      
      return {
        success: true,
        data: {
          status: response.data.status,
          progress: response.data.progress || 0
        },
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Status check failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  public async validateVietnameseNationalId(idNumber: string): Promise<boolean> {
    // Vietnamese National ID validation
    const oldFormat = /^[0-9]{9}$/; // 9 digits (old format)
    const newFormat = /^[0-9]{12}$/; // 12 digits (new format from 2021)
    
    if (!oldFormat.test(idNumber) && !newFormat.test(idNumber)) {
      return false;
    }
    
    // Additional checksum validation could be added here
    // for the new 12-digit format if the algorithm is available
    
    return true;
  }

  public async validatePassportNumber(passportNumber: string, nationality: string = 'VN'): Promise<boolean> {
    if (nationality === 'VN') {
      // Vietnamese passport format: 1 letter + 7 digits
      const vnPassportFormat = /^[A-Z][0-9]{7}$/;
      return vnPassportFormat.test(passportNumber);
    }
    
    // Basic international passport validation
    const generalFormat = /^[A-Z0-9]{6,9}$/;
    return generalFormat.test(passportNumber);
  }
}
