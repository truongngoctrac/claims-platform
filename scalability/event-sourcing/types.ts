export interface DomainEvent {
  id: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  eventType: string;
  eventData: Record<string, any>;
  metadata: EventMetadata;
  timestamp: Date;
  correlationId?: string;
  causationId?: string;
}

export interface EventMetadata {
  userId?: string;
  sessionId?: string;
  source: string;
  version: string;
  contentType: string;
  serialization: 'json' | 'binary' | 'avro';
  tags?: string[];
  traceId?: string;
  spanId?: string;
}

export interface EventStream {
  aggregateId: string;
  aggregateType: string;
  version: number;
  events: DomainEvent[];
  snapshots?: Snapshot[];
}

export interface Snapshot {
  id: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  data: Record<string, any>;
  timestamp: Date;
  metadata: SnapshotMetadata;
}

export interface SnapshotMetadata {
  compression?: 'gzip' | 'lz4' | 'snappy';
  serialization: 'json' | 'binary' | 'avro';
  checksum: string;
  size: number;
}

export interface EventStoreOptions {
  batchSize: number;
  snapshotFrequency: number;
  retentionPeriod: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  indexingStrategy: 'eager' | 'lazy' | 'none';
}

export interface ProjectionOptions {
  bufferSize: number;
  concurrency: number;
  retryAttempts: number;
  retryDelay: number;
  checkpointInterval: number;
}

export interface EventSubscription {
  id: string;
  streamName: string;
  fromPosition: number;
  maxRetries: number;
  batchSize: number;
  handler: EventHandler;
  filter?: EventFilter;
  deadLetterQueue?: string;
}

export interface EventFilter {
  eventTypes?: string[];
  aggregateTypes?: string[];
  aggregateIds?: string[];
  fromTimestamp?: Date;
  toTimestamp?: Date;
  metadata?: Record<string, any>;
}

export interface EventHandler {
  handle(event: DomainEvent): Promise<void>;
  canHandle(event: DomainEvent): boolean;
  getHandlerName(): string;
}

export interface Command {
  id: string;
  aggregateId: string;
  commandType: string;
  payload: Record<string, any>;
  metadata: CommandMetadata;
  timestamp: Date;
  expectedVersion?: number;
}

export interface CommandMetadata {
  userId?: string;
  sessionId?: string;
  correlationId: string;
  causationId?: string;
  source: string;
  timeout?: number;
  retryPolicy?: RetryPolicy;
}

export interface Query {
  id: string;
  queryType: string;
  parameters: Record<string, any>;
  metadata: QueryMetadata;
  timestamp: Date;
}

export interface QueryMetadata {
  userId?: string;
  sessionId?: string;
  correlationId: string;
  source: string;
  timeout?: number;
  cachePolicy?: CachePolicy;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffStrategy: 'linear' | 'exponential' | 'fixed';
  initialDelay: number;
  maxDelay: number;
  jitter: boolean;
}

export interface CachePolicy {
  ttl: number;
  strategy: 'write-through' | 'write-behind' | 'cache-aside';
  invalidateOnUpdate: boolean;
}

export interface SagaDefinition {
  id: string;
  name: string;
  version: string;
  steps: SagaStep[];
  timeout?: number;
  compensationStrategy: 'reverse-order' | 'parallel' | 'custom';
  retryPolicy?: RetryPolicy;
}

export interface SagaStep {
  id: string;
  name: string;
  command: Command;
  compensation?: Command;
  timeout?: number;
  retryPolicy?: RetryPolicy;
  condition?: string;
  onSuccess?: SagaTransition;
  onFailure?: SagaTransition;
}

export interface SagaTransition {
  nextStep?: string;
  endSaga?: boolean;
  compensate?: boolean;
}

export interface SagaInstance {
  id: string;
  sagaType: string;
  version: string;
  status: SagaStatus;
  currentStep: string;
  data: Record<string, any>;
  startedAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  compensatedAt?: Date;
  correlationId: string;
  causationId?: string;
}

export enum SagaStatus {
  STARTED = 'STARTED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  COMPENSATING = 'COMPENSATING',
  COMPENSATED = 'COMPENSATED',
  TIMEOUT = 'TIMEOUT'
}

export interface EventPosition {
  streamName: string;
  position: number;
  timestamp: Date;
  eventId: string;
}

export interface CheckpointData {
  projectionName: string;
  position: EventPosition;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface EventStreamPosition {
  global: number;
  stream: number;
  timestamp: Date;
}

export interface EventStoreStats {
  totalEvents: number;
  totalStreams: number;
  totalSnapshots: number;
  averageEventsPerStream: number;
  oldestEvent: Date;
  newestEvent: Date;
  storageSize: number;
  indexSize: number;
}

export interface ProjectionStats {
  name: string;
  lastPosition: EventPosition;
  eventsProcessed: number;
  errorCount: number;
  lastError?: Error;
  processingRate: number;
  lagTime: number;
  isHealthy: boolean;
}

export interface SagaStats {
  totalSagas: number;
  activeSagas: number;
  completedSagas: number;
  failedSagas: number;
  compensatedSagas: number;
  averageExecutionTime: number;
  successRate: number;
}

export interface EventAnalytics {
  eventCounts: Map<string, number>;
  aggregateCounts: Map<string, number>;
  hourlyVolume: Map<string, number>;
  processingLatency: {
    p50: number;
    p95: number;
    p99: number;
  };
  errorRates: Map<string, number>;
  throughput: {
    eventsPerSecond: number;
    commandsPerSecond: number;
    queriesPerSecond: number;
  };
}

export interface DebugInfo {
  eventStore: EventStoreStats;
  projections: ProjectionStats[];
  sagas: SagaStats;
  analytics: EventAnalytics;
  health: HealthStatus;
}

export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  components: Map<string, ComponentHealth>;
  lastCheck: Date;
}

export interface ComponentHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  metrics?: Record<string, number>;
  lastCheck: Date;
}

export interface EventVersioning {
  eventType: string;
  version: string;
  upcastRules: UpcastRule[];
  downcastRules: DowncastRule[];
  migrationStrategy: 'eager' | 'lazy' | 'on-demand';
}

export interface UpcastRule {
  fromVersion: string;
  toVersion: string;
  transform: (event: DomainEvent) => DomainEvent;
  validate?: (event: DomainEvent) => boolean;
}

export interface DowncastRule {
  fromVersion: string;
  toVersion: string;
  transform: (event: DomainEvent) => DomainEvent;
  validate?: (event: DomainEvent) => boolean;
}

export interface EventualConsistencyConfig {
  maxRetries: number;
  retryDelay: number;
  deadLetterQueue: string;
  timeoutMs: number;
  orderingStrategy: 'global' | 'partition' | 'aggregate';
  conflictResolution: 'last-write-wins' | 'merge' | 'custom';
}

export interface ConflictResolution {
  strategy: string;
  resolver: (events: DomainEvent[]) => DomainEvent;
}

export interface StreamingConfig {
  parallelism: number;
  bufferSize: number;
  checkpointInterval: number;
  watermarkInterval: number;
  lateTolerance: number;
  orderingTimeout: number;
}
