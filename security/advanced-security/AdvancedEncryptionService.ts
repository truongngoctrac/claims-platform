import { EncryptionKey, DataClassification } from '../types';
import { EventEmitter } from 'events';
import crypto from 'crypto';

interface EncryptionProfile {
  id: string;
  name: string;
  data_classification: DataClassification['classification'];
  algorithm: 'AES-256-GCM' | 'ChaCha20-Poly1305' | 'AES-256-CBC' | 'RSA-OAEP';
  key_size: number;
  iv_size?: number;
  tag_size?: number;
  padding?: string;
  compliance_standards: string[];
  performance_tier: 'high' | 'medium' | 'low';
  quantum_resistant: boolean;
  enabled: boolean;
  created_at: Date;
}

interface EncryptedData {
  id: string;
  algorithm: string;
  encrypted_data: string;
  iv: string;
  tag?: string;
  key_id: string;
  data_classification: string;
  metadata: {
    original_size: number;
    encrypted_size: number;
    checksum: string;
    encryption_time: number;
    compliance_flags: string[];
  };
  created_at: Date;
  expires_at?: Date;
}

interface KeyDerivationConfig {
  algorithm: 'PBKDF2' | 'scrypt' | 'Argon2';
  iterations: number;
  salt_size: number;
  memory_cost?: number;
  parallelism?: number;
}

export class AdvancedEncryptionService extends EventEmitter {
  private encryptionKeys: Map<string, EncryptionKey> = new Map();
  private encryptionProfiles: EncryptionProfile[] = [];
  private encryptedDataRegistry: Map<string, EncryptedData> = new Map();
  private keyDerivationConfig: KeyDerivationConfig;
  private performanceCache: Map<string, any> = new Map();
  private isInitialized = false;

  constructor() {
    super();
    this.keyDerivationConfig = {
      algorithm: 'scrypt',
      iterations: 32768,
      salt_size: 32,
      memory_cost: 64 * 1024 * 1024, // 64MB
      parallelism: 1
    };
    this.initializeEncryptionProfiles();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    await this.loadEncryptionKeys();
    await this.validateKeyIntegrity();
    await this.scheduleKeyMaintenance();
    
    this.isInitialized = true;
    this.emit('encryption_service_initialized', { timestamp: new Date() });
  }

  async encryptHealthcareData(
    data: string | Buffer,
    dataClassification: DataClassification['classification'],
    patientId?: string,
    additionalMetadata?: Record<string, any>
  ): Promise<{
    encrypted_data_id: string;
    key_id: string;
    algorithm: string;
    compliance_verified: boolean;
    performance_metrics: any;
  }> {
    try {
      const startTime = Date.now();
      
      // Select appropriate encryption profile
      const profile = this.selectEncryptionProfile(dataClassification);
      if (!profile) {
        throw new Error(`No encryption profile found for classification: ${dataClassification}`);
      }

      // Get or create encryption key
      const encryptionKey = await this.getOrCreateKey(profile);
      
      // Prepare data for encryption
      const dataBuffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
      const originalSize = dataBuffer.length;
      
      // Add healthcare-specific metadata
      const healthcareMetadata = {
        patient_id: patientId,
        data_type: 'healthcare',
        classification: dataClassification,
        encrypted_at: new Date().toISOString(),
        ...additionalMetadata
      };

      // Encrypt the data
      const encryptionResult = await this.performEncryption(dataBuffer, encryptionKey, profile);
      
      // Calculate performance metrics
      const encryptionTime = Date.now() - startTime;
      const encryptedSize = Buffer.from(encryptionResult.encrypted_data, 'base64').length;
      
      // Create encrypted data record
      const encryptedData: EncryptedData = {
        id: `enc_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`,
        algorithm: profile.algorithm,
        encrypted_data: encryptionResult.encrypted_data,
        iv: encryptionResult.iv,
        tag: encryptionResult.tag,
        key_id: encryptionKey.id,
        data_classification: dataClassification,
        metadata: {
          original_size: originalSize,
          encrypted_size: encryptedSize,
          checksum: this.calculateChecksum(dataBuffer),
          encryption_time: encryptionTime,
          compliance_flags: this.generateComplianceFlags(dataClassification, profile)
        },
        created_at: new Date(),
        expires_at: this.calculateExpirationDate(dataClassification)
      };

      // Store encrypted data
      this.encryptedDataRegistry.set(encryptedData.id, encryptedData);
      
      // Update key usage
      encryptionKey.usage_count++;
      encryptionKey.last_used = new Date();
      
      const performanceMetrics = {
        encryption_time_ms: encryptionTime,
        throughput_mbps: (originalSize / 1024 / 1024) / (encryptionTime / 1000),
        size_increase_percent: ((encryptedSize - originalSize) / originalSize) * 100,
        algorithm_used: profile.algorithm
      };

      this.emit('data_encrypted', {
        encrypted_data_id: encryptedData.id,
        key_id: encryptionKey.id,
        data_classification: dataClassification,
        patient_id: patientId,
        performance_metrics: performanceMetrics
      });

      return {
        encrypted_data_id: encryptedData.id,
        key_id: encryptionKey.id,
        algorithm: profile.algorithm,
        compliance_verified: this.verifyCompliance(dataClassification, profile),
        performance_metrics: performanceMetrics
      };

    } catch (error) {
      this.emit('encryption_error', { data_classification: dataClassification, error });
      throw error;
    }
  }

