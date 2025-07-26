/**
 * Database Monitoring Setup System
 * Comprehensive database monitoring for healthcare claims system
 */

export interface DatabaseMonitoringConfig {
  enableRealTimeMonitoring: boolean;
  monitoringInterval: number; // milliseconds
  alertThresholds: AlertThresholds;
  enableHealthcareCompliance: boolean;
  enablePerformanceBaseline: boolean;
  retentionPeriod: number; // days
  enableAuditLogging: boolean;
}

export interface AlertThresholds {
  connectionCount: number;
  queryResponseTime: number; // ms
  diskUsage: number; // percentage
  cpuUsage: number; // percentage
  memoryUsage: number; // percentage
  lockWaitTime: number; // ms
  replicationLag: number; // seconds
  errorRate: number; // percentage
}

export interface DatabaseMetrics {
  timestamp: Date;
  connections: ConnectionMetrics;
  performance: PerformanceMetrics;
  resources: ResourceMetrics;
  healthcare: HealthcareMetrics;
  replication: ReplicationMetrics;
  locks: LockMetrics;
  errors: ErrorMetrics;
}

export interface ConnectionMetrics {
  total: number;
  active: number;
  idle: number;
  idleInTransaction: number;
  waiting: number;
  maxConnections: number;
  utilizationRate: number;
}

export interface PerformanceMetrics {
  avgQueryTime: number;
  slowQueries: number;
  queriesPerSecond: number;
  transactionsPerSecond: number;
  commitRatio: number;
  rollbackRatio: number;
  bufferHitRatio: number;
  diskReads: number;
  diskWrites: number;
}

export interface ResourceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  diskIOPS: number;
  networkIO: number;
  cacheHitRatio: number;
  sharedBuffersUsage: number;
  workMemUsage: number;
}

export interface HealthcareMetrics {
  patientDataQueries: number;
  claimsQueries: number;
  auditLogEntries: number;
  hipaaCompliantQueries: number;
  encryptedConnections: number;
  unauthorizedAccessAttempts: number;
  dataExportEvents: number;
  backupStatus: string;
}

export interface ReplicationMetrics {
  isReplicating: boolean;
  replicationLag: number;
  replicaStatus: string;
  walBytesReceived: number;
  walBytesReplayed: number;
  lastReplicationTime: Date;
}

export interface LockMetrics {
  totalLocks: number;
  exclusiveLocks: number;
  sharedLocks: number;
  lockWaits: number;
  deadlocks: number;
  avgLockWaitTime: number;
  longestLockWait: number;
}

export interface ErrorMetrics {
  totalErrors: number;
  connectionErrors: number;
  queryErrors: number;
  permissionErrors: number;
  timeoutErrors: number;
  diskSpaceErrors: number;
  errorRate: number;
}

export interface Alert {
  id: string;
  timestamp: Date;
  severity: 'critical' | 'warning' | 'info';
  category: 'performance' | 'resource' | 'security' | 'compliance' | 'availability';
  message: string;
  metric: string;
  currentValue: number;
  threshold: number;
  healthcareImpact?: string;
  recommended_action: string;
  acknowledged: boolean;
}

export class DatabaseMonitor {
  private config: DatabaseMonitoringConfig;
  private metrics: DatabaseMetrics[] = [];
  private alerts: Alert[] = [];
  private monitoringInterval?: NodeJS.Timeout;
  private performanceBaseline?: DatabaseMetrics;

  constructor(config: Partial<DatabaseMonitoringConfig> = {}) {
    this.config = {
      enableRealTimeMonitoring: true,
      monitoringInterval: 30000, // 30 seconds
      alertThresholds: {
        connectionCount: 80, // 80% of max connections
        queryResponseTime: 2000, // 2 seconds
        diskUsage: 85, // 85%
        cpuUsage: 80, // 80%
        memoryUsage: 85, // 85%
        lockWaitTime: 5000, // 5 seconds
        replicationLag: 60, // 60 seconds
        errorRate: 5 // 5%
      },
      enableHealthcareCompliance: true,
      enablePerformanceBaseline: true,
      retentionPeriod: 30, // 30 days
      enableAuditLogging: true,
      ...config
    };

    if (this.config.enableRealTimeMonitoring) {
      this.startMonitoring();
    }
  }

