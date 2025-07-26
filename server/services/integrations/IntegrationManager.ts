import { IntegrationResponse } from './types';
import { IntegrationConfigManager } from './config/IntegrationConfig';
import { SMSGatewayService } from './third-party-apis/SMSGatewayService';
import { EmailService } from './third-party-apis/EmailService';
import { CloudStorageService } from './third-party-apis/CloudStorageService';
import { OCRService } from './third-party-apis/OCRService';
import { MapsService } from './third-party-apis/MapsService';
import { IdentityVerificationService } from './third-party-apis/IdentityVerificationService';
import { HospitalDatabaseService } from './third-party-apis/HospitalDatabaseService';
import { GovernmentAPIService } from './third-party-apis/GovernmentAPIService';
import { RateLimitManager } from './utils/RateLimitManager';
import crypto from 'crypto';

export interface IntegrationHealthStatus {
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  lastChecked: Date;
  responseTime?: number;
  error?: string;
}

export interface IntegrationMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  rateLimitHits: number;
  lastHour: {
    requests: number;
    success: number;
    failures: number;
  };
}

export class IntegrationManager {
  private configManager: IntegrationConfigManager;
  private rateLimitManager: RateLimitManager;
  
  // Service instances
  private smsGateway: SMSGatewayService;
  private emailService: EmailService;
  private cloudStorage: CloudStorageService;
  private ocrService: OCRService;
  private mapsService: MapsService;
  private identityVerification: IdentityVerificationService;
  private hospitalDatabase: HospitalDatabaseService;
  private governmentAPI: GovernmentAPIService;
  
  // Metrics tracking
  private metrics: Map<string, IntegrationMetrics> = new Map();
  private healthStatus: Map<string, IntegrationHealthStatus> = new Map();
  
  constructor() {
    this.configManager = IntegrationConfigManager.getInstance();
    this.rateLimitManager = new RateLimitManager();
    
    // Initialize services
    this.smsGateway = new SMSGatewayService();
    this.emailService = new EmailService();
    this.cloudStorage = new CloudStorageService();
    this.ocrService = new OCRService();
    this.mapsService = new MapsService();
    this.identityVerification = new IdentityVerificationService();
    this.hospitalDatabase = new HospitalDatabaseService();
    this.governmentAPI = new GovernmentAPIService();
    
    // Start health monitoring
    this.startHealthMonitoring();
  }

  private startHealthMonitoring(): void {
    // Check health every 5 minutes
    setInterval(() => {
      this.checkAllServicesHealth();
    }, 5 * 60 * 1000);
    
    // Initial health check
    setTimeout(() => {
      this.checkAllServicesHealth();
    }, 1000);
  }

  // SMS Gateway Methods
  public async sendSMS(
    to: string,
    message: string,
    template?: string,
    variables?: Record<string, string>,
    provider: 'viettel' | 'vnpt' = 'viettel'
  ): Promise<IntegrationResponse<any>> {
    const startTime = Date.now();
    
    try {
      const result = await this.smsGateway.sendSMS({
        to,
        message,
        template,
        variables
      }, provider);
      
      this.recordMetrics('sms', startTime, result.success);
      return result;
    } catch (error) {
      this.recordMetrics('sms', startTime, false);
      throw error;
    }
  }

  public async sendOTP(
    phoneNumber: string,
    code: string,
    provider: 'viettel' | 'vnpt' = 'viettel'
  ): Promise<IntegrationResponse<any>> {
    return this.smsGateway.sendOTP(phoneNumber, code, provider);
  }

  // Email Service Methods
  public async sendEmail(
    to: string | string[],
    subject: string,
    content: { html?: string; text?: string },
    attachments?: any[]
  ): Promise<IntegrationResponse<any>> {
    const startTime = Date.now();
    
    try {
      const result = await this.emailService.sendEmail({
        to,
        subject,
        html: content.html,
        text: content.text,
        attachments
      });
      
      this.recordMetrics('email', startTime, result.success);
      return result;
    } catch (error) {
      this.recordMetrics('email', startTime, false);
      throw error;
    }
  }

