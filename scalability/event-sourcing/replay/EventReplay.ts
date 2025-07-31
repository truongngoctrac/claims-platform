import { DomainEvent, EventFilter, EventPosition, EventStoreStats } from '../types';
import { EventStore } from '../store/EventStore';
import { EventEmitter } from 'events';
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';

export interface ReplayOptions {
  batchSize: number;
  maxConcurrency: number;
  delayBetweenBatches: number;
  includeSnapshots: boolean;
  validateOrder: boolean;
  stopOnError: boolean;
  resumeFromCheckpoint: boolean;
}

export interface ReplayFilter extends EventFilter {
  fromPosition?: EventPosition;
  toPosition?: EventPosition;
  skipEvents?: string[];
  includeOnly?: string[];
}

export interface ReplayProgress {
  replayId: string;
  totalEvents: number;
  processedEvents: number;
  failedEvents: number;
  currentPosition: EventPosition | null;
  startTime: Date;
  endTime?: Date;
  estimatedCompletionTime?: Date;
  status: ReplayStatus;
  errors: ReplayError[];
}

export interface ReplayError {
  eventId: string;
  eventType: string;
  aggregateId: string;
  error: Error;
  timestamp: Date;
  retryCount: number;
}

export enum ReplayStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export interface ReplayHandler {
  handle(event: DomainEvent): Promise<void>;
  canHandle(event: DomainEvent): boolean;
  getName(): string;
}

export class EventReplayEngine extends EventEmitter {
  private readonly logger = pino({ name: 'EventReplayEngine' });
  private readonly activeReplays = new Map<string, ReplayProgress>();
  private readonly handlers = new Map<string, ReplayHandler[]>();
  private readonly checkpoints = new Map<string, EventPosition>();

  constructor(private readonly eventStore: EventStore) {
    super();
  }

  public async startReplay(
    filter: ReplayFilter,
    handlers: ReplayHandler[],
    options: Partial<ReplayOptions> = {}
  ): Promise<string> {
    const replayId = uuidv4();
    const replayOptions: ReplayOptions = {
      batchSize: 100,
      maxConcurrency: 5,
      delayBetweenBatches: 100,
      includeSnapshots: false,
      validateOrder: true,
      stopOnError: false,
      resumeFromCheckpoint: false,
      ...options
    };

    try {
      // Estimate total events
      const totalEvents = await this.estimateEventCount(filter);
      
      // Initialize replay progress
      const progress: ReplayProgress = {
        replayId,
        totalEvents,
        processedEvents: 0,
        failedEvents: 0,
        currentPosition: filter.fromPosition || null,
        startTime: new Date(),
        status: ReplayStatus.PENDING,
        errors: []
      };

      this.activeReplays.set(replayId, progress);

      // Register handlers for this replay
      this.handlers.set(replayId, handlers);

      // Load checkpoint if resuming
      if (replayOptions.resumeFromCheckpoint) {
        const checkpoint = this.checkpoints.get(replayId);
        if (checkpoint) {
          progress.currentPosition = checkpoint;
          this.logger.info('Resuming replay from checkpoint', { replayId, checkpoint });
        }
      }

      // Start replay in background
      this.executeReplay(replayId, filter, replayOptions)
        .catch(error => {
          this.logger.error('Replay execution failed', { replayId, error });
          this.updateReplayStatus(replayId, ReplayStatus.FAILED);
        });

      this.emit('replay-started', replayId, progress);
      this.logger.info('Event replay started', { replayId, totalEvents });

      return replayId;
    } catch (error) {
      this.logger.error('Failed to start replay', { error });
      throw error;
    }
  }

  public async pauseReplay(replayId: string): Promise<void> {
    const progress = this.activeReplays.get(replayId);
    if (!progress) {
      throw new Error(`Replay not found: ${replayId}`);
    }

    if (progress.status !== ReplayStatus.RUNNING) {
      throw new Error(`Cannot pause replay in status: ${progress.status}`);
    }

    this.updateReplayStatus(replayId, ReplayStatus.PAUSED);
    this.emit('replay-paused', replayId);
    this.logger.info('Replay paused', { replayId });
  }

