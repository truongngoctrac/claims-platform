import { EventEmitter } from 'events';
import {
  AIComponent,
  ComponentStatus,
  PerformanceMetrics,
  ExtractionResult,
  NamedEntity,
  EntityRelationship,
  StructuredData,
  MedicalCode,
  ExtractedDate,
  ExtractedAmount,
  EntityType,
  RelationType,
  CodeSystem,
  DateType,
  AmountType,
  TextPosition,
  PatientInfo,
  ProviderInfo,
  ServiceInfo,
  BillingInfo,
  DiagnosisInfo,
  MedicationInfo,
  LabResult
} from '../models/interfaces';

export interface ExtractionModel {
  id: string;
  type: 'NER' | 'Relation' | 'Template' | 'Hybrid';
  language: string;
  domain: string;
  accuracy: number;
  entities: string[];
  relations: string[];
}

export interface ExtractionConfig {
  enableNER: boolean;
  enableRelationExtraction: boolean;
  enableTemplateMatching: boolean;
  enableMedicalCoding: boolean;
  enableDateNormalization: boolean;
  enableAmountNormalization: boolean;
  confidenceThreshold: number;
  language: string;
  documentType?: string;
}

export interface VietnameseNERModel {
  tokenizer: any;
  model: any;
  labelMap: Map<string, EntityType>;
  medicalVocabulary: Set<string>;
  personNamePatterns: RegExp[];
  locationPatterns: RegExp[];
}

export interface RelationExtractionModel {
  rules: RelationRule[];
  patterns: RelationPattern[];
  contextWindow: number;
  confidenceThreshold: number;
}

export interface RelationRule {
  id: string;
  name: string;
  sourceEntityType: EntityType;
  targetEntityType: EntityType;
  relationType: RelationType;
  patterns: string[];
  confidence: number;
}

export interface RelationPattern {
  pattern: RegExp;
  relationType: RelationType;
  sourceGroup: number;
  targetGroup: number;
  contextKeywords: string[];
}

export interface TemplateExtractor {
  documentType: string;
  requiredFields: TemplateField[];
  optionalFields: TemplateField[];
  patterns: ExtractionPattern[];
}

export interface TemplateField {
  name: string;
  type: 'string' | 'number' | 'date' | 'amount' | 'code';
  required: boolean;
  validation?: RegExp;
  normalization?: (value: string) => any;
}

export interface ExtractionPattern {
  fieldName: string;
  patterns: RegExp[];
  contextKeywords: string[];
  preprocessing?: (text: string) => string;
  postprocessing?: (match: string) => any;
}

export class InformationExtractor extends EventEmitter implements AIComponent {
  private status: ComponentStatus;
  private nerModel: VietnameseNERModel | null = null;
  private relationModel: RelationExtractionModel | null = null;
  private templateExtractors: Map<string, TemplateExtractor> = new Map();
  private medicalCodeSystems: Map<CodeSystem, Set<string>> = new Map();
  private vietnameseLocations: Set<string> = new Set();
  private medicalTerminology: Map<string, string> = new Map();
  private processingStats = {
    totalProcessed: 0,
    totalEntitiesExtracted: 0,
    totalRelationsExtracted: 0,
    averageConfidence: 0
  };

  constructor() {
    super();
    this.status = {
      isReady: false,
      isProcessing: false,
      uptime: 0,
      totalProcessed: 0
    };
  }

  async initialize(): Promise<void> {
    try {
      this.emit('initialization_started');
      
      // Initialize Vietnamese NER model
      await this.initializeVietnameseNER();
      
      // Initialize relation extraction model
      await this.initializeRelationExtraction();
      
      // Load template extractors for different document types
      await this.loadTemplateExtractors();
      
      // Load medical code systems
      await this.loadMedicalCodeSystems();
      
      // Load Vietnamese geographic data
      await this.loadVietnameseLocations();
      
      // Load medical terminology
      await this.loadMedicalTerminology();
      
      this.status.isReady = true;
      this.emit('initialization_completed');
      
    } catch (error) {
      this.status.lastError = error.message;
      this.emit('initialization_failed', { error: error.message });
      throw error;
    }
  }

  async process(input: any, options?: any): Promise<any> {
    if (typeof input === 'string') {
      return await this.extractInformation(input, options);
    }
    throw new Error('Invalid input type for InformationExtractor');
  }

  getStatus(): ComponentStatus {
    return { ...this.status };
  }

  getMetrics(): PerformanceMetrics {
    return {
      inferenceTime: 0,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
      cpuUsage: 0,
      accuracy: this.processingStats.averageConfidence,
      precision: 0,
      recall: 0,
      f1Score: 0
    };
  }

