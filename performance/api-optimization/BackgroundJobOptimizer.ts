import { EventEmitter } from 'events';
import cron from 'node-cron';

export interface JobConfig {
  id: string;
  name: string;
  schedule: string;
  handler: JobHandler;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  enabled: boolean;
  runOnStartup?: boolean;
  singleton?: boolean;
}

export interface JobExecution {
  id: string;
  jobId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'running' | 'completed' | 'failed' | 'timeout';
  result?: any;
  error?: string;
  retryCount: number;
  memoryUsage?: NodeJS.MemoryUsage;
  cpuUsage?: NodeJS.CpuUsage;
}

export interface JobHandler {
  (context: JobContext): Promise<any>;
}

export interface JobContext {
  jobId: string;
  executionId: string;
  logger: JobLogger;
  signal: AbortSignal;
}

export interface JobLogger {
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}

export interface JobStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDuration: number;
  lastExecution?: Date;
  lastSuccess?: Date;
  lastFailure?: Date;
  averageMemoryUsage: number;
  averageCpuUsage: number;
}

export class BackgroundJobOptimizer extends EventEmitter {
  private jobs: Map<string, JobConfig> = new Map();
  private executions: Map<string, JobExecution> = new Map();
  private runningJobs: Map<string, AbortController> = new Map();
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();
  private jobStats: Map<string, JobStats> = new Map();
  private maxExecutionHistory = 1000;

  registerJob(config: JobConfig): void {
    this.jobs.set(config.id, config);
    this.initializeJobStats(config.id);

    if (config.enabled) {
      this.scheduleJob(config);
    }

    if (config.runOnStartup) {
      this.executeJob(config.id);
    }

    this.emit('jobRegistered', config);
  }

  private initializeJobStats(jobId: string): void {
    this.jobStats.set(jobId, {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageDuration: 0,
      averageMemoryUsage: 0,
      averageCpuUsage: 0
    });
  }

  private scheduleJob(config: JobConfig): void {
    const task = cron.schedule(config.schedule, () => {
      this.executeJob(config.id);
    }, {
      scheduled: false
    });

    this.scheduledJobs.set(config.id, task);
    task.start();
  }

  async executeJob(jobId: string, immediate = false): Promise<string> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (!job.enabled && !immediate) {
      throw new Error(`Job is disabled: ${jobId}`);
    }

    // Check if singleton job is already running
    if (job.singleton && this.runningJobs.has(jobId)) {
      console.warn(`Singleton job ${jobId} is already running, skipping execution`);
      return '';
    }

    const executionId = this.generateExecutionId();
    const abortController = new AbortController();
    
    const execution: JobExecution = {
      id: executionId,
      jobId,
      startTime: new Date(),
      status: 'running',
      retryCount: 0
    };

    this.executions.set(executionId, execution);
    this.runningJobs.set(jobId, abortController);

    try {
      await this.runJobWithOptimizations(job, execution, abortController);
    } catch (error) {
      await this.handleJobError(job, execution, error);
    } finally {
      this.runningJobs.delete(jobId);
    }

