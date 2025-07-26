/**
 * Byzantine Fault Tolerance Implementation
 * Healthcare Claims Processing System - Distributed Systems
 */

export interface ByzantineNode {
  id: string;
  address: string;
  port: number;
  publicKey: string;
  isTrusted: boolean;
  reputation: number;
  lastValidMessage: Date;
  messageCount: number;
  maliciousActivity: number;
}

export interface ByzantineMessage {
  messageId: string;
  senderId: string;
  timestamp: number;
  messageType: string;
  payload: any;
  signature: string;
  nonce: number;
  hash: string;
}

export interface BFTConfig {
  nodeId: string;
  maxFaultyNodes: number;
  minNodes: number;
  messageTimeout: number;
  reputationThreshold: number;
  signatureVerification: boolean;
  enableAuditLog: boolean;
}

export abstract class ByzantineFaultToleranceProtocol {
  protected config: BFTConfig;
  protected nodes: Map<string, ByzantineNode> = new Map();
  protected messageLog: ByzantineMessage[] = [];
  protected suspiciousActivity: Map<string, number> = new Map();

  constructor(config: BFTConfig) {
    this.config = config;
  }

  abstract processMessage(message: ByzantineMessage): Promise<boolean>;
  abstract detectByzantineNode(nodeId: string): Promise<boolean>;
  abstract isolateNode(nodeId: string): Promise<void>;
  abstract verifyMessage(message: ByzantineMessage): Promise<boolean>;
}

export class PBFTProtocol extends ByzantineFaultToleranceProtocol {
  private view: number = 0;
  private sequenceNumber: number = 0;
  private primary: string;
  private prepareMessages: Map<string, Map<string, ByzantineMessage>> = new Map();
  private commitMessages: Map<string, Map<string, ByzantineMessage>> = new Map();
  private checkpoints: Map<number, any> = new Map();

  constructor(config: BFTConfig, nodes: ByzantineNode[]) {
    super(config);
    nodes.forEach(node => this.nodes.set(node.id, node));
    this.primary = this.selectPrimary();
  }

  async processMessage(message: ByzantineMessage): Promise<boolean> {
    console.log(`📨 Processing message ${message.messageId} from ${message.senderId}`);

    // Verify message authenticity
    if (!(await this.verifyMessage(message))) {
      await this.recordSuspiciousActivity(message.senderId, 'invalid_signature');
      return false;
    }

    // Check for replay attacks
    if (this.isReplayAttack(message)) {
      await this.recordSuspiciousActivity(message.senderId, 'replay_attack');
      return false;
    }

    // Process based on message type
    switch (message.messageType) {
      case 'pre-prepare':
        return this.handlePrePrepare(message);
      case 'prepare':
        return this.handlePrepare(message);
      case 'commit':
        return this.handleCommit(message);
      case 'checkpoint':
        return this.handleCheckpoint(message);
      case 'view-change':
        return this.handleViewChange(message);
      default:
        console.warn(`⚠️ Unknown message type: ${message.messageType}`);
        return false;
    }
  }

  async detectByzantineNode(nodeId: string): Promise<boolean> {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    const suspiciousCount = this.suspiciousActivity.get(nodeId) || 0;
    const reputationScore = this.calculateReputation(node);

    // Check various Byzantine fault indicators
    const indicators = [
      suspiciousCount > 5,
      reputationScore < this.config.reputationThreshold,
      this.hasConflictingMessages(nodeId),
      this.hasTimingAnomalies(nodeId),
      this.hasInvalidSignatures(nodeId),
    ];

    const byzantineIndicators = indicators.filter(indicator => indicator).length;
    const isByzantine = byzantineIndicators >= 2;

    if (isByzantine) {
      console.log(`🚨 Byzantine node detected: ${nodeId}`);
      await this.isolateNode(nodeId);
    }

    return isByzantine;
  }

  async isolateNode(nodeId: string): Promise<void> {
    console.log(`🚧 Isolating Byzantine node: ${nodeId}`);

    const node = this.nodes.get(nodeId);
    if (node) {
      node.isTrusted = false;
      node.reputation = 0;
    }

    // Remove from active participation
    await this.removeFromConsensus(nodeId);
    
    // Notify other nodes
    await this.broadcastNodeIsolation(nodeId);
    
    // Log the isolation
    if (this.config.enableAuditLog) {
      await this.logByzantineActivity(nodeId, 'node_isolated');
    }
  }

