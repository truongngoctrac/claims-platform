/**
 * Distributed State Management Implementation
 * Healthcare Claims Processing System - Distributed Systems
 */

export interface StateEntry {
  key: string;
  value: any;
  version: number;
  timestamp: number;
  nodeId: string;
  vectorClock: VectorClock;
  isDeleted: boolean;
  ttl?: number;
  metadata: Record<string, any>;
}

export interface VectorClock {
  [nodeId: string]: number;
}

export interface StateOperation {
  operationType: 'read' | 'write' | 'delete' | 'merge';
  key: string;
  value?: any;
  conditions?: StateCondition[];
  timestamp: number;
  nodeId: string;
  transactionId?: string;
}

export interface StateCondition {
  type: 'version_equals' | 'version_greater' | 'exists' | 'not_exists';
  expectedValue?: any;
  expectedVersion?: number;
}

export interface StateManagerConfig {
  nodeId: string;
  replicationFactor: number;
  consistencyLevel: 'strong' | 'eventual' | 'bounded_staleness';
  conflictResolution: 'last_write_wins' | 'vector_clocks' | 'custom';
  stalenessBoundMs: number;
  enableVersioning: boolean;
  enableAuditLog: boolean;
  partitionCount: number;
}

export interface StatePartition {
  id: string;
  range: { start: string; end: string };
  primary: string;
  replicas: string[];
  size: number;
  lastCompacted: Date;
}

export abstract class DistributedStateManager {
  protected config: StateManagerConfig;
  protected localState: Map<string, StateEntry> = new Map();
  protected vectorClock: VectorClock = {};
  protected partitions: Map<string, StatePartition> = new Map();

  constructor(config: StateManagerConfig) {
    this.config = config;
    this.vectorClock[config.nodeId] = 0;
  }

  abstract read(key: string): Promise<StateEntry | null>;
  abstract write(key: string, value: any, conditions?: StateCondition[]): Promise<boolean>;
  abstract delete(key: string): Promise<boolean>;
  abstract merge(entries: StateEntry[]): Promise<void>;
  abstract getPartition(key: string): StatePartition;
}

export class EventualConsistentStateManager extends DistributedStateManager {
  private syncQueue: StateOperation[] = [];
  private conflictResolver: ConflictResolver;
  private auditLogger: StateAuditLogger;
  private replicationManager: StateReplicationManager;

  constructor(config: StateManagerConfig) {
    super(config);
    this.conflictResolver = new ConflictResolver(config.conflictResolution);
    this.auditLogger = new StateAuditLogger(config.enableAuditLog);
    this.replicationManager = new StateReplicationManager(config.replicationFactor);
    
    this.startSynchronization();
    this.startConflictResolution();
  }

  async read(key: string): Promise<StateEntry | null> {
    console.log(`📖 Reading state for key: ${key}`);
    
    // Try local first
    const localEntry = this.localState.get(key);
    
    if (localEntry && this.isFreshEnough(localEntry)) {
      await this.updateAccessMetadata(localEntry);
      return localEntry;
    }

    // Try replicas if local is stale or missing
    return this.readFromReplicas(key);
  }

  async write(key: string, value: any, conditions: StateCondition[] = []): Promise<boolean> {
    console.log(`✍️ Writing state for key: ${key}`);
    
    // Check conditions
    if (!(await this.checkConditions(key, conditions))) {
      console.warn(`⚠️ Write conditions not met for key: ${key}`);
      return false;
    }

    // Increment vector clock
    this.vectorClock[this.config.nodeId]++;
    
    const entry: StateEntry = {
      key,
      value,
      version: this.vectorClock[this.config.nodeId],
      timestamp: Date.now(),
      nodeId: this.config.nodeId,
      vectorClock: { ...this.vectorClock },
      isDeleted: false,
      metadata: {
        lastModified: new Date().toISOString(),
        modifiedBy: this.config.nodeId,
      },
    };

    // Store locally
    this.localState.set(key, entry);
    
    // Queue for replication
    const operation: StateOperation = {
      operationType: 'write',
      key,
      value,
      timestamp: entry.timestamp,
      nodeId: this.config.nodeId,
    };
    
    this.syncQueue.push(operation);
    
    // Replicate to other nodes
    await this.replicationManager.replicate(entry);
    
    // Log the operation
    await this.auditLogger.logOperation(operation);
    
    return true;
  }

