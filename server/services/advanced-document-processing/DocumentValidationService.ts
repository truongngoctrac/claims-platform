import { EventEmitter } from 'events';

export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  score: number;
  validationChecks: ValidationCheck[];
  errors: ValidationError[];
  warnings: ValidationWarning[];
  recommendations: ValidationRecommendation[];
  metadata: {
    processingTime: number;
    validatorVersion: string;
    checksPerformed: number;
  };
}

export interface ValidationCheck {
  checkName: string;
  category: ValidationCategory;
  status: 'passed' | 'failed' | 'warning' | 'skipped';
  confidence: number;
  details: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
}

export interface ValidationError {
  code: string;
  category: ValidationCategory;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  field?: string;
  expectedValue?: any;
  actualValue?: any;
  suggestions: string[];
}

export interface ValidationWarning {
  code: string;
  category: ValidationCategory;
  message: string;
  field?: string;
  suggestion: string;
}

export interface ValidationRecommendation {
  type: 'quality_improvement' | 'data_correction' | 'process_optimization';
  priority: number;
  description: string;
  actionItems: string[];
}

export type ValidationCategory = 
  | 'authenticity'
  | 'completeness'
  | 'consistency'
  | 'format'
  | 'business_rules'
  | 'regulatory_compliance'
  | 'data_quality'
  | 'security';

export interface ValidationRule {
  name: string;
  category: ValidationCategory;
  description: string;
  enabled: boolean;
  priority: number;
  validator: (document: any, extractedData: any, metadata: any) => Promise<ValidationCheck>;
  dependencies?: string[];
}

export interface BusinessRule {
  name: string;
  description: string;
  condition: (data: any) => boolean;
  errorMessage: string;
  severity: ValidationError['severity'];
}

export class DocumentValidationService extends EventEmitter {
  private validationRules: Map<string, ValidationRule[]> = new Map();
  private businessRules: Map<string, BusinessRule[]> = new Map();
  private validationHistory: Map<string, ValidationResult[]> = new Map();
  private validatorVersion = '2.1.0';

  constructor() {
    super();
    this.initializeValidationRules();
    this.initializeBusinessRules();
  }