  /**
   * Start real-time database monitoring
   */
  private startMonitoring(): void {
    console.log('📊 Starting database monitoring...');
    
    this.monitoringInterval = setInterval(async () => {
      try {
        const metrics = await this.collectMetrics();
        this.metrics.push(metrics);
        
        // Maintain retention period
        this.cleanupOldMetrics();
        
        // Check for alerts
        this.checkAlerts(metrics);
        
        // Update baseline if enabled
        if (this.config.enablePerformanceBaseline) {
          this.updatePerformanceBaseline(metrics);
        }
        
        // Log healthcare compliance events
        if (this.config.enableHealthcareCompliance) {
          this.logComplianceEvents(metrics);
        }
        
      } catch (error) {
        console.error('❌ Database monitoring error:', error);
      }
    }, this.config.monitoringInterval);
  }

  /**
   * Collect comprehensive database metrics
   */
  private async collectMetrics(): Promise<DatabaseMetrics> {
    // In production, these would be actual database queries
    // Mock implementation for demonstration
    
    const connections = await this.collectConnectionMetrics();
    const performance = await this.collectPerformanceMetrics();
    const resources = await this.collectResourceMetrics();
    const healthcare = await this.collectHealthcareMetrics();
    const replication = await this.collectReplicationMetrics();
    const locks = await this.collectLockMetrics();
    const errors = await this.collectErrorMetrics();

    return {
      timestamp: new Date(),
      connections,
      performance,
      resources,
      healthcare,
      replication,
      locks,
      errors
    };
  }

  /**
   * Collect connection metrics
   */
  private async collectConnectionMetrics(): Promise<ConnectionMetrics> {
    // Mock data - would query pg_stat_activity in production
    return {
      total: 25,
      active: 15,
      idle: 8,
      idleInTransaction: 2,
      waiting: 0,
      maxConnections: 100,
      utilizationRate: 25
    };
  }

  /**
   * Collect performance metrics
   */
  private async collectPerformanceMetrics(): Promise<PerformanceMetrics> {
    // Mock data - would query pg_stat_database and pg_stat_statements
    return {
      avgQueryTime: 150, // ms
      slowQueries: 5,
      queriesPerSecond: 120,
      transactionsPerSecond: 45,
      commitRatio: 0.98,
      rollbackRatio: 0.02,
      bufferHitRatio: 0.99,
      diskReads: 1000,
      diskWrites: 500
    };
  }

  /**
   * Collect resource metrics
   */
  private async collectResourceMetrics(): Promise<ResourceMetrics> {
    // Mock data - would query system metrics
    return {
      cpuUsage: 45, // percentage
      memoryUsage: 65, // percentage
      diskUsage: 70, // percentage
      diskIOPS: 500,
      networkIO: 1024 * 1024, // bytes/sec
      cacheHitRatio: 0.95,
      sharedBuffersUsage: 80, // percentage
      workMemUsage: 40 // percentage
    };
  }

  /**
   * Collect healthcare-specific metrics
   */
  private async collectHealthcareMetrics(): Promise<HealthcareMetrics> {
    // Mock data - would query application-specific tables
    return {
      patientDataQueries: 450,
      claimsQueries: 320,
      auditLogEntries: 50,
      hipaaCompliantQueries: 770, // 100% compliance target
      encryptedConnections: 25,
      unauthorizedAccessAttempts: 0,
      dataExportEvents: 3,
      backupStatus: 'completed'
    };
  }

  /**
   * Collect replication metrics
   */
  private async collectReplicationMetrics(): Promise<ReplicationMetrics> {
    // Mock data - would query pg_stat_replication
    return {
      isReplicating: true,
      replicationLag: 15, // seconds
      replicaStatus: 'streaming',
      walBytesReceived: 1024 * 1024 * 100, // 100MB
      walBytesReplayed: 1024 * 1024 * 99, // 99MB
      lastReplicationTime: new Date()
    };
  }

