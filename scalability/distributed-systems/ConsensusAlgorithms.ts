/**
 * Consensus Algorithms Implementation
 * Healthcare Claims Processing System - Distributed Systems
 */

export interface Node {
  id: string;
  address: string;
  port: number;
  isLeader: boolean;
  isActive: boolean;
  lastHeartbeat: Date;
  term: number;
  votedFor?: string;
}

export interface LogEntry {
  term: number;
  index: number;
  command: any;
  timestamp: Date;
}

export interface ConsensusMessage {
  type: 'vote_request' | 'vote_response' | 'append_entries' | 'heartbeat';
  term: number;
  candidateId?: string;
  leaderId?: string;
  voteGranted?: boolean;
  entries?: LogEntry[];
  leaderCommit?: number;
  prevLogIndex?: number;
  prevLogTerm?: number;
  success?: boolean;
}

export interface ConsensusConfig {
  nodeId: string;
  peers: Node[];
  electionTimeoutMin: number;
  electionTimeoutMax: number;
  heartbeatInterval: number;
  logRetentionSize: number;
}

export abstract class ConsensusAlgorithm {
  protected config: ConsensusConfig;
  protected currentTerm: number = 0;
  protected votedFor: string | null = null;
  protected log: LogEntry[] = [];
  protected commitIndex: number = 0;
  protected lastApplied: number = 0;
  protected state: 'follower' | 'candidate' | 'leader' = 'follower';
  protected peers: Map<string, Node> = new Map();
  protected leaderId: string | null = null;

  constructor(config: ConsensusConfig) {
    this.config = config;
    config.peers.forEach(peer => this.peers.set(peer.id, peer));
  }

  abstract startElection(): Promise<void>;
  abstract sendHeartbeat(): Promise<void>;
  abstract appendEntries(entries: LogEntry[]): Promise<boolean>;
  abstract handleMessage(message: ConsensusMessage, fromNode: string): Promise<void>;
}

export class RaftConsensus extends ConsensusAlgorithm {
  private electionTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private nextIndex: Map<string, number> = new Map();
  private matchIndex: Map<string, number> = new Map();

  constructor(config: ConsensusConfig) {
    super(config);
    this.resetElectionTimer();
  }

  async startElection(): Promise<void> {
    this.state = 'candidate';
    this.currentTerm++;
    this.votedFor = this.config.nodeId;
    this.resetElectionTimer();

    console.log(`🗳️ Node ${this.config.nodeId} starting election for term ${this.currentTerm}`);

    let votesReceived = 1; // Vote for self
    const majority = Math.floor(this.peers.size / 2) + 1;

    // Send vote requests to all peers
    const votePromises = Array.from(this.peers.values()).map(async (peer) => {
      const lastLogIndex = this.log.length - 1;
      const lastLogTerm = this.log[lastLogIndex]?.term || 0;

      const voteRequest: ConsensusMessage = {
        type: 'vote_request',
        term: this.currentTerm,
        candidateId: this.config.nodeId,
        prevLogIndex: lastLogIndex,
        prevLogTerm: lastLogTerm,
      };

      try {
        const response = await this.sendMessage(peer, voteRequest);
        if (response.voteGranted && response.term === this.currentTerm) {
          votesReceived++;
        }
      } catch (error) {
        console.error(`❌ Failed to get vote from ${peer.id}:`, error);
      }
    });

    await Promise.allSettled(votePromises);

    if (votesReceived >= majority && this.state === 'candidate') {
      this.becomeLeader();
    } else {
      this.becomeFollower();
    }
  }

  private becomeLeader(): void {
    console.log(`👑 Node ${this.config.nodeId} became leader for term ${this.currentTerm}`);
    
    this.state = 'leader';
    this.leaderId = this.config.nodeId;
    
    // Initialize leader state
    this.peers.forEach((_, peerId) => {
      this.nextIndex.set(peerId, this.log.length);
      this.matchIndex.set(peerId, 0);
    });

    this.stopElectionTimer();
    this.startHeartbeat();
  }

  private becomeFollower(): void {
    this.state = 'follower';
    this.stopHeartbeatTimer();
    this.resetElectionTimer();
  }

