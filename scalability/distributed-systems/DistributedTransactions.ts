/**
 * Distributed Transactions Implementation
 * Healthcare Claims Processing System - Distributed Systems
 */

export interface TransactionContext {
  transactionId: string;
  participantIds: string[];
  coordinatorId: string;
  status: 'active' | 'preparing' | 'prepared' | 'committed' | 'aborted';
  startTime: number;
  timeout: number;
  isolationLevel: 'read_uncommitted' | 'read_committed' | 'repeatable_read' | 'serializable';
  operations: TransactionOperation[];
}

export interface TransactionOperation {
  operationId: string;
  participantId: string;
  type: 'read' | 'write' | 'delete';
  resource: string;
  data?: any;
  timestamp: number;
  status: 'pending' | 'executed' | 'committed' | 'aborted';
}

export interface TwoPCMessage {
  type: 'prepare' | 'prepare_response' | 'commit' | 'abort' | 'ack';
  transactionId: string;
  participantId: string;
  coordinatorId: string;
  vote?: 'yes' | 'no';
  timestamp: number;
}

export interface Participant {
  id: string;
  endpoint: string;
  isHealthy: boolean;
  lastHeartbeat: Date;
  pendingTransactions: Set<string>;
}

export interface TransactionConfig {
  coordinatorId: string;
  participants: Participant[];
  timeoutMs: number;
  maxRetries: number;
  enableSagas: boolean;
  logDirectory: string;
}

export abstract class DistributedTransaction {
  protected context: TransactionContext;
  protected config: TransactionConfig;

  constructor(context: TransactionContext, config: TransactionConfig) {
    this.context = context;
    this.config = config;
  }

  abstract prepare(): Promise<boolean>;
  abstract commit(): Promise<boolean>;
  abstract abort(): Promise<boolean>;
}

export class TwoPhaseCommitTransaction extends DistributedTransaction {
  private participants: Map<string, Participant> = new Map();
  private votes: Map<string, 'yes' | 'no'> = new Map();
  private logger: TransactionLogger;

  constructor(context: TransactionContext, config: TransactionConfig) {
    super(context, config);
    config.participants.forEach(p => this.participants.set(p.id, p));
    this.logger = new TransactionLogger(config.logDirectory);
  }

  async prepare(): Promise<boolean> {
    console.log(`🔄 Starting 2PC prepare phase for transaction ${this.context.transactionId}`);
    
    this.context.status = 'preparing';
    await this.logger.logTransaction(this.context);

    // Send prepare messages to all participants
    const preparePromises = Array.from(this.participants.values()).map(async (participant) => {
      return this.sendPrepareMessage(participant);
    });

    try {
      const results = await Promise.allSettled(preparePromises);
      const failedParticipants = results.filter(r => r.status === 'rejected').length;

      if (failedParticipants > 0) {
        console.warn(`⚠️ ${failedParticipants} participants failed during prepare phase`);
        await this.abort();
        return false;
      }

      // Check if all participants voted YES
      const allVotesYes = Array.from(this.votes.values()).every(vote => vote === 'yes');
      
      if (allVotesYes) {
        this.context.status = 'prepared';
        await this.logger.logTransaction(this.context);
        return true;
      } else {
        console.log(`❌ Not all participants voted YES, aborting transaction`);
        await this.abort();
        return false;
      }
    } catch (error) {
      console.error(`❌ Error during prepare phase:`, error);
      await this.abort();
      return false;
    }
  }

  async commit(): Promise<boolean> {
    if (this.context.status !== 'prepared') {
      throw new Error('Transaction must be prepared before commit');
    }

    console.log(`✅ Starting 2PC commit phase for transaction ${this.context.transactionId}`);
    
    this.context.status = 'committed';
    await this.logger.logTransaction(this.context);

    // Send commit messages to all participants
    const commitPromises = Array.from(this.participants.values()).map(async (participant) => {
      return this.sendCommitMessage(participant);
    });

    try {
      await Promise.allSettled(commitPromises);
      console.log(`✅ Transaction ${this.context.transactionId} committed successfully`);
      return true;
    } catch (error) {
      console.error(`❌ Error during commit phase:`, error);
      // In 2PC, commit phase failures are handled by recovery mechanisms
      return false;
    }
  }

  async abort(): Promise<boolean> {
    console.log(`❌ Aborting transaction ${this.context.transactionId}`);
    
    this.context.status = 'aborted';
    await this.logger.logTransaction(this.context);

    // Send abort messages to all participants
    const abortPromises = Array.from(this.participants.values()).map(async (participant) => {
      return this.sendAbortMessage(participant);
    });

    try {
      await Promise.allSettled(abortPromises);
      console.log(`🔄 Transaction ${this.context.transactionId} aborted successfully`);
      return true;
    } catch (error) {
      console.error(`❌ Error during abort phase:`, error);
      return false;
    }
  }

