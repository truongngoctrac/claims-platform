import crypto from 'crypto';
import { EventEmitter } from 'events';

export interface EncryptionConfig {
  algorithm: string;
  keySize: number;
  ivSize: number;
  saltSize: number;
  iterations: number;
  digestAlgorithm: string;
}

export interface EncryptionKeyPair {
  publicKey: string;
  privateKey: string;
  keyId: string;
  createdAt: Date;
  expiresAt?: Date;
}

export interface EncryptedData {
  data: string;
  iv: string;
  salt: string;
  tag: string;
  keyId: string;
  algorithm: string;
  timestamp: Date;
}

export interface E2EEncryptionMetrics {
  encryptionOperations: number;
  decryptionOperations: number;
  keyRotations: number;
  failedOperations: number;
  averageEncryptionTime: number;
  averageDecryptionTime: number;
}

export class EndToEndEncryptionService extends EventEmitter {
  private config: EncryptionConfig;
  private keyPairs: Map<string, EncryptionKeyPair>;
  private metrics: E2EEncryptionMetrics;
  private isInitialized: boolean = false;

  constructor(config?: Partial<EncryptionConfig>) {
    super();
    this.config = {
      algorithm: 'aes-256-gcm',
      keySize: 32,
      ivSize: 16,
      saltSize: 32,
      iterations: 100000,
      digestAlgorithm: 'sha512',
      ...config
    };
    this.keyPairs = new Map();
    this.metrics = {
      encryptionOperations: 0,
      decryptionOperations: 0,
      keyRotations: 0,
      failedOperations: 0,
      averageEncryptionTime: 0,
      averageDecryptionTime: 0
    };
  }

  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) {
        return;
      }

      // Generate master key pair
      await this.generateKeyPair('master');
      
      // Start key rotation schedule
      this.scheduleKeyRotation();
      
      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async generateKeyPair(keyId: string, expirationDays?: number): Promise<EncryptionKeyPair> {
    try {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 4096,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      });

      const keyPair: EncryptionKeyPair = {
        publicKey,
        privateKey,
        keyId,
        createdAt: new Date(),
        expiresAt: expirationDays ? new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000) : undefined
      };

      this.keyPairs.set(keyId, keyPair);
      this.metrics.keyRotations++;
      
      this.emit('keyGenerated', { keyId, timestamp: new Date() });
      return keyPair;
    } catch (error) {
      this.metrics.failedOperations++;
      throw error;
    }
  }

  async encryptData(data: string, keyId: string = 'master'): Promise<EncryptedData> {
    const startTime = Date.now();
    
    try {
      const keyPair = this.keyPairs.get(keyId);
      if (!keyPair) {
        throw new Error(`Key pair not found for keyId: ${keyId}`);
      }

      // Generate random salt and IV
      const salt = crypto.randomBytes(this.config.saltSize);
      const iv = crypto.randomBytes(this.config.ivSize);
      
      // Derive key from password using PBKDF2
      const key = crypto.pbkdf2Sync(
        keyPair.privateKey,
        salt,
        this.config.iterations,
        this.config.keySize,
        this.config.digestAlgorithm
      );

      // Create cipher
      const cipher = crypto.createCipherGCM(this.config.algorithm, key, iv);
      
      // Encrypt data
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get authentication tag
      const tag = cipher.getAuthTag();

      const encryptedData: EncryptedData = {
        data: encrypted,
        iv: iv.toString('hex'),
        salt: salt.toString('hex'),
        tag: tag.toString('hex'),
        keyId,
        algorithm: this.config.algorithm,
        timestamp: new Date()
      };

      this.metrics.encryptionOperations++;
      this.updateAverageTime('encryption', Date.now() - startTime);
      
      this.emit('dataEncrypted', { keyId, dataSize: data.length, timestamp: new Date() });
      return encryptedData;
    } catch (error) {
      this.metrics.failedOperations++;
      this.emit('encryptionError', error);
      throw error;
    }
  }

  async decryptData(encryptedData: EncryptedData): Promise<string> {
    const startTime = Date.now();
    
    try {
      const keyPair = this.keyPairs.get(encryptedData.keyId);
      if (!keyPair) {
        throw new Error(`Key pair not found for keyId: ${encryptedData.keyId}`);
      }

      // Convert hex strings back to buffers
      const salt = Buffer.from(encryptedData.salt, 'hex');
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const tag = Buffer.from(encryptedData.tag, 'hex');
      
      // Derive key from password using PBKDF2
      const key = crypto.pbkdf2Sync(
        keyPair.privateKey,
        salt,
        this.config.iterations,
        this.config.keySize,
        this.config.digestAlgorithm
      );

      // Create decipher
      const decipher = crypto.createDecipherGCM(encryptedData.algorithm, key, iv);
      decipher.setAuthTag(tag);
      
      // Decrypt data
      let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      this.metrics.decryptionOperations++;
      this.updateAverageTime('decryption', Date.now() - startTime);
      
      this.emit('dataDecrypted', { keyId: encryptedData.keyId, timestamp: new Date() });
      return decrypted;
    } catch (error) {
      this.metrics.failedOperations++;
      this.emit('decryptionError', error);
      throw error;
    }
  }

  async encryptFile(filePath: string, keyId: string = 'master'): Promise<EncryptedData> {
    try {
      const fs = await import('fs');
      const fileData = fs.readFileSync(filePath, 'utf8');
      return await this.encryptData(fileData, keyId);
    } catch (error) {
      this.emit('fileEncryptionError', error);
      throw error;
    }
  }

  async decryptToFile(encryptedData: EncryptedData, outputPath: string): Promise<void> {
    try {
      const fs = await import('fs');
      const decryptedData = await this.decryptData(encryptedData);
      fs.writeFileSync(outputPath, decryptedData, 'utf8');
    } catch (error) {
      this.emit('fileDecryptionError', error);
      throw error;
    }
  }

  async rotateKeys(keyId: string): Promise<EncryptionKeyPair> {
    try {
      const oldKeyPair = this.keyPairs.get(keyId);
      if (oldKeyPair) {
        // Archive old key for decryption of existing data
        this.keyPairs.set(`${keyId}_archived_${Date.now()}`, oldKeyPair);
      }

      const newKeyPair = await this.generateKeyPair(keyId);
      this.emit('keyRotated', { keyId, timestamp: new Date() });
      
      return newKeyPair;
    } catch (error) {
      this.emit('keyRotationError', error);
      throw error;
    }
  }

  async verifyDataIntegrity(encryptedData: EncryptedData): Promise<boolean> {
    try {
      // Attempt to decrypt and re-encrypt to verify integrity
      const decrypted = await this.decryptData(encryptedData);
      const reEncrypted = await this.encryptData(decrypted, encryptedData.keyId);
      
      // Compare algorithm and keyId (data will differ due to new salt/iv)
      return encryptedData.algorithm === reEncrypted.algorithm &&
             encryptedData.keyId === reEncrypted.keyId;
    } catch (error) {
      return false;
    }
  }

  getMetrics(): E2EEncryptionMetrics {
    return { ...this.metrics };
  }

  getKeyInfo(keyId: string): Omit<EncryptionKeyPair, 'privateKey'> | null {
    const keyPair = this.keyPairs.get(keyId);
    if (!keyPair) return null;

    return {
      publicKey: keyPair.publicKey,
      keyId: keyPair.keyId,
      createdAt: keyPair.createdAt,
      expiresAt: keyPair.expiresAt
    };
  }

  getAllKeyIds(): string[] {
    return Array.from(this.keyPairs.keys());
  }

  async exportPublicKey(keyId: string): Promise<string> {
    const keyPair = this.keyPairs.get(keyId);
    if (!keyPair) {
      throw new Error(`Key pair not found for keyId: ${keyId}`);
    }
    return keyPair.publicKey;
  }

  async clearExpiredKeys(): Promise<void> {
    const now = new Date();
    const expiredKeys: string[] = [];

    for (const [keyId, keyPair] of this.keyPairs.entries()) {
      if (keyPair.expiresAt && keyPair.expiresAt < now) {
        expiredKeys.push(keyId);
      }
    }

    for (const keyId of expiredKeys) {
      this.keyPairs.delete(keyId);
      this.emit('keyExpired', { keyId, timestamp: now });
    }
  }

  private scheduleKeyRotation(): void {
    // Rotate keys every 30 days
    setInterval(async () => {
      try {
        await this.clearExpiredKeys();
        await this.rotateKeys('master');
      } catch (error) {
        this.emit('scheduledRotationError', error);
      }
    }, 30 * 24 * 60 * 60 * 1000);
  }

  private updateAverageTime(operation: 'encryption' | 'decryption', time: number): void {
    if (operation === 'encryption') {
      this.metrics.averageEncryptionTime = 
        (this.metrics.averageEncryptionTime * (this.metrics.encryptionOperations - 1) + time) / 
        this.metrics.encryptionOperations;
    } else {
      this.metrics.averageDecryptionTime = 
        (this.metrics.averageDecryptionTime * (this.metrics.decryptionOperations - 1) + time) / 
        this.metrics.decryptionOperations;
    }
  }

  async shutdown(): Promise<void> {
    this.emit('shutdown');
    this.removeAllListeners();
  }
}

export default EndToEndEncryptionService;
