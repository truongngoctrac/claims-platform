/**
 * Rolling Update Manager
 * Healthcare Claims Processing - Rolling Updates Implementation
 */

import { RollingUpdateConfig } from '../types';

interface RollingUpdateState {
  serviceName: string;
  fromVersion: string;
  toVersion: string;
  totalReplicas: number;
  updatedReplicas: number;
  readyReplicas: number;
  unavailableReplicas: number;
  phase: 'preparing' | 'updating' | 'completed' | 'failed' | 'paused';
  startTime: Date;
  estimatedCompletion?: Date;
}

export class RollingUpdateManager {
  private updates: Map<string, RollingUpdateState> = new Map();
  
  constructor(private config: RollingUpdateConfig) {}

  async initialize(): Promise<void> {
    console.log('🔄 Initializing Rolling Update Manager');
    console.log('✅ Rolling Update Manager initialized');
  }

  async startRollingUpdate(
    serviceName: string,
    newVersion: string,
    currentVersion: string,
    totalReplicas: number
  ): Promise<boolean> {
    console.log(`🔄 Starting rolling update for ${serviceName}: ${currentVersion} → ${newVersion}`);

    const updateState: RollingUpdateState = {
      serviceName,
      fromVersion: currentVersion,
      toVersion: newVersion,
      totalReplicas,
      updatedReplicas: 0,
      readyReplicas: totalReplicas, // Start with all replicas ready
      unavailableReplicas: 0,
      phase: 'preparing',
      startTime: new Date(),
      estimatedCompletion: this.calculateEstimatedCompletion(totalReplicas)
    };

    this.updates.set(serviceName, updateState);

    try {
      updateState.phase = 'updating';
      
      const success = await this.performRollingUpdate(serviceName);
      
      if (success) {
        updateState.phase = 'completed';
        console.log(`✅ Rolling update completed for ${serviceName}`);
        return true;
      } else {
        updateState.phase = 'failed';
        console.log(`❌ Rolling update failed for ${serviceName}`);
        return false;
      }
    } catch (error) {
      updateState.phase = 'failed';
      console.error(`❌ Rolling update error for ${serviceName}:`, error);
      return false;
    } finally {
      this.updates.set(serviceName, updateState);
    }
  }

  private calculateEstimatedCompletion(totalReplicas: number): Date {
    const batchSize = this.config.batchSize;
    const pauseBetweenBatches = this.config.pauseBetweenBatches * 1000; // Convert to ms
    const deploymentTimePerReplica = 30000; // 30 seconds per replica
    
    const totalBatches = Math.ceil(totalReplicas / batchSize);
    const totalTime = (totalBatches * deploymentTimePerReplica) + ((totalBatches - 1) * pauseBetweenBatches);
    
    return new Date(Date.now() + totalTime);
  }

  private async performRollingUpdate(serviceName: string): Promise<boolean> {
    const updateState = this.updates.get(serviceName);
    if (!updateState) return false;

    const batchSize = this.config.batchSize;
    const maxUnavailable = this.parseMaxUnavailable(this.config.maxUnavailable, updateState.totalReplicas);
    const maxSurge = this.parseMaxSurge(this.config.maxSurge, updateState.totalReplicas);

    console.log(`📊 Rolling update parameters:`, {
      totalReplicas: updateState.totalReplicas,
      batchSize,
      maxUnavailable,
      maxSurge
    });

    let currentBatch = 0;
    const totalBatches = Math.ceil(updateState.totalReplicas / batchSize);

    while (updateState.updatedReplicas < updateState.totalReplicas) {
      currentBatch++;
      console.log(`🔄 Processing batch ${currentBatch}/${totalBatches}`);

      const replicasInThisBatch = Math.min(
        batchSize,
        updateState.totalReplicas - updateState.updatedReplicas
      );

      // Update replicas in this batch
      const success = await this.updateBatch(serviceName, replicasInThisBatch, maxUnavailable, maxSurge);
      
      if (!success) {
        console.error(`❌ Batch ${currentBatch} failed for ${serviceName}`);
        return false;
      }

      updateState.updatedReplicas += replicasInThisBatch;
      this.updates.set(serviceName, updateState);

      console.log(`✅ Batch ${currentBatch} completed (${updateState.updatedReplicas}/${updateState.totalReplicas} replicas updated)`);

      // Pause between batches (except for the last batch)
      if (updateState.updatedReplicas < updateState.totalReplicas) {
        console.log(`⏸️ Pausing ${this.config.pauseBetweenBatches}s between batches`);
        await new Promise(resolve => setTimeout(resolve, this.config.pauseBetweenBatches * 1000));
      }
    }

    return true;
  }

