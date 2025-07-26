/**
 * Scalability Management System
 * Healthcare Claims Processing - Complete Scalability Implementation
 */

export * from './horizontal-scaling';
export * from './types';
export * from './auto-scaling';

// Main scalability imports
import { HorizontalScalingManager } from './horizontal-scaling';
import { HealthcareAutoScalingManager, AutoScalingConfig, defaultHealthcareAutoScalingConfig } from './auto-scaling';
import { ScalabilityConfig } from './types';

/**
 * Complete Healthcare Scalability Configuration
 */
export interface HealthcareScalabilityConfig extends ScalabilityConfig {
  autoScaling: AutoScalingConfig;
}

/**
 * Comprehensive Healthcare Scalability Manager
 * Integrates traditional horizontal scaling with advanced auto-scaling capabilities
 */
export class HealthcareScalabilityManager {
  private horizontalScalingManager: HorizontalScalingManager;
  private autoScalingManager: HealthcareAutoScalingManager;
  private config: HealthcareScalabilityConfig;

  constructor(config?: Partial<HealthcareScalabilityConfig>) {
    // Merge with default configuration
    this.config = {
      horizontalScaling: {
        loadBalancer: {
          type: 'nginx',
          healthCheckPath: '/health',
          maxConnections: 1000,
          timeoutMs: 30000,
          sslEnabled: true,
          algorithms: 'round-robin'
        },
        autoScaling: {
          enabled: true,
          minInstances: 1,
          maxInstances: 20,
          targetCPUUtilization: 70,
          targetMemoryUtilization: 80,
          scaleUpCooldown: 300000,
          scaleDownCooldown: 600000,
          metrics: ['cpu', 'memory', 'request_rate', 'response_time']
        },
        databaseCluster: {
          type: 'mongodb',
          replicationFactor: 3,
          shardingEnabled: true,
          backupStrategy: 'continuous',
          readReplicas: 2,
          writeNodes: 1
        },
        kubernetes: {
          namespace: 'healthcare',
          clusterName: 'claims-processing',
          resourceLimits: {
            cpu: '4',
            memory: '8Gi',
            storage: '100Gi'
          },
          persistentStorage: {
            storageClass: 'fast-ssd',
            size: '100Gi',
            accessModes: ['ReadWriteOnce']
          },
          networking: {
            serviceMeshEnabled: true,
            ingressController: 'nginx',
            networkPolicies: true
          }
        },
        serviceMesh: {
          provider: 'istio',
          enableMTLS: true,
          tracing: true,
          metrics: true,
          rateLimiting: true
        }
      },
      monitoring: {
        healthChecks: {
          intervalSeconds: 30,
          timeoutSeconds: 10,
          failureThreshold: 3,
          successThreshold: 1,
          endpoints: ['/health', '/ready']
        },
        metrics: {
          provider: 'prometheus',
          retentionDays: 30,
          scrapeInterval: 15,
          customMetrics: ['claims_processed', 'documents_processed', 'patient_safety_score']
        },
        alerting: {
          provider: 'pagerduty',
          thresholds: {
            cpuUsage: 80,
            memoryUsage: 85,
            responseTime: 2000,
            errorRate: 5,
            diskUsage: 90
          },
          channels: ['operations-team', 'healthcare-team']
        }
      },
      deployment: {
        strategy: 'blue-green',
        blueGreen: {
          enabled: true,
          routingPercentage: 10,
          rollbackThreshold: 5,
          verificationSteps: ['health_check', 'compliance_check', 'performance_test']
        },
        canary: {
          enabled: false,
          initialTrafficPercentage: 5,
          incrementPercentage: 10,
          intervalMinutes: 5,
          successMetrics: ['response_time', 'error_rate', 'patient_safety']
        },
        rollingUpdate: {
          maxUnavailable: '25%',
          maxSurge: '25%',
          batchSize: 2,
          pauseBetweenBatches: 30
        }
      },
      autoScaling: defaultHealthcareAutoScalingConfig,
      ...config
    };

    this.initializeManagers();
  }

  /**
   * Initialize both scaling managers
   */
  private initializeManagers(): void {
    console.log('🏥 Initializing Healthcare Scalability Management System');

    this.horizontalScalingManager = new HorizontalScalingManager(this.config.horizontalScaling);
    this.autoScalingManager = new HealthcareAutoScalingManager(this.config.autoScaling);

    console.log('✅ Healthcare Scalability Management System initialized');
  }

  /**
   * Initialize the complete scalability system
   */
  async initialize(): Promise<void> {
    console.log('🚀 Starting Healthcare Scalability Management System');

    try {
      // Initialize traditional horizontal scaling
      await this.horizontalScalingManager.initialize();

      // Start advanced auto-scaling system
      await this.autoScalingManager.start();

      console.log('✅ Healthcare Scalability Management System fully operational');

    } catch (error) {
      console.error('❌ Failed to initialize scalability system:', error);
      throw error;
    }
  }