  async extractInformation(
    text: string,
    config: ExtractionConfig = {
      enableNER: true,
      enableRelationExtraction: true,
      enableTemplateMatching: true,
      enableMedicalCoding: true,
      enableDateNormalization: true,
      enableAmountNormalization: true,
      confidenceThreshold: 0.7,
      language: 'vietnamese'
    }
  ): Promise<ExtractionResult> {
    const startTime = Date.now();
    this.status.isProcessing = true;

    try {
      this.emit('extraction_started', { textLength: text.length });

      // Preprocess text
      const preprocessedText = await this.preprocessText(text, config.language);
      
      // Named Entity Recognition
      let entities: NamedEntity[] = [];
      if (config.enableNER) {
        entities = await this.extractNamedEntities(preprocessedText, config);
      }
      
      // Relation Extraction
      let relationships: EntityRelationship[] = [];
      if (config.enableRelationExtraction) {
        relationships = await this.extractRelationships(preprocessedText, entities, config);
      }
      
      // Template-based extraction
      let structuredData: StructuredData = {} as StructuredData;
      if (config.enableTemplateMatching && config.documentType) {
        structuredData = await this.extractWithTemplate(preprocessedText, config.documentType);
      }
      
      // Medical code extraction
      let medicalCodes: MedicalCode[] = [];
      if (config.enableMedicalCoding) {
        medicalCodes = await this.extractMedicalCodes(preprocessedText);
      }
      
      // Date extraction and normalization
      let dates: ExtractedDate[] = [];
      if (config.enableDateNormalization) {
        dates = await this.extractAndNormalizeDates(preprocessedText);
      }
      
      // Amount extraction and normalization
      let amounts: ExtractedAmount[] = [];
      if (config.enableAmountNormalization) {
        amounts = await this.extractAndNormalizeAmounts(preprocessedText);
      }

      const result: ExtractionResult = {
        entities: entities.filter(e => e.confidence >= config.confidenceThreshold),
        relationships: relationships.filter(r => r.confidence >= config.confidenceThreshold),
        structuredData,
        medicalCodes,
        dates,
        amounts,
        metadata: {
          extractorVersion: '1.0.0',
          entitiesFound: entities.length,
          relationshipsFound: relationships.length,
          processingTime: Date.now() - startTime,
          qualityScore: this.calculateExtractionQuality(entities, relationships)
        }
      };

      // Update statistics
      this.updateProcessingStats(result);
      
      this.emit('extraction_completed', {
        entitiesFound: result.entities.length,
        relationshipsFound: result.relationships.length,
        processingTime: result.metadata.processingTime
      });

      return result;

    } catch (error) {
      this.emit('extraction_failed', { error: error.message });
      throw error;
    } finally {
      this.status.isProcessing = false;
    }
  }

