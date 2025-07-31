/**
 * Message Queue Clustering Implementation
 * Healthcare Claims Processing System - Distributed Systems
 */

export interface QueueMessage {
  id: string;
  topic: string;
  partition?: number;
  key?: string;
  payload: any;
  headers: Record<string, string>;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  expiresAt?: number;
  priority: number;
}

export interface QueueNode {
  id: string;
  host: string;
  port: number;
  isLeader: boolean;
  isHealthy: boolean;
  lastHeartbeat: Date;
  partitions: number[];
  replicationFactor: number;
  diskUsage: number;
  memoryUsage: number;
}

export interface ClusterConfig {
  nodeId: string;
  nodes: QueueNode[];
  replicationFactor: number;
  partitionCount: number;
  heartbeatInterval: number;
  electionTimeout: number;
  maxMessageSize: number;
  retentionPeriod: number;
  compressionEnabled: boolean;
  persistenceEnabled: boolean;
}

export interface ProducerConfig {
  acks: 'none' | 'leader' | 'all';
  retries: number;
  batchSize: number;
  lingerMs: number;
  compressionType: 'none' | 'gzip' | 'snappy' | 'lz4';
  idempotent: boolean;
}

export interface ConsumerConfig {
  groupId: string;
  autoOffsetReset: 'earliest' | 'latest' | 'none';
  enableAutoCommit: boolean;
  autoCommitInterval: number;
  maxPollRecords: number;
  sessionTimeoutMs: number;
}

export abstract class MessageQueue {
  protected config: ClusterConfig;
  protected nodes: Map<string, QueueNode> = new Map();
  protected topics: Map<string, TopicMetadata> = new Map();

  constructor(config: ClusterConfig) {
    this.config = config;
    config.nodes.forEach(node => this.nodes.set(node.id, node));
  }

  abstract produce(topic: string, message: QueueMessage): Promise<boolean>;
  abstract consume(topic: string, consumerGroup: string): Promise<QueueMessage[]>;
  abstract createTopic(topic: string, partitions: number, replicationFactor: number): Promise<boolean>;
  abstract deleteTopic(topic: string): Promise<boolean>;
}

export interface TopicMetadata {
  name: string;
  partitions: PartitionMetadata[];
  replicationFactor: number;
  retentionMs: number;
  compactionEnabled: boolean;
}

export interface PartitionMetadata {
  id: number;
  leader: string;
  replicas: string[];
  inSyncReplicas: string[];
  offset: number;
  logSize: number;
}

export class DistributedMessageQueue extends MessageQueue {
  private partitioner: MessagePartitioner;
  private replicator: MessageReplicator;
  private leaderElection: LeaderElection;
  private storage: MessageStorage;
  private producers: Map<string, Producer> = new Map();
  private consumers: Map<string, Consumer> = new Map();

  constructor(config: ClusterConfig) {
    super(config);
    this.partitioner = new MessagePartitioner(config.partitionCount);
    this.replicator = new MessageReplicator(config.replicationFactor);
    this.leaderElection = new LeaderElection(config);
    this.storage = new MessageStorage(config.persistenceEnabled);
    
    this.startClusterManagement();
  }

  async produce(topic: string, message: QueueMessage): Promise<boolean> {
    // Ensure topic exists
    if (!this.topics.has(topic)) {
      await this.createTopic(topic, this.config.partitionCount, this.config.replicationFactor);
    }

    const topicMetadata = this.topics.get(topic)!;
    const partition = this.partitioner.getPartition(message.key || message.id, topicMetadata.partitions.length);
    const partitionMetadata = topicMetadata.partitions[partition];

    // Get leader for the partition
    const leaderNode = this.nodes.get(partitionMetadata.leader);
    if (!leaderNode || !leaderNode.isHealthy) {
      throw new Error(`Leader not available for partition ${partition}`);
    }

    message.partition = partition;
    message.timestamp = Date.now();

    // Send to leader
    const success = await this.sendToLeader(leaderNode, topic, message);
    
    if (success) {
      // Replicate to followers
      await this.replicator.replicate(topic, partition, message, partitionMetadata.replicas);
    }

    return success;
  }

