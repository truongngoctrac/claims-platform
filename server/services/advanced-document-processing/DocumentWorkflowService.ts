import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

export interface DocumentWorkflow {
  id: string;
  name: string;
  description: string;
  documentTypes: string[];
  steps: WorkflowStep[];
  triggers: WorkflowTrigger[];
  conditions: WorkflowCondition[];
  status: 'active' | 'inactive' | 'draft';
  version: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, any>;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: WorkflowStepType;
  order: number;
  configuration: StepConfiguration;
  timeout?: number;
  retryPolicy?: RetryPolicy;
  errorHandling?: ErrorHandling;
  dependencies: string[];
  outputs: StepOutput[];
}

export type WorkflowStepType = 
  | 'validation'
  | 'approval'
  | 'notification'
  | 'data_extraction'
  | 'classification'
  | 'routing'
  | 'archival'
  | 'integration'
  | 'processing'
  | 'custom_script';

export interface StepConfiguration {
  [key: string]: any;
  assignee?: string;
  approvers?: string[];
  recipients?: string[];
  template?: string;
  criteria?: ValidationCriteria[];
  script?: string;
  endpoint?: string;
  timeout?: number;
}

export interface WorkflowTrigger {
  id: string;
  type: TriggerType;
  event: string;
  conditions: TriggerCondition[];
  active: boolean;
}

export type TriggerType = 
  | 'document_upload'
  | 'document_update'
  | 'status_change'
  | 'time_based'
  | 'user_action'
  | 'external_event';

export interface TriggerCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in';
  value: any;
}

export interface WorkflowCondition {
  id: string;
  name: string;
  expression: string;
  type: 'if' | 'while' | 'unless';
}

export interface ValidationCriteria {
  field: string;
  required: boolean;
  type: 'text' | 'number' | 'date' | 'email' | 'phone' | 'currency';
  pattern?: string;
  minValue?: number;
  maxValue?: number;
  allowedValues?: string[];
}

export interface RetryPolicy {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier: number;
  maxDelay: number;
}

export interface ErrorHandling {
  strategy: 'stop' | 'skip' | 'retry' | 'escalate';
  fallbackStep?: string;
  escalationUsers?: string[];
  notifyOnError: boolean;
}

export interface StepOutput {
  name: string;
  type: string;
  description: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  documentId: string;
  status: ExecutionStatus;
  currentStep?: string;
  startedAt: Date;
  completedAt?: Date;
  startedBy: string;
  context: ExecutionContext;
  stepExecutions: StepExecution[];
  errors: ExecutionError[];
  metadata: Record<string, any>;
}

export type ExecutionStatus = 
  | 'pending'
  | 'running'
  | 'waiting_approval'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ExecutionContext {
  variables: Record<string, any>;
  documentData: any;
  userInputs: Record<string, any>;
  systemContext: Record<string, any>;
}

export interface StepExecution {
  id: string;
  stepId: string;
  stepName: string;
  status: StepExecutionStatus;
  startedAt: Date;
  completedAt?: Date;
  assignedTo?: string;
  result?: any;
  error?: string;
  retryCount: number;
  duration?: number;
  outputs: Record<string, any>;
}

export type StepExecutionStatus = 
  | 'pending'
  | 'running'
  | 'waiting_input'
  | 'waiting_approval'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'cancelled';

export interface ExecutionError {
  id: string;
  stepId: string;
  error: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
}

export interface ApprovalRequest {
  id: string;
  executionId: string;
  stepId: string;
  documentId: string;
  requester: string;
  approvers: string[];
  deadline?: Date;
  status: ApprovalStatus;
  reason?: string;
  createdAt: Date;
  approvedAt?: Date;
  approvedBy?: string;
  comments?: string;
  attachments?: string[];
}

export type ApprovalStatus = 
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired';

export interface NotificationTemplate {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'push' | 'webhook';
  subject?: string;
  content: string;
  variables: string[];
  active: boolean;
}

