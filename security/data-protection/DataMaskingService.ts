import crypto from 'crypto';
import { EventEmitter } from 'events';

export interface MaskingRule {
  fieldName: string;
  maskingType: 'full' | 'partial' | 'hash' | 'tokenize' | 'synthetic' | 'redact';
  pattern?: string;
  preserveLength?: boolean;
  preserveFormat?: boolean;
  customMask?: string;
  sensitivity: 'low' | 'medium' | 'high' | 'critical';
  context?: string[];
}

export interface MaskingProfile {
  profileName: string;
  description: string;
  rules: MaskingRule[];
  isActive: boolean;
  environment: 'development' | 'testing' | 'staging' | 'production';
  createdAt: Date;
  updatedAt: Date;
}

export interface SyntheticDataConfig {
  dataType: 'name' | 'email' | 'phone' | 'ssn' | 'address' | 'creditcard' | 'date' | 'number';
  locale: string;
  format?: string;
  range?: { min: number; max: number };
}

export interface MaskingMetrics {
  totalFieldsMasked: number;
  maskingOperationsPerformed: number;
  averageMaskingTime: number;
  dataTypesProcessed: Map<string, number>;
  sensitivityLevels: Map<string, number>;
  errorCount: number;
}

export interface TokenMapping {
  originalValue: string;
  token: string;
  fieldName: string;
  timestamp: Date;
  usageCount: number;
}

export class DataMaskingService extends EventEmitter {
  private maskingProfiles: Map<string, MaskingProfile>;
  private tokenMappings: Map<string, TokenMapping>;
  private syntheticGenerators: Map<string, () => string>;
  private metrics: MaskingMetrics;
  private isInitialized: boolean = false;

  constructor() {
    super();
    this.maskingProfiles = new Map();
    this.tokenMappings = new Map();
    this.syntheticGenerators = new Map();
    this.metrics = {
      totalFieldsMasked: 0,
      maskingOperationsPerformed: 0,
      averageMaskingTime: 0,
      dataTypesProcessed: new Map(),
      sensitivityLevels: new Map(),
      errorCount: 0
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.setupDefaultProfiles();
      this.initializeSyntheticGenerators();
      this.startMetricsCollection();
      
      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      this.emit('initializationError', error);
      throw error;
    }
  }

  private async setupDefaultProfiles(): Promise<void> {
    // Healthcare-specific masking profiles
    const healthcareProfile: MaskingProfile = {
      profileName: 'healthcare_standard',
      description: 'Standard healthcare data masking for HIPAA compliance',
      environment: 'production',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      rules: [
        {
          fieldName: 'patient_ssn',
          maskingType: 'partial',
          pattern: 'XXX-XX-####',
          sensitivity: 'critical',
          context: ['patient', 'identity']
        },
        {
          fieldName: 'medical_record_number',
          maskingType: 'hash',
          preserveLength: false,
          sensitivity: 'high',
          context: ['medical', 'identifier']
        },
        {
          fieldName: 'patient_name',
          maskingType: 'synthetic',
          sensitivity: 'high',
          context: ['patient', 'identity']
        },
        {
          fieldName: 'date_of_birth',
          maskingType: 'partial',
          pattern: 'XX/XX/YYYY',
          sensitivity: 'high',
          context: ['patient', 'demographics']
        },
        {
          fieldName: 'phone_number',
          maskingType: 'partial',
          pattern: 'XXX-XXX-####',
          sensitivity: 'medium',
          context: ['contact']
        },
        {
          fieldName: 'email_address',
          maskingType: 'partial',
          pattern: 'X***@***.com',
          sensitivity: 'medium',
          context: ['contact']
        },
        {
          fieldName: 'diagnosis_code',
          maskingType: 'tokenize',
          sensitivity: 'high',
          context: ['medical', 'diagnosis']
        },
        {
          fieldName: 'treatment_notes',
          maskingType: 'redact',
          customMask: '[REDACTED - MEDICAL NOTES]',
          sensitivity: 'critical',
          context: ['medical', 'notes']
        },
        {
          fieldName: 'insurance_policy_number',
          maskingType: 'hash',
          sensitivity: 'high',
          context: ['insurance', 'financial']
        },
        {
          fieldName: 'payment_card_number',
          maskingType: 'partial',
          pattern: 'XXXX-XXXX-XXXX-####',
          sensitivity: 'critical',
          context: ['financial', 'payment']
        }
      ]
    };

    const testingProfile: MaskingProfile = {
      profileName: 'testing_environment',
      description: 'Testing environment with synthetic data',
      environment: 'testing',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      rules: [
        {
          fieldName: 'patient_ssn',
          maskingType: 'synthetic',
          sensitivity: 'critical',
          context: ['patient', 'identity']
        },
        {
          fieldName: 'patient_name',
          maskingType: 'synthetic',
          sensitivity: 'high',
          context: ['patient', 'identity']
        },
        {
          fieldName: 'date_of_birth',
          maskingType: 'synthetic',
          sensitivity: 'high',
          context: ['patient', 'demographics']
        }
      ]
    };

    this.maskingProfiles.set('healthcare_standard', healthcareProfile);
    this.maskingProfiles.set('testing_environment', testingProfile);
  }

