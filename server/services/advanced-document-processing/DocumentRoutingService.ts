import { EventEmitter } from 'events';

export interface RoutingResult {
  routingDecision: RoutingDecision;
  confidence: number;
  alternativeRoutes: RoutingDecision[];
  routingRules: AppliedRule[];
  processingWorkflow: WorkflowStep[];
  estimatedProcessingTime: number;
  metadata: {
    routingTime: number;
    rulesEvaluated: number;
    routerVersion: string;
  };
}

export interface RoutingDecision {
  destination: RoutingDestination;
  priority: RoutingPriority;
  department: string;
  processor: string;
  workflow: string;
  requiredCapabilities: string[];
  estimatedCompletionTime: Date;
  specialInstructions: string[];
}

export interface RoutingDestination {
  type: 'department' | 'processor' | 'queue' | 'external_system';
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  currentLoad: number;
  maxCapacity: number;
  averageProcessingTime: number;
}

export interface AppliedRule {
  ruleId: string;
  ruleName: string;
  category: RoutingCategory;
  triggered: boolean;
  confidence: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
}

export interface WorkflowStep {
  stepId: string;
  stepName: string;
  description: string;
  estimatedDuration: number;
  dependencies: string[];
  automated: boolean;
  requiredSkills: string[];
  optional: boolean;
}

export type RoutingPriority = 'urgent' | 'high' | 'normal' | 'low';

export type RoutingCategory = 
  | 'document_type'
  | 'content_analysis'
  | 'quality_based'
  | 'urgency_based'
  | 'department_specific'
  | 'skill_based'
  | 'load_balancing'
  | 'compliance_based';

export interface RoutingRule {
  id: string;
  name: string;
  category: RoutingCategory;
  description: string;
  enabled: boolean;
  priority: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
  metadata: {
    createdAt: Date;
    lastModified: Date;
    usageCount: number;
    successRate: number;
  };
}

export interface RuleCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'regex' | 'exists';
  value: any;
  weight: number;
}

export interface RuleAction {
  type: 'route_to' | 'set_priority' | 'assign_workflow' | 'add_instruction' | 'notify' | 'escalate';
  target: string;
  value: any;
  condition?: string;
}

export interface ProcessorCapability {
  name: string;
  description: string;
  skillLevel: 'basic' | 'intermediate' | 'advanced' | 'expert';
  certifications: string[];
}

export interface DepartmentConfig {
  id: string;
  name: string;
  description: string;
  specialties: string[];
  processors: ProcessorInfo[];
  workingHours: {
    start: number;
    end: number;
    timezone: string;
    workdays: number[];
  };
  slaTargets: {
    urgent: number; // minutes
    high: number;
    normal: number;
    low: number;
  };
}

export interface ProcessorInfo {
  id: string;
  name: string;
  email: string;
  capabilities: ProcessorCapability[];
  currentLoad: number;
  maxCapacity: number;
  performance: {
    averageProcessingTime: number;
    qualityScore: number;
    completionRate: number;
  };
  availability: {
    status: 'available' | 'busy' | 'offline' | 'on_break';
    lastActive: Date;
    workingHours: { start: number; end: number };
  };
}

export class DocumentRoutingService extends EventEmitter {
  private routingRules: RoutingRule[] = [];
  private departments: Map<string, DepartmentConfig> = new Map();
  private processors: Map<string, ProcessorInfo> = new Map();
  private workflowTemplates: Map<string, WorkflowStep[]> = new Map();
  private routingHistory: Map<string, RoutingResult[]> = new Map();

  constructor() {
    super();
    this.initializeDefaultRules();
    this.initializeDepartments();
    this.initializeWorkflowTemplates();
  }

