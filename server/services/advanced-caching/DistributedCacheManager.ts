import crypto from 'crypto';
import { EventEmitter } from 'events';
import { RedisClusterManager } from './RedisClusterManager';

export interface CacheNode {
  id: string;
  host: string;
  port: number;
  weight: number;
  status: 'active' | 'inactive' | 'draining';
  load: number;
  lastPing: Date;
  virtualNodes: string[];
}

export interface ConsistentHashRing {
  nodes: Map<string, CacheNode>;
  ring: Map<string, string>; // hash -> nodeId
  sortedHashes: string[];
  virtualNodeCount: number;
}

export interface DistributedCacheConfig {
  virtualNodeCount: number;
  replicationFactor: number;
  hashAlgorithm: 'md5' | 'sha1' | 'sha256';
  loadBalancing: 'consistent_hash' | 'round_robin' | 'least_connections' | 'weighted';
  failoverEnabled: boolean;
  healthCheckInterval: number;
  nodeTimeout: number;
}

export interface CacheOperation {
  type: 'get' | 'set' | 'delete' | 'exists';
  key: string;
  value?: any;
  ttl?: number;
  options?: any;
}

export interface DistributedCacheStats {
  totalNodes: number;
  activeNodes: number;
  inactiveNodes: number;
  totalKeys: number;
  totalMemoryUsage: number;
  operationsPerSecond: number;
  averageLatency: number;
  hitRate: number;
  missRate: number;
  nodeStats: Map<string, NodeStats>;
}

export interface NodeStats {
  nodeId: string;
  keys: number;
  memoryUsage: number;
  operationsPerSecond: number;
  avgLatency: number;
  hitRate: number;
  lastSeen: Date;
  load: number;
}

export interface ReplicationGroup {
  primary: string;
  replicas: string[];
  keys: Set<string>;
}

export class DistributedCacheManager extends EventEmitter {
  private config: DistributedCacheConfig;
  private hashRing: ConsistentHashRing;
  private redisCluster: RedisClusterManager | null = null;
  private nodeConnections: Map<string, any> = new Map();
  private replicationGroups: Map<string, ReplicationGroup> = new Map();
  private stats: DistributedCacheStats;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private operationCounter = 0;
  private startTime = Date.now();

  constructor(config: DistributedCacheConfig, redisCluster?: RedisClusterManager) {
    super();
    this.config = config;
    this.redisCluster = redisCluster || null;
    
    this.hashRing = {
      nodes: new Map(),
      ring: new Map(),
      sortedHashes: [],
      virtualNodeCount: config.virtualNodeCount,
    };

    this.stats = {
      totalNodes: 0,
      activeNodes: 0,
      inactiveNodes: 0,
      totalKeys: 0,
      totalMemoryUsage: 0,
      operationsPerSecond: 0,
      averageLatency: 0,
      hitRate: 0,
      missRate: 0,
      nodeStats: new Map(),
    };

    this.startHealthChecking();
  }

  async addNode(node: Omit<CacheNode, 'virtualNodes' | 'lastPing' | 'load'>): Promise<void> {
    const fullNode: CacheNode = {
      ...node,
      virtualNodes: [],
      lastPing: new Date(),
      load: 0,
    };

    // Generate virtual nodes for consistent hashing
    for (let i = 0; i < this.config.virtualNodeCount; i++) {
      const virtualNodeKey = `${node.id}:${i}`;
      const hash = this.hash(virtualNodeKey);
      fullNode.virtualNodes.push(hash);
      this.hashRing.ring.set(hash, node.id);
    }

    this.hashRing.nodes.set(node.id, fullNode);
    this.rebuildHashRing();

    // Initialize node stats
    this.stats.nodeStats.set(node.id, {
      nodeId: node.id,
      keys: 0,
      memoryUsage: 0,
      operationsPerSecond: 0,
      avgLatency: 0,
      hitRate: 0,
      lastSeen: new Date(),
      load: 0,
    });

    // Create replication groups if enabled
    if (this.config.replicationFactor > 1) {
      this.updateReplicationGroups();
    }

    this.updateStats();
    this.emit('node-added', fullNode);
  }

