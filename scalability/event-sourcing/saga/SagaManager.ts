import {
  SagaDefinition,
  SagaInstance,
  SagaStep,
  SagaStatus,
  Command,
  DomainEvent
} from '../types';
import { EventEmitter } from 'events';
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';

export interface SagaOrchestrator {
  startSaga(sagaType: string, data: Record<string, any>, correlationId: string): Promise<string>;
  handleEvent(event: DomainEvent): Promise<void>;
  handleCommand(command: Command): Promise<void>;
  compensateSaga(sagaId: string): Promise<void>;
  getSagaStatus(sagaId: string): Promise<SagaInstance | null>;
  getAllActiveSagas(): Promise<SagaInstance[]>;
}

export class SagaManager extends EventEmitter implements SagaOrchestrator {
  private readonly logger = pino({ name: 'SagaManager' });
  private readonly sagaDefinitions = new Map<string, SagaDefinition>();
  private readonly activeSagas = new Map<string, SagaInstance>();
  private readonly sagaRepository: SagaRepository;
  private readonly commandSender: CommandSender;
  private readonly timeoutManager: SagaTimeoutManager;

  constructor(
    sagaRepository: SagaRepository,
    commandSender: CommandSender,
    timeoutManager: SagaTimeoutManager
  ) {
    super();
    this.sagaRepository = sagaRepository;
    this.commandSender = commandSender;
    this.timeoutManager = timeoutManager;
  }

  public registerSaga(definition: SagaDefinition): void {
    this.sagaDefinitions.set(definition.name, definition);
    this.logger.info('Saga definition registered', { sagaName: definition.name });
  }

  public async startSaga(
    sagaType: string,
    data: Record<string, any>,
    correlationId: string
  ): Promise<string> {
    const definition = this.sagaDefinitions.get(sagaType);
    if (!definition) {
      throw new SagaError(`Saga definition not found: ${sagaType}`);
    }

    const sagaId = uuidv4();
    const sagaInstance: SagaInstance = {
      id: sagaId,
      sagaType,
      version: definition.version,
      status: SagaStatus.STARTED,
      currentStep: definition.steps[0]?.id || '',
      data,
      startedAt: new Date(),
      updatedAt: new Date(),
      correlationId
    };

    try {
      await this.sagaRepository.save(sagaInstance);
      this.activeSagas.set(sagaId, sagaInstance);

      // Set timeout if configured
      if (definition.timeout) {
        this.timeoutManager.scheduleTimeout(sagaId, definition.timeout);
      }

      // Start executing first step
      await this.executeNextStep(sagaInstance);

      this.emit('saga-started', sagaInstance);
      this.logger.info('Saga started', { sagaId, sagaType, correlationId });

      return sagaId;
    } catch (error) {
      this.logger.error('Failed to start saga', { sagaType, correlationId, error });
      throw error;
    }
  }

  public async handleEvent(event: DomainEvent): Promise<void> {
    const correlationId = event.correlationId;
    if (!correlationId) {
      return; // No correlation ID, not relevant for sagas
    }

    const relevantSagas = await this.findSagasByCorrelationId(correlationId);
    
    for (const saga of relevantSagas) {
      if (saga.status === SagaStatus.RUNNING || saga.status === SagaStatus.STARTED) {
        await this.processSagaEvent(saga, event);
      }
    }
  }

  public async handleCommand(command: Command): Promise<void> {
    // Handle command responses or failures
    const sagaId = this.findSagaByCommand(command);
    if (!sagaId) {
      return;
    }

    const saga = await this.getSagaInstance(sagaId);
    if (!saga) {
      return;
    }

    await this.processCommandResult(saga, command);
  }

  public async compensateSaga(sagaId: string): Promise<void> {
    const saga = await this.getSagaInstance(sagaId);
    if (!saga) {
      throw new SagaError(`Saga not found: ${sagaId}`);
    }

    if (saga.status !== SagaStatus.FAILED && saga.status !== SagaStatus.RUNNING) {
      throw new SagaError(`Cannot compensate saga in status: ${saga.status}`);
    }

    saga.status = SagaStatus.COMPENSATING;
    saga.updatedAt = new Date();

    await this.sagaRepository.save(saga);
    await this.executeCompensation(saga);

    this.emit('saga-compensating', saga);
    this.logger.info('Saga compensation started', { sagaId });
  }

  public async getSagaStatus(sagaId: string): Promise<SagaInstance | null> {
    return this.sagaRepository.findById(sagaId);
  }

