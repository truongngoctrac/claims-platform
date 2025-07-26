import fs from 'fs/promises';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGzip, createGunzip } from 'zlib';
import { EventEmitter } from 'events';
import { MultiLevelCacheManager } from './MultiLevelCacheManager';
import { RedisClusterManager } from './RedisClusterManager';
import cron from 'node-cron';

export interface BackupConfig {
  id: string;
  name: string;
  enabled: boolean;
  schedule?: string; // Cron expression
  type: 'full' | 'incremental' | 'differential';
  target: 'file' | 'cloud' | 'database' | 'remote_cache';
  compression: boolean;
  encryption: boolean;
  retention: {
    count?: number; // Number of backups to keep
    days?: number; // Days to keep backups
  };
  destination: {
    path?: string;
    s3Bucket?: string;
    s3Key?: string;
    databaseConnection?: string;
    remoteEndpoint?: string;
  };
  filters?: {
    includePatterns?: (string | RegExp)[];
    excludePatterns?: (string | RegExp)[];
    includeLevels?: string[];
    excludeLevels?: string[];
    includePartitions?: string[];
    excludePartitions?: string[];
  };
  metadata: {
    description?: string;
    owner?: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    environment?: 'dev' | 'staging' | 'prod';
  };
}

export interface BackupJob {
  id: string;
  configId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  type: 'full' | 'incremental' | 'differential';
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  totalKeys: number;
  backedUpKeys: number;
  failedKeys: number;
  compressedSize?: number;
  originalSize?: number;
  compressionRatio?: number;
  checksum?: string;
  errors: Array<{ key: string; error: string }>;
  metadata: {
    version: string;
    cacheVersion: string;
    nodeId: string;
    environment: string;
  };
}

export interface RestoreJob {
  id: string;
  backupJobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime?: Date;
  endTime?: Date;
  totalKeys: number;
  restoredKeys: number;
  failedKeys: number;
  conflictResolution: 'overwrite' | 'skip' | 'merge';
  errors: Array<{ key: string; error: string }>;
  dryRun: boolean;
}

export interface BackupEntry {
  key: string;
  value: any;
  ttl?: number;
  level: string;
  partition?: string;
  timestamp: Date;
  metadata?: any;
}

export interface BackupManifest {
  version: string;
  timestamp: Date;
  type: 'full' | 'incremental' | 'differential';
  totalKeys: number;
  compression: boolean;
  encryption: boolean;
  checksum: string;
  metadata: {
    nodeId: string;
    environment: string;
    cacheVersion: string;
    partitions: string[];
    levels: string[];
  };
  files: Array<{
    name: string;
    size: number;
    checksum: string;
    keyCount: number;
  }>;
}

export interface RecoveryPlan {
  id: string;
  name: string;
  description: string;
  steps: RecoveryStep[];
  estimatedDuration: number;
  riskLevel: 'low' | 'medium' | 'high';
  rollbackPlan: RecoveryStep[];
}

export interface RecoveryStep {
  id: string;
  name: string;
  type: 'backup' | 'restore' | 'validate' | 'custom';
  config: any;
  dependsOn?: string[];
  timeout: number;
  retryAttempts: number;
}

export class CacheBackupManager extends EventEmitter {
  private cacheManager: MultiLevelCacheManager;
  private redisCluster: RedisClusterManager | null;
  private backupConfigs: Map<string, BackupConfig> = new Map();
  private backupJobs: Map<string, BackupJob> = new Map();
  private restoreJobs: Map<string, RestoreJob> = new Map();
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();
  private recoveryPlans: Map<string, RecoveryPlan> = new Map();
  private lastFullBackup: Map<string, Date> = new Map();
  private backupDirectory: string;

  constructor(
    cacheManager: MultiLevelCacheManager,
    backupDirectory = './backups',
    redisCluster?: RedisClusterManager
  ) {
    super();
    this.cacheManager = cacheManager;
    this.redisCluster = redisCluster || null;
    this.backupDirectory = backupDirectory;

    this.ensureBackupDirectory();
    this.setupDefaultConfigs();
    this.startPeriodicTasks();
  }

