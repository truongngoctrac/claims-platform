import crypto from "crypto";
import { EventEmitter } from "events";
import path from "path";

export interface BackupEncryptionConfig {
  algorithm: "AES-256-GCM" | "ChaCha20-Poly1305";
  keyDerivation: "PBKDF2" | "Argon2";
  compressionLevel: number; // 0-9
  chunkSize: number; // bytes
  parallelStreams: number;
  checksumAlgorithm: "SHA-256" | "SHA-512" | "BLAKE2b";
  keyRotationDays: number;
  redundancyLevel: number; // Number of backup copies
}

export interface BackupMetadata {
  backupId: string;
  timestamp: Date;
  sourceSize: number;
  encryptedSize: number;
  compressionRatio: number;
  checksum: string;
  keyId: string;
  algorithm: string;
  chunks: BackupChunk[];
  isIncremental: boolean;
  baseBackupId?: string;
}

export interface BackupChunk {
  chunkId: string;
  sequence: number;
  size: number;
  checksum: string;
  encryptedChecksum: string;
}

export interface BackupKey {
  keyId: string;
  keyData: Buffer;
  salt: Buffer;
  iterations: number;
  algorithm: string;
  createdAt: Date;
  isActive: boolean;
}

export interface BackupStats {
  totalBackups: number;
  totalSize: number;
  encryptedSize: number;
  averageCompressionRatio: number;
  lastBackupTime: Date;
  encryptionTime: number;
  throughputMBps: number;
}

export class BackupEncryptionService extends EventEmitter {
  private config: BackupEncryptionConfig;
  private keys: Map<string, BackupKey>;
  private backupMetadata: Map<string, BackupMetadata>;
  private stats: BackupStats;
  private isInitialized: boolean = false;

  constructor(config?: Partial<BackupEncryptionConfig>) {
    super();
    this.config = {
      algorithm: "AES-256-GCM",
      keyDerivation: "PBKDF2",
      compressionLevel: 6,
      chunkSize: 64 * 1024 * 1024, // 64MB chunks
      parallelStreams: 4,
      checksumAlgorithm: "SHA-256",
      keyRotationDays: 90,
      redundancyLevel: 3,
      ...config,
    };

    this.keys = new Map();
    this.backupMetadata = new Map();
    this.stats = {
      totalBackups: 0,
      totalSize: 0,
      encryptedSize: 0,
      averageCompressionRatio: 1.0,
      lastBackupTime: new Date(0),
      encryptionTime: 0,
      throughputMBps: 0,
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.generateMasterKey();
      this.scheduleKeyRotation();
      this.startCleanupSchedule();

      this.isInitialized = true;
      this.emit("initialized");
    } catch (error) {
      this.emit("initializationError", error);
      throw error;
    }
  }

  private async generateMasterKey(): Promise<void> {
    const keyId = `backup_key_${Date.now()}`;
    const keyData = crypto.randomBytes(32);
    const salt = crypto.randomBytes(16);

    const backupKey: BackupKey = {
      keyId,
      keyData,
      salt,
      iterations: 100000,
      algorithm: this.config.algorithm,
      createdAt: new Date(),
      isActive: true,
    };

    this.keys.set(keyId, backupKey);
    this.emit("keyGenerated", { keyId, timestamp: new Date() });
  }