  /**
   * Collect lock metrics
   */
  private async collectLockMetrics(): Promise<LockMetrics> {
    // Mock data - would query pg_locks
    return {
      totalLocks: 150,
      exclusiveLocks: 10,
      sharedLocks: 140,
      lockWaits: 2,
      deadlocks: 0,
      avgLockWaitTime: 50, // ms
      longestLockWait: 200 // ms
    };
  }

  /**
   * Collect error metrics
   */
  private async collectErrorMetrics(): Promise<ErrorMetrics> {
    // Mock data - would query logs and error tables
    return {
      totalErrors: 3,
      connectionErrors: 1,
      queryErrors: 2,
      permissionErrors: 0,
      timeoutErrors: 0,
      diskSpaceErrors: 0,
      errorRate: 0.5 // percentage
    };
  }

  /**
   * Check metrics against thresholds and generate alerts
   */
  private checkAlerts(metrics: DatabaseMetrics): void {
    const newAlerts: Alert[] = [];

    // Connection threshold check
    if (metrics.connections.utilizationRate > this.config.alertThresholds.connectionCount) {
      newAlerts.push({
        id: `conn-${Date.now()}`,
        timestamp: new Date(),
        severity: 'warning',
        category: 'performance',
        message: 'High connection utilization detected',
        metric: 'connection_utilization',
        currentValue: metrics.connections.utilizationRate,
        threshold: this.config.alertThresholds.connectionCount,
        healthcareImpact: 'May impact patient data access responsiveness',
        recommended_action: 'Review connection pooling configuration and scale if needed',
        acknowledged: false
      });
    }

    // Query response time check
    if (metrics.performance.avgQueryTime > this.config.alertThresholds.queryResponseTime) {
      newAlerts.push({
        id: `query-${Date.now()}`,
        timestamp: new Date(),
        severity: 'critical',
        category: 'performance',
        message: 'Slow query response time detected',
        metric: 'avg_query_time',
        currentValue: metrics.performance.avgQueryTime,
        threshold: this.config.alertThresholds.queryResponseTime,
        healthcareImpact: 'Critical: May delay patient care and claim processing',
        recommended_action: 'Analyze slow queries and optimize indexes',
        acknowledged: false
      });
    }

    // Resource usage checks
    if (metrics.resources.diskUsage > this.config.alertThresholds.diskUsage) {
      newAlerts.push({
        id: `disk-${Date.now()}`,
        timestamp: new Date(),
        severity: 'critical',
        category: 'resource',
        message: 'High disk usage detected',
        metric: 'disk_usage',
        currentValue: metrics.resources.diskUsage,
        threshold: this.config.alertThresholds.diskUsage,
        healthcareImpact: 'Risk of data loss and system unavailability',
        recommended_action: 'Free up disk space or add storage capacity',
        acknowledged: false
      });
    }

    // Healthcare-specific checks
    if (this.config.enableHealthcareCompliance) {
      // Check for unauthorized access attempts
      if (metrics.healthcare.unauthorizedAccessAttempts > 0) {
        newAlerts.push({
          id: `security-${Date.now()}`,
          timestamp: new Date(),
          severity: 'critical',
          category: 'security',
          message: 'Unauthorized access attempts detected',
          metric: 'unauthorized_access',
          currentValue: metrics.healthcare.unauthorizedAccessAttempts,
          threshold: 0,
          healthcareImpact: 'HIPAA compliance violation risk',
          recommended_action: 'Investigate and strengthen access controls',
          acknowledged: false
        });
      }

      // Check backup status
      if (metrics.healthcare.backupStatus !== 'completed') {
        newAlerts.push({
          id: `backup-${Date.now()}`,
          timestamp: new Date(),
          severity: 'warning',
          category: 'compliance',
          message: 'Database backup incomplete',
          metric: 'backup_status',
          currentValue: 0,
          threshold: 1,
          healthcareImpact: 'Data recovery risk in case of system failure',
          recommended_action: 'Check backup processes and resolve issues',
          acknowledged: false
        });
      }
    }

    // Replication lag check
    if (metrics.replication.replicationLag > this.config.alertThresholds.replicationLag) {
      newAlerts.push({
        id: `repl-${Date.now()}`,
        timestamp: new Date(),
        severity: 'warning',
        category: 'availability',
        message: 'High replication lag detected',
        metric: 'replication_lag',
        currentValue: metrics.replication.replicationLag,
        threshold: this.config.alertThresholds.replicationLag,
        healthcareImpact: 'Reporting data may be outdated',
        recommended_action: 'Check network connectivity and replica performance',
        acknowledged: false
      });
    }

    // Add new alerts
    this.alerts.push(...newAlerts);

    // Send notifications for critical alerts
    newAlerts.filter(alert => alert.severity === 'critical').forEach(alert => {
      this.sendCriticalAlert(alert);
    });
  }

