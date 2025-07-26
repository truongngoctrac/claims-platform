import { EventEmitter } from 'events';

export interface ExtractionResult {
  documentType: string;
  extractedData: ExtractedData;
  confidence: number;
  fieldConfidences: Record<string, number>;
  processingTime: number;
  errors: ExtractionError[];
  warnings: ExtractionWarning[];
}

export interface ExtractedData {
  [fieldName: string]: any;
}

export interface ExtractionError {
  field: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ExtractionWarning {
  field: string;
  message: string;
  suggestedValue?: any;
}

export interface ExtractionTemplate {
  documentType: string;
  fields: FieldDefinition[];
  validationRules: ValidationRule[];
  postProcessingRules: PostProcessingRule[];
}

export interface FieldDefinition {
  name: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'email' | 'phone' | 'address' | 'boolean';
  required: boolean;
  patterns: ExtractionPattern[];
  validation?: FieldValidation;
  defaultValue?: any;
  dependencies?: string[];
}

export interface ExtractionPattern {
  type: 'regex' | 'position' | 'keyword' | 'table' | 'form';
  pattern: string | RegExp;
  context?: string[];
  priority: number;
  region?: { x: number; y: number; width: number; height: number };
}

export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  format?: RegExp;
  allowedValues?: any[];
  customValidator?: (value: any) => boolean;
}

export interface ValidationRule {
  name: string;
  description: string;
  check: (data: ExtractedData) => boolean;
  errorMessage: string;
}

export interface PostProcessingRule {
  field: string;
  action: 'normalize' | 'format' | 'calculate' | 'lookup' | 'transform';
  parameters: any;
}

export class DataExtractionService extends EventEmitter {
  private templates: Map<string, ExtractionTemplate> = new Map();
  private extractionHistory: Map<string, ExtractionResult[]> = new Map();

  constructor() {
    super();
    this.initializeTemplates();
  }

