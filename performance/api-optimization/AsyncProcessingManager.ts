import { EventEmitter } from 'events';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { promisify } from 'util';

export interface AsyncTask {
  id: string;
  type: string;
  data: any;
  priority: 'low' | 'medium' | 'high' | 'critical';
  retryCount: number;
  maxRetries: number;
  timeout: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  result?: any;
}

export interface WorkerConfig {
  maxWorkers: number;
  taskTimeout: number;
  retryDelay: number;
  maxQueueSize: number;
}

export interface TaskHandler {
  (data: any): Promise<any>;
}

export class AsyncProcessingManager extends EventEmitter {
  private tasks: Map<string, AsyncTask> = new Map();
  private taskQueue: AsyncTask[] = [];
  private workers: Worker[] = [];
  private availableWorkers: Worker[] = [];
  private busyWorkers: Set<Worker> = new Set();
  private taskHandlers: Map<string, TaskHandler> = new Map();
  private config: WorkerConfig;
  private isShuttingDown = false;

  constructor(config: WorkerConfig) {
    super();
    this.config = config;
    this.initializeWorkers();
    this.startQueueProcessor();
  }

  private initializeWorkers(): void {
    for (let i = 0; i < this.config.maxWorkers; i++) {
      this.createWorker();
    }
  }

  private createWorker(): Worker {
    const worker = new Worker(__filename, {
      workerData: { isWorker: true }
    });

    worker.on('message', (result) => {
      this.handleWorkerMessage(worker, result);
    });

    worker.on('error', (error) => {
      this.handleWorkerError(worker, error);
    });

    worker.on('exit', (code) => {
      this.handleWorkerExit(worker, code);
    });

    this.workers.push(worker);
    this.availableWorkers.push(worker);

    return worker;
  }

  private handleWorkerMessage(worker: Worker, result: any): void {
    const { taskId, success, data, error } = result;
    const task = this.tasks.get(taskId);

    if (!task) return;

    this.busyWorkers.delete(worker);
    this.availableWorkers.push(worker);

    if (success) {
      task.result = data;
      task.completedAt = new Date();
      this.emit('taskCompleted', task);
    } else {
      this.handleTaskError(task, error);
    }

    this.processNextTask();
  }

  private handleWorkerError(worker: Worker, error: Error): void {
    console.error('Worker error:', error);
    this.restartWorker(worker);
  }

  private handleWorkerExit(worker: Worker, code: number): void {
    if (code !== 0 && !this.isShuttingDown) {
      console.error(`Worker exited with code ${code}`);
      this.restartWorker(worker);
    }
  }

  private restartWorker(failedWorker: Worker): void {
    // Remove failed worker
    this.workers = this.workers.filter(w => w !== failedWorker);
    this.availableWorkers = this.availableWorkers.filter(w => w !== failedWorker);
    this.busyWorkers.delete(failedWorker);

    // Create new worker
    this.createWorker();
  }

  private startQueueProcessor(): void {
    setInterval(() => {
      this.processQueue();
    }, 100);
  }

  private processQueue(): void {
    while (this.taskQueue.length > 0 && this.availableWorkers.length > 0) {
      this.processNextTask();
    }
  }

  private processNextTask(): void {
    if (this.taskQueue.length === 0 || this.availableWorkers.length === 0) {
      return;
    }

    // Sort by priority and creation time
    this.taskQueue.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    const task = this.taskQueue.shift()!;
    const worker = this.availableWorkers.shift()!;

    this.busyWorkers.add(worker);
    task.startedAt = new Date();

    worker.postMessage({
      taskId: task.id,
      type: task.type,
      data: task.data,
      timeout: task.timeout
    });

    // Set timeout for the task
    setTimeout(() => {
      if (this.busyWorkers.has(worker)) {
        this.handleTaskTimeout(task, worker);
      }
    }, task.timeout);
  }

  private handleTaskTimeout(task: AsyncTask, worker: Worker): void {
    console.warn(`Task ${task.id} timed out`);
    
    // Terminate the worker and restart it
    worker.terminate();
    this.restartWorker(worker);

    // Retry the task if retries are available
    if (task.retryCount < task.maxRetries) {
      this.retryTask(task, 'Task timeout');
    } else {
      task.error = 'Task timeout - maximum retries exceeded';
      this.emit('taskFailed', task);
    }
  }

  private handleTaskError(task: AsyncTask, error: string): void {
    if (task.retryCount < task.maxRetries) {
      this.retryTask(task, error);
    } else {
      task.error = error;
      task.completedAt = new Date();
      this.emit('taskFailed', task);
    }
  }

