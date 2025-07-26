// Core Types
export * from './types';

// Base Classes
export * from './base/AggregateRoot';

// Event Store
export * from './store/EventStore';
export * from './store/EventStoreRepository';
export * from './store/SnapshotStore';

// Patterns
export * from './patterns/AggregateRepository';

// Serialization
export * from './serialization/EventSerializer';

// CQRS
export * from './cqrs/CommandBus';
export * from './cqrs/QueryBus';
export * from './cqrs/Projection';

// Event Replay
export * from './replay/EventReplay';

// Versioning
export * from './versioning/EventVersionManager';

// Saga
export * from './saga/SagaManager';

// Monitoring
export * from './monitoring/EventMonitor';

// Main Event Sourcing Framework
import { EventStore } from './store/EventStore';
import { MongoEventStoreRepository } from './store/EventStoreRepository';
import { MongoSnapshotStore } from './store/SnapshotStore';
import { JsonEventSerializer } from './serialization/EventSerializer';
import { EventVersionManager } from './versioning/EventVersionManager';
import { InMemoryCommandBus } from './cqrs/CommandBus';
import { InMemoryQueryBus } from './cqrs/QueryBus';
import { ProjectionManager } from './cqrs/Projection';
import { EventReplayEngine } from './replay/EventReplay';
import { SagaManager, InMemorySagaRepository, SimpleSagaTimeoutManager } from './saga/SagaManager';
import { ComprehensiveEventMonitor, AlertManager, DEFAULT_ALERT_RULES } from './monitoring/EventMonitor';
import pino from 'pino';

export interface EventSourcingConfig {
  mongodb: {
    connectionString: string;
    databaseName: string;
  };
  eventStore: {
    batchSize?: number;
    snapshotFrequency?: number;
    retentionPeriod?: number;
    compressionEnabled?: boolean;
    encryptionEnabled?: boolean;
  };
  monitoring: {
    enabled?: boolean;
    alertsEnabled?: boolean;
  };
  replay: {
    enabled?: boolean;
  };
  sagas: {
    enabled?: boolean;
  };
}

export class EventSourcingFramework {
  private readonly logger = pino({ name: 'EventSourcingFramework' });
  
  public readonly eventStore: EventStore;
  public readonly commandBus: InMemoryCommandBus;
  public readonly queryBus: InMemoryQueryBus;
  public readonly projectionManager: ProjectionManager;
  public readonly replayEngine: EventReplayEngine;
  public readonly sagaManager: SagaManager;
  public readonly monitor: ComprehensiveEventMonitor;
  public readonly alertManager: AlertManager;

  private isInitialized = false;