  private initializeSyntheticGenerators(): void {
    this.syntheticGenerators.set('name', () => this.generateSyntheticName());
    this.syntheticGenerators.set('email', () => this.generateSyntheticEmail());
    this.syntheticGenerators.set('phone', () => this.generateSyntheticPhone());
    this.syntheticGenerators.set('ssn', () => this.generateSyntheticSSN());
    this.syntheticGenerators.set('address', () => this.generateSyntheticAddress());
    this.syntheticGenerators.set('date', () => this.generateSyntheticDate());
  }

  async maskData(data: any, profileName: string): Promise<any> {
    const startTime = Date.now();
    
    try {
      const profile = this.maskingProfiles.get(profileName);
      if (!profile || !profile.isActive) {
        throw new Error(`Masking profile not found or inactive: ${profileName}`);
      }

      const maskedData = await this.processDataWithProfile(data, profile);
      
      this.updateMetrics(Date.now() - startTime, profile);
      this.emit('dataMasked', { profileName, originalSize: JSON.stringify(data).length });
      
      return maskedData;
    } catch (error) {
      this.metrics.errorCount++;
      this.emit('maskingError', { profileName, error });
      throw error;
    }
  }

  private async processDataWithProfile(data: any, profile: MaskingProfile): Promise<any> {
    if (Array.isArray(data)) {
      return Promise.all(data.map(item => this.processDataWithProfile(item, profile)));
    }

    if (typeof data === 'object' && data !== null) {
      const maskedObject: any = {};
      
      for (const [key, value] of Object.entries(data)) {
        const rule = profile.rules.find(r => r.fieldName === key);
        
        if (rule) {
          maskedObject[key] = await this.applyMaskingRule(value, rule);
          this.metrics.totalFieldsMasked++;
          this.updateDataTypeMetrics(typeof value);
          this.updateSensitivityMetrics(rule.sensitivity);
        } else {
          // Recursively process nested objects
          maskedObject[key] = await this.processDataWithProfile(value, profile);
        }
      }
      
      return maskedObject;
    }

    return data;
  }

  private async applyMaskingRule(value: any, rule: MaskingRule): Promise<any> {
    if (value === null || value === undefined) {
      return value;
    }

    const stringValue = String(value);
    
    switch (rule.maskingType) {
      case 'full':
        return this.fullMask(stringValue, rule);
      
      case 'partial':
        return this.partialMask(stringValue, rule);
      
      case 'hash':
        return this.hashMask(stringValue, rule);
      
      case 'tokenize':
        return await this.tokenizeMask(stringValue, rule);
      
      case 'synthetic':
        return this.syntheticMask(stringValue, rule);
      
      case 'redact':
        return this.redactMask(stringValue, rule);
      
      default:
        return stringValue;
    }
  }

  private fullMask(value: string, rule: MaskingRule): string {
    const maskChar = rule.customMask || '*';
    return rule.preserveLength ? maskChar.repeat(value.length) : maskChar.repeat(8);
  }

