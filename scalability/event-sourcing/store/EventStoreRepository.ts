import {
  DomainEvent,
  EventFilter,
  EventPosition,
  EventStoreStats
} from '../types';

export interface EventStoreRepository {
  initialize(): Promise<void>;
  saveEvents(streamKey: string, events: any[]): Promise<void>;
  getEvents(streamKey: string, fromVersion?: number, toVersion?: number): Promise<any[]>;
  getAllEvents(filter?: EventFilter, fromPosition?: EventPosition, batchSize?: number): Promise<any[]>;
  getCurrentVersion(streamKey: string): Promise<number>;
  createSubscription(subscriptionId: string, filter: EventFilter, fromPosition?: EventPosition): Promise<void>;
  removeSubscription(subscriptionId: string): Promise<void>;
  getStats(): Promise<EventStoreStats>;
  truncateStream(streamKey: string, beforeVersion: number): Promise<void>;
  deleteStream(streamKey: string): Promise<void>;
  optimizeStorage(): Promise<void>;
  shutdown(): Promise<void>;
}

import { MongoClient, Db, Collection, ChangeStream } from 'mongodb';
import pino from 'pino';

export class MongoEventStoreRepository implements EventStoreRepository {
  private readonly logger = pino({ name: 'MongoEventStoreRepository' });
  private client: MongoClient;
  private db: Db;
  private eventsCollection: Collection;
  private streamsCollection: Collection;
  private subscriptionsCollection: Collection;
  private changeStreams = new Map<string, ChangeStream>();
  private isInitialized = false;

  constructor(private connectionString: string, private databaseName: string) {}

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.client = new MongoClient(this.connectionString);
      await this.client.connect();
      this.db = this.client.db(this.databaseName);
      this.eventsCollection = this.db.collection('events');
      this.streamsCollection = this.db.collection('streams');
      this.subscriptionsCollection = this.db.collection('subscriptions');