  public async sendWelcomeEmail(
    userEmail: string,
    userName: string,
    temporaryPassword?: string
  ): Promise<IntegrationResponse<any>> {
    return this.emailService.sendWelcomeEmail(userEmail, userName, temporaryPassword);
  }

  public async sendClaimNotificationEmail(
    userEmail: string,
    userName: string,
    claimId: string,
    status: 'submitted' | 'approved' | 'rejected',
    claimAmount?: number,
    rejectionReason?: string
  ): Promise<IntegrationResponse<any>> {
    return this.emailService.sendClaimNotificationEmail(
      userEmail,
      userName,
      claimId,
      status,
      claimAmount,
      rejectionReason
    );
  }

  // Cloud Storage Methods
  public async uploadFile(
    buffer: Buffer,
    filename?: string,
    folder?: string,
    contentType?: string
  ): Promise<IntegrationResponse<any>> {
    const startTime = Date.now();
    
    try {
      const result = await this.cloudStorage.uploadFile(buffer, {
        filename,
        folder,
        contentType
      });
      
      this.recordMetrics('storage', startTime, result.success);
      return result;
    } catch (error) {
      this.recordMetrics('storage', startTime, false);
      throw error;
    }
  }

  public async downloadFile(key: string): Promise<IntegrationResponse<Buffer>> {
    return this.cloudStorage.downloadFile(key);
  }

  public async getPresignedUploadUrl(
    key: string,
    expirationSeconds?: number
  ): Promise<IntegrationResponse<{url: string; fields?: Record<string, string>}>> {
    return this.cloudStorage.getPresignedUploadUrl(key, { expirationSeconds });
  }

  // OCR Service Methods
  public async extractTextFromDocument(
    document: { content: Buffer | string; mimeType: string; filename?: string },
    options?: { language?: string; extractTables?: boolean; extractForms?: boolean }
  ): Promise<IntegrationResponse<any>> {
    const startTime = Date.now();
    
    try {
      const result = await this.ocrService.extractText(document, options);
      this.recordMetrics('ocr', startTime, result.success);
      return result;
    } catch (error) {
      this.recordMetrics('ocr', startTime, false);
      throw error;
    }
  }

  public async extractHealthcareDocument(
    document: { content: Buffer | string; mimeType: string; filename?: string },
    documentType: 'medical_record' | 'prescription' | 'invoice' | 'insurance_card' | 'lab_result'
  ): Promise<IntegrationResponse<any>> {
    return this.ocrService.extractHealthcareDocument(document, documentType);
  }

  // Maps Service Methods
  public async geocodeAddress(address: string): Promise<IntegrationResponse<any>> {
    return this.mapsService.geocodeAddress(address);
  }

  public async findNearbyHospitals(
    coordinates: { lat: number; lng: number },
    radiusKm?: number
  ): Promise<IntegrationResponse<any>> {
    return this.mapsService.findNearbyHospitals(coordinates, radiusKm);
  }

  public async findNearbyPharmacies(
    coordinates: { lat: number; lng: number },
    radiusKm?: number
  ): Promise<IntegrationResponse<any>> {
    return this.mapsService.findNearbyPharmacies(coordinates, radiusKm);
  }

  public async calculateDistance(
    origins: Array<{ lat: number; lng: number }>,
    destinations: Array<{ lat: number; lng: number }>
  ): Promise<IntegrationResponse<any>> {
    return this.mapsService.calculateDistance(origins, destinations);
  }

  // Identity Verification Methods
  public async verifyIdentity(request: any): Promise<IntegrationResponse<any>> {
    const startTime = Date.now();
    
    try {
      const result = await this.identityVerification.verifyIdentity(request);
      this.recordMetrics('identity_verification', startTime, result.success);
      return result;
    } catch (error) {
      this.recordMetrics('identity_verification', startTime, false);
      throw error;
    }
  }

  public async verifyBiometric(
    documentImage: string,
    faceImage: string,
    livenessVideo?: string
  ): Promise<IntegrationResponse<any>> {
    return this.identityVerification.verifyBiometric(documentImage, faceImage, livenessVideo);
  }

