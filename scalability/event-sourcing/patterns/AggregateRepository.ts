import { AggregateRoot, ConcurrencyError, AggregateNotFoundError } from '../base/AggregateRoot';
import { EventStore } from '../store/EventStore';
import { DomainEvent, Snapshot } from '../types';
import pino from 'pino';

export interface Repository<T extends AggregateRoot> {
  getById(id: string): Promise<T>;
  save(aggregate: T): Promise<void>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
}

export abstract class EventSourcedRepository<T extends AggregateRoot> implements Repository<T> {
  protected readonly logger = pino({ name: 'EventSourcedRepository' });
  
  constructor(
    protected readonly eventStore: EventStore,
    protected readonly aggregateType: string
  ) {}

  public async getById(id: string): Promise<T> {
    try {
      // Try to load from snapshot first
      const snapshot = await this.eventStore.getLatestSnapshot(id, this.aggregateType);
      let aggregate: T;
      let fromVersion = 0;

      if (snapshot) {
        aggregate = this.createAggregate(id);
        aggregate.restoreFromSnapshot(snapshot.data);
        fromVersion = snapshot.version + 1;
        
        this.logger.debug('Loaded aggregate from snapshot', {
          aggregateId: id,
          snapshotVersion: snapshot.version
        });
      } else {
        aggregate = this.createAggregate(id);
      }

      // Load events after snapshot
      const events = await this.eventStore.getEvents(id, this.aggregateType, fromVersion);
      
      if (events.length === 0 && !snapshot) {
        throw new AggregateNotFoundError(id, this.aggregateType);
      }

      if (events.length > 0) {
        aggregate.loadFromHistory(events);
        this.logger.debug('Loaded aggregate from events', {
          aggregateId: id,
          eventCount: events.length,
          fromVersion
        });
      }

      return aggregate;
    } catch (error) {
      if (error instanceof AggregateNotFoundError) {
        throw error;
      }
      
      this.logger.error('Failed to load aggregate', { aggregateId: id, error });
      throw new Error(`Failed to load aggregate ${id}: ${error.message}`);
    }
  }

  public async save(aggregate: T): Promise<void> {
    const uncommittedEvents = aggregate.getUncommittedEvents();
    
    if (uncommittedEvents.length === 0) {
      return;
    }

    try {
      const expectedVersion = aggregate.getVersion() - uncommittedEvents.length;
      
      await this.eventStore.saveEvents(
        aggregate.getId(),
        uncommittedEvents,
        expectedVersion
      );

      // Clear uncommitted events
      aggregate.clearUncommittedEvents();

      // Create snapshot if needed
      await this.createSnapshotIfNeeded(aggregate);

      this.logger.debug('Aggregate saved successfully', {
        aggregateId: aggregate.getId(),
        eventCount: uncommittedEvents.length,
        newVersion: aggregate.getVersion()
      });
    } catch (error) {
      this.logger.error('Failed to save aggregate', {
        aggregateId: aggregate.getId(),
        error
      });
      throw error;
    }
  }

  public async delete(id: string): Promise<void> {
    try {
      await this.eventStore.deleteStream(id, this.aggregateType);
      this.logger.info('Aggregate deleted', { aggregateId: id });
    } catch (error) {
      this.logger.error('Failed to delete aggregate', { aggregateId: id, error });
      throw error;
    }
  }

  public async exists(id: string): Promise<boolean> {
    try {
      const events = await this.eventStore.getEvents(id, this.aggregateType, 0, 1);
      return events.length > 0;
    } catch (error) {
      this.logger.error('Failed to check aggregate existence', { aggregateId: id, error });
      return false;
    }
  }

  protected abstract createAggregate(id: string): T;

  private async createSnapshotIfNeeded(aggregate: T): Promise<void> {
    // Create snapshot every 50 events
    const snapshotFrequency = 50;
    
    if (aggregate.getVersion() % snapshotFrequency === 0) {
      try {
        const snapshotData = aggregate.createSnapshot();
        await this.eventStore.createSnapshot(
          aggregate.getId(),
          this.aggregateType,
          snapshotData,
          aggregate.getVersion()
        );
        
        this.logger.debug('Snapshot created', {
          aggregateId: aggregate.getId(),
          version: aggregate.getVersion()
        });
      } catch (error) {
        this.logger.warn('Failed to create snapshot', {
          aggregateId: aggregate.getId(),
          error
        });
        // Don't fail the save operation if snapshot creation fails
      }
    }
  }
}