export interface WorkflowStatistics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  stepStatistics: Record<string, StepStatistics>;
  bottlenecks: BottleneckAnalysis[];
}

export interface StepStatistics {
  totalExecutions: number;
  successRate: number;
  averageExecutionTime: number;
  errorRate: number;
  mostCommonErrors: string[];
}

export interface BottleneckAnalysis {
  stepId: string;
  stepName: string;
  averageWaitTime: number;
  pendingCount: number;
  severity: 'low' | 'medium' | 'high';
}

export class DocumentWorkflowService extends EventEmitter {
  private workflows: Map<string, DocumentWorkflow> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();
  private approvalRequests: Map<string, ApprovalRequest> = new Map();
  private notificationTemplates: Map<string, NotificationTemplate> = new Map();
  private activeExecutions: Map<string, WorkflowExecution> = new Map();

  constructor() {
    super();
    this.initializeDefaultWorkflows();
    this.startWorkflowProcessor();
  }

  // Workflow Management
  async createWorkflow(workflow: Omit<DocumentWorkflow, 'id' | 'version' | 'createdAt' | 'updatedAt'>): Promise<DocumentWorkflow> {
    const newWorkflow: DocumentWorkflow = {
      ...workflow,
      id: uuidv4(),
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.workflows.set(newWorkflow.id, newWorkflow);
    this.emit('workflowCreated', { workflow: newWorkflow });

    return newWorkflow;
  }

  async updateWorkflow(workflowId: string, updates: Partial<DocumentWorkflow>): Promise<DocumentWorkflow | null> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return null;

    const updatedWorkflow = {
      ...workflow,
      ...updates,
      version: workflow.version + 1,
      updatedAt: new Date()
    };

    this.workflows.set(workflowId, updatedWorkflow);
    this.emit('workflowUpdated', { workflow: updatedWorkflow });

    return updatedWorkflow;
  }

  async getWorkflow(workflowId: string): Promise<DocumentWorkflow | null> {
    return this.workflows.get(workflowId) || null;
  }

  async getAllWorkflows(): Promise<DocumentWorkflow[]> {
    return Array.from(this.workflows.values());
  }

  async deleteWorkflow(workflowId: string): Promise<boolean> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return false;

    // Check for active executions
    const activeExecutions = Array.from(this.executions.values())
      .filter(exec => exec.workflowId === workflowId && 
        ['pending', 'running', 'waiting_approval', 'paused'].includes(exec.status));

    if (activeExecutions.length > 0) {
      throw new Error('Cannot delete workflow with active executions');
    }

    this.workflows.delete(workflowId);
    this.emit('workflowDeleted', { workflowId });