  private async sendPrepareMessage(participant: Participant): Promise<void> {
    const message: TwoPCMessage = {
      type: 'prepare',
      transactionId: this.context.transactionId,
      participantId: participant.id,
      coordinatorId: this.config.coordinatorId,
      timestamp: Date.now(),
    };

    const response = await this.sendMessage(participant, message);
    
    if (response && response.vote) {
      this.votes.set(participant.id, response.vote);
    } else {
      throw new Error(`No response from participant ${participant.id}`);
    }
  }

  private async sendCommitMessage(participant: Participant): Promise<void> {
    const message: TwoPCMessage = {
      type: 'commit',
      transactionId: this.context.transactionId,
      participantId: participant.id,
      coordinatorId: this.config.coordinatorId,
      timestamp: Date.now(),
    };

    await this.sendMessage(participant, message);
  }

  private async sendAbortMessage(participant: Participant): Promise<void> {
    const message: TwoPCMessage = {
      type: 'abort',
      transactionId: this.context.transactionId,
      participantId: participant.id,
      coordinatorId: this.config.coordinatorId,
      timestamp: Date.now(),
    };

    await this.sendMessage(participant, message);
  }

  private async sendMessage(participant: Participant, message: TwoPCMessage): Promise<TwoPCMessage | null> {
    try {
      console.log(`📨 Sending ${message.type} to participant ${participant.id}`);
      
      // Simulate network call to participant
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Simulate response
      return {
        type: 'prepare_response',
        transactionId: message.transactionId,
        participantId: participant.id,
        coordinatorId: this.config.coordinatorId,
        vote: Math.random() > 0.1 ? 'yes' : 'no', // 90% success rate
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error(`❌ Failed to send message to ${participant.id}:`, error);
      throw error;
    }
  }
}

export class SagaTransaction extends DistributedTransaction {
  private compensationActions: Map<string, () => Promise<void>> = new Map();
  private executedSteps: string[] = [];

  async prepare(): Promise<boolean> {
    // Sagas don't have a prepare phase
    return true;
  }

  async commit(): Promise<boolean> {
    console.log(`🔄 Executing Saga transaction ${this.context.transactionId}`);
    
    try {
      for (const operation of this.context.operations) {
        await this.executeStep(operation);
        this.executedSteps.push(operation.operationId);
      }
      
      this.context.status = 'committed';
      console.log(`✅ Saga transaction ${this.context.transactionId} completed successfully`);
      return true;
    } catch (error) {
      console.error(`❌ Saga transaction failed, starting compensation:`, error);
      await this.compensate();
      return false;
    }
  }

  async abort(): Promise<boolean> {
    return this.compensate();
  }

  private async executeStep(operation: TransactionOperation): Promise<void> {
    console.log(`🔄 Executing step ${operation.operationId}`);
    
    switch (operation.type) {
      case 'write':
        await this.executeWrite(operation);
        break;
      case 'delete':
        await this.executeDelete(operation);
        break;
      default:
        throw new Error(`Unsupported operation type: ${operation.type}`);
    }
    
    operation.status = 'executed';
  }

  private async executeWrite(operation: TransactionOperation): Promise<void> {
    // Execute the write operation
    console.log(`✍️ Writing to ${operation.resource}`);
    
    // Register compensation action
    this.compensationActions.set(operation.operationId, async () => {
      console.log(`🔙 Compensating write operation ${operation.operationId}`);
      // Implement compensation logic (e.g., delete or revert)
    });
  }

  private async executeDelete(operation: TransactionOperation): Promise<void> {
    // Execute the delete operation
    console.log(`🗑️ Deleting from ${operation.resource}`);
    
    // Register compensation action
    this.compensationActions.set(operation.operationId, async () => {
      console.log(`🔙 Compensating delete operation ${operation.operationId}`);
      // Implement compensation logic (e.g., restore deleted data)
    });
  }

  private async compensate(): Promise<boolean> {
    console.log(`🔙 Starting compensation for transaction ${this.context.transactionId}`);
    
    // Execute compensation actions in reverse order
    const reversedSteps = [...this.executedSteps].reverse();
    
    for (const stepId of reversedSteps) {
      const compensationAction = this.compensationActions.get(stepId);
      if (compensationAction) {
        try {
          await compensationAction();
        } catch (error) {
          console.error(`❌ Compensation failed for step ${stepId}:`, error);
          // Continue with other compensations
        }
      }
    }
    
    this.context.status = 'aborted';
    console.log(`🔄 Transaction ${this.context.transactionId} compensated`);
    return true;
  }
}

export class TransactionCoordinator {
  private config: TransactionConfig;
  private activeTransactions: Map<string, DistributedTransaction> = new Map();
  private logger: TransactionLogger;

