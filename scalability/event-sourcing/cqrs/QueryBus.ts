import { Query, QueryMetadata } from '../types';
import { EventEmitter } from 'events';
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';

export interface QueryHandler<TQuery extends Query, TResult> {
  handle(query: TQuery): Promise<TResult>;
  canHandle(query: Query): boolean;
  getQueryType(): string;
}

export interface QueryBus {
  execute<TQuery extends Query, TResult>(query: TQuery): Promise<TResult>;
  register<TQuery extends Query, TResult>(handler: QueryHandler<TQuery, TResult>): void;
  unregister(queryType: string): void;
}

export interface QueryMiddleware {
  execute<TQuery extends Query, TResult>(
    query: TQuery, 
    next: (query: TQuery) => Promise<TResult>
  ): Promise<TResult>;
}

export class InMemoryQueryBus extends EventEmitter implements QueryBus {
  private readonly logger = pino({ name: 'InMemoryQueryBus' });
  private readonly handlers = new Map<string, QueryHandler<any, any>>();
  private readonly middlewares: QueryMiddleware[] = [];
  private readonly cache = new Map<string, { result: any; timestamp: number; ttl: number }>();
  private readonly metrics = {
    queriesExecuted: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageExecutionTime: 0,
    queryCounts: new Map<string, number>()
  };

  public async execute<TQuery extends Query, TResult>(query: TQuery): Promise<TResult> {
    const startTime = Date.now();
    
    try {
      this.validateQuery(query);

      // Check cache first
      const cacheKey = this.generateCacheKey(query);
      const cachedResult = this.getCachedResult<TResult>(cacheKey);
      if (cachedResult !== null) {
        this.metrics.cacheHits++;
        this.emit('query-cache-hit', query);
        
        this.logger.debug('Query served from cache', {
          queryId: query.id,
          queryType: query.queryType,
          cacheKey
        });
        
        return cachedResult;
      }

      this.metrics.cacheMisses++;
      
      // Find handler
      const handler = this.handlers.get(query.queryType);
      if (!handler) {
        throw new QueryHandlerNotFoundError(query.queryType);
      }

      // Emit before execution
      this.emit('query-received', query);

      // Execute through middleware chain
      const result = await this.executeWithMiddleware(query, handler);

      // Cache result if caching is enabled
      this.cacheResultIfApplicable(query, cacheKey, result);

      // Update metrics
      const executionTime = Date.now() - startTime;
      this.updateMetrics(query, executionTime);

      // Emit after execution
      this.emit('query-executed', query, result);

      this.logger.debug('Query executed successfully', {
        queryId: query.id,
        queryType: query.queryType,
        executionTime
      });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.updateMetrics(query, executionTime);

      this.emit('query-failed', query, error);
      
      this.logger.error('Query execution failed', {
        queryId: query.id,
        queryType: query.queryType,
        error: error.message,
        executionTime
      });

      throw error;
    }
  }

  public register<TQuery extends Query, TResult>(
    handler: QueryHandler<TQuery, TResult>
  ): void {
    const queryType = handler.getQueryType();
    
    if (this.handlers.has(queryType)) {
      throw new Error(`Handler already registered for query type: ${queryType}`);
    }

    this.handlers.set(queryType, handler);
    
    this.logger.info('Query handler registered', { queryType });
  }

  public unregister(queryType: string): void {
    if (this.handlers.delete(queryType)) {
      this.logger.info('Query handler unregistered', { queryType });
    }
  }

  public addMiddleware(middleware: QueryMiddleware): void {
    this.middlewares.push(middleware);
    this.logger.info('Query middleware added', { 
      middlewareName: middleware.constructor.name 
    });
  }

  public invalidateCache(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      this.logger.info('All query cache cleared');
      return;
    }

    const keysToDelete = Array.from(this.cache.keys())
      .filter(key => key.includes(pattern));
    
    keysToDelete.forEach(key => this.cache.delete(key));
    