    return true;
  }

  // Workflow Execution
  async startWorkflow(
    workflowId: string,
    documentId: string,
    startedBy: string,
    context: Partial<ExecutionContext> = {}
  ): Promise<string> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    if (workflow.status !== 'active') {
      throw new Error('Workflow is not active');
    }

    const executionId = uuidv4();
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      documentId,
      status: 'pending',
      startedAt: new Date(),
      startedBy,
      context: {
        variables: {},
        documentData: {},
        userInputs: {},
        systemContext: {},
        ...context
      },
      stepExecutions: [],
      errors: [],
      metadata: {}
    };

    this.executions.set(executionId, execution);
    this.activeExecutions.set(executionId, execution);

    this.emit('workflowStarted', { executionId, execution });

    // Start processing
    this.processExecution(executionId);

    return executionId;
  }

  async getExecution(executionId: string): Promise<WorkflowExecution | null> {
    return this.executions.get(executionId) || null;
  }

  async getExecutionsByDocument(documentId: string): Promise<WorkflowExecution[]> {
    return Array.from(this.executions.values())
      .filter(exec => exec.documentId === documentId);
  }

  async getExecutionsByWorkflow(workflowId: string): Promise<WorkflowExecution[]> {
    return Array.from(this.executions.values())
      .filter(exec => exec.workflowId === workflowId);
  }

  async pauseExecution(executionId: string): Promise<boolean> {
    const execution = this.executions.get(executionId);
    if (!execution || execution.status !== 'running') return false;

    execution.status = 'paused';
    this.executions.set(executionId, execution);
    this.emit('executionPaused', { executionId });

    return true;
  }

  async resumeExecution(executionId: string): Promise<boolean> {
    const execution = this.executions.get(executionId);
    if (!execution || execution.status !== 'paused') return false;

    execution.status = 'running';
    this.executions.set(executionId, execution);
    this.activeExecutions.set(executionId, execution);
    this.emit('executionResumed', { executionId });

    // Resume processing
    this.processExecution(executionId);

    return true;
  }

  async cancelExecution(executionId: string): Promise<boolean> {
    const execution = this.executions.get(executionId);
    if (!execution) return false;

    execution.status = 'cancelled';
    execution.completedAt = new Date();
    this.executions.set(executionId, execution);
    this.activeExecutions.delete(executionId);
    this.emit('executionCancelled', { executionId });

    return true;
  }

  // Step Execution
  private async processExecution(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) return;

    const workflow = this.workflows.get(execution.workflowId);
    if (!workflow) return;

    try {
      execution.status = 'running';

      // Sort steps by order
      const sortedSteps = workflow.steps.sort((a, b) => a.order - b.order);

      for (const step of sortedSteps) {
        // Check if step should be executed based on dependencies and conditions
        if (!await this.shouldExecuteStep(step, execution, workflow)) {
          continue;
        }

        execution.currentStep = step.id;
        this.executions.set(executionId, execution);

        const stepResult = await this.executeStep(step, execution, workflow);

        if (stepResult.status === 'failed' && step.errorHandling?.strategy === 'stop') {
          execution.status = 'failed';
          break;
        }

        if (stepResult.status === 'waiting_approval') {
          execution.status = 'waiting_approval';
          break;
        }

        if (stepResult.status === 'waiting_input') {
          execution.status = 'paused';
          break;
        }
      }

      // Complete execution if all steps are done
      if (execution.status === 'running') {
        execution.status = 'completed';
        execution.completedAt = new Date();
        this.activeExecutions.delete(executionId);
        this.emit('executionCompleted', { executionId, execution });
      }

      this.executions.set(executionId, execution);

    } catch (error) {
      execution.status = 'failed';
      execution.completedAt = new Date();
      execution.errors.push({
        id: uuidv4(),
        stepId: execution.currentStep || 'unknown',
        error: error.message,
        timestamp: new Date(),
        severity: 'critical',
        resolved: false
      });

      this.activeExecutions.delete(executionId);
      this.executions.set(executionId, execution);
      this.emit('executionFailed', { executionId, execution, error: error.message });
    }
  }

  private async shouldExecuteStep(
    step: WorkflowStep,
    execution: WorkflowExecution,
    workflow: DocumentWorkflow
  ): Promise<boolean> {
    // Check dependencies
    for (const dependencyId of step.dependencies) {
      const dependencyExecution = execution.stepExecutions.find(se => se.stepId === dependencyId);
      if (!dependencyExecution || dependencyExecution.status !== 'completed') {
        return false;
      }
    }

    // Check workflow conditions
    for (const condition of workflow.conditions) {
      if (!await this.evaluateCondition(condition, execution)) {
        return false;
      }
    }

    return true;
  }

  private async executeStep(
    step: WorkflowStep,
    execution: WorkflowExecution,
    workflow: DocumentWorkflow
  ): Promise<StepExecution> {
    const stepExecution: StepExecution = {
      id: uuidv4(),
      stepId: step.id,
      stepName: step.name,
      status: 'pending',
      startedAt: new Date(),
      retryCount: 0,
      outputs: {}
    };

    execution.stepExecutions.push(stepExecution);

    try {
      stepExecution.status = 'running';

      switch (step.type) {
        case 'validation':
          await this.executeValidationStep(step, execution, stepExecution);
          break;
        case 'approval':
          await this.executeApprovalStep(step, execution, stepExecution);
          break;
        case 'notification':
          await this.executeNotificationStep(step, execution, stepExecution);
          break;
        case 'data_extraction':
          await this.executeDataExtractionStep(step, execution, stepExecution);
          break;
        case 'classification':
          await this.executeClassificationStep(step, execution, stepExecution);
          break;
        case 'routing':
          await this.executeRoutingStep(step, execution, stepExecution);
          break;
        case 'archival':
          await this.executeArchivalStep(step, execution, stepExecution);
          break;
        case 'integration':
          await this.executeIntegrationStep(step, execution, stepExecution);
          break;
        case 'processing':
          await this.executeProcessingStep(step, execution, stepExecution);
          break;
        case 'custom_script':
          await this.executeCustomScriptStep(step, execution, stepExecution);
          break;
      }

      if (stepExecution.status === 'running') {
        stepExecution.status = 'completed';
        stepExecution.completedAt = new Date();
        stepExecution.duration = stepExecution.completedAt.getTime() - stepExecution.startedAt.getTime();
      }

    } catch (error) {
      stepExecution.status = 'failed';
      stepExecution.error = error.message;
      stepExecution.completedAt = new Date();

      // Handle retry logic
      if (step.retryPolicy && stepExecution.retryCount < step.retryPolicy.maxRetries) {
        stepExecution.retryCount++;
        await this.retryStep(step, execution, stepExecution);
      }
    }

    return stepExecution;
  }

  private async executeValidationStep(
    step: WorkflowStep,
    execution: WorkflowExecution,
    stepExecution: StepExecution
  ): Promise<void> {
    const criteria = step.configuration.criteria as ValidationCriteria[];
    const validationResults = [];

    for (const criterion of criteria) {
      const fieldValue = execution.context.documentData[criterion.field];
      const isValid = await this.validateField(fieldValue, criterion);
      
      validationResults.push({
        field: criterion.field,
        isValid,
        value: fieldValue,
        criterion
      });

      if (!isValid && criterion.required) {
        throw new Error(`Validation failed for required field: ${criterion.field}`);
      }
    }

    stepExecution.outputs.validationResults = validationResults;
  }

  private async executeApprovalStep(
    step: WorkflowStep,
    execution: WorkflowExecution,
    stepExecution: StepExecution
  ): Promise<void> {
    const approvers = step.configuration.approvers as string[];
    
    const approvalRequest: ApprovalRequest = {
      id: uuidv4(),
      executionId: execution.id,
      stepId: step.id,
      documentId: execution.documentId,
      requester: execution.startedBy,
      approvers,
      status: 'pending',
      createdAt: new Date(),
      deadline: step.configuration.deadline ? new Date(Date.now() + step.configuration.deadline * 1000) : undefined
    };

    this.approvalRequests.set(approvalRequest.id, approvalRequest);
    stepExecution.status = 'waiting_approval';
    stepExecution.outputs.approvalRequestId = approvalRequest.id;

    this.emit('approvalRequested', { approvalRequest, execution, step });
  }

  private async executeNotificationStep(
    step: WorkflowStep,
    execution: WorkflowExecution,
    stepExecution: StepExecution
  ): Promise<void> {
    const recipients = step.configuration.recipients as string[];
    const templateId = step.configuration.template as string;
    
    const template = this.notificationTemplates.get(templateId);
    if (!template) {
      throw new Error(`Notification template not found: ${templateId}`);
    }

    const renderedContent = this.renderTemplate(template.content, execution.context);
    
    for (const recipient of recipients) {
      await this.sendNotification(recipient, template.type, template.subject, renderedContent);
    }

    stepExecution.outputs.notificationsSent = recipients.length;
  }

  private async executeDataExtractionStep(
    step: WorkflowStep,
    execution: WorkflowExecution,
    stepExecution: StepExecution
  ): Promise<void> {
    // Mock data extraction
    const extractedData = {
      patientName: 'Nguyễn Văn A',
      totalAmount: 350000,
      date: new Date(),
      hospitalName: 'Bệnh viện Bạch Mai'
    };

    execution.context.documentData = { ...execution.context.documentData, ...extractedData };
    stepExecution.outputs.extractedFields = Object.keys(extractedData);
  }

  private async executeClassificationStep(
    step: WorkflowStep,
    execution: WorkflowExecution,
    stepExecution: StepExecution
  ): Promise<void> {
    // Mock classification
    const classification = {
      documentType: 'medical_invoice',
      confidence: 0.95,
      category: 'healthcare'
    };

    execution.context.documentData.classification = classification;
    stepExecution.outputs.classification = classification;
  }

  private async executeRoutingStep(
    step: WorkflowStep,
    execution: WorkflowExecution,
    stepExecution: StepExecution
  ): Promise<void> {
    const routingRules = step.configuration.routingRules || [];
    let routedTo = 'default';

    for (const rule of routingRules) {
      if (await this.evaluateRoutingRule(rule, execution)) {
        routedTo = rule.destination;
        break;
      }
    }

    stepExecution.outputs.routedTo = routedTo;
    execution.context.systemContext.routedTo = routedTo;
  }

  private async executeArchivalStep(
    step: WorkflowStep,
    execution: WorkflowExecution,
    stepExecution: StepExecution
  ): Promise<void> {
    const archiveLocation = step.configuration.archiveLocation || 'default_archive';
    
    // Mock archival process
    const archiveReference = `${archiveLocation}/${execution.documentId}_${Date.now()}`;
    
    stepExecution.outputs.archiveReference = archiveReference;
    execution.context.systemContext.archived = true;
    execution.context.systemContext.archiveReference = archiveReference;
  }

  private async executeIntegrationStep(
    step: WorkflowStep,
    execution: WorkflowExecution,
    stepExecution: StepExecution
  ): Promise<void> {
    const endpoint = step.configuration.endpoint as string;
    const method = step.configuration.method || 'POST';
    const payload = step.configuration.payload || execution.context.documentData;

    // Mock external API call
    const response = {
      success: true,
      externalId: uuidv4(),
      timestamp: new Date()
    };

    stepExecution.outputs.integrationResponse = response;
    execution.context.systemContext.externalId = response.externalId;
  }

  private async executeProcessingStep(
    step: WorkflowStep,
    execution: WorkflowExecution,
    stepExecution: StepExecution
  ): Promise<void> {
    const processingType = step.configuration.processingType;
    
    switch (processingType) {
      case 'ocr':
        stepExecution.outputs.ocrText = 'Extracted OCR text...';
        break;
      case 'compression':
        stepExecution.outputs.compressionRatio = 0.75;
        break;
      case 'watermark':
        stepExecution.outputs.watermarked = true;
        break;
      default:
        stepExecution.outputs.processed = true;
    }
  }

  private async executeCustomScriptStep(
    step: WorkflowStep,
    execution: WorkflowExecution,
    stepExecution: StepExecution
  ): Promise<void> {
    const script = step.configuration.script as string;
    
    // Mock script execution - in real implementation would use a sandboxed environment
    const scriptResult = {
      executed: true,
      output: 'Custom script executed successfully',
      variables: { customVar: 'value' }
    };

    stepExecution.outputs = scriptResult;
    execution.context.variables = { ...execution.context.variables, ...scriptResult.variables };
  }

  // Helper methods
  private async validateField(value: any, criterion: ValidationCriteria): Promise<boolean> {
    if (criterion.required && (!value || value === '')) {
      return false;
    }

    if (criterion.pattern && !new RegExp(criterion.pattern).test(String(value))) {
      return false;
    }

    if (criterion.type === 'number') {
      const numValue = Number(value);
      if (isNaN(numValue)) return false;
      if (criterion.minValue !== undefined && numValue < criterion.minValue) return false;
      if (criterion.maxValue !== undefined && numValue > criterion.maxValue) return false;
    }

    if (criterion.allowedValues && !criterion.allowedValues.includes(String(value))) {
      return false;
    }

    return true;
  }

  private async evaluateCondition(
    condition: WorkflowCondition,
    execution: WorkflowExecution
  ): Promise<boolean> {
    // Simple condition evaluation - in real implementation would use a proper expression parser
    try {
      const context = {
        documentData: execution.context.documentData,
        variables: execution.context.variables,
        systemContext: execution.context.systemContext
      };

      // Mock evaluation - replace with actual expression evaluator
      return true;
    } catch (error) {
      return false;
    }
  }

  private async evaluateRoutingRule(rule: any, execution: WorkflowExecution): Promise<boolean> {
    // Mock routing rule evaluation
    return Math.random() > 0.5;
  }

  private renderTemplate(template: string, context: ExecutionContext): string {
    let rendered = template;
    
    // Simple template rendering - replace {{variable}} with actual values
    const variables = { ...context.variables, ...context.documentData, ...context.systemContext };
    
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      rendered = rendered.replace(placeholder, String(value));
    }

    return rendered;
  }

  private async sendNotification(
    recipient: string,
    type: string,
    subject?: string,
    content?: string
  ): Promise<void> {
    // Mock notification sending
    this.emit('notificationSent', { recipient, type, subject, content });
  }

  private async retryStep(
    step: WorkflowStep,
    execution: WorkflowExecution,
    stepExecution: StepExecution
  ): Promise<void> {
    const retryPolicy = step.retryPolicy!;
    const delay = Math.min(
      retryPolicy.retryDelay * Math.pow(retryPolicy.backoffMultiplier, stepExecution.retryCount - 1),
      retryPolicy.maxDelay
    );

    setTimeout(() => {
      this.executeStep(step, execution, stepExecution);
    }, delay);
  }

  // Approval Management
  async approveRequest(
    approvalRequestId: string,
    approverId: string,
    comments?: string
  ): Promise<boolean> {
    const request = this.approvalRequests.get(approvalRequestId);
    if (!request || request.status !== 'pending') return false;

    if (!request.approvers.includes(approverId)) {
      throw new Error('User not authorized to approve this request');
    }

    request.status = 'approved';
    request.approvedBy = approverId;
    request.approvedAt = new Date();
    request.comments = comments;

    this.approvalRequests.set(approvalRequestId, request);

    // Resume workflow execution
    const execution = this.executions.get(request.executionId);
    if (execution && execution.status === 'waiting_approval') {
      execution.status = 'running';
      this.activeExecutions.set(execution.id, execution);
      this.processExecution(execution.id);
    }

    this.emit('approvalGranted', { approvalRequest: request, approverId });
    return true;
  }

  async rejectRequest(
    approvalRequestId: string,
    approverId: string,
    reason: string
  ): Promise<boolean> {
    const request = this.approvalRequests.get(approvalRequestId);
    if (!request || request.status !== 'pending') return false;

    if (!request.approvers.includes(approverId)) {
      throw new Error('User not authorized to reject this request');
    }

    request.status = 'rejected';
    request.approvedBy = approverId;
    request.approvedAt = new Date();
    request.reason = reason;

    this.approvalRequests.set(approvalRequestId, request);

    // Fail workflow execution
    const execution = this.executions.get(request.executionId);
    if (execution) {
      execution.status = 'failed';
      execution.completedAt = new Date();
      this.activeExecutions.delete(execution.id);
    }

    this.emit('approvalRejected', { approvalRequest: request, approverId, reason });
    return true;
  }

  async getPendingApprovals(approverId: string): Promise<ApprovalRequest[]> {
    return Array.from(this.approvalRequests.values())
      .filter(request => 
        request.status === 'pending' && 
        request.approvers.includes(approverId)
      );
  }

  // Analytics and Monitoring
  async getWorkflowStatistics(workflowId: string): Promise<WorkflowStatistics> {
    const executions = Array.from(this.executions.values())
      .filter(exec => exec.workflowId === workflowId);

    const successfulExecutions = executions.filter(exec => exec.status === 'completed');
    const failedExecutions = executions.filter(exec => exec.status === 'failed');

    const totalExecutionTime = successfulExecutions
      .filter(exec => exec.completedAt)
      .reduce((sum, exec) => sum + (exec.completedAt!.getTime() - exec.startedAt.getTime()), 0);

    const averageExecutionTime = successfulExecutions.length > 0 
      ? totalExecutionTime / successfulExecutions.length 
      : 0;

    // Calculate step statistics
    const stepStatistics: Record<string, StepStatistics> = {};
    const workflow = this.workflows.get(workflowId);
    
    if (workflow) {
      for (const step of workflow.steps) {
        const stepExecutions = executions.flatMap(exec => 
          exec.stepExecutions.filter(se => se.stepId === step.id)
        );

        stepStatistics[step.id] = {
          totalExecutions: stepExecutions.length,
          successRate: stepExecutions.length > 0 
            ? stepExecutions.filter(se => se.status === 'completed').length / stepExecutions.length 
            : 0,
          averageExecutionTime: this.calculateAverageStepTime(stepExecutions),
          errorRate: stepExecutions.length > 0 
            ? stepExecutions.filter(se => se.status === 'failed').length / stepExecutions.length 
            : 0,
          mostCommonErrors: this.getMostCommonErrors(stepExecutions)
        };
      }
    }

    return {
      totalExecutions: executions.length,
      successfulExecutions: successfulExecutions.length,
      failedExecutions: failedExecutions.length,
      averageExecutionTime,
      stepStatistics,
      bottlenecks: this.identifyBottlenecks(executions)
    };
  }

  private calculateAverageStepTime(stepExecutions: StepExecution[]): number {
    const completedSteps = stepExecutions.filter(se => se.duration);
    return completedSteps.length > 0 
      ? completedSteps.reduce((sum, se) => sum + (se.duration || 0), 0) / completedSteps.length 
      : 0;
  }

  private getMostCommonErrors(stepExecutions: StepExecution[]): string[] {
    const errorCounts: Record<string, number> = {};
    
    stepExecutions
      .filter(se => se.error)
      .forEach(se => {
        errorCounts[se.error!] = (errorCounts[se.error!] || 0) + 1;
      });

    return Object.entries(errorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([error]) => error);
  }

  private identifyBottlenecks(executions: WorkflowExecution[]): BottleneckAnalysis[] {
    // Simplified bottleneck analysis
    const stepWaitTimes: Record<string, number[]> = {};
    
    executions.forEach(exec => {
      exec.stepExecutions.forEach(se => {
        if (se.status === 'waiting_approval' || se.status === 'waiting_input') {
          if (!stepWaitTimes[se.stepId]) {
            stepWaitTimes[se.stepId] = [];
          }
          const waitTime = Date.now() - se.startedAt.getTime();
          stepWaitTimes[se.stepId].push(waitTime);
        }
      });
    });

    return Object.entries(stepWaitTimes)
      .map(([stepId, waitTimes]) => ({
        stepId,
        stepName: stepId, // Would lookup actual step name
        averageWaitTime: waitTimes.reduce((sum, time) => sum + time, 0) / waitTimes.length,
        pendingCount: waitTimes.length,
        severity: waitTimes.length > 10 ? 'high' : waitTimes.length > 5 ? 'medium' : 'low'
      }))
      .sort((a, b) => b.averageWaitTime - a.averageWaitTime)
      .slice(0, 10) as BottleneckAnalysis[];
  }

  // Workflow Processor
  private startWorkflowProcessor(): void {
    setInterval(() => {
      this.processActiveExecutions();
      this.checkExpiredApprovals();
    }, 5000); // Check every 5 seconds
  }

  private async processActiveExecutions(): Promise<void> {
    for (const execution of this.activeExecutions.values()) {
      if (execution.status === 'running') {
        // Continue processing if needed
      }
    }
  }

  private async checkExpiredApprovals(): Promise<void> {
    const now = new Date();
    
    for (const request of this.approvalRequests.values()) {
      if (request.status === 'pending' && request.deadline && request.deadline < now) {
        request.status = 'expired';
        this.approvalRequests.set(request.id, request);
        
        // Handle expired approval
        const execution = this.executions.get(request.executionId);
        if (execution) {
          execution.status = 'failed';
          execution.completedAt = new Date();
          this.activeExecutions.delete(execution.id);
          
          execution.errors.push({
            id: uuidv4(),
            stepId: request.stepId,
            error: 'Approval request expired',
            timestamp: now,
            severity: 'high',
            resolved: false
          });
        }
        
        this.emit('approvalExpired', { approvalRequest: request });
      }
    }
  }

  // Initialize default workflows
  private initializeDefaultWorkflows(): void {
    const medicalInvoiceWorkflow: DocumentWorkflow = {
      id: 'medical_invoice_workflow',
      name: 'Medical Invoice Processing',
      description: 'Automated processing workflow for medical invoices',
      documentTypes: ['medical_invoice'],
      steps: [
        {
          id: 'validation_step',
          name: 'Document Validation',
          type: 'validation',
          order: 1,
          configuration: {
            criteria: [
              {
                field: 'patient_name',
                required: true,
                type: 'text',
                minValue: 2
              },
              {
                field: 'total_amount',
                required: true,
                type: 'number',
                minValue: 0
              }
            ]
          },
          dependencies: [],
          outputs: [
            { name: 'validationResults', type: 'object', description: 'Validation results' }
          ]
        },
        {
          id: 'approval_step',
          name: 'Manager Approval',
          type: 'approval',
          order: 2,
          configuration: {
            approvers: ['manager1', 'manager2'],
            deadline: 86400 // 24 hours
          },
          dependencies: ['validation_step'],
          outputs: [
            { name: 'approvalResult', type: 'boolean', description: 'Approval result' }
          ]
        },
        {
          id: 'notification_step',
          name: 'Completion Notification',
          type: 'notification',
          order: 3,
          configuration: {
            recipients: ['submitter', 'finance_team'],
            template: 'invoice_processed'
          },
          dependencies: ['approval_step'],
          outputs: [
            { name: 'notificationsSent', type: 'number', description: 'Number of notifications sent' }
          ]
        }
      ],
      triggers: [
        {
          id: 'upload_trigger',
          type: 'document_upload',
          event: 'document_uploaded',
          conditions: [
            {
              field: 'documentType',
              operator: 'equals',
              value: 'medical_invoice'
            }
          ],
          active: true
        }
      ],
      conditions: [],
      status: 'active',
      version: 1,
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {}
    };

    this.workflows.set(medicalInvoiceWorkflow.id, medicalInvoiceWorkflow);

    // Create notification template
    const invoiceProcessedTemplate: NotificationTemplate = {
      id: 'invoice_processed',
      name: 'Invoice Processed Notification',
      type: 'email',
      subject: 'Medical Invoice Processed - {{documentId}}',
      content: 'Your medical invoice for {{patientName}} has been processed successfully. Total amount: {{totalAmount}} VND.',
      variables: ['documentId', 'patientName', 'totalAmount'],
      active: true
    };

    this.notificationTemplates.set(invoiceProcessedTemplate.id, invoiceProcessedTemplate);
  }
}
