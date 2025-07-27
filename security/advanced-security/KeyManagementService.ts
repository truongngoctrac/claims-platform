import { EncryptionKey } from '../types';
import { EventEmitter } from 'events';
import crypto from 'crypto';

interface KeyVault {
  id: string;
  name: string;
  type: 'software' | 'hardware' | 'cloud' | 'hsm';
  location: string;
  keys: string[];
  capacity: number;
  security_level: 'fips_140_1' | 'fips_140_2' | 'fips_140_3' | 'common_criteria';
  backup_enabled: boolean;
  high_availability: boolean;
  created_at: Date;
}

interface KeyPolicy {
  id: string;
  name: string;
  key_types: string[];
  minimum_key_length: number;
  maximum_age_days: number;
  usage_limits: {
    max_operations: number;
    max_data_size: number;
  };
  rotation_schedule: string; // cron expression
  backup_required: boolean;
  compliance_requirements: string[];
  approval_required: boolean;
  approvers: string[];
  enabled: boolean;
}

interface KeyOperation {
  id: string;
  key_id: string;
  operation: 'create' | 'rotate' | 'revoke' | 'export' | 'import' | 'backup' | 'restore';
  user_id: string;
  timestamp: Date;
  success: boolean;
  details: any;
  compliance_logged: boolean;
}

interface KeyEscrow {
  id: string;
  key_id: string;
  encrypted_key_material: string;
  escrow_agents: string[];
  threshold: number; // M-of-N threshold
  created_at: Date;
  access_reason?: string;
  accessed_by?: string;
  accessed_at?: Date;
}

export class KeyManagementService extends EventEmitter {
  private keyVaults: Map<string, KeyVault> = new Map();
  private keyPolicies: KeyPolicy[] = [];
  private keyOperations: KeyOperation[] = [];
  private keyEscrows: Map<string, KeyEscrow> = new Map();
  private managedKeys: Map<string, EncryptionKey> = new Map();
  private keyBackups: Map<string, any> = new Map();
  private isInitialized = false;

  constructor() {
    super();
    this.initializeKeyVaults();
    this.initializeKeyPolicies();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    await this.loadManagedKeys();
    await this.scheduleKeyOperations();
    await this.validateKeyCompliance();
    
    this.isInitialized = true;
    this.emit('key_management_initialized', { timestamp: new Date() });
  }

  async createMasterKey(
    algorithm: EncryptionKey['algorithm'],
    purpose: EncryptionKey['purpose'],
    keyLength: number = 256,
    vaultId?: string
  ): Promise<{
    key_id: string;
    vault_id: string;
    escrow_created: boolean;
    backup_created: boolean;
  }> {
    try {
      // Select appropriate vault
      const vault = vaultId ? 
        this.keyVaults.get(vaultId) : 
        this.selectOptimalVault(algorithm, purpose);
      
      if (!vault) {
        throw new Error('No suitable key vault available');
      }

      // Check vault capacity
      if (vault.keys.length >= vault.capacity) {
        throw new Error(`Key vault ${vault.id} at capacity`);
      }

      // Validate against policies
      await this.validateKeyCreation(algorithm, purpose, keyLength);

      // Generate key material
      const keyMaterial = await this.generateKeyMaterial(algorithm, keyLength);
      
      // Create key record
      const masterKey: EncryptionKey = {
        id: crypto.randomBytes(32).toString('hex'),
        algorithm,
        purpose,
        created_at: new Date(),
        status: 'active',
        usage_count: 0,
        last_used: new Date(),
        key_strength: keyLength,
        rotation_policy: this.determineRotationPolicy(purpose)
      };

      // Store in vault
      await this.storeKeyInVault(masterKey, vault, keyMaterial);
      
      // Create escrow copy if required
      let escrowCreated = false;
      if (this.requiresEscrow(purpose)) {
        await this.createKeyEscrow(masterKey, keyMaterial);
        escrowCreated = true;
      }

      // Create backup
      const backupCreated = await this.createKeyBackup(masterKey, keyMaterial);

      // Log operation
      await this.logKeyOperation('create', masterKey.id, 'system', true, {
        algorithm,
        purpose,
        vault_id: vault.id,
        escrow_created: escrowCreated,
        backup_created: backupCreated
      });

      this.emit('master_key_created', {
        key_id: masterKey.id,
        vault_id: vault.id,
        algorithm,
        purpose
      });

      return {
        key_id: masterKey.id,
        vault_id: vault.id,
        escrow_created: escrowCreated,
        backup_created: backupCreated
      };

    } catch (error) {
      this.emit('key_creation_failed', { algorithm, purpose, error });
      throw error;
    }
  }

