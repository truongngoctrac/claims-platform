import crypto from "crypto";
import { EventEmitter } from "events";

export interface EncryptionPerformanceMetrics {
  encryptionLatency: number;
  decryptionLatency: number;
  throughput: number;
  cacheHitRate: number;
  keyRotationTime: number;
  indexingPerformance: number;
}

export interface DatabaseEncryptionConfig {
  encryptionMethod: "AES-256-GCM" | "ChaCha20-Poly1305" | "AES-256-CBC";
  keyDerivationFunction: "PBKDF2" | "Argon2" | "scrypt";
  compressionEnabled: boolean;
  encryptionLevel: "column" | "row" | "table" | "database";
  cacheEncryptedData: boolean;
  parallelProcessing: boolean;
  batchSize: number;
  keyRotationInterval: number; // hours
}

export interface ColumnEncryptionConfig {
  columnName: string;
  encryptionType: "deterministic" | "randomized";
  keyId: string;
  dataType: string;
  compressionEnabled: boolean;
}

export interface DatabaseKey {
  keyId: string;
  keyData: Buffer;
  algorithm: string;
  createdAt: Date;
  version: number;
  isActive: boolean;
}

export interface EncryptionCache {
  key: string;
  encryptedValue: Buffer;
  timestamp: Date;
  accessCount: number;
}

export class DatabaseEncryptionOptimizer extends EventEmitter {
  private config: DatabaseEncryptionConfig;
  private keys: Map<string, DatabaseKey>;
  private encryptionCache: Map<string, EncryptionCache>;
  private performanceMetrics: EncryptionPerformanceMetrics;
  private columnConfigs: Map<string, ColumnEncryptionConfig>;
  private isInitialized: boolean = false;

  constructor(config?: Partial<DatabaseEncryptionConfig>) {
    super();
    this.config = {
      encryptionMethod: "AES-256-GCM",
      keyDerivationFunction: "PBKDF2",
      compressionEnabled: true,
      encryptionLevel: "column",
      cacheEncryptedData: true,
      parallelProcessing: true,
      batchSize: 1000,
      keyRotationInterval: 24 * 7, // Weekly
      ...config,
    };

    this.keys = new Map();
    this.encryptionCache = new Map();
    this.columnConfigs = new Map();
    this.performanceMetrics = {
      encryptionLatency: 0,
      decryptionLatency: 0,
      throughput: 0,
      cacheHitRate: 0,
      keyRotationTime: 0,
      indexingPerformance: 0,
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.generateMasterKey();
      await this.setupColumnEncryption();
      this.startPerformanceMonitoring();
      this.scheduleKeyRotation();

      this.isInitialized = true;
      this.emit("initialized");
    } catch (error) {
      this.emit("initializationError", error);
      throw error;
    }
  }

  private async generateMasterKey(): Promise<void> {
    const keyId = "master_db_key";
    const keyData = crypto.randomBytes(32); // 256-bit key

    const dbKey: DatabaseKey = {
      keyId,
      keyData,
      algorithm: this.config.encryptionMethod,
      createdAt: new Date(),
      version: 1,
      isActive: true,
    };

    this.keys.set(keyId, dbKey);
    this.emit("keyGenerated", { keyId, timestamp: new Date() });
  }

  async setupColumnEncryption(): Promise<void> {
    // Setup encryption for sensitive healthcare data columns
    const sensitiveColumns: ColumnEncryptionConfig[] = [
      {
        columnName: "patient_ssn",
        encryptionType: "deterministic",
        keyId: "patient_data_key",
        dataType: "string",
        compressionEnabled: false,
      },
      {
        columnName: "medical_record_number",
        encryptionType: "deterministic",
        keyId: "medical_key",
        dataType: "string",
        compressionEnabled: false,
      },
      {
        columnName: "diagnosis_details",
        encryptionType: "randomized",
        keyId: "medical_key",
        dataType: "text",
        compressionEnabled: true,
      },
      {
        columnName: "payment_information",
        encryptionType: "randomized",
        keyId: "financial_key",
        dataType: "json",
        compressionEnabled: true,
      },
      {
        columnName: "personal_notes",
        encryptionType: "randomized",
        keyId: "personal_key",
        dataType: "text",
        compressionEnabled: true,
      },
    ];

    for (const columnConfig of sensitiveColumns) {
      await this.generateColumnKey(columnConfig.keyId);
      this.columnConfigs.set(columnConfig.columnName, columnConfig);
    }
  }

  private async generateColumnKey(keyId: string): Promise<void> {
    if (this.keys.has(keyId)) return;

    const keyData = crypto.randomBytes(32);
    const dbKey: DatabaseKey = {
      keyId,
      keyData,
      algorithm: this.config.encryptionMethod,
      createdAt: new Date(),
      version: 1,
      isActive: true,
    };

    this.keys.set(keyId, dbKey);
  }