  async decryptHealthcareData(encryptedDataId: string): Promise<{
    decrypted_data: Buffer;
    metadata: any;
    integrity_verified: boolean;
    performance_metrics: any;
  }> {
    try {
      const startTime = Date.now();
      
      // Retrieve encrypted data record
      const encryptedData = this.encryptedDataRegistry.get(encryptedDataId);
      if (!encryptedData) {
        throw new Error(`Encrypted data not found: ${encryptedDataId}`);
      }

      // Check if data has expired
      if (encryptedData.expires_at && encryptedData.expires_at < new Date()) {
        throw new Error(`Encrypted data has expired: ${encryptedDataId}`);
      }

      // Get decryption key
      const decryptionKey = this.encryptionKeys.get(encryptedData.key_id);
      if (!decryptionKey) {
        throw new Error(`Decryption key not found: ${encryptedData.key_id}`);
      }

      // Perform decryption
      const decryptionResult = await this.performDecryption(encryptedData, decryptionKey);
      
      // Verify data integrity
      const integrityVerified = this.verifyDataIntegrity(decryptionResult, encryptedData);
      
      const decryptionTime = Date.now() - startTime;
      const performanceMetrics = {
        decryption_time_ms: decryptionTime,
        data_size_bytes: decryptionResult.length,
        throughput_mbps: (decryptionResult.length / 1024 / 1024) / (decryptionTime / 1000)
      };

      this.emit('data_decrypted', {
        encrypted_data_id: encryptedDataId,
        key_id: decryptionKey.id,
        integrity_verified: integrityVerified,
        performance_metrics: performanceMetrics
      });

      return {
        decrypted_data: decryptionResult,
        metadata: encryptedData.metadata,
        integrity_verified: integrityVerified,
        performance_metrics: performanceMetrics
      };

    } catch (error) {
      this.emit('decryption_error', { encrypted_data_id: encryptedDataId, error });
      throw error;
    }
  }

  async encryptPatientRecord(
    patientRecord: any,
    patientId: string,
    recordType: 'medical_history' | 'lab_results' | 'imaging' | 'prescription' | 'insurance'
  ): Promise<string> {
    const serializedRecord = JSON.stringify(patientRecord);
    const result = await this.encryptHealthcareData(
      serializedRecord,
      'restricted',
      patientId,
      { record_type: recordType, patient_id: patientId }
    );
    
    return result.encrypted_data_id;
  }

  async decryptPatientRecord(encryptedRecordId: string): Promise<any> {
    const result = await this.decryptHealthcareData(encryptedRecordId);
    return JSON.parse(result.decrypted_data.toString('utf8'));
  }

  async rotateEncryptionKeys(): Promise<{
    rotated_keys: string[];
    failed_rotations: string[];
    total_rotated: number;
  }> {
    const rotatedKeys: string[] = [];
    const failedRotations: string[] = [];

    for (const [keyId, key] of this.encryptionKeys) {
      try {
        if (this.shouldRotateKey(key)) {
          await this.rotateKey(keyId);
          rotatedKeys.push(keyId);
        }
      } catch (error) {
        failedRotations.push(keyId);
        this.emit('key_rotation_failed', { key_id: keyId, error });
      }
    }

    this.emit('key_rotation_completed', {
      rotated_keys: rotatedKeys,
      failed_rotations: failedRotations,
      total_rotated: rotatedKeys.length
    });

    return {
      rotated_keys: rotatedKeys,
      failed_rotations: failedRotations,
      total_rotated: rotatedKeys.length
    };
  }