  async delete(key: string): Promise<boolean> {
    console.log(`🗑️ Deleting state for key: ${key}`);
    
    const existingEntry = this.localState.get(key);
    if (!existingEntry) {
      return false;
    }

    // Create tombstone
    this.vectorClock[this.config.nodeId]++;
    
    const tombstone: StateEntry = {
      ...existingEntry,
      isDeleted: true,
      version: this.vectorClock[this.config.nodeId],
      timestamp: Date.now(),
      vectorClock: { ...this.vectorClock },
      metadata: {
        ...existingEntry.metadata,
        deletedAt: new Date().toISOString(),
        deletedBy: this.config.nodeId,
      },
    };

    this.localState.set(key, tombstone);

    const operation: StateOperation = {
      operationType: 'delete',
      key,
      timestamp: tombstone.timestamp,
      nodeId: this.config.nodeId,
    };

    this.syncQueue.push(operation);
    await this.replicationManager.replicate(tombstone);
    await this.auditLogger.logOperation(operation);

    return true;
  }

  async merge(entries: StateEntry[]): Promise<void> {
    console.log(`🔄 Merging ${entries.length} state entries`);
    
    for (const entry of entries) {
      await this.mergeEntry(entry);
    }
  }

  getPartition(key: string): StatePartition {
    const hash = this.hashKey(key);
    const partitionId = (hash % this.config.partitionCount).toString();
    
    return this.partitions.get(partitionId) || this.createPartition(partitionId, key);
  }

  private async mergeEntry(entry: StateEntry): Promise<void> {
    const existingEntry = this.localState.get(entry.key);
    
    if (!existingEntry) {
      // No conflict, just add
      this.localState.set(entry.key, entry);
      this.updateVectorClock(entry.vectorClock);
      return;
    }

    // Resolve conflict
    const resolvedEntry = await this.conflictResolver.resolve(existingEntry, entry);
    this.localState.set(entry.key, resolvedEntry);
    this.updateVectorClock(entry.vectorClock);
  }

  private async checkConditions(key: string, conditions: StateCondition[]): Promise<boolean> {
    if (conditions.length === 0) return true;
    
    const existingEntry = this.localState.get(key);
    
    for (const condition of conditions) {
      switch (condition.type) {
        case 'version_equals':
          if (!existingEntry || existingEntry.version !== condition.expectedVersion) {
            return false;
          }
          break;
        case 'version_greater':
          if (!existingEntry || existingEntry.version <= condition.expectedVersion!) {
            return false;
          }
          break;
        case 'exists':
          if (!existingEntry || existingEntry.isDeleted) {
            return false;
          }
          break;
        case 'not_exists':
          if (existingEntry && !existingEntry.isDeleted) {
            return false;
          }
          break;
      }
    }
    
    return true;
  }

  private isFreshEnough(entry: StateEntry): boolean {
    if (this.config.consistencyLevel === 'eventual') {
      return true;
    }
    
    if (this.config.consistencyLevel === 'bounded_staleness') {
      const staleness = Date.now() - entry.timestamp;
      return staleness <= this.config.stalenessBoundMs;
    }
    
    return false; // Strong consistency requires fresh reads
  }

  private async readFromReplicas(key: string): Promise<StateEntry | null> {
    const partition = this.getPartition(key);
    
    // Try to read from replicas
    for (const replicaId of partition.replicas) {
      if (replicaId !== this.config.nodeId) {
        try {
          const entry = await this.readFromReplica(replicaId, key);
          if (entry) {
            // Cache locally
            this.localState.set(key, entry);
            return entry;
          }
        } catch (error) {
          console.warn(`⚠️ Failed to read from replica ${replicaId}:`, error);
        }
      }
    }
    
    return null;
  }

  private async readFromReplica(replicaId: string, key: string): Promise<StateEntry | null> {
    // Simulate network call to replica
    console.log(`📡 Reading ${key} from replica ${replicaId}`);
    return null; // Simulated
  }

  private async updateAccessMetadata(entry: StateEntry): Promise<void> {
    entry.metadata.lastAccessed = new Date().toISOString();
    entry.metadata.accessCount = (entry.metadata.accessCount || 0) + 1;
  }