  /**
   * Send critical alert notification
   */
  private sendCriticalAlert(alert: Alert): void {
    console.error(`🚨 CRITICAL DATABASE ALERT: ${alert.message}`);
    console.error(`Impact: ${alert.healthcareImpact}`);
    console.error(`Action: ${alert.recommended_action}`);
    
    // In production, would send to monitoring systems, email, Slack, etc.
  }

  /**
   * Update performance baseline
   */
  private updatePerformanceBaseline(metrics: DatabaseMetrics): void {
    if (!this.performanceBaseline) {
      this.performanceBaseline = { ...metrics };
      return;
    }

    // Update baseline using exponential moving average
    const alpha = 0.1; // Smoothing factor
    
    this.performanceBaseline.performance.avgQueryTime = 
      alpha * metrics.performance.avgQueryTime + 
      (1 - alpha) * this.performanceBaseline.performance.avgQueryTime;
      
    this.performanceBaseline.resources.cpuUsage = 
      alpha * metrics.resources.cpuUsage + 
      (1 - alpha) * this.performanceBaseline.resources.cpuUsage;
      
    // Update baseline timestamp
    this.performanceBaseline.timestamp = new Date();
  }

  /**
   * Log healthcare compliance events
   */
  private logComplianceEvents(metrics: DatabaseMetrics): void {
    if (this.config.enableAuditLogging) {
      // Log significant events for compliance
      const complianceLog = {
        timestamp: new Date(),
        event_type: 'database_monitoring',
        patient_data_access: metrics.healthcare.patientDataQueries,
        encrypted_connections: metrics.healthcare.encryptedConnections,
        total_connections: metrics.connections.total,
        backup_status: metrics.healthcare.backupStatus,
        compliance_score: this.calculateComplianceScore(metrics)
      };

      // In production, would log to audit table or external system
      console.log('📋 Compliance audit:', complianceLog);
    }
  }

  /**
   * Calculate healthcare compliance score
   */
  private calculateComplianceScore(metrics: DatabaseMetrics): number {
    let score = 100;

    // Deduct points for compliance issues
    if (metrics.healthcare.unauthorizedAccessAttempts > 0) score -= 30;
    if (metrics.healthcare.backupStatus !== 'completed') score -= 20;
    if (metrics.healthcare.encryptedConnections < metrics.connections.total) score -= 15;
    if (metrics.performance.avgQueryTime > 5000) score -= 10; // Response time affects patient care

    return Math.max(0, score);
  }

  /**
   * Clean up old metrics data
   */
  private cleanupOldMetrics(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionPeriod);
    
    this.metrics = this.metrics.filter(metric => metric.timestamp > cutoffDate);
    