  /**
   * Shutdown the scalability system gracefully
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down Healthcare Scalability Management System');

    try {
      // Stop auto-scaling first
      await this.autoScalingManager.stop();

      // Perform traditional scaling cleanup if needed
      // (HorizontalScalingManager doesn't have explicit shutdown in the current implementation)

      console.log('✅ Healthcare Scalability Management System shutdown complete');

    } catch (error) {
      console.error('❌ Error during scalability system shutdown:', error);
      throw error;
    }
  }

  /**
   * Scale a service using comprehensive healthcare-aware logic
   */
  async scaleService(
    serviceName: string,
    targetReplicas?: number,
    urgency: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    userId?: string
  ): Promise<{
    success: boolean;
    finalReplicas: number;
    method: 'traditional' | 'auto-scaling';
    reason: string;
    logId?: string;
    costAnalysis?: any;
  }> {
    console.log(`🎯 Scaling service ${serviceName} ${targetReplicas ? `to ${targetReplicas} replicas` : 'automatically'} (${urgency} urgency)`);

    try {
      if (targetReplicas) {
        // Traditional scaling with specific target
        await this.horizontalScalingManager.scaleService(serviceName, targetReplicas);
        
        return {
          success: true,
          finalReplicas: targetReplicas,
          method: 'traditional',
          reason: 'Manual scaling request executed',
        };
      } else {
        // Auto-scaling decision
        const currentReplicas = await this.getCurrentReplicaCount(serviceName);
        const decision = await this.autoScalingManager.makeScalingDecision(
          serviceName,
          currentReplicas,
          urgency,
          userId,
          'healthcare-operator'
        );

        if (decision.approved && decision.finalReplicas !== currentReplicas) {
          // Execute the scaling through traditional manager
          await this.horizontalScalingManager.scaleService(serviceName, decision.finalReplicas);
        }

        return {
          success: decision.approved,
          finalReplicas: decision.finalReplicas,
          method: 'auto-scaling',
          reason: decision.reason,
          logId: decision.logId,
          costAnalysis: decision.costAnalysis
        };
      }

    } catch (error) {
      console.error(`❌ Failed to scale service ${serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Execute automated scaling across all services
   */
  async executeAutomatedScaling(): Promise<void> {
    console.log('🤖 Executing comprehensive automated scaling');

    try {
      // Use the auto-scaling manager for intelligent scaling decisions
      await this.autoScalingManager.executeAutomatedScaling();

    } catch (error) {
      console.error('❌ Automated scaling execution failed:', error);
      throw error;
    }
  }

  /**
   * Emergency scaling for critical healthcare situations
   */
  async emergencyScale(
    serviceName: string,
    targetReplicas: number,
    reason: string,
    userId: string
  ): Promise<string> {
    console.log(`🚨 EMERGENCY SCALING: ${serviceName} to ${targetReplicas} replicas`);

    try {
      // Use auto-scaling manager's emergency override
      const logId = await this.autoScalingManager.emergencyScalingOverride(
        serviceName,
        targetReplicas,
        reason,
        userId
      );

      // Execute immediate scaling through traditional manager
      await this.horizontalScalingManager.scaleService(serviceName, targetReplicas);

      console.log(`✅ Emergency scaling completed for ${serviceName}`);
      return logId;

    } catch (error) {
      console.error(`❌ Emergency scaling failed for ${serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Run comprehensive testing scenarios
   */
  async runScalingTests(): Promise<void> {
    console.log('🧪 Running comprehensive scaling tests');

    try {
      await this.autoScalingManager.runAutomatedTests();

    } catch (error) {
      console.error('❌ Scaling tests failed:', error);
      throw error;
    }
  }

  /**
   * Optimize scaling strategies
   */
  async optimizeScalingStrategies(): Promise<void> {
    console.log('🔧 Optimizing scaling strategies');

    try {
      await this.autoScalingManager.optimizeStrategies();

    } catch (error) {
      console.error('❌ Strategy optimization failed:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive system metrics and status
   */
  async getSystemStatus(): Promise<{
    scalability: any;
    autoScaling: any;
    health: any;
    analytics: any;
  }> {
    try {
      const [horizontalMetrics, autoScalingStatus, healthCheck, analytics] = await Promise.all([
        this.horizontalScalingManager.getMetrics(),
        this.autoScalingManager.getSystemStatus(),
        this.autoScalingManager.healthCheck(),
        this.autoScalingManager.getAnalytics()
      ]);

      return {
        scalability: horizontalMetrics,
        autoScaling: autoScalingStatus,
        health: healthCheck,
        analytics
      };

    } catch (error) {
      console.error('❌ Failed to get system status:', error);
      throw error;
    }
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<{
    healthy: boolean;
    components: { [component: string]: boolean };
    issues: string[];
    recommendations: string[];
  }> {
    try {
      const [horizontalHealth, autoScalingHealth] = await Promise.all([
        this.horizontalScalingManager.performHealthCheck(),
        this.autoScalingManager.healthCheck()
      ]);

      const allComponents = {
        ...autoScalingHealth.components,
        horizontalScaling: horizontalHealth
      };

      const allIssues = [...autoScalingHealth.issues];
      if (!horizontalHealth) {
        allIssues.push('Horizontal scaling manager is unhealthy');
      }

      const recommendations: string[] = [];
      if (allIssues.length > 0) {
        recommendations.push('Review system logs and resolve identified issues');
        recommendations.push('Consider running automated tests to validate system functionality');
      }

      if (!autoScalingHealth.healthy) {
        recommendations.push('Check auto-scaling configuration and dependencies');
      }

      const overallHealthy = Object.values(allComponents).every(status => status) && allIssues.length === 0;

      return {
        healthy: overallHealthy,
        components: allComponents,
        issues: allIssues,
        recommendations
      };

    } catch (error) {
      console.error('❌ Health check failed:', error);
      return {
        healthy: false,
        components: { healthCheck: false },
        issues: ['Health check system failure'],
        recommendations: ['Investigate health check system errors']
      };
    }
  }

  // Helper methods

  private async getCurrentReplicaCount(serviceName: string): Promise<number> {
    // Simulate getting current replica count
    // In real implementation, would query Kubernetes or container orchestrator
    const baseCounts: { [key: string]: number } = {
      'claims-processor': 3,
      'document-processor': 2,
      'emergency-processor': 1,
      'notification-service': 1
    };
    return baseCounts[serviceName] || 1;
  }

  /**
   * Get configuration
   */
  getConfiguration(): HealthcareScalabilityConfig {
    return { ...this.config };
  }

  /**
   * Update configuration (requires restart)
   */
  updateConfiguration(config: Partial<HealthcareScalabilityConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('⚙️ Configuration updated - restart required for changes to take effect');
  }

  /**
   * Get scaling metrics
   */
  async getScalingMetrics(): Promise<any> {
    return this.horizontalScalingManager.getMetrics();
  }

  /**
   * Get auto-scaling analytics
   */
  async getAutoScalingAnalytics(timeRange?: { start: Date; end: Date }): Promise<any> {
    return this.autoScalingManager.getAnalytics(timeRange);
  }
}

/**
 * Create a default healthcare scalability manager instance
 */
export function createHealthcareScalabilityManager(config?: Partial<HealthcareScalabilityConfig>): HealthcareScalabilityManager {
  return new HealthcareScalabilityManager(config);
}

/**
 * Default healthcare scalability configuration
 */
export const defaultHealthcareScalabilityConfig: HealthcareScalabilityConfig = {
  horizontalScaling: {
    loadBalancer: {
      type: 'nginx',
      healthCheckPath: '/health',
      maxConnections: 1000,
      timeoutMs: 30000,
      sslEnabled: true,
      algorithms: 'round-robin'
    },
    autoScaling: {
      enabled: true,
      minInstances: 1,
      maxInstances: 20,
      targetCPUUtilization: 70,
      targetMemoryUtilization: 80,
      scaleUpCooldown: 300000,
      scaleDownCooldown: 600000,
      metrics: ['cpu', 'memory', 'request_rate', 'response_time']
    },
    databaseCluster: {
      type: 'mongodb',
      replicationFactor: 3,
      shardingEnabled: true,
      backupStrategy: 'continuous',
      readReplicas: 2,
      writeNodes: 1
    },
    kubernetes: {
      namespace: 'healthcare',
      clusterName: 'claims-processing',
      resourceLimits: {
        cpu: '4',
        memory: '8Gi',
        storage: '100Gi'
      },
      persistentStorage: {
        storageClass: 'fast-ssd',
        size: '100Gi',
        accessModes: ['ReadWriteOnce']
      },
      networking: {
        serviceMeshEnabled: true,
        ingressController: 'nginx',
        networkPolicies: true
      }
    },
    serviceMesh: {
      provider: 'istio',
      enableMTLS: true,
      tracing: true,
      metrics: true,
      rateLimiting: true
    }
  },
  monitoring: {
    healthChecks: {
      intervalSeconds: 30,
      timeoutSeconds: 10,
      failureThreshold: 3,
      successThreshold: 1,
      endpoints: ['/health', '/ready']
    },
    metrics: {
      provider: 'prometheus',
      retentionDays: 30,
      scrapeInterval: 15,
      customMetrics: ['claims_processed', 'documents_processed', 'patient_safety_score']
    },
    alerting: {
      provider: 'pagerduty',
      thresholds: {
        cpuUsage: 80,
        memoryUsage: 85,
        responseTime: 2000,
        errorRate: 5,
        diskUsage: 90
      },
      channels: ['operations-team', 'healthcare-team']
    }
  },
  deployment: {
    strategy: 'blue-green',
    blueGreen: {
      enabled: true,
      routingPercentage: 10,
      rollbackThreshold: 5,
      verificationSteps: ['health_check', 'compliance_check', 'performance_test']
    },
    canary: {
      enabled: false,
      initialTrafficPercentage: 5,
      incrementPercentage: 10,
      intervalMinutes: 5,
      successMetrics: ['response_time', 'error_rate', 'patient_safety']
    },
    rollingUpdate: {
      maxUnavailable: '25%',
      maxSurge: '25%',
      batchSize: 2,
      pauseBetweenBatches: 30
    }
  },
  autoScaling: defaultHealthcareAutoScalingConfig
};