  private initializeDefaultRules(): void {
    this.routingRules = [
      {
        id: 'urgent_medical_bills',
        name: 'Urgent Medical Bill Routing',
        category: 'urgency_based',
        description: 'Route high-value medical bills to experienced processors',
        enabled: true,
        priority: 1,
        conditions: [
          {
            field: 'documentType',
            operator: 'equals',
            value: 'medical_bill',
            weight: 1.0
          },
          {
            field: 'extractedData.totalAmount',
            operator: 'greater_than',
            value: 10000000, // 10 million VND
            weight: 0.8
          }
        ],
        actions: [
          {
            type: 'route_to',
            target: 'senior_claims_department',
            value: 'high_value_queue'
          },
          {
            type: 'set_priority',
            target: 'priority',
            value: 'high'
          },
          {
            type: 'assign_workflow',
            target: 'workflow',
            value: 'high_value_medical_bill_workflow'
          }
        ],
        metadata: {
          createdAt: new Date(),
          lastModified: new Date(),
          usageCount: 0,
          successRate: 0.95
        }
      },
      {
        id: 'prescription_verification',
        name: 'Prescription Verification Routing',
        category: 'document_type',
        description: 'Route prescriptions to pharmacy review team',
        enabled: true,
        priority: 2,
        conditions: [
          {
            field: 'documentType',
            operator: 'equals',
            value: 'prescription',
            weight: 1.0
          }
        ],
        actions: [
          {
            type: 'route_to',
            target: 'pharmacy_department',
            value: 'prescription_queue'
          },
          {
            type: 'assign_workflow',
            target: 'workflow',
            value: 'prescription_verification_workflow'
          }
        ],
        metadata: {
          createdAt: new Date(),
          lastModified: new Date(),
          usageCount: 0,
          successRate: 0.98
        }
      },
      {
        id: 'lab_result_routing',
        name: 'Lab Result Medical Review',
        category: 'content_analysis',
        description: 'Route lab results to medical review based on abnormal values',
        enabled: true,
        priority: 2,
        conditions: [
          {
            field: 'documentType',
            operator: 'equals',
            value: 'lab_result',
            weight: 1.0
          },
          {
            field: 'extractedData.hasAbnormalResults',
            operator: 'equals',
            value: true,
            weight: 0.9
          }
        ],
        actions: [
          {
            type: 'route_to',
            target: 'medical_review_department',
            value: 'abnormal_results_queue'
          },
          {
            type: 'set_priority',
            target: 'priority',
            value: 'high'
          },
          {
            type: 'add_instruction',
            target: 'instructions',
            value: 'Requires medical professional review due to abnormal test results'
          }
        ],
        metadata: {
          createdAt: new Date(),
          lastModified: new Date(),
          usageCount: 0,
          successRate: 0.92
        }
      },
      {
        id: 'quality_based_routing',
        name: 'Quality-Based Processor Assignment',
        category: 'quality_based',
        description: 'Route poor quality documents to experienced processors',
        enabled: true,
        priority: 3,
        conditions: [
          {
            field: 'qualityScore',
            operator: 'less_than',
            value: 60,
            weight: 1.0
          }
        ],
        actions: [
          {
            type: 'route_to',
            target: 'experienced_processors',
            value: 'quality_review_queue'
          },
          {
            type: 'add_instruction',
            target: 'instructions',
            value: 'Document has quality issues - requires careful manual review'
          }
        ],
        metadata: {
          createdAt: new Date(),
          lastModified: new Date(),
          usageCount: 0,
          successRate: 0.88
        }
      },
      {
        id: 'fraud_detection_routing',
        name: 'Fraud Detection Routing',
        category: 'compliance_based',
        description: 'Route documents with fraud indicators to fraud investigation team',
        enabled: true,
        priority: 1,
        conditions: [
          {
            field: 'fraudRiskScore',
            operator: 'greater_than',
            value: 70,
            weight: 1.0
          }
        ],
        actions: [
          {
            type: 'route_to',
            target: 'fraud_investigation_department',
            value: 'suspicious_documents_queue'
          },
          {
            type: 'set_priority',
            target: 'priority',
            value: 'urgent'
          },
          {
            type: 'notify',
            target: 'fraud_team_lead',
            value: 'High fraud risk document detected'
          }
        ],
        metadata: {
          createdAt: new Date(),
          lastModified: new Date(),
          usageCount: 0,
          successRate: 0.96
        }
      },
      {
        id: 'load_balancing',
        name: 'Load Balancing Routing',
        category: 'load_balancing',
        description: 'Distribute workload evenly among available processors',
        enabled: true,
        priority: 5,
        conditions: [
          {
            field: 'documentType',
            operator: 'in',
            value: ['medical_bill', 'prescription', 'lab_result'],
            weight: 1.0
          }
        ],
        actions: [
          {
            type: 'route_to',
            target: 'least_loaded_processor',
            value: 'auto_assignment'
          }
        ],
        metadata: {
          createdAt: new Date(),
          lastModified: new Date(),
          usageCount: 0,
          successRate: 0.85
        }
      },
      {
        id: 'after_hours_routing',
        name: 'After Hours Processing',
        category: 'department_specific',
        description: 'Route documents to 24/7 processing team during off-hours',
        enabled: true,
        priority: 4,
        conditions: [
          {
            field: 'currentTime',
            operator: 'regex',
            value: '^(18|19|20|21|22|23|00|01|02|03|04|05|06|07):',
            weight: 1.0
          }
        ],
        actions: [
          {
            type: 'route_to',
            target: 'night_shift_department',
            value: 'after_hours_queue'
          }
        ],
        metadata: {
          createdAt: new Date(),
          lastModified: new Date(),
          usageCount: 0,
          successRate: 0.82
        }
      }
    ];
  }