  private async ensureBackupDirectory(): Promise<void> {
    try {
      await fs.access(this.backupDirectory);
    } catch {
      await fs.mkdir(this.backupDirectory, { recursive: true });
    }
  }

  private setupDefaultConfigs(): void {
    // Daily full backup
    this.createBackupConfig({
      id: 'daily_full',
      name: 'Daily Full Backup',
      enabled: true,
      schedule: '0 2 * * *', // 2 AM daily
      type: 'full',
      target: 'file',
      compression: true,
      encryption: false,
      retention: {
        count: 7,
        days: 30,
      },
      destination: {
        path: path.join(this.backupDirectory, 'full'),
      },
      metadata: {
        description: 'Daily full backup of all cache data',
        priority: 'high',
        environment: process.env.NODE_ENV || 'dev',
      },
    });

    // Hourly incremental backup
    this.createBackupConfig({
      id: 'hourly_incremental',
      name: 'Hourly Incremental Backup',
      enabled: true,
      schedule: '0 * * * *', // Every hour
      type: 'incremental',
      target: 'file',
      compression: true,
      encryption: false,
      retention: {
        count: 24,
      },
      destination: {
        path: path.join(this.backupDirectory, 'incremental'),
      },
      filters: {
        includeLevels: ['L1', 'L2'], // Only backup hot cache levels
      },
      metadata: {
        description: 'Hourly incremental backup of hot cache data',
        priority: 'medium',
        environment: process.env.NODE_ENV || 'dev',
      },
    });

    // Critical data backup
    this.createBackupConfig({
      id: 'critical_data',
      name: 'Critical Data Backup',
      enabled: true,
      schedule: '*/15 * * * *', // Every 15 minutes
      type: 'differential',
      target: 'file',
      compression: true,
      encryption: true,
      retention: {
        count: 50,
      },
      destination: {
        path: path.join(this.backupDirectory, 'critical'),
      },
      filters: {
        includePatterns: [/^session:/, /^user:.*:profile$/],
        includePartitions: ['session_data', 'user_data'],
      },
      metadata: {
        description: 'Frequent backup of critical user data',
        priority: 'critical',
        environment: process.env.NODE_ENV || 'dev',
      },
    });
  }

  private startPeriodicTasks(): void {
    // Cleanup old backups every hour
    setInterval(() => {
      this.cleanupOldBackups();
    }, 60 * 60 * 1000);

    // Validate backup integrity daily
    setInterval(() => {
      this.validateBackupIntegrity();
    }, 24 * 60 * 60 * 1000);
  }

  createBackupConfig(config: BackupConfig): string {
    this.backupConfigs.set(config.id, config);
    
    if (config.enabled && config.schedule) {
      this.scheduleBackup(config);
    }

    this.emit('backup-config-created', config);
    return config.id;
  }

  updateBackupConfig(configId: string, updates: Partial<BackupConfig>): boolean {
    const config = this.backupConfigs.get(configId);
    if (!config) return false;

    // If schedule changed, update cron job
    if (updates.schedule && updates.schedule !== config.schedule) {
      this.unscheduleBackup(configId);
    }

    const updatedConfig = { ...config, ...updates };
    this.backupConfigs.set(configId, updatedConfig);

    if (updatedConfig.enabled && updatedConfig.schedule) {
      this.scheduleBackup(updatedConfig);
    }

    this.emit('backup-config-updated', updatedConfig);
    return true;
  }

  deleteBackupConfig(configId: string): boolean {
    const config = this.backupConfigs.get(configId);
    if (!config) return false;

    this.unscheduleBackup(configId);
    this.backupConfigs.delete(configId);

    this.emit('backup-config-deleted', configId);
    return true;
  }