  async consume(topic: string, consumerGroup: string): Promise<QueueMessage[]> {
    const topicMetadata = this.topics.get(topic);
    if (!topicMetadata) {
      throw new Error(`Topic ${topic} does not exist`);
    }

    const messages: QueueMessage[] = [];
    
    // Consume from all partitions assigned to this consumer
    for (const partition of topicMetadata.partitions) {
      const partitionMessages = await this.consumeFromPartition(topic, partition.id, consumerGroup);
      messages.push(...partitionMessages);
    }

    return messages;
  }

  async createTopic(topic: string, partitions: number, replicationFactor: number): Promise<boolean> {
    console.log(`📝 Creating topic ${topic} with ${partitions} partitions`);

    const topicMetadata: TopicMetadata = {
      name: topic,
      partitions: [],
      replicationFactor,
      retentionMs: this.config.retentionPeriod,
      compactionEnabled: false,
    };

    // Assign partitions to nodes
    const nodeIds = Array.from(this.nodes.keys()).filter(id => this.nodes.get(id)!.isHealthy);
    
    for (let i = 0; i < partitions; i++) {
      const leader = nodeIds[i % nodeIds.length];
      const replicas = this.selectReplicas(leader, replicationFactor, nodeIds);
      
      const partitionMetadata: PartitionMetadata = {
        id: i,
        leader,
        replicas,
        inSyncReplicas: [...replicas],
        offset: 0,
        logSize: 0,
      };
      
      topicMetadata.partitions.push(partitionMetadata);
    }

    this.topics.set(topic, topicMetadata);
    await this.broadcastTopicCreation(topicMetadata);
    
    return true;
  }

  async deleteTopic(topic: string): Promise<boolean> {
    console.log(`🗑️ Deleting topic ${topic}`);
    
    const deleted = this.topics.delete(topic);
    if (deleted) {
      await this.broadcastTopicDeletion(topic);
    }
    
    return deleted;
  }

  private selectReplicas(leader: string, replicationFactor: number, availableNodes: string[]): string[] {
    const replicas = [leader];
    const otherNodes = availableNodes.filter(id => id !== leader);
    
    for (let i = 0; i < Math.min(replicationFactor - 1, otherNodes.length); i++) {
      replicas.push(otherNodes[i]);
    }
    
    return replicas;
  }

  private async sendToLeader(leader: QueueNode, topic: string, message: QueueMessage): Promise<boolean> {
    try {
      console.log(`📤 Sending message to leader ${leader.id} for topic ${topic}`);
      
      // Store message
      await this.storage.store(topic, message.partition!, message);
      
      return true;
    } catch (error) {
      console.error(`❌ Failed to send to leader ${leader.id}:`, error);
      return false;
    }
  }

  private async consumeFromPartition(topic: string, partition: number, consumerGroup: string): Promise<QueueMessage[]> {
    try {
      const messages = await this.storage.retrieve(topic, partition, 10); // Batch size of 10
      console.log(`📥 Consumed ${messages.length} messages from ${topic}:${partition}`);
      return messages;
    } catch (error) {
      console.error(`❌ Failed to consume from ${topic}:${partition}:`, error);
      return [];
    }
  }

  private async broadcastTopicCreation(topicMetadata: TopicMetadata): Promise<void> {
    const promises = Array.from(this.nodes.values()).map(async (node) => {
      if (node.isHealthy) {
        try {
          await this.sendTopicMetadata(node, topicMetadata);
        } catch (error) {
          console.error(`❌ Failed to broadcast topic creation to ${node.id}:`, error);
        }
      }
    });

    await Promise.allSettled(promises);
  }

