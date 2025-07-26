import { DomainEvent, EventHandler, CheckpointData, ProjectionOptions, ProjectionStats } from '../types';
import { EventStore } from '../store/EventStore';
import { EventEmitter } from 'events';
import pino from 'pino';

export interface Projection extends EventHandler {
  getName(): string;
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  reset(): Promise<void>;
  rebuild(): Promise<void>;
  getStats(): ProjectionStats;
  isRunning(): boolean;
}

export abstract class BaseProjection extends EventEmitter implements Projection {
  protected readonly logger = pino({ name: this.constructor.name });
  protected isRunning = false;
  protected isInitialized = false;
  protected lastPosition: any = null;
  protected eventsProcessed = 0;
  protected errorCount = 0;
  protected lastError?: Error;
  protected startTime?: Date;

  constructor(
    protected readonly eventStore: EventStore,
    protected readonly options: ProjectionOptions
  ) {
    super();
  }

  public abstract getName(): string;
  public abstract handle(event: DomainEvent): Promise<void>;
  public abstract canHandle(event: DomainEvent): boolean;
  protected abstract initializeProjection(): Promise<void>;
  protected abstract resetProjection(): Promise<void>;

  public getHandlerName(): string {
    return this.getName();
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.initializeProjection();
      await this.loadCheckpoint();
      this.isInitialized = true;
      this.logger.info('Projection initialized', { projectionName: this.getName() });
    } catch (error) {
      this.logger.error('Failed to initialize projection', { 
        projectionName: this.getName(), 
        error 
      });
      throw error;
    }
  }

  public async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.startTime = new Date();
    
    try {
      await this.subscribeToEvents();
      this.emit('started');
      this.logger.info('Projection started', { projectionName: this.getName() });
    } catch (error) {
      this.isRunning = false;
      this.logger.error('Failed to start projection', { 
        projectionName: this.getName(), 
        error 
      });
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    await this.unsubscribeFromEvents();
    this.emit('stopped');
    this.logger.info('Projection stopped', { projectionName: this.getName() });
  }

  public async reset(): Promise<void> {
    const wasRunning = this.isRunning;
    
    if (wasRunning) {
      await this.stop();
    }

    try {
      await this.resetProjection();
      await this.clearCheckpoint();
      this.lastPosition = null;
      this.eventsProcessed = 0;
      this.errorCount = 0;
      this.lastError = undefined;

      this.emit('reset');
      this.logger.info('Projection reset', { projectionName: this.getName() });

      if (wasRunning) {
        await this.start();
      }
    } catch (error) {
      this.logger.error('Failed to reset projection', { 
        projectionName: this.getName(), 
        error 
      });
      throw error;
    }
  }

  public async rebuild(): Promise<void> {
    await this.reset();
    await this.start();
    
    // Process all historical events
    await this.processHistoricalEvents();
    
    this.emit('rebuilt');
    this.logger.info('Projection rebuilt', { projectionName: this.getName() });
  }

  public getStats(): ProjectionStats {
    const processingRate = this.calculateProcessingRate();
    const lagTime = this.calculateLagTime();
    
    return {
      name: this.getName(),
      lastPosition: this.lastPosition,
      eventsProcessed: this.eventsProcessed,
      errorCount: this.errorCount,
      lastError: this.lastError,
      processingRate,
      lagTime,
      isHealthy: this.isHealthy()
    };
  }

  public isRunning(): boolean {
    return this.isRunning;
  }

  protected async processEvent(event: DomainEvent): Promise<void> {
    if (!this.canHandle(event)) {
      return;
    }

    const startTime = Date.now();
    
    try {
      await this.handle(event);
      this.eventsProcessed++;
      this.lastPosition = this.createEventPosition(event);
      
      // Save checkpoint periodically
      if (this.eventsProcessed % this.options.checkpointInterval === 0) {
        await this.saveCheckpoint();
      }

      const processingTime = Date.now() - startTime;
      this.emit('event-processed', event, processingTime);
      
      this.logger.debug('Event processed', {
        projectionName: this.getName(),
        eventId: event.id,
        eventType: event.eventType,
        processingTime
      });
    } catch (error) {
      this.errorCount++;
      this.lastError = error;
      
      this.emit('event-failed', event, error);
      
      this.logger.error('Failed to process event', {
        projectionName: this.getName(),
        eventId: event.id,
        eventType: event.eventType,
        error: error.message
      });

      if (this.errorCount >= this.options.retryAttempts) {
        this.logger.error('Too many errors, stopping projection', {
          projectionName: this.getName(),
          errorCount: this.errorCount
        });
        await this.stop();
        throw error;
      }

      // Retry with delay
      await this.sleep(this.options.retryDelay);
      await this.processEvent(event);
    }
  }

  protected async subscribeToEvents(): Promise<void> {
    // Subscribe to new events
    this.eventStore.on('event', (event: DomainEvent) => {
      this.processEvent(event).catch(error => {
        this.logger.error('Error in event subscription handler', {
          projectionName: this.getName(),
          error
        });
      });
    });
  }

  protected async unsubscribeFromEvents(): Promise<void> {
    this.eventStore.removeAllListeners('event');
  }

  protected async processHistoricalEvents(): Promise<void> {
    const batchSize = this.options.bufferSize;
    let position = this.lastPosition?.position || 0;
    let hasMoreEvents = true;

    while (hasMoreEvents && this.isRunning) {
      try {
        const events = await this.eventStore.getAllEvents(
          undefined,
          { streamName: '', position, timestamp: new Date(), eventId: '' },
          batchSize
        );

        if (events.length === 0) {
          hasMoreEvents = false;
          break;
        }

        // Process events in batch
        for (const event of events) {
          if (!this.isRunning) {
            break;
          }
          
          await this.processEvent(event);
          position = this.getEventPosition(event);
        }

        // Save checkpoint after batch
        await this.saveCheckpoint();
        
        this.logger.debug('Processed historical events batch', {
          projectionName: this.getName(),
          batchSize: events.length,
          currentPosition: position
        });
      } catch (error) {
        this.logger.error('Failed to process historical events', {
          projectionName: this.getName(),
          error
        });
        throw error;
      }
    }
  }

  protected async loadCheckpoint(): Promise<void> {
    // Implementation would load from persistent storage
    // For now, keep in memory
  }

  protected async saveCheckpoint(): Promise<void> {
    if (!this.lastPosition) {
      return;
    }

    const checkpoint: CheckpointData = {
      projectionName: this.getName(),
      position: this.lastPosition,
      timestamp: new Date()
    };

    // Implementation would save to persistent storage
    this.logger.debug('Checkpoint saved', {
      projectionName: this.getName(),
      position: this.lastPosition
    });
  }

  protected async clearCheckpoint(): Promise<void> {
    // Implementation would clear from persistent storage
  }

  private createEventPosition(event: DomainEvent): any {
    return {
      streamName: `${event.aggregateType}-${event.aggregateId}`,
      position: event.version,
      timestamp: event.timestamp,
      eventId: event.id
    };
  }

  private getEventPosition(event: DomainEvent): number {
    return event.version;
  }

  private calculateProcessingRate(): number {
    if (!this.startTime) {
      return 0;
    }

    const runningTime = (Date.now() - this.startTime.getTime()) / 1000; // seconds
    return this.eventsProcessed / runningTime;
  }

  private calculateLagTime(): number {
    if (!this.lastPosition) {
      return 0;
    }

    const now = new Date();
    const lastUpdate = new Date(this.lastPosition.timestamp);
    return now.getTime() - lastUpdate.getTime();
  }

  private isHealthy(): boolean {
    const maxErrorRate = 0.1; // 10% error rate threshold
    const errorRate = this.eventsProcessed > 0 ? this.errorCount / this.eventsProcessed : 0;
    const maxLagTime = 5 * 60 * 1000; // 5 minutes
    
    return errorRate < maxErrorRate && this.calculateLagTime() < maxLagTime;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class ProjectionManager extends EventEmitter {
  private readonly logger = pino({ name: 'ProjectionManager' });
  private readonly projections = new Map<string, Projection>();
  private isRunning = false;

  public register(projection: Projection): void {
    const name = projection.getName();
    
    if (this.projections.has(name)) {
      throw new Error(`Projection already registered: ${name}`);
    }

    this.projections.set(name, projection);
    
    // Subscribe to projection events
    projection.on('started', () => this.emit('projection-started', name));
    projection.on('stopped', () => this.emit('projection-stopped', name));
    projection.on('reset', () => this.emit('projection-reset', name));
    projection.on('rebuilt', () => this.emit('projection-rebuilt', name));
    projection.on('event-processed', (event, time) => 
      this.emit('projection-event-processed', name, event, time));
    projection.on('event-failed', (event, error) => 
      this.emit('projection-event-failed', name, event, error));

    this.logger.info('Projection registered', { projectionName: name });
  }

  public unregister(projectionName: string): void {
    const projection = this.projections.get(projectionName);
    if (projection && projection.isRunning()) {
      throw new Error(`Cannot unregister running projection: ${projectionName}`);
    }

    if (this.projections.delete(projectionName)) {
      this.logger.info('Projection unregistered', { projectionName });
    }
  }

  public async startAll(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    const projections = Array.from(this.projections.values());
    
    // Initialize all projections first
    await Promise.all(projections.map(p => p.initialize()));
    
    // Start all projections
    await Promise.all(projections.map(p => p.start()));
    
    this.isRunning = true;
    this.emit('all-started');
    
    this.logger.info('All projections started', { 
      count: projections.length 
    });
  }

  public async stopAll(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    const projections = Array.from(this.projections.values());
    await Promise.all(projections.map(p => p.stop()));
    
    this.isRunning = false;
    this.emit('all-stopped');
    
    this.logger.info('All projections stopped', { 
      count: projections.length 
    });
  }

  public async startProjection(projectionName: string): Promise<void> {
    const projection = this.projections.get(projectionName);
    if (!projection) {
      throw new Error(`Projection not found: ${projectionName}`);
    }

    await projection.start();
    this.logger.info('Projection started', { projectionName });
  }

  public async stopProjection(projectionName: string): Promise<void> {
    const projection = this.projections.get(projectionName);
    if (!projection) {
      throw new Error(`Projection not found: ${projectionName}`);
    }

    await projection.stop();
    this.logger.info('Projection stopped', { projectionName });
  }

  public async resetProjection(projectionName: string): Promise<void> {
    const projection = this.projections.get(projectionName);
    if (!projection) {
      throw new Error(`Projection not found: ${projectionName}`);
    }

    await projection.reset();
    this.logger.info('Projection reset', { projectionName });
  }

  public async rebuildProjection(projectionName: string): Promise<void> {
    const projection = this.projections.get(projectionName);
    if (!projection) {
      throw new Error(`Projection not found: ${projectionName}`);
    }

    await projection.rebuild();
    this.logger.info('Projection rebuilt', { projectionName });
  }

  public getProjectionStats(projectionName: string): ProjectionStats | null {
    const projection = this.projections.get(projectionName);
    return projection ? projection.getStats() : null;
  }

  public getAllStats(): ProjectionStats[] {
    return Array.from(this.projections.values()).map(p => p.getStats());
  }

  public getProjectionNames(): string[] {
    return Array.from(this.projections.keys());
  }

  public isProjectionRunning(projectionName: string): boolean {
    const projection = this.projections.get(projectionName);
    return projection ? projection.isRunning() : false;
  }
}
