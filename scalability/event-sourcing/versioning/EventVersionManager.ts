import { DomainEvent, EventVersioning, UpcastRule, DowncastRule } from '../types';
import pino from 'pino';

export class EventVersionManager {
  private readonly logger = pino({ name: 'EventVersionManager' });
  private readonly versioningRules = new Map<string, EventVersioning>();
  private readonly upcastRules = new Map<string, Map<string, UpcastRule[]>>();
  private readonly downcastRules = new Map<string, Map<string, DowncastRule[]>>();

  public registerVersioning(versioning: EventVersioning): void {
    this.versioningRules.set(versioning.eventType, versioning);
    
    // Build upcast rules index
    if (!this.upcastRules.has(versioning.eventType)) {
      this.upcastRules.set(versioning.eventType, new Map());
    }
    
    const eventUpcastRules = this.upcastRules.get(versioning.eventType)!;
    versioning.upcastRules.forEach(rule => {
      if (!eventUpcastRules.has(rule.fromVersion)) {
        eventUpcastRules.set(rule.fromVersion, []);
      }
      eventUpcastRules.get(rule.fromVersion)!.push(rule);
    });

    // Build downcast rules index
    if (!this.downcastRules.has(versioning.eventType)) {
      this.downcastRules.set(versioning.eventType, new Map());
    }
    
    const eventDowncastRules = this.downcastRules.get(versioning.eventType)!;
    versioning.downcastRules.forEach(rule => {
      if (!eventDowncastRules.has(rule.fromVersion)) {
        eventDowncastRules.set(rule.fromVersion, []);
      }
      eventDowncastRules.get(rule.fromVersion)!.push(rule);
    });

    this.logger.info('Event versioning registered', { 
      eventType: versioning.eventType,
      upcastRules: versioning.upcastRules.length,
      downcastRules: versioning.downcastRules.length
    });
  }

  public async upgradeEvent(event: DomainEvent): Promise<DomainEvent> {
    const versioning = this.versioningRules.get(event.eventType);
    if (!versioning) {
      return event; // No versioning rules, return as is
    }

    const currentVersion = event.metadata.version;
    const targetVersion = versioning.version;

    if (currentVersion === targetVersion) {
      return event; // Already at target version
    }

    if (this.isNewerVersion(currentVersion, targetVersion)) {
      return this.downcastEvent(event, targetVersion);
    } else {
      return this.upcastEvent(event, targetVersion);
    }
  }

  public async upcastEvent(event: DomainEvent, targetVersion: string): Promise<DomainEvent> {
    const eventType = event.eventType;
    const currentVersion = event.metadata.version;
    
    if (currentVersion === targetVersion) {
      return event;
    }

    const upcastRules = this.upcastRules.get(eventType);
    if (!upcastRules) {
      throw new EventVersioningError(
        `No upcast rules found for event type: ${eventType}`,
        eventType,
        currentVersion,
        targetVersion
      );
    }

    let upgradedEvent = { ...event };
    let fromVersion = currentVersion;

    // Find the path to upgrade
    const upgradePath = this.findUpgradePath(eventType, fromVersion, targetVersion);
    
    for (const stepVersion of upgradePath) {
      const rules = upcastRules.get(fromVersion);
      if (!rules) {
        throw new EventVersioningError(
          `No upcast rule found from version ${fromVersion} to ${stepVersion}`,
          eventType,
          fromVersion,
          stepVersion
        );
      }

      const applicableRule = rules.find(rule => rule.toVersion === stepVersion);
      if (!applicableRule) {
        throw new EventVersioningError(
          `No applicable upcast rule found from ${fromVersion} to ${stepVersion}`,
          eventType,
          fromVersion,
          stepVersion
        );
      }

      // Validate before transformation
      if (applicableRule.validate && !applicableRule.validate(upgradedEvent)) {
        throw new EventVersioningError(
          `Event validation failed before upcasting from ${fromVersion} to ${stepVersion}`,
          eventType,
          fromVersion,
          stepVersion
        );
      }

      // Apply transformation
      upgradedEvent = applicableRule.transform(upgradedEvent);
      upgradedEvent.metadata.version = stepVersion;
      
      this.logger.debug('Event upcasted', {
        eventId: event.id,
        eventType,
        fromVersion,
        toVersion: stepVersion
      });

      fromVersion = stepVersion;
    }

    return upgradedEvent;
  }

