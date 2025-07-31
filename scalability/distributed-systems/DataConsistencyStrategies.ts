/**
 * Data Consistency Strategies Implementation
 * Healthcare Claims Processing System - Distributed Systems
 */

export interface ConsistencyConfig {
  strategy: 'strong' | 'eventual' | 'causal' | 'session' | 'bounded_staleness';
  replicationFactor: number;
  readQuorum: number;
  writeQuorum: number;
  maxStalenessMs: number;
  conflictResolution: 'last_write_wins' | 'vector_clocks' | 'application_defined';
}

export interface DataRecord {
  id: string;
  data: any;
  version: number;
  timestamp: number;
  vectorClock?: VectorClock;
  checksum: string;
  nodeId: string;
}

export interface VectorClock {
  [nodeId: string]: number;
}

export interface ConsistencyOperation {
  type: 'read' | 'write' | 'delete';
  recordId: string;
  data?: any;
  version?: number;
  vectorClock?: VectorClock;
  timestamp: number;
  requiredNodes: string[];
}

export abstract class ConsistencyStrategy {
  protected config: ConsistencyConfig;
  protected nodes: Map<string, any> = new Map();
  protected localData: Map<string, DataRecord> = new Map();

  constructor(config: ConsistencyConfig) {
    this.config = config;
  }

  abstract read(recordId: string): Promise<DataRecord | null>;
  abstract write(recordId: string, data: any): Promise<boolean>;
  abstract delete(recordId: string): Promise<boolean>;
  abstract resolveConflicts(records: DataRecord[]): DataRecord;
}

export class StrongConsistency extends ConsistencyStrategy {
  async read(recordId: string): Promise<DataRecord | null> {
    console.log(`🔍 Strong consistency read for ${recordId}`);
    
    const nodeList = Array.from(this.nodes.keys());
    const requiredResponses = this.config.readQuorum;
    
    if (requiredResponses > nodeList.length) {
      throw new Error('Not enough nodes available for read quorum');
    }

    const readPromises = nodeList.slice(0, requiredResponses).map(async (nodeId) => {
      return this.readFromNode(nodeId, recordId);
    });

    const responses = await Promise.all(readPromises);
    const validResponses = responses.filter(r => r !== null);

    if (validResponses.length < requiredResponses) {
      throw new Error('Failed to achieve read quorum');
    }

    // All responses should be identical in strong consistency
    const firstRecord = validResponses[0];
    const isConsistent = validResponses.every(record => 
      record.version === firstRecord.version && 
      record.checksum === firstRecord.checksum
    );

    if (!isConsistent) {
      console.warn('⚠️ Inconsistency detected, triggering repair');
      await this.repairInconsistency(recordId, validResponses);
    }

    return firstRecord;
  }

  async write(recordId: string, data: any): Promise<boolean> {
    console.log(`✍️ Strong consistency write for ${recordId}`);
    
    const nodeList = Array.from(this.nodes.keys());
    const requiredResponses = this.config.writeQuorum;
    
    if (requiredResponses > nodeList.length) {
      throw new Error('Not enough nodes available for write quorum');
    }

    // Read current version first
    const currentRecord = await this.readFromNode(nodeList[0], recordId);
    const newVersion = (currentRecord?.version || 0) + 1;

    const record: DataRecord = {
      id: recordId,
      data,
      version: newVersion,
      timestamp: Date.now(),
      checksum: this.calculateChecksum(data),
      nodeId: 'coordinator',
    };

    const writePromises = nodeList.slice(0, requiredResponses).map(async (nodeId) => {
      return this.writeToNode(nodeId, record);
    });

    const results = await Promise.all(writePromises);
    const successCount = results.filter(r => r).length;

    return successCount >= requiredResponses;
  }

  async delete(recordId: string): Promise<boolean> {
    console.log(`🗑️ Strong consistency delete for ${recordId}`);
    
    const nodeList = Array.from(this.nodes.keys());
    const requiredResponses = this.config.writeQuorum;

    const deletePromises = nodeList.slice(0, requiredResponses).map(async (nodeId) => {
      return this.deleteFromNode(nodeId, recordId);
    });

    const results = await Promise.all(deletePromises);
    const successCount = results.filter(r => r).length;

    return successCount >= requiredResponses;
  }