  constructor(config: TransactionConfig) {
    this.config = config;
    this.logger = new TransactionLogger(config.logDirectory);
    this.startRecoveryProcess();
  }

  async beginTransaction(
    participantIds: string[],
    operations: TransactionOperation[],
    type: '2PC' | 'saga' = '2PC'
  ): Promise<string> {
    const transactionId = this.generateTransactionId();
    
    const context: TransactionContext = {
      transactionId,
      participantIds,
      coordinatorId: this.config.coordinatorId,
      status: 'active',
      startTime: Date.now(),
      timeout: this.config.timeoutMs,
      isolationLevel: 'read_committed',
      operations,
    };

    let transaction: DistributedTransaction;
    
    switch (type) {
      case '2PC':
        transaction = new TwoPhaseCommitTransaction(context, this.config);
        break;
      case 'saga':
        transaction = new SagaTransaction(context, this.config);
        break;
      default:
        throw new Error(`Unsupported transaction type: ${type}`);
    }

    this.activeTransactions.set(transactionId, transaction);
    await this.logger.logTransaction(context);

    console.log(`🚀 Started ${type} transaction ${transactionId}`);
    return transactionId;
  }

  async commitTransaction(transactionId: string): Promise<boolean> {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    try {
      const prepared = await transaction.prepare();
      if (prepared) {
        const committed = await transaction.commit();
        if (committed) {
          this.activeTransactions.delete(transactionId);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error(`❌ Error committing transaction ${transactionId}:`, error);
      await transaction.abort();
      this.activeTransactions.delete(transactionId);
      return false;
    }
  }

  async abortTransaction(transactionId: string): Promise<boolean> {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    try {
      const aborted = await transaction.abort();
      this.activeTransactions.delete(transactionId);
      return aborted;
    } catch (error) {
      console.error(`❌ Error aborting transaction ${transactionId}:`, error);
      return false;
    }
  }

  private generateTransactionId(): string {
    return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private startRecoveryProcess(): void {
    // Recovery process for handling coordinator failures
    setInterval(async () => {
      await this.recoverTransactions();
    }, 30000); // Check every 30 seconds
  }

  private async recoverTransactions(): Promise<void> {
    // Implement transaction recovery logic
    console.log(`🔍 Checking for transactions to recover`);
    
    for (const [transactionId, transaction] of this.activeTransactions.entries()) {
      const context = (transaction as any).context as TransactionContext;
      const elapsed = Date.now() - context.startTime;
      
      if (elapsed > context.timeout) {
        console.warn(`⏰ Transaction ${transactionId} timed out, aborting`);
        await this.abortTransaction(transactionId);
      }
    }
  }
}

export class TransactionParticipant {
  private participantId: string;
  private resources: Map<string, any> = new Map();
  private locks: Map<string, string> = new Map(); // resource -> transactionId
  private preparedTransactions: Set<string> = new Set();

  constructor(participantId: string) {
    this.participantId = participantId;
  }

  async handlePrepare(message: TwoPCMessage): Promise<TwoPCMessage> {
    console.log(`📥 Participant ${this.participantId} received prepare for ${message.transactionId}`);
    
    try {
      // Check if we can prepare (acquire locks, validate operations, etc.)
      const canPrepare = await this.canPrepare(message.transactionId);
      
      if (canPrepare) {
        this.preparedTransactions.add(message.transactionId);
        await this.acquireLocks(message.transactionId);
        
        return {
          type: 'prepare_response',
          transactionId: message.transactionId,
          participantId: this.participantId,
          coordinatorId: message.coordinatorId,
          vote: 'yes',
          timestamp: Date.now(),
        };
      } else {
        return {
          type: 'prepare_response',
          transactionId: message.transactionId,
          participantId: this.participantId,
          coordinatorId: message.coordinatorId,
          vote: 'no',
          timestamp: Date.now(),
        };
      }
    } catch (error) {
      console.error(`❌ Error during prepare:`, error);
      return {
        type: 'prepare_response',
        transactionId: message.transactionId,
        participantId: this.participantId,
        coordinatorId: message.coordinatorId,
        vote: 'no',
        timestamp: Date.now(),
      };
    }
  }

  async handleCommit(message: TwoPCMessage): Promise<void> {
    console.log(`📥 Participant ${this.participantId} received commit for ${message.transactionId}`);
    
    if (this.preparedTransactions.has(message.transactionId)) {
      await this.commitChanges(message.transactionId);
      await this.releaseLocks(message.transactionId);
      this.preparedTransactions.delete(message.transactionId);
      
      console.log(`✅ Participant ${this.participantId} committed transaction ${message.transactionId}`);
    } else {
      console.warn(`⚠️ Received commit for unprepared transaction ${message.transactionId}`);
    }
  }

  async handleAbort(message: TwoPCMessage): Promise<void> {
    console.log(`📥 Participant ${this.participantId} received abort for ${message.transactionId}`);
    
    await this.rollbackChanges(message.transactionId);
    await this.releaseLocks(message.transactionId);
    this.preparedTransactions.delete(message.transactionId);
    
    console.log(`🔄 Participant ${this.participantId} aborted transaction ${message.transactionId}`);
  }

  private async canPrepare(transactionId: string): Promise<boolean> {
    // Check resource availability, constraints, etc.
    return Math.random() > 0.1; // 90% success rate
  }

  private async acquireLocks(transactionId: string): Promise<void> {
    // Acquire necessary locks for the transaction
    console.log(`🔒 Acquiring locks for transaction ${transactionId}`);
  }

  private async releaseLocks(transactionId: string): Promise<void> {
    // Release all locks held by the transaction
    console.log(`🔓 Releasing locks for transaction ${transactionId}`);
    
    for (const [resource, lockOwner] of this.locks.entries()) {
      if (lockOwner === transactionId) {
        this.locks.delete(resource);
      }
    }
  }

  private async commitChanges(transactionId: string): Promise<void> {
    // Commit all changes made by the transaction
    console.log(`💾 Committing changes for transaction ${transactionId}`);
  }

  private async rollbackChanges(transactionId: string): Promise<void> {
    // Rollback all changes made by the transaction
    console.log(`🔄 Rolling back changes for transaction ${transactionId}`);
  }
}

export class TransactionLogger {
  private logDirectory: string;

  constructor(logDirectory: string) {
    this.logDirectory = logDirectory;
  }

  async logTransaction(context: TransactionContext): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      transactionId: context.transactionId,
      status: context.status,
      participantIds: context.participantIds,
      coordinatorId: context.coordinatorId,
      operations: context.operations,
    };

    // In a real implementation, this would write to persistent storage
    console.log(`📝 Logging transaction: ${JSON.stringify(logEntry)}`);
  }

  async recoverTransactions(): Promise<TransactionContext[]> {
    // In a real implementation, this would read from persistent storage
    console.log(`📖 Recovering transactions from log`);
    return [];
  }
}

export class HealthcareTransactionManager {
  private coordinator: TransactionCoordinator;

