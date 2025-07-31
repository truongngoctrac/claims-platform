# Event Sourcing Implementation

A comprehensive, production-ready event sourcing framework with CQRS, Saga patterns, event replay, versioning, and monitoring capabilities.

## 🚀 Features

### Core Event Sourcing
- ✅ **Event Store Implementation** - MongoDB-based event persistence with optimizations
- ✅ **Event Sourcing Patterns** - Aggregate roots, repositories, and domain patterns
- ✅ **Snapshot Strategies** - Automatic snapshot creation and restoration for performance
- ✅ **Event Versioning** - Forward and backward compatibility with event schema evolution

### CQRS (Command Query Responsibility Segregation)
- ✅ **Command Bus** - Reliable command handling with middleware support
- ✅ **Query Bus** - Optimized query processing with caching
- ✅ **Projections** - Automatic read model generation and maintenance
- ✅ **Read Models** - Denormalized views for fast queries

### Event Processing
- ✅ **Event Replay** - Historical event processing and projection rebuilding
- ✅ **Event Stream Processing** - Real-time event processing with ordering guarantees
- ✅ **Eventual Consistency** - Reliable eventual consistency patterns
- ✅ **Event Ordering** - Guaranteed event ordering within aggregates

### Saga Pattern
- ✅ **Distributed Transactions** - Long-running business processes
- ✅ **Compensation Actions** - Automatic rollback and error handling
- ✅ **Saga Orchestration** - Complex workflow management
- ✅ **Timeout Handling** - Automatic timeout and recovery

### Monitoring & Analytics
- ✅ **Event Monitoring** - Real-time metrics and health checks
- ✅ **Event Analytics** - Performance insights and bottleneck detection
- ✅ **Debugging Tools** - Comprehensive debugging and troubleshooting
- ✅ **Alert System** - Proactive issue detection and notification

## 📁 Architecture

```
scalability/event-sourcing/
├── base/                    # Core domain patterns
│   └── AggregateRoot.ts     # Base aggregate root implementation
├── store/                   # Event persistence layer
│   ├── EventStore.ts        # Main event store
│   ├── EventStoreRepository.ts # MongoDB repository
│   └── SnapshotStore.ts     # Snapshot management
├── cqrs/                    # CQRS implementation
│   ├── CommandBus.ts        # Command handling
│   ├── QueryBus.ts         # Query processing
│   └── Projection.ts       # Projection management
├── replay/                  # Event replay system
│   └── EventReplay.ts      # Replay engine
├── versioning/             # Event versioning
│   └── EventVersionManager.ts # Version management
├── saga/                   # Saga pattern
│   └── SagaManager.ts      # Saga orchestration
├── monitoring/             # Monitoring & analytics
│   └── EventMonitor.ts     # Comprehensive monitoring
├── serialization/          # Event serialization
│   └── EventSerializer.ts  # JSON/Avro serialization
├── patterns/               # Repository patterns
│   └── AggregateRepository.ts # Event-sourced repositories
├── types.ts                # Core type definitions
├── index.ts                # Main framework export
└── README.md               # This documentation
```

## 🛠 Installation & Setup

### Prerequisites
- Node.js 18+
- MongoDB 4.4+
- TypeScript 4.9+

### Dependencies
The framework uses these key dependencies:
- `mongodb` - Database persistence
- `pino` - Structured logging
- `uuid` - Unique identifier generation

### Basic Setup

```typescript
import { createEventSourcingFramework, DEFAULT_CONFIG } from './scalability/event-sourcing';

// Configure the framework
const config = {
  ...DEFAULT_CONFIG,
  mongodb: {
    connectionString: 'mongodb://localhost:27017',
    databaseName: 'my_eventstore'
  }
};

// Create and initialize
const framework = createEventSourcingFramework(config);
await framework.initialize();
```

## 📖 Usage Examples

### 1. Creating an Aggregate

```typescript
import { AggregateRoot, DomainEvent } from './scalability/event-sourcing';

class ClaimAggregate extends AggregateRoot {
  private status: string = 'draft';
  private amount: number = 0;

  protected registerEventHandlers(): void {
    this.registerEventHandler('ClaimCreated', this.onClaimCreated.bind(this));
    this.registerEventHandler('ClaimSubmitted', this.onClaimSubmitted.bind(this));
  }

  public static create(id: string, amount: number): ClaimAggregate {
    const claim = new ClaimAggregate(id);
    claim.raiseEvent('ClaimCreated', { amount });
    return claim;
  }

  public submit(): void {
    if (this.status !== 'draft') {
      throw new Error('Cannot submit non-draft claim');
    }
    this.raiseEvent('ClaimSubmitted', { submittedAt: new Date() });
  }

  private onClaimCreated(event: DomainEvent): void {
    this.amount = event.eventData.amount;
    this.status = 'draft';
  }

  private onClaimSubmitted(event: DomainEvent): void {
    this.status = 'submitted';
  }
}
```