  private initializeTemplates(): void {
    // Medical Bill Template
    this.templates.set('medical_bill', {
      documentType: 'medical_bill',
      fields: [
        {
          name: 'hospitalName',
          type: 'text',
          required: true,
          patterns: [
            {
              type: 'regex',
              pattern: /(?:bệnh viện|phòng khám|trung tâm y tế)\s+([^\\n]+)/i,
              priority: 1
            }
          ]
        },
        {
          name: 'billNumber',
          type: 'text',
          required: true,
          patterns: [
            {
              type: 'regex',
              pattern: /(?:số hóa đơn|bill no|số|no)[:\s]+([A-Z0-9-]+)/i,
              priority: 1
            }
          ]
        },
        {
          name: 'billDate',
          type: 'date',
          required: true,
          patterns: [
            {
              type: 'regex',
              pattern: /(?:ngày|date)[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i,
              priority: 1
            },
            {
              type: 'regex',
              pattern: /(\d{1,2}\/\d{1,2}\/\d{4})/g,
              priority: 2
            }
          ]
        },
        {
          name: 'patientName',
          type: 'text',
          required: true,
          patterns: [
            {
              type: 'regex',
              pattern: /(?:bệnh nhân|patient|họ tên)[:\s]+([A-ZÀÁẠẢÃÂẦẤẬẨ��ĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+(?:\s[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+)*)/i,
              priority: 1
            }
          ]
        },
        {
          name: 'totalAmount',
          type: 'currency',
          required: true,
          patterns: [
            {
              type: 'regex',
              pattern: /(?:tổng cộng|total|thành tiền)[:\s]+([0-9.,]+)\s*(?:vnđ|vnd|đồng)/i,
              priority: 1
            },
            {
              type: 'regex',
              pattern: /([0-9.,]+)\s*(?:vnđ|vnd|đồng)/gi,
              priority: 2
            }
          ]
        },
        {
          name: 'services',
          type: 'text',
          required: false,
          patterns: [
            {
              type: 'table',
              pattern: 'services_table',
              priority: 1
            }
          ]
        }
      ],
      validationRules: [
        {
          name: 'date_validation',
          description: 'Bill date should be within reasonable range',
          check: (data) => {
            if (!data.billDate) return false;
            const date = new Date(data.billDate);
            const now = new Date();
            const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
            return date >= oneYearAgo && date <= now;
          },
          errorMessage: 'Bill date is outside reasonable range'
        },
        {
          name: 'amount_validation',
          description: 'Total amount should be positive',
          check: (data) => {
            return data.totalAmount && parseFloat(data.totalAmount.toString().replace(/[^0-9.]/g, '')) > 0;
          },
          errorMessage: 'Total amount must be positive'
        }
      ],
      postProcessingRules: [
        {
          field: 'totalAmount',
          action: 'normalize',
          parameters: { type: 'currency', locale: 'vi-VN' }
        },
        {
          field: 'billDate',
          action: 'format',
          parameters: { format: 'YYYY-MM-DD' }
        }
      ]
    });

    // Prescription Template
    this.templates.set('prescription', {
      documentType: 'prescription',
      fields: [
        {
          name: 'doctorName',
          type: 'text',
          required: true,
          patterns: [
            {
              type: 'regex',
              pattern: /(?:bác sĩ|bs|ths\.bs|pgs\.ts)[:\s]+([A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+(?:\s[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+)*)/i,
              priority: 1
            }
          ]
        },
        {
          name: 'patientName',
          type: 'text',
          required: true,
          patterns: [
            {
              type: 'regex',
              pattern: /(?:bệnh nhân|bn)[:\s]+([A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+(?:\s[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+)*)/i,
              priority: 1
            }
          ]
        },
        {
          name: 'prescriptionDate',
          type: 'date',
          required: true,
          patterns: [
            {
              type: 'regex',
              pattern: /(?:ngày kê đơn|ngày)[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i,
              priority: 1
            }
          ]
        },
        {
          name: 'medications',
          type: 'text',
          required: true,
          patterns: [
            {
              type: 'table',
              pattern: 'medication_table',
              priority: 1
            },
            {
              type: 'regex',
              pattern: /(\d+\.\s+[A-Za-z0-9\s]+\d+mg.*)/gm,
              priority: 2
            }
          ]
        },
        {
          name: 'diagnosis',
          type: 'text',
          required: false,
          patterns: [
            {
              type: 'regex',
              pattern: /(?:chẩn đoán|diagnosis)[:\s]+([^\\n]+)/i,
              priority: 1
            }
          ]
        }
      ],
      validationRules: [
        {
          name: 'prescription_date_validation',
          description: 'Prescription date should be recent',
          check: (data) => {
            if (!data.prescriptionDate) return false;
            const date = new Date(data.prescriptionDate);
            const now = new Date();
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            return date >= thirtyDaysAgo && date <= now;
          },
          errorMessage: 'Prescription date should be within the last 30 days'
        }
      ],
      postProcessingRules: [
        {
          field: 'medications',
          action: 'normalize',
          parameters: { type: 'medication_list' }
        }
      ]
    });

    // Lab Result Template
    this.templates.set('lab_result', {
      documentType: 'lab_result',
      fields: [
        {
          name: 'labName',
          type: 'text',
          required: true,
          patterns: [
            {
              type: 'regex',
              pattern: /(?:phòng xét nghiệm|xét nghiệm|laboratory)\s+([^\\n]+)/i,
              priority: 1
            }
          ]
        },
        {
          name: 'patientName',
          type: 'text',
          required: true,
          patterns: [
            {
              type: 'regex',
              pattern: /(?:bệnh nhân|patient)[:\s]+([A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+(?:\s[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+)*)/i,
              priority: 1
            }
          ]
        },
        {
          name: 'testDate',
          type: 'date',
          required: true,
          patterns: [
            {
              type: 'regex',
              pattern: /(?:ngày xét nghiệm|test date)[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i,
              priority: 1
            }
          ]
        },
        {
          name: 'results',
          type: 'text',
          required: true,
          patterns: [
            {
              type: 'table',
              pattern: 'test_results_table',
              priority: 1
            }
          ]
        }
      ],
      validationRules: [],
      postProcessingRules: [
        {
          field: 'results',
          action: 'normalize',
          parameters: { type: 'lab_results' }
        }
      ]
    });
  }

  async extractData(
    ocrText: string,
    documentType: string,
    options: { customTemplate?: ExtractionTemplate } = {}
  ): Promise<ExtractionResult> {
    const startTime = Date.now();
    
    try {
      // Get extraction template
      const template = options.customTemplate || this.templates.get(documentType);
      if (!template) {
        throw new Error(`No extraction template found for document type: ${documentType}`);
      }

      const extractedData: ExtractedData = {};
      const fieldConfidences: Record<string, number> = {};
      const errors: ExtractionError[] = [];
      const warnings: ExtractionWarning[] = [];

      // Extract each field
      for (const fieldDef of template.fields) {
        try {
          const result = await this.extractField(ocrText, fieldDef);
          
          if (result.value !== null) {
            extractedData[fieldDef.name] = result.value;
            fieldConfidences[fieldDef.name] = result.confidence;
          } else if (fieldDef.required) {
            errors.push({
              field: fieldDef.name,
              message: `Required field '${fieldDef.name}' not found`,
              severity: 'high'
            });
          } else if (fieldDef.defaultValue !== undefined) {
            extractedData[fieldDef.name] = fieldDef.defaultValue;
            fieldConfidences[fieldDef.name] = 0.5;
            warnings.push({
              field: fieldDef.name,
              message: `Using default value for '${fieldDef.name}'`,
              suggestedValue: fieldDef.defaultValue
            });
          }
        } catch (error) {
          errors.push({
            field: fieldDef.name,
            message: `Error extracting '${fieldDef.name}': ${error.message}`,
            severity: 'medium'
          });
        }
      }

      // Apply validation rules
      for (const rule of template.validationRules) {
        if (!rule.check(extractedData)) {
          errors.push({
            field: 'validation',
            message: rule.errorMessage,
            severity: 'medium'
          });
        }
      }

      // Apply post-processing rules
      for (const rule of template.postProcessingRules) {
        try {
          extractedData[rule.field] = await this.applyPostProcessing(
            extractedData[rule.field],
            rule
          );
        } catch (error) {
          warnings.push({
            field: rule.field,
            message: `Post-processing warning: ${error.message}`
          });
        }
      }

      // Calculate overall confidence
      const confidenceValues = Object.values(fieldConfidences);
      const overallConfidence = confidenceValues.length > 0 
        ? confidenceValues.reduce((sum, conf) => sum + conf, 0) / confidenceValues.length
        : 0;

      const result: ExtractionResult = {
        documentType,
        extractedData,
        confidence: overallConfidence,
        fieldConfidences,
        processingTime: Date.now() - startTime,
        errors,
        warnings
      };

      // Store extraction history
      if (!this.extractionHistory.has(documentType)) {
        this.extractionHistory.set(documentType, []);
      }
      this.extractionHistory.get(documentType)!.push(result);

      this.emit('dataExtracted', {
        documentType,
        confidence: overallConfidence,
        fieldsExtracted: Object.keys(extractedData).length,
        processingTime: result.processingTime
      });

      return result;

    } catch (error) {
      this.emit('extractionError', { error: error.message, documentType });
      throw new Error(`Data extraction failed: ${error.message}`);
    }
  }

  private async extractField(
    text: string,
    fieldDef: FieldDefinition
  ): Promise<{ value: any; confidence: number }> {
    
    let bestMatch: { value: any; confidence: number } = { value: null, confidence: 0 };

    // Try each extraction pattern in priority order
    const sortedPatterns = fieldDef.patterns.sort((a, b) => a.priority - b.priority);
    
    for (const pattern of sortedPatterns) {
      try {
        const result = await this.applyExtractionPattern(text, pattern, fieldDef.type);
        
        if (result.confidence > bestMatch.confidence) {
          bestMatch = result;
        }
        
        // If we found a high-confidence match, use it
        if (result.confidence > 0.9) {
          break;
        }
      } catch (error) {
        // Continue with next pattern
        continue;
      }
    }

    // Apply field validation if value found
    if (bestMatch.value && fieldDef.validation) {
      const isValid = this.validateField(bestMatch.value, fieldDef.validation);
      if (!isValid) {
        bestMatch.confidence *= 0.5; // Reduce confidence for invalid values
      }
    }

    // Apply type conversion and formatting
    if (bestMatch.value) {
      bestMatch.value = this.convertFieldType(bestMatch.value, fieldDef.type);
    }

    return bestMatch;
  }

  private async applyExtractionPattern(
    text: string,
    pattern: ExtractionPattern,
    fieldType: string
  ): Promise<{ value: any; confidence: number }> {
    
    switch (pattern.type) {
      case 'regex':
        return this.extractWithRegex(text, pattern.pattern as RegExp, fieldType);
        
      case 'keyword':
        return this.extractWithKeyword(text, pattern.pattern as string, fieldType);
        
      case 'position':
        return this.extractWithPosition(text, pattern, fieldType);
        
      case 'table':
        return this.extractFromTable(text, pattern.pattern as string, fieldType);
        
      case 'form':
        return this.extractFromForm(text, pattern.pattern as string, fieldType);
        
      default:
        throw new Error(`Unsupported pattern type: ${pattern.type}`);
    }
  }

  private extractWithRegex(
    text: string,
    pattern: string | RegExp,
    fieldType: string
  ): { value: any; confidence: number } {
    
    const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
    const matches = text.match(regex);
    
    if (!matches) {
      return { value: null, confidence: 0 };
    }

    // Use the first capture group if available, otherwise the full match
    const value = matches[1] || matches[0];
    
    // Calculate confidence based on match quality
    let confidence = 0.8;
    
    // Boost confidence for exact keyword matches
    if (fieldType === 'currency' && /\d+[.,]\d+.*(?:vnđ|vnd|đồng)/i.test(value)) {
      confidence = 0.95;
    } else if (fieldType === 'date' && /\d{1,2}\/\d{1,2}\/\d{4}/.test(value)) {
      confidence = 0.9;
    }

    return { value: value.trim(), confidence };
  }

  private extractWithKeyword(
    text: string,
    keyword: string,
    fieldType: string
  ): { value: any; confidence: number } {
    
    const lines = text.split('\n');
    
    for (const line of lines) {
      if (line.toLowerCase().includes(keyword.toLowerCase())) {
        // Extract value after the keyword
        const keywordIndex = line.toLowerCase().indexOf(keyword.toLowerCase());
        const valueStart = keywordIndex + keyword.length;
        const value = line.substring(valueStart).replace(/^[:\s]+/, '').trim();
        
        if (value) {
          return { value, confidence: 0.7 };
        }
      }
    }

    return { value: null, confidence: 0 };
  }

  private extractWithPosition(
    text: string,
    pattern: ExtractionPattern,
    fieldType: string
  ): { value: any; confidence: number } {
    
    // Mock position-based extraction
    // In real implementation, would use OCR bounding box coordinates
    return { value: null, confidence: 0 };
  }

  private extractFromTable(
    text: string,
    tableName: string,
    fieldType: string
  ): { value: any; confidence: number } {
    
    // Extract table data based on table structure patterns
    const lines = text.split('\n');
    const tableData: any[] = [];
    
    if (tableName === 'services_table') {
      // Look for service/item table patterns
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Pattern: Service name | Quantity | Unit price | Total
        if (/\d+[.,]\d+/.test(line) && line.includes('|') || line.includes('\t')) {
          const parts = line.split(/[|\t]/).map(p => p.trim());
          if (parts.length >= 3) {
            tableData.push({
              service: parts[0],
              quantity: parts[1],
              unitPrice: parts[2],
              total: parts[3] || ''
            });
          }
        }
      }
    } else if (tableName === 'medication_table') {
      // Extract medication information
      for (const line of lines) {
        if (/\d+\.\s*[A-Za-z]/.test(line)) {
          const medicationMatch = line.match(/(\d+)\.\s*([A-Za-z0-9\s]+)\s*(\d+mg|\d+ml)?\s*(.*)/);
          if (medicationMatch) {
            tableData.push({
              order: medicationMatch[1],
              name: medicationMatch[2].trim(),
              dosage: medicationMatch[3] || '',
              instructions: medicationMatch[4] || ''
            });
          }
        }
      }
    } else if (tableName === 'test_results_table') {
      // Extract lab test results
      for (const line of lines) {
        if (/[A-Za-z]+.*\d+[.,]?\d*/.test(line)) {
          const resultMatch = line.match(/([A-Za-z\s]+)[\s:]+(\d+[.,]?\d*)\s*([A-Za-z\/]+)?\s*\(([^)]+)\)?/);
          if (resultMatch) {
            tableData.push({
              test: resultMatch[1].trim(),
              value: resultMatch[2],
              unit: resultMatch[3] || '',
              reference: resultMatch[4] || ''
            });
          }
        }
      }
    }

    if (tableData.length > 0) {
      return { value: tableData, confidence: 0.85 };
    }

    return { value: null, confidence: 0 };
  }

  private extractFromForm(
    text: string,
    formPattern: string,
    fieldType: string
  ): { value: any; confidence: number } {
    
    // Mock form extraction - would analyze form field patterns
    return { value: null, confidence: 0 };
  }

  private validateField(value: any, validation: FieldValidation): boolean {
    if (validation.minLength && value.toString().length < validation.minLength) {
      return false;
    }
    
    if (validation.maxLength && value.toString().length > validation.maxLength) {
      return false;
    }
    
    if (validation.format && !validation.format.test(value.toString())) {
      return false;
    }
    
    if (validation.allowedValues && !validation.allowedValues.includes(value)) {
      return false;
    }
    
    if (validation.customValidator && !validation.customValidator(value)) {
      return false;
    }

    return true;
  }

  private convertFieldType(value: any, type: string): any {
    switch (type) {
      case 'number':
        return parseFloat(value.toString().replace(/[^0-9.-]/g, ''));
        
      case 'date':
        // Convert Vietnamese date format to ISO
        if (typeof value === 'string' && /\d{1,2}\/\d{1,2}\/\d{4}/.test(value)) {
          const [day, month, year] = value.split('/');
          return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        }
        return new Date(value);
        
      case 'currency':
        return parseFloat(value.toString().replace(/[^0-9.,]/g, '').replace(',', '.'));
        
      case 'boolean':
        const lowercaseValue = value.toString().toLowerCase();
        return ['true', 'yes', 'có', '1', 'x'].includes(lowercaseValue);
        
      case 'phone':
        // Format Vietnamese phone numbers
        return value.toString().replace(/[^0-9+]/g, '');
        
      default:
        return value.toString().trim();
    }
  }

  private async applyPostProcessing(
    value: any,
    rule: PostProcessingRule
  ): Promise<any> {
    
    switch (rule.action) {
      case 'normalize':
        return this.normalizeValue(value, rule.parameters);
        
      case 'format':
        return this.formatValue(value, rule.parameters);
        
      case 'calculate':
        return this.calculateValue(value, rule.parameters);
        
      case 'lookup':
        return this.lookupValue(value, rule.parameters);
        
      case 'transform':
        return this.transformValue(value, rule.parameters);
        
      default:
        return value;
    }
  }

  private normalizeValue(value: any, params: any): any {
    switch (params.type) {
      case 'currency':
        if (typeof value === 'number') {
          return new Intl.NumberFormat(params.locale || 'vi-VN', {
            style: 'currency',
            currency: 'VND'
          }).format(value);
        }
        return value;
        
      case 'medication_list':
        if (Array.isArray(value)) {
          return value.map(med => ({
            ...med,
            name: med.name?.trim(),
            dosage: med.dosage?.trim(),
            instructions: med.instructions?.trim()
          }));
        }
        return value;
        
      case 'lab_results':
        if (Array.isArray(value)) {
          return value.map(result => ({
            ...result,
            test: result.test?.trim(),
            value: parseFloat(result.value) || result.value,
            unit: result.unit?.trim(),
            reference: result.reference?.trim()
          }));
        }
        return value;
        
      default:
        return value;
    }
  }

  private formatValue(value: any, params: any): any {
    if (params.format && value instanceof Date) {
      // Simple date formatting
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      
      return params.format
        .replace('YYYY', year)
        .replace('MM', month)
        .replace('DD', day);
    }
    
    return value;
  }

  private calculateValue(value: any, params: any): any {
    // Mock calculation - would implement actual calculation logic
    return value;
  }

  private lookupValue(value: any, params: any): any {
    // Mock lookup - would implement database/API lookup
    return value;
  }

  private transformValue(value: any, params: any): any {
    // Mock transformation - would implement custom transformations
    return value;
  }

  // Template management
  async addExtractionTemplate(template: ExtractionTemplate): Promise<void> {
    this.templates.set(template.documentType, template);
    this.emit('templateAdded', { documentType: template.documentType });
  }

  async updateExtractionTemplate(
    documentType: string,
    updates: Partial<ExtractionTemplate>
  ): Promise<void> {
    const existing = this.templates.get(documentType);
    if (!existing) {
      throw new Error(`Template not found: ${documentType}`);
    }

    const updated = { ...existing, ...updates };
    this.templates.set(documentType, updated);
    this.emit('templateUpdated', { documentType });
  }

  getExtractionTemplate(documentType: string): ExtractionTemplate | undefined {
    return this.templates.get(documentType);
  }

  getSupportedDocumentTypes(): string[] {
    return Array.from(this.templates.keys());
  }

  // Batch processing
  async extractBatchData(
    documents: Array<{ ocrText: string; documentType: string; options?: any }>
  ): Promise<ExtractionResult[]> {
    const results = await Promise.all(
      documents.map(doc => this.extractData(doc.ocrText, doc.documentType, doc.options))
    );

    this.emit('batchExtractionCompleted', {
      totalDocuments: documents.length,
      averageConfidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length
    });

    return results;
  }

  // Analytics
  getExtractionStatistics(documentType?: string): any {
    let history = Array.from(this.extractionHistory.values()).flat();
    
    if (documentType) {
      history = this.extractionHistory.get(documentType) || [];
    }

    if (history.length === 0) {
      return { totalExtractions: 0 };
    }

    return {
      totalExtractions: history.length,
      averageConfidence: history.reduce((sum, r) => sum + r.confidence, 0) / history.length,
      averageProcessingTime: history.reduce((sum, r) => sum + r.processingTime, 0) / history.length,
      successRate: history.filter(r => r.errors.length === 0).length / history.length,
      commonErrors: this.getCommonErrors(history),
      fieldExtractionRates: this.getFieldExtractionRates(history)
    };
  }

  private getCommonErrors(history: ExtractionResult[]): any[] {
    const errorCounts = new Map<string, number>();
    
    history.forEach(result => {
      result.errors.forEach(error => {
        const key = `${error.field}: ${error.message}`;
        errorCounts.set(key, (errorCounts.get(key) || 0) + 1);
      });
    });

    return Array.from(errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([error, count]) => ({ error, count }));
  }

  private getFieldExtractionRates(history: ExtractionResult[]): any {
    const fieldCounts = new Map<string, { total: number; extracted: number }>();
    
    history.forEach(result => {
      Object.keys(result.fieldConfidences).forEach(field => {
        if (!fieldCounts.has(field)) {
          fieldCounts.set(field, { total: 0, extracted: 0 });
        }
        const counts = fieldCounts.get(field)!;
        counts.total++;
        if (result.extractedData[field] !== null && result.extractedData[field] !== undefined) {
          counts.extracted++;
        }
      });
    });

    const rates: any = {};
    fieldCounts.forEach((counts, field) => {
      rates[field] = counts.extracted / counts.total;
    });

    return rates;
  }
}