    // Also cleanup old alerts
    this.alerts = this.alerts.filter(alert => alert.timestamp > cutoffDate);
  }

  /**
   * Generate comprehensive monitoring report
   */
  generateMonitoringReport(): string {
    const latestMetrics = this.metrics[this.metrics.length - 1];
    const criticalAlerts = this.alerts.filter(a => a.severity === 'critical' && !a.acknowledged);
    const complianceScore = latestMetrics ? this.calculateComplianceScore(latestMetrics) : 0;

    return `
# Database Monitoring Report

## System Health Overview
- **Monitoring Status**: ${this.config.enableRealTimeMonitoring ? '🟢 Active' : '🔴 Inactive'}
- **Last Update**: ${latestMetrics?.timestamp.toISOString() || 'N/A'}
- **Healthcare Compliance Score**: ${complianceScore}%
- **Critical Alerts**: ${criticalAlerts.length}

## Current Performance Metrics
${latestMetrics ? `
### Connections
- **Total**: ${latestMetrics.connections.total}/${latestMetrics.connections.maxConnections}
- **Active**: ${latestMetrics.connections.active}
- **Utilization**: ${latestMetrics.connections.utilizationRate}%

### Performance
- **Avg Query Time**: ${latestMetrics.performance.avgQueryTime}ms
- **Queries/Second**: ${latestMetrics.performance.queriesPerSecond}
- **Buffer Hit Ratio**: ${(latestMetrics.performance.bufferHitRatio * 100).toFixed(1)}%
- **Slow Queries**: ${latestMetrics.performance.slowQueries}

### Resources
- **CPU Usage**: ${latestMetrics.resources.cpuUsage}%
- **Memory Usage**: ${latestMetrics.resources.memoryUsage}%
- **Disk Usage**: ${latestMetrics.resources.diskUsage}%

### Healthcare Metrics
- **Patient Data Queries**: ${latestMetrics.healthcare.patientDataQueries}
- **Claims Queries**: ${latestMetrics.healthcare.claimsQueries}
- **Encrypted Connections**: ${latestMetrics.healthcare.encryptedConnections}/${latestMetrics.connections.total}
- **Audit Log Entries**: ${latestMetrics.healthcare.auditLogEntries}
- **Backup Status**: ${latestMetrics.healthcare.backupStatus}

### Replication
- **Status**: ${latestMetrics.replication.isReplicating ? '🟢 Active' : '🔴 Inactive'}
- **Lag**: ${latestMetrics.replication.replicationLag}s
- **Replica Status**: ${latestMetrics.replication.replicaStatus}
` : 'No metrics available'}

## Active Alerts
${criticalAlerts.length > 0 ? criticalAlerts.map(alert => `
### 🚨 ${alert.message}
- **Severity**: ${alert.severity.toUpperCase()}
- **Category**: ${alert.category}
- **Current Value**: ${alert.currentValue}
- **Threshold**: ${alert.threshold}
- **Healthcare Impact**: ${alert.healthcareImpact}
- **Recommended Action**: ${alert.recommended_action}
`).join('') : '✅ No critical alerts'}

## Performance Baseline Comparison
${this.performanceBaseline && latestMetrics ? `
- **Query Time**: ${latestMetrics.performance.avgQueryTime}ms vs ${this.performanceBaseline.performance.avgQueryTime.toFixed(0)}ms baseline
- **CPU Usage**: ${latestMetrics.resources.cpuUsage}% vs ${this.performanceBaseline.resources.cpuUsage.toFixed(1)}% baseline
- **Connection Utilization**: ${latestMetrics.connections.utilizationRate}% current
` : 'Baseline not yet established'}

## Healthcare Compliance Status
- **HIPAA Encryption**: ${latestMetrics?.healthcare.encryptedConnections === latestMetrics?.connections.total ? '✅ Compliant' : '⚠️ Partial'}
- **Audit Logging**: ${this.config.enableAuditLogging ? '✅ Enabled' : '❌ Disabled'}
- **Backup Status**: ${latestMetrics?.healthcare.backupStatus === 'completed' ? '✅ Current' : '⚠️ Issues'}
- **Access Control**: ${latestMetrics?.healthcare.unauthorizedAccessAttempts === 0 ? '✅ Secure' : '🚨 Breaches detected'}

## Recommendations
${this.generateRecommendations(latestMetrics)}

## Next Steps
1. Review and acknowledge critical alerts
2. Implement recommended optimizations
3. Monitor compliance score trends
4. Schedule regular health assessments
5. Update monitoring thresholds if needed
    `.trim();
  }

  /**
   * Generate monitoring recommendations
   */
  private generateRecommendations(metrics?: DatabaseMetrics): string {
    if (!metrics) return '• No metrics available for recommendations';

    const recommendations: string[] = [];

    if (metrics.connections.utilizationRate > 80) {
      recommendations.push('• Consider increasing connection pool size or implementing connection queuing');
    }

    if (metrics.performance.avgQueryTime > 1000) {
      recommendations.push('• Analyze and optimize slow queries, consider adding indexes');
    }

    if (metrics.resources.diskUsage > 80) {
      recommendations.push('• Monitor disk usage closely, plan for storage expansion');
    }

    if (metrics.healthcare.encryptedConnections < metrics.connections.total) {
      recommendations.push('• Ensure all connections use SSL/TLS encryption for HIPAA compliance');
    }

    if (metrics.replication.replicationLag > 30) {
      recommendations.push('• Investigate replication performance, check network and replica resources');
    }

    if (recommendations.length === 0) {
      recommendations.push('• Current performance appears healthy, continue monitoring');
    }

    return recommendations.join('\n');
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): DatabaseMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return this.alerts.filter(alert => !alert.acknowledged);
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      console.log(`✅ Alert acknowledged: ${alertId}`);
    }
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      console.log('🛑 Database monitoring stopped');
    }
  }
}