  private initializeValidationRules(): void {
    // Medical Bill Validation Rules
    const medicalBillRules: ValidationRule[] = [
      {
        name: 'hospital_name_authenticity',
        category: 'authenticity',
        description: 'Validate hospital name against registered healthcare providers',
        enabled: true,
        priority: 1,
        validator: async (document, extractedData, metadata) => {
          const hospitalName = extractedData.hospitalName;
          const isValid = await this.validateHospitalName(hospitalName);
          
          return {
            checkName: 'hospital_name_authenticity',
            category: 'authenticity',
            status: isValid ? 'passed' : 'failed',
            confidence: isValid ? 0.95 : 0.1,
            details: isValid 
              ? `Hospital name "${hospitalName}" is verified`
              : `Hospital name "${hospitalName}" not found in registry`,
            impact: 'critical'
          };
        }
      },
      {
        name: 'bill_number_format',
        category: 'format',
        description: 'Validate bill number format compliance',
        enabled: true,
        priority: 2,
        validator: async (document, extractedData, metadata) => {
          const billNumber = extractedData.billNumber;
          const isValidFormat = /^[A-Z]{2,4}\d{6,12}$/.test(billNumber);
          
          return {
            checkName: 'bill_number_format',
            category: 'format',
            status: isValidFormat ? 'passed' : 'failed',
            confidence: 0.9,
            details: isValidFormat 
              ? `Bill number format is valid: ${billNumber}`
              : `Bill number format is invalid: ${billNumber}`,
            impact: 'high'
          };
        }
      },
      {
        name: 'amount_consistency',
        category: 'consistency',
        description: 'Validate amount calculations and consistency',
        enabled: true,
        priority: 2,
        validator: async (document, extractedData, metadata) => {
          const services = extractedData.services || [];
          const totalAmount = extractedData.totalAmount;
          
          if (!Array.isArray(services) || services.length === 0) {
            return {
              checkName: 'amount_consistency',
              category: 'consistency',
              status: 'skipped',
              confidence: 0,
              details: 'No services data available for amount validation',
              impact: 'medium'
            };
          }

          const calculatedTotal = services.reduce((sum: number, service: any) => {
            const amount = parseFloat(service.total?.toString().replace(/[^0-9.]/g, '') || '0');
            return sum + amount;
          }, 0);

          const declaredTotal = parseFloat(totalAmount?.toString().replace(/[^0-9.]/g, '') || '0');
          const difference = Math.abs(calculatedTotal - declaredTotal);
          const tolerance = declaredTotal * 0.02; // 2% tolerance

          const isConsistent = difference <= tolerance;

          return {
            checkName: 'amount_consistency',
            category: 'consistency',
            status: isConsistent ? 'passed' : 'failed',
            confidence: isConsistent ? 0.95 : 0.3,
            details: isConsistent 
              ? `Amount calculation is consistent (diff: ${difference.toFixed(2)})`
              : `Amount mismatch: calculated ${calculatedTotal}, declared ${declaredTotal}`,
            impact: 'high'
          };
        }
      },
      {
        name: 'date_validity',
        category: 'data_quality',
        description: 'Validate date fields for logical consistency',
        enabled: true,
        priority: 3,
        validator: async (document, extractedData, metadata) => {
          const billDate = new Date(extractedData.billDate);
          const now = new Date();
          const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          const futureLimit = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day future

          const isValid = billDate >= oneYearAgo && billDate <= futureLimit;

          return {
            checkName: 'date_validity',
            category: 'data_quality',
            status: isValid ? 'passed' : 'failed',
            confidence: 0.9,
            details: isValid 
              ? `Bill date is within valid range: ${billDate.toDateString()}`
              : `Bill date is outside valid range: ${billDate.toDateString()}`,
            impact: 'medium'
          };
        }
      },
      {
        name: 'required_fields_completeness',
        category: 'completeness',
        description: 'Check if all required fields are present',
        enabled: true,
        priority: 1,
        validator: async (document, extractedData, metadata) => {
          const requiredFields = ['hospitalName', 'billNumber', 'billDate', 'patientName', 'totalAmount'];
          const missingFields = requiredFields.filter(field => !extractedData[field]);

          const isComplete = missingFields.length === 0;

          return {
            checkName: 'required_fields_completeness',
            category: 'completeness',
            status: isComplete ? 'passed' : 'failed',
            confidence: 0.95,
            details: isComplete 
              ? 'All required fields are present'
              : `Missing required fields: ${missingFields.join(', ')}`,
            impact: 'critical'
          };
        }
      },
      {
        name: 'insurance_compliance',
        category: 'regulatory_compliance',
        description: 'Validate compliance with Vietnamese health insurance regulations',
        enabled: true,
        priority: 2,
        validator: async (document, extractedData, metadata) => {
          // Check if services are covered under BHYT (Vietnamese social health insurance)
          const services = extractedData.services || [];
          const hasInsuranceInfo = extractedData.insuranceCard || extractedData.bhytNumber;

          if (!hasInsuranceInfo) {
            return {
              checkName: 'insurance_compliance',
              category: 'regulatory_compliance',
              status: 'warning',
              confidence: 0.7,
              details: 'No insurance information found - patient may be paying out of pocket',
              impact: 'low'
            };
          }

          // Mock compliance check
          const isCompliant = Math.random() > 0.1; // 90% compliance rate

          return {
            checkName: 'insurance_compliance',
            category: 'regulatory_compliance',
            status: isCompliant ? 'passed' : 'failed',
            confidence: 0.85,
            details: isCompliant 
              ? 'Services comply with insurance regulations'
              : 'Some services may not be covered by insurance',
            impact: 'medium'
          };
        }
      }
    ];

    // Prescription Validation Rules
    const prescriptionRules: ValidationRule[] = [
      {
        name: 'doctor_license_verification',
        category: 'authenticity',
        description: 'Verify doctor license and prescription authority',
        enabled: true,
        priority: 1,
        validator: async (document, extractedData, metadata) => {
          const doctorName = extractedData.doctorName;
          const isVerified = await this.verifyDoctorLicense(doctorName);

          return {
            checkName: 'doctor_license_verification',
            category: 'authenticity',
            status: isVerified ? 'passed' : 'failed',
            confidence: isVerified ? 0.9 : 0.2,
            details: isVerified 
              ? `Doctor "${doctorName}" license verified`
              : `Cannot verify license for doctor "${doctorName}"`,
            impact: 'critical'
          };
        }
      },
      {
        name: 'medication_safety_check',
        category: 'business_rules',
        description: 'Check medication dosages and potential interactions',
        enabled: true,
        priority: 1,
        validator: async (document, extractedData, metadata) => {
          const medications = extractedData.medications || [];
          const safetyIssues = await this.checkMedicationSafety(medications);

          const isSafe = safetyIssues.length === 0;

          return {
            checkName: 'medication_safety_check',
            category: 'business_rules',
            status: isSafe ? 'passed' : 'failed',
            confidence: 0.95,
            details: isSafe 
              ? 'No medication safety issues detected'
              : `Safety issues found: ${safetyIssues.join(', ')}`,
            impact: 'critical'
          };
        }
      },
      {
        name: 'prescription_format_validation',
        category: 'format',
        description: 'Validate prescription format according to Ministry of Health standards',
        enabled: true,
        priority: 2,
        validator: async (document, extractedData, metadata) => {
          const hasRequiredSections = !!(
            extractedData.doctorName &&
            extractedData.patientName &&
            extractedData.prescriptionDate &&
            extractedData.medications
          );

          return {
            checkName: 'prescription_format_validation',
            category: 'format',
            status: hasRequiredSections ? 'passed' : 'failed',
            confidence: 0.9,
            details: hasRequiredSections 
              ? 'Prescription format meets MoH standards'
              : 'Prescription format does not meet required standards',
            impact: 'high'
          };
        }
      }
    ];

    // Lab Result Validation Rules
    const labResultRules: ValidationRule[] = [
      {
        name: 'lab_accreditation_check',
        category: 'authenticity',
        description: 'Verify laboratory accreditation and certification',
        enabled: true,
        priority: 1,
        validator: async (document, extractedData, metadata) => {
          const labName = extractedData.labName;
          const isAccredited = await this.verifyLabAccreditation(labName);

          return {
            checkName: 'lab_accreditation_check',
            category: 'authenticity',
            status: isAccredited ? 'passed' : 'failed',
            confidence: isAccredited ? 0.95 : 0.3,
            details: isAccredited 
              ? `Laboratory "${labName}" is accredited`
              : `Cannot verify accreditation for "${labName}"`,
            impact: 'high'
          };
        }
      },
      {
        name: 'reference_range_validation',
        category: 'data_quality',
        description: 'Validate test values against standard reference ranges',
        enabled: true,
        priority: 2,
        validator: async (document, extractedData, metadata) => {
          const results = extractedData.results || [];
          const abnormalResults = this.checkReferenceRanges(results);

          return {
            checkName: 'reference_range_validation',
            category: 'data_quality',
            status: abnormalResults.length === 0 ? 'passed' : 'warning',
            confidence: 0.85,
            details: abnormalResults.length === 0 
              ? 'All test values are within normal ranges'
              : `Abnormal results detected: ${abnormalResults.join(', ')}`,
            impact: 'medium'
          };
        }
      }
    ];

    this.validationRules.set('medical_bill', medicalBillRules);
    this.validationRules.set('prescription', prescriptionRules);
    this.validationRules.set('lab_result', labResultRules);
  }