  resolveConflicts(records: DataRecord[]): DataRecord {
    // In strong consistency, conflicts should not occur
    return records.reduce((latest, current) => 
      current.version > latest.version ? current : latest
    );
  }

  private async readFromNode(nodeId: string, recordId: string): Promise<DataRecord | null> {
    // Simulate reading from node
    const record = this.localData.get(recordId);
    return record || null;
  }

  private async writeToNode(nodeId: string, record: DataRecord): Promise<boolean> {
    // Simulate writing to node
    this.localData.set(record.id, record);
    return true;
  }

  private async deleteFromNode(nodeId: string, recordId: string): Promise<boolean> {
    // Simulate deleting from node
    return this.localData.delete(recordId);
  }

  private async repairInconsistency(recordId: string, records: DataRecord[]): Promise<void> {
    const resolvedRecord = this.resolveConflicts(records);
    
    // Write the resolved record to all nodes
    const nodeList = Array.from(this.nodes.keys());
    const repairPromises = nodeList.map(nodeId => 
      this.writeToNode(nodeId, resolvedRecord)
    );

    await Promise.allSettled(repairPromises);
    console.log(`🔧 Repaired inconsistency for ${recordId}`);
  }

  private calculateChecksum(data: any): string {
    return require('crypto').createHash('md5').update(JSON.stringify(data)).digest('hex');
  }
}

export class EventualConsistency extends ConsistencyStrategy {
  private propagationQueue: ConsistencyOperation[] = [];
  private conflictBuffer: Map<string, DataRecord[]> = new Map();

  constructor(config: ConsistencyConfig) {
    super(config);
    this.startPropagationWorker();
    this.startConflictResolution();
  }

  async read(recordId: string): Promise<DataRecord | null> {
    console.log(`📖 Eventual consistency read for ${recordId}`);
    
    // Read from local node first (fastest)
    const localRecord = this.localData.get(recordId);
    if (localRecord && this.isFreshEnough(localRecord)) {
      return localRecord;
    }

    // If local data is stale or missing, try other nodes
    return this.readFromAnyAvailableNode(recordId);
  }

  async write(recordId: string, data: any): Promise<boolean> {
    console.log(`✏️ Eventual consistency write for ${recordId}`);
    
    const record: DataRecord = {
      id: recordId,
      data,
      version: Date.now(), // Use timestamp as version for eventual consistency
      timestamp: Date.now(),
      vectorClock: this.incrementVectorClock(recordId),
      checksum: this.calculateChecksum(data),
      nodeId: 'local',
    };

    // Write locally immediately
    this.localData.set(recordId, record);

    // Queue for propagation to other nodes
    const operation: ConsistencyOperation = {
      type: 'write',
      recordId,
      data,
      version: record.version,
      vectorClock: record.vectorClock,
      timestamp: record.timestamp,
      requiredNodes: Array.from(this.nodes.keys()),
    };

    this.propagationQueue.push(operation);
    return true; // Return immediately (eventual consistency)
  }

  async delete(recordId: string): Promise<boolean> {
    console.log(`🗑️ Eventual consistency delete for ${recordId}`);
    
    // Delete locally
    const deleted = this.localData.delete(recordId);

    // Queue for propagation
    const operation: ConsistencyOperation = {
      type: 'delete',
      recordId,
      timestamp: Date.now(),
      requiredNodes: Array.from(this.nodes.keys()),
    };

    this.propagationQueue.push(operation);
    return deleted;
  }

  resolveConflicts(records: DataRecord[]): DataRecord {
    switch (this.config.conflictResolution) {
      case 'last_write_wins':
        return this.lastWriteWins(records);
      case 'vector_clocks':
        return this.vectorClockResolution(records);
      case 'application_defined':
        return this.applicationDefinedResolution(records);
      default:
        return this.lastWriteWins(records);
    }
  }

  private isFreshEnough(record: DataRecord): boolean {
    const staleness = Date.now() - record.timestamp;
    return staleness <= this.config.maxStalenessMs;
  }