  private initializeDepartments(): void {
    const departments: DepartmentConfig[] = [
      {
        id: 'general_claims_department',
        name: 'General Claims Processing',
        description: 'Handles standard medical bill and claim processing',
        specialties: ['medical_bills', 'insurance_claims', 'routine_processing'],
        processors: [
          {
            id: 'processor_001',
            name: 'Nguyễn Văn A',
            email: 'processor001@example.com',
            capabilities: [
              {
                name: 'medical_bill_processing',
                description: 'Process medical bills and invoices',
                skillLevel: 'intermediate',
                certifications: ['Healthcare Claims Certification']
              }
            ],
            currentLoad: 5,
            maxCapacity: 10,
            performance: {
              averageProcessingTime: 45,
              qualityScore: 0.92,
              completionRate: 0.98
            },
            availability: {
              status: 'available',
              lastActive: new Date(),
              workingHours: { start: 8, end: 17 }
            }
          }
        ],
        workingHours: {
          start: 8,
          end: 17,
          timezone: 'Asia/Ho_Chi_Minh',
          workdays: [1, 2, 3, 4, 5] // Monday to Friday
        },
        slaTargets: {
          urgent: 30,
          high: 120,
          normal: 480,
          low: 1440
        }
      },
      {
        id: 'senior_claims_department',
        name: 'Senior Claims Processing',
        description: 'Handles complex and high-value claims',
        specialties: ['high_value_claims', 'complex_cases', 'quality_review'],
        processors: [
          {
            id: 'senior_processor_001',
            name: 'Trần Thị B',
            email: 'senior001@example.com',
            capabilities: [
              {
                name: 'complex_case_analysis',
                description: 'Handle complex and high-value cases',
                skillLevel: 'expert',
                certifications: ['Senior Claims Specialist', 'Healthcare Claims Certification']
              }
            ],
            currentLoad: 3,
            maxCapacity: 6,
            performance: {
              averageProcessingTime: 90,
              qualityScore: 0.97,
              completionRate: 0.99
            },
            availability: {
              status: 'available',
              lastActive: new Date(),
              workingHours: { start: 8, end: 17 }
            }
          }
        ],
        workingHours: {
          start: 8,
          end: 17,
          timezone: 'Asia/Ho_Chi_Minh',
          workdays: [1, 2, 3, 4, 5]
        },
        slaTargets: {
          urgent: 15,
          high: 60,
          normal: 240,
          low: 720
        }
      },
      {
        id: 'pharmacy_department',
        name: 'Pharmacy Review Team',
        description: 'Specialized in prescription and medication review',
        specialties: ['prescription_review', 'medication_verification', 'drug_interactions'],
        processors: [],
        workingHours: {
          start: 7,
          end: 19,
          timezone: 'Asia/Ho_Chi_Minh',
          workdays: [1, 2, 3, 4, 5, 6]
        },
        slaTargets: {
          urgent: 20,
          high: 60,
          normal: 180,
          low: 480
        }
      },
      {
        id: 'medical_review_department',
        name: 'Medical Review Team',
        description: 'Medical professionals for clinical review',
        specialties: ['medical_review', 'clinical_assessment', 'abnormal_results'],
        processors: [],
        workingHours: {
          start: 6,
          end: 22,
          timezone: 'Asia/Ho_Chi_Minh',
          workdays: [1, 2, 3, 4, 5, 6, 7]
        },
        slaTargets: {
          urgent: 10,
          high: 30,
          normal: 120,
          low: 360
        }
      },
      {
        id: 'fraud_investigation_department',
        name: 'Fraud Investigation Team',
        description: 'Specialized fraud detection and investigation',
        specialties: ['fraud_investigation', 'suspicious_activity_analysis', 'compliance_review'],
        processors: [],
        workingHours: {
          start: 7,
          end: 19,
          timezone: 'Asia/Ho_Chi_Minh',
          workdays: [1, 2, 3, 4, 5]
        },
        slaTargets: {
          urgent: 5,
          high: 15,
          normal: 60,
          low: 240
        }
      },
      {
        id: 'night_shift_department',
        name: '24/7 Processing Team',
        description: 'Round-the-clock document processing',
        specialties: ['after_hours_processing', 'urgent_cases', 'basic_processing'],
        processors: [],
        workingHours: {
          start: 0,
          end: 24,
          timezone: 'Asia/Ho_Chi_Minh',
          workdays: [1, 2, 3, 4, 5, 6, 7]
        },
        slaTargets: {
          urgent: 60,
          high: 180,
          normal: 720,
          low: 1440
        }
      }
    ];

    departments.forEach(dept => this.departments.set(dept.id, dept));
  }