  private async initializeVietnameseNER(): Promise<void> {
    // Initialize Vietnamese NER model with healthcare focus
    const labelMap = new Map<string, EntityType>([
      ['PER', 'PERSON'],
      ['ORG', 'ORG'],
      ['DATE', 'DATE'],
      ['MONEY', 'MONEY'],
      ['MED', 'MEDICAL_CODE'],
      ['PROC', 'PROCEDURE'],
      ['DRUG', 'MEDICATION'],
      ['DIAG', 'DIAGNOSIS'],
      ['HOSP', 'HOSPITAL'],
      ['DOC', 'DOCTOR'],
      ['PID', 'PATIENT_ID'],
      ['INS', 'INSURANCE_NUMBER'],
      ['PHONE', 'PHONE'],
      ['ADDR', 'ADDRESS'],
      ['EMAIL', 'EMAIL']
    ]);

    const medicalVocabulary = new Set([
      'bệnh viện', 'phòng khám', 'bác sĩ', 'y tá', 'điều dưỡng',
      'chẩn đoán', 'điều trị', 'thuốc', 'xét nghiệm', 'khám bệnh',
      'phẫu thuật', 'gây mê', 'hồi s���c', 'cấp cứu', 'nội trú',
      'ngo���i trú', 'tái khám', 'nhập viện', 'xuất viện'
    ]);

    const personNamePatterns = [
      /(?:bệnh nhân|bn|patient)[\s:]*([A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+(?:\s[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+)*)/gi,
      /(?:bác sĩ|bs|doctor|dr\.?)[\s:]*([A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+(?:\s[A-ZÀÁẠẢÃÂẦẤẬ���ẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+)*)/gi
    ];

    const locationPatterns = [
      /(?:địa chỉ|address)[\s:]*([^,\n]+)/gi,
      /(Hà Nội|TP\.?HCM|Thành phố Hồ Chí Minh|Đà Nẵng|Hải Phòng|Cần Thơ)/gi
    ];

    this.nerModel = {
      tokenizer: null, // Would be actual tokenizer
      model: null,     // Would be actual model
      labelMap,
      medicalVocabulary,
      personNamePatterns,
      locationPatterns
    };

    this.emit('vietnamese_ner_initialized');
  }

  private async initializeRelationExtraction(): Promise<void> {
    const rules: RelationRule[] = [
      {
        id: 'patient_of_hospital',
        name: 'Patient-Hospital Relationship',
        sourceEntityType: 'PERSON',
        targetEntityType: 'HOSPITAL',
        relationType: 'PATIENT_OF',
        patterns: [
          'bệnh nhân {source} tại {target}',
          '{source} đang điều trị tại {target}',
          '{source} khám tại {target}'
        ],
        confidence: 0.9
      },
      {
        id: 'doctor_at_hospital',
        name: 'Doctor-Hospital Relationship',
        sourceEntityType: 'DOCTOR',
        targetEntityType: 'HOSPITAL',
        relationType: 'DOCTOR_AT',
        patterns: [
          'bác sĩ {source} tại {target}',
          'bs {source} - {target}',
          '{source} làm việc tại {target}'
        ],
        confidence: 0.85
      },
      {
        id: 'prescribed_by',
        name: 'Medication-Doctor Relationship',
        sourceEntityType: 'MEDICATION',
        targetEntityType: 'DOCTOR',
        relationType: 'PRESCRIBED_BY',
        patterns: [
          '{target} kê đơn {source}',
          'thuốc {source} được kê bởi {target}',
          '{target} chỉ định {source}'
        ],
        confidence: 0.8
      },
      {
        id: 'diagnosed_with',
        name: 'Patient-Diagnosis Relationship',
        sourceEntityType: 'PERSON',
        targetEntityType: 'DIAGNOSIS',
        relationType: 'DIAGNOSED_WITH',
        patterns: [
          '{source} chẩn đoán {target}',
          'bệnh nhân {source} mắc {target}',
          '{source} bị {target}'
        ],
        confidence: 0.85
      }
    ];

    const patterns: RelationPattern[] = [
      {
        pattern: /([A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s]+)\s+tại\s+([A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ\s]+)/gi,
        relationType: 'TREATED_AT',
        sourceGroup: 1,
        targetGroup: 2,
        contextKeywords: ['điều trị', 'khám', 'chữa']
      },
      {
        pattern: /kê\s+đơn\s+(.+?)\s+cho\s+(.+)/gi,
        relationType: 'PRESCRIBED_BY',
        sourceGroup: 1,
        targetGroup: 2,
        contextKeywords: ['thuốc', 'medication', 'prescription']
      }
    ];

    this.relationModel = {
      rules,
      patterns,
      contextWindow: 50,
      confidenceThreshold: 0.7
    };

    this.emit('relation_extraction_initialized');
  }

  private async loadTemplateExtractors(): Promise<void> {
    // Medical Bill Template
    const medicalBillExtractor: TemplateExtractor = {
      documentType: 'medical_bill',
      requiredFields: [
        { name: 'hospitalName', type: 'string', required: true },
        { name: 'billNumber', type: 'string', required: true },
        { name: 'patientName', type: 'string', required: true },
        { name: 'totalAmount', type: 'amount', required: true },
        { name: 'billDate', type: 'date', required: true }
      ],
      optionalFields: [
        { name: 'patientId', type: 'string', required: false },
        { name: 'insuranceNumber', type: 'string', required: false },
        { name: 'doctorName', type: 'string', required: false }
      ],
      patterns: [
        {
          fieldName: 'hospitalName',
          patterns: [
            /(?:bệnh viện|hospital)\s*([^\n\r]+)/gi,
            /^([^0-9\n\r]+(?:bệnh viện|hospital)[^\n\r]*)/gim
          ],
          contextKeywords: ['bệnh viện', 'hospital', 'phòng khám']
        },
        {
          fieldName: 'billNumber',
          patterns: [
            /(?:số hóa đơn|bill no|invoice no)[\s:]*([A-Z0-9-]+)/gi,
            /(?:hóa đơn số|bill #)[\s:]*([A-Z0-9-]+)/gi
          ],
          contextKeywords: ['hóa đơn', 'bill', 'invoice']
        },
        {
          fieldName: 'totalAmount',
          patterns: [
            /(?:tổng tiền|total|thành ti���n)[\s:]*([0-9,.\s]+)(?:vnđ|vnd|đồng)/gi,
            /(?:phải thanh toán|amount due)[\s:]*([0-9,.\s]+)(?:vnđ|vnd|đồng)/gi
          ],
          contextKeywords: ['tổng', 'total', 'thanh toán', 'amount']
        }
      ]
    };

    // Prescription Template
    const prescriptionExtractor: TemplateExtractor = {
      documentType: 'prescription',
      requiredFields: [
        { name: 'doctorName', type: 'string', required: true },
        { name: 'patientName', type: 'string', required: true },
        { name: 'medications', type: 'string', required: true },
        { name: 'prescriptionDate', type: 'date', required: true }
      ],
      optionalFields: [
        { name: 'doctorLicense', type: 'string', required: false },
        { name: 'diagnosis', type: 'string', required: false },
        { name: 'instructions', type: 'string', required: false }
      ],
      patterns: [
        {
          fieldName: 'doctorName',
          patterns: [
            /(?:bác sĩ|doctor|dr\.?)\s*([A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụ��ũưừứựửữỳýỵỷỹđ\s]+)/gi
          ],
          contextKeywords: ['bác sĩ', 'doctor', 'physician']
        },
        {
          fieldName: 'medications',
          patterns: [
            /(?:thuốc|medication|drug)[\s:]*([^\n\r]+)/gi,
            /(\d+\.?\s*[A-Za-z][^\n\r]*mg[^\n\r]*)/gim
          ],
          contextKeywords: ['thuốc', 'medication', 'mg', 'tablet']
        }
      ]
    };

    // Lab Result Template
    const labResultExtractor: TemplateExtractor = {
      documentType: 'lab_result',
      requiredFields: [
        { name: 'labName', type: 'string', required: true },
        { name: 'patientName', type: 'string', required: true },
        { name: 'testDate', type: 'date', required: true },
        { name: 'results', type: 'string', required: true }
      ],
      optionalFields: [
        { name: 'referenceRanges', type: 'string', required: false },
        { name: 'abnormalFlags', type: 'string', required: false }
      ],
      patterns: [
        {
          fieldName: 'labName',
          patterns: [
            /(?:phòng xét nghiệm|laboratory|lab)\s*([^\n\r]+)/gi
          ],
          contextKeywords: ['xét nghiệm', 'laboratory', 'lab']
        },
        {
          fieldName: 'results',
          patterns: [
            /([A-Za-z][^:]+):\s*([0-9.,]+)\s*([a-zA-Z\/μμ]+)/gim,
            /(hemoglobin|glucose|cholesterol|creatinine)[\s:]*([0-9.,]+)/gi
          ],
          contextKeywords: ['kết quả', 'result', 'value']
        }
      ]
    };

    this.templateExtractors.set('medical_bill', medicalBillExtractor);
    this.templateExtractors.set('prescription', prescriptionExtractor);
    this.templateExtractors.set('lab_result', labResultExtractor);

    this.emit('template_extractors_loaded', { count: this.templateExtractors.size });
  }

  private async loadMedicalCodeSystems(): Promise<void> {
    // ICD-10 codes (simplified set)
    const icd10Codes = new Set([
      'I10', 'E11', 'J44', 'N18', 'I25', 'F32', 'M79',
      'K59', 'R06', 'Z51', 'I50', 'J45', 'E78', 'M54'
    ]);

    // Vietnamese medical procedure codes
    const vietnameseMedicalCodes = new Set([
      'KT001', 'XQ002', 'SA003', 'DT004', 'XN005',
      'PT006', 'GM007', 'HS008', 'CC009', 'TC010'
    ]);

    this.medicalCodeSystems.set('ICD10', icd10Codes);
    this.medicalCodeSystems.set('Vietnamese_Medical', vietnameseMedicalCodes);

    this.emit('medical_codes_loaded', { 
      icd10Count: icd10Codes.size,
      vietnameseCount: vietnameseMedicalCodes.size 
    });
  }

  private async loadVietnameseLocations(): Promise<void> {
    const locations = [
      'Hà Nội', 'TP.HCM', 'Thành phố Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng',
      'Cần Thơ', 'Biên Hòa', 'Huế', 'Nha Trang', 'Buôn Ma Thuột',
      'Vinh', 'Nam Định', 'Thái Nguyên', 'Vũng Tàu', 'Quy Nhon'
    ];

    locations.forEach(location => this.vietnameseLocations.add(location));
    this.emit('vietnamese_locations_loaded', { count: locations.length });
  }

  private async loadMedicalTerminology(): Promise<void> {
    const terminology = new Map([
      ['hemoglobin', 'huyết sắc tố'],
      ['glucose', 'đường huyết'],
      ['cholesterol', 'cholesterol'],
      ['creatinine', 'creatinine'],
      ['urea', 'urê'],
      ['albumin', 'albumin'],
      ['bilirubin', 'bilirubin'],
      ['triglyceride', 'triglycerid'],
      ['ast', 'AST'],
      ['alt', 'ALT']
    ]);

    this.medicalTerminology = terminology;
    this.emit('medical_terminology_loaded', { count: terminology.size });
  }

  private async preprocessText(text: string, language: string): Promise<string> {
    let processed = text;
    
    // Normalize whitespace
    processed = processed.replace(/\s+/g, ' ').trim();
    
    // Vietnamese-specific preprocessing
    if (language === 'vietnamese') {
      // Normalize common OCR errors for Vietnamese
      const corrections = new Map([
        ['VND', 'VNĐ'],
        ['BENH VIEN', 'BỆNH VIỆN'],
        ['HOA DON', 'HÓA ĐƠN'],
        ['XET NGHIEM', 'XÉT NGHIỆM'],
        ['BAC SI', 'BÁC SĨ']
      ]);
      
      corrections.forEach((correct, incorrect) => {
        processed = processed.replace(new RegExp(incorrect, 'gi'), correct);
      });
    }
    
    return processed;
  }

  private async extractNamedEntities(
    text: string,
    config: ExtractionConfig
  ): Promise<NamedEntity[]> {
    const entities: NamedEntity[] = [];
    
    if (!this.nerModel) {
      throw new Error('NER model not initialized');
    }
    
    // Extract persons using patterns
    for (const pattern of this.nerModel.personNamePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        entities.push({
          text: match[1].trim(),
          type: 'PERSON',
          confidence: 0.85,
          position: {
            start: match.index,
            end: match.index + match[0].length,
            line: this.getLineNumber(text, match.index),
            column: this.getColumnNumber(text, match.index)
          },
          attributes: {
            role: match[0].toLowerCase().includes('bác s��') ? 'doctor' : 'patient'
          }
        });
      }
    }
    
    // Extract locations
    for (const pattern of this.nerModel.locationPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        entities.push({
          text: match[1] ? match[1].trim() : match[0].trim(),
          type: 'ADDRESS',
          confidence: 0.8,
          position: {
            start: match.index,
            end: match.index + match[0].length,
            line: this.getLineNumber(text, match.index),
            column: this.getColumnNumber(text, match.index)
          },
          attributes: {}
        });
      }
    }
    
    // Extract organizations (hospitals, clinics)
    const orgPatterns = [
      /(?:bệnh viện|phòng khám|trung tâm y tế)\s+([A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][^\n\r.;,]{5,50})/gi,
      /(BỆNH VIỆN [A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][^\n\r.;,]*)/gi
    ];
    
    for (const pattern of orgPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        entities.push({
          text: match[1] ? match[1].trim() : match[0].trim(),
          type: 'ORG',
          confidence: 0.9,
          position: {
            start: match.index,
            end: match.index + match[0].length,
            line: this.getLineNumber(text, match.index),
            column: this.getColumnNumber(text, match.index)
          },
          attributes: {
            category: 'healthcare'
          }
        });
      }
    }
    
    // Extract phone numbers
    const phonePattern = /(?:điện thoại|phone|tel|dt)[\s:]*([0-9\-\.\s\(\)]{8,15})/gi;
    let match;
    while ((match = phonePattern.exec(text)) !== null) {
      entities.push({
        text: match[1].trim(),
        type: 'PHONE',
        confidence: 0.95,
        position: {
          start: match.index,
          end: match.index + match[0].length,
          line: this.getLineNumber(text, match.index),
          column: this.getColumnNumber(text, match.index)
        },
        attributes: {}
      });
    }
    
    // Extract emails
    const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
    while ((match = emailPattern.exec(text)) !== null) {
      entities.push({
        text: match[1],
        type: 'EMAIL',
        confidence: 0.98,
        position: {
          start: match.index,
          end: match.index + match[0].length,
          line: this.getLineNumber(text, match.index),
          column: this.getColumnNumber(text, match.index)
        },
        attributes: {}
      });
    }
    
    return entities;
  }

  private async extractRelationships(
    text: string,
    entities: NamedEntity[],
    config: ExtractionConfig
  ): Promise<EntityRelationship[]> {
    const relationships: EntityRelationship[] = [];
    
    if (!this.relationModel) {
      return relationships;
    }
    
    // Apply rule-based relation extraction
    for (const rule of this.relationModel.rules) {
      const sourceEntities = entities.filter(e => e.type === rule.sourceEntityType);
      const targetEntities = entities.filter(e => e.type === rule.targetEntityType);
      
      for (const sourceEntity of sourceEntities) {
        for (const targetEntity of targetEntities) {
          // Check if entities appear in relation patterns
          for (const pattern of rule.patterns) {
            const templatePattern = pattern
              .replace('{source}', sourceEntity.text)
              .replace('{target}', targetEntity.text);
            
            const regex = new RegExp(templatePattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            if (regex.test(text)) {
              relationships.push({
                sourceEntity: sourceEntity.text,
                targetEntity: targetEntity.text,
                relationship: rule.relationType,
                confidence: rule.confidence
              });
            }
          }
        }
      }
    }
    
    // Apply pattern-based relation extraction
    for (const pattern of this.relationModel.patterns) {
      let match;
      while ((match = pattern.pattern.exec(text)) !== null) {
        const sourceText = match[pattern.sourceGroup];
        const targetText = match[pattern.targetGroup];
        
        if (sourceText && targetText) {
          relationships.push({
            sourceEntity: sourceText.trim(),
            targetEntity: targetText.trim(),
            relationship: pattern.relationType,
            confidence: 0.75
          });
        }
      }
    }
    
    return relationships;
  }

  private async extractWithTemplate(
    text: string,
    documentType: string
  ): Promise<StructuredData> {
    const template = this.templateExtractors.get(documentType);
    if (!template) {
      return {} as StructuredData;
    }
    
    const extractedData: any = {};
    
    // Extract required and optional fields
    const allFields = [...template.requiredFields, ...template.optionalFields];
    
    for (const field of allFields) {
      const patterns = template.patterns.filter(p => p.fieldName === field.name);
      
      for (const patternConfig of patterns) {
        for (const pattern of patternConfig.patterns) {
          const match = pattern.exec(text);
          if (match && match[1]) {
            let value = match[1].trim();
            
            // Apply field-specific processing
            if (field.type === 'date') {
              value = this.normalizeDate(value);
            } else if (field.type === 'amount') {
              value = this.normalizeAmount(value).toString();
            } else if (field.type === 'number') {
              value = parseFloat(value.replace(/[^0-9.]/g, '')).toString();
            }
            
            extractedData[field.name] = value;
            break;
          }
        }
        
        if (extractedData[field.name]) break;
      }
    }
    
    // Convert to structured data format based on document type
    return this.mapToStructuredData(extractedData, documentType);
  }

  private async extractMedicalCodes(text: string): Promise<MedicalCode[]> {
    const codes: MedicalCode[] = [];
    
    // Extract ICD-10 codes
    const icd10Pattern = /\b([A-Z]\d{2}(?:\.[A-Z0-9]{1,3})?)\b/g;
    let match;
    while ((match = icd10Pattern.exec(text)) !== null) {
      const code = match[1];
      if (this.medicalCodeSystems.get('ICD10')?.has(code.substring(0, 3))) {
        codes.push({
          code,
          system: 'ICD10',
          description: this.getCodeDescription(code, 'ICD10'),
          confidence: 0.9,
          position: {
            start: match.index,
            end: match.index + match[0].length,
            line: this.getLineNumber(text, match.index),
            column: this.getColumnNumber(text, match.index)
          }
        });
      }
    }
    
    // Extract Vietnamese medical codes
    const vnMedicalPattern = /\b([A-Z]{2}\d{3})\b/g;
    while ((match = vnMedicalPattern.exec(text)) !== null) {
      const code = match[1];
      if (this.medicalCodeSystems.get('Vietnamese_Medical')?.has(code)) {
        codes.push({
          code,
          system: 'Vietnamese_Medical',
          description: this.getCodeDescription(code, 'Vietnamese_Medical'),
          confidence: 0.85,
          position: {
            start: match.index,
            end: match.index + match[0].length,
            line: this.getLineNumber(text, match.index),
            column: this.getColumnNumber(text, match.index)
          }
        });
      }
    }
    
    return codes;
  }

  private async extractAndNormalizeDates(text: string): Promise<ExtractedDate[]> {
    const dates: ExtractedDate[] = [];
    
    // Vietnamese date patterns
    const datePatterns = [
      {
        pattern: /(\d{1,2})\/(\d{1,2})\/(\d{4})/g,
        format: 'DD/MM/YYYY',
        type: 'SERVICE_DATE' as DateType
      },
      {
        pattern: /(\d{1,2})-(\d{1,2})-(\d{4})/g,
        format: 'DD-MM-YYYY',
        type: 'SERVICE_DATE' as DateType
      },
      {
        pattern: /ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})/gi,
        format: 'Vietnamese',
        type: 'SERVICE_DATE' as DateType
      },
      {
        pattern: /(?:sinh|born)[\s:]*(\d{1,2}\/\d{1,2}\/\d{4})/gi,
        format: 'DD/MM/YYYY',
        type: 'BIRTH_DATE' as DateType
      }
    ];
    
    for (const datePattern of datePatterns) {
      let match;
      while ((match = datePattern.pattern.exec(text)) !== null) {
        try {
          let dateValue: Date;
          
          if (datePattern.format === 'Vietnamese') {
            const day = parseInt(match[1]);
            const month = parseInt(match[2]);
            const year = parseInt(match[3]);
            dateValue = new Date(year, month - 1, day);
          } else {
            // Handle DD/MM/YYYY and DD-MM-YYYY formats
            const day = parseInt(match[1]);
            const month = parseInt(match[2]);
            const year = parseInt(match[3]);
            dateValue = new Date(year, month - 1, day);
          }
          
          if (!isNaN(dateValue.getTime())) {
            dates.push({
              value: dateValue,
              format: datePattern.format,
              confidence: 0.9,
              position: {
                start: match.index,
                end: match.index + match[0].length,
                line: this.getLineNumber(text, match.index),
                column: this.getColumnNumber(text, match.index)
              },
              type: datePattern.type
            });
          }
        } catch (error) {
          // Skip invalid dates
          continue;
        }
      }
    }
    
    return dates;
  }

  private async extractAndNormalizeAmounts(text: string): Promise<ExtractedAmount[]> {
    const amounts: ExtractedAmount[] = [];
    
    // Vietnamese currency patterns
    const amountPatterns = [
      {
        pattern: /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*(?:vnđ|vnd|đồng)/gi,
        type: 'TOTAL_AMOUNT' as AmountType,
        currency: 'VND'
      },
      {
        pattern: /(?:tổng tiền|total|thành tiền)[\s:]*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*(?:vnđ|vnd|đồng)/gi,
        type: 'TOTAL_AMOUNT' as AmountType,
        currency: 'VND'
      },
      {
        pattern: /(?:đồng chi|copay)[\s:]*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*(?:vnđ|vnd|đồng)/gi,
        type: 'COPAY' as AmountType,
        currency: 'VND'
      },
      {
        pattern: /(?:phí dịch vụ|service fee)[\s:]*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*(?:vnđ|vnd|đồng)/gi,
        type: 'SERVICE_FEE' as AmountType,
        currency: 'VND'
      }
    ];
    
    for (const amountPattern of amountPatterns) {
      let match;
      while ((match = amountPattern.pattern.exec(text)) !== null) {
        try {
          // Normalize Vietnamese number format
          let amountStr = match[1].replace(/\./g, '').replace(/,/g, '.');
          const amount = parseFloat(amountStr);
          
          if (!isNaN(amount) && amount > 0) {
            amounts.push({
              value: amount,
              currency: amountPattern.currency,
              confidence: 0.9,
              position: {
                start: match.index,
                end: match.index + match[0].length,
                line: this.getLineNumber(text, match.index),
                column: this.getColumnNumber(text, match.index)
              },
              type: amountPattern.type
            });
          }
        } catch (error) {
          // Skip invalid amounts
          continue;
        }
      }
    }
    
    return amounts;
  }

  // Helper methods
  private getLineNumber(text: string, position: number): number {
    return text.substring(0, position).split('\n').length;
  }

  private getColumnNumber(text: string, position: number): number {
    const lines = text.substring(0, position).split('\n');
    return lines[lines.length - 1].length + 1;
  }

  private normalizeDate(dateStr: string): string {
    // Normalize date string to ISO format
    try {
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0];
    } catch {
      return dateStr;
    }
  }