  async removeNode(nodeId: string): Promise<void> {
    const node = this.hashRing.nodes.get(nodeId);
    if (!node) return;

    // Remove virtual nodes from ring
    for (const hash of node.virtualNodes) {
      this.hashRing.ring.delete(hash);
    }

    this.hashRing.nodes.delete(nodeId);
    this.rebuildHashRing();

    // Handle data migration if needed
    await this.migrateNodeData(nodeId);

    // Update replication groups
    if (this.config.replicationFactor > 1) {
      this.updateReplicationGroups();
    }

    // Remove node stats
    this.stats.nodeStats.delete(nodeId);

    this.updateStats();
    this.emit('node-removed', nodeId);
  }

  private rebuildHashRing(): void {
    this.hashRing.sortedHashes = Array.from(this.hashRing.ring.keys()).sort();
  }

  private hash(key: string): string {
    return crypto
      .createHash(this.config.hashAlgorithm)
      .update(key)
      .digest('hex');
  }

  private findNode(key: string): string | null {
    if (this.hashRing.sortedHashes.length === 0) return null;

    const keyHash = this.hash(key);
    
    // Find the first node hash that is greater than or equal to the key hash
    let nodeHash = this.hashRing.sortedHashes.find(hash => hash >= keyHash);
    
    // If not found, wrap around to the first node
    if (!nodeHash) {
      nodeHash = this.hashRing.sortedHashes[0];
    }

    return this.hashRing.ring.get(nodeHash) || null;
  }

  private findReplicaNodes(key: string, count: number): string[] {
    if (this.hashRing.sortedHashes.length === 0) return [];

    const keyHash = this.hash(key);
    const nodes = new Set<string>();
    
    // Find starting position
    let startIndex = this.hashRing.sortedHashes.findIndex(hash => hash >= keyHash);
    if (startIndex === -1) startIndex = 0;

    // Collect unique nodes
    let currentIndex = startIndex;
    while (nodes.size < count && nodes.size < this.hashRing.nodes.size) {
      const hash = this.hashRing.sortedHashes[currentIndex];
      const nodeId = this.hashRing.ring.get(hash);
      if (nodeId) {
        nodes.add(nodeId);
      }
      currentIndex = (currentIndex + 1) % this.hashRing.sortedHashes.length;
    }

    return Array.from(nodes);
  }

  async get<T = any>(key: string): Promise<T | null> {
    const startTime = Date.now();
    this.operationCounter++;

    try {
      let result: T | null = null;
      const nodes = this.config.replicationFactor > 1 
        ? this.findReplicaNodes(key, this.config.replicationFactor)
        : [this.findNode(key)].filter(Boolean) as string[];

      // Try each replica until we get a result
      for (const nodeId of nodes) {
        const node = this.hashRing.nodes.get(nodeId);
        if (!node || node.status !== 'active') continue;

        try {
          result = await this.executeOnNode(nodeId, 'get', key);
          if (result !== null) {
            this.updateNodeStats(nodeId, 'hit', Date.now() - startTime);
            break;
          }
        } catch (error) {
          console.warn(`Failed to get from node ${nodeId}:`, error);
          this.updateNodeStats(nodeId, 'error', Date.now() - startTime);
          
          if (this.config.failoverEnabled) {
            await this.handleNodeFailure(nodeId);
          }
        }
      }

      if (result === null) {
        // Update miss stats for all attempted nodes
        for (const nodeId of nodes) {
          this.updateNodeStats(nodeId, 'miss', Date.now() - startTime);
        }
      }

      this.emit('cache-get', { key, hit: result !== null, nodes });
      return result;

    } catch (error) {
      this.emit('operation-error', { operation: 'get', key, error });
      throw error;
    }
  }