  private async broadcastTopicDeletion(topic: string): Promise<void> {
    const promises = Array.from(this.nodes.values()).map(async (node) => {
      if (node.isHealthy) {
        try {
          await this.sendTopicDeletion(node, topic);
        } catch (error) {
          console.error(`❌ Failed to broadcast topic deletion to ${node.id}:`, error);
        }
      }
    });

    await Promise.allSettled(promises);
  }

  private async sendTopicMetadata(node: QueueNode, topicMetadata: TopicMetadata): Promise<void> {
    // Simulate sending topic metadata to node
    console.log(`📤 Sending topic metadata to ${node.id}`);
  }

  private async sendTopicDeletion(node: QueueNode, topic: string): Promise<void> {
    // Simulate sending topic deletion to node
    console.log(`📤 Sending topic deletion to ${node.id}`);
  }

  private startClusterManagement(): void {
    // Start heartbeat
    setInterval(async () => {
      await this.sendHeartbeats();
    }, this.config.heartbeatInterval);

    // Start leader election
    this.leaderElection.start();

    // Start health monitoring
    setInterval(async () => {
      await this.checkNodeHealth();
    }, this.config.heartbeatInterval * 2);
  }

  private async sendHeartbeats(): Promise<void> {
    const promises = Array.from(this.nodes.values()).map(async (node) => {
      if (node.id !== this.config.nodeId) {
        try {
          await this.sendHeartbeat(node);
        } catch (error) {
          console.warn(`⚠️ Heartbeat failed for ${node.id}:`, error);
          node.isHealthy = false;
        }
      }
    });

    await Promise.allSettled(promises);
  }

  private async sendHeartbeat(node: QueueNode): Promise<void> {
    // Simulate heartbeat
    node.lastHeartbeat = new Date();
    node.isHealthy = Math.random() > 0.05; // 95% uptime
  }

  private async checkNodeHealth(): Promise<void> {
    const now = Date.now();
    
    this.nodes.forEach((node) => {
      const timeSinceHeartbeat = now - node.lastHeartbeat.getTime();
      
      if (timeSinceHeartbeat > this.config.heartbeatInterval * 3) {
        node.isHealthy = false;
        console.warn(`⚠️ Node ${node.id} marked as unhealthy`);
        
        // Trigger leader election for affected partitions
        this.handleNodeFailure(node);
      }
    });
  }

  private async handleNodeFailure(failedNode: QueueNode): Promise<void> {
    console.log(`🚨 Handling failure of node ${failedNode.id}`);
    
    // Re-elect leaders for partitions where this node was leader
    for (const topic of this.topics.values()) {
      for (const partition of topic.partitions) {
        if (partition.leader === failedNode.id) {
          await this.electNewLeader(topic.name, partition);
        }
        
        // Remove from replica sets
        partition.replicas = partition.replicas.filter(id => id !== failedNode.id);
        partition.inSyncReplicas = partition.inSyncReplicas.filter(id => id !== failedNode.id);
      }
    }
  }

  private async electNewLeader(topic: string, partition: PartitionMetadata): Promise<void> {
    const healthyReplicas = partition.inSyncReplicas.filter(id => 
      this.nodes.get(id)?.isHealthy
    );
    
    if (healthyReplicas.length > 0) {
      partition.leader = healthyReplicas[0];
      console.log(`👑 Elected new leader ${partition.leader} for ${topic}:${partition.id}`);
    } else {
      console.error(`❌ No healthy replicas available for ${topic}:${partition.id}`);
    }
  }
}

export class MessagePartitioner {
  private partitionCount: number;

  constructor(partitionCount: number) {
    this.partitionCount = partitionCount;
  }

  getPartition(key: string, totalPartitions: number): number {
    if (!key) {
      return Math.floor(Math.random() * totalPartitions);
    }
    
    return this.hash(key) % totalPartitions;
  }