  private normalizeAmount(amountStr: string): number {
    // Normalize Vietnamese amount format
    const normalized = amountStr
      .replace(/[^\d.,]/g, '')
      .replace(/\./g, '')
      .replace(',', '.');
    
    return parseFloat(normalized) || 0;
  }

  private getCodeDescription(code: string, system: CodeSystem): string {
    // Mock code descriptions - would use actual medical code database
    const descriptions = new Map([
      ['I10', 'Essential hypertension'],
      ['E11', 'Type 2 diabetes mellitus'],
      ['J44', 'Chronic obstructive pulmonary disease'],
      ['KT001', 'Khám tổng quát'],
      ['XQ002', 'X-quang ngực'],
      ['SA003', 'Siêu âm bụng']
    ]);
    
    return descriptions.get(code) || 'Unknown code';
  }

  private mapToStructuredData(extractedData: any, documentType: string): StructuredData {
    const structuredData: StructuredData = {
      patientInfo: {} as PatientInfo,
      providerInfo: {} as ProviderInfo,
      serviceInfo: {} as ServiceInfo,
      billing: {} as BillingInfo,
      diagnosis: {} as DiagnosisInfo,
      medication: [],
      labResults: []
    };

    // Map based on document type
    switch (documentType) {
      case 'medical_bill':
        structuredData.patientInfo.name = extractedData.patientName || '';
        structuredData.patientInfo.id = extractedData.patientId || '';
        structuredData.providerInfo.name = extractedData.hospitalName || '';
        structuredData.billing.billNumber = extractedData.billNumber || '';
        structuredData.billing.totalAmount = extractedData.totalAmount || 0;
        structuredData.billing.currency = 'VND';
        break;
        
      case 'prescription':
        structuredData.patientInfo.name = extractedData.patientName || '';
        structuredData.providerInfo.name = extractedData.doctorName || '';
        if (extractedData.medications) {
          structuredData.medication = [{
            name: extractedData.medications,
            dosage: '',
            frequency: '',
            duration: '',
            prescribedBy: extractedData.doctorName || '',
            rxNumber: ''
          }];
        }
        break;
        
      case 'lab_result':
        structuredData.patientInfo.name = extractedData.patientName || '';
        structuredData.providerInfo.name = extractedData.labName || '';
        if (extractedData.results) {
          structuredData.labResults = [{
            testName: 'General Lab Test',
            value: extractedData.results,
            unit: '',
            referenceRange: '',
            abnormal: false,
            testDate: new Date()
          }];
        }
        break;
    }

    return structuredData;
  }