  // Hospital Database Methods
  public async findHospitalsByLocation(
    coordinates: { lat: number; lng: number },
    radiusKm?: number,
    specialties?: string[]
  ): Promise<IntegrationResponse<any>> {
    return this.hospitalDatabase.findHospitalsByLocation(coordinates, radiusKm, specialties);
  }

  public async getPatientMedicalHistory(
    patientId: string,
    hospitalIds?: string[]
  ): Promise<IntegrationResponse<any>> {
    return this.hospitalDatabase.getPatientMedicalHistory(patientId, hospitalIds);
  }

  public async verifyMedicalRecord(
    recordId: string,
    hospitalId: string
  ): Promise<IntegrationResponse<any>> {
    return this.hospitalDatabase.verifyMedicalRecord(recordId, hospitalId);
  }

  // Government API Methods
  public async verifyCitizen(nationalId: string): Promise<IntegrationResponse<any>> {
    const startTime = Date.now();
    
    try {
      const result = await this.governmentAPI.verifyCitizen(nationalId);
      this.recordMetrics('government_api', startTime, result.success);
      return result;
    } catch (error) {
      this.recordMetrics('government_api', startTime, false);
      throw error;
    }
  }

  public async verifyInsurance(
    cardNumber: string,
    nationalId?: string
  ): Promise<IntegrationResponse<any>> {
    return this.governmentAPI.verifyInsurance(cardNumber, nationalId);
  }

  public async validateMedicalClaim(claimData: any): Promise<IntegrationResponse<any>> {
    return this.governmentAPI.validateMedicalClaim(claimData);
  }

  public async submitClaimToGovernment(claimData: any): Promise<IntegrationResponse<any>> {
    return this.governmentAPI.submitClaimToGovernment(claimData);
  }