  private scheduleBackup(config: BackupConfig): void {
    if (!config.schedule) return;

    try {
      const task = cron.schedule(config.schedule, async () => {
        await this.executeBackup(config.id);
      }, {
        scheduled: config.enabled,
      });

      this.scheduledTasks.set(config.id, task);
    } catch (error) {
      console.error(`Failed to schedule backup ${config.id}:`, error);
    }
  }

  private unscheduleBackup(configId: string): void {
    const task = this.scheduledTasks.get(configId);
    if (task) {
      task.stop();
      this.scheduledTasks.delete(configId);
    }
  }

  async executeBackup(configId: string): Promise<string> {
    const config = this.backupConfigs.get(configId);
    if (!config || !config.enabled) {
      throw new Error(`Backup config ${configId} not found or disabled`);
    }

    const jobId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job: BackupJob = {
      id: jobId,
      configId,
      status: 'pending',
      type: config.type,
      totalKeys: 0,
      backedUpKeys: 0,
      failedKeys: 0,
      errors: [],
      metadata: {
        version: '1.0.0',
        cacheVersion: '1.0.0',
        nodeId: process.env.NODE_ID || 'default',
        environment: process.env.NODE_ENV || 'dev',
      },
    };

    this.backupJobs.set(jobId, job);
    this.emit('backup-started', job);

    try {
      await this.performBackup(job, config);
    } catch (error) {
      job.status = 'failed';
      job.endTime = new Date();
      this.backupJobs.set(jobId, job);
      this.emit('backup-failed', { job, error });
      throw error;
    }

    return jobId;
  }

  private async performBackup(job: BackupJob, config: BackupConfig): Promise<void> {
    job.status = 'running';
    job.startTime = new Date();
    this.backupJobs.set(job.id, job);

    try {
      // Determine what keys to backup
      const keysToBackup = await this.getKeysForBackup(config, job.type);
      job.totalKeys = keysToBackup.length;
      this.backupJobs.set(job.id, job);

      if (keysToBackup.length === 0) {
        job.status = 'completed';
        job.endTime = new Date();
        job.duration = job.endTime.getTime() - job.startTime!.getTime();
        this.backupJobs.set(job.id, job);
        this.emit('backup-completed', job);
        return;
      }

      // Create backup data
      const backupEntries: BackupEntry[] = [];
      let originalSize = 0;

      for (const key of keysToBackup) {
        try {
          const value = await this.cacheManager.get(key);
          if (value !== null) {
            const entry: BackupEntry = {
              key,
              value,
              level: 'L1', // Would need to determine actual level
              timestamp: new Date(),
            };

            backupEntries.push(entry);
            originalSize += JSON.stringify(entry).length;
            job.backedUpKeys++;
          }
        } catch (error) {
          job.failedKeys++;
          job.errors.push({ key, error: error.message });
        }
      }

      job.originalSize = originalSize;
      this.backupJobs.set(job.id, job);

      // Save backup to destination
      await this.saveBackupData(job, config, backupEntries);

      // Update last backup time for incremental backups
      if (job.type === 'full') {
        this.lastFullBackup.set(config.id, new Date());
      }

      job.status = 'completed';
      job.endTime = new Date();
      job.duration = job.endTime.getTime() - job.startTime!.getTime();
      this.backupJobs.set(job.id, job);

      this.emit('backup-completed', job);

    } catch (error) {
      job.status = 'failed';
      job.endTime = new Date();
      this.backupJobs.set(job.id, job);
      throw error;
    }
  }