  private updateVectorClock(otherClock: VectorClock): void {
    for (const [nodeId, timestamp] of Object.entries(otherClock)) {
      this.vectorClock[nodeId] = Math.max(this.vectorClock[nodeId] || 0, timestamp);
    }
  }

  private hashKey(key: string): number {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private createPartition(partitionId: string, key: string): StatePartition {
    const partition: StatePartition = {
      id: partitionId,
      range: { start: key, end: key },
      primary: this.config.nodeId,
      replicas: [this.config.nodeId],
      size: 0,
      lastCompacted: new Date(),
    };
    
    this.partitions.set(partitionId, partition);
    return partition;
  }

  private startSynchronization(): void {
    setInterval(async () => {
      await this.processSyncQueue();
    }, 1000); // Process every second
  }

  private async processSyncQueue(): Promise<void> {
    if (this.syncQueue.length === 0) return;
    
    const batch = this.syncQueue.splice(0, 100); // Process 100 operations at a time
    console.log(`🔄 Processing ${batch.length} sync operations`);
    
    // Group by target nodes
    const nodeOperations = new Map<string, StateOperation[]>();
    
    batch.forEach(operation => {
      const partition = this.getPartition(operation.key);
      partition.replicas.forEach(replicaId => {
        if (replicaId !== this.config.nodeId) {
          if (!nodeOperations.has(replicaId)) {
            nodeOperations.set(replicaId, []);
          }
          nodeOperations.get(replicaId)!.push(operation);
        }
      });
    });
    
    // Send operations to replicas
    const promises = Array.from(nodeOperations.entries()).map(async ([nodeId, operations]) => {
      try {
        await this.sendOperationsToNode(nodeId, operations);
      } catch (error) {
        console.error(`❌ Failed to sync to ${nodeId}:`, error);
        // Re-queue operations for retry
        this.syncQueue.push(...operations);
      }
    });
    
    await Promise.allSettled(promises);
  }

  private async sendOperationsToNode(nodeId: string, operations: StateOperation[]): Promise<void> {
    console.log(`📤 Sending ${operations.length} operations to ${nodeId}`);
    // Simulate network call
  }

  private startConflictResolution(): void {
    setInterval(async () => {
      await this.resolveConflicts();
    }, 5000); // Check for conflicts every 5 seconds
  }

  private async resolveConflicts(): Promise<void> {
    // Implementation would detect and resolve state conflicts
    console.log('🔍 Checking for state conflicts');
  }
}

export class ConflictResolver {
  private strategy: string;

  constructor(strategy: string) {
    this.strategy = strategy;
  }

  async resolve(entry1: StateEntry, entry2: StateEntry): Promise<StateEntry> {
    console.log(`🔧 Resolving conflict for key: ${entry1.key}`);
    
    switch (this.strategy) {
      case 'last_write_wins':
        return this.lastWriteWins(entry1, entry2);
      case 'vector_clocks':
        return this.vectorClockResolution(entry1, entry2);
      case 'custom':
        return this.customResolution(entry1, entry2);
      default:
        return this.lastWriteWins(entry1, entry2);
    }
  }

  private lastWriteWins(entry1: StateEntry, entry2: StateEntry): StateEntry {
    return entry1.timestamp > entry2.timestamp ? entry1 : entry2;
  }

  private vectorClockResolution(entry1: StateEntry, entry2: StateEntry): StateEntry {
    const comparison = this.compareVectorClocks(entry1.vectorClock, entry2.vectorClock);
    
    if (comparison > 0) return entry1;
    if (comparison < 0) return entry2;
    
    // Concurrent updates - fall back to timestamp
    return this.lastWriteWins(entry1, entry2);
  }

  private customResolution(entry1: StateEntry, entry2: StateEntry): StateEntry {
    // Healthcare-specific conflict resolution
    
    // Prefer entries with more complete medical data
    const score1 = this.calculateMedicalDataScore(entry1.value);
    const score2 = this.calculateMedicalDataScore(entry2.value);
    
    if (score1 !== score2) {
      return score1 > score2 ? entry1 : entry2;
    }
    
    // Fall back to last write wins
    return this.lastWriteWins(entry1, entry2);
  }