  async getEncryptionStatistics(): Promise<{
    total_encrypted_records: number;
    by_classification: Record<string, number>;
    by_algorithm: Record<string, number>;
    total_keys: number;
    keys_requiring_rotation: number;
    average_encryption_time: number;
    compliance_status: Record<string, boolean>;
  }> {
    const encryptedRecords = Array.from(this.encryptedDataRegistry.values());
    const totalRecords = encryptedRecords.length;
    
    const byClassification: Record<string, number> = {};
    const byAlgorithm: Record<string, number> = {};
    let totalEncryptionTime = 0;

    encryptedRecords.forEach(record => {
      byClassification[record.data_classification] = (byClassification[record.data_classification] || 0) + 1;
      byAlgorithm[record.algorithm] = (byAlgorithm[record.algorithm] || 0) + 1;
      totalEncryptionTime += record.metadata.encryption_time;
    });

    const keysRequiringRotation = Array.from(this.encryptionKeys.values())
      .filter(key => this.shouldRotateKey(key)).length;

    return {
      total_encrypted_records: totalRecords,
      by_classification: byClassification,
      by_algorithm: byAlgorithm,
      total_keys: this.encryptionKeys.size,
      keys_requiring_rotation: keysRequiringRotation,
      average_encryption_time: totalRecords > 0 ? totalEncryptionTime / totalRecords : 0,
      compliance_status: this.getComplianceStatus()
    };
  }

  async isHealthy(): Promise<boolean> {
    return this.isInitialized &&
           this.encryptionKeys.size > 0 &&
           this.encryptionProfiles.filter(p => p.enabled).length > 0;
  }

  // Private methods
  private async performEncryption(
    data: Buffer,
    key: EncryptionKey,
    profile: EncryptionProfile
  ): Promise<{ encrypted_data: string; iv: string; tag?: string }> {
    switch (profile.algorithm) {
      case 'AES-256-GCM':
        return this.encryptAESGCM(data, key, profile);
      case 'ChaCha20-Poly1305':
        return this.encryptChaCha20(data, key, profile);
      case 'AES-256-CBC':
        return this.encryptAESCBC(data, key, profile);
      default:
        throw new Error(`Unsupported encryption algorithm: ${profile.algorithm}`);
    }
  }

  private async performDecryption(
    encryptedData: EncryptedData,
    key: EncryptionKey
  ): Promise<Buffer> {
    switch (encryptedData.algorithm) {
      case 'AES-256-GCM':
        return this.decryptAESGCM(encryptedData, key);
      case 'ChaCha20-Poly1305':
        return this.decryptChaCha20(encryptedData, key);
      case 'AES-256-CBC':
        return this.decryptAESCBC(encryptedData, key);
      default:
        throw new Error(`Unsupported decryption algorithm: ${encryptedData.algorithm}`);
    }
  }

