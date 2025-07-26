import Redis, { Cluster } from 'ioredis';
import { EventEmitter } from 'events';

export interface RedisClusterConfig {
  nodes: Array<{
    host: string;
    port: number;
  }>;
  options?: {
    enableReadyCheck?: boolean;
    redisOptions?: {
      password?: string;
      db?: number;
      connectionTimeout?: number;
      commandTimeout?: number;
      retryDelayOnFailover?: number;
      maxRetriesPerRequest?: number;
    };
    enableOfflineQueue?: boolean;
    readOnly?: boolean;
    keyPrefix?: string;
    slotsRefreshTimeout?: number;
    slotsRefreshInterval?: number;
    dnsLookup?: boolean;
  };
}

export interface ClusterHealth {
  isConnected: boolean;
  nodesCount: number;
  masterNodes: number;
  replicaNodes: number;
  slotsAssigned: number;
  failedNodes: string[];
  latency: number;
  lastHealthCheck: Date;
}

export interface NodeInfo {
  id: string;
  host: string;
  port: number;
  role: 'master' | 'slave';
  slots: number[];
  replicaOf?: string;
  ping: number;
  status: 'connected' | 'disconnected' | 'fail';
  memoryUsage: number;
  keyCount: number;
}

export class RedisClusterManager extends EventEmitter {
  private cluster: Cluster | null = null;
  private config: RedisClusterConfig;
  private isInitialized = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private connectionPool: Map<string, Redis> = new Map();
  private nodeInfoCache: Map<string, NodeInfo> = new Map();