  async sendHeartbeat(): Promise<void> {
    if (this.state !== 'leader') return;

    const heartbeatPromises = Array.from(this.peers.values()).map(async (peer) => {
      const nextIndex = this.nextIndex.get(peer.id) || 0;
      const prevLogIndex = nextIndex - 1;
      const prevLogTerm = this.log[prevLogIndex]?.term || 0;

      const heartbeat: ConsensusMessage = {
        type: 'heartbeat',
        term: this.currentTerm,
        leaderId: this.config.nodeId,
        prevLogIndex,
        prevLogTerm,
        entries: [],
        leaderCommit: this.commitIndex,
      };

      try {
        await this.sendMessage(peer, heartbeat);
      } catch (error) {
        console.error(`❌ Failed to send heartbeat to ${peer.id}:`, error);
      }
    });

    await Promise.allSettled(heartbeatPromises);
  }

  async appendEntries(entries: LogEntry[]): Promise<boolean> {
    if (this.state !== 'leader') {
      throw new Error('Only leader can append entries');
    }

    // Add entries to local log
    entries.forEach(entry => {
      entry.index = this.log.length;
      entry.term = this.currentTerm;
      this.log.push(entry);
    });

    console.log(`📝 Leader ${this.config.nodeId} appending ${entries.length} entries`);

    // Replicate to followers
    let successCount = 1; // Leader counts as success
    const majority = Math.floor(this.peers.size / 2) + 1;

    const replicationPromises = Array.from(this.peers.values()).map(async (peer) => {
      try {
        const success = await this.replicateToFollower(peer, entries);
        if (success) {
          successCount++;
        }
      } catch (error) {
        console.error(`❌ Failed to replicate to ${peer.id}:`, error);
      }
    });

    await Promise.allSettled(replicationPromises);

    if (successCount >= majority) {
      // Update commit index
      this.commitIndex = this.log.length - 1;
      console.log(`✅ Entries committed at index ${this.commitIndex}`);
      return true;
    }

    return false;
  }

  private async replicateToFollower(peer: Node, entries: LogEntry[]): Promise<boolean> {
    const nextIndex = this.nextIndex.get(peer.id) || 0;
    const prevLogIndex = nextIndex - 1;
    const prevLogTerm = this.log[prevLogIndex]?.term || 0;

    const appendMessage: ConsensusMessage = {
      type: 'append_entries',
      term: this.currentTerm,
      leaderId: this.config.nodeId,
      prevLogIndex,
      prevLogTerm,
      entries,
      leaderCommit: this.commitIndex,
    };

    const response = await this.sendMessage(peer, appendMessage);

    if (response.success) {
      this.nextIndex.set(peer.id, nextIndex + entries.length);
      this.matchIndex.set(peer.id, nextIndex + entries.length - 1);
      return true;
    } else {
      // Decrement nextIndex and retry
      this.nextIndex.set(peer.id, Math.max(0, nextIndex - 1));
      return false;
    }
  }

  async handleMessage(message: ConsensusMessage, fromNode: string): Promise<void> {
    // Update term if message has higher term
    if (message.term > this.currentTerm) {
      this.currentTerm = message.term;
      this.votedFor = null;
      this.becomeFollower();
    }

    switch (message.type) {
      case 'vote_request':
        await this.handleVoteRequest(message, fromNode);
        break;
      case 'vote_response':
        await this.handleVoteResponse(message, fromNode);
        break;
      case 'append_entries':
        await this.handleAppendEntries(message, fromNode);
        break;
      case 'heartbeat':
        await this.handleHeartbeat(message, fromNode);
        break;
    }
  }

  private async handleVoteRequest(message: ConsensusMessage, fromNode: string): Promise<void> {
    let voteGranted = false;

    if (message.term >= this.currentTerm &&
        (this.votedFor === null || this.votedFor === message.candidateId)) {
      
      const lastLogIndex = this.log.length - 1;
      const lastLogTerm = this.log[lastLogIndex]?.term || 0;

      // Check if candidate's log is at least as up-to-date
      if (message.prevLogTerm! > lastLogTerm ||
          (message.prevLogTerm === lastLogTerm && message.prevLogIndex! >= lastLogIndex)) {
        voteGranted = true;
        this.votedFor = message.candidateId!;
        this.resetElectionTimer();
      }
    }

    const response: ConsensusMessage = {
      type: 'vote_response',
      term: this.currentTerm,
      voteGranted,
    };

    const peer = this.peers.get(fromNode);
    if (peer) {
      await this.sendMessage(peer, response);
    }
  }

  private async handleVoteResponse(message: ConsensusMessage, fromNode: string): Promise<void> {
    // Handled in startElection method
  }

