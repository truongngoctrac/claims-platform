import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import Fuse from 'fuse.js';

export interface ParsedDocument {
  id: string;
  originalDocumentId: string;
  parsingJobId: string;
  timestamp: Date;
  status: 'processing' | 'completed' | 'failed';
  confidence: number;
  
  // Extracted content
  structuredData: StructuredDocumentData;
  extractedFields: ExtractedField[];
  detectedEntities: Entity[];
  metadata: DocumentParsingMetadata;
  
  // Quality metrics
  qualityScore: number;
  parsingErrors: ParsingError[];
  suggestions: string[];
}

export interface StructuredDocumentData {
  documentType: string;
  title?: string;
  subtitle?: string;
  header: DocumentSection;
  body: DocumentSection[];
  footer: DocumentSection;
  tables: ExtractedTable[];
  forms: ExtractedForm[];
  signatures: ExtractedSignature[];
  stamps: ExtractedStamp[];
}

export interface DocumentSection {
  id: string;
  type: 'header' | 'paragraph' | 'list' | 'table' | 'image' | 'footer';
  content: string;
  position: BoundingBox;
  formatting: TextFormatting;
  confidence: number;
  language?: string;
}

export interface ExtractedField {
  id: string;
  name: string;
  value: string;
  type: FieldType;
  confidence: number;
  position: BoundingBox;
  validation: FieldValidation;
  alternatives?: string[];
}

export type FieldType = 
  | 'text'
  | 'number'
  | 'date'
  | 'currency'
  | 'email'
  | 'phone'
  | 'id_number'
  | 'address'
  | 'medical_code'
  | 'insurance_number';

export interface Entity {
  id: string;
  text: string;
  type: EntityType;
  subtype?: string;
  confidence: number;
  position: BoundingBox;
  attributes: Record<string, any>;
  relationships: EntityRelationship[];
}

export type EntityType = 
  | 'person'
  | 'organization'
  | 'location'
  | 'date'
  | 'money'
  | 'medical_condition'
  | 'medication'
  | 'procedure'
  | 'diagnosis'
  | 'body_part';

export interface EntityRelationship {
  relationType: string;
  targetEntityId: string;
  confidence: number;
}

export interface ExtractedTable {
  id: string;
  title?: string;
  position: BoundingBox;
  rows: TableRow[];
  headers: string[];
  confidence: number;
  tableType: 'data' | 'invoice' | 'medical_report' | 'pricing';
}

export interface TableRow {
  cells: TableCell[];
  rowType: 'header' | 'data' | 'total' | 'subtotal';
}

export interface TableCell {
  content: string;
  type: FieldType;
  position: BoundingBox;
  confidence: number;
  formatting?: TextFormatting;
}

export interface ExtractedForm {
  id: string;
  formType: string;
  fields: ExtractedField[];
  completeness: number;
  validationResults: FormValidationResult[];
}

export interface ExtractedSignature {
  id: string;
  position: BoundingBox;
  signatureType: 'handwritten' | 'digital' | 'stamp';
  confidence: number;
  signerName?: string;
  timestamp?: Date;
  verified: boolean;
}

export interface ExtractedStamp {
  id: string;
  position: BoundingBox;
  stampType: 'official' | 'approval' | 'date' | 'signature';
  text: string;
  confidence: number;
  organization?: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  page?: number;
}

export interface TextFormatting {
  fontSize?: number;
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  backgroundColor?: string;
}

export interface FieldValidation {
  isValid: boolean;
  validationRules: string[];
  errors: string[];
  suggestions: string[];
}

export interface FormValidationResult {
  fieldName: string;
  isValid: boolean;
  errors: string[];
  requiredFieldMissing: boolean;
}

export interface DocumentParsingMetadata {
  parsingEngine: string;
  ocrEngine: string;
  language: string;
  processingTime: number;
  documentClassification: string;
  templateMatched?: string;
  customRulesApplied: string[];
}

export interface ParsingError {
  id: string;
  type: 'ocr_error' | 'structure_error' | 'validation_error' | 'template_error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  position?: BoundingBox;
  suggestions: string[];
}

export interface ParsingTemplate {
  id: string;
  name: string;
  documentType: string;
  fields: TemplateField[];
  rules: ParsingRule[];
  validationRules: ValidationRule[];
  active: boolean;
}

export interface TemplateField {
  name: string;
  type: FieldType;
  required: boolean;
  position?: BoundingBox;
  patterns: string[];
  aliases: string[];
}