  constructor(config: RedisClusterConfig) {
    super();
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      this.cluster = new Cluster(this.config.nodes, {
        enableReadyCheck: this.config.options?.enableReadyCheck ?? true,
        redisOptions: {
          password: this.config.options?.redisOptions?.password,
          db: this.config.options?.redisOptions?.db ?? 0,
          connectTimeout: this.config.options?.redisOptions?.connectionTimeout ?? 10000,
          commandTimeout: this.config.options?.redisOptions?.commandTimeout ?? 5000,
          retryDelayOnFailover: this.config.options?.redisOptions?.retryDelayOnFailover ?? 100,
          maxRetriesPerRequest: this.config.options?.redisOptions?.maxRetriesPerRequest ?? 3,
        },
        enableOfflineQueue: this.config.options?.enableOfflineQueue ?? false,
        readOnly: this.config.options?.readOnly ?? false,
        keyPrefix: this.config.options?.keyPrefix,
        slotsRefreshTimeout: this.config.options?.slotsRefreshTimeout ?? 1000,
        slotsRefreshInterval: this.config.options?.slotsRefreshInterval ?? 5000,
        dnsLookup: this.config.options?.dnsLookup ?? false,
      });

      // Set up event listeners
      this.cluster.on('ready', () => {
        this.emit('cluster-ready');
        console.log('Redis cluster is ready');
      });

      this.cluster.on('error', (error) => {
        this.emit('cluster-error', error);
        console.error('Redis cluster error:', error);
      });

      this.cluster.on('connect', () => {
        this.emit('cluster-connect');
        console.log('Connected to Redis cluster');
      });

      this.cluster.on('reconnecting', () => {
        this.emit('cluster-reconnecting');
        console.log('Reconnecting to Redis cluster');
      });

      this.cluster.on('end', () => {
        this.emit('cluster-end');
        console.log('Redis cluster connection ended');
      });

      this.cluster.on('+node', (node) => {
        this.emit('node-added', node);
        console.log('Node added to cluster:', node);
      });

      this.cluster.on('-node', (node) => {
        this.emit('node-removed', node);
        console.log('Node removed from cluster:', node);
      });

      this.cluster.on('node error', (error, node) => {
        this.emit('node-error', { error, node });
        console.error('Node error:', error, 'Node:', node);
      });

      await this.cluster.ping();
      this.isInitialized = true;

      // Start health monitoring
      this.startHealthMonitoring();

      // Initialize connection pool for direct node access
      await this.initializeConnectionPool();

    } catch (error) {
      console.error('Failed to initialize Redis cluster:', error);
      throw error;
    }
  }

  private async initializeConnectionPool(): Promise<void> {
    const nodes = this.cluster?.nodes() || [];
    
    for (const node of nodes) {
      const nodeId = `${node.options.host}:${node.options.port}`;
      this.connectionPool.set(nodeId, node);
    }
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.getClusterHealth();
        this.emit('health-check', health);

        if (!health.isConnected) {
          this.emit('cluster-unhealthy', health);
        }
      } catch (error) {
        this.emit('health-check-error', error);
      }
    }, 30000); // Check every 30 seconds
  }

  async getClusterHealth(): Promise<ClusterHealth> {
    if (!this.cluster) {
      throw new Error('Redis cluster not initialized');
    }

    const startTime = Date.now();
    const nodes = this.cluster.nodes();
    const failedNodes: string[] = [];
    let masterNodes = 0;
    let replicaNodes = 0;
    let slotsAssigned = 0;

    for (const node of nodes) {
      try {
        await node.ping();
        const info = await node.info('replication');
        
        if (info.includes('role:master')) {
          masterNodes++;
        } else {
          replicaNodes++;
        }

        // Get slot information for master nodes
        if (info.includes('role:master')) {
          try {
            const slots = await node.cluster('slots');
            slotsAssigned += this.countSlotsFromResponse(slots);
          } catch (error) {
            console.warn('Failed to get slot info from node:', error);
          }
        }
      } catch (error) {
        failedNodes.push(`${node.options.host}:${node.options.port}`);
      }
    }

    const latency = Date.now() - startTime;

    return {
      isConnected: failedNodes.length < nodes.length,
      nodesCount: nodes.length,
      masterNodes,
      replicaNodes,
      slotsAssigned,
      failedNodes,
      latency,
      lastHealthCheck: new Date(),
    };
  }

  private countSlotsFromResponse(slotsResponse: any[]): number {
    let count = 0;
    for (const slotRange of slotsResponse) {
      if (Array.isArray(slotRange) && slotRange.length >= 2) {
        count += slotRange[1] - slotRange[0] + 1;
      }
    }
    return count;
  }

  async getNodeInfo(): Promise<NodeInfo[]> {
    if (!this.cluster) {
      throw new Error('Redis cluster not initialized');
    }

    const nodes = this.cluster.nodes();
    const nodeInfos: NodeInfo[] = [];

    for (const node of nodes) {
      try {
        const startTime = Date.now();
        await node.ping();
        const ping = Date.now() - startTime;

        const info = await node.info();
        const memory = await node.memory('usage');
        const dbsize = await node.dbsize();

        const replicationInfo = await node.info('replication');
        const role = replicationInfo.includes('role:master') ? 'master' : 'slave';

        let slots: number[] = [];
        let replicaOf: string | undefined;

        if (role === 'master') {
          try {
            const clusterSlots = await node.cluster('slots');
            slots = this.extractSlotsFromResponse(clusterSlots);
          } catch (error) {
            console.warn('Failed to get slots for master node:', error);
          }
        } else {
          const masterMatch = replicationInfo.match(/master_host:([^\r\n]+)/);
          const portMatch = replicationInfo.match(/master_port:(\d+)/);
          if (masterMatch && portMatch) {
            replicaOf = `${masterMatch[1]}:${portMatch[1]}`;
          }
        }

        const nodeInfo: NodeInfo = {
          id: `${node.options.host}:${node.options.port}`,
          host: node.options.host!,
          port: node.options.port!,
          role,
          slots,
          replicaOf,
          ping,
          status: 'connected',
          memoryUsage: parseInt(memory.toString()) || 0,
          keyCount: dbsize,
        };

        nodeInfos.push(nodeInfo);
        this.nodeInfoCache.set(nodeInfo.id, nodeInfo);

      } catch (error) {
        const nodeInfo: NodeInfo = {
          id: `${node.options.host}:${node.options.port}`,
          host: node.options.host!,
          port: node.options.port!,
          role: 'master', // Default assumption
          slots: [],
          ping: -1,
          status: 'disconnected',
          memoryUsage: 0,
          keyCount: 0,
        };

        nodeInfos.push(nodeInfo);
      }
    }

    return nodeInfos;
  }

  private extractSlotsFromResponse(slotsResponse: any[]): number[] {
    const slots: number[] = [];
    for (const slotRange of slotsResponse) {
      if (Array.isArray(slotRange) && slotRange.length >= 2) {
        for (let i = slotRange[0]; i <= slotRange[1]; i++) {
          slots.push(i);
        }
      }
    }
    return slots;
  }

  async executeOnNode(nodeId: string, command: string, ...args: any[]): Promise<any> {
    const connection = this.connectionPool.get(nodeId);
    if (!connection) {
      throw new Error(`Node ${nodeId} not found in connection pool`);
    }

    return await (connection as any)[command](...args);
  }

  async executeOnAllNodes(command: string, ...args: any[]): Promise<Map<string, any>> {
    const results = new Map<string, any>();
    const promises: Promise<void>[] = [];

    for (const [nodeId, connection] of this.connectionPool) {
      promises.push(
        (async () => {
          try {
            const result = await (connection as any)[command](...args);
            results.set(nodeId, result);
          } catch (error) {
            results.set(nodeId, { error: error.message });
          }
        })()
      );
    }

    await Promise.all(promises);
    return results;
  }

  async failover(nodeId?: string): Promise<void> {
    if (!this.cluster) {
      throw new Error('Redis cluster not initialized');
    }

    if (nodeId) {
      const connection = this.connectionPool.get(nodeId);
      if (!connection) {
        throw new Error(`Node ${nodeId} not found`);
      }
      await connection.cluster('failover');
    } else {
      // Trigger failover on first available master
      const nodeInfos = await this.getNodeInfo();
      const masterNode = nodeInfos.find(node => node.role === 'master' && node.status === 'connected');
      
      if (masterNode) {
        const connection = this.connectionPool.get(masterNode.id);
        if (connection) {
          await connection.cluster('failover');
        }
      }
    }
  }

  async rebalanceCluster(): Promise<void> {
    if (!this.cluster) {
      throw new Error('Redis cluster not initialized');
    }

    // This is a simplified rebalancing - in production, you'd want more sophisticated logic
    await this.cluster.cluster('rebalance');
  }

  async addNode(host: string, port: number): Promise<void> {
    if (!this.cluster) {
      throw new Error('Redis cluster not initialized');
    }

    // Add node to cluster
    await this.cluster.cluster('meet', host, port);
    
    // Wait for node to be recognized
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Update connection pool
    const newConnection = new Redis({ host, port });
    this.connectionPool.set(`${host}:${port}`, newConnection);
  }

  async removeNode(nodeId: string): Promise<void> {
    if (!this.cluster) {
      throw new Error('Redis cluster not initialized');
    }

    const nodeInfo = this.nodeInfoCache.get(nodeId);
    if (!nodeInfo) {
      throw new Error(`Node ${nodeId} not found`);
    }

    // Remove from cluster
    await this.cluster.cluster('forget', nodeId);
    
    // Remove from connection pool
    const connection = this.connectionPool.get(nodeId);
    if (connection) {
      await connection.disconnect();
      this.connectionPool.delete(nodeId);
    }
  }

  getCluster(): Cluster | null {
    return this.cluster;
  }

  isReady(): boolean {
    return this.isInitialized && this.cluster?.status === 'ready';
  }

  async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Close all individual connections
    for (const [, connection] of this.connectionPool) {
      await connection.disconnect();
    }
    this.connectionPool.clear();

    // Close cluster connection
    if (this.cluster) {
      await this.cluster.disconnect();
      this.cluster = null;
    }

    this.isInitialized = false;
    this.emit('shutdown');
  }
}

// Singleton instance for global use
export class RedisClusterSingleton {
  private static instance: RedisClusterManager | null = null;

  static async initialize(config: RedisClusterConfig): Promise<RedisClusterManager> {
    if (!this.instance) {
      this.instance = new RedisClusterManager(config);
      await this.instance.initialize();
    }
    return this.instance;
  }

  static getInstance(): RedisClusterManager | null {
    return this.instance;
  }

  static async shutdown(): Promise<void> {
    if (this.instance) {
      await this.instance.shutdown();
      this.instance = null;
    }
  }
}