  private async getKeysForBackup(config: BackupConfig, backupType: string): Promise<string[]> {
    // This would need to be implemented based on your cache backend
    // For now, return a placeholder
    const allKeys: string[] = [];

    // Apply filters
    let filteredKeys = allKeys;

    if (config.filters) {
      // Include patterns
      if (config.filters.includePatterns) {
        filteredKeys = filteredKeys.filter(key =>
          config.filters!.includePatterns!.some(pattern =>
            typeof pattern === 'string' ? key.includes(pattern) : pattern.test(key)
          )
        );
      }

      // Exclude patterns
      if (config.filters.excludePatterns) {
        filteredKeys = filteredKeys.filter(key =>
          !config.filters!.excludePatterns!.some(pattern =>
            typeof pattern === 'string' ? key.includes(pattern) : pattern.test(key)
          )
        );
      }
    }

    // For incremental/differential backups, filter by modification time
    if (backupType === 'incremental' || backupType === 'differential') {
      const lastBackupTime = this.getLastBackupTime(config.id, backupType);
      if (lastBackupTime) {
        // Would need to filter keys modified since last backup
        // This requires tracking modification times
      }
    }

    return filteredKeys;
  }

  private getLastBackupTime(configId: string, backupType: string): Date | null {
    if (backupType === 'incremental') {
      // Find last incremental backup
      const lastJob = Array.from(this.backupJobs.values())
        .filter(job => job.configId === configId && job.type === 'incremental' && job.status === 'completed')
        .sort((a, b) => (b.endTime?.getTime() || 0) - (a.endTime?.getTime() || 0))[0];
      
      return lastJob?.endTime || null;
    } else if (backupType === 'differential') {
      // Use last full backup time
      return this.lastFullBackup.get(configId) || null;
    }

    return null;
  }

  private async saveBackupData(
    job: BackupJob,
    config: BackupConfig,
    entries: BackupEntry[]
  ): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${config.id}_${job.type}_${timestamp}.json`;
    
    switch (config.target) {
      case 'file':
        await this.saveToFile(job, config, entries, fileName);
        break;
      case 'cloud':
        await this.saveToCloud(job, config, entries, fileName);
        break;
      case 'database':
        await this.saveToDatabase(job, config, entries);
        break;
      case 'remote_cache':
        await this.saveToRemoteCache(job, config, entries);
        break;
    }
  }

  private async saveToFile(
    job: BackupJob,
    config: BackupConfig,
    entries: BackupEntry[],
    fileName: string
  ): Promise<void> {
    const destinationPath = config.destination.path || this.backupDirectory;
    await fs.mkdir(destinationPath, { recursive: true });

    const filePath = path.join(destinationPath, fileName);
    const data = JSON.stringify(entries);

    if (config.compression) {
      const compressedPath = filePath + '.gz';
      await pipeline(
        async function* () {
          yield Buffer.from(data);
        },
        createGzip(),
        createWriteStream(compressedPath)
      );

      const stats = await fs.stat(compressedPath);
      job.compressedSize = stats.size;
      job.compressionRatio = job.originalSize ? job.originalSize / job.compressedSize : 1;
    } else {
      await fs.writeFile(filePath, data);
      const stats = await fs.stat(filePath);
      job.compressedSize = stats.size;
    }

    // Generate checksum
    job.checksum = await this.generateChecksum(data);

    // Create manifest
    const manifest: BackupManifest = {
      version: '1.0.0',
      timestamp: new Date(),
      type: job.type,
      totalKeys: entries.length,
      compression: config.compression,
      encryption: config.encryption,
      checksum: job.checksum,
      metadata: job.metadata,
      files: [{
        name: fileName,
        size: job.compressedSize,
        checksum: job.checksum,
        keyCount: entries.length,
      }],
    };

    const manifestPath = path.join(destinationPath, `${fileName}.manifest.json`);
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  }

  private async saveToCloud(
    job: BackupJob,
    config: BackupConfig,
    entries: BackupEntry[],
    fileName: string
  ): Promise<void> {
    // Placeholder for cloud storage implementation (AWS S3, etc.)
    throw new Error('Cloud backup not implemented');
  }

  private async saveToDatabase(
    job: BackupJob,
    config: BackupConfig,
    entries: BackupEntry[]
  ): Promise<void> {
    // Placeholder for database backup implementation
    throw new Error('Database backup not implemented');
  }

  private async saveToRemoteCache(
    job: BackupJob,
    config: BackupConfig,
    entries: BackupEntry[]
  ): Promise<void> {
    // Placeholder for remote cache backup implementation
    throw new Error('Remote cache backup not implemented');
  }

  private async generateChecksum(data: string): Promise<string> {
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  async restoreFromBackup(
    backupJobId: string,
    options: {
      conflictResolution?: 'overwrite' | 'skip' | 'merge';
      dryRun?: boolean;
      targetLevel?: string;
      keyFilter?: (key: string) => boolean;
    } = {}
  ): Promise<string> {
    const backupJob = this.backupJobs.get(backupJobId);
    if (!backupJob || backupJob.status !== 'completed') {
      throw new Error('Backup job not found or not completed');
    }

    const restoreJobId = `restore_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const restoreJob: RestoreJob = {
      id: restoreJobId,
      backupJobId,
      status: 'pending',
      totalKeys: 0,
      restoredKeys: 0,
      failedKeys: 0,
      conflictResolution: options.conflictResolution || 'overwrite',
      errors: [],
      dryRun: options.dryRun || false,
    };

