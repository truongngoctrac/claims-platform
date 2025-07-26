/**
 * Graceful Shutdown Manager
 * Healthcare Claims Processing - Graceful Service Shutdown
 */

interface ShutdownHook {
  name: string;
  priority: number;
  handler: () => Promise<void>;
  timeout: number;
}

export class GracefulShutdownManager {
  private shutdownHooks: ShutdownHook[] = [];
  private isShuttingDown: boolean = false;
  private shutdownTimeout: number = 30000; // 30 seconds

  async initialize(): Promise<void> {
    console.log('🔄 Initializing Graceful Shutdown Manager');
    
    this.setupShutdownHooks();
    this.registerSignalHandlers();
    
    console.log('✅ Graceful Shutdown Manager initialized');
  }

  private setupShutdownHooks(): void {
    // Register default shutdown hooks
    this.addShutdownHook('stop-accepting-requests', 1, async () => {
      console.log('🛑 Stopping acceptance of new requests');
    }, 5000);

    this.addShutdownHook('drain-connections', 2, async () => {
      console.log('⏳ Draining existing connections');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }, 15000);

    this.addShutdownHook('cleanup-resources', 3, async () => {
      console.log('🧹 Cleaning up resources');
    }, 5000);
  }

  private registerSignalHandlers(): void {
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    process.on('SIGHUP', () => this.shutdown('SIGHUP'));
  }

  addShutdownHook(name: string, priority: number, handler: () => Promise<void>, timeout: number = 10000): void {
    this.shutdownHooks.push({ name, priority, handler, timeout });
    this.shutdownHooks.sort((a, b) => a.priority - b.priority);
  }

  async shutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      console.log('⚠️ Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    console.log(`🛑 Graceful shutdown initiated by ${signal}`);

    const shutdownPromise = this.executeShutdownHooks();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Shutdown timeout')), this.shutdownTimeout)
    );

    try {
      await Promise.race([shutdownPromise, timeoutPromise]);
      console.log('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('❌ Graceful shutdown failed:', error);
      process.exit(1);
    }
  }

  private async executeShutdownHooks(): Promise<void> {
    for (const hook of this.shutdownHooks) {
      try {
        console.log(`🔄 Executing shutdown hook: ${hook.name}`);
        
        const hookPromise = hook.handler();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Hook ${hook.name} timeout`)), hook.timeout)
        );

        await Promise.race([hookPromise, timeoutPromise]);
        console.log(`✅ Completed shutdown hook: ${hook.name}`);
      } catch (error) {
        console.error(`❌ Shutdown hook ${hook.name} failed:`, error);
      }
    }
  }

  async getStatus(): Promise<any> {
    return {
      isShuttingDown: this.isShuttingDown,
      shutdownTimeout: this.shutdownTimeout,
      hooks: this.shutdownHooks.map(h => ({ name: h.name, priority: h.priority, timeout: h.timeout }))
    };
  }

  async isHealthy(): Promise<boolean> {
    return !this.isShuttingDown;
  }
}