  async createEncryptedBackup(
    sourceData: Buffer | string,
    backupId: string,
    isIncremental: boolean = false,
    baseBackupId?: string,
  ): Promise<BackupMetadata> {
    const startTime = Date.now();

    try {
      const sourceBuffer = Buffer.isBuffer(sourceData)
        ? sourceData
        : Buffer.from(sourceData, "utf8");
      const sourceSize = sourceBuffer.length;

      // Get active encryption key
      const activeKey = this.getActiveKey();
      if (!activeKey) {
        throw new Error("No active encryption key available");
      }

      // Compress data first
      const compressedData = await this.compressData(sourceBuffer);
      const compressionRatio = sourceSize / compressedData.length;

      // Split into chunks for parallel processing
      const chunks = await this.splitIntoChunks(compressedData, backupId);

      // Encrypt chunks in parallel
      const encryptedChunks = await this.encryptChunksParallel(
        chunks,
        activeKey,
      );

      // Calculate checksums
      const checksum = this.calculateChecksum(sourceBuffer);
      const encryptedChecksum = this.calculateChecksum(
        Buffer.concat(encryptedChunks.map((c) => c.data)),
      );

      // Create metadata
      const metadata: BackupMetadata = {
        backupId,
        timestamp: new Date(),
        sourceSize,
        encryptedSize: encryptedChunks.reduce(
          (sum, chunk) => sum + chunk.size,
          0,
        ),
        compressionRatio,
        checksum,
        keyId: activeKey.keyId,
        algorithm: activeKey.algorithm,
        chunks: encryptedChunks.map((chunk) => ({
          chunkId: chunk.chunkId,
          sequence: chunk.sequence,
          size: chunk.size,
          checksum: chunk.checksum,
          encryptedChecksum: chunk.encryptedChecksum,
        })),
        isIncremental,
        baseBackupId,
      };

      // Store metadata
      this.backupMetadata.set(backupId, metadata);

      // Update statistics
      this.updateStats(
        sourceSize,
        metadata.encryptedSize,
        compressionRatio,
        Date.now() - startTime,
      );

      // Create redundant copies
      await this.createRedundantCopies(metadata, encryptedChunks);

      this.emit("backupCreated", { backupId, metadata });
      return metadata;
    } catch (error) {
      this.emit("backupError", { backupId, error });
      throw error;
    }
  }

  async restoreFromBackup(backupId: string): Promise<Buffer> {
    try {
      const metadata = this.backupMetadata.get(backupId);
      if (!metadata) {
        throw new Error(`Backup metadata not found: ${backupId}`);
      }

      const key = this.keys.get(metadata.keyId);
      if (!key) {
        throw new Error(`Encryption key not found: ${metadata.keyId}`);
      }

      // Decrypt chunks in parallel
      const decryptedChunks = await this.decryptChunksParallel(
        metadata.chunks,
        key,
      );

      // Reassemble data
      const compressedData = Buffer.concat(decryptedChunks);

      // Decompress
      const originalData = await this.decompressData(compressedData);

      // Verify integrity
      const checksum = this.calculateChecksum(originalData);
      if (checksum !== metadata.checksum) {
        throw new Error("Backup integrity check failed");
      }

      this.emit("backupRestored", { backupId, size: originalData.length });
      return originalData;
    } catch (error) {
      this.emit("restoreError", { backupId, error });
      throw error;
    }
  }

  async verifyBackupIntegrity(backupId: string): Promise<boolean> {
    try {
      const metadata = this.backupMetadata.get(backupId);
      if (!metadata) return false;

      const key = this.keys.get(metadata.keyId);
      if (!key) return false;

      // Verify each chunk
      for (const chunkInfo of metadata.chunks) {
        const isValid = await this.verifyChunkIntegrity(chunkInfo, key);
        if (!isValid) {
          this.emit("integrityCheckFailed", {
            backupId,
            chunkId: chunkInfo.chunkId,
          });
          return false;
        }
      }

      this.emit("integrityCheckPassed", { backupId });
      return true;
    } catch (error) {
      this.emit("integrityCheckError", { backupId, error });
      return false;
    }
  }

  private async splitIntoChunks(
    data: Buffer,
    backupId: string,
  ): Promise<Array<{ chunkId: string; sequence: number; data: Buffer }>> {
    const chunks = [];
    const chunkSize = this.config.chunkSize;

    for (let i = 0; i < data.length; i += chunkSize) {
      const chunkData = data.slice(i, i + chunkSize);
      const chunkId = `${backupId}_chunk_${Math.floor(i / chunkSize)}`;

      chunks.push({
        chunkId,
        sequence: Math.floor(i / chunkSize),
        data: chunkData,
      });
    }

    return chunks;
  }

  private async encryptChunksParallel(
    chunks: Array<{ chunkId: string; sequence: number; data: Buffer }>,
    key: BackupKey,
  ): Promise<
    Array<{
      chunkId: string;
      sequence: number;
      data: Buffer;
      size: number;
      checksum: string;
      encryptedChecksum: string;
    }>
  > {
    const chunkGroups = this.groupChunks(chunks, this.config.parallelStreams);
    const encryptedGroups = await Promise.all(
      chunkGroups.map((group) => this.encryptChunkGroup(group, key)),
    );

    return encryptedGroups.flat().sort((a, b) => a.sequence - b.sequence);
  }