  public async getAllActiveSagas(): Promise<SagaInstance[]> {
    return this.sagaRepository.findByStatus([
      SagaStatus.STARTED,
      SagaStatus.RUNNING,
      SagaStatus.COMPENSATING
    ]);
  }

  private async executeNextStep(saga: SagaInstance): Promise<void> {
    const definition = this.sagaDefinitions.get(saga.sagaType)!;
    const currentStep = definition.steps.find(step => step.id === saga.currentStep);
    
    if (!currentStep) {
      // No more steps, complete saga
      await this.completeSaga(saga);
      return;
    }

    try {
      saga.status = SagaStatus.RUNNING;
      saga.updatedAt = new Date();
      await this.sagaRepository.save(saga);

      // Check step condition if present
      if (currentStep.condition && !this.evaluateCondition(currentStep.condition, saga.data)) {
        await this.moveToNextStep(saga, currentStep.onSuccess);
        return;
      }

      // Execute the command
      const command = this.prepareCommand(currentStep.command, saga);
      await this.commandSender.send(command);

      // Set step timeout if configured
      if (currentStep.timeout) {
        this.timeoutManager.scheduleStepTimeout(saga.id, currentStep.id, currentStep.timeout);
      }

      this.emit('saga-step-executed', saga, currentStep);
      this.logger.debug('Saga step executed', { 
        sagaId: saga.id, 
        stepId: currentStep.id,
        commandType: command.commandType
      });

    } catch (error) {
      this.logger.error('Failed to execute saga step', { 
        sagaId: saga.id, 
        stepId: currentStep.id, 
        error 
      });
      await this.handleStepFailure(saga, currentStep, error);
    }
  }

  private async processSagaEvent(saga: SagaInstance, event: DomainEvent): Promise<void> {
    const definition = this.sagaDefinitions.get(saga.sagaType)!;
    const currentStep = definition.steps.find(step => step.id === saga.currentStep);
    
    if (!currentStep) {
      return;
    }

    // Update saga data with event information
    saga.data = { ...saga.data, ...this.extractEventData(event) };
    saga.updatedAt = new Date();

    // Determine next action based on event
    if (this.isSuccessEvent(event, currentStep)) {
      await this.moveToNextStep(saga, currentStep.onSuccess);
    } else if (this.isFailureEvent(event, currentStep)) {
      await this.handleStepFailure(saga, currentStep, new Error(`Step failed: ${event.eventType}`));
    }
  }

  private async processCommandResult(saga: SagaInstance, command: Command): Promise<void> {
    // Implementation would handle command success/failure responses
    const definition = this.sagaDefinitions.get(saga.sagaType)!;
    const currentStep = definition.steps.find(step => step.id === saga.currentStep);
    
    if (!currentStep) {
      return;
    }

    // Update saga with command result
    saga.data = { ...saga.data, lastCommandResult: command };
    saga.updatedAt = new Date();

    await this.moveToNextStep(saga, currentStep.onSuccess);
  }

  private async moveToNextStep(saga: SagaInstance, transition?: any): Promise<void> {
    if (!transition) {
      await this.completeSaga(saga);
      return;
    }

    if (transition.endSaga) {
      await this.completeSaga(saga);
      return;
    }

    if (transition.compensate) {
      await this.compensateSaga(saga.id);
      return;
    }

    if (transition.nextStep) {
      saga.currentStep = transition.nextStep;
      saga.updatedAt = new Date();
      await this.sagaRepository.save(saga);
      await this.executeNextStep(saga);
    }
  }

  private async handleStepFailure(saga: SagaInstance, step: SagaStep, error: Error): Promise<void> {
    this.logger.error('Saga step failed', { 
      sagaId: saga.id, 
      stepId: step.id, 
      error: error.message 
    });

    // Check if retry is configured
    if (step.retryPolicy && this.shouldRetry(saga, step)) {
      await this.retryStep(saga, step);
      return;
    }

    // Handle failure transition
    if (step.onFailure) {
      await this.moveToNextStep(saga, step.onFailure);
    } else {
      // No failure handling defined, mark saga as failed
      saga.status = SagaStatus.FAILED;
      saga.updatedAt = new Date();
      await this.sagaRepository.save(saga);
      
      this.emit('saga-failed', saga, error);
    }
  }