  private initializeBusinessRules(): void {
    // Medical Bill Business Rules
    const medicalBillBusinessRules: BusinessRule[] = [
      {
        name: 'maximum_bill_amount',
        description: 'Bill amount should not exceed reasonable limits',
        condition: (data) => {
          const amount = parseFloat(data.totalAmount?.toString().replace(/[^0-9.]/g, '') || '0');
          return amount <= 100000000; // 100 million VND
        },
        errorMessage: 'Bill amount exceeds maximum reasonable limit',
        severity: 'high'
      },
      {
        name: 'minimum_bill_amount',
        description: 'Bill amount should be above minimum service charge',
        condition: (data) => {
          const amount = parseFloat(data.totalAmount?.toString().replace(/[^0-9.]/g, '') || '0');
          return amount >= 10000; // 10,000 VND
        },
        errorMessage: 'Bill amount is below minimum service charge',
        severity: 'medium'
      },
      {
        name: 'patient_name_format',
        description: 'Patient name should follow Vietnamese naming conventions',
        condition: (data) => {
          const name = data.patientName;
          return name && /^[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+(?:\s[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+)*$/.test(name);
        },
        errorMessage: 'Patient name format does not follow Vietnamese naming conventions',
        severity: 'low'
      }
    ];

    // Prescription Business Rules
    const prescriptionBusinessRules: BusinessRule[] = [
      {
        name: 'prescription_validity_period',
        description: 'Prescription should be issued within valid time period',
        condition: (data) => {
          const prescriptionDate = new Date(data.prescriptionDate);
          const now = new Date();
          const daysDiff = (now.getTime() - prescriptionDate.getTime()) / (1000 * 60 * 60 * 24);
          return daysDiff <= 30; // Valid for 30 days
        },
        errorMessage: 'Prescription has expired (valid for 30 days)',
        severity: 'high'
      },
      {
        name: 'controlled_substance_check',
        description: 'Controlled substances require special authorization',
        condition: (data) => {
          const medications = data.medications || [];
          const controlledSubstances = ['morphine', 'fentanyl', 'tramadol'];
          
          const hasControlled = medications.some((med: any) => 
            controlledSubstances.some(cs => 
              med.name?.toLowerCase().includes(cs)
            )
          );

          // If controlled substances present, check for special authorization
          return !hasControlled || data.specialAuthorization;
        },
        errorMessage: 'Controlled substances require special authorization',
        severity: 'critical'
      }
    ];

    this.businessRules.set('medical_bill', medicalBillBusinessRules);
    this.businessRules.set('prescription', prescriptionBusinessRules);
  }

  async validateDocument(
    documentType: string,
    documentBuffer: Buffer,
    extractedData: any,
    metadata: any = {}
  ): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      const validationChecks: ValidationCheck[] = [];
      const errors: ValidationError[] = [];
      const warnings: ValidationWarning[] = [];
      const recommendations: ValidationRecommendation[] = [];

      // Get validation rules for document type
      const rules = this.validationRules.get(documentType) || [];
      const businessRules = this.businessRules.get(documentType) || [];

      // Run validation rules
      for (const rule of rules.filter(r => r.enabled).sort((a, b) => a.priority - b.priority)) {
        try {
          const checkResult = await rule.validator(documentBuffer, extractedData, metadata);
          validationChecks.push(checkResult);

          if (checkResult.status === 'failed') {
            errors.push({
              code: `${rule.category.toUpperCase()}_${rule.name.toUpperCase()}`,
              category: rule.category,
              severity: this.mapImpactToSeverity(checkResult.impact),
              message: checkResult.details,
              suggestions: await this.generateSuggestions(rule, checkResult, extractedData)
            });
          } else if (checkResult.status === 'warning') {
            warnings.push({
              code: `${rule.category.toUpperCase()}_${rule.name.toUpperCase()}`,
              category: rule.category,
              message: checkResult.details,
              suggestion: await this.generateSuggestion(rule, checkResult, extractedData)
            });
          }
        } catch (error) {
          // Log rule execution error but continue validation
          validationChecks.push({
            checkName: rule.name,
            category: rule.category,
            status: 'skipped',
            confidence: 0,
            details: `Error executing rule: ${error.message}`,
            impact: 'low'
          });
        }
      }

      // Run business rules
      for (const businessRule of businessRules) {
        try {
          const isValid = businessRule.condition(extractedData);
          
          validationChecks.push({
            checkName: businessRule.name,
            category: 'business_rules',
            status: isValid ? 'passed' : 'failed',
            confidence: 0.9,
            details: isValid ? 'Business rule satisfied' : businessRule.errorMessage,
            impact: this.mapSeverityToImpact(businessRule.severity)
          });

          if (!isValid) {
            errors.push({
              code: `BUSINESS_RULE_${businessRule.name.toUpperCase()}`,
              category: 'business_rules',
              severity: businessRule.severity,
              message: businessRule.errorMessage,
              suggestions: await this.generateBusinessRuleSuggestions(businessRule, extractedData)
            });
          }
        } catch (error) {
          // Log business rule execution error
          validationChecks.push({
            checkName: businessRule.name,
            category: 'business_rules',
            status: 'skipped',
            confidence: 0,
            details: `Error executing business rule: ${error.message}`,
            impact: 'low'
          });
        }
      }

      // Generate recommendations
      recommendations.push(...await this.generateRecommendations(validationChecks, errors, extractedData));

      // Calculate overall validation score and confidence
      const { score, confidence } = this.calculateValidationScore(validationChecks, errors);
      const isValid = errors.filter(e => e.severity === 'critical' || e.severity === 'high').length === 0;

      const result: ValidationResult = {
        isValid,
        confidence,
        score,
        validationChecks,
        errors,
        warnings,
        recommendations,
        metadata: {
          processingTime: Date.now() - startTime,
          validatorVersion: this.validatorVersion,
          checksPerformed: validationChecks.length
        }
      };

      // Store validation history
      if (!this.validationHistory.has(documentType)) {
        this.validationHistory.set(documentType, []);
      }
      this.validationHistory.get(documentType)!.push(result);

      this.emit('documentValidated', {
        documentType,
        isValid,
        score,
        confidence,
        errorsCount: errors.length,
        warningsCount: warnings.length,
        processingTime: result.metadata.processingTime
      });

      return result;

    } catch (error) {
      this.emit('validationError', { error: error.message, documentType });
      throw new Error(`Document validation failed: ${error.message}`);
    }
  }