  async encryptValue(value: any, columnName: string): Promise<Buffer> {
    const startTime = Date.now();

    try {
      const columnConfig = this.columnConfigs.get(columnName);
      if (!columnConfig) {
        throw new Error(`No encryption config found for column: ${columnName}`);
      }

      // Check cache first
      if (this.config.cacheEncryptedData) {
        const cached = this.checkCache(value, columnName);
        if (cached) {
          this.updateCacheHitRate(true);
          return cached;
        }
        this.updateCacheHitRate(false);
      }

      const key = this.keys.get(columnConfig.keyId);
      if (!key) {
        throw new Error(`Encryption key not found: ${columnConfig.keyId}`);
      }

      let dataToEncrypt = this.serializeValue(value, columnConfig.dataType);

      // Apply compression if enabled
      if (columnConfig.compressionEnabled && this.config.compressionEnabled) {
        dataToEncrypt = await this.compressData(dataToEncrypt);
      }

      const encrypted = await this.performEncryption(
        dataToEncrypt,
        key,
        columnConfig,
      );

      // Cache the result
      if (this.config.cacheEncryptedData) {
        this.cacheEncryptedValue(value, columnName, encrypted);
      }

      this.updatePerformanceMetrics("encryption", Date.now() - startTime);
      return encrypted;
    } catch (error) {
      this.emit("encryptionError", { columnName, error });
      throw error;
    }
  }

  async decryptValue(encryptedData: Buffer, columnName: string): Promise<any> {
    const startTime = Date.now();

    try {
      const columnConfig = this.columnConfigs.get(columnName);
      if (!columnConfig) {
        throw new Error(`No encryption config found for column: ${columnName}`);
      }

      const key = this.keys.get(columnConfig.keyId);
      if (!key) {
        throw new Error(`Encryption key not found: ${columnConfig.keyId}`);
      }

      let decryptedData = await this.performDecryption(
        encryptedData,
        key,
        columnConfig,
      );

      // Decompress if compression was enabled
      if (columnConfig.compressionEnabled && this.config.compressionEnabled) {
        decryptedData = await this.decompressData(decryptedData);
      }

      const value = this.deserializeValue(decryptedData, columnConfig.dataType);

      this.updatePerformanceMetrics("decryption", Date.now() - startTime);
      return value;
    } catch (error) {
      this.emit("decryptionError", { columnName, error });
      throw error;
    }
  }

  async batchEncrypt(
    records: Array<{ [key: string]: any }>,
  ): Promise<Array<{ [key: string]: any }>> {
    if (!this.config.parallelProcessing) {
      return this.sequentialBatchEncrypt(records);
    }

    const batches = this.chunkArray(records, this.config.batchSize);
    const encryptedBatches = await Promise.all(
      batches.map((batch) => this.processBatch(batch)),
    );

    return encryptedBatches.flat();
  }

  private async processBatch(
    batch: Array<{ [key: string]: any }>,
  ): Promise<Array<{ [key: string]: any }>> {
    const promises = batch.map(async (record) => {
      const encryptedRecord = { ...record };

      for (const [columnName, config] of this.columnConfigs) {
        if (record[columnName] !== undefined) {
          encryptedRecord[columnName] = await this.encryptValue(
            record[columnName],
            columnName,
          );
        }
      }

      return encryptedRecord;
    });

    return Promise.all(promises);
  }

  private async sequentialBatchEncrypt(
    records: Array<{ [key: string]: any }>,
  ): Promise<Array<{ [key: string]: any }>> {
    const encryptedRecords = [];

    for (const record of records) {
      const encryptedRecord = { ...record };

      for (const [columnName, config] of this.columnConfigs) {
        if (record[columnName] !== undefined) {
          encryptedRecord[columnName] = await this.encryptValue(
            record[columnName],
            columnName,
          );
        }
      }

      encryptedRecords.push(encryptedRecord);
    }

    return encryptedRecords;
  }

  private async performEncryption(
    data: string,
    key: DatabaseKey,
    config: ColumnEncryptionConfig,
  ): Promise<Buffer> {
    const iv =
      config.encryptionType === "deterministic"
        ? crypto.createHash("sha256").update(data).digest().slice(0, 16)
        : crypto.randomBytes(16);

    const cipher = crypto.createCipherGCM("aes-256-gcm", key.keyData, iv);

    let encrypted = cipher.update(data, "utf8");
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const tag = cipher.getAuthTag();

    // Combine IV, tag, and encrypted data
    return Buffer.concat([iv, tag, encrypted]);
  }