    return executionId;
  }

  private async runJobWithOptimizations(
    job: JobConfig, 
    execution: JobExecution, 
    abortController: AbortController
  ): Promise<void> {
    const startMemory = process.memoryUsage();
    const startCpu = process.cpuUsage();

    // Create job context
    const context: JobContext = {
      jobId: job.id,
      executionId: execution.id,
      logger: this.createJobLogger(job.id, execution.id),
      signal: abortController.signal
    };

    // Set timeout
    const timeoutId = setTimeout(() => {
      abortController.abort();
      execution.status = 'timeout';
      execution.error = 'Job execution timeout';
    }, job.timeout);

    try {
      // Execute the job
      const result = await Promise.race([
        job.handler(context),
        this.createTimeoutPromise(job.timeout)
      ]);

      clearTimeout(timeoutId);

      execution.result = result;
      execution.status = 'completed';
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();

      // Measure resource usage
      const endMemory = process.memoryUsage();
      const endCpu = process.cpuUsage(startCpu);

      execution.memoryUsage = {
        rss: endMemory.rss - startMemory.rss,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        external: endMemory.external - startMemory.external,
        arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers
      };

      execution.cpuUsage = endCpu;

      this.updateJobStats(job.id, execution);
      this.optimizeJobPerformance(job, execution);
      this.emit('jobCompleted', execution);

    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private createTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Job timeout')), timeout);
    });
  }

  private async handleJobError(job: JobConfig, execution: JobExecution, error: any): Promise<void> {
    execution.error = error instanceof Error ? error.message : String(error);
    execution.status = 'failed';
    execution.endTime = new Date();
    execution.duration = execution.endTime.getTime() - execution.startTime.getTime();

    // Retry logic
    if (execution.retryCount < job.maxRetries) {
      execution.retryCount++;
      console.log(`Retrying job ${job.id} (attempt ${execution.retryCount}/${job.maxRetries})`);
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, job.retryDelay * execution.retryCount));
      
      try {
        const abortController = new AbortController();
        this.runningJobs.set(job.id, abortController);
        await this.runJobWithOptimizations(job, execution, abortController);
        this.runningJobs.delete(job.id);
      } catch (retryError) {
        await this.handleJobError(job, execution, retryError);
      }
    } else {
      this.updateJobStats(job.id, execution);
      this.emit('jobFailed', execution);
      console.error(`Job ${job.id} failed after ${job.maxRetries} retries:`, execution.error);
    }
  }

  private createJobLogger(jobId: string, executionId: string): JobLogger {
    const prefix = `[Job:${jobId}:${executionId}]`;
    
    return {
      info: (message: string, meta?: any) => console.log(`${prefix} INFO: ${message}`, meta || ''),
      warn: (message: string, meta?: any) => console.warn(`${prefix} WARN: ${message}`, meta || ''),
      error: (message: string, meta?: any) => console.error(`${prefix} ERROR: ${message}`, meta || ''),
      debug: (message: string, meta?: any) => console.debug(`${prefix} DEBUG: ${message}`, meta || '')
    };
  }

  private updateJobStats(jobId: string, execution: JobExecution): void {
    const stats = this.jobStats.get(jobId)!;
    
    stats.totalExecutions++;
    
    if (execution.status === 'completed') {
      stats.successfulExecutions++;
      stats.lastSuccess = execution.endTime;
    } else {
      stats.failedExecutions++;
      stats.lastFailure = execution.endTime;
    }

    stats.lastExecution = execution.endTime;

    if (execution.duration) {
      stats.averageDuration = (stats.averageDuration * (stats.totalExecutions - 1) + execution.duration) / stats.totalExecutions;
    }

    if (execution.memoryUsage) {
      const memoryMB = execution.memoryUsage.heapUsed / 1024 / 1024;
      stats.averageMemoryUsage = (stats.averageMemoryUsage * (stats.totalExecutions - 1) + memoryMB) / stats.totalExecutions;
    }

    if (execution.cpuUsage) {
      const cpuPercent = (execution.cpuUsage.user + execution.cpuUsage.system) / 1000;
      stats.averageCpuUsage = (stats.averageCpuUsage * (stats.totalExecutions - 1) + cpuPercent) / stats.totalExecutions;
    }
  }

  private optimizeJobPerformance(job: JobConfig, execution: JobExecution): void {
    // Memory usage optimization
    if (execution.memoryUsage && execution.memoryUsage.heapUsed > 100 * 1024 * 1024) {
      console.warn(`High memory usage detected for job ${job.id}: ${(execution.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      
      // Suggest optimization
      this.emit('optimizationSuggestion', {
        jobId: job.id,
        type: 'memory',
        message: 'Consider implementing data streaming or batch processing to reduce memory usage'
      });
    }

    // Execution time optimization
    if (execution.duration && execution.duration > job.timeout * 0.8) {
      console.warn(`Job ${job.id} execution time is approaching timeout: ${execution.duration}ms`);
      
      this.emit('optimizationSuggestion', {
        jobId: job.id,
        type: 'timeout',
        message: 'Consider increasing timeout or optimizing job logic'
      });
    }

    // CPU usage optimization
    if (execution.cpuUsage && (execution.cpuUsage.user + execution.cpuUsage.system) > 5000000) {
      console.warn(`High CPU usage detected for job ${job.id}`);
      
      this.emit('optimizationSuggestion', {
        jobId: job.id,
        type: 'cpu',
        message: 'Consider optimizing algorithms or implementing job segmentation'
      });
    }
  }

  enableJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    job.enabled = true;
    this.scheduleJob(job);
    this.emit('jobEnabled', jobId);
  }

  disableJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    job.enabled = false;
    
    const task = this.scheduledJobs.get(jobId);
    if (task) {
      task.stop();
      this.scheduledJobs.delete(jobId);
    }

    // Abort running instance if exists
    const abortController = this.runningJobs.get(jobId);
    if (abortController) {
      abortController.abort();
    }

    this.emit('jobDisabled', jobId);
  }

  getJobStats(jobId: string): JobStats | undefined {
    return this.jobStats.get(jobId);
  }

  getJobExecution(executionId: string): JobExecution | undefined {
    return this.executions.get(executionId);
  }

  getJobExecutions(jobId: string, limit?: number): JobExecution[] {
    const executions = Array.from(this.executions.values())
      .filter(exec => exec.jobId === jobId)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

    return limit ? executions.slice(0, limit) : executions;
  }

  getAllJobStats(): Map<string, JobStats> {
    return new Map(this.jobStats);
  }

  getSystemStats(): {
    totalJobs: number;
    enabledJobs: number;
    runningJobs: number;
    totalExecutions: number;
    successRate: number;
    averageExecutionTime: number;
  } {
    const totalJobs = this.jobs.size;
    const enabledJobs = Array.from(this.jobs.values()).filter(job => job.enabled).length;
    const runningJobs = this.runningJobs.size;
    
    const allStats = Array.from(this.jobStats.values());
    const totalExecutions = allStats.reduce((sum, stats) => sum + stats.totalExecutions, 0);
    const successfulExecutions = allStats.reduce((sum, stats) => sum + stats.successfulExecutions, 0);
    const totalDuration = allStats.reduce((sum, stats) => sum + (stats.averageDuration * stats.totalExecutions), 0);

    return {
      totalJobs,
      enabledJobs,
      runningJobs,
      totalExecutions,
      successRate: totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0,
      averageExecutionTime: totalExecutions > 0 ? totalDuration / totalExecutions : 0
    };
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  cleanup(): void {
    // Keep only recent executions
    const executions = Array.from(this.executions.values())
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, this.maxExecutionHistory);

    this.executions.clear();
    executions.forEach(exec => this.executions.set(exec.id, exec));
  }

  async shutdown(): Promise<void> {
    console.log('Shutting down background job optimizer...');

    // Stop all scheduled jobs
    this.scheduledJobs.forEach(task => task.stop());
    this.scheduledJobs.clear();

    // Abort all running jobs
    this.runningJobs.forEach(controller => controller.abort());
    
    // Wait for jobs to complete
    while (this.runningJobs.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('Background job optimizer shutdown complete');
  }
}