    this.restoreJobs.set(restoreJobId, restoreJob);
    this.emit('restore-started', restoreJob);

    try {
      await this.performRestore(restoreJob, backupJob, options);
    } catch (error) {
      restoreJob.status = 'failed';
      restoreJob.endTime = new Date();
      this.restoreJobs.set(restoreJobId, restoreJob);
      this.emit('restore-failed', { restoreJob, error });
      throw error;
    }

    return restoreJobId;
  }

  private async performRestore(
    restoreJob: RestoreJob,
    backupJob: BackupJob,
    options: any
  ): Promise<void> {
    restoreJob.status = 'running';
    restoreJob.startTime = new Date();
    this.restoreJobs.set(restoreJob.id, restoreJob);

    try {
      // Load backup data
      const backupData = await this.loadBackupData(backupJob);
      restoreJob.totalKeys = backupData.length;
      this.restoreJobs.set(restoreJob.id, restoreJob);

      // Restore each entry
      for (const entry of backupData) {
        // Apply key filter if provided
        if (options.keyFilter && !options.keyFilter(entry.key)) {
          continue;
        }

        try {
          if (!restoreJob.dryRun) {
            // Check for conflicts
            const existingValue = await this.cacheManager.get(entry.key);
            
            if (existingValue !== null) {
              switch (restoreJob.conflictResolution) {
                case 'skip':
                  continue;
                case 'merge':
                  // Simple merge strategy - could be more sophisticated
                  if (typeof existingValue === 'object' && typeof entry.value === 'object') {
                    entry.value = { ...existingValue, ...entry.value };
                  }
                  break;
                case 'overwrite':
                default:
                  // Proceed with overwrite
                  break;
              }
            }

            // Restore the value
            await this.cacheManager.set(entry.key, entry.value, {
              ttl: entry.ttl,
              level: options.targetLevel || entry.level,
            });
          }

          restoreJob.restoredKeys++;
        } catch (error) {
          restoreJob.failedKeys++;
          restoreJob.errors.push({ key: entry.key, error: error.message });
        }
      }

      restoreJob.status = 'completed';
      restoreJob.endTime = new Date();
      this.restoreJobs.set(restoreJob.id, restoreJob);

      this.emit('restore-completed', restoreJob);

    } catch (error) {
      restoreJob.status = 'failed';
      restoreJob.endTime = new Date();
      this.restoreJobs.set(restoreJob.id, restoreJob);
      throw error;
    }
  }

  private async loadBackupData(backupJob: BackupJob): Promise<BackupEntry[]> {
    const config = this.backupConfigs.get(backupJob.configId);
    if (!config) {
      throw new Error('Backup configuration not found');
    }

    switch (config.target) {
      case 'file':
        return this.loadFromFile(backupJob, config);
      case 'cloud':
        return this.loadFromCloud(backupJob, config);
      case 'database':
        return this.loadFromDatabase(backupJob, config);
      case 'remote_cache':
        return this.loadFromRemoteCache(backupJob, config);
      default:
        throw new Error(`Unsupported backup target: ${config.target}`);
    }
  }

  private async loadFromFile(backupJob: BackupJob, config: BackupConfig): Promise<BackupEntry[]> {
    const destinationPath = config.destination.path || this.backupDirectory;
    
    // Find the backup file (would need better file tracking in practice)
    const files = await fs.readdir(destinationPath);
    const backupFile = files.find(file => file.startsWith(config.id));
    
    if (!backupFile) {
      throw new Error('Backup file not found');
    }

    const filePath = path.join(destinationPath, backupFile);
    
    let data: string;
    if (config.compression && backupFile.endsWith('.gz')) {
      // Decompress
      const chunks: Buffer[] = [];
      await pipeline(
        createReadStream(filePath),
        createGunzip(),
        async function* (source) {
          for await (const chunk of source) {
            chunks.push(chunk);
            yield chunk;
          }
        }
      );
      data = Buffer.concat(chunks).toString();
    } else {
      data = await fs.readFile(filePath, 'utf8');
    }

    // Verify checksum if available
    if (backupJob.checksum) {
      const calculatedChecksum = await this.generateChecksum(data);
      if (calculatedChecksum !== backupJob.checksum) {
        throw new Error('Backup data integrity check failed');
      }
    }

    return JSON.parse(data);
  }

  private async loadFromCloud(backupJob: BackupJob, config: BackupConfig): Promise<BackupEntry[]> {
    throw new Error('Cloud restore not implemented');
  }

  private async loadFromDatabase(backupJob: BackupJob, config: BackupConfig): Promise<BackupEntry[]> {
    throw new Error('Database restore not implemented');
  }

  private async loadFromRemoteCache(backupJob: BackupJob, config: BackupConfig): Promise<BackupEntry[]> {
    throw new Error('Remote cache restore not implemented');
  }

  private async cleanupOldBackups(): Promise<void> {
    for (const [configId, config] of this.backupConfigs) {
      if (!config.destination.path) continue;

      try {
        const files = await fs.readdir(config.destination.path);
        const backupFiles = files
          .filter(file => file.startsWith(config.id))
          .map(file => ({
            name: file,
            path: path.join(config.destination.path!, file),
          }));

        // Sort by modification time
        const fileStats = await Promise.all(
          backupFiles.map(async file => ({
            ...file,
            stats: await fs.stat(file.path),
          }))
        );

        fileStats.sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());

        // Apply retention policy
        const filesToDelete: string[] = [];

        if (config.retention.count && fileStats.length > config.retention.count) {
          filesToDelete.push(...fileStats.slice(config.retention.count).map(f => f.path));
        }

        if (config.retention.days) {
          const cutoffDate = new Date(Date.now() - config.retention.days * 24 * 60 * 60 * 1000);
          filesToDelete.push(
            ...fileStats
              .filter(f => f.stats.mtime < cutoffDate)
              .map(f => f.path)
          );
        }

        // Remove duplicate paths and delete files
        const uniqueFilesToDelete = [...new Set(filesToDelete)];
        for (const filePath of uniqueFilesToDelete) {
          await fs.unlink(filePath);
        }

        if (uniqueFilesToDelete.length > 0) {
          this.emit('backups-cleaned', {
            configId,
            deletedCount: uniqueFilesToDelete.length,
          });
        }

      } catch (error) {
        console.error(`Failed to cleanup backups for ${configId}:`, error);
      }
    }
  }

  private async validateBackupIntegrity(): Promise<void> {
    for (const [jobId, job] of this.backupJobs) {
      if (job.status !== 'completed' || !job.checksum) continue;

      try {
        const backupData = await this.loadBackupData(job);
        const dataString = JSON.stringify(backupData);
        const calculatedChecksum = await this.generateChecksum(dataString);

        if (calculatedChecksum !== job.checksum) {
          this.emit('backup-integrity-failed', {
            jobId,
            expected: job.checksum,
            actual: calculatedChecksum,
          });
        }
      } catch (error) {
        this.emit('backup-validation-error', { jobId, error });
      }
    }
  }

  // Recovery Plan Management
  createRecoveryPlan(plan: Omit<RecoveryPlan, 'id'>): string {
    const id = `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullPlan: RecoveryPlan = { id, ...plan };
    
    this.recoveryPlans.set(id, fullPlan);
    this.emit('recovery-plan-created', fullPlan);
    
    return id;
  }

  async executeRecoveryPlan(planId: string): Promise<void> {
    const plan = this.recoveryPlans.get(planId);
    if (!plan) {
      throw new Error('Recovery plan not found');
    }

    this.emit('recovery-plan-started', plan);

    try {
      for (const step of plan.steps) {
        await this.executeRecoveryStep(step);
      }

      this.emit('recovery-plan-completed', plan);
    } catch (error) {
      this.emit('recovery-plan-failed', { plan, error });
      
      // Execute rollback plan if available
      if (plan.rollbackPlan.length > 0) {
        try {
          for (const step of plan.rollbackPlan) {
            await this.executeRecoveryStep(step);
          }
        } catch (rollbackError) {
          this.emit('recovery-rollback-failed', { plan, error: rollbackError });
        }
      }
      
      throw error;
    }
  }

  private async executeRecoveryStep(step: RecoveryStep): Promise<void> {
    this.emit('recovery-step-started', step);

    try {
      switch (step.type) {
        case 'backup':
          await this.executeBackup(step.config.configId);
          break;
        case 'restore':
          await this.restoreFromBackup(step.config.backupJobId, step.config.options);
          break;
        case 'validate':
          await this.validateBackupIntegrity();
          break;
        case 'custom':
          if (step.config.function) {
            await step.config.function();
          }
          break;
      }

      this.emit('recovery-step-completed', step);
    } catch (error) {
      this.emit('recovery-step-failed', { step, error });
      throw error;
    }
  }

  // Public API methods
  getBackupConfigs(): BackupConfig[] {
    return Array.from(this.backupConfigs.values());
  }

  getBackupJobs(): BackupJob[] {
    return Array.from(this.backupJobs.values());
  }

  getRestoreJobs(): RestoreJob[] {
    return Array.from(this.restoreJobs.values());
  }

  getRecoveryPlans(): RecoveryPlan[] {
    return Array.from(this.recoveryPlans.values());
  }

  getBackupJob(jobId: string): BackupJob | null {
    return this.backupJobs.get(jobId) || null;
  }

  getRestoreJob(jobId: string): RestoreJob | null {
    return this.restoreJobs.get(jobId) || null;
  }

  cancelBackupJob(jobId: string): boolean {
    const job = this.backupJobs.get(jobId);
    if (!job || job.status !== 'running') return false;

    job.status = 'cancelled';
    job.endTime = new Date();
    this.backupJobs.set(jobId, job);
    
    this.emit('backup-cancelled', job);
    return true;
  }

  cancelRestoreJob(jobId: string): boolean {
    const job = this.restoreJobs.get(jobId);
    if (!job || job.status !== 'running') return false;

    job.status = 'cancelled';
    job.endTime = new Date();
    this.restoreJobs.set(jobId, job);
    
    this.emit('restore-cancelled', job);
    return true;
  }

  async shutdown(): Promise<void> {
    // Stop all scheduled tasks
    for (const [, task] of this.scheduledTasks) {
      task.stop();
    }
    this.scheduledTasks.clear();

    // Cancel running jobs
    for (const [jobId, job] of this.backupJobs) {
      if (job.status === 'running') {
        this.cancelBackupJob(jobId);
      }
    }

    for (const [jobId, job] of this.restoreJobs) {
      if (job.status === 'running') {
        this.cancelRestoreJob(jobId);
      }
    }

    this.emit('shutdown');
  }
}