  private async performDecryption(
    encryptedData: Buffer,
    key: DatabaseKey,
    config: ColumnEncryptionConfig,
  ): Promise<string> {
    const iv = encryptedData.slice(0, 16);
    const tag = encryptedData.slice(16, 32);
    const encrypted = encryptedData.slice(32);

    const decipher = crypto.createDecipherGCM("aes-256-gcm", key.keyData, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString("utf8");
  }

  private async compressData(data: string): Promise<string> {
    const zlib = await import("zlib");
    return new Promise((resolve, reject) => {
      zlib.gzip(Buffer.from(data, "utf8"), (err, compressed) => {
        if (err) reject(err);
        else resolve(compressed.toString("base64"));
      });
    });
  }

  private async decompressData(data: string): Promise<string> {
    const zlib = await import("zlib");
    return new Promise((resolve, reject) => {
      zlib.gunzip(Buffer.from(data, "base64"), (err, decompressed) => {
        if (err) reject(err);
        else resolve(decompressed.toString("utf8"));
      });
    });
  }

  private serializeValue(value: any, dataType: string): string {
    switch (dataType) {
      case "json":
        return JSON.stringify(value);
      case "string":
      case "text":
        return String(value);
      case "number":
        return value.toString();
      default:
        return String(value);
    }
  }

  private deserializeValue(data: string, dataType: string): any {
    switch (dataType) {
      case "json":
        return JSON.parse(data);
      case "number":
        return Number(data);
      case "string":
      case "text":
      default:
        return data;
    }
  }

  private checkCache(value: any, columnName: string): Buffer | null {
    const cacheKey = this.generateCacheKey(value, columnName);
    const cached = this.encryptionCache.get(cacheKey);

    if (cached) {
      cached.accessCount++;
      cached.timestamp = new Date();
      return cached.encryptedValue;
    }

    return null;
  }

  private cacheEncryptedValue(
    value: any,
    columnName: string,
    encrypted: Buffer,
  ): void {
    const cacheKey = this.generateCacheKey(value, columnName);

    this.encryptionCache.set(cacheKey, {
      key: cacheKey,
      encryptedValue: encrypted,
      timestamp: new Date(),
      accessCount: 1,
    });

    // Limit cache size
    if (this.encryptionCache.size > 10000) {
      this.cleanupCache();
    }
  }

  private generateCacheKey(value: any, columnName: string): string {
    return crypto
      .createHash("sha256")
      .update(`${columnName}:${JSON.stringify(value)}`)
      .digest("hex");
  }

  private cleanupCache(): void {
    const entries = Array.from(this.encryptionCache.entries());
    entries.sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime());

    // Remove oldest 20% of entries
    const toRemove = Math.floor(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.encryptionCache.delete(entries[i][0]);
    }
  }

  private updateCacheHitRate(hit: boolean): void {
    const currentRequests =
      this.performanceMetrics.cacheHitRate * 100 + (hit ? 1 : 0);
    this.performanceMetrics.cacheHitRate = currentRequests / 101;
  }

  private updatePerformanceMetrics(
    operation: "encryption" | "decryption",
    latency: number,
  ): void {
    if (operation === "encryption") {
      this.performanceMetrics.encryptionLatency =
        (this.performanceMetrics.encryptionLatency + latency) / 2;
    } else {
      this.performanceMetrics.decryptionLatency =
        (this.performanceMetrics.decryptionLatency + latency) / 2;
    }

    this.performanceMetrics.throughput = 1000 / latency; // operations per second
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private startPerformanceMonitoring(): void {
    setInterval(() => {
      this.emit("performanceMetrics", this.performanceMetrics);
    }, 60000); // Every minute
  }

  private scheduleKeyRotation(): void {
    setInterval(
      async () => {
        await this.rotateKeys();
      },
      this.config.keyRotationInterval * 60 * 60 * 1000,
    );
  }

  async rotateKeys(): Promise<void> {
    const startTime = Date.now();

    try {
      for (const [keyId, key] of this.keys.entries()) {
        if (key.isActive) {
          // Mark old key as inactive
          key.isActive = false;

          // Generate new key
          const newKeyData = crypto.randomBytes(32);
          const newKey: DatabaseKey = {
            keyId: `${keyId}_v${key.version + 1}`,
            keyData: newKeyData,
            algorithm: key.algorithm,
            createdAt: new Date(),
            version: key.version + 1,
            isActive: true,
          };

          this.keys.set(keyId, newKey);
        }
      }

      // Clear cache after key rotation
      this.encryptionCache.clear();

      this.performanceMetrics.keyRotationTime = Date.now() - startTime;
      this.emit("keysRotated", {
        timestamp: new Date(),
        rotationTime: this.performanceMetrics.keyRotationTime,
      });
    } catch (error) {
      this.emit("keyRotationError", error);
      throw error;
    }
  }

  getPerformanceMetrics(): EncryptionPerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  getEncryptionConfig(columnName: string): ColumnEncryptionConfig | undefined {
    return this.columnConfigs.get(columnName);
  }

  async updateEncryptionConfig(
    columnName: string,
    config: Partial<ColumnEncryptionConfig>,
  ): Promise<void> {
    const existing = this.columnConfigs.get(columnName);
    if (!existing) {
      throw new Error(`No encryption config found for column: ${columnName}`);
    }

    const updated = { ...existing, ...config };
    this.columnConfigs.set(columnName, updated);

    this.emit("configUpdated", { columnName, config: updated });
  }

  async shutdown(): Promise<void> {
    this.emit("shutdown");
    this.removeAllListeners();
  }
}

export default DatabaseEncryptionOptimizer;