  // Comprehensive Claim Processing
  public async processClaimComprehensively(claimData: {
    patientInfo: {
      nationalId: string;
      name: string;
      email: string;
      phone: string;
    };
    insuranceInfo: {
      cardNumber: string;
    };
    hospitalInfo: {
      id: string;
      licenseNumber: string;
    };
    documents: Array<{
      content: Buffer;
      mimeType: string;
      filename: string;
      type: string;
    }>;
    treatments: Array<{
      code: string;
      quantity: number;
      amount: number;
    }>;
    totalAmount: number;
  }): Promise<IntegrationResponse<{
    verificationResults: any;
    documentExtraction: any;
    governmentSubmission: any;
    notifications: any;
  }>> {
    const requestId = crypto.randomUUID();
    
    try {
      // Step 1: Verify patient identity and insurance
      const [citizenVerification, insuranceVerification] = await Promise.allSettled([
        this.verifyCitizen(claimData.patientInfo.nationalId),
        this.verifyInsurance(claimData.insuranceInfo.cardNumber, claimData.patientInfo.nationalId)
      ]);

      // Step 2: Process documents with OCR
      const documentProcessing = await Promise.allSettled(
        claimData.documents.map(doc => 
          this.extractHealthcareDocument(doc, doc.type as any)
        )
      );

      // Step 3: Validate claim with government systems
      const claimValidation = await this.validateMedicalClaim({
        patientNationalId: claimData.patientInfo.nationalId,
        insuranceCardNumber: claimData.insuranceInfo.cardNumber,
        hospitalLicense: claimData.hospitalInfo.licenseNumber,
        treatmentCodes: claimData.treatments.map(t => t.code),
        totalAmount: claimData.totalAmount
      });

      // Step 4: If valid, submit to government
      let governmentSubmission;
      if (claimValidation.success && claimValidation.data?.valid) {
        governmentSubmission = await this.submitClaimToGovernment({
          claimId: requestId,
          patientNationalId: claimData.patientInfo.nationalId,
          insuranceCardNumber: claimData.insuranceInfo.cardNumber,
          hospitalLicense: claimData.hospitalInfo.licenseNumber,
          treatmentDate: new Date().toISOString(),
          treatments: claimData.treatments,
          totalAmount: claimData.totalAmount,
          documents: claimData.documents.map((doc, index) => ({
            type: doc.type,
            url: `claim-${requestId}/document-${index}`,
            hash: crypto.createHash('sha256').update(doc.content).digest('hex')
          }))
        });
      }

      // Step 5: Send notifications
      const notificationPromises = [
        this.sendClaimNotificationEmail(
          claimData.patientInfo.email,
          claimData.patientInfo.name,
          requestId,
          'submitted',
          claimData.totalAmount
        ),
        this.sendSMS(
          claimData.patientInfo.phone,
          '',
          'claim_submitted',
          { claimId: requestId }
        )
      ];

      const notifications = await Promise.allSettled(notificationPromises);

      return {
        success: true,
        data: {
          verificationResults: {
            citizen: citizenVerification.status === 'fulfilled' ? citizenVerification.value : null,
            insurance: insuranceVerification.status === 'fulfilled' ? insuranceVerification.value : null,
            validation: claimValidation
          },
          documentExtraction: documentProcessing.map(result => 
            result.status === 'fulfilled' ? result.value : null
          ),
          governmentSubmission,
          notifications: notifications.map(result => 
            result.status === 'fulfilled' ? result.value : null
          )
        },
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Comprehensive claim processing failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  // Health and Monitoring Methods
  private async checkAllServicesHealth(): Promise<void> {
    const services = [
      'sms', 'email', 'storage', 'ocr', 'maps',
      'identity_verification', 'hospital_database', 'government_api'
    ];

    for (const service of services) {
      await this.checkServiceHealth(service);
    }
  }

  private async checkServiceHealth(serviceName: string): Promise<void> {
    const startTime = Date.now();
    let status: 'healthy' | 'degraded' | 'down' = 'healthy';
    let error: string | undefined;

    try {
      // Perform a lightweight health check for each service
      switch (serviceName) {
        case 'government_api':
          await this.governmentAPI.getAPIHealthStatus();
          break;
        default:
          // For other services, just check if they're configured
          const config = this.configManager.getConfig(serviceName);
          if (!config?.enabled) {
            status = 'down';
            error = 'Service not configured';
          }
      }
    } catch (err) {
      status = 'down';
      error = err instanceof Error ? err.message : 'Unknown error';
    }

    const responseTime = Date.now() - startTime;

    this.healthStatus.set(serviceName, {
      service: serviceName,
      status,
      lastChecked: new Date(),
      responseTime,
      error
    });
  }

  public getHealthStatus(): IntegrationHealthStatus[] {
    return Array.from(this.healthStatus.values());
  }

  public getServiceMetrics(serviceName?: string): IntegrationMetrics | Record<string, IntegrationMetrics> {
    if (serviceName) {
      return this.metrics.get(serviceName) || {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        rateLimitHits: 0,
        lastHour: { requests: 0, success: 0, failures: 0 }
      };
    }

    const allMetrics: Record<string, IntegrationMetrics> = {};
    for (const [service, metrics] of this.metrics.entries()) {
      allMetrics[service] = metrics;
    }
    return allMetrics;
  }

  private recordMetrics(serviceName: string, startTime: number, success: boolean): void {
    const responseTime = Date.now() - startTime;
    
    let metrics = this.metrics.get(serviceName);
    if (!metrics) {
      metrics = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        rateLimitHits: 0,
        lastHour: { requests: 0, success: 0, failures: 0 }
      };
      this.metrics.set(serviceName, metrics);
    }

    metrics.totalRequests++;
    if (success) {
      metrics.successfulRequests++;
      metrics.lastHour.success++;
    } else {
      metrics.failedRequests++;
      metrics.lastHour.failures++;
    }

    metrics.lastHour.requests++;
    
    // Update average response time
    metrics.averageResponseTime = 
      (metrics.averageResponseTime * (metrics.totalRequests - 1) + responseTime) / metrics.totalRequests;
  }

  public getRateLimitStatus(): Record<string, any> {
    return this.rateLimitManager.getAllRateLimits();
  }

  public async close(): Promise<void> {
    // Close database connections
    await this.hospitalDatabase.close();
  }
}

// Export singleton instance
export const integrationManager = new IntegrationManager();
