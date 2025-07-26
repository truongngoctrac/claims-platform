import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import https from 'https';
import { GovernmentAPIConfig, IntegrationResponse } from '../types';
import { IntegrationConfigManager } from '../config/IntegrationConfig';
import { RateLimitManager } from '../utils/RateLimitManager';
import { RetryManager } from '../utils/RetryManager';

export interface CitizenInfo {
  nationalId: string;
  fullName: string;
  dateOfBirth: string;
  gender: 'M' | 'F';
  nationality: string;
  placeOfBirth: string;
  address: {
    street: string;
    ward: string;
    district: string;
    city: string;
    province: string;
  };
  issuedDate: string;
  expiryDate?: string;
  status: 'active' | 'expired' | 'cancelled' | 'invalid';
}

export interface InsuranceInfo {
  cardNumber: string;
  holderName: string;
  nationalId: string;
  issuedDate: string;
  expiryDate: string;
  provider: string;
  benefitLevel: string;
  status: 'active' | 'expired' | 'suspended';
  coverageDetails: {
    outpatient: boolean;
    inpatient: boolean;
    emergency: boolean;
    dental: boolean;
    maternity: boolean;
    mentalHealth: boolean;
  };
}

export interface HospitalRegistryInfo {
  id: string;
  name: string;
  licenseNumber: string;
  address: string;
  level: 'district' | 'provincial' | 'national';
  ownership: 'public' | 'private' | 'joint_venture';
  specialties: string[];
  accreditation: {
    level: string;
    issuedBy: string;
    issuedDate: string;
    expiryDate: string;
    status: 'valid' | 'expired' | 'suspended';
  };
  insurance: {
    socialInsuranceContract: boolean;
    contractNumber?: string;
    contractDate?: string;
  };
  status: 'active' | 'suspended' | 'closed';
}

export interface MedicalCode {
  code: string;
  name: string;
  category: string;
  description?: string;
  standardPrice?: number;
  insuranceCoverage?: number;
  effectiveDate: string;
  status: 'active' | 'deprecated';
}

export interface GovernmentVerificationRequest {
  type: 'citizen' | 'insurance' | 'hospital' | 'medical_code';
  identifier: string;
  additionalInfo?: Record<string, any>;
}

export interface GovernmentVerificationResult {
  verified: boolean;
  data?: any;
  confidence: number;
  source: string;
  timestamp: Date;
  warnings?: string[];
}

export class GovernmentAPIService {
  private configManager: IntegrationConfigManager;
  private rateLimitManager: RateLimitManager;
  private retryManager: RetryManager;
  private apiClient?: AxiosInstance;
  private certificateAgent?: https.Agent;

  constructor() {
    this.configManager = IntegrationConfigManager.getInstance();
    this.rateLimitManager = new RateLimitManager();
    this.retryManager = new RetryManager();
    this.initializeClient();
  }

  private initializeClient(): void {
    const config = this.configManager.getConfig<GovernmentAPIConfig>('government-api');
    
    if (config?.enabled) {
      // Setup certificate authentication if required
      if (config.authMethod === 'certificate' && config.certificatePath) {
        try {
          const cert = fs.readFileSync(config.certificatePath);
          this.certificateAgent = new https.Agent({
            cert,
            rejectUnauthorized: true
          });
        } catch (error) {
          console.error('Failed to load government API certificate:', error);
        }
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'HealthcareClaimSystem/1.0'
      };

      if (config.authMethod === 'api-key' && config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
      }

      this.apiClient = axios.create({
        baseURL: config.baseUrl,
        timeout: config.timeout,
        headers,
        httpsAgent: this.certificateAgent
      });

      // Add request interceptor for OAuth2 if needed
      if (config.authMethod === 'oauth2') {
        this.apiClient.interceptors.request.use(async (requestConfig) => {
          const token = await this.getOAuth2Token();
          if (token) {
            requestConfig.headers!['Authorization'] = `Bearer ${token}`;
          }
          return requestConfig;
        });
      }
    }
  }

  private async getOAuth2Token(): Promise<string | null> {
    // Implementation for OAuth2 token retrieval
    // This would depend on the specific OAuth2 flow required by the government API
    return null;
  }