  private compareVectorClocks(clock1: VectorClock, clock2: VectorClock): number {
    const allNodes = new Set([...Object.keys(clock1), ...Object.keys(clock2)]);
    let clock1Greater = false;
    let clock2Greater = false;
    
    for (const node of allNodes) {
      const value1 = clock1[node] || 0;
      const value2 = clock2[node] || 0;
      
      if (value1 > value2) clock1Greater = true;
      if (value2 > value1) clock2Greater = true;
    }
    
    if (clock1Greater && !clock2Greater) return 1;
    if (clock2Greater && !clock1Greater) return -1;
    return 0; // Concurrent
  }

  private calculateMedicalDataScore(data: any): number {
    if (!data || typeof data !== 'object') return 0;
    
    let score = 0;
    if (data.patientId) score += 10;
    if (data.diagnosis) score += 20;
    if (data.medications) score += Array.isArray(data.medications) ? data.medications.length * 5 : 5;
    if (data.vitalSigns) score += 15;
    if (data.treatmentPlan) score += 10;
    
    return score;
  }
}

export class StateAuditLogger {
  private enabled: boolean;
  private auditLog: StateAuditEntry[] = [];

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  async logOperation(operation: StateOperation): Promise<void> {
    if (!this.enabled) return;
    
    const auditEntry: StateAuditEntry = {
      timestamp: new Date().toISOString(),
      operation: operation.operationType,
      key: operation.key,
      nodeId: operation.nodeId,
      transactionId: operation.transactionId,
      metadata: {
        userAgent: 'distributed-state-manager',
        ipAddress: '127.0.0.1',
      },
    };
    
    this.auditLog.push(auditEntry);
    console.log(`📝 Audit: ${auditEntry.operation} ${auditEntry.key} by ${auditEntry.nodeId}`);
    
    // In production, would persist to durable storage
    if (this.auditLog.length > 10000) {
      await this.flushAuditLog();
    }
  }

  async getAuditLog(key?: string, since?: Date): Promise<StateAuditEntry[]> {
    let filtered = this.auditLog;
    
    if (key) {
      filtered = filtered.filter(entry => entry.key === key);
    }
    
    if (since) {
      filtered = filtered.filter(entry => new Date(entry.timestamp) >= since);
    }
    
    return filtered;
  }

  private async flushAuditLog(): Promise<void> {
    console.log(`💾 Flushing ${this.auditLog.length} audit log entries`);
    // In production, would write to persistent storage
    this.auditLog = this.auditLog.slice(-1000); // Keep last 1000 entries
  }
}

interface StateAuditEntry {
  timestamp: string;
  operation: string;
  key: string;
  nodeId: string;
  transactionId?: string;
  metadata: Record<string, any>;
}

export class StateReplicationManager {
  private replicationFactor: number;
  private replicationQueue: StateEntry[] = [];

  constructor(replicationFactor: number) {
    this.replicationFactor = replicationFactor;
    this.startReplicationWorker();
  }

  async replicate(entry: StateEntry): Promise<void> {
    this.replicationQueue.push(entry);
  }

  private startReplicationWorker(): void {
    setInterval(async () => {
      await this.processReplicationQueue();
    }, 500); // Process every 500ms
  }

  private async processReplicationQueue(): Promise<void> {
    if (this.replicationQueue.length === 0) return;
    
    const batch = this.replicationQueue.splice(0, 50); // Process 50 entries at a time
    console.log(`🔄 Replicating ${batch.length} state entries`);
    
    const promises = batch.map(entry => this.replicateEntry(entry));
    await Promise.allSettled(promises);
  }

  private async replicateEntry(entry: StateEntry): Promise<void> {
    // In production, would send to actual replica nodes
    console.log(`📤 Replicating ${entry.key} to replicas`);
  }
}

export class HealthcareStateManager extends EventualConsistentStateManager {
  private patientDataCache: Map<string, any> = new Map();
  private claimStatusCache: Map<string, any> = new Map();

  constructor(config: StateManagerConfig) {
    super(config);
    this.setupHealthcareSpecificHandlers();
  }

  async updatePatientRecord(patientId: string, recordData: any): Promise<boolean> {
    console.log(`🏥 Updating patient record: ${patientId}`);
    
    const conditions: StateCondition[] = [
      { type: 'exists' } // Patient must exist to update
    ];
    
    const success = await this.write(`patient:${patientId}`, recordData, conditions);
    
    if (success) {
      this.patientDataCache.set(patientId, recordData);
      await this.notifyPatientRecordUpdate(patientId, recordData);
    }
    
    return success;
  }

