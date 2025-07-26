import { DomainEvent } from '../types';
import pino from 'pino';

export interface EventSerializer {
  serialize(event: DomainEvent): any;
  deserialize(data: any): DomainEvent;
}

export class JsonEventSerializer implements EventSerializer {
  private readonly logger = pino({ name: 'JsonEventSerializer' });

  public serialize(event: DomainEvent): any {
    try {
      return {
        id: event.id,
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
        version: event.version,
        eventType: event.eventType,
        eventData: JSON.stringify(event.eventData),
        metadata: JSON.stringify(event.metadata),
        timestamp: event.timestamp,
        correlationId: event.correlationId,
        causationId: event.causationId
      };
    } catch (error) {
      this.logger.error('Failed to serialize event', { eventId: event.id, error });
      throw new Error(`Event serialization failed: ${error.message}`);
    }
  }

  public deserialize(data: any): DomainEvent {
    try {
      return {
        id: data.id,
        aggregateId: data.aggregateId,
        aggregateType: data.aggregateType,
        version: data.version,
        eventType: data.eventType,
        eventData: typeof data.eventData === 'string' ? JSON.parse(data.eventData) : data.eventData,
        metadata: typeof data.metadata === 'string' ? JSON.parse(data.metadata) : data.metadata,
        timestamp: new Date(data.timestamp),
        correlationId: data.correlationId,
        causationId: data.causationId
      };
    } catch (error) {
      this.logger.error('Failed to deserialize event', { eventId: data.id, error });
      throw new Error(`Event deserialization failed: ${error.message}`);
    }
  }
}

export class AvroEventSerializer implements EventSerializer {
  private readonly logger = pino({ name: 'AvroEventSerializer' });
  private schema: any;

  constructor(schema: any) {
    this.schema = schema;
  }

  public serialize(event: DomainEvent): any {
    try {
      // This is a simplified implementation
      // In a real system, you would use a proper Avro library
      return {
        ...event,
        eventData: JSON.stringify(event.eventData),
        metadata: JSON.stringify(event.metadata),
        timestamp: event.timestamp.getTime()
      };
    } catch (error) {
      this.logger.error('Failed to serialize event with Avro', { eventId: event.id, error });
      throw new Error(`Avro event serialization failed: ${error.message}`);
    }
  }

  public deserialize(data: any): DomainEvent {
    try {
      return {
        ...data,
        eventData: JSON.parse(data.eventData),
        metadata: JSON.parse(data.metadata),
        timestamp: new Date(data.timestamp)
      };
    } catch (error) {
      this.logger.error('Failed to deserialize event with Avro', { eventId: data.id, error });
      throw new Error(`Avro event deserialization failed: ${error.message}`);
    }
  }
}

export class EventSerializerFactory {
  private static readonly serializers = new Map<string, EventSerializer>();

  public static register(name: string, serializer: EventSerializer): void {
    this.serializers.set(name, serializer);
  }

  public static get(name: string): EventSerializer {
    const serializer = this.serializers.get(name);
    if (!serializer) {
      throw new Error(`No serializer registered with name: ${name}`);
    }
    return serializer;
  }

  public static initialize(): void {
    // Register default serializers
    this.register('json', new JsonEventSerializer());
    // Add Avro serializer if schema is available
    // this.register('avro', new AvroEventSerializer(avroSchema));
  }
}

// Initialize default serializers
EventSerializerFactory.initialize();
