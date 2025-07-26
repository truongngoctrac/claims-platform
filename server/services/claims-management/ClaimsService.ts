import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { ClaimStatus, ClaimPriority, ClaimType } from '../../../shared/healthcare';

export interface ClaimWorkflowConfig {
  autoApprovalThreshold: number;
  highPriorityAmount: number;
  requiredDocuments: Record<ClaimType, string[]>;
  approvalWorkflow: Record<ClaimStatus, ClaimStatus[]>;
}

export interface BusinessRule {
  id: string;
  name: string;
  description: string;
  condition: (claim: any) => boolean;
  action: (claim: any) => any;
  priority: number;
  active: boolean;
}

export interface ClaimAssignment {
  claimId: string;
  assignedTo: string;
  assignedBy: string;
  assignedAt: Date;
  workload: number;
  specialization?: string[];
}

export interface ClaimHistoryEntry {
  id: string;
  claimId: string;
  action: string;
  actor: string;
  timestamp: Date;
  previousState: any;
  newState: any;
  notes?: string;
  metadata?: Record<string, any>;
}

export class ClaimsWorkflowEngine extends EventEmitter {
  private config: ClaimWorkflowConfig;
  private businessRules: BusinessRule[] = [];
  private assignments: Map<string, ClaimAssignment> = new Map();
  private history: Map<string, ClaimHistoryEntry[]> = new Map();

  constructor(config: ClaimWorkflowConfig) {
    super();
    this.config = config;
    this.initializeDefaultRules();
  }

  // 2.2.1 Complete claim workflow implementation
  async processClaim(claim: any): Promise<any> {
    try {
      // Add to history
      this.addHistoryEntry(claim.id, 'claim_submitted', 'system', claim, {});

      // Apply business rules
      const processedClaim = await this.applyBusinessRules(claim);

      // Calculate priority
      const priority = this.calculatePriority(processedClaim);
      processedClaim.priority = priority;

      // Assign claim
      const assignment = await this.assignClaim(processedClaim);
      processedClaim.assignedTo = assignment.assignedTo;

      // Determine next status
      const nextStatus = this.getNextStatus(processedClaim);
      processedClaim.status = nextStatus;

      // Emit workflow event
      this.emit('claimProcessed', processedClaim);

      return processedClaim;
    } catch (error) {
      this.emit('claimProcessingError', { claimId: claim.id, error });
      throw error;
    }
  }

  // 2.2.2 Claim status state machine
  getNextStatus(claim: any): ClaimStatus {
    const currentStatus = claim.status as ClaimStatus;
    const allowedTransitions = this.config.approvalWorkflow[currentStatus] || [];

    // Auto-approval logic
    if (currentStatus === 'pending' && claim.amount <= this.config.autoApprovalThreshold) {
      return 'approved';
    }

    // High-priority fast-track
    if (claim.priority === 'urgent' && currentStatus === 'pending') {
      return 'processing';
    }

    // Default next status
    return allowedTransitions[0] || currentStatus;
  }

  validateStatusTransition(from: ClaimStatus, to: ClaimStatus): boolean {
    const allowedTransitions = this.config.approvalWorkflow[from] || [];
    return allowedTransitions.includes(to);
  }

  // 2.2.3 Business rule validation engine
  private initializeDefaultRules(): void {
    this.businessRules = [
      {
        id: 'amount_validation',
        name: 'Amount Validation',
        description: 'Validate claim amount against treatment type',
        condition: (claim) => claim.amount > 0,
        action: (claim) => {
          if (claim.amount > 100000000) { // 100M VND
            claim.flags = [...(claim.flags || []), 'high_amount'];
          }
          return claim;
        },
        priority: 1,
        active: true
      },
      {
        id: 'document_completeness',
        name: 'Document Completeness Check',
        description: 'Ensure all required documents are present',
        condition: (claim) => !!claim.documents && claim.documents.length > 0,
        action: (claim) => {
          const requiredDocs = this.config.requiredDocuments[claim.type] || [];
          const submittedDocs = claim.documents.map((d: any) => d.type);
          const missingDocs = requiredDocs.filter(doc => !submittedDocs.includes(doc));
          
          if (missingDocs.length > 0) {
            claim.flags = [...(claim.flags || []), 'missing_documents'];
            claim.missingDocuments = missingDocs;
          }
          return claim;
        },
        priority: 2,
        active: true
      },
      {
        id: 'duplicate_check',
        name: 'Duplicate Claim Detection',
        description: 'Check for potential duplicate claims',
        condition: (claim) => !!claim.patientId && !!claim.treatmentDate,
        action: (claim) => {
          // Mock duplicate detection logic
          const riskScore = Math.random();
          if (riskScore > 0.8) {
            claim.flags = [...(claim.flags || []), 'potential_duplicate'];
            claim.duplicateRisk = riskScore;
          }
          return claim;
        },
        priority: 3,
        active: true
      }
    ];
  }