  public async resumeReplay(replayId: string): Promise<void> {
    const progress = this.activeReplays.get(replayId);
    if (!progress) {
      throw new Error(`Replay not found: ${replayId}`);
    }

    if (progress.status !== ReplayStatus.PAUSED) {
      throw new Error(`Cannot resume replay in status: ${progress.status}`);
    }

    this.updateReplayStatus(replayId, ReplayStatus.RUNNING);
    this.emit('replay-resumed', replayId);
    this.logger.info('Replay resumed', { replayId });
  }

  public async cancelReplay(replayId: string): Promise<void> {
    const progress = this.activeReplays.get(replayId);
    if (!progress) {
      throw new Error(`Replay not found: ${replayId}`);
    }

    this.updateReplayStatus(replayId, ReplayStatus.CANCELLED);
    this.handlers.delete(replayId);
    this.checkpoints.delete(replayId);
    
    this.emit('replay-cancelled', replayId);
    this.logger.info('Replay cancelled', { replayId });
  }

  public getReplayProgress(replayId: string): ReplayProgress | null {
    return this.activeReplays.get(replayId) || null;
  }

  public getAllActiveReplays(): ReplayProgress[] {
    return Array.from(this.activeReplays.values())
      .filter(progress => progress.status === ReplayStatus.RUNNING || progress.status === ReplayStatus.PAUSED);
  }

  public async createReplaySnapshot(
    aggregateId: string,
    aggregateType: string,
    upToVersion: number
  ): Promise<DomainEvent[]> {
    try {
      const events = await this.eventStore.getEvents(aggregateId, aggregateType, 0, upToVersion);
      
      this.logger.info('Replay snapshot created', {
        aggregateId,
        aggregateType,
        eventCount: events.length,
        upToVersion
      });

      return events;
    } catch (error) {
      this.logger.error('Failed to create replay snapshot', {
        aggregateId,
        aggregateType,
        upToVersion,
        error
      });
      throw error;
    }
  }

  public async replayToNewHandler(
    handler: ReplayHandler,
    filter: ReplayFilter,
    options: Partial<ReplayOptions> = {}
  ): Promise<string> {
    return this.startReplay(filter, [handler], options);
  }