/**
 * Healthcare monitoring templates
 */
export class HealthcareMonitoringTemplates {
  /**
   * Get HIPAA compliance monitoring queries
   */
  static getHIPAAComplianceQueries(): string[] {
    return [
      `-- Monitor patient data access
      SELECT 
        user_name,
        client_addr,
        COUNT(*) as access_count,
        MIN(query_start) as first_access,
        MAX(query_start) as last_access
      FROM pg_stat_activity 
      WHERE query ILIKE '%patient%' OR query ILIKE '%member%'
      GROUP BY user_name, client_addr;`,

      `-- Check encryption status
      SELECT 
        COUNT(*) as total_connections,
        COUNT(CASE WHEN ssl = true THEN 1 END) as encrypted_connections,
        ROUND(COUNT(CASE WHEN ssl = true THEN 1 END) * 100.0 / COUNT(*), 2) as encryption_percentage
      FROM pg_stat_ssl;`,

      `-- Audit log compliance
      SELECT 
        DATE(created_at) as audit_date,
        table_name,
        action_type,
        COUNT(*) as action_count
      FROM audit_logs 
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE(created_at), table_name, action_type
      ORDER BY audit_date DESC;`
    ];
  }

  /**
   * Get performance monitoring queries
   */
  static getPerformanceQueries(): string[] {
    return [
      `-- Slow query analysis
      SELECT 
        query,
        calls,
        total_time,
        mean_time,
        max_time,
        rows
      FROM pg_stat_statements 
      WHERE mean_time > 1000
      ORDER BY mean_time DESC 
      LIMIT 10;`,

      `-- Connection pool status
      SELECT 
        state,
        COUNT(*) as connection_count,
        ROUND(COUNT(*) * 100.0 / (SELECT setting::int FROM pg_settings WHERE name = 'max_connections'), 2) as percentage
      FROM pg_stat_activity 
      GROUP BY state;`,

      `-- Buffer cache hit ratio
      SELECT 
        schemaname,
        tablename,
        heap_blks_read,
        heap_blks_hit,
        ROUND(heap_blks_hit * 100.0 / (heap_blks_hit + heap_blks_read), 2) as cache_hit_ratio
      FROM pg_statio_user_tables 
      WHERE heap_blks_read > 0
      ORDER BY cache_hit_ratio ASC;`
    ];
  }
}