  async applyBusinessRules(claim: any): Promise<any> {
    let processedClaim = { ...claim };
    
    const activeRules = this.businessRules
      .filter(rule => rule.active)
      .sort((a, b) => a.priority - b.priority);

    for (const rule of activeRules) {
      try {
        if (rule.condition(processedClaim)) {
          processedClaim = rule.action(processedClaim);
          this.addHistoryEntry(claim.id, 'rule_applied', 'system', processedClaim, { ruleId: rule.id });
        }
      } catch (error) {
        console.error(`Error applying rule ${rule.id}:`, error);
      }
    }

    return processedClaim;
  }

  // 2.2.4 Claim assignment logic
  async assignClaim(claim: any): Promise<ClaimAssignment> {
    // Mock assignment logic - in real implementation, would query available executives
    const availableExecutives = [
      { id: 'exec1', workload: 5, specialization: ['cardiology', 'emergency'] },
      { id: 'exec2', workload: 3, specialization: ['orthopedics', 'surgery'] },
      { id: 'exec3', workload: 7, specialization: ['general', 'outpatient'] }
    ];

    // Find executive with lowest workload and matching specialization
    let bestMatch = availableExecutives[0];
    for (const exec of availableExecutives) {
      if (exec.workload < bestMatch.workload) {
        if (!claim.specialty || exec.specialization.includes(claim.specialty)) {
          bestMatch = exec;
        }
      }
    }

    const assignment: ClaimAssignment = {
      claimId: claim.id,
      assignedTo: bestMatch.id,
      assignedBy: 'system',
      assignedAt: new Date(),
      workload: bestMatch.workload + 1,
      specialization: bestMatch.specialization
    };

    this.assignments.set(claim.id, assignment);
    return assignment;
  }

  // 2.2.5 Priority calculation algorithm
  calculatePriority(claim: any): ClaimPriority {
    let score = 0;

    // Amount-based scoring
    if (claim.amount > this.config.highPriorityAmount) score += 3;
    else if (claim.amount > this.config.highPriorityAmount * 0.5) score += 2;
    else score += 1;

    // Type-based scoring
    const typeScores: Record<string, number> = {
      'emergency': 4,
      'surgery': 3,
      'inpatient': 2,
      'outpatient': 1
    };
    score += typeScores[claim.type] || 1;

    // Age-based scoring (older patients get higher priority)
    const age = claim.patientAge || 0;
    if (age > 65) score += 2;
    else if (age > 45) score += 1;

    // Time-sensitive conditions
    if (claim.flags?.includes('time_sensitive')) score += 3;
    if (claim.flags?.includes('high_amount')) score += 2;

    // Convert score to priority
    if (score >= 8) return 'urgent';
    if (score >= 5) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
  }

  // 2.2.6 Claim history tracking
  addHistoryEntry(
    claimId: string, 
    action: string, 
    actor: string, 
    newState: any, 
    metadata: Record<string, any> = {}
  ): void {
    const entry: ClaimHistoryEntry = {
      id: uuidv4(),
      claimId,
      action,
      actor,
      timestamp: new Date(),
      previousState: {},
      newState,
      metadata
    };

    if (!this.history.has(claimId)) {
      this.history.set(claimId, []);
    }
    this.history.get(claimId)!.push(entry);
  }

  getClaimHistory(claimId: string): ClaimHistoryEntry[] {
    return this.history.get(claimId) || [];
  }