  public async downcastEvent(event: DomainEvent, targetVersion: string): Promise<DomainEvent> {
    const eventType = event.eventType;
    const currentVersion = event.metadata.version;
    
    if (currentVersion === targetVersion) {
      return event;
    }

    const downcastRules = this.downcastRules.get(eventType);
    if (!downcastRules) {
      throw new EventVersioningError(
        `No downcast rules found for event type: ${eventType}`,
        eventType,
        currentVersion,
        targetVersion
      );
    }

    let downgradedEvent = { ...event };
    let fromVersion = currentVersion;

    // Find the path to downgrade
    const downgradePath = this.findDowngradePath(eventType, fromVersion, targetVersion);
    
    for (const stepVersion of downgradePath) {
      const rules = downcastRules.get(fromVersion);
      if (!rules) {
        throw new EventVersioningError(
          `No downcast rule found from version ${fromVersion} to ${stepVersion}`,
          eventType,
          fromVersion,
          stepVersion
        );
      }

      const applicableRule = rules.find(rule => rule.toVersion === stepVersion);
      if (!applicableRule) {
        throw new EventVersioningError(
          `No applicable downcast rule found from ${fromVersion} to ${stepVersion}`,
          eventType,
          fromVersion,
          stepVersion
        );
      }

      // Validate before transformation
      if (applicableRule.validate && !applicableRule.validate(downgradedEvent)) {
        throw new EventVersioningError(
          `Event validation failed before downcasting from ${fromVersion} to ${stepVersion}`,
          eventType,
          fromVersion,
          stepVersion
        );
      }

      // Apply transformation
      downgradedEvent = applicableRule.transform(downgradedEvent);
      downgradedEvent.metadata.version = stepVersion;
      
      this.logger.debug('Event downcasted', {
        eventId: event.id,
        eventType,
        fromVersion,
        toVersion: stepVersion
      });

      fromVersion = stepVersion;
    }

    return downgradedEvent;
  }

  public getEventVersioning(eventType: string): EventVersioning | undefined {
    return this.versioningRules.get(eventType);
  }

  public getSupportedVersions(eventType: string): string[] {
    const versioning = this.versioningRules.get(eventType);
    if (!versioning) {
      return [];
    }

    const versions = new Set<string>();
    versions.add(versioning.version);
    
    versioning.upcastRules.forEach(rule => {
      versions.add(rule.fromVersion);
      versions.add(rule.toVersion);
    });
    
    versioning.downcastRules.forEach(rule => {
      versions.add(rule.fromVersion);
      versions.add(rule.toVersion);
    });

    return Array.from(versions).sort(this.compareVersions.bind(this));
  }

  public canUpgrade(eventType: string, fromVersion: string, toVersion: string): boolean {
    try {
      this.findUpgradePath(eventType, fromVersion, toVersion);
      return true;
    } catch {
      return false;
    }
  }

  public canDowngrade(eventType: string, fromVersion: string, toVersion: string): boolean {
    try {
      this.findDowngradePath(eventType, fromVersion, toVersion);
      return true;
    } catch {
      return false;
    }
  }

  private findUpgradePath(eventType: string, fromVersion: string, toVersion: string): string[] {
    const upcastRules = this.upcastRules.get(eventType);
    if (!upcastRules) {
      throw new Error(`No upcast rules for event type: ${eventType}`);
    }

    // Use breadth-first search to find the shortest path
    const queue: { version: string; path: string[] }[] = [{ version: fromVersion, path: [] }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { version: currentVersion, path } = queue.shift()!;
      
      if (currentVersion === toVersion) {
        return path;
      }

      if (visited.has(currentVersion)) {
        continue;
      }
      
      visited.add(currentVersion);
      
      const rules = upcastRules.get(currentVersion) || [];
      for (const rule of rules) {
        if (!visited.has(rule.toVersion)) {
          queue.push({
            version: rule.toVersion,
            path: [...path, rule.toVersion]
          });
        }
      }
    }

    throw new Error(`No upgrade path found from ${fromVersion} to ${toVersion}`);
  }

  private findDowngradePath(eventType: string, fromVersion: string, toVersion: string): string[] {
    const downcastRules = this.downcastRules.get(eventType);
    if (!downcastRules) {
      throw new Error(`No downcast rules for event type: ${eventType}`);
    }

    // Use breadth-first search to find the shortest path
    const queue: { version: string; path: string[] }[] = [{ version: fromVersion, path: [] }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { version: currentVersion, path } = queue.shift()!;
      
      if (currentVersion === toVersion) {
        return path;
      }

      if (visited.has(currentVersion)) {
        continue;
      }
      
      visited.add(currentVersion);
      
      const rules = downcastRules.get(currentVersion) || [];
      for (const rule of rules) {
        if (!visited.has(rule.toVersion)) {
          queue.push({
            version: rule.toVersion,
            path: [...path, rule.toVersion]
          });
        }
      }
    }

    throw new Error(`No downgrade path found from ${fromVersion} to ${toVersion}`);
  }

