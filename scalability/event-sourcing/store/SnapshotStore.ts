import { Snapshot } from '../types';
import { MongoClient, Db, Collection } from 'mongodb';
import pino from 'pino';
import { createHash } from 'crypto';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export interface SnapshotStore {
  initialize(): Promise<void>;
  saveSnapshot(snapshot: Snapshot): Promise<void>;
  getLatestSnapshot(aggregateId: string, aggregateType: string): Promise<Snapshot | null>;
  getSnapshots(aggregateId: string, aggregateType: string, limit?: number): Promise<Snapshot[]>;
  deleteSnapshots(aggregateId: string, aggregateType: string): Promise<void>;
  deleteOldSnapshots(aggregateId: string, aggregateType: string, keepCount: number): Promise<void>;
  optimizeStorage(): Promise<void>;
  shutdown(): Promise<void>;
}

export class MongoSnapshotStore implements SnapshotStore {
  private readonly logger = pino({ name: 'MongoSnapshotStore' });
  private client: MongoClient;
  private db: Db;
  private snapshotsCollection: Collection;
  private isInitialized = false;
  private compressionEnabled = true;

  constructor(
    private connectionString: string,
    private databaseName: string,
    compressionEnabled: boolean = true
  ) {
    this.compressionEnabled = compressionEnabled;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.client = new MongoClient(this.connectionString);
      await this.client.connect();
      this.db = this.client.db(this.databaseName);
      this.snapshotsCollection = this.db.collection('snapshots');

      await this.createIndexes();
      this.isInitialized = true;
      this.logger.info('MongoDB SnapshotStore initialized');
    } catch (error) {
      this.logger.error('Failed to initialize MongoDB SnapshotStore', { error });
      throw error;
    }
  }

  public async saveSnapshot(snapshot: Snapshot): Promise<void> {
    try {
      // Calculate checksum
      const dataString = JSON.stringify(snapshot.data);
      const checksum = createHash('sha256').update(dataString).digest('hex');

      // Compress data if enabled
      let processedData: any = snapshot.data;
      let compression: string | undefined;

      if (this.compressionEnabled) {
        const compressedBuffer = await gzipAsync(Buffer.from(dataString));
        processedData = compressedBuffer;
        compression = 'gzip';
      }

      const snapshotDoc = {
        _id: snapshot.id,
        aggregateId: snapshot.aggregateId,
        aggregateType: snapshot.aggregateType,
        version: snapshot.version,
        data: processedData,
        timestamp: snapshot.timestamp,
        metadata: {
          ...snapshot.metadata,
          checksum,
          compression,
          originalSize: dataString.length,
          compressedSize: this.compressionEnabled ? processedData.length : dataString.length
        }
      };

      await this.snapshotsCollection.insertOne(snapshotDoc);

      // Clean up old snapshots (keep only last 5)
      await this.deleteOldSnapshots(snapshot.aggregateId, snapshot.aggregateType, 5);

      this.logger.debug('Snapshot saved', {
        aggregateId: snapshot.aggregateId,
        aggregateType: snapshot.aggregateType,
        version: snapshot.version,
        compression
      });
    } catch (error) {
      this.logger.error('Failed to save snapshot', {
        aggregateId: snapshot.aggregateId,
        aggregateType: snapshot.aggregateType,
        error
      });
      throw error;
    }
  }

  public async getLatestSnapshot(
    aggregateId: string,
    aggregateType: string
  ): Promise<Snapshot | null> {
    try {
      const snapshotDoc = await this.snapshotsCollection.findOne(
        { aggregateId, aggregateType },
        { sort: { version: -1 } }
      );

      if (!snapshotDoc) {
        return null;
      }

      return this.deserializeSnapshot(snapshotDoc);
    } catch (error) {
      this.logger.error('Failed to get latest snapshot', { aggregateId, aggregateType, error });
      throw error;
    }
  }

  public async getSnapshots(
    aggregateId: string,
    aggregateType: string,
    limit: number = 10
  ): Promise<Snapshot[]> {
    try {
      const snapshotDocs = await this.snapshotsCollection
        .find({ aggregateId, aggregateType })
        .sort({ version: -1 })
        .limit(limit)
        .toArray();

      return Promise.all(snapshotDocs.map(doc => this.deserializeSnapshot(doc)));
    } catch (error) {
      this.logger.error('Failed to get snapshots', { aggregateId, aggregateType, error });
      throw error;
    }
  }

  public async deleteSnapshots(aggregateId: string, aggregateType: string): Promise<void> {
    try {
      const result = await this.snapshotsCollection.deleteMany({ aggregateId, aggregateType });
      this.logger.info('Snapshots deleted', { 
        aggregateId, 
        aggregateType, 
        deletedCount: result.deletedCount 
      });
    } catch (error) {
      this.logger.error('Failed to delete snapshots', { aggregateId, aggregateType, error });
      throw error;
    }
  }

  public async deleteOldSnapshots(
    aggregateId: string,
    aggregateType: string,
    keepCount: number
  ): Promise<void> {
    try {
      // Get snapshots to keep (latest ones)
      const snapshotsToKeep = await this.snapshotsCollection
        .find({ aggregateId, aggregateType })
        .sort({ version: -1 })
        .limit(keepCount)
        .project({ _id: 1 })
        .toArray();

      if (snapshotsToKeep.length === 0) {
        return;
      }

      const idsToKeep = snapshotsToKeep.map(snap => snap._id);

      // Delete old snapshots
      const result = await this.snapshotsCollection.deleteMany({
        aggregateId,
        aggregateType,
        _id: { $nin: idsToKeep }
      });

      if (result.deletedCount > 0) {
        this.logger.debug('Old snapshots cleaned up', {
          aggregateId,
          aggregateType,
          deletedCount: result.deletedCount,
          keptCount: keepCount
        });
      }
    } catch (error) {
      this.logger.error('Failed to delete old snapshots', { 
        aggregateId, 
        aggregateType, 
        keepCount, 
        error 
      });
      throw error;
    }
  }

  public async optimizeStorage(): Promise<void> {
    try {
      // Compact collection
      await this.db.command({ compact: 'snapshots' });
      
      // Rebuild indexes
      await this.snapshotsCollection.reIndex();

      // Get storage stats
      const stats = await this.db.command({ collStats: 'snapshots' });
      
      this.logger.info('Snapshot storage optimized', {
        totalSize: stats.size,
        indexSize: stats.totalIndexSize,
        documentCount: stats.count
      });
    } catch (error) {
      this.logger.error('Failed to optimize snapshot storage', { error });
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    try {
      if (this.client) {
        await this.client.close();
      }
      this.isInitialized = false;
      this.logger.info('MongoDB SnapshotStore shutdown completed');
    } catch (error) {
      this.logger.error('Failed to shutdown SnapshotStore', { error });
      throw error;
    }
  }

  private async createIndexes(): Promise<void> {
    try {
      await this.snapshotsCollection.createIndexes([
        { 
          key: { aggregateId: 1, aggregateType: 1, version: -1 }, 
          unique: true 
        },
        { 
          key: { timestamp: 1 } 
        },
        { 
          key: { aggregateType: 1 } 
        },
        {
          key: { 'metadata.size': 1 }
        }
      ]);

      this.logger.info('Snapshot indexes created');
    } catch (error) {
      this.logger.error('Failed to create snapshot indexes', { error });
      throw error;
    }
  }

  private async deserializeSnapshot(snapshotDoc: any): Promise<Snapshot> {
    let data = snapshotDoc.data;

    // Decompress if needed
    if (snapshotDoc.metadata?.compression === 'gzip') {
      const decompressedBuffer = await gunzipAsync(Buffer.from(data));
      data = JSON.parse(decompressedBuffer.toString());
    }

    // Verify checksum
    const dataString = JSON.stringify(data);
    const calculatedChecksum = createHash('sha256').update(dataString).digest('hex');
    
    if (snapshotDoc.metadata?.checksum && calculatedChecksum !== snapshotDoc.metadata.checksum) {
      throw new Error(`Snapshot checksum mismatch for ${snapshotDoc.aggregateId}`);
    }

    return {
      id: snapshotDoc._id,
      aggregateId: snapshotDoc.aggregateId,
      aggregateType: snapshotDoc.aggregateType,
      version: snapshotDoc.version,
      data,
      timestamp: snapshotDoc.timestamp,
      metadata: snapshotDoc.metadata
    };
  }
}

