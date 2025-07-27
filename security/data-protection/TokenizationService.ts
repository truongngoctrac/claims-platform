import crypto from 'crypto';
import { EventEmitter } from 'events';

export interface TokenizationConfig {
  algorithm: 'AES-256-GCM' | 'Format-Preserving-Encryption';
  keyRotationInterval: number; // hours
  tokenLength: number;
  preserveFormat: boolean;
  reversible: boolean;
  vaultEncryption: boolean;
}

export interface TokenVault {
  tokenId: string;
  originalValue: string;
  tokenValue: string;
  dataType: string;
  sensitivity: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  keyVersion: number;
  isActive: boolean;
}

export interface FormatPreservingRule {
  dataType: 'ssn' | 'phone' | 'email' | 'creditcard' | 'custom';
  pattern: string;
  preserveCharacters: string[];
  maskCharacters: string[];
}

export interface TokenizationKey {
  keyId: string;
  version: number;
  keyData: Buffer;
  algorithm: string;
  createdAt: Date;
  isActive: boolean;
  rotationScheduled: Date;
}

export interface TokenizationMetrics {
  totalTokensGenerated: number;
  totalDetokenizations: number;
  vaultSize: number;
  averageTokenGenerationTime: number;
  averageDetokenizationTime: number;
  errorCount: number;
  keyRotations: number;
  formatTypes: Map<string, number>;
}

export class TokenizationService extends EventEmitter {
  private config: TokenizationConfig;
  private tokenVault: Map<string, TokenVault>;
  private reverseVault: Map<string, string>; // originalValue -> tokenId
  private tokenizationKeys: Map<string, TokenizationKey>;
  private formatRules: Map<string, FormatPreservingRule>;
  private metrics: TokenizationMetrics;
  private isInitialized: boolean = false;

  constructor(config?: Partial<TokenizationConfig>) {
    super();
    this.config = {
      algorithm: 'AES-256-GCM',
      keyRotationInterval: 24 * 7, // Weekly
      tokenLength: 16,
      preserveFormat: true,
      reversible: true,
      vaultEncryption: true,
      ...config
    };

    this.tokenVault = new Map();
    this.reverseVault = new Map();
    this.tokenizationKeys = new Map();
    this.formatRules = new Map();
    this.metrics = {
      totalTokensGenerated: 0,
      totalDetokenizations: 0,
      vaultSize: 0,
      averageTokenGenerationTime: 0,
      averageDetokenizationTime: 0,
      errorCount: 0,
      keyRotations: 0,
      formatTypes: new Map()
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.generateMasterKey();
      this.setupFormatPreservingRules();
      this.scheduleKeyRotation();
      this.startVaultMaintenance();
      
      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      this.emit('initializationError', error);
      throw error;
    }
  }

  private async generateMasterKey(): Promise<void> {
    const keyId = `tokenization_key_${Date.now()}`;
    const keyData = crypto.randomBytes(32); // 256-bit key
    
    const tokenKey: TokenizationKey = {
      keyId,
      version: 1,
      keyData,
      algorithm: this.config.algorithm,
      createdAt: new Date(),
      isActive: true,
      rotationScheduled: new Date(Date.now() + this.config.keyRotationInterval * 60 * 60 * 1000)
    };

    this.tokenizationKeys.set(keyId, tokenKey);
    this.emit('keyGenerated', { keyId, timestamp: new Date() });
  }

  private setupFormatPreservingRules(): void {
    const rules: FormatPreservingRule[] = [
      {
        dataType: 'ssn',
        pattern: '###-##-####',
        preserveCharacters: ['-'],
        maskCharacters: ['#']
      },
      {
        dataType: 'phone',
        pattern: '(###) ###-####',
        preserveCharacters: ['(', ')', ' ', '-'],
        maskCharacters: ['#']
      },
      {
        dataType: 'email',
        pattern: '****@****.***',
        preserveCharacters: ['@', '.'],
        maskCharacters: ['*']
      },
      {
        dataType: 'creditcard',
        pattern: '####-####-####-####',
        preserveCharacters: ['-'],
        maskCharacters: ['#']
      }
    ];

    for (const rule of rules) {
      this.formatRules.set(rule.dataType, rule);
    }
  }