  async rotateKey(keyId: string, userId: string): Promise<{
    old_key_id: string;
    new_key_id: string;
    migration_required: boolean;
    affected_data_count: number;
  }> {
    try {
      const oldKey = this.managedKeys.get(keyId);
      if (!oldKey) {
        throw new Error(`Key not found: ${keyId}`);
      }

      if (oldKey.status !== 'active') {
        throw new Error(`Cannot rotate key in status: ${oldKey.status}`);
      }

      // Create new key with same properties
      const newKeyResult = await this.createMasterKey(
        oldKey.algorithm,
        oldKey.purpose,
        oldKey.key_strength
      );

      // Mark old key as rotated
      oldKey.status = 'rotated';
      oldKey.expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days grace period

      // Estimate affected data
      const affectedDataCount = await this.estimateAffectedData(keyId);
      const migrationRequired = affectedDataCount > 0;

      // Schedule data migration if needed
      if (migrationRequired) {
        await this.scheduleMigration(keyId, newKeyResult.key_id);
      }

      await this.logKeyOperation('rotate', keyId, userId, true, {
        new_key_id: newKeyResult.key_id,
        migration_required: migrationRequired,
        affected_data_count: affectedDataCount
      });

      this.emit('key_rotated', {
        old_key_id: keyId,
        new_key_id: newKeyResult.key_id,
        user_id: userId,
        migration_required: migrationRequired
      });

      return {
        old_key_id: keyId,
        new_key_id: newKeyResult.key_id,
        migration_required: migrationRequired,
        affected_data_count: affectedDataCount
      };

    } catch (error) {
      await this.logKeyOperation('rotate', keyId, userId, false, { error: error.message });
      throw error;
    }
  }

  async revokeKey(keyId: string, userId: string, reason: string): Promise<{
    revoked: boolean;
    immediate_impact: string[];
    grace_period_days: number;
  }> {
    try {
      const key = this.managedKeys.get(keyId);
      if (!key) {
        throw new Error(`Key not found: ${keyId}`);
      }

      // Check if revocation is allowed
      const canRevoke = await this.canRevokeKey(keyId, userId);
      if (!canRevoke.allowed) {
        throw new Error(`Key revocation denied: ${canRevoke.reason}`);
      }

      // Assess immediate impact
      const immediateImpact = await this.assessRevocationImpact(keyId);
      
      // Set grace period based on key purpose
      const gracePeriodDays = this.calculateGracePeriod(key.purpose);
      
      // Mark key as revoked
      key.status = 'revoked';
      key.expires_at = new Date(Date.now() + gracePeriodDays * 24 * 60 * 60 * 1000);

      // Schedule emergency rotation for critical systems
      if (immediateImpact.includes('critical_system')) {
        await this.scheduleEmergencyRotation(keyId);
      }

      await this.logKeyOperation('revoke', keyId, userId, true, {
        reason,
        immediate_impact: immediateImpact,
        grace_period_days: gracePeriodDays
      });

      this.emit('key_revoked', {
        key_id: keyId,
        user_id: userId,
        reason,
        immediate_impact: immediateImpact
      });

      return {
        revoked: true,
        immediate_impact: immediateImpact,
        grace_period_days: gracePeriodDays
      };

    } catch (error) {
      await this.logKeyOperation('revoke', keyId, userId, false, { error: error.message });
      throw error;
    }
  }

  async backupKeys(vaultId?: string): Promise<{
    backed_up_keys: string[];
    backup_location: string;
    backup_encrypted: boolean;
    compliance_verified: boolean;
  }> {
    try {
      const keysToBackup = vaultId ? 
        Array.from(this.managedKeys.values()).filter(key => {
          const vault = this.findKeyVault(key.id);
          return vault?.id === vaultId;
        }) :
        Array.from(this.managedKeys.values()).filter(key => key.status === 'active');

      const backedUpKeys: string[] = [];
      
      for (const key of keysToBackup) {
        try {
          const keyMaterial = await this.getKeyMaterial(key.id);
          const backupId = await this.createKeyBackup(key, keyMaterial);
          backedUpKeys.push(key.id);
        } catch (error) {
          this.emit('key_backup_failed', { key_id: key.id, error });
        }
      }

      const backupLocation = this.getBackupLocation();
      const backupEncrypted = true;
      const complianceVerified = await this.verifyBackupCompliance();

      this.emit('keys_backed_up', {
        count: backedUpKeys.length,
        vault_id: vaultId,
        backup_location: backupLocation
      });

      return {
        backed_up_keys: backedUpKeys,
        backup_location: backupLocation,
        backup_encrypted: backupEncrypted,
        compliance_verified: complianceVerified
      };

    } catch (error) {
      this.emit('backup_failed', { vault_id: vaultId, error });
      throw error;
    }
  }