  private calculateExtractionQuality(
    entities: NamedEntity[],
    relationships: EntityRelationship[]
  ): number {
    // Quality score based on entity diversity and confidence
    const entityTypes = new Set(entities.map(e => e.type));
    const avgEntityConfidence = entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length || 0;
    const avgRelationConfidence = relationships.reduce((sum, r) => sum + r.confidence, 0) / relationships.length || 0;
    
    const diversityScore = entityTypes.size / 10; // Normalize by expected entity types
    const confidenceScore = (avgEntityConfidence + avgRelationConfidence) / 2;
    
    return Math.min((diversityScore + confidenceScore) / 2, 1.0);
  }

  private updateProcessingStats(result: ExtractionResult): void {
    this.processingStats.totalProcessed++;
    this.processingStats.totalEntitiesExtracted += result.entities.length;
    this.processingStats.totalRelationsExtracted += result.relationships.length;
    
    const avgConfidence = [
      ...result.entities.map(e => e.confidence),
      ...result.relationships.map(r => r.confidence)
    ].reduce((sum, conf) => sum + conf, 0) / (result.entities.length + result.relationships.length) || 0;
    
    this.processingStats.averageConfidence = (
      (this.processingStats.averageConfidence * (this.processingStats.totalProcessed - 1) + avgConfidence) /
      this.processingStats.totalProcessed
    );
  }

