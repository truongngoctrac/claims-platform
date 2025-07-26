import { Client } from '@elastic/elasticsearch';
import winston from 'winston';

interface ClusterConfig {
  nodes: string[];
  auth?: {
    username: string;
    password: string;
  };
  ssl?: {
    enabled: boolean;
    ca?: string;
    cert?: string;
    key?: string;
  };
  timeout?: number;
  compression?: boolean;
  apiVersion?: string;
}

interface ClusterHealth {
  status: 'green' | 'yellow' | 'red';
  numberOfNodes: number;
  numberOfDataNodes: number;
  activePrimaryShards: number;
  activeShards: number;
  relocatingShards: number;
  initializingShards: number;
  unassignedShards: number;
  delayedUnassignedShards: number;
  pendingTasks: number;
  inFlightFetch: number;
  taskMaxWaitingInQueueMillis: number;
  activeShardsPercentAsNumber: number;
}

interface NodeInfo {
  id: string;
  name: string;
  version: string;
  roles: string[];
  attributes: Record<string, string>;
  settings: Record<string, any>;
}

export class ElasticsearchClusterService {
  private client: Client;
  private logger: winston.Logger;
  private config: ClusterConfig;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectInterval: number = 5000; // 5 seconds

  constructor(config: ClusterConfig) {
    this.config = config;
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'elasticsearch-cluster' },
      transports: [
        new winston.transports.File({ filename: 'logs/elasticsearch-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/elasticsearch-combined.log' }),
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    this.initializeClient();
  }

  private initializeClient(): void {
    try {
      this.client = new Client({
        nodes: this.config.nodes,
        auth: this.config.auth,
        tls: this.config.ssl?.enabled ? {
          ca: this.config.ssl.ca,
          cert: this.config.ssl.cert,
          key: this.config.ssl.key,
          rejectUnauthorized: true
        } : undefined,
        requestTimeout: this.config.timeout || 30000,
        compression: this.config.compression || false,
        apiVersion: this.config.apiVersion || '7.17'
      });

      this.setupConnectionHandlers();
      this.logger.info('Elasticsearch client initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Elasticsearch client:', error);
      throw error;
    }
  }

  private setupConnectionHandlers(): void {
    // Modern Elasticsearch client doesn't use event handlers in the same way
    // Instead, we'll rely on try-catch blocks in individual methods
    // and periodic health checks
    this.logger.info('Elasticsearch client connection handlers configured');
  }

