import { MongoClient, Db, Collection } from 'mongodb';
import { HospitalDatabaseConfig, IntegrationResponse } from '../types';
import { IntegrationConfigManager } from '../config/IntegrationConfig';
import { RateLimitManager } from '../utils/RateLimitManager';
import { RetryManager } from '../utils/RetryManager';
import crypto from 'crypto';

export interface Hospital {
  id: string;
  name: string;
  address: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  phoneNumber?: string;
  email?: string;
  website?: string;
  specialties: string[];
  level: 'district' | 'provincial' | 'national' | 'private';
  accreditation: string[];
  capacity: {
    beds: number;
    emergency: number;
    icu: number;
  };
  insurance: {
    acceptsSocialInsurance: boolean;
    acceptsPrivateInsurance: boolean;
    insurancePartners: string[];
  };
  services: HospitalService[];
  operatingHours: OperatingHours;
  lastUpdated: Date;
}

export interface HospitalService {
  id: string;
  name: string;
  department: string;
  description?: string;
  cost?: {
    min: number;
    max: number;
    currency: string;
  };
  duration?: string;
  requirements?: string[];
  availability: boolean;
}

export interface OperatingHours {
  regular: {
    [key: string]: { // monday, tuesday, etc.
      open: string;
      close: string;
      closed: boolean;
    };
  };
  emergency: {
    available24h: boolean;
    hours?: string;
  };
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  hospitalId: string;
  visitDate: Date;
  diagnosis: string[];
  treatments: Treatment[];
  medications: Medication[];
  totalCost: number;
  insuranceCoverage?: InsuranceCoverage;
  status: 'active' | 'completed' | 'cancelled';
  documents: MedicalDocument[];
}

export interface Treatment {
  code: string;
  name: string;
  description?: string;
  cost: number;
  duration?: string;
  performedBy: string;
  date: Date;
}

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  cost: number;
  prescribedBy: string;
  date: Date;
}

export interface InsuranceCoverage {
  policyNumber: string;
  providerName: string;
  coveragePercentage: number;
  coveredAmount: number;
  patientPayment: number;
  preApprovalRequired: boolean;
  approvalStatus?: 'approved' | 'pending' | 'denied';
}

export interface MedicalDocument {
  id: string;
  type: 'prescription' | 'lab_result' | 'imaging' | 'discharge_summary' | 'invoice';
  name: string;
  url?: string;
  uploadDate: Date;
  verificationStatus: 'verified' | 'pending' | 'rejected';
}

export interface SyncResult {
  hospitalsUpdated: number;
  recordsUpdated: number;
  errors: string[];
  lastSyncTime: Date;
}

export class HospitalDatabaseService {
  private configManager: IntegrationConfigManager;
  private rateLimitManager: RateLimitManager;
  private retryManager: RetryManager;
  private mongoClient?: MongoClient;
  private database?: Db;
  private connected = false;

  constructor() {
    this.configManager = IntegrationConfigManager.getInstance();
    this.rateLimitManager = new RateLimitManager();
    this.retryManager = new RetryManager();
    this.initializeConnection();
  }

  private async initializeConnection(): Promise<void> {
    const config = this.configManager.getConfig<HospitalDatabaseConfig>('hospital-database');
    
    if (config?.enabled && config.connectionString) {
      try {
        this.mongoClient = new MongoClient(config.connectionString, {
          maxPoolSize: 10,
          serverSelectionTimeoutMS: config.timeout || 30000,
          connectTimeoutMS: config.timeout || 30000
        });
        
        await this.mongoClient.connect();
        this.database = this.mongoClient.db('hospital_system');
        this.connected = true;
        
        // Setup sync interval
        if (config.syncInterval > 0) {
          setInterval(() => this.syncAllData(), config.syncInterval);
        }
      } catch (error) {
        console.error('Failed to connect to hospital database:', error);
        this.connected = false;
      }
    }
  }