  private async validateHospitalName(hospitalName: string): Promise<boolean> {
    // Mock hospital registry check
    const registeredHospitals = [
      'bệnh viện bạch mai',
      'bệnh viện việt đức',
      'bệnh viện k',
      'bệnh viện e',
      'phòng khám đa khoa medlatec',
      'bệnh viện đại học y hà nội'
    ];

    return registeredHospitals.some(hospital => 
      hospitalName.toLowerCase().includes(hospital) || 
      hospital.includes(hospitalName.toLowerCase())
    );
  }

  private async verifyDoctorLicense(doctorName: string): Promise<boolean> {
    // Mock doctor license verification
    return Math.random() > 0.05; // 95% verification rate
  }

  private async verifyLabAccreditation(labName: string): Promise<boolean> {
    // Mock lab accreditation check
    return Math.random() > 0.1; // 90% accreditation rate
  }

  private async checkMedicationSafety(medications: any[]): Promise<string[]> {
    const safetyIssues: string[] = [];
    
    // Mock medication safety checks
    if (Array.isArray(medications)) {
      medications.forEach((med, index) => {
        // Check for dangerous dosages
        if (med.dosage && /(\d+)mg/.test(med.dosage)) {
          const dosage = parseInt(med.dosage.match(/(\d+)mg/)[1]);
          if (dosage > 1000) {
            safetyIssues.push(`High dosage detected for ${med.name}: ${med.dosage}`);
          }
        }

        // Check for drug interactions (simplified)
        if (med.name?.toLowerCase().includes('warfarin') && 
            medications.some(m => m.name?.toLowerCase().includes('aspirin'))) {
          safetyIssues.push('Potential interaction between warfarin and aspirin');
        }
      });
    }

    return safetyIssues;
  }