  async verifyMessage(message: ByzantineMessage): Promise<boolean> {
    if (!this.config.signatureVerification) {
      return true;
    }

    const node = this.nodes.get(message.senderId);
    if (!node || !node.isTrusted) {
      return false;
    }

    // Verify message hash
    const calculatedHash = this.calculateMessageHash(message);
    if (calculatedHash !== message.hash) {
      return false;
    }

    // Verify digital signature
    return this.verifyDigitalSignature(message, node.publicKey);
  }

  private async handlePrePrepare(message: ByzantineMessage): Promise<boolean> {
    if (message.senderId !== this.primary) {
      await this.recordSuspiciousActivity(message.senderId, 'unauthorized_preprepare');
      return false;
    }

    const key = `${this.view}-${message.payload.sequenceNumber}`;
    
    // Check for conflicting pre-prepare messages
    if (this.hasConflictingPrePrepare(key, message)) {
      await this.recordSuspiciousActivity(message.senderId, 'conflicting_preprepare');
      return false;
    }

    // Send prepare message
    await this.sendPrepareMessage(message);
    return true;
  }

  private async handlePrepare(message: ByzantineMessage): Promise<boolean> {
    const key = `${this.view}-${message.payload.sequenceNumber}`;
    
    if (!this.prepareMessages.has(key)) {
      this.prepareMessages.set(key, new Map());
    }
    
    this.prepareMessages.get(key)!.set(message.senderId, message);

    // Check if we have enough prepare messages (2f)
    const requiredPrepares = 2 * this.config.maxFaultyNodes;
    
    if (this.prepareMessages.get(key)!.size >= requiredPrepares) {
      await this.sendCommitMessage(message);
    }

    return true;
  }

  private async handleCommit(message: ByzantineMessage): Promise<boolean> {
    const key = `${this.view}-${message.payload.sequenceNumber}`;
    
    if (!this.commitMessages.has(key)) {
      this.commitMessages.set(key, new Map());
    }
    
    this.commitMessages.get(key)!.set(message.senderId, message);

    // Check if we have enough commit messages (2f + 1)
    const requiredCommits = 2 * this.config.maxFaultyNodes + 1;
    
    if (this.commitMessages.get(key)!.size >= requiredCommits) {
      await this.executeOperation(message.payload);
    }

    return true;
  }

  private async handleCheckpoint(message: ByzantineMessage): Promise<boolean> {
    // Validate checkpoint data
    if (await this.validateCheckpoint(message.payload)) {
      this.checkpoints.set(message.payload.sequenceNumber, message.payload);
      return true;
    }

    await this.recordSuspiciousActivity(message.senderId, 'invalid_checkpoint');
    return false;
  }

  private async handleViewChange(message: ByzantineMessage): Promise<boolean> {
    // Handle view change protocol
    console.log(`🔄 View change initiated by ${message.senderId}`);
    
    if (await this.validateViewChange(message)) {
      await this.processViewChange(message);
      return true;
    }

    return false;
  }

  private isReplayAttack(message: ByzantineMessage): boolean {
    // Check if message was already processed
    return this.messageLog.some(logged => 
      logged.messageId === message.messageId && 
      logged.senderId === message.senderId
    );
  }

  private hasConflictingMessages(nodeId: string): boolean {
    const nodeMessages = this.messageLog.filter(msg => msg.senderId === nodeId);
    
    // Check for conflicting messages with same sequence number
    const sequenceGroups = new Map<number, ByzantineMessage[]>();
    
    nodeMessages.forEach(msg => {
      if (msg.payload.sequenceNumber) {
        const seq = msg.payload.sequenceNumber;
        if (!sequenceGroups.has(seq)) {
          sequenceGroups.set(seq, []);
        }
        sequenceGroups.get(seq)!.push(msg);
      }
    });

    // Check for conflicts within sequence groups
    for (const [seq, messages] of sequenceGroups) {
      if (messages.length > 1) {
        const hasConflict = messages.some(msg1 => 
          messages.some(msg2 => 
            msg1.messageId !== msg2.messageId && 
            msg1.messageType === msg2.messageType &&
            JSON.stringify(msg1.payload) !== JSON.stringify(msg2.payload)
          )
        );
        
        if (hasConflict) return true;
      }
    }

    return false;
  }