  private parseMaxUnavailable(maxUnavailable: string, totalReplicas: number): number {
    if (maxUnavailable.endsWith('%')) {
      const percentage = parseInt(maxUnavailable.slice(0, -1));
      return Math.floor((percentage / 100) * totalReplicas);
    }
    return parseInt(maxUnavailable);
  }

  private parseMaxSurge(maxSurge: string, totalReplicas: number): number {
    if (maxSurge.endsWith('%')) {
      const percentage = parseInt(maxSurge.slice(0, -1));
      return Math.floor((percentage / 100) * totalReplicas);
    }
    return parseInt(maxSurge);
  }

  private async updateBatch(
    serviceName: string,
    batchSize: number,
    maxUnavailable: number,
    maxSurge: number
  ): Promise<boolean> {
    const updateState = this.updates.get(serviceName);
    if (!updateState) return false;

    console.log(`📦 Updating ${batchSize} replicas for ${serviceName}`);

    // Phase 1: Create new replicas (if maxSurge allows)
    if (maxSurge > 0) {
      const surgeReplicas = Math.min(batchSize, maxSurge);
      await this.createSurgeReplicas(serviceName, surgeReplicas, updateState.toVersion);
      updateState.readyReplicas += surgeReplicas;
    }

    // Phase 2: Terminate old replicas
    const replicasToTerminate = Math.min(batchSize, maxUnavailable + (maxSurge > 0 ? Math.min(batchSize, maxSurge) : 0));
    await this.terminateOldReplicas(serviceName, replicasToTerminate);
    updateState.unavailableReplicas += replicasToTerminate;

    // Phase 3: Wait for new replicas to be ready
    const newReplicasToCreate = maxSurge > 0 ? 0 : batchSize;
    if (newReplicasToCreate > 0) {
      await this.createNewReplicas(serviceName, newReplicasToCreate, updateState.toVersion);
      updateState.readyReplicas += newReplicasToCreate;
    }

    // Phase 4: Verify batch health
    const batchHealthy = await this.verifyBatchHealth(serviceName);
    if (!batchHealthy) {
      console.error(`❌ Batch health verification failed for ${serviceName}`);
      return false;
    }

    // Update unavailable count
    updateState.unavailableReplicas = Math.max(0, updateState.unavailableReplicas - replicasToTerminate);
    this.updates.set(serviceName, updateState);

    return true;
  }

  private async createSurgeReplicas(serviceName: string, count: number, version: string): Promise<void> {
    console.log(`➕ Creating ${count} surge replicas for ${serviceName}`);
    
    for (let i = 0; i < count; i++) {
      await this.createReplica(serviceName, version, 'surge');
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay between replicas
    }
    
    console.log(`✅ Created ${count} surge replicas for ${serviceName}`);
  }

  private async terminateOldReplicas(serviceName: string, count: number): Promise<void> {
    console.log(`➖ Terminating ${count} old replicas for ${serviceName}`);
    
    for (let i = 0; i < count; i++) {
      await this.terminateReplica(serviceName, 'old');
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay between terminations
    }
    
    console.log(`✅ Terminated ${count} old replicas for ${serviceName}`);
  }

  private async createNewReplicas(serviceName: string, count: number, version: string): Promise<void> {
    console.log(`➕ Creating ${count} new replicas for ${serviceName}`);
    
    for (let i = 0; i < count; i++) {
      await this.createReplica(serviceName, version, 'new');
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay for readiness
    }
    
    console.log(`✅ Created ${count} new replicas for ${serviceName}`);
  }

  private async createReplica(serviceName: string, version: string, type: string): Promise<void> {
    console.log(`📦 Creating ${type} replica for ${serviceName}:${version}`);
    
    // Simulate replica creation and startup time
    await new Promise(resolve => setTimeout(resolve, 5000 + Math.random() * 5000)); // 5-10 seconds
    
    // Simulate readiness probe
    await this.waitForReplicaReadiness(serviceName);
  }

