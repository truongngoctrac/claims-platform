import {
  DomainEvent,
  EventStream,
  Snapshot,
  EventStoreOptions,
  EventFilter,
  EventPosition,
  EventStoreStats,
  EventStreamPosition
} from '../types';
import { EventStoreRepository } from './EventStoreRepository';
import { SnapshotStore } from './SnapshotStore';
import { EventSerializer } from '../serialization/EventSerializer';
import { EventVersionManager } from '../versioning/EventVersionManager';
import { ConcurrencyError, AggregateNotFoundError } from '../base/AggregateRoot';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';

export class EventStore extends EventEmitter {
  private readonly logger = pino({ name: 'EventStore' });
  private readonly repository: EventStoreRepository;
  private readonly snapshotStore: SnapshotStore;
  private readonly serializer: EventSerializer;
  private readonly versionManager: EventVersionManager;
  private readonly options: EventStoreOptions;
  private readonly eventCache = new Map<string, DomainEvent[]>();
  private readonly streamCache = new Map<string, EventStream>();
  private isInitialized = false;

  constructor(
    repository: EventStoreRepository,
    snapshotStore: SnapshotStore,
    serializer: EventSerializer,
    versionManager: EventVersionManager,
    options: Partial<EventStoreOptions> = {}
  ) {
    super();
    this.repository = repository;
    this.snapshotStore = snapshotStore;
    this.serializer = serializer;
    this.versionManager = versionManager;
    this.options = {
      batchSize: 100,
      snapshotFrequency: 50,
      retentionPeriod: 365 * 24 * 60 * 60 * 1000, // 1 year
      compressionEnabled: true,
      encryptionEnabled: false,
      indexingStrategy: 'eager',
      ...options
    };
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.repository.initialize();
      await this.snapshotStore.initialize();
      this.isInitialized = true;
      this.logger.info('EventStore initialized successfully');
      this.emit('initialized');
    } catch (error) {
      this.logger.error('Failed to initialize EventStore', { error });
      throw error;
    }
  }

  public async saveEvents(
    aggregateId: string,
    events: DomainEvent[],
    expectedVersion: number
  ): Promise<void> {
    this.ensureInitialized();

    if (events.length === 0) {
      return;
    }

    const streamKey = this.getStreamKey(aggregateId, events[0].aggregateType);
    
    try {
      // Check concurrency
      const currentVersion = await this.repository.getCurrentVersion(streamKey);
      if (currentVersion !== expectedVersion) {
        throw new ConcurrencyError(aggregateId, expectedVersion, currentVersion);
      }

      // Serialize and validate events
      const serializedEvents = await Promise.all(
        events.map(event => this.serializeEvent(event))
      );

      // Save events in batch
      await this.repository.saveEvents(streamKey, serializedEvents);

      // Update cache
      this.updateEventCache(streamKey, events);

      // Check if snapshot is needed
      const newVersion = expectedVersion + events.length;
      if (this.shouldCreateSnapshot(newVersion)) {
        await this.createSnapshotIfNeeded(aggregateId, events[0].aggregateType);
      }

      this.logger.debug('Events saved successfully', {
        aggregateId,
        eventCount: events.length,
        newVersion
      });

      // Emit events for projections
      this.emitEventsForProjections(events);

    } catch (error) {
      this.logger.error('Failed to save events', { aggregateId, error });
      throw error;
    }
  }

  public async getEvents(
    aggregateId: string,
    aggregateType: string,
    fromVersion: number = 0,
    toVersion?: number
  ): Promise<DomainEvent[]> {
    this.ensureInitialized();

    const streamKey = this.getStreamKey(aggregateId, aggregateType);

    // Check cache first
    const cachedEvents = this.eventCache.get(streamKey);
    if (cachedEvents) {
      return this.filterEventsByVersion(cachedEvents, fromVersion, toVersion);
    }

    try {
      const serializedEvents = await this.repository.getEvents(streamKey, fromVersion, toVersion);
      const events = await Promise.all(
        serializedEvents.map(event => this.deserializeEvent(event))
      );

      // Update cache
      this.eventCache.set(streamKey, events);

      return events;
    } catch (error) {
      this.logger.error('Failed to get events', { aggregateId, aggregateType, error });
      throw error;
    }
  }

  public async getEventStream(
    aggregateId: string,
    aggregateType: string
  ): Promise<EventStream> {
    this.ensureInitialized();

    const streamKey = this.getStreamKey(aggregateId, aggregateType);

    // Check cache first
    const cachedStream = this.streamCache.get(streamKey);
    if (cachedStream) {
      return cachedStream;
    }

    try {
      const events = await this.getEvents(aggregateId, aggregateType);
      const snapshots = await this.snapshotStore.getSnapshots(aggregateId, aggregateType);

      const stream: EventStream = {
        aggregateId,
        aggregateType,
        version: events.length > 0 ? Math.max(...events.map(e => e.version)) : 0,
        events,
        snapshots
      };

      // Update cache
      this.streamCache.set(streamKey, stream);

      return stream;
    } catch (error) {
      this.logger.error('Failed to get event stream', { aggregateId, aggregateType, error });
      throw error;
    }
  }

  public async getAllEvents(
    filter?: EventFilter,
    fromPosition?: EventPosition,
    batchSize: number = this.options.batchSize
  ): Promise<DomainEvent[]> {
    this.ensureInitialized();

    try {
      const serializedEvents = await this.repository.getAllEvents(filter, fromPosition, batchSize);
      return Promise.all(serializedEvents.map(event => this.deserializeEvent(event)));
    } catch (error) {
      this.logger.error('Failed to get all events', { filter, error });
      throw error;
    }
  }

  public async subscribeToEvents(
    filter: EventFilter,
    handler: (event: DomainEvent) => Promise<void>,
    fromPosition?: EventPosition
  ): Promise<string> {
    this.ensureInitialized();

    const subscriptionId = uuidv4();
    
    try {
      await this.repository.createSubscription(subscriptionId, filter, fromPosition);
      
      this.on(`event-${subscriptionId}`, handler);
      
      this.logger.info('Created event subscription', { subscriptionId, filter });
      
      return subscriptionId;
    } catch (error) {
      this.logger.error('Failed to create subscription', { filter, error });
      throw error;
    }
  }

  public async unsubscribeFromEvents(subscriptionId: string): Promise<void> {
    try {
      await this.repository.removeSubscription(subscriptionId);
      this.removeAllListeners(`event-${subscriptionId}`);
      this.logger.info('Removed event subscription', { subscriptionId });
    } catch (error) {
      this.logger.error('Failed to remove subscription', { subscriptionId, error });
      throw error;
    }
  }

  public async createSnapshot(
    aggregateId: string,
    aggregateType: string,
    data: Record<string, any>,
    version: number
  ): Promise<void> {
    this.ensureInitialized();

    try {
      const snapshot: Snapshot = {
        id: uuidv4(),
        aggregateId,
        aggregateType,
        version,
        data,
        timestamp: new Date(),
        metadata: {
          serialization: 'json',
          checksum: this.calculateChecksum(data),
          size: JSON.stringify(data).length
        }
      };

      await this.snapshotStore.saveSnapshot(snapshot);
      
      // Clear cache to force reload
      const streamKey = this.getStreamKey(aggregateId, aggregateType);
      this.streamCache.delete(streamKey);

      this.logger.debug('Snapshot created', { aggregateId, aggregateType, version });
    } catch (error) {
      this.logger.error('Failed to create snapshot', { aggregateId, aggregateType, error });
      throw error;
    }
  }

  public async getLatestSnapshot(
    aggregateId: string,
    aggregateType: string
  ): Promise<Snapshot | null> {
    this.ensureInitialized();

    try {
      return await this.snapshotStore.getLatestSnapshot(aggregateId, aggregateType);
    } catch (error) {
      this.logger.error('Failed to get latest snapshot', { aggregateId, aggregateType, error });
      throw error;
    }
  }

  public async getStats(): Promise<EventStoreStats> {
    this.ensureInitialized();

    try {
      return await this.repository.getStats();
    } catch (error) {
      this.logger.error('Failed to get stats', { error });
      throw error;
    }
  }

  public async truncateStream(
    aggregateId: string,
    aggregateType: string,
    beforeVersion: number
  ): Promise<void> {
    this.ensureInitialized();

    const streamKey = this.getStreamKey(aggregateId, aggregateType);

    try {
      await this.repository.truncateStream(streamKey, beforeVersion);
      
      // Clear caches
      this.eventCache.delete(streamKey);
      this.streamCache.delete(streamKey);

      this.logger.info('Stream truncated', { aggregateId, aggregateType, beforeVersion });
    } catch (error) {
      this.logger.error('Failed to truncate stream', { aggregateId, aggregateType, error });
      throw error;
    }
  }

  public async deleteStream(aggregateId: string, aggregateType: string): Promise<void> {
    this.ensureInitialized();

    const streamKey = this.getStreamKey(aggregateId, aggregateType);

    try {
      await this.repository.deleteStream(streamKey);
      await this.snapshotStore.deleteSnapshots(aggregateId, aggregateType);
      
      // Clear caches
      this.eventCache.delete(streamKey);
      this.streamCache.delete(streamKey);

      this.logger.info('Stream deleted', { aggregateId, aggregateType });
    } catch (error) {
      this.logger.error('Failed to delete stream', { aggregateId, aggregateType, error });
      throw error;
    }
  }

  public async optimizeStorage(): Promise<void> {
    this.ensureInitialized();

    try {
      await this.repository.optimizeStorage();
      await this.snapshotStore.optimizeStorage();
      
      // Clear caches to free memory
      this.clearCaches();

      this.logger.info('Storage optimization completed');
    } catch (error) {
      this.logger.error('Failed to optimize storage', { error });
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    try {
      await this.repository.shutdown();
      await this.snapshotStore.shutdown();
      this.clearCaches();
      this.removeAllListeners();
      this.isInitialized = false;
      this.logger.info('EventStore shutdown completed');
    } catch (error) {
      this.logger.error('Failed to shutdown EventStore', { error });
      throw error;
    }
  }

  private async serializeEvent(event: DomainEvent): Promise<any> {
    const versionedEvent = await this.versionManager.upgradeEvent(event);
    return this.serializer.serialize(versionedEvent);
  }

  private async deserializeEvent(serializedEvent: any): Promise<DomainEvent> {
    const event = this.serializer.deserialize(serializedEvent);
    return this.versionManager.upgradeEvent(event);
  }

  private getStreamKey(aggregateId: string, aggregateType: string): string {
    return `${aggregateType}-${aggregateId}`;
  }

  private shouldCreateSnapshot(version: number): boolean {
    return version % this.options.snapshotFrequency === 0;
  }

  private async createSnapshotIfNeeded(aggregateId: string, aggregateType: string): Promise<void> {
    // This would typically be handled by the aggregate repository
    // Left as placeholder for integration with aggregate loading
  }

  private updateEventCache(streamKey: string, events: DomainEvent[]): void {
    const existingEvents = this.eventCache.get(streamKey) || [];
    this.eventCache.set(streamKey, [...existingEvents, ...events]);
  }

  private filterEventsByVersion(
    events: DomainEvent[],
    fromVersion: number,
    toVersion?: number
  ): DomainEvent[] {
    return events.filter(event => {
      if (event.version < fromVersion) return false;
      if (toVersion && event.version > toVersion) return false;
      return true;
    });
  }

  private emitEventsForProjections(events: DomainEvent[]): void {
    events.forEach(event => {
      this.emit('event', event);
      this.emit(`event-${event.eventType}`, event);
      this.emit(`aggregate-${event.aggregateType}`, event);
    });
  }

  private calculateChecksum(data: Record<string, any>): string {
    // Simple checksum calculation - in production, use proper hashing
    return JSON.stringify(data).length.toString();
  }

  private clearCaches(): void {
    this.eventCache.clear();
    this.streamCache.clear();
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('EventStore not initialized. Call initialize() first.');
    }
  }
}
