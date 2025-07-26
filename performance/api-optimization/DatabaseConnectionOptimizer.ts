import { EventEmitter } from 'events';

export interface ConnectionPoolConfig {
  min: number;
  max: number;
  acquireTimeoutMs: number;
  createTimeoutMs: number;
  destroyTimeoutMs: number;
  idleTimeoutMs: number;
  reapIntervalMs: number;
  createRetryIntervalMs: number;
  validateInterval: number;
  enableHealthCheck: boolean;
  enableMetrics: boolean;
}

export interface Connection {
  id: string;
  createdAt: Date;
  lastUsed: Date;
  isInUse: boolean;
  isValid: boolean;
  errorCount: number;
  queryCount: number;
  totalTime: number;
  client: any; // Database client
}

export interface PoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  pendingRequests: number;
  totalQueries: number;
  averageQueryTime: number;
  connectionErrors: number;
  poolHits: number;
  poolMisses: number;
}

export interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: Date;
  connectionId: string;
  error?: string;
}

export class DatabaseConnectionOptimizer extends EventEmitter {
  private config: ConnectionPoolConfig;
  private connections: Map<string, Connection> = new Map();
  private availableConnections: Connection[] = [];
  private pendingRequests: Array<{
    resolve: (connection: Connection) => void;
    reject: (error: Error) => void;
    requestedAt: Date;
  }> = [];
  