  private initializeWorkflowTemplates(): void {
    // High Value Medical Bill Workflow
    this.workflowTemplates.set('high_value_medical_bill_workflow', [
      {
        stepId: 'initial_review',
        stepName: 'Initial Document Review',
        description: 'Review document quality and completeness',
        estimatedDuration: 10,
        dependencies: [],
        automated: false,
        requiredSkills: ['document_review'],
        optional: false
      },
      {
        stepId: 'data_verification',
        stepName: 'Data Verification',
        description: 'Verify extracted data accuracy',
        estimatedDuration: 20,
        dependencies: ['initial_review'],
        automated: false,
        requiredSkills: ['data_verification', 'medical_knowledge'],
        optional: false
      },
      {
        stepId: 'amount_validation',
        stepName: 'Amount Validation',
        description: 'Validate bill amounts and calculations',
        estimatedDuration: 15,
        dependencies: ['data_verification'],
        automated: true,
        requiredSkills: ['financial_analysis'],
        optional: false
      },
      {
        stepId: 'fraud_screening',
        stepName: 'Fraud Screening',
        description: 'Screen for potential fraud indicators',
        estimatedDuration: 10,
        dependencies: ['amount_validation'],
        automated: true,
        requiredSkills: [],
        optional: false
      },
      {
        stepId: 'supervisor_approval',
        stepName: 'Supervisor Approval',
        description: 'Require supervisor approval for high value claims',
        estimatedDuration: 30,
        dependencies: ['fraud_screening'],
        automated: false,
        requiredSkills: ['supervisory_approval'],
        optional: false
      },
      {
        stepId: 'final_processing',
        stepName: 'Final Processing',
        description: 'Complete claim processing and payment authorization',
        estimatedDuration: 15,
        dependencies: ['supervisor_approval'],
        automated: false,
        requiredSkills: ['claims_processing'],
        optional: false
      }
    ]);

    // Prescription Verification Workflow
    this.workflowTemplates.set('prescription_verification_workflow', [
      {
        stepId: 'prescription_review',
        stepName: 'Prescription Review',
        description: 'Review prescription format and completeness',
        estimatedDuration: 8,
        dependencies: [],
        automated: false,
        requiredSkills: ['prescription_review'],
        optional: false
      },
      {
        stepId: 'doctor_verification',
        stepName: 'Doctor License Verification',
        description: 'Verify prescribing doctor credentials',
        estimatedDuration: 5,
        dependencies: ['prescription_review'],
        automated: true,
        requiredSkills: [],
        optional: false
      },
      {
        stepId: 'medication_check',
        stepName: 'Medication Safety Check',
        description: 'Check for drug interactions and dosage safety',
        estimatedDuration: 12,
        dependencies: ['doctor_verification'],
        automated: true,
        requiredSkills: ['pharmacology'],
        optional: false
      },
      {
        stepId: 'pharmacy_approval',
        stepName: 'Pharmacy Approval',
        description: 'Final approval by licensed pharmacist',
        estimatedDuration: 10,
        dependencies: ['medication_check'],
        automated: false,
        requiredSkills: ['pharmacy_license'],
        optional: false
      }
    ]);

    // Standard Processing Workflow
    this.workflowTemplates.set('standard_processing_workflow', [
      {
        stepId: 'document_intake',
        stepName: 'Document Intake',
        description: 'Initial document processing and categorization',
        estimatedDuration: 5,
        dependencies: [],
        automated: true,
        requiredSkills: [],
        optional: false
      },
      {
        stepId: 'data_extraction',
        stepName: 'Data Extraction',
        description: 'Extract and validate document data',
        estimatedDuration: 15,
        dependencies: ['document_intake'],
        automated: true,
        requiredSkills: [],
        optional: false
      },
      {
        stepId: 'manual_review',
        stepName: 'Manual Review',
        description: 'Human review of extracted data',
        estimatedDuration: 20,
        dependencies: ['data_extraction'],
        automated: false,
        requiredSkills: ['data_review'],
        optional: false
      },
      {
        stepId: 'final_approval',
        stepName: 'Final Approval',
        description: 'Final approval and processing completion',
        estimatedDuration: 10,
        dependencies: ['manual_review'],
        automated: false,
        requiredSkills: ['approval_authority'],
        optional: false
      }
    ]);
  }