export class InMemorySnapshotStore implements SnapshotStore {
  private readonly logger = pino({ name: 'InMemorySnapshotStore' });
  private snapshots = new Map<string, Snapshot[]>();
  private isInitialized = false;

  public async initialize(): Promise<void> {
    this.isInitialized = true;
    this.logger.info('InMemory SnapshotStore initialized');
  }

  public async saveSnapshot(snapshot: Snapshot): Promise<void> {
    const key = this.getSnapshotKey(snapshot.aggregateId, snapshot.aggregateType);
    const snapshots = this.snapshots.get(key) || [];
    
    // Add new snapshot
    snapshots.push(snapshot);
    
    // Sort by version (newest first)
    snapshots.sort((a, b) => b.version - a.version);
    
    // Keep only last 5 snapshots
    if (snapshots.length > 5) {
      snapshots.splice(5);
    }
    
    this.snapshots.set(key, snapshots);
    
    this.logger.debug('Snapshot saved in memory', {
      aggregateId: snapshot.aggregateId,
      aggregateType: snapshot.aggregateType,
      version: snapshot.version
    });
  }

  public async getLatestSnapshot(
    aggregateId: string,
    aggregateType: string
  ): Promise<Snapshot | null> {
    const key = this.getSnapshotKey(aggregateId, aggregateType);
    const snapshots = this.snapshots.get(key) || [];
    return snapshots.length > 0 ? snapshots[0] : null;
  }

