import { DomainEvent, EventMetadata } from '../types';
import { v4 as uuidv4 } from 'uuid';

export abstract class AggregateRoot {
  protected id: string;
  protected version: number = 0;
  private uncommittedEvents: DomainEvent[] = [];
  private eventHandlers: Map<string, (event: DomainEvent) => void> = new Map();

  constructor(id?: string) {
    this.id = id || uuidv4();
    this.registerEventHandlers();
  }

  public getId(): string {
    return this.id;
  }

  public getVersion(): number {
    return this.version;
  }

  public getUncommittedEvents(): DomainEvent[] {
    return [...this.uncommittedEvents];
  }

  public clearUncommittedEvents(): void {
    this.uncommittedEvents = [];
  }

  public loadFromHistory(events: DomainEvent[]): void {
    events.forEach(event => {
      this.applyEvent(event, false);
      this.version = Math.max(this.version, event.version);
    });
  }

  protected raiseEvent(eventType: string, eventData: Record<string, any>, metadata?: Partial<EventMetadata>): void {
    const event: DomainEvent = {
      id: uuidv4(),
      aggregateId: this.id,
      aggregateType: this.constructor.name,
      version: this.version + 1,
      eventType,
      eventData,
      metadata: {
        source: this.constructor.name,
        version: '1.0',
        contentType: 'application/json',
        serialization: 'json',
        ...metadata
      },
      timestamp: new Date()
    };

    this.applyEvent(event, true);
    this.uncommittedEvents.push(event);
    this.version = event.version;
  }

  private applyEvent(event: DomainEvent, isNew: boolean): void {
    const handler = this.eventHandlers.get(event.eventType);
    if (handler) {
      handler(event);
    } else {
      console.warn(`No handler found for event type: ${event.eventType}`);
    }

    if (isNew) {
      this.onEventApplied(event);
    }
  }

  protected onEventApplied(event: DomainEvent): void {
    // Override in derived classes for custom behavior
  }

  protected abstract registerEventHandlers(): void;

  protected registerEventHandler(eventType: string, handler: (event: DomainEvent) => void): void {
    this.eventHandlers.set(eventType, handler);
  }

  public equals(other: AggregateRoot): boolean {
    return this.id === other.id && this.constructor.name === other.constructor.name;
  }

  public clone(): AggregateRoot {
    const cloned = Object.create(Object.getPrototypeOf(this));
    Object.assign(cloned, this);
    cloned.uncommittedEvents = [...this.uncommittedEvents];
    cloned.eventHandlers = new Map(this.eventHandlers);
    return cloned;
  }

  protected validateState(): void {
    // Override in derived classes for validation
  }

  protected getSnapshot(): Record<string, any> {
    // Override in derived classes for custom snapshot logic
    return {
      id: this.id,
      version: this.version,
      // Add aggregate-specific state here
    };
  }

  protected loadFromSnapshot(snapshot: Record<string, any>): void {
    // Override in derived classes for custom snapshot loading
    this.id = snapshot.id;
    this.version = snapshot.version;
  }

  public createSnapshot(): Record<string, any> {
    this.validateState();
    return this.getSnapshot();
  }

  public restoreFromSnapshot(snapshot: Record<string, any>): void {
    this.loadFromSnapshot(snapshot);
    this.validateState();
  }

  protected generateCorrelationId(): string {
    return uuidv4();
  }

  protected generateCausationId(): string {
    return uuidv4();
  }

  public toString(): string {
    return `${this.constructor.name}(id=${this.id}, version=${this.version})`;
  }
}

export abstract class Entity {
  protected id: string;
  protected createdAt: Date;
  protected updatedAt: Date;

  constructor(id?: string) {
    this.id = id || uuidv4();
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  public getId(): string {
    return this.id;
  }

  public getCreatedAt(): Date {
    return this.createdAt;
  }

  public getUpdatedAt(): Date {
    return this.updatedAt;
  }

  protected touch(): void {
    this.updatedAt = new Date();
  }

  public equals(other: Entity): boolean {
    return this.id === other.id && this.constructor.name === other.constructor.name;
  }
}

export abstract class ValueObject {
  public abstract equals(other: ValueObject): boolean;
  
  public abstract getValue(): any;

  public toString(): string {
    return JSON.stringify(this.getValue());
  }
}

export class DomainError extends Error {
  public readonly code: string;
  public readonly timestamp: Date;
  public readonly aggregateId?: string;

  constructor(message: string, code: string, aggregateId?: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.timestamp = new Date();
    this.aggregateId = aggregateId;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ConcurrencyError extends DomainError {
  public readonly expectedVersion: number;
  public readonly actualVersion: number;

  constructor(aggregateId: string, expectedVersion: number, actualVersion: number) {
    super(
      `Concurrency conflict for aggregate ${aggregateId}. Expected version ${expectedVersion}, but was ${actualVersion}`,
      'CONCURRENCY_CONFLICT',
      aggregateId
    );
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

export class AggregateNotFoundError extends DomainError {
  constructor(aggregateId: string, aggregateType: string) {
    super(
      `Aggregate ${aggregateType} with id ${aggregateId} not found`,
      'AGGREGATE_NOT_FOUND',
      aggregateId
    );
  }
}

export class InvalidEventError extends DomainError {
  public readonly eventType: string;
  public readonly validationErrors: string[];

  constructor(eventType: string, validationErrors: string[]) {
    super(
      `Invalid event ${eventType}: ${validationErrors.join(', ')}`,
      'INVALID_EVENT'
    );
    this.eventType = eventType;
    this.validationErrors = validationErrors;
  }
}