### 2. Command Handling

```typescript
import { BaseCommandHandler, Command } from './scalability/event-sourcing';

class CreateClaimHandler extends BaseCommandHandler<Command> {
  constructor(private claimRepository: EventSourcedRepository<ClaimAggregate>) {
    super();
  }

  public getCommandType(): string {
    return 'CreateClaim';
  }

  public async handle(command: Command): Promise<string> {
    const claim = ClaimAggregate.create(
      command.aggregateId,
      command.payload.amount
    );

    await this.claimRepository.save(claim);
    return claim.getId();
  }
}

// Register and use
framework.commandBus.register(new CreateClaimHandler(claimRepository));

const result = await framework.commandBus.send({
  id: '123',
  commandType: 'CreateClaim',
  aggregateId: 'claim-456',
  payload: { amount: 1000 },
  metadata: { correlationId: 'corr-789', source: 'web' },
  timestamp: new Date()
});
```

### 3. Projections

```typescript
import { BaseProjection, DomainEvent } from './scalability/event-sourcing';

class ClaimSummaryProjection extends BaseProjection {
  private summaries = new Map<string, any>();

  public getName(): string {
    return 'ClaimSummary';
  }

  public canHandle(event: DomainEvent): boolean {
    return event.aggregateType === 'ClaimAggregate';
  }

  public async handle(event: DomainEvent): Promise<void> {
    switch (event.eventType) {
      case 'ClaimCreated':
        this.summaries.set(event.aggregateId, {
          id: event.aggregateId,
          amount: event.eventData.amount,
          status: 'draft'
        });
        break;
      case 'ClaimSubmitted':
        const summary = this.summaries.get(event.aggregateId);
        if (summary) {
          summary.status = 'submitted';
        }
        break;
    }
  }

  protected async initializeProjection(): Promise<void> {
    // Initialize projection storage
  }

  protected async resetProjection(): Promise<void> {
    this.summaries.clear();
  }
}

// Register and start
const projection = new ClaimSummaryProjection(framework.eventStore, {
  bufferSize: 100,
  concurrency: 5,
  retryAttempts: 3,
  retryDelay: 1000,
  checkpointInterval: 10
});

framework.projectionManager.register(projection);
await framework.projectionManager.startAll();
```

### 4. Event Replay

```typescript
import { EventReplayEngine, BaseReplayHandler } from './scalability/event-sourcing';

class ProjectionReplayHandler extends BaseReplayHandler {
  constructor(private projection: any) {
    super();
  }

  public getName(): string {
    return 'ProjectionReplay';
  }

  public canHandle(event: DomainEvent): boolean {
    return this.projection.canHandle(event);
  }

  public async handle(event: DomainEvent): Promise<void> {
    await this.projection.handle(event);
  }
}

// Start replay
const replayId = await framework.replayEngine.startReplay(
  {
    fromTimestamp: new Date('2024-01-01'),
    toTimestamp: new Date('2024-12-31'),
    aggregateTypes: ['ClaimAggregate']
  },
  [new ProjectionReplayHandler(projection)],
  {
    batchSize: 50,
    maxConcurrency: 3,
    stopOnError: false
  }
);

// Monitor progress
const progress = framework.replayEngine.getReplayProgress(replayId);
console.log(`Progress: ${progress.processedEvents}/${progress.totalEvents}`);
```

### 5. Saga Pattern

```typescript
import { SagaDefinition, SagaStep } from './scalability/event-sourcing';

const claimProcessingSaga: SagaDefinition = {
  id: 'claim-processing-saga',
  name: 'ClaimProcessingSaga',
  version: '1.0',
  steps: [
    {
      id: 'validate-claim',
      name: 'Validate Claim',
      command: {
        id: '',
        commandType: 'ValidateClaim',
        aggregateId: '',
        payload: {},
        metadata: { correlationId: '', source: 'saga' },
        timestamp: new Date()
      },
      compensation: {
        id: '',
        commandType: 'RevertValidation',
        aggregateId: '',
        payload: {},
        metadata: { correlationId: '', source: 'saga' },
        timestamp: new Date()
      },
      onSuccess: { nextStep: 'process-payment' },
      onFailure: { compensate: true }
    },
    {
      id: 'process-payment',
      name: 'Process Payment',
      command: {
        id: '',
        commandType: 'ProcessPayment',
        aggregateId: '',
        payload: {},
        metadata: { correlationId: '', source: 'saga' },
        timestamp: new Date()
      },
      compensation: {
        id: '',
        commandType: 'RefundPayment',
        aggregateId: '',
        payload: {},
        metadata: { correlationId: '', source: 'saga' },
        timestamp: new Date()
      },
      onSuccess: { endSaga: true },
      onFailure: { compensate: true }
    }
  ],
  compensationStrategy: 'reverse-order',
  timeout: 300000 // 5 minutes
};

// Register and start saga
framework.sagaManager.registerSaga(claimProcessingSaga);

const sagaId = await framework.sagaManager.startSaga(
  'ClaimProcessingSaga',
  { claimId: 'claim-123', amount: 1000 },
  'correlation-456'
);
```