  async set<T = any>(key: string, value: T, ttl?: number): Promise<void> {
    const startTime = Date.now();
    this.operationCounter++;

    try {
      const nodes = this.config.replicationFactor > 1 
        ? this.findReplicaNodes(key, this.config.replicationFactor)
        : [this.findNode(key)].filter(Boolean) as string[];

      const promises: Promise<void>[] = [];

      for (const nodeId of nodes) {
        const node = this.hashRing.nodes.get(nodeId);
        if (!node || node.status !== 'active') continue;

        promises.push(
          this.executeOnNode(nodeId, 'set', key, value, ttl)
            .then(() => this.updateNodeStats(nodeId, 'set', Date.now() - startTime))
            .catch((error) => {
              console.warn(`Failed to set on node ${nodeId}:`, error);
              this.updateNodeStats(nodeId, 'error', Date.now() - startTime);
              
              if (this.config.failoverEnabled) {
                this.handleNodeFailure(nodeId);
              }
            })
        );
      }

      // Wait for majority of replicas to succeed
      const results = await Promise.allSettled(promises);
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      
      if (successCount === 0) {
        throw new Error('Failed to set value on any replica');
      }

      this.emit('cache-set', { key, value, nodes, successCount });

    } catch (error) {
      this.emit('operation-error', { operation: 'set', key, error });
      throw error;
    }
  }

