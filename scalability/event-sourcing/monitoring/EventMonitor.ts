import {
  DomainEvent,
  EventAnalytics,
  HealthStatus,
  ComponentHealth,
  DebugInfo,
  EventStoreStats,
  ProjectionStats,
  SagaStats
} from '../types';
import { EventStore } from '../store/EventStore';
import { EventEmitter } from 'events';
import pino from 'pino';

export interface EventMonitor {
  start(): Promise<void>;
  stop(): Promise<void>;
  getAnalytics(): EventAnalytics;
  getHealthStatus(): HealthStatus;
  getDebugInfo(): DebugInfo;
  recordEvent(event: DomainEvent): void;
  recordProcessingTime(eventType: string, processingTime: number): void;
  recordError(component: string, error: Error): void;
}

export class ComprehensiveEventMonitor extends EventEmitter implements EventMonitor {
  private readonly logger = pino({ name: 'ComprehensiveEventMonitor' });
  private isRunning = false;
  private startTime = new Date();
  
  // Metrics storage
  private readonly eventCounts = new Map<string, number>();
  private readonly aggregateCounts = new Map<string, number>();
  private readonly hourlyVolume = new Map<string, number>();
  private readonly processingTimes: number[] = [];
  private readonly errorCounts = new Map<string, number>();
  private readonly componentHealthMap = new Map<string, ComponentHealth>();
  
  // Performance tracking
  private eventsPerSecond = 0;
  private commandsPerSecond = 0;
  private queriesPerSecond = 0;
  private lastMetricsReset = Date.now();
  
  // Health checking
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsResetInterval?: NodeJS.Timeout;