  async recoverKey(keyId: string, userId: string, justification: string): Promise<{
    recovered: boolean;
    key_material?: string;
    conditions: string[];
    approval_required: boolean;
  }> {
    try {
      const key = this.managedKeys.get(keyId);
      if (!key) {
        throw new Error(`Key not found: ${keyId}`);
      }

      // Check recovery eligibility
      const eligibility = await this.checkRecoveryEligibility(keyId, userId);
      if (!eligibility.eligible) {
        throw new Error(`Key recovery denied: ${eligibility.reason}`);
      }

      const conditions = ['audit_logged', 'time_limited_access', 'monitoring_enabled'];
      let keyMaterial: string | undefined;

      if (eligibility.approval_required) {
        await this.requestRecoveryApproval(keyId, userId, justification);
        return {
          recovered: false,
          conditions,
          approval_required: true
        };
      }

      // Attempt recovery from escrow
      const escrow = this.keyEscrows.get(keyId);
      if (escrow) {
        keyMaterial = await this.recoverFromEscrow(keyId, userId);
      } else {
        // Attempt recovery from backup
        keyMaterial = await this.recoverFromBackup(keyId);
      }

      if (keyMaterial) {
        await this.logKeyOperation('restore', keyId, userId, true, {
          justification,
          recovery_method: escrow ? 'escrow' : 'backup'
        });

        this.emit('key_recovered', {
          key_id: keyId,
          user_id: userId,
          justification
        });

        return {
          recovered: true,
          key_material: keyMaterial,
          conditions,
          approval_required: false
        };
      }

      throw new Error('Key recovery failed - no valid recovery method available');

    } catch (error) {
      await this.logKeyOperation('restore', keyId, userId, false, { error: error.message });
      throw error;
    }
  }

  async getKeyManagementStatistics(): Promise<{
    total_keys: number;
    by_status: Record<string, number>;
    by_algorithm: Record<string, number>;
    by_vault: Record<string, number>;
    rotation_due: number;
    backup_status: { current: number; outdated: number };
    compliance_score: number;
    recent_operations: KeyOperation[];
  }> {
    const keys = Array.from(this.managedKeys.values());
    const totalKeys = keys.length;

    const byStatus: Record<string, number> = {};
    const byAlgorithm: Record<string, number> = {};
    const byVault: Record<string, number> = {};

    keys.forEach(key => {
      byStatus[key.status] = (byStatus[key.status] || 0) + 1;
      byAlgorithm[key.algorithm] = (byAlgorithm[key.algorithm] || 0) + 1;
      
      const vault = this.findKeyVault(key.id);
      if (vault) {
        byVault[vault.name] = (byVault[vault.name] || 0) + 1;
      }
    });

    const rotationDue = keys.filter(key => this.isRotationDue(key)).length;
    
    const backupStatus = {
      current: this.keyBackups.size,
      outdated: keys.length - this.keyBackups.size
    };

    const complianceScore = this.calculateComplianceScore();
    
    const recentOperations = this.keyOperations
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);