  // 2.2.7 Bulk operations support
  async processBulkClaims(claims: any[], operation: string): Promise<any[]> {
    const results = [];
    const batchSize = 10;

    for (let i = 0; i < claims.length; i += batchSize) {
      const batch = claims.slice(i, i + batchSize);
      const batchPromises = batch.map(async (claim) => {
        try {
          switch (operation) {
            case 'approve':
              return await this.approveClaim(claim.id, 'bulk_operation');
            case 'reject':
              return await this.rejectClaim(claim.id, 'bulk_operation', 'Bulk rejection');
            case 'reassign':
              return await this.reassignClaim(claim.id, claim.newAssignee);
            default:
              return await this.processClaim(claim);
          }
        } catch (error) {
          return { id: claim.id, error: error.message };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults.map(result => 
        result.status === 'fulfilled' ? result.value : result.reason
      ));
    }

    return results;
  }

  // Additional workflow methods
  async approveClaim(claimId: string, approver: string): Promise<any> {
    const assignment = this.assignments.get(claimId);
    if (!assignment) throw new Error('Claim not found');

    this.addHistoryEntry(claimId, 'claim_approved', approver, { status: 'approved' });
    this.emit('claimApproved', { claimId, approver });
    
    return { claimId, status: 'approved', approver, timestamp: new Date() };
  }

  async rejectClaim(claimId: string, rejector: string, reason: string): Promise<any> {
    const assignment = this.assignments.get(claimId);
    if (!assignment) throw new Error('Claim not found');

    this.addHistoryEntry(claimId, 'claim_rejected', rejector, { status: 'rejected', reason });
    this.emit('claimRejected', { claimId, rejector, reason });
    
    return { claimId, status: 'rejected', rejector, reason, timestamp: new Date() };
  }

  async reassignClaim(claimId: string, newAssignee: string): Promise<any> {
    const assignment = this.assignments.get(claimId);
    if (!assignment) throw new Error('Claim not found');

    const newAssignment = {
      ...assignment,
      assignedTo: newAssignee,
      assignedAt: new Date()
    };

    this.assignments.set(claimId, newAssignment);
    this.addHistoryEntry(claimId, 'claim_reassigned', 'system', { assignedTo: newAssignee });
    
    return newAssignment;
  }

  // Analytics and reporting
  getWorkflowMetrics(): any {
    const assignments = Array.from(this.assignments.values());
    const history = Array.from(this.history.values()).flat();

    return {
      totalClaims: assignments.length,
      averageProcessingTime: this.calculateAverageProcessingTime(history),
      statusDistribution: this.getStatusDistribution(assignments),
      executiveWorkload: this.getExecutiveWorkload(assignments),
      ruleEffectiveness: this.getRuleEffectiveness(history)
    };
  }

  private calculateAverageProcessingTime(history: ClaimHistoryEntry[]): number {
    // Mock calculation - in real implementation would calculate actual processing times
    return 2.5; // days
  }

  private getStatusDistribution(assignments: ClaimAssignment[]): Record<string, number> {
    // Mock distribution
    return {
      pending: 45,
      processing: 23,
      approved: 156,
      rejected: 12,
      paid: 89
    };
  }

  private getExecutiveWorkload(assignments: ClaimAssignment[]): Record<string, number> {
    const workload: Record<string, number> = {};
    assignments.forEach(assignment => {
      workload[assignment.assignedTo] = (workload[assignment.assignedTo] || 0) + 1;
    });
    return workload;
  }

  private getRuleEffectiveness(history: ClaimHistoryEntry[]): Record<string, number> {
    const effectiveness: Record<string, number> = {};
    history.forEach(entry => {
      if (entry.action === 'rule_applied' && entry.metadata?.ruleId) {
        const ruleId = entry.metadata.ruleId;
        effectiveness[ruleId] = (effectiveness[ruleId] || 0) + 1;
      }
    });
    return effectiveness;
  }
}

// Default configuration for Vietnamese healthcare system
export const defaultClaimsConfig: ClaimWorkflowConfig = {
  autoApprovalThreshold: 5000000, // 5M VND
  highPriorityAmount: 20000000, // 20M VND
  requiredDocuments: {
    'inpatient': ['medical_bill', 'prescription', 'discharge_summary', 'id_document'],
    'outpatient': ['medical_bill', 'prescription', 'id_document'],
    'emergency': ['medical_bill', 'emergency_report', 'id_document'],
    'surgery': ['medical_bill', 'surgery_report', 'prescription', 'id_document'],
    'dental': ['medical_bill', 'dental_xray', 'id_document'],
    'maternity': ['medical_bill', 'birth_certificate', 'prenatal_records', 'id_document']
  },
  approvalWorkflow: {
    'pending': ['processing', 'approved', 'rejected'],
    'processing': ['approved', 'rejected', 'pending'],
    'approved': ['paid', 'rejected'],
    'rejected': ['pending'],
    'paid': [],
    'cancelled': []
  }
};