### 6. Event Versioning

```typescript
import { EventVersioningBuilder, VersioningTransformations } from './scalability/event-sourcing';

// Define event versioning rules
const claimCreatedVersioning = new EventVersioningBuilder()
  .forEventType('ClaimCreated')
  .withCurrentVersion('2.0')
  .addUpcastRule(
    '1.0', '2.0',
    VersioningTransformations.addField('category', 'general')
  )
  .addDowncastRule(
    '2.0', '1.0',
    VersioningTransformations.removeField('category')
  )
  .build();

// Register versioning rules
framework.versionManager.registerVersioning(claimCreatedVersioning);
```

### 7. Monitoring & Analytics

```typescript
// Get real-time analytics
const analytics = framework.monitor.getAnalytics();
console.log('Events per second:', analytics.throughput.eventsPerSecond);
console.log('P95 latency:', analytics.processingLatency.p95, 'ms');

// Check system health
const health = framework.monitor.getHealthStatus();
console.log('Overall health:', health.overall);

// Get debug information
const debug = await framework.monitor.getDebugInfo();
console.log('Total events:', debug.eventStore.totalEvents);
console.log('Active projections:', debug.projections.length);

// Custom alerts
framework.alertManager.addRule({
  name: 'high-claim-volume',
  condition: (analytics, health) => {
    const claimEvents = analytics.eventCounts.get('ClaimCreated') || 0;
    return claimEvents > 1000; // Alert if more than 1000 claims created
  },
  severity: 'warning',
  message: 'High claim creation volume detected',
  cooldownMs: 5 * 60 * 1000 // 5 minutes
});
```

## 🔧 Configuration

### Event Store Configuration

```typescript
const config = {
  eventStore: {
    batchSize: 100,           // Events per batch
    snapshotFrequency: 50,    // Snapshot every N events
    retentionPeriod: 365 * 24 * 60 * 60 * 1000, // 1 year
    compressionEnabled: true, // Compress snapshots
    encryptionEnabled: false, // Encrypt sensitive data
    indexingStrategy: 'eager' // Index events immediately
  }
};
```

### Projection Configuration

```typescript
const projectionOptions = {
  bufferSize: 100,        // Event buffer size
  concurrency: 5,         // Parallel processing
  retryAttempts: 3,       // Retry failed events
  retryDelay: 1000,       // Delay between retries (ms)
  checkpointInterval: 10  // Checkpoint every N events
};
```

### Monitoring Configuration

```typescript
const config = {
  monitoring: {
    enabled: true,        // Enable monitoring
    alertsEnabled: true,  // Enable alerting
    metricsInterval: 60000, // Metrics collection interval (ms)
    healthCheckInterval: 30000 // Health check interval (ms)
  }
};
```

## 🚀 Performance Optimizations

### Event Store
- **Batching**: Events are saved in configurable batches
- **Snapshots**: Automatic snapshot creation for fast aggregate loading
- **Compression**: Optional snapshot compression
- **Indexing**: Strategic database indexing for fast queries

### Projections
- **Parallel Processing**: Configurable concurrency for event processing
- **Checkpointing**: Regular progress checkpoints for resumability
- **Buffering**: Event buffering for efficient batch processing

### Monitoring
- **Sampling**: Configurable metrics sampling to reduce overhead
- **Caching**: Intelligent caching of frequently accessed data
- **Lazy Loading**: On-demand loading of detailed statistics

## 🛡 Error Handling & Resilience

### Retry Mechanisms
- Configurable retry policies for commands and events
- Exponential backoff strategies
- Dead letter queues for failed events

### Circuit Breakers
- Automatic circuit breaking for failing components
- Health-based recovery strategies
- Graceful degradation patterns

