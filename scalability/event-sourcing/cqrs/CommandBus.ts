import { Command, CommandMetadata } from '../types';
import { EventEmitter } from 'events';
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';

export interface CommandHandler<T extends Command> {
  handle(command: T): Promise<any>;
  canHandle(command: Command): boolean;
  getCommandType(): string;
}

export interface CommandBus {
  send<T extends Command>(command: T): Promise<any>;
  register<T extends Command>(handler: CommandHandler<T>): void;
  unregister(commandType: string): void;
}

export interface CommandMiddleware {
  execute<T extends Command>(command: T, next: (command: T) => Promise<any>): Promise<any>;
}

export class InMemoryCommandBus extends EventEmitter implements CommandBus {
  private readonly logger = pino({ name: 'InMemoryCommandBus' });
  private readonly handlers = new Map<string, CommandHandler<any>>();
  private readonly middlewares: CommandMiddleware[] = [];
  private readonly metrics = {
    commandsProcessed: 0,
    commandsFailed: 0,
    averageProcessingTime: 0,
    commandCounts: new Map<string, number>()
  };

  public async send<T extends Command>(command: T): Promise<any> {
    const startTime = Date.now();
    
    try {
      this.validateCommand(command);
      
      // Find handler
      const handler = this.handlers.get(command.commandType);
      if (!handler) {
        throw new CommandHandlerNotFoundError(command.commandType);
      }

      // Emit before processing
      this.emit('command-received', command);

      // Execute through middleware chain
      const result = await this.executeWithMiddleware(command, handler);

      // Update metrics
      const processingTime = Date.now() - startTime;
      this.updateMetrics(command, processingTime, true);

      // Emit after processing
      this.emit('command-processed', command, result);

      this.logger.debug('Command processed successfully', {
        commandId: command.id,
        commandType: command.commandType,
        processingTime
      });

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateMetrics(command, processingTime, false);

      this.emit('command-failed', command, error);
      
      this.logger.error('Command processing failed', {
        commandId: command.id,
        commandType: command.commandType,
        error: error.message,
        processingTime
      });

      throw error;
    }
  }

  public register<T extends Command>(handler: CommandHandler<T>): void {
    const commandType = handler.getCommandType();
    
    if (this.handlers.has(commandType)) {
      throw new Error(`Handler already registered for command type: ${commandType}`);
    }

    this.handlers.set(commandType, handler);
    
    this.logger.info('Command handler registered', { commandType });
  }

  public unregister(commandType: string): void {
    if (this.handlers.delete(commandType)) {
      this.logger.info('Command handler unregistered', { commandType });
    }
  }

  public addMiddleware(middleware: CommandMiddleware): void {
    this.middlewares.push(middleware);
    this.logger.info('Command middleware added', { 
      middlewareName: middleware.constructor.name 
    });
  }

  public getMetrics(): any {
    return {
      ...this.metrics,
      commandCounts: Object.fromEntries(this.metrics.commandCounts)
    };
  }

  public clearMetrics(): void {
    this.metrics.commandsProcessed = 0;
    this.metrics.commandsFailed = 0;
    this.metrics.averageProcessingTime = 0;
    this.metrics.commandCounts.clear();
  }

  private async executeWithMiddleware<T extends Command>(
    command: T, 
    handler: CommandHandler<T>
  ): Promise<any> {
    let index = 0;

    const next = async (cmd: T): Promise<any> => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++];
        return middleware.execute(cmd, next);
      } else {
        return handler.handle(cmd);
      }
    };

    return next(command);
  }

  private validateCommand(command: Command): void {
    if (!command.id) {
      throw new InvalidCommandError('Command must have an id');
    }

    if (!command.commandType) {
      throw new InvalidCommandError('Command must have a commandType');
    }

    if (!command.aggregateId) {
      throw new InvalidCommandError('Command must have an aggregateId');
    }

    if (!command.metadata) {
      throw new InvalidCommandError('Command must have metadata');
    }

    if (!command.metadata.correlationId) {
      throw new InvalidCommandError('Command metadata must have correlationId');
    }
  }

  private updateMetrics(command: Command, processingTime: number, success: boolean): void {
    this.metrics.commandsProcessed++;
    
    if (!success) {
      this.metrics.commandsFailed++;
    }

    // Update average processing time
    const totalTime = this.metrics.averageProcessingTime * (this.metrics.commandsProcessed - 1);
    this.metrics.averageProcessingTime = (totalTime + processingTime) / this.metrics.commandsProcessed;

    // Update command type counts
    const currentCount = this.metrics.commandCounts.get(command.commandType) || 0;
    this.metrics.commandCounts.set(command.commandType, currentCount + 1);
  }
}

export abstract class BaseCommandHandler<T extends Command> implements CommandHandler<T> {
  protected readonly logger = pino({ name: this.constructor.name });