      await this.createIndexes();
      this.isInitialized = true;
      this.logger.info('MongoDB EventStore repository initialized');
    } catch (error) {
      this.logger.error('Failed to initialize MongoDB repository', { error });
      throw error;
    }
  }

  public async saveEvents(streamKey: string, events: any[]): Promise<void> {
    const session = this.client.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Insert events
        if (events.length > 0) {
          await this.eventsCollection.insertMany(
            events.map((event, index) => ({
              ...event,
              streamKey,
              globalPosition: null, // Will be set by MongoDB
              streamPosition: event.version,
              _id: event.id
            })),
            { session }
          );
        }

        // Update stream metadata
        await this.streamsCollection.updateOne(
          { _id: streamKey },
          {
            $set: {
              lastUpdated: new Date(),
              version: events[events.length - 1]?.version || 0
            },
            $inc: { eventCount: events.length }
          },
          { upsert: true, session }
        );
      });
    } catch (error) {
      this.logger.error('Failed to save events', { streamKey, eventCount: events.length, error });
      throw error;
    } finally {
      await session.endSession();
    }
  }

  public async getEvents(
    streamKey: string,
    fromVersion: number = 0,
    toVersion?: number
  ): Promise<any[]> {
    try {
      const query: any = { streamKey, streamPosition: { $gte: fromVersion } };
      if (toVersion) {
        query.streamPosition.$lte = toVersion;
      }

      const events = await this.eventsCollection
        .find(query)
        .sort({ streamPosition: 1 })
        .toArray();

      return events;
    } catch (error) {
      this.logger.error('Failed to get events', { streamKey, fromVersion, toVersion, error });
      throw error;
    }
  }

  public async getAllEvents(
    filter?: EventFilter,
    fromPosition?: EventPosition,
    batchSize: number = 100
  ): Promise<any[]> {
    try {
      const query = this.buildEventFilter(filter);
      
      if (fromPosition) {
        query.globalPosition = { $gt: fromPosition.position };
      }

      const events = await this.eventsCollection
        .find(query)
        .sort({ globalPosition: 1 })
        .limit(batchSize)
        .toArray();

      return events;
    } catch (error) {
      this.logger.error('Failed to get all events', { filter, error });
      throw error;
    }
  }

  public async getCurrentVersion(streamKey: string): Promise<number> {
    try {
      const stream = await this.streamsCollection.findOne({ _id: streamKey });
      return stream?.version || 0;
    } catch (error) {
      this.logger.error('Failed to get current version', { streamKey, error });
      throw error;
    }
  }

  public async createSubscription(
    subscriptionId: string,
    filter: EventFilter,
    fromPosition?: EventPosition
  ): Promise<void> {
    try {
      await this.subscriptionsCollection.insertOne({
        _id: subscriptionId,
        filter,
        fromPosition,
        createdAt: new Date(),
        isActive: true
      });

      // Create change stream for real-time events
      const changeStream = this.eventsCollection.watch(
        [{ $match: this.buildChangeStreamFilter(filter) }],
        { fullDocument: 'updateLookup' }
      );

      changeStream.on('change', (change) => {
        if (change.operationType === 'insert') {
          // Emit event to subscribers
          this.emitEventToSubscription(subscriptionId, change.fullDocument);
        }
      });

      this.changeStreams.set(subscriptionId, changeStream);
    } catch (error) {
      this.logger.error('Failed to create subscription', { subscriptionId, error });
      throw error;
    }
  }

  public async removeSubscription(subscriptionId: string): Promise<void> {
    try {
      await this.subscriptionsCollection.deleteOne({ _id: subscriptionId });
      
      const changeStream = this.changeStreams.get(subscriptionId);
      if (changeStream) {
        await changeStream.close();
        this.changeStreams.delete(subscriptionId);
      }
    } catch (error) {
      this.logger.error('Failed to remove subscription', { subscriptionId, error });
      throw error;
    }
  }

  public async getStats(): Promise<EventStoreStats> {
    try {
      const [eventStats, streamStats] = await Promise.all([
        this.eventsCollection.aggregate([
          {
            $group: {
              _id: null,
              totalEvents: { $sum: 1 },
              oldestEvent: { $min: '$timestamp' },
              newestEvent: { $max: '$timestamp' }
            }
          }
        ]).toArray(),
        this.streamsCollection.aggregate([
          {
            $group: {
              _id: null,
              totalStreams: { $sum: 1 },
              totalEventCount: { $sum: '$eventCount' },
              averageEventsPerStream: { $avg: '$eventCount' }
            }
          }
        ]).toArray()
      ]);

      const eventStat = eventStats[0] || {};
      const streamStat = streamStats[0] || {};

      return {
        totalEvents: eventStat.totalEvents || 0,
        totalStreams: streamStat.totalStreams || 0,
        totalSnapshots: 0, // Will be implemented in SnapshotStore
        averageEventsPerStream: streamStat.averageEventsPerStream || 0,
        oldestEvent: eventStat.oldestEvent || new Date(),
        newestEvent: eventStat.newestEvent || new Date(),
        storageSize: 0, // MongoDB specific query needed
        indexSize: 0   // MongoDB specific query needed
      };
    } catch (error) {
      this.logger.error('Failed to get stats', { error });
      throw error;
    }
  }

  public async truncateStream(streamKey: string, beforeVersion: number): Promise<void> {
    const session = this.client.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Delete events before version
        const deleteResult = await this.eventsCollection.deleteMany(
          { streamKey, streamPosition: { $lt: beforeVersion } },
          { session }
        );

        // Update stream metadata
        await this.streamsCollection.updateOne(
          { _id: streamKey },
          {
            $inc: { eventCount: -deleteResult.deletedCount },
            $set: { lastUpdated: new Date() }
          },
          { session }
        );
      });
    } catch (error) {
      this.logger.error('Failed to truncate stream', { streamKey, beforeVersion, error });
      throw error;
    } finally {
      await session.endSession();
    }
  }

  public async deleteStream(streamKey: string): Promise<void> {
    const session = this.client.startSession();
    
    try {
      await session.withTransaction(async () => {
        await this.eventsCollection.deleteMany({ streamKey }, { session });
        await this.streamsCollection.deleteOne({ _id: streamKey }, { session });
      });
    } catch (error) {
      this.logger.error('Failed to delete stream', { streamKey, error });
      throw error;
    } finally {
      await session.endSession();
    }
  }

  public async optimizeStorage(): Promise<void> {
    try {
      // Compact collections
      await this.db.command({ compact: 'events' });
      await this.db.command({ compact: 'streams' });
      
      // Rebuild indexes
      await this.eventsCollection.reIndex();
      await this.streamsCollection.reIndex();
      
      this.logger.info('Storage optimization completed');
    } catch (error) {
      this.logger.error('Failed to optimize storage', { error });
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    try {
      // Close all change streams
      for (const [subscriptionId, changeStream] of this.changeStreams) {
        await changeStream.close();
      }
      this.changeStreams.clear();

      // Close MongoDB connection
      if (this.client) {
        await this.client.close();
      }
      
      this.isInitialized = false;
      this.logger.info('MongoDB repository shutdown completed');
    } catch (error) {
      this.logger.error('Failed to shutdown repository', { error });
      throw error;
    }
  }

  private async createIndexes(): Promise<void> {
    try {
      // Events collection indexes
      await this.eventsCollection.createIndexes([
        { key: { streamKey: 1, streamPosition: 1 }, unique: true },
        { key: { globalPosition: 1 } },
        { key: { aggregateType: 1 } },
        { key: { eventType: 1 } },
        { key: { timestamp: 1 } },
        { key: { 'metadata.correlationId': 1 } },
        { key: { 'metadata.causationId': 1 } }
      ]);

      // Streams collection indexes
      await this.streamsCollection.createIndexes([
        { key: { lastUpdated: 1 } },
        { key: { eventCount: 1 } }
      ]);

      // Subscriptions collection indexes
      await this.subscriptionsCollection.createIndexes([
        { key: { isActive: 1 } },
        { key: { createdAt: 1 } }
      ]);

      this.logger.info('Database indexes created');
    } catch (error) {
      this.logger.error('Failed to create indexes', { error });
      throw error;
    }
  }

  private buildEventFilter(filter?: EventFilter): any {
    if (!filter) return {};

    const query: any = {};

    if (filter.eventTypes && filter.eventTypes.length > 0) {
      query.eventType = { $in: filter.eventTypes };
    }

    if (filter.aggregateTypes && filter.aggregateTypes.length > 0) {
      query.aggregateType = { $in: filter.aggregateTypes };
    }

    if (filter.aggregateIds && filter.aggregateIds.length > 0) {
      query.aggregateId = { $in: filter.aggregateIds };
    }

    if (filter.fromTimestamp || filter.toTimestamp) {
      query.timestamp = {};
      if (filter.fromTimestamp) {
        query.timestamp.$gte = filter.fromTimestamp;
      }
      if (filter.toTimestamp) {
        query.timestamp.$lte = filter.toTimestamp;
      }
    }

    if (filter.metadata) {
      Object.entries(filter.metadata).forEach(([key, value]) => {
        query[`metadata.${key}`] = value;
      });
    }

    return query;
  }

  private buildChangeStreamFilter(filter: EventFilter): any {
    const matchFilter: any = {};

    if (filter.eventTypes && filter.eventTypes.length > 0) {
      matchFilter['fullDocument.eventType'] = { $in: filter.eventTypes };
    }

    if (filter.aggregateTypes && filter.aggregateTypes.length > 0) {
      matchFilter['fullDocument.aggregateType'] = { $in: filter.aggregateTypes };
    }

    return matchFilter;
  }

  private emitEventToSubscription(subscriptionId: string, event: any): void {
    // This would typically emit to an event bus or message queue
    // For now, just log
    this.logger.debug('Event emitted to subscription', { subscriptionId, eventId: event._id });
  }
}