  constructor(
    private readonly eventStore: EventStore,
    private readonly projectionManager?: any,
    private readonly sagaManager?: any
  ) {
    super();
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.startTime = new Date();
    
    // Subscribe to event store events
    this.eventStore.on('event', this.handleEvent.bind(this));
    this.eventStore.on('event-processed', this.handleEventProcessed.bind(this));
    this.eventStore.on('command-processed', this.handleCommandProcessed.bind(this));
    this.eventStore.on('query-executed', this.handleQueryExecuted.bind(this));

    // Start health checking
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck().catch(error => {
        this.logger.error('Health check failed', { error });
      });
    }, 30000); // Every 30 seconds

    // Start metrics reset
    this.metricsResetInterval = setInterval(() => {
      this.resetCounters();
    }, 60000); // Every minute

    this.logger.info('Event monitor started');
    this.emit('monitor-started');
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.metricsResetInterval) {
      clearInterval(this.metricsResetInterval);
    }

    // Unsubscribe from events
    this.eventStore.removeAllListeners();

    this.logger.info('Event monitor stopped');
    this.emit('monitor-stopped');
  }

  public recordEvent(event: DomainEvent): void {
    // Update event counts
    const currentCount = this.eventCounts.get(event.eventType) || 0;
    this.eventCounts.set(event.eventType, currentCount + 1);

    // Update aggregate counts
    const aggregateCount = this.aggregateCounts.get(event.aggregateType) || 0;
    this.aggregateCounts.set(event.aggregateType, aggregateCount + 1);

    // Update hourly volume
    const hour = new Date(event.timestamp).getHours().toString();
    const hourlyCount = this.hourlyVolume.get(hour) || 0;
    this.hourlyVolume.set(hour, hourlyCount + 1);

    this.eventsPerSecond++;
  }

  public recordProcessingTime(eventType: string, processingTime: number): void {
    this.processingTimes.push(processingTime);
    
    // Keep only last 1000 processing times to prevent memory issues
    if (this.processingTimes.length > 1000) {
      this.processingTimes.shift();
    }
  }

  public recordError(component: string, error: Error): void {
    const currentCount = this.errorCounts.get(component) || 0;
    this.errorCounts.set(component, currentCount + 1);

    // Update component health
    const componentHealth = this.componentHealthMap.get(component) || {
      name: component,
      status: 'healthy',
      lastCheck: new Date(),
      metrics: {}
    };

    componentHealth.status = 'unhealthy';
    componentHealth.message = error.message;
    componentHealth.lastCheck = new Date();
    this.componentHealthMap.set(component, componentHealth);

    this.logger.warn('Error recorded', { component, error: error.message });
  }

  public getAnalytics(): EventAnalytics {
    const processingLatency = this.calculateProcessingLatency();
    
    return {
      eventCounts: new Map(this.eventCounts),
      aggregateCounts: new Map(this.aggregateCounts),
      hourlyVolume: new Map(this.hourlyVolume),
      processingLatency,
      errorRates: this.calculateErrorRates(),
      throughput: {
        eventsPerSecond: this.eventsPerSecond,
        commandsPerSecond: this.commandsPerSecond,
        queriesPerSecond: this.queriesPerSecond
      }
    };
  }

  public getHealthStatus(): HealthStatus {
    const components = new Map(this.componentHealthMap);
    
    // Determine overall health
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    const unhealthyComponents = Array.from(components.values())
      .filter(comp => comp.status === 'unhealthy').length;
    const degradedComponents = Array.from(components.values())
      .filter(comp => comp.status === 'degraded').length;

    if (unhealthyComponents > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedComponents > 0) {
      overallStatus = 'degraded';
    }

    return {
      overall: overallStatus,
      components,
      lastCheck: new Date()
    };
  }

  public async getDebugInfo(): Promise<DebugInfo> {
    const [eventStoreStats, projectionStats, sagaStats] = await Promise.all([
      this.getEventStoreStats(),
      this.getProjectionStats(),
      this.getSagaStats()
    ]);

    return {
      eventStore: eventStoreStats,
      projections: projectionStats,
      sagas: sagaStats,
      analytics: this.getAnalytics(),
      health: this.getHealthStatus()
    };
  }

  private handleEvent(event: DomainEvent): void {
    this.recordEvent(event);
    this.emit('event-monitored', event);
  }

  private handleEventProcessed(event: DomainEvent, processingTime: number): void {
    this.recordProcessingTime(event.eventType, processingTime);
    this.emit('event-processing-recorded', event, processingTime);
  }

  private handleCommandProcessed(): void {
    this.commandsPerSecond++;
  }

  private handleQueryExecuted(): void {
    this.queriesPerSecond++;
  }

  private async performHealthCheck(): Promise<void> {
    // Check event store health
    await this.checkEventStoreHealth();
    
    // Check projection health
    if (this.projectionManager) {
      await this.checkProjectionHealth();
    }
    
    // Check saga health
    if (this.sagaManager) {
      await this.checkSagaHealth();
    }

    // Check system resources
    await this.checkSystemHealth();

    this.emit('health-check-completed', this.getHealthStatus());
  }

  private async checkEventStoreHealth(): Promise<void> {
    try {
      const stats = await this.eventStore.getStats();
      const health: ComponentHealth = {
        name: 'EventStore',
        status: 'healthy',
        lastCheck: new Date(),
        metrics: {
          totalEvents: stats.totalEvents,
          totalStreams: stats.totalStreams,
          storageSize: stats.storageSize
        }
      };

      // Check for potential issues
      if (stats.storageSize > 10 * 1024 * 1024 * 1024) { // 10GB
        health.status = 'degraded';
        health.message = 'High storage usage detected';
      }

      this.componentHealthMap.set('EventStore', health);
    } catch (error) {
      this.recordError('EventStore', error);
    }
  }

  private async checkProjectionHealth(): Promise<void> {
    try {
      const projectionStats = this.projectionManager.getAllStats();
      const unhealthyProjections = projectionStats.filter((stat: ProjectionStats) => !stat.isHealthy);
      
      const health: ComponentHealth = {
        name: 'Projections',
        status: unhealthyProjections.length === 0 ? 'healthy' : 'degraded',
        lastCheck: new Date(),
        metrics: {
          totalProjections: projectionStats.length,
          unhealthyProjections: unhealthyProjections.length
        }
      };

      if (unhealthyProjections.length > 0) {
        health.message = `${unhealthyProjections.length} unhealthy projections`;
      }

      this.componentHealthMap.set('Projections', health);
    } catch (error) {
      this.recordError('Projections', error);
    }
  }

  private async checkSagaHealth(): Promise<void> {
    try {
      const activeSagas = await this.sagaManager.getAllActiveSagas();
      const stuckSagas = activeSagas.filter((saga: any) => {
        const hoursSinceUpdate = (Date.now() - saga.updatedAt.getTime()) / (1000 * 60 * 60);
        return hoursSinceUpdate > 24; // Consider stuck if no update for 24 hours
      });

      const health: ComponentHealth = {
        name: 'Sagas',
        status: stuckSagas.length === 0 ? 'healthy' : 'degraded',
        lastCheck: new Date(),
        metrics: {
          activeSagas: activeSagas.length,
          stuckSagas: stuckSagas.length
        }
      };

      if (stuckSagas.length > 0) {
        health.message = `${stuckSagas.length} potentially stuck sagas`;
      }

      this.componentHealthMap.set('Sagas', health);
    } catch (error) {
      this.recordError('Sagas', error);
    }
  }

  private async checkSystemHealth(): Promise<void> {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const health: ComponentHealth = {
      name: 'System',
      status: 'healthy',
      lastCheck: new Date(),
      metrics: {
        memoryUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        memoryTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        cpuUserMicros: cpuUsage.user,
        cpuSystemMicros: cpuUsage.system
      }
    };

    // Check memory usage
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    if (memoryUsagePercent > 90) {
      health.status = 'unhealthy';
      health.message = 'High memory usage';
    } else if (memoryUsagePercent > 75) {
      health.status = 'degraded';
      health.message = 'Elevated memory usage';
    }

    this.componentHealthMap.set('System', health);
  }

  private calculateProcessingLatency(): { p50: number; p95: number; p99: number } {
    if (this.processingTimes.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...this.processingTimes].sort((a, b) => a - b);
    const length = sorted.length;

    return {
      p50: sorted[Math.floor(length * 0.5)],
      p95: sorted[Math.floor(length * 0.95)],
      p99: sorted[Math.floor(length * 0.99)]
    };
  }

  private calculateErrorRates(): Map<string, number> {
    const errorRates = new Map<string, number>();
    
    for (const [component, errorCount] of this.errorCounts) {
      const totalEvents = this.eventCounts.get(component) || 1;
      const errorRate = (errorCount / totalEvents) * 100;
      errorRates.set(component, errorRate);
    }

    return errorRates;
  }

  private async getEventStoreStats(): Promise<EventStoreStats> {
    try {
      return await this.eventStore.getStats();
    } catch (error) {
      this.logger.error('Failed to get event store stats', { error });
      return {
        totalEvents: 0,
        totalStreams: 0,
        totalSnapshots: 0,
        averageEventsPerStream: 0,
        oldestEvent: new Date(),
        newestEvent: new Date(),
        storageSize: 0,
        indexSize: 0
      };
    }
  }

  private async getProjectionStats(): Promise<ProjectionStats[]> {
    if (!this.projectionManager) {
      return [];
    }

    try {
      return this.projectionManager.getAllStats();
    } catch (error) {
      this.logger.error('Failed to get projection stats', { error });
      return [];
    }
  }

  private async getSagaStats(): Promise<SagaStats> {
    if (!this.sagaManager) {
      return {
        totalSagas: 0,
        activeSagas: 0,
        completedSagas: 0,
        failedSagas: 0,
        compensatedSagas: 0,
        averageExecutionTime: 0,
        successRate: 0
      };
    }

    try {
      const activeSagas = await this.sagaManager.getAllActiveSagas();
      // Implementation would calculate more detailed stats
      return {
        totalSagas: activeSagas.length,
        activeSagas: activeSagas.length,
        completedSagas: 0,
        failedSagas: 0,
        compensatedSagas: 0,
        averageExecutionTime: 0,
        successRate: 0
      };
    } catch (error) {
      this.logger.error('Failed to get saga stats', { error });
      return {
        totalSagas: 0,
        activeSagas: 0,
        completedSagas: 0,
        failedSagas: 0,
        compensatedSagas: 0,
        averageExecutionTime: 0,
        successRate: 0
      };
    }
  }

  private resetCounters(): void {
    const elapsedSeconds = (Date.now() - this.lastMetricsReset) / 1000;
    
    // Convert to per-second rates
    this.eventsPerSecond = this.eventsPerSecond / elapsedSeconds;
    this.commandsPerSecond = this.commandsPerSecond / elapsedSeconds;
    this.queriesPerSecond = this.queriesPerSecond / elapsedSeconds;
    
    // Reset for next interval
    this.lastMetricsReset = Date.now();
    
    // Log current metrics
    this.logger.debug('Metrics reset', {
      eventsPerSecond: this.eventsPerSecond,
      commandsPerSecond: this.commandsPerSecond,
      queriesPerSecond: this.queriesPerSecond
    });

    // Reset counters for next measurement
    setTimeout(() => {
      this.eventsPerSecond = 0;
      this.commandsPerSecond = 0;
      this.queriesPerSecond = 0;
    }, 100);
  }
}