  private async retryStep(saga: SagaInstance, step: SagaStep): Promise<void> {
    const retryCount = (saga.data.retryCount || 0) + 1;
    saga.data.retryCount = retryCount;
    
    const delay = this.calculateRetryDelay(step.retryPolicy!, retryCount);
    
    this.logger.info('Retrying saga step', { 
      sagaId: saga.id, 
      stepId: step.id, 
      retryCount, 
      delay 
    });

    setTimeout(() => {
      this.executeNextStep(saga).catch(error => {
        this.logger.error('Retry failed', { sagaId: saga.id, stepId: step.id, error });
      });
    }, delay);
  }

  private async executeCompensation(saga: SagaInstance): Promise<void> {
    const definition = this.sagaDefinitions.get(saga.sagaType)!;
    const executedSteps = this.getExecutedSteps(saga, definition);

    if (definition.compensationStrategy === 'reverse-order') {
      // Execute compensation in reverse order
      for (let i = executedSteps.length - 1; i >= 0; i--) {
        await this.executeCompensationStep(saga, executedSteps[i]);
      }
    } else if (definition.compensationStrategy === 'parallel') {
      // Execute all compensations in parallel
      await Promise.all(
        executedSteps.map(step => this.executeCompensationStep(saga, step))
      );
    }

    saga.status = SagaStatus.COMPENSATED;
    saga.compensatedAt = new Date();
    saga.updatedAt = new Date();
    await this.sagaRepository.save(saga);

    this.emit('saga-compensated', saga);
    this.logger.info('Saga compensation completed', { sagaId: saga.id });
  }

  private async executeCompensationStep(saga: SagaInstance, step: SagaStep): Promise<void> {
    if (!step.compensation) {
      return; // No compensation defined for this step
    }

    try {
      const compensationCommand = this.prepareCommand(step.compensation, saga);
      await this.commandSender.send(compensationCommand);
      
      this.logger.debug('Compensation step executed', { 
        sagaId: saga.id, 
        stepId: step.id 
      });
    } catch (error) {
      this.logger.error('Compensation step failed', { 
        sagaId: saga.id, 
        stepId: step.id, 
        error 
      });
      // Continue with other compensations even if one fails
    }
  }

  private async completeSaga(saga: SagaInstance): Promise<void> {
    saga.status = SagaStatus.COMPLETED;
    saga.completedAt = new Date();
    saga.updatedAt = new Date();
    
    await this.sagaRepository.save(saga);
    this.activeSagas.delete(saga.id);
    this.timeoutManager.clearTimeout(saga.id);

    this.emit('saga-completed', saga);
    this.logger.info('Saga completed', { sagaId: saga.id });
  }

  private async getSagaInstance(sagaId: string): Promise<SagaInstance | null> {
    let saga = this.activeSagas.get(sagaId);
    if (!saga) {
      saga = await this.sagaRepository.findById(sagaId);
      if (saga) {
        this.activeSagas.set(sagaId, saga);
      }
    }
    return saga;
  }

  private async findSagasByCorrelationId(correlationId: string): Promise<SagaInstance[]> {
    return this.sagaRepository.findByCorrelationId(correlationId);
  }

  private findSagaByCommand(command: Command): string | null {
    // Implementation would map commands back to sagas
    return command.metadata.causationId || null;
  }

  private prepareCommand(commandTemplate: Command, saga: SagaInstance): Command {
    return {
      ...commandTemplate,
      id: uuidv4(),
      metadata: {
        ...commandTemplate.metadata,
        correlationId: saga.correlationId,
        causationId: saga.id
      },
      timestamp: new Date()
    };
  }

  private evaluateCondition(condition: string, data: Record<string, any>): boolean {
    // Simple condition evaluation - in production use a proper expression engine
    try {
      return new Function('data', `return ${condition}`)(data);
    } catch {
      return false;
    }
  }

  private extractEventData(event: DomainEvent): Record<string, any> {
    return {
      lastEvent: {
        type: event.eventType,
        data: event.eventData,
        timestamp: event.timestamp
      }
    };
  }

  private isSuccessEvent(event: DomainEvent, step: SagaStep): boolean {
    // Implementation would check if event indicates step success
    return event.eventType.includes('Completed') || event.eventType.includes('Success');
  }

  private isFailureEvent(event: DomainEvent, step: SagaStep): boolean {
    // Implementation would check if event indicates step failure
    return event.eventType.includes('Failed') || event.eventType.includes('Error');
  }