  private checkReferenceRanges(results: any[]): string[] {
    const abnormalResults: string[] = [];
    
    if (Array.isArray(results)) {
      results.forEach(result => {
        if (result.test && result.value && result.reference) {
          // Simple range check (mock implementation)
          const value = parseFloat(result.value);
          const referenceMatch = result.reference.match(/(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)/);
          
          if (referenceMatch && !isNaN(value)) {
            const min = parseFloat(referenceMatch[1]);
            const max = parseFloat(referenceMatch[2]);
            
            if (value < min || value > max) {
              abnormalResults.push(`${result.test}: ${result.value} (normal: ${result.reference})`);
            }
          }
        }
      });
    }

    return abnormalResults;
  }

  private mapImpactToSeverity(impact: string): ValidationError['severity'] {
    switch (impact) {
      case 'critical': return 'critical';
      case 'high': return 'high';
      case 'medium': return 'medium';
      case 'low': return 'low';
      default: return 'medium';
    }
  }

  private mapSeverityToImpact(severity: string): ValidationCheck['impact'] {
    switch (severity) {
      case 'critical': return 'critical';
      case 'high': return 'high';
      case 'medium': return 'medium';
      case 'low': return 'low';
      default: return 'medium';
    }
  }

  private async generateSuggestions(
    rule: ValidationRule,
    checkResult: ValidationCheck,
    extractedData: any
  ): Promise<string[]> {
    const suggestions: string[] = [];

    switch (rule.name) {
      case 'hospital_name_authenticity':
        suggestions.push('Verify hospital name with official healthcare provider registry');
        suggestions.push('Check for common spelling variations or abbreviations');
        break;
        
      case 'bill_number_format':
        suggestions.push('Ensure bill number follows format: [2-4 letters][6-12 digits]');
        suggestions.push('Verify with hospital billing system standards');
        break;
        
      case 'amount_consistency':
        suggestions.push('Recalculate total amount from itemized services');
        suggestions.push('Check for hidden fees or taxes not included in calculation');
        break;
        
      case 'date_validity':
        suggestions.push('Verify the bill date with the actual service date');
        suggestions.push('Check for transcription errors in date format');
        break;
        
      default:
        suggestions.push('Review the document for accuracy and completeness');
        suggestions.push('Contact the issuing organization for clarification');
    }

    return suggestions;
  }

