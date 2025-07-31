import { EventEmitter } from 'events';
import { cpus } from 'os';
import cluster from 'cluster';

export interface CPUConfig {
  maxUtilization: number; // Maximum CPU utilization percentage
  monitoringInterval: number; // Monitoring interval in ms
  enableProcessBalancing: boolean;
  enableTaskDistribution: boolean;
  enableCPUProfiling: boolean;
  workerCount?: number;
  taskQueueSize: number;
  cpuIntensiveThreshold: number; // ms
}

export interface CPUMetrics {
  timestamp: Date;
  totalUsage: number;
  userUsage: number;
  systemUsage: number;
  idle: number;
  processes: number;
  loadAverage: number[];
  perCoreUsage: number[];
}

export interface TaskMetrics {
  taskId: string;
  cpuTime: number;
  wallTime: number;
  cpuIntensive: boolean;
  startTime: Date;
  endTime?: Date;
}

export interface CPUStats {
  currentUsage: number;
  averageUsage: number;
  peakUsage: number;
  cpuBoundTasks: number;
  totalTasks: number;
  averageTaskTime: number;
  loadBalance: number;
  bottleneckDetected: boolean;
}

export class CPUUtilizationOptimizer extends EventEmitter {
  private config: CPUConfig;
  private metrics: CPUMetrics[] = [];
  private taskMetrics: Map<string, TaskMetrics> = new Map();
  private stats: CPUStats;
  private monitoringInterval: NodeJS.Timeout;
  private workers: Map<number, any> = new Map();
  private taskQueue: Array<{
    task: Function;
    resolve: Function;
    reject: Function;
    priority: number;
    estimatedCPUTime: number;
  }> = [];
  private cpuCores: number;
  private lastCPUUsage: NodeJS.CpuUsage;

  constructor(config: CPUConfig) {
    super();
    this.config = config;
    this.cpuCores = cpus().length;
    this.lastCPUUsage = process.cpuUsage();
    this.stats = this.initializeStats();
    
    if (cluster.isMaster && this.config.enableProcessBalancing) {
      this.setupCluster();
    }
    
    this.startMonitoring();
  }

  private initializeStats(): CPUStats {
    return {
      currentUsage: 0,
      averageUsage: 0,
      peakUsage: 0,
      cpuBoundTasks: 0,
      totalTasks: 0,
      averageTaskTime: 0,
      loadBalance: 100,
      bottleneckDetected: false
    };
  }

  private setupCluster(): void {
    const workerCount = this.config.workerCount || this.cpuCores;
    
    console.log(`Setting up cluster with ${workerCount} workers`);
    
    for (let i = 0; i < workerCount; i++) {
      this.createWorker();
    }

    cluster.on('exit', (worker, code, signal) => {
      console.log(`Worker ${worker.process.pid} died`);
      this.createWorker(); // Replace dead worker
    });
  }

  private createWorker(): void {
    const worker = cluster.fork();
    this.workers.set(worker.id, {
      worker,
      load: 0,
      tasks: 0,
      lastTask: new Date()
    });

    worker.on('message', (message) => {
      this.handleWorkerMessage(worker.id, message);
    });
  }