  async routeDocument(
    documentData: any,
    extractedData: any,
    qualityAssessment?: any,
    fraudAssessment?: any
  ): Promise<RoutingResult> {
    const startTime = Date.now();

    try {
      // Prepare routing context
      const routingContext = {
        documentType: extractedData?.documentType || 'unknown',
        extractedData: extractedData || {},
        qualityScore: qualityAssessment?.overallQuality?.score || 100,
        fraudRiskScore: fraudAssessment?.riskScore || 0,
        currentTime: new Date().toTimeString(),
        submissionTime: new Date(),
        ...documentData
      };

      // Evaluate routing rules
      const appliedRules = await this.evaluateRoutingRules(routingContext);
      
      // Determine best routing decision
      const routingDecision = await this.determineRoutingDecision(routingContext, appliedRules);
      
      // Calculate alternative routes
      const alternativeRoutes = await this.calculateAlternativeRoutes(routingContext, routingDecision);
      
      // Get processing workflow
      const processingWorkflow = await this.getProcessingWorkflow(routingDecision.workflow);
      
      // Calculate estimated processing time
      const estimatedProcessingTime = this.calculateEstimatedProcessingTime(
        processingWorkflow,
        routingDecision.priority,
        routingDecision.destination
      );

      // Calculate confidence
      const confidence = this.calculateRoutingConfidence(appliedRules, routingDecision);

      const result: RoutingResult = {
        routingDecision,
        confidence,
        alternativeRoutes,
        routingRules: appliedRules,
        processingWorkflow,
        estimatedProcessingTime,
        metadata: {
          routingTime: Date.now() - startTime,
          rulesEvaluated: this.routingRules.filter(r => r.enabled).length,
          routerVersion: '2.0.0'
        }
      };

      // Store routing history
      const documentId = documentData.documentId || 'unknown';
      if (!this.routingHistory.has(documentId)) {
        this.routingHistory.set(documentId, []);
      }
      this.routingHistory.get(documentId)!.push(result);

      // Update rule usage statistics
      appliedRules.forEach(rule => {
        const ruleConfig = this.routingRules.find(r => r.id === rule.ruleId);
        if (ruleConfig) {
          ruleConfig.metadata.usageCount++;
        }
      });

      this.emit('documentRouted', {
        documentId,
        destination: routingDecision.destination.name,
        priority: routingDecision.priority,
        confidence,
        estimatedProcessingTime,
        routingTime: result.metadata.routingTime
      });

      return result;

    } catch (error) {
      this.emit('routingError', { error: error.message });
      throw new Error(`Document routing failed: ${error.message}`);
    }
  }

  private async evaluateRoutingRules(context: any): Promise<AppliedRule[]> {
    const appliedRules: AppliedRule[] = [];

    // Sort rules by priority
    const sortedRules = this.routingRules
      .filter(rule => rule.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
      const ruleResult = await this.evaluateRule(rule, context);
      appliedRules.push(ruleResult);
    }

    return appliedRules;
  }