export class UnitOfWork {
  private readonly aggregates = new Map<string, AggregateRoot>();
  private readonly repositories = new Map<string, EventSourcedRepository<any>>();
  private readonly logger = pino({ name: 'UnitOfWork' });
  private isCommitted = false;

  public registerRepository<T extends AggregateRoot>(
    aggregateType: string,
    repository: EventSourcedRepository<T>
  ): void {
    this.repositories.set(aggregateType, repository);
  }

  public registerAggregate(aggregate: AggregateRoot): void {
    const key = this.getAggregateKey(aggregate);
    this.aggregates.set(key, aggregate);
  }

  public async commit(): Promise<void> {
    if (this.isCommitted) {
      throw new Error('UnitOfWork already committed');
    }

    const aggregatesToSave = Array.from(this.aggregates.values())
      .filter(aggregate => aggregate.getUncommittedEvents().length > 0);

    if (aggregatesToSave.length === 0) {
      this.isCommitted = true;
      return;
    }

    try {
      // Group aggregates by type for batch processing
      const aggregatesByType = this.groupAggregatesByType(aggregatesToSave);

      // Save all aggregates
      for (const [aggregateType, aggregates] of aggregatesByType) {
        const repository = this.repositories.get(aggregateType);
        if (!repository) {
          throw new Error(`No repository registered for aggregate type: ${aggregateType}`);
        }

        // Save aggregates in parallel
        await Promise.all(
          aggregates.map(aggregate => repository.save(aggregate))
        );
      }

      this.isCommitted = true;
      this.logger.info('UnitOfWork committed successfully', {
        aggregateCount: aggregatesToSave.length
      });
    } catch (error) {
      this.logger.error('Failed to commit UnitOfWork', { error });
      throw error;
    }
  }

  public rollback(): void {
    // Clear all uncommitted events
    for (const aggregate of this.aggregates.values()) {
      aggregate.clearUncommittedEvents();
    }
    
    this.aggregates.clear();
    this.isCommitted = true;
    this.logger.info('UnitOfWork rolled back');
  }

  public getAggregate<T extends AggregateRoot>(
    aggregateType: string,
    id: string
  ): T | undefined {
    const key = `${aggregateType}-${id}`;
    return this.aggregates.get(key) as T;
  }

  public hasUncommittedChanges(): boolean {
    return !this.isCommitted && 
           Array.from(this.aggregates.values())
             .some(aggregate => aggregate.getUncommittedEvents().length > 0);
  }

  private getAggregateKey(aggregate: AggregateRoot): string {
    return `${aggregate.constructor.name}-${aggregate.getId()}`;
  }

  private groupAggregatesByType(
    aggregates: AggregateRoot[]
  ): Map<string, AggregateRoot[]> {
    const groups = new Map<string, AggregateRoot[]>();
    
    for (const aggregate of aggregates) {
      const type = aggregate.constructor.name;
      if (!groups.has(type)) {
        groups.set(type, []);
      }
      groups.get(type)!.push(aggregate);
    }
    
    return groups;
  }
}

export class EventSourcedAggregateFactory<T extends AggregateRoot> {
  constructor(
    private readonly repository: EventSourcedRepository<T>,
    private readonly createEmptyAggregate: (id: string) => T
  ) {}

  public async create(id: string): Promise<T> {
    const exists = await this.repository.exists(id);
    if (exists) {
      throw new Error(`Aggregate with id ${id} already exists`);
    }
    
    return this.createEmptyAggregate(id);
  }

  public async getOrCreate(id: string): Promise<T> {
    try {
      return await this.repository.getById(id);
    } catch (error) {
      if (error instanceof AggregateNotFoundError) {
        return this.createEmptyAggregate(id);
      }
      throw error;
    }
  }

  public async load(id: string): Promise<T> {
    return this.repository.getById(id);
  }
}

export abstract class DomainService {
  protected readonly logger = pino({ name: this.constructor.name });
  
  protected constructor(protected readonly unitOfWork: UnitOfWork) {}

  protected async getAggregate<T extends AggregateRoot>(
    aggregateType: string,
    id: string,
    factory: EventSourcedAggregateFactory<T>
  ): Promise<T> {
    // Check UnitOfWork first
    let aggregate = this.unitOfWork.getAggregate<T>(aggregateType, id);
    
    if (!aggregate) {
      // Load from repository
      aggregate = await factory.load(id);
      this.unitOfWork.registerAggregate(aggregate);
    }
    
    return aggregate;
  }
}