  constructor(private readonly config: EventSourcingConfig) {
    // Initialize repositories
    const eventStoreRepository = new MongoEventStoreRepository(
      config.mongodb.connectionString,
      config.mongodb.databaseName
    );
    
    const snapshotStore = new MongoSnapshotStore(
      config.mongodb.connectionString,
      config.mongodb.databaseName
    );

    // Initialize serialization and versioning
    const serializer = new JsonEventSerializer();
    const versionManager = new EventVersionManager();

    // Initialize event store
    this.eventStore = new EventStore(
      eventStoreRepository,
      snapshotStore,
      serializer,
      versionManager,
      config.eventStore
    );

    // Initialize CQRS components
    this.commandBus = new InMemoryCommandBus();
    this.queryBus = new InMemoryQueryBus();
    this.projectionManager = new ProjectionManager();

    // Initialize replay engine
    this.replayEngine = new EventReplayEngine(this.eventStore);

    // Initialize saga management
    const sagaRepository = new InMemorySagaRepository();
    const commandSender = {
      send: async (command: any) => this.commandBus.send(command)
    };
    const timeoutManager = new SimpleSagaTimeoutManager(this.sagaManager);
    this.sagaManager = new SagaManager(sagaRepository, commandSender, timeoutManager);

    // Initialize monitoring
    this.monitor = new ComprehensiveEventMonitor(
      this.eventStore,
      this.projectionManager,
      this.sagaManager
    );

    this.alertManager = new AlertManager();
    
    // Add default alert rules
    DEFAULT_ALERT_RULES.forEach(rule => this.alertManager.addRule(rule));
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.logger.info('Initializing Event Sourcing Framework...');

      // Initialize event store
      await this.eventStore.initialize();

      // Initialize monitoring if enabled
      if (this.config.monitoring.enabled !== false) {
        await this.monitor.start();
        
        if (this.config.monitoring.alertsEnabled !== false) {
          this.setupAlertHandling();
        }
      }

      // Setup event flow
      this.setupEventFlow();

      this.isInitialized = true;
      this.logger.info('Event Sourcing Framework initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Event Sourcing Framework', { error });
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      this.logger.info('Shutting down Event Sourcing Framework...');

      // Stop monitoring
      await this.monitor.stop();

      // Stop projections
      await this.projectionManager.stopAll();

      // Shutdown event store
      await this.eventStore.shutdown();

      this.isInitialized = false;
      this.logger.info('Event Sourcing Framework shut down successfully');
    } catch (error) {
      this.logger.error('Failed to shutdown Event Sourcing Framework', { error });
      throw error;
    }
  }

  private setupEventFlow(): void {
    // Connect event store to projections
    this.eventStore.on('event', (event) => {
      // Events are automatically forwarded to projections
    });

    // Connect event store to saga manager
    this.eventStore.on('event', (event) => {
      if (this.config.sagas.enabled !== false) {
        this.sagaManager.handleEvent(event).catch(error => {
          this.logger.error('Failed to handle event in saga manager', { 
            eventId: event.id, 
            error 
          });
        });
      }
    });

    // Connect command bus to saga manager
    this.commandBus.on('command-processed', (command, result) => {
      if (this.config.sagas.enabled !== false) {
        this.sagaManager.handleCommand(command).catch(error => {
          this.logger.error('Failed to handle command in saga manager', { 
            commandId: command.id, 
            error 
          });
        });
      }
    });
  }

  private setupAlertHandling(): void {
    // Check alerts periodically
    setInterval(() => {
      const analytics = this.monitor.getAnalytics();
      const health = this.monitor.getHealthStatus();
      this.alertManager.checkAlerts(analytics, health);
    }, 60000); // Every minute

    // Handle alert events
    this.alertManager.on('alert', (alert) => {
      this.logger[alert.severity === 'critical' ? 'error' : 'warn']('Alert triggered', alert);
      // In production, you would send to external alerting systems
    });
  }
}

// Example usage and utilities

export class ExampleClaimAggregate extends AggregateRoot {
  private status: string = 'draft';
  private amount: number = 0;
  private description: string = '';

  protected registerEventHandlers(): void {
    this.registerEventHandler('ClaimCreated', this.onClaimCreated.bind(this));
    this.registerEventHandler('ClaimAmountUpdated', this.onClaimAmountUpdated.bind(this));
    this.registerEventHandler('ClaimSubmitted', this.onClaimSubmitted.bind(this));
    this.registerEventHandler('ClaimApproved', this.onClaimApproved.bind(this));
    this.registerEventHandler('ClaimRejected', this.onClaimRejected.bind(this));
  }

  public static create(id: string, description: string, amount: number): ExampleClaimAggregate {
    const claim = new ExampleClaimAggregate(id);
    claim.raiseEvent('ClaimCreated', { description, amount });
    return claim;
  }

  public updateAmount(newAmount: number): void {
    if (this.status !== 'draft') {
      throw new Error('Cannot update amount of non-draft claim');
    }

    this.raiseEvent('ClaimAmountUpdated', { 
      oldAmount: this.amount, 
      newAmount 
    });
  }

  public submit(): void {
    if (this.status !== 'draft') {
      throw new Error('Cannot submit non-draft claim');
    }

    this.raiseEvent('ClaimSubmitted', { submittedAt: new Date() });
  }

  public approve(): void {
    if (this.status !== 'submitted') {
      throw new Error('Cannot approve non-submitted claim');
    }

    this.raiseEvent('ClaimApproved', { approvedAt: new Date() });
  }

  public reject(reason: string): void {
    if (this.status !== 'submitted') {
      throw new Error('Cannot reject non-submitted claim');
    }

    this.raiseEvent('ClaimRejected', { reason, rejectedAt: new Date() });
  }

  private onClaimCreated(event: any): void {
    this.status = 'draft';
    this.description = event.eventData.description;
    this.amount = event.eventData.amount;
  }

  private onClaimAmountUpdated(event: any): void {
    this.amount = event.eventData.newAmount;
  }

  private onClaimSubmitted(event: any): void {
    this.status = 'submitted';
  }

  private onClaimApproved(event: any): void {
    this.status = 'approved';
  }

  private onClaimRejected(event: any): void {
    this.status = 'rejected';
  }

  public getStatus(): string {
    return this.status;
  }