### Compensation
- Automatic saga compensation on failures
- Configurable compensation strategies
- Manual compensation triggers

## 📊 Monitoring & Observability

### Metrics Collected
- **Throughput**: Events, commands, and queries per second
- **Latency**: Processing time percentiles (P50, P95, P99)
- **Errors**: Error rates by component and type
- **Health**: Component health status and diagnostics

### Available Alerts
- High error rates
- System health degradation
- Processing latency spikes
- Low throughput warnings
- Resource usage alerts

### Debug Information
- Complete system state snapshot
- Event store statistics
- Projection health and progress
- Saga status and history
- Performance analytics

## 🔒 Security Considerations

### Data Protection
- Optional event encryption at rest
- Secure credential management
- Audit logging capabilities

### Access Control
- Command authorization middleware
- Query permission checks
- Administrative operation controls

## 🔄 Migration & Upgrades

### Event Schema Evolution
- Forward and backward compatibility
- Automated event upcasting/downcasting
- Version migration strategies

### Zero-Downtime Deployments
- Blue-green deployment support
- Rolling update capabilities
- Backward compatibility guarantees

## 🧪 Testing

### Unit Testing
```typescript
import { ExampleClaimAggregate } from './scalability/event-sourcing';

describe('ClaimAggregate', () => {
  it('should create claim with correct initial state', () => {
    const claim = ExampleClaimAggregate.create('claim-1', 'Test claim', 1000);
    
    expect(claim.getStatus()).toBe('draft');
    expect(claim.getAmount()).toBe(1000);
    expect(claim.getUncommittedEvents()).toHaveLength(1);
    expect(claim.getUncommittedEvents()[0].eventType).toBe('ClaimCreated');
  });

  it('should submit claim successfully', () => {
    const claim = ExampleClaimAggregate.create('claim-1', 'Test claim', 1000);
    claim.clearUncommittedEvents(); // Clear creation event
    
    claim.submit();
    
    expect(claim.getStatus()).toBe('submitted');
    expect(claim.getUncommittedEvents()).toHaveLength(1);
    expect(claim.getUncommittedEvents()[0].eventType).toBe('ClaimSubmitted');
  });
});
```

### Integration Testing
```typescript
describe('Event Sourcing Integration', () => {
  let framework: EventSourcingFramework;

  beforeEach(async () => {
    framework = createEventSourcingFramework({
      ...DEFAULT_CONFIG,
      mongodb: { connectionString: 'mongodb://localhost:27017', databaseName: 'test' }
    });
    await framework.initialize();
  });

  afterEach(async () => {
    await framework.shutdown();
  });

  it('should handle complete claim lifecycle', async () => {
    // Test end-to-end claim processing
    const commandResult = await framework.commandBus.send({
      id: 'cmd-1',
      commandType: 'CreateClaim',
      aggregateId: 'claim-1',
      payload: { description: 'Test claim', amount: 1000 },
      metadata: { correlationId: 'corr-1', source: 'test' },
      timestamp: new Date()
    });

    expect(commandResult).toBeDefined();
    
    // Verify events were stored
    const events = await framework.eventStore.getEvents('claim-1', 'ExampleClaimAggregate');
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('ClaimCreated');
  });
});
```

## 📚 Best Practices

### Aggregate Design
- Keep aggregates small and focused
- Ensure aggregate consistency boundaries
- Avoid loading large numbers of events

### Event Design
- Make events immutable and serializable
- Include all necessary data in events
- Use descriptive event names and data

### Command Design
- Validate commands before processing
- Include correlation IDs for tracing
- Design idempotent operations

### Projection Design
- Keep projections focused on specific read concerns
- Handle event ordering carefully
- Implement proper error handling

### Saga Design
- Keep sagas stateless where possible
- Implement proper compensation logic
- Handle timeouts and failures gracefully

## 🤝 Contributing

This implementation is part of a larger healthcare claims processing system. When extending or modifying:

1. Follow the established patterns and conventions
2. Add comprehensive tests for new features
3. Update documentation for any API changes
4. Consider backward compatibility impacts
5. Test performance implications

## 📖 Further Reading

- [Event Sourcing Pattern](https://martinfowler.com/eaaDev/EventSourcing.html)
- [CQRS Pattern](https://martinfowler.com/bliki/CQRS.html)
- [Saga Pattern](https://microservices.io/patterns/data/saga.html)
- [Event Store Design](https://eventstore.com/blog/what-is-event-sourcing/)

---

This event sourcing implementation provides a solid foundation for building scalable, maintainable applications with comprehensive audit trails, eventual consistency, and powerful replay capabilities.