  private retryTask(task: AsyncTask, error: string): void {
    task.retryCount++;
    console.log(`Retrying task ${task.id} (attempt ${task.retryCount}/${task.maxRetries})`);

    // Add delay before retry
    setTimeout(() => {
      this.taskQueue.push(task);
    }, this.config.retryDelay * task.retryCount);

    this.emit('taskRetry', { task, error });
  }

  registerTaskHandler(type: string, handler: TaskHandler): void {
    this.taskHandlers.set(type, handler);
  }

  async addTask(
    type: string, 
    data: any, 
    options: {
      priority?: 'low' | 'medium' | 'high' | 'critical';
      timeout?: number;
      maxRetries?: number;
    } = {}
  ): Promise<string> {
    const task: AsyncTask = {
      id: this.generateTaskId(),
      type,
      data,
      priority: options.priority || 'medium',
      retryCount: 0,
      maxRetries: options.maxRetries || 3,
      timeout: options.timeout || this.config.taskTimeout,
      createdAt: new Date()
    };

    if (this.taskQueue.length >= this.config.maxQueueSize) {
      throw new Error('Task queue is full');
    }

    this.tasks.set(task.id, task);
    this.taskQueue.push(task);
    this.emit('taskAdded', task);

    return task.id;
  }

  async waitForTask(taskId: string): Promise<any> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    if (task.completedAt) {
      if (task.error) {
        throw new Error(task.error);
      }
      return task.result;
    }

    return new Promise((resolve, reject) => {
      const onComplete = (completedTask: AsyncTask) => {
        if (completedTask.id === taskId) {
          this.removeListener('taskCompleted', onComplete);
          this.removeListener('taskFailed', onFailed);
          resolve(completedTask.result);
        }
      };

      const onFailed = (failedTask: AsyncTask) => {
        if (failedTask.id === taskId) {
          this.removeListener('taskCompleted', onComplete);
          this.removeListener('taskFailed', onFailed);
          reject(new Error(failedTask.error));
        }
      };

      this.on('taskCompleted', onComplete);
      this.on('taskFailed', onFailed);
    });
  }

  getTaskStatus(taskId: string): AsyncTask | undefined {
    return this.tasks.get(taskId);
  }

  getQueueStats(): {
    queueLength: number;
    activeWorkers: number;
    availableWorkers: number;
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
  } {
    const completedTasks = Array.from(this.tasks.values()).filter(t => t.completedAt && !t.error).length;
    const failedTasks = Array.from(this.tasks.values()).filter(t => t.error).length;

    return {
      queueLength: this.taskQueue.length,
      activeWorkers: this.busyWorkers.size,
      availableWorkers: this.availableWorkers.length,
      totalTasks: this.tasks.size,
      completedTasks,
      failedTasks
    };
  }

  async processTaskInline(type: string, data: any): Promise<any> {
    const handler = this.taskHandlers.get(type);
    if (!handler) {
      throw new Error(`No handler registered for task type: ${type}`);
    }

    try {
      return await handler(data);
    } catch (error) {
      throw new Error(`Task processing failed: ${error}`);
    }
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    
    console.log('Shutting down async processing manager...');
    
    // Wait for current tasks to complete (with timeout)
    const shutdownTimeout = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.busyWorkers.size > 0 && (Date.now() - startTime) < shutdownTimeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Terminate all workers
    await Promise.all(this.workers.map(worker => worker.terminate()));
    
    console.log('Async processing manager shut down complete');
  }
}

// Worker thread code
if (!isMainThread && workerData?.isWorker) {
  parentPort?.on('message', async (message) => {
    const { taskId, type, data, timeout } = message;
    
    try {
      // Simulate task processing based on type
      let result;
      
      switch (type) {
        case 'data-processing':
          result = await processData(data);
          break;
        case 'file-processing':
          result = await processFile(data);
          break;
        case 'api-call':
          result = await makeApiCall(data);
          break;
        default:
          throw new Error(`Unknown task type: ${type}`);
      }

      parentPort?.postMessage({
        taskId,
        success: true,
        data: result
      });
    } catch (error) {
      parentPort?.postMessage({
        taskId,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  async function processData(data: any): Promise<any> {
    // Simulate data processing
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
    return { processed: true, result: data };
  }

  async function processFile(data: any): Promise<any> {
    // Simulate file processing
    await new Promise(resolve => setTimeout(resolve, Math.random() * 2000));
    return { processed: true, fileSize: data.size };
  }

  async function makeApiCall(data: any): Promise<any> {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1500));
    return { status: 'success', response: data };
  }
}