  private async terminateReplica(serviceName: string, type: string): Promise<void> {
    console.log(`🗑️ Terminating ${type} replica for ${serviceName}`);
    
    // Simulate graceful termination
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000)); // 2-5 seconds
  }

  private async waitForReplicaReadiness(serviceName: string): Promise<void> {
    console.log(`⏳ Waiting for replica readiness for ${serviceName}`);
    
    // Simulate readiness check
    const maxAttempts = 30; // 30 attempts
    const checkInterval = 2000; // 2 seconds
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      
      // Simulate readiness (90% chance of being ready each attempt)
      if (Math.random() > 0.1) {
        console.log(`✅ Replica ready for ${serviceName} (attempt ${attempt})`);
        return;
      }
    }
    
    throw new Error(`Replica failed to become ready for ${serviceName}`);
  }

  private async verifyBatchHealth(serviceName: string): Promise<boolean> {
    console.log(`🔍 Verifying batch health for ${serviceName}`);
    
    // Simulate health verification
    await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second health check
    
    // Simulate various health metrics
    const healthMetrics = {
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 100,
      errorRate: Math.random() * 2,
      responseTime: Math.random() * 200
    };
    
    const isHealthy = 
      healthMetrics.cpuUsage < 80 && 
      healthMetrics.memoryUsage < 85 && 
      healthMetrics.errorRate < 1 && 
      healthMetrics.responseTime < 150;
    
    if (isHealthy) {
      console.log(`✅ Batch health verification passed for ${serviceName}`);
    } else {
      console.error(`❌ Batch health verification failed for ${serviceName}:`, healthMetrics);
    }
    
    return isHealthy;
  }

  async pauseRollingUpdate(serviceName: string): Promise<void> {
    const updateState = this.updates.get(serviceName);
    if (!updateState || updateState.phase !== 'updating') {
      throw new Error(`No active rolling update found for ${serviceName}`);
    }

    updateState.phase = 'paused';
    this.updates.set(serviceName, updateState);
    
    console.log(`⏸️ Rolling update paused for ${serviceName}`);
  }

  async resumeRollingUpdate(serviceName: string): Promise<void> {
    const updateState = this.updates.get(serviceName);
    if (!updateState || updateState.phase !== 'paused') {
      throw new Error(`No paused rolling update found for ${serviceName}`);
    }

    updateState.phase = 'updating';
    this.updates.set(serviceName, updateState);
    
    console.log(`▶️ Rolling update resumed for ${serviceName}`);
    
    // Continue with the rolling update
    await this.performRollingUpdate(serviceName);
  }

  async rollbackUpdate(serviceName: string): Promise<void> {
    const updateState = this.updates.get(serviceName);
    if (!updateState) {
      throw new Error(`No rolling update found for ${serviceName}`);
    }

    console.log(`🔄 Rolling back update for ${serviceName} to version ${updateState.fromVersion}`);
    
    // Start a new rolling update back to the original version
    await this.startRollingUpdate(
      serviceName,
      updateState.fromVersion,
      updateState.toVersion,
      updateState.totalReplicas
    );
    
    console.log(`✅ Rollback completed for ${serviceName}`);
  }

  async getUpdateStatus(serviceName?: string): Promise<any> {
    if (serviceName) {
      const updateState = this.updates.get(serviceName);
      if (!updateState) return null;
      
      return {
        ...updateState,
        progress: (updateState.updatedReplicas / updateState.totalReplicas) * 100,
        timeElapsed: Date.now() - updateState.startTime.getTime(),
        estimatedTimeRemaining: updateState.estimatedCompletion 
          ? Math.max(0, updateState.estimatedCompletion.getTime() - Date.now())
          : null
      };
    }
    
    return Object.fromEntries(this.updates);
  }

  async getUpdateHistory(): Promise<any[]> {
    return Array.from(this.updates.values())
      .filter(update => update.phase === 'completed' || update.phase === 'failed')
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, 20); // Return last 20 updates
  }

  async isHealthy(): Promise<boolean> {
    const activeUpdates = Array.from(this.updates.values())
      .filter(update => update.phase === 'updating');
    
    // Check if any active updates are stuck or failing
    for (const update of activeUpdates) {
      const timeElapsed = Date.now() - update.startTime.getTime();
      const estimatedTime = update.estimatedCompletion 
        ? update.estimatedCompletion.getTime() - update.startTime.getTime()
        : 0;
      
      // If update is taking more than 150% of estimated time, consider it unhealthy
      if (timeElapsed > estimatedTime * 1.5) {
        return false;
      }
    }
    
    return true;
  }
}