  private async generateSuggestion(
    rule: ValidationRule,
    checkResult: ValidationCheck,
    extractedData: any
  ): Promise<string> {
    return 'Review and verify the identified information for accuracy';
  }

  private async generateBusinessRuleSuggestions(
    businessRule: BusinessRule,
    extractedData: any
  ): Promise<string[]> {
    const suggestions: string[] = [];

    switch (businessRule.name) {
      case 'maximum_bill_amount':
        suggestions.push('Verify the bill amount for accuracy');
        suggestions.push('Check if the amount includes multiple services or procedures');
        break;
        
      case 'prescription_validity_period':
        suggestions.push('Obtain a new prescription from the doctor');
        suggestions.push('Verify the prescription date is correct');
        break;
        
      case 'controlled_substance_check':
        suggestions.push('Obtain special authorization for controlled substances');
        suggestions.push('Verify doctor has authority to prescribe controlled substances');
        break;
        
      default:
        suggestions.push('Review business rule requirements and ensure compliance');
    }

    return suggestions;
  }

  private async generateRecommendations(
    validationChecks: ValidationCheck[],
    errors: ValidationError[],
    extractedData: any
  ): Promise<ValidationRecommendation[]> {
    const recommendations: ValidationRecommendation[] = [];

    // Quality improvement recommendations
    const qualityIssues = validationChecks.filter(check => 
      check.status === 'failed' && check.category === 'data_quality'
    );

    if (qualityIssues.length > 0) {
      recommendations.push({
        type: 'quality_improvement',
        priority: 1,
        description: 'Improve document scanning quality for better data extraction',
        actionItems: [
          'Use higher resolution scanner settings',
          'Ensure proper lighting when photographing documents',
          'Remove wrinkles and straighten documents before scanning'
        ]
      });
    }

    // Data correction recommendations
    const criticalErrors = errors.filter(error => error.severity === 'critical');
    if (criticalErrors.length > 0) {
      recommendations.push({
        type: 'data_correction',
        priority: 1,
        description: 'Critical data errors require immediate attention',
        actionItems: [
          'Manually review and correct critical data fields',
          'Contact document issuer for verification',
          'Re-scan document if OCR accuracy is insufficient'
        ]
      });
    }

    // Process optimization recommendations
    const failedChecks = validationChecks.filter(check => check.status === 'failed');
    if (failedChecks.length > 3) {
      recommendations.push({
        type: 'process_optimization',
        priority: 2,
        description: 'Multiple validation failures suggest process improvement opportunities',
        actionItems: [
          'Review document collection procedures',
          'Train staff on document quality requirements',
          'Implement pre-validation checks before document submission'
        ]
      });
    }

    return recommendations;
  }