    return {
      total_keys: totalKeys,
      by_status: byStatus,
      by_algorithm: byAlgorithm,
      by_vault: byVault,
      rotation_due: rotationDue,
      backup_status: backupStatus,
      compliance_score: complianceScore,
      recent_operations: recentOperations
    };
  }

  async isHealthy(): Promise<boolean> {
    return this.isInitialized &&
           this.keyVaults.size > 0 &&
           this.managedKeys.size > 0 &&
           Array.from(this.keyVaults.values()).some(vault => vault.high_availability);
  }

  // Private helper methods
  private selectOptimalVault(algorithm: string, purpose: string): KeyVault | null {
    const vaults = Array.from(this.keyVaults.values())
      .filter(vault => vault.keys.length < vault.capacity)
      .sort((a, b) => {
        // Prefer HSM for high-security keys
        if (purpose === 'key_encryption' || purpose === 'signing') {
          if (a.type === 'hsm' && b.type !== 'hsm') return -1;
          if (b.type === 'hsm' && a.type !== 'hsm') return 1;
        }
        
        // Prefer higher security levels
        const securityLevelPriority = {
          'fips_140_3': 4,
          'fips_140_2': 3,
          'fips_140_1': 2,
          'common_criteria': 1
        };
        
        return securityLevelPriority[b.security_level] - securityLevelPriority[a.security_level];
      });

    return vaults[0] || null;
  }

  private async validateKeyCreation(algorithm: string, purpose: string, keyLength: number): Promise<void> {
    const applicablePolicies = this.keyPolicies.filter(policy => 
      policy.enabled && policy.key_types.includes(purpose)
    );

    for (const policy of applicablePolicies) {
      if (keyLength < policy.minimum_key_length) {
        throw new Error(`Key length ${keyLength} below minimum ${policy.minimum_key_length} for policy ${policy.name}`);
      }
    }
  }

  private async generateKeyMaterial(algorithm: string, keyLength: number): Promise<string> {
    const keyBytes = Math.ceil(keyLength / 8);
    return crypto.randomBytes(keyBytes).toString('hex');
  }

  private async storeKeyInVault(key: EncryptionKey, vault: KeyVault, keyMaterial: string): Promise<void> {
    // Store key in vault (mock implementation)
    vault.keys.push(key.id);
    this.managedKeys.set(key.id, key);
    
    // In real implementation, would encrypt and store key material securely
    this.emit('key_stored_in_vault', { key_id: key.id, vault_id: vault.id });
  }

  private requiresEscrow(purpose: string): boolean {
    return ['key_encryption', 'signing'].includes(purpose);
  }

  private async createKeyEscrow(key: EncryptionKey, keyMaterial: string): Promise<void> {
    const escrow: KeyEscrow = {
      id: `escrow_${key.id}`,
      key_id: key.id,
      encrypted_key_material: this.encryptForEscrow(keyMaterial),
      escrow_agents: ['agent_1', 'agent_2', 'agent_3'],
      threshold: 2, // 2 of 3
      created_at: new Date()
    };

    this.keyEscrows.set(key.id, escrow);
    this.emit('key_escrow_created', { key_id: key.id, threshold: escrow.threshold });
  }

  private async createKeyBackup(key: EncryptionKey, keyMaterial: string): Promise<boolean> {
    try {
      const backup = {
        key_id: key.id,
        key_data: key,
        encrypted_material: this.encryptForBackup(keyMaterial),
        created_at: new Date(),
        checksum: crypto.createHash('sha256').update(keyMaterial).digest('hex')
      };

      this.keyBackups.set(key.id, backup);
      return true;
    } catch (error) {
      this.emit('backup_creation_failed', { key_id: key.id, error });
      return false;
    }
  }

  private determineRotationPolicy(purpose: string): EncryptionKey['rotation_policy'] {
    switch (purpose) {
      case 'key_encryption':
      case 'signing':
        return 'quarterly';
      case 'data_encryption':
        return 'yearly';
      default:
        return 'yearly';
    }
  }

  private async logKeyOperation(
    operation: KeyOperation['operation'],
    keyId: string,
    userId: string,
    success: boolean,
    details: any
  ): Promise<void> {
    const logEntry: KeyOperation = {
      id: `op_${Date.now()}`,
      key_id: keyId,
      operation,
      user_id: userId,
      timestamp: new Date(),
      success,
      details,
      compliance_logged: true
    };

    this.keyOperations.push(logEntry);
    this.emit('key_operation_logged', logEntry);
  }

  private async estimateAffectedData(keyId: string): Promise<number> {
    // Mock estimation - would query actual data stores
    return Math.floor(Math.random() * 10000);
  }

  private async scheduleMigration(oldKeyId: string, newKeyId: string): Promise<void> {
    this.emit('migration_scheduled', {
      old_key_id: oldKeyId,
      new_key_id: newKeyId,
      estimated_duration: '2-4 hours'
    });
  }

  private async canRevokeKey(keyId: string, userId: string): Promise<{ allowed: boolean; reason?: string }> {
    const key = this.managedKeys.get(keyId);
    if (!key) {
      return { allowed: false, reason: 'Key not found' };
    }

    if (key.purpose === 'key_encryption') {
      return { allowed: false, reason: 'Cannot revoke key encryption keys without migration' };
    }

    return { allowed: true };
  }

  private async assessRevocationImpact(keyId: string): Promise<string[]> {
    const key = this.managedKeys.get(keyId);
    const impact = [];

    if (key?.purpose === 'signing') {
      impact.push('signature_verification_affected');
    }

    if (key?.usage_count > 1000) {
      impact.push('high_usage_key');
    }

    return impact;
  }

  private calculateGracePeriod(purpose: string): number {
    switch (purpose) {
      case 'key_encryption':
        return 90; // 90 days
      case 'signing':
        return 30; // 30 days
      default:
        return 7; // 7 days
    }
  }

  private async scheduleEmergencyRotation(keyId: string): Promise<void> {
    this.emit('emergency_rotation_scheduled', { key_id: keyId });
  }

  private findKeyVault(keyId: string): KeyVault | null {
    for (const vault of this.keyVaults.values()) {
      if (vault.keys.includes(keyId)) {
        return vault;
      }
    }
    return null;
  }

  private async getKeyMaterial(keyId: string): Promise<string> {
    // Mock - would retrieve from secure vault
    return crypto.randomBytes(32).toString('hex');
  }

  private getBackupLocation(): string {
    return 'secure_backup_storage_tier_1';
  }

  private async verifyBackupCompliance(): Promise<boolean> {
    return true; // Mock compliance verification
  }

  private async checkRecoveryEligibility(keyId: string, userId: string): Promise<{
    eligible: boolean;
    approval_required: boolean;
    reason?: string;
  }> {
    const key = this.managedKeys.get(keyId);
    if (!key) {
      return { eligible: false, approval_required: false, reason: 'Key not found' };
    }

    if (key.status === 'revoked') {
      return { eligible: true, approval_required: true };
    }

    return { eligible: true, approval_required: false };
  }

  private async requestRecoveryApproval(keyId: string, userId: string, justification: string): Promise<void> {
    this.emit('recovery_approval_requested', {
      key_id: keyId,
      user_id: userId,
      justification
    });
  }

  private async recoverFromEscrow(keyId: string, userId: string): Promise<string> {
    const escrow = this.keyEscrows.get(keyId);
    if (!escrow) {
      throw new Error('No escrow found for key');
    }

    // Mock escrow recovery - would require threshold signatures
    escrow.accessed_by = userId;
    escrow.accessed_at = new Date();
    
    return this.decryptFromEscrow(escrow.encrypted_key_material);
  }

  private async recoverFromBackup(keyId: string): Promise<string> {
    const backup = this.keyBackups.get(keyId);
    if (!backup) {
      throw new Error('No backup found for key');
    }

    return this.decryptFromBackup(backup.encrypted_material);
  }

  private isRotationDue(key: EncryptionKey): boolean {
    const now = new Date();
    const keyAge = now.getTime() - key.created_at.getTime();
    
    const rotationIntervals = {
      'monthly': 30 * 24 * 60 * 60 * 1000,
      'quarterly': 90 * 24 * 60 * 60 * 1000,
      'yearly': 365 * 24 * 60 * 60 * 1000,
      'manual': Infinity
    };

    return keyAge > rotationIntervals[key.rotation_policy];
  }

  private calculateComplianceScore(): number {
    let score = 100;
    const keys = Array.from(this.managedKeys.values());
    
    // Deduct points for overdue rotations
    const overdueKeys = keys.filter(key => this.isRotationDue(key)).length;
    score -= (overdueKeys / keys.length) * 20;
    
    // Deduct points for missing backups
    const missingBackups = keys.length - this.keyBackups.size;
    score -= (missingBackups / keys.length) * 15;
    
    // Deduct points for weak algorithms
    const weakKeys = keys.filter(key => key.key_strength < 256).length;
    score -= (weakKeys / keys.length) * 10;

    return Math.max(0, score);
  }

  private encryptForEscrow(keyMaterial: string): string {
    // Mock escrow encryption
    return Buffer.from(keyMaterial).toString('base64');
  }

  private encryptForBackup(keyMaterial: string): string {
    // Mock backup encryption
    return Buffer.from(keyMaterial).toString('base64');
  }

  private decryptFromEscrow(encryptedMaterial: string): string {
    // Mock escrow decryption
    return Buffer.from(encryptedMaterial, 'base64').toString();
  }

  private decryptFromBackup(encryptedMaterial: string): string {
    // Mock backup decryption
    return Buffer.from(encryptedMaterial, 'base64').toString();
  }

  private async loadManagedKeys(): Promise<void> {
    // Mock loading keys from storage
    this.managedKeys.clear();
  }

  private async scheduleKeyOperations(): Promise<void> {
    // Schedule automatic key rotations
    setInterval(async () => {
      const keysNeedingRotation = Array.from(this.managedKeys.values())
        .filter(key => key.status === 'active' && this.isRotationDue(key));
      
      for (const key of keysNeedingRotation) {
        try {
          await this.rotateKey(key.id, 'system');
        } catch (error) {
          this.emit('automatic_rotation_failed', { key_id: key.id, error });
        }
      }
    }, 24 * 60 * 60 * 1000); // Daily check
  }

  private async validateKeyCompliance(): Promise<void> {
    // Validate all keys against current policies
    const keys = Array.from(this.managedKeys.values());
    for (const key of keys) {
      const compliant = await this.validateKeyAgainstPolicies(key);
      if (!compliant) {
        this.emit('key_non_compliant', { key_id: key.id });
      }
    }
  }

  private async validateKeyAgainstPolicies(key: EncryptionKey): Promise<boolean> {
    const applicablePolicies = this.keyPolicies.filter(policy => 
      policy.enabled && policy.key_types.includes(key.purpose)
    );

    for (const policy of applicablePolicies) {
      if (key.key_strength < policy.minimum_key_length) {
        return false;
      }
      
      const keyAge = Date.now() - key.created_at.getTime();
      const maxAge = policy.maximum_age_days * 24 * 60 * 60 * 1000;
      if (keyAge > maxAge) {
        return false;
      }
    }

    return true;
  }

  private initializeKeyVaults(): void {
    const vaults: KeyVault[] = [
      {
        id: 'vault_hsm_primary',
        name: 'Primary HSM Vault',
        type: 'hsm',
        location: 'on_premise_datacenter',
        keys: [],
        capacity: 1000,
        security_level: 'fips_140_3',
        backup_enabled: true,
        high_availability: true,
        created_at: new Date()
      },
      {
        id: 'vault_cloud_secondary',
        name: 'Cloud Secondary Vault',
        type: 'cloud',
        location: 'azure_key_vault',
        keys: [],
        capacity: 5000,
        security_level: 'fips_140_2',
        backup_enabled: true,
        high_availability: true,
        created_at: new Date()
      },
      {
        id: 'vault_software_dev',
        name: 'Software Development Vault',
        type: 'software',
        location: 'development_environment',
        keys: [],
        capacity: 100,
        security_level: 'fips_140_1',
        backup_enabled: false,
        high_availability: false,
        created_at: new Date()
      }
    ];

    vaults.forEach(vault => this.keyVaults.set(vault.id, vault));
  }

  private initializeKeyPolicies(): void {
    this.keyPolicies = [
      {
        id: 'healthcare_master_key_policy',
        name: 'Healthcare Master Key Policy',
        key_types: ['key_encryption', 'data_encryption'],
        minimum_key_length: 256,
        maximum_age_days: 365,
        usage_limits: {
          max_operations: 1000000,
          max_data_size: 1024 * 1024 * 1024 * 1024 // 1TB
        },
        rotation_schedule: '0 2 1 */3 *', // Quarterly at 2 AM on 1st
        backup_required: true,
        compliance_requirements: ['FIPS_140_2', 'VIETNAMESE_HEALTHCARE', 'HIPAA'],
        approval_required: true,
        approvers: ['security_manager', 'compliance_officer'],
        enabled: true
      },
      {
        id: 'signing_key_policy',
        name: 'Digital Signing Key Policy',
        key_types: ['signing'],
        minimum_key_length: 2048,
        maximum_age_days: 730, // 2 years
        usage_limits: {
          max_operations: 100000,
          max_data_size: 100 * 1024 * 1024 // 100MB
        },
        rotation_schedule: '0 3 1 */6 *', // Semi-annually
        backup_required: true,
        compliance_requirements: ['FIPS_140_2', 'COMMON_CRITERIA'],
        approval_required: true,
        approvers: ['security_manager'],
        enabled: true
      },
      {
        id: 'development_key_policy',
        name: 'Development Environment Key Policy',
        key_types: ['data_encryption', 'authentication'],
        minimum_key_length: 128,
        maximum_age_days: 90,
        usage_limits: {
          max_operations: 10000,
          max_data_size: 10 * 1024 * 1024 // 10MB
        },
        rotation_schedule: '0 4 1 * *', // Monthly
        backup_required: false,
        compliance_requirements: [],
        approval_required: false,
        approvers: [],
        enabled: true
      }
    ];
  }
}