  public async findHospitalsByLocation(
    coordinates: { lat: number; lng: number },
    radiusKm: number = 10,
    specialties?: string[]
  ): Promise<IntegrationResponse<Hospital[]>> {
    const requestId = crypto.randomUUID();
    
    try {
      if (!this.connected || !this.database) {
        throw new Error('Hospital database is not connected');
      }

      await this.rateLimitManager.checkRateLimit('hospital-database', requestId);

      const hospitals = await this.retryManager.executeWithRetry(
        () => this.executeLocationSearch(coordinates, radiusKm, specialties),
        'hospital-database'
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
        error: error instanceof Error ? error.message : 'Hospital search failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  private async executeLocationSearch(
    coordinates: { lat: number; lng: number },
    radiusKm: number,
    specialties?: string[]
  ): Promise<Hospital[]> {
    const collection = this.database!.collection<Hospital>('hospitals');
    
    const query: any = {
      coordinates: {
        $geoWithin: {
          $centerSphere: [
            [coordinates.lng, coordinates.lat],
            radiusKm / 6371 // Earth radius in km
          ]
        }
      }
    };

    if (specialties && specialties.length > 0) {
      query.specialties = { $in: specialties };
    }

    const hospitals = await collection
      .find(query)
      .sort({ 'coordinates': 1 })
      .limit(50)
      .toArray();

    return hospitals;
  }

  public async findHospitalById(hospitalId: string): Promise<IntegrationResponse<Hospital | null>> {
    const requestId = crypto.randomUUID();
    
    try {
      if (!this.connected || !this.database) {
        throw new Error('Hospital database is not connected');
      }

      const collection = this.database.collection<Hospital>('hospitals');
      const hospital = await collection.findOne({ id: hospitalId });

      return {
        success: true,
        data: hospital,
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Hospital lookup failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  public async searchHospitalsByName(
    name: string,
    limit: number = 20
  ): Promise<IntegrationResponse<Hospital[]>> {
    const requestId = crypto.randomUUID();
    
    try {
      if (!this.connected || !this.database) {
        throw new Error('Hospital database is not connected');
      }

      const collection = this.database.collection<Hospital>('hospitals');
      
      const hospitals = await collection
        .find({
          $or: [
            { name: { $regex: name, $options: 'i' } },
            { 'services.name': { $regex: name, $options: 'i' } }
          ]
        })
        .limit(limit)
        .toArray();

      return {
        success: true,
        data: hospitals,
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Hospital search failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  public async getPatientMedicalHistory(
    patientId: string,
    hospitalIds?: string[]
  ): Promise<IntegrationResponse<MedicalRecord[]>> {
    const requestId = crypto.randomUUID();
    
    try {
      if (!this.connected || !this.database) {
        throw new Error('Hospital database is not connected');
      }

      await this.rateLimitManager.checkRateLimit('hospital-database', requestId);

      const records = await this.retryManager.executeWithRetry(
        () => this.executePatientHistorySearch(patientId, hospitalIds),
        'hospital-database'
      );

      return {
        success: true,
        data: records,
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Medical history retrieval failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  private async executePatientHistorySearch(
    patientId: string,
    hospitalIds?: string[]
  ): Promise<MedicalRecord[]> {
    const collection = this.database!.collection<MedicalRecord>('medical_records');
    
    const query: any = { patientId };
    
    if (hospitalIds && hospitalIds.length > 0) {
      query.hospitalId = { $in: hospitalIds };
    }

    const records = await collection
      .find(query)
      .sort({ visitDate: -1 })
      .limit(100)
      .toArray();

    return records;
  }

  public async verifyMedicalRecord(
    recordId: string,
    hospitalId: string
  ): Promise<IntegrationResponse<{
    verified: boolean;
    record?: MedicalRecord;
    discrepancies?: string[];
  }>> {
    const requestId = crypto.randomUUID();
    
    try {
      if (!this.connected || !this.database) {
        throw new Error('Hospital database is not connected');
      }

      const collection = this.database.collection<MedicalRecord>('medical_records');
      const record = await collection.findOne({ 
        id: recordId, 
        hospitalId 
      });

      if (!record) {
        return {
          success: true,
          data: {
            verified: false,
            discrepancies: ['Record not found in hospital database']
          },
          requestId,
          timestamp: new Date()
        };
      }

      // Verify record integrity
      const discrepancies = await this.checkRecordIntegrity(record);

      return {
        success: true,
        data: {
          verified: discrepancies.length === 0,
          record,
          discrepancies: discrepancies.length > 0 ? discrepancies : undefined
        },
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Record verification failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  private async checkRecordIntegrity(record: MedicalRecord): Promise<string[]> {
    const discrepancies: string[] = [];
    
    // Check if total cost matches sum of treatments and medications
    const calculatedCost = 
      record.treatments.reduce((sum, treatment) => sum + treatment.cost, 0) +
      record.medications.reduce((sum, medication) => sum + medication.cost, 0);
    
    if (Math.abs(calculatedCost - record.totalCost) > 0.01) {
      discrepancies.push('Total cost does not match sum of treatments and medications');
    }
    
    // Check if insurance coverage calculation is correct
    if (record.insuranceCoverage) {
      const expectedCoverage = record.totalCost * (record.insuranceCoverage.coveragePercentage / 100);
      if (Math.abs(expectedCoverage - record.insuranceCoverage.coveredAmount) > 0.01) {
        discrepancies.push('Insurance coverage calculation mismatch');
      }
    }
    
    // Check for required documents
    const requiredDocTypes = ['prescription', 'invoice'];
    for (const docType of requiredDocTypes) {
      if (!record.documents.some(doc => doc.type === docType)) {
        discrepancies.push(`Missing required document: ${docType}`);
      }
    }
    
    return discrepancies;
  }

  public async getServicePricing(
    hospitalId: string,
    serviceNames: string[]
  ): Promise<IntegrationResponse<{
    hospitalName: string;
    services: Array<{
      name: string;
      found: boolean;
      cost?: { min: number; max: number; currency: string };
      department?: string;
    }>;
  }>> {
    const requestId = crypto.randomUUID();
    
    try {
      if (!this.connected || !this.database) {
        throw new Error('Hospital database is not connected');
      }

      const hospitalCollection = this.database.collection<Hospital>('hospitals');
      const hospital = await hospitalCollection.findOne({ id: hospitalId });
      
      if (!hospital) {
        throw new Error('Hospital not found');
      }

      const serviceResults = serviceNames.map(serviceName => {
        const service = hospital.services.find(s => 
          s.name.toLowerCase().includes(serviceName.toLowerCase())
        );
        
        return {
          name: serviceName,
          found: !!service,
          cost: service?.cost,
          department: service?.department
        };
      });

      return {
        success: true,
        data: {
          hospitalName: hospital.name,
          services: serviceResults
        },
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Service pricing lookup failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  public async checkInsuranceAcceptance(
    hospitalId: string,
    insuranceProvider: string
  ): Promise<IntegrationResponse<{
    accepted: boolean;
    coverageDetails?: {
      percentage: number;
      restrictions: string[];
      preApprovalRequired: boolean;
    };
  }>> {
    const requestId = crypto.randomUUID();
    
    try {
      if (!this.connected || !this.database) {
        throw new Error('Hospital database is not connected');
      }

      const collection = this.database.collection<Hospital>('hospitals');
      const hospital = await collection.findOne({ id: hospitalId });
      
      if (!hospital) {
        throw new Error('Hospital not found');
      }

      const accepted = hospital.insurance.acceptsPrivateInsurance && 
        hospital.insurance.insurancePartners.includes(insuranceProvider);

      let coverageDetails;
      if (accepted) {
        // This would typically come from a separate insurance coverage database
        coverageDetails = {
          percentage: 80, // Default coverage
          restrictions: [],
          preApprovalRequired: false
        };
      }

      return {
        success: true,
        data: {
          accepted,
          coverageDetails
        },
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Insurance acceptance check failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  public async syncAllData(): Promise<IntegrationResponse<SyncResult>> {
    const requestId = crypto.randomUUID();
    
    try {
      if (!this.connected || !this.database) {
        throw new Error('Hospital database is not connected');
      }

      const result = await this.retryManager.executeWithRetry(
        () => this.executeSyncAllData(),
        'hospital-database'
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
        error: error instanceof Error ? error.message : 'Data sync failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  private async executeSyncAllData(): Promise<SyncResult> {
    const errors: string[] = [];
    let hospitalsUpdated = 0;
    let recordsUpdated = 0;

    try {
      // Sync hospitals data
      const hospitalResult = await this.syncHospitalsData();
      hospitalsUpdated = hospitalResult.updated;
      errors.push(...hospitalResult.errors);
    } catch (error) {
      errors.push(`Hospital sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      // Sync medical records
      const recordsResult = await this.syncMedicalRecords();
      recordsUpdated = recordsResult.updated;
      errors.push(...recordsResult.errors);
    } catch (error) {
      errors.push(`Records sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      hospitalsUpdated,
      recordsUpdated,
      errors,
      lastSyncTime: new Date()
    };
  }

  private async syncHospitalsData(): Promise<{ updated: number; errors: string[] }> {
    // This would connect to external hospital management systems
    // For now, it's a placeholder implementation
    return {
      updated: 0,
      errors: []
    };
  }

  private async syncMedicalRecords(): Promise<{ updated: number; errors: string[] }> {
    // This would sync with hospital EMR systems
    // For now, it's a placeholder implementation
    return {
      updated: 0,
      errors: []
    };
  }

  public async getHospitalStatistics(): Promise<IntegrationResponse<{
    totalHospitals: number;
    hospitalsByLevel: Record<string, number>;
    specialtiesCoverage: Record<string, number>;
    lastSyncStatus: {
      success: boolean;
      lastSync: Date;
      errors: string[];
    };
  }>> {
    const requestId = crypto.randomUUID();
    
    try {
      if (!this.connected || !this.database) {
        throw new Error('Hospital database is not connected');
      }

      const hospitalCollection = this.database.collection<Hospital>('hospitals');
      
      const totalHospitals = await hospitalCollection.countDocuments();
      
      const levelAggregation = await hospitalCollection.aggregate([
        { $group: { _id: '$level', count: { $sum: 1 } } }
      ]).toArray();
      
      const hospitalsByLevel = levelAggregation.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {} as Record<string, number>);

      const specialtiesAggregation = await hospitalCollection.aggregate([
        { $unwind: '$specialties' },
        { $group: { _id: '$specialties', count: { $sum: 1 } } }
      ]).toArray();
      
      const specialtiesCoverage = specialtiesAggregation.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {} as Record<string, number>);

      return {
        success: true,
        data: {
          totalHospitals,
          hospitalsByLevel,
          specialtiesCoverage,
          lastSyncStatus: {
            success: true,
            lastSync: new Date(),
            errors: []
          }
        },
        requestId,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Statistics retrieval failed',
        requestId,
        timestamp: new Date()
      };
    }
  }

  public async close(): Promise<void> {
    if (this.mongoClient) {
      await this.mongoClient.close();
      this.connected = false;
    }
  }
}