export interface ParsingRule {
  id: string;
  name: string;
  condition: string;
  action: string;
  priority: number;
}

export interface ValidationRule {
  field: string;
  type: 'required' | 'format' | 'range' | 'custom';
  rule: string;
  errorMessage: string;
}

export interface ParsingOptions {
  enableOCR?: boolean;
  ocrEngine?: 'tesseract' | 'aws_textract' | 'google_vision' | 'azure_cognitive';
  language?: string;
  templateId?: string;
  confidence_threshold?: number;
  enableNER?: boolean; // Named Entity Recognition
  enableTableExtraction?: boolean;
  enableFormDetection?: boolean;
  enableSignatureDetection?: boolean;
  customRules?: ParsingRule[];
  outputFormat?: 'json' | 'xml' | 'csv';
}

export class SmartDocumentParsingService extends EventEmitter {
  private parsedDocuments: Map<string, ParsedDocument> = new Map();
  private parsingJobs: Map<string, any> = new Map();
  private templates: Map<string, ParsingTemplate> = new Map();
  private parsingRules: Map<string, ParsingRule[]> = new Map();

  constructor() {
    super();
    this.initializeDefaultTemplates();
  }

  async parseDocument(
    documentId: string,
    documentBuffer: Buffer,
    mimeType: string,
    options: ParsingOptions = {}
  ): Promise<string> {
    const jobId = uuidv4();
    const defaultOptions: ParsingOptions = {
      enableOCR: true,
      ocrEngine: 'tesseract',
      language: 'vie',
      confidence_threshold: 0.7,
      enableNER: true,
      enableTableExtraction: true,
      enableFormDetection: true,
      enableSignatureDetection: true,
      outputFormat: 'json'
    };

    const mergedOptions = { ...defaultOptions, ...options };

    const parsingJob = {
      id: jobId,
      documentId,
      status: 'processing',
      startTime: new Date(),
      options: mergedOptions
    };

    this.parsingJobs.set(jobId, parsingJob);

    // Start parsing process
    this.performParsing(jobId, documentBuffer, mimeType, mergedOptions);

    return jobId;
  }

  async getParsingResult(jobId: string): Promise<ParsedDocument | null> {
    const job = this.parsingJobs.get(jobId);
    if (!job) return null;

    if (job.status === 'completed') {
      return this.parsedDocuments.get(job.resultId) || null;
    }

    return null;
  }

  async getParsingJob(jobId: string): Promise<any> {
    return this.parsingJobs.get(jobId) || null;
  }

  private async performParsing(
    jobId: string,
    documentBuffer: Buffer,
    mimeType: string,
    options: ParsingOptions
  ): Promise<void> {
    const job = this.parsingJobs.get(jobId);
    if (!job) return;

    try {
      this.emit('parsingStarted', { jobId });

      // Step 1: OCR Processing
      const ocrResult = await this.performOCR(documentBuffer, mimeType, options);
      
      // Step 2: Document Classification
      const classification = await this.classifyDocument(ocrResult, options);
      
      // Step 3: Template Matching
      const template = await this.findMatchingTemplate(classification, ocrResult);
      
      // Step 4: Structure Extraction
      const structuredData = await this.extractDocumentStructure(ocrResult, template);
      
      // Step 5: Field Extraction
      const extractedFields = await this.extractFields(ocrResult, template, options);
      
      // Step 6: Entity Recognition
      const entities = options.enableNER ? 
        await this.extractEntities(ocrResult, options) : [];
      
      // Step 7: Table Extraction
      const tables = options.enableTableExtraction ? 
        await this.extractTables(ocrResult, options) : [];
      
      // Step 8: Form Detection
      const forms = options.enableFormDetection ? 
        await this.extractForms(ocrResult, extractedFields) : [];
      
      // Step 9: Signature Detection
      const signatures = options.enableSignatureDetection ? 
        await this.extractSignatures(documentBuffer, mimeType) : [];
      
      // Step 10: Validation
      const validationResults = await this.validateExtractedData(
        extractedFields, 
        forms, 
        template
      );
      
      // Step 11: Quality Assessment
      const qualityMetrics = this.assessParsingQuality(
        ocrResult,
        extractedFields,
        entities,
        validationResults
      );

      // Create parsed document
      const parsedDocumentId = uuidv4();
      const parsedDocument: ParsedDocument = {
        id: parsedDocumentId,
        originalDocumentId: job.documentId,
        parsingJobId: jobId,
        timestamp: new Date(),
        status: 'completed',
        confidence: qualityMetrics.overallConfidence,
        structuredData: {
          documentType: classification.type,
          title: structuredData.title,
          subtitle: structuredData.subtitle,
          header: structuredData.header,
          body: structuredData.body,
          footer: structuredData.footer,
          tables,
          forms,
          signatures,
          stamps: [] // TODO: implement stamp detection
        },
        extractedFields,
        detectedEntities: entities,
        metadata: {
          parsingEngine: 'SmartParser-v1.0',
          ocrEngine: options.ocrEngine || 'tesseract',
          language: options.language || 'vie',
          processingTime: Date.now() - job.startTime.getTime(),
          documentClassification: classification.type,
          templateMatched: template?.id,
          customRulesApplied: []
        },
        qualityScore: qualityMetrics.qualityScore,
        parsingErrors: qualityMetrics.errors,
        suggestions: qualityMetrics.suggestions
      };

      this.parsedDocuments.set(parsedDocumentId, parsedDocument);
      job.status = 'completed';
      job.resultId = parsedDocumentId;
      job.endTime = new Date();

      this.emit('parsingCompleted', { jobId, parsedDocumentId, result: parsedDocument });

    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.endTime = new Date();
      
      this.emit('parsingFailed', { jobId, error: error.message });
    }
  }