  private async readFromAnyAvailableNode(recordId: string): Promise<DataRecord | null> {
    const nodeList = Array.from(this.nodes.keys());
    
    for (const nodeId of nodeList) {
      try {
        const record = await this.readFromNode(nodeId, recordId);
        if (record) {
          // Cache locally for future reads
          this.localData.set(recordId, record);
          return record;
        }
      } catch (error) {
        console.warn(`⚠️ Failed to read from node ${nodeId}:`, error);
      }
    }
    
    return null;
  }

  private incrementVectorClock(recordId: string): VectorClock {
    const currentRecord = this.localData.get(recordId);
    const vectorClock = currentRecord?.vectorClock || {};
    
    vectorClock['local'] = (vectorClock['local'] || 0) + 1;
    return vectorClock;
  }

  private startPropagationWorker(): void {
    setInterval(async () => {
      await this.processPropagationQueue();
    }, 1000); // Process every second
  }

  private async processPropagationQueue(): Promise<void> {
    const batchSize = 10;
    const batch = this.propagationQueue.splice(0, batchSize);
    
    if (batch.length === 0) return;

    console.log(`🔄 Processing ${batch.length} propagation operations`);

    const promises = batch.map(operation => this.propagateOperation(operation));
    await Promise.allSettled(promises);
  }

  private async propagateOperation(operation: ConsistencyOperation): Promise<void> {
    const promises = operation.requiredNodes.map(async (nodeId) => {
      try {
        switch (operation.type) {
          case 'write':
            const record: DataRecord = {
              id: operation.recordId,
              data: operation.data,
              version: operation.version!,
              timestamp: operation.timestamp,
              vectorClock: operation.vectorClock,
              checksum: this.calculateChecksum(operation.data),
              nodeId: 'propagated',
            };
            await this.writeToNode(nodeId, record);
            break;
          case 'delete':
            await this.deleteFromNode(nodeId, operation.recordId);
            break;
        }
      } catch (error) {
        console.error(`❌ Failed to propagate to ${nodeId}:`, error);
        // Could implement retry logic
      }
    });

    await Promise.allSettled(promises);
  }

  private startConflictResolution(): void {
    setInterval(async () => {
      await this.processConflicts();
    }, 5000); // Process conflicts every 5 seconds
  }

  private async processConflicts(): Promise<void> {
    for (const [recordId, conflictingRecords] of this.conflictBuffer.entries()) {
      try {
        const resolvedRecord = this.resolveConflicts(conflictingRecords);
        this.localData.set(recordId, resolvedRecord);
        
        // Propagate resolution
        const operation: ConsistencyOperation = {
          type: 'write',
          recordId,
          data: resolvedRecord.data,
          version: resolvedRecord.version,
          vectorClock: resolvedRecord.vectorClock,
          timestamp: Date.now(),
          requiredNodes: Array.from(this.nodes.keys()),
        };
        
        await this.propagateOperation(operation);
        this.conflictBuffer.delete(recordId);
        
        console.log(`🔧 Resolved conflict for ${recordId}`);
      } catch (error) {
        console.error(`❌ Failed to resolve conflict for ${recordId}:`, error);
      }
    }
  }

  private lastWriteWins(records: DataRecord[]): DataRecord {
    return records.reduce((latest, current) => 
      current.timestamp > latest.timestamp ? current : latest
    );
  }

  private vectorClockResolution(records: DataRecord[]): DataRecord {
    // Find the record with the most recent vector clock
    let winner = records[0];
    
    for (let i = 1; i < records.length; i++) {
      const current = records[i];
      if (this.compareVectorClocks(current.vectorClock!, winner.vectorClock!) > 0) {
        winner = current;
      }
    }
    
    return winner;
  }

  private compareVectorClocks(a: VectorClock, b: VectorClock): number {
    const allNodes = new Set([...Object.keys(a), ...Object.keys(b)]);
    let aGreater = false;
    let bGreater = false;
    
    for (const node of allNodes) {
      const aValue = a[node] || 0;
      const bValue = b[node] || 0;
      
      if (aValue > bValue) aGreater = true;
      if (bValue > aValue) bGreater = true;
    }
    
    if (aGreater && !bGreater) return 1;
    if (bGreater && !aGreater) return -1;
    return 0; // Concurrent
  }