  private isNewerVersion(version1: string, version2: string): boolean {
    return this.compareVersions(version1, version2) > 0;
  }

  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    const maxLength = Math.max(v1Parts.length, v2Parts.length);
    
    for (let i = 0; i < maxLength; i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }
    
    return 0;
  }
}

export class EventVersioningError extends Error {
  constructor(
    message: string,
    public readonly eventType: string,
    public readonly fromVersion: string,
    public readonly toVersion: string
  ) {
    super(message);
    this.name = 'EventVersioningError';
  }
}

// Example versioning rules builder

export class EventVersioningBuilder {
  private eventType: string = '';
  private version: string = '1.0';
  private upcastRules: UpcastRule[] = [];
  private downcastRules: DowncastRule[] = [];
  private migrationStrategy: 'eager' | 'lazy' | 'on-demand' = 'lazy';

  public forEventType(eventType: string): this {
    this.eventType = eventType;
    return this;
  }

  public withCurrentVersion(version: string): this {
    this.version = version;
    return this;
  }

  public withMigrationStrategy(strategy: 'eager' | 'lazy' | 'on-demand'): this {
    this.migrationStrategy = strategy;
    return this;
  }

  public addUpcastRule(
    fromVersion: string,
    toVersion: string,
    transform: (event: DomainEvent) => DomainEvent,
    validate?: (event: DomainEvent) => boolean
  ): this {
    this.upcastRules.push({ fromVersion, toVersion, transform, validate });
    return this;
  }

  public addDowncastRule(
    fromVersion: string,
    toVersion: string,
    transform: (event: DomainEvent) => DomainEvent,
    validate?: (event: DomainEvent) => boolean
  ): this {
    this.downcastRules.push({ fromVersion, toVersion, transform, validate });
    return this;
  }

  public build(): EventVersioning {
    if (!this.eventType) {
      throw new Error('Event type is required');
    }

    return {
      eventType: this.eventType,
      version: this.version,
      upcastRules: this.upcastRules,
      downcastRules: this.downcastRules,
      migrationStrategy: this.migrationStrategy
    };
  }
}

// Common versioning transformations

export class VersioningTransformations {
  public static addField(fieldName: string, defaultValue: any) {
    return (event: DomainEvent): DomainEvent => ({
      ...event,
      eventData: {
        ...event.eventData,
        [fieldName]: defaultValue
      }
    });
  }

  public static removeField(fieldName: string) {
    return (event: DomainEvent): DomainEvent => {
      const { [fieldName]: removed, ...restData } = event.eventData;
      return {
        ...event,
        eventData: restData
      };
    };
  }

  public static renameField(oldName: string, newName: string) {
    return (event: DomainEvent): DomainEvent => {
      if (!(oldName in event.eventData)) {
        return event;
      }

      const { [oldName]: value, ...restData } = event.eventData;
      return {
        ...event,
        eventData: {
          ...restData,
          [newName]: value
        }
      };
    };
  }

  public static transformField(fieldName: string, transformer: (value: any) => any) {
    return (event: DomainEvent): DomainEvent => {
      if (!(fieldName in event.eventData)) {
        return event;
      }

      return {
        ...event,
        eventData: {
          ...event.eventData,
          [fieldName]: transformer(event.eventData[fieldName])
        }
      };
    };
  }

  public static splitField(fieldName: string, splitRules: Record<string, (value: any) => any>) {
    return (event: DomainEvent): DomainEvent => {
      if (!(fieldName in event.eventData)) {
        return event;
      }

      const { [fieldName]: originalValue, ...restData } = event.eventData;
      const newFields: Record<string, any> = {};

      Object.entries(splitRules).forEach(([newFieldName, extractor]) => {
        newFields[newFieldName] = extractor(originalValue);
      });

      return {
        ...event,
        eventData: {
          ...restData,
          ...newFields
        }
      };
    };
  }

  public static combineFields(fieldNames: string[], newFieldName: string, combiner: (...values: any[]) => any) {
    return (event: DomainEvent): DomainEvent => {
      const values = fieldNames.map(name => event.eventData[name]);
      const combinedValue = combiner(...values);

      const restData = { ...event.eventData };
      fieldNames.forEach(name => delete restData[name]);

      return {
        ...event,
        eventData: {
          ...restData,
          [newFieldName]: combinedValue
        }
      };
    };
  }
}