  private groupChunks<T>(chunks: T[], groupCount: number): T[][] {
    const groups: T[][] = Array(groupCount)
      .fill(null)
      .map(() => []);
    chunks.forEach((chunk, index) => {
      groups[index % groupCount].push(chunk);
    });
    return groups;
  }

  private async encryptChunkGroup(
    chunks: Array<{ chunkId: string; sequence: number; data: Buffer }>,
    key: BackupKey,
  ): Promise<
    Array<{
      chunkId: string;
      sequence: number;
      data: Buffer;
      size: number;
      checksum: string;
      encryptedChecksum: string;
    }>
  > {
    const encryptedChunks = [];

    for (const chunk of chunks) {
      const originalChecksum = this.calculateChecksum(chunk.data);
      const encryptedData = await this.encryptChunk(chunk.data, key);
      const encryptedChecksum = this.calculateChecksum(encryptedData);

      encryptedChunks.push({
        chunkId: chunk.chunkId,
        sequence: chunk.sequence,
        data: encryptedData,
        size: encryptedData.length,
        checksum: originalChecksum,
        encryptedChecksum,
      });
    }

    return encryptedChunks;
  }

  private async encryptChunk(data: Buffer, key: BackupKey): Promise<Buffer> {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipherGCM(
      key.algorithm.toLowerCase(),
      key.keyData,
      iv,
    );

    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const tag = cipher.getAuthTag();

    // Combine IV, tag, and encrypted data
    return Buffer.concat([iv, tag, encrypted]);
  }

  private async decryptChunksParallel(
    chunkInfos: BackupChunk[],
    key: BackupKey,
  ): Promise<Buffer[]> {
    const chunkGroups = this.groupChunks(
      chunkInfos,
      this.config.parallelStreams,
    );
    const decryptedGroups = await Promise.all(
      chunkGroups.map((group) => this.decryptChunkGroup(group, key)),
    );

    return decryptedGroups
      .flat()
      .sort((a, b) => a.sequence - b.sequence)
      .map((chunk) => chunk.data);
  }

  private async decryptChunkGroup(
    chunkInfos: BackupChunk[],
    key: BackupKey,
  ): Promise<Array<{ sequence: number; data: Buffer }>> {
    const decryptedChunks = [];

    for (const chunkInfo of chunkInfos) {
      // In a real implementation, you would load the encrypted chunk data from storage
      // For now, we'll simulate this
      const encryptedData = await this.loadChunkData(chunkInfo.chunkId);
      const decryptedData = await this.decryptChunk(encryptedData, key);

      // Verify chunk integrity
      const checksum = this.calculateChecksum(decryptedData);
      if (checksum !== chunkInfo.checksum) {
        throw new Error(`Chunk integrity check failed: ${chunkInfo.chunkId}`);
      }

      decryptedChunks.push({
        sequence: chunkInfo.sequence,
        data: decryptedData,
      });
    }

    return decryptedChunks;
  }

  private async decryptChunk(
    encryptedData: Buffer,
    key: BackupKey,
  ): Promise<Buffer> {
    const iv = encryptedData.slice(0, 16);
    const tag = encryptedData.slice(16, 32);
    const encrypted = encryptedData.slice(32);

    const decipher = crypto.createDecipherGCM(
      key.algorithm.toLowerCase(),
      key.keyData,
      iv,
    );
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted;
  }

  private async loadChunkData(chunkId: string): Promise<Buffer> {
    // This would load the actual encrypted chunk data from storage
    // Implementation depends on storage backend (filesystem, S3, etc.)
    // For now, return empty buffer as placeholder
    return Buffer.alloc(0);
  }

  private async compressData(data: Buffer): Promise<Buffer> {
    const zlib = await import("zlib");
    return new Promise((resolve, reject) => {
      zlib.gzip(
        data,
        { level: this.config.compressionLevel },
        (err, compressed) => {
          if (err) reject(err);
          else resolve(compressed);
        },
      );
    });
  }