  private async performOCR(
    documentBuffer: Buffer,
    mimeType: string,
    options: ParsingOptions
  ): Promise<any> {
    // Mock OCR implementation
    const ocrResult = {
      text: `
        BỆNH VIỆN BẠCH MAI
        HÓA ĐƠN VIỆN PHÍ
        
        Họ tên bệnh nhân: Nguyễn Văn A
        BHYT: 12345678901
        Ngày sinh: 15/01/1980
        Địa chỉ: 123 Đường ABC, Hà Nội
        
        STT | Dịch vụ           | Số lượng | Đơn giá    | Thành tiền
        1   | Khám bệnh        | 1        | 50,000     | 50,000
        2   | Xét nghiệm máu   | 1        | 150,000    | 150,000
        3   | Thuốc kháng sinh | 2        | 75,000     | 150,000
        
        Tổng tiền: 350,000 VNĐ
        Đã thanh toán: 350,000 VNĐ
        
        Ngày: 20/01/2024
        Chữ ký bác sĩ: [Signature]
      `,
      blocks: [
        {
          text: 'BỆNH VIỆN BẠCH MAI',
          position: { x: 100, y: 50, width: 300, height: 30 },
          confidence: 0.98
        },
        {
          text: 'HÓA ĐƠN VIỆN PHÍ',
          position: { x: 120, y: 90, width: 260, height: 25 },
          confidence: 0.96
        }
      ],
      words: [],
      lines: [],
      confidence: 0.94
    };

    return ocrResult;
  }

  private async classifyDocument(ocrResult: any, options: ParsingOptions): Promise<any> {
    const text = ocrResult.text.toLowerCase();
    
    // Simple classification based on keywords
    if (text.includes('hóa đơn') && text.includes('viện phí')) {
      return { type: 'medical_invoice', confidence: 0.95 };
    } else if (text.includes('đơn thuốc')) {
      return { type: 'prescription', confidence: 0.92 };
    } else if (text.includes('xét nghiệm')) {
      return { type: 'lab_result', confidence: 0.88 };
    } else if (text.includes('chẩn đoán')) {
      return { type: 'medical_report', confidence: 0.85 };
    }
    
    return { type: 'unknown', confidence: 0.3 };
  }

  private async findMatchingTemplate(
    classification: any,
    ocrResult: any
  ): Promise<ParsingTemplate | null> {
    const template = this.templates.get(classification.type);
    return template || null;
  }