  private async handleConnectionError(): Promise<void> {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.logger.warn(`Connection lost. Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(async () => {
        try {
          await this.ping();
          this.reconnectAttempts = 0;
          this.logger.info('Successfully reconnected to Elasticsearch cluster');
        } catch (error) {
          this.logger.error('Reconnection failed:', error);
          this.handleConnectionError();
        }
      }, this.reconnectInterval);
    } else {
      this.logger.error('Max reconnection attempts reached. Please check cluster status.');
    }
  }

  async ping(): Promise<boolean> {
    try {
      const response = await this.client.ping();
      return response.body;
    } catch (error) {
      this.logger.error('Ping failed:', error);
      throw error;
    }
  }

  async getClusterHealth(): Promise<ClusterHealth> {
    try {
      const response = await this.client.cluster.health();
      return response.body;
    } catch (error) {
      this.logger.error('Failed to get cluster health:', error);
      throw error;
    }
  }

  async getClusterStats(): Promise<any> {
    try {
      const response = await this.client.cluster.stats();
      return response.body;
    } catch (error) {
      this.logger.error('Failed to get cluster stats:', error);
      throw error;
    }
  }

  async getNodesInfo(): Promise<NodeInfo[]> {
    try {
      const response = await this.client.nodes.info();
      const nodes = response.body.nodes;
      
      return Object.keys(nodes).map(nodeId => ({
        id: nodeId,
        name: nodes[nodeId].name,
        version: nodes[nodeId].version,
        roles: nodes[nodeId].roles,
        attributes: nodes[nodeId].attributes,
        settings: nodes[nodeId].settings
      }));
    } catch (error) {
      this.logger.error('Failed to get nodes info:', error);
      throw error;
    }
  }

  async getNodeStats(): Promise<any> {
    try {
      const response = await this.client.nodes.stats();
      return response.body;
    } catch (error) {
      this.logger.error('Failed to get node stats:', error);
      throw error;
    }
  }

  async createSnapshot(repository: string, snapshot: string): Promise<any> {
    try {
      const response = await this.client.snapshot.create({
        repository,
        snapshot,
        body: {
          indices: '*',
          ignore_unavailable: true,
          include_global_state: false,
          metadata: {
            taken_by: 'automated-backup',
            taken_because: 'scheduled backup'
          }
        }
      });
      
      this.logger.info(`Snapshot created: ${snapshot} in repository: ${repository}`);
      return response.body;
    } catch (error) {
      this.logger.error('Failed to create snapshot:', error);
      throw error;
    }
  }

  async restoreSnapshot(repository: string, snapshot: string, indices?: string[]): Promise<any> {
    try {
      const response = await this.client.snapshot.restore({
        repository,
        snapshot,
        body: {
          indices: indices?.join(',') || '*',
          ignore_unavailable: true,
          include_global_state: false
        }
      });
      
      this.logger.info(`Snapshot restored: ${snapshot} from repository: ${repository}`);
      return response.body;
    } catch (error) {
      this.logger.error('Failed to restore snapshot:', error);
      throw error;
    }
  }

  async configureShardAllocation(enable: boolean): Promise<any> {
    try {
      const response = await this.client.cluster.putSettings({
        body: {
          persistent: {
            'cluster.routing.allocation.enable': enable ? 'all' : 'none'
          }
        }
      });
      
      this.logger.info(`Shard allocation ${enable ? 'enabled' : 'disabled'}`);
      return response.body;
    } catch (error) {
      this.logger.error('Failed to configure shard allocation:', error);
      throw error;
    }
  }

  async setClusterSettings(settings: Record<string, any>): Promise<any> {
    try {
      const response = await this.client.cluster.putSettings({
        body: {
          persistent: settings
        }
      });
      
      this.logger.info('Cluster settings updated');
      return response.body;
    } catch (error) {
      this.logger.error('Failed to update cluster settings:', error);
      throw error;
    }
  }

  async getClusterSettings(): Promise<any> {
    try {
      const response = await this.client.cluster.getSettings({
        include_defaults: true
      });
      return response.body;
    } catch (error) {
      this.logger.error('Failed to get cluster settings:', error);
      throw error;
    }
  }

  async rebalanceCluster(): Promise<any> {
    try {
      const response = await this.client.cluster.reroute({
        body: {
          commands: []
        }
      });
      
      this.logger.info('Cluster rebalancing initiated');
      return response.body;
    } catch (error) {
      this.logger.error('Failed to rebalance cluster:', error);
      throw error;
    }
  }

  async getActiveTasks(): Promise<any> {
    try {
      const response = await this.client.tasks.list({
        detailed: true,
        actions: '*'
      });
      return response.body;
    } catch (error) {
      this.logger.error('Failed to get active tasks:', error);
      throw error;
    }
  }

  async cancelTask(taskId: string): Promise<any> {
    try {
      const response = await this.client.tasks.cancel({
        task_id: taskId
      });
      
      this.logger.info(`Task cancelled: ${taskId}`);
      return response.body;
    } catch (error) {
      this.logger.error('Failed to cancel task:', error);
      throw error;
    }
  }

  getClient(): Client {
    return this.client;
  }

  async close(): Promise<void> {
    try {
      await this.client.close();
      this.logger.info('Elasticsearch client closed');
    } catch (error) {
      this.logger.error('Error closing Elasticsearch client:', error);
      throw error;
    }
  }
}

// Factory function for creating cluster instances
export function createElasticsearchCluster(config: ClusterConfig): ElasticsearchClusterService {
  return new ElasticsearchClusterService(config);
}

// Default cluster configurations
export const defaultClusterConfigs = {
  development: {
    nodes: ['http://localhost:9200'],
    timeout: 10000,
    compression: false
  },
  production: {
    nodes: [
      'https://es-node-1:9200',
      'https://es-node-2:9200',
      'https://es-node-3:9200'
    ],
    auth: {
      username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
      password: process.env.ELASTICSEARCH_PASSWORD || 'changeme'
    },
    ssl: {
      enabled: true,
      ca: process.env.ELASTICSEARCH_CA_CERT
    },
    timeout: 30000,
    compression: true
  }
};