    this.logger.info('Query cache invalidated', { 
      pattern, 
      invalidatedCount: keysToDelete.length 
    });
  }

  public getMetrics(): any {
    const cacheHitRate = this.metrics.cacheHits / 
      (this.metrics.cacheHits + this.metrics.cacheMisses) * 100;

    return {
      ...this.metrics,
      cacheHitRate: isNaN(cacheHitRate) ? 0 : cacheHitRate,
      queryCounts: Object.fromEntries(this.metrics.queryCounts),
      cacheSize: this.cache.size
    };
  }

  public clearMetrics(): void {
    this.metrics.queriesExecuted = 0;
    this.metrics.cacheHits = 0;
    this.metrics.cacheMisses = 0;
    this.metrics.averageExecutionTime = 0;
    this.metrics.queryCounts.clear();
  }

  private async executeWithMiddleware<TQuery extends Query, TResult>(
    query: TQuery, 
    handler: QueryHandler<TQuery, TResult>
  ): Promise<TResult> {
    let index = 0;

    const next = async (q: TQuery): Promise<TResult> => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++];
        return middleware.execute(q, next);
      } else {
        return handler.handle(q);
      }
    };

    return next(query);
  }

  private validateQuery(query: Query): void {
    if (!query.id) {
      throw new InvalidQueryError('Query must have an id');
    }

    if (!query.queryType) {
      throw new InvalidQueryError('Query must have a queryType');
    }

    if (!query.metadata) {
      throw new InvalidQueryError('Query must have metadata');
    }

    if (!query.metadata.correlationId) {
      throw new InvalidQueryError('Query metadata must have correlationId');
    }
  }

  private generateCacheKey(query: Query): string {
    const keyData = {
      queryType: query.queryType,
      parameters: query.parameters
    };
    return `${query.queryType}:${JSON.stringify(keyData)}`;
  }

  private getCachedResult<TResult>(cacheKey: string): TResult | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) {
      return null;
    }

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached.result;
  }

  private cacheResultIfApplicable<TResult>(
    query: Query, 
    cacheKey: string, 
    result: TResult
  ): void {
    const cachePolicy = query.metadata.cachePolicy;
    if (!cachePolicy) {
      return;
    }

    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now(),
      ttl: cachePolicy.ttl
    });

    this.logger.debug('Query result cached', {
      queryId: query.id,
      cacheKey,
      ttl: cachePolicy.ttl
    });
  }

  private updateMetrics(query: Query, executionTime: number): void {
    this.metrics.queriesExecuted++;

    // Update average execution time
    const totalTime = this.metrics.averageExecutionTime * (this.metrics.queriesExecuted - 1);
    this.metrics.averageExecutionTime = (totalTime + executionTime) / this.metrics.queriesExecuted;

    // Update query type counts
    const currentCount = this.metrics.queryCounts.get(query.queryType) || 0;
    this.metrics.queryCounts.set(query.queryType, currentCount + 1);
  }
}

export abstract class BaseQueryHandler<TQuery extends Query, TResult> 
  implements QueryHandler<TQuery, TResult> {
  protected readonly logger = pino({ name: this.constructor.name });

  public abstract handle(query: TQuery): Promise<TResult>;
  public abstract getQueryType(): string;

  public canHandle(query: Query): boolean {
    return query.queryType === this.getQueryType();
  }

  protected validateQuery(query: TQuery): void {
    // Override in derived classes for specific validation
  }

  protected createQueryMetadata(
    userId?: string,
    sessionId?: string,
    source: string = 'system',
    cachePolicy?: { ttl: number; strategy: string }
  ): QueryMetadata {
    return {
      correlationId: uuidv4(),
      source,
      userId,
      sessionId,
      cachePolicy
    };
  }
}

// Query Middleware Implementations

export class LoggingQueryMiddleware implements QueryMiddleware {
  private readonly logger = pino({ name: 'LoggingQueryMiddleware' });