  private async extractDocumentStructure(
    ocrResult: any,
    template?: ParsingTemplate | null
  ): Promise<any> {
    // Extract document structure
    return {
      title: 'BỆNH VIỆN BẠCH MAI',
      subtitle: 'HÓA ĐƠN VIỆN PHÍ',
      header: {
        id: uuidv4(),
        type: 'header' as const,
        content: 'BỆNH VIỆN BẠCH MAI\nHÓA ĐƠN VIỆN PHÍ',
        position: { x: 100, y: 50, width: 300, height: 55 },
        formatting: { fontSize: 16, bold: true },
        confidence: 0.97
      },
      body: [
        {
          id: uuidv4(),
          type: 'paragraph' as const,
          content: 'Thông tin bệnh nhân và dịch vụ y tế',
          position: { x: 50, y: 150, width: 400, height: 200 },
          formatting: {},
          confidence: 0.92
        }
      ],
      footer: {
        id: uuidv4(),
        type: 'footer' as const,
        content: 'Ngày: 20/01/2024\nChữ ký bác sĩ',
        position: { x: 50, y: 450, width: 400, height: 50 },
        formatting: {},
        confidence: 0.89
      }
    };
  }

  private async extractFields(
    ocrResult: any,
    template?: ParsingTemplate | null,
    options?: ParsingOptions
  ): Promise<ExtractedField[]> {
    const fields: ExtractedField[] = [];

    // Extract patient information
    const patientNameMatch = ocrResult.text.match(/Họ tên bệnh nhân:\s*(.+)/);
    if (patientNameMatch) {
      fields.push({
        id: uuidv4(),
        name: 'patient_name',
        value: patientNameMatch[1].trim(),
        type: 'text',
        confidence: 0.95,
        position: { x: 50, y: 180, width: 200, height: 20 },
        validation: {
          isValid: true,
          validationRules: ['required', 'min_length:2'],
          errors: [],
          suggestions: []
        }
      });
    }

    // Extract BHYT number
    const bhytMatch = ocrResult.text.match(/BHYT:\s*(\d+)/);
    if (bhytMatch) {
      fields.push({
        id: uuidv4(),
        name: 'insurance_number',
        value: bhytMatch[1],
        type: 'id_number',
        confidence: 0.92,
        position: { x: 50, y: 200, width: 150, height: 20 },
        validation: {
          isValid: bhytMatch[1].length === 11,
          validationRules: ['required', 'length:11'],
          errors: bhytMatch[1].length !== 11 ? ['Invalid BHYT format'] : [],
          suggestions: []
        }
      });
    }

    // Extract total amount
    const totalMatch = ocrResult.text.match(/Tổng tiền:\s*([\d,]+)\s*VNĐ/);
    if (totalMatch) {
      fields.push({
        id: uuidv4(),
        name: 'total_amount',
        value: totalMatch[1].replace(/,/g, ''),
        type: 'currency',
        confidence: 0.98,
        position: { x: 300, y: 380, width: 100, height: 20 },
        validation: {
          isValid: true,
          validationRules: ['required', 'numeric'],
          errors: [],
          suggestions: []
        }
      });
    }

    return fields;
  }

  private async extractEntities(
    ocrResult: any,
    options: ParsingOptions
  ): Promise<Entity[]> {
    const entities: Entity[] = [];

    // Extract medical entities
    const medicalKeywords = ['khám bệnh', 'xét nghiệm', 'thuốc kháng sinh'];
    for (const keyword of medicalKeywords) {
      if (ocrResult.text.toLowerCase().includes(keyword)) {
        entities.push({
          id: uuidv4(),
          text: keyword,
          type: 'procedure',
          confidence: 0.85,
          position: { x: 0, y: 0, width: 0, height: 0 },
          attributes: { category: 'medical_service' },
          relationships: []
        });
      }
    }

    // Extract organization
    entities.push({
      id: uuidv4(),
      text: 'BỆNH VIỆN BẠCH MAI',
      type: 'organization',
      subtype: 'hospital',
      confidence: 0.98,
      position: { x: 100, y: 50, width: 300, height: 30 },
      attributes: { 
        type: 'healthcare_provider',
        location: 'Hanoi'
      },
      relationships: []
    });

    return entities;
  }