  // Public API methods
  getSupportedEntityTypes(): EntityType[] {
    return [
      'PERSON', 'ORG', 'DATE', 'MONEY', 'MEDICAL_CODE', 'PROCEDURE',
      'MEDICATION', 'DIAGNOSIS', 'HOSPITAL', 'DOCTOR', 'PATIENT_ID',
      'INSURANCE_NUMBER', 'PHONE', 'ADDRESS', 'EMAIL'
    ];
  }

  getSupportedRelationTypes(): RelationType[] {
    return [
      'PATIENT_OF', 'DOCTOR_AT', 'PRESCRIBED_BY', 'DIAGNOSED_WITH',
      'TREATED_AT', 'ORDERED_BY', 'BILLED_TO', 'PERFORMED_ON'
    ];
  }

  getSupportedDocumentTypes(): string[] {
    return Array.from(this.templateExtractors.keys());
  }

  getProcessingStatistics(): any {
    return { ...this.processingStats };
  }

  async addCustomTemplate(template: TemplateExtractor): Promise<void> {
    this.templateExtractors.set(template.documentType, template);
    this.emit('custom_template_added', { documentType: template.documentType });
  }

  async updateMedicalCodeSystem(system: CodeSystem, codes: Set<string>): Promise<void> {
    this.medicalCodeSystems.set(system, codes);
    this.emit('medical_codes_updated', { system, count: codes.size });
  }
}