  public async validateEventOrder(
    events: DomainEvent[],
    aggregateId: string
  ): Promise<{ isValid: boolean; issues: string[] }> {
    const issues: string[] = [];
    let lastVersion = 0;

    for (const event of events) {
      if (event.aggregateId !== aggregateId) {
        issues.push(`Event ${event.id} belongs to different aggregate: ${event.aggregateId}`);
        continue;
      }

      if (event.version !== lastVersion + 1) {
        issues.push(`Version gap detected: expected ${lastVersion + 1}, got ${event.version}`);
      }

      lastVersion = event.version;
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  private async executeReplay(
    replayId: string,
    filter: ReplayFilter,
    options: ReplayOptions
  ): Promise<void> {
    const progress = this.activeReplays.get(replayId)!;
    this.updateReplayStatus(replayId, ReplayStatus.RUNNING);

    try {
      let currentPosition = progress.currentPosition?.position || 0;
      let hasMoreEvents = true;
      const handlers = this.handlers.get(replayId)!;

      while (hasMoreEvents && progress.status === ReplayStatus.RUNNING) {
        // Check if paused
        if (progress.status === ReplayStatus.PAUSED) {
          await this.waitForResume(replayId);
        }

        // Check if cancelled
        if (progress.status === ReplayStatus.CANCELLED) {
          break;
        }

        // Fetch batch of events
        const events = await this.fetchEventBatch(filter, currentPosition, options.batchSize);
        
        if (events.length === 0) {
          hasMoreEvents = false;
          break;
        }

        // Process events in batch
        await this.processBatch(replayId, events, handlers, options);

        // Update position
        currentPosition = this.getLastEventPosition(events);
        this.updateCurrentPosition(replayId, currentPosition);

        // Save checkpoint
        this.saveCheckpoint(replayId, currentPosition);

        // Delay between batches if configured
        if (options.delayBetweenBatches > 0) {
          await this.sleep(options.delayBetweenBatches);
        }

        this.emit('replay-batch-processed', replayId, events.length);
      }

      if (progress.status === ReplayStatus.RUNNING) {
        this.completeReplay(replayId);
      }

    } catch (error) {
      this.logger.error('Replay execution error', { replayId, error });
      this.updateReplayStatus(replayId, ReplayStatus.FAILED);
      this.emit('replay-failed', replayId, error);
    }
  }

  private async processBatch(
    replayId: string,
    events: DomainEvent[],
    handlers: ReplayHandler[],
    options: ReplayOptions
  ): Promise<void> {
    const progress = this.activeReplays.get(replayId)!;
    const concurrencyLimit = Math.min(options.maxConcurrency, events.length);
    const batches = this.chunkArray(events, concurrencyLimit);

    for (const batch of batches) {
      const promises = batch.map(event => this.processEvent(replayId, event, handlers, options));
      await Promise.all(promises);
    }
  }

  private async processEvent(
    replayId: string,
    event: DomainEvent,
    handlers: ReplayHandler[],
    options: ReplayOptions
  ): Promise<void> {
    const progress = this.activeReplays.get(replayId)!;

    try {
      // Filter events if specified
      if (this.shouldSkipEvent(event, options)) {
        return;
      }

      // Validate order if required
      if (options.validateOrder) {
        // Implementation would validate event ordering
      }

      // Process with handlers
      const applicableHandlers = handlers.filter(h => h.canHandle(event));
      
      for (const handler of applicableHandlers) {
        await handler.handle(event);
      }

      progress.processedEvents++;
      this.emit('replay-event-processed', replayId, event);

    } catch (error) {
      progress.failedEvents++;
      
      const replayError: ReplayError = {
        eventId: event.id,
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        error,
        timestamp: new Date(),
        retryCount: 0
      };

      progress.errors.push(replayError);
      
      this.emit('replay-event-failed', replayId, event, error);

      if (options.stopOnError) {
        throw error;
      }
    }
  }

  private async fetchEventBatch(
    filter: ReplayFilter,
    fromPosition: number,
    batchSize: number
  ): Promise<DomainEvent[]> {
    const eventFilter = {
      ...filter,
      fromTimestamp: filter.fromTimestamp,
      toTimestamp: filter.toTimestamp,
      eventTypes: filter.eventTypes,
      aggregateTypes: filter.aggregateTypes,
      aggregateIds: filter.aggregateIds
    };

    const fromPos = filter.fromPosition || {
      streamName: '',
      position: fromPosition,
      timestamp: new Date(),
      eventId: ''
    };

    return this.eventStore.getAllEvents(eventFilter, fromPos, batchSize);
  }

  private async estimateEventCount(filter: ReplayFilter): Promise<number> {
    // Implementation would estimate based on filter criteria
    // For now, return a rough estimate
    const events = await this.eventStore.getAllEvents(filter, filter.fromPosition, 1000);
    return events.length;
  }

  private shouldSkipEvent(event: DomainEvent, options: any): boolean {
    // Check skip list
    if (options.skipEvents && options.skipEvents.includes(event.eventType)) {
      return true;
    }

    // Check include list
    if (options.includeOnly && !options.includeOnly.includes(event.eventType)) {
      return true;
    }

    return false;
  }

  private getLastEventPosition(events: DomainEvent[]): any {
    if (events.length === 0) {
      return null;
    }

    const lastEvent = events[events.length - 1];
    return {
      streamName: `${lastEvent.aggregateType}-${lastEvent.aggregateId}`,
      position: lastEvent.version,
      timestamp: lastEvent.timestamp,
      eventId: lastEvent.id
    };
  }

  private updateReplayStatus(replayId: string, status: ReplayStatus): void {
    const progress = this.activeReplays.get(replayId);
    if (progress) {
      progress.status = status;
      
      if (status === ReplayStatus.COMPLETED || status === ReplayStatus.FAILED || status === ReplayStatus.CANCELLED) {
        progress.endTime = new Date();
      }
    }
  }

  private updateCurrentPosition(replayId: string, position: any): void {
    const progress = this.activeReplays.get(replayId);
    if (progress) {
      progress.currentPosition = position;
      
      // Update estimated completion time
      if (progress.totalEvents > 0 && progress.processedEvents > 0) {
        const progressPercent = progress.processedEvents / progress.totalEvents;
        const elapsedTime = Date.now() - progress.startTime.getTime();
        const estimatedTotalTime = elapsedTime / progressPercent;
        progress.estimatedCompletionTime = new Date(progress.startTime.getTime() + estimatedTotalTime);
      }
    }
  }

  private saveCheckpoint(replayId: string, position: any): void {
    this.checkpoints.set(replayId, position);
  }

  private completeReplay(replayId: string): void {
    this.updateReplayStatus(replayId, ReplayStatus.COMPLETED);
    this.handlers.delete(replayId);
    this.checkpoints.delete(replayId);
    
    const progress = this.activeReplays.get(replayId)!;
    this.emit('replay-completed', replayId, progress);
    
    this.logger.info('Replay completed', {
      replayId,
      processedEvents: progress.processedEvents,
      failedEvents: progress.failedEvents,
      duration: Date.now() - progress.startTime.getTime()
    });
  }

  private async waitForResume(replayId: string): Promise<void> {
    return new Promise(resolve => {
      const checkStatus = () => {
        const progress = this.activeReplays.get(replayId);
        if (progress?.status === ReplayStatus.RUNNING) {
          resolve();
        } else {
          setTimeout(checkStatus, 100);
        }
      };
      checkStatus();
    });
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export abstract class BaseReplayHandler implements ReplayHandler {
  protected readonly logger = pino({ name: this.constructor.name });

  public abstract handle(event: DomainEvent): Promise<void>;
  public abstract canHandle(event: DomainEvent): boolean;
  public abstract getName(): string;

  protected logEventProcessed(event: DomainEvent): void {
    this.logger.debug('Event replayed', {
      handlerName: this.getName(),
      eventId: event.id,
      eventType: event.eventType,
      aggregateId: event.aggregateId
    });
  }

  protected logEventFailed(event: DomainEvent, error: Error): void {
    this.logger.error('Event replay failed', {
      handlerName: this.getName(),
      eventId: event.id,
      eventType: event.eventType,
      aggregateId: event.aggregateId,
      error: error.message
    });
  }
}

// Example replay handlers

export class ProjectionReplayHandler extends BaseReplayHandler {
  constructor(
    private readonly projectionName: string,
    private readonly projectionHandler: (event: DomainEvent) => Promise<void>
  ) {
    super();
  }

  public async handle(event: DomainEvent): Promise<void> {
    try {
      await this.projectionHandler(event);
      this.logEventProcessed(event);
    } catch (error) {
      this.logEventFailed(event, error);
      throw error;
    }
  }

  public canHandle(event: DomainEvent): boolean {
    return true; // Process all events for projection
  }

  public getName(): string {
    return `ProjectionReplayHandler-${this.projectionName}`;
  }
}

export class AggregateReplayHandler extends BaseReplayHandler {
  constructor(
    private readonly aggregateType: string,
    private readonly aggregateHandler: (event: DomainEvent) => Promise<void>
  ) {
    super();
  }

  public async handle(event: DomainEvent): Promise<void> {
    try {
      await this.aggregateHandler(event);
      this.logEventProcessed(event);
    } catch (error) {
      this.logEventFailed(event, error);
      throw error;
    }
  }

  public canHandle(event: DomainEvent): boolean {
    return event.aggregateType === this.aggregateType;
  }

  public getName(): string {
    return `AggregateReplayHandler-${this.aggregateType}`;
  }
}