  public async execute<TQuery extends Query, TResult>(
    query: TQuery, 
    next: (query: TQuery) => Promise<TResult>
  ): Promise<TResult> {
    this.logger.info('Executing query', {
      queryId: query.id,
      queryType: query.queryType,
      correlationId: query.metadata.correlationId
    });

    const startTime = Date.now();
    
    try {
      const result = await next(query);
      const duration = Date.now() - startTime;
      
      this.logger.info('Query executed successfully', {
        queryId: query.id,
        queryType: query.queryType,
        duration
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error('Query execution failed', {
        queryId: query.id,
        queryType: query.queryType,
        error: error.message,
        duration
      });

      throw error;
    }
  }
}

export class AuthorizationQueryMiddleware implements QueryMiddleware {
  private readonly logger = pino({ name: 'AuthorizationQueryMiddleware' });

  constructor(
    private readonly authorize: (query: Query) => Promise<boolean>
  ) {}

  public async execute<TQuery extends Query, TResult>(
    query: TQuery, 
    next: (query: TQuery) => Promise<TResult>
  ): Promise<TResult> {
    const isAuthorized = await this.authorize(query);
    
    if (!isAuthorized) {
      throw new UnauthorizedQueryError(query.queryType, query.metadata.userId);
    }

    return next(query);
  }
}

export class PerformanceQueryMiddleware implements QueryMiddleware {
  private readonly logger = pino({ name: 'PerformanceQueryMiddleware' });
  private readonly slowQueryThreshold: number;

  constructor(slowQueryThreshold: number = 1000) {
    this.slowQueryThreshold = slowQueryThreshold;
  }

  public async execute<TQuery extends Query, TResult>(
    query: TQuery, 
    next: (query: TQuery) => Promise<TResult>
  ): Promise<TResult> {
    const startTime = Date.now();
    
    try {
      const result = await next(query);
      const duration = Date.now() - startTime;
      
      if (duration > this.slowQueryThreshold) {
        this.logger.warn('Slow query detected', {
          queryId: query.id,
          queryType: query.queryType,
          duration,
          threshold: this.slowQueryThreshold
        });
      }

      return result;
    } catch (error) {
      throw error;
    }
  }
}

// Error Classes

export class QueryHandlerNotFoundError extends Error {
  constructor(queryType: string) {
    super(`No handler found for query type: ${queryType}`);
    this.name = 'QueryHandlerNotFoundError';
  }
}

export class InvalidQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidQueryError';
  }
}

export class UnauthorizedQueryError extends Error {
  constructor(queryType: string, userId?: string) {
    super(`Unauthorized to execute query ${queryType} for user ${userId || 'unknown'}`);
    this.name = 'UnauthorizedQueryError';
  }
}

export class QueryTimeoutError extends Error {
  constructor(queryId: string, timeout: number) {
    super(`Query ${queryId} timed out after ${timeout}ms`);
    this.name = 'QueryTimeoutError';
  }
}

// Query Factory

export class QueryFactory {
  public static createQuery<T extends Query>(
    queryType: string,
    parameters: Record<string, any>,
    metadata: Partial<QueryMetadata> = {}
  ): T {
    return {
      id: uuidv4(),
      queryType,
      parameters,
      metadata: {
        correlationId: uuidv4(),
        source: 'application',
        ...metadata
      },
      timestamp: new Date()
    } as T;
  }
}

// Read Model Base Class

export abstract class ReadModel {
  public readonly id: string;
  public readonly version: number;
  public readonly lastUpdated: Date;

  protected constructor(id: string, version: number = 0) {
    this.id = id;
    this.version = version;
    this.lastUpdated = new Date();
  }

  public abstract toJSON(): Record<string, any>;
}

// Read Model Repository Interface

export interface ReadModelRepository<T extends ReadModel> {
  save(model: T): Promise<void>;
  findById(id: string): Promise<T | null>;
  findBy(criteria: Record<string, any>): Promise<T[]>;
  delete(id: string): Promise<void>;
  deleteAll(): Promise<void>;
}