  private hash(key: string): number {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

export class MessageReplicator {
  private replicationFactor: number;

  constructor(replicationFactor: number) {
    this.replicationFactor = replicationFactor;
  }

  async replicate(topic: string, partition: number, message: QueueMessage, replicas: string[]): Promise<void> {
    const replicationPromises = replicas.slice(1).map(async (replicaId) => {
      try {
        await this.sendToReplica(replicaId, topic, partition, message);
      } catch (error) {
        console.error(`❌ Failed to replicate to ${replicaId}:`, error);
      }
    });

    await Promise.allSettled(replicationPromises);
  }

  private async sendToReplica(replicaId: string, topic: string, partition: number, message: QueueMessage): Promise<void> {
    console.log(`🔄 Replicating message to ${replicaId} for ${topic}:${partition}`);
    // Simulate replication
  }
}

export class LeaderElection {
  private config: ClusterConfig;
  private isCandidate: boolean = false;
  private currentTerm: number = 0;

  constructor(config: ClusterConfig) {
    this.config = config;
  }

  start(): void {
    // Start leader election process
    setInterval(() => {
      this.checkLeadershipStatus();
    }, this.config.electionTimeout);
  }

  private checkLeadershipStatus(): void {
    // Simplified leader election based on node ID
    const sortedNodes = Array.from(this.config.nodes)
      .filter(node => node.isHealthy)
      .sort((a, b) => a.id.localeCompare(b.id));
    
    if (sortedNodes.length > 0 && sortedNodes[0].id === this.config.nodeId) {
      console.log(`👑 Node ${this.config.nodeId} is the leader`);
    }
  }
}

export class MessageStorage {
  private persistenceEnabled: boolean;
  private inMemoryStorage: Map<string, QueueMessage[]> = new Map();

  constructor(persistenceEnabled: boolean) {
    this.persistenceEnabled = persistenceEnabled;
  }

  async store(topic: string, partition: number, message: QueueMessage): Promise<void> {
    const key = `${topic}:${partition}`;
    
    if (!this.inMemoryStorage.has(key)) {
      this.inMemoryStorage.set(key, []);
    }
    
    this.inMemoryStorage.get(key)!.push(message);
    
    if (this.persistenceEnabled) {
      await this.persistToDisk(topic, partition, message);
    }
  }

  async retrieve(topic: string, partition: number, limit: number): Promise<QueueMessage[]> {
    const key = `${topic}:${partition}`;
    const messages = this.inMemoryStorage.get(key) || [];
    
    return messages.slice(0, limit);
  }

  private async persistToDisk(topic: string, partition: number, message: QueueMessage): Promise<void> {
    // Simulate disk persistence
    console.log(`💾 Persisting message to disk: ${topic}:${partition}`);
  }
}

export class Producer {
  private queue: DistributedMessageQueue;
  private config: ProducerConfig;
  private messageBuffer: QueueMessage[] = [];

  constructor(queue: DistributedMessageQueue, config: ProducerConfig) {
    this.queue = queue;
    this.config = config;
    
    if (config.lingerMs > 0) {
      this.startBatching();
    }
  }

  async send(topic: string, key: string, payload: any, headers: Record<string, string> = {}): Promise<boolean> {
    const message: QueueMessage = {
      id: this.generateMessageId(),
      topic,
      key,
      payload,
      headers,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: this.config.retries,
      priority: 0,
    };

    if (this.config.lingerMs > 0) {
      this.messageBuffer.push(message);
      return true;
    } else {
      return this.queue.produce(topic, message);
    }
  }

  private startBatching(): void {
    setInterval(() => {
      if (this.messageBuffer.length > 0) {
        this.flushBuffer();
      }
    }, this.config.lingerMs);
  }

  private async flushBuffer(): Promise<void> {
    const batch = this.messageBuffer.splice(0, this.config.batchSize);
    
    const promises = batch.map(message => 
      this.queue.produce(message.topic, message)
    );
    
    await Promise.allSettled(promises);
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export class Consumer {
  private queue: DistributedMessageQueue;
  private config: ConsumerConfig;
  private isRunning: boolean = false;
  private messageHandler?: (message: QueueMessage) => Promise<void>;

  constructor(queue: DistributedMessageQueue, config: ConsumerConfig) {
    this.queue = queue;
    this.config = config;
  }

  async subscribe(topic: string, handler: (message: QueueMessage) => Promise<void>): Promise<void> {
    this.messageHandler = handler;
    this.isRunning = true;
    
    console.log(`📥 Consumer subscribed to topic ${topic}`);
    
    while (this.isRunning) {
      try {
        const messages = await this.queue.consume(topic, this.config.groupId);
        
        for (const message of messages) {
          await this.processMessage(message);
        }
        
        // Poll interval
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`❌ Consumer error:`, error);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  unsubscribe(): void {
    this.isRunning = false;
    console.log(`🔄 Consumer unsubscribed`);
  }

  private async processMessage(message: QueueMessage): Promise<void> {
    if (this.messageHandler) {
      try {
        await this.messageHandler(message);
        console.log(`✅ Processed message ${message.id}`);
      } catch (error) {
        console.error(`❌ Failed to process message ${message.id}:`, error);
        // Could implement dead letter queue here
      }
    }
  }
}

export class HealthcareMessageQueueManager {
  private queue: DistributedMessageQueue;
  private producer: Producer;
  private consumers: Map<string, Consumer> = new Map();

  constructor(config: ClusterConfig) {
    this.queue = new DistributedMessageQueue(config);
    this.producer = new Producer(this.queue, {
      acks: 'all',
      retries: 3,
      batchSize: 100,
      lingerMs: 100,
      compressionType: 'gzip',
      idempotent: true,
    });
    
    this.setupTopics();
  }

  private async setupTopics(): Promise<void> {
    const topics = [
      'claim-submissions',
      'claim-updates',
      'payment-processing',
      'notification-events',
      'audit-logs',
    ];

    for (const topic of topics) {
      await this.queue.createTopic(topic, 10, 3);
    }
  }

  async publishClaimSubmission(claimData: any): Promise<boolean> {
    return this.producer.send(
      'claim-submissions',
      claimData.claimId,
      claimData,
      { 'content-type': 'application/json', 'source': 'claims-service' }
    );
  }

  async publishPaymentEvent(paymentData: any): Promise<boolean> {
    return this.producer.send(
      'payment-processing',
      paymentData.paymentId,
      paymentData,
      { 'content-type': 'application/json', 'source': 'payment-service' }
    );
  }

  async subscribeToClaimUpdates(handler: (claimUpdate: any) => Promise<void>): Promise<void> {
    const consumer = new Consumer(this.queue, {
      groupId: 'claim-processors',
      autoOffsetReset: 'latest',
      enableAutoCommit: true,
      autoCommitInterval: 5000,
      maxPollRecords: 10,
      sessionTimeoutMs: 30000,
    });

    this.consumers.set('claim-updates', consumer);

    await consumer.subscribe('claim-updates', async (message) => {
      await handler(message.payload);
    });
  }

  async subscribeToNotifications(handler: (notification: any) => Promise<void>): Promise<void> {
    const consumer = new Consumer(this.queue, {
      groupId: 'notification-service',
      autoOffsetReset: 'latest',
      enableAutoCommit: true,
      autoCommitInterval: 1000,
      maxPollRecords: 50,
      sessionTimeoutMs: 30000,
    });

    this.consumers.set('notifications', consumer);

    await consumer.subscribe('notification-events', async (message) => {
      await handler(message.payload);
    });
  }

  shutdown(): void {
    this.consumers.forEach(consumer => consumer.unsubscribe());
    console.log(`🛑 Message queue manager shut down`);
  }
}