  private async handleAppendEntries(message: ConsensusMessage, fromNode: string): Promise<void> {
    this.resetElectionTimer();
    this.leaderId = message.leaderId!;

    let success = false;

    if (message.term >= this.currentTerm) {
      // Check if log contains entry at prevLogIndex with prevLogTerm
      const prevLogIndex = message.prevLogIndex!;
      const prevLogTerm = message.prevLogTerm!;

      if (prevLogIndex === -1 ||
          (this.log[prevLogIndex] && this.log[prevLogIndex].term === prevLogTerm)) {
        
        // Remove conflicting entries
        this.log = this.log.slice(0, prevLogIndex + 1);
        
        // Append new entries
        message.entries?.forEach(entry => {
          this.log.push(entry);
        });

        // Update commit index
        if (message.leaderCommit! > this.commitIndex) {
          this.commitIndex = Math.min(message.leaderCommit!, this.log.length - 1);
        }

        success = true;
      }
    }

    const response: ConsensusMessage = {
      type: 'append_entries',
      term: this.currentTerm,
      success,
    };

    const peer = this.peers.get(fromNode);
    if (peer) {
      await this.sendMessage(peer, response);
    }
  }

  private async handleHeartbeat(message: ConsensusMessage, fromNode: string): Promise<void> {
    this.resetElectionTimer();
    this.leaderId = message.leaderId!;
    
    if (message.term >= this.currentTerm) {
      this.becomeFollower();
    }
  }