  private stats: PoolStats = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    pendingRequests: 0,
    totalQueries: 0,
    averageQueryTime: 0,
    connectionErrors: 0,
    poolHits: 0,
    poolMisses: 0
  };

  private reapInterval: NodeJS.Timeout;
  private healthCheckInterval: NodeJS.Timeout;
  private queryMetrics: QueryMetrics[] = [];
  private slowQueries: Map<string, number> = new Map();

  constructor(config: ConnectionPoolConfig, private connectionFactory: () => Promise<any>) {
    super();
    this.config = config;
    this.initializePool();
    this.startReaper();
    
    if (this.config.enableHealthCheck) {
      this.startHealthChecker();
    }
  }

  private async initializePool(): Promise<void> {
    // Create minimum number of connections
    const promises = Array(this.config.min).fill(null).map(() => this.createConnection());
    await Promise.allSettled(promises);
    
    console.log(`Database pool initialized with ${this.availableConnections.length} connections`);
  }

  private async createConnection(): Promise<Connection> {
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const client = await Promise.race([
        this.connectionFactory(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection creation timeout')), this.config.createTimeoutMs)
        )
      ]);

      const connection: Connection = {
        id: connectionId,
        createdAt: new Date(),
        lastUsed: new Date(),
        isInUse: false,
        isValid: true,
        errorCount: 0,
        queryCount: 0,
        totalTime: 0,
        client
      };

      this.connections.set(connectionId, connection);
      this.availableConnections.push(connection);
      this.stats.totalConnections++;
      this.stats.idleConnections++;

      this.emit('connectionCreated', connection);
      return connection;

    } catch (error) {
      this.stats.connectionErrors++;
      this.emit('connectionError', error);
      throw error;
    }
  }

  async acquireConnection(): Promise<Connection> {
    // Try to get an available connection
    if (this.availableConnections.length > 0) {
      const connection = this.availableConnections.shift()!;
      connection.isInUse = true;
      connection.lastUsed = new Date();
      
      this.stats.activeConnections++;
      this.stats.idleConnections--;
      this.stats.poolHits++;
      
      this.emit('connectionAcquired', connection);
      return connection;
    }

    // Create new connection if under max limit
    if (this.connections.size < this.config.max) {
      try {
        const connection = await this.createConnection();
        connection.isInUse = true;
        
        this.stats.activeConnections++;
        this.stats.idleConnections--;
        this.stats.poolMisses++;
        
        this.emit('connectionAcquired', connection);
        return connection;
      } catch (error) {
        // Fall through to queuing
      }
    }

    // Queue the request
    return new Promise((resolve, reject) => {
      const request = {
        resolve,
        reject,
        requestedAt: new Date()
      };

      this.pendingRequests.push(request);
      this.stats.pendingRequests++;

      // Set timeout for pending request
      setTimeout(() => {
        const index = this.pendingRequests.indexOf(request);
        if (index !== -1) {
          this.pendingRequests.splice(index, 1);
          this.stats.pendingRequests--;
          reject(new Error('Connection acquisition timeout'));
        }
      }, this.config.acquireTimeoutMs);
    });
  }

  releaseConnection(connection: Connection): void {
    if (!connection.isInUse) {
      console.warn(`Attempting to release connection ${connection.id} that is not in use`);
      return;
    }

    connection.isInUse = false;
    connection.lastUsed = new Date();
    
    this.stats.activeConnections--;

    // Check if connection is still valid
    if (!connection.isValid || connection.errorCount > 5) {
      this.destroyConnection(connection);
      return;
    }

    // Serve pending request if any
    if (this.pendingRequests.length > 0) {
      const request = this.pendingRequests.shift()!;
      this.stats.pendingRequests--;
      
      connection.isInUse = true;
      this.stats.activeConnections++;
      
      request.resolve(connection);
    } else {
      // Return to available pool
      this.availableConnections.push(connection);
      this.stats.idleConnections++;
    }

    this.emit('connectionReleased', connection);
  }

  private async destroyConnection(connection: Connection): Promise<void> {
    try {
      this.connections.delete(connection.id);
      
      // Remove from available connections if present
      const index = this.availableConnections.indexOf(connection);
      if (index !== -1) {
        this.availableConnections.splice(index, 1);
        this.stats.idleConnections--;
      }

      this.stats.totalConnections--;

      // Close the actual database connection
      if (connection.client && typeof connection.client.end === 'function') {
        await Promise.race([
          connection.client.end(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Destroy timeout')), this.config.destroyTimeoutMs)
          )
        ]);
      }

      this.emit('connectionDestroyed', connection);

    } catch (error) {
      console.error(`Error destroying connection ${connection.id}:`, error);
    }
  }

  async executeQuery<T = any>(query: string, params?: any[]): Promise<T> {
    const startTime = Date.now();
    let connection: Connection | null = null;

    try {
      connection = await this.acquireConnection();
      
      // Execute query with timeout
      const result = await Promise.race([
        this.performQuery(connection, query, params),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), 30000)
        )
      ]) as T;

      const duration = Date.now() - startTime;
      this.recordQueryMetrics(query, duration, connection.id);
      
      connection.queryCount++;
      connection.totalTime += duration;

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (connection) {
        connection.errorCount++;
        this.recordQueryMetrics(query, duration, connection.id, error instanceof Error ? error.message : String(error));
        
        // Mark connection as invalid if too many errors
        if (connection.errorCount > 3) {
          connection.isValid = false;
        }
      }

      throw error;

    } finally {
      if (connection) {
        this.releaseConnection(connection);
      }
    }
  }

  private async performQuery(connection: Connection, query: string, params?: any[]): Promise<any> {
    // This would be implemented based on your database client
    // Example for a generic client:
    if (typeof connection.client.query === 'function') {
      return await connection.client.query(query, params);
    }
    
    throw new Error('Database client does not support query method');
  }

  private recordQueryMetrics(query: string, duration: number, connectionId: string, error?: string): void {
    if (!this.config.enableMetrics) return;

    const metric: QueryMetrics = {
      query: query.substring(0, 100), // Truncate for storage
      duration,
      timestamp: new Date(),
      connectionId,
      error
    };

    this.queryMetrics.push(metric);
    
    // Keep only recent metrics
    if (this.queryMetrics.length > 1000) {
      this.queryMetrics = this.queryMetrics.slice(-1000);
    }

    // Track slow queries
    if (duration > 1000) { // Slow query threshold: 1 second
      const querySignature = this.getQuerySignature(query);
      const count = this.slowQueries.get(querySignature) || 0;
      this.slowQueries.set(querySignature, count + 1);
    }

    // Update average query time
    this.stats.totalQueries++;
    this.stats.averageQueryTime = 
      (this.stats.averageQueryTime * (this.stats.totalQueries - 1) + duration) / 
      this.stats.totalQueries;
  }

  private getQuerySignature(query: string): string {
    // Normalize query for tracking (remove values, keep structure)
    return query
      .replace(/\s+/g, ' ')
      .replace(/\$\d+/g, '?')
      .replace(/'[^']*'/g, '?')
      .replace(/\d+/g, '?')
      .toLowerCase()
      .trim();
  }

  private startReaper(): void {
    this.reapInterval = setInterval(() => {
      this.reapIdleConnections();
    }, this.config.reapIntervalMs);
  }

  private reapIdleConnections(): void {
    const now = Date.now();
    const connectionsToReap: Connection[] = [];

    // Find idle connections to reap
    this.availableConnections.forEach(connection => {
      const idleTime = now - connection.lastUsed.getTime();
      if (idleTime > this.config.idleTimeoutMs && this.connections.size > this.config.min) {
        connectionsToReap.push(connection);
      }
    });

    // Reap connections
    connectionsToReap.forEach(connection => {
      const index = this.availableConnections.indexOf(connection);
      if (index !== -1) {
        this.availableConnections.splice(index, 1);
        this.destroyConnection(connection);
      }
    });

    if (connectionsToReap.length > 0) {
      console.log(`Reaped ${connectionsToReap.length} idle connections`);
    }
  }

  private startHealthChecker(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.validateInterval);
  }

  private async performHealthCheck(): Promise<void> {
    const healthCheckPromises = Array.from(this.connections.values()).map(async (connection) => {
      if (connection.isInUse) return; // Skip connections in use

      try {
        // Perform a simple query to validate connection
        await this.performQuery(connection, 'SELECT 1');
        connection.isValid = true;
      } catch (error) {
        console.warn(`Health check failed for connection ${connection.id}:`, error);
        connection.isValid = false;
        connection.errorCount++;
        
        if (connection.errorCount > 2) {
          this.destroyConnection(connection);
        }
      }
    });

    await Promise.allSettled(healthCheckPromises);
  }

  getStats(): PoolStats {
    this.stats.totalConnections = this.connections.size;
    this.stats.activeConnections = Array.from(this.connections.values()).filter(c => c.isInUse).length;
    this.stats.idleConnections = this.availableConnections.length;
    this.stats.pendingRequests = this.pendingRequests.length;
    
    return { ...this.stats };
  }

  getSlowQueries(limit: number = 10): Array<{query: string, count: number}> {
    return Array.from(this.slowQueries.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  getConnectionDetails(): Array<{
    id: string;
    age: number;
    isInUse: boolean;
    queryCount: number;
    averageQueryTime: number;
    errorCount: number;
  }> {
    const now = Date.now();
    
    return Array.from(this.connections.values()).map(connection => ({
      id: connection.id,
      age: now - connection.createdAt.getTime(),
      isInUse: connection.isInUse,
      queryCount: connection.queryCount,
      averageQueryTime: connection.queryCount > 0 ? connection.totalTime / connection.queryCount : 0,
      errorCount: connection.errorCount
    }));
  }

  optimizePoolSize(): {
    recommendedMin: number;
    recommendedMax: number;
    reasoning: string[];
  } {
    const stats = this.getStats();
    const reasoning: string[] = [];
    
    let recommendedMin = this.config.min;
    let recommendedMax = this.config.max;

    // Analyze usage patterns
    const utilizationRate = stats.activeConnections / stats.totalConnections;
    const pendingRatio = stats.pendingRequests / Math.max(stats.totalConnections, 1);

    if (utilizationRate > 0.8) {
      recommendedMax = Math.min(this.config.max * 1.5, 50);
      reasoning.push('High utilization detected - consider increasing max connections');
    }

    if (pendingRatio > 0.1) {
      recommendedMax = Math.min(this.config.max * 1.2, 40);
      reasoning.push('Frequent queuing detected - increase pool size');
    }

    if (utilizationRate < 0.3 && stats.totalConnections > this.config.min) {
      recommendedMax = Math.max(this.config.max * 0.8, this.config.min + 2);
      reasoning.push('Low utilization - consider reducing max connections');
    }

    if (stats.idleConnections > stats.activeConnections * 2) {
      recommendedMin = Math.max(this.config.min - 2, 2);
      reasoning.push('Too many idle connections - reduce minimum pool size');
    }

    return {
      recommendedMin,
      recommendedMax,
      reasoning
    };
  }

  async warmPool(): Promise<void> {
    console.log('Warming up connection pool...');
    
    const targetConnections = Math.max(this.config.min, 5);
    const currentConnections = this.connections.size;
    
    if (currentConnections < targetConnections) {
      const needed = targetConnections - currentConnections;
      const promises = Array(needed).fill(null).map(() => this.createConnection());
      
      await Promise.allSettled(promises);
    }

    console.log(`Connection pool warmed up: ${this.connections.size} connections ready`);
  }

  generateReport(): {
    poolEfficiency: number;
    connectionTurnover: number;
    queryPerformance: {
      averageTime: number;
      slowQueries: number;
      errorRate: number;
    };
    recommendations: string[];
  } {
    const stats = this.getStats();
    const recommendations: string[] = [];
    
    const poolEfficiency = stats.totalConnections > 0 ? 
      (stats.poolHits / (stats.poolHits + stats.poolMisses)) * 100 : 0;
    
    const connectionTurnover = stats.totalConnections > 0 ?
      stats.totalQueries / stats.totalConnections : 0;
    
    const errorRate = stats.totalQueries > 0 ?
      (stats.connectionErrors / stats.totalQueries) * 100 : 0;

    // Generate recommendations
    if (poolEfficiency < 80) {
      recommendations.push('Pool efficiency is low - consider increasing min connections');
    }

    if (connectionTurnover > 1000) {
      recommendations.push('High connection turnover - consider connection pooling optimization');
    }

    if (errorRate > 5) {
      recommendations.push('High error rate detected - check database connectivity and queries');
    }

    if (this.slowQueries.size > 10) {
      recommendations.push('Multiple slow queries detected - consider query optimization');
    }

    return {
      poolEfficiency,
      connectionTurnover,
      queryPerformance: {
        averageTime: stats.averageQueryTime,
        slowQueries: this.slowQueries.size,
        errorRate
      },
      recommendations
    };
  }

  async shutdown(): Promise<void> {
    console.log('Shutting down database connection pool...');
    
    // Clear intervals
    if (this.reapInterval) clearInterval(this.reapInterval);
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);

    // Reject all pending requests
    this.pendingRequests.forEach(request => {
      request.reject(new Error('Pool is shutting down'));
    });
    this.pendingRequests = [];

    // Close all connections
    const closePromises = Array.from(this.connections.values()).map(connection => 
      this.destroyConnection(connection)
    );

    await Promise.allSettled(closePromises);
    
    this.connections.clear();
    this.availableConnections = [];
    
    console.log('Database connection pool shutdown complete');
  }
}

// Predefined pool configurations
export const PoolPresets = {
  small: {
    min: 2,
    max: 10,
    acquireTimeoutMs: 5000,
    createTimeoutMs: 3000,
    destroyTimeoutMs: 1000,
    idleTimeoutMs: 30000,
    reapIntervalMs: 10000,
    createRetryIntervalMs: 1000,
    validateInterval: 60000,
    enableHealthCheck: true,
    enableMetrics: true
  },

  medium: {
    min: 5,
    max: 20,
    acquireTimeoutMs: 10000,
    createTimeoutMs: 5000,
    destroyTimeoutMs: 2000,
    idleTimeoutMs: 60000,
    reapIntervalMs: 15000,
    createRetryIntervalMs: 2000,
    validateInterval: 120000,
    enableHealthCheck: true,
    enableMetrics: true
  },

  large: {
    min: 10,
    max: 50,
    acquireTimeoutMs: 15000,
    createTimeoutMs: 10000,
    destroyTimeoutMs: 5000,
    idleTimeoutMs: 120000,
    reapIntervalMs: 30000,
    createRetryIntervalMs: 5000,
    validateInterval: 300000,
    enableHealthCheck: true,
    enableMetrics: true
  }
};
