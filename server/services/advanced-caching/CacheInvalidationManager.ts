import { EventEmitter } from 'events';
import { MultiLevelCacheManager } from './MultiLevelCacheManager';
import { RedisClusterManager } from './RedisClusterManager';

export interface InvalidationRule {
  id: string;
  name: string;
  pattern: string | RegExp;
  type: 'pattern' | 'tag' | 'dependency' | 'ttl' | 'manual';
  enabled: boolean;
  conditions?: InvalidationCondition[];
  actions: InvalidationAction[];
  priority: number;
  createdAt: Date;
  lastTriggered?: Date;
  triggerCount: number;
}

export interface InvalidationCondition {
  type: 'time' | 'event' | 'data_change' | 'threshold';
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'regex' | 'greater_than' | 'less_than';
  value: any;
  field?: string;
}

export interface InvalidationAction {
  type: 'delete' | 'refresh' | 'tag_clear' | 'pattern_clear' | 'level_clear';
  target: string | string[];
  level?: 'L1' | 'L2' | 'L3' | 'all';
  delay?: number;
  async?: boolean;
}

export interface InvalidationEvent {
  type: string;
  data: any;
  timestamp: Date;
  source: string;
}

export interface InvalidationStats {
  totalInvalidations: number;
  invalidationsByType: Map<string, number>;
  invalidationsByRule: Map<string, number>;
  averageInvalidationTime: number;
  lastInvalidation?: Date;
  failedInvalidations: number;
}

export interface TaggedCacheItem {
  key: string;
  tags: Set<string>;
  dependencies: Set<string>;
  level: string;
  createdAt: Date;
  lastAccessed: Date;
}

export class CacheInvalidationManager extends EventEmitter {
  private cacheManager: MultiLevelCacheManager;
  private redisCluster: RedisClusterManager | null;
  private rules: Map<string, InvalidationRule> = new Map();
  private taggedItems: Map<string, TaggedCacheItem> = new Map();
  private dependencies: Map<string, Set<string>> = new Map();
  private stats: InvalidationStats;
  private invalidationQueue: Array<{ rule: InvalidationRule; event: InvalidationEvent }> = [];
  private processingQueue = false;

  constructor(cacheManager: MultiLevelCacheManager, redisCluster?: RedisClusterManager) {
    super();
    this.cacheManager = cacheManager;
    this.redisCluster = redisCluster || null;
    
    this.stats = {
      totalInvalidations: 0,
      invalidationsByType: new Map(),
      invalidationsByRule: new Map(),
      averageInvalidationTime: 0,
      failedInvalidations: 0,
    };

    this.setupEventListeners();
    this.startQueueProcessor();
  }

  private setupEventListeners(): void {
    // Listen to cache events
    this.cacheManager.on('cache-set', (event) => {
      this.handleCacheEvent('cache-set', event);
    });

    this.cacheManager.on('cache-delete', (event) => {
      this.handleCacheEvent('cache-delete', event);
    });

    this.cacheManager.on('cache-expired', (event) => {
      this.handleCacheEvent('cache-expired', event);
    });
  }

  private startQueueProcessor(): void {
    setInterval(async () => {
      if (!this.processingQueue && this.invalidationQueue.length > 0) {
        await this.processInvalidationQueue();
      }
    }, 100); // Process every 100ms
  }

  addRule(rule: Omit<InvalidationRule, 'id' | 'createdAt' | 'triggerCount'>): string {
    const id = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const fullRule: InvalidationRule = {
      id,
      createdAt: new Date(),
      triggerCount: 0,
      ...rule,
    };

    this.rules.set(id, fullRule);
    this.emit('rule-added', fullRule);
    
    return id;
  }

  removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    if (removed) {
      this.emit('rule-removed', ruleId);
    }
    return removed;
  }

  updateRule(ruleId: string, updates: Partial<InvalidationRule>): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    const updatedRule = { ...rule, ...updates };
    this.rules.set(ruleId, updatedRule);
    this.emit('rule-updated', updatedRule);
    
    return true;
  }

  enableRule(ruleId: string): boolean {
    return this.updateRule(ruleId, { enabled: true });
  }

  disableRule(ruleId: string): boolean {
    return this.updateRule(ruleId, { enabled: false });
  }

  async invalidateByPattern(pattern: string | RegExp, level?: 'L1' | 'L2' | 'L3' | 'all'): Promise<number> {
    const startTime = Date.now();
    let invalidatedCount = 0;

    try {
      // Get all keys that match the pattern
      const keysToInvalidate = await this.getKeysByPattern(pattern, level);
      
      // Invalidate each key
      for (const key of keysToInvalidate) {
        await this.cacheManager.delete(key, { level });
        invalidatedCount++;
      }

      this.updateStats('pattern', invalidatedCount, Date.now() - startTime);
      this.emit('pattern-invalidated', { pattern, count: invalidatedCount, level });

    } catch (error) {
      this.stats.failedInvalidations++;
      this.emit('invalidation-error', { type: 'pattern', pattern, error });
      throw error;
    }

    return invalidatedCount;
  }

  async invalidateByTag(tag: string, level?: 'L1' | 'L2' | 'L3' | 'all'): Promise<number> {
    const startTime = Date.now();
    let invalidatedCount = 0;

    try {
      const keysToInvalidate: string[] = [];

      // Find all items with this tag
      for (const [key, item] of this.taggedItems) {
        if (item.tags.has(tag)) {
          if (!level || item.level === level || level === 'all') {
            keysToInvalidate.push(key);
          }
        }
      }

      // Invalidate each key
      for (const key of keysToInvalidate) {
        await this.cacheManager.delete(key, { level });
        this.taggedItems.delete(key);
        invalidatedCount++;
      }

      this.updateStats('tag', invalidatedCount, Date.now() - startTime);
      this.emit('tag-invalidated', { tag, count: invalidatedCount, level });

    } catch (error) {
      this.stats.failedInvalidations++;
      this.emit('invalidation-error', { type: 'tag', tag, error });
      throw error;
    }

    return invalidatedCount;
  }

  async invalidateByDependency(dependency: string, level?: 'L1' | 'L2' | 'L3' | 'all'): Promise<number> {
    const startTime = Date.now();
    let invalidatedCount = 0;

    try {
      const dependentKeys = this.dependencies.get(dependency) || new Set();
      
      for (const key of dependentKeys) {
        await this.cacheManager.delete(key, { level });
        invalidatedCount++;
      }

      // Clear the dependency mapping
      this.dependencies.delete(dependency);

      this.updateStats('dependency', invalidatedCount, Date.now() - startTime);
      this.emit('dependency-invalidated', { dependency, count: invalidatedCount, level });

    } catch (error) {
      this.stats.failedInvalidations++;
      this.emit('invalidation-error', { type: 'dependency', dependency, error });
      throw error;
    }

    return invalidatedCount;
  }

  async cascadeInvalidate(keys: string[], level?: 'L1' | 'L2' | 'L3' | 'all'): Promise<number> {
    const startTime = Date.now();
    let invalidatedCount = 0;

    try {
      const allKeysToInvalidate = new Set(keys);

      // Find all dependent keys
      for (const key of keys) {
        const taggedItem = this.taggedItems.get(key);
        if (taggedItem) {
          // Add all keys that depend on this key
          for (const dependency of taggedItem.dependencies) {
            const dependentKeys = this.dependencies.get(dependency) || new Set();
            dependentKeys.forEach(depKey => allKeysToInvalidate.add(depKey));
          }
        }
      }

      // Invalidate all keys
      for (const key of allKeysToInvalidate) {
        await this.cacheManager.delete(key, { level });
        this.taggedItems.delete(key);
        invalidatedCount++;
      }

      this.updateStats('cascade', invalidatedCount, Date.now() - startTime);
      this.emit('cascade-invalidated', { keys, count: invalidatedCount, level });

    } catch (error) {
      this.stats.failedInvalidations++;
      this.emit('invalidation-error', { type: 'cascade', keys, error });
      throw error;
    }

    return invalidatedCount;
  }

  async conditionalInvalidate(
    condition: (key: string, value: any) => boolean,
    level?: 'L1' | 'L2' | 'L3' | 'all'
  ): Promise<number> {
    const startTime = Date.now();
    let invalidatedCount = 0;

    try {
      const keysToCheck = await this.getAllKeys(level);
      
      for (const key of keysToCheck) {
        const value = await this.cacheManager.get(key);
        if (value && condition(key, value)) {
          await this.cacheManager.delete(key, { level });
          invalidatedCount++;
        }
      }

      this.updateStats('conditional', invalidatedCount, Date.now() - startTime);
      this.emit('conditional-invalidated', { count: invalidatedCount, level });

    } catch (error) {
      this.stats.failedInvalidations++;
      this.emit('invalidation-error', { type: 'conditional', error });
      throw error;
    }

    return invalidatedCount;
  }

  async timeBasedInvalidate(
    olderThan: Date,
    level?: 'L1' | 'L2' | 'L3' | 'all'
  ): Promise<number> {
    return this.conditionalInvalidate((key) => {
      const taggedItem = this.taggedItems.get(key);
      return taggedItem ? taggedItem.createdAt < olderThan : false;
    }, level);
  }

  addTaggedItem(key: string, tags: string[], dependencies?: string[], level = 'L1'): void {
    const item: TaggedCacheItem = {
      key,
      tags: new Set(tags),
      dependencies: new Set(dependencies || []),
      level,
      createdAt: new Date(),
      lastAccessed: new Date(),
    };

    this.taggedItems.set(key, item);

    // Update dependency mappings
    if (dependencies) {
      for (const dep of dependencies) {
        if (!this.dependencies.has(dep)) {
          this.dependencies.set(dep, new Set());
        }
        this.dependencies.get(dep)!.add(key);
      }
    }
  }

  removeTaggedItem(key: string): void {
    const item = this.taggedItems.get(key);
    if (item) {
      // Remove from dependency mappings
      for (const dep of item.dependencies) {
        const depSet = this.dependencies.get(dep);
        if (depSet) {
          depSet.delete(key);
          if (depSet.size === 0) {
            this.dependencies.delete(dep);
          }
        }
      }
    }
    this.taggedItems.delete(key);
  }

  async triggerRules(event: InvalidationEvent): Promise<void> {
    const matchingRules = this.findMatchingRules(event);
    
    for (const rule of matchingRules) {
      if (rule.enabled) {
        this.invalidationQueue.push({ rule, event });
      }
    }
  }

  private findMatchingRules(event: InvalidationEvent): InvalidationRule[] {
    const matchingRules: InvalidationRule[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      let matches = false;

      // Check pattern matching
      if (rule.type === 'pattern') {
        if (typeof rule.pattern === 'string') {
          matches = event.data.key?.includes(rule.pattern);
        } else if (rule.pattern instanceof RegExp) {
          matches = rule.pattern.test(event.data.key || '');
        }
      }

      // Check conditions
      if (rule.conditions) {
        matches = matches && this.evaluateConditions(rule.conditions, event);
      }

      if (matches) {
        matchingRules.push(rule);
      }
    }

    // Sort by priority
    return matchingRules.sort((a, b) => b.priority - a.priority);
  }

  private evaluateConditions(conditions: InvalidationCondition[], event: InvalidationEvent): boolean {
    return conditions.every(condition => {
      const value = condition.field ? event.data[condition.field] : event.data;
      
      switch (condition.operator) {
        case 'equals':
          return value === condition.value;
        case 'contains':
          return String(value).includes(String(condition.value));
        case 'starts_with':
          return String(value).startsWith(String(condition.value));
        case 'ends_with':
          return String(value).endsWith(String(condition.value));
        case 'regex':
          return new RegExp(condition.value).test(String(value));
        case 'greater_than':
          return Number(value) > Number(condition.value);
        case 'less_than':
          return Number(value) < Number(condition.value);
        default:
          return false;
      }
    });
  }

  private async processInvalidationQueue(): Promise<void> {
    if (this.processingQueue || this.invalidationQueue.length === 0) return;

    this.processingQueue = true;

    try {
      while (this.invalidationQueue.length > 0) {
        const { rule, event } = this.invalidationQueue.shift()!;
        await this.executeRule(rule, event);
      }
    } catch (error) {
      console.error('Error processing invalidation queue:', error);
    } finally {
      this.processingQueue = false;
    }
  }

  private async executeRule(rule: InvalidationRule, event: InvalidationEvent): Promise<void> {
    const startTime = Date.now();

    try {
      for (const action of rule.actions) {
        if (action.delay) {
          setTimeout(() => this.executeAction(action, event), action.delay);
        } else if (action.async) {
          this.executeAction(action, event).catch(console.error);
        } else {
          await this.executeAction(action, event);
        }
      }

      // Update rule stats
      rule.triggerCount++;
      rule.lastTriggered = new Date();
      this.rules.set(rule.id, rule);

      this.updateStats(rule.type, 1, Date.now() - startTime);
      this.emit('rule-executed', { rule, event });

    } catch (error) {
      this.stats.failedInvalidations++;
      this.emit('rule-execution-error', { rule, event, error });
      throw error;
    }
  }

  private async executeAction(action: InvalidationAction, event: InvalidationEvent): Promise<void> {
    switch (action.type) {
      case 'delete':
        if (Array.isArray(action.target)) {
          for (const key of action.target) {
            await this.cacheManager.delete(key, { level: action.level });
          }
        } else {
          await this.cacheManager.delete(action.target, { level: action.level });
        }
        break;

      case 'tag_clear':
        if (Array.isArray(action.target)) {
          for (const tag of action.target) {
            await this.invalidateByTag(tag, action.level);
          }
        } else {
          await this.invalidateByTag(action.target, action.level);
        }
        break;

      case 'pattern_clear':
        await this.invalidateByPattern(action.target as string, action.level);
        break;

      case 'level_clear':
        await this.cacheManager.clear(action.level);
        break;

      case 'refresh':
        // Refresh logic would go here
        this.emit('refresh-requested', { target: action.target, level: action.level });
        break;
    }
  }

  private async getKeysByPattern(pattern: string | RegExp, level?: string): Promise<string[]> {
    const keys: string[] = [];

    // This is a simplified implementation
    // In a real scenario, you'd need to iterate through cache keys more efficiently
    for (const [key] of this.taggedItems) {
      if (typeof pattern === 'string') {
        if (key.includes(pattern)) {
          keys.push(key);
        }
      } else if (pattern.test(key)) {
        keys.push(key);
      }
    }

    return keys;
  }

  private async getAllKeys(level?: string): Promise<string[]> {
    // This would need to be implemented based on your cache backend
    return Array.from(this.taggedItems.keys());
  }

  private handleCacheEvent(eventType: string, eventData: any): void {
    const event: InvalidationEvent = {
      type: eventType,
      data: eventData,
      timestamp: new Date(),
      source: 'cache',
    };

    this.triggerRules(event);
  }

  private updateStats(type: string, count: number, duration: number): void {
    this.stats.totalInvalidations += count;
    
    const typeCount = this.stats.invalidationsByType.get(type) || 0;
    this.stats.invalidationsByType.set(type, typeCount + count);

    // Update average invalidation time
    const totalTime = this.stats.averageInvalidationTime * (this.stats.totalInvalidations - count) + duration;
    this.stats.averageInvalidationTime = totalTime / this.stats.totalInvalidations;

    this.stats.lastInvalidation = new Date();
  }

  getStats(): InvalidationStats {
    return { ...this.stats };
  }

  getRules(): InvalidationRule[] {
    return Array.from(this.rules.values());
  }

  getTaggedItems(): TaggedCacheItem[] {
    return Array.from(this.taggedItems.values());
  }

  getDependencies(): Map<string, Set<string>> {
    return new Map(this.dependencies);
  }

  async shutdown(): Promise<void> {
    this.rules.clear();
    this.taggedItems.clear();
    this.dependencies.clear();
    this.invalidationQueue.length = 0;
    this.emit('shutdown');
  }
}