  private applicationDefinedResolution(records: DataRecord[]): DataRecord {
    // Healthcare-specific conflict resolution
    // Prefer records with more recent medical data
    return records.reduce((preferred, current) => {
      const preferredData = preferred.data;
      const currentData = current.data;
      
      // Prefer records with more complete medical information
      if (this.getMedicalDataScore(currentData) > this.getMedicalDataScore(preferredData)) {
        return current;
      }
      
      return preferred;
    });
  }

  private getMedicalDataScore(data: any): number {
    let score = 0;
    
    if (data.patientId) score += 10;
    if (data.diagnosis) score += 20;
    if (data.treatmentPlan) score += 15;
    if (data.medications) score += Array.isArray(data.medications) ? data.medications.length * 5 : 5;
    if (data.vitalSigns) score += 10;
    
    return score;
  }

  private async readFromNode(nodeId: string, recordId: string): Promise<DataRecord | null> {
    // Simulate reading from node
    return this.localData.get(recordId) || null;
  }

  private async writeToNode(nodeId: string, record: DataRecord): Promise<boolean> {
    // Simulate writing to node
    this.localData.set(record.id, record);
    return true;
  }

  private async deleteFromNode(nodeId: string, recordId: string): Promise<boolean> {
    // Simulate deleting from node
    return this.localData.delete(recordId);
  }

  private calculateChecksum(data: any): string {
    return require('crypto').createHash('md5').update(JSON.stringify(data)).digest('hex');
  }
}

export class CausalConsistency extends ConsistencyStrategy {
  private dependencyGraph: Map<string, Set<string>> = new Map();
  private causalOrder: string[] = [];

  async read(recordId: string): Promise<DataRecord | null> {
    console.log(`🔗 Causal consistency read for ${recordId}`);
    
    // Ensure all causally dependent operations are applied first
    await this.ensureCausalOrder(recordId);
    
    return this.localData.get(recordId) || null;
  }

  async write(recordId: string, data: any): Promise<boolean> {
    console.log(`🔗 Causal consistency write for ${recordId}`);
    
    const dependencies = this.calculateDependencies(recordId, data);
    
    const record: DataRecord = {
      id: recordId,
      data: { ...data, dependencies },
      version: Date.now(),
      timestamp: Date.now(),
      vectorClock: this.incrementVectorClock(recordId),
      checksum: this.calculateChecksum(data),
      nodeId: 'local',
    };

    this.localData.set(recordId, record);
    this.updateDependencyGraph(recordId, dependencies);
    this.causalOrder.push(recordId);

    return true;
  }

  async delete(recordId: string): Promise<boolean> {
    const deleted = this.localData.delete(recordId);
    this.dependencyGraph.delete(recordId);
    
    // Remove from causal order
    const index = this.causalOrder.indexOf(recordId);
    if (index > -1) {
      this.causalOrder.splice(index, 1);
    }
    
    return deleted;
  }

  resolveConflicts(records: DataRecord[]): DataRecord {
    // Use causal ordering to resolve conflicts
    return records.reduce((preferred, current) => {
      const preferredOrder = this.causalOrder.indexOf(preferred.id);
      const currentOrder = this.causalOrder.indexOf(current.id);
      
      return currentOrder > preferredOrder ? current : preferred;
    });
  }

  private async ensureCausalOrder(recordId: string): Promise<void> {
    const dependencies = this.dependencyGraph.get(recordId);
    
    if (dependencies) {
      for (const dependency of dependencies) {
        const dependentRecord = this.localData.get(dependency);
        if (!dependentRecord) {
          // Fetch missing dependency
          await this.fetchDependency(dependency);
        }
      }
    }
  }