  public async verifyCitizen(nationalId: string): Promise<IntegrationResponse<CitizenInfo>> {
    const requestId = crypto.randomUUID();
    
    try {
      if (!this.apiClient) {
        throw new Error('Government API client is not configured');
      }

      await this.rateLimitManager.checkRateLimit('government-api', requestId);

      const config = this.configManager.getConfig<GovernmentAPIConfig>('government-api')!;
      const citizenData = await this.retryManager.executeWithRetry(
        () => this.executeCitizenLookup(nationalId, config),
        'government-api'
      );

      return {
        success: true,
        data: citizenData,
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Citizen verification failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  private async executeCitizenLookup(
    nationalId: string,
    config: GovernmentAPIConfig
  ): Promise<CitizenInfo> {
    const response = await this.apiClient!.post(config.endpoints.citizen_lookup, {
      national_id: nationalId,
      purpose: 'insurance_verification',
      requested_fields: [
        'full_name',
        'date_of_birth',
        'gender',
        'address',
        'issued_date',
        'status'
      ]
    });

    if (response.data.status !== 'success') {
      throw new Error(`Citizen lookup failed: ${response.data.message}`);
    }

    const data = response.data.data;
    
    return {
      nationalId,
      fullName: data.full_name,
      dateOfBirth: data.date_of_birth,
      gender: data.gender,
      nationality: data.nationality || 'Vietnamese',
      placeOfBirth: data.place_of_birth || '',
      address: {
        street: data.address?.street || '',
        ward: data.address?.ward || '',
        district: data.address?.district || '',
        city: data.address?.city || '',
        province: data.address?.province || ''
      },
      issuedDate: data.issued_date,
      expiryDate: data.expiry_date,
      status: data.status
    };
  }

  public async verifyInsurance(
    cardNumber: string,
    nationalId?: string
  ): Promise<IntegrationResponse<InsuranceInfo>> {
    const requestId = crypto.randomUUID();
    
    try {
      if (!this.apiClient) {
        throw new Error('Government API client is not configured');
      }

      await this.rateLimitManager.checkRateLimit('government-api', requestId);

      const config = this.configManager.getConfig<GovernmentAPIConfig>('government-api')!;
      const insuranceData = await this.retryManager.executeWithRetry(
        () => this.executeInsuranceVerification(cardNumber, nationalId, config),
        'government-api'
      );

      return {
        success: true,
        data: insuranceData,
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Insurance verification failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  private async executeInsuranceVerification(
    cardNumber: string,
    nationalId: string | undefined,
    config: GovernmentAPIConfig
  ): Promise<InsuranceInfo> {
    const payload: any = {
      card_number: cardNumber,
      purpose: 'claim_processing'
    };

    if (nationalId) {
      payload.national_id = nationalId;
    }

    const response = await this.apiClient!.post(
      config.endpoints.insurance_verification,
      payload
    );

    if (response.data.status !== 'success') {
      throw new Error(`Insurance verification failed: ${response.data.message}`);
    }

    const data = response.data.data;
    
    return {
      cardNumber,
      holderName: data.holder_name,
      nationalId: data.national_id,
      issuedDate: data.issued_date,
      expiryDate: data.expiry_date,
      provider: data.provider,
      benefitLevel: data.benefit_level,
      status: data.status,
      coverageDetails: {
        outpatient: data.coverage?.outpatient === true,
        inpatient: data.coverage?.inpatient === true,
        emergency: data.coverage?.emergency === true,
        dental: data.coverage?.dental === true,
        maternity: data.coverage?.maternity === true,
        mentalHealth: data.coverage?.mental_health === true
      }
    };
  }

  public async getHospitalRegistry(
    hospitalId?: string,
    licenseNumber?: string
  ): Promise<IntegrationResponse<HospitalRegistryInfo[]>> {
    const requestId = crypto.randomUUID();
    
    try {
      if (!this.apiClient) {
        throw new Error('Government API client is not configured');
      }

      if (!hospitalId && !licenseNumber) {
        throw new Error('Either hospital ID or license number must be provided');
      }

      await this.rateLimitManager.checkRateLimit('government-api', requestId);

      const config = this.configManager.getConfig<GovernmentAPIConfig>('government-api')!;
      const hospitals = await this.retryManager.executeWithRetry(
        () => this.executeHospitalRegistryLookup(hospitalId, licenseNumber, config),
        'government-api'
      );

      return {
        success: true,
        data: hospitals,
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Hospital registry lookup failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  private async executeHospitalRegistryLookup(
    hospitalId: string | undefined,
    licenseNumber: string | undefined,
    config: GovernmentAPIConfig
  ): Promise<HospitalRegistryInfo[]> {
    const payload: any = {};
    
    if (hospitalId) {
      payload.hospital_id = hospitalId;
    }
    
    if (licenseNumber) {
      payload.license_number = licenseNumber;
    }

    const response = await this.apiClient!.get(config.endpoints.hospital_registry, {
      params: payload
    });

    if (response.data.status !== 'success') {
      throw new Error(`Hospital registry lookup failed: ${response.data.message}`);
    }

    const hospitals = response.data.data;
    
    return hospitals.map((hospital: any) => ({
      id: hospital.id,
      name: hospital.name,
      licenseNumber: hospital.license_number,
      address: hospital.address,
      level: hospital.level,
      ownership: hospital.ownership,
      specialties: hospital.specialties || [],
      accreditation: {
        level: hospital.accreditation?.level || '',
        issuedBy: hospital.accreditation?.issued_by || '',
        issuedDate: hospital.accreditation?.issued_date || '',
        expiryDate: hospital.accreditation?.expiry_date || '',
        status: hospital.accreditation?.status || 'unknown'
      },
      insurance: {
        socialInsuranceContract: hospital.insurance?.social_insurance_contract === true,
        contractNumber: hospital.insurance?.contract_number,
        contractDate: hospital.insurance?.contract_date
      },
      status: hospital.status
    }));
  }

  public async getMedicalCodes(
    category?: string,
    search?: string
  ): Promise<IntegrationResponse<MedicalCode[]>> {
    const requestId = crypto.randomUUID();
    
    try {
      if (!this.apiClient) {
        throw new Error('Government API client is not configured');
      }

      await this.rateLimitManager.checkRateLimit('government-api', requestId);

      const config = this.configManager.getConfig<GovernmentAPIConfig>('government-api')!;
      const codes = await this.retryManager.executeWithRetry(
        () => this.executeMedicalCodesLookup(category, search, config),
        'government-api'
      );

      return {
        success: true,
        data: codes,
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Medical codes lookup failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  private async executeMedicalCodesLookup(
    category: string | undefined,
    search: string | undefined,
    config: GovernmentAPIConfig
  ): Promise<MedicalCode[]> {
    const params: any = {};
    
    if (category) {
      params.category = category;
    }
    
    if (search) {
      params.search = search;
    }

    const response = await this.apiClient!.get(config.endpoints.medical_codes, {
      params
    });

    if (response.data.status !== 'success') {
      throw new Error(`Medical codes lookup failed: ${response.data.message}`);
    }

    const codes = response.data.data;
    
    return codes.map((code: any) => ({
      code: code.code,
      name: code.name,
      category: code.category,
      description: code.description,
      standardPrice: code.standard_price,
      insuranceCoverage: code.insurance_coverage,
      effectiveDate: code.effective_date,
      status: code.status
    }));
  }

  public async validateMedicalClaim(
    claimData: {
      patientNationalId: string;
      insuranceCardNumber: string;
      hospitalLicense: string;
      treatmentCodes: string[];
      totalAmount: number;
    }
  ): Promise<IntegrationResponse<{
    valid: boolean;
    eligibilityCheck: {
      patientEligible: boolean;
      insuranceValid: boolean;
      hospitalAuthorized: boolean;
    };
    coverageCheck: {
      coveredAmount: number;
      patientPayment: number;
      coveragePercentage: number;
    };
    warnings: string[];
    errors: string[];
  }>> {
    const requestId = crypto.randomUUID();
    
    try {
      if (!this.apiClient) {
        throw new Error('Government API client is not configured');
      }

      await this.rateLimitManager.checkRateLimit('government-api', requestId);

      // Perform multiple validations
      const [citizenResult, insuranceResult, hospitalResult] = await Promise.allSettled([
        this.verifyCitizen(claimData.patientNationalId),
        this.verifyInsurance(claimData.insuranceCardNumber, claimData.patientNationalId),
        this.getHospitalRegistry(undefined, claimData.hospitalLicense)
      ]);

      const warnings: string[] = [];
      const errors: string[] = [];

      // Check citizen verification
      const patientEligible = citizenResult.status === 'fulfilled' && 
        citizenResult.value.success && 
        citizenResult.value.data?.status === 'active';
      
      if (!patientEligible) {
        errors.push('Patient national ID verification failed or inactive');
      }

      // Check insurance verification
      const insuranceValid = insuranceResult.status === 'fulfilled' && 
        insuranceResult.value.success && 
        insuranceResult.value.data?.status === 'active';
      
      if (!insuranceValid) {
        errors.push('Insurance card verification failed or inactive');
      }

      // Check hospital authorization
      const hospitalAuthorized = hospitalResult.status === 'fulfilled' && 
        hospitalResult.value.success && 
        hospitalResult.value.data && 
        hospitalResult.value.data.length > 0 &&
        hospitalResult.value.data[0].status === 'active' &&
        hospitalResult.value.data[0].insurance.socialInsuranceContract;
      
      if (!hospitalAuthorized) {
        errors.push('Hospital is not authorized for insurance claims');
      }

      // Calculate coverage
      let coveragePercentage = 0;
      let coveredAmount = 0;
      let patientPayment = claimData.totalAmount;

      if (insuranceValid && insuranceResult.status === 'fulfilled') {
        const insuranceData = insuranceResult.value.data!;
        
        // Basic coverage calculation (would be more complex in reality)
        switch (insuranceData.benefitLevel) {
          case 'level_1':
            coveragePercentage = 100;
            break;
          case 'level_2':
            coveragePercentage = 95;
            break;
          case 'level_3':
            coveragePercentage = 80;
            break;
          default:
            coveragePercentage = 70;
        }
        
        coveredAmount = claimData.totalAmount * (coveragePercentage / 100);
        patientPayment = claimData.totalAmount - coveredAmount;
      }

      const valid = errors.length === 0;

      return {
        success: true,
        data: {
          valid,
          eligibilityCheck: {
            patientEligible,
            insuranceValid,
            hospitalAuthorized
          },
          coverageCheck: {
            coveredAmount,
            patientPayment,
            coveragePercentage
          },
          warnings,
          errors
        },
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Medical claim validation failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  public async submitClaimToGovernment(
    claimData: {
      claimId: string;
      patientNationalId: string;
      insuranceCardNumber: string;
      hospitalLicense: string;
      treatmentDate: string;
      treatments: Array<{
        code: string;
        quantity: number;
        amount: number;
      }>;
      totalAmount: number;
      documents: Array<{
        type: string;
        url: string;
        hash: string;
      }>;
    }
  ): Promise<IntegrationResponse<{
    submissionId: string;
    status: 'submitted' | 'accepted' | 'rejected';
    referenceNumber: string;
    estimatedProcessingTime: string;
    requiredActions?: string[];
  }>> {
    const requestId = crypto.randomUUID();
    
    try {
      if (!this.apiClient) {
        throw new Error('Government API client is not configured');
      }

      await this.rateLimitManager.checkRateLimit('government-api', requestId);

      const payload = {
        claim_id: claimData.claimId,
        patient_national_id: claimData.patientNationalId,
        insurance_card_number: claimData.insuranceCardNumber,
        hospital_license: claimData.hospitalLicense,
        treatment_date: claimData.treatmentDate,
        treatments: claimData.treatments,
        total_amount: claimData.totalAmount,
        documents: claimData.documents,
        submission_timestamp: new Date().toISOString()
      };

      const response = await this.retryManager.executeWithRetry(
        () => this.apiClient!.post('/claims/submit', payload),
        'government-api'
      );

      if (response.data.status !== 'success') {
        throw new Error(`Claim submission failed: ${response.data.message}`);
      }

      const result = response.data.data;

      return {
        success: true,
        data: {
          submissionId: result.submission_id,
          status: result.status,
          referenceNumber: result.reference_number,
          estimatedProcessingTime: result.estimated_processing_time,
          requiredActions: result.required_actions
        },
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Government claim submission failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  public async checkClaimStatus(
    submissionId: string
  ): Promise<IntegrationResponse<{
    status: 'pending' | 'processing' | 'approved' | 'rejected' | 'paid';
    lastUpdated: Date;
    progress: number;
    approvedAmount?: number;
    rejectionReason?: string;
    paymentDate?: Date;
    requiredActions?: string[];
  }>> {
    const requestId = crypto.randomUUID();
    
    try {
      if (!this.apiClient) {
        throw new Error('Government API client is not configured');
      }

      const response = await this.apiClient.get(`/claims/status/${submissionId}`);

      if (response.data.status !== 'success') {
        throw new Error(`Status check failed: ${response.data.message}`);
      }

      const result = response.data.data;

      return {
        success: true,
        data: {
          status: result.status,
          lastUpdated: new Date(result.last_updated),
          progress: result.progress || 0,
          approvedAmount: result.approved_amount,
          rejectionReason: result.rejection_reason,
          paymentDate: result.payment_date ? new Date(result.payment_date) : undefined,
          requiredActions: result.required_actions
        },
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Claim status check failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  public async getAPIHealthStatus(): Promise<IntegrationResponse<{
    status: 'healthy' | 'degraded' | 'down';
    endpoints: Record<string, {
      status: 'up' | 'down';
      responseTime: number;
      lastChecked: Date;
    }>;
    systemMaintenance?: {
      scheduled: boolean;
      startTime?: Date;
      endTime?: Date;
      description?: string;
    };
  }>> {
    const requestId = crypto.randomUUID();
    
    try {
      if (!this.apiClient) {
        throw new Error('Government API client is not configured');
      }

      const response = await this.apiClient.get('/health');
      
      return {
        success: true,
        data: response.data,
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Health check failed',
        requestId,
        timestamp: new Date()
      };
    }
  }
}