  private hasTimingAnomalies(nodeId: string): boolean {
    const nodeMessages = this.messageLog.filter(msg => msg.senderId === nodeId);
    
    if (nodeMessages.length < 2) return false;

    // Check for messages with future timestamps
    const now = Date.now();
    const futureMessages = nodeMessages.filter(msg => msg.timestamp > now + 60000); // 1 minute tolerance
    
    return futureMessages.length > 0;
  }

  private hasInvalidSignatures(nodeId: string): boolean {
    const nodeMessages = this.messageLog.filter(msg => msg.senderId === nodeId);
    const invalidSignatures = nodeMessages.filter(msg => !this.verifyDigitalSignature(msg, this.nodes.get(nodeId)?.publicKey || ''));
    
    return invalidSignatures.length > nodeMessages.length * 0.1; // More than 10% invalid
  }

  private calculateReputation(node: ByzantineNode): number {
    const baseReputation = node.reputation;
    const maliciousActivity = node.maliciousActivity;
    const messageCount = node.messageCount;
    
    // Reputation formula: base - (malicious * weight) + (messages * positive_weight)
    return Math.max(0, baseReputation - (maliciousActivity * 10) + (messageCount * 0.1));
  }

  private async recordSuspiciousActivity(nodeId: string, activityType: string): Promise<void> {
    console.log(`⚠️ Suspicious activity detected: ${nodeId} - ${activityType}`);
    
    const current = this.suspiciousActivity.get(nodeId) || 0;
    this.suspiciousActivity.set(nodeId, current + 1);

    const node = this.nodes.get(nodeId);
    if (node) {
      node.maliciousActivity++;
    }

    if (this.config.enableAuditLog) {
      await this.logByzantineActivity(nodeId, activityType);
    }
  }

  private calculateMessageHash(message: ByzantineMessage): string {
    const hashInput = JSON.stringify({
      senderId: message.senderId,
      timestamp: message.timestamp,
      messageType: message.messageType,
      payload: message.payload,
      nonce: message.nonce,
    });
    
    return require('crypto').createHash('sha256').update(hashInput).digest('hex');
  }

  private verifyDigitalSignature(message: ByzantineMessage, publicKey: string): boolean {
    // Simplified signature verification
    return message.signature.length > 0 && publicKey.length > 0;
  }

  private hasConflictingPrePrepare(key: string, message: ByzantineMessage): boolean {
    const existingMessages = this.messageLog.filter(msg => 
      msg.messageType === 'pre-prepare' && 
      `${this.view}-${msg.payload.sequenceNumber}` === key
    );

    return existingMessages.some(existing => 
      JSON.stringify(existing.payload) !== JSON.stringify(message.payload)
    );
  }

  private async sendPrepareMessage(originalMessage: ByzantineMessage): Promise<void> {
    const prepareMessage: ByzantineMessage = {
      messageId: this.generateMessageId(),
      senderId: this.config.nodeId,
      timestamp: Date.now(),
      messageType: 'prepare',
      payload: originalMessage.payload,
      signature: this.signMessage(originalMessage.payload),
      nonce: Math.random(),
      hash: '',
    };

    prepareMessage.hash = this.calculateMessageHash(prepareMessage);
    await this.broadcastMessage(prepareMessage);
  }

  private async sendCommitMessage(originalMessage: ByzantineMessage): Promise<void> {
    const commitMessage: ByzantineMessage = {
      messageId: this.generateMessageId(),
      senderId: this.config.nodeId,
      timestamp: Date.now(),
      messageType: 'commit',
      payload: originalMessage.payload,
      signature: this.signMessage(originalMessage.payload),
      nonce: Math.random(),
      hash: '',
    };

    commitMessage.hash = this.calculateMessageHash(commitMessage);
    await this.broadcastMessage(commitMessage);
  }