  private calculateValidationScore(
    validationChecks: ValidationCheck[],
    errors: ValidationError[]
  ): { score: number; confidence: number } {
    
    if (validationChecks.length === 0) {
      return { score: 0, confidence: 0 };
    }

    // Calculate base score from passed checks
    const passedChecks = validationChecks.filter(check => check.status === 'passed');
    const baseScore = (passedChecks.length / validationChecks.length) * 100;

    // Apply penalties for errors
    let penalty = 0;
    errors.forEach(error => {
      switch (error.severity) {
        case 'critical': penalty += 25; break;
        case 'high': penalty += 15; break;
        case 'medium': penalty += 10; break;
        case 'low': penalty += 5; break;
      }
    });

    const score = Math.max(0, baseScore - penalty);

    // Calculate confidence based on check confidences
    const avgConfidence = validationChecks.reduce((sum, check) => sum + check.confidence, 0) / validationChecks.length;

    return { score, confidence: avgConfidence };
  }

  // Batch validation
  async validateBatch(
    documents: Array<{
      documentType: string;
      documentBuffer: Buffer;
      extractedData: any;
      metadata?: any;
    }>
  ): Promise<ValidationResult[]> {
    const results = await Promise.all(
      documents.map(doc => 
        this.validateDocument(
          doc.documentType,
          doc.documentBuffer,
          doc.extractedData,
          doc.metadata
        )
      )
    );

    this.emit('batchValidationCompleted', {
      totalDocuments: documents.length,
      validDocuments: results.filter(r => r.isValid).length,
      averageScore: results.reduce((sum, r) => sum + r.score, 0) / results.length,
      averageConfidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length
    });

    return results;
  }

  // Rule management
  async addValidationRule(documentType: string, rule: ValidationRule): Promise<void> {
    const rules = this.validationRules.get(documentType) || [];
    rules.push(rule);
    this.validationRules.set(documentType, rules);
    this.emit('ruleAdded', { documentType, ruleName: rule.name });
  }

  async enableRule(documentType: string, ruleName: string): Promise<void> {
    const rules = this.validationRules.get(documentType) || [];
    const rule = rules.find(r => r.name === ruleName);
    if (rule) {
      rule.enabled = true;
      this.emit('ruleEnabled', { documentType, ruleName });
    }
  }

  async disableRule(documentType: string, ruleName: string): Promise<void> {
    const rules = this.validationRules.get(documentType) || [];
    const rule = rules.find(r => r.name === ruleName);
    if (rule) {
      rule.enabled = false;
      this.emit('ruleDisabled', { documentType, ruleName });
    }
  }

  // Analytics
  getValidationStatistics(documentType?: string): any {
    let history = Array.from(this.validationHistory.values()).flat();
    
    if (documentType) {
      history = this.validationHistory.get(documentType) || [];
    }

    if (history.length === 0) {
      return { totalValidations: 0 };
    }

    const validDocuments = history.filter(r => r.isValid).length;
    const avgScore = history.reduce((sum, r) => sum + r.score, 0) / history.length;
    const avgConfidence = history.reduce((sum, r) => sum + r.confidence, 0) / history.length;
    const avgProcessingTime = history.reduce((sum, r) => sum + r.metadata.processingTime, 0) / history.length;

    // Error analysis
    const allErrors = history.flatMap(r => r.errors);
    const errorsByCategory = this.groupBy(allErrors, 'category');
    const errorsBySeverity = this.groupBy(allErrors, 'severity');

    return {
      totalValidations: history.length,
      validationRate: validDocuments / history.length,
      averageScore: avgScore,
      averageConfidence: avgConfidence,
      averageProcessingTime: avgProcessingTime,
      errorsByCategory,
      errorsBySeverity,
      commonErrorCodes: this.getTopErrorCodes(allErrors, 10)
    };
  }

  private groupBy(array: any[], key: string): Record<string, number> {
    return array.reduce((groups, item) => {
      const group = item[key];
      groups[group] = (groups[group] || 0) + 1;
      return groups;
    }, {});
  }

  private getTopErrorCodes(errors: ValidationError[], limit: number): Array<{ code: string; count: number }> {
    const counts = this.groupBy(errors, 'code');
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([code, count]) => ({ code, count }));
  }

  // Configuration
  getSupportedDocumentTypes(): string[] {
    return Array.from(this.validationRules.keys());
  }

  getValidationRules(documentType: string): ValidationRule[] {
    return this.validationRules.get(documentType) || [];
  }

  getBusinessRules(documentType: string): BusinessRule[] {
    return this.businessRules.get(documentType) || [];
  }
}