  async tokenize(
    originalValue: string,
    dataType: string = 'string',
    sensitivity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<string> {
    const startTime = Date.now();

    try {
      // Check if value is already tokenized
      const existingTokenId = this.reverseVault.get(originalValue);
      if (existingTokenId) {
        const existingToken = this.tokenVault.get(existingTokenId);
        if (existingToken && existingToken.isActive) {
          existingToken.lastAccessed = new Date();
          existingToken.accessCount++;
          return existingToken.tokenValue;
        }
      }

      // Generate new token
      const tokenId = crypto.randomUUID();
      let tokenValue: string;

      if (this.config.preserveFormat && this.formatRules.has(dataType)) {
        tokenValue = await this.generateFormatPreservingToken(originalValue, dataType);
      } else {
        tokenValue = await this.generateStandardToken(originalValue);
      }

      // Create vault entry
      const vaultEntry: TokenVault = {
        tokenId,
        originalValue,
        tokenValue,
        dataType,
        sensitivity,
        createdAt: new Date(),
        lastAccessed: new Date(),
        accessCount: 1,
        keyVersion: this.getActiveKeyVersion(),
        isActive: true
      };

      // Store in vaults
      this.tokenVault.set(tokenId, vaultEntry);
      this.reverseVault.set(originalValue, tokenId);

      // Update metrics
      this.metrics.totalTokensGenerated++;
      this.metrics.vaultSize = this.tokenVault.size;
      this.updateFormatMetrics(dataType);
      this.updateTokenGenerationTime(Date.now() - startTime);

      this.emit('tokenGenerated', { tokenId, dataType, sensitivity });
      return tokenValue;
    } catch (error) {
      this.metrics.errorCount++;
      this.emit('tokenizationError', { originalValue: '[REDACTED]', error });
      throw error;
    }
  }

  async detokenize(tokenValue: string): Promise<string | null> {
    const startTime = Date.now();

    try {
      if (!this.config.reversible) {
        throw new Error('Detokenization is disabled in current configuration');
      }

      // Find token in vault
      const vaultEntry = Array.from(this.tokenVault.values())
        .find(entry => entry.tokenValue === tokenValue && entry.isActive);

      if (!vaultEntry) {
        return null;
      }

      // Update access metrics
      vaultEntry.lastAccessed = new Date();
      vaultEntry.accessCount++;

      this.metrics.totalDetokenizations++;
      this.updateDetokenizationTime(Date.now() - startTime);

      this.emit('tokenDetokenized', { tokenId: vaultEntry.tokenId });
      return vaultEntry.originalValue;
    } catch (error) {
      this.metrics.errorCount++;
      this.emit('detokenizationError', { tokenValue: '[REDACTED]', error });
      throw error;
    }
  }

  private async generateFormatPreservingToken(originalValue: string, dataType: string): Promise<string> {
    const rule = this.formatRules.get(dataType);
    if (!rule) {
      return this.generateStandardToken(originalValue);
    }

    let token = '';
    let originalIndex = 0;

    for (const char of rule.pattern) {
      if (rule.preserveCharacters.includes(char)) {
        // Preserve format characters
        token += char;
      } else if (rule.maskCharacters.includes(char)) {
        // Replace with random character of same type
        if (originalIndex < originalValue.length) {
          const originalChar = originalValue[originalIndex];
          if (/\d/.test(originalChar)) {
            token += Math.floor(Math.random() * 10).toString();
          } else if (/[a-zA-Z]/.test(originalChar)) {
            const isUpperCase = originalChar === originalChar.toUpperCase();
            const randomChar = String.fromCharCode(
              Math.floor(Math.random() * 26) + (isUpperCase ? 65 : 97)
            );
            token += randomChar;
          } else {
            token += originalChar;
          }
          originalIndex++;
        }
      } else {
        // Direct character replacement
        token += char;
      }
    }

    return token;
  }

  private async generateStandardToken(originalValue: string): Promise<string> {
    const activeKey = this.getActiveKey();
    if (!activeKey) {
      throw new Error('No active tokenization key available');
    }

    if (this.config.algorithm === 'AES-256-GCM') {
      return this.generateAESToken(originalValue, activeKey);
    } else {
      return this.generateRandomToken();
    }
  }

  private generateAESToken(originalValue: string, key: TokenizationKey): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipherGCM('aes-256-gcm', key.keyData, iv);
    
    let encrypted = cipher.update(originalValue, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    // Combine IV, tag, and encrypted data, then encode to create token
    const combined = Buffer.concat([iv, tag, Buffer.from(encrypted, 'hex')]);
    return combined.toString('base64').replace(/[+/=]/g, '').substring(0, this.config.tokenLength);
  }

  private generateRandomToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    
    for (let i = 0; i < this.config.tokenLength; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return token;
  }

  async batchTokenize(
    values: Array<{ value: string; dataType?: string; sensitivity?: 'low' | 'medium' | 'high' | 'critical' }>
  ): Promise<Array<{ originalValue: string; tokenValue: string; tokenId: string }>> {
    const results = [];
    
    for (const item of values) {
      try {
        const tokenValue = await this.tokenize(item.value, item.dataType, item.sensitivity);
        const tokenId = this.reverseVault.get(item.value);
        
        results.push({
          originalValue: item.value,
          tokenValue,
          tokenId: tokenId || ''
        });
      } catch (error) {
        this.emit('batchTokenizationError', { value: '[REDACTED]', error });
        results.push({
          originalValue: item.value,
          tokenValue: '',
          tokenId: ''
        });
      }
    }
    
    return results;
  }

  async batchDetokenize(tokenValues: string[]): Promise<Array<{ tokenValue: string; originalValue: string | null }>> {
    const results = [];
    
    for (const tokenValue of tokenValues) {
      try {
        const originalValue = await this.detokenize(tokenValue);
        results.push({ tokenValue, originalValue });
      } catch (error) {
        this.emit('batchDetokenizationError', { tokenValue: '[REDACTED]', error });
        results.push({ tokenValue, originalValue: null });
      }
    }
    
    return results;
  }

  async rotateKeys(): Promise<void> {
    try {
      const oldKey = this.getActiveKey();
      if (oldKey) {
        oldKey.isActive = false;
      }

      await this.generateMasterKey();
      this.metrics.keyRotations++;
      
      // Re-encrypt vault if vault encryption is enabled
      if (this.config.vaultEncryption) {
        await this.reencryptVault();
      }

      this.emit('keysRotated', { timestamp: new Date() });
    } catch (error) {
      this.emit('keyRotationError', error);
      throw error;
    }
  }

  private async reencryptVault(): Promise<void> {
    const newKeyVersion = this.getActiveKeyVersion();
    let reencryptedCount = 0;

    for (const [tokenId, vaultEntry] of this.tokenVault.entries()) {
      if (vaultEntry.keyVersion !== newKeyVersion) {
        // Re-tokenize with new key
        const newTokenValue = await this.generateStandardToken(vaultEntry.originalValue);
        vaultEntry.tokenValue = newTokenValue;
        vaultEntry.keyVersion = newKeyVersion;
        reencryptedCount++;
      }
    }

    this.emit('vaultReencrypted', { reencryptedCount, newKeyVersion });
  }

  async searchTokens(criteria: {
    dataType?: string;
    sensitivity?: string;
    createdAfter?: Date;
    createdBefore?: Date;
    accessedAfter?: Date;
  }): Promise<Array<Omit<TokenVault, 'originalValue'>>> {
    const results = [];

    for (const vaultEntry of this.tokenVault.values()) {
      let matches = true;

      if (criteria.dataType && vaultEntry.dataType !== criteria.dataType) {
        matches = false;
      }

      if (criteria.sensitivity && vaultEntry.sensitivity !== criteria.sensitivity) {
        matches = false;
      }

      if (criteria.createdAfter && vaultEntry.createdAt < criteria.createdAfter) {
        matches = false;
      }

      if (criteria.createdBefore && vaultEntry.createdAt > criteria.createdBefore) {
        matches = false;
      }

      if (criteria.accessedAfter && vaultEntry.lastAccessed < criteria.accessedAfter) {
        matches = false;
      }

      if (matches) {
        const { originalValue, ...safeEntry } = vaultEntry;
        results.push(safeEntry);
      }
    }

    return results;
  }

  async revokeToken(tokenValue: string): Promise<boolean> {
    try {
      const vaultEntry = Array.from(this.tokenVault.values())
        .find(entry => entry.tokenValue === tokenValue);

      if (!vaultEntry) {
        return false;
      }

      vaultEntry.isActive = false;
      this.reverseVault.delete(vaultEntry.originalValue);

      this.emit('tokenRevoked', { tokenId: vaultEntry.tokenId });
      return true;
    } catch (error) {
      this.emit('tokenRevocationError', { tokenValue: '[REDACTED]', error });
      return false;
    }
  }

  async cleanupExpiredTokens(maxAge: number = 365): Promise<number> {
    const cutoffDate = new Date(Date.now() - maxAge * 24 * 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [tokenId, vaultEntry] of this.tokenVault.entries()) {
      if (vaultEntry.lastAccessed < cutoffDate && !vaultEntry.isActive) {
        this.tokenVault.delete(tokenId);
        this.reverseVault.delete(vaultEntry.originalValue);
        cleanedCount++;
      }
    }

    this.metrics.vaultSize = this.tokenVault.size;
    this.emit('expiredTokensCleanedUp', { cleanedCount, cutoffDate });
    
    return cleanedCount;
  }

  private getActiveKey(): TokenizationKey | null {
    for (const key of this.tokenizationKeys.values()) {
      if (key.isActive) return key;
    }
    return null;
  }

  private getActiveKeyVersion(): number {
    const activeKey = this.getActiveKey();
    return activeKey ? activeKey.version : 0;
  }

  private updateFormatMetrics(dataType: string): void {
    const current = this.metrics.formatTypes.get(dataType) || 0;
    this.metrics.formatTypes.set(dataType, current + 1);
  }

  private updateTokenGenerationTime(time: number): void {
    this.metrics.averageTokenGenerationTime =
      (this.metrics.averageTokenGenerationTime * (this.metrics.totalTokensGenerated - 1) + time) /
      this.metrics.totalTokensGenerated;
  }

  private updateDetokenizationTime(time: number): void {
    this.metrics.averageDetokenizationTime =
      (this.metrics.averageDetokenizationTime * (this.metrics.totalDetokenizations - 1) + time) /
      this.metrics.totalDetokenizations;
  }

  private scheduleKeyRotation(): void {
    const interval = this.config.keyRotationInterval * 60 * 60 * 1000;
    setInterval(async () => {
      try {
        await this.rotateKeys();
      } catch (error) {
        this.emit('scheduledRotationError', error);
      }
    }, interval);
  }

  private startVaultMaintenance(): void {
    // Run maintenance daily
    setInterval(async () => {
      try {
        await this.cleanupExpiredTokens();
      } catch (error) {
        this.emit('maintenanceError', error);
      }
    }, 24 * 60 * 60 * 1000);
  }

  getMetrics(): TokenizationMetrics {
    return {
      totalTokensGenerated: this.metrics.totalTokensGenerated,
      totalDetokenizations: this.metrics.totalDetokenizations,
      vaultSize: this.metrics.vaultSize,
      averageTokenGenerationTime: this.metrics.averageTokenGenerationTime,
      averageDetokenizationTime: this.metrics.averageDetokenizationTime,
      errorCount: this.metrics.errorCount,
      keyRotations: this.metrics.keyRotations,
      formatTypes: new Map(this.metrics.formatTypes)
    };
  }

  getVaultStats(): {
    totalTokens: number;
    activeTokens: number;
    byDataType: Map<string, number>;
    bySensitivity: Map<string, number>;
    mostAccessedTokens: Array<Omit<TokenVault, 'originalValue'>>;
  } {
    const vaultEntries = Array.from(this.tokenVault.values());
    const activeTokens = vaultEntries.filter(entry => entry.isActive);
    
    const byDataType = new Map<string, number>();
    const bySensitivity = new Map<string, number>();

    for (const entry of vaultEntries) {
      // Count by data type
      const currentDataType = byDataType.get(entry.dataType) || 0;
      byDataType.set(entry.dataType, currentDataType + 1);

      // Count by sensitivity
      const currentSensitivity = bySensitivity.get(entry.sensitivity) || 0;
      bySensitivity.set(entry.sensitivity, currentSensitivity + 1);
    }

    const mostAccessed = vaultEntries
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10)
      .map(entry => {
        const { originalValue, ...safeEntry } = entry;
        return safeEntry;
      });

    return {
      totalTokens: vaultEntries.length,
      activeTokens: activeTokens.length,
      byDataType,
      bySensitivity,
      mostAccessedTokens: mostAccessed
    };
  }

  async exportTokens(
    criteria?: {
      dataType?: string;
      sensitivity?: string;
      includeOriginalValues?: boolean;
    }
  ): Promise<Array<Partial<TokenVault>>> {
    const tokens = await this.searchTokens(criteria || {});
    
    if (criteria?.includeOriginalValues) {
      // Only for authorized exports with proper approval
      return Array.from(this.tokenVault.values()).filter(entry => {
        if (criteria.dataType && entry.dataType !== criteria.dataType) return false;
        if (criteria.sensitivity && entry.sensitivity !== criteria.sensitivity) return false;
        return true;
      });
    }

    return tokens;
  }

  async shutdown(): Promise<void> {
    this.emit('shutdown');
    this.removeAllListeners();
  }
}

export default TokenizationService;