  public async getSnapshots(
    aggregateId: string,
    aggregateType: string,
    limit: number = 10
  ): Promise<Snapshot[]> {
    const key = this.getSnapshotKey(aggregateId, aggregateType);
    const snapshots = this.snapshots.get(key) || [];
    return snapshots.slice(0, limit);
  }

  public async deleteSnapshots(aggregateId: string, aggregateType: string): Promise<void> {
    const key = this.getSnapshotKey(aggregateId, aggregateType);
    this.snapshots.delete(key);
    this.logger.info('Snapshots deleted from memory', { aggregateId, aggregateType });
  }

  public async deleteOldSnapshots(
    aggregateId: string,
    aggregateType: string,
    keepCount: number
  ): Promise<void> {
    const key = this.getSnapshotKey(aggregateId, aggregateType);
    const snapshots = this.snapshots.get(key) || [];
    
    if (snapshots.length > keepCount) {
      const keptSnapshots = snapshots.slice(0, keepCount);
      this.snapshots.set(key, keptSnapshots);
      
      this.logger.debug('Old snapshots cleaned up in memory', {
        aggregateId,
        aggregateType,
        deletedCount: snapshots.length - keepCount,
        keptCount: keepCount
      });
    }
  }

  public async optimizeStorage(): Promise<void> {
    // No-op for in-memory store
    this.logger.info('Memory snapshot storage optimization completed (no-op)');
  }

  public async shutdown(): Promise<void> {
    this.snapshots.clear();
    this.isInitialized = false;
    this.logger.info('InMemory SnapshotStore shutdown completed');
  }

  private getSnapshotKey(aggregateId: string, aggregateType: string): string {
    return `${aggregateType}-${aggregateId}`;
  }
}