  constructor(config: TransactionConfig) {
    this.coordinator = new TransactionCoordinator(config);
  }

  async processClaimSubmission(claimData: any): Promise<boolean> {
    const operations: TransactionOperation[] = [
      {
        operationId: 'validate_patient',
        participantId: 'patient_service',
        type: 'read',
        resource: `patient:${claimData.patientId}`,
        timestamp: Date.now(),
        status: 'pending',
      },
      {
        operationId: 'validate_policy',
        participantId: 'policy_service',
        type: 'read',
        resource: `policy:${claimData.policyId}`,
        timestamp: Date.now(),
        status: 'pending',
      },
      {
        operationId: 'create_claim',
        participantId: 'claims_service',
        type: 'write',
        resource: `claim:${claimData.claimId}`,
        data: claimData,
        timestamp: Date.now(),
        status: 'pending',
      },
      {
        operationId: 'update_statistics',
        participantId: 'analytics_service',
        type: 'write',
        resource: `stats:claims`,
        data: { increment: 1 },
        timestamp: Date.now(),
        status: 'pending',
      },
    ];

    const transactionId = await this.coordinator.beginTransaction(
      ['patient_service', 'policy_service', 'claims_service', 'analytics_service'],
      operations,
      '2PC'
    );

    return this.coordinator.commitTransaction(transactionId);
  }

  async processPayment(paymentData: any): Promise<boolean> {
    const operations: TransactionOperation[] = [
      {
        operationId: 'validate_claim',
        participantId: 'claims_service',
        type: 'read',
        resource: `claim:${paymentData.claimId}`,
        timestamp: Date.now(),
        status: 'pending',
      },
      {
        operationId: 'process_payment',
        participantId: 'payment_service',
        type: 'write',
        resource: `payment:${paymentData.paymentId}`,
        data: paymentData,
        timestamp: Date.now(),
        status: 'pending',
      },
      {
        operationId: 'update_claim_status',
        participantId: 'claims_service',
        type: 'write',
        resource: `claim:${paymentData.claimId}`,
        data: { status: 'paid' },
        timestamp: Date.now(),
        status: 'pending',
      },
    ];

    const transactionId = await this.coordinator.beginTransaction(
      ['claims_service', 'payment_service'],
      operations,
      'saga' // Use saga for payment processing
    );

    return this.coordinator.commitTransaction(transactionId);
  }
}