  private calculateDependencies(recordId: string, data: any): string[] {
    const dependencies: string[] = [];
    
    // Healthcare-specific dependency detection
    if (data.patientId) {
      // Depends on patient record
      dependencies.push(`patient:${data.patientId}`);
    }
    
    if (data.previousClaimId) {
      // Depends on previous claim
      dependencies.push(`claim:${data.previousClaimId}`);
    }
    
    if (data.policyId) {
      // Depends on policy record
      dependencies.push(`policy:${data.policyId}`);
    }
    
    return dependencies;
  }

  private updateDependencyGraph(recordId: string, dependencies: string[]): void {
    this.dependencyGraph.set(recordId, new Set(dependencies));
  }

  private async fetchDependency(dependencyId: string): Promise<void> {
    // Simulate fetching missing dependency from other nodes
    console.log(`🔍 Fetching dependency ${dependencyId}`);
  }

  private incrementVectorClock(recordId: string): VectorClock {
    const vectorClock: VectorClock = { local: Date.now() };
    return vectorClock;
  }

  private calculateChecksum(data: any): string {
    return require('crypto').createHash('md5').update(JSON.stringify(data)).digest('hex');
  }
}

export class ConsistencyManager {
  private strategy: ConsistencyStrategy;
  private metricsCollector: ConsistencyMetricsCollector;

  constructor(config: ConsistencyConfig) {
    this.strategy = this.createStrategy(config);
    this.metricsCollector = new ConsistencyMetricsCollector();
  }

  private createStrategy(config: ConsistencyConfig): ConsistencyStrategy {
    switch (config.strategy) {
      case 'strong':
        return new StrongConsistency(config);
      case 'eventual':
        return new EventualConsistency(config);
      case 'causal':
        return new CausalConsistency(config);
      default:
        throw new Error(`Unsupported consistency strategy: ${config.strategy}`);
    }
  }

  async read(recordId: string): Promise<DataRecord | null> {
    const startTime = Date.now();
    try {
      const result = await this.strategy.read(recordId);
      this.metricsCollector.recordOperation('read', Date.now() - startTime, true);
      return result;
    } catch (error) {
      this.metricsCollector.recordOperation('read', Date.now() - startTime, false);
      throw error;
    }
  }

  async write(recordId: string, data: any): Promise<boolean> {
    const startTime = Date.now();
    try {
      const result = await this.strategy.write(recordId, data);
      this.metricsCollector.recordOperation('write', Date.now() - startTime, result);
      return result;
    } catch (error) {
      this.metricsCollector.recordOperation('write', Date.now() - startTime, false);
      throw error;
    }
  }

  async delete(recordId: string): Promise<boolean> {
    const startTime = Date.now();
    try {
      const result = await this.strategy.delete(recordId);
      this.metricsCollector.recordOperation('delete', Date.now() - startTime, result);
      return result;
    } catch (error) {
      this.metricsCollector.recordOperation('delete', Date.now() - startTime, false);
      throw error;
    }
  }

  getMetrics(): any {
    return this.metricsCollector.getMetrics();
  }
}

export class ConsistencyMetricsCollector {
  private metrics = {
    operations: {
      read: { count: 0, totalTime: 0, errors: 0 },
      write: { count: 0, totalTime: 0, errors: 0 },
      delete: { count: 0, totalTime: 0, errors: 0 },
    },
    conflicts: { detected: 0, resolved: 0 },
    staleness: { average: 0, max: 0 },
  };

  recordOperation(operation: string, duration: number, success: boolean): void {
    const opMetrics = this.metrics.operations[operation as keyof typeof this.metrics.operations];
    
    if (opMetrics) {
      opMetrics.count++;
      opMetrics.totalTime += duration;
      
      if (!success) {
        opMetrics.errors++;
      }
    }
  }

  recordConflict(resolved: boolean): void {
    this.metrics.conflicts.detected++;
    if (resolved) {
      this.metrics.conflicts.resolved++;
    }
  }

  recordStaleness(stalenessMs: number): void {
    this.metrics.staleness.max = Math.max(this.metrics.staleness.max, stalenessMs);
    // Calculate running average (simplified)
    this.metrics.staleness.average = (this.metrics.staleness.average + stalenessMs) / 2;
  }

  getMetrics(): any {
    return { ...this.metrics };
  }
}