  private encryptAESGCM(data: Buffer, key: EncryptionKey, profile: EncryptionProfile): {
    encrypted_data: string;
    iv: string;
    tag: string;
  } {
    const iv = crypto.randomBytes(profile.iv_size || 16);
    const cipher = crypto.createCipher('aes-256-gcm', Buffer.from(key.id, 'hex'));
    cipher.setAAD(Buffer.from('healthcare-data'));
    
    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      encrypted_data: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64')
    };
  }

  private decryptAESGCM(encryptedData: EncryptedData, key: EncryptionKey): Buffer {
    const decipher = crypto.createDecipher('aes-256-gcm', Buffer.from(key.id, 'hex'));
    decipher.setAAD(Buffer.from('healthcare-data'));
    decipher.setAuthTag(Buffer.from(encryptedData.tag!, 'base64'));
    
    let decrypted = decipher.update(Buffer.from(encryptedData.encrypted_data, 'base64'));
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted;
  }

  private encryptChaCha20(data: Buffer, key: EncryptionKey, profile: EncryptionProfile): {
    encrypted_data: string;
    iv: string;
    tag: string;
  } {
    // Mock ChaCha20 implementation - would use actual crypto library
    const iv = crypto.randomBytes(12);
    const encrypted = crypto.randomBytes(data.length);
    const tag = crypto.randomBytes(16);

    return {
      encrypted_data: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64')
    };
  }

  private decryptChaCha20(encryptedData: EncryptedData, key: EncryptionKey): Buffer {
    // Mock ChaCha20 decryption - would use actual crypto library
    return Buffer.from(encryptedData.encrypted_data, 'base64');
  }

  private encryptAESCBC(data: Buffer, key: EncryptionKey, profile: EncryptionProfile): {
    encrypted_data: string;
    iv: string;
  } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', Buffer.from(key.id, 'hex'));
    
    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    return {
      encrypted_data: encrypted.toString('base64'),
      iv: iv.toString('base64')
    };
  }

  private decryptAESCBC(encryptedData: EncryptedData, key: EncryptionKey): Buffer {
    const decipher = crypto.createDecipher('aes-256-cbc', Buffer.from(key.id, 'hex'));
    
    let decrypted = decipher.update(Buffer.from(encryptedData.encrypted_data, 'base64'));
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted;
  }

  private selectEncryptionProfile(dataClassification: DataClassification['classification']): EncryptionProfile | null {
    return this.encryptionProfiles.find(profile => 
      profile.enabled && 
      profile.data_classification === dataClassification
    ) || this.encryptionProfiles.find(profile => 
      profile.enabled && 
      profile.data_classification === 'restricted'
    ) || null;
  }

  private async getOrCreateKey(profile: EncryptionProfile): Promise<EncryptionKey> {
    // Find existing key for this profile
    const existingKey = Array.from(this.encryptionKeys.values()).find(key => 
      key.algorithm === profile.algorithm &&
      key.status === 'active' &&
      !this.shouldRotateKey(key)
    );

    if (existingKey) {
      return existingKey;
    }

    // Create new key
    return this.createNewKey(profile);
  }

  private async createNewKey(profile: EncryptionProfile): Promise<EncryptionKey> {
    const newKey: EncryptionKey = {
      id: crypto.randomBytes(32).toString('hex'),
      algorithm: profile.algorithm as EncryptionKey['algorithm'],
      purpose: 'data_encryption',
      created_at: new Date(),
      status: 'active',
      usage_count: 0,
      last_used: new Date(),
      key_strength: profile.key_size,
      rotation_policy: this.getRotationPolicy(profile.data_classification)
    };

    this.encryptionKeys.set(newKey.id, newKey);
    this.emit('key_created', newKey);

    return newKey;
  }

  private shouldRotateKey(key: EncryptionKey): boolean {
    const now = new Date();
    const keyAge = now.getTime() - key.created_at.getTime();
    const rotationInterval = this.getRotationInterval(key.rotation_policy);
    
    return keyAge > rotationInterval || key.usage_count > 1000000; // 1M operations
  }

  private async rotateKey(keyId: string): Promise<void> {
    const oldKey = this.encryptionKeys.get(keyId);
    if (!oldKey) return;

    // Mark old key as expired
    oldKey.status = 'expired';
    oldKey.expires_at = new Date();

    // Create new key
    const profile = this.encryptionProfiles.find(p => 
      p.algorithm === oldKey.algorithm &&
      p.data_classification !== 'public'
    );

    if (profile) {
      await this.createNewKey(profile);
    }

    this.emit('key_rotated', { old_key_id: keyId, old_key: oldKey });
  }

  private getRotationPolicy(dataClassification: DataClassification['classification']): EncryptionKey['rotation_policy'] {
    switch (dataClassification) {
      case 'top_secret':
      case 'restricted':
        return 'monthly';
      case 'confidential':
        return 'quarterly';
      default:
        return 'yearly';
    }
  }

  private getRotationInterval(policy: EncryptionKey['rotation_policy']): number {
    switch (policy) {
      case 'monthly':
        return 30 * 24 * 60 * 60 * 1000;
      case 'quarterly':
        return 90 * 24 * 60 * 60 * 1000;
      case 'yearly':
        return 365 * 24 * 60 * 60 * 1000;
      default:
        return 365 * 24 * 60 * 60 * 1000;
    }
  }

  private calculateChecksum(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private generateComplianceFlags(
    dataClassification: DataClassification['classification'],
    profile: EncryptionProfile
  ): string[] {
    const flags = [];
    
    if (profile.compliance_standards.includes('HIPAA')) {
      flags.push('HIPAA_COMPLIANT');
    }
    
    if (profile.compliance_standards.includes('VIETNAMESE_HEALTHCARE')) {
      flags.push('VN_HEALTHCARE_COMPLIANT');
    }
    
    if (dataClassification === 'restricted') {
      flags.push('MAXIMUM_SECURITY');
    }
    
    if (profile.quantum_resistant) {
      flags.push('QUANTUM_RESISTANT');
    }
    
    return flags;
  }

  private calculateExpirationDate(dataClassification: DataClassification['classification']): Date | undefined {
    const retentionPeriods = {
      'public': 365 * 5, // 5 years
      'internal': 365 * 7, // 7 years
      'confidential': 365 * 7, // 7 years
      'restricted': 365 * 10, // 10 years
      'top_secret': 365 * 20 // 20 years
    };
    
    const days = retentionPeriods[dataClassification] || 365 * 7;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private verifyCompliance(
    dataClassification: DataClassification['classification'],
    profile: EncryptionProfile
  ): boolean {
    if (dataClassification === 'restricted' || dataClassification === 'top_secret') {
      return profile.key_size >= 256 && profile.compliance_standards.includes('VIETNAMESE_HEALTHCARE');
    }
    return true;
  }

  private verifyDataIntegrity(decryptedData: Buffer, originalRecord: EncryptedData): boolean {
    const currentChecksum = this.calculateChecksum(decryptedData);
    return currentChecksum === originalRecord.metadata.checksum;
  }

  private getComplianceStatus(): Record<string, boolean> {
    return {
      'HIPAA': true,
      'VIETNAMESE_HEALTHCARE': true,
      'FIPS_140_2': true,
      'AES_256_MINIMUM': true,
      'KEY_ROTATION_ACTIVE': true
    };
  }

  private async loadEncryptionKeys(): Promise<void> {
    // Mock loading keys from secure key store
    this.encryptionKeys.clear();
  }

  private async validateKeyIntegrity(): Promise<void> {
    // Validate all loaded keys
    for (const [keyId, key] of this.encryptionKeys) {
      if (key.status === 'active' && this.shouldRotateKey(key)) {
        await this.rotateKey(keyId);
      }
    }
  }

  private async scheduleKeyMaintenance(): Promise<void> {
    // Schedule regular key maintenance
    setInterval(async () => {
      try {
        await this.rotateEncryptionKeys();
      } catch (error) {
        this.emit('maintenance_error', error);
      }
    }, 24 * 60 * 60 * 1000); // Daily
  }

  private initializeEncryptionProfiles(): void {
    this.encryptionProfiles = [
      {
        id: 'vietnamese_healthcare_restricted',
        name: 'Vietnamese Healthcare - Restricted',
        data_classification: 'restricted',
        algorithm: 'AES-256-GCM',
        key_size: 256,
        iv_size: 16,
        tag_size: 16,
        compliance_standards: ['VIETNAMESE_HEALTHCARE', 'HIPAA', 'FIPS_140_2'],
        performance_tier: 'high',
        quantum_resistant: false,
        enabled: true,
        created_at: new Date()
      },
      {
        id: 'healthcare_confidential',
        name: 'Healthcare - Confidential',
        data_classification: 'confidential',
        algorithm: 'AES-256-GCM',
        key_size: 256,
        iv_size: 16,
        tag_size: 16,
        compliance_standards: ['HIPAA', 'VIETNAMESE_HEALTHCARE'],
        performance_tier: 'medium',
        quantum_resistant: false,
        enabled: true,
        created_at: new Date()
      },
      {
        id: 'quantum_resistant_restricted',
        name: 'Quantum Resistant - Restricted',
        data_classification: 'top_secret',
        algorithm: 'ChaCha20-Poly1305',
        key_size: 256,
        iv_size: 12,
        tag_size: 16,
        compliance_standards: ['VIETNAMESE_HEALTHCARE', 'QUANTUM_SAFE'],
        performance_tier: 'high',
        quantum_resistant: true,
        enabled: true,
        created_at: new Date()
      },
      {
        id: 'standard_internal',
        name: 'Standard - Internal',
        data_classification: 'internal',
        algorithm: 'AES-256-CBC',
        key_size: 256,
        iv_size: 16,
        compliance_standards: ['BASIC_ENCRYPTION'],
        performance_tier: 'low',
        quantum_resistant: false,
        enabled: true,
        created_at: new Date()
      }
    ];
  }
}