  private async extractTables(
    ocrResult: any,
    options: ParsingOptions
  ): Promise<ExtractedTable[]> {
    const tables: ExtractedTable[] = [];

    // Extract service table
    const serviceTable: ExtractedTable = {
      id: uuidv4(),
      title: 'Dịch vụ y tế',
      position: { x: 50, y: 250, width: 400, height: 120 },
      headers: ['STT', 'Dịch vụ', 'Số lượng', 'Đơn giá', 'Thành tiền'],
      rows: [
        {
          cells: [
            { content: '1', type: 'number', position: { x: 50, y: 270, width: 30, height: 20 }, confidence: 0.98 },
            { content: 'Khám bệnh', type: 'text', position: { x: 80, y: 270, width: 120, height: 20 }, confidence: 0.95 },
            { content: '1', type: 'number', position: { x: 200, y: 270, width: 50, height: 20 }, confidence: 0.98 },
            { content: '50,000', type: 'currency', position: { x: 250, y: 270, width: 80, height: 20 }, confidence: 0.96 },
            { content: '50,000', type: 'currency', position: { x: 330, y: 270, width: 80, height: 20 }, confidence: 0.96 }
          ],
          rowType: 'data'
        },
        {
          cells: [
            { content: '2', type: 'number', position: { x: 50, y: 290, width: 30, height: 20 }, confidence: 0.98 },
            { content: 'Xét nghiệm máu', type: 'text', position: { x: 80, y: 290, width: 120, height: 20 }, confidence: 0.93 },
            { content: '1', type: 'number', position: { x: 200, y: 290, width: 50, height: 20 }, confidence: 0.98 },
            { content: '150,000', type: 'currency', position: { x: 250, y: 290, width: 80, height: 20 }, confidence: 0.96 },
            { content: '150,000', type: 'currency', position: { x: 330, y: 290, width: 80, height: 20 }, confidence: 0.96 }
          ],
          rowType: 'data'
        }
      ],
      confidence: 0.94,
      tableType: 'invoice'
    };

    tables.push(serviceTable);
    return tables;
  }

  private async extractForms(
    ocrResult: any,
    extractedFields: ExtractedField[]
  ): Promise<ExtractedForm[]> {
    const forms: ExtractedForm[] = [];

    // Create medical invoice form
    const invoiceForm: ExtractedForm = {
      id: uuidv4(),
      formType: 'medical_invoice',
      fields: extractedFields,
      completeness: this.calculateFormCompleteness(extractedFields),
      validationResults: this.validateForm(extractedFields)
    };

    forms.push(invoiceForm);
    return forms;
  }

  private async extractSignatures(
    documentBuffer: Buffer,
    mimeType: string
  ): Promise<ExtractedSignature[]> {
    // Mock signature detection
    return [
      {
        id: uuidv4(),
        position: { x: 350, y: 480, width: 100, height: 40 },
        signatureType: 'handwritten',
        confidence: 0.87,
        signerName: 'Bác sĩ',
        verified: false
      }
    ];
  }

  private async validateExtractedData(
    fields: ExtractedField[],
    forms: ExtractedForm[],
    template?: ParsingTemplate | null
  ): Promise<any> {
    const validationResults = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Validate required fields
    const requiredFields = ['patient_name', 'total_amount'];
    for (const requiredField of requiredFields) {
      const field = fields.find(f => f.name === requiredField);
      if (!field) {
        validationResults.isValid = false;
        validationResults.errors.push(`Required field '${requiredField}' not found`);
      }
    }

    return validationResults;
  }

  private assessParsingQuality(
    ocrResult: any,
    extractedFields: ExtractedField[],
    entities: Entity[],
    validationResults: any
  ): any {
    const totalConfidenceSum = extractedFields.reduce((sum, field) => sum + field.confidence, 0);
    const averageConfidence = extractedFields.length > 0 ? totalConfidenceSum / extractedFields.length : 0;

    const qualityScore = (
      ocrResult.confidence * 0.3 +
      averageConfidence * 0.4 +
      (validationResults.isValid ? 1 : 0.5) * 0.3
    );

    return {
      overallConfidence: averageConfidence,
      qualityScore,
      errors: [],
      suggestions: [
        'Consider improving image quality for better OCR results',
        'Verify extracted amounts manually'
      ]
    };
  }

  private calculateFormCompleteness(fields: ExtractedField[]): number {
    const requiredFields = ['patient_name', 'insurance_number', 'total_amount'];
    const extractedRequiredFields = fields.filter(f => requiredFields.includes(f.name));
    return extractedRequiredFields.length / requiredFields.length;
  }

  private validateForm(fields: ExtractedField[]): FormValidationResult[] {
    const results: FormValidationResult[] = [];

    for (const field of fields) {
      results.push({
        fieldName: field.name,
        isValid: field.validation.isValid,
        errors: field.validation.errors,
        requiredFieldMissing: false
      });
    }

    return results;
  }