  private async executeOperation(payload: any): Promise<void> {
    console.log(`✅ Executing operation: ${payload.operation}`);
    // Execute the agreed-upon operation
  }

  private async validateCheckpoint(checkpointData: any): Promise<boolean> {
    // Validate checkpoint integrity
    return true; // Simplified
  }

  private async validateViewChange(message: ByzantineMessage): Promise<boolean> {
    // Validate view change request
    return true; // Simplified
  }

  private async processViewChange(message: ByzantineMessage): Promise<void> {
    this.view++;
    this.primary = this.selectPrimary();
    console.log(`🔄 View changed to ${this.view}, new primary: ${this.primary}`);
  }

  private selectPrimary(): string {
    const nodeIds = Array.from(this.nodes.keys()).filter(id => this.nodes.get(id)!.isTrusted);
    return nodeIds[this.view % nodeIds.length];
  }

  private async removeFromConsensus(nodeId: string): Promise<void> {
    // Remove node from consensus participation
    console.log(`🚫 Removing ${nodeId} from consensus`);
  }

  private async broadcastNodeIsolation(nodeId: string): Promise<void> {
    const isolationMessage: ByzantineMessage = {
      messageId: this.generateMessageId(),
      senderId: this.config.nodeId,
      timestamp: Date.now(),
      messageType: 'node-isolation',
      payload: { isolatedNodeId: nodeId },
      signature: this.signMessage({ isolatedNodeId: nodeId }),
      nonce: Math.random(),
      hash: '',
    };

    isolationMessage.hash = this.calculateMessageHash(isolationMessage);
    await this.broadcastMessage(isolationMessage);
  }

  private async broadcastMessage(message: ByzantineMessage): Promise<void> {
    // Broadcast to all trusted nodes
    const trustedNodes = Array.from(this.nodes.values()).filter(node => node.isTrusted);
    
    const promises = trustedNodes.map(async (node) => {
      try {
        await this.sendMessageToNode(node, message);
      } catch (error) {
        console.error(`❌ Failed to send message to ${node.id}:`, error);
      }
    });

    await Promise.allSettled(promises);
    this.messageLog.push(message);
  }

  private async sendMessageToNode(node: ByzantineNode, message: ByzantineMessage): Promise<void> {
    // Simulate sending message to node
    console.log(`📤 Sending ${message.messageType} to ${node.id}`);
  }

  private signMessage(payload: any): string {
    // Simplified message signing
    return require('crypto').createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async logByzantineActivity(nodeId: string, activity: string): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      nodeId,
      activity,
      view: this.view,
      evidence: this.gatherEvidence(nodeId),
    };

    console.log(`📝 Audit log: ${JSON.stringify(logEntry)}`);
  }

  private gatherEvidence(nodeId: string): any {
    const nodeMessages = this.messageLog.filter(msg => msg.senderId === nodeId);
    const suspiciousCount = this.suspiciousActivity.get(nodeId) || 0;
    
    return {
      messageCount: nodeMessages.length,
      suspiciousActivities: suspiciousCount,
      lastMessage: nodeMessages[nodeMessages.length - 1]?.timestamp,
    };
  }
}

export class ByzantineFaultDetector {
  private protocol: PBFTProtocol;
  private config: BFTConfig;
  private detectionMetrics: DetectionMetrics;

  constructor(protocol: PBFTProtocol, config: BFTConfig) {
    this.protocol = protocol;
    this.config = config;
    this.detectionMetrics = new DetectionMetrics();
    
    this.startContinuousMonitoring();
  }

  private startContinuousMonitoring(): void {
    setInterval(async () => {
      await this.performDetectionRound();
    }, 30000); // Check every 30 seconds
  }

  private async performDetectionRound(): Promise<void> {
    console.log('🔍 Performing Byzantine fault detection round');
    
    const nodes = Array.from(this.protocol['nodes'].keys());
    const detectionPromises = nodes.map(nodeId => this.protocol.detectByzantineNode(nodeId));
    
    const results = await Promise.allSettled(detectionPromises);
    const byzantineNodes = results
      .map((result, index) => ({ nodeId: nodes[index], isByzantine: result.status === 'fulfilled' && result.value }))
      .filter(result => result.isByzantine)
      .map(result => result.nodeId);

    if (byzantineNodes.length > 0) {
      this.detectionMetrics.recordDetection(byzantineNodes.length);
      console.log(`🚨 Detected ${byzantineNodes.length} Byzantine nodes: ${byzantineNodes.join(', ')}`);
    }
  }