  private partialMask(value: string, rule: MaskingRule): string {
    if (rule.pattern) {
      return this.applyPattern(value, rule.pattern);
    }

    // Default partial masking: show first 2 and last 2 characters
    if (value.length <= 4) {
      return '*'.repeat(value.length);
    }

    const start = value.substring(0, 2);
    const end = value.substring(value.length - 2);
    const middle = '*'.repeat(value.length - 4);
    
    return start + middle + end;
  }

  private applyPattern(value: string, pattern: string): string {
    let result = '';
    let valueIndex = 0;
    
    for (let i = 0; i < pattern.length; i++) {
      const patternChar = pattern[i];
      
      if (patternChar === 'X') {
        // Mask this character
        result += '*';
        valueIndex++;
      } else if (patternChar === '#') {
        // Preserve this character
        if (valueIndex < value.length) {
          result += value[valueIndex];
          valueIndex++;
        }
      } else {
        // Literal character
        result += patternChar;
      }
    }
    
    return result;
  }

  private hashMask(value: string, rule: MaskingRule): string {
    const hash = crypto.createHash('sha256').update(value).digest('hex');
    
    if (rule.preserveLength && value.length < hash.length) {
      return hash.substring(0, value.length);
    }
    
    return hash;
  }

  private async tokenizeMask(value: string, rule: MaskingRule): Promise<string> {
    // Check if we already have a token for this value
    const existingMapping = Array.from(this.tokenMappings.values())
      .find(mapping => mapping.originalValue === value && mapping.fieldName === rule.fieldName);
    
    if (existingMapping) {
      existingMapping.usageCount++;
      return existingMapping.token;
    }

    // Generate new token
    const token = this.generateToken(rule.preserveLength ? value.length : 16);
    
    const mapping: TokenMapping = {
      originalValue: value,
      token,
      fieldName: rule.fieldName,
      timestamp: new Date(),
      usageCount: 1
    };
    
    this.tokenMappings.set(token, mapping);
    return token;
  }

  private syntheticMask(value: string, rule: MaskingRule): string {
    // Determine data type based on field name and value
    const fieldName = rule.fieldName.toLowerCase();
    
    if (fieldName.includes('name')) {
      return this.generateSyntheticName();
    } else if (fieldName.includes('email')) {
      return this.generateSyntheticEmail();
    } else if (fieldName.includes('phone')) {
      return this.generateSyntheticPhone();
    } else if (fieldName.includes('ssn')) {
      return this.generateSyntheticSSN();
    } else if (fieldName.includes('address')) {
      return this.generateSyntheticAddress();
    } else if (fieldName.includes('date')) {
      return this.generateSyntheticDate();
    } else {
      // Default synthetic generation
      return this.generateRandomString(value.length);
    }
  }

  private redactMask(value: string, rule: MaskingRule): string {
    return rule.customMask || '[REDACTED]';
  }