  // Template management
  private initializeDefaultTemplates(): void {
    // Medical invoice template
    const medicalInvoiceTemplate: ParsingTemplate = {
      id: 'medical_invoice',
      name: 'Medical Invoice Template',
      documentType: 'medical_invoice',
      fields: [
        {
          name: 'patient_name',
          type: 'text',
          required: true,
          patterns: ['Họ tên bệnh nhân:\\s*(.+)', 'Tên bệnh nhân:\\s*(.+)'],
          aliases: ['patient_name', 'ho_ten']
        },
        {
          name: 'insurance_number',
          type: 'id_number',
          required: true,
          patterns: ['BHYT:\\s*(\\d+)', 'Mã BHYT:\\s*(\\d+)'],
          aliases: ['bhyt', 'insurance_id']
        },
        {
          name: 'total_amount',
          type: 'currency',
          required: true,
          patterns: ['Tổng tiền:\\s*([\\d,]+)', 'Tổng cộng:\\s*([\\d,]+)'],
          aliases: ['total', 'tong_tien']
        }
      ],
      rules: [],
      validationRules: [
        {
          field: 'insurance_number',
          type: 'format',
          rule: '^\\d{11}$',
          errorMessage: 'BHYT number must be 11 digits'
        }
      ],
      active: true
    };

    this.templates.set('medical_invoice', medicalInvoiceTemplate);
  }

  async addTemplate(template: ParsingTemplate): Promise<boolean> {
    this.templates.set(template.id, template);
    return true;
  }

  async getTemplate(templateId: string): Promise<ParsingTemplate | null> {
    return this.templates.get(templateId) || null;
  }

  async getAllTemplates(): Promise<ParsingTemplate[]> {
    return Array.from(this.templates.values());
  }

  async deleteTemplate(templateId: string): Promise<boolean> {
    return this.templates.delete(templateId);
  }

  // Batch processing
  async parseBatchDocuments(
    documents: Array<{
      id: string;
      buffer: Buffer;
      mimeType: string;
      options?: ParsingOptions;
    }>
  ): Promise<string[]> {
    const jobIds: string[] = [];

    for (const doc of documents) {
      const jobId = await this.parseDocument(
        doc.id,
        doc.buffer,
        doc.mimeType,
        doc.options
      );
      jobIds.push(jobId);
    }

    return jobIds;
  }

  async getParsingStatistics(): Promise<any> {
    const allJobs = Array.from(this.parsingJobs.values());
    const completedJobs = allJobs.filter(job => job.status === 'completed');
    const failedJobs = allJobs.filter(job => job.status === 'failed');
    
    return {
      totalJobs: allJobs.length,
      completedJobs: completedJobs.length,
      failedJobs: failedJobs.length,
      successRate: allJobs.length > 0 ? completedJobs.length / allJobs.length : 0,
      averageProcessingTime: completedJobs.length > 0 
        ? completedJobs.reduce((sum, job) => 
            sum + (job.endTime - job.startTime), 0) / completedJobs.length 
        : 0
    };
  }

  async exportParsingResult(
    parsedDocumentId: string,
    format: 'json' | 'xml' | 'csv' = 'json'
  ): Promise<string> {
    const parsedDoc = this.parsedDocuments.get(parsedDocumentId);
    if (!parsedDoc) throw new Error('Parsed document not found');

    switch (format) {
      case 'json':
        return JSON.stringify(parsedDoc, null, 2);
      case 'xml':
        return this.convertToXML(parsedDoc);
      case 'csv':
        return this.convertToCSV(parsedDoc);
      default:
        throw new Error('Unsupported export format');
    }
  }

  private convertToXML(parsedDoc: ParsedDocument): string {
    // Simple XML conversion implementation
    return `<?xml version="1.0" encoding="UTF-8"?>
<document>
  <id>${parsedDoc.id}</id>
  <confidence>${parsedDoc.confidence}</confidence>
  <fields>
    ${parsedDoc.extractedFields.map(field => 
      `<field name="${field.name}" type="${field.type}" confidence="${field.confidence}">
        ${field.value}
      </field>`
    ).join('\n    ')}
  </fields>
</document>`;
  }

  private convertToCSV(parsedDoc: ParsedDocument): string {
    const headers = 'Field Name,Type,Value,Confidence\n';
    const rows = parsedDoc.extractedFields.map(field => 
      `"${field.name}","${field.type}","${field.value}",${field.confidence}`
    ).join('\n');
    
    return headers + rows;
  }
}