  private async decompressData(data: Buffer): Promise<Buffer> {
    const zlib = await import("zlib");
    return new Promise((resolve, reject) => {
      zlib.gunzip(data, (err, decompressed) => {
        if (err) reject(err);
        else resolve(decompressed);
      });
    });
  }

  private calculateChecksum(data: Buffer): string {
    const algorithm = this.config.checksumAlgorithm
      .toLowerCase()
      .replace("-", "");
    return crypto.createHash(algorithm).update(data).digest("hex");
  }

  private async verifyChunkIntegrity(
    chunkInfo: BackupChunk,
    key: BackupKey,
  ): Promise<boolean> {
    try {
      const encryptedData = await this.loadChunkData(chunkInfo.chunkId);
      const encryptedChecksum = this.calculateChecksum(encryptedData);

      if (encryptedChecksum !== chunkInfo.encryptedChecksum) {
        return false;
      }

      const decryptedData = await this.decryptChunk(encryptedData, key);
      const decryptedChecksum = this.calculateChecksum(decryptedData);

      return decryptedChecksum === chunkInfo.checksum;
    } catch (error) {
      return false;
    }
  }

  private async createRedundantCopies(
    metadata: BackupMetadata,
    encryptedChunks: Array<{ chunkId: string; data: Buffer }>,
  ): Promise<void> {
    for (let copy = 1; copy < this.config.redundancyLevel; copy++) {
      for (const chunk of encryptedChunks) {
        const redundantChunkId = `${chunk.chunkId}_copy_${copy}`;
        // Store redundant copy (implementation depends on storage backend)
        this.emit("redundantCopyCreated", {
          originalChunkId: chunk.chunkId,
          redundantChunkId,
        });
      }
    }
  }

  private getActiveKey(): BackupKey | null {
    for (const key of this.keys.values()) {
      if (key.isActive) return key;
    }
    return null;
  }

  private updateStats(
    sourceSize: number,
    encryptedSize: number,
    compressionRatio: number,
    encryptionTime: number,
  ): void {
    this.stats.totalBackups++;
    this.stats.totalSize += sourceSize;
    this.stats.encryptedSize += encryptedSize;
    this.stats.averageCompressionRatio =
      (this.stats.averageCompressionRatio * (this.stats.totalBackups - 1) +
        compressionRatio) /
      this.stats.totalBackups;
    this.stats.lastBackupTime = new Date();
    this.stats.encryptionTime = encryptionTime;
    this.stats.throughputMBps =
      sourceSize / 1024 / 1024 / (encryptionTime / 1000);
  }

  private scheduleKeyRotation(): void {
    const interval = this.config.keyRotationDays * 24 * 60 * 60 * 1000;
    setInterval(async () => {
      await this.rotateKeys();
    }, interval);
  }

  private startCleanupSchedule(): void {
    // Run cleanup daily
    setInterval(
      () => {
        this.cleanupOldBackups();
      },
      24 * 60 * 60 * 1000,
    );
  }

  async rotateKeys(): Promise<void> {
    try {
      // Mark current active key as inactive
      const activeKey = this.getActiveKey();
      if (activeKey) {
        activeKey.isActive = false;
      }

      // Generate new active key
      await this.generateMasterKey();

      this.emit("keyRotated", { timestamp: new Date() });
    } catch (error) {
      this.emit("keyRotationError", error);
      throw error;
    }
  }

  private cleanupOldBackups(): void {
    const cutoffDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 year

    for (const [backupId, metadata] of this.backupMetadata.entries()) {
      if (metadata.timestamp < cutoffDate) {
        this.backupMetadata.delete(backupId);
        this.emit("oldBackupCleaned", {
          backupId,
          timestamp: metadata.timestamp,
        });
      }
    }
  }

  getBackupStats(): BackupStats {
    return { ...this.stats };
  }

  getBackupMetadata(backupId: string): BackupMetadata | undefined {
    return this.backupMetadata.get(backupId);
  }

  getAllBackups(): BackupMetadata[] {
    return Array.from(this.backupMetadata.values());
  }

  async shutdown(): Promise<void> {
    this.emit("shutdown");
    this.removeAllListeners();
  }
}

export default BackupEncryptionService;