  private generateToken(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private generateSyntheticName(): string {
    const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Lisa', 'James', 'Mary', 'Robert', 'Patricia'];
    const lastNames = ['Smith', 'Johnson', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas'];
    
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    
    return `${firstName} ${lastName}`;
  }

  private generateSyntheticEmail(): string {
    const domains = ['example.com', 'test.org', 'sample.net', 'demo.co'];
    const prefixes = ['user', 'test', 'demo', 'sample'];
    
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const domain = domains[Math.floor(Math.random() * domains.length)];
    const number = Math.floor(Math.random() * 9999);
    
    return `${prefix}${number}@${domain}`;
  }

  private generateSyntheticPhone(): string {
    const areaCode = Math.floor(Math.random() * 800) + 200;
    const exchange = Math.floor(Math.random() * 800) + 200;
    const number = Math.floor(Math.random() * 9999);
    
    return `${areaCode}-${exchange}-${number.toString().padStart(4, '0')}`;
  }

  private generateSyntheticSSN(): string {
    const area = Math.floor(Math.random() * 800) + 100;
    const group = Math.floor(Math.random() * 100);
    const serial = Math.floor(Math.random() * 10000);
    
    return `${area}-${group.toString().padStart(2, '0')}-${serial.toString().padStart(4, '0')}`;
  }

  private generateSyntheticAddress(): string {
    const numbers = Math.floor(Math.random() * 9999) + 1;
    const streets = ['Main St', 'Oak Ave', 'Pine Rd', 'Elm Dr', 'Cedar Ln'];
    const street = streets[Math.floor(Math.random() * streets.length)];
    
    return `${numbers} ${street}`;
  }

  private generateSyntheticDate(): string {
    const start = new Date(1950, 0, 1);
    const end = new Date(2010, 11, 31);
    const randomDate = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    
    return randomDate.toISOString().split('T')[0];
  }

  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  async detokenize(token: string): Promise<string | null> {
    const mapping = this.tokenMappings.get(token);
    return mapping ? mapping.originalValue : null;
  }

  createMaskingProfile(profile: Omit<MaskingProfile, 'createdAt' | 'updatedAt'>): void {
    const newProfile: MaskingProfile = {
      ...profile,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.maskingProfiles.set(profile.profileName, newProfile);
    this.emit('profileCreated', { profileName: profile.profileName });
  }

  updateMaskingProfile(profileName: string, updates: Partial<MaskingProfile>): void {
    const profile = this.maskingProfiles.get(profileName);
    if (!profile) {
      throw new Error(`Profile not found: ${profileName}`);
    }

    const updatedProfile = {
      ...profile,
      ...updates,
      updatedAt: new Date()
    };

    this.maskingProfiles.set(profileName, updatedProfile);
    this.emit('profileUpdated', { profileName });
  }

  getMaskingProfile(profileName: string): MaskingProfile | undefined {
    return this.maskingProfiles.get(profileName);
  }

  getAllMaskingProfiles(): MaskingProfile[] {
    return Array.from(this.maskingProfiles.values());
  }

  private updateMetrics(processingTime: number, profile: MaskingProfile): void {
    this.metrics.maskingOperationsPerformed++;
    this.metrics.averageMaskingTime = 
      (this.metrics.averageMaskingTime * (this.metrics.maskingOperationsPerformed - 1) + processingTime) /
      this.metrics.maskingOperationsPerformed;
  }

  private updateDataTypeMetrics(dataType: string): void {
    const current = this.metrics.dataTypesProcessed.get(dataType) || 0;
    this.metrics.dataTypesProcessed.set(dataType, current + 1);
  }

  private updateSensitivityMetrics(sensitivity: string): void {
    const current = this.metrics.sensitivityLevels.get(sensitivity) || 0;
    this.metrics.sensitivityLevels.set(sensitivity, current + 1);
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      this.emit('metricsReport', this.getMetrics());
    }, 60000); // Every minute
  }

  getMetrics(): MaskingMetrics {
    return {
      totalFieldsMasked: this.metrics.totalFieldsMasked,
      maskingOperationsPerformed: this.metrics.maskingOperationsPerformed,
      averageMaskingTime: this.metrics.averageMaskingTime,
      dataTypesProcessed: new Map(this.metrics.dataTypesProcessed),
      sensitivityLevels: new Map(this.metrics.sensitivityLevels),
      errorCount: this.metrics.errorCount
    };
  }

  getTokenMappingStats(): { totalTokens: number; activeTokens: number; mostUsedTokens: TokenMapping[] } {
    const mappings = Array.from(this.tokenMappings.values());
    const activeTokens = mappings.filter(m => m.usageCount > 0);
    const mostUsed = mappings.sort((a, b) => b.usageCount - a.usageCount).slice(0, 10);

    return {
      totalTokens: mappings.length,
      activeTokens: activeTokens.length,
      mostUsedTokens: mostUsed
    };
  }

  async clearTokenMappings(olderThanDays: number = 30): Promise<void> {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    for (const [token, mapping] of this.tokenMappings.entries()) {
      if (mapping.timestamp < cutoffDate) {
        this.tokenMappings.delete(token);
        deletedCount++;
      }
    }

    this.emit('tokenMappingsCleared', { deletedCount, cutoffDate });
  }

  async shutdown(): Promise<void> {
    this.emit('shutdown');
    this.removeAllListeners();
  }
}

export default DataMaskingService;