  public abstract handle(command: T): Promise<any>;
  public abstract getCommandType(): string;

  public canHandle(command: Command): boolean {
    return command.commandType === this.getCommandType();
  }

  protected validateCommand(command: T): void {
    // Override in derived classes for specific validation
  }

  protected generateCorrelationId(): string {
    return uuidv4();
  }

  protected createCommandMetadata(
    userId?: string,
    sessionId?: string,
    source: string = 'system'
  ): CommandMetadata {
    return {
      correlationId: this.generateCorrelationId(),
      source,
      userId,
      sessionId
    };
  }
}

// Command Middleware Implementations

export class LoggingCommandMiddleware implements CommandMiddleware {
  private readonly logger = pino({ name: 'LoggingCommandMiddleware' });

  public async execute<T extends Command>(
    command: T, 
    next: (command: T) => Promise<any>
  ): Promise<any> {
    this.logger.info('Executing command', {
      commandId: command.id,
      commandType: command.commandType,
      aggregateId: command.aggregateId,
      correlationId: command.metadata.correlationId
    });

    const startTime = Date.now();
    
    try {
      const result = await next(command);
      const duration = Date.now() - startTime;
      
      this.logger.info('Command executed successfully', {
        commandId: command.id,
        commandType: command.commandType,
        duration
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error('Command execution failed', {
        commandId: command.id,
        commandType: command.commandType,
        error: error.message,
        duration
      });

      throw error;
    }
  }
}

export class ValidationCommandMiddleware implements CommandMiddleware {
  private readonly logger = pino({ name: 'ValidationCommandMiddleware' });

  public async execute<T extends Command>(
    command: T, 
    next: (command: T) => Promise<any>
  ): Promise<any> {
    this.validateCommand(command);
    return next(command);
  }

  private validateCommand(command: Command): void {
    const errors: string[] = [];

    if (!command.id || command.id.trim() === '') {
      errors.push('Command ID is required');
    }

    if (!command.commandType || command.commandType.trim() === '') {
      errors.push('Command type is required');
    }

    if (!command.aggregateId || command.aggregateId.trim() === '') {
      errors.push('Aggregate ID is required');
    }

    if (!command.metadata) {
      errors.push('Command metadata is required');
    } else {
      if (!command.metadata.correlationId) {
        errors.push('Correlation ID is required in metadata');
      }
      if (!command.metadata.source) {
        errors.push('Source is required in metadata');
      }
    }

    if (errors.length > 0) {
      throw new InvalidCommandError(`Command validation failed: ${errors.join(', ')}`);
    }
  }
}

export class RetryCommandMiddleware implements CommandMiddleware {
  private readonly logger = pino({ name: 'RetryCommandMiddleware' });

  constructor(
    private readonly maxRetries: number = 3,
    private readonly baseDelay: number = 1000
  ) {}

  public async execute<T extends Command>(
    command: T, 
    next: (command: T) => Promise<any>
  ): Promise<any> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = this.calculateDelay(attempt);
          this.logger.info('Retrying command', {
            commandId: command.id,
            attempt,
            delay
          });
          await this.sleep(delay);
        }

        return await next(command);
      } catch (error) {
        lastError = error;
        
        if (attempt < this.maxRetries && this.isRetryableError(error)) {
          this.logger.warn('Command failed, will retry', {
            commandId: command.id,
            attempt,
            error: error.message
          });
          continue;
        }

        this.logger.error('Command failed permanently', {
          commandId: command.id,
          totalAttempts: attempt + 1,
          error: error.message
        });
        break;
      }
    }

    throw lastError;
  }

  private calculateDelay(attempt: number): number {
    return this.baseDelay * Math.pow(2, attempt - 1);
  }

  private isRetryableError(error: Error): boolean {
    // Add logic to determine if error is retryable
    return !error.message.includes('validation') && 
           !error.message.includes('not found');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Command Error Classes

export class CommandHandlerNotFoundError extends Error {
  constructor(commandType: string) {
    super(`No handler found for command type: ${commandType}`);
    this.name = 'CommandHandlerNotFoundError';
  }
}

export class InvalidCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCommandError';
  }
}

export class CommandTimeoutError extends Error {
  constructor(commandId: string, timeout: number) {
    super(`Command ${commandId} timed out after ${timeout}ms`);
    this.name = 'CommandTimeoutError';
  }
}

// Command Factory

export class CommandFactory {
  public static createCommand<T extends Command>(
    commandType: string,
    aggregateId: string,
    payload: Record<string, any>,
    metadata: Partial<CommandMetadata> = {}
  ): T {
    return {
      id: uuidv4(),
      aggregateId,
      commandType,
      payload,
      metadata: {
        correlationId: uuidv4(),
        source: 'application',
        ...metadata
      },
      timestamp: new Date()
    } as T;
  }
}