// Alert system

export interface AlertRule {
  name: string;
  condition: (analytics: EventAnalytics, health: HealthStatus) => boolean;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  cooldownMs: number;
}

export class AlertManager extends EventEmitter {
  private readonly logger = pino({ name: 'AlertManager' });
  private readonly rules = new Map<string, AlertRule>();
  private readonly lastAlerts = new Map<string, number>();

  public addRule(rule: AlertRule): void {
    this.rules.set(rule.name, rule);
    this.logger.info('Alert rule added', { ruleName: rule.name, severity: rule.severity });
  }

  public removeRule(ruleName: string): void {
    this.rules.delete(ruleName);
    this.lastAlerts.delete(ruleName);
    this.logger.info('Alert rule removed', { ruleName });
  }

  public checkAlerts(analytics: EventAnalytics, health: HealthStatus): void {
    const now = Date.now();

    for (const [ruleName, rule] of this.rules) {
      const lastAlert = this.lastAlerts.get(ruleName) || 0;
      
      if (now - lastAlert < rule.cooldownMs) {
        continue; // Still in cooldown period
      }

      if (rule.condition(analytics, health)) {
        this.triggerAlert(rule);
        this.lastAlerts.set(ruleName, now);
      }
    }
  }

  private triggerAlert(rule: AlertRule): void {
    const alert = {
      rule: rule.name,
      severity: rule.severity,
      message: rule.message,
      timestamp: new Date()
    };

    this.emit('alert', alert);
    
    this.logger[rule.severity === 'critical' ? 'error' : 'warn']('Alert triggered', alert);
  }
}

// Pre-defined alert rules

export const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    name: 'high-error-rate',
    condition: (analytics, health) => {
      const totalErrors = Array.from(analytics.errorRates.values())
        .reduce((sum, rate) => sum + rate, 0);
      return totalErrors > 5; // More than 5% error rate
    },
    severity: 'error',
    message: 'High error rate detected across components',
    cooldownMs: 5 * 60 * 1000 // 5 minutes
  },
  {
    name: 'system-unhealthy',
    condition: (analytics, health) => health.overall === 'unhealthy',
    severity: 'critical',
    message: 'System health is unhealthy',
    cooldownMs: 1 * 60 * 1000 // 1 minute
  },
  {
    name: 'high-processing-latency',
    condition: (analytics, health) => analytics.processingLatency.p95 > 5000,
    severity: 'warning',
    message: 'High processing latency detected (P95 > 5s)',
    cooldownMs: 10 * 60 * 1000 // 10 minutes
  },
  {
    name: 'low-throughput',
    condition: (analytics, health) => analytics.throughput.eventsPerSecond < 1,
    severity: 'info',
    message: 'Low event throughput detected',
    cooldownMs: 15 * 60 * 1000 // 15 minutes
  }
];