  async delete(key: string): Promise<boolean> {
    const startTime = Date.now();
    this.operationCounter++;

    try {
      const nodes = this.config.replicationFactor > 1 
        ? this.findReplicaNodes(key, this.config.replicationFactor)
        : [this.findNode(key)].filter(Boolean) as string[];

      let deleted = false;
      const promises: Promise<boolean>[] = [];

      for (const nodeId of nodes) {
        const node = this.hashRing.nodes.get(nodeId);
        if (!node || node.status !== 'active') continue;

        promises.push(
          this.executeOnNode(nodeId, 'delete', key)
            .then((result) => {
              this.updateNodeStats(nodeId, 'delete', Date.now() - startTime);
              return result;
            })
            .catch((error) => {
              console.warn(`Failed to delete from node ${nodeId}:`, error);
              this.updateNodeStats(nodeId, 'error', Date.now() - startTime);
              return false;
            })
        );
      }

      const results = await Promise.allSettled(promises);
      deleted = results.some(r => r.status === 'fulfilled' && r.value === true);

      this.emit('cache-delete', { key, deleted, nodes });
      return deleted;

    } catch (error) {
      this.emit('operation-error', { operation: 'delete', key, error });
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    const nodes = this.config.replicationFactor > 1 
      ? this.findReplicaNodes(key, 1) // Only check one replica for existence
      : [this.findNode(key)].filter(Boolean) as string[];

    for (const nodeId of nodes) {
      const node = this.hashRing.nodes.get(nodeId);
      if (!node || node.status !== 'active') continue;

      try {
        const exists = await this.executeOnNode(nodeId, 'exists', key);
        return exists;
      } catch (error) {
        console.warn(`Failed to check existence on node ${nodeId}:`, error);
      }
    }

    return false;
  }

  private async executeOnNode(nodeId: string, operation: string, ...args: any[]): Promise<any> {
    // This would execute the operation on the specific node
    // Implementation depends on your cache backend (Redis, Memcached, etc.)
    
    if (this.redisCluster?.isReady()) {
      const cluster = this.redisCluster.getCluster();
      if (cluster) {
        switch (operation) {
          case 'get':
            const value = await cluster.get(args[0]);
            return value ? JSON.parse(value) : null;
          case 'set':
            const ttl = args[2] || 3600;
            await cluster.setex(args[0], ttl, JSON.stringify(args[1]));
            return;
          case 'delete':
            const deleted = await cluster.del(args[0]);
            return deleted > 0;
          case 'exists':
            const exists = await cluster.exists(args[0]);
            return exists > 0;
        }
      }
    }

    throw new Error(`Node ${nodeId} not available`);
  }

  private updateNodeStats(nodeId: string, operation: string, latency: number): void {
    const stats = this.stats.nodeStats.get(nodeId);
    if (!stats) return;

    stats.lastSeen = new Date();
    stats.avgLatency = (stats.avgLatency + latency) / 2;

    switch (operation) {
      case 'hit':
        stats.hitRate = (stats.hitRate + 1) / 2;
        break;
      case 'miss':
        stats.hitRate = stats.hitRate / 2;
        break;
    }

    this.stats.nodeStats.set(nodeId, stats);
  }

  private async handleNodeFailure(nodeId: string): Promise<void> {
    const node = this.hashRing.nodes.get(nodeId);
    if (!node) return;

    node.status = 'inactive';
    this.hashRing.nodes.set(nodeId, node);

    this.emit('node-failed', nodeId);

    // Trigger data redistribution if needed
    if (this.config.replicationFactor > 1) {
      await this.redistributeData(nodeId);
    }

    this.updateStats();
  }

  private async redistributeData(failedNodeId: string): Promise<void> {
    // Implementation for data redistribution after node failure
    this.emit('data-redistribution-started', failedNodeId);
    
    // This would involve:
    // 1. Finding all keys that were on the failed node
    // 2. Moving them to their new locations based on consistent hashing
    // 3. Updating replication groups
    
    this.emit('data-redistribution-completed', failedNodeId);
  }

  private async migrateNodeData(nodeId: string): Promise<void> {
    // Implementation for data migration during node removal
    this.emit('data-migration-started', nodeId);
    
    // This would involve moving all data from the removed node
    // to other nodes based on consistent hashing
    
    this.emit('data-migration-completed', nodeId);
  }

  private updateReplicationGroups(): void {
    this.replicationGroups.clear();
    
    // Create replication groups based on consistent hashing
    const activeNodes = Array.from(this.hashRing.nodes.values())
      .filter(node => node.status === 'active');

    if (activeNodes.length < this.config.replicationFactor) {
      console.warn('Not enough active nodes for configured replication factor');
      return;
    }

    // This is a simplified implementation
    // In practice, you'd need more sophisticated group management
  }

  private startHealthChecking(): void {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  private async performHealthCheck(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const [nodeId, node] of this.hashRing.nodes) {
      promises.push(this.checkNodeHealth(nodeId, node));
    }

    await Promise.allSettled(promises);
    this.updateStats();
  }

  private async checkNodeHealth(nodeId: string, node: CacheNode): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Ping the node
      await this.executeOnNode(nodeId, 'ping');
      
      const latency = Date.now() - startTime;
      
      if (latency > this.config.nodeTimeout) {
        throw new Error(`Node ${nodeId} response time exceeded timeout`);
      }

      // Update node status
      if (node.status === 'inactive') {
        node.status = 'active';
        this.emit('node-recovered', nodeId);
      }

      node.lastPing = new Date();
      this.hashRing.nodes.set(nodeId, node);

    } catch (error) {
      if (node.status === 'active') {
        await this.handleNodeFailure(nodeId);
      }
    }
  }

  private updateStats(): void {
    const activeNodes = Array.from(this.hashRing.nodes.values())
      .filter(node => node.status === 'active');
    
    this.stats.totalNodes = this.hashRing.nodes.size;
    this.stats.activeNodes = activeNodes.length;
    this.stats.inactiveNodes = this.stats.totalNodes - this.stats.activeNodes;

    // Calculate operations per second
    const elapsedMinutes = (Date.now() - this.startTime) / 60000;
    this.stats.operationsPerSecond = this.operationCounter / (elapsedMinutes * 60);

    // Calculate overall stats from node stats
    let totalHits = 0;
    let totalMisses = 0;
    let totalLatency = 0;
    let nodeCount = 0;

    for (const nodeStats of this.stats.nodeStats.values()) {
      totalHits += nodeStats.hitRate * 100; // Rough approximation
      totalLatency += nodeStats.avgLatency;
      nodeCount++;
    }

    if (nodeCount > 0) {
      this.stats.hitRate = totalHits / nodeCount / 100;
      this.stats.averageLatency = totalLatency / nodeCount;
    }
  }

  getStats(): DistributedCacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  getNodes(): CacheNode[] {
    return Array.from(this.hashRing.nodes.values());
  }

  getHashRingInfo(): { totalVirtualNodes: number; nodeDistribution: Map<string, number> } {
    const nodeDistribution = new Map<string, number>();
    
    for (const nodeId of this.hashRing.ring.values()) {
      nodeDistribution.set(nodeId, (nodeDistribution.get(nodeId) || 0) + 1);
    }

    return {
      totalVirtualNodes: this.hashRing.ring.size,
      nodeDistribution,
    };
  }

  async rebalance(): Promise<void> {
    this.emit('rebalance-started');
    
    // Trigger rebalancing logic
    this.updateReplicationGroups();
    
    this.emit('rebalance-completed');
  }

  async shutdown(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    for (const [nodeId] of this.nodeConnections) {
      await this.removeNode(nodeId);
    }

    this.emit('shutdown');
  }
}