  getDetectionMetrics(): any {
    return this.detectionMetrics.getMetrics();
  }
}

export class DetectionMetrics {
  private metrics = {
    detectionsCount: 0,
    totalByzantineNodes: 0,
    falsePositives: 0,
    detectionAccuracy: 0,
    lastDetection: null as Date | null,
  };

  recordDetection(byzantineCount: number): void {
    this.metrics.detectionsCount++;
    this.metrics.totalByzantineNodes += byzantineCount;
    this.metrics.lastDetection = new Date();
    this.updateAccuracy();
  }

  recordFalsePositive(): void {
    this.metrics.falsePositives++;
    this.updateAccuracy();
  }

  private updateAccuracy(): void {
    const totalDetections = this.metrics.detectionsCount + this.metrics.falsePositives;
    this.metrics.detectionAccuracy = totalDetections > 0 
      ? this.metrics.detectionsCount / totalDetections 
      : 0;
  }

  getMetrics(): any {
    return { ...this.metrics };
  }
}

export class HealthcareBFTManager {
  private protocol: PBFTProtocol;
  private detector: ByzantineFaultDetector;
  private config: BFTConfig;

  constructor(config: BFTConfig, nodes: ByzantineNode[]) {
    this.config = config;
    this.protocol = new PBFTProtocol(config, nodes);
    this.detector = new ByzantineFaultDetector(this.protocol, config);
  }

  async processHealthcareTransaction(transaction: any): Promise<boolean> {
    console.log(`🏥 Processing healthcare transaction: ${transaction.type}`);
    
    const message: ByzantineMessage = {
      messageId: this.generateMessageId(),
      senderId: this.config.nodeId,
      timestamp: Date.now(),
      messageType: 'healthcare-transaction',
      payload: transaction,
      signature: this.signTransaction(transaction),
      nonce: Math.random(),
      hash: '',
    };

    message.hash = this.calculateMessageHash(message);
    
    return this.protocol.processMessage(message);
  }

  async validateMedicalRecord(recordData: any): Promise<boolean> {
    // Use BFT consensus to validate critical medical records
    const validationMessage: ByzantineMessage = {
      messageId: this.generateMessageId(),
      senderId: this.config.nodeId,
      timestamp: Date.now(),
      messageType: 'medical-record-validation',
      payload: recordData,
      signature: this.signTransaction(recordData),
      nonce: Math.random(),
      hash: '',
    };

    validationMessage.hash = this.calculateMessageHash(validationMessage);
    
    return this.protocol.processMessage(validationMessage);
  }

  getBFTStatus(): BFTStatus {
    const detectionMetrics = this.detector.getDetectionMetrics();
    
    return {
      isOperational: true,
      maxFaultyNodes: this.config.maxFaultyNodes,
      currentFaultyNodes: detectionMetrics.totalByzantineNodes,
      canTolerateMoreFaults: detectionMetrics.totalByzantineNodes < this.config.maxFaultyNodes,
      detectionAccuracy: detectionMetrics.detectionAccuracy,
      lastDetection: detectionMetrics.lastDetection,
    };
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private signTransaction(transaction: any): string {
    return require('crypto').createHash('sha256').update(JSON.stringify(transaction)).digest('hex');
  }

  private calculateMessageHash(message: ByzantineMessage): string {
    const hashInput = JSON.stringify({
      senderId: message.senderId,
      timestamp: message.timestamp,
      messageType: message.messageType,
      payload: message.payload,
      nonce: message.nonce,
    });
    
    return require('crypto').createHash('sha256').update(hashInput).digest('hex');
  }
}

interface BFTStatus {
  isOperational: boolean;
  maxFaultyNodes: number;
  currentFaultyNodes: number;
  canTolerateMoreFaults: boolean;
  detectionAccuracy: number;
  lastDetection: Date | null;
}