  async updateClaimStatus(claimId: string, status: string, metadata: any = {}): Promise<boolean> {
    console.log(`📋 Updating claim status: ${claimId} -> ${status}`);
    
    const claimData = {
      status,
      lastUpdated: new Date().toISOString(),
      updatedBy: this.config.nodeId,
      ...metadata,
    };
    
    const success = await this.write(`claim:${claimId}`, claimData);
    
    if (success) {
      this.claimStatusCache.set(claimId, claimData);
      await this.notifyClaimStatusChange(claimId, status, metadata);
    }
    
    return success;
  }

  async getPatientRecord(patientId: string): Promise<any> {
    // Check cache first
    const cached = this.patientDataCache.get(patientId);
    if (cached) {
      return cached;
    }
    
    const entry = await this.read(`patient:${patientId}`);
    if (entry && !entry.isDeleted) {
      this.patientDataCache.set(patientId, entry.value);
      return entry.value;
    }
    
    return null;
  }

  async getClaimStatus(claimId: string): Promise<any> {
    // Check cache first
    const cached = this.claimStatusCache.get(claimId);
    if (cached) {
      return cached;
    }
    
    const entry = await this.read(`claim:${claimId}`);
    if (entry && !entry.isDeleted) {
      this.claimStatusCache.set(claimId, entry.value);
      return entry.value;
    }
    
    return null;
  }

  private setupHealthcareSpecificHandlers(): void {
    // Setup periodic cache cleanup
    setInterval(() => {
      this.cleanupCaches();
    }, 300000); // Every 5 minutes
  }

  private cleanupCaches(): void {
    const maxCacheSize = 1000;
    
    if (this.patientDataCache.size > maxCacheSize) {
      const entries = Array.from(this.patientDataCache.entries());
      entries.splice(0, entries.length - maxCacheSize);
      this.patientDataCache = new Map(entries);
    }
    
    if (this.claimStatusCache.size > maxCacheSize) {
      const entries = Array.from(this.claimStatusCache.entries());
      entries.splice(0, entries.length - maxCacheSize);
      this.claimStatusCache = new Map(entries);
    }
  }

  private async notifyPatientRecordUpdate(patientId: string, recordData: any): Promise<void> {
    console.log(`📢 Notifying patient record update: ${patientId}`);
    // In production, would send notifications to relevant services
  }

  private async notifyClaimStatusChange(claimId: string, status: string, metadata: any): Promise<void> {
    console.log(`📢 Notifying claim status change: ${claimId} -> ${status}`);
    // In production, would send notifications to relevant services
  }

  async getHealthcareMetrics(): Promise<HealthcareStateMetrics> {
    const totalEntries = this.localState.size;
    const patientRecords = Array.from(this.localState.keys()).filter(key => key.startsWith('patient:')).length;
    const claimRecords = Array.from(this.localState.keys()).filter(key => key.startsWith('claim:')).length;
    
    return {
      totalStateEntries: totalEntries,
      patientRecords,
      claimRecords,
      cacheHitRate: this.calculateCacheHitRate(),
      averageConflictResolutionTime: 0, // Would calculate from metrics
      replicationLag: 0, // Would calculate from replication metrics
    };
  }

  private calculateCacheHitRate(): number {
    // Simplified cache hit rate calculation
    const totalCacheSize = this.patientDataCache.size + this.claimStatusCache.size;
    return totalCacheSize > 0 ? 0.85 : 0; // 85% hit rate simulation
  }
}

interface HealthcareStateMetrics {
  totalStateEntries: number;
  patientRecords: number;
  claimRecords: number;
  cacheHitRate: number;
  averageConflictResolutionTime: number;
  replicationLag: number;
}

export class StateManagerFactory {
  static create(config: StateManagerConfig): DistributedStateManager {
    switch (config.consistencyLevel) {
      case 'eventual':
        return new EventualConsistentStateManager(config);
      case 'strong':
        // Would implement StrongConsistentStateManager
        throw new Error('Strong consistency not implemented yet');
      case 'bounded_staleness':
        // Would implement BoundedStalenessStateManager
        throw new Error('Bounded staleness not implemented yet');
      default:
        return new EventualConsistentStateManager(config);
    }
  }

  static createHealthcareManager(config: StateManagerConfig): HealthcareStateManager {
    return new HealthcareStateManager(config);
  }
}