  private async evaluateRule(rule: RoutingRule, context: any): Promise<AppliedRule> {
    let totalWeight = 0;
    let satisfiedWeight = 0;
    const evaluatedConditions: RuleCondition[] = [];

    for (const condition of rule.conditions) {
      const satisfied = this.evaluateCondition(condition, context);
      totalWeight += condition.weight;
      
      if (satisfied) {
        satisfiedWeight += condition.weight;
      }

      evaluatedConditions.push({
        ...condition,
        satisfied
      } as any);
    }

    const confidence = totalWeight > 0 ? satisfiedWeight / totalWeight : 0;
    const triggered = confidence >= 0.7; // 70% threshold for rule triggering

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      category: rule.category,
      triggered,
      confidence,
      conditions: evaluatedConditions,
      actions: rule.actions
    };
  }

  private evaluateCondition(condition: RuleCondition, context: any): boolean {
    const fieldValue = this.getFieldValue(context, condition.field);
    
    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
        
      case 'contains':
        return typeof fieldValue === 'string' && fieldValue.includes(condition.value);
        
      case 'greater_than':
        return Number(fieldValue) > Number(condition.value);
        
      case 'less_than':
        return Number(fieldValue) < Number(condition.value);
        
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(fieldValue);
        
      case 'regex':
        return new RegExp(condition.value).test(String(fieldValue));
        
      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;
        
      default:
        return false;
    }
  }

  private getFieldValue(context: any, fieldPath: string): any {
    const parts = fieldPath.split('.');
    let value = context;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  private async determineRoutingDecision(
    context: any,
    appliedRules: AppliedRule[]
  ): Promise<RoutingDecision> {
    
    // Find triggered rules and their actions
    const triggeredRules = appliedRules.filter(rule => rule.triggered);
    
    // Initialize default routing decision
    let routingDecision: RoutingDecision = {
      destination: {
        type: 'department',
        id: 'general_claims_department',
        name: 'General Claims Processing',
        description: 'Default processing department',
        capabilities: ['basic_processing'],
        currentLoad: 5,
        maxCapacity: 20,
        averageProcessingTime: 60
      },
      priority: 'normal',
      department: 'general_claims_department',
      processor: 'auto_assign',
      workflow: 'standard_processing_workflow',
      requiredCapabilities: ['basic_processing'],
      estimatedCompletionTime: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
      specialInstructions: []
    };

    // Apply actions from triggered rules (highest priority first)
    const sortedTriggeredRules = triggeredRules.sort((a, b) => b.confidence - a.confidence);
    
    for (const rule of sortedTriggeredRules) {
      for (const action of rule.actions) {
        routingDecision = await this.applyRuleAction(action, routingDecision, context);
      }
    }

    // Load balancing if no specific routing was determined
    if (routingDecision.processor === 'auto_assign') {
      routingDecision.processor = await this.selectOptimalProcessor(
        routingDecision.department,
        routingDecision.requiredCapabilities
      );
    }

    // Update destination details
    const department = this.departments.get(routingDecision.department);
    if (department) {
      routingDecision.destination = {
        type: 'department',
        id: department.id,
        name: department.name,
        description: department.description,
        capabilities: department.specialties,
        currentLoad: this.calculateDepartmentLoad(department),
        maxCapacity: this.calculateDepartmentCapacity(department),
        averageProcessingTime: this.calculateDepartmentAverageTime(department)
      };
    }

    return routingDecision;
  }

  private async applyRuleAction(
    action: RuleAction,
    decision: RoutingDecision,
    context: any
  ): Promise<RoutingDecision> {
    
    switch (action.type) {
      case 'route_to':
        if (this.departments.has(action.target)) {
          decision.department = action.target;
        }
        break;
        
      case 'set_priority':
        decision.priority = action.value as RoutingPriority;
        break;
        
      case 'assign_workflow':
        decision.workflow = action.value;
        break;
        
      case 'add_instruction':
        decision.specialInstructions.push(action.value);
        break;
        
      case 'notify':
        // Handle notification logic
        this.emit('notificationRequired', {
          target: action.target,
          message: action.value,
          context
        });
        break;
        
      case 'escalate':
        decision.priority = 'urgent';
        decision.specialInstructions.push(`Escalated: ${action.value}`);
        break;
    }

    return decision;
  }

  private async selectOptimalProcessor(
    departmentId: string,
    requiredCapabilities: string[]
  ): Promise<string> {
    
    const department = this.departments.get(departmentId);
    if (!department || department.processors.length === 0) {
      return 'manual_assignment_required';
    }

    // Filter processors by availability and capabilities
    const availableProcessors = department.processors.filter(processor => 
      processor.availability.status === 'available' &&
      processor.currentLoad < processor.maxCapacity &&
      this.hasRequiredCapabilities(processor, requiredCapabilities)
    );

    if (availableProcessors.length === 0) {
      return 'queue_for_next_available';
    }

    // Select processor with lowest current load and best performance
    const optimalProcessor = availableProcessors.reduce((best, current) => {
      const currentScore = this.calculateProcessorScore(current);
      const bestScore = this.calculateProcessorScore(best);
      return currentScore > bestScore ? current : best;
    });

    return optimalProcessor.id;
  }

  private hasRequiredCapabilities(processor: ProcessorInfo, requiredCapabilities: string[]): boolean {
    const processorCapabilities = processor.capabilities.map(cap => cap.name);
    return requiredCapabilities.every(required => 
      processorCapabilities.includes(required) || required === 'basic_processing'
    );
  }

  private calculateProcessorScore(processor: ProcessorInfo): number {
    const loadScore = 1 - (processor.currentLoad / processor.maxCapacity);
    const performanceScore = (
      processor.performance.qualityScore +
      processor.performance.completionRate +
      (1 - processor.performance.averageProcessingTime / 120) // Normalize against 2 hours
    ) / 3;

    return (loadScore * 0.4) + (performanceScore * 0.6);
  }

  private async calculateAlternativeRoutes(
    context: any,
    primaryDecision: RoutingDecision
  ): Promise<RoutingDecision[]> {
    
    const alternatives: RoutingDecision[] = [];
    
    // Find alternative departments with relevant capabilities
    for (const [deptId, dept] of this.departments.entries()) {
      if (deptId === primaryDecision.department) continue;
      
      // Check if department can handle the document type
      const canHandle = this.canDepartmentHandle(dept, context.documentType);
      if (canHandle) {
        alternatives.push({
          ...primaryDecision,
          destination: {
            type: 'department',
            id: dept.id,
            name: dept.name,
            description: dept.description,
            capabilities: dept.specialties,
            currentLoad: this.calculateDepartmentLoad(dept),
            maxCapacity: this.calculateDepartmentCapacity(dept),
            averageProcessingTime: this.calculateDepartmentAverageTime(dept)
          },
          department: dept.id,
          estimatedCompletionTime: this.calculateAlternativeCompletionTime(dept, primaryDecision.priority)
        });
      }
    }

    // Sort by capacity and performance
    return alternatives
      .sort((a, b) => {
        const scoreA = (a.destination.maxCapacity - a.destination.currentLoad) / a.destination.averageProcessingTime;
        const scoreB = (b.destination.maxCapacity - b.destination.currentLoad) / b.destination.averageProcessingTime;
        return scoreB - scoreA;
      })
      .slice(0, 3); // Return top 3 alternatives
  }

  private canDepartmentHandle(department: DepartmentConfig, documentType: string): boolean {
    const typeMapping: Record<string, string[]> = {
      'medical_bill': ['medical_bills', 'insurance_claims', 'routine_processing'],
      'prescription': ['prescription_review', 'medication_verification'],
      'lab_result': ['medical_review', 'clinical_assessment'],
      'unknown': ['routine_processing', 'basic_processing']
    };

    const requiredSpecialties = typeMapping[documentType] || ['routine_processing'];
    return requiredSpecialties.some(specialty => department.specialties.includes(specialty));
  }

  private async getProcessingWorkflow(workflowName: string): Promise<WorkflowStep[]> {
    return this.workflowTemplates.get(workflowName) || 
           this.workflowTemplates.get('standard_processing_workflow') || [];
  }

  private calculateEstimatedProcessingTime(
    workflow: WorkflowStep[],
    priority: RoutingPriority,
    destination: RoutingDestination
  ): number {
    
    const baseTime = workflow.reduce((total, step) => total + step.estimatedDuration, 0);
    
    // Apply priority multipliers
    const priorityMultipliers = {
      urgent: 0.5,
      high: 0.7,
      normal: 1.0,
      low: 1.5
    };

    // Apply load factor
    const loadFactor = Math.max(1, destination.currentLoad / destination.maxCapacity);
    
    return Math.round(baseTime * priorityMultipliers[priority] * loadFactor);
  }

  private calculateRoutingConfidence(
    appliedRules: AppliedRule[],
    decision: RoutingDecision
  ): number {
    
    const triggeredRules = appliedRules.filter(rule => rule.triggered);
    
    if (triggeredRules.length === 0) {
      return 0.5; // Default confidence for automatic routing
    }

    const avgConfidence = triggeredRules.reduce((sum, rule) => sum + rule.confidence, 0) / triggeredRules.length;
    
    // Boost confidence if multiple rules agree
    const consensusBonus = Math.min(0.2, (triggeredRules.length - 1) * 0.05);
    
    return Math.min(1, avgConfidence + consensusBonus);
  }

  private calculateDepartmentLoad(department: DepartmentConfig): number {
    return department.processors.reduce((total, processor) => total + processor.currentLoad, 0);
  }

  private calculateDepartmentCapacity(department: DepartmentConfig): number {
    return department.processors.reduce((total, processor) => total + processor.maxCapacity, 0);
  }

  private calculateDepartmentAverageTime(department: DepartmentConfig): number {
    if (department.processors.length === 0) return 60;
    
    const totalTime = department.processors.reduce(
      (total, processor) => total + processor.performance.averageProcessingTime,
      0
    );
    
    return totalTime / department.processors.length;
  }

  private calculateAlternativeCompletionTime(
    department: DepartmentConfig,
    priority: RoutingPriority
  ): Date {
    
    const slaMinutes = department.slaTargets[priority];
    return new Date(Date.now() + slaMinutes * 60 * 1000);
  }

  // Batch routing
  async routeBatch(
    documents: Array<{
      documentData: any;
      extractedData: any;
      qualityAssessment?: any;
      fraudAssessment?: any;
    }>
  ): Promise<RoutingResult[]> {
    
    const results = await Promise.all(
      documents.map(doc => 
        this.routeDocument(
          doc.documentData,
          doc.extractedData,
          doc.qualityAssessment,
          doc.fraudAssessment
        )
      )
    );

    this.emit('batchRoutingCompleted', {
      totalDocuments: documents.length,
      routingDistribution: this.calculateRoutingDistribution(results),
      averageConfidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length
    });

    return results;
  }

  private calculateRoutingDistribution(results: RoutingResult[]): Record<string, number> {
    return results.reduce((distribution, result) => {
      const dept = result.routingDecision.department;
      distribution[dept] = (distribution[dept] || 0) + 1;
      return distribution;
    }, {} as Record<string, number>);
  }

  // Rule management
  async addRoutingRule(rule: RoutingRule): Promise<void> {
    this.routingRules.push({
      ...rule,
      metadata: {
        createdAt: new Date(),
        lastModified: new Date(),
        usageCount: 0,
        successRate: 0
      }
    });
    
    this.emit('ruleAdded', { ruleId: rule.id, ruleName: rule.name });
  }

  async updateRoutingRule(ruleId: string, updates: Partial<RoutingRule>): Promise<void> {
    const ruleIndex = this.routingRules.findIndex(r => r.id === ruleId);
    if (ruleIndex >= 0) {
      this.routingRules[ruleIndex] = {
        ...this.routingRules[ruleIndex],
        ...updates,
        metadata: {
          ...this.routingRules[ruleIndex].metadata,
          lastModified: new Date()
        }
      };
      
      this.emit('ruleUpdated', { ruleId });
    }
  }

  // Configuration
  getDepartments(): DepartmentConfig[] {
    return Array.from(this.departments.values());
  }

  getRoutingRules(): RoutingRule[] {
    return [...this.routingRules];
  }

  getWorkflowTemplates(): Map<string, WorkflowStep[]> {
    return new Map(this.workflowTemplates);
  }

  // Analytics
  getRoutingStatistics(): any {
    const allResults = Array.from(this.routingHistory.values()).flat();
    
    if (allResults.length === 0) {
      return { totalRoutings: 0 };
    }

    const departmentDistribution = this.calculateRoutingDistribution(allResults);
    const avgConfidence = allResults.reduce((sum, r) => sum + r.confidence, 0) / allResults.length;
    const avgRoutingTime = allResults.reduce((sum, r) => sum + r.metadata.routingTime, 0) / allResults.length;

    const priorityDistribution = allResults.reduce((dist, result) => {
      const priority = result.routingDecision.priority;
      dist[priority] = (dist[priority] || 0) + 1;
      return dist;
    }, {} as Record<string, number>);

    return {
      totalRoutings: allResults.length,
      departmentDistribution,
      priorityDistribution,
      averageConfidence: avgConfidence,
      averageRoutingTime: avgRoutingTime,
      ruleUsageStats: this.routingRules.map(rule => ({
        ruleName: rule.name,
        usageCount: rule.metadata.usageCount,
        successRate: rule.metadata.successRate
      }))
    };
  }
}