  private shouldRetry(saga: SagaInstance, step: SagaStep): boolean {
    if (!step.retryPolicy) {
      return false;
    }

    const retryCount = saga.data.retryCount || 0;
    return retryCount < step.retryPolicy.maxAttempts;
  }

  private calculateRetryDelay(retryPolicy: any, retryCount: number): number {
    const baseDelay = retryPolicy.initialDelay || 1000;
    
    switch (retryPolicy.backoffStrategy) {
      case 'exponential':
        return Math.min(baseDelay * Math.pow(2, retryCount - 1), retryPolicy.maxDelay || 30000);
      case 'linear':
        return Math.min(baseDelay * retryCount, retryPolicy.maxDelay || 30000);
      default:
        return baseDelay;
    }
  }

  private getExecutedSteps(saga: SagaInstance, definition: SagaDefinition): SagaStep[] {
    const currentStepIndex = definition.steps.findIndex(step => step.id === saga.currentStep);
    return definition.steps.slice(0, currentStepIndex);
  }
}

// Supporting interfaces and classes

export interface SagaRepository {
  save(saga: SagaInstance): Promise<void>;
  findById(sagaId: string): Promise<SagaInstance | null>;
  findByCorrelationId(correlationId: string): Promise<SagaInstance[]>;
  findByStatus(statuses: SagaStatus[]): Promise<SagaInstance[]>;
  delete(sagaId: string): Promise<void>;
}

export interface CommandSender {
  send(command: Command): Promise<void>;
}

export interface SagaTimeoutManager {
  scheduleTimeout(sagaId: string, timeoutMs: number): void;
  scheduleStepTimeout(sagaId: string, stepId: string, timeoutMs: number): void;
  clearTimeout(sagaId: string): void;
}

export class SagaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SagaError';
  }
}

// Example implementations

export class InMemorySagaRepository implements SagaRepository {
  private readonly sagas = new Map<string, SagaInstance>();

  public async save(saga: SagaInstance): Promise<void> {
    this.sagas.set(saga.id, { ...saga });
  }

  public async findById(sagaId: string): Promise<SagaInstance | null> {
    return this.sagas.get(sagaId) || null;
  }

  public async findByCorrelationId(correlationId: string): Promise<SagaInstance[]> {
    return Array.from(this.sagas.values())
      .filter(saga => saga.correlationId === correlationId);
  }

  public async findByStatus(statuses: SagaStatus[]): Promise<SagaInstance[]> {
    return Array.from(this.sagas.values())
      .filter(saga => statuses.includes(saga.status));
  }

  public async delete(sagaId: string): Promise<void> {
    this.sagas.delete(sagaId);
  }
}

export class SimpleSagaTimeoutManager implements SagaTimeoutManager {
  private readonly timeouts = new Map<string, NodeJS.Timeout>();
  private readonly logger = pino({ name: 'SimpleSagaTimeoutManager' });

  constructor(private readonly sagaManager: SagaManager) {}

  public scheduleTimeout(sagaId: string, timeoutMs: number): void {
    this.clearTimeout(sagaId);
    
    const timeout = setTimeout(() => {
      this.logger.warn('Saga timeout', { sagaId, timeoutMs });
      this.sagaManager.compensateSaga(sagaId).catch(error => {
        this.logger.error('Failed to compensate timed out saga', { sagaId, error });
      });
    }, timeoutMs);

    this.timeouts.set(sagaId, timeout);
  }

  public scheduleStepTimeout(sagaId: string, stepId: string, timeoutMs: number): void {
    const timeoutKey = `${sagaId}-${stepId}`;
    const existingTimeout = this.timeouts.get(timeoutKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(() => {
      this.logger.warn('Saga step timeout', { sagaId, stepId, timeoutMs });
      // Handle step timeout - could retry or move to failure handling
    }, timeoutMs);

    this.timeouts.set(timeoutKey, timeout);
  }

  public clearTimeout(sagaId: string): void {
    // Clear saga timeout
    const sagaTimeout = this.timeouts.get(sagaId);
    if (sagaTimeout) {
      clearTimeout(sagaTimeout);
      this.timeouts.delete(sagaId);
    }

    // Clear all step timeouts for this saga
    const stepTimeoutKeys = Array.from(this.timeouts.keys())
      .filter(key => key.startsWith(`${sagaId}-`));
    
    stepTimeoutKeys.forEach(key => {
      const timeout = this.timeouts.get(key);
      if (timeout) {
        clearTimeout(timeout);
        this.timeouts.delete(key);
      }
    });
  }
}