  private async sendMessage(peer: Node, message: ConsensusMessage): Promise<ConsensusMessage> {
    // In a real implementation, this would send HTTP/TCP message to peer
    console.log(`📨 Sending ${message.type} to ${peer.id}`);
    
    // Simulate network call
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          type: 'vote_response',
          term: this.currentTerm,
          voteGranted: Math.random() > 0.5,
        });
      }, 10);
    });
  }

  private resetElectionTimer(): void {
    this.stopElectionTimer();
    
    const timeout = this.config.electionTimeoutMin + 
      Math.random() * (this.config.electionTimeoutMax - this.config.electionTimeoutMin);
    
    this.electionTimer = setTimeout(() => {
      if (this.state !== 'leader') {
        this.startElection();
      }
    }, timeout);
  }

  private stopElectionTimer(): void {
    if (this.electionTimer) {
      clearTimeout(this.electionTimer);
      this.electionTimer = null;
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeatTimer(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

export class PBFTConsensus {
  private nodeId: string;
  private nodes: Map<string, Node> = new Map();
  private view: number = 0;
  private sequenceNumber: number = 0;
  private primary: string;
  private prepareMessages: Map<string, Set<string>> = new Map();
  private commitMessages: Map<string, Set<string>> = new Map();

  constructor(config: ConsensusConfig) {
    this.nodeId = config.nodeId;
    config.peers.forEach(peer => this.nodes.set(peer.id, peer));
    this.primary = this.selectPrimary();
  }

  async proposeRequest(request: any): Promise<boolean> {
    if (this.nodeId !== this.primary) {
      throw new Error('Only primary can propose requests');
    }

    const message = {
      type: 'pre-prepare',
      view: this.view,
      sequenceNumber: this.sequenceNumber++,
      request,
      digest: this.computeDigest(request),
    };

    console.log(`🎯 Primary ${this.nodeId} proposing request ${message.sequenceNumber}`);

    // Send pre-prepare to all backup nodes
    const responses = await this.broadcastMessage(message);
    
    // Wait for prepare phase
    return this.waitForCommit(message.digest);
  }

  async handlePrePrepare(message: any, fromNode: string): Promise<void> {
    if (fromNode !== this.primary) {
      console.warn(`⚠️ Received pre-prepare from non-primary ${fromNode}`);
      return;
    }

    // Validate message
    if (this.isValidPrePrepare(message)) {
      // Send prepare message
      const prepareMessage = {
        type: 'prepare',
        view: this.view,
        sequenceNumber: message.sequenceNumber,
        digest: message.digest,
        nodeId: this.nodeId,
      };

      await this.broadcastMessage(prepareMessage);
    }
  }

  async handlePrepare(message: any, fromNode: string): Promise<void> {
    const key = `${message.view}-${message.sequenceNumber}-${message.digest}`;
    
    if (!this.prepareMessages.has(key)) {
      this.prepareMessages.set(key, new Set());
    }
    
    this.prepareMessages.get(key)!.add(fromNode);

    // Check if we have enough prepare messages (2f + 1 including self)
    const requiredPrepares = Math.floor((this.nodes.size - 1) / 3) * 2 + 1;
    
    if (this.prepareMessages.get(key)!.size >= requiredPrepares) {
      // Send commit message
      const commitMessage = {
        type: 'commit',
        view: this.view,
        sequenceNumber: message.sequenceNumber,
        digest: message.digest,
        nodeId: this.nodeId,
      };

      await this.broadcastMessage(commitMessage);
    }
  }

  async handleCommit(message: any, fromNode: string): Promise<void> {
    const key = `${message.view}-${message.sequenceNumber}-${message.digest}`;
    
    if (!this.commitMessages.has(key)) {
      this.commitMessages.set(key, new Set());
    }
    
    this.commitMessages.get(key)!.add(fromNode);

    // Check if we have enough commit messages (2f + 1 including self)
    const requiredCommits = Math.floor((this.nodes.size - 1) / 3) * 2 + 1;
    
    if (this.commitMessages.get(key)!.size >= requiredCommits) {
      console.log(`✅ Request ${message.sequenceNumber} committed`);
      // Execute the request
      await this.executeRequest(message.digest);
    }
  }

  private selectPrimary(): string {
    // Simple primary selection based on view number
    const nodeIds = Array.from(this.nodes.keys()).sort();
    return nodeIds[this.view % nodeIds.length];
  }

  private computeDigest(request: any): string {
    return require('crypto').createHash('sha256').update(JSON.stringify(request)).digest('hex');
  }

  private isValidPrePrepare(message: any): boolean {
    // Validate view, sequence number, and message structure
    return message.view === this.view && 
           message.sequenceNumber >= this.sequenceNumber &&
           message.digest === this.computeDigest(message.request);
  }

  private async broadcastMessage(message: any): Promise<any[]> {
    const promises = Array.from(this.nodes.values()).map(async (node) => {
      try {
        return await this.sendMessage(node, message);
      } catch (error) {
        console.error(`❌ Failed to send message to ${node.id}:`, error);
        return null;
      }
    });

    return Promise.all(promises);
  }

  private async sendMessage(node: Node, message: any): Promise<any> {
    // Simulate network call
    console.log(`📨 Sending ${message.type} to ${node.id}`);
    return new Promise(resolve => setTimeout(resolve, 10));
  }

  private async waitForCommit(digest: string): Promise<boolean> {
    return new Promise((resolve) => {
      const checkCommit = () => {
        const commitCount = Array.from(this.commitMessages.values())
          .reduce((count, commits) => count + commits.size, 0);
        
        const required = Math.floor((this.nodes.size - 1) / 3) * 2 + 1;
        
        if (commitCount >= required) {
          resolve(true);
        } else {
          setTimeout(checkCommit, 100);
        }
      };
      
      checkCommit();
    });
  }

  private async executeRequest(digest: string): Promise<void> {
    console.log(`🔄 Executing request with digest ${digest}`);
    // Execute the actual request
  }
}

export class ConsensusManager {
  private algorithm: ConsensusAlgorithm;
  private isActive: boolean = false;

  constructor(type: 'raft' | 'pbft', config: ConsensusConfig) {
    switch (type) {
      case 'raft':
        this.algorithm = new RaftConsensus(config);
        break;
      case 'pbft':
        // PBFT implementation would be instantiated here
        throw new Error('PBFT not fully implemented');
      default:
        throw new Error(`Unsupported consensus algorithm: ${type}`);
    }
  }

  async start(): Promise<void> {
    this.isActive = true;
    console.log(`🚀 Starting consensus algorithm`);
  }

  async stop(): Promise<void> {
    this.isActive = false;
    console.log(`🛑 Stopping consensus algorithm`);
  }

  async propose(command: any): Promise<boolean> {
    if (!this.isActive) {
      throw new Error('Consensus algorithm is not active');
    }

    const entry: LogEntry = {
      term: 0, // Will be set by algorithm
      index: 0, // Will be set by algorithm
      command,
      timestamp: new Date(),
    };

    return this.algorithm.appendEntries([entry]);
  }

  isLeader(): boolean {
    return this.algorithm['state'] === 'leader';
  }

  getLeaderId(): string | null {
    return this.algorithm['leaderId'];
  }
}