  private handleWorkerMessage(workerId: number, message: any): void {
    const workerInfo = this.workers.get(workerId);
    if (!workerInfo) return;

    switch (message.type) {
      case 'taskCompleted':
        workerInfo.load = Math.max(0, workerInfo.load - 1);
        workerInfo.lastTask = new Date();
        this.handleTaskCompletion(message.taskId, message.metrics);
        break;
      case 'taskStarted':
        workerInfo.load++;
        workerInfo.tasks++;
        break;
      case 'cpuMetrics':
        this.processCPUMetrics(message.metrics);
        break;
    }
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.collectCPUMetrics();
      this.analyzePerformance();
      this.optimizeCPUUsage();
    }, this.config.monitoringInterval);
  }

  private collectCPUMetrics(): void {
    const currentUsage = process.cpuUsage(this.lastCPUUsage);
    const totalCPUTime = currentUsage.user + currentUsage.system;
    const totalTime = this.config.monitoringInterval * 1000; // Convert to microseconds
    
    const cpuPercentage = (totalCPUTime / totalTime) * 100;
    
    const metric: CPUMetrics = {
      timestamp: new Date(),
      totalUsage: cpuPercentage,
      userUsage: (currentUsage.user / totalTime) * 100,
      systemUsage: (currentUsage.system / totalTime) * 100,
      idle: 100 - cpuPercentage,
      processes: this.workers.size || 1,
      loadAverage: this.getLoadAverage(),
      perCoreUsage: this.getPerCoreUsage()
    };

    this.metrics.push(metric);
    
    // Keep only recent metrics
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }

    this.updateStats(metric);
    this.lastCPUUsage = process.cpuUsage();
  }

  private getLoadAverage(): number[] {
    try {
      const { loadavg } = require('os');
      return loadavg();
    } catch {
      return [0, 0, 0];
    }
  }

  private getPerCoreUsage(): number[] {
    // Simplified per-core usage calculation
    // In production, you'd use more sophisticated tools
    const coreCount = this.cpuCores;
    const baseUsage = this.stats.currentUsage;
    
    return Array(coreCount).fill(0).map(() => 
      baseUsage + (Math.random() - 0.5) * 20 // Simulate variance
    );
  }

  private updateStats(metric: CPUMetrics): void {
    this.stats.currentUsage = metric.totalUsage;
    
    if (metric.totalUsage > this.stats.peakUsage) {
      this.stats.peakUsage = metric.totalUsage;
    }

    // Update average usage
    const totalMetrics = this.metrics.length;
    this.stats.averageUsage = 
      (this.stats.averageUsage * (totalMetrics - 1) + metric.totalUsage) / totalMetrics;

    // Check for bottlenecks
    this.stats.bottleneckDetected = metric.totalUsage > this.config.maxUtilization;
    
    // Calculate load balance
    this.calculateLoadBalance();
  }

  private calculateLoadBalance(): void {
    if (this.workers.size <= 1) {
      this.stats.loadBalance = 100;
      return;
    }

    const loads = Array.from(this.workers.values()).map(w => w.load);
    const maxLoad = Math.max(...loads);
    const minLoad = Math.min(...loads);
    
    if (maxLoad === 0) {
      this.stats.loadBalance = 100;
    } else {
      this.stats.loadBalance = ((maxLoad - minLoad) / maxLoad) * 100;
    }
  }

  private analyzePerformance(): void {
    if (this.metrics.length < 10) return;

    const recentMetrics = this.metrics.slice(-10);
    const avgRecentUsage = recentMetrics.reduce((sum, m) => sum + m.totalUsage, 0) / recentMetrics.length;

    // Detect high CPU usage
    if (avgRecentUsage > this.config.maxUtilization) {
      this.emit('highCPUUsage', {
        current: avgRecentUsage,
        threshold: this.config.maxUtilization,
        duration: recentMetrics.length * this.config.monitoringInterval
      });
    }

    // Detect CPU spikes
    const spikes = recentMetrics.filter(m => m.totalUsage > this.config.maxUtilization * 1.2);
    if (spikes.length > 3) {
      this.emit('cpuSpikes', {
        count: spikes.length,
        avgUsage: spikes.reduce((sum, s) => sum + s.totalUsage, 0) / spikes.length
      });
    }

    // Analyze load average
    const loadAvg = recentMetrics[recentMetrics.length - 1].loadAverage;
    if (loadAvg[0] > this.cpuCores * 1.5) {
      this.emit('highLoadAverage', {
        loadAvg: loadAvg[0],
        cores: this.cpuCores,
        ratio: loadAvg[0] / this.cpuCores
      });
    }
  }

  private optimizeCPUUsage(): void {
    // Redistribute tasks if load is unbalanced
    if (this.config.enableTaskDistribution && this.stats.loadBalance < 60) {
      this.redistributeTasks();
    }

    // Process task queue efficiently
    this.processTaskQueue();

    // Suggest optimizations
    this.suggestOptimizations();
  }

  private redistributeTasks(): void {
    if (this.workers.size <= 1) return;

    const workerLoads = Array.from(this.workers.entries())
      .map(([id, info]) => ({ id, load: info.load }))
      .sort((a, b) => a.load - b.load);

    const lightestWorker = workerLoads[0];
    const heaviestWorker = workerLoads[workerLoads.length - 1];

    if (heaviestWorker.load - lightestWorker.load > 2) {
      // Send message to redistribute
      this.emit('taskRedistribution', {
        from: heaviestWorker.id,
        to: lightestWorker.id,
        loadDifference: heaviestWorker.load - lightestWorker.load
      });
    }
  }

  private processTaskQueue(): void {
    if (this.taskQueue.length === 0) return;

    // Sort tasks by priority and estimated CPU time
    this.taskQueue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority; // Higher priority first
      }
      return a.estimatedCPUTime - b.estimatedCPUTime; // Shorter tasks first
    });

    // Check if we can process more tasks
    const availableCapacity = this.getAvailableCPUCapacity();
    
    while (this.taskQueue.length > 0 && availableCapacity > 0.2) {
      const taskInfo = this.taskQueue.shift()!;
      this.executeTask(taskInfo);
    }
  }

  private getAvailableCPUCapacity(): number {
    return Math.max(0, (this.config.maxUtilization - this.stats.currentUsage) / 100);
  }

  private async executeTask(taskInfo: any): Promise<void> {
    const taskId = this.generateTaskId();
    const startTime = Date.now();
    const startCPU = process.cpuUsage();

    try {
      const result = await taskInfo.task();
      
      const endTime = Date.now();
      const endCPU = process.cpuUsage(startCPU);
      const cpuTime = endCPU.user + endCPU.system;
      const wallTime = endTime - startTime;

      const taskMetric: TaskMetrics = {
        taskId,
        cpuTime: cpuTime / 1000, // Convert to milliseconds
        wallTime,
        cpuIntensive: cpuTime / 1000 > this.config.cpuIntensiveThreshold,
        startTime: new Date(startTime),
        endTime: new Date(endTime)
      };

      this.taskMetrics.set(taskId, taskMetric);
      this.updateTaskStats(taskMetric);

      taskInfo.resolve(result);

    } catch (error) {
      taskInfo.reject(error);
    }
  }

  private updateTaskStats(taskMetric: TaskMetrics): void {
    this.stats.totalTasks++;
    
    if (taskMetric.cpuIntensive) {
      this.stats.cpuBoundTasks++;
    }

    // Update average task time
    this.stats.averageTaskTime = 
      (this.stats.averageTaskTime * (this.stats.totalTasks - 1) + taskMetric.wallTime) / 
      this.stats.totalTasks;
  }

  private suggestOptimizations(): void {
    const suggestions: string[] = [];

    // High CPU usage suggestions
    if (this.stats.currentUsage > this.config.maxUtilization * 0.9) {
      suggestions.push('CPU usage is very high - consider horizontal scaling');
    }

    // CPU-bound task suggestions
    if (this.stats.cpuBoundTasks / this.stats.totalTasks > 0.7) {
      suggestions.push('Many CPU-intensive tasks detected - consider task optimization');
    }

    // Load balancing suggestions
    if (this.stats.loadBalance < 70 && this.workers.size > 1) {
      suggestions.push('Poor load balancing detected - redistribute tasks');
    }

    // Cluster suggestions
    if (this.stats.currentUsage > 80 && this.workers.size < this.cpuCores) {
      suggestions.push('Consider adding more worker processes');
    }

    if (suggestions.length > 0) {
      this.emit('optimizationSuggestions', {
        suggestions,
        currentUsage: this.stats.currentUsage,
        stats: this.stats
      });
    }
  }

  async executeTaskOptimized<T>(
    task: () => Promise<T>, 
    options: {
      priority?: number;
      estimatedCPUTime?: number;
      timeout?: number;
    } = {}
  ): Promise<T> {
    const {
      priority = 5,
      estimatedCPUTime = 100,
      timeout = 30000
    } = options;

    // Check if we can execute immediately
    const availableCapacity = this.getAvailableCPUCapacity();
    
    if (availableCapacity > 0.5 && this.taskQueue.length === 0) {
      // Execute immediately
      return this.executeTaskDirect(task);
    }

    // Queue the task
    return new Promise((resolve, reject) => {
      if (this.taskQueue.length >= this.config.taskQueueSize) {
        reject(new Error('Task queue is full'));
        return;
      }

      const taskInfo = {
        task,
        resolve,
        reject,
        priority,
        estimatedCPUTime
      };

      this.taskQueue.push(taskInfo);

      // Set timeout
      setTimeout(() => {
        const index = this.taskQueue.indexOf(taskInfo);
        if (index !== -1) {
          this.taskQueue.splice(index, 1);
          reject(new Error('Task timeout'));
        }
      }, timeout);
    });
  }

  private async executeTaskDirect<T>(task: () => Promise<T>): Promise<T> {
    const taskId = this.generateTaskId();
    const startTime = Date.now();
    const startCPU = process.cpuUsage();

    try {
      const result = await task();
      
      const endTime = Date.now();
      const endCPU = process.cpuUsage(startCPU);
      
      const taskMetric: TaskMetrics = {
        taskId,
        cpuTime: (endCPU.user + endCPU.system) / 1000,
        wallTime: endTime - startTime,
        cpuIntensive: (endCPU.user + endCPU.system) / 1000 > this.config.cpuIntensiveThreshold,
        startTime: new Date(startTime),
        endTime: new Date(endTime)
      };

      this.taskMetrics.set(taskId, taskMetric);
      this.updateTaskStats(taskMetric);

      return result;

    } catch (error) {
      throw error;
    }
  }

  // CPU Profiling methods
  startCPUProfile(name: string): void {
    if (!this.config.enableCPUProfiling) return;

    try {
      const profiler = require('v8-profiler-next');
      profiler.startProfiling(name, true);
      
      this.emit('profilingStarted', { name, timestamp: new Date() });
    } catch (error) {
      console.warn('CPU profiling not available:', error);
    }
  }

  stopCPUProfile(name: string): any {
    if (!this.config.enableCPUProfiling) return null;

    try {
      const profiler = require('v8-profiler-next');
      const profile = profiler.stopProfiling(name);
      
      this.emit('profilingStopped', { 
        name, 
        timestamp: new Date(),
        profile: profile
      });

      return profile;
    } catch (error) {
      console.warn('CPU profiling not available:', error);
      return null;
    }
  }

  getCPUStats(): CPUStats {
    return { ...this.stats };
  }

  getCPUMetrics(count?: number): CPUMetrics[] {
    return count ? this.metrics.slice(-count) : [...this.metrics];
  }

  getTaskMetrics(): TaskMetrics[] {
    return Array.from(this.taskMetrics.values());
  }

  getCPUIntensiveTasks(limit: number = 10): TaskMetrics[] {
    return Array.from(this.taskMetrics.values())
      .filter(task => task.cpuIntensive)
      .sort((a, b) => b.cpuTime - a.cpuTime)
      .slice(0, limit);
  }

  getWorkerStats(): Array<{
    id: number;
    load: number;
    tasks: number;
    lastTask: Date;
  }> {
    return Array.from(this.workers.entries()).map(([id, info]) => ({
      id,
      load: info.load,
      tasks: info.tasks,
      lastTask: info.lastTask
    }));
  }

  optimizeCPUConfiguration(): {
    recommendedWorkers: number;
    recommendedMaxUtilization: number;
    taskQueueOptimal: number;
    reasoning: string[];
  } {
    const reasoning: string[] = [];
    
    // Analyze current performance
    const avgUsage = this.stats.averageUsage;
    const peakUsage = this.stats.peakUsage;
    const loadBalance = this.stats.loadBalance;

    let recommendedWorkers = this.workers.size || this.cpuCores;
    let recommendedMaxUtilization = this.config.maxUtilization;
    let taskQueueOptimal = this.config.taskQueueSize;

    // Worker count optimization
    if (avgUsage > 70 && loadBalance > 80) {
      recommendedWorkers = Math.min(this.cpuCores * 2, recommendedWorkers + 2);
      reasoning.push('High CPU usage with good load balance - increase workers');
    }

    if (avgUsage < 30 && this.workers.size > this.cpuCores) {
      recommendedWorkers = Math.max(this.cpuCores, recommendedWorkers - 1);
      reasoning.push('Low CPU usage - reduce worker count');
    }

    // Utilization threshold optimization
    if (peakUsage < recommendedMaxUtilization * 0.8) {
      recommendedMaxUtilization = Math.min(95, recommendedMaxUtilization + 10);
      reasoning.push('Peak usage below threshold - can increase max utilization');
    }

    // Queue size optimization
    const avgQueueLength = this.taskQueue.length;
    if (avgQueueLength > taskQueueOptimal * 0.8) {
      taskQueueOptimal = Math.min(10000, taskQueueOptimal * 1.5);
      reasoning.push('Frequent queue saturation - increase queue size');
    }

    return {
      recommendedWorkers,
      recommendedMaxUtilization,
      taskQueueOptimal,
      reasoning
    };
  }

  generateCPUReport(): {
    utilization: {
      current: number;
      average: number;
      peak: number;
      trend: string;
    };
    performance: {
      tasksPerSecond: number;
      avgTaskTime: number;
      cpuBoundRatio: number;
      loadBalance: number;
    };
    bottlenecks: string[];
    recommendations: string[];
  } {
    const bottlenecks: string[] = [];
    const recommendations: string[] = [];

    // Determine trend
    let trend = 'stable';
    if (this.metrics.length > 20) {
      const recent = this.metrics.slice(-10);
      const older = this.metrics.slice(-20, -10);
      
      const recentAvg = recent.reduce((sum, m) => sum + m.totalUsage, 0) / recent.length;
      const olderAvg = older.reduce((sum, m) => sum + m.totalUsage, 0) / older.length;
      
      const change = ((recentAvg - olderAvg) / olderAvg) * 100;
      
      if (change > 10) trend = 'increasing';
      else if (change < -10) trend = 'decreasing';
    }

    // Calculate tasks per second
    const tasksPerSecond = this.stats.totalTasks > 0 && this.metrics.length > 0 ?
      this.stats.totalTasks / (this.metrics.length * this.config.monitoringInterval / 1000) : 0;

    // Identify bottlenecks
    if (this.stats.currentUsage > 90) {
      bottlenecks.push('CPU utilization is critically high');
    }

    if (this.stats.loadBalance < 60) {
      bottlenecks.push('Poor load balancing between workers');
    }

    if (this.taskQueue.length > this.config.taskQueueSize * 0.8) {
      bottlenecks.push('Task queue is near capacity');
    }

    // Generate recommendations
    if (this.stats.cpuBoundTasks / this.stats.totalTasks > 0.8) {
      recommendations.push('Many CPU-intensive tasks - consider optimization or async processing');
    }

    if (this.stats.averageTaskTime > 1000) {
      recommendations.push('High average task time - profile and optimize slow tasks');
    }

    if (this.workers.size < this.cpuCores && this.stats.currentUsage > 70) {
      recommendations.push('Underutilizing available CPU cores - consider adding workers');
    }

    return {
      utilization: {
        current: this.stats.currentUsage,
        average: this.stats.averageUsage,
        peak: this.stats.peakUsage,
        trend
      },
      performance: {
        tasksPerSecond,
        avgTaskTime: this.stats.averageTaskTime,
        cpuBoundRatio: this.stats.totalTasks > 0 ? 
          (this.stats.cpuBoundTasks / this.stats.totalTasks) * 100 : 0,
        loadBalance: this.stats.loadBalance
      },
      bottlenecks,
      recommendations
    };
  }

  private generateTaskId(): string {
    return `cpu_task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  shutdown(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    // Shutdown workers
    this.workers.forEach((workerInfo) => {
      workerInfo.worker.kill();
    });

    this.workers.clear();
    this.taskQueue = [];
    this.taskMetrics.clear();

    console.log('CPU utilization optimizer shutdown complete');
  }
}

// Predefined CPU configurations
export const CPUPresets = {
  singleCore: {
    maxUtilization: 80,
    monitoringInterval: 1000,
    enableProcessBalancing: false,
    enableTaskDistribution: true,
    enableCPUProfiling: false,
    workerCount: 1,
    taskQueueSize: 100,
    cpuIntensiveThreshold: 100
  },

  multiCore: {
    maxUtilization: 75,
    monitoringInterval: 2000,
    enableProcessBalancing: true,
    enableTaskDistribution: true,
    enableCPUProfiling: true,
    taskQueueSize: 500,
    cpuIntensiveThreshold: 50
  },

  highPerformance: {
    maxUtilization: 90,
    monitoringInterval: 500,
    enableProcessBalancing: true,
    enableTaskDistribution: true,
    enableCPUProfiling: true,
    taskQueueSize: 1000,
    cpuIntensiveThreshold: 25
  },

  development: {
    maxUtilization: 60,
    monitoringInterval: 5000,
    enableProcessBalancing: false,
    enableTaskDistribution: true,
    enableCPUProfiling: true,
    workerCount: 2,
    taskQueueSize: 50,
    cpuIntensiveThreshold: 200
  }
};