  public getAmount(): number {
    return this.amount;
  }

  public getDescription(): string {
    return this.description;
  }

  protected getSnapshot(): Record<string, any> {
    return {
      ...super.getSnapshot(),
      status: this.status,
      amount: this.amount,
      description: this.description
    };
  }

  protected loadFromSnapshot(snapshot: Record<string, any>): void {
    super.loadFromSnapshot(snapshot);
    this.status = snapshot.status;
    this.amount = snapshot.amount;
    this.description = snapshot.description;
  }
}

// Example command handlers

export class CreateClaimCommandHandler extends BaseCommandHandler<any> {
  constructor(private readonly claimRepository: any) {
    super();
  }

  public getCommandType(): string {
    return 'CreateClaim';
  }

  public async handle(command: any): Promise<string> {
    const claim = ExampleClaimAggregate.create(
      command.aggregateId,
      command.payload.description,
      command.payload.amount
    );

    await this.claimRepository.save(claim);
    return claim.getId();
  }
}

// Example projection

export class ClaimSummaryProjection extends BaseProjection {
  private readonly claimSummaries = new Map<string, any>();

  public getName(): string {
    return 'ClaimSummaryProjection';
  }

  public canHandle(event: any): boolean {
    return event.aggregateType === 'ExampleClaimAggregate';
  }

  public async handle(event: any): Promise<void> {
    switch (event.eventType) {
      case 'ClaimCreated':
        await this.handleClaimCreated(event);
        break;
      case 'ClaimAmountUpdated':
        await this.handleClaimAmountUpdated(event);
        break;
      case 'ClaimSubmitted':
        await this.handleClaimSubmitted(event);
        break;
      case 'ClaimApproved':
        await this.handleClaimApproved(event);
        break;
      case 'ClaimRejected':
        await this.handleClaimRejected(event);
        break;
    }
  }

  protected async initializeProjection(): Promise<void> {
    // Initialize projection storage
    this.logger.info('ClaimSummaryProjection initialized');
  }

  protected async resetProjection(): Promise<void> {
    this.claimSummaries.clear();
    this.logger.info('ClaimSummaryProjection reset');
  }

  private async handleClaimCreated(event: any): Promise<void> {
    this.claimSummaries.set(event.aggregateId, {
      id: event.aggregateId,
      description: event.eventData.description,
      amount: event.eventData.amount,
      status: 'draft',
      createdAt: event.timestamp,
      updatedAt: event.timestamp
    });
  }

  private async handleClaimAmountUpdated(event: any): Promise<void> {
    const summary = this.claimSummaries.get(event.aggregateId);
    if (summary) {
      summary.amount = event.eventData.newAmount;
      summary.updatedAt = event.timestamp;
    }
  }

  private async handleClaimSubmitted(event: any): Promise<void> {
    const summary = this.claimSummaries.get(event.aggregateId);
    if (summary) {
      summary.status = 'submitted';
      summary.submittedAt = event.timestamp;
      summary.updatedAt = event.timestamp;
    }
  }

  private async handleClaimApproved(event: any): Promise<void> {
    const summary = this.claimSummaries.get(event.aggregateId);
    if (summary) {
      summary.status = 'approved';
      summary.approvedAt = event.timestamp;
      summary.updatedAt = event.timestamp;
    }
  }

  private async handleClaimRejected(event: any): Promise<void> {
    const summary = this.claimSummaries.get(event.aggregateId);
    if (summary) {
      summary.status = 'rejected';
      summary.rejectedAt = event.timestamp;
      summary.updatedAt = event.timestamp;
    }
  }

  public getClaimSummaries(): any[] {
    return Array.from(this.claimSummaries.values());
  }
}

// Factory function for easy setup

export function createEventSourcingFramework(config: EventSourcingConfig): EventSourcingFramework {
  return new EventSourcingFramework(config);
}

// Default configuration

export const DEFAULT_CONFIG: EventSourcingConfig = {
  mongodb: {
    connectionString: 'mongodb://localhost:27017',
    databaseName: 'eventstore'
  },
  eventStore: {
    batchSize: 100,
    snapshotFrequency: 50,
    retentionPeriod: 365 * 24 * 60 * 60 * 1000, // 1 year
    compressionEnabled: true,
    encryptionEnabled: false
  },
  monitoring: {
    enabled: true,
    alertsEnabled: true
  },
  replay: {
    enabled: true
  },
  sagas: {
    enabled: true
  }
};
